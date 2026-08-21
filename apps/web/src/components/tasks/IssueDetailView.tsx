'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import DescriptionRenderer from '@/components/diagrams/DescriptionRenderer';
import DiagramGeneratorInline from '@/components/diagrams/DiagramGeneratorInline';
import { IssueDocumentsView } from '@/components/tasks/IssueDocumentsView';
import { api } from '@/lib/api/client';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Types
interface Status {
  status_id: string;
  name: string;
  status_type: string;
  color: string;
}

interface Priority {
  priority_id: string;
  name: string;
  level: number;
  color: string;
}

interface Label {
  label_id: string;
  name: string;
  color: string;
}

interface User {
  user_id: string;
  display_name: string;
  first_name?: string;
  last_name_paternal?: string;
  avatar_url: string | null;
  email?: string;
}

interface Issue {
  issue_id: string;
  issue_number: number;
  identifier: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority | null;
  assignee: User | null;
  creator: User;
  due_date: string | null;
  estimate_points: number | null;
  project_id?: string | null;
  project?: {
    project_id: string;
    project_name: string;
    icon_color?: string | null;
  } | null;
  labels: Label[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface TeamProjectOption {
  project_id: string;
  project_name: string;
  icon_color?: string | null;
}

interface ActivityItem {
  id: string;
  type: 'history' | 'comment' | 'created';
  field_name?: string;
  old_value?: string;
  new_value?: string;
  body?: string;
  actor: User | null;
  created_at: string;
}

interface Team {
  name: string;
  slug: string;
}

// Status Icon Component
const StatusIcon = ({ type, color, size = 16 }: { type: string; color: string; size?: number }) => {
  const style = { color };
  switch (type) {
    case 'backlog':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><circle cx="12" cy="12" r="10" strokeDasharray="4 4"/></svg>;
    case 'todo':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><circle cx="12" cy="12" r="10"/></svg>;
    case 'in_progress':
      return <svg width={size} height={size} viewBox="0 0 24 24" style={style}><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
    case 'done':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/></svg>;
    case 'cancelled':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2"/></svg>;
    default:
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><circle cx="12" cy="12" r="10"/></svg>;
  }
};

// Priority Icon
const PriorityIcon = ({ level, color, size = 16 }: { level: number; color: string; size?: number }) => (
  <div className="rounded flex items-center justify-center" style={{ width: size, height: size, backgroundColor: `${color}20`, color }}>
    {level === 0 && <span style={{ fontSize: size * 0.6 }}>—</span>}
    {level === 1 && <span style={{ fontSize: size * 0.6, fontWeight: 'bold' }}>!</span>}
    {level === 2 && <span style={{ fontSize: size * 0.6, fontWeight: 'bold' }}>↑</span>}
    {level === 3 && <span style={{ fontSize: size * 0.6, fontWeight: 'bold' }}>=</span>}
    {level === 4 && <span style={{ fontSize: size * 0.6, fontWeight: 'bold' }}>↓</span>}
  </div>
);

// Avatar
const Avatar = ({ user, size = 32, color = '#00D4B3' }: { user: User | null; size?: number; color?: string }) => {
  if (!user) return null;
  const initial = user.display_name?.[0]?.toUpperCase() || user.first_name?.[0]?.toUpperCase() || '?';
  return (
    <div
      className="rounded-full flex items-center justify-center font-medium"
      style={{ width: size, height: size, backgroundColor: color, color: 'white', fontSize: size * 0.4 }}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
};

// Format activity description
const formatActivityDescription = (item: ActivityItem, colors: typeof themeColors.dark) => {
  if (item.type === 'created') {
    return <span style={{ color: colors.textSecondary }}>creó esta tarea</span>;
  }
  if (item.type === 'comment') {
    return null; // Comments show the body instead
  }

  const fieldLabels: Record<string, string> = {
    title: 'título',
    description: 'descripción',
    status_id: 'estado',
    priority_id: 'prioridad',
    assignee_id: 'asignado',
    due_date: 'fecha límite',
    estimate_points: 'estimación',
    project_id: 'proyecto',
    cycle_id: 'ciclo'
  };

  const fieldName = fieldLabels[item.field_name || ''] || item.field_name;

  if (item.field_name === 'status_id') {
    return (
      <span style={{ color: colors.textSecondary }}>
        cambió el estado de <strong>{item.old_value || 'ninguno'}</strong> a <strong style={{ color: '#00D4B3' }}>{item.new_value}</strong>
      </span>
    );
  }

  if (item.field_name === 'assignee_id') {
    if (!item.old_value && item.new_value) {
      return <span style={{ color: colors.textSecondary }}>asignó a <strong>{item.new_value}</strong></span>;
    }
    if (item.old_value && !item.new_value) {
      return <span style={{ color: colors.textSecondary }}>removió la asignación de <strong>{item.old_value}</strong></span>;
    }
    return <span style={{ color: colors.textSecondary }}>cambió asignado de <strong>{item.old_value}</strong> a <strong>{item.new_value}</strong></span>;
  }

  return (
    <span style={{ color: colors.textSecondary }}>
      actualizó {fieldName}
    </span>
  );
};

// Custom Calendar Picker - SOFIA Design System
const CalendarPicker = ({ selectedDate, onSelect, accentColor, colors, isDark }: {
  selectedDate: Date | null;
  onSelect: (date: Date | null) => void;
  accentColor: string;
  colors: typeof themeColors.dark;
  isDark: boolean;
}) => {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Get first day of month (Mon=0 ... Sun=6)
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; currentMonth: boolean; date: Date }[] = [];

  // Previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push({ day: d, currentMonth: false, date: new Date(year, month - 1, d) });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
  }
  // Next month days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, currentMonth: false, date: new Date(year, month + 1, d) });
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: colors.textMuted }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
          {monthNames[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: colors.textMuted }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[10px] font-medium py-1" style={{ color: colors.textMuted }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((cell, i) => {
          const isToday = isSameDay(cell.date, today);
          const isSelected = selectedDate && isSameDay(cell.date, selectedDate);

          return (
            <button
              key={i}
              onClick={() => onSelect(cell.date)}
              className="flex items-center justify-center text-xs rounded-lg transition-all"
              style={{
                width: '36px',
                height: '32px',
                color: isSelected ? '#fff' : isToday ? accentColor : cell.currentMonth ? colors.textPrimary : colors.textMuted + '60',
                backgroundColor: isSelected ? '#0A2540' : isToday ? `${accentColor}15` : 'transparent',
                fontWeight: isToday || isSelected ? 600 : 400,
                border: isToday && !isSelected ? `1px solid ${accentColor}40` : '1px solid transparent',
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: colors.border }}>
        <button
          onClick={() => onSelect(today)}
          className="text-xs font-medium px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: accentColor }}
        >
          Hoy
        </button>
        {selectedDate && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs font-medium px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: colors.textMuted }}
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
};

interface IssueDetailViewProps {
  /** Ruta base del panel (p.ej. "/admin" o "/{orgSlug}/admin"), ya resuelta por el wrapper de ruta. */
  panelBase: string;
  workspaceSlug?: string;
}

/**
 * Vista de detalle de tarea. Compartida entre /admin/teams/[teamId]/tasks/[issueId]
 * y /[orgSlug]/admin/teams/[teamId]/tasks/[issueId], que eran implementaciones
 * duplicadas casi idénticas (~92% del código). panelBase se recibe como prop en
 * vez de calcularse aquí porque useWorkspace() solo funciona dentro de
 * WorkspaceProvider (layout de /[orgSlug]/*), y este componente también se monta
 * fuera de ese árbol en las rutas /admin/* planas.
 */
export default function IssueDetailView({ panelBase, workspaceSlug }: IssueDetailViewProps) {
  const params = useParams();
  const teamId = params.teamId as string;
  const issueId = params.issueId as string;

  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const accentColor = '#00D4B3';
  const primaryColor = '#0A2540';

  // State
  const [issue, setIssue] = useState<Issue | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Available options for editing
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [teamProjects, setTeamProjects] = useState<TeamProjectOption[]>([]);

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Inline editing states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch issue
  const fetchIssue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await api.get<{ issue: Issue; activity: ActivityItem[]; team: Team; teamProjects?: TeamProjectOption[] }>(
        `/api/admin/teams/${teamId}/issues/${issueId}`
      );
      if (!error && data) {
        setIssue(data.issue);
        setActivity(data.activity);
        setTeam(data.team);
        if (data.teamProjects) setTeamProjects(data.teamProjects);
      }

      // Fetch options for editing (only on initial load)
      if (!silent) {
        const [statusResult, priorityResult, memberResult, labelResult] = await Promise.all([
          api.get<{ statuses?: Status[] }>(`/api/admin/teams/${teamId}/statuses`),
          api.get<{ priorities?: Priority[] }>(`/api/admin/priorities`),
          api.get<{ members?: User[] }>(`/api/admin/teams/${teamId}/members`),
          api.get<{ labels?: Label[] }>(`/api/admin/teams/${teamId}/labels`)
        ]);

        if (!statusResult.error && statusResult.data) {
          setStatuses(statusResult.data.statuses || []);
        }
        if (!priorityResult.error && priorityResult.data) {
          setPriorities(priorityResult.data.priorities || []);
        }
        if (!memberResult.error && memberResult.data) {
          setMembers(memberResult.data.members || []);
        }
        if (!labelResult.error && labelResult.data) {
          setLabels(labelResult.data.labels || []);
        }
      }
    } catch (error) {
      console.error('Error fetching issue:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [teamId, issueId]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  // Update issue field - optimistic update
  const updateField = async (field: string, value: string | number | null) => {
    if (!issue) return;
    setActiveDropdown(null);

    // Optimistic update: immediately update local state
    setIssue(prev => {
      if (!prev) return prev;
      const updated: Issue & Record<string, unknown> = { ...prev, updated_at: new Date().toISOString() };

      if (field === 'status_id') {
        const newStatus = statuses.find(s => s.status_id === value);
        if (newStatus) {
          updated.status_id = value;
          updated.status = newStatus;
        }
      } else if (field === 'priority_id') {
        const newPriority = priorities.find(p => p.priority_id === value);
        updated.priority_id = value;
        updated.priority = newPriority || null;
      } else if (field === 'assignee_id') {
        if (value === null) {
          updated.assignee_id = null;
          updated.assignee = null;
        } else {
          const newAssignee = members.find(m => m.user_id === value);
          if (newAssignee) {
            updated.assignee_id = value;
            updated.assignee = newAssignee;
          }
        }
      } else if (field === 'project_id') {
        if (value === null) {
          updated.project_id = null;
          updated.project = null;
        } else {
          const newProject = teamProjects.find(p => p.project_id === value);
          updated.project_id = value as string;
          updated.project = newProject || null;
        }
      } else {
        updated[field] = value;
      }

      return updated;
    });

    // Send update to server
    try {
      const { error } = await api.patch(`/api/admin/teams/${teamId}/issues/${issueId}`, { [field]: value });

      if (!error) {
        // Silently refresh to sync activity feed
        fetchIssue(true);
      } else {
        // Revert on error - full refresh
        console.error('Error updating, reverting...');
        fetchIssue(true);
      }
    } catch (error) {
      console.error('Error updating issue:', error);
      fetchIssue(true);
    }
  };

  // Submit comment
  const submitComment = async () => {
    if (!comment.trim()) return;

    setSubmittingComment(true);
    try {
      const { error } = await api.post(`/api/admin/teams/${teamId}/issues/${issueId}/comments`, { content: comment });

      if (!error) {
        setComment('');
        fetchIssue(true); // Refresh activity silently
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Format relative time
  const formatRelativeTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor }} />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ backgroundColor: colors.bgPrimary }}>
        <p style={{ color: colors.textSecondary }}>Tarea no encontrada</p>
        <Link href={`${panelBase}/teams/${teamId}/tasks`} className="text-sm hover:underline" style={{ color: accentColor }}>
          Volver a tareas
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgPrimary }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{ backgroundColor: `${colors.bgPrimary}CC`, borderColor: colors.border }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`${panelBase}/teams/${teamId}/tasks`}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: colors.textMuted }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </Link>

            <div className="flex items-center gap-2">
              <Link href={`${panelBase}/teams/${teamId}/tasks`} className="text-sm hover:underline" style={{ color: accentColor }}>
                {team?.name || 'Equipo'}
              </Link>
              <span style={{ color: colors.textMuted }}>/</span>
              <span className="font-mono text-sm font-medium" style={{ color: colors.textPrimary }}>
                {issue.identifier}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSubscribed(!isSubscribed)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: isSubscribed ? `${accentColor}20` : 'transparent',
                color: isSubscribed ? accentColor : colors.textMuted,
                border: `1px solid ${colors.border}`
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isSubscribed ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {isSubscribed ? 'Suscrito' : 'Suscribirse'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Left Panel - Issue Content */}
          <div className="flex-1 min-w-0">
            {/* Title - Editable */}
            {editingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  if (titleDraft.trim() && titleDraft.trim() !== issue.title) {
                    updateField('title', titleDraft.trim());
                  }
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                  if (e.key === 'Escape') {
                    setTitleDraft(issue.title);
                    setEditingTitle(false);
                  }
                }}
                className="text-2xl font-bold mb-6 w-full bg-transparent py-1 focus:ring-0 focus:outline-none focus:border-0 ring-0"
                style={{
                  color: colors.textPrimary,
                  border: 'none',
                  borderBottom: `2px solid ${accentColor}`,
                  borderRadius: 0,
                  outline: 'none',
                  boxShadow: 'none',
                  WebkitAppearance: 'none',
                }}
                autoFocus
              />
            ) : (
              <h1
                className="text-2xl font-bold mb-6 cursor-text rounded-lg px-1 -mx-1 transition-colors hover:bg-white/5"
                style={{ color: colors.textPrimary }}
                onClick={() => {
                  setTitleDraft(issue.title);
                  setEditingTitle(true);
                  setTimeout(() => titleInputRef.current?.focus(), 0);
                }}
                title="Clic para editar el título"
              >
                {issue.title}
              </h1>
            )}

            {/* Description - Editable */}
            <div className="mb-8">
              {editingDescription ? (
                <textarea
                  ref={descriptionInputRef}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={() => {
                    const newDesc = descriptionDraft.trim();
                    if (newDesc !== (issue.description || '')) {
                      updateField('description', newDesc || null);
                    }
                    setEditingDescription(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDescriptionDraft(issue.description || '');
                      setEditingDescription(false);
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.currentTarget.blur();
                    }
                  }}
                  rows={5}
                  className="w-full bg-transparent p-4 text-sm leading-relaxed resize-y focus:ring-0 focus:outline-none focus:border-0 ring-0"
                  style={{
                    color: colors.textSecondary,
                    border: 'none',
                    borderBottom: `2px solid ${accentColor}`,
                    borderRadius: 0,
                    outline: 'none',
                    boxShadow: 'none',
                    WebkitAppearance: 'none',
                  }}
                  placeholder="Agrega una descripción..."
                  autoFocus
                />
              ) : (
                <div
                  className="cursor-text rounded-xl px-4 py-3 -mx-4 transition-colors hover:bg-white/5 min-h-[60px]"
                  onClick={() => {
                    setDescriptionDraft(issue.description || '');
                    setEditingDescription(true);
                    setTimeout(() => descriptionInputRef.current?.focus(), 0);
                  }}
                  title="Clic para editar la descripción"
                >
                  {issue.description ? (
                    <DescriptionRenderer
                      description={issue.description}
                      textClassName="text-sm leading-relaxed"
                      className="prose prose-invert max-w-none"
                    />
                  ) : (
                    <p className="text-sm italic" style={{ color: colors.textMuted }}>
                      Clic para agregar descripción...
                    </p>
                  )}
                </div>
              )}

              {/* Diagram generator - always visible */}
              <div className="mt-3">
                <DiagramGeneratorInline
                  context={{
                    type: 'issue',
                    title: issue.title,
                    description: issue.description,
                    projectName: issue.project?.project_name,
                    status: issue.status?.name,
                    priority: issue.priority?.name,
                    labels: issue.labels?.map((l: Label) => l.name),
                    teamName: team?.name,
                    dueDate: issue.due_date,
                    estimatePoints: issue.estimate_points,
                  }}
                  onInsert={(code) => {
                    const fence = `\n\`\`\`mermaid\n${code}\n\`\`\``;
                    const newDesc = (issue.description || '') + fence;
                    updateField('description', newDesc);
                  }}
                />
              </div>
            </div>

            {/* Documents Section */}
            <div className="mb-8 border-t pt-8" style={{ borderColor: colors.border }}>
              <IssueDocumentsView issueId={issueId} teamId={teamId} workspaceSlug={workspaceSlug} />
            </div>

            {/* Activity Section */}
            <div className="border-t pt-8" style={{ borderColor: colors.border }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                  Actividad
                </h2>
                <button
                  onClick={() => setIsSubscribed(!isSubscribed)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                >
                  Suscribirse
                </button>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-4 mb-6">
                {activity.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex gap-3"
                  >
                    <Avatar user={item.actor} size={28} color={accentColor} />
                    <div className="flex-1 min-w-0">
                      {item.type === 'comment' ? (
                        <div
                          className="p-4 rounded-xl"
                          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                              {item.actor?.display_name || 'Usuario'}
                            </span>
                            <span className="text-xs" style={{ color: colors.textMuted }}>
                              {formatRelativeTime(item.created_at)}
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: colors.textSecondary }}>
                            {item.body}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                            {item.actor?.display_name || 'Usuario'}
                          </span>
                          {formatActivityDescription(item, colors)}
                          <span className="text-xs" style={{ color: colors.textMuted }}>
                            · {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="flex gap-3">
                <Avatar user={issue.creator} size={32} color={accentColor} />
                <div className="flex-1">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Escribe un comentario..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border resize-none text-sm"
                    style={{
                      backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        submitComment();
                      }
                    }}
                  />
                  <div className="flex justify-end mt-2 gap-2">
                    <button
                      onClick={submitComment}
                      disabled={!comment.trim() || submittingComment}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {submittingComment ? 'Enviando...' : 'Comentar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Properties */}
          <aside className="w-72 shrink-0">
            <div
              className="sticky top-24 rounded-xl border p-4 space-y-4"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: colors.border }}
            >
              <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                Propiedades
              </h3>

              {/* Status */}
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Estado</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: colors.textPrimary }}
                >
                  <StatusIcon type={issue.status.status_type} color={issue.status.color} />
                  <span>{issue.status.name}</span>
                </button>

                <AnimatePresence>
                  {activeDropdown === 'status' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl border shadow-xl z-50"
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border }}
                      >
                        {statuses.map(s => (
                          <button
                            key={s.status_id}
                            onClick={() => updateField('status_id', s.status_id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left"
                            style={{ color: colors.textPrimary }}
                          >
                            <StatusIcon type={s.status_type} color={s.color} />
                            <span>{s.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Priority */}
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Prioridad</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'priority' ? null : 'priority')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: colors.textPrimary }}
                >
                  {issue.priority ? (
                    <>
                      <PriorityIcon level={issue.priority.level} color={issue.priority.color} />
                      <span>{issue.priority.name}</span>
                    </>
                  ) : (
                    <span style={{ color: colors.textMuted }}>Sin prioridad</span>
                  )}
                </button>

                <AnimatePresence>
                  {activeDropdown === 'priority' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl border shadow-xl z-50"
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border, minHeight: '40px' }}
                      >
                        {priorities.length === 0 ? (
                          <div className="px-3 py-2 text-sm" style={{ color: colors.textMuted }}>
                            Cargando prioridades...
                          </div>
                        ) : (
                          priorities.map(p => (
                            <button
                              key={p.priority_id}
                              onClick={() => updateField('priority_id', p.priority_id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left"
                              style={{ color: colors.textPrimary }}
                            >
                              <PriorityIcon level={p.level} color={p.color} />
                              <span>{p.name}</span>
                            </button>
                          ))
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Assignee */}
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Asignado</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'assignee' ? null : 'assignee')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: colors.textPrimary }}
                >
                  {issue.assignee ? (
                    <>
                      <Avatar user={issue.assignee} size={20} color={accentColor} />
                      <span>{issue.assignee.display_name}</span>
                    </>
                  ) : (
                    <span style={{ color: colors.textMuted }}>Sin asignar</span>
                  )}
                </button>

                <AnimatePresence>
                  {activeDropdown === 'assignee' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl border shadow-xl z-50 max-h-48 overflow-y-auto"
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border }}
                      >
                        <button
                          onClick={() => updateField('assignee_id', null)}
                          className="w-full px-3 py-2 text-sm hover:bg-white/5 text-left"
                          style={{ color: colors.textMuted }}
                        >
                          Sin asignar
                        </button>
                        {members.map(m => (
                          <button
                            key={m.user_id}
                            onClick={() => updateField('assignee_id', m.user_id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left"
                            style={{ color: colors.textPrimary }}
                          >
                            <Avatar user={m} size={20} color={accentColor} />
                            <span>{m.display_name}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Project (read-only) */}
              <div>
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Proyecto</label>
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  {issue.project ? (
                    <>
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: issue.project.icon_color || '#3B82F6' }}
                      />
                      <span style={{ color: colors.textPrimary }}>{issue.project.project_name}</span>
                    </>
                  ) : (
                    <span style={{ color: colors.textMuted }}>Sin proyecto</span>
                  )}
                </div>
              </div>

              {/* Labels */}
              <div>
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Etiquetas</label>
                {issue.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {issue.labels.map(label => (
                      <span
                        key={label.label_id}
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${label.color}20`, color: label.color }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <button
                    className="text-sm px-3 py-2 rounded-lg transition-colors hover:bg-white/5 w-full text-left"
                    style={{ color: colors.textMuted }}
                  >
                    + Añadir etiqueta
                  </button>
                )}
              </div>

              {/* Estimate */}
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Estimación</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'estimate' ? null : 'estimate')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: issue.estimate_points !== null ? colors.textPrimary : colors.textMuted }}
                >
                  {issue.estimate_points !== null ? `${issue.estimate_points} puntos` : 'Sin estimación'}
                </button>

                <AnimatePresence>
                  {activeDropdown === 'estimate' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute bottom-full left-0 right-0 mb-1 py-2 rounded-xl border shadow-xl z-50"
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border }}
                      >
                        <div className="px-3 pb-2 mb-1 border-b text-xs font-medium" style={{ color: colors.textMuted, borderColor: colors.border }}>
                          Seleccionar puntos
                        </div>
                        <button
                          onClick={() => updateField('estimate_points', null)}
                          className="w-full px-3 py-1.5 text-xs hover:bg-white/5 text-left"
                          style={{ color: colors.textMuted }}
                        >
                          Sin estimación
                        </button>
                        <div className="grid grid-cols-5 gap-1 px-2 pt-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pts => (
                            <button
                              key={pts}
                              onClick={() => updateField('estimate_points', pts)}
                              className="flex items-center justify-center py-1.5 rounded-lg text-sm font-medium transition-all"
                              style={{
                                color: issue.estimate_points === pts ? '#fff' : colors.textPrimary,
                                backgroundColor: issue.estimate_points === pts ? '#00D4B3' : 'transparent',
                                border: `1px solid ${issue.estimate_points === pts ? '#00D4B3' : colors.border}`,
                              }}
                            >
                              {pts}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Due Date - Custom Calendar */}
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Fecha límite</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'duedate' ? null : 'duedate')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: issue.due_date ? colors.textPrimary : colors.textMuted }}
                >
                  <span>{issue.due_date ? format(new Date(issue.due_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>

                <AnimatePresence>
                  {activeDropdown === 'duedate' && (() => {
                    const today = new Date();
                    const selectedDate = issue.due_date ? new Date(issue.due_date + 'T12:00:00') : null;
                    const viewMonth = selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);

                    return (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute bottom-full left-0 mb-1 p-3 rounded-xl border shadow-xl z-50"
                          style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border, width: '280px', right: 0 }}
                        >
                          {/* Calendar Component */}
                          <CalendarPicker
                            selectedDate={selectedDate}
                            onSelect={(date) => {
                              if (date) {
                                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                updateField('due_date', dateStr);
                              } else {
                                updateField('due_date', null);
                              }
                              setActiveDropdown(null);
                            }}
                            accentColor="#00D4B3"
                            colors={colors}
                            isDark={isDark}
                          />
                        </motion.div>
                      </>
                    );
                  })()}
                </AnimatePresence>
              </div>

              {/* Dates */}
              <div className="border-t pt-4 space-y-2" style={{ borderColor: colors.border }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: colors.textMuted }}>Creado</span>
                  <span style={{ color: colors.textSecondary }}>{formatRelativeTime(issue.created_at)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: colors.textMuted }}>Actualizado</span>
                  <span style={{ color: colors.textSecondary }}>{formatRelativeTime(issue.updated_at)}</span>
                </div>
                {issue.completed_at && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: colors.textMuted }}>Completado</span>
                    <span style={{ color: accentColor }}>{formatRelativeTime(issue.completed_at)}</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
