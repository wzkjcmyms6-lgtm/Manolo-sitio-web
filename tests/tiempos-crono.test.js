// Medir tiempos: cronómetro y "Mi mañana" (js/tiempos-crono.js, D-113).
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/tiempos-crono.js");

const T0 = Date.parse("2026-11-16T06:00:00-04:00");
const min = n => n * 60000;

test("cronómetro por marcas de tiempo: pausar, seguir, reloj y bloqueo", () => {
  let c = C.iniciar("leer", "2026-11-16", T0);
  assert.equal(C.segundos(c, T0 + min(5)), 300, "5 minutos");
  c = C.pausar(c, T0 + min(5));
  assert.ok(C.enPausa(c));
  assert.equal(C.segundos(c, T0 + min(20)), 300, "en pausa no corre");
  c = C.seguir(c, T0 + min(20));
  assert.equal(C.segundos(c, T0 + min(23)), 480, "sigue: 5 + 3 min");
  assert.equal(C.pausar(C.pausar(c, T0 + min(24)), T0 + min(30)).pausa, T0 + min(24), "pausar dos veces no cambia nada");
  assert.equal(C.segundos(c, T0 + min(23) + 13 * 3600 * 1000), 12 * 3600, "uno olvidado no pasa de 12 h");
  assert.deepEqual([C.reloj(65000), C.reloj(3725000), C.reloj(-5)], ["1:05", "1:02:05", "0:00"]);
  assert.ok(C.cronoValido(c, "2026-11-16", T0 + min(30)));
  assert.ok(!C.cronoValido(c, "2026-11-17", T0 + 13 * 3600 * 1000), "uno de ayer y viejo ya no vale");
  assert.ok(C.cronoValido(c, "2026-11-17", T0 + 6 * 3600 * 1000), "de ayer pero reciente (pasada la medianoche) vale");
  assert.ok(!C.cronoValido({ v: 1, id: "x", fecha: "mal", inicio: 1 }, "2026-11-16", T0) && !C.cronoValido(null, "2026-11-16", T0));
});

test("Mi mañana: siguiente, pausa, saltar y terminar", () => {
  let m = C.empezar(["manana", "correr", "desayunar", "banarse"], "2026-11-16", T0);
  assert.equal(C.actual(m), "manana");
  let r = C.siguiente(m, T0 + min(22));
  assert.deepEqual(r.cerrado, { id: "manana", seg: 1320 });
  m = r.m;
  assert.equal(C.actual(m), "correr");
  r = C.saltar(m, T0 + min(23));
  assert.equal(r.cerrado, null, "saltar no guarda");
  m = r.m;
  assert.equal(C.actual(m), "desayunar");
  m = C.pausarManana(m, T0 + min(30));
  m = C.seguirManana(m, T0 + min(35));
  r = C.siguiente(m, T0 + min(50));
  assert.deepEqual(r.cerrado, { id: "desayunar", seg: 1320 }, "27 min menos 5 en pausa");
  m = r.m;
  r = C.siguiente(m, T0 + min(68));
  assert.ok(C.terminada(r.m) && C.actual(r.m) === null);
  assert.deepEqual(r.m.hechos, { manana: 1320, desayunar: 1320, banarse: 1080 });
  assert.deepEqual(r.m.saltados, ["correr"]);
  assert.equal(C.siguiente(r.m, T0 + min(70)).cerrado, null, "ya terminada no hace nada");
  // Terminar antes: guarda el paso que va y salta el resto.
  const t = C.terminar(C.empezar(["a", "b", "c"], "2026-11-16", T0), T0 + min(10));
  assert.deepEqual([t.cerrado, t.m.saltados, C.terminada(t.m)], [{ id: "a", seg: 600 }, ["b", "c"], true]);
  assert.equal(C.empezar([], "2026-11-16", T0), null);
});

test("contra tu promedio: en vivo y el resumen del final", () => {
  const prom = { manana: 1500, desayunar: 900, banarse: 1000 };
  let m = C.empezar(["manana", "desayunar", "banarse", "leer"], "2026-11-16", T0);
  assert.deepEqual(C.contraPromedio(m, prom, T0 + min(20)), { pasado: false, falta: 300000, promedio: 1500 });
  assert.equal(C.contraPromedio(m, prom, T0 + min(26)).pasado, true);
  m = C.siguiente(m, T0 + min(23)).m;           // 1380 (2 min menos)
  m = C.siguiente(m, T0 + min(40)).m;           // 1020 (+2 min)
  m = C.saltar(m, T0 + min(41)).m;              // banarse: saltado
  assert.equal(C.contraPromedio(m, prom, T0 + min(45)), null, "leer: sin promedio");
  m = C.siguiente(m, T0 + min(71)).m;           // leer 1800, sin promedio
  const r = C.resumen(m, prom);
  assert.deepEqual(r.pasos.map(p => [p.id, p.seg, p.diferencia]), [["manana", 1380, -120], ["desayunar", 1020, 120], ["banarse", null, null], ["leer", 1800, null]]);
  assert.deepEqual([r.total, r.hechos, r.saltados, r.totalPromedio, r.diferencia], [4200, 3, 1, 2400, 0], "contra tu promedio, solo los pasos que tienen promedio");
  assert.ok(C.mananaValida(m, "2026-11-16", T0 + min(80)));
  assert.ok(!C.mananaValida({ v: 1, fecha: "2026-11-16", pasos: [], i: 0, inicio: T0 }, "2026-11-16", T0));
});
