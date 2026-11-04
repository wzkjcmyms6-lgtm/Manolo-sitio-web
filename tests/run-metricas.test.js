const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/run-metricas.js");
const F = require("../js/run-formatos.js");
const X = require("./run-fixtures.js");

const txt = s => new TextEncoder().encode(s);
const cerca = (a, b, tol, msj) => assert.ok(Math.abs(a - b) <= tol, `${msj || ""} ${a} ≈ ${b} (±${tol})`);
const desdeGpx = (ps, o) => F.leer(txt(X.gpx(ps, o)), "a.gpx");

test("5,1 km a 3 m/s con subida: distancia, tiempos, parciales, desnivel, mejores marcas", () => {
  const ps = X.puntos({ segundos: 1700, vel: 3, subida: 51, fc: 150 });
  const { campos: c, ruta } = M.calcular(desdeGpx(ps), {});
  cerca(c.distanciaM, 5100, 15, "distancia GPS");
  assert.equal(c.distance, Math.round(c.distanciaM / 10) / 100);
  assert.equal(c.tiempoTotalS, 1700);
  cerca(c.tiempoMovS, 1700, 2, "todo en movimiento");
  cerca(c.duration, 28.3, 0.1);
  assert.equal(c.splits.length, 6, "5 km completos + el último parcial");
  c.splits.slice(0, 5).forEach(s => { assert.equal(s.d, 1000); cerca(s.tm, 333, 3, "parcial"); cerca(s.dz, 10, 2, "desnivel del km"); assert.equal(s.fc, 150); assert.ok(s.gap < s.tm, "subiendo, el ritmo ajustado es más rápido"); });
  cerca(c.splits[5].d, 100, 2, "el último, parcial");
  assert.deepEqual(c.parciales, c.splits.slice(0, 5).map(s => s.tm));
  cerca(c.desnivelPosM, 51, 5, "desnivel con histéresis");
  assert.equal(c.desnivelNegM, 0);
  assert.deepEqual([c.altMinM, c.altMaxM].map(Math.round), [3600, 3651]);
  assert.deepEqual(Object.keys(c.mejores), ["400", "805", "1000", "1609", "3219", "5000"]);
  cerca(c.mejores["1000"], 333, 3);
  cerca(c.mejores["5000"], 1666, 6);
  assert.equal(c.fcMedia, 150);
  assert.equal(c.fcMax, 150);
  assert.equal(c.zonas, undefined, "sin FC máx en ajustes no hay zonas");
  assert.equal(c.carga.m, "rtss", "sin FC máx: rTSS con la ruta");
  assert.ok(c.conRuta && c.mini && ruta && ruta.enc);
  assert.ok(M.leerMini(c.mini).length <= 250);
  assert.ok(c.gapS < Math.round(c.tiempoMovS / 5.1));
  cerca(c.velMaxKmh, 10.8, 0.3);
});

test("pausa del reloj y quieto en un semáforo: tiempo total vs en movimiento", () => {
  const ps = X.puntos({ segundos: 600, vel: 3, pausaEn: 300, pausaS: 120 });
  const c = M.calcular(desdeGpx(ps), {}).campos;
  assert.equal(c.tiempoTotalS, 720);
  cerca(c.tiempoMovS, 600, 2);
  cerca(c.distanciaM, 1800, 10, "la pausa no suma distancia (mismo lugar)");
  // Quieto 60 s con temblor del GPS (±1 m): no es movimiento ni suma distancia
  const base = X.puntos({ segundos: 300, vel: 3 });
  const ult = base[base.length - 1];
  for (let s = 1; s <= 60; s++) base.push(Object.assign({}, ult, { t: ult.t + s * 1000, lat: ult.lat + ((s % 3) - 1) * 0.000009 }));
  const q = M.calcular(desdeGpx(base), {}).campos;
  cerca(q.tiempoMovS, 300, 6);
  assert.equal(q.tiempoTotalS, 360);
  cerca(q.distanciaM, 900, 6);
});

