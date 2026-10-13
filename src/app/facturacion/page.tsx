import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { FormularioEmitir } from './formulario-emitir';
import { FormularioLote } from './formulario-lote';
import { BotonReintentar } from './boton-reintentar';
import { fechaCorta } from '@/lib/fechas';

export const metadata: Metadata = { title: 'Facturación' };

const ESTADO_BADGE = { autorizado: 'badge-ok', rechazado: 'badge-bad' } as const;
const ESTADO_TEXTO = { autorizado: 'Autorizado', rechazado: 'Rechazado' } as const;
const TIPO_TEXTO = { factura_a: 'Factura A', factura_b: 'Factura B', factura_c: 'Factura C', nota_credito: 'Nota de crédito', nota_debito: 'Nota de débito' } as const;

function formatoDinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

function primerYUltimoDiaDeEsteMes() {
  const hoy = new Date();
  const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const hasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  return { desde, hasta };
}

/** M6 · Facturación electrónica: cierra el circuito de RN-05, sobre los cargos que M3 ya generó. */
export default async function Facturacion({ searchParams }: PageProps<'/facturacion'>) {
  const params = await searchParams;
  const { desde: desdeDefault, hasta: hastaDefault } = primerYUltimoDiaDeEsteMes();
  const desde = typeof params.desde === 'string' && params.desde ? params.desde : desdeDefault;
  const hasta = typeof params.hasta === 'string' && params.hasta ? params.hasta : hastaDefault;

  const api = await llamador();
  const [cargosSinComprobante, comprobantes, reporte, puntosVenta, identidadVigente, estadoArca] = await Promise.all([
    api.cuentaCorriente.informeCargosSinComprobante(),
    api.comprobante.listarDelPeriodo({ desde, hasta }),
    api.comprobante.reporteDelPeriodo({ desde, hasta }),
    api.puntoVenta.listar(),
    api.identidadFiscal.vigente(),
    api.comprobante.estadoDeArca(),
  ]);

  const puntosWebService = puntosVenta.filter((p) => p.modo === 'web_service' && p.activo);

  const porCliente = new Map<string, { nombreCliente: string; cargos: { id: string; concepto: string; importe: number; periodo: string | null }[] }>();
  for (const cargo of cargosSinComprobante) {
    const cliente = cargo.cuenta?.cliente;
    if (!cliente) continue;
    const nombre = cliente.tipo === 'persona_juridica' ? (cliente.razon_social ?? '') : `${cliente.persona?.apellido ?? ''}, ${cliente.persona?.nombre ?? ''}`;
    const existente = porCliente.get(cliente.id) ?? { nombreCliente: nombre, cargos: [] };
    existente.cargos.push({ id: cargo.id, concepto: cargo.concepto, importe: Number(cargo.importe), periodo: cargo.periodo });
    porCliente.set(cliente.id, existente);
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Gerencia</p>
      <h1 className="font-serif text-3xl text-fg">Facturación</h1>
      <p className="mt-1 text-fg-muted">
        Comprobantes electrónicos emitidos ante ARCA y cargos pendientes de facturar.
      </p>

      {!identidadVigente && (
        <p className="card-accent mt-6 p-4 text-sm text-warn">
          No hay una identidad fiscal vigente. Cargala en <Link href="/configuracion" className="link">Configuración</Link> antes de emitir.
        </p>
      )}
      {puntosWebService.length === 0 && (
        <p className="card-accent mt-3 p-4 text-sm text-warn">
          No hay un punto de venta de tipo web service activo. Cargalo en <Link href="/configuracion" className="link">Configuración</Link>.
        </p>
      )}
      {!estadoArca.ok && (
        <p className="card-accent mt-3 p-4 text-sm text-bad">ARCA no responde: {estadoArca.motivo}</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="label">Comprobantes del período</p>
          <p className="font-serif text-2xl tnum text-fg">{reporte.cantidad}</p>
        </div>
        <div className="card p-4">
          <p className="label">Autorizados</p>
          <p className="font-serif text-2xl tnum text-ok">{reporte.porEstado.autorizado ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="label">Rechazados</p>
          <p className="font-serif text-2xl tnum text-bad">{reporte.porEstado.rechazado ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="label">Total autorizado</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(reporte.totalAutorizado)}</p>
        </div>
      </div>

      {puntosWebService.length > 0 && (
        <div className="mt-6">
          <FormularioLote puntosVenta={puntosWebService} />
        </div>
      )}

      <section className="mt-6 space-y-3">
        <h2 className="font-serif text-lg text-fg">Cargos sin comprobante autorizado</h2>
        {porCliente.size === 0 && <p className="card p-4 text-sm text-fg-muted">No hay cargos pendientes de facturar.</p>}
        {puntosWebService.length > 0 &&
          [...porCliente.entries()].map(([clienteId, { nombreCliente, cargos }]) => (
            <FormularioEmitir key={clienteId} clienteId={clienteId} nombreCliente={nombreCliente} cargos={cargos} puntosVenta={puntosWebService} />
          ))}
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-serif text-lg text-fg">Comprobantes del período</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">Comprobantes emitidos, con su estado.</caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">Número</th>
                <th scope="col" className="num">Total</th>
                <th scope="col">Estado</th>
                <th scope="col">Fecha</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody className="tnum">
              {comprobantes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/facturacion/${c.id}`} className="font-medium text-fg hover:text-accent-ink">
                      {c.nombreCliente}
                    </Link>
                  </td>
                  <td>{TIPO_TEXTO[c.tipo as keyof typeof TIPO_TEXTO]}</td>
                  <td className="num">{String(c.punto_venta?.numero ?? 0).padStart(4, '0')}-{String(c.numero).padStart(8, '0')}</td>
                  <td className="num font-medium">{formatoDinero(Number(c.total))}</td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[c.estado as keyof typeof ESTADO_BADGE]}`}>
                      {ESTADO_TEXTO[c.estado as keyof typeof ESTADO_TEXTO]}
                    </span>
                  </td>
                  <td className="text-xs">{fechaCorta(c.fecha_emision)}</td>
                  <td>{c.estado === 'rechazado' && <BotonReintentar comprobanteId={c.id} />}</td>
                </tr>
              ))}
              {comprobantes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-fg-muted">Sin comprobantes en este período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
