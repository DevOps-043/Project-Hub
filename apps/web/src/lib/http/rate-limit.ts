/**
 * Rate limiter en memoria, ventana fija por clave.
 *
 * Limitación conocida: el estado vive en memoria del proceso/isolate, así que
 * en un despliegue con varias instancias o edge regions cada una lleva su
 * propio conteo (no es un límite global estricto). No hay Redis/Upstash
 * configurado en este proyecto y añadir esa dependencia es una decisión de
 * infraestructura que excede un fix de deuda técnica — este limiter sigue
 * siendo una mejora real frente al estado anterior (cero throttling) para
 * los endpoints sin autenticación (login, register), que es el vector que
 * importa: un atacante de un solo origen ya no puede probar credenciales o
 * crear cuentas sin límite.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Evita que el Map crezca sin límite si muchas IPs distintas pegan al mismo
// endpoint; se poda de forma perezosa en vez de con un timer en background.
const MAX_TRACKED_KEYS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_TRACKED_KEYS) {
      pruneExpired(now);
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/** Solo para tests: resetea todo el estado del limiter entre casos. */
export function __resetRateLimitStateForTests(): void {
  buckets.clear();
}
