'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange } from 'lucide-react';
import styles from './ProjectTimelineView.module.css';

interface Project {
  project_id: string;
  project_name: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  icon_color: string;
}

interface ProjectTimelineViewProps {
  projects: Project[];
  basePath?: string;
}

const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const cellWidth = 120;
const trackWidth = cellWidth * months.length;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function positionInYear(dateValue: string | null | undefined, fallback: string, year: number) {
  const parsed = new Date(dateValue || fallback);
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const bounded = clamp(parsed.getTime(), start.getTime(), end.getTime());
  return ((bounded - start.getTime()) / (end.getTime() - start.getTime())) * trackWidth;
}

function formatRange(project: Project) {
  const start = new Date(project.start_date || project.created_at);
  const end = project.target_date ? new Date(project.target_date) : null;
  const formatter = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${formatter.format(start)} – ${end ? formatter.format(end) : 'sin fecha objetivo'}`;
}

export function ProjectTimelineView({ projects, basePath = '/admin' }: ProjectTimelineViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const todayX = positionInYear(new Date().toISOString(), new Date().toISOString(), currentYear);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollLeft = Math.max(0, todayX - 420);
  }, [todayX]);

  return (
    <div ref={containerRef} className={styles.scroller} aria-label={`Cronología de proyectos de ${currentYear}`}>
      <div className={styles.timeline} style={{ '--track-width': `${trackWidth}px`, '--today-x': `${todayX}px` } as CSSProperties}>
        <div className={styles.headerRow}>
          <div className={styles.stickyHeading}><CalendarRange size={15} aria-hidden="true" /> Proyectos activos</div>
          <div className={styles.monthTrack}>
            {months.map((month) => <span key={month} style={{ width: cellWidth }}>{month}<small>{currentYear}</small></span>)}
            <i className={styles.todayLine} aria-hidden="true"><b>Hoy</b></i>
          </div>
        </div>

        <div className={styles.rows}>
          {projects.map((project) => {
            const startX = positionInYear(project.start_date, project.created_at, currentYear);
            const fallbackEnd = new Date(project.start_date || project.created_at);
            fallbackEnd.setMonth(fallbackEnd.getMonth() + 1);
            const endX = positionInYear(project.target_date, fallbackEnd.toISOString(), currentYear);
            const width = Math.max(42, endX - startX);
            return (
              <div key={project.project_id} className={styles.row}>
                <button type="button" className={styles.projectName} onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}>
                  <span style={{ backgroundColor: project.icon_color }} aria-hidden="true" />
                  <strong>{project.project_name}</strong>
                </button>
                <div className={styles.track}>
                  <i className={styles.todayLine} aria-hidden="true" />
                  <button
                    type="button"
                    className={styles.bar}
                    style={{ '--bar-left': `${startX}px`, '--bar-width': `${width}px`, '--bar-color': project.icon_color } as CSSProperties}
                    onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}
                    title={formatRange(project)}
                    aria-label={`${project.project_name}: ${formatRange(project)}`}
                  >
                    {width >= 95 ? <span>{project.project_name}</span> : null}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
