'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Member {
  id: string;
  firstName: string;
  lastNamePaternal: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  permissionLevel: string;
  irisRole: string;
  sofiaRole: string;
  accountStatus: string;
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Propietario', color: '#00D4B3' },
  { value: 'admin', label: 'Administrador', color: '#3B82F6' },
  { value: 'manager', label: 'Gerente', color: '#8B5CF6' },
  { value: 'leader', label: 'Lider', color: '#F59E0B' },
  { value: 'member', label: 'Miembro', color: '#6B7280' },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map(r => [r.value, r.label])
);

function getRoleColor(role: string): string {
  return ROLE_OPTIONS.find(r => r.value === role)?.color || '#6B7280';
}

export default function WorkspaceMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { workspace, isOwner, isAdmin } = useWorkspace();

  const canEditRoles = isOwner || isAdmin;

  const fetchMembers = useCallback(async () => {
    if (!workspace?.slug) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/workspaces/${workspace.slug}/members`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setMembers(data.users || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [workspace?.slug]);

  const handleSync = async () => {
    if (!workspace?.slug) return;
    setSyncing(true);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`/api/workspaces/${workspace.slug}/members?sync=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await fetchMembers();
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!workspace?.slug) return;
    setSavingRole(userId);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/workspaces/${workspace.slug}/members`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, irisRole: newRole }),
      });

      if (res.ok) {
        setMembers(prev => prev.map(m =>
          m.id === userId ? { ...m, irisRole: newRole } : m
        ));
      }
    } catch (e) { console.error(e); }
    setSavingRole(null);
    setEditingId(null);
  };

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search
    ? members.filter(m => m.displayName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
    : members;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>Miembros</h1>
        <p style={{ color: colors.textMuted }}>{members.length} miembros en {workspace?.name}</p>
      </div>

      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 px-4 py-2.5 pl-10 rounded-lg focus:outline-none transition-colors"
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
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.02]"
          style={{
            backgroundColor: isDark ? 'rgba(0, 212, 179, 0.1)' : 'rgba(0, 212, 179, 0.08)',
            border: '1px solid rgba(0, 212, 179, 0.3)',
            color: '#00D4B3',
          }}
        >
          <svg className={syncing ? 'animate-spin' : ''} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          {syncing ? 'Sincronizando...' : 'Sincronizar con SOFIA'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: colors.textMuted }}>
          <p>No hay miembros</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((member) => {
            const roleColor = getRoleColor(member.irisRole);
            const isEditing = editingId === member.id;
            const isSaving = savingRole === member.id;

            return (
              <div
                key={member.id}
                className="group flex items-center justify-between p-5 rounded-2xl transition-all"
                style={{
                  background: isDark ? 'linear-gradient(to right, rgba(17, 24, 39, 0.5), rgba(31, 41, 55, 0.3))' : colors.bgCard,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00D4B3] to-[#00A896] flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        member.firstName?.[0] || 'U'
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: colors.textPrimary }}>{member.displayName}</h3>
                    <p className="text-sm" style={{ color: colors.textMuted }}>{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Sofia role badge (info only) */}
                  {member.sofiaRole && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        color: colors.textMuted,
                      }}
                    >
                      SOFIA: {member.sofiaRole}
                    </span>
                  )}

                  {/* Editable workspace role */}
                  <div className="relative" ref={isEditing ? dropdownRef : undefined}>
                    {isSaving ? (
                      <div className="w-8 h-8 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : canEditRoles ? (
                      <button
                        onClick={() => setEditingId(isEditing ? null : member.id)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.03]"
                        style={{
                          backgroundColor: isDark
                            ? `${roleColor}20`
                            : `${roleColor}15`,
                          color: roleColor,
                          border: `1px solid ${roleColor}40`,
                        }}
                      >
                        {ROLE_LABELS[member.irisRole] || member.irisRole}
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="m6 9 6 6 6-6"/>
                        </svg>
                      </button>
                    ) : (
                      <span
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          backgroundColor: isDark ? `${roleColor}20` : `${roleColor}15`,
                          color: roleColor,
                        }}
                      >
                        {ROLE_LABELS[member.irisRole] || member.irisRole}
                      </span>
                    )}

                    {isEditing && (
                      <div
                        className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden shadow-xl z-50"
                        style={{
                          backgroundColor: isDark ? '#1f2937' : '#ffffff',
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleRoleChange(member.id, opt.value)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                            style={{
                              color: member.irisRole === opt.value ? opt.color : colors.textPrimary,
                              backgroundColor: member.irisRole === opt.value
                                ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')
                                : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.backgroundColor = member.irisRole === opt.value
                                ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')
                                : 'transparent';
                            }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: opt.color }}
                            />
                            <span className="font-medium">{opt.label}</span>
                            {member.irisRole === opt.value && (
                              <svg className="ml-auto" width="14" height="14" fill="none" stroke={opt.color} strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M20 6 9 17l-5-5"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
