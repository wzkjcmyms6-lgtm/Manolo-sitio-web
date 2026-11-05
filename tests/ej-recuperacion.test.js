// Recuperación por músculo, "¿Qué entreno hoy?" y carga de la semana
// (js/ej-recuperacion.js, D-096).
const test = require("node:test");
const assert = require("node:assert/strict");
const RC = require("../js/ej-recuperacion.js");
const DATA = require("../data/ejercicios.json");
const F = id => DATA.ejercicios.find(e => e.id === id);
const fichaDe = x => F(x.exerciseId);

const H = 3600000;
const T0 = new Date(2026, 10, 4, 19, 0).getTime(); // miércoles 4 nov, 19:00
const serie = (kg, reps, extra) => Object.assign({ kg, reps }, extra);
const entreno = (date, ejercicios, extra) => Object.assign({
  date, startedAt: new Date(`${date}T18:00:00`).getTime(), durationMin: 60,
  exercises: ejercicios.map(([id, n, s]) => ({ exerciseId: id, name: F(id).nombre, sets: Array(n).fill(s || serie(100, 8)) }))
}, extra);

test("fatiga: 9 series de sentadilla → cansado al día siguiente, recuperándose a las 48 h, listo a las 72 h", () => {
  const w = entreno("2026-11-04", [["barbell-squat", 9]]);
  const en = h => RC.fatiga({ ahora: T0 + h * H, entrenos: [w], fichaDe }).zonas;
  assert.equal(en(20).cuadriceps.estado, "cansado");
  assert.equal(en(44).cuadriceps.estado, "recuperando");
  assert.equal(en(72).cuadriceps.estado, "listo");
  // Los que ayudan suman la mitad: glúteos recuperándose al día siguiente.
  assert.equal(en(20).gluteos.estado, "recuperando");
  // Cuándo estará listo: τ × ln(valor / 1,5).
  const z = en(20).cuadriceps;
  assert.equal(z.listoEnH, Math.ceil(30 * Math.log(z.valor / 1.5)));
  // Pocas series: solo recuperándose.
  const poco = RC.fatiga({ ahora: T0 + 20 * H, entrenos: [entreno("2026-11-04", [["barbell-squat", 4]])], fichaDe }).zonas;
  assert.equal(poco.cuadriceps.estado, "recuperando");
  // Sin datos: nada.
  assert.deepEqual(RC.fatiga({ ahora: T0, entrenos: [], fichaDe }).zonas, {});
});

test("fatiga: el esfuerzo pesa (RIR) y los calentamientos no cuentan", () => {
  const duro = entreno("2026-11-04", [["barbell-squat", 4, serie(100, 8, { rir: 0 })]]);
  const suave = entreno("2026-11-04", [["barbell-squat", 4, serie(100, 8, { rir: 4 })]]);
  const v = w => RC.fatiga({ ahora: T0 + 10 * H, entrenos: [w], fichaDe }).zonas.cuadriceps.valor;
  assert.ok(v(duro) > v(suave) * 1.3);
  const cal = entreno("2026-11-04", [["barbell-squat", 4, serie(60, 8, { calentamiento: true })]]);
  assert.equal(RC.fatiga({ ahora: T0 + 10 * H, entrenos: [cal], fichaDe }).zonas.cuadriceps, undefined);
});

test("fatiga: correr carga las piernas según la carga de la carrera", () => {
  const larga = { date: "2026-11-04", distance: 18, duration: 108, rpe: 8 };   // carga 180
  const suave = { date: "2026-11-04", distance: 6, duration: 36, rpe: 4 };     // carga 30
  // Sin hora de inicio cuenta desde el mediodía de ese día: 24 h después.
  const z = c => RC.fatiga({ ahora: new Date(2026, 10, 5, 12).getTime(), entrenos: [], carreras: [c], fichaDe }).zonas;
  assert.equal(z(larga).cuadriceps.estado, "cansado");
  assert.equal(z(larga).pantorrillas.estado, "recuperando", "músculo chico: se recupera antes");
  assert.equal(z(larga).pecho_medio, undefined);
  assert.equal(z(suave).cuadriceps.estado, "listo");
  assert.equal(RC.cargaActividad(larga), 180);
  assert.equal(RC.cargaActividad({ carga: { v: 95 }, rpe: 9, duration: 200 }), 95);
});

