import Anthropic from '@anthropic-ai/sdk';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin } from '../trpc';
import type { Contexto } from '../contexto';
import { HERRAMIENTAS, MODELO_DEL_ASISTENTE, PROMPT_DEL_SISTEMA, coincideConBusqueda } from '@/lib/asistente';
import { routerCaballo } from './caballo';
import { routerClase } from './clase';
import { routerCliente } from './cliente';
import { routerCuentaCorriente } from './cuentaCorriente';
import { routerEventoSanitario } from './eventoSanitario';
import { routerInsumo } from './insumo';
import { routerPanel } from './panel';

/**
 * M12 · Asistente conversacional.
 *
 * «Preguntale a RIENDA» (`02-sitemap-por-perfil.md`): un panel siempre
 * accesible para el administrador, que contesta sobre los datos del sistema.
 * Sin memoria entre sesiones (pendiente 11.2 del modelo): el historial lo
 * manda el navegador entero en cada pregunta y no se persiste nada acá.
 *
 * **Por qué el modelo no toca la base directo.** Dejar que una IA arme y
 * corra SQL libre sobre una base con datos personales y de menores es
 * exactamente el tipo de superficie que este sistema evita en todo lo demás:
 * el modelo sólo puede llamar a un catálogo fijo de herramientas
 * (`HERRAMIENTAS`), cada una un procedimiento de lectura que ya existe y que
 * ya pasa por sus propias políticas RLS. Lo que el asistente puede ver es
 * exactamente lo que el administrador ya podía ver desde las pantallas.
 */

const MAX_VUELTAS = 6;
const MAX_TOKENS_DE_RESPUESTA = 1024;

const mensaje = z.object({
  rol: z.enum(['usuario', 'asistente']),
  texto: z.string().trim().min(1).max(4000),
});

function clienteAnthropic(): Anthropic {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Falta ANTHROPIC_API_KEY en este entorno: sin credencial no se puede consultar al asistente.',
    });
  }
  return new Anthropic({ apiKey: clave });
}

/**
 * Ejecuta una herramienta contra el mismo router que usa su pantalla, con el
 * `ctx` de la sesión actual: lo que el asistente puede leer es lo que las
 * políticas RLS del administrador ya dejan leer, ni una fila más.
 */
async function ejecutarHerramienta(ctx: Contexto, nombre: string, entrada: Record<string, unknown>): Promise<unknown> {
  switch (nombre) {
    case 'resumen_negocio':
      return routerPanel.createCaller(ctx).resumen();

    case 'cartera_de_cobranza':
      return routerCuentaCorriente.createCaller(ctx).listarCartera();

    case 'movimientos_de_cliente':
      return routerCuentaCorriente.createCaller(ctx).libroMayor({ clienteId: String(entrada.clienteId) });

    case 'buscar_cliente': {
      const clientes = await routerCliente.createCaller(ctx).listar();
      const q = String(entrada.nombre ?? '');
      return clientes.filter((c) => coincideConBusqueda(c.nombre ?? '', q)).slice(0, 10);
    }

    case 'ficha_cliente':
      return routerCliente.createCaller(ctx).ficha({ clienteId: String(entrada.clienteId) });

    case 'buscar_caballo': {
      const caballos = await routerCaballo.createCaller(ctx).listar();
      const q = String(entrada.nombre ?? '');
      return caballos.filter((c) => coincideConBusqueda(c.nombre, q)).slice(0, 10);
    }

    case 'ficha_caballo':
      return routerCaballo.createCaller(ctx).ficha({ caballoId: String(entrada.caballoId) });

    case 'alertas_sanitarias':
      return routerEventoSanitario.createCaller(ctx).alertas();

    case 'insumos_bajo_minimo': {
      const insumos = await routerInsumo.createCaller(ctx).listar();
      return insumos.filter((i) => i.bajoMinimo);
    }

    case 'agenda_semana':
      return routerClase.createCaller(ctx).semanal({
        referencia: typeof entrada.fecha === 'string' && entrada.fecha !== '' ? entrada.fecha : undefined,
      });

    default:
      throw new Error(`Herramienta desconocida: ${nombre}`);
  }
}

export const routerAsistente = crearRouter({
  /**
   * Una pregunta, con todo el historial de la conversación (sin memoria
   * server-side: ver el comentario del módulo). Devuelve la respuesta y qué
   * herramientas consultó, para que el panel pueda mostrar de dónde salió el
   * dato.
   */
  preguntar: procedimientoAdmin
    .input(z.object({ mensajes: z.array(mensaje).min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      const client = clienteAnthropic();

      const mensajes: Anthropic.MessageParam[] = input.mensajes.map((m) => ({
        role: m.rol === 'usuario' ? 'user' : 'assistant',
        content: m.texto,
      }));

      const herramientasUsadas = new Set<string>();

      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        let respuesta: Anthropic.Message;
        try {
          respuesta = await client.messages.create({
            model: MODELO_DEL_ASISTENTE,
            max_tokens: MAX_TOKENS_DE_RESPUESTA,
            system: PROMPT_DEL_SISTEMA,
            tools: HERRAMIENTAS as Anthropic.Tool[],
            messages: mensajes,
          });
        } catch (e) {
          if (e instanceof Anthropic.AuthenticationError) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'ANTHROPIC_API_KEY no es válida.' });
          }
          if (e instanceof Anthropic.RateLimitError) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'El asistente está saturado. Probá de nuevo en un momento.' });
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No se pudo consultar al asistente.' });
        }

        if (respuesta.stop_reason !== 'tool_use') {
          const texto = respuesta.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();
          return { texto: texto || 'No tengo una respuesta para eso.', herramientas: [...herramientasUsadas] };
        }

        mensajes.push({ role: 'assistant', content: respuesta.content });

        const pedidos = respuesta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        const resultados = await Promise.all(
          pedidos.map(async (pedido): Promise<Anthropic.ToolResultBlockParam> => {
            herramientasUsadas.add(pedido.name);
            try {
              const salida = await ejecutarHerramienta(ctx, pedido.name, pedido.input as Record<string, unknown>);
              return { type: 'tool_result', tool_use_id: pedido.id, content: JSON.stringify(salida ?? null) };
            } catch (e) {
              const detalle = e instanceof TRPCError ? e.message : 'No se pudo completar la consulta.';
              return { type: 'tool_result', tool_use_id: pedido.id, content: detalle, is_error: true };
            }
          }),
        );

        mensajes.push({ role: 'user', content: resultados });
      }

      return {
        texto: 'La consulta se volvió demasiado larga y la corté para no demorarte más. Probá con una pregunta más puntual.',
        herramientas: [...herramientasUsadas],
      };
    }),
});
