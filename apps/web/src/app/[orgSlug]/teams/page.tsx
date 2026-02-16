'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Users, Search, Loader2 } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  status: 'active' | 'archived' | 'suspended';
  visibility: 'public' | 'private' | 'internal';
  memberCount: number;
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
}

export default function MemberTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { workspace, isOwner, isAdmin } = useWorkspace();
  const router = useRouter();

  // Redirect admin/owner to admin panel
  useEffect(() => {
    if (isOwner || isAdmin) {
      router.replace(`/${workspace.slug}/admin/teams`);
    }
  }, [isOwner, isAdmin, workspace.slug, router]);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.append('search', search);
      const res = await fetch(`/api/workspaces/${workspace.slug}/teams?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setTeams(data.teams || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [workspace.slug, search]);

  useEffect(() => {
    const timeout = setTimeout(fetchTeams, 300);
    return () => clearTimeout(timeout);
  }, [fetchTeams]);

  if (isOwner || isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#00D4B3]" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' };
      case 'archived': return { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280' };
      case 'suspended': return { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' };
      default: return { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280' };
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-7 h-7 text-[#00D4B3]" />
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: colors.textPrimary }}>
            Mis Equipos
          </h1>
        </div>
        <p style={{ color: colors.textMuted }}>Equipos en {workspace.name}</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.textMuted }} />
        <input
          type="text"
          placeholder="Buscar equipos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 pl-10 rounded-lg focus:outline-none transition-colors"
          style={{
            backgroundColor: isDark ? 'transparent' : colors.bgCard,
            border: `1px solid ${isDark ? 'rgb(55, 65, 81)' : colors.border}`,
            color: colors.textPrimary,
          }}
        />
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00D4B3]" />
        </div>
      ) : teams.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl border"
          style={{ borderColor: colors.border, color: colors.textMuted }}
        >
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No hay equipos disponibles</p>
          <p className="text-sm">Contacta a un administrador para ser agregado a un equipo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const statusColor = getStatusColor(team.status);
            return (
              <div
                key={team.id}
                className="p-5 rounded-2xl transition-all hover:shadow-lg cursor-pointer hover:scale-[1.01]"
                style={{
                  background: isDark ? 'rgba(30, 35, 41, 0.5)' : colors.bgCard,
                  border: `1px solid ${colors.border}`,
                }}
                onClick={() => router.push(`/${workspace.slug}/teams/${team.id}/tasks`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                        {team.name}
                      </h3>
                      <span className="text-xs capitalize" style={{ color: colors.textMuted }}>
                        {team.visibility}
                      </span>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                    style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                  >
                    {team.status}
                  </span>
                </div>

                {team.description && (
                  <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>
                    {team.description}
                  </p>
                )}

                <div
                  className="flex items-center gap-2 pt-4"
                  style={{ borderTop: `1px solid ${colors.border}` }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ backgroundColor: team.color }}
                  >
                    {team.memberCount}
                  </div>
                  <span className="text-sm" style={{ color: colors.textMuted }}>
                    {team.memberCount} {team.memberCount === 1 ? 'miembro' : 'miembros'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
