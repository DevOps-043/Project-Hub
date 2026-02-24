'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { useGoogleConnection } from '@/shared/hooks/useGoogleConnection';
import { GoogleDrivePicker, GOOGLE_MIME_TYPES } from '@/components/google/GoogleDrivePicker';
import type { PickedFile } from '@/components/google/GoogleDrivePicker';
import {
  FileSpreadsheet, FileText, Presentation, FolderOpen, File,
  Link2, Unlink, ExternalLink, Plus, Loader2, X, Eye, EyeOff,
  CloudOff, RefreshCw, Trash2
} from 'lucide-react';

interface ProjectDocument {
  id: string;
  project_id: string;
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

interface ProjectDocumentsViewProps {
  projectId: string;
  workspaceSlug?: string;
  projectKey?: string;
  /** Template ID de Google Sheets del workspace */
  sheetsTemplateId?: string;
}

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  spreadsheet: FileSpreadsheet,
  document: FileText,
  presentation: Presentation,
  folder: FolderOpen,
  other: File,
};

const DOC_TYPE_COLORS: Record<string, string> = {
  spreadsheet: '#0F9D58',
  document: '#4285F4',
  presentation: '#F4B400',
  folder: '#9E9E9E',
  other: '#6B7280',
};

const PROVIDER_LABELS: Record<string, string> = {
  google_drive: 'Google Drive',
  google_sheets: 'Google Sheets',
  google_docs: 'Google Docs',
  internal: 'Interno',
};

/**
 * Detecta el doc_type y provider basado en el mimeType de Google
 */
