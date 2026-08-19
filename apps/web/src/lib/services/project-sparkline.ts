/**
 * Agrupación de historial de progreso por proyecto y generación de puntos
 * sintéticos cuando no hay historial. Separado de
 * `app/api/admin/projects/route.ts` para poder probarlo sin mockear Supabase
 * y para que la query batched (`.in('project_id', ids)`) no tenga que
 * repetirse por cada proyecto (evita el N+1 que tenía antes esa ruta).
 */

export interface ProgressHistoryRow {
  project_id: string;
  completion_percentage: number;
  recorded_at: string;
}

/**
 * Agrupa filas de historial (ya ordenadas por `recorded_at` ascendente) por
 * `project_id`, tomando como máximo `maxPointsPerProject` filas por proyecto
 * — igual que hacía el `.limit(12)` por-proyecto de la query original.
 */
export function groupHistoryByProject(
  rows: ProgressHistoryRow[],
  maxPointsPerProject = 12
): Map<string, ProgressHistoryRow[]> {
  const byProject = new Map<string, ProgressHistoryRow[]>();

  for (const row of rows) {
    const existing = byProject.get(row.project_id) || [];
    if (existing.length < maxPointsPerProject) {
      existing.push(row);
      byProject.set(row.project_id, existing);
    }
  }

  return byProject;
}

/**
 * Genera puntos sintéticos de sparkline cuando un proyecto no tiene
 * historial de progreso real todavía. No determinista (usa Math.random para
 * simular variación); el único invariante garantizado es que el último punto
 * coincide con el progreso actual.
 */
export function generateSparklineData(progress: number): { value: number }[] {
  const points: { value: number }[] = [];
  let current = 0;

  for (let i = 0; i < 12; i++) {
    current = Math.min(100, current + Math.random() * (progress / 6));
    points.push({ value: Math.round(current) });
  }

  if (points.length > 0) {
    points[points.length - 1].value = progress;
  }

  return points;
}
