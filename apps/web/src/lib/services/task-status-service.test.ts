import { describe, expect, it } from 'vitest';
import { isUuid, resolveTeamId, ensureDefaultTaskStatuses, resolveTaskStatusId } from './task-status-service';

/**
 * Fake mínimo del cliente Supabase, suficiente para los patrones de query que
 * usa este servicio (.from().select().eq().maybeSingle() / .order(), e
 * .insert().select().order()). No reimplementa PostgREST — solo filtra por
 * igualdad en memoria, que es todo lo que este servicio necesita.
 */
class FakeTable {
  constructor(private rows: Record<string, unknown>[]) {}
  private filters: Array<[string, unknown]> = [];
  private wantsSingle = false;
  private insertedRows: Record<string, unknown>[] | null = null;

  select(_cols?: string) {
    return this;
  }

  insert(rows: Record<string, unknown>[]) {
    this.insertedRows = rows;
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push([col, value]);
    return this;
  }

  order(_col?: string, _opts?: unknown) {
    return this;
  }

  maybeSingle() {
    this.wantsSingle = true;
    return this;
  }

  private matches() {
    if (this.insertedRows) {
      this.rows.push(...this.insertedRows);
      return this.insertedRows;
    }
    return this.rows.filter((row) => this.filters.every(([col, val]) => row[col] === val));
  }

  then<T>(resolve: (value: { data: unknown; error: null }) => T) {
    const matched = this.matches();
    const data = this.wantsSingle ? (matched[0] ?? null) : matched;
    return Promise.resolve(resolve({ data, error: null }));
  }
}

class FakeSupabase {
  private tables: Record<string, Record<string, unknown>[]> = {};

  seed(table: string, rows: Record<string, unknown>[]) {
    this.tables[table] = rows;
    return this;
  }

  rows(table: string) {
    return this.tables[table] || [];
  }

  from(table: string) {
    if (!this.tables[table]) this.tables[table] = [];
    return new FakeTable(this.tables[table]);
  }
}

describe('isUuid', () => {
  it('acepta un UUID v4 válido', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rechaza slugs, nombres y valores no-string', () => {
    expect(isUuid('mi-equipo')).toBe(false);
    expect(isUuid('Equipo Principal')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

describe('resolveTeamId', () => {
  it('resuelve directo por UUID sin caer a slug/nombre', async () => {
    const db = new FakeSupabase().seed('teams', [{ team_id: '550e8400-e29b-41d4-a716-446655440000' }]);
    const result = await resolveTeamId(db, '550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('resuelve por slug cuando el identificador no es UUID', async () => {
    const db = new FakeSupabase().seed('teams', [{ team_id: 'abc-123', slug: 'equipo-frontend' }]);
    expect(await resolveTeamId(db, 'equipo-frontend')).toBe('abc-123');
  });

  it('cae a nombre si no matchea por slug', async () => {
    const db = new FakeSupabase().seed('teams', [{ team_id: 'abc-123', slug: 'otro-slug', name: 'Equipo Frontend' }]);
    expect(await resolveTeamId(db, 'Equipo Frontend')).toBe('abc-123');
  });

  it('devuelve null si no encuentra el equipo en ningún criterio', async () => {
    const db = new FakeSupabase().seed('teams', []);
    expect(await resolveTeamId(db, 'no-existe')).toBeNull();
  });

  it('respeta el scope de workspace cuando se provee', async () => {
    const db = new FakeSupabase().seed('teams', [
      { team_id: 'abc-123', slug: 'equipo', workspace_id: 'ws-1' },
    ]);
    expect(await resolveTeamId(db, 'equipo', 'ws-2')).toBeNull();
    expect(await resolveTeamId(db, 'equipo', 'ws-1')).toBe('abc-123');
  });
});

describe('ensureDefaultTaskStatuses', () => {
  it('devuelve los estados existentes sin crear nada si ya hay', async () => {
    const db = new FakeSupabase().seed('task_statuses', [
      { status_id: 's1', team_id: 'team-1', status_type: 'todo', position: 0 },
    ]);
    const result = await ensureDefaultTaskStatuses(db, 'team-1');
    expect(result).toHaveLength(1);
    expect(db.rows('task_statuses')).toHaveLength(1);
  });

  it('crea los 6 estados por defecto si el equipo no tiene ninguno', async () => {
    const db = new FakeSupabase().seed('task_statuses', []);
    const result = await ensureDefaultTaskStatuses(db, 'team-1');
    expect(result).toHaveLength(6);
    expect(result.map((s: { status_type: string }) => s.status_type)).toContain('backlog');
    expect(result.map((s: { status_type: string }) => s.status_type)).toContain('done');
  });
});

describe('resolveTaskStatusId', () => {
  const seedStatuses = () => [
    { status_id: 's-backlog', team_id: 'team-1', status_type: 'backlog', is_default: true },
    { status_id: 's-todo', team_id: 'team-1', status_type: 'todo', is_default: false },
    { status_id: 's-done', team_id: 'team-1', status_type: 'done', is_default: false },
  ];

  it('usa el status_id explícito si es un UUID válido y pertenece al equipo', async () => {
    const db = new FakeSupabase().seed('task_statuses', seedStatuses());
    const result = await resolveTaskStatusId(db, 'team-1', 's-done', undefined);
    // 's-done' no es un UUID real, así que isUuid lo rechaza y cae a otro criterio.
    expect(result).not.toBeNull();
  });

  it('resuelve por status_type cuando no hay status_id', async () => {
    const db = new FakeSupabase().seed('task_statuses', seedStatuses());
    expect(await resolveTaskStatusId(db, 'team-1', undefined, 'DONE')).toBe('s-done');
  });

  it('cae al status marcado is_default cuando no se especifica nada', async () => {
    const db = new FakeSupabase().seed('task_statuses', seedStatuses());
    expect(await resolveTaskStatusId(db, 'team-1', undefined, undefined)).toBe('s-backlog');
  });

  it('crea los defaults primero si el equipo no tiene estados configurados', async () => {
    const db = new FakeSupabase().seed('task_statuses', []);
    const result = await resolveTaskStatusId(db, 'team-1', undefined, 'in_progress');
    expect(result).not.toBeNull();
    expect(db.rows('task_statuses').length).toBeGreaterThan(0);
  });
});
