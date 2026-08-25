/** Adaptador temporal de /api/v1. Remover después del periodo de deprecación. */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { GET as listV1, POST as createV1 } from '../../v1/workspaces/[workspaceId]/projects/route';

const DEPRECATION_HEADERS = { Deprecation: 'true', Sunset: 'Wed, 31 Dec 2026 23:59:59 GMT', Link: '</api/v1>; rel="successor-version"' };

async function legacyContext(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const payload = token ? await verifyToken(token) : null;
  if (!payload || payload.type !== 'access') return null;
  const requested = request.nextUrl.searchParams.get('workspace_id') || request.headers.get('x-workspace-id');
  const query = getSupabaseAdmin().from('workspace_members').select('workspace_id').eq('user_id', payload.sub).eq('is_active', true);
  const { data } = requested ? await query.eq('workspace_id', requested).limit(1) : await query.limit(2);
  if (!data?.length || (!requested && data.length !== 1)) return { workspaceId: null };
  return { workspaceId: data[0].workspace_id as string };
}

export async function GET(request: NextRequest) {
  const context = await legacyContext(request);
  if (!context) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401, headers: DEPRECATION_HEADERS });
  if (!context.workspaceId) return NextResponse.json({ error: 'workspace_id es requerido cuando hay más de un workspace' }, { status: 400, headers: DEPRECATION_HEADERS });
  const response = await listV1(request, { params: Promise.resolve({ workspaceId: context.workspaceId }) });
  const body = await response.json();
  return NextResponse.json(response.ok ? { projects: body.data || [], meta: body.meta } : body, { status: response.status, headers: DEPRECATION_HEADERS });
}

export async function POST(request: NextRequest) {
  const context = await legacyContext(request);
  if (!context) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401, headers: DEPRECATION_HEADERS });
  if (!context.workspaceId) return NextResponse.json({ error: 'workspace_id es requerido cuando hay más de un workspace' }, { status: 400, headers: DEPRECATION_HEADERS });
  const legacy = await request.json().catch(() => ({})) as Record<string, unknown>;
  const adapted = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({
    name: legacy.name, description: legacy.description, team_id: legacy.team_id,
    priority: legacy.priority || 'medium', tags: legacy.tags || [],
  }) });
  const response = await createV1(adapted, { params: Promise.resolve({ workspaceId: context.workspaceId }) });
  const body = await response.json();
  return NextResponse.json(response.ok ? { project: body.data, meta: body.meta } : body, { status: response.status, headers: DEPRECATION_HEADERS });
}

