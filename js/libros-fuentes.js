// ---------- Libros: los datos de cada libro desde internet (sin pantalla) ----------
// Nivel 3 (D-128 en adelante; diseño en docs/LIBROS_NIVEL3.md). Fuentes
// gratis y sin clave, probadas con 20 libros reales:
// - Open Library con lang=es: de cada obra trae la edición en español
//   (título en español y su portada), el autor y los temas.
// Fase 1 (D-129) — buscar bien:
// - el título que se usa es el de la edición en español; el original queda
//   aparte (tituloOriginal);
// - orden: primero el libro de verdad (parecido a lo que escribiste y con
//   más ediciones); resúmenes, análisis, guías y "libros de trabajo" al
//   final;
// - sin repetidos (Open Library tiene la misma obra varias veces);
// - el autor en nuestro alfabeto (si viene en otro, se usa el de su ficha);
// - si escribes un autor, salen sus libros más leídos.
// Fase 2 (D-130) — las páginas de tu edición: las ediciones en español de
// la obra (editorial, año, tapa y páginas), agrupadas por largo parecido
// ("326–338 págs."), con la recomendada; con el ISBN, tu edición exacta.
// Sin DOM ni Firebase: tests/libros-fuentes.test.js, con respuestas reales
// guardadas en tests/fixtures/libros/.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./libros-motor.js"));
  else root.LibrosFuentes = factory(root.LibrosMotor);
})(typeof self !== "undefined" ? self : this, function (L) {
"use strict";

const OL = "https://openlibrary.org";
const CAMPOS = ["key", "title", "author_name", "author_key", "cover_i", "first_publish_year", "number_of_pages_median", "subject", "edition_count",
  "editions", "editions.key", "editions.title", "editions.language", "editions.cover_i"].join(",");

// Una búsqueda (título, autor o ISBN) que prefiere las ediciones en español.
function urlBuscar(q) {
  const t = String(q || "").trim();
  const consulta = L.esIsbn(t) ? `isbn:${t.replace(/[-\s]/g, "").toUpperCase()}` : t;
  return `${OL}/search.json?q=${encodeURIComponent(consulta)}&lang=es&limit=20&fields=${CAMPOS}`;
}

// ---- Parecido entre lo que escribiste y un título o un autor (0 a 1) ----
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "lo", "y", "e", "o", "u", "en", "a", "al", "un", "una", "unos", "unas", "por", "para", "con", "su", "sus",
  "the", "of", "and", "an", "to", "in", "on", "for"]);
const limpio = t => L.normalizar(t).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const palabras = t => limpio(t).split(" ").filter(w => w && !VACIAS.has(w));
function parecido(q, t) {
  const Q = palabras(q), T = palabras(t);
  if (!Q.length || !T.length) return 0;
  const enT = new Set(T);
  // Una palabra cuenta si está igual o si una empieza como la otra (4+ letras: "habito" / "habitos").
  const esta = w => enT.has(w) || (w.length >= 4 && T.some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x))));
  const comunes = Q.filter(esta).length;
  return (comunes / Q.length) * 0.75 + Math.min(1, comunes / T.length) * 0.25;
}

// Resúmenes, análisis, guías de estudio y "libros de trabajo" de otro libro.
const DERIVADOS = ["resumen", "resumo", "analisis", "summary", "workbook", "libro de trabajo", "cuaderno de trabajo", "guia de estudio", "study guide", "sparknotes", "cliffsnotes"];
const esDerivado = t => { const x = ` ${limpio(t)} `; return DERIVADOS.some(d => x.includes(` ${d} `)); };

// ¿Está escrito en nuestro alfabeto? ("Фёдор Достоевский" no).
const esLatino = s => { const t = String(s || "").normalize("NFC"); return /[a-z]/i.test(t) && /^[\u0000-ɏ̀-ͯḀ-ỿ‘’·]*$/.test(t); };
// "Cien Años De Soledad" queda igual; "EL ALQUIMISTA" → "El alquimista".
function limpiarTitulo(t) {
  let s = String(t || "").replace(/\s+/g, " ").replace(/[\s:;,/.]+$/, "").trim();
  if (s.length > 3 && s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s)) s = s.charAt(0) + s.slice(1).toLowerCase();
  return s.slice(0, 200);
}
// Para no repetir: mismo título y mismo autor (por el apellido; un nombre
// en otro alfabeto se toma como "puede ser el mismo").
const firma = autor => (esLatino(autor) ? (palabras(autor).slice(-1)[0] || "") : "?");

