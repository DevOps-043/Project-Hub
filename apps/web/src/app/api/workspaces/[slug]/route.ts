/**
 * API Route: GET /api/workspaces/:slug
 * Obtiene detalle de un workspace + rol del usuario
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import {
  getWorkspaceBySlug,
  getUserWorkspaceRole,
  getWorkspaceMemberCount,
  getWorkspaceMembers,
} from '@/lib/services/workspace-service';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token =
      request.cookies.get('accessToken')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { slug } = await params;
    const workspace = await getWorkspaceBySlug(slug);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el usuario tiene acceso
    const membership = await getUserWorkspaceRole(
      workspace.workspace_id,
      payload.sub
    );

    if (!membership) {
      return NextResponse.json(
        { error: 'No tienes acceso a este workspace' },
        { status: 403 }
      );
    }

    const includeMembers = request.nextUrl.searchParams.get('includeMembers') === 'true';
    const [memberCount, members] = await Promise.all([
      getWorkspaceMemberCount(workspace.workspace_id),
      includeMembers ? getWorkspaceMembers(workspace.workspace_id, { limit: 1000, offset: 0 }) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      workspace: {
        id: workspace.workspace_id,
        name: workspace.name,
        slug: workspace.slug,
        logoUrl: workspace.logo_url,
        brandColor: workspace.brand_color,
        description: workspace.description,
        settings: workspace.settings,
      },
      userRole: membership.iris_role,
      sofiaRole: membership.sofia_role,
      memberCount,
      members: members.map((m: any) => ({
        id: m.member_id,
        userId: m.user_id,
        role: m.iris_role,
        sofiaRole: m.sofia_role,
        joinedAt: m.joined_at,
        user: m.account_users
          ? {
              name:
                m.account_users.display_name ||
                `${m.account_users.first_name} ${m.account_users.last_name_paternal}`,
              email: m.account_users.email,
              avatar: m.account_users.avatar_url,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('[API /workspaces/:slug] Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
