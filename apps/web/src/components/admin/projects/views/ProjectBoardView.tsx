import { useRouter } from 'next/navigation';
import { CalendarDays, Flag, Plus } from 'lucide-react';
import styles from './ProjectBoardView.module.css';

interface Project {
  project_id: string;
  project_name: string;
  project_key: string;
  project_status: string;
  priority_level: string;
  target_date: string | null;
  lead?: { name: string; avatar?: string; color: string; initials: string };
  icon_color: string;
}

interface ProjectBoardViewProps {
  projects: Project[];
  basePath?: string;
  onAddProject?: (status: string) => void;
}

const columns = [
  { id: 'planning', label: 'Planificados', tone: 'neutral' },
  { id: 'active', label: 'En progreso', tone: 'warning' },
  { id: 'completed', label: 'Completados', tone: 'success' },
  { id: 'cancelled', label: 'Cerrados', tone: 'error' },
];

function matchesColumn(project: Project, columnId: string) {
  if (columnId === 'planning') return ['planning', 'on_hold'].includes(project.project_status);
  if (columnId === 'cancelled') return ['cancelled', 'archived'].includes(project.project_status);
  return project.project_status === columnId;
}

export function ProjectBoardView({ projects, basePath = '/admin', onAddProject }: ProjectBoardViewProps) {
  const router = useRouter();

  return (
    <div className={styles.board} aria-label="Tablero de proyectos">
      {columns.map((column) => {
        const items = projects.filter((project) => matchesColumn(project, column.id));
        return (
          <section key={column.id} className={styles.column} data-tone={column.tone} aria-labelledby={`column-${column.id}`}>
            <header className={styles.columnHeader}>
              <div className={styles.columnTitle}>
                <span className={styles.columnDot} aria-hidden="true" />
                <h3 id={`column-${column.id}`}>{column.label}</h3>
                <span className={styles.columnCount}>{items.length}</span>
              </div>
              <button type="button" className={styles.addButton} onClick={() => onAddProject?.(column.id)} aria-label={`Crear proyecto en ${column.label}`}>
                <Plus size={15} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.cardList}>
              {items.map((project) => (
                <button key={project.project_id} type="button" className={styles.card} onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}>
                  <span className={styles.cardTopline}>
                    <span className={styles.projectKey}>{project.project_key}</span>
                    <span className={styles.priority} data-priority={project.priority_level}>
                      <Flag size={12} aria-hidden="true" /> {project.priority_level === 'none' ? 'Sin prioridad' : project.priority_level}
                    </span>
                  </span>
                  <strong>{project.project_name}</strong>
                  <span className={styles.cardFooter}>
                    <span className={styles.date}><CalendarDays size={13} aria-hidden="true" />{project.target_date ? new Date(project.target_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha'}</span>
                    {project.lead ? (
                      <span className={styles.avatar} style={{ backgroundColor: project.lead.color }} title={project.lead.name}>
                        {project.lead.avatar ? (
                          <img src={project.lead.avatar} alt="" />
                        ) : project.lead.initials}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
              {!items.length ? <p className={styles.columnEmpty}>No hay proyectos en esta etapa.</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
