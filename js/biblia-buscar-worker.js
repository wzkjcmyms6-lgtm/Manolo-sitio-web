// ---------- Biblia: buscar en toda la Biblia sin trabar la pantalla (Worker) ----------
// La pantalla (js/biblia-buscar.js) manda { tipo: "buscar", id, q, libros,
// max, scripts, urls, cache }. La primera vez se leen los 66 libros (de la
// caché "manolo-biblia" o de internet, y quedan guardados) y sus textos
// sin tildes; después cada búsqueda es en memoria. Responde
// { tipo: "progreso", id, n, total }, { tipo: "resultado", id, total, items,
// palabras } o { tipo: "error", id, mensaje }. Lógica: BibliaTexto.buscar
// (js/biblia-texto.js, D-105).
"use strict";

let listos = null;   // promesa: los libros cargados
let libros = null;   // [{ libro, caps, norm }] en el orden de la Biblia

async function cargarTodo(d) {
  const ids = Object.keys(d.urls || {});
  let cache = null;
  try { if (self.caches) cache = await caches.open(d.cache); } catch (e) { cache = null; }
  const out = new Array(ids.length);
  let n = 0;
  const cola = ids.map((id, i) => [id, i]);
  const trabajar = async () => {
    while (cola.length) {
      const [id, i] = cola.shift();
      const url = d.urls[id];
      let res = cache ? await cache.match(url) : null;
      if (!res) {
        res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (cache) await cache.put(url, res.clone());
      }
      const j = await res.json();
      out[i] = { libro: id, caps: j.caps, norm: j.caps.map(c => c.map(t => self.BibliaTexto.norm(t))) };
      postMessage({ tipo: "progreso", id: d.id, n: ++n, total: ids.length });
    }
  };
  await Promise.all([trabajar(), trabajar(), trabajar(), trabajar()]);
  libros = out;
}

self.onmessage = async e => {
  const d = e.data || {};
  if (d.tipo !== "buscar") return;
  try {
    if (!self.BibliaTexto) importScripts(...d.scripts);
    if (!listos) listos = cargarTodo(d);
    await listos;
    const quiero = Array.isArray(d.libros) && d.libros.length ? new Set(d.libros) : null;
    const r = self.BibliaTexto.buscar(quiero ? libros.filter(x => quiero.has(x.libro)) : libros, d.q, d.max || 200);
    postMessage({ tipo: "resultado", id: d.id, total: r.total, items: r.items, palabras: r.palabras });
  } catch (err) {
    listos = null; // se puede intentar otra vez (por ejemplo, al volver internet)
    postMessage({ tipo: "error", id: d.id, mensaje: String((err && err.message) || err) });
  }
};
