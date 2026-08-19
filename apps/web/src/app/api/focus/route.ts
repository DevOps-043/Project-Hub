import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Check if current user is under an active focus session
export async function GET(request: NextRequest) {
    try {
        // Antes era pública y sin auth (ver PUBLIC_PATHS en proxy.ts): cualquiera
        // podía consultar el estado de foco de cualquier userId arbitrario.
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const checkUserId = searchParams.get('userId') || auth.payload.sub;

        const supabase = getSupabaseAdmin();
        const now = new Date().toISOString();

        // Find active sessions that have not ended
        const { data: sessions, error } = await supabase
            .from('focus_sessions')
            .select('*')
            .eq('status', 'active')
            .gt('end_time', now)
            .order('start_time', { ascending: false });

        if (error) throw error;

        // Filter valid sessions for this user
        // 1. target_type = 'global' (All users)
        // 2. target_type = 'users' (User ID in array)
        // 3. target_type = 'team' (User's team in array - Requires extra query, we will skip for simple demo and just assume ID match or global)
        
        // For this MVP: support Global and Direct User ID match in target_ids
        
        const activeSession = sessions?.find(session => {
            if (session.target_type === 'global') return true;
            if (session.target_type === 'users' && session.target_ids.includes(checkUserId)) return true;
            return false;
        });

        return NextResponse.json({ activeSession: activeSession || null });

    } catch (error) {
        console.error('Focus API Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST: Start a new Focus Session
export async function POST(request: NextRequest) {
    try {
        // Antes era pública y sin auth: cualquiera podía iniciar una sesión
        // global (bloquea a todos los usuarios) o dirigida a userIds
        // arbitrarios, e insertar notificaciones a nombre de quien fuera.
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const body = await request.json();
        const { durationMinutes, taskName, targetType, targetIds } = body;
        // createdBy sale siempre del token, nunca del body: si no, cualquier
        // usuario autenticado podía atribuirle la sesión a otra persona.
        const createdBy = auth.payload.sub;

        if (!durationMinutes) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // Deactivate any existing sessions for this creator/target to avoid overlap mess?
        // For now, let's just create new one.

        const { data, error } = await supabase
            .from('focus_sessions')
            .insert({
                created_by: createdBy,
                task_name: taskName || 'Sesión de Enfoque',
                duration_minutes: durationMinutes,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                target_type: targetType || 'global',
                target_ids: targetIds || [],
                status: 'active'
            })
            .select()
            .single();

        if (error) throw error;

        // HERE: Trigger Notifications (Logic would go here to insert into notifications table)
        // We will do a quick insert into notifications table if target is specific
        
        if (targetType === 'global') {
             // Notify everyone? Too spammy for db insert loop maybe.
             // We rely on the Polling Enforcer to "Notify" them by locking screen.
        } else if (targetType === 'users' && targetIds.length > 0) {
            const notifications = targetIds.map((uid: string) => ({
                recipient_id: uid,
                title: '⚡ Focus Mode Activado',
                message: `El administrador ha iniciado una sesión de enfoque de ${durationMinutes} min.`,
                type: 'alert'
            }));
            await supabase.from('notifications').insert(notifications);
        }

        return NextResponse.json({ success: true, session: data });

    } catch (error) {
        console.error('Focus Start API Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
