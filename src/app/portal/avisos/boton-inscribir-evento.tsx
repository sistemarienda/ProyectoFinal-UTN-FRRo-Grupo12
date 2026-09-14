'use client';

import { useActionState } from 'react';
import { inscribirmeAEvento } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function BotonInscribirEvento({
  eventoId,
  alumnoId = null,
  caballoId = null,
  texto,
}: {
  eventoId: string;
  alumnoId?: string | null;
  caballoId?: string | null;
  texto: string;
}) {
  const [resultado, enviar] = useActionState(inscribirmeAEvento, inicial);

  return (
    <form action={enviar} className="mt-2">
      <input type="hidden" name="eventoId" value={eventoId} />
      {alumnoId && <input type="hidden" name="alumnoId" value={alumnoId} />}
      {caballoId && <input type="hidden" name="caballoId" value={caballoId} />}
      <BotonEnviar texto={texto} cargando="Inscribiendo…" />
      {resultado.estado === 'error' && <p className="error mt-1.5">{resultado.mensaje}</p>}
    </form>
  );
}
