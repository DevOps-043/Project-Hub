/**
 * API Route: POST /api/auth/register
 * Maneja el registro de nuevos usuarios
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';
import { generateTokenPair, hashToken } from '@/lib/auth/jwt';
import { detectDeviceType, detectBrowser } from '@/lib/http/user-agent';

// Forzar runtime de Node.js
export const runtime = 'nodejs';

interface RegisterRequest {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string;
  email: string;
  password: string;
  username: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { firstName, lastNamePaternal, lastNameMaternal, email, password, username } = body;

    // Validaciones básicas
    if (!firstName || !lastNamePaternal || !email || !password || !username) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/i;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    // Validar formato de username
    const usernameRegex = /^[A-Za-z0-9_-]{3,50}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'El nombre de usuario debe tener entre 3-50 caracteres y solo puede contener letras, números, guiones y guiones bajos' },
        { status: 400 }
      );
    }

    // Validar contraseña (mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const { data: existingEmail } = await supabaseAdmin
      .from('account_users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Este correo electrónico ya está registrado' },
        { status: 409 }
      );
    }

    // Verificar si el username ya existe
    const { data: existingUsername } = await supabaseAdmin
      .from('account_users')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Este nombre de usuario ya está en uso' },
        { status: 409 }
      );
    }

    // Hashear contraseña
    const passwordHash = await hashPassword(password);

    // Crear usuario
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('account_users')
      .insert({
        first_name: firstName,
        last_name_paternal: lastNamePaternal,
        last_name_maternal: lastNameMaternal || null,
        display_name: `${firstName} ${lastNamePaternal}`,
        username: username,
        email: email,
        password_hash: passwordHash,
        permission_level: 'user', // Por defecto, usuario normal
        account_status: 'pending_verification',
        is_email_verified: false,
        timezone: 'America/Mexico_City',
        locale: 'es-MX',
      })
      .select()
      .single();

    if (insertError || !newUser) {
      console.error('Error al crear usuario:', insertError);
      return NextResponse.json(
        { error: 'Error al crear la cuenta. Intenta nuevamente.' },
        { status: 500 }
      );
    }

    // Generar tokens JWT
    const tokens = await generateTokenPair(newUser);

    // Crear sesión en la base de datos
    const sessionData = {
      user_id: newUser.user_id,
      token_hash: await hashToken(tokens.accessToken),
      refresh_token_hash: await hashToken(tokens.refreshToken),
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
      device_type: detectDeviceType(request.headers.get('user-agent') || ''),
      browser_name: detectBrowser(request.headers.get('user-agent') || ''),
      expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      is_active: true,
    };

    await supabaseAdmin.from('auth_sessions').insert(sessionData);

    // TODO: Enviar email de verificación
    // await sendVerificationEmail(email, newUser.user_id);

    // Mapear usuario al formato esperado por el frontend
    const responseUser = {
      id: newUser.user_id,
      email: newUser.email,
      name: newUser.display_name || `${newUser.first_name} ${newUser.last_name_paternal}`,
      role: 'user' as const,
      createdAt: new Date(newUser.created_at),
      updatedAt: new Date(newUser.updated_at),
    };

    return NextResponse.json({
      user: responseUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Cuenta creada exitosamente. Por favor verifica tu correo electrónico.',
    }, { status: 201 });

  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

