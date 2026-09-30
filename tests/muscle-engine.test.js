const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/muscle-engine.js");

const PRESS_INCLINADO = { id: "press-inc", nombre: "Press inclinado", tipo: "carga", primarios: ["pecho_superior"], secundarios: ["triceps", "deltoide_anterior"], factorPesoCorporal: 0 };
const SENTADILLA = { id: "sentadilla", nombre: "Sentadilla", tipo: "carga", primarios: ["cuadriceps"], secundarios: ["gluteos", "isquiotibiales"], factorPesoCorporal: 0 };
const FLEXIONES = { id: "flexiones", nombre: "Flexiones", tipo: "peso_corporal", primarios: ["pecho_medio"], secundarios: ["triceps"], factorPesoCorporal: 0.64 };
const DOMINADAS = { id: "dominadas", nombre: "Dominadas", tipo: "peso_corporal", primarios: ["dorsales"], secundarios: ["biceps"], factorPesoCorporal: 1 };
const CORRER = { id: E.ID_CORRER, nombre: "Correr", tipo: "cardio", primarios: ["cuadriceps", "pantorrillas"], secundarios: ["gluteos"], factorPesoCorporal: 0 };
const PLANCHA = { id: "plancha", nombre: "Plancha", tipo: "isometrico", primarios: ["abdominales"], secundarios: ["oblicuos"], factorPesoCorporal: 0 };

const series = (n, kg, reps, extra) => Array.from({ length: n }, () => Object.assign({ kg, reps }, extra));
const entrada = (ejercicio, s, extra) => Object.assign({ fecha: "2026-09-29", sesionId: "w1", ejercicio, series: s }, extra);
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test("volumen de carga = series × reps × kg", () => {
  const c = E.cargaEjercicio(entrada(PRESS_INCLINADO, series(4, 60, 10)));
  assert.equal(c.volumen, 2400);
  assert.equal(c.series, 4);
});

test("series vacías no cuentan", () => {
  const c = E.cargaEjercicio(entrada(PRESS_INCLINADO, [{ kg: 60, reps: 10 }, { kg: "", reps: "" }, { kg: 50, reps: 0 }]));
  assert.equal(c.series, 1);
  assert.equal(c.volumen, 600);
});

test("peso corporal: peso × factor (+ lastre) × reps", () => {
  const cfg = { pesoCorporal: 80 };
  cerca(E.cargaEjercicio(entrada(FLEXIONES, series(3, 0, 10)), E.config(cfg)).volumen, 80 * 0.64 * 10 * 3);
  cerca(E.cargaEjercicio(entrada(DOMINADAS, series(2, 0, 8, { lastre: 10 })), E.config(cfg)).volumen, (80 + 10) * 8 * 2);
  // En el formulario el lastre se anota en la columna de kg.
  cerca(E.cargaEjercicio(entrada(DOMINADAS, series(2, 10, 8)), E.config(cfg)).volumen, (80 + 10) * 8 * 2);
});

test("calentamiento no cuenta; la asistencia resta en peso corporal", () => {
  const c = E.cargaEjercicio(entrada(PRESS_INCLINADO, [{ kg: 40, reps: 10, calentamiento: true }, { kg: 60, reps: 10 }]));
  assert.equal(c.series, 1);
  assert.equal(c.volumen, 600);
  cerca(E.cargaEjercicio(entrada(DOMINADAS, [{ asistencia: 20, reps: 8 }]), E.config({ pesoCorporal: 80 })).volumen, (80 - 20) * 8);
});

test("cardio: minutos × RPE × constante; 1 serie efectiva cada 10 min", () => {
  const c = E.cargaEjercicio(entrada(CORRER, [], { minutos: 30, rpe: 7 }));
  assert.equal(c.volumen, 30 * 7 * 10);
  assert.equal(c.series, 3);
  // Sin RPE usa el valor por defecto (6).
  assert.equal(E.cargaEjercicio(entrada(CORRER, [], { minutos: 30 })).volumen, 30 * 6 * 10);
});

test("isométrico: cada serie = (segundos/60) × RPE × constante", () => {
  const c = E.cargaEjercicio(entrada(PLANCHA, series(3, 0, 0, { seg: 60 }), { rpe: 5 }));
  assert.equal(c.series, 3);
  cerca(c.volumen, 3 * 1 * 5 * 10);
});

test("por músculo: primarios 100 % / 1 serie, secundarios 50 % / 0,5", () => {
  const m = E.calcularMusculos([entrada(PRESS_INCLINADO, series(4, 60, 10))]);
  assert.equal(m.pecho_superior.volumen, 2400);
  assert.equal(m.pecho_superior.series, 4);
  assert.equal(m.pecho_superior.soloSecundario, false);
  assert.equal(m.pecho_superior.nivel, 2);
  assert.equal(m.triceps.volumen, 1200);
  assert.equal(m.triceps.series, 2);
  assert.equal(m.triceps.soloSecundario, true);
  assert.equal(m.triceps.nivel, 1);
  assert.equal(m.deltoide_anterior.soloSecundario, true);
  assert.equal(m.pecho_medio, undefined);
});

test("constantes configurables", () => {
  const m = E.calcularMusculos([entrada(PRESS_INCLINADO, series(4, 60, 10))], { pesoSecundario: 0.3, serieSecundaria: 0.25, umbrales: [2, 3] });
  cerca(m.triceps.volumen, 720);
  assert.equal(m.triceps.series, 1);
  assert.equal(m.pecho_superior.nivel, 3);
});

