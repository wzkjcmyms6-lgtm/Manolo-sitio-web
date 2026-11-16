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


test("audiolibro: avance en % o por tiempo; no suma páginas (D-107)", () => {
  const a = libro("au", { formato: "audio", duracionMin: 600, estado: "leyendo", fechaInicio: "2026-10-20" });
  assert.deepEqual(P.leerAvance(a, "3:00"), { ok: true, valor: 30 });
  assert.deepEqual(P.leerAvance(a, "45 %"), { ok: true, valor: 45 });
  assert.equal(P.leerAvance(a, "11:00").ok, false, "más que lo que dura");
  assert.equal(P.leerAvance(libro("sin", { formato: "audio" }), "3:00").ok, false, "sin duración, solo %");
  assert.deepEqual(P.leerAvance(libro("p", {}), "142"), { ok: true, valor: 142 });
  const r = P.registrarAvance(a, 30, HOY);
  assert.deepEqual(r.cambios, { pctBase: 30, progresoPct: { [HOY]: 30 }, pctActual: 30 }, "ya lo venía escuchando: lo de antes no cuenta hoy");
  const conAvance = Object.assign({}, a, r.cambios, { progresoPct: { "2026-10-25": 10, [HOY]: 30 }, pctBase: 0 });
  const x = P.lectura(conAvance, HOY, 30);
  assert.deepEqual([x.unidad, x.pagina, x.pct, x.faltan, x.faltaAudioMin, x.finMeta], ["pct", 30, 30, 70, 420, null], "faltan 7 horas de audio; la meta de páginas no aplica");
  assert.equal(P.avanceTexto(conAvance), "3:00");
  assert.deepEqual(P.pasos(conAvance).map(p => p.texto), ["+15 min", "+30 min", "+1 h"]);
  assert.equal(P.sumarAvance(conAvance, "3:00", 30), "3:30");
  assert.equal(P.sumarAvance(conAvance, "", "fin"), "10:00");
  assert.deepEqual(P.paginasPorDia([conAvance]), {}, "el audiolibro no suma páginas");
  const fin = P.registrarAvance(conAvance, 100, HOY);
  assert.deepEqual([fin.terminado, fin.cambios.estado, fin.cambios.fechaFin], [true, "terminado", HOY]);
  const pct = libro("pc", { formato: "audio", estado: "leyendo", pctActual: 40 });
  assert.deepEqual([P.avanceTexto(pct), P.sumarAvance(pct, "", 10), P.pasos(pct)[0].texto], ["40", "50", "+5 %"]);
  assert.deepEqual(P.alTerminar(Object.assign({}, conAvance), HOY), { progresoPct: { "2026-10-25": 10, [HOY]: 100 }, pctActual: 100 });
});

