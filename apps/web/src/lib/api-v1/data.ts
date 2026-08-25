import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ApiError } from './http';

export async function recordActivity(input: {
  workspaceId: string; projectId: string; actorId: string; action: string;
  entityType: string; entityId?: string; correlationId?: string; metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin().from('pm_project_activity').insert({
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    actor_user_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    correlation_id: input.correlationId,
    metadata: input.metadata || {},
  });
  if (error) console.error('[API v1] No se pudo registrar actividad:', error.message);
}

export async function enqueueIntegration(input: {
  workspaceId: string; projectId: string; aggregateType: string; aggregateId: string;
  eventType: string; payload: Record<string, unknown>; idempotencyKey: string;
}) {
  const { error } = await getSupabaseAdmin().from('integration_outbox').upsert({
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    aggregate_type: input.aggregateType,
    aggregate_id: input.aggregateId,
    event_type: input.eventType,
    destination: 'lia',
    payload: input.payload,
    idempotency_key: input.idempotencyKey,
  }, { onConflict: 'destination,idempotency_key', ignoreDuplicates: true });
  if (error) throw new ApiError(500, 'OUTBOX_WRITE_FAILED', 'No se pudo registrar la sincronización');
}

export async function insertEvidenceItems(evidenceId: string, items: Array<Record<string, unknown>>) {
  if (!items.length) return [];
  const rows = items.map((item) => ({
    evidence_id: evidenceId,
    item_type: item.type,
    position: item.position,
    title: item.title,
    content: item.content,
    source_url: item.source_url,
    source_hash: item.source_hash,
    metadata: item.metadata || {},
  }));
  const { data, error } = await getSupabaseAdmin().from('pm_project_evidence_items').insert(rows).select();
  if (error) throw new ApiError(500, 'EVIDENCE_ITEMS_FAILED', 'No se pudieron guardar los elementos');
  return data || [];
}

export function projectKey(name: string): string {
  const prefix = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 5).toUpperCase().padEnd(3, 'X');
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

