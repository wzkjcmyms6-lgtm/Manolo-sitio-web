// Pruebas de pantalla de Ejercicio inteligente (docs/EJERCICIO_INTELIGENTE.md):
// ficha con demo, entreno en vivo, progresión, descarga, generador y
// recomendación del día. A 390 y 1280 px, con 9 semanas de entrenos
// realistas (ejercicio-semilla.js). Uso:
//   node scripts/e2e/ejercicio.js [carpeta-para-capturas]
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium, servidor, abrir, ok, terminar } = require("./comun.js");
const SEM = require("./ejercicio-semilla.js");

const CAPTURAS = process.argv[2] || null;
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });
const HOY = "2026-11-05";
const FECHA = `${HOY}T18:30:00-04:00`;
const ZONA = "America/La_Paz";
const RAIZ = path.join(__dirname, "..", "..");

async function foto(p, nombre, completa) {
  if (CAPTURAS) await p.screenshot({ path: path.join(CAPTURAS, nombre), fullPage: !!completa });
}
const texto = (p, sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim()).catch(() => "");
function consolaLimpia(p) {
  p.erroresConsola = [];
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) p.erroresConsola.push(m.text()); });
}
async function sinAvisos(p) {
  for (const b of await p.$$("[data-rk-continuar]")) if (await b.isVisible()) { await b.click(); await p.waitForTimeout(250); }
}
async function ir(p, hash, espera) {
  await p.evaluate(h => { location.hash = h; }, hash);
  await p.waitForTimeout(espera || 700);
}
// Imagen cargada de verdad (no rota).
const cargada = (p, sel) => p.$eval(sel, img => img.complete && img.naturalWidth > 0).catch(() => false);

