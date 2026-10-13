import { z } from 'zod';
import { partesLocales } from './agenda';

/**
 * Pronóstico del tiempo para el establecimiento (OpenWeather).
 *
 * Se consulta el pronóstico de cinco días en tramos de tres horas
 * (`/data/2.5/forecast`), que entra en el plan gratuito y admite uso comercial.
 * Este módulo sólo interpreta la respuesta; la llamada vive en
 * `src/server/clima.ts`, que es lo único que conoce la clave.
 *
 * El clima informa, no decide: ninguna regla del sistema suspende una clase por
 * el pronóstico. Lo que hace es ponerlo a la vista donde la decisión se toma
 * (la agenda, el detalle de la clase y la jornada del peón).
 */

/** Funes, Santa Fe. La precisión de un pronóstico no distingue entre dos campos vecinos. */
export const UBICACION_HARAS = { latitud: -32.9167, longitud: -60.8167 } as const;

/** Desde qué probabilidad de lluvia el día se marca. Es un aviso visual, no una regla. */
export const LLUVIA_PROBABLE = 0.6;

/** Ráfagas desde las que se marca viento fuerte, en km/h. */
export const VIENTO_FUERTE_KMH = 40;

const tramo = z.object({
  dt: z.number(),
  main: z.object({ temp: z.number(), temp_min: z.number(), temp_max: z.number() }),
  weather: z.array(z.object({ id: z.number(), description: z.string() })).min(1),
  wind: z.object({ speed: z.number(), gust: z.number().optional() }),
  pop: z.number().optional(),
});

export const esquemaRespuesta = z.object({ list: z.array(tramo) });

export type RespuestaOpenWeather = z.infer<typeof esquemaRespuesta>;

export type Condicion = 'tormenta' | 'lluvia' | 'llovizna' | 'nieve' | 'niebla' | 'nublado' | 'algo_nublado' | 'despejado';

/** De más a menos grave: el día toma la peor condición de sus horas de actividad. */
const GRAVEDAD: readonly Condicion[] = [
  'tormenta',
  'lluvia',
  'nieve',
  'llovizna',
  'niebla',
  'nublado',
  'algo_nublado',
  'despejado',
];

export const CONDICION_TEXTO: Record<Condicion, string> = {
  tormenta: 'Tormenta',
  lluvia: 'Lluvia',
  llovizna: 'Llovizna',
  nieve: 'Nieve',
  niebla: 'Niebla',
  nublado: 'Nublado',
  algo_nublado: 'Algo nublado',
  despejado: 'Despejado',
};

/** Grupos de códigos de OpenWeather: https://openweathermap.org/weather-conditions */
export function condicionDeCodigo(codigo: number): Condicion {
  if (codigo >= 200 && codigo < 300) return 'tormenta';
  if (codigo >= 300 && codigo < 400) return 'llovizna';
  if (codigo >= 500 && codigo < 600) return 'lluvia';
  if (codigo >= 600 && codigo < 700) return 'nieve';
  if (codigo >= 700 && codigo < 800) return 'niebla';
  if (codigo === 800) return 'despejado';
  if (codigo === 801 || codigo === 802) return 'algo_nublado';
  return 'nublado';
}

export interface TramoDePronostico {
  /** Inicio del tramo de tres horas. */
  instante: string;
  temperatura: number;
  condicion: Condicion;
  descripcion: string;
  /** Entre 0 y 1. */
  probabilidadLluvia: number;
  vientoKmh: number;
  rafagaKmh: number | null;
}

export interface DiaDePronostico {
  /** `YYYY-MM-DD` en la zona del haras. */
  fecha: string;
  minima: number;
  maxima: number;
  condicion: Condicion;
  probabilidadLluvia: number;
  rafagaMaximaKmh: number;
  lluviaProbable: boolean;
  vientoFuerte: boolean;
}

const aKmh = (metrosPorSegundo: number) => Math.round(metrosPorSegundo * 3.6);

