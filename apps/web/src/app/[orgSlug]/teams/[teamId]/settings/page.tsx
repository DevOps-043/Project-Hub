'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { motion, AnimatePresence } from 'framer-motion';

interface TeamData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  status: 'active' | 'archived' | 'suspended';
  visibility: 'public' | 'private' | 'internal';
  maxMembers: number | null;
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

// --- ICONS ---
const Icons = {
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
  ArrowLeft: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  Globe: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Lock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
};

// --- General Panel ---
function GeneralPanel({ team, workspaceSlug, canManage, onUpdate }: {
  team: TeamData;
  workspaceSlug: string;
  canManage: boolean;
  onUpdate: (t: TeamData) => void;
}) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const [form, setForm] = useState({
    name: team.name,
    description: team.description || '',
    color: team.color,
    visibility: team.visibility,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const colorOptions = ['#00D4B3', '#0A2540', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

  const visibilityOptions = [
    { value: 'private', label: 'Privado', desc: 'Solo miembros del equipo pueden ver', icon: <Icons.Lock /> },
    { value: 'internal', label: 'Interno', desc: 'Visible para miembros del workspace', icon: <Icons.Home /> },
    { value: 'public', label: 'Publico', desc: 'Visible para todos', icon: <Icons.Globe /> },
  ];

  const hasChanges = form.name !== team.name || form.description !== (team.description || '') || form.color !== team.color || form.visibility !== team.visibility;

  const save = async () => {
    if (!canManage || !hasChanges) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/workspaces/${workspaceSlug}/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error guardando');
      }
      onUpdate({ ...team, ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: colors.textPrimary }}>General</h2>
        <p className="text-sm" style={{ color: colors.textMuted }}>Informacion basica y apariencia del equipo.</p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
      {saved && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2"><Icons.Check /> Cambios guardados correctamente</div>}

      {/* Team Preview */}
      <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${colors.border}` }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
          style={{ backgroundColor: form.color, boxShadow: `0 4px 12px ${form.color}30` }}>
          {form.name ? form.name.substring(0, 2).toUpperCase() : '??'}
        </div>
        <div>
          <h3 className="font-semibold text-lg" style={{ color: colors.textPrimary }}>{form.name || 'Sin nombre'}</h3>
          <p className="text-sm" style={{ color: colors.textMuted }}>{team.memberCount} {team.memberCount === 1 ? 'miembro' : 'miembros'} &middot; {team.status}</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Nombre del equipo</label>
        <input
          type="text" value={form.name} disabled={!canManage}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full py-2.5 px-4 rounded-xl text-sm focus:outline-none transition-colors disabled:opacity-50"
          style={{ backgroundColor: isDark ? '#0F1419' : colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Descripcion</label>
        <textarea
          value={form.description} disabled={!canManage} rows={3}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe el proposito de este equipo..."
          className="w-full py-2.5 px-4 rounded-xl text-sm focus:outline-none transition-colors resize-none disabled:opacity-50"
          style={{ backgroundColor: isDark ? '#0F1419' : colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
        />
      </div>

      {/* Color */}
      <div>
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
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>Visibilidad</label>
        <div className="space-y-2">
          {visibilityOptions.map(opt => {
            const isActive = form.visibility === opt.value;
            return (
              <button key={opt.value} type="button" disabled={!canManage}
                onClick={() => setForm(f => ({ ...f, visibility: opt.value as typeof form.visibility }))}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all disabled:opacity-50"
                style={{
                  backgroundColor: isActive ? (isDark ? 'rgba(0, 212, 179, 0.08)' : 'rgba(0, 212, 179, 0.05)') : 'transparent',
                  border: `1px solid ${isActive ? '#00D4B3' : colors.border}`,
                }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isActive ? 'rgba(0, 212, 179, 0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'), color: isActive ? '#00D4B3' : colors.textMuted }}>
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm" style={{ color: isActive ? '#00D4B3' : colors.textPrimary }}>{opt.label}</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>{opt.desc}</p>
                </div>
                {isActive && <div className="w-5 h-5 rounded-full bg-[#00D4B3] flex items-center justify-center text-white"><Icons.Check /></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      {canManage && (
        <div className="flex justify-end pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
          <button onClick={save} disabled={saving || !hasChanges}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
            style={{ backgroundColor: hasChanges ? '#00D4B3' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'), color: hasChanges ? '#000' : colors.textMuted }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Danger Zone Panel ---
function DangerPanel({ team, workspaceSlug, canManage, isOwner }: {
  team: TeamData;
  workspaceSlug: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const router = useRouter();
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [loading, setLoading] = useState(false);

  const archiveTeam = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const newStatus = team.status === 'archived' ? 'active' : 'archived';
      await fetch(`/api/workspaces/${workspaceSlug}/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: newStatus }),
      });
      window.location.reload();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const deleteTeam = async () => {
    if (deleteInput !== team.name) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`/api/workspaces/${workspaceSlug}/teams/${team.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      router.push(`/${orgSlug}/teams`);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1 text-red-400">Zona de Peligro</h2>
        <p className="text-sm" style={{ color: colors.textMuted }}>Acciones irreversibles o destructivas sobre este equipo.</p>
      </div>

      {/* Archive */}
      <div className="p-5 rounded-xl" style={{ border: '1px solid rgba(239, 168, 68, 0.3)', background: isDark ? 'rgba(239, 168, 68, 0.05)' : 'rgba(239, 168, 68, 0.03)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
              {team.status === 'archived' ? 'Restaurar equipo' : 'Archivar equipo'}
            </h3>
            <p className="text-sm mt-1" style={{ color: colors.textMuted }}>
              {team.status === 'archived'
                ? 'Restaura este equipo para que vuelva a estar activo y visible.'
                : 'El equipo dejara de aparecer en listados activos. Los datos se conservan.'}
            </p>
          </div>
          {canManage && (
            <button onClick={() => setShowArchiveConfirm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 transition-colors whitespace-nowrap">
              {team.status === 'archived' ? 'Restaurar' : 'Archivar'}
            </button>
          )}
        </div>
        {showArchiveConfirm && (
          <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: `1px solid rgba(239, 168, 68, 0.2)` }}>
            <p className="text-sm flex-1" style={{ color: colors.textMuted }}>
              {team.status === 'archived' ? 'Confirmar restauracion?' : 'Confirmar archivado?'}
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
      {(isOwner) && (
        <div className="p-5 rounded-xl" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.03)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-red-400">Eliminar equipo permanentemente</h3>
              <p className="text-sm mt-1" style={{ color: colors.textMuted }}>
                Esta accion es irreversible. Se eliminaran todas las tareas, miembros y configuraciones del equipo.
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
                Escribe <strong className="text-red-400">{team.name}</strong> para confirmar la eliminacion:
              </p>
              <input
                type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                placeholder={team.name}
                className="w-full py-2 px-3 rounded-lg text-sm focus:outline-none"
                style={{ backgroundColor: isDark ? '#0F1419' : colors.bgSecondary, border: '1px solid rgba(239, 68, 68, 0.3)', color: colors.textPrimary }}
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                  className="px-3 py-1.5 rounded-lg text-sm" style={{ color: colors.textMuted }}>
                  Cancelar
                </button>
                <button onClick={deleteTeam} disabled={loading || deleteInput !== team.name}
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

// --- MAIN PAGE ---
export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const teamId = params.teamId as string;
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { workspace, isOwner, isAdmin, permissions } = useWorkspace();
  const canManage = isOwner || isAdmin || permissions.manageTeams;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/workspaces/${workspace.slug}/teams/${teamId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Equipo no encontrado');
      const data = await res.json();
      setTeam(data.team);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando equipo');
    }
    setLoading(false);
  }, [workspace.slug, teamId]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const tabs = [
    { id: 'general', label: 'General', icon: <Icons.Settings /> },
    { id: 'danger', label: 'Zona de Peligro', icon: <Icons.AlertTriangle /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <Icons.AlertTriangle />
        </div>
        <p style={{ color: colors.textMuted }}>{error || 'Equipo no encontrado'}</p>
        <button onClick={() => router.push(`/${orgSlug}/teams`)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[#00D4B3] hover:bg-[#00D4B3]/10 transition-colors">
          Volver a equipos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => router.push(`/${orgSlug}/teams`)}
          className="flex items-center gap-2 text-sm mb-4 transition-colors hover:opacity-80"
          style={{ color: colors.textMuted }}>
          <Icons.ArrowLeft />
          Volver a equipos
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: team.color, boxShadow: `0 4px 12px ${team.color}30` }}>
            {team.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>Configuracion de {team.name}</h1>
            <p className="text-sm" style={{ color: colors.textMuted }}>Administra los ajustes de tu equipo</p>
          </div>
        </div>
      </div>

      {/* Layout: Tabs + Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-56 flex-shrink-0 space-y-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive ? (isDark ? '#161b22' : '#fff') : 'transparent',
                  color: isActive ? (tab.id === 'danger' ? '#EF4444' : '#00D4B3') : colors.textMuted,
                  boxShadow: isActive ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)') : 'none',
                }}>
                {tab.icon}
                {tab.label}
                {isActive && <motion.div layoutId="active-team-settings-dot" className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tab.id === 'danger' ? '#EF4444' : '#00D4B3' }} />}
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="flex-1 rounded-2xl p-6 lg:p-8 min-h-[500px]"
          style={{ backgroundColor: isDark ? '#161b22' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}`, boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div key="general" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <GeneralPanel team={team} workspaceSlug={workspace.slug} canManage={canManage} onUpdate={setTeam} />
              </motion.div>
            )}
            {activeTab === 'danger' && (
              <motion.div key="danger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <DangerPanel team={team} workspaceSlug={workspace.slug} canManage={canManage} isOwner={isOwner} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
