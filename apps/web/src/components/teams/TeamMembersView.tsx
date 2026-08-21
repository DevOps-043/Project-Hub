'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { AddMemberModal } from '@/components/admin/teams/AddMemberModal';
import { api } from '@/lib/api/client';
import { useTeamPanel } from './TeamPanelContext';
import { TeamPanelEmptyState } from './TeamPanelEmptyState';
import { softBg } from './status-config';
import { Search, UserPlus, Users } from 'lucide-react';

// Types
interface TeamMember {
  user_id: string;
  first_name: string;
  last_name_paternal: string;
  display_name?: string;
  email: string;
  avatar_url?: string;
  role: string; // 'lead', 'member', etc.
  status: 'active' | 'offline' | 'busy';
  joined_at: string;
  tasks_count?: number;
  completed_tasks_count?: number;
  team_id?: string;
}

interface MemberCardProps {
  member: TeamMember;
  teamId: string;
  panelBase: string;
  isDark: boolean;
  colors: typeof themeColors.dark;
  index: number;
}

const accentColor = 'var(--color-accent)';

/**
 * Lista de miembros de equipo. Compartida entre /admin/teams/[teamId]/members
 * y /[orgSlug]/admin/teams/[teamId]/members, que eran implementaciones
 * duplicadas casi idénticas salvo por el prefijo de ruta de los enlaces.
 */
export default function TeamMembersView() {
  const { teamId, panelBase, team, canManage } = useTeamPanel();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Fetch from API
  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await api.get<{ members: TeamMember[] }>(`/api/admin/teams/${teamId}/members`);

      if (error || !data) {
        throw new Error(error || 'Failed to fetch team members');
      }

      setMembers(data.members);

    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const filteredMembers = members.filter(member =>
    member.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
     return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor }} />
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
          <input
            type="text"
            placeholder="Buscar miembro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-xl border text-sm w-64 focus:outline-none focus:ring-1"
            style={{
              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
              borderColor: colors.border,
              color: colors.textPrimary,
              boxShadow: 'none'
            }}
          />
        </div>

        <div className="flex items-center gap-3">
           {/* View Toggle */}
           <div className="flex items-center rounded-lg border" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setView('grid')}
              className="p-2 transition-colors"
              style={{
                backgroundColor: view === 'grid' ? softBg(accentColor) : 'transparent',
                color: view === 'grid' ? accentColor : colors.textMuted
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className="p-2 transition-colors"
              style={{
                backgroundColor: view === 'list' ? softBg(accentColor) : 'transparent',
                color: view === 'list' ? accentColor : colors.textMuted
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>

          {canManage ? (
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <UserPlus size={16} /> Añadir miembro
            </button>
          ) : null}
        </div>
      </div>

      {/* Content */}
      {filteredMembers.length === 0 ? (
        <TeamPanelEmptyState
          icon={<Users size={26} />}
          title={searchQuery ? 'Sin resultados' : 'Sin miembros todavía'}
          description={searchQuery ? 'Ningún miembro coincide con tu búsqueda.' : 'Añade personas a este equipo para empezar a colaborar.'}
          action={searchQuery || !canManage ? null : { label: 'Añadir miembro', onClick: () => setShowAddMemberModal(true) }}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member, index) => (
              <MemberCard key={member.user_id} member={member} teamId={teamId} panelBase={panelBase} isDark={isDark} colors={colors} index={index} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
           {filteredMembers.map((member, index) => (
              <MemberRow key={member.user_id} member={member} teamId={teamId} panelBase={panelBase} isDark={isDark} colors={colors} index={index} />
          ))}
        </div>
      )}

       {/* Modal */}
       {canManage ? (
         <AddMemberModal
          isOpen={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={fetchTeamData}
          teamId={teamId}
          teamName={team?.name}
        />
       ) : null}
    </div>
  );
}

// Sub-components
function MemberCard({ member, teamId, panelBase, isDark, colors, index }: MemberCardProps) {
    const initials = (member.first_name?.[0] || 'U') + (member.last_name_paternal?.[0] || '');
    const profileHref = `${panelBase}/teams/${member.team_id || teamId}/members/${member.user_id}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-6 rounded-2xl border transition-all hover:border-white/20 hover:shadow-lg group relative overflow-hidden"
            style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                borderColor: colors.border
            }}
        >
             {/* Role Badge */}
             <div className="absolute top-4 right-4">
                <span
                    className="px-2 py-1 rounded-full text-xs font-medium border"
                    style={member.role === 'lead'
                        ? { backgroundColor: softBg(accentColor), color: accentColor, borderColor: softBg(accentColor, 20) }
                        : { backgroundColor: softBg('#6B7280'), color: '#6B7280', borderColor: softBg('#6B7280', 20) }}
                >
                    {member.role === 'lead' ? 'Team Lead' : member.role}
                </span>
             </div>

            <div className="flex flex-col items-center text-center mb-6">
                <div className="relative mb-3">
                    <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-bold mb-2 shadow-lg"
                        style={{
                            background: `linear-gradient(135deg, ${softBg(accentColor, 20)}, ${softBg(accentColor, 40)})`,
                            color: accentColor,
                            border: `1px solid ${softBg(accentColor, 40)}`
                        }}
                    >
                         {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.first_name} className="w-full h-full object-cover rounded-2xl" />
                         ) : initials}
                    </div>
                    {/* Status Indicator */}
                    <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 flex items-center justify-center ${
                            member.status === 'active' ? 'bg-green-500' : member.status === 'busy' ? 'bg-amber-500' : 'bg-gray-500'
                        }`}
                        style={{ borderColor: isDark ? '#0F1419' : '#fff' }}
                    />
                </div>

                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                    {member.display_name || `${member.first_name} ${member.last_name_paternal}`}
                </h3>
                <p className="text-sm" style={{ color: colors.textMuted }}>{member.email}</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-t border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{member.tasks_count}</div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: colors.textMuted }}>Tareas</div>
                </div>
                <div className="text-center border-l" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                    <div className="text-2xl font-bold" style={{ color: '#10B981' }}>{member.completed_tasks_count}</div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: colors.textMuted }}>Completadas</div>
                </div>
            </div>

            <div className="flex gap-2">
                 <Link
                    href={profileHref}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 border border-transparent hover:border-white/10 text-center"
                    style={{ color: colors.textSecondary }}
                 >
                    Ver Perfil
                 </Link>
                 {/* <button className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 border border-transparent hover:border-white/10" style={{ color: colors.textSecondary }}>
                    Asignar Tarea
                 </button> */}
            </div>
        </motion.div>
    );
}

