'use client';

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api/client';
import MermaidBlock from './MermaidBlock';

const DIAGRAM_TYPES = ['flowchart', 'sequence', 'class', 'er', 'state', 'gantt'] as const;

export interface DiagramContext {
  type: 'issue' | 'project';
  title: string;
  description?: string | null;
  projectName?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  teamName?: string;
  dueDate?: string | null;
  estimatePoints?: number | null;
  milestones?: string[];
}

interface DiagramGeneratorInlineProps {
  onInsert: (mermaidCode: string) => void;
  disabled?: boolean;
  context?: DiagramContext;
}

function buildContextPrompt(ctx: DiagramContext): string {
  const lines: string[] = [];

  if (ctx.type === 'issue') {
    lines.push(`Tipo: Issue/Tarea`);
    lines.push(`Titulo: "${ctx.title}"`);
    if (ctx.projectName) lines.push(`Proyecto: ${ctx.projectName}`);
    if (ctx.status) lines.push(`Estado: ${ctx.status}`);
    if (ctx.priority) lines.push(`Prioridad: ${ctx.priority}`);
    if (ctx.teamName) lines.push(`Equipo: ${ctx.teamName}`);
    if (ctx.labels?.length) lines.push(`Etiquetas: ${ctx.labels.join(', ')}`);
    if (ctx.dueDate) lines.push(`Fecha limite: ${ctx.dueDate}`);
    if (ctx.estimatePoints) lines.push(`Estimacion: ${ctx.estimatePoints} puntos`);
  } else {
    lines.push(`Tipo: Proyecto`);
    lines.push(`Nombre: "${ctx.title}"`);
    if (ctx.priority) lines.push(`Prioridad: ${ctx.priority}`);
    if (ctx.teamName) lines.push(`Equipo: ${ctx.teamName}`);
    if (ctx.milestones?.length) lines.push(`Milestones: ${ctx.milestones.join(', ')}`);
  }

  if (ctx.description) {
    const descClean = ctx.description
      .replace(/```mermaid[\s\S]*?```/g, '')
      .trim();
    if (descClean) lines.push(`Descripcion actual: ${descClean.slice(0, 500)}`);
  }

  lines.push('');
  lines.push('Genera el diagrama Mermaid mas adecuado para documentar visualmente este contexto.');
  lines.push('Analiza el titulo, etiquetas y descripcion para entender de que se trata:');
  lines.push('- Si es un bug o error tecnico: diagrama de flujo mostrando el flujo donde ocurre el problema y la solucion propuesta.');
  lines.push('- Si es una feature de software: diagrama de secuencia o flujo del proceso funcional.');
  lines.push('- Si es un proceso de negocio (alta de empresa, registro, onboarding, etc.): diagrama de flujo tipo BPMN.');
  lines.push('- Si es un proyecto completo: diagrama de arquitectura general o flujo de alto nivel.');
  lines.push('- Si es un modelo de datos: diagrama ER.');
  lines.push('TU decides el tipo de diagrama mas apropiado segun el contexto.');

  return lines.join('\n');
}

export default function DiagramGeneratorInline({ onInsert, disabled, context }: DiagramGeneratorInlineProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [diagramType, setDiagramType] = useState<string>('flowchart');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const { isDark } = useTheme();

  const callApi = async (p: string, type: string) => {
    setLoading(true);
    setCode('');
    try {
      const { data, error } = await api.post<{ code?: string }>('/api/ai/diagram-generator', { prompt: p, type });
      if (!error && data?.code?.trim()) {
        setCode(data.code);
      } else {
        alert(error || 'Error generando diagrama. Intenta de nuevo.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateFromContext = () => {
    if (!context) return;
    callApi(buildContextPrompt(context), 'auto');
  };

  const generateManual = () => {
    if (!prompt.trim()) return;
    callApi(prompt, diagramType);
  };

  const handleInsert = () => {
    onInsert(code);
    setOpen(false);
    setPrompt('');
    setCode('');
    setDiagramType('flowchart');
    setShowCustom(false);
  };

  const handleClose = () => {
    setOpen(false);
    setPrompt('');
    setCode('');
    setLoading(false);
    setDiagramType('flowchart');
    setShowCustom(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D4B3]/10 text-[#00D4B3] hover:bg-[#00D4B3]/20 border border-[#00D4B3]/20 transition-all disabled:opacity-40"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        IA Diagrama
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
              style={{
                background: isDark ? '#161b22' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className="text-[#00D4B3] p-1.5 bg-[#00D4B3]/10 rounded-lg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-sm" style={{ color: isDark ? '#fff' : '#111' }}>
                    Generar Diagrama con IA
                  </h3>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {!code ? (
                  <>
                    {/* Context-aware auto-generate */}
                    {context && !showCustom && (
                      <>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Contexto detectado</p>
                          <p className="text-sm font-medium" style={{ color: isDark ? '#fff' : '#111' }}>
                            {context.type === 'issue' ? 'Issue' : 'Proyecto'}: {context.title}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {context.status && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {context.status}
                              </span>
                            )}
                            {context.priority && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                {context.priority}
                              </span>
                            )}
                            {context.teamName && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                {context.teamName}
                              </span>
                            )}
                            {context.labels?.map((l, i) => (
                              <span key={i} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                {l}
                              </span>
                            ))}
                          </div>
                          {context.projectName && context.type === 'issue' && (
                            <p className="text-xs opacity-50">Proyecto: {context.projectName}</p>
                          )}
                        </div>

                        <button
                          onClick={generateFromContext}
                          disabled={loading}
                          className="w-full py-3.5 rounded-xl bg-[#00D4B3] text-black font-bold shadow-lg hover:shadow-[#00D4B3]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                          {loading ? (
                            <>
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Analizando contexto...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                              </svg>
                              Generar diagrama automatico
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setShowCustom(true)}
                          className="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors"
                        >
                          Personalizar diagrama manualmente
                        </button>
                      </>
                    )}

                    {/* Manual mode (no context or custom override) */}
                    {(!context || showCustom) && (
                      <>
                        {showCustom && (
                          <button
                            onClick={() => setShowCustom(false)}
                            className="text-xs text-[#00D4B3] hover:underline flex items-center gap-1"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Volver a generacion automatica
                          </button>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          {DIAGRAM_TYPES.map((t) => (
                            <button
                              key={t}
                              onClick={() => setDiagramType(t)}
                              className={`p-2 text-xs font-bold rounded-lg capitalize border transition-all ${
                                diagramType === t
                                  ? 'bg-[#00D4B3]/10 border-[#00D4B3] text-[#00D4B3]'
                                  : 'border-transparent bg-gray-100 dark:bg-white/5 opacity-60'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={`Describe tu diagrama ${diagramType}...\nEj: "Usuario hace login, sistema valida, si ok entra, si no muestra error"`}
                          className="w-full h-28 p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-white/10 focus:border-[#00D4B3] outline-none text-sm resize-none"
                        />

                        <button
                          onClick={generateManual}
                          disabled={loading || !prompt.trim()}
                          className="w-full py-3 rounded-xl bg-[#00D4B3] text-black font-bold shadow-lg hover:shadow-[#00D4B3]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? 'Generando...' : 'Generar Diagrama'}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Preview */}
                    <MermaidBlock code={code} />

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleInsert}
                        className="flex-1 py-2.5 rounded-xl bg-[#00D4B3] text-black font-bold text-sm hover:shadow-lg transition-all"
                      >
                        Insertar en descripcion
                      </button>
                      <button
                        onClick={() => setCode('')}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      >
                        Reintentar
                      </button>
                      <button
                        onClick={handleClose}
                        className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
