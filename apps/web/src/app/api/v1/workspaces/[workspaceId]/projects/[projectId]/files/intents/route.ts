import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { uploadIntentSchema } from '@/lib/api-v1/schemas';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { validateFileDeclaration } from '@/lib/api-v1/files';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'write');
    const { files } = await jsonBody(request, uploadIntentSchema);
    const supabase = getSupabaseAdmin();
    const results = [];
    for (const file of files) {
      const extension = validateFileDeclaration(file.name, file.mime_type);
      const evidenceId = crypto.randomUUID();
      const path = `${workspaceId}/${projectId}/${evidenceId}.${extension}`;
      const { data: signed, error: signedError } = await supabase.storage.from('project-files').createSignedUploadUrl(path);
      if (signedError || !signed) throw new ApiError(500, 'UPLOAD_INTENT_FAILED', 'No se pudo preparar la subida');
      const { error } = await supabase.from('pm_project_evidence').insert({
        evidence_id: evidenceId, workspace_id: workspaceId, project_id: projectId,
        evidence_type: 'upload', source_system: 'soflia-hub', title: file.name,
        content_hash: file.sha256, storage_path: path, mime_type: file.mime_type,
        file_size_bytes: file.size, metadata: { upload_state: 'pending', original_name: file.name },
        created_by_user_id: ctx.payload.sub,
      });
      if (error) throw new ApiError(500, 'UPLOAD_EVIDENCE_FAILED', 'No se pudo registrar el archivo');
      results.push({ evidence_id: evidenceId, path, signed_url: signed.signedUrl, token: signed.token });
    }
    return ok(request, results, { status: 201 });
  } catch (error) { return fail(request, error); }
}

