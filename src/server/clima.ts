import 'server-only';
import {
  UBICACION_HARAS,
  esquemaRespuesta,
  resumenPorDia,
  tramosDeRespuesta,
  type DiaDePronostico,
  type TramoDePronostico,
} from '@/lib/clima';

export interface Pronostico {
  tramos: TramoDePronostico[];
  dias: DiaDePronostico[];
}

/** Media hora: el pronóstico de OpenWeather se actualiza cada tres horas. */
const VIGENCIA_SEGUNDOS = 30 * 60;

/**
 * El pronóstico de cinco días para el haras, o `null`.
 *
 * Nunca lanza. El clima acompaña a la agenda y a la jornada; si OpenWeather no
 * responde o falta la clave, esas pantallas tienen que seguir funcionando igual
 * y simplemente no muestran el pronóstico.
 *
 * La respuesta se cachea del lado del servidor y es la misma para todos los
 * usuarios, así que el consumo de la clave no crece con la cantidad de gente
 * que abre la agenda: como mucho, una consulta cada media hora.
 */
export async function obtenerPronostico(): Promise<Pronostico | null> {
  const clave = process.env.OPENWEATHER_API_KEY;
  if (!clave) return null;

  const url = new URL('https://api.openweathermap.org/data/2.5/forecast');
  url.searchParams.set('lat', String(UBICACION_HARAS.latitud));
  url.searchParams.set('lon', String(UBICACION_HARAS.longitud));
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'es');
  url.searchParams.set('appid', clave);

  try {
    const respuesta = await fetch(url, {
      next: { revalidate: VIGENCIA_SEGUNDOS },
      signal: AbortSignal.timeout(4000),
    });
    if (!respuesta.ok) {
      console.error('clima: OpenWeather respondió', respuesta.status, await respuesta.text());
      return null;
    }

    const datos = esquemaRespuesta.safeParse(await respuesta.json());
    if (!datos.success) {
      console.error('clima: la respuesta de OpenWeather no tiene la forma esperada', datos.error.issues);
      return null;
    }

    const tramos = tramosDeRespuesta(datos.data);
    return { tramos, dias: resumenPorDia(tramos) };
  } catch (e) {
    console.error('clima: no se pudo consultar OpenWeather', e);
    return null;
  }
}
