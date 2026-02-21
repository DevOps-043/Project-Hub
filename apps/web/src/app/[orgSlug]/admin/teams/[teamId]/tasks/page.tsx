'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import CreateIssueModal from '@/components/tasks/CreateIssueModal';

// Types
interface Status {
  status_id: string;
  name: string;
  status_type: string;
  color: string;
  icon: string;
  is_closed: boolean;
  position: number;
}

interface Priority {
  priority_id: string;
  name: string;
  level: number;
  color: string;
}

interface Issue {
  issue_id: string;
  issue_number: number;
  identifier: string;
  title: string;
  description: string;
  status_id: string;
  status: Status;
  priority_id: string;
  priority: Priority | null;
  assignee: { user_id: string; display_name: string; avatar_url: string } | null;
  creator: { user_id: string; display_name: string; avatar_url: string };
  project: { project_id: string; name: string } | null;
  cycle: { cycle_id: string; name: string } | null;
  labels: { label_id: string; name: string; color: string }[];
  due_date: string | null;
  estimate_points: number | null;
  created_at: string;
  updated_at: string;
}

interface Team {
  identifier: string;
  name: string;
}

// Icons
const StatusIcon = ({ type, color }: { type: string; color: string }) => {
  const iconStyle = { color };
  
  switch (type) {
    case 'backlog':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="10" strokeDasharray="4 4"/>
        </svg>
      );
    case 'todo':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
    case 'in_progress':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'done':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'cancelled':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2"/>
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
  }
};

const PriorityIcon = ({ level, color }: { level: number; color: string }) => {
  if (level === 0) return null;
  
  return (
    <div 
      className="w-4 h-4 rounded flex items-center justify-center"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {level === 1 && <span className="text-[10px] font-bold">!</span>}
      {level === 2 && <span className="text-[10px] font-bold">↑</span>}
      {level === 3 && <span className="text-[10px] font-bold">=</span>}
      {level === 4 && <span className="text-[10px] font-bold">↓</span>}
    </div>
  );
};