test("niveles: 0 · 1–3 · 4–9 · 10+", () => {
  assert.deepEqual([0, 0.5, 3, 3.5, 4, 9.5, 10, 25].map(s => E.nivel(s)), [0, 1, 1, 1, 2, 2, 3, 3]);
});

test("días trabajados, RPE promedio y ejercicios del músculo", () => {
  const m = E.calcularMusculos([
    entrada(PRESS_INCLINADO, series(3, 60, 10), { fecha: "2026-09-28", rpe: 8 }),
    entrada(FLEXIONES, series(2, 0, 15), { fecha: "2026-09-30", rpe: 6 })
  ]);
  assert.deepEqual(m.triceps.dias, ["2026-09-28", "2026-09-30"]);
  assert.equal(m.triceps.rpe, 7);
  // Ordenados por volumen: press 1800 × 50 % = 900; flexiones 70 × 0,64 × 30 × 50 % = 672.
  assert.deepEqual(m.triceps.ejercicios.map(e => [e.id, e.rol]), [["press-inc", "secundario"], ["flexiones", "secundario"]]);
  assert.deepEqual(m.pecho_medio.ejercicios.map(e => [e.id, e.rol]), [["flexiones", "primario"]]);
});

test("radar: cada ejercicio suma una sola vez por grupo (no infla Piernas)", () => {
  const g = E.calcularGrupos([entrada(SENTADILLA, series(3, 100, 10))]);
  assert.equal(g.piernas.volumen, 3000);
  assert.equal(g.piernas.series, 3);
  assert.equal(g.pecho.volumen, 0);
});

test("radar: un grupo que solo es secundario recibe 50 %", () => {
  const g = E.calcularGrupos([entrada(PRESS_INCLINADO, series(4, 60, 10))]);
  assert.equal(g.pecho.volumen, 2400);
  assert.equal(g.brazos.volumen, 1200);
  assert.equal(g.hombros.volumen, 1200);
  assert.equal(g.brazos.series, 2);
  assert.deepEqual(Object.keys(g), ["espalda", "pecho", "core", "hombros", "brazos", "piernas"]);
});

test("desdeRegistros: gimnasio + running + bici, y nombres no reconocidos", () => {
  const fichas = { "press inclinado": PRESS_INCLINADO, [E.ID_CORRER]: CORRER };
  const resolver = (nombre, id) => fichas[id] || fichas[(nombre || "").toLowerCase()] || null;
  const datos = E.desdeRegistros({
    gimnasio: [
      { id: "w1", date: "2026-09-29", durationMin: 50, exercises: [
        { name: "Press inclinado", sets: series(4, 60, 10) },
        { name: "Ejercicio raro", sets: series(2, 10, 10) },
        { name: "Ejercicio raro", sets: series(1, 10, 10) }
      ] },
      { id: "w0", date: "2026-09-20", durationMin: 40, exercises: [{ name: "Press inclinado", sets: series(1, 50, 10) }] }
    ],
    running: [{ id: "r1", date: "2026-09-30", distance: 5, duration: 30, rpe: 7 }],
    bicicleta: [{ id: "b1", date: "2026-09-30", distance: 20, duration: 60 }]
  }, resolver);

  assert.equal(datos.sesiones.length, 4);
  assert.equal(datos.entradas.length, 3); // bici sin ficha en este resolver
  assert.deepEqual(datos.noReconocidos, [{ nombre: "Ejercicio raro", veces: 2 }]);

  const semana = E.filtrar(datos, "2026-09-28", "2026-10-04");
  assert.equal(semana.sesiones.length, 3);
  const r = E.resumen(semana.sesiones, semana.entradas);
  assert.equal(r.entrenamientos, 3);
  assert.equal(r.duracion, 50 + 30 + 60);
  assert.equal(r.volumen, 2400 + 30 * 7 * 10);
  assert.equal(r.series, 4 + 3);
});

test("top de ejercicios por volumen", () => {
  const top = E.topEjercicios([
    entrada(SENTADILLA, series(3, 100, 10)),
    entrada(PRESS_INCLINADO, series(4, 60, 10)),
    entrada(PRESS_INCLINADO, series(1, 60, 10))
  ], null, 5);
  assert.deepEqual(top.map(t => [t.id, t.volumen, t.veces]), [["press-inc", 3000, 2], ["sentadilla", 3000, 1]]);
  const cardio = E.topEjercicios([entrada(CORRER, [], { minutos: 30, rpe: 7 }), entrada(CORRER, [], { minutos: 20, rpe: 7 })]);
  assert.equal(cardio[0].minutos, 50);
  assert.equal(cardio[0].tipo, "cardio");
});

test("cambio vs semana anterior", () => {
  assert.deepEqual(E.cambio(120, 100), { delta: 20, pct: 0.2 });
  assert.deepEqual(E.cambio(5, 0), { delta: 5, pct: null });
});

test("las 22 regiones se agrupan en 6 grupos", () => {
  assert.equal(E.MUSCULOS.length, 22);
  const porGrupo = {};
  E.MUSCULOS.forEach(m => { porGrupo[m.grupo] = (porGrupo[m.grupo] || 0) + 1; });
  assert.deepEqual(porGrupo, { pecho: 3, espalda: 5, hombros: 3, brazos: 3, core: 2, piernas: 6 });
});
