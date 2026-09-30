const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/progresion.js");

const item = { nombre: "Press", series: 3, repsMin: 8, repsMax: 12, incremento: null };
const w = (date, sets) => ({ date, exercises: [{ name: "Press", sets }] });
const mismo = e => e.name === "Press";
const s = (kg, reps, extra) => Object.assign({ kg, reps }, extra);

test("sin historial: primera vez", () => {
  assert.equal(P.sugerir(item, [], mismo, {}).tipo, "nuevo");
});

test("todas las series en el tope → sube 2,5 kg (superior) o 5 kg (inferior)", () => {
  const h = [w("2026-09-30", [s(20, 15, { calentamiento: true }), s(60, 12), s(60, 12), s(60, 12)])];
  const sup = P.sugerir(item, h, mismo, { inferior: false });
  assert.equal(sup.tipo, "subir");
  assert.equal(sup.kg, 62.5);
  assert.deepEqual(sup.reps, [8, 8, 8]);
  assert.equal(P.sugerir(item, h, mismo, { inferior: true }).kg, 65);
  // La subida elegida en la rutina manda.
  assert.equal(P.sugerir(Object.assign({}, item, { incremento: 1 }), h, mismo, {}).kg, 61);
});

test("no llegó al tope → mismo peso y +1 rep por serie sin pasar el tope", () => {
  const h = [w("2026-09-30", [s(60, 12), s(60, 10), s(60, 9)])];
  const r = P.sugerir(item, h, mismo, {});
  assert.equal(r.tipo, "repetir");
  assert.equal(r.kg, 60);
  assert.deepEqual(r.reps, [12, 11, 10]);
});

test("menos series que las de la rutina no cuenta como 'todas al tope'", () => {
  const h = [w("2026-09-30", [s(60, 12), s(60, 12)])];
  const r = P.sugerir(item, h, mismo, {});
  assert.equal(r.tipo, "repetir");
  assert.deepEqual(r.reps, [12, 12, 8]);
});

test("2 veces seguidas bajo el mínimo → baja ~10 %", () => {
  const h = [w("2026-09-30", [s(100, 7), s(100, 6), s(100, 5)]), w("2026-09-26", [s(100, 8), s(100, 7)])];
  const r = P.sugerir(item, h, mismo, {});
  assert.equal(r.tipo, "bajar");
  assert.equal(r.kg, 90);
  // Con una sola vez bajo el mínimo, todavía no baja.
  assert.equal(P.sugerir(item, [h[0], w("2026-09-26", [s(100, 9), s(100, 8), s(100, 8)])], mismo, {}).tipo, "repetir");
});

test("tren inferior según músculos; cardio, isométrico y asistidas no sugieren", () => {
  assert.equal(P.esTrenInferior({ primarios: ["cuadriceps", "gluteos"] }), true);
  assert.equal(P.esTrenInferior({ primarios: ["pecho_medio", "triceps"] }), false);
  assert.equal(P.sugerir(item, [], mismo, { tipo: "cardio" }), null);
  assert.equal(P.sugerir(item, [w("2026-09-30", [{ asistencia: 20, reps: 8 }])], mismo, {}), null);
});
