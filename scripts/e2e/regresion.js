// Regresión rápida: abre cada sección principal con datos de ejemplo y
// comprueba que se dibuja sin errores de JavaScript.
// Uso: node scripts/e2e/regresion.js [carpeta-para-capturas]
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
  try { ({ chromium } = require(p)); break; } catch (e) { /* siguiente */ }
}
if (!chromium) { console.error("Falta Playwright (npm i -g playwright)."); process.exit(2); }

const RAIZ = path.resolve(__dirname, "../..");
const CAPTURAS = process.argv[2] || null;
const FAKE = fs.readFileSync(path.join(__dirname, "fake-firebase.js"), "utf8");
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const hoy = new Date();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SEED = {
  "users/test/entrenamientos": { w1: { date: iso(hoy), startedAt: Date.now() - 3600e3, name: "Push", durationMin: 45, exercises: [{ name: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", sets: [{ kg: 60, reps: 8 }, { kg: 60, reps: 8 }] }] } },
  "users/test/rutinas": { r1: { name: "Push", orden: 0, items: [{ nombre: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", series: 3, repsMin: 8, repsMax: 10, peso: 60, descansoSeg: 90, notas: "", incremento: null }] } },
  "users/test/habitos": { h1: { v: 2, name: "Leer", emoji: "📖", tipo: "sino", freqType: "diario", days: [true, true, true, true, true, true, true], done: [], registros: {}, createdAt: Date.now() - 864e5, inicio: iso(new Date(Date.now() - 864e5)), orden: 1 } },
  "users/test/running": { c1: { date: iso(hoy), distance: 5, duration: 30, notes: "" } },
  "users/test/bicicleta": { b1: { date: iso(hoy), distance: 20, duration: 60, notes: "" } }
};
const PANTALLAS = [
  ["inicio", "#panel-inicio"], ["habitos", "#hb-lista"], ["hab-stats", "#hb-stats"], ["ej-feed", "#panel-ej-feed"],
  ["ejercicio", "#panel-ejercicio"], ["gimnasio", "#gym-home"], ["ej-rangos", "#rk-app"], ["ej-perfil", "#ejd-dash"],
  ["running", "#running-list"], ["bicicleta", "#cycling-list"], ["finanzas", "#panel-finanzas"], ["fin-movimientos", "#panel-fin-movimientos"],
  ["fin-presupuesto", "#panel-fin-presupuesto"], ["fin-analisis", "#panel-fin-analisis"], ["inversiones", "#panel-inversiones"]
];

let fallos = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) fallos++; };

(async () => {
  const srv = await new Promise(res => {
    const s = http.createServer((req, resp) => {
      const ruta = decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.join(RAIZ, ruta === "/" ? "index.html" : ruta);
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(resp);
    }).listen(0, () => res(s));
  });
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(/firebase-10\.7\.1|firebasejs/, r => r.request().url().includes("app-compat")
    ? r.fulfill({ contentType: "text/javascript", body: FAKE }) : r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(seed => { if (!localStorage.getItem("__SEED__")) localStorage.setItem("__SEED__", seed); }, JSON.stringify(SEED));
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(e.message));
  await p.goto(base + "/index.html#inicio");
  await p.waitForTimeout(1200);
  for (const [hash, sel] of PANTALLAS) {
    errores.length = 0;
    await p.evaluate(h => { location.hash = h; }, hash);
    await p.waitForTimeout(500);
    const visible = await p.isVisible(sel);
    ok(visible && !errores.length, `#${hash}${errores.length ? " — " + errores.join(" | ") : visible ? "" : " — no se ve " + sel}`);
    if (CAPTURAS) await p.screenshot({ path: path.join(CAPTURAS, `reg-${hash}.png`) });
  }
  // Gimnasio: empezar la rutina y marcar una serie.
  errores.length = 0;
  await p.evaluate(() => { location.hash = "gimnasio"; });
  await p.waitForTimeout(400);
  await p.click('[data-rut-empezar="r1"]');
  await p.waitForTimeout(400);
  await p.click('.gx-ej[data-ex-index="0"] .gx-fila[data-set-index="0"] .gx-check');
  await p.waitForTimeout(300);
  ok(!errores.length && (await p.textContent("#gym-active-series")) === "1", "gimnasio: empezar rutina y marcar una serie");
  await browser.close();
  srv.close();
  console.log(fallos ? `\n${fallos} pantalla(s) con problemas` : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
