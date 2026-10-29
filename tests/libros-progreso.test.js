const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/libros-progreso.js");
const L = require("../js/libros-motor.js");

const HOY = "2026-10-29";
const libro = (id, d) => L.normalizarLibro(id, Object.assign({ v: 1, titulo: id, autor: "", estado: "por_leer", fechaRegistro: "2026-10-01", creado: 1 }, d));
// Aplica los cambios como lo hace la pantalla (update en Firestore).
const aplicar = (l, r) => L.normalizarLibro(l.id, Object.assign({}, l, r.cambios));

test("anotar página: un libro nuevo empieza a contar desde la 0", () => {
  const l = libro("a", { paginas: 300 });
  const r = P.registrarPagina(l, "25", HOY);
  assert.equal(r.ok, true);
  assert.deepEqual(r.cambios, { paginaBase: 0, progreso: { [HOY]: 25 }, paginaActual: 25, estado: "leyendo", fechaInicio: HOY });
  assert.equal(r.terminado, false);
  assert.deepEqual(P.paginasPorDia([aplicar(l, r)]), { [HOY]: 25 });
});

test("anotar página: si ya lo venías leyendo, lo que llevabas no cuenta hoy", () => {
  const l = libro("b", { paginas: 400, estado: "leyendo", fechaInicio: "2026-10-01" });
  const r = P.registrarPagina(l, "150", HOY);
  assert.equal(r.cambios.paginaBase, 150);
  assert.equal(r.cambios.estado, undefined);
  assert.equal(r.cambios.fechaInicio, undefined);
  assert.deepEqual(P.paginasPorDia([aplicar(l, r)]), {});
});

test("anotar página: errores y la última del día manda", () => {
  const l = libro("c", { paginas: 100 });
  assert.equal(P.registrarPagina(l, "", HOY).error, "Escribe el número de la página.");
  assert.equal(P.registrarPagina(l, "12,5", HOY).ok, false);
  assert.equal(P.registrarPagina(l, "101", HOY).error, "El libro tiene 100 páginas.");
  let x = aplicar(l, P.registrarPagina(l, "10", HOY));
  x = aplicar(x, P.registrarPagina(x, "30", HOY));
  assert.deepEqual(x.progreso, { [HOY]: 30 });
  assert.equal(x.paginaBase, 0, "la base no cambia después de la primera vez");
  assert.deepEqual(P.paginasPorDia([x]), { [HOY]: 30 });
});

test("llegar a la última página lo marca terminado", () => {
  const l = libro("d", { paginas: 120, estado: "leyendo", fechaInicio: "2026-10-20", paginaActual: 100, paginaBase: 0, progreso: { "2026-10-28": 100 } });
  const r = P.registrarPagina(l, "120", HOY);
  assert.equal(r.terminado, true);
  assert.equal(r.cambios.estado, "terminado");
  assert.equal(r.cambios.fechaFin, HOY);
  assert.deepEqual(P.paginasPorDia([aplicar(l, r)]), { "2026-10-28": 100, [HOY]: 20 });
});

test("páginas por día suman todos los libros; una corrección hacia atrás no resta", () => {
  const a = libro("a", { paginaBase: 0, progreso: { "2026-10-27": 20, "2026-10-28": 50 } });
  const b = libro("b", { paginaBase: 100, progreso: { "2026-10-28": 130, [HOY]: 120 } });
  const viejo = libro("v", { progreso: { "2026-10-20": 80, "2026-10-21": 95 } }); // sin base: la primera es la base
  assert.deepEqual(P.paginasPorDia([a, b, viejo]), { "2026-10-27": 20, "2026-10-28": 60, "2026-10-21": 15 });
});

test("racha: días seguidos leyendo y la mejor", () => {
  const dias = { "2026-10-20": 5, "2026-10-21": 8, "2026-10-22": 3, "2026-10-23": 10, "2026-10-26": 4, "2026-10-27": 20, "2026-10-28": 12 };
  assert.deepEqual(P.racha(dias, HOY), { actual: 3, mejor: 4, hoyLeiste: false });
  assert.deepEqual(P.racha(Object.assign({ [HOY]: 30 }, dias), HOY), { actual: 4, mejor: 4, hoyLeiste: true });
  assert.deepEqual(P.racha({}, HOY), { actual: 0, mejor: 0, hoyLeiste: false });
});

