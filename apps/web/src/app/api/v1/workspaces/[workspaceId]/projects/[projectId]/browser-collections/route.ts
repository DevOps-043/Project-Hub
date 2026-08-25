import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { browserCollectionSchema } from '@/lib/api-v1/schemas';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { insertEvidenceItems, recordActivity } from '@/lib/api-v1/data';
import { sanitizeEvidenceItems } from '@/lib/api-v1/sanitize';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId);
    const { data, error } = await getSupabaseAdmin().from('pm_project_evidence').select('*, pm_project_evidence_items(*)')
      .eq('workspace_id', workspaceId).eq('project_id', projectId).eq('evidence_type', 'browser_collection')
      .is('archived_at', null).order('created_at', { ascending: false });
    if (error) throw new ApiError(500, 'COLLECTION_LIST_FAILED', 'No se pudieron listar las colecciones');
    return ok(request, data || []);
  } catch (error) { return fail(request, error); }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'write');
    const input = await jsonBody(request, browserCollectionSchema);
    const tabs = sanitizeEvidenceItems(input.tabs);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(tabs)));
    const contentHash = Buffer.from(hash).toString('hex');
    const { data: evidence, error } = await getSupabaseAdmin().from('pm_project_evidence').insert({
      workspace_id: workspaceId, project_id: projectId, evidence_type: 'browser_collection', source_system: 'soflia-browser',
      external_reference: input.external_reference, version: input.version, title: input.name, summary: input.summary,
      content_hash: contentHash, metadata: { tab_count: tabs.length, immutable: true }, created_by_user_id: ctx.payload.sub,
    }).select().single();
    if (error || !evidence) {
      if (error?.code === '23505') throw new ApiError(409, 'COLLECTION_VERSION_EXISTS', 'Esta versión de la colección ya existe');
      throw new ApiError(500, 'COLLECTION_CREATE_FAILED', 'No se pudo guardar la colección');
    }
    const items = await insertEvidenceItems(evidence.evidence_id, tabs);
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'browser_collection.created', entityType: 'evidence', entityId: evidence.evidence_id });
    return ok(request, { ...evidence, items }, { status: 201 });
  } catch (error) { return fail(request, error); }
}