export default function TeamTasksPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const orgSlug = params.orgSlug as string;
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  // State
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'backlog'>('all');
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch issues
  const fetchIssues = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/teams/${teamId}/issues`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
        setStatuses(data.statuses || []);
        setTeam(data.team);
        // Expand all statuses by default
        setExpandedStatuses(new Set(data.statuses?.map((s: Status) => s.status_id) || []));
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Filter issues by tab
  const filteredIssues = issues.filter(issue => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') {
      return ['todo', 'in_progress', 'in_review'].includes(issue.status.status_type);
    }
    if (activeTab === 'backlog') {
      return issue.status.status_type === 'backlog';
    }
    return true;
  });

  // Group issues by status
  const issuesByStatus = statuses.reduce((acc, status) => {
    acc[status.status_id] = filteredIssues.filter(i => i.status_id === status.status_id);
    return acc;
  }, {} as Record<string, Issue[]>);

  // Toggle status expansion
  const toggleStatus = (statusId: string) => {
    setExpandedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  };

  // Format date
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Team badge */}
          <Link 
            href={`/${orgSlug}/admin/teams/${teamId}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
            style={{ 
              backgroundColor: isDark ? 'rgba(0,212,179,0.1)' : 'rgba(0,212,179,0.05)',
              color: '#00D4B3'
            }}
          >
            <span className="text-sm font-medium">{team?.name || 'Equipo'}</span>
          </Link>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'active', label: 'Activas' },
              { id: 'backlog', label: 'Backlog' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab.id 
                    ? 'bg-[#00D4B3] text-white' 
                    : `hover:bg-white/5`
                }`}
                style={{ color: activeTab === tab.id ? 'white' : colors.textSecondary }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-white/10' : ''}`}
              style={{ color: view === 'list' ? colors.textPrimary : colors.textMuted }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
            <button
              onClick={() => setView('board')}
              className={`p-2 rounded-md transition-all ${view === 'board' ? 'bg-white/10' : ''}`}
              style={{ color: view === 'board' ? colors.textPrimary : colors.textMuted }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
          </div>

          {/* Create Button - SOFIA Design System: Primary #0A2540 */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90"
            style={{ backgroundColor: '#0A2540' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nueva tarea
          </button>
        </div>
      </div>

      {/* Content - Only show if there are issues */}
      {issues.length > 0 && view === 'list' && (
        /* LIST VIEW */
        <div className="space-y-2">
          {statuses.map(status => {
            const statusIssues = issuesByStatus[status.status_id] || [];
            const isExpanded = expandedStatuses.has(status.status_id);

            // Filter by active tab
            if (activeTab === 'active' && !['todo', 'in_progress', 'in_review'].includes(status.status_type)) {
              return null;
            }
            if (activeTab === 'backlog' && status.status_type !== 'backlog') {
              return null;
            }

            return (
              <div key={status.status_id}>
                {/* Status Header */}
                <button
                  onClick={() => toggleStatus(status.status_id)}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors hover:bg-white/5"
                >
                  <svg 
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                    style={{ color: colors.textMuted }}
                  >
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <StatusIcon type={status.status_type} color={status.color} />
                  <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {status.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: colors.textMuted 
                  }}>
                    {statusIssues.length}
                  </span>
                  
                  <div className="flex-1" />
                  
                  {/* Add issue to this status */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateModal(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all"
                    style={{ color: colors.textMuted }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </button>

                {/* Issues List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {statusIssues.length === 0 ? (
                        <div className="px-8 py-4">
                          <p className="text-sm" style={{ color: colors.textMuted }}>
                            No hay tareas en este estado
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0.5 pb-2">
                          {statusIssues.map(issue => (
                            <Link
                              key={issue.issue_id}
                              href={`/${orgSlug}/admin/teams/${teamId}/tasks/${issue.issue_id}`}
                              className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all group hover:bg-white/5"
                            >
                              {/* Priority */}
                              <div className="w-5 flex-shrink-0">
                                {issue.priority && (
                                  <PriorityIcon level={issue.priority.level} color={issue.priority.color} />
                                )}
                              </div>

                              {/* Identifier */}
                              <span className="text-xs font-mono" style={{ color: colors.textMuted }}>
                                {issue.identifier}
                              </span>

                              {/* Status Icon */}
                              <StatusIcon type={issue.status.status_type} color={issue.status.color} />

                              {/* Title */}
                              <span className="flex-1 text-sm truncate" style={{ color: colors.textPrimary }}>
                                {issue.title}
                              </span>

                              {/* Labels */}
                              <div className="flex items-center gap-1">
                                {issue.labels?.slice(0, 2).map(label => (
                                  <span 
                                    key={label.label_id}
                                    className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                                    style={{ backgroundColor: `${label.color}20`, color: label.color }}
                                  >
                                    {label.name}
                                  </span>
                                ))}
                              </div>

                              {/* Project */}
                              {issue.project && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ 
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                  color: colors.textMuted 
                                }}>
                                  {issue.project.name}
                                </span>
                              )}

                              {/* Assignee */}
                              {issue.assignee ? (
                                <div 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0"
                                  style={{ 
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    color: colors.textSecondary
                                  }}
                                >
                                  {issue.assignee.avatar_url ? (
                                    <img src={issue.assignee.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    issue.assignee.display_name?.[0]?.toUpperCase() || '?'
                                  )}
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full border border-dashed flex-shrink-0" style={{ borderColor: colors.border }} />
                              )}

                              {/* Due date */}
                              {issue.due_date && (
                                <span className="text-xs" style={{ color: colors.textMuted }}>
                                  {formatDate(issue.due_date)}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      
      {issues.length > 0 && view === 'board' && (
        /* BOARD VIEW (Kanban) */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map(status => {
            const statusIssues = issuesByStatus[status.status_id] || [];

            return (
              <div 
                key={status.status_id}
                className="flex-shrink-0 w-80 rounded-xl p-3"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}
              >
                {/* Column Header */}
                <div className="flex items-center gap-2 px-2 py-2 mb-3">
                  <StatusIcon type={status.status_type} color={status.color} />
                  <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {status.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: colors.textMuted 
                  }}>
                    {statusIssues.length}
                  </span>
                  <div className="flex-1" />
                  <button className="p-1 rounded hover:bg-white/10" style={{ color: colors.textMuted }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {statusIssues.map(issue => (
                    <Link
                      key={issue.issue_id}
                      href={`/${orgSlug}/admin/teams/${teamId}/tasks/${issue.issue_id}`}
                      className="block p-3 rounded-lg border transition-all hover:border-[#00D4B3]/30"
                      style={{ 
                        backgroundColor: isDark ? '#1a1f25' : '#ffffff',
                        borderColor: colors.border
                      }}
                    >
                      {/* Identifier */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono" style={{ color: colors.textMuted }}>
                          {issue.identifier}
                        </span>
                        {issue.priority && (
                          <PriorityIcon level={issue.priority.level} color={issue.priority.color} />
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                        {issue.title}
                      </h4>

                      {/* Labels */}
                      {issue.labels?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {issue.labels.slice(0, 3).map(label => (
                            <span 
                              key={label.label_id}
                              className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                              style={{ backgroundColor: `${label.color}20`, color: label.color }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: colors.border }}>
                        {/* Project */}
                        {issue.project && (
                          <span className="text-xs" style={{ color: colors.textMuted }}>
                            {issue.project.name}
                          </span>
                        )}
                        <div className="flex-1" />

                        {/* Assignee */}
                        {issue.assignee && (
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium"
                            style={{ 
                              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              color: colors.textSecondary
                            }}
                          >
                            {issue.assignee.avatar_url ? (
                              <img src={issue.assignee.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              issue.assignee.display_name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State - Show when no issues */}
      {issues.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center gap-2 mb-6 opacity-30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: colors.textMuted }}>
              <circle cx="12" cy="12" r="10"/>
              <circle cx="10" cy="10" r="2"/>
              <circle cx="14" cy="10" r="2"/>
              <path d="M8 15c1 1 2.5 2 4 2s3-1 4-2"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
            Tareas activas
          </h3>
          <p className="text-center max-w-md mb-6" style={{ color: colors.textMuted }}>
            Las tareas activas representan trabajo que está actualmente en progreso o que debería trabajarse próximamente.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90"
            style={{ backgroundColor: '#0A2540' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Crear nueva tarea
          </button>
        </div>
      )}

      {/* Create Issue Modal */}
      <CreateIssueModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        teamId={teamId}
        onIssueCreated={(issue) => {
          setIssues(prev => [...prev, issue]);
        }}
      />
    </div>
  );
}
