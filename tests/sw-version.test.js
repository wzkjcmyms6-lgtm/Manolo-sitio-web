const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { huella, leerSw, archivosDeLaApp } = require("../scripts/version-sw.js");

const RAIZ = path.join(__dirname, "..");

test("sw.js tiene la huella de la app actual (si falla: npm run sw)", () => {
  const { guardada } = leerSw();
  assert.equal(guardada, huella(), "La app cambió pero sw.js no: ejecuta `npm run sw` para subir la versión del caché.");
});

test("la app no carga nada de internet al abrir (fuentes y Firebase van en el repo)", () => {
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  const externos = html.match(/<(?:script|link)\b[^>]*(?:src|href)="https?:\/\/[^"]+"/g) || [];
  assert.deepEqual(externos, []);
});

test("todo lo que se guarda offline existe en el repo", () => {
  const lista = archivosDeLaApp();
  ["index.html", "manifest.json", "css/fuentes.css", "vendor/firebase-10.7.1/firebase-app-compat.js", "fonts/dm-sans-latin.woff2"]
    .forEach(f => assert.ok(lista.includes(path.normalize(f)), f));
});

test("manifest con rutas relativas (el sitio vive en /Manolo-sitio-web/)", () => {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, "manifest.json"), "utf8"));
  [m.start_url, m.scope, m.id].concat(m.icons.map(i => i.src)).forEach(r => {
    assert.ok(r && !r.startsWith("/") && !/^https?:/.test(r), `ruta no relativa: ${r}`);
  });
});
