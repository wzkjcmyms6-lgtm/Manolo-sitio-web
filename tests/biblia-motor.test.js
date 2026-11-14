const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../js/biblia-motor.js");

const HOY = "2026-10-29";

test("los 66 libros con sus capítulos (1189 en total)", () => {
  assert.equal(B.LIBROS.length, 66);
  assert.equal(B.LIBROS.filter(l => l.testamento === "AT").length, 39);
  assert.equal(B.LIBROS.reduce((s, l) => s + l.capitulos, 0), 1189);
  assert.equal(B.LIBROS.filter(l => l.testamento === "AT").reduce((s, l) => s + l.capitulos, 0), 929);
  assert.equal(new Set(B.LIBROS.map(l => l.id)).size, 66, "códigos sin repetir");
  assert.deepEqual([B.libro("Ps").nombre, B.libro("Ps").capitulos], ["Salmos", 150]);
  assert.equal(B.libro("Rev").nombre, "Apocalipsis");
  assert.equal(B.libro("xx"), null);
});

test("buscar un libro por lo que escribes", () => {
  assert.equal(B.buscarLibro("juan").id, "John");
  assert.equal(B.buscarLibro("1 juan").id, "1John");
  assert.equal(B.buscarLibro("1juan").id, "1John");
  assert.equal(B.buscarLibro("Génesis").id, "Gen");
  assert.equal(B.buscarLibro("genesis").id, "Gen");
  assert.equal(B.buscarLibro("salmo").id, "Ps");
  assert.equal(B.buscarLibro("apoc").id, "Rev");
  assert.equal(B.buscarLibro(""), null);
  assert.equal(B.buscarLibro("zzz"), null);
});

test("versículo: uno, rango o lista", () => {
  assert.equal(B.versiculoNormal("16"), "16");
  assert.equal(B.versiculoNormal("16 - 18"), "16-18");
  assert.equal(B.versiculoNormal("16–18"), "16-18");
  assert.equal(B.versiculoNormal("1, 3"), "1,3");
  assert.equal(B.versiculoNormal("1-3,5"), "1-3,5");
  assert.equal(B.versiculoNormal("18-16"), null, "rango al revés");
  assert.equal(B.versiculoNormal("0"), null);
  assert.equal(B.versiculoNormal("177"), null, "ningún capítulo tiene más de 176");
  assert.equal(B.versiculoNormal("a"), null);
  assert.equal(B.cita({ libro: "John", capitulo: 3, versiculo: "16" }), "Juan 3:16");
});

test("validar un registro", () => {
  const ok = B.validar({ fecha: "2026-10-28", libro: "Ps", capitulo: "23", versiculo: "1-3", texto: "  Jehová es mi pastor; nada me faltará.  ", nota: "" }, { hoy: HOY });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.doc, { v: 1, fecha: "2026-10-28", libro: "Ps", capitulo: 23, versiculo: "1-3", texto: "Jehová es mi pastor; nada me faltará.", nota: "" });
  const mal = B.validar({ fecha: "2026-10-30", libro: "Jude", capitulo: "2", versiculo: "", texto: "" }, { hoy: HOY });
  assert.deepEqual(mal.errores.map(e => e.campo), ["fecha", "capitulo", "versiculo", "texto"]);
  assert.match(mal.errores[1].texto, /Judas va de 1 a 1/);
  assert.equal(B.validar({ fecha: "2026-01-01", capitulo: "1", versiculo: "1", texto: "x" }, { hoy: HOY }).errores[0].campo, "libro");
  assert.equal(B.validar({ fecha: "2020-01-01", libro: "Gen", capitulo: "1", versiculo: "1", texto: "x" }, { hoy: HOY }).ok, true, "días pasados sí");
});

const r = (id, fecha, libro, extra) => B.normalizarDoc(id, Object.assign({ v: 1, fecha, libro, capitulo: 1, versiculo: "1", texto: "texto", nota: "", creado: 1 }, extra));

test("orden, filtro por libro y buscador sin tildes", () => {
  const lista = [
    r("a", "2026-10-27", "John", { capitulo: 3, versiculo: "16", texto: "Porque de tal manera amó Dios al mundo" }),
    r("b", "2026-10-29", "Ps", { capitulo: 23, texto: "Jehová es mi pastor", nota: "Para empezar el día con paz" }),
    r("c", "2026-10-29", "Ps", { capitulo: 91, texto: "El que habita al abrigo del Altísimo", creado: 5 })
  ];
  assert.deepEqual(B.ordenar(lista).map(e => e.id), ["c", "b", "a"]);
  assert.deepEqual(B.filtrar(lista, { libro: "Ps" }).map(e => e.id), ["b", "c"]);
  assert.deepEqual(B.filtrar(lista, { texto: "altisimo" }).map(e => e.id), ["c"], "sin tildes");
  assert.deepEqual(B.filtrar(lista, { texto: "PAZ dia" }).map(e => e.id), ["b"], "busca en la nota, todas las palabras");
  assert.deepEqual(B.filtrar(lista, { texto: "juan 3:16" }).map(e => e.id), ["a"], "busca en la cita");
  assert.deepEqual(B.filtrar(lista, { fecha: "2026-10-29" }).map(e => e.id), ["b", "c"]);
  assert.deepEqual(B.librosUsados(lista).map(l => [l.nombre, l.n]), [["Salmos", 2], ["Juan", 1]], "en el orden de la Biblia");
  assert.deepEqual(B.porMes(lista).map(g => [g.titulo, g.items.length]), [["Octubre 2026", 3]]);
});

