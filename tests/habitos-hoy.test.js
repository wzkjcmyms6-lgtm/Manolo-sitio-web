const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("../js/habitos-hoy.js");
const C = require("../js/habitos-categorias.js");

const cats = C.leer({ prefs: { areas: { bienestar: "Paz" } }, categorias: { fe: { nombre: "Fe", emoji: "🙏", color: "indigo" } } });
const it = (id, area, timeOfDay, extra) => Object.assign({ id, area, timeOfDay, despuesDe: null, hora: "", hecho: false }, extra);
const lista = [
  it("agua", "cuerpo", "manana", { hecho: true }),
  it("meditar", "bienestar", "manana", { hecho: true }),
  it("orar", "fe", "noche", { despuesDe: "meditar" }), // cadena: va con Meditar
  it("correr", "cuerpo", "tarde"),
  it("leer", "mente", "noche"),
  it("estirar", null, "tarde"),
  it("raro", "borrada", "cualquiera"),
  it("azucar", "cuerpo", "cualquiera", { cuenta: false }) // Evitar: no cuenta en el progreso
];
const ids = g => g.items.map(x => x.id);

test("agrupar por momento: el actual primero y las cadenas con su primer eslabón", () => {
  const g = H.grupos(lista, { agrupar: "momento", momento: "tarde", categorias: cats });
  assert.deepEqual(g.map(x => x.id), ["tarde", "cualquiera", "manana", "noche"]);
  assert.deepEqual([g[1].hechos, g[1].total, g[1].items.length], [0, 1, 2]);
  assert.equal(g[0].ahora, true);
  assert.deepEqual(ids(g.find(x => x.id === "manana")), ["agua", "meditar", "orar"]);
  assert.deepEqual(ids(g.find(x => x.id === "noche")), ["leer"]);
  assert.deepEqual([g[2].hechos, g[2].total], [2, 3]);
});

test("agrupar por categoría: en el orden de las categorías y «Sin categoría» al final", () => {
  const g = H.grupos(lista, { agrupar: "categoria", categorias: cats });
  assert.deepEqual(g.map(x => x.id), ["cuerpo", "mente", "bienestar", H.SIN]);
  // Orar es de Fe, pero va en el grupo de su primer eslabón (Meditar, Paz).
  assert.deepEqual(ids(g.find(x => x.id === "bienestar")), ["meditar", "orar"]);
  assert.equal(g.find(x => x.id === "bienestar").nombre, "Paz");
  assert.equal(g.find(x => x.id === "cuerpo").color, "coral");
  assert.deepEqual(ids(g.find(x => x.id === H.SIN)), ["estirar", "raro"]); // sin categoría o borrada
  assert.deepEqual([g[0].hechos, g[0].total, g[0].items.length], [1, 2, 3]);
});

test("filtrar por una categoría usa la del propio hábito", () => {
  const fe = H.grupos(lista, { agrupar: "momento", filtro: "fe", momento: "manana", categorias: cats });
  assert.deepEqual(fe.map(g => [g.id, ids(g)]), [["noche", ["orar"]]]);
  const sin = H.grupos(lista, { agrupar: "categoria", filtro: H.SIN, categorias: cats });
  assert.deepEqual(sin.map(g => ids(g)), [["estirar", "raro"]]);
});

test("ocultar hechos: se van de la lista pero el progreso del grupo los cuenta", () => {
  const g = H.grupos(lista, { agrupar: "momento", momento: "manana", ocultarHechos: true, categorias: cats });
  const man = g.find(x => x.id === "manana");
  assert.deepEqual(ids(man), ["orar"]);
  assert.deepEqual([man.hechos, man.total], [2, 3]);
});

test("chips de filtro con pendientes por categoría", () => {
  const f = H.filtros(lista, cats);
  assert.deepEqual(f.map(x => [x.id, x.pendientes]), [[null, 5], ["cuerpo", 1], ["mente", 1], ["bienestar", 0], ["fe", 1], [H.SIN, 2]]);
  // Sin ninguna categoría usada, no aparece «Sin categoría» sola.
  assert.deepEqual(H.filtros([it("a", null, "manana")], cats).map(x => x.id), [null]);
});

test("hora opcional: ordena dentro del grupo sin romper las cadenas", () => {
  const items = [it("a", "cuerpo", "manana"), it("b", "cuerpo", "manana", { hora: "06:30" }), it("c", "cuerpo", "manana", { despuesDe: "b" }), it("d", "cuerpo", "manana", { hora: "05:45" }), it("e", "cuerpo", "manana", { hora: "25:00" })];
  assert.deepEqual(ids(H.grupos(items, { momento: "manana" })[0]), ["d", "b", "c", "a", "e"]);
  assert.equal(H.hora("7:00"), "");
  assert.equal(H.hora("07:00"), "07:00");
});

test("pendientes del momento (para el aviso)", () => {
  assert.equal(H.pendientesMomento(lista, "noche"), 1);
  assert.equal(H.pendientesMomento(lista, "manana"), 1); // Orar va con Meditar
  assert.equal(H.pendientesMomento(lista, "tarde"), 2);
});
