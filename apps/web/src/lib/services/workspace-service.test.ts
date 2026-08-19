import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fake mínimo de un cliente Supabase, suficiente para las cadenas de query
 * que usa workspace-service.ts: .select/.insert/.update/.upsert combinado
 * con .eq/.in/.or, y .single()/.maybeSingle(). No reimplementa PostgREST —
 * solo lo necesario para simular las decisiones de sincronización en memoria.
 *
 * Definidas dentro de vi.hoisted() porque los factories de vi.mock() más
 * abajo se izan por encima de cualquier declaración de clase del módulo;
 * fuera de aquí, FakeSupabaseImpl no existiría todavía cuando el factory se
 * ejecuta.
 */
const fakeDbs = vi.hoisted(() => {
  class FakeTable {
    constructor(private rows: Record<string, unknown>[]) {}
    private filters: Array<['eq', string, unknown] | ['in', string, unknown[]]> = [];
    private orFilter: string | null = null;
    private wantsSingle = false;
    private wantsMaybeSingle = false;
    private pendingInsert: Record<string, unknown>[] | null = null;
    private pendingUpdate: Record<string, unknown> | null = null;
    private pendingUpsert: {
      rows: Record<string, unknown>[];
      onConflict?: string;
      ignoreDuplicates?: boolean;
    } | null = null;

    select(_cols?: string) {
      return this;
    }
    insert(rows: Record<string, unknown>[] | Record<string, unknown>) {
      this.pendingInsert = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(values: Record<string, unknown>) {
      this.pendingUpdate = values;
      return this;
    }
    upsert(
      rows: Record<string, unknown>[] | Record<string, unknown>,
      opts?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) {
      this.pendingUpsert = {
        rows: Array.isArray(rows) ? rows : [rows],
        onConflict: opts?.onConflict,
        ignoreDuplicates: opts?.ignoreDuplicates,
      };
      return this;
    }
    eq(col: string, value: unknown) {
      this.filters.push(['eq', col, value]);
      return this;
    }
    in(col: string, values: unknown[]) {
      this.filters.push(['in', col, values]);
      return this;
    }
    or(filterString: string) {
      this.orFilter = filterString;
      return this;
    }
    order() {
      return this;
    }
    range() {
      return this;
    }
    maybeSingle() {
      this.wantsMaybeSingle = true;
      return this;
    }
    single() {
      this.wantsSingle = true;
      return this;
    }

    private matchesFilters(row: Record<string, unknown>): boolean {
      for (const filter of this.filters) {
        if (filter[0] === 'eq' && row[filter[1]] !== filter[2]) return false;
        if (filter[0] === 'in' && !filter[2].includes(row[filter[1]])) return false;
      }
      if (this.orFilter) {
        const conditions = [...this.orFilter.matchAll(/(\w+)\.in\.\(([^)]*)\)/g)];
        if (conditions.length === 0) return false;
        const matchesAny = conditions.some(([, field, valuesStr]) => {
          const values = valuesStr.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          return values.includes(String(row[field]));
        });
        if (!matchesAny) return false;
      }
      return true;
    }

    then<T>(resolve: (value: { data: unknown; error: { message: string } | null; count: number | null }) => T) {
      let affected: Record<string, unknown>[];

      if (this.pendingInsert) {
        this.rows.push(...this.pendingInsert);
        affected = this.pendingInsert;
      } else if (this.pendingUpdate) {
        affected = this.rows.filter((row) => this.matchesFilters(row));
        affected.forEach((row) => Object.assign(row, this.pendingUpdate));
      } else if (this.pendingUpsert) {
        const { rows: upsertRows, onConflict, ignoreDuplicates } = this.pendingUpsert;
        const keys = (onConflict || '').split(',').map((s) => s.trim()).filter(Boolean);
        affected = [];
        for (const newRow of upsertRows) {
          const existingIndex = keys.length
            ? this.rows.findIndex((row) => keys.every((key) => row[key] === newRow[key]))
            : -1;
          if (existingIndex >= 0) {
            if (!ignoreDuplicates) Object.assign(this.rows[existingIndex], newRow);
            affected.push(this.rows[existingIndex]);
          } else {
            const inserted = { ...newRow };
            this.rows.push(inserted);
            affected.push(inserted);
          }
        }
      } else {
        affected = this.rows.filter((row) => this.matchesFilters(row));
      }

      const data = this.wantsSingle || this.wantsMaybeSingle ? (affected[0] ?? null) : affected;
      const error = this.wantsSingle && !data ? { message: 'No rows found' } : null;
      return Promise.resolve(resolve({ data, error, count: affected.length }));
    }
  }

  class FakeSupabaseImpl {
    private tables: Record<string, Record<string, unknown>[]> = {};

    seed(table: string, rows: Record<string, unknown>[]) {
      this.tables[table] = rows;
      return this;
    }
    rows(table: string) {
      return this.tables[table] || [];
    }
    reset() {
      this.tables = {};
    }
    from(table: string) {
      if (!this.tables[table]) this.tables[table] = [];
      return new FakeTable(this.tables[table]);
    }
  }

  return {
    projectHub: new FakeSupabaseImpl(),
    sofia: new FakeSupabaseImpl(),
  };
});

