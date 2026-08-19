import React, { useState } from 'react';
import { 
    User, Users, Flag, Calendar, AlignLeft, 
    Type, Shield, Trash2, Save, Loader2,
    Settings, Briefcase, Tag, Palette, ChevronDown, Check,
    ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import DiagramGeneratorInline from '@/components/diagrams/DiagramGeneratorInline';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    format, addMonths, subMonths, startOfMonth, endOfMonth, 
    startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
    isSameDay, isToday, parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';

// --- Custom Components ---

interface Option {
    value: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}

function CustomSelect({ 
    label, 
    value, 
    options, 
    onChange, 
    icon: TriggerIcon,
    placeholder = "Select an option"
}: { 
    label: string; 
    value: string; 
    options: Option[]; 
    onChange: (val: string) => void;
    icon?: React.ReactNode;
    placeholder?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const { isDark } = useTheme();
    const accentColor = '#00D4B3';

    const selectedOption = options.find(o => o.value === value);

    const colors = isDark ? {
        bg: '#1E2329',
        border: 'rgba(255,255,255,0.08)',
        text: '#FFF',
        textSec: '#9CA3AF'
    } : {
        bg: '#FFF',
        border: '#E5E7EB',
        text: '#111827',
        textSec: '#6B7280'
    };

    return (
        <div className="space-y-1.5 relative w-full">
            <label className="text-xs font-semibold uppercase tracking-wider ml-1 opacity-50">
                {label}
            </label>
            
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3.5 rounded-xl border-2 flex items-center justify-between gap-3 transition-all duration-300 group"
                style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: isOpen ? accentColor : (value ? `${accentColor}40` : 'rgba(255,255,255,0.1)'),
                    color: colors.text
                }}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {TriggerIcon && <div className="text-white/30 group-hover:text-white/50 transition-colors shrink-0">{TriggerIcon}</div>}
                    <span className="text-sm font-medium truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                >
                    <ChevronDown size={18} style={{ color: colors.textSec }} />
                </motion.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                        
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 right-0 mt-2 rounded-2xl border-2 overflow-hidden shadow-2xl z-[70] backdrop-blur-xl"
                            style={{
                                backgroundColor: isDark ? '#1E2329' : '#FFFFFF',
                                borderColor: 'rgba(255,255,255,0.1)'
                            }}
                        >
                            <div className="max-h-60 overflow-y-auto overflow-x-hidden scrollbar-hidden">
                                {options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm transition-all flex items-center justify-between group hover:bg-white/5"
                                        style={{
                                            color: value === option.value ? accentColor : colors.text,
                                            backgroundColor: value === option.value ? 'rgba(0, 212, 179, 0.1)' : 'transparent'
                                        }}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium">{option.label}</span>
                                            {option.description && (
                                                <span className="text-[10px] opacity-40">{option.description}</span>
                                            )}
                                        </div>
                                        {value === option.value && (
                                            <Check size={16} className="text-[#00D4B3]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function CustomDatePicker({ 
    label, 
    value, 
    onChange, 
    placeholder = "Select date"
}: { 
    label: string; 
    value: string; 
    onChange: (date: string) => void;
    placeholder?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : new Date());
    const { isDark } = useTheme();
    const accentColor = '#00D4B3';
    const primaryColor = '#0A2540';

    const colors = isDark ? {
        bg: '#1E2329',
        text: '#FFF',
        textSec: '#9CA3AF'
    } : {
        bg: '#FFF',
        text: '#111827',
        textSec: '#6B7280'
    };

    // Calendar logic
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

    const handleDateClick = (date: Date) => {
        onChange(format(date, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    return (
        <div className="space-y-1.5 relative w-full">
            <label className="text-xs font-semibold uppercase tracking-wider ml-1 opacity-50">
                {label}
            </label>
            
            <div className="relative group">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-4 py-3.5 rounded-xl border-2 flex items-center justify-between gap-3 transition-all duration-300"
                    style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        borderColor: isOpen ? accentColor : (value ? `${accentColor}40` : 'rgba(255,255,255,0.1)'),
                        color: value ? colors.text : colors.textSec
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Calendar size={18} className={value ? 'text-[#00D4B3]' : 'opacity-30'} />
                        <span className="text-sm font-medium">
                            {value ? format(parseISO(value), 'PPP', { locale: es }) : placeholder}
                        </span>
                    </div>
                </button>

                {value && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onChange(''); }}
                        className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={14} className="text-red-400" />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                        
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="absolute top-full left-0 mt-2 p-4 rounded-2xl border-2 shadow-2xl z-[70] backdrop-blur-xl min-w-[320px]"
                            style={{
                                backgroundColor: isDark ? '#1E2329' : '#FFFFFF',
                                borderColor: 'rgba(255,255,255,0.1)'
                            }}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center mb-4">
                                <motion.button 
                                    whileHover={{ scale: 1.1, x: -2 }}
                                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                    className="p-1.5 rounded-lg hover:bg-white/5"
                                >
                                    <ChevronLeft size={18} />
                                </motion.button>
                                <span className="font-bold text-sm capitalize">
                                    {format(currentMonth, 'MMMM yyyy', { locale: es })}
                                </span>
                                <motion.button 
                                    whileHover={{ scale: 1.1, x: 2 }}
                                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                    className="p-1.5 rounded-lg hover:bg-white/5"
                                >
                                    <ChevronRight size={18} />
                                </motion.button>
                            </div>

                            {/* Week days */}
                            <div className="grid grid-cols-7 mb-2">
                                {weekDays.map(d => (
                                    <div key={d} className="text-center text-[10px] font-bold opacity-40 uppercase tracking-tighter">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((day, i) => {
                                    const isSel = value ? isSameDay(day, parseISO(value)) : false;
                                    const isCurrMonth = isSameMonth(day, monthStart);
                                    const isTod = isToday(day);

                                    return (
                                        <motion.button
                                            key={i}
                                            whileHover={!isSel ? { scale: 1.1 } : {}}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => handleDateClick(day)}
                                            className={`
                                                h-9 w-9 rounded-xl flex items-center justify-center text-xs transition-all relative
                                                ${!isCurrMonth ? 'opacity-20' : ''}
                                                ${isSel ? 'font-bold shadow-lg' : 'hover:bg-white/5'}
                                            `}
                                            style={{ 
                                                color: isSel ? '#FFFFFF' : colors.text,
                                                backgroundColor: isSel ? accentColor : (isTod && isCurrMonth ? `${accentColor}20` : 'transparent'),
                                                boxShadow: isSel ? `0 4px 15px ${accentColor}40` : 'none'
                                            }}
                                        >
                                            {format(day, 'd')}
                                            {isTod && isCurrMonth && !isSel && (
                                                <div className="absolute bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                                <button 
                                    onClick={() => { onChange(''); setIsOpen(false); }}
                                    className="text-xs font-medium opacity-50 hover:opacity-100 hover:bg-white/5 px-2 py-1 rounded"
                                >
                                    Limpiar
                                </button>
                                <button 
                                    onClick={() => { handleDateClick(new Date()); }}
                                    className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                                >
                                    Hoy
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function Section({ title, icon: Icon, isDark, borderColor, children }: { title: string, icon: React.ComponentType<{ size?: number; className?: string }>, isDark: boolean, borderColor: string, children: React.ReactNode }) {
    return (
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-white/5' : 'bg-white'} shadow-sm space-y-4`} style={{ borderColor }}>
            <div className="flex items-center gap-2 mb-2">
                <Icon size={18} className="text-blue-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-60">{title}</h3>
            </div>
            {children}
        </div>
    );
}

type ProjectSettingsField =
    | 'project_name'
    | 'project_description'
    | 'priority_level'
    | 'lead_user_id'
    | 'team_id'
    | 'start_date'
    | 'target_date';

interface ProjectSettingsUser {
    id?: string;
    user_id?: string;
    displayName?: string;
    display_name?: string;
    firstName?: string;
    lastNamePaternal?: string;
    first_name?: string;
    last_name_paternal?: string;
    email?: string;
    username?: string;
}

interface ProjectSettingsTeam {
    id?: string;
    team_id?: string;
    name?: string;
}

interface ProjectSettingsProject {
    project_name?: string;
    name?: string;
    project_description?: string | null;
    description?: string | null;
    priority_level?: string;
    priority?: string;
    lead_user_id?: string;
    lead?: { user_id?: string } | null;
    team_id?: string;
    team?: { team_id?: string } | null;
    start_date?: string | null;
    target_date?: string | null;
}

interface ProjectSettingsViewProps {
    project: ProjectSettingsProject;
    onUpdate: (field: ProjectSettingsField, value: string) => Promise<void>;
    users: ProjectSettingsUser[];
    teams: ProjectSettingsTeam[];
    saving: boolean;
}

export function ProjectSettingsView({ project, onUpdate, users, teams, saving }: ProjectSettingsViewProps) {
    const { isDark } = useTheme();
    const [localProject, setLocalProject] = useState({
        project_name: project.project_name || project.name || '',
        project_description: project.project_description || project.description || '',
        priority_level: project.priority_level || project.priority || 'medium',
        lead_user_id: project.lead_user_id || project.lead?.user_id || '',
        team_id: project.team_id || project.team?.team_id || '',
        start_date: project.start_date || '',
        target_date: project.target_date || ''
    });

    const colors = isDark ? {
        bg: '#1E2329',
        border: 'rgba(255,255,255,0.08)',
        text: '#FFF',
        textSec: '#9CA3AF'
    } : {
        bg: '#FFF',
        border: '#E5E7EB',
        text: '#111827',
        textSec: '#6B7280'
    };

    const handleChange = (field: ProjectSettingsField, value: string) => {
        setLocalProject(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (field: ProjectSettingsField) => {
        const value = localProject[field];
        if (value === project[field]) return;
        await onUpdate(field, value);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Settings className="text-blue-500" />
                        Project Settings
                    </h1>
                    <p className="text-sm opacity-50">Manage core details, leadership, and organization.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Information */}
                <Section title="Identity" icon={Type} isDark={isDark} borderColor={colors.border}>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium opacity-50">Project Name</label>
                            <input 
                                type="text"
                                value={localProject.project_name}
                                onChange={(e) => handleChange('project_name', e.target.value)}
                                onBlur={() => handleSave('project_name')}
                                className="w-full bg-black/10 dark:bg-white/5 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-blue-500/20 transition-all"
                                style={{ color: colors.text }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium opacity-50">Description</label>
                            <textarea
                                value={localProject.project_description}
                                onChange={(e) => handleChange('project_description', e.target.value)}
                                onBlur={() => handleSave('project_description')}
                                className="w-full h-32 bg-black/10 dark:bg-white/5 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-blue-500/20 transition-all resize-none"
                                style={{ color: colors.text }}
                            />
                            <div className="flex justify-end mt-1">
                                <DiagramGeneratorInline
                                    context={{
                                        type: 'project',
                                        title: localProject.project_name,
                                        description: localProject.project_description,
                                        priority: localProject.priority_level,
                                        teamName: teams.find((t) => t.team_id === localProject.team_id)?.name,
                                    }}
                                    onInsert={(code) => {
                                        const fence = `\n\`\`\`mermaid\n${code}\n\`\`\``;
                                        handleChange('project_description', (localProject.project_description || '') + fence);
                                        setTimeout(() => handleSave('project_description'), 0);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Leadership & Teams */}
                <Section title="Ownership" icon={Shield} isDark={isDark} borderColor={colors.border}>
                    <div className="space-y-4">
                        <CustomSelect
                            label="Project Lead"
                            value={localProject.lead_user_id}
                            options={[
                                { value: '', label: 'Unassigned' },
                                ...users.map((u, i) => ({
                                    value: u.id || u.user_id || '',
                                    label: u.displayName || u.display_name || 
                                           (u.firstName ? `${u.firstName} ${u.lastNamePaternal || ''}` : null) ||
                                           (u.first_name ? `${u.first_name} ${u.last_name_paternal || ''}` : null) ||
                                           u.email || u.username || `User ${i + 1}`
                                }))
                            ]}
                            onChange={(val) => {
                                handleChange('lead_user_id', val);
                                onUpdate('lead_user_id', val);
                            }}
                            icon={<User size={18} />}
                        />

                        <CustomSelect
                            label="Team"
                            value={localProject.team_id}
                            options={[
                                { value: '', label: 'No Team' },
                                ...teams.map((t, i) => ({
                                    value: t.id || t.team_id || '',
                                    label: t.name || `Team ${i + 1}`
                                }))
                            ]}
                            onChange={(val) => {
                                handleChange('team_id', val);
                                onUpdate('team_id', val);
                            }}
                            icon={<Users size={18} />}
                        />
                    </div>
                </Section>

                <Section title="Priority" icon={Flag} isDark={isDark} borderColor={colors.border}>
                    <CustomSelect
                        label="Priority Level"
                        value={localProject.priority_level || 'medium'}
                        options={[
                            { value: 'urgent', label: 'Urgent', description: 'Highest priority' },
                            { value: 'high', label: 'High', description: 'High priority' },
                            { value: 'medium', label: 'Medium', description: 'Standard priority' },
                            { value: 'low', label: 'Low', description: 'Low priority' },
                            { value: 'none', label: 'None', description: 'No priority' }
                        ]}
                        onChange={(val) => {
                            handleChange('priority_level', val);
                            onUpdate('priority_level', val);
                        }}
                        icon={<Flag size={18} />}
                    />
                </Section>

                {/* Timeline */}
                <Section title="Timeline" icon={Calendar} isDark={isDark} borderColor={colors.border}>
                    <div className="space-y-4">
                        <CustomDatePicker
                            label="Start Date"
                            value={localProject.start_date || ''}
                            onChange={(val) => {
                                handleChange('start_date', val);
                                onUpdate('start_date', val);
                            }}
                        />
                        <CustomDatePicker
                            label="Target Date"
                            value={localProject.target_date || ''}
                            onChange={(val) => {
                                handleChange('target_date', val);
                                onUpdate('target_date', val);
                            }}
                        />
                    </div>
                </Section>
            </div>

            {/* Danger Zone */}
            <div className={`mt-12 p-8 rounded-3xl border ${isDark ? 'bg-red-500/5' : 'bg-red-50'} space-y-4`} style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className="flex items-center gap-3 text-red-500">
                    <Trash2 size={24} />
                    <h3 className="text-xl font-bold">Danger Zone</h3>
                </div>
                <p className="text-sm opacity-60 max-w-2xl">
                    Archiving a project will remove it from the active list. This action can be undone by an administrator, but will affect current workflows and metrics.
                </p>
                <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 active:scale-95">
                    Archive Project
                </button>
            </div>

            {saving && (
                <div className="fixed bottom-8 right-8 px-6 py-3 rounded-2xl bg-blue-600 text-white shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="font-bold text-sm">Saving changes...</span>
                </div>
            )}
        </div>
    );
}
