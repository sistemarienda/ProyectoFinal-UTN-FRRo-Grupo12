// M14 · Service worker de RIENDA.
//
// Corre fuera del bundle de la aplicación (Next no lo empaqueta ni lo tipa),
// así que es JavaScript llano y no puede importar `src/lib/offline.ts`. La
// lista de abajo tiene que coincidir a mano con `RUTAS_SIN_CONEXION` de ese
// archivo, que es la fuente de verdad documentada.
//
// Alcance deliberado: sólo la jornada del peón, las dos planillas de registro
// y la consulta de caballos quedan disponibles sin conexión
// (`02-sitemap-por-perfil.md`, perfil 2). Ninguna pantalla de gerencia se
// cachea a propósito: mostrarle al dueño una cobranza o una facturación
// vieja creyendo que está al día es peor que no mostrar nada.
//
// Estrategia: NetworkFirst por prefijo de ruta para las páginas permitidas
// (intenta la red, si falla sirve lo último bueno cacheado) y CacheFirst para
// los estáticos de `_next/static/`, que vienen con hash en el nombre y son
// inmutables por construcción. Todo lo demás —API de tRPC, gerencia, el
// resto del sitio— pasa directo a la red y no se cachea nunca: es justo lo
// que no se quiere ofrecer con datos desactualizados.
const CACHE = 'rienda-v1';

const RUTAS_SIN_CONEXION = ['/campo/hoy', '/campo/alimentacion', '/campo/higiene', '/caballos'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

function esRutaSinConexion(pathname) {
  return RUTAS_SIN_CONEXION.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function esEstaticoDeNext(pathname) {
  return pathname.startsWith('/_next/static/');
}

async function networkFirst(peticion) {
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) {
      const cache = await caches.open(CACHE);
      cache.put(peticion, respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    const cache = await caches.open(CACHE);
    const enCache = await cache.match(peticion);
    if (enCache) return enCache;

    // Sin red y sin nada guardado todavía: la pantalla nunca se visitó en
    // línea. Una respuesta explicable, no el error crudo del navegador.
    if (peticion.mode === 'navigate') {
      return new Response(
        '<!doctype html><html lang="es-AR"><meta charset="utf-8">' +
          '<title>Sin conexión · RIENDA</title>' +
          '<body style="font-family:system-ui;padding:2rem;color:#2A1812;background:#FBF8F0">' +
          '<h1>Sin conexión</h1>' +
          '<p>Esta pantalla todavía no se guardó en este dispositivo. Conectate una vez para dejarla disponible sin conexión.</p>' +
          '</body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }
    throw error;
  }
}

async function cacheFirst(peticion) {
  const cache = await caches.open(CACHE);
  const enCache = await cache.match(peticion);
  if (enCache) return enCache;

  const respuesta = await fetch(peticion);
  if (respuesta.ok) cache.put(peticion, respuesta.clone());
  return respuesta;
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return; // nunca se cachea una escritura
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  if (esEstaticoDeNext(url.pathname)) {
    evento.respondWith(cacheFirst(peticion));
    return;
  }

  if (esRutaSinConexion(url.pathname)) {
    evento.respondWith(networkFirst(peticion));
  }
});
