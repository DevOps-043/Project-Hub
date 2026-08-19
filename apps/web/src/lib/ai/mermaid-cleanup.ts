/**
 * Limpieza del texto crudo que devuelve Gemini al pedirle código Mermaid:
 * extrae el bloque de código si viene envuelto en markdown, quita fences
 * sueltos, y si el modelo antepuso texto explicativo antes del diagrama,
 * recorta hasta el primer tipo de diagrama Mermaid válido reconocido.
 *
 * Extraído de `app/api/ai/diagram-generator/route.ts` para poder probar cada
 * caso (respuesta bien formada, envuelta en ```mermaid, envuelta en ``` genérico,
 * con texto basura antes, o sin contenido usable) sin mockear el SDK de Gemini.
 */

const VALID_DIAGRAM_STARTS = [
  'graph ', 'graph\n', 'flowchart ', 'flowchart\n',
  'sequenceDiagram', 'classDiagram', 'stateDiagram',
  'erDiagram', 'gantt', 'pie', 'gitgraph', 'mindmap',
  'timeline', 'journey', 'quadrantChart', 'xychart',
  'block-beta', 'sankey-beta', 'packet-beta',
];

export function cleanMermaidResponse(rawText: string): string {
  let cleanCode = rawText;

  const mermaidBlockMatch = cleanCode.match(/```mermaid\s*\n([\s\S]*?)```/);
  if (mermaidBlockMatch) {
    cleanCode = mermaidBlockMatch[1];
  } else {
    const codeBlockMatch = cleanCode.match(/```\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleanCode = codeBlockMatch[1];
    }
  }

  cleanCode = cleanCode
    .replace(/```mermaid/g, '')
    .replace(/```/g, '')
    .trim();

  const startsValid = VALID_DIAGRAM_STARTS.some((s) => cleanCode.startsWith(s));

  if (!startsValid) {
    for (const start of VALID_DIAGRAM_STARTS) {
      const idx = cleanCode.indexOf(start);
      if (idx > 0) {
        cleanCode = cleanCode.substring(idx).trim();
        break;
      }
    }
  }

  return cleanCode;
}
