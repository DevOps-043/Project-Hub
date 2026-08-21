import { Fragment, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Folder, FolderX, Rocket, Target, Zap } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { EmptyState, LoadingState, productControlClass } from '@/components/product';
import styles from './ProjectListView.module.css';

interface Project {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  project_status?: string;
  icon_name: string;
  icon_color: string;
  health_status: 'on_track' | 'at_risk' | 'off_track' | 'none';
  priority_level: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  lead?: { id: string; name: string; avatar?: string; initials: string; color: string };
  target_date: string | null;
  completion_percentage: number;
  progress_history: { value: number }[];
  team_name?: string;
}

interface ProjectListViewProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  basePath?: string;
  grouping?: 'none' | 'status' | 'priority';
  showCycles?: boolean;
}

const projectIcons: Record<string, ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>> = {
  folder: Folder,
  rocket: Rocket,
  target: Target,
  zap: Zap,
};

const healthLabels = {
  on_track: 'En curso',
  at_risk: 'En riesgo',
  off_track: 'Desviado',
  none: 'Sin evaluar',
};

const priorityLabels = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  none: 'Sin prioridad',
};

function ProjectAvatar({ project }: { project: Project }) {
  if (!project.lead) return <span className={styles.emptyAvatar} title="Sin responsable">—</span>;
  return (
    <span className={styles.avatar} style={{ backgroundColor: project.lead.color }} title={project.lead.name}>
      {project.lead.avatar ? (
        <img src={project.lead.avatar} alt="" />
      ) : project.lead.initials}
    </span>
  );
}

function ProgressCell({ project }: { project: Project }) {
  const completed = project.completion_percentage >= 100;
  return (
    <div className={styles.progressCell} data-complete={completed ? 'true' : 'false'}>
      <div className={styles.sparkline} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={project.progress_history}>
            <Line type="monotone" dataKey="value" stroke="var(--progress-tone)" strokeWidth={1.7} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span>{project.completion_percentage}%</span>
    </div>
  );
}

function formatDate(date: string | null) {
  if (!date) return 'Sin fecha';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getGroups(projects: Project[], grouping: ProjectListViewProps['grouping']) {
  if (!grouping || grouping === 'none') return [{ id: 'all', label: '', projects }];
  const groups = new Map<string, Project[]>();
  for (const project of projects) {
    const key = grouping === 'status' ? project.project_status || 'planning' : project.priority_level || 'none';
    groups.set(key, [...(groups.get(key) || []), project]);
  }
  return [...groups].map(([id, groupedProjects]) => ({
    id,
    label: grouping === 'status'
      ? id.replaceAll('_', ' ')
      : priorityLabels[id as keyof typeof priorityLabels] || id,
    projects: groupedProjects,
  }));
}

export function ProjectListView({
  projects,
  loading,
  error,
  onRefresh,
  basePath = '/admin',
  grouping = 'none',
  showCycles = false,
}: ProjectListViewProps) {
  const router = useRouter();

  if (loading) return <LoadingState label="Organizando el portafolio…" />;
  if (error) return (
    <EmptyState
      icon={FolderX}
      title="No pudimos cargar los proyectos"
      description={`${error} La vista y los filtros actuales se conservarán.`}
      action={<button type="button" className={productControlClass} onClick={onRefresh}>Intentar de nuevo</button>}
    />
  );
  if (!projects.length) return (
    <EmptyState
      icon={FolderX}
      title="No hay proyectos en esta vista"
      description="Ajusta los filtros o crea un proyecto para comenzar a organizar el trabajo."
    />
  );

  const groups = getGroups(projects, grouping);

  return (
    <div className={styles.tableSurface}>
      <div className={styles.tableHeader} role="row">
        <span>Proyecto</span>
        <span>Salud</span>
        <span>Prioridad</span>
        <span>Responsable</span>
        {showCycles ? <span>Ciclo</span> : null}
        <span>Fecha objetivo</span>
        <span>Progreso</span>
      </div>

      <div role="rowgroup">
        {groups.map((group) => (
          <Fragment key={group.id}>
            {group.label ? (
              <div className={styles.groupHeading}>
                <span>{group.label}</span><small>{group.projects.length}</small>
              </div>
            ) : null}
            {group.projects.map((project) => {
              const Icon = projectIcons[project.icon_name] || Folder;
              return (
                <button
                  key={project.project_id}
                  type="button"
                  className={styles.projectRow}
                  onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}
                  aria-label={`Abrir proyecto ${project.project_name}`}
                >
                  <span className={styles.projectIdentity}>
                    <span className={styles.projectIcon} style={{ '--project-color': project.icon_color } as React.CSSProperties}>
                      <Icon size={16} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className={styles.projectCopy}>
                      <strong>{project.project_name}</strong>
                      <small>{project.project_description || `${project.project_key}${project.team_name ? ` · ${project.team_name}` : ''}`}</small>
                    </span>
                  </span>

                  <span className={styles.status} data-tone={project.health_status}>
                    <i aria-hidden="true" /> {healthLabels[project.health_status]}
                  </span>
                  <span className={styles.priority} data-tone={project.priority_level}>
                    <Flag size={14} strokeWidth={1.8} aria-hidden="true" /> {priorityLabels[project.priority_level]}
                  </span>
                  <span className={styles.lead}><ProjectAvatar project={project} /><span>{project.lead?.name || 'Sin asignar'}</span></span>
                  {showCycles ? <span className={styles.cycle}>Ciclo activo</span> : null}
                  <span className={styles.targetDate}>{formatDate(project.target_date)}</span>
                  <ProgressCell project={project} />
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
