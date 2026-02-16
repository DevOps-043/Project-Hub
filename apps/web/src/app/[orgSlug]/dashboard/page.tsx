'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuthStore } from '@/core/stores/authStore';
import { Building2, Users, FolderKanban, Shield, Loader2, Wrench, ArrowRight } from 'lucide-react';

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
  const { workspace, userRole, isOwner, isAdmin } = useWorkspace();
  const user = useAuthStore((s) => s.user);

  // Redirect owner/admin to admin dashboard
  useEffect(() => {
    if (isOwner || isAdmin) {
      router.replace(`/${workspace.slug}/admin/dashboard`);
    }
  }, [isOwner, isAdmin, workspace.slug, router]);

  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [myProjects, setMyProjects] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!workspace?.slug) return;

    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Fetch teams
    fetch(`/api/workspaces/${workspace.slug}/teams?limit=6`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.teams) setMyTeams(data.teams); })
      .catch(() => {})
      .finally(() => setLoadingTeams(false));

    // Fetch projects
    fetch(`/api/workspaces/${workspace.slug}/projects?limit=6`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.projects) setMyProjects(data.projects); })
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
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

  // If owner/admin, show loading while redirecting
  if (isOwner || isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#00D4B3]" />
      </div>
    );
  }

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

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00D4B3]/10 border border-[#00D4B3]/20 mb-4">
            <Building2 className="w-4 h-4 text-[#00D4B3]" />
            <span className="text-[#00D4B3] text-sm font-medium">{workspace.name}</span>
            <span className="text-[#00D4B3]/60 text-xs">•</span>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#00D4B3]/60" />
              <span className="text-[#00D4B3]/80 text-xs">{ROLE_LABELS[userRole] || userRole}</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>
            {getGreeting()},{' '}
            <span className="text-[#00D4B3]">{user?.name || user?.firstName || 'Usuario'}</span>
          </h1>

          <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
            {getFormattedDate()} — Espacio de trabajo: <strong>{workspace.name}</strong>
          </p>
        </div>
      </div>

      {/* Quick Actions for Members */}
      <div>
        <h2 className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
          Acceso rápido
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Mis Equipos', icon: Users, href: `/${workspace.slug}/teams` },
            { label: 'Mis Proyectos', icon: FolderKanban, href: `/${workspace.slug}/projects` },
            { label: 'Herramientas', icon: Wrench, href: `/${workspace.slug}/tools` },
          ].map((action) => (
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

      {/* My Teams */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Mis Equipos</h2>
          <button
            onClick={() => router.push(`/${workspace.slug}/teams`)}
            className="text-sm flex items-center gap-1 text-[#00D4B3] hover:underline"
          >
            Ver todos <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {loadingTeams ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#00D4B3]" />
          </div>
        ) : myTeams.length === 0 ? (
          <div className="text-center py-8 rounded-xl border" style={{ borderColor: colors.border, color: colors.textMuted }}>
            No estás en ningún equipo aún
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myTeams.map((team) => (
              <div
                key={team.id}
                className="p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer"
                style={{
                  background: isDark ? 'rgba(30, 35, 41, 0.5)' : 'white',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                }}
                onClick={() => router.push(`/${workspace.slug}/teams`)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: team.color || '#00D4B3' }}
                  >
                    {team.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm" style={{ color: colors.textPrimary }}>{team.name}</h3>
                    <p className="text-xs" style={{ color: colors.textMuted }}>
                      {team.memberCount || 0} miembros
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Mis Proyectos</h2>
          <button
            onClick={() => router.push(`/${workspace.slug}/projects`)}
            className="text-sm flex items-center gap-1 text-[#00D4B3] hover:underline"
          >
            Ver todos <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {loadingProjects ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#00D4B3]" />
          </div>
        ) : myProjects.length === 0 ? (
          <div className="text-center py-8 rounded-xl border" style={{ borderColor: colors.border, color: colors.textMuted }}>
            No hay proyectos disponibles
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myProjects.map((project) => (
              <div
                key={project.project_id}
                className="p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer"
                style={{
                  background: isDark ? 'rgba(30, 35, 41, 0.5)' : 'white',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                }}
                onClick={() => router.push(`/${workspace.slug}/projects`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: project.icon_color || '#3B82F6' }}
                    >
                      {project.project_key?.substring(0, 2) || 'PR'}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm" style={{ color: colors.textPrimary }}>{project.project_name}</h3>
                      <p className="text-xs" style={{ color: colors.textMuted }}>
                        {project.project_status || 'En progreso'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-[#00D4B3]"
                        style={{ width: `${project.completion_percentage || 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: colors.textMuted }}>
                      {project.completion_percentage || 0}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
