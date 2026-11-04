// Pruebas de pantalla de Compartir (Running, fase 7): imagen 1080 × 1920
// con la ruta y las cifras, fondo oscuro o transparente, el menú de
// compartir del teléfono (simulado) y, sin él, la descarga del PNG.
// Uso: node scripts/e2e/run-compartir.js [carpeta-para-capturas]
const fs = require("node:fs");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");
const F = require("../../js/run-formatos.js");
const M = require("../../js/run-metricas.js");
const G = require("../../js/run-guardar.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const ps = X.puntos({ segundos: 3000, vel: 3.3, inicio: Date.parse("2026-11-03T06:42:00-04:00") }).map((p, i) => Object.assign(p, { lon: p.lon + Math.sin(i / 250) * 0.008 }));
const { campos, ruta } = M.calcular(F.leer(X.fit(ps), "x.fit"), {});
const DOC = Object.assign(G.documento({ deporte: "running", origen: { idExterno: "a" }, campos, titulo: "Fondo por el Prado" }, 1), { lugar: "Sopocachi, La Paz" });
const SEED = { "users/test/running": { imp_a: DOC, m1: { date: "2026-10-30", distance: 5, duration: 27 } }, "users/test/rutas": { imp_a: ruta } };
// Lee un píxel de la vista previa (esquina y centro de la ruta).
const pixel = (p, x, y) => p.evaluate(([x, y]) => new Promise(res => {
  const img = document.querySelector("#rcm-previa img");
  const ir = () => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext("2d"); g.drawImage(img, 0, 0); res({ ancho: img.naturalWidth, alto: img.naturalHeight, rgba: Array.from(g.getImageData(x, y, 1, 1).data) }); };
  if (img.complete && img.naturalWidth) ir(); else img.onload = ir;
}), [x, y]);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#run-actividad/running/imp_a", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  await p.waitForSelector("#rd-perfil:not([hidden])", { timeout: 8000 });

  console.log("\nImagen con fondo oscuro");
  await p.click('.rd-acciones [data-rd="compartir"]');
  await p.waitForSelector("#rcm-previa img", { timeout: 8000 });
  let px = await pixel(p, 5, 5);
  ok(px.ancho === 1080 && px.alto === 1920, `1080 × 1920 (${px.ancho} × ${px.alto})`);
  ok(px.rgba[3] === 255 && px.rgba[0] < 40, `fondo oscuro (${px.rgba})`);
  ok(await p.$eval('[data-rcm-fondo="oscuro"]', b => b.classList.contains("active")), "«Fondo oscuro» elegido");
  await captura(p, "run-compartir.png");

  console.log("Transparente");
  await p.click('[data-rcm-fondo="transparente"]');
  await p.waitForSelector("#rcm-previa img.is-transparente", { timeout: 8000 });
  px = await pixel(p, 5, 5);
  ok(px.rgba[3] === 0, `esquina transparente (alfa ${px.rgba[3]})`);
  const centro = await pixel(p, 540, 1480);
  ok(centro.rgba[3] > 0, "las cifras se ven (no todo es transparente)");

  console.log("Sin menú de compartir: descarga");
  const [descarga] = await Promise.all([p.waitForEvent("download"), p.click('[data-rcm="compartir"]')]);
  ok(descarga.suggestedFilename() === "2026-11-03-fondo-por-el-prado.png", `nombre (${descarga.suggestedFilename()})`);
  const bytes = fs.readFileSync(await descarga.path());
  ok(bytes.slice(1, 4).toString() === "PNG" && bytes.length > 5000, `es un PNG (${bytes.length} bytes)`);
  await p.waitForTimeout(300);
  ok(await p.$eval("#rc-compartir", h => h.hidden), "la hoja se cierra");

  console.log("Carrera a mano (sin ruta)");
  await p.evaluate(() => { location.hash = "run-actividad/running/m1"; });
  await p.waitForSelector("#rd-app .rd-titulo");
  await p.click('.rd-acciones [data-rd="compartir"]');
  await p.waitForSelector("#rcm-previa img", { timeout: 8000 });
  ok((await pixel(p, 540, 300)).ancho === 1080, "también se puede compartir");
  ok(p.errores.length === 0, "sin errores en la página");
  await p.context().close();

  console.log("\nCon el menú de compartir del teléfono");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#run-actividad/running/imp_a", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  await q.context().addInitScript(() => {
    window.__compartido = [];
    navigator.canShare = d => !!(d && d.files && d.files.length);
    navigator.share = d => { window.__compartido.push(d.files.map(f => [f.name, f.type, f.size])); return Promise.resolve(); };
  });
  await q.reload();
  await q.waitForSelector("#rd-app .rd-titulo");
  await q.click('[data-rd="menu"]');
  await q.click('.rd-menu-lista [data-rd="compartir"]');
  await q.waitForSelector("#rcm-previa img", { timeout: 8000 });
  ok((await q.$eval('[data-rcm="compartir"]', b => b.textContent)) === "Compartir", "el botón dice «Compartir»");
  await q.click('[data-rcm="compartir"]');
  await q.waitForTimeout(400);
  const c = await q.evaluate(() => window.__compartido);
  ok(c.length === 1 && c[0][0][0] === "2026-11-03-fondo-por-el-prado.png" && c[0][0][1] === "image/png" && c[0][0][2] > 5000, `abre el menú con el PNG (${JSON.stringify(c)})`);
  ok(q.errores.length === 0, "sin errores");
  await terminar(browser, srv);
})();
