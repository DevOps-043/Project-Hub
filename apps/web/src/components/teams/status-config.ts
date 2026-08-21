/**
 * Semántica de color de estado compartida (SOFIA_DESIGN_SYSTEM.md §4.5):
 * bloqueado/cancelado = gris, no iniciado/planificación = gris claro,
 * en progreso = accent, completado = success, advertencia = warning,
 * error/off-track = error. Antes TeamProjectsContent y TeamCyclesContent
 * traían cada uno su propio mapa de hex distintos para los mismos estados.
 */

export const PROJECT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planificación', color: '#9CA3AF' },
  active: { label: 'Activo', color: 'var(--color-accent)' },
  on_hold: { label: 'En pausa', color: 'var(--color-warning)' },
  completed: { label: 'Completado', color: 'var(--color-success)' },
  cancelled: { label: 'Cancelado', color: '#6B7280' },
};

export const PROJECT_HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  on_track: { label: 'En curso', color: 'var(--color-success)' },
  at_risk: { label: 'En riesgo', color: 'var(--color-warning)' },
  off_track: { label: 'Fuera de curso', color: 'var(--color-error)' },
  none: { label: 'Sin evaluar', color: '#9CA3AF' },
};

export const CYCLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Próximo', color: '#9CA3AF' },
  active: { label: 'Activo', color: 'var(--color-accent)' },
  completed: { label: 'Completado', color: 'var(--color-success)' },
  cancelled: { label: 'Cancelado', color: '#6B7280' },
};

/** Fondo suave de un color semántico (acepta hex u otro `color-mix` como var(--color-accent)). */
export function softBg(color: string, percent = 15): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
