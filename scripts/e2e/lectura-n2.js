// Pruebas de pantalla de "Libros, Biblia y Medir tiempos: siguiente nivel"
// (docs/LECTURA_NIVEL2.md). Las corre scripts/e2e/lectura.js (y
// SOLO=biblia|… para correr una parte). Datos: lectura-semilla.js.
const fs = require("fs");
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

// ---------- Fase 2: tocar versículos, marcas, anotar, compartir y buscar ----------
async function bibliaMarcas(browser, base, ancho, captura) {
  console.log(`\nBiblia: resaltar, favoritos, notas, anotar, compartir y buscar (${ancho} px)`);
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#biblia", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
  consola(p);
  await p.waitForTimeout(900);
  const marcas = () => p.evaluate(() => window.__fakeStore.colMap("users/test/biblia_marcas").get("John") || null);
  const biblia = () => p.evaluate(() => Array.from(window.__fakeStore.colMap("users/test/biblia").values()));
  await p.evaluate(() => {
    navigator.canShare = () => true;
    navigator.share = async d => { window.__compartido = `${d.files[0].name}:${d.files[0].size}:${d.files[0].type}`; };
    window.__copiado = "";
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async t => { window.__copiado = t; } }, configurable: true });
  });
  await p.evaluate(() => BibliaLector.abrir("John", 3));
  await p.waitForTimeout(700);

  // Elegir versículos
  ok(!(await visible(p, ".bbl-selbar")), "sin elegir nada, no hay barra");
  await p.click("#bbl-v16");
  await p.click("#bbl-v17");
  await p.waitForTimeout(150);
  ok(await visible(p, ".bbl-selbar") && (await txt(p, ".bbl-sel-cab b")) === "Juan 3:16-17", "tocar 16 y 17 los elige: «Juan 3:16-17»");
  ok(await p.$eval("#bbl-v16", e => e.classList.contains("is-sel")), "se ven elegidos");
  const tam = await p.$$eval(".bbl-sel-acciones button, .bbl-color", bs => Math.min(...bs.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))));
  ok(tam >= 44, `botones de la barra de ${Math.round(tam)} px (≥ 44)`);
  await captura(p, `biblia-seleccion-${ancho}.png`);
  await p.click("#bbl-v17");
  ok((await txt(p, ".bbl-sel-cab b")) === "Juan 3:16", "tocar otra vez lo quita");
  await p.click("#bbl-v17");

  // Resaltar
  await p.click('[data-bbs-color="amarillo"]');
  await p.waitForTimeout(300);
  let m = await marcas();
  ok(m && m.col["3_16"] === "amarillo" && m.col["3_17"] === "amarillo", "resaltar en amarillo guarda los dos versículos");
  ok(await p.$eval("#bbl-v16", e => e.classList.contains("c-amarillo")) && !(await visible(p, ".bbl-selbar")), "se pinta y la barra se va");
  await p.click("#bbl-v17");
  await p.click('[data-bbs-color=""]');
  await p.waitForTimeout(300);
  m = await marcas();
  ok(m.col["3_16"] === "amarillo" && !("3_17" in m.col), "⊘ quita el resaltado del 17 (el 16 sigue)");

  // Favorito
  await p.click("#bbl-v16");
  await p.click('[data-bbs="fav"]');
  await p.waitForTimeout(300);
  m = await marcas();
  ok(m.it["3_16"] && m.it["3_16"].f === true && m.it["3_16"].r === "16" && /^Porque de tal manera amó Dios/.test(m.it["3_16"].t), "★ Favorito guarda la cita y su texto");
  ok(await p.$eval("#bbl-v16", e => e.classList.contains("is-fav")), "y se ve la estrella");

  // Nota
  await p.click("#bbl-v16");
  await p.click('[data-bbs="nota"]');
  await p.waitForTimeout(350);
  ok(/Nota · Juan 3:16/.test(await txt(p, "#bbl-hoja-nota-t")), "✎ Nota abre la hoja con la cita");
  await p.fill(".bbl-hoja-nota textarea", "Dios me ama a mí también");
  await p.click('.bbl-hoja-nota [type="submit"]');
  await p.waitForTimeout(400);
  m = await marcas();
  ok(m.it["3_16"].n === "Dios me ama a mí también" && m.it["3_16"].f === true, "la nota se guarda junto al favorito");
  ok(await p.$('#bbl-v16 .bbl-nota-ic'), "y aparece ✎ al final del versículo");
  await p.click("#bbl-v16 .bbl-nota-ic");
  await p.waitForTimeout(350);
  ok((await p.inputValue(".bbl-hoja-nota textarea")) === "Dios me ama a mí también", "tocar ✎ abre la nota para leerla o cambiarla");
  await p.click(".bbl-hoja-nota .budget-sheet-close");
  await p.waitForTimeout(300);

  // Copiar y compartir
  await p.click("#bbl-v16");
  await p.click('[data-bbs="copiar"]');
  await p.waitForTimeout(200);
  ok((await p.evaluate(() => window.__copiado)) === "«Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.» — Juan 3:16 (RV1909)", "Copiar: el versículo con su cita");
  await p.click("#bbl-v16");
  await p.click('[data-bbs="compartir"]');
  let comp = "";
  for (let i = 0; i < 30 && !comp; i++) { await p.waitForTimeout(200); comp = await p.evaluate(() => window.__compartido || ""); }
  const [nombre, bytes, tipo] = comp.split(":");
  ok(nombre === "juan-3-16.png" && tipo === "image/png" && Number(bytes) > 50000, `Compartir: una imagen PNG (${nombre}, ${Math.round(Number(bytes) / 1024)} KB)`);
  const dim = await p.evaluate(async () => { const { blob } = await BibliaSel.imagen([16]); const b = await createImageBitmap(blob); return [b.width, b.height]; });
  ok(dim.join("×") === "1080×1350", "de 1080 × 1350 (post o historia)");

  // Anotar: el registro de siempre con el texto puesto
  const antes = (await biblia()).length;
  await p.click("#bbl-v16");
  await p.click('[data-bbs="anotar"]');
  await p.waitForTimeout(450);
  ok(await visible(p, ".bib-hoja .budget-sheet-panel"), "Anotar abre el formulario de siempre (encima del lector)");
  const campos = await p.evaluate(() => { const f = document.querySelector(".bib-hoja form"); return ["libro", "capitulo", "versiculo", "version"].map(n => f.elements[n].value).concat([f.elements.texto.value.slice(0, 24)]); });
  ok(campos.join("|") === "John|3|16|RV1909|Porque de tal manera amó", `con libro, capítulo, versículo, versión y texto (${campos.join(" | ")})`);
  await p.click('.bib-hoja [type="submit"]');
  await p.waitForTimeout(450);
  const docsB = await biblia();
  const nuevo = docsB.find(d => d.version === "RV1909" && d.libro === "John" && d.versiculo === "16");
  ok(docsB.length === antes + 1 && nuevo && nuevo.fecha === HOY && /tenga vida eterna\.$/.test(nuevo.texto), "y lo guarda en tus versículos (con «RV1909»)");
  await captura(p, `biblia-marcas-lector-${ancho}.png`);

  // Buscar en toda la Biblia (Worker)
  await p.click('[data-bbl="buscar"]');
  await p.waitForTimeout(350);
  await p.fill('.bbl-hoja-buscar input[name="q"]', "tal manera amo");
  await p.press('.bbl-hoja-buscar input[name="q"]', "Enter");
  let est = "";
  for (let i = 0; i < 80 && !/versículo/.test(est); i++) { await p.waitForTimeout(200); est = await txt(p, ".bbl-buscar-estado"); }
  const res = await p.$$eval(".bbl-res b", bs => bs.map(b => b.textContent));
  ok(res.join(",") === "Juan 3:16,Romanos 15:14", `«tal manera amo» (sin tildes): ${res.join(", ")} (${est})`);
  ok((await p.$$eval(".bbl-res mark", ms => ms.map(m => m.textContent))).slice(0, 3).join(",") === "tal,manera,amó", "con las palabras resaltadas (también «amó»)");
  await captura(p, `biblia-buscar-${ancho}.png`);
  await p.context().setOffline(true);
  await p.click('[data-bbb-alcance="AT"]');
  await p.fill('.bbl-hoja-buscar input[name="q"]', "jehova es mi pastor");
  await p.press('.bbl-hoja-buscar input[name="q"]', "Enter");
  est = "";
  for (let i = 0; i < 40 && !/versículo/.test(est); i++) { await p.waitForTimeout(150); est = await txt(p, ".bbl-buscar-estado"); }
  const pastor = await p.$$eval(".bbl-res b", bs => bs.map(b => b.textContent));
  ok(pastor[0] === "Salmos 23:1" && pastor.length > 1, `en el Antiguo Testamento y sin internet: primero la frase exacta, Salmos 23:1 (${est})`);
  await p.context().setOffline(false);
  await p.click('[data-bbb-alcance="todo"]');
  await p.fill('.bbl-hoja-buscar input[name="q"]', "misericordia");
  await p.press('.bbl-hoja-buscar input[name="q"]', "Enter");
  est = "";
  for (let i = 0; i < 40 && !/primeros/.test(est); i++) { await p.waitForTimeout(150); est = await txt(p, ".bbl-buscar-estado"); }
  ok(/se muestran los primeros 200/.test(est) && (await p.$$(".bbl-res")).length === 200, `muchas: avisa y muestra 200 (${est})`);
  await p.fill('.bbl-hoja-buscar input[name="q"]', "tal manera amo");
  await p.press('.bbl-hoja-buscar input[name="q"]', "Enter");
  for (let i = 0; i < 30 && (await p.$$(".bbl-res")).length !== 2; i++) await p.waitForTimeout(150);
  await p.click('.bbl-res[data-bbb-ir="Rom|15|14"]');
  await p.waitForTimeout(700);
  ok((await txt(p, "#bbl-donde-t")) === "Romanos 15" && await p.$eval("#bbl-v14", e => e.classList.contains("is-marcado")), "tocar un resultado lo abre en el lector, marcado");
  ok(!(await visible(p, ".bbl-selbar")), "sin selección pendiente");
  ok(await sinDesborde(p), "sin desborde horizontal");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);

  // Pestaña "Marcados"
  await p.click('[data-bib-vista="marcados"]');
  await p.waitForTimeout(400);
  const items = await p.$$eval(".bbl-marcado b", bs => bs.map(b => b.textContent));
  ok(items.join(",") === "Juan 3:16,Juan 3:16", `Marcados: el favorito (con su nota) y el resaltado (${items.join(", ")})`);
  ok(/Dios me ama a mí también/.test(await txt(p, "#bib-marcas-vista")) && /Porque de tal manera/.test(await txt(p, "#bib-marcas-vista")), "con el texto y la nota");
  await p.click('[data-bbs-filtro="fav"]');
  await p.waitForTimeout(200);
  ok((await p.$$(".bbl-marcado")).length === 1, "el filtro ★ deja el favorito");
  await captura(p, `biblia-marcados-${ancho}.png`);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-bib="exportar"]')]);
  const j = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
  const mj = j.marcas && j.marcas.John;
  ok(!!mj && mj.col["3_16"] === "amarillo" && mj.it["3_16"].n === "Dios me ama a mí también" && mj.it["3_16"].f === true, "Exportar (JSON) incluye resaltados, favoritos y notas");
  await p.click(".bbl-marcado");
  await p.waitForTimeout(700);
  ok(await visible(p, "#bbl-lector") && (await txt(p, "#bbl-donde-t")) === "Juan 3" && await p.$eval("#bbl-v16", e => e.classList.contains("is-marcado")), "tocarlo abre Juan 3:16 en el lector");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);

  // El formulario completa el texto solo
  await p.click('[data-bib-vista="lista"]');
  await p.click('[data-bib="nuevo"]');
  await p.waitForTimeout(350);
  await p.selectOption('.bib-hoja [name="libro"]', "Ps");
  await p.fill('.bib-hoja [name="capitulo"]', "23");
  await p.fill('.bib-hoja [name="versiculo"]', "1");
  let t = "";
  for (let i = 0; i < 20 && !t; i++) { await p.waitForTimeout(150); t = await p.inputValue('.bib-hoja [name="texto"]'); }
  ok(t === "Salmo de David. Jehová es mi pastor; nada me faltará." && (await p.inputValue('.bib-hoja [name="version"]')) === "RV1909", `al poner Salmos 23:1, el texto se completa solo (${t})`);
  ok(/Texto de la Reina-Valera 1909/.test(await txt(p, ".bib-hoja [data-bib-auto]")), "y lo dice");
  await p.fill('.bib-hoja [name="versiculo"]', "1-2");
  t = "";
  for (let i = 0; i < 20 && !/delicados/.test(t); i++) { await p.waitForTimeout(150); t = await p.inputValue('.bib-hoja [name="texto"]'); }
  ok(/nada me faltará\. En lugares de delicados pastos/.test(t), "cambiar el versículo cambia el texto (1-2)");
  await p.fill('.bib-hoja [name="texto"]', "Jehová es mi pastor; nada me faltará.");
  await p.dispatchEvent('.bib-hoja [name="texto"]', "input");
  ok((await p.inputValue('.bib-hoja [name="version"]')) === "RVR1960", "si pegas tu texto, propone tu versión (RVR1960)");
  await p.fill('.bib-hoja [name="versiculo"]', "3");
  await p.waitForTimeout(600);
  ok((await p.inputValue('.bib-hoja [name="texto"]')) === "Jehová es mi pastor; nada me faltará.", "y ya no lo cambia");
  await p.fill('.bib-hoja [name="versiculo"]', "9");
  await p.waitForTimeout(600);
  ok(/Salmos 23 tiene 6 versículos/.test(await txt(p, ".bib-hoja [data-bib-auto]")), "un versículo que no existe lo avisa");
  await captura(p, `biblia-form-auto-${ancho}.png`);
  await p.click('.bib-hoja [data-bib="leer-cita"]');
  await p.waitForTimeout(700);
  ok(await visible(p, "#bbl-lector") && (await txt(p, "#bbl-donde-t")) === "Salmos 23", "«Leer en la Biblia» abre el capítulo");
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

