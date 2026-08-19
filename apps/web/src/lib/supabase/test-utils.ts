/**
 * Fake mínimo de un cliente Supabase para tests de route handlers, reutilizable
 * en cualquier archivo que mockee `@/lib/supabase/server`. Soporta las cadenas
 * que usan las rutas de auth: `.select/.insert/.update` combinado con `.eq`,
 * terminado opcionalmente en `.single()`, o awaited directamente (el builder
 * es "thenable" en cualquier punto, igual que el cliente real de supabase-js).
 *
 * No reimplementa PostgREST — solo lo necesario para simular respuestas
 * configurables por tabla en tests de route handlers.
 */

export type FakeRow = Record<string, unknown>;

interface QueuedResponse {
  data: unknown;
  error: unknown;
  count?: number | null;
}

/** El "verbo" que determina la naturaleza de la operación: qué se llamó
 * primero en la cadena (select/insert/update), independientemente de si
 * termina en `.single()` o se hace `await` directo sobre el builder. */
type Verb = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

class FakeQueryBuilder implements PromiseLike<QueuedResponse> {
  private verb: Verb | null = null;
  private settled = false;

  constructor(
    private readonly response: QueuedResponse,
    private readonly onSettled: (call: { table: string; method: Verb; args: unknown[] }) => void,
    private readonly table: string
  ) {}

  private recordVerb(verb: Verb, args: unknown[]) {
    // Solo el primer verbo de la cadena define la operación (select/insert/update);
    // .eq/.order/.single son modificadores, no operaciones nuevas.
    if (!this.verb) this.verb = verb;
    if (!this.settled) {
      this.settled = true;
      this.onSettled({ table: this.table, method: verb, args });
    }
    return this;
  }

  select(...args: unknown[]) {
    return this.recordVerb('select', args);
  }
  insert(...args: unknown[]) {
    return this.recordVerb('insert', args);
  }
  update(...args: unknown[]) {
    return this.recordVerb('update', args);
  }
  delete(...args: unknown[]) {
    return this.recordVerb('delete', args);
  }
  upsert(...args: unknown[]) {
    return this.recordVerb('upsert', args);
  }
  eq(..._args: unknown[]) {
    return this;
  }
  in(..._args: unknown[]) {
    return this;
  }
  or(..._args: unknown[]) {
    return this;
  }
  order(..._args: unknown[]) {
    return this;
  }
  range(..._args: unknown[]) {
    return this;
  }
  limit(..._args: unknown[]) {
    return this;
  }
  neq(..._args: unknown[]) {
    return this;
  }
  gte(..._args: unknown[]) {
    return this;
  }
  gt(..._args: unknown[]) {
    return this;
  }
  lt(..._args: unknown[]) {
    return this;
  }
  lte(..._args: unknown[]) {
    return this;
  }
  is(..._args: unknown[]) {
    return this;
  }
  single() {
    return this;
  }
  maybeSingle() {
    return this;
  }

  then<TResult1 = QueuedResponse, TResult2 = never>(
    onfulfilled?: ((value: QueuedResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

/**
 * Crea un `supabaseAdmin` fake que devuelve, para cada tabla, la siguiente
 * respuesta encolada por `.from(table)` (en orden de llamada). Configura las
 * respuestas por tabla con arrays: la primera llamada a `.from('x')` consume
 * `responses.x[0]`, la segunda `responses.x[1]`, etc. Si se acaban las
 * respuestas encoladas, devuelve `{ data: null, error: null }`.
 */
export function createFakeSupabaseAdmin(
  responses: Record<string, Partial<QueuedResponse>[]>,
  rpcResponses: Record<string, Partial<QueuedResponse>[]> = {}
) {
  const cursors: Record<string, number> = {};
  const rpcCursors: Record<string, number> = {};
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const rpcCalls: { fn: string; args: unknown }[] = [];

  const from = (table: string) => {
    const queue = responses[table] || [];
    const index = cursors[table] || 0;
    cursors[table] = index + 1;
    const queued = queue[index] || { data: null, error: null };

    return new FakeQueryBuilder(
      { data: queued.data ?? null, error: queued.error ?? null, count: queued.count ?? null },
      (call) => calls.push(call),
      table
    );
  };

  const rpc = (fn: string, args: unknown) => {
    rpcCalls.push({ fn, args });
    const queue = rpcResponses[fn] || [];
    const index = rpcCursors[fn] || 0;
    rpcCursors[fn] = index + 1;
    const queued = queue[index] || { data: null, error: null };
    return Promise.resolve({ data: queued.data ?? null, error: queued.error ?? null });
  };

  return {
    from,
    rpc,
    calls,
    rpcCalls,
  };
}
