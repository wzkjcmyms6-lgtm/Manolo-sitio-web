const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../js/run-inteligencia.js");
const M = require("../js/run-metricas.js");

// Ruta: n puntos desde (lat0, lon0) hacia el norte cada `paso` grados, con un desvío opcional.
const mini = (lat0, lon0, n, paso, desvio) => M.codificar(Array.from({ length: n }, (_, i) => [lat0 + i * paso, lon0 + (desvio ? desvio(i) : 0)]), [1e5, 1e5]);
const BASE = mini(-16.5, -68.13, 50, 0.0009); // ~5 km al norte
const run = (id, dia, seg, extra) => Object.assign({ id, date: `2026-10-${String(dia).padStart(2, "0")}`, inicio: Date.UTC(2026, 9, dia, 11), distanciaM: 5000, distance: 5, tiempoMovS: seg, duration: seg / 60, mini: BASE }, extra);

test("mismo recorrido: inicio, fin, distancia y forma", () => {
  const a = run("a", 1, 1500), b = run("b", 5, 1450), c = run("c", 9, 1520);
  const otraDist = run("d", 10, 1500, { distanciaM: 5600 });
  const otroInicio = run("e", 11, 1500, { mini: mini(-16.503, -68.13, 50, 0.0009) });
  const otraForma = run("f", 12, 1500, { mini: mini(-16.5, -68.13, 50, 0.0009, i => (i > 10 && i < 40 ? 0.004 : 0)) });
  const alReves = run("g", 13, 1500, { mini: M.codificar(Array.from({ length: 50 }, (_, i) => [-16.5 + (49 - i) * 0.0009, -68.13]), [1e5, 1e5]) });
  const r = I.mismoRecorrido(b, [a, b, c, otraDist, otroInicio, otraForma, alReves]);
  assert.equal(r.veces, 3);
  assert.deepEqual(r.lista.map(x => x.id), ["c", "b", "a"]);
  assert.equal(r.puesto, 1);
  assert.equal(r.mejor.id, "b");
  assert.equal(I.mismoRecorrido(otraDist, [a, otraDist]), null);
  assert.equal(I.mismoRecorrido({ id: "x", distance: 5 }, [a]), null, "sin ruta no hay recorrido");
  assert.ok(I.parecidas(a, run("h", 14, 1500, { distanciaM: 5200 })), "±5 % de distancia");
});

test("resumen: nueva mejor marca, recorrido repetido, ritmo contra el promedio y semana", () => {
  const prev = [run("a", 1, 1560, { mejores: { "5000": 1560 } }), run("b", 10, 1530, { mejores: { "5000": 1530 } }), run("c", 20, 1545, { mejores: { "5000": 1545 } })];
  const hoy = run("h", 27, 1470, { date: "2026-10-27", mejores: { "5000": 1470, "1000": 280 } });
  const f = I.resumen(hoy, prev.concat([hoy]));
  assert.ok(f.length >= 2 && f.length <= 4, `2 a 4 frases (${f.length})`);
  assert.equal(f[0], "Nueva mejor marca en 5K: 24:30, 1:00 menos que la anterior.");
  assert.ok(f.some(x => x === "Hiciste este recorrido 4 veces y hoy fue tu mejor tiempo."), f.join(" | "));
  assert.ok(f.some(x => /^Ritmo de 4:54 \/km: 15 s\/km más rápido que tu promedio del último mes/.test(x)), f.join(" | "));
});

test("resumen: parciales, desnivel, zonas y siempre al menos dos frases", () => {
  const sp = s => s.map(tm => ({ d: 1000, tm }));
  const neg = run("n", 3, 1500, { splits: sp([310, 305, 300, 290, 285, 280]), mini: null });
  assert.ok(I.resumen(neg, [neg]).some(x => /^Segunda mitad más rápida que la primera/.test(x)));
  const parejo = run("p", 3, 1500, { splits: sp([300, 302, 305, 301, 299]), mini: null });
  assert.ok(I.resumen(parejo, [parejo]).some(x => x === "Ritmo muy parejo: todos los km entre 4:59 y 5:05 /km."));
  const cerro = run("q", 3, 1800, { desnivelPosM: 320, gapS: 300, zonas: [0, 100, 1200, 300, 0], mini: null });
  const f = I.resumen(cerro, [cerro]);
  assert.ok(f.some(x => x === "Con 320 m de desnivel; en llano equivaldría a 5:00 /km."), f.join(" | "));
  assert.ok(f.some(x => x === "Pasaste el 75 % del tiempo en la zona 3 de FC."), f.join(" | "));
  const simple = { id: "s", date: "2026-10-03", distance: 5, duration: 30 };
  assert.deepEqual(I.resumen(simple, [simple]), ["5,00 km en 30:00 (6:00 /km).", "Primera carrera de la semana: 5,00 km."]);
  assert.ok(I.resumen(simple, [simple]).every(x => !/descans|recuper|lesi|médic|salud/i.test(x)), "sin consejos de salud");
});
