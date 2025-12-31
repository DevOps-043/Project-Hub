'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ArrowLeft, Bell, BellOff, CheckCircle2, Circle, 
  AlertCircle, Clock, User, Tag, Calendar, Hash
} from 'lucide-react';

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

interface UserInfo {
  user_id: string;
  display_name: string;
  first_name?: string;
  avatar_url: string | null;
}

interface Issue {
  issue_id: string;
  issue_number: number;
  identifier: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority | null;
  assignee: UserInfo | null;
  creator: UserInfo;
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
  actor: UserInfo | null;
  created_at: string;
}

// Status Icon
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
const Avatar = ({ user, size = 32, color = '#00D4B3' }: { user: UserInfo | null; size?: number; color?: string }) => {
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

export default function ProjectIssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const issueId = params.issueId as string;
  
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const accentColor = '#00D4B3';
  const primaryColor = '#0A2540';

  // State
  const [issue, setIssue] = useState<Issue | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit options
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [members, setMembers] = useState<UserInfo[]>([]);
  const [labelOptions, setLabelOptions] = useState<Label[]>([]);

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Editable fields
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');

  // Fetch issue
  const fetchIssue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/issues/${issueId}`);
      if (res.ok) {
        const data = await res.json();
        setIssue(data.issue);
        setActivity(data.activity || []);
        setProject(data.project);
        setStatuses(data.statuses || []);
        setPriorities(data.priorities || []);
        setMembers(data.members || []);
        setLabelOptions(data.labelOptions || []);
        setTitleValue(data.issue?.title || '');
        setDescValue(data.issue?.description || '');
      } else {
        console.error('Failed to fetch issue');
      }
    } catch (error) {
      console.error('Error fetching issue:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  // Update field
  const updateField = async (field: string, value: any) => {
    if (!issue) return;
    setSaving(true);
    
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });

      if (res.ok) {
        fetchIssue();
      }
    } catch (error) {
      console.error('Error updating issue:', error);
    } finally {
      setSaving(false);
      setActiveDropdown(null);
    }
  };

  // Save title
  const saveTitle = () => {
    if (titleValue.trim() && titleValue !== issue?.title) {
      updateField('title', titleValue.trim());
    }
    setEditingTitle(false);
  };

  // Save description
  const saveDesc = () => {
    if (descValue !== issue?.description) {
      updateField('description', descValue);
    }
    setEditingDesc(false);
  };

  // Format relative time
  const formatRelativeTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor }} />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p style={{ color: colors.textSecondary }}>Tarea no encontrada</p>
        <Link href={`/admin/projects/${projectId}`} className="text-sm hover:underline" style={{ color: accentColor }}>
          Volver al proyecto
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header 
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{ backgroundColor: `${colors.bgPrimary}CC`, borderColor: colors.border }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href={`/admin/projects/${projectId}`}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: colors.textMuted }}
            >
              <ArrowLeft size={20} />
            </Link>
            
            <div className="flex items-center gap-2">
              <Link href={`/admin/projects/${projectId}`} className="text-sm hover:underline" style={{ color: accentColor }}>
                {project?.project_name || 'Proyecto'}
              </Link>
              <span style={{ color: colors.textMuted }}>/</span>
              <span className="font-mono text-sm font-medium" style={{ color: colors.textPrimary }}>
                {issue.identifier}
              </span>
            </div>
          </div>

          {saving && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
              Guardando...
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Left Panel - Issue Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            {editingTitle ? (
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                autoFocus
                className="w-full text-2xl font-bold mb-6 bg-transparent border-b-2 outline-none py-1"
                style={{ color: colors.textPrimary, borderColor: accentColor }}
              />
            ) : (
              <h1 
                className="text-2xl font-bold mb-6 cursor-pointer hover:opacity-80 transition-opacity" 
                style={{ color: colors.textPrimary }}
                onClick={() => setEditingTitle(true)}
              >
                {issue.title}
              </h1>
            )}

            {/* Description */}
            <div className="mb-8">
              {editingDesc ? (
                <div>
                  <textarea
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    rows={6}
                    autoFocus
                    className="w-full p-4 rounded-xl border resize-none text-sm"
                    style={{
                      backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={saveDesc}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => { setDescValue(issue.description || ''); setEditingDesc(false); }}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ color: colors.textMuted }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setEditingDesc(true)}
                >
                  {issue.description ? (
                    <div 
                      className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ color: colors.textSecondary }}
                    >
                      {issue.description}
                    </div>
                  ) : (
                    <p className="text-sm italic" style={{ color: colors.textMuted }}>
                      Haz clic para añadir una descripción...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Activity Section */}
            <div className="border-t pt-8" style={{ borderColor: colors.border }}>
              <h2 className="text-lg font-semibold mb-6" style={{ color: colors.textPrimary }}>
                Actividad
              </h2>

              <div className="space-y-4">
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
                      ) : item.type === 'created' ? (
                        <div className="flex items-center gap-2 py-2">
                          <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                            {item.actor?.display_name || 'Usuario'}
                          </span>
                          <span style={{ color: colors.textSecondary }}>creó esta tarea</span>
                          <span className="text-xs" style={{ color: colors.textMuted }}>
                            · {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                            {item.actor?.display_name || 'Usuario'}
                          </span>
                          <span style={{ color: colors.textSecondary }}>
                            actualizó {item.field_name}
                          </span>
                          <span className="text-xs" style={{ color: colors.textMuted }}>
                            · {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
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
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Etiquetas</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'labels' ? null : 'labels')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: colors.textPrimary }}
                >
                  {issue.labels && issue.labels.length > 0 ? (
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
                    <span style={{ color: colors.textMuted }}>+ Añadir etiqueta</span>
                  )}
                </button>
                
                <AnimatePresence>
                  {activeDropdown === 'labels' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl border shadow-xl z-50 max-h-48 overflow-y-auto"
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border }}
                      >
                        {labelOptions.length > 0 ? labelOptions.map(label => {
                          const isSelected = issue.labels?.some(l => l.label_id === label.label_id);
                          return (
                            <button
                              key={label.label_id}
                              onClick={() => {
                                // Toggle label - for now just show it's available
                                // Full implementation would need a separate API endpoint
                                setActiveDropdown(null);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left ${isSelected ? 'bg-white/5' : ''}`}
                              style={{ color: colors.textPrimary }}
                            >
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: label.color }}
                              />
                              <span>{label.name}</span>
                              {isSelected && <span className="ml-auto text-xs" style={{ color: accentColor }}>✓</span>}
                            </button>
                          );
                        }) : (
                          <div className="px-3 py-2 text-sm" style={{ color: colors.textMuted }}>
                            No hay etiquetas disponibles
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Due Date */}
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Fecha límite</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'dueDate' ? null : 'dueDate')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: issue.due_date ? colors.textPrimary : colors.textMuted }}
                >
                  <Calendar size={14} />
                  <span>{issue.due_date ? format(new Date(issue.due_date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}</span>
                </button>
                
                <AnimatePresence>
                  {activeDropdown === 'dueDate' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-1 p-3 rounded-xl border shadow-xl z-50"
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border }}
                      >
                        <input
                          type="date"
                          defaultValue={issue.due_date ? issue.due_date.split('T')[0] : ''}
                          onChange={(e) => {
                            updateField('due_date', e.target.value || null);
                          }}
                          className="w-full px-3 py-2 rounded-lg border text-sm"
                          style={{
                            backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                            borderColor: colors.border,
                            color: colors.textPrimary
                          }}
                        />
                        <button
                          onClick={() => updateField('due_date', null)}
                          className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg"
                          style={{ color: colors.textMuted }}
                        >
                          Quitar fecha
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Estimate */}
              <div className="relative">
                <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Estimación</label>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'estimate' ? null : 'estimate')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: issue.estimate_points ? colors.textPrimary : colors.textMuted }}
                >
                  <Hash size={14} />
                  <span>{issue.estimate_points !== null ? `${issue.estimate_points} puntos` : 'Sin estimación'}</span>
                </button>
                
                <AnimatePresence>
                  {activeDropdown === 'estimate' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-1 p-3 rounded-xl border shadow-xl z-50"
                        style={{ backgroundColor: isDark ? '#1E2329' : '#fff', borderColor: colors.border }}
                      >
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          {[1, 2, 3, 5, 8, 13, 21, null].map((points, idx) => (
                            <button
                              key={idx}
                              onClick={() => updateField('estimate_points', points)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                issue.estimate_points === points ? 'ring-2' : ''
                              }`}
                              style={{
                                backgroundColor: issue.estimate_points === points ? `${accentColor}20` : isDark ? '#0F1419' : '#F9FAFB',
                                color: issue.estimate_points === points ? accentColor : colors.textPrimary,
                                ringColor: accentColor
                              }}
                            >
                              {points !== null ? points : '—'}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Metadata */}
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
