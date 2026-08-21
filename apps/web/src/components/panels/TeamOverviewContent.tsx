'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { api } from '@/lib/api/client';
import { useTeamPanel } from '@/components/teams/TeamPanelContext';
import {
  ArrowRight, Crown, FileText, FolderKanban, ListChecks, RefreshCw, Sparkles, Users,
} from 'lucide-react';

interface Person { id: string; name: string; email: string; avatarUrl: string | null }
interface OverviewData {
  team: {
    id: string; name: string; slug: string; description: string | null; color: string;
    status: string; visibility: string; owner: Person | null; createdAt: string;
  };
  hierarchyNode: { id: string; name: string; manager: Person | null } | null;
  stats: {
    membersCount: number; projectsCount: number; activeProjectsCount: number;
    tasksTotal: number; tasksCompleted: number; activeCyclesCount: number; documentsCount: number;
  };
  previews: {
    members: (Person & { role: string })[];
    projects: { project_id: string; project_key: string; project_name: string; project_status: string; completion_percentage: number; icon_color: string }[];
    cycles: { cycle_id: string; name: string; status: string; progress_percent: number; scope_count: number; completed_count: number }[];
    documents: { id: string; name: string; doc_type: string; external_url: string }[];
  };
}

/**
 * Cuerpo de la pestaña Resumen. El header (nombre, avatar, tabs) ya lo
 * renderiza el layout compartido — esta vista solo aporta lo que la
 * distingue de las otras seis pestañas: KPIs, responsable y previews.
 */
export function TeamOverviewContent() {
  const { teamId, panelBase, workspaceSlug } = useTeamPanel();
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: body, error: apiError } = await api.get<OverviewData>(`/api/workspaces/${workspaceSlug}/teams/${teamId}/overview`);
      if (apiError || !body) throw new Error(apiError || 'No se pudo cargar el resumen');
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen');
    } finally {
      setLoading(false);
    }
  }, [teamId, workspaceSlug]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-sm" style={{ color: colors.textMuted }}>{error || 'No se pudo cargar el equipo'}</p>
      </div>
    );
  }

  const { team, hierarchyNode, stats, previews } = data;
  const responsible = hierarchyNode?.manager || team.owner;

  return (
    <div>
      {(team.description || hierarchyNode) && (
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <p className="text-sm max-w-xl" style={{ color: colors.textMuted }}>
            {team.description || 'Equipo listo para colaborar en proyectos y tareas.'}
          </p>
          {hierarchyNode && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}
            >
              <Sparkles size={12} /> Vinculado a arquitectura: {hierarchyNode.name}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(260px,.35fr)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={<Users size={16} />} label="Miembros" value={stats.membersCount} colors={colors} />
          <Stat icon={<FolderKanban size={16} />} label="Proyectos activos" value={stats.activeProjectsCount} colors={colors} />
          <Stat icon={<ListChecks size={16} />} label="Tareas" value={`${stats.tasksCompleted}/${stats.tasksTotal}`} colors={colors} />
          <Stat icon={<RefreshCw size={16} />} label="Ciclos activos" value={stats.activeCyclesCount} colors={colors} />
        </div>

        <div className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: colors.textMuted }}>
            <Crown size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Responsable</span>
          </div>
          {responsible ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 18%, transparent)', color: 'var(--color-accent)' }}>
                {responsible.avatarUrl ? <img src={responsible.avatarUrl} alt="" className="w-full h-full object-cover" /> : responsible.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: colors.textPrimary }}>{responsible.name}</p>
                <p className="text-xs truncate" style={{ color: colors.textMuted }}>{responsible.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: colors.textMuted }}>Sin responsable asignado</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PreviewCard title="Proyectos" icon={<FolderKanban size={15} />} href={`${panelBase}/teams/${teamId}/projects`} colors={colors} empty={!previews.projects.length} emptyText="Sin proyectos todavía">
          {previews.projects.map((project) => (
            <div key={project.project_id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate" style={{ color: colors.textPrimary }}>{project.project_name}</span>
              <span className="text-[11px] font-semibold shrink-0 ml-2" style={{ color: colors.textMuted }}>{project.completion_percentage}%</span>
            </div>
          ))}
        </PreviewCard>

        <PreviewCard title="Ciclos" icon={<RefreshCw size={15} />} href={`${panelBase}/teams/${teamId}/cycles`} colors={colors} empty={!previews.cycles.length} emptyText="Sin ciclos activos o próximos">
          {previews.cycles.map((cycle) => (
            <div key={cycle.cycle_id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate" style={{ color: colors.textPrimary }}>{cycle.name}</span>
              <span className="text-[11px] font-semibold shrink-0 ml-2" style={{ color: colors.textMuted }}>{cycle.completed_count}/{cycle.scope_count}</span>
            </div>
          ))}
        </PreviewCard>

        <PreviewCard title="Documentos" icon={<FileText size={15} />} href={`${panelBase}/teams/${teamId}/documents`} colors={colors} empty={!previews.documents.length} emptyText="Sin documentos vinculados">
          {previews.documents.map((doc) => (
            <a key={doc.id} href={doc.external_url} target="_blank" rel="noreferrer" className="flex items-center justify-between py-2 text-sm hover:underline">
              <span className="truncate" style={{ color: colors.textPrimary }}>{doc.name}</span>
            </a>
          ))}
        </PreviewCard>

        <PreviewCard title="Miembros" icon={<Users size={15} />} href={`${panelBase}/teams/${teamId}/members`} colors={colors} empty={!previews.members.length} emptyText="Sin miembros todavía">
          {previews.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate" style={{ color: colors.textPrimary }}>{member.name}</span>
              <span className="text-[10px] uppercase font-semibold shrink-0 ml-2" style={{ color: colors.textMuted }}>{member.role}</span>
            </div>
          ))}
        </PreviewCard>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, colors }: { icon: React.ReactNode; label: string; value: number | string; colors: typeof themeColors.light }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--color-accent)' }}>{icon}</div>
      <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>{label}</p>
    </div>
  );
}

function PreviewCard({ title, icon, href, colors, empty, emptyText, children }: {
  title: string; icon: React.ReactNode; href: string; colors: typeof themeColors.light;
  empty: boolean; emptyText: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2" style={{ color: colors.textPrimary }}>
          {icon}
          <h3 className="text-sm font-bold">{title}</h3>
        </div>
        <Link href={href} className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
          Ver todo <ArrowRight size={13} />
        </Link>
      </div>
      {empty ? (
        <p className="text-xs py-3" style={{ color: colors.textMuted }}>{emptyText}</p>
      ) : (
        <div className="divide-y" style={{ borderColor: colors.border }}>{children}</div>
      )}
    </div>
  );
}
