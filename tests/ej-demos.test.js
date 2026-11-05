// Demos de los ejercicios (js/ej-demos.js) y la base: cada ejercicio con
// demo tiene sus 2 imágenes WebP en el repo (scripts/build-demos.mjs).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const D = require("../js/ej-demos.js");
const DATA = require("../data/ejercicios.json");

const RAIZ = path.join(__dirname, "..");

test("rutas: inicio y final en WebP, con versión", () => {
  assert.deepStrictEqual(D.rutas("barbell-squat"), [
    `img/ejercicios/barbell-squat/0.webp?v=${D.VERSION}`,
    `img/ejercicios/barbell-squat/1.webp?v=${D.VERSION}`
  ]);
});

test("solo tienen demo los ejercicios con demo: 1", () => {
  assert.strictEqual(D.tieneDemo({ id: "x", demo: 1 }), true);
  assert.strictEqual(D.tieneDemo({ id: "manolo-correr" }), false);
  assert.strictEqual(D.tieneDemo(null), false);
  assert.strictEqual(D.html({ id: "manolo-correr", nombre: "Correr" }), "");
  const h = D.html({ id: "barbell-squat", nombre: "Sentadilla (Barra)", demo: 1 });
  assert.match(h, /0\.webp/);
  assert.match(h, /1\.webp/);
  assert.match(h, /data-demo-pausa/);
  assert.match(h, /dominio público/);
});

test("precarga: los ejercicios con demo de tus rutinas, sin repetir", () => {
  const base = { a: { id: "a", demo: 1 }, b: { id: "b" }, c: { id: "c", demo: 1 } };
  const rutinas = [
    { items: [{ nombre: "A", exerciseId: "a" }, { nombre: "B", exerciseId: "b" }] },
    { items: [{ nombre: "A otra vez", exerciseId: "a" }, { nombre: "C", exerciseId: "c" }, { nombre: "Sin reconocer" }] }
  ];
  assert.deepStrictEqual(D.idsDeRutinas(rutinas, it => base[it.exerciseId] || null), ["a", "c"]);
  assert.deepStrictEqual(D.idsDeRutinas([], () => null), []);
});

test("la base: cada ejercicio con demo tiene sus 2 imágenes (y livianas)", () => {
  const con = DATA.ejercicios.filter(e => e.demo);
  assert.ok(con.length > 500, `con demo: ${con.length}`);
  let total = 0;
  const faltan = [];
  con.forEach(e => [0, 1].forEach(i => {
    const p = path.join(RAIZ, "img/ejercicios", e.id, `${i}.webp`);
    if (!fs.existsSync(p)) { faltan.push(`${e.id}/${i}`); return; }
    const t = fs.statSync(p).size;
    total += t;
    assert.ok(t < 60 * 1024, `${e.id}/${i}.webp pesa ${t} bytes`);
    // Es WebP de verdad (RIFF....WEBP).
    const cab = Buffer.alloc(12);
    const fd = fs.openSync(p, "r"); fs.readSync(fd, cab, 0, 12, 0); fs.closeSync(fd);
    assert.strictEqual(cab.toString("ascii", 8, 12), "WEBP", `${e.id}/${i}.webp`);
  }));
  assert.deepStrictEqual(faltan, []);
  assert.ok(total / (con.length * 2) < 20 * 1024, `promedio ${Math.round(total / con.length / 2)} bytes`);
});

test("la base: campos nuevos (mecánica, fuerza, nivel) con valores válidos", () => {
  DATA.ejercicios.forEach(e => {
    if (e.mec != null) assert.ok(["c", "a"].includes(e.mec), `${e.id} mec ${e.mec}`);
    if (e.fz != null) assert.ok(["e", "t", "s"].includes(e.fz), `${e.id} fz ${e.fz}`);
    if (e.niv != null) assert.ok([1, 2, 3].includes(e.niv), `${e.id} niv ${e.niv}`);
    if (e.demo != null) assert.strictEqual(e.demo, 1);
  });
  const f = id => DATA.ejercicios.find(e => e.id === id);
  assert.strictEqual(f("barbell-squat").mec, "c");
  assert.strictEqual(f("side-lateral-raise").mec, "a");
  assert.strictEqual(f("barbell-bench-press-medium-grip").fz, "e");
  assert.strictEqual(f("pullups").fz, "t");
});

test("el service worker no precachea las demos y las guarda con límite", () => {
  const sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
  assert.match(sw, /ES_DEMO = \/\\\/img\\\/ejercicios\\\/\//);
  assert.match(sw, /DEMOS_MAX = \d+/);
  assert.match(sw, /tipo === "demos"/);
  // index.html no menciona ninguna imagen de demo (no entran al precache).
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  assert.doesNotMatch(html, /img\/ejercicios\//);
});
