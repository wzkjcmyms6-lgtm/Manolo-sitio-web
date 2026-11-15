// Estadísticas nuevas y "Tu año en libros" (js/libros-estadisticas.js, D-112).
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/libros-estadisticas.js");
const L = require("../js/libros-motor.js");

const HOY = "2026-11-15";   // domingo
const ses = (fecha, min, desde, hasta, unidad) => ({ fecha, min, desde, hasta, unidad: unidad || "pag", ini: Date.parse(`${fecha}T08:00:00Z`) });
const LIBROS = [
  L.normalizarLibro("a", { titulo: "Hábitos atómicos", autor: "James Clear", paginas: 320, genero: "desarrollo", calificacion: 5, estado: "terminado",
    fechaRegistro: "2026-09-20", fechaInicio: "2026-10-01", fechaFin: "2026-10-20", paginaBase: 0, paginaActual: 320,
    progreso: { "2026-10-01": 40, "2026-10-02": 80, "2026-10-03": 120, "2026-10-10": 200, "2026-10-20": 320 },
    sesiones: { s1: ses("2026-10-02", 60, 40, 80), s2: ses("2026-10-03", 60, 80, 120) } }),
  L.normalizarLibro("b", { titulo: "El poder del hábito", autor: "Charles Duhigg", paginas: 400, genero: "desarrollo", calificacion: 4, estado: "terminado",
    fechaRegistro: "2026-05-20", fechaInicio: "2026-06-01", fechaFin: "2026-06-30", sesiones: { s1: ses("2026-06-05", 120, 0, 60) } }),
  L.normalizarLibro("c", { titulo: "Meditaciones", autor: "Marco Aurelio", paginas: 200, genero: "filosofia", calificacion: 5, estado: "terminado",
    fechaRegistro: "2026-02-20", fechaInicio: "2026-09-01", fechaFin: "2026-09-05", paginaBase: 0, paginaActual: 200,
    progreso: { "2026-09-01": 50, "2026-09-03": 120, "2026-09-05": 200 },
    lecturas: { 1: { estado: "terminado", fechaInicio: "2026-03-01", fechaFin: "2026-03-20", paginaBase: 0, paginaActual: 200, progreso: { "2026-03-01": 100, "2026-03-20": 200 } } },
    sesiones: { s1: ses("2026-09-01", 50, 0, 50), s2: ses("2026-09-03", 70, 50, 120) } }),
  L.normalizarLibro("d", { titulo: "Sapiens", autor: "Yuval Noah Harari", formato: "audio", duracionMin: 900, genero: "historia", estado: "leyendo",
    fechaRegistro: "2026-11-09", fechaInicio: "2026-11-10", pctBase: 0, pctActual: 25, progresoPct: { "2026-11-10": 10, "2026-11-12": 25 },
    sesiones: { s1: ses("2026-11-12", 45, 10, 25, "pct") } }),
  L.normalizarLibro("e", { titulo: "Rayuela", autor: "Julio Cortázar", paginas: 600, genero: "novela", estado: "terminado", fechaRegistro: "2025-11-01", fechaInicio: "2025-11-05", fechaFin: "2025-12-10" }),
  L.normalizarLibro("f", { titulo: "Ulises", autor: "James Joyce", paginas: 900, estado: "abandonado", fechaRegistro: "2026-07-01", fechaInicio: "2026-07-02", fechaDejado: "2026-08-01" }),
  L.normalizarLibro("h", { titulo: "Deep Work", autor: "Cal Newport", paginas: 300, genero: "desarrollo", estado: "leyendo", fechaRegistro: "2026-10-30", fechaInicio: "2026-11-01",
    paginaBase: 0, paginaActual: 120, progreso: { "2026-11-01": 30, "2026-11-14": 90, "2026-11-15": 120 },
    sesiones: { s1: ses("2026-11-01", 40, 0, 30), s2: ses("2026-11-14", 60, 30, 90), s3: ses("2026-11-15", 30, 90, 120) } }),
  L.normalizarLibro("i", { titulo: "El hombre en busca de sentido", autor: "Viktor Frankl", paginas: 160, genero: "psicologia", calificacion: 4, estado: "terminado",
    fechaRegistro: "2026-10-24", fechaInicio: "2026-10-25", fechaFin: "2026-10-28" }),
  L.normalizarLibro("k", { titulo: "Pensamientos", autor: "Marco Aurelio", paginas: 150, genero: "filosofia", estado: "terminado", fechaRegistro: "2026-07-01", fechaFin: "2026-07-10" })
];
const FRASES = [
  { id: "f1", libroId: "a", texto: "Cada acción es un voto.", fecha: "2026-10-05", fav: true },
  { id: "f2", libroId: "h", texto: "La concentración es un superpoder.", fecha: "2026-11-01" },
  { id: "f3", libroId: "e", texto: "Andábamos sin buscarnos.", fecha: "2025-05-01", fav: true }
];

