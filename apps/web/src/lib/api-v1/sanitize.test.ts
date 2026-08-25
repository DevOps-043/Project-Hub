import { describe, expect, it } from 'vitest';
import { sanitizeExternalUrl, sanitizeEvidenceItems } from './sanitize';

describe('saneamiento de evidencia web', () => {
  it('elimina credenciales, fragmentos y parámetros sensibles', () => {
    const value = sanitizeExternalUrl('https://user:pass@example.com/report?token=secret&page=2#private');
    expect(value).toBe('https://example.com/report?page=2');
  });

  it.each(['file:///secret.txt', 'data:text/plain,hola', 'javascript:alert(1)', 'chrome://settings'])(
    'rechaza el esquema %s', (value) => expect(() => sanitizeExternalUrl(value)).toThrow(),
  );

  it('limita el snapshot DOM a 50 KB y quita bytes nulos', () => {
    const [item] = sanitizeEvidenceItems([{ content: `a\0${'b'.repeat(60_000)}` }]);
    expect(String(item.content)).toHaveLength(51_200);
    expect(String(item.content)).not.toContain('\0');
  });
});

