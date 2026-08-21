/**
 * Guards de autorización reutilizables para API routes de Next.js.
 *
 * Centralizan la extracción/verificación de JWT y el chequeo de rol para que
 * cada route no tenga que reimplementar (u olvidar) el control de acceso.
 * Antes de esto, la mayoría de las rutas /api/admin/* solo heredaban del
 * middleware la garantía de "trae un JWT válido", sin verificar permission_level,
 * lo que permitía a cualquier usuario autenticado operar sobre datos globales.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, type JWTPayload } from './jwt';
import { getWorkspaceBySlug, getUserWorkspaceRole, type Workspace, type WorkspaceMember } from '@/lib/services/workspace-service';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const ADMIN_PERMISSION_LEVELS = new Set(['super_admin', 'admin']);

export type AuthResult =
  | { ok: true; payload: JWTPayload }
  | { ok: false; response: NextResponse };

function extractToken(request: NextRequest): string | null {
  return (
    request.cookies.get('accessToken')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    null
  );
}

/**
 * Exige un JWT válido y no expirado. No exige ningún rol específico.
 * Úsalo en endpoints que solo requieren "estar logueado" (ej. herramientas
 * de IA compartidas por todos los roles del workspace).
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const token = extractToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado', code: 'UNAUTHORIZED' }, { status: 401 }),
    };
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' }, { status: 401 }),
    };
  }

  // Un refresh token es un JWT válido con el mismo payload que uno de acceso,
  // solo que vive más tiempo y solo debería aceptarse en /api/auth/refresh.
  // Varias rutas ya chequeaban esto manualmente (p.ej. admin/tasks/export);
  // centralizado acá para que ninguna ruta nueva se olvide de excluirlo.
  if (payload.type !== 'access') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' }, { status: 401 }),
    };
  }

  return { ok: true, payload };
}

/**
 * Exige JWT válido Y permission_level admin/super_admin.
 * Úsalo en toda ruta bajo /api/admin/* que opere sobre datos globales
 * del sistema (usuarios, equipos, proyectos, analíticas de toda la org).
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;

  if (!ADMIN_PERMISSION_LEVELS.has(authResult.payload.permissionLevel)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Acceso denegado', code: 'FORBIDDEN' }, { status: 403 }),
    };
  }

  return authResult;
}

/**
 * Exige JWT válido Y (permission_level admin/super_admin GLOBAL, O ser
 * miembro activo del workspace dueño de este equipo).
 *
 * Las rutas /api/admin/teams/:teamId/* las consume tanto el panel admin
 * global (donde requireAdmin solo tiene sentido) como el panel scoped a
 * organización (/[orgSlug]/admin/teams/:teamId/*), donde un owner de ESA
 * org sin permission_level global admin/super_admin quedaba bloqueado con
 * 403 aunque tuviera control total de su propio workspace — permission_level
 * es una cuenta global, iris_role es un rol por workspace; son cosas
 * distintas y esta ruta solo miraba la primera. `teamId` debe ser el UUID ya
 * resuelto (no un slug), típicamente después de la resolución slug→UUID que
 * cada ruta ya hace.
 */
export async function requireAdminOrWorkspaceMemberForTeam(request: NextRequest, teamId: string): Promise<AuthResult> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;

  if (ADMIN_PERMISSION_LEVELS.has(authResult.payload.permissionLevel)) {
    return authResult;
  }

  try {
    const { data: team } = await getSupabaseAdmin()
      .from('teams')
      .select('workspace_id')
      .eq('team_id', teamId)
      .maybeSingle();

    const member = team?.workspace_id ? await getUserWorkspaceRole(team.workspace_id, authResult.payload.sub) : null;
    if (member) return authResult;
  } catch {
    // Non-admin and lookup failed or not a member
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Acceso denegado', code: 'FORBIDDEN' }, { status: 403 }),
  };
}

export type WorkspaceAuthResult =
  | { ok: true; payload: JWTPayload; workspace: Workspace; member: WorkspaceMember }
  | { ok: false; response: NextResponse };

/**
 * Exige JWT válido + que el workspace (por slug) exista + que el usuario sea
 * miembro. No exige ningún `iris_role` específico — las rutas bajo
 * `/api/workspaces/[slug]/*` que necesitan un rol mínimo (p.ej. solo
 * owner/admin) deben seguir chequeando `member.iris_role` después de llamar
 * a esto. Centraliza el bloque de 3 pasos (auth → workspace → membresía)
 * que antes se repetía inline en ~16 archivos de esa carpeta.
 */
export async function requireWorkspaceMember(request: NextRequest, slug: string): Promise<WorkspaceAuthResult> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 }),
    };
  }

  const member = await getUserWorkspaceRole(workspace.workspace_id, auth.payload.sub);
  if (!member) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sin acceso al workspace' }, { status: 403 }),
    };
  }

  return { ok: true, payload: auth.payload, workspace, member };
}
