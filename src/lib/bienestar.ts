/**
 * M9 · Bienestar animal.
 *
 * Tres cálculos que no tocan la base y por eso se prueban solos: qué plan rige
 * hoy, qué falta registrar en el turno y qué vencimiento sanitario está por
 * caerse.
 *
 * La propiedad que ordena el módulo entero es que **el registro de cuidado es un
 * hecho, no un estado**. Nada se marca como hecho: se cuenta si existe la fila.
 * De ahí sale que la pantalla del peón no necesite un campo «completado» que
 * alguien tenga que mantener, y que reabrir la jornada sea gratis —si la fila
 * está, la tarea está—. Es el mismo criterio de M8 con la asistencia.
 *
 * La segunda es de la base y conviene tenerla presente al leer esto:
 * `registro_cuidado.id` lo genera el dispositivo, no el servidor (decisión 1.6).
 * Acá eso no se nota todavía porque M9 construye el camino en línea, pero las
 * firmas están puestas para que M14 enganche la cola sin migrar datos.
 */

import { ZONA_HARAS, instanteDesdeLocal, partesLocales } from './agenda';

export const MOMENTOS = ['manana', 'mediodia', 'tarde'] as const;

export type Momento = (typeof MOMENTOS)[number];

/**
 * Cómo se nombra cada momento en pantalla.
 *
 * Vive acá y no en cada página por lo mismo que `INICIO_POR_ROL` en `roles.ts`:
 * lo usan la jornada del peón y la planilla de alimentación, y dos copias del
 * mismo rótulo terminan diciendo cosas distintas.
 */
export const MOMENTO_TEXTO: Record<Momento, string> = {
  manana: 'mañana',
  mediodia: 'mediodía',
  tarde: 'tarde',
};

export const TIPOS_CUIDADO = ['alimentacion', 'higiene', 'desparasitacion'] as const;

export type TipoCuidado = (typeof TIPOS_CUIDADO)[number];

export const TIPOS_SANITARIOS = [
  'desparasitacion',
  'vacunacion',
  'herrador',
  'veterinario',
  'otro',
] as const;

export type TipoSanitario = (typeof TIPOS_SANITARIOS)[number];

/**
 * Cómo se nombra en pantalla cada tipo de cuidado y de evento sanitario.
 *
 * Un `Record` sobre los dos dominios y no uno por cada uno: la jornada, el
 * cronograma y la ficha del caballo muestran las dos clases de fila y a ninguna
 * le sirve el valor crudo del enum, que llega sin tilde y en minúscula.
 */
export const TIPO_TEXTO: Record<TipoSanitario | TipoCuidado, string> = {
  desparasitacion: 'Desparasitación',
  vacunacion: 'Vacunación',
  herrador: 'Herrador',
  veterinario: 'Veterinario',
  otro: 'Otro',
  alimentacion: 'Alimentación',
  higiene: 'Higiene',
};

/** El rótulo de un tipo, o el valor crudo si algún día aparece uno nuevo. */
export function tipoEnTexto(tipo: string): string {
  return TIPO_TEXTO[tipo as TipoSanitario] ?? tipo;
}

// -----------------------------------------------------------------------------
// El momento de la jornada
//
// Los cortes son arbitrarios y no hay relevamiento que los fije. Se pueden
// permitir arbitrarios porque **sólo eligen la opción propuesta**: la pantalla
// del peón muestra los tres momentos y el que viene marcado es éste. Si a las
// 10:55 el peón está dando la toma del mediodía, la cambia y listo. Un corte mal
// puesto cuesta un toque, no un registro equivocado, así que no justifica un
// parámetro más en la configuración.
// -----------------------------------------------------------------------------

/** Hora del haras a partir de la cual el momento propuesto cambia. */
const CORTES: readonly { desde: number; momento: Momento }[] = [
  { desde: 16, momento: 'tarde' },
  { desde: 11, momento: 'mediodia' },
  { desde: 0, momento: 'manana' },
];

export function momentoDe(instante: Date | string, zona: string = ZONA_HARAS): Momento {
  const hora = Number(partesLocales(instante, zona).hora.slice(0, 2));
  return CORTES.find((c) => hora >= c.desde)?.momento ?? 'manana';
}

/** Hora del haras que representa a cada momento cuando el registro llega tarde. */
export const HORA_DEL_MOMENTO: Record<Momento, string> = {
  manana: '07:30',
  mediodia: '12:00',
  tarde: '17:30',
};

