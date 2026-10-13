import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { nombreDeCliente } from './cuentaCorriente';
import { arcaCliente } from '../arca-servidor';
import {
  cbteTipoWsfe,
  condicionIvaReceptorId,
  docTipoWsfe,
  fechaWsfe,
  identidadFiscalVigenteEn,
  tipoComprobanteDesde,
  urlQrArca,
  type CondicionIvaReceptor,
  type TipoDocumento,
} from '@/lib/arca';
import type { Database } from '@/lib/supabase/tipos-generados';
import { partesLocales } from '@/lib/agenda';
import { mensajeDeError } from '../errores';

/**
 * M6 · Facturación electrónica.
 *
 * Emitir un comprobante siempre parte de cargos concretos (M3): nunca se
 * inventa un importe. El tipo de comprobante y el `CondicionIVAReceptorId` se
 * derivan (RN-02), nunca se eligen; el emisor se copia entero al momento de
 * emitir (RN-04), así que un comprobante viejo se reimprime igual aunque la
 * identidad fiscal haya cambiado después.
 *
 * **Un cargo queda "vinculado" a un comprobante en cualquier intento, no sólo
 * cuando ARCA lo autoriza.** Es lo que hace posible `reintentar`: el cargo de
 * un comprobante rechazado sigue contando como "sin comprobante" (ver
 * `cuentaCorriente.informeCargosSinComprobante`) hasta que un intento nuevo
 * lo autorice, y ese intento nuevo sabe qué cargos repetir porque siguen
 * apuntando al intento fallido.
 */
const procedimiento = procedimientoDeArea('gerencia');

type SupabaseCtx = SupabaseClient<Database>;

async function identidadFiscalVigenteOFallar(supabase: SupabaseCtx) {
  const { data, error } = await supabase
    .from('identidad_fiscal')
    .select('id, razon_social, cuit, condicion_iva, vigente_desde, domicilio_fiscal, ingresos_brutos, inicio_actividades');
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

  const vigente = identidadFiscalVigenteEn(
    (data ?? []).map((i) => ({
      id: i.id,
      razonSocial: i.razon_social,
      cuit: i.cuit,
      condicionIva: i.condicion_iva,
      vigenteDesde: i.vigente_desde,
      domicilioFiscal: i.domicilio_fiscal,
      ingresosBrutos: i.ingresos_brutos,
      inicioActividades: i.inicio_actividades,
    })),
  );
  if (!vigente) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'No hay una identidad fiscal vigente cargada. Dala de alta en Configuración antes de emitir.',
    });
  }
  return vigente;
}

async function puntoVentaOFallar(supabase: SupabaseCtx, puntoVentaId: string) {
  const { data, error } = await supabase
    .from('punto_venta')
    .select('id, numero, modo, activo')
    .eq('id', puntoVentaId)
    .single();
  if (error || !data) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese punto de venta.' });
  if (!data.activo) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ese punto de venta está inactivo.' });
  if (data.modo !== 'web_service') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'RN-03: el sistema sólo emite por el punto de venta de web service, no por el que se usa a mano.',
    });
  }
  return data;
}

interface ClienteParaFacturar {
  id: string;
  tipo: string;
  razon_social: string | null;
  requiere_factura: boolean;
  condicion_iva: string | null;
  cuit: string | null;
  persona: { nombre: string; apellido: string; tipo_documento: string; numero_documento: string } | null;
}

interface CargoPendiente {
  id: string;
  importe: number;
  periodo: string | null;
  vence_en: string | null;
  cuenta: { cliente: ClienteParaFacturar | null } | null;
}

const SELECT_CARGO_PARA_FACTURAR =
  'id, importe, periodo, vence_en, comprobante_id, comprobante:comprobante_id (estado), cuenta:cuenta_corriente_id (cliente:cliente_id (id, tipo, razon_social, requiere_factura, condicion_iva, cuit, persona:persona_id (nombre, apellido, tipo_documento, numero_documento)))' as const;

/** "Sin comprobante" es sin comprobante autorizado: uno rechazado no cuenta. */
function sinComprobanteAutorizado(m: { comprobante_id: string | null; comprobante: { estado: string } | null }) {
  return !m.comprobante_id || m.comprobante?.estado === 'rechazado';
}

/**
 * El núcleo de la emisión, compartido por `emitir`, `emitirLote` y
 * `reintentar`: dados los cargos de un cliente, llama a WSFEv1 y guarda el
 * resultado, autorizado o rechazado. Vincula los cargos al comprobante en los
 * dos casos, para que un rechazo se pueda reintentar más tarde.
 */
