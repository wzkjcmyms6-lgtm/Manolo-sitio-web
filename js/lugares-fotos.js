// ---------- Fotos en el teléfono (IndexedDB): Lugares y Ropa ----------
// D-117. Las fotos completas (máximo 1200 px de lado, JPEG calidad 0,75) se
// guardan en ESTE teléfono, en IndexedDB (base "manolo-lugares", almacén
// "fotos"); nunca en localStorage. En el documento del lugar (la nube) queda
// solo una miniatura chiquita de cada foto (máximo 200 px, ~10 KB), así nada
// se pierde del todo si cambias de teléfono o se borra el almacenamiento.
// La copia de seguridad (Exportar) incluye las fotos completas.
// Ropa (D-146) usa lo mismo con su propia base: FotosLocales.crear({ base:
// "manolo-ropa", campo: "grupoId" }) (js/ropa-datos.js).
//
// Registro: { id, lugarId ("borrador" mientras el formulario no se guarda),
//             blob (image/jpeg), mini (data URL), ancho, alto, creado }
//           (en Ropa, grupoId en vez de lugarId, y clase: "prenda" | "inspiracion")
(function () {
"use strict";
const VERSION = 1;
const MAX_LADO = 1200, CALIDAD = 0.75, MINI_LADO = 200, MINI_CALIDAD = 0.6;

// cfg: { base, campo, media } → las funciones de abajo para esa base.
// media (px, opcional): además de la grande, una mediana para las grillas
// (Ropa: 480 px), así el teléfono no decodifica decenas de fotos de 1200 px.
function crear(cfg) {
const BASE = cfg.base, ALMACEN = "fotos", CAMPO = cfg.campo || "lugarId", MEDIA = cfg.media || 0;
let abierta = null;

function abrir() {
  if (abierta) return abierta;
  abierta = new Promise((res, rej) => {
    if (!("indexedDB" in window)) { rej(new Error("Este navegador no guarda fotos.")); return; }
    const pedido = indexedDB.open(BASE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN, { keyPath: "id" }).createIndex(CAMPO, CAMPO);
    };
    pedido.onsuccess = () => { const db = pedido.result; db.onversionchange = () => { db.close(); abierta = null; }; res(db); };
    pedido.onerror = () => rej(pedido.error);
    pedido.onblocked = () => rej(new Error("Las fotos están ocupadas en otra pestaña."));
  });
  abierta.catch(() => { abierta = null; });
  return abierta;
}
// Una operación en el almacén: hacer(almacen) devuelve un pedido (o nada).
function operar(modo, hacer) {
  return abrir().then(db => new Promise((res, rej) => {
    const t = db.transaction(ALMACEN, modo);
    const p = hacer(t.objectStore(ALMACEN));
    t.oncomplete = () => res(p ? p.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error("No se pudo guardar la foto."));
  }));
}
const guardar = reg => operar("readwrite", s => s.put(reg));
const leer = id => operar("readonly", s => s.get(id)).then(r => r || null);
const borrar = id => operar("readwrite", s => s.delete(id));
const deGrupo = grupoId => operar("readonly", s => s.index(CAMPO).getAll(grupoId)).then(r => r || []);
const todas = () => operar("readonly", s => s.getAll()).then(r => r || []);
// Pasa fotos del borrador a su lugar (al guardar el formulario).
function mover(ids, grupoId) {
  return Promise.all((ids || []).map(id => leer(id).then(r => (r && r[CAMPO] !== grupoId ? guardar(Object.assign(r, { [CAMPO]: grupoId })) : null))));
}

// Un archivo de la cámara o la galería → registro listo para guardar.
// extra: campos que se suman al registro (en Ropa, la clase).
function preparar(archivo, grupoId, extra) {
  if (!archivo || !/^image\//.test(archivo.type || "image/")) return Promise.reject(new Error("Eso no es una foto."));
  return cargar(archivo).then(({ img, url }) => {
    const grande = dibujar(img, MAX_LADO), chica = dibujar(img, MINI_LADO), mediana = MEDIA ? dibujar(img, MEDIA) : null;
    URL.revokeObjectURL(url);
    return Promise.all([aBlob(grande.c, CALIDAD), mediana ? aBlob(mediana.c, MEDIA_CALIDAD) : null]).then(([blob, media]) => Object.assign({
      id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      [CAMPO]: grupoId || "borrador", blob, mini: chica.c.toDataURL("image/jpeg", MINI_CALIDAD),
      ancho: grande.m.ancho, alto: grande.m.alto, creado: Date.now()
    }, media ? { media } : {}, extra || {}));
  });
}
// Preparar y guardar; además pide que el navegador no borre tus datos.
function agregar(archivo, grupoId, extra) {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  return preparar(archivo, grupoId, extra).then(reg => guardar(reg).then(() => reg));
}

// ---- Mostrar: una URL por foto (se reusa y se libera al salir) ----
// url(id) → la grande; url(id, "media") → la mediana (si falta, se hace una
// vez desde la grande y se guarda; si no se puede, la grande).
const urls = new Map();
function url(id, cual) {
  const clave = cual === "media" && MEDIA ? `${id}:media` : id;
  if (urls.has(clave)) return Promise.resolve(urls.get(clave));
  return leer(id).then(r => {
    if (!r || !r.blob) return null;
    if (clave === id) return r.blob;
    if (r.media) return r.media;
    return achicar(r.blob, MEDIA).then(media => guardar(Object.assign(r, { media })).then(() => media, () => media)).catch(() => r.blob);
  }).then(b => {
    if (!b) return null;
    const u = URL.createObjectURL(b);
    urls.set(clave, u);
    return u;
  }).catch(() => null);
}
function liberar() { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); }

return { guardar, leer, borrar, deGrupo, todas, mover, preparar, agregar, url, liberar, aDataUrl, deDataUrl, medidas, MAX_LADO, CALIDAD, CAMPO };
}

// ---- Achicar la foto (lienzo): igual para todas las bases ----
function cargar(archivo) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No pude leer esa imagen. Prueba con otra foto.")); };
    img.src = url;
  });
}
function medidas(ancho, alto, max) {
  const k = Math.min(1, max / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * k)), alto: Math.max(1, Math.round(alto * k)) };
}
function dibujar(img, max) {
  const m = medidas(img.naturalWidth || img.width, img.naturalHeight || img.height, max);
  const c = document.createElement("canvas");
  c.width = m.ancho;
  c.height = m.alto;
  const g = c.getContext("2d");
  g.fillStyle = "#111";          // las PNG con transparencia quedan sobre oscuro
  g.fillRect(0, 0, m.ancho, m.alto);
  g.drawImage(img, 0, 0, m.ancho, m.alto);
  return { c, m };
}
const MEDIA_CALIDAD = 0.7;
// Una foto guardada (Blob) más chica.
function achicar(blob, max) {
  return cargar(blob).then(({ img, url }) => {
    const d = dibujar(img, max);
    URL.revokeObjectURL(url);
    return aBlob(d.c, MEDIA_CALIDAD);
  });
}
const aBlob = (c, calidad) => new Promise((res, rej) => {
  if (c.toBlob) c.toBlob(b => (b ? res(b) : rej(new Error("No pude comprimir la foto."))), "image/jpeg", calidad);
  else fetch(c.toDataURL("image/jpeg", calidad)).then(r => r.blob()).then(res, rej);
});
// Para la copia de seguridad: la foto como data URL (y al revés).
const aDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const deDataUrl = d => fetch(d).then(r => r.blob());

const L = crear({ base: "manolo-lugares", campo: "lugarId" });
window.LugaresFotos = Object.assign(L, { deLugar: L.deGrupo });
window.FotosLocales = { crear };
})();
