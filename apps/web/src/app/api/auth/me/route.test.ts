import { describe, expect, it, vi } from 'vitest';
import { mapUserResponse, shouldTouchActivity, type AccountUserProfile } from './route';

function makeProfile(overrides: Partial<AccountUserProfile> = {}): AccountUserProfile {
  return {
    user_id: 'user-123',
    email: 'fernando@example.com',
    username: 'fernando_suarez',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: 'Gonzalez',
    display_name: null,
    phone_number: null,
    permission_level: 'user',
    company_role: null,
    department: null,
    avatar_url: null,
    is_email_verified: true,
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_activity_at: null,
    ...overrides,
  };
}

describe('mapUserResponse', () => {
  it('falls back to "first_name last_name_paternal" when display_name is null', () => {
    const response = mapUserResponse(makeProfile({ display_name: null }));
    expect(response.name).toBe('Fernando Suarez');
  });

  it('prefers display_name when set', () => {
    const response = mapUserResponse(makeProfile({ display_name: 'Fer S.' }));
    expect(response.name).toBe('Fer S.');
  });

  it('joins both last names for the combined lastName field, trimming a missing maternal name', () => {
    expect(mapUserResponse(makeProfile({ last_name_maternal: 'Gonzalez' })).lastName).toBe('Suarez Gonzalez');
    expect(mapUserResponse(makeProfile({ last_name_maternal: null })).lastName).toBe('Suarez');
  });

  it('never leaks password_hash or other unlisted internal fields', () => {
    const response = mapUserResponse(makeProfile());
    expect(response).not.toHaveProperty('password_hash');
    expect(response).not.toHaveProperty('failed_login_attempts');
  });

  it('exposes both the mapped UI role and the raw permissionLevel', () => {
    const response = mapUserResponse(makeProfile({ permission_level: 'admin' }));
    expect(response.role).toBe('admin');
    expect(response.permissionLevel).toBe('admin');
  });
});

describe('shouldTouchActivity', () => {
  it('returns true when there is no previous activity timestamp', () => {
    expect(shouldTouchActivity(null)).toBe(true);
  });

  it('returns true when the timestamp is unparseable', () => {
    expect(shouldTouchActivity('not-a-date')).toBe(true);
  });

  it('returns false when the last activity was very recent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:05:00.000Z'));
    expect(shouldTouchActivity('2026-01-01T00:04:50.000Z')).toBe(false);
    vi.useRealTimers();
  });

  it('returns true once the activity-touch interval has elapsed (default 300s)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:10:01.000Z'));
    expect(shouldTouchActivity('2026-01-01T00:05:00.000Z')).toBe(true);
    vi.useRealTimers();
  });
});
