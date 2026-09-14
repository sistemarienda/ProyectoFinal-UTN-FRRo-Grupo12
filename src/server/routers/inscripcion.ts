import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/lib/supabase/tipos-generados';
import { crearRouter, procedimientoDeArea } from '../trpc';
import { cancelacionEnTermino, cupoDeClase } from '@/lib/agenda';
import { antelacionMinimaDeCancelacion } from '../parametros-servidor';
import { mensajeDeError } from '../errores';

/**
 * M7 · Inscripciones a una clase.
 *
 * Router propio y no parte de `clase` porque son operaciones de distinto sujeto:
 * la clase la programa el establecimiento, la inscripción la protagoniza el
 * alumno. `inscribir`/`cancelar` las usa el personal (`ensenanza`);
 * `inscribirPropio`/`cancelarPropio` son las mismas dos reglas para el propio
 * cliente desde el portal (M13), sólo que primero verifican que el alumno sea
 * suyo —la política `inscripcion_del_cliente` ya lo exige otra vez del lado de
 * la base— y no aceptan `caballoId`: el caballo previsto lo decide el
 * establecimiento al programar, no el cliente al anotarse.
 *
 * Dos reglas que valen la pena leer juntas, porque parecen la misma y no lo son:
 *
 *   * **El cupo completo sí frena** la inscripción (CUS05, camino 4.a). Es un
 *     límite físico: la pista y el instructor no dan para más.
 *   * **La falta de contrato vigente no frena**: advierte (camino 4.b). Es un
 *     asunto comercial, y el instructor no es quien lo resuelve. Lo que no puede
 *     pasar es que se dicte la clase y después nadie sepa que no tenía respaldo.
 */

const procedimiento = procedimientoDeArea('ensenanza');
const procedimientoPortal = procedimientoDeArea('portal');

type SupabaseCtx = SupabaseClient<Database>;

async function alumnoEsPropio(supabase: SupabaseCtx, alumnoId: string): Promise<boolean> {
  const { data: clientes } = await supabase.rpc('clientes_del_usuario');
  const { data: alumno } = await supabase.from('alumno').select('cliente_id').eq('id', alumnoId).maybeSingle();
  return !!alumno && (clientes ?? []).includes(alumno.cliente_id);
}

async function inscribirNucleo(
  ctx: { supabase: SupabaseCtx },
  input: { claseId: string; alumnoId: string; caballoId: string | null },
) {
  const { data: clase, error: errorClase } = await ctx.supabase
    .from('clase')
    .select('id, estado, cupo, servicio:servicio_id (id, nombre, modalidad)')
    .eq('id', input.claseId)
    .maybeSingle();

  if (errorClase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorClase) });
  if (!clase) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa clase.' });
  if (clase.estado === 'cancelada') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'La clase está suspendida: no admite inscripciones.' });
  }
  if (clase.estado === 'dictada') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'La clase ya se dictó: no admite inscripciones.' });
  }

  const { data: anotados, error: errorAnotados } = await ctx.supabase
    .from('inscripcion')
    .select('id, alumno_id, estado')
    .eq('clase_id', input.claseId);

  if (errorAnotados) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorAnotados) });

  // El cupo se controla contra el total real, no contra `anotados`:
  // `inscripcion_lectura` sólo deja ver al cliente las filas de su propia
  // familia, así que contar sobre lo visible dejaría pasar cupo que no
  // existe cuando quien llama es el portal (M13). `anotados` sigue siendo
  // la fuente correcta para "¿este alumno ya está anotado?" y para
  // reactivar una cancelación propia: eso sí es correcto por RLS en los dos
  // roles que llaman a esta función.
  const activos = (anotados ?? []).filter((i) => i.estado === 'inscripto');
  const { data: totalInscriptos } = await ctx.supabase.rpc('inscriptos_de_clase', { p_clase: input.claseId });
  const cupo = cupoDeClase(clase.servicio?.modalidad ?? null, clase.cupo, Number(totalInscriptos ?? activos.length));

  if (activos.some((i) => i.alumno_id === input.alumnoId)) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Ese alumno ya está inscripto en esta clase.' });
  }
  if (cupo.completo) {
    throw new TRPCError({
      code: 'CONFLICT',
      message:
        clase.servicio?.modalidad === 'individual'
          ? 'Es una clase individual y ya tiene su alumno.'
          : `La clase está completa: ${cupo.ocupados} de ${cupo.limite}.`,
    });
  }

  // CUS05 camino 4.b: se advierte, no se impide. La respuesta la da una
  // función de la base, porque el instructor no puede leer los contratos.
  const { data: respaldado } = await ctx.supabase.rpc('tiene_contrato_vigente', {
    p_alumno: input.alumnoId,
    p_servicio: clase.servicio?.id ?? '',
  });

  // Una inscripción cancelada se reactiva en lugar de duplicarse: la base
  // tiene `inscripcion_unica (clase_id, alumno_id)`, así que un alumno que
  // se dio de baja y se vuelve a anotar no puede entrar como fila nueva.
  const previa = (anotados ?? []).find((i) => i.alumno_id === input.alumnoId);

  const { error } = previa
    ? await ctx.supabase
        .from('inscripcion')
        .update({
          estado: 'inscripto',
          cancelado_en: null,
          caballo_id: input.caballoId,
          inscripto_en: new Date().toISOString(),
        })
        .eq('id', previa.id)
    : await ctx.supabase.from('inscripcion').insert({
        clase_id: input.claseId,
        alumno_id: input.alumnoId,
        caballo_id: input.caballoId,
      });

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

  return {
    ok: true as const,
    /** Falso: la clase se va a dictar sin contrato que la respalde. */
    conContratoVigente: respaldado === true,
  };
}

