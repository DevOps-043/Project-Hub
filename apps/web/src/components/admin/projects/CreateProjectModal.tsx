'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

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

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTeamId?: string;
  workspaceSlug?: string;
}

// ============================================
// CONSTANTS
// ============================================
const ICONS = [
  { name: 'folder', label: 'Folder' },
  { name: 'rocket', label: 'Rocket' },
  { name: 'target', label: 'Target' },
  { name: 'zap', label: 'Zap' },
  { name: 'code', label: 'Code' },
  { name: 'lightbulb', label: 'Lightbulb' },
];

const ICON_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', 
  '#F59E0B', '#10B981', '#06B6D4', '#00D4B3'
];

const PRIORITY_OPTIONS = [
  { value: 'none', label: 'Sin prioridad', icon: '···' },
  { value: 'low', label: 'Baja', color: '#6B7280' },
  { value: 'medium', label: 'Media', color: '#3B82F6' },
  { value: 'high', label: 'Alta', color: '#F59E0B' },
  { value: 'urgent', label: 'Urgente', color: '#EF4444' },
];

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planificación' },
  { value: 'active', label: 'Activo' },
  { value: 'active', label: 'Activo' },
  { value: 'on_hold', label: 'En pausa' },
];

const handleAddMilestone = (milestones: any[], setMilestones: any, name: string, desc: string, setName: any, setDesc: any, setForm: any) => {
  if (name.trim()) {
      setMilestones([...milestones, { name, description: desc }]);
      setName('');
      setDesc('');
      setForm(false);
  }
};

// ============================================
// ICON COMPONENTS
// ============================================
const IconSVGs: Record<string, React.ReactNode> = {
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  lightbulb: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>,
};

// ============================================
// CUSTOM DATE PICKER COMPONENT
// ============================================
interface CustomDatePickerProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  icon?: React.ReactNode;
  isDark: boolean;
  colors: any;
}

