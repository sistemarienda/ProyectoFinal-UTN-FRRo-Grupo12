import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { ROLES } from '@/lib/roles';
import { clienteDeServicio } from '@/lib/supabase/servidor';
import { mensajeDeError } from '../errores';

/**
 * M1 · Usuarios y roles.
 *
 * Toda operación de este router es del administrador. No hace falta comprobarlo
 * en cada procedimiento: `procedimientoAdmin` ya lo hace, y las políticas RLS lo
 * hacen otra vez del lado de la base.
 */

const telefono = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'El teléfono va en formato internacional, por ejemplo +5493415550188.');

export const routerUsuario = crearRouter({
  /** Listado de usuarios, con la persona detrás de cada uno. */
  listar: procedimientoAdmin.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('usuario')
      .select('id, rol, activo, ultimo_acceso_en, persona:persona_id (nombre, apellido, email)')
      .order('activo', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
    return data ?? [];
  }),

  /**
   * Quiénes pueden figurar como instructor de una clase (M7).
   *
   * No es `listar` con un filtro: aquél es del administrador y devuelve correo y
   * último acceso. Éste lo consulta un instructor para elegir quién dicta y para
   * filtrar la grilla, así que devuelve lo justo —identificador y nombre— y se
   * apoya en la política `usuario_lectura`, que M7 abrió a todo el personal.
   *
   * Incluye al administrador porque en este haras el dueño también dicta, y
   * porque `clase_escritura` ya lo habilita a programar.
   */
  instructores: procedimientoDeArea('ensenanza').query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('usuario')
      .select('id, persona:persona_id (nombre, apellido)')
      .in('rol', ['instructor', 'administrador'])
      .eq('activo', true);

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    return (data ?? [])
      .map((u) => ({
        id: u.id,
        nombre: [u.persona?.nombre, u.persona?.apellido].filter(Boolean).join(' '),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'));
  }),

  /**
   * Alta de un usuario.
   *
   * Son tres cosas encadenadas: la persona, la credencial en Supabase Auth y la
   * fila de `usuario` que las une con su rol. La credencial se crea con la clave
   * de servicio porque dar de alta un usuario en Auth no es una operación que
   * pueda hacer una sesión común.
   *
   * No se fija una contraseña acá: se envía una invitación para que la persona
   * elija la suya. Así ninguna contraseña pasa por el sistema ni por quien la
   * da de alta.
   *
   * **La persona se reutiliza si ya existe** (mismo criterio que
   * `cliente.personaIdempotente`), y no es un caso raro: es exactamente lo que
   * hace falta para darle acceso al portal a un cliente que M2 ya cargó. Si esa
   * persona ya tiene un usuario, `usuario_persona_unica` lo rechaza con un
   * mensaje claro en vez de dejar dos logins para la misma persona.
   */
  crear: procedimientoAdmin
    .input(
      z.object({
        nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
        apellido: z.string().trim().min(1, 'El apellido no puede quedar vacío.'),
        tipoDocumento: z.enum(['dni', 'cuit', 'cuil', 'pasaporte']),
        numeroDocumento: z.string().trim().min(6, 'El documento parece incompleto.'),
        email: z.email('El correo no tiene un formato válido.'),
        telefono: telefono.optional(),
        rol: z.enum(ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: existente, error: errorBusqueda } = await ctx.supabase
        .from('persona')
        .select('id')
        .eq('tipo_documento', input.tipoDocumento)
        .eq('numero_documento', input.numeroDocumento)
        .maybeSingle();
      if (errorBusqueda) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorBusqueda) });
      }

      let personaId = existente?.id as string | undefined;
      if (!personaId) {
        const { data: persona, error: errorPersona } = await ctx.supabase
          .from('persona')
          .insert({
            nombre: input.nombre,
            apellido: input.apellido,
            tipo_documento: input.tipoDocumento,
            numero_documento: input.numeroDocumento,
            email: input.email,
            telefono: input.telefono ?? null,
          })
          .select('id')
          .single();

        if (errorPersona) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorPersona) });
        }
        personaId = persona.id as string;
      }

      const servicio = clienteDeServicio();
      const { data: credencial, error: errorAuth } = await servicio.auth.admin.inviteUserByEmail(
        input.email,
      );

      if (errorAuth || !credencial?.user) {
        // Sólo se deshace la persona si se acaba de crear acá: una reutilizada
        // (por ejemplo, la de un cliente ya cargado en M2) no se borra por un
        // correo que falló.
        if (!existente) await ctx.supabase.from('persona').delete().eq('id', personaId);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `No se pudo enviar la invitación: ${errorAuth?.message ?? 'sin detalle'}`,
        });
      }

      const { error: errorUsuario } = await ctx.supabase.from('usuario').insert({
        id: credencial.user.id,
        persona_id: personaId,
        rol: input.rol,
      });

      if (errorUsuario) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorUsuario) });
      }

      return { usuarioId: credencial.user.id, personaId };
    }),

  /** Modificar el rol de un usuario. */
  cambiarRol: procedimientoAdmin
    .input(z.object({ usuarioId: z.uuid(), rol: z.enum(ROLES) }))
    .mutation(async ({ ctx, input }) => {
      // Quedarse sin ningún administrador deja el sistema sin quien lo
      // configure, y recuperarlo exige tocar la base a mano.
      if (input.rol !== 'administrador') {
        const { count } = await ctx.supabase
          .from('usuario')
          .select('id', { count: 'exact', head: true })
          .eq('rol', 'administrador')
          .eq('activo', true);

        const { data: actual } = await ctx.supabase
          .from('usuario')
          .select('rol')
          .eq('id', input.usuarioId)
          .single();

        if (actual?.rol === 'administrador' && (count ?? 0) <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Es el único administrador activo: asigná otro antes de cambiarle el rol.',
          });
        }
      }

      const { error } = await ctx.supabase
        .from('usuario')
        .update({ rol: input.rol })
        .eq('id', input.usuarioId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /**
   * Desactivar un usuario.
   *
   * Baja lógica: nunca se borra a alguien con historial, porque su nombre figura
   * en registros de cuidado, en asistencias y en la traza de auditoría.
   */
  desactivar: procedimientoAdmin
    .input(z.object({ usuarioId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.usuarioId === ctx.sesion.usuarioId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No podés desactivar tu propio usuario.',
        });
      }

      const { error } = await ctx.supabase
        .from('usuario')
        .update({ activo: false })
        .eq('id', input.usuarioId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),
});
