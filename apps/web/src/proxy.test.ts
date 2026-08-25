import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('proxy API v1 auth bootstrap', () => {
  it.each([
    '/api/v1/auth/sofia/exchange',
    '/api/v1/auth/refresh',
  ])('permite %s sin un JWT previo de Project Hub', (pathname) => {
    const response = proxy(new NextRequest(`https://project.example${pathname}`, { method: 'POST' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('mantiene protegidas las rutas de datos v1', async () => {
    const response = proxy(new NextRequest('https://project.example/api/v1/workspaces/workspace/projects'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