async function emitirParaCliente(
  ctx: { supabase: SupabaseCtx },
  cargos: CargoPendiente[],
  puntoVenta: { id: string; numero: number },
) {
  const cliente = cargos[0]!.cuenta!.cliente!;
  if (!cliente.requiere_factura) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `${nombreDeCliente(cliente)} no pide factura (RN-05).` });
  }
  if (!cliente.condicion_iva) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Falta cargar la condición de IVA de ${nombreDeCliente(cliente)} para poder facturarle.`,
    });
  }

  const identidad = await identidadFiscalVigenteOFallar(ctx.supabase);
  const total = cargos.reduce((acc, c) => acc + Number(c.importe), 0);
  const periodos = cargos.map((c) => c.periodo).filter((p): p is string => Boolean(p)).sort();
  const vencimientos = cargos.map((c) => c.vence_en).filter((v): v is string => Boolean(v)).sort();

  // La fecha del comprobante es la del haras, no la del servidor: de 21 a 24 h
  // en Argentina, UTC ya va por el día siguiente.
  const hoyIso = partesLocales(new Date()).fecha;
  const hoy = new Date(`${hoyIso}T00:00:00Z`);

  // El servicio va del primer día del primer período al último día del último.
  const ultimoPeriodo = new Date(periodos.at(-1) ?? hoyIso);
  const finDelServicio = new Date(Date.UTC(ultimoPeriodo.getUTCFullYear(), ultimoPeriodo.getUTCMonth() + 1, 0));

  // ARCA rechaza un vencimiento de pago anterior a la fecha del comprobante
  // (error 10036), que es justo lo que pasa al facturar deuda ya vencida: en
  // ese caso el pago vence el día de la emisión.
  const ultimoVencimiento = vencimientos.at(-1);
  const vencimientoDePago = ultimoVencimiento && ultimoVencimiento > hoyIso ? new Date(ultimoVencimiento) : hoy;

  const tipo = tipoComprobanteDesde(identidad.condicionIva, cliente.condicion_iva as CondicionIvaReceptor);
  const esPersonaJuridica = cliente.tipo === 'persona_juridica';
  const docTipo = esPersonaJuridica ? docTipoWsfe('cuit') : docTipoWsfe(cliente.persona!.tipo_documento as TipoDocumento);
  const docNro = Number(esPersonaJuridica ? cliente.cuit : cliente.persona!.numero_documento);

  const arca = arcaCliente();
  const resultado = await arca.electronicBillingService.createNextVoucher({
    CantReg: 1,
    PtoVta: puntoVenta.numero,
    CbteTipo: cbteTipoWsfe(tipo),
    Concepto: 2, // Servicios: pensiones y clases se facturan por período, no por bien
    DocTipo: docTipo,
    DocNro: docNro,
    CbteFch: fechaWsfe(hoy),
    FchServDesde: fechaWsfe(new Date(periodos[0] ?? hoy.toISOString())),
    FchServHasta: fechaWsfe(finDelServicio),
    FchVtoPago: fechaWsfe(vencimientoDePago),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total, // RN-02: hoy sólo se emite C (monotributo/exento), sin discriminar IVA
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: condicionIvaReceptorId(cliente.condicion_iva as CondicionIvaReceptor),
  });

  const detalle = resultado.response.FeDetResp?.FECAEDetResponse?.[0];
  const numero = detalle?.CbteDesde;
  if (!numero) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'ARCA no devolvió un número de comprobante. Respuesta: ' + JSON.stringify(resultado.response),
    });
  }

  const autorizado = detalle.Resultado === 'A';
  const observaciones = detalle.Observaciones?.Obs?.map((o) => `${o.Code}: ${o.Msg}`).join(' · ') || null;

  const { data: comprobante, error } = await ctx.supabase
    .from('comprobante')
    .insert({
      cliente_id: cliente.id,
      tipo,
      punto_venta_id: puntoVenta.id,
      numero,
      fecha_emision: hoyIso,
      cae: autorizado ? resultado.cae : null,
      cae_vencimiento: autorizado
        ? `${resultado.caeFchVto.slice(0, 4)}-${resultado.caeFchVto.slice(4, 6)}-${resultado.caeFchVto.slice(6, 8)}`
        : null,
      estado: autorizado ? 'autorizado' : 'rechazado',
      rechazo_motivo: autorizado ? null : (observaciones ?? 'ARCA rechazó el comprobante sin detalle.'),
      emisor_razon_social: identidad.razonSocial,
      emisor_cuit: identidad.cuit,
      emisor_condicion_iva: identidad.condicionIva,
      receptor_condicion_iva: cliente.condicion_iva as CondicionIvaReceptor,
      neto: total,
      iva: 0,
      total,
    })
    .select('id')
    .single();
  if (error || !comprobante) {
    // El peor caso de R-06: ARCA ya autorizó y RIENDA no lo registró. El
    // comprobante existe y es válido; lo que no puede perderse es con qué
    // número y CAE, para conciliarlo a mano.
    if (autorizado) {
      console.error('comprobante: ARCA autorizó y no se pudo guardar', {
        ptoVta: puntoVenta.numero, numero, cae: resultado.cae, cliente: cliente.id, error,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          `ARCA autorizó el comprobante ${String(puntoVenta.numero).padStart(4, '0')}-${String(numero).padStart(8, '0')} ` +
          `(CAE ${resultado.cae}), pero no se pudo registrar en RIENDA: ${mensajeDeError(error)} No lo vuelvas a emitir; hay que conciliarlo.`,
      });
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message ?? 'No se pudo guardar el comprobante.' });
  }

  // Se vincula en los dos casos: un rechazo también "consume" el intento, y es
  // lo que le permite a `reintentar` encontrar estos mismos cargos después.
  const { error: errorVincular } = await ctx.supabase
    .from('movimiento_cuenta')
    .update({ comprobante_id: comprobante.id })
    .in(
      'id',
      cargos.map((c) => c.id),
    );
  if (errorVincular) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorVincular) });

  return {
    comprobanteId: comprobante.id as string,
    estado: autorizado ? ('autorizado' as const) : ('rechazado' as const),
    cae: autorizado ? resultado.cae : null,
    observaciones,
  };
}

export const routerComprobante = crearRouter({
  /** Cargos sin comprobante autorizado de un cliente puntual (EQ, insumo de `emitir`). */
  cargosSinComprobanteDeCliente: procedimiento
    .input(z.object({ clienteId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('movimiento_cuenta')
        .select('id, concepto, importe, periodo, vence_en, comprobante_id, comprobante:comprobante_id (estado), cuenta:cuenta_corriente_id (cliente:cliente_id (id))')
        .eq('tipo', 'cargo')
        .order('periodo', { ascending: true });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      return (data ?? []).filter((m) => m.cuenta?.cliente?.id === input.clienteId && sinComprobanteAutorizado(m));
    }),

  /** Emitir un comprobante para un cliente, cubriendo los cargos elegidos (EI). */
  emitir: procedimientoAdmin
    .input(z.object({ clienteId: z.uuid(), movimientoIds: z.array(z.uuid()).min(1), puntoVentaId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const puntoVenta = await puntoVentaOFallar(ctx.supabase, input.puntoVentaId);

      const { data: cargos, error } = await ctx.supabase
        .from('movimiento_cuenta')
        .select(SELECT_CARGO_PARA_FACTURAR)
        .in('id', input.movimientoIds)
        .eq('tipo', 'cargo');
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      if (!cargos || cargos.length !== input.movimientoIds.length || !cargos.every(sinComprobanteAutorizado)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Alguno de los cargos ya tiene comprobante autorizado o no existe.' });
      }
      const clientesDistintos = new Set(cargos.map((c) => c.cuenta?.cliente?.id));
      if (clientesDistintos.size !== 1 || !clientesDistintos.has(input.clienteId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Todos los cargos tienen que ser del mismo cliente.' });
      }

      return emitirParaCliente(ctx, cargos as CargoPendiente[], puntoVenta);
    }),

  /** Emitir el lote del período (EI): un comprobante por cliente con cargos pendientes. */
  emitirLote: procedimientoAdmin
    .input(z.object({ puntoVentaId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const puntoVenta = await puntoVentaOFallar(ctx.supabase, input.puntoVentaId);

      const { data, error } = await ctx.supabase
        .from('movimiento_cuenta')
        .select(SELECT_CARGO_PARA_FACTURAR)
        .eq('tipo', 'cargo');
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const pendientes = (data ?? []).filter(
        (m) => m.cuenta?.cliente?.requiere_factura && sinComprobanteAutorizado(m),
      ) as CargoPendiente[];

      const porCliente = new Map<string, CargoPendiente[]>();
      for (const cargo of pendientes) {
        const clienteId = cargo.cuenta!.cliente!.id;
        porCliente.set(clienteId, [...(porCliente.get(clienteId) ?? []), cargo]);
      }

      const resultados: { clienteId: string; cliente: string; estado: 'autorizado' | 'rechazado'; motivo?: string }[] = [];
      for (const [clienteId, cargos] of porCliente) {
        const cliente = nombreDeCliente(cargos[0]!.cuenta!.cliente!);
        try {
          const r = await emitirParaCliente(ctx, cargos, puntoVenta);
          resultados.push({ clienteId, cliente, estado: r.estado, motivo: r.observaciones ?? undefined });
        } catch (e) {
          // Un error que no llega a guardar el comprobante no aparece en la
          // tabla: sin el log y el motivo en pantalla, el rechazo era invisible.
          console.error('comprobante.emitirLote:', cliente, e);
          resultados.push({
            clienteId,
            cliente,
            estado: 'rechazado',
            motivo: e instanceof TRPCError ? e.message : e instanceof Error ? e.message : 'Error inesperado.',
          });
        }
      }
      return { emitidos: resultados.filter((r) => r.estado === 'autorizado').length, resultados };
    }),

  /** Reintentar un comprobante rechazado (EI): mismos cargos, número nuevo. */
  reintentar: procedimientoAdmin
    .input(z.object({ comprobanteId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: original, error } = await ctx.supabase
        .from('comprobante')
        .select('id, estado, punto_venta:punto_venta_id (id, numero)')
        .eq('id', input.comprobanteId)
        .single();
      if (error || !original) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese comprobante.' });
      if (original.estado !== 'rechazado') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sólo se reintenta un comprobante rechazado.' });
      }

      const { data: cargos, error: errorCargos } = await ctx.supabase
        .from('movimiento_cuenta')
        .select(SELECT_CARGO_PARA_FACTURAR)
        .eq('comprobante_id', input.comprobanteId);
      if (errorCargos) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorCargos) });
      if (!cargos || cargos.length === 0) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'El comprobante rechazado no tiene cargos asociados.' });
      }

      return emitirParaCliente(ctx, cargos as CargoPendiente[], original.punto_venta!);
    }),

  /** Comprobantes emitidos en el período (EQ). */
  listarDelPeriodo: procedimiento
    .input(z.object({ desde: z.iso.date(), hasta: z.iso.date() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('comprobante')
        .select(
          'id, tipo, numero, fecha_emision, cae, estado, rechazo_motivo, total, punto_venta:punto_venta_id (numero), cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))',
        )
        .gte('fecha_emision', input.desde)
        .lte('fecha_emision', input.hasta)
        .order('fecha_emision', { ascending: false });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      return (data ?? []).map((c) => ({ ...c, nombreCliente: c.cliente ? nombreDeCliente(c.cliente) : '—' }));
    }),

  /** Detalle de un comprobante (EQ), con la URL del QR de la RG 4.892. */
  detalle: procedimiento.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const { data: c, error } = await ctx.supabase
      .from('comprobante')
      .select(
        'id, tipo, numero, fecha_emision, cae, cae_vencimiento, estado, rechazo_motivo, emisor_razon_social, emisor_cuit, emisor_condicion_iva, receptor_condicion_iva, neto, iva, total, punto_venta:punto_venta_id (numero), cliente:cliente_id (id, tipo, razon_social, cuit, persona:persona_id (nombre, apellido, tipo_documento, numero_documento))',
      )
      .eq('id', input.id)
      .single();
    if (error || !c) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese comprobante.' });

    const esPersonaJuridica = c.cliente?.tipo === 'persona_juridica';
    const docTipo = esPersonaJuridica
      ? docTipoWsfe('cuit')
      : docTipoWsfe((c.cliente?.persona?.tipo_documento ?? 'dni') as TipoDocumento);
    const docNro = Number(esPersonaJuridica ? c.cliente?.cuit : c.cliente?.persona?.numero_documento) || 0;

    return {
      ...c,
      nombreCliente: c.cliente ? nombreDeCliente(c.cliente) : '—',
      urlQr:
        c.estado === 'autorizado' && c.cae
          ? urlQrArca({
              fecha: c.fecha_emision,
              cuit: Number(c.emisor_cuit),
              ptoVta: c.punto_venta!.numero,
              tipoCmp: cbteTipoWsfe(c.tipo as never),
              nroCmp: c.numero,
              importe: Number(c.total),
              tipoDocRec: docTipo,
              nroDocRec: docNro,
              cae: c.cae,
            })
          : null,
    };
  }),

  /** Reporte de comprobantes emitidos (EO): totales por estado. */
  reporteDelPeriodo: procedimiento
    .input(z.object({ desde: z.iso.date(), hasta: z.iso.date() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('comprobante')
        .select('tipo, estado, total')
        .gte('fecha_emision', input.desde)
        .lte('fecha_emision', input.hasta);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const porEstado: Record<string, number> = {};
      let totalAutorizado = 0;
      for (const c of data ?? []) {
        porEstado[c.estado] = (porEstado[c.estado] ?? 0) + 1;
        if (c.estado === 'autorizado') totalAutorizado += Number(c.total);
      }
      return { cantidad: (data ?? []).length, porEstado, totalAutorizado };
    }),

  /** Estado del servidor de ARCA (FEDummy), para el diagnóstico de la pantalla. */
  estadoDeArca: procedimientoAdmin.query(async () => {
    try {
      return { ok: true as const, estado: await arcaCliente().electronicBillingService.getServerStatus() };
    } catch (e) {
      return { ok: false as const, motivo: e instanceof TRPCError ? e.message : 'No se pudo contactar a ARCA.' };
    }
  }),
});
