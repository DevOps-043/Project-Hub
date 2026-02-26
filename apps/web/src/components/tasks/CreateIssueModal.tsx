'use client';

import { useState, useEffect, useCallback, useRef, Children } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { Loader2, Plus, X } from 'lucide-react';
import { useGoogleConnection } from '@/shared/hooks/useGoogleConnection';
import { GoogleDrivePicker } from '@/components/google/GoogleDrivePicker';
import type { PickedFile } from '@/components/google/GoogleDrivePicker';
import { classifyGoogleFile, parseGoogleUrl, uploadFileToDrive } from '@/lib/google/document-utils';

// Types
interface Status {
  status_id: string;
  name: string;
  status_type: string;
  color: string;
  icon: string;
}

interface Priority {
  priority_id: string;
  name: string;
  level: number;
  color: string;
}

interface Label {
  label_id: string;
  name: string;
  color: string;
}

interface Member {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface Cycle {
  cycle_id: string;
  name: string;
  status: string;
}

interface Project {
  project_id: string;
  project_name: string;
}

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  projectId?: string;
  onIssueCreated: (issue: any) => void;
  initialStatus?: string;
  workspaceSlug?: string;
}

interface PendingDocument {
  file: PickedFile;
  source: 'picker' | 'upload' | 'url';
}

// Status Icon Component
const StatusIcon = ({ type, color, size = 16 }: { type: string; color: string; size?: number }) => {
  const style = { color };
  switch (type) {
    case 'backlog':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
          <circle cx="12" cy="12" r="10" strokeDasharray="4 4"/>
        </svg>
      );
    case 'todo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
    case 'in_progress':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'done':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'cancelled':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2"/>
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
  }
};

// Priority Icon Component
const PriorityIcon = ({ level, color, size = 16 }: { level: number; color: string; size?: number }) => {
  return (
    <div 
      className="rounded flex items-center justify-center"
      style={{ 
        width: size, 
        height: size, 
        backgroundColor: `${color}20`, 
        color 
      }}
    >
      {level === 0 && <span style={{ fontSize: size * 0.625 }}>—</span>}
      {level === 1 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>!</span>}
      {level === 2 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>↑</span>}
      {level === 3 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>=</span>}
      {level === 4 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>↓</span>}
    </div>
  );
};

// Estimation Options (0-10)
const ESTIMATE_OPTIONS = [
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

// Portal Dropdown Component
interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  children: React.ReactNode;
  isDark: boolean;
  colors: any;
  width?: number;
}

function PortalDropdown({ isOpen, onClose, triggerRef, children, isDark, colors, width = 200 }: PortalDropdownProps) {
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const dropdownHeight = 260; // Slightly more for safety
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldShowAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

        // Prevent horizontal overflow
        let left = rect.left;
        if (left + width > window.innerWidth) {
          left = window.innerWidth - width - 12; // 12px margin
        }
        if (left < 12) left = 12;

        setPosition({
          top: shouldShowAbove ? rect.top - 8 : rect.bottom + 4,
          left,
          placement: shouldShowAbove ? 'top' : 'bottom'
        });
      };

      updatePosition();
      // Use capture for scroll to catch it from any parent
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  const hasChildren = Children.count(children) > 0;

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 100000 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: position.placement === 'bottom' ? -10 : 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed py-1 rounded-xl border shadow-2xl overflow-y-auto max-h-[300px]"
        style={{ 
          zIndex: 100001,
          top: position.placement === 'top' ? undefined : position.top,
          bottom: position.placement === 'top' ? (window.innerHeight - position.top) : undefined,
          left: position.left,
          width: width,
          maxHeight: '220px',
          backgroundColor: isDark ? '#1E2329' : '#ffffff', 
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
        }}
      >
        {hasChildren ? children : (
          <div className="px-4 py-6 text-xs text-center flex flex-col items-center gap-2" style={{ color: colors.textMuted }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            No hay opciones disponibles
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );
}

// Portal Calendar Component
interface PortalCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  value: string;
  onChange: (date: string) => void;
  isDark: boolean;
  colors: any;
  accentColor: string;
}

