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

return { OL, CAMPOS, urlBuscar, parecido, esDerivado, esLatino, limpiarTitulo, leerBusqueda, urlFichaAutor, nombreDeFicha };
});
