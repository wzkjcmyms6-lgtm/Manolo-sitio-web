// Libros nivel 3, fase 6 (D-134): "Si te gustó…". Con respuestas reales de
// Open Library (tests/fixtures/libros/).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const R = require("../js/libros-recomendar.js");
const F = require("../js/libros-fuentes.js");

const fx = n => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "libros", `${n}.json`), "utf8"));
const PADRE = { id: "pr", titulo: "Padre rico, padre pobre", autor: "Robert T. Kiyosaki", autorKey: "OL242220A", genero: "finanzas", temas: ["riqueza", "finanzas personales", "inversiones", "éxito"], estado: "terminado", calificacion: 5, fechaFin: "2026-11-01", olKey: "/works/OL2010879W" };
const ALQUIMISTA = { id: "al", titulo: "El alquimista", autor: "Paulo Coelho", autorKey: "OL66700A", genero: "novela", temas: ["viajes"], estado: "terminado", calificacion: 4, fechaFin: "2026-10-01", olKey: "/works/OL796465W" };
const HABITOS = { id: "ha", titulo: "Hábitos atómicos", autor: "James Clear", genero: "desarrollo", temas: ["hábitos", "romper hábitos", "psicología", "negocios", "autoayuda"], estado: "terminado", calificacion: 5, fechaFin: "2026-09-01" };
const CIEN = { id: "ca", titulo: "Cien años de soledad", autor: "Gabriel García Márquez", genero: "novela", temas: ["realismo mágico"], estado: "terminado", calificacion: 5, fechaFin: "2026-08-01" };

test("de qué libros se parte: tus últimos de 4 y 5 estrellas", () => {
  const lista = [HABITOS, ALQUIMISTA, PADRE, CIEN,
    { id: "m", titulo: "Mediocre", estado: "terminado", calificacion: 3, fechaFin: "2026-11-10" },
    { id: "l", titulo: "Leyendo", estado: "leyendo", calificacion: 5 }];
  assert.deepEqual(R.semillas(lista).map(s => s.id), ["pr", "al", "ha"], "los 3 más recientes; 3 estrellas o leyendo, no");
  assert.deepEqual(R.semillas([]), []);
  // Se busca de nuevo si cambian tus favoritos (o sus temas), o pasó una semana.
  const f = R.firma([PADRE]);
  assert.ok(R.vigente({ firma: f, t: 1000 }, f, 1000 + 6 * 864e5));
  assert.ok(!R.vigente({ firma: f, t: 1000 }, f, 1000 + 8 * 864e5));
  assert.ok(!R.vigente({ firma: f, t: 1000 }, R.firma([Object.assign({}, PADRE, { temas: [] })]), 2000));
  // El tema que se busca: el más específico que tenga el libro.
  assert.deepEqual(F.sujetoDe(PADRE.temas), ["finanzas personales", "personal finance"]);
  assert.deepEqual(F.sujetoDe(HABITOS.temas), ["romper hábitos", "habit breaking"]);
  assert.equal(F.sujetoDe(ALQUIMISTA.temas), null, "«viajes» es amplio: solo su autor");
  assert.match(F.urlIdeasTema("personal finance"), /q=subject%3A%22personal%20finance%22%20language%3Aspa&lang=es/);
});