function PortalCalendar({ isOpen, onClose, triggerRef, value, onChange, isDark, colors, accentColor }: PortalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' });

  useEffect(() => {
    if (value) setCurrentMonth(new Date(value));
  }, [value]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const calendarHeight = 340; 
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldShowAbove = spaceBelow < calendarHeight && rect.top > calendarHeight;

        setPosition({
          top: shouldShowAbove ? rect.top - 8 : rect.bottom + 4,
          left: rect.left,
          placement: shouldShowAbove ? 'top' : 'bottom'
        });
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, triggerRef]);

  const handleDateClick = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    onClose();
  };

  // Calendar generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 100000 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: position.placement === 'bottom' ? -10 : 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed p-4 rounded-xl border shadow-2xl"
        style={{ 
          zIndex: 100001,
          top: position.placement === 'top' ? undefined : position.top,
          bottom: position.placement === 'top' ? (window.innerHeight - position.top) : undefined,
          left: position.left,
          width: 280,
          backgroundColor: isDark ? '#1E2329' : '#ffffff', 
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold capitalize text-sm" style={{ color: colors.textPrimary }}>
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              type="button"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: colors.textMuted }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              type="button"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: colors.textMuted }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-medium py-1" style={{ color: colors.textMuted }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((dayItem, i) => {
            const isSelected = value ? isSameDay(dayItem, new Date(value)) : false;
            const isCurrentMonth = isSameMonth(dayItem, monthStart);
            const isTodayDate = isToday(dayItem);

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDateClick(dayItem)}
                className={`
                  h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all relative
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'font-bold shadow-lg' : 'hover:bg-white/10'}
                `}
                style={{ 
                  color: isSelected ? '#FFFFFF' : colors.textPrimary,
                  backgroundColor: isSelected ? accentColor : undefined,
                  border: isTodayDate && !isSelected ? `1px solid ${accentColor}` : 'none'
                }}
              >
                {format(dayItem, 'd')}
              </button>
            );
          })}
        </div>
        
        {/* Footer */}
        <div className="mt-4 pt-3 border-t flex justify-between text-xs" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
          <button 
            type="button"
            onClick={() => { onChange(''); onClose(); }}
            className="hover:underline opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: colors.textSecondary }}
          >
            Borrar
          </button>
          <button 
            type="button"
            onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); onClose(); }}
            className="font-medium hover:underline"
            style={{ color: accentColor }}
          >
            Hoy
          </button>
        </div>
      </motion.div>
    </>,
    document.body
  );
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
  const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
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

  // Fallback priorities if fetch fails
  const DEFAULT_PRIORITIES: Priority[] = [
    { priority_id: 'none', name: 'Sin prioridad', color: '#94a3b8', level: 0 },
    { priority_id: 'urgent', name: 'Urgente', color: '#ef4444', level: 1 },
    { priority_id: 'high', name: 'Alta', color: '#f97316', level: 2 },
    { priority_id: 'medium', name: 'Media', color: '#3b82f6', level: 3 },
    { priority_id: 'low', name: 'Baja', color: '#22c55e', level: 4 }
  ];

  // Fallback statuses if fetch fails or empty
  const DEFAULT_STATUSES: Status[] = [
    { status_id: 'backlog', name: 'Backlog', status_type: 'backlog', color: '#64748b', icon: '' },
    { status_id: 'todo', name: 'Por hacer', status_type: 'todo', color: '#3b82f6', icon: '' },
    { status_id: 'in_progress', name: 'En progreso', status_type: 'in_progress', color: '#f59e0b', icon: '' },
    { status_id: 'done', name: 'Hecho', status_type: 'done', color: '#10b981', icon: '' }
  ];

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
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const fetchHeaders: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      // 1. Fetch project documents and details if we have a projectId (independent of team)
      const targetProjectId = initialProjectId || projectId;
      if (targetProjectId && targetProjectId !== lastResolvedId.current) {
        console.log(`[CreateIssueModal] Fetching docs for project: ${targetProjectId}`);
        
        // Determinar URL base (Workspace o Admin)
        const projectApiBase = workspaceSlug 
          ? `/api/workspaces/${workspaceSlug}/projects/${targetProjectId}`
          : `/api/admin/projects/${targetProjectId}`;

        // Paralelo: documentos y el proyecto específico
        const [docRes, pInfoRes] = await Promise.all([
          fetch(`${projectApiBase}/documents`, { headers: fetchHeaders }).catch(() => null),
          fetch(projectApiBase, { headers: fetchHeaders }).catch(() => null)
        ]);

        if (docRes?.ok) {
          const data = await docRes.json();
          console.log(`[CreateIssueModal] Found ${data.documents?.length || 0} docs for project ${targetProjectId}`);
          setProjectDocuments(data.documents || []);
        }

        if (pInfoRes?.ok) {
          const data = await pInfoRes.json();
          if (data.project) {
             const proj = data.project;
             setProjects(prev => prev.some(p => p.project_id === proj.project_id) ? prev : [...prev, proj]);
             
             // Si el ID que tenemos es un slug/key, lo actualizamos al UUID real
             // Pero sin disparar un re-fetch infinito
             if (targetProjectId !== proj.project_id) {
               console.log(`[CreateIssueModal] Project key ${targetProjectId} resolved to UUID ${proj.project_id}`);
               lastResolvedId.current = proj.project_id;
               setProjectId(proj.project_id);
             }
          }
        }
      }

      // 2. Fetch team-specific data if we have a teamId
      if (teamId) {
        console.log(`[CreateIssueModal] Fetching team data for: ${teamId}`);
        
        const [statusRes, priorityRes, labelRes, memberRes, cycleRes, projectRes] = await Promise.all([
          fetch(`/api/admin/teams/${teamId}/statuses`, { headers: fetchHeaders }).catch(err => { console.error('Status fetch error:', err); return null; }),
          fetch(`/api/admin/priorities`, { headers: fetchHeaders }).catch(err => { console.error('Priority fetch error:', err); return null; }),
          fetch(`/api/admin/teams/${teamId}/labels`, { headers: fetchHeaders }).catch(err => { console.error('Label fetch error:', err); return null; }),
          fetch(`/api/admin/teams/${teamId}/members`, { headers: fetchHeaders }).catch(err => { console.error('Member fetch error:', err); return null; }),
          fetch(`/api/admin/teams/${teamId}/cycles`, { headers: fetchHeaders }).catch(err => { console.error('Cycle fetch error:', err); return null; }),
          fetch(`/api/admin/projects?team_id=${teamId}`, { headers: fetchHeaders }).catch(err => { console.error('Project fetch error:', err); return null; })
        ]);

        if (statusRes && statusRes.ok) {
          const data = await statusRes.json();
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

        if (priorityRes && priorityRes.ok) {
          const data = await priorityRes.json();
          const fetchedPriorities = data.priorities || [];
          setPriorities(fetchedPriorities.length > 0 ? fetchedPriorities : DEFAULT_PRIORITIES);
          
          if (!priorityId) {
            const list = fetchedPriorities.length > 0 ? fetchedPriorities : DEFAULT_PRIORITIES;
            const medium = list.find((p: Priority) => p.name.toLowerCase().includes('media') || p.level === 3);
            setPriorityId(medium?.priority_id || list[0]?.priority_id || '');
          }
        }

        if (labelRes && labelRes.ok) {
          const data = await labelRes.json();
          setLabels(data.labels || []);
        }

        if (memberRes && memberRes.ok) {
          const data = await memberRes.json();
          setMembers(data.members || []);
        }

        if (cycleRes && cycleRes.ok) {
          const data = await cycleRes.json();
          setCycles(data.cycles || []);
        }

        if (projectRes && projectRes.ok) {
          const data = await projectRes.json();
          setProjects(prev => {
            const fetched = data.projects || [];
             // Combinar con los existentes sin duplicados
             const combined = [...prev];
             fetched.forEach((fp: any) => {
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
  }, [teamId, initialStatus, initialProjectId, projectId]);

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
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/teams/${teamId}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status_id: statusId || null,
          priority_id: priorityId || null,
          assignee_id: assigneeId || null,
          project_id: projectId || null,
          cycle_id: cycleId || null,
          due_date: dueDate || null,
          estimate_points: estimatePoints ? parseInt(estimatePoints) : null,
          labels: selectedLabels
        })
      });

      if (res.ok) {
        const data = await res.json();

        // Vincular documentos pendientes a la issue creada
        if (pendingDocuments.length > 0 && data.issue?.issue_id) {
          const docApiBase = workspaceSlug
            ? `/api/workspaces/${workspaceSlug}/teams/${teamId}/issues/${data.issue.issue_id}/documents`
            : `/api/admin/teams/${teamId}/issues/${data.issue.issue_id}/documents`;

          for (const pending of pendingDocuments) {
            const { provider, docType } = classifyGoogleFile(pending.file.mimeType);
            try {
              await fetch(docApiBase, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  name: pending.file.name,
                  provider,
                  external_id: pending.file.id,
                  external_url: pending.file.url,
                  doc_type: docType,
                  mime_type: pending.file.mimeType,
                  thumbnail_url: pending.file.iconUrl || null,
                }),
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
              await fetch(docApiBase, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  name: projectDoc.name,
                  provider: projectDoc.provider || 'google',
                  external_id: projectDoc.external_id,
                  external_url: projectDoc.external_url,
                  doc_type: projectDoc.doc_type,
                  mime_type: projectDoc.mime_type,
                  thumbnail_url: projectDoc.thumbnail_url || null,
                }),
              });
            } catch (docError) {
              console.error('Error vinculando documento de proyecto:', docError);
            }
          }
        }

        onIssueCreated(data.issue);
        handleClose();
      }
    } catch (error) {
      console.error('Error creating issue:', error);
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
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    try {
      const tokenFromStorage = localStorage.getItem('accessToken');
      const tokenRes = await fetch('/api/auth/google/token', {
        headers: tokenFromStorage ? { Authorization: `Bearer ${tokenFromStorage}` } : {},
      });
      if (!tokenRes.ok) { alert('No se pudo acceder a Google. Reconecta tu cuenta.'); return; }
      const { accessToken } = await tokenRes.json();
      const uploaded = await uploadFileToDrive(file, accessToken);
      if (!uploaded) { alert('Error al subir el archivo a Drive.'); return; }
      const pickedFile: PickedFile = {
        id: uploaded.id,
        name: uploaded.name,
        url: uploaded.webViewLink,
        mimeType: uploaded.mimeType,
      };
      setPendingDocuments((prev) => [...prev, { file: pickedFile, source: 'upload' }]);
    } catch (err) {
      console.error('Error subiendo archivo:', err);
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
        const tokenFromStorage = localStorage.getItem('accessToken');
        const tokenRes = await fetch('/api/auth/google/token', {
          headers: tokenFromStorage ? { Authorization: `Bearer ${tokenFromStorage}` } : {},
        });
        if (tokenRes.ok) {
          const { accessToken } = await tokenRes.json();
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
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-sm"
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
            style={{ 
              backgroundColor: isDark ? '#1a1f25' : '#ffffff',
              height: 'min(600px, 85vh)',
              maxHeight: 'calc(100vh - 40px)',
              marginTop: 'auto',
              marginBottom: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row w-full h-full overflow-hidden">
              {/* Left Panel - Preview */}
              <div 
                className="w-full md:w-72 p-6 border-b md:border-b-0 md:border-r flex flex-col shrink-0 overflow-y-auto"
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
                  Nueva Tarea
                </h3>
                <p className="text-xs text-center mb-6" style={{ color: colors.textMuted }}>
                  Vista previa
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
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: colors.border, backgroundColor: isDark ? 'rgba(26, 31, 37, 0.8)' : 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      Detalles de la tarea
                    </h2>
                    <p className="text-xs" style={{ color: colors.textMuted }}>
                      Completa la información necesaria
                    </p>
                  </div>
                  <button 
                    onClick={handleClose}
                    className="p-2 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: colors.textMuted }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hidden">
                  <div className="p-6">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                      </div>
                    ) : (
                    <div className="space-y-4">
                      {/* Title */}
                      <div>
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
                      <div>
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
                      <div className="grid grid-cols-2 gap-3">
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
                        <div>
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
                        <div>
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
                                  <div className="p-2 rounded-lg bg-white/5 flex-shrink-0">
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
                      <div>
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
                              <input ref={docFileInputRef} type="file" className="hidden" onChange={handleDocFileUpload} />
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
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0 mt-auto" style={{ borderColor: colors.border, backgroundColor: isDark ? 'rgba(26, 31, 37, 0.8)' : 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)' }}>
                <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-white/5" style={{ color: colors.textSecondary }}>Cancelar</button>
                <button onClick={handleCreate} disabled={creating || !title.trim()}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, boxShadow: `0 4px 15px ${primaryColor}40` }}>
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