vi.mock('../supabase/server', () => ({
  getSupabaseAdmin: () => fakeDbs.projectHub,
}));

vi.mock('../supabase/sofia-client', () => ({
  getSofiaAdmin: () => fakeDbs.sofia,
}));

const { syncAllOrgMembers, syncWorkspacesFromSofia } = await import('./workspace-service');
const sofiaClientModule = await import('../supabase/sofia-client');

beforeEach(() => {
  fakeDbs.projectHub.reset();
  fakeDbs.sofia.reset();
  vi.restoreAllMocks();
});

describe('syncAllOrgMembers', () => {
  const WORKSPACE_ID = 'ws-1';
  const SOFIA_ORG_ID = 'org-1';

  it('does nothing when SOFIA is not configured (getSofiaAdmin returns null)', async () => {
    vi.spyOn(sofiaClientModule, 'getSofiaAdmin').mockReturnValueOnce(null as never);

    await expect(syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID)).resolves.toBeUndefined();
    expect(fakeDbs.projectHub.rows('workspace_members')).toHaveLength(0);
  });

  it('inserts a brand-new SOFIA org member into account_users and workspace_members with a mapped role', async () => {
    fakeDbs.projectHub.seed('workspace_members', []);
    fakeDbs.sofia.seed('organization_users', [
      { user_id: 'sofia-user-1', role: 'admin', status: 'active', organization_id: SOFIA_ORG_ID },
    ]);
    fakeDbs.sofia.seed('users', [
      {
        id: 'sofia-user-1',
        first_name: 'Ana',
        last_name: 'Garcia Lopez',
        display_name: 'Ana Garcia',
        username: 'ana',
        email: 'ana@example.com',
        platform_role: 'Administrador',
        profile_picture_url: null,
        email_verified: true,
        is_banned: false,
        bio: null,
        location: null,
        phone: null,
      },
    ]);
    fakeDbs.projectHub.seed('account_users', []);

    await syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID);

    const accountRows = fakeDbs.projectHub.rows('account_users');
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0]).toMatchObject({
      user_id: 'sofia-user-1',
      email: 'ana@example.com',
      last_name_paternal: 'Garcia',
      last_name_maternal: 'Lopez',
      permission_level: 'admin', // mapped from platform_role 'Administrador'
    });

    const memberRows = fakeDbs.projectHub.rows('workspace_members');
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0]).toMatchObject({
      workspace_id: WORKSPACE_ID,
      user_id: 'sofia-user-1',
      sofia_role: 'admin',
      iris_role: 'admin', // mapSofiaRoleToIris('admin') -> 'admin'
      is_active: true,
    });
  });

  it('maps an unrecognized SOFIA org role to the least-privileged iris_role ("member")', async () => {
    fakeDbs.projectHub.seed('workspace_members', []);
    fakeDbs.sofia.seed('organization_users', [
      { user_id: 'sofia-user-2', role: 'billing_manager', status: 'active', organization_id: SOFIA_ORG_ID },
    ]);
    fakeDbs.sofia.seed('users', [
      {
        id: 'sofia-user-2', first_name: 'Bob', last_name: 'Lee', display_name: 'Bob Lee',
        username: 'bob', email: 'bob@example.com', platform_role: 'Usuario',
        profile_picture_url: null, email_verified: true, is_banned: false,
        bio: null, location: null, phone: null,
      },
    ]);
    fakeDbs.projectHub.seed('account_users', []);

    await syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID);

    const memberRows = fakeDbs.projectHub.rows('workspace_members');
    expect(memberRows[0].iris_role).toBe('member');
  });

  // Core documented guarantee (see the function's own doc comment): iris_role
  // is edited independently in Project Hub and must never be silently
  // overwritten by a sync, no matter what role SOFIA reports.
  it('never overwrites the iris_role of a member who already exists in workspace_members', async () => {
    fakeDbs.projectHub.seed('workspace_members', [
      {
        workspace_id: WORKSPACE_ID,
        user_id: 'sofia-user-3',
        sofia_role: 'member',
        iris_role: 'owner', // manually promoted in Project Hub, independent of SOFIA
        is_active: true,
      },
    ]);
    fakeDbs.sofia.seed('organization_users', [
      { user_id: 'sofia-user-3', role: 'member', status: 'active', organization_id: SOFIA_ORG_ID },
    ]);
    fakeDbs.sofia.seed('users', [
      {
        id: 'sofia-user-3', first_name: 'Cara', last_name: 'Diaz', display_name: 'Cara Diaz',
        username: 'cara', email: 'cara@example.com', platform_role: 'Usuario',
        profile_picture_url: null, email_verified: true, is_banned: false,
        bio: null, location: null, phone: null,
      },
    ]);
    fakeDbs.projectHub.seed('account_users', []);

    await syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID);

    const memberRows = fakeDbs.projectHub.rows('workspace_members');
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0].iris_role).toBe('owner'); // untouched
    // No new account_users row should be created for an existing member either.
    expect(fakeDbs.projectHub.rows('account_users')).toHaveLength(0);
  });

  it('deactivates a member who no longer belongs to the SOFIA org', async () => {
    fakeDbs.projectHub.seed('workspace_members', [
      { workspace_id: WORKSPACE_ID, user_id: 'sofia-user-4', sofia_role: 'member', iris_role: 'member', is_active: true },
    ]);
    // SOFIA no longer reports this user as an org member at all.
    fakeDbs.sofia.seed('organization_users', []);
    fakeDbs.sofia.seed('users', []);
    fakeDbs.projectHub.seed('account_users', []);

    await syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID);

    const memberRows = fakeDbs.projectHub.rows('workspace_members');
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0].is_active).toBe(false);
  });

  it('reactivates a previously-deactivated member who has returned to the SOFIA org', async () => {
    fakeDbs.projectHub.seed('workspace_members', [
      { workspace_id: WORKSPACE_ID, user_id: 'sofia-user-5', sofia_role: 'member', iris_role: 'member', is_active: false },
    ]);
    fakeDbs.sofia.seed('organization_users', [
      { user_id: 'sofia-user-5', role: 'member', status: 'active', organization_id: SOFIA_ORG_ID },
    ]);
    fakeDbs.sofia.seed('users', [
      {
        id: 'sofia-user-5', first_name: 'Dee', last_name: 'Evans', display_name: 'Dee Evans',
        username: 'dee', email: 'dee@example.com', platform_role: 'Usuario',
        profile_picture_url: null, email_verified: true, is_banned: false,
        bio: null, location: null, phone: null,
      },
    ]);
    fakeDbs.projectHub.seed('account_users', []);

    await syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID);

    const memberRows = fakeDbs.projectHub.rows('workspace_members');
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0].is_active).toBe(true);
  });

  it('ignores a SOFIA org member whose status is "removed"', async () => {
    fakeDbs.projectHub.seed('workspace_members', []);
    fakeDbs.sofia.seed('organization_users', [
      { user_id: 'sofia-user-6', role: 'member', status: 'removed', organization_id: SOFIA_ORG_ID },
    ]);
    fakeDbs.sofia.seed('users', [
      {
        id: 'sofia-user-6', first_name: 'Fay', last_name: 'Gomez', display_name: 'Fay Gomez',
        username: 'fay', email: 'fay@example.com', platform_role: 'Usuario',
        profile_picture_url: null, email_verified: true, is_banned: false,
        bio: null, location: null, phone: null,
      },
    ]);
    fakeDbs.projectHub.seed('account_users', []);

    await syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID);

    expect(fakeDbs.projectHub.rows('workspace_members')).toHaveLength(0);
    expect(fakeDbs.projectHub.rows('account_users')).toHaveLength(0);
  });

  it('reuses a pre-migration legacy account (matched by email) instead of inserting a duplicate', async () => {
    // A local account_users row that predates the SOFIA id-based accounts,
    // sharing the SOFIA user's email but keyed by a different local user_id.
    fakeDbs.projectHub.seed('account_users', [
      { user_id: 'legacy-local-id', email: 'gina@example.com', username: 'gina' },
    ]);
    fakeDbs.projectHub.seed('workspace_members', []);
    fakeDbs.sofia.seed('organization_users', [
      { user_id: 'sofia-user-7', role: 'member', status: 'active', organization_id: SOFIA_ORG_ID },
    ]);
    fakeDbs.sofia.seed('users', [
      {
        id: 'sofia-user-7', first_name: 'Gina', last_name: 'Hill', display_name: 'Gina Hill',
        username: 'gina', email: 'gina@example.com', platform_role: 'Usuario',
        profile_picture_url: null, email_verified: true, is_banned: false,
        bio: null, location: null, phone: null,
      },
    ]);

    await syncAllOrgMembers(WORKSPACE_ID, SOFIA_ORG_ID);

    // No second account_users row should be created for the SOFIA id.
    expect(fakeDbs.projectHub.rows('account_users')).toHaveLength(1);

    // The workspace membership must point at the pre-existing local id, not
    // the SOFIA id, so it lines up with the account that already owns data.
    const memberRows = fakeDbs.projectHub.rows('workspace_members');
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0].user_id).toBe('legacy-local-id');
  });
});

