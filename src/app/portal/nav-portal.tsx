'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, CalendarDots, Horse, Bell, type Icon } from '@phosphor-icons/react';

/**
 * Navegación del portal (M13), calcada de `fase2/portal-cliente.html`: cuatro
 * destinos fijos, sin agrupar por área como el sidebar del personal, porque acá
 * no hay áreas que mostrar u ocultar por rol —el cliente sólo tiene `portal`—,
 * hay cuatro pantallas siempre.
 */
const ENLACES: { href: string; texto: string; icono: Icon }[] = [
  { href: '/portal', texto: 'Cuenta', icono: Wallet },
  { href: '/portal/agenda', texto: 'Agenda', icono: CalendarDots },
  { href: '/portal/caballos', texto: 'Caballos', icono: Horse },
  { href: '/portal/avisos', texto: 'Avisos', icono: Bell },
];

export function NavPortal() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav portal-nav grid grid-cols-4" aria-label="Navegación del portal">
      {ENLACES.map((e) => {
        const actual = e.href === '/portal' ? pathname === e.href : pathname.startsWith(e.href);
        const Icono = e.icono;
        return (
          <Link key={e.href} href={e.href} aria-current={actual ? 'page' : undefined}>
            <Icono size={18} weight={actual ? 'fill' : 'regular'} aria-hidden="true" />
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
