export interface PuntoDeFacturacion {
  periodo: string; // ISO yyyy-mm-dd, primer día del mes
  total: number;
}

const ANCHO = 640;
const ALTO = 190;
const IZQUIERDA = 16;
const DERECHA = 620;
const ARRIBA = 16;
const ABAJO = 150;

function mesCorto(periodo: string): string {
  return new Date(`${periodo}T12:00:00Z`).toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' });
}

function formatoCompacto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$${(n / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })} mil`;
  return `$${n.toLocaleString('es-AR')}`;
}

function x(indice: number, total: number): number {
  if (total <= 1) return (IZQUIERDA + DERECHA) / 2;
  return IZQUIERDA + (indice * (DERECHA - IZQUIERDA)) / (total - 1);
}

/**
 * Evolución de la facturación mensual (cargos del período), para el Inicio del
 * administrador. El eje se escala al máximo de la serie, no a un tope fijo: a
 * diferencia de un porcentaje, un monto no tiene techo natural contra el que
 * comparar.
 */
export function EvolucionFacturacion({ puntos }: { puntos: PuntoDeFacturacion[] }) {
  const hayDatos = puntos.some((p) => p.total > 0);

  if (puntos.length === 0 || !hayDatos) {
    return (
      <section className="card min-w-0 p-5">
        <h2 className="mb-1 font-serif text-lg text-fg">Facturación · evolución</h2>
        <p className="text-sm text-fg-muted">Todavía no hay cargos generados como para dibujar la serie.</p>
      </section>
    );
  }

  const max = Math.max(...puntos.map((p) => p.total));
  const y = (v: number) => ARRIBA + (1 - v / max) * (ABAJO - ARRIBA);

  const puntosLinea = puntos.map((p, i) => `${x(i, puntos.length)},${y(p.total)}`).join(' ');
  const puntosArea = `${IZQUIERDA},${ABAJO} ${puntosLinea} ${DERECHA},${ABAJO}`;

  const meses = puntos.map((p) => mesCorto(p.periodo)).join(' a ');
  const descripcion = puntos.map((p) => `${mesCorto(p.periodo)}: ${formatoCompacto(p.total)}`).join(', ');

  return (
    <section className="card min-w-0 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-serif text-lg text-fg">Facturación · evolución</h2>
        <span className="text-xs text-fg-muted">últimos {puntos.length} meses</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="grafico-svg w-full"
          role="img"
          aria-label={`Evolución de la facturación de ${meses}. ${descripcion}.`}
        >
          <defs>
            <linearGradient id="areaFacturacion" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <polyline fill="url(#areaFacturacion)" stroke="none" points={puntosArea} />
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={puntosLinea}
          />

          <g fill="var(--text-muted)" fontSize="11" textAnchor="middle">
            {puntos.map((p, i) => (
              <text key={p.periodo} x={x(i, puntos.length)} y={ABAJO + 22}>
                {mesCorto(p.periodo)}
              </text>
            ))}
          </g>
        </svg>
      </div>
    </section>
  );
}
