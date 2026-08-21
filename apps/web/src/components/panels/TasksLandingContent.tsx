'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, CheckCircle2, Search, Users, Workflow } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { api } from '@/lib/api/client';
import { CollectionToolbar, EmptyState, LoadingState, MetricStrip, PageHero, ProductPage, ProductSurface, productInputClass, productInputIconClass, productInputWrapClass, type ProductMetric } from '@/components/product';
import styles from './TasksLandingContent.module.css';

type TeamSummary = { id: string; name: string; description?: string | null; color?: string | null; memberCount?: number };

export default function TasksLandingContent({ globalAdmin = false, mode = 'tasks' }: { globalAdmin?: boolean; mode?: 'tasks' | 'teams' }) {
  const params = useParams(); const pathname = usePathname(); const orgSlug = params.orgSlug as string | undefined;
  const [teams, setTeams] = useState<TeamSummary[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState('');
  const config = useMemo(() => globalAdmin ? { endpoint: '/api/admin/teams?limit=100', basePath: '/admin' } : { endpoint: `/api/workspaces/${orgSlug}/teams?limit=100`, basePath: `/${orgSlug}${pathname.startsWith(`/${orgSlug}/admin`) ? '/admin' : ''}` }, [globalAdmin, orgSlug, pathname]);
  useEffect(() => { let active = true; setLoading(true); api.get<{ teams?: TeamSummary[] }>(config.endpoint).then((response) => { if (!active) return; if (response.error) setError(response.error); else setTeams(response.data?.teams || []); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [config.endpoint]);
  const visible = teams.filter((team) => `${team.name} ${team.description || ''}`.toLocaleLowerCase('es-MX').includes(search.trim().toLocaleLowerCase('es-MX')));
  const metrics: ProductMetric[] = [ { label: 'Equipos disponibles', value: teams.length, icon: Users }, { label: 'Miembros representados', value: teams.reduce((sum, team) => sum + (team.memberCount || 0), 0), icon: Users, tone: 'info' }, { label: 'Centros de trabajo', value: visible.length, icon: CheckCircle2, tone: 'success' } ];
  const isTeamDirectory = mode === 'teams';
  return <ProductPage><PageHero eyebrow={isTeamDirectory ? 'Colaboración' : 'Ejecución operativa'} title={isTeamDirectory ? 'Mis equipos' : 'Tareas por equipo'} description={isTeamDirectory ? 'Consulta los equipos a los que perteneces y entra a su espacio de trabajo.' : 'Selecciona un equipo para planificar, priorizar y dar seguimiento al trabajo sin perder contexto.'} icon={isTeamDirectory ? Users : Workflow} /><MetricStrip metrics={metrics} /><CollectionToolbar><label className={productInputWrapClass}><Search className={productInputIconClass} size={16} aria-hidden /><input className={productInputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar equipo…" /></label><span className={styles.count}>{visible.length} resultados</span></CollectionToolbar>
    {loading ? <LoadingState label="Preparando los espacios de trabajo…" /> : error ? <EmptyState icon={Workflow} title="No pudimos cargar los equipos" description={error} /> : visible.length ? <section className={styles.grid}>{visible.map((team) => <ProductSurface key={team.id} padded className={styles.card}><span className={styles.avatar} style={{ '--team-color': team.color || 'var(--accent)' } as CSSProperties}>{team.name.slice(0, 2).toUpperCase()}</span><small>Equipo · {team.memberCount || 0} miembros</small><h2>{team.name}</h2><p>{team.description || 'Espacio operativo para coordinar tareas, responsables y fechas.'}</p><Link href={`${config.basePath}/teams/${team.id}${isTeamDirectory ? '' : '/tasks'}`}>{isTeamDirectory ? 'Abrir equipo' : 'Gestionar tareas'} <ArrowRight size={15} aria-hidden /></Link></ProductSurface>)}</section> : <EmptyState icon={Workflow} title="No hay equipos disponibles" description="Cuando exista un equipo podrás gestionar aquí su trabajo." />}
  </ProductPage>;
}
