'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Layout, Calendar, User, Flag, Users,
  CheckCircle2, Circle, Clock, Loader2, ExternalLink
} from 'lucide-react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ProjectUpdatesView } from '@/components/admin/projects/views/ProjectUpdatesView';
import { ProjectIssuesView } from '@/components/admin/projects/views/ProjectIssuesView';
import { ProjectDocumentsView } from '@/components/admin/projects/views/ProjectDocumentsView';
import { ProjectSettingsView } from '@/components/admin/projects/views/ProjectSettingsView';
import { ProjectCyclesView } from '@/components/admin/projects/views/ProjectCyclesView';

interface ProjectDetail {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  project_status: string;
  health_status: string;
  priority_level: string;
  completion_percentage: number;
  start_date: string | null;
  target_date: string | null;
  icon_name: string | null;
  icon_color: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
  lead: {
    user_id: string;
    first_name: string;
    last_name_paternal: string;
    display_name: string | null;
    avatar_url: string | null;
    email: string;
  } | null;
  team: {
    team_id: string;
    name: string;
    color: string;
  } | null;
  milestones: Array<{
    milestone_id: string;
    milestone_name: string;
    milestone_status: string;
    due_date: string | null;
  }>;
}

interface Progress {
  scope: number;
  started: number;
  completed: number;
  percentage: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planificación', color: '#6B7280' },
  active: { label: 'Activo', color: '#10B981' },
  in_progress: { label: 'En progreso', color: '#3B82F6' },
  on_hold: { label: 'En pausa', color: '#F59E0B' },
  completed: { label: 'Completado', color: '#10B981' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgente', color: '#EF4444' },
  high: { label: 'Alta', color: '#F97316' },
  medium: { label: 'Media', color: '#F59E0B' },
  low: { label: 'Baja', color: '#6B7280' },
  none: { label: 'Sin prioridad', color: '#9CA3AF' },
};

const TABS = ['Overview', 'Updates', 'Issues', 'Cycles', 'Documents', 'Settings'] as const;

export default function WorkspaceAdminProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const orgSlug = params.orgSlug as string;

