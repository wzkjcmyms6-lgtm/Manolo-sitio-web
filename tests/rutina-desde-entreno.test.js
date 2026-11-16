// Rutinas del gimnasio desde un entreno (js/rutina-desde-entreno.js, D-125).
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../js/rutina-desde-entreno.js");
const R = require("../js/rutinas.js");

const it = (nombre, extra) => R.item(Object.assign({ nombre }, extra || {}));
const serie = (kg, reps, extra) => Object.assign({ kg, reps }, extra || {});
const ej = (name, sets, extra) => Object.assign({ name, sets }, extra || {});

const PUSH = {
  id: "r1", name: "Push", orden: 0,
  items: [
    it("Press de banca (Barra)", { exerciseId: "bench", series: 3, repsMin: 8, repsMax: 10, peso: 60, descansoSeg: 120, notas: "Pausa abajo", incremento: 2.5 }),
    it("Aperturas con mancuernas", { exerciseId: "fly", series: 3, repsMin: 12, repsMax: 15, peso: 10 }),
    it("Fondos", { series: 3, repsMin: 8, repsMax: 12 })
  ]
};

test("sin cambios: nada que guardar", () => {
  const hoy = { exercises: [
    ej("Press de banca (Barra)", [serie(60, 8, { calentamiento: true }), serie(62.5, 8), serie(62.5, 8), serie(62.5, 7)], { exerciseId: "bench" }),
    ej("Aperturas con mancuernas", [serie(10, 12), serie(10, 12), serie(10, 12)], { exerciseId: "fly" }),
    ej("fondos", [serie(0, 10), serie(0, 9), serie(0, 8)])
  ] };
  assert.deepEqual(D.cambios(PUSH, hoy), [], "la serie de calentamiento no cuenta y el nombre se compara sin mayúsculas");
});

test("cambios: agregar, quitar, series y orden, cada uno con su texto", () => {
  const hoy = { exercises: [
    ej("Fondos", [serie(0, 10), serie(0, 10)]),
    ej("Press de banca (Barra)", [serie(62.5, 8), serie(62.5, 8), serie(62.5, 8), serie(62.5, 6)], { exerciseId: "bench" }),
    ej("Press militar", [serie(30, 10), serie(30, 9)], { exerciseId: "ohp" })
  ] };
  const cs = D.cambios(PUSH, hoy);
  assert.deepEqual(cs.map(c => c.id), ["agregar:2", "quitar:1", "series:2", "series:0", "orden"]);
  assert.deepEqual(cs.map(c => c.texto), [
    "Agregar Press militar",
    "Quitar Aperturas con mancuernas (hoy no lo hiciste)",
    "Fondos: 2 series (antes 3)",
    "Press de banca (Barra): 4 series (antes 3)",
    "El orden de hoy"
  ]);
});

test("aplicar todo: la rutina queda como el entreno, sin tocar pesos ni notas", () => {
  const hoy = { exercises: [
    ej("Press de banca (Barra)", [serie(62.5, 8), serie(62.5, 8), serie(62.5, 8), serie(62.5, 6)], { exerciseId: "bench" }),
    ej("Press militar", [serie(30, 10), serie(32.5, 8)], { exerciseId: "ohp" }),
    ej("Fondos", [serie(0, 10), serie(0, 10), serie(0, 9)])
  ] };
  const cs = D.cambios(PUSH, hoy);
  const r = D.aplicar(PUSH, hoy, cs.map(c => c.id));
  assert.deepEqual(r.items.map(x => x.nombre), ["Press de banca (Barra)", "Press militar", "Fondos"]);
  const banca = r.items[0];
  assert.deepEqual([banca.series, banca.repsMin, banca.repsMax, banca.peso, banca.descansoSeg, banca.notas, banca.incremento], [4, 8, 10, 60, 120, "Pausa abajo", 2.5], "solo cambian las series");
  const militar = r.items[1];
  assert.deepEqual([militar.series, militar.repsMin, militar.repsMax, militar.peso, militar.exerciseId], [2, 8, 10, 32.5, "ohp"], "lo nuevo toma lo de hoy");
  assert.equal(r.id, "r1");
  assert.equal(r.name, "Push");
  assert.equal(PUSH.items.length, 3, "la rutina original no se toca");
});

