/**
 * Servicio de datos Project Hub para gestión de proyectos
 * 
 * Este servicio encapsula las operaciones CRUD contra la Supabase de Project Hub
 * y puede ser utilizado tanto por el Project Hub (web) como por la
 * extensión SOFLIA para leer/escribir proyectos.
 * 
 * Sigue el patrón de guard pattern: toda función empieza verificando
 * que el cliente esté configurado antes de intentar operar.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IRIS_SUPABASE, isValidUrl } from '@/lib/supabase/config';

// ── Tipos para tablas de Project Hub ──

export interface IrisProject {
  project_id: string;
  name: string;
  description: string | null;
  identifier: string;
  team_id: string | null;
  creator_id: string;
  lead_id: string | null;
  status: 'active' | 'archived' | 'completed' | 'cancelled';
  network: 'public' | 'private';
  cover_image: string | null;
  emoji: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface IrisIssue {
  issue_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status_id: string | null;
  priority_id: string | null;
  assignee_id: string | null;
  creator_id: string;
  parent_issue_id: string | null;
  cycle_id: string | null;
  milestone_id: string | null;
  sequence_number: number;
  estimate_points: number | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface IrisCycle {
  cycle_id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
}

export interface IrisMilestone {
  milestone_id: string;
  project_id: string;
  name: string;
  description: string | null;
  target_date: string | null;
  status: 'active' | 'completed';
  created_at: string;
}

export interface IrisTeam {
  team_id: string;
  name: string;
  identifier: string;
  description: string | null;
  created_at: string;
}

export interface IrisLabel {
  label_id: string;
  project_id: string | null;
  name: string;
  color: string;
  created_at: string;
}

// ── Cliente Project Hub (Client-side) ──

let _irisClient: SupabaseClient | null = null;

function getIrisClient(): SupabaseClient | null {
  if (_irisClient) return _irisClient;

  const irisUrl = isValidUrl(IRIS_SUPABASE.URL) ? IRIS_SUPABASE.URL : '';
  const irisKey = IRIS_SUPABASE.ANON_KEY || '';

  if (!irisUrl || !irisKey) return null;

  _irisClient = createClient(irisUrl, irisKey, {
    auth: {
      storageKey: 'iris-project-token',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return _irisClient;
}

function isIrisConfigured(): boolean {
  return (
    IRIS_SUPABASE.URL !== '' &&
    IRIS_SUPABASE.ANON_KEY !== '' &&
    isValidUrl(IRIS_SUPABASE.URL)
  );
}

// ═══════════════════════════════════════════════════════════
// Proyectos
// ═══════════════════════════════════════════════════════════

export async function getProjects(teamId?: string): Promise<IrisProject[]> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return [];

  let query = iris
    .from('pm_projects')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  
  if (teamId) query = query.eq('team_id', teamId);

  const { data, error } = await query;
  if (error) {
    console.error('[Project Hub] Error obteniendo proyectos:', error);
    return [];
  }
  return data || [];
}

export async function getProjectById(projectId: string): Promise<IrisProject | null> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return null;

  const { data, error } = await iris
    .from('pm_projects')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error) return null;
  return data;
}

export async function createProject(project: Partial<IrisProject>): Promise<IrisProject | null> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return null;

  const { data, error } = await iris
    .from('pm_projects')
    .insert(project)
    .select()
    .single();

  if (error) {
    console.error('[Project Hub] Error creando proyecto:', error);
    return null;
  }
  return data;
}

export async function updateProject(
  projectId: string, 
  updates: Partial<IrisProject>
): Promise<IrisProject | null> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return null;

  const { data, error } = await iris
    .from('pm_projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .select()
    .single();

  if (error) {
    console.error('[Project Hub] Error actualizando proyecto:', error);
    return null;
  }
  return data;
}

export async function archiveProject(projectId: string): Promise<IrisProject | null> {
  return updateProject(projectId, { 
    archived_at: new Date().toISOString(),
    status: 'archived',
  });
}

// ═══════════════════════════════════════════════════════════
// Issues (Tareas)
// ═══════════════════════════════════════════════════════════

export async function getIssues(
  projectId: string, 
  filters?: { 
    status_id?: string; 
    assignee_id?: string; 
    cycle_id?: string;
    milestone_id?: string;
  }
): Promise<IrisIssue[]> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return [];

  let query = iris
    .from('task_issues')
    .select('*')
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('sequence_number', { ascending: true });

  if (filters?.status_id) query = query.eq('status_id', filters.status_id);
  if (filters?.assignee_id) query = query.eq('assignee_id', filters.assignee_id);
  if (filters?.cycle_id) query = query.eq('cycle_id', filters.cycle_id);
  if (filters?.milestone_id) query = query.eq('milestone_id', filters.milestone_id);

  const { data, error } = await query;
  if (error) {
    console.error('[Project Hub] Error obteniendo issues:', error);
    return [];
  }
  return data || [];
}

export async function getIssueById(issueId: string): Promise<IrisIssue | null> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return null;

  const { data, error } = await iris
    .from('task_issues')
    .select('*')
    .eq('issue_id', issueId)
    .single();

  if (error) return null;
  return data;
}

export async function createIssue(issue: Partial<IrisIssue>): Promise<IrisIssue | null> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return null;

  const { data, error } = await iris
    .from('task_issues')
    .insert(issue)
    .select()
    .single();

  if (error) {
    console.error('[Project Hub] Error creando issue:', error);
    return null;
  }
  return data;
}

export async function updateIssue(
  issueId: string, 
  updates: Partial<IrisIssue>
): Promise<IrisIssue | null> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return null;

  const { data, error } = await iris
    .from('task_issues')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('issue_id', issueId)
    .select()
    .single();

  if (error) {
    console.error('[Project Hub] Error actualizando issue:', error);
    return null;
  }
  return data;
}

export async function archiveIssue(issueId: string): Promise<IrisIssue | null> {
  return updateIssue(issueId, { archived_at: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════
// Ciclos
// ═══════════════════════════════════════════════════════════

export async function getCycles(projectId: string): Promise<IrisCycle[]> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return [];

  const { data, error } = await iris
    .from('pm_cycles')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date', { ascending: false });

  if (error) return [];
  return data || [];
}

// ═══════════════════════════════════════════════════════════
// Milestones
// ═══════════════════════════════════════════════════════════

export async function getMilestones(projectId: string): Promise<IrisMilestone[]> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return [];

  const { data, error } = await iris
    .from('pm_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('target_date', { ascending: true });

  if (error) return [];
  return data || [];
}

// ═══════════════════════════════════════════════════════════
// Equipos
// ═══════════════════════════════════════════════════════════

export async function getTeams(): Promise<IrisTeam[]> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return [];

  const { data, error } = await iris
    .from('pm_teams')
    .select('*')
    .order('name', { ascending: true });

  if (error) return [];
  return data || [];
}

// ═══════════════════════════════════════════════════════════
// Labels
// ═══════════════════════════════════════════════════════════

export async function getLabels(projectId?: string): Promise<IrisLabel[]> {
  const iris = getIrisClient();
  if (!iris || !isIrisConfigured()) return [];

  let query = iris.from('pm_labels').select('*');
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query.order('name', { ascending: true });
  if (error) return [];
  return data || [];
}

// Exportar helpers de configuración
export { isIrisConfigured };
