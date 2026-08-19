import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from './token-encryption';

describe('encryptToken + decryptToken', () => {
  it('recupera el texto plano original tras encriptar y desencriptar', async () => {
    const plain = 'ya29.a0AfH6SMC-google-oauth-access-token-example';
    const encrypted = await encryptToken(plain);

    expect(encrypted).not.toBe(plain);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('genera un salt/iv distinto en cada llamada (mismo texto, distinto ciphertext)', async () => {
    const plain = 'mismo-token-repetido';
    const first = await encryptToken(plain);
    const second = await encryptToken(plain);

    expect(first).not.toBe(second);
    expect(await decryptToken(first)).toBe(plain);
    expect(await decryptToken(second)).toBe(plain);
  });

  it('rechaza un formato inválido (no tiene las 3 partes salt:iv:ciphertext)', async () => {
    await expect(decryptToken('formato-invalido')).rejects.toThrow('Formato de token encriptado inválido');
  });

  it('rechaza un ciphertext corrompido/manipulado', async () => {
    const encrypted = await encryptToken('token-original');
    const [salt, iv, ciphertext] = encrypted.split(':');
    const corrupted = `${salt}:${iv}:${ciphertext.slice(0, -4)}AAAA`;

    await expect(decryptToken(corrupted)).rejects.toThrow();
  });
});
