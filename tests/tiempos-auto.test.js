// Medir tiempos: se llena solo (js/tiempos-auto.js, D-113).
const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../js/tiempos-auto.js");

test("de cada sección, los segundos de cada día", () => {
  assert.deepEqual(U.porDia("running", [{ date: "2026-11-14", duration: 32.5 }, { date: "2026-11-14", duration: 10 }, { date: "2026-11-15", duration: 0 }, { date: "mal", duration: 30 }]), { "2026-11-14": 2550 });
  assert.deepEqual(U.porDia("gimnasio", [{ fecha: "2026-11-15", min: 55 }]), { "2026-11-15": 3300 });
  assert.deepEqual(U.porDia("movilidad", [{ fecha: "2026-11-15", duracionSeg: 600 }, { fecha: "2026-11-15", duracionSeg: 300 }]), { "2026-11-15": 900 });
  assert.deepEqual(U.porDia("libros", { "2026-11-14": 30, "2026-11-15": { paginas: 20, min: 35 } }), { "2026-11-15": 2100 }, "solo los minutos de «Leer ahora» (páginas sueltas no tienen tiempo)");
  assert.deepEqual(U.porDia("otra", [1, 2]), {});
});

test("llena solo, pero lo tuyo manda y lo que quitaste no vuelve", () => {
  const act = { id: "correr", fuente: "running", desde: "2026-11-10" };
  const agg = { "2026-11-08": 1800, "2026-11-11": 1900, "2026-11-12": 2000, "2026-11-13": 2100, "2026-11-14": 2200, "2026-11-16": 999 };
  const docs = {
    "2026-11-12": { seg: { correr: 1500 } },                                          // anotado a mano
    "2026-11-13": { seg: {}, noAuto: { correr: true } },                               // lo quitaste
    "2026-11-14": { seg: { correr: 2200 }, auto: { correr: { f: "running", s: 2200 } } }, // ya está igual
    "2026-11-09": { seg: { correr: 1000 }, auto: { correr: { f: "running", s: 1000 } } }  // antes de "desde": no se toca
  };
  const p = U.plan(act, agg, docs, { hoy: "2026-11-15" });
  assert.deepEqual(p, { poner: { "2026-11-11": 1900 }, quitar: [] }, "ni antes de desde ni días futuros");
});

test("si cambia o desaparece la carrera, el tiempo automático se corrige (solo con datos del servidor)", () => {
  const act = { id: "leer", fuente: "libros", desde: "2026-11-01" };
  const docs = {
    "2026-11-14": { seg: { leer: 1200 }, auto: { leer: { f: "libros", s: 1200 } } },
    "2026-11-15": { seg: { leer: 600, desayunar: 900 }, auto: { leer: { f: "libros", s: 600 } } }
  };
  assert.deepEqual(U.plan(act, { "2026-11-15": 900 }, docs, { hoy: "2026-11-15" }), { poner: { "2026-11-15": 900 }, quitar: ["2026-11-14"] });
  assert.deepEqual(U.plan(act, {}, docs, { hoy: "2026-11-15", servidor: false }), { poner: {}, quitar: [] }, "con la copia del teléfono no se quita nada");
  assert.deepEqual(U.plan({ id: "leer", fuente: "", desde: "2026-11-01" }, { "2026-11-15": 900 }, docs, { hoy: "2026-11-15" }), { poner: {}, quitar: [] }, "sin fuente, nada");
  assert.equal(U.deDonde(docs["2026-11-15"], "leer"), "Libros");
  assert.equal(U.deDonde(docs["2026-11-15"], "desayunar"), null);
});
