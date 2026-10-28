// Pruebas de pantalla de Libros y Biblia (sub-paneles de Inicio).
// Uso: node scripts/e2e/lectura.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-10-29T08:00:00-04:00";
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, {}, { hash: "#inicio", zona: ZONA, fecha: HOY });

  console.log("\nFase 1: tarjetas en Inicio y secciones");
  const tarjetas = await p.$$eval("#panel-inicio .card-grid-home > a.card", els => els.map(a => a.getAttribute("href")));
  ok(tarjetas.slice(-4).join(",") === "#finanzas,#inversiones,#libros,#biblia", `Libros y Biblia van después de Finanzas e Inversiones (${tarjetas.join(" ")})`);
  ok(await p.$eval('#panel-inicio a[href="#libros"] .icon svg', () => true).catch(() => false), "la tarjeta Libros tiene su ícono");
  ok(await p.$eval('#panel-inicio a[href="#biblia"] .icon svg', () => true).catch(() => false), "la tarjeta Biblia tiene su ícono");
  const fuera = await p.$$eval('a[href="#libros"], a[href="#biblia"], [data-hash="libros"], [data-hash="biblia"]', els => els.filter(e => !e.closest(".card-grid-home")).length);
  ok(fuera === 0, "no aparecen en la barra inferior, el menú ni otro lugar");
  ok((await sobra(p, "html")) <= 0, "Inicio no se mueve de lado a 390 px");
  await captura(p, "lectura-inicio.png");

  await p.click('#panel-inicio a[href="#libros"]');
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-libros") && !(await visible(p, "#panel-inicio")), "la tarjeta abre Libros");
  ok(await p.$eval('[data-nav-link].active', a => a.dataset.hash).catch(() => "") === "inicio", "en Libros, la navegación resalta Inicio");
  ok(await visible(p, "#panel-libros .lib-volver") && /Inicio/.test(await p.textContent("#panel-libros .lib-volver")), "botón visible para volver a Inicio");
  await captura(p, "lectura-libros-vacio.png");
  await p.click("#panel-libros .lib-volver");
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-inicio") && !(await visible(p, "#panel-libros")), "el botón vuelve a Inicio");

  await p.click('#panel-inicio a[href="#biblia"]');
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-biblia"), "la tarjeta abre Biblia");
  await p.goBack();
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-inicio") && !(await visible(p, "#panel-biblia")), "atrás del navegador vuelve a Inicio");
  await p.goForward();
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-biblia"), "y adelante vuelve a Biblia");
  ok((await sobra(p, "html")) <= 0, "Biblia no se mueve de lado a 390 px");

  await p.setViewportSize({ width: 1280, height: 900 });
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  const filas = await p.$$eval('#panel-inicio a[href="#inversiones"], #panel-inicio a[href="#libros"]', els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  ok(filas[1] > filas[0], "en la compu, Libros queda debajo de Inversiones");
  ok((await sobra(p, "html")) <= 0, "sin desborde a 1280 px");
  ok(!p.errores.length, "sin errores de página");

  await p.context().close();

  // ---------- Fase 2: Biblia ----------
  console.log("\nFase 2: Biblia");
  const BIB = "users/test/biblia";
  const v = (fecha, libro, capitulo, versiculo, texto, extra) => Object.assign({ v: 1, fecha, libro, capitulo, versiculo, texto, nota: "", creado: 1 }, extra);
  const SEED = { [BIB]: {
    b1: v("2026-10-26", "Ps", 91, "1", "El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente."),
    b2: v("2026-10-27", "John", 3, "16", "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito. <img src=x onerror=alert(1)>"),
    b3: v("2026-10-28", "Ps", 23, "1", "Jehová es mi pastor; nada me faltará.", { nota: "Para empezar el día con paz" })
  } };
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#biblia", zona: ZONA, fecha: HOY });
  const txt = sel => q.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
  const bib = () => q.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), BIB);
  const campo = n => `.bib-hoja [name="${n}"]`;
  const escribir = async (sel, val) => { await q.fill(sel, ""); await q.type(sel, String(val)); };
  const guardar = async () => { await q.click('.bib-hoja [type="submit"]'); await q.waitForTimeout(350); };
  const hojaAbierta = () => q.evaluate(() => { const h = document.querySelector(".bib-hoja"); return !!h && !h.hidden; });

  const racha = await q.$$eval(".bib-racha b", els => els.map(e => e.textContent.trim()));
  ok(racha.join("|") === "🔥 3|3|3", `racha viva de 3 días (hoy aún no anotó), mejor 3, 3 en octubre (${racha.join(" · ")})`);
  ok(/Anota el de hoy para seguir la racha/.test(await txt(".bib-hoy")), "invita a anotar el de hoy");
  let citas = await q.$$eval("#bib-lista .bib-item-arriba b", els => els.map(e => e.textContent));
  ok(citas.join(", ") === "Salmos 23:1, Juan 3:16, Salmos 91:1", `lista por fecha, lo más reciente arriba (${citas.join(", ")})`);
  ok(/Octubre 2026/.test(await txt("#bib-lista .lib-mes-titulo")), "agrupada por mes");
  ok(!(await q.$("#bib-lista img")) && /<img src=x/.test(await txt("#bib-lista")), "un texto con < > se muestra como texto");
  await captura(q, "biblia-lista.png");

  await q.type("#bib-buscar", "altisimo");
  await q.waitForTimeout(150);
  citas = await q.$$eval("#bib-lista .bib-item-arriba b", els => els.map(e => e.textContent));
  ok(citas.join() === "Salmos 91:1" && /1 de 3/.test(await txt("#bib-lista")), "el buscador encuentra sin tildes (altisimo → Altísimo)");
  await q.fill("#bib-buscar", "");
  await q.dispatchEvent("#bib-buscar", "input");
  const opciones = await q.$$eval("#bib-libro option", os => os.map(o => o.textContent));
  ok(opciones.join("|") === "Todos los libros (3)|Salmos (2)|Juan (1)", `filtro con los libros usados, en orden bíblico (${opciones.join(", ")})`);
  await q.selectOption("#bib-libro", "Ps");
  await q.waitForTimeout(150);
  ok((await q.$$("#bib-lista .bib-item")).length === 2, "filtrar por Salmos deja 2");
  await q.selectOption("#bib-libro", "");
  await q.waitForTimeout(150);

  console.log("\nAnotar, editar y borrar");
  await q.click('[data-bib="nuevo"]');
  await q.waitForTimeout(350);
  ok(await hojaAbierta(), "se abre la hoja");
  ok((await q.inputValue(campo("fecha"))) === "2026-10-29" && (await q.inputValue(campo("libro"))) === "Ps", "fecha de hoy y el último libro que usaste");
  ok((await q.$$eval(`${campo("libro")} option:not([disabled])`, os => os.length)) === 66, "se elige entre los 66 libros");
  await q.selectOption(campo("libro"), "Prov");
  ok(/Capítulo \(1 a 31\)/.test(await txt(".bib-hoja [data-bib-cap]")), "dice cuántos capítulos tiene el libro");
  await escribir(campo("capitulo"), "40");
  await escribir(campo("versiculo"), "5-6");
  await escribir(campo("texto"), "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.");
  await guardar();
  ok(await hojaAbierta() && /Proverbios va de 1 a 31/.test(await txt(".bib-hoja .lib-error")), "un capítulo que no existe no se guarda");
  await escribir(campo("capitulo"), "3");
  await escribir(campo("nota"), "Subrayado en rojo");
  await captura(q, "biblia-hoja.png");
  await guardar();
  let docs = await bib();
  const nuevo = docs.find(([, d]) => d.libro === "Prov");
  ok(nuevo && nuevo[1].fecha === "2026-10-29" && nuevo[1].capitulo === 3 && nuevo[1].versiculo === "5-6" && nuevo[1].nota === "Subrayado en rojo" && typeof nuevo[1].creado === "number", "guardado con fecha, cita, texto y nota");
  ok((await q.$$eval(".bib-racha b", els => els[0].textContent.trim())) === "🔥 4" && /Hoy ya anotaste/.test(await txt(".bib-hoy")), "la racha sube a 4 y dice que hoy ya anotaste");

  await q.click(`[data-bib-editar="${nuevo[0]}"]`);
  await q.waitForTimeout(350);
  ok((await txt("#bib-hoja-t")) === "Editar versículo", "tocar un versículo lo abre para editar");
  await escribir(campo("versiculo"), "5");
  await guardar();
  let d = (await bib()).find(([id]) => id === nuevo[0])[1];
  ok(d.versiculo === "5" && d.creado === nuevo[1].creado, "editado (y no pierde su hora de creación)");

  await q.click('[data-bib="nuevo"]');
  await q.waitForTimeout(350);
  await q.fill(campo("fecha"), "2026-10-20");
  await q.selectOption(campo("libro"), "Phil");
  await escribir(campo("capitulo"), "4");
  await escribir(campo("versiculo"), "13");
  await escribir(campo("texto"), "Todo lo puedo en Cristo que me fortalece.");
  await guardar();
  ok((await bib()).some(([, x]) => x.fecha === "2026-10-20" && x.libro === "Phil"), "se pueden cargar días pasados");

  await q.click(`[data-bib-editar="b2"]`);
  await q.waitForTimeout(350);
  await q.click('.bib-hoja [data-bib="borrar"]');
  await q.waitForTimeout(350);
  ok(!(await bib()).some(([id]) => id === "b2") && !(await hojaAbierta()), "Eliminar (con confirmación) lo borra");

  console.log("\nCalendario");
  await q.click('[data-bib-vista="calendario"]');
  await q.waitForTimeout(250);
  const marcados = await q.$$eval(".bib-cal-dia.is-hecho:not(.is-fuera)", els => els.map(e => e.dataset.bibDia));
  ok(marcados.join(",") === "2026-10-20,2026-10-26,2026-10-28,2026-10-29", `marca los días anotados (${marcados.join(", ")})`);
  ok(await q.$eval('[data-bib-dia="2026-10-29"]', e => e.classList.contains("is-hoy")) && await q.$eval('[data-bib-dia="2026-10-30"]', e => e.disabled), "hoy resaltado, días futuros desactivados");
  ok(/Proverbios 3:5/.test(await txt("#bib-cal-vista")), "abajo, el versículo del día elegido (hoy)");
  await captura(q, "biblia-calendario.png");
  await q.click('[data-bib-dia="2026-10-15"]');
  await q.waitForTimeout(200);
  ok(/Ese día no anotaste/.test(await txt("#bib-cal-vista")), "un día sin anotar lo dice");
  await q.click('[data-bib="nuevo-dia"]');
  await q.waitForTimeout(350);
  ok((await q.inputValue(campo("fecha"))) === "2026-10-15", "«Anotar el …» abre la hoja con esa fecha");
  await q.click(".bib-hoja .budget-sheet-close");
  await q.waitForTimeout(300);
  await q.click('[data-bib-mes="-1"]');
  await q.waitForTimeout(200);
  ok(/Septiembre 2026/.test(await txt(".bib-cal-cab")), "‹ va al mes anterior");
  ok(!(await q.$eval('[data-bib-mes="1"]', e => e.disabled)), "y › vuelve");
  await q.click('[data-bib-mes="1"]');
  await q.waitForTimeout(200);
  ok(await q.$eval('[data-bib-mes="1"]', e => e.disabled), "no se puede pasar del mes actual");

  console.log("\nExportar y pantalla angosta");
  const fs = require("fs");
  const [descarga] = await Promise.all([q.waitForEvent("download"), q.click('[data-bib="exportar"]')]);
  const j = JSON.parse(fs.readFileSync(await descarga.path(), "utf8"));
  ok(descarga.suggestedFilename() === "manolo-biblia-2026-10-29.json" && j.versiculos.length === (await bib()).length && j.versiculos.some(x => x.cita === "Proverbios 3:5"), "Exportar (JSON) con todos los versículos y su cita");
  await q.setViewportSize({ width: 320, height: 700 });
  await q.waitForTimeout(200);
  ok((await q.$eval("html", el => el.scrollWidth - el.clientWidth)) <= 0, "el calendario cabe a 320 px");
  await q.click('[data-bib-vista="lista"]');
  await q.waitForTimeout(200);
  ok((await q.$eval("html", el => el.scrollWidth - el.clientWidth)) <= 0, "la lista cabe a 320 px");
  await q.click('[data-bib="nuevo"]');
  await q.waitForTimeout(350);
  ok((await q.$eval(".bib-hoja .budget-sheet-panel", el => el.scrollWidth - el.clientWidth)) === 0 && (await q.$eval(campo("texto"), el => getComputedStyle(el).fontSize)) === "16px", "la hoja cabe y los campos son de 16 px (sin zoom en el iPhone)");
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();

  await terminar(browser, srv);
})();