test("días leídos: páginas, % del audiolibro y minutos; nivel según tu meta", () => {
  const d = E.porDia(LIBROS);
  assert.deepEqual(d["2026-10-02"], { paginas: 40, pct: 0, min: 60 });
  assert.deepEqual(d["2026-11-10"], { paginas: 0, pct: 10, min: 0 }, "el audiolibro avanzó 10 %");
  assert.deepEqual(d["2026-11-12"], { paginas: 0, pct: 15, min: 45 });
  assert.deepEqual(d["2026-06-05"], { paginas: 0, pct: 0, min: 120 }, "una sesión sin páginas anotadas igual cuenta");
  assert.deepEqual(d["2026-03-20"], { paginas: 100, pct: 0, min: 0 }, "la lectura anterior (releído) también");
  // Meta de 20 páginas; a 46,5 págs/hora son 26 minutos.
  assert.deepEqual([E.nivel(d["2026-10-02"], 20, 46.5), E.nivel(d["2026-11-10"], 20, 46.5), E.nivel(d["2026-11-12"], 20, 46.5)], [4, 1, 3]);
  assert.deepEqual([E.nivel({ paginas: 10, pct: 0, min: 0 }, 20), E.nivel({ paginas: 5, pct: 0, min: 0 }, 20), E.nivel({ paginas: 0, pct: 0, min: 15 }, 20, null), E.nivel(null, 20)], [2, 1, 2, 0], "sin velocidad, 30 min = la meta");
});

test("calendario del mes: semanas de lunes a domingo, días leídos y lo que falta", () => {
  const c = E.calendario(LIBROS, "2026-11", HOY, 20);
  assert.equal(c.titulo, "noviembre 2026");
  assert.equal(c.semanas.length, 6);
  assert.deepEqual(c.semanas[0].slice(0, 6), [null, null, null, null, null, null], "el 1 de noviembre de 2026 es domingo");
  assert.equal(c.semanas[0][6].dia, 1);
  assert.deepEqual([c.leidos, c.dias, c.paginas, c.min], [5, 15, 120, 175], "5 de 15 días (hasta hoy), 120 páginas, 175 minutos");
  const d16 = c.semanas[3][0], d15 = c.semanas[2][6];
  assert.deepEqual([d15.fecha, d15.hoy, d15.nivel > 0, d16.fecha, d16.futuro, d16.nivel], ["2026-11-15", true, true, "2026-11-16", true, 0]);
  assert.deepEqual([c.anterior, c.siguiente], ["2026-10", null], "no se pasa al mes que viene");
  const oct = E.calendario(LIBROS, "2026-10", HOY, 20);
  assert.deepEqual([oct.leidos, oct.dias, oct.siguiente, oct.semanas[0].findIndex(Boolean)], [5, 31, "2026-11", 3], "el 1 de octubre es jueves");
});

test("tiempo leyendo: año, mes, 30 días, sesiones, la más larga, 12 semanas y lo estimado", () => {
  const t = E.tiempo(LIBROS, HOY);
  assert.deepEqual([t.total, t.anio, t.mes, t.ult30, t.sesiones, t.promedioSesion], [535, 535, 175, 175, 9, 59]);
  assert.deepEqual(t.larga, { min: 120, titulo: "El poder del hábito", fecha: "2026-06-05" });
  assert.equal(t.semanas.length, 12);
  assert.deepEqual(t.semanas.slice(-3), [{ desde: "2026-10-26", min: 40 }, { desde: "2026-11-02", min: 0 }, { desde: "2026-11-09", min: 135 }]);
  // 520 páginas anotadas sin cronómetro a 46,5 págs/hora ≈ 671 minutos.
  assert.equal(t.estimadoAnio, 671);
  assert.deepEqual(E.tiempo([], HOY).promedioSesion, null);
});

