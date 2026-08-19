import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

import { GET } from './route';

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/faqs', () => {
  it('returns only active FAQs ordered by display_order', async () => {
    const fake = createFakeSupabaseAdmin({
      faqs: [{ data: [{ id: 'f1', question: 'How?', is_active: true }] }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(new NextRequest('https://app.example.com/api/faqs'))).json();
    expect(json).toHaveLength(1);
  });

  it('returns 500 without crashing when the query fails', async () => {
    const fake = createFakeSupabaseAdmin({ faqs: [{ data: null, error: { message: 'db down' } }] });
    state.from.mockImplementation(fake.from);

    const res = await GET(new NextRequest('https://app.example.com/api/faqs'));
    expect(res.status).toBe(500);
  });
});
