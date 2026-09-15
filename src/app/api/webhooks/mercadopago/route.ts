import { clienteDeServicio } from '@/lib/supabase/servidor';
import { mapearEstadoDePago, verificarFirmaWebhook } from '@/lib/mercadopago';
import { notificarPorCodigo } from '@/server/notificaciones';

/**
 * M4 · Webhook de MercadoPago.
 *
 * Único punto de la aplicación al que MercadoPago le habla directo, sin pasar
 * por tRPC ni por una sesión: por eso usa la clave de servicio (salta RLS,
 * `servidor.ts`) y por eso lo primero que hace es verificar la firma —sin
 * eso, cualquiera que adivine la URL podría avisar "pago acreditado" sin que
 * haya entrado un peso.
 *
 * `external_reference` es el id del `pago` que `generarPreferencia` creó antes
 * de pedirle la preferencia a MercadoPago: es lo que conecta esta notificación
 * con una fila que ya existe. Si no hay fila que corresponda —una notificación
 * de otro tipo, o de un pago que este sistema no generó—, se responde 200 sin
 * tocar nada: la responsabilidad de esta ruta es escuchar, no adivinar.
 */
export async function POST(peticion: Request) {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!secreto || !token) {
    // No bloquea el desarrollo (07-dependencias-externas.md): sin credenciales
    // reales, MercadoPago no tiene a dónde mandar esto de todos modos.
    return Response.json({ error: 'MercadoPago no está configurado en este entorno.' }, { status: 501 });
  }

  const cuerpo = (await peticion.json().catch(() => null)) as
    | { type?: string; data?: { id?: string } }
    | null;
  const dataId = cuerpo?.data?.id;
  if (cuerpo?.type !== 'payment' || !dataId) {
    return Response.json({ ok: true });
  }

  const firmaValida = verificarFirmaWebhook({
    xSignature: peticion.headers.get('x-signature') ?? '',
    xRequestId: peticion.headers.get('x-request-id') ?? '',
    dataId,
    secret: secreto,
  });
  if (!firmaValida) {
    return Response.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  const respuesta = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) {
    // 5xx: que MercadoPago reintente. El detalle no bajó, no hay nada para guardar.
    return Response.json({ error: 'No se pudo obtener el detalle del pago.' }, { status: 502 });
  }

  const detalle = (await respuesta.json()) as { id: number | string; status: string; external_reference?: string };
  if (!detalle.external_reference) {
    return Response.json({ ok: true });
  }

  const estado = mapearEstadoDePago(detalle.status);
  const supabase = clienteDeServicio();
  const { data: pago } = await supabase
    .from('pago')
    .update({
      referencia_externa: String(detalle.id),
      estado,
      acreditado_en: estado === 'acreditado' ? new Date().toISOString() : null,
    })
    .eq('id', detalle.external_reference)
    .select('cliente_id, importe')
    .maybeSingle();

  // M15: acuse de pago recibido, mismo criterio que `pago.registrarManual`.
  if (estado === 'acreditado' && pago) {
    await notificarPorCodigo({
      codigoPlantilla: 'pago_recibido',
      clienteId: pago.cliente_id,
      valores: { importe: Number(pago.importe).toFixed(2), fecha: new Date().toISOString().slice(0, 10) },
    });
  }

  return Response.json({ ok: true });
}
