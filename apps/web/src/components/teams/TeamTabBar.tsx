'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText, FolderKanban, LayoutGrid, ListChecks, RefreshCw, Settings2, Users,
} from 'lucide-react';
import { useTeamPanel, type TeamPanelTab } from './TeamPanelContext';
import styles from './TeamTabBar.module.css';

const TABS: { key: TeamPanelTab; label: string; segment: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Resumen', segment: '', icon: <LayoutGrid size={16} /> },
  { key: 'tasks', label: 'Tareas', segment: '/tasks', icon: <ListChecks size={16} /> },
  { key: 'projects', label: 'Proyectos', segment: '/projects', icon: <FolderKanban size={16} /> },
  { key: 'cycles', label: 'Ciclos', segment: '/cycles', icon: <RefreshCw size={16} /> },
  { key: 'documents', label: 'Documentos', segment: '/documents', icon: <FileText size={16} /> },
  { key: 'members', label: 'Miembros', segment: '/members', icon: <Users size={16} /> },
  { key: 'settings', label: 'Configuración', segment: '/settings', icon: <Settings2 size={16} /> },
];

/**
 * Tabs segmentados del equipo (SOFIA_DESIGN_SYSTEM.md §14.3): superficie soft
 * + borde, radio de grupo 0.9-1rem, padding interno 3-4px, cada tab radio
 * 0.65-0.8rem, activo con relleno --color-primary. "Resumen" siempre está
 * presente y siempre resuelve a la misma ruta (base del equipo), por diseño:
 * es la corrección estructural al bug donde cada subpágina enlazaba "volver"
 * a un destino distinto.
 */
export function TeamTabBar() {
  const { panelBase, teamId, availableTabs } = useTeamPanel();
  const pathname = usePathname();
  const base = `${panelBase}/teams/${teamId}`;
  const tabs = availableTabs ? TABS.filter((tab) => availableTabs.includes(tab.key)) : TABS;

  return (
    <nav
      className={styles.tabs}
    >
      {tabs.map((tab) => {
        const href = `${base}${tab.segment}`;
        const isActive = tab.segment ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.key}
            href={href}
            className={styles.tab}
            data-active={isActive ? 'true' : 'false'}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
