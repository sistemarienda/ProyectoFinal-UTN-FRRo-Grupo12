'use client';

import { type FormEvent, useActionState, useMemo, useState } from 'react';
import { CheckCircle, Circle, WifiSlash } from '@phosphor-icons/react';
import { BotonEnviar } from '../../botones';
import { avisarCambioDeCola } from '../../estado-conexion';
import { filasDeFormulario } from '@/lib/bienestar';
import { debeEncolarse } from '@/lib/offline';
import { encolar } from '@/lib/offline-db';
import { type ResultadoDeTanda, registrarHigiene } from '../acciones';

export interface BoxVisible {
  instalacionId: string;
  nombre: string;
  caballoId: string | null;
  caballoNombre: string | null;
  ultimaHigiene: string | null;
}

export interface InsumoVisible {
  id: string;
  nombre: string;
  unidad: string;
}

const inicial: ResultadoDeTanda = { estado: 'inicial' };

function diasDesde(iso: string | null): string {
  if (iso === null) return 'sin registro';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

/**
 * Planilla de higiene de boxes (CUS03).
 *
 * A diferencia de la alimentación, acá **no viene todo marcado**: la limpieza se
 * hace por tanda de boxes, no sobre el establecimiento entero, así que lo normal
 * es elegir sobre cuáles se trabajó (paso 1 del caso de uso).
 *
 * El box desocupado aparece igual y se puede registrar: el cuidado queda contra
 * la instalación y sin caballo (camino 2.a). Eso es lo que hace que el consumo
 * de material quede imputado por box, que es la información que hoy no existe.
 */
export function PlanillaDeHigiene({
  boxes,
  insumos,
}: {
  boxes: BoxVisible[];
  insumos: InsumoVisible[];
}) {
  const [elegidos, setElegidos] = useState<ReadonlySet<string>>(new Set());
  const [resultado, accion] = useActionState(registrarHigiene, inicial);
  const [encolado, setEncolado] = useState<number | null>(null);

  // Un identificador por box y por render (decisión 1.6): lo genera el
  // dispositivo, no el servidor, y viaja oculto con el formulario.
  const identificadores = useMemo(
    () => new Map(boxes.map((b) => [b.instalacionId, crypto.randomUUID()])),
    [boxes],
  );

  const alternar = (id: string) =>
    setElegidos((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  if (boxes.length === 0) {
    return <p className="card mt-4 p-6 text-center text-muted">No hay boxes activos registrados.</p>;
  }

  /** M14 · Ver el comentario homólogo en `campo/alimentacion/planilla.tsx`. */
  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    if (!debeEncolarse(navigator.onLine)) return;

    evento.preventDefault();
    const filas = filasDeFormulario(new FormData(evento.currentTarget)).filter(
      (f): f is typeof f & { instalacionId: string } => f.instalacionId !== null,
    );
    if (filas.length === 0) return;

    await encolar('higiene', filas);
    avisarCambioDeCola();
    setEncolado(filas.length);
  }

  return (
    <form action={accion} onSubmit={alEnviar} className="mt-4">
      <input type="hidden" name="filas" value={[...elegidos].join(',')} />

      <ul className="space-y-2">
        {boxes.map((box) => {
          const elegido = elegidos.has(box.instalacionId);
          return (
            <li key={box.instalacionId} className="card p-4">
              <input
                type="hidden"
                name={`id-${box.instalacionId}`}
                value={identificadores.get(box.instalacionId)}
              />
              <input
                type="hidden"
                name={`instalacion-${box.instalacionId}`}
                value={box.instalacionId}
              />
              <input
                type="hidden"
                name={`caballo-${box.instalacionId}`}
                value={box.caballoId ?? ''}
              />
              <input type="hidden" name={`hacer-${box.instalacionId}`} value={elegido ? 'si' : 'no'} />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{box.nombre}</p>
                  <p className="text-sm text-muted">
                    {box.caballoNombre ?? 'desocupado'} · cama {diasDesde(box.ultimaHigiene)}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-gho btn-sm shrink-0"
                  aria-pressed={elegido}
                  onClick={() => alternar(box.instalacionId)}
                >
                  {elegido ? (
                    <CheckCircle size={18} weight="fill" className="text-ok" aria-hidden="true" />
                  ) : (
                    <Circle size={18} aria-hidden="true" />
                  )}
                  {elegido ? 'Atendido' : 'Marcar'}
                </button>
              </div>

              {elegido && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="label sm:col-span-1">
                    Material repuesto
                    <select className="input" name={`insumo-${box.instalacionId}`} defaultValue="">
                      <option value="">No repuso</option>
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} ({i.unidad})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="label">
                    Cantidad
                    <input
                      className="input tnum"
                      type="text"
                      inputMode="decimal"
                      name={`cantidad-${box.instalacionId}`}
                      placeholder="0"
                    />
                  </label>
                  <label className="label">
                    Anomalía del box
                    <input
                      className="input"
                      type="text"
                      name={`obs-${box.instalacionId}`}
                      placeholder="filtración, deterioro…"
                    />
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {encolado !== null && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-warn">
          <WifiSlash size={16} className="shrink-0" aria-hidden="true" />
          Sin conexión: {encolado === 1 ? '1 box guardado' : `${encolado} boxes guardados`} en el dispositivo. Se
          suben solos cuando vuelva la señal.
        </p>
      )}
      {resultado.estado === 'error' && <p className="error mt-3">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && (
        <p className="mt-3 text-sm text-ok">
          {resultado.registrados} {resultado.registrados === 1 ? 'box registrado' : 'boxes registrados'}
          {resultado.repetidos > 0 && ` · ${resultado.repetidos} ya estaban`}.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="tnum text-sm text-muted">
          {elegidos.size} de {boxes.length} marcados
        </p>
        <BotonEnviar texto="Registrar la higiene" cargando="Registrando…" />
      </div>
    </form>
  );
}
