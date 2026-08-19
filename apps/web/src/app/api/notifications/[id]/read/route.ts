import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-role';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Antes marcaba como leída cualquier notification_id sin verificar
        // sesión ni dueño — cualquiera podía marcar como leídas notificaciones
        // ajenas adivinando el UUID.
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const { id: notificationId } = await params;
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('notification_id', notificationId)
            .eq('recipient_id', auth.payload.sub);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
