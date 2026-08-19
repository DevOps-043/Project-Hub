import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/ai/gemini';
import { requireAuth } from '@/lib/auth/require-role';
import { cleanMermaidResponse } from '@/lib/ai/mermaid-cleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

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

        const cleanCode = cleanMermaidResponse(text);

        if (!cleanCode) {
            return NextResponse.json({ error: 'La IA no generó código de diagrama válido' }, { status: 422 });
        }

        return NextResponse.json({ code: cleanCode });

    } catch (error) {
        console.error('Diagram Gen Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
