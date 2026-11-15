// iPhone: cuánto mover lo fijo cuando la pantalla queda "corrida" (js/viewport-ajuste.js, D-120).
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../js/viewport-ajuste.js");

test("lo normal: nada que mover", () => {
  assert.deepEqual(V.calcular({ offsetTop: 0, height: 932, scale: 1, innerHeight: 932 }), { arriba: 0, abajo: 0 });
  assert.deepEqual(V.calcular({ offsetTop: 1, height: 931.6, scale: 1, innerHeight: 932 }), { arriba: 0, abajo: 0 }, "un píxel no cuenta");
  assert.deepEqual(V.calcular(null), { arriba: 0, abajo: 0 });
});

test("pantalla corrida hacia abajo (como en las capturas): se baja todo lo fijo", () => {
  // La parte visible quedó 331 px más abajo: la barra flotaba a media pantalla.
  assert.deepEqual(V.calcular({ offsetTop: 331, height: 932, scale: 1, innerHeight: 932 }), { arriba: 331, abajo: 331 });
  // O el alto "de lo fijo" quedó como con el teclado abierto.
  assert.deepEqual(V.calcular({ offsetTop: 0, height: 932, scale: 1, innerHeight: 601 }), { arriba: 0, abajo: 331 });
});

test("mientras escribes o con zoom de dos dedos no se toca nada", () => {
  assert.deepEqual(V.calcular({ offsetTop: 300, height: 600, scale: 1, innerHeight: 932, escribiendo: true }), { arriba: 0, abajo: 0 });
  assert.deepEqual(V.calcular({ offsetTop: 120, height: 621, scale: 1.5, innerHeight: 932 }), { arriba: 0, abajo: 0 });
});

test("nunca hacia arriba ni más que la pantalla", () => {
  assert.deepEqual(V.calcular({ offsetTop: -20, height: 900, scale: 1, innerHeight: 932 }), { arriba: 0, abajo: 0 });
  assert.deepEqual(V.calcular({ offsetTop: 5000, height: 932, scale: 1, innerHeight: 932 }), { arriba: 932, abajo: 932 });
  assert.deepEqual(V.calcular({ offsetTop: 10, height: 932, scale: 1, innerHeight: 0 }), { arriba: 0, abajo: 0 });
});

test("¿hay un campo abierto?", () => {
  const doc = el => ({ activeElement: el });
  assert.equal(V.escribiendo(doc({ tagName: "INPUT", type: "text" })), true);
  assert.equal(V.escribiendo(doc({ tagName: "INPUT", type: "time" })), true);
  assert.equal(V.escribiendo(doc({ tagName: "TEXTAREA" })), true);
  assert.equal(V.escribiendo(doc({ tagName: "SELECT" })), true);
  assert.equal(V.escribiendo(doc({ tagName: "INPUT", type: "checkbox" })), false);
  assert.equal(V.escribiendo(doc({ tagName: "BUTTON" })), false);
  assert.equal(V.escribiendo(doc({ tagName: "DIV", isContentEditable: true })), true);
  assert.equal(V.escribiendo(doc(null)), false);
});
