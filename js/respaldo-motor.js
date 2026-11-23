// ---------- Copia de seguridad de TODO Manolo (lógica, sin pantalla) ----------
// D-118. Un solo archivo JSON con todas tus colecciones de users/{uid} (y las
// fotos de Lugares, que viven en el teléfono). Restaurar SOLO AGREGA lo que
// falta: nunca borra ni cambia lo que ya tienes (un documento que ya existe
// se deja como está). Antes de restaurar, la pantalla guarda una copia
// automática de lo actual (js/respaldo.js). Sin DOM: tests/respaldo-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RespaldoMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const VERSION = 1, TIPO = "copia-completa";
// Todo lo tuyo (users/{uid}/…). No van los respaldos internos de Finanzas
// (finanzas_respaldos: copias de lo mismo) ni lo compartido con otros
// (feed, comentarios, accesos).
// nombre: en plural; uno: en singular (para "1 libro").
const COLECCIONES = [
  { id: "habitos", nombre: "hábitos", uno: "hábito" },
  { id: "meta", nombre: "ajustes y planes", uno: "ajuste o plan" },
  { id: "finanzas", nombre: "movimientos de Finanzas", uno: "movimiento de Finanzas" },
  { id: "ahorros", nombre: "registros de Ahorro", uno: "registro de Ahorro" },
  { id: "carteras_movimientos", nombre: "movimientos entre carteras", uno: "movimiento entre carteras" },
  { id: "inversiones", nombre: "movimientos de Inversiones", uno: "movimiento de Inversiones" },
  { id: "entrenamientos", nombre: "entrenos del gimnasio", uno: "entreno del gimnasio" },
  { id: "rutinas", nombre: "rutinas del gimnasio", uno: "rutina del gimnasio" },
  { id: "running", nombre: "actividades de Running", uno: "actividad de Running" },
  { id: "bicicleta", nombre: "salidas en bici", uno: "salida en bici" },
  { id: "rutas", nombre: "recorridos en el mapa", uno: "recorrido en el mapa" },
  { id: "rutinas_running", nombre: "rutinas de Running", uno: "rutina de Running" },
  { id: "run_segmentos", nombre: "segmentos", uno: "segmento" },
  { id: "movilidad", nombre: "sesiones de Movilidad", uno: "sesión de Movilidad" },
  { id: "libros", nombre: "libros", uno: "libro" },
  { id: "libros_frases", nombre: "frases de libros", uno: "frase de libro" },
  { id: "libros_portadas", nombre: "portadas de libros", uno: "portada de libro" },
  { id: "biblia", nombre: "versículos guardados", uno: "versículo guardado" },
  { id: "biblia_marcas", nombre: "marcas de la Biblia", uno: "marca de la Biblia" },
  { id: "tiempos", nombre: "días de Medir tiempos", uno: "día de Medir tiempos" },
  { id: "lugares", nombre: "lugares", uno: "lugar" },
  { id: "ropa", nombre: "prendas de Ropa", uno: "prenda de Ropa" },
  { id: "ropa_usos", nombre: "días con ropa anotada", uno: "día con ropa anotada" },
  { id: "ropa_inspiracion", nombre: "inspiraciones de Ropa", uno: "inspiración de Ropa" },
  { id: "ropa_outfits", nombre: "outfits de Ropa", uno: "outfit de Ropa" },
  { id: "ropa_deseos", nombre: "deseos de Ropa", uno: "deseo de Ropa" }
];
const NOMBRE = Object.fromEntries(COLECCIONES.map(c => [c.id, c.nombre]));
const MAX_BYTES = 150 * 1024 * 1024;   // un archivo más grande no es una copia de Manolo

// ---- Fechas de Firestore (Timestamp) ↔ JSON ----
const esPlano = v => v && typeof v === "object" && !Array.isArray(v);
function codificar(v) {
  if (Array.isArray(v)) return v.map(codificar);
  if (v && typeof v === "object") {
    if (typeof v.toMillis === "function") return { __tipo: "timestamp", ms: v.toMillis() };
    const out = {};
    Object.keys(v).forEach(k => { out[k] = codificar(v[k]); });
    return out;
  }
  return v;
}
// crearTs(ms) → Timestamp de Firestore (si no hay, queda el número).
function decodificar(v, crearTs) {
  if (Array.isArray(v)) return v.map(x => decodificar(x, crearTs));
  if (v && typeof v === "object") {
    if (v.__tipo === "timestamp" && Number.isFinite(v.ms)) return typeof crearTs === "function" ? crearTs(v.ms) : v.ms;
    const out = {};
    Object.keys(v).forEach(k => { out[k] = decodificar(v[k], crearTs); });
    return out;
  }
  return v;
}