  const { isDark } = useTheme();
  const { workspace } = useWorkspace();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`/api/workspaces/${orgSlug}/projects/${projectId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          if (res.status === 403) setError('Sin acceso a este proyecto');
          else if (res.status === 404) setError('Proyecto no encontrado');
          else setError('Error al cargar el proyecto');
          return;
        }

        const data = await res.json();
        setProject(data.project);
        setProgress(data.progress);
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    if (orgSlug && projectId) fetchProject();
  }, [orgSlug, projectId]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const [usersRes, teamsRes] = await Promise.all([
          fetch(`/api/workspaces/${orgSlug}/members?limit=100`, { headers }),
          fetch(`/api/workspaces/${orgSlug}/teams?limit=50`, { headers })
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
        }
        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setTeams(data.teams || []);
        }
      } catch (e) {
        console.error('Error fetching options:', e);
      }
    };
    if (orgSlug) fetchOptions();
  }, [orgSlug]);

  const updateProject = async (field: string, value: any) => {
    if (!project) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/workspaces/${orgSlug}/projects/${project.project_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ [field]: value })
      });

      const data = await res.json();
      
      if (res.ok) {
        setProject(prev => prev ? { ...prev, ...data.project } : null);
      } else {
        alert(data.error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const bgCard = isDark ? 'bg-white/[0.03]' : 'bg-white';
  const borderMain = isDark ? 'border-white/[0.06]' : 'border-gray-200';
  const hoverText = isDark ? 'hover:text-white' : 'hover:text-gray-900';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00D4B3]" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className={`text-lg font-medium mb-2 ${textMain}`}>{error || 'Proyecto no encontrado'}</p>
          <button
            onClick={() => router.push(`/${orgSlug}/admin/projects`)}
            className="text-sm text-blue-500 hover:underline"
          >
            Volver a proyectos
          </button>
        </div>
      </div>
    );
  }

  const status = STATUS_LABELS[project.project_status] || { label: project.project_status, color: '#6B7280' };
  const priority = PRIORITY_LABELS[project.priority_level] || { label: project.priority_level, color: '#9CA3AF' };
  const sheetsTemplateId = (workspace?.settings as Record<string, unknown>)?.google_sheets_template_id as string | undefined;

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Breadcrumb + Tabs Header */}
      <header className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8`}>
        <div className={`flex items-center gap-2 text-sm ${textSub}`}>
          <button
            onClick={() => router.push(`/${orgSlug}/admin/projects`)}
            className={`flex items-center gap-1 ${hoverText} transition-colors`}
          >
            <ChevronLeft size={16} />
            Proyectos
          </button>
          <span className="opacity-40">/</span>
          <span className={`truncate max-w-[200px] ${textMain}`}>{project.project_name}</span>
        </div>

        <div className={`flex p-1 rounded-lg border ${borderMain} ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.toLowerCase()
                  ? isDark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                  : `${textSub} ${hoverText}`
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Left: Tab Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Project Title */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: (project.icon_color || '#3B82F6') + '20' }}
                    >
                      <Layout className="w-5 h-5" style={{ color: project.icon_color || '#3B82F6' }} />
                    </div>
                    <div>
                      <span className={`text-xs font-mono ${textSub}`}>{project.project_key}</span>
                      <h1 className={`text-2xl font-bold ${textMain}`}>{project.project_name}</h1>
                    </div>
                  </div>

                  {/* Quick Properties */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: status.color + '15', color: status.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: priority.color + '15', color: priority.color }}
                    >
                      <Flag size={12} />
                      {priority.label}
                    </span>
                    {project.lead && (
                      <span className={`inline-flex items-center gap-1.5 text-xs ${textSub}`}>
                        <User size={12} />
                        {project.lead.display_name || project.lead.first_name}
                      </span>
                    )}
                    {project.team && (
                      <span className={`inline-flex items-center gap-1.5 text-xs ${textSub}`}>
                        <Users size={12} />
                        {project.team.name}
                      </span>
                    )}
                    {project.start_date && project.target_date && (
                      <span className={`inline-flex items-center gap-1.5 text-xs ${textSub}`}>
                        <Calendar size={12} />
                        {format(new Date(project.start_date), 'd MMM', { locale: es })} — {format(new Date(project.target_date), 'd MMM yyyy', { locale: es })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {project.project_description && (
                  <div className={`rounded-xl border p-6 ${bgCard} ${borderMain}`}>
                    <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Acerca del proyecto</h3>
                    <p className={`text-sm whitespace-pre-line leading-relaxed ${textSub}`}>
                      {project.project_description}
                    </p>
                  </div>
                )}

                {/* Resources from metadata */}
                {project.metadata && Array.isArray((project.metadata as any).resources) && (project.metadata as any).resources.length > 0 && (
                  <div className={`rounded-xl border p-6 ${bgCard} ${borderMain}`}>
                    <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Recursos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {((project.metadata as any).resources as Array<{ title: string; url: string; type: string }>).map((r, i) => (
                        <a
                          key={i}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${borderMain} ${hoverText} transition-colors`}
                          style={{ color: colors.textMuted }}
                        >
                          <ExternalLink size={14} />
                          <span className="truncate">{r.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'updates' && (
              <motion.div
                key="updates"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ProjectUpdatesView projectId={project.project_id} />
              </motion.div>
            )}

            {activeTab === 'issues' && (
              <motion.div
                key="issues"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ProjectIssuesView 
                  projectId={project.project_id} 
                  teamId={project.team?.team_id}
                  workspaceSlug={orgSlug}
                />
              </motion.div>
            )}

            {activeTab === 'cycles' && (
              <motion.div
                key="cycles"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ProjectCyclesView
                  projectId={project.project_id}
                  teamId={project.team?.team_id}
                  workspaceSlug={orgSlug}
                />
              </motion.div>
            )}

            {activeTab === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ProjectDocumentsView
                  projectId={project.project_id}
                  workspaceSlug={orgSlug}
                  projectKey={project.project_key}
                  sheetsTemplateId={sheetsTemplateId}
                  teamId={project.team?.team_id}
                  onNavigateToIssues={() => setActiveTab('issues')}
                />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <ProjectSettingsView
                  project={project}
                  onUpdate={updateProject}
                  users={users}
                  teams={teams}
                  saving={saving}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Progress Card */}
          {progress && (
            <div className={`p-5 rounded-xl border ${bgCard} ${borderMain}`}>
              <h3 className={`text-sm font-semibold mb-4 ${textMain}`}>Progreso</h3>
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs ${textSub}`}>Completado</span>
                    <span className={`text-sm font-bold ${textMain}`}>{progress.percentage}%</span>
                  </div>
                  <div className={`h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                    <div
                      className="h-full rounded-full bg-[#00D4B3] transition-all duration-500"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Scope', value: progress.scope, icon: Circle },
                    { label: 'Iniciados', value: progress.started, icon: Clock },
                    { label: 'Hechos', value: progress.completed, icon: CheckCircle2 },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <stat.icon size={14} className={`mx-auto mb-1 ${textSub}`} />
                      <div className={`text-lg font-bold ${textMain}`}>{stat.value}</div>
                      <div className={`text-[10px] ${textSub}`}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Milestones */}
          {project.milestones && project.milestones.length > 0 && (
            <div className={`p-5 rounded-xl border ${bgCard} ${borderMain}`}>
              <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Hitos</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {project.milestones.map((m) => (
                  <div key={m.milestone_id} className="flex items-center gap-2">
                    {m.milestone_status === 'completed' ? (
                      <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle size={14} className={`flex-shrink-0 ${textSub}`} />
                    )}
                    <span className={`text-xs truncate ${m.milestone_status === 'completed' ? 'line-through opacity-60' : ''} ${textMain}`}>
                      {m.milestone_name}
                    </span>
                    {m.due_date && (
                      <span className={`text-[10px] ml-auto flex-shrink-0 ${textSub}`}>
                        {format(new Date(m.due_date), 'd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
