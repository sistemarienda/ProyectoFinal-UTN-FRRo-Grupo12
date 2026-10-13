'use client';

import { useActionState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { ajusteManual, aplicarMora, condonarInteres } from '../acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';
import { fechaCorta } from '@/lib/fechas';

type Salidas = inferRouterOutputs<RouterApp>;
type LibroMayor = Salidas['cuentaCorriente']['libroMayor'];
type Antiguedad = Salidas['cuentaCorriente']['antiguedadDeuda'];
type MoraPropuesta = Salidas['cuentaCorriente']['calcularMoraPropuesta'];

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

const TIPO_TEXTO = { cargo: 'Cargo', pago: 'Pago', ajuste: 'Ajuste', interes_mora: 'Interés por mora' } as const;

function formatoDinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

export function DetalleDeCuenta({
  clienteId,
  mayor,
  antiguedad,
  mora,
}: {
  clienteId: string;
  mayor: LibroMayor;
  antiguedad: Antiguedad;
  mora: MoraPropuesta;
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="label">Saldo</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(mayor.saldo)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Corriente</p>
          <p className="font-serif text-xl tnum text-fg">{formatoDinero(antiguedad.corriente)}</p>
        </div>
        <div className="card p-4">
          <p className="label">1-30 días</p>
          <p className="font-serif text-xl tnum text-warn">{formatoDinero(antiguedad.dias_1_30)}</p>
        </div>
        <div className="card p-4">
          <p className="label">31+ días</p>
          <p className="font-serif text-xl tnum text-bad">
            {formatoDinero(antiguedad.dias_31_60 + antiguedad.dias_61_90 + antiguedad.dias_90_mas)}
          </p>
        </div>
      </section>

      <WidgetDeMora clienteId={clienteId} mora={mora} />

      <FormularioDeAjuste clienteId={clienteId} />

      <section className="card overflow-hidden">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-serif text-lg text-fg">Libro mayor</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[640px]">
            <caption className="sr-only">Movimientos de la cuenta, más recientes primero.</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Concepto</th>
                <th scope="col">Vence</th>
                <th scope="col" className="num">Importe</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody className="tnum">
              {mayor.movimientos.map((m) => (
                <tr key={m.id}>
                  <td className="text-xs">{new Date(m.creado_en).toLocaleDateString('es-AR')}</td>
                  <td>
                    <span className="badge badge-accent">{TIPO_TEXTO[m.tipo]}</span> {m.concepto}
                  </td>
                  <td className="text-xs">{m.vence_en ? fechaCorta(m.vence_en) : '—'}</td>
                  <td className={`num font-medium ${Number(m.importe) < 0 ? 'text-ok' : ''}`}>
                    {formatoDinero(Number(m.importe))}
                  </td>
                  <td>
                    {m.tipo === 'interes_mora' && (
                      <FormularioCondonar clienteId={clienteId} movimientoId={m.id} />
                    )}
                  </td>
                </tr>
              ))}
              {mayor.movimientos.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-fg-muted">Sin movimientos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function WidgetDeMora({ clienteId, mora }: { clienteId: string; mora: MoraPropuesta }) {
  const [resultado, enviar] = useActionState(aplicarMora, inicial);

  if (!mora.aplica) {
    const motivo = {
      sin_tasa: 'la tasa de mora no está configurada',
      sin_atraso: 'no hay saldo vencido',
      sin_saldo: 'no hay saldo',
    }[mora.motivo];
    return <p className="helper">Sin interés propuesto: {motivo}.</p>;
  }

  return (
    <section className="card-accent p-4">
      <p className="font-medium text-fg">
        Interés propuesto: {formatoDinero(mora.importe)} ({mora.dias} días sobre {formatoDinero(mora.base)} al {mora.tasaMensual}% mensual)
      </p>
      <p className="helper">Los intereses requieren confirmación y se imputan como movimiento independiente.</p>
      <form action={enviar} className="mt-2">
        <input type="hidden" name="clienteId" value={clienteId} />
        <input type="hidden" name="base" value={mora.base} />
        <input type="hidden" name="tasaMensual" value={mora.tasaMensual} />
        <input type="hidden" name="dias" value={mora.dias} />
        <input type="hidden" name="importe" value={mora.importe} />
        <BotonEnviar texto="Aplicar interés" variante="sec" tamano="sm" />
        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      </form>
    </section>
  );
}

function FormularioCondonar({ clienteId, movimientoId }: { clienteId: string; movimientoId: string }) {
  const [resultado, enviar] = useActionState(condonarInteres, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="movimientoId" value={movimientoId} />
      <button type="submit" className="btn btn-gho btn-sm text-bad">Condonar</button>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
    </form>
  );
}

function FormularioDeAjuste({ clienteId }: { clienteId: string }) {
  const [resultado, enviar] = useActionState(ajusteManual, inicial);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium text-fg">Registrar un ajuste manual</summary>
      <form action={enviar} className="mt-3 space-y-3">
        <input type="hidden" name="clienteId" value={clienteId} />
        <label className="block">
          <span className="label">Concepto</span>
          <input name="concepto" required placeholder="Motivo del ajuste" className="input" />
        </label>
        <label className="block">
          <span className="label">Importe (positivo suma deuda, negativo la reduce)</span>
          <input name="importe" type="number" step="0.01" required className="input" />
        </label>
        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok">Ajuste registrado.</p>}
        <BotonEnviar texto="Registrar ajuste" variante="sec" tamano="sm" />
      </form>
    </details>
  );
}
