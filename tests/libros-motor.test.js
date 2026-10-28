const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/libros-motor.js");

const HOY = "2026-10-29";
const libro = (id, d) => L.normalizarLibro(id, Object.assign({ v: 1, titulo: "T", autor: "", estado: "por_leer", fechaRegistro: "2026-10-01", creado: 1 }, d));

test("validar un libro: título obligatorio, fechas editables y coherentes", () => {
  const r = L.validarLibro({ titulo: "  Cien años   de soledad ", autor: "Gabriel García Márquez", paginas: "471", estado: "terminado", calificacion: "5",
    opinion: " Una obra maestra. ", fechaRegistro: "2025-03-01", fechaInicio: "2025-01-10", fechaFin: "2025-02-20" }, { hoy: HOY });
  assert.equal(r.ok, true);
  assert.deepEqual(r.doc, { v: 1, titulo: "Cien años de soledad", autor: "Gabriel García Márquez", paginas: 471, estado: "terminado", calificacion: 5,
    opinion: "Una obra maestra.", fechaRegistro: "2025-03-01", fechaInicio: "2025-01-10", fechaFin: "2025-02-20" });
  const min = L.validarLibro({ titulo: "Solo título", fechaRegistro: HOY }, { hoy: HOY });
  assert.deepEqual([min.ok, min.doc.paginas, min.doc.calificacion, min.doc.fechaInicio, min.doc.fechaFin, min.doc.estado], [true, null, null, null, null, "por_leer"], "lo demás es opcional");
  const mal = L.validarLibro({ titulo: "", paginas: "12.5", calificacion: "6", fechaRegistro: "", fechaInicio: "2026-10-20", fechaFin: "2026-10-10" }, { hoy: HOY });
  assert.deepEqual(mal.errores.map(e => e.campo), ["titulo", "paginas", "calificacion", "fechaRegistro", "fechaFin"]);
  assert.match(mal.errores[4].texto, /antes del inicio/);
  assert.equal(L.validarLibro({ titulo: "x", fechaRegistro: "2026-11-01" }, { hoy: HOY }).errores[0].texto, "La fecha de registro no puede ser futura.");
  assert.equal(L.validarLibro({ titulo: "x", fechaRegistro: HOY, calificacion: "0" }, { hoy: HOY }).doc.calificacion, null, "0 = sin calificación");
  assert.equal(L.estrellas(4), "★★★★☆");
  assert.equal(L.estrellas(null), "");
});

test("ordenar por fecha (sin fecha al final) o por título", () => {
  const lista = [
    libro("a", { titulo: "Zorba", fechaRegistro: "2026-10-01", fechaFin: "2026-09-01" }),
    libro("b", { titulo: "Ana Karenina", fechaRegistro: "2026-10-20" }),
    libro("c", { titulo: "él y yo", fechaRegistro: "2026-05-01", fechaFin: "2026-10-15", fechaInicio: "2026-09-01" })
  ];
  assert.deepEqual(L.ordenar(lista, "registro").map(l => l.id), ["b", "a", "c"]);
  assert.deepEqual(L.ordenar(lista, "fin").map(l => l.id), ["c", "a", "b"], "sin fecha de fin al final");
  assert.deepEqual(L.ordenar(lista, "inicio").map(l => l.id)[0], "c");
  assert.deepEqual(L.ordenar(lista, "titulo").map(l => l.id), ["b", "c", "a"], "A–Z sin importar tildes ni mayúsculas");
});

test("buscar por título o autor y filtrar por estado; resumen", () => {
  const lista = [
    libro("a", { titulo: "El principito", autor: "Antoine de Saint-Exupéry", estado: "terminado", paginas: 96, fechaFin: "2026-03-01" }),
    libro("b", { titulo: "Cien años de soledad", autor: "García Márquez", estado: "leyendo", paginas: 471 }),
    libro("c", { titulo: "Rayuela", autor: "Cortázar", estado: "terminado", paginas: 600, fechaFin: "2025-12-01" })
  ];
  assert.deepEqual(L.filtrar(lista, { texto: "exupery" }).map(l => l.id), ["a"], "sin tildes");
  assert.deepEqual(L.filtrar(lista, { texto: "garcia soledad" }).map(l => l.id), ["b"], "todas las palabras, en título o autor");
  assert.deepEqual(L.filtrar(lista, { estado: "terminado" }).map(l => l.id), ["a", "c"]);
  const r = L.resumen(lista, HOY);
  assert.deepEqual([r.total, r.leyendo, r.terminado, r.por_leer, r.paginasLeidas, r.terminadosEsteAnio], [3, 1, 2, 0, 696, 1]);
});

