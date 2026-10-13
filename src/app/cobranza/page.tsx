import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { FormularioCargos } from './formulario-cargos';
import { fechaCorta } from '@/lib/fechas';

export const metadata: Metadata = { title: 'Cobranza' };

const ESTADO_BADGE = { al_dia: 'badge-ok', proximo_a_vencer: 'badge-warn', vencido: 'badge-bad' } as const;
// «Vence pronto» y no «Por vencer»: el indicador de arriba ya se llama así y
// suma todo lo que todavía no venció; este estado marca sólo lo que entra en los
// días de aviso previo.
const ESTADO_TEXTO = { al_dia: 'Al día', proximo_a_vencer: 'Vence pronto', vencido: 'Vencido' } as const;


function formatoDinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

/** Pantalla 2 del prototipo: cuentas corrientes y cobranza. El proceso que originó el proyecto. */
export default async function Cobranza() {
  const api = await llamador();
  const [cartera, resumen] = await Promise.all([
    api.cuentaCorriente.listarCartera(),
    api.cuentaCorriente.resumenCartera(),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Gerencia</p>
      <h1 className="font-serif text-3xl text-fg">Cobranza</h1>
      <p className="mt-1 text-fg-muted">
        Estado de la cartera por cliente: saldo, próximo vencimiento y situación.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="label">Saldo total de la cartera</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(resumen.saldoTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Vencido</p>
          <p className="font-serif text-2xl tnum text-bad">{formatoDinero(resumen.vencido)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Por vencer</p>
          <p className="font-serif text-2xl tnum text-warn">{formatoDinero(resumen.porVencer)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Cuentas con saldo</p>
          <p className="font-serif text-2xl tnum text-fg">{resumen.cuentasConSaldo}</p>
        </div>
      </div>

      <div className="mt-6">
        <FormularioCargos />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Cartera de clientes con su saldo, próximo vencimiento y estado.</caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col" className="num">Saldo</th>
              <th scope="col">Próximo vencimiento</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {cartera.map((c) => (
              <tr key={c.cuentaId} className={c.activo ? '' : 'text-fg-muted'}>
                <td>
                  <Link href={`/cobranza/${c.clienteId}`} className="font-medium text-fg hover:text-accent-ink">
                    {c.nombre}
                  </Link>
                </td>
                <td className="num font-medium">{formatoDinero(c.saldo)}</td>
                <td>{c.proximoVencimiento ? fechaCorta(c.proximoVencimiento) : '—'}</td>
                <td>
                  <span className={`badge ${ESTADO_BADGE[c.estado]}`}>{ESTADO_TEXTO[c.estado]}</span>
                </td>
              </tr>
            ))}
            {cartera.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-fg-muted">
                  Todavía no hay cuentas cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
