import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearRouter, procedimientoDeArea } from '../trpc';
import type { Database } from '@/lib/supabase/tipos-generados';
import {
  ZONA_HARAS,
  cancelacionEnTermino,
  cupoDeClase,
  instanteDesdeLocal,
  ocupacionDeInstalaciones,
  partesLocales,
  semanaDe,
} from '@/lib/agenda';
import { antelacionMinimaDeCancelacion } from '../parametros-servidor';
import { mensajeDeError } from '../errores';
import { notificarPorCodigo } from '../notificaciones';

/**
 * M7 · Agenda de clases.
 *
 * **El conflicto de recursos no se detecta acá: la base lo hace imposible.** El
 * esquema declara dos restricciones de exclusión sobre `clase.transcurre`, una
 * por instalación y otra por instructor. Este router hace dos cosas alrededor de
 * eso: consulta antes de guardar, para poder mostrar contra qué clase choca, y
 * traduce la violación (SQLSTATE 23P01) cuando la carrera se pierde igual, que
 * es lo que pasa si dos instructores programan a la vez. Sin la traducción, el
 * usuario ve el texto de un constraint de Postgres.
 *
 * **Lo que este módulo no hace todavía.** El CUS05 (paso 6 y camino 7.a) prevé
 * avisar al cliente de cada alumno al programar y al suspender. Las plantillas
 * `confirmacion_clase` y `clase_suspendida` existen desde la configuración
 * inicial pero están en `borrador` y sin cuerpo aprobado por Meta, así que ese
 * envío hoy fallaría siempre. Se deja fuera a propósito y no simulado: la
 * dependencia es externa y está declarada en `07-dependencias-externas.md`.
 */

const procedimiento = procedimientoDeArea('ensenanza');

/**
 * Lo que la grilla necesita de cada clase para dibujarse y para navegar al
 * detalle. Va en una sola línea a propósito: supabase-js deduce la forma del
 * resultado a partir del literal de la selección, y partirlo con
 * concatenaciones lo degrada a `string`, que se lleva puesto el tipado de la
 * consulta entera.
 */
const CAMPOS_DE_AGENDA =
  'id, inicia_en, duracion_min, cupo, nivel, estado, motivo_suspension, servicio:servicio_id (id, nombre, modalidad), instalacion:instalacion_id (id, nombre), instructor:instructor_id (id, persona:persona_id (nombre, apellido))';

const horaDelDia = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora va en formato HH:MM.');

/**
 * Cuántos alumnos hay inscriptos en cada clase.
 *
 * Se resuelve en una consulta aparte y se cruza en memoria en lugar de pedirle
 * a PostgREST un conteo embebido: el conteo tiene que contar sólo los
 * `inscripto` y dejar afuera los `cancelado`, y filtrar un agregado embebido
 * obliga a un `!inner` que además descartaría las clases sin nadie anotado,
 * que son justo las que hay que mostrar con cupo libre.
 */
