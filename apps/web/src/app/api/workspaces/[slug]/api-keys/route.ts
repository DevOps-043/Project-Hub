import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';
import { generateApiKey, listApiKeys } from '@/lib/services/api-key-service';

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const keys = await listApiKeys(workspace.workspace_id);

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member || !['owner', 'admin', 'manager'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para crear API keys' }, { status: 403 });
    }

    const body = await request.json();
    const { name, scopes, expiresAt } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'El nombre no puede exceder 100 caracteres' }, { status: 400 });
    }

    const validScopes = ['read', 'write'];
    const finalScopes = Array.isArray(scopes)
      ? scopes.filter((s: string) => validScopes.includes(s))
      : ['read', 'write'];

    const result = await generateApiKey(
      workspace.workspace_id,
      payload.sub,
      name.trim(),
      finalScopes,
      expiresAt || null
    );

    return NextResponse.json({
      success: true,
      key: {
        ...result.keyRecord,
        plainKey: result.plainKey,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
