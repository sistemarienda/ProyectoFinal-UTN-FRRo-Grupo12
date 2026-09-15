import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin } from '../trpc';
import { mensajeDeError } from '../errores';
import { notificarPorCodigo } from '../notificaciones';

/**
 * M15 · Eventos y torneos (Área 7).
 *
 * `evento` e `inscripcion_evento` ya estaban en el esquema desde las bases de
 * arquitectura, con su RLS (`evento_escritura`/`inscripcion_evento_escritura`,
 * ambas `es_admin()`): este router es la primera capa de aplicación que las
 * usa del lado del establecimiento. El portal (M13) ya tenía su propia
 * `inscribirEvento`, con la restricción de que el cliente sólo se anota a sí
 * mismo; acá el administrador puede anotar a cualquier familia —el caso de
 * quien reserva por teléfono— así que no comparten núcleo.
 *
 * El orden de estados no retrocede: `borrador` → `abierto` → `cerrado` →
 * `realizado`. Es la misma idea que ya usa `orden_compra` (M10) para no
 * volver de `anulada`.
 */

const ORDEN_ESTADO = ['borrador', 'abierto', 'cerrado', 'realizado'] as const;
type EstadoEvento = (typeof ORDEN_ESTADO)[number];

function transicionValida(actual: EstadoEvento, siguiente: EstadoEvento): boolean {
  return ORDEN_ESTADO.indexOf(siguiente) >= ORDEN_ESTADO.indexOf(actual);
}

