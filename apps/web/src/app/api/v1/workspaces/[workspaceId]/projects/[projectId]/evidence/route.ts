import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { createEvidenceSchema } from '@/lib/api-v1/schemas';
import { ApiError, decodeCursor, encodeCursor, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { insertEvidenceItems, recordActivity } from '@/lib/api-v1/data';
import { sanitizeEvidenceItems, sanitizeExternalUrl } from '@/lib/api-v1/sanitize';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId);
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 50), 1), 100);
    const cursor = decodeCursor(request.nextUrl.searchParams.get('cursor'));
    let query = getSupabaseAdmin().from('pm_project_evidence').select('*')
      .eq('workspace_id', workspaceId).eq('project_id', projectId).is('archived_at', null)
      .order('created_at', { ascending: false }).order('evidence_id', { ascending: false }).limit(limit + 1);
    if (cursor) query = query.or(`created_at.lt.${cursor.updated_at},and(created_at.eq.${cursor.updated_at},evidence_id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw new ApiError(500, 'EVIDENCE_LIST_FAILED', 'No se pudo listar la evidencia');
    const rows = data || [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return ok(request, page, undefined, { has_more: hasMore,
      next_cursor: hasMore && last ? encodeCursor({ updated_at: last.created_at, id: last.evidence_id }) : null });
  } catch (error) { return fail(request, error); }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'write');
    const input = await jsonBody(request, createEvidenceSchema);
    const metadata = { ...input.metadata };
    if (typeof metadata.url === 'string') metadata.url = sanitizeExternalUrl(metadata.url);
    const { data: evidence, error } = await getSupabaseAdmin().from('pm_project_evidence').insert({
      workspace_id: workspaceId, project_id: projectId, evidence_type: input.type,
      source_system: input.source_system, external_reference: input.external_reference,
      version: input.version, title: input.title, summary: input.summary,
      content_hash: input.content_hash, metadata, created_by_user_id: ctx.payload.sub,
    }).select().single();
    if (error || !evidence) {
      if (error?.code === '23505') throw new ApiError(409, 'EVIDENCE_VERSION_EXISTS', 'Esta versión ya existe');
      throw new ApiError(500, 'EVIDENCE_CREATE_FAILED', 'No se pudo guardar la evidencia');
    }
    const items = await insertEvidenceItems(evidence.evidence_id, sanitizeEvidenceItems(input.items));
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'evidence.created', entityType: 'evidence', entityId: evidence.evidence_id });
    return ok(request, { ...evidence, items }, { status: 201 });
  } catch (error) { return fail(request, error); }
}
