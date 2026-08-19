'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/lib/api/client';
import {
  Calendar, ChevronDown, ChevronRight, Circle, CheckCircle2,
  Clock, Loader2, Plus, Target, AlertCircle, User
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Cycle {
  cycle_id: string;
  cycle_number: number;
  name: string;
  description: string | null;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  cooldown_days: number;
  scope_count: number;
  completed_count: number;
  progress_percent: number;
}

interface CycleIssue {
  issue_id: string;
  issue_number: number;
  title: string;
  status: {
    name: string;
    color: string;
    status_type: string;
  };
  priority: {
    name: string;
    color: string;
  } | null;
  assignee: {
    first_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  due_date: string | null;
  estimate_points: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: 'Próximo', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  active: { label: 'Activo', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  completed: { label: 'Completado', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
  cancelled: { label: 'Cancelado', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

interface ProjectCyclesViewProps {
  projectId: string;
  teamId?: string;
  workspaceSlug?: string;
}

export function ProjectCyclesView({ projectId, teamId, workspaceSlug }: ProjectCyclesViewProps) {
  const { isDark } = useTheme();
  const colors = isDark ? {
    bg: '#1E2329',
    bgCard: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.08)',
    text: '#FFF',
    textSec: '#9CA3AF',
    hover: 'rgba(255,255,255,0.05)',
  } : {
    bg: '#FFF',
    bgCard: '#FAFBFC',
    border: '#E5E7EB',
    text: '#111827',
    textSec: '#6B7280',
    hover: '#F9FAFB',
  };

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);
  const [cycleIssues, setCycleIssues] = useState<Record<string, CycleIssue[]>>({});
  const [loadingIssues, setLoadingIssues] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      const { data, error: apiError } = await api.get<{ cycles: Cycle[] }>(`/api/admin/teams/${teamId}/cycles`);
      if (!apiError && data) {
        setCycles(data.cycles || []);
      }
    } catch (error) {
      console.error('Error fetching cycles:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const fetchCycleIssues = async (cycleId: string) => {
    if (cycleIssues[cycleId]) return; // Ya cargadas
    setLoadingIssues(cycleId);
    try {
      const { data, error: apiError } = await api.get<{ issues: CycleIssue[] }>(
        `/api/admin/teams/${teamId}/issues?cycleId=${cycleId}&projectId=${projectId}`
      );
      if (!apiError && data) {
        setCycleIssues(prev => ({ ...prev, [cycleId]: data.issues || [] }));
      }
    } catch (error) {
      console.error('Error fetching cycle issues:', error);
    } finally {
      setLoadingIssues(null);
    }
  };

  const toggleCycle = (cycleId: string) => {
    if (expandedCycle === cycleId) {
      setExpandedCycle(null);
    } else {
      setExpandedCycle(cycleId);
      fetchCycleIssues(cycleId);
    }
  };

  const getDaysInfo = (cycle: Cycle) => {
    const now = new Date();
    const start = new Date(cycle.start_date);
    const end = new Date(cycle.end_date);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (cycle.status === 'upcoming') {
      const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `Inicia en ${daysUntil} día${daysUntil !== 1 ? 's' : ''}`;
    }
    if (cycle.status === 'active') {
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`;
    }
    return `${totalDays} días de duración`;
  };

  if (!teamId) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}>
          <Target className="mx-auto mb-4 opacity-30" size={48} style={{ color: colors.textSec }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
            Sin equipo asignado
          </h3>
          <p className="text-sm" style={{ color: colors.textSec }}>
            Asigna un equipo al proyecto en Configuración para ver y gestionar los ciclos de trabajo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
            <Target size={16} style={{ color: colors.textSec }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: colors.text }}>
              {cycles.length} ciclo{cycles.length !== 1 ? 's' : ''} de trabajo
            </p>
          </div>
        </div>
      </div>

      {/* Cycles List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin" size={24} style={{ color: colors.textSec }} />
        </div>
      ) : cycles.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}>
          <Target className="mx-auto mb-3 opacity-30" size={40} style={{ color: colors.textSec }} />
          <p className="text-sm font-medium mb-1" style={{ color: colors.text }}>Sin ciclos de trabajo</p>
          <p className="text-xs" style={{ color: colors.textSec }}>
            Los ciclos se crean automáticamente cuando SofLIA genera el plan del proyecto, o puedes crearlos manualmente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const statusConfig = STATUS_CONFIG[cycle.status] || STATUS_CONFIG.upcoming;
            const isExpanded = expandedCycle === cycle.cycle_id;
            const issues = cycleIssues[cycle.cycle_id];

            return (
              <div
                key={cycle.cycle_id}
                className="rounded-xl border overflow-hidden transition-all"
                style={{ borderColor: isExpanded ? statusConfig.color + '40' : colors.border, backgroundColor: colors.bgCard }}
              >
                {/* Cycle Header */}
                <button
                  onClick={() => toggleCycle(cycle.cycle_id)}
                  className="w-full text-left p-4 flex items-start gap-3 transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="mt-0.5">
                    {isExpanded
                      ? <ChevronDown size={16} style={{ color: colors.textSec }} />
                      : <ChevronRight size={16} style={{ color: colors.textSec }} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: colors.textSec, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                        #{cycle.cycle_number}
                      </span>
                      <h3 className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                        {cycle.name}
                      </h3>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                        style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    {cycle.description && (
                      <p className="text-xs mb-2 line-clamp-1" style={{ color: colors.textSec }}>
                        {cycle.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px]" style={{ color: colors.textSec }}>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(new Date(cycle.start_date), 'd MMM', { locale: es })} — {format(new Date(cycle.end_date), 'd MMM yyyy', { locale: es })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {getDaysInfo(cycle)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        {cycle.completed_count}/{cycle.scope_count} tareas
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className={`flex-1 h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${cycle.progress_percent}%`,
                            backgroundColor: statusConfig.color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: statusConfig.color }}>
                        {cycle.progress_percent}%
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded: Issues List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t px-4 pb-4" style={{ borderColor: colors.border }}>
                        {loadingIssues === cycle.cycle_id ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="animate-spin" size={18} style={{ color: colors.textSec }} />
                          </div>
                        ) : issues && issues.length > 0 ? (
                          <div className="mt-3 space-y-1">
                            {issues.map((issue) => (
                              <div
                                key={issue.issue_id}
                                className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors cursor-default"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hover}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {/* Status icon */}
                                <div style={{ color: issue.status.color }}>
                                  {issue.status.status_type === 'done'
                                    ? <CheckCircle2 size={14} />
                                    : <Circle size={14} />
                                  }
                                </div>

                                {/* Issue number */}
                                <span className="text-[10px] font-mono opacity-50" style={{ color: colors.textSec }}>
                                  #{issue.issue_number}
                                </span>

                                {/* Title */}
                                <span className="flex-1 text-xs font-medium truncate" style={{ color: colors.text }}>
                                  {issue.title}
                                </span>

                                {/* Priority */}
                                {issue.priority && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ color: issue.priority.color, backgroundColor: issue.priority.color + '15' }}>
                                    {issue.priority.name}
                                  </span>
                                )}

                                {/* Estimate */}
                                {issue.estimate_points && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: colors.textSec, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                                    {issue.estimate_points}pt
                                  </span>
                                )}

                                {/* Assignee */}
                                {issue.assignee ? (
                                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-[9px] font-bold shrink-0" title={issue.assignee.display_name || issue.assignee.first_name}>
                                    {issue.assignee.first_name?.[0]}
                                  </div>
                                ) : (
                                  <User size={12} className="opacity-30 shrink-0" style={{ color: colors.textSec }} />
                                )}

                                {/* Due date */}
                                {issue.due_date && (
                                  <span className="text-[10px] shrink-0" style={{ color: colors.textSec }}>
                                    {format(new Date(issue.due_date), 'd MMM', { locale: es })}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-xs opacity-50" style={{ color: colors.textSec }}>
                              No hay tareas en este ciclo para este proyecto.
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
