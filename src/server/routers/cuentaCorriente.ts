import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { obtenerParametrosDeCobranza } from '../parametros-servidor';
import { tarifaVigenteEn } from '@/lib/tarifas';
import { fechaDeVencimiento, primerDiaDelMes, comienzoDelDia, clasificarEstadoCartera, saldosPendientesFifo, bucketsDeAntiguedad, resumenDeCartera } from '@/lib/cobranza';
import { calcularMora, diasDeAtraso } from '@/lib/mora';
import type { Database } from '@/lib/supabase/tipos-generados';
import { mensajeDeError } from '../errores';

/**
 * M3 · Cuentas corrientes y cobranza.
 *
 * El proceso que originó el proyecto y el que documenta el CUS01. Genera los
 * cargos del período recorriendo los contratos vigentes (decisión 1.4: al
 * precio de la tarifa vigente o al pactado si lo hay), y a partir de ahí el
 * saldo lo mantiene solo el disparador `trg_saldo_cuenta` — este router nunca
 * escribe `cuenta_corriente.saldo`.
 *
 * Alcance de esta versión: sólo los contratos de servicio `mensual`
 * (pensiones). Facturar clases por asistencia depende de M7/M8, que todavía
 * no están construidos; generar un cargo mensual para una clase inventaría
 * una asistencia que el sistema no registró.
 */

const procedimiento = procedimientoDeArea('gerencia');

/** También la usa `pago.ts` (M4) para imputar un pago a la cuenta correcta. */
export async function cuentaDeCliente(supabase: SupabaseClient<Database>, clienteId: string) {
  const { data: existente } = await supabase
    .from('cuenta_corriente')
    .select('id')
    .eq('cliente_id', clienteId)
    .maybeSingle();
  if (existente) return existente.id;

  // Defensivo: todo cliente nuevo ya sale con cuenta corriente (`cliente.crear`),
  // esto sólo cubre datos que hayan quedado de antes de esa regla.
  const { data: nueva, error } = await supabase
    .from('cuenta_corriente')
    .insert({ cliente_id: clienteId })
    .select('id')
    .single();
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
  return nueva.id;
}

/** También la usa `pago.ts` (M4): un pago se lista por el nombre de quien pagó. */
export function nombreDeCliente(c: {
  tipo: string;
  razon_social: string | null;
  persona: { nombre: string; apellido: string } | null;
}) {
  return c.tipo === 'persona_juridica' ? (c.razon_social ?? '') : `${c.persona?.apellido ?? ''}, ${c.persona?.nombre ?? ''}`;
}

