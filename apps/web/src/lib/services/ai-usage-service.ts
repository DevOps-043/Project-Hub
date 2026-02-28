import { getSupabaseAdmin } from '@/lib/supabase/server';

export interface AIUsageLog {
  user_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  action_type: string;
  project_id?: string;
  team_id?: string;
}

/**
 * Logs AI token usage to the database
 */
export async function logAIUsage(log: AIUsageLog) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Determine total tokens if not provided
    const total = log.total_tokens || (log.prompt_tokens + log.completion_tokens);
    
    const { error } = await supabase.from('aria_usage_logs').insert({
      user_id: log.user_id,
      model_name: log.model,
      tokens_prompt: log.prompt_tokens,
      tokens_completion: log.completion_tokens,
      tokens_total: total,
      action_type: log.action_type,
      project_id: log.project_id,
      team_id: log.team_id
    });

    if (error) {
      console.error('Error logging AI usage:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Log AI usage exception:', err);
    return false;
  }
}
