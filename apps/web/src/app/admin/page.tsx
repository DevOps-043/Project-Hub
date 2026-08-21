'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  FolderKanban,
  ListChecks,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { useAuthStore } from '@/core/stores/authStore';
import { api } from '@/lib/api/client';
import {
  MetricStrip,
  PageHero,
  PageSection,
  ProductPage,
  type ProductMetric,
} from '@/components/product';
import styles from './AdminDashboard.module.css';

interface AdminStats {
  users: number | null;
  teams: number | null;
  projects: number | null;
  tasks: number | null;
}

const initialStats: AdminStats = { users: null, teams: null, projects: null, tasks: null };

function countFrom(response: unknown, collectionKey: string) {
  if (!response || typeof response !== 'object') return 0;
  const record = response as Record<string, unknown>;
  const pagination = record.pagination as { total?: number } | undefined;
  if (typeof pagination?.total === 'number') return pagination.total;
  const collection = record[collectionKey];
  return Array.isArray(collection) ? collection.length : 0;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<AdminStats>(initialStats);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      const [users, teams, projects, analytics] = await Promise.allSettled([
        api.get<unknown>('/api/admin/users?limit=1'),
        api.get<unknown>('/api/admin/teams?limit=1'),
        api.get<unknown>('/api/admin/projects?limit=1'),
        api.get<{ tasks?: { total?: number } }>('/api/admin/analytics'),
      ]);
      if (!active) return;
      setStats({
        users: users.status === 'fulfilled' ? countFrom(users.value.data, 'users') : 0,
        teams: teams.status === 'fulfilled' ? countFrom(teams.value.data, 'teams') : 0,
        projects: projects.status === 'fulfilled' ? countFrom(projects.value.data, 'projects') : 0,
        tasks: analytics.status === 'fulfilled' && typeof analytics.value.data?.tasks?.total === 'number'
          ? analytics.value.data.tasks.total
          : 0,
      });
    };
    loadStats();
    return () => { active = false; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = (user?.name || user?.firstName || 'Administrador').split(' ')[0];

  const metrics: ProductMetric[] = [
    { label: 'Usuarios', value: stats.users ?? '—', hint: 'personas registradas', icon: UsersRound },
    { label: 'Equipos', value: stats.teams ?? '—', hint: 'grupos operativos', icon: ShieldCheck, tone: 'success' },
    { label: 'Proyectos', value: stats.projects ?? '—', hint: 'iniciativas visibles', icon: FolderKanban, tone: 'info' },
    { label: 'Tareas', value: stats.tasks ?? '—', hint: 'actividad coordinada', icon: ListChecks, tone: 'warning' },
  ];

  const actions = [
    { label: 'Gestionar tareas', description: 'Prioriza trabajo, responsables y evidencia.', icon: ListChecks, href: '/admin/tasks' },
    { label: 'Nuevo proyecto', description: 'Convierte un objetivo en un espacio de ejecución.', icon: FolderKanban, href: '/admin/projects?create=true' },
    { label: 'Organizar equipos', description: 'Organiza responsables, capacidad y entregables.', icon: Users, href: '/admin/teams' },
    { label: 'Gestionar personas', description: 'Incorpora a una persona y define su acceso.', icon: UserPlus, href: '/admin/users' },
    { label: 'Revisar analítica', description: 'Detecta avance, carga y riesgos operativos.', icon: BarChart3, href: '/admin/analytics' },
    { label: 'Consultar reportes', description: 'Prepara una lectura ejecutiva de la operación.', icon: Activity, href: '/admin/reports' },
  ];

  return (
    <ProductPage>
      <PageHero
        eyebrow="Control organizacional"
        title={`${greeting}, ${firstName}.`}
        description="Supervisa personas, proyectos y equipos desde una vista clara y accionable."
        icon={Activity}
        actions={(
          <button type="button" onClick={() => router.push('/admin/projects?create=true')}>
            <Plus size={16} aria-hidden="true" /> Crear proyecto
          </button>
        )}
      />

      <PageSection title="Estado general" description="Indicadores esenciales de la operación actual.">
        <MetricStrip metrics={metrics} />
      </PageSection>

      <PageSection title="Acciones rápidas" description="Accede a los flujos de administración más frecuentes.">
        <div className={styles.actionGrid}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} type="button" className={styles.actionCard} onClick={() => router.push(action.href)}>
                <span className={styles.actionIcon}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className={styles.actionCopy}>
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </span>
                <ArrowUpRight className={styles.actionArrow} size={17} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </PageSection>
    </ProductPage>
  );
}
