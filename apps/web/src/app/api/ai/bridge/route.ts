import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos Service Role para tener acceso total
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Verificar Seguridad
    const authHeader = request.headers.get('authorization');
    const agentKey = process.env.IRIS_AGENT_KEY || 'iris-default-secret-key';
    
    if (authHeader !== `Bearer ${agentKey}`) {
        return NextResponse.json({ error: 'Unauthorized: Invalid IRIS Agent Key' }, { status: 401 });
    }

    // 2. Consultas (projects, tasks, issues)
    const projectsResponse = await supabaseAdmin.from('pm_projects').select('project_id, project_name, project_status, priority_level, target_date');
    const tasksResponse = await supabaseAdmin.from('task_issues').select('issue_id, title, status_id, priority_id, assignee_id').limit(50);
    const usersResponse = await supabaseAdmin.from('account_users').select('user_id, display_name, email, permission_level'); // Corrected table name
    
    const schema = { tables: ['pm_projects', 'task_issues', 'account_users', 'pm_milestones', 'task_cycles'] };

    // 3. Respuesta JSON Contextual
    const systemContext = {
        timestamp: new Date().toISOString(),
        system_status: projectsResponse.error ? 'DB_ERROR' : 'HEALTHY',
        environment: process.env.NODE_ENV,
        database: {
            stats: {
                projects_count: projectsResponse.data?.length || 0,
                tasks_count: tasksResponse.data?.length || 0,
                users_count: usersResponse.data?.length || 0
            },
            debug_errors: {
                projects: projectsResponse.error ? projectsResponse.error.message : null,
                tasks: tasksResponse.error ? tasksResponse.error.message : null,
                users: usersResponse.error ? usersResponse.error.message : null
            },
            schema_summary: schema
        },
        active_context: {
            active_projects: projectsResponse.data || [],
            pending_tasks: tasksResponse.data || [],
            team_members: usersResponse.data || []
        },
        capabilities: [
            "create_task",
            "update_task",
            "delete_task",
            "update_project",
            "create_milestone",
            "create_cycle"
        ]
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
        const authHeader = request.headers.get('authorization');
        const agentKey = process.env.IRIS_AGENT_KEY || 'iris-default-secret-key';
        
        if (authHeader !== `Bearer ${agentKey}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { tool, params } = body;
        
        let result;

        // Router de Acciones
        switch (tool) {
            case 'update_project':
                // params: { id, updates }
                const { data: pData, error: pError } = await supabaseAdmin
                    .from('pm_projects')
                    .update(params.updates)
                    .eq('project_id', params.id)
                    .select();
                if (pError) throw pError;
                result = pData;
                break;

            case 'update_task':
                 const { data: tData, error: tError } = await supabaseAdmin
                    .from('task_issues')
                    .update(params.updates)
                    .eq('issue_id', params.id)
                    .select();
                if (tError) throw tError;
                result = tData;
                break;

            case 'create_task':
                // params needs to match table schema
                const { data: cData, error: cError } = await supabaseAdmin
                   .from('task_issues')
                   .insert([params])
                   .select();
               if (cError) throw cError;
               result = cData;
               break;

            case 'delete_task':
                const { error: dError } = await supabaseAdmin
                    .from('task_issues')
                    .delete()
                    .eq('issue_id', params.id);
                if (dError) throw dError;
                result = { success: true };
                break;

            case 'create_milestone':
                 const { data: mData, error: mError } = await supabaseAdmin
                    .from('pm_milestones')
                    .insert([params])
                    .select();
                if (mError) throw mError;
                result = mData;
                break;

            case 'create_cycle':
                const { data: cyData, error: cyError } = await supabaseAdmin
                    .from('task_cycles')
                    .insert([params])
                    .select();
                if (cyError) throw cyError;
                result = cyData;
                break;

            default:
                return NextResponse.json({ error: `Tool '${tool}' not supported` }, { status: 400 });
        }

        return NextResponse.json({ status: 'success', action: tool, result });

    } catch (error: any) {
        console.error('Bridge Write Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
