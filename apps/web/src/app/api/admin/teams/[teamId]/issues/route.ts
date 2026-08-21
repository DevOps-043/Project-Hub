/**
 * API Route: /api/admin/teams/[teamId]/issues
 * GET: List issues for a team
 * POST: Create new issue
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdminOrWorkspaceMemberForTeam } from '@/lib/auth/require-role';
import { sanitizeSearchTerm, sanitizeFilterIdentifier } from '@/lib/http/sanitize';
import { ensureDefaultTaskStatuses, resolveTaskStatusId, resolveTeamId } from '@/lib/services/task-status-service';
import { isUuid } from '@/lib/http/validation';

export const runtime = 'nodejs';

// GET - List issues
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;

    // RESOLUCIÓN DE TEAM ID (UUID o Slug)
    const isUUID = isUuid(teamId);

    if (!isUUID) {
       // Buscar por slug o nombre
       const { data: teamData, error: teamError } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${sanitizeFilterIdentifier(teamId)},name.eq.${sanitizeFilterIdentifier(teamId)}`)
         .single();

       if (teamError || !teamData) {
         console.error(`Team not found for identifier: ${teamId}`);
         // Si falla, devolvemos array vacío para no romper la UI, o 404
         return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
       }
       teamId = teamData.team_id;
    }

    const resolvedTeamId = await resolveTeamId(supabaseAdmin, teamId);
    if (!resolvedTeamId) {
      console.error(`Team not found for identifier: ${teamId}`);
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    teamId = resolvedTeamId;

    // Auth (después de resolver el team_id real, que la política necesita)
    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;

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
    if (projectId && !isUuid(projectId)) {
       const { data: projData } = await supabaseAdmin
         .from('pm_projects')
         .select('project_id')
         .or(`project_key.eq.${sanitizeFilterIdentifier(projectId)},project_name.eq.${sanitizeFilterIdentifier(projectId)}`)
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
      const safeSearch = sanitizeSearchTerm(search);
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
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

    await ensureDefaultTaskStatuses(supabaseAdmin, teamId);

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
      labels: issue.labels?.map((l: { label: unknown }) => l.label) || []
    }));

    // Group by status if requested
    let groupedIssues: Record<string, unknown> | null = null;
    if (groupBy === 'status') {
      const byStatus: Record<string, unknown> = {};
      groupedIssues = byStatus;
      statuses?.forEach(status => {
        byStatus[status.status_id] = {
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

    // RESOLUCIÓN DE TEAM ID PARA EL POST TAMBIÉN
    const isUUID = isUuid(teamId);
    if (!isUUID) {
       const { data: teamData } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${sanitizeFilterIdentifier(teamId)},name.eq.${sanitizeFilterIdentifier(teamId)}`)
         .single();
       if (teamData) teamId = teamData.team_id;
    }

    const resolvedTeamId = await resolveTeamId(supabaseAdmin, teamId);
    if (!resolvedTeamId) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    teamId = resolvedTeamId;

    // Auth (después de resolver el team_id real, que la política necesita)
    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

    const body = await request.json();
    const {
      title,
      description,
      status_id,
      priority_id,
      assignee_id,
      cycle_id,
      parent_issue_id,
      due_date,
      estimate_points,
      labels
    } = body;
    let { project_id } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    }

    // RESOLUCIÓN DE PROJECT ID (si es un slug o key)
    if (project_id && !isUuid(project_id)) {
      const { data: projData } = await supabaseAdmin
        .from('pm_projects')
        .select('project_id')
        .or(`project_key.eq.${sanitizeFilterIdentifier(project_id)},project_name.eq.${sanitizeFilterIdentifier(project_id)}`)
        .single();
      
      if (projData) {
        project_id = projData.project_id;
      } else {
        // Si no se encuentra, tal vez es un ID inválido o slug inexistente
        project_id = null;
      }
    }

    const finalStatusId = await resolveTaskStatusId(supabaseAdmin, teamId, status_id, body.status_type);

    if (!finalStatusId) {
      return NextResponse.json({ error: 'No hay estados configurados para este equipo' }, { status: 400 });
    }

    // Validate UUIDs for optional foreign keys - strip invalid values
    const validPriorityId = priority_id && isUuid(priority_id) ? priority_id : null;
    let validAssigneeId = assignee_id && isUuid(assignee_id) ? assignee_id : null;
    const validProjectId = project_id && isUuid(project_id) ? project_id : null;
    const validCycleId = cycle_id && isUuid(cycle_id) ? cycle_id : null;
    const validParentIssueId = parent_issue_id && isUuid(parent_issue_id) ? parent_issue_id : null;

    // El creador (creator_id) tiene FK NOT NULL contra account_users. El JWT.sub
    // proviene de la sincronización SOFIA->Project Hub, pero verificamos que exista
    // para devolver un error claro en lugar de un 500 opaco por violación de FK.
    const { data: creatorRow } = await supabaseAdmin
      .from('account_users')
      .select('user_id')
      .eq('user_id', payload.sub)
      .maybeSingle();

    if (!creatorRow) {
      return NextResponse.json(
        { error: 'Tu usuario no está sincronizado en este espacio. Cierra sesión y vuelve a entrar.' },
        { status: 409 }
      );
    }

    // El assignee también referencia account_users. Un miembro de SOFIA puede no
    // estar aún en account_users: en ese caso lo dejamos sin asignar en vez de
    // romper el INSERT con una violación de FK.
    if (validAssigneeId) {
      const { data: assigneeRow } = await supabaseAdmin
        .from('account_users')
        .select('user_id')
        .eq('user_id', validAssigneeId)
        .maybeSingle();
      if (!assigneeRow) {
        console.warn(`Assignee ${validAssigneeId} no existe en account_users; se crea la tarea sin asignar.`);
        validAssigneeId = null;
      }
    }

    // issue_number depende del trigger trg_issue_number. Lo calculamos como respaldo
    // por si el trigger no está aplicado en la BD (evita violación de NOT NULL).
    const { data: lastIssue } = await supabaseAdmin
      .from('task_issues')
      .select('issue_number')
      .eq('team_id', teamId)
      .order('issue_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIssueNumber = (lastIssue?.issue_number || 0) + 1;

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
      return NextResponse.json(
        {
          error: 'Error al crear la tarea',
          detail: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
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
