import { describe, expect, it } from 'vitest';
import { fechaCorta } from './fechas';

describe('fechaCorta', () => {
  it('da vuelta una fecha de la base sin correrla de día', () => {
    expect(fechaCorta('2026-10-01')).toBe('01/10/2026');
  });

  it('toma sólo la fecha de un timestamp', () => {
    expect(fechaCorta('2026-02-10T13:00:00+00:00')).toBe('10/02/2026');
  });
});