/**
 * Cuándo ocurrió la toma que se está registrando.
 *
 * El peón no siempre carga mientras sirve: la toma de la mañana se registra a
 * media tarde con toda normalidad. Sellar esas filas con la hora del envío las
 * mandaría al momento equivocado -es lo que hacía antes de esta función- y la
 * jornada seguiría mostrando pendiente una toma ya servida.
 *
 * Por eso `ocurrido_en` es «cuándo pasó, según el peón» y no «cuándo se envió»:
 * cuando se registra dentro del mismo momento se usa el instante real, que es
 * mejor dato; cuando se registra fuera, la hora representativa del momento. El
 * momento en que se cargó no se pierde, lo guarda `registrado_en`.
 */
export function ocurrenciaDelMomento(
  momento: Momento,
  fecha: string,
  ahora: Date = new Date(),
  zona: string = ZONA_HARAS,
): string {
  const enEsteMomento =
    momentoDe(ahora, zona) === momento && partesLocales(ahora, zona).fecha === fecha;

  return enEsteMomento
    ? ahora.toISOString()
    : instanteDesdeLocal(fecha, HORA_DEL_MOMENTO[momento], zona).toISOString();
}

// -----------------------------------------------------------------------------
// El plan alimentario vigente
//
// Mismo criterio que la tarifa (decisión 1.4): rige el de `vigente_desde` más
// reciente que no sea posterior a la fecha. La diferencia es que acá hay **un
// plan por momento**, así que la selección se hace por momento y no una sola vez:
// un caballo puede tener la toma de la mañana actualizada en agosto y la de la
// tarde sin tocar desde marzo.
// -----------------------------------------------------------------------------

export interface PlanComputable {
  id: string;
  momento: Momento;
  descripcion: string;
  /** Ración prevista. Nulo = el plan no la fija y la carga el peón. */
  cantidadKg: number | null;
  /** De qué existencia sale. Nulo = no descuenta stock (pastura de piquete). */
  insumoId: string | null;
  vigenteDesde: string; // ISO yyyy-mm-dd
}

/** El plan que rige en cada momento de la jornada, o nada si no hay ninguno. */
export function planesVigentesEn(
  planes: readonly PlanComputable[],
  fecha: Date | string = new Date(),
): Map<Momento, PlanComputable> {
  const corte = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10);
  const vigentes = new Map<Momento, PlanComputable>();

  for (const plan of planes) {
    if (plan.vigenteDesde > corte) continue;
    const actual = vigentes.get(plan.momento);
    if (!actual || plan.vigenteDesde > actual.vigenteDesde) {
      vigentes.set(plan.momento, plan);
    }
  }

  return vigentes;
}

/** El plan de un momento puntual. Atajo de `planesVigentesEn` para la ficha. */
export function planVigenteEn(
  planes: readonly PlanComputable[],
  momento: Momento,
  fecha: Date | string = new Date(),
): PlanComputable | null {
  return planesVigentesEn(planes, fecha).get(momento) ?? null;
}

// -----------------------------------------------------------------------------
// Las tareas del turno
//
// Qué le falta al peón en el momento que está atendiendo. Se resuelve por
// diferencia contra los registros del día, no por una marca: si hay fila de
// alimentación para ese caballo en ese momento, la tarea está hecha.
//
// El caballo `retirado` no aparece —no está en el establecimiento— pero el
// `en_tratamiento` sí, y a propósito: es justamente el que no se puede saltear.
// -----------------------------------------------------------------------------

export interface CaballoDelTurno {
  id: string;
  nombre: string;
  estado: 'activo' | 'en_tratamiento' | 'retirado';
  /** Base de la ración y de la dosis. Nulo = no se puede expresar en kilos. */
  pesoKg: number | null;
  instalacionId: string | null;
  instalacionNombre: string | null;
}

export interface CuidadoRegistrado {
  /** Nulo cuando el cuidado fue de la instalación: un box desocupado no da de comer a nadie. */
  caballoId: string | null;
  tipo: TipoCuidado;
  ocurridoEn: string; // ISO
}

export interface TareaDelTurno {
  caballo: CaballoDelTurno;
  plan: PlanComputable | null;
  /** Ya registrado en este momento de la jornada. */
  hecho: boolean;
  /**
   * Por qué la ración no se puede proponer en kilos. La pantalla lo muestra y
   * pide la cantidad en la unidad del insumo (CUS02, caminos 2.a y 2.b).
   */
  motivoSinRacion: 'sin_plan' | 'sin_peso' | 'sin_cantidad' | null;
}

