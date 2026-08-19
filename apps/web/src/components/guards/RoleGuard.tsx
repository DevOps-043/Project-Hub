'use client';

import { ReactNode } from 'react';
import { useWorkspace, WorkspaceRole } from '@/contexts/WorkspaceContext';
import { hasMinRole, hasPermission, WorkspacePermissions } from '@/lib/permissions';

interface RoleGuardProps {
  children: ReactNode;
  /** Rol mínimo requerido */
  minRole?: WorkspaceRole;
  /** Permiso específico requerido */
  permission?: keyof WorkspacePermissions;
  /** Componente a mostrar si no tiene acceso (por defecto nada) */
  fallback?: ReactNode;
}

/**
 * Guard que muestra/oculta contenido según el rol del usuario en el workspace.
 *
 * Uso:
 *   <RoleGuard minRole="manager">
 *     <SettingsButton />
 *   </RoleGuard>
 *
 *   <RoleGuard permission="manageMembers">
 *     <InviteMemberButton />
 *   </RoleGuard>
 */
export function RoleGuard({ children, minRole, permission, fallback = null }: RoleGuardProps) {
  const { userRole } = useWorkspace();

  if (minRole && !hasMinRole(userRole, minRole)) {
    return <>{fallback}</>;
  }

  if (permission && !hasPermission(userRole, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
