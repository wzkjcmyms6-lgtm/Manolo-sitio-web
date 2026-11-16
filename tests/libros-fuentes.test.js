// Libros nivel 3 (D-128, D-129): buscar bien con Open Library. Las
// respuestas de tests/fixtures/libros/ son reales (2026-11-16, recortadas).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const F = require("../js/libros-fuentes.js");

const fx = n => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "libros", `${n}.json`), "utf8"));
const buscar = (n, q) => F.leerBusqueda(fx(`buscar-${n}`), q);

test("la búsqueda pide las ediciones en español y sabe buscar un ISBN", () => {
  const u = F.urlBuscar(" hábitos atómicos ");
  assert.match(u, /^https:\/\/openlibrary\.org\/search\.json\?q=h%C3%A1bitos%20at%C3%B3micos&lang=es&limit=20&fields=/);
  assert.match(u, /editions\.title/);
  assert.match(u, /author_key/);
  assert.match(F.urlBuscar("978-84-663-3212-5"), /\?q=isbn%3A9788466332125&lang=es/);
});

test("título en español y el original aparte (Hábitos atómicos, Padre rico)", () => {
  const h = buscar("habitos-atomicos", "habitos atomicos").libros[0];
  assert.equal(h.titulo, "Hábitos atómicos");
  assert.equal(h.tituloOriginal, "Atomic Habits");
  assert.equal(h.autor, "James Clear");
  assert.equal(h.autorKey, "OL7422948A");
  assert.match(h.edicionKey, /^\/books\/OL\d+M$/);
  assert.equal(h.genero, "desarrollo");
  const p = buscar("padre-rico", "padre rico padre pobre").libros;
  assert.equal(p[0].titulo, "Padre rico, padre pobre");
  assert.equal(p[0].tituloOriginal, "Rich Dad, Poor Dad");
  assert.equal(p[1].titulo, "Padre rico, padre pobre para jóvenes");
  // La portada es la de la edición en español.
  assert.match(p[0].url, /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-M\.jpg$/);
});

test("el libro de verdad primero: más ediciones gana a un librito con el mismo título", () => {
  const b = buscar("babilonia", "el hombre mas rico de babilonia").libros;
  assert.equal(b[0].autor, "George S. Clason");
  assert.equal(b[0].titulo, "El hombre más rico de Babilonia");
  assert.equal(b[0].tituloOriginal, "The Richest Man in Babylon");
  assert.ok(b[0].ediciones > 200);
  const a = buscar("alquimista", "el alquimista").libros;
  assert.equal(a[0].titulo, "El alquimista");
  assert.equal(a[0].autor, "Paulo Coelho");
  assert.equal(a[0].tituloOriginal, "O Alquimista");
  assert.equal(a[1].titulo, "El alquimista impaciente");
});

test("resúmenes, análisis y libros de trabajo van al final y marcados", () => {
  ["habitos-atomicos|habitos atomicos", "padre-rico|padre rico padre pobre", "babilonia|el hombre mas rico de babilonia", "frankl|el hombre en busca de sentido"].forEach(c => {
    const [n, q] = c.split("|");
    const l = buscar(n, q).libros;
    const primero = l.findIndex(x => x.derivado);
    assert.ok(primero > 0, `${n}: hay derivados y no van primero`);
    assert.ok(l.slice(primero).every(x => x.derivado), `${n}: después de un derivado solo hay derivados`);
  });
  // Si buscas un resumen, no se castiga.
  assert.equal(F.esDerivado("Resumen de Hábitos atómicos"), true);
  assert.equal(F.esDerivado("Libro de Trabajo para Los Hábitos Atómicos"), true);
  assert.equal(F.esDerivado("Guía para invertir"), false);
  const r = buscar("habitos-atomicos", "resumen habitos atomicos").libros;
  assert.ok(r.filter(x => x.derivado).length === 0);
});

