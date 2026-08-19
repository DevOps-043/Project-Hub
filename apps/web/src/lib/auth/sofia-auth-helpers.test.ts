import { describe, expect, it } from 'vitest';
import { mapPlatformRoleToPermission, normalizeAccountUsername, sanitizeIdentifier } from './sofia-auth';

describe('mapPlatformRoleToPermission', () => {
  it('maps known SofLIA platform roles to the expected permission level', () => {
    expect(mapPlatformRoleToPermission('Administrador')).toBe('admin');
    expect(mapPlatformRoleToPermission('admin')).toBe('admin');
    expect(mapPlatformRoleToPermission('Instructor')).toBe('manager');
    expect(mapPlatformRoleToPermission('Business')).toBe('manager');
    expect(mapPlatformRoleToPermission('Business User')).toBe('user');
    expect(mapPlatformRoleToPermission('Usuario')).toBe('user');
    expect(mapPlatformRoleToPermission('user')).toBe('user');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(mapPlatformRoleToPermission('  ADMINISTRADOR  ')).toBe('admin');
    expect(mapPlatformRoleToPermission('InStRuCtOr')).toBe('manager');
    expect(mapPlatformRoleToPermission('BUSINESS USER')).toBe('user');
  });

  // Security invariant: an unrecognized or missing role must never default to
  // an elevated permission. If SofLIA starts sending a role string this
  // mapping doesn't know about, that user must land as 'user', not 'admin'.
  it('defaults unknown, empty, null, and undefined roles to "user" (never "admin")', () => {
    expect(mapPlatformRoleToPermission('some-future-role-we-dont-know')).toBe('user');
    expect(mapPlatformRoleToPermission('')).toBe('user');
    expect(mapPlatformRoleToPermission(null)).toBe('user');
    expect(mapPlatformRoleToPermission(undefined)).toBe('user');
  });
});

describe('normalizeAccountUsername', () => {
  it('keeps a valid username unchanged', () => {
    expect(normalizeAccountUsername('fernando_dev', 'fernando@example.com')).toBe('fernando_dev');
  });

  it('falls back to the email local-part when username is null, undefined, or empty', () => {
    expect(normalizeAccountUsername(null, 'fernando@example.com')).toBe('fernando');
    expect(normalizeAccountUsername(undefined, 'fernando@example.com')).toBe('fernando');
    expect(normalizeAccountUsername('', 'fernando@example.com')).toBe('fernando');
  });

  it('strips characters outside [A-Za-z0-9_-] to satisfy the account_users CHECK constraint', () => {
    expect(normalizeAccountUsername('fer nando!', 'fernando@example.com')).toBe('fernando');
    expect(normalizeAccountUsername('user@name.com', 'fallback@example.com')).toBe('usernamecom');
  });

  it('pads usernames shorter than 3 characters with a "_user" suffix', () => {
    expect(normalizeAccountUsername('ab', 'fallback@example.com')).toBe('ab_user');
    expect(normalizeAccountUsername('a', 'fallback@example.com')).toBe('a_user');
  });

  it('falls back to the literal "user" when both username and email local-part are unusable', () => {
    // email local-part is empty (edge case: address starts with @) and no username given;
    // 'user' is already 4 chars, so it passes the length-3 minimum without padding.
    expect(normalizeAccountUsername(null, '@example.com')).toBe('user');
  });

  it('truncates the result to 50 characters', () => {
    const longUsername = 'a'.repeat(80);
    const result = normalizeAccountUsername(longUsername, 'fallback@example.com');
    expect(result.length).toBe(50);
    expect(result).toBe('a'.repeat(50));
  });

  it('truncates a padded short username to 50 characters too', () => {
    // Sanity check: the length cap applies after the "_user" suffix is added, not before.
    const result = normalizeAccountUsername('x', 'fallback@example.com');
    expect(result.length).toBeLessThanOrEqual(50);
  });
});

describe('sanitizeIdentifier', () => {
  it('leaves a normal email or username with no wildcard characters unchanged', () => {
    expect(sanitizeIdentifier('fernando@example.com')).toBe('fernando@example.com');
    expect(sanitizeIdentifier('fernandodev')).toBe('fernandodev');
  });

  it('strips characters that would break the .or() filter structure', () => {
    expect(sanitizeIdentifier('a,b')).toBe('ab');
    expect(sanitizeIdentifier('foo(bar)')).toBe('foobar');
    expect(sanitizeIdentifier(`"quoted"`)).toBe('quoted');
    expect(sanitizeIdentifier("O'Brien")).toBe('OBrien');
  });

  it('never lets an injected condition like ",status.eq.active" survive', () => {
    const malicious = 'x",status.eq.active,"';
    expect(sanitizeIdentifier(malicious)).not.toContain(',');
  });

  // Security regression test: an email with '%' in the local part is valid
  // per RFC and passes the login route's format regex, but '%' is an ilike
  // wildcard at the Postgres level. Without escaping it here, this unverified,
  // pre-auth identifier would turn an exact account lookup into a fuzzy
  // pattern match instead — a real risk since it runs before password checks.
  it('escapes % and _ so an ilike lookup can never become a wildcard match', () => {
    expect(sanitizeIdentifier('a%b@example.com')).toBe('a\\%b@example.com');
    expect(sanitizeIdentifier('under_score')).toBe('under\\_score');
  });
});