// ---- Armar la copia ----
// datos: { colecciones: { nombre: { id: datos } }, fotosLugares: [{ id, lugarId, ancho, alto, datos }],
//          fotosRopa: [{ id, grupoId, clase, ancho, alto, datos }] (D-146) }
function armar(datos, ahora) {
  const d = datos || {};
  const colecciones = {}, conteos = {};
  COLECCIONES.forEach(c => {
    const docs = esPlano(d.colecciones && d.colecciones[c.id]) ? d.colecciones[c.id] : {};
    colecciones[c.id] = codificar(docs);
    conteos[c.id] = Object.keys(docs).length;
  });
  const fotosLugares = (Array.isArray(d.fotosLugares) ? d.fotosLugares : []).filter(fotoOk);
  conteos.fotosLugares = fotosLugares.length;
  const fotosRopa = (Array.isArray(d.fotosRopa) ? d.fotosRopa : []).filter(fotoRopaOk);
  conteos.fotosRopa = fotosRopa.length;
  return { app: "Manolo", tipo: TIPO, version: VERSION, exportado: new Date(ahora || Date.now()).toISOString(), conteos, colecciones, fotosLugares, fotosRopa };
}
const total = conteos => COLECCIONES.reduce((s, c) => s + (conteos && conteos[c.id] || 0), 0);

// ---- Copias de una sola sección ----
// Hábitos y Finanzas tienen su propia copia y su propio "Importar".
const SECCIONES = {
  "manolo-habitos": "Ese archivo es la copia de Hábitos: impórtalo en Hábitos › Ajustes › «Importar una copia».",
  "manolo-finanzas": "Ese archivo es la copia de Finanzas: impórtalo en Finanzas › Ajustes (el engranaje) › «Importar respaldo»."
};
// El "Exportar (JSON)" de Lugares trae los documentos tal cual (con su id) y
// las fotos completas: se restaura igual que una copia de todo (solo Lugares).
function desdeLugares(c) {
  const lugares = {};
  let danados = 0;
  c.lugares.forEach(l => {
    if (esPlano(l) && idOk(l.id)) { const d = Object.assign({}, l); delete d.id; lugares[l.id] = d; } else danados++;
  });
  return { copia: { app: "Manolo", tipo: TIPO, version: 1, exportado: c.exportado || null, colecciones: { lugares }, fotosLugares: Array.isArray(c.fotos) ? c.fotos : [] }, danados };
}

// ---- Revisar un archivo antes de restaurar ----
// Un id de Firestore: texto sin "/", no "." ni "..", no __reservado__.
const idOk = id => typeof id === "string" && id.length > 0 && id.length <= 700 && !id.includes("/") && id !== "." && id !== ".." && !/^__.*__$/.test(id);
const fotoOk = f => esPlano(f) && idOk(f.id) && idOk(f.lugarId) && typeof f.datos === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(f.datos);
// Fotos de Ropa (D-146): de una prenda (o una inspiración), por grupoId.
const fotoRopaOk = f => esPlano(f) && idOk(f.id) && idOk(f.grupoId) && typeof f.datos === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(f.datos);
// → { ok, error } o { ok, colecciones, fotos, danados, desconocidas, exportado, version, seccion }
function validar(copia, bytes) {
  if (bytes && bytes > MAX_BYTES) return { ok: false, error: "Ese archivo es demasiado grande para ser una copia de Manolo." };
  if (!esPlano(copia)) return { ok: false, error: "No pude leer el archivo. Elige una copia guardada desde Manolo (.json)." };
  if (copia.app === "Manolo · Lugares" && Array.isArray(copia.lugares)) {
    if (copia.version !== 1) return { ok: false, error: "Esta copia de Lugares es de una versión más nueva de Manolo. Actualiza la app y vuelve a intentar." };
    const l = desdeLugares(copia);
    const v = validar(l.copia);
    if (v.ok) { v.danados += l.danados; v.seccion = "lugares"; }
    return v;
  }
  if (SECCIONES[copia.app]) return { ok: false, error: SECCIONES[copia.app] };
  if (copia.app !== "Manolo" || copia.tipo !== TIPO) {
    return { ok: false, error: /^Manolo/.test(String(copia.app || ""))
      ? "Ese archivo es el resumen de una sola sección (para guardar o mirar). Para restaurar, usa una «copia de todo» de Manolo."
      : "Ese archivo no es una copia de Manolo." };
  }
  if (!Number.isInteger(copia.version) || copia.version < 1) return { ok: false, error: "La copia está dañada (sin versión)." };
  if (copia.version > VERSION) return { ok: false, error: "Esta copia es de una versión más nueva de Manolo. Actualiza la app y vuelve a intentar." };
  if (!esPlano(copia.colecciones)) return { ok: false, error: "La copia está dañada (sin datos)." };
  const colecciones = {};
  let danados = 0;
  const desconocidas = Object.keys(copia.colecciones).filter(k => !NOMBRE[k]);
  COLECCIONES.forEach(c => {
    const docs = copia.colecciones[c.id];
    colecciones[c.id] = {};
    if (!esPlano(docs)) return;
    Object.keys(docs).forEach(id => {
      if (idOk(id) && esPlano(docs[id])) colecciones[c.id][id] = docs[id]; else danados++;
    });
  });
  const todas = Array.isArray(copia.fotosLugares) ? copia.fotosLugares : [];
  const fotos = todas.filter(fotoOk);
  danados += todas.length - fotos.length;
  const todasRopa = Array.isArray(copia.fotosRopa) ? copia.fotosRopa : [];
  const fotosRopa = todasRopa.filter(fotoRopaOk);
  danados += todasRopa.length - fotosRopa.length;
  return { ok: true, colecciones, fotos, fotosRopa, danados, desconocidas, exportado: copia.exportado || null, version: copia.version, seccion: null };
}

