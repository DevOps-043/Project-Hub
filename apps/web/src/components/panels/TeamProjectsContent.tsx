'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { api } from '@/lib/api/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreateProjectModal } from '@/components/admin/projects/CreateProjectModal';
import { useTeamPanel } from '@/components/teams/TeamPanelContext';
import { TeamPanelEmptyState } from '@/components/teams/TeamPanelEmptyState';
import { PROJECT_STATUS_CONFIG, PROJECT_HEALTH_CONFIG, softBg } from '@/components/teams/status-config';
import { FolderKanban, Plus, Search } from 'lucide-react';

// Types
interface Project {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  icon_name: string;
  icon_color: string;
  project_status: string;
  health_status: string;
  priority_level: string;
  completion_percentage: number;
  start_date: string | null;
  target_date: string | null;
  team_id: string | null;
  lead_user_id: string | null;
  created_at: string;
  updated_at: string;
  lead_first_name?: string | null;
  lead_last_name?: string | null;
  lead_display_name?: string | null;
  lead_avatar_url?: string | null;
  member_count?: number;
}

// Icon Components
const IconSVGs: Record<string, React.ReactNode> = {
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  lightbulb: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>,
};

// Project Icon
const ProjectIcon = ({ name, color, size = 40 }: { name: string; color: string; size?: number }) => (
  <div
    className="rounded-xl flex items-center justify-center"
    style={{ width: size, height: size, backgroundColor: `${color}20` }}
  >
    <svg
      width={size * 0.5}
      height={size * 0.5}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      {IconSVGs[name] || IconSVGs.folder}
    </svg>
  </div>
);

