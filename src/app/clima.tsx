import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from '@phosphor-icons/react/dist/ssr';
import type { Icon } from '@phosphor-icons/react';
import {
  CONDICION_TEXTO,
  LLUVIA_PROBABLE,
  VIENTO_FUERTE_KMH,
  porcentaje,
  type Condicion,
  type DiaDePronostico,
  type TramoDePronostico,
} from '@/lib/clima';

const ICONO: Record<Condicion, Icon> = {
  tormenta: CloudLightning,
  lluvia: CloudRain,
  llovizna: CloudRain,
  nieve: CloudSnow,
  niebla: CloudFog,
  nublado: Cloud,
  algo_nublado: CloudSun,
  despejado: Sun,
};

export function IconoDeClima({ condicion, size = 16 }: { condicion: Condicion; size?: number }) {
  const Componente = ICONO[condicion];
  return <Componente size={size} aria-hidden="true" />;
}

/** Lo que va debajo de cada día en la cabecera de la agenda. */
export function ClimaDelDia({ dia }: { dia: DiaDePronostico }) {
  const descripcion =
    `${CONDICION_TEXTO[dia.condicion]}, máxima ${dia.maxima}°, mínima ${dia.minima}°, ` +
    `${porcentaje(dia.probabilidadLluvia)} de probabilidad de lluvia` +
    (dia.vientoFuerte ? `, ráfagas de ${dia.rafagaMaximaKmh} km/h` : '');

  return (
    <span
      className={`tnum mt-0.5 flex items-center justify-center gap-1 text-xs font-normal ${
        dia.lluviaProbable || dia.vientoFuerte ? 'text-warn' : 'text-fg-muted'
      }`}
      title={descripcion}
    >
      <IconoDeClima condicion={dia.condicion} size={14} />
      <span aria-hidden="true">
        {dia.maxima}°/{dia.minima}°{dia.lluviaProbable ? ` · ${porcentaje(dia.probabilidadLluvia)}` : ''}
      </span>
      <span className="sr-only">{descripcion}</span>
    </span>
  );
}

/** El pronóstico para el horario de una clase, en su detalle. */
export function ClimaDeLaClase({ tramo }: { tramo: TramoDePronostico }) {
  const lluviaProbable = tramo.probabilidadLluvia >= LLUVIA_PROBABLE;
  const rafaga = tramo.rafagaKmh ?? tramo.vientoKmh;
  const vientoFuerte = rafaga >= VIENTO_FUERTE_KMH;

  return (
    <div className="card mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
      <span className="flex items-center gap-2 font-medium text-fg">
        <IconoDeClima condicion={tramo.condicion} size={20} />
        <span className="first-letter:uppercase">{tramo.descripcion}</span>
      </span>
      <span className="tnum text-fg-muted">{tramo.temperatura}°</span>
      <span className={`tnum ${lluviaProbable ? 'text-warn' : 'text-fg-muted'}`}>
        {porcentaje(tramo.probabilidadLluvia)} de probabilidad de lluvia
      </span>
      <span className={`tnum ${vientoFuerte ? 'text-warn' : 'text-fg-muted'}`}>
        Viento {tramo.vientoKmh} km/h{tramo.rafagaKmh !== null ? `, ráfagas ${tramo.rafagaKmh}` : ''}
      </span>
      <span className="helper ml-auto">Pronóstico para el horario de la clase · OpenWeather</span>
    </div>
  );
}

/** La línea de clima de «Mi jornada»: cómo está ahora y cómo sigue el día. */
export function ClimaDeHoy({ ahora, dia }: { ahora: TramoDePronostico | null; dia: DiaDePronostico | null }) {
  if (!ahora && !dia) return null;
  const condicion = ahora?.condicion ?? dia!.condicion;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-feature-muted/30 pt-3 text-sm text-feature-muted">
      <span className="flex items-center gap-1.5 text-feature-fg">
        <IconoDeClima condicion={condicion} size={18} />
        {ahora ? (
          <span className="tnum">
            {ahora.temperatura}° <span className="first-letter:uppercase">{ahora.descripcion}</span>
          </span>
        ) : (
          CONDICION_TEXTO[condicion]
        )}
      </span>
      {dia && (
        <>
          <span className="tnum">
            Máx. {dia.maxima}° · mín. {dia.minima}°
          </span>
          <span className="tnum">Lluvia {porcentaje(dia.probabilidadLluvia)}</span>
          {dia.vientoFuerte && <span className="tnum">Ráfagas de {dia.rafagaMaximaKmh} km/h</span>}
        </>
      )}
    </div>
  );
}
