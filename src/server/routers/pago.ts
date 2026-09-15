import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { cuentaDeCliente, nombreDeCliente } from './cuentaCorriente';
import { primerDiaDelMes } from '@/lib/cobranza';
import type { Database } from '@/lib/supabase/tipos-generados';
import { mensajeDeError } from '../errores';
import { notificarPorCodigo } from '../notificaciones';

/**
 * M4 · Pagos.
 *
 * Cierra el circuito del dinero: la cobranza (M3) informa cuánto se debe, acá
 * se registra qué entró. `pago` y la imputación a `movimiento_cuenta` son dos
 * pasos deliberadamente separados (`10-puntos-funcion.md`): un pago puede
 * existir sin estar todavía aplicado a una cuenta —es lo que pasa con cada
 * notificación de MercadoPago hasta que alguien la concilia—, y separarlos es
 * lo que hace posible la conciliación como pantalla propia.
 *
 * **Límite honesto de esta versión.** El sistema no tiene todavía credenciales
 * reales de MercadoPago (`07-dependencias-externas.md`: no bloquea el
 * desarrollo, sí la producción). `generarPreferencia` sabe construir la
 * petición real a la API y falla con un mensaje claro si faltan las
 * credenciales; `/api/webhooks/mercadopago` sabe verificar la firma real de una
 * notificación. Lo que falta para que ambas funcionen de punta a punta es un
 * `MERCADOPAGO_ACCESS_TOKEN` y un `MERCADOPAGO_WEBHOOK_SECRET` reales.
 */
const procedimiento = procedimientoDeArea('gerencia');

const TEXTO_MEDIO: Record<string, string> = {
  mercadopago: 'MercadoPago',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
};

/**
 * El núcleo de `generarPreferencia`, compartido con `portal.pagar` (M13): el
 * cliente genera su propio enlace con la misma lógica y la misma honestidad
 * sobre la credencial que falta, sólo que restringido a su propio saldo por el
 * guarda del router que lo llama, no acá.
 */
export async function crearPreferenciaMercadoPago(
  supabase: SupabaseClient<Database>,
  input: { clienteId: string; importe: number; concepto: string },
) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Falta MERCADOPAGO_ACCESS_TOKEN en este entorno. No bloquea el desarrollo de lo demás, pero sin credenciales reales no se puede generar un enlace de pago (07-dependencias-externas.md).',
    });
  }

  const { data: pago, error } = await supabase
    .from('pago')
    .insert({ cliente_id: input.clienteId, importe: input.importe, medio: 'mercadopago', estado: 'pendiente' })
    .select('id')
    .single();
  if (error || !pago) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error, 'No se pudo registrar el pago.') });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ title: input.concepto, quantity: 1, currency_id: 'ARS', unit_price: input.importe }],
        external_reference: pago.id,
      }),
    });
  } catch (e) {
    await supabase.from('pago').delete().eq('id', pago.id);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `No se pudo contactar a MercadoPago: ${e instanceof Error ? e.message : 'error desconocido'}.`,
    });
  }

  if (!respuesta.ok) {
    await supabase.from('pago').delete().eq('id', pago.id);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `MercadoPago rechazó la preferencia (${respuesta.status}).`,
    });
  }

  const preferencia = (await respuesta.json()) as { init_point?: string };
  return { pagoId: pago.id as string, linkPago: preferencia.init_point ?? null };
}

