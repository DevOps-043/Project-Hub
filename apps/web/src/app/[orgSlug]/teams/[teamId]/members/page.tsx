'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { getPanelPathForRole, useWorkspace } from '@/contexts/WorkspaceContext';
import { themeColors, useTheme } from '@/contexts/ThemeContext';
import { api } from '@/lib/api/client';

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name_paternal: string;
  display_name?: string;
  email: string;
  avatar_url?: string;
  role: string;
  tasks_count?: number;
  completed_tasks_count?: number;
}

interface Team {
  id?: string;
  name: string;
  color: string;
}

export default function WorkspaceTeamMembersPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const teamId = params.teamId as string;
  const { userRole } = useWorkspace();
  const panelBase = getPanelPathForRole(orgSlug, userRole);
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await api.get<{ team?: Team; members?: TeamMember[] }>(`/api/admin/teams/${teamId}/members`);
      if (!err && data) {
        setTeam(data.team || null);
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = members.filter((member) => {
    const text = [
      member.display_name,
      member.first_name,
      member.last_name_paternal,
      member.email,
      member.role,
    ].join(' ').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-2" style={{ color: colors.textMuted }}>
          <Link href={`${panelBase}/teams/${teamId}/tasks`} className="hover:underline">
            {team?.name || 'Equipo'}
          </Link>
          <span>/</span>
          <span>Miembros</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: team?.color || '#00D4B3' }}
          >
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
              Miembros del equipo
            </h1>
            <p className="text-sm" style={{ color: colors.textMuted }}>
              {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.textMuted }} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar miembro..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{
            backgroundColor: isDark ? '#0F1419' : '#fff',
            borderColor: colors.border,
            color: colors.textPrimary,
          }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-20 rounded-xl border" style={{ borderColor: colors.border, color: colors.textMuted }}>
          No hay miembros para mostrar
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredMembers.map((member) => {
            const name = member.display_name || `${member.first_name} ${member.last_name_paternal}`.trim();
            const initials = `${member.first_name?.[0] || ''}${member.last_name_paternal?.[0] || ''}`.toUpperCase() || '?';
            return (
              <div
                key={member.user_id}
                className="flex items-center gap-4 p-4 rounded-xl border"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: colors.border }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-semibold text-white overflow-hidden"
                  style={{ backgroundColor: team?.color || '#00D4B3' }}
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate" style={{ color: colors.textPrimary }}>
                    {name}
                  </p>
                  <p className="text-sm truncate" style={{ color: colors.textMuted }}>
                    {member.email}
                  </p>
                </div>
                <div className="text-right text-xs" style={{ color: colors.textMuted }}>
                  <p className="capitalize">{member.role}</p>
                  <p>{member.tasks_count || 0} tareas</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
