const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/run-compartir.js");
const X = require("./run-fixtures.js");

test("imagen tipo historia: ruta dentro de su zona, cifras y textos", () => {
  const ps = X.puntos({ segundos: 3000, vel: 3.3 }).map((p, i) => Object.assign(p, { lon: p.lon + Math.sin(i / 200) * 0.01 }));
  const doc = { titulo: "Fondo por el Prado", inicio: new Date(2026, 10, 3, 6, 42).getTime(), lugar: "Sopocachi, La Paz", distanciaM: 9900, tiempoMovS: 3000, deporte: "running" };
  const p = C.plan(doc, [ps.slice(0, 1500), ps.slice(1500)], { fondo: "transparente" });
  assert.deepEqual([p.ancho, p.alto, p.fondo], [1080, 1920, "transparente"]);
  assert.equal(p.ruta.length, 2);
  const todos = [].concat(...p.ruta);
  assert.ok(todos.every(([x, y]) => x >= 120 && x <= 960 && y >= 260 && y <= 1240), "la ruta queda en su zona");
  assert.ok(todos.length <= 1502);
  assert.deepEqual(p.inicio, p.ruta[0][0]);
  const txt = p.textos.map(t => t.t);
  assert.deepEqual(txt.slice(0, 6), ["DISTANCIA", "9,90 km", "RITMO", "5:03 /km", "TIEMPO", "50:00"]);
  assert.ok(txt.includes("Fondo por el Prado") && txt.some(t => /· 06:42 · Sopocachi, La Paz$/.test(t)) && txt.includes("Manolo"));
  assert.ok(p.textos.every(t => t.x === 540), "todo centrado");
});

test("sin ruta: solo cifras (más arriba); bici con velocidad; nombre del archivo", () => {
  const p = C.plan({ date: "2026-10-30", distance: 5, duration: 27 }, [], {});
  assert.equal(p.ruta.length, 0);
  assert.equal(p.fondo, "oscuro");
  assert.equal(p.textos[0].y, 760);
  assert.equal(p.textos[3].t, "5:24 /km");
  const b = C.plan({ date: "2026-10-30", distance: 30, duration: 60, deporte: "bicicleta" }, [], {});
  assert.deepEqual([b.textos[2].t, b.textos[3].t], ["VELOCIDAD", "30,0 km/h"]);
  assert.equal(C.nombre({ date: "2026-10-30", titulo: "Fondo" }), "2026-10-30-fondo.png");
});

test("los textos no se pisan", () => {
  const ps = X.puntos({ segundos: 600, vel: 3 });
  const p = C.plan({ titulo: "X", inicio: Date.UTC(2026, 10, 3, 11), distanciaM: 1800, tiempoMovS: 600 }, [ps], {});
  const ys = p.textos.map(t => [t.y - t.tam, t.y]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i][0] >= ys[i - 1][1] - 4, `texto ${i} encima de otro (${ys[i - 1]} / ${ys[i]})`);
  assert.ok(ys[ys.length - 1][1] <= 1920 - 20);
});