export const routerPago = crearRouter({
  /** Pagos del período (EQ), con el mismo criterio de período que los cargos. */
  listarDelPeriodo: procedimiento
    .input(z.object({ periodo: z.iso.date() }))
    .query(async ({ ctx, input }) => {
      const periodo = primerDiaDelMes(new Date(`${input.periodo}T00:00:00Z`));
      const finDeMes = new Date(Date.UTC(periodo.getUTCFullYear(), periodo.getUTCMonth() + 1, 0, 23, 59, 59));

      const { data, error } = await ctx.supabase
        .from('pago')
        .select(
          'id, importe, medio, estado, referencia_externa, acreditado_en, creado_en, cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))',
        )
        .gte('creado_en', periodo.toISOString())
        .lte('creado_en', finDeMes.toISOString())
        .order('creado_en', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      // Sólo para saber si ya corresponde ofrecer "Imputar": la fuente de verdad
      // de qué está imputado sigue siendo `movimiento_cuenta.pago_id`.
      const { data: imputados } = await ctx.supabase
        .from('movimiento_cuenta')
        .select('pago_id')
        .not('pago_id', 'is', null);
      const imputadosSet = new Set((imputados ?? []).map((m) => m.pago_id));

      return (data ?? []).map((p) => ({
        ...p,
        nombreCliente: p.cliente ? nombreDeCliente(p.cliente) : '—',
        imputado: imputadosSet.has(p.id),
      }));
    }),

  /** Detalle de un pago (EQ), con su imputación si la tiene. */
  detalle: procedimiento.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const { data: pago, error } = await ctx.supabase
      .from('pago')
      .select(
        'id, importe, medio, estado, referencia_externa, acreditado_en, creado_en, cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))',
      )
      .eq('id', input.id)
      .single();

    if (error || !pago) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese pago.' });

    const { data: imputacion } = await ctx.supabase
      .from('movimiento_cuenta')
      .select('id, creado_en')
      .eq('pago_id', input.id)
      .maybeSingle();

    return { ...pago, nombreCliente: pago.cliente ? nombreDeCliente(pago.cliente) : '—', imputacion: imputacion ?? null };
  }),

  /** Pagos acreditados que todavía no se imputaron a ninguna cuenta (EO). */
  conciliacionSinImputar: procedimiento.query(async ({ ctx }) => {
    const { data: acreditados, error } = await ctx.supabase
      .from('pago')
      .select(
        'id, importe, medio, acreditado_en, cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))',
      )
      .eq('estado', 'acreditado')
      .order('acreditado_en', { ascending: true });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    const { data: imputados } = await ctx.supabase
      .from('movimiento_cuenta')
      .select('pago_id')
      .not('pago_id', 'is', null);
    const imputadosSet = new Set((imputados ?? []).map((m) => m.pago_id));

    return (acreditados ?? [])
      .filter((p) => !imputadosSet.has(p.id))
      .map((p) => ({ ...p, nombreCliente: p.cliente ? nombreDeCliente(p.cliente) : '—' }));
  }),

  /**
   * Registrar un pago manual (EI): transferencia, efectivo o cheque que el
   * administrador ya tiene en mano. A diferencia de MercadoPago, no hay una
   * confirmación externa que esperar: queda `acreditado` de una.
   */
  registrarManual: procedimientoAdmin
    .input(
      z.object({
        clienteId: z.uuid(),
        importe: z.number().positive('El importe tiene que ser mayor a cero.'),
        medio: z.enum(['transferencia', 'efectivo', 'cheque']),
        referenciaExterna: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('pago')
        .insert({
          cliente_id: input.clienteId,
          importe: input.importe,
          medio: input.medio,
          referencia_externa: input.referenciaExterna || null,
          estado: 'acreditado',
          acreditado_en: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ya existe un pago registrado con esa referencia.' });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      }

      // M15: acuse de pago recibido, mejor esfuerzo.
      await notificarPorCodigo({
        codigoPlantilla: 'pago_recibido',
        clienteId: input.clienteId,
        valores: { importe: input.importe.toFixed(2), fecha: new Date().toISOString().slice(0, 10) },
      });

      return { pagoId: data.id as string };
    }),

  /**
   * Generar un enlace de pago (EI): crea el `pago` en `pendiente` y, con
   * credenciales reales, la preferencia de MercadoPago. `external_reference`
   * es el propio id del pago: es lo que le permite al webhook, más adelante,
   * encontrar de qué pago está hablando la notificación.
   */
  generarPreferencia: procedimientoAdmin
    .input(
      z.object({
        clienteId: z.uuid(),
        importe: z.number().positive('El importe tiene que ser mayor a cero.'),
        concepto: z.string().trim().min(1, 'Hace falta describir el concepto.'),
      }),
    )
    .mutation(async ({ ctx, input }) => crearPreferenciaMercadoPago(ctx.supabase, input)),

  /**
   * Imputar un pago a la cuenta corriente (EI): el paso que efectivamente salda
   * deuda. Un pago sólo se imputa una vez; RN y el modelo lo dejan a mano y no
   * automático porque un pago puede corresponder a más de un período o a un
   * cliente distinto al que MercadoPago identificó (RN de conciliación).
   */
  imputar: procedimientoAdmin.input(z.object({ pagoId: z.uuid() })).mutation(async ({ ctx, input }) => {
    const { data: pago, error } = await ctx.supabase
      .from('pago')
      .select('id, cliente_id, importe, medio, estado')
      .eq('id', input.pagoId)
      .single();
    if (error || !pago) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese pago.' });
    if (pago.estado !== 'acreditado') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sólo se imputa un pago acreditado.' });
    }

    const { data: yaImputado } = await ctx.supabase
      .from('movimiento_cuenta')
      .select('id')
      .eq('pago_id', pago.id)
      .maybeSingle();
    if (yaImputado) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Este pago ya está imputado a una cuenta.' });
    }

    const cuentaId = await cuentaDeCliente(ctx.supabase, pago.cliente_id);
    const { error: errorInsert } = await ctx.supabase.from('movimiento_cuenta').insert({
      cuenta_corriente_id: cuentaId,
      tipo: 'pago',
      concepto: `Pago · ${TEXTO_MEDIO[pago.medio] ?? pago.medio}`,
      importe: -Number(pago.importe),
      pago_id: pago.id,
    });
    if (errorInsert) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorInsert) });
    return { ok: true as const };
  }),

  /**
   * Anular la imputación de un pago (EI): a diferencia de condonar un interés,
   * acá no hay nada que un cliente ya vio en un estado de cuenta que conservar
   * —es la corrección de una imputación mal hecha—, así que se borra el
   * movimiento en vez de compensarlo. El disparador de saldo y la auditoría lo
   * registran igual (queda la baja en `auditoria`).
   */
  anularImputacion: procedimientoAdmin
    .input(z.object({ movimientoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: movimiento, error } = await ctx.supabase
        .from('movimiento_cuenta')
        .select('id, tipo, pago_id')
        .eq('id', input.movimientoId)
        .single();
      if (error || !movimiento) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese movimiento.' });
      if (movimiento.tipo !== 'pago' || !movimiento.pago_id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sólo se anula la imputación de un movimiento de pago.' });
      }

      const { error: errorDelete } = await ctx.supabase.from('movimiento_cuenta').delete().eq('id', input.movimientoId);
      if (errorDelete) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorDelete) });
      return { ok: true as const };
    }),
});
