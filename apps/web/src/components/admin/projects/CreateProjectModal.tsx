'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useGoogleConnection } from '@/shared/hooks/useGoogleConnection';
import { GoogleDrivePicker } from '@/components/google/GoogleDrivePicker';
import type { PickedFile } from '@/components/google/GoogleDrivePicker';
import { classifyGoogleFile, parseGoogleUrl, uploadFileToDrive } from '@/lib/google/document-utils';
import { ATTACHMENT_ACCEPT, collectAttachmentFiles } from '@/lib/uploads/attachment-policy';
import { api } from '@/lib/api/client';
import { CustomDatePicker } from './CustomDatePicker';
import { ICONS, ICON_COLORS, PRIORITY_OPTIONS, STATUS_OPTIONS, IconSVGs } from './create-project-constants';

// ============================================
// TYPES
// ============================================
interface Team {
  id: string;
  team_id?: string; // legacy field
  name: string;
  color: string;
}

interface User {
  id: string;
  displayName: string;
  firstName: string;
  lastNamePaternal: string;
  avatarUrl?: string;
  email: string;
}

interface Milestone {
  name: string;
  description: string;
}

interface GeneratedIssue {
  issue_id?: string;
  identifier?: string;
  title: string;
  priority?: { color?: string } | null;
  assignee?: { display_name?: string; first_name?: string } | null;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTeamId?: string;
  initialStatus?: string;
  workspaceSlug?: string;
}

