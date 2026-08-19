import type { Priority, Status } from './create-issue-types';

// Estimación (0-10 puntos)
export const ESTIMATE_OPTIONS = [
  { value: '', label: 'Sin estimación', icon: '–' },
  { value: '0', label: '0 puntos', icon: '0' },
  { value: '1', label: '1 punto', icon: '1' },
  { value: '2', label: '2 puntos', icon: '2' },
  { value: '3', label: '3 puntos', icon: '3' },
  { value: '4', label: '4 puntos', icon: '4' },
  { value: '5', label: '5 puntos', icon: '5' },
  { value: '6', label: '6 puntos', icon: '6' },
  { value: '7', label: '7 puntos', icon: '7' },
  { value: '8', label: '8 puntos', icon: '8' },
  { value: '9', label: '9 puntos', icon: '9' },
  { value: '10', label: '10 puntos', icon: '10' },
];

// Fallback si falla el fetch de prioridades del equipo
export const DEFAULT_PRIORITIES: Priority[] = [
  { priority_id: 'none', name: 'Sin prioridad', color: '#94a3b8', level: 0 },
  { priority_id: 'urgent', name: 'Urgente', color: '#ef4444', level: 1 },
  { priority_id: 'high', name: 'Alta', color: '#f97316', level: 2 },
  { priority_id: 'medium', name: 'Media', color: '#3b82f6', level: 3 },
  { priority_id: 'low', name: 'Baja', color: '#22c55e', level: 4 }
];

// Fallback si falla el fetch de estados del equipo, o el equipo no tiene ninguno configurado
export const DEFAULT_STATUSES: Status[] = [
  { status_id: 'backlog', name: 'Backlog', status_type: 'backlog', color: '#64748b', icon: '' },
  { status_id: 'todo', name: 'Por hacer', status_type: 'todo', color: '#3b82f6', icon: '' },
  { status_id: 'in_progress', name: 'En progreso', status_type: 'in_progress', color: '#f59e0b', icon: '' },
  { status_id: 'done', name: 'Hecho', status_type: 'done', color: '#10b981', icon: '' }
];
