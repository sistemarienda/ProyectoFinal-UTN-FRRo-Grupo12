'use client';

import { useActionState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { inscribirmeAClase, cancelarMiInscripcion } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';
import { Modal } from '../../modal';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function BotonInscribir({ claseId, alumnoId, alumno }: { claseId: string; alumnoId: string; alumno: string }) {
  const [resultado, enviar] = useActionState(inscribirmeAClase, inicial);

  return (
    <form action={enviar} className="mt-3">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="alumnoId" value={alumnoId} />
      <BotonEnviar texto={`Inscribir a ${alumno}`} cargando="Inscribiendo…" tamano="sm" />
      {resultado.estado === 'error' && <p className="error mt-1.5">{resultado.mensaje}</p>}
    </form>
  );
}

/**
 * El plazo se dice ANTES de cancelar (04-wireframes.md § 7.1): si está en
 * término, cancela directo; si no, primero explica que el cargo no cambia y
 * recién ahí pide confirmar. `enTermino` ya viene calculado del servidor
 * (`portal.agenda`), con el mismo parámetro que usa la cancelación real.
 */
export function BotonCancelar({
  inscripcionId,
  enTermino,
  diasMinimos,
}: {
  inscripcionId: string;
  enTermino: boolean;
  diasMinimos: number;
}) {
  if (enTermino) {
    return (
      <FormularioCancelar inscripcionId={inscripcionId}>
        <BotonEnviar texto="Cancelar" variante="sec" tamano="sm" cargando="Cancelando…" />
      </FormularioCancelar>
    );
  }

  return (
    <Modal etiqueta="Cancelar" titulo="Cancelar clase" variante="sec" tamano="sm">
      <div className="space-y-3">
        <div className="card p-4" role="alert" style={{ borderColor: 'var(--warn)' }}>
          <div className="flex items-start gap-2">
            <Warning className="text-lg text-warn shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Fuera del plazo de cancelación</p>
              <p className="text-xs text-fg-muted mt-1">
                El haras pide avisar con <b className="tnum">{diasMinimos} días</b> de anticipación y esta clase es
                antes de eso, así que se cobra igual.
              </p>
            </div>
          </div>
        </div>
        <p className="helper">
          Podés cancelarla de todos modos —para que el instructor no te espere— pero el cargo del mes no cambia.
        </p>
        <FormularioCancelar inscripcionId={inscripcionId}>
          <BotonEnviar texto="Cancelar y aceptar el cargo" cargando="Cancelando…" />
        </FormularioCancelar>
      </div>
    </Modal>
  );
}

function FormularioCancelar({ inscripcionId, children }: { inscripcionId: string; children: React.ReactNode }) {
  const [resultado, enviar] = useActionState(cancelarMiInscripcion, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      {children}
      {resultado.estado === 'error' && <p className="error mt-1.5">{resultado.mensaje}</p>}
    </form>
  );
}