export function TeamProjectsContent() {
  const { teamId, panelBase, workspaceSlug } = useTeamPanel();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const projectsRes = await api.get<{ projects?: Project[] }>(`/api/admin/projects?team_id=${teamId}`);
      if (!projectsRes.error && projectsRes.data) {
        setProjects(projectsRes.data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesStatus = filterStatus === 'all' || project.project_status === filterStatus;
    const matchesSearch = !searchQuery ||
      project.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Group projects by status
  const projectsByStatus = {
    active: filteredProjects.filter(p => p.project_status === 'active'),
    planning: filteredProjects.filter(p => p.project_status === 'planning'),
    on_hold: filteredProjects.filter(p => p.project_status === 'on_hold'),
    completed: filteredProjects.filter(p => p.project_status === 'completed'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-xl border text-sm w-64"
            style={{
              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
              borderColor: colors.border,
              color: colors.textPrimary
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setView('grid')}
              className="p-2 transition-colors"
              style={{
                backgroundColor: view === 'grid' ? softBg('var(--color-accent)') : 'transparent',
                color: view === 'grid' ? 'var(--color-accent)' : colors.textMuted
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className="p-2 transition-colors"
              style={{
                backgroundColor: view === 'list' ? softBg('var(--color-accent)') : 'transparent',
                color: view === 'list' ? 'var(--color-accent)' : colors.textMuted
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>

          {/* New Project Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Plus size={16} />
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            backgroundColor: filterStatus === 'all' ? softBg('var(--color-accent)') : 'transparent',
            color: filterStatus === 'all' ? 'var(--color-accent)' : colors.textMuted
          }}
        >
          Todos ({projects.length})
        </button>
        {Object.entries(PROJECT_STATUS_CONFIG).map(([key, config]) => {
          const count = projects.filter(p => p.project_status === key).length;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2"
              style={{
                backgroundColor: filterStatus === key ? softBg(config.color) : 'transparent',
                color: filterStatus === key ? config.color : colors.textMuted
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {projects.length === 0 ? (
        <TeamPanelEmptyState
          icon={<FolderKanban size={26} />}
          title="Sin proyectos"
          description="Este equipo aún no tiene proyectos asignados."
          action={{ label: 'Crear proyecto', onClick: () => setShowCreateModal(true) }}
        />
      ) : view === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.project_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={`${panelBase}/projects/${project.project_id}`}
                  className="flex flex-col p-5 rounded-xl border transition-all hover:border-white/20 hover:shadow-lg group h-full"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                    borderColor: project.health_status === 'on_track' ? '#10B981' : colors.border,
                    borderWidth: project.health_status === 'on_track' ? '1.5px' : '1px'
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <ProjectIcon name={project.icon_name} color={project.icon_color} size={44} />
                      <div className="min-h-[42px] flex flex-col justify-center">
                        <h3 className="font-semibold group-hover:text-(--color-accent) transition-colors line-clamp-2" style={{ color: colors.textPrimary }}>
                          {project.project_name}
                        </h3>
                        <span className="text-xs font-mono" style={{ color: colors.textMuted }}>
                          {project.project_key}
                        </span>
                      </div>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: softBg(PROJECT_STATUS_CONFIG[project.project_status]?.color),
                        color: PROJECT_STATUS_CONFIG[project.project_status]?.color
                      }}
                    >
                      {PROJECT_STATUS_CONFIG[project.project_status]?.label}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="flex-1">
                    {project.project_description ? (
                      <p className="text-sm mb-4 line-clamp-3" style={{ color: colors.textSecondary }}>
                        {project.project_description}
                      </p>
                    ) : (
                      <div className="mb-4 h-5" /> // Spacer to maintain some consistency if no description
                    )}
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs" style={{ color: colors.textMuted }}>Progreso</span>
                      <span className="text-xs font-medium" style={{ color: colors.textPrimary }}>
                        {project.completion_percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${project.completion_percentage}%`,
                          backgroundColor: 'var(--color-accent)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    {/* Health */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROJECT_HEALTH_CONFIG[project.health_status]?.color }} />
                      <span className="text-xs" style={{ color: colors.textMuted }}>
                        {PROJECT_HEALTH_CONFIG[project.health_status]?.label}
                      </span>
                    </div>

                    {/* Due Date */}
                    {project.target_date && (
                      <span className="text-xs" style={{ color: colors.textMuted }}>
                        {format(new Date(project.target_date), 'dd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          // List View
          <div className="space-y-2">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.project_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  href={`${panelBase}/projects/${project.project_id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border transition-all hover:border-white/20 hover:bg-white/5"
                  style={{ borderColor: colors.border }}
                >
                  <ProjectIcon name={project.icon_name} color={project.icon_color} size={40} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: colors.textPrimary }}>
                        {project.project_name}
                      </span>
                      <span className="text-xs font-mono" style={{ color: colors.textMuted }}>
                        {project.project_key}
                      </span>
                    </div>
                    {project.project_description && (
                      <p className="text-sm truncate" style={{ color: colors.textMuted }}>
                        {project.project_description}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <span
                    className="px-2 py-1 rounded-full text-xs font-medium shrink-0"
                    style={{
                      backgroundColor: softBg(PROJECT_STATUS_CONFIG[project.project_status]?.color),
                      color: PROJECT_STATUS_CONFIG[project.project_status]?.color
                    }}
                  >
                    {PROJECT_STATUS_CONFIG[project.project_status]?.label}
                  </span>

                  {/* Progress */}
                  <div className="w-24 shrink-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium" style={{ color: colors.textPrimary }}>
                        {project.completion_percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${project.completion_percentage}%`,
                          backgroundColor: 'var(--color-accent)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Health */}
                  <div className="flex items-center gap-1.5 shrink-0 w-24">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROJECT_HEALTH_CONFIG[project.health_status]?.color }} />
                    <span className="text-xs" style={{ color: colors.textMuted }}>
                      {PROJECT_HEALTH_CONFIG[project.health_status]?.label}
                    </span>
                  </div>

                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchProjects();
          setShowCreateModal(false);
        }}
        initialTeamId={teamId}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
