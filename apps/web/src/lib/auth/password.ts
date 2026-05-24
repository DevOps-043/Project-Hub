/**
 * Utilidades para manejo seguro de contraseñas
 * Implementación usando Web Crypto API (compatible con Edge Runtime)
 */

// Constantes para bcrypt-like hashing
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const ALGORITHM = 'PBKDF2';

/**
 * Genera un hash seguro de la contraseña usando PBKDF2
 * Compatible con Edge Runtime (no requiere bcrypt nativo)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    ALGORITHM,
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  
  // Combinar salt + hash y codificar en base64
  const hashArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  
  return `$pbkdf2$${ITERATIONS}$${Buffer.from(combined).toString('base64')}`;
}

/**
 * Genera un hash bcrypt compatible con la tabla users de SofLIA Learning.
 */
export async function hashBcryptPassword(password: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs');
  return bcrypt.hash(password, 12);
}

/**
 * Verifica una contraseña contra su hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Soporte para bcrypt hashes (legacy)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    // Para producción, necesitarías una librería bcrypt compatible con Edge
    // Por ahora, comparamos directamente para desarrollo
    return await verifyBcryptPassword(password, storedHash);
  }
  
  // PBKDF2 hash (nuevo formato)
  if (storedHash.startsWith('$pbkdf2$')) {
    return await verifyPbkdf2Password(password, storedHash);
  }
  
  return false;
}

/**
 * Verifica contraseña con PBKDF2
 */
async function verifyPbkdf2Password(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    
    const iterations = parseInt(parts[2], 10);
    const combined = Buffer.from(parts[3], 'base64');
    
    const salt = combined.slice(0, SALT_LENGTH);
    const originalHash = combined.slice(SALT_LENGTH);
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      ALGORITHM,
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: ALGORITHM,
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      KEY_LENGTH * 8
    );
    
    const newHash = new Uint8Array(derivedBits);
    
    // Comparación timing-safe
    if (originalHash.length !== newHash.length) return false;
    
    let result = 0;
    for (let i = 0; i < originalHash.length; i++) {
      result |= originalHash[i] ^ newHash[i];
    }
    
    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Verifica contraseña bcrypt usando llamada al servidor
 * (bcrypt no es compatible con Edge, pero funciona en Node.js API routes)
 */
async function verifyBcryptPassword(password: string, storedHash: string): Promise<boolean> {
  // Importación dinámica de bcryptjs (solo funciona en Node.js runtime)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(password, storedHash);
  } catch {
    console.error('bcryptjs no disponible, usando fallback');
    return false;
  }
}
