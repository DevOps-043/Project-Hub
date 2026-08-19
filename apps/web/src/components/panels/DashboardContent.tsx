'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  FolderKanban,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { getPanelPathForRole, useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuthStore } from '@/core/stores/authStore';
import { api } from '@/lib/api/client';
import styles from './DashboardContent.module.css';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Gerente',
  leader: 'Líder',
  member: 'Miembro',
};

export function DashboardContent() {
  const { isDark } = useTheme();
  const router = useRouter();
  const { workspace, userRole, permissions } = useWorkspace();
  const user = useAuthStore((state) => state.user);
  const panelBase = getPanelPathForRole(workspace.slug, userRole);

  const [stats, setStats] = useState({ projects: 0, teams: 0, members: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!workspace?.slug) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const [teamsRes, membersRes, analyticsRes] = await Promise.all([
          api.get<{ pagination?: { total: number }; teams?: unknown[] }>(`/api/workspaces/${workspace.slug}/teams?limit=1`),
          api.get<{ pagination?: { total: number }; users?: unknown[] }>(`/api/workspaces/${workspace.slug}/members?limit=1`),
          api.get<{ projects?: { total: number } }>(`/api/workspaces/${workspace.slug}/analytics`),
        ]);

        const teamsData = teamsRes.data;
        const membersData = membersRes.data;
        const analyticsData = analyticsRes.data;

        setStats({
          projects: analyticsData?.projects?.total ?? 0,
          teams: teamsData?.pagination?.total ?? (Array.isArray(teamsData?.teams) ? teamsData.teams.length : 0),
          members: membersData?.pagination?.total ?? (Array.isArray(membersData?.users) ? membersData.users.length : 0),
        });
      } catch {
        // El dashboard sigue siendo utilizable aunque una métrica no esté disponible.
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [workspace?.slug]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const formattedDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const quickActions = [
    ...(permissions.manageProjects
      ? [{ label: 'Nuevo proyecto', description: 'Crea y organiza un nuevo espacio de trabajo.', icon: FolderKanban, href: `${panelBase}/projects?create=true` }]
      : []),
    ...(permissions.manageTeams
      ? [{ label: 'Crear equipo', description: 'Agrupa responsables y colaboradores.', icon: Users, href: `${panelBase}/teams?create=true` }]
      : []),
    ...(permissions.viewAnalytics
      ? [{ label: 'Ver analítica', description: 'Revisa avance, carga y rendimiento.', icon: BarChart3, href: `${panelBase}/analytics` }]
      : []),
  ];

  const statCards = [
    { label: 'Proyectos', caption: 'en el workspace', value: stats.projects, icon: FolderKanban, href: `${panelBase}/projects` },
    { label: 'Equipos', caption: 'grupos activos', value: stats.teams, icon: Users, href: `${panelBase}/teams` },
    ...(permissions.viewAllMembers
      ? [{ label: 'Miembros', caption: 'personas registradas', value: stats.members, icon: Users, href: `${panelBase}/members` }]
      : []),
  ];

  return (
    <div className={styles.dashboard} data-theme={isDark ? 'dark' : 'light'}>
      <section className={styles.hero} aria-labelledby="workspace-greeting">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroArcLarge} aria-hidden="true" />
        <div className={styles.heroArcSmall} aria-hidden="true" />
        <span className={styles.heroDot} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowLine} aria-hidden="true" />
            <Building2 size={13} aria-hidden="true" />
            <span>Control del workspace</span>
            <span className={styles.eyebrowSeparator} aria-hidden="true" />
            <ShieldCheck size={13} aria-hidden="true" />
            <span>{ROLE_LABELS[userRole] || userRole}</span>
          </div>

          <h1 id="workspace-greeting" className={styles.heroTitle}>
            {greeting}, {user?.name || user?.firstName || 'Usuario'}.
          </h1>

          <div className={styles.heroMeta}>
            <p>Supervisa tus proyectos, equipos y operación desde un solo lugar.</p>
            <span className={styles.date}>
              <CalendarDays size={14} aria-hidden="true" />
              {formattedDate}
            </span>
          </div>
        </div>

        <div className={styles.workspacePill}>
          <span className={styles.workspacePulse} aria-hidden="true" />
          <span>{workspace.name}</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="summary-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="summary-title">Estado general</h2>
            <p>Una vista rápida de la actividad de tu organización.</p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          {statCards.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => router.push(stat.href)}
              className={styles.statCard}
              aria-label={`Abrir ${stat.label.toLowerCase()}`}
            >
              <span className={styles.iconBox}>
                <stat.icon size={19} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className={styles.statCopy}>
                <span className={styles.statLabel}>{stat.label}</span>
                <span className={styles.statValue}>
                  {loadingStats ? <Loader2 className={styles.spinner} size={22} aria-label="Cargando" /> : stat.value}
                </span>
                <span className={styles.statCaption}>{stat.caption}</span>
              </span>
              <ArrowUpRight className={styles.cardArrow} size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {quickActions.length > 0 && (
        <section className={styles.section} aria-labelledby="actions-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="actions-title">Acciones rápidas</h2>
              <p>Atajos para las tareas más frecuentes.</p>
            </div>
          </div>

          <div className={styles.actionsGrid}>
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => router.push(action.href)}
                className={styles.actionCard}
              >
                <span className={styles.actionIcon}>
                  <action.icon size={18} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className={styles.actionCopy}>
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </span>
                <ArrowUpRight className={styles.actionArrow} size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
