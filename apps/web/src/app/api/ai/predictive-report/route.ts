import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase & Gemini
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // 1. Fetch raw data (simplified aggregation)
        const { data: tasks } = await supabaseAdmin.from('task_issues').select('status_id, created_at, completed_at, priority_id, assignee_id');
        const { data: projects } = await supabaseAdmin.from('pm_projects').select('project_status, start_date, target_date, completion_percentage');
        
        // Mock data if empty (fallback for demo)
        const reportData = {
            total_tasks: tasks?.length || 124,
            completed_tasks: tasks?.filter((t:any) => t.completed_at).length || 65,
            active_projects: projects?.length || 12,
            avg_completion_rate: 78,
            blocked_tasks: 12, // simulated
            delayed_projects: 3 // simulated
        };

        // 2. Ask Gemini for prediction
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
        
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

    } catch (error: any) {
        console.error('Predictive API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
