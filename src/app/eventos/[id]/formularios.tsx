'use client';

import { useActionState, useMemo, useState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { modificarEvento, inscribirAEvento, enviarInvitacionDeEvento } from '../acciones';
import { BotonEnviar } from '../../botones';
import { Modal } from '../../modal';
import { partesLocales } from '@/lib/agenda';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

interface ServicioOpcion {
  id: string;
  nombre: string;
}

export interface EventoParaEditar {
  id: string;
  nombre: string;
  tipo: 'torneo' | 'exposicion' | 'colonia' | 'otro';
  inicia_en: string;
  finaliza_en: string | null;
  cierra_inscripcion_en: string | null;
  cupo: number | null;
  servicio_id: string | null;
  estado: 'borrador' | 'abierto' | 'cerrado' | 'realizado';
}

const SIGUIENTES_ESTADOS: Record<EventoParaEditar['estado'], EventoParaEditar['estado'][]> = {
  borrador: ['borrador', 'abierto'],
  abierto: ['abierto', 'cerrado'],
  cerrado: ['cerrado', 'realizado'],
  realizado: ['realizado'],
};

export function FormularioModificarEvento({ evento, servicios }: { evento: EventoParaEditar; servicios: ServicioOpcion[] }) {
  const [resultado, enviar] = useActionState(modificarEvento, inicial);
  const { fecha, hora } = partesLocales(evento.inicia_en);

  return (
    <Modal etiqueta="Editar" titulo={evento.nombre} variante="sec">
      <form action={enviar} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="eventoId" value={evento.id} />

        <label className="block sm:col-span-2">
          <span className="label">Nombre</span>
          <input name="nombre" defaultValue={evento.nombre} required maxLength={120} className="input" />
        </label>

        <label className="block">
          <span className="label">Tipo</span>
          <select name="tipo" defaultValue={evento.tipo} className="input">
            <option value="torneo">Torneo</option>
            <option value="exposicion">Exposición</option>
            <option value="colonia">Colonia</option>
            <option value="otro">Otro</option>
          </select>
        </label>

        <label className="block">
          <span className="label">Estado</span>
          <select name="estado" defaultValue={evento.estado} className="input">
            {SIGUIENTES_ESTADOS[evento.estado].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <span className="helper">No retrocede: de {evento.estado} sólo se avanza.</span>
        </label>

        <label className="block">
          <span className="label">Servicio (si se cobra)</span>
          <select name="servicioId" defaultValue={evento.servicio_id ?? ''} className="input">
            <option value="">Sin servicio</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Fecha de inicio</span>
          <input name="fechaInicio" type="date" defaultValue={fecha} required className="input" />
        </label>
        <label className="block">
          <span className="label">Hora de inicio</span>
          <input name="horaInicio" type="time" defaultValue={hora} required className="input" />
        </label>

        <label className="block">
          <span className="label">Fecha de cierre (opcional)</span>
          <input name="fechaFin" type="date" defaultValue={evento.finaliza_en?.slice(0, 10) ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="label">Cierra la inscripción el (opcional)</span>
          <input name="cierraInscripcionEn" type="date" defaultValue={evento.cierra_inscripcion_en ?? ''} className="input" />
        </label>

        <label className="block">
          <span className="label">Cupo (opcional)</span>
          <input name="cupo" type="number" min="1" max="500" defaultValue={evento.cupo ?? ''} placeholder="Sin límite" className="input" />
        </label>

        {resultado.estado === 'error' && <p className="error sm:col-span-2">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok sm:col-span-2">Evento actualizado.</p>}

        <div className="sm:col-span-2">
          <BotonEnviar texto="Guardar cambios" variante="sec" />
        </div>
      </form>
    </Modal>
  );
}

export function FormularioEnviarInvitacion({ eventoId }: { eventoId: string }) {
  const [resultado, enviar] = useActionState(enviarInvitacionDeEvento, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="eventoId" value={eventoId} />
      <BotonEnviar texto="Enviar invitación" cargando="Enviando…" variante="sec" />
      {resultado.estado === 'error' && <p className="error mt-1 text-xs">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && (
        <p className="helper mt-1 text-xs text-ok">Encolada para {resultado.guardados} familia(s).</p>
      )}
    </form>
  );
}

interface ClienteOpcion {
  id: string;
  nombre: string | null;
  activo: boolean;
}
interface AlumnoOpcion {
  id: string;
  nombre: string;
  clienteId: string | undefined;
}
interface CaballoOpcion {
  id: string;
  nombre: string;
  clienteId: string | undefined;
  estado: string;
}

export function FormularioInscribir({
  eventoId,
  clientes,
  alumnos,
  caballos,
}: {
  eventoId: string;
  clientes: ClienteOpcion[];
  alumnos: { id: string; persona?: { nombre: string | null; apellido: string | null } | null; cliente?: { id: string } | null; activo: boolean }[];
  caballos: { id: string; nombre: string; propietario?: { id: string } | null; estado: string }[];
}) {
  const [resultado, enviar] = useActionState(inscribirAEvento, inicial);
  const [clienteId, setClienteId] = useState('');

  const activos = useMemo(() => clientes.filter((c) => c.activo), [clientes]);

  const alumnosDelCliente: AlumnoOpcion[] = useMemo(
    () =>
      alumnos
        .filter((a) => a.activo && a.cliente?.id === clienteId)
        .map((a) => ({
          id: a.id,
          nombre: [a.persona?.nombre, a.persona?.apellido].filter(Boolean).join(' '),
          clienteId: a.cliente?.id,
        })),
    [alumnos, clienteId],
  );

  const caballosDelCliente: CaballoOpcion[] = useMemo(
    () =>
      caballos
        .filter((c) => c.estado !== 'retirado' && c.propietario?.id === clienteId)
        .map((c) => ({ id: c.id, nombre: c.nombre, clienteId: c.propietario?.id, estado: c.estado })),
    [caballos, clienteId],
  );

  return (
    <div className="card p-5">
      <h2 className="font-serif text-lg">Inscribir</h2>
      <p className="mt-1 text-xs text-fg-muted">La reserva que se toma por teléfono: cualquier familia, no sólo la propia.</p>

      <form action={enviar} className="mt-3 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="eventoId" value={eventoId} />

        <label className="block">
          <span className="label">Familia</span>
          <select
            name="clienteId"
            required
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="input"
          >
            <option value="">Elegir…</option>
            {activos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Alumno</span>
          <select name="alumnoId" defaultValue="" disabled={!clienteId} className="input">
            <option value="">Sin alumno</option>
            {alumnosDelCliente.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Caballo</span>
          <select name="caballoId" defaultValue="" disabled={!clienteId} className="input">
            <option value="">Sin caballo</option>
            {caballosDelCliente.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <p className="helper sm:col-span-3">Hace falta al menos uno de los dos: alumno o caballo.</p>

        {resultado.estado === 'error' && <p className="error sm:col-span-3">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok sm:col-span-3">Inscripción registrada.</p>}

        <div className="sm:col-span-3">
          <BotonEnviar texto="Inscribir" variante="sec" />
        </div>
      </form>
    </div>
  );
}