export const routerCuentaCorriente = crearRouter({
  /** Listado de la cartera con su estado (EQ). */
  listarCartera: procedimiento.query(async ({ ctx }) => {
    const [{ data: cuentas, error }, { data: movimientos }, parametros] = await Promise.all([
      ctx.supabase
        .from('cuenta_corriente')
        .select(
          'id, saldo, cliente:cliente_id (id, tipo, razon_social, activo, persona:persona_id (nombre, apellido))',
        )
        .order('saldo', { ascending: false }),
      ctx.supabase.from('movimiento_cuenta').select('cuenta_corriente_id, tipo, importe, vence_en, creado_en'),
      obtenerParametrosDeCobranza(ctx.supabase),
    ]);
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    const hoy = comienzoDelDia(new Date());
    return (cuentas ?? [])
      .filter((c) => c.cliente)
      .map((c) => {
        const propios = (movimientos ?? []).filter((m) => m.cuenta_corriente_id === c.id);
        const pendientes = saldosPendientesFifo(
          propios.map((m) => ({
            tipo: m.tipo,
            importe: Number(m.importe),
            venceEn: m.vence_en,
            ocurridoEn: m.creado_en,
          })),
        );
        const proximoVencimiento = pendientes.length
          ? pendientes.reduce((min, p) => (p.venceEn < min ? p.venceEn : min), pendientes[0]!.venceEn)
          : null;

        return {
          cuentaId: c.id,
          clienteId: c.cliente!.id,
          nombre: nombreDeCliente(c.cliente!),
          activo: c.cliente!.activo,
          saldo: Number(c.saldo),
          proximoVencimiento,
          estado: clasificarEstadoCartera(
            Number(c.saldo),
            proximoVencimiento ? new Date(`${proximoVencimiento}T00:00:00Z`) : null,
            hoy,
            parametros.diasAvisoPrevioVencimiento,
          ),
        };
      });
  }),

  /** Libro mayor de un cliente (EQ): sus movimientos, más recientes primero. */
  libroMayor: procedimiento
    .input(z.object({ clienteId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const cuentaId = await cuentaDeCliente(ctx.supabase, input.clienteId);

      const { data, error } = await ctx.supabase
        .from('movimiento_cuenta')
        .select(
          'id, tipo, concepto, importe, periodo, vence_en, mora_tasa_aplicada, mora_dias, creado_en, contrato:contrato_id (id, servicio:servicio_id (nombre))',
        )
        .eq('cuenta_corriente_id', cuentaId)
        .order('creado_en', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const { data: cuenta } = await ctx.supabase
        .from('cuenta_corriente')
        .select('saldo')
        .eq('id', cuentaId)
        .single();

      return { saldo: Number(cuenta?.saldo ?? 0), movimientos: data ?? [] };
    }),

  /** Antigüedad de la deuda de un cliente (EO), en tramos de 30 días. */
  antiguedadDeuda: procedimiento
    .input(z.object({ clienteId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const cuentaId = await cuentaDeCliente(ctx.supabase, input.clienteId);
      const { data } = await ctx.supabase
        .from('movimiento_cuenta')
        .select('tipo, importe, vence_en, creado_en')
        .eq('cuenta_corriente_id', cuentaId);

      const pendientes = saldosPendientesFifo(
        (data ?? []).map((m) => ({
          tipo: m.tipo,
          importe: Number(m.importe),
          venceEn: m.vence_en,
          ocurridoEn: m.creado_en,
        })),
      );

      return bucketsDeAntiguedad(pendientes.map((p) => ({ importe: p.importe, venceEn: p.venceEn })), new Date());
    }),

  /** Resumen de la cartera del período (EO): totales para el panel de gerencia. */
  resumenCartera: procedimiento.query(async ({ ctx }) => {
    const { data: cuentas } = await ctx.supabase.from('cuenta_corriente').select('id, saldo');
    const { data: movimientos } = await ctx.supabase
      .from('movimiento_cuenta')
      .select('tipo, importe, vence_en, creado_en, cuenta_corriente_id');

    return resumenDeCartera(
      (cuentas ?? []).map((c) => ({ cuentaId: c.id, saldo: Number(c.saldo) })),
      (movimientos ?? []).map((m) => ({
        cuentaCorrienteId: m.cuenta_corriente_id,
        tipo: m.tipo,
        importe: Number(m.importe),
        venceEn: m.vence_en,
        ocurridoEn: m.creado_en,
      })),
      comienzoDelDia(new Date()),
    );
  }),

  /**
   * Genera los cargos del período (EI, CUS01).
   *
   * Un cargo por contrato vigente de servicio mensual, al importe pactado o a
   * la tarifa vigente del servicio. El índice único
   * `movimiento_cargo_unico_por_periodo` es la defensa real contra la doble
   * carga; acá se filtra antes para no depender sólo del error de la base.
   */
  generarCargosDelPeriodo: procedimientoAdmin
    .input(z.object({ periodo: z.iso.date() }))
    .mutation(async ({ ctx, input }) => {
      const periodo = primerDiaDelMes(new Date(`${input.periodo}T00:00:00Z`));
      const periodoIso = periodo.toISOString().slice(0, 10);
      const finDeMes = new Date(Date.UTC(periodo.getUTCFullYear(), periodo.getUTCMonth() + 1, 0));

      const parametros = await obtenerParametrosDeCobranza(ctx.supabase);

      const { data: contratos, error } = await ctx.supabase
        .from('contrato')
        .select(
          'id, cliente_id, importe_pactado, cliente:cliente_id (dia_vencimiento), servicio:servicio_id (id, nombre, unidad, tarifa(importe, vigente_desde)), caballo:caballo_id (nombre), alumno:alumno_id (persona:persona_id (nombre, apellido))',
        )
        .eq('estado', 'vigente')
        .lte('fecha_inicio', finDeMes.toISOString().slice(0, 10))
        .or(`fecha_fin.is.null,fecha_fin.gte.${periodoIso}`);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const mensuales = (contratos ?? []).filter((c) => c.servicio?.unidad === 'mensual');

      const { data: yaGenerados } = await ctx.supabase
        .from('movimiento_cuenta')
        .select('contrato_id')
        .eq('tipo', 'cargo')
        .eq('periodo', periodoIso)
        .in('contrato_id', mensuales.map((c) => c.id));
      const yaGeneradosSet = new Set((yaGenerados ?? []).map((m) => m.contrato_id));

      let generados = 0;
      let omitidos = 0;
      const sinTarifa: string[] = [];

      for (const contrato of mensuales) {
        if (yaGeneradosSet.has(contrato.id)) {
          omitidos++;
          continue;
        }

        const importe =
          contrato.importe_pactado != null
            ? Number(contrato.importe_pactado)
            : tarifaVigenteEn(
                (contrato.servicio!.tarifa ?? []).map((t) => ({
                  importe: Number(t.importe),
                  vigenteDesde: t.vigente_desde,
                })),
                periodo,
              )?.importe;

        if (importe == null) {
          sinTarifa.push(contrato.servicio!.nombre);
          continue;
        }

        const cuentaId = await cuentaDeCliente(ctx.supabase, contrato.cliente_id);
        const diaVencimiento = contrato.cliente?.dia_vencimiento ?? parametros.diaVencimientoDefault;

        const { error: errorInsert } = await ctx.supabase.from('movimiento_cuenta').insert({
          cuenta_corriente_id: cuentaId,
          tipo: 'cargo',
          // Lo que el cliente lee en su estado de cuenta: el servicio, sobre qué
          // caballo o alumno, y el mes. Un cliente con dos caballos en pensión
          // tiene que poder distinguir un cargo del otro.
          concepto: [
            contrato.servicio!.nombre,
            contrato.caballo?.nombre ??
              [contrato.alumno?.persona?.nombre, contrato.alumno?.persona?.apellido].filter(Boolean).join(' '),
            periodo.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
          ]
            .filter(Boolean)
            .join(' · '),
          contrato_id: contrato.id,
          importe,
          periodo: periodoIso,
          vence_en: fechaDeVencimiento(periodo, diaVencimiento).toISOString().slice(0, 10),
        });

        // El índice único puede rechazar una carrera entre dos clics; no es un
        // error real, es la protección haciendo su trabajo.
        if (errorInsert && errorInsert.code !== '23505') {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorInsert) });
        }
        if (!errorInsert) generados++;
      }

      return { generados, omitidos, sinTarifa: [...new Set(sinTarifa)] };
    }),

  /** Ajuste manual (EI): correcciones que no son ni un cargo ni un pago. */
  ajusteManual: procedimientoAdmin
    .input(
      z.object({
        clienteId: z.uuid(),
        concepto: z.string().trim().min(1, 'Hace falta describir el ajuste.'),
        importe: z.number().refine((n) => n !== 0, 'El importe no puede ser cero.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cuentaId = await cuentaDeCliente(ctx.supabase, input.clienteId);
      const { error } = await ctx.supabase.from('movimiento_cuenta').insert({
        cuenta_corriente_id: cuentaId,
        tipo: 'ajuste',
        concepto: input.concepto,
        importe: input.importe,
        aplicado_por: ctx.sesion.usuarioId,
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /** Cálculo propuesto de intereses por mora (EO, RN-09): sólo calcula, no imputa. */
  calcularMoraPropuesta: procedimiento
    .input(z.object({ clienteId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const cuentaId = await cuentaDeCliente(ctx.supabase, input.clienteId);
      const parametros = await obtenerParametrosDeCobranza(ctx.supabase);

      const { data: base } = await ctx.supabase.rpc('base_de_mora', {
        p_cuenta: cuentaId,
        p_al: new Date().toISOString().slice(0, 10),
      });

      const { data: movimientos } = await ctx.supabase
        .from('movimiento_cuenta')
        .select('tipo, importe, vence_en, creado_en')
        .eq('cuenta_corriente_id', cuentaId)
        .in('tipo', ['cargo', 'interes_mora', 'pago', 'ajuste']);

      const pendientes = saldosPendientesFifo(
        (movimientos ?? []).map((m) => ({
          tipo: m.tipo,
          importe: Number(m.importe),
          venceEn: m.vence_en,
          ocurridoEn: m.creado_en,
        })),
      );
      const masVencido = pendientes
        .filter((p) => new Date(`${p.venceEn}T00:00:00Z`) < comienzoDelDia(new Date()))
        .sort((a, b) => a.venceEn.localeCompare(b.venceEn))[0];

      const dias = masVencido ? diasDeAtraso(new Date(`${masVencido.venceEn}T00:00:00Z`), new Date()) : 0;

      return calcularMora({ base: Number(base ?? 0), tasaMensual: parametros.moraTasaMensual, dias });
    }),

  /** Aplicar el interés por mora propuesto (EI, RN-09): requiere confirmación explícita. */
  aplicarMora: procedimientoAdmin
    .input(
      z.object({
        clienteId: z.uuid(),
        base: z.number().positive(),
        tasaMensual: z.number().positive(),
        dias: z.int().positive(),
        importe: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cuentaId = await cuentaDeCliente(ctx.supabase, input.clienteId);
      const hoy = new Date().toISOString().slice(0, 10);
      const { error } = await ctx.supabase.from('movimiento_cuenta').insert({
        cuenta_corriente_id: cuentaId,
        tipo: 'interes_mora',
        concepto: `Interés por mora · ${input.dias} días sobre $${input.base.toLocaleString('es-AR')}`,
        importe: input.importe,
        // El interés vence el día en que se aplica: entra a la antigüedad de la
        // deuda como una obligación propia, no oculto detrás del cargo original.
        vence_en: hoy,
        mora_base: input.base,
        mora_tasa_aplicada: input.tasaMensual,
        mora_dias: input.dias,
        aplicado_por: ctx.sesion.usuarioId,
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /** Condonar un interés (EI): lo compensa con un ajuste, nunca lo borra. */
  condonarInteres: procedimientoAdmin
    .input(z.object({ movimientoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: original, error: errorOriginal } = await ctx.supabase
        .from('movimiento_cuenta')
        .select('cuenta_corriente_id, tipo, importe, creado_en')
        .eq('id', input.movimientoId)
        .single();

      if (errorOriginal || !original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese movimiento.' });
      }
      if (original.tipo !== 'interes_mora') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sólo se puede condonar un interés por mora.' });
      }

      const { error } = await ctx.supabase.from('movimiento_cuenta').insert({
        cuenta_corriente_id: original.cuenta_corriente_id,
        tipo: 'ajuste',
        concepto: `Condonación del interés del ${new Date(original.creado_en).toLocaleDateString('es-AR')}`,
        importe: -Number(original.importe),
        aplicado_por: ctx.sesion.usuarioId,
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /**
   * Informe de cargos sin comprobante (EO): sólo tiene sentido para quien pide
   * factura. "Sin comprobante" incluye el cargo que nunca se intentó Y el que
   * se intentó y ARCA rechazó (M6): un rechazo no es un comprobante válido,
   * así que el cargo sigue pendiente hasta que se reintente con éxito.
   */
  informeCargosSinComprobante: procedimiento.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('movimiento_cuenta')
      .select(
        'id, concepto, importe, periodo, creado_en, comprobante_id, comprobante:comprobante_id (estado), cuenta:cuenta_corriente_id (cliente:cliente_id (id, tipo, razon_social, requiere_factura, persona:persona_id (nombre, apellido)))',
      )
      .eq('tipo', 'cargo')
      .order('creado_en', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    return (data ?? []).filter(
      (m) => m.cuenta?.cliente?.requiere_factura && (!m.comprobante_id || m.comprobante?.estado === 'rechazado'),
    );
  }),
});