test("sin repetidos, y el autor en nuestro alfabeto (Crimen y castigo)", () => {
  const c = buscar("crimen-y-castigo", "crimen y castigo").libros;
  const iguales = c.filter(x => /crimen/i.test(x.titulo) && /castigo/i.test(x.titulo));
  assert.equal(iguales.length, 1, c.map(x => x.titulo).join(" | "));
  assert.equal(c[0].autor, "Fiódor Dostoievski");
  assert.equal(c[0].autorRaro, false);
  assert.equal(c[0].genero, "novela");
  // Lo que no se parece en nada no aparece (había un libro infantil).
  assert.ok(!c.some(x => /perro/i.test(x.titulo)));
  const cien = buscar("cien-anos", "cien años de soledad").libros;
  assert.equal(cien[0].autor, "Gabriel García Márquez");
  assert.equal(cien.filter(x => x.titulo === "Cien años de soledad" && /M[aá]rquez/.test(x.autor)).length, 1);
  assert.ok(!cien.some(x => x.titulo === "Sto godina samoće"));
});

test("si escribes un autor, salen sus libros más leídos", () => {
  const r = buscar("coelho", "paulo coelho");
  assert.equal(r.autor, "Paulo Coelho");
  assert.equal(r.libros[0].titulo, "El alquimista");
  assert.ok(r.libros.every(x => x.autor === "Paulo Coelho"));
  assert.ok(r.libros.some(x => x.titulo === "Brida") && r.libros.some(x => x.titulo === "El Zahir"));
  for (let i = 1; i < r.libros.length; i++) assert.ok(r.libros[i - 1].ediciones >= r.libros[i].ediciones, "más ediciones primero");
  assert.equal(buscar("alquimista", "el alquimista").autor, null, "un título no es un autor");
});

test("un ISBN trae su edición (título de esa edición) aunque no se parezca al texto", () => {
  const r = buscar("isbn-padre-rico", "9788466332125");
  assert.equal(r.libros.length, 1);
  assert.equal(r.libros[0].titulo, "Padre Rico, padre Pobre");
  assert.equal(r.libros[0].autor, "Robert T. Kiyosaki");
  assert.equal(r.autor, null);
});

test("ficha del autor: el nombre en nuestro alfabeto", () => {
  assert.equal(F.urlFichaAutor("OL22242A"), "https://openlibrary.org/authors/OL22242A.json");
  assert.equal(F.urlFichaAutor("x"), null);
  assert.equal(F.nombreDeFicha(fx("autor-dostoievski")), "Fiódor Dostoievski");
  assert.equal(F.nombreDeFicha({ name: "Фёдор Достоевский", alternate_names: ["Фёдор", "Dostoyevsky"] }), "Dostoyevsky");
  assert.equal(F.nombreDeFicha({ name: "Лев Толстой" }), null);
  assert.equal(F.nombreDeFicha(null), null);
});

test("piezas: parecido, alfabeto y títulos", () => {
  assert.equal(F.parecido("habitos atomicos", "Hábitos atómicos"), 1);
  assert.ok(F.parecido("habitos atomicos", "Libro de Trabajo para Los Hábitos Atómicos") < 1);
  assert.equal(F.parecido("", "algo"), 0);
  assert.ok(F.parecido("padre rico", "Padre rico, padre pobre") > 0.8);
  assert.equal(F.esLatino("Gabriel García Márquez"), true);
  assert.equal(F.esLatino("Alberto Jiménez"), true, "tildes separadas también");
  assert.equal(F.esLatino("Фёдор Достоевский"), false);
  assert.equal(F.esLatino("村上春樹"), false);
  assert.equal(F.esLatino(""), false);
  assert.equal(F.limpiarTitulo("EL ALQUIMISTA"), "El alquimista");
  assert.equal(F.limpiarTitulo("Resumen de Hábitos atómicos : "), "Resumen de Hábitos atómicos");
  assert.equal(F.limpiarTitulo("Cien Años De Soledad"), "Cien Años De Soledad");
  assert.equal(F.limpiarTitulo("¿Quién se ha llevado mi queso?"), "¿Quién se ha llevado mi queso?");
  assert.deepEqual(F.leerBusqueda(null, "x"), { libros: [], autor: null });
  assert.deepEqual(F.leerBusqueda({ docs: [] }, "x"), { libros: [], autor: null });
});

