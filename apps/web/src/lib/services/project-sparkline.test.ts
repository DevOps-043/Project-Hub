import { describe, expect, it } from 'vitest';
import { generateSparklineData, groupHistoryByProject } from './project-sparkline';

describe('groupHistoryByProject', () => {
  it('groups rows by project_id', () => {
    const rows = [
      { project_id: 'p1', completion_percentage: 10, recorded_at: '2026-01-01' },
      { project_id: 'p2', completion_percentage: 20, recorded_at: '2026-01-01' },
      { project_id: 'p1', completion_percentage: 15, recorded_at: '2026-01-02' },
    ];

    const grouped = groupHistoryByProject(rows);

    expect(grouped.get('p1')).toHaveLength(2);
    expect(grouped.get('p2')).toHaveLength(1);
  });

  // Regression guard for the N+1 fix: the old per-project query capped each
  // project at 12 rows via `.limit(12)`; the batched query has no per-group
  // limit, so the grouping function must enforce the same cap in memory.
  it('caps each project at maxPointsPerProject, keeping the first rows encountered', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      project_id: 'p1',
      completion_percentage: i,
      recorded_at: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }));

    const grouped = groupHistoryByProject(rows, 12);

    expect(grouped.get('p1')).toHaveLength(12);
    expect(grouped.get('p1')?.[0].completion_percentage).toBe(0);
    expect(grouped.get('p1')?.[11].completion_percentage).toBe(11);
  });

  it('returns an empty map for no rows', () => {
    expect(groupHistoryByProject([]).size).toBe(0);
  });

  it('does not mix rows from different projects into the same bucket', () => {
    const rows = [
      { project_id: 'p1', completion_percentage: 50, recorded_at: '2026-01-01' },
      { project_id: 'p2', completion_percentage: 90, recorded_at: '2026-01-01' },
    ];

    const grouped = groupHistoryByProject(rows);
    expect(grouped.get('p1')).toEqual([rows[0]]);
    expect(grouped.get('p2')).toEqual([rows[1]]);
  });
});

describe('generateSparklineData', () => {
  it('always returns exactly 12 points', () => {
    expect(generateSparklineData(50)).toHaveLength(12);
  });

  it('ends on the current progress value regardless of the random walk', () => {
    for (let i = 0; i < 20; i++) {
      const points = generateSparklineData(73);
      expect(points[points.length - 1].value).toBe(73);
    }
  });

  it('never produces a value above 100 even for a 0 progress input', () => {
    const points = generateSparklineData(0);
    for (const point of points) {
      expect(point.value).toBeGreaterThanOrEqual(0);
      expect(point.value).toBeLessThanOrEqual(100);
    }
  });
});
