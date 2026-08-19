import { describe, expect, it } from 'vitest';
import { hashPassword, hashBcryptPassword, verifyPassword } from './password';

describe('hashPassword + verifyPassword (PBKDF2)', () => {
  it('produces a hash a correct password verifies against', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('is case- and whitespace-sensitive', async () => {
    const hash = await hashPassword('Password1');
    expect(await verifyPassword('password1', hash)).toBe(false);
    expect(await verifyPassword('Password1 ', hash)).toBe(false);
  });

  it('produces a hash tagged with the $pbkdf2$ format and iteration count', async () => {
    const hash = await hashPassword('anything');
    const parts = hash.split('$');
    // "$pbkdf2$100000$<base64>" splits into ['', 'pbkdf2', '100000', '<base64>']
    expect(parts).toHaveLength(4);
    expect(parts[1]).toBe('pbkdf2');
    expect(Number(parts[2])).toBeGreaterThan(0);
  });

  it('salts each hash independently, so the same password hashes differently each time', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
    // ...but both must still verify correctly against their own hash.
    expect(await verifyPassword('same-password', first)).toBe(true);
    expect(await verifyPassword('same-password', second)).toBe(true);
  });

  it('rejects a hash with a tampered payload (bit flip in the base64 body)', async () => {
    const hash = await hashPassword('tamper-test');
    const parts = hash.split('$');
    const tamperedBody = parts[3].slice(0, -4) + (parts[3].slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    const tampered = `$${parts[1]}$${parts[2]}$${tamperedBody}`;
    expect(await verifyPassword('tamper-test', tampered)).toBe(false);
  });

  it('rejects a malformed pbkdf2 hash instead of throwing', async () => {
    await expect(verifyPassword('x', '$pbkdf2$not-enough-parts')).resolves.toBe(false);
    await expect(verifyPassword('x', '$pbkdf2$abc$not-base64$extra')).resolves.toBe(false);
  });

  it('rejects an unrecognized hash format instead of throwing', async () => {
    expect(await verifyPassword('x', 'plain-text-not-a-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});

describe('hashBcryptPassword + verifyPassword (bcrypt legacy path)', () => {
  it('produces a $2 bcrypt hash a correct password verifies against', async () => {
    const hash = await hashBcryptPassword('legacy-password');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword('legacy-password', hash)).toBe(true);
  });

  it('rejects an incorrect password against a bcrypt hash', async () => {
    const hash = await hashBcryptPassword('legacy-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
