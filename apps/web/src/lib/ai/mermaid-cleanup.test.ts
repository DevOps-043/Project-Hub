import { describe, expect, it } from 'vitest';
import { cleanMermaidResponse } from './mermaid-cleanup';

describe('cleanMermaidResponse', () => {
  it('returns already-clean Mermaid code unchanged', () => {
    const raw = 'graph TD\n  A[Start] --> B[End]';
    expect(cleanMermaidResponse(raw)).toBe(raw);
  });

  it('extracts code from a ```mermaid fenced block', () => {
    const raw = '```mermaid\ngraph TD\n  A --> B\n```';
    expect(cleanMermaidResponse(raw)).toBe('graph TD\n  A --> B');
  });

  it('extracts code from a generic ``` fenced block when there is no ```mermaid tag', () => {
    const raw = '```\nsequenceDiagram\n  Alice->>Bob: Hi\n```';
    expect(cleanMermaidResponse(raw)).toBe('sequenceDiagram\n  Alice->>Bob: Hi');
  });

  it('strips leading explanatory text before a recognized diagram keyword', () => {
    const raw = 'Aquí está tu diagrama:\ngraph TD\n  A --> B';
    expect(cleanMermaidResponse(raw)).toBe('graph TD\n  A --> B');
  });

  it('recognizes classDiagram, erDiagram, and gantt as valid starts', () => {
    expect(cleanMermaidResponse('classDiagram\n  class Foo')).toBe('classDiagram\n  class Foo');
    expect(cleanMermaidResponse('erDiagram\n  A ||--o{ B : has')).toBe('erDiagram\n  A ||--o{ B : has');
    expect(cleanMermaidResponse('gantt\n  title Plan')).toBe('gantt\n  title Plan');
  });

  // When no recognized diagram keyword appears anywhere in the text, the
  // function has nothing to trim to and returns the input as-is — it's the
  // caller's job (the route) to detect this isn't usable Mermaid and 422.
  it('returns the text unchanged when no recognized diagram keyword appears anywhere', () => {
    const raw = 'Lo siento, no puedo generar ese diagrama.';
    expect(cleanMermaidResponse(raw)).toBe(raw);
  });

  it('returns an empty string for empty input', () => {
    expect(cleanMermaidResponse('')).toBe('');
  });

  it('returns an empty string when a fenced block is empty', () => {
    expect(cleanMermaidResponse('```mermaid\n\n```')).toBe('');
  });

  it('handles a fenced block that itself contains leading explanatory text', () => {
    const raw = '```\nSure, here it is:\nflowchart TD\n  A --> B\n```';
    expect(cleanMermaidResponse(raw)).toBe('flowchart TD\n  A --> B');
  });
});
