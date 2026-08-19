/**
 * GET /api/auth/callback/learning
 *
 * Callback del login federado con SofLIA Learning (ver
 * `learning-sso-federated-login.md`). Recibe `?state=&ticket=` (o
 * `&error=`) de Learning, canjea el ticket server-to-server, valida la
 * identidad contra SOFIA y produce una sesion local de Project Hub por el
 * mismo camino que el login por password (`completeSofiaLogin`).
 *
 * Ruta publica: el usuario todavia no tiene sesion en Project Hub en este
 * punto del flujo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyLearningSsoState } from '@/lib/auth/learning-sso-state';
import { authenticateSofiaSsoSession, exchangeSofiaMagicLink } from '@/lib/auth/sofia-auth';
import { completeSofiaLogin } from '@/lib/auth/sofia-login-pipeline';
import { resolvePostLoginDestination } from '@/lib/auth/post-login-redirect';

const LEARNING_BASE_URL = process.env.LEARNING_BASE_URL || '';

// Misma taxonomia que ya define el documento para el escritorio (§5, §9.5):
// invalid_ticket / access_denied / exchange_unavailable, mas invalid_state
// para el anti-CSRF propio de este callback.
type SsoErrorCode = 'invalid_ticket' | 'access_denied' | 'exchange_unavailable' | 'invalid_state';

const EXCHANGE_RETRY_DELAYS_MS = [250, 750];

function errorRedirect(request: NextRequest, code: SsoErrorCode): NextResponse {
  const url = new URL('/auth/sign-in', request.url);
  url.searchParams.set('sso_error', code);
  const res = NextResponse.redirect(url);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

type ExchangeResult = { tokenHash: string } | { errorCode: SsoErrorCode };

/**
 * POST server-to-server (sin cookies) contra el exchange de Learning.
 * 401/403 no se reintentan (credencial invalida, no un problema transitorio);
 * 429/5xx y errores de red si, con el mismo backoff acotado que usa el Hub.
 */
async function exchangeTicket(ticket: string, codeVerifier: string): Promise<ExchangeResult> {
  for (let attempt = 0; attempt <= EXCHANGE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetch(`${LEARNING_BASE_URL}/api/auth/web/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, code_verifier: codeVerifier }),
        credentials: 'omit',
      });

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { tokenHash?: string } | null;
        if (data?.tokenHash) return { tokenHash: data.tokenHash };
        return { errorCode: 'exchange_unavailable' };
      }

      if (res.status === 400 || res.status === 401) return { errorCode: 'invalid_ticket' };
      if (res.status === 403) return { errorCode: 'access_denied' };
      // 429/5xx: cae al reintento de abajo.
    } catch {
      // Error de red: cae al reintento de abajo.
    }

    if (attempt < EXCHANGE_RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, EXCHANGE_RETRY_DELAYS_MS[attempt]));
    }
  }

  return { errorCode: 'exchange_unavailable' };
}

/**
 * Pagina puente minima: el resto de Project Hub lee la sesion desde
 * localStorage (Bearer header), no desde la cookie httpOnly (esa solo la
 * usa el middleware para proteger paginas). Este es el unico salto que
 * necesita el cliente para terminar de "iniciar sesion" tras la
 * redireccion HTTPS — sin cookie puente ni segunda ruta.
 */
function buildBootstrapHtml(accessToken: string, refreshToken: string, destination: string): string {
  const payload = JSON.stringify({ accessToken, refreshToken, destination }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Project Hub</title></head>
<body>
<script>
(function () {
  var data = ${payload};
  try {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  } catch (e) {}
  window.location.replace(data.destination);
})();
</script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  if (!LEARNING_BASE_URL) {
    return errorRedirect(request, 'exchange_unavailable');
  }

  const { searchParams } = new URL(request.url);
  const stateParam = searchParams.get('state');
  const ticket = searchParams.get('ticket');
  const learningError = searchParams.get('error');

  if (learningError) {
    return errorRedirect(request, 'access_denied');
  }

  if (!stateParam) {
    return errorRedirect(request, 'invalid_state');
  }

  const stateData = await verifyLearningSsoState(stateParam);
  if (!stateData) {
    return errorRedirect(request, 'invalid_state');
  }

  if (!ticket) {
    return errorRedirect(request, 'invalid_ticket');
  }

  const exchangeResult = await exchangeTicket(ticket, stateData.codeVerifier);
  if ('errorCode' in exchangeResult) {
    return errorRedirect(request, exchangeResult.errorCode);
  }

  const sofiaAccessToken = await exchangeSofiaMagicLink(exchangeResult.tokenHash);
  if (!sofiaAccessToken) {
    return errorRedirect(request, 'invalid_ticket');
  }

  const sofiaAuth = await authenticateSofiaSsoSession(sofiaAccessToken);
  if (!sofiaAuth.success || !sofiaAuth.user) {
    // Sin sesion parcial: si el perfil no resuelve o la cuenta esta
    // suspendida, no se genera JWT ni cookie de Project Hub.
    const code: SsoErrorCode = sofiaAuth.errorCode === 'ACCOUNT_INACTIVE' ? 'access_denied' : 'invalid_ticket';
    return errorRedirect(request, code);
  }

  const loginResponse = await completeSofiaLogin(
    sofiaAuth.user,
    sofiaAccessToken,
    request,
    sofiaAuth.user.email
  );

  const destination = resolvePostLoginDestination({
    workspaces: loginResponse.workspaces,
    role: loginResponse.user.role,
    permissionLevel: loginResponse.user.permissionLevel,
    returnUrl: stateData.returnUrl,
  });

  const html = buildBootstrapHtml(loginResponse.accessToken, loginResponse.refreshToken, destination);

  const res = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

  res.cookies.set('accessToken', loginResponse.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });

  return res;
}
