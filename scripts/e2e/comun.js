// Utilidades compartidas de las pruebas de pantalla (scripts/e2e/*.js).
// Servidor local de la carpeta del repo, Chromium de Playwright a 390 px
// como un iPhone, Firebase falso (fake-firebase.js) y, si se pide, GPS y
// reloj simulados para recorrer una carrera en segundos.
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
  try { ({ chromium } = require(p)); break; } catch (e) { /* siguiente */ }
}
if (!chromium) { console.error("Falta Playwright (npm i -g playwright)."); process.exit(2); }

const RAIZ = path.resolve(__dirname, "../..");
const FAKE = fs.readFileSync(path.join(__dirname, "fake-firebase.js"), "utf8");
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
// PNG transparente de 1×1 para las teselas del mapa (sin salir a internet).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

// GPS y reloj simulados: window.__gps(lat, lon, acc, alt) entrega una
// posición; window.__gpsError(codigo); window.__adelantar(ms) adelanta
// Date.now(); window.__congelar() detiene el reloj real;
// window.__permiso = "granted" | "prompt" | "denied".
function simuladores() {
  // El reloj simulado sobrevive a las recargas (sessionStorage) y se puede
  // congelar para que el tiempo real de la prueba no se cuele en los números.
  const real = Date.now.bind(Date);
  const r = JSON.parse(sessionStorage.getItem("__reloj") || '{"desfase":0,"fijo":null}');
  const guardar = () => sessionStorage.setItem("__reloj", JSON.stringify(r));
  Date.now = () => (r.fijo != null ? r.fijo : real()) + r.desfase;
  window.__adelantar = ms => { r.desfase += ms; guardar(); };
  window.__congelar = () => { r.fijo = real(); guardar(); };
  const vigilantes = new Map();
  let n = 0;
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    watchPosition(ok, err) { const id = ++n; vigilantes.set(id, { ok, err }); return id; },
    clearWatch(id) { vigilantes.delete(id); },
    getCurrentPosition() {}
  } });
  window.__gps = (lat, lon, acc, alt) => vigilantes.forEach(v => v.ok({
    coords: { latitude: lat, longitude: lon, accuracy: acc, altitude: alt == null ? null : alt, altitudeAccuracy: alt == null ? null : 5 },
    timestamp: Date.now()
  }));
  window.__gpsError = codigo => vigilantes.forEach(v => v.err({ code: codigo }));
  window.__vigilantes = () => vigilantes.size;
  const consulta = navigator.permissions && navigator.permissions.query.bind(navigator.permissions);
  if (navigator.permissions) navigator.permissions.query = d => (d && d.name === "geolocation" ? Promise.resolve({ state: window.__permiso || "prompt" }) : consulta(d));
}

function servidor() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const ruta = decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.join(RAIZ, ruta === "/" ? "index.html" : ruta);
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(resp);
    }).listen(0, () => res(srv));
  });
}

// Abre una página nueva. estado: claves de localStorage para la primera
// carga (__SEED__, __USERS__, __SESION__…); opciones: { gps, ancho, alto, hash }.
async function abrir(browser, base, estado, opciones) {
  const o = Object.assign({ ancho: 390, alto: 844, hash: "#inicio" }, opciones || {});
  const movil = o.ancho <= 768;
  const ctx = await browser.newContext({ viewport: { width: o.ancho, height: o.alto }, deviceScaleFactor: 2, isMobile: movil, hasTouch: movil, serviceWorkers: "block" });
  await ctx.route(/firebase-10\.7\.1|firebasejs/, r => r.request().url().includes("app-compat")
    ? r.fulfill({ contentType: "text/javascript", body: FAKE })
    : r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/tile\.openstreetmap\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await ctx.addInitScript(e => {
    if (localStorage.getItem("__INIT__")) return;
    localStorage.setItem("__INIT__", "1");
    Object.keys(e).forEach(k => localStorage.setItem(k, typeof e[k] === "string" ? e[k] : JSON.stringify(e[k])));
  }, estado || {});
  if (o.gps) await ctx.addInitScript(simuladores);
  const p = await ctx.newPage();
  p.errores = [];
  p.on("pageerror", err => { p.errores.push(err.message); fallos++; console.log("  error de página:", err.message); });
  p.on("dialog", d => d.accept());
  await p.goto(base + "/index.html" + o.hash);
  await p.waitForTimeout(800);
  return p;
}

let fallos = 0;
function ok(cond, msg) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallos++;
}
async function captura(p, carpeta, nombre) {
  if (carpeta) await p.screenshot({ path: path.join(carpeta, nombre) });
}
function terminar(browser, srv) {
  return browser.close().then(() => {
    srv.close();
    console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien");
    process.exit(fallos ? 1 : 0);
  });
}

module.exports = { chromium, servidor, abrir, ok, captura, terminar, sumarFallo: () => fallos++ };
