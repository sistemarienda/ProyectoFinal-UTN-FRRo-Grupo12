'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

function comoNumeroOAlgoNulo(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? '').trim();
  return texto === '' ? null : Number(texto);
}

function comoTextoOAlgoNulo(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? '').trim();
  return texto === '' ? null : texto;
}

export async function crearEvento(_previo: ResultadoDeGuardado, datos: FormData): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const evento = await api.evento.crear({
      nombre: String(datos.get('nombre') ?? ''),
      tipo: String(datos.get('tipo') ?? 'torneo') as 'torneo' | 'exposicion' | 'colonia' | 'otro',
      fechaInicio: String(datos.get('fechaInicio') ?? ''),
      horaInicio: String(datos.get('horaInicio') ?? '10:00'),
      fechaFin: comoTextoOAlgoNulo(datos.get('fechaFin')),
      cierraInscripcionEn: comoTextoOAlgoNulo(datos.get('cierraInscripcionEn')),
      cupo: comoNumeroOAlgoNulo(datos.get('cupo')),
      servicioId: comoTextoOAlgoNulo(datos.get('servicioId')),
    });
    revalidatePath('/eventos');
    revalidatePath(`/eventos/${evento.eventoId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo crear el evento.' };
  }
}

export async function modificarEvento(_previo: ResultadoDeGuardado, datos: FormData): Promise<ResultadoDeGuardado> {
  const eventoId = String(datos.get('eventoId') ?? '');
  try {
    const api = await llamador();
    await api.evento.modificar({
      eventoId,
      nombre: String(datos.get('nombre') ?? ''),
      tipo: String(datos.get('tipo') ?? 'torneo') as 'torneo' | 'exposicion' | 'colonia' | 'otro',
      fechaInicio: String(datos.get('fechaInicio') ?? ''),
      horaInicio: String(datos.get('horaInicio') ?? '10:00'),
      fechaFin: comoTextoOAlgoNulo(datos.get('fechaFin')),
      cierraInscripcionEn: comoTextoOAlgoNulo(datos.get('cierraInscripcionEn')),
      cupo: comoNumeroOAlgoNulo(datos.get('cupo')),
      servicioId: comoTextoOAlgoNulo(datos.get('servicioId')),
      estado: String(datos.get('estado') ?? 'borrador') as 'borrador' | 'abierto' | 'cerrado' | 'realizado',
    });
    revalidatePath('/eventos');
    revalidatePath(`/eventos/${eventoId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar el evento.' };
  }
}

export async function inscribirAEvento(_previo: ResultadoDeGuardado, datos: FormData): Promise<ResultadoDeGuardado> {
  const eventoId = String(datos.get('eventoId') ?? '');
  try {
    const api = await llamador();
    await api.evento.inscribir({
      eventoId,
      clienteId: String(datos.get('clienteId') ?? ''),
      alumnoId: comoTextoOAlgoNulo(datos.get('alumnoId')),
      caballoId: comoTextoOAlgoNulo(datos.get('caballoId')),
    });
    revalidatePath(`/eventos/${eventoId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo inscribir.' };
  }
}

export async function enviarInvitacionDeEvento(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const eventoId = String(datos.get('eventoId') ?? '');
  try {
    const api = await llamador();
    const resultado = await api.evento.enviarInvitacion({ eventoId });
    revalidatePath(`/eventos/${eventoId}`);
    return { estado: 'ok', guardados: resultado.enviados };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo enviar la invitación.' };
  }
}
