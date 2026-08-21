'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { api } from '@/lib/api/client';
import { useTeamPanel } from '@/components/teams/TeamPanelContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Globe2, Lock, Settings2, Users } from 'lucide-react';

// --- General Panel ---
function GeneralPanel() {
  const { team, workspaceSlug, canManage, refreshTeam } = useTeamPanel();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const [form, setForm] = useState({
    name: team!.name,
    description: team!.description || '',
    color: team!.color,
    visibility: team!.visibility,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const colorOptions = ['#00D4B3', '#0A2540', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

  const visibilityOptions = [
    { value: 'private', label: 'Privado', desc: 'Solo miembros del equipo pueden ver', icon: <Lock size={16} /> },
    { value: 'internal', label: 'Interno', desc: 'Visible para miembros del workspace', icon: <Users size={16} /> },
    { value: 'public', label: 'Público', desc: 'Visible para todos', icon: <Globe2 size={16} /> },
  ];

  const hasChanges = form.name !== team!.name || form.description !== (team!.description || '') || form.color !== team!.color || form.visibility !== team!.visibility;

  const save = async () => {
    if (!canManage || !hasChanges) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { error } = await api.put(`/api/workspaces/${workspaceSlug}/teams/${team!.id}`, form);
      if (error) throw new Error(error || 'Error guardando');
      await refreshTeam();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8" data-settings-general>
      <div data-settings-intro>
        <span>IDENTIDAD DEL EQUIPO</span>
        <h2 className="text-xl font-bold mb-1" style={{ color: colors.textPrimary, fontFamily: 'var(--font-system-display)' }}>Una identidad clara para colaborar mejor</h2>
        <p className="text-sm" style={{ color: colors.textMuted }}>Configura cómo se presenta el equipo y quién puede descubrir su trabajo.</p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
      {saved && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2"><Check size={16} /> Cambios guardados correctamente</div>}

      {/* Team Preview */}
      <div className="flex items-center gap-4 p-4 rounded-xl" data-settings-preview style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${colors.border}` }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
          style={{ backgroundColor: form.color, boxShadow: `0 4px 12px ${form.color}30` }}>
          {form.name ? form.name.substring(0, 2).toUpperCase() : '??'}
        </div>
        <div>
          <h3 className="font-semibold text-lg" style={{ color: colors.textPrimary }}>{form.name || 'Sin nombre'}</h3>
          <p className="text-sm" style={{ color: colors.textMuted }}>{team!.memberCount} {team!.memberCount === 1 ? 'miembro' : 'miembros'} &middot; {team!.status}</p>
        </div>
      </div>

      {/* Name */}
      <div data-settings-field="name">
        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Nombre del equipo</label>
        <input
          type="text" value={form.name} disabled={!canManage}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full py-2.5 px-4 rounded-xl text-sm focus:outline-none transition-colors disabled:opacity-50"
          style={{ backgroundColor: isDark ? '#0F1419' : colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
        />
      </div>

      {/* Description */}
      <div data-settings-field="description">
        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Descripción</label>
        <textarea
          value={form.description} disabled={!canManage} rows={3}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe el propósito de este equipo..."
          className="w-full py-2.5 px-4 rounded-xl text-sm focus:outline-none transition-colors resize-none disabled:opacity-50"
          style={{ backgroundColor: isDark ? '#0F1419' : colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
        />
      </div>

      {/* Color */}
      <div data-settings-field="color">
        <label className="block text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>Color del equipo</label>
        <div className="flex gap-3 flex-wrap">
          {colorOptions.map(color => (
            <button key={color} type="button" disabled={!canManage}
              onClick={() => setForm(f => ({ ...f, color }))}
              className="w-10 h-10 rounded-xl transition-all disabled:opacity-50"
              style={{
                backgroundColor: color,
                transform: form.color === color ? 'scale(1.15)' : 'scale(1)',
                boxShadow: form.color === color ? `0 0 0 3px ${isDark ? '#1a1f2e' : colors.bgCard}, 0 0 0 5px ${color}` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div data-settings-field="visibility">
        <label className="block text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>Visibilidad</label>
        <div className="space-y-2">
          {visibilityOptions.map(opt => {
            const isActive = form.visibility === opt.value;
            return (
              <button key={opt.value} type="button" disabled={!canManage}
                onClick={() => setForm(f => ({ ...f, visibility: opt.value as typeof form.visibility }))}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all disabled:opacity-50"
                style={{
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : colors.border}`,
                }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isActive ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'), color: isActive ? 'var(--color-accent)' : colors.textMuted }}>
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm" style={{ color: isActive ? 'var(--color-accent)' : colors.textPrimary }}>{opt.label}</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>{opt.desc}</p>
                </div>
                {isActive && <div className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: 'var(--color-accent)' }}><Check size={16} /></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      {canManage && (
        <div className="flex justify-end pt-4" data-settings-save style={{ borderTop: `1px solid ${colors.border}` }}>
          <button onClick={save} disabled={saving || !hasChanges}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: hasChanges ? 'var(--color-primary)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'), color: hasChanges ? '#FFF' : colors.textMuted }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Danger Zone Panel ---
function DangerPanel() {
  const { team, workspaceSlug, canManage, canDelete, panelBase, refreshTeam } = useTeamPanel();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const router = useRouter();

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [loading, setLoading] = useState(false);

  const archiveTeam = async () => {
    setLoading(true);
    try {
      const newStatus = team!.status === 'archived' ? 'active' : 'archived';
      await api.put(`/api/workspaces/${workspaceSlug}/teams/${team!.id}`, { status: newStatus });
      setShowArchiveConfirm(false);
      await refreshTeam();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const deleteTeam = async () => {
    if (deleteInput !== team!.name) return;
    setLoading(true);
    try {
      await api.delete(`/api/workspaces/${workspaceSlug}/teams/${team!.id}`);
      router.push(`${panelBase}/teams`);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1 text-red-400" style={{ fontFamily: 'var(--font-system-display)' }}>Zona de Peligro</h2>
        <p className="text-sm" style={{ color: colors.textMuted }}>Acciones irreversibles o destructivas sobre este equipo.</p>
      </div>

      {/* Archive */}
      <div className="p-5 rounded-xl" style={{ border: '1px solid rgba(239, 168, 68, 0.3)', background: isDark ? 'rgba(239, 168, 68, 0.05)' : 'rgba(239, 168, 68, 0.03)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
              {team!.status === 'archived' ? 'Restaurar equipo' : 'Archivar equipo'}
            </h3>
            <p className="text-sm mt-1" style={{ color: colors.textMuted }}>
              {team!.status === 'archived'
                ? 'Restaura este equipo para que vuelva a estar activo y visible.'
                : 'El equipo dejará de aparecer en listados activos. Los datos se conservan.'}
            </p>
          </div>
          {canManage && (
            <button onClick={() => setShowArchiveConfirm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 transition-colors whitespace-nowrap">
              {team!.status === 'archived' ? 'Restaurar' : 'Archivar'}
            </button>
          )}
        </div>
        {showArchiveConfirm && (
          <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: `1px solid rgba(239, 168, 68, 0.2)` }}>
            <p className="text-sm flex-1" style={{ color: colors.textMuted }}>
              {team!.status === 'archived' ? '¿Confirmar restauración?' : '¿Confirmar archivado?'}
            </p>
            <button onClick={() => setShowArchiveConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-sm" style={{ color: colors.textMuted }}>
              Cancelar
            </button>
            <button onClick={archiveTeam} disabled={loading}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700 transition-colors disabled:opacity-50">
              {loading ? 'Procesando...' : 'Confirmar'}
            </button>
          </div>
        )}
      </div>

      {/* Delete */}
      {canDelete && (
        <div className="p-5 rounded-xl" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.03)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-red-400">Eliminar equipo permanentemente</h3>
              <p className="text-sm mt-1" style={{ color: colors.textMuted }}>
                Esta acción es irreversible. Se eliminarán todas las tareas, miembros y configuraciones del equipo.
              </p>
            </div>
            <button onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap">
              Eliminar
            </button>
          </div>
          {showDeleteConfirm && (
            <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <p className="text-sm" style={{ color: colors.textMuted }}>
                Escribe <strong className="text-red-400">{team!.name}</strong> para confirmar la eliminación:
              </p>
              <input
                type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                placeholder={team!.name}
                className="w-full py-2 px-3 rounded-lg text-sm focus:outline-none"
                style={{ backgroundColor: isDark ? '#0F1419' : colors.bgSecondary, border: '1px solid rgba(239, 68, 68, 0.3)', color: colors.textPrimary }}
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                  className="px-3 py-1.5 rounded-lg text-sm" style={{ color: colors.textMuted }}>
                  Cancelar
                </button>
                <button onClick={deleteTeam} disabled={loading || deleteInput !== team!.name}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                  {loading ? 'Eliminando...' : 'Eliminar permanentemente'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- MAIN COMPONENT ---
export function TeamSettingsContent() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const [activeTab, setActiveTab] = useState<'general' | 'danger'>('general');

  const tabs = [
    { id: 'general' as const, label: 'General', icon: <Settings2 size={18} /> },
    { id: 'danger' as const, label: 'Zona de Peligro', icon: <AlertTriangle size={18} /> },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8" data-team-settings>
      {/* Sidebar Tabs */}
      <div className="w-full lg:w-56 shrink-0 space-y-1" data-settings-nav>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const activeColor = tab.id === 'danger' ? 'var(--color-error)' : 'var(--color-accent)';
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: isActive ? (isDark ? '#161b22' : '#fff') : 'transparent',
                color: isActive ? activeColor : colors.textMuted,
                boxShadow: isActive ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)') : 'none',
              }}>
              {tab.icon}
              {tab.label}
              {isActive && <motion.div layoutId="active-team-settings-dot" className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeColor }} />}
            </button>
          );
        })}
      </div>

      {/* Content Panel */}
      <div className="flex-1 rounded-2xl p-6 lg:p-8 min-h-[500px]" data-settings-panel
        style={{ backgroundColor: isDark ? '#161b22' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}`, boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'general' && (
            <motion.div key="general" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <GeneralPanel />
            </motion.div>
          )}
          {activeTab === 'danger' && (
            <motion.div key="danger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DangerPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