function classifyGoogleFile(mimeType: string): { provider: string; docType: string } {
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

export function ProjectDocumentsView({ projectId, workspaceSlug, projectKey, sheetsTemplateId }: ProjectDocumentsViewProps) {
  const { isDark } = useTheme();
  const google = useGoogleConnection();
  const colors = isDark ? {
    bg: '#1E2329',
    bgHover: '#272D35',
    border: 'rgba(255,255,255,0.08)',
    text: '#FFF',
    textSec: '#9CA3AF',
  } : {
    bg: '#FFF',
    bgHover: '#F9FAFB',
    border: '#E5E7EB',
    text: '#111827',
    textSec: '#6B7280',
  };

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

  // Usa ruta workspace si hay slug, sino ruta admin
  const apiBase = workspaceSlug
    ? `/api/workspaces/${workspaceSlug}/projects/${projectId}/documents`
    : `/api/admin/projects/${projectId}/documents`;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiBase, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handlePickerSelect = async (file: PickedFile) => {
    setPickerOpen(false);
    const { provider, docType } = classifyGoogleFile(file.mimeType);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: file.name,
          provider,
          external_id: file.id,
          external_url: file.url,
          doc_type: docType,
          mime_type: file.mimeType,
          thumbnail_url: file.iconUrl || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDocuments(prev => [data.document, ...prev]);
      } else if (res.status === 409) {
        alert('Este documento ya está vinculado al proyecto.');
      }
    } catch (error) {
      console.error('Error vinculando documento:', error);
    }
  };

  const handleCreateSheet = async () => {
    if (creatingSheet) return;
    setCreatingSheet(true);

    try {
      const token = localStorage.getItem('accessToken');
      // Crear spreadsheet via servidor
      const createRes = await fetch('/api/auth/google/token', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!createRes.ok) {
        alert('No se pudo obtener acceso a Google. Reconecta tu cuenta.');
        return;
      }

      const { accessToken } = await createRes.json();
      const sheetTitle = projectKey ? `[${projectKey}] Master Sheet` : `Proyecto - Master Sheet`;

      // Crear o clonar el spreadsheet
      let spreadsheetId: string;
      let spreadsheetUrl: string;

      if (sheetsTemplateId) {
        // Clonar template
        const copyRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${sheetsTemplateId}/copy`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: sheetTitle }),
          }
        );
        if (!copyRes.ok) throw new Error('Error clonando template');
        const copied = await copyRes.json();
        spreadsheetId = copied.id;
        spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${copied.id}/edit`;
      } else {
        // Crear vacío
        const sheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties: { title: sheetTitle } }),
        });
        if (!sheetRes.ok) throw new Error('Error creando spreadsheet');
        const sheet = await sheetRes.json();
        spreadsheetId = sheet.spreadsheetId;
        spreadsheetUrl = sheet.spreadsheetUrl;
      }

      // Vincular al proyecto
      const linkRes = await fetch(apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: sheetTitle,
          provider: 'google_sheets',
          external_id: spreadsheetId,
          external_url: spreadsheetUrl,
          doc_type: 'spreadsheet',
          mime_type: 'application/vnd.google-apps.spreadsheet',
        }),
      });

      if (linkRes.ok) {
        const data = await linkRes.json();
        setDocuments(prev => [data.document, ...prev]);
      }
    } catch (error) {
      console.error('Error creando sheet:', error);
      alert('Error al crear la hoja de cálculo.');
    } finally {
      setCreatingSheet(false);
    }
  };

  const handleUnlink = async (docId: string) => {
    setUnlinkingId(docId);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${apiBase}/${docId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      }
    } catch (error) {
      console.error('Error desvinculando documento:', error);
    } finally {
      setUnlinkingId(null);
      setConfirmUnlink(null);
    }
  };

  const getEmbedUrl = (doc: ProjectDocument) => {
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
  };

  // Banner: Google no conectado
  if (!google.isLoading && !google.isConnected) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
          <CloudOff className="mx-auto mb-4 opacity-40" size={48} style={{ color: colors.textSec }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
            Conecta Google Drive
          </h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: colors.textSec }}>
            Para vincular documentos, hojas de cálculo y presentaciones a este proyecto, primero conecta tu cuenta de Google.
          </p>
          <button
            onClick={() => google.connect()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Conectar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium" style={{ color: colors.textSec }}>
            {documents.length} documento{documents.length !== 1 ? 's' : ''} vinculado{documents.length !== 1 ? 's' : ''}
          </h3>
          {google.isConnected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {google.googleEmail}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateSheet}
            disabled={creatingSheet || !google.isConnected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
            style={{
              borderColor: '#0F9D5830',
              color: '#0F9D58',
              backgroundColor: '#0F9D5808',
            }}
          >
            {creatingSheet ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            Crear Hoja de Cálculo
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            disabled={!google.isConnected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            Adjuntar desde Drive
          </button>
        </div>
      </div>

      {/* Lista de documentos */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin" size={24} style={{ color: colors.textSec }} />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
          <Link2 className="mx-auto mb-3 opacity-30" size={40} style={{ color: colors.textSec }} />
          <p className="text-sm font-medium mb-1" style={{ color: colors.text }}>Sin documentos vinculados</p>
          <p className="text-xs" style={{ color: colors.textSec }}>
            Adjunta archivos de Google Drive o crea una nueva hoja de cálculo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc, idx) => {
            const Icon = DOC_TYPE_ICONS[doc.doc_type] || File;
            const color = DOC_TYPE_COLORS[doc.doc_type] || '#6B7280';

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.bgHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.bg)}
              >
                {/* Icono */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: colors.text }}>
                      {doc.name}
                    </span>
                    <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border" style={{ color: colors.textSec, borderColor: colors.border }}>
                      {PROVIDER_LABELS[doc.provider] || doc.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.creator && (
                      <span className="text-xs" style={{ color: colors.textSec }}>
                        {doc.creator.display_name || doc.creator.first_name}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: colors.textSec }}>
                      • {format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewDoc(previewDoc?.id === doc.id ? null : doc); }}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: colors.textSec }}
                    title="Preview"
                  >
                    {previewDoc?.id === doc.id ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <a
                    href={doc.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: colors.textSec }}
                    title="Abrir en Google Drive"
                  >
                    <ExternalLink size={16} />
                  </a>
                  {confirmUnlink === doc.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleUnlink(doc.id)}
                        disabled={unlinkingId === doc.id}
                        className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Confirmar desvincular"
                      >
                        {unlinkingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                      <button
                        onClick={() => setConfirmUnlink(null)}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: colors.textSec }}
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmUnlink(doc.id); }}
                      className="p-1.5 rounded-md transition-colors hover:text-red-500"
                      style={{ color: colors.textSec }}
                      title="Desvincular"
                    >
                      <Unlink size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Preview iframe */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 500 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
              <span className="text-xs font-medium truncate" style={{ color: colors.text }}>
                {previewDoc.name}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  Abrir en Google
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: colors.textSec }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <iframe
              src={getEmbedUrl(previewDoc)}
              className="w-full border-0"
              style={{ height: 460 }}
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Picker */}
      <GoogleDrivePicker
        isOpen={pickerOpen}
        onSelect={handlePickerSelect}
        onCancel={() => setPickerOpen(false)}
      />
    </div>
  );
}
