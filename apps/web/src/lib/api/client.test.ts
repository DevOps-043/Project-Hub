import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, apiClient } from './client';

// vitest.config.mts runs this suite with `environment: 'node'`, so there is
// no browser `window`/`localStorage` by default. client.ts gates all token
// access behind `typeof window === 'undefined'`, so we stub a minimal
// window + localStorage here to exercise the auth-header/refresh paths.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const jsonResponse = (body: unknown, init?: Partial<{ status: number; ok: boolean }>) => {
  const status = init?.status ?? 200;
  return {
    ok: init?.ok ?? (status >= 200 && status < 300),
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => body,
  } as Response;
};

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let localStorageMock: MemoryStorage;

  beforeEach(() => {
    localStorageMock = new MemoryStorage();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { location: { href: '' } });

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('serializes a plain object body as JSON and sets Content-Type: application/json', async () => {
    localStorageMock.setItem('accessToken', 'token-123');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await api.post('/api/things', { name: 'widget' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/things');
    expect(options.body).toBe(JSON.stringify({ name: 'widget' }));
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toBe('Bearer token-123');
  });

  it('passes a FormData body through unmodified without forcing a Content-Type header', async () => {
    localStorageMock.setItem('accessToken', 'token-123');
    fetchMock.mockResolvedValueOnce(jsonResponse({ avatarUrl: 'https://example.com/a.png' }));

    const formData = new FormData();
    formData.append('file', new Blob(['hello']), 'avatar.png');

    await api.post('/api/upload/avatar', formData);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/upload/avatar');
    expect(options.body).toBe(formData);
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.headers['Authorization']).toBe('Bearer token-123');
  });

  it('refreshes the token on a 401 and retries the request once, succeeding with the new token', async () => {
    localStorageMock.setItem('accessToken', 'old-token');
    localStorageMock.setItem('refreshToken', 'refresh-token');

    fetchMock
      // initial request -> 401
      .mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, { status: 401, ok: false }))
      // refresh call -> success
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-token', refreshToken: 'new-refresh' }))
      // retried request -> success
      .mockResolvedValueOnce(jsonResponse({ items: [1, 2, 3] }));

    const result = await api.get<{ items: number[] }>('/api/things');

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const refreshCall = fetchMock.mock.calls[1];
    expect(refreshCall[0]).toBe('/api/auth/refresh');

    const retriedCall = fetchMock.mock.calls[2];
    expect(retriedCall[1].headers['Authorization']).toBe('Bearer new-token');

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ items: [1, 2, 3] });
    expect(localStorageMock.getItem('accessToken')).toBe('new-token');
  });

  it('clears tokens and returns an error when a 401 cannot be refreshed (no refresh token stored)', async () => {
    localStorageMock.setItem('accessToken', 'old-token');
    // no refreshToken stored -> refreshTokens() short-circuits to false

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, { status: 401, ok: false }));

    const result = await apiClient('/api/things', { skipAuth: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(401);
    expect(result.data).toBeNull();
    expect(result.error).toBe('Sesión expirada. Por favor inicia sesión nuevamente.');
    expect(localStorageMock.getItem('accessToken')).toBeNull();
    expect(localStorageMock.getItem('refreshToken')).toBeNull();
  });
});
