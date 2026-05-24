'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '@/contexts/ThemeContext';

let mermaidInitialized: 'default' | 'dark' | null = null;

function initMermaid(isDark: boolean) {
  const theme = isDark ? 'dark' : 'default';
  if (mermaidInitialized === theme) return;
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'loose',
    fontFamily: 'Inter',
  });
  mermaidInitialized = theme;
}

interface MermaidBlockProps {
  code: string;
  className?: string;
}

export default function MermaidBlock({ code, className }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const { isDark } = useTheme();
  const reactId = useId();

  useEffect(() => {
    if (!code || !containerRef.current) return;

    let cancelled = false;
    setError(null);
    setRendered(false);
    initMermaid(isDark);

    const id = `mermaid-${reactId.replace(/:/g, '-')}-${Date.now()}`;

    // Remove any stale mermaid temp elements
    document.querySelectorAll(`#${CSS.escape(id)}`).forEach(el => el.remove());
    document.querySelectorAll('.mermaid-error').forEach(el => el.remove());

    (async () => {
      try {
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (e: any) {
        console.error('MermaidBlock render error:', e);
        // Clean up any error elements mermaid may have inserted
        document.querySelectorAll(`#d${id}`).forEach(el => el.remove());
        if (!cancelled) {
          setError(e?.message || e?.str || 'Error rendering diagram');
          if (containerRef.current) containerRef.current.innerHTML = '';
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code, isDark]);

  if (error) {
    return (
      <div className={`border border-red-500/30 bg-red-500/5 rounded-xl p-4 space-y-3 ${className || ''}`}>
        <p className="text-red-400 text-xs font-medium">Error renderizando diagrama</p>
        <p className="text-red-400/60 text-[10px]">{error}</p>
        <details className="group">
          <summary className="text-xs text-red-300/50 cursor-pointer hover:text-red-300/80 transition-colors">
            Ver codigo Mermaid generado
          </summary>
          <pre className="mt-2 text-xs text-red-300/70 overflow-x-auto whitespace-pre-wrap font-mono p-3 rounded-lg bg-red-500/5">{code}</pre>
        </details>
      </div>
    );
  }

  return (
    <div className={`relative overflow-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] p-4 min-h-[120px] ${className || ''}`}>
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs opacity-50">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Renderizando diagrama...
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex items-center justify-center" />
    </div>
  );
}