export function tramosDeRespuesta(respuesta: RespuestaOpenWeather): TramoDePronostico[] {
  return respuesta.list.map((t) => {
    const clima = t.weather[0]!;
    return {
      instante: new Date(t.dt * 1000).toISOString(),
      temperatura: Math.round(t.main.temp),
      condicion: condicionDeCodigo(clima.id),
      descripcion: clima.description,
      probabilidadLluvia: t.pop ?? 0,
      vientoKmh: aKmh(t.wind.speed),
      rafagaKmh: t.wind.gust === undefined ? null : aKmh(t.wind.gust),
    };
  });
}

/**
 * La condición del día sale de las horas en que el haras trabaja (de 7 a 21).
 * Una tormenta de madrugada que a la mañana ya pasó no le cambia nada a la
 * agenda; si el día no tiene ningún tramo en esa franja, se usan todos.
 */
function enHorario(t: TramoDePronostico): boolean {
  const hora = Number(partesLocales(t.instante).hora.slice(0, 2));
  return hora >= 7 && hora <= 21;
}

export function resumenPorDia(tramos: readonly TramoDePronostico[]): DiaDePronostico[] {
  const porFecha = new Map<string, TramoDePronostico[]>();
  for (const t of tramos) {
    const fecha = partesLocales(t.instante).fecha;
    porFecha.set(fecha, [...(porFecha.get(fecha) ?? []), t]);
  }

  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, delDia]) => {
      const diurnos = delDia.filter(enHorario);
      const relevantes = diurnos.length > 0 ? diurnos : delDia;
      const condicion = GRAVEDAD.find((g) => relevantes.some((t) => t.condicion === g)) ?? 'despejado';
      const probabilidadLluvia = Math.max(...relevantes.map((t) => t.probabilidadLluvia));
      const rafagaMaximaKmh = Math.max(...relevantes.map((t) => t.rafagaKmh ?? t.vientoKmh));

      return {
        fecha,
        minima: Math.min(...delDia.map((t) => t.temperatura)),
        maxima: Math.max(...delDia.map((t) => t.temperatura)),
        condicion,
        probabilidadLluvia,
        rafagaMaximaKmh,
        lluviaProbable: probabilidadLluvia >= LLUVIA_PROBABLE,
        vientoFuerte: rafagaMaximaKmh >= VIENTO_FUERTE_KMH,
      };
    });
}

/**
 * El tramo que cubre un instante: el último que empezó antes, siempre que no
 * hayan pasado más de tres horas. Fuera del horizonte del pronóstico no hay
 * tramo, y la pantalla no inventa uno.
 */
export function tramoPara(
  tramos: readonly TramoDePronostico[],
  instante: Date | string,
): TramoDePronostico | null {
  const momento = new Date(instante).getTime();
  const TRES_HORAS = 3 * 60 * 60 * 1000;

  let elegido: TramoDePronostico | null = null;
  for (const t of tramos) {
    const inicio = new Date(t.instante).getTime();
    if (inicio <= momento && momento < inicio + TRES_HORAS) elegido = t;
  }
  return elegido;
}

/**
 * El tramo para «ahora». La respuesta de OpenWeather empieza en el próximo
 * tramo, no en el que está en curso, así que si ninguno contiene el instante se
 * toma el que arranca dentro de las tres horas siguientes.
 */
export function tramoActual(
  tramos: readonly TramoDePronostico[],
  instante: Date | string,
): TramoDePronostico | null {
  const enCurso = tramoPara(tramos, instante);
  if (enCurso) return enCurso;

  const momento = new Date(instante).getTime();
  const TRES_HORAS = 3 * 60 * 60 * 1000;
  return (
    tramos.find((t) => {
      const inicio = new Date(t.instante).getTime();
      return inicio > momento && inicio - momento <= TRES_HORAS;
    }) ?? null
  );
}

export const porcentaje = (probabilidad: number) => `${Math.round(probabilidad * 100)} %`;
