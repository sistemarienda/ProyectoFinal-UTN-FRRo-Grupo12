import { describe, expect, it } from 'vitest';
import {
  bucketsDeAntiguedad,
  clasificarEstadoCartera,
  diaDeAvisoDeMora,
  fechaDeVencimiento,
  primerDiaDelMes,
  saldosPendientesFifo,
} from './cobranza';

describe('fechaDeVencimiento', () => {
  it('arma la fecha dentro del mes del período', () => {
    const v = fechaDeVencimiento(new Date('2026-09-01T00:00:00Z'), 10);
    expect(v.toISOString().slice(0, 10)).toBe('2026-09-10');
  });
});

describe('primerDiaDelMes', () => {
  it('trunca al primer día del mes', () => {
    expect(primerDiaDelMes(new Date('2026-09-17T00:00:00Z')).toISOString().slice(0, 10)).toBe('2026-09-01');
  });
});

describe('diaDeAvisoDeMora', () => {
  it('es el día siguiente al vencimiento cuando ese día es hábil', () => {
    // 2026-08-10 es lunes; el aviso cae martes 11, sin corrimiento.
    const aviso = diaDeAvisoDeMora(new Date('2026-08-10T00:00:00Z'));
    expect(aviso.toISOString().slice(0, 10)).toBe('2026-08-11');
  });

  it('el sábado es hábil (RN-10): un vencimiento en sábado avisa el domingo corrido a lunes', () => {
    // 2026-08-08 es sábado; el día siguiente, domingo 9, se corre al lunes 10.
    const aviso = diaDeAvisoDeMora(new Date('2026-08-08T00:00:00Z'));
    expect(aviso.toISOString().slice(0, 10)).toBe('2026-08-10');
  });
});

describe('clasificarEstadoCartera', () => {
  const hoy = new Date('2026-09-10T00:00:00Z');

  it('sin saldo es al día', () => {
    expect(clasificarEstadoCartera(0, null, hoy, 3)).toBe('al_dia');
  });

  it('con saldo pero sin vencimiento próximo, al día', () => {
    expect(clasificarEstadoCartera(1000, new Date('2026-10-10'), hoy, 3)).toBe('al_dia');
  });

  it('dentro de la ventana de aviso, próximo a vencer', () => {
    expect(clasificarEstadoCartera(1000, new Date('2026-09-12'), hoy, 3)).toBe('proximo_a_vencer');
  });

  it('con la fecha ya pasada, vencido', () => {
    expect(clasificarEstadoCartera(1000, new Date('2026-09-05'), hoy, 3)).toBe('vencido');
  });
});

describe('saldosPendientesFifo', () => {
  it('un cargo sin pago queda entero pendiente', () => {
    const r = saldosPendientesFifo([
      { tipo: 'cargo', importe: 260000, venceEn: '2026-08-10', ocurridoEn: '2026-08-01T00:00:00Z' },
    ]);
    expect(r).toEqual([{ importe: 260000, venceEn: '2026-08-10' }]);
  });

  it('un pago total salda el cargo', () => {
    const r = saldosPendientesFifo([
      { tipo: 'cargo', importe: 260000, venceEn: '2026-08-10', ocurridoEn: '2026-08-01T00:00:00Z' },
      { tipo: 'pago', importe: -260000, venceEn: null, ocurridoEn: '2026-08-15T00:00:00Z' },
    ]);
    expect(r).toEqual([]);
  });

  it('un pago parcial se imputa contra el cargo más viejo primero', () => {
    const r = saldosPendientesFifo([
      { tipo: 'cargo', importe: 100, venceEn: '2026-07-10', ocurridoEn: '2026-07-01T00:00:00Z' },
      { tipo: 'cargo', importe: 100, venceEn: '2026-08-10', ocurridoEn: '2026-08-01T00:00:00Z' },
      { tipo: 'pago', importe: -150, venceEn: null, ocurridoEn: '2026-08-15T00:00:00Z' },
    ]);
    expect(r).toEqual([{ importe: 50, venceEn: '2026-08-10' }]);
  });

  it('el interés de mora entra a la cola como deuda propia', () => {
    const r = saldosPendientesFifo([
      { tipo: 'cargo', importe: 100, venceEn: '2026-07-10', ocurridoEn: '2026-07-01T00:00:00Z' },
      { tipo: 'interes_mora', importe: 10, venceEn: '2026-08-01', ocurridoEn: '2026-08-01T00:00:00Z' },
    ]);
    expect(r).toEqual([
      { importe: 100, venceEn: '2026-07-10' },
      { importe: 10, venceEn: '2026-08-01' },
    ]);
  });
});

describe('bucketsDeAntiguedad', () => {
  it('separa por tramos de 30 días de atraso', () => {
    const hoy = new Date('2026-09-10T00:00:00Z');
    const buckets = bucketsDeAntiguedad(
      [
        { importe: 100, venceEn: '2026-10-01' }, // todavía no vence -> corriente
        { importe: 200, venceEn: '2026-09-01' }, // 9 días -> 1-30
        { importe: 300, venceEn: '2026-08-01' }, // 40 días -> 31-60
        { importe: 400, venceEn: '2026-07-01' }, // 71 días -> 61-90
        { importe: 500, venceEn: '2026-05-01' }, // 132 días -> 90+
      ],
      hoy,
    );
    expect(buckets).toEqual({
      corriente: 100,
      dias_1_30: 200,
      dias_31_60: 300,
      dias_61_90: 400,
      dias_90_mas: 500,
    });
  });
});
