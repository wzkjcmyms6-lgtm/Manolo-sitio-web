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
// Fase 3 (D-131) — ficha del autor: su ficha de Open Library, su página de
// Wikipedia en español (emparejada por Wikidata para no confundirlo con
// otro del mismo nombre) y sus libros más leídos, en español.
// Fase 4 (D-132) — temas en español (de los temas de Open Library) y "De
// qué trata": la página del libro en Wikipedia en español; si no, la
// descripción de Open Library si está en español; si no, Google Books.
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
        temas: temasDe(d.subject, L.generoDesdeTemas(d.subject)),
        olKey: /^\/works\/OL\d+W$/.test(String(d.key || "")) ? d.key : null,
        edicionKey: ed && /^\/books\/OL\d+M$/.test(String(ed.key || "")) ? ed.key : null,
        ediciones, derivado, enEspanol: enEsp
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

// ---- Fase 3 (D-131): la ficha del autor ----
// Sus libros, los más leídos primero (con la edición en español si hay).
const urlLibrosDeAutor = key => (/^OL\d+A$/.test(String(key || "")) ? `${OL}/search.json?q=${encodeURIComponent(`author_key:${key}`)}&lang=es&sort=editions&limit=30&fields=${CAMPOS}` : null);
// Para un libro sin autorKey: buscar al autor por su nombre.
const urlBuscarAutor = nombre => `${OL}/search/authors.json?q=${encodeURIComponent(String(nombre || "").trim())}&limit=8`;
// De los que se llaman igual, el que más obras tiene ("Paulo Coelho", 767
// obras, y no "Paulo Coelho Netto").
function elegirAutor(json, nombre) {
  const docs = ((json && json.docs) || []).filter(d => d && /^OL\d+A$/.test(String(d.key || "")) && d.name);
  const n = limpio(nombre);
  let lista = docs.filter(d => limpio(d.name) === n);
  if (!lista.length) lista = docs.filter(d => mismoAutor(d.name, nombre));
  lista.sort((a, b) => (b.work_count || 0) - (a.work_count || 0));
  return lista.length ? lista[0].key : null;
}
// ¿Es el mismo autor? Mismo apellido y mismo nombre (o su inicial):
// "Robert T. Kiyosaki" = "Robert Kiyosaki" = "R. Kiyosaki".
function mismoAutor(a, b) {
  const x = palabras(a), y = palabras(b);
  if (!x.length || !y.length) return false;
  if (x[x.length - 1] !== y[y.length - 1]) return false;
  if (x.length === 1 || y.length === 1) return x.length === y.length;
  return x[0] === y[0] || (x[0].length === 1 && y[0].startsWith(x[0])) || (y[0].length === 1 && x[0].startsWith(y[0]));
}
function leerAutor(json) {
  if (!json || typeof json !== "object" || !json.name) return null;
  const bio = typeof json.bio === "string" ? json.bio : json.bio && typeof json.bio.value === "string" ? json.bio.value : "";
  const foto = Array.isArray(json.photos) ? json.photos.find(x => Number(x) > 0) : null;
  return {
    key: (String(json.key || "").match(/OL\d+A/) || [])[0] || null,
    nombre: nombreDeFicha(json) || String(json.name).trim(),
    nacio: anioDe(json.birth_date), murio: anioDe(json.death_date),
    bio: bio.replace(/\s+/g, " ").trim().slice(0, 1200),
    foto: foto ? `https://covers.openlibrary.org/a/id/${foto}-M.jpg` : "",
    wikidata: json.remote_ids && /^Q\d+$/.test(String(json.remote_ids.wikidata || "")) ? json.remote_ids.wikidata : null
  };
}
// Wikipedia en español: se busca por el nombre y se toma la página cuyo
// Wikidata es el del autor. Sin Wikidata, solo si el título lleva su
// apellido y dice que escribe ("escritor brasileño", "psicóloga…"): así
// "George Hill" no trae al basquetbolista.
const urlWikiAutor = nombre => `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(String(nombre || "").trim())}&gsrlimit=5&prop=pageprops%7Cpageimages%7Cextracts%7Cdescription&ppprop=wikibase_item&exintro=1&explaintext=1&exsentences=3&piprop=thumbnail&pithumbsize=240`;
const OFICIOS = /escritor|novelista|autor|poeta|ensayista|periodista|filosof|psicolog|psiquiatra|teolog|pastor|predicador|historiador|profesor|conferencista|divulgador|empresari|economista|cientific|guionista|dramaturgo|biograf|lider espiritual|guia espiritual|monje|sacerdote|coach/;
function leerWiki(json, autor) {
  const paginas = json && json.query && json.query.pages ? Object.values(json.query.pages).sort((a, b) => (a.index || 0) - (b.index || 0)) : [];
  if (!autor) return null;
  let p = autor.wikidata ? paginas.find(x => x.pageprops && x.pageprops.wikibase_item === autor.wikidata) : null;
  if (!p && !autor.wikidata) {
    const apellido = palabras(autor.nombre).slice(-1)[0];
    p = paginas.find(x => apellido && palabras(x.title).includes(apellido) && OFICIOS.test(L.normalizar(x.description || ""))) || null;
  }
  if (!p || !p.title) return null;
  return {
    titulo: String(p.title), descripcion: String(p.description || "").trim().slice(0, 140),
    extracto: String(p.extract || "").replace(/\[(?:cita requerida|nota \d+|n\. \d+|\d+)\]/gi, "").replace(/\s+/g, " ").replace(/\s*\u200b\s*/g, " ").replace(/\s+([.,;:])/g, "$1").trim().slice(0, 900),
    foto: p.thumbnail && /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(String(p.thumbnail.source || "")) ? p.thumbnail.source : "",
    url: `https://es.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, "_"))}`
  };
}
// Sus libros: primero los que tienen edición en español; los muy leídos (5
// o más ediciones) aunque no la tengan; sin resúmenes ni repetidos.
function librosDeAutor(json, max) {
  const r = leerBusqueda(json, "", 60).libros.filter(x => !x.derivado && (x.enEspanol || x.ediciones >= 5));
  return r.sort((a, b) => Number(b.enEspanol) - Number(a.enEspanol) || b.ediciones - a.ediciones).slice(0, max || 12);
}
// Lo que ya tienes no se ofrece: misma obra o mismo título.
const loTienes = (x, libros) => (libros || []).some(l => (x.olKey && l.olKey === x.olKey) || (limpio(l.titulo) && limpio(l.titulo) === limpio(x.titulo)) || (x.tituloOriginal && limpio(l.titulo) === limpio(x.tituloOriginal)));
// "1947" o "1927–2014".
const anios = a => (a && a.nacio ? (a.murio ? `${a.nacio}–${a.murio}` : String(a.nacio)) : "");

