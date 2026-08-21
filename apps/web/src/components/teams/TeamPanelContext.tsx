'use client';

import { createContext, useContext } from 'react';

export type TeamPanelTab = 'overview' | 'tasks' | 'projects' | 'cycles' | 'documents' | 'members' | 'settings';

export interface TeamPanelTeam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  status: string;
  visibility: string;
  maxMembers: number;
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamPanelContextValue {
  team: TeamPanelTeam | null;
  loading: boolean;
  error: string;
  refreshTeam: () => Promise<void>;
  panelBase: string;
  workspaceSlug: string;
  teamId: string;
  /** permissions.manageTeams — owner/admin */
  canManage: boolean;
  /** permissions.manageWorkspace — owner only, gate para eliminar el equipo */
  canDelete: boolean;
  /**
   * Pestañas con una página real en el árbol de rutas actual. El panel de
   * equipo vive en dos árboles (workspace: 7 pestañas completas; admin
   * global sin org: solo tasks/projects/cycles/members, sin Resumen ni
   * Configuración). Si se omite, TeamTabBar muestra las 7.
   */
  availableTabs?: TeamPanelTab[];
}

export const TeamPanelContext = createContext<TeamPanelContextValue | null>(null);

/**
 * Identidad y navegación del equipo, provistas una sola vez por
 * app/[orgSlug]/admin/teams/[teamId]/layout.tsx. Antes cada subpágina
 * (Tareas/Proyectos/Ciclos/Miembros/Configuración) repetía su propio fetch
 * de equipo y su propio header/back-link, lo que llevó a que cada uno
 * enlazara "volver" a un destino distinto (ver plan de rediseño).
 */
export function useTeamPanel(): TeamPanelContextValue {
  const context = useContext(TeamPanelContext);
  if (!context) throw new Error('useTeamPanel debe usarse dentro del layout de equipo');
  return context;
}
