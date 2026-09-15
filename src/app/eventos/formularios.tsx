'use client';

import { useActionState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { crearEvento } from './acciones';
import { BotonEnviar } from '../botones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

interface ServicioOpcion {
  id: string;
  nombre: string;
}

export function FormularioNuevoEvento({ servicios }: { servicios: ServicioOpcion[] }) {
  const [resultado, enviar] = useActionState(crearEvento, inicial);

  return (
    <form action={enviar} className="card grid gap-3 p-5 sm:grid-cols-2">
      <h2 className="font-serif text-lg sm:col-span-2">Nuevo evento</h2>

      <label className="block sm:col-span-2">
        <span className="label">Nombre</span>
        <input name="nombre" required maxLength={120} placeholder="Exposición de volteo" className="input" />
      </label>

      <label className="block">
        <span className="label">Tipo</span>
        <select name="tipo" defaultValue="torneo" className="input">
          <option value="torneo">Torneo</option>
          <option value="exposicion">Exposición</option>
          <option value="colonia">Colonia</option>
          <option value="otro">Otro</option>
        </select>
      </label>

      <label className="block">
        <span className="label">Servicio (si se cobra)</span>
        <select name="servicioId" defaultValue="" className="input">
          <option value="">Sin servicio</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">Fecha de inicio</span>
        <input name="fechaInicio" type="date" required className="input" />
      </label>
      <label className="block">
        <span className="label">Hora de inicio</span>
        <input name="horaInicio" type="time" defaultValue="10:00" required className="input" />
      </label>

      <label className="block">
        <span className="label">Fecha de cierre (opcional)</span>
        <input name="fechaFin" type="date" className="input" />
      </label>
      <label className="block">
        <span className="label">Cierra la inscripción el (opcional)</span>
        <input name="cierraInscripcionEn" type="date" className="input" />
      </label>

      <label className="block">
        <span className="label">Cupo (opcional)</span>
        <input name="cupo" type="number" min="1" max="500" placeholder="Sin límite" className="input" />
      </label>

      {resultado.estado === 'error' && <p className="error sm:col-span-2">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok sm:col-span-2">Evento creado.</p>}

      <div className="sm:col-span-2">
        <BotonEnviar texto="Crear evento" variante="sec" />
      </div>
    </form>
  );
}