test("aplicar solo lo elegido", () => {
  const hoy = { exercises: [
    ej("Fondos", [serie(0, 10), serie(0, 10)]),
    ej("Press de banca (Barra)", [serie(62.5, 8), serie(62.5, 8), serie(62.5, 8), serie(62.5, 6)], { exerciseId: "bench" }),
    ej("Press militar", [serie(30, 10)], { exerciseId: "ohp" })
  ] };
  // Solo agregar el press militar (sin quitar, sin series, sin orden).
  const r1 = D.aplicar(PUSH, hoy, ["agregar:2"]);
  assert.deepEqual(r1.items.map(x => x.nombre), ["Press de banca (Barra)", "Press militar", "Aperturas con mancuernas", "Fondos"], "va después del que hiciste antes que él (banca)");
  assert.deepEqual(r1.items.map(x => x.series), [3, 1, 3, 3]);
  // Quitar las aperturas y el orden de hoy: fondos primero.
  const r2 = D.aplicar(PUSH, hoy, ["quitar:1", "orden"]);
  assert.deepEqual(r2.items.map(x => x.nombre), ["Fondos", "Press de banca (Barra)"]);
  // Orden de hoy, pero las aperturas (no hechas) se quedan: siguen pegadas a la banca.
  const r3 = D.aplicar(PUSH, hoy, ["orden"]);
  assert.deepEqual(r3.items.map(x => x.nombre), ["Fondos", "Press de banca (Barra)", "Aperturas con mancuernas"]);
  // Nada elegido: igual que antes.
  assert.deepEqual(D.aplicar(PUSH, hoy, []).items, PUSH.items);
});

test("lo agregado primero va al comienzo", () => {
  const hoy = { exercises: [ej("Remo", [serie(40, 10)]), ej("Press de banca (Barra)", [serie(60, 8), serie(60, 8), serie(60, 8)], { exerciseId: "bench" })] };
  const r = D.aplicar(PUSH, hoy, ["agregar:0"]);
  assert.equal(r.items[0].nombre, "Remo");
});

test("dos veces el mismo ejercicio en la rutina se emparejan en orden", () => {
  const rut = { items: [it("Sentadilla", { series: 3 }), it("Sentadilla", { series: 2, repsMin: 15, repsMax: 20 })] };
  const hoy = { exercises: [ej("Sentadilla", [serie(80, 5), serie(80, 5), serie(80, 5)]), ej("Sentadilla", [serie(50, 15), serie(50, 15)])] };
  assert.deepEqual(D.cambios(rut, hoy), []);
});

test("cardio e isométricos", () => {
  const rut = { items: [it("Cinta", { series: 1 }), it("Plancha", { series: 3 })] };
  const hoy = { exercises: [ej("Cinta", [], { minutos: 20 }), ej("Plancha", [{ seg: 45 }, { seg: 40 }])] };
  const cs = D.cambios(rut, hoy);
  assert.deepEqual(cs.map(c => c.id), ["series:1"], "el cardio no cuenta series; la plancha sí");
  assert.equal(D.seriesDe(ej("Cinta", [], { minutos: 20 })), 1);
  const x = D.itemDe(ej("Plancha", [{ seg: 45 }, { seg: 40 }]));
  assert.deepEqual([x.series, x.peso], [2, null]);
});

test("un entreno libre como rutina nueva", () => {
  const libre = { name: "Pierna", date: "2026-11-16", exercises: [
    ej("Sentadilla", [serie(60, 10, { calentamiento: true }), serie(100, 6), serie(100, 5), serie(95, 6)], { exerciseId: "squat", grupo: "A" }),
    ej("Zancadas", [serie(20, 12), serie(20, 12)]),
    ej("Bicicleta", [], { minutos: 10 })
  ] };
  const r = D.desdeEntreno(libre, ["Push"]);
  assert.equal(r.name, "Pierna");
  assert.deepEqual(r.items.map(x => [x.nombre, x.series, x.repsMin, x.repsMax, x.peso]), [
    ["Sentadilla", 3, 5, 6, 100],
    ["Zancadas", 2, 12, 12, 20],
    ["Bicicleta", 1, 8, 12, null]
  ]);
  assert.equal(r.items[0].exerciseId, "squat");
  assert.equal(r.items[0].grupo, "A");
  assert.equal(D.desdeEntreno(libre, ["pierna"]).name, "Pierna (copia)", "si ya hay una rutina con ese nombre");
  assert.equal(D.desdeEntreno(Object.assign({}, libre, { name: "Entrenamiento" }), []).name, "Entreno del 16 nov");
  assert.equal(D.desdeEntreno({ exercises: [] }, []).name, "Entreno de hoy", "sin fecha");
  // Lo que se guarda pasa por el formato de siempre.
  const g = R.aGuardar(Object.assign({ orden: 3 }, r));
  assert.deepEqual(g.exercises, ["Sentadilla", "Zancadas", "Bicicleta"]);
  assert.equal(g.v, 2);
});
