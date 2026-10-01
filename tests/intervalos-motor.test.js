const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../js/intervalos-motor.js");

const T0 = 1_800_000_000_000;
const plan = { nombre: "Caminar y correr", intervalos: [
  { tipo: "caminar", seg: 180, texto: "Calentamiento" },
  { tipo: "correr", seg: 120 },
  { tipo: "caminar", seg: 180 },
  { tipo: "correr", seg: 120 }
] };
const s = n => T0 + n * 1000;

test("crear: descarta intervalos inválidos y exige al menos uno", () => {
  const st = I.crear({ intervalos: [{ tipo: "correr", seg: 60 }, { tipo: "volar", seg: 30 }, { tipo: "caminar", seg: 0 }] });
  assert.equal(st.plan.intervalos.length, 1);
  assert.throws(() => I.crear({ intervalos: [] }));
});

test("info: intervalo actual, siguiente, restante, % y contadores", () => {
  const st = I.iniciar(I.crear(plan), T0);
  let x = I.info(st, s(0));
  assert.equal(x.indice, 0);
  assert.equal(x.restanteS, 180);
  assert.equal(x.siguiente.tipo, "correr");
  x = I.info(st, s(200));
  assert.equal(x.indice, 1);
  assert.equal(x.restanteS, 100);
  assert.equal(x.completados, 1);
  assert.equal(x.restantes, 2);
  assert.ok(Math.abs(x.pct - 200 / 600) < 1e-9);
  x = I.info(st, s(700));
  assert.equal(x.terminado, true);
  assert.equal(x.completados, 4);
  assert.equal(x.restanteS, 0);
});

test("pausar congela la rutina; reanudar sigue donde iba", () => {
  const st = I.iniciar(I.crear(plan), T0);
  I.pausar(st, s(100));
  assert.equal(I.info(st, s(500)).transcurridoS, 100);
  I.reanudar(st, s(500));
  assert.equal(I.info(st, s(600)).transcurridoS, 200);
  assert.equal(I.info(st, s(600)).indice, 1);
});

test("avisos: inicio, cuenta atrás 3-2-1, cambio y fin", () => {
  const st = I.iniciar(I.crear(plan), T0);
  assert.deepEqual(I.avisos(st, null, s(0)).map(a => a.tipo), ["cambio"], "aviso del primer intervalo");
  const cerca = I.avisos(st, s(176), s(178)).map(a => `${a.tipo}${a.n || ""}`);
  assert.deepEqual(cerca, ["cuenta3", "cuenta2"]);
  const cambio = I.avisos(st, s(178), s(180));
  assert.deepEqual(cambio.map(a => `${a.tipo}${a.n || ""}`), ["cuenta1", "cambio"]);
  assert.equal(cambio[1].indice, 1);
  const fin = I.avisos(st, s(598), s(601)).map(a => a.tipo);
  assert.deepEqual(fin, ["cuenta", "fin"]);
  assert.deepEqual(I.avisos(st, s(602), s(603)), [], "después del fin no hay más avisos");
});

test("si la app estuvo congelada no recita avisos viejos: dice dónde va", () => {
  const st = I.iniciar(I.crear(plan), T0);
  const av = I.avisos(st, s(10), s(250));
  assert.deepEqual(av, [{ tipo: "estado", indice: 1, en: 250000 }]);
  assert.equal(I.textoAviso(st, av[0]), "Ahora: correr durante 2 minutos.");
  assert.deepEqual(I.avisos(st, s(10), s(900)).map(a => a.tipo), ["fin"]);
});

test("textos para la voz", () => {
  const st = I.crear(plan);
  assert.equal(I.textoAviso(st, { tipo: "cambio", indice: 0 }), "Empezamos: caminar durante 3 minutos.");
  assert.equal(I.textoAviso(st, { tipo: "cambio", indice: 1 }), "Siguiente intervalo: correr durante 2 minutos.");
  assert.equal(I.textoAviso(st, { tipo: "fin" }), "Rutina terminada. ¡Buen trabajo!");
  assert.equal(I.duracionHablada(90), "1 minuto y 30 segundos");
  assert.equal(I.duracionHablada(45), "45 segundos");
  assert.equal(I.duracionHablada(61), "1 minuto y 1 segundo");
});

test("intervalos cortos (≤ 5 s) no llevan cuenta atrás", () => {
  const st = I.iniciar(I.crear({ intervalos: [{ tipo: "correr", seg: 5 }, { tipo: "caminar", seg: 60 }] }), T0);
  assert.deepEqual(I.avisos(st, s(0), s(5)).map(a => a.tipo), ["cambio"]);
});
