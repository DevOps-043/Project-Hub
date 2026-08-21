'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { api } from '@/lib/api/client';
import { TeamPanelContext, type TeamPanelTeam } from '@/components/teams/TeamPanelContext';
import { TeamTabBar } from '@/components/teams/TeamTabBar';
import { AlertTriangle } from 'lucide-react';

/**
 * Equivalente de app/[orgSlug]/admin/teams/[teamId]/layout.tsx para el panel
 * de administración global (sin organización). Ese árbol solo tiene páginas
 * de tasks/projects/cycles/members (sin Resumen/Documentos/Configuración),
 * así que restringe availableTabs y usa /api/admin/teams/:id en vez del
 * endpoint scoped a workspace. requireAdmin ya gatea todo /admin/*, por eso
 * canManage/canDelete van fijos en true.
 */
export default function GlobalTeamPanelLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const teamId = params.teamId as string;
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const [team, setTeam] = useState<TeamPanelTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshTeam = useCallback(async () => {
    setError('');
    try {
      const { data, error: apiError } = await api.get<TeamPanelTeam>(`/api/admin/teams/${teamId}`);
      if (apiError || !data) throw new Error(apiError || 'No se pudo cargar el equipo');
      setTeam(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el equipo');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { refreshTeam(); }, [refreshTeam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)' }} />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-lg mx-auto py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)', color: 'var(--color-error)' }}>
          <AlertTriangle size={26} />
        </div>
        <p className="text-sm" style={{ color: colors.textMuted }}>{error || 'Equipo no encontrado'}</p>
      </div>
    );
  }

  return (
    <TeamPanelContext.Provider
      value={{
        team, loading, error, refreshTeam, panelBase: '/admin', workspaceSlug: '', teamId,
        canManage: true, canDelete: true, availableTabs: ['tasks', 'projects', 'cycles', 'members'],
      }}
    >
      <div className="min-h-screen" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0"
              style={{ backgroundColor: `${team.color}26`, color: team.color, border: `1px solid ${team.color}55` }}
            >
              {team.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{ color: colors.textPrimary, fontFamily: 'var(--font-system-display)' }}>
                {team.name}
              </h1>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                {team.memberCount} {team.memberCount === 1 ? 'miembro' : 'miembros'} · {team.status === 'active' ? 'Activo' : team.status}
              </p>
            </div>
          </div>

          <TeamTabBar />

          {children}
        </div>
      </div>
    </TeamPanelContext.Provider>
  );
}
