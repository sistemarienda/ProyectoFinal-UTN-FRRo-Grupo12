import type { Metadata } from 'next';
import Link from 'next/link';
import { Horse, Heart, FirstAid, ChatCircle } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { TIPO_TEXTO } from '@/lib/bienestar';

export const metadata: Metadata = { title: 'Mis caballos' };

function fechaCorta(iso: string) {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Mis caballos (M13). Alcance confirmado con el dueño (`04-wireframes.md`
 * § 7.2): estado sanitario y novedades de cuidado, sin costos ni el registro
 * operativo completo —eso queda en `/portal` (cuenta) y en el trabajo diario
 * del peón, que el propietario no necesita auditar.
 */
export default async function MisCaballos() {
  const api = await llamador();
  const caballos = await api.portal.caballos();

  if (caballos.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-fg-muted">
        No tenés caballos en pensión en el haras.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl text-fg">Mis caballos</h1>
      </div>

      {caballos.map((c) => (
        <section key={c.id} className="card overflow-hidden">
          <div className="card-feature on-feature p-4">
            <p className="text-xs uppercase tracking-wide text-feature-muted">Tu caballo</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="h-12 w-12 rounded-xl grid place-items-center shrink-0 text-accent" style={{ background: 'rgba(255,255,255,.10)' }}>
                <Horse className="text-2xl" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-serif text-2xl">{c.nombre}</h2>
                <p className="text-sm text-feature-muted">
                  {[c.instalacion?.nombre, c.fecha_ingreso ? `en pensión desde ${c.fecha_ingreso.slice(0, 4)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {c.alerta ? (
              <div className="card p-4" role="alert" style={{ borderColor: 'var(--warn)' }}>
                <div className="flex items-start gap-2">
                  <FirstAid className="text-lg text-warn shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="font-serif text-lg">En tratamiento</h3>
                    <p className="text-sm text-fg-muted mt-1">
                      {c.alerta.observaciones ?? `Última atención: ${TIPO_TEXTO[c.alerta.tipo as keyof typeof TIPO_TEXTO]}.`}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-2 text-sm border-t border-surface-border pt-3">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">Atención</dt>
                    <dd className="font-medium tnum">{fechaCorta(c.alerta.fecha)}</dd>
                  </div>
                  {c.alerta.proxima_fecha && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">Próximo control</dt>
                      <dd className="font-medium tnum">{fechaCorta(c.alerta.proxima_fecha)}</dd>
                    </div>
                  )}
                </dl>
                <div className="card-feature on-feature p-3 mt-3">
                  <p className="text-sm text-feature-muted">
                    <ChatCircle className="text-accent" aria-hidden="true" /> ¿Querés hablarlo? Escribile al haras.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card p-4">
                <div className="flex items-center gap-2">
                  <Heart className="text-lg text-ok" aria-hidden="true" />
                  <h3 className="font-serif text-lg">Está bien</h3>
                </div>
              </div>
            )}

            {c.novedades.length > 0 && (
              <section>
                <h3 className="label">Novedades</h3>
                <ul className="space-y-2">
                  {c.novedades.map((n, i) => (
                    <li key={i} className="card p-3 flex items-start gap-3">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-fg">
                          {n.tipo === 'alimentacion' ? 'Cambio en el plan alimentario' : TIPO_TEXTO[n.subtipo as keyof typeof TIPO_TEXTO]}
                        </span>
                        {n.detalle && <span className="block text-xs text-fg-muted">{n.detalle}</span>}
                        <span className="block text-xs text-fg-muted tnum">{fechaCorta(n.fecha)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="helper text-center">
              Los importes de veterinaria y herrado están en <Link className="link" href="/portal">tu cuenta</Link>.
            </p>
          </div>
        </section>
      ))}
    </div>
  );
}
