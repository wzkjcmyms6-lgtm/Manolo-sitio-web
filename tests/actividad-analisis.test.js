const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/actividad-analisis.js");

test("totales por semana: suma lo anotado a mano, las rutinas y lo viejo con GPS", () => {
  const acts = [
    { date: "2026-09-29", distance: 5, duration: 30 },
    { date: "2026-09-30", distance: 0, duration: 32, fuente: "rutina" },   // rutina sin km
    { date: "2026-09-22", distance: 10, duration: 60.5, fuente: "gps" },
    { date: "2026-10-05", distance: 7, duration: 40 },                     // futuro: no cuenta
    { date: "2026-01-01", distance: 99, duration: 1 }                      // fuera de las 12 semanas
  ];
  const s = A.porSemana(acts, "2026-10-01", 12);
  assert.equal(s.length, 12);
  assert.equal(s[11].desde, "2026-09-28", "la última es la semana de hoy (desde el lunes)");
  assert.equal(s[0].desde, "2026-07-13");
  assert.deepEqual([s[11].km, s[11].min, s[11].n], [5, 62, 2]);
  assert.deepEqual([s[10].km, s[10].min], [10, 60.5]);
  assert.equal(s.slice(0, 10).reduce((t, x) => t + x.n, 0), 0);
});

test("textos de la semana elegida: rango, distancia y tiempo", () => {
  assert.equal(A.rangoSemana("2026-09-14"), "14 sept - 20 sept 2026");
  assert.equal(A.rangoSemana("2025-12-29"), "29 dic 2025 - 4 ene 2026");
  assert.equal(A.textoKm(13.584), "13,58 km");
  assert.equal(A.textoKm(0), "0 km");
  assert.equal(A.textoTiempo(303), "5h 3min");
  assert.equal(A.textoTiempo(45.4), "45min");
  assert.equal(A.textoTiempo(120), "2h");
  assert.equal(A.textoTiempo(0), "0min");
});

test("escala con números redondos: 13,6 km → 0 · 8 · 16 km", () => {
  assert.deepEqual(A.escala(13.58, "km"), { paso: 8, tope: 16 });
  assert.deepEqual(A.escala(0, "km"), { paso: 1, tope: 2 }, "sin datos igual tiene escala");
  assert.deepEqual(A.escala(42, "km"), { paso: 25, tope: 50 });
  assert.deepEqual(A.escala(8, "km"), { paso: 5, tope: 10 }, "deja aire sobre la semana más alta");
  assert.deepEqual(A.escala(303, "min"), { paso: 180, tope: 360 });
  assert.deepEqual(A.escala(0, "min"), { paso: 30, tope: 60 });
  assert.equal(A.etiquetaEje(8, "km"), "8 km");
  assert.equal(A.etiquetaEje(180, "min"), "3h");
});

test("meses del eje: en la semana que trae el día 1", () => {
  const s = A.porSemana([], "2026-10-01", 12);
  assert.deepEqual(A.mesesEje(s).map(m => `${m.i}:${m.texto}`), ["2:AGO", "7:SEP", "11:OCT"]);
});

test("gráfico: una línea, un punto por semana, la elegida resaltada y toques por semana", () => {
  const s = A.porSemana([{ date: "2026-09-16", distance: 13.58, duration: 303 }], "2026-10-01", 12);
  const svg = A.svgSemanas(s, { metrica: "km", sel: 9, id: "t" });
  assert.equal((svg.match(/class="dash-punto"/g) || []).length, 11, "11 puntos + el elegido");
  assert.equal((svg.match(/class="dash-sel"/g) || []).length, 1);
  assert.equal((svg.match(/data-dash-semana="/g) || []).length, 12);
  assert.ok(svg.includes("16 km") && svg.includes("8 km") && svg.includes("0 km"));
  assert.ok(svg.includes("14 sept - 20 sept 2026: 13,58 km, 5h 3min"), "cada semana dice sus datos");
  assert.ok(svg.includes('id="t-g"') && svg.includes("url(#t-g)"));
  assert.ok(!/NaN|undefined/.test(svg));
  // El punto elegido queda arriba (13,58 de 16 km) y en la columna 9.
  const sel = svg.match(/class="dash-sel" cx="([\d.]+)" cy="([\d.]+)"/);
  const toque9 = svg.match(/data-dash-semana="9" x="([\d.]+)" y="0" width="([\d.]+)"/);
  assert.ok(Math.abs(Number(sel[1]) - (Number(toque9[1]) + Number(toque9[2]) / 2)) < 0.2);
  assert.ok(Number(sel[2]) < 50);
});

test("gráfico de tiempo y sin datos no rompe", () => {
  const vacio = A.porSemana([], "2026-10-01", 12);
  const svg = A.svgSemanas(vacio, { metrica: "min" });
  assert.ok(svg.includes("1h") && svg.includes("30min") && !/NaN/.test(svg));
});