describe('syncWorkspacesFromSofia', () => {
  const IRIS_USER_ID = 'user-1';

  it('returns an empty array when there are no SOFIA orgs to sync', async () => {
    expect(await syncWorkspacesFromSofia(IRIS_USER_ID, [])).toEqual([]);
  });

  it('skips an org whose membership status is "removed"', async () => {
    fakeDbs.projectHub.seed('workspaces', []);
    const result = await syncWorkspacesFromSofia(IRIS_USER_ID, [
      {
        organization_id: 'org-1',
        role: 'admin',
        status: 'removed',
        organizations: { id: 'org-1', name: 'Acme', slug: 'acme' },
      },
    ]);
    expect(result).toEqual([]);
  });

  it('maps a brand-new membership role and preserves an existing one', async () => {
    fakeDbs.projectHub.seed('workspaces', [
      {
        workspace_id: 'ws-existing', sofia_org_id: 'org-existing', name: 'Old Name', slug: 'old-slug',
        description: null, logo_url: null, brand_color: '#3B82F6', is_active: true,
        settings: {}, created_at: '2024-01-01', updated_at: '2024-01-01',
      },
    ]);
    // This user already has a manually-promoted 'owner' role in the existing workspace.
    fakeDbs.projectHub.seed('workspace_members', [
      { workspace_id: 'ws-existing', user_id: IRIS_USER_ID, sofia_role: 'member', iris_role: 'owner' },
    ]);

    const result = await syncWorkspacesFromSofia(IRIS_USER_ID, [
      {
        organization_id: 'org-existing',
        role: 'member', // SOFIA still reports this user as a plain member
        status: 'active',
        organizations: { id: 'org-existing', name: 'New Name', slug: 'new-slug', brand_primary_color: '#111111' },
      },
    ]);

    expect(result).toHaveLength(1);
    // iris_role must stay 'owner' — never demoted by a SOFIA sync.
    expect(result[0].iris_role).toBe('owner');
    // The workspace row itself (name/slug/color) is still refreshed from SOFIA.
    expect(result[0].name).toBe('New Name');
    expect(result[0].brand_color).toBe('#111111');
  });

  it('inserts a new membership with the role mapped from SOFIA for a first-time workspace', async () => {
    fakeDbs.projectHub.seed('workspaces', [
      {
        workspace_id: 'ws-new', sofia_org_id: 'org-new', name: 'Brand New Org', slug: 'brand-new',
        description: null, logo_url: null, brand_color: '#3B82F6', is_active: true,
        settings: {}, created_at: '2024-01-01', updated_at: '2024-01-01',
      },
    ]);
    fakeDbs.projectHub.seed('workspace_members', []);

    const result = await syncWorkspacesFromSofia(IRIS_USER_ID, [
      {
        organization_id: 'org-new',
        role: 'owner',
        status: 'active',
        organizations: { id: 'org-new', name: 'Brand New Org', slug: 'brand-new' },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].iris_role).toBe('owner');

    const memberRows = fakeDbs.projectHub.rows('workspace_members');
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0]).toMatchObject({ user_id: IRIS_USER_ID, iris_role: 'owner', is_active: true });
  });
});
