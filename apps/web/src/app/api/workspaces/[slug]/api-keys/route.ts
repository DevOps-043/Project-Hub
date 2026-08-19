import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';
import { generateApiKey, listApiKeys, normalizeApiKeyScopes } from '@/lib/services/api-key-service';

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace } = auth;

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
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { payload, workspace, member } = auth;

    if (!['owner', 'admin', 'manager'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para crear API keys' }, { status: 403 });
    }

    let body: { name?: string; scopes?: unknown; expiresAt?: string | null };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
    }

    const { name, scopes, expiresAt } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'El nombre no puede exceder 100 caracteres' }, { status: 400 });
    }

    const finalScopes = normalizeApiKeyScopes(scopes);
    if (!finalScopes) {
      return NextResponse.json({ error: 'Permisos invalidos. Usa read y/o write.' }, { status: 400 });
    }

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
