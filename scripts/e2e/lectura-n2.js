// Pruebas de pantalla de "Libros, Biblia y Medir tiempos: siguiente nivel"
// (docs/LECTURA_NIVEL2.md). Las corre scripts/e2e/lectura.js (y
// SOLO=biblia|… para correr una parte). Datos: lectura-semilla.js.
const { abrir, ok } = require("./comun.js");
const SEM = require("./lectura-semilla.js");

const ZONA = "America/La_Paz";
const HOY = "2026-11-06";
const FECHA = `${HOY}T07:30:00-04:00`;
const txt = (p, sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim()).catch(() => "");
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"; }, sel);
const sinDesborde = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const metaDe = (p, doc) => p.evaluate(d => (window.__fakeStore.colMap("users/test/meta").get(d) || null), doc);
function consola(p) {
  p.consola = [];
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) p.consola.push(m.text()); });
}
async function deslizar(p, sel, dx) {
  await p.evaluate(([s, d]) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + 200;
    const t = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { touches: [t(x)], changedTouches: [t(x)], bubbles: true }));
    el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t(x + d)], bubbles: true }));
  }, [sel, dx]);
}

// ---------- Fase 1: lector de la Biblia ----------
async function bibliaLector(browser, base, ancho, captura) {
  console.log(`\nBiblia: lector RV1909 (${ancho} px)`);
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#biblia", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
  consola(p);
  await p.waitForTimeout(900);
  ok(/Leer la Biblia/.test(await txt(p, '[data-bib="leer"]')), "arriba, «Leer la Biblia»");
  await p.click('[data-bib="leer"]');
  await p.waitForTimeout(700);
  ok(await visible(p, "#bbl-lector") && (await txt(p, "#bbl-donde-t")) === "Mateo 1", "abre el lector en Mateo 1 la primera vez");
  const cubre = await p.$eval("#bbl-lector", el => { const r = el.getBoundingClientRect(); return r.top === 0 && Math.round(r.height) === innerHeight; });
  ok(cubre, "el lector ocupa toda la pantalla (sin distracciones)");
  ok(/Libro de la generación de Jesucristo/.test(await txt(p, "#bbl-v1")), "con el texto y los números de versículo");

  // Elegir libro y capítulo
  await p.click('[data-bbl="elegir"]');
  await p.waitForTimeout(300);
  ok((await p.$$(".bbl-hoja-sel [data-bbl-libro]")).length === 66, "el selector tiene los 66 libros");
  await p.fill(".bbl-sel-buscar", "juan");
  await p.waitForTimeout(150);
  const encontrados = await p.$$eval(".bbl-hoja-sel [data-bbl-libro] span", els => els.map(e => e.textContent));
  ok(encontrados.join() === "Juan,1 Juan,2 Juan,3 Juan", `buscar libro: ${encontrados.join(", ")}`);
  await p.click('.bbl-hoja-sel [data-bbl-libro="John"]');
  await p.waitForTimeout(250);
  ok((await p.$$(".bbl-hoja-sel [data-bbl-ir]")).length === 21, "Juan muestra sus 21 capítulos");
  await captura(p, `biblia-lector-capitulos-${ancho}.png`);
  await p.click('.bbl-hoja-sel [data-bbl-ir="John.3"]');
  await p.waitForTimeout(600);
  ok((await txt(p, "#bbl-donde-t")) === "Juan 3", "abre Juan 3");
  const v16 = await txt(p, "#bbl-v16");
  ok(/de tal manera amó Dios al mundo, que ha dado a su Hijo/.test(v16), "Juan 3:16 con ortografía actual («a su Hijo»)");
  await captura(p, `biblia-lector-${ancho}.png`);

  // Letra y ortografía
  const tam0 = await p.$eval("#bbl-texto", e => parseFloat(getComputedStyle(e).fontSize));
  await p.click('[data-bbl="aa"]');
  await p.waitForTimeout(300);
  await p.click('.bbl-hoja-aa [data-bbl-tam="1"]');
  await p.click('.bbl-hoja-aa [data-bbl-op="actual"]');
  await p.waitForTimeout(200);
  const tam1 = await p.$eval("#bbl-texto", e => parseFloat(getComputedStyle(e).fontSize));
  ok(tam1 > tam0, `A+ agranda la letra (${tam0} → ${tam1} px)`);
  ok(/que ha dado á su Hijo/.test(await txt(p, "#bbl-v16")), "sin «ortografía actual», el texto original («á su Hijo»)");
  await p.click('.bbl-hoja-aa [data-bbl-op="actual"]');
  await p.waitForTimeout(200);
  ok(/ha dado a su Hijo/.test(await txt(p, "#bbl-v16")), "y se vuelve a activar");
  await p.click(".bbl-hoja-aa .budget-sheet-close");
  await p.waitForTimeout(300);

  // Marcar como leído
  await p.evaluate(() => document.getElementById("bbl-scroll").scrollTo(0, 1e6));
  await p.click('[data-bbl="leido"]');
  await p.waitForTimeout(400);
  const leidos = await metaDe(p, "biblia_leidos");
  ok(leidos && JSON.stringify(leidos.dias[HOY]) === '["John.3"]', "«Marcar como leído» guarda Juan 3 en el día de hoy");
  ok(/Leído hoy/.test(await txt(p, ".bbl-fin")), "y dice «✓ Leído hoy»");
  const link = await p.$eval(".bbl-otra", a => a.href);
  ok(link === "https://www.biblegateway.com/passage/?search=John%203&version=RVR1960", "«Abrir en otra versión» abre Juan 3 en la RVR1960 (solo un link)");
  await captura(p, `biblia-lector-fin-${ancho}.png`);
  await p.click('[data-bbl="elegir"]');
  await p.waitForTimeout(250);
  ok(/1\/21/.test(await txt(p, '.bbl-hoja-sel [data-bbl-libro="John"]')), "en el selector, Juan dice 1/21 leídos");
  await p.click('.bbl-hoja-sel [data-bbl-libro="John"]');
  await p.waitForTimeout(200);
  ok(await p.$eval('.bbl-hoja-sel [data-bbl-ir="John.3"]', b => b.classList.contains("is-leido")), "y el capítulo 3 sale marcado");
  await p.click(".bbl-hoja-sel .budget-sheet-close");
  await p.waitForTimeout(300);

  // Pasar de capítulo
  await p.click('.bbl-fin [data-bbl-ir="John.4"]');
  await p.waitForTimeout(400);
  ok((await txt(p, "#bbl-donde-t")) === "Juan 4", "«Juan 4 ›» pasa al siguiente");
  if (ancho <= 800) await deslizar(p, "#bbl-scroll", -160);
  else await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(400);
  ok((await txt(p, "#bbl-donde-t")) === "Juan 5", ancho <= 800 ? "deslizar a la izquierda pasa a Juan 5" : "la flecha → pasa a Juan 5");
  ok(await sinDesborde(p), "sin desborde horizontal");

  // Cerrar y seguir donde quedé
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);
  ok(!(await visible(p, "#bbl-lector")), "✕ cierra el lector");
  ok(/Seguir leyendo.*Juan 5/.test(await txt(p, '[data-bib="leer"]')), "la tarjeta dice «Seguir leyendo · Juan 5»");
  await p.waitForTimeout(1600);
  const lector = await metaDe(p, "biblia_lector");
  ok(lector && lector.ultimo && lector.ultimo.libro === "John" && lector.ultimo.cap === 5, "el último lugar se guarda en la cuenta");
  await p.click('[data-bib="leer"]');
  await p.waitForTimeout(500);
  ok((await txt(p, "#bbl-donde-t")) === "Juan 5", "al volver, sigue en Juan 5");
  await p.goBack();
  await p.waitForTimeout(400);
  ok(!(await visible(p, "#bbl-lector")) && await visible(p, "#panel-biblia"), "atrás (gesto del iPhone) cierra el lector y queda en Biblia");

  // Descargar para usar sin internet
  await p.click('[data-bib="leer"]');
  await p.waitForTimeout(400);
  await p.click('[data-bbl="aa"]');
  await p.waitForTimeout(400);
  await p.click('.bbl-hoja-aa [data-bbl="descargar"]');
  for (let i = 0; i < 60 && !/está descargada/.test(await txt(p, "#bbl-descarga")); i++) await p.waitForTimeout(250);
  ok(/está descargada/.test(await txt(p, "#bbl-descarga")), "«Descargar la Biblia» guarda los 66 libros");
  ok(await p.evaluate(async () => (await (await caches.open("manolo-biblia")).keys()).length) === 66, "en la caché propia (66 archivos)");
  await captura(p, `biblia-lector-ajustes-${ancho}.png`);
  await p.click(".bbl-hoja-aa .budget-sheet-close");
  await p.waitForTimeout(300);
  await p.context().setOffline(true);
  await p.click('[data-bbl="elegir"]');
  await p.fill(".bbl-sel-buscar", "abdias");
  await p.click('.bbl-hoja-sel [data-bbl-libro="Obad"]');
  await p.waitForTimeout(600);
  ok((await txt(p, "#bbl-donde-t")) === "Abdías 1" && /Visión de Abdías/.test(await txt(p, "#bbl-v1")), "sin internet se lee un libro descargado (Abdías)");
  await p.context().setOffline(false);
  await p.click('[data-bbl="aa"]');
  await p.waitForTimeout(400);
  await p.click('.bbl-hoja-aa [data-bbl="quitar-descarga"]');
  await p.waitForTimeout(500);
  ok(/Descargar la Biblia/.test(await txt(p, "#bbl-descarga")), "«Quitar la descarga» la borra");
  await p.click(".bbl-hoja-aa .budget-sheet-close");
  await p.waitForTimeout(300);
  await p.context().setOffline(true);
  await p.click('[data-bbl="elegir"]');
  await p.fill(".bbl-sel-buscar", "rut");
  await p.click('.bbl-hoja-sel [data-bbl-libro="Ruth"]');
  await p.waitForTimeout(300);
  await p.click('.bbl-hoja-sel [data-bbl-ir="Ruth.1"]');
  await p.waitForTimeout(600);
  ok(/No se pudo abrir Rut/.test(await txt(p, ".bbl-error")), "sin internet y sin descargar, lo explica");
  await p.context().setOffline(false);
  await p.click('[data-bbl="reintentar"]');
  await p.waitForTimeout(700);
  ok(/Elimelech|Elimelec/.test(await txt(p, "#bbl-texto")), "con internet, «Intentar otra vez» lo abre");
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

module.exports = { bibliaLector, txt, visible, sinDesborde, metaDe, consola, deslizar, HOY, FECHA, ZONA };
