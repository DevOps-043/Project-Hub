import { describe, expect, it } from 'vitest';
import { normalizeApiKeyScopes } from './api-key-service';

describe('normalizeApiKeyScopes', () => {
  it('devuelve el fallback cuando no se especifican scopes', () => {
    expect(normalizeApiKeyScopes(undefined)).toEqual(['read', 'write']);
    expect(normalizeApiKeyScopes(null)).toEqual(['read', 'write']);
  });

  it('devuelve null si el fallback es null y no hay scopes (fuerza al caller a rechazar la request)', () => {
    expect(normalizeApiKeyScopes(undefined, null)).toBeNull();
  });

  it('acepta scopes válidos y los normaliza a minúsculas', () => {
    expect(normalizeApiKeyScopes(['READ'])).toEqual(['read']);
    expect(normalizeApiKeyScopes(['read', 'write'])).toEqual(['read', 'write']);
  });

  it('descarta scopes desconocidos en vez de dejarlos pasar (no privilege escalation vía scope inventado)', () => {
    expect(normalizeApiKeyScopes(['read', 'admin', 'delete-everything'])).toEqual(['read']);
  });

  it('devuelve null si, tras filtrar, no queda ningún scope válido', () => {
    expect(normalizeApiKeyScopes(['admin', 'superuser'])).toBeNull();
  });

  it('rechaza un valor que no es array (ej. un string suelto)', () => {
    expect(normalizeApiKeyScopes('read')).toBeNull();
    expect(normalizeApiKeyScopes({ scope: 'read' })).toBeNull();
  });

  it('deduplica scopes repetidos', () => {
    expect(normalizeApiKeyScopes(['read', 'read', 'Read'])).toEqual(['read']);
  });

  it('ignora entradas no-string dentro del array en vez de fallar', () => {
    expect(normalizeApiKeyScopes(['read', 123, null, {}])).toEqual(['read']);
  });
});