test("de los mismos temas: conocidos, en español, de otro autor y con temas en común", () => {
  const tus = [PADRE, { id: "x", titulo: "Piense y hágase rico", autor: "Napoleon Hill", estado: "por_leer" }];
  const r = R.deTema(fx("ideas-finanzas"), PADRE, "finanzas personales", tus);
  assert.deepEqual(r.map(i => i.libro.titulo), ["El hombre más rico de Babilonia", "La ciencia de hacerse rico", "Como Hacerse Rico", "Inversor Inteligente"],
    "«Piense y hágase rico» ya lo tienes; «The millionaire master plan» dice ser en español pero está en inglés; «/ Trump» sobra");
  assert.ok(r.every(i => i.libro.autor !== "Robert T. Kiyosaki"), "los del mismo autor van por su lado");
  assert.equal(r[0].texto, "también trata de finanzas personales y riqueza");
  assert.equal(R.razon(r[0]), "Como «Padre rico, padre pobre»: también trata de finanzas personales y riqueza");
  // Con un solo tema alcanza ese; novela con novela.
  const c = R.deTema(fx("ideas-realismo"), CIEN, "realismo mágico", [CIEN]);
  assert.deepEqual(c.map(i => i.libro.titulo).slice(0, 2), ["La casa de los espíritus", "Hijos de la medianoche"]);
  assert.ok(c.every(i => i.libro.autor !== "Gabriel García Márquez"));
  // "habits" trae cuentos infantiles: no pasan (ni los de un solo tema en común).
  const h = R.deTema(fx("ideas-habitos"), HABITOS, "hábitos", [HABITOS]);
  assert.deepEqual(h.map(i => i.libro.titulo), ["El poder de los hábitos", "La Obsesion De Comer"]);
  assert.equal(R.deTema(fx("ideas-habit-breaking"), HABITOS, "romper hábitos", [HABITOS])[0].texto, "también trata de romper hábitos y autoayuda", "«hábitos» ya está en «romper hábitos»");
});

test("del mismo autor: en español y que no tengas", () => {
  const r = R.delAutor(fx("libros-de-coelho"), ALQUIMISTA, [ALQUIMISTA, { id: "b", titulo: "Brida", autor: "Paulo Coelho" }]);
  assert.equal(r.length, R.POR_GRUPO);
  assert.ok(!r.some(i => /alquimista|brida/i.test(i.libro.titulo)), "lo que tienes no se ofrece");
  assert.equal(R.razon(r[0]), `Como «El alquimista»: también de Paulo Coelho`);
  assert.deepEqual(Object.keys(r[0].libro).filter(k => !["titulo", "tituloOriginal", "autor", "autorKey", "anio", "paginas", "url", "urlChica", "genero", "temas", "olKey", "edicionKey", "ediciones"].includes(k)), [], "solo lo que necesita «＋ Quiero leer»");
});

test("intercaladas, sin repetir, sin lo que agregaste ni lo que descartaste", () => {
  const a = { libro: { titulo: "A", olKey: "/works/OL1W" }, semilla: "X", texto: "t" };
  const b = { libro: { titulo: "B", olKey: "/works/OL2W" }, semilla: "X", texto: "t" };
  const c = { libro: { titulo: "C", olKey: "/works/OL3W" }, semilla: "Y", texto: "t" };
  const d = { libro: { titulo: "D" }, semilla: "Y", texto: "t" };
  assert.deepEqual(R.mezclar([[a, b], [c, a], [d]], []).map(i => i.libro.titulo), ["A", "C", "D", "B"]);
  assert.deepEqual(R.mezclar([[a, b], [c]], [{ titulo: "Otro", olKey: "/works/OL1W" }], ["/works/OL3W"]).map(i => i.libro.titulo), ["B"]);
  assert.deepEqual(R.mezclar([[a, b, c, d]], [], [], 2).map(i => i.libro.titulo), ["A", "B"]);
  assert.equal(R.claveIdea(d.libro), "t:d");
  assert.equal(R.yLista(["finanzas personales", "inversiones"]), "finanzas personales e inversiones");
  assert.equal(R.yLista(["viajes", "historia"]), "viajes e historia");
  assert.equal(R.yLista(["fe", "hierro"]), "fe y hierro");
  assert.equal(R.sinBarra("Como Agua Para Chocolate/Like Water for Chocolate"), "Como Agua Para Chocolate");
  assert.equal(R.sinBarra("24/7"), "24/7");
  assert.equal(R.sinBarra("Peregrino / the Pilgrimage"), "Peregrino");
  assert.ok(R.pareceIngles("The millionaire master plan") && !R.pareceIngles("El arte de la guerra") && !R.pareceIngles("Sapiens"));
});
