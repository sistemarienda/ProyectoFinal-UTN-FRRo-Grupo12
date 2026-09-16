'use client';

import { type FormEvent, useEffect, useRef, useState, useTransition } from 'react';
import { PaperPlaneTilt, Robot, X } from '@phosphor-icons/react';
import { type MensajeDelChat, preguntarAlAsistente } from './asistente/acciones';

const HERRAMIENTA_TEXTO: Record<string, string> = {
  resumen_negocio: 'resumen del negocio',
  cartera_de_cobranza: 'cartera de cobranza',
  movimientos_de_cliente: 'movimientos de un cliente',
  buscar_cliente: 'búsqueda de clientes',
  ficha_cliente: 'ficha de un cliente',
  buscar_caballo: 'búsqueda de caballos',
  ficha_caballo: 'ficha de un caballo',
  alertas_sanitarias: 'alertas sanitarias',
  insumos_bajo_minimo: 'inventario',
  agenda_semana: 'agenda de la semana',
};

interface Turno extends MensajeDelChat {
  herramientas?: string[];
  error?: boolean;
}

/**
 * M12 · «Preguntale a RIENDA», el panel del administrador (`02-sitemap-por-perfil.md`).
 *
 * Sin memoria server-side (pendiente 11.2): `turnos` vive en este componente
 * y desaparece al cerrar la pestaña. Cada pregunta manda el historial entero,
 * como cualquier conversación con la API de Claude.
 */
export function AsistenteIA() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const finDeLista = useRef<HTMLDivElement>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState('');
  const [pendiente, iniciarTransicion] = useTransition();

  useEffect(() => {
    finDeLista.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turnos.length, pendiente]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const pregunta = texto.trim();
    if (pregunta === '' || pendiente) return;

    const historial: MensajeDelChat[] = [...turnos.map(({ rol, texto: t }) => ({ rol, texto: t })), { rol: 'usuario', texto: pregunta }];
    setTurnos((previos) => [...previos, { rol: 'usuario', texto: pregunta }]);
    setTexto('');

    iniciarTransicion(async () => {
      const r = await preguntarAlAsistente(historial);
      setTurnos((previos) => [
        ...previos,
        r.estado === 'ok'
          ? { rol: 'asistente', texto: r.texto, herramientas: r.herramientas }
          : { rol: 'asistente', texto: r.mensaje, error: true },
      ]);
    });
  }

  return (
    <>
      <button
        type="button"
        className="ic"
        onClick={() => dialogo.current?.showModal()}
        aria-label="Preguntale a RIENDA"
        title="Preguntale a RIENDA"
      >
        <Robot size={16} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogo}
        className="modal"
        aria-label="Preguntale a RIENDA"
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
      >
        <div className="modal-caja h-[32rem]">
          <div className="modal-encabezado">
            <h3 className="flex items-center gap-2 font-serif text-lg">
              <Robot size={20} aria-hidden="true" className="text-accent-ink" />
              Preguntale a RIENDA
            </h3>
            <button type="button" className="ic" onClick={() => dialogo.current?.close()} aria-label="Cerrar">
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="modal-cuerpo flex-1 space-y-3">
            {turnos.length === 0 && (
              <p className="text-sm text-fg-muted">
                Preguntá sobre la cobranza, los caballos, la agenda o el inventario. Contesta sólo con datos del
                sistema: sin memoria de una conversación a la otra.
              </p>
            )}

            {turnos.map((t, i) => (
              <div key={i} className={`flex ${t.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    t.rol === 'usuario'
                      ? 'bg-accent text-accent-text'
                      : t.error
                        ? 'bg-bad-bg text-bad'
                        : 'bg-hover-veil text-fg'
                  }`}
                >
                  {t.texto}
                  {t.herramientas && t.herramientas.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1">
                      {t.herramientas.map((h) => (
                        <span key={h} className="badge badge-accent">
                          {HERRAMIENTA_TEXTO[h] ?? h}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {pendiente && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-xl bg-hover-veil px-3 py-2.5">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}

            <div ref={finDeLista} />
          </div>

          <form onSubmit={enviar} className="flex items-center gap-2 border-t border-surface-border p-3">
            <input
              className="input flex-1"
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="¿Cómo está la cobranza este mes?"
              aria-label="Tu pregunta"
              disabled={pendiente}
            />
            <button type="submit" className="btn btn-pri btn-icon" disabled={pendiente || texto.trim() === ''} aria-label="Enviar">
              <PaperPlaneTilt size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
