'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, Bot, CheckCircle2, CircleGauge, Clock3, FolderKanban, Gauge, Layers3, Sparkles, TriangleAlert, UsersRound } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useOptionalWorkspace } from '@/contexts/WorkspaceContext';
import { api } from '@/lib/api/client';
import { EmptyState, LoadingState, MetricStrip, PageHero, ProductPage, ProductSurface, type ProductMetric } from '@/components/product';
import styles from './AnalyticsDashboard.module.css';

type GlobalData = {
  tasks: { total: number; distribution: Array<{ name: string; value: number; color?: string }> };
  projects: { total: number; completed: number; active: number };
  heatmap: Array<{ date: string; count: number }>;
  leaderboard: Array<{ user: { full_name: string; email: string; avatar_url?: string | null }; count: number }>;
  ariaUsage: Array<{ date: string; tokens: number }>;
};
type WorkspaceData = {
  summary: {
    totalTasks?: number;
    teamCount?: number;
    memberCount?: number;
    overdueTasks?: number;
    unassignedTasks?: number;
    avgCycleTime: number;
    completionRate?: number;
    compilationRate?: number;
    projectHealth?: Record<'on_track' | 'at_risk' | 'off_track' | 'none', number>;
  };
  tasks?: { total: number; distribution: Array<{ name: string; value: number; color?: string }> };
  projects?: { total: number; completed: number; active: number };
  teams?: Array<{ id: string; name: string; total: number; completed: number; completionRate: number }>;
  velocity?: Array<{ name: string; points: number }>;
  workload?: Array<{ name: string; tasks: number; points?: number }>;
  heatmap: Array<{ date: string; count: number }>;
  leaderboard?: Array<{ user: { user_id: string; full_name: string; email: string; avatar_url: string | null }; count: number }>;
};

const tooltipStyle = { background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', boxShadow: 'var(--elevation-dropdown)', color: 'var(--text-primary)', fontSize: '12px' };

function ActivityHeatmap({ data }: { data: Array<{ date: string; count: number }> }) {
  const days = useMemo(() => {
    const values = new Map(data.map((item) => [item.date, item.count]));
    return Array.from({ length: 365 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (364 - index));
      const key = date.toISOString().slice(0, 10);
      const count = values.get(key) || 0;
      return { date: key, count, level: count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4 };
    });
  }, [data]);
  return <div className={styles.heatmapWrap}><div className={styles.heatmap} aria-label="Actividad diaria del último año">{days.map((day) => <span key={day.date} data-level={day.level} title={`${day.date}: ${day.count} tareas`} />)}</div><div className={styles.heatLegend}><span>Menos</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}<span>Más</span></div></div>;
}