// ---------- Fase 1: demos ----------
async function demos(browser, base, ancho) {
  console.log(`\nFicha y demo (${ancho} px)`);
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#gimnasio", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
  consolaLimpia(p);
  await p.waitForTimeout(1200);
  await sinAvisos(p);

  // Desde una rutina: tocar el nombre del ejercicio abre su ficha.
  await p.click('#gym-routines .rut-ej-nombre[data-ficha="barbell-squat"]');
  await p.waitForTimeout(700);
  ok(await p.isVisible(".ejf-hoja .muscle-sheet-panel"), "tocar «Sentadilla (Barra)» en la rutina abre su ficha");
  ok(/Sentadilla \(Barra\)/.test(await texto(p, "#ejf-titulo")), "con su nombre");
  ok(await cargada(p, '.ejf-hoja .ejd-demo-img.is-a') && await cargada(p, '.ejf-hoja .ejd-demo-img.is-b'), "las 2 fotos de la demo cargan");
  const anim = await p.$eval(".ejf-hoja .ejd-demo-img.is-b", el => getComputedStyle(el).animationName);
  ok(anim === "ejd-alterna", "se alternan con un fundido (animación en bucle)");
  ok(/Cuádriceps/.test(await texto(p, ".ejf-musc-txt")) && (await p.$$(".ejf-hoja .ejf-fig")).length === 2, "músculos en texto y en el mapa (frente y espalda)");
  ok((await p.$$('.ejf-hoja .ejf-fig .mz[data-nivel="3"]')).length > 0, "el mapa pinta los principales");
  ok(/dominio público/.test(await texto(p, ".ejf-hoja .ejd-credito")), "créditos de la base");
  await foto(p, `ficha-demo-${ancho}.png`);
  // Pausa
  await p.click(".ejf-hoja [data-demo-pausa]");
  await p.waitForTimeout(150);
  ok(await p.$eval(".ejf-hoja .ejd-demo", el => el.classList.contains("is-pausada")) &&
     await p.$eval(".ejf-hoja .ejd-demo-img.is-b", el => getComputedStyle(el).animationPlayState) === "paused", "botón de pausa detiene la demo");
  await p.click(".ejf-hoja [data-demo-pausa]");
  await p.waitForTimeout(150);
  ok(await p.$eval(".ejf-hoja .ejd-demo-img.is-b", el => getComputedStyle(el).animationPlayState) === "running", "y la vuelve a andar");
  const tam = await p.$eval(".ejf-hoja [data-demo-pausa]", b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
  ok(tam[0] >= 44 && tam[1] >= 44, `pausa de ${tam.join(" × ")} px (≥ 44)`);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  ok(!(await p.isVisible(".ejf-hoja .muscle-sheet-panel")), "Escape cierra la ficha");

  // Ejercicio sin fotos (propio de Manolo): sin demo, con el mapa.
  await p.evaluate(() => EjFicha.abrir("manolo-correr"));
  await p.waitForTimeout(400);
  ok(!(await p.$(".ejf-hoja .ejd-demo")) && /no tiene demo/.test(await texto(p, ".ejf-hoja .ejf-sin-demo")), "un ejercicio sin fotos lo dice y muestra sus músculos");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);

  // Desde el entreno en vivo: el nombre y la miniatura.
  await p.click("#rut-hoy [data-rut-empezar]");
  await p.waitForTimeout(900);
  await p.click('#gym-active-exercises .gx-ej-nombre[data-ficha="barbell-squat"]');
  await p.waitForTimeout(600);
  ok(await p.isVisible(".ejf-hoja .muscle-sheet-panel") && /Sentadilla/.test(await texto(p, "#ejf-titulo")), "en el entreno, tocar el nombre abre la ficha");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await p.click('#gym-active-exercises .gx-thumb-btn[data-ficha="romanian-deadlift"]');
  await p.waitForTimeout(600);
  ok(/Peso muerto rumano/.test(await texto(p, "#ejf-titulo")), "y también la miniatura");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  ok(await p.isVisible("#gym-active") && (await p.$$("#gym-active-exercises .gx-ej")).length === 5, "el entreno sigue abierto, intacto");
  ok(!p.errores.length && !p.erroresConsola.length, `sin errores (${p.erroresConsola.join(" | ")})`);
  await p.context().close();

  // "Reducir movimiento": quietas, una al lado de la otra.
  const q = await abrir(browser, base, SEM.estado(HOY), { hash: "#gimnasio", zona: ZONA, fecha: FECHA, ancho, alto: 844 });
  await q.emulateMedia({ reducedMotion: "reduce" });
  await q.waitForTimeout(1000);
  await sinAvisos(q);
  await q.evaluate(() => EjFicha.abrir("side-lateral-raise"));
  await q.waitForTimeout(500);
  const quieta = await q.$eval(".ejf-hoja .ejd-demo-img.is-b", el => ({ anim: getComputedStyle(el).animationName, op: getComputedStyle(el).opacity }));
  const pausaVisible = await q.isVisible(".ejf-hoja [data-demo-pausa]");
  ok(quieta.anim === "none" && quieta.op === "1" && !pausaVisible, "con «reducir movimiento» se ven quietas, sin botón de pausa");
  await foto(q, `ficha-quieta-${ancho}.png`);
  await q.context().close();
}

