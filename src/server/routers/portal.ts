import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { crearRouter, procedimientoDeArea } from '../trpc';
import { cuentaDeCliente } from './cuentaCorriente';
import { crearPreferenciaMercadoPago } from './pago';
import { cancelacionEnTermino, cupoDeClase } from '@/lib/agenda';
import { primerDiaDelMes } from '@/lib/cobranza';
import { antelacionMinimaDeCancelacion } from '../parametros-servidor';
import {
  cbteTipoWsfe,
  docTipoWsfe,
  urlQrArca,
  type TipoDocumento,
} from '@/lib/arca';
import type { Database } from '@/lib/supabase/tipos-generados';
import { mensajeDeError } from '../errores';

/**
 * M13 · Portal del cliente.
 *
 * Todo acá es lectura de lo que ya escriben M2 a M7, M9, M10 y M11, salvo tres
 * escrituras propias (`pagar`, `inscribirClase`/`cancelarClase` — que en
 * realidad viven en `inscripcion.ts`, ver su comentario — e `inscribirEvento`):
 * el sitemap (`02-sitemap-por-perfil.md`) lo declara sin entidades nuevas, igual
 * que M11. `clientes_del_usuario()` es la misma función SQL que ya usa RLS: no
 * se reimplementa el vínculo persona → cliente, se le pregunta a la base.
 *
 * **Un cliente, una cuenta.** La función de la base admite que una persona
 * tenga más de un `cliente` (persona física y, además, contacto de una persona
 * jurídica), pero ese caso no tiene pantalla propia en el diseño cerrado —el
 * portal es «Familia Gutiérrez», una sola cuenta—, así que acá se toma el
 * primer cliente vinculado y, si no hay ninguno, se corta con un mensaje
 * entendible en lugar de devolver listas vacías por todos lados.
 */

const procedimiento = procedimientoDeArea('portal');

type SupabaseCtx = SupabaseClient<Database>;

async function clientePropio(supabase: SupabaseCtx): Promise<string> {
  const { data, error } = await supabase.rpc('clientes_del_usuario');
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
  const clienteId = data?.[0];
  if (!clienteId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Tu usuario no está vinculado a ningún cliente: no hay nada que mostrar en el portal.',
    });
  }
  return clienteId;
}

async function alumnosPropios(supabase: SupabaseCtx, clienteId: string) {
  const { data, error } = await supabase
    .from('alumno')
    .select('id, nivel, persona:persona_id (nombre, apellido)')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('id');
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
  return (data ?? []).map((a) => ({
    id: a.id,
    nivel: a.nivel,
    nombre: [a.persona?.nombre, a.persona?.apellido].filter(Boolean).join(' '),
  }));
}

/** Cuántos alumnos activos hay inscriptos en cada clase (mismo criterio que `clase.ts`). */
async function inscriptosPorClase(supabase: SupabaseCtx, claseIds: readonly string[]) {
  if (claseIds.length === 0) return new Map<string, number>();
  const { data, error } = await supabase
    .from('inscripcion')
    .select('clase_id')
    .in('clase_id', [...claseIds])
    .eq('estado', 'inscripto');
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
  const conteo = new Map<string, number>();
  for (const i of data ?? []) conteo.set(i.clase_id, (conteo.get(i.clase_id) ?? 0) + 1);
  return conteo;
}

const CAMPOS_DE_CLASE =
  'id, inicia_en, estado, nivel, cupo, servicio:servicio_id (nombre, modalidad), instructor:instructor_id (persona:persona_id (nombre, apellido)), instalacion:instalacion_id (nombre)';