export function tareasDeAlimentacion(
  caballos: readonly CaballoDelTurno[],
  planesPorCaballo: ReadonlyMap<string, readonly PlanComputable[]>,
  registrosDelDia: readonly CuidadoRegistrado[],
  momento: Momento,
  fecha: Date | string = new Date(),
  zona: string = ZONA_HARAS,
): TareaDelTurno[] {
  const hechos = new Set(
    registrosDelDia
      .filter(
        (r) =>
          r.tipo === 'alimentacion' &&
          r.caballoId !== null &&
          momentoDe(r.ocurridoEn, zona) === momento,
      )
      .map((r) => r.caballoId as string),
  );

  return caballos
    .filter((c) => c.estado !== 'retirado')
    .map((caballo) => {
      const plan = planVigenteEn(planesPorCaballo.get(caballo.id) ?? [], momento, fecha);

      let motivoSinRacion: TareaDelTurno['motivoSinRacion'] = null;
      if (!plan) motivoSinRacion = 'sin_plan';
      else if (plan.cantidadKg === null) motivoSinRacion = 'sin_cantidad';
      else if (caballo.pesoKg === null) motivoSinRacion = 'sin_peso';

      return { caballo, plan, hecho: hechos.has(caballo.id), motivoSinRacion };
    });
}

// -----------------------------------------------------------------------------
// Vencimientos sanitarios
//
// `evento_sanitario.proxima_fecha` dice cuándo toca repetir. La alerta compara
// esa fecha contra hoy con la antelación que fija
// `parametro.dias_aviso_vencimiento_sanitario`.
//
// Un evento `previsto` NO vence: es el que ya está programado, y avisar de algo
// que está agendado es ruido. Vence lo `aplicado`, que es lo que fija la próxima
// vez; y lo `omitido` se informa aparte, porque un ciclo salteado no se
// resuelve solo con esperar la fecha siguiente.
// -----------------------------------------------------------------------------

export type EstadoVencimiento = 'vencido' | 'por_vencer' | 'al_dia';

export interface VencimientoComputable {
  caballoId: string;
  tipo: string;
  estado: 'previsto' | 'aplicado' | 'omitido';
  /** Nulo = el evento no fija una próxima vez y por lo tanto no vence. */
  proximaFecha: string | null; // ISO yyyy-mm-dd
}

/** Suma días a una fecha ISO sin pasar por husos: es aritmética de calendario. */
export function fechaCorrida(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) throw new RangeError(`Fecha inválida: ${fecha}. Se espera yyyy-mm-dd.`);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function clasificarVencimiento(
  proximaFecha: string | null,
  hoy: string,
  diasDeAviso: number,
): EstadoVencimiento | null {
  if (proximaFecha === null) return null;
  if (proximaFecha < hoy) return 'vencido';
  if (proximaFecha <= fechaCorrida(hoy, diasDeAviso)) return 'por_vencer';
  return 'al_dia';
}

export interface AlertaSanitaria {
  caballoId: string;
  tipo: string;
  proximaFecha: string;
  estado: Exclude<EstadoVencimiento, 'al_dia'>;
  /** Negativo si ya venció. Sirve para ordenar por urgencia. */
  diasRestantes: number;
}

/**
 * Los vencimientos que ameritan aviso, del más urgente al menos.
 *
 * Se queda con el más próximo por caballo y tipo: si un caballo tiene tres
 * desparasitaciones aplicadas, la que importa es la que fija el vencimiento más
 * cercano, no las tres.
 */
