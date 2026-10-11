/**
 * API Route: POST /api/auth/logout
 * Maneja el cierre de sesión
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken, hashToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Obtener token del header Authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token no proporcionado' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Revocar la sesión
    const tokenHash = await hashToken(token);
    
    await supabaseAdmin
      .from('auth_sessions')
      .update({
        is_active: false,
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'User logout',
      })
      .eq('token_hash', tokenHash);

    const res = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente' });
    res.cookies.set('pulsehub_bootstrap', '', { httpOnly: true, path: '/', maxAge: 0 });
    // Limpiar cookie httpOnly
    res.cookies.set('accessToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;

  } catch (error) {
    console.error('Error en logout:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
