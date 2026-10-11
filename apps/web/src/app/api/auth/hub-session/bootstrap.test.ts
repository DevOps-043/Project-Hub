import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const user = { id: 'hub-user', email: 'persona@test.test', name: 'Persona', role: 'user', createdAt: '2026-10-10', updatedAt: '2026-10-10' };
beforeEach(() => {
  vi.resetModules();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());
describe('Arranque cliente de Project Hub con sesión de PulseHub', () => {
  it('consume la sesión local nueva y sustituye una cuenta persistida anterior', async () => {
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(user)));
    vi.stubGlobal('fetch', fetcher);
    const { useAuthStore } = await import('@/core/stores/authStore');
    useAuthStore.getState().setWorkspaces([{ id: 'old', slug: 'old', name: 'Anterior', role: 'user' }]);
    await useAuthStore.getState().initialize();
    expect(fetcher.mock.calls[0]).toEqual(['/api/auth/hub-session', { credentials: 'same-origin', cache: 'no-store' }]);
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer new-access' });
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    expect(useAuthStore.getState()).toMatchObject({ isInitialized: true, isAuthenticated: true, user: { id: 'hub-user' }, workspaces: [] });
  });
  it('sin puente conserva y renueva la cuenta elegida en la web', async () => {
    localStorage.setItem('accessToken', 'chosen-expired');
    localStorage.setItem('refreshToken', 'chosen-refresh');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'chosen-renewed', refreshToken: 'chosen-refresh-next' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...user, id: 'chosen-user' })));
    vi.stubGlobal('fetch', fetcher);
    const { useAuthStore } = await import('@/core/stores/authStore');
    await useAuthStore.getState().initialize();
    expect(fetcher.mock.calls[2]).toEqual(['/api/auth/refresh', expect.objectContaining({ body: '{"refreshToken":"chosen-refresh"}' })]);
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, user: { id: 'chosen-user' } });
  });
  it('sin puente ni sesión guardada mantiene el sitio cerrado', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const { useAuthStore } = await import('@/core/stores/authStore');
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState()).toMatchObject({ isInitialized: true, isAuthenticated: false, user: null });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
