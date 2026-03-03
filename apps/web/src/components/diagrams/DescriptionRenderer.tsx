'use client';

import React from 'react';
import MermaidBlock from './MermaidBlock';

interface Segment {
  type: 'text' | 'mermaid';
  content: string;
}

function parseSegments(description: string): Segment[] {
  const regex = /```mermaid\n([\s\S]*?)```/g;
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(description)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: description.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'mermaid', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < description.length) {
    segments.push({ type: 'text', content: description.slice(lastIndex) });
  }

  return segments;
}

interface DescriptionRendererProps {
  description: string;
  textClassName?: string;
  className?: string;
}

export default function DescriptionRenderer({ description, textClassName, className }: DescriptionRendererProps) {
  if (!description) return null;

  const segments = parseSegments(description);

  // No mermaid blocks — render identical to original plain text
  if (segments.length === 1 && segments[0].type === 'text') {
    return (
      <p className={`whitespace-pre-line ${textClassName || ''}`}>
        {segments[0].content}
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <p key={i} className={`whitespace-pre-wrap ${textClassName || ''}`}>
            {seg.content}
          </p>
        ) : (
          <MermaidBlock key={i} code={seg.content} />
        )
      )}
    </div>
  );
}
