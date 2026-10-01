const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../js/actividad-vista.js");

test("formatos de distancia, tiempo, ritmo y velocidad", () => {
  assert.equal(V.distancia(2450), "2,45 km");
  assert.equal(V.distancia(0), "0,00 km");
  assert.equal(V.tiempo(754), "12:34");
  assert.equal(V.tiempo(3723), "1:02:03");
  assert.equal(V.ritmo(332), "5:32 /km");
  assert.equal(V.ritmo(359.7), "6:00 /km", "redondeo sin '5:60'");
  assert.equal(V.ritmo(null), "--:-- /km");
  assert.equal(V.ritmo(4000), "--:-- /km", "más lento que 30 min/km no es correr");
  assert.equal(V.ritmo(300, true), "5:00");
  assert.equal(V.velocidad(8), "28,8 km/h");
  assert.equal(V.desnivel(null), "No disponible");
  assert.equal(V.desnivel(42.4), "42 m");
});

test("calorías de correr: solo con peso real; estimación ~1 kcal/kg/km", () => {
  assert.equal(V.caloriasRunning(5000, 80), 400);
  assert.equal(V.caloriasRunning(5000, null), null);
  assert.equal(V.caloriasRunning(0, 80), null);
  assert.equal(V.pesoActual({ "2026-09-01": 85, "2026-09-20": 83.5 }, 70), 83.5);
  assert.equal(V.pesoActual({}, 78), 78);
  assert.equal(V.pesoActual({}, null), null);
});

test("texto del GPS", () => {
  assert.equal(V.textoGps("ok", 7.6), "GPS listo · ±8 m");
  assert.equal(V.textoGps("esperando"), "Buscando GPS…");
  assert.equal(V.textoGps("sin señal"), "Sin señal de GPS");
});

test("trazo SVG: entra en el cuadro, conserva proporciones y marca inicio y fin", () => {
  const tramo = [0, 1, 2, 3].map(i => ({ lat: -16.5 + i * 0.001, lon: -68.15 }));
  const pr = V.proyectar([tramo], 300, 200, 10);
  pr[0].forEach(([x, y]) => { assert.ok(x >= 10 && x <= 290); assert.ok(y >= 10 && y <= 190); });
  assert.ok(pr[0][0][1] > pr[0][3][1], "el norte queda arriba");
  const svg = V.svgRuta([tramo, tramo.map(p => ({ lat: p.lat, lon: p.lon + 0.001 }))]);
  assert.equal((svg.match(/<polyline/g) || []).length, 2, "un trazo por tramo");
  assert.ok(svg.includes("act-ruta-ini") && svg.includes("act-ruta-fin"));
  assert.ok(V.svgRuta([]).startsWith("<svg"), "sin puntos no falla");
});

test("aligerar: muchos puntos se reducen conservando el último", () => {
  const t = Array.from({ length: 5000 }, (_, i) => ({ lat: i, lon: 0 }));
  const a = V.aligerar(t, 500);
  assert.ok(a.length <= 501);
  assert.equal(a[a.length - 1], t[t.length - 1]);
});
