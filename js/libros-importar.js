// ---------- Libros: importar de Goodreads, StoryGraph y Kindle (sin pantalla) ----------
// Fase 5c (D-110). Lee el archivo que exportas de cada app y arma lo que se
// guardaría, sin duplicar:
// - Goodreads (goodreads_library_export.csv): estante (read / currently-
//   reading / to-read), calificación, páginas, fechas, formato (Binding),
//   ISBN (viene como ="…"), reseña y la saga del título ("(Saga, #2)").
// - StoryGraph (CSV): estado (read, currently-reading, to-read, did-not-
//   finish, paused), formato, estrellas (4,5 → 5), fechas leídas, reseña.
// - Kindle (My Clippings.txt, en inglés o español): subrayados → frases
//   (con página y fecha) y notas → notas del libro; los marcadores no.
//   Un subrayado que amplía otro del mismo libro deja solo el más largo.
// Duplicados: un libro ya está si coincide el ISBN o el título y el autor
// (sin tildes ni mayúsculas, sin el subtítulo); una frase, si su texto ya
// está en ese libro. Sin DOM ni Firebase: tests/libros-importar.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./libros-motor.js"));
  else root.LibrosImportar = factory(root.LibrosMotor);
})(typeof self !== "undefined" ? self : this, function (L) {
"use strict";

// ---- CSV (comillas, comas y saltos de línea dentro de un campo) ----
function csv(texto) {
  const t = String(texto || "").replace(/^﻿/, "");
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some(x => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some(x => x !== "")) filas.push(fila);
  if (!filas.length) return [];
  const cab = filas[0].map(h => h.trim());
  return filas.slice(1).map(f => { const o = {}; cab.forEach((h, k) => { o[h] = (f[k] || "").trim(); }); return o; });
}

// ---- De qué app es ----
function detectar(texto) {
  const t = String(texto || "").replace(/^﻿/, "");
  const primera = t.split(/\r?\n/, 1)[0] || "";
  if (/Exclusive Shelf/i.test(primera) && /Title/.test(primera)) return "goodreads";
  if (/Read Status/i.test(primera) && /Title/.test(primera)) return "storygraph";
  if (/^={10}\s*$/m.test(t)) return "kindle";
  return null;
}

// ---- Ayudas ----
const limpio = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const fechaDe = s => { const m = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(String(s || "")); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null; };
const sinHtml = s => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
// ISBN: '="9780316769488"' → "9780316769488" (solo si es un ISBN de verdad).
function isbnDe(s) {
  const t = String(s || "").replace(/^="?|"$/g, "").replace(/[-\s]/g, "").toUpperCase();
  return /^(\d{9}[\dX]|\d{13})$/.test(t) ? t : null;
}
function formatoDe(s) {
  const t = L.normalizar(s);
  if (/audio|audible/.test(t)) return "audio";
  if (/kindle|ebook|e-book|digital|nook|kobo|epub/.test(t)) return "digital";
  return "papel";
}
// "Harry Potter y la piedra filosofal (Harry Potter, #1)" → título y saga.
function sagaDelTitulo(titulo) {
  const m = /^(.*?)\s*\(([^()]+?),?\s*#(\d+(?:[.,]\d+)?)\)\s*$/.exec(String(titulo || ""));
  if (!m) return { titulo: limpio(titulo), saga: null, sagaN: null };
  return { titulo: limpio(m[1]), saga: limpio(m[2]).replace(/,$/, ""), sagaN: Number(m[3].replace(",", ".")) };
}
// Para comparar títulos: sin tildes, sin subtítulo (": …") ni saga entre paréntesis.
const claveTitulo = t => L.normalizar(String(t || "").replace(/\s*\([^)]*\)\s*$/, "").split(/[:;]/)[0]).replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
// Para comparar autores: el apellido (la última palabra del primer autor).
const claveAutor = a => { const p = L.normalizar(String(a || "").split(/,|&| y | and /)[0]).replace(/[^a-z0-9ñ ]+/g, " ").trim().split(/\s+/); return p[p.length - 1] || ""; };
const claveLibro = (titulo, autor) => `${claveTitulo(titulo)}|${claveAutor(autor)}`;

// ---- Goodreads y StoryGraph → libros ----
const ESTADOS = { read: "terminado", "currently-reading": "leyendo", "to-read": "por_leer", "did-not-finish": "abandonado", paused: "abandonado" };
function libroDeFila(o, de, hoy) {
  const gr = de === "goodreads";
  const est = ESTADOS[L.normalizar(gr ? o["Exclusive Shelf"] : o["Read Status"])] || "por_leer";
  const s = sagaDelTitulo(o.Title);
  const autor = limpio(gr ? o.Author : o.Authors);
  const pags = Number(o["Number of Pages"]);
  const nota = Number(String(gr ? o["My Rating"] : o["Star Rating"] || "").replace(",", "."));
  const anio = Number(o["Original Publication Year"] || o["Year Published"]);
  // StoryGraph: "Dates Read" = "2023/04/01-2023/05/14" (empezado-terminado).
  const rango = String(o["Dates Read"] || "").split(",").pop().split("-");
  const inicio = !gr && rango.length === 2 ? fechaDe(rango[0]) : null;
  const fin = est === "terminado" ? fechaDe(gr ? o["Date Read"] : (o["Last Date Read"] || rango[rango.length - 1])) : null;
  const registro = fechaDe(o["Date Added"]) || hoy;
  const doc = {
    v: 1, titulo: s.titulo.slice(0, 200) || "Sin título", autor: autor.slice(0, 150),
    paginas: Number.isInteger(pags) && pags > 0 && pags <= 20000 ? pags : null,
    estado: est, calificacion: nota >= 1 ? Math.min(5, Math.round(nota)) : null,
    opinion: sinHtml(gr ? o["My Review"] : o.Review).slice(0, 5000),
    fechaRegistro: registro > hoy ? hoy : registro,
    fechaInicio: inicio && inicio <= hoy ? inicio : null,
    fechaFin: fin && fin <= hoy ? fin : null,
    genero: null, anio: Number.isInteger(anio) && anio > 0 && anio <= 2100 ? anio : null, olKey: null,
    formato: formatoDe(gr ? o.Binding : o.Format),
    saga: s.saga, sagaN: s.saga ? s.sagaN : null, prioridad: null,
    isbn: isbnDe(gr ? (o.ISBN13 || o.ISBN) : o["ISBN/UID"]),
    importado: { de, id: limpio(gr ? o["Book Id"] : o["ISBN/UID"]).slice(0, 40) }
  };
  if (doc.fechaInicio && doc.fechaFin && doc.fechaFin < doc.fechaInicio) doc.fechaInicio = null;
  if (doc.estado === "leyendo" && !doc.fechaInicio) doc.fechaInicio = doc.fechaRegistro;
  return doc;
}
// → { de, nuevos: [doc], repetidos: [{ doc, libro }], total }
function libros(texto, existentes, hoy) {
  const de = detectar(texto);
  if (de !== "goodreads" && de !== "storygraph") return { de, nuevos: [], repetidos: [], total: 0 };
  const yaIsbn = new Map(), yaClave = new Map();
  (existentes || []).forEach(l => { if (l.isbn) yaIsbn.set(l.isbn, l); yaClave.set(claveLibro(l.titulo, l.autor), l); });
  const nuevos = [], repetidos = [];
  csv(texto).forEach(o => {
    if (!limpio(o.Title)) return;
    const doc = libroDeFila(o, de, hoy);
    const k = claveLibro(doc.titulo, doc.autor);
    const ya = (doc.isbn && yaIsbn.get(doc.isbn)) || yaClave.get(k);
    if (ya) { repetidos.push({ doc, libro: ya }); return; }
    nuevos.push(doc);
    if (doc.isbn) yaIsbn.set(doc.isbn, doc);
    yaClave.set(k, doc);     // dos veces el mismo en el archivo: entra una
  });
  return { de, nuevos, repetidos, total: nuevos.length + repetidos.length };
}

// ---- Kindle: My Clippings.txt ----
const MESES = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
// "Added on Sunday, March 5, 2023 10:21:43 PM" o "Añadido el domingo, 5 de marzo de 2023 22:21:43".
function fechaKindle(linea) {
  const t = L.normalizar(linea);
  let m = /([a-z]+) (\d{1,2}), (\d{4})/.exec(t);
  if (m && MESES[m[1]]) return `${m[3]}-${String(MESES[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /(\d{1,2}) de ([a-z]+) de (\d{4})/.exec(t);
  if (m && MESES[m[2]]) return `${m[3]}-${String(MESES[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
// → [{ titulo, autor, tipo: "frase" | "nota", texto, pagina, ubicacion, fecha }]
function clippings(texto) {
  const out = [];
  String(texto || "").replace(/^﻿/, "").replace(/\r/g, "").split(/^={10}\s*$/m).forEach(bloque => {
    const lineas = bloque.split("\n").map(x => x.replace(/^﻿/, "")).filter((x, i, a) => !(i === 0 && !x.trim()));
    while (lineas.length && !lineas[0].trim()) lineas.shift();
    if (lineas.length < 3) return;
    const cab = lineas[0].trim(), meta = lineas[1].trim();
    const texto = lineas.slice(2).join("\n").trim();
    const nm = L.normalizar(meta);
    const tipo = /marcador|bookmark/.test(nm) ? null : /\bnota\b|\bnote\b/.test(nm) ? "nota" : /subrayado|resaltado|highlight|destacado/.test(nm) ? "frase" : null;
    if (!tipo || !texto) return;
    const ma = /^(.*)\(([^()]*)\)\s*$/.exec(cab);
    const pag = /(?:pagina|page|pag\.?)\s+(\d+)/.exec(nm);
    const ubi = /(?:posicion|location|ubicacion|loc\.?)\s+([\d-]+)/.exec(nm);
    out.push({ titulo: limpio(ma ? ma[1] : cab), autor: limpio(ma ? ma[2] : ""), tipo, texto,
      pagina: pag ? Number(pag[1]) : null, ubicacion: ubi ? ubi[1] : null, fecha: fechaKindle(meta) });
  });
  return out;
}
// Agrupa por libro, quita repetidas y las que amplías (queda la más larga) y
// marca las que ya tienes. existentes: { libros, frases }.
// → { libros: [{ clave, titulo, autor, libro (el tuyo o null), frases: [...], notas: [...] }], nuevas, repetidas }
function kindle(texto, existentes, hoy) {
  const ex = existentes || {};
  const tuyos = new Map();
  (ex.libros || []).forEach(l => tuyos.set(claveLibro(l.titulo, l.autor), l));
  // Sin autor en tu libro: también por título solo.
  const porTitulo = new Map();
  (ex.libros || []).forEach(l => { if (!porTitulo.has(claveTitulo(l.titulo))) porTitulo.set(claveTitulo(l.titulo), l); });
  const yaFrases = new Set((ex.frases || []).map(f => `${f.libroId}|${L.normalizar(f.texto)}`));
  const grupos = new Map();
  clippings(texto).forEach(c => {
    const k = claveLibro(c.titulo, c.autor);
    if (!grupos.has(k)) {
      const s = sagaDelTitulo(c.titulo);
      grupos.set(k, { clave: k, titulo: s.titulo, autor: c.autor, libro: tuyos.get(k) || porTitulo.get(claveTitulo(c.titulo)) || null, frases: [], notas: [] });
    }
    const g = grupos.get(k);
    const item = { texto: c.texto.slice(0, 2000), pagina: c.pagina && c.pagina <= 20000 ? c.pagina : null, ubicacion: c.ubicacion, fecha: c.fecha && c.fecha <= hoy ? c.fecha : hoy };
    (c.tipo === "nota" ? g.notas : g.frases).push(item);
  });
  let nuevas = 0, repetidas = 0;
  const lista = Array.from(grupos.values()).map(g => {
    // Repetidas o ampliadas: si una contiene a otra, queda la más larga.
    const orden = g.frases.slice().sort((a, b) => b.texto.length - a.texto.length);
    const quedan = [];
    orden.forEach(f => { const n = L.normalizar(f.texto); if (!quedan.some(q => L.normalizar(q.texto).includes(n))) quedan.push(f); });
    g.frases = g.frases.filter(f => quedan.includes(f)).map(f => {
      const ya = !!g.libro && yaFrases.has(`${g.libro.id}|${L.normalizar(f.texto)}`);
      if (ya) repetidas++; else nuevas++;
      return Object.assign(f, { ya });
    });
    return g;
  }).filter(g => g.frases.length || g.notas.length);
  return { libros: lista, nuevas, repetidas, notas: lista.reduce((s, g) => s + g.notas.length, 0) };
}

return { csv, detectar, isbnDe, formatoDe, sagaDelTitulo, claveLibro, libros, libroDeFila, clippings, fechaKindle, kindle };
});
