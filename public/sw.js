/*
 * Service worker de la caja — Inversiones Ferrera.
 *
 * Escrito a mano en lugar de @serwist/next: solo hace falta que /caja abra
 * sin conexión, y Serwist exige envolver next.config con su plugin de
 * webpack (sin soporte para Turbopack) y genera el precache en el build. Acá
 * alcanzan ~150 líneas sin dependencias: la caja se cachea al visitarla y
 * cuando la app lo pide con el mensaje "precalentar".
 *
 * Estrategias:
 * - Navegación: red primero. Las páginas de caja se guardan al recibirlas y,
 *   sin red, se sirve la última copia. El resto de las pantallas muestra un
 *   aviso de "sin conexión" con un acceso a la caja.
 * - /_next/static: caché primero (los nombres llevan hash, nunca cambian).
 * - API: no se toca. El catálogo y la cola viven en IndexedDB y los maneja la app.
 */

const VERSION = "v1";
const CACHE_PAGINAS = `ferrera-paginas-${VERSION}`;
const CACHE_ESTATICOS = `ferrera-estaticos-${VERSION}`;
const PAGINAS_CAJA = ["/caja", "/caja/pendientes"];
const ESTATICOS_SUELTOS = ["/icon.svg", "/manifest.webmanifest"];
const MAXIMO_ESTATICOS = 400;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const vigentes = [CACHE_PAGINAS, CACHE_ESTATICOS];
      for (const nombre of await caches.keys()) {
        if (nombre.startsWith("ferrera-") && !vigentes.includes(nombre)) {
          await caches.delete(nombre);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navegar(request, url));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cachePrimero(request));
    return;
  }

  if (ESTATICOS_SUELTOS.includes(url.pathname)) {
    event.respondWith(redPrimero(request));
  }
});

self.addEventListener("message", (event) => {
  const tipo = event.data && event.data.tipo;
  if (tipo === "precalentar") event.waitUntil(precalentar());
  // Al cerrar sesión: las páginas guardadas son de ese usuario.
  if (tipo === "olvidar-paginas") event.waitUntil(caches.delete(CACHE_PAGINAS));
});

function esPaginaDeCaja(url) {
  return PAGINAS_CAJA.includes(url.pathname);
}

/** Respuesta propia, completa y sin redirección (ej. no el redirect al login). */
function sePuedeGuardar(respuesta) {
  return respuesta.ok && respuesta.type === "basic" && !respuesta.redirected;
}

async function navegar(request, url) {
  try {
    const respuesta = await fetch(request);
    if (esPaginaDeCaja(url) && sePuedeGuardar(respuesta)) {
      const cache = await caches.open(CACHE_PAGINAS);
      await cache.put(url.pathname, respuesta.clone());
    }
    return respuesta;
  } catch {
    const cache = await caches.open(CACHE_PAGINAS);
    const guardada = await cache.match(url.pathname, { ignoreSearch: true, ignoreVary: true });
    if (guardada) return guardada;

    const caja = await cache.match("/caja", { ignoreVary: true });
    return paginaSinConexion(Boolean(caja));
  }
}

async function cachePrimero(request) {
  const cache = await caches.open(CACHE_ESTATICOS);
  const guardada = await cache.match(request, { ignoreVary: true });
  if (guardada) return guardada;

  const respuesta = await fetch(request);
  if (sePuedeGuardar(respuesta)) {
    await cache.put(request, respuesta.clone());
    await recortar(cache);
  }
  return respuesta;
}

async function redPrimero(request) {
  const cache = await caches.open(CACHE_ESTATICOS);
  try {
    const respuesta = await fetch(request);
    if (sePuedeGuardar(respuesta)) await cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const guardada = await cache.match(request, { ignoreVary: true });
    if (guardada) return guardada;
    throw new Error("Sin conexión y sin copia guardada.");
  }
}

/** Los estáticos llevan hash: tras varios deploys se acumulan versiones viejas. */
async function recortar(cache) {
  const claves = await cache.keys();
  const sobrantes = claves.length - MAXIMO_ESTATICOS;
  for (let i = 0; i < sobrantes; i++) await cache.delete(claves[i]);
}

/**
 * Guarda las páginas de caja y todo lo que necesitan para abrir sin red: los
 * scripts y estilos que referencia el HTML, y las fuentes que referencia el CSS.
 * Lo pide la app al cargar con conexión, con la sesión vigente (cookies).
 */
async function precalentar() {
  const paginas = await caches.open(CACHE_PAGINAS);
  const estaticos = await caches.open(CACHE_ESTATICOS);

  for (const ruta of PAGINAS_CAJA) {
    try {
      const respuesta = await fetch(ruta, { credentials: "same-origin" });
      if (!sePuedeGuardar(respuesta)) continue;

      // Primero los recursos y al final la página: si la red se corta a mitad
      // de camino, no queda guardada una página que no puede abrir.
      const html = await respuesta.clone().text();
      if (await guardarRecursos(estaticos, html)) await paginas.put(ruta, respuesta);
    } catch {
      // Sin red: se intentará en la próxima carga.
    }
  }

  for (const ruta of ESTATICOS_SUELTOS) {
    try {
      const respuesta = await fetch(ruta);
      if (sePuedeGuardar(respuesta)) await estaticos.put(ruta, respuesta);
    } catch {
      // Ídem.
    }
  }
}

/**
 * Rutas de /_next/static que aparecen en un HTML o CSS. Además de los
 * `<script src>`, el payload RSC del HTML nombra los chunks que se cargan
 * después a demanda, y lo hace sin el prefijo: "static/chunks/118-….js".
 */
function rutasEstaticas(texto) {
  const rutas = new Set();
  for (let ruta of texto.match(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\\\s]+/g) || []) {
    // Los grupos de rutas llevan paréntesis, "(dashboard)"; un `)` sin pareja
    // es el cierre de un `url(...)` del CSS.
    while (ruta.endsWith(")") && ruta.split("(").length < ruta.split(")").length) {
      ruta = ruta.slice(0, -1);
    }
    rutas.add(ruta.startsWith("/_next/") ? ruta : `/_next/${ruta}`);
  }
  return rutas;
}

/** Guarda los recursos que nombra el texto. Devuelve si quedaron todos. */
async function guardarRecursos(cache, texto) {
  let completos = true;

  for (const ruta of rutasEstaticas(texto)) {
    if (await cache.match(ruta, { ignoreVary: true })) continue;
    try {
      const respuesta = await fetch(ruta);
      if (!sePuedeGuardar(respuesta)) {
        completos = false;
        continue;
      }
      if (ruta.endsWith(".css") && !(await guardarRecursos(cache, await respuesta.clone().text()))) {
        completos = false;
      }
      await cache.put(ruta, respuesta);
    } catch {
      completos = false;
    }
  }

  return completos;
}

function paginaSinConexion(hayCaja) {
  const acceso = hayCaja
    ? '<p><a href="/caja">Abrir la caja</a>: se puede seguir cobrando y las ventas se sincronizan al volver la conexión.</p>'
    : "<p>La caja todavía no se guardó en este dispositivo: abrila una vez con conexión.</p>";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sin conexión | Inversiones Ferrera</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f6f3; color: #1f1e1c; font: 15px/1.5 system-ui, sans-serif; padding: 16px; }
  main { max-width: 420px; background: #fff; border: 1px solid #e6e4df; border-radius: 12px; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #6f6c66; margin: 8px 0 0; }
  a { color: #216b38; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>Sin conexión</h1>
  <p>Esta pantalla necesita internet.</p>
  ${acceso}
</main>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
