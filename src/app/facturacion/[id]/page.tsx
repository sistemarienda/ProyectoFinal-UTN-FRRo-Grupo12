import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { BotonReintentar } from '../boton-reintentar';
import { BotonImprimir } from './boton-imprimir';

export const metadata: Metadata = { title: 'Comprobante' };

const TIPO_TEXTO = { factura_a: 'FACTURA A', factura_b: 'FACTURA B', factura_c: 'FACTURA C', nota_credito: 'NOTA DE CRÉDITO', nota_debito: 'NOTA DE DÉBITO' } as const;
const CONDICION_TEXTO = { responsable_inscripto: 'IVA Responsable Inscripto', monotributo: 'Responsable Monotributo', consumidor_final: 'Consumidor Final', exento: 'IVA Sujeto Exento' } as const;

function formatoDinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

/**
 * Representación imprimible del comprobante, con el QR real de la RG 4.892.
 *
 * No hay generación de PDF en el servidor todavía (Supabase Storage está
 * declarado pero no instalado, ver `rienda-construccion-bases`): esta
 * pantalla es la representación completa y el "Imprimir" del navegador la
 * exporta a PDF, que es lo que en definitiva pide la norma —una
 * representación imprimible con QR—, no un archivo generado de antemano.
 */
export default async function ComprobanteDetalle({ params }: PageProps<'/facturacion/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let comprobante;
  try {
    comprobante = await api.comprobante.detalle({ id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const qrDataUrl = comprobante.urlQr ? await QRCode.toDataURL(comprobante.urlQr, { margin: 1, width: 180 }) : null;

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Gerencia · Facturación</p>
        <div className="flex items-center gap-3">
          {comprobante.estado === 'rechazado' && <BotonReintentar comprobanteId={comprobante.id} />}
          <BotonImprimir />
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <header className="flex items-start justify-between gap-3 border-b border-surface-border pb-4">
          <div>
            <p className="font-serif text-xl text-fg">{comprobante.emisor_razon_social}</p>
            <p className="text-sm text-fg-muted">CUIT {comprobante.emisor_cuit}</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-lg text-fg">{TIPO_TEXTO[comprobante.tipo as keyof typeof TIPO_TEXTO]}</p>
            <p className="tnum text-sm text-fg-muted">
              {String(comprobante.punto_venta?.numero ?? 0).padStart(4, '0')}-{String(comprobante.numero).padStart(8, '0')}
            </p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="label">Cliente</dt>
            <dd className="text-fg">{comprobante.nombreCliente}</dd>
          </div>
          <div>
            <dt className="label">Condición IVA receptor</dt>
            <dd className="text-fg">{CONDICION_TEXTO[comprobante.receptor_condicion_iva as keyof typeof CONDICION_TEXTO]}</dd>
          </div>
          <div>
            <dt className="label">Fecha de emisión</dt>
            <dd className="text-fg">{comprobante.fecha_emision}</dd>
          </div>
          <div>
            <dt className="label">Estado</dt>
            <dd className={comprobante.estado === 'autorizado' ? 'text-ok' : 'text-bad'}>
              {comprobante.estado === 'autorizado' ? 'Autorizado' : 'Rechazado'}
            </dd>
          </div>
        </dl>

        {comprobante.estado === 'rechazado' && (
          <p className="card-accent p-3 text-sm text-bad">{comprobante.rechazo_motivo}</p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-2 border-t border-surface-border pt-4">
          <div className="tnum text-2xl font-serif text-fg">{formatoDinero(Number(comprobante.total))}</div>
          {comprobante.estado === 'autorizado' && (
            <div className="text-right text-xs text-fg-muted">
              <p>CAE {comprobante.cae}</p>
              <p>Vto. {comprobante.cae_vencimiento}</p>
            </div>
          )}
        </div>

        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- data URL generado localmente, no hay dominio remoto que optimizar
          <img src={qrDataUrl} alt="Código QR del comprobante (RG 4.892)" width={180} height={180} className="mx-auto" />
        )}
      </div>
    </div>
  );
}
