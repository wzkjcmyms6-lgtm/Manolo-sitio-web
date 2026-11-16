// La app abre más rápido (D-127): los módulos van juntos en js/app.paquete.js
// y los estilos en css/app.paquete.css (scripts/paquete.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const P = require("../scripts/paquete.js");

const RAIZ = path.join(__dirname, "..");
const leer = rel => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const html = leer("index.html");

test("los paquetes están al día (si falla: npm run listo)", () => {
  const g = P.generar();
  assert.equal(leer(P.JS), g.js, "js/app.paquete.js no está al día");
  assert.equal(leer(P.CSS), g.css, "css/app.paquete.css no está al día");
  assert.equal(html, g.html, "el ?v= de los paquetes en index.html no está al día");
});

test("la lista: cada módulo existe, sin repetidos, y nada se carga dos veces", () => {
  const l = P.leerLista();
  assert.ok(l.js.length > 100 && l.css.length > 10);
  [...l.js, ...l.css].forEach(rel => assert.ok(fs.existsSync(path.join(RAIZ, rel)), `falta ${rel}`));
  assert.equal(new Set(l.js).size, l.js.length, "un módulo repetido");
  assert.equal(new Set(l.css).size, l.css.length, "un estilo repetido");
  // index.html ya no carga los módulos sueltos (solo Firebase, el paquete y el modo claro).
  const sueltos = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+)/g)].map(m => m[1]);
  assert.deepEqual(sueltos.sort(), ["js/app.paquete.js", "js/tema.js"]);
  const hojas = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)/g)].map(m => m[1]);
  assert.deepEqual(hojas, ["css/fuentes.css", "css/app.paquete.css", "css/tema-claro.css"]);
  l.css.forEach(rel => assert.ok(!hojas.includes(rel), `${rel} está en el paquete y también suelto`));
});

test("el orden de los estilos se respeta: style.css primero y viewport.css al final (D-120)", () => {
  const l = P.leerLista();
  assert.equal(l.css[0], "css/style.css");
  assert.equal(l.css[l.css.length - 1], "css/viewport.css");
});

test("el modo claro se sigue generando de cada estilo del paquete, en orden", () => {
  const T = require("../scripts/tema-claro.js");
  const l = P.leerLista();
  assert.deepEqual(T.archivosCss(), l.css.filter(rel => rel !== "css/viewport.css"));
});

test("Firebase antes que el paquete; el paquete con defer", () => {
  const iFb = html.indexOf("vendor/firebase-10.7.1/firebase-firestore-compat.js");
  const iPaq = html.indexOf('src="js/app.paquete.js');
  assert.ok(iFb > 0 && iPaq > iFb);
  assert.match(html, /<script defer src="js\/app\.paquete\.js\?v=[0-9a-f]{12}"><\/script>/);
});

test("cada módulo del paquete es JavaScript válido y queda con su nombre", () => {
  const l = P.leerLista();
  l.js.forEach(rel => assert.doesNotThrow(() => new vm.Script(leer(rel), { filename: rel }), `${rel} no se puede leer`));
  const paquete = leer(P.JS);
  assert.doesNotThrow(() => new vm.Script(paquete), "el paquete no se puede leer");
  assert.match(paquete, /sourceURL=/);
});

test("el paquete corre cada módulo aparte: un error en uno no frena a los demás", () => {
  const js = P.generarJs([]).replace("var M = [\n\n];", `var M = [["a.js", "window.uno = 1;"], ["b.js", "throw new Error('falla b');"], ["c.js", "window.tres = 3;"]];`);
  const corridos = [];
  const errores = [];
  const ventana = {};
  const documento = {
    createElement: () => ({ textContent: "" }),
    head: { appendChild: s => { try { vm.runInNewContext(s.textContent, { window: ventana }); corridos.push(s.textContent.split("\n").pop()); } catch (e) { errores.push(e.message); } } }
  };
  vm.runInNewContext(js, { document: documento });
  assert.deepEqual(errores, ["falla b"]);
  assert.equal(ventana.uno, 1);
  assert.equal(ventana.tres, 3, "c.js corre aunque b.js falle");
  assert.deepEqual(corridos, ["//# sourceURL=a.js", "//# sourceURL=c.js"]);
});

test("el service worker sigue viendo los datos que pide el código (dentro del paquete)", () => {
  const { archivosDeLaApp } = require("../scripts/version-sw.js");
  const lista = archivosDeLaApp();
  ["js/app.paquete.js", "css/app.paquete.css", "data/ejercicios.json", "data/ejercicios-tecnica.json"].forEach(f => assert.ok(lista.includes(path.normalize(f)), f));
});
