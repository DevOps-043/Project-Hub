import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGeminiModel } from '@/lib/ai/gemini';
import { requireAuth } from '@/lib/auth/require-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        // 1. Fetch raw data (simplified aggregation)
        const { data: tasks } = await supabaseAdmin.from('task_issues').select('status_id, created_at, completed_at, priority_id, assignee_id');
        const { data: projects } = await supabaseAdmin.from('pm_projects').select('project_status, start_date, target_date, completion_percentage');
        
        // Mock data if empty (fallback for demo)
        const reportData = {
            total_tasks: tasks?.length || 124,
            completed_tasks: tasks?.filter((t) => t.completed_at).length || 65,
            active_projects: projects?.length || 12,
            avg_completion_rate: 78,
            blocked_tasks: 12, // simulated
            delayed_projects: 3 // simulated
        };

        // 2. Ask Gemini for prediction
        const model = getGeminiModel();
        
        const prompt = `
            Actúa como un Consultor Senior de Eficiencia y Gestión de Proyectos.
            Analiza los siguientes datos operativos de una empresa de desarrollo de software:
            
            DATOS CRUDOS:
            - Tareas Totales: ${reportData.total_tasks}
            - Tareas Completadas: ${reportData.completed_tasks}
            - Proyectos Activos: ${reportData.active_projects}
            - Proyectos con Retraso Detectado: ${reportData.delayed_projects}
            - Tareas Bloqueadas detectadas: ${reportData.blocked_tasks}
            
            Genera un "Reporte de Inteligencia Predictiva" corto y contundente (formato JSON) con 3 secciones:
            1. "risk_assessment": Párrafo evaluando el riesgo de burnout o retrasos (Alto/Medio/Bajo).
            2. "predictions": Lista de 3 posibles escenarios futuros si no se hacen cambios (ej: "El proyecto X se retrasará 2 semanas").
            3. "tactical_actions": Lista de 3 acciones inmediatas recomendadas para desbloquear flujo.

            RESPONSE FORMAT (JSON ONLY):
            {
                "risk_level": "Alto" | "Medio" | "Bajo",
                "risk_summary": "...",
                "predictions": ["...", "...", "..."],
                "actions": ["...", "...", "..."]
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '');
        const analysis = JSON.parse(text);

        return NextResponse.json(analysis);

    } catch (error) {
        console.error('Predictive API Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