// ---- Fase 2 (D-130): las páginas de tu edición ----
const eds = n => F.leerEdiciones(fx(`ediciones-${n}`));

test("ediciones: páginas, editorial, año, tapa e idioma de cada una", () => {
  const h = eds("habitos-atomicos");
  const diana = h.find(e => e.editorial === "Diana" && e.anio === 2025);
  assert.ok(diana);
  assert.deepEqual([diana.paginas, diana.formato, diana.idiomas, F.enEspanol(diana)], [448, "blanda", ["spa"], true]);
  assert.ok(h.some(e => !F.enEspanol(e)), "también vienen las de otros idiomas");
  assert.equal(F.urlEdiciones("/works/OL17930368W"), "https://openlibrary.org/works/OL17930368W/editions.json?limit=100");
  assert.equal(F.urlEdiciones("/works/OL17930368W", 100), "https://openlibrary.org/works/OL17930368W/editions.json?limit=100&offset=100");
  assert.equal(F.urlEdiciones("x"), null);
  assert.equal(F.urlIsbn("978-84-663-3212-5"), "https://openlibrary.org/isbn/9788466332125.json");
  assert.equal(F.urlIsbn("123"), null);
  assert.equal(F.urlEdicion("/books/OL35694843M"), "https://openlibrary.org/books/OL35694843M.json");
});

test("las ediciones en español se agrupan por largo parecido y se recomienda la más común", () => {
  const r = F.recomendar(eds("habitos-atomicos"));
  assert.equal(r.razon, "comun");
  assert.deepEqual(r.grupos.map(g => [g.min, g.max, g.n]), [[326, 338, 4], [448, 448, 3]]);
  assert.equal(r.paginas, 338, "el número del grupo es el de su edición más nueva");
  assert.equal(r.grupos[1].especial, true, "448: la edición especial");
  assert.equal(r.grupos[0].especial, false);
  const p = F.recomendar(eds("padre-rico"));
  assert.equal(p.paginas, 264);
  assert.equal(p.edicion.editorial, "Debolsillo");
  const c = F.recomendar(eds("cien-anos"));
  assert.equal(c.grupos[0].n, 7);
  assert.ok(c.grupos[0].min >= 494 && c.grupos[0].max <= 512);
  // Cada grupo llega hasta 6 % más que su más corta.
  c.grupos.forEach(g => assert.ok(g.max <= g.min * 1.06));
  // Audiolibros y digitales no cuentan.
  const a = eds("alquimista");
  assert.ok(a.some(e => e.formato === "audio"));
  assert.ok(F.recomendar(a).grupos.every(g => g.ediciones.every(e => e.formato !== "audio")));
});

test("con el ISBN manda tu edición exacta; si no hay en español, la de la búsqueda o la aproximada", () => {
  const exacta = F.leerEdicion(fx("isbn-9788466332125"));
  assert.deepEqual([exacta.titulo, exacta.paginas, exacta.editorial, exacta.anio, exacta.formato, exacta.isbn], ["Padre Rico, padre Pobre", 264, "Debolsillo", 2020, "blanda", "9788466332125"]);
  const r = F.recomendar(eds("padre-rico"), { exacta });
  assert.deepEqual([r.razon, r.paginas, r.edicion], ["isbn", 264, exacta]);
  assert.ok(r.grupos.length > 1, "igual se ven las otras ediciones");
  const ingles = eds("habitos-atomicos").filter(e => !F.enEspanol(e));
  assert.deepEqual([F.recomendar(ingles, { deBusqueda: { paginas: 330, editorial: "Paidós" } }).razon, F.recomendar(ingles, { deBusqueda: { paginas: 330 } }).paginas], ["busqueda", 330]);
  assert.deepEqual([F.recomendar(ingles, { mediana: 322 }).razon, F.recomendar(ingles, { mediana: 322 }).paginas], ["todas", 322]);
  assert.deepEqual([F.recomendar([], {}).razon, F.recomendar([], {}).paginas], ["ninguna", null]);
});