test("tapa genérica: el mismo libro, el mismo color", () => {
  const a = L.colorTapa("Rayuela", "Cortázar");
  assert.deepEqual(a, L.colorTapa("rayuela", "cortazar"));
  assert.equal(a.length, 2);
  assert.ok(/^#[0-9a-f]{6}$/.test(a[0]));
});

test("frases: validar, ordenar, buscar (también por libro)", () => {
  const ok = L.validarFrase({ libroId: "a", texto: " Lo esencial es invisible a los ojos. ", pagina: "72", fecha: "2026-10-28" }, { hoy: HOY, libros: ["a"] });
  assert.deepEqual(ok.doc, { v: 1, libroId: "a", texto: "Lo esencial es invisible a los ojos.", pagina: 72, fecha: "2026-10-28" });
  assert.equal(L.validarFrase({ libroId: "a", texto: "x", fecha: HOY }, { hoy: HOY }).doc.pagina, null, "página opcional");
  const mal = L.validarFrase({ libroId: "zz", texto: "", pagina: "-3", fecha: "2026-12-01" }, { hoy: HOY, libros: ["a"] });
  assert.deepEqual(mal.errores.map(e => e.campo), ["libroId", "texto", "pagina", "fecha"]);
  const libros = [libro("a", { titulo: "El principito", autor: "Saint-Exupéry" }), libro("b", { titulo: "Rayuela" })];
  const frases = [
    L.normalizarFrase("f1", { libroId: "a", texto: "Lo esencial es invisible a los ojos.", fecha: "2026-10-28" }),
    L.normalizarFrase("f2", { libroId: "b", texto: "Andábamos sin buscarnos, pero sabiendo que andábamos para encontrarnos.", fecha: "2026-10-29" }),
    L.normalizarFrase("f3", { libroId: "a", texto: "Fue el tiempo que pasaste con tu rosa.", fecha: "2026-10-29", creado: 9 })
  ];
  assert.deepEqual(L.ordenarFrases(frases).map(f => f.id), ["f3", "f2", "f1"]);
  assert.deepEqual(L.frasesDe(frases, "a").map(f => f.id), ["f3", "f1"]);
  assert.deepEqual(L.filtrarFrases(frases, libros, "andabamos").map(f => f.id), ["f2"], "sin tildes");
  assert.deepEqual(L.filtrarFrases(frases, libros, "principito").map(f => f.id).sort(), ["f1", "f3"], "busca también por el libro");
});

test("exportar JSON con libros, frases y fotos de portada", () => {
  const j = JSON.parse(L.exportarJson({ a: { titulo: "X" } }, { f: { libroId: "a", texto: "y" } }, "2026-10-29T12:00:00Z", { a: { datos: "data:image/jpeg;base64,AA", ancho: 1, alto: 1 } }));
  assert.deepEqual([j.version, j.libros[0].id, j.frases[0].libroId, j.fotosDePortada[0].libroId], [1, "a", "a", "a"]);
  assert.deepEqual(JSON.parse(L.exportarJson({}, {}, "x")).fotosDePortada, []);
});

test("portadas: búsqueda en Open Library y solo URLs de portadas", () => {
  assert.equal(L.urlBusqueda("Cien años de soledad", "García Márquez"),
    "https://openlibrary.org/search.json?title=Cien%20a%C3%B1os%20de%20soledad&author=Garc%C3%ADa%20M%C3%A1rquez&limit=12&fields=key%2Ctitle%2Cauthor_name%2Ccover_i%2Cfirst_publish_year");
  assert.ok(!L.urlBusqueda("Rayuela", "").includes("author="), "sin autor, busca solo por título");
  const r = L.leerBusqueda({ docs: [
    { title: "Cien años de soledad", author_name: ["Gabriel García Márquez"], cover_i: 12627383, first_publish_year: 1967 },
    { title: "Sin tapa" },
    { title: "Repetida", cover_i: 12627383 },
    { title: "Otra", author_name: ["A", "B"], cover_i: 7 }
  ] });
  assert.deepEqual(r.map(x => x.url), ["https://covers.openlibrary.org/b/id/12627383-M.jpg", "https://covers.openlibrary.org/b/id/7-M.jpg"], "solo con portada y sin repetir");
  assert.equal(r[1].autor, "A, B");
  assert.equal(r[0].urlChica, "https://covers.openlibrary.org/b/id/12627383-S.jpg");
  assert.deepEqual(L.leerBusqueda(null), []);
  assert.equal(L.leerBusqueda({ docs: Array.from({ length: 20 }, (_, i) => ({ cover_i: i + 1 })) }, 6).length, 6);
  assert.ok(L.portadaUrlOk("https://covers.openlibrary.org/b/id/123-L.jpg"));
  assert.ok(!L.portadaUrlOk("https://ejemplo.com/x.jpg"));
  assert.ok(!L.portadaUrlOk("javascript:alert(1)"));
});

test("portadas: foto achicada y comprimida para Firestore", () => {
  assert.deepEqual(L.medidasFoto(3024, 4032), { ancho: 400, alto: 533 }, "foto del iPhone: entra en 400 × 600 sin deformarse");
  assert.deepEqual(L.medidasFoto(1200, 1800), { ancho: 400, alto: 600 });
  assert.deepEqual(L.medidasFoto(200, 300), { ancho: 200, alto: 300 }, "una chica no se agranda");
  assert.ok(L.CALIDADES.every((q, i) => i === 0 || q < L.CALIDADES[i - 1]), "calidades de mayor a menor");
  assert.ok(L.LIMITE_FOTO * 1.1 < 1048576, "muy por debajo del límite de 1 MB por documento");
  const chica = "data:image/jpeg;base64," + "A".repeat(1000);
  assert.ok(L.fotoOk(chica));
  assert.ok(!L.fotoOk("data:image/png;base64,AAAA"), "solo JPEG");
  assert.ok(!L.fotoOk("data:image/jpeg;base64," + "A".repeat(L.LIMITE_FOTO)), "más grande que el límite: no");
  assert.equal(L.portadaParaGuardar(undefined, 1), undefined, "sin cambios");
  assert.equal(L.portadaParaGuardar(null, 1), null, "quitar");
  assert.deepEqual(L.portadaParaGuardar({ tipo: "url", url: "https://covers.openlibrary.org/b/id/7-M.jpg" }, 1), { tipo: "url", url: "https://covers.openlibrary.org/b/id/7-M.jpg", fuente: "openlibrary" });
  assert.equal(L.portadaParaGuardar({ tipo: "url", url: "https://otro.com/a.jpg" }, 1), null);
  assert.deepEqual(L.portadaParaGuardar({ tipo: "foto", datos: chica }, 5), { tipo: "foto", actualizado: 5 });
  assert.equal(L.kb("data:image/jpeg;base64," + "A".repeat(4096)), 3);
});
