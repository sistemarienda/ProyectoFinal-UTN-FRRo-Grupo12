import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { FormularioNuevoEvento } from './formularios';

export const metadata: Metadata = { title: 'Eventos' };

export const TIPOS_EVENTO = { torneo: 'Torneo', exposicion: 'Exposición', colonia: 'Colonia', otro: 'Otro' } as const;
export const ESTADOS_EVENTO = { borrador: 'Borrador', abierto: 'Abierto', cerrado: 'Cerrado', realizado: 'Realizado' } as const;
export const BADGE_ESTADO_EVENTO: Record<string, string> = {
  borrador: '',
  abierto: 'badge-accent',
  cerrado: 'badge-ok',
  realizado: 'badge-ok',
};

/**
 * Eventos y torneos (Área 7, M15).
 *
 * `evento` e `inscripcion_evento` ya estaban en el esquema desde las bases de
 * arquitectura; esta es la primera pantalla del establecimiento que los usa
 * -el portal (M13) ya tenía la suya, con el cliente inscribiendo lo propio.
 */
export default async function Eventos() {
  const api = await llamador();
  const [eventos, servicios] = await Promise.all([api.evento.listar(), api.servicio.listar()]);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="font-serif text-2xl">Eventos</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Torneos, exposiciones y colonias: el evento que no aparece acá no tiene dónde anotarse desde
        el portal.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Eventos con su fecha, cupo y estado.</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Tipo</th>
              <th scope="col">Inicia</th>
              <th scope="col" className="num">Cupo</th>
              <th scope="col">Estado</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody className="tnum">
            {eventos.map((e) => (
              <tr key={e.id}>
                <td className="font-medium">
                  <Link href={`/eventos/${e.id}`} className="link">
                    {e.nombre}
                  </Link>
                </td>
                <td>{TIPOS_EVENTO[e.tipo]}</td>
                <td className="text-xs">{new Date(e.inicia_en).toLocaleString('es-AR')}</td>
                <td className="num">{e.cupo == null ? '—' : `${e.ocupados} / ${e.cupo}`}</td>
                <td>
                  <span className={`badge ${BADGE_ESTADO_EVENTO[e.estado]}`}>{ESTADOS_EVENTO[e.estado]}</span>
                </td>
                <td>
                  <Link href={`/eventos/${e.id}`} className="btn btn-sec btn-sm">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-fg-muted">
                  Todavía no hay eventos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-8">
        <FormularioNuevoEvento servicios={servicios.filter((s) => s.activo).map((s) => ({ id: s.id, nombre: s.nombre }))} />
      </section>
    </div>
  );
}
