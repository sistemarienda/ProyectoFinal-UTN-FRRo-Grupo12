'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

export async function inscribirmeAEvento(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const alumnoId = String(datos.get('alumnoId') ?? '');
    const caballoId = String(datos.get('caballoId') ?? '');
    await api.portal.inscribirEvento({
      eventoId: String(datos.get('eventoId') ?? ''),
      alumnoId: alumnoId || null,
      caballoId: caballoId || null,
    });
    revalidatePath('/portal/avisos');
    revalidatePath('/portal');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo hacer la inscripción.' };
  }
}
