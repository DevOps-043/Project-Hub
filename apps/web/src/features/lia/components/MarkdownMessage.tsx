'use client';

/**
 * Renderizador ligero de Markdown para los mensajes de ARIA.
 *
 * Soporta lo que el modelo realmente usa en respuestas de chat:
 *   - **negritas** y *cursivas*
 *   - `código inline` y ```bloques de código```
 *   - # / ## / ### encabezados
 *   - listas con `-`, `*` y `1.`
 *   - tablas estilo pipe `| a | b |`
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

    if (/^\*\*[^*]+\*\*$/.test(token)) {
      return <strong key={key} style={{ fontWeight: 600, color: colors.text }}>{token.slice(2, -2)}</strong>;
    }

    if (/^\*[^*]+\*$/.test(token)) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }

    if (/^`[^`]+`$/.test(token)) {
      return (
        <code
          key={key}
          style={{
            backgroundColor: colors.bgMuted,
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: '0.85em',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            color: colors.accent,
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: colors.accent, textDecoration: 'underline', textUnderlineOffset: 2 }}
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
  | { type: 'code'; lang: string; text: string }
  | { type: 'table'; header: string[]; rows: string[][] };

function isTableSeparator(line: string): boolean {
  // Línea tipo  | :--- | :--: | ---: |
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  const cells = trimmed.replace(/^\||\|$/g, '').split('|');
  return cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

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

    // ─── Bloques de código ```lang ... ```
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
      i++;
      continue;
    }

    // ─── Tablas pipe (necesitan header + separador en la línea siguiente)
    if (trimmed.startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      flushList();
      const header = splitTableRow(trimmed);
      i += 2; // saltar header y separador
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // ─── Encabezados
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

    // ─── Listas con guión o asterisco
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

    // ─── Listas numeradas
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

    // ─── Línea en blanco → cierra párrafo y lista
    if (trimmed === '') {
      flushParagraph();
      flushList();
      i++;
      continue;
    }

    // ─── Línea normal → acumula en párrafo
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
    1: { fontSize: '0.98rem', fontWeight: 700, margin: '0.35rem 0 0.15rem', color: colors.text, letterSpacing: '-0.01em' },
    2: { fontSize: '0.92rem', fontWeight: 700, margin: '0.35rem 0 0.15rem', color: colors.text, letterSpacing: '-0.01em' },
    3: { fontSize: '0.88rem', fontWeight: 600, margin: '0.3rem 0 0.1rem', color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.04em' },
  };

  return (
    <div className="space-y-2.5 leading-relaxed">
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
                paddingLeft: '1.15rem',
                color: colors.text,
                listStyleType: block.ordered ? 'decimal' : 'disc',
              }}
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${blockKey}-i-${itemIndex}`}
                  style={{ margin: '0.2rem 0', paddingLeft: '0.15rem' }}
                >
                  {renderInline(item, `${blockKey}-i-${itemIndex}`, colors)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'table') {
          return (
            <div
              key={blockKey}
              style={{
                overflowX: 'auto',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.82rem',
                  color: colors.text,
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: colors.bgMuted }}>
                    {block.header.map((cell, cellIndex) => (
                      <th
                        key={`${blockKey}-h-${cellIndex}`}
                        style={{
                          padding: '6px 10px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: colors.accent,
                          borderBottom: `1px solid ${colors.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {renderInline(cell, `${blockKey}-h-${cellIndex}`, colors)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr
                      key={`${blockKey}-r-${rowIndex}`}
                      style={{
                        borderTop: rowIndex === 0 ? 'none' : `1px solid ${colors.border}`,
                      }}
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${blockKey}-r-${rowIndex}-c-${cellIndex}`}
                          style={{
                            padding: '6px 10px',
                            verticalAlign: 'top',
                          }}
                        >
                          {renderInline(cell, `${blockKey}-r-${rowIndex}-c-${cellIndex}`, colors)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // code block
        return (
          <pre
            key={blockKey}
            style={{
              margin: 0,
              padding: '0.65rem 0.8rem',
              borderRadius: 8,
              backgroundColor: colors.bgMuted,
              border: `1px solid ${colors.border}`,
              fontSize: '0.78rem',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              color: colors.text,
              overflowX: 'auto',
              whiteSpace: 'pre',
              lineHeight: 1.5,
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
