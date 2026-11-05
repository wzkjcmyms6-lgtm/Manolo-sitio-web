// El service worker se instala y se actualiza de verdad (Chromium con
// service workers permitidos; las demás pruebas los bloquean). Revisa que
// la copia sin internet quede completa (también Leaflet) y que una versión
// nueva muestre "Nueva versión disponible · Actualizar" y se active.
// Nació de un error real (2026-11-05): una imagen de Leaflet que no está en
// el repo hacía fallar la instalación y los teléfonos nunca se actualizaban.
// Uso: node scripts/e2e/sw-instala.js
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium, ok, terminar } = require("./comun.js");

const RAIZ = path.join(__dirname, "..", "..");
const SW = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
const VERSION = /const VERSION = "([^"]+)"/.exec(SW)[1];

// Servidor propio: sirve el repo, pero sw.js sale de una variable para poder
// "publicar" una versión nueva en medio de la prueba (el navegador baja el
// service worker por su cuenta, sin pasar por las rutas de Playwright).
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" };
let swActual = SW;
function servidorPropio() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const ruta = decodeURIComponent(req.url.split("?")[0]);
      if (ruta === "/sw.js") { resp.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-cache" }); resp.end(swActual); return; }
      const archivo = path.join(RAIZ, ruta === "/" ? "index.html" : ruta);
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(resp);
    }).listen(0, () => res(srv));
  });
}

(async () => {
  const srv = await servidorPropio();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  // Las fuentes de Google no hacen falta para el service worker.
  await ctx.route(/gstatic|googleapis/, r => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${base}/index.html#inicio`);

  console.log("\nPrimera instalación");
  const activo = await p.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then(r => !!r.active),
    new Promise(res => setTimeout(() => res(false), 20000))
  ]));
  ok(activo, "el service worker se instala y queda activo");
  const cache = await p.evaluate(async v => {
    const nombres = await caches.keys();
    const c = await caches.open(`manolo-app-${v}`);
    const claves = (await c.keys()).map(r => new URL(r.url).pathname);
    return { nombres, claves };
  }, VERSION);
  ok(cache.nombres.includes(`manolo-app-${VERSION}`), `caché de la versión ${VERSION}`);
  const tiene = f => cache.claves.some(k => k.endsWith(f));
  ok(["/index.html", "/js/run-detalle.js", "/js/run-importar.js", "/css/run.css", "/vendor/leaflet-1.9.4/leaflet.js", "/vendor/leaflet-1.9.4/leaflet.css"].every(tiene), `guarda la app y Leaflet (${cache.claves.length} archivos)`);

  console.log("Una versión nueva");
  swActual = SW.replace(`const VERSION = "${VERSION}"`, `const VERSION = "${VERSION}-prueba"`);
  await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  const aviso = await p.waitForSelector(".app-aviso", { timeout: 20000 }).catch(() => null);
  ok(!!aviso && /Nueva versión disponible/.test(await aviso.textContent()), "aparece «Nueva versión disponible · Actualizar»");
  if (aviso) {
    await Promise.all([p.waitForEvent("load", { timeout: 20000 }).catch(() => {}), p.click(".app-aviso-btn")]);
    await p.waitForTimeout(800);
    const nombres = await p.evaluate(() => caches.keys());
    ok(nombres.includes(`manolo-app-${VERSION}-prueba`) && !nombres.includes(`manolo-app-${VERSION}`), "al tocar Actualizar queda la versión nueva y se borra la vieja");
  }
  await terminar(browser, srv);
})();
