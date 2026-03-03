'use client';

import { createContext, useContext, ReactNode } from 'react';

export type IrisRole = 'owner' | 'admin' | 'manager' | 'leader' | 'member';

export interface WorkspacePermissions {
  manageWorkspace: boolean;
  manageMembers: boolean;
  manageRoles: boolean;
  manageProjects: boolean;
  manageTeams: boolean;
  viewAnalytics: boolean;
  viewReports: boolean;
  viewAllMembers: boolean;
}

const ROLE_PERMISSIONS: Record<IrisRole, WorkspacePermissions> = {
  owner:   { manageWorkspace: true,  manageMembers: true,  manageRoles: true,  manageProjects: true,  manageTeams: true,  viewAnalytics: true,  viewReports: true,  viewAllMembers: true  },
  admin:   { manageWorkspace: false, manageMembers: true,  manageRoles: true,  manageProjects: true,  manageTeams: true,  viewAnalytics: true,  viewReports: true,  viewAllMembers: true  },
  manager: { manageWorkspace: false, manageMembers: false, manageRoles: false, manageProjects: true,  manageTeams: true,  viewAnalytics: false, viewReports: false, viewAllMembers: false },
  leader:  { manageWorkspace: false, manageMembers: false, manageRoles: false, manageProjects: true,  manageTeams: false, viewAnalytics: false, viewReports: false, viewAllMembers: false },
  member:  { manageWorkspace: false, manageMembers: false, manageRoles: false, manageProjects: false, manageTeams: false, viewAnalytics: false, viewReports: false, viewAllMembers: false },
};

export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
  description: string | null;
  settings: Record<string, unknown>;
}

export interface WorkspaceContextType {
  workspace: WorkspaceData;
  userRole: IrisRole;
  permissions: WorkspacePermissions;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isLeader: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
  workspace: WorkspaceData;
  userRole: IrisRole;
}

export function WorkspaceProvider({ children, workspace, userRole }: WorkspaceProviderProps) {
  const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.member;

  const value: WorkspaceContextType = {
    workspace,
    userRole,
    permissions,
    isOwner: userRole === 'owner',
    isAdmin: userRole === 'owner' || userRole === 'admin',
    isManager: userRole === 'manager',
    isLeader: userRole === 'leader',
    canManageMembers: permissions.manageMembers,
    canManageSettings: permissions.manageWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace debe usarse dentro de un WorkspaceProvider');
  }
  return context;
}

export function getPermissionsForRole(role: IrisRole): WorkspacePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member;
}

/**
 * Returns the base panel path for a given role within a workspace.
 */
export function getPanelPathForRole(orgSlug: string, role: IrisRole): string {
  switch (role) {
    case 'owner':
    case 'admin':   return `/${orgSlug}/admin`;
    case 'manager': return `/${orgSlug}/manager`;
    case 'leader':  return `/${orgSlug}/leader`;
    default:        return `/${orgSlug}`;
  }
}
