'use client';

import type { FilaDeCuidado } from './bienestar';
import type { RegistroEncolado, TipoDePlanilla } from './offline';

/**
 * M14 · Cola offline sobre IndexedDB.
 *
 * Vive fuera de las pruebas a propósito: `indexedDB` no existe en Node, donde
 * corre Vitest (`vitest.config.mts`, `environment: 'node'`), y agregar un
 * simulador sólo para esto sería probar el simulador. Lo que sí se prueba es
 * la lógica de decisión y de formato de `offline.ts`.
 *
 * Una sola tabla, `pendientes`, con `claveDeCola` como clave. No hace falta
 * más: la cola es chica —lo que un peón registra en un turno sin señal— y no
 * necesita índices.
 */

const BASE = 'rienda-offline';
const VERSION = 1;
const TABLA = 'pendientes';

function disponible(): boolean {
  return typeof indexedDB !== 'undefined';
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(BASE, VERSION);
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      if (!db.objectStoreNames.contains(TABLA)) {
        db.createObjectStore(TABLA, { keyPath: 'claveDeCola' });
      }
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

async function conTabla<T>(modo: IDBTransactionMode, fn: (tabla: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLA, modo);
    const solicitud = fn(tx.objectStore(TABLA));
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
    tx.oncomplete = () => db.close();
  });
}

/** Encola una tanda entera (una planilla completa) de una vez. */
export async function encolar(tipo: TipoDePlanilla, filas: readonly FilaDeCuidado[]): Promise<void> {
  if (!disponible() || filas.length === 0) return;
  const db = await abrir();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TABLA, 'readwrite');
    const tabla = tx.objectStore(TABLA);
    const encoladoEn = new Date().toISOString();
    for (const fila of filas) {
      const registro: RegistroEncolado = { ...fila, tipo, encoladoEn, claveDeCola: crypto.randomUUID() };
      tabla.add(registro);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarPendientes(): Promise<RegistroEncolado[]> {
  if (!disponible()) return [];
  return conTabla('readonly', (tabla) => tabla.getAll());
}

export async function contarPendientes(): Promise<number> {
  if (!disponible()) return 0;
  return conTabla('readonly', (tabla) => tabla.count());
}

/** Quita de la cola lo que ya se confirmó sincronizado. */
export async function quitarPendientes(clavesDeCola: readonly string[]): Promise<void> {
  if (!disponible() || clavesDeCola.length === 0) return;
  const db = await abrir();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TABLA, 'readwrite');
    const tabla = tx.objectStore(TABLA);
    for (const clave of clavesDeCola) tabla.delete(clave);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
