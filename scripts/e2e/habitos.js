// Pruebas de pantalla de Hábitos (categorías, Temporada 2, Hoy, página de
// categoría, Estadísticas, se marca solo, copia). A 390 y 1280 px.
// Datos realistas de scripts/e2e/habitos-semilla.js.
// Uso: node scripts/e2e/habitos.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const SEM = require("./habitos-semilla.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-05";
const FECHA = `${HOY}T09:10:00-04:00`;
const texto = (p, sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
const juego = p => p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("habitos_juego") || {});
const consolaLimpia = p => { p.consola = []; p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) p.consola.push(m.text()); }); };

// Snapshot como lo dejaba la versión anterior (Temporada 1): nivel 16 y
// rangos altos por las reglas fáciles de antes.
const SNAP_T1 = {
  nivel: 16,
  rangos: { agua: 13, meditar: 14, orar: 14, estirar: 12, correr: 15, leer: 15, gastos: 16, mama: 15, azucar: 17 },
  logros: ["primer_paso", "registros_100", "racha_7", "perfecto_1", "nivel_5", "nivel_10", "rango_oro", "coleccion", "equilibrio"],
  misiones: [], perfectos: [], jefes: []
};

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Temporada 2 a ${ancho} px`);
    const estado = SEM.estado(HOY);
    estado.__SEED__["users/test/meta"].habitos_juego.snapshot = SNAP_T1;
    const p = await abrir(browser, base, estado, { hash: "#habitos", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
    consolaLimpia(p);
    await p.waitForTimeout(600);
    ok(await p.isVisible(".hb-sheet .hb-temp-nivel"), "aparece «Temporada 2: ahora subir cuesta más»");
    ok(!(await p.$(".hb-celebra")), "sin celebraciones ni avisos");
    const t = await texto(p, ".hb-temp-nivel");
    ok(/^16 ?Antes · Disciplinado → \d ?Ahora · (Principiante|Aprendiz)$/.test(t), `nivel antes y ahora (${t})`);
    ok((await p.$$(".hb-temp-rangos li")).length === 6, "muestra los rangos de antes y de ahora");
    await captura(p, `hab-temporada-${ancho}.png`);
    let j = await juego(p);
    ok(j.calibracion === 2 && j.temporada1 && j.temporada1.nivel === 16 && j.temporada1.rangos.azucar === 17, "guarda la calibración y la Temporada 1");
    ok(j.snapshot.nivel < 16 && SNAP_T1.logros.every(l => j.snapshot.logros.includes(l)), "snapshot nuevo en silencio con los logros conservados");
    await p.click("[data-temporada-visto]");
    await p.waitForTimeout(400);
    j = await juego(p);
    ok(j.temporada1.visto === true, "«Entendido» la marca como vista");
    await p.reload();
    await p.waitForTimeout(900);
    ok(!(await p.isVisible(".hb-temp-nivel")) && !(await p.$(".hb-celebra")), "al volver a abrir no aparece de nuevo ni celebra");

    // Detalle: por qué cuesta
    await p.click('[data-detalle="leer"]');
    await p.waitForTimeout(400);
    const porque = await texto(p, ".hb-rango-porque");
    ok(/^Con tu \d+ % de los últimos 90 días, tu techo es \S+; para \S+ necesitas ~\d+ %\. Cumpliendo todo lo que toca, llegas a .+ en .+\. Un fallo suelto no te baja; 3 seguidos sí\.$/.test(porque), `detalle explica el techo (${porque})`);
    await captura(p, `hab-detalle-rango-${ancho}.png`);
    await p.click(".hb-sheet .muscle-sheet-close");
    await p.waitForTimeout(300);

    // Logros: Temporada 1, logros conservados y XP que falta
    await p.evaluate(() => { location.hash = "hab-logros"; });
    await p.waitForTimeout(500);
    ok(/^Te faltan [\d.]+ XP para el nivel \d+: a tu ritmo \(~\d+ XP por día\), .+\.$/.test(await texto(p, ".hb-nivel-ritmo")), "nivel: XP que falta y cuánto tardarías");
    await p.click('[data-hb-tab="logros"]');
    await p.waitForTimeout(300);
    ok(/Temporada 1 · hasta el 5 nov Nivel 16 · Disciplinado/.test(await texto(p, ".hb-temporada")), "Logros muestra la Temporada 1");
    const conseguidos = await p.$$eval(".hb-logro.is-on b", els => els.map(e => e.textContent));
    ok(["Nivel 10", "De oro", "Equilibrio"].every(n => conseguidos.includes(n)), "los logros ganados se quedan (Nivel 10, De oro…)");
    await captura(p, `hab-logros-t1-${ancho}.png`);
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  console.log("\n=== Sin historia: no hay hoja de temporada");
  const q = await abrir(browser, base, {}, { hash: "#habitos", zona: ZONA, fecha: FECHA });
  await q.waitForTimeout(500);
  ok(!(await q.isVisible(".hb-temp-nivel")), "un usuario nuevo no ve la Temporada 2");
  await q.context().close();

  await terminar(browser, srv);
})();
