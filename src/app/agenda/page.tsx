import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { ZONA_HARAS, armarGrilla, partesLocales, semanaCorrida, semanaDe } from '@/lib/agenda';
import { obtenerPronostico } from '@/server/clima';
import { ClimaDelDia } from '../clima';
import { FormularioDeClase } from './formulario-clase';

export const metadata: Metadata = { title: 'Agenda de clases' };

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

const NIVEL_TEXTO = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

function tituloDeSemana(dias: readonly string[]): string {
  const primero = dias.at(0);
  const ultimo = dias.at(5);
  if (!primero || !ultimo) return 'Semana';

  const dia = (fecha: string) => Number(fecha.slice(8, 10));
  const mes = (fecha: string) =>
    new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' });

  return mes(primero) === mes(ultimo)
    ? `Semana ${dia(primero)}–${dia(ultimo)} ${mes(ultimo)}`
    : `Semana ${dia(primero)} ${mes(primero)} – ${dia(ultimo)} ${mes(ultimo)}`;
}

/**
 * Agenda semanal (M7).
 *
 * La grilla es la del prototipo (`fase2/agenda.html`) y usa sus mismas clases de
 * componente. Hay una diferencia deliberada en la leyenda: el prototipo reserva
 * el rojo para el «conflicto de recurso», y en el sistema construido ese estado
 * no puede existir —las dos restricciones de exclusión de la base lo impiden al
 * guardar—, así que el rojo pasa a señalar la clase suspendida, que sí ocurre y
 * también hay que ver de un vistazo.
 */
