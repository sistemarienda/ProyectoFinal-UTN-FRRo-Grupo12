import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDots, FilePdf, Trophy, Heart } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { partesLocales } from '@/lib/agenda';
import { TIPO_TEXTO } from '@/lib/bienestar';
import { BotonPagar } from './boton-pagar';

export const metadata: Metadata = { title: 'Mi cuenta' };

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

function formatoDinero(n: number) {
  return `$${Math.abs(n).toLocaleString('es-AR')}`;
}

function formatoFechaHora(iso: string) {
  const { fecha, hora } = partesLocales(iso);
  const [, mes, dia] = fecha.split('-');
  const diaSemana = DIAS_CORTOS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
  return `${diaSemana} ${dia}/${mes} · ${hora}`;
}

/**
 * Mi cuenta (M13, pantalla ancla del portal). Saldo, estado de cuenta del mes,
 * la próxima clase y una novedad para no tener que ir a buscarla a otro lado.
 */
export default async function MiCuenta() {
  const api = await llamador();
  const [cuenta, comprobantes] = await Promise.all([api.portal.cuenta(), api.portal.comprobantes()]);

  const ultimoComprobante = comprobantes.find((c) => c.urlQr);
  const periodoTexto = new Date(`${cuenta.periodo}T12:00:00Z`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-5">
      <div className="card-feature on-feature p-5">
        <p className="text-xs text-feature-muted">Saldo · {periodoTexto}</p>
        <p className="font-serif text-3xl tnum mt-1">{formatoDinero(cuenta.saldo)}</p>
        <div className="mt-4">
          <BotonPagar deshabilitado={cuenta.saldo <= 0} />
        </div>
        {cuenta.saldo <= 0 && <p className="text-xs text-feature-muted mt-2">No tenés saldo pendiente.</p>}
      </div>

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="font-serif text-lg text-fg">Estado de cuenta</h2>
          {ultimoComprobante && (
            <a className="link text-xs" href={ultimoComprobante.urlQr!} target="_blank" rel="noopener noreferrer">
              <FilePdf aria-hidden="true" /> Ver comprobante
            </a>
          )}
        </div>
        <div className="card overflow-hidden text-sm">
          <ul>
            {cuenta.movimientos.map((m) => (
              <li key={m.id} className={`flex justify-between px-4 py-2.5 border-b border-surface-border ${m.tipo === 'pago' ? 'text-ok' : ''}`}>
                <span>{m.concepto}</span>
                <span className="tnum font-medium">
                  {Number(m.importe) < 0 ? '−' : ''}
                  {formatoDinero(Number(m.importe))}
                </span>
              </li>
            ))}
            {cuenta.movimientos.length === 0 && (
              <li className="px-4 py-4 text-center text-fg-muted">Todavía no hay movimientos este mes.</li>
            )}
          </ul>
        </div>
      </section>

      {cuenta.proximaClase && (
        <section>
          <h2 className="font-serif text-lg text-fg mb-1.5">Próxima clase</h2>
          <Link href="/portal/agenda" className="card p-3 text-sm flex items-center gap-3 no-underline">
            <span className="h-9 w-9 rounded-lg grid place-items-center shrink-0 bg-accent-soft text-accent-ink">
              <CalendarDots className="text-lg" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-fg">{formatoFechaHora(cuenta.proximaClase.inicia_en)}</p>
              <p className="text-fg-muted">
                {[cuenta.proximaClase.servicio, cuenta.proximaClase.alumno].filter(Boolean).join(' · ')}
              </p>
            </div>
          </Link>
        </section>
      )}

      {(cuenta.evento || cuenta.novedadCaballo) && (
        <section>
          <h2 className="font-serif text-lg text-fg mb-1.5">Novedades</h2>
          {cuenta.evento ? (
            <Link href="/portal/avisos" className="card-accent p-3 text-sm flex items-start gap-2 no-underline">
              <Trophy className="text-lg mt-0.5 text-accent-ink shrink-0" aria-hidden="true" />
              <span>
                {cuenta.evento.nombre} · {formatoFechaHora(cuenta.evento.inicia_en)}. ¡Inscripciones abiertas!
              </span>
            </Link>
          ) : cuenta.novedadCaballo ? (
            <Link href="/portal/caballos" className="card-accent p-3 text-sm flex items-start gap-2 no-underline">
              <Heart className="text-lg mt-0.5 text-accent-ink shrink-0" aria-hidden="true" />
              <span>
                {cuenta.novedadCaballo.caballo}: {TIPO_TEXTO[cuenta.novedadCaballo.tipo as keyof typeof TIPO_TEXTO] ?? 'Novedad'}.
              </span>
            </Link>
          ) : null}
        </section>
      )}
    </div>
  );
}
