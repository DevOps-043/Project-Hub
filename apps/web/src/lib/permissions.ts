/**
 * Sistema de permisos por rol para workspaces de Project Hub
 *
 * Roles de Project Hub (de mayor a menor privilegio):
 * - owner:   Propietario del workspace (mapeado desde SOFIA owner)
 * - admin:   Administrador (mapeado desde SOFIA admin)
 * - manager: Gerente (rol extendido de Project Hub, se asigna manualmente)
 * - leader:  Líder de equipo (rol extendido de Project Hub)
 * - member:  Miembro regular (mapeado desde SOFIA member)
 */

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'leader' | 'member';

export interface WorkspacePermissions {
  manageWorkspace: boolean;
  manageMembers: boolean;
  manageRoles: boolean;
  manageProjects: boolean;
  manageTeams: boolean;
  viewAnalytics: boolean;
}

export const ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermissions> = {
  owner:   { manageWorkspace: true,  manageMembers: true,  manageRoles: true,  manageProjects: true,  manageTeams: true,  viewAnalytics: true  },
  admin:   { manageWorkspace: false, manageMembers: true,  manageRoles: true,  manageProjects: true,  manageTeams: true,  viewAnalytics: true  },
  manager: { manageWorkspace: false, manageMembers: true,  manageRoles: false, manageProjects: true,  manageTeams: true,  viewAnalytics: true  },
  leader:  { manageWorkspace: false, manageMembers: false, manageRoles: false, manageProjects: true,  manageTeams: false, viewAnalytics: false },
  member:  { manageWorkspace: false, manageMembers: false, manageRoles: false, manageProjects: false, manageTeams: false, viewAnalytics: false },
};

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  leader: 2,
  member: 1,
};

/**
 * Verifica si un rol tiene un nivel mínimo requerido
 */
export function hasMinRole(currentRole: WorkspaceRole, minRole: WorkspaceRole): boolean {
  return (ROLE_HIERARCHY[currentRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

/**
 * Obtiene los permisos para un rol
 */
export function getPermissions(role: WorkspaceRole): WorkspacePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member;
}

/**
 * Verifica un permiso específico para un rol
 */
export function hasPermission(role: WorkspaceRole, permission: keyof WorkspacePermissions): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms[permission] : false;
}
