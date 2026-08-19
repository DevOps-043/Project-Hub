'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, MoreHorizontal, Calendar, User, 
  Flag, CheckCircle2, Circle, Clock, Layout, 
  Plus, Link as LinkIcon, Users, Tag,
  BarChart2, ArrowUpRight, Edit3, Save, X, Check
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ProjectUpdatesView } from '@/components/admin/projects/views/ProjectUpdatesView';
import { ProjectIssuesView } from '@/components/admin/projects/views/ProjectIssuesView';
import { ProjectDocumentsView } from '@/components/admin/projects/views/ProjectDocumentsView';
import { ProjectSettingsView } from '@/components/admin/projects/views/ProjectSettingsView';
import { ProjectCyclesView } from '@/components/admin/projects/views/ProjectCyclesView';
import { api } from '@/lib/api/client';

// Status options
const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planificación', color: '#6B7280' },
  { value: 'active', label: 'Activo', color: '#10B981' },
  { value: 'on_hold', label: 'En pausa', color: '#F59E0B' },
  { value: 'completed', label: 'Completado', color: '#3B82F6' },
  { value: 'cancelled', label: 'Cancelado', color: '#EF4444' },
];

const PRIORITY_OPTIONS = [
  { value: 'none', label: 'Sin prioridad', color: '#6B7280' },
  { value: 'low', label: 'Baja', color: '#6B7280' },
  { value: 'medium', label: 'Media', color: '#3B82F6' },
  { value: 'high', label: 'Alta', color: '#F59E0B' },
  { value: 'urgent', label: 'Urgente', color: '#EF4444' },
];

// Types
interface ProjectResource {
  title: string;
  url: string;
  type: 'figma' | 'notion' | 'github' | 'drive' | 'other';
}

interface ProjectProgress {
  scope: number;
  started: number;
  completed: number;
  percentage: number;
  history: { date: string; completed: number }[];
}

interface ProjectDetail {
  project_id: string;
  project_name?: string;
  name?: string;
  project_key: string;
  project_description?: string;
  summary?: string;
  description?: string;
  project_status?: string;
  status?: string;
  priority_level?: string;
  priority?: string;
  start_date: string;
  target_date: string;
  lead_user_id?: string;
  lead: {
    display_name: string;
    avatar_url?: string;
    user_id: string;
    first_name: string;
    last_name_paternal: string;
  } | null;
  team_id?: string;
  team: {
    team_id?: string;
    name: string;
    color: string;
  } | null;
  milestones: Array<{
    milestone_id: string;
    milestone_name: string;
    milestone_status: string;
    due_date: string | null;
  }>;
  metadata?: {
    resources?: ProjectResource[];
  };
  workspace?: {
    workspace_id: string;
    slug: string;
    name: string;
    settings?: Record<string, any>;
  } | null;
}

interface UserOption {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name_paternal: string;
  avatar_url: string | null;
}

