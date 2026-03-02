import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase con service role para acceso completo
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ProjectResponse {
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
  tags: string[];
  // Joined fields
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_display_name: string | null;
  lead_avatar_url: string | null;
  team_name: string | null;
  team_color: string | null;
  member_count: number;
  milestone_count: number;
  // Progress history for sparkline
  progress_history: { value: number }[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const health = searchParams.get('health');
    const teamId = searchParams.get('team_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let finalTeamId = teamId;
    if (teamId) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
      if (!isUUID) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('team_id')
          .or(`slug.eq.${teamId},name.eq.${teamId}`)
          .single();
        if (teamData) finalTeamId = teamData.team_id;
      }
    }

    // Intentar usar la vista primero, si no existe usar query directa
    let projects: any[] = [];
    let useView = true;

    // Primero intentamos con la vista
    let query = supabase
      .from('v_projects_summary')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros
    if (search) {
      query = query.or(`project_name.ilike.%${search}%,project_description.ilike.%${search}%,project_key.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('project_status', status);
    }

    if (priority) {
      query = query.eq('priority_level', priority);
    }

    if (health) {
      query = query.eq('health_status', health);
    }

    if (finalTeamId) {
      query = query.eq('team_id', finalTeamId);
    }

    const { data: viewData, error: viewError } = await query;

    if (viewError) {
      console.log('Vista no disponible, usando query directa:', viewError.message);
      useView = false;
      
      // Query directa a la tabla pm_projects con JOINs
      let directQuery = supabase
        .from('pm_projects')
        .select(`
          *,
          lead:account_users!pm_projects_lead_user_id_fkey(
            user_id,
            first_name,
            last_name_paternal,
            display_name,
            avatar_url
          ),
          team:teams!pm_projects_team_id_fkey(
            team_id,
            name,
            color
          )
        `)
        .neq('project_status', 'archived')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        directQuery = directQuery.or(`project_name.ilike.%${search}%,project_description.ilike.%${search}%,project_key.ilike.%${search}%`);
      }

      if (status) {
        directQuery = directQuery.eq('project_status', status);
      }

      if (priority) {
        directQuery = directQuery.eq('priority_level', priority);
      }

      if (health) {
        directQuery = directQuery.eq('health_status', health);
      }

      if (teamId) {
        directQuery = directQuery.eq('team_id', teamId);
      }

      const { data: directData, error: directError } = await directQuery;

      if (directError) {
        console.error('Error fetching projects:', directError);
        return NextResponse.json(
          { error: 'Error al obtener proyectos', details: directError.message },
          { status: 500 }
        );
      }

      // Transformar datos del query directo al formato esperado
      projects = (directData || []).map((p: any) => ({
        project_id: p.project_id,
        project_key: p.project_key,
        project_name: p.project_name,
        project_description: p.project_description,
        icon_name: p.icon_name,
        icon_color: p.icon_color,
        project_status: p.project_status,
        health_status: p.health_status,
        priority_level: p.priority_level,
        completion_percentage: p.completion_percentage,
        start_date: p.start_date,
        target_date: p.target_date,
        team_id: p.team_id,
        lead_user_id: p.lead_user_id,
        created_at: p.created_at,
        updated_at: p.updated_at,
        tags: p.tags,
        // Campos del JOIN
        lead_first_name: p.lead?.first_name || null,
        lead_last_name: p.lead?.last_name_paternal || null,
        lead_display_name: p.lead?.display_name || null,
        lead_avatar_url: p.lead?.avatar_url || null,
        team_name: p.team?.name || null,
        team_color: p.team?.color || null,
        member_count: 0,
        milestone_count: 0
      }));
    } else {
      projects = viewData || [];
    }

    // Obtener historial de progreso para cada proyecto (para sparklines)
    const projectsWithHistory = await Promise.all(
      projects.map(async (project) => {
        const { data: historyData } = await supabase
          .from('pm_project_progress_history')
          .select('completion_percentage, recorded_at')
          .eq('project_id', project.project_id)
          .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('recorded_at', { ascending: true })
          .limit(12);

        // Si no hay historial, generar puntos basados en el progreso actual
        let progressHistory: { value: number }[] = [];
        
        if (historyData && historyData.length > 0) {
          progressHistory = historyData.map(h => ({ value: h.completion_percentage }));
        } else {
          // Generar datos sintéticos para sparkline basados en el progreso actual
          const progress = project.completion_percentage || 0;
          progressHistory = generateSparklineData(progress);
        }

        return {
          ...project,
          progress_history: progressHistory
        };
      })
    );

    // Obtener conteo total
    const { count } = await supabase
      .from('pm_projects')
      .select('*', { count: 'exact', head: true })
      .neq('project_status', 'archived');

    return NextResponse.json({
      projects: projectsWithHistory,
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error in projects API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      project_name,
      project_description,
      icon_name = 'folder',
      icon_color = '#3B82F6',
      priority_level = 'medium',
      start_date,
      target_date,
      team_id,
      lead_user_id,
      created_by_user_id,
      workspace_id: explicit_workspace_id,
      tags = []
    } = body;

    // Validar campos requeridos
    if (!project_name || !created_by_user_id) {
      return NextResponse.json(
        { error: 'Nombre del proyecto y usuario creador son requeridos' },
        { status: 400 }
      );
    }

    // Resolver workspace_id: usar el explícito, o derivar del team si existe
    let resolved_workspace_id = explicit_workspace_id || null;
    if (!resolved_workspace_id && team_id) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('workspace_id')
        .eq('team_id', team_id)
        .single();
      if (teamData?.workspace_id) {
        resolved_workspace_id = teamData.workspace_id;
      }
    }

    // Generar project_key único
    const prefix = project_name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
    const { count } = await supabase
      .from('pm_projects')
      .select('*', { count: 'exact', head: true });

    const projectKey = `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`;

    // Insertar proyecto
    const { data: newProject, error: insertError } = await supabase
      .from('pm_projects')
      .insert({
        project_key: projectKey,
        project_name,
        project_description,
        icon_name,
        icon_color,
        priority_level,
        start_date,
        target_date,
        team_id,
        lead_user_id,
        created_by_user_id,
        workspace_id: resolved_workspace_id,
        tags
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating project:', insertError);
      return NextResponse.json(
        { error: 'Error al crear proyecto', details: insertError.message },
        { status: 500 }
      );
    }

    // Agregar al creador como miembro del proyecto con rol 'owner'
    await supabase
      .from('pm_project_members')
      .insert({
        project_id: newProject.project_id,
        user_id: created_by_user_id,
        project_role: 'owner',
        can_edit: true,
        can_delete: true,
        can_manage_members: true,
        can_manage_settings: true
      });

    // Registrar progreso inicial
    await supabase
      .from('pm_project_progress_history')
      .insert({
        project_id: newProject.project_id,
        completion_percentage: 0
      });
      
    // --- NOTIFICATION ---
    try {
        const { sendTeamNotification, sendNotification } = await import('@/lib/notifications/notifier');
        
        if (newProject.team_id) {
            await sendTeamNotification(newProject.team_id, {
                title: 'Nuevo Proyecto de Equipo',
                message: `Se ha iniciado el proyecto "${newProject.project_name}".`,
                type: 'info',
                category: 'project',
                actorId: created_by_user_id,
                entityId: newProject.project_id,
                link: `/admin/projects/${newProject.project_id}`
            });
        } else {
             await sendNotification({
                recipientId: created_by_user_id,
                title: 'Proyecto Creado',
                message: `Has creado exitosamente el proyecto "${newProject.project_name}".`,
                type: 'success',
                category: 'project',
                entityId: newProject.project_id,
                link: `/admin/projects/${newProject.project_id}`
            });
        }
    } catch (noteError) {
        console.error('Failed to send project notification:', noteError);
    }
    // --------------------

    // --- MILESTONES ---
    if (body.milestones && Array.isArray(body.milestones) && body.milestones.length > 0) {
      const milestonesData = body.milestones.map((m: any, index: number) => ({
        project_id: newProject.project_id,
        milestone_name: m.name,
        milestone_description: m.description || null,
        milestone_status: 'pending',
        target_date: m.targetDate || newProject.target_date || new Date().toISOString(), // Fallback to project target or now
        sort_order: index
      }));

      const { error: errorMilestones } = await supabase
        .from('pm_milestones')
        .insert(milestonesData);
      
      if (errorMilestones) {
        console.error('Error creating milestones:', errorMilestones);
        // We do not fail the request if milestones fail, just log it
      }
    }
    // ------------------

    return NextResponse.json({
      project: newProject,
      message: 'Proyecto creado exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST projects:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Helper: Generar datos sintéticos para sparkline
function generateSparklineData(progress: number): { value: number }[] {
  const points: { value: number }[] = [];
  let current = 0;
  
  for (let i = 0; i < 12; i++) {
    current = Math.min(100, current + Math.random() * (progress / 6));
    points.push({ value: Math.round(current) });
  }
  
  // Asegurar que el último punto coincida con el progreso actual
  if (points.length > 0) {
    points[points.length - 1].value = progress;
  }
  
  return points;
}
