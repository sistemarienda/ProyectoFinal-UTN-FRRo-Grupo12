'use client';

import { useActionState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { crearPuntoVenta, desactivarPuntoVenta } from './acciones-arca';
import { BotonEnviar } from '../botones';

export interface PuntoVentaVisible {
  id: string;
  numero: number;
  descripcion: string;
  modo: 'web_service' | 'en_linea';
  activo: boolean;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

/** RN-03: ARCA prohíbe compartir un punto de venta entre el facturador manual y el sistema. */
export function SeccionPuntosDeVenta({ puntos }: { puntos: PuntoVentaVisible[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="font-serif text-lg text-fg">Puntos de venta</h2>
        <p className="mt-1 text-sm text-fg-muted">
          El sistema emite sólo por el punto marcado como web service; el que el haras usa a mano
          queda registrado acá para no confundirlos, pero nunca se emite contra él.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="tbl min-w-[480px]">
          <caption className="sr-only">Puntos de venta configurados.</caption>
          <thead>
            <tr>
              <th scope="col" className="num">Número</th>
              <th scope="col">Descripción</th>
              <th scope="col">Modo</th>
              <th scope="col">Estado</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody className="tnum">
            {puntos.map((p) => (
              <tr key={p.id} className={p.activo ? '' : 'text-fg-muted'}>
                <td className="num font-medium">{String(p.numero).padStart(4, '0')}</td>
                <td>{p.descripcion}</td>
                <td>
                  <span className={`badge ${p.modo === 'web_service' ? 'badge-accent' : ''}`}>
                    {p.modo === 'web_service' ? 'Web service' : 'En línea (manual)'}
                  </span>
                </td>
                <td className="text-xs">{p.activo ? 'Activo' : 'Inactivo'}</td>
                <td>{p.activo && <BotonDesactivar id={p.id} />}</td>
              </tr>
            ))}
            {puntos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-fg-muted">
                  Todavía no hay puntos de venta cargados. Sin uno de tipo web service, M6 no puede emitir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-surface-border p-5">
        <FormularioNuevoPunto />
      </div>
    </section>
  );
}

function BotonDesactivar({ id }: { id: string }) {
  const [resultado, enviar] = useActionState(desactivarPuntoVenta, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-gho btn-sm text-bad">Desactivar</button>
      {resultado.estado === 'error' && <p className="error text-xs">{resultado.mensaje}</p>}
    </form>
  );
}

function FormularioNuevoPunto() {
  const [resultado, enviar] = useActionState(crearPuntoVenta, inicial);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="label">Número</span>
        <input name="numero" type="number" min="1" required className="input w-28" />
      </label>
      <label className="block">
        <span className="label">Descripción</span>
        <input name="descripcion" required placeholder="Sistema RIENDA" className="input" />
      </label>
      <label className="block">
        <span className="label">Modo</span>
        <select name="modo" defaultValue="web_service" className="input">
          <option value="web_service">Web service</option>
          <option value="en_linea">En línea (manual)</option>
        </select>
      </label>
      {resultado.estado === 'error' && <p className="error w-full">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok w-full">Punto de venta cargado.</p>}
      <BotonEnviar texto="Agregar" variante="sec" tamano="sm" />
    </form>
  );
}
