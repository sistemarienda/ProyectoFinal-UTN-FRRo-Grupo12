'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowsClockwise, WifiSlash } from '@phosphor-icons/react';
import { contarPendientes, listarPendientes, quitarPendientes } from '@/lib/offline-db';
import { textoDePendientes } from '@/lib/offline';
import { sincronizarPendientes } from './campo/acciones';

/**
 * M14 · Banner de conexión para el peón y el instructor.
 *
 * Lo dispara cualquier planilla que acabe de encolar, con
 * `avisarCambioDeCola()`, y también los eventos nativos `online`/`offline`.
 * No hay estado global en esta aplicación —el resto se resuelve con Server
 * Components— y para esto no hace falta uno: un evento del `window` alcanza
 * porque el banner es el único interesado.
 */
const EVENTO_COLA = 'rienda:cola-offline';

export function avisarCambioDeCola() {
  window.dispatchEvent(new Event(EVENTO_COLA));
}

function suscribirseAConexion(alCambiar: () => void) {
  window.addEventListener('online', alCambiar);
  window.addEventListener('offline', alCambiar);
  return () => {
    window.removeEventListener('online', alCambiar);
    window.removeEventListener('offline', alCambiar);
  };
}

/**
 * `navigator.onLine` a través de `useSyncExternalStore`, que es la vía que
 * recomienda React para sincronizar con un valor externo al render: en el
 * servidor no hay `navigator`, así que el tercer argumento (`true`) es lo que
 * se asume hasta que el cliente hidrata y toma el valor real.
 */
function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirseAConexion, () => navigator.onLine, () => true);
}

export function EstadoDeConexion() {
  const enLinea = useEnLinea();
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const actualizarContador = useCallback(() => {
    contarPendientes().then(setPendientes);
  }, []);

  const sincronizar = useCallback(async () => {
    const cola = await listarPendientes();
    if (cola.length === 0) return;
    setSincronizando(true);
    try {
      const resultado = await sincronizarPendientes(cola);
      if (resultado.sincronizadas.length > 0) await quitarPendientes(resultado.sincronizadas);
    } catch {
      // Sin red todavía, o el servidor rechazó la tanda: la cola queda tal
      // cual está y se reintenta en la próxima vuelta a línea o al tocar
      // «Sincronizar ahora».
    } finally {
      setSincronizando(false);
      actualizarContador();
    }
  }, [actualizarContador]);

  useEffect(() => {
    actualizarContador();
    window.addEventListener(EVENTO_COLA, actualizarContador);
    return () => window.removeEventListener(EVENTO_COLA, actualizarContador);
  }, [actualizarContador]);

  // Vuelve la señal: se intenta vaciar la cola sola. El disparo vive en el
  // propio evento del navegador —no en un efecto que mire `enLinea`— porque
  // ahí es donde React pide que se sincronice con un sistema externo: si hay
  // cola al montar ya en línea, alcanza con el botón «Sincronizar ahora».
  useEffect(() => {
    function alVolverLinea() {
      void sincronizar();
    }
    window.addEventListener('online', alVolverLinea);
    return () => window.removeEventListener('online', alVolverLinea);
  }, [sincronizar]);

  // Todavía no se sabe si hay pendientes (IndexedDB es asincrónica): nada, en
  // vez de un banner que aparece y enseguida desaparece.
  if (pendientes === null || (enLinea && pendientes === 0)) return null;

  return (
    <div className="toast sticky top-0 z-10 mb-4" role="status">
      {!enLinea && <WifiSlash size={18} weight="bold" aria-hidden="true" className="shrink-0" />}
      <span className="flex-1">
        {!enLinea && 'Sin conexión. '}
        {textoDePendientes(pendientes)}
      </span>
      {enLinea && pendientes > 0 && (
        <button
          type="button"
          className="btn btn-sm btn-sec shrink-0"
          onClick={() => void sincronizar()}
          disabled={sincronizando}
        >
          <ArrowsClockwise size={14} aria-hidden="true" className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
      )}
    </div>
  );
}
