'use client';

import { type FormEvent, useActionState, useMemo, useState } from 'react';
import { CheckCircle, Circle, WarningCircle, WifiSlash } from '@phosphor-icons/react';
import { BotonEnviar } from '../../botones';
import { avisarCambioDeCola } from '../../estado-conexion';
import { filasDeFormulario } from '@/lib/bienestar';
import { debeEncolarse } from '@/lib/offline';
import { encolar } from '@/lib/offline-db';
import { type ResultadoDeTanda, registrarAlimentacion } from '../acciones';

export interface TareaVisible {
  caballoId: string;
  nombre: string;
  instalacionNombre: string | null;
  enTratamiento: boolean;
  hecho: boolean;
  descripcion: string | null;
  cantidadKg: number | null;
  insumoId: string | null;
  insumoNombre: string | null;
  insumoUnidad: string | null;
  motivoSinRacion: 'sin_plan' | 'sin_peso' | 'sin_cantidad' | null;
}

const AVISO: Record<NonNullable<TareaVisible['motivoSinRacion']>, string> = {
  sin_plan: 'Sin plan vigente para este momento. Se registra con carga manual.',
  sin_cantidad: 'El plan no fija cantidad. Cargar lo que se sirvió.',
  sin_peso: 'El caballo no tiene peso registrado. Cargar en la unidad del insumo.',
};

const inicial: ResultadoDeTanda = { estado: 'inicial' };

/**
 * Planilla de la toma (CUS02).
 *
 * Dos cosas que no son de presentación y conviene no tocar sin leer el caso de
 * uso:
 *
 * 1. **El identificador de cada registro se genera acá**, en el dispositivo, al
 *    dibujar la fila (decisión 1.6). Va en un campo oculto y viaja con el
 *    formulario. Hoy sirve para que un doble envío no duplique; cuando exista
 *    M14 va a ser lo que haga idempotente a la cola sin cambiar nada de esto.
 *
 * 2. **Viene todo marcado.** La toma se sirve a todos los caballos alojados, así
 *    que lo excepcional es saltear a uno, no incluirlo. Arrancar en blanco
 *    obligaría a N toques para el caso normal y a ninguno para el raro, que es
 *    exactamente al revés de lo que conviene.
 */
