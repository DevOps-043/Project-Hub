import { describe, expect, it } from 'vitest';
import { secureSecretEquals } from './outbox-delivery';

describe('autenticación del worker de outbox', () => {
  it('acepta únicamente el secreto completo', () => {
    expect(secureSecretEquals('secreto-compartido', 'secreto-compartido')).toBe(true);
    expect(secureSecretEquals('secreto', 'secreto-compartido')).toBe(false);
    expect(secureSecretEquals(null, 'secreto-compartido')).toBe(false);
  });

  it('niega una configuración vacía', () => {
    expect(secureSecretEquals('', '')).toBe(false);
    expect(secureSecretEquals('cualquiera', '')).toBe(false);
  });
});