function MemberRow({ member, isDark, colors, index }: MemberCardProps) {
    const initials = (member.first_name?.[0] || 'U') + (member.last_name_paternal?.[0] || '');

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex items-center gap-4 p-4 rounded-xl border transition-all hover:border-white/20 hover:bg-white/5 group"
            style={{
                borderColor: colors.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'white'
             }}
        >
             <div className="relative">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{
                        background: `linear-gradient(135deg, ${softBg(accentColor, 20)}, ${softBg(accentColor, 40)})`,
                        color: accentColor,
                    }}
                >
                     {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.first_name} className="w-full h-full object-cover rounded-lg" />
                     ) : initials}
                </div>
                 <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 ${
                         member.status === 'active' ? 'bg-green-500' : member.status === 'busy' ? 'bg-amber-500' : 'bg-gray-500'
                    }`}
                    style={{ borderColor: isDark ? '#0F1419' : '#fff' }}
                />
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                 <div className="md:col-span-2">
                    <h4 className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                       {member.display_name || `${member.first_name} ${member.last_name_paternal}`}
                    </h4>
                    <p className="text-xs truncate" style={{ color: colors.textMuted }}>{member.email}</p>
                 </div>

                 <div className="hidden md:block">
                     <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={member.role === 'lead'
                            ? { backgroundColor: softBg(accentColor), color: accentColor, borderColor: softBg(accentColor, 20) }
                            : { backgroundColor: softBg('#6B7280'), color: '#6B7280', borderColor: softBg('#6B7280', 20) }}
                    >
                        {member.role === 'lead' ? 'Team Lead' : member.role}
                    </span>
                 </div>

                 <div className="hidden md:flex items-center gap-4 text-xs" style={{ color: colors.textMuted }}>
                    <span>{member.tasks_count} Tareas</span>
                    <span className="text-green-500">{member.completed_tasks_count} Completadas</span>
                 </div>
            </div>

            <button className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-white/10 transition-all" style={{ color: colors.textMuted }}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                </svg>
            </button>
        </motion.div>
    );
}
