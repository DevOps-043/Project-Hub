/**
 * Firma y verificación del parámetro `state` anti-CSRF del flujo OAuth de
 * Google. Antes esta lógica (y su fallback de secreto) estaba duplicada
 * entre connect/route.ts (firma) y callback/google/route.ts (verifica) —
 * una sola de las dos copias tenía el guard de producción, así que un
 * JWT_SECRET no configurado en prod dejaba forjable el `state`.
 */

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

export interface OAuthStateData {
  userId: string;
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

export async function signOAuthState(userId: string, returnUrl: string): Promise<string> {
  const stateData: OAuthStateData = { userId, returnUrl, timestamp: Date.now() };
  const stateB64 = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  const key = await getHmacKey('sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stateB64));
  const sigB64 = Buffer.from(signature).toString('base64url');

  return `${stateB64}.${sigB64}`;
}

export async function verifyOAuthState(state: string): Promise<OAuthStateData | null> {
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

    const stateData = JSON.parse(Buffer.from(stateB64, 'base64url').toString('utf-8')) as OAuthStateData;

    if (Date.now() - stateData.timestamp > STATE_MAX_AGE_MS) return null;

    return stateData;
  } catch {
    return null;
  }
}
