/**
 * M12 · Asistente conversacional.
 *
 * Lo que no toca la red vive acá y se prueba solo: el prompt del sistema, el
 * catálogo de herramientas que el modelo puede pedir, y la búsqueda por
 * nombre que usan `buscar_cliente` y `buscar_caballo`. Lo que sí toca la red
 * —la llamada a la API de Claude, y los `createCaller` contra los otros
 * routers— vive en `server/routers/asistente.ts`, sin probar, con el mismo
 * criterio que separa `arca.ts` de `arca-servidor.ts`.
 *
 * **Sin memoria entre sesiones (pendiente 11.2 de `03-modelo-de-datos.md`).**
 * El historial de la conversación vive en el estado del componente del
 * navegador y viaja entero en cada pregunta; no hay `conversacion` ni
 * `mensaje_ia` en el modelo, así que cerrar el panel lo olvida. Es la
 * decisión ya tomada para la v1, no un descuido.
 */

/** Forma estructural del `Tool` de la API de Claude: sin importar el SDK acá. */
export interface DefinicionDeHerramienta {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MODELO_DEL_ASISTENTE = 'claude-haiku-4-5-20251001';

export const PROMPT_DEL_SISTEMA = `Sos el asistente de RIENDA, el sistema de gestión del Haras Las Lechuzas
(pupilaje, enseñanza de equitación y eventos). Contestás en español rioplatense, corto y directo,
al administrador del haras.

Reglas:
- Contestás SÓLO con datos que hayas traído con las herramientas. Si una pregunta no se puede
  responder con las herramientas disponibles, decilo: no inventes cifras, nombres ni fechas.
- Los importes están en pesos argentinos. Redondeá a dos decimales y usá "$" adelante.
- Si una búsqueda por nombre no encuentra a nadie, decilo en vez de suponer a quién se refería.
- No das consejo veterinario, legal ni impositivo: mostrás lo que el sistema tiene registrado.
- Sé breve. El administrador está en el medio de otra tarea y volvió a preguntarte algo puntual.`;

export const HERRAMIENTAS: readonly DefinicionDeHerramienta[] = [
  {
    name: 'resumen_negocio',
    description:
      'KPIs del Inicio del administrador: facturación del mes y su variación contra el mes anterior, cobranza ' +
      'pendiente, ocupación de boxes, alumnos activos, y las cuatro alertas (stock bajo, cuentas en mora, deuda ' +
      'vencida, alertas sanitarias).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'cartera_de_cobranza',
    description:
      'La cartera completa de clientes con saldo en cuenta corriente, con el semáforo de estado (al día, por ' +
      'vencer, vencido) y el próximo vencimiento de cada uno.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'movimientos_de_cliente',
    description: 'El libro mayor de un cliente: su saldo actual y todos sus movimientos de cuenta, más recientes primero.',
    input_schema: {
      type: 'object',
      properties: { clienteId: { type: 'string', description: 'UUID del cliente, obtenido con buscar_cliente.' } },
      required: ['clienteId'],
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca clientes por nombre, apellido o razón social (coincidencia parcial, sin importar acentos ni mayúsculas).',
    input_schema: {
      type: 'object',
      properties: { nombre: { type: 'string', description: 'Texto a buscar.' } },
      required: ['nombre'],
    },
  },
  {
    name: 'ficha_cliente',
    description: 'Ficha completa de un cliente: datos de contacto, contratos, caballos y alumnos a su cargo.',
    input_schema: {
      type: 'object',
      properties: { clienteId: { type: 'string', description: 'UUID del cliente, obtenido con buscar_cliente.' } },
      required: ['clienteId'],
    },
  },
  {
    name: 'buscar_caballo',
    description: 'Busca caballos por nombre (coincidencia parcial, sin importar acentos ni mayúsculas).',
    input_schema: {
      type: 'object',
      properties: { nombre: { type: 'string', description: 'Texto a buscar.' } },
      required: ['nombre'],
    },
  },
  {
    name: 'ficha_caballo',
    description: 'Ficha de un caballo: raza, estado, peso, alojamiento, propietario y sus contratos.',
    input_schema: {
      type: 'object',
      properties: { caballoId: { type: 'string', description: 'UUID del caballo, obtenido con buscar_caballo.' } },
      required: ['caballoId'],
    },
  },
  {
    name: 'alertas_sanitarias',
    description:
      'Los eventos sanitarios (desparasitación, vacunación, herrador, visita veterinaria) próximos a vencer o ya vencidos.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'insumos_bajo_minimo',
    description: 'Los insumos de inventario cuya existencia actual está por debajo del stock mínimo configurado.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'agenda_semana',
    description: 'Las clases programadas en la semana (lunes a domingo) que contiene la fecha dada, o la semana actual si no se da ninguna.',
    input_schema: {
      type: 'object',
      properties: { fecha: { type: 'string', description: 'Cualquier fecha de la semana buscada, en formato AAAA-MM-DD. Opcional.' } },
    },
  },
];

/** Sin acentos, minúsculas, espacios sobrantes afuera. Para comparar sin exigirle al usuario tipear igual que la base. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function coincideConBusqueda(candidato: string, busqueda: string): boolean {
  const q = normalizarTexto(busqueda);
  if (q === '') return false;
  return normalizarTexto(candidato).includes(q);
}
