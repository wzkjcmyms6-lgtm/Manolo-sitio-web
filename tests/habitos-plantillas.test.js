const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../js/habitos-plantillas.js");
const CFG = require("../js/habitos-config.js");
const C = require("../js/habitos-categorias.js");
const A = require("../js/habitos-auto.js");
const E = require("../js/habitos-engine.js");

test("plantillas válidas: 30 a 40, ids y nombres únicos, tipos, metas y frecuencias", () => {
  const L = T.LISTA;
  assert.ok(L.length >= 30 && L.length <= 40, `${L.length} plantillas`);
  assert.equal(new Set(L.map(p => p.id)).size, L.length);
  assert.equal(new Set(L.map(p => p.nombre)).size, L.length);
  const cats = new Set(Object.keys(C.DEFECTO).concat(C.SUGERIDAS.map(s => s.id)));
  L.forEach(p => {
    assert.ok(CFG.TIPOS[p.tipo], `${p.id}: tipo`);
    assert.ok(CFG.FRECUENCIAS.includes(p.freqType), `${p.id}: frecuencia`);
    assert.ok(CFG.MOMENTOS.some(m => m.id === p.timeOfDay), `${p.id}: momento`);
    assert.ok(CFG.DIFICULTADES[p.dificultad], `${p.id}: dificultad`);
    assert.ok(p.emoji && p.nombre.length <= 60, `${p.id}: emoji y nombre`);
    assert.ok(cats.has(p.cat) && (!p.alt || C.DEFECTO[p.alt]), `${p.id}: categoría`);
    if (p.tipo === "medible" || p.tipo === "tiempo") assert.ok(p.meta > 0, `${p.id}: meta`);
    if (p.tipo === "medible") assert.ok(p.unidad, `${p.id}: unidad`);
    if (p.tipo === "evitar") assert.equal(p.minima, "", `${p.id}: Evitar sin mínima`);
    if (p.freqType === "dias") assert.ok(p.days.length === 7 && p.days.some(Boolean));
    if (p.vinculo) {
      const f = A.fuente(p.vinculo);
      assert.ok(f, `${p.id}: vínculo`);
      assert.equal(!!f.evitar, p.tipo === "evitar", `${p.id}: Evitar solo con un gasto`);
      if (p.medida) assert.ok(f.medidas.some(m => m[0] === p.medida), `${p.id}: medida`);
    }
  });
  // Cada categoría de siempre tiene al menos 3.
  Object.keys(C.DEFECTO).forEach(id => assert.ok(L.filter(p => p.cat === id || (p.alt === id && !C.DEFECTO[p.cat])).length >= 3, id));
});

test("categoría de una plantilla: la sugerida si existe, si no su alternativa", () => {
  const base = C.leer({});
  const leer = T.LISTA.find(p => p.id === "leer");
  assert.equal(T.categoriaDe(leer, base), "mente");
  assert.equal(T.categoriaDe(leer, C.leer({ categorias: { lectura: { nombre: "Lectura" } } })), "lectura");
  assert.equal(T.categoriaDe(T.LISTA.find(p => p.id === "cama"), base), null);
  assert.equal(T.categoriaDe(T.LISTA.find(p => p.id === "agua"), C.leer({ categorias: { cuerpo: { archivada: true } } })), null);
});

test("buscar sin tildes, por nombre o categoría, y agrupar en tu orden", () => {
  const base = C.leer({ prefs: { areas: { dinero: "Finanzas" } } });
  assert.ok(T.buscar("biblia", base).some(p => p.id === "biblia"));
  assert.ok(T.buscar("ANOTAR", base).some(p => p.id === "gastos"));
  assert.ok(T.buscar("medita", base).some(p => p.id === "meditar"));
  assert.ok(T.buscar("finanzas", base).every(p => T.categoriaDe(p, base) === "dinero") && T.buscar("finanzas", base).length >= 4);
  assert.equal(T.buscar("", base).length, T.LISTA.length);
  assert.deepEqual(T.buscar("zzzz", base), []);
  const g = T.grupos(T.LISTA, base);
  assert.deepEqual(g.map(x => x.id), ["cuerpo", "mente", "dinero", "carrera", "bienestar", "social", null]);
  assert.equal(g.reduce((s, x) => s + x.items.length, 0), T.LISTA.length);
});

test("de plantilla a formulario: listo para guardar y el motor lo entiende", () => {
  const base = C.leer({});
  T.LISTA.forEach(p => {
    const f = T.aForm(p, base);
    const h = E.normalizar(Object.assign({ inicio: "2026-11-05", registros: {} }, f, { area: f.area, vinculo: f.vinculo || null }), "x");
    assert.equal(h.tipo, p.tipo, p.id);
    assert.equal(h.name, p.nombre);
    if (p.tipo === "medible" || p.tipo === "tiempo") assert.equal(h.meta, p.meta);
  });
  const correr = T.aForm(T.LISTA.find(p => p.id === "correr"), base);
  assert.deepEqual([correr.freqType, correr.timesPerWeek, correr.vinculo, correr.area], ["semana", 3, "running", "cuerpo"]);
});
