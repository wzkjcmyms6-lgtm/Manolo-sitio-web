// Service worker de Manolo: guarda la app en el iPhone para que abra y
// funcione sin conexión. Los datos (entrenos, finanzas…) los guarda
// Firestore en su propio caché offline (ver js/firebase-init.js).
//
// - Archivos con versión en la URL (css/js/data con ?v=…, Firebase SDK,
//   Google Fonts): nunca cambian, así que se usa la copia guardada.
// - Todo lo demás (index.html, tipo de cambio, íconos): primero la red, y
//   si no hay conexión, la última copia.
// La página le avisa qué archivos cargó (js/offline.js) para guardarlos.
const CACHE = "manolo-app-v1";
const EXTERNOS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

function permitido(url) {
  return url.startsWith(self.location.origin + "/") || EXTERNOS.test(url);
}

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "index.html", "manifest.json"])).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres.filter(n => n.startsWith("manolo-app-") && n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function guardarLista(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all((urls || []).filter(permitido).map(async url => {
    if (await cache.match(url)) return;
    try {
      const propio = url.startsWith(self.location.origin + "/");
      const res = await fetch(url, { mode: propio ? "same-origin" : "no-cors", credentials: "omit" });
      if (res.ok || res.type === "opaque") await cache.put(url, res);
    } catch (err) { /* sin conexión: se intentará la próxima vez */ }
  }));
}

self.addEventListener("message", e => {
  if (e.data && e.data.tipo === "guardar") e.waitUntil(guardarLista(e.data.urls));
});

function conVersion(url) {
  return EXTERNOS.test(url) || /[?&]v=/.test(url);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !permitido(req.url)) return;

  if (conVersion(req.url) && req.mode !== "navigate") {
    e.respondWith(caches.open(CACHE).then(async cache => {
      const copia = await cache.match(req);
      if (copia) return copia;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const clave = req.mode === "navigate" ? "index.html" : req;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(clave, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(clave)) || (await cache.match(req, { ignoreSearch: true })) || Response.error();
    }
  })());
});