// ---------- Fase 2: ficha completa ----------
async function fichaCompleta(browser, base, ancho) {
  console.log(`\nFicha completa (${ancho} px)`);
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#gimnasio", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
  consolaLimpia(p);
  // YouTube no se usa de verdad en la prueba (sin red externa): páginas vacías.
  await p.route(/youtube-nocookie\.com|ytimg\.com/, r => r.fulfill({ status: 200, contentType: r.request().url().includes("ytimg") ? "image/png" : "text/html", body: "" }));
  const pedidos = [];
  p.on("request", r => pedidos.push(r.url()));
  await p.waitForTimeout(1200);
  await sinAvisos(p);
  ok(!pedidos.some(u => u.includes("ejercicios-tecnica.json")), "al arrancar no se baja la técnica (carga diferida)");

  await p.click('#gym-routines .rut-ej-nombre[data-ficha="barbell-squat"]');
  await p.waitForTimeout(900);
  ok(pedidos.some(u => u.includes("ejercicios-tecnica.json")), "se baja al abrir la primera ficha");
  const pasos = await p.$$eval(".ejf-hoja .ejf-pasos li", els => els.map(e => e.textContent));
  ok(pasos.length >= 3 && pasos.length <= 5 && /espalda/.test(pasos.join(" ")), `«Cómo se hace»: ${pasos.length} pasos en español`);
  ok((await p.$$(".ejf-hoja .ejf-errores li")).length >= 2 && /Rodillas/.test(await texto(p, ".ejf-hoja .ejf-errores")), "y errores comunes");
  const href = await p.$eval('.ejf-hoja a.ejf-btn', a => a.href);
  ok(/youtube\.com\/results\?search_query=/.test(href) && /sentadilla con barra/.test(decodeURIComponent(href)), "«Ver video» busca en YouTube «cómo hacer sentadilla con barra»");
  ok(await p.$eval('.ejf-hoja a.ejf-btn', a => a.target === "_blank"), "en otra pestaña");
  await foto(p, `ficha-como-${ancho}.png`);

  // Mi video
  await p.fill("#ejf-video-in", "https://vimeo.com/123");
  await p.click('.ejf-hoja [data-ejf-form="video"] button[type="submit"]');
  await p.waitForTimeout(200);
  ok(await p.isVisible(".ejf-hoja .ejf-error"), "un link que no es de YouTube avisa");
  await p.fill("#ejf-video-in", "https://youtu.be/dQw4w9WgXcQ");
  await p.click('.ejf-hoja [data-ejf-form="video"] button[type="submit"]');
  await p.waitForTimeout(400);
  const mini = await p.$eval(".ejf-hoja .ejf-video-mini img", i => i.getAttribute("src")).catch(() => "");
  ok(mini === "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" && !(await p.$(".ejf-hoja iframe")), "«Mi video»: se ve la miniatura y el reproductor todavía no carga");
  await p.click(".ejf-hoja [data-ejf='ver-video']");
  await p.waitForTimeout(300);
  ok(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(await p.$eval(".ejf-hoja iframe", f => f.getAttribute("src")).catch(() => "")), "al tocar, carga el reproductor sin cookies");
  const guardado = await p.evaluate(() => EjercicioDatos.meta("ejercicio_fichas").get().then(d => d.data()));
  ok(guardado && guardado["barbell-squat"] && guardado["barbell-squat"].video === "dQw4w9WgXcQ", "queda guardado en meta/ejercicio_fichas");

  // Historial
  await p.click('.ejf-hoja [data-ejf-tab="historial"]');
  await p.waitForTimeout(300);
  const kpis = await texto(p, ".ejf-hoja .ejf-kpis");
  ok(/Última vez\s*hace 7 días\s*29 oct/.test(kpis), `historial: última vez (${kpis})`);
  ok(/Mejor serie\s*105 kg × 8/.test(kpis) && /1RM estimado\s*133 kg/.test(kpis), "mejor serie (105 kg × 8) y 1RM estimado (133 kg)");
  ok((await p.$$(".ejf-hoja .ejf-graf svg")).length === 2, "gráficos de 1RM estimado y volumen por sesión");
  await p.click(".ejf-hoja .ejf-graf >> nth=0 >> .hbg-hit >> nth=-1");
  await p.waitForTimeout(150);
  ok(/29 oct: 133 kg/.test(await texto(p, ".ejf-hoja .ejf-graf .ejf-tip")), "tocar el gráfico muestra la sesión");
  ok((await p.$$(".ejf-hoja .ejf-sesiones li")).length === 6 && /29 oct\s*4 × 8 · 8 · 8 · \d con 105 kg/.test(await texto(p, ".ejf-hoja .ejf-sesiones li:first-child")), `últimas sesiones (${await texto(p, ".ejf-hoja .ejf-sesiones li:first-child")})`);
  await foto(p, `ficha-historial-${ancho}.png`);

  // Récords y rango
  await p.click('.ejf-hoja [data-ejf-tab="records"]');
  await p.waitForTimeout(300);
  ok((await p.$$(".ejf-hoja .ejf-recs tbody tr")).length === 12, "récords de 1RM a 12RM");
  ok(/8RM\s*105 kg/.test(await texto(p, ".ejf-hoja .ejf-recs tbody tr:nth-child(8)")), "8RM real: 105 kg");
  ok(await p.$(".ejf-hoja .ejf-rango"), "su rango, con enlace a Rangos");
  await foto(p, `ficha-records-${ancho}.png`);

  // Notas
  await p.fill(".ejf-hoja [data-ejf-nota]", "Barra baja, pies 30°");
  await p.$eval(".ejf-hoja [data-ejf-nota]", t => t.dispatchEvent(new Event("change", { bubbles: true })));
  await p.waitForTimeout(300);
  const nota = await p.evaluate(() => EjercicioDatos.meta("ejercicio_fichas").get().then(d => d.data()["barbell-squat"].nota));
  ok(nota === "Barra baja, pies 30°", "mis notas se guardan");

  // Alternativas: abrir una y volver.
  const alts = await p.$$eval(".ejf-hoja .ejf-alts button span:first-child", els => els.map(e => e.textContent));
  ok(alts.length >= 3 && alts.some(a => /Prensa|Sentadilla/.test(a)), `alternativas: ${alts.join(", ")}`);
  await p.click(".ejf-hoja .ejf-alts button >> nth=0");
  await p.waitForTimeout(400);
  ok((await texto(p, "#ejf-titulo")) === alts[0] && /Sentadilla \(Barra\)/.test(await texto(p, ".ejf-hoja .ejf-volver")), "tocar una alternativa abre su ficha (con ‹ volver)");
  await p.click(".ejf-hoja .ejf-volver");
  await p.waitForTimeout(300);
  ok(/Sentadilla \(Barra\)/.test(await texto(p, "#ejf-titulo")), "‹ vuelve a la anterior");

  // Rango ›
  await p.click(".ejf-hoja .ejf-rango").catch(() => {});
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => location.hash) === "#ej-rangos" && await p.isVisible(".rk-ver-ficha"), "«Rango ›» abre el ejercicio en Rangos");
  // Desde Rangos: «Cómo se hace»
  await p.click(".rk-ver-ficha");
  await p.waitForTimeout(500);
  ok(await p.isVisible(".ejf-hoja .muscle-sheet-panel") && /Sentadilla/.test(await texto(p, "#ejf-titulo")), "en Rangos, «Cómo se hace» abre la ficha encima");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);

  // Desde el detalle de una sesión (Perfil › Tus sesiones).
  await ir(p, "ej-perfil", 900);
  await p.click("#ejp-historial .ejf-tarjeta, #ejp-historial article >> nth=0").catch(() => {});
  await p.waitForTimeout(500);
  const nombreSes = await p.$("#ejs-hoja .ejs-ej-nombre");
  if (nombreSes) { await nombreSes.click(); await p.waitForTimeout(500); }
  ok(!!nombreSes && await p.isVisible(".ejf-hoja .muscle-sheet-panel"), "en el detalle de una sesión, el nombre abre la ficha");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  const cerrarSes = await p.$("#ejs-cerrar");
  if (cerrarSes && await cerrarSes.isVisible()) { await cerrarSes.click(); await p.waitForTimeout(300); }

  // Desde el buscador (agregar ejercicio en un entreno vacío).
  await ir(p, "gimnasio", 700);
  await p.click("#gym-start-empty");
  await p.waitForTimeout(600);
  await p.fill("#gym-active-exercise-name", "press militar");
  await p.waitForTimeout(400);
  const info = await p.$(".ex-sug-info");
  ok(!!info, "el buscador muestra «?» en cada opción");
  if (info) { await info.click(); await p.waitForTimeout(500); }
  ok(await p.isVisible(".ejf-hoja .muscle-sheet-panel") && /Press militar/.test(await texto(p, "#ejf-titulo")), "«?» abre la ficha sin agregar el ejercicio");
  ok((await p.$$("#gym-active-exercises .gx-ej")).length === 0, "el entreno sigue vacío");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await p.evaluate(() => { const d = document.getElementById("gym-active-discard"); d.click(); });
  await p.waitForTimeout(400);

  // Editor de rutinas: «?» junto al nombre, que ya no se corta.
  await p.click('[data-rut-menu="empuje"]');
  await p.waitForTimeout(300);
  await p.click('[data-rut-accion="editar"]');
  await p.waitForTimeout(500);
  const ancho1 = await p.$eval('#rut-items [data-rut-item="1"] .rut-in-nombre', i => i.scrollWidth <= i.clientWidth + 1);
  ok(ancho1, "en el editor, «Press de banca inclinado (Mancuerna)» entra completo");
  await p.click('#rut-items [data-rut-item="0"] .rut-item-ficha');
  await p.waitForTimeout(500);
  ok(/Press de banca \(Barra\)/.test(await texto(p, "#ejf-titulo")), "y «?» abre su ficha");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await foto(p, `rut-editor-${ancho}.png`);
  ok(!p.errores.length && !p.erroresConsola.length, `sin errores (${p.erroresConsola.join(" | ")})`);
  await p.context().close();
}

