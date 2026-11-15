// "Leer ahora": cronómetro, sesiones y velocidad de lectura (js/libros-sesiones.js, D-107).
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/libros-sesiones.js");
const P = require("../js/libros-progreso.js");
const L = require("../js/libros-motor.js");

const HOY = "2026-11-06";
const T0 = Date.parse("2026-11-06T07:00:00-04:00");
const MIN = 60000;
const libro = (id, d) => L.normalizarLibro(id, Object.assign({ v: 1, titulo: id, autor: "", estado: "leyendo", fechaRegistro: "2026-10-01", creado: 1 }, d));

test("cronómetro por marcas de tiempo: pausa, seguir y bloqueo del teléfono", () => {
  const l = libro("a", { paginas: 328, paginaActual: 142 });
  let st = S.iniciar(l, T0, "u1");
  assert.deepEqual(st, { v: 1, libroId: "a", uid: "u1", ini: T0, acumulado: 0, corre: T0, desde: 142, unidad: "pag" });
  assert.equal(S.valido(st), true);
  assert.equal(S.reloj(S.transcurrido(st, T0 + 12 * MIN + 34000)), "12:34", "con el teléfono bloqueado el tiempo sigue");
  st = S.pausar(st, T0 + 20 * MIN);
  assert.equal(S.enPausa(st), true);
  assert.equal(S.transcurrido(st, T0 + 50 * MIN), 20 * MIN, "en pausa no cuenta");
  st = S.seguir(st, T0 + 50 * MIN);
  assert.equal(S.transcurrido(st, T0 + 71 * MIN), 41 * MIN);
  assert.equal(S.reloj(3725000), "1:02:05");
  assert.equal(S.minutosDe(20000), 1, "al menos 1 minuto");
  assert.equal(S.valido({ v: 1, libroId: "a", ini: "x" }), false);
  assert.equal(S.iniciar(libro("au", { formato: "audio", pctActual: 30 }), T0).unidad, "pct");
});

test("terminar: la sesión con sus minutos y el avance", () => {
  const l = libro("a", { paginas: 328, paginaActual: 142 });
  const st = S.iniciar(l, T0, "u1");
  const c = S.cerrar(st, l, "41", 165, T0 + 41 * MIN, HOY);
  assert.deepEqual(c, { ok: true, id: `s${T0.toString(36)}`, sesion: { fecha: HOY, ini: T0, fin: T0 + 41 * MIN, min: 41, desde: 142, hasta: 165, unidad: "pag", lectura: 1 } });
  assert.equal(S.cerrar(st, l, "0", 165, T0, HOY).campo, "minutos");
  assert.equal(S.cerrar(st, l, "800", 165, T0, HOY).ok, false, "más de 12 horas, no");
  assert.equal(S.cerrar(st, l, "12,5", 150, T0, HOY).sesion.min, 12.5);
});

test("velocidad, tiempo que falta y minutos por día", () => {
  const l = libro("a", { paginas: 328, paginaActual: 186, fechaInicio: "2026-10-20", paginaBase: 100, progreso: { "2026-11-04": 165, [HOY]: 186 }, sesiones: {
    s1: { fecha: "2026-11-04", ini: 1, min: 41, desde: 142, hasta: 165, unidad: "pag" },
    s2: { fecha: HOY, ini: 2, min: 39, desde: 165, hasta: 186, unidad: "pag" },
    s3: { fecha: HOY, ini: 3, min: 10, desde: 186, hasta: 186, unidad: "pag" },
    malo: { fecha: "ayer", min: 5 }
  } });
  const ses = S.sesionesDe(l);
  assert.deepEqual(ses.map(x => [x.id, x.avance]), [["s1", 23], ["s2", 21], ["s3", 0]], "ignora lo inválido");
  assert.deepEqual(S.velocidad(ses, "pag"), { porHora: 33, min: 80, avance: 44, n: 2 }, "44 páginas en 80 minutos (sin la sesión sin avance)");
  const d = S.delLibro(l, HOY);
  assert.deepEqual([d.n, d.minutos, d.velocidad, d.faltaMin], [3, 90, 33, 258], "faltan 142 páginas: 4 h 18 min a 33 pág./hora");
  assert.equal(S.duracion(d.faltaMin), "4 h 18 min");
  assert.deepEqual([S.duracion(45), S.duracion(180), S.duracion(65)], ["45 min", "3 h", "1 h 05 min"]);
  assert.equal(S.textoVelocidad(33.5, "pag"), "33,5 pág./hora");
  assert.equal(S.velocidad([{ unidad: "pag", avance: 3, min: 2 }], "pag").porHora, null, "con menos de 5 minutos todavía no");
  const otro = libro("b", { sesiones: { x: { fecha: HOY, ini: 4, min: 20.5, desde: 10, hasta: 30, unidad: "pag" } } });
  assert.deepEqual(S.minutosPorDia([l, otro]), { "2026-11-04": 41, [HOY]: 69.5 });
  assert.deepEqual(S.general([l, otro]).porHora, 38.2, "en general: 64 páginas en 100,5 minutos (sin la sesión que no avanzó)");
  const h = S.porDiaHabitos([l, otro]);
  assert.deepEqual(h[HOY], { paginas: 21, min: 69.5 }, "Hábitos: páginas (de lo anotado) y minutos del día");
});

test("audiolibro: velocidad en % por hora", () => {
  const a = libro("au", { formato: "audio", duracionMin: 600, pctActual: 40, sesiones: { s: { fecha: HOY, ini: 1, min: 60, desde: 30, hasta: 40, unidad: "pct" } } });
  const d = S.delLibro(a, HOY);
  assert.deepEqual([d.unidad, d.velocidad, d.faltaMin], ["pct", 10, 360], "10 % por hora: faltan 6 horas");
  assert.equal(S.textoVelocidad(10, "pct"), "10 %/hora");
  assert.equal(P.paginasPorDia([a])[HOY], undefined);
});
