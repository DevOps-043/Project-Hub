/**
 * Índice central de clientes Supabase
 *
 * Exporta todos los clientes y helpers para uso en la aplicación.
 *
 * Arquitectura:
 * ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 * │  PHub Supa   │ │  SOFIA Supa  │ │ ContentGen   │
 * │  (server.ts) │ │  (sofia-*)   │ │ (content-*)  │
 * │              │ │              │ │              │
 * │ • projects   │ │ • auth       │ │ • cursos     │
 * │ • issues     │ │ • users      │ │ • contenido  │
 * │ • teams      │ │ • orgs       │ │              │
 * │ • sessions   │ │ • teams      │ │              │
 * └──────────────┘ └──────────────┘ └──────────────┘
 */

// Configuración centralizada
export {
  IRIS_SUPABASE,
  SOFIA_SUPABASE,
  CONTENT_GEN_SUPABASE,
  isValidUrl,
  isServiceConfigured,
} from './config';

// Project Hub (servidor / Project Hub principal)
export { getSupabaseAdmin, supabaseAdmin } from './server';
export type { AccountUser, AuthSession } from './server';

// SOFIA (autenticación principal)
export {
  getSofiaClient,
  getSofiaAdmin,
  isSofiaConfigured,
  sofiaSupa
} from './sofia-client';
export type { SofiaUser, SofiaOrganization, SofiaOrganizationUser } from './sofia-client';

// Content Generator / CourseGen
export {
  getContentGenClient,
  isContentGenConfigured,
  contentGenSupa
} from './content-gen-client';
