// ---------- Lugares: fotos en el teléfono (IndexedDB) ----------
// D-117. Las fotos completas (máximo 1200 px de lado, JPEG calidad 0,75) se
// guardan en ESTE teléfono, en IndexedDB (base "manolo-lugares", almacén
// "fotos"); nunca en localStorage. En el documento del lugar (la nube) queda
// solo una miniatura chiquita de cada foto (máximo 200 px, ~10 KB), así nada
// se pierde del todo si cambias de teléfono o se borra el almacenamiento.
// La copia de seguridad (Exportar) incluye las fotos completas.
//
// Registro: { id, lugarId ("borrador" mientras el formulario no se guarda),
//             blob (image/jpeg), mini (data URL), ancho, alto, creado }
(function () {
"use strict";
const BASE = "manolo-lugares", ALMACEN = "fotos", VERSION = 1;
const MAX_LADO = 1200, CALIDAD = 0.75, MINI_LADO = 200, MINI_CALIDAD = 0.6;
let abierta = null;

function abrir() {
  if (abierta) return abierta;
  abierta = new Promise((res, rej) => {
    if (!("indexedDB" in window)) { rej(new Error("Este navegador no guarda fotos.")); return; }
    const pedido = indexedDB.open(BASE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN, { keyPath: "id" }).createIndex("lugarId", "lugarId");
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
const deLugar = lugarId => operar("readonly", s => s.index("lugarId").getAll(lugarId)).then(r => r || []);
const todas = () => operar("readonly", s => s.getAll()).then(r => r || []);
// Pasa fotos del borrador a su lugar (al guardar el formulario).
function mover(ids, lugarId) {
  return Promise.all((ids || []).map(id => leer(id).then(r => (r && r.lugarId !== lugarId ? guardar(Object.assign(r, { lugarId })) : null))));
}

// ---- Achicar la foto (lienzo) ----
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
const aBlob = (c, calidad) => new Promise((res, rej) => {
  if (c.toBlob) c.toBlob(b => (b ? res(b) : rej(new Error("No pude comprimir la foto."))), "image/jpeg", calidad);
  else fetch(c.toDataURL("image/jpeg", calidad)).then(r => r.blob()).then(res, rej);
});

// Un archivo de la cámara o la galería → registro listo para guardar.
function preparar(archivo, lugarId) {
  if (!archivo || !/^image\//.test(archivo.type || "image/")) return Promise.reject(new Error("Eso no es una foto."));
  return cargar(archivo).then(({ img, url }) => {
    const grande = dibujar(img, MAX_LADO), chica = dibujar(img, MINI_LADO);
    URL.revokeObjectURL(url);
    return aBlob(grande.c, CALIDAD).then(blob => ({
      id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      lugarId: lugarId || "borrador", blob, mini: chica.c.toDataURL("image/jpeg", MINI_CALIDAD),
      ancho: grande.m.ancho, alto: grande.m.alto, creado: Date.now()
    }));
  });
}
// Preparar y guardar; además pide que el navegador no borre tus datos.
function agregar(archivo, lugarId) {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  return preparar(archivo, lugarId).then(reg => guardar(reg).then(() => reg));
}

// ---- Mostrar: una URL por foto (se reusa y se libera al salir) ----
const urls = new Map();
function url(id) {
  if (urls.has(id)) return Promise.resolve(urls.get(id));
  return leer(id).then(r => {
    if (!r || !r.blob) return null;
    const u = URL.createObjectURL(r.blob);
    urls.set(id, u);
    return u;
  }).catch(() => null);
}
function liberar() { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); }

// Para la copia de seguridad: la foto como data URL (y al revés).
const aDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const deDataUrl = d => fetch(d).then(r => r.blob());

window.LugaresFotos = { guardar, leer, borrar, deLugar, todas, mover, preparar, agregar, url, liberar, aDataUrl, deDataUrl, medidas, MAX_LADO, CALIDAD };
})();
