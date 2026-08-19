'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/core/stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveSession {
    session_id: string;
    task_name: string;
    end_time: string;
    start_time: string;
}

export default function FocusEnforcer() {
    const { user } = useAuthStore();
    const [session, setSession] = useState<ActiveSession | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);

    // 1. Poll for active sessions (Recursive with backoff)
    useEffect(() => {
        if (!user?.id) return;

        let timeoutId: NodeJS.Timeout;
        let isMounted = true;
        const controller = new AbortController();

        const checkFocus = async () => {
            try {
                const res = await fetch(`/api/focus?userId=${user.id}`, {
                    signal: controller.signal,
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        if (data.activeSession) {
                            const end = new Date(data.activeSession.end_time).getTime();
                            const now = new Date().getTime();
                            const diff = Math.floor((end - now) / 1000);
                            
                            if (diff > 0) {
                                setSession(data.activeSession);
                                setTimeLeft(diff);
                            } else {
                                setSession(null);
                            }
                        } else {
                            setSession(null);
                        }
                        // Normal interval: 10s
                        timeoutId = setTimeout(checkFocus, 10000);
                    }
                } else {
                    // API Error (e.g. 500 table missing): Backoff 60s
                    if (isMounted) timeoutId = setTimeout(checkFocus, 60000);
                }
            } catch (e) {
                // Ignore abort errors (component unmounted)
                if (e instanceof Error && e.name === 'AbortError') return;
                // Network Error: Backoff silently (120s)
                console.warn('[FocusEnforcer] Polling paused – retrying in 120s');
                if (isMounted) timeoutId = setTimeout(checkFocus, 120000);
            }
        };

        // Delay initial check by 3s to let the app fully load
        timeoutId = setTimeout(checkFocus, 3000);

        return () => {
            isMounted = false;
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [user?.id]);

    // 2. Countdown Timer
    useEffect(() => {
        if (!session || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    setSession(null); // Auto-close when done
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [session, timeLeft]);

    // Format time mm:ss
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!session) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center text-white"
            >
                {/* Warning Strip */}
                <div className="absolute top-0 w-full bg-[#00D4B3] text-black text-center py-2 font-bold uppercase tracking-widest text-sm animate-pulse">
                    ⚠️ Modo Enfoque Obligatorio Activo
                </div>

                <div className="text-center space-y-8 p-8 max-w-2xl w-full">
                    
                    <div className="space-y-4">
                        <h2 className="text-2xl font-light opacity-70">El equipo está enfocado en:</h2>
                        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                            {session.task_name || "Tarea Prioritaria"}
                        </h1>
                    </div>

                    {/* Timer Circle */}
                    <div className="relative w-80 h-80 mx-auto flex items-center justify-center">
                         <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="160" cy="160" r="140" stroke="#333" strokeWidth="4" fill="none" />
                            <circle 
                                cx="160" cy="160" r="140" 
                                stroke="#00D4B3" strokeWidth="4" fill="none" 
                                strokeDasharray={2 * Math.PI * 140}
                                strokeDashoffset={0} // Too complex to sync progress perfectly without start_time duration math, keeping full ring for enforced feel or could calculate
                                strokeLinecap="round"
                                className="animate-pulse"
                            />
                        </svg>
                        <div className="text-8xl font-mono font-bold tracking-tighter tabular-nums">
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    <p className="text-white/40 text-sm max-w-md mx-auto">
                        Esta pantalla se desbloqueará automáticamente cuando termine el temporizador.
                        No cierres la aplicación.
                    </p>

                    {/* Emergency Exit (Hidden or very subtle?) User asked for LOCK. But dev safety needs exit. */}
                    {/* Let's keep it strictly locked as requested. */}
                    
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
