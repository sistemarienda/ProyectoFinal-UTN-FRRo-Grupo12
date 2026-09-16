import type { FilaDeCuidado } from './bienestar';

/**
 * M14 · Modo sin conexión.
 *
 * Lo que es puro y por eso se prueba solo vive acá. Lo que toca `indexedDB` o
 * `navigator` —que no existen en Node, donde corren las pruebas— vive en
 * `offline-db.ts`, sin probar, igual que `arca-servidor.ts` no prueba la
 * llamada de red y sí prueba en `arca.ts` las reglas que no la necesitan.
 */

export const TIPOS_DE_PLANILLA = ['alimentacion', 'higiene'] as const;
export type TipoDePlanilla = (typeof TIPOS_DE_PLANILLA)[number];

/**
 * Una fila de `registro_cuidado` a la espera de conexión.
 *
 * `claveDeCola` es la clave del `object store` de IndexedDB y no viaja al
 * servidor: es distinta de `id` (decisión 1.6, generado por el celular para
 * la idempotencia contra la base) porque una misma fila puede reencolarse si
 * la sincronización anterior falló, y ahí sí hace falta una clave nueva de
 * cola aunque el `id` del registro siga siendo el mismo.
 */
export interface RegistroEncolado extends FilaDeCuidado {
  claveDeCola: string;
  tipo: TipoDePlanilla;
  /** Cuándo se guardó en la cola del dispositivo, no cuándo pasó el cuidado. */
  encoladoEn: string;
}

/**
 * Las rutas que el service worker deja disponibles sin conexión: la jornada
 * del peón, las dos planillas de registro y la ficha de consulta de caballos
 * (`02-sitemap-por-perfil.md`, perfil 2). Ninguna pantalla de gerencia entra
 * acá a propósito: cachear cobranza o facturación sin conexión arriesga que
 * el dueño mire un número viejo creyendo que está al día.
 *
 * Es la fuente de verdad para `estado-conexion.tsx`. `public/sw.js` no puede
 * importar este módulo —corre fuera del bundle de la aplicación, como
 * cualquier service worker— así que repite la misma lista a mano y lo dice en
 * un comentario.
 */
export const RUTAS_SIN_CONEXION = ['/campo/hoy', '/campo/alimentacion', '/campo/higiene', '/caballos'] as const;

/**
 * Si conviene encolar en vez de mandar directo.
 *
 * `navigator.onLine` puede mentir en los dos sentidos —una wifi cautiva se
 * declara en línea y no llega a ningún lado—, así que la señal fuerte no es
 * sólo el indicador del navegador: es también que el envío directo haya
 * fallado con el error que da un `fetch` sin red. Con las dos, un falso
 * "en línea" no le hace perder al peón la carga que acaba de escribir.
 */
export function debeEncolarse(enLinea: boolean, error?: unknown): boolean {
  if (!enLinea) return true;
  return esErrorDeConectividad(error);
}

/**
 * `fetch` sin red rechaza con un `TypeError` cuyo mensaje varía por
 * navegador ("Failed to fetch", "Load failed", "NetworkError..."), y es
 * distinto de un error de aplicación (que llega con un mensaje de negocio,
 * no de transporte). No hay un código estándar para distinguirlos, así que
 * la señal es el tipo del error más el patrón del mensaje.
 */
export function esErrorDeConectividad(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /fetch|network|load failed|conexión|conexion/i.test(error.message);
}

/** Texto del contador de pendientes, para el banner y para el título de la pestaña. */
export function textoDePendientes(cantidad: number): string {
  if (cantidad === 0) return 'Todo sincronizado.';
  return cantidad === 1 ? '1 registro pendiente de sincronizar.' : `${cantidad} registros pendientes de sincronizar.`;
}

/** Agrupa la cola por tipo de planilla, en el orden en que se van a mandar. */
export function agruparPorTipo(
  pendientes: readonly RegistroEncolado[],
): Record<TipoDePlanilla, RegistroEncolado[]> {
  const grupos = { alimentacion: [] as RegistroEncolado[], higiene: [] as RegistroEncolado[] };
  for (const p of pendientes) grupos[p.tipo].push(p);
  return grupos;
}
