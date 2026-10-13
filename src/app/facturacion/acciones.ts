'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

export async function emitirComprobante(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.comprobante.emitir({
      clienteId: String(datos.get('clienteId') ?? ''),
      movimientoIds: datos.getAll('movimientoIds').map(String),
      puntoVentaId: String(datos.get('puntoVentaId') ?? ''),
    });
    revalidatePath('/facturacion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo emitir el comprobante.' };
  }
}

export type ResultadoDeLote =
  | { estado: 'inicial' }
  | { estado: 'ok'; emitidos: number; resultados: { clienteId: string; cliente: string; estado: 'autorizado' | 'rechazado'; motivo?: string }[] }
  | { estado: 'error'; mensaje: string };

export async function emitirLote(
  _previo: ResultadoDeLote,
  datos: FormData,
): Promise<ResultadoDeLote> {
  try {
    const api = await llamador();
    const r = await api.comprobante.emitirLote({ puntoVentaId: String(datos.get('puntoVentaId') ?? '') });
    revalidatePath('/facturacion');
    return { estado: 'ok', ...r };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo emitir el lote.' };
  }
}

export async function reintentarComprobante(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.comprobante.reintentar({ comprobanteId: String(datos.get('comprobanteId') ?? '') });
    revalidatePath('/facturacion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo reintentar el comprobante.' };
  }
}
