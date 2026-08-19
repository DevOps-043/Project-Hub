/**
 * GET /api/auth/learning/start
 *
 * Inicia el login federado con SofLIA Learning (ver
 * `learning-sso-federated-login.md`, seccion "Guia de portabilidad a
 * Project Hub"). Genera el par PKCE (S256) y un `state` firmado que viaja
 * el `code_verifier` — el intercambio ocurre server-to-server en el
 * callback, asi que no hace falta persistirlo en cookie ni sessionStorage.
 *
 * Ruta publica (el usuario todavia no tiene sesion en Project Hub).
 */

import { NextRequest, NextResponse } from 'next/server';
import { signLearningSsoState } from '@/lib/auth/learning-sso-state';

const LEARNING_BASE_URL = process.env.LEARNING_BASE_URL || '';
const LEARNING_REDIRECT_URI =
  process.env.LEARNING_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/learning';
const LEARNING_SSO_ENABLED = process.env.LEARNING_SSO_ENABLED === 'true';

function normalizeReturnUrl(returnUrl: unknown): string {
  if (typeof returnUrl !== 'string' || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return '/select-organization';
  }
  return returnUrl;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64UrlEncode(verifierBytes);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

export async function GET(request: NextRequest) {
  // Interruptor real: si esta apagado, la entrada no existe (no solo se
  // oculta el boton). Mismo criterio que el flujo de escritorio.
  if (!LEARNING_SSO_ENABLED || !LEARNING_BASE_URL) {
    return NextResponse.json({ error: 'SSO de Learning no esta configurado' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const returnUrl = normalizeReturnUrl(searchParams.get('returnUrl'));

  const { codeVerifier, codeChallenge } = await generatePkcePair();
  const state = await signLearningSsoState(codeVerifier, returnUrl);

  const startUrl = new URL('/api/auth/web/start', LEARNING_BASE_URL);
  startUrl.searchParams.set('state', state);
  startUrl.searchParams.set('redirect_uri', LEARNING_REDIRECT_URI);
  startUrl.searchParams.set('code_challenge', codeChallenge);

  const res = NextResponse.redirect(startUrl.toString());
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
