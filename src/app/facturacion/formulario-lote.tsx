'use client';

import { useActionState } from 'react';
import { emitirLote, type ResultadoDeLote } from './acciones';
import { BotonEnviar } from '../botones';

interface PuntoVentaOpcion {
  id: string;
  numero: number;
}

const inicial: ResultadoDeLote = { estado: 'inicial' };

/** Un comprobante por cliente con cargos pendientes, de una sola vez. */
export function FormularioLote({ puntosVenta }: { puntosVenta: PuntoVentaOpcion[] }) {
  const [resultado, enviar] = useActionState(emitirLote, inicial);

  return (
    <form action={enviar} className="card flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="label">Emitir el lote del período</span>
        <select name="puntoVentaId" required className="input">
          {puntosVenta.map((p) => (
            <option key={p.id} value={p.id}>{String(p.numero).padStart(4, '0')}</option>
          ))}
        </select>
      </label>
      <BotonEnviar texto="Emitir lote" variante="sec" cargando="Emitiendo…" />

      {resultado.estado === 'ok' && (
        <p className="helper w-full text-ok">
          {resultado.emitidos} comprobante{resultado.emitidos === 1 ? '' : 's'} autorizado{resultado.emitidos === 1 ? '' : 's'} de {resultado.resultados.length}.
          {resultado.resultados.some((r) => r.estado === 'rechazado') && (
            <span className="text-warn"> Rechazados: {resultado.resultados.filter((r) => r.estado === 'rechazado').length}.</span>
          )}
        </p>
      )}
      {resultado.estado === 'ok' && resultado.resultados.some((r) => r.estado === 'rechazado') && (
        <ul className="w-full space-y-1 text-sm">
          {resultado.resultados
            .filter((r) => r.estado === 'rechazado')
            .map((r) => (
              <li key={r.clienteId} className="text-bad">
                <span className="font-medium">{r.cliente}:</span> {r.motivo ?? 'ARCA rechazó el comprobante sin detalle.'}
              </li>
            ))}
        </ul>
      )}
      {resultado.estado === 'error' && <p className="error w-full">{resultado.mensaje}</p>}
    </form>
  );
}
