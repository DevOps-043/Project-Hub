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
import { api } from '@/lib/api/client';
import {
  FileSpreadsheet, Link2, Plus, Loader2, X,
  CloudOff, Upload, LinkIcon, Sparkles, CheckCircle,
  Brain, AlertCircle, ChevronRight, Check
} from 'lucide-react';

interface ProjectDocumentsViewProps {
  projectId: string;
  workspaceSlug?: string;
  projectKey?: string;
  /** Template ID de Google Sheets del workspace */
  sheetsTemplateId?: string;
  /** ID del equipo para crear issues con la IA */
  teamId?: string;
  /** Callback para navegar al tab de Issues tras generar plan */
  onNavigateToIssues?: () => void;
}

export function ProjectDocumentsView({ projectId, workspaceSlug, projectKey, sheetsTemplateId, teamId, onNavigateToIssues }: ProjectDocumentsViewProps) {
  const { isDark } = useTheme();
  const google = useGoogleConnection();
  const colors = isDark ? {
    bg: '#1E2329',
    bgHover: '#272D35',
    border: 'rgba(255,255,255,0.08)',
    text: '#FFF',
    textSec: '#9CA3AF',
    inputBg: '#161B22',
  } : {
    bg: '#FFF',
    bgHover: '#F9FAFB',
    border: '#E5E7EB',
    text: '#111827',
    textSec: '#6B7280',
    inputBg: '#F9FAFB',
  };

  const [documents, setDocuments] = useState<LinkedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState('');
  const [linkingUrl, setLinkingUrl] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isSofLIAModalOpen, setIsSofLIAModalOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ count: number; message: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Usa ruta workspace si hay slug, sino ruta admin
  const apiBase = workspaceSlug
    ? `/api/workspaces/${workspaceSlug}/projects/${projectId}/documents`
    : `/api/admin/projects/${projectId}/documents`;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await api.get<{ documents: LinkedDocument[] }>(apiBase);
      if (!error && data) {
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

  // ─── Vincular documento ────────────────────────────────────

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
        alert('Este documento ya está vinculado al proyecto.');
      }
      if (error && status !== 409) {
        alert(error || 'No se pudo vincular el documento al proyecto.');
      }
      return false;
    } catch (error) {
      console.error('Error vinculando documento:', error);
      return false;
    }
  };

  // ─── 1. Desde Drive Picker ─────────────────────────────────

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

  // ─── 2. Subir archivo local a Drive ────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: tokenData, error: tokenError } = await api.get<{ accessToken?: string }>('/api/auth/google/token');

      if (tokenError || !tokenData?.accessToken) {
        alert('No se pudo obtener acceso a Google. Reconecta tu cuenta.');
        return;
      }

      const { accessToken } = tokenData;
      const uploaded = await uploadFileToDrive(file, accessToken);

      if (!uploaded) {
        alert('Error al subir el archivo a Google Drive.');
        return;
      }

      const { provider, docType } = classifyGoogleFile(uploaded.mimeType);

      await linkDocument({
        name: uploaded.name,
        provider,
        external_id: uploaded.id,
        external_url: uploaded.webViewLink,
        doc_type: docType,
        mime_type: uploaded.mimeType,
      });
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      alert('Error al subir el archivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── 3. Pegar URL de Google ────────────────────────────────

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
          const { accessToken } = tokenData;
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${parsed.fileId}?fields=name,mimeType`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
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

  // ─── Crear Hoja de Cálculo ─────────────────────────────────

  const handleCreateSheet = async () => {
    if (creatingSheet) return;
    setCreatingSheet(true);

    try {
      const { data: tokenData, error: tokenError } = await api.get<{ accessToken?: string }>('/api/auth/google/token');

      if (tokenError || !tokenData?.accessToken) {
        alert('No se pudo obtener acceso a Google. Reconecta tu cuenta.');
        return;
      }

      const { accessToken } = tokenData;
      const sheetTitle = projectKey ? `[${projectKey}] Master Sheet` : `Proyecto - Master Sheet`;

      let spreadsheetId: string;
      let spreadsheetUrl: string;

      if (sheetsTemplateId) {
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

      await linkDocument({
        name: sheetTitle,
        provider: 'google_sheets',
        external_id: spreadsheetId,
        external_url: spreadsheetUrl,
        doc_type: 'spreadsheet',
        mime_type: 'application/vnd.google-apps.spreadsheet',
      });
    } catch (error) {
      console.error('Error creando sheet:', error);
      alert('Error al crear la hoja de cálculo.');
    } finally {
      setCreatingSheet(false);
    }
  };

  // ─── Desvincular ───────────────────────────────────────────

  const handleUnlink = async (docId: string) => {
    setUnlinkingId(docId);
    try {
      const { error } = await api.delete(`${apiBase}/${docId}`);

      if (!error) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      }
    } catch (error) {
      console.error('Error desvinculando documento:', error);
    } finally {
      setUnlinkingId(null);
    }
  };

  // ─── SofLIA AI Scan ────────────────────────────────────────
  
  const handleSofLIAScan = () => {
    if (scanning || documents.length === 0) return;
    setIsSofLIAModalOpen(true);
  };

  const executeSofLIAScan = async () => {
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    setScanPhase(1);

    // Timers para avanzar fases visualmente mientras la API procesa
    const phaseTimer2 = setTimeout(() => setScanPhase(2), 3000);
    const phaseTimer3 = setTimeout(() => setScanPhase(3), 8000);

    try {
      const { data, error: apiError } = await api.post<{ issues_count?: number; message?: string }>('/api/ai/analyze-documents', {
        projectId,
        teamId,
        documents: documents.map(d => ({
          external_id: d.external_id,
          mime_type: d.mime_type,
          name: d.name
        }))
      });

      clearTimeout(phaseTimer2);
      clearTimeout(phaseTimer3);
      setScanPhase(3);

      if (!apiError && data) {
        setScanResult({
          count: data.issues_count || 0,
          message: data.message || 'Proceso completado con éxito.'
        });
        setIsSofLIAModalOpen(false);
      } else {
        setScanError(apiError || 'Error al procesar con SofLIA');
      }
    } catch (error) {
      console.error('Error in SofLIA scan:', error);
      clearTimeout(phaseTimer2);
      clearTimeout(phaseTimer3);
      setScanError('Ocurrió un error inesperado al conectar con SofLIA');
    } finally {
      setScanning(false);
    }
  };

  // ─── Banner: Google no conectado ───────────────────────────

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
      {/* Mensaje de éxito de Scan */}
      <AnimatePresence>
        {scanResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-green-500">¡Plan Generado!</p>
                <p className="text-xs text-green-500/80">{scanResult.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scanResult.count > 0 && onNavigateToIssues && (
                <button
                  onClick={() => { setScanResult(null); onNavigateToIssues(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-500 text-xs font-medium hover:bg-green-500/30 transition-colors"
                >
                  Ver tareas <ChevronRight size={14} />
                </button>
              )}
              <button
                onClick={() => setScanResult(null)}
                className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-green-500"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="space-y-4">
        {/* Top row: Info + SofLIA */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <Link2 size={16} style={{ color: colors.textSec }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: colors.text }}>
                  {documents.length} documento{documents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {google.isConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {google.googleEmail}
              </span>
            )}
          </div>

          {/* SofLIA Button - Premium diseño */}
          <button
            onClick={handleSofLIAScan}
            disabled={scanning || documents.length === 0 || !google.isConnected}
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            style={{
              background: scanning ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              color: scanning ? colors.textSec : '#FFFFFF',
              boxShadow: documents.length > 0 && !scanning ? '0 4px 14px rgba(99,102,241,0.25)' : 'none',
            }}
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>SofLIA: Generar Plan</span>
            {documents.length > 0 && !scanning && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Actions toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

          {/* Botón: Subir */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!google.isConnected || uploading}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all border disabled:opacity-40 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
            style={{ borderColor: colors.border, color: colors.textSec }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Subir archivo
          </button>

          {/* Botón: URL */}
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all border ${showUrlInput ? 'border-blue-500/50 text-blue-500' : ''} ${!showUrlInput && isDark ? 'hover:bg-white/5' : ''} ${!showUrlInput && !isDark ? 'hover:bg-gray-50' : ''}`}
            style={!showUrlInput ? { borderColor: colors.border, color: colors.textSec } : {}}
          >
            <LinkIcon size={14} />
            Pegar URL
          </button>

          {/* Botón: Crear Hoja */}
          <button
            onClick={handleCreateSheet}
            disabled={creatingSheet || !google.isConnected}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all border disabled:opacity-40 hover:bg-emerald-500/5"
            style={{
              borderColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.3)',
              color: '#10B981',
            }}
          >
            {creatingSheet ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            Crear Hoja
          </button>

          {/* Botón: Drive */}
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

      {/* URL input */}
      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-2 p-2 rounded-lg border"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.border }}
            >
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
            {urlError && (
              <p className="text-xs text-red-500 mt-1 pl-1">{urlError}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
            Adjunta archivos de Google Drive, sube un archivo o pega una URL.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <CollapsibleDocumentEmbed
              key={doc.id}
              document={doc}
              onUnlink={handleUnlink}
              isUnlinking={unlinkingId === doc.id}
            />
          ))}
        </div>
      )}

      {/* Google Picker */}
      <GoogleDrivePicker
        isOpen={pickerOpen}
        onSelect={handlePickerSelect}
        onCancel={() => setPickerOpen(false)}
      />

      {/* MODAL MÁGICO DE SOFLIA */}
      <AnimatePresence>
        {isSofLIAModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md my-auto overflow-hidden rounded-3xl shadow-2xl border relative"
              style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border }}
            >
              {/* Fondo Animado sutil */}
              <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-[100px] animate-pulse" />
              </div>

              <div className="relative p-5 sm:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                      <Brain size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold" style={{ color: colors.text }}>Planificación SofLIA</h2>
                      <p className="text-[10px] sm:text-xs" style={{ color: colors.textSec }}>Inteligencia Artificial Generativa</p>
                    </div>
                  </div>
                  {!scanning && (
                    <button 
                      onClick={() => setIsSofLIAModalOpen(false)}
                      className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors"
                      style={{ color: colors.textSec }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                {/* Contenido principal */}
                {!scanning ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="p-4 rounded-2xl border" style={{ borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                      <p className="text-sm mb-4" style={{ color: colors.text }}>
                        SofLIA analizará <span className="font-bold text-indigo-500">{documents.length} documento(s)</span> para estructurar tu proyecto automáticamente.
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: colors.textSec }}>Equipo Asignado:</span>
                          {teamId ? (
                            <span className="flex items-center gap-1.5 font-medium px-2 py-1 rounded-lg bg-green-500/10 text-green-500">
                              <Check size={12} /> Detectado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 font-medium px-2 py-1 rounded-lg bg-red-500/10 text-red-500">
                              <AlertCircle size={12} /> No asignado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: colors.textSec }}>Acción:</span>
                          <span style={{ color: colors.text }}>Crear Tareas, Ciclos y Etiquetas</span>
                        </div>
                      </div>
                    </div>

                    {!teamId && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-2">
                        <AlertCircle className="text-amber-500 shrink-0" size={16} />
                        <p className="text-[11px] leading-relaxed text-amber-500 font-medium">
                          El proyecto no tiene un equipo asignado. Asígnalo en Configuración antes de continuar.
                        </p>
                      </div>
                    )}

                    {scanError && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex gap-2">
                        <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="text-[11px] leading-relaxed text-red-500 font-medium">
                            {scanError}
                          </p>
                          <button
                            onClick={() => setScanError(null)}
                            className="text-[10px] text-red-400 underline mt-1"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setIsSofLIAModalOpen(false)}
                        className="px-4 py-2.5 sm:py-3 rounded-2xl text-sm font-bold transition-all border hover:bg-white/5 active:scale-95"
                        style={{ color: colors.text, borderColor: colors.border }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={executeSofLIAScan}
                        disabled={!teamId}
                        className="px-4 py-2.5 sm:py-3 rounded-2xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Empezar Escaneo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 sm:py-8 space-y-6 sm:space-y-8">
                    {/* Animación de escaneo */}
                    <div className="relative flex justify-center">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-indigo-500"
                        />
                      </div>
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-2xl">
                        <Sparkles size={32} className="sm:w-10 sm:h-10 animate-pulse" />
                      </div>
                    </div>

                    <div className="text-center space-y-1 sm:space-y-2">
                       <h3 className="text-base sm:text-lg font-bold animate-pulse" style={{ color: colors.text }}>SofLIA está pensando...</h3>
                       <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] sm:text-xs" style={{ color: colors.textSec }}>Analizando contenido de los documentos</span>
                          <div className="flex gap-1 mt-1 sm:mt-2">
                             <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                             <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                             <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 1 }} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-2.5 sm:space-y-3 px-2 sm:px-4">
                       {[
                         { id: 1, label: 'Leyendo documentos vinculados' },
                         { id: 2, label: 'Identificando tareas y estructura del proyecto' },
                         { id: 3, label: 'Creando plan de trabajo y ciclos' },
                       ].map((step) => (
                         <div key={step.id} className="flex items-center gap-3">
                           <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border ${scanPhase >= step.id ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-500/30'}`}>
                             {scanPhase >= step.id ? <Check size={8} className="sm:w-3 sm:h-3" /> : <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-500" />}
                           </div>
                           <span className={`text-[11px] sm:text-xs ${scanPhase >= step.id ? 'font-medium' : 'opacity-40'}`} style={{ color: colors.text }}>
                             {step.label}
                           </span>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
