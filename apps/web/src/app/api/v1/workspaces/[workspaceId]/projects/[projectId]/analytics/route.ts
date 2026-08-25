import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { ApiError, fail, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId);
    const supabase = getSupabaseAdmin();
    const [issuesResult, evidenceResult, activityResult] = await Promise.all([
      supabase.from('task_issues').select('issue_id,due_date,assignee_id,task_statuses(status_type,is_closed),task_priorities(priority_level)')
        .eq('project_id', projectId).is('archived_at', null),
      supabase.from('pm_project_evidence').select('evidence_id,evidence_type,created_at,pm_project_evidence_items(item_type)')
        .eq('project_id', projectId).is('archived_at', null),
      supabase.from('pm_project_activity').select('*').eq('workspace_id', workspaceId).eq('project_id', projectId)
        .order('created_at', { ascending: false }).limit(25),
    ]);
    if (issuesResult.error || evidenceResult.error) throw new ApiError(500, 'ANALYTICS_FAILED', 'No se pudo calcular la analítica');
    const issues = issuesResult.data || [];
    const evidence = evidenceResult.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const statusCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    const workload: Record<string, number> = {};
    let completed = 0;
    let overdue = 0;
    for (const issue of issues) {
      const status = Array.isArray(issue.task_statuses) ? issue.task_statuses[0] : issue.task_statuses;
      const priority = Array.isArray(issue.task_priorities) ? issue.task_priorities[0] : issue.task_priorities;
      const statusType = status?.status_type || 'unknown';
      statusCounts[statusType] = (statusCounts[statusType] || 0) + 1;
      const priorityLevel = priority?.priority_level || 'none';
      priorityCounts[priorityLevel] = (priorityCounts[priorityLevel] || 0) + 1;
      if (status?.is_closed) completed += 1;
      if (issue.due_date && issue.due_date < today && !status?.is_closed) overdue += 1;
      if (issue.assignee_id) workload[issue.assignee_id] = (workload[issue.assignee_id] || 0) + 1;
    }
    const itemCounts: Record<string, number> = {};
    for (const row of evidence) for (const item of row.pm_project_evidence_items || []) itemCounts[item.item_type] = (itemCounts[item.item_type] || 0) + 1;
    return ok(request, {
      progress: issues.length ? Math.round((completed / issues.length) * 100) : 0,
      tasks: { total: issues.length, completed, overdue, by_status: statusCounts, by_priority: priorityCounts, workload },
      evidence: { total: evidence.length, meetings: evidence.filter((row) => row.evidence_type === 'meeting').length,
        decisions: itemCounts.decision || 0, agreements: itemCounts.agreement || 0, by_item_type: itemCounts },
      recent_activity: activityResult.data || [],
    });
  } catch (error) { return fail(request, error); }
}

