/**
 * Utilidades para JWT (JSON Web Tokens)
 * Implementación usando Web Crypto API
 */

import { AccountUser } from '../supabase/server';

const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hora en segundos
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7 días en segundos
const DEVELOPMENT_JWT_SECRET = 'iris-super-secret-key-change-in-production';

let cachedSecret: string | null = null;
let cachedSigningKey: Promise<CryptoKey> | null = null;

// Tipos
export interface JWTPayload {
  sub: string; // user_id
  email: string;
  name: string;
  role: string;
  permissionLevel: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no esta configurado');
  }

  return secret || DEVELOPMENT_JWT_SECRET;
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = getJwtSecret();

  if (!cachedSigningKey || cachedSecret !== secret) {
    cachedSecret = secret;
    cachedSigningKey = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }

  return cachedSigningKey;
}

/**
 * Codifica un string a Base64URL
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decodifica Base64URL a string
 */
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) {
    str += '='.repeat(4 - pad);
  }
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Crea una firma HMAC-SHA256
 */
function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }

  return diff === 0;
}

async function sign(data: string): Promise<Uint8Array> {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  return new Uint8Array(signature);
}

async function createSignature(data: string): Promise<string> {
  return base64UrlEncodeBytes(await sign(data));
}

async function createLegacySignature(data: string): Promise<string> {
  return base64UrlEncode(String.fromCharCode(...await sign(data)));
}

/**
 * Genera un token JWT
 */
async function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: number): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = await createSignature(signatureInput);
  
  return `${signatureInput}.${signature}`;
}

/**
 * Verifica y decodifica un token JWT
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signature] = parts;
    const signatureInput = `${headerB64}.${payloadB64}`;
    const header = JSON.parse(base64UrlDecode(headerB64));

    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const [expectedSignature, legacySignature] = await Promise.all([
      createSignature(signatureInput),
      createLegacySignature(signatureInput),
    ]);
    
    // Verificar firma
    if (
      !constantTimeEqual(signature, expectedSignature) &&
      !constantTimeEqual(signature, legacySignature)
    ) {
      return null;
    }
    
    // Decodificar payload
    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));
    
    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Genera par de tokens (access + refresh) para un usuario
 */
export async function generateTokenPair(user: AccountUser): Promise<TokenPair> {
  const basePayload = {
    sub: user.user_id,
    email: user.email,
    name: user.display_name || `${user.first_name} ${user.last_name_paternal}`,
    role: user.company_role || 'user',
    permissionLevel: user.permission_level,
  };
  
  const accessToken = await generateToken(
    { ...basePayload, type: 'access' },
    ACCESS_TOKEN_EXPIRY
  );
  
  const refreshToken = await generateToken(
    { ...basePayload, type: 'refresh' },
    REFRESH_TOKEN_EXPIRY
  );
  
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

/**
 * Hash de un token para almacenamiento seguro
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
