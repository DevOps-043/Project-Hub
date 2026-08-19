const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El mismo regex de UUID v4-shape vivía copiado inline en 11 sitios (rutas
 * de admin/workspaces resolviendo un identificador de ruta como UUID-o-slug)
 * más una definición separada en `lib/services/task-status-service.ts`.
 * Centralizado acá para que un cambio de formato (o un bug) se corrija en
 * un solo lugar.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
