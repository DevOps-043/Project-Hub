import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/server';

interface ToolContext {
  userId: string;
  userRole: string;
  teamId: string;
  lastMessageAttachments?: any[];
}

export class AriaToolHandlers {
  private supabase: SupabaseClient;
  private ctx: ToolContext;

  constructor(context: ToolContext) {
    this.supabase = getSupabaseAdmin();
    this.ctx = context;
  }

  // --- PERMISSION HELPERS ---
  private checkAccess(allowedRoles: string[], actionDescription: string) {
    // 1. Super Admin & Admin always allowed
    if (['super_admin', 'admin'].includes(this.ctx.userRole)) return true;
    
    // 2. Check specific roles
    if (allowedRoles.includes(this.ctx.userRole)) return true;

    // 3. Deny
    throw new Error(`⛔ Acceso Denegado: Tu rol actual (${this.ctx.userRole}) no tiene permisos para ${actionDescription}.`);
  }

  // --- HELPERS ---
  private async findTask(identifier: string) {
    // Try by Issue Number (e.g., T-123)
    if (identifier.match(/^[A-Z]+-\d+$/)) {
      const { data } = await this.supabase.from('task_issues')
        .select('issue_id, title, issue_number')
        .eq('issue_number', identifier.split('-')[1]) // Assuming format KEY-123
        .eq('team_id', this.ctx.teamId)
        .maybeSingle();
      if (data) return data;
      
      // Try exact match on issue_number column just in case passed as int
      const { data: numData } = await this.supabase.from('task_issues')
        .select('issue_id, title, issue_number')
        .eq('issue_number', parseInt(identifier.replace(/\D/g,'')))
        .eq('team_id', this.ctx.teamId)
        .maybeSingle();
      if (numData) return numData;
    }

    // Try by Title (ILike)
    const { data } = await this.supabase.from('task_issues')
      .select('issue_id, title, issue_number')
      .eq('team_id', this.ctx.teamId)
      .ilike('title', `%${identifier}%`)
      .limit(1)
      .maybeSingle();
    
    return data;
  }

  private async findUser(emailOrName: string) {
    if (!emailOrName) return { user_id: this.ctx.userId }; // Default to self

    // Try Email
    const { data: byEmail } = await this.supabase.from('account_users')
      .select('user_id')
      .ilike('email', emailOrName)
      .single();
    if (byEmail) return byEmail;

    // Try Name (First + Last)
    const { data: byName } = await this.supabase.from('account_users')
      .select('user_id')
      .or(`first_name.ilike.%${emailOrName}%,display_name.ilike.%${emailOrName}%`)
      .limit(1)
      .maybeSingle();
    
    return byName;
  }

  // --- ACTIONS ---

  async create_task(args: { title: string, description?: string, priority?: string, estimate_points?: number, due_date?: string, assignee_name_or_email?: string }) {
    // Restriction: Viewers/Guests cannot create tasks
    this.checkAccess(['manager', 'user'], 'crear tareas');
    
    console.log('🛠️ ARIA Action: CREATE_TASK', args);
    
    let assigneeId = this.ctx.userId; 
    if (args.assignee_name_or_email) {
      const user = await this.findUser(args.assignee_name_or_email);
      if (user) assigneeId = user.user_id;
    }

    const { data: priorityData } = await this.supabase.from('task_priorities')
      .select('priority_id')
      .ilike('name', args.priority || 'medium')
      .single();
    
    const { data: statusData } = await this.supabase.from('task_statuses')
      .select('status_id')
      .ilike('name', 'todo')
      .limit(1)
      .single();

    if (!statusData) throw new Error("No se pudo determinar el estado inicial 'Todo'.");
    
    // Get next issue number
    // Simplification: We trust the DB sequence or trigger, but if manual:
    const { count } = await this.supabase.from('task_issues').select('*', { count: 'exact', head: true }).eq('team_id', this.ctx.teamId);
    const issueNum = (count || 0) + 1;

    const { data, error } = await this.supabase.from('task_issues').insert({
      team_id: this.ctx.teamId,
      issue_number: issueNum,
      title: args.title,
      description: args.description,
      assignee_id: assigneeId,
      creator_id: this.ctx.userId,
      priority_id: priorityData?.priority_id,
      status_id: statusData.status_id,
      estimate_points: args.estimate_points,
      due_date: args.due_date,
    }).select().single();

    if (error) throw new Error(`Error creando tarea: ${error.message}`);
    return JSON.stringify({ success: true, message: `Task '${data.title}' (Issue #${data.issue_number}) created successfully with ID ${data.issue_id}.`, task: data });
  }