export function PlanillaDeAlimentacion({
  tareas,
  momento,
  momentoTexto,
  fecha,
}: {
  tareas: TareaVisible[];
  /** El valor del enum: viaja con el formulario para fechar el registro. */
  momento: string;
  momentoTexto: string;
  fecha: string;
}) {
  const pendientes = useMemo(() => tareas.filter((t) => !t.hecho), [tareas]);
  const [salteados, setSalteados] = useState<ReadonlySet<string>>(new Set());
  const [resultado, accion] = useActionState(registrarAlimentacion, inicial);
  const [encolado, setEncolado] = useState<number | null>(null);

  // Un identificador por fila y por render de la pantalla. `useMemo` sobre los
  // pendientes: si la lista no cambia, los identificadores tampoco, y reenviar
  // el mismo formulario reenvía los mismos.
  const identificadores = useMemo(
    () => new Map(pendientes.map((t) => [t.caballoId, crypto.randomUUID()])),
    [pendientes],
  );

  if (pendientes.length === 0) {
    return (
      <div className="card mt-4 p-6 text-center">
        <CheckCircle size={28} weight="fill" className="mx-auto text-ok" aria-hidden="true" />
        <p className="mt-2 font-serif text-lg">La toma de la {momentoTexto} está completa.</p>
        <p className="mt-1 text-sm text-muted">
          {tareas.length} {tareas.length === 1 ? 'caballo registrado' : 'caballos registrados'}.
        </p>
      </div>
    );
  }

  /**
   * M14 · Si no hay señal, la toma no se pierde: se guarda en el dispositivo
   * y se sube sola cuando vuelva la conexión (`estado-conexion.tsx`).
   *
   * Sólo mira `navigator.onLine`: una wifi cautiva que se declara en línea y
   * no llega a ningún lado queda fuera de esta versión, documentado en
   * `debeEncolarse`.
   */
  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    if (!debeEncolarse(navigator.onLine)) return; // sigue como envío normal

    evento.preventDefault();
    const filas = filasDeFormulario(new FormData(evento.currentTarget)).filter(
      (f): f is typeof f & { caballoId: string } => f.caballoId !== null,
    );
    if (filas.length === 0) return;

    await encolar('alimentacion', filas);
    avisarCambioDeCola();
    setEncolado(filas.length);
  }

  return (
    <form action={accion} onSubmit={alEnviar} className="mt-4">
      <input type="hidden" name="filas" value={pendientes.map((t) => t.caballoId).join(',')} />
      <input type="hidden" name="momento" value={momento} />
      <input type="hidden" name="fecha" value={fecha} />

      <ul className="space-y-2">
        {pendientes.map((tarea) => {
          const salteado = salteados.has(tarea.caballoId);
          return (
            <li key={tarea.caballoId} className={`card p-4 ${salteado ? 'opacity-55' : ''}`}>
              <input type="hidden" name={`id-${tarea.caballoId}`} value={identificadores.get(tarea.caballoId)} />
              <input type="hidden" name={`caballo-${tarea.caballoId}`} value={tarea.caballoId} />
              <input type="hidden" name={`insumo-${tarea.caballoId}`} value={tarea.insumoId ?? ''} />
              <input
                type="hidden"
                name={`hacer-${tarea.caballoId}`}
                value={salteado ? 'no' : 'si'}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {tarea.nombre}
                    {tarea.enTratamiento && (
                      <span className="badge badge-warn ml-2">En tratamiento</span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {tarea.instalacionNombre ?? 'sin box asignado'}
                    {tarea.descripcion ? ` · ${tarea.descripcion}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-gho btn-sm shrink-0"
                  aria-pressed={!salteado}
                  onClick={() =>
                    setSalteados((previos) => {
                      const siguiente = new Set(previos);
                      if (siguiente.has(tarea.caballoId)) siguiente.delete(tarea.caballoId);
                      else siguiente.add(tarea.caballoId);
                      return siguiente;
                    })
                  }
                >
                  {salteado ? (
                    <Circle size={18} aria-hidden="true" />
                  ) : (
                    <CheckCircle size={18} weight="fill" className="text-ok" aria-hidden="true" />
                  )}
                  {salteado ? 'Saltear' : 'Servir'}
                </button>
              </div>

              {tarea.motivoSinRacion && !salteado && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-warn">
                  <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {AVISO[tarea.motivoSinRacion]}
                </p>
              )}

              {!salteado && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="label">
                    Cantidad
                    {tarea.insumoUnidad ? ` (${tarea.insumoUnidad})` : ' (kg)'}
                    <input
                      className="input tnum"
                      type="text"
                      inputMode="decimal"
                      name={`cantidad-${tarea.caballoId}`}
                      defaultValue={tarea.cantidadKg ?? ''}
                      placeholder={tarea.insumoId ? 'lo servido' : 'no descuenta stock'}
                    />
                  </label>
                  <label className="label">
                    Novedad
                    <input
                      className="input"
                      type="text"
                      name={`obs-${tarea.caballoId}`}
                      placeholder="rechazo, sobrante, cojera…"
                    />
                  </label>
                </div>
              )}

              {!salteado && tarea.insumoNombre === null && tarea.insumoId === null && (
                <p className="helper mt-1">Sin insumo asociado: el suministro se registra sin descontar existencias.</p>
              )}
            </li>
          );
        })}
      </ul>

      {encolado !== null && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-warn">
          <WifiSlash size={16} className="shrink-0" aria-hidden="true" />
          Sin conexión: {encolado === 1 ? '1 registro guardado' : `${encolado} registros guardados`} en el
          dispositivo. Se suben solos cuando vuelva la señal.
        </p>
      )}
      {resultado.estado === 'error' && <p className="error mt-3">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && (
        <p className="mt-3 text-sm text-ok">
          {resultado.registrados} {resultado.registrados === 1 ? 'registro guardado' : 'registros guardados'}
          {resultado.repetidos > 0 && ` · ${resultado.repetidos} ya estaban`}.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="tnum text-sm text-muted">
          {pendientes.length - salteados.size} de {pendientes.length} por registrar
        </p>
        <BotonEnviar texto="Registrar la toma" cargando="Registrando…" />
      </div>
    </form>
  );
}
