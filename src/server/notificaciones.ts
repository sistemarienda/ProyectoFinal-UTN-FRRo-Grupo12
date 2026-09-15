import { clienteDeServicio } from '@/lib/supabase/servidor';
import { aplicarPlantilla } from '@/lib/mensajeria';
import { mensajeDeError } from './errores';

/**
 * M15 · El envío que dispara el propio sistema, no un administrador desde una
 * pantalla.
 *
 * Es la contraparte de `mensaje.enviarIndividual` (M5) para cuatro momentos
 * donde nadie hace clic para avisar: una clase que se confirma o se suspende
 * (CUS05, pasos 6 y 7.a), un pago que se acredita, una invitación de evento, y
 * los dos avisos de calendario de RN-11 (`GET /api/cron/avisos-cobranza`).
 *
 * Usa la clave de servicio a propósito (`servidor.ts`, documentado ahí mismo
 * para "los trabajos programados y los webhooks (M15)"): quien dispara el
 * aviso —un instructor sin acceso a `cliente`, un cron sin sesión— no tiene
 * por qué poder leer lo que RLS le esconde para avisarle a alguien.
 *
 * No lanza: a diferencia de `enviarIndividual` (una acción del administrador,
 * que necesita el motivo para mostrarlo), un fallo acá no puede tumbar la
 * transacción que lo disparó —suspender una clase no depende de que el aviso
 * salga— así que se devuelve el motivo para que quede en el resultado del
 * cron o, si hace falta, en el registro de quien llamó.
 */
export interface ResultadoNotificacion {
  enviado: boolean;
  mensajeId?: string;
  motivo?: string;
}

export async function notificarPorCodigo(input: {
  codigoPlantilla: string;
  clienteId: string;
  valores?: Record<string, string>;
  estadoCuentaId?: string;
}): Promise<ResultadoNotificacion> {
  const supabase = clienteDeServicio();
  const valores = input.valores ?? {};

  const { data: plantilla, error: errorPlantilla } = await supabase
    .from('plantilla_mensaje')
    .select('id, canal, cuerpo, activa, estado_aprobacion')
    .eq('codigo', input.codigoPlantilla)
    .limit(1)
    .maybeSingle();

  if (errorPlantilla) return { enviado: false, motivo: mensajeDeError(errorPlantilla) };
  if (!plantilla) return { enviado: false, motivo: `No existe la plantilla "${input.codigoPlantilla}".` };
  if (!plantilla.activa) return { enviado: false, motivo: 'La plantilla está inactiva.' };
  if (plantilla.canal === 'whatsapp' && plantilla.estado_aprobacion !== 'aprobada') {
    return { enviado: false, motivo: 'Meta todavía no aprobó esta plantilla: no se puede enviar por WhatsApp.' };
  }

  const { data: cliente, error: errorCliente } = await supabase
    .from('cliente')
    .select('consentimiento_en, consentimiento_revocado_en, persona:persona_id (telefono, email)')
    .eq('id', input.clienteId)
    .maybeSingle();

  if (errorCliente) return { enviado: false, motivo: mensajeDeError(errorCliente) };
  if (!cliente) return { enviado: false, motivo: 'No existe ese cliente.' };

  // RN-19: mismo criterio que `enviarIndividual` — sin consentimiento vigente
  // no hay margen para asumirlo, ni siquiera para un aviso que el sistema
  // considera de rutina.
  if (plantilla.canal === 'whatsapp') {
    const vigente = cliente.consentimiento_en && !cliente.consentimiento_revocado_en;
    if (!vigente) return { enviado: false, motivo: 'El cliente no tiene consentimiento de mensajería vigente.' };
  }

  const destino = plantilla.canal === 'whatsapp' ? cliente.persona?.telefono : cliente.persona?.email;
  if (!destino) {
    return {
      enviado: false,
      motivo: plantilla.canal === 'whatsapp' ? 'El cliente no tiene teléfono cargado.' : 'El cliente no tiene correo cargado.',
    };
  }

  const { faltantes } = aplicarPlantilla(plantilla.cuerpo, valores);
  if (faltantes.length > 0) {
    return { enviado: false, motivo: `Faltan datos para: ${faltantes.join(', ')}.` };
  }

  const { data, error } = await supabase
    .from('mensaje')
    .insert({
      plantilla_id: plantilla.id,
      cliente_id: input.clienteId,
      canal: plantilla.canal,
      destino,
      estado_cuenta_id: input.estadoCuentaId ?? null,
      estado: 'pendiente',
    })
    .select('id')
    .single();

  if (error || !data) return { enviado: false, motivo: mensajeDeError(error) };
  return { enviado: true, mensajeId: data.id as string };
}
