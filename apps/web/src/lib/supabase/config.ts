/**
 * Configuración centralizada de todas las instancias Supabase
 * Cada proyecto tiene su propia URL y ANON_KEY
 * 
 * Convención: NEXT_PUBLIC_{SERVICIO}_SUPABASE_{URL|ANON_KEY}
 */

// ── Project Hub (Project Management - BD principal del Project Hub) ──
export const IRIS_SUPABASE = {
  URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
};

// ── SOFIA (Autenticación principal + organizaciones/equipos) ──
export const SOFIA_SUPABASE = {
  URL: process.env.NEXT_PUBLIC_SOFIA_SUPABASE_URL || '',
  ANON_KEY: process.env.NEXT_PUBLIC_SOFIA_SUPABASE_ANON_KEY || '',
};

// ── Content Generator / CourseGen (Contenido generado) ──
export const CONTENT_GEN_SUPABASE = {
  URL: process.env.NEXT_PUBLIC_CONTENT_GEN_SUPABASE_URL || '',
  ANON_KEY: process.env.NEXT_PUBLIC_CONTENT_GEN_SUPABASE_ANON_KEY || '',
};

/**
 * Helper para validar si una URL es válida
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper para verificar si un servicio está configurado
 */
export function isServiceConfigured(service: { URL: string; ANON_KEY: string }): boolean {
  return service.URL !== '' && service.ANON_KEY !== '' && isValidUrl(service.URL);
}
