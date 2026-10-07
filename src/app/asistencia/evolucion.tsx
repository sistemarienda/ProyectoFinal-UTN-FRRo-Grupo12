export interface PuntoDeEvolucion {
  periodo: string;
  porcentaje: number | null;
  dictadas: number;
}

export interface SerieDeEvolucion {
  nombre: string;
  puntos: PuntoDeEvolucion[];
}

const ANCHO = 640;
const ALTO = 210;
const IZQUIERDA = 44;
const DERECHA = 620;
const ARRIBA = 20;
const ABAJO = 180;

/**
 * Cuatro trazos como máximo, que son los cuatro niveles posibles. Se distinguen
 * por color Y por patrón de línea a la vez: el color solo no alcanza para quien
 * no lo distingue, y las cuatro variables del sistema de diseño ya son
 * conscientes del tema claro y oscuro.
 */
const TRAZOS = [
  { color: 'var(--accent)', guion: undefined },
  { color: 'var(--text-muted)', guion: '5 4' },
  { color: 'var(--ok)', guion: '2 3' },
  { color: 'var(--warn)', guion: '8 3 2 3' },
] as const;

function x(indice: number, total: number): number {
  if (total <= 1) return (IZQUIERDA + DERECHA) / 2;
  return IZQUIERDA + 16 + (indice * (DERECHA - IZQUIERDA - 16)) / (total - 1);
}

/** El eje va de 0 a 100 completo: un eje truncado exagera cualquier variación. */
function y(porcentaje: number): number {
  const acotado = Math.max(0, Math.min(100, porcentaje));
  return ARRIBA + ((100 - acotado) * (ABAJO - ARRIBA)) / 100;
}

/**
 * Tramos continuos de la serie.
 *
 * Un mes sin clases corta la línea en lugar de dibujarse como cero: unir enero
 * con marzo por arriba del vacío afirma que en febrero hubo una asistencia que
 * nadie midió.
 */
function tramos(puntos: readonly PuntoDeEvolucion[]): { indice: number; valor: number }[][] {
  const salida: { indice: number; valor: number }[][] = [];
  let actual: { indice: number; valor: number }[] = [];

  puntos.forEach((p, indice) => {
    if (p.porcentaje === null) {
      if (actual.length > 0) salida.push(actual);
      actual = [];
      return;
    }
    actual.push({ indice, valor: p.porcentaje });
  });
  if (actual.length > 0) salida.push(actual);

  return salida;
}

function mesCorto(periodo: string): string {
  return new Date(`${periodo}-01T12:00:00Z`).toLocaleDateString('es-AR', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Evolución de la asistencia por nivel.
 *
 * El gráfico se describe entero en el `aria-label`, con sus valores: uno que
 * sólo se entiende mirándolo deja afuera a quien usa lector de pantalla, y este
 * en particular es el que sostiene la conversación de «tal nivel viene cayendo
 * desde marzo».
 */
export function EvolucionPorNivel({ series }: { series: SerieDeEvolucion[] }) {
  const periodos = series.at(0)?.puntos ?? [];

  if (series.length === 0 || periodos.length === 0) {
    return (
      <section className="card mt-6 min-w-0 p-5">
        <h2 className="mb-1 font-serif text-lg text-fg">Evolución de asistencia por nivel</h2>
        <p className="text-sm text-fg-muted">
          Todavía no hay clases dictadas con nivel declarado como para dibujar una serie.
        </p>
      </section>
    );
  }

  const descripcion = series
    .map((s) => {
      const valores = s.puntos
        .map((p) => (p.porcentaje === null ? 'sin clases' : `${Math.round(p.porcentaje)} por ciento`))
        .join(', ');
      return `${s.nombre}: ${valores}`;
    })
    .join('. ');

  const meses = periodos.map((p) => mesCorto(p.periodo)).join(' a ');

  return (
    <section className="card mt-6 min-w-0 p-5">
      <h2 className="mb-1 font-serif text-lg text-fg">Evolución de asistencia por nivel</h2>
      <p className="mb-4 text-sm text-fg-muted">
        Porcentaje mensual, últimos {periodos.length} meses.
      </p>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          // Sin tope de altura: con uno, el navegador achica el dibujo entero
          // para respetarlo y lo centra, y el gráfico queda flotando angosto en
          // el medio de la tarjeta con dos franjas vacías a los costados.
          className="grafico-svg w-full"
          role="img"
          aria-label={`Asistencia mensual por nivel, de ${meses}. ${descripcion}`}
        >
          <g stroke="var(--surface-border)" strokeWidth="1">
            {[0, 25, 50, 75, 100].map((valor) => (
              <line key={valor} x1={IZQUIERDA} y1={y(valor)} x2={DERECHA} y2={y(valor)} />
            ))}
          </g>

          <g fill="var(--text-muted)" fontSize="11">
            {[0, 25, 50, 75, 100].map((valor) => (
              <text key={valor} x={8} y={y(valor) + 4}>{valor}</text>
            ))}
            {periodos.map((p, i) => (
              <text key={p.periodo} x={x(i, periodos.length)} y={ABAJO + 22} textAnchor="middle">
                {mesCorto(p.periodo)}
              </text>
            ))}
          </g>

          {series.slice(0, TRAZOS.length).map((serie, indiceSerie) => {
            const trazo = TRAZOS[indiceSerie]!;
            return (
              <g key={serie.nombre}>
                {tramos(serie.puntos).map((tramo) =>
                  tramo.length === 1 ? (
                    // Un mes suelto entre dos vacíos: sin punto no se vería nada.
                    <circle
                      key={tramo[0]!.indice}
                      cx={x(tramo[0]!.indice, periodos.length)}
                      cy={y(tramo[0]!.valor)}
                      r={3}
                      fill={trazo.color}
                    />
                  ) : (
                    <polyline
                      key={tramo[0]!.indice}
                      fill="none"
                      stroke={trazo.color}
                      strokeWidth="2.5"
                      strokeDasharray={trazo.guion}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={tramo
                        .map((p) => `${x(p.indice, periodos.length)},${y(p.valor)}`)
                        .join(' ')}
                    />
                  ),
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-2 flex flex-wrap gap-5 text-sm text-fg">
        {series.slice(0, TRAZOS.length).map((serie, i) => (
          <li key={serie.nombre} className="flex items-center gap-2">
            <svg width="24" height="4" aria-hidden="true">
              <line
                x1="0"
                y1="2"
                x2="24"
                y2="2"
                stroke={TRAZOS[i]!.color}
                strokeWidth="2.5"
                strokeDasharray={TRAZOS[i]!.guion}
              />
            </svg>
            {serie.nombre}
          </li>
        ))}
      </ul>
    </section>
  );
}
