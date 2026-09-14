import type { ReactNode } from 'react';
import { llamador } from '@/lib/trpc/servidor';
import { Sidebar } from './sidebar';
import { BarraSuperior } from './barra-superior';
import { NavPortal } from './portal/nav-portal';

/**
 * Sidebar y cabecera comparten la misma sesión, así que se resuelve una sola
 * vez acá y se reparte por props. `crearContexto` ya está memoizado por
 * request (`cache()`, ver `server/contexto.ts`); esto evita además la vuelta
 * extra de `quienSoy` (con su propia consulta a `persona`) que salía dos veces
 * por carga de página cuando el sidebar y la cabecera la pedían cada uno por
 * su cuenta.
 */
export async function Armazon({ children }: { children: ReactNode }) {
  let sesion;
  try {
    sesion = await (await llamador()).quienSoy();
  } catch {
    // Sin sesión (p. ej. /ingresar): sin sidebar ni cabecera, sólo la página.
    return <>{children}</>;
  }

  // El portal (M13) no es una pantalla más del personal: es un shell propio,
  // sin sidebar, con su navegación fija abajo (`fase2/portal-cliente.html`
  // ni en desktop dibuja la barra lateral, y las otras tres pantallas del
  // prototipo no tienen variante de escritorio: `.portal-nav` queda fija en
  // cualquier ancho, así que el padding de abajo también). `esPersonal` es la
  // misma distinción que ya usa `lib/roles.ts`.
  if (sesion.rol === 'cliente') {
    return (
      <div className="flex min-h-dvh flex-col">
        <BarraSuperior nombre={sesion.nombre} apellido={sesion.apellido} rol={sesion.rol} conMarca />
        <main className="portal-cuerpo mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6">{children}</main>
        <NavPortal />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar areas={sesion.areas} />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior nombre={sesion.nombre} apellido={sesion.apellido} rol={sesion.rol} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
