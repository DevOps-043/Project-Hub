'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuthStore } from '@/core/stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import mermaid from 'mermaid';

// --- ICONS ---
const Icons = {
    Timer: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ),
    Compass: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
    ),
    Architecture: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    ),
};

// --- 1. FOCUS FLOW ---
const FocusTimer = ({ userId }: { userId?: string }) => {
    const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [taskName, setTaskName] = useState('');
    const [completedSessions, setCompletedSessions] = useState(0);
    const { isDark } = useTheme();

    const MODES = {
        focus: { min: 25, label: 'Enfoque Profundo', color: '#00D4B3' },
        short: { min: 5, label: 'Descanso Corto', color: '#3B82F6' },
        long: { min: 15, label: 'Descanso Largo', color: '#8B5CF6' }
    };

    const handleStart = async () => {
        if (!isActive) {
            setIsActive(true);
        } else {
            setIsActive(false);
        }
    };

    const playBeep = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.1;
            osc.start();
            setTimeout(() => osc.stop(), 500);
        } catch(e) {}
    };

    const changeMode = (m: 'focus' | 'short' | 'long') => {
        setMode(m);
        setTimeLeft(MODES[m].min * 60);
        setIsActive(false);
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(t => t - 1);
                document.title = `${Math.floor((timeLeft - 1) / 60)}:${((timeLeft - 1) % 60).toString().padStart(2, '0')} - Focus`;
            }, 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            playBeep();
            if (mode === 'focus') setCompletedSessions(s => s + 1);
        }
        return () => { clearInterval(interval); document.title = "Project Hub"; };
    }, [isActive, timeLeft, mode]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = 1 - (timeLeft / (MODES[mode].min * 60));

    return (
        <div className="flex flex-col items-center py-2 px-4 w-full h-full">
            <input
                type="text"
                placeholder="¿En qué trabajas?"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="w-full max-w-md text-center bg-transparent border-b-2 border-transparent focus:border-gray-300 dark:focus:border-gray-700 outline-none text-xl py-2 mb-8 transition-colors placeholder-gray-400"
                style={{ color: isDark ? '#fff' : '#000' }}
            />
            <div className="relative w-72 h-72 flex items-center justify-center mb-10">
                {isActive && <div className="absolute inset-0 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: MODES[mode].color }}></div>}
                <svg className="absolute inset-0 w-full h-full -rotate-90 text-gray-100 dark:text-gray-800"><circle cx="144" cy="144" r="130" stroke="currentColor" strokeWidth="6" fill="none" /></svg>
                <svg className="absolute inset-0 w-full h-full -rotate-90"><circle cx="144" cy="144" r="130" stroke={MODES[mode].color} strokeWidth="6" fill="none" strokeDasharray={2 * Math.PI * 130} strokeDashoffset={2 * Math.PI * 130 * (1 - progress)} strokeLinecap="round" className="transition-all duration-1000 ease-linear" /></svg>
                <div className="flex flex-col items-center z-10">
                    <div className="text-7xl font-mono font-bold tracking-tighter tabular-nums" style={{ color: isDark ? '#fff' : '#111' }}>{formatTime(timeLeft)}</div>
                    <span className="text-sm font-medium uppercase tracking-widest mt-2 opacity-60">{isActive ? 'En Curso' : 'Pausado'}</span>
                </div>
            </div>
            <div className="flex gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-zinc-800/50 mb-8 border border-gray-200 dark:border-white/5">
                {(Object.keys(MODES) as Array<keyof typeof MODES>).map(m => (
                    <button key={m} onClick={() => changeMode(m)} className={`px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all ${mode === m ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>{MODES[m].label}</button>
                ))}
            </div>
            <div className="flex items-center gap-6">
                <button onClick={() => changeMode(mode)} className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-gray-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
                <button onClick={handleStart} className="px-10 py-4 rounded-full font-bold text-lg text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform active:scale-95 transition-all flex items-center gap-2" style={{ backgroundColor: MODES[mode].color }}>
                    {isActive ? 'Pausar' : 'Iniciar'}
                </button>
            </div>
        </div>
    );
};

// --- 2. AGILE ADVISOR ---
const AgileAdvisor = () => {
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };
    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });
    };
    const analyzeProject = async () => {
        if (!input.trim() && !selectedFile) return;
        setAnalyzing(true);
        setResult(null);
        try {
            let fileData = null, mimeType = null;
            if (selectedFile) { fileData = await convertToBase64(selectedFile); mimeType = selectedFile.type; }
            const res = await fetch('/api/ai/agile-advisor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: input, fileData, mimeType })
            });
            const data = await res.json();
            if (res.ok) setResult(data);
            else alert('Error al analizar. ' + (data.error || ''));
        } catch (e) { console.error(e); alert('Error de conexion.'); } finally { setAnalyzing(false); }
    };

    if (result) {
        return (
            <div className="animate-fadeIn space-y-6">
                <div className="flex items-center justify-between"><h2 className="text-2xl font-bold"><span className="text-[#00D4B3]">Recomendacion:</span> {result.methodology}</h2><div className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">{result.confidence}% Confianza</div></div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 text-sm opacity-80">{result.reasoning}</div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10"><h4 className="font-bold text-green-500 mb-2">Por que funcionara</h4><ul className="space-y-1">{result.pros.map((p: string, i: number) => <li key={i} className="text-xs opacity-70 list-disc list-inside">{p}</li>)}</ul></div>
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10"><h4 className="font-bold text-red-500 mb-2">Riesgos</h4><ul className="space-y-1">{result.cons.map((c: string, i: number) => <li key={i} className="text-xs opacity-70 list-disc list-inside">{c}</li>)}</ul></div>
                </div>
                <button onClick={() => { setResult(null); setSelectedFile(null); setInput(''); }} className="w-full py-3 mt-4 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-500">Analizar otro</button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center p-4">
            {!analyzing ? (
                <div className="w-full max-w-lg space-y-6">
                    <h3 className="text-xl font-bold text-center">Cuentale a la IA sobre tu proyecto</h3>
                    <div className="relative group">
                        <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ej: Somos un equipo de 5 personas..." className="w-full h-40 p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-white/10 focus:border-[#00D4B3] outline-none resize-none text-sm pb-12" />
                        <div className="absolute left-3 bottom-3 flex items-center gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.txt,.md,.docx" />
                            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs font-medium hover:border-[#00D4B3]/30 border border-transparent transition-all">{selectedFile ? selectedFile.name : 'Adjuntar Doc'}</button>
                            {selectedFile && <button onClick={() => setSelectedFile(null)} className="p-1 hover:text-red-500">x</button>}
                        </div>
                    </div>
                    <button onClick={analyzeProject} disabled={!input.trim() && !selectedFile} className="w-full py-4 rounded-xl bg-[#00D4B3] text-black font-bold shadow-lg hover:shadow-[#00D4B3]/40 transition-all disabled:opacity-50">Analizar</button>
                </div>
            ) : (
                <div className="text-center font-bold animate-pulse">IA analizando...</div>
            )}
        </div>
    );
};

// --- 3. DIAGRAM ARCHITECT ---
const DiagramArchitect = () => {
    const [prompt, setPrompt] = useState('');
    const [diagramType, setDiagramType] = useState('flowchart');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const { isDark } = useTheme();

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter'
        });
    }, [isDark]);

    const generateDiagram = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setCode('');
        try {
            const res = await fetch('/api/ai/diagram-generator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: diagramType })
            });
            const data = await res.json();
            if (res.ok) setCode(data.code);
            else alert('Error generando diagrama');
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => {
        if (code && previewRef.current) {
            previewRef.current.innerHTML = '';
            const id = `mermaid-${Date.now()}`;
            mermaid.render(id, code)
                .then(({ svg }) => {
                    if (previewRef.current) previewRef.current.innerHTML = svg;
                })
                .catch((e) => {
                    console.error('Mermaid Render Error', e);
                    if (previewRef.current) previewRef.current.innerHTML = `<div class="text-red-400 text-xs p-4 border border-red-500/20 rounded">Error renderizando: ${e.message}</div>`;
                });
        }
    }, [code]);

    return (
        <div className="h-full flex flex-col gap-4">
            {!code ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Icons.Architecture /> Generador de Diagramas
                    </h3>
                    <div className="grid grid-cols-3 gap-2 w-full mb-4">
                        {['flowchart', 'sequence', 'class', 'er', 'state', 'gantt'].map(t => (
                            <button
                                key={t}
                                onClick={() => setDiagramType(t)}
                                className={`p-2 text-xs font-bold rounded-lg capitalize border ${diagramType === t ? 'bg-[#00D4B3]/10 border-[#00D4B3] text-[#00D4B3]' : 'border-transparent bg-gray-100 dark:bg-white/5 opacity-60'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={`Describe tu diagrama ${diagramType}...`}
                        className="w-full h-32 p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-white/10 focus:border-[#00D4B3] outline-none text-sm resize-none mb-4"
                    />
                    <button
                        onClick={generateDiagram}
                        disabled={loading || !prompt}
                        className="w-full py-3 rounded-xl bg-[#00D4B3] text-black font-bold shadow-lg hover:shadow-[#00D4B3]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Generando...' : 'Crear Diagrama'}
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center mb-4 px-4 pt-2">
                        <h4 className="font-bold text-sm opacity-60">Vista Previa</h4>
                        <div className="flex gap-2">
                            <button onClick={() => setCode('')} className="text-xs px-3 py-1 bg-gray-100 dark:bg-white/5 rounded hover:bg-red-500/10 hover:text-red-500">Nuevo</button>
                            <button onClick={() => navigator.clipboard.writeText(code)} className="text-xs px-3 py-1 bg-gray-100 dark:bg-white/5 rounded hover:bg-[#00D4B3]/10 hover:text-[#00D4B3]">Copiar Codigo</button>
                        </div>
                    </div>
                    <div className="flex-1 bg-white dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-white/5 overflow-auto p-4 flex items-center justify-center relative">
                        <div ref={previewRef} className="w-full h-full flex items-center justify-center" />
                    </div>
                    <details className="mt-2 text-xs opacity-50">
                        <summary className="cursor-pointer">Ver codigo Mermaid</summary>
                        <pre className="p-2 bg-black/10 mt-2 rounded overflow-x-auto font-mono">{code}</pre>
                    </details>
                </div>
            )}
        </div>
    );
};

// --- DATA ---
const toolsReal = [
  { id: 'focus', name: 'Focus Flow', desc: 'Temporizador de productividad avanzado.', icon: <Icons.Timer />, component: FocusTimer },
  { id: 'advisor', name: 'Agile Advisor', desc: 'Selector de metodologias agiles con IA.', icon: <Icons.Compass />, component: AgileAdvisor },
  { id: 'architect', name: 'AI Architect', desc: 'Generador de diagramas (UML, BD, Procesos).', icon: <Icons.Architecture />, component: DiagramArchitect },
];

export default function WorkspaceToolsPage() {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { user } = useAuthStore();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const ActiveComponent = toolsReal.find(t => t.id === activeTool)?.component;

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen animate-fadeIn">
      <div className="mb-10 flex items-end justify-between">
        <div><h1 className="text-3xl font-bold mb-2 flex items-center gap-3" style={{ color: colors.textPrimary }}>Centro de Utilidades</h1><p style={{ color: colors.textSecondary }}>Herramientas profesionales para gestion eficiente.</p></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {toolsReal.map((tool) => (
          <motion.div key={tool.id} layoutId={`card-${tool.id}`} onClick={() => setActiveTool(tool.id)} className="group relative cursor-pointer overflow-hidden rounded-2xl border p-6 transition-all hover:border-[#00D4B3]" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: colors.border }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-white/5 mb-4 text-gray-700 dark:text-gray-300 group-hover:bg-[#00D4B3] group-hover:text-black transition-colors">{tool.icon}</div>
            <h3 className="font-bold text-sm mb-1" style={{ color: colors.textPrimary }}>{tool.name}</h3><p className="text-xs leading-relaxed opacity-60" style={{ color: colors.textSecondary }}>{tool.desc}</p>
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {activeTool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveTool(null)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div layoutId={`card-${activeTool}`} className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl overflow-hidden flex flex-col" style={{ background: isDark ? '#161b22' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3"><div className="text-[#00D4B3] p-2 bg-[#00D4B3]/10 rounded-lg">{toolsReal.find(t => t.id === activeTool)?.icon}</div><div><h3 className="font-bold text-lg leading-tight">{toolsReal.find(t => t.id === activeTool)?.name}</h3><p className="text-xs opacity-50">Project Hub Utilities</p></div></div>
                    <button onClick={() => setActiveTool(null)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">{ActiveComponent && <ActiveComponent />}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
