'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api/client';
import MermaidBlock from '@/components/diagrams/MermaidBlock';

const DIAGRAM_TYPES = ['auto', 'flowchart', 'sequence', 'class', 'er', 'state', 'gantt'] as const;

type DiagramType = (typeof DIAGRAM_TYPES)[number];

export default function DiagramGeneratorTool() {
  const [prompt, setPrompt] = useState('');
  const [diagramType, setDiagramType] = useState<DiagramType>('auto');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateDiagram = async () => {
    if (!prompt.trim()) {
      setError('Describe el proceso o sistema que quieres diagramar.');
      return;
    }

    setLoading(true);
    setError(null);
    setCode('');

    try {
      const { data, error } = await api.post<{ code?: string }>('/api/ai/diagram-generator', {
        prompt,
        type: diagramType,
      });

      if (error || !data?.code?.trim()) {
        setError(error || 'No se pudo generar el diagrama.');
        return;
      }

      setCode(data.code);
    } catch (err) {
      console.error('Diagram generator error:', err);
      setError('No se pudo conectar con el generador de diagramas.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard?.writeText(`\`\`\`mermaid\n${code}\n\`\`\``);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DIAGRAM_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setDiagramType(type)}
            className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all border ${
              diagramType === type
                ? 'bg-[#00D4B3]/10 border-[#00D4B3] text-[#00D4B3]'
                : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe el flujo, arquitectura, modelo de datos o proceso que necesitas visualizar..."
        className="w-full min-h-40 p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-white/10 focus:border-[#00D4B3] outline-none resize-y text-sm"
      />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={generateDiagram}
          disabled={loading || !prompt.trim()}
          className="flex-1 py-3 rounded-xl bg-[#00D4B3] text-black font-bold shadow-lg hover:shadow-[#00D4B3]/30 transition-all disabled:opacity-50"
        >
          {loading ? 'Generando...' : 'Generar diagrama'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPrompt('');
            setCode('');
            setError(null);
            setDiagramType('auto');
          }}
          className="px-5 py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
        >
          Limpiar
        </button>
      </div>

      {code && (
        <div className="space-y-3">
          <MermaidBlock code={code} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={copyCode}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              Copiar Mermaid
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
