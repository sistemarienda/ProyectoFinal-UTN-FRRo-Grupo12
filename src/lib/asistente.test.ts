import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS, coincideConBusqueda, normalizarTexto } from './asistente';

describe('normalizarTexto', () => {
  it('saca acentos, mayúsculas y espacios sobrantes', () => {
    expect(normalizarTexto('  José María Pérez  ')).toBe('jose maria perez');
  });
});

describe('coincideConBusqueda', () => {
  it('encuentra una coincidencia parcial sin importar acentos ni mayúsculas', () => {
    expect(coincideConBusqueda('José María Pérez', 'maria perez')).toBe(true);
    expect(coincideConBusqueda('José María Pérez', 'PEREZ')).toBe(true);
  });

  it('no encuentra lo que no está', () => {
    expect(coincideConBusqueda('José María Pérez', 'gonzalez')).toBe(false);
  });

  it('una búsqueda vacía no coincide con nada: evita traer el padrón entero', () => {
    expect(coincideConBusqueda('José María Pérez', '   ')).toBe(false);
  });
});

describe('HERRAMIENTAS', () => {
  it('tiene nombres únicos y esquema de objeto', () => {
    const nombres = HERRAMIENTAS.map((h) => h.name);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const h of HERRAMIENTAS) {
      expect(h.input_schema.type).toBe('object');
      expect(h.description.length).toBeGreaterThan(0);
    }
  });
});
