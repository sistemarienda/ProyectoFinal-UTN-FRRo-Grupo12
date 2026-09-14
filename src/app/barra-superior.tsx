'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { SignOut } from '@phosphor-icons/react';
import { clienteDeNavegador } from '@/lib/supabase/navegador';
import { Isotipo } from './marca';

const ROLES = {
  administrador: 'Administrador',
  instructor: 'Instructor',
  peon: 'Peón',
  cliente: 'Cliente',
} as const;

export function BarraSuperior({
  nombre,
  apellido,
  rol,
  conMarca = false,
}: {
  nombre: string | null;
  apellido: string | null;
  rol: keyof typeof ROLES;
  /** El portal no tiene sidebar: sin esto, la marca no aparece en ningún lado. */
  conMarca?: boolean;
}) {
  const router = useRouter();
  const [saliendo, iniciarTransicion] = useTransition();

  const iniciales = [nombre?.[0], apellido?.[0]].filter(Boolean).join('').toUpperCase() || '·';
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ') || 'Sin nombre';

  async function cerrarSesion() {
    const supabase = clienteDeNavegador();
    await supabase.auth.signOut();
    iniciarTransicion(() => {
      router.replace('/ingresar');
      router.refresh();
    });
  }

  return (
    <div className="topbar">
      {conMarca ? (
        <Link href="/portal" aria-label="RIENDA, ir a mi cuenta" className="flex items-center gap-2 text-accent-ink">
          <Isotipo className="h-6 w-6" />
          <span className="font-serif text-lg">RIENDA</span>
        </Link>
      ) : (
        <span className="text-sm text-fg-muted">{ROLES[rol]}</span>
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="avatar" aria-hidden="true">{iniciales}</span>
          <span className="hidden text-sm font-medium text-fg sm:inline">{nombreCompleto}</span>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          disabled={saliendo}
          className="ic"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <SignOut size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
