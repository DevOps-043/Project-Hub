'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { Loader2, Plus, X } from 'lucide-react';
import { useGoogleConnection } from '@/shared/hooks/useGoogleConnection';
import { api } from '@/lib/api/client';
import { GoogleDrivePicker } from '@/components/google/GoogleDrivePicker';
import type { PickedFile } from '@/components/google/GoogleDrivePicker';
import { classifyGoogleFile, parseGoogleUrl, uploadFileToDrive } from '@/lib/google/document-utils';
import { ATTACHMENT_ACCEPT, collectAttachmentFiles } from '@/lib/uploads/attachment-policy';
import type { Status, Priority, Label, Member, Cycle, Project, ProjectDocument, PendingDocument } from './create-issue-types';
import { StatusIcon, PriorityIcon } from './IssueStatusPriorityIcons';
import { ESTIMATE_OPTIONS, DEFAULT_PRIORITIES, DEFAULT_STATUSES } from './create-issue-constants';
import { PortalDropdown } from './PortalDropdown';
import { PortalCalendar } from './PortalCalendar';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  projectId?: string;
  // Los 3 consumidores de este modal (TeamTasksContent, ProjectIssuesView,
  // admin/teams/[teamId]/tasks) cada uno define su propio tipo local `Issue`
  // con formas distintas — tipar esto de forma estricta rompe la asignación
  // en al menos uno de los tres. Se deja `any` a propósito hasta unificar
  // esos tipos duplicados (deuda separada, fuera de este cambio).
   
  onIssueCreated: (issue: any) => void;
  initialStatus?: string;
  workspaceSlug?: string;
}