test("piezas de las ediciones: formato, páginas, año, editorial y cuándo pedir más", () => {
  assert.equal(F.formatoDe("Paperback"), "blanda");
  assert.equal(F.formatoDe("mass market paperback"), "bolsillo");
  assert.equal(F.formatoDe("Tapa dura"), "dura");
  assert.equal(F.formatoDe("Rústica"), "blanda");
  assert.equal(F.formatoDe("Audio Cassette"), "audio");
  assert.equal(F.formatoDe("Kindle Edition"), "digital");
  assert.equal(F.formatoDe(""), null);
  assert.equal(F.paginasDe({ number_of_pages: 320 }), 320);
  assert.equal(F.paginasDe({ pagination: "xii, 320 p." }), 320);
  assert.equal(F.paginasDe({ pagination: "448 páginas" }), 448);
  assert.equal(F.paginasDe({ pagination: "245" }), 245);
  assert.equal(F.paginasDe({ number_of_pages: 3 }), null);
  assert.equal(F.paginasDe({}), null);
  assert.deepEqual(["Mar 16, 2019", "06/02/2012", "2004-01-01", "October 2003", "s. f."].map(F.anioDe), [2019, 2012, 2004, 2003, null]);
  assert.equal(F.limpiarEditorial("Editorial Planeta, S. A."), "Editorial Planeta");
  assert.equal(F.limpiarEditorial("Grijalbo Mondadori Sa"), "Grijalbo Mondadori");
  assert.equal(F.limpiarEditorial("PAIDOS"), "Paidos");
  assert.equal(F.limpiarEditorial("Editorial Rosa"), "Editorial Rosa", "un nombre que termina en «sa» queda");
  assert.equal(F.textoEdicion({ editorial: "Diana", anio: 2025, formato: "blanda" }), "Diana · 2025 · tapa blanda");
  assert.equal(F.textoEdicion(null), "");
  assert.equal(F.pedirMas({ links: { next: "/x" } }, 100, 1), true);
  assert.equal(F.pedirMas({ links: { next: "/x" } }, 100, 6), false, "con suficientes en español, no");
  assert.equal(F.pedirMas({ links: { next: "/x" } }, 300, 0), false, "hasta 300");
  assert.equal(F.pedirMas({ links: {} }, 100, 0), false);
});

// ---- Fase 3 (D-131): la ficha del autor ----
test("el autor por su nombre: de los que se llaman igual, el que más obras tiene", () => {
  assert.equal(F.elegirAutor(fx("autores-paulo-coelho"), "Paulo Coelho"), "OL66700A", "no «Paulo Coelho Netto»");
  assert.equal(F.elegirAutor(fx("autores-paulo-coelho"), "paulo  COELHO"), "OL66700A");
  assert.equal(F.elegirAutor({ docs: [] }, "x"), null);
  assert.equal(F.elegirAutor(null, "x"), null);
  assert.match(F.urlBuscarAutor(" Paulo Coelho "), /^https:\/\/openlibrary\.org\/search\/authors\.json\?q=Paulo%20Coelho&limit=8$/);
  assert.match(F.urlLibrosDeAutor("OL66700A"), /q=author_key%3AOL66700A&lang=es&sort=editions&limit=30/);
  assert.equal(F.urlLibrosDeAutor("x"), null);
  assert.equal(F.mismoAutor("Robert T. Kiyosaki", "Robert Kiyosaki"), true);
  assert.equal(F.mismoAutor("R. Kiyosaki", "Robert Kiyosaki"), true);
  assert.equal(F.mismoAutor("Gabriel García Márquez", "gabriel garcia marquez"), true);
  assert.equal(F.mismoAutor("Paulo Coelho", "João Paulo Borges Coelho"), false);
  assert.equal(F.mismoAutor("Coelho", "Paulo Coelho"), false);
  assert.equal(F.mismoAutor("", "x"), false);
});

