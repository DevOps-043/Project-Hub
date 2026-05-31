/**
 * API Route: POST /api/auth/change-password
 * Cambia la contrasena del usuario autenticado.
 *
 * SOFIA es la fuente primaria del perfil y credenciales. Project Hub conserva
 * el hash local solo como espejo para mantener compatible el login actual.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';
import { hashBcryptPassword, hashPassword, verifyPassword } from '@/lib/auth/password';
import { findSofiaUser } from '@/lib/auth/sofia-auth';
import { getSofiaServiceRoleClient, isSofiaConfigured } from '@/lib/supabase/sofia-client';

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
      const sofiaUser = await findSofiaUser(user.email || user.username);

      if (!sofiaUser?.password_hash) {
        return NextResponse.json({
          error: 'No se encontro el usuario en SOFIA para cambiar la contrasena',
        }, { status: 404 });
      }

      const isCurrentPasswordValid = await verifyPassword(currentPassword, sofiaUser.password_hash);
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: 'La contrasena actual es incorrecta' }, { status: 400 });
      }

      const isSamePassword = await verifyPassword(newPassword, sofiaUser.password_hash);
      if (isSamePassword) {
        return NextResponse.json({ error: 'La nueva contrasena debe ser diferente a la actual' }, { status: 400 });
      }

      const sofia = getSofiaServiceRoleClient();
      if (!sofia) {
        return NextResponse.json({
          error: 'SOFIA_SUPABASE_SERVICE_ROLE_KEY no esta disponible en el runtime de apps/web. La contrasena no se actualizo.',
        }, { status: 503 });
      }

      const newSofiaPasswordHash = await hashBcryptPassword(newPassword);
      const { data: updatedSofiaUser, error: sofiaUpdateError } = await sofia
        .from('users')
        .update({
          password_hash: newSofiaPasswordHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sofiaUser.user_id)
        .select('id')
        .maybeSingle();

      if (sofiaUpdateError || !updatedSofiaUser) {
        console.error('Error actualizando contrasena en SOFIA:', sofiaUpdateError);
        return NextResponse.json({
          error: 'SOFIA no permitio actualizar la contrasena. Verifica que la service role pertenezca al proyecto SOFIA y que el usuario exista.',
          details: sofiaUpdateError?.message,
        }, { status: sofiaUpdateError ? 500 : 404 });
      }

      passwordHashForLocalMirror = newSofiaPasswordHash;
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