export const routerPortal = crearRouter({
  /** Los alumnos propios, para el filtro de la agenda y la inscripción a eventos. */
  misAlumnos: procedimiento.query(async ({ ctx }) => alumnosPropios(ctx.supabase, await clientePropio(ctx.supabase))),

  /**
   * Mi cuenta (EQ): saldo, estado de cuenta del mes en curso, la próxima clase
   * de cualquiera de los alumnos y la novedad más reciente para mostrar arriba
   * —un evento abierto si hay uno, si no la última novedad de un caballo propio.
   */
  cuenta: procedimiento.query(async ({ ctx }) => {
    const clienteId = await clientePropio(ctx.supabase);
    const cuentaId = await cuentaDeCliente(ctx.supabase, clienteId);
    const inicioDeMes = primerDiaDelMes(new Date());
    const ahora = new Date();

    const [{ data: cuenta }, { data: movimientos, error: errorMov }, alumnos, { data: caballos }] = await Promise.all([
      ctx.supabase.from('cuenta_corriente').select('saldo').eq('id', cuentaId).single(),
      ctx.supabase
        .from('movimiento_cuenta')
        .select('id, tipo, concepto, importe, creado_en')
        .eq('cuenta_corriente_id', cuentaId)
        .gte('creado_en', inicioDeMes.toISOString())
        .order('creado_en', { ascending: false }),
      alumnosPropios(ctx.supabase, clienteId),
      ctx.supabase.from('caballo').select('id').eq('propietario_id', clienteId).neq('estado', 'retirado'),
    ]);
    if (errorMov) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorMov) });

    let proximaClase: { inicia_en: string; servicio: string | null; instructor: string | null; instalacion: string | null; alumno: string } | null = null;
    if (alumnos.length > 0) {
      const { data: inscripciones } = await ctx.supabase
        .from('inscripcion')
        .select(`alumno_id, clase:clase_id (${CAMPOS_DE_CLASE})`)
        .in('alumno_id', alumnos.map((a) => a.id))
        .eq('estado', 'inscripto');

      const futuras = (inscripciones ?? [])
        .filter((i) => i.clase && i.clase.estado === 'programada' && new Date(i.clase.inicia_en) >= ahora)
        .sort((a, b) => a.clase!.inicia_en.localeCompare(b.clase!.inicia_en));

      const primera = futuras[0];
      if (primera?.clase) {
        proximaClase = {
          inicia_en: primera.clase.inicia_en,
          servicio: primera.clase.servicio?.nombre ?? null,
          instructor: [primera.clase.instructor?.persona?.nombre, primera.clase.instructor?.persona?.apellido].filter(Boolean).join(' ') || null,
          instalacion: primera.clase.instalacion?.nombre ?? null,
          alumno: alumnos.find((a) => a.id === primera.alumno_id)?.nombre ?? '',
        };
      }
    }

    // Novedad para destacar: un evento abierto primero, y si no hay, la última
    // novedad sanitaria de un caballo propio. El mismo orden que el wireframe.
    const { data: evento } = await ctx.supabase
      .from('evento')
      .select('id, nombre, inicia_en, cierra_inscripcion_en')
      .eq('estado', 'abierto')
      .order('inicia_en')
      .limit(1)
      .maybeSingle();

    let novedadCaballo: { caballo: string; tipo: string; fecha: string } | null = null;
    if (!evento && (caballos ?? []).length > 0) {
      const { data: ultimo } = await ctx.supabase
        .from('evento_sanitario')
        .select('tipo, fecha, caballo:caballo_id (nombre)')
        .in('caballo_id', (caballos ?? []).map((c) => c.id))
        .eq('estado', 'aplicado')
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultimo) novedadCaballo = { caballo: ultimo.caballo?.nombre ?? '', tipo: ultimo.tipo, fecha: ultimo.fecha };
    }

    return {
      saldo: Number(cuenta?.saldo ?? 0),
      movimientos: movimientos ?? [],
      periodo: inicioDeMes.toISOString().slice(0, 10),
      proximaClase,
      evento: evento ?? null,
      novedadCaballo,
    };
  }),

  /**
   * Agenda (EQ): las clases inscriptas de los alumnos propios, con si están o
   * no en término para cancelar (decisión 1.11, calculado acá para que la
   * pantalla pueda decir el plazo ANTES de que el cliente toque cancelar), más
   * las clases con cupo libre en las próximas tres semanas.
   */
  agenda: procedimiento
    .input(z.object({ alumnoId: z.uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const clienteId = await clientePropio(ctx.supabase);
      const alumnos = await alumnosPropios(ctx.supabase, clienteId);
      if (input.alumnoId && !alumnos.some((a) => a.id === input.alumnoId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Ese alumno no es tuyo.' });
      }
      const alumnoIds = input.alumnoId ? [input.alumnoId] : alumnos.map((a) => a.id);

      const diasMinimos = await antelacionMinimaDeCancelacion(ctx.supabase);
      const ahora = new Date();
      const hasta = new Date(ahora.getTime() + 21 * 24 * 60 * 60_000);

      const { data: inscripciones, error: errorInsc } = await ctx.supabase
        .from('inscripcion')
        .select(`id, alumno_id, clase:clase_id (${CAMPOS_DE_CLASE})`)
        .in('alumno_id', alumnoIds.length ? alumnoIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('estado', 'inscripto');
      if (errorInsc) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorInsc) });

      const propias = (inscripciones ?? [])
        .filter((i) => i.clase && i.clase.estado === 'programada' && new Date(i.clase.inicia_en) >= ahora)
        .map((i) => ({
          inscripcionId: i.id,
          alumnoId: i.alumno_id,
          alumno: alumnos.find((a) => a.id === i.alumno_id)?.nombre ?? '',
          clase: i.clase!,
          enTermino: cancelacionEnTermino(i.clase!.inicia_en, ahora, diasMinimos),
        }))
        .sort((a, b) => a.clase.inicia_en.localeCompare(b.clase.inicia_en));

      const { data: programadas, error: errorProg } = await ctx.supabase
        .from('clase')
        .select(CAMPOS_DE_CLASE)
        .eq('estado', 'programada')
        .gte('inicia_en', ahora.toISOString())
        .lt('inicia_en', hasta.toISOString())
        .order('inicia_en');
      if (errorProg) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorProg) });

      const inscriptos = await inscriptosPorClase(ctx.supabase, (programadas ?? []).map((c) => c.id));
      const yaAnotado = new Set(propias.map((p) => `${p.clase.id}:${p.alumnoId}`));

      const abiertas: { clase: (typeof programadas)[number]; alumnoId: string; alumno: string; nivelCoincide: boolean }[] = [];
      for (const clase of programadas ?? []) {
        const cupo = cupoDeClase(clase.servicio?.modalidad ?? null, clase.cupo, inscriptos.get(clase.id) ?? 0);
        if (cupo.completo) continue;
        for (const a of alumnos) {
          if (input.alumnoId && a.id !== input.alumnoId) continue;
          if (yaAnotado.has(`${clase.id}:${a.id}`)) continue;
          abiertas.push({ clase, alumnoId: a.id, alumno: a.nombre, nivelCoincide: clase.nivel != null && a.nivel === clase.nivel });
        }
      }
      abiertas.sort((a, b) => a.clase.inicia_en.localeCompare(b.clase.inicia_en));

      return { alumnos, diasMinimos, propias, abiertas };
    }),

  /** Mis caballos (EQ): ficha con novedades de cuidado, sin costos (04-wireframes.md § 7.2). */
  caballos: procedimiento.query(async ({ ctx }) => {
    const clienteId = await clientePropio(ctx.supabase);
    const { data: caballos, error } = await ctx.supabase
      .from('caballo')
      .select('id, nombre, estado, fecha_ingreso, instalacion:instalacion_id (nombre)')
      .eq('propietario_id', clienteId)
      .neq('estado', 'retirado')
      .order('nombre');
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    const ids = (caballos ?? []).map((c) => c.id);
    if (ids.length === 0) return [];

    const [{ data: sanitarios }, { data: planes }] = await Promise.all([
      ctx.supabase
        .from('evento_sanitario')
        .select('caballo_id, tipo, estado, fecha, proxima_fecha, observaciones')
        .in('caballo_id', ids)
        .order('fecha', { ascending: false }),
      ctx.supabase
        .from('plan_alimentario')
        .select('caballo_id, descripcion, vigente_desde')
        .in('caballo_id', ids)
        .order('vigente_desde', { ascending: false }),
    ]);

    return (caballos ?? []).map((c) => {
      const propios = (sanitarios ?? []).filter((s) => s.caballo_id === c.id);
      const aplicados = propios.filter((s) => s.estado === 'aplicado');

      const novedades = [
        ...aplicados.slice(0, 4).map((s) => ({ tipo: 'sanitario' as const, subtipo: s.tipo, fecha: s.fecha, detalle: s.observaciones })),
        ...(planes ?? [])
          .filter((p) => p.caballo_id === c.id)
          .slice(0, 2)
          .map((p) => ({ tipo: 'alimentacion' as const, subtipo: null, fecha: p.vigente_desde, detalle: p.descripcion })),
      ]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 5);

      // `en_tratamiento` es el único estado del caballo que amerita una alerta
      // (no hay un tipo `reposo` en `evento_sanitario`): se explica con el
      // último evento sanitario, que es donde vive el motivo.
      const ultimoSanitario = propios[0] ?? null;

      return { ...c, novedades, alerta: c.estado === 'en_tratamiento' ? ultimoSanitario : null };
    });
  }),

  /**
   * Novedades y avisos (EQ): lo que se le envió (M5) y el evento abierto con
   * cupo, si hay uno.
   */
  avisos: procedimiento.query(async ({ ctx }) => {
    const clienteId = await clientePropio(ctx.supabase);

    const [{ data: mensajes, error: errorMsj }, { data: eventos, error: errorEv }, alumnos, { data: caballos }] =
      await Promise.all([
        ctx.supabase
          .from('mensaje')
          .select('id, canal, destino, estado, error, enviado_en, creado_en, plantilla:plantilla_id (codigo)')
          .eq('cliente_id', clienteId)
          .order('creado_en', { ascending: false })
          .limit(30),
        ctx.supabase
          .from('evento')
          .select('id, nombre, tipo, inicia_en, finaliza_en, cierra_inscripcion_en, cupo')
          .eq('estado', 'abierto')
          .order('inicia_en'),
        alumnosPropios(ctx.supabase, clienteId),
        ctx.supabase.from('caballo').select('id, nombre').eq('propietario_id', clienteId).neq('estado', 'retirado'),
      ]);
    if (errorMsj) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorMsj) });
    if (errorEv) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorEv) });

    const eventoIds = (eventos ?? []).map((e) => e.id);
    const [{ data: todas }, { data: mias }] = await Promise.all([
      eventoIds.length
        ? ctx.supabase.from('inscripcion_evento').select('evento_id').in('evento_id', eventoIds).eq('estado', 'inscripto')
        : Promise.resolve({ data: [] as { evento_id: string }[] }),
      eventoIds.length
        ? ctx.supabase
            .from('inscripcion_evento')
            .select('evento_id, alumno_id, caballo_id')
            .eq('cliente_id', clienteId)
            .eq('estado', 'inscripto')
        : Promise.resolve({ data: [] as { evento_id: string; alumno_id: string | null; caballo_id: string | null }[] }),
    ]);

    const ocupados = new Map<string, number>();
    for (const i of todas ?? []) ocupados.set(i.evento_id, (ocupados.get(i.evento_id) ?? 0) + 1);

    return {
      mensajes: mensajes ?? [],
      alumnos,
      caballos: caballos ?? [],
      eventos: (eventos ?? []).map((e) => ({
        ...e,
        inscriptos: ocupados.get(e.id) ?? 0,
        misInscripciones: (mias ?? []).filter((i) => i.evento_id === e.id),
      })),
    };
  }),

  /** Inscribir a un alumno o un caballo propio a un evento abierto (EI). */
  inscribirEvento: procedimiento
    .input(
      z.object({
        eventoId: z.uuid(),
        alumnoId: z.uuid().nullable().default(null),
        caballoId: z.uuid().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.alumnoId && !input.caballoId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Hay que elegir a quién inscribir.' });
      }
      const clienteId = await clientePropio(ctx.supabase);

      if (input.alumnoId) {
        const { data: alumno } = await ctx.supabase.from('alumno').select('cliente_id').eq('id', input.alumnoId).maybeSingle();
        if (alumno?.cliente_id !== clienteId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Ese alumno no es tuyo.' });
      }
      if (input.caballoId) {
        const { data: caballo } = await ctx.supabase.from('caballo').select('propietario_id').eq('id', input.caballoId).maybeSingle();
        if (caballo?.propietario_id !== clienteId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Ese caballo no es tuyo.' });
      }

      const { data: evento, error: errorEvento } = await ctx.supabase
        .from('evento')
        .select('id, estado, cupo, cierra_inscripcion_en')
        .eq('id', input.eventoId)
        .maybeSingle();
      if (errorEvento) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorEvento) });
      if (!evento) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese evento.' });
      if (evento.estado !== 'abierto') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ese evento no está abierto a inscripción.' });
      }
      if (evento.cierra_inscripcion_en && evento.cierra_inscripcion_en < new Date().toISOString().slice(0, 10)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Se cerró el plazo de inscripción de este evento.' });
      }

      const columna = input.alumnoId ? 'alumno_id' : 'caballo_id';
      const valor = input.alumnoId ?? input.caballoId!;
      const { data: previa } = await ctx.supabase
        .from('inscripcion_evento')
        .select('id')
        .eq('evento_id', input.eventoId)
        .eq(columna, valor)
        .eq('estado', 'inscripto')
        .maybeSingle();
      if (previa) throw new TRPCError({ code: 'CONFLICT', message: 'Ya está inscripto en este evento.' });

      if (evento.cupo != null) {
        const { count } = await ctx.supabase
          .from('inscripcion_evento')
          .select('id', { count: 'exact', head: true })
          .eq('evento_id', input.eventoId)
          .eq('estado', 'inscripto');
        if ((count ?? 0) >= evento.cupo) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Ya no hay cupo para este evento.' });
        }
      }

      const { error } = await ctx.supabase.from('inscripcion_evento').insert({
        evento_id: input.eventoId,
        cliente_id: clienteId,
        alumno_id: input.alumnoId,
        caballo_id: input.caballoId,
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /**
   * Generar el enlace de pago del propio saldo (EI).
   *
   * Sin `importe`: paga el saldo entero. Nunca se acepta un cliente arbitrario
   * ni un importe mayor al que debe —`clienteId` sale de la sesión, no del
   * input— y la política `pago_del_cliente` (0007) exige además que el pago
   * nazca `pendiente` y por `mercadopago`: acreditarlo sigue siendo cosa del
   * administrador o del webhook real.
   */
  pagar: procedimiento
    .input(z.object({ importe: z.number().positive('El importe tiene que ser mayor a cero.').optional() }))
    .mutation(async ({ ctx, input }) => {
      const clienteId = await clientePropio(ctx.supabase);
      const cuentaId = await cuentaDeCliente(ctx.supabase, clienteId);
      const { data: cuenta } = await ctx.supabase.from('cuenta_corriente').select('saldo').eq('id', cuentaId).single();
      const saldo = Number(cuenta?.saldo ?? 0);

      const importe = input.importe ?? saldo;
      if (importe <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No hay saldo pendiente: no hace falta pagar nada.' });
      }
      if (importe > saldo) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'El importe no puede superar el saldo de la cuenta.' });
      }

      const periodo = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      return crearPreferenciaMercadoPago(ctx.supabase, {
        clienteId,
        importe,
        concepto: `Cuenta corriente · ${periodo}`,
      });
    }),

  comprobantes: procedimiento.query(async ({ ctx }) => {
    const clienteId = await clientePropio(ctx.supabase);
    const { data: persona } = await ctx.supabase
      .from('persona')
      .select('tipo_documento, numero_documento')
      .eq('id', ctx.sesion.personaId)
      .maybeSingle();

    const { data, error } = await ctx.supabase
      .from('comprobante')
      .select('id, tipo, numero, fecha_emision, estado, total, cae, emisor_cuit, punto_venta:punto_venta_id (numero)')
      .eq('cliente_id', clienteId)
      .order('fecha_emision', { ascending: false });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    return (data ?? []).map((c) => ({
      ...c,
      urlQr:
        c.estado === 'autorizado' && c.cae && persona
          ? urlQrArca({
              fecha: c.fecha_emision,
              cuit: Number(c.emisor_cuit),
              ptoVta: c.punto_venta!.numero,
              tipoCmp: cbteTipoWsfe(c.tipo as never),
              nroCmp: c.numero,
              importe: Number(c.total),
              tipoDocRec: docTipoWsfe(persona.tipo_documento as TipoDocumento),
              nroDocRec: Number(persona.numero_documento),
              cae: c.cae,
            })
          : null,
    }));
  }),
});