test("carreras: larga o dura ayer, y si mañana sueles correr", () => {
  const hoy = "2026-11-05"; // jueves
  assert.equal(RC.carreraReciente([{ date: "2026-11-04", distance: 18, duration: 108, rpe: 8 }], hoy).texto, "Ayer corriste 18 km");
  assert.equal(RC.carreraReciente([{ date: "2026-11-05", distance: 10, duration: 70, rpe: 8 }], hoy).texto, "Hoy ya corriste 10 km");
  assert.equal(RC.carreraReciente([{ date: "2026-11-04", distance: 6, duration: 36, rpe: 4 }], hoy), null);
  assert.equal(RC.carreraReciente([{ date: "2026-11-02", distance: 20, duration: 120, rpe: 8 }], hoy), null);
  // Viernes: los últimos 4 viernes corrió 14 km.
  const viernes = ["2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"].map(date => ({ date, distance: 14, duration: 84, rpe: 7 }));
  const h = RC.habitoManana(viernes, hoy);
  assert.deepEqual([h.dia, h.km, h.dura], ["viernes", 14, true]);
  assert.equal(RC.habitoManana(viernes.slice(0, 2), hoy), null, "con 2 viernes no es costumbre");
  assert.equal(RC.habitoManana(viernes, "2026-11-04"), null, "mañana jueves: no");
  assert.equal(RC.habitoManana(viernes.map(d => Object.assign({}, d, { distance: 5, duration: 30, rpe: 4 })), hoy).dura, false);
});

// Rutinas como las arma la pantalla: zonas y músculos por rutina.
const P = require("../js/ej-programa.js");
const rutina = (id, name, items) => {
  const its = items.map(([ex, series]) => ({ nombre: F(ex).nombre, exerciseId: ex, series, repsMin: 8, repsMax: 12 }));
  return { id, name, items: its, zonas: RC.zonasDeRutina(its, fichaDe),
    musculos: P.seriesPorMusculo(its.map(it => ({ ejercicio: F(it.exerciseId), series: Array(it.series).fill({ reps: 1 }) }))) };
};
const RUTS = [
  rutina("pierna", "Pierna", [["barbell-squat", 4], ["barbell-deadlift", 3], ["leg-extensions", 3]]),
  rutina("empuje", "Empuje", [["barbell-bench-press-medium-grip", 4], ["dumbbell-flyes", 3]]),
  rutina("tiron", "Tirón", [["pullups", 4], ["bent-over-barbell-row", 3]])
];
const PLAN = { dias: { "4": "pierna", "1": "empuje", "2": "tiron" } }; // jueves pierna
const NOMBRES = { pecho: "Pecho", espalda: "Espalda" };
const sinFatiga = { zonas: {} };

test("¿Qué entreno hoy?: la del plan, con el porqué", () => {
  const r = RC.recomendar({ hoy: "2026-11-05", fat: sinFatiga, plan: PLAN, rutinas: RUTS, carreras: [] });
  assert.equal(r.tipo, "plan");
  assert.equal(r.rutina.id, "pierna");
  assert.match(r.razones[0], /^Músculos listos: cuádriceps, (isquios|glúteos) y (isquios|glúteos)\.$/);
  assert.equal(r.manana, null);
  assert.equal(RC.recomendar({ hoy: "2026-11-05", fat: sinFatiga, plan: PLAN, rutinas: [] }), null);
});

test("¿Qué entreno hoy?: tras una carrera larga, otra rutina que complete la semana", () => {
  const carreras = [{ date: "2026-11-04", distance: 18, duration: 108, rpe: 8 }];
  const fat = RC.fatiga({ ahora: new Date(2026, 10, 5, 18).getTime(), entrenos: [], carreras, fichaDe });
  const r = RC.recomendar({ hoy: "2026-11-05", fat, plan: PLAN, rutinas: RUTS, carreras, faltan: { espalda: 6 }, nombres: NOMBRES });
  assert.equal(r.tipo, "cambio");
  assert.equal(r.plan.id, "pierna");
  assert.equal(r.rutina.id, "tiron", "la que completa lo que falta");
  assert.equal(r.razones[0], "Ayer corriste 18 km: tus piernas necesitan recuperarse.");
  assert.match(r.razones[1], /^Músculos listos: espalda/);
  assert.equal(r.razones[2], "Te completa lo que falta de espalda esta semana.");
});

