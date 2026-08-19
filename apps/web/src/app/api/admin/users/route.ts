/**
 * API Route: GET, POST /api/admin/users
 * Gestión de usuarios desde el panel de administración
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';
import { requireAdmin } from '@/lib/auth/require-role';
import { sanitizeSearchTerm } from '@/lib/http/sanitize';

export const runtime = 'nodejs';

// GET - Listar usuarios con paginación y filtros
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = sanitizeSearchTerm(searchParams.get('search') || '');
    const status = searchParams.get('status') || '';
    const role = searchParams.get('role') || '';

    const offset = (page - 1) * limit;

    // Construir query base
    let query = supabaseAdmin
      .from('account_users')
      .select('*', { count: 'exact' })
      .neq('account_status', 'deleted') // No mostrar usuarios eliminados
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name_paternal.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('account_status', status);
    }

    if (role) {
      query = query.eq('permission_level', role);
    }

    // Aplicar paginación
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Error al obtener usuarios', details: error.message },
        { status: 500 }
      );
    }

    // Mapear usuarios para no exponer password_hash
    const safeUsers = users?.map(user => ({
      id: user.user_id,
      firstName: user.first_name,
      lastNamePaternal: user.last_name_paternal,
      lastNameMaternal: user.last_name_maternal,
      displayName: user.display_name,
      username: user.username,
      email: user.email,
      permissionLevel: user.permission_level,
      companyRole: user.company_role,
      department: user.department,
      accountStatus: user.account_status,
      isEmailVerified: user.is_email_verified,
      avatarUrl: user.avatar_url,
      phoneNumber: user.phone_number,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

    return NextResponse.json({
      users: safeUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo usuario
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    
    const {
      firstName,
      lastNamePaternal,
      lastNameMaternal,
      email,
      username,
      password,
      permissionLevel = 'user',
      companyRole,
      department,
      phoneNumber,
    } = body;

    // Validaciones
    if (!firstName || !lastNamePaternal || !email || !username || !password) {
      return NextResponse.json(
        { error: 'Campos requeridos: firstName, lastNamePaternal, email, username, password' },
        { status: 400 }
      );
    }

    // Verificar email único
    const { data: existingEmail } = await supabaseAdmin
      .from('account_users')
      .select('user_id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingEmail) {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 409 }
      );
    }

    // Verificar username único
    const { data: existingUsername } = await supabaseAdmin
      .from('account_users')
      .select('user_id')
      .eq('username', username.toLowerCase())
      .single();

    if (existingUsername) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya está en uso' },
        { status: 409 }
      );
    }

    // Hashear contraseña
    const passwordHash = await hashPassword(password);

    // Crear usuario
    const { data: newUser, error } = await supabaseAdmin
      .from('account_users')
      .insert({
        first_name: firstName,
        last_name_paternal: lastNamePaternal,
        last_name_maternal: lastNameMaternal || null,
        display_name: `${firstName} ${lastNamePaternal}`,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        permission_level: permissionLevel,
        company_role: companyRole || null,
        department: department || null,
        phone_number: phoneNumber || null,
        account_status: 'active',
        is_email_verified: true, // Por ahora, marcamos como verificado
        email_verified_at: new Date().toISOString(),
        timezone: 'America/Mexico_City',
        locale: 'es-MX',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Error al crear usuario', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.display_name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
