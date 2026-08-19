/**
 * API Route: GET, PUT, DELETE /api/admin/users/[id]
 * Operaciones individuales sobre usuarios
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';
import { requireAdmin } from '@/lib/auth/require-role';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Obtener usuario específico
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const { data: user, error } = await supabaseAdmin
      .from('account_users')
      .select('*')
      .eq('user_id', id)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
      timezone: user.timezone,
      locale: user.locale,
      lastLoginAt: user.last_login_at,
      lastActivityAt: user.last_activity_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar usuario
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();

    const {
      firstName,
      lastNamePaternal,
      lastNameMaternal,
      username,
      email,
      password,
      permissionLevel,
      companyRole,
      department,
      phoneNumber,
      accountStatus,
    } = body;

    // Verificar que el usuario existe
    const { data: existingUser } = await supabaseAdmin
      .from('account_users')
      .select('user_id')
      .eq('user_id', id)
      .single();

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar email único si cambió
    if (email) {
      const { data: emailExists } = await supabaseAdmin
        .from('account_users')
        .select('user_id')
        .eq('email', email.toLowerCase())
        .neq('user_id', id)
        .single();

      if (emailExists) {
        return NextResponse.json(
          { error: 'El email ya está en uso por otro usuario' },
          { status: 409 }
        );
      }
    }

    // Verificar username único si cambió
    if (username) {
      const { data: usernameExists } = await supabaseAdmin
        .from('account_users')
        .select('user_id')
        .eq('username', username.toLowerCase())
        .neq('user_id', id)
        .single();

      if (usernameExists) {
        return NextResponse.json(
          { error: 'El nombre de usuario ya está en uso' },
          { status: 409 }
        );
      }
    }

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (firstName) updateData.first_name = firstName;
    if (lastNamePaternal) updateData.last_name_paternal = lastNamePaternal;
    if (lastNameMaternal !== undefined) updateData.last_name_maternal = lastNameMaternal;
    if (username) updateData.username = username.toLowerCase();
    if (email) updateData.email = email.toLowerCase();
    if (permissionLevel) updateData.permission_level = permissionLevel;
    if (companyRole !== undefined) updateData.company_role = companyRole;
    if (department !== undefined) updateData.department = department;
    if (phoneNumber !== undefined) updateData.phone_number = phoneNumber;
    if (accountStatus) updateData.account_status = accountStatus;

    // Si hay nueva contraseña, hashearla
    if (password) {
      updateData.password_hash = await hashPassword(password);
    }

    // Actualizar display_name si cambió nombre
    if (firstName || lastNamePaternal) {
      const { data: currentUser } = await supabaseAdmin
        .from('account_users')
        .select('first_name, last_name_paternal')
        .eq('user_id', id)
        .single();

      const newFirstName = firstName || currentUser?.first_name;
      const newLastName = lastNamePaternal || currentUser?.last_name_paternal;
      updateData.display_name = `${newFirstName} ${newLastName}`;
    }

    // Actualizar usuario
    const { data: updatedUser, error } = await supabaseAdmin
      .from('account_users')
      .update(updateData)
      .eq('user_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { error: 'Error al actualizar usuario', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: {
        id: updatedUser.user_id,
        email: updatedUser.email,
        displayName: updatedUser.display_name,
        accountStatus: updatedUser.account_status,
      },
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar usuario (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    // Verificar que el usuario existe
    const { data: existingUser } = await supabaseAdmin
      .from('account_users')
      .select('user_id, permission_level')
      .eq('user_id', id)
      .single();

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // No permitir eliminar super_admin
    if (existingUser.permission_level === 'super_admin') {
      return NextResponse.json(
        { error: 'No se puede eliminar un super administrador' },
        { status: 403 }
      );
    }

    // Soft delete - marcar como eliminado
    const { error } = await supabaseAdmin
      .from('account_users')
      .update({
        account_status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', id);

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json(
        { error: 'Error al eliminar usuario', details: error.message },
        { status: 500 }
      );
    }

    // También revocar todas las sesiones activas
    await supabaseAdmin
      .from('auth_sessions')
      .update({
        is_active: false,
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'User deleted',
      })
      .eq('user_id', id);

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
