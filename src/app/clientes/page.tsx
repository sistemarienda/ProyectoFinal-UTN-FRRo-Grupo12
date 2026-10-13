import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { fechaCorta } from '@/lib/fechas';

export const metadata: Metadata = { title: 'Clientes y contratos' };

/** Pantalla 8 del prototipo: padrón de clientes con el aviso de contratos por vencer. */
export default async function Clientes() {
  const api = await llamador();
  const [clientes, porVencer] = await Promise.all([
    api.cliente.listar(),
    api.contrato.porVencer({ dentroDeDias: 30 }),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Clientes</p>
          <h1 className="font-serif text-3xl text-fg">Clientes y contratos</h1>
          <p className="mt-1 text-fg-muted">
            Clientes con cuenta corriente y sus contratos vigentes.
          </p>
        </div>
        <Link href="/clientes/nuevo" className="btn btn-pri">
          <Plus size={16} aria-hidden="true" />
          Nuevo cliente
        </Link>
      </div>

      {porVencer.length > 0 && (
        <div className="card-accent mt-6 p-4">
          <p className="flex items-center gap-2 font-medium text-fg">
            <WarningCircle size={18} className="text-accent-ink" aria-hidden="true" />
            {porVencer.length} {porVencer.length === 1 ? 'contrato vence' : 'contratos vencen'} dentro
            de los próximos 30 días
          </p>
          <ul className="mt-2 space-y-1 text-sm text-fg-muted">
            {porVencer.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.cliente?.id}`} className="link">
                  {c.cliente?.tipo === 'persona_juridica'
                    ? c.cliente.razon_social
                    : `${c.cliente?.persona?.apellido}, ${c.cliente?.persona?.nombre}`}
                </Link>{' '}
                · {c.servicio?.nombre} · vence {c.fecha_fin ? fechaCorta(c.fecha_fin) : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="tbl min-w-[720px]">
          <caption className="sr-only">Padrón de clientes con lo que cada uno tiene enganchado.</caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Tipo</th>
              <th scope="col" className="num">Contratos</th>
              <th scope="col" className="num">Caballos</th>
              <th scope="col" className="num">Alumnos</th>
              <th scope="col">Canal</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {clientes.map((c) => (
              <tr key={c.id} className={c.activo ? '' : 'text-fg-muted'}>
                <td>
                  <Link href={`/clientes/${c.id}`} className="font-medium text-fg hover:text-accent-ink">
                    {c.nombre}
                  </Link>
                </td>
                <td className="text-xs">{c.tipo === 'persona_juridica' ? 'Jurídica' : 'Física'}</td>
                <td className="num">{c.contratos}</td>
                <td className="num">{c.caballos}</td>
                <td className="num">{c.alumnos}</td>
                <td className="text-xs">{c.canalPreferido === 'whatsapp' ? 'WhatsApp' : 'Correo'}</td>
                <td>
                  <span className={`badge ${c.activo ? 'badge-ok' : ''}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-fg-muted">
                  Todavía no hay clientes cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