export default async function Agenda({ searchParams }: PageProps<'/agenda'>) {
  const parametros = await searchParams;
  const semanaPedida = typeof parametros.semana === 'string' ? parametros.semana : undefined;
  const instalacionId = typeof parametros.instalacion === 'string' ? parametros.instalacion : undefined;
  const instructorId = typeof parametros.instructor === 'string' ? parametros.instructor : undefined;

  const api = await llamador();
  const [agenda, instalaciones, instructores, servicios, pronostico] = await Promise.all([
    api.clase.semanal({ referencia: semanaPedida, instalacionId, instructorId }),
    api.instalacion.listar(),
    api.usuario.instructores(),
    api.servicio.listar(),
    obtenerPronostico(),
  ]);
  const climaPorFecha = new Map((pronostico?.dias ?? []).map((d) => [d.fecha, d]));
  const hayClimaEnLaSemana = agenda.dias.some((f) => climaPorFecha.has(f));

  const referencia = semanaPedida ?? semanaDe(new Date()).dias[0] ?? '';
  const filas = armarGrilla(agenda.clases, agenda.dias, (c) => c.inicia_en);

  // El domingo sólo ocupa una columna si ese domingo hay algo: el haras trabaja
  // de lunes a sábado, pero una clase cargada en domingo no se puede esconder.
  const hayDomingo = agenda.clases.some(
    (c) => partesLocales(c.inicia_en).fecha === agenda.dias.at(6),
  );
  const columnas = agenda.dias.slice(0, hayDomingo ? 7 : 6);

  const enlaceDeSemana = (delta: number) => {
    const destino = new URLSearchParams();
    destino.set('semana', semanaCorrida(`${referencia}T12:00:00.000Z`, delta));
    if (instalacionId) destino.set('instalacion', instalacionId);
    if (instructorId) destino.set('instructor', instructorId);
    return `/agenda?${destino.toString()}`;
  };

  const pistas = instalaciones.filter((i) => i.activo && (i.tipo === 'pista' || i.tipo === 'picadero'));
  const serviciosDeClase = servicios
    .filter((s) => s.activo && s.modalidad != null)
    .map((s) => ({ id: s.id, nombre: s.nombre, modalidad: s.modalidad }));

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Enseñanza</p>
      <h1 className="font-serif text-3xl text-fg">Agenda de clases</h1>
      <p className="mt-1 text-fg-muted">
        Grilla semanal de clases programadas, con su instalación, instructor y ocupación.
      </p>

      <div className="mt-6">
        <FormularioDeClase
          servicios={serviciosDeClase}
          instructores={instructores}
          instalaciones={pistas.map((i) => ({ id: i.id, nombre: i.nombre }))}
          fechaSugerida={agenda.dias.at(0) ?? referencia}
        />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl text-fg">{tituloDeSemana(agenda.dias)}</h2>
            <div className="flex gap-1">
              <Link href={enlaceDeSemana(-1)} className="nav-btn" aria-label="Semana anterior">
                <CaretLeft size={14} aria-hidden="true" />
              </Link>
              <Link href={enlaceDeSemana(1)} className="nav-btn" aria-label="Semana siguiente">
                <CaretRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <form className="flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="semana" value={referencia} />
            <label className="block">
              <span className="label">Pista</span>
              <select name="instalacion" defaultValue={instalacionId ?? ''} className="input py-1.5 text-sm">
                <option value="">Todas</option>
                {pistas.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Instructor</span>
              <select name="instructor" defaultValue={instructorId ?? ''} className="input py-1.5 text-sm">
                <option value="">Todos</option>
                {instructores.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-sec btn-sm">Filtrar</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          {/*
            `table-fixed` reparte el ancho en columnas iguales. Sin eso el día
            que tiene clases se estira y se come a los vacíos, y la semana deja
            de leerse como una grilla: la única columna ancha es la que tiene
            algo, que es exactamente la información que el ancho no debería
            estar transmitiendo.
          */}
          <table className="w-full min-w-[820px] table-fixed border-collapse">
            <caption className="sr-only">
              Grilla semanal de clases por hora y día. Cada clase enlaza a su detalle, con los
              alumnos inscriptos.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-14"><span className="sr-only">Hora</span></th>
                {columnas.map((fecha, i) => {
                  const clima = climaPorFecha.get(fecha);
                  return (
                    <th
                      key={fecha}
                      scope="col"
                      className="border-l border-surface-border px-3 py-2 text-center text-sm font-medium"
                    >
                      {DIAS_CORTOS[i]} <span className="text-fg-muted">{Number(fecha.slice(8, 10))}</span>
                      {clima && <ClimaDelDia dia={clima} />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.franja}>
                  <th
                    scope="row"
                    className="border-t border-surface-border px-2 py-3 text-right align-top text-xs font-normal text-fg-muted"
                  >
                    {fila.franja}
                  </th>
                  {columnas.map((fecha, i) => (
                    <td key={fecha} className="cell align-top">
                      {(fila.celdas[i] ?? []).map((c) => {
                        const suspendida = c.estado === 'cancelada';
                        const individual = c.servicio?.modalidad === 'individual';
                        const estilo = suspendida
                          ? 'ev-warn'
                          : individual
                            ? 'ev-dark on-feature'
                            : 'ev-cls';

                        return (
                          <Link
                            key={c.id}
                            href={`/agenda/${c.id}`}
                            className={`ev ${estilo} mb-1 block no-underline`}
                          >
                            <p className="font-semibold">
                              {c.servicio?.nombre ?? 'Clase'}
                              {c.nivel ? ` · ${NIVEL_TEXTO[c.nivel]}` : ''}
                            </p>
                            <p className={individual && !suspendida ? 'text-feature-muted' : 'text-fg-muted'}>
                              {partesLocales(c.inicia_en).hora} ·{' '}
                              {[c.instructor?.persona?.nombre, c.instalacion?.nombre]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            <p className={individual && !suspendida ? 'text-feature-muted' : 'text-fg-muted'}>
                              {suspendida
                                ? 'Suspendida'
                                : c.cupoDisponible.limite === null
                                  ? `${c.cupoDisponible.ocupados} inscriptos`
                                  : `${c.cupoDisponible.ocupados}/${c.cupoDisponible.limite}`}
                            </p>
                          </Link>
                        );
                      })}
                    </td>
                  ))}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={columnas.length + 1} className="py-8 text-center text-fg-muted">
                    No hay clases programadas en esta semana.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-4 border-t border-surface-border px-5 py-3 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-accent-soft" style={{ borderLeft: '2px solid var(--accent)' }} />
            Clase grupal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-feature" />
            Clase individual
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded"
              style={{ background: 'var(--bad-bg)', borderLeft: '2px solid var(--bad)' }}
            />
            Suspendida
          </span>
          {hayClimaEnLaSemana && (
            <span>Pronóstico de OpenWeather; en ámbar, lluvia o viento fuerte probables.</span>
          )}
          <span className="ml-auto">Horarios en hora de {ZONA_HARAS.split('/').at(-1)?.replace(/_/g, ' ')}.</span>
        </div>
      </div>

      <OcupacionDeLaSemana desde={agenda.dias.at(0) ?? referencia} hasta={agenda.dias.at(6) ?? referencia} />
    </div>
  );
}

/** Reporte de ocupación de instalaciones (EO), acotado a la semana en pantalla. */
async function OcupacionDeLaSemana({ desde, hasta }: { desde: string; hasta: string }) {
  const api = await llamador();
  const ocupacion = await api.clase.ocupacion({ desde, hasta });

  if (ocupacion.length === 0) return null;

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="font-serif text-lg text-fg">Ocupación de instalaciones</h2>
        <p className="helper">
          Minutos ocupados por instalación en la semana y su participación sobre el total. No
          representa un porcentaje de capacidad.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Ocupación de cada instalación en la semana.</caption>
          <thead>
            <tr>
              <th scope="col">Instalación</th>
              <th scope="col" className="num">Clases</th>
              <th scope="col" className="num">Horas</th>
              <th scope="col" className="num">Participación</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {ocupacion.map((i) => (
              <tr key={i.instalacionId}>
                <td className="font-medium text-fg">{i.nombre}</td>
                <td className="num">{i.clases}</td>
                <td className="num">{(i.minutos / 60).toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
                <td className="num">{i.participacion.toFixed(0)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
