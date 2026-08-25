import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/server';

type OutboxEvent = {
  event_id: string;
  workspace_id: string;
  project_id: string | null;
  event_type: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

export function secureSecretEquals(actual: string | null, expected: string): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function drainLiaOutbox(limit = 25) {
  const destination = process.env.LIA_PROJECT_HUB_OUTBOX_URL;
  const signingSecret = process.env.LIA_PROJECT_HUB_OUTBOX_HMAC_SECRET;
  if (!destination || !signingSecret) throw new Error('outbox_not_configured');

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('integration_outbox').select('*')
    .eq('destination', 'lia').in('state', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString()).order('created_at').limit(Math.min(limit, 50));
  if (error) throw new Error('outbox_read_failed');

  let delivered = 0;
  let failed = 0;
  for (const event of (data || []) as OutboxEvent[]) {
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await supabase.from('integration_outbox')
      .update({ state: 'processing', updated_at: claimedAt })
      .eq('event_id', event.event_id).in('state', ['pending', 'failed']).select('event_id').maybeSingle();
    if (!claimed) continue;

    const body = JSON.stringify({
      event_id: event.event_id,
      workspace_id: event.workspace_id,
      project_id: event.project_id,
      event_type: event.event_type,
      idempotency_key: event.idempotency_key,
      payload: event.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', signingSecret).update(`${timestamp}.${body}`).digest('hex');
    try {
      const response = await fetch(destination, {
        method: 'POST', body, signal: AbortSignal.timeout(15_000),
        headers: {
          'content-type': 'application/json',
          'x-project-hub-timestamp': timestamp,
          'x-project-hub-signature': signature,
          'x-idempotency-key': event.idempotency_key,
        },
      });
      if (!response.ok) throw new Error(`lia_http_${response.status}`);
      await supabase.from('integration_outbox').update({
        state: 'delivered', delivered_at: new Date().toISOString(), last_error: null,
        attempt_count: event.attempt_count + 1, updated_at: new Date().toISOString(),
      }).eq('event_id', event.event_id);
      delivered += 1;
    } catch (deliveryError) {
      const attempts = event.attempt_count + 1;
      const nextAttempt = new Date(Date.now() + Math.min(2 ** attempts * 30_000, 60 * 60_000));
      await supabase.from('integration_outbox').update({
        state: 'failed', attempt_count: attempts, next_attempt_at: nextAttempt.toISOString(),
        last_error: deliveryError instanceof Error ? deliveryError.message.slice(0, 500) : 'delivery_failed',
        updated_at: new Date().toISOString(),
      }).eq('event_id', event.event_id);
      failed += 1;
    }
  }
  return { scanned: data?.length || 0, delivered, failed };
}
