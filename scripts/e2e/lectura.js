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
  const iFin = tarjetas.indexOf("#finanzas");
  ok(tarjetas.slice(iFin, iFin + 4).join(",") === "#finanzas,#inversiones,#libros,#biblia", `Libros y Biblia van después de Finanzas e Inversiones (${tarjetas.join(" ")})`);
  ok(await p.$eval('#panel-inicio a[href="#libros"] .icon svg', () => true).catch(() => false), "la tarjeta Libros tiene su ícono");
  ok(await p.$eval('#panel-inicio a[href="#biblia"] .icon svg', () => true).catch(() => false), "la tarjeta Biblia tiene su ícono");
  const fuera = await p.$$eval('a[href="#libros"], a[href="#biblia"], [data-hash="libros"], [data-hash="biblia"]', els => els.filter(e => !e.closest(".card-grid-home")).length);
  ok(fuera === 0, "no aparecen en la barra inferior, el menú ni otro lugar");
  ok((await sobra(p, "html")) <= 0, "Inicio no se mueve de lado a 390 px");
  await captura(p, "lectura-inicio.png");

  await p.click('#panel-inicio a[href="#libros"]');
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-libros") && !(await visible(p, "#panel-inicio")), "la tarjeta abre Libros");
  ok(await p.$eval("#verse-banner", el => el.hidden), "Libros no muestra el versículo de arriba");
  ok(await p.$eval('[data-nav-link].active', a => a.dataset.hash).catch(() => "") === "inicio", "en Libros, la navegación resalta Inicio");
  ok(await visible(p, "#panel-libros .lib-volver") && /Inicio/.test(await p.textContent("#panel-libros .lib-volver")), "botón visible para volver a Inicio");
  await captura(p, "lectura-libros-vacio.png");
  await p.click("#panel-libros .lib-volver");
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-inicio") && !(await visible(p, "#panel-libros")), "el botón vuelve a Inicio");
  ok(await p.$eval("#verse-banner", el => !el.hidden), "en Inicio el versículo sigue");

  await p.click('#panel-inicio a[href="#biblia"]');
  await p.waitForTimeout(300);
  ok(await visible(p, "#panel-biblia"), "la tarjeta abre Biblia");
  ok(await p.$eval("#verse-banner", el => el.hidden), "Biblia no muestra el versículo de arriba");
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

  // ---------- Fase 3: Libros sin portada + frases ----------
  console.log("\nFase 3: Libros");
  const LIB = "users/test/libros", FRA = "users/test/libros_frases";
  const lb = (d) => Object.assign({ v: 1, autor: "", paginas: null, estado: "por_leer", calificacion: null, opinion: "", fechaInicio: null, fechaFin: null, creado: 1 }, d);
  const SEED_L = {
    [LIB]: {
      l1: lb({ titulo: "El principito", autor: "Antoine de Saint-Exupéry", paginas: 96, estado: "terminado", calificacion: 5, fechaRegistro: "2026-03-05", fechaInicio: "2026-02-20", fechaFin: "2026-03-01" }),
      l2: lb({ titulo: "Cien años de soledad", autor: "Gabriel García Márquez", paginas: 471, estado: "leyendo", fechaRegistro: "2026-10-20", fechaInicio: "2026-10-20" }),
      l3: lb({ titulo: "Rayuela <b>x</b>", autor: "Julio Cortázar", fechaRegistro: "2026-09-01" })
    },
    [FRA]: { f1: { v: 1, libroId: "l1", texto: "Lo esencial es invisible a los ojos.", pagina: 72, fecha: "2026-03-02", creado: 1 } }
  };
  const w = await abrir(browser, base, { __SEED__: SEED_L }, { hash: "#libros", zona: ZONA, fecha: HOY });
  const tx = sel => w.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
  const col = c => w.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), c);
  const lc = n => `.lib-hoja [name="${n}"]`;
  const esc2 = async (sel, val) => { await w.fill(sel, ""); await w.type(sel, String(val)); };
  const guardarL = async () => { await w.click('.lib-hoja [type="submit"]'); await w.waitForTimeout(350); };
  const hojaL = () => w.evaluate(() => { const h = document.querySelector(".lib-hoja"); return !!h && !h.hidden; });
  const titulos = () => w.$$eval("#lib-lista .lib-card-t", els => els.map(e => e.textContent));

  const cifras = await w.$$eval(".lib-cifras b", els => els.map(e => e.textContent));
  ok(cifras.join("|") === "1|1|96", `resumen: 1 leyendo, 1 terminado en 2026, 96 páginas leídas (${cifras.join(" · ")})`);
  ok((await titulos()).join(" | ") === "Cien años de soledad | Rayuela <b>x</b> | El principito", "lista por fecha de registro, lo nuevo primero (y < > como texto)");
  ok(await w.$$eval("#lib-lista .lib-tapa b", els => els.length === 3 && els[0].textContent === "Cien años de soledad"), "sin portada: tapa genérica con título y autor");
  await captura(w, "libros-lista.png");
  await w.type("#lib-buscar", "exupery");
  await w.waitForTimeout(150);
  ok((await titulos()).join() === "El principito", "buscar por autor sin tildes");
  await w.fill("#lib-buscar", "");
  await w.dispatchEvent("#lib-buscar", "input");
  await w.click('[data-lib-estado="leyendo"]');
  await w.waitForTimeout(150);
  ok((await titulos()).join() === "Cien años de soledad", "filtro por estado (Leyendo)");
  await w.click('[data-lib-estado=""]');
  await w.selectOption("#lib-orden", "titulo");
  await w.waitForTimeout(150);
  ok((await titulos()).join(" | ") === "Cien años de soledad | El principito | Rayuela <b>x</b>", "ordenar por título");
  await w.selectOption("#lib-orden", "fin");
  await w.waitForTimeout(150);
  ok((await titulos())[0] === "El principito" && /Terminado 1 mar 2026/.test(await tx("#lib-lista")), "ordenar por fecha de fin (y la muestra)");
  await w.selectOption("#lib-orden", "registro");

  console.log("\nAgregar y editar un libro");
  await w.click('[data-lib="nuevo"]');
  await w.waitForTimeout(350);
  ok((await w.inputValue(lc("fechaRegistro"))) === "2026-10-29" && (await w.inputValue(lc("fechaInicio"))) === "", "fecha de registro: hoy por defecto");
  await guardarL();
  ok(await hojaL() && /Escribe el título/.test(await tx(".lib-hoja .lib-error")), "sin título no se guarda");
  await esc2(lc("titulo"), "Pedro Páramo");
  await esc2(lc("autor"), "Juan Rulfo");
  await esc2(lc("paginas"), "124");
  await w.click('.lib-hoja [data-lib-set-estado="leyendo"]');
  ok((await w.inputValue(lc("fechaInicio"))) === "2026-10-29" && /Puse hoy como fecha de inicio/.test(await tx(".lib-hoja [data-lib-aviso-fecha]")), "al marcar «Leyendo» propone hoy como inicio (y avisa)");
  await w.click('.lib-hoja [data-lib-cal="4"]');
  await w.fill(lc("fechaRegistro"), "2025-12-01");
  await w.fill(lc("fechaInicio"), "2025-12-01");
  await w.click('.lib-hoja [data-lib-set-estado="terminado"]');
  await w.fill(lc("fechaFin"), "2025-11-20");
  await guardarL();
  ok(/no puede ser antes del inicio/.test(await tx(".lib-hoja .lib-error")), "fin antes del inicio no se guarda");
  await w.fill(lc("fechaFin"), "2025-12-28");
  await esc2(lc("opinion"), "Corto e inolvidable.");
  await captura(w, "libros-form.png");
  await guardarL();
  let libs = await col(LIB);
  const pp = libs.find(([, d]) => d.titulo === "Pedro Páramo");
  ok(pp && pp[1].autor === "Juan Rulfo" && pp[1].paginas === 124 && pp[1].estado === "terminado" && pp[1].calificacion === 4 && pp[1].fechaRegistro === "2025-12-01" && pp[1].fechaInicio === "2025-12-01" && pp[1].fechaFin === "2025-12-28" && pp[1].opinion === "Corto e inolvidable.", "guardado con todos sus datos y fechas pasadas");

  console.log("\nFicha y frases");
  await w.click('[data-lib-ver="l1"]');
  await w.waitForTimeout(350);
  const ficha = await tx(".lib-hoja .lib-ficha");
  ok(/El principito/.test(ficha) && /★★★★★/.test(ficha) && /Páginas\s*96/.test(ficha) && /Terminado\s*1 mar 2026/.test(ficha) && /Lo esencial es invisible/.test(ficha), "la ficha muestra datos, calificación, fechas y frases");
  await w.click('.lib-hoja [data-lib="frase-de"]');
  await w.waitForTimeout(300);
  ok(/De El principito/.test(await tx(".lib-hoja")) && (await w.inputValue(lc("fecha"))) === "2026-10-29", "frase desde el libro: el libro ya elegido y fecha de hoy");
  await esc2(lc("texto"), "Fue el tiempo que pasaste con tu rosa lo que la hizo tan importante.");
  await esc2(lc("pagina"), "80");
  await guardarL();
  ok(/Frases 2/.test(await tx(".lib-hoja .lib-h-fila")), "al guardar vuelve a la ficha con 2 frases");
  await captura(w, "libros-ficha.png");
  const fNueva = (await col(FRA)).find(([, d]) => d.pagina === 80);
  await w.click(`.lib-hoja [data-lib-frase="${fNueva[0]}"]`);
  await w.waitForTimeout(300);
  await esc2(lc("pagina"), "81");
  await guardarL();
  ok((await col(FRA)).find(([id]) => id === fNueva[0])[1].pagina === 81, "editar una frase");
  await w.click('.lib-hoja [data-lib="editar"]');
  await w.waitForTimeout(300);
  ok((await w.inputValue(lc("titulo"))) === "El principito" && (await w.$eval('.lib-hoja [data-lib-cal="5"]', b => b.classList.contains("on"))), "Editar trae los datos del libro");
  await esc2(lc("opinion"), "Para releer cada año.");
  await guardarL();
  ok(/Para releer cada año/.test(await tx(".lib-hoja .lib-opinion")), "al guardar vuelve a la ficha con la opinión");
  await w.click(".lib-hoja .budget-sheet-close");
  await w.waitForTimeout(300);

  await w.click('[data-lib-vista="frases"]');
  await w.waitForTimeout(200);
  ok((await w.$$("#lib-frases .lib-frase")).length === 2 && /El principito, Antoine de Saint-Exupéry · p. 81/.test(await tx("#lib-frases")), "Todas mis frases, con su libro y página");
  await w.type("#lib-buscar-frases", "rosa");
  await w.waitForTimeout(150);
  ok((await w.$$("#lib-frases .lib-frase")).length === 1, "buscador de frases");
  await w.fill("#lib-buscar-frases", "principito");
  await w.dispatchEvent("#lib-buscar-frases", "input");
  ok((await w.$$("#lib-frases .lib-frase")).length === 2, "también busca por el libro");
  await w.click('[data-lib="nueva-frase"]');
  await w.waitForTimeout(300);
  await esc2(lc("texto"), "Andábamos sin buscarnos.");
  await guardarL();
  ok(/Elige el libro/.test(await tx(".lib-hoja .lib-error")), "desde Todas mis frases hay que elegir el libro");
  await w.selectOption(lc("libroId"), "l3");
  await guardarL();
  ok((await col(FRA)).some(([, d]) => d.libroId === "l3" && d.texto === "Andábamos sin buscarnos."), "frase guardada en el libro elegido");
  await w.click('[data-lib-vista="libros"]');
  await w.waitForTimeout(200);

  console.log("\nBorrar y exportar");
  await w.click('[data-lib-ver="l1"]');
  await w.waitForTimeout(300);
  await w.click('.lib-hoja [data-lib="borrar"]');
  await w.waitForTimeout(400);
  ok(!(await col(LIB)).some(([id]) => id === "l1") && !(await col(FRA)).some(([, d]) => d.libroId === "l1"), "Eliminar (con confirmación) borra el libro y sus frases");
  ok((await col(FRA)).length === 1, "las frases de otros libros quedan");
  const fs2 = require("fs");
  const [dl] = await Promise.all([w.waitForEvent("download"), w.click('[data-lib="exportar"]')]);
  const jl = JSON.parse(fs2.readFileSync(await dl.path(), "utf8"));
  ok(dl.suggestedFilename() === "manolo-libros-2026-10-29.json" && jl.libros.length === (await col(LIB)).length && jl.frases.length === 1, "Exportar (JSON) con libros y frases");
  await w.setViewportSize({ width: 320, height: 700 });
  await w.waitForTimeout(200);
  ok((await w.$eval("html", el => el.scrollWidth - el.clientWidth)) <= 0, "la lista cabe a 320 px");
  await w.click(`[data-lib-ver="${pp[0]}"]`);
  await w.waitForTimeout(300);
  ok((await w.$eval(".lib-hoja .budget-sheet-panel", el => el.scrollWidth - el.clientWidth)) === 0, "la ficha cabe a 320 px");
  await w.click('.lib-hoja [data-lib="editar"]');
  await w.waitForTimeout(300);
  ok((await w.$eval(".lib-hoja .budget-sheet-panel", el => el.scrollWidth - el.clientWidth)) === 0 && (await w.$eval(lc("titulo"), el => getComputedStyle(el).fontSize)) === "16px", "el formulario cabe y sus campos son de 16 px");
  ok(!w.errores.length, "sin errores de página");
  await w.context().close();

  // ---------- Fase 4: portadas ----------
  console.log("\nFase 4: portadas");
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const OL = { docs: [
    { title: "Pedro Páramo", author_name: ["Juan Rulfo"], cover_i: 5419076, first_publish_year: 1955 },
    { title: "Pedro Páramo (edición crítica)", author_name: ["Juan Rulfo"] },
    { title: "Pedro Páramo", author_name: ["Juan Rulfo"], cover_i: 8000001 }
  ] };
  let modoOL = "ok"; // ok | vacio | caido
  const SEED_P = { [LIB]: {
    lc: lb({ titulo: "Cien años de soledad", autor: "Gabriel García Márquez", fechaRegistro: "2026-10-20", portada: { tipo: "url", url: "https://covers.openlibrary.org/b/id/12627383-M.jpg", fuente: "openlibrary" } }),
    lr: lb({ titulo: "Rayuela", autor: "Julio Cortázar", fechaRegistro: "2026-10-10", portada: { tipo: "url", url: "https://covers.openlibrary.org/b/id/404-M.jpg", fuente: "openlibrary" } })
  } };
  const z = await abrir(browser, base, { __SEED__: SEED_P }, { hash: "#libros", zona: ZONA, fecha: HOY });
  await z.context().route(/openlibrary\.org\/search\.json/, r => (modoOL === "caido" ? r.abort() : r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(modoOL === "vacio" ? { docs: [] } : OL) })));
  await z.context().route(/covers\.openlibrary\.org/, r => (/\/404-/.test(r.request().url()) ? r.fulfill({ status: 404, body: "" }) : r.fulfill({ contentType: "image/png", body: PNG })));
  await z.reload();
  await z.waitForTimeout(900);
  const zt = sel => z.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
  const zc = c => z.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), c);
  const zl = n => `.lib-hoja [name="${n}"]`;
  const zEsc = async (sel, val) => { await z.fill(sel, ""); await z.type(sel, String(val)); };
  const zGuardar = async () => { await z.click('.lib-hoja [type="submit"]'); await z.waitForTimeout(400); };
  const imgDe = id => z.$eval(`[data-lib-ver="${id}"] .lib-portada`, el => { const i = el.querySelector("img"); return i ? { src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0 } : null; }).catch(() => null);

  let im = await imgDe("lc");
  ok(im && im.ok && /12627383-M\.jpg$/.test(im.src), "portada de Open Library guardada como URL: se ve en la lista");
  ok((await imgDe("lr")) === null && await z.$eval('[data-lib-ver="lr"] .lib-tapa b', b => b.textContent === "Rayuela"), "si la imagen no carga (sin internet o borrada), queda la tapa genérica");

  await z.click('[data-lib="nuevo"]');
  await z.waitForTimeout(350);
  await z.click('.lib-hoja [data-lib="buscar-portada"]');
  await z.waitForTimeout(200);
  ok(/Escribe el título primero/.test(await zt(".lib-hoja [data-lib-portada-msg]")), "buscar sin título pide escribirlo");
  await zEsc(zl("titulo"), "Pedro Páramo");
  await zEsc(zl("autor"), "Juan Rulfo");
  await z.click('.lib-hoja [data-lib="buscar-portada"]');
  await z.waitForTimeout(500);
  const resultados = await z.$$eval(".lib-hoja [data-lib-elegir-portada]", bs => bs.map(b => b.dataset.libElegirPortada));
  ok(resultados.join(",") === "https://covers.openlibrary.org/b/id/5419076-M.jpg,https://covers.openlibrary.org/b/id/8000001-M.jpg", `busca por título y autor y muestra solo las que tienen portada (${resultados.length})`);
  await captura(z, "libros-buscar-portada.png");
  await z.click(`.lib-hoja [data-lib-elegir-portada="${resultados[0]}"]`);
  ok((await z.$eval(".lib-hoja [data-lib-prev] img", i => i.getAttribute("src"))) === resultados[0] && await z.$eval(`.lib-hoja [data-lib-elegir-portada="${resultados[0]}"]`, b => b.classList.contains("is-elegida")), "al tocar una, se ve en la vista previa");
  await zGuardar();
  let libsP = await zc(LIB);
  const pedro = libsP.find(([, d]) => d.titulo === "Pedro Páramo");
  ok(pedro && JSON.stringify(pedro[1].portada) === JSON.stringify({ tipo: "url", url: resultados[0], fuente: "openlibrary" }), "se guarda solo la URL de la portada");

  await z.click(`[data-lib-ver="${pedro[0]}"]`);
  await z.waitForTimeout(300);
  await z.click('.lib-hoja [data-lib="editar"]');
  await z.waitForTimeout(300);
  modoOL = "vacio";
  await z.click('.lib-hoja [data-lib="buscar-portada"]');
  await z.waitForTimeout(400);
  ok(/No encontré portadas/.test(await zt(".lib-hoja [data-lib-portada-msg]")), "sin resultados lo dice y sugiere una foto");
  modoOL = "caido";
  await z.click('.lib-hoja [data-lib="buscar-portada"]');
  await z.waitForTimeout(400);
  ok(/No se pudo buscar \(¿estás sin internet\?\)/.test(await zt(".lib-hoja [data-lib-portada-msg]")), "sin internet, la búsqueda avisa (y no se rompe nada)");

  console.log("\nFoto desde el iPhone");
  const grande = await z.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 2400; c.height = 3200;
    const x = c.getContext("2d");
    for (let i = 0; i < 6000; i++) { x.fillStyle = `hsl(${(i * 37) % 360},70%,${25 + (i % 50)}%)`; x.fillRect((i * 7919) % 2400, (i * 104729) % 3200, 90, 90); }
    return c.toDataURL("image/png").split(",")[1];
  });
  await z.setInputFiles(".lib-hoja [data-lib-foto]", { name: "foto.png", mimeType: "image/png", buffer: Buffer.from(grande, "base64") });
  await z.waitForTimeout(1200);
  ok(/Foto lista \(≈ \d+ KB\)/.test(await zt(".lib-hoja [data-lib-portada-msg]")), `una foto grande (2400 × 3200) se prepara: ${await zt(".lib-hoja [data-lib-portada-msg]")}`);
  ok(/^data:image\/jpeg/.test(await z.$eval(".lib-hoja [data-lib-prev] img", i => i.getAttribute("src"))), "y se ve en la vista previa");
  await zGuardar();
  const fotos = await zc("users/test/libros_portadas");
  const foto = fotos.find(([id]) => id === pedro[0]);
  ok(foto && foto[1].datos.startsWith("data:image/jpeg;base64,") && foto[1].datos.length <= 300000 && foto[1].ancho <= 400 && foto[1].alto <= 600, `foto achicada y comprimida (${foto && foto[1].ancho} × ${foto && foto[1].alto}, ≈ ${foto && foto[1].kb} KB) en libros_portadas, lejos del límite de 1 MB`);
  libsP = await zc(LIB);
  ok(libsP.find(([id]) => id === pedro[0])[1].portada.tipo === "foto" && !("datos" in libsP.find(([id]) => id === pedro[0])[1].portada), "en el libro va solo «foto» (la imagen, aparte)");
  await z.click(".lib-hoja .budget-sheet-close");
  await z.waitForTimeout(300);
  im = await imgDe(pedro[0]);
  ok(im && im.ok && /^data:image\/jpeg/.test(im.src), "la foto se ve en la lista");
  await captura(z, "libros-portadas.png");

  await z.click(`[data-lib-ver="${pedro[0]}"]`);
  await z.waitForTimeout(300);
  await z.click('.lib-hoja [data-lib="editar"]');
  await z.waitForTimeout(300);
  await z.click('.lib-hoja [data-lib="quitar-portada"]');
  await zGuardar();
  ok((await zc(LIB)).find(([id]) => id === pedro[0])[1].portada === null && !(await zc("users/test/libros_portadas")).some(([id]) => id === pedro[0]), "«Quitar portada» vuelve a la tapa genérica y borra la foto");

  await z.click('.lib-hoja [data-lib="editar"]');
  await z.waitForTimeout(300);
  await z.setInputFiles(".lib-hoja [data-lib-foto]", { name: "foto.png", mimeType: "image/png", buffer: Buffer.from(grande, "base64") });
  await z.waitForTimeout(1200);
  await zGuardar();
  const [dlP] = await Promise.all([z.waitForEvent("download"), z.evaluate(() => { document.querySelector(".lib-hoja .budget-sheet-close").click(); }).then(() => z.waitForTimeout(300)).then(() => z.click('[data-lib="exportar"]'))]);
  const jp = JSON.parse(require("fs").readFileSync(await dlP.path(), "utf8"));
  ok(jp.fotosDePortada.length === 1 && jp.fotosDePortada[0].libroId === pedro[0], "Exportar (JSON) incluye las fotos de portada");
  await z.click(`[data-lib-ver="${pedro[0]}"]`);
  await z.waitForTimeout(300);
  await z.click('.lib-hoja [data-lib="borrar"]');
  await z.waitForTimeout(400);
  ok(!(await zc("users/test/libros_portadas")).length, "borrar el libro borra también su foto de portada");
  ok(!z.errores.length, "sin errores de página");
  await z.context().close();

  await terminar(browser, srv);
})();