test("limpieza: salto de GPS, pico de FC, puntos repetidos, coordenadas 0,0", () => {
  const ps = X.puntos({ segundos: 300, vel: 3, fc: 150, salto: 150 });
  ps[200].fc = 228;
  const dup = Object.assign({}, ps[100], { t: ps[100].t + 200 });
  const conBasura = ps.concat([dup]);
  conBasura[50] = Object.assign({}, conBasura[50], { lat: 0, lon: 0 });
  const c = M.calcular({ deporte: "running", inicio: ps[0].t, puntos: conBasura, pausas: [], vueltas: [], resumen: {} }, {}).campos;
  cerca(c.distanciaM, 900, 8, "el salto de 550 m no cuenta");
  assert.equal(c.fcMax, 150, "el pico aislado de FC se corrige");
  const limpio = M.limpiar(conBasura, M.PERFILES.running);
  assert.equal(limpio.length, 301);
  assert.equal(limpio[150].lat, null);
  assert.equal(limpio[50].lat, null);
});

test("valores del archivo primero: distancia del reloj, desnivel, calorías, FC y cadencia (FIT)", () => {
  const ps = X.puntos({ segundos: 600, vel: 3, fc: 150, cad: 84, subida: 30 });
  const a = F.leer(X.fit(ps), "a.fit");
  const c = M.calcular(a, { fcMax: 190, fcReposo: 50 }).campos;
  assert.equal(c.distanciaM, Math.round(a.resumen.distM));
  assert.deepEqual([c.desnivelPosM, c.desnivelNegM, c.kcal, c.fcMedia, c.fcMax], [37, 12, 432, 151, 175]);
  assert.equal(c.cadMedia, 170, "cadencia del reloj (una pierna) × 2");
  assert.equal(c.zonas.length, 5);
  assert.equal(c.zonas.reduce((s, x) => s + x, 0), 600);
  assert.equal(c.carga.m, "trimp");
});

test("cinta sin GPS (FIT con distancia del reloj): sin mapa pero con parciales", () => {
  const ps = X.puntos({ segundos: 700, vel: 3 }).map(p => Object.assign({}, p, { lat: null, lon: null }));
  const a = { formato: "fit", deporte: "running", subtipo: "cinta", inicio: ps[0].t, puntos: ps, pausas: [], vueltas: [], resumen: {} };
  const { campos: c, ruta } = M.calcular(a, {});
  assert.equal(c.conRuta, false);
  assert.equal(c.mini, undefined);
  assert.equal(c.distanciaM, 2100);
  assert.equal(c.splits.length, 3);
  assert.ok(ruta.serie && !ruta.enc);
  const tramos = M.leerRuta(ruta);
  assert.equal(tramos[0].length, 701);
  assert.equal(tramos[0][700].d, 2100);
});

test("solo resumen (CSV o actividad a mano): sin parciales; calorías solo con peso", () => {
  const a = { deporte: "running", inicio: Date.UTC(2024, 2, 5, 11), puntos: [], resumen: { distM: 5020, tiempoTotalS: 1800, tiempoMovS: 1750 } };
  const c = M.calcular(a, { rpe: 6 }).campos;
  assert.deepEqual([c.distance, c.duration, c.tiempoMovS, c.conRuta, c.parciales.length], [5.02, 29.2, 1750, false, 0]);
  assert.deepEqual(c.carga, { v: Math.round(6 * 1750 / 60 * 100 / 480), m: "rpe" });
  const ps = X.puntos({ segundos: 600, vel: 3 });
  assert.equal(M.calcular(desdeGpx(ps), {}).campos.kcal, undefined, "sin peso, sin calorías");
  assert.equal(M.calcular(desdeGpx(ps), { pesoKg: 70 }).campos.kcal, 126);
});

test("bici: sin mejores marcas de carrera ni GAP", () => {
  const ps = X.puntos({ segundos: 600, vel: 8 });
  const c = M.calcular(Object.assign(desdeGpx(ps), { deporte: "bicicleta" }), {}).campos;
  assert.equal(c.mejores, undefined);
  assert.equal(c.gapS, undefined);
  cerca(c.distanciaM, 4800, 20);
});

test("mejores marcas: ventana deslizante con interpolación", () => {
  // 3 km: el km del medio a 4:00 /km, el resto a 6:00 /km.
  const D = [], T = [];
  for (let d = 0, t = 0; d <= 3000; d += 10) { D.push(d); T.push(t); t += d >= 1000 && d < 2000 ? 2.4 : 3.6; }
  const m = M.mejoresMarcas(D, T);
  assert.equal(m["1000"], 240);
  assert.equal(m["400"], 96);
  cerca(m["1609"], 240 + 609.344 * 0.36, 1);
  assert.equal(m["5000"], undefined);
});

