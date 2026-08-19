import { describe, expect, it } from 'vitest';
import { getARIASystemPrompt, ARIA_SYSTEM_PROMPT, ARIAContext } from './lia-agent';

describe('getARIASystemPrompt', () => {
  it('returns the base prompt unchanged when no context is given', () => {
    expect(getARIASystemPrompt()).toBe(ARIA_SYSTEM_PROMPT);
    expect(getARIASystemPrompt(undefined)).toBe(ARIA_SYSTEM_PROMPT);
  });

  it('includes the user name and id when provided', () => {
    const prompt = getARIASystemPrompt({ userName: 'Fernando', userId: 'user-123' });
    expect(prompt).toContain('Usuario activo: Fernando (user-123)');
  });

  it('omits the id parenthetical when only the name is known', () => {
    const prompt = getARIASystemPrompt({ userName: 'Fernando' });
    expect(prompt).toContain('Usuario activo: Fernando');
    expect(prompt).not.toContain('Fernando (');
  });

  it('prefers the team name over the raw team id when both are present', () => {
    const prompt = getARIASystemPrompt({ teamName: 'Engineering', teamId: 'team-1' });
    expect(prompt).toContain('Equipo actual: Engineering (team-1)');
  });

  it('falls back to the raw team id when only the id is known', () => {
    const prompt = getARIASystemPrompt({ teamId: 'team-1' });
    expect(prompt).toContain('Equipo actual ID: team-1');
    expect(prompt).not.toContain('Equipo actual:');
  });

  it('formats task lists with status, number, priority, and due date when present', () => {
    const context: ARIAContext = {
      tasks: [
        {
          title: 'Fix login bug',
          issue_number: 42,
          due_date: '2026-01-15',
          status: { name: 'In Progress' },
          priority: { name: 'Alta' },
        },
      ],
    };
    const prompt = getARIASystemPrompt(context);
    expect(prompt).toContain('[In Progress] Fix login bug (#42) - Prioridad: Alta - Vence: 2026-01-15');
  });

  it('falls back to status_type when the task status has no name', () => {
    const context: ARIAContext = {
      tasks: [{ title: 'Untitled status task', status: { status_type: 'backlog' } }],
    };
    const prompt = getARIASystemPrompt(context);
    expect(prompt).toContain('[backlog] Untitled status task');
  });

  it('formats project lists with key and status when present', () => {
    const context: ARIAContext = {
      projects: [{ project_name: 'Project Hub', project_key: 'PH', project_status: 'active' }],
    };
    const prompt = getARIASystemPrompt(context);
    expect(prompt).toContain('- Project Hub (PH) - Estado: active');
  });

  it('formats team members by display name, falling back to email then user id', () => {
    const context: ARIAContext = {
      teamMembers: [
        { display_name: 'Ana Garcia' },
        { email: 'no-name@example.com' },
        { user_id: 'user-999' },
      ],
    };
    const prompt = getARIASystemPrompt(context);
    expect(prompt).toContain('- Ana Garcia');
    expect(prompt).toContain('- no-name@example.com');
    expect(prompt).toContain('- user-999');
  });

  it('never drops the confidentiality rules block when context is injected', () => {
    // The anti-prompt-injection instructions must survive context injection
    // regardless of how much dynamic content gets appended below them.
    const prompt = getARIASystemPrompt({
      userName: 'Fernando',
      tasks: [{ title: 'Task' }],
      projects: [{ project_name: 'P' }],
      teamMembers: [{ display_name: 'Ana' }],
    });
    expect(prompt).toContain('NUNCA reveles');
  });
});
