'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ExternalLink, ChevronDown, ChevronUp, Unlink, Loader2, X, Trash2, File,
} from 'lucide-react';
import {
  type LinkedDocument,
  DOC_TYPE_ICONS,
  DOC_TYPE_COLORS,
  PROVIDER_LABELS,
  getEmbedUrl,
} from '@/lib/google/document-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CollapsibleDocumentEmbedProps {
  document: LinkedDocument;
  defaultExpanded?: boolean;
  onUnlink?: (docId: string) => void;
  /** Indica si se está desvinculando este documento */
  isUnlinking?: boolean;
}

export function CollapsibleDocumentEmbed({
  document: doc,
  defaultExpanded = false,
  onUnlink,
  isUnlinking = false,
}: CollapsibleDocumentEmbedProps) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const colors = isDark
    ? {
        bg: '#1E2329',
        bgHover: '#272D35',
        border: 'rgba(255,255,255,0.08)',
        text: '#FFF',
        textSec: '#9CA3AF',
        headerBg: '#161B22',
      }
    : {
        bg: '#FFF',
        bgHover: '#F9FAFB',
        border: '#E5E7EB',
        text: '#111827',
        textSec: '#6B7280',
        headerBg: '#F8FAFC',
      };

  const Icon = DOC_TYPE_ICONS[doc.doc_type] || File;
  const iconColor = DOC_TYPE_COLORS[doc.doc_type] || '#6B7280';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: colors.border }}
    >
      {/* Fila colapsada / header */}
      <div
        className="group flex items-center gap-3 p-3 cursor-pointer transition-colors"
        style={{ backgroundColor: colors.bg }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.backgroundColor = colors.bgHover;
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.backgroundColor = colors.bg;
        }}
      >
        {/* Icono de tipo */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: colors.text }}>
              {doc.name}
            </span>
            <span
              className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border"
              style={{ color: colors.textSec, borderColor: colors.border }}
            >
              {PROVIDER_LABELS[doc.provider] || doc.provider}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {doc.creator && (
              <span className="text-xs" style={{ color: colors.textSec }}>
                {doc.creator.display_name || doc.creator.first_name}
              </span>
            )}
            <span className="text-xs" style={{ color: colors.textSec }}>
              • {format(new Date(doc.created_at), 'd MMM yyyy', { locale: es })}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Toggle expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md transition-colors hover:bg-white/10"
            style={{ color: colors.textSec }}
            title={expanded ? 'Colapsar' : 'Expandir documento'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Abrir en Google */}
          <a
            href={doc.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md transition-colors hover:bg-white/10"
            style={{ color: colors.textSec }}
            title="Abrir en Google"
          >
            <ExternalLink size={16} />
          </a>

          {/* Desvincular */}
          {onUnlink && (
            <>
              {confirmUnlink ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUnlink(doc.id)}
                    disabled={isUnlinking}
                    className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Confirmar desvincular"
                  >
                    {isUnlinking ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmUnlink(false)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: colors.textSec }}
                    title="Cancelar"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmUnlink(true)}
                  className="p-1.5 rounded-md transition-colors hover:text-red-500"
                  style={{ color: colors.textSec }}
                  title="Desvincular"
                >
                  <Unlink size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Iframe embebido (expandido) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 500, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-t"
              style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
            >
              <span className="text-xs font-medium truncate" style={{ color: colors.text }}>
                Vista previa
              </span>
              <a
                href={doc.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                Abrir en Google
              </a>
            </div>
            <iframe
              src={getEmbedUrl(doc)}
              className="w-full border-0"
              style={{ height: 462 }}
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
