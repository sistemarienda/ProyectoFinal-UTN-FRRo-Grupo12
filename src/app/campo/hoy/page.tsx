import type { Metadata } from 'next';
import Link from 'next/link';
import { BowlFood, Broom, CaretRight, FirstAidKit, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { esAdministrador } from '@/lib/roles';
import { MOMENTO_TEXTO, tipoEnTexto } from '@/lib/bienestar';
import { partesLocales } from '@/lib/agenda';
import { tramoActual } from '@/lib/clima';
import { obtenerPronostico } from '@/server/clima';
import { ClimaDeHoy } from '../../clima';

export const metadata: Metadata = { title: 'Mi jornada' };

/**
 * Pantalla 10 del sitemap · «Hoy / Mi jornada».
 *
 * Es el inicio del peón y del instructor (`INICIO_POR_ROL`), y hasta ahora
 * apuntaba a una ruta que no existía: el rol podía entrar al sistema y caer en
 * un 404. Esta pantalla la crea M9 con la parte que le toca -las tareas de
 * cuidado del turno y los vencimientos sanitarios-; la agenda del día que el
 * sitemap le asigna es de M7 y ya está construida, así que se enlaza.
 *
 * La barra inferior con la cola de sincronización es de M14 y no está: hasta
 * entonces, todo lo que se registra acá va directo al servidor.
 */
export default async function MiJornada() {
  const api = await llamador();
  const [quien, turno, sanidad, pronostico] = await Promise.all([
    api.quienSoy(),
    api.registroCuidado.tareasDelTurno(),
    api.eventoSanitario.alertas(),
    obtenerPronostico(),
  ]);

  const ahora = new Date();
  const climaAhora = pronostico ? tramoActual(pronostico.tramos, ahora) : null;
  const climaDeHoy = pronostico?.dias.find((d) => d.fecha === partesLocales(ahora).fecha) ?? null;

  const vencidos = sanidad.alertas.filter((a) => a.estado === 'vencido').length;
  const hoy = ahora.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:p-8">
      <div className="card-feature on-feature p-5">
        <p className="text-xs uppercase tracking-wide text-feature-muted first-letter:uppercase">
          {hoy}
        </p>
        <h1 className="font-serif text-2xl text-feature-fg">
          {quien.nombre ? `Hola, ${quien.nombre}` : 'Mi jornada'}
        </h1>
        <p className="tnum mt-1 text-sm text-feature-muted">
          Toma de la {MOMENTO_TEXTO[turno.momento]} ·{' '}
          {turno.pendientes === 0
            ? 'todo registrado'
            : `${turno.pendientes} ${turno.pendientes === 1 ? 'caballo' : 'caballos'} por servir`}
        </p>
        <ClimaDeHoy ahora={climaAhora} dia={climaDeHoy} />
      </div>

      <h2 className="mt-6 font-serif text-lg">Tareas</h2>
      <ul className="mt-2 space-y-2">
        <Tarea
          href="/campo/alimentacion"
          icono={<BowlFood size={22} aria-hidden="true" />}
          titulo="Alimentación"
          detalle={
            turno.pendientes === 0
              ? `La toma de la ${MOMENTO_TEXTO[turno.momento]} está completa`
              : `${turno.pendientes} por servir en la ${MOMENTO_TEXTO[turno.momento]}`
          }
          pendiente={turno.pendientes > 0}
        />
        <Tarea
          href="/campo/higiene"
          icono={<Broom size={22} aria-hidden="true" />}
          titulo="Higiene de boxes"
          detalle="Limpieza y reposición de cama"
        />
        <Tarea
          href="/caballos"
          icono={<FirstAidKit size={22} aria-hidden="true" />}
          titulo="Caballos"
          detalle="Ficha, plan alimentario e historial sanitario"
        />
      </ul>

      {sanidad.alertas.length > 0 && (
        <>
          <h2 className="mt-6 flex items-center gap-2 font-serif text-lg">
            Sanidad
            {vencidos > 0 && <span className="badge badge-bad">{vencidos} vencidos</span>}
          </h2>
          <p className="helper mt-1">
            Avisos con {sanidad.diasDeAviso} días de anticipación.
          </p>

          <ul className="mt-2 space-y-2">
            {sanidad.alertas.slice(0, 6).map((a) => (
              <li key={`${a.caballoId}-${a.tipo}`} className="card flex items-center gap-3 p-3">
                <WarningCircle
                  size={20}
                  weight="fill"
                  className={a.estado === 'vencido' ? 'text-bad' : 'text-warn'}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.caballoNombre ?? 'Caballo'}</p>
                  <p className="tnum text-sm text-muted">
                    {tipoEnTexto(a.tipo)} ·{' '}
                    {a.diasRestantes < 0
                      ? `vencida hace ${Math.abs(a.diasRestantes)} días`
                      : a.diasRestantes === 0
                        ? 'vence hoy'
                        : `en ${a.diasRestantes} días`}
                  </p>
                </div>
                <Link href={`/caballos/${a.caballoId}`} className="btn btn-gho btn-sm">
                  Ver
                </Link>
              </li>
            ))}
          </ul>

          {esAdministrador(quien.rol) && (
            <Link href="/sanidad" className="btn btn-sec btn-sm mt-3">
              Ir al cronograma sanitario
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function Tarea({
  href,
  icono,
  titulo,
  detalle,
  pendiente,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  pendiente?: boolean;
}) {
  return (
    <li>
      <Link href={href} className="card flex items-center gap-3 p-4 hover:no-underline">
        <span className="ic" aria-hidden="true">
          {icono}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">
            {titulo}
            {pendiente && <span className="badge badge-warn ml-2">pendiente</span>}
          </span>
          <span className="block text-sm text-muted">{detalle}</span>
        </span>
        <CaretRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}
