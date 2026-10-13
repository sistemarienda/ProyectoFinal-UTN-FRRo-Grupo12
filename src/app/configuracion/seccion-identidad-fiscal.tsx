'use client';

import { useActionState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { crearIdentidadFiscal } from './acciones-arca';
import { BotonEnviar } from '../botones';
import { fechaCorta } from '@/lib/fechas';

export interface IdentidadFiscalVisible {
  id: string;
  razon_social: string;
  cuit: string;
  condicion_iva: 'monotributo' | 'exento' | 'responsable_inscripto';
  vigente_desde: string;
  domicilio_fiscal: string;
  ingresos_brutos: string | null;
  inicio_actividades: string;
}

const CONDICION_TEXTO = { monotributo: 'Monotributo', exento: 'Exento', responsable_inscripto: 'Responsable inscripto' } as const;

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

/**
 * RN-01: la condición fiscal del emisor es configurable, no una constante. No
 * hay "modificar": un cambio siempre es un alta nueva con su propia vigencia,
 * porque un comprobante ya emitido copia la identidad del momento (RN-04).
 */
export function SeccionIdentidadFiscal({ identidades }: { identidades: IdentidadFiscalVisible[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="font-serif text-lg text-fg">Identidad fiscal (M6)</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Con qué datos factura el sistema. El haras factura hoy como monotributista y va a pasar a
          ser una asociación civil: cada cambio es una fila nueva, nunca se pisa la anterior.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="tbl min-w-[600px]">
          <caption className="sr-only">Historial de identidad fiscal, más reciente primero.</caption>
          <thead>
            <tr>
              <th scope="col">Razón social</th>
              <th scope="col">CUIT</th>
              <th scope="col">Condición IVA</th>
              <th scope="col">Vigente desde</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {identidades.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.razon_social}</td>
                <td>{i.cuit}</td>
                <td className="text-xs">{CONDICION_TEXTO[i.condicion_iva]}</td>
                <td className="text-fg-muted">{fechaCorta(i.vigente_desde)}</td>
              </tr>
            ))}
            {identidades.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-fg-muted">
                  Todavía no hay identidad fiscal cargada. Sin ésta, M6 no puede emitir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-surface-border p-5">
        <FormularioNuevaIdentidad />
      </div>
    </section>
  );
}

function FormularioNuevaIdentidad() {
  const [resultado, enviar] = useActionState(crearIdentidadFiscal, inicial);
  return (
    <form action={enviar} className="grid gap-3 md:grid-cols-2">
      <h3 className="text-sm font-medium text-fg md:col-span-2">Nueva identidad fiscal</h3>
      <label className="block">
        <span className="label">Razón social</span>
        <input name="razonSocial" required className="input" />
      </label>
      <label className="block">
        <span className="label">CUIT (sin guiones)</span>
        <input name="cuit" required pattern="\d{11}" className="input" />
      </label>
      <label className="block">
        <span className="label">Condición IVA</span>
        <select name="condicionIva" required defaultValue="monotributo" className="input">
          <option value="monotributo">Monotributo</option>
          <option value="exento">Exento</option>
          <option value="responsable_inscripto">Responsable inscripto</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Vigente desde</span>
        <input name="vigenteDesde" type="date" required className="input" />
      </label>
      <label className="block md:col-span-2">
        <span className="label">Domicilio fiscal</span>
        <input name="domicilioFiscal" required className="input" />
      </label>
      <label className="block">
        <span className="label">Ingresos brutos (opcional)</span>
        <input name="ingresosBrutos" className="input" />
      </label>
      <label className="block">
        <span className="label">Inicio de actividades</span>
        <input name="inicioActividades" type="date" required className="input" />
      </label>
      {resultado.estado === 'error' && <p className="error md:col-span-2">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok md:col-span-2">Identidad fiscal cargada.</p>}
      <div className="md:col-span-2">
        <BotonEnviar texto="Cargar identidad fiscal" variante="sec" />
      </div>
    </form>
  );
}
