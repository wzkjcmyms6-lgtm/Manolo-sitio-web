// ---------- Running: qué se guarda al importar (sin pantalla) ----------
// Arma el documento de la actividad (running/ o bicicleta/) y su ruta
// (rutas/{mismo id}), detecta duplicadas y lo que se puede fusionar con una
// rutina guiada o una carrera anotada a mano, y reparte las escrituras en
// lotes que Firestore acepta (≤ 400 operaciones y ≤ 5 MB). D-062, D-063, D-067.
// Pruebas: tests/run-guardar.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-metricas.js"));
  else root.RunGuardar = factory(root.RunMetricas);
})(typeof self !== "undefined" ? self : this, function (RunMetricas) {
"use strict";

const MARGEN_INICIO_MS = 2 * 60 * 1000;
const MARGEN_DIST = 0.03;
const LOTE_OPS = 400;
const LOTE_BYTES = 5 * 1024 * 1024;

const colDe = deporte => (deporte === "bicicleta" ? "bicicleta" : "running");

// Id estable: el mismo archivo importado dos veces da el mismo id (no se duplica).
function idPara(nueva) {
  if (nueva.origen && nueva.origen.idExterno) return `imp_${String(nueva.origen.idExterno).replace(/[^\w-]/g, "").slice(0, 40)}`;
  return `imp_${Math.round(nueva.campos.inicio / 1000)}_${Math.round(nueva.campos.distanciaM || 0)}`;
}

// Documento final (campos del motor + lo propio de la importación).
// nueva = { deporte, subtipo, titulo, descripcion, origen, campos }
function documento(nueva, ahora) {
  const c = nueva.campos;
  const doc = Object.assign({ v: 2, fuente: "importado" }, c, {
    deporte: colDe(nueva.deporte),
    titulo: (nueva.titulo || RunMetricas.tituloAuto(nueva.deporte, c.inicio)).slice(0, 120),
    notes: (nueva.descripcion || "").slice(0, 2000),
    origen: limpiarOrigen(nueva.origen),
    importado: ahora
  });
  if (nueva.subtipo) doc.subtipo = nueva.subtipo;
  return doc;
}
function limpiarOrigen(o) {
  const out = {};
  Object.keys(o || {}).forEach(k => { if (o[k] != null && o[k] !== "") out[k] = String(o[k]).slice(0, 200); });
  return out;
}

const cercaDist = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= MARGEN_DIST;
const distKm = d => Number(d.distanciaM) > 0 ? d.distanciaM / 1000 : Number(d.distance) || 0;

// ¿Qué hacer con una actividad nueva frente a lo que ya existe?
// existentes: [{ id, ...documento }] de la misma colección.
// → { accion: "nueva" } | { accion: "duplicada", id } | { accion: "fusionar", id, con: "rutina" | "manual" }
function clasificar(nueva, existentes) {
  const c = nueva.campos;
  const km = c.distanciaM / 1000;
  const id = idPara(nueva);
  for (const e of existentes) {
    if (e.id === id) return { accion: "duplicada", id: e.id };
    if (e.origen && nueva.origen && e.origen.idExterno && e.origen.idExterno === nueva.origen.idExterno) return { accion: "duplicada", id: e.id };
  }
  for (const e of existentes) {
    if (e.fuente === "rutina" || e.fuente === "importado" || e.fuente === "gps") {
      const ini = Number(e.inicio);
      if (!(ini > 0)) continue;
      const mismoInicio = Math.abs(ini - c.inicio) <= MARGEN_INICIO_MS;
      if (e.fuente === "rutina" && !e.conRuta) {
        // Rutina guiada: los horarios se cruzan en más de la mitad.
        const fin = Number(e.fin) > ini ? Number(e.fin) : ini + (Number(e.duration) || 0) * 60000;
        const cruce = Math.min(fin, c.fin) - Math.max(ini, c.inicio);
        const menor = Math.min(fin - ini, c.fin - c.inicio);
        if (menor > 0 && cruce > 0.5 * menor) return { accion: "fusionar", id: e.id, con: "rutina" };
        continue;
      }
      if (mismoInicio && (cercaDist(distKm(e), km) || !(distKm(e) > 0))) return { accion: "duplicada", id: e.id };
    }
  }
  for (const e of existentes) {
    // Anotada a mano: mismo día y la misma distancia (o sin km).
    if (e.fuente || e.inicio) continue;
    if (e.date === c.date && (cercaDist(Number(e.distance) || 0, km) || !(Number(e.distance) > 0))) return { accion: "fusionar", id: e.id, con: "manual" };
  }
  return { accion: "nueva" };
}

// Campos que se agregan al fusionar: se conserva lo del dueño (rutina, RPE,
// notas, fecha) y los km/min anteriores quedan en `previo`.
function fusion(existente, doc) {
  const out = {};
  Object.keys(doc).forEach(k => {
    if (["v", "fuente", "date", "notes", "rpe", "rutina"].includes(k)) return;
    out[k] = doc[k];
  });
  out.previo = { distance: Number(existente.distance) || 0, duration: Number(existente.duration) || 0 };
  // La hora de la rutina (del teléfono) sirve para sombrear sus intervalos en el gráfico.
  if (Number(existente.inicio) > 0) { out.previo.inicio = Number(existente.inicio); if (Number(existente.fin) > 0) out.previo.fin = Number(existente.fin); }
  out.fusionado = doc.importado;
  if (existente.notes && doc.notes && !String(existente.notes).includes(doc.notes)) out.notes = `${existente.notes}\n${doc.notes}`.slice(0, 2000);
  else if (!existente.notes && doc.notes) out.notes = doc.notes;
  if (existente.fuente === "rutina") { out.fuente = "rutina"; out.conImportado = true; }
  else out.fuente = "importado";
  if (!existente.titulo && doc.titulo) out.titulo = doc.titulo;
  return out;
}

// Reparte operaciones [{ tipo: "set" | "update", ruta: "running/x", datos }] en lotes.
function lotes(ops) {
  const out = [];
  let actual = [], bytes = 0;
  ops.forEach(op => {
    const tam = JSON.stringify(op.datos).length + 200;
    if (actual.length && (actual.length >= LOTE_OPS || bytes + tam > LOTE_BYTES)) { out.push(actual); actual = []; bytes = 0; }
    actual.push(op);
    bytes += tam;
  });
  if (actual.length) out.push(actual);
  return out;
}

// Operaciones para guardar una actividad ya clasificada.
function operaciones(nueva, clase, existente, ahora) {
  const col = colDe(nueva.deporte);
  const doc = documento(nueva, ahora);
  const ops = [];
  let id;
  if (clase.accion === "fusionar") {
    id = clase.id;
    ops.push({ tipo: "update", ruta: `${col}/${id}`, datos: fusion(existente || {}, doc) });
  } else {
    id = idPara(nueva);
    ops.push({ tipo: "set", ruta: `${col}/${id}`, datos: doc });
  }
  if (nueva.ruta) ops.push({ tipo: "set", ruta: `rutas/${id}`, datos: nueva.ruta });
  return { id, col, ops, doc };
}

return { clasificar, fusion, documento, lotes, operaciones, idPara, colDe, MARGEN_INICIO_MS, LOTE_OPS, LOTE_BYTES };
});
