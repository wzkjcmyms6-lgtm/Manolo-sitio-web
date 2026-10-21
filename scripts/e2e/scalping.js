// Pruebas de pantalla del hábito Scalping (js/habito-scalping.js).
// Uso: node scripts/e2e/scalping.js [carpeta-para-capturas]
// Fecha y huso horario fijos (La Paz, UTC−4) con el reloj de Playwright.
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const S = require("../../js/scalping-habit.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const enLaPaz = (fecha, hora = "10:00") => `${fecha}T${hora}:00-04:00`;
const LEER = { v: 2, name: "Leer", emoji: "📖", tipo: "sino", freqType: "diario", days: [true, true, true, true, true, true, true], done: [], registros: {}, createdAt: Date.UTC(2026, 9, 1), inicio: "2026-10-01", orden: 1 };
// Documento de Scalping como lo crea la app, con inicio el 2026-10-21.
const SC = (extra) => Object.assign({
  v: 2, especial: "scalping", name: "Scalping", emoji: "💆", tipo: "medible", meta: 2, unidad: "sesiones", freqType: "diario",
  days: [true, true, true, true, true, true, true], timeOfDay: "cualquiera", dificultad: "media", area: "cuerpo",
  done: [], registros: {}, createdAt: Date.UTC(2026, 9, 21, 14), inicio: "2026-10-21", orden: 2,
  scalping: { version: 1, habitId: "scalping", settings: { startDate: "2026-10-21", zonaPrioritaria: null, usarAceite: false, nocheExtendida: false }, logs: {}, fotos: {} }
}, extra);

const texto = (p, sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
const doc = p => p.evaluate(() => window.__fakeStore.colMap("users/test/habitos").get("scalping"));
// Cierra las celebraciones de Hábitos (logros, nivel) que tapan la pantalla.
async function sinFestejos(p) {
  for (let i = 0; i < 6 && await p.$(".hb-celebra [data-continuar]"); i++) {
    await p.click(".hb-celebra [data-continuar]");
    await p.waitForTimeout(450);
  }
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  console.log("\nAgregar el hábito (21 oct 2026, 10:00 en La Paz)");
  let p = await abrir(browser, base, { __SEED__: { "users/test/habitos": { h1: LEER } } }, { zona: ZONA, fecha: enLaPaz("2026-10-21"), hash: "#habitos", ancho: 375 });
  ok(await p.isVisible(".sc-sugerencia"), "Hábitos sugiere agregar Scalping");
  await captura(p, "sc-sugerencia.png");
  await p.click("[data-sc-crear]");
  await p.waitForTimeout(500);
  let d = await doc(p);
  ok(d && d.especial === "scalping" && d.tipo === "medible" && d.meta === 2 && d.scalping.settings.startDate === "2026-10-21" && d.inicio === "2026-10-21",
    "se crea como hábito (2 sesiones) con inicio el día de hoy");
  ok(await p.isHidden(".sc-sugerencia"), "la sugerencia desaparece");
  ok((await texto(p, ".sc-fila .hb-sub")) === "Día 1/180 · Adaptación · Noche: Costados y nuca", "tarjeta: Día 1/180 · Adaptación · Noche: Costados y nuca");
  ok((await texto(p, '[data-sc-sesion="manana"]')) === "Mañana · 5 min" && (await texto(p, '[data-sc-sesion="noche"]')) === "Noche · 10 min", "botones Mañana · 5 min y Noche · 10 min");
  ok((await texto(p, ".sc-fila-prog")) === "0 h", "horas acumuladas: 0 h");
  await captura(p, "sc-tarjeta.png");

  console.log("\nBotones rápidos");
  await p.click('[data-sc-sesion="manana"]');
  await p.waitForTimeout(400);
  await sinFestejos(p);
  d = await doc(p);
  ok(d.scalping.logs["2026-10-21"].manana.hecho === true && d.scalping.logs["2026-10-21"].manana.minutos === 5 && d.registros["2026-10-21"].v === 1, "Mañana: se marca con los minutos del plan (día parcial para Hábitos)");
  ok(await p.getAttribute('[data-sc-sesion="manana"]', "aria-pressed") === "true", "el botón queda marcado");
  await p.click('[data-sc-sesion="manana"]');
  await p.waitForTimeout(400);
  await sinFestejos(p);
  d = await doc(p);
  ok(d.scalping.logs["2026-10-21"].manana.hecho === false && !("2026-10-21" in d.registros), "tocar otra vez lo desmarca");

  console.log("\nVista Scalping › Hoy");
  await p.click('.sc-fila [data-detalle="scalping"]');
  await p.waitForTimeout(500);
  ok(await p.isVisible("#panel-hab-scalping") && (await p.evaluate(() => location.hash)) === "#hab-scalping", "tocar la tarjeta abre la vista");
  ok((await p.$$("#sc-app .sc-tabs .fin-tab")).length === 5, "cinco pestañas: Hoy · Progreso · Semana · Guía · Ajustes");
  ok((await texto(p, ".sc-encabezado .sc-dia")) === "Día 1 de 180" && (await texto(p, ".sc-fase")) === "Adaptación" && (await texto(p, ".sc-fecha")) === "Miércoles · 21 oct 2026", "encabezado: Día 1 de 180, Adaptación, Miércoles · 21 oct 2026");
  ok((await texto(p, ".sc-recordatorio")).startsWith("Sesión de mañana pendiente: 5 min"), "aviso: sesión de mañana pendiente (son las 10:00)");
  ok(await p.isVisible(".sc-fotos") && (await texto(p, ".sc-fotos")).includes("Fecha ideal: 21 oct 2026"), "banner de fotos del día 1 con la fecha ideal");
  const sesiones = await p.$$eval(".sc-sesion", els => els.map(e => ({ min: e.querySelector(".sc-min").textContent, zona: e.querySelector(".sc-zona").textContent, pasos: e.querySelectorAll(".sc-pasos li").length, primera: e.querySelector(".sc-paso-cab span").textContent })));
  ok(sesiones.length === 2 && sesiones[0].min === "5 min" && sesiones[0].pasos === 3 && sesiones[1].min === "10 min" && sesiones[1].pasos === 4, "Mañana 5 min (3 pasos) y Noche 10 min (4 pasos)");
  ok(sesiones[1].zona.includes("Costados y nuca") && sesiones[1].primera.includes("Toda la cabeza"), "la noche va en Costados y nuca; el calentamiento, en toda la cabeza");
  ok((await texto(p, ".sc-esperar")).includes("Mes 1 · Adaptación"), "tarjeta «Qué esperar»");
  await captura(p, "sc-hoy.png");
  await p.click('[data-sc-fotos="1"]');
  await p.waitForTimeout(400);
  ok((await doc(p)).scalping.fotos["1"] === "2026-10-21" && await p.isHidden(".sc-fotos"), "«Fotos tomadas» marca el control y quita el banner");
  await p.fill('[data-sc-min="manana"]', "7");
  await p.click('[data-sc-marcar="manana"]');
  await p.waitForTimeout(400);
  d = await doc(p);
  ok(d.scalping.logs["2026-10-21"].manana.minutos === 7, "«Marcar hecha» con minutos editados (7)");
  ok((await texto(p, ".sc-sesion.is-hecha .sc-hecha-t")) === "Hecha · 7 min", "la sesión se ve completada, con opción de desmarcar");
  await p.fill("[data-sc-nota]", "Sin molestias");
  await p.waitForTimeout(1000);
  ok((await doc(p)).scalping.logs["2026-10-21"].nota === "Sin molestias", "la nota del día se guarda sola");

  console.log("\nAjustes");
  await p.click('[data-sc-tab="ajustes"]');
  await p.waitForTimeout(200);
  await p.selectOption("[data-sc-zona]", "coronilla");
  await p.waitForTimeout(200);
  await p.check('[data-sc-ajuste="usarAceite"]');
  await p.waitForTimeout(200);
  await p.check('[data-sc-ajuste="nocheExtendida"]');
  await p.waitForTimeout(300);
  d = await doc(p);
  ok(d.scalping.settings.zonaPrioritaria === "coronilla" && d.scalping.settings.usarAceite === true && d.scalping.settings.nocheExtendida === true, "zona del domingo, aceite y noche extendida se guardan");
  await p.fill("[data-sc-inicio]", "2026-09-20");
  await p.dispatchEvent("[data-sc-inicio]", "change");
  await p.waitForTimeout(300);
  ok((await doc(p)).scalping.settings.startDate === "2026-09-20" && (await doc(p)).inicio === "2026-09-20", "cambiar la fecha de inicio la guarda (y el hábito empieza ese día)");
  await p.click('[data-sc-tab="hoy"]');
  await p.waitForTimeout(200);
  ok((await texto(p, ".sc-dia")) === "Día 32 de 180" && (await texto(p, ".sc-fase")) === "Constancia", "con otro inicio, hoy es el día 32 (Constancia)");
  await p.click('[data-sc-tab="ajustes"]');
  await p.fill("[data-sc-inicio]", "2026-10-21");
  await p.dispatchEvent("[data-sc-inicio]", "change");
  await p.waitForTimeout(300);
  await p.click('[data-sc-tab="hoy"]');
  await p.waitForTimeout(200);
  ok((await texto(p, ".sc-dia")) === "Día 1 de 180", "al volver la fecha, vuelve al día 1");
  ok((await texto(p, ".sc-aceite")).startsWith("Aplica el aceite de romero") && await p.isVisible("[data-sc-aceite]"), "con aceite: la noche muestra la nota y «Usé aceite hoy»");
  ok((await p.$$eval(".sc-sesion .sc-min", els => els.map(e => e.textContent)))[1] === "10 min", "la noche extendida no cambia nada en la fase 1 (10 min)");
  await p.check("[data-sc-aceite]");
  await p.waitForTimeout(300);
  ok((await doc(p)).scalping.logs["2026-10-21"].aceite === true, "«Usé aceite hoy» se guarda");

  console.log("\nPersistencia y lista de Hoy");
  await p.evaluate(() => { location.hash = "habitos"; });
  await p.waitForTimeout(300);
  // Desde «Cerrar el día»: Scalping aparece pendiente con sus dos botones.
  await p.click("[data-cerrar-dia]");
  await p.waitForTimeout(400);
  ok(await p.isVisible('.hb-sheet .sc-fila [data-sc-sesion="noche"]'), "«Cerrar el día» muestra Scalping pendiente con sus botones");
  await p.click('.hb-sheet [data-sc-sesion="noche"]');
  await p.waitForTimeout(400);
  await sinFestejos(p);
  if (await p.isVisible(".hb-sheet")) { await p.click(".hb-sheet .hb-acciones [data-cerrar]"); await p.waitForTimeout(300); }
  d = await doc(p);
  ok(d.registros["2026-10-21"].v === 2 && await p.$eval(".sc-fila", el => el.classList.contains("is-hecho")), "con mañana y noche el día queda cumplido");
  await p.reload();
  await p.waitForTimeout(1200);
  await sinFestejos(p);
  ok(await p.getAttribute('[data-sc-sesion="manana"]', "aria-pressed") === "true" && await p.getAttribute('[data-sc-sesion="noche"]', "aria-pressed") === "true", "al recargar, las dos sesiones siguen marcadas");
  ok((await texto(p, ".sc-fila-prog")) === "0,3 h", "horas acumuladas: 0,3 h (7 + 10 min)");
  ok(await p.isVisible('.hb-check[data-marcar="h1"]'), "los otros hábitos siguen igual");
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  ok((await texto(p, "#hb-inicio")).startsWith("Hoy: 1 de 2"), "Inicio cuenta Scalping entre los hábitos de hoy");

  console.log("\nProgreso, Semana y Guía");
  await p.evaluate(() => { location.hash = "hab-scalping"; });
  await p.waitForTimeout(300);
  await p.click('[data-sc-tab="progreso"]');
  await p.waitForTimeout(300);
  const prog = await texto(p, "#sc-app .sc-cuerpo");
  ok(prog.includes("0,3 h") && prog.includes("de 0,3 h que lleva el plan"), "horas acumuladas contra el plan");
  ok((await p.$$(".sc-hito")).length === 3 && prog.includes("Te faltan 36 h para 36 horas"), "hitos de 36, 50 y 65 h, y cuánto falta");
  ok((await p.$$eval(".sc-stats .hb-num", els => els.map(e => e.textContent))).join("|") === "1|1|1|100 %", "racha 1, mejor 1, 1 día completo, 100 %");
  ok((await p.$$(".sc-heat .sc-celda")).length === 180 && (await p.$$(".sc-heat .sc-celda.n2")).length === 1 && (await p.$$(".sc-heat .sc-celda.is-foto")).length === 7, "calendario de 180 días (hoy con 2 sesiones, 7 días de foto)");
  // Con la noche extendida activada (Ajustes), el plan llega antes a cada hito.
  const marcas = S.getPlanMarkers({ startDate: "2026-10-21", nocheExtendida: true }).map(m => `Día ${m.dia} · ${m.fechaTexto}`);
  ok(marcas.every(m => prog.includes(m)), `fechas en que el plan llega a cada hito (${marcas.join(", ")})`);
  await captura(p, "sc-progreso.png");
  await p.click('[data-sc-tab="semana"]');
  await p.waitForTimeout(200);
  const sem = await p.$$eval(".sc-sem-dia", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  ok(sem.length === 7 && sem[0].includes("Día 1") && sem[0].includes("Fotos") && sem[4].includes("Toda la cabeza") === false && sem[4].includes("Coronilla"), "próximos 7 días (el domingo, con la zona prioritaria)");
  await captura(p, "sc-semana.png");
  await p.click('[data-sc-tab="guia"]');
  await p.waitForTimeout(200);
  ok((await p.$$(".sc-guia-sec")).length === 14 && (await texto(p, ".sc-guia-sec:nth-child(5)")).includes("Pellizcos"), "guía en secciones plegables (movimientos, fases, fuentes…)");
  await captura(p, "sc-guia.png");
  await p.context().close();

  console.log("\nDesde el botón + (con la sugerencia descartada)");
  p = await abrir(browser, base, { __SEED__: { "users/test/habitos": { h1: LEER } } }, { zona: ZONA, fecha: enLaPaz("2026-10-21"), hash: "#habitos", ancho: 375 });
  await p.click("[data-sc-descartar]");
  await p.waitForTimeout(300);
  ok(await p.isHidden(".sc-sugerencia"), "«Ahora no» oculta la sugerencia");
  await p.click("#hb-nuevo");
  await p.waitForTimeout(400);
  ok(await p.isVisible(".hb-plan-guiado [data-sc-crear]"), "el botón + ofrece «Plan guiado: Scalping · Agregar»");
  await captura(p, "sc-boton-mas.png");
  await p.click(".hb-plan-guiado [data-sc-crear]");
  await p.waitForTimeout(500);
  await sinFestejos(p);
  ok(!!(await doc(p)) && await p.isVisible(".sc-fila"), "lo agrega y aparece la tarjeta en Hoy");
  await p.click("#hb-nuevo");
  await p.waitForTimeout(400);
  ok(await p.isVisible(".hb-plan-guiado [data-sc-abrir]"), "ya agregado, el botón + ofrece «Abrir»");
  await p.click(".hb-plan-guiado [data-sc-abrir]");
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => location.hash)) === "#hab-scalping" && await p.isVisible("#panel-hab-scalping"), "«Abrir» lleva a la pantalla de Scalping");
  await p.context().close();

  console.log("\nTabla de verificación (inicio 2026-10-21)");
  const tabla = [
    ["2026-10-21", "Día 1 de 180", "Adaptación", "5 min", "10 min", "Costados y nuca"],
    ["2026-10-25", "Día 5 de 180", "Adaptación", "5 min", "10 min", "Toda la cabeza"],
    ["2026-11-20", "Día 31 de 180", "Constancia", "8 min", "12 min", "Coronilla y parte superior"],
    ["2027-01-19", "Día 91 de 180", "Intensificación", "10 min", "15 min", "Coronilla y parte superior"],
    ["2027-04-18", "Día 180 de 180", "Intensificación", "10 min", "15 min", "Toda la cabeza"],
    ["2027-04-19", "Día 181 de 180", "Mantenimiento", "10 min", "15 min", "Entradas y sienes"]
  ];
  for (const [fecha, dia, fase, man, noc, zona] of tabla) {
    p = await abrir(browser, base, { __SEED__: { "users/test/habitos": { scalping: SC() } } }, { zona: ZONA, fecha: enLaPaz(fecha, "15:00"), hash: "#hab-scalping", ancho: 375 });
    const mins = await p.$$eval(".sc-sesion .sc-min", els => els.map(e => e.textContent));
    const z = await p.$$eval(".sc-sesion .sc-zona", els => els.map(e => e.textContent.replace("Zona:", "").trim()));
    let extra = "";
    if (fecha === "2027-04-18") extra = await p.isVisible(".sc-decision") ? " + decisión" : " SIN decisión";
    if (fecha === "2027-04-19") extra = (await texto(p, ".sc-banner")).includes("Mantenimiento") ? " + banner de mantenimiento" : " SIN banner";
    ok((await texto(p, ".sc-dia")) === dia && (await texto(p, ".sc-fase")) === fase && mins[0] === man && mins[1] === noc && z[1] === zona && !/SIN/.test(extra),
      `${fecha}: ${dia} · ${fase} · ${man} / ${noc} · ${zona}${extra}`);
    if (fecha === "2027-04-18") await captura(p, "sc-dia180.png");
    await p.context().close();
  }
  for (const [fecha, dia, horas] of [["2027-01-18", 90, "27,5 h"], ["2027-02-09", 112, "36,7 h"], ["2027-03-13", 144, "50 h"], ["2027-04-18", 180, "65 h"]]) {
    p = await abrir(browser, base, { __SEED__: { "users/test/habitos": { scalping: SC() } } }, { zona: ZONA, fecha: enLaPaz(fecha, "15:00"), hash: "#hab-scalping" });
    await p.click('[data-sc-tab="progreso"]');
    await p.waitForTimeout(200);
    ok((await texto(p, ".sc-horas")).includes(`de ${horas} que lleva el plan`), `día ${dia}: el plan acumula ${horas}`);
    await p.context().close();
  }

  console.log("\nTemporizador guiado (reloj falso)");
  p = await abrir(browser, base, { __SEED__: { "users/test/habitos": { scalping: SC() } } }, { zona: ZONA, relojFalso: enLaPaz("2026-10-21", "08:00"), hash: "#hab-scalping", ancho: 375 });
  await p.evaluate(() => { window.__beeps = 0; const b = ScalpingHabit.browser.beep; ScalpingHabit.browser.beep = (...a) => { window.__beeps++; b(...a); }; });
  await p.click('[data-sc-guiado="manana"]');
  await p.waitForTimeout(300);
  const g = sel => texto(p, `.sc-guiado [data-g="${sel}"]`);
  ok(await p.isVisible(".sc-guiado"), "Iniciar guiado abre la pantalla completa");
  ok((await g("pasoN")) === "Paso 1 de 3" && (await g("nombre")) === "Calentamiento" && (await g("zona")) === "Toda la cabeza" && (await g("reloj")) === "1:00", "paso 1 de 3: Calentamiento, toda la cabeza, 1:00");
  ok((await g("sig")) === "Siguiente: Presiones · 2:00" && (await g("instr")).startsWith("Presiones suaves"), "muestra instrucciones y el siguiente paso");
  await captura(p, "sc-guiado.png");
  await p.clock.fastForward(61000);
  await p.waitForTimeout(300);
  ok((await g("pasoN")) === "Paso 2 de 3" && (await g("nombre")) === "Presiones" && (await p.evaluate(() => window.__beeps)) >= 2, "cambia solo al paso 2, con pitido");
  await p.click('[data-g-accion="pausa"]');
  const enPausa = await g("reloj");
  await p.clock.fastForward(30000);
  await p.waitForTimeout(300);
  ok((await g("reloj")) === enPausa && (await texto(p, '[data-g-accion="pausa"]')) === "Reanudar", "en pausa no avanza (botón Reanudar)");
  await p.click('[data-g-accion="pausa"]');
  await p.click('[data-g-accion="siguiente"]');
  await p.waitForTimeout(200);
  ok((await g("pasoN")) === "Paso 3 de 3" && (await g("sig")) === "Último paso", "Siguiente paso salta al 3 (último)");
  await p.clock.fastForward(121000);
  await p.waitForTimeout(600);
  d = await doc(p);
  ok(await p.isHidden(".sc-guiado") && d.scalping.logs["2026-10-21"].manana.hecho === true && d.scalping.logs["2026-10-21"].manana.minutos === 5, "al terminar completo marca la sesión con los minutos del plan (5)");
  await p.click('[data-sc-guiado="noche"]');
  await p.waitForTimeout(300);
  await p.clock.fastForward(95000);
  await p.waitForTimeout(300);
  await p.click('[data-g-accion="terminar"]');   // pregunta y se acepta
  await p.waitForTimeout(600);
  d = await doc(p);
  ok(await p.isHidden(".sc-guiado") && d.scalping.logs["2026-10-21"].noche.hecho === true && d.scalping.logs["2026-10-21"].noche.minutos === 2, "terminar antes pregunta y marca con los minutos hechos (95 s → 2 min)");
  await p.context().close();

  await terminar(browser, srv);
})();
