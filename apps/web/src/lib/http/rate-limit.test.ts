import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRateLimitStateForTests, checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    __resetRateLimitStateForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit within the window', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('login:1.2.3.4', 5, 60_000).allowed).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('login:1.2.3.4', 5, 60_000);
    }
    const result = checkRateLimit('login:1.2.3.4', 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets the count once the window elapses', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('login:1.2.3.4', 5, 60_000);
    }
    expect(checkRateLimit('login:1.2.3.4', 5, 60_000).allowed).toBe(false);

    vi.setSystemTime(60_001);

    expect(checkRateLimit('login:1.2.3.4', 5, 60_000).allowed).toBe(true);
  });

  // Security invariant: a brute-force attempt from IP A must never consume
  // or be affected by IP B's quota, and vice versa.
  it('tracks separate keys independently so one IP cannot exhaust another\'s quota', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('login:1.2.3.4', 5, 60_000);
    }
    expect(checkRateLimit('login:1.2.3.4', 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit('login:5.6.7.8', 5, 60_000).allowed).toBe(true);
  });

  it('keeps register and login buckets for the same IP independent', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('/api/auth/register:9.9.9.9', 5, 60_000);
    }
    expect(checkRateLimit('/api/auth/register:9.9.9.9', 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit('/api/auth/login:9.9.9.9', 10, 60_000).allowed).toBe(true);
  });
});
