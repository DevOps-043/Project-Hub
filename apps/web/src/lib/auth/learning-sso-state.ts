/**
 * Firma y verificación del parámetro `state` del flujo SSO federado con
 * SofLIA Learning (ver `learning-sso-federated-login.md`).
 *
 * Mismo patrón HMAC que `oauth-state.ts` (usado por el connect de Google),
 * pero con su propio payload: aquí el usuario todavía NO tiene sesión en
 * Project Hub (ese es el punto del flujo), así que no hay `userId` que
 * firmar. En su lugar viaja el `code_verifier` PKCE — el intercambio con
 * Learning ocurre server-to-server en el callback, así que no hace falta
 * persistirlo aparte en cookie o `sessionStorage`.
 */

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos — igual que oauth-state.ts

export interface LearningSsoStateData {
  codeVerifier: string;
  returnUrl: string;
  timestamp: number;
}

function getStateSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no esta configurado');
  }
  return 'iris-super-secret-key-change-in-production';
}

async function getHmacKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const secret = getStateSecret();
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

export async function signLearningSsoState(codeVerifier: string, returnUrl: string): Promise<string> {
  const stateData: LearningSsoStateData = { codeVerifier, returnUrl, timestamp: Date.now() };
  const stateB64 = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  const key = await getHmacKey('sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stateB64));
  const sigB64 = Buffer.from(signature).toString('base64url');

  return `${stateB64}.${sigB64}`;
}

export async function verifyLearningSsoState(state: string): Promise<LearningSsoStateData | null> {
  try {
    const [stateB64, sigB64] = state.split('.');
    if (!stateB64 || !sigB64) return null;

    const key = await getHmacKey('verify');
    const signatureBytes = Buffer.from(sigB64, 'base64url');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(stateB64)
    );
    if (!valid) return null;

    const stateData = JSON.parse(Buffer.from(stateB64, 'base64url').toString('utf-8')) as LearningSsoStateData;

    if (Date.now() - stateData.timestamp > STATE_MAX_AGE_MS) return null;

    return stateData;
  } catch {
    return null;
  }
}
