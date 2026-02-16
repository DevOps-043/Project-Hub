import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyApiKey } from '@/lib/services/api-key-service';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * Autentica una request del bridge
 * Soporta: API keys de BD (phub_...) y legacy env var (IRIS_AGENT_KEY)
 */
async function authenticateBridgeRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  workspaceId?: string;
  scopes?: string[];
  keyName?: string;
  error?: string;
}> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  // 1. Database API key (phub_...)
  if (token.startsWith('phub_')) {
    const result = await verifyApiKey(token);
    if (!result || !result.valid) {
      return { authenticated: false, error: 'Invalid or revoked API key' };
    }
    return {
      authenticated: true,
      workspaceId: result.workspaceId,
      scopes: result.keyRecord.scopes,
      keyName: result.keyRecord.name,
    };
  }

  // 2. Legacy env var key (backward compatibility)
  const legacyKey = process.env.IRIS_AGENT_KEY;
  if (legacyKey && token === legacyKey) {
    return { authenticated: true, scopes: ['read', 'write'] };
  }

  return { authenticated: false, error: 'Invalid API key' };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateBridgeRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: `Unauthorized: ${auth.error}` }, { status: 401 });
    }

    // Queries con scope de workspace si la key lo tiene
    let projectsQuery = supabaseAdmin.from('pm_projects').select('project_id, project_name, project_status, priority_level, target_date');
    let tasksQuery = supabaseAdmin.from('task_issues').select('issue_id, title, status_id, priority_id, assignee_id').limit(50);
    let usersQuery = supabaseAdmin.from('account_users').select('user_id, display_name, email, permission_level');

    if (auth.workspaceId) {
      projectsQuery = projectsQuery.eq('workspace_id', auth.workspaceId);

      // Tasks pertenecen a teams, que pertenecen a workspaces
      const { data: teamIds } = await supabaseAdmin
        .from('teams')
        .select('team_id')
        .eq('workspace_id', auth.workspaceId);

      if (teamIds && teamIds.length > 0) {
        tasksQuery = tasksQuery.in('team_id', teamIds.map(t => t.team_id));
      }

      // Users del workspace
      const { data: memberIds } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', auth.workspaceId)
        .eq('is_active', true);

      if (memberIds && memberIds.length > 0) {
        usersQuery = usersQuery.in('user_id', memberIds.map(m => m.user_id));
      }
    }

    const [projectsResponse, tasksResponse, usersResponse] = await Promise.all([
      projectsQuery,
      tasksQuery,
      usersQuery,
    ]);

    const schema = { tables: ['pm_projects', 'task_issues', 'account_users', 'pm_milestones', 'task_cycles'] };

    const systemContext = {
      timestamp: new Date().toISOString(),
      system_status: projectsResponse.error ? 'DB_ERROR' : 'HEALTHY',
      environment: process.env.NODE_ENV,
      workspace_scoped: !!auth.workspaceId,
      key_name: auth.keyName || 'legacy',
      database: {
        stats: {
          projects_count: projectsResponse.data?.length || 0,
          tasks_count: tasksResponse.data?.length || 0,
          users_count: usersResponse.data?.length || 0,
        },
        debug_errors: {
          projects: projectsResponse.error ? projectsResponse.error.message : null,
          tasks: tasksResponse.error ? tasksResponse.error.message : null,
          users: usersResponse.error ? usersResponse.error.message : null,
        },
        schema_summary: schema,
      },
      active_context: {
        active_projects: projectsResponse.data || [],
        pending_tasks: tasksResponse.data || [],
        team_members: usersResponse.data || [],
      },
      capabilities: [
        'create_task',
        'update_task',
        'delete_task',
        'update_project',
        'create_milestone',
        'create_cycle',
      ],
    };

    return NextResponse.json(systemContext);
  } catch (error: any) {
    console.error('Bridge Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Handler POST para Escritura (Actions)
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateBridgeRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: `Unauthorized: ${auth.error}` }, { status: 401 });
    }

    // Verificar scope de escritura
    if (!auth.scopes?.includes('write')) {
      return NextResponse.json({ error: 'API key does not have write permission' }, { status: 403 });
    }

    const body = await request.json();
    const { tool, params } = body;

    let result;

    switch (tool) {
      case 'update_project': {
        const query = supabaseAdmin
          .from('pm_projects')
          .update(params.updates)
          .eq('project_id', params.id);
        if (auth.workspaceId) query.eq('workspace_id', auth.workspaceId);
        const { data, error } = await query.select();
        if (error) throw error;
        result = data;
        break;
      }

      case 'update_task': {
        const { data, error } = await supabaseAdmin
          .from('task_issues')
          .update(params.updates)
          .eq('issue_id', params.id)
          .select();
        if (error) throw error;
        result = data;
        break;
      }

      case 'create_task': {
        const { data, error } = await supabaseAdmin
          .from('task_issues')
          .insert([params])
          .select();
        if (error) throw error;
        result = data;
        break;
      }

      case 'delete_task': {
        const { error } = await supabaseAdmin
          .from('task_issues')
          .delete()
          .eq('issue_id', params.id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case 'create_milestone': {
        const { data, error } = await supabaseAdmin
          .from('pm_milestones')
          .insert([params])
          .select();
        if (error) throw error;
        result = data;
        break;
      }

      case 'create_cycle': {
        const { data, error } = await supabaseAdmin
          .from('task_cycles')
          .insert([params])
          .select();
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return NextResponse.json({ error: `Tool '${tool}' not supported` }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', action: tool, result });
  } catch (error: any) {
    console.error('Bridge Write Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
