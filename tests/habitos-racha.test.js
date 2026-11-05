// Racha que perdona (D-089): fallar un día o dos no la corta si en general
// cumples; si fallas seguido, se corta.
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/habitos-engine.js");
const CFG = require("../js/habitos-config.js");
const S = require("./habitos-sim.js");

const evalDias = (dias, extra) => {
  const h = Object.assign(S.habito("a", dias), extra);
  return E.evaluar([h], { hoy: E.addDias(S.INICIO, dias.length) }).habitos.a;
};
const fila = txt => txt.split("").map(c => c === "x"); // "xxx.xx" → cumplido / fallado

test("cada racha empieza con 1 perdón y gana otro por cada 7 días cumplidos (hasta 2)", () => {
  assert.deepEqual([CFG.RACHA.PERDON_INICIAL, CFG.RACHA.PERDON_CADA, CFG.RACHA.PERDON_MAX], [1, 7, 2]);
  let r = evalDias(fila("xx"));
  assert.deepEqual([r.perdones.guardados, r.perdones.faltan], [1, 5]);
  r = evalDias(fila("xxxxxxx"));
  assert.deepEqual([r.perdones.guardados, r.perdones.faltan], [2, 0]);
  // Un fallo usa uno; hacen falta 7 días más para reponerlo.
  r = evalDias(fila("xxxxxxxxxx.xx"));
  assert.equal(r.racha.actual, 12);
  assert.deepEqual([r.perdones.guardados, r.perdones.usados, r.perdones.faltan], [1, 1, 5]);
});

test("uno o dos fallos seguidos no cortan una racha buena; tres sí", () => {
  assert.equal(evalDias(fila("xxxxxxxxxx..xxx")).racha.actual, 13);
  const tres = evalDias(fila("xxxxxxxxxx...xx"));
  assert.equal(tres.racha.actual, 2);
  assert.equal(tres.racha.mejor, 10);
  // Recién empezada (sin días juntados) solo aguanta uno.
  assert.equal(evalDias(fila("xx..xx")).racha.actual, 2);
});

test("se adapta a cómo te comportas: ~1 fallo por semana aguanta; fallar seguido la corta", () => {
  // 1 de cada 8 días fallado, todo un año: la racha nunca se corta.
  const bien = evalDias(S.patron(7 / 8, 365));
  assert.equal(bien.racha.mejor, bien.racha.actual);
  assert.ok(bien.racha.actual > 300, `${bien.racha.actual}`);
  // 1 de cada 4: se corta seguido.
  const mal = evalDias(S.patron(0.75, 365));
  assert.ok(mal.racha.mejor < 15, `${mal.racha.mejor}`);
});

test("el día perdonado sigue siendo un fallo para el rango, el cumplimiento, el XP y los días perfectos", () => {
  const con = evalDias(fila("xxxxxxxxxx.xxx"));
  const d = con.dias[E.addDias(S.INICIO, 10)];
  assert.ok(d.perdonado && d.clase === "fallo" && !d.xp);
  assert.ok(Math.abs(E.cumplimiento(con, S.INICIO, E.addDias(S.INICIO, 13)) - 13 / 14) < 1e-9);
  assert.ok(con.rango.fuerza < evalDias(fila("xxxxxxxxxxxxxx")).rango.fuerza);
  const r = E.evaluar([S.habito("a", fila("xxxxxxxxxx.xxx"))], { hoy: E.addDias(S.INICIO, 14) });
  assert.ok(!r.diasPerfectos.some(p => p.fecha === E.addDias(S.INICIO, 10)));
});

test("semanales: un perdón por cada 4 semanas cumplidas (hasta 1)", () => {
  const semanas = patron => {
    const dias = [];
    patron.split("").forEach(c => { for (let k = 0; k < 7; k++) dias.push(c === "x" && [0, 2, 4].includes(k)); });
    return evalDias(dias, { freqType: "semana", timesPerWeek: 3 });
  };
  const r = semanas("xxxxx.xx");
  assert.equal(r.racha.actual, 7);
  assert.equal(r.semanas[5].perdonado, true);
  assert.equal(semanas("xx.x.x").racha.actual, 1); // el perdón inicial salva una; la segunda corta
});

test("Evitar no perdona: una recaída corta los días limpios", () => {
  const dias = 20;
  const registros = { [E.addDias(S.INICIO, 15)]: { e: "recaida" } };
  const r = E.evaluar([{ id: "a", tipo: "evitar", inicio: S.INICIO, registros }], { hoy: E.addDias(S.INICIO, dias) }).habitos.a;
  assert.equal(r.racha.actual, 5); // del 16 a hoy (hoy limpio cuenta en Evitar)
  assert.equal(r.racha.mejor, 15);
  assert.equal(r.perdones.aplica, false);
});
