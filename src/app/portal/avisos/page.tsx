import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, WhatsappLogo, EnvelopeSimple, Check, Checks, Users, Bell } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { BotonInscribirEvento } from './boton-inscribir-evento';

export const metadata: Metadata = { title: 'Novedades y avisos' };

const ASUNTO_TEXTO: Record<string, string> = {
  estado_cuenta: 'Estado de cuenta',
  aviso_previo_vencimiento: 'Aviso de vencimiento próximo',
  recordatorio_pago: 'Recordatorio de pago',
  pago_recibido: 'Pago recibido',
  confirmacion_clase: 'Confirmación de clase',
  clase_suspendida: 'Clase suspendida',
  aviso_evento: 'Aviso de evento',
  aviso_institucional: 'Aviso del haras',
};

const ESTADO_TEXTO: Record<string, string> = {
  pendiente: 'En camino',
  enviado: 'Enviado',
  entregado: 'Entregado',
  leido: 'Leído',
  fallido: 'No se pudo entregar',
};

const TIPO_EVENTO_TEXTO: Record<string, string> = {
  torneo: 'Torneo',
  exposicion: 'Exposición',
  colonia: 'Colonia',
  otro: 'Evento',
};

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Novedades y avisos (M13): lo que ya se le envió por WhatsApp, de respaldo. */
export default async function NovedadesYAvisos() {
  const api = await llamador();
  const { mensajes, alumnos, caballos, eventos } = await api.portal.avisos();

  const eventoConCupo = eventos.find((e) => e.cupo == null || e.inscriptos < e.cupo);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl text-fg">Novedades</h1>

      {eventoConCupo && (
        <section className="card-accent p-4">
          <div className="flex items-start gap-2">
            <Trophy className="text-xl text-accent-ink shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-lg">{eventoConCupo.nombre}</h2>
              <p className="text-sm text-fg-muted mt-1 tnum">
                {TIPO_EVENTO_TEXTO[eventoConCupo.tipo]} · {fechaHora(eventoConCupo.inicia_en)}
              </p>
              {eventoConCupo.cupo != null && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="badge badge-warn">
                    <Users aria-hidden="true" /> {eventoConCupo.cupo - eventoConCupo.inscriptos} de {eventoConCupo.cupo} cupos libres
                  </span>
                </div>
              )}
            </div>
          </div>

          {alumnos
            .filter((a) => !eventoConCupo.misInscripciones.some((i) => i.alumno_id === a.id))
            .map((a) => (
              <BotonInscribirEvento key={a.id} eventoId={eventoConCupo.id} alumnoId={a.id} texto={`Inscribir a ${a.nombre}`} />
            ))}

          {alumnos.length === 0 &&
            caballos
              .filter((c) => !eventoConCupo.misInscripciones.some((i) => i.caballo_id === c.id))
              .map((c) => (
                <BotonInscribirEvento key={c.id} eventoId={eventoConCupo.id} caballoId={c.id} texto={`Inscribir a ${c.nombre}`} />
              ))}
        </section>
      )}

      {mensajes.length > 0 ? (
        <section>
          <h2 className="label">Lo que te enviamos</h2>
          <ul className="space-y-2">
            {mensajes.map((m) => (
              <li key={m.id} className="card p-3">
                <p className="text-sm font-medium text-fg">{ASUNTO_TEXTO[m.plantilla?.codigo ?? ''] ?? 'Aviso del haras'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="badge">
                    {m.canal === 'whatsapp' ? <WhatsappLogo aria-hidden="true" /> : <EnvelopeSimple aria-hidden="true" />}
                    {m.canal === 'whatsapp' ? 'WhatsApp' : 'Correo'}
                  </span>
                  <span className={`badge ${m.estado === 'leido' || m.estado === 'entregado' ? 'badge-ok' : m.estado === 'fallido' ? 'badge-bad' : 'badge-warn'}`}>
                    {m.estado === 'leido' ? <Checks aria-hidden="true" /> : <Check aria-hidden="true" />}
                    {ESTADO_TEXTO[m.estado]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : !eventoConCupo ? (
        <div className="p-5 grid place-items-center text-center gap-3" style={{ minHeight: 260 }} role="status">
          <div className="h-16 w-16 rounded-full grid place-items-center bg-accent-soft text-accent-ink">
            <Bell style={{ fontSize: 38 }} aria-hidden="true" />
          </div>
          <div>
            <p className="font-serif text-xl">No hay novedades</p>
            <p className="text-sm mt-1 text-fg-muted">Todo en orden. Cuando el haras te escriba algo, va a quedar guardado acá.</p>
          </div>
          <Link className="btn btn-sec btn-lg w-full mt-1" href="/portal/agenda">
            Ver mi agenda
          </Link>
        </div>
      ) : null}
    </div>
  );
}
