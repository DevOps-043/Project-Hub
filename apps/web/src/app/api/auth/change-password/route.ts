/**
 * API Route: POST /api/auth/change-password
 * Cambia la contrasena del usuario autenticado.
 *
 * SOFIA es la fuente primaria de credenciales, y desde la migracion a Supabase
 * Auth el cambio se hace con `auth.updateUser` contra el proyecto SOFIA.
 * Project Hub ya no guarda un espejo del hash: `account_users.password_hash`
 * queda con el centinela SOFIA_MANAGED_PASSWORD_PLACEHOLDER.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { changeSofiaPassword, SOFIA_MANAGED_PASSWORD_PLACEHOLDER } from '@/lib/auth/sofia-auth';
import { isSofiaConfigured } from '@/lib/supabase/sofia-client';

export const runtime = 'nodejs';

function isStrongPassword(password: string): boolean {
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'access') {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Las contrasenas nuevas no coinciden' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 8 caracteres' }, { status: 400 });
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json({
        error: 'La contrasena debe contener al menos una mayuscula, una minuscula y un numero',
      }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'La nueva contrasena debe ser diferente a la actual' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('account_users')
      .select('user_id, email, username, password_hash')
      .eq('user_id', payload.sub)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    let passwordHashForLocalMirror: string | null = null;
    let changedInSofia = false;

    if (isSofiaConfigured()) {
      const result = await changeSofiaPassword(
        user.email || user.username,
        currentPassword,
        newPassword
      );

      if (!result.success) {
        const statusByCode: Record<string, number> = {
          USER_NOT_FOUND: 404,
          INVALID_PASSWORD: 400,
          SOFIA_NOT_CONFIGURED: 503,
          INTERNAL_ERROR: 500,
        };
        return NextResponse.json(
          { error: result.error || 'No se pudo actualizar la contrasena en SOFIA' },
          { status: statusByCode[result.errorCode || ''] || 500 }
        );
      }

      // La credencial vive en auth.users de SOFIA; localmente solo el centinela.
      passwordHashForLocalMirror = SOFIA_MANAGED_PASSWORD_PLACEHOLDER;
      changedInSofia = true;
    }

    if (!changedInSofia) {
      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: 'La contrasena actual es incorrecta' }, { status: 400 });
      }

      const isSamePassword = await verifyPassword(newPassword, user.password_hash);
      if (isSamePassword) {
        return NextResponse.json({ error: 'La nueva contrasena debe ser diferente a la actual' }, { status: 400 });
      }

      passwordHashForLocalMirror = await hashPassword(newPassword);
    }

    const { error: updateError } = await supabaseAdmin
      .from('account_users')
      .update({
        password_hash: passwordHashForLocalMirror,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', payload.sub);

    if (updateError) {
      console.error('Error actualizando contrasena local:', updateError);
      return NextResponse.json({
        error: changedInSofia
          ? 'La contrasena se actualizo en SOFIA, pero no se pudo sincronizar Project Hub'
          : 'Error al actualizar la contrasena',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      source: changedInSofia ? 'sofia' : 'local',
      message: changedInSofia
        ? 'Contrasena actualizada correctamente en SOFIA'
        : 'Contrasena actualizada correctamente',
    });
  } catch (error) {
    console.error('Error en POST /api/auth/change-password:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
