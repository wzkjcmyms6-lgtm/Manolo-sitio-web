const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/run-analisis.js");

const HOY = "2026-11-04"; // miércoles
const c = (id, date, km, min, extra) => Object.assign({ id, date, distance: km, duration: min }, extra);

test("períodos: semana (lunes a domingo), mes, año y total, con el anterior", () => {
  const docs = [c("a", "2026-11-02", 10, 60, { desnivelPosM: 100 }), c("b", "2026-11-04", 5, 30), c("x", "2026-11-05", 99, 1),
    c("p", "2026-10-28", 8, 50), c("o", "2026-10-01", 12, 70), c("y", "2025-06-01", 21, 120)];
  const s = A.periodo(docs, "semana", HOY);
  assert.deepEqual([s.desde, s.hasta, s.km, s.seg, s.n, s.desnivel], ["2026-11-02", "2026-11-08", 114, 5460, 3, 100]);
  assert.deepEqual([s.previo.desde, s.previo.km, s.previo.n], ["2026-10-26", 8, 1]);
  const m = A.periodo(docs, "mes", HOY);
  assert.deepEqual([m.desde, m.hasta, m.km, m.previo.km, m.previo.n], ["2026-11-01", "2026-11-30", 114, 20, 2]);
  const y = A.periodo(docs, "anio", HOY);
  assert.deepEqual([y.km, y.previo.km], [134, 21]);
  const t = A.periodo(docs, "total", HOY);
  assert.deepEqual([t.km, t.n, t.previo], [155, 6, undefined]);
  assert.equal(A.periodo([c("i", "2026-11-03", 0, 0, { distanciaM: 10020, tiempoMovS: 3300 })], "semana", HOY).km, 10.02, "importadas: metros y segundos exactos");
});

test("calendario del mes: primer día en su columna y km por día", () => {
  const cal = A.calendario([c("a", "2026-11-02", 10, 60), c("b", "2026-11-02", 3, 20), c("z", "2026-10-31", 5, 30)], "2026-11");
  assert.equal(cal.dias.length, 30);
  assert.equal(cal.inicioSemana, 6, "1 de noviembre de 2026 es domingo");
  assert.deepEqual([cal.dias[1].km, cal.dias[1].ids, cal.max], [13, ["a", "b"], 13]);
  assert.equal(A.calendario([], "2026-02").dias.length, 28);
});

test("mejores marcas: top 3 y evolución de la mejor", () => {
  const d = (id, dia, t) => ({ id, date: `2026-10-${String(dia).padStart(2, "0")}`, inicio: Date.UTC(2026, 9, dia), mejores: { "5000": t } });
  const docs = [d("a", 1, 1500), d("b", 5, 1520), d("e", 9, 1450), d("f", 20, 1480)];
  assert.deepEqual(A.topMarcas(docs, "5000").map(x => x.id), ["e", "f", "a"]);
  assert.deepEqual(A.evolucion(docs, "5000").map(x => [x.id, x.mejor]), [["a", 1500], ["b", 1500], ["e", 1450], ["f", 1450]]);
});

test("predicciones (Riegel): desde marcas recientes de al menos 1 milla; si no, faltan datos", () => {
  const docs = [{ id: "a", date: "2026-10-20", inicio: Date.UTC(2026, 9, 20), mejores: { "1000": 230, "1609": 380, "5000": 1250, "10000": 2600 } }];
  const p = A.predicciones(docs, HOY);
  assert.deepEqual(p.map(x => x.clave), ["5000", "10000", "21097", "42195"]);
  assert.equal(p[0].t, Math.round(Math.min(1250 * Math.pow(5000 / 5000, 1.06), 380 * Math.pow(5000 / 1609.344, 1.06), 2600 * Math.pow(0.5, 1.06))));
  assert.equal(p[3].desde.clave, "10000", "el maratón solo desde 10K (≥ 1/8)");
  assert.equal(p[3].t, Math.round(2600 * Math.pow(4.2195, 1.06)));
  const viejas = [{ id: "v", date: "2026-01-01", inicio: Date.UTC(2026, 0, 1), mejores: { "5000": 1300 } }];
  assert.ok(A.predicciones(viejas, HOY).every(x => x.t == null), "más de 12 semanas: faltan datos");
  assert.ok(A.predicciones([{ id: "k", date: "2026-11-01", inicio: Date.UTC(2026, 10, 1), mejores: { "1000": 240 } }], HOY).every(x => x.t == null), "con solo 1 km no se predice");
});

test("forma y fatiga: medias de 42 y 7 días; carga por RPE si no hay otra", () => {
  assert.equal(A.cargaDe({ carga: { v: 80, m: "trimp" } }), 80);
  assert.equal(A.cargaDe({ rpe: 8, duration: 60 }), 100);
  assert.equal(A.cargaDe({ distance: 5, duration: 30 }), 0);
  const docs = [];
  for (let i = 0; i < 50; i++) { const d = new Date(2026, 8, 6 + i); docs.push({ id: `d${i}`, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, carga: { v: 50 } }); }
  const f = A.formaFatiga(docs, HOY, 90);
  assert.equal(f.length, 90);
  assert.equal(f[f.length - 1].fecha, HOY);
  const ult = f[f.length - 1];
  assert.ok(ult.fatiga < ult.estado, "días sin correr al final: baja más rápido la fatiga");
  assert.ok(ult.forma > 0);
  const pico = f.find(x => x.fecha === "2026-10-25");
  assert.ok(pico.estado > 25 && pico.estado < 50);
  assert.match(A.textoForma(ult.forma, ult.estado), /Descansado|equilibrio/);
  assert.equal(A.textoForma(0, 0), "Todavía no hay carga registrada.");
  assert.deepEqual(A.formaFatiga([], HOY, 7).map(x => x.estado), [0, 0, 0, 0, 0, 0, 0]);
});

test("metas, racha de semanas y zapatillas", () => {
  const docs = [c("a", "2026-11-02", 10, 60, { zapatillaId: "z1" }), c("b", "2026-10-27", 5, 30, { zapatillaId: "z1" }), c("d", "2026-10-20", 8, 40), c("e", "2026-10-06", 8, 40)];
  const m = A.metas(docs, HOY, { semanaKm: 20, mesKm: 0, anioKm: 1000 });
  assert.deepEqual(m.map(x => [x.tipo, x.km, x.pct]), [["semana", 10, 0.5], ["anio", 31, 0.031]]);
  assert.deepEqual(A.racha(docs, HOY), { semanas: 3, estaSemana: true });
  assert.deepEqual(A.racha(docs, "2026-11-09"), { semanas: 3, estaSemana: false }, "el lunes siguiente la racha sigue viva");
  assert.deepEqual(A.racha(docs, "2026-11-16"), { semanas: 0, estaSemana: false });
  const z = A.zapatillas(docs, [{ id: "z1", nombre: "Pegasus", kmInicial: 620, limiteKm: 700 }, { id: "z2", nombre: "Vieja", kmInicial: 800, retirada: true }, { id: "z3", nombre: "Nueva" }]);
  assert.deepEqual(z.map(x => [x.km, x.n, x.estado]), [[635, 2, "pronto"], [800, 0, "retirada"], [0, 0, "ok"]]);
  assert.equal(z[0].ultima, "2026-11-02");
  assert.equal(A.zapatillas(docs, [{ id: "z1", kmInicial: 700 }])[0].estado, "cambiar");
  assert.equal(A.ritmoUmbralSugerido([{ id: "a", mejores: { "10000": 2700 } }]), 270);
  assert.equal(A.ritmoUmbralSugerido([]), 330);
});