test("velocidad por mes y su tendencia (3 meses contra los 3 anteriores)", () => {
  const v = E.velocidad(LIBROS, HOY);
  assert.equal(v.porHora, 46.5);
  assert.deepEqual(v.meses.map(m => [m.nombre, m.porHora]), [["junio", 30], ["julio", null], ["agosto", null], ["septiembre", 60], ["octubre", 40], ["noviembre", 55.4]]);
  assert.deepEqual(v.tendencia, { cambio: 73, sentido: "sube", ahora: 51.9, antes: 30 });
  const solo = E.velocidad(LIBROS.filter(l => l.id === "h"), HOY);
  assert.equal(solo.tendencia, null, "sin 30 minutos antes no hay tendencia");
  assert.equal(E.velocidad([], HOY).porHora, null);
});

test("autores y géneros de los libros terminados (un releído cuenta una vez)", () => {
  assert.deepEqual(E.autores(LIBROS, 2026).map(a => [a.nombre, a.libros, a.paginas]), [["Marco Aurelio", 2, 550], ["Charles Duhigg", 1, 400], ["James Clear", 1, 320], ["Viktor Frankl", 1, 160]],
    "Meditaciones (releído) cuenta un libro, con las páginas de las dos veces");
  assert.deepEqual(E.generos(LIBROS, 2026).map(g => [g.nombre, g.libros]), [["desarrollo", 2], ["filosofia", 2], ["psicologia", 1]], "empate: más páginas primero");
  assert.equal(E.autores(LIBROS).length, 5, "de siempre: también Cortázar (2025)");
  assert.deepEqual(E.delDia(LIBROS, "2026-11-12"), [{ id: "d", titulo: "Sapiens", paginas: 0, pct: 15, min: 45 }]);
  assert.deepEqual(E.delDia(LIBROS, "2026-11-13"), []);
});

test("Tu año en libros", () => {
  const a = E.anio(LIBROS, FRASES, 2026);
  assert.deepEqual([a.hayDatos, a.terminados, a.paginas, a.minutos, a.diasLeidos, a.mejorRacha], [true, 6, 1550, 535, 16, 3]);
  assert.deepEqual(a.libros.map(x => x.titulo), ["Meditaciones", "El poder del hábito", "Pensamientos", "Meditaciones", "Hábitos atómicos", "El hombre en busca de sentido"], "en el orden en que los terminaste");
  assert.deepEqual([a.masLargo.titulo, a.masCorto.titulo, a.masRapido.titulo, a.masRapido.dias], ["El poder del hábito", "Pensamientos", "El hombre en busca de sentido", 4]);
  assert.deepEqual(a.mejores.map(x => x.titulo), ["Meditaciones", "Hábitos atómicos"], "5 estrellas, el releído una vez");
  assert.deepEqual([a.mesTop.nombre, a.mesTop.libros, a.autorTop.nombre, a.autorTop.libros, a.generoTop.nombre], ["octubre", 2, "Marco Aurelio", 2, "desarrollo"]);
  assert.deepEqual([a.audiolibros, a.relecturas, a.abandonados, a.frases, a.fraseFav.texto], [0, 1, 1, 2, "Cada acción es un voto."]);
  assert.deepEqual(a.anterior, { anio: 2025, terminados: 1 });
  const vacio = E.anio(LIBROS, FRASES, 2024);
  assert.deepEqual([vacio.hayDatos, vacio.terminados, vacio.mesTop, vacio.autorTop, vacio.anterior], [false, 0, null, null, null]);
});

test("cuándo aparece el resumen del año y qué años hay", () => {
  assert.deepEqual(["2026-12-14", "2026-12-15", "2026-12-31", "2027-01-10", "2027-01-31", "2027-02-01", HOY].map(E.anioParaMostrar), [null, 2026, 2026, 2026, 2026, null, null]);
  assert.deepEqual(E.aniosConLibros(LIBROS), [2025, 2026]);
  assert.deepEqual([E.duracion(45), E.duracion(60), E.duracion(135), E.duracion(0)], ["45 min", "1 h", "2 h 15 min", "0 min"]);
  assert.deepEqual([E.mesMas("2026-11", 2), E.mesMas("2026-01", -1), E.nombreMes("2026-03")], ["2027-01", "2025-12", "marzo 2026"]);
});
