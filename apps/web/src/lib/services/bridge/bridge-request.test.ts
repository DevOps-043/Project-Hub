import { describe, expect, it } from 'vitest';
import { isBridgeError, isPlainRecord, parseActionBody } from './bridge-request';

describe('parseActionBody', () => {
  it('extrae el nombre de herramienta desde tool, action o name (en ese orden)', () => {
    expect(parseActionBody({ tool: 'create_task' }).tool).toBe('create_task');
    expect(parseActionBody({ action: 'update_task' }).tool).toBe('update_task');
    expect(parseActionBody({ name: 'delete_task' }).tool).toBe('delete_task');
    expect(parseActionBody({ tool: 'a', action: 'b', name: 'c' }).tool).toBe('a');
  });

  it('usa params/arguments explícitos si vienen en el body', () => {
    const { params } = parseActionBody({ tool: 'create_task', params: { title: 'Hola' } });
    expect(params).toEqual({ title: 'Hola' });
  });

  it('trata las claves sueltas del body como params inline si no hay params/arguments', () => {
    const { params } = parseActionBody({ tool: 'create_task', title: 'Hola', team_id: 't1' });
    expect(params).toEqual({ title: 'Hola', team_id: 't1' });
  });

  it('no filtra tool/action/name/params/arguments hacia los params inline', () => {
    const { params } = parseActionBody({ tool: 'create_task', title: 'Hola' });
    expect(params).not.toHaveProperty('tool');
  });
});

describe('isBridgeError', () => {
  it('reconoce un objeto de error válido', () => {
    expect(isBridgeError({ error: 'algo falló', status: 400 })).toBe(true);
  });

  it('rechaza valores que no tienen ambos campos', () => {
    expect(isBridgeError({ error: 'x' })).toBe(false);
    expect(isBridgeError({ status: 400 })).toBe(false);
    expect(isBridgeError(null)).toBe(false);
    expect(isBridgeError('error')).toBe(false);
    expect(isBridgeError(undefined)).toBe(false);
  });
});

describe('isPlainRecord', () => {
  it('acepta objetos planos', () => {
    expect(isPlainRecord({ a: 1 })).toBe(true);
    expect(isPlainRecord({})).toBe(true);
  });

  it('rechaza arrays, null y primitivos', () => {
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(null)).toBe(false);
    expect(isPlainRecord('texto')).toBe(false);
    expect(isPlainRecord(42)).toBe(false);
  });
});
