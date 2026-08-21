import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getSofiaAdmin } from '@/lib/supabase/sofia-client';
import { requireWorkspaceMember } from '@/lib/auth/require-role';
import { computeCycleStats } from '@/lib/services/cycle-service';

type RouteParams = { params: Promise<{ slug: string; teamId: string }> };

function profileName(profile: { display_name: string | null; first_name: string | null; last_name_paternal: string | null; email: string } | null) {
  if (!profile) return 'Miembro';
  return profile.display_name || `${profile.first_name || ''} ${profile.last_name_paternal || ''}`.trim() || profile.email || 'Miembro';
}

/**
 * GET /api/workspaces/:slug/teams/:teamId/overview
 * Resumen consolidado de un equipo: responsable (arquitectura SofLIA u owner
 * local), KPIs y previews de proyectos/tareas/ciclos/documentos. Batchea las
 * mismas tablas que ya consultan /issues, /cycles, /members y ?team_id= de
 * proyectos, en una sola ida y vuelta para la página de overview del equipo.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, teamId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace } = auth;

    const supabase = getSupabaseAdmin();
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select(`
        team_id, name, slug, description, color, status, visibility, workspace_id, created_at,
        owner:account_users!teams_owner_id_fkey(user_id, first_name, last_name_paternal, display_name, email, avatar_url)
      `)
      .eq('team_id', teamId)
      .maybeSingle();

    if (teamError || !team || team.workspace_id !== workspace.workspace_id) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    const [membersResult, projectsResult, issuesResult, cyclesResult, documentsResult] = await Promise.all([
      supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamId)
        .eq('is_active', true),
      supabase
        .from('pm_projects')
        .select('project_id, project_key, project_name, project_status, health_status, completion_percentage, icon_name, icon_color, updated_at')
        .eq('team_id', teamId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('task_issues')
        .select('issue_id, cycle_id, completed_at')
        .eq('team_id', teamId),
      supabase
        .from('task_cycles')
        .select('*')
        .eq('team_id', teamId)
        .order('cycle_number', { ascending: false }),
      supabase
        .from('team_documents')
        .select('id, name, provider, doc_type, external_url, thumbnail_url, created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false }),
    ]);

    const memberRows = membersResult.data || [];
    const memberUserIds = memberRows.map((row) => row.user_id);
    let memberProfiles: Array<{
      user_id: string;
      first_name: string | null;
      last_name_paternal: string | null;
      display_name: string | null;
      email: string;
      avatar_url: string | null;
    }> = [];
    if (memberUserIds.length > 0) {
      const { data } = await supabase
        .from('account_users')
        .select('user_id, first_name, last_name_paternal, display_name, email, avatar_url')
        .in('user_id', memberUserIds);
      memberProfiles = data || [];
    }
    const memberProfilesById = new Map(memberProfiles.map((profile) => [profile.user_id, profile]));
    const members = memberRows.map((row) => {
      const profile = memberProfilesById.get(row.user_id) || null;
      return {
        id: row.user_id,
        role: row.role,
        name: profileName(profile),
        email: profile?.email || '',
        avatarUrl: profile?.avatar_url || null,
      };
    });

    const projects = projectsResult.data || [];
    const issues = issuesResult.data || [];
    const tasksTotal = issues.length;
    const tasksCompleted = issues.filter((issue) => issue.completed_at !== null).length;

    const cyclesWithStats = computeCycleStats(cyclesResult.data || [], issues);
    const activeCycles = cyclesWithStats.filter((cycle) => cycle.status === 'active');
    const upcomingCycles = cyclesWithStats.filter((cycle) => cycle.status === 'upcoming');

    const documents = documentsResult.data || [];

    let hierarchyNode: { id: string; name: string; manager: { id: string; name: string; email: string; avatarUrl: string | null } | null } | null = null;
    const ownerProfile = Array.isArray(team.owner) ? team.owner[0] : team.owner;

    const sofia = getSofiaAdmin();
    if (sofia && workspace.sofia_org_id) {
      const { data: node } = await sofia
        .from('organization_nodes')
        .select('id, name, manager_id')
        .eq('organization_id', workspace.sofia_org_id)
        .eq('properties->>project_hub_team_id', teamId)
        .maybeSingle();
      if (node) {
        let manager = null;
        if (node.manager_id) {
          const { data: managerProfile } = await supabase
            .from('account_users')
            .select('user_id, first_name, last_name_paternal, display_name, email, avatar_url')
            .eq('user_id', node.manager_id)
            .maybeSingle();
          if (managerProfile) {
            manager = {
              id: managerProfile.user_id,
              name: profileName(managerProfile),
              email: managerProfile.email,
              avatarUrl: managerProfile.avatar_url,
            };
          }
        }
        hierarchyNode = { id: node.id, name: node.name, manager };
      }
    }

    return NextResponse.json({
      team: {
        id: team.team_id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        color: team.color,
        status: team.status,
        visibility: team.visibility,
        owner: ownerProfile ? {
          id: ownerProfile.user_id,
          name: profileName(ownerProfile),
          email: ownerProfile.email,
          avatarUrl: ownerProfile.avatar_url,
        } : null,
        createdAt: team.created_at,
      },
      hierarchyNode,
      stats: {
        membersCount: members.length,
        projectsCount: projects.length,
        activeProjectsCount: projects.filter((project) => project.project_status === 'active').length,
        tasksTotal,
        tasksCompleted,
        activeCyclesCount: activeCycles.length,
        documentsCount: documents.length,
      },
      previews: {
        members: members.slice(0, 6),
        projects: projects.slice(0, 4),
        cycles: [...activeCycles, ...upcomingCycles].slice(0, 3),
        documents: documents.slice(0, 4),
      },
    });
  } catch (error) {
    console.error('Team overview GET error:', error);
    return NextResponse.json({ error: 'No se pudo cargar el resumen del equipo' }, { status: 500 });
  }
}
