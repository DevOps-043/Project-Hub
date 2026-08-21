'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useGoogleConnection } from '@/shared/hooks/useGoogleConnection';
import { GoogleDrivePicker } from '@/components/google/GoogleDrivePicker';
import type { PickedFile } from '@/components/google/GoogleDrivePicker';
import { CollapsibleDocumentEmbed } from '@/components/google/CollapsibleDocumentEmbed';
import {
  type LinkedDocument,
  classifyGoogleFile,
  parseGoogleUrl,
  uploadFileToDrive,
} from '@/lib/google/document-utils';
import { ATTACHMENT_ACCEPT, collectAttachmentFiles } from '@/lib/uploads/attachment-policy';
import { api } from '@/lib/api/client';
import { useTeamPanel } from './TeamPanelContext';
import { Link2, Plus, Loader2, X, CloudOff, Upload, LinkIcon } from 'lucide-react';

/**
 * Documentos vinculados a un equipo (Google Drive/Sheets/Docs), mismo patrón
 * que ProjectDocumentsView pero sin el escaneo con IA (esa función crea
 * issues dentro de un proyecto específico, no aplica a nivel equipo).
 */
export function TeamDocumentsView() {
  const { teamId, workspaceSlug } = useTeamPanel();
  const { isDark } = useTheme();
  const google = useGoogleConnection();
  const colors = isDark ? {
    bg: '#1E2329',
    border: 'rgba(255,255,255,0.08)',
    text: '#FFF',
    textSec: '#9CA3AF',
    inputBg: '#161B22',
  } : {
    bg: '#FFF',
    border: '#E5E7EB',
    text: '#111827',
    textSec: '#6B7280',
    inputBg: '#F9FAFB',
  };

  const [documents, setDocuments] = useState<LinkedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState('');
  const [linkingUrl, setLinkingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBase = `/api/workspaces/${workspaceSlug}/teams/${teamId}/documents`;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await api.get<{ documents: LinkedDocument[] }>(apiBase);
      if (!error && data) setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching team documents:', error);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const linkDocument = async (doc: {
    name: string;
    provider: string;
    external_id: string;
    external_url: string;
    doc_type: string;
    mime_type: string;
    thumbnail_url?: string | null;
  }) => {
    try {
      const { data, error, status } = await api.post<{ document: LinkedDocument }>(apiBase, doc);
      if (!error && data) {
        setDocuments(prev => [data.document, ...prev]);
        return true;
      } else if (status === 409) {
        alert('Este documento ya está vinculado al equipo.');
      } else if (error) {
        alert(error || 'No se pudo vincular el documento al equipo.');
      }
      return false;
    } catch (error) {
      console.error('Error vinculando documento:', error);
      return false;
    }
  };

  const handlePickerSelect = async (file: PickedFile) => {
    setPickerOpen(false);
    const { provider, docType } = classifyGoogleFile(file.mimeType);
    await linkDocument({
      name: file.name,
      provider,
      external_id: file.id,
      external_url: file.url,
      doc_type: docType,
      mime_type: file.mimeType,
      thumbnail_url: file.iconUrl || null,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files, error } = collectAttachmentFiles(e.target.files);
    if (error) { alert(error); return; }
    if (!files.length) return;

    setUploading(true);
    try {
      const { data: tokenData, error: tokenError } = await api.get<{ accessToken?: string }>('/api/auth/google/token');
      if (tokenError || !tokenData?.accessToken) {
        alert('No se pudo obtener acceso a Google. Reconecta tu cuenta.');
        return;
      }

      for (const file of files) {
        const uploaded = await uploadFileToDrive(file, tokenData.accessToken);
        if (!uploaded) throw new Error(`No se pudo subir ${file.name}`);
        const { provider, docType } = classifyGoogleFile(uploaded.mimeType);
        await linkDocument({
          name: uploaded.name,
          provider,
          external_id: uploaded.id,
          external_url: uploaded.webViewLink,
          doc_type: docType,
          mime_type: uploaded.mimeType,
        });
      }
    } catch (uploadError) {
      alert(uploadError instanceof Error ? uploadError.message : 'No se pudieron subir los archivos.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteUrl = async () => {
    setUrlError('');
    const parsed = parseGoogleUrl(urlValue.trim());
    if (!parsed) {
      setUrlError('URL no válida. Usa un enlace de Google Docs, Sheets, Slides o Drive.');
      return;
    }

    setLinkingUrl(true);
    try {
      let fileName = 'Documento de Google';
      try {
        const { data: tokenData, error: tokenError } = await api.get<{ accessToken?: string }>('/api/auth/google/token');
        if (!tokenError && tokenData?.accessToken) {
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${parsed.fileId}?fields=name,mimeType`,
            { headers: { Authorization: `Bearer ${tokenData.accessToken}` } }
          );
          if (metaRes.ok) {
            const meta = await metaRes.json();
            fileName = meta.name || fileName;
            if (!parsed.mimeType && meta.mimeType) {
              parsed.mimeType = meta.mimeType;
              const classified = classifyGoogleFile(meta.mimeType);
              parsed.provider = classified.provider;
              parsed.docType = classified.docType;
            }
          }
        }
      } catch {
        // usa defaults del parse
      }

      await linkDocument({
        name: fileName,
        provider: parsed.provider,
        external_id: parsed.fileId,
        external_url: urlValue.trim(),
        doc_type: parsed.docType,
        mime_type: parsed.mimeType,
      });

      setUrlValue('');
      setShowUrlInput(false);
    } catch (error) {
      console.error('Error vinculando URL:', error);
      setUrlError('Error al vincular el documento.');
    } finally {
      setLinkingUrl(false);
    }
  };

  const handleUnlink = async (docId: string) => {
    setUnlinkingId(docId);
    try {
      const { error } = await api.delete(`${apiBase}/${docId}`);
      if (!error) setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Error desvinculando documento:', error);
    } finally {
      setUnlinkingId(null);
    }
  };

  if (!google.isLoading && !google.isConnected) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
          <CloudOff className="mx-auto mb-4 opacity-40" size={48} style={{ color: colors.textSec }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>Conecta Google Drive</h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: colors.textSec }}>
            Para vincular documentos, hojas de cálculo y presentaciones a este equipo, primero conecta tu cuenta de Google.
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
              <Link2 size={16} style={{ color: colors.textSec }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: colors.text }}>
              {documents.length} documento{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          {google.isConnected && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {google.googleEmail}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleFileUpload} />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!google.isConnected || uploading}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all border disabled:opacity-40 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
            style={{ borderColor: colors.border, color: colors.textSec }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Subir archivo
          </button>

          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all border ${showUrlInput ? 'border-blue-500/50 text-blue-500' : ''} ${!showUrlInput && isDark ? 'hover:bg-white/5' : ''} ${!showUrlInput && !isDark ? 'hover:bg-gray-50' : ''}`}
            style={!showUrlInput ? { borderColor: colors.border, color: colors.textSec } : {}}
          >
            <LinkIcon size={14} />
            Pegar URL
          </button>

          <button
            onClick={() => setPickerOpen(true)}
            disabled={!google.isConnected}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-40"
          >
            <Plus size={14} />
            Google Drive
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ backgroundColor: colors.inputBg, borderColor: colors.border }}>
              <LinkIcon size={14} style={{ color: colors.textSec }} className="shrink-0" />
              <input
                type="url"
                value={urlValue}
                onChange={(e) => { setUrlValue(e.target.value); setUrlError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasteUrl(); }}
                placeholder="Pega la URL de Google Docs, Sheets o Slides..."
                className="flex-1 text-xs bg-transparent outline-none"
                style={{ color: colors.text }}
                autoFocus
              />
              <button
                onClick={handlePasteUrl}
                disabled={!urlValue.trim() || linkingUrl}
                className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {linkingUrl ? <Loader2 size={12} className="animate-spin" /> : 'Vincular'}
              </button>
              <button
                onClick={() => { setShowUrlInput(false); setUrlValue(''); setUrlError(''); }}
                className="p-1 rounded-md transition-colors"
                style={{ color: colors.textSec }}
              >
                <X size={14} />
              </button>
            </div>
            {urlError && <p className="text-xs text-red-500 mt-1 pl-1">{urlError}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin" size={24} style={{ color: colors.textSec }} />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
          <Link2 className="mx-auto mb-3 opacity-30" size={40} style={{ color: colors.textSec }} />
          <p className="text-sm font-medium mb-1" style={{ color: colors.text }}>Sin documentos vinculados</p>
          <p className="text-xs" style={{ color: colors.textSec }}>Adjunta archivos de Google Drive, sube un archivo o pega una URL.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <CollapsibleDocumentEmbed key={doc.id} document={doc} onUnlink={handleUnlink} isUnlinking={unlinkingId === doc.id} />
          ))}
        </div>
      )}

      <GoogleDrivePicker isOpen={pickerOpen} onSelect={handlePickerSelect} onCancel={() => setPickerOpen(false)} />
    </div>
  );
}
