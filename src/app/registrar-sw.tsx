'use client';

import { useEffect } from 'react';

/**
 * M14 · Alta del service worker (`public/sw.js`).
 *
 * Sin marcado propio: es sólo el efecto de registrarlo, montado una vez desde
 * `layout.tsx` para los dos perfiles del personal. El portal del cliente
 * (M13) no lo necesita —no tiene nada que ofrecer sin conexión— pero
 * registrarlo ahí tampoco hace daño, así que no hace falta condicionarlo por
 * rol: `sw.js` sólo cachea las rutas de campo, decida quien decida visitarlas.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker no hay modo sin conexión, pero el resto de la
      // aplicación sigue andando con red: no es un error que deba interrumpir
      // nada, sólo una capacidad que no quedó disponible.
    });
  }, []);

  return null;
}
