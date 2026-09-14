'use server';

import { redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';

export type ResultadoDePago = { estado: 'inicial' } | { estado: 'error'; mensaje: string };

/**
 * Genera la preferencia de MercadoPago del saldo propio y manda directo al
 * checkout. No hay un estado «ok» que mostrar: si sale bien, el navegador ya
 * se fue a MercadoPago; si sale mal —falta la credencial, no hay saldo—, se
 * queda en la pantalla con el motivo.
 */
export async function pagarConMercadoPago(
  _previo: ResultadoDePago,
  _datos: FormData,
): Promise<ResultadoDePago> {
  let destino: string;
  try {
    const api = await llamador();
    const r = await api.portal.pagar({});
    if (!r.linkPago) {
      return { estado: 'error', mensaje: 'MercadoPago no devolvió un enlace de pago.' };
    }
    destino = r.linkPago;
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo generar el enlace de pago.' };
  }
  redirect(destino);
}
