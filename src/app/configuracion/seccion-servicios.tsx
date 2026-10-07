'use client';

import { useActionState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { crearServicio, crearTarifa, modificarServicio } from './acciones-servicios';
import { BotonEnviar } from '../botones';
import { Modal } from '../modal';

export interface ServicioVisible {
  id: string;
  nombre: string;
  unidad: 'mensual' | 'por_clase' | 'por_evento';
  aplicaA: 'caballo' | 'alumno';
  modalidad: 'individual' | 'grupal' | null;
  activo: boolean;
  tarifaVigente: { importe: number; vigenteDesde: string } | null;
}

const UNIDADES = { mensual: 'Mensual', por_clase: 'Por clase', por_evento: 'Por evento' } as const;

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function SeccionServicios({ servicios }: { servicios: ServicioVisible[] }) {
  return (
    <section id="servicios" className="card overflow-hidden">
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="font-serif text-lg text-fg">Servicios y tarifas</h2>
        <p className="mt-1 text-sm text-fg-muted">
          El catálogo que vende el haras. El precio se divide por servicio y no por nivel: actualizar
          un precio crea una tarifa nueva con su fecha de vigencia, nunca pisa la anterior.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="tbl min-w-[600px]">
          <caption className="sr-only">Servicios con su tarifa vigente.</caption>
          <thead>
            <tr>
              <th scope="col">Servicio</th>
              <th scope="col">Unidad</th>
              <th scope="col">Modalidad</th>
              <th scope="col" className="num">Vigente</th>
              <th scope="col">Desde</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {servicios.map((s) => (
              <FilaServicio key={s.id} servicio={s} />
            ))}
            {servicios.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-fg-muted">
                  Todavía no hay servicios cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 border-t border-surface-border p-5 md:grid-cols-2">
        <FormularioNuevoServicio />
        <FormularioNuevaTarifa servicios={servicios} />
      </div>
    </section>
  );
}

function FilaServicio({ servicio: s }: { servicio: ServicioVisible }) {
  return (
    <tr className={s.activo ? '' : 'text-fg-muted'}>
      <td className="font-medium">{s.nombre}</td>
      <td className="text-xs">{UNIDADES[s.unidad]}</td>
      <td className="text-xs">{s.modalidad === 'individual' ? <span className="badge">Individual</span> : s.modalidad === 'grupal' ? <span className="badge">Grupal</span> : '—'}</td>
      <td className="num font-medium">
        {s.tarifaVigente ? `$${s.tarifaVigente.importe.toLocaleString('es-AR')}` : 'Sin tarifa'}
      </td>
      <td className="text-fg-muted">{s.tarifaVigente?.vigenteDesde ?? '—'}</td>
      <td>
        <span className={`badge ${s.activo ? 'badge-ok' : ''}`}>{s.activo ? 'Activo' : 'Inactivo'}</span>
        <div className="mt-1.5">
          <Modal etiqueta="Editar" titulo={s.nombre} tamano="sm">
            <FormularioEditarServicio servicio={s} />
          </Modal>
        </div>
      </td>
    </tr>
  );
}

function FormularioEditarServicio({ servicio: s }: { servicio: ServicioVisible }) {
  const [resultado, enviar] = useActionState(modificarServicio, inicial);
  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="servicioId" value={s.id} />
      <label className="block">
        <span className="label">Nombre</span>
        <input name="nombre" defaultValue={s.nombre} required className="input" />
      </label>
      <label className="block">
        <span className="label">Unidad</span>
        <select name="unidad" defaultValue={s.unidad} className="input">
          <option value="mensual">Mensual</option>
          <option value="por_clase">Por clase</option>
          <option value="por_evento">Por evento</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Modalidad (sólo clases)</span>
        <select name="modalidad" defaultValue={s.modalidad ?? ''} className="input">
          <option value="">No aplica</option>
          <option value="individual">Individual</option>
          <option value="grupal">Grupal</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" name="activo" value="true" defaultChecked={s.activo} />
        Activo
      </label>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      <BotonEnviar texto="Guardar" variante="sec" tamano="sm" />
    </form>
  );
}

function FormularioNuevoServicio() {
  const [resultado, enviar] = useActionState(crearServicio, inicial);
  return (
    <form action={enviar} className="card space-y-3 p-4">
      <h3 className="text-sm font-medium text-fg">Nuevo servicio</h3>
      <label className="block">
        <span className="label">Nombre</span>
        <input name="nombre" required placeholder="Clases escuela" className="input" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Unidad</span>
          <select name="unidad" className="input">
            <option value="mensual">Mensual</option>
            <option value="por_clase">Por clase</option>
            <option value="por_evento">Por evento</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Aplica a</span>
          <select name="aplicaA" className="input">
            <option value="caballo">Caballo</option>
            <option value="alumno">Alumno</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Modalidad (sólo clases)</span>
        <select name="modalidad" defaultValue="" className="input">
          <option value="">No aplica</option>
          <option value="individual">Individual</option>
          <option value="grupal">Grupal</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Importe inicial</span>
          <input name="importeInicial" type="number" min="0" step="0.01" required className="input" />
        </label>
        <label className="block">
          <span className="label">Vigente desde</span>
          <input name="vigenteDesde" type="date" required className="input" />
        </label>
      </div>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok">Servicio creado.</p>}
      <BotonEnviar texto="Crear servicio" variante="sec" />
    </form>
  );
}

function FormularioNuevaTarifa({ servicios }: { servicios: ServicioVisible[] }) {
  const [resultado, enviar] = useActionState(crearTarifa, inicial);
  return (
    <form action={enviar} className="card space-y-3 p-4">
      <h3 className="text-sm font-medium text-fg">Nueva tarifa</h3>
      <p className="helper mt-0">Registra un precio nuevo para el servicio y conserva la vigencia anterior.</p>
      <label className="block">
        <span className="label">Servicio</span>
        <select name="servicioId" required className="input">
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Importe</span>
          <input name="importe" type="number" min="0" step="0.01" required className="input" />
        </label>
        <label className="block">
          <span className="label">Vigente desde</span>
          <input name="vigenteDesde" type="date" required className="input" />
        </label>
      </div>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok">Tarifa creada.</p>}
      <BotonEnviar texto="Crear tarifa" variante="sec" />
    </form>
  );
}