function CustomDatePicker({ label, value, onChange, icon, isDark, colors }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());

  // Reset calendar view when value changes
  useEffect(() => {
    if (value) setCurrentMonth(new Date(value));
  }, [value]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleDateClick = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation();
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  // Calendar generation logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weeks = [];
  let daysInWeek = [];
  let day = startDate;
  let formattedDate = "";

  const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  return (
    <div className="relative">
      <button 
        onClick={toggleOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 hover:bg-white/10 border border-transparent hover:border-white/10 w-full text-left"
        style={{ 
          color: value ? (isDark ? '#E5E7EB' : '#374151') : (isDark ? '#9CA3AF' : '#6B7280'),
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
        }}
      >
        {icon}
        <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
          {value ? format(new Date(value), 'dd MMM yyyy', { locale: es }) : label}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 p-4 rounded-xl shadow-2xl border z-50 w-[280px]"
            style={{ 
              backgroundColor: isDark ? '#1E2329' : '#FFFFFF', 
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold capitalize text-sm" style={{ color: colors.textPrimary }}>
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            </div>

            {/* Week days */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-center text-xs font-medium opacity-50 py-1" style={{ color: colors.textSecondary }}>
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
                    onClick={(e) => handleDateClick(e, dayItem)}
                    className={`
                      h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-colors relative
                      ${!isCurrentMonth ? 'opacity-30' : ''}
                      ${isSelected ? 'bg-blue-600 text-white font-bold shadow-lg' : 'hover:bg-white/10'}
                    `}
                    style={{ 
                      color: isSelected ? '#FFFFFF' : (isDark ? '#E5E7EB' : '#374151'),
                      backgroundColor: isSelected ? '#3B82F6' : undefined,
                      border: isTodayDate && !isSelected ? `1px solid ${colors.primary}` : 'none'
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
                onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                className="hover:underline opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: colors.textSecondary }}
              >
                Borrar
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onChange(format(new Date(), 'yyyy-MM-dd')); setIsOpen(false); }}
                className="font-medium hover:underline"
                style={{ color: '#3B82F6' }}
              >
                Hoy
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for closing */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export function CreateProjectModal({ isOpen, onClose, onSuccess, initialTeamId, workspaceSlug }: CreateProjectModalProps) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  // Form state
  const [projectName, setProjectName] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [priority, setPriority] = useState('none');
  const [status, setStatus] = useState('planning');
  const [leadId, setLeadId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  
  // Milestones State
  const [milestones, setMilestones] = useState<{name: string, description: string}[]>([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDesc, setNewMilestoneDesc] = useState('');
  
  // Initialize teamId if provided
  useEffect(() => {
    if (isOpen && initialTeamId) {
      setTeamId(initialTeamId);
    }
  }, [isOpen, initialTeamId]);
  
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

  // Fetch teams and users
  useEffect(() => {
    if (isOpen) {
      fetchTeams();
      fetchUsers();
    }
  }, [isOpen]);

  const fetchTeams = async () => {
    try {
      const url = workspaceSlug ? `/api/workspaces/${workspaceSlug}/teams?limit=50` : '/api/admin/teams';
      const token = localStorage.getItem('accessToken');
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const url = workspaceSlug ? `/api/workspaces/${workspaceSlug}/members` : '/api/admin/users';
      const token = localStorage.getItem('accessToken');
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

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
      const token = localStorage.getItem('accessToken');
      const res = await fetch(projectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
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
          target_date: targetDate || null,
          created_by_user_id: currentUserId,
          tags: labels,
          milestones: milestones // Add milestones to payload
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear proyecto');
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
    setStartDate('');
    setTargetDate('');
    setLabels([]);
    setMilestones([]);
    setShowMilestoneForm(false);
    setNewMilestoneName('');
    setNewMilestoneDesc('');
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 99999 }}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 backdrop-blur-sm"
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
          style={{ 
            backgroundColor: isDark ? '#161920' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }}>
            {/* Team Selector */}
            <div className="relative">
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

            <span style={{ color: colors.textMuted }}>/</span>
            <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>New project</span>

            {/* Close button */}
            <button
              onClick={handleClose}
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
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Icon Picker */}
            <div className="relative mb-4">
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
              placeholder="Project name"
              className="w-full text-3xl font-bold bg-transparent border-none outline-none mb-3 px-0 placeholder-gray-500"
              style={{ color: isDark ? '#FFFFFF' : '#111827' }}
            />

            {/* Summary */}
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Add a short summary..."
              className="w-full text-base bg-transparent border-none outline-none mb-8 px-0 placeholder-gray-500"
              style={{ color: isDark ? '#9CA3AF' : '#4B5563' }}
            />

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap gap-2 mb-6">
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
                label="Start Date" 
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
                label="Due Date" 
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
                  placeholder="Add label..."
                  className="bg-transparent border-none outline-none text-sm w-24 placeholder-gray-500"
                  style={{ color: isDark ? '#E5E7EB' : '#374151' }}
                />
              </div>
            </div>

            {/* Labels Display */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
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
            <div className="relative group">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a description..."
                className="w-full h-40 px-0 py-2 bg-transparent text-sm resize-none focus:outline-none placeholder-gray-600 leading-relaxed"
                style={{ 
                  color: isDark ? '#D1D5DB' : '#4B5563'
                }}
              />
            </div>

            {/* Milestones Section */}
            <div className={`mt-4 rounded-xl border transition-all ${showMilestoneForm ? 'p-4 bg-gray-50/5 dark:bg-white/5' : 'p-0 border-transparent'}`}
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
                  <span className="text-sm font-medium group-hover:opacity-100 transition-opacity opacity-70">Milestones</span>
                  <div className="flex items-center gap-2 text-xs font-medium bg-white/5 px-2 py-1 rounded text-opacity-70 group-hover:text-opacity-100 transition-all">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                     Add milestone
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
                     <span className="text-sm font-bold">New Milestone</span>
                  </div>
                  
                  <div className="space-y-4">
                    <input
                      autoFocus
                      type="text"
                      className="w-full bg-transparent border-none outline-none text-sm font-medium placeholder-gray-500 p-0"
                      placeholder="Milestone name"
                      value={newMilestoneName}
                      onChange={(e) => setNewMilestoneName(e.target.value)}
                      style={{ color: isDark ? '#FFF' : '#000' }}
                    />
                    <textarea
                      className="w-full bg-transparent border-none outline-none text-sm opacity-80 placeholder-gray-500 p-0 resize-none h-20"
                      placeholder="Add a description..."
                      value={newMilestoneDesc}
                      onChange={(e) => setNewMilestoneDesc(e.target.value)}
                      style={{ color: isDark ? '#EEE' : '#333' }}
                    />
                    
                    <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                       <button 
                         onClick={() => { setShowMilestoneForm(false); setNewMilestoneName(''); setNewMilestoneDesc(''); }}
                         className="px-3 py-1.5 text-xs font-medium rounded hover:bg-white/10 opacity-70 hover:opacity-100"
                       >
                         Cancel
                       </button>
                       <button 
                         onClick={() => handleAddMilestone(milestones, setMilestones, newMilestoneName, newMilestoneDesc, setNewMilestoneName, setNewMilestoneDesc, setShowMilestoneForm)}
                         disabled={!newMilestoneName.trim()}
                         className="px-3 py-1.5 text-xs font-medium rounded bg-[#6366F1] text-white hover:bg-[#5558DD] disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         Add milestone
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div 
            className="flex items-center justify-end gap-3 px-6 py-4 border-t"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }}
          >
            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: colors.textSecondary }}
            >
              Cancel
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
              {loading ? 'Creating...' : 'Create project'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
