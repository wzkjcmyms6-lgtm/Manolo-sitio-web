const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../js/run-formatos.js");
const X = require("./run-fixtures.js");

const txt = s => new TextEncoder().encode(s);
const cerca = (a, b, tol, msj) => assert.ok(Math.abs(a - b) <= tol, `${msj || ""} ${a} ≈ ${b} (±${tol})`);

test("tipoDe: por contenido, no por nombre", () => {
  const ps = X.puntos({ segundos: 5 });
  assert.equal(F.tipoDe(txt(X.gpx(ps)), "x.fit"), "gpx");
  assert.equal(F.tipoDe(txt(X.tcx(ps)), "x"), "tcx");
  assert.equal(F.tipoDe(X.fit(ps), "x.gpx"), "fit");
  assert.equal(F.tipoDe(new Uint8Array([0x1f, 0x8b, 8, 0]), "a.fit.gz"), "gz");
  assert.equal(F.tipoDe(new Uint8Array([0x50, 0x4b, 3, 4]), "a"), "zip");
  assert.equal(F.tipoDe(txt("Activity ID,Activity Date"), "activities.csv"), "csv");
  assert.equal(F.tipoDe(txt("hola"), "nota.txt"), null);
});

test("deporte desde texto (inglés, español, códigos)", () => {
  const d = s => { const x = F.deporteDeTexto(s); return [x.deporte, x.subtipo]; };
  assert.deepEqual(d("running"), ["running", null]);
  assert.deepEqual(d("Run"), ["running", null]);
  assert.deepEqual(d("Trail Run"), ["running", "trail"]);
  assert.deepEqual(d("Virtual Run"), ["running", "virtual"]);
  assert.deepEqual(d("Carrera de montaña"), ["running", "trail"]);
  assert.deepEqual(d("Treadmill"), ["running", "cinta"]);
  assert.deepEqual(d("9"), ["running", null]);
  assert.deepEqual(d("Biking"), ["bicicleta", null]);
  assert.deepEqual(d("E-Bike Ride"), ["bicicleta", null]);
  assert.deepEqual(d("Ciclismo"), ["bicicleta", null]);
  assert.deepEqual(d("Walk"), ["otro", null]);
  assert.deepEqual(d("Natación"), ["otro", null]);
  assert.deepEqual(d(""), [null, null]);
  assert.deepEqual([F.deporteDeFit(1, 1).subtipo, F.deporteDeFit(2, 0).deporte, F.deporteDeFit(0, 0).deporte, F.deporteDeFit(11, 0).deporte], ["cinta", "bicicleta", null, "otro"]);
});

test("GPX: puntos, FC, cadencia, nombre, tipo y pausas entre tramos", () => {
  const ps = X.puntos({ segundos: 120, fc: 150, cad: 85 });
  const a = F.leer(txt(X.gpx(ps, { nombre: "Subida a &quot;Killi Killi&quot; &amp; vuelta" })), "a.gpx");
  assert.equal(a.formato, "gpx");
  assert.equal(a.deporte, "running");
  assert.equal(a.titulo, 'Subida a "Killi Killi" & vuelta');
  assert.equal(a.dispositivo, "Reloj de prueba");
  assert.equal(a.puntos.length, 121);
  assert.equal(a.inicio, ps[0].t);
  const p = a.puntos[10];
  cerca(p.lat, ps[10].lat, 1e-6); assert.equal(p.fc, 150); assert.equal(p.cad, 85); cerca(p.alt, 3600, 0.1);
  assert.equal(p.d, null, "el GPX no trae distancia del reloj");
  // Dos tramos = una pausa
  const b = F.leer(txt(X.gpx(ps, { segmentos: [ps.slice(0, 50), ps.slice(60)] })), "b.gpx");
  assert.deepEqual(b.pausas, [[ps[49].t, ps[60].t]]);
  // Sin tipo: el deporte queda sin saber
  assert.equal(F.leer(txt(X.gpx(ps, { tipo: "" })), "c.gpx").deporte, null);
});

test("GPX sin horas o ruta planificada: error claro", () => {
  assert.throws(() => F.leer(txt('<gpx><rte><rtept lat="1" lon="2"/></rte></gpx>'), "r.gpx"), /ruta planificada/);
  assert.throws(() => F.leer(txt('<gpx><trk><trkseg><trkpt lat="1" lon="2"></trkpt></trkseg></trk></gpx>'), "r.gpx"), /hora/);
  assert.throws(() => F.leer(txt("<gpx><trk>"), "r.gpx"), F.ErrorArchivo);
  assert.throws(() => F.leer(txt("cualquier cosa"), "x.txt"), /No es un archivo de actividad/);
});

