// Bici al nivel de Running (js/bici-analisis.js, D-141): velocidad, filtros,
// récords de bici y medallas, récords sueltos, Eddington y el resumen.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/run-metricas.js");
const B = require("../js/bici-analisis.js");

const ms = s => Date.parse(s);
// Rodada importada (con ruta) o a mano.
const imp = (id, date, km, min, extra) => Object.assign({ id, date, fuente: "importado", inicio: ms(`${date}T07:00:00-04:00`), distanciaM: km * 1000, distance: km, tiempoMovS: min * 60, duration: min, conRuta: true, mini: "x" }, extra || {});
const mano = (id, date, km, min) => ({ id, date, distance: km, duration: min });

test("velocidad, filtros y lo que es «a mano»", () => {
  const a = imp("a", "2026-11-01", 60, 120), b = mano("b", "2026-11-02", 20, 50), c = imp("c", "2026-11-03", 30, 90, { conRuta: false, mini: null });
  assert.equal(B.velocidad(a), 30);
  assert.equal(B.velocidad(b), 24);
  assert.equal(B.velocidad({ distance: 10 }), 0, "sin tiempo, sin velocidad");
  assert.deepEqual([a, b, c].filter(B.PASA.mapa).map(d => d.id), ["a"]);
  assert.deepEqual([a, b, c].filter(B.PASA.mano).map(d => d.id), ["b"]);
  assert.deepEqual([a, b, c].filter(B.PASA.largas).map(d => d.id), ["a"], "50 km o más");
  assert.deepEqual(B.FILTROS.map(f => f[0]), ["todas", "mapa", "mano", "largas"]);
});

test("récords de bici al importar: 5 a 160 km, aparte de los de correr", () => {
  // 60 km a 30 km/h parejos: 10 km en 20 min, 50 km en 100 min.
  const D = [], T = [];
  for (let i = 0; i <= 600; i++) { D.push(i * 100); T.push(i * 12); }
  const mb = M.mejoresMarcas(D, T, M.DISTANCIAS_BICI);
  assert.deepEqual(mb, { 5000: 600, 10000: 1200, 20000: 2400, 30000: 3600, 40000: 4800, 50000: 6000 });
  assert.equal(M.mejoresMarcas(D, T)["5000"], 600, "sin decir nada, siguen las de correr");
  assert.equal(M.DISTANCIAS_BICI.length, 9);
  assert.equal(B.NOMBRES["160000"].nombre, "160 km");
});

test("medallas: las 3 mejores hasta ese día, y tus mejores tiempos", () => {
  const xs = [
    imp("r1", "2026-01-05", 40, 100, { mejoresBici: { 5000: 700, 10000: 1500, 20000: 3100 } }),
    imp("r2", "2026-02-05", 40, 95, { mejoresBici: { 5000: 650, 10000: 1450, 20000: 3000 } }),
    imp("r3", "2026-03-05", 40, 98, { mejoresBici: { 5000: 690, 10000: 1460 } }),
    imp("r4", "2026-04-05", 40, 99, { mejoresBici: { 5000: 720 } }),
    mano("m1", "2026-04-06", 20, 50)
  ];
  const L = B.logrosPorId(xs);
  assert.deepEqual(L.r1.map(l => `${l.nombre}:${l.puesto}`), ["5 km:1", "10 km:1", "20 km:1"]);
  assert.deepEqual(L.r2.map(l => `${l.nombre}:${l.puesto}`), ["5 km:1", "10 km:1", "20 km:1"]);
  assert.deepEqual(L.r3.map(l => `${l.nombre}:${l.puesto}`), ["5 km:2", "10 km:2"]);
  assert.equal(L.r4, undefined, "la cuarta mejor no tiene medalla");
  assert.deepEqual(B.logros(xs[0], xs).map(l => l.puesto), [1, 1, 1], "el día que saliste, era la mejor");
  const mt = B.mejoresTiempos(xs);
  assert.deepEqual(mt.map(x => x.nombre), ["5 km", "10 km", "20 km"]);
  assert.deepEqual(mt[0].top.map(x => x.id), ["r2", "r3", "r1"]);
  assert.equal(Math.round(mt[1].top[0].kmh * 10) / 10, 24.8);
});