// ---------- Fase 3: planes, progreso, memorizar, temas y racha ----------
const tarjetasPlan = p => p.$$eval("#bib-resumen .bpl-hoy", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
async function irA(p, hash) {
  await p.evaluate(h => { location.hash = h; }, hash);
  await p.waitForTimeout(450);
}
async function bibliaPlanes(browser, base, ancho, captura) {
  console.log(`\nBiblia: planes de lectura, progreso y racha (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#biblia", zona: ZONA, fecha: FECHA, ancho, alto });
  consola(p);
  await p.waitForTimeout(900);
  const planes = async () => ((await metaDe(p, "biblia_planes")) || {}).planes || {};
  ok(/Elige un plan de lectura/.test(await txt(p, "#bib-resumen .bpl-sugerencia")), "sin planes, arriba sugiere elegir uno");
  const accesos = await p.$$eval("#bib-resumen .bib-accesos a", as => as.map(a => a.getAttribute("href")));
  ok(accesos.join(" ") === "#biblia-planes #biblia-progreso #biblia-memorizar", `accesos a Planes, Progreso y Memorizar (${accesos.join(" ")})`);
  ok(/🔥 2/.test(await txt(p, ".bib-racha")), "racha de 2 días (ayer y anteayer)");
  ok(await sinDesborde(p), "Biblia no se mueve de lado");
  await p.click("#bib-resumen .bpl-sugerencia");
  await p.waitForTimeout(450);
  ok(await visible(p, "#panel-biblia-planes") && !(await visible(p, "#verse-banner")), "abre «Planes de lectura» (sin el versículo de arriba)");
  ok((await p.$$("#bpl-app .bpl-tipo")).length === 6, "seis planes para elegir");
  ok(await sinDesborde(p), "Planes no se mueve de lado");
  await captura(p, `biblia-planes-${ancho}.png`);
  await p.click('[data-bpl-empezar="evangelios30"]');
  await p.waitForTimeout(500);
  let pl = Object.values(await planes());
  ok(pl.length === 1 && pl[0].tipo === "evangelios30" && pl[0].inicio === HOY && pl[0].activo === true, "«Empezar hoy» guarda el plan");
  ok((await p.evaluate(() => location.hash)) === "#biblia", "y vuelve a Biblia");
  let card = await txt(p, "#bib-resumen .bpl-hoy");
  ok(/Evangelios en 30 días/.test(card) && /Día 1 de 30/.test(card) && /Hoy: Mateo 1-2/.test(card), `la tarjeta del plan con la lectura de hoy (${card})`);
  await captura(p, `biblia-plan-hoy-${ancho}.png`);

  // Leer fuera de orden: primero Mateo 2.
  await p.evaluate(() => BibliaLector.abrir("Matt", 2, { y: 0 }));
  await p.waitForTimeout(700);
  ok(/Evangelios en 30 días: 0 de 2 de hoy/.test(await txt(p, ".bbl-plan")), "en el lector: «Evangelios en 30 días: 0 de 2 de hoy»");
  await p.click('[data-bbl="leido"]');
  await p.waitForTimeout(400);
  ok(/1 de 2 de hoy/.test(await txt(p, ".bbl-plan")) && /Seguir con Mateo 1/.test(await txt(p, ".bbl-plan button")), "al marcarlo leído: «1 de 2» y «Seguir con Mateo 1»");
  await p.click(".bbl-plan button");
  await p.waitForTimeout(600);
  ok((await txt(p, "#bbl-donde-t")) === "Mateo 1", "«Seguir con» abre Mateo 1");
  await p.click('[data-bbl="leido"]');
  await p.waitForTimeout(400);
  ok(/Lectura de hoy completa/.test(await txt(p, ".bbl-plan")), "con los dos: «Lectura de hoy completa»");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);
  card = await txt(p, "#bib-resumen .bpl-hoy");
  ok(/La lectura de hoy está hecha: Mateo 1-2/.test(card), `la tarjeta lo dice (${card})`);
  ok(/Hoy ya leíste la Biblia/.test(await txt(p, ".bib-hoy")) && /🔥 3/.test(await txt(p, ".bib-racha")), "la racha cuenta el día leído (3 días)");

  // Calendario y Mi día
  await p.click('[data-bib-vista="calendario"]');
  await p.waitForTimeout(300);
  ok(await p.$eval(`[data-bib-dia="${HOY}"]`, el => el.classList.contains("is-leido")), "en el calendario, hoy tiene la marca de leído");
  ok(/Leíste Mateo 1-2/.test(await txt(p, ".bib-cal-leido")), "y abajo dice qué leíste");
  await p.click('[data-bib-vista="lista"]');
  await irA(p, "#inicio");
  const md = await txt(p, '[data-md="biblia"]');
  ok(/Biblia leída hoy/.test(md) && /2 capítulos\. 3 días seguidos/.test(md), `Mi día: «${md}»`);

  // Progreso
  await irA(p, "#biblia-progreso");
  ok(await visible(p, "#panel-biblia-progreso") && (await p.$$(".bpr-libro")).length === 66, "Progreso: el mapa de los 66 libros");
  ok(/2 capítulos leídos en 2026/.test(await txt(p, ".bpr-total")), "cuenta los capítulos leídos este año");
  ok(/2\/28/.test(await txt(p, '[data-bpr-libro="Matt"]')) && await p.$eval('[data-bpr-libro="Matt"]', el => el.classList.contains("is-empezado")), "Mateo: 2 de 28");
  ok(await sinDesborde(p), "Progreso no se mueve de lado");
  await captura(p, `biblia-progreso-${ancho}.png`);
  await p.click('[data-bpr-libro="Matt"]');
  await p.waitForTimeout(300);
  ok((await p.$$(".bpr-hoja [data-bpr-ir]")).length === 28 && (await p.$$(".bpr-hoja .bbl-cap-b.is-leido")).length === 2, "tocar Mateo muestra sus capítulos, 2 leídos");
  await p.click('.bpr-hoja [data-bpr-ir="Matt.3"]');
  await p.waitForTimeout(700);
  ok(await visible(p, "#bbl-lector") && (await txt(p, "#bbl-donde-t")) === "Mateo 3", "y tocar uno lo abre en el lector");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);

  // Quitar el plan
  await irA(p, "#biblia-planes");
  ok(/Tus planes/.test(await txt(p, "#bpl-app")) && (await p.$$("#bpl-app .bpl-tipo")).length === 5, "en Planes: el tuyo arriba y los demás para sumar");
  await p.click("[data-bpl-quitar]");
  await p.waitForTimeout(400);
  pl = Object.values(await planes());
  ok(pl[0].activo === false && pl[0].quitado === HOY, "«Quitar este plan» lo apaga (lo leído queda)");
  ok((await p.$$("#bpl-app .bpl-tipo")).length === 6, "y vuelven los seis");
  if (ancho < 800) {
    await p.setViewportSize({ width: 320, height: 640 });
    await p.waitForTimeout(200);
    ok(await sinDesborde(p), "Planes entra en 320 px");
    await irA(p, "#biblia");
    ok(await sinDesborde(p), "Biblia entra en 320 px");
  }
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

async function bibliaMemoria(browser, base, ancho, captura) {
  console.log(`\nBiblia: atrasado, Proverbios, memorizar, temas y favoritos arriba (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const est = SEM.estado(HOY);
  est.__SEED__["users/test/meta"] = Object.assign({}, est.__SEED__["users/test/meta"], {
    biblia_planes: { planes: {
      pN: { tipo: "nt90", inicio: SEM.addDias(HOY, -3), activo: true, creado: 1 },
      pA: { tipo: "anio", inicio: SEM.addDias(HOY, -2), activo: true, creado: 2 },
      pP: { tipo: "proverbios", inicio: SEM.addDias(HOY, -10), activo: true, creado: 3 }
    } },
    biblia_leidos: { dias: { [SEM.addDias(HOY, -3)]: ["Matt.1", "Matt.2", "Matt.3"] } }
  });
  const p = await abrir(browser, base, est, { hash: "#biblia", zona: ZONA, fecha: FECHA, ancho, alto });
  consola(p);
  await p.waitForTimeout(900);
  const planes = async () => ((await metaDe(p, "biblia_planes")) || {}).planes || {};
  let ts = await tarjetasPlan(p);
  ok(ts.length === 3, `tres planes arriba (${ts.length})`);
  ok(/Nuevo Testamento en 90 días/.test(ts[0]) && /Hoy: Mateo 9-11/.test(ts[0]) && /Vas 5 capítulos atrasado/.test(ts[0]), `atrasado: ${ts[0]}`);
  ok(/Biblia en un año/.test(ts[1]) && /Vas 6 capítulos atrasado/.test(ts[1]), "el de un año también va atrasado");
  ok(/Proverbios del día/.test(ts[2]) && /Hoy: Proverbios 6/.test(ts[2]) && /6 nov/.test(ts[2]), `Proverbios del día: el 6 (${ts[2]})`);
  ok(await sinDesborde(p), "con tres planes no se mueve de lado");
  await captura(p, `biblia-planes-atrasado-${ancho}.png`);

  // Ponerme al día de a poco
  await p.click('[data-bpl-aldia="pN"]');
  await p.waitForTimeout(400);
  let pls = await planes();
  ok(pls.pN.alDia && pls.pN.alDia.hasta === "2026-11-12", "«Ponerme al día» guarda hasta cuándo (7 días)");
  const nt = (await tarjetasPlan(p))[0];
  ok(/Hoy: Mateo 4, 9-11/.test(nt) && /Poniéndote al día hasta el 12 nov: faltan 5 capítulos/.test(nt), `hoy suma uno de los atrasados (${nt})`);
  await p.click('[data-bpl-leer="pN"]');
  await p.waitForTimeout(700);
  ok((await txt(p, "#bbl-donde-t")) === "Mateo 4", "«Leer» abre el primero que falta: Mateo 4");
  ok(/0 de 4 de hoy/.test(await txt(p, ".bbl-plan")) && /Seguir con Mateo 9/.test(await txt(p, ".bbl-plan button")), "y ofrece seguir con Mateo 9 (no con el 5)");
  await p.click('[data-bbl="leido"]');
  await p.waitForTimeout(400);
  ok(/1 de 4 de hoy/.test(await txt(p, ".bbl-plan")) && /Seguir con Mateo 9/.test(await txt(p, ".bbl-plan button")), "al marcarlo: 1 de 4 (no aparece otro atrasado)");
  await p.click(".bbl-plan button");
  await p.waitForTimeout(600);
  ok((await txt(p, "#bbl-donde-t")) === "Mateo 9", "«Seguir con Mateo 9» lo abre");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);

  // Mover el plan de un año
  await p.click('[data-bpl-mover="pA"]');
  await p.waitForTimeout(400);
  pls = await planes();
  ok(pls.pA.corrimiento === 2, `«Mover el plan» lo corre 2 días (${pls.pA.corrimiento})`);
  const anio = (await tarjetasPlan(p))[1];
  ok(/Día 1 de 365/.test(anio) && /Hoy: Génesis 1-3/.test(anio) && !/atrasado/.test(anio), `y hoy empieza de nuevo (${anio})`);

  // Proverbios del día
  await p.click('[data-bpl-leer="pP"]');
  await p.waitForTimeout(700);
  ok((await txt(p, "#bbl-donde-t")) === "Proverbios 6", "Proverbios del día abre Proverbios 6");
  await p.click('[data-bbl="leido"]');
  await p.waitForTimeout(400);
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);
  const prov = (await tarjetasPlan(p))[2];
  ok(/La lectura de hoy está hecha/.test(prov) && /🔥 1/.test(prov), `leído: ✓ y racha (${prov})`);

  // Memorizar desde el lector
  const memoria = async () => (((await metaDe(p, "biblia_memoria")) || {}).items) || {};
  await p.evaluate(() => BibliaLector.abrir("John", 3));
  await p.waitForTimeout(700);
  await p.click("#bbl-v16");
  await p.waitForTimeout(150);
  ok(await visible(p, '[data-bbs="memorizar"]'), "la barra tiene «Memorizar»");
  const tam = await p.$$eval(".bbl-sel-acciones button", bs => Math.min(...bs.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))));
  ok(tam >= 44, `seis botones de ${Math.round(tam)} px o más (≥ 44)`);
  await captura(p, `biblia-seleccion-memorizar-${ancho}.png`);
  await p.click('[data-bbs="memorizar"]');
  await p.waitForTimeout(400);
  let items = await memoria();
  ok(items.John_3_16 && items.John_3_16.caja === 1 && items.John_3_16.proximo === HOY && /^Porque de tal manera amó Dios al mundo, que ha dado a su Hijo/.test(items.John_3_16.texto), "🧠 Memorizar guarda Juan 3:16 para repasar hoy");
  ok(/Juan 3:16 en Memorizar/.test(await txt(p, ".bbl-toast")), "y lo avisa");
  await p.click("#bbl-v16");
  await p.click('[data-bbs="memorizar"]');
  await p.waitForTimeout(200);
  ok(/ya está en Memorizar/.test(await txt(p, ".bbl-toast")), "otra vez: «ya está en Memorizar»");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);
  ok(/1 versículo para repasar hoy/.test(await txt(p, "#bib-resumen .bbm-hoy")), "arriba de Biblia: «1 versículo para repasar hoy»");
  await p.click('#bib-resumen [data-bbm="repasar"]');
  await p.waitForTimeout(400);
  ok(/^P d t m a D a m,/.test(await txt(p, ".bbm-hoja .bbm-letras")), "repasar: primero, con las primeras letras");
  await captura(p, `biblia-memorizar-letras-${ancho}.png`);
  await p.click('.bbm-hoja [data-bbm-nota="bien"]');
  await p.waitForTimeout(400);
  items = await memoria();
  ok(/¡Listo!/.test(await txt(p, ".bbm-hoja .bbm-fin")) && items.John_3_16.caja === 2 && items.John_3_16.proximo === "2026-11-08", "«¡Lo sabía!» lo sube a la caja 2: vuelve en 2 días");
  await p.click(".bbm-hoja .bbm-fin [data-cerrar-hoja]");
  await p.waitForTimeout(300);
  ok(!(await p.$("#bib-resumen .bbm-hoy")), "ya no hay repasos para hoy");
  await irA(p, "#biblia-memorizar");
  ok(/Próximo repaso: en 2 días/.test(await txt(p, "#bbm-app .bbm-item")) && /Hoy no tienes repasos/.test(await txt(p, "#bbm-app")), "Memorizar: la lista con el próximo repaso");
  ok(await sinDesborde(p), "Memorizar no se mueve de lado");
  await captura(p, `biblia-memorizar-${ancho}.png`);
  await p.click('[data-bbm-practicar="John_3_16"]');
  await p.waitForTimeout(300);
  await p.click('.bbm-hoja [data-bbm-modo="ocultar"]');
  await p.waitForTimeout(150);
  const huecos = (await p.$$(".bbm-hoja .bbm-hueco")).length;
  await p.click(".bbm-hoja .bbm-hueco");
  await p.waitForTimeout(150);
  ok(huecos === 10 && (await p.$$(".bbm-hoja .bbm-hueco")).length === 9, `ocultar palabras: ${huecos} huecos; tocar uno lo muestra`);
  await p.click('.bbm-hoja [data-bbm-nivel="3"]');
  await p.waitForTimeout(150);
  ok((await p.$$(".bbm-hoja .bbm-hueco")).length === 30, "«todas» oculta las 30 palabras");
  await captura(p, `biblia-memorizar-ocultar-${ancho}.png`);
  await p.click('.bbm-hoja [data-bbm-modo="escribir"]');
  await p.waitForTimeout(150);
  await p.fill(".bbm-hoja [data-bbm-escrito]", "porque de tal manera amo dios al mundo que ha dado a su hijo unigenito para que todo aquel que en el cree no se pierda mas tenga vida eterna");
  await p.click('.bbm-hoja [data-bbm="comprobar"]');
  await p.waitForTimeout(200);
  ok(/^100 % · ¡Lo sabías!/.test(await txt(p, ".bbm-hoja .bbm-pct")), "escribirlo sin tildes ni comas: 100 %");
  await p.click('.bbm-hoja [data-bbm="siguiente"]');
  await p.waitForTimeout(300);
  items = await memoria();
  ok(items.John_3_16.caja === 3 && items.John_3_16.proximo === "2026-11-10", "y sube a la caja 3: vuelve en 4 días");
  await p.click(".bbm-hoja .bbm-fin [data-cerrar-hoja]");
  await p.waitForTimeout(300);

  // Memorizar desde tus versículos
  await irA(p, "#biblia");
  await p.click("#bib-lista [data-bib-editar]");
  await p.waitForTimeout(300);
  await p.click('.bib-hoja [data-bib="memorizar"]');
  await p.waitForTimeout(300);
  ok(/Agregado a Memorizar/.test(await txt(p, '.bib-hoja [data-bib="memorizar"]')) && Object.keys(await memoria()).length === 2, "desde tus versículos: «🧠 Memorizar este versículo»");
  await p.click(".bib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  // Temas
  await p.click('[data-bib="nuevo"]');
  await p.waitForTimeout(350);
  await p.selectOption('.bib-hoja [name="libro"]', "Ps");
  await p.fill('.bib-hoja [name="capitulo"]', "23");
  await p.fill('.bib-hoja [name="versiculo"]', "1");
  let t = "";
  for (let i = 0; i < 20 && !t; i++) { await p.waitForTimeout(150); t = await p.inputValue('.bib-hoja [name="texto"]'); }
  await p.click('.bib-hoja [data-bib-tema="fe"]');
  await p.click('.bib-hoja [data-bib-tema="paz"]');
  await p.fill('.bib-hoja [name="temaOtro"]', "Trabajo");
  await captura(p, `biblia-form-temas-${ancho}.png`);
  await p.click('.bib-hoja button[type="submit"]');
  await p.waitForTimeout(500);
  const conTemas = (await p.evaluate(() => Array.from(window.__fakeStore.colMap("users/test/biblia").entries()))).filter(([, d]) => d.temas);
  ok(conTemas.length === 1 && conTemas[0][1].temas.join(",") === "fe,paz,trabajo", `temas guardados: ${conTemas.length ? conTemas[0][1].temas.join(", ") : "—"}`);
  ok(await visible(p, "#bib-tema"), "aparece el filtro de temas");
  await p.selectOption("#bib-tema", "paz");
  await p.waitForTimeout(200);
  ok((await p.$$("#bib-lista .bib-item")).length === 1 && /1 de 40/.test(await txt(p, "#bib-lista .lib-nota")), "filtrar por «paz» deja ese versículo");
  ok((await p.$$eval("#bib-lista .bib-temas i", is => is.map(i => i.textContent))).join(",") === "fe,paz,trabajo", "la tarjeta muestra sus temas");
  ok(await sinDesborde(p), "con el filtro de temas no se mueve de lado");
  await captura(p, `biblia-temas-${ancho}.png`);
  await p.click("#bib-lista [data-bib-editar]");
  await p.waitForTimeout(300);
  for (const x of ["fe", "paz", "trabajo"]) await p.click(`.bib-hoja [data-bib-tema="${x}"]`);
  await p.click('.bib-hoja button[type="submit"]');
  await p.waitForTimeout(500);
  const sinTemas = await p.evaluate(id => window.__fakeStore.colMap("users/test/biblia").get(id), conTemas[0][0]);
  ok(sinTemas && !("temas" in sinTemas), "quitar todos los temas borra el campo");
  ok(!(await visible(p, "#bib-tema")), "y el filtro se va");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-bib="exportar"]')]);
  const j = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
  ok(j.planes && j.planes.pN && j.planes.pN.tipo === "nt90" && j.memorizar && j.memorizar.John_3_16 && j.memorizar.John_3_16.caja === 3, "Exportar (JSON) incluye tus planes y lo que memorizas");

  // Favoritos en el versículo de arriba
  await p.evaluate(() => BibliaLector.abrir("John", 3));
  await p.waitForTimeout(700);
  await p.click("#bbl-v16");
  await p.click('[data-bbs="fav"]');
  await p.waitForTimeout(300);
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);
  await p.click('[data-bib="ajustes"]');
  await p.waitForTimeout(300);
  ok(/Tienes 1 favorito/.test(await txt(p, ".bib-hoja-ajustes")), "Ajustes: cuenta tus favoritos");
  await captura(p, `biblia-ajustes-${ancho}.png`);
  await p.click(".bib-hoja-ajustes [data-bib-favarriba]");
  await p.waitForTimeout(400);
  ok(((await metaDe(p, "biblia_lector")) || {}).favArriba === true, "activar «también de tus favoritos» se guarda");
  await p.click(".bib-hoja-ajustes .budget-sheet-close");
  await p.waitForTimeout(300);
  await irA(p, "#inicio");
  ok((await txt(p, "#verse-banner .verse-ref")) === "Juan 3:16" && /Porque de tal manera amó Dios/.test(await txt(p, "#verse-banner .verse-text")), "en Inicio, arriba sale tu favorito");
  await irA(p, "#biblia");
  await p.click('[data-bib="ajustes"]');
  await p.waitForTimeout(300);
  await p.click(".bib-hoja-ajustes [data-bib-favarriba]");
  await p.waitForTimeout(300);
  await p.click(".bib-hoja-ajustes .budget-sheet-close");
  await p.waitForTimeout(300);
  await irA(p, "#inicio");
  ok((await txt(p, "#verse-banner .verse-ref")) === "2 Corintios 4:16", "al apagarlo vuelve la lista de siempre");
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

module.exports = { bibliaLector, bibliaMarcas, bibliaPlanes, bibliaMemoria, txt, visible, sinDesborde, metaDe, consola, deslizar, HOY, FECHA, ZONA };
