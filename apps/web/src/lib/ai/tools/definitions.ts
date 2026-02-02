/**
 * Definiciones de herramientas para Google Gemini Function Calling
 * Estas definiciones le dicen al modelo qué acciones puede realizar y qué parámetros requiere.
 */

// Tipos de declaración de funciones para Gemini
export const ARIA_TOOLS_DEFINITIONS = [
  {
    functionDeclarations: [
      // --- TASK MANAGEMENT ---
      {
        name: 'create_task',
        description: 'Creates a new task in the project management system. Use this when the user wants to add, create, or register a task.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'The title or summary of the task.' },
            description: { type: 'STRING', description: 'Detailed description of the task requirements. Optional.' },
            priority: { type: 'STRING', description: 'Priority level: "low", "medium", "high", "urgent". Default is "medium".' },
            estimate_points: { type: 'INTEGER', description: 'Story points estimation (e.g., 1, 2, 3, 5, 8). Optional.' },
            due_date: { type: 'STRING', description: 'Due date in YYYY-MM-DD format. If user says "tomorrow" or "next friday", convert it to actual date.' },
            assignee_name_or_email: { type: 'STRING', description: 'Name or email of the user to assign the task to. If not specified, leave empty.' },
          },
          required: ['title'],
        },
      },
      {
        name: 'update_task_status',
        description: 'Updates the status of an existing task. Use when user wants to move a task, mark it as done, etc.',
        parameters: {
          type: 'OBJECT',
          properties: {
            task_identifier: { type: 'STRING', description: 'The task title or Issue Number (e.g., TEAM-123) to identify the task.' },
            new_status: { type: 'STRING', description: 'The new status name: "Backlog", "Todo", "In Progress", "Done", "Cancelled".' },
          },
          required: ['task_identifier', 'new_status'],
        },
      },
      {
        name: 'update_task_priority',
        description: 'Updates the priority of a task.',
        parameters: {
          type: 'OBJECT',
          properties: {
            task_identifier: { type: 'STRING', description: 'The task title or Issue Number.' },
            new_priority: { type: 'STRING', description: 'New priority: "low", "medium", "high", "urgent".' },
          },
          required: ['task_identifier', 'new_priority'],
        },
      },

      // --- PROJECT MANAGEMENT ---
      {
        name: 'create_project',
        description: 'Creates a new project within the team.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the project.' },
            key: { type: 'STRING', description: 'Short identifier key (e.g., "MKT" for Marketing). If not provided, generate one from the name.' },
            description: { type: 'STRING', description: 'Brief description of the project goal.' },
          },
          required: ['name'],
        },
      },

      // --- MILESTONES & CYCLES ---
      {
        name: 'create_milestone',
        description: 'Creates a new milestone for a project.',
        parameters: {
            type: 'OBJECT',
            properties: {
                project_name: { type: 'STRING', description: 'Name of the project this milestone belongs to.' },
                title: { type: 'STRING', description: 'Title of the milestone.' },
                target_date: { type: 'STRING', description: 'Target completion date (YYYY-MM-DD).' },
                description: { type: 'STRING', description: 'Optional description of the milestone.' }
            },
            required: ['project_name', 'title', 'target_date']
        }
      },
      {
        name: 'create_cycle',
        description: 'Creates a new development cycle (Sprint) for the team.',
        parameters: {
            type: 'OBJECT',
            properties: {
                name: { type: 'STRING', description: 'Name of the cycle (e.g., Sprint 1, Q1 Push).' },
                start_date: { type: 'STRING', description: 'Start date (YYYY-MM-DD).' },
                end_date: { type: 'STRING', description: 'End date (YYYY-MM-DD).' },
                description: { type: 'STRING', description: 'Goal or description of the cycle.' }
            },
            required: ['name', 'start_date', 'end_date']
        }
      },
      {
          name: 'update_cycle_status',
          description: 'Updates the status of a cycle (e.g., start or complete a sprint).',
          parameters: {
              type: 'OBJECT',
              properties: {
                  name: { type: 'STRING', description: 'Name of the cycle to update.' },
                  cycle_number: { type: 'INTEGER', description: 'Or search by cycle number if known.' },
                  status: { type: 'STRING', description: 'New status: "active", "completed", "cancelled".' }
              },
              required: ['status']
          }
      },

      // --- USER & MEMBER MANAGEMENT ---
      {
        name: 'manage_team_member',
        description: 'Manages a team member: can add new members or update existing ones (change role, suspend).',
        parameters: {
          type: 'OBJECT',
          properties: {
            email: { type: 'STRING', description: 'Email of the user to manage.' },
            action: { type: 'STRING', description: 'Action to perform: "add", "remove", "suspend", "activate", "change_role".' },
            role: { type: 'STRING', description: 'Role to assign if adding or changing role (e.g., "admin", "member").' },
            first_name: { type: 'STRING', description: 'First name (required if adding new user).' },
            last_name: { type: 'STRING', description: 'Last name (required if adding new user).' },
          },
          required: ['email', 'action'],
        },
      },
      {
        name: 'update_user_avatar',
        description: 'Updates the profile picture (avatar) of a user. Use this mainly when the user uploads an image and asks to set it as their profile picture.',
        parameters: {
          type: 'OBJECT',
          properties: {
            // Usually we infer the image from the chat context (the one just uploaded), 
            // but we might need to explicitly confirm we are doing it for the current user.
            target_user_email: { type: 'STRING', description: 'Email of the user to update. Defaults to current user if empty.' },
            image_reference: { type: 'STRING', description: 'Contextual reference to the image (e.g., "last_uploaded").' }
          },
          required: ['image_reference'],
        },
      },
    ],
  },
];
