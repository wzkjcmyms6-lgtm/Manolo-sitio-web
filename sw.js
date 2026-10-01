// Service worker de Manolo: guarda la app en el teléfono para que abra y
// funcione sin conexión. Los datos (entrenos, finanzas…) los guarda
// Firestore en su propio caché offline (ver js/firebase-init.js).
//
// Cómo funciona:
// - Al instalarse, descarga index.html y TODO lo que index.html carga (css,
//   js, fuentes, Firebase, íconos) y lo guarda en un caché con el número de
//   VERSION. Así la app abre en modo avión desde la primera visita completa.
// - La app se sirve siempre desde ese caché (rápido y sin red). Cuando se
//   publica una versión nueva (VERSION distinta), el teléfono la descarga en
//   segundo plano y Manolo muestra "Nueva versión disponible · Actualizar".
// - Al activarse una versión, se borran los cachés viejos.
// - El tipo de cambio (data/tipo-cambio.json) va primero a la red y, sin
//   conexión, usa la última copia.
//
// IMPORTANTE: cada entrega que cambie la app debe subir VERSION y HUELLA con
// `npm run sw` (el test tests/sw-version.test.js falla si alguien lo olvida).
const VERSION = "2026-10-01.13";
const HUELLA = "2fa2704a08fa";
const PREFIJO = "manolo-app-";
const CACHE = PREFIJO + VERSION;
const DATOS = "manolo-datos"; // copias de respaldo de datos que cambian solos (tipo de cambio)

// Archivos que no aparecen en index.html pero la app necesita.
const EXTRAS = ["./", "manifest.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "js/importar-rutinas.js", "js/importar-ui.js"];

function propio(url) {
  return new URL(url, self.location.href).origin === self.location.origin;
}

// Rutas locales que carga un HTML (src/href) o un CSS (url(...)).
function recursosDe(texto, base) {
  const out = new Set();
  const re = /(?:src|href)\s*=\s*"([^"#]+)"|url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let m;
  while ((m = re.exec(texto))) {
    const ruta = m[1] || m[2];
    if (!ruta || /^(#|data:|mailto:|tel:|javascript:)/.test(ruta)) continue;
    const abs = new URL(ruta, base).href;
    if (propio(abs)) out.add(abs);
  }
  return out;
}
// Datos con versión que pide el JS (ej. data/ejercicios.json?v=…).
function datosDeJs(texto) {
  const out = new Set();
  const re = /["'](data\/[\w.-]+\.json\?v=[\w.-]+)["']/g;
  let m;
  while ((m = re.exec(texto))) out.add(new URL(m[1], self.location.href).href);
  return out;
}

async function precargar() {
  const cache = await caches.open(CACHE);
  const base = new URL("index.html", self.location.href).href;
  const pagina = await fetch(base, { cache: "reload" });
  if (!pagina.ok) throw new Error("No se pudo descargar index.html");
  const html = await pagina.clone().text();
  await cache.put(base, pagina);

  const pendientes = recursosDe(html, base);
  EXTRAS.forEach(r => pendientes.add(new URL(r, self.location.href).href));
  pendientes.delete(base);
  const hechos = new Set([base]);
  // Los CSS pueden traer fuentes y los JS, datos: se revisan también.
  while (pendientes.size) {
    const lote = Array.from(pendientes);
    pendientes.clear();
    await Promise.all(lote.map(async url => {
      if (hechos.has(url)) return;
      hechos.add(url);
      const res = await fetch(url, { cache: "reload" });
      if (!res.ok) throw new Error("No se pudo descargar " + url);
      const ruta = new URL(url).pathname;
      if (/\.css$/.test(ruta)) recursosDe(await res.clone().text(), url).forEach(u => pendientes.add(u));
      else if (/\.js$/.test(ruta) && !/\/vendor\//.test(ruta)) datosDeJs(await res.clone().text()).forEach(u => pendientes.add(u));
      await cache.put(url, res);
    }));
  }
}

self.addEventListener("install", e => {
  // No se activa sola: espera a que la persona toque "Actualizar" (o a que
  // cierre la app). La primera instalación se activa enseguida igual,
  // porque no hay otra versión en uso.
  e.waitUntil(precargar());
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres
        .filter(n => n.startsWith(PREFIJO) && n !== CACHE)
        .map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// La página pide activar la versión nueva ("Actualizar") o guardar archivos
// que cargó después (por si alguno no estaba en la lista).
async function guardarLista(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all((urls || []).filter(propio).map(async url => {
    if (/\/data\/tipo-cambio\.json/.test(url) || /\/sw\.js/.test(url)) return;
    if (await cache.match(url)) return;
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (res.ok) await cache.put(url, res);
    } catch (err) { /* sin conexión: se intentará la próxima vez */ }
  }));
}

self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.tipo === "activar") self.skipWaiting();
  else if (d.tipo === "guardar") e.waitUntil(guardarLista(d.urls));
  else if (d.tipo === "version" && e.source) e.source.postMessage({ tipo: "version", version: VERSION });
});

async function desdeCache(req) {
  const cache = await caches.open(CACHE);
  const copia = await cache.match(req, { ignoreVary: true });
  if (copia) return copia;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") cache.put(req, res.clone());
  return res;
}

// Navegar a la app: siempre la versión guardada (abre al instante y sin red).
async function pagina(req) {
  const cache = await caches.open(CACHE);
  const indice = new URL("index.html", self.location.href).href;
  const ruta = new URL(req.url).pathname;
  const esIndice = ruta.endsWith("/") || ruta.endsWith("/index.html");
  if (esIndice) {
    const copia = await cache.match(indice);
    if (copia) return copia;
  }
  try {
    return await fetch(req);
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match(indice)) || Response.error();
  }
}

// Tipo de cambio: primero la red; sin conexión, la última copia (una sola,
// sin importar el ?t= que agrega la página).
async function redPrimero(req) {
  const cache = await caches.open(DATOS);
  const clave = new URL(req.url).origin + new URL(req.url).pathname;
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(clave, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(clave)) || Response.error();
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !propio(req.url)) return; // Firebase (red) pasa directo
  if (req.mode === "navigate") { e.respondWith(pagina(req)); return; }
  if (/\/data\/tipo-cambio\.json$/.test(new URL(req.url).pathname)) { e.respondWith(redPrimero(req)); return; }
  e.respondWith(desdeCache(req));
});
