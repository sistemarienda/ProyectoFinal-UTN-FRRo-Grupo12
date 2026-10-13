import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { ZONA_HARAS, partesLocales } from '@/lib/agenda';
import { tramoActual } from '@/lib/clima';
import { obtenerPronostico } from '@/server/clima';
import { ClimaDeLaClase } from '../../clima';
import { BotonCancelarInscripcion, FormularioInscribir } from './inscripciones';
import { FormularioModificar, FormularioSuspender } from './formularios-clase';

export const metadata: Metadata = { title: 'Clase' };

const NIVEL_TEXTO = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

/**
 * Las marcas de tiempo se muestran en hora del haras y no en la del servidor.
 * `toLocaleString` sin `timeZone` usa la del proceso, que en Vercel es UTC: una
 * cancelación de las 22:40 aparecía como del día siguiente a la 01:40.
 */
function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA_HARAS });
}

function fechaYHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: ZONA_HARAS,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const ESTADO = {
  programada: { texto: 'Programada', badge: 'badge-accent' },
  dictada: { texto: 'Dictada', badge: 'badge-ok' },
  cancelada: { texto: 'Suspendida', badge: 'badge-bad' },
} as const;

export default async function DetalleDeClase({ params }: PageProps<'/agenda/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let detalle;
  try {
    detalle = await api.clase.detalle({ claseId: id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const [instructores, instalaciones, pronostico] = await Promise.all([
    api.usuario.instructores(),
    api.instalacion.listar(),
    obtenerPronostico(),
  ]);

  const { clase, cupo, inscripciones, candidatos, caballos } = detalle;
  const cuando = partesLocales(clase.inicia_en);
  const climaDeLaClase =
    clase.estado === 'programada' && pronostico ? tramoActual(pronostico.tramos, clase.inicia_en) : null;
  const estado = ESTADO[clase.estado];
  const esIndividual = clase.servicio?.modalidad === 'individual';

  const fechaLarga = new Date(`${cuando.fecha}T12:00:00Z`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  const activas = inscripciones.filter((i) => i.estado === 'inscripto');
  const canceladas = inscripciones.filter((i) => i.estado === 'cancelado');

  const bloqueo =
    clase.estado === 'cancelada'
      ? 'La clase está suspendida: no admite inscripciones.'
      : clase.estado === 'dictada'
        ? 'La clase ya se dictó: no admite inscripciones.'
        : cupo.completo
          ? esIndividual
            ? 'Es una clase individual y ya tiene su alumno.'
            : `La clase está completa: ${cupo.ocupados} de ${cupo.limite}.`
          : null;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
        <Link href="/agenda" className="hover:underline">Enseñanza · Agenda</Link>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl text-fg">{clase.servicio?.nombre ?? 'Clase'}</h1>
        <span className={`badge ${estado.badge}`}>{estado.texto}</span>
        {clase.estado !== 'cancelada' && (
          <Link href={`/agenda/${clase.id}/asistencia`} className="btn btn-sec btn-sm ml-auto">
            {clase.estado === 'dictada' ? 'Ver la asistencia' : 'Tomar asistencia'}
          </Link>
        )}
      </div>
      <p className="mt-1 text-fg-muted first-letter:uppercase">
        {fechaLarga} · {cuando.hora} · {clase.duracion_min} minutos
      </p>

      {clase.estado === 'cancelada' && clase.motivo_suspension && (
        <p className="mt-3 text-sm text-bad">Motivo de la suspensión: {clase.motivo_suspension}</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="label">Instructor</p>
          <p className="text-sm font-medium text-fg">
            {[clase.instructor?.persona?.nombre, clase.instructor?.persona?.apellido]
              .filter(Boolean)
              .join(' ') || '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Instalación</p>
          <p className="text-sm font-medium text-fg">{clase.instalacion?.nombre ?? '—'}</p>
        </div>
        <div className="card p-4">
          <p className="label">Modalidad</p>
          <p className="text-sm font-medium text-fg">{esIndividual ? 'Individual' : 'Grupal'}</p>
        </div>
        <div className="card p-4">
          <p className="label">Cupo</p>
          <p className="font-serif text-2xl tnum text-fg">
            {cupo.limite === null ? cupo.ocupados : `${cupo.ocupados}/${cupo.limite}`}
          </p>
          <p className="helper">
            {cupo.limite === null
              ? 'Sin control de cupo'
              : `${cupo.disponibles} ${cupo.disponibles === 1 ? 'disponible' : 'disponibles'}`}
          </p>
        </div>
      </div>

      {climaDeLaClase && <ClimaDeLaClase tramo={climaDeLaClase} />}

      {clase.nivel && (
        <p className="mt-3 text-sm text-fg-muted">
          Nivel sugerido: {NIVEL_TEXTO[clase.nivel]}. Orienta a quién inscribir, no restringe.
        </p>
      )}

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-serif text-lg text-fg">Inscriptos</h2>
          <p className="helper">
            El caballo indicado es el <strong>previsto</strong> al inscribir. El efectivamente
            montado se registra al tomar asistencia.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">Alumnos inscriptos en la clase, con su caballo previsto.</caption>
            <thead>
              <tr>
                <th scope="col">Alumno</th>
                <th scope="col">Nivel</th>
                <th scope="col">Caballo previsto</th>
                <th scope="col">Inscripto</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {activas.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium text-fg">
                    {[i.alumno?.persona?.nombre, i.alumno?.persona?.apellido].filter(Boolean).join(' ')}
                    {!i.conContratoVigente && (
                      <span className="badge badge-warn ml-2" title="La clase se dictaría sin respaldo contractual.">
                        Sin contrato
                      </span>
                    )}
                  </td>
                  <td>{i.alumno?.nivel ? NIVEL_TEXTO[i.alumno.nivel] : '—'}</td>
                  <td>{i.caballo?.nombre ?? 'Sin asignar'}</td>
                  <td className="text-xs">{fechaCorta(i.inscripto_en)}</td>
                  <td>
                    {clase.estado === 'programada' && (
                      <BotonCancelarInscripcion claseId={clase.id} inscripcionId={i.id} />
                    )}
                  </td>
                </tr>
              ))}
              {activas.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-fg-muted">
                    Todavía no hay nadie inscripto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-surface-border px-5 py-4">
          <FormularioInscribir
            claseId={clase.id}
            candidatos={candidatos}
            caballos={caballos}
            bloqueado={bloqueo !== null}
            motivoBloqueo={bloqueo}
          />
        </div>
      </section>

      {canceladas.length > 0 && (
        <section className="card mt-6 overflow-hidden">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-serif text-lg text-fg">Cancelaciones</h2>
            <p className="helper">
              Se conservan para evaluar la antelación del aviso, que define la imputación de la
              clase. El establecimiento requiere avisar con {detalle.diasMinimos} días.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <caption className="sr-only">Inscripciones canceladas de esta clase.</caption>
              <thead>
                <tr>
                  <th scope="col">Alumno</th>
                  <th scope="col">Canceló</th>
                  <th scope="col">Antelación</th>
                </tr>
              </thead>
              <tbody>
                {canceladas.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {[i.alumno?.persona?.nombre, i.alumno?.persona?.apellido].filter(Boolean).join(' ')}
                    </td>
                    <td className="text-xs">
                      {i.cancelado_en ? fechaYHora(i.cancelado_en) : '—'}
                    </td>
                    <td>
                      {i.enTermino === false ? (
                        <span className="badge badge-warn">Fuera de término</span>
                      ) : (
                        <span className="text-xs text-fg-muted">En término</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {clase.estado === 'programada' && (
        <div className="mt-6 grid gap-3">
          <FormularioModificar
            clase={{
              claseId: clase.id,
              instructorId: clase.instructor?.id ?? '',
              instalacionId: clase.instalacion?.id ?? '',
              fecha: cuando.fecha,
              hora: cuando.hora,
              duracionMin: clase.duracion_min,
              cupo: clase.cupo,
              nivel: clase.nivel,
              esIndividual,
            }}
            instructores={instructores}
            instalaciones={instalaciones
              .filter((i) => i.activo && (i.tipo === 'pista' || i.tipo === 'picadero'))
              .map((i) => ({ id: i.id, nombre: i.nombre }))}
          />
          <FormularioSuspender claseId={clase.id} />
        </div>
      )}
    </div>
  );
}
