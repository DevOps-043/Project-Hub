import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function correlationId(request: NextRequest): string {
  const supplied = request.headers.get('x-correlation-id');
  return supplied && /^[0-9a-f-]{36}$/i.test(supplied) ? supplied : crypto.randomUUID();
}

export function ok<T>(request: NextRequest, data: T, init?: ResponseInit, meta?: Record<string, unknown>) {
  const id = correlationId(request);
  return NextResponse.json(
    { data, ...(meta ? { meta: { ...meta, correlation_id: id } } : { meta: { correlation_id: id } }) },
    { ...init, headers: { ...init?.headers, 'x-correlation-id': id } },
  );
}

export function fail(request: NextRequest, error: unknown): NextResponse {
  const id = correlationId(request);
  const normalized = error instanceof ApiError
    ? error
    : error instanceof ZodError
      ? new ApiError(400, 'VALIDATION_ERROR', 'Solicitud inválida', error.issues)
      : new ApiError(500, 'INTERNAL_ERROR', 'Error interno');

  if (normalized.status >= 500) console.error('[API v1]', id, error);
  return NextResponse.json(
    {
      data: null,
      meta: { correlation_id: id },
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
      } satisfies ApiErrorBody,
    },
    { status: normalized.status, headers: { 'x-correlation-id': id } },
  );
}

export async function jsonBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'El cuerpo debe ser JSON válido');
  }
  return schema.parse(body);
}

type RateEntry = { count: number; resetAt: number };
const rateStore = new Map<string, RateEntry>();

/** Límite defensivo por proceso. El límite distribuido se configura en edge/proxy. */
export function enforceRateLimit(request: NextRequest, actor: string, limit = 120, windowMs = 60_000): void {
  const key = `${actor}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const current = rateStore.get(key);
  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas solicitudes');
  if (rateStore.size > 10_000) {
    for (const [storedKey, entry] of rateStore) if (entry.resetAt <= now) rateStore.delete(storedKey);
  }
}

export function encodeCursor(value: { updated_at: string; id: string }): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor(value: string | null): { updated_at: string; id: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.updated_at !== 'string' || typeof parsed.id !== 'string') throw new Error();
    return { updated_at: parsed.updated_at, id: parsed.id };
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'Cursor inválido');
  }
}

