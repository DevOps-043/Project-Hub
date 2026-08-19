/**
 * Mapea `account_users.permission_level` al rol simple que consume el
 * frontend. Vivía duplicado, byte a byte, en `app/api/auth/login/route.ts`
 * y `app/api/auth/me/route.ts` — un cambio en el mapeo de roles fácilmente
 * se aplicaba en un lugar y se olvidaba en el otro.
 */
export function mapPermissionToRole(level: string): 'admin' | 'user' | 'guest' {
  switch (level) {
    case 'super_admin':
    case 'admin':
      return 'admin';
    case 'manager':
    case 'user':
      return 'user';
    default:
      return 'guest';
  }
}
