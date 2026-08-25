/** Adaptador temporal de tareas /api/v1. Nunca consulta issues globalmente. */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { GET as listV1, POST as createV1 } from '../../v1/workspaces/[workspaceId]/projects/[projectId]/tasks/route';
import { PATCH as updateV1 } from '../../v1/workspaces/[workspaceId]/projects/[projectId]/tasks/[taskId]/route';

const HEADERS = { Deprecation: 'true', Sunset: 'Wed, 31 Dec 2026 23:59:59 GMT', Link: '</api/v1>; rel="successor-version"' };

async function resolve(request: NextRequest, projectId: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const payload = token ? await verifyToken(token) : null;
  if (!payload || payload.type !== 'access') return { status: 401 as const };
  const { data: project } = await getSupabaseAdmin().from('pm_projects').select('workspace_id').eq('project_id', projectId).maybeSingle();
  if (!project?.workspace_id) return { status: 404 as const };
  const { data: member } = await getSupabaseAdmin().from('workspace_members').select('member_id').eq('workspace_id', project.workspace_id)
    .eq('user_id', payload.sub).eq('is_active', true).maybeSingle();
  return member ? { status: 200 as const, workspaceId: project.workspace_id as string } : { status: 403 as const };
}

function respond(response: Response, body: unknown) { return NextResponse.json(body, { status: response.status, headers: HEADERS }); }

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id es requerido' }, { status: 400, headers: HEADERS });
  const context = await resolve(request, projectId);
  if (context.status !== 200) return NextResponse.json({ error: context.status === 401 ? 'No autorizado' : 'Sin acceso al proyecto' }, { status: context.status, headers: HEADERS });
  const response = await listV1(request, { params: Promise.resolve({ workspaceId: context.workspaceId!, projectId }) });
  const body = await response.json();
  return respond(response, response.ok ? { issues: body.data || [], meta: body.meta } : body);
}

export async function POST(request: NextRequest) {
  const legacy = await request.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = typeof legacy.project_id === 'string' ? legacy.project_id : '';
  if (!projectId || !legacy.title) return NextResponse.json({ error: 'project_id y title son requeridos' }, { status: 400, headers: HEADERS });
  const context = await resolve(request, projectId);
  if (context.status !== 200) return NextResponse.json({ error: 'Sin acceso al proyecto' }, { status: context.status, headers: HEADERS });
  const adapted = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({
    title: legacy.title, description: legacy.description, status_id: legacy.status_id,
    priority_id: legacy.priority_id, assignee_id: legacy.assignee_id, due_date: legacy.due_date,
  }) });
  const response = await createV1(adapted, { params: Promise.resolve({ workspaceId: context.workspaceId!, projectId }) });
  const body = await response.json();
  return respond(response, response.ok ? { issue: body.data, meta: body.meta } : body);
}

export async function PATCH(request: NextRequest) {
  const legacy = await request.json().catch(() => ({})) as Record<string, unknown>;
  const taskId = typeof legacy.issue_id === 'string' ? legacy.issue_id : '';
  if (!taskId) return NextResponse.json({ error: 'issue_id es requerido' }, { status: 400, headers: HEADERS });
  const { data: issue } = await getSupabaseAdmin().from('task_issues').select('project_id').eq('issue_id', taskId).maybeSingle();
  if (!issue?.project_id) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404, headers: HEADERS });
  const context = await resolve(request, issue.project_id);
  if (context.status !== 200) return NextResponse.json({ error: 'Sin acceso al proyecto' }, { status: context.status, headers: HEADERS });
  const allowed = ['title', 'description', 'status_id', 'priority_id', 'assignee_id', 'due_date'];
  const updates = Object.fromEntries(Object.entries(legacy).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400, headers: HEADERS });
  const adapted = new NextRequest(request.url, { method: 'PATCH', headers: request.headers, body: JSON.stringify(updates) });
  const response = await updateV1(adapted, { params: Promise.resolve({ workspaceId: context.workspaceId!, projectId: issue.project_id, taskId }) });
  const body = await response.json();
  return respond(response, response.ok ? { issue: body.data, meta: body.meta } : body);
}

