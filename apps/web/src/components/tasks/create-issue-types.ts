import type { PickedFile } from '@/components/google/GoogleDrivePicker';

export interface Status {
  status_id: string;
  name: string;
  status_type: string;
  color: string;
  icon: string;
}

export interface Priority {
  priority_id: string;
  name: string;
  level: number;
  color: string;
}

export interface Label {
  label_id: string;
  name: string;
  color: string;
}

export interface Member {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Cycle {
  cycle_id: string;
  name: string;
  status: string;
}

export interface Project {
  project_id: string;
  project_name: string;
}

/** Documento de Google Drive ya vinculado al proyecto, ofrecido como contexto para la tarea. */
export interface ProjectDocument {
  id: string;
  name: string;
  doc_type?: string;
  provider?: string;
  external_id: string;
  external_url: string;
  mime_type?: string;
  thumbnail_url?: string | null;
}

export interface PendingDocument {
  file: PickedFile;
  source: 'picker' | 'upload' | 'url';
}

/** Subconjunto de themeColors.{dark,light} que consumen los portales del modal. */
export interface ModalColors {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
}
