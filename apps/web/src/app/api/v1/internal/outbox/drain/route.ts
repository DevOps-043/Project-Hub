import { NextRequest } from 'next/server';
import { drainLiaOutbox, secureSecretEquals } from '@/lib/api-v1/outbox-delivery';
import { ApiError, fail, ok } from '@/lib/api-v1/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.PROJECT_HUB_OUTBOX_WORKER_KEY || '';
    if (!secureSecretEquals(request.headers.get('x-outbox-worker-key'), expected)) {
      throw new ApiError(401, 'OUTBOX_WORKER_UNAUTHORIZED', 'Worker no autorizado');
    }
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 25);
    const result = await drainLiaOutbox(Number.isFinite(rawLimit) ? rawLimit : 25);
    return ok(request, result);
  } catch (error) {
    return fail(request, error);
  }
}
