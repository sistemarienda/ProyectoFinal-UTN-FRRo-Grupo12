import { clienteDeServicio } from '@/lib/supabase/servidor';
import { diaDeAvisoDeMora } from '@/lib/cobranza';
import { obtenerParametrosDeCobranza } from '@/server/parametros-servidor';
import { notificarPorCodigo } from '@/server/notificaciones';

/**
 * M15 · El calendario de cobranza del mes (RN-11), sin Inngest.
 *
 * La 2ª Entrega había declarado Inngest para los trabajos programados; se
 * optó por Vercel Cron en su lugar —cero cuenta y cero credencial nueva,
 * mismo criterio que ya usó M6 para no sumar Upstash— y quedó anotado en la
 * memoria del proyecto, no sólo acá.
 *
 * Corre una vez por día (`vercel.json`) y hace dos cosas, cada una sobre los
 * cargos (`movimiento_cuenta.tipo = 'cargo'`) cuyo `vence_en` corresponde al
 * día de hoy — ya calculado y guardado por `cuentaCorriente.generarCargosDel
 * Periodo` (M3) con el día pactado de cada cliente (RN-08), así que este cron
 * no recalcula ningún vencimiento, sólo lee:
 *
 *   1. **Aviso previo** (día 7 del calendario, tres días antes del venci-
 *      miento por omisión): cargos que vencen en `diasAvisoPrevioVencimiento`
 *      días a partir de hoy.
 *   2. **Aviso de mora** (día 11): cargos cuyo vencimiento fue ayer o
 *      anteayer y cuyo día de aviso —un día después, corrido al lunes si cae
 *      domingo, RN-10 (`diaDeAvisoDeMora`)— es hoy.
 *
 * Los dos se saltan un cliente cuya cuenta ya está en $0 (RN: no tiene sentido
 * avisar un vencimiento que ya se pagó) y uno que ya recibió ese aviso hoy
 * mismo (reintento manual del cron): la guarda es `mensaje`, que ya es la
 * trazabilidad de "se le avisó o no se le avisó" desde M5, así que no hace
 * falta una tabla nueva sólo para no repetir un envío.
 */

function ymd(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

interface ContadorAviso {
  candidatos: number;
  enviados: number;
  omitidos: string[];
}

async function procesarVencimientosDe(
  supabase: ReturnType<typeof clienteDeServicio>,
  venceEl: string,
  codigoPlantilla: string,
): Promise<ContadorAviso> {
  const contador: ContadorAviso = { candidatos: 0, enviados: 0, omitidos: [] };

  const { data: cargos } = await supabase
    .from('movimiento_cuenta')
    .select('importe, cuenta_corriente:cuenta_corriente_id (cliente_id, saldo)')
    .eq('tipo', 'cargo')
    .eq('vence_en', venceEl);

  const porCliente = new Map<string, { importe: number; saldo: number }>();
  for (const cargo of cargos ?? []) {
    const cuenta = cargo.cuenta_corriente;
    if (!cuenta || Number(cuenta.saldo) <= 0) continue; // ya está al día
    const previo = porCliente.get(cuenta.cliente_id);
    porCliente.set(cuenta.cliente_id, {
      importe: (previo?.importe ?? 0) + Number(cargo.importe),
      saldo: Number(cuenta.saldo),
    });
  }

  const inicioDeHoy = new Date();
  inicioDeHoy.setUTCHours(0, 0, 0, 0);

  for (const [clienteId, { importe, saldo }] of porCliente) {
    contador.candidatos++;

    const { data: yaEnviado } = await supabase
      .from('mensaje')
      .select('id, plantilla:plantilla_id!inner (codigo)')
      .eq('cliente_id', clienteId)
      .eq('plantilla.codigo', codigoPlantilla)
      .gte('creado_en', inicioDeHoy.toISOString())
      .limit(1)
      .maybeSingle();
    if (yaEnviado) {
      contador.omitidos.push(`${clienteId}: ya se le avisó hoy`);
      continue;
    }

    const resultado = await notificarPorCodigo({
      codigoPlantilla,
      clienteId,
      valores: { importe: importe.toFixed(2), vencimiento: venceEl, saldo: saldo.toFixed(2) },
    });
    if (resultado.enviado) contador.enviados++;
    else contador.omitidos.push(`${clienteId}: ${resultado.motivo}`);
  }

  return contador;
}

export async function GET(peticion: Request) {
  const secreto = process.env.CRON_SECRET;
  if (secreto) {
    const auth = peticion.headers.get('authorization');
    if (auth !== `Bearer ${secreto}`) {
      return Response.json({ error: 'No autorizado.' }, { status: 401 });
    }
  }

  const supabase = clienteDeServicio();
  const parametros = await obtenerParametrosDeCobranza(supabase);

  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const hoyYmd = ymd(hoy);

  const vencimientoPrevio = new Date(hoy);
  vencimientoPrevio.setUTCDate(vencimientoPrevio.getUTCDate() + parametros.diasAvisoPrevioVencimiento);
  const avisoPrevio = await procesarVencimientosDe(supabase, ymd(vencimientoPrevio), 'aviso_previo_vencimiento');

  // El aviso de mora sale un día después del vencimiento, corrido al lunes si
  // cae domingo: se revisan los dos candidatos posibles (ayer y anteayer) y
  // se procesa el que hoy sea, de verdad, su día de aviso.
  let avisoMora: ContadorAviso = { candidatos: 0, enviados: 0, omitidos: [] };
  for (const atras of [1, 2]) {
    const vencimiento = new Date(hoy);
    vencimiento.setUTCDate(vencimiento.getUTCDate() - atras);
    if (ymd(diaDeAvisoDeMora(vencimiento)) !== hoyYmd) continue;
    avisoMora = await procesarVencimientosDe(supabase, ymd(vencimiento), 'recordatorio_pago');
    break;
  }

  return Response.json({ ok: true, fecha: hoyYmd, avisoPrevio, avisoMora });
}
