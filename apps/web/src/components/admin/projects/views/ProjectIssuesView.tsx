
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';
import { 
    CheckCircle2, Circle, AlertCircle, Search, Filter, User, Plus
} from 'lucide-react';
import CreateIssueModal from '@/components/tasks/CreateIssueModal';

interface Issue {
    issue_id: string;
    issue_number: number;
    title: string;
    team_id: string;
    team: {
        team_id: string;
        slug: string;
        name: string;
    } | null;
    status: {
        name: string;
        color: string;
        status_type: string;
    };
    priority: {
        name: string;
        color: string;
        icon: string | null;
    } | null;
    assignee: {
        display_name: string;
        avatar_url: string;
        first_name: string;
    } | null;
    created_at: string;
}

export function ProjectIssuesView({ projectId, teamId, workspaceSlug }: { projectId: string; teamId?: string; workspaceSlug?: string }) {
    const { isDark } = useTheme();
    const colors = isDark ? {
        bg: '#1E2329',
        border: 'rgba(255,255,255,0.08)',
        text: '#FFF',
        textSec: '#9CA3AF',
        hover: 'rgba(255,255,255,0.03)'
    } : {
        bg: '#FFF',
        border: '#E5E7EB',
        text: '#111827',
        textSec: '#6B7280',
        hover: '#F9FAFB'
    };

    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        const fetchIssues = async () => {
            try {
                const res = await fetch(`/api/admin/projects/${projectId}/issues`);
                if (res.ok) {
                    const data = await res.json();
                    setIssues(data.issues || []);
                }
            } catch (error) {
                console.error('Error fetching issues:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchIssues();
    }, [projectId]);

    const getPriorityIcon = (p: Issue['priority']) => {
        if (!p) return <MoreHorizontal size={14} className="opacity-50" />;
        return (
             <div className="flex items-center gap-1.5" style={{ color: p.color }}>
                 <AlertCircle size={14} />
                 <span>{p.name}</span>
             </div>
        );
    };

    const filteredIssues = issues.filter(i => 
        i.title.toLowerCase().includes(search.toLowerCase()) || 
        i.issue_number.toString().includes(search)
    );

    // Build the URL for an issue - now points to project-scoped issue page
    const getIssueUrl = (issue: Issue) => {
        return `/admin/projects/${projectId}/issues/${issue.issue_id}`;
    };

    return (
        <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4 p-1">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                    <input 
                        type="text" 
                        placeholder="Filtrar issues..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 rounded-lg text-sm bg-transparent border outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                        style={{ borderColor: colors.border, color: colors.text }}
                    />
                </div>
                <button className="p-1.5 rounded-lg border hover:bg-white/5 transition-colors text-xs font-medium flex items-center gap-2" style={{ borderColor: colors.border, color: colors.textSec }}>
                    <Filter size={14} />
                    Vista
                </button>
                {teamId && (
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus size={14} />
                        Nuevo Issue
                    </button>
                )}
            </div>

            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 border-b text-xs font-medium uppercase tracking-wider opacity-60"
                 style={{ borderColor: colors.border, color: colors.textSec }}>
                <div className="w-16">ID</div>
                <div>Título</div>
                <div className="w-32">Estado</div>
                <div className="w-32">Asignado</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="text-center py-12 opacity-50">Cargando issues...</div>
                ) : filteredIssues.length > 0 ? (
                    <div className="divide-y" style={{ borderColor: colors.border }}>
                        {filteredIssues.map(issue => (
                            <Link
                                key={issue.issue_id}
                                href={getIssueUrl(issue)}
                            >
                                <motion.div 
                                    layoutId={issue.issue_id}
                                    className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center group cursor-pointer transition-colors hover:bg-white/5"
                                    style={{ backgroundColor: 'transparent' }}
                                    whileHover={{ backgroundColor: colors.hover }}
                                >
                                    <div className="w-16 text-xs font-mono opacity-50">
                                        #{issue.issue_number}
                                    </div>
                                    <div className="font-medium text-sm flex items-center gap-3">
                                        <div style={{ color: issue.status.color }}>
                                            {issue.status.status_type === 'done' || issue.status.status_type === 'completed' 
                                                ? <CheckCircle2 size={16} /> 
                                                : <Circle size={16} />
                                            }
                                        </div>
                                        <span style={{ color: colors.text }} className="group-hover:text-blue-400 transition-colors">{issue.title}</span>
                                        {issue.priority && (
                                            <div className="ml-2 scale-90 opacity-70">
                                               {getPriorityIcon(issue.priority)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-32">
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                                             style={{ 
                                                 borderColor: `${issue.status.color}30`,
                                                 backgroundColor: `${issue.status.color}10`,
                                                 color: issue.status.color 
                                             }}>
                                            {issue.status.name}
                                        </div>
                                    </div>
                                    <div className="w-32 flex items-center gap-2 text-sm opacity-70">
                                        {issue.assignee ? (
                                            <>
                                                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-[9px]">
                                                    {issue.assignee.first_name?.[0]}
                                                </div>
                                                <span className="truncate">{issue.assignee.first_name}</span>
                                            </>
                                        ) : (
                                            <span className="opacity-50 text-xs italic flex items-center gap-1">
                                                <User size={12} /> Sin asignar
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 opacity-50 text-sm">
                        No se encontraron issues con los filtros aplicados.
                    </div>
                )}
            </div>

            {teamId && (
                <CreateIssueModal 
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    teamId={teamId}
                    projectId={projectId}
                    workspaceSlug={workspaceSlug}
                    onIssueCreated={(issue) => {
                        setIssues(prev => [issue, ...prev]);
                    }}
                />
            )}
        </div>
    );
}

function MoreHorizontal({ size, className }: { size?: number, className?: string }) {
    return (
        <svg 
            width={size || 24} 
            height={size || 24} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
        </svg>
    );
}
