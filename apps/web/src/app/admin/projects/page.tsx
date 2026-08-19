'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { CreateProjectModal } from '@/components/admin/projects/CreateProjectModal';
import { api } from '@/lib/api/client';

// Components
import { DisplaySettings, ViewType } from '@/components/admin/projects/DisplaySettings';
import { ProjectListView } from '@/components/admin/projects/views/ProjectListView';
import { ProjectBoardView } from '@/components/admin/projects/views/ProjectBoardView';
import { ProjectTimelineView } from '@/components/admin/projects/views/ProjectTimelineView';

import { 
  Search, Filter, Plus, ChevronLeft, ChevronRight, RefreshCw, 
  LayoutGrid, List, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';

// ============================================
// TYPES (Main Definition)
// ============================================
interface RawProjectApiRow {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  icon_name?: string;
  icon_color?: string;
  health_status?: 'on_track' | 'at_risk' | 'off_track' | 'none';
  priority_level?: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  project_status?: string;
  lead_user_id?: string | null;
  lead_display_name?: string | null;
  lead_first_name?: string | null;
  lead_last_name?: string | null;
  lead_avatar_url?: string | null;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  completion_percentage?: number;
  progress_history?: { value: number }[];
  team_name?: string;
}

// Ajustado para coincidir con lo que esperan las views
export interface Project {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  icon_name: string;
  icon_color: string;
  health_status: 'on_track' | 'at_risk' | 'off_track' | 'none';
  priority_level: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  project_status: string; // planning, active, etc.
  lead?: {
    id: string;
    name: string;
    avatar?: string;
    initials: string;
    color: string;
  };
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  completion_percentage: number;
  progress_history: { value: number }[];
  team_name?: string;
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function ProjectsPage() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'projects' | 'all' | 'new'>('projects');
  const [currentView, setCurrentView] = useState<ViewType>('list'); // Default view
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Display Settings State
  const [grouping, setGrouping] = useState<'none' | 'status' | 'priority'>('none');
  const [ordering, setOrdering] = useState<'manual' | 'alphabetical' | 'newest'>('newest');
  const [showClosed, setShowClosed] = useState<'all' | 'active' | 'closed'>('all');
  const [showCycles, setShowCycles] = useState(false);

  const displayTriggerRef = useRef<HTMLButtonElement>(null);

  // Detectar parámetro ?create=true para abrir el modal automáticamente
  useEffect(() => {
    const shouldCreate = searchParams.get('create') === 'true';
    if (shouldCreate) {
      setShowCreateModal(true);
      // Limpiar el parámetro de la URL sin recargar la página
      router.replace('/admin/projects', { scroll: false });
    }
  }, [searchParams, router]);

  // Helper colors/initials (duplicated logic for fetch transform)
  const getInitials = (name: string): string => {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getColorFromName = (name: string): string => {
    const colors = ['#00D4B3', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const generateFallbackSparkline = (progress: number) => {
    const points: { value: number }[] = [];
    let current = 0;
    for (let i = 0; i < 12; i++) {
        current = Math.min(100, current + Math.random() * (progress / 6));
        points.push({ value: Math.round(current) });
    }
    if (points.length > 0) points[points.length - 1].value = progress;
    return points;
  };

  // Fetch Logic
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      const { data, error: apiError } = await api.get<{ projects: RawProjectApiRow[] }>(`/api/admin/projects?${params.toString()}`);

      if (apiError || !data) throw new Error('Error al cargar proyectos');

      const transformedProjects: Project[] = data.projects.map((p: RawProjectApiRow) => ({
        project_id: p.project_id,
        project_key: p.project_key,
        project_name: p.project_name,
        project_description: p.project_description,
        icon_name: p.icon_name || 'folder',
        icon_color: p.icon_color || '#3B82F6',
        health_status: p.health_status || 'none',
        priority_level: p.priority_level || 'none',
        project_status: p.project_status || 'planning',
        lead: p.lead_user_id ? {
          id: p.lead_user_id,
          name: p.lead_display_name || `${p.lead_first_name || ''} ${p.lead_last_name || ''}`.trim(),
          initials: getInitials(p.lead_display_name || `${p.lead_first_name || ''} ${p.lead_last_name || ''}`),
          color: getColorFromName(p.lead_display_name || p.lead_first_name || 'User'),
          avatar: p.lead_avatar_url ?? undefined
        } : undefined,
        start_date: p.start_date,
        target_date: p.target_date,
        created_at: p.created_at,
        completion_percentage: p.completion_percentage || 0,
        progress_history: p.progress_history || generateFallbackSparkline(p.completion_percentage || 0),
        team_name: p.team_name
      }));
      
      setProjects(transformedProjects);
      setError(null);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Client-side processing (Filtering and Sorting)
  const processedProjects = React.useMemo(() => {
    let result = [...projects];

    if (showClosed === 'active') {
      result = result.filter(p => p.project_status !== 'completed' && p.project_status !== 'cancelled' && p.project_status !== 'archived');
    } else if (showClosed === 'closed') {
      result = result.filter(p => p.project_status === 'completed' || p.project_status === 'cancelled' || p.project_status === 'archived');
    }

    if (ordering === 'alphabetical') {
      result.sort((a, b) => a.project_name.localeCompare(b.project_name));
    } else if (ordering === 'newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [projects, showClosed, ordering]);

  useEffect(() => {
    const timeoutId = setTimeout(fetchProjects, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchProjects]);

  // Render Area
  const renderActiveView = () => {
    switch(currentView) {
      case 'list':
        return (
          <ProjectListView 
            projects={processedProjects} 
            loading={loading} 
            error={error} 
            onRefresh={fetchProjects} 
            grouping={grouping}
            showCycles={showCycles}
          />
        );
      case 'board':
        return <ProjectBoardView projects={processedProjects} />;
      case 'timeline':
        return <ProjectTimelineView projects={processedProjects} />;
      default:
        return null;
    }
  };

  return (
    <div className="-m-6 flex flex-col h-screen" style={{ backgroundColor: 'transparent' }}>
      {/* Header Fijo */}
      <div 
        className="shrink-0 border-b z-20 sticky top-0"
        style={{ 
          backgroundColor: isDark ? 'rgba(15, 20, 25, 0.95)' : colors.bgPrimary,
          backdropFilter: 'blur(8px)',
          borderColor: colors.border 
        }}
      >
        {/* Top Bar: Navegación y Título */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
                <ChevronLeft size={18} />
              </button>
              <button disabled className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-600 cursor-not-allowed">
                <ChevronRight size={18} />
              </button>
            </div>

            <button onClick={() => fetchProjects()} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400">
                <RefreshCw size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-gray-200">
             <LayoutGrid size={20} />
             <span className="text-lg font-semibold">Projects</span>
          </div>

          <div className="w-20" /> {/* Spacer for centering */}
        </div>

        {/* Toolbar: Tabs y Acciones */}
        <div className="flex items-center justify-between px-6 pb-3">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('projects')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'projects' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Projects
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-current opacity-60" />
              All projects
            </button>
          </div>

          <div className="flex items-center gap-2 relative">
             {/* Add Project */}
             <button 
               onClick={() => setShowCreateModal(true)}
               className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:brightness-110 shadow-sm"
               style={{ backgroundColor: '#00D4B3', color: '#0A0D12' }}
             >
               <Plus size={16} strokeWidth={2.5} />
               Add project
             </button>

             <div className="w-px h-6 bg-white/10 mx-1" />

             {/* Display Button */}
             <div className="relative">
                <button 
                  ref={displayTriggerRef}
                  onClick={() => setIsDisplaySettingsOpen(!isDisplaySettingsOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      isDark 
                        ? (isDisplaySettingsOpen ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5')
                        : (isDisplaySettingsOpen ? 'bg-gray-200 border-gray-300 text-gray-900' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900')
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  Display
                </button>

                {/* Dropdown Menu */}
                <DisplaySettings 
                    isOpen={isDisplaySettingsOpen} 
                    onClose={() => setIsDisplaySettingsOpen(false)}
                    currentView={currentView}
                    onViewChange={(view) => {
                        setCurrentView(view);
                    }}
                    triggerRef={displayTriggerRef}
                    grouping={grouping}
                    onGroupingChange={setGrouping}
                    ordering={ordering}
                    onOrderingChange={setOrdering}
                    showClosed={showClosed}
                    onShowClosedChange={setShowClosed}
                    showCycles={showCycles}
                    onShowCyclesChange={setShowCycles}
                />
             </div>
          </div>
        </div>

        {/* Filter Bar (Solo visible en List View quizás? Dejémoslo global) */}
        <div className="flex items-center gap-3 px-6 pb-3 border-t border-white/5 pt-3">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
             <Filter size={14} />
             Filter
          </button>
          
          <div className="relative flex-1 max-w-xs">
             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
             <input
               type="text"
               placeholder="Search projects..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm bg-transparent border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
             />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div 
        className="flex-1 overflow-auto p-6 transition-colors"
        style={{ backgroundColor: isDark ? '#0F1419' : '#F3F4F6' }} // Dark: Dark blue/gray, Light: Gray-100
      >
         {renderActiveView()}
      </div>

      {/* Modal */}
      <CreateProjectModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchProjects();
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}
