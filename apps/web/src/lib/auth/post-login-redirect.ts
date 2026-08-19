/**
 * Decide a donde navegar despues de un login exitoso (password o SSO).
 *
 * Funcion pura (sin dependencias de React ni del navegador) para que la
 * use tanto el cliente (`app/auth/sign-in/page.tsx`, tras el login por
 * password) como el servidor (`app/api/auth/callback/learning/route.ts`,
 * que ya conoce `workspaces` porque acaba de correr el mismo pipeline de
 * sincronizacion). Mismo arbol de decision en ambos casos.
 */

export interface PostLoginRedirectInput {
  workspaces: { slug: string }[];
  role?: string;
  permissionLevel?: string;
  returnUrl?: string | null;
}

export function resolvePostLoginDestination({
  workspaces,
  role,
  permissionLevel,
  returnUrl,
}: PostLoginRedirectInput): string {
  if (returnUrl && !returnUrl.startsWith('/auth')) {
    return returnUrl;
  }

  if (workspaces.length === 1) {
    return `/${workspaces[0].slug}/dashboard`;
  }

  if (workspaces.length > 1) {
    return '/select-organization';
  }

  if (role === 'admin' || permissionLevel === 'super_admin') {
    return '/admin';
  }

  return '/select-organization';
}
