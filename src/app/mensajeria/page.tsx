import type { Metadata } from 'next';
import { llamador } from '@/lib/trpc/servidor';

export const metadata: Metadata = { title: 'Mensajería' };

const NOMBRE_CODIGO: Record<string, string> = {
  aviso_previo_vencimiento: 'Aviso previo al vencimiento',
  recordatorio_pago: 'Aviso de mora',
  confirmacion_clase: 'Confirmación de clase',
  clase_suspendida: 'Clase suspendida',
  aviso_evento: 'Invitación a un evento',
  pago_recibido: 'Acuse de pago recibido',
};

/**
 * Mensajería: entregabilidad y estado de las automatizaciones (M5 + M15).
 *
 * `reporteEntregabilidad` existe desde M5 y nunca había tenido pantalla; el
 * EQ de M15 («Estado de las automatizaciones») es la ocasión de darle una,
 * junto con el detalle por código que M15 sí necesita.
 */
export default async function Mensajeria() {
  const api = await llamador();
  const [entregabilidad, automatizaciones] = await Promise.all([
    api.mensaje.reporteEntregabilidad({ dias: 30 }),
    api.mensaje.estadoDeAutomatizaciones(),
  ]);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="font-serif text-2xl">Mensajería</h1>
      <p className="mt-1 text-sm text-fg-muted">Entregabilidad de los últimos 30 días y qué mandó cada aviso automático.</p>

      <section className="mt-6" aria-labelledby="h-entregabilidad">
        <h2 id="h-entregabilidad" className="font-serif text-lg">
          Entregabilidad
        </h2>
        {entregabilidad.total === 0 ? (
          <p className="card mt-2 p-5 text-sm text-fg-muted">No se envió ningún mensaje en los últimos 30 días.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(entregabilidad.porCanalYEstado).map(([clave, total]) => (
              <div key={clave} className="rounded-lg border border-surface-border p-3">
                <p className="text-xs text-fg-muted">{clave.replace(':', ' · ')}</p>
                <p className="font-serif text-2xl tnum text-fg">{total}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="h-automatizaciones">
        <h2 id="h-automatizaciones" className="font-serif text-lg">
          Estado de las automatizaciones
        </h2>
        <p className="mt-1 text-xs text-fg-muted">
          Confirmación de clase y aviso de suspensión salen al programar o suspender una clase; invitación a un
          evento y acuse de pago, al enviarlos o al acreditarse un pago; los dos avisos de cobranza corren solos
          todos los días (RN-11).
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">Cada aviso automático, su aprobación y su último envío.</caption>
            <thead>
              <tr>
                <th scope="col">Aviso</th>
                <th scope="col">Plantilla</th>
                <th scope="col" className="num">
                  Últimos 30 días
                </th>
                <th scope="col" className="num">
                  Fallidos
                </th>
                <th scope="col">Último envío</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {automatizaciones.map((a) => (
                <tr key={a.codigo}>
                  <td className="font-medium">{NOMBRE_CODIGO[a.codigo] ?? a.codigo}</td>
                  <td>
                    <span className={`badge ${a.estadoAprobacion === 'aprobada' ? 'badge-ok' : ''}`}>
                      {a.estadoAprobacion === 'aprobada' ? 'Aprobada' : 'Meta no la aprobó'}
                    </span>
                  </td>
                  <td className="num">{a.enviosUltimos30Dias}</td>
                  <td className="num">{a.fallidosUltimos30Dias}</td>
                  <td className="text-xs">
                    {a.ultimoEnvio ? new Date(a.ultimoEnvio).toLocaleString('es-AR') : 'Nunca'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
