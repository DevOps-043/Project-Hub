import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

function getTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('accessToken')?.value;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);

  return null;
}

function normalizeReturnUrl(returnUrl: unknown): string {
  if (typeof returnUrl !== 'string' || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return '/';
  }

  return returnUrl;
}

async function buildGoogleAuthUrl(userId: string, returnUrl: string): Promise<string> {
  // State anti-CSRF: userId + returnUrl codificados y firmados con HMAC
  const stateData = JSON.stringify({
    userId,
    returnUrl,
    timestamp: Date.now(),
  });
  const stateB64 = Buffer.from(stateData).toString('base64url');

  // Firmar el state con HMAC-SHA256
  const secret = process.env.JWT_SECRET || 'iris-super-secret-key-change-in-production';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stateB64));
  const sigB64 = Buffer.from(signature).toString('base64url');
  const state = `${stateB64}.${sigB64}`;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}

/**
 * GET /api/auth/google/connect
 * Inicia el flujo OAuth2 de Google redirigiendo al usuario a la pantalla de consentimiento.
 * Query params:
 *   - returnUrl: URL a donde redirigir después del callback (default: /)
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google OAuth no configurado' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const returnUrl = normalizeReturnUrl(searchParams.get('returnUrl'));
    const authUrl = await buildGoogleAuthUrl(payload.sub, returnUrl);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error en Google connect:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/auth/google/connect
 * Devuelve la URL OAuth para clientes que autentican con Bearer token en
 * localStorage y no pueden enviar Authorization durante una navegacion GET.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google OAuth no configurado' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const authUrl = await buildGoogleAuthUrl(payload.sub, normalizeReturnUrl(body.returnUrl));

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error en Google connect POST:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
