// Libros nivel 3, fase 5 (D-133): completar tu biblioteca. Con respuestas
// reales de Open Library (tests/fixtures/libros/).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const C = require("../js/libros-completar.js");
const F = require("../js/libros-fuentes.js");

const fx = n => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "libros", `${n}.json`), "utf8"));
const resultados = (n, l) => F.leerBusqueda(fx(`buscar-${n}`), C.consulta(l), 8).libros;

test("qué libros revisar: sin obra de Open Library o con algo importante por completar", () => {
  const lista = [
    { id: "a", titulo: "Atomic Habits", autor: "James Clear" },
    { id: "b", titulo: "Completo", autor: "X", genero: "novela", temas: ["viajes"], portada: { tipo: "url" }, anio: 2000, olKey: "/works/OL1W", paginas: 200 },
    { id: "c", titulo: "Sin temas", autor: "X", genero: "novela", temas: [], portada: { tipo: "url" }, anio: 2000, olKey: "/works/OL2W", paginas: 200 },
    { id: "d", titulo: "", autor: "X" },
    { id: "e", titulo: "Sin páginas", autor: "X", genero: "novela", temas: ["viajes"], portada: { tipo: "url" }, anio: 2000, olKey: "/works/OL3W" },
    { id: "f", titulo: "Audiolibro", autor: "X", genero: "novela", temas: ["viajes"], portada: { tipo: "url" }, anio: 2000, olKey: "/works/OL4W", formato: "audio" }
  ];
  assert.deepEqual(C.pendientes(lista).map(l => l.id), ["a", "c", "e"], "el audiolibro no necesita páginas");
  assert.deepEqual(C.falta(lista[0]), ["genero", "temas", "portada", "anio", "olKey", "paginas"]);
  // Lo que dejaste como está no vuelve, salvo que cambies el título o el autor.
  assert.deepEqual(C.pendientes(lista, { a: C.firma(lista[0]) }).map(l => l.id), ["c", "e"]);
  assert.deepEqual(C.pendientes(lista, { a: "otro|x" }).map(l => l.id), ["a", "c", "e"]);
  assert.equal(C.consulta({ titulo: " Atomic Habits ", autor: "James Clear" }), "Atomic Habits clear");
  assert.equal(C.consulta({ titulo: "Crimen y castigo", autor: "Фёдор Достоевский" }), "Crimen y castigo");
});

test("el título que quedó en inglés pasa al español (y el tuyo queda como original)", () => {
  const l = { id: "a", titulo: "Atomic Habits", autor: "James Clear", temas: [] };
  const m = C.emparejar(l, resultados("habitos-atomicos", l));
  assert.deepEqual([m.resultado.titulo, m.confianza], ["Hábitos atómicos", "alta"]);
  const p = C.propuesta(l, m.resultado);
  assert.equal(p.cambios.titulo, "Hábitos atómicos");
  assert.equal(p.cambios.tituloOriginal, "Atomic Habits");
  assert.equal(p.cambios.autorKey, "OL7422948A", "mismo autor: se suma su clave");
  assert.equal(p.cambios.genero, "desarrollo");
  assert.ok(p.cambios.temas.includes("hábitos"));
  assert.deepEqual(Object.keys(p.cambios.portada), ["tipo", "url", "fuente"]);
  assert.ok(!("autor" in p.cambios), "el autor que escribiste no se toca");
  assert.match(p.lista[0].texto, /^Título en español: «Hábitos atómicos»/);
});

test("solo se suma lo que falta; nada de lo que ya tienes cambia", () => {
  const l = { id: "b", titulo: "El alquimista", autor: "", genero: "fe", temas: ["mis temas"], portada: { tipo: "foto" }, anio: 1990 };
  const m = C.emparejar(l, resultados("alquimista", l));
  const p = C.propuesta(l, m.resultado);
  assert.deepEqual(Object.keys(p.cambios).sort(), ["autor", "autorKey", "olKey"]);
  assert.equal(p.cambios.autor, "Paulo Coelho");
  assert.deepEqual(p.lista.map(c => c.campo), ["autor"]);
  // Deshacer: cómo estaba cada campo cambiado.
  assert.deepEqual(C.antes(l, p.cambios), { autor: null, autorKey: null, olKey: null });
  assert.deepEqual(C.antes({ temas: [] }, { temas: ["x"] }), { temas: null });
});

test("si no es el mismo libro (otro autor o un resumen), no se propone", () => {
  const silva = { id: "s", titulo: "El alquimista", autor: "Lorenzo Silva" };
  const m = C.emparejar(silva, resultados("alquimista", silva));
  assert.deepEqual([m.resultado.titulo, m.confianza], ["El alquimista impaciente", "media"], "parecido: con duda");
  const otro = { id: "o", titulo: "Hábitos atómicos", autor: "Otra Persona" };
  assert.equal(C.emparejar(otro, resultados("habitos-atomicos", otro)), null);
  assert.equal(C.confianza({ titulo: "Resumen de Hábitos atómicos" }, { titulo: "Resumen de Hábitos atómicos", derivado: true }), null);
  assert.equal(C.confianza({ titulo: "Algo" }, null), null);
  assert.equal(C.confianza({ titulo: "Un libro" }, { titulo: "Otro título distinto" }), null);
});

test("a los que no tienen páginas: las de la edición en español más común", () => {
  const l = { id: "b", titulo: "El alquimista", autor: "" };
  const m = C.emparejar(l, resultados("alquimista", l));
  const r = F.recomendar(F.leerEdiciones(fx("ediciones-alquimista")), { mediana: m.resultado.paginas });
  const pag = C.paginasDe(l, r);
  assert.deepEqual(pag, { paginas: 192, texto: "Páginas: 192 (la edición en español más común)" }, "6 ediciones en español de 192 (la mediana de todas era 197)");
  const p = C.propuesta(l, m.resultado, pag);
  assert.equal(p.cambios.paginas, 192);
  assert.deepEqual(p.lista.map(c => c.campo), ["autor", "genero", "temas", "portada", "paginas", "anio"]);
  // Las tuyas mandan; el audiolibro no; la mediana de todos los idiomas no;
  // nunca menos que la página en la que vas.
  assert.equal(C.paginasDe({ paginas: 180 }, r), null);
  assert.equal(C.paginasDe({ formato: "audio" }, r), null);
  assert.equal(C.paginasDe({}, { paginas: 197, razon: "todas", grupos: [] }), null);
  assert.equal(C.paginasDe({ paginaActual: 200 }, r), null);
  assert.equal(C.paginasDe({}, { paginas: 140, razon: "unica" }).texto, "Páginas: 140 (la edición en español que encontré)");
  assert.ok(!("paginas" in C.propuesta(Object.assign({}, l, { paginas: 180 }), m.resultado, pag).cambios));
});
