import { NextRequest, NextResponse } from 'next/server';
import {
  getUserWorkspaceRole,
  getWorkspaceMembersPage,
  syncAllOrgMembers,
  updateMemberRole,
} from '@/lib/services/workspace-service';
import { requireWorkspaceMember } from '@/lib/auth/require-role';
import { parsePagination } from '@/lib/http/query';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { WorkspaceMemberWithAccount } from '@/lib/services/workspace-service';

const ALLOWED_ROLES = ['owner', 'admin', 'manager', 'leader', 'member'] as const;
const ROLES_THAT_CAN_EDIT = ['owner', 'admin'];
const ALLOWED_STATUSES = ['active', 'inactive', 'suspended', 'pending_verification'] as const;

interface WorkspaceProjectSummary {
  project_id: string;
  project_name: string;
  project_key: string;
  project_status: string;
  completion_percentage: number | null;
  icon_color: string | null;
}

interface ProjectMembershipRow {
  user_id: string;
  project_id: string;
  project_role: string;
}

interface AssignedTaskRow {
  assignee_id: string;
  project_id: string;
  status: { status_type: string } | { status_type: string }[] | null;
}

function taskStatusType(task: AssignedTaskRow): string | undefined {
  return Array.isArray(task.status) ? task.status[0]?.status_type : task.status?.status_type;
}

function cleanOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().slice(0, maxLength);
  return clean || null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace, member: userMember } = auth;

    const forceSync = request.nextUrl.searchParams.get('sync') === 'true';
    const includeStats = request.nextUrl.searchParams.get('includeStats') === 'true';
    if (includeStats && !ROLES_THAT_CAN_EDIT.includes(userMember.iris_role)) {
      return NextResponse.json({ error: 'No tienes permisos para ver estadísticas de miembros' }, { status: 403 });
    }

    const { page, limit, offset } = parsePagination(request.nextUrl.searchParams, {
      defaultLimit: 1000,
      maxLimit: 1000,
    });

    // Obtener miembros actuales
    let memberPage = await getWorkspaceMembersPage(workspace.workspace_id, { limit, offset });

    // Sincronizar con SOFIA solo si: se fuerza, o hay muy pocos miembros (primera carga)
    if (workspace.sofia_org_id && (forceSync || memberPage.total <= 1)) {
      await syncAllOrgMembers(workspace.workspace_id, workspace.sofia_org_id);
      memberPage = await getWorkspaceMembersPage(workspace.workspace_id, { limit, offset });
    }

    let workspaceProjects: WorkspaceProjectSummary[] = [];
    let projectMemberships: ProjectMembershipRow[] = [];
    let assignedTasks: AssignedTaskRow[] = [];

    if (includeStats) {
      const userIds = memberPage.members.map((member) => member.user_id);
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('pm_projects')
        .select('project_id, project_name, project_key, project_status, completion_percentage, icon_color')
        .eq('workspace_id', workspace.workspace_id)
        .is('archived_at', null);

      workspaceProjects = (data || []) as WorkspaceProjectSummary[];
      const projectIds = workspaceProjects.map((project) => project.project_id);

      if (userIds.length > 0 && projectIds.length > 0) {
        const [membershipsResult, tasksResult] = await Promise.all([
          supabase
            .from('pm_project_members')
            .select('user_id, project_id, project_role')
            .in('user_id', userIds)
            .in('project_id', projectIds),
          supabase
            .from('task_issues')
            .select('assignee_id, project_id, status:task_statuses(status_type)')
            .in('assignee_id', userIds)
            .in('project_id', projectIds)
            .is('archived_at', null),
        ]);

        projectMemberships = (membershipsResult.data || []) as ProjectMembershipRow[];
        assignedTasks = (tasksResult.data || []) as unknown as AssignedTaskRow[];
      }
    }

    const projectById = new Map(workspaceProjects.map((project) => [project.project_id, project]));

    const transformedMembers = memberPage.members.map((m: WorkspaceMemberWithAccount) => {
      const memberships = projectMemberships.filter((membership) => membership.user_id === m.user_id);
      const tasks = assignedTasks.filter((task) => task.assignee_id === m.user_id);
      const projects = memberships.map((membership) => {
        const project = projectById.get(membership.project_id);
        const projectTasks = tasks.filter((task) => task.project_id === membership.project_id);
        const completedTasks = projectTasks.filter((task) => {
          const statusType = taskStatusType(task);
          return statusType === 'done' || statusType === 'completed';
        }).length;

        return {
          id: project?.project_id || membership.project_id,
          name: project?.project_name || 'Proyecto',
          key: project?.project_key || '',
          status: project?.project_status || 'planning',
          progress: project?.completion_percentage || 0,
          color: project?.icon_color || '#00D4B3',
          role: membership.project_role,
          tasksAssigned: projectTasks.length,
          tasksCompleted: completedTasks,
        };
      });
      const tasksCompleted = tasks.filter((task) => {
        const statusType = taskStatusType(task);
        return statusType === 'done' || statusType === 'completed';
      }).length;
      const averageProgress = projects.length
        ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
        : 0;

      return {
        id: m.user_id,
        firstName: m.account_users?.first_name || '',
        lastNamePaternal: m.account_users?.last_name_paternal || '',
        displayName: m.account_users?.display_name || `${m.account_users?.first_name || ''} ${m.account_users?.last_name_paternal || ''}`.trim(),
        email: m.account_users?.email || '',
        avatarUrl: m.account_users?.avatar_url || null,
        permissionLevel: m.account_users?.permission_level || 'user',
        irisRole: m.iris_role,
        sofiaRole: m.sofia_role,
        joinedAt: m.joined_at,
        companyRole: m.account_users?.company_role || '',
        department: m.account_users?.department || '',
        phoneNumber: m.account_users?.phone_number || '',
        accountStatus: m.account_users?.account_status || 'active',
        lastActivityAt: m.account_users?.last_activity_at || null,
        stats: {
          projectCount: projects.length,
          activeProjectCount: projects.filter((project) => project.status === 'active').length,
          averageProgress,
          tasksAssigned: tasks.length,
          tasksCompleted,
          completionRate: tasks.length ? Math.round((tasksCompleted / tasks.length) * 100) : 0,
          projects,
        },
      };
    });

    return NextResponse.json({
      users: transformedMembers,
      pagination: {
        page,
        limit,
        total: memberPage.total,
        totalPages: Math.ceil(memberPage.total / limit),
      },
    });
  } catch (error) {
    console.error('Workspace members API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace, member: callerMember } = auth;

    // Verificar que el usuario que edita es owner o admin
    if (!ROLES_THAT_CAN_EDIT.includes(callerMember.iris_role)) {
      return NextResponse.json({ error: 'No tienes permisos para cambiar roles' }, { status: 403 });
    }

    const body = await request.json();
    const {
      userId,
      irisRole,
      firstName,
      lastNamePaternal,
      displayName,
      companyRole,
      department,
      phoneNumber,
      accountStatus,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    if (irisRole !== undefined && !ALLOWED_ROLES.includes(irisRole)) {
      return NextResponse.json({ error: `Rol inválido. Roles permitidos: ${ALLOWED_ROLES.join(', ')}` }, { status: 400 });
    }

    if (accountStatus !== undefined && !ALLOWED_STATUSES.includes(accountStatus)) {
      return NextResponse.json({ error: 'Estado de cuenta inválido' }, { status: 400 });
    }

    const targetMember = await getUserWorkspaceRole(workspace.workspace_id, userId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });
    }

    if (targetMember.iris_role === 'owner' && callerMember.iris_role !== 'owner') {
      return NextResponse.json({ error: 'Solo un owner puede editar a otro owner' }, { status: 403 });
    }

    if (irisRole !== undefined) {
      const success = await updateMemberRole(workspace.workspace_id, userId, irisRole);

      if (!success) {
        return NextResponse.json({ error: 'Error al actualizar el rol' }, { status: 500 });
      }
    }

    const profileUpdates: Record<string, string | null> = {};
    const cleanFirstName = cleanOptionalText(firstName, 100);
    const cleanLastName = cleanOptionalText(lastNamePaternal, 100);
    const cleanDisplayName = cleanOptionalText(displayName, 180);
    const cleanCompanyRole = cleanOptionalText(companyRole, 140);
    const cleanDepartment = cleanOptionalText(department, 140);
    const cleanPhone = cleanOptionalText(phoneNumber, 40);

    if (cleanFirstName !== undefined && cleanFirstName !== null) profileUpdates.first_name = cleanFirstName;
    if (cleanLastName !== undefined && cleanLastName !== null) profileUpdates.last_name_paternal = cleanLastName;
    if (cleanDisplayName !== undefined) profileUpdates.display_name = cleanDisplayName;
    if (cleanCompanyRole !== undefined) profileUpdates.company_role = cleanCompanyRole;
    if (cleanDepartment !== undefined) profileUpdates.department = cleanDepartment;
    if (cleanPhone !== undefined) profileUpdates.phone_number = cleanPhone;
    if (accountStatus !== undefined) profileUpdates.account_status = accountStatus;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await getSupabaseAdmin()
        .from('account_users')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Workspace member profile update error:', profileError.message);
        return NextResponse.json({ error: 'No se pudo actualizar la información del miembro' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Miembro actualizado correctamente' });
  } catch (error) {
    console.error('Workspace members PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
