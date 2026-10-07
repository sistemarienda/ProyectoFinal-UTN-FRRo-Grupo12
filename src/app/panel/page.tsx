import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { EvolucionFacturacion } from './evolucion-facturacion';

export const metadata: Metadata = { title: 'Inicio' };

function formatoDinero(n: number) {
  const signo = n < 0 ? '-' : '';
  return `${signo}$${Math.round(Math.abs(n)).toLocaleString('es-AR')}`;
}

function formatoVariacion(v: number | null) {
  if (v === null) return null;
  const signo = v >= 0 ? '+' : '';
  return `${signo}${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% vs. mes anterior`;
}

/** Pantalla de Inicio del administrador (M11, sitemap «Dashboard BI»). */
export default async function Panel() {
  const api = await llamador();
  const [resumen, evolucion, cuentas] = await Promise.all([
    api.panel.resumen(),
    api.panel.evolucionFacturacion(),
    api.panel.cuentasConMayorSaldo(),
  ]);

  const variacion = formatoVariacion(resumen.variacionFacturacion);
  const sinAlertas =
    resumen.alertas.stockBajo === 0 && resumen.alertas.morosidad === 0 && resumen.alertas.sanidad === 0;

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Haras Las Lechuzas</p>
      <h1 className="font-serif text-3xl text-fg">Inicio</h1>
      <p className="mt-1 max-w-xl text-fg-muted">Panorama general del establecimiento.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="label">Facturación del mes</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(resumen.facturacionDelMes)}</p>
          {variacion && (
            <p className={`mt-1 text-xs ${(resumen.variacionFacturacion ?? 0) >= 0 ? 'text-ok' : 'text-bad'}`}>
              {variacion}
            </p>
          )}
        </div>

        <div className="card p-4">
          <p className="label">Cobranza pendiente</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(resumen.cobranzaPendiente)}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {resumen.cuentasConSaldo} {resumen.cuentasConSaldo === 1 ? 'cliente con saldo' : 'clientes con saldo'}
          </p>
        </div>

        <div className="card p-4">
          <p className="label">Ocupación de boxes</p>
          <p className="font-serif text-2xl tnum text-fg">
            {resumen.ocupacionBoxes.ocupados}
            <span className="text-fg-muted">/{resumen.ocupacionBoxes.total}</span>
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-border"
            role="progressbar"
            aria-valuenow={Math.round(resumen.ocupacionBoxes.porcentaje)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Ocupación de boxes: ${resumen.ocupacionBoxes.ocupados} de ${resumen.ocupacionBoxes.total}`}
          >
            <div className="h-full bg-accent" style={{ width: `${resumen.ocupacionBoxes.porcentaje}%` }} />
          </div>
        </div>

        <div className="card p-4">
          <p className="label">Alumnos activos</p>
          <p className="font-serif text-2xl tnum text-fg">{resumen.alumnosActivos}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <EvolucionFacturacion puntos={evolucion} />
        </div>

        <div className="card-feature on-feature p-5">
          <h2 className="mb-4 font-serif text-lg">Atención requerida</h2>
          {sinAlertas ? (
            <p className="text-sm">Sin novedades: no hay stock bajo mínimo, mora ni vencimientos sanitarios próximos.</p>
          ) : (
            <ul className="space-y-3.5 text-sm">
              {resumen.alertas.morosidad > 0 && (
                <li>
                  <Link href="/cobranza" className="hover:underline">
                    Mora · {resumen.alertas.morosidad}{' '}
                    {resumen.alertas.morosidad === 1 ? 'cliente' : 'clientes'}
                  </Link>
                  <p className="text-xs tnum text-feature-muted">{formatoDinero(resumen.alertas.deudaVencida)} vencido</p>
                </li>
              )}
              {resumen.alertas.stockBajo > 0 && (
                <li>
                  <Link href="/inventario" className="hover:underline">
                    Insumos bajo mínimo · {resumen.alertas.stockBajo}
                  </Link>
                </li>
              )}
              {resumen.alertas.sanidad > 0 && (
                <li>
                  <Link href="/sanidad" className="hover:underline">
                    Vencimientos sanitarios próximos · {resumen.alertas.sanidad}
                  </Link>
                </li>
              )}
            </ul>
          )}
          <Link href="/reportes" className="btn btn-sec mt-4 w-full">
            Ir a Reportes
          </Link>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
          <h2 className="font-serif text-lg">Cuentas corrientes — mayor saldo</h2>
          <Link href="/cobranza" className="link text-sm">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">Los clientes con mayor saldo pendiente.</caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col" className="num">
                  Saldo
                </th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="tnum">
              {cuentas.map((c) => (
                <tr key={c.cuentaId}>
                  <td className="font-medium">{c.nombre}</td>
                  <td className="num">{formatoDinero(c.saldo)}</td>
                  <td className="num">
                    <Link href={`/cobranza/${c.clienteId}`} className="link text-xs">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {cuentas.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-fg-muted">
                    No hay cuentas con saldo pendiente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