// Respuesta de Open Library → { libros, autor }. `autor` dice de quién son
// los libros cuando lo que escribiste es un autor ("Paulo Coelho").
function leerBusqueda(json, q, max) {
  const docs = ((json && json.docs) || []).filter(d => d && d.title);
  const qDerivado = esDerivado(q);
  const lista = docs.map((d, i) => {
    const ed = d.editions && Array.isArray(d.editions.docs) ? d.editions.docs[0] : null;
    const idiomas = ed && Array.isArray(ed.language) ? ed.language : null;
    const enEsp = !!(idiomas && idiomas.includes("spa"));
    const original = limpiarTitulo(d.title);
    const deEdicion = ed && ed.title ? limpiarTitulo(ed.title) : "";
    // El título en español: el de la edición en español; si la edición no dice
    // su idioma, el que más se parece a lo que escribiste.
    const titulo = deEdicion && (enEsp || (!idiomas && parecido(q, deEdicion) > parecido(q, original))) ? deEdicion : original;
    const autor = Array.isArray(d.author_name) && d.author_name[0] ? String(d.author_name[0]).trim().slice(0, 150) : "";
    const autorKey = Array.isArray(d.author_key) && /^OL\d+A$/.test(String(d.author_key[0] || "")) ? d.author_key[0] : null;
    const portadaEsp = enEsp && Number(ed.cover_i) > 0 ? Number(ed.cover_i) : 0;
    const idPortada = portadaEsp || (Number(d.cover_i) > 0 ? Number(d.cover_i) : 0);
    const pags = Number(d.number_of_pages_median);
    const ediciones = Number(d.edition_count) || 0;
    const derivado = !qDerivado && (esDerivado(titulo) || esDerivado(original));
    const sim = Math.max(parecido(q, titulo), parecido(q, original), 0.9 * parecido(q, autor));
    const puntos = sim * 4 + Math.log10(ediciones + 1) * 1.6 + (idPortada ? 0.3 : 0) + (autor ? 0.3 : 0) - (derivado ? 4 : 0);
    return {
      i, puntos, sim, simTitulo: Math.max(parecido(q, titulo), parecido(q, original)), simAutor: parecido(q, autor),
      libro: {
        titulo, tituloOriginal: limpio(original) !== limpio(titulo) ? original : "",
        autor, autorKey, autorRaro: !!autor && !esLatino(autor),
        anio: Number.isInteger(d.first_publish_year) ? d.first_publish_year : null,
        paginas: Number.isInteger(pags) && pags > 0 && pags <= 20000 ? pags : null,
        url: idPortada ? L.urlPortadaOL(idPortada, "M") : "", urlChica: idPortada ? L.urlPortadaOL(idPortada, "S") : "",
        genero: L.generoDesdeTemas(d.subject),
        olKey: /^\/works\/OL\d+W$/.test(String(d.key || "")) ? d.key : null,
        edicionKey: ed && /^\/books\/OL\d+M$/.test(String(ed.key || "")) ? ed.key : null,
        ediciones, derivado
      }
    };
  }).sort((a, b) => b.puntos - a.puntos || a.i - b.i);

  // Sin repetidos: de cada obra queda la mejor ubicada, y toma de sus
  // repetidas lo que le falte (un autor en nuestro alfabeto, una portada).
  const quedan = [];
  lista.forEach(x => {
    const t = palabras(x.libro.titulo).join(" "), f = firma(x.libro.autor);
    const igual = quedan.find(y => palabras(y.libro.titulo).join(" ") === t && (firma(y.libro.autor) === f || f === "?" || firma(y.libro.autor) === "?"));
    if (!igual) { quedan.push(x); return; }
    const k = igual.libro;
    if (k.autorRaro && x.libro.autor && !x.libro.autorRaro) Object.assign(k, { autor: x.libro.autor, autorRaro: false, autorKey: k.autorKey || x.libro.autorKey });
    if (!k.url && x.libro.url) Object.assign(k, { url: x.libro.url, urlChica: x.libro.urlChica });
    if (!k.paginas && x.libro.paginas) k.paginas = x.libro.paginas;
    if (!k.genero && x.libro.genero) k.genero = x.libro.genero;
  });
  // Lo que no se parece en nada a lo que escribiste (ni título ni autor)
  // no se muestra, salvo que no haya otra cosa. Un ISBN no se compara.
  const parecidos = L.esIsbn(q) ? quedan : quedan.filter(x => x.sim >= 0.25);
  const libros = (parecidos.length ? parecidos : quedan).slice(0, max || 8);
  // ¿Escribiste un autor? Si 3 o más de los primeros son de ese autor y no
  // se parecen al título, la lista es "Libros de …".
  const delAutor = quedan.slice(0, 6).filter(x => x.simAutor >= 0.99 && x.simTitulo < 0.5);
  const autor = !L.esIsbn(q) && delAutor.length >= Math.min(3, quedan.length) && delAutor.length ? delAutor[0].libro.autor : null;
  return { libros: libros.map(x => x.libro), autor };
}

