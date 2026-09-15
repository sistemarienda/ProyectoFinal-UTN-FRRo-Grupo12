'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Horse, Student, UsersThree, GearSix, Wallet, CreditCard, Receipt, CalendarBlank, CheckSquare, FirstAidKit, SunHorizon, Package, House, ChartLineUp, Trophy, ChatCircleDots, type Icon } from '@phosphor-icons/react';
import type { Area } from '@/lib/roles';
import { Logotipo } from './marca';

interface Enlace {
  area: Area;
  href: string;
  texto: string;
  icono: Icon;
}

/**
 * Grupos del sidebar, calcados de `02-sitemap-por-perfil.md`. Un enlace sólo
 * aparece si el rol alcanza su área (mismo criterio que los guardas de tRPC) y
 * si la pantalla ya existe: el sitemap tiene 16 módulos y hoy hay 3.
 */
/** «Inicio / Dashboard BI» del sitemap: va suelto, arriba de todo grupo. */
const INICIO: Enlace = { area: 'gerencia', href: '/panel', texto: 'Inicio', icono: House };

const GRUPOS: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: 'Gerencia',
    enlaces: [
      { area: 'gerencia', href: '/cobranza', texto: 'Cobranza', icono: Wallet },
      { area: 'gerencia', href: '/pagos', texto: 'Pagos', icono: CreditCard },
      { area: 'gerencia', href: '/facturacion', texto: 'Facturación', icono: Receipt },
      { area: 'gerencia', href: '/reportes', texto: 'Reportes', icono: ChartLineUp },
      { area: 'gerencia', href: '/eventos', texto: 'Eventos', icono: Trophy },
      { area: 'gerencia', href: '/mensajeria', texto: 'Mensajería', icono: ChatCircleDots },
    ],
  },
  {
    titulo: 'Clientes y contratos',
    enlaces: [{ area: 'clientes', href: '/clientes', texto: 'Clientes', icono: UsersThree }],
  },
  {
    titulo: 'Enseñanza',
    enlaces: [
      { area: 'ensenanza', href: '/agenda', texto: 'Agenda', icono: CalendarBlank },
      { area: 'ensenanza', href: '/asistencia', texto: 'Asistencia', icono: CheckSquare },
      { area: 'clientes', href: '/alumnos', texto: 'Alumnos', icono: Student },
    ],
  },
  {
    titulo: 'Bienestar animal',
    enlaces: [
      // «Mi jornada» es el inicio del peón y del instructor (`INICIO_POR_ROL`),
      // así que va primero: para esos dos roles es la pantalla de todos los días.
      { area: 'bienestar', href: '/campo/hoy', texto: 'Mi jornada', icono: SunHorizon },
      { area: 'bienestar', href: '/caballos', texto: 'Caballos', icono: Horse },
      { area: 'bienestar', href: '/sanidad', texto: 'Sanidad', icono: FirstAidKit },
      // Inventario es de Bienestar por el sitemap -es lo que se le da de comer y
      // con qué se lo cuida-, pero escribe sólo el dueño: la lectura la habilita
      // el área y la escritura, las políticas `insumo_escritura` y `orden_admin`.
      { area: 'bienestar', href: '/inventario', texto: 'Inventario', icono: Package },
    ],
  },
];

const CONFIGURACION: Enlace = { area: 'configuracion', href: '/configuracion', texto: 'Configuración', icono: GearSix };

export function Sidebar({ areas }: { areas: readonly Area[] }) {
  const pathname = usePathname();
  const esActual = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand" aria-label="RIENDA, ir al inicio">
        <Logotipo className="sidebar-logo" />
      </Link>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        {areas.includes(INICIO.area) && <ItemDeNav enlace={INICIO} actual={esActual(INICIO.href)} />}

        {GRUPOS.map((grupo) => {
          const visibles = grupo.enlaces.filter((e) => areas.includes(e.area));
          if (visibles.length === 0) return null;
          return (
            <div key={grupo.titulo}>
              <p className="sidebar-group">{grupo.titulo}</p>
              {visibles.map((e) => (
                <ItemDeNav key={e.href} enlace={e} actual={esActual(e.href)} />
              ))}
            </div>
          );
        })}

        {areas.includes(CONFIGURACION.area) && (
          <div className="mt-auto">
            <p className="sidebar-group">Sistema</p>
            <ItemDeNav enlace={CONFIGURACION} actual={esActual(CONFIGURACION.href)} />
          </div>
        )}
      </nav>
    </aside>
  );
}

function ItemDeNav({ enlace: e, actual }: { enlace: Enlace; actual: boolean }) {
  const Icono = e.icono;
  return (
    <Link href={e.href} className="nav-item" aria-current={actual ? 'page' : undefined}>
      <Icono size={18} weight={actual ? 'fill' : 'regular'} aria-hidden="true" />
      {e.texto}
    </Link>
  );
}
