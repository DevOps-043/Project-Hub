import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/ai/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { prompt, type } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 });
        }

        const model = getGeminiModel();

        const systemPrompt = `
            Actúa como un Arquitecto de Software experto. Tu tarea es generar código de diagramas usando la sintaxis de Mermaid.js.
            
            El usuario te pedirá un diagrama de tipo: ${type || 'Cualquiera adecuado'}.
            Descripción: "${prompt}"

            REGLAS IMPORTANTES:
            1. Responde ÚNICAMENTE con el código Mermaid.
            2. NO incluyas bloques de markdown (como \`\`\`mermaid). Devuelve SOLO el código plano.
            3. Si es un diagrama de clases o ER, usa sintaxis estándar.
            4. Asegúrate de que la sintaxis sea válida para evitar errores de renderizado.
            
            Ejemplo de output válido para un grafo simple:
            graph TD
                A[Inicio] --> B{¿Es válido?}
                B -- Sí --> C[Procesar]
                B -- No --> D[Terminar]
        `;

        const result = await model.generateContent(systemPrompt);
        const text = result.response.text();

        // Limpieza robusta del código Mermaid
        let cleanCode = text;

        // Extraer bloque mermaid si viene envuelto en markdown
        const mermaidBlockMatch = cleanCode.match(/```mermaid\s*\n([\s\S]*?)```/);
        if (mermaidBlockMatch) {
            cleanCode = mermaidBlockMatch[1];
        } else {
            // Remover cualquier bloque de código genérico
            const codeBlockMatch = cleanCode.match(/```\s*\n([\s\S]*?)```/);
            if (codeBlockMatch) {
                cleanCode = codeBlockMatch[1];
            }
        }

        // Limpiar restos de markdown
        cleanCode = cleanCode
            .replace(/```mermaid/g, '')
            .replace(/```/g, '')
            .trim();

        // Validar que empiece con un tipo de diagrama Mermaid válido
        const validStarts = [
            'graph ', 'graph\n', 'flowchart ', 'flowchart\n',
            'sequenceDiagram', 'classDiagram', 'stateDiagram',
            'erDiagram', 'gantt', 'pie', 'gitgraph', 'mindmap',
            'timeline', 'journey', 'quadrantChart', 'xychart',
            'block-beta', 'sankey-beta', 'packet-beta',
        ];
        const startsValid = validStarts.some(s => cleanCode.startsWith(s));

        // Si tiene texto basura antes del código, intentar extraer la parte mermaid
        if (!startsValid) {
            for (const start of validStarts) {
                const idx = cleanCode.indexOf(start);
                if (idx > 0) {
                    cleanCode = cleanCode.substring(idx).trim();
                    break;
                }
            }
        }

        if (!cleanCode) {
            return NextResponse.json({ error: 'La IA no generó código de diagrama válido' }, { status: 422 });
        }

        return NextResponse.json({ code: cleanCode });

    } catch (error: any) {
        console.error('Diagram Gen Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
