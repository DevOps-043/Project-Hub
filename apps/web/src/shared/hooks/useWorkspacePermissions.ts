'use client';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { hasMinRole, type WorkspaceRole, type WorkspacePermissions } from '@/lib/permissions';

/**
 * Hook para acceder a los permisos del usuario en el workspace actual
 *
 * Uso:
 *   const { canManageMembers, canManageProjects, checkMinRole } = useWorkspacePermissions();
 */
export function useWorkspacePermissions() {
  const { userRole, permissions } = useWorkspace();

  return {
    ...permissions,
    userRole,
    checkMinRole: (minRole: WorkspaceRole) => hasMinRole(userRole, minRole),
    hasPermission: (key: keyof WorkspacePermissions) => permissions[key],
  };
}
