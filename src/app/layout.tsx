import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { Armazon } from './armazon';
import { RegistrarServiceWorker } from './registrar-sw';
import './globals.css';

/**
 * Las dos familias de la dirección «Editorial Premium»: Fraunces para títulos e
 * Inter para texto. Se cargan con `next/font`, que las auto-hospeda: además de
 * evitar el salto de maquetado, quita una petición a un tercero, que en un
 * sistema que maneja datos de menores no es un detalle menor.
 *
 * Se exponen como variables CSS porque `globals.css` las consume desde el bloque
 * `@theme` para armar las utilidades `font-serif` y `font-sans`.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'RIENDA',
    template: '%s · RIENDA',
  },
  description:
    'Red Integral Ecuestre de Negocio, Datos y Administración. Sistema de gestión del ' +
    'Haras Las Lechuzas.',
  applicationName: 'RIENDA',
  // El sistema maneja datos personales y de menores: no tiene nada que hacer en
  // un buscador.
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'RIENDA' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF8F0' },
    { media: '(prefers-color-scheme: dark)', color: '#1B100B' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <RegistrarServiceWorker />
        <Armazon>{children}</Armazon>
      </body>
    </html>
  );
}
