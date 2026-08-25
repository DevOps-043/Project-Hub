import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { meetingImportSchema } from '@/lib/api-v1/schemas';
import { ApiError, correlationId, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'write');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key requerido');
    const input = await jsonBody(request, meetingImportSchema);
    const requestHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)));
    const { data, error } = await getSupabaseAdmin().rpc('project_hub_import_meeting', {
      p_workspace_id: workspaceId, p_actor_user_id: ctx.payload.sub, p_project_id: projectId,
      p_idempotency_key: idempotencyKey, p_request_hash: Buffer.from(requestHashBuffer).toString('hex'),
      p_evidence: input.evidence, p_items: input.items, p_tasks: input.tasks,
      p_correlation_id: correlationId(request),
    });
    if (error) {
      if (error.message.includes('IDEMPOTENCY_KEY_REUSED')) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otro contenido');
      throw new ApiError(422, 'MEETING_IMPORT_FAILED', 'No se pudo importar la reunión', error.message);
    }
    return ok(request, data);
  } catch (error) { return fail(request, error); }
}

