import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/ai/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { content, fileData, mimeType } = await request.json();

        if (!content && !fileData) {
            return NextResponse.json({ error: 'Contenido o archivo requerido' }, { status: 400 });
        }

        const model = getGeminiModel();

        const parts: any[] = [];

        // Prompt del sistema
        parts.push({
            text: `Actúa como un Experto Senior en Gestión de Proyectos y Metodologías Ágiles (Agile Coach).
            
            Analiza la siguiente información del proyecto (texto y/o documentos adjuntos) y determina cuál es la metodología de gestión más adecuada (Scrum, Kanban, Shape Up, Waterfall, o Scrumban).

            Responde ÚNICAMENTE con un objeto JSON válido (sin markdown) con la estructura:
            {
                "methodology": "Nombre",
                "confidence": 0-100,
                "reasoning": "Explicación",
                "pros": [],
                "cons": [],
                "tips": []
            }`
        });

        // Añadir texto si existe
        if (content) {
            parts.push({ text: `Detalles del proyecto:\n${content}` });
        }

        // Añadir archivo si existe
        if (fileData && mimeType) {
            parts.push({
                inlineData: {
                    data: fileData,
                    mimeType: mimeType
                }
            });
        }

        const result = await model.generateContent(parts);
        const responseText = result.response.text();
        
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Agile Advisor Error:', error);
        return NextResponse.json({ 
            error: error.message,
            fallback: true 
        }, { status: 500 });
    }
}
