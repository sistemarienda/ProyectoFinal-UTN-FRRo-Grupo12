import type { Metadata } from 'next';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { partesLocales } from '@/lib/agenda';
import { BotonInscribir, BotonCancelar } from './acciones-clase';

export const metadata: Metadata = { title: 'Agenda de mis alumnos' };

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

function fechaCorta(iso: string) {
  const { fecha } = partesLocales(iso);
  const [, mes, dia] = fecha.split('-');
  const diaSemana = DIAS_CORTOS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
  return { diaSemana, dia, mes, hora: partesLocales(iso).hora };
}

/** El límite para cancelar sin cargo: `diasMinimos` antes de que empiece la clase. */
function fechaLimite(iniciaEn: string, diasMinimos: number) {
  const limite = new Date(new Date(iniciaEn).getTime() - diasMinimos * 86_400_000);
  const { dia, mes } = fechaCorta(limite.toISOString());
  return `${dia}/${mes}`;
}

/**
 * Agenda del portal (M13): las clases de los alumnos propios, inscriptas o con
 * cupo libre. Resuelve la ida y vuelta por WhatsApp para inscribir y cancelar
 * (`02-sitemap-por-perfil.md`).
 */
export default async function AgendaDelPortal({ searchParams }: PageProps<'/portal/agenda'>) {
  const parametros = await searchParams;
  const alumnoId = typeof parametros.alumno === 'string' && parametros.alumno !== '' ? parametros.alumno : undefined;

  const api = await llamador();
  const { alumnos, diasMinimos, propias, abiertas } = await api.portal.agenda({ alumnoId });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl text-fg">Agenda</h1>
        <p className="text-sm text-fg-muted">Las clases de tus alumnos, con lo que hay para anotarse.</p>
      </div>

      {/* Botones y no enlaces: el chip se marca con `aria-pressed`, que es de botón. */}
      {alumnos.length > 1 && (
        <form method="get" className="flex flex-wrap gap-1.5" aria-label="Filtrar por alumno">
          <button type="submit" name="alumno" value="" className="chip" aria-pressed={!alumnoId}>
            Todos
          </button>
          {alumnos.map((a) => (
            <button key={a.id} type="submit" name="alumno" value={a.id} className="chip" aria-pressed={alumnoId === a.id}>
              {a.nombre}
            </button>
          ))}
        </form>
      )}

      <ul className="space-y-2">
        {propias.map((p) => {
          const f = fechaCorta(p.clase.inicia_en);
          return (
            <li key={p.inscripcionId} className="card p-3">
              <div className="flex items-start gap-3">
                <span className="rounded-lg px-2 py-1 text-center shrink-0 bg-accent-soft text-accent-ink">
                  <span className="block text-[10px] uppercase">{f.diaSemana}</span>
                  <span className="block font-serif text-lg tnum leading-none">{f.dia}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-fg">
                    {p.clase.servicio?.nombre ?? 'Clase'}
                    {p.clase.nivel ? ` · ${p.clase.nivel.replace('_', ' ')}` : ''}
                  </span>
                  <span className="block text-xs text-fg-muted tnum">
                    {f.hora} · {[p.clase.instalacion?.nombre, [p.clase.instructor?.persona?.nombre, p.clase.instructor?.persona?.apellido].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                  </span>
                  {alumnos.length > 1 && <span className="block text-xs text-fg-muted mt-0.5">{p.alumno}</span>}
                </span>
                <span className="badge badge-ok">
                  <CheckCircle aria-hidden="true" /> Inscripto
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <BotonCancelar inscripcionId={p.inscripcionId} enTermino={p.enTermino} diasMinimos={diasMinimos} />
                {p.enTermino && (
                  <span className="text-xs text-fg-muted">Hasta el {fechaLimite(p.clase.inicia_en, diasMinimos)}</span>
                )}
              </div>
            </li>
          );
        })}

        {abiertas.map((a) => {
          const f = fechaCorta(a.clase.inicia_en);
          return (
            <li key={`${a.clase.id}-${a.alumnoId}`} className="card p-3">
              <div className="flex items-start gap-3">
                <span className="rounded-lg px-2 py-1 text-center shrink-0 border border-surface-border text-fg-muted">
                  <span className="block text-[10px] uppercase">{f.diaSemana}</span>
                  <span className="block font-serif text-lg tnum leading-none">{f.dia}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-fg">
                    {a.clase.servicio?.nombre ?? 'Clase'}
                    {a.clase.nivel ? ` · ${a.clase.nivel.replace('_', ' ')}` : ''}
                  </span>
                  <span className="block text-xs text-fg-muted tnum">{f.hora} · {a.clase.instalacion?.nombre}</span>
                  {alumnos.length > 1 && <span className="block text-xs text-fg-muted mt-0.5">{a.alumno}</span>}
                </span>
              </div>
              <BotonInscribir claseId={a.clase.id} alumnoId={a.alumnoId} alumno={a.alumno} />
            </li>
          );
        })}

        {propias.length === 0 && abiertas.length === 0 && (
          <li className="card p-6 text-center text-sm text-fg-muted">
            No hay clases inscriptas ni con cupo libre en las próximas semanas.
          </li>
        )}
      </ul>
    </div>
  );
}
