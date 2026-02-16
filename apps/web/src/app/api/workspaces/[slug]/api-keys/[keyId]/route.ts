import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';
import { revokeApiKey } from '@/lib/services/api-key-service';

type RouteParams = { params: Promise<{ slug: string; keyId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, keyId } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member || !['owner', 'admin'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para revocar API keys' }, { status: 403 });
    }

    const success = await revokeApiKey(keyId, workspace.workspace_id);
    if (!success) {
      return NextResponse.json({ error: 'Error revocando la key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
