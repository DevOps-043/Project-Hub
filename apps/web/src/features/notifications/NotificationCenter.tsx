'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/core/stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api/client';

interface Notification {
    notification_id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    category: string;
    is_read: boolean;
    created_at: string;
    link?: string;
}

export const NotificationCenter = () => {
    const { isDark } = useTheme();
    const { user } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const userId = user?.id;

    const COLORS = {
        bg: isDark ? '#1a1f25' : '#FFFFFF',
        border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        text: isDark ? '#FFFFFF' : '#111827',
        textMuted: isDark ? '#9CA3AF' : '#6B7280',
        hover: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        accent: '#00D4B3'
    };

    // Poll notifications
    useEffect(() => {
        if (!userId) return;

        const fetchNotifications = async () => {
            try {
                const { data, error } = await api.get<Notification[]>(`/api/notifications?userId=${userId}&limit=20`);
                if (!error && data) {
                    setNotifications(data);
                    setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
                }
            } catch (err) {
                console.error(err);
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [userId]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        await api.patch(`/api/notifications/${id}/read`);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <span className="text-green-500">✓</span>;
            case 'warning': return <span className="text-yellow-500">⚠</span>;
            case 'error': return <span className="text-red-500">!</span>;
            default: return <span className="text-blue-500">i</span>;
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#0F1419]" />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-2xl z-50"
                        style={{ 
                            background: COLORS.bg,
                            borderColor: COLORS.border
                        }}
                    >
                        <div className="p-3 border-b flex justify-between items-center sticky top-0 backdrop-blur-md" 
                             style={{ borderColor: COLORS.border, background: isDark ? 'rgba(26, 31, 37, 0.9)' : 'rgba(255, 255, 255, 0.9)' }}>
                            <h3 className="font-semibold text-sm" style={{ color: COLORS.text }}>Notificaciones</h3>
                            {unreadCount > 0 && <span className="text-xs bg-red-500 text-white px-1.5 rounded-full">{unreadCount}</span>}
                        </div>
                        
                        <div className="divide-y" style={{ borderColor: COLORS.border }}>
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-sm" style={{ color: COLORS.textMuted }}>
                                    No tienes notificaciones
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <div 
                                        key={notification.notification_id}
                                        className={`p-3 transition-colors relative group ${!notification.is_read ? 'bg-blue-500/5' : ''}`}
                                        style={{ color: COLORS.text }}
                                        onClick={() => !notification.is_read && markAsRead(notification.notification_id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className="mt-0.5">{getIcon(notification.type)}</div>
                                            <div className="flex-1">
                                                <p className={`text-sm ${!notification.is_read ? 'font-medium' : ''}`}>{notification.title}</p>
                                                {notification.message && (
                                                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: COLORS.textMuted }}>{notification.message}</p>
                                                )}
                                                <p className="text-[10px] mt-1.5 opacity-60">
                                                    {new Date(notification.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            {!notification.is_read && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
