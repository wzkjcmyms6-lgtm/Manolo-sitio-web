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

// Estado con la Temporada 2 ya vista (para probar el resto sin la hoja).
function conTemporadaVista(opciones) {
  const e = SEM.estado(HOY, opciones);
  Object.assign(e.__SEED__["users/test/meta"].habitos_juego, { calibracion: 2, temporada1: { nivel: 16, rangos: SNAP_T1.rangos, logros: SNAP_T1.logros, hasta: HOY, visto: true } });
  return e;
}

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

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Gestionar categorías a ${ancho} px`);
    const p = await abrir(browser, base, conTemporadaVista(), { hash: "#habitos", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
    consolaLimpia(p);
    await p.waitForTimeout(500);
    await p.click("#hb-lista [data-ajustes]");
    await p.waitForTimeout(300);
    ok((await p.$$(".hb-ajuste-emojis span")).length === 10, "Ajustes muestra las 10 categorías");
    await p.click("[data-cat-gestionar]");
    await p.waitForTimeout(300);
    const nombres = await p.$$eval(".hb-cats .hb-nombre", els => els.map(e => e.textContent));
    ok(nombres.join(",") === "Cuerpo,Mente,Finanzas,Carrera,Paz,Social,Fe,Lectura,Cuidado personal,Hogar", `con tus nombres y las 4 elegidas (${nombres})`);
    ok(!(await p.$("[data-cat-sugerida]")), "ya no hay «Sugeridas»: vienen de fábrica");
    ok(/2 sin categoría/.test(await texto(p, "[data-cat-asignar]")), "avisa de 2 hábitos sin categoría");
    await captura(p, `hab-cats-${ancho}.png`);
    // Crear
    await p.click('[data-cat-nueva="lista"]');
    await p.waitForTimeout(250);
    await p.fill('[name="catNombre"]', "Música");
    await p.click('[data-cat-emoji="🎸"]');
    await p.click('[data-cat-color="azul"]');
    ok((await p.inputValue('[name="catNombre"]')) === "Música", "el nombre escrito se conserva al elegir emoji y color");
    await captura(p, `hab-cat-editor-${ancho}.png`);
    await p.click('.hb-cat-form [type="submit"]');
    await p.waitForTimeout(400);
    let j = await juego(p);
    ok(j.categorias && j.categorias.musica && j.categorias.musica.emoji === "🎸" && j.categorias.musica.color === "azul" && j.categorias.musica.orden === 11, "crea «Música» 🎸 azul al final");
    ok((await p.$$(".hb-cats .hb-orden-item")).length === 11, "aparece en la lista");
    // Repetido
    await p.click('[data-cat-nueva="lista"]');
    await p.fill('[name="catNombre"]', "mente");
    await p.click('.hb-cat-form [type="submit"]');
    await p.waitForTimeout(250);
    ok(/Ya tienes una categoría «Mente»/.test(await texto(p, ".hb-cat-form .hb-error")), "no deja repetir un nombre");
    await p.click("[data-cat-cancelar]");
    await p.waitForTimeout(250);
    // Ordenar
    await p.click('[data-cat-id="musica"] [data-cat-mover="-1"]');
    await p.waitForTimeout(250);
    ok((await p.$$eval(".hb-cats .hb-nombre", els => els.map(e => e.textContent))).join(",") === "Cuerpo,Mente,Finanzas,Carrera,Paz,Social,Fe,Lectura,Cuidado personal,Música,Hogar", "se mueve con las flechas");
    // Eliminar una sin historia; no archivar una con hábitos activos
    await p.click('[data-cat-editar="carrera"]');
    await p.waitForTimeout(250);
    ok(await p.$("[data-cat-borrar]") !== null, "sin hábitos ni historia: se puede eliminar");
    await p.click("[data-cat-borrar]");
    await p.waitForTimeout(300);
    j = await juego(p);
    ok(j.categorias.carrera && j.categorias.carrera.borrada === true && !(await p.$('[data-cat-id="carrera"]')), "eliminar la marca como borrada y sale de la lista");
    await p.click('[data-cat-editar="cuerpo"]');
    await p.waitForTimeout(250);
    ok(!(await p.$("[data-cat-archivar]")) && /La usan 3 hábitos activos/.test(await texto(p, ".hb-cat-peligro")), "con hábitos activos no se archiva sin moverlos");
    await p.click(".hb-sheet .muscle-sheet-close");
    await p.waitForTimeout(300);
    // Asignar en lote
    await p.click("#hb-lista [data-ajustes]");
    await p.click("[data-cat-gestionar]");
    await p.click("[data-cat-asignar]");
    await p.waitForTimeout(250);
    const marcados = await p.$$eval('.hb-asignar-item[aria-checked="true"] .hb-nombre', els => els.map(e => e.textContent));
    ok(marcados.join(",") === "Orar,Estirar", `marca los que no tienen categoría (${marcados})`);
    await p.click('[data-asig-cat="bienestar"]');
    ok(/Pasar 2 hábitos a Paz/.test(await texto(p, "[data-asig-guardar]")), "botón «Pasar 2 hábitos a Paz»");
    await captura(p, `hab-asignar-${ancho}.png`);
    const antes = await p.evaluate(() => JSON.stringify(window.__fakeStore.colMap("users/test/habitos").get("orar").registros));
    await p.click("[data-asig-guardar]");
    await p.waitForTimeout(400);
    const hs = await p.evaluate(() => { const m = window.__fakeStore.colMap("users/test/habitos"); return { orar: m.get("orar"), estirar: m.get("estirar") }; });
    ok(hs.orar.area === "bienestar" && hs.estirar.area === "bienestar" && JSON.stringify(hs.orar.registros) === antes, "solo cambia `area` (el historial queda igual)");
    await p.click(".hb-sheet .muscle-sheet-close");
    await p.waitForTimeout(300);
    // Formulario: + Nueva y vuelve con la categoría elegida
    await p.click("#hb-nuevo");
    await p.waitForTimeout(300);
    await p.fill('.hb-form [name="name"]', "Tocar guitarra");
    await p.click('[data-cat-nueva="form"]');
    await p.waitForTimeout(250);
    await p.fill('[name="catNombre"]', "Arte");
    await p.click('[data-cat-emoji="🎨"]');
    await p.click('.hb-cat-form [type="submit"]');
    await p.waitForTimeout(350);
    ok((await p.inputValue('.hb-form [name="name"]')) === "Tocar guitarra" && /Arte/.test(await texto(p, '.hb-chip-cat[aria-pressed="true"]')), "«+ Nueva» desde el formulario vuelve con el nombre y la categoría elegida");
    ok(await p.isVisible('.hb-acciones-fijas [type="submit"]'), "el botón de crear siempre está a la vista");
    await captura(p, `hab-form-${ancho}.png`);
    await p.click('.hb-acciones-fijas [type="submit"]');
    await p.waitForTimeout(400);
    const nuevo = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/habitos").values()].find(h => h.name === "Tocar guitarra"));
    ok(nuevo && nuevo.area === "arte", "el hábito queda en «Arte»");
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Hoy: filtros, agrupar y opciones a ${ancho} px`);
    const p = await abrir(browser, base, conTemporadaVista(), { hash: "#habitos", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
    consolaLimpia(p);
    await p.waitForTimeout(500);
    const chips = await p.$$eval(".hb-filtro", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
    ok(chips[0] === "Todas6" && chips.includes("💪Cuerpo2") && chips.includes("Sin categoría2"), `chips con pendientes (${chips.join(" | ")})`);
    ok((await p.$$('.hb-fila[data-cat="cuerpo"]')).length === 3, "cada fila lleva el color de su categoría");
    ok(/^Mañana Ahora ?1\/3$/.test(await texto(p, '.hb-grupo[aria-label="Mañana"] .hb-grupo-t')), "progreso del grupo «Mañana 1/3»");
    await captura(p, `hab-hoy-${ancho}.png`);
    // Filtrar
    await p.click('[data-hoy-filtro="cuerpo"]');
    await p.waitForTimeout(250);
    let visibles = await p.$$eval("#hb-lista .hb-grupo:not(.hb-notoca) .hb-nombre", els => els.map(e => e.textContent));
    ok(visibles.join(",") === "Tomar agua,Sin azúcar,Correr", `solo Cuerpo (${visibles})`);
    await p.reload();
    await p.waitForTimeout(800);
    ok(await p.$('[data-hoy-filtro="cuerpo"].is-on') !== null, "recuerda el último filtro");
    await p.click('[data-hoy-filtro=""]');
    await p.waitForTimeout(200);
    // Agrupar por categoría (las cadenas van con su primer eslabón)
    await p.click('[data-hoy-agrupar="categoria"]');
    await p.waitForTimeout(250);
    const grupos = await p.$$eval("#hb-lista .hb-grupo:not(.hb-notoca) .hb-grupo-t", els => els.map(e => e.textContent.replace(/›/g, "").replace(/\s+/g, " ").trim()));
    ok(grupos.join(" | ") === "💪 Cuerpo0/2 | 🧠 Mente0/1 | 💰 Finanzas0/1 | 🌿 Paz1/2 | Sin categoría0/1", `grupos por categoría (${grupos.join(" | ")})`);
    // Orar (sin categoría) va después de Meditar: su cadena manda el grupo.
    const paz = await p.$$eval('#hb-lista .hb-grupo[aria-label="Paz"] .hb-nombre', els => els.map(e => e.textContent));
    ok(paz.join(",") === "Meditar,Orar" && await p.$('#hb-lista .hb-grupo[aria-label="Paz"] .is-encadenado') !== null, `las cadenas van en el grupo de su primer eslabón (${paz})`);
    await captura(p, `hab-hoy-categoria-${ancho}.png`);
    // Ocultar hechos
    await p.click("[data-hoy-ocultar]");
    await p.waitForTimeout(250);
    ok(!(await p.$('#hb-lista [data-detalle="meditar"]')) && await p.$('#hb-lista [data-detalle="orar"]') !== null && /Paz›?1\/2/.test(await texto(p, '#hb-lista .hb-grupo[aria-label="Paz"] .hb-grupo-t')), "ocultar hechos: se va Meditar y el progreso sigue 1/2");
    await p.click("[data-hoy-ocultar]");
    await p.click('[data-hoy-agrupar="momento"]');
    await p.waitForTimeout(250);
    // Un toque marca
    await p.click('#hb-lista [data-marcar="gastos"]');
    await p.waitForTimeout(400);
    let hs = await p.evaluate(() => window.__fakeStore.colMap("users/test/habitos").get("gastos").registros["2026-11-05"]);
    ok(hs && hs.e === "hecho", "un toque sigue marcando");
    for (let i = 0; i < 6 && await p.$(".hb-celebra [data-continuar]"); i++) { await p.click(".hb-celebra [data-continuar]"); await p.waitForTimeout(400); }
    // Mantener presionado abre las opciones del día (clic derecho en la compu)
    if (ancho < 800) {
      const caja = await (await p.$('#hb-lista [data-marcar="leer"]')).boundingBox();
      await p.dispatchEvent('#hb-lista [data-marcar="leer"]', "pointerdown", { clientX: caja.x + 5, clientY: caja.y + 5, button: 0, pointerType: "touch" });
      await p.waitForTimeout(650);
      await p.dispatchEvent('#hb-lista [data-marcar="leer"]', "pointerup", { clientX: caja.x + 5, clientY: caja.y + 5 });
      await p.dispatchEvent('#hb-lista [data-marcar="leer"]', "click");
    } else {
      await p.click('#hb-lista [data-marcar="leer"]', { button: "right" });
    }
    await p.waitForTimeout(400);
    ok(await p.isVisible('.hb-sheet [data-estado="saltado"]'), "mantener presionado abre parcial, mínima, saltar y nota");
    hs = await p.evaluate(() => window.__fakeStore.colMap("users/test/habitos").get("leer").registros["2026-11-05"]);
    ok(!hs, "y no marca el hábito");
    await captura(p, `hab-hoy-opciones-${ancho}.png`);
    await p.click('.hb-sheet [data-estado="saltado"]');
    await p.waitForTimeout(400);
    hs = await p.evaluate(() => window.__fakeStore.colMap("users/test/habitos").get("leer").registros["2026-11-05"]);
    ok(hs && hs.e === "saltado", "saltar desde ahí");
    await p.click(".hb-sheet [data-cerrar].hb-btn");
    await p.waitForTimeout(300);
    ok(/Saltado/.test(await texto(p, '#hb-lista [data-detalle="leer"]')), "la fila dice «Saltado»");
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Estadísticas y página de categoría a ${ancho} px`);
    const p = await abrir(browser, base, conTemporadaVista(), { hash: "#hab-stats", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
    consolaLimpia(p);
    await p.waitForTimeout(700);
    const chips = await p.$$eval(".hb-filtros-stats .hb-filtro", els => els.map(e => e.textContent.trim()));
    ok(chips[0] === "Todas" && chips.length === 6, `filtro de categorías arriba (${chips.join(" | ")})`);
    const porCat = await p.$$eval(".hb-porcat-fila", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
    ok(porCat.length === 5 && /%/.test(porCat[0]), `tarjeta «Por categoría» ordenada (${porCat[0]} … ${porCat[porCat.length - 1]})`);
    ok(await p.$(".hb-card .hbg-eje-radar") !== null && (await p.$$(".hbg-eje-radar")).length === 5, "radar de equilibrio con las 5 categorías que tienen datos");
    ok(/fue tu mejor categoría en este periodo/.test(await texto(p, "#hb-stats")), "«Lo que dicen tus datos» habla de categorías");
    await captura(p, `hab-stats-${ancho}.png`);
    const pctTodas = await texto(p, ".hb-kpi-grande");
    await p.click('[data-stats-filtro="mente"]');
    await p.waitForTimeout(400);
    const pctMente = await texto(p, ".hb-kpi-grande");
    ok(pctMente !== pctTodas && !(await p.$(".hb-porcat")) && /Ver la página de Mente/.test(await texto(p, ".hb-ver-cat")), `filtrar por Mente cambia todas las tarjetas (${pctTodas} → ${pctMente})`);
    const rank = await p.$$eval(".hb-ranking .hb-nombre", els => els.map(e => e.textContent.trim()));
    ok(rank.length === 1 && /Leer/.test(rank[0]), `el ranking solo trae los de Mente (${rank})`);
    await p.click('[data-stats-filtro=""]');
    await p.waitForTimeout(300);
    // Página de una categoría desde «Por categoría»
    await p.click('.hb-porcat-fila[href="#hab-categoria/cuerpo"]');
    await p.waitForTimeout(500);
    ok(/^#hab-categoria\/cuerpo$/.test(await p.evaluate(() => location.hash)) && await p.isVisible("#panel-hab-categoria"), "abre la página de Cuerpo");
    ok((await texto(p, "#hb-categoria .page-title")) === "Cuerpo" && /2 hábitos activos|3 hábitos activos/.test(await texto(p, ".hb-cat-head-txt")), "cabecera con nombre y hábitos");
    ok(/^\d+ ?Nivel/.test(await texto(p, ".hb-cat-nivel .hb-pj-nivel")) && /Te faltan [\d.]+ XP para el nivel \d+/.test(await texto(p, ".hb-cat-nivel")), "nivel y XP que falta de la categoría");
    const kpis = await p.$$eval(".hb-cat-kpis .hb-kpi-label", els => els.map(e => e.textContent));
    ok(kpis.join(",") === "Esta semana,Últimos 30 días,Racha activa,Mejor racha", "semana y mes contra el anterior, y rachas");
    ok(await p.$("#hb-categoria .hb-heat-scroll") !== null && await p.$("#hb-categoria .hb-ranking") !== null, "mapa de calor y ranking de sus hábitos");
    const suyos = await p.$$eval("#hb-categoria .hb-ranking .hb-nombre", els => els.map(e => e.textContent.trim()).join(","));
    ok(/Tomar agua/.test(suyos) && /Correr/.test(suyos) && !/Leer/.test(suyos), `solo sus hábitos (${suyos})`);
    ok((await p.$$("#hb-categoria .hb-cat-logros li")).length === 4, "sus logros (niveles 5, 10, 15 y 20)");
    ok((await texto(p, "#panel-hab-categoria .back-link")) === "Estadísticas", "«atrás» vuelve a Estadísticas");
    await captura(p, `hab-categoria-${ancho}.png`);
    // Desde Logros › Categorías
    await p.evaluate(() => { location.hash = "hab-logros"; });
    await p.waitForTimeout(400);
    await p.click('[data-hb-tab="areas"]');
    await p.waitForTimeout(200);
    await p.click('.hb-area-a[href="#hab-categoria/mente"]');
    await p.waitForTimeout(400);
    ok((await texto(p, "#hb-categoria .page-title")) === "Mente" && (await texto(p, "#panel-hab-categoria .back-link")) === "Logros", "Logros › Categorías abre su página");
    // Una categoría vacía: crear un hábito ya con esa categoría
    await p.evaluate(() => { location.hash = "hab-categoria/carrera"; });
    await p.waitForTimeout(400);
    ok(/Todavía no tienes hábitos en Carrera/.test(await texto(p, "#hb-categoria")), "categoría vacía con estado útil");
    await p.click("#hb-categoria [data-catpag-nuevo]");
    await p.waitForTimeout(300);
    ok(/Carrera/.test(await texto(p, '.hb-form .hb-chip-cat[aria-pressed="true"]')), "«Crear un hábito» ya trae la categoría elegida");
    await p.click(".hb-sheet .muscle-sheet-close");
    await p.waitForTimeout(300);
    // Desde Hoy agrupado por categoría
    await p.evaluate(() => { location.hash = "habitos"; });
    await p.waitForTimeout(400);
    await p.click('[data-hoy-agrupar="categoria"]');
    await p.waitForTimeout(250);
    await p.click('#hb-lista .hb-grupo-link[href="#hab-categoria/dinero"]');
    await p.waitForTimeout(400);
    ok((await texto(p, "#hb-categoria .page-title")) === "Finanzas" && (await texto(p, "#panel-hab-categoria .back-link")) === "Hoy", "Hoy › grupo de categoría abre su página");
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  {
    // Pedido del dueño 2026-11-06: "¿por qué correr no se marca solo cuando voy a correr?"
    console.log("\n=== «¿Que se marque solo?»: hábitos sin vínculo con nombre claro");
    const e = conTemporadaVista();
    Object.assign(e.__SEED__, { "users/test/running": { r1: { date: HOY, distance: 5, duration: 30 }, r2: { date: "2026-11-01", distance: 7, duration: 42 } } });
    delete e.__SEED__["users/test/habitos"].correr.registros[HOY];
    delete e.__SEED__["users/test/habitos"].correr.registros["2026-11-01"];
    e.__SEED__["users/test/habitos"].correr.done = e.__SEED__["users/test/habitos"].correr.done.filter(f => f !== HOY && f !== "2026-11-01");
    const p = await abrir(browser, base, e, { hash: "#habitos", zona: ZONA, fecha: FECHA, ancho: 390, alto: 844 });
    consolaLimpia(p);
    await p.waitForTimeout(800);
    const hab = id => p.evaluate(i => window.__fakeStore.colMap("users/test/habitos").get(i), id);
    ok(/Estirar.*puede marcarse solo.*Movilidad/.test(await texto(p, ".hb-sug-vinc")), "«Estirar» (sin vínculo) ofrece marcarse solo con Movilidad");
    ok(!(await hab("correr")).registros[HOY], "antes, la carrera de hoy no marca «Correr» (no está vinculado)");
    await p.click(".hb-sug-vinc [data-vinc-no]");
    await p.waitForTimeout(500);
    ok((await hab("estirar")).vinculoNo === true, "«No, gracias» lo recuerda en el hábito");
    ok(/Correr.*puede marcarse solo.*carrera en Running/.test(await texto(p, ".hb-sug-vinc")), "después ofrece «Correr» con Running");
    await captura(p, "hab-sug-vinculo-390.png");
    await p.click(".hb-sug-vinc [data-vinc-si]");
    await p.waitForTimeout(1200);
    const h = await hab("correr");
    ok(h.vinculo === "running" && h.vinculoDesde === HOY, "«Que se marque solo» lo vincula con Running desde hoy");
    ok(h.registros[HOY] && h.registros[HOY].auto && h.registros[HOY].e === "hecho" && h.done.includes(HOY), "y la carrera de hoy lo marca enseguida");
    ok(await p.isVisible("[data-rellenar]") && /Encontré 1 día/.test(await texto(p, ".hb-sheet")), "ofrece marcar la carrera del 1 de noviembre");
    await p.click("[data-rellenar]");
    await p.waitForTimeout(600);
    ok((await hab("correr")).registros["2026-11-01"].auto, "y la marca si aceptas");
    ok(!(await p.$(".hb-sug-vinc")), "sin más sugerencias");
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Se marca solo a ${ancho} px`);
    const e = conTemporadaVista();
    Object.assign(e.__SEED__, {
      "users/test/running": { r1: { date: "2026-11-03", distance: 5.2, duration: 31 }, r2: { date: "2026-10-30", distance: 8, duration: 45 }, r3: { date: "2026-10-21", distance: 4, duration: 25 }, r4: { date: "2026-11-02", distance: 3, duration: 20 } },
      "users/test/movilidad": { m1: { v: 1, rutinaId: "liberar-el-cuerpo", nombre: "Todo el cuerpo", fecha: "2026-11-05", completada: 1, duracionSeg: 180 }, m2: { v: 1, rutinaId: "despues-de-correr", nombre: "Después de correr", fecha: "2026-11-04", completada: 1, duracionSeg: 300 } },
      "users/test/libros": { l1: { v: 1, titulo: "El libro", autor: "A", paginas: 300, estado: "leyendo", fechaRegistro: "2026-10-01", fechaInicio: "2026-10-01", paginaBase: 0, progreso: { "2026-11-04": 10, "2026-11-05": 25 }, creado: 1 } },
      "users/test/finanzas": { f1: { date: "2026-11-05", type: "gasto", category: "comida", amount: 20, desc: "Almuerzo" } }
    });
    e.__SEED__["users/test/habitos"].correr.registros["2026-11-02"] = { e: "hecho", t: 1 }; // marcado a mano
    const p = await abrir(browser, base, e, { hash: "#habitos", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
    consolaLimpia(p);
    await p.waitForTimeout(700);
    const hab = id => p.evaluate(i => window.__fakeStore.colMap("users/test/habitos").get(i), id);
    // Vincular «Correr» con Running desde el formulario
    await p.click('#hb-lista [data-detalle="correr"]');
    await p.waitForTimeout(300);
    await p.click('.hb-sheet [data-editar="correr"]');
    await p.waitForTimeout(300);
    ok(await p.isVisible('[data-campo="vinculo"][data-v="running"]'), "«Se marca solo» ofrece Running, Bici, Movilidad, Libros, Biblia y Finanzas");
    const fuentesForm = await p.$$eval('[data-campo="vinculo"]', els => els.map(x => x.textContent.trim()));
    ok(fuentesForm.join(",") === "No,Running,Bici,Movilidad,Libros,Biblia,Finanzas,Gimnasio", `opciones (${fuentesForm})`);
    await p.click('[data-campo="vinculo"][data-v="running"]');
    await p.waitForTimeout(200);
    await p.click('.hb-acciones-fijas [type="submit"]');
    await p.waitForTimeout(700);
    let h = await hab("correr");
    ok(h.vinculo === "running" && h.vinculoDesde === HOY, "se guarda el vínculo desde hoy");
    // Días con carrera que todavía no tenían registro (el 2 de nov ya estaba marcado a mano).
    const libres = ["2026-10-21", "2026-10-30", "2026-11-03"].filter(f => !e.__SEED__["users/test/habitos"].correr.registros[f]);
    const txtRellenar = await texto(p, ".hb-sheet");
    ok(await p.isVisible("[data-rellenar]") && txtRellenar.includes(`Encontré ${libres.length} ${libres.length === 1 ? "día" : "días"} desde el`) && /No dan XP/.test(txtRellenar), `ofrece rellenar ${libres.length} días del historial, sin XP (${txtRellenar.slice(0, 120)})`);
    await captura(p, `hab-rellenar-${ancho}.png`);
    await p.click("[data-rellenar]");
    await p.waitForTimeout(600);
    h = await hab("correr");
    ok(libres.every(f => h.registros[f] && h.registros[f].auto && h.registros[f].e === "hecho") && !h.registros["2026-11-02"].auto, `rellena ${libres.join(", ")} y respeta lo marcado a mano`);
    ok(h.vinculoDesde === libres[0] && libres.every(f => h.done.includes(f)), "y guarda desde cuándo (y el «done» de siempre)");
    // Una carrera nueva hoy lo marca; borrarla lo desmarca
    await p.evaluate(() => { window.__fakeStore.colMap("users/test/running").set("hoy", { date: "2026-11-05", distance: 6, duration: 35 }); window.__fakeStore.notify(); });
    await p.waitForTimeout(900);
    h = await hab("correr");
    ok(h.registros["2026-11-05"] && h.registros["2026-11-05"].auto && h.registros["2026-11-05"].t > 0, "una carrera de hoy marca «Correr» solo");
    ok(/Marcado solo: «Correr»/.test(await texto(p, ".hb-toast")), "y avisa «Marcado solo»");
    ok(/⚡ Running/.test(await texto(p, '#hb-lista [data-detalle="correr"]')), "la fila muestra que se marca solo");
    await p.evaluate(() => { window.__fakeStore.colMap("users/test/running").delete("hoy"); window.__fakeStore.colMap("users/test/running").delete("r4"); window.__fakeStore.notify(); });
    await p.waitForTimeout(900);
    h = await hab("correr");
    ok(!h.registros["2026-11-05"] && !h.done.includes("2026-11-05"), "al borrar la carrera se deshace");
    ok(h.registros["2026-11-02"] && h.registros["2026-11-02"].e === "hecho", "lo marcado a mano no se toca");
    // Movilidad (eligiendo la rutina), Libros (páginas) y Finanzas
    const crear = async (nombre, tipo, vinculo, extra) => {
      await p.click("#hb-nuevo");
      await p.waitForTimeout(300);
      await p.fill('.hb-form [name="name"]', nombre);
      if (tipo !== "sino") { await p.click(`[data-campo="tipo"][data-v="${tipo}"]`); await p.waitForTimeout(150); }
      if (extra && extra.meta) await p.fill('.hb-form [name="meta"]', String(extra.meta));
      await p.click("[data-mas-opciones]");
      await p.waitForTimeout(150);
      await p.click(`[data-campo="vinculo"][data-v="${vinculo}"]`);
      await p.waitForTimeout(150);
      if (extra && extra.rutina) await p.selectOption('[name="vinculoRutina"]', extra.rutina);
      await p.click('.hb-acciones-fijas [type="submit"]');
      await p.waitForTimeout(700);
      return p.evaluate(n => { const m = window.__fakeStore.colMap("users/test/habitos"); for (const [id, d] of m) if (d.name === n) return Object.assign({ id }, d); return null; }, nombre);
    };
    let mov = await crear("Estirar después de correr", "sino", "movilidad", { rutina: "despues-de-correr" });
    ok(mov && mov.vinculoCfg.rutina === "despues-de-correr" && !mov.registros[HOY], "Movilidad con su rutina: otra rutina hoy no lo marca");
    if (await p.$("[data-rellenar]")) { await p.click("[data-rellenar]"); await p.waitForTimeout(500); }
    mov = await hab(mov.id);
    ok(mov.registros["2026-11-04"] && mov.registros["2026-11-04"].auto, "rellena el día que hiciste esa rutina");
    let leer = await crear("Leer páginas", "medible", "libros", { meta: 20 });
    await p.waitForTimeout(300);
    if (await p.$(".hb-sheet [data-cerrar].hb-btn-sec")) { await p.click(".hb-sheet .hb-acciones [data-cerrar]"); await p.waitForTimeout(300); }
    leer = await hab(leer.id);
    ok(leer.vinculoCfg.medida === "paginas" && leer.registros[HOY] && leer.registros[HOY].v === 15, `Libros suma las páginas de hoy (${leer.registros[HOY] && leer.registros[HOY].v})`);
    const gastos = await crear("Anotar todo", "sino", "finanzas");
    ok(gastos.registros[HOY] && gastos.registros[HOY].e === "hecho" && gastos.registros[HOY].auto.f === "finanzas", "Finanzas: un movimiento de hoy lo marca");
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Plantillas, hora y aviso de pendientes a ${ancho} px`);
    const p = await abrir(browser, base, conTemporadaVista(), { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
    consolaLimpia(p);
    await p.waitForTimeout(700);
    ok(/⏰ faltan 2 de la mañana/.test(await texto(p, "#hb-inicio")), `Inicio avisa lo pendiente del momento (${await texto(p, "#hb-inicio")})`);
    await p.evaluate(() => { location.hash = "habitos"; });
    await p.waitForTimeout(400);
    ok(/Te faltan 2 de la mañana/.test(await texto(p, ".hb-aviso-momento")), "Hoy: «Te faltan 2 de la mañana»");
    // Plantillas
    await p.click("#hb-nuevo");
    await p.waitForTimeout(300);
    await p.click("[data-plant-abrir]");
    await p.waitForTimeout(300);
    ok((await p.$$(".hb-plant")).length >= 30, `hoja de plantillas (${(await p.$$(".hb-plant")).length})`);
    await p.fill("[data-plant-buscar]", "agua");
    await p.waitForTimeout(200);
    const encontradas = await p.$$eval(".hb-plant .hb-nombre", els => els.map(e => e.textContent));
    ok(encontradas.join(",") === "Tomar agua", `buscar «agua» (${encontradas})`);
    await captura(p, `hab-plantillas-${ancho}.png`);
    await p.click('[data-plantilla="agua"]');
    await p.waitForTimeout(300);
    ok((await p.inputValue('.hb-form [name="name"]')) === "Tomar agua" && (await p.inputValue('.hb-form [name="meta"]')) === "8" && /Cuerpo/.test(await texto(p, '.hb-chip-cat[aria-pressed="true"]')), "el formulario se llena (8 vasos, Cuerpo) y se puede editar");
    await p.fill('.hb-form [name="meta"]', "10");
    await p.click('.hb-acciones-fijas [type="submit"]');
    await p.waitForTimeout(500);
    const nueva = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/habitos").values()].filter(h => h.name === "Tomar agua").sort((a, b) => b.createdAt - a.createdAt)[0]);
    ok(nueva.meta === 10 && nueva.unidad === "vasos" && nueva.area === "cuerpo" && nueva.tipo === "medible", "crea el hábito con lo editado");
    // Sugerir categoría al escribir
    await p.click("#hb-nuevo");
    await p.waitForTimeout(300);
    await p.fill('.hb-form [name="name"]', "Estudiar inglés");
    await p.waitForTimeout(150);
    ok(/Sugerida: 🧠 Mente/.test(await texto(p, "[data-cat-sugerencia]")), "sugiere «Mente» por el nombre");
    await p.click('[data-cat-sugerencia] [data-campo="area"]');
    await p.waitForTimeout(200);
    ok(/Mente/.test(await texto(p, '.hb-chip-cat[aria-pressed="true"]')) && (await texto(p, "[data-cat-sugerencia]")) === "" && (await p.inputValue('.hb-form [name="name"]')) === "Estudiar inglés", "un toque la elige");
    await p.click(".hb-sheet .muscle-sheet-close");
    await p.waitForTimeout(300);
    // Hora opcional: ordena dentro del momento
    await p.click('#hb-lista [data-detalle="orar"]');
    await p.waitForTimeout(300);
    await p.click('.hb-sheet [data-editar="orar"]');
    await p.waitForTimeout(300);
    await p.fill('.hb-form [name="hora"]', "06:15");
    await p.dispatchEvent('.hb-form [name="hora"]', "change");
    await p.waitForTimeout(200);
    ok(/Mañana/.test(await texto(p, '[data-campo="timeOfDay"][aria-pressed="true"]')), "elegir 06:15 pone «Mañana»");
    await p.click('.hb-acciones-fijas [type="submit"]');
    await p.waitForTimeout(500);
    const orar = await p.evaluate(() => window.__fakeStore.colMap("users/test/habitos").get("orar"));
    ok(orar.hora === "06:15", "guarda la hora");
    ok(/06:15/.test(await texto(p, '#hb-lista [data-detalle="orar"]')), "la fila muestra la hora");
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  for (const ancho of [390, 1280]) {
    console.log(`\n=== Racha que perdona a ${ancho} px`);
    const e = conTemporadaVista();
    // 20 días seguidos y ayer se le pasó: la racha sigue.
    const regs = {};
    for (let i = 1; i <= 21; i++) { const f = new Date(Date.UTC(2026, 9, 14 + i)).toISOString().slice(0, 10); if (f !== "2026-11-04" && f < HOY) regs[f] = { e: "hecho", t: 1 }; }
    e.__SEED__["users/test/habitos"].diario = { v: 2, name: "Vitaminas", emoji: "💊", tipo: "sino", freqType: "diario", days: [true, true, true, true, true, true, true], done: Object.keys(regs), registros: regs, createdAt: Date.UTC(2026, 9, 15), inicio: "2026-10-15", orden: 0, timeOfDay: "manana", area: "cuerpo" };
    e.__SEED__["users/test/meta"].habitos_juego.snapshot = { nivel: 1, rangos: {}, logros: [], misiones: [], perfectos: [], jefes: [] };
    const p = await abrir(browser, base, e, { hash: "#habitos", zona: ZONA, fecha: FECHA, ancho, alto: ancho > 800 ? 900 : 844 });
    consolaLimpia(p);
    await p.waitForTimeout(800);
    ok(!(await p.$(".hb-celebra")), "las rachas más largas no disparan celebraciones al actualizar");
    const j = await juego(p);
    ok(j.recalculo === 1 && j.snapshot.logros.includes("racha_7"), "el recálculo se guarda en silencio (logros incluidos)");
    const fila = await texto(p, '#hb-lista [data-detalle="diario"]');
    ok(/20 días · 🛡 salvada ayer/.test(fila), `Hoy: la racha sigue y dice «salvada ayer» (${fila})`);
    await p.click('#hb-lista [data-detalle="diario"]');
    await p.waitForTimeout(400);
    ok(/Racha que perdona\. Tienes 1 perdón\. Cumple 7 días más para ganar otro\./.test(await texto(p, ".hb-perdones")), `detalle: perdones (${await texto(p, ".hb-perdones")})`);
    ok(await p.$('.hb-cal-dia.c-perdon[data-dia-cal="2026-11-04"]') !== null, "el calendario marca el día perdonado");
    await captura(p, `hab-perdon-${ancho}.png`);
    ok(p.errores.length === 0 && p.consola.length === 0, `sin errores (${p.errores.concat(p.consola).join(" | ")})`);
    await p.context().close();
  }

  console.log("\n=== Copia de seguridad con categorías");
  {
    const e = conTemporadaVista();
    e.__SEED__["users/test/meta"].habitos_juego.categorias = { musica: { nombre: "Música", emoji: "🎸", color: "azul", orden: 7, creada: 1 } };
    e.__SEED__["users/test/habitos"].estirar.area = "musica";
    const p = await abrir(browser, base, e, { hash: "#habitos", zona: ZONA, fecha: FECHA });
    consolaLimpia(p);
    await p.waitForTimeout(500);
    await p.click("#hb-lista [data-ajustes]");
    await p.waitForTimeout(250);
    const [descarga] = await Promise.all([p.waitForEvent("download"), p.click("[data-exportar]")]);
    const copia = JSON.parse(require("node:fs").readFileSync(await descarga.path(), "utf8"));
    ok(copia.juego.categorias.musica.emoji === "🎸" && copia.habitos.find(h => h.id === "estirar").area === "musica", "exportar lleva las categorías y la de cada hábito");
    await p.context().close();
    // Importar en una cuenta vacía: aparecen la categoría y sus hábitos.
    const q = await abrir(browser, base, { __SEED__: { "users/test/meta": { habitos_juego: { calibracion: 2 } } } }, { hash: "#habitos", zona: ZONA, fecha: FECHA });
    consolaLimpia(q);
    await q.waitForTimeout(500);
    await q.click("#hb-lista [data-nuevo]").catch(() => {});
    await q.waitForTimeout(250);
    await q.click(".hb-sheet .muscle-sheet-close").catch(() => {});
    await q.waitForTimeout(250);
    await q.evaluate(() => window.HabitosApp.hojaAjustes());
    await q.waitForTimeout(250);
    await q.setInputFiles("[data-archivo-importar]", { name: "copia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(copia)) });
    await q.waitForTimeout(500);
    ok(/categorías/.test(await texto(q, ".hb-sheet")), "la vista previa cuenta las categorías");
    await q.click("[data-confirmar-importar]");
    await q.waitForTimeout(800);
    const j = await juego(q);
    ok(j.categorias && j.categorias.musica && j.categorias.musica.nombre === "Música", "importar agrega la categoría que faltaba");
    const est = await q.evaluate(() => window.__fakeStore.colMap("users/test/habitos").get("estirar"));
    ok(est && est.area === "musica", "y el hábito vuelve con su categoría");
    await q.click('[data-hoy-agrupar="categoria"]').catch(() => {});
    await q.waitForTimeout(300);
    ok(/🎸 Música/.test(await texto(q, "#hb-lista")), "Hoy la muestra");
    ok(q.errores.length === 0 && q.consola.length === 0, `sin errores (${q.errores.concat(q.consola).join(" | ")})`);
    await q.context().close();
  }

  console.log("\n=== Sin historia: no hay hoja de temporada");
  const q = await abrir(browser, base, {}, { hash: "#habitos", zona: ZONA, fecha: FECHA });
  await q.waitForTimeout(500);
  ok(!(await q.isVisible(".hb-temp-nivel")), "un usuario nuevo no ve la Temporada 2");
  await q.context().close();

  await terminar(browser, srv);
})();