function ChartCard({ eyebrow, title, description, children, wide = false }: { eyebrow: string; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  return <ProductSurface className={wide ? styles.wide : ''}><header className={styles.cardHeader}><div><span>{eyebrow}</span><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></header><div className={styles.chart}>{children}</div></ProductSurface>;
}

function GlobalAnalytics({ data }: { data: GlobalData }) {
  const completed = data.tasks.distribution.find((item) => item.name.toLowerCase().includes('complet'))?.value || 0;
  const completion = data.tasks.total ? Math.round(completed / data.tasks.total * 100) : 0;
  const metrics: ProductMetric[] = [
    { label: 'Tareas registradas', value: data.tasks.total, icon: CheckCircle2 },
    { label: 'Proyectos activos', value: data.projects.active, hint: `${data.projects.completed} completados`, icon: FolderKanban },
    { label: 'Tasa de entrega', value: `${completion}%`, icon: Gauge, tone: completion < 50 ? 'warning' : 'success' },
    { label: 'IA · último registro', value: data.ariaUsage.at(-1)?.tokens || 0, hint: 'tokens procesados', icon: Bot },
  ];
  const palette = ['var(--chart-primary)', 'var(--chart-secondary)', 'var(--chart-warning)', 'var(--chart-danger)', 'var(--chart-neutral)'];
  return <><MetricStrip metrics={metrics} /><section className={styles.grid}>
    <ChartCard eyebrow="Distribución" title="Estado de tareas" description="Volumen actual por etapa de trabajo."><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.tasks.distribution} innerRadius="56%" outerRadius="78%" paddingAngle={3} dataKey="value">{data.tasks.distribution.map((item, index) => <Cell key={item.name} fill={item.color || palette[index % palette.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" /></PieChart></ResponsiveContainer></ChartCard>
    <ChartCard eyebrow="Rendimiento" title="Colaboradores con mayor entrega" description="Tareas completadas en el periodo seleccionado."><div className={styles.leaderboard}>{data.leaderboard.length ? data.leaderboard.map((item, index) => <article key={item.user.email}><b>{String(index + 1).padStart(2, '0')}</b><span className={styles.avatar}>{item.user.avatar_url ? <img src={item.user.avatar_url} alt="" /> : item.user.full_name?.slice(0, 1) || 'U'}</span><span><strong>{item.user.full_name || 'Sin nombre'}</strong><small>{item.user.email}</small></span><em>{item.count}<small> tareas</small></em></article>) : <EmptyState icon={Activity} title="Todavía no hay actividad" description="La clasificación aparecerá cuando existan tareas completadas." compact />}</div></ChartCard>
    <ChartCard eyebrow="Actividad" title="Ritmo de trabajo" description="Intensidad diaria de entregas durante los últimos 365 días." wide><ActivityHeatmap data={data.heatmap} /></ChartCard>
    <ChartCard eyebrow="SofLIA" title="Consumo de inteligencia artificial" description="Tokens procesados por día." wide><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.ariaUsage}><defs><linearGradient id="analyticsTokenFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.32}/><stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="tokens" stroke="var(--chart-primary)" strokeWidth={2} fill="url(#analyticsTokenFill)" /></AreaChart></ResponsiveContainer></ChartCard>
  </section></>;
}

function WorkspaceAnalytics({ data }: { data: WorkspaceData }) {
  const health = data.summary.projectHealth || { on_track: 0, at_risk: 0, off_track: 0, none: 0 };
  const velocity = data.velocity || [];
  const workload = data.workload || [];
  const teams = data.teams || [];
  const leaderboard = data.leaderboard || [];
  const taskDistribution = (data.tasks?.distribution || []).filter((item) => item.name !== 'Sin datos' && item.value > 0);
  const healthData = [
    { name: 'En curso', value: health.on_track, color: 'var(--chart-positive)' },
    { name: 'En riesgo', value: health.at_risk, color: 'var(--chart-warning)' },
    { name: 'Fuera de curso', value: health.off_track, color: 'var(--chart-danger)' },
    { name: 'Sin estado', value: health.none, color: 'var(--chart-neutral)' },
  ].filter((item) => item.value > 0);
  const metrics: ProductMetric[] = [
    { label: 'Tareas', value: data.summary.totalTasks || data.tasks?.total || 0, hint: `${data.summary.unassignedTasks || 0} sin responsable`, icon: CheckCircle2 },
    { label: 'Entrega', value: `${data.summary.completionRate ?? data.summary.compilationRate ?? 0}%`, hint: 'tareas completadas', icon: Gauge, tone: 'success' },
    { label: 'Vencidas', value: data.summary.overdueTasks || 0, hint: 'requieren atención', icon: TriangleAlert, tone: data.summary.overdueTasks ? 'error' : 'success' },
    { label: 'Proyectos', value: data.projects?.total || 0, hint: `${data.projects?.active || 0} activos`, icon: FolderKanban, tone: 'info' },
    { label: 'Personas', value: data.summary.memberCount || 0, hint: 'en la organización', icon: UsersRound },
    { label: 'Equipos', value: data.summary.teamCount || 0, hint: 'unidades operativas', icon: Layers3 },
  ];

  return (
    <>
      <MetricStrip metrics={metrics} />
      <div className={styles.analysisIndex} aria-label="Dimensiones del análisis">
        <span>Equipos</span><span>Personas</span><span>Proyectos</span><span>Tareas</span>
      </div>
      <section className={styles.grid}>
        <ChartCard eyebrow="Equipos" title="Rendimiento por equipo" description="Volumen asignado y porcentaje completado por unidad.">
          {teams.length ? (
            <div className={styles.breakdownList}>
              {teams.map((team) => (
                <article key={team.id}>
                  <span><strong>{team.name}</strong><small>{team.completed} de {team.total} tareas</small></span>
                  <div><i style={{ width: `${team.completionRate}%` }} /></div>
                  <em>{team.completionRate}%</em>
                </article>
              ))}
            </div>
          ) : <EmptyState icon={Layers3} title="Sin actividad por equipo" description="Los equipos aparecerán al recibir tareas." compact />}
        </ChartCard>

        <ChartCard eyebrow="Personas" title="Entrega por colaborador" description="Personas con más tareas completadas.">
          <div className={styles.leaderboard}>
            {leaderboard.length ? leaderboard.map((item, index) => (
              <article key={item.user.user_id}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <span className={styles.avatar}>{item.user.avatar_url ? <img src={item.user.avatar_url} alt="" /> : item.user.full_name.slice(0, 1)}</span>
                <span><strong>{item.user.full_name}</strong><small>{item.user.email}</small></span>
                <em>{item.count}<small> tareas</small></em>
              </article>
            )) : <EmptyState icon={UsersRound} title="Sin entregas registradas" description="La lectura aparecerá cuando se completen tareas." compact />}
          </div>
        </ChartCard>

        <ChartCard eyebrow="Tareas" title="Flujo de trabajo" description="Distribución de tareas por etapa.">
          {taskDistribution.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={taskDistribution} innerRadius="56%" outerRadius="78%" paddingAngle={3} dataKey="value">
                {taskDistribution.map((item, index) => <Cell key={item.name} fill={item.color || ['var(--chart-primary)', 'var(--chart-secondary)', 'var(--chart-warning)', 'var(--chart-danger)'][index % 4]} />)}
              </Pie><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" /></PieChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={CheckCircle2} title="Sin tareas medibles" description="Crea tareas para habilitar esta distribución." compact />}
        </ChartCard>

        <ChartCard eyebrow="Capacidad" title="Carga por persona" description="Tareas activas por colaborador.">
          {workload.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload} layout="vertical" margin={{ left: 14 }}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} /><Bar dataKey="tasks" radius={[0, 6, 6, 0]} fill="var(--chart-primary)" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={Activity} title="Sin carga activa" description="No hay tareas asignadas en este momento." compact />}
        </ChartCard>

        <ChartCard eyebrow="Velocidad" title="Entrega por ciclo" description="Puntos completados en los ciclos recientes.">
          {velocity.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={velocity}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="points" radius={[6, 6, 0, 0]} fill="var(--chart-secondary)" /></BarChart></ResponsiveContainer> : <EmptyState icon={CircleGauge} title="Sin ciclos completados" description="La velocidad aparecerá con el primer ciclo." compact />}
        </ChartCard>

        <ChartCard eyebrow="Proyectos" title="Salud del portafolio" description="Proyectos a tiempo, en riesgo o fuera de curso.">
          {healthData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={healthData} innerRadius="56%" outerRadius="78%" paddingAngle={3} dataKey="value">{healthData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" /></PieChart></ResponsiveContainer> : <EmptyState icon={FolderKanban} title="Sin proyectos medibles" description="Agrega proyectos para habilitar esta lectura." compact />}
        </ChartCard>

        <ChartCard eyebrow="Actividad" title="Eficiencia diaria" description="Intensidad de entregas durante los últimos 365 días." wide>
          <ActivityHeatmap data={data.heatmap} />
        </ChartCard>
      </section>
    </>
  );
}

export function AnalyticsDashboard({ scope }: { scope: 'global' | 'workspace' }) {
  const workspaceContext = useOptionalWorkspace();
  const [data, setData] = useState<GlobalData | WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const workspace = workspaceContext?.workspace;
  useEffect(() => {
    const endpoint = scope === 'global' ? '/api/admin/analytics' : workspace ? `/api/workspaces/${workspace.slug}/analytics` : '';
    if (!endpoint) return;
    let active = true;
    setLoading(true);
    api.get<GlobalData | WorkspaceData>(endpoint).then((response) => {
      if (!active) return;
      if (response.error || !response.data) setError(response.error || 'No fue posible cargar las métricas.'); else setData(response.data);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope, workspace]);
  if (loading) return <LoadingState label="Preparando métricas y tendencias…" />;
  if (error || !data) return <EmptyState icon={TriangleAlert} title="No pudimos cargar las analíticas" description={error || 'No hay datos disponibles todavía.'} />;
  return <ProductPage><PageHero eyebrow="Inteligencia operativa" title={scope === 'global' ? 'Analíticas de Project Hub' : 'Panel de liderazgo'} description={scope === 'global' ? 'Una lectura unificada del trabajo, la adopción y el uso de inteligencia artificial.' : `Rendimiento, capacidad y salud de ${workspace?.name || 'tu organización'} en una sola vista.`} icon={Sparkles} />{scope === 'global' ? <GlobalAnalytics data={data as GlobalData} /> : <WorkspaceAnalytics data={data as WorkspaceData} />}</ProductPage>;
}