// ---- Fase 4 (D-132): temas en español ----
// Cada tema de Open Library (inglés o español) se traduce al primero que
// coincide (los más específicos van antes); hasta 5, sin repetir el género.
const TEMAS = [
  ["romper hábitos", ["habit breaking"]], ["hábitos", ["habit", "habito"]], ["productividad", ["productiv", "time management"]],
  ["finanzas personales", ["personal finance", "finanzas personales", "finance, personal"]], ["inversiones", ["invest", "inversion"]],
  ["riqueza", ["wealth", "riqueza", "rich people", "ricos"]], ["éxito", ["success", "exito"]], ["liderazgo", ["leadership", "liderazgo"]],
  ["emprendimiento", ["entrepreneur", "empren"]], ["negocios", ["business", "negocio"]], ["economía", ["economic", "economia"]],
  ["vida cristiana", ["christian life", "vida cristiana"]], ["oración", ["prayer", "oracion"]], ["Biblia", ["bible", "biblia"]],
  ["teología", ["theolog", "teolog", "apologetic"]], ["cristianismo", ["christian", "cristian"]], ["fe", ["faith"]],
  ["meditación", ["meditation", "meditacion", "mindfulness"]], ["espiritualidad", ["spiritual", "espiritual", "new thought"]],
  ["estoicismo", ["stoic", "estoic"]], ["sentido de la vida", ["meaning of life", "sentido de la vida"]], ["filosofía", ["philosoph", "filosof"]],
  ["Holocausto", ["holocaust", "holocausto", "concentration camp", "konzentrationslager", "campos de concentracion"]],
  ["Segunda Guerra Mundial", ["world war, 1939", "segunda guerra mundial"]], ["historia", ["history", "historia"]],
  ["civilización", ["civilization", "civilizacion"]], ["neurociencia", ["neuroscien", "brain", "cerebro"]], ["psicología", ["psycholog", "psicolog", "behavior modification"]],
  ["autoayuda", ["self-help", "self help", "autoayuda", "self-actualization", "personal growth", "superacion", "desarrollo personal", "self-improvement"]],
  ["motivación", ["motivation", "motivacion", "inspirational"]], ["felicidad", ["happiness", "felicidad"]],
  ["salud", ["health", "salud"]], ["nutrición", ["nutrition", "nutricion", "diet"]], ["deporte", ["sport", "deporte", "running", "fitness"]],
  ["ciencia", ["science", "ciencia"]], ["tecnología", ["technology", "tecnologia"]], ["inteligencia artificial", ["artificial intelligence", "inteligencia artificial"]],
  ["realismo mágico", ["magic realism", "realismo magico"]], ["historias de amor", ["love stories", "historias de amor", "romance"]],
  ["ciencia ficción", ["science fiction", "ciencia ficcion"]], ["fantasía", ["fantasy", "fantasia"]], ["misterio", ["mystery", "detective", "misterio"]],
  ["suspenso", ["thriller", "suspense", "suspenso"]], ["terror", ["horror", "terror"]], ["crimen", ["crime", "murder", "crimen", "asesinato"]],
  ["aventura", ["adventure", "aventura"]], ["viajes", ["voyages and travels", "travel", "viaje"]], ["distopía", ["dystopi", "distopi", "totalitarian"]],
  ["política", ["politic", "politica"]], ["matrimonio", ["marriage", "matrimonio"]], ["familia", ["family", "familia", "parenting", "crianza"]],
  ["relaciones", ["relationship", "relaciones", "interpersonal"]], ["comunicación", ["communication", "comunicacion"]],
  ["biografía", ["biography", "biografia", "autobiograph", "memoir", "memorias"]], ["poesía", ["poetry", "poesia", "poems"]],
  ["clásicos", ["classic literature", "clasicos"]], ["infantil", ["juvenile", "children", "infantil"]], ["juvenil", ["young adult", "juvenil"]]
];
// Una pista corta (5 letras o menos) tiene que empezar una palabra: "sport"
// no es "transport".
const pista = (t, p) => (p.length <= 5 ? new RegExp(`(^|[^a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t) : t.includes(p));
function temasDe(temas, genero) {
  const out = [];
  const delGenero = genero && L.GENERO[genero] ? L.normalizar(L.GENERO[genero].nombre) : "";
  (Array.isArray(temas) ? temas : []).slice(0, 40).forEach(t => {
    const x = L.normalizar(t);
    if (!x || out.length >= 5) return;
    const hit = TEMAS.find(([, ps]) => ps.some(p => pista(x, p)));
    if (hit && !out.includes(hit[0]) && L.normalizar(hit[0]) !== delGenero) out.push(hit[0]);
  });
  return out;
}

// ---- Fase 4 (D-132): "De qué trata" ----
const apellido = autor => (esLatino(autor) ? palabras(autor).slice(-1)[0] || "" : "");
// La página del libro en Wikipedia en español: la descripción dice que es
// un libro (novela, ensayo…), el título se parece y el autor aparece; así
// no sale la serie de televisión ni la película con el mismo nombre.
const urlWikiLibro = (titulo, autor) => `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(`${String(titulo || "").trim()} ${apellido(autor)}`.trim())}&gsrlimit=5&prop=pageprops%7Cextracts%7Cdescription&ppprop=wikibase_item&exintro=1&explaintext=1&exsentences=4`;
const OBRAS = /(^|[^a-z])(libro|novela|obra|ensayo|cuentos?|poemario|relatos?|autobiografia|memorias|biografia|historieta|comic|saga|best seller)([^a-z]|$)/;
function generoDesdeDescripcion(d) {
  const x = L.normalizar(d);
  if (/novela|cuento|relato/.test(x)) return "novela";
  if (/poemario|poesia/.test(x)) return "poesia";
  if (/biografia|memorias/.test(x)) return "biografia";
  if (/autoayuda|desarrollo personal/.test(x)) return "desarrollo";
  return null;
}
// Sin "[cita requerida]", sin markdown ni enlaces, y cortado en una frase.
function limpiarSinopsis(t, max) {
  let s = String(t || "").split(/\n-{3,}|\n\s*(?:see also|contains|also contained in)\b/i)[0]
    .replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\(\[[^\]]*\]\[\d+\]\)/g, "").replace(/\[\d+\]:\s*\S+/g, "")
    .replace(/\[(?:cita requerida|nota \d+|n\. \d+|\d+)\]/gi, "").replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/[,;]?\s*pronunciaci[oó]n[^/)]*\/[^/]*\//gi, "").replace(/\(\s*\)/g, "")
    .replace(/\s*\u200b\s*/g, " ").replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  const tope = max || 700;
  if (s.length > tope) { const corte = s.slice(0, tope); const fin = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("? "), corte.lastIndexOf("! ")); s = fin > tope * 0.5 ? corte.slice(0, fin + 1) : `${corte.replace(/\s+\S*$/, "")}…`; }
  return s;
}
function leerWikiLibro(json, titulo, autor) {
  const paginas = json && json.query && json.query.pages ? Object.values(json.query.pages).sort((a, b) => (a.index || 0) - (b.index || 0)) : [];
  const ap = apellido(autor);
  const p = paginas.find(x => {
    const desc = L.normalizar(x.description || "");
    const base = String(x.title || "").replace(/\s*\([^)]*\)\s*$/, "");
    const inicio = L.normalizar(String(x.extract || "").slice(0, 400));
    return OBRAS.test(desc) && parecido(titulo, base) >= 0.6 && (!ap || desc.includes(ap) || inicio.includes(ap));
  });
  if (!p || !p.extract) return null;
  return { texto: limpiarSinopsis(p.extract), fuente: "wikipedia", url: `https://es.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, "_"))}`,
    genero: generoDesdeDescripcion(p.description) };
}
// ¿Está en español? (más palabras comunes del español que del inglés)
const PAL_ES = new Set(["el", "la", "los", "las", "de", "del", "que", "y", "en", "un", "una", "es", "por", "con", "para", "su", "sus", "se", "lo", "como", "pero", "más", "fue", "este", "esta", "son", "sobre", "también", "entre"]);
const PAL_EN = new Set(["the", "and", "of", "to", "in", "is", "that", "it", "with", "as", "for", "was", "on", "are", "be", "by", "this", "from", "his", "her", "you", "your", "an", "at"]);
function esEspanol(t) {
  const ws = String(t || "").toLowerCase().match(/[a-záéíóúñü]+/g) || [];
  let es = 0, en = 0;
  ws.forEach(w => { if (PAL_ES.has(w)) es++; if (PAL_EN.has(w)) en++; });
  return es >= 3 && es > en * 1.5;
}
// La descripción de la obra en Open Library (solo si está en español).
const urlObra = olKey => (/^\/works\/OL\d+W$/.test(String(olKey || "")) ? `${OL}${olKey}.json` : null);
function leerObra(json) {
  if (!json || typeof json !== "object") return null;
  const d = typeof json.description === "string" ? json.description : json.description && typeof json.description.value === "string" ? json.description.value : "";
  const texto = limpiarSinopsis(d);
  return texto.length >= 60 && esEspanol(texto) ? { texto, fuente: "openlibrary", url: `${OL}${json.key || ""}` } : null;
}
// Google Books (sin clave): solo un extra; si no responde, nada.
const urlGoogle = (titulo, autor) => `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${String(titulo || "").trim()}${apellido(autor) ? ` inauthor:${apellido(autor)}` : ""}`)}&langRestrict=es&maxResults=5&printType=books&fields=items(volumeInfo(title,authors,description,language,infoLink))`;
function leerGoogle(json, titulo, autor) {
  const items = ((json && json.items) || []).map(x => x && x.volumeInfo).filter(Boolean);
  const v = items.find(x => x.language === "es" && parecido(titulo, x.title) >= 0.6 && (!autor || (x.authors || []).some(a => mismoAutor(a, autor) || L.normalizar(a).includes(apellido(autor) || "@"))) && String(x.description || "").length >= 80);
  if (!v) return null;
  const u = String(v.infoLink || "").replace(/^http:/, "https:");
  return { texto: limpiarSinopsis(v.description), fuente: "google", url: /^https:\/\/books\.google\.[a-z.]+\//.test(u) ? u : "" };
}

// ---- Fase 6 (D-134): ideas de libros por tema ----
// El tema de Open Library (en inglés) que se busca para cada tema en
// español. Solo los específicos: los amplios ("éxito", "filosofía",
// "misterio") traen clásicos que no tienen que ver. En orden: se busca el
// primero que tenga tu libro.
const SUJETOS = [
  ["romper hábitos", "habit breaking"], ["finanzas personales", "personal finance"], ["inversiones", "investments"],
  ["realismo mágico", "magic realism"], ["estoicismo", "stoics"], ["Holocausto", "holocaust"], ["distopía", "dystopias"],
  ["productividad", "time management"], ["emprendimiento", "entrepreneurship"], ["neurociencia", "neurosciences"],
  ["vida cristiana", "christian life"], ["oración", "prayer"], ["meditación", "meditation"],
  ["motivación", "motivation (psychology)"], ["autoayuda", "self-help techniques"], ["hábitos", "habits"],
  ["inteligencia artificial", "artificial intelligence"], ["nutrición", "nutrition"], ["liderazgo", "leadership"]
];
// → [tema en español, tema de Open Library] o null.
const sujetoDe = temas => SUJETOS.find(([es]) => (Array.isArray(temas) ? temas : []).includes(es)) || null;
// Libros de ese tema que tienen edición en español.
const urlIdeasTema = sujeto => (sujeto ? `${OL}/search.json?q=${encodeURIComponent(`subject:"${sujeto}" language:spa`)}&lang=es&limit=30&fields=${CAMPOS}` : null);

return { OL, CAMPOS, urlBuscar, parecido, esDerivado, esLatino, limpiarTitulo, leerBusqueda, urlFichaAutor, nombreDeFicha,
  urlEdiciones, urlIsbn, urlEdicion, formatoDe, NOMBRE_FORMATO, paginasDe, anioDe, limpiarEditorial, leerEdicion, leerEdiciones, enEspanol,
  gruposDePaginas, recomendar, pedirMas, textoEdicion,
  urlLibrosDeAutor, urlBuscarAutor, elegirAutor, mismoAutor, leerAutor, urlWikiAutor, leerWiki, librosDeAutor, loTienes, anios,
  TEMAS, temasDe, urlWikiLibro, leerWikiLibro, generoDesdeDescripcion, limpiarSinopsis, esEspanol, urlObra, leerObra, urlGoogle, leerGoogle,
  SUJETOS, sujetoDe, urlIdeasTema };
});