test("lectura: %, lo que falta, tu ritmo y cuándo lo terminas", () => {
  const l = libro("e", { paginas: 300, estado: "leyendo", fechaInicio: "2026-10-20", paginaActual: 100, paginaBase: 0, progreso: { "2026-10-22": 40, "2026-10-28": 100 } });
  const r = P.lectura(l, HOY, 30);
  assert.equal(r.pct, 33);
  assert.equal(r.faltan, 200);
  assert.equal(r.ritmo, 10, "100 páginas en 10 días (desde que lo empezaste)");
  assert.deepEqual([r.diasRitmo, r.finRitmo], [20, "2026-11-18"]);
  assert.deepEqual([r.diasMeta, r.finMeta], [7, "2026-11-05"]);
  const sinPaginas = P.lectura(libro("f", { estado: "leyendo", paginaActual: 50 }), HOY, 30);
  assert.deepEqual([sinPaginas.pct, sinPaginas.faltan, sinPaginas.finMeta], [null, null, null]);
  const terminado = P.lectura(libro("g", { paginas: 200, estado: "terminado" }), HOY, 30);
  assert.deepEqual([terminado.pagina, terminado.pct, terminado.finRitmo], [200, 100, null]);
  const unDia = P.lectura(libro("h", { paginas: 300, estado: "leyendo", fechaInicio: HOY, paginaActual: 40, paginaBase: 0, progreso: { [HOY]: 40 } }), HOY, 0);
  assert.equal(unDia.ritmo, null, "con un solo día todavía no hay ritmo");
});

test("reto del año: al día, adelantado, atrasado o cumplido", () => {
  const fin = (id, f) => libro(id, { estado: "terminado", fechaFin: f });
  const lista = [fin("a", "2026-02-01"), fin("b", "2026-05-01"), fin("c", "2026-08-01"), fin("d", "2025-12-30"), libro("e", { estado: "leyendo" })];
  const r = P.reto(lista, 12, HOY);
  assert.equal(r.terminados, 3);
  assert.equal(r.esperado, 9.9);
  assert.equal(r.estado, "atrasado");
  assert.equal(r.diferencia, -7);
  assert.equal(r.faltan, 9);
  assert.equal(r.pct, 25);
  assert.equal(P.reto(lista, 3, HOY).estado, "cumplido");
  assert.equal(P.reto(lista, 4, HOY).estado, "al-dia");
  assert.equal(P.reto(lista, 2, "2026-03-01").estado, "cumplido");
  assert.equal(P.reto(lista, 0, HOY).estado, "sin-meta");
});

test("estadísticas del año", () => {
  const lista = [
    libro("a", { titulo: "A", autor: "Gabo", paginas: 400, estado: "terminado", fechaInicio: "2026-01-01", fechaFin: "2026-01-20", calificacion: 5, genero: "novela" }),
    libro("b", { titulo: "B", autor: "Gabo", paginas: 300, estado: "terminado", fechaInicio: "2026-03-01", fechaFin: "2026-03-10", calificacion: 4, genero: "novela", paginaBase: 0, progreso: { "2026-03-05": 150, "2026-03-10": 300 } }),
    libro("c", { titulo: "C", autor: "Otro", paginas: 200, estado: "terminado", fechaFin: "2025-06-01", genero: "fe" }),
    libro("d", { titulo: "D", estado: "leyendo", paginaBase: 0, progreso: { "2026-10-28": 30 } })
  ];
  const e = P.estadisticas(lista, HOY);
  assert.equal(e.terminadosAnio, 2);
  assert.deepEqual(e.porMes.map(m => m.libros), [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(e.paginasAnio, 400 + 300 + 30, "las anotadas día a día + los terminados sin anotar");
  assert.equal(e.diasLeyendoAnio, 3);
  assert.equal(e.promedioDia30, 1);
  assert.equal(e.calificacionMedia, 4.5);
  assert.deepEqual(e.autorTop, { nombre: "Gabo", n: 2 });
  assert.deepEqual(e.generos[0], { nombre: "novela", n: 2 });
  assert.equal(e.diasPorLibro, 15);
  assert.deepEqual(e.masLargo, { id: "a", titulo: "A", paginas: 400 });
  assert.equal(P.estadisticas([], HOY).autorTop, null);
});

test("últimos días para el gráfico y fecha corta", () => {
  const u = P.ultimosDias({ [HOY]: 12, "2026-10-27": 5 }, HOY, 3);
  assert.deepEqual(u, [{ fecha: "2026-10-27", paginas: 5 }, { fecha: "2026-10-28", paginas: 0 }, { fecha: HOY, paginas: 12 }]);
  assert.equal(P.fechaCorta("2026-11-05"), "5 nov");
});

test("terminar desde el formulario cierra el progreso; metas", () => {
  const l = libro("t", { paginas: 200, estado: "leyendo", paginaBase: 0, progreso: { "2026-10-20": 50, "2026-10-25": 120 } });
  assert.deepEqual(P.alTerminar(l, HOY), { progreso: { "2026-10-20": 50, "2026-10-25": 120, [HOY]: 200 }, paginaActual: 200 });
  assert.deepEqual(P.alTerminar(l, "2026-10-01"), {}, "una fecha de fin anterior a lo anotado no inventa días");
  assert.deepEqual(P.alTerminar(libro("u", { paginas: 200 }), HOY), {}, "sin progreso anotado, nada");
  assert.deepEqual(P.validarMetas({ metaPaginasDia: "30", reto: "" }), { ok: true, errores: [], metaPaginasDia: 30, reto: 0 });
  assert.equal(P.validarMetas({ metaPaginasDia: "30", reto: "12" }).reto, 12);
  assert.deepEqual(P.validarMetas({ metaPaginasDia: "0", reto: "x" }).errores.map(e => e.campo), ["metaPaginasDia", "reto"]);
});

