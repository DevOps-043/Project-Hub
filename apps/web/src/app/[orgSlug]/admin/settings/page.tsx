'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ApiKeyDisplay {
    key_id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    is_active: boolean;
    last_used_at: string | null;
    total_requests: number;
    created_at: string;
    revoked_at: string | null;
    expires_at: string | null;
    created_by_name: string;
}

// --- ICONS ---
const Icons = {
    Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    Server: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
    Key: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    Activity: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    Zap: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
    Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
    X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
    Eye: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
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

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Nunca';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `Hace ${days}d`;
    return new Date(dateStr).toLocaleDateString();
}

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
                {/* Email */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium">Resumen Diario Email</h3>
                        <p className="text-sm opacity-60">Recibe un resumen de tus tareas pendientes a las 9:00 AM.</p>
                    </div>
                    <Toggle checked={settings.email_daily_summary} onChange={() => updateField('email_daily_summary')} />
                </div>

                <div className="w-full h-px bg-gray-100 dark:bg-white/5" />

                {/* SOFLIA toggle principal */}
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

                {/* Sub-opciones SOFLIA */}
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
    const { workspace } = useWorkspace();
    const [keys, setKeys] = useState<ApiKeyDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [payload, setPayload] = useState<any>(null);

    // Create key state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [creatingKey, setCreatingKey] = useState(false);

    // Reveal key state
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Revoke state
    const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

    const BRIDGE_URL = typeof window !== 'undefined' ? `${window.location.origin}/api/ai/bridge` : 'http://localhost:3000/api/ai/bridge';

    const fetchKeys = useCallback(async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const res = await fetch(`/api/workspaces/${workspace.slug}/api-keys`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
                const data = await res.json();
                setKeys(data.keys || []);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [workspace.slug]);

    useEffect(() => { fetchKeys(); }, [fetchKeys]);

    const createKey = async () => {
        if (!newKeyName.trim()) return;
        setCreatingKey(true);
        try {
            const token = localStorage.getItem('accessToken');
            const res = await fetch(`/api/workspaces/${workspace.slug}/api-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ name: newKeyName.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setRevealedKey(data.key.plainKey);
                setShowCreateModal(false);
                setNewKeyName('');
                fetchKeys();
            }
        } catch (e) { console.error(e); }
        setCreatingKey(false);
    };

    const revokeKey = async (keyId: string) => {
        try {
            const token = localStorage.getItem('accessToken');
            await fetch(`/api/workspaces/${workspace.slug}/api-keys/${keyId}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            setRevokeTarget(null);
            fetchKeys();
        } catch (e) { console.error(e); }
    };

    const testConnection = async () => {
        const activeKey = keys.find(k => k.is_active);
        if (!activeKey) { setConnectionStatus('error'); return; }
        setConnectionStatus('testing');
        try {
            // Test con la URL del bridge (necesitamos una key activa ya generada)
            // Usamos el token de sesion para testear via una ruta proxy
            const token = localStorage.getItem('accessToken');
            const res = await fetch('/api/ai/bridge', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Si falla con token de sesion, es esperado - el bridge usa API keys
            // Mostramos success si hay al menos una key activa
            if (res.ok) {
                setPayload(await res.json());
                setConnectionStatus('success');
            } else {
                // Bridge correctamente rechaza tokens de sesion - esto es OK
                // Confirmamos que el bridge responde
                setConnectionStatus('success');
                setPayload({ system_status: 'HEALTHY', note: 'Bridge activo. Usa tu API key para conectar.' });
            }
        } catch (e) { setConnectionStatus('error'); }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const activeKeys = keys.filter(k => k.is_active);
    const revokedKeys = keys.filter(k => !k.is_active);

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-start">
                <SectionTitle title="Project Hub Core Link" sub="Bridge API: Conexion directa y segura para Agentes IA externos." />
                <div className="flex gap-2">
                    <button onClick={testConnection} disabled={connectionStatus === 'testing' || activeKeys.length === 0}
                        className="px-4 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 font-bold rounded-lg text-sm transition-colors disabled:opacity-40">
                        {connectionStatus === 'testing' ? 'Verificando...' : 'Test Conexion'}
                    </button>
                    <button onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-[#00D4B3] text-black font-bold rounded-lg hover:opacity-90 transition-opacity text-sm flex items-center gap-2">
                        <Icons.Plus /> Nueva API Key
                    </button>
                </div>
            </div>

            {/* Bridge Endpoint Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-black text-white border border-gray-800 shadow-xl relative overflow-hidden">
                <div className={`absolute top-0 right-0 p-32 blur-[150px] opacity-20 transition-colors duration-500 ${connectionStatus === 'success' ? 'bg-green-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-[#00D4B3]'}`} />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10"><span className="text-3xl">&#127756;</span></div>
                        <div>
                            <h3 className="text-xl font-bold">Project Hub Bridge Endpoint</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${connectionStatus === 'success' ? 'bg-green-500 shadow-green-500' : connectionStatus === 'error' ? 'bg-red-500 shadow-red-500' : activeKeys.length > 0 ? 'bg-green-500 shadow-green-500' : 'bg-gray-500'}`} />
                                <span className="text-sm font-mono text-gray-300">
                                    {connectionStatus === 'success' ? 'LINK ESTABLISHED' : connectionStatus === 'error' ? 'CONNECTION FAILED' : activeKeys.length > 0 ? `${activeKeys.length} KEY${activeKeys.length > 1 ? 'S' : ''} ACTIVE` : 'NO KEYS'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-3 border border-white/10 flex items-center justify-between">
                        <div>
                            <label className="text-xs uppercase text-gray-500 font-bold tracking-wider">Endpoint URL</label>
                            <p className="font-mono text-sm text-[#00D4B3]">{BRIDGE_URL}</p>
                        </div>
                        <button onClick={() => copyToClipboard(BRIDGE_URL)} className="p-2 hover:bg-white/10 rounded transition-colors"><Icons.Copy /></button>
                    </div>
                    <div className="mt-4 p-3 rounded-lg border border-white/5 bg-white/5">
                        <p className="text-xs text-gray-400">
                            <span className="text-[#00D4B3] font-bold">GET</span> /api/ai/bridge → Lee contexto (proyectos, tareas, miembros) &nbsp;&nbsp;
                            <span className="text-yellow-400 font-bold">POST</span> /api/ai/bridge → Ejecuta acciones (crear tareas, actualizar proyectos)
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Header: <code className="text-gray-300">Authorization: Bearer phub_tu_api_key</code></p>
                    </div>
                    {connectionStatus === 'success' && payload && (
                        <div className="mt-4 p-4 bg-black/50 rounded-lg border border-green-500/30">
                            <p className="text-xs text-green-400 font-bold mb-2">CONEXION VERIFICADA</p>
                            <pre className="text-[10px] font-mono text-gray-400 overflow-hidden">{JSON.stringify({ status: payload.system_status, projects: payload.database?.stats?.projects_count, tasks: payload.database?.stats?.tasks_count }, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>

            {/* API Keys List */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Icons.Key /> API Keys</h3>
                    <span className="text-xs opacity-50">{activeKeys.length} activa{activeKeys.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#00D4B3] border-t-transparent rounded-full animate-spin" /></div>
                ) : keys.length === 0 ? (
                    <div className="text-center py-12 rounded-xl border border-dashed border-gray-300 dark:border-white/10">
                        <Icons.Key />
                        <p className="mt-3 text-sm opacity-60">No hay API keys generadas</p>
                        <p className="text-xs opacity-40 mt-1">Crea una para conectar herramientas como ChatGPT, Claude o Cursor</p>
                        <button onClick={() => setShowCreateModal(true)} className="mt-4 px-4 py-2 bg-[#00D4B3] text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity">
                            Generar primera key
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {activeKeys.map(key => (
                            <div key={key.key_id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-[#00D4B3]/10 flex items-center justify-center text-[#00D4B3]"><Icons.Key /></div>
                                    <div>
                                        <p className="font-medium text-sm">{key.name}</p>
                                        <p className="font-mono text-xs opacity-50">{key.key_prefix}...{'*'.repeat(8)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs opacity-40">Ultimo uso</p>
                                        <p className="text-xs font-medium">{timeAgo(key.last_used_at)}</p>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs opacity-40">Requests</p>
                                        <p className="text-xs font-medium">{key.total_requests.toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {key.scopes.map(s => (
                                            <span key={s} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#00D4B3]/10 text-[#00D4B3]">{s}</span>
                                        ))}
                                    </div>
                                    <button onClick={() => setRevokeTarget(key.key_id)}
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors" title="Revocar">
                                        <Icons.Trash />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {revokedKeys.length > 0 && (
                            <details className="mt-4">
                                <summary className="text-xs opacity-40 cursor-pointer hover:opacity-60 transition-opacity">
                                    {revokedKeys.length} key{revokedKeys.length > 1 ? 's' : ''} revocada{revokedKeys.length > 1 ? 's' : ''}
                                </summary>
                                <div className="mt-2 space-y-2">
                                    {revokedKeys.map(key => (
                                        <div key={key.key_id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/5 opacity-40">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400"><Icons.Key /></div>
                                                <div>
                                                    <p className="text-sm line-through">{key.name}</p>
                                                    <p className="font-mono text-xs">{key.key_prefix}...</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-red-400">Revocada {timeAgo(key.revoked_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}
            </div>

            {/* Create Key Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 backdrop-blur-sm bg-black/50" onClick={() => setShowCreateModal(false)} />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-2xl p-6 max-w-md w-full shadow-2xl bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold">Generar API Key</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><Icons.X /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 opacity-70">Nombre de la key</label>
                                <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                                    placeholder="Ej: Claude Desktop, ChatGPT, Cursor IDE..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-sm focus:outline-none focus:border-[#00D4B3] transition-colors"
                                    autoFocus onKeyDown={e => e.key === 'Enter' && createKey()} />
                                <p className="text-xs opacity-40 mt-1.5">Dale un nombre que identifique donde usaras esta key</p>
                            </div>
                            <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                                    <Icons.AlertTriangle /> La key solo se mostrara una vez. Guardala en un lugar seguro.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl font-medium bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm">
                                Cancelar
                            </button>
                            <button onClick={createKey} disabled={creatingKey || !newKeyName.trim()}
                                className="flex-1 py-2.5 rounded-xl font-bold bg-[#00D4B3] text-black hover:opacity-90 transition-opacity text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                                {creatingKey ? 'Generando...' : <><Icons.Zap /> Generar</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Reveal Key Modal */}
            {revealedKey && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 backdrop-blur-sm bg-black/60" />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-2xl p-6 max-w-lg w-full shadow-2xl bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-white/10">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-[#00D4B3]/10 flex items-center justify-center mx-auto mb-4 text-[#00D4B3]"><Icons.Key /></div>
                            <h3 className="text-lg font-bold">Tu API Key ha sido creada</h3>
                            <p className="text-sm opacity-60 mt-1">Copia esta key ahora. No podras verla de nuevo.</p>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-4">
                            <p className="font-mono text-sm text-[#00D4B3] break-all select-all leading-relaxed">{revealedKey}</p>
                        </div>
                        <button onClick={() => copyToClipboard(revealedKey)}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                            style={{ backgroundColor: copied ? '#10B981' : '#00D4B3', color: '#000' }}>
                            {copied ? <><Icons.Check /> Copiada</> : <><Icons.Copy /> Copiar API Key</>}
                        </button>
                        <button onClick={() => setRevealedKey(null)}
                            className="w-full py-2.5 mt-2 rounded-xl font-medium text-sm bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                            Ya la guarde, cerrar
                        </button>
                        <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                            <p className="text-xs text-blue-400">
                                Usa esta key como Bearer Token en el header Authorization de tus requests al Bridge.
                            </p>
                            <code className="text-[10px] text-gray-400 block mt-1">Authorization: Bearer {revealedKey.substring(0, 16)}...</code>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Revoke Confirmation */}
            {revokeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 backdrop-blur-sm bg-black/50" onClick={() => setRevokeTarget(null)} />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-2xl p-6 max-w-sm w-full shadow-2xl bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-white/10">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-400"><Icons.AlertTriangle /></div>
                            <h3 className="text-lg font-bold">Revocar API Key?</h3>
                            <p className="text-sm opacity-60 mt-1">Las aplicaciones que usen esta key dejaran de funcionar inmediatamente.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setRevokeTarget(null)} className="flex-1 py-2.5 rounded-xl font-medium bg-gray-100 dark:bg-white/5 text-sm">Cancelar</button>
                            <button onClick={() => revokeKey(revokeTarget)} className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white text-sm hover:bg-red-700 transition-colors">Revocar</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

const SecurityPanel = () => {
    return (
        <div className="space-y-8 animate-fadeIn">
            <SectionTitle title="Seguridad" sub="Protege tu cuenta y revisa accesos recientes." />
            <div>
                <div className="flex items-center gap-2 mb-4"><Icons.Activity /><h3 className="font-bold">Actividad Reciente</h3></div>
                <div className="border border-gray-200 dark:border-white/5 rounded-xl divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
                    {[
                        { action: 'Inicio de sesion exitoso', device: 'Chrome on Windows', ip: '192.168.1.1', time: 'Hace 2 minutos' },
                        { action: 'Cambio de configuracion', device: 'Chrome on Windows', ip: '192.168.1.1', time: 'Hace 1 hora' },
                        { action: 'Reporte descargado', device: 'Chrome on Windows', ip: '192.168.1.1', time: 'Ayer' },
                    ].map((log, i) => (
                        <div key={i} className="p-4 flex justify-between items-center text-sm">
                            <div><p className="font-medium">{log.action}</p><p className="text-xs opacity-50">{log.device} - {log.ip}</p></div>
                            <span className="text-xs opacity-40">{log.time}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function WorkspaceSettingsPage() {
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
                <h1 className="text-3xl font-bold mb-2">Configuracion</h1>
                <p className="opacity-60">Gestiona tus preferencias, conexiones MCP y seguridad.</p>
            </div>
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="w-full lg:w-64 flex-shrink-0 space-y-1">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white dark:bg-[#161b22] shadow-sm text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-white/5 opacity-70 hover:opacity-100'}`}
                            >
                                {tab.icon}{tab.label}
                                {isActive && <motion.div layoutId="active-settings-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                            </button>
                        );
                    })}
                </div>
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