// ---- Ficha del autor en Open Library ----
const urlFichaAutor = key => (/^OL\d+A$/.test(String(key || "")) ? `${OL}/authors/${key}.json` : null);
// El nombre en nuestro alfabeto: el de la ficha ("Fiódor Dostoievski") o uno
// de sus otros nombres.
function nombreDeFicha(json) {
  if (!json || typeof json !== "object") return null;
  const otros = Array.isArray(json.alternate_names) ? json.alternate_names : [];
  const n = [json.name, json.personal_name].concat(otros).find(x => typeof x === "string" && x.trim() && esLatino(x));
  return n ? String(n).trim().slice(0, 150) : null;
}

// ---- Fase 2 (D-130): las ediciones y sus páginas ----
const urlEdiciones = (olKey, desde) => (/^\/works\/OL\d+W$/.test(String(olKey || "")) ? `${OL}${olKey}/editions.json?limit=100${desde ? `&offset=${desde}` : ""}` : null);
const urlIsbn = isbn => { const t = String(isbn || "").replace(/[-\s]/g, "").toUpperCase(); return L.esIsbn(t) ? `${OL}/isbn/${t}.json` : null; };
const urlEdicion = key => (/^\/books\/OL\d+M$/.test(String(key || "")) ? `${OL}${key}.json` : null);

// Formato de la edición ("Paperback", "Tapa dura", "mass market paperback"…).
const FORMATOS_ED = [
  ["audio", /audio|cassette|(^|\s)cd(\s|$)|mp3/],
  ["digital", /e-?book|kindle|electr|digital|epub|pdf/],
  ["dura", /hard|dura|cartone|empastad|library binding/],
  ["bolsillo", /mass market|bolsillo|pocket|booket/],
  ["blanda", /paper|blanda|rustica|softcover|soft cover|trade/]
];
const NOMBRE_FORMATO = { dura: "tapa dura", blanda: "tapa blanda", bolsillo: "bolsillo", digital: "digital", audio: "audiolibro" };
function formatoDe(t) {
  const x = L.normalizar(t);
  if (!x) return null;
  const f = FORMATOS_ED.find(([, re]) => re.test(x));
  return f ? f[0] : null;
}
// Páginas: number_of_pages, o lo que diga la paginación ("xii, 320 p.").
function paginasDe(e) {
  const n = Number(e && e.number_of_pages);
  if (Number.isInteger(n) && n >= 8 && n <= 20000) return n;
  const p = String((e && e.pagination) || "");
  const m = p.match(/(\d{2,5})\s*(?:p\b|p\.|pp|pag|p\u00e1g|pages|paginas|p\u00e1ginas)/i) || p.match(/^\s*(\d{2,5})\s*$/);
  const v = m ? Number(m[1]) : NaN;
  return v >= 8 && v <= 20000 ? v : null;
}
// El año de "Mar 16, 2019", "06/02/2012" o "2004-01-01".
const anioDe = t => { const ms = String(t || "").match(/(^|\D)(1[4-9]\d\d|20\d\d)(?!\d)/g); return ms ? Number(ms[ms.length - 1].replace(/\D/g, "")) : null; };
// "Editorial Planeta, S. A." → "Editorial Planeta"; "PAIDOS" → "Paidos".
function limpiarEditorial(t) {
  let s = String(t || "").replace(/\s+/g, " ").trim()
    .replace(/[,\s]+(?:S\.?\s?A\.?(?:\s?de\s?C\.?\s?V\.?)?|S\.?\s?L\.?U?\.?|LLC|Inc\.?|Ltd\.?|Ltda\.?|S\.?\s?R\.?\s?L\.?)\s*$/i, "")
    .replace(/[\s,.;:]+$/, "").trim();
  if (s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s)) s = s.toLowerCase().replace(/(^|[\s(])\S/g, c => c.toUpperCase());
  return s.slice(0, 80);
}
function leerEdicion(e) {
  if (!e || typeof e !== "object") return null;
  const idiomas = Array.isArray(e.languages) ? e.languages.map(x => String((x && x.key) || "").replace("/languages/", "")).filter(Boolean) : [];
  const isbn = [].concat(e.isbn_13 || [], e.isbn_10 || []).map(x => String(x).replace(/[-\s]/g, "").toUpperCase()).find(x => L.esIsbn(x)) || null;
  const portada = Array.isArray(e.covers) ? e.covers.find(c => Number(c) > 0) : null;
  return {
    key: /^\/books\/OL\d+M$/.test(String(e.key || "")) ? e.key : null,
    titulo: limpiarTitulo(e.title || ""), paginas: paginasDe(e),
    editorial: Array.isArray(e.publishers) && e.publishers[0] ? limpiarEditorial(e.publishers[0]) : "",
    anio: anioDe(e.publish_date), formato: formatoDe(e.physical_format), idiomas, isbn,
    url: portada ? L.urlPortadaOL(portada, "M") : "", urlChica: portada ? L.urlPortadaOL(portada, "S") : ""
  };
}
const leerEdiciones = json => ((json && json.entries) || []).map(leerEdicion).filter(Boolean);
const enEspanol = e => !!e && e.idiomas.includes("spa");
const ESPECIAL = /edicion especial|ilustrad|aniversario|conmemorativ|de lujo|coleccionista/;

