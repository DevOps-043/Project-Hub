'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CircleCheck, CircleDot, FilterX, FolderKanban, LayoutGrid, Plus,
  RefreshCw, Search, ShieldAlert, SlidersHorizontal,
} from 'lucide-react';
import { getPanelPathForRole, useOptionalWorkspace } from '@/contexts/WorkspaceContext';
import { api } from '@/lib/api/client';
import { CreateProjectModal } from '@/components/admin/projects/CreateProjectModal';
import { DisplaySettings, type ViewType } from '@/components/admin/projects/DisplaySettings';
import { ProjectListView } from '@/components/admin/projects/views/ProjectListView';
import { ProjectBoardView } from '@/components/admin/projects/views/ProjectBoardView';
import { ProjectTimelineView } from '@/components/admin/projects/views/ProjectTimelineView';
import {
  CollectionToolbar, MetricStrip, PageHero, PageSection, ProductPage, ToolbarGroup,
  productControlClass, productIconControlClass, productInputClass,
  productInputIconClass, productInputWrapClass, type ProductMetric,
} from '@/components/product';
import styles from './ProjectsListContent.module.css';

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

export interface Project {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  icon_name: string;
  icon_color: string;
  health_status: 'on_track' | 'at_risk' | 'off_track' | 'none';
  priority_level: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  project_status: string;
  lead?: { id: string; name: string; avatar?: string; initials: string; color: string };
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  completion_percentage: number;
  progress_history: { value: number }[];
  team_name?: string;
}

interface ProjectsListContentProps { globalAdmin?: boolean; }

const avatarPalette = ['#00D4B3', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : (name.slice(0, 2) || '??').toUpperCase();
}

function getColorFromName(name: string) {
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}

function fallbackSparkline(progress: number) {
  return Array.from({ length: 12 }, (_, index) => ({ value: Math.round(progress * ((index + 1) / 12)) }));
}

function normalizeProject(project: RawProjectApiRow): Project {
  const leadName = project.lead_display_name || `${project.lead_first_name || ''} ${project.lead_last_name || ''}`.trim();
  return {
    project_id: project.project_id,
    project_key: project.project_key,
    project_name: project.project_name,
    project_description: project.project_description,
    icon_name: project.icon_name || 'folder',
    icon_color: project.icon_color || '#3B82F6',
    health_status: project.health_status || 'none',
    priority_level: project.priority_level || 'none',
    project_status: project.project_status || 'planning',
    lead: project.lead_user_id ? {
      id: project.lead_user_id,
      name: leadName,
      initials: getInitials(leadName),
      color: getColorFromName(leadName || 'User'),
      avatar: project.lead_avatar_url || undefined,
    } : undefined,
    start_date: project.start_date,
    target_date: project.target_date,
    created_at: project.created_at,
    completion_percentage: project.completion_percentage || 0,
    progress_history: project.progress_history || fallbackSparkline(project.completion_percentage || 0),
    team_name: project.team_name,
  };
}

