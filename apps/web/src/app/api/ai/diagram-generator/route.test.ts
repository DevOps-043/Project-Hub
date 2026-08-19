import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@/lib/ai/gemini', () => ({
  getGeminiModel: () => ({ generateContent: (...args: unknown[]) => state.generateContent(...args) }),
}));

import { POST } from './route';

function makeUser(overrides: Partial<AccountUser> = {}): AccountUser {
  return {
    user_id: 'user-1',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: null,
    display_name: 'Fernando Suarez',
    username: 'fernando',
    email: 'fernando@example.com',
    password_hash: 'irrelevant',
    permission_level: 'user',
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
    ...overrides,
  };
}

async function authedRequest(body: unknown) {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest('https://app.example.com/api/ai/diagram-generator', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.generateContent.mockReset();
});

describe('POST /api/ai/diagram-generator', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/ai/diagram-generator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a flow' }),
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('rejects with 400 when prompt is missing', async () => {
    const req = await authedRequest({});
    expect((await POST(req)).status).toBe(400);
  });

  it('returns the cleaned Mermaid code on success', async () => {
    state.generateContent.mockResolvedValue({
      response: { text: () => '```mermaid\ngraph TD\n  A --> B\n```' },
    });
    const req = await authedRequest({ prompt: 'a simple flow' });
    const json = await (await POST(req)).json();
    expect(json.code).toBe('graph TD\n  A --> B');
  });

  it('returns 422 when the model produces no usable diagram code', async () => {
    state.generateContent.mockResolvedValue({ response: { text: () => '' } });
    const req = await authedRequest({ prompt: 'a simple flow' });
    expect((await POST(req)).status).toBe(422);
  });

  it('returns 500 without crashing when Gemini throws', async () => {
    state.generateContent.mockRejectedValue(new Error('quota exceeded'));
    const req = await authedRequest({ prompt: 'a simple flow' });
    expect((await POST(req)).status).toBe(500);
  });
});
