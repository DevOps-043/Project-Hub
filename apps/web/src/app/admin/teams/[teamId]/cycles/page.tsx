'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { format, formatDistanceToNow, differenceInDays, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Plus, Calendar, Clock, ChevronRight, MoreHorizontal,
  Circle, CheckCircle2, Target, Layers, X
} from 'lucide-react';

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
  created_at: string;
}

// Status badge component
const StatusBadge = ({ status, colors }: { status: string; colors: any }) => {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    upcoming: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', label: 'Próximo' },
    active: { bg: 'rgba(0, 212, 179, 0.15)', text: '#00D4B3', label: 'Activo' },
    completed: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6', label: 'Completado' },
    cancelled: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9CA3AF', label: 'Cancelado' }
  };

  const config = statusConfig[status] || statusConfig.upcoming;
  
  return (
    <span 
      className="px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
};

// Progress bar component
const ProgressBar = ({ percent, accentColor }: { percent: number; accentColor: string }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
      <motion.div 
        className="h-full rounded-full"
        style={{ backgroundColor: accentColor }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
    <span className="text-xs font-medium" style={{ color: accentColor }}>
      {percent}%
    </span>
  </div>
);

export default function TeamCyclesPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const accentColor = '#00D4B3';
  const primaryColor = '#0A2540';

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [team, setTeam] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    cooldown_days: 7
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch cycles
  const fetchCycles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/cycles`);
      if (res.ok) {
        const data = await res.json();
        setCycles(data.cycles || []);
      }
    } catch (error) {
      console.error('Error fetching cycles:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Fetch team info
  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data.team);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  }, [teamId]);

  useEffect(() => {
    fetchCycles();
    fetchTeam();
  }, [fetchCycles, fetchTeam]);

  // Create cycle
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.start_date || !formData.end_date) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/cycles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ name: '', description: '', start_date: '', end_date: '', cooldown_days: 7 });
        fetchCycles();
      }
    } catch (error) {
      console.error('Error creating cycle:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Get timeline position for visual display
  const getTimelineDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d', { locale: es });
  };

  // Separate cycles by status
  const activeCycle = cycles.find(c => c.status === 'active');
  const upcomingCycles = cycles.filter(c => c.status === 'upcoming');
  const completedCycles = cycles.filter(c => c.status === 'completed');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: colors.bgPrimary }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{ backgroundColor: `${colors.bgPrimary}CC`, borderColor: colors.border }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm mb-1" style={{ color: colors.textMuted }}>
                <span>{team?.name || 'Equipo'}</span>
                <ChevronRight size={14} />
                <span>Cycles</span>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                Cycles
              </h1>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white"
              style={{ 
                background: `linear-gradient(135deg, ${accentColor} 0%, #00B89C 100%)`,
                boxShadow: `0 4px 15px ${accentColor}40`
              }}
            >
              <Plus size={18} />
              Nuevo Cycle
            </motion.button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {cycles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Layers size={40} style={{ color: accentColor }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
              No hay cycles aún
            </h3>
            <p className="text-sm mb-6" style={{ color: colors.textMuted }}>
              Crea tu primer cycle para organizar el trabajo del equipo en sprints
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 rounded-xl font-medium text-white"
              style={{ backgroundColor: accentColor }}
            >
              Crear primer Cycle
            </button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Active Cycle */}
            {activeCycle && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: colors.textMuted }}>
                  Cycle Activo
                </h2>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl border"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(0, 212, 179, 0.05)' : 'rgba(0, 212, 179, 0.03)',
                    borderColor: `${accentColor}30`
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Circle size={18} style={{ color: accentColor }} fill={accentColor} />
                        <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                          {activeCycle.name}
                        </h3>
                        <StatusBadge status={activeCycle.status} colors={colors} />
                      </div>
                      <div className="flex items-center gap-4 text-sm" style={{ color: colors.textMuted }}>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {format(new Date(activeCycle.start_date), 'dd MMM', { locale: es })} - {format(new Date(activeCycle.end_date), 'dd MMM yyyy', { locale: es })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {differenceInDays(new Date(activeCycle.end_date), new Date())} días restantes
                        </span>
                      </div>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-white/5" style={{ color: colors.textMuted }}>
                      <MoreHorizontal size={20} />
                    </button>
                  </div>

                  <ProgressBar percent={activeCycle.progress_percent} accentColor={accentColor} />

                  <div className="flex items-center gap-6 mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <div>
                      <span className="text-xs" style={{ color: colors.textMuted }}>Scope</span>
                      <p className="font-semibold" style={{ color: colors.textPrimary }}>
                        {activeCycle.scope_count} issues
                      </p>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: colors.textMuted }}>Completadas</span>
                      <p className="font-semibold" style={{ color: accentColor }}>
                        {activeCycle.completed_count} issues
                      </p>
                    </div>
                  </div>
                </motion.div>
              </section>
            )}

            {/* Upcoming Cycles */}
            {upcomingCycles.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: colors.textMuted }}>
                  Próximos Cycles
                </h2>
                <div className="space-y-3">
                  {upcomingCycles.map((cycle, index) => (
                    <motion.div
                      key={cycle.cycle_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl border hover:border-blue-500/30 transition-colors cursor-pointer"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: colors.border }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Circle size={16} style={{ color: '#3B82F6' }} />
                          <span className="font-medium" style={{ color: colors.textPrimary }}>{cycle.name}</span>
                          <StatusBadge status={cycle.status} colors={colors} />
                        </div>
                        <div className="flex items-center gap-4 text-sm" style={{ color: colors.textMuted }}>
                          <span>{format(new Date(cycle.start_date), 'dd MMM', { locale: es })} - {format(new Date(cycle.end_date), 'dd MMM', { locale: es })}</span>
                          <span>{cycle.scope_count} scope</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed Cycles */}
            {completedCycles.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: colors.textMuted }}>
                  Cycles Completados
                </h2>
                <div className="space-y-3">
                  {completedCycles.map((cycle, index) => (
                    <motion.div
                      key={cycle.cycle_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl border hover:border-purple-500/30 transition-colors cursor-pointer"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: colors.border }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={16} style={{ color: '#8B5CF6' }} />
                          <span className="font-medium" style={{ color: colors.textPrimary }}>{cycle.name}</span>
                          <StatusBadge status={cycle.status} colors={colors} />
                        </div>
                        <div className="flex items-center gap-6 text-sm" style={{ color: colors.textMuted }}>
                          <span style={{ color: accentColor }}>{cycle.progress_percent}% success</span>
                          <span>{cycle.completed_count} completed</span>
                          <span>{cycle.scope_count} scope</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg p-6 rounded-2xl border z-50"
              style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                  Crear Nuevo Cycle
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-lg hover:bg-white/5"
                  style={{ color: colors.textMuted }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateCycle} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                    Nombre del Cycle
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ej: Sprint 1"
                    required
                    className="w-full px-4 py-3 rounded-xl border text-sm"
                    style={{
                      backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Objetivos del cycle..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
                    style={{
                      backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                      Fecha de inicio
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-xl border text-sm"
                      style={{
                        backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                        borderColor: colors.border,
                        color: colors.textPrimary
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                      Fecha de fin
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-xl border text-sm"
                      style={{
                        backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                        borderColor: colors.border,
                        color: colors.textPrimary
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                    Días de cooldown
                  </label>
                  <select
                    value={formData.cooldown_days}
                    onChange={(e) => setFormData({ ...formData, cooldown_days: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border text-sm"
                    style={{
                      backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                  >
                    <option value={0}>Sin cooldown</option>
                    <option value={3}>3 días</option>
                    <option value={7}>1 semana</option>
                    <option value={14}>2 semanas</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-medium text-sm"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6', color: colors.textSecondary }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3 rounded-xl font-medium text-sm text-white disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {submitting ? 'Creando...' : 'Crear Cycle'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
