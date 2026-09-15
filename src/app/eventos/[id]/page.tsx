import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { ESTADOS_EVENTO, BADGE_ESTADO_EVENTO, TIPOS_EVENTO } from '../page';
import { FormularioModificarEvento, FormularioInscribir, FormularioEnviarInvitacion } from './formularios';

export const metadata: Metadata = { title: 'Evento' };

const ESTADO_INSCRIPCION = { inscripto: 'Inscripto', cancelado: 'Cancelado', participo: 'Participó' } as const;

export default async function DetalleEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await llamador();

  let datos;
  try {
    datos = await api.evento.detalle({ eventoId: id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const [servicios, clientes, alumnos, caballos] = await Promise.all([
    api.servicio.listar(),
    api.cliente.listar(),
    api.alumno.listar(),
    api.caballo.listar(),
  ]);

  const { evento, inscripciones } = datos;
  const activas = inscripciones.filter((i) => i.estado === 'inscripto');

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <Link href="/eventos" className="link text-sm">
        ← Eventos
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl">{evento.nombre}</h1>
        <span className={`badge ${BADGE_ESTADO_EVENTO[evento.estado]}`}>{ESTADOS_EVENTO[evento.estado]}</span>
      </div>
      <p className="mt-1 text-sm text-fg-muted">
        {TIPOS_EVENTO[evento.tipo]} · {new Date(evento.inicia_en).toLocaleString('es-AR')}
        {evento.cupo != null && ` · Cupo: ${activas.length} / ${evento.cupo}`}
        {evento.servicio && ` · Se cobra como ${evento.servicio.nombre}`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <FormularioModificarEvento
          evento={evento}
          servicios={servicios.filter((s) => s.activo).map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
        {evento.estado === 'abierto' && <FormularioEnviarInvitacion eventoId={evento.id} />}
      </div>

      <section className="mt-6" aria-labelledby="h-inscriptos">
        <h2 id="h-inscriptos" className="font-serif text-lg">
          Inscriptos
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">Quién está anotado en el evento.</caption>
            <thead>
              <tr>
                <th scope="col">Familia</th>
                <th scope="col">Alumno</th>
                <th scope="col">Caballo</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((i) => (
                <tr key={i.id} className={i.estado === 'cancelado' ? 'text-fg-muted' : ''}>
                  <td>
                    {i.cliente?.tipo === 'persona_juridica'
                      ? i.cliente.razon_social
                      : [i.cliente?.persona?.apellido, i.cliente?.persona?.nombre].filter(Boolean).join(', ')}
                  </td>
                  <td>
                    {i.alumno ? [i.alumno.persona?.nombre, i.alumno.persona?.apellido].filter(Boolean).join(' ') : '—'}
                  </td>
                  <td>{i.caballo?.nombre ?? '—'}</td>
                  <td>
                    <span className="badge">{ESTADO_INSCRIPCION[i.estado]}</span>
                  </td>
                </tr>
              ))}
              {inscripciones.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-fg-muted">
                    Todavía no hay nadie anotado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {evento.estado === 'abierto' && (
        <section className="mt-6">
          <FormularioInscribir eventoId={evento.id} clientes={clientes} alumnos={alumnos} caballos={caballos} />
        </section>
      )}
    </div>
  );
}