interface TeamOption {
  id?: string;
  team_id?: string;
  name: string;
  color: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const router = useRouter();
  
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  // Refs for dropdown positioning
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const leadBtnRef = useRef<HTMLButtonElement>(null);
  const teamBtnRef = useRef<HTMLButtonElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const fetchProject = useCallback(async () => {
    try {
      const { data, error } = await api.get<{ project?: ProjectDetail; progress?: ProjectProgress }>(`/api/admin/projects/${params.id}`);
      if (error || !data) throw new Error('Failed to fetch project');

      if (data.project) {
        setProject(data.project);
        setTitleValue(data.project.project_name || data.project.name || '');
        setDescValue(data.project.project_description || data.project.description || '');
      }
      if (data.progress) {
        setProgress(data.progress);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  // Fetch users and teams for dropdowns
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [usersRes, teamsRes] = await Promise.all([
          api.get<{ users?: UserOption[] }>('/api/admin/users?limit=100'),
          api.get<{ teams?: TeamOption[] }>('/api/admin/teams?limit=50')
        ]);
        if (!usersRes.error && usersRes.data) {
          setUsers(usersRes.data.users || []);
        }
        if (!teamsRes.error && teamsRes.data) {
          setTeams(teamsRes.data.teams || []);
        }
      } catch (e) {
        console.error('Error fetching options:', e);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Open dropdown with position
  const openDropdown = (name: string, ref: React.RefObject<HTMLButtonElement | null>) => {
    if (activeDropdown === name) {
      setActiveDropdown(null);
      return;
    }
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownPos({ 
        top: rect.bottom + 4, 
        left: rect.right - 200, 
        width: 200 
      });
    }
    setActiveDropdown(name);
  };

  // Update project field
  const updateProject = async (field: string, value: string | null | undefined) => {
    if (!project) return;
    
    setSaving(true);
    try {
      const { data, error } = await api.patch<{ project?: Partial<ProjectDetail> }>(`/api/admin/projects/${params.id}`, { [field]: value });

      if (!error && data) {
        setProject(prev => prev ? { ...prev, ...data.project } : null);
      } else {
        // Show error to user
        alert(error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Error de conexión');
    } finally {
      setSaving(false);
      setActiveDropdown(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Cargando proyecto...</div>;
  if (!project) return <div className="p-8 text-gray-500">Proyecto no encontrado</div>;

  // ESTILOS DINÁMICOS
  const bgPage = isDark ? 'bg-[#161920]' : 'bg-gray-50';
  const bgHeader = isDark ? 'bg-[#161920]/80' : 'bg-white/80';
  const bgCard = isDark ? 'bg-[#1E2329]' : 'bg-white';
  
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  
  const borderMain = isDark ? 'border-white/10' : 'border-gray-200';
  const borderSub = isDark ? 'border-white/5' : 'border-gray-100';
  
  const hoverItem = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100';
  const hoverText = isDark ? 'hover:text-white' : 'hover:text-blue-600';

  // Prepare chart data or placeholder
  const chartData = progress?.history && progress.history.length > 0 
    ? progress.history.map((h, i) => ({ name: `T${i}`, completed: h.completed }))
    : [{ name: 'Start', completed: 0 }, { name: 'Now', completed: progress?.percentage || 0 }];

  const resources = project.metadata?.resources || [];

  return (
    <div className={`min-h-screen ${bgPage} ${textMain} font-sans selection:bg-blue-500/30 transition-colors`}>
      {/* HEADER */}
      <header className={`h-14 border-b ${borderMain} flex items-center justify-between px-6 sticky top-0 ${bgHeader} backdrop-blur-md z-40 transition-colors`}>
        <div className={`flex items-center gap-4 text-sm ${textSub}`}>
          <button onClick={() => router.back()} className={`${hoverText} transition-colors`}>
            <ChevronLeft size={18} />
          </button>
          <span className={`${hoverText} cursor-pointer transition-colors`}>Projects</span>
          <span className="opacity-40">/</span>
          <div className={`flex items-center gap-2 font-medium ${textMain}`}>
            <div className="w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold" 
                 style={{ backgroundColor: project.team?.color || '#3B82F6', color: '#fff' }}>
              {project.team?.name?.[0] || 'P'}
            </div>
            {project.project_key}
          </div>
          <span className="opacity-40">/</span>
          <span className="truncate max-w-[200px]">{project.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex p-1 rounded-lg border ${borderSub} ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
            {['Overview', 'Updates', 'Issues', 'Cycles', 'Documents', 'Settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.toLowerCase() ? (isDark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm') : `${textSub} ${hoverText}`
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className={`p-2 rounded-md ${textSub} ${hoverItem} ${hoverText} transition-colors`}>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12 p-8 lg:p-12">
        
        {/* LEFT COLUMN: PRIMARY CONTENT */}
        <div className="flex flex-col gap-10 min-h-[500px]">
          
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-10"
              >
                  {/* Title & Header Area */}
                  <div className="space-y-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-2xl ${isDark ? 'shadow-blue-900/20' : 'shadow-blue-500/10'}`}
                        style={{ background: isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))' : 'white', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                      <Layout className="text-blue-500" size={24} />
                    </div>
                    
                    <div className="space-y-2">
                      <h1 className={`text-4xl font-bold tracking-tight ${textMain} leading-tight`}>
                        [{project.project_key}] {project.name}
                      </h1>
                      <p className={`text-xl ${textSub} font-light leading-relaxed max-w-2xl`}>
                        {project.summary}
                      </p>
                    </div>
                  </div>

                  {/* Quick Properties Strip */}
                  <div className={`flex flex-wrap items-center gap-6 py-4 border-y ${borderMain}`}>
                    <div className="flex items-center gap-2 text-sm">
                        <span className={textMuted}>Status</span>
                        {(() => {
                          const statusValue = project.project_status || project.status;
                          const statusOption = STATUS_OPTIONS.find(s => s.value === statusValue);
                          return (
                            <div 
                              className="flex items-center gap-1.5 px-2 py-1 rounded-full border"
                              style={{
                                backgroundColor: `${statusOption?.color || '#6B7280'}15`,
                                borderColor: `${statusOption?.color || '#6B7280'}30`,
                                color: statusOption?.color || '#6B7280'
                              }}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full animate-pulse`} style={{ backgroundColor: statusOption?.color || '#6B7280' }} />
                              <span className="font-medium text-xs">{statusOption?.label || statusValue || 'None'}</span>
                            </div>
                          );
                        })()}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <span className={textMuted}>Priority</span>
                        {(() => {
                          const priorityValue = project.priority_level || project.priority;
                          const priorityOption = PRIORITY_OPTIONS.find(p => p.value === priorityValue);
                          return (
                            <div className={`flex items-center gap-1.5 ${textMain}`}>
                              <Flag size={14} style={{ color: priorityOption?.color || '#6B7280' }} />
                              <span>{priorityOption?.label || priorityValue || 'None'}</span>
                            </div>
                          );
                        })()}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <span className={textMuted}>Lead</span>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 flex items-center justify-center text-[10px] font-bold border border-purple-500/30">
                            {project.lead?.first_name?.[0] || 'U'}
                          </div>
                          <span className={`${textMain} ${hoverText} cursor-pointer transition-colors`}>
                            {project.lead?.display_name || 'Unassigned'}
                          </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm ml-auto">
                        <span className={textMuted}>Timeline</span>
                        <span className={`font-mono text-xs px-2 py-1 rounded ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {project.start_date ? format(new Date(project.start_date), 'MMM d') : '?'} → {project.target_date ? format(new Date(project.target_date), 'MMM d') : '?'}
                        </span>
                    </div>
                  </div>

                  {/* Long Description */}
                  <div className="prose prose-lg max-w-none">
                    <h3 className={`text-lg font-medium ${textMain} mb-4`}>About this project</h3>
                    <p className={`whitespace-pre-line text-lg leading-relaxed ${textSub}`}>
                      {project.description || "No assigned description for this project."}
                    </p>
                  </div>

                  {/* Resources / Links */}
                  <div>
                    <h3 className={`text-sm font-medium ${textMuted} uppercase tracking-wider mb-4`}>Resources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resources.length > 0 ? resources.map((res: ProjectResource, idx: number) => (
                        <a 
                          key={idx}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-3 p-3 rounded-xl border ${borderMain} ${hoverItem} transition-all text-left group ${bgCard}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                            <LinkIcon size={16} />
                          </div>
                          <div>
                            <div className={`text-sm font-medium ${textMain} group-hover:text-blue-500 transition-colors`}>{res.title}</div>
                            <div className={`text-xs ${textMuted} capitalize`}>{res.type}</div>
                          </div>
                        </a>
                      )) : (
                        <div className={`col-span-2 p-8 rounded-xl border border-dashed ${borderSub} text-center`}>
                          <p className={`${textMuted} text-sm`}>No resources added yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
              </motion.div>
            )}

            {activeTab === 'updates' && (
              <motion.div 
                key="updates"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                  <ProjectUpdatesView projectId={project.project_id} />
              </motion.div>
            )}

            {activeTab === 'issues' && (
               <motion.div
                key="issues"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full"
              >
                  <ProjectIssuesView 
                    projectId={project.project_id} 
                    teamId={project.team_id}
                    workspaceSlug={project.workspace?.slug}
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
                  teamId={project.team_id || project.team?.team_id}
                  workspaceSlug={project.workspace?.slug}
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
                  projectKey={project.project_key}
                  workspaceSlug={project.workspace?.slug}
                  sheetsTemplateId={project.workspace?.settings?.google_sheets_template_id}
                  teamId={project.team_id || project.team?.team_id}
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

        {/* RIGHT COLUMN: SIDEBAR */}
        <div className="flex flex-col gap-6">
          
          {/* Progress Chart Card */}
          <div className={`p-5 rounded-2xl border ${borderMain} ${bgCard} shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold ${textMain}`}>Progress</h3>
              <div className="text-xs font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                {progress?.percentage === 100 ? 'Completed' : 'On Track'}
              </div>
            </div>
            
            <div className="h-[140px] w-full -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: isDark ? '#1E2329' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', borderRadius: '8px', color: isDark ? '#fff' : '#000' }}
                    itemStyle={{ color: isDark ? '#fff' : '#000' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completed" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProgress)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={`grid grid-cols-3 gap-2 mt-4 pt-4 border-t ${borderSub}`}>
              <div className="text-center">
                <div className={`text-xs ${textMuted}`}>Scope</div>
                <div className={`text-sm font-medium ${textMain}`}>{progress?.scope || 0}</div>
              </div>
              <div className={`text-center border-l ${borderSub}`}>
                <div className={`text-xs ${textMuted}`}>Started</div>
                <div className="text-sm font-medium text-yellow-500">{progress?.started || 0}</div>
              </div>
              <div className={`text-center border-l ${borderSub}`}>
                <div className={`text-xs ${textMuted}`}>Done</div>
                <div className="text-sm font-medium text-green-500">{progress?.completed || 0}</div>
              </div>
            </div>
          </div>

          {/* Properties Detail Panel */}
          <div className={`p-1 rounded-xl border ${borderMain} ${bgCard} overflow-visible shadow-sm`}>
             <div className={`p-4 border-b ${borderSub} flex items-center justify-between`}>
                <h3 className={`font-medium text-sm ${textSub}`}>Properties</h3>
                {saving && <span className="text-xs text-blue-500">Guardando...</span>}
             </div>
             <div className="p-2 space-y-1">
                {/* Status Row - Editable with Portal */}
                <div className="relative">
                  <button 
                    ref={statusBtnRef}
                    onClick={() => openDropdown('status', statusBtnRef)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg ${hoverItem} transition-colors cursor-pointer group`}
                  >
                    <div className={`flex items-center gap-3 text-sm ${textSub} group-hover:text-gray-500`}>
                       <Circle size={16} />
                       <span>Status</span>
                    </div>
                    <div className="text-sm font-medium px-2 py-0.5 rounded border capitalize"
                      style={{ 
                        backgroundColor: `${STATUS_OPTIONS.find(s => s.value === (project.project_status || project.status))?.color || '#6B7280'}15`,
                        color: STATUS_OPTIONS.find(s => s.value === (project.project_status || project.status))?.color || '#6B7280',
                        borderColor: `${STATUS_OPTIONS.find(s => s.value === (project.project_status || project.status))?.color || '#6B7280'}30`
                      }}>
                       {STATUS_OPTIONS.find(s => s.value === (project.project_status || project.status))?.label || project.project_status || project.status || '—'}
                    </div>
                  </button>
                  {activeDropdown === 'status' && typeof document !== 'undefined' && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed py-1 rounded-xl border shadow-2xl z-[9999]"
                        style={{ 
                          top: dropdownPos.top, 
                          left: dropdownPos.left, 
                          width: dropdownPos.width,
                          backgroundColor: isDark ? '#1E2329' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        }}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateProject('project_status', opt.value)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${hoverItem} text-left`}
                          >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                            <span className={textMain}>{opt.label}</span>
                            {(project.project_status || project.status) === opt.value && <Check size={14} className="ml-auto text-green-500" />}
                          </button>
                        ))}
                      </motion.div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Priority Row - Editable with Portal */}
                <div className="relative">
                  <button 
                    ref={priorityBtnRef}
                    onClick={() => openDropdown('priority', priorityBtnRef)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg ${hoverItem} transition-colors cursor-pointer group`}
                  >
                    <div className={`flex items-center gap-3 text-sm ${textSub} group-hover:text-gray-500`}>
                       <Flag size={16} />
                       <span>Priority</span>
                    </div>
                    <div className={`text-sm font-medium ${textMain} capitalize`}>
                      {PRIORITY_OPTIONS.find(p => p.value === (project.priority_level || project.priority))?.label || project.priority_level || project.priority || '—'}
                    </div>
                  </button>
                  {activeDropdown === 'priority' && typeof document !== 'undefined' && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed py-1 rounded-xl border shadow-2xl z-[9999]"
                        style={{ 
                          top: dropdownPos.top, 
                          left: dropdownPos.left, 
                          width: dropdownPos.width,
                          backgroundColor: isDark ? '#1E2329' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        }}
                      >
                        {PRIORITY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateProject('priority_level', opt.value)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${hoverItem} text-left`}
                          >
                            <Flag size={14} style={{ color: opt.color }} />
                            <span className={textMain}>{opt.label}</span>
                            {(project.priority_level || project.priority) === opt.value && <Check size={14} className="ml-auto text-green-500" />}
                          </button>
                        ))}
                      </motion.div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Lead Row - Editable with Portal */}
                <div className="relative">
                  <button 
                    ref={leadBtnRef}
                    onClick={() => openDropdown('lead', leadBtnRef)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg ${hoverItem} transition-colors cursor-pointer group`}
                  >
                     <div className={`flex items-center gap-3 text-sm ${textSub} group-hover:text-gray-500`}>
                        <User size={16} />
                        <span>Lead</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] text-white">
                           {project.lead?.first_name?.[0] || '?'}
                        </div>
                        <span className={`text-sm ${textMain} truncate max-w-[100px]`}>{project.lead?.display_name || project.lead?.first_name || 'Sin asignar'}</span>
                     </div>
                  </button>
                  {activeDropdown === 'lead' && typeof document !== 'undefined' && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed py-1 rounded-xl border shadow-2xl z-[9999] max-h-64 overflow-y-auto"
                        style={{ 
                          top: dropdownPos.top, 
                          left: dropdownPos.left, 
                          width: 220,
                          backgroundColor: isDark ? '#1E2329' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        }}
                      >
                        <button
                          onClick={() => updateProject('lead_user_id', null)}
                          className={`w-full px-3 py-2 text-sm ${hoverItem} text-left ${textMuted}`}
                        >
                          Sin asignar
                        </button>
                        {users.map(u => (
                          <button
                            key={u.user_id}
                            onClick={() => updateProject('lead_user_id', u.user_id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${hoverItem} text-left`}
                          >
                            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[9px] text-white">
                              {u.first_name?.[0] || '?'}
                            </div>
                            <span className={textMain}>{u.display_name || `${u.first_name} ${u.last_name_paternal}`}</span>
                            {project.lead?.user_id === u.user_id && <Check size={14} className="ml-auto text-green-500" />}
                          </button>
                        ))}
                      </motion.div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Dates Row - Editable with Portal Calendar */}
                <div className="relative">
                  <button 
                    ref={dateBtnRef}
                    onClick={() => openDropdown('date', dateBtnRef)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg ${hoverItem} transition-colors cursor-pointer group`}
                  >
                     <div className={`flex items-center gap-3 text-sm ${textSub} group-hover:text-gray-500`}>
                        <Calendar size={16} />
                        <span>Target Date</span>
                     </div>
                     <div className={`text-sm ${textMain} font-mono opacity-80 decoration-dotted underline underline-offset-4`}>
                        {project.target_date ? format(new Date(project.target_date), 'MMM d, yyyy') : '—'}
                     </div>
                  </button>
                  {activeDropdown === 'date' && typeof document !== 'undefined' && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed p-4 rounded-xl border shadow-2xl z-[9999]"
                        style={{ 
                          top: dropdownPos.top, 
                          left: dropdownPos.left - 80, 
                          width: 280,
                          backgroundColor: isDark ? '#1E2329' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        }}
                      >
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={() => setCalendarMonth(d => addDays(startOfMonth(d), -1))} className={`p-1 rounded ${hoverItem}`}>
                            <ChevronLeft size={16} className={textSub} />
                          </button>
                          <span className={`text-sm font-medium ${textMain}`}>
                            {format(calendarMonth, 'MMMM yyyy', { locale: es })}
                          </span>
                          <button onClick={() => setCalendarMonth(d => addDays(endOfMonth(d), 1))} className={`p-1 rounded ${hoverItem}`}>
                            <ChevronLeft size={16} className={`${textSub} rotate-180`} />
                          </button>
                        </div>
                        {/* Week Days */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['L','M','X','J','V','S','D'].map(d => (
                            <div key={d} className={`text-center text-xs ${textMuted}`}>{d}</div>
                          ))}
                        </div>
                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {eachDayOfInterval({ 
                            start: startOfMonth(calendarMonth), 
                            end: endOfMonth(calendarMonth) 
                          }).map(day => {
                            const isSelected = project.target_date && isSameDay(new Date(project.target_date), day);
                            return (
                              <button
                                key={day.toISOString()}
                                onClick={() => {
                                  updateProject('target_date', format(day, 'yyyy-MM-dd'));
                                }}
                                className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-colors
                                  ${isSelected ? 'bg-blue-500 text-white' : `${hoverItem} ${textMain}`}
                                `}
                              >
                                {format(day, 'd')}
                              </button>
                            );
                          })}
                        </div>
                        {/* Quick Options */}
                        <div className={`mt-3 pt-3 border-t ${borderSub} flex gap-2`}>
                          <button 
                            onClick={() => updateProject('target_date', null)}
                            className={`flex-1 py-1.5 text-xs rounded ${hoverItem} ${textMuted}`}
                          >
                            Limpiar
                          </button>
                          <button 
                            onClick={() => updateProject('target_date', format(new Date(), 'yyyy-MM-dd'))}
                            className="flex-1 py-1.5 text-xs rounded bg-blue-500/10 text-blue-500"
                          >
                            Hoy
                          </button>
                        </div>
                      </motion.div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Team Row - Editable with Portal */}
                <div className="relative">
                  <button 
                    ref={teamBtnRef}
                    onClick={() => openDropdown('team', teamBtnRef)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg ${hoverItem} transition-colors cursor-pointer group`}
                  >
                     <div className={`flex items-center gap-3 text-sm ${textSub} group-hover:text-gray-500`}>
                        <Users size={16} />
                        <span>Team</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.team?.color || 'gray' }} />
                        <span className={`text-sm ${textMain}`}>{project.team?.name || '—'}</span>
                     </div>
                  </button>
                  {activeDropdown === 'team' && typeof document !== 'undefined' && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed py-1 rounded-xl border shadow-2xl z-[9999] max-h-64 overflow-y-auto"
                        style={{ 
                          top: dropdownPos.top, 
                          left: dropdownPos.left, 
                          width: 220,
                          backgroundColor: isDark ? '#1E2329' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        }}
                      >
                        <button
                          onClick={() => updateProject('team_id', null)}
                          className={`w-full px-3 py-2 text-sm ${hoverItem} text-left ${textMuted}`}
                        >
                          Sin equipo
                        </button>
                        {teams.map(t => {
                          const teamIdValue = t.id || t.team_id;
                          return (
                            <button
                              key={teamIdValue}
                              onClick={() => updateProject('team_id', teamIdValue)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${hoverItem} text-left`}
                            >
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                              <span className={textMain}>{t.name}</span>
                              {(project.team?.team_id || project.team_id) === teamIdValue && <Check size={14} className="ml-auto text-green-500" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>,
                    document.body
                  )}
                </div>
             </div>
          </div>