test("¿Qué entreno hoy?: músculos cansados, mañana carrera larga, todo cansado, descanso y hecho", () => {
  // Ayer pecho muy duro: hoy (plan Empuje, lunes) mejor otra.
  const ayer = entreno("2026-11-01", [["barbell-bench-press-medium-grip", 10, serie(80, 8, { rir: 0 })], ["dumbbell-flyes", 6]]);
  const fat = RC.fatiga({ ahora: new Date(2026, 10, 2, 9).getTime(), entrenos: [ayer], fichaDe });
  const r = RC.recomendar({ hoy: "2026-11-02", fat, plan: { dias: { "1": "empuje" } }, rutinas: RUTS, carreras: [] });
  assert.equal(r.tipo, "cambio");
  assert.notEqual(r.rutina.id, "empuje");
  assert.match(r.razones[0], /^Pecho.* todavía se recupera/);
  // Mañana (viernes) suele correr largo: jueves sin pierna pesada.
  const viernes = ["2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"].map(date => ({ date, distance: 16, duration: 96, rpe: 7 }));
  const m = RC.recomendar({ hoy: "2026-11-05", fat: sinFatiga, plan: PLAN, rutinas: RUTS, carreras: viernes });
  assert.equal(m.tipo, "cambio");
  assert.equal(m.manana, "Mañana (viernes) sueles correr 16 km: hoy mejor sin pierna pesada.");
  // Todo cansado → Movilidad.
  const todo = { zonas: {} };
  ["cuadriceps", "gluteos", "isquiotibiales", "lumbares", "pecho_medio", "dorsales", "espalda_media", "triceps", "biceps", "deltoide_anterior"].forEach(z => { todo.zonas[z] = { valor: 5, estado: "cansado", listoEnH: 20 }; });
  assert.equal(RC.recomendar({ hoy: "2026-11-05", fat: todo, plan: PLAN, rutinas: RUTS, carreras: [] }).tipo, "movilidad");
  // Sin rutina hoy y nada atrasado → descanso; con algo atrasado → extra.
  assert.equal(RC.recomendar({ hoy: "2026-11-06", fat: sinFatiga, plan: PLAN, rutinas: RUTS, carreras: [] }).tipo, "descanso");
  const extra = RC.recomendar({ hoy: "2026-11-06", fat: sinFatiga, plan: PLAN, rutinas: RUTS, carreras: [], faltan: { pecho: 5 }, nombres: NOMBRES });
  assert.deepEqual([extra.tipo, extra.rutina.id], ["extra", "empuje"]);
  // Ya entrenó hoy.
  assert.equal(RC.recomendar({ hoy: "2026-11-05", fat: sinFatiga, plan: PLAN, rutinas: RUTS, hechoHoy: true }).tipo, "hecho");
});

test("carga de la semana: gimnasio + Running en la misma escala", () => {
  assert.deepEqual(RC.cargaEntreno({ rpeSesion: 8, durationMin: 60 }), { carga: 100, estimada: false });
  assert.deepEqual(RC.cargaEntreno({ durationMin: 48, exercises: [{ sets: [serie(100, 5, { rir: 2 }), serie(100, 5, { rir: 2 })] }] }), { carga: 80, estimada: true });
  assert.equal(RC.cargaEntreno({ durationMin: 48, exercises: [] }).carga, 70, "sin esfuerzo: 7");
  const c = RC.cargaSemana({
    hoy: "2026-11-05",
    entrenos: [{ date: "2026-11-02", rpeSesion: 8, durationMin: 60 }, { date: "2026-10-27", rpeSesion: 8, durationMin: 120 }],
    carreras: [{ date: "2026-11-04", distance: 18, duration: 108, rpe: 8 }, { date: "2026-11-09", distance: 5, duration: 30, rpe: 5 }]
  });
  assert.deepEqual(c.dias.map(d => d.gym + d.run), [100, 0, 180, 0, 0, 0, 0]);
  assert.deepEqual([c.total, c.gym, c.run, c.estimada], [280, 100, 180, false]);
  assert.equal(c.promedio, 50, "4 semanas anteriores: 200 / 4");
});
