/**
 * Agregación de estadísticas de ciclos (scope/completado/progreso) a partir
 * de una lista ya cargada de issues. Separado del route handler para poder
 * probarlo sin mockear Supabase y para que la query batched (`.in('cycle_id', ids)`)
 * en `app/api/admin/teams/[teamId]/cycles/route.ts` no tenga que repetirse
 * por cada ciclo (evita el N+1 que tenía antes esa ruta).
 */

export interface CycleIssueForStats {
  cycle_id: string;
  completed_at: string | null;
}

export interface CycleStats {
  scope_count: number;
  completed_count: number;
  progress_percent: number;
}

export function computeCycleStats<T extends { cycle_id: string }>(
  cycles: T[],
  issues: CycleIssueForStats[]
): (T & CycleStats)[] {
  const countsByCycle = new Map<string, { total: number; completed: number }>();

  for (const issue of issues) {
    const entry = countsByCycle.get(issue.cycle_id) || { total: 0, completed: 0 };
    entry.total += 1;
    if (issue.completed_at !== null) entry.completed += 1;
    countsByCycle.set(issue.cycle_id, entry);
  }

  return cycles.map((cycle) => {
    const { total: scopeCount = 0, completed: completedCount = 0 } = countsByCycle.get(cycle.cycle_id) || {};
    const progressPercent = scopeCount > 0 ? Math.round((completedCount / scopeCount) * 100) : 0;

    return {
      ...cycle,
      scope_count: scopeCount,
      completed_count: completedCount,
      progress_percent: progressPercent,
    };
  });
}