test("racha: viva hasta que termina el día, y la mejor", () => {
  const dias = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-26", "2026-10-27", "2026-10-28"];
  const lista = dias.map((f, i) => r(String(i), f, "Gen"));
  let k = B.racha(lista, HOY);
  assert.deepEqual([k.actual, k.mejor, k.hoyHecho, k.total, k.esteMes], [3, 4, false, 7, 7], "hoy aún no anotó: la racha de 3 sigue viva");
  k = B.racha(lista.concat(r("x", HOY, "Gen"), r("y", HOY, "Ps")), HOY);
  assert.deepEqual([k.actual, k.hoyHecho, k.total], [4, true, 8], "dos el mismo día cuentan como un día");
  k = B.racha(lista, "2026-10-30");
  assert.equal(k.actual, 0, "si pasó un día entero sin anotar, se corta");
  assert.equal(B.racha([], HOY).mejor, 0);
});

test("calendario de lunes a domingo", () => {
  const lista = [r("a", "2026-10-01", "Gen"), r("b", "2026-10-01", "Ps"), r("c", "2026-10-29", "Gen")];
  const c = B.calendario(lista, "2026-10", HOY);
  assert.equal(c.titulo, "Octubre 2026");
  assert.equal(c.semanas[0][0].fecha, "2026-09-28", "empieza el lunes anterior al 1");
  assert.equal(c.semanas[0][3].fecha, "2026-10-01");
  assert.equal(c.semanas[0][3].n, 2);
  assert.ok(c.semanas.every(s => s.length === 7));
  assert.equal(c.semanas[c.semanas.length - 1][6].fecha, "2026-11-01", "termina el domingo");
  assert.equal(c.dias, 2);
  const d29 = c.semanas.flat().find(d => d.fecha === HOY);
  assert.deepEqual([d29.hoy, d29.n, c.semanas.flat().find(d => d.fecha === "2026-10-30").futuro], [true, 1, true]);
  assert.equal(B.mesSiguiente("2026-12", 1), "2027-01");
  assert.equal(B.mesSiguiente("2026-01", -1), "2025-12");
  assert.equal(B.fechaLarga("2026-10-29"), "jue 29 oct 2026");
});

test("exportar JSON con la cita", () => {
  const j = JSON.parse(B.exportarJson({ a: { v: 1, fecha: "2026-10-29", libro: "John", capitulo: 3, versiculo: "16", texto: "t", nota: "" } }, "2026-10-29T12:00:00Z"));
  assert.equal(j.version, 1);
  assert.equal(j.versiculos[0].cita, "Juan 3:16");
  assert.equal(j.versiculos[0].id, "a");
});

test("la versión del texto es opcional (D-105)", () => {
  const base = { fecha: "2026-10-28", libro: "John", capitulo: "3", versiculo: "16", texto: "Porque de tal manera…" };
  assert.equal(B.validar(Object.assign({ version: "RVR1960" }, base), { hoy: HOY }).doc.version, "RVR1960");
  assert.equal(B.validar(Object.assign({ version: "RV1909" }, base), { hoy: HOY }).doc.version, "RV1909");
  assert.equal(B.validar(Object.assign({ version: "<b>NVI</b>" }, base), { hoy: HOY }).doc.version, "bNVIb", "sin caracteres raros");
  assert.equal("version" in B.validar(Object.assign({ version: "  " }, base), { hoy: HOY }).doc, false, "vacía: no se guarda");
  assert.equal(B.normalizarDoc("x", Object.assign({ version: "NTV" }, base)).version, "NTV");
  assert.equal(B.normalizarDoc("x", base).version, "", "los viejos no la tienen");
});

test("exportar incluye lo del lector (marcas y capítulos leídos)", () => {
  const docs = { a: { v: 1, fecha: "2026-10-29", libro: "John", capitulo: 3, versiculo: "16", texto: "t", nota: "" } };
  const solo = JSON.parse(B.exportarJson(docs, "2026-11-14T12:00:00Z"));
  assert.equal("marcas" in solo, false, "sin extras, como antes");
  const j = JSON.parse(B.exportarJson(docs, "2026-11-14T12:00:00Z", { marcas: { John: { col: { "3_16": "amarillo" } } }, leidos: { "2026-11-14": ["John.3"] }, lector: { tam: 2 } }));
  assert.deepEqual(j.marcas, { John: { col: { "3_16": "amarillo" } } });
  assert.deepEqual(j.capitulosLeidos, { "2026-11-14": ["John.3"] });
  assert.deepEqual(j.lector, { tam: 2 });
  assert.equal(j.versiculos.length, 1);
});