test("Minetti, zonas, carga TRIMP de 1 h al umbral = 100", () => {
  assert.equal(M.costoMinetti(0), 3.6);
  assert.ok(M.costoMinetti(0.1) > 5.9 && M.costoMinetti(-0.1) < 2.2);
  assert.equal(M.costoMinetti(0.9), M.costoMinetti(0.45), "pendiente limitada a ±45 %");
  assert.deepEqual(M.limitesZonas(200, 0).map(Math.round), [120, 140, 160, 180]);
  assert.deepEqual(M.limitesZonas(190, 50).map(Math.round), [134, 148, 162, 176]);
  assert.equal(M.limitesZonas(null), null);
  assert.deepEqual([110, 140, 179, 181].map(f => M.zonaDe(f, M.limitesZonas(200))), [0, 2, 3, 4]);
  const inicio = Date.UTC(2026, 0, 1);
  const ps = Array.from({ length: 3601 }, (_, s) => ({ t: inicio + s * 1000, lat: null, lon: null, alt: null, d: s * 3, fc: 50 + 0.85 * 140, cad: null }));
  const c = M.calcular({ deporte: "running", inicio, puntos: ps, resumen: {} }, { fcMax: 190, fcReposo: 50 }).campos;
  cerca(c.carga.v, 100, 1);
  assert.equal(M.cargaRpe(8, 60).v, 100);
});

test("ruta: polilínea, compatible con la v1 del GPS viejo, y nunca más de 1 MiB", () => {
  const filas = [[-16.5, -68.13, 0], [-16.50001, -68.13002, 1.0], [-16.6, -68.2, 3600]];
  assert.deepEqual(M.decodificar(M.codificar(filas, [1e5, 1e5, 1]), [1e5, 1e5, 1]), filas);
  const v1 = { v: 1, deporte: "running", inicio: 1000, enc: M.codificar(filas, [1e5, 1e5, 1]), tramos: [2, 1], n: 3, alt: M.codificar([[3600], [M.SIN], [3610]], [1]) };
  const t = M.leerRuta(v1);
  assert.deepEqual(t.map(x => x.length), [2, 1]);
  assert.deepEqual([t[0][0].alt, t[0][1].alt, t[1][0].t, t[0][0].fc], [3600, null, 1000 + 3600000, null]);
  // 40 h a 1 punto por segundo, con FC y altura variables: se aligera hasta caber
  const ps = X.puntos({ segundos: 144000, vel: 3, fc: 140, cad: 85, subida: 400 })
    .map((p, i) => Object.assign(p, { fc: 120 + (i % 40), alt: p.alt + (i % 7) * 3 }));
  const { ruta } = M.calcular({ deporte: "running", inicio: ps[0].t, puntos: ps, resumen: {} }, {});
  assert.ok(JSON.stringify(ruta).length <= 900000);
  assert.ok(ruta.paso >= 2);
  assert.equal(M.leerRuta(ruta)[0].length, ruta.n);
});

test("título automático según la hora y fecha local", () => {
  const h = hh => new Date(2026, 10, 4, hh, 0).getTime();
  assert.deepEqual([6, 12, 16, 20, 23, 3].map(x => M.tituloAuto("running", h(x))),
    ["Carrera por la mañana", "Carrera al mediodía", "Carrera por la tarde", "Carrera por la noche", "Carrera de madrugada", "Carrera de madrugada"]);
  assert.equal(M.tituloAuto("bicicleta", h(7)), "Rodada por la mañana");
  assert.equal(M.fechaLocal(new Date(2026, 0, 9, 23, 59).getTime()), "2026-01-09");
});

test("Douglas-Peucker: una recta queda en 2 puntos; un zigzag se conserva", () => {
  const recta = Array.from({ length: 500 }, (_, i) => ({ lat: -16.5 + i * 1e-5, lon: -68.1 }));
  assert.equal(M.simplificar(recta, 250).length, 2);
  const zz = Array.from({ length: 40 }, (_, i) => ({ lat: -16.5 + i * 1e-4, lon: -68.1 + (i % 2) * 1e-3 }));
  assert.equal(M.simplificar(zz, 250).length, 40);
  assert.ok(M.simplificar(Array.from({ length: 2000 }, (_, i) => ({ lat: -16.5 + Math.sin(i / 7) * 1e-3, lon: -68.1 + i * 1e-5 })), 250).length <= 250);
});
