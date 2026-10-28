// Pruebas de pantalla del calendario anual de Ejercicio › Perfil
// (js/ej-anual.js). Uso: node scripts/e2e/ej-calendario.js [carpeta-para-capturas]
const fs = require("fs");
const path = require("path");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const HOY = "2026-10-29T08:00:00-04:00";
const w = (date, name) => ({ date, name, startedAt: Date.parse(date + "T18:00:00Z"), durationMin: 60, exercises: [] });
const SEED = { "users/test/entrenamientos": {
  e1: w("2026-01-02", "Pecho y tríceps"), e2: w("2026-01-02", "Cardio"), e3: w("2026-01-05", "Pierna"), e4: w("2026-01-07", "Espalda"),
  e5: w("2026-02-03", "Hombro"), e6: w("2026-04-14", "Full body"), e7: w("2026-09-17", "Pierna"), e8: w("2026-10-28", "Pecho"),
  e9: w("2025-12-30", "Espalda")
} };

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#ej-perfil", zona: "America/La_Paz", fecha: HOY });
  await p.waitForTimeout(1200);
  const tx = sel => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());

  console.log("\nCalendario anual en Perfil");
  ok((await tx("#ejc-anual .ejc-titulo")) === "Entrenamientos de 2026", "título «Entrenamientos de 2026»");
  ok((await p.$$("#ejc-anual .ejc-mes")).length === 12, "los 12 meses");
  const meses = await p.$$eval("#ejc-anual .ejc-mes-n", els => els.map(e => e.textContent).join(" "));
  ok(meses === "ene feb mar abr may jun jul ago sep oct nov dic", "en orden");
  const on = await p.$$eval("#ejc-anual .ejc-d.is-on", els => els.map(e => e.dataset.ejcDia));
  ok(on.join(",") === "2026-01-02,2026-01-05,2026-01-07,2026-02-03,2026-04-14,2026-09-17,2026-10-28", `en azul los días entrenados (${on.length})`);
  ok(/7 días entrenados · 8 sesiones/.test(await tx("#ejc-anual .ejc-resumen")), "resumen: días entrenados y sesiones");
  const ene = await p.$$eval("#ejc-anual .ejc-mes:first-child .ejc-grid > *", els => els.slice(0, 7).map(e => e.dataset.ejcDia ? Number(e.dataset.ejcDia.slice(8)) : null));
  ok(JSON.stringify(ene) === JSON.stringify([null, null, null, 1, 2, 3, 4]), "semanas de lunes a domingo (1 de enero de 2026 = jueves)");
  ok(await p.$eval('[data-ejc-dia="2026-10-29"]', e => e.classList.contains("is-hoy")) && await p.$eval('[data-ejc-dia="2026-11-15"]', e => e.classList.contains("is-futuro")), "hoy marcado y días futuros más apagados");
  ok((await tx("#ejc-anual .ejc-usuario")) === "@test", "abajo, MANOLO y tu usuario");
  await captura(p, "ejc-perfil.png");
  if (CAPTURAS) await (await p.$("#ejc-anual .ejc-tarjeta")).screenshot({ path: path.join(CAPTURAS, "ejc-tarjeta.png") });

  await p.click('[data-ejc-dia="2026-01-02"]');
  await p.waitForTimeout(150);
  ok((await tx("#ejc-anual .ejc-dia")) === "vie 2 de enero: Pecho y tríceps · Cardio", "tocar un día dice qué entrenaste");
  await p.click('[data-ejc-dia="2026-01-03"]');
  await p.waitForTimeout(150);
  ok(/sin entrenamiento/.test(await tx("#ejc-anual .ejc-dia")), "un día sin entrenar lo dice");

  ok(await p.$eval('[data-ejc-anio="1"]', b => b.disabled), "no se puede pasar del año actual");
  await p.click('[data-ejc-anio="-1"]');
  await p.waitForTimeout(150);
  ok((await tx("#ejc-anual .ejc-titulo")) === "Entrenamientos de 2025" && (await p.$$("#ejc-anual .ejc-d.is-on")).length === 1, "‹ va a 2025 (con su entrenamiento)");
  ok(await p.$eval('[data-ejc-anio="-1"]', b => b.disabled), "y no antes del primer entrenamiento");
  await p.click('[data-ejc-anio="1"]');
  await p.waitForTimeout(150);

  console.log("\nImagen para compartir");
  const [d] = await Promise.all([p.waitForEvent("download"), p.click('[data-ejc="compartir"]')]);
  const png = fs.readFileSync(await d.path());
  ok(d.suggestedFilename() === "manolo-entrenamientos-2026.png" && png.slice(1, 4).toString() === "PNG", "«Compartir imagen» arma un PNG (en la compu se descarga)");
  ok(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1350, "de 1080 × 1350 (formato de Instagram)");
  if (CAPTURAS) fs.writeFileSync(path.join(CAPTURAS, "ejc-imagen.png"), png);

  await p.setViewportSize({ width: 320, height: 700 });
  await p.waitForTimeout(200);
  ok((await p.$eval("html", el => el.scrollWidth - el.clientWidth)) <= 0, "cabe a 320 px");
  ok(await p.$("#ejd-dash") && await p.$("#ejp-historial"), "el resto de Perfil sigue ahí");
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();
  await terminar(browser, srv);
})();
