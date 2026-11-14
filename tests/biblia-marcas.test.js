const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/biblia-marcas.js");
const I = require("../js/biblia-imagen.js");

const BORRAR = { __borrar: true };
const o = (extra) => Object.assign({ texto: "Porque de tal manera amó Dios al mundo", fecha: "2026-11-14", ahora: 1000 }, extra);

test("claves sin puntos (Firestore) y documentos raros", () => {
  assert.equal(M.clave(3, 16), "3_16");
  assert.deepEqual(M.leerClave("3_16"), { cap: 3, v: 16 });
  assert.equal(M.leerClave("John.3.16"), null);
  const d = M.normalizarDoc({ col: { "3_16": "amarillo", "3_17": "morado", "x": "verde" }, it: { "3_16": { f: true, r: "16-17", t: "x" }, "3_20": { f: false }, "3_21": "no" } });
  assert.deepEqual(d.col, { "3_16": "amarillo" }, "colores desconocidos y claves raras fuera");
  assert.deepEqual(Object.keys(d.it), ["3_16"], "un item sin estrella ni nota no cuenta");
  assert.deepEqual(M.normalizarDoc(null), { col: {}, it: {} });
});

test("resaltar y quitar el color de varios versículos", () => {
  assert.deepEqual(M.parcheColor(3, [16, 17], "verde", BORRAR), { col: { "3_16": "verde", "3_17": "verde" } });
  assert.deepEqual(M.parcheColor(3, [16], null, BORRAR), { col: { "3_16": BORRAR } });
  assert.deepEqual(M.parcheColor(3, [16], "inventado", BORRAR), { col: { "3_16": BORRAR } });
});

test("favorito: en el primer versículo, con los versículos y el texto", () => {
  assert.deepEqual(M.parcheFavorito(3, [17, 16], true, o(), BORRAR),
    { it: { "3_16": { f: true, r: "16-17", t: "Porque de tal manera amó Dios al mundo", d: "2026-11-14", ts: 1000 } } });
  assert.deepEqual(M.parcheFavorito(3, [16], false, o({ actual: { f: true, n: "" } }), BORRAR), { it: { "3_16": BORRAR } }, "sin nota: se borra el item");
  assert.deepEqual(M.parcheFavorito(3, [16], false, o({ actual: { f: true, n: "mía" } }), BORRAR), { it: { "3_16": { f: BORRAR } } }, "con nota: solo la estrella");
  assert.equal(M.parcheFavorito(3, [16], false, o(), BORRAR), null, "nada que quitar");
  assert.equal(M.parcheFavorito(3, [], true, o(), BORRAR), null);
});

test("nota: guardar, cortar a 1000 y borrar", () => {
  assert.deepEqual(M.parcheNota(3, [16, 17, 18], "  Dios me ama \\r\\n ", o(), BORRAR).it["3_16"].r, "16-18");
  assert.equal(M.parcheNota(3, [16], "x".repeat(1500), o(), BORRAR).it["3_16"].n.length, 1000);
  assert.deepEqual(M.parcheNota(3, [16], "", o({ actual: { f: true, n: "vieja" } }), BORRAR), { it: { "3_16": { n: BORRAR } } }, "con estrella: solo la nota");
  assert.deepEqual(M.parcheNota(3, [16], " ", o({ actual: { f: false, n: "vieja" } }), BORRAR), { it: { "3_16": BORRAR } });
});

test("lo que se pinta en un capítulo", () => {
  const d = M.normalizarDoc({ col: { "3_16": "amarillo", "3_17": "amarillo", "4_1": "azul" }, it: { "3_16": { f: true, r: "16-17", n: "nota" }, "4_24": { n: "otra" } } });
  const c = M.delCapitulo(d, 3);
  assert.deepEqual(c.colores, { 16: "amarillo", 17: "amarillo" });
  assert.deepEqual(c.items, [{ v: 16, nums: [16, 17], f: true, n: "nota", r: "16-17" }]);
  assert.deepEqual(M.itemDe(d, 3, [17, 16]).r, "16-17");
  assert.equal(M.itemDe(d, 3, [18]), null);
});

test("lista «Marcados»: orden de la Biblia, rangos de color y filtros", () => {
  const docs = {
    John: M.normalizarDoc({ col: { "3_16": "amarillo", "3_17": "amarillo", "3_18": "verde", "3_20": "amarillo" }, it: { "3_16": { f: true, r: "16", t: "Porque de tal manera", n: "Dios me ama" } } }),
    Ps: M.normalizarDoc({ it: { "23_1": { n: "mi pastor", r: "1-2", t: "Jehová es mi pastor" } } }),
    Gen: M.normalizarDoc({ col: { "1_1": "azul" } })
  };
  const todo = M.lista(docs, "todo");
  assert.deepEqual(todo.map(x => `${x.tipo} ${x.cita}`), [
    "color Génesis 1:1", "nota Salmos 23:1-2", "fav Juan 3:16", "color Juan 3:16-17", "color Juan 3:18", "color Juan 3:20"
  ]);
  assert.equal(todo[2].nota, "Dios me ama", "el favorito muestra su nota");
  assert.deepEqual(M.lista(docs, "fav").map(x => x.cita), ["Juan 3:16"]);
  assert.deepEqual(M.lista(docs, "nota").map(x => x.cita), ["Salmos 23:1-2", "Juan 3:16"]);
  assert.deepEqual(M.lista(docs, "amarillo").map(x => x.cita), ["Juan 3:16-17", "Juan 3:20"]);
  const n = M.cuenta(docs);
  assert.deepEqual([n.todo, n.fav, n.nota, n.amarillo, n.verde, n.azul, n.rosa], [6, 1, 2, 2, 1, 1, 0]);
  assert.deepEqual(M.favoritos(docs), [{ cita: "Juan 3:16", texto: "Porque de tal manera", libro: "John", cap: 3, versiculo: "16" }]);
  assert.equal(M.paraCopiar(" Jehová es mi pastor ", "Salmos 23:1"), "«Jehová es mi pastor» — Salmos 23:1 (RV1909)");
});

test("imagen: la letra se achica para que entre y nunca se sale", () => {
  const medir = (t, tam) => t.length * tam * 0.5;
  const corto = I.plan("Jesús lloró.", "Juan 11:35", medir);
  assert.equal(corto.tam, 72, "un versículo corto, letra grande");
  assert.equal(corto.lineas.join(" "), "«Jesús lloró.»");
  const largo = I.plan("palabra ".repeat(120), "Ester 8:9", medir);
  assert.ok(largo.tam < 50, `uno largo, letra más chica (${largo.tam})`);
  assert.ok(largo.lineas.every(l => medir(l, largo.tam) <= I.W - 2 * 96), "ninguna línea pasa del ancho");
  assert.ok(largo.y0 + (largo.lineas.length - 1) * largo.alto <= I.H - 300, "y no tapa la cita");
  const enorme = I.plan("palabra ".repeat(1500), "Salmos 119:1-176", medir);
  assert.ok(enorme.recortado && /…»$/.test(enorme.lineas[enorme.lineas.length - 1]), "muchísimo texto: se corta con …");
});
