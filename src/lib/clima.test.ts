import { describe, expect, it } from 'vitest';
import {
  condicionDeCodigo,
  esquemaRespuesta,
  resumenPorDia,
  tramoActual,
  tramoPara,
  tramosDeRespuesta,
  type TramoDePronostico,
} from './clima';

/** Un tramo de OpenWeather tal como llega, con la hora en UTC. */
function crudo(isoUtc: string, codigo: number, temp: number, pop = 0, viento = 3, rafaga?: number) {
  return {
    dt: Date.parse(isoUtc) / 1000,
    main: { temp, temp_min: temp, temp_max: temp },
    weather: [{ id: codigo, description: 'descripción' }],
    wind: rafaga === undefined ? { speed: viento } : { speed: viento, gust: rafaga },
    pop,
  };
}

function tramos(...lista: ReturnType<typeof crudo>[]): TramoDePronostico[] {
  return tramosDeRespuesta(esquemaRespuesta.parse({ list: lista }));
}

describe('condicionDeCodigo', () => {
  it('agrupa los códigos de OpenWeather', () => {
    expect(condicionDeCodigo(211)).toBe('tormenta');
    expect(condicionDeCodigo(301)).toBe('llovizna');
    expect(condicionDeCodigo(502)).toBe('lluvia');
    expect(condicionDeCodigo(741)).toBe('niebla');
    expect(condicionDeCodigo(800)).toBe('despejado');
    expect(condicionDeCodigo(802)).toBe('algo_nublado');
    expect(condicionDeCodigo(804)).toBe('nublado');
  });
});

describe('tramosDeRespuesta', () => {
  it('pasa el viento de m/s a km/h y redondea la temperatura', () => {
    const [t] = tramos(crudo('2026-10-14T15:00:00Z', 800, 21.6, 0.2, 5, 12));
    expect(t).toMatchObject({ temperatura: 22, vientoKmh: 18, rafagaKmh: 43, probabilidadLluvia: 0.2 });
  });

  it('rechaza una respuesta sin la forma esperada', () => {
    expect(esquemaRespuesta.safeParse({ cod: '401', message: 'Invalid API key' }).success).toBe(false);
  });
});

describe('resumenPorDia', () => {
  it('agrupa por fecha del haras, no por fecha UTC', () => {
    // 01:00 UTC del 15 son las 22:00 del 14 en Funes.
    const dias = resumenPorDia(
      tramos(crudo('2026-10-14T15:00:00Z', 800, 20), crudo('2026-10-15T01:00:00Z', 800, 14)),
    );
    expect(dias).toHaveLength(1);
    expect(dias[0]).toMatchObject({ fecha: '2026-10-14', minima: 14, maxima: 20 });
  });

  it('la condición del día es la peor de las horas de actividad', () => {
    const [dia] = resumenPorDia(
      tramos(
        crudo('2026-10-14T06:00:00Z', 211, 15, 0.9), // 03:00 en Funes: tormenta de madrugada
        crudo('2026-10-14T12:00:00Z', 800, 18, 0.1), // 09:00
        crudo('2026-10-14T18:00:00Z', 500, 22, 0.7), // 15:00
      ),
    );
    expect(dia?.condicion).toBe('lluvia');
    expect(dia?.probabilidadLluvia).toBe(0.7);
    expect(dia?.lluviaProbable).toBe(true);
  });

  it('marca viento fuerte por ráfaga, y usa el viento sostenido si no hay ráfaga', () => {
    const [conRafaga] = resumenPorDia(tramos(crudo('2026-10-14T15:00:00Z', 800, 20, 0, 5, 12)));
    const [sinRafaga] = resumenPorDia(tramos(crudo('2026-10-16T15:00:00Z', 800, 20, 0, 5)));
    expect(conRafaga?.vientoFuerte).toBe(true);
    expect(sinRafaga?.rafagaMaximaKmh).toBe(18);
    expect(sinRafaga?.vientoFuerte).toBe(false);
  });
});

describe('tramoPara', () => {
  const lista = tramos(crudo('2026-10-14T12:00:00Z', 800, 18), crudo('2026-10-14T15:00:00Z', 500, 20));

  it('devuelve el tramo que contiene el instante', () => {
    expect(tramoPara(lista, '2026-10-14T13:30:00Z')?.temperatura).toBe(18);
    expect(tramoPara(lista, '2026-10-14T15:00:00Z')?.condicion).toBe('lluvia');
  });

  it('fuera del horizonte no inventa un tramo', () => {
    expect(tramoPara(lista, '2026-10-14T11:59:00Z')).toBeNull();
    expect(tramoPara(lista, '2026-10-14T18:00:00Z')).toBeNull();
  });
});

describe('tramoActual', () => {
  const lista = tramos(crudo('2026-10-14T15:00:00Z', 500, 20), crudo('2026-10-14T18:00:00Z', 800, 17));

  it('si el tramo en curso ya no viene en la respuesta, toma el próximo cercano', () => {
    expect(tramoActual(lista, '2026-10-14T13:10:00Z')?.condicion).toBe('lluvia');
  });

  it('prefiere el tramo en curso', () => {
    expect(tramoActual(lista, '2026-10-14T18:30:00Z')?.temperatura).toBe(17);
  });

  it('no toma un tramo que empieza dentro de más de tres horas', () => {
    expect(tramoActual(lista, '2026-10-14T11:00:00Z')).toBeNull();
  });
});
