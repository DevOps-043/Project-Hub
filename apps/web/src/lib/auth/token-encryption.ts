/**
 * Encriptación/Desencriptación de tokens OAuth
 * Usa AES-256-GCM con Web Crypto API para almacenar tokens de forma segura
 * en la tabla auth_oauth_providers (access_token_encrypted, refresh_token_encrypted)
 */

const ENCRYPTION_SECRET = process.env.JWT_SECRET || 'iris-super-secret-key-change-in-production';

/**
 * Deriva una clave AES-256 desde el secreto usando PBKDF2
 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_SECRET),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encripta un token usando AES-256-GCM
 * @returns string en formato "salt:iv:ciphertext" (todo en base64)
 */
export async function encryptToken(plainToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainToken)
  );

  const saltB64 = Buffer.from(salt).toString('base64');
  const ivB64 = Buffer.from(iv).toString('base64');
  const ciphertextB64 = Buffer.from(encrypted).toString('base64');

  return `${saltB64}:${ivB64}:${ciphertextB64}`;
}

/**
 * Desencripta un token desde formato "salt:iv:ciphertext"
 * @returns el token original en texto plano
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  const parts = encryptedToken.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de token encriptado inválido');
  }

  const [saltB64, ivB64, ciphertextB64] = parts;
  const salt = new Uint8Array(Buffer.from(saltB64, 'base64'));
  const iv = new Uint8Array(Buffer.from(ivB64, 'base64'));
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const key = await deriveKey(salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
