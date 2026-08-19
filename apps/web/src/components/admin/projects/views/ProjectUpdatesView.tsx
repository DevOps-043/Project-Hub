
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/core/stores/authStore';
import { api } from '@/lib/api/client';
import {
    Send, CheckCircle, AlertCircle, XCircle, 
    MoreHorizontal, MessageSquare, Loader2
} from 'lucide-react';

interface Update {
    update_id: string;
    update_content: string;
    update_type: string;
    health_status_snapshot: string;
    created_at: string;
    author: {
        display_name: string;
        avatar_url: string;
        first_name: string;
        last_name_paternal: string;
    };
}

export function ProjectUpdatesView({ projectId }: { projectId: string }) {
    const { isDark } = useTheme();
    const { user } = useAuthStore();
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

    const [updates, setUpdates] = useState<Update[]>([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [health, setHealth] = useState<'on_track' | 'at_risk' | 'off_track'>('on_track');
    const [posting, setPosting] = useState(false);

    const fetchUpdates = useCallback(async () => {
        try {
            const { data, error } = await api.get<{ updates: Update[] }>(`/api/admin/projects/${projectId}/updates`);
            if (!error && data) {
                setUpdates(data.updates || []);
            }
        } catch (error) {
            console.error('Error fetching updates:', error);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchUpdates();
    }, [fetchUpdates]);

    const handlePost = async () => {
        if (!content.trim() || !user) return;
        setPosting(true);
        try {
            const { data, error } = await api.post<{ update: Update }>(`/api/admin/projects/${projectId}/updates`, {
                content,
                health_status: health,
                user_id: user.id
            });

            if (!error && data) {
                setUpdates([data.update, ...updates]);
                setContent('');
            }
        } catch (error) {
            console.error('Error posting update:', error);
        } finally {
            setPosting(false);
        }
    };

    const getHealthColor = (h: string) => {
        switch(h) {
            case 'on_track': return '#10B981';
            case 'at_risk': return '#F59E0B';
            case 'off_track': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getHealthLabel = (h: string) => {
        switch(h) {
            case 'on_track': return 'On track';
            case 'at_risk': return 'At risk';
            case 'off_track': return 'Off track';
            default: return 'No status';
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Input Area */}
            <div 
                className={`group rounded-2xl border p-1 shadow-lg transition-all duration-300 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:scale-[1.01]`}
                style={{ 
                    backgroundColor: isDark ? 'rgba(30, 35, 41, 0.7)' : '#FFF', 
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                    backdropFilter: 'blur(12px)'
                }}
            >
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-white/5">
                            {(['on_track', 'at_risk', 'off_track'] as const).map(h => (
                                <button
                                    key={h}
                                    onClick={() => setHealth(h)}
                                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-2 relative ${
                                        health === h ? 'shadow-sm translate-y-[-1px]' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100'
                                    }`}
                                    style={{ 
                                        backgroundColor: health === h ? getHealthColor(h) : 'transparent',
                                        color: health === h ? '#FFF' : colors.textSec
                                    }}
                                >
                                    {health === h && (
                                        <motion.div 
                                            layoutId="health-pill"
                                            className="absolute inset-0 rounded-lg -z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <div className={`w-2 h-2 rounded-full transition-transform ${health === h ? 'bg-white scale-125' : ''}`} 
                                         style={{ backgroundColor: health === h ? 'white' : getHealthColor(h) }} />
                                    {getHealthLabel(h)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Write a project update..."
                        className="w-full h-32 bg-transparent resize-none outline-none text-base placeholder:text-gray-500/50 leading-relaxed scrollbar-hide"
                        style={{ color: colors.text }}
                    />

                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/5">
                        <div className="text-[10px] uppercase tracking-wider font-bold opacity-30 px-1">
                            {content.length} characters
                        </div>
                        <button
                            onClick={handlePost}
                            disabled={!content.trim() || posting}
                            className="group/btn relative flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-all active:scale-95 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                            {posting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />}
                            <span>Post Update</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="space-y-8 relative pl-8 border-l" style={{ borderColor: colors.border }}>
                {loading ? (
                    <div className="text-center py-10 opacity-50">Loading updates...</div>
                ) : updates.map((update, idx) => (
                    <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={update.update_id} 
                        className="relative"
                    >
                        {/* Dot on timeline */}
                        <div className="absolute -left-[39px] top-6 w-5 h-5 rounded-full border-4 shadow-sm"
                             style={{ 
                                 borderColor: isDark ? '#111' : '#fff', // Background color for gap effect
                                 backgroundColor: getHealthColor(update.health_status_snapshot) 
                             }} 
                        />

                        <div className="mb-2 flex items-center gap-3">
                            <span className="text-xl font-bold" style={{ color: colors.text }}>
                                {format(new Date(update.created_at), 'MMMM', { locale: es })}
                            </span>
                            <span className="text-sm opacity-50">
                                {format(new Date(update.created_at), 'yyyy')}
                            </span>
                        </div>

                        <div className={`group p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${isDark ? 'bg-white/5' : 'bg-white'} shadow-sm`}
                             style={{ 
                                 borderColor: colors.border,
                                 backdropFilter: isDark ? 'blur(10px)' : 'none'
                             }}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm text-white font-bold shadow-lg ring-2 ring-white/10">
                                        {update.author.first_name?.[0]}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#1E2329] flex items-center justify-center bg-green-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-bold tracking-tight" style={{ color: colors.text }}>
                                        {update.author.display_name || update.author.first_name}
                                    </div>
                                    <div className="text-[11px] font-medium opacity-50 flex items-center gap-1 uppercase tracking-wider">
                                        <span>Update •</span>
                                        <span>{format(new Date(update.created_at), 'MMM d, p')}</span>
                                    </div>
                                </div>
                                <div className="ml-auto px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all group-hover:shadow-inner"
                                     style={{ 
                                         borderColor: `${getHealthColor(update.health_status_snapshot)}30`,
                                         color: getHealthColor(update.health_status_snapshot),
                                         backgroundColor: `${getHealthColor(update.health_status_snapshot)}10`
                                     }}>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getHealthColor(update.health_status_snapshot) }} />
                                    {getHealthLabel(update.health_status_snapshot)}
                                </div>
                            </div>
                            
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <div className="whitespace-pre-line leading-relaxed text-sm opacity-90" style={{ color: colors.text }}>
                                    {update.update_content}
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Edit</button>
                                <button className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity text-red-500">Delete</button>
                            </div>
                        </div>
                    </motion.div>
                ))}
                
                {!loading && updates.length === 0 && (
                     <div className="text-center py-12 opacity-50">
                        <MessageSquare className="mx-auto mb-2 opacity-50" />
                        <p>No updates yet.</p>
                     </div>
                )}
            </div>
        </div>
    );
}
