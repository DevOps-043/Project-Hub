'use client';

/**
 * Renderizador ligero de Markdown para los mensajes de ARIA.
 *
 * Soporta lo que el modelo realmente usa en respuestas de chat:
 *   - **negritas**
 *   - *cursivas*
 *   - `código inline` y ```bloques de código```
 *   - # / ## / ### encabezados
 *   - listas con `-`, `*` y `1.`
 *   - [enlaces](https://...)
 *   - separación en párrafos por líneas en blanco
 *
 * Pensado para chat (mensajes cortos), no para documentos largos.
 * Hecho a mano para no añadir dependencias (react-markdown, remark, etc.).
 */

import { CSSProperties, ReactNode } from 'react';

interface MarkdownMessageProps {
  content: string;
  colors: {
    text: string;
    muted: string;
    accent: string;
    bgMuted: string;
    border: string;
  };
}

// ───────────── Inline (bold, italic, code, links) ─────────────

const INLINE_REGEX = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, keyPrefix: string, colors: MarkdownMessageProps['colors']): ReactNode[] {
  if (!text) return [];

  const tokens = text.split(INLINE_REGEX).filter(Boolean);

  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;

    // **negrita**
    if (/^\*\*[^*]+\*\*$/.test(token)) {
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    }

    // *cursiva*  (sólo cuando hay contenido y no es bullet de lista)
    if (/^\*[^*]+\*$/.test(token)) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }

    // `código inline`
    if (/^`[^`]+`$/.test(token)) {
      return (
        <code
          key={key}
          style={{
            backgroundColor: colors.bgMuted,
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            padding: '0.5px 4px',
            fontSize: '0.85em',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    // [texto](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: colors.accent, textDecoration: 'underline' }}
        >
          {label}
        </a>
      );
    }

    return <span key={key}>{token}</span>;
  });
}

// ───────────── Block parsing ─────────────

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  let i = 0;
  let paragraphBuffer: string[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphBuffer.join(' ') });
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer && listBuffer.items.length > 0) {
      blocks.push({ type: 'list', ordered: listBuffer.ordered, items: listBuffer.items });
    }
    listBuffer = null;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Bloques de código ```lang ... ```
    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
      i++; // saltar el cierre ```
      continue;
    }

    // Encabezados
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Listas con guión o asterisco
    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(unorderedMatch[1]);
      i++;
      continue;
    }

    // Listas numeradas
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(orderedMatch[1]);
      i++;
      continue;
    }

    // Línea en blanco → cierra párrafo y lista
    if (trimmed === '') {
      flushParagraph();
      flushList();
      i++;
      continue;
    }

    // Línea normal → acumula en párrafo
    flushList();
    paragraphBuffer.push(trimmed);
    i++;
  }

  flushParagraph();
  flushList();

  return blocks;
}

// ───────────── Component ─────────────

export function MarkdownMessage({ content, colors }: MarkdownMessageProps) {
  const blocks = parseBlocks(content);

  const headingStyle: Record<1 | 2 | 3, CSSProperties> = {
    1: { fontSize: '1.05rem', fontWeight: 700, margin: '0.5rem 0 0.25rem', color: colors.text },
    2: { fontSize: '1rem', fontWeight: 700, margin: '0.5rem 0 0.25rem', color: colors.text },
    3: { fontSize: '0.95rem', fontWeight: 600, margin: '0.4rem 0 0.2rem', color: colors.text },
  };

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        const blockKey = `b-${blockIndex}`;

        if (block.type === 'heading') {
          const Tag = (`h${block.level}` as 'h1' | 'h2' | 'h3');
          return (
            <Tag key={blockKey} style={headingStyle[block.level]}>
              {renderInline(block.text, blockKey, colors)}
            </Tag>
          );
        }

        if (block.type === 'paragraph') {
          return (
            <p key={blockKey} style={{ margin: 0, color: colors.text }}>
              {renderInline(block.text, blockKey, colors)}
            </p>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={blockKey}
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                color: colors.text,
                listStyleType: block.ordered ? 'decimal' : 'disc',
              }}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${blockKey}-i-${itemIndex}`} style={{ margin: '0.15rem 0' }}>
                  {renderInline(item, `${blockKey}-i-${itemIndex}`, colors)}
                </li>
              ))}
            </ListTag>
          );
        }

        // code block
        return (
          <pre
            key={blockKey}
            style={{
              margin: 0,
              padding: '0.6rem 0.75rem',
              borderRadius: 8,
              backgroundColor: colors.bgMuted,
              border: `1px solid ${colors.border}`,
              fontSize: '0.8rem',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              color: colors.text,
              overflowX: 'auto',
              whiteSpace: 'pre',
            }}
          >
            <code>{block.text}</code>
          </pre>
        );
      })}
    </div>
  );
}

export default MarkdownMessage;