// ---- Qué se agregaría ----
// actuales: { nombre: [ids] | Set }; fotosActuales y fotosRopaActuales: [ids] | Set.
// Solo entra lo que NO existe; lo que ya tienes no se toca.
function plan(v, actuales, fotosActuales, fotosRopaActuales) {
  const nuevos = {}, porColeccion = [];
  let totalNuevos = 0, totalYaTenias = 0;
  COLECCIONES.forEach(c => {
    const ya = actuales && actuales[c.id] instanceof Set ? actuales[c.id] : new Set((actuales && actuales[c.id]) || []);
    const docs = (v.colecciones && v.colecciones[c.id]) || {};
    const ids = Object.keys(docs);
    nuevos[c.id] = ids.filter(id => !ya.has(id)).map(id => ({ id, data: docs[id] }));
    const n = nuevos[c.id].length, t = ids.length - n;
    totalNuevos += n; totalYaTenias += t;
    if (ids.length) porColeccion.push({ id: c.id, nombre: c.nombre, uno: c.uno, nuevos: n, yaTenias: t });
  });
  const yaFotos = fotosActuales instanceof Set ? fotosActuales : new Set(fotosActuales || []);
  const fotosNuevas = (v.fotos || []).filter(f => !yaFotos.has(f.id));
  const yaRopa = fotosRopaActuales instanceof Set ? fotosRopaActuales : new Set(fotosRopaActuales || []);
  const fotosRopaNuevas = (v.fotosRopa || []).filter(f => !yaRopa.has(f.id));
  return { nuevos, porColeccion, totalNuevos, totalYaTenias, fotosNuevas, fotosRopaNuevas, vacio: !totalNuevos && !fotosNuevas.length && !fotosRopaNuevas.length };
}

// "12 movimientos de Finanzas, 1 libro y 2 lugares".
function lista(xs) { return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`; }
function resumen(p) {
  const partes = p.porColeccion.filter(c => c.nuevos).map(c => `${c.nuevos.toLocaleString("es-BO")} ${c.nuevos === 1 ? c.uno : c.nombre}`);
  if (p.fotosNuevas.length) partes.push(`${p.fotosNuevas.length.toLocaleString("es-BO")} ${p.fotosNuevas.length === 1 ? "foto de Lugares" : "fotos de Lugares"}`);
  const fr = (p.fotosRopaNuevas || []).length;
  if (fr) partes.push(`${fr.toLocaleString("es-BO")} ${fr === 1 ? "foto de Ropa" : "fotos de Ropa"}`);
  return lista(partes);
}

return { VERSION, TIPO, COLECCIONES, NOMBRE, MAX_BYTES, codificar, decodificar, armar, total, idOk, fotoOk, fotoRopaOk, validar, plan, resumen, lista };
});
