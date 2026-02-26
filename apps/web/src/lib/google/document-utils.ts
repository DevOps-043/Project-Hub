/**
 * Utilidades compartidas para documentos de Google Drive.
 * Usadas por ProjectDocumentsView, IssueDocumentsView, CollapsibleDocumentEmbed, etc.
 */

import {
  FileSpreadsheet, FileText, Presentation, FolderOpen, File,
} from 'lucide-react';
import { GOOGLE_MIME_TYPES } from '@/components/google/GoogleDrivePicker';

// ─── Tipos ───────────────────────────────────────────────────

export interface LinkedDocument {
  id: string;
  name: string;
  provider: string;
  external_id: string;
  external_url: string;
  doc_type: string;
  mime_type: string | null;
  thumbnail_url: string | null;
  created_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  creator?: {
    user_id: string;
    first_name: string;
    last_name_paternal: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// ─── Constantes ──────────────────────────────────────────────

export const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  spreadsheet: FileSpreadsheet,
  document: FileText,
  presentation: Presentation,
  folder: FolderOpen,
  other: File,
};

export const DOC_TYPE_COLORS: Record<string, string> = {
  spreadsheet: '#0F9D58',
  document: '#4285F4',
  presentation: '#F4B400',
  folder: '#9E9E9E',
  other: '#6B7280',
};

export const PROVIDER_LABELS: Record<string, string> = {
  google_drive: 'Google Drive',
  google_sheets: 'Google Sheets',
  google_docs: 'Google Docs',
  internal: 'Interno',
};

// ─── Funciones ───────────────────────────────────────────────

/**
 * Detecta el doc_type y provider basado en el mimeType de Google
 */
export function classifyGoogleFile(mimeType: string): { provider: string; docType: string } {
  if (mimeType === GOOGLE_MIME_TYPES.SPREADSHEET) {
    return { provider: 'google_sheets', docType: 'spreadsheet' };
  }
  if (mimeType === GOOGLE_MIME_TYPES.DOCUMENT) {
    return { provider: 'google_docs', docType: 'document' };
  }
  if (mimeType === GOOGLE_MIME_TYPES.PRESENTATION) {
    return { provider: 'google_drive', docType: 'presentation' };
  }
  if (mimeType === GOOGLE_MIME_TYPES.FOLDER) {
    return { provider: 'google_drive', docType: 'folder' };
  }
  return { provider: 'google_drive', docType: 'other' };
}

/**
 * Genera la URL de embed/preview para un documento de Google
 */
export function getEmbedUrl(doc: { mime_type: string | null; external_id: string }): string {
  if (doc.mime_type === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${doc.external_id}/preview`;
  }
  if (doc.mime_type === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${doc.external_id}/preview`;
  }
  if (doc.mime_type === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${doc.external_id}/preview`;
  }
  return `https://drive.google.com/file/d/${doc.external_id}/preview`;
}

/**
 * Parsea una URL de Google Drive/Docs/Sheets/Slides y extrae el file ID y metadata.
 * Soporta URLs como:
 *   - https://docs.google.com/document/d/{id}/edit
 *   - https://docs.google.com/spreadsheets/d/{id}/edit
 *   - https://docs.google.com/presentation/d/{id}/edit
 *   - https://drive.google.com/file/d/{id}/view
 *   - https://drive.google.com/open?id={id}
 */
export function parseGoogleUrl(url: string): {
  fileId: string;
  provider: string;
  docType: string;
  mimeType: string;
} | null {
  try {
    const u = new URL(url);

    // docs.google.com/document/d/{id}/...
    const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      return {
        fileId: docMatch[1],
        provider: 'google_docs',
        docType: 'document',
        mimeType: 'application/vnd.google-apps.document',
      };
    }

    // docs.google.com/spreadsheets/d/{id}/...
    const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetMatch) {
      return {
        fileId: sheetMatch[1],
        provider: 'google_sheets',
        docType: 'spreadsheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      };
    }

    // docs.google.com/presentation/d/{id}/...
    const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (slidesMatch) {
      return {
        fileId: slidesMatch[1],
        provider: 'google_drive',
        docType: 'presentation',
        mimeType: 'application/vnd.google-apps.presentation',
      };
    }

    // drive.google.com/file/d/{id}/...
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return {
        fileId: driveMatch[1],
        provider: 'google_drive',
        docType: 'other',
        mimeType: '',
      };
    }

    // drive.google.com/open?id={id}
    const openId = u.searchParams.get('id');
    if (u.hostname === 'drive.google.com' && openId) {
      return {
        fileId: openId,
        provider: 'google_drive',
        docType: 'other',
        mimeType: '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Sube un archivo local al Google Drive del usuario.
 * Usa la API REST v3 con multipart upload.
 */
export async function uploadFileToDrive(
  file: globalThis.File,
  accessToken: string
): Promise<{ id: string; name: string; mimeType: string; webViewLink: string } | null> {
  const metadata = {
    name: file.name,
    mimeType: file.type,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res.ok) {
    console.error('Error subiendo archivo a Drive:', await res.text());
    return null;
  }

  return res.json();
}
