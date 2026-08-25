import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateSofiaSsoSession } from '@/lib/auth/sofia-auth';
import { completeSofiaLogin } from '@/lib/auth/sofia-login-pipeline';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';

export const runtime = 'nodejs';
const schema = z.object({ sofia_access_token: z.string().min(40).optional() });

export async function POST(request: NextRequest) {
  try {
    if (process.env.PROJECT_HUB_API_V1 === 'false') throw new ApiError(503, 'FEATURE_DISABLED', 'Project Hub API v1 no está habilitada');
    const body = await jsonBody(request, schema);
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const token = body.sofia_access_token || bearer;
    if (!token) throw new ApiError(401, 'SOFIA_TOKEN_REQUIRED', 'Token SOFIA requerido');

    const verified = await authenticateSofiaSsoSession(token);
    if (!verified.success || !verified.user) {
      throw new ApiError(401, 'SOFIA_TOKEN_INVALID', 'La sesión SOFIA no es válida');
    }
    const login = await completeSofiaLogin(verified.user, token, request, verified.user.email || verified.user.user_id);
    if (!login.workspaces.length) throw new ApiError(403, 'WORKSPACE_REQUIRED', 'No existe una membresía activa');

    return ok(request, {
      user: login.user,
      workspaces: login.workspaces,
      access_token: login.accessToken,
      refresh_token: login.refreshToken,
      expires_in: 3600,
    });
  } catch (error) {
    return fail(request, error);
  }
}
