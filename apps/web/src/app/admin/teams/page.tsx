'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/core/stores/authStore';

interface TeamOwner {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  color: string;
  status: 'active' | 'archived' | 'suspended';
  visibility: 'public' | 'private' | 'internal';
  maxMembers: number;
  owner: TeamOwner | null;
  memberCount: number;
  createdAt: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { user } = useAuthStore();

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);
      const res = await fetch(`/api/admin/teams?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTeams(data.teams || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const deleteTeam = async () => {
    if (!selectedTeam) return;
    await fetch(`/api/admin/teams/${selectedTeam.id}`, { method: 'DELETE' });
    setShowDeleteConfirm(false);
    setSelectedTeam(null);
    fetchTeams();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' };
      case 'archived': return { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280' };
      case 'suspended': return { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' };
      default: return { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280' };
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        );
      case 'private':
        return (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>Equipos</h1>
        <p style={{ color: colors.textMuted }}>{total} equipos en total</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {[
          { 
            label: 'Total Equipos', 
            value: total, 
            color: '#00D4B3',
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )
          },
          { 
            label: 'Activos', 
            value: teams.filter(t => t.status === 'active').length, 
            color: '#10B981',
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            )
          },
          { 
            label: 'Archivados', 
            value: teams.filter(t => t.status === 'archived').length, 
            color: '#6B7280',
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8"/>
                <path d="M1 3h22v5H1z"/>
                <path d="M10 12h4"/>
              </svg>
            )
          },
          { 
            label: 'Miembros Totales', 
            value: teams.reduce((acc, t) => acc + t.memberCount, 0), 
            color: '#8B5CF6',
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )
          },
        ].map((stat, i) => (
          <div 
            key={i}
            className="p-5 rounded-xl transition-all"
            style={{ 
              background: isDark ? 'rgba(30, 35, 41, 0.5)' : colors.bgCard,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <span className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</span>
            </div>
            <p className="text-sm" style={{ color: colors.textMuted }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar equipos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-80 px-4 py-2.5 pl-10 rounded-lg focus:outline-none transition-colors"
            style={{
              backgroundColor: isDark ? 'transparent' : colors.bgCard,
              border: `1px solid ${isDark ? 'rgb(55, 65, 81)' : colors.border}`,
              color: colors.textPrimary,
            }}
          />
          <svg className="absolute left-3 top-3" style={{ color: colors.textMuted }} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>

        <button
          onClick={() => { setSelectedTeam(null); setShowModal(true); }}
          className="px-5 py-2.5 bg-[#00D4B3] text-black font-semibold rounded-lg hover:bg-[#00b89c] transition-colors flex items-center gap-2"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo Equipo
        </button>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-20" style={{ color: colors.textMuted }}>
          <svg className="mx-auto mb-4" style={{ color: colors.textSecondary }} width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>No hay equipos creados</p>
          <p className="text-sm mt-1">Crea tu primer equipo para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const statusColor = getStatusColor(team.status);
            return (
              <div
                key={team.id}
                className="group p-5 rounded-2xl transition-all cursor-pointer hover:scale-[1.02]"
                style={{
                  background: isDark ? 'rgba(30, 35, 41, 0.5)' : colors.bgCard,
                  border: `1px solid ${colors.border}`,
                }}
                onClick={() => { setSelectedTeam(team); setShowModal(true); }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Team Avatar */}
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.textPrimary }}>{team.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
                        {getVisibilityIcon(team.visibility)}
                        <span className="capitalize">{team.visibility}</span>
                      </div>
                    </div>
                  </div>
                  <span 
                    className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                    style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                  >
                    {team.status}
                  </span>
                </div>

                {/* Description */}
                {team.description && (
                  <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>
                    {team.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {/* Member avatars placeholder */}
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: team.color, border: `2px solid ${isDark ? '#1E2329' : colors.bgCard}` }}
                      >
                        {team.memberCount}
                      </div>
                    </div>
                    <span className="text-sm" style={{ color: colors.textMuted }}>
                      {team.memberCount} {team.memberCount === 1 ? 'miembro' : 'miembros'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTeam(team); setShowDeleteConfirm(true); }}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: colors.textMuted }}
                      title="Eliminar"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Owner */}
                {team.owner && (
                  <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                      style={{ background: 'linear-gradient(135deg, #00D4B3, #0A2540)' }}
                    >
                      {team.owner.name[0]}
                    </div>
                    <span className="text-xs" style={{ color: colors.textMuted }}>
                      Creado por <span style={{ color: colors.textSecondary }}>{team.owner.name}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 10 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: colors.textSecondary,
            }}
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-sm" style={{ color: colors.textMuted }}>
            Página {page} de {Math.ceil(total / 10)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 10)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: colors.textSecondary,
            }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <TeamFormModal
          team={selectedTeam}
          currentUserId={user?.id}
          onClose={() => { setShowModal(false); setSelectedTeam(null); }}
          onSave={() => { setShowModal(false); setSelectedTeam(null); fetchTeams(); }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowDeleteConfirm(false)} />
          <div 
            className="relative rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ 
              backgroundColor: isDark ? '#1E2329' : colors.bgCard,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" fill="none" stroke="#EF4444" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
                ¿Eliminar equipo?
              </h3>
              <p style={{ color: colors.textMuted }}>
                Esta acción eliminará permanentemente el equipo <strong style={{ color: colors.textPrimary }}>{selectedTeam.name}</strong> y todas sus configuraciones.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="flex-1 py-2.5 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: colors.textSecondary,
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={deleteTeam} 
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Team Form Modal Component
function TeamFormModal({ team, currentUserId, onClose, onSave }: { team: Team | null; currentUserId?: string; onClose: () => void; onSave: () => void }) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  const [form, setForm] = useState({
    name: team?.name || '',
    description: team?.description || '',
    color: team?.color || '#00D4B3',
    visibility: team?.visibility || 'private',
    status: team?.status || 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const colorOptions = [
    '#00D4B3', '#0A2540', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!currentUserId && !team) {
      setError('No se pudo identificar al usuario. Por favor, inicia sesión nuevamente.');
      setLoading(false);
      return;
    }
    
    try {
      const body = { 
        ...form, 
        ownerId: currentUserId
      };
      
      const res = await fetch(team ? `/api/admin/teams/${team.id}` : '/api/admin/teams', {
        method: team ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error saving team');
      }
      
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
    setLoading(false);
  };

  const initials = form.name ? form.name.substring(0, 2).toUpperCase() : '??';

  const visibilityOptions = [
    { 
      value: 'private', 
      label: 'Privado', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      )
    },
    { 
      value: 'internal', 
      label: 'Interno', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      )
    },
    { 
      value: 'public', 
      label: 'Público', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      )
    },
  ];

  const selectedVisibility = visibilityOptions.find(v => v.value === form.visibility);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)' }}
        onClick={onClose}
      />

      {/* Modal - Split Panel */}
      <div 
        className="relative rounded-2xl shadow-2xl overflow-hidden"
        style={{ 
          backgroundColor: colors.bgCard, 
          border: `1px solid ${colors.border}`,
          maxWidth: '800px', 
          width: '100%' 
        }}
      >
        <div className="flex min-h-[520px]">
          
          {/* Left Panel - Preview */}
          <div 
            className="w-72 p-8 flex flex-col items-center"
            style={{ 
              background: isDark 
                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.08))'
                : 'linear-gradient(135deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.05))',
              borderRight: `1px solid ${colors.border}`,
            }}
          >
            {/* Team Avatar */}
            <div className="relative mb-6 mt-4">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
                style={{ 
                  backgroundColor: form.color,
                  boxShadow: `0 8px 24px ${form.color}40`
                }}
              >
                {initials}
              </div>
              <div 
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#00D4B3' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </div>

            {/* Team Info */}
            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg mb-1" style={{ color: colors.textPrimary }}>
                {form.name || 'Nuevo Equipo'}
              </h3>
              <p className="text-sm mb-3" style={{ color: colors.textMuted }}>
                {form.description || 'Sin descripción'}
              </p>
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'rgba(0, 212, 179, 0.15)', color: '#00D4B3' }}
              >
                {selectedVisibility?.icon}
                {selectedVisibility?.label || 'Privado'}
              </span>
            </div>

            {/* Preview Stats */}
            <div className="w-full space-y-2 text-sm">
              <div className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textMuted }}>Color</span>
                <div className="w-5 h-5 rounded" style={{ backgroundColor: form.color }} />
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textMuted }}>Visibilidad</span>
                <span className="capitalize" style={{ color: colors.textSecondary }}>{form.visibility}</span>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textMuted }}>Miembros</span>
                <span style={{ color: colors.textSecondary }}>{team?.memberCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Form */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
              <div>
                <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                  {team ? 'Editar Equipo' : 'Crear Equipo'}
                </h2>
                <p className="text-sm" style={{ color: colors.textMuted }}>
                  {team ? 'Modifica la configuración del equipo' : 'Configura los datos del nuevo equipo'}
                </p>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 rounded-lg transition-colors"
                style={{ color: colors.textMuted }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="flex-1 flex flex-col">
              <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto max-h-[360px] scrollbar-hidden">
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Section: Información Básica */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.textMuted }}>
                    Información Básica
                  </p>
                  
                  {/* Name */}
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Nombre del equipo</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Marketing Digital"
                      required
                      className="w-full py-2.5 px-3 rounded-xl border text-sm focus:outline-none transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1E2329' : colors.bgSecondary,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Descripción</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describe el propósito del equipo..."
                      rows={2}
                      className="w-full py-2.5 px-3 rounded-xl border text-sm focus:outline-none transition-colors resize-none"
                      style={{
                        backgroundColor: isDark ? '#1E2329' : colors.bgSecondary,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      }}
                    />
                  </div>
                </div>

                {/* Section: Apariencia */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.textMuted }}>
                    Apariencia
                  </p>
                  
                  {/* Color */}
                  <div>
                    <label className="block text-xs mb-2" style={{ color: colors.textMuted }}>Color del equipo</label>
                    <div className="flex gap-2 flex-wrap">
                      {colorOptions.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, color }))}
                          className="w-8 h-8 rounded-lg transition-all"
                          style={{ 
                            backgroundColor: color,
                            transform: form.color === color ? 'scale(1.1)' : 'scale(1)',
                            boxShadow: form.color === color ? `0 0 0 2px ${colors.bgCard}, 0 0 0 4px ${color}` : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section: Configuración */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.textMuted }}>
                    Configuración
                  </p>
                  
                  {/* Visibility */}
                  <div>
                    <label className="block text-xs mb-2" style={{ color: colors.textMuted }}>Visibilidad</label>
                    <div className="grid grid-cols-3 gap-2">
                      {visibilityOptions.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, visibility: opt.value as typeof form.visibility }))}
                          className="py-2.5 px-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2"
                          style={{
                            backgroundColor: form.visibility === opt.value 
                              ? 'rgba(0, 212, 179, 0.1)' 
                              : (isDark ? '#1E2329' : colors.bgSecondary),
                            borderColor: form.visibility === opt.value ? '#00D4B3' : colors.border,
                            color: form.visibility === opt.value ? '#00D4B3' : colors.textSecondary,
                          }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4" style={{ borderTop: `1px solid ${colors.border}` }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-medium transition-colors"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    color: colors.textSecondary,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={{ 
                    backgroundColor: isDark ? '#10B981' : '#0A2540',
                    boxShadow: isDark ? '0 4px 15px rgba(16, 185, 129, 0.4)' : '0 4px 15px rgba(10, 37, 64, 0.4)'
                  }}
                >
                  {loading ? 'Guardando...' : team ? 'Guardar cambios' : 'Crear equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

