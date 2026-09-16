'use server';

import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';

export interface MensajeDelChat {
  rol: 'usuario' | 'asistente';
  texto: string;
}

export type RespuestaDelAsistente =
  | { estado: 'ok'; texto: string; herramientas: string[] }
  | { estado: 'error'; mensaje: string };

/** M12 · Envoltorio fino sobre `asistente.preguntar`, igual que el resto de las acciones del panel del personal. */
export async function preguntarAlAsistente(mensajes: MensajeDelChat[]): Promise<RespuestaDelAsistente> {
  try {
    const api = await llamador();
    const r = await api.asistente.preguntar({ mensajes });
    return { estado: 'ok', texto: r.texto, herramientas: r.herramientas };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo consultar al asistente.' };
  }
}
