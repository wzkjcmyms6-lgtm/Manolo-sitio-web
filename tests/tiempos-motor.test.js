const test = require("node:test");
const assert = require("node:assert");
const T = require("../js/tiempos-motor.js");

const docsDe = obj => Object.fromEntries(Object.entries(obj).map(([f, seg]) => [f, { fecha: f, seg }]));
// n días seguidos desde `desde` con el mismo tiempo para `id`.
function seguidos(id, desde, n, seg) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(desde + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    out[d.toISOString().slice(0, 10)] = { [id]: typeof seg === "function" ? seg(i) : seg };
  }
  return out;
}

test("seis actividades, tope de 30", () => {
  assert.deepStrictEqual(T.ACTIVIDADES.map(a => a.id), ["manana", "ejercicio", "correr", "desayunar", "banarse", "leer"]);
  assert.match(T.ACTIVIDADES[0].detalle, /scalping, rezar, decretar y tender la cama/);
  assert.strictEqual(T.LIMITE, 30);
});

test("leer: minutos y segundos", () => {
  assert.deepStrictEqual(T.leer("25", "30"), { seg: 1530 });
  assert.deepStrictEqual(T.leer("25", ""), { seg: 1500 });
  assert.deepStrictEqual(T.leer("", "45"), { seg: 45 });
  assert.deepStrictEqual(T.leer(" ", ""), { seg: null });
  assert.ok(T.leer("0", "0").error);
  assert.ok(T.leer("5", "60").error);
  assert.ok(T.leer("2,5", "").error);
  assert.ok(T.leer("601", "").error);
  assert.deepStrictEqual(T.campos(1530), { min: "25", seg: "30" });
  assert.deepStrictEqual(T.campos(1500), { min: "25", seg: "" });
  assert.deepStrictEqual(T.campos(undefined), { min: "", seg: "" });
});

test("texto", () => {
  assert.strictEqual(T.texto(45), "45 s");
  assert.strictEqual(T.texto(1500), "25 min");
  assert.strictEqual(T.texto(1530), "25 min 30 s");
  assert.strictEqual(T.texto(3600), "1 h");
  assert.strictEqual(T.texto(3900), "1 h 05 min");
  assert.strictEqual(T.texto(7170), "2 h");
  assert.strictEqual(T.texto(null), "—");
});

test("dias: ordena, ignora vacíos y valores raros", () => {
  const ds = T.dias({
    "2026-10-28": { fecha: "2026-10-28", seg: { manana: 1800, leer: 0, correr: "x" } },
    "2026-10-27": { fecha: "2026-10-27", seg: { ejercicio: 3600.4 } },
    "2026-10-26": { fecha: "2026-10-26", seg: {} },
    "malo": { seg: { manana: 10 } }
  });
  assert.deepStrictEqual(ds, [{ fecha: "2026-10-27", seg: { ejercicio: 3600 } }, { fecha: "2026-10-28", seg: { manana: 1800 } }]);
});

test("estado: promedio y cierre a los 30", () => {
  const ds = T.dias(docsDe(seguidos("manana", "2026-09-01", 29, i => 1500 + i * 10)));
  let e = T.estado(ds);
  assert.strictEqual(e.manana.n, 29);
  assert.strictEqual(e.manana.faltan, 1);
  assert.strictEqual(e.manana.completa, false);
  assert.strictEqual(e.manana.promedio, 1640);
  assert.strictEqual(e.correr.n, 0);
  assert.strictEqual(e.correr.promedio, null);
  assert.strictEqual(T.bloqueada(ds, "manana", "2026-10-30"), false);

  const ds30 = T.dias(docsDe(seguidos("manana", "2026-09-01", 31, i => (i < 30 ? 1500 + i * 10 : 9999))));
  e = T.estado(ds30);
  assert.strictEqual(e.manana.n, 30);
  assert.strictEqual(e.manana.completa, true);
  assert.strictEqual(e.manana.promedio, 1645, "el día 31 (si llegó de otro aparato) no cuenta");
  assert.strictEqual(T.bloqueada(ds30, "manana", "2026-10-15"), true, "un día nuevo ya no se puede anotar");
  assert.strictEqual(T.bloqueada(ds30, "manana", "2026-09-05"), false, "un registro que cuenta se puede corregir");
  assert.strictEqual(T.bloqueada(ds30, "manana", "2026-10-01"), true, "el día 31 no cuenta: tampoco se edita");
  assert.strictEqual(T.bloqueada(ds30, "leer", "2026-10-15"), false, "las otras actividades siguen");
});