  async update_task_status(args: { task_identifier: string, new_status: string }) {
    this.checkAccess(['manager', 'user'], 'actualizar estado de tareas');

    const task = await this.findTask(args.task_identifier);
    if (!task) return JSON.stringify({ error: `Task '${args.task_identifier}' not found.` });

    const { data: statusData } = await this.supabase.from('task_statuses')
      .select('status_id, name')
      .ilike('name', args.new_status)
      .single();

    if (!statusData) return JSON.stringify({ error: `Status '${args.new_status}' not valid.` });

    const { error } = await this.supabase.from('task_issues')
      .update({ status_id: statusData.status_id })
      .eq('issue_id', task.issue_id);

    if (error) throw new Error(error.message);
    return JSON.stringify({ success: true, message: `Task '${task.title}' moved to ${statusData.name}.` });
  }

  async update_task_priority(args: { task_identifier: string, new_priority: string }) {
      this.checkAccess(['manager', 'user'], 'actualizar prioridad de tareas');

      const task = await this.findTask(args.task_identifier);
      if (!task) return JSON.stringify({ error: `Task '${args.task_identifier}' not found.` });

      const { data: priorityData } = await this.supabase.from('task_priorities')
          .select('priority_id, name')
          .ilike('name', args.new_priority)
          .maybeSingle();
      
      if (!priorityData) return JSON.stringify({ error: `Priority '${args.new_priority}' not valid.` });

      const { error } = await this.supabase.from('task_issues')
          .update({ priority_id: priorityData.priority_id })
          .eq('issue_id', task.issue_id);

      if (error) throw new Error(error.message);
      return JSON.stringify({ success: true, message: `Task '${task.title}' priority updated to ${priorityData.name}.` });
  }

  async create_project(args: { name: string, key?: string, description?: string }) {
    this.checkAccess(['manager'], 'crear proyectos');

    const projectKey = args.key || args.name.substring(0, 3).toUpperCase();
    
    const { data, error } = await this.supabase.from('pm_projects').insert({
      team_id: this.ctx.teamId,
      project_name: args.name,
      project_key: projectKey,
      project_description: args.description,
      created_by_user_id: this.ctx.userId,
      project_status: 'planning', // Default per DB constraint
      priority_level: 'medium',   // Default
      health_status: 'none'       // Default
    }).select().single();

    if (error) throw new Error(`Error creating project: ${error.message}`);
    return JSON.stringify({ success: true, message: `Project '${data.project_name}' created.` });
  }

  // --- MILESTONES & CYCLES ---

  async create_milestone(args: { project_name: string, title: string, target_date: string, description?: string }) {
      this.checkAccess(['manager', 'user'], 'crear milestones');

      // Find project
      const { data: project } = await this.supabase.from('pm_projects')
          .select('project_id')
          .eq('team_id', this.ctx.teamId)
          .ilike('project_name', `%${args.project_name}%`)
          .limit(1)
          .maybeSingle();

      if (!project) return JSON.stringify({ error: `Project '${args.project_name}' not found.` });

      const { data, error } = await this.supabase.from('pm_milestones').insert({
          project_id: project.project_id,
          milestone_name: args.title,
          target_date: args.target_date,
          milestone_description: args.description,
          milestone_status: 'pending'
      }).select().single();

      if (error) throw new Error(error.message);
      return JSON.stringify({ success: true, message: `Milestone '${data.milestone_name}' created for ${args.project_name}.` });
  }

