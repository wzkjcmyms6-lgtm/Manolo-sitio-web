// ---------- Biblia: resaltados, favoritos y notas (sin pantalla) ----------
// Lo que se marca en el lector (fase 2, D-105). Un documento por libro en
// users/{uid}/biblia_marcas/{libro} (máx. 66, así nunca se acerca al límite
// de 1 MB de Firestore):
//   { v: 1,
//     col: { "3_16": "amarillo", … },                       // resaltado por versículo
//     it:  { "3_16": { r: "16-17", f: true, n: "nota", t: "texto", d: "AAAA-MM-DD", ts } },
//     actualizado }
// `it` guarda favoritos y notas en el primer versículo de lo elegido (r = los
// versículos, como en el formulario; t = el texto original de la RV1909).
// Aquí: claves, lo que hay que pintar en un capítulo, los cambios a guardar
// (con `merge`; el borrado se recibe como parámetro: FieldValue.delete() en
// la app) y la lista "Marcados". Sin DOM ni Firebase: tests/biblia-marcas.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./biblia-motor.js"), require("./biblia-texto.js"));
  else root.BibliaMarcas = factory(root.BibliaMotor, root.BibliaTexto);
})(typeof self !== "undefined" ? self : this, function (B, T) {
"use strict";

const COLORES = [
  { id: "amarillo", nombre: "Amarillo", hex: "#ffd166" },
  { id: "naranja", nombre: "Naranja", hex: "#ff9a3c" },
  { id: "verde", nombre: "Verde", hex: "#4cc38a" },
  { id: "azul", nombre: "Azul", hex: "#5aa9ff" },
  { id: "rosa", nombre: "Rosa", hex: "#ff7aa8" }
];
const COLOR = {};
COLORES.forEach(c => { COLOR[c.id] = c; });
const NOTA_MAX = 1000;
const TEXTO_MAX = 2000;

const clave = (cap, v) => `${cap}_${v}`;
function leerClave(k) {
  const m = /^(\d+)_(\d+)$/.exec(String(k || ""));
  return m ? { cap: Number(m[1]), v: Number(m[2]) } : null;
}
const esObj = x => !!x && typeof x === "object" && !Array.isArray(x);

// Documento de Firestore → { col, it } limpio (lo raro se ignora).
function normalizarDoc(d) {
  const col = {}, it = {};
  if (esObj(d) && esObj(d.col)) Object.keys(d.col).forEach(k => { if (leerClave(k) && COLOR[d.col[k]]) col[k] = d.col[k]; });
  if (esObj(d) && esObj(d.it)) Object.keys(d.it).forEach(k => {
    const x = d.it[k], c = leerClave(k);
    if (!c || !esObj(x) || !(x.f === true || (typeof x.n === "string" && x.n.trim()))) return;
    const nums = T.numeros(x.r) || [c.v];
    it[k] = { r: T.spec(nums), f: x.f === true, n: typeof x.n === "string" ? x.n : "", t: typeof x.t === "string" ? x.t : "",
      d: typeof x.d === "string" ? x.d : "", ts: typeof x.ts === "number" ? x.ts : 0 };
  });
  return { col, it };
}

// Lo que hay que pintar en un capítulo: { colores: { v: color }, items: [{ v, nums, f, n, r }] }.
function delCapitulo(doc, cap) {
  const colores = {}, items = [];
  const d = doc || { col: {}, it: {} };
  Object.keys(d.col || {}).forEach(k => { const c = leerClave(k); if (c && c.cap === Number(cap)) colores[c.v] = d.col[k]; });
  Object.keys(d.it || {}).forEach(k => {
    const c = leerClave(k);
    if (!c || c.cap !== Number(cap)) return;
    const x = d.it[k];
    items.push({ v: c.v, nums: T.numeros(x.r) || [c.v], f: !!x.f, n: x.n || "", r: x.r });
  });
  items.sort((a, b) => a.v - b.v);
  return { colores, items };
}

// ---- Cambios a guardar (objetos para set(…, { merge: true })) ----
// Resaltar (o quitar con color = null) varios versículos de un capítulo.
function parcheColor(cap, nums, color, BORRAR) {
  const col = {};
  (nums || []).forEach(v => { col[clave(cap, v)] = color && COLOR[color] ? color : BORRAR; });
  return { col };
}
// Favorito (si = true/false) para lo elegido; actual = el item guardado en
// el primer versículo (si había). texto = el de la RV1909 (original).
function parcheFavorito(cap, nums, si, o, BORRAR) {
  const ns = (nums || []).slice().sort((a, b) => a - b);
  if (!ns.length) return null;
  const k = clave(cap, ns[0]);
  const actual = o && o.actual;
  if (si) return { it: { [k]: { f: true, r: T.spec(ns), t: String(o.texto || "").slice(0, TEXTO_MAX), d: o.fecha, ts: o.ahora } } };
  if (!actual) return null;
  // Si tiene nota, solo se quita la estrella; si no, el item entero.
  return { it: { [k]: actual.n ? { f: BORRAR } : BORRAR } };
}
// Nota (vacía = borrarla) para lo elegido.
function parcheNota(cap, nums, nota, o, BORRAR) {
  const ns = (nums || []).slice().sort((a, b) => a - b);
  if (!ns.length) return null;
  const k = clave(cap, ns[0]);
  const actual = o && o.actual;
  const n = String(nota || "").replace(/\r\n?/g, "\n").trim().slice(0, NOTA_MAX);
  if (n) return { it: { [k]: { n, r: T.spec(ns), t: String(o.texto || "").slice(0, TEXTO_MAX), d: o.fecha, ts: o.ahora } } };
  if (!actual) return null;
  return { it: { [k]: actual.f ? { n: BORRAR } : BORRAR } };
}
// El item (favorito o nota) que cubre exactamente esos versículos, o el que
// empieza en el primero.
function itemDe(doc, cap, nums) {
  const ns = (nums || []).slice().sort((a, b) => a - b);
  if (!ns.length || !doc) return null;
  return (doc.it || {})[clave(cap, ns[0])] || null;
}

// Versículos seguidos del mismo color → rangos ("16-18").
function rangosColor(col) {
  const porCap = {};
  Object.keys(col || {}).forEach(k => {
    const c = leerClave(k);
    if (!c) return;
    (porCap[c.cap] = porCap[c.cap] || []).push({ v: c.v, color: col[k] });
  });
  const out = [];
  Object.keys(porCap).map(Number).sort((a, b) => a - b).forEach(cap => {
    const vs = porCap[cap].sort((a, b) => a.v - b.v);
    let ini = null;
    vs.forEach((x, i) => {
      if (!ini) ini = { cap, desde: x.v, hasta: x.v, color: x.color };
      else if (x.v === ini.hasta + 1 && x.color === ini.color) ini.hasta = x.v;
      else { out.push(ini); ini = { cap, desde: x.v, hasta: x.v, color: x.color }; }
      if (i === vs.length - 1) out.push(ini);
    });
  });
  return out;
}

// La lista "Marcados": docs = { libro: doc normalizado }; filtro: "todo",
// "fav", "nota" o un color. En el orden de la Biblia.
// → [{ tipo: "fav" | "nota" | "color", libro, cap, nums, versiculo, cita, color, texto, nota, d }]
function lista(docs, filtro) {
  const f = filtro || "todo";
  const out = [];
  B.LIBROS.forEach(l => {
    const d = docs && docs[l.id];
    if (!d) return;
    const items = [];
    Object.keys(d.it || {}).forEach(k => {
      const c = leerClave(k), x = d.it[k];
      const nums = T.numeros(x.r) || [c.v];
      const base = { libro: l.id, cap: c.cap, nums, versiculo: T.spec(nums), cita: T.cita(l.id, c.cap, T.spec(nums)), texto: x.t || "", nota: x.n || "", d: x.d || "", fav: !!x.f };
      // Con estrella y nota: un solo item (favorito, con su nota a la vista).
      if (x.f && (f === "todo" || f === "fav")) items.push(Object.assign({ tipo: "fav" }, base));
      else if (x.n && (f === "todo" || f === "nota")) items.push(Object.assign({ tipo: "nota" }, base));
    });
    if (f === "todo" || COLOR[f]) {
      rangosColor(d.col).forEach(r => {
        if (COLOR[f] && r.color !== f) return;
        const nums = [];
        for (let v = r.desde; v <= r.hasta; v++) nums.push(v);
        items.push({ tipo: "color", libro: l.id, cap: r.cap, nums, versiculo: T.spec(nums), cita: T.cita(l.id, r.cap, T.spec(nums)), color: r.color, texto: "", nota: "", d: "" });
      });
    }
    items.sort((a, b) => a.cap - b.cap || a.nums[0] - b.nums[0] || (a.tipo === "color") - (b.tipo === "color"));
    out.push(...items);
  });
  return out;
}
// Cuántos hay de cada cosa (para los filtros).
function cuenta(docs) {
  const n = { todo: 0, fav: 0, nota: 0 };
  COLORES.forEach(c => { n[c.id] = 0; });
  Object.keys(docs || {}).forEach(id => {
    const d = docs[id];
    Object.values(d.it || {}).forEach(x => { if (x.f) n.fav++; if (x.n) n.nota++; });
    rangosColor(d.col).forEach(r => { n[r.color]++; });
  });
  n.todo = lista(docs, "todo").length;
  return n;
}
// Favoritos con su texto (para el versículo de arriba, fase 3).
function favoritos(docs) {
  return lista(docs, "fav").filter(x => x.texto).map(x => ({ cita: x.cita, texto: x.texto, libro: x.libro, cap: x.cap, versiculo: x.versiculo }));
}

// El texto para copiar: «…» — Juan 3:16 (RV1909).
function paraCopiar(texto, cita) {
  return `«${String(texto || "").trim()}» — ${cita} (RV1909)`;
}

return { COLORES, COLOR, NOTA_MAX, clave, leerClave, normalizarDoc, delCapitulo, parcheColor, parcheFavorito, parcheNota, itemDe,
  rangosColor, lista, cuenta, favoritos, paraCopiar };
});
