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
  await p.waitForTimeout(400);
  // D-122: un libro abre la hoja para marcar (tocar = leído hoy) con «Leer en la app».
  ok((await p.$$(".bmk-hoja [data-bmk-cap]")).length === 28 && (await p.$$(".bmk-hoja .bbl-cap-b.is-leido")).length === 2, "tocar Mateo muestra sus capítulos para marcar, 2 leídos");
  const primero = await p.$eval(".bmk-hoja [data-bmk-cap]:not(.is-leido)", b => b.textContent.trim());
  await p.click('.bmk-hoja [data-bmk="leer"]');
  await p.waitForTimeout(900);
  ok(await visible(p, "#bbl-lector") && (await txt(p, "#bbl-donde-t")) === `Mateo ${primero}`, `y «Leer Mateo en la app» lo abre en el lector (Mateo ${primero}, el primero sin leer)`);
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

// ---------- Fase 4: Libros — Leer ahora, velocidad, estados y formatos ----------
async function librosSesion(browser, base, ancho, captura) {
  console.log(`\nLibros: Leer ahora, velocidad, abandonado, releer y audiolibro (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#libros", zona: ZONA, relojFalso: FECHA, ancho, alto });
  consola(p);
  await p.evaluate(() => {
    window.__wl = 0; window.__wlr = 0;
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => { window.__wl++; return { release: async () => { window.__wlr++; }, addEventListener() {} }; } } });
  });
  const avanzar = async ms => { await p.clock.fastForward(ms); await p.waitForTimeout(80); };
  await p.waitForTimeout(900);
  const libro = id => p.evaluate(i => window.__fakeStore.colMap("users/test/libros").get(i), id);
  const reloj = () => txt(p, ".lib-hoja-sesion .lses-reloj");

  ok((await p.$$("#lib-leyendo [data-lses-leer]")).length === 2, "«Sigue leyendo»: ▶ Leer ahora en los dos libros");
  await p.click('#lib-leyendo [data-lses-leer="l1"]');
  await p.waitForTimeout(300);
  ok(await visible(p, ".lib-hoja-sesion") && (await reloj()) === "0:00" && /Empezaste en la página 142/.test(await txt(p, ".lses-desde")), "Leer ahora: el reloj empieza en 0:00 desde la página 142");
  await p.click(".lib-hoja-sesion [data-lses-pantalla]");
  await p.waitForTimeout(150);
  ok(await p.evaluate(() => window.__wl) === 1, "«Mantener la pantalla encendida» la pide");
  await avanzar(12 * 60000 + 34000);
  ok((await reloj()) === "12:34", `el reloj corre (${await reloj()})`);
  await captura(p, `libros-leer-ahora-${ancho}.png`);
  await p.click('.lib-hoja-sesion [data-lses="pausa"]');
  await p.waitForTimeout(150);
  ok(await p.evaluate(() => window.__wlr) >= 1, "en pausa suelta la pantalla");
  await avanzar(10 * 60000);
  ok((await reloj()) === "12:34" && /en pausa/.test(await txt(p, ".lses-desde")), "en pausa no cuenta");
  await p.click('.lib-hoja-sesion [data-lses="seguir"]');
  await avanzar(28 * 60000 + 26000);
  ok((await reloj()) === "41:00", `y al seguir vuelve a contar (${await reloj()})`);
  await p.click(".lib-hoja-sesion .budget-sheet-close");
  await p.waitForTimeout(350);
  ok(/41:0\d/.test(await txt(p, '#lib-leyendo .lses-corre')), "cerrada la hoja, «Sigue leyendo» muestra el reloj corriendo");
  ok(await p.evaluate(() => !!localStorage.getItem("manolo.libros.sesion")), "la sesión queda guardada en el teléfono (sigue aunque cierres la app)");

  // Terminar y guardar
  await p.click("#lib-leyendo .lses-corre");
  await p.waitForTimeout(300);
  await p.click('.lib-hoja-sesion [data-lses="terminar"]');
  await p.waitForTimeout(250);
  ok((await p.inputValue('.lib-hoja-sesion [name="minutos"]')) === "41" && (await p.inputValue('.lib-hoja-sesion [name="hasta"]')) === "142", "Terminar: 41 minutos y la página en la que ibas");
  await p.click('.lib-hoja-sesion [data-lses-sumar="20"]');
  ok((await p.inputValue('.lib-hoja-sesion [name="hasta"]')) === "162", "+20 suma páginas");
  await p.fill('.lib-hoja-sesion [name="hasta"]', "165");
  await captura(p, `libros-sesion-fin-${ancho}.png`);
  await p.click('.lib-hoja-sesion button[type="submit"]');
  await p.waitForTimeout(500);
  const fin = await txt(p, ".lib-hoja-sesion .lses-listo");
  ok(/23 páginas en 41 min/.test(fin) && /33,7 pág\.\/hora/.test(fin), `resumen: ${fin}`);
  let l1 = await libro("l1");
  const ses = Object.values(l1.sesiones || {});
  ok(ses.length === 1 && ses[0].min === 41 && ses[0].desde === 142 && ses[0].hasta === 165 && ses[0].fecha === HOY && l1.paginaActual === 165 && l1.progreso[HOY] === 165,
    "la sesión queda en el libro (41 min, de la 142 a la 165) y la página de hoy también");
  await captura(p, `libros-sesion-listo-${ancho}.png`);
  await p.click(".lib-hoja-sesion [data-cerrar-hoja].lib-btn");
  await p.waitForTimeout(300);
  ok(/23\s*de 30 páginas/.test(await txt(p, "#lib-resumen .lib-meta")), "la meta de hoy suma las 23 páginas");
  ok(await p.evaluate(() => !localStorage.getItem("manolo.libros.sesion")), "y la sesión del teléfono se borra");

  // Ficha: velocidad, lo que falta y las sesiones
  await p.click('#lib-leyendo [data-lib-ver="l1"]');
  await p.waitForTimeout(350);
  const ficha = await txt(p, ".lib-hoja .lses-ficha");
  ok(/Tu velocidad: 33,7 pág\.\/hora/.test(ficha) && /Te faltan unas 4 h 50 min de lectura/.test(ficha), `ficha: velocidad y tiempo que falta (${ficha.slice(0, 90)}…)`);
  ok((await p.$$(".lib-hoja .lses-lista li")).length === 1, "y la lista de sesiones");
  await captura(p, `libros-ficha-sesiones-${ancho}.png`);
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  // Dejar de leer y retomar
  await p.click('#lib-leyendo [data-lib-ver="l2"]');
  await p.waitForTimeout(300);
  await p.click('.lib-hoja [data-lses-dejar="l2"]');
  await p.waitForTimeout(400);
  let l2 = await libro("l2");
  ok(l2.estado === "abandonado" && l2.fechaDejado === HOY, "«Dejar de leerlo» lo pasa a Abandonado");
  ok(/Lo dejaste el 6 nov 2026 en la página 60/.test(await txt(p, ".lib-hoja .lses-dejado")), "la ficha dice cuándo y dónde lo dejaste");
  ok((await p.$$('#lib-leyendo [data-lib-sigue="l2"]')).length === 0 && /Abandonado\s*1/.test(await txt(p, "#lib-estados")), "sale de «Sigue leyendo» y aparece el filtro Abandonado");
  await p.click('.lib-hoja [data-lses-retomar="l2"]');
  await p.waitForTimeout(400);
  l2 = await libro("l2");
  ok(l2.estado === "leyendo" && l2.paginaActual === 60, "«Retomar» lo vuelve a Leyendo en la misma página");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  // Leer de nuevo (sin perder la lectura anterior)
  const terminadosAntes = await txt(p, "#lib-resumen .lib-cifras");
  await p.click('[data-lib-estado="terminado"]');
  await p.waitForTimeout(200);
  await p.click('#lib-lista [data-lib-ver="l3"]');
  await p.waitForTimeout(300);
  await p.click('.lib-hoja [data-lses-releer="l3"]');
  await p.waitForTimeout(400);
  const l3 = await libro("l3");
  ok(l3.estado === "leyendo" && l3.fechaInicio === HOY && l3.paginaActual === 0 && l3.lecturas && l3.lecturas["1"] && l3.lecturas["1"].estado === "terminado" && l3.lecturas["1"].fechaFin === SEM.addDias(HOY, -80),
    "«Leer de nuevo»: empieza otra lectura y la anterior queda guardada");
  ok(/Lecturas anteriores/.test(await txt(p, ".lib-hoja .lses-ficha")) && /1ª/.test(await txt(p, ".lib-hoja .lses-lecturas")), "la ficha muestra la lectura anterior");
  ok((await txt(p, "#lib-resumen .lib-cifras")).replace(/^\d+/, "") === terminadosAntes.replace(/^\d+/, ""), "los terminados del año no cambian");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  await p.click('[data-lib-estado=""]');

  // Audiolibro
  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  await p.fill('.lib-hoja [name="titulo"]', "Sapiens (audio)");
  await p.click('.lib-hoja [data-lib-set-formato="audio"]');
  ok(await visible(p, '.lib-hoja [name="duracion"]') && !(await visible(p, '.lib-hoja [name="paginas"]')), "Audiolibro: pide la duración en vez de las páginas");
  await p.fill('.lib-hoja [name="duracion"]', "15:17");
  await p.click('.lib-hoja [data-lib-set-estado="leyendo"]');
  const seg = await p.$eval(".lib-hoja .lib-segmento.is-cuatro", el => ({ w: el.scrollWidth - el.clientWidth, n: el.children.length }));
  ok(seg.n === 4 && seg.w <= 0, "el estado tiene 4 opciones y entra");
  await captura(p, `libros-form-audio-${ancho}.png`);
  await p.click('.lib-hoja button[type="submit"]');
  await p.waitForTimeout(500);
  const audioId = await p.evaluate(() => Array.from(window.__fakeStore.colMap("users/test/libros").entries()).find(([, d]) => d.titulo === "Sapiens (audio)")[0]);
  let au = await libro(audioId);
  ok(au.formato === "audio" && au.duracionMin === 917 && au.estado === "leyendo", "se guarda como audiolibro de 15:17");
  await p.click(`#lib-leyendo [data-lib-pagina="${audioId}"]`);
  await p.waitForTimeout(300);
  await p.fill('.lib-hoja [name="paginaH"]', "3");
  await p.fill('.lib-hoja [name="paginaM"]', "20");
  await p.click('.lib-hoja button[type="submit"]');
  await p.waitForTimeout(400);
  au = await libro(audioId);
  ok(au.pctActual === 21.8 && au.progresoPct[HOY] === 21.8, `«Anotar avance» por tiempo: 3:20 de 15:17 = ${au.pctActual} %`);
  ok(/3:20 de 15:17 · 22 %/.test(await txt(p, `#lib-leyendo [data-lib-sigue="${audioId}"]`)), "la tarjeta lo muestra en tiempo y %");
  await p.click(`#lib-leyendo [data-lses-leer="${audioId}"]`);
  await p.waitForTimeout(300);
  await avanzar(30 * 60000);
  await p.click('.lib-hoja-sesion [data-lses="terminar"]');
  await p.waitForTimeout(250);
  ok((await p.inputValue('.lib-hoja-sesion [name="hastaH"]')) === "3" && (await p.inputValue('.lib-hoja-sesion [name="hastaM"]')) === "20", "al terminar, propone el tiempo en que ibas");
  await p.click('.lib-hoja-sesion [data-lses-sumar="30"]');
  ok((await p.inputValue('.lib-hoja-sesion [name="hastaM"]')) === "50", "+30 min");
  await p.click('.lib-hoja-sesion button[type="submit"]');
  await p.waitForTimeout(500);
  ok(/0:30 de audio en 30 min/.test(await txt(p, ".lib-hoja-sesion .lses-listo")), `resumen del audiolibro: ${await txt(p, ".lib-hoja-sesion .lses-listo-t")}`);
  au = await libro(audioId);
  const sa = Object.values(au.sesiones || {})[0];
  ok(sa && sa.unidad === "pct" && sa.desde === 21.8 && sa.hasta === 25.1 && sa.min === 30, "la sesión del audiolibro guarda el % de antes y después");
  await p.click(".lib-hoja-sesion [data-cerrar-hoja].lib-btn");
  await p.waitForTimeout(300);

  // Descartar una sesión
  await p.click('#lib-leyendo [data-lses-leer="l2"]');
  await p.waitForTimeout(250);
  await avanzar(5 * 60000);
  await p.click('.lib-hoja-sesion [data-lses="descartar"]');
  await p.waitForTimeout(300);
  ok(!(await visible(p, ".lib-hoja-sesion")) && !(await libro("l2")).sesiones && await p.evaluate(() => !localStorage.getItem("manolo.libros.sesion")), "«Descartar esta sesión» no guarda nada");

  ok(await sinDesborde(p), "Libros no se mueve de lado");
  await captura(p, `libros-sigue-leyendo-${ancho}.png`);
  if (ancho < 800) {
    await p.setViewportSize({ width: 320, height: 640 });
    await p.waitForTimeout(200);
    ok(await sinDesborde(p), "Libros entra en 320 px");
    await p.click('#lib-leyendo [data-lses-leer="l1"]');
    await p.waitForTimeout(300);
    ok(await sinDesborde(p) && await p.$eval(".lib-hoja-sesion .lses-reloj", el => el.scrollWidth <= el.clientWidth + 1), "el reloj entra en 320 px");
    await p.click('.lib-hoja-sesion [data-lses="descartar"]');
  }
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

// ---------- Fase 5a: ¿Qué leo después?, sagas, prioridad y notas ----------
async function librosSiguiente(browser, base, ancho, captura) {
  console.log(`\nLibros: ¿Qué leo después?, sagas, prioridad y notas (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#libros", zona: ZONA, fecha: FECHA, ancho, alto });
  consola(p);
  await p.waitForTimeout(900);
  const libro = id => p.evaluate(i => window.__fakeStore.colMap("users/test/libros").get(i), id);
  const titulos = sel => p.$$eval(sel, els => els.map(e => e.textContent.trim()));

  let tops = await titulos("#lib-siguiente .lsig-t b");
  ok(tops.join(" | ") === "El Principito | Piense y hágase rico | La sombra del viento", `«¿Qué leo después?»: tus Por leer en orden (${tops.join(" | ")})`);
  ok(/Hace rato no lees infantil y juvenil/.test(await txt(p, "#lib-siguiente .lsig-item")), "con la razón: un género que hace rato no lees");
  await captura(p, `libros-siguiente-${ancho}.png`);
  await p.click('#lib-siguiente [data-lsig="todos"]');
  await p.waitForTimeout(300);
  ok((await p.$$(".lsig-hoja .lsig-fila")).length === 3 && /Es largo: unos 3 meses a tu ritmo/.test(await txt(p, ".lsig-hoja")), "la lista completa con razones y avisos");
  await p.click('.lsig-hoja [data-lsig-id="l8"][data-lsig-prio="alta"]');
  await p.waitForTimeout(500);
  ok((await libro("l8")).prioridad === "alta", "Prioridad «Alta» se guarda");
  tops = await titulos(".lsig-hoja .lsig-t b");
  ok(tops[0] === "La sombra del viento" && /La marcaste con prioridad alta/.test(await txt(p, ".lsig-hoja .lsig-fila")), `y sube al primer lugar (${tops[0]})`);
  await captura(p, `libros-siguiente-todos-${ancho}.png`);
  await p.click('.lsig-hoja [data-lsig-empezar="l9"]');
  await p.waitForTimeout(500);
  const l9 = await libro("l9");
  ok(l9.estado === "leyendo" && l9.fechaInicio === HOY && !(await visible(p, ".lsig-hoja")), "«Empezar» lo pasa a Leyendo desde hoy");
  ok((await p.$$('#lib-leyendo [data-lib-sigue="l9"]')).length === 1 && (await p.$$("#lib-siguiente .lsig-item")).length === 2, "aparece en «Sigue leyendo» y sale de la lista");

  // Sagas
  const agregar = async (titulo, saga, n, terminado) => {
    await p.click('[data-lib="nuevo"]');
    await p.waitForTimeout(350);
    await p.fill('.lib-hoja [name="titulo"]', titulo);
    await p.fill('.lib-hoja [name="paginas"]', "400");
    await p.fill('.lib-hoja [name="saga"]', saga);
    await p.fill('.lib-hoja [name="sagaN"]', n);
    if (terminado) await p.click('.lib-hoja [data-lib-set-estado="terminado"]');
    await p.click('.lib-hoja button[type="submit"]');
    await p.waitForTimeout(500);
  };
  await agregar("La comunidad del anillo", "El Señor de los Anillos", "1", true);
  await agregar("Las dos torres", "El Señor de los Anillos", "2", false);
  const torres = await p.evaluate(() => Array.from(window.__fakeStore.colMap("users/test/libros").values()).find(d => d.titulo === "Las dos torres"));
  ok(torres && torres.saga === "El Señor de los Anillos" && torres.sagaN === 2, "la saga se guarda con su número");
  ok(/Sigue la saga «El Señor de los Anillos»: es el 2/.test(await txt(p, "#lib-siguiente")), "«Las dos torres» sube: sigue la saga que terminaste");
  await p.click('#lib-buscar');
  await p.fill("#lib-buscar", "dos torres");
  await p.waitForTimeout(250);
  await p.click("#lib-lista .lib-card");
  await p.waitForTimeout(300);
  ok(/📚 El Señor de los Anillos · n\.º 2/.test(await txt(p, ".lib-hoja .lib-ficha-info")), "la ficha muestra la saga");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  await p.fill("#lib-buscar", "");
  await p.dispatchEvent("#lib-buscar", "input");

  // Notas del libro
  await p.click('#lib-leyendo [data-lib-ver="l1"]');
  await p.waitForTimeout(300);
  ok(/Lo que aprendiste o ideas para aplicar/.test(await txt(p, ".lib-hoja .lnotas")), "la ficha tiene «Notas» (vacío, con ayuda)");
  await p.click('.lib-hoja [data-lnota-nueva="l1"]');
  await p.waitForTimeout(300);
  ok(await visible(p, ".lnota-hoja form"), "＋ Nota abre la hoja encima de la ficha");
  await p.click('.lnota-hoja [data-lnota-tipo="aplicar"]');
  await p.fill('.lnota-hoja [name="texto"]', "Hacer la cama al despertar: un voto por la persona que quiero ser.");
  await captura(p, `libros-nota-${ancho}.png`);
  await p.click('.lnota-hoja button[type="submit"]');
  await p.waitForTimeout(500);
  let notas = (await libro("l1")).notas || {};
  const nid = Object.keys(notas)[0];
  ok(nid && notas[nid].tipo === "aplicar" && notas[nid].fecha === HOY && /Hacer la cama/.test(notas[nid].texto), "la nota se guarda en el libro con su tipo y fecha");
  ok(/✅ Para aplicar · 6 nov 2026/.test(await txt(p, ".lib-hoja .lnota")), "y aparece en la ficha");
  await captura(p, `libros-ficha-notas-${ancho}.png`);
  await p.click(".lib-hoja .lnota");
  await p.waitForTimeout(300);
  await p.fill('.lnota-hoja [name="texto"]', "Hacer la cama al despertar.");
  await p.click('.lnota-hoja button[type="submit"]');
  await p.waitForTimeout(500);
  notas = (await libro("l1")).notas || {};
  ok(notas[nid].texto === "Hacer la cama al despertar." && Object.keys(notas).length === 1, "tocarla la edita");
  await p.click(".lib-hoja .lnota");
  await p.waitForTimeout(300);
  await p.click(".lnota-hoja [data-lnota-borrar]");
  await p.waitForTimeout(500);
  ok(!Object.keys((await libro("l1")).notas || {}).length, "y se puede eliminar");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  ok(await sinDesborde(p), "Libros no se mueve de lado");
  if (ancho < 800) {
    await p.setViewportSize({ width: 320, height: 640 });
    await p.waitForTimeout(200);
    await p.click('#lib-siguiente [data-lsig="todos"]');
    await p.waitForTimeout(300);
    ok(await sinDesborde(p), "«¿Qué leo después?» entra en 320 px");
  }
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

// ---------- Fase 5b: frases favoritas, etiquetas, compartir y repaso ----------
async function librosFrases(browser, base, ancho, captura) {
  console.log(`\nLibros: repaso de frases, favoritas, etiquetas y compartir (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#libros", zona: ZONA, fecha: FECHA, ancho, alto });
  consola(p);
  await p.evaluate(() => {
    window.__compartido = [];
    navigator.canShare = () => true;
    navigator.share = async d => { window.__compartido.push(`${d.files[0].name}:${d.files[0].type}:${d.files[0].size > 1000}`); };
  });
  await p.waitForTimeout(900);
  const frase = id => p.evaluate(i => window.__fakeStore.colMap("users/test/libros_frases").get(i), id);
  const todas = () => p.evaluate(() => Array.from(window.__fakeStore.colMap("users/test/libros_frases").entries()));

  ok(/3 frases para hoy/.test(await txt(p, "#lib-repaso .lfr-hoy")), "arriba de Libros: «3 frases para hoy»");
  await p.click('#lib-repaso [data-lfr="repasar"]');
  await p.waitForTimeout(300);
  ok(await visible(p, ".lfr-hoja .lfr-texto") && /1 de 3/.test(await txt(p, ".lfr-hoja .lfr-paso")), "el repaso muestra una frase por vez (1 de 3)");
  const primera = await p.$eval(".lfr-hoja [data-lfr-fav]", b => b.dataset.lfrFav);
  await p.click(".lfr-hoja [data-lfr-fav]");
  await p.waitForTimeout(300);
  ok((await frase(primera)).fav === true && /★ Favorita/.test(await txt(p, ".lfr-hoja [data-lfr-fav]")), "☆ la marca favorita");
  const esperarCompartir = async n => { for (let k = 0; k < 80 && (await p.evaluate(() => window.__compartido.length)) < n; k++) await p.waitForTimeout(100); };
  await p.click(".lfr-hoja [data-lfr-compartir]");
  await esperarCompartir(1);
  const comp = await p.evaluate(() => window.__compartido);
  ok(comp.length === 1 && /^frase-.*\.jpg:image\/jpeg:true$/.test(comp[0]), `Compartir arma la imagen (${comp[0]})`);
  await captura(p, `libros-frases-repaso-${ancho}.png`);
  await p.click('.lfr-hoja [data-lfr-nota="encanta"]');
  await p.waitForTimeout(400);
  const r1 = (await frase(primera)).repaso;
  ok(r1 && r1.nota === "encanta" && r1.int === 3 && r1.ultimo === HOY && r1.proximo === "2026-11-09", "❤️ Me encanta: vuelve en 3 días");
  ok(/2 de 3/.test(await txt(p, ".lfr-hoja .lfr-paso")), "y pasa a la siguiente");
  await p.click('.lfr-hoja [data-lfr-nota="bien"]');
  await p.waitForTimeout(300);
  await p.click('.lfr-hoja [data-lfr-nota="menos"]');
  await p.waitForTimeout(400);
  const repasos = (await todas()).map(([, d]) => d.repaso).filter(Boolean);
  ok(repasos.length === 3 && repasos.some(x => x.int === 7) && repasos.some(x => x.int === 90), "👍 Bien (7 días) y 👎 Menos (90 días)");
  ok(/Listo por hoy/.test(await txt(p, ".lfr-hoja .lfr-fin")), "al final: «Listo por hoy»");
  await p.click('.lfr-hoja [data-lfr-pordia="2"]');
  await p.waitForTimeout(300);
  ok(((await metaDe(p, "libros_ajustes")) || {}).frasesDia === 2, "y eliges cuántas por día (2)");
  await p.click(".lfr-hoja .lfr-fin [data-cerrar-hoja]");
  await p.waitForTimeout(300);
  ok(/Repasaste tus frases de hoy/.test(await txt(p, "#lib-repaso")), "la tarjeta dice que ya repasaste las de hoy");

  // Pestaña Frases: favoritas y etiquetas
  await p.click('[data-lib-vista="frases"]');
  await p.waitForTimeout(300);
  ok(/Todas\s*6/.test(await txt(p, "#lib-frases-filtros")) && /★ Favoritas\s*1/.test(await txt(p, "#lib-frases-filtros")), "filtros: Todas y ★ Favoritas");
  await p.click('[data-lib-ffiltro="fav"]');
  await p.waitForTimeout(200);
  ok((await p.$$("#lib-frases .lib-frase")).length === 1 && (await p.$$("#lib-frases .lib-frase-fav")).length === 1, "★ Favoritas deja la tuya, con su estrella");
  await p.click('[data-lib-ffiltro="todas"]');
  await p.waitForTimeout(200);
  await p.click('#lib-frases [data-lib-frase="f1"]');
  await p.waitForTimeout(300);
  ok(/Desde la página: abre la cámara del iPhone/.test(await txt(p, ".lib-hoja")), "el formulario explica cómo copiar una frase con la cámara");
  await p.fill('.lib-hoja [name="etiquetaNueva"]', "hábitos, Fe");
  await captura(p, `libros-frase-form-${ancho}.png`);
  await p.click('.lib-hoja button[type="submit"]');
  await p.waitForTimeout(400);
  ok(JSON.stringify((await frase("f1")).etiquetas) === '["hábitos","fe"]', "las etiquetas se guardan (en minúsculas)");
  await p.click('#lib-frases [data-lib-frase="f2"]');
  await p.waitForTimeout(300);
  await p.click('.lib-hoja [data-lib-etq="hábitos"]');
  await p.click('.lib-hoja [data-lfr-compartir="f2"]');
  await esperarCompartir(2);
  ok((await p.evaluate(() => window.__compartido.length)) === 2, "«Compartir» también desde la frase");
  await p.click('.lib-hoja button[type="submit"]');
  await p.waitForTimeout(400);
  ok(/#hábitos\s*2/.test(await txt(p, "#lib-frases-filtros")) && /#fe\s*1/.test(await txt(p, "#lib-frases-filtros")), "las etiquetas que ya usaste aparecen para elegir y como filtros");
  await p.click('[data-lib-fetq="hábitos"]');
  await p.waitForTimeout(200);
  ok((await p.$$("#lib-frases .lib-frase")).length === 2 && /2 de 6/.test(await txt(p, "#lib-frases .lib-nota")), "filtrar por #hábitos");
  await captura(p, `libros-frases-filtros-${ancho}.png`);
  ok(await sinDesborde(p), "Frases no se mueve de lado");
  if (ancho < 800) {
    await p.setViewportSize({ width: 320, height: 640 });
    await p.waitForTimeout(200);
    ok(await sinDesborde(p), "Frases entra en 320 px");
  }
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

// ---------- Fase 5c: importar de Goodreads, StoryGraph y Kindle ----------
async function librosImportar(browser, base, ancho, captura) {
  console.log(`\nLibros: importar de Goodreads, StoryGraph y Kindle (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#libros", zona: ZONA, fecha: FECHA, ancho, alto });
  consola(p);
  await p.waitForTimeout(900);
  const todos = col => p.evaluate(c => Array.from(window.__fakeStore.colMap(`users/test/${c}`).entries()), col);
  const subir = async (nombre, texto) => {
    await p.click('[data-limp="abrir"]');
    await p.waitForTimeout(250);
    await p.setInputFiles(".limp-hoja [data-limp-archivo]", { name: nombre, mimeType: "text/plain", buffer: Buffer.from(texto, "utf8") });
    await p.waitForTimeout(400);
  };
  const GR = [
    "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies",
    '1,Hábitos atómicos,James Clear,"Clear, James",,="",="",5,4.3,,Paperback,328,2018,2018,,2026/10/01,,,currently-reading,,,,0,0',
    '2,"Harry Potter y la piedra filosofal (Harry Potter, #1)",J. K. Rowling,"Rowling, J. K.",,="",="9788478884452",5,4.5,,Paperback,256,1997,1997,2025/08/20,2025/08/01,,,read,"Mágico.",,,1,0',
    '3,El poder del hábito,Charles Duhigg,"Duhigg, Charles",,="",="",4,4.1,,Kindle Edition,408,2012,2012,2025/09/30,2025/09/01,,,read,,,,1,0',
    '4,Deep Work,Cal Newport,"Newport, Cal",,="",="",0,4.2,,Audible Audio,,2016,2016,,2025/10/01,to-read,to-read (#1),to-read,,,,0,0'
  ].join("\n");

  // Goodreads
  await subir("goodreads_library_export.csv", GR);
  ok(/Importar de Goodreads/.test(await txt(p, ".limp-hoja h3")), "reconoce el archivo de Goodreads");
  ok(/3\s*nuevos/.test(await txt(p, ".limp-hoja .limp-resumen")) && /1\s*ya los tienes/.test(await txt(p, ".limp-hoja .limp-resumen")), "vista previa: 3 nuevos y 1 que ya tienes (Hábitos atómicos)");
  ok(/Harry Potter y la piedra filosofal/.test(await txt(p, ".limp-hoja .limp-lista")) && /Harry Potter #1/.test(await txt(p, ".limp-hoja .limp-lista")), "con su estado, estrellas y la saga sacada del título");
  await captura(p, `libros-importar-previa-${ancho}.png`);
  await p.click('.limp-hoja [data-limp-i="2"]');
  ok((await txt(p, '.limp-hoja [data-limp="importar"]')) === "Agregar 2 libros", "desmarcar uno cambia el botón");
  await p.click('.limp-hoja [data-limp="importar"]');
  await p.waitForTimeout(600);
  ok(/Agregaste 2 libros de Goodreads/.test(await txt(p, ".limp-hoja .limp-listo")), "«Listo: agregaste 2 libros»");
  let libros = (await todos("libros")).map(([, d]) => d);
  const hp = libros.find(d => /Harry Potter/.test(d.titulo));
  ok(hp && hp.titulo === "Harry Potter y la piedra filosofal" && hp.saga === "Harry Potter" && hp.sagaN === 1 && hp.estado === "terminado" && hp.fechaFin === "2025-08-20" && hp.calificacion === 5 && hp.isbn === "9788478884452" && hp.importado.de === "goodreads",
    "Harry Potter entra terminado, con saga, fecha, estrellas e ISBN");
  ok(libros.some(d => d.titulo === "El poder del hábito" && d.formato === "digital") && !libros.some(d => d.titulo === "Deep Work"), "el de Kindle como digital; el desmarcado no entra");
  ok(libros.filter(d => d.titulo === "Hábitos atómicos").length === 1, "Hábitos atómicos no se duplicó");
  await p.click(".limp-hoja .limp-listo [data-cerrar-hoja]");
  await p.waitForTimeout(300);

  // Kindle
  const KINDLE = [
    "Hábitos atómicos (James Clear)",
    "- Tu subrayado en la página 38 | posición 580-582 | Añadido el domingo, 5 de octubre de 2026 22:22:10",
    "",
    "Cada acción que realizas es un voto por el tipo de persona que deseas ser.",
    "==========",
    "Hábitos atómicos (James Clear)",
    "- Tu subrayado en la página 51 | posición 700-702 | Añadido el lunes, 6 de octubre de 2026 7:10:00",
    "",
    "Los hábitos son el interés compuesto de la superación personal.",
    "==========",
    "Hábitos atómicos (James Clear)",
    "- Tu nota en la página 51 | posición 702 | Añadido el lunes, 6 de octubre de 2026 7:11:00",
    "",
    "Aplicarlo a la lectura de la mañana.",
    "==========",
    "Mañana es hoy (Ana Gómez)",
    "- Tu subrayado en la posición 120-121 | Añadido el martes, 7 de octubre de 2026 8:00:00",
    "",
    "Lo que haces cada día importa más que lo que haces de vez en cuando.",
    "==========",
    ""].join("\n");
  const frasesAntes = (await todos("libros_frases")).length;
  await subir("My Clippings.txt", KINDLE);
  ok(/Importar de Kindle/.test(await txt(p, ".limp-hoja h3")), "reconoce «My Clippings.txt»");
  const res = await txt(p, ".limp-hoja .limp-resumen");
  ok(/2\s*frases nuevas/.test(res) && /1\s*ya las tienes/.test(res) && /1\s*nota/.test(res), `vista previa: ${res}`);
  ok(/libro nuevo/.test(await txt(p, ".limp-hoja .limp-lista")) && await visible(p, ".limp-hoja [data-limp-estado]"), "avisa el libro nuevo y pregunta cómo queda");
  await p.selectOption(".limp-hoja [data-limp-estado]", "leyendo");
  await captura(p, `libros-importar-kindle-${ancho}.png`);
  await p.click('.limp-hoja [data-limp="importar"]');
  await p.waitForTimeout(600);
  ok(/Agregaste 2 frases y 1 nota \(y 1 libro nuevo\)/.test(await txt(p, ".limp-hoja .limp-listo")), "«Agregaste 2 frases y 1 nota (y 1 libro nuevo)»");
  const frases = (await todos("libros_frases")).map(([, d]) => d);
  ok(frases.length === frasesAntes + 2 && frases.filter(f => f.importado && f.importado.de === "kindle").every(f => f.fecha && f.texto), "las frases nuevas entran con su fecha");
  const l1 = (await todos("libros")).find(([id]) => id === "l1")[1];
  const nota = Object.values(l1.notas || {})[0];
  ok(nota && nota.tipo === "nota" && /lectura de la mañana/.test(nota.texto) && nota.fecha === "2026-10-06", "la nota del Kindle va a las notas del libro");
  const nuevo = (await todos("libros")).map(([, d]) => d).find(d => d.titulo === "Mañana es hoy");
  ok(nuevo && nuevo.estado === "leyendo" && nuevo.formato === "digital" && nuevo.autor === "Ana Gómez", "el libro nuevo queda Leyendo, digital");
  await p.click(".limp-hoja .limp-listo [data-cerrar-hoja]");
  await p.waitForTimeout(300);

  // StoryGraph y un archivo que no es
  const SG = ["Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?",
    "Meditaciones,Marco Aurelio,,abc,digital,did-not-finish,2026/09/01,,,0,,,,,,,,,,,,,No"].join("\n");
  await subir("storygraph.csv", SG);
  await p.click('.limp-hoja [data-limp="importar"]');
  await p.waitForTimeout(500);
  ok((await todos("libros")).some(([, d]) => d.titulo === "Meditaciones" && d.estado === "abandonado"), "StoryGraph: «did-not-finish» entra como Abandonado");
  await p.click(".limp-hoja .limp-listo [data-cerrar-hoja]");
  await p.waitForTimeout(300);
  await subir("foto.txt", "hola, esto no es");
  ok(/No reconozco este archivo/.test(await txt(p, ".limp-hoja .lib-error")), "un archivo que no es: lo dice");
  ok(await sinDesborde(p), "no se mueve de lado");
  if (ancho < 800) {
    await p.setViewportSize({ width: 320, height: 640 });
    await p.waitForTimeout(200);
    ok(await sinDesborde(p), "entra en 320 px");
  }
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

// ---------- Fase 5d: escanear el código de barras (ISBN) ----------
// Una "foto" de la contratapa dibujada en la página: fondo de color, texto,
// el código (girado y algo borroso) y en JPEG, como sale de la cámara.
function fotoCodigo(p, codigo, o = {}) {
  return p.evaluate(({ codigo, o }) => {
    const W = o.ancho || 1200, H = o.alto || 900, mod = o.modulo || 4;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#cfc6b4"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#3a3a3a"; g.font = "28px serif";
    for (let i = 0; i < 6; i++) g.fillText(`Una historia de magia, amistad y valor (${i + 1})`, 40, 60 + i * 42);
    if (codigo) {
      const m = window.LibrosIsbn.modulos(codigo), ancho = (m.length + 22) * mod, alto = Math.round(ancho * 0.5);
      g.save();
      g.translate(W * 0.55, H * 0.65);
      g.rotate(((o.angulo || 0) * Math.PI) / 180);
      g.fillStyle = "#fff"; g.fillRect(-ancho / 2, -alto / 2, ancho, alto + 36);
      g.fillStyle = "#111";
      m.forEach((b, i) => { if (b) g.fillRect(-ancho / 2 + (11 + i) * mod, -alto / 2 + 10, mod, alto - 16); });
      g.font = "22px monospace"; g.fillText(codigo, -ancho / 2 + 11 * mod, alto / 2 + 26);
      g.restore();
    }
    const c2 = document.createElement("canvas");
    c2.width = W; c2.height = H;
    const g2 = c2.getContext("2d");
    g2.filter = `blur(${o.desenfoque == null ? 0.8 : o.desenfoque}px)`;
    g2.drawImage(c, 0, 0);
    return c2.toDataURL("image/jpeg", 0.85).split(",")[1];
  }, { codigo, o }).then(b => Buffer.from(b, "base64"));
}
// La cámara en vivo de mentira: un lienzo con el código que se mueve un poco.
function camaraFalsa(p, codigo, error, retraso) {
  return p.evaluate(({ codigo, error, retraso }) => {
    window.__camara = { pedidas: 0, apagada: false, pedido: null };
    navigator.mediaDevices.getUserMedia = async pedido => {
      window.__camara.pedidas++;
      window.__camara.pedido = pedido;
      if (error) throw new DOMException("sin permiso", error);
      const cv = document.createElement("canvas");
      cv.width = 1280; cv.height = 720;
      const g = cv.getContext("2d"), m = window.LibrosIsbn.modulos(codigo), mod = 5;
      let t = 0;
      const dibujar = () => {
        t++;
        g.fillStyle = "#9a9a9a"; g.fillRect(0, 0, 1280, 720);
        if (t * 90 < retraso) return;     // primero, apuntando a otra parte (la hora está fija)
        g.save();
        g.translate(640 + Math.sin(t / 3) * 6, 360);
        g.rotate((4 * Math.PI) / 180);
        const ancho = (m.length + 22) * mod, alto = 210;
        g.fillStyle = "#f4f4f4"; g.fillRect(-ancho / 2, -alto / 2, ancho, alto);
        g.fillStyle = "#151515";
        m.forEach((b, i) => { if (b) g.fillRect(-ancho / 2 + (11 + i) * mod, -alto / 2 + 15, mod, alto - 30); });
        g.restore();
      };
      dibujar();
      const s = cv.captureStream(15);
      const reloj = setInterval(dibujar, 90);
      s.getTracks().forEach(tr => { const parar = tr.stop.bind(tr); tr.stop = () => { window.__camara.apagada = true; clearInterval(reloj); parar(); }; });
      return s;
    };
  }, { codigo, error: error || null, retraso: retraso || 0 });
}
async function esperarTexto(p, sel, re, ms = 6000) {
  const fin = Date.now() + ms;
  let t = "";
  while (Date.now() < fin) {
    t = await txt(p, sel);
    if (re.test(t)) return t;
    await p.waitForTimeout(120);
  }
  return t;
}
async function librosEscaner(browser, base, ancho, captura) {
  console.log(`\nLibros: escanear el código de barras (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const p = await abrir(browser, base, SEM.estado(HOY), { hash: "#libros", zona: ZONA, fecha: FECHA, ancho, alto });
  consola(p);
  const pedidos = [];
  const OL_HP = { docs: [{ key: "/works/OL82586W", title: "Harry Potter y la piedra filosofal", author_name: ["J. K. Rowling"], cover_i: 10521270, first_publish_year: 1997, number_of_pages_median: 256, edition_count: 40 }] };
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    pedidos.push(r.request().url());
    r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(/isbn%3A9788478884452/.test(r.request().url()) ? OL_HP : { docs: [] }) });
  });
  await p.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  const lector = [];
  p.on("request", r => { if (/libros-isbn\.js/.test(r.url())) lector.push(r.url()); });
  await p.waitForTimeout(900);
  const todos = col => p.evaluate(c => Array.from(window.__fakeStore.colMap(`users/test/${c}`).entries()), col);
  const ESTADO = ".lesc-hoja [data-lesc-estado]";

  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(300);
  ok(await visible(p, ".lib-hoja [data-lib-escanear]"), "«📷 Escanear el código de barras» en «Buscar el libro»");
  ok((await p.evaluate(() => typeof window.LibrosIsbn)) === "undefined" && !lector.length, "el lector no se carga hasta tocar Escanear");
  await p.click(".lib-hoja [data-lib-escanear]");
  await p.waitForTimeout(500);
  ok(/Escanear el código/.test(await txt(p, ".lesc-hoja h3")) && await visible(p, ".lesc-hoja .budget-sheet-panel"), "se abre la hoja de escanear (encima del formulario)");
  ok((await p.evaluate(() => typeof window.LibrosIsbn)) === "object" && lector.length === 1, "al tocar, carga el lector (una vez)");
  const capturas = await p.$$eval(".lesc-hoja [data-lesc-foto]", els => els.map(e => e.getAttribute("capture")));
  ok(capturas[0] === "environment" && capturas[1] === null, "«Sacar foto» abre la cámara; «Elegir una foto», tus fotos");
  await captura(p, `libros-escanear-${ancho}.png`);

  // Foto con el código de un libro → busca el libro y guarda el ISBN.
  await p.locator(".lesc-hoja [data-lesc-foto]").first().setInputFiles({ name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: await fotoCodigo(p, "9788478884452", { angulo: 6 }) });
  ok(/Leí el ISBN 9788478884452/.test(await esperarTexto(p, ESTADO, /Leí el ISBN|No encontré|no es de un libro/)), "lee el código de la foto (girada y algo borrosa)");
  await p.waitForTimeout(900);
  ok(!(await visible(p, ".lesc-hoja .budget-sheet-panel")), "la hoja de escanear se cierra sola");
  ok((await p.inputValue(".lib-hoja [data-lib-q]")) === "9788478884452" && pedidos.some(u => /q=isbn%3A9788478884452/.test(u)), "pone el ISBN en el buscador y lo busca en Open Library");
  await p.waitForSelector('.lib-hoja [data-lib-elegir-libro="0"]', { timeout: 4000 });
  await p.click('.lib-hoja [data-lib-elegir-libro="0"]');
  await p.waitForTimeout(300);
  ok((await p.inputValue('.lib-hoja [name="titulo"]')) === "Harry Potter y la piedra filosofal", "tocas el resultado y se completa el libro");
  await p.click('.lib-hoja .lib-form-libro [type="submit"]');
  await p.waitForTimeout(600);
  const hp = (await todos("libros")).find(([, d]) => d.titulo === "Harry Potter y la piedra filosofal");
  ok(hp && hp[1].isbn === "9788478884452" && hp[1].olKey === "/works/OL82586W", "se guarda con su ISBN");
  if (await visible(p, ".lib-hoja .budget-sheet-panel")) { await p.click(".lib-hoja .budget-sheet-close"); await p.waitForTimeout(300); }
  await p.click(`[data-lib-ver="${hp[0]}"]`);
  await p.waitForTimeout(300);
  ok(/ISBN\s*9788478884452/.test(await txt(p, ".lib-hoja .lib-datos")), "la ficha muestra el ISBN");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  // Un código que no es de libro, y una foto sin código.
  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(300);
  await p.click(".lib-hoja [data-lib-escanear]");
  await p.waitForTimeout(300);
  await p.locator(".lesc-hoja [data-lesc-foto]").nth(1).setInputFiles({ name: "galletas.jpg", mimeType: "image/jpeg", buffer: await fotoCodigo(p, "4006381333931") });
  ok(/Ese código \(400…\) no es de un libro/.test(await esperarTexto(p, ESTADO, /no es de un libro|No encontré|Leí/)), "un código que no es de libro: lo dice");
  await p.locator(".lesc-hoja [data-lesc-foto]").first().setInputFiles({ name: "IMG_0002.jpg", mimeType: "image/jpeg", buffer: await fotoCodigo(p, null) });
  ok(/No encontré el código/.test(await esperarTexto(p, ESTADO, /No encontré|no es de un libro|Leí/)), "una foto sin código: «No encontré el código…» con consejos");
  ok(await sinDesborde(p), "no se mueve de lado");

  // Sin permiso para la cámara.
  await camaraFalsa(p, "9780439023481", "NotAllowedError");
  await p.click('.lesc-hoja [data-lesc="vivo"]');
  ok(/No hay permiso para la cámara/.test(await esperarTexto(p, ESTADO, /permiso|No pude/)), "sin permiso para la cámara: explica dónde darlo o sacar foto");

  // Cámara en vivo: lee el código mientras apuntas y apaga la cámara.
  await camaraFalsa(p, "9780439023481", null, 1500);
  await p.click('.lesc-hoja [data-lesc="vivo"]');
  await p.waitForTimeout(400);
  ok(await visible(p, ".lesc-hoja [data-lesc-vivo] video") && await visible(p, ".lesc-hoja .lesc-guia"), "se ve la cámara con el recuadro");
  const pedido = await p.evaluate(() => window.__camara.pedido);
  ok(pedido && pedido.audio === false && pedido.video.facingMode.ideal === "environment", "pide la cámara de atrás, sin micrófono");
  await captura(p, `libros-escanear-vivo-${ancho}.png`);
  const enVivo = await esperarTexto(p, ESTADO, /Leí el ISBN|no es de un libro/, 8000);
  ok(/Leí el ISBN 9780439023481/.test(enVivo), `la cámara en vivo lee el código (${enVivo})`);
  ok(await p.evaluate(() => window.__camara.apagada), "y apaga la cámara");
  await p.waitForTimeout(900);
  ok((await p.inputValue(".lib-hoja [data-lib-q]")) === "9780439023481" && /No encontré ese ISBN/.test(await txt(p, ".lib-hoja [data-lib-buscar-msg]")), "si Open Library no lo tiene, lo dice (y el ISBN queda para guardar)");
  ok((await p.inputValue('.lib-hoja [name="isbn"]')) === "9780439023481", "el ISBN queda en el formulario");

  // Cerrar la hoja con la cámara prendida la apaga.
  await p.click(".lib-hoja [data-lib-escanear]");
  await p.waitForTimeout(300);
  await camaraFalsa(p, "4006381333931");
  await p.click('.lesc-hoja [data-lesc="vivo"]');
  ok(/no es de un libro/.test(await esperarTexto(p, ESTADO, /no es de un libro|Leí/, 8000)), "en vivo, un código que no es de libro: avisa y sigue buscando");
  ok(!(await p.evaluate(() => window.__camara.apagada)), "(la cámara sigue prendida)");
  await p.click(".lesc-hoja .budget-sheet-close");
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__camara.apagada), "al cerrar la hoja se apaga la cámara");
  if (ancho < 800) {
    await p.click(".lib-hoja [data-lib-escanear]");
    await p.setViewportSize({ width: 320, height: 640 });
    await p.waitForTimeout(250);
    ok(await sinDesborde(p), "entra en 320 px");
  }
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();
}

// ---------- Fase 5e: estadísticas nuevas y "Tu año en libros" ----------
// La semilla de siempre + sesiones de "Leer ahora" (julio, septiembre, octubre y noviembre).
function semillaStats(hoy) {
  const e = SEM.estado(hoy), L = e.__SEED__["users/test/libros"];
  const s = (fecha, min, desde, hasta) => ({ fecha, min, desde, hasta, unidad: "pag", ini: Date.parse(`${fecha}T07:00:00-04:00`) });
  L.l1.sesiones = { a: s("2026-10-28", 25, 60, 70), b: s("2026-11-03", 30, 100, 112), c: s("2026-11-05", 40, 120, 135) };
  L.l5.sesiones = { a: s("2026-09-12", 60, 0, 40), b: s("2026-09-20", 90, 40, 100) };
  L.l3.sesiones = { a: s("2026-07-15", 60, 0, 30), b: s("2026-07-25", 60, 30, 60) };
  // Un libro de 2025 para pasar de año en la hoja.
  L.l11 = { v: 1, titulo: "Rayuela", autor: "Julio Cortázar", paginas: 600, estado: "terminado", genero: "novela", calificacion: 4, fechaRegistro: "2025-10-01", fechaInicio: "2025-10-02", fechaFin: "2025-11-20", creado: Date.parse("2025-10-01T08:00:00Z") };
  return e;
}
async function librosEstadisticas(browser, base, ancho, captura) {
  console.log(`\nLibros: estadísticas nuevas y «Tu año en libros» (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  const p = await abrir(browser, base, semillaStats(HOY), { hash: "#libros", zona: ZONA, fecha: FECHA, ancho, alto });
  consola(p);
  await p.evaluate(() => {
    window.__compartido = [];
    navigator.canShare = () => true;
    navigator.share = async d => { window.__compartido.push(`${d.files[0].name}:${d.files[0].type}:${d.files[0].size > 20000}`); };
  });
  await p.waitForTimeout(900);
  ok((await txt(p, "#lib-anio")) === "", "en noviembre no aparece la tarjeta del año");
  await p.click('[data-lib-vista="stats"]');
  await p.waitForTimeout(400);

  // Calendario
  ok((await txt(p, ".lest-cal h3")) === "Noviembre 2026", "calendario del mes, con su nombre");
  ok(/Leíste 4 de 6 días/.test(await txt(p, ".lest-cal .lib-nota")), `«Leíste 4 de 6 días…» (${await txt(p, ".lest-cal .lib-nota")})`);
  const celdas = await p.$$eval(".lest-grilla .lest-dia", els => els.map(b => [b.dataset.lestDia || "", b.className, b.disabled]));
  const de = f => celdas.find(c => c[0] === f) || ["", "", null];
  ok(celdas.length === 42 && celdas.slice(0, 6).every(c => /is-vacio/.test(c[1])), "semanas de lunes a domingo (el 1 es domingo)");
  ok(/n[1-4]/.test(de("2026-11-05")[1]) && /is-hoy/.test(de("2026-11-06")[1]) && de("2026-11-07")[2] === true && /n0/.test(de("2026-11-02")[1]),
    "los días leídos se pintan; hoy marcado; lo que viene, apagado");
  await p.click('[data-lest-dia="2026-11-05"]');
  const dia = await txt(p, "[data-lest-dia-txt]");
  ok(/^Jueves 5 de noviembre: .*Hábitos atómicos \(.*40 min\)/.test(dia), `tocar un día dice qué leíste (${dia})`);
  await p.click('.lest-cal [aria-label="Mes anterior"]');
  await p.waitForTimeout(150);
  ok((await txt(p, ".lest-cal h3")) === "Octubre 2026" && /Leíste \d+ de 31 días/.test(await txt(p, ".lest-cal .lib-nota")), "‹ va al mes anterior");
  await p.click('.lest-cal [aria-label="Mes siguiente"]');
  await p.waitForTimeout(150);
  ok((await txt(p, ".lest-cal h3")) === "Noviembre 2026" && await p.$eval('.lest-cal [aria-label="Mes siguiente"]', b => b.disabled), "› vuelve; no pasa del mes de hoy");

  // Tiempo, velocidad y autores
  const tiempo = await txt(p, '[data-lest="tiempo"]');
  ok(/Tiempo leyendo/.test(tiempo) && /En 2026\s*6 h 5 min/.test(tiempo) && /Este mes\s*1 h 10 min/.test(tiempo), `tiempo leyendo: el año y el mes (${tiempo.slice(0, 120)})`);
  ok(/Tu sesión más larga: 1 h 30 min con «Mero cristianismo»/.test(tiempo), "y la sesión más larga");
  await p.click('[data-graf="lest-semanas"][data-graf-i="11"]');
  ok(/^Semana del 2 de noviembre: 70 minutos$/.test(await txt(p, '[data-graf-lectura="lest-semanas"]')), "tocar una barra: los minutos de esa semana");
  const vel = await txt(p, '[data-lest="velocidad"]');
  ok(/\d+ páginas por hora/.test(vel) && /más rápido que hace unos meses|más lento|se mantiene/.test(vel), `velocidad y su tendencia (${vel.slice(0, 140)})`);
  const autores = await p.$$eval('[data-lest="autores"] .lib-genero-fila span:first-child', els => els.map(e => e.textContent));
  ok(autores.length === 5 && autores.includes("Gabriel García Márquez"), `tus autores (${autores.join(", ")})`);
  ok(await sinDesborde(p), "no se mueve de lado");
  await captura(p, `libros-stats-nuevas-${ancho}.png`);

  // Tu año en libros
  await p.click('[data-lest="anio"] [data-lanio-abrir="2026"]');
  await p.waitForTimeout(400);
  ok(/Tu año en libros/.test(await txt(p, ".lanio-hoja h3")) && /^5 libros terminados$/.test(await txt(p, ".lanio-hoja .lanio-hero")), "la hoja del año: 5 libros terminados");
  ok((await p.$$(".lanio-hoja .lanio-tapa")).length === 5 && /Tus 5 estrellas: «Cien años de soledad», «Mero cristianismo»/.test(await txt(p, ".lanio-hoja .lanio-lista")), "las tapas del año y lo mejor");
  ok(/libros? más que en 2025|fueron|Igual que/.test(await txt(p, ".lanio-hoja .lanio-comp")), "compara con el año anterior");
  await captura(p, `libros-anio-${ancho}.png`);
  await p.click('.lanio-hoja [aria-label="Año anterior"]');
  await p.waitForTimeout(250);
  ok(/^1 libro terminado$/.test(await txt(p, ".lanio-hoja .lanio-hero")) && (await txt(p, ".lanio-hoja .lanio-nav b")) === "2025", "‹ pasa a 2025");
  await p.click('.lanio-hoja [aria-label="Año siguiente"]');
  await p.waitForTimeout(250);
  await p.click(".lanio-hoja [data-lanio-compartir]");
  let compartido = [];
  for (let i = 0; i < 40 && !compartido.length; i++) { await p.waitForTimeout(200); compartido = await p.evaluate(() => window.__compartido); }
  ok(compartido[0] === "mi-anio-en-libros-2026.jpg:image/jpeg:true", `se comparte como imagen (${compartido[0]})`);
  await p.click('.lanio-hoja [data-lanio-ver="l3"]');
  await p.waitForTimeout(400);
  ok(!(await visible(p, ".lanio-hoja .budget-sheet-panel")) && /Cien años de soledad/.test(await txt(p, ".lib-hoja h3")), "tocar una tapa abre el libro");
  if (ancho < 800) {
    await p.click(".lib-hoja .budget-sheet-close");
    await p.waitForTimeout(300);
    await p.setViewportSize({ width: 320, height: 640 });
    await p.waitForTimeout(200);
    ok(await sinDesborde(p), "entra en 320 px");
  }
  ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : ""));
  await p.context().close();

  // Del 15 de diciembre al 31 de enero, la tarjeta arriba de Libros.
  for (const [fecha, se] of [["2026-12-20T09:00:00-04:00", true], ["2027-01-10T09:00:00-04:00", true], ["2027-02-03T09:00:00-04:00", false]]) {
    const q = await abrir(browser, base, semillaStats(HOY), { hash: "#libros", zona: ZONA, fecha, ancho, alto });
    await q.waitForTimeout(900);
    const t = await txt(q, "#lib-anio");
    ok(se ? /Tu año en libros 2026/.test(t) && /5 libros/.test(t) : t === "", `${fecha.slice(0, 10)}: ${se ? "tarjeta «Tu año en libros 2026»" : "sin tarjeta"}`);
    if (se && fecha.startsWith("2026-12")) {
      await captura(q, `libros-anio-tarjeta-${ancho}.png`);
      await q.click("#lib-anio .lanio-tarjeta");
      await q.waitForTimeout(400);
      ok(/^5 libros terminados$/.test(await txt(q, ".lanio-hoja .lanio-hero")), "la tarjeta abre la hoja del año");
    }
    await q.context().close();
  }
}

module.exports = { bibliaLector, bibliaMarcas, bibliaPlanes, bibliaMemoria, librosSesion, librosSiguiente, librosFrases, librosImportar, librosEscaner, librosEstadisticas, txt, visible, sinDesborde, metaDe, consola, deslizar, HOY, FECHA, ZONA };