export default function CreateIssueModal({
  isOpen,
  onClose,
  teamId,
  projectId: initialProjectId,
  onIssueCreated,
  initialStatus,
  workspaceSlug
}: CreateIssueModalProps) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;

  // SOFIA Colors
  const primaryColor = '#0A2540';
  const accentColor = '#00D4B3';

  // Refs for dropdowns
  const statusRef = useRef<HTMLButtonElement>(null);
  const priorityRef = useRef<HTMLButtonElement>(null);
  const assigneeRef = useRef<HTMLButtonElement>(null);
  const dueDateRef = useRef<HTMLButtonElement>(null);
  const estimateRef = useRef<HTMLButtonElement>(null);
  const projectRef = useRef<HTMLButtonElement>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState<string>('');
  const [priorityId, setPriorityId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>(initialProjectId || '');
  
  // Update projectId when initialProjectId changes
  useEffect(() => {
    if (initialProjectId) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  const [cycleId, setCycleId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [estimatePoints, setEstimatePoints] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);
  const [selectedProjectDocs, setSelectedProjectDocs] = useState<string[]>([]);

  // Data State
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Document attachment state
  const google = useGoogleConnection();
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [showDocUrlInput, setShowDocUrlInput] = useState(false);
  const [docUrlValue, setDocUrlValue] = useState('');
  const [docUrlError, setDocUrlError] = useState('');
  const [docLinkingUrl, setDocLinkingUrl] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Get selected items for display
  const selectedStatus = statuses.find(s => s.status_id === statusId);
  const selectedPriority = priorities.find(p => p.priority_id === priorityId) || DEFAULT_PRIORITIES.find(p => p.priority_id === priorityId);
  const selectedAssignee = members.find(m => m.user_id === assigneeId);
  const selectedEstimate = ESTIMATE_OPTIONS.find(e => e.value === estimatePoints);

  // Ref para evitar bucles de actualización si cambiamos projectId dentro de fetchData
  const lastResolvedId = useRef<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Fetch project documents and details if we have a projectId (independent of team)
      const targetProjectId = initialProjectId || projectId;
      if (targetProjectId && targetProjectId !== lastResolvedId.current) {

        // Determinar URL base (Workspace o Admin)
        const projectApiBase = workspaceSlug
          ? `/api/workspaces/${workspaceSlug}/projects/${targetProjectId}`
          : `/api/admin/projects/${targetProjectId}`;

        // Paralelo: documentos y el proyecto específico
        const [docResult, pInfoResult] = await Promise.all([
          api.get<{ documents?: ProjectDocument[] }>(`${projectApiBase}/documents`),
          api.get<{ project?: Project }>(projectApiBase)
        ]);

        if (!docResult.error && docResult.data) {
          const data = docResult.data;
          setProjectDocuments(data.documents || []);
        }

        if (!pInfoResult.error && pInfoResult.data) {
          const data = pInfoResult.data;
          if (data.project) {
             const proj = data.project;
             setProjects(prev => prev.some(p => p.project_id === proj.project_id) ? prev : [...prev, proj]);

             // Si el ID que tenemos es un slug/key, lo actualizamos al UUID real
             // Pero sin disparar un re-fetch infinito
             if (targetProjectId !== proj.project_id) {
               lastResolvedId.current = proj.project_id;
               setProjectId(proj.project_id);
             }
          }
        }
      }

      // 2. Fetch team-specific data if we have a teamId
      if (teamId) {

        const projectEndpoint = workspaceSlug
          ? `/api/workspaces/${workspaceSlug}/projects?team_id=${encodeURIComponent(teamId)}&limit=100`
          : `/api/admin/projects?team_id=${encodeURIComponent(teamId)}&limit=100`;
        const [statusResult, labelResult, memberResult, cycleResult, projectResult] = await Promise.all([
          api.get<{ statuses?: Status[] }>(`/api/admin/teams/${teamId}/statuses`),
          api.get<{ labels?: Label[] }>(`/api/admin/teams/${teamId}/labels`),
          api.get<{ members?: Member[] }>(`/api/admin/teams/${teamId}/members`),
          api.get<{ cycles?: Cycle[] }>(`/api/admin/teams/${teamId}/cycles`),
          api.get<{ projects?: Project[] }>(projectEndpoint),
        ]);

        setPriorities(DEFAULT_PRIORITIES);
        if (!priorityId) {
          const medium = DEFAULT_PRIORITIES.find((priority) => priority.level === 3) || DEFAULT_PRIORITIES[0];
          setPriorityId(medium?.priority_id || '');
        }

        if (!statusResult.error && statusResult.data) {
          const data = statusResult.data;
          const fetchedStatuses = data.statuses || [];
          const finalStatuses = fetchedStatuses.length > 0 ? fetchedStatuses : DEFAULT_STATUSES;
          setStatuses(finalStatuses);

          if (!statusId && finalStatuses.length > 0) {
            const defaultStatus = finalStatuses.find((s: Status) => s.status_type === 'backlog') || finalStatuses[0];
            setStatusId(initialStatus || defaultStatus?.status_id || '');
          }
        } else {
          setStatuses(DEFAULT_STATUSES);
          if (!statusId) setStatusId(initialStatus || 'backlog');
        }


        if (!labelResult.error && labelResult.data) {
          setLabels(labelResult.data.labels || []);
        }

        if (!memberResult.error && memberResult.data) {
          setMembers(memberResult.data.members || []);
        }

        if (!cycleResult.error && cycleResult.data) {
          setCycles(cycleResult.data.cycles || []);
        }

        if (!projectResult.error && projectResult.data) {
          const data = projectResult.data;
          setProjects(prev => {
            const fetched: Project[] = data.projects || [];
             // Combinar con los existentes sin duplicados
             const combined = [...prev];
             fetched.forEach((fp) => {
               if (!combined.some(p => p.project_id === fp.project_id)) {
                 combined.push(fp);
               }
             });
             return combined;
          });
        }
      }
    } catch (error) {
      console.error('[CreateIssueModal] Unexpected error in fetchData:', error);
    } finally {
      setLoading(false);
    }
    // statusId/priorityId are intentionally omitted: they're read only as "set default
    // once" guards, and including them would re-trigger this fetch every time those
    // defaults get set, causing a redundant duplicate fetch on every modal open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, initialStatus, initialProjectId, projectId, workspaceSlug]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Reset form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatusId('');
    setPriorityId('');
    setAssigneeId('');
    setProjectId('');
    setCycleId('');
    setDueDate('');
    setEstimatePoints('');
    setSelectedLabels([]);
    setSelectedProjectDocs([]);
    setActiveDropdown(null);
    setPendingDocuments([]);
    setDocUrlValue('');
    setDocUrlError('');
    setShowDocUrlInput(false);
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Create issue
  const handleCreate = async () => {
    if (!title.trim()) return;

    setCreating(true);
    try {
      // Validate that IDs are real UUIDs before sending (fallback IDs like 'backlog' are not valid)
      const isValidUUID = (id: string | null) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      const payload: {
        title: string;
        description: string | null;
        status_id: string | null;
        priority_id: string | null;
        assignee_id: string | null;
        project_id: string | null;
        cycle_id: string | null;
        due_date: string | null;
        estimate_points: number | null;
        labels: string[];
      } = {
        title: title.trim(),
        description: description.trim() || null,
        status_id: isValidUUID(statusId) ? statusId : null,
        priority_id: isValidUUID(priorityId) ? priorityId : null,
        assignee_id: isValidUUID(assigneeId) ? assigneeId : null,
        project_id: isValidUUID(projectId) ? projectId : null,
        cycle_id: isValidUUID(cycleId) ? cycleId : null,
        due_date: dueDate || null,
        estimate_points: estimatePoints ? parseInt(estimatePoints) : null,
        labels: selectedLabels.filter(id => isValidUUID(id))
      };

      const { data, error, status } = await api.post<{ issue?: { issue_id: string; [key: string]: unknown } }>(
        `/api/admin/teams/${teamId}/issues`,
        payload
      );

      if (!error && data) {
        // Vincular documentos pendientes a la issue creada
        if (pendingDocuments.length > 0 && data.issue?.issue_id) {
          const docApiBase = workspaceSlug
            ? `/api/workspaces/${workspaceSlug}/teams/${teamId}/issues/${data.issue.issue_id}/documents`
            : `/api/admin/teams/${teamId}/issues/${data.issue.issue_id}/documents`;

          for (const pending of pendingDocuments) {
            const { provider, docType } = classifyGoogleFile(pending.file.mimeType);
            try {
              await api.post(docApiBase, {
                name: pending.file.name,
                provider,
                external_id: pending.file.id,
                external_url: pending.file.url,
                doc_type: docType,
                mime_type: pending.file.mimeType,
                thumbnail_url: pending.file.iconUrl || null,
              });
            } catch (docError) {
              console.error('Error vinculando documento:', docError);
            }
          }
        }

        // Vincular documentos existentes del proyecto
        if (selectedProjectDocs.length > 0 && data.issue?.issue_id) {
          const docApiBase = workspaceSlug
            ? `/api/workspaces/${workspaceSlug}/teams/${teamId}/issues/${data.issue.issue_id}/documents`
            : `/api/admin/teams/${teamId}/issues/${data.issue.issue_id}/documents`;

          for (const docId of selectedProjectDocs) {
            const projectDoc = projectDocuments.find(d => d.id === docId);
            if (!projectDoc) continue;

            try {
              await api.post(docApiBase, {
                name: projectDoc.name,
                provider: projectDoc.provider || 'google',
                external_id: projectDoc.external_id,
                external_url: projectDoc.external_url,
                doc_type: projectDoc.doc_type,
                mime_type: projectDoc.mime_type,
                thumbnail_url: projectDoc.thumbnail_url || null,
              });
            } catch (docError) {
              console.error('Error vinculando documento de proyecto:', docError);
            }
          }
        }

        onIssueCreated(data.issue);
        handleClose();
      } else {
        // Surface error to user
        console.error('Error creating issue:', status, error);
        alert(`Error al crear la tarea: ${error || 'Error interno del servidor'}`);
      }
    } catch (error) {
      console.error('Error creating issue:', error);
      alert('Error de conexión al crear la tarea. Intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  // Toggle label
  const toggleLabel = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const toggleProjectDoc = (docId: string) => {
    setSelectedProjectDocs(prev => 
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  // ─── Document handlers ──────────────────────────────

  const handleDocPickerSelect = (file: PickedFile) => {
    setDocPickerOpen(false);
    if (pendingDocuments.some((d) => d.file.id === file.id)) return;
    setPendingDocuments((prev) => [...prev, { file, source: 'picker' }]);
  };

  const handleDocFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files, error } = collectAttachmentFiles(e.target.files);
    if (error) { alert(error); return; }
    if (!files.length) return;

    setDocUploading(true);
    try {
      const { data: tokenData, error: tokenError } = await api.get<{ accessToken: string }>('/api/auth/google/token');
      if (tokenError || !tokenData) { alert('No se pudo acceder a Google. Reconecta tu cuenta.'); return; }

      const additions: PendingDocument[] = [];
      for (const file of files) {
        const uploaded = await uploadFileToDrive(file, tokenData.accessToken);
        if (!uploaded) throw new Error(`No se pudo subir ${file.name}`);
        additions.push({
          file: {
            id: uploaded.id,
            name: uploaded.name,
            url: uploaded.webViewLink,
            mimeType: uploaded.mimeType,
          },
          source: 'upload',
        });
      }
      setPendingDocuments((current) => {
        const ids = new Set(current.map((document) => document.file.id));
        return [...current, ...additions.filter((document) => !ids.has(document.file.id))];
      });
    } catch (uploadError) {
      alert(uploadError instanceof Error ? uploadError.message : 'No se pudieron subir los archivos.');
    } finally {
      setDocUploading(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const handleDocPasteUrl = async () => {
    setDocUrlError('');
    const parsed = parseGoogleUrl(docUrlValue.trim());
    if (!parsed) { setDocUrlError('URL no válida. Usa un enlace de Google Docs, Sheets, Slides o Drive.'); return; }
    setDocLinkingUrl(true);
    try {
      let fileName = 'Documento de Google';
      let mimeType = parsed.mimeType;
      try {
        const { data: tokenData, error: tokenError } = await api.get<{ accessToken: string }>('/api/auth/google/token');
        if (!tokenError && tokenData) {
          const { accessToken } = tokenData;
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${parsed.fileId}?fields=name,mimeType`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (metaRes.ok) {
            const meta = await metaRes.json();
            fileName = meta.name || fileName;
            if (!mimeType && meta.mimeType) mimeType = meta.mimeType;
          }
        }
      } catch { /* usa defaults */ }

      const pickedFile: PickedFile = {
        id: parsed.fileId,
        name: fileName,
        url: docUrlValue.trim(),
        mimeType: mimeType || '',
      };
      if (!pendingDocuments.some((d) => d.file.id === parsed.fileId)) {
        setPendingDocuments((prev) => [...prev, { file: pickedFile, source: 'url' }]);
      }
      setDocUrlValue('');
      setShowDocUrlInput(false);
    } catch (err) {
      console.error('Error vinculando URL:', err);
      setDocUrlError('Error al procesar la URL.');
    } finally {
      setDocLinkingUrl(false);
    }
  };

  const removePendingDoc = (fileId: string) => {
    setPendingDocuments((prev) => prev.filter((d) => d.file.id !== fileId));
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
    <AnimatePresence>
      {isOpen && (
        <div
          key="create-issue-modal"
          className="fixed inset-0 flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          style={{ zIndex: 9999 }}
          data-sofia-modal-root
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          className="absolute inset-0 backdrop-blur-sm"
          data-sofia-overlay
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={handleClose}
          />

          {/* Modal - Split Panel Pattern */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col md:flex-row"
            data-sofia-modal
            data-modal-kind="issue"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-issue-title"
            style={{ 
              backgroundColor: isDark ? '#1a1f25' : '#ffffff',
              height: 'min(600px, 85vh)',
              maxHeight: 'calc(100vh - 40px)',
              marginTop: 'auto',
              marginBottom: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row w-full h-full overflow-hidden" data-modal-layout>
              {/* Left Panel - Preview */}
              <div 
                className="w-full md:w-72 p-6 border-b md:border-b-0 md:border-r flex flex-col shrink-0 overflow-y-auto"
                data-modal-aside
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  background: isDark 
                    ? `linear-gradient(135deg, ${primaryColor}40, ${accentColor}15)` 
                    : `linear-gradient(135deg, ${primaryColor}08, ${accentColor}05)`
                }}
              >
                {/* Icon/Avatar */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="relative mb-4"
                >
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                      boxShadow: `0 8px 30px ${primaryColor}40`
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                  
                  {/* Animated badge */}
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: accentColor, left: '58%' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                    </svg>
                  </motion.div>
                </motion.div>

                {/* Title */}
                <h3 className="text-lg font-bold text-center mb-1" style={{ color: colors.textPrimary }}>
                  Convertir una idea en acción
                </h3>
                <p className="text-xs text-center mb-6" style={{ color: colors.textMuted }}>
                  La tarea quedará lista para priorizar, asignar y ejecutar.
                </p>

                {/* Preview Info */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {selectedStatus && (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                      <StatusIcon type={selectedStatus.status_type} color={selectedStatus.color} size={16} />
                      <div className="min-w-0">
                        <p className="text-[10px]" style={{ color: colors.textMuted }}>Estado</p>
                        <p className="text-xs font-medium truncate" style={{ color: colors.textPrimary }}>{selectedStatus.name}</p>
                      </div>
                    </div>
                  )}

                  {selectedPriority && (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                      <PriorityIcon level={selectedPriority.level} color={selectedPriority.color} size={16} />
                      <div>
                        <p className="text-[10px]" style={{ color: colors.textMuted }}>Prioridad</p>
                        <p className="text-xs font-medium" style={{ color: colors.textPrimary }}>{selectedPriority.name}</p>
                      </div>
                    </div>
                  )}

                  {selectedAssignee && (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: accentColor, color: 'white' }}>
                        {selectedAssignee.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px]" style={{ color: colors.textMuted }}>Asignado</p>
                        <p className="text-xs font-medium truncate" style={{ color: colors.textPrimary }}>{selectedAssignee.display_name}</p>
                      </div>
                    </div>
                  )}

                  {dueDate && (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <div>
                        <p className="text-[10px]" style={{ color: colors.textMuted }}>Fecha límite</p>
                        <p className="text-xs font-medium" style={{ color: colors.textPrimary }}>
                          {format(new Date(dueDate), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedLabels.length > 0 && (
                    <div className="p-2 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                      <p className="text-[10px] mb-1" style={{ color: colors.textMuted }}>Etiquetas</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedLabels.slice(0, 3).map(labelId => {
                          const label = labels.find(l => l.label_id === labelId);
                          if (!label) return null;
                          return (
                            <span key={labelId} className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: `${label.color}20`, color: label.color }}>
                              {label.name}
                            </span>
                          );
                        })}
                        {selectedLabels.length > 3 && (
                          <span className="text-[9px]" style={{ color: colors.textMuted }}>+{selectedLabels.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel - Form */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden" data-modal-main>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: colors.border, backgroundColor: isDark ? 'rgba(26, 31, 37, 0.8)' : 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', zIndex: 10 }} data-modal-section="header">
                  <div>
                    <h2 id="create-issue-title" className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      Detalles de la tarea
                    </h2>
                    <p className="text-xs" style={{ color: colors.textMuted }}>
                      Completa la información necesaria
                    </p>
                  </div>
                  <button 
                    onClick={handleClose}
                    type="button"
                    aria-label="Cerrar creación de tarea"
                    className="p-2 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: colors.textMuted }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hidden" data-modal-section="body">
                  <div className="p-6">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                      </div>
                    ) : (
                    <div className="space-y-4" data-issue-grid>
                      {/* Title */}
                      <div data-issue-title>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>
                          Título <span style={{ color: '#EF4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="¿Qué necesitas hacer?"
                          autoFocus
                          className="w-full px-3 py-2.5 rounded-xl border text-sm"
                          style={{
                            backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                            borderColor: colors.border,
                            color: colors.textPrimary
                          }}
                        />
                      </div>

                      {/* Description */}
                      <div data-issue-description>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>
                          Descripción
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Añade detalles..."
                          rows={2}
                          className="w-full px-3 py-2.5 rounded-xl border resize-none text-sm"
                          style={{
                            backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                            borderColor: colors.border,
                            color: colors.textPrimary
                          }}
                        />
                      </div>

                      {/* Grid de campos */}
                      <div className="grid grid-cols-2 gap-3" data-issue-planning>
                        {/* Status */}
                        <div>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>Estado</label>
                          <button
                            ref={statusRef}
                            onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left"
                            style={{
                              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                              borderColor: activeDropdown === 'status' ? accentColor : colors.border,
                              color: colors.textPrimary
                            }}
                          >
                            {selectedStatus ? (
                              <><StatusIcon type={selectedStatus.status_type} color={selectedStatus.color} /><span className="flex-1 truncate">{selectedStatus.name}</span></>
                            ) : (
                              <span className="flex-1" style={{ color: colors.textMuted }}>Seleccionar</span>
                            )}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <PortalDropdown isOpen={activeDropdown === 'status'} onClose={() => setActiveDropdown(null)} triggerRef={statusRef} isDark={isDark} colors={colors}>
                            {statuses.map(status => (
                              <button key={status.status_id} onClick={() => { setStatusId(status.status_id); setActiveDropdown(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left" style={{ color: colors.textPrimary }}>
                                <StatusIcon type={status.status_type} color={status.color} /><span>{status.name}</span>
                              </button>
                            ))}
                          </PortalDropdown>
                        </div>

                        {/* Priority */}
                        <div>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>Prioridad</label>
                          <button
                            ref={priorityRef}
                            onClick={() => setActiveDropdown(activeDropdown === 'priority' ? null : 'priority')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left"
                            style={{
                              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                              borderColor: activeDropdown === 'priority' ? accentColor : colors.border,
                              color: colors.textPrimary
                            }}
                          >
                            {selectedPriority ? (
                              <><PriorityIcon level={selectedPriority.level} color={selectedPriority.color} /><span className="flex-1">{selectedPriority.name}</span></>
                            ) : (
                              <span className="flex-1" style={{ color: colors.textMuted }}>Sin prioridad</span>
                            )}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <PortalDropdown isOpen={activeDropdown === 'priority'} onClose={() => setActiveDropdown(null)} triggerRef={priorityRef} isDark={isDark} colors={colors}>
                            {priorities.map(p => (
                              <button key={p.priority_id} onClick={() => { setPriorityId(p.priority_id); setActiveDropdown(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left" style={{ color: colors.textPrimary }}>
                                <PriorityIcon level={p.level} color={p.color} /><span>{p.name}</span>
                              </button>
                            ))}
                          </PortalDropdown>
                        </div>

                        {/* Assignee */}
                        <div>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>Asignar a</label>
                          <button
                            ref={assigneeRef}
                            onClick={() => setActiveDropdown(activeDropdown === 'assignee' ? null : 'assignee')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left"
                            style={{
                              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                              borderColor: activeDropdown === 'assignee' ? accentColor : colors.border,
                              color: colors.textPrimary
                            }}
                          >
                            {selectedAssignee ? (
                              <>
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: accentColor, color: 'white' }}>
                                  {selectedAssignee.display_name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <span className="flex-1 truncate">{selectedAssignee.display_name}</span>
                              </>
                            ) : (
                              <span className="flex-1" style={{ color: colors.textMuted }}>Sin asignar</span>
                            )}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <PortalDropdown isOpen={activeDropdown === 'assignee'} onClose={() => setActiveDropdown(null)} triggerRef={assigneeRef} isDark={isDark} colors={colors}>
                            <button onClick={() => { setAssigneeId(''); setActiveDropdown(null); }} className="w-full px-3 py-2 text-sm hover:bg-white/5 text-left" style={{ color: colors.textMuted }}>Sin asignar</button>
                            {members.map(m => (
                              <button key={m.user_id} onClick={() => { setAssigneeId(m.user_id); setActiveDropdown(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left" style={{ color: colors.textPrimary }}>
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: accentColor, color: 'white' }}>
                                  {m.display_name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <span className="truncate">{m.display_name || 'Sin nombre'}</span>
                              </button>
                            ))}
                          </PortalDropdown>
                        </div>

                        {/* Due Date */}
                        <div>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>Fecha límite</label>
                          <button
                            ref={dueDateRef}
                            onClick={() => setActiveDropdown(activeDropdown === 'dueDate' ? null : 'dueDate')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left"
                            style={{
                              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                              borderColor: activeDropdown === 'dueDate' ? accentColor : colors.border,
                              color: dueDate ? colors.textPrimary : colors.textMuted
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}>
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            <span className="flex-1">{dueDate ? format(new Date(dueDate), 'dd MMM yyyy', { locale: es }) : 'Seleccionar'}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <PortalCalendar isOpen={activeDropdown === 'dueDate'} onClose={() => setActiveDropdown(null)} triggerRef={dueDateRef} value={dueDate} onChange={setDueDate} isDark={isDark} colors={colors} accentColor={accentColor} />
                        </div>

                        {/* Estimate */}
                        <div>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>Estimación</label>
                          <button
                            ref={estimateRef}
                            onClick={() => setActiveDropdown(activeDropdown === 'estimate' ? null : 'estimate')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left"
                            style={{
                              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                              borderColor: activeDropdown === 'estimate' ? accentColor : colors.border,
                              color: selectedEstimate?.value ? colors.textPrimary : colors.textMuted
                            }}
                          >
                            {selectedEstimate?.value ? (
                              <>
                                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>{selectedEstimate.icon}</div>
                                <span className="flex-1">{selectedEstimate.label}</span>
                              </>
                            ) : (
                              <span className="flex-1">Sin estimación</span>
                            )}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <PortalDropdown isOpen={activeDropdown === 'estimate'} onClose={() => setActiveDropdown(null)} triggerRef={estimateRef} isDark={isDark} colors={colors}>
                            {ESTIMATE_OPTIONS.map(opt => (
                              <button key={opt.value || 'none'} onClick={() => { setEstimatePoints(opt.value); setActiveDropdown(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left" style={{ color: opt.value ? colors.textPrimary : colors.textMuted }}>
                                {opt.value && <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>{opt.icon}</div>}
                                <span>{opt.label}</span>
                              </button>
                            ))}
                          </PortalDropdown>
                        </div>

                        {/* Project */}
                        <div>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: colors.textPrimary }}>Proyecto</label>
                          <button
                            ref={projectRef}
                            onClick={() => !initialProjectId && setActiveDropdown(activeDropdown === 'project' ? null : 'project')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left disabled:opacity-70"
                            disabled={!!initialProjectId}
                            style={{
                              backgroundColor: isDark ? '#0F1419' : '#F9FAFB',
                              borderColor: activeDropdown === 'project' ? accentColor : colors.border,
                              color: projectId ? colors.textPrimary : colors.textMuted,
                              cursor: initialProjectId ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <span className="flex-1 truncate">{projects.find(p => p.project_id === projectId)?.project_name || (initialProjectId ? 'Cargando...' : 'Sin proyecto')}</span>
                            {!initialProjectId && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.textMuted }}><polyline points="6 9 12 15 18 9"/></svg>
                            )}
                          </button>
                          {!initialProjectId && projects.length > 0 && (
                            <PortalDropdown isOpen={activeDropdown === 'project'} onClose={() => setActiveDropdown(null)} triggerRef={projectRef} isDark={isDark} colors={colors}>
                              <button onClick={() => { setProjectId(''); setActiveDropdown(null); }} className="w-full px-3 py-2 text-sm hover:bg-white/5 text-left" style={{ color: colors.textMuted }}>Sin proyecto</button>
                              {projects.map(p => (
                                <button key={p.project_id} onClick={() => { setProjectId(p.project_id); setActiveDropdown(null); }}
                                  className="w-full px-3 py-2 text-sm hover:bg-white/5 text-left truncate" style={{ color: colors.textPrimary }}>{p.project_name}</button>
                              ))}
                            </PortalDropdown>
                          )}
                        </div>
                      </div>

                      {/* Labels */}
                      {labels.length > 0 && (
                        <div data-issue-labels>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>Etiquetas</label>
                          <div className="flex flex-wrap gap-2">
                            {labels.map(label => {
                              const isSelected = selectedLabels.includes(label.label_id);
                              return (
                                <button key={label.label_id} onClick={() => toggleLabel(label.label_id)}
                                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                                  style={{ backgroundColor: isSelected ? `${label.color}30` : `${label.color}15`, color: label.color, boxShadow: isSelected ? `0 0 0 2px ${label.color}` : 'none' }}>
                                  {label.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Project Documents */}
                      {projectDocuments.length > 0 && (
                        <div data-issue-project-documents>
                          <div className="flex items-center justify-between mb-2">
                             <label className="block text-sm font-medium" style={{ color: colors.textPrimary }}>Contexto del Proyecto</label>
                             <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">Documentos disponibles</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {projectDocuments.map(doc => {
                              const isSelected = selectedProjectDocs.includes(doc.id);
                              return (
                                <button 
                                  key={doc.id} 
                                  type="button"
                                  onClick={() => toggleProjectDoc(doc.id)}
                                  className="flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95"
                                  style={{ 
                                    borderColor: isSelected ? accentColor : colors.border,
                                    backgroundColor: isSelected ? `${accentColor}10` : isDark ? '#0F1419' : '#F9FAFB'
                                  }}
                                >
                                  <div className="p-2 rounded-lg bg-white/5 shrink-0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? accentColor : colors.textMuted} strokeWidth="2">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold truncate" style={{ color: isSelected ? accentColor : colors.textPrimary }}>{doc.name}</p>
                                    <p className="text-[9px] opacity-40 uppercase tracking-tighter">{doc.doc_type || 'Google Doc'}</p>
                                  </div>
                                  {isSelected && (
                                    <div className="w-4 h-4 rounded-full flex items-center justify-center bg-[#00D4B3]">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Documentos Externos (Google Drive) */}
                      <div data-issue-attachments>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                          Adjuntos Externos
                        </label>

                        {!google.isConnected ? (
                          <button
                            type="button"
                            onClick={() => google.connect()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed text-sm transition-colors hover:border-blue-500/50"
                            style={{ borderColor: colors.border, color: colors.textSecondary }}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Conectar Google Drive
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input ref={docFileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleDocFileUpload} />
                              <button
                                type="button"
                                onClick={() => docFileInputRef.current?.click()}
                                disabled={docUploading}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors"
                                style={{ borderColor: colors.border, color: colors.textSecondary }}
                              >
                                {docUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Subir Archivo
                              </button>
                              <button
                                type="button"
                                onClick={() => setDocPickerOpen(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                                style={{ backgroundColor: '#2563EB' }}
                              >
                                <Plus size={14} />
                                Google Drive
                              </button>
                            </div>
                            
                            {pendingDocuments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {pendingDocuments.map((pd) => (
                                  <div key={pd.file.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs">
                                    <span className="truncate max-w-[100px]">{pd.file.name}</span>
                                    <button onClick={() => removePendingDoc(pd.file.id)} className="text-red-400 hover:text-red-300">
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0 mt-auto" style={{ borderColor: colors.border, backgroundColor: isDark ? 'rgba(26, 31, 37, 0.8)' : 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)' }} data-modal-section="footer">
                <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-white/5" style={{ color: colors.textSecondary }}>Cancelar</button>
                <button onClick={handleCreate} disabled={creating || !title.trim()}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
                  style={{ 
                    backgroundColor: isDark ? '#10B981' : '#0A2540', 
                    boxShadow: isDark ? '0 4px 15px rgba(16, 185, 129, 0.4)' : '0 4px 15px rgba(10, 37, 64, 0.4)' 
                  }}>
                  {creating ? (
                    <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Creando...</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Plus size={18} />
                      Crear tarea
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )}

    </AnimatePresence>
    <GoogleDrivePicker
      isOpen={docPickerOpen}
      onSelect={handleDocPickerSelect}
      onCancel={() => setDocPickerOpen(false)}
    />
    </>,
    document.body
  );
}