          {/* Milestones Panel */}
          <div className={`p-1 rounded-xl border ${borderMain} ${bgCard} shadow-sm`}>
            <div className={`p-4 border-b ${borderSub} flex items-center justify-between`}>
                <h3 className={`font-medium text-sm ${textSub}`}>Milestones</h3>
                <button className={`${textSub} ${hoverText} transition-colors`}><Plus size={16} /></button>
             </div>
             <div className="max-h-[300px] overflow-y-auto">
               {(project.milestones && project.milestones.length > 0) ? project.milestones.map((m) => (
                 <div key={m.milestone_id} className={`p-3 border-b ${borderSub} last:border-0 ${hoverItem} transition-colors cursor-pointer flex items-center gap-3`}>
                   <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${m.milestone_status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-400'}`} />
                   <div className="flex-1 min-w-0">
                     <div className={`text-sm ${textMain} truncate`}>{m.milestone_name}</div>
                     <div className={`text-xs ${textMuted}`}>{m.due_date ? format(new Date(m.due_date), 'MMM d') : 'No date'}</div>
                   </div>
                 </div>
               )) : (
                 <div className={`p-6 text-center text-sm ${textMuted} italic`}>
                   No milestones yet.
                   <br/>
                   <span className="text-blue-500 cursor-pointer hover:underline text-xs">Add your first milestone</span>
                 </div>
               )}
             </div>
          </div>

        </div>

      </div>
    </div>
  );
}
