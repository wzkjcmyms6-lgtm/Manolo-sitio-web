// Sin internet (QA 2026-11, D-119): con el service worker de verdad, la app
// se guarda en el teléfono y, en modo avión, abren Inicio, Finanzas (el
// disponible por día), Lugares y la copia de seguridad. Los datos de prueba
// los da el Firebase falso, servido en lugar de vendor/firebase (las demás
// pruebas bloquean el service worker y lo inyectan con rutas).
// Uso: node scripts/e2e/sin-internet.js
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium, ok, terminar } = require("./comun.js");

const RAIZ = path.join(__dirname, "..", "..");
const FAKE = fs.readFileSync(path.join(__dirname, "fake-firebase.js"), "utf8");
const VERSION = /const VERSION = "([^"]+)"/.exec(fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8"))[1];
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" };
const SEED = {
  "users/test/finanzas": {
    i1: { date: "2026-11-01", type: "ingreso", category: "salario", payment: "debito", amount: 3000, montoCent: 300000, createdAt: 1 },
    g1: { date: "2026-11-03", type: "gasto", category: "comida", payment: "debito", amount: 120, montoCent: 12000, createdAt: 2 }
  },
  "users/test/lugares": {
    l1: { v: 1, nombre: "Doña Rosa", estado: "visitado", calificacion: 5, volveria: "si", tipo: "restaurante", platos: {}, visitas: {}, fotos: [], etiquetas: [], creado: 1, actualizado: 1 }
  }
};

function servidor() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const ruta = decodeURIComponent(req.url.split("?")[0]);
      if (/firebase-10\.7\.1\/firebase-app-compat\.js$/.test(ruta)) { resp.writeHead(200, { "Content-Type": "text/javascript" }); resp.end(FAKE); return; }
      if (/firebase-10\.7\.1\//.test(ruta)) { resp.writeHead(200, { "Content-Type": "text/javascript" }); resp.end(""); return; }
      const archivo = path.join(RAIZ, ruta === "/" ? "index.html" : ruta);
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(resp);
    }).listen(0, () => res(srv));
  });
}
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: "America/La_Paz" });
  await ctx.route(/gstatic|googleapis/, r => r.abort());
  await ctx.addInitScript(seed => {
    if (localStorage.getItem("__INIT__")) return;
    localStorage.setItem("__INIT__", "1");
    localStorage.setItem("__SEED__", JSON.stringify(seed));
  }, SEED);
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(e.message));
  await p.goto(`${base}/index.html#inicio`);

  console.log("\nLa app se guarda en el teléfono");
  const activo = await p.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(r => !!r.active), new Promise(res => setTimeout(() => res(false), 20000))]));
  ok(activo, "el service worker queda activo");
  const claves = await p.evaluate(async v => (await (await caches.open(`manolo-app-${v}`)).keys()).map(r => new URL(r.url).pathname), VERSION);
  // D-127: los módulos y estilos van en dos paquetes (con Lugares, la copia
  // de seguridad y el disponible por día adentro).
  const nuevos = ["/js/app.paquete.js", "/css/app.paquete.css", "/js/tema.js", "/css/tema-claro.css", "/js/biblia-buscar-worker.js", "/js/biblia-motor.js", "/js/biblia-texto.js"];
  const faltan = nuevos.filter(f => !claves.some(k => k.endsWith(f)));
  ok(!faltan.length, `guarda la app en sus paquetes, el modo claro y la búsqueda de la Biblia${faltan.length ? ` (faltan ${faltan.join(", ")})` : ""}`);
  const paquete = fs.readFileSync(path.join(RAIZ, "js/app.paquete.js"), "utf8");
  ok(["js/finanzas/diario.js", "js/lugares.js", "js/respaldo.js"].every(f => paquete.includes(`["${f}",`)), "el paquete trae el disponible por día, Lugares y la copia de seguridad");

  console.log("\nEn modo avión");
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForTimeout(1500);
  ok(await p.isVisible("#panel-inicio") && (await p.$$(".card-grid-home .card")).length === 11, "Inicio abre con sus 11 tarjetas");
  await p.click('a.card[href="#lugares"]');
  await p.waitForTimeout(700);
  ok(/Doña Rosa/.test(await txt(p, "#lug-lista")), "Lugares abre con tus lugares");
  await p.click('a.card[href="#inicio"], #panel-lugares .back-link');
  await p.waitForTimeout(500);
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(500);
  await p.click('[data-rsp="preparar"]');
  const guardar = await p.waitForSelector('[data-rsp="guardar"]', { timeout: 8000 }).catch(() => null);
  ok(!!guardar, "la copia de seguridad se prepara sin internet");
  await p.click(".rsp-hoja .budget-sheet-close");
  await p.waitForTimeout(400);
  await p.goto(`${base}/index.html#finanzas`).catch(() => {});
  await p.waitForTimeout(1500);
  ok(/por día/i.test(await txt(p, "#panel-finanzas")), "Finanzas muestra el disponible por día");
  // El Worker de la búsqueda de la Biblia carga sus dos archivos sin internet
  // (sin libros pedidos: solo prueba que arranca).
  const bus = await p.evaluate(() => new Promise(res => {
    const w = new Worker("js/biblia-buscar-worker.js");
    const scripts = ["biblia-motor.js", "biblia-texto.js"].map(n => new URL(`js/${n}`, location.href).href);
    w.onmessage = e => { res(e.data); w.terminate(); };
    w.onerror = e => res({ tipo: "error", mensaje: e.message || "no arrancó" });
    w.postMessage({ tipo: "buscar", id: 1, q: "luz", libros: [], max: 5, scripts, urls: {}, cache: "manolo-biblia" });
    setTimeout(() => res({ tipo: "error", mensaje: "sin respuesta" }), 8000);
  }));
  ok(bus.tipo === "resultado", `la búsqueda de la Biblia arranca sin internet${bus.tipo === "resultado" ? "" : ` (${bus.mensaje})`}`);
  ok(!errores.length, `sin errores de página${errores.length ? ` (${errores[0]})` : ""}`);
  await ctx.setOffline(false);
  await terminar(browser, srv);
})();