test("TCX: espacios antes del XML, vueltas, distancia del reloj, FC y cadencia", () => {
  const ps = X.puntos({ segundos: 600, fc: 140, cad: 86 });
  const a = F.leer(txt(X.tcx(ps, { vueltas: 2 })), "a.tcx");
  assert.equal(a.formato, "tcx");
  assert.equal(a.deporte, "running");
  assert.equal(a.dispositivo, "Forerunner de prueba");
  assert.equal(a.puntos.length, 601);
  assert.equal(a.puntos[100].d, 300);
  assert.equal(a.puntos[100].cad, 86);
  assert.equal(a.vueltas.length, 2);
  assert.equal(a.resumen.kcal, 200);
  assert.equal(a.resumen.fcMedia, 140);
  assert.equal(a.resumen.fcMax, 150);
  cerca(a.resumen.distM, 1800 - 3, 4, "suma de vueltas");
  assert.equal(F.leer(txt(X.tcx(ps, { sport: "Biking" })), "b.tcx").deporte, "bicicleta");
  assert.equal(F.leer(txt(X.tcx(ps, { sport: "Other" })), "c.tcx").deporte, null);
});

test("FIT: registros, escalas, sesión, sub-deporte y fabricante", () => {
  const ps = X.puntos({ segundos: 300, fc: 155, cad: 84, subida: 30 });
  const a = F.leer(X.fit(ps, { sub: 3 }), "a.fit");
  assert.equal(a.formato, "fit");
  assert.equal(a.deporte, "running");
  assert.equal(a.subtipo, "trail");
  assert.equal(a.dispositivo, "Garmin");
  assert.equal(a.puntos.length, 301);
  const p = a.puntos[150], q = ps[150];
  assert.equal(p.t, q.t);
  cerca(p.lat, q.lat, 1e-6, "semicírculos → grados");
  cerca(p.lon, q.lon, 1e-6);
  cerca(p.alt, q.alt, 0.2, "altitud /5 − 500");
  cerca(p.d, q.d, 0.01, "distancia /100");
  assert.equal(p.fc, 155);
  assert.equal(p.cad, 84);
  assert.equal(a.inicio, ps[0].t);
  assert.equal(a.resumen.distM, Math.round(ps[300].d * 100) / 100);
  assert.equal(a.resumen.tiempoTotalS, 300);
  assert.equal(a.resumen.kcal, 432);
  assert.deepEqual([a.resumen.fcMedia, a.resumen.fcMax, a.resumen.cadMedia, a.resumen.ascensoM, a.resumen.descensoM], [151, 175, 85, 37, 12]);
});

test("FIT: big-endian, horas comprimidas, campos de desarrollador, pausas y vueltas", () => {
  const ps = X.puntos({ segundos: 200 });
  const a = F.leer(X.fit(ps, { granEndian: true, comprimidas: true, dev: true, pausa: [100, 120], vueltas: 2 }), "b.fit");
  assert.equal(a.puntos.length, 201);
  assert.deepEqual(a.puntos.map(p => p.t), ps.map(p => p.t), "horas comprimidas reconstruidas");
  cerca(a.puntos[77].lat, ps[77].lat, 1e-6);
  assert.equal(a.pausas.length, 1);
  assert.deepEqual(a.pausas[0], [ps[100].t - 1000, ps[120].t]);
  assert.equal(a.vueltas.length, 2);
  assert.ok(a.vueltas[0].distM > 290 && a.vueltas[0].distM < 310);
  assert.equal(a.resumen.tiempoRelojS, 140);
  assert.equal(a.puntos[5].fc, null, "0xFF = sin dato");
});

test("FIT: sin sesión usa el primer punto; bici; archivo de ajustes = error", () => {
  const ps = X.puntos({ segundos: 30 });
  const a = F.leer(X.fit(ps, { sesion: false }), "c.fit");
  assert.equal(a.inicio, ps[0].t);
  assert.equal(a.deporte, null);
  assert.equal(F.leer(X.fit(ps, { sport: 2 }), "d.fit").deporte, "bicicleta");
  const vacio = X.fit([ps[0]], { sesion: false }).slice(0, 14 + 3);
  assert.throws(() => F.leer(vacio, "e.fit"), F.ErrorArchivo);
});
