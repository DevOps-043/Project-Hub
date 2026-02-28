/**
 * API Route: /api/admin/teams/[teamId]/issues
 * GET: List issues for a team
 * POST: Create new issue
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

// GET - List issues
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;
    
    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // RESOLUCIÓN DE TEAM ID (UUID o Slug)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
    
    if (!isUUID) {
       // Buscar por slug o nombre
       const { data: teamData, error: teamError } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${teamId},name.eq.${teamId}`)
         .single();

       if (teamError || !teamData) {
         console.error(`Team not found for identifier: ${teamId}`);
         // Si falla, devolvemos array vacío para no romper la UI, o 404
         return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
       }
       teamId = teamData.team_id;
    }

    // Query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status_type
    const statusId = searchParams.get('statusId'); // Filter by specific status
    const assignee = searchParams.get('assignee');
    const priority = searchParams.get('priority');
    let projectId = searchParams.get('projectId');
    const cycleId = searchParams.get('cycleId');
    const search = searchParams.get('search');
    const groupBy = searchParams.get('groupBy') || 'status';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // RESOLUCIÓN DE PROJECT ID (si es un slug o key en los params)
    if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
       const { data: projData } = await supabaseAdmin
         .from('pm_projects')
         .select('project_id')
         .or(`project_key.eq.${projectId},project_name.eq.${projectId}`)
         .single();
       if (projData) projectId = projData.project_id;
    }

    // Build query
    let query = supabaseAdmin
      .from('task_issues')
      .select(`
        *,
        status:task_statuses(status_id, name, status_type, color, icon, is_closed, position),
        priority:task_priorities(priority_id, name, level, color),
        assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, avatar_url),
        creator:account_users!task_issues_creator_id_fkey(user_id, display_name, avatar_url),
        cycle:task_cycles(cycle_id, name),
        labels:task_issue_labels(label:task_labels(label_id, name, color))
      `)
      .eq('team_id', teamId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (statusId) {
      query = query.eq('status_id', statusId);
    }
    if (assignee) {
      query = query.eq('assignee_id', assignee);
    }
    if (priority) {
      query = query.eq('priority_id', priority);
    }
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (cycleId) {
      query = query.eq('cycle_id', cycleId);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: issues, error } = await query;

    if (error) {
      console.error('Error fetching issues:', error);
      return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 });
    }

    // Get team info for identifier prefix (using slug as identifier)
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('slug, name')
      .eq('team_id', teamId)
      .single();

    // Get statuses for grouping
    const { data: statuses } = await supabaseAdmin
      .from('task_statuses')
      .select('*')
      .eq('team_id', teamId)
      .order('position', { ascending: true });

    // Add full identifier to each issue (using team slug)
    const teamPrefix = team?.slug ? team.slug.toUpperCase() : 'TASK';
    const issuesWithIdentifier = (issues || []).map(issue => ({
      ...issue,
      identifier: `${teamPrefix}-${issue.issue_number}`,
      labels: issue.labels?.map((l: any) => l.label) || []
    }));

    // Group by status if requested
    let groupedIssues: any = null;
    if (groupBy === 'status') {
      groupedIssues = {};
      statuses?.forEach(status => {
        groupedIssues[status.status_id] = {
          status,
          issues: issuesWithIdentifier.filter(i => i.status_id === status.status_id)
        };
      });
    }

    // Get counts per status
    const statusCounts: Record<string, number> = {};
    statuses?.forEach(status => {
      statusCounts[status.status_id] = issuesWithIdentifier.filter(
        i => i.status_id === status.status_id
      ).length;
    });

    return NextResponse.json({
      issues: issuesWithIdentifier,
      groupedIssues,
      statuses,
      statusCounts,
      team,
      total: issuesWithIdentifier.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error in GET /api/admin/teams/[teamId]/issues:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Create new issue
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;
    
    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // RESOLUCIÓN DE TEAM ID PARA EL POST TAMBIÉN
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
    if (!isUUID) {
       const { data: teamData } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${teamId},name.eq.${teamId}`)
         .single();
       if (teamData) teamId = teamData.team_id;
    }

    const body = await request.json();
    let { 
      title, 
      description, 
      status_id, 
      priority_id, 
      assignee_id, 
      project_id, 
      cycle_id,
      parent_issue_id,
      due_date,
      estimate_points,
      labels 
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    }

    // RESOLUCIÓN DE PROJECT ID (si es un slug o key)
    if (project_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project_id)) {
      const { data: projData } = await supabaseAdmin
        .from('pm_projects')
        .select('project_id')
        .or(`project_key.eq.${project_id},project_name.eq.${project_id}`)
        .single();
      
      if (projData) {
        project_id = projData.project_id;
      } else {
        // Si no se encuentra, tal vez es un ID inválido o slug inexistente
        project_id = null;
      }
    }

    // Get the next issue number for this team
    const { data: lastIssue } = await supabaseAdmin
      .from('task_issues')
      .select('issue_number')
      .eq('team_id', teamId)
      .order('issue_number', { ascending: false })
      .limit(1)
      .single();

    const nextIssueNumber = (lastIssue?.issue_number || 0) + 1;

    // Get default status if not provided
    let finalStatusId = status_id;
    if (!finalStatusId) {
      const { data: defaultStatus } = await supabaseAdmin
        .from('task_statuses')
        .select('status_id')
        .eq('team_id', teamId)
        .eq('is_default', true)
        .single();
      
      finalStatusId = defaultStatus?.status_id;
      
      if (!finalStatusId) {
        // Get first status
        const { data: firstStatus } = await supabaseAdmin
          .from('task_statuses')
          .select('status_id')
          .eq('team_id', teamId)
          .order('position')
          .limit(1)
          .single();
        finalStatusId = firstStatus?.status_id;
      }
    }

    if (!finalStatusId) {
      return NextResponse.json({ error: 'No hay estados configurados para este equipo' }, { status: 400 });
    }

    // Validate UUIDs for optional foreign keys - strip invalid values
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validPriorityId = priority_id && uuidRegex.test(priority_id) ? priority_id : null;
    const validAssigneeId = assignee_id && uuidRegex.test(assignee_id) ? assignee_id : null;
    const validProjectId = project_id && uuidRegex.test(project_id) ? project_id : null;
    const validCycleId = cycle_id && uuidRegex.test(cycle_id) ? cycle_id : null;
    const validParentIssueId = parent_issue_id && uuidRegex.test(parent_issue_id) ? parent_issue_id : null;

    // Create issue
    const insertData = {
      team_id: teamId,
      issue_number: nextIssueNumber,
      title: title.trim(),
      description: description || null,
      status_id: finalStatusId,
      priority_id: validPriorityId,
      assignee_id: validAssigneeId,
      project_id: validProjectId,
      cycle_id: validCycleId,
      parent_issue_id: validParentIssueId,
      due_date: due_date || null,
      estimate_points: estimate_points || null,
      creator_id: payload.sub,
      sort_order: 0
    };

    console.log('[POST issues] Inserting issue:', JSON.stringify(insertData, null, 2));

    const { data: issue, error } = await supabaseAdmin
      .from('task_issues')
      .insert(insertData)
      .select(`
        *,
        status:task_statuses(*),
        priority:task_priorities(*),
        assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, avatar_url),
        creator:account_users!task_issues_creator_id_fkey(user_id, display_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Error creating issue:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: 'Error al crear la tarea' }, { status: 500 });
    }

    // Add labels if provided
    if (labels?.length > 0) {
      const labelInserts = labels.map((labelId: string) => ({
        issue_id: issue.issue_id,
        label_id: labelId
      }));
      await supabaseAdmin.from('task_issue_labels').insert(labelInserts);
    }

    // Get team slug for full identifier
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('slug')
      .eq('team_id', teamId)
      .single();

    const teamPrefix = team?.slug ? team.slug.toUpperCase() : 'TASK';
    return NextResponse.json({
      issue: {
        ...issue,
        identifier: `${teamPrefix}-${issue.issue_number}`
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/admin/teams/[teamId]/issues:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