export function ProjectsListContent({ globalAdmin = false }: ProjectsListContentProps) {
  const workspaceContext = useOptionalWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = workspaceContext?.workspace;
  const canManage = globalAdmin || !workspaceContext || workspaceContext.permissions.manageProjects;
  const basePath = globalAdmin || !workspaceContext ? '/admin' : getPanelPathForRole(workspace!.slug, workspaceContext.userRole);
  const projectsEndpoint = globalAdmin || !workspace ? '/api/admin/projects' : `/api/workspaces/${workspace.slug}/projects`;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<string>();
  const [grouping, setGrouping] = useState<'none' | 'status' | 'priority'>('none');
  const [ordering, setOrdering] = useState<'manual' | 'alphabetical' | 'newest'>('newest');
  const [showClosed, setShowClosed] = useState<'all' | 'active' | 'closed'>('all');
  const [showCycles, setShowCycles] = useState(false);
  const displayTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (searchParams.get('create') !== 'true') return;
    setShowCreateModal(true);
    router.replace(`${basePath}/projects`, { scroll: false });
  }, [basePath, router, searchParams]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const response = await api.get<{ projects: RawProjectApiRow[] }>(`${projectsEndpoint}?${params.toString()}`);
      if (response.error || !response.data) throw new Error('No fue posible cargar los proyectos.');
      setProjects(response.data.projects.map(normalizeProject));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar los proyectos.');
    } finally {
      setLoading(false);
    }
  }, [projectsEndpoint, searchQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchProjects, 280);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProjects]);

  const processedProjects = useMemo(() => {
    let result = [...projects];
    const query = searchQuery.trim().toLocaleLowerCase('es-MX');
    if (query) result = result.filter((project) => [project.project_name, project.project_key, project.team_name].some((value) => value?.toLocaleLowerCase('es-MX').includes(query)));
    if (activeTab === 'active' || showClosed === 'active') result = result.filter((project) => !['completed', 'cancelled', 'archived'].includes(project.project_status));
    if (showClosed === 'closed') result = result.filter((project) => ['completed', 'cancelled', 'archived'].includes(project.project_status));
    if (ordering === 'alphabetical') result.sort((a, b) => a.project_name.localeCompare(b.project_name, 'es'));
    if (ordering === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [activeTab, ordering, projects, searchQuery, showClosed]);

  const metrics: ProductMetric[] = [
    { label: 'Total', value: projects.length, hint: 'proyectos visibles', icon: FolderKanban },
    { label: 'Activos', value: projects.filter((project) => !['completed', 'cancelled', 'archived'].includes(project.project_status)).length, hint: 'en ejecución', icon: CircleDot, tone: 'info' },
    { label: 'Completados', value: projects.filter((project) => project.project_status === 'completed').length, hint: 'objetivos cerrados', icon: CircleCheck, tone: 'success' },
    { label: 'En riesgo', value: projects.filter((project) => ['at_risk', 'off_track'].includes(project.health_status)).length, hint: 'requieren atención', icon: ShieldAlert, tone: 'warning' },
  ];

  const resetFilters = () => { setSearchQuery(''); setActiveTab('all'); setShowClosed('all'); };
  const hasFilters = Boolean(searchQuery) || activeTab !== 'all' || showClosed !== 'all';

  return (
    <ProductPage>
      <PageHero
        eyebrow="Portafolio operativo"
        title="Proyectos"
        description="Planifica, prioriza y consulta el avance de todas las iniciativas desde una sola colección."
        icon={LayoutGrid}
        actions={<>
          <button type="button" onClick={fetchProjects} disabled={loading}><RefreshCw className={loading ? styles.spinning : ''} size={16} aria-hidden="true" /> Actualizar</button>
          {canManage ? <button type="button" onClick={() => { setCreateModalStatus(undefined); setShowCreateModal(true); }}><Plus size={16} aria-hidden="true" /> Crear proyecto</button> : null}
        </>}
      />

      <MetricStrip metrics={metrics} />

      <PageSection title="Colección de proyectos" description={`${processedProjects.length} ${processedProjects.length === 1 ? 'proyecto coincide' : 'proyectos coinciden'} con la vista actual.`}>
        <CollectionToolbar>
          <ToolbarGroup>
            <div className={styles.segmented} aria-label="Estado de proyectos">
              <button type="button" data-active={activeTab === 'active' ? 'true' : 'false'} onClick={() => setActiveTab('active')}>Activos</button>
              <button type="button" data-active={activeTab === 'all' ? 'true' : 'false'} onClick={() => setActiveTab('all')}>Todos</button>
            </div>
            <div className={productInputWrapClass}>
              <Search className={productInputIconClass} size={16} aria-hidden="true" />
              <input className={productInputClass} type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar por nombre, clave o equipo" aria-label="Buscar proyectos" />
            </div>
          </ToolbarGroup>
          <ToolbarGroup>
            {hasFilters ? <button type="button" className={productControlClass} onClick={resetFilters}><FilterX size={15} aria-hidden="true" /> Limpiar</button> : null}
            <div className={styles.displayControl}>
              <button ref={displayTriggerRef} type="button" className={productIconControlClass} onClick={() => setIsDisplaySettingsOpen((current) => !current)} aria-label="Configurar visualización" aria-expanded={isDisplaySettingsOpen}>
                <SlidersHorizontal size={16} aria-hidden="true" />
              </button>
              <DisplaySettings
                isOpen={isDisplaySettingsOpen} onClose={() => setIsDisplaySettingsOpen(false)} currentView={currentView} onViewChange={setCurrentView}
                triggerRef={displayTriggerRef} grouping={grouping} onGroupingChange={setGrouping} ordering={ordering} onOrderingChange={setOrdering}
                showClosed={showClosed} onShowClosedChange={setShowClosed} showCycles={showCycles} onShowCyclesChange={setShowCycles}
              />
            </div>
          </ToolbarGroup>
        </CollectionToolbar>

        <div className={styles.collection}>
          {currentView === 'list' ? <ProjectListView projects={processedProjects} loading={loading} error={error} onRefresh={fetchProjects} basePath={basePath} grouping={grouping} showCycles={showCycles} /> : null}
          {currentView === 'board' ? <ProjectBoardView projects={processedProjects} basePath={basePath} onAddProject={canManage ? (status) => { setCreateModalStatus(status); setShowCreateModal(true); } : undefined} /> : null}
          {currentView === 'timeline' ? <ProjectTimelineView projects={processedProjects} basePath={basePath} /> : null}
        </div>
      </PageSection>

      {canManage ? <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateModalStatus(undefined); }}
        onSuccess={() => { fetchProjects(); setShowCreateModal(false); setCreateModalStatus(undefined); }}
        initialStatus={createModalStatus}
        workspaceSlug={globalAdmin ? undefined : workspace?.slug}
      /> : null}
    </ProductPage>
  );
}
