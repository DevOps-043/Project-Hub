/**
 * API Route: POST /api/auth/reset-test-user
 * SOLO PARA DESARROLLO - Actualiza el usuario de prueba con un hash válido
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';

// Forzar runtime de Node.js
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'No disponible en producción' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const password = body.password || '220626EaFy';
    const email = body.email || 'fernando.suarez@ecosdeliderazgo.com';

    // Generar hash con PBKDF2
    const passwordHash = await hashPassword(password);

    // No se loguea la contraseña en texto plano ni el hash completo:
    // esto es un endpoint solo-desarrollo, pero los logs pueden terminar
    // en un agregador compartido incluso en entornos no productivos.
    console.log('🔐 Generando hash para:', email);

    // Verificar si el usuario existe
    const { data: existingUser } = await supabaseAdmin
      .from('account_users')
      .select('user_id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      // Actualizar el hash del usuario existente
      const { error: updateError } = await supabaseAdmin
        .from('account_users')
        .update({ password_hash: passwordHash })
        .eq('email', email);

      if (updateError) {
        console.error('Error actualizando usuario:', updateError);
        return NextResponse.json(
          { error: 'Error actualizando usuario', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Usuario actualizado con nuevo hash',
        email: email,
        hashPreview: passwordHash.substring(0, 30) + '...',
      });
    } else {
      // Crear el usuario si no existe
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('account_users')
        .insert({
          first_name: 'Fernando',
          last_name_paternal: 'Suarez',
          last_name_maternal: 'Gonzalez',
          display_name: 'Fernando Suarez',
          username: 'fernando_suarez',
          email: email,
          password_hash: passwordHash,
          permission_level: 'super_admin',
          company_role: 'CEO',
          department: 'Dirección General',
          account_status: 'active',
          is_email_verified: true,
          email_verified_at: new Date().toISOString(),
          timezone: 'America/Mexico_City',
          locale: 'es-MX',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creando usuario:', insertError);
        return NextResponse.json(
          { error: 'Error creando usuario', details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Usuario creado con hash válido',
        user: {
          id: newUser.user_id,
          email: newUser.email,
          name: newUser.display_name,
        },
        hashPreview: passwordHash.substring(0, 30) + '...',
      });
    }
  } catch (error) {
    console.error('Error en reset-test-user:', error);
    return NextResponse.json(
      { error: 'Error interno', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
