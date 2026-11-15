// Medir tiempos: estadísticas, línea base y experimentos (js/tiempos-stats.js, D-114).
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/tiempos-stats.js");

const HOY = "2026-11-16";   // lunes
const sumar = (f, n) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// n días seguidos hasta `hasta` con seg(i, fecha) para `id` (null = ese día no).
function dias(id, hasta, n, seg) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = sumar(hasta, -(n - 1 - i)), v = seg(i, f);
    if (v) out.push({ fecha: f, seg: { [id]: v } });
  }
  return out;
}

test("mediana y promedio", () => {
  assert.deepEqual([S.mediana([3, 1, 2]), S.mediana([4, 1, 3, 2]), S.mediana([]), S.media([1, 2]), S.media([])], [2, 3, null, 2, null]);
});

test("una actividad: promedio, mediana, mejor, peor, tendencia y semana contra fin de semana", () => {
  // 60 días: los 30 de antes a 1500 s; los últimos 30, a 1200 s (más rápido); el sábado y domingo, 1800.
  const ds = dias("banarse", HOY, 60, (i, f) => {
    const dow = new Date(f + "T12:00:00Z").getUTCDay();
    if (dow === 0 || dow === 6) return 1800;
    return i < 30 ? 1500 : 1200;
  });
  const a = S.actividad(ds, "banarse", HOY);
  assert.equal(a.n, 60);
  assert.equal(a.mejor.seg, 1200);
  assert.equal(a.peor.seg, 1800);
  assert.equal(a.tendencia.sentido, "mejor", "menos tiempo es mejor");
  assert.ok(a.tendencia.cambio < -5 && a.tendencia.ahora < a.tendencia.antes);
  assert.equal(a.semana.finde.promedio, 1800);
  assert.ok(a.semana.laborables.promedio < 1500);
  assert.equal(S.actividad(ds, "otra", HOY), null);
  const pocos = S.actividad(dias("x", HOY, 4, () => 600), "x", HOY);
  assert.equal(pocos.tendencia, null, "sin 3 registros en cada lado no hay tendencia");
  assert.deepEqual(Object.keys(S.estadisticas(ds, [{ id: "banarse" }, { id: "otra" }], HOY)), ["banarse"]);
});

test("el total de tu mañana por día", () => {
  const ds = [
    { fecha: "2026-11-14", seg: { manana: 1500, desayunar: 900, leer: 1800 } },
    { fecha: "2026-11-15", seg: { leer: 1200 } },
    { fecha: "2026-11-16", seg: { manana: 1400 } }
  ];
  assert.deepEqual(S.mananaPorDia(ds, ["manana", "desayunar"]), [{ fecha: "2026-11-14", total: 2400 }, { fecha: "2026-11-16", total: 1400 }], "solo los pasos de la mañana; días sin ninguno no cuentan");
});

test("línea base (primeros 30) y un experimento que la compara", () => {
  // 30 días de línea base a 1500 s; después un experimento desde el 20 de oct, a 1200 s.
  const base = dias("manana", "2026-10-15", 30, () => 1500);
  const exp = dias("manana", "2026-11-16", 28, () => 1200);
  const ds = base.concat(exp);
  const lb = S.lineaBase(ds, "manana");
  assert.deepEqual([lb.n, lb.completa, lb.mediana, lb.desde, lb.hasta], [30, true, 1500, "2026-09-16", "2026-10-15"]);
  const e = S.experimento(ds, { nombre: "Ropa lista la noche anterior", desde: "2026-10-20" }, [{ id: "manana" }]);
  const m = e.act.manana;
  assert.deepEqual([m.n, m.completa, m.mediana, m.base.mediana, m.diferencia, m.pct], [28, false, 1200, 1500, -300, -20], "5 min menos (20 % más rápido)");
  assert.equal(e.terminado, false, "le faltan registros");
  const fin = S.experimento(ds, { nombre: "x", desde: "2026-10-20", hasta: "2026-11-10" }, [{ id: "manana" }]);
  assert.equal(fin.terminado, true, "lo terminaste antes");
  assert.equal(fin.act.manana.n, 22);
  // Un experimento que empieza antes de completar la línea base: compara con lo de antes.
  const temprano = S.experimento(ds, { nombre: "y", desde: "2026-10-01" }, [{ id: "manana" }]);
  assert.equal(temprano.act.manana.base.n, 15, "solo los días antes de que empezara");
});

test("validar un experimento nuevo", () => {
  assert.equal(S.validarExperimento({ nombre: "", desde: HOY }, HOY).error, "Ponle un nombre (qué cambiaste).");
  assert.equal(S.validarExperimento({ nombre: "x", desde: "2026-11-20" }, HOY).error, "No puede empezar en el futuro.");
  assert.deepEqual(S.validarExperimento({ nombre: "  Café antes  ", desde: HOY, nota: "a" }, HOY).doc, { nombre: "Café antes", desde: HOY, nota: "a", hasta: null });
});

test("QA fase 8 (D-115): con 3 años de datos, mismos números que contando a mano, y rápido", () => {
  // 1.095 días con huecos, de una actividad.
  const ds = dias("manana", HOY, 1095, (i, f) => (i % 9 === 0 ? null : 1200 + ((i * 37) % 600)));
  const rs = ds.filter(d => d.seg.manana).map(d => ({ fecha: d.fecha, seg: d.seg.manana }));
  const media = xs => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  const hace = n => sumar(HOY, -n);
  const ult = rs.filter(r => r.fecha > hace(30) && r.fecha <= HOY).map(r => r.seg);
  const ant = rs.filter(r => r.fecha > hace(60) && r.fecha <= hace(30)).map(r => r.seg);
  const dow = f => new Date(f + "T12:00:00Z").getUTCDay();
  const lab = rs.filter(r => dow(r.fecha) >= 1 && dow(r.fecha) <= 5).map(r => r.seg);
  const finde = rs.filter(r => dow(r.fecha) === 0 || dow(r.fecha) === 6).map(r => r.seg);
  const t0 = Date.now();
  const x = S.actividad(ds, "manana", HOY);
  const ms = Date.now() - t0;
  assert.equal(x.n, rs.length);
  assert.deepEqual([x.tendencia.antes, x.tendencia.ahora], [media(ant), media(ult)]);
  assert.deepEqual([x.semana.laborables.n, x.semana.laborables.promedio, x.semana.finde.n, x.semana.finde.promedio], [lab.length, media(lab), finde.length, media(finde)]);
  assert.ok(ms < 100, `actividad() con 3 años tardó ${ms} ms`);
});