test("récords sueltos: la más larga, la de más desnivel, la más rápida y la velocidad máxima", () => {
  const xs = [
    imp("a", "2026-01-01", 110, 300, { desnivelPosM: 800, velMaxKmh: 62 }),
    imp("b", "2026-01-02", 25, 50, { desnivelPosM: 1200, velMaxKmh: 140 }),
    imp("c", "2026-01-03", 15, 25),
    mano("d", "2026-01-04", 40, 70)
  ];
  const r = B.records(xs);
  assert.deepEqual([r.larga.doc.id, r.larga.valor], ["a", 110000]);
  assert.deepEqual([r.subida.doc.id, r.subida.valor], ["b", 1200]);
  assert.equal(r.rapida.doc.id, "d", "la más rápida de 20 km o más (c es más corta)");
  assert.deepEqual([r.vmax.doc.id, r.vmax.valor], ["a", 62], "más de 120 km/h es un error del GPS");
  assert.deepEqual(B.records([]), { larga: null, subida: null, rapida: null, vmax: null });
});

test("número de Eddington", () => {
  // Días: 12, 10, 8, 5 (dos rodadas el mismo día), 3 y 1 km → E = 4.
  const xs = [mano("a", "2026-01-01", 12, 40), mano("b", "2026-01-02", 10, 30), mano("c", "2026-01-03", 8, 25),
    mano("d1", "2026-01-04", 2, 8), mano("d2", "2026-01-04", 3, 10), mano("e", "2026-01-05", 3, 10), mano("f", "2026-01-06", 1, 5)];
  assert.deepEqual(B.eddington(xs), { e: 4, siguiente: 5, tienen: 4, faltan: 1, dias: 6 });
  assert.deepEqual(B.eddington([]), { e: 0, siguiente: 1, tienen: 0, faltan: 1, dias: 0 });
  // 30 días de 40 km: E = 30; para 31 faltan 31 días (ninguno tiene 31… sí: 40 ≥ 31, tienen 30, falta 1).
  const muchos = Array.from({ length: 30 }, (_, i) => mano(`x${i}`, `2026-03-${String(i + 1).padStart(2, "0")}`, 40, 90));
  assert.deepEqual(B.eddington(muchos), { e: 30, siguiente: 31, tienen: 30, faltan: 1, dias: 30 });
});

test("el resumen inteligente de una rodada", () => {
  const xs = [
    imp("a", "2026-10-20", 40, 100, { mejoresBici: { 5000: 640, 10000: 1400 } }),
    imp("b", "2026-10-25", 42, 110, { mejoresBici: { 5000: 660, 10000: 1450 } }),
    imp("c", "2026-10-28", 38, 95),
    imp("d", "2026-11-02", 30, 70),
    imp("e", "2026-11-04", 45, 100, { mejoresBici: { 5000: 600, 10000: 1380, 20000: 2900 }, desnivelPosM: 650, altMaxM: 4100 })
  ];
  const f = B.resumen(xs[4], xs);
  assert.equal(f[0], "Récords de bici en 5 km, 10 km y 20 km (10:00, 23:00, 48:20).");
  assert.equal(f[1], "Tu rodada más larga: 45,0 km.");
  assert.ok(/^27,0 km\/h: [\d,]+ km\/h más rápido que tu promedio del último mes en distancias parecidas\.$/.test(f[2]), f[2]);
  assert.equal(f[3], "Con 650 m de desnivel positivo; llegaste a 4.100 m de altura.");
  // Una rodada simple: al menos 2 frases con lo básico.
  const g = B.resumen(mano("z", "2026-11-10", 12, 30), []);
  assert.deepEqual(g, ["12,0 km en 30:00 (24,0 km/h)."]);
  assert.deepEqual(B.resumen(null), []);
});

test("la tarjeta de Inicio", () => {
  const xs = [imp("a", "2026-11-16", 20, 50), mano("b", "2026-11-17", 15, 40), imp("c", "2026-11-10", 50, 120)];
  const r = B.inicio(xs, "2026-11-18");
  assert.equal(r.kmSemana, 35);
  assert.equal(r.ultima.id, "b");
  assert.equal(B.inicio([], "2026-11-18"), null);
});