test("releer: la lectura anterior queda guardada y todo cuenta (D-107)", () => {
  const l = libro("re", { titulo: "Cien años", autor: "GGM", paginas: 300, estado: "terminado", calificacion: 5, fechaInicio: "2026-01-05", fechaFin: "2026-02-01",
    paginaActual: 300, paginaBase: 0, progreso: { "2026-01-10": 100, "2026-02-01": 300 } });
  const c = P.nuevaLectura(l, HOY, 99);
  assert.deepEqual(c["lecturas.1"], { estado: "terminado", fechaInicio: "2026-01-05", fechaFin: "2026-02-01", formato: "papel", paginas: 300, calificacion: 5, cerrada: 99,
    paginaActual: 300, paginaBase: 0, progreso: { "2026-01-10": 100, "2026-02-01": 300 } });
  assert.deepEqual([c.estado, c.fechaInicio, c.fechaFin, c.paginaActual, c.paginaBase], ["leyendo", HOY, null, 0, 0]);
  // Como queda en Firestore (con el mapa lecturas).
  const nuevo = Object.assign({}, l, c, { lecturas: { 1: c["lecturas.1"] } });
  delete nuevo["lecturas.1"];
  assert.deepEqual(P.lecturasDe(nuevo).map(x => [x.n, x.estado, x.actual]), [[1, "terminado", false], [2, "leyendo", true]]);
  const conPaginas = Object.assign({}, nuevo, P.registrarAvance(nuevo, 40, HOY).cambios);
  const porDia = P.paginasPorDia([conPaginas]);
  assert.deepEqual([porDia["2026-01-10"], porDia["2026-02-01"], porDia[HOY]], [100, 200, 40], "las páginas de la primera lectura siguen contando");
  const segunda = Object.assign({}, conPaginas, { estado: "terminado", fechaFin: HOY, paginaActual: 300 });
  assert.equal(P.reto([segunda], 10, HOY).terminados, 2, "cada vez que lo terminaste cuenta para el reto");
  assert.deepEqual(P.terminaciones([segunda]).map(t => [t.n, t.fechaFin]), [[1, "2026-02-01"], [2, HOY]]);
  const est = P.estadisticas([segunda], HOY);
  assert.deepEqual([est.terminadosAnio, est.porMes[1].libros, est.porMes[9].libros], [2, 1, 1]);
  assert.equal(P.nuevaLectura(nuevo, HOY, 1)["lecturas.2"].estado, "leyendo", "la tercera guarda la segunda en lecturas.2");
});

test("abandonar y retomar (D-107)", () => {
  assert.deepEqual(P.abandonar(HOY), { estado: "abandonado", fechaDejado: HOY });
  assert.deepEqual(P.retomar(), { estado: "leyendo" });
  const dejado = libro("ab", { paginas: 200, estado: "abandonado", fechaInicio: "2026-10-01", paginaActual: 50, paginaBase: 0, progreso: { "2026-10-02": 50 } });
  assert.equal(P.registrarPagina(dejado, "60", HOY).cambios.estado, "leyendo", "anotar una página lo retoma");
  assert.equal(P.reto([dejado], 5, HOY).terminados, 0, "abandonado no cuenta como terminado");
});

// ---- Nivel 3, fase 2 (D-130): ¿para cuándo lo quieres terminar? ----
test("para terminarlo en una fecha: páginas por día (hoy cuenta) y tres sugerencias", () => {
  const l = { estado: "leyendo", paginas: 300, paginaActual: 90, progreso: { "2026-11-10": 50, "2026-11-15": 90 }, fechaInicio: "2026-11-10" };
  const r = P.paraTerminar(l, "2026-11-22", "2026-11-16");
  assert.deepEqual([r.dias, r.faltan, r.porDia, r.vencida, r.unidad], [7, 210, 30, false, "pag"]);
  assert.equal(P.paraTerminar(l, "2026-11-16", "2026-11-16").porDia, 210, "terminarlo hoy: todo hoy");
  assert.equal(P.paraTerminar(l, "2026-11-10", "2026-11-16").vencida, true);
  assert.equal(P.paraTerminar(l, "mañana", "2026-11-16"), null);
  assert.equal(P.paraTerminar(Object.assign({}, l, { paginaActual: 300 }), "2026-11-22", "2026-11-16"), null, "si no falta nada, no hay meta");
  const s = P.sugerenciasFin(l, "2026-11-16");
  assert.deepEqual(s.map(x => [x.nombre, x.fecha, x.porDia]), [["En 1 semana", "2026-11-22", 30], ["En 2 semanas", "2026-11-29", 15], ["En 1 mes", "2026-12-15", 7]]);
  // Un audiolibro va en %.
  const a = { estado: "leyendo", formato: "audio", pctActual: 40, progresoPct: { "2026-11-15": 40 } };
  assert.deepEqual([P.paraTerminar(a, "2026-11-21", "2026-11-16").porDia, P.paraTerminar(a, "2026-11-21", "2026-11-16").unidad], [10, "pct"]);
});