// Ediciones en español con páginas (sin audiolibros ni digitales),
// agrupadas por largo parecido: cada grupo llega hasta 6 % más que su más
// corta ("326–338 págs."). Primero el grupo con más ediciones; en empate,
// el de la edición más nueva. El número de cada grupo es el de su edición
// más nueva (la que más probablemente compraste).
function gruposDePaginas(ediciones) {
  const con = (ediciones || []).filter(e => enEspanol(e) && e.paginas && e.formato !== "audio" && e.formato !== "digital")
    .sort((a, b) => a.paginas - b.paginas);
  const grupos = [];
  con.forEach(e => {
    const g = grupos[grupos.length - 1];
    if (g && e.paginas <= g.min * 1.06) { g.ediciones.push(e); g.max = e.paginas; } else grupos.push({ min: e.paginas, max: e.paginas, ediciones: [e] });
  });
  grupos.forEach(g => {
    g.ediciones.sort((a, b) => (b.anio || 0) - (a.anio || 0) || b.paginas - a.paginas);
    g.edicion = g.ediciones[0];
    g.paginas = g.edicion.paginas;
    g.n = g.ediciones.length;
    g.especial = g.ediciones.some(e => ESPECIAL.test(L.normalizar(e.titulo)));
  });
  return grupos.sort((a, b) => b.n - a.n || (b.edicion.anio || 0) - (a.edicion.anio || 0) || a.paginas - b.paginas);
}
// La recomendada: tu edición exacta (ISBN); si no, el grupo más común en
// español; si no hay, la edición en español que trajo la búsqueda; si no,
// la mediana de todas las ediciones (aproximada).
function recomendar(ediciones, opciones) {
  const o = opciones || {};
  const grupos = gruposDePaginas(ediciones);
  if (o.exacta && o.exacta.paginas) return { paginas: o.exacta.paginas, edicion: o.exacta, razon: "isbn", grupos };
  if (grupos.length) return { paginas: grupos[0].paginas, edicion: grupos[0].edicion, razon: grupos[0].n > 1 ? "comun" : "unica", grupos };
  if (o.deBusqueda && o.deBusqueda.paginas) return { paginas: o.deBusqueda.paginas, edicion: o.deBusqueda, razon: "busqueda", grupos };
  return { paginas: Number.isInteger(o.mediana) && o.mediana > 0 ? o.mediana : null, edicion: null, razon: o.mediana ? "todas" : "ninguna", grupos };
}
// ¿Hace falta pedir más ediciones? (obras con cientos: se piden hasta 300).
const pedirMas = (json, leidas, enEsp) => !!(json && json.links && json.links.next) && leidas < 300 && enEsp < 4;
// "Diana 2025 · tapa blanda".
const textoEdicion = e => (e ? [e.editorial, e.anio, NOMBRE_FORMATO[e.formato]].filter(Boolean).join(" · ") : "");

return { OL, CAMPOS, urlBuscar, parecido, esDerivado, esLatino, limpiarTitulo, leerBusqueda, urlFichaAutor, nombreDeFicha,
  urlEdiciones, urlIsbn, urlEdicion, formatoDe, NOMBRE_FORMATO, paginasDe, anioDe, limpiarEditorial, leerEdicion, leerEdiciones, enEspanol,
  gruposDePaginas, recomendar, pedirMas, textoEdicion };
});
