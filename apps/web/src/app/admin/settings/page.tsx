'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

// --- ICONS ---
const Icons = {
    Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    Link: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    Server: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
    Key: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    Activity: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    CheckCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    Terminal: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
    Zap: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
};

// --- COMPONENTS ---

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <button 
        onClick={onChange}
        className={`w-12 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-zinc-700'}`}
    >
        <motion.div 
            layout 
            className="w-4 h-4 rounded-full bg-white shadow-sm"
            animate={{ x: checked ? 24 : 0 }}
        />
    </button>
);

const SectionTitle = ({ title, sub }: { title: string, sub: string }) => (
    <div className="mb-6">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm opacity-60">{sub}</p>
    </div>
);

// --- PANELS ---

const NotificationsPanel = () => {
    const [settings, setSettings] = useState({
        email_daily_summary: true,
        soflia_enabled: false,
        soflia_issues: true,
        soflia_projects: true,
        soflia_team_updates: true,
        soflia_mentions: true,
        soflia_reminders: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/notifications/preferences')
            .then(r => r.json())
            .then(data => {
                if (data.preferences) {
                    setSettings(prev => ({ ...prev, ...data.preferences }));
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const updateField = async (field: keyof typeof settings) => {
        const newValue = !settings[field];
        setSettings(prev => ({ ...prev, [field]: newValue }));
        setSaving(true);
        try {
            await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: newValue }),
            });
        } catch {
            setSettings(prev => ({ ...prev, [field]: !newValue }));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-fadeIn">
                <SectionTitle title="Notificaciones" sub="Elige que alertas quieres recibir." />
                <div className="flex items-center justify-center py-12 opacity-50">Cargando preferencias...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <SectionTitle title="Notificaciones" sub="Elige que alertas quieres recibir." />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium">Resumen Diario Email</h3>
                        <p className="text-sm opacity-60">Recibe un resumen de tus tareas pendientes a las 9:00 AM.</p>
                    </div>
                    <Toggle checked={settings.email_daily_summary} onChange={() => updateField('email_daily_summary')} />
                </div>
                <div className="w-full h-px bg-gray-100 dark:bg-white/5" />

                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium">Notificaciones con SOFLIA</h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">SOFLIA</span>
                        </div>
                        <p className="text-sm opacity-60">Permite que SOFLIA te notifique sobre cambios en issues, proyectos, actualizaciones del equipo y mas.</p>
                    </div>
                    <Toggle checked={settings.soflia_enabled} onChange={() => updateField('soflia_enabled')} />
                </div>

                {settings.soflia_enabled && (
                    <div className="ml-6 pl-4 border-l-2 border-purple-200 dark:border-purple-500/30 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Tipos de notificacion</p>
                        {([
                            { key: 'soflia_issues' as const, label: 'Issues y Tareas', desc: 'Cambios de estado, asignaciones, comentarios en tus tareas.' },
                            { key: 'soflia_projects' as const, label: 'Proyectos', desc: 'Actualizaciones de progreso, hitos y cambios en proyectos.' },
                            { key: 'soflia_team_updates' as const, label: 'Equipo', desc: 'Nuevos miembros, cambios de rol y actividad del equipo.' },
                            { key: 'soflia_mentions' as const, label: 'Menciones', desc: 'Cuando alguien te menciona en un comentario o tarea.' },
                            { key: 'soflia_reminders' as const, label: 'Recordatorios', desc: 'Fechas limite proximas y tareas pendientes.' },
                        ]).map(item => (
                            <div key={item.key} className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium">{item.label}</h4>
                                    <p className="text-xs opacity-50">{item.desc}</p>
                                </div>
                                <Toggle checked={settings[item.key]} onChange={() => updateField(item.key)} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {saving && <p className="text-xs text-blue-500 animate-pulse">Guardando...</p>}
        </div>
    );
};



const MCPServersPanel = () => {
    const BRIDGE_URL = typeof window !== 'undefined' ? `${window.location.origin}/api/ai/bridge` : 'http://localhost:3000/api/ai/bridge';

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copiado al portapapeles');
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            <SectionTitle title="Project Hub Core Link" sub="Bridge API: Conexion directa y segura para Agentes IA externos." />

            <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-black text-white border border-gray-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 blur-[150px] opacity-20 bg-[#00D4B3]" />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10"><span className="text-3xl">&#127756;</span></div>
                        <div>
                            <h3 className="text-xl font-bold">Project Hub Bridge Endpoint</h3>
                            <p className="text-sm text-gray-400 mt-1">API para conectar herramientas IA externas</p>
                        </div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-3 border border-white/10 flex items-center justify-between">
                        <div>
                            <label className="text-xs uppercase text-gray-500 font-bold tracking-wider">Endpoint URL</label>
                            <p className="font-mono text-sm text-[#00D4B3]">{BRIDGE_URL}</p>
                        </div>
                        <button onClick={() => copyToClipboard(BRIDGE_URL)} className="p-2 hover:bg-white/10 rounded transition-colors">
                            <Icons.Server />
                        </button>
                    </div>
                    <div className="mt-4 p-3 rounded-lg border border-white/5 bg-white/5">
                        <p className="text-xs text-gray-400">
                            <span className="text-[#00D4B3] font-bold">GET</span> → Lee contexto (proyectos, tareas, miembros) &nbsp;&nbsp;
                            <span className="text-yellow-400 font-bold">POST</span> → Ejecuta acciones (crear tareas, actualizar proyectos)
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Header: <code className="text-gray-300">Authorization: Bearer phub_tu_api_key</code></p>
                    </div>
                </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 text-sm">
                <p className="font-bold text-blue-800 dark:text-blue-200 mb-2">Gestion de API Keys</p>
                <p className="text-blue-700 dark:text-blue-300 mb-3">
                    Las API keys se generan y administran desde la configuracion de cada workspace.
                    Cada key esta asociada a un workspace especifico para aislar el acceso a datos.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li>Ve a tu <b>Workspace &rarr; Configuracion &rarr; Project Hub Core Link</b></li>
                    <li>Genera una nueva API Key con un nombre descriptivo</li>
                    <li>Copia la key (solo se muestra una vez)</li>
                    <li>Configura tu agente con <code>Authorization: Bearer phub_...</code></li>
                </ol>
            </div>
        </div>
    );
};

const SecurityPanel = () => {
    return (
        <div className="space-y-8 animate-fadeIn">
            <SectionTitle title="Seguridad" sub="Protege tu cuenta y revisa accesos recientes." />
            


            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Icons.Activity />
                    <h3 className="font-bold">Actividad Reciente</h3>
                </div>
                <div className="border border-gray-200 dark:border-white/5 rounded-xl divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
                    {[
                        { action: 'Inicio de sesión exitoso', device: 'Chrome on Windows', ip: '192.168.1.1', time: 'Hace 2 minutos' },
                        { action: 'Cambio de configuración', device: 'Chrome on Windows', ip: '192.168.1.1', time: 'Hace 1 hora' },
                        { action: 'Reporte descargado', device: 'Chrome on Windows', ip: '192.168.1.1', time: 'Ayer' },
                    ].map((log, i) => (
                        <div key={i} className="p-4 flex justify-between items-center text-sm">
                            <div>
                                <p className="font-medium">{log.action}</p>
                                <p className="text-xs opacity-50">{log.device} • {log.ip}</p>
                            </div>
                            <span className="text-xs opacity-40">{log.time}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('notifications');
    const { isDark } = useTheme();

    const tabs = [
        { id: 'notifications', label: 'Notificaciones', icon: <Icons.Bell /> },

        { id: 'mcp', label: 'Project Hub Core Link (MCP)', icon: <Icons.Server /> },
        { id: 'security', label: 'Seguridad', icon: <Icons.Shield /> },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Configuración</h1>
                <p className="opacity-60">Gestiona tus preferencias, conexiones MCP y seguridad.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* SIDEBAR TABS */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-1">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    isActive 
                                    ? 'bg-white dark:bg-[#161b22] shadow-sm text-blue-600 dark:text-blue-400' 
                                    : 'hover:bg-gray-100 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {isActive && <motion.div layoutId="active-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                            </button>
                        );
                    })}
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm p-8 min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {activeTab === 'notifications' && <NotificationsPanel key="notif" />}

                        {activeTab === 'mcp' && <MCPServersPanel key="mcp" />}
                        {activeTab === 'security' && <SecurityPanel key="security" />}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
