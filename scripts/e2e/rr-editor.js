// Running: crear y editar rutinas guiadas en la app, sin CSV (D-124), a 375 px.
// Uso: node scripts/e2e/rr-editor.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const c = (tipo, seg, texto) => ({ tipo, seg, texto: texto || "" });
const VIEJAS = [c("caminar", 300, "Calentar"), c("correr", 60), c("caminar", 90), c("correr", 60), c("caminar", 90), c("caminar", 300, "Enfriar")];
const SEED = {
  "users/test/rutinas_running": {
    d1: { v: 1, nombre: "5K", plan: "plan_x", dia: 1, intervalos: [c("caminar", 60), c("correr", 60)], totalSeg: 120, creado: 1, orden: 1 },
    d2: { v: 1, nombre: "5K", plan: "plan_x", dia: 2, intervalos: [c("caminar", 60), c("correr", 120)], totalSeg: 180, creado: 1, orden: 2 },
    vieja: { v: 1, nombre: "Series viejas", intervalos: VIEJAS, totalSeg: 930, creado: 2, orden: 3 }
  }
};

const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const rutinas = p => p.evaluate(() => [...window.__fakeStore.colMap("users/test/rutinas_running").entries()].map(([id, d]) => Object.assign({ id }, d)));
const lista = p => p.$$eval("#running-rutinas .rg-item", els => els.map(li => li.querySelector(".rg-abrir strong").textContent.trim()));
const abierta = (p, sel) => p.$eval(sel, el => !el.hidden && !el.classList.contains("is-closing")).catch(() => false);
const ED = ".rre-raiz";
async function menu(p, nombre, accion) {
  const i = (await lista(p)).indexOf(nombre);
  await p.click(`#running-rutinas .rg-item:nth-child(${i + 1}) [data-rg="menu"]`);
  await p.waitForTimeout(350);
  await p.click(`.rre-menu [data-rre-accion="${accion}"]`);
  await p.waitForTimeout(600);
}
async function fijarDur(p, pos, min, seg) {
  await p.fill(`${ED} [data-pos="${pos}"] [data-campo="min"]`, String(min));
  await p.fill(`${ED} [data-pos="${pos}"] [data-campo="seg"]`, String(seg));
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#run-rutinas", ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(600);

  console.log("\nLa lista: «＋ Nueva» y ⋯ en cada rutina");
  ok(await p.isVisible('#running-rutinas [data-rg="nueva"]'), "botón «＋ Nueva» arriba de las rutinas");
  ok((await p.$$('#running-rutinas [data-rg="menu"]')).length === 3 && !(await p.$("#running-rutinas .act-rutina-borrar")), "cada rutina tiene su menú ⋯ (ya no el tacho suelto)");
  ok(await p.isVisible('#running-rutinas [data-rg="importar"]'), "importar un CSV sigue estando");
  await captura(p, "rre-lista-375.png");

  console.log("\nCrear una rutina");
  await p.click('#running-rutinas [data-rg="nueva"]');
  await p.waitForTimeout(450);
  ok(await abierta(p, ED) && (await texto(p, "#rre-hoja-t")) === "Nueva rutina", "se abre «Nueva rutina»");
  ok((await p.$$(`${ED} .rre-pasos > li`)).length === 3 && (await p.$$(`${ED} .rre-serie`)).length === 1, "empieza con calentamiento, una serie y enfriamiento");
  ok((await texto(p, `${ED} .rre-total`)) === "10 intervalos · 20 min", "abajo dice «10 intervalos · 20 min»");
  await captura(p, "rre-nueva-375.png");
  await p.click(`${ED} [type="submit"]`);
  await p.waitForTimeout(300);
  ok(/Ponle un nombre/.test(await texto(p, `${ED} .rre-error`)) && (await p.getAttribute(`${ED} [data-rre-nombre]`, "aria-invalid")) === "true", "sin nombre no guarda y lo dice");
  await p.fill(`${ED} [data-rre-nombre]`, "Series cortas");
  await p.click(`${ED} [data-pos="1"] [data-rre="mas"]`);
  await p.waitForTimeout(150);
  ok((await p.inputValue(`${ED} [data-pos="1"] [data-campo="repetir"]`)) === "5" && (await texto(p, `${ED} .rre-total`)) === "12 intervalos · 22 min 30 s", "＋ en la serie: 5 veces (12 intervalos · 22 min 30 s)");
  await fijarDur(p, "1.0", 2, 0);
  await p.selectOption(`${ED} [data-pos="1.0"] [data-campo="tipo"]`, "trotar");
  await p.waitForTimeout(150);
  ok((await texto(p, `${ED} .rre-total`)) === "12 intervalos · 27 min 30 s", "trotar 2:00 en la serie: 27 min 30 s");
  ok(await p.$eval(`${ED} [data-pos="1.0"] [data-campo="tipo"]`, s => s.classList.contains("is-trotar")), "el tipo toma su color");
  await p.click(`${ED} [data-rre="intervalo"]`);
  await p.waitForTimeout(300);
  ok((await p.$$(`${ED} .rre-pasos > li`)).length === 4 && (await p.inputValue(`${ED} [data-pos="3"] [data-campo="tipo"]`)) === "correr", "«＋ Intervalo» agrega uno al final (después de caminar: correr)");
  await p.click(`${ED} [data-pos="3"] [data-rre="subir"]`);
  await p.waitForTimeout(200);
  ok((await p.inputValue(`${ED} [data-pos="2"] [data-campo="tipo"]`)) === "correr" && (await p.inputValue(`${ED} [data-pos="3"] [data-campo="texto"]`)) === "Enfriamiento", "↑ lo sube antes del enfriamiento");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.rre === "subir"), "el foco sigue en el botón que tocaste");
  await p.click(`${ED} [data-pos="2"] [data-rre="quitar"]`);
  await p.waitForTimeout(200);
  ok((await p.$$(`${ED} .rre-pasos > li`)).length === 3, "✕ lo quita");
  await fijarDur(p, "0", 0, 3);
  await p.click(`${ED} [type="submit"]`);
  await p.waitForTimeout(300);
  ok(/El paso 1 dura muy poco/.test(await texto(p, `${ED} .rre-error`)) && await p.$eval(`${ED} [data-pos="0"]`, li => li.classList.contains("is-mal")), "3 segundos no vale: lo dice y marca el paso");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.campo === "min"), "y deja el cursor en esa duración");
  await fijarDur(p, "0", 5, 0);
  // Sin desbordes a 375 px; todo de 44 px o más; letra de 16 px.
  const ancho = await p.$eval(`${ED} .budget-sheet-panel`, el => el.scrollWidth <= el.clientWidth + 1);
  ok(ancho, "la hoja no se sale de lado a 375 px");
  const chicos = await p.$$eval(`${ED} button, ${ED} input, ${ED} select`, els => els.filter(e => e.offsetParent && !e.classList.contains("budget-sheet-close")).map(e => ({ t: (e.getAttribute("aria-label") || e.textContent || e.dataset.campo || "").trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })).filter(x => x.h < 44));
  ok(!chicos.length, `botones y casillas de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos.slice(0, 4))}` : ""}`);
  const letra = await p.$$eval(`${ED} input, ${ED} select`, els => els.filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).length);
  ok(letra === 0, "casillas con letra de 16 px (el iPhone no hace zoom)");
  await captura(p, "rre-editando-375.png");
  await p.click(`${ED} [type="submit"]`);
  await p.waitForTimeout(700);
  let rs = await rutinas(p);
  const nueva = rs.find(r => r.nombre === "Series cortas");
  ok(!(await abierta(p, ED)) && !!nueva, "«Guardar rutina» cierra y la guarda");
  ok(nueva && nueva.intervalos.length === 12 && nueva.totalSeg === 1650 && nueva.bloques.length === 3 && nueva.bloques[1].repetir === 5, "con sus 12 intervalos (27 min 30 s) y sus pasos (serie × 5)");
  ok(nueva && nueva.intervalos[1].tipo === "trotar" && nueva.intervalos[1].seg === 120 && nueva.orden > 3 && nueva.creado > 0, "trotar 2:00 primero en la serie, al final de la cola");
  ok(/Series cortas.*quedó al final de tu lista/.test(await texto(p, ".rre-toast")), "aviso «quedó al final de tu lista»");
  ok((await lista(p)).join() === "Día 1,Día 2,Series viejas,Series cortas", "aparece al final de la lista");

  console.log("\nEditar");
  await menu(p, "Series cortas", "editar");
  ok(await abierta(p, ED) && (await texto(p, "#rre-hoja-t")) === "Editar rutina" && (await p.inputValue(`${ED} [data-pos="1"] [data-campo="repetir"]`)) === "5" && (await p.inputValue(`${ED} [data-pos="1.0"] [data-campo="tipo"]`)) === "trotar", "abre con los mismos pasos (serie × 5, trotar)");
  await p.fill(`${ED} [data-pos="1"] [data-campo="repetir"]`, "3");
  await p.waitForTimeout(150);
  ok((await texto(p, `${ED} .rre-total`)) === "8 intervalos · 20 min 30 s", "escribir 3 veces: 8 intervalos · 20 min 30 s");
  await p.click(`${ED} [type="submit"]`);
  await p.waitForTimeout(700);
  rs = await rutinas(p);
  const editada = rs.find(r => r.id === nueva.id);
  ok(editada.intervalos.length === 8 && editada.totalSeg === 1230 && editada.editado > 0 && editada.creado === nueva.creado && editada.orden === nueva.orden, "«Guardar cambios» la actualiza (sin moverla de la lista)");

  console.log("\nUna rutina importada (sin pasos) se agrupa sola");
  await menu(p, "Series viejas", "editar");
  ok((await p.$$(`${ED} .rre-pasos > li`)).length === 3 && (await p.inputValue(`${ED} [data-pos="1"] [data-campo="repetir"]`)) === "2" && (await p.inputValue(`${ED} [data-pos="0"] [data-campo="texto"]`)) === "Calentar", "6 intervalos → calentar, serie × 2 y enfriar");
  await p.click(`${ED} [data-rre="cancelar"]`);
  await p.waitForTimeout(400);
  ok(!(await abierta(p, ED)) && !("bloques" in (await rutinas(p)).find(r => r.id === "vieja")), "«Cancelar» no cambia nada");

  console.log("\nDuplicar, hacer la siguiente y eliminar");
  await menu(p, "Series cortas", "duplicar");
  rs = await rutinas(p);
  const copia = rs.find(r => r.nombre === "Series cortas (copia)");
  ok(copia && copia.intervalos.length === 8 && copia.bloques[1].repetir === 3, "«Duplicar» crea «Series cortas (copia)» igual a la original");
  ok((await lista(p)).join() === "Día 1,Día 2,Series viejas,Series cortas,Series cortas (copia)", "la copia queda justo debajo");
  await menu(p, "Día 2", "duplicar");
  rs = await rutinas(p);
  const d3 = rs.find(r => r.plan === "plan_x" && r.dia === 3);
  ok(d3 && d3.nombre === "5K" && d3.intervalos.length === 2 && (await lista(p)).join() === "Día 1,Día 2,Día 3,Series viejas,Series cortas,Series cortas (copia)", "en un plan: «Duplicar» agrega el Día 3 después del Día 2");
  await menu(p, "Series cortas (copia)", "primera");
  ok((await lista(p))[0] === "Series cortas (copia)" && (await texto(p, "#running-rutinas .rg-item:first-child")).includes("Siguiente"), "«Hacer la siguiente» la sube arriba (Siguiente)");
  await p.evaluate(() => { window.confirm = () => true; });
  await menu(p, "Series viejas", "eliminar");
  ok(!(await rutinas(p)).some(r => r.id === "vieja") && !(await lista(p)).includes("Series viejas"), "«Eliminar» la borra (con la confirmación de siempre)");

  console.log("\nEl nombre de un plan cambia en todos sus días");
  await menu(p, "Día 1", "editar");
  ok((await texto(p, "#rre-hoja-t")) === "Editar 5K · Día 1" && /cambia en todos sus días/.test(await texto(p, `${ED} .lib-campo`)), "dice que el nombre es del plan");
  await p.fill(`${ED} [data-rre-nombre]`, "Plan 5K");
  await p.click(`${ED} [type="submit"]`);
  await p.waitForTimeout(700);
  rs = await rutinas(p);
  ok(rs.filter(r => r.plan === "plan_x").every(r => r.nombre === "Plan 5K") && rs.filter(r => r.plan === "plan_x").length === 3, "los 3 días quedan «Plan 5K»");

  console.log("\nLa rutina hecha en la app se usa como siempre");
  const i = (await lista(p)).indexOf("Series cortas");
  await p.click(`#running-rutinas .rg-item:nth-child(${i + 1}) .rg-abrir`);
  await p.waitForTimeout(400);
  ok((await p.$$("[data-rg-plan] li")).length === 8 && (await texto(p, "#running-act .act-dep")) === "Series cortas", "al abrirla muestra sus 8 intervalos, listos para «Iniciar»");
  const tipo0 = (await p.textContent("[data-rg-tipo]")).trim(), resta0 = (await p.textContent("[data-rg-resta]")).trim();
  ok(tipo0 === "Caminar" && resta0 === "5:00", `empieza con Caminar 5:00 (${tipo0} ${resta0})`);
  await p.click('[data-rg="cancelar"]');
  await p.waitForTimeout(300);
  ok(!consola.length && !p.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await p.context().close();

  console.log("\nTeléfono angosto (320 px) y lista vacía");
  const q = await abrir(browser, base, {}, { hash: "#run-rutinas", ancho: 320, alto: 568 });
  await q.waitForTimeout(600);
  ok(/Todavía no tienes rutinas guiadas/.test(await texto(q, "#running-rutinas")) && await q.isVisible('#running-rutinas [data-rg="nueva"]'), "sin rutinas: explica cómo crear una (o importarla)");
  await q.click('#running-rutinas [data-rg="nueva"]');
  await q.waitForTimeout(450);
  const ancho320 = await q.$eval(`${ED} .budget-sheet-panel`, el => el.scrollWidth <= el.clientWidth + 1);
  ok(ancho320, "el editor no se sale de lado a 320 px");
  await captura(q, "rre-nueva-320.png");
  await q.fill(`${ED} [data-rre-nombre]`, "Primera");
  await q.click(`${ED} [type="submit"]`);
  await q.waitForTimeout(700);
  ok((await rutinas(q)).length === 1 && (await lista(q)).join() === "Primera", "la primera rutina se crea con un nombre y «Guardar»");
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();
  await terminar(browser, srv);
})();
