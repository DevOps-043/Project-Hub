import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceBySlug, getUserWorkspaceRole, getWorkspaceMembers, syncAllOrgMembers, updateMemberRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

const ALLOWED_ROLES = ['owner', 'admin', 'manager', 'leader', 'member'] as const;
const ROLES_THAT_CAN_EDIT = ['owner', 'admin'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const userMember = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!userMember) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const forceSync = request.nextUrl.searchParams.get('sync') === 'true';

    // Obtener miembros actuales
    let members = await getWorkspaceMembers(workspace.workspace_id);

    // Sincronizar con SOFIA solo si: se fuerza, o hay muy pocos miembros (primera carga)
    if (workspace.sofia_org_id && (forceSync || members.length <= 1)) {
      await syncAllOrgMembers(workspace.workspace_id, workspace.sofia_org_id);
      members = await getWorkspaceMembers(workspace.workspace_id);
    }

    const transformedMembers = members.map((m: any) => ({
      id: m.user_id,
      firstName: m.account_users?.first_name || '',
      lastNamePaternal: m.account_users?.last_name_paternal || '',
      displayName: m.account_users?.display_name || `${m.account_users?.first_name || ''} ${m.account_users?.last_name_paternal || ''}`.trim(),
      email: m.account_users?.email || '',
      avatarUrl: m.account_users?.avatar_url || null,
      permissionLevel: m.account_users?.permission_level || 'user',
      irisRole: m.iris_role,
      sofiaRole: m.sofia_role,
      joinedAt: m.joined_at,
      accountStatus: 'active',
    }));

    return NextResponse.json({
      users: transformedMembers,
      pagination: { page: 1, limit: transformedMembers.length, total: transformedMembers.length, totalPages: 1 },
    });
  } catch (error) {
    console.error('Workspace members API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    // Verificar que el usuario que edita es owner o admin
    const callerMember = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!callerMember || !ROLES_THAT_CAN_EDIT.includes(callerMember.iris_role)) {
      return NextResponse.json({ error: 'No tienes permisos para cambiar roles' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, irisRole } = body;

    if (!userId || !irisRole) {
      return NextResponse.json({ error: 'userId y irisRole son requeridos' }, { status: 400 });
    }

    if (!ALLOWED_ROLES.includes(irisRole)) {
      return NextResponse.json({ error: `Rol inválido. Roles permitidos: ${ALLOWED_ROLES.join(', ')}` }, { status: 400 });
    }

    // No permitir cambiar el rol del owner original
    const targetMember = await getUserWorkspaceRole(workspace.workspace_id, userId);
    if (targetMember?.iris_role === 'owner' && callerMember.iris_role !== 'owner') {
      return NextResponse.json({ error: 'Solo un owner puede cambiar el rol de otro owner' }, { status: 403 });
    }

    const success = await updateMemberRole(workspace.workspace_id, userId, irisRole);

    if (!success) {
      return NextResponse.json({ error: 'Error al actualizar el rol' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Rol actualizado correctamente' });
  } catch (error) {
    console.error('Workspace members PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