async function inscriptosPorClase(
  supabase: SupabaseClient<Database>,
  claseIds: readonly string[],
): Promise<Map<string, number>> {
  if (claseIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('inscripcion')
    .select('clase_id')
    .in('clase_id', [...claseIds])
    .eq('estado', 'inscripto');

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

  const conteo = new Map<string, number>();
  for (const i of data ?? []) {
    conteo.set(i.clase_id, (conteo.get(i.clase_id) ?? 0) + 1);
  }
  return conteo;
}

export interface ClaseEnConflicto {
  id: string;
  iniciaEn: string;
  duracionMin: number;
  motivo: 'instalacion' | 'instructor' | 'ambos';
  servicio: string | null;
  instalacion: string | null;
}

/**
 * Clases que se pisan con el intervalo propuesto, por instalación o por
 * instructor. Las canceladas no ocupan nada, igual que en las restricciones de
 * exclusión de la base: los dos criterios tienen que decir lo mismo.
 */
async function conflictosDe(
  supabase: SupabaseClient<Database>,
  intervalo: { instalacionId: string; instructorId: string; iniciaEn: Date; duracionMin: number },
  excluirClaseId?: string,
): Promise<ClaseEnConflicto[]> {
  const fin = new Date(intervalo.iniciaEn.getTime() + intervalo.duracionMin * 60_000);
  const rango = `[${intervalo.iniciaEn.toISOString()},${fin.toISOString()})`;

  let consulta = supabase
    .from('clase')
    .select('id, inicia_en, duracion_min, instalacion_id, instructor_id, servicio:servicio_id (nombre), instalacion:instalacion_id (nombre)')
    .neq('estado', 'cancelada')
    .overlaps('transcurre', rango)
    .or(`instalacion_id.eq.${intervalo.instalacionId},instructor_id.eq.${intervalo.instructorId}`);

  if (excluirClaseId) consulta = consulta.neq('id', excluirClaseId);

  const { data, error } = await consulta;
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

  return (data ?? []).map((c) => {
    const pisaInstalacion = c.instalacion_id === intervalo.instalacionId;
    const pisaInstructor = c.instructor_id === intervalo.instructorId;
    return {
      id: c.id,
      iniciaEn: c.inicia_en,
      duracionMin: c.duracion_min,
      motivo: pisaInstalacion && pisaInstructor ? 'ambos' : pisaInstalacion ? 'instalacion' : 'instructor',
      servicio: c.servicio?.nombre ?? null,
      instalacion: c.instalacion?.nombre ?? null,
    } satisfies ClaseEnConflicto;
  });
}

function describirConflictos(conflictos: readonly ClaseEnConflicto[]): string {
  const detalle = conflictos
    .map((c) => {
      const cuando = new Date(c.iniciaEn).toLocaleString('es-AR', {
        timeZone: ZONA_HARAS,
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const que =
        c.motivo === 'instalacion'
          ? `la instalación ya está tomada por «${c.servicio ?? 'otra clase'}»`
          : c.motivo === 'instructor'
            ? `el instructor ya dicta «${c.servicio ?? 'otra clase'}»`
            : `el instructor y la instalación ya están tomados por «${c.servicio ?? 'otra clase'}»`;
      return `${cuando}: ${que}`;
    })
    .join('; ');

  return `El horario se superpone. ${detalle}.`;
}

/** El servicio tiene que ser de clase: RN-14 declara la modalidad sólo en esos. */
async function modalidadDelServicio(supabase: SupabaseClient<Database>, servicioId: string) {
  const { data, error } = await supabase
    .from('servicio')
    .select('nombre, modalidad, activo')
    .eq('id', servicioId)
    .maybeSingle();

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
  if (!data) throw new TRPCError({ code: 'BAD_REQUEST', message: 'El servicio indicado no existe.' });
  if (!data.modalidad) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `«${data.nombre}» no es un servicio de clase: no tiene modalidad declarada (RN-14).`,
    });
  }
  return data.modalidad;
}

