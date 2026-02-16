'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { FolderKanban, Search, Loader2 } from 'lucide-react';

interface Project {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  icon_color: string;
  project_status: string;
  completion_percentage: number;
  health_status: string;
  team_name?: string;
  start_date: string | null;
  target_date: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planificación', color: '#F59E0B' },
  in_progress: { label: 'En progreso', color: '#3B82F6' },
  completed: { label: 'Completado', color: '#10B981' },
  on_hold: { label: 'En pausa', color: '#6B7280' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
};

export default function MemberProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { workspace, isOwner, isAdmin } = useWorkspace();
  const router = useRouter();

  // Redirect admin/owner to admin panel
  useEffect(() => {
    if (isOwner || isAdmin) {
      router.replace(`/${workspace.slug}/admin/projects`);
    }
  }, [isOwner, isAdmin, workspace.slug, router]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await fetch(`/api/workspaces/${workspace.slug}/projects?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [workspace.slug, search]);

  useEffect(() => {
    const timeout = setTimeout(fetchProjects, 300);
    return () => clearTimeout(timeout);
  }, [fetchProjects]);

  if (isOwner || isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#00D4B3]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FolderKanban className="w-7 h-7 text-[#00D4B3]" />
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: colors.textPrimary }}>
            Mis Proyectos
          </h1>
        </div>
        <p style={{ color: colors.textMuted }}>Proyectos en {workspace.name}</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.textMuted }} />
        <input
          type="text"
          placeholder="Buscar proyectos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 pl-10 rounded-lg focus:outline-none transition-colors"
          style={{
            backgroundColor: isDark ? 'transparent' : colors.bgCard,
            border: `1px solid ${isDark ? 'rgb(55, 65, 81)' : colors.border}`,
            color: colors.textPrimary,
          }}
        />
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00D4B3]" />
        </div>
      ) : projects.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl border"
          style={{ borderColor: colors.border, color: colors.textMuted }}
        >
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No hay proyectos disponibles</p>
          <p className="text-sm">Los proyectos asignados a tus equipos aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const status = STATUS_LABELS[project.project_status] || { label: project.project_status, color: '#6B7280' };
            return (
              <div
                key={project.project_id}
                className="p-5 rounded-xl transition-all hover:shadow-md cursor-pointer"
                style={{
                  background: isDark ? 'rgba(30, 35, 41, 0.5)' : colors.bgCard,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: project.icon_color || '#3B82F6' }}
                    >
                      {project.project_key?.substring(0, 2) || 'PR'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                        {project.project_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${status.color}20`, color: status.color }}
                        >
                          {status.label}
                        </span>
                        {project.team_name && (
                          <span className="text-xs" style={{ color: colors.textMuted }}>
                            {project.team_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {project.target_date && (
                      <span className="text-xs hidden sm:block" style={{ color: colors.textMuted }}>
                        {new Date(project.target_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${project.completion_percentage || 0}%`,
                            backgroundColor: (project.completion_percentage || 0) >= 100 ? '#10B981' : '#00D4B3',
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color: colors.textMuted }}>
                        {project.completion_percentage || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {project.project_description && (
                  <p className="text-sm mt-3 line-clamp-1" style={{ color: colors.textSecondary }}>
                    {project.project_description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
