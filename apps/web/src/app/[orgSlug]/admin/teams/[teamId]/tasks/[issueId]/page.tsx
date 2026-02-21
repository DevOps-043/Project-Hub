'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
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
  labels: Label[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
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
const formatActivityDescription = (item: ActivityItem, colors: any) => {
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

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;
  const issueId = params.issueId as string;
  const orgSlug = params.orgSlug as string;
  
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

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Fetch issue
  const fetchIssue = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const res = await fetch(`/api/admin/teams/${teamId}/issues/${issueId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setIssue(data.issue);
        setActivity(data.activity);
        setTeam(data.team);
      }

      // Fetch options for editing
      const [statusRes, priorityRes, memberRes, labelRes] = await Promise.all([
        fetch(`/api/admin/teams/${teamId}/statuses`, { headers }),
        fetch(`/api/admin/priorities`, { headers }),
        fetch(`/api/admin/teams/${teamId}/members`, { headers }),
        fetch(`/api/admin/teams/${teamId}/labels`, { headers })
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatuses(data.statuses || []);
      }
      if (priorityRes.ok) {
        const data = await priorityRes.json();
        setPriorities(data.priorities || []);
      }
      if (memberRes.ok) {
        const data = await memberRes.json();
        setMembers(data.members || []);
      }
      if (labelRes.ok) {
        const data = await labelRes.json();
        setLabels(data.labels || []);
      }
    } catch (error) {
      console.error('Error fetching issue:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId, issueId]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  // Update issue field
  const updateField = async (field: string, value: any) => {
    if (!issue) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/teams/${teamId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [field]: value })
      });

      if (res.ok) {
        fetchIssue(); // Refresh data
      }
    } catch (error) {
      console.error('Error updating issue:', error);
    }
    setActiveDropdown(null);
  };

  // Submit comment
  const submitComment = async () => {
    if (!comment.trim()) return;
    
    setSubmittingComment(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/teams/${teamId}/issues/${issueId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: comment })
      });

      if (res.ok) {
        setComment('');
        fetchIssue(); // Refresh activity
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
        <Link href={`/${orgSlug}/admin/teams/${teamId}/tasks`} className="text-sm hover:underline" style={{ color: accentColor }}>
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
              href={`/${orgSlug}/admin/teams/${teamId}/tasks`}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: colors.textMuted }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </Link>
            
            <div className="flex items-center gap-2">
              <Link href={`/${orgSlug}/admin/teams/${teamId}/tasks`} className="text-sm hover:underline" style={{ color: accentColor }}>
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
            {/* Title */}
            <h1 className="text-2xl font-bold mb-6" style={{ color: colors.textPrimary }}>
              {issue.title}
            </h1>

            {/* Description */}
            <div className="mb-8">
              {issue.description ? (
                <div 
                  className="prose prose-invert max-w-none text-sm leading-relaxed"
                  style={{ color: colors.textSecondary }}
                >
                  {issue.description}
                </div>
              ) : (
                <p className="text-sm italic" style={{ color: colors.textMuted }}>
                  Sin descripción
                </p>
              )}
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
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border }}
                      >
                        {priorities.map(p => (
                          <button
                            key={p.priority_id}
                            onClick={() => updateField('priority_id', p.priority_id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left"
                            style={{ color: colors.textPrimary }}
                          >
                            <PriorityIcon level={p.level} color={p.color} />
                            <span>{p.name}</span>
                          </button>
                        ))}
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
              <div>
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Estimación</label>
                <span className="text-sm" style={{ color: issue.estimate_points ? colors.textPrimary : colors.textMuted }}>
                  {issue.estimate_points !== null ? `${issue.estimate_points} puntos` : 'Sin estimación'}
                </span>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Fecha límite</label>
                <span className="text-sm" style={{ color: issue.due_date ? colors.textPrimary : colors.textMuted }}>
                  {issue.due_date ? format(new Date(issue.due_date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                </span>
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