  async create_cycle(args: { name: string, start_date: string, end_date: string, description?: string }) {
      this.checkAccess(['manager'], 'crear ciclos');

      // Calculate cycle number
      const { count } = await this.supabase.from('task_cycles')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', this.ctx.teamId);
      
      const nextNum = (count || 0) + 1;

      const { data, error } = await this.supabase.from('task_cycles').insert({
          team_id: this.ctx.teamId,
          cycle_number: nextNum,
          name: args.name,
          description: args.description,
          start_date: args.start_date,
          end_date: args.end_date,
          status: 'upcoming',
          created_by: this.ctx.userId
      }).select().single();

      if (error) throw new Error(error.message);
      return JSON.stringify({ success: true, message: `Cycle '${data.name}' (Sprint #${data.cycle_number}) created.` });
  }

  async update_cycle_status(args: { name?: string, cycle_number?: number, status: string }) {
      this.checkAccess(['manager'], 'actualizar ciclos');

      let query = this.supabase.from('task_cycles').update({ status: args.status }).eq('team_id', this.ctx.teamId);

      if (args.cycle_number) {
          query = query.eq('cycle_number', args.cycle_number);
      } else if (args.name) {
          query = query.ilike('name', `%${args.name}%`);
      } else {
          return JSON.stringify({ error: "Provide either name or cycle_number." });
      }

      const { error } = await query;
      if (error) throw new Error(error.message);
      return JSON.stringify({ success: true, message: "Cycle status updated." });
  }


  // --- USER MANAGEMENT ---

  async update_user_avatar(args: { target_user_email?: string }) {
    const attachments = this.ctx.lastMessageAttachments;
    if (!attachments || attachments.length === 0) {
      return JSON.stringify({ error: "No image found in the current message." });
    }

    const { data: recentAtt } = await this.supabase.from('aria_chat_attachments')
      .select('public_url')
      .eq('user_id', this.ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentAtt || !recentAtt.public_url) return JSON.stringify({ error: "Image URL not found." });

    // Identify Target
    let targetId = this.ctx.userId;
    if (args.target_user_email) {
       const user = await this.findUser(args.target_user_email);
       if (user) targetId = user.user_id;
    }

    // Permission Check
    if (targetId !== this.ctx.userId) {
        this.checkAccess([], 'cambiar la foto de otros usuarios'); 
    } else {
        this.checkAccess(['manager', 'user'], 'cambiar tu foto de perfil'); 
    }

    const { error } = await this.supabase.from('account_users')
      .update({ avatar_url: recentAtt.public_url })
      .eq('user_id', targetId);

    if (error) throw new Error(error.message);
    return JSON.stringify({ success: true, message: `Profile picture updated!`, url: recentAtt.public_url });
  }

  async manage_team_member(args: any) {
    this.checkAccess([], 'gestionar miembros del equipo'); // Only admins

    if (args.action === 'add' || args.action === 'create') {
        let user = await this.findUser(args.email);
        if (!user) {
            const { data: newUser, error } = await this.supabase.from('account_users').insert({
                email: args.email,
                first_name: args.first_name || 'New',
                last_name_paternal: args.last_name || 'Member',
                username: args.email.split('@')[0] + Math.floor(Math.random()*1000),
                password_hash: 'temp-hash-placeholder', 
                account_status: 'active'
            }).select().single();
            if (error) return JSON.stringify({ error: error.message });
            
            // Also add to team!
            await this.supabase.from('team_members').insert({
                team_id: this.ctx.teamId,
                user_id: newUser.user_id,
                role: args.role || 'member'
            });

            return JSON.stringify({ success: true, message: `User ${args.email} created and added to team.` });
        }
        return JSON.stringify({ success: true, message: `User ${args.email} already exists.` });
    }
    
    return JSON.stringify({ error: "Action not implemented for non-create operations yet." });
  }
}
