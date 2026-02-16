'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuthStore } from '@/core/stores/authStore';
import { Building2, Users, FolderKanban, BarChart3, Settings, Shield, Loader2 } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Gerente',
  leader: 'Líder',
  member: 'Miembro',
};

export default function WorkspaceDashboardPage() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const router = useRouter();
  const { workspace, userRole, permissions } = useWorkspace();
  const user = useAuthStore((s) => s.user);

  const [stats, setStats] = useState({ projects: 0, teams: 0, members: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!workspace?.slug) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const [teamsRes, membersRes, analyticsRes] = await Promise.all([
          fetch(`/api/workspaces/${workspace.slug}/teams`),
          fetch(`/api/workspaces/${workspace.slug}/members`),
          fetch(`/api/workspaces/${workspace.slug}/analytics`),
        ]);

        const [teamsData, membersData, analyticsData] = await Promise.all([
          teamsRes.ok ? teamsRes.json() : null,
          membersRes.ok ? membersRes.json() : null,
          analyticsRes.ok ? analyticsRes.json() : null,
        ]);

        setStats({
          projects: analyticsData?.projects?.total ?? 0,
          teams: teamsData?.pagination?.total ?? (Array.isArray(teamsData?.teams) ? teamsData.teams.length : 0),
          members: membersData?.pagination?.total ?? (Array.isArray(membersData?.users) ? membersData.users.length : 0),
        });
      } catch {
        // Keep defaults
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [workspace?.slug]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const quickActions = [
    ...(permissions.manageProjects
      ? [{ label: 'Nuevo Proyecto', icon: FolderKanban, href: `/${workspace.slug}/admin/projects?create=true` }]
      : []),
    ...(permissions.manageTeams
      ? [{ label: 'Crear Equipo', icon: Users, href: `/${workspace.slug}/admin/teams?create=true` }]
      : []),
    ...(permissions.viewAnalytics
      ? [{ label: 'Ver Analytics', icon: BarChart3, href: `/${workspace.slug}/admin/analytics` }]
      : []),
    ...(permissions.manageWorkspace
      ? [{ label: 'Configuración', icon: Settings, href: `/${workspace.slug}/admin/settings` }]
      : []),
  ];

  const statCards = [
    { label: 'Proyectos', value: stats.projects, icon: FolderKanban, href: `/${workspace.slug}/admin/projects` },
    { label: 'Equipos', value: stats.teams, icon: Users, href: `/${workspace.slug}/admin/teams` },
    { label: 'Miembros', value: stats.members, icon: Users, href: `/${workspace.slug}/admin/members` },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 transition-colors duration-300"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(0, 212, 179, 0.1) 0%, rgba(10, 37, 64, 0.8) 50%, rgba(15, 20, 25, 0.9) 100%)'
            : 'linear-gradient(135deg, rgba(0, 212, 179, 0.15) 0%, rgba(248, 250, 252, 0.9) 50%, rgba(255, 255, 255, 1) 100%)',
          border: `1px solid ${isDark ? 'rgba(0, 212, 179, 0.2)' : colors.border}`,
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4B3]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#0A2540]/30 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          {/* Workspace Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00D4B3]/10 border border-[#00D4B3]/20 mb-4">
            <Building2 className="w-4 h-4 text-[#00D4B3]" />
            <span className="text-[#00D4B3] text-sm font-medium">{workspace.name}</span>
            <span className="text-[#00D4B3]/60 text-xs">•</span>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#00D4B3]/60" />
              <span className="text-[#00D4B3]/80 text-xs">{ROLE_LABELS[userRole] || userRole}</span>
            </div>
          </div>

          {/* Greeting */}
          <h1
            className="text-2xl md:text-3xl font-bold mb-2 transition-colors"
            style={{ color: colors.textPrimary }}
          >
            {getGreeting()},{' '}
            <span className="text-[#00D4B3]">{user?.name || user?.firstName || 'Usuario'}</span>
          </h1>

          <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
            {getFormattedDate()} — Espacio de trabajo: <strong>{workspace.name}</strong>
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
            Acciones rápidas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-md"
                style={{
                  background: isDark ? 'rgba(30, 35, 41, 0.8)' : 'white',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                }}
              >
                <action.icon className="w-5 h-5 text-[#00D4B3] flex-shrink-0" />
                <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <button
            key={stat.label}
            onClick={() => router.push(stat.href)}
            className="p-5 rounded-xl border transition-all hover:shadow-md text-left"
            style={{
              background: isDark ? 'rgba(30, 35, 41, 0.8)' : 'white',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className="w-5 h-5 text-[#00D4B3]" />
              <span className="text-sm" style={{ color: colors.textSecondary }}>
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
              {loadingStats ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#00D4B3]" />
              ) : (
                stat.value
              )}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