/**
 * `cancelado_en` es lo que después permite evaluar la antelación contra
 * `cancelacion_clase_dias` (decisión 1.11). La cancelación fuera de término se
 * registra igual y se informa: si el sistema la rechazara, el alumno faltaría
 * sin avisar y el establecimiento perdería el dato, que es peor.
 */
async function cancelarNucleo(ctx: { supabase: SupabaseCtx }, input: { inscripcionId: string }) {
  const { data: inscripcion, error: errorInscripcion } = await ctx.supabase
    .from('inscripcion')
    .select('id, estado, clase:clase_id (inicia_en, estado)')
    .eq('id', input.inscripcionId)
    .maybeSingle();

  if (errorInscripcion) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorInscripcion) });
  }
  if (!inscripcion) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa inscripción.' });
  if (inscripcion.estado === 'cancelado') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esa inscripción ya estaba cancelada.' });
  }
  if (inscripcion.clase?.estado === 'dictada') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'La clase ya se dictó: la ausencia se registra en la asistencia, no cancelando la inscripción.',
    });
  }

  const diasMinimos = await antelacionMinimaDeCancelacion(ctx.supabase);
  const ahora = new Date();
  const enTermino = inscripcion.clase
    ? cancelacionEnTermino(inscripcion.clase.inicia_en, ahora, diasMinimos)
    : true;

  const { error } = await ctx.supabase
    .from('inscripcion')
    .update({ estado: 'cancelado', cancelado_en: ahora.toISOString() })
    .eq('id', input.inscripcionId);

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

  return { ok: true as const, enTermino, diasMinimos };
}

export const routerInscripcion = crearRouter({
  /** Inscribir un alumno en una clase (EI). */
  inscribir: procedimiento
    .input(
      z.object({
        claseId: z.uuid(),
        alumnoId: z.uuid(),
        /** El caballo PREVISTO al programar (decisión 1.11), no con el que montó. */
        caballoId: z.uuid().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => inscribirNucleo(ctx, input)),

  /** Cancelar una inscripción (EI). */
  cancelar: procedimiento
    .input(z.object({ inscripcionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => cancelarNucleo(ctx, input)),

  /** Inscribir a un alumno propio (EI, M13): el cliente se anota desde el portal. */
  inscribirPropio: procedimientoPortal
    .input(z.object({ claseId: z.uuid(), alumnoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await alumnoEsPropio(ctx.supabase, input.alumnoId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Ese alumno no es tuyo.' });
      }
      return inscribirNucleo(ctx, { ...input, caballoId: null });
    }),

  /** Cancelar la inscripción de un alumno propio (EI, M13). */
  cancelarPropio: procedimientoPortal
    .input(z.object({ inscripcionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: inscripcion } = await ctx.supabase
        .from('inscripcion')
        .select('alumno_id')
        .eq('id', input.inscripcionId)
        .maybeSingle();
      if (!inscripcion || !(await alumnoEsPropio(ctx.supabase, inscripcion.alumno_id))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Esa inscripción no es tuya.' });
      }
      return cancelarNucleo(ctx, input);
    }),
});
