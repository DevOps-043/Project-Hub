import { describe, expect, it, vi } from 'vitest';
import { signOAuthState, verifyOAuthState } from './oauth-state';

describe('signOAuthState + verifyOAuthState', () => {
  it('firma y verifica un state válido, recuperando userId y returnUrl', async () => {
    const state = await signOAuthState('user-123', '/workspace/proyectos');
    const result = await verifyOAuthState(state);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-123');
    expect(result?.returnUrl).toBe('/workspace/proyectos');
  });

  it('rechaza un state con firma alterada (protección CSRF)', async () => {
    const state = await signOAuthState('user-123', '/');
    const [payload, signature] = state.split('.');
    const tampered = `${payload}.${signature.slice(0, -2)}${signature.slice(-2) === 'AA' ? 'BB' : 'AA'}`;

    expect(await verifyOAuthState(tampered)).toBeNull();
  });

  it('rechaza un state con el userId alterado en el payload (firma ya no calza)', async () => {
    const state = await signOAuthState('user-123', '/');
    const [payload, signature] = state.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    decoded.userId = 'victim-user-id';
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    expect(await verifyOAuthState(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it('rechaza formatos malformados', async () => {
    expect(await verifyOAuthState('sin-punto')).toBeNull();
    expect(await verifyOAuthState('')).toBeNull();
  });

  it('rechaza un state expirado (más de 10 minutos)', async () => {
    vi.useFakeTimers();
    try {
      const state = await signOAuthState('user-123', '/');
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(await verifyOAuthState(state)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('acepta un state todavía dentro de la ventana de 10 minutos', async () => {
    vi.useFakeTimers();
    try {
      const state = await signOAuthState('user-123', '/');
      vi.advanceTimersByTime(9 * 60 * 1000);
      expect(await verifyOAuthState(state)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
