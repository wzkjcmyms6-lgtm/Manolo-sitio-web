// Huella de la app para el service worker.
//
// sw.js guarda la app en el teléfono según su VERSION. Si cambia cualquier
// archivo que carga index.html y nadie sube VERSION, los teléfonos seguirían
// mostrando lo viejo. Este script calcula una huella de todos esos archivos:
//   npm run sw    → actualiza VERSION y HUELLA en sw.js
// y tests/sw-version.test.js falla si la huella no coincide.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..");
const EXTRAS = ["manifest.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

// Misma idea que recursosDe() en sw.js: rutas locales de src/href/url().
function rutasDe(texto, desde) {
  const out = new Set();
  const re = /(?:src|href)\s*=\s*"([^"#]+)"|url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let m;
  while ((m = re.exec(texto))) {
    const ruta = m[1] || m[2];
    if (!ruta || /^(#|data:|mailto:|tel:|javascript:|https?:|\/\/)/.test(ruta)) continue;
    out.add(path.normalize(path.join(path.dirname(desde), ruta.split("?")[0])));
  }
  return out;
}
function datosDeJs(texto) {
  const out = new Set();
  const re = /["'](data\/[\w.-]+\.json)\?v=[\w.-]+["']/g;
  let m;
  while ((m = re.exec(texto))) out.add(path.normalize(m[1]));
  return out;
}

function archivosDeLaApp() {
  const vistos = new Set(["index.html"]);
  const pendientes = [...rutasDe(fs.readFileSync(path.join(RAIZ, "index.html"), "utf8"), "index.html"), ...EXTRAS];
  while (pendientes.length) {
    const rel = pendientes.shift();
    if (vistos.has(rel)) continue;
    vistos.add(rel);
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    if (rel.endsWith(".css")) pendientes.push(...rutasDe(fs.readFileSync(abs, "utf8"), rel));
    else if (rel.endsWith(".js") && !rel.startsWith("vendor")) pendientes.push(...datosDeJs(fs.readFileSync(abs, "utf8")));
  }
  return [...vistos].filter(rel => fs.existsSync(path.join(RAIZ, rel)) && fs.statSync(path.join(RAIZ, rel)).isFile()).sort();
}

function huella() {
  const h = crypto.createHash("sha256");
  archivosDeLaApp().forEach(rel => {
    h.update(rel + "\n");
    h.update(fs.readFileSync(path.join(RAIZ, rel)));
  });
  return h.digest("hex").slice(0, 12);
}

function leerSw() {
  const texto = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
  const version = (texto.match(/const VERSION = "([^"]+)";/) || [])[1];
  const guardada = (texto.match(/const HUELLA = "([^"]+)";/) || [])[1];
  return { texto, version, guardada };
}

function escribir() {
  const { texto, version, guardada } = leerSw();
  const nueva = huella();
  if (nueva === guardada) { console.log(`sw.js ya está al día (versión ${version}).`); return; }
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [fecha, n] = (version || "").split(".");
  const siguiente = fecha === hoy ? `${hoy}.${Number(n || 0) + 1}` : `${hoy}.1`;
  const salida = texto
    .replace(/const VERSION = "[^"]+";/, `const VERSION = "${siguiente}";`)
    .replace(/const HUELLA = "[^"]+";/, `const HUELLA = "${nueva}";`);
  fs.writeFileSync(path.join(RAIZ, "sw.js"), salida);
  console.log(`sw.js: versión ${version} → ${siguiente} (huella ${nueva}).`);
}

if (require.main === module) escribir();
module.exports = { huella, leerSw, archivosDeLaApp };
