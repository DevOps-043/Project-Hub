import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { uploadCompleteSchema } from '@/lib/api-v1/schemas';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { validateMagicBytes } from '@/lib/api-v1/files';
import { recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'write');
    const { evidence_id: evidenceId } = await jsonBody(request, uploadCompleteSchema);
    const supabase = getSupabaseAdmin();
    const { data: evidence } = await supabase.from('pm_project_evidence').select('*')
      .eq('evidence_id', evidenceId).eq('workspace_id', workspaceId).eq('project_id', projectId)
      .eq('evidence_type', 'upload').maybeSingle();
    if (!evidence?.storage_path || !evidence.mime_type) throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'Subida no encontrada');
    const { data: blob, error } = await supabase.storage.from('project-files').download(evidence.storage_path);
    if (error || !blob) throw new ApiError(422, 'UPLOAD_OBJECT_MISSING', 'El archivo aún no está disponible');
    if (blob.size !== evidence.file_size_bytes || blob.size > 20 * 1024 * 1024) throw new ApiError(422, 'FILE_SIZE_MISMATCH', 'El tamaño no coincide');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    validateMagicBytes(evidence.mime_type, bytes.subarray(0, Math.min(bytes.length, 512)));
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
    if (hash.toLowerCase() !== evidence.content_hash?.toLowerCase()) throw new ApiError(422, 'FILE_HASH_MISMATCH', 'El hash del archivo no coincide');
    const metadata = { ...(evidence.metadata || {}), upload_state: 'ready', validated_at: new Date().toISOString() };
    const { data: completed } = await supabase.from('pm_project_evidence').update({ metadata })
      .eq('evidence_id', evidenceId).select().single();
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'file.uploaded', entityType: 'evidence', entityId: evidenceId });
    return ok(request, completed);
  } catch (error) { return fail(request, error); }
}