export const routerClase = crearRouter({
  /**
   * Agenda semanal (EQ).
   *
   * Devuelve la semana completa de lunes a domingo y las clases que caen en
   * ella. La grilla la arma la pantalla con `armarGrilla`, que es lógica pura y
   * está probada; acá sólo se resuelve el rango y se traen los datos.
   */
  semanal: procedimiento
    .input(
      z.object({
        /** Cualquier día de la semana buscada. Por omisión, hoy. */
        referencia: z.iso.date().optional(),
        instalacionId: z.uuid().optional(),
        instructorId: z.uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const referencia = input.referencia
        ? instanteDesdeLocal(input.referencia, '12:00')
        : new Date();
      const semana = semanaDe(referencia);

      let consulta = ctx.supabase
        .from('clase')
        .select(CAMPOS_DE_AGENDA)
        .gte('inicia_en', semana.desde.toISOString())
        .lt('inicia_en', semana.hasta.toISOString())
        .order('inicia_en');

      if (input.instalacionId) consulta = consulta.eq('instalacion_id', input.instalacionId);
      if (input.instructorId) consulta = consulta.eq('instructor_id', input.instructorId);

      const { data, error } = await consulta;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const clases = data ?? [];
      const inscriptos = await inscriptosPorClase(ctx.supabase, clases.map((c) => c.id));

      return {
        dias: semana.dias,
        clases: clases.map((c) => ({
          ...c,
          cupoDisponible: cupoDeClase(c.servicio?.modalidad ?? null, c.cupo, inscriptos.get(c.id) ?? 0),
        })),
      };
    }),

  /**
   * Detalle de una clase con sus inscriptos (EQ).
   *
   * Trae además a quién conviene inscribir: alumnos activos, marcados según
   * tengan contrato vigente del servicio (CUS05 paso 4) y según el nivel
   * coincida con el de la clase. Ni una cosa ni la otra restringen —RN-15: el
   * nivel sugiere, no manda—, así que la lista viene entera y ordenada.
   */
  detalle: procedimiento
    .input(z.object({ claseId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: clase, error } = await ctx.supabase
        .from('clase')
        .select(CAMPOS_DE_AGENDA)
        .eq('id', input.claseId)
        .maybeSingle();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      if (!clase) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa clase.' });

      const { data: inscripciones, error: errorInscripciones } = await ctx.supabase
        .from('inscripcion')
        .select(
          'id, estado, inscripto_en, cancelado_en, alumno:alumno_id (id, nivel, persona:persona_id (nombre, apellido)), caballo:caballo_id (id, nombre)',
        )
        .eq('clase_id', input.claseId)
        .order('inscripto_en');

      if (errorInscripciones) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorInscripciones) });
      }

      const anotados = inscripciones ?? [];
      const activos = anotados.filter((i) => i.estado === 'inscripto');
      const yaAnotados = new Set(activos.map((i) => i.alumno?.id));

      const [{ data: alumnos }, { data: conContrato }] = await Promise.all([
        ctx.supabase
          .from('alumno')
          .select('id, nivel, persona:persona_id (nombre, apellido)')
          .eq('activo', true),
        clase.servicio
          ? ctx.supabase.rpc('alumnos_con_contrato_vigente', { p_servicio: clase.servicio.id })
          : Promise.resolve({ data: [] as string[] }),
      ]);

      const respaldados = new Set(conContrato ?? []);

      const candidatos = (alumnos ?? [])
        .filter((a) => !yaAnotados.has(a.id))
        .map((a) => ({
          id: a.id,
          nombre: [a.persona?.nombre, a.persona?.apellido].filter(Boolean).join(' '),
          nivel: a.nivel,
          conContratoVigente: respaldados.has(a.id),
          nivelCoincide: clase.nivel != null && a.nivel === clase.nivel,
        }))
        .sort((a, b) => {
          // Primero los que el CUS05 manda sugerir, después el resto por nombre.
          const puntaje = (c: typeof a) => (c.conContratoVigente ? 2 : 0) + (c.nivelCoincide ? 1 : 0);
          return puntaje(b) - puntaje(a) || a.nombre.localeCompare(b.nombre, 'es-AR');
        });

      const { data: caballos } = await ctx.supabase
        .from('caballo')
        .select('id, nombre')
        .eq('estado', 'activo')
        .order('nombre');

      const diasMinimos = await antelacionMinimaDeCancelacion(ctx.supabase);
      const ahora = new Date();

      return {
        clase,
        /**
         * Cada inscripción viene con las dos marcas que el CUS05 pide que queden
         * ASENTADAS, no anunciadas al pasar:
         *
         *   * `conContratoVigente` (camino 4.b): la inscripción sin respaldo
         *     contractual «queda señalada». Un cartel que aparece al guardar y
         *     desaparece al recargar no señala nada, y quien lo necesita —el que
         *     liquida el período— no estaba mirando cuando se guardó.
         *   * `enTermino` (camino 5.a): la antelación con que se canceló, contra
         *     `cancelacion_clase_dias`. Se evalúa al mostrar y no se guarda,
         *     porque el dato duro es `cancelado_en` y el parámetro puede cambiar.
         */
        inscripciones: anotados.map((i) => ({
          ...i,
          conContratoVigente: i.alumno ? respaldados.has(i.alumno.id) : false,
          enTermino:
            i.cancelado_en == null
              ? null
              : cancelacionEnTermino(clase.inicia_en, new Date(i.cancelado_en), diasMinimos),
        })),
        diasMinimos,
        ahora,
        cupo: cupoDeClase(clase.servicio?.modalidad ?? null, clase.cupo, activos.length),
        candidatos,
        caballos: caballos ?? [],
      };
    }),

  /**
   * Cupos disponibles por clase (EQ).
   *
   * Es la consulta que contesta «¿dónde puedo meter a este alumno?», y por eso
   * mira hacia adelante y no la semana en curso: la respuesta útil incluye la
   * clase de la semana que viene.
   */
  cupos: procedimiento
    .input(z.object({ dias: z.int().min(1).max(90).default(14) }))
    .query(async ({ ctx, input }) => {
      const desde = new Date();
      const hasta = new Date(desde.getTime() + input.dias * 24 * 60 * 60_000);

      const { data, error } = await ctx.supabase
        .from('clase')
        .select(CAMPOS_DE_AGENDA)
        .eq('estado', 'programada')
        .gte('inicia_en', desde.toISOString())
        .lt('inicia_en', hasta.toISOString())
        .order('inicia_en');

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const clases = data ?? [];
      const inscriptos = await inscriptosPorClase(ctx.supabase, clases.map((c) => c.id));

      return clases.map((c) => ({
        ...c,
        cupoDisponible: cupoDeClase(c.servicio?.modalidad ?? null, c.cupo, inscriptos.get(c.id) ?? 0),
      }));
    }),

  /**
   * Detección de conflicto de instalación (EO).
   *
   * La consulta previa del CUS05 paso 2: se pregunta antes de guardar para poder
   * decir contra qué se choca, en lugar de dejar que la restricción de exclusión
   * conteste con un error de base.
   */
  verificarConflicto: procedimiento
    .input(
      z.object({
        instalacionId: z.uuid(),
        instructorId: z.uuid(),
        fecha: z.iso.date(),
        hora: horaDelDia,
        duracionMin: z.int().min(15).max(480),
        claseId: z.uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conflictos = await conflictosDe(
        ctx.supabase,
        {
          instalacionId: input.instalacionId,
          instructorId: input.instructorId,
          iniciaEn: instanteDesdeLocal(input.fecha, input.hora),
          duracionMin: input.duracionMin,
        },
        input.claseId,
      );

      return {
        libre: conflictos.length === 0,
        conflictos,
        mensaje: conflictos.length === 0 ? null : describirConflictos(conflictos),
      };
    }),

  /** Reporte de ocupación de instalaciones (EO). */
  ocupacion: procedimiento
    .input(z.object({ desde: z.iso.date(), hasta: z.iso.date() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('clase')
        .select('duracion_min, instalacion:instalacion_id (id, nombre)')
        .neq('estado', 'cancelada')
        .gte('inicia_en', instanteDesdeLocal(input.desde, '00:00').toISOString())
        .lt('inicia_en', new Date(instanteDesdeLocal(input.hasta, '00:00').getTime() + 86_400_000).toISOString());

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      return ocupacionDeInstalaciones(
        (data ?? [])
          .filter((c) => c.instalacion != null)
          .map((c) => ({
            instalacionId: c.instalacion!.id,
            nombre: c.instalacion!.nombre,
            duracionMin: c.duracion_min,
          })),
      );
    }),

  /** Alta de clase (EI). */
  crear: procedimiento
    .input(
      z.object({
        servicioId: z.uuid(),
        instructorId: z.uuid(),
        instalacionId: z.uuid(),
        fecha: z.iso.date(),
        hora: horaDelDia,
        duracionMin: z.int().min(15).max(480),
        cupo: z.int().min(1).max(50).nullable().default(null),
        nivel: z.enum(['inicial', 'nivel_1', 'nivel_2', 'nivel_3']).nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const modalidad = await modalidadDelServicio(ctx.supabase, input.servicioId);
      const iniciaEn = instanteDesdeLocal(input.fecha, input.hora);

      const conflictos = await conflictosDe(ctx.supabase, {
        instalacionId: input.instalacionId,
        instructorId: input.instructorId,
        iniciaEn,
        duracionMin: input.duracionMin,
      });
      if (conflictos.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: describirConflictos(conflictos) });
      }

      const { data, error } = await ctx.supabase
        .from('clase')
        .insert({
          servicio_id: input.servicioId,
          instructor_id: input.instructorId,
          instalacion_id: input.instalacionId,
          inicia_en: iniciaEn.toISOString(),
          duracion_min: input.duracionMin,
          // RN-14: la individual no lleva cupo; el límite de uno sale de la modalidad.
          cupo: modalidad === 'individual' ? null : input.cupo,
          nivel: input.nivel,
        })
        .select('id')
        .single();

      if (error) {
        // Entre la consulta previa y este insert pasó otra programación.
        if (error.code === '23P01') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Alguien tomó ese horario mientras se cargaba la clase. Conviene revisar la agenda y volver a intentar.',
          });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      }

      return { claseId: data.id as string };
    }),

  /**
   * Modificar una clase (EI).
   *
   * Sólo se modifica lo que está `programada`: reprogramar una clase ya dictada
   * falsearía el antecedente pedagógico, y reprogramar una suspendida borraría
   * el aviso que los clientes ya recibieron. El servicio tampoco se cambia: de
   * él salen la modalidad y el control de cupo, y cambiarlo con gente anotada
   * dejaría inscripciones respaldadas por un contrato de otra cosa. Para eso se
   * suspende esta clase y se programa la que corresponde.
   */
  modificar: procedimiento
    .input(
      z.object({
        claseId: z.uuid(),
        instructorId: z.uuid(),
        instalacionId: z.uuid(),
        fecha: z.iso.date(),
        hora: horaDelDia,
        duracionMin: z.int().min(15).max(480),
        cupo: z.int().min(1).max(50).nullable(),
        nivel: z.enum(['inicial', 'nivel_1', 'nivel_2', 'nivel_3']).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: actual, error: errorActual } = await ctx.supabase
        .from('clase')
        .select('estado, servicio:servicio_id (modalidad)')
        .eq('id', input.claseId)
        .maybeSingle();

      if (errorActual) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorActual) });
      if (!actual) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa clase.' });
      if (actual.estado !== 'programada') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            actual.estado === 'dictada'
              ? 'La clase ya se dictó: no se reprograma.'
              : 'La clase está suspendida: en lugar de reprogramarla, conviene dar de alta la nueva.',
        });
      }

      const inscriptos = (await inscriptosPorClase(ctx.supabase, [input.claseId])).get(input.claseId) ?? 0;
      const modalidad = actual.servicio?.modalidad ?? null;
      const cupo = modalidad === 'individual' ? null : input.cupo;

      if (cupo !== null && cupo < inscriptos) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Hay ${inscriptos} alumnos anotados: el cupo no puede quedar en ${cupo}. Primero hay que cancelar inscripciones.`,
        });
      }

      const iniciaEn = instanteDesdeLocal(input.fecha, input.hora);
      const conflictos = await conflictosDe(
        ctx.supabase,
        {
          instalacionId: input.instalacionId,
          instructorId: input.instructorId,
          iniciaEn,
          duracionMin: input.duracionMin,
        },
        input.claseId,
      );
      if (conflictos.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: describirConflictos(conflictos) });
      }

      const { error } = await ctx.supabase
        .from('clase')
        .update({
          instructor_id: input.instructorId,
          instalacion_id: input.instalacionId,
          inicia_en: iniciaEn.toISOString(),
          duracion_min: input.duracionMin,
          cupo,
          nivel: input.nivel,
        })
        .eq('id', input.claseId);

      if (error) {
        if (error.code === '23P01') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Alguien tomó ese horario mientras se guardaba el cambio. Conviene revisar la agenda y volver a intentar.',
          });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      }

      return { ok: true as const };
    }),

  /**
   * Suspender una clase con su motivo (EI).
   *
   * El motivo es obligatorio y la base lo exige (`clase_suspension_con_motivo`),
   * porque es lo que después explica el aviso al cliente y lo que permite leer
   * la temporada: no es lo mismo suspender por lluvia que por falta de
   * instructor. Las inscripciones no se tocan: quedan como constancia de quién
   * se había anotado, que es lo que se necesita para avisarles.
   */
  suspender: procedimiento
    .input(
      z.object({
        claseId: z.uuid(),
        motivo: z.string().trim().min(3, 'Hace falta el motivo de la suspensión.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: actual, error: errorActual } = await ctx.supabase
        .from('clase')
        .select('estado, inicia_en, instalacion:instalacion_id (nombre)')
        .eq('id', input.claseId)
        .maybeSingle();

      if (errorActual) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorActual) });
      if (!actual) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa clase.' });
      if (actual.estado === 'dictada') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La clase ya se dictó: no se puede suspender.' });
      }
      if (actual.estado === 'cancelada') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La clase ya está suspendida.' });
      }

      const { error } = await ctx.supabase
        .from('clase')
        .update({ estado: 'cancelada', motivo_suspension: input.motivo })
        .eq('id', input.claseId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      // CUS05, camino 7.a: se avisa a cada inscripto activo. Mejor esfuerzo,
      // igual que en `inscripcion.ts` — la clase ya quedó suspendida.
      const { data: inscriptos } = await ctx.supabase
        .from('inscripcion')
        .select('alumno:alumno_id (cliente_id, persona:persona_id (nombre, apellido))')
        .eq('clase_id', input.claseId)
        .eq('estado', 'inscripto');

      const { fecha, hora } = partesLocales(actual.inicia_en);
      await Promise.all(
        (inscriptos ?? [])
          .filter((i) => i.alumno)
          .map((i) =>
            notificarPorCodigo({
              codigoPlantilla: 'clase_suspendida',
              clienteId: i.alumno!.cliente_id,
              valores: {
                alumno: [i.alumno!.persona?.nombre, i.alumno!.persona?.apellido].filter(Boolean).join(' '),
                fecha,
                hora,
                instalacion: actual.instalacion?.nombre ?? '',
                motivo: input.motivo,
              },
            }),
          ),
      );

      return { ok: true as const };
    }),
});
