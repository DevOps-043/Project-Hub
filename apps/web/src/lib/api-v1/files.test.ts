import { describe, expect, it } from 'vitest';
import { validateFileDeclaration, validateMagicBytes } from './files';

describe('validación de archivos de proyecto', () => {
  it('acepta una declaración PNG coherente', () => {
    expect(validateFileDeclaration('captura.png', 'image/png')).toBe('png');
    expect(() => validateMagicBytes('image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).not.toThrow();
  });

  it('rechaza extensión activa o MIME discordante', () => {
    expect(() => validateFileDeclaration('ataque.svg', 'image/svg+xml')).toThrow();
    expect(() => validateFileDeclaration('foto.exe', 'image/jpeg')).toThrow();
  });

  it('rechaza magic bytes que no corresponden al MIME', () => {
    expect(() => validateMagicBytes('application/pdf', Uint8Array.from([0x4d, 0x5a, 0x90]))).toThrow();
  });
});

