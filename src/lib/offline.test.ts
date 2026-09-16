import { describe, expect, it } from 'vitest';
import { agruparPorTipo, debeEncolarse, esErrorDeConectividad, textoDePendientes, type RegistroEncolado } from './offline';

const fila = (p: Partial<RegistroEncolado> & Pick<RegistroEncolado, 'claveDeCola' | 'tipo'>): RegistroEncolado => ({
  id: p.claveDeCola,
  caballoId: 'caballo-1',
  instalacionId: null,
  ocurridoEn: '2026-09-16T12:00:00Z',
  registradoEn: '2026-09-16T12:00:00Z',
  insumoId: null,
  cantidad: null,
  encoladoEn: '2026-09-16T12:00:00Z',
  ...p,
});

describe('esErrorDeConectividad', () => {
  it('reconoce el TypeError que tira fetch sin red', () => {
    expect(esErrorDeConectividad(new TypeError('Failed to fetch'))).toBe(true);
    expect(esErrorDeConectividad(new TypeError('NetworkError when attempting to fetch resource'))).toBe(true);
  });

  it('no confunde un error de aplicación con uno de conectividad', () => {
    expect(esErrorDeConectividad(new Error('No hay ningún caballo marcado.'))).toBe(false);
    expect(esErrorDeConectividad(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(esErrorDeConectividad(undefined)).toBe(false);
  });
});

describe('debeEncolarse', () => {
  it('encola siempre que el navegador se declara sin conexión', () => {
    expect(debeEncolarse(false)).toBe(true);
  });

  it('en línea, sólo encola si el envío falló por conectividad', () => {
    expect(debeEncolarse(true)).toBe(false);
    expect(debeEncolarse(true, new Error('Hay una fila sin caballo.'))).toBe(false);
    expect(debeEncolarse(true, new TypeError('Failed to fetch'))).toBe(true);
  });
});

describe('textoDePendientes', () => {
  it('distingue cero, uno y varios', () => {
    expect(textoDePendientes(0)).toBe('Todo sincronizado.');
    expect(textoDePendientes(1)).toBe('1 registro pendiente de sincronizar.');
    expect(textoDePendientes(3)).toBe('3 registros pendientes de sincronizar.');
  });
});

describe('agruparPorTipo', () => {
  it('separa alimentación e higiene conservando el orden de cada una', () => {
    const pendientes = [
      fila({ claveDeCola: 'a1', tipo: 'alimentacion' }),
      fila({ claveDeCola: 'h1', tipo: 'higiene' }),
      fila({ claveDeCola: 'a2', tipo: 'alimentacion' }),
    ];

    const grupos = agruparPorTipo(pendientes);

    expect(grupos.alimentacion.map((p) => p.claveDeCola)).toEqual(['a1', 'a2']);
    expect(grupos.higiene.map((p) => p.claveDeCola)).toEqual(['h1']);
  });

  it('devuelve listas vacías para el tipo sin pendientes', () => {
    const grupos = agruparPorTipo([]);
    expect(grupos.alimentacion).toEqual([]);
    expect(grupos.higiene).toEqual([]);
  });
});
