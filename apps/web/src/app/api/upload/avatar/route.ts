/**
 * API Route: POST/DELETE /api/upload/avatar
 * Sube o elimina la foto de perfil del usuario autenticado.
 *
 * El perfil vive en SOFIA Learning, por lo que el destino primario es el
 * bucket `avatars` de SOFIA y la columna `users.profile_picture_url`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';
import { findSofiaUser } from '@/lib/auth/sofia-auth';
import { getSofiaAdmin, isSofiaConfigured } from '@/lib/supabase/sofia-client';

export const runtime = 'nodejs';

const LOCAL_BUCKET_NAME = 'user-avatars';
const SOFIA_BUCKET_NAME = process.env.SOFIA_AVATAR_BUCKET || process.env.NEXT_PUBLIC_SOFIA_AVATAR_BUCKET || 'avatars';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

type AuthenticatedUser = {
  user_id: string;
  email: string;
  username: string;
};

async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'access') {
    return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('account_users')
    .select('user_id, email, username')
    .eq('user_id', payload.sub)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  return user;
}

async function getStorageTarget(user: AuthenticatedUser): Promise<{
  client: SupabaseClient;
  bucket: string;
  storageUserId: string;
  sofiaUserId: string | null;
  isSofia: boolean;
} | NextResponse> {
  if (isSofiaConfigured()) {
    const sofiaUser = await findSofiaUser(user.email || user.username);
    const sofia = getSofiaAdmin();

    if (!sofiaUser) {
      return NextResponse.json({
        error: 'No se encontro el usuario en SOFIA para actualizar la foto de perfil',
      }, { status: 404 });
    }

    if (!sofia) {
      return NextResponse.json({
        error: 'SOFIA Supabase no esta configurado para actualizar la foto de perfil',
      }, { status: 500 });
    }

    return {
      client: sofia,
      bucket: SOFIA_BUCKET_NAME,
      storageUserId: sofiaUser.user_id,
      sofiaUserId: sofiaUser.user_id,
      isSofia: true,
    };
  }

  return {
    client: supabaseAdmin as unknown as SupabaseClient,
    bucket: LOCAL_BUCKET_NAME,
    storageUserId: user.user_id,
    sofiaUserId: null,
    isSofia: false,
  };
}

async function removeExistingAvatars(client: SupabaseClient, bucket: string, folder: string) {
  const { data: existingFiles } = await client.storage.from(bucket).list(folder);
  if (existingFiles?.length) {
    await client.storage.from(bucket).remove(existingFiles.map((file) => `${folder}/${file.name}`));
  }
}

async function syncLocalAvatar(userId: string, avatarUrl: string | null) {
  return supabaseAdmin
    .from('account_users')
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

export async function POST(request: NextRequest) {
  try {
    const userResult = await getAuthenticatedUser(request);
    if (userResult instanceof NextResponse) return userResult;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporciono ningun archivo' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Usa: JPG, PNG, GIF o WebP' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo es demasiado grande. Maximo 5MB' }, { status: 400 });
    }

    const target = await getStorageTarget(userResult);
    if (target instanceof NextResponse) return target;

    const fileBuffer = await file.arrayBuffer();
    const fileExtension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const filePath = `${target.storageUserId}/avatar-${Date.now()}.${fileExtension}`;

    try {
      await removeExistingAvatars(target.client, target.bucket, target.storageUserId);
    } catch (error) {
      console.warn('No se pudieron limpiar avatares anteriores:', error);
    }

    const { error: uploadError } = await target.client.storage
      .from(target.bucket)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Error subiendo avatar:', uploadError);
      return NextResponse.json({
        error: target.isSofia
          ? 'No se pudo subir la imagen al bucket avatars de SOFIA. Revisa las politicas de Storage/RLS o configura SOFIA_SUPABASE_SERVICE_ROLE_KEY.'
          : 'Error al subir la imagen',
        details: uploadError.message,
      }, { status: 500 });
    }

    const { data: urlData } = target.client.storage.from(target.bucket).getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl;

    if (target.isSofia && target.sofiaUserId) {
      const { error: sofiaUpdateError } = await target.client
        .from('users')
        .update({
          profile_picture_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.sofiaUserId);

      if (sofiaUpdateError) {
        console.error('Error actualizando avatar en SOFIA:', sofiaUpdateError);
        return NextResponse.json({
          error: 'Imagen subida, pero SOFIA no permitio actualizar profile_picture_url. Revisa la RLS de users.',
          avatarUrl,
          details: sofiaUpdateError.message,
        }, { status: 500 });
      }
    }

    const { error: localUpdateError } = await syncLocalAvatar(userResult.user_id, avatarUrl);
    if (localUpdateError) {
      console.error('Error sincronizando avatar local:', localUpdateError);
      return NextResponse.json({
        error: 'Imagen subida, pero no se pudo sincronizar Project Hub',
        avatarUrl,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
      source: target.isSofia ? 'sofia' : 'local',
      message: 'Avatar actualizado correctamente',
    });
  } catch (error) {
    console.error('Error en POST /api/upload/avatar:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userResult = await getAuthenticatedUser(request);
    if (userResult instanceof NextResponse) return userResult;

    const target = await getStorageTarget(userResult);
    if (target instanceof NextResponse) return target;

    try {
      await removeExistingAvatars(target.client, target.bucket, target.storageUserId);
    } catch (error) {
      console.warn('No se pudieron eliminar archivos del bucket:', error);
    }

    if (target.isSofia && target.sofiaUserId) {
      const { error: sofiaUpdateError } = await target.client
        .from('users')
        .update({
          profile_picture_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.sofiaUserId);

      if (sofiaUpdateError) {
        return NextResponse.json({
          error: 'No se pudo limpiar profile_picture_url en SOFIA. Revisa la RLS de users.',
          details: sofiaUpdateError.message,
        }, { status: 500 });
      }
    }

    const { error: localUpdateError } = await syncLocalAvatar(userResult.user_id, null);
    if (localUpdateError) {
      return NextResponse.json({ error: 'No se pudo limpiar el avatar local' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Avatar eliminado' });
  } catch (error) {
    console.error('Error en DELETE /api/upload/avatar:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
