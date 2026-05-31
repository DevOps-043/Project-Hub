'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

interface TeamSummary {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  memberCount?: number;
}

export default function TasksLandingContent({ globalAdmin = false }: { globalAdmin?: boolean }) {
  const params = useParams();
  const pathname = usePathname();
  const orgSlug = params.orgSlug as string | undefined;
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { apiUrl, basePath } = useMemo(() => {
    if (globalAdmin) {
      return { apiUrl: '/api/admin/teams?limit=100', basePath: '/admin' };
    }

    const isWorkspaceAdminPath = Boolean(orgSlug && pathname.startsWith(`/${orgSlug}/admin`));
    return {
      apiUrl: `/api/workspaces/${orgSlug}/teams?limit=100`,
      basePath: `/${orgSlug}${isWorkspaceAdminPath ? '/admin' : ''}`,
    };
  }, [globalAdmin, orgSlug, pathname]);

  useEffect(() => {
    let cancelled = false;

    const loadTeams = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(apiUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'No se pudieron cargar los equipos');
        }

        if (!cancelled) {
          setTeams(data.teams || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los equipos');
          setTeams([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTeams();

    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>Tareas</h1>
        <p className="text-sm" style={{ color: colors.textMuted }}>
          Selecciona un equipo para crear, revisar y actualizar sus tareas.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg border p-4 text-sm text-red-500" style={{ borderColor: colors.border }}>
          {error}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-lg border p-6 text-sm" style={{ borderColor: colors.border, color: colors.textMuted }}>
          No hay equipos disponibles para gestionar tareas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map(team => (
            <Link
              key={team.id}
              href={`${basePath}/teams/${team.id}/tasks`}
              className="rounded-lg border p-5 transition-colors hover:border-[#00D4B3]"
              style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold truncate" style={{ color: colors.textPrimary }}>{team.name}</h2>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: colors.textMuted }}>
                    {team.description || 'Gestionar tareas del equipo'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${team.color || '#00D4B3'}20`, color: team.color || '#00D4B3' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 text-xs" style={{ color: colors.textMuted }}>
                {team.memberCount || 0} miembros
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