export const routerEvento = crearRouter({
  /** Listado de eventos (EQ), con cuánto cupo está ocupado. */
  listar: procedimientoAdmin.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('evento')
      .select('id, nombre, tipo, inicia_en, finaliza_en, cierra_inscripcion_en, cupo, estado')
      .order('inicia_en', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    const eventos = data ?? [];
    const ocupaciones = await Promise.all(
      eventos.map((e) => ctx.supabase.rpc('ocupacion_evento', { p_evento: e.id })),
    );

    return eventos.map((e, i) => ({ ...e, ocupados: Number(ocupaciones[i]?.data ?? 0) }));
  }),

  /** Detalle de un evento con sus inscriptos (EQ). */
  detalle: procedimientoAdmin.input(z.object({ eventoId: z.uuid() })).query(async ({ ctx, input }) => {
    const { data: evento, error: errorEvento } = await ctx.supabase
      .from('evento')
      .select('id, nombre, tipo, inicia_en, finaliza_en, cierra_inscripcion_en, cupo, servicio_id, estado, servicio:servicio_id (nombre)')
      .eq('id', input.eventoId)
      .maybeSingle();

    if (errorEvento) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorEvento) });
    if (!evento) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese evento.' });

    const { data: inscripciones, error: errorInscripciones } = await ctx.supabase
      .from('inscripcion_evento')
      .select(
        'id, estado, cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido)), alumno:alumno_id (persona:persona_id (nombre, apellido)), caballo:caballo_id (nombre)',
      )
      .eq('evento_id', input.eventoId)
      .order('creado_en');

    if (errorInscripciones) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorInscripciones) });
    }

    return { evento, inscripciones: inscripciones ?? [] };
  }),

  /** Alta de un evento o torneo (EI). */
  crear: procedimientoAdmin
    .input(
      z.object({
        nombre: z.string().trim().min(2, 'Hace falta el nombre.'),
        tipo: z.enum(['torneo', 'exposicion', 'colonia', 'otro']),
        fechaInicio: z.iso.date(),
        horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hace falta la hora.'),
        fechaFin: z.iso.date().nullable().default(null),
        cierraInscripcionEn: z.iso.date().nullable().default(null),
        cupo: z.int().min(1).max(500).nullable().default(null),
        servicioId: z.uuid().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const iniciaEn = new Date(`${input.fechaInicio}T${input.horaInicio}:00`);
      const finalizaEn = input.fechaFin ? new Date(`${input.fechaFin}T23:59:59`) : null;
      if (finalizaEn && finalizaEn < iniciaEn) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La fecha de cierre no puede ser anterior al inicio.' });
      }

      const { data, error } = await ctx.supabase
        .from('evento')
        .insert({
          nombre: input.nombre,
          tipo: input.tipo,
          inicia_en: iniciaEn.toISOString(),
          finaliza_en: finalizaEn?.toISOString() ?? null,
          cierra_inscripcion_en: input.cierraInscripcionEn,
          cupo: input.cupo,
          servicio_id: input.servicioId,
        })
        .select('id')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { eventoId: data.id as string };
    }),

  /** Modificar un evento, incluido su estado (EI). */
  modificar: procedimientoAdmin
    .input(
      z.object({
        eventoId: z.uuid(),
        nombre: z.string().trim().min(2, 'Hace falta el nombre.'),
        tipo: z.enum(['torneo', 'exposicion', 'colonia', 'otro']),
        fechaInicio: z.iso.date(),
        horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hace falta la hora.'),
        fechaFin: z.iso.date().nullable(),
        cierraInscripcionEn: z.iso.date().nullable(),
        cupo: z.int().min(1).max(500).nullable(),
        servicioId: z.uuid().nullable(),
        estado: z.enum(ORDEN_ESTADO),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: actual, error: errorActual } = await ctx.supabase
        .from('evento')
        .select('estado')
        .eq('id', input.eventoId)
        .maybeSingle();

      if (errorActual) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorActual) });
      if (!actual) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese evento.' });
      if (!transicionValida(actual.estado, input.estado)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Un evento ${actual.estado} no puede volver a ${input.estado}.`,
        });
      }

      const iniciaEn = new Date(`${input.fechaInicio}T${input.horaInicio}:00`);
      const finalizaEn = input.fechaFin ? new Date(`${input.fechaFin}T23:59:59`) : null;
      if (finalizaEn && finalizaEn < iniciaEn) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La fecha de cierre no puede ser anterior al inicio.' });
      }

      const { error } = await ctx.supabase
        .from('evento')
        .update({
          nombre: input.nombre,
          tipo: input.tipo,
          inicia_en: iniciaEn.toISOString(),
          finaliza_en: finalizaEn?.toISOString() ?? null,
          cierra_inscripcion_en: input.cierraInscripcionEn,
          cupo: input.cupo,
          servicio_id: input.servicioId,
          estado: input.estado,
        })
        .eq('id', input.eventoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /** Inscribir a un alumno o un caballo de cualquier cliente (EI): la reserva por teléfono. */
  inscribir: procedimientoAdmin
    .input(
      z.object({
        eventoId: z.uuid(),
        clienteId: z.uuid(),
        alumnoId: z.uuid().nullable().default(null),
        caballoId: z.uuid().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.alumnoId && !input.caballoId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Hay que elegir a quién inscribir.' });
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
        const { data: ocupacion } = await ctx.supabase.rpc('ocupacion_evento', { p_evento: input.eventoId });
        if (Number(ocupacion ?? 0) >= evento.cupo) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Ya no hay cupo para este evento.' });
        }
      }

      const { error } = await ctx.supabase.from('inscripcion_evento').insert({
        evento_id: input.eventoId,
        cliente_id: input.clienteId,
        alumno_id: input.alumnoId,
        caballo_id: input.caballoId,
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /**
   * Enviar la invitación a un evento abierto (EO): a toda familia activa con
   * consentimiento vigente, no sólo a quien ya está anotado — es lo que
   * permite que alguien se entere y se anote. Se dispara a mano y no al abrir
   * el evento, porque el administrador puede querer preparar el evento antes
   * de avisarlo.
   */
  enviarInvitacion: procedimientoAdmin
    .input(z.object({ eventoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: evento, error: errorEvento } = await ctx.supabase
        .from('evento')
        .select('nombre, tipo, inicia_en, estado')
        .eq('id', input.eventoId)
        .maybeSingle();
      if (errorEvento) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorEvento) });
      if (!evento) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese evento.' });
      if (evento.estado !== 'abierto') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sólo se invita a un evento abierto a inscripción.' });
      }

      const { data: clientes, error: errorClientes } = await ctx.supabase
        .from('cliente')
        .select('id')
        .eq('activo', true);
      if (errorClientes) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorClientes) });

      const fecha = evento.inicia_en.slice(0, 10);
      const resultados = await Promise.all(
        (clientes ?? []).map((c) =>
          notificarPorCodigo({
            codigoPlantilla: 'aviso_evento',
            clienteId: c.id,
            valores: { evento: evento.nombre, fecha },
          }),
        ),
      );

      return {
        destinatarios: resultados.length,
        enviados: resultados.filter((r) => r.enviado).length,
      };
    }),
});
