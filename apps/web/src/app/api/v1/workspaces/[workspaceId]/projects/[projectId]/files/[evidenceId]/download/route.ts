import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { ApiError, fail, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ workspaceId: string; projectId: string; evidenceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId, evidenceId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId);
    const supabase = getSupabaseAdmin();
    const { data: evidence } = await supabase.from('pm_project_evidence').select('storage_path,metadata')
      .eq('evidence_id', evidenceId).eq('workspace_id', workspaceId).eq('project_id', projectId).is('archived_at', null).maybeSingle();
    if (!evidence?.storage_path || evidence.metadata?.upload_state !== 'ready') throw new ApiError(404, 'FILE_NOT_FOUND', 'Archivo no encontrado');
    const { data, error } = await supabase.storage.from('project-files').createSignedUrl(evidence.storage_path, 300);
    if (error || !data) throw new ApiError(500, 'SIGNED_URL_FAILED', 'No se pudo crear la descarga');
    return ok(request, { signed_url: data.signedUrl, expires_in: 300 });
  } catch (error) { return fail(request, error); }
}

