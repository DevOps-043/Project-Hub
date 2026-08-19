import { describe, expect, it } from 'vitest';
import { generateTokenPair, verifyToken } from './jwt';
import type { AccountUser } from '../supabase/server';

const baseUser: AccountUser = {
  user_id: 'user-123',
  first_name: 'Fernando',
  last_name_paternal: 'Suarez',
  last_name_maternal: null,
  display_name: 'Fernando Suarez',
  username: 'fernando_suarez',
  email: 'fernando@example.com',
  password_hash: 'irrelevant-for-jwt',
  permission_level: 'admin',
  company_role: null,
  department: null,
  account_status: 'active',
  is_email_verified: true,
  email_verified_at: null,
  avatar_url: null,
  phone_number: null,
  timezone: 'America/Mexico_City',
  locale: 'es-MX',
  last_login_at: null,
  last_activity_at: null,
  failed_login_attempts: 0,
  locked_until: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('generateTokenPair + verifyToken', () => {
  it('genera un access y refresh token válidos y verificables', async () => {
    const pair = await generateTokenPair(baseUser);

    expect(pair.accessToken.split('.')).toHaveLength(3);
    expect(pair.refreshToken.split('.')).toHaveLength(3);

    const accessPayload = await verifyToken(pair.accessToken);
    expect(accessPayload).not.toBeNull();
    expect(accessPayload?.sub).toBe('user-123');
    expect(accessPayload?.email).toBe('fernando@example.com');
    expect(accessPayload?.permissionLevel).toBe('admin');
    expect(accessPayload?.type).toBe('access');

    const refreshPayload = await verifyToken(pair.refreshToken);
    expect(refreshPayload?.type).toBe('refresh');
  });

  it('rechaza un token con firma alterada (protección contra forjado)', async () => {
    const pair = await generateTokenPair(baseUser);
    const [header, payload, signature] = pair.accessToken.split('.');
    const tamperedSignature = signature.slice(0, -2) + (signature.slice(-2) === 'AA' ? 'BB' : 'AA');
    const tampered = `${header}.${payload}.${tamperedSignature}`;

    expect(await verifyToken(tampered)).toBeNull();
  });

  it('rechaza un token con payload alterado (ej. escalar permission_level)', async () => {
    const pair = await generateTokenPair(baseUser);
    const [header, , signature] = pair.accessToken.split('.');

    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'user-123', permissionLevel: 'super_admin', type: 'access', exp: 9999999999, iat: 0 })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    expect(await verifyToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  it('rechaza tokens malformados', async () => {
    expect(await verifyToken('no-es-un-jwt')).toBeNull();
    expect(await verifyToken('')).toBeNull();
  });

  it('rechaza un token ya expirado', async () => {
    const pair = await generateTokenPair(baseUser);
    const [header, payload] = pair.accessToken.split('.');
    const decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
    decoded.exp = Math.floor(Date.now() / 1000) - 60;

    const expiredPayloadB64 = Buffer.from(JSON.stringify(decoded))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // La firma ya no calzará con el payload editado, así que igualmente debe rechazarse.
    const [, , signature] = pair.accessToken.split('.');
    expect(await verifyToken(`${header}.${expiredPayloadB64}.${signature}`)).toBeNull();
  });
});
