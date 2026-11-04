const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/run-segmentos.js");
const M = require("../js/run-metricas.js");
const X = require("./run-fixtures.js");

// Ruta al norte a 3 m/s (1 punto por segundo) con subida suave.
const ruta = (seg, vel, extra) => [X.puntos(Object.assign({ segundos: seg, vel, subida: 60 }, extra))];

test("crear un segmento entre dos distancias de la ruta", () => {
  const r = ruta(1200, 3);
  const s = S.crear(r, 1000, 2000, "  Subida del parque ", "imp_a", 123);
  assert.equal(s.nombre, "Subida del parque");
  assert.ok(Math.abs(s.distanciaM - 1000) <= 2, `${s.distanciaM}`);
  assert.ok(s.desnivelM >= 14 && s.desnivelM <= 18, `${s.desnivelM}`);
  assert.ok(s.pendiente > 1.5 && s.pendiente < 1.8);
  assert.deepEqual([s.origenId, s.creado, s.esfuerzos], ["imp_a", 123, {}]);
  assert.ok(S.trazo(s).length >= 2 && S.trazo(s).length <= 200);
  assert.equal(S.crear(r, 1000, 1050, "x"), null, "menos de 100 m no es un segmento");
  assert.equal(S.crear(r, 2000, 1000, "").nombre, "Segmento de 1 km", "el orden no importa; nombre automático");
});

test("esfuerzo: tiempo por el segmento en otra carrera (más rápida) y no en otra ruta", () => {
  const s = S.crear(ruta(1200, 3), 1000, 2000, "S");
  const e = S.esfuerzo(s, ruta(900, 4));
  assert.ok(e && Math.abs(e.t - 250) <= 3, `250 s a 4 m/s (${e && e.t})`);
  assert.ok(Math.abs(e.desdeM - 1000) <= 40 && Math.abs(e.hastaM - 2000) <= 40);
  const lejos = [X.puntos({ segundos: 900, vel: 4 }).map(p => Object.assign({}, p, { lon: p.lon + 0.01 }))];
  assert.equal(S.esfuerzo(s, lejos), null);
  const corta = ruta(400, 3);
  assert.equal(S.esfuerzo(s, corta), null, "no llega al fin");
  const alReves = [ruta(900, 4)[0].slice().reverse().map((p, i, arr) => Object.assign({}, p, { t: arr[arr.length - 1 - i].t }))];
  assert.equal(S.esfuerzo(s, alReves), null, "en sentido contrario no cuenta");
});

test("esfuerzo: si pasa dos veces se queda el mejor; un desvío no cuenta", () => {
  const s = S.crear(ruta(1200, 3), 1000, 2000, "S");
  const ida = X.puntos({ segundos: 700, vel: 3 });
  const ult = ida[ida.length - 1];
  // Vuelve al inicio en 200 s (sin pasar por el segmento hacia el norte) y lo repite más rápido.
  const vuelta = Array.from({ length: 200 }, (_, k) => Object.assign({}, ult, { t: ult.t + (k + 1) * 1000, lat: ult.lat - (k + 1) * (ult.lat - ida[0].lat) / 200, lon: ult.lon + 0.002 }));
  const segunda = X.puntos({ segundos: 700, vel: 4, inicio: vuelta[vuelta.length - 1].t + 1000 });
  const e = S.esfuerzo(s, [ida.concat(vuelta, segunda)]);
  assert.ok(e && Math.abs(e.t - 250) <= 3, `el mejor de los dos pasos (${e && e.t})`);
  const desvio = [X.puntos({ segundos: 900, vel: 4 }).map((p, i) => Object.assign({}, p, { lon: i > 300 && i < 450 ? p.lon + 0.002 : p.lon }))];
  assert.equal(S.esfuerzo(s, desvio), null, "se fue por otra calle a mitad del segmento");
});

test("previo con la mini ruta, tabla personal y segmentos de una actividad", () => {
  const s = S.crear(ruta(1200, 3), 1000, 2000, "S");
  const mini = pts => M.codificar(M.simplificar(pts, 250).map(p => [p.lat, p.lon]), [1e5, 1e5]);
  assert.ok(S.pasaCerca({ mini: mini(ruta(900, 4)[0]) }, s));
  assert.ok(!S.pasaCerca({ mini: mini(ruta(200, 3)[0]) }, s));
  assert.ok(!S.pasaCerca({ distance: 5 }, s));
  s.esfuerzos = { a: { t: 300, inicio: 3 }, b: { t: 250, inicio: 2 }, c: { t: 300, inicio: 1 } };
  assert.deepEqual(S.tabla(s).map(e => [e.id, e.puesto]), [["b", 1], ["c", 2], ["a", 3]]);
  const otro = Object.assign({}, s, { nombre: "Otro", esfuerzos: { a: { t: 100, inicio: 3 } } });
  assert.deepEqual(S.deActividad([s, otro], "a").map(x => [x.seg.nombre, x.puesto, x.total]), [["Otro", 1, 1], ["S", 3, 3]]);
});
