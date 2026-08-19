/**
 * Escapa un término de búsqueda antes de interpolarlo en un filtro `.or()`
 * de PostgREST (Supabase). Sin esto, comas y paréntesis en el input del
 * usuario alteran la estructura del filtro (permiten inyectar condiciones
 * no previstas), y `%`/`_` sin escapar alteran el patrón `ilike` más allá
 * de lo que el usuario buscó.
 */
export function sanitizeSearchTerm(value: string, maxLength = 100): string {
  return value
    .slice(0, maxLength)
    .replace(/[,()]/g, '')
    .replace(/[%_]/g, '\\$&');
}

/**
 * Escapa un identificador (slug, nombre o clave) antes de interpolarlo en un
 * filtro `.or()` de PostgREST usado con `.eq.` (no `.ilike.`), por ejemplo
 * `slug.eq.${id},name.eq.${id}` al resolver un team/proyecto por slug-o-nombre.
 *
 * A diferencia de `sanitizeSearchTerm`, esta función NO escapa `%`/`_`: esos
 * caracteres no son comodines para `.eq.`, así que escaparlos rompería una
 * coincidencia exacta legítima (p. ej. un nombre de equipo con un guión bajo).
 * Solo remueve `,`/`(`/`)`, que son los que alteran la estructura del filtro.
 */
export function sanitizeFilterIdentifier(value: string, maxLength = 100): string {
  return value.slice(0, maxLength).replace(/[,()]/g, '');
}
