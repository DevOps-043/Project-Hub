import { describe, expect, it } from 'vitest';
import { sanitizeSearchTerm, sanitizeFilterIdentifier } from './sanitize';

describe('sanitizeSearchTerm', () => {
  it('deja intacto un texto de búsqueda normal', () => {
    expect(sanitizeSearchTerm('Fernando Suarez')).toBe('Fernando Suarez');
  });

  it('elimina comas y paréntesis que podrían alterar el filtro .or() de PostgREST', () => {
    expect(sanitizeSearchTerm('a,b')).toBe('ab');
    expect(sanitizeSearchTerm('foo(bar)')).toBe('foobar');
    expect(sanitizeSearchTerm('x,(y,z)')).toBe('xyz');
  });

  it('escapa los comodines de ilike (% y _) para que se busquen literalmente', () => {
    expect(sanitizeSearchTerm('50%_off')).toBe('50\\%\\_off');
  });

  it('trunca al máximo configurado para evitar payloads de búsqueda enormes', () => {
    const input = 'a'.repeat(200);
    expect(sanitizeSearchTerm(input, 10)).toHaveLength(10);
  });

  it('nunca deja pasar una condición inyectada tipo ",status.eq.active"', () => {
    const malicious = 'x",status.eq.active,"';
    const result = sanitizeSearchTerm(malicious);
    expect(result).not.toContain(',');
  });
});

describe('sanitizeFilterIdentifier', () => {
  it('deja intacto un slug o nombre normal', () => {
    expect(sanitizeFilterIdentifier('mi-equipo-frontend')).toBe('mi-equipo-frontend');
    expect(sanitizeFilterIdentifier('Equipo Frontend')).toBe('Equipo Frontend');
  });

  it('elimina comas y paréntesis que alterarían la estructura del filtro .or()', () => {
    expect(sanitizeFilterIdentifier('a,b')).toBe('ab');
    expect(sanitizeFilterIdentifier('foo(bar)')).toBe('foobar');
  });

  it('nunca deja pasar una condición inyectada tipo ",status.eq.active"', () => {
    const malicious = 'x",status.eq.active,"';
    expect(sanitizeFilterIdentifier(malicious)).not.toContain(',');
  });

  // A diferencia de sanitizeSearchTerm: %/_ deben sobrevivir intactos porque
  // esta función alimenta comparaciones .eq., no .ilike. — escaparlos
  // rompería una coincidencia exacta contra un nombre real que los contenga.
  it('preserva % y _ literalmente, a diferencia de sanitizeSearchTerm', () => {
    expect(sanitizeFilterIdentifier('50%_done')).toBe('50%_done');
  });

  it('trunca al máximo configurado', () => {
    const input = 'a'.repeat(200);
    expect(sanitizeFilterIdentifier(input, 10)).toHaveLength(10);
  });
});