// ---------- Fase 1: caché de las demos en el service worker ----------
// Contexto aparte con service workers permitidos (las demás pruebas los bloquean).
async function cacheDemos(browser) {
  console.log("\nService worker: demos fuera del precache y con caché propia");
  const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" };
  const pedidos = [];
  const srv = await new Promise(res => {
    const s = http.createServer((req, resp) => {
      const ruta = decodeURIComponent(req.url.split("?")[0]);
      if (ruta.startsWith("/img/ejercicios/")) pedidos.push(ruta);
      const archivo = path.join(RAIZ, ruta === "/" ? "index.html" : ruta);
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(resp);
    }).listen(0, () => res(s));
  });
  const base = `http://localhost:${srv.address().port}`;
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  await ctx.route(/gstatic|googleapis/, r => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${base}/index.html#inicio`);
  const activo = await p.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(r => !!r.active), new Promise(r => setTimeout(() => r(false), 20000))]));
  ok(activo, "el service worker queda activo");
  ok(!pedidos.length, "instalar la app no descarga ninguna demo");
  await p.reload();
  await p.evaluate(() => new Promise(r => { if (navigator.serviceWorker.controller) r(); else navigator.serviceWorker.addEventListener("controllerchange", r); }));
  // Ver una ficha = pedir sus 2 imágenes.
  await p.evaluate(async () => { for (const u of ["img/ejercicios/barbell-squat/0.webp?v=1", "img/ejercicios/barbell-squat/1.webp?v=1"]) await (await fetch(u)).blob(); });
  const c1 = await p.evaluate(async () => {
    const nombres = await caches.keys();
    const app = nombres.find(n => n.startsWith("manolo-app-"));
    const enApp = (await (await caches.open(app)).keys()).filter(r => r.url.includes("/img/ejercicios/")).length;
    const vistas = (await (await caches.open("manolo-demos")).keys()).map(r => new URL(r.url).pathname);
    return { enApp, vistas };
  });
  ok(c1.enApp === 0, "las demos no entran en la caché de la app (precache)");
  ok(c1.vistas.length === 2 && c1.vistas.every(v => v.includes("barbell-squat")), "quedan en la caché de demos");
  // Sin red, la misma demo sigue saliendo de la copia.
  const antes = pedidos.length;
  await p.evaluate(async () => { await (await fetch("img/ejercicios/barbell-squat/0.webp?v=1")).blob(); });
  ok(pedidos.length === antes, "la segunda vez sale de la copia (sin red)");
  // Precarga de las rutinas: se guardan aparte y se reemplazan.
  const lista = ["pullups", "face-pull"].flatMap(id => [0, 1].map(i => `${base}/img/ejercicios/${id}/${i}.webp?v=1`));
  const rut = await p.evaluate(async urls => {
    navigator.serviceWorker.controller.postMessage({ tipo: "demos", urls });
    for (let i = 0; i < 40; i++) {
      const n = (await (await caches.open("manolo-demos-rutinas")).keys()).length;
      if (n >= 4) break;
      await new Promise(r => setTimeout(r, 150));
    }
    return (await (await caches.open("manolo-demos-rutinas")).keys()).map(r => new URL(r.url).pathname);
  }, lista);
  ok(rut.length === 4 && rut.some(u => u.includes("pullups")) && rut.some(u => u.includes("face-pull")), "precarga: las demos de tus rutinas quedan guardadas aparte");
  const rut2 = await p.evaluate(async url => {
    navigator.serviceWorker.controller.postMessage({ tipo: "demos", urls: [url] });
    for (let i = 0; i < 40; i++) {
      const n = (await (await caches.open("manolo-demos-rutinas")).keys()).length;
      if (n === 1) break;
      await new Promise(r => setTimeout(r, 150));
    }
    return (await (await caches.open("manolo-demos-rutinas")).keys()).map(r => new URL(r.url).pathname);
  }, lista[0]);
  ok(rut2.length === 1, "si cambian tus rutinas, se borran las que ya no están");
  await ctx.close();
  srv.close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [390, 1280]) { await demos(browser, base, ancho); await fichaCompleta(browser, base, ancho); }
  await cacheDemos(browser);
  await terminar(browser, srv);
})();
