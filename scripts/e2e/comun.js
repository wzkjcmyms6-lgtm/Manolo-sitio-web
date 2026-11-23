// Utilidades compartidas de las pruebas de pantalla (scripts/e2e/*.js).
// Servidor local de la carpeta del repo, Chromium de Playwright a 390 px
// como un iPhone, Firebase falso (fake-firebase.js) y, si se pide, reloj y
// voz simulados para recorrer una rutina en segundos.
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
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" };
// Reloj simulado: window.__adelantar(ms) adelanta Date.now();
// window.__congelar() detiene el reloj real. Sobrevive a las recargas
// (sessionStorage), así el tiempo real de la prueba no se cuela en los números.
function simuladores() {
  const real = Date.now.bind(Date);
  const r = JSON.parse(sessionStorage.getItem("__reloj") || '{"desfase":0,"fijo":null}');
  const guardar = () => sessionStorage.setItem("__reloj", JSON.stringify(r));
  Date.now = () => (r.fijo != null ? r.fijo : real()) + r.desfase;
  window.__adelantar = ms => { r.desfase += ms; guardar(); };
  window.__congelar = () => { r.fijo = real(); guardar(); };
}

// Voz simulada: lo que se "dice" queda en window.__dichos (sin sonido real).
function simVoz() {
  window.__dichos = [];
  const ss = { speak(u) { if (u.text.trim()) window.__dichos.push(u.text); }, cancel() {}, getVoices() { return [{ lang: "es-ES", name: "Prueba" }]; }, addEventListener() {} };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: ss });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
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
// carga (__SEED__, __USERS__, __SESION__…); opciones: { reloj, voz, ancho, alto, hash,
// zona (huso horario, p. ej. "America/La_Paz"), fecha (Date fija, los timers siguen),
// relojFalso (fecha de inicio de un reloj falso que se adelanta con p.clock.fastForward),
// init (función que corre en la página antes que la app, p. ej. una voz falsa),
// esquema ("light" o "dark", el del teléfono; por defecto "dark") }.
async function abrir(browser, base, estado, opciones) {
  const o = Object.assign({ ancho: 390, alto: 844, hash: "#inicio" }, opciones || {});
  const movil = o.ancho <= 768;
  // El navegador de prueba arranca en claro; la app (en "Automático", D-126)
  // se ve oscura como siempre salvo que la prueba pida esquema: "light".
  const ctx = await browser.newContext(Object.assign({ viewport: { width: o.ancho, height: o.alto }, deviceScaleFactor: 2, isMobile: movil, hasTouch: movil, serviceWorkers: "block", colorScheme: o.esquema || "dark" },
    o.zona ? { timezoneId: o.zona } : {}));
  if (o.fecha) await ctx.clock.setFixedTime(new Date(o.fecha));
  if (o.relojFalso) await ctx.clock.install({ time: new Date(o.relojFalso) });
  await ctx.route(/firebase-10\.7\.1|firebasejs/, r => r.request().url().includes("app-compat")
    ? r.fulfill({ contentType: "text/javascript", body: FAKE })
    : r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  // Las fuentes de datos de libros (Open Library, Wikipedia, Google Libros) no
  // salen a internet en las pruebas: cada prueba simula las que usa (sus
  // rutas se registran después y mandan). Las portadas no se tocan.
  await ctx.route(/openlibrary\.org\/(search|works|books|authors|isbn)|es\.wikipedia\.org\/w\/api\.php|www\.googleapis\.com\/books/, r => r.abort());
  await ctx.addInitScript(e => {
    if (localStorage.getItem("__INIT__")) return;
    localStorage.setItem("__INIT__", "1");
    Object.keys(e).forEach(k => localStorage.setItem(k, typeof e[k] === "string" ? e[k] : JSON.stringify(e[k])));
  }, estado || {});
  if (o.reloj) await ctx.addInitScript(simuladores);
  if (o.voz) await ctx.addInitScript(simVoz);
  if (o.init) await ctx.addInitScript(o.init);
  // Rutas propias de una prueba (por ejemplo, un puente de mentira), antes de abrir.
  if (o.rutas) await o.rutas(ctx);
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

// Corre en la página (p.evaluate(auditarContraste)): los textos visibles con
// poco contraste contra su fondo real, como Lighthouse (4,5:1; 3:1 los grandes).
function auditarContraste() {
  const leer = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ""); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
  const sobre = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
  const nombre = el => { let s = el.tagName.toLowerCase(); if (el.id) s += "#" + el.id; else if (el.classList.length) s += "." + [...el.classList].slice(0, 2).join("."); const p = el.parentElement; return p ? `${p.classList.length ? "." + p.classList[0] : p.tagName.toLowerCase()} > ${s}` : s; };
  function fondo(el) {
    const capas = [];
    for (let x = el; x; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.backgroundImage && cs.backgroundImage !== "none" && !/^url\(/.test(cs.backgroundImage)) return null;
      const c = leer(cs.backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a >= 0.99) break; }
    }
    let base = leer(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    base.a = 1;
    for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base);
    return base;
  }
  const malos = [];
  const vistos = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode;
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || vistos.has(el)) continue;
    vistos.add(el);
    if (el.closest("[hidden], script, style, svg, .visually-hidden, [aria-hidden='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    let oculto = false;
    for (let x = el; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.5) { oculto = true; break; } }
    if (oculto) continue;
    const cs = getComputedStyle(el);
    const c = leer(cs.color);
    const f = fondo(el);
    if (!c || !f) continue;
    const col = c.a < 1 ? sobre(c, f) : c;
    const a = lum(col), b = lum(f);
    const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && Number(cs.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5)) malos.push({ texto: t.textContent.trim().slice(0, 28), k: Math.round(k * 100) / 100, donde: nombre(el), color: cs.color });
  }
  return malos;
}

module.exports = { chromium, servidor, abrir, ok, captura, terminar, auditarContraste, sumarFallo: () => fallos++ };
