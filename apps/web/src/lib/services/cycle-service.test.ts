import { describe, expect, it } from 'vitest';
import { computeCycleStats } from './cycle-service';

describe('computeCycleStats', () => {
  it('counts total and completed issues per cycle', () => {
    const cycles = [{ cycle_id: 'c1' }, { cycle_id: 'c2' }];
    const issues = [
      { cycle_id: 'c1', completed_at: '2026-01-01' },
      { cycle_id: 'c1', completed_at: null },
      { cycle_id: 'c1', completed_at: '2026-01-02' },
      { cycle_id: 'c2', completed_at: null },
    ];

    const result = computeCycleStats(cycles, issues);

    expect(result).toEqual([
      { cycle_id: 'c1', scope_count: 3, completed_count: 2, progress_percent: 67 },
      { cycle_id: 'c2', scope_count: 1, completed_count: 0, progress_percent: 0 },
    ]);
  });

  it('gives a cycle with zero issues a scope of 0 and 0% progress, never NaN/division by zero', () => {
    const cycles = [{ cycle_id: 'empty' }];
    const result = computeCycleStats(cycles, []);

    expect(result[0].scope_count).toBe(0);
    expect(result[0].completed_count).toBe(0);
    expect(result[0].progress_percent).toBe(0);
  });

  it('treats 100% completion correctly', () => {
    const cycles = [{ cycle_id: 'done' }];
    const issues = [
      { cycle_id: 'done', completed_at: '2026-01-01' },
      { cycle_id: 'done', completed_at: '2026-01-02' },
    ];

    const result = computeCycleStats(cycles, issues);
    expect(result[0].progress_percent).toBe(100);
  });

  it('preserves the original cycle fields alongside the computed stats', () => {
    const cycles = [{ cycle_id: 'c1', name: 'Sprint 1', status: 'active' }];
    const result = computeCycleStats(cycles, []);

    expect(result[0].name).toBe('Sprint 1');
    expect(result[0].status).toBe('active');
  });

  // Regression guard for the N+1 fix: an issue belonging to a cycle_id that
  // isn't in the cycles list (e.g. a stale/orphaned row) must not crash or
  // leak into another cycle's count.
  it('ignores issues whose cycle_id does not match any cycle in the list', () => {
    const cycles = [{ cycle_id: 'c1' }];
    const issues = [{ cycle_id: 'orphan', completed_at: null }];

    const result = computeCycleStats(cycles, issues);
    expect(result[0].scope_count).toBe(0);
  });
});
