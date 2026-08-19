import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';
import { revokeApiKey } from '@/lib/services/api-key-service';

type RouteParams = { params: Promise<{ slug: string; keyId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, keyId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace, member } = auth;

    if (!['owner', 'admin'].includes(member.iris_role)) {
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
