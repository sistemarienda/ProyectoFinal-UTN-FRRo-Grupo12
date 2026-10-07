'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { List, X } from '@phosphor-icons/react';
import type { Area } from '@/lib/roles';
import { Logotipo } from './marca';
import { Navegacion } from './sidebar';

/**
 * Menú del personal en pantallas angostas. Por debajo de `md` el sidebar se
 * oculta, y sin esto no había forma de pasar de una pantalla a otra desde un
 * celular. Es un `<dialog>` por lo mismo que `modal.tsx`: atrapa el foco, cierra
 * con Esc y deja inerte el resto de la página.
 */
export function MenuMovil({ areas }: { areas: readonly Area[] }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Al navegar, el menú se cierra solo: el enlace cambia la ruta pero el
  // diálogo vive en la barra, que no se vuelve a montar.
  useEffect(() => {
    dialogo.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="ic menu-movil-abrir"
        aria-label="Abrir el menú"
        onClick={() => dialogo.current?.showModal()}
      >
        <List size={18} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogo}
        className="menu-movil"
        aria-label="Menú principal"
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
      >
        <div className="menu-movil-caja">
          <div className="flex items-center justify-between px-3 pb-2">
            <Logotipo className="sidebar-logo" />
            <button type="button" className="ic" aria-label="Cerrar el menú" onClick={() => dialogo.current?.close()}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <Navegacion areas={areas} />
        </div>
      </dialog>
    </>
  );
}
