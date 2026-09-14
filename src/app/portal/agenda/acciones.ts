'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

function refrescar() {
  revalidatePath('/portal');
  revalidatePath('/portal/agenda');
}

export async function inscribirmeAClase(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.inscripcion.inscribirPropio({
      claseId: String(datos.get('claseId') ?? ''),
      alumnoId: String(datos.get('alumnoId') ?? ''),
    });
    refrescar();
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo hacer la inscripción.' };
  }
}

export async function cancelarMiInscripcion(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.inscripcion.cancelarPropio({ inscripcionId: String(datos.get('inscripcionId') ?? '') });
    refrescar();
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo cancelar la inscripción.' };
  }
}