export function CreateProjectModal({ isOpen, onClose, onSuccess, initialTeamId, initialStatus, workspaceSlug }: CreateProjectModalProps) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  // Form state
  const [projectName, setProjectName] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [priority, setPriority] = useState('none');
  const [status, setStatus] = useState(initialStatus || 'planning');
  const [leadId, setLeadId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  
  // Milestones State
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDesc, setNewMilestoneDesc] = useState('');

  const addMilestone = () => {
    if (!newMilestoneName.trim()) return;
    setMilestones((prev) => [...prev, { name: newMilestoneName, description: newMilestoneDesc }]);
    setNewMilestoneName('');
    setNewMilestoneDesc('');
    setShowMilestoneForm(false);
  };
  
  // Initialize teamId if provided
  useEffect(() => {
    if (isOpen && initialTeamId) {
      setTeamId(initialTeamId);
    }
  }, [isOpen, initialTeamId]);

  // Initialize status if provided
  useEffect(() => {
    if (isOpen && initialStatus) {
      setStatus(initialStatus);
    }
  }, [isOpen, initialStatus]);
  
  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dropdown states
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Document attachment state
  const google = useGoogleConnection();
  const [pendingDocuments, setPendingDocuments] = useState<PickedFile[]>([]);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [showDocUrlInput, setShowDocUrlInput] = useState(false);
  const [docUrlValue, setDocUrlValue] = useState('');
  const [docUrlError, setDocUrlError] = useState('');
  const [docLinkingUrl, setDocLinkingUrl] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // AI auto-generation state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [aiResult, setAiResult] = useState<{ count: number; issues: GeneratedIssue[] } | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      const url = workspaceSlug ? `/api/workspaces/${workspaceSlug}/teams?limit=50` : '/api/admin/teams';
      const { data, error } = await api.get<{ teams: Team[] }>(url);
      if (!error && data) {
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  }, [workspaceSlug]);

  const fetchUsers = useCallback(async () => {
    try {
      const url = workspaceSlug ? `/api/workspaces/${workspaceSlug}/members` : '/api/admin/users';
      const { data, error } = await api.get<{ users: User[] }>(url);
      if (!error && data) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [workspaceSlug]);

  // Fetch teams and users
  useEffect(() => {
    if (isOpen) {
      fetchTeams();
      fetchUsers();
    }
  }, [isOpen, fetchTeams, fetchUsers]);

  const handleSubmit = async () => {
    if (!projectName.trim()) {
      setError('El nombre del proyecto es requerido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current user ID (you may need to get this from auth context)
      const currentUserId = users[0]?.id; // Fallback for demo

      const projectUrl = workspaceSlug ? `/api/workspaces/${workspaceSlug}/projects` : '/api/admin/projects';
      const { data: resData, error: createError } = await api.post<{
        project?: { project_id?: string };
        project_id?: string;
      }>(projectUrl, {
        project_name: projectName,
        project_description: description || summary,
        icon_name: selectedIcon,
        icon_color: selectedColor,
        priority_level: priority,
        project_status: status,
        lead_user_id: leadId,
        team_id: teamId,
        start_date: startDate || null,
        target_date: targetDate || null,
        created_by_user_id: currentUserId,
        tags: labels,
        milestones: milestones
      });

      if (createError || !resData) {
        throw new Error(createError || 'Error al crear proyecto');
      }

      const newProjectId = resData.project?.project_id || resData.project_id;

      // Vincular documentos pendientes al proyecto creado
      if (pendingDocuments.length > 0 && newProjectId) {
        const docApiBase = workspaceSlug
          ? `/api/workspaces/${workspaceSlug}/projects/${newProjectId}/documents`
          : `/api/admin/projects/${newProjectId}/documents`;

        for (const file of pendingDocuments) {
          const { provider, docType } = classifyGoogleFile(file.mimeType);
          try {
            await api.post(docApiBase, {
              name: file.name,
              provider,
              external_id: file.id,
              external_url: file.url,
              doc_type: docType,
              mime_type: file.mimeType,
              thumbnail_url: file.iconUrl || null,
            });
          } catch (docError) {
            console.error('Error vinculando documento al proyecto:', docError);
          }
        }

        // Auto-generate issues from documents if team is assigned
        const resolvedTeamId = teamId || initialTeamId;
        if (resolvedTeamId && newProjectId) {
          setAiAnalyzing(true);
          setAiProgress('Analizando documentos con IA...');
          try {
            const { data: analyzeData, error: analyzeError } = await api.post<{
              count: number;
              issues: GeneratedIssue[];
              message?: string;
            }>('/api/ai/analyze-documents', {
              projectId: newProjectId,
              teamId: resolvedTeamId,
              documents: pendingDocuments.map((d) => ({
                external_id: d.id,
                mime_type: d.mimeType,
                name: d.name,
              })),
            });

            if (!analyzeError && analyzeData && analyzeData.count > 0) {
              setAiResult({ count: analyzeData.count, issues: analyzeData.issues || [] });
              setAiProgress(`Se crearon ${analyzeData.count} tareas automáticamente`);
              setShowAiResult(true);
              // Wait for user to see result before closing
              onSuccess?.();
              return;
            } else {
              setAiProgress(analyzeData?.message || 'No se detectaron tareas en los documentos.');
              // Auto-close after showing message
              setTimeout(() => {
                setAiAnalyzing(false);
                onSuccess?.();
                handleClose();
              }, 2000);
              return;
            }
          } catch (aiError) {
            console.error('Error en análisis IA:', aiError);
            setAiProgress('Error al analizar documentos. El proyecto fue creado correctamente.');
            setTimeout(() => {
              setAiAnalyzing(false);
              onSuccess?.();
              handleClose();
            }, 2000);
            return;
          }
        }
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProjectName('');
    setSummary('');
    setDescription('');
    setSelectedIcon('folder');
    setSelectedColor('#3B82F6');
    setPriority('none');
    setStatus('planning');
    setLeadId(null);
    setTeamId(null);
    setStartDate('');
    setTargetDate('');
    setLabels([]);
    setMilestones([]);
    setShowMilestoneForm(false);
    setNewMilestoneName('');
    setNewMilestoneDesc('');
    setPendingDocuments([]);
    setDocUrlValue('');
    setDocUrlError('');
    setShowDocUrlInput(false);
    setAiAnalyzing(false);
    setAiProgress('');
    setAiResult(null);
    setShowAiResult(false);
    setError(null);
    onClose();
  };

  const addLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setLabels([...labels, newLabel.trim()]);
      setNewLabel('');
    }
  };

  const removeLabel = (label: string) => {
    setLabels(labels.filter(l => l !== label));
  };

  const selectedTeam = teams.find(t => (t.id || t.team_id) === teamId);
  const selectedLead = users.find(u => u.id === leadId);

  // ─── Document handlers ──────────────────────────────

  const handleDocPickerSelect = (file: PickedFile) => {
    setDocPickerOpen(false);
    if (pendingDocuments.some((d) => d.id === file.id)) return;
    setPendingDocuments((prev) => [...prev, file]);
  };

  const handleDocFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files, error } = collectAttachmentFiles(e.target.files);
    if (error) { alert(error); return; }
    if (!files.length) return;

    setDocUploading(true);
    try {
      const { data: tokenData, error: tokenError } = await api.get<{ accessToken?: string }>('/api/auth/google/token');
      if (tokenError || !tokenData?.accessToken) { alert('No se pudo acceder a Google. Reconecta tu cuenta.'); return; }

      const additions: PickedFile[] = [];
      for (const file of files) {
        const uploaded = await uploadFileToDrive(file, tokenData.accessToken);
        if (!uploaded) throw new Error(`No se pudo subir ${file.name}`);
        additions.push({
          id: uploaded.id,
          name: uploaded.name,
          url: uploaded.webViewLink,
          mimeType: uploaded.mimeType,
        });
      }
      setPendingDocuments((current) => {
        const ids = new Set(current.map((document) => document.id));
        return [...current, ...additions.filter((document) => !ids.has(document.id))];
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
    if (!parsed) { setDocUrlError('URL no válida.'); return; }
    setDocLinkingUrl(true);
    try {
      let fileName = 'Documento de Google';
      let mimeType = parsed.mimeType;
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
            if (!mimeType && meta.mimeType) mimeType = meta.mimeType;
          }
        }
      } catch { /* usa defaults */ }

      if (!pendingDocuments.some((d) => d.id === parsed.fileId)) {
        setPendingDocuments((prev) => [...prev, {
          id: parsed.fileId,
          name: fileName,
          url: docUrlValue.trim(),
          mimeType: mimeType || '',
        }]);
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
    setPendingDocuments((prev) => prev.filter((d) => d.id !== fileId));
  };

  if (!isOpen) return null;

  return (
    <>
    <AnimatePresence>
      <div key="create-project-modal" className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }} data-sofia-modal-root>
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

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl border"
          data-sofia-modal
          data-modal-kind="project"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
          style={{ 
            backgroundColor: isDark ? '#161920' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }} data-modal-section="header">
            <div data-modal-heading>
              <span>PORTAFOLIO · NUEVO PROYECTO</span>
              <h2 id="create-project-title">Crear un espacio de trabajo</h2>
              <p>Define el propósito, la planificación y el contexto del proyecto.</p>
            </div>
            {/* Team Selector */}
            <div className="relative" data-project-team>
              <button
                onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                style={{ 
                  backgroundColor: selectedTeam ? `${selectedTeam.color}20` : 'rgba(255,255,255,0.05)',
                  color: selectedTeam?.color || colors.textSecondary
                }}
              >
                <span className="w-4 h-4 rounded" style={{ backgroundColor: selectedTeam?.color || '#6B7280' }} />
                {selectedTeam?.name || 'Equipo'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              
              {showTeamDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 mt-1 w-48 rounded-xl border shadow-xl z-50 overflow-hidden"
                  style={{ backgroundColor: isDark ? '#1E2329' : colors.bgPrimary, borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <button
                    onClick={() => { setTeamId(null); setShowTeamDropdown(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                    style={{ color: colors.textSecondary }}
                  >
                    Sin equipo
                  </button>
                  {teams.map((team, index) => {
                    const teamIdValue = team.id || team.team_id;
                    return (
                      <button
                        key={teamIdValue || `team-${index}`}
                        onClick={() => { setTeamId(teamIdValue!); setShowTeamDropdown(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{ color: teamId === teamIdValue ? team.color : colors.textPrimary }}
                      >
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              type="button"
              aria-label="Cerrar creación de proyecto"
              className="ml-auto p-2 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: colors.textMuted }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]" data-modal-section="body">
            {/* Icon Picker */}
            <div className="relative mb-4" data-project-icon>
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {IconSVGs[selectedIcon]}
                </svg>
              </button>

              {showIconPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-14 left-0 p-4 rounded-xl border shadow-xl z-50"
                  style={{ backgroundColor: isDark ? '#1E2329' : colors.bgPrimary, borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <div className="text-xs font-medium mb-2" style={{ color: colors.textMuted }}>Icono</div>
                  <div className="flex gap-2 mb-3">
                    {ICONS.map(icon => (
                      <button
                        key={icon.name}
                        onClick={() => setSelectedIcon(icon.name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${selectedIcon === icon.name ? 'ring-2 ring-offset-2 ring-offset-transparent' : 'hover:bg-white/10'}`}
                        style={{ backgroundColor: selectedIcon === icon.name ? `${selectedColor}30` : 'transparent', color: selectedColor }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {IconSVGs[icon.name]}
                        </svg>
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-medium mb-2" style={{ color: colors.textMuted }}>Color</div>
                  <div className="flex gap-2">
                    {ICON_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => { setSelectedColor(color); setShowIconPicker(false); }}
                        className={`w-6 h-6 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-transparent' : 'hover:scale-110'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Project Name */}
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Nombre del proyecto"
              aria-label="Nombre del proyecto"
              data-project-name
              className="w-full text-3xl font-bold bg-transparent border-none outline-none mb-3 px-0 placeholder-gray-500"
              style={{ color: isDark ? '#FFFFFF' : '#111827' }}
            />

            {/* Summary */}
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Resume el resultado que quieres conseguir..."
              aria-label="Resumen del proyecto"
              data-project-summary
              className="w-full text-base bg-transparent border-none outline-none mb-8 px-0 placeholder-gray-500"
              style={{ color: isDark ? '#9CA3AF' : '#4B5563' }}
            />

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap gap-2 mb-6" data-project-planning>
              <div data-project-section-head>
                <span>PLANIFICACIÓN</span>
                <strong>Decisiones clave</strong>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5 border border-transparent hover:border-white/10"
                  style={{ color: colors.textSecondary }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  {STATUS_OPTIONS.find(s => s.value === status)?.label || 'Estado'}
                </button>
                {showStatusDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 mt-1 w-40 rounded-xl border shadow-xl z-50 overflow-hidden"
                    style={{ backgroundColor: isDark ? '#1E2329' : colors.bgPrimary, borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setStatus(opt.value); setShowStatusDropdown(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                        style={{ color: status === opt.value ? '#00D4B3' : colors.textPrimary }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Priority */}
              <div className="relative">
                <button
                  onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5 border border-transparent hover:border-white/10"
                  style={{ color: colors.textSecondary }}
                >
                  {priority === 'none' ? '···' : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 14V3L8 1L13 3V14L8 12L3 14Z" fill={PRIORITY_OPTIONS.find(p => p.value === priority)?.color} />
                    </svg>
                  )}
                  {PRIORITY_OPTIONS.find(p => p.value === priority)?.label}
                </button>
                {showPriorityDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 mt-1 w-40 rounded-xl border shadow-xl z-50 overflow-hidden"
                    style={{ backgroundColor: isDark ? '#1E2329' : colors.bgPrimary, borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setPriority(opt.value); setShowPriorityDropdown(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{ color: priority === opt.value ? '#00D4B3' : colors.textPrimary }}
                      >
                        {opt.value !== 'none' && <span className="w-3 h-3 rounded" style={{ backgroundColor: opt.color }} />}
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

                    {/* Lead */}
              <div className="relative">
                <button
                  onClick={() => setShowLeadDropdown(!showLeadDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5 border border-transparent hover:border-white/10"
                  style={{ color: colors.textSecondary }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {selectedLead ? 
                    (selectedLead.displayName || `${selectedLead.firstName} ${selectedLead.lastNamePaternal || ''}`) : 
                    'Lead'
                  }
                </button>
                {showLeadDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 mt-1 w-48 rounded-xl border shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto"
                    style={{ backgroundColor: isDark ? '#1E2329' : colors.bgPrimary, borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <button
                      onClick={() => { setLeadId(null); setShowLeadDropdown(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                      style={{ color: colors.textSecondary }}
                    >
                      Sin asignar
                    </button>
                    {users.map((user, index) => (
                      <button
                        key={user.id || `user-${index}`}
                        onClick={() => { setLeadId(user.id); setShowLeadDropdown(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors truncate"
                        style={{ color: leadId === user.id ? '#00D4B3' : colors.textPrimary }}
                      >
                        {user.displayName || `${user.firstName} ${user.lastNamePaternal || ''}` || user.email}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Start Date Custom Picker */}
              <CustomDatePicker 
                label="Inicio"
                value={startDate} 
                onChange={setStartDate} 
                isDark={isDark} 
                colors={colors}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                }
              />

              {/* Target Date Custom Picker */}
              <CustomDatePicker 
                label="Entrega"
                value={targetDate} 
                onChange={setTargetDate} 
                isDark={isDark} 
                colors={colors}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
              />

              {/* Labels */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5 border border-transparent hover:border-white/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                  placeholder="Nueva etiqueta..."
                  className="bg-transparent border-none outline-none text-sm w-24 placeholder-gray-500"
                  style={{ color: isDark ? '#E5E7EB' : '#374151' }}
                />
              </div>
            </div>

            {/* Labels Display */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4" data-project-labels>
                {labels.map(label => (
                  <span
                    key={label}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                    style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
                  >
                    {label}
                    <button onClick={() => removeLabel(label)} className="hover:opacity-70">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="relative group" data-project-description>
              <div data-project-section-head>
                <span>CONTEXTO</span>
                <strong>Objetivo y alcance</strong>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el objetivo, el alcance y los criterios de éxito..."
                className="w-full h-40 px-0 py-2 bg-transparent text-sm resize-none focus:outline-none placeholder-gray-600 leading-relaxed"
                style={{ 
                  color: isDark ? '#D1D5DB' : '#4B5563'
                }}
              />
            </div>

            {/* Milestones Section */}
            <div data-project-milestones className={`mt-4 rounded-xl border transition-all ${showMilestoneForm ? 'p-4 bg-gray-50/5 dark:bg-white/5' : 'p-0 border-transparent'}`}
                 style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }}>
              
              {/* List of added milestones */}
              {milestones.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2">Milestones ({milestones.length})</div>
                  {milestones.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-transparent" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                       <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-dashed opacity-50" />
                          <div>
                             <div className="text-sm font-medium">{m.name}</div>
                             {m.description && <div className="text-xs opacity-60 line-clamp-1">{m.description}</div>}
                          </div>
                       </div>
                       <button onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))} className="opacity-50 hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-500 rounded">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                       </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Toggle Button (only visible if form is hidden) */}
              {!showMilestoneForm && (
                 <button 
                  onClick={() => setShowMilestoneForm(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-dashed hover:bg-white/5 transition-colors group"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}
                 >
                     <span className="text-sm font-medium group-hover:opacity-100 transition-opacity opacity-70">Hitos del proyecto</span>
                  <div className="flex items-center gap-2 text-xs font-medium bg-white/5 px-2 py-1 rounded opacity-70 group-hover:opacity-100 transition-all">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                     Añadir hito
                  </div>
                 </button>
              )}

              {/* Creation Form */}
              {showMilestoneForm && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 mb-4">
                     <div className="p-1 rounded bg-[#00D4B3]/10 text-[#00D4B3]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                     </div>
                     <span className="text-sm font-bold">Nuevo hito</span>
                  </div>
                  
                  <div className="space-y-4">
                    <input
                      autoFocus
                      type="text"
                      className="w-full bg-transparent border-none outline-none text-sm font-medium placeholder-gray-500 p-0"
                      placeholder="Nombre del hito"
                      value={newMilestoneName}
                      onChange={(e) => setNewMilestoneName(e.target.value)}
                      style={{ color: isDark ? '#FFF' : '#000' }}
                    />
                    <textarea
                      className="w-full bg-transparent border-none outline-none text-sm opacity-80 placeholder-gray-500 p-0 resize-none h-20"
                      placeholder="Resultado esperado..."
                      value={newMilestoneDesc}
                      onChange={(e) => setNewMilestoneDesc(e.target.value)}
                      style={{ color: isDark ? '#EEE' : '#333' }}
                    />
                    
                    <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                       <button 
                         onClick={() => { setShowMilestoneForm(false); setNewMilestoneName(''); setNewMilestoneDesc(''); }}
                         className="px-3 py-1.5 text-xs font-medium rounded hover:bg-white/10 opacity-70 hover:opacity-100"
                       >
                         Cancelar
                       </button>
                       <button 
                         onClick={addMilestone}
                         disabled={!newMilestoneName.trim()}
                         className="px-3 py-1.5 text-xs font-medium rounded bg-[#6366F1] text-white hover:bg-[#5558DD] disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         Añadir hito
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Documentos adjuntos */}
            <div className="mt-6" data-project-documents>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                Contexto documental
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
                  </svg>
                  Conectar Google Drive para adjuntar documentos
                </button>
              ) : (
                <>
                <div className="flex items-center gap-2 mb-2">
                  <input ref={docFileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleDocFileUpload} />
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    disabled={docUploading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                    style={{ borderColor: colors.border, color: colors.textSecondary }}
                  >
                    {docUploading ? (
                      <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    )}
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDocUrlInput(!showDocUrlInput)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                    style={{
                      borderColor: showDocUrlInput ? '#3B82F6' : colors.border,
                      color: showDocUrlInput ? '#3B82F6' : colors.textSecondary,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocPickerOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Drive
                  </button>
                </div>

                {/* URL input */}
                <AnimatePresence>
                  {showDocUrlInput && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mb-2">
                      <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ backgroundColor: isDark ? '#0F1419' : '#F9FAFB', borderColor: colors.border }}>
                        <input
                          type="url"
                          value={docUrlValue}
                          onChange={(e) => { setDocUrlValue(e.target.value); setDocUrlError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleDocPasteUrl(); } }}
                          placeholder="URL de Google Docs, Sheets o Slides..."
                          className="flex-1 text-xs bg-transparent outline-none"
                          style={{ color: colors.textPrimary }}
                          autoFocus
                        />
                        <button onClick={handleDocPasteUrl} disabled={!docUrlValue.trim() || docLinkingUrl}
                          className="px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-medium disabled:opacity-50">
                          {docLinkingUrl ? '...' : 'Vincular'}
                        </button>
                        <button onClick={() => { setShowDocUrlInput(false); setDocUrlValue(''); setDocUrlError(''); }}
                          className="p-1 rounded-md" style={{ color: colors.textMuted }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                      {docUrlError && <p className="text-xs text-red-500 mt-1">{docUrlError}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Documentos pendientes */}
                {pendingDocuments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingDocuments.map((file) => (
                      <div
                        key={file.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
                        style={{ borderColor: colors.border, color: colors.textPrimary, backgroundColor: isDark ? '#0F1419' : '#F9FAFB' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#4285F4' }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button onClick={() => removePendingDoc(file.id)} className="p-0.5 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors" style={{ color: colors.textMuted }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                </>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                {error}
              </div>
            )}
          </div>

          {/* AI Analysis Progress/Result */}
          <AnimatePresence>
            {(aiAnalyzing || showAiResult) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-6 py-4 border-t"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }}
              >
                {aiAnalyzing && !showAiResult && (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-[#00D4B3]/30 border-t-[#00D4B3] rounded-full animate-spin" />
                    <div>
                      <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>{aiProgress}</p>
                      <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>Gemini está analizando los documentos para detectar tareas...</p>
                    </div>
                  </div>
                )}
                {showAiResult && aiResult && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" className="shrink-0">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <p className="text-sm font-medium" style={{ color: '#10B981' }}>
                        {aiResult.count} {aiResult.count === 1 ? 'tarea creada' : 'tareas creadas'} automáticamente
                      </p>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                      {aiResult.issues.slice(0, 10).map((issue, idx: number) => (
                        <div key={issue.issue_id || idx} className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: colors.textMuted }}>
                            {issue.identifier || `#${idx + 1}`}
                          </span>
                          <span className="truncate" style={{ color: colors.textPrimary }}>{issue.title}</span>
                          {issue.priority && (
                            <span className="ml-auto shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: issue.priority?.color || '#6B7280' }} />
                          )}
                          {issue.assignee && (
                            <span className="shrink-0 text-[10px]" style={{ color: colors.textMuted }}>
                              {issue.assignee.display_name || issue.assignee.first_name}
                            </span>
                          )}
                        </div>
                      ))}
                      {aiResult.issues.length > 10 && (
                        <p className="text-xs text-center py-1" style={{ color: colors.textMuted }}>
                          +{aiResult.issues.length - 10} tareas más
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => { onSuccess?.(); handleClose(); }}
                      className="w-full py-2 rounded-lg text-sm font-medium text-white bg-[#10B981] hover:bg-[#059669] transition-colors"
                    >
                      Listo
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          {!aiAnalyzing && !showAiResult && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 border-t"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }}
            data-modal-section="footer"
          >
            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: colors.textSecondary }}
            >
              Cancelar
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={loading || !projectName.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#0A2540',
                boxShadow: '0 4px 15px rgba(10, 37, 64, 0.3)'
              }}
            >
              {loading ? (aiAnalyzing ? 'Analizando...' : 'Creando...') : (pendingDocuments.length > 0 && teamId ? 'Crear proyecto + generar tareas' : 'Crear proyecto')}
            </motion.button>
          </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
    {/* Google Drive Picker */}
    <GoogleDrivePicker
      isOpen={docPickerOpen}
      onSelect={handleDocPickerSelect}
      onCancel={() => setDocPickerOpen(false)}
    />
    </>
  );
}