test("su ficha y su Wikipedia en español (emparejada por Wikidata)", () => {
  const a = F.leerAutor(fx("autor-coelho"));
  assert.deepEqual([a.key, a.nombre, a.nacio, a.murio, a.wikidata, F.anios(a)], ["OL66700A", "Paulo Coelho", 1947, null, "Q12881", "1947"]);
  assert.match(a.foto, /^https:\/\/covers\.openlibrary\.org\/a\/id\/\d+-M\.jpg$/);
  assert.ok(a.bio.length > 40);
  const w = F.leerWiki(fx("wiki-paulo-coelho"), a);
  assert.equal(w.titulo, "Paulo Coelho");
  assert.equal(w.descripcion, "escritor brasileño");
  assert.match(w.extracto, /^Paulo Coelho de Souza \(Río de Janeiro, 24 de agosto de 1947\) es un novelista/);
  assert.ok(!/cita requerida|\[\d+\]/.test(w.extracto), "sin las marcas de Wikipedia ([cita requerida])");
  assert.match(w.foto, /^https:\/\/(upload|thumb)\.wikimedia\.org\//);
  assert.equal(w.url, "https://es.wikipedia.org/wiki/Paulo_Coelho");
  // Con otro Wikidata, no es él (aunque se llame parecido).
  assert.equal(F.leerWiki(fx("wiki-paulo-coelho"), Object.assign({}, a, { wikidata: "Q1" })), null);
  // Sin Wikidata: solo si su apellido está en el título y escribe.
  assert.equal(F.leerWiki(fx("wiki-paulo-coelho"), { nombre: "Paulo Coelho", wikidata: null }).titulo, "Paulo Coelho");
  assert.equal(F.leerWiki(fx("wiki-george-hill"), { nombre: "George Hill", wikidata: null }), null, "no el basquetbolista");
  assert.equal(F.leerWiki(null, a), null);
  assert.equal(F.leerAutor(null), null);
  assert.equal(F.anios({ nacio: 1927, murio: 2014 }), "1927–2014");
  assert.equal(F.anios(null), "");
});

test("sus libros más leídos, en español, sin resúmenes y sin lo que ya tienes", () => {
  const l = F.librosDeAutor(fx("libros-de-coelho"));
  assert.ok(l.length >= 8 && l.length <= 12);
  assert.equal(l[0].titulo, "El alquimista");
  assert.ok(l.some(x => x.titulo === "Brida") && l.some(x => x.titulo === "La bruja de Portobello"));
  assert.ok(l.every(x => !x.derivado));
  for (let i = 1; i < l.length; i++) assert.ok(Number(l[i - 1].enEspanol) > Number(l[i].enEspanol) || l[i - 1].ediciones >= l[i].ediciones);
  const tengo = [{ titulo: "El Alquimista" }, { titulo: "x", olKey: l[1].olKey }];
  assert.equal(F.loTienes(l[0], tengo), true, "por el título");
  assert.equal(F.loTienes(l[1], tengo), true, "por la obra");
  assert.equal(F.loTienes(l[2], tengo), false);
  assert.equal(F.loTienes(Object.assign({}, l[0], { titulo: "Otro" }), [{ titulo: "O Alquimista" }]), true, "por el título original");
});

// ---- Fase 4 (D-132): temas en español y "De qué trata" ----
test("temas en español desde los de Open Library (hasta 5, sin repetir el género)", () => {
  const t = q => buscar(q[0], q[1]).libros[0].temas;
  assert.deepEqual(t(["padre-rico", "padre rico padre pobre"]), ["riqueza", "finanzas personales", "inversiones", "éxito"]);
  assert.deepEqual(t(["frankl", "el hombre en busca de sentido"]), ["Holocausto", "sentido de la vida", "espiritualidad"]);
  assert.ok(t(["habitos-atomicos", "habitos atomicos"]).includes("hábitos"));
  assert.ok(t(["cien-anos", "cien años de soledad"]).includes("realismo mágico"));
  assert.ok(buscar("habitos-atomicos", "habitos atomicos").libros.every(x => x.temas.length <= 5));
  assert.deepEqual(F.temasDe(["Transportation", "Sports", "Habitat"]), ["deporte", "hábitos"], "«sport» no es «transport»");
  assert.deepEqual(F.temasDe(["Psychology", "Self-help"], "psicologia"), ["autoayuda"], "sin repetir el género");
  assert.deepEqual(F.temasDe(["nyt:paperback_advice=2012-01-14", "Open Library Staff Picks", "Accessible book"]), []);
  assert.deepEqual(F.temasDe(null), []);
});

test("de qué trata: la página del libro en Wikipedia (no la serie ni la película)", () => {
  const c = F.leerWikiLibro(fx("wiki-libro-cien-anos"), "Cien años de soledad", "Gabriel García Márquez");
  assert.equal(c.fuente, "wikipedia");
  assert.equal(c.url, "https://es.wikipedia.org/wiki/Cien_a%C3%B1os_de_soledad");
  assert.match(c.texto, /^Cien años de soledad es una novela del escritor colombiano/);
  assert.equal(c.genero, "novela");
  assert.ok(c.texto.length <= 701);
  const h = F.leerWikiLibro(fx("wiki-libro-habitos"), "Hábitos atómicos", "James Clear");
  assert.match(h.texto, /^Hábitos atómicos: Cambios pequeños, resultados extraordinarios/);
  assert.equal(h.genero, null, "«libro de James Clear» no dice el género");
  const p = F.leerWikiLibro(fx("wiki-libro-principito"), "El principito", "Antoine de Saint-Exupéry");
  assert.match(p.texto, /^El principito \(en francés: Le Petit Prince\) es una novela corta/, "sin la pronunciación");
  assert.equal(p.genero, "novela");
  assert.equal(F.leerWikiLibro(fx("wiki-libro-cien-anos"), "Cien años de soledad", "Otro Autor"), null, "de otro autor, no");
  assert.equal(F.leerWikiLibro(fx("wiki-libro-principito"), "Rayuela", "Julio Cortázar"), null);
  assert.equal(F.leerWikiLibro(null, "x", "y"), null);
  assert.match(F.urlWikiLibro("Hábitos atómicos", "James Clear"), /gsrsearch=H%C3%A1bitos%20at%C3%B3micos%20clear&/);
});

test("de qué trata: Open Library solo si está en español; Google Books como extra", () => {
  const o = F.leerObra(fx("obra-cien-anos"));
  assert.equal(o.fuente, "openlibrary");
  assert.match(o.texto, /^Cien años de soledad es una novela/);
  assert.ok(!/[*_]/.test(o.texto), "sin markdown");
  assert.equal(F.leerObra(fx("obra-habitos")), null, "en inglés, no");
  assert.equal(F.urlObra("/works/OL274505W"), "https://openlibrary.org/works/OL274505W.json");
  assert.equal(F.urlObra("x"), null);
  // Formato de Google Books (ejemplo hecho a mano con la forma de su respuesta, no es una respuesta real).
  const g = { items: [
    { volumeInfo: { title: "Hábitos atómicos", authors: ["James Clear"], language: "en", description: "x".repeat(100) } },
    { volumeInfo: { title: "Hábitos atómicos", authors: ["James Clear"], language: "es", description: "<p>Un método <b>fácil</b> y comprobado para crear buenos hábitos y dejar los malos, paso a paso, con ejemplos de la vida real.</p>", infoLink: "http://books.google.com/x" } }
  ] };
  const r = F.leerGoogle(g, "Hábitos atómicos", "James Clear");
  assert.deepEqual([r.fuente, r.url], ["google", "https://books.google.com/x"]);
  assert.equal(r.texto, "Un método fácil y comprobado para crear buenos hábitos y dejar los malos, paso a paso, con ejemplos de la vida real.");
  assert.equal(F.leerGoogle(g, "Otro libro", "James Clear"), null);
  assert.equal(F.leerGoogle({ error: { code: 429 } }, "x", "y"), null);
  assert.match(F.urlGoogle("Hábitos atómicos", "James Clear"), /intitle%3AH%C3%A1bitos%20at%C3%B3micos%20inauthor%3Aclear&langRestrict=es/);
  assert.equal(F.esEspanol("The quick brown fox jumps over the lazy dog and the cat"), false);
  assert.equal(F.esEspanol("La novela cuenta la historia de una familia en un pueblo que se llama Macondo"), true);
  assert.equal(F.limpiarSinopsis("Texto [1] con nota[cita requerida] y *énfasis*."), "Texto con nota y énfasis.");
  assert.ok(F.limpiarSinopsis("Una frase. ".repeat(100), 200).length <= 201);
});