export function alertasSanitarias(
  eventos: readonly VencimientoComputable[],
  hoy: string,
  diasDeAviso: number,
): AlertaSanitaria[] {
  const porClave = new Map<string, AlertaSanitaria>();

  for (const evento of eventos) {
    if (evento.estado !== 'aplicado') continue;

    const estado = clasificarVencimiento(evento.proximaFecha, hoy, diasDeAviso);
    if (estado === null || estado === 'al_dia') continue;

    const alerta: AlertaSanitaria = {
      caballoId: evento.caballoId,
      tipo: evento.tipo,
      proximaFecha: evento.proximaFecha!,
      estado,
      diasRestantes: diasEntre(hoy, evento.proximaFecha!),
    };

    const clave = `${evento.caballoId}·${evento.tipo}`;
    const previa = porClave.get(clave);
    if (!previa || alerta.proximaFecha < previa.proximaFecha) porClave.set(clave, alerta);
  }

  return [...porClave.values()].sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/** Días de calendario entre dos fechas ISO. Negativo si la segunda ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  const aUtc = (f: string) => {
    const [anio, mes, dia] = f.split('-').map(Number);
    if (!anio || !mes || !dia) throw new RangeError(`Fecha inválida: ${f}. Se espera yyyy-mm-dd.`);
    return Date.UTC(anio, mes - 1, dia);
  };
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000);
}

// -----------------------------------------------------------------------------
// Rotación de droga
//
// La ficha muestra con qué se desparasitó y en qué orden, para que quien elige
// la próxima vea la secuencia («ivermectina → praziquantel») en lugar de tener
// que recordarla. El sistema **no propone** la droga siguiente: cuál rota con
// cuál es criterio veterinario y el haras no lo declaró, así que inventarlo
// sería poner una indicación clínica que nadie firmó.
// -----------------------------------------------------------------------------

export interface DesparasitacionComputable {
  fecha: string; // ISO yyyy-mm-dd
  estado: 'previsto' | 'aplicado' | 'omitido';
  producto: string | null;
}

/** Los productos efectivamente aplicados, del más viejo al más reciente. */
export function rotacionDeDroga(eventos: readonly DesparasitacionComputable[]): string[] {
  return eventos
    .filter((e) => e.estado === 'aplicado' && e.producto !== null && e.producto.trim() !== '')
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map((e) => e.producto!.trim());
}

// -----------------------------------------------------------------------------
// M14 · Lo que arma la planilla, del lado de acá y del otro
//
// `filasDeFormulario` lee el mismo `FormData` de la planilla de alimentación o
// de higiene y arma las filas que espera `registroCuidado`. Es pura a
// propósito: la usa `campo/acciones.ts` (servidor, con conexión) para el envío
// normal, y la usa el mismo componente de planilla (navegador, sin conexión)
// para encolar en `offline-db` cuando `navigator.onLine` es falso. Las dos
// vías tienen que armar exactamente la misma fila o la cola desincroniza el
// registro que reintenta de la que se mandó al toque.
// -----------------------------------------------------------------------------

export interface FilaDeCuidado {
  id: string;
  caballoId: string | null;
  instalacionId: string | null;
  ocurridoEn: string;
  registradoEn: string;
  observaciones?: string;
  insumoId: string | null;
  cantidad: number | null;
}

function textoDeCampo(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? '').trim();
}

function numeroOpcionalDeCampo(datos: FormData, campo: string): number | null {
  const crudo = textoDeCampo(datos, campo).replace(',', '.');
  if (crudo === '') return null;
  const n = Number.parseFloat(crudo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Arma las filas a partir del formulario.
 *
 * Los campos vienen con el identificador de la fila en el nombre, así que la
 * lista de cuáles se marcaron viaja aparte en `filas`: sin ella habría que
 * adivinar qué claves del `FormData` son registros y cuáles no. Es el mismo
 * mecanismo que usa la planilla de asistencia.
 *
 * `momento`/`fecha` sólo los manda la planilla de alimentación (decisión
 * "cuándo ocurrió" de `ocurrenciaDelMomento`); la de higiene no tiene turnos y
 * cae directo en `ahora`.
 */
export function filasDeFormulario(datos: FormData, ahora: Date = new Date()): FilaDeCuidado[] {
  const instante = ahora.toISOString();

  const momento = MOMENTOS.find((m) => m === textoDeCampo(datos, 'momento'));
  const fecha = textoDeCampo(datos, 'fecha');
  const ocurridoEn = momento && fecha ? ocurrenciaDelMomento(momento, fecha, ahora) : instante;

  return textoDeCampo(datos, 'filas')
    .split(',')
    .filter(Boolean)
    .filter((clave) => textoDeCampo(datos, `hacer-${clave}`) === 'si')
    .map((clave) => ({
      // El identificador lo genera el dispositivo (decisión 1.6). Viaja en un
      // campo oculto que el formulario completó al dibujarse.
      id: textoDeCampo(datos, `id-${clave}`),
      caballoId: textoDeCampo(datos, `caballo-${clave}`) || null,
      instalacionId: textoDeCampo(datos, `instalacion-${clave}`) || null,
      ocurridoEn,
      registradoEn: instante,
      observaciones: textoDeCampo(datos, `obs-${clave}`) || undefined,
      insumoId: textoDeCampo(datos, `insumo-${clave}`) || null,
      cantidad: numeroOpcionalDeCampo(datos, `cantidad-${clave}`),
    }));
}