test("semana de lunes a domingo y mes", () => {
  assert.strictEqual(T.lunes("2026-10-28"), "2026-10-26");
  assert.strictEqual(T.lunes("2026-11-01"), "2026-10-26");
  assert.strictEqual(T.lunes("2026-10-26"), "2026-10-26");
  assert.deepStrictEqual(T.rango("semana", "2026-10-28"), { desde: "2026-10-26", hasta: "2026-11-01" });
  assert.deepStrictEqual(T.rango("mes", "2026-02-10"), { desde: "2026-02-01", hasta: "2026-02-28" });
  assert.strictEqual(T.mover("semana", "2026-10-28", -1), "2026-10-19");
  assert.strictEqual(T.mover("mes", "2026-01-31", -1), "2025-12-01");
  assert.strictEqual(T.mover("mes", "2026-12-15", 1), "2027-01-01");
});

test("periodo: promedios de la semana y del mes", () => {
  const ds = T.dias(docsDe({
    "2026-10-19": { manana: 2000 },
    "2026-10-26": { manana: 1800, correr: 1500 },
    "2026-10-28": { manana: 1600, correr: 1700 },
    "2026-11-01": { manana: 1400 },
    "2026-11-02": { manana: 1000 }
  }));
  const s = T.periodo(ds, "semana", "2026-10-28", "2026-10-28");
  assert.strictEqual(s.titulo, "26 oct – 1 nov");
  assert.strictEqual(s.enCurso, true);
  assert.deepStrictEqual(s.act.manana, { n: 3, promedio: 1600 });
  assert.deepStrictEqual(s.act.correr, { n: 2, promedio: 1600 });
  assert.deepStrictEqual(s.act.leer, { n: 0, promedio: null });
  const m = T.periodo(ds, "mes", "2026-10-28", "2026-10-28");
  assert.strictEqual(m.titulo, "Octubre 2026");
  assert.deepStrictEqual(m.act.manana, { n: 3, promedio: 1800 });
  const antes = T.periodo(ds, "semana", T.mover("semana", "2026-10-28", -1), "2026-10-28");
  assert.strictEqual(antes.enCurso, false);
  assert.deepStrictEqual(antes.act.manana, { n: 1, promedio: 2000 });
  const despues = T.periodo(ds, "semana", T.mover("semana", "2026-10-28", 1), "2026-10-28");
  assert.strictEqual(despues.futuro, true);
  assert.strictEqual(T.periodo(ds, "semana", "2027-01-04", "2026-10-28").titulo, "4 ene – 10 ene 2027");
});

test("periodo: solo cuentan los primeros 30", () => {
  const ds = T.dias(docsDe(seguidos("leer", "2026-09-01", 32, i => (i < 30 ? 1200 : 6000))));
  const oct = T.periodo(ds, "mes", "2026-10-01", "2026-10-02");
  assert.deepStrictEqual(oct.act.leer, { n: 0, promedio: null });
});

test("fechaLarga", () => {
  assert.strictEqual(T.fechaLarga("2026-10-28"), "mié 28 de octubre");
});

test("total de cada día y promedio de los días", () => {
  const ds = T.dias(docsDe({
    "2026-10-26": { manana: 1800, correr: 1500 },   // 55 min
    "2026-10-27": { leer: 1200 },                    // 20 min
    "2026-10-28": { manana: 1500, desayunar: 600, leer: 900 }  // 50 min
  }));
  assert.equal(T.totalDia(ds[0]), 3300);
  assert.equal(T.totalDia({ seg: {} }), 0);
  assert.deepEqual(T.promedioDias(ds), { dias: 3, promedio: 2500 });
  assert.deepEqual(T.promedioDias(ds, "2026-10-27", "2026-10-28"), { dias: 2, promedio: 2100 });
  assert.deepEqual(T.promedioDias([]), { dias: 0, promedio: null });
  const s = T.periodo(ds, "semana", "2026-10-28", "2026-10-28");
  assert.deepEqual(s.dias, { dias: 3, promedio: 2500 });
  assert.deepEqual(T.periodo(ds, "semana", "2026-10-19", "2026-10-28").dias, { dias: 0, promedio: null });
});

