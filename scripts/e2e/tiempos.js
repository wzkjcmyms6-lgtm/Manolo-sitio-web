// Pruebas de pantalla de Medir tiempos (sub-panel de Inicio, provisoria).
// Uso: node scripts/e2e/tiempos.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const T = require("../../js/tiempos-motor.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-10-28T08:00:00-04:00";   // miércoles: semana del 26 oct al 1 nov
const COL = "users/test/tiempos";
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);
const texto = (p, sel) => p.$eval(sel, el => el.textContent.replace(/\s+/g, " ").trim());
// Celdas de una fila de la tabla, separadas por un espacio.
const fila = (p, sel) => p.$eval(sel, el => Array.from(el.children).map(c => c.textContent.trim()).join(" "));
const doc = (p, id) => p.evaluate(([c, i]) => window.__fakeStore.colMap(c).get(i) || null, [COL, id]);
const todos = p => p.evaluate(c => Object.fromEntries(window.__fakeStore.colMap(c)), COL);

// 29 días de rutina de la mañana (28 sept → 26 oct), correr el 26 y 27, leer la semana pasada.
const SEED_DOCS = {};
for (let i = 0; i < 29; i++) {
  const d = new Date(Date.UTC(2026, 8, 28 + i, 12)).toISOString().slice(0, 10);
  SEED_DOCS[d] = { fecha: d, seg: { manana: 1500 + i * 10 } };
}
SEED_DOCS["2026-10-26"].seg.correr = 1800;
SEED_DOCS["2026-10-27"] = { fecha: "2026-10-27", seg: { correr: 2000 } };
SEED_DOCS["2026-10-20"].seg.leer = 1200;
const SEED = { [COL]: SEED_DOCS };

async function escribir(p, act, min, seg) {
  await p.fill(`#tmp-form [name="${act}-min"]`, min);
  await p.fill(`#tmp-form [name="${act}-seg"]`, seg);
}
async function elegirDia(p, f) {
  await p.$eval('#tmp-form [name="fecha"]', (el, v) => { el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }, f);
  await p.waitForTimeout(150);
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inicio", zona: ZONA, fecha: HOY });
  await p.waitForTimeout(600);

  console.log("\nTarjeta en Inicio y sección");
  const tarjetas = await p.$$eval("#panel-inicio .card-grid-home > a.card", els => els.map(a => a.getAttribute("href")));
  ok(tarjetas.slice(-3).join(",") === "#libros,#biblia,#tiempos", `«Medir tiempos» va después de Libros y Biblia (${tarjetas.join(" ")})`);
  ok(await p.$eval('#panel-inicio a[href="#tiempos"] .icon svg', () => true).catch(() => false), "la tarjeta tiene su ícono (reloj)");
  ok(await p.$$eval('a[href="#tiempos"], [data-hash="tiempos"]', els => els.filter(e => !e.closest(".card-grid-home")).length) === 0, "no aparece en la barra inferior ni en el menú");
  await p.click('#panel-inicio a[href="#tiempos"]');
  await p.waitForTimeout(400);
  ok(await visible(p, "#panel-tiempos") && !(await visible(p, "#panel-inicio")), "la tarjeta abre Medir tiempos");
  ok(await p.$eval("#verse-banner", el => el.hidden), "sin el versículo de arriba");
  ok(/Inicio/.test(await texto(p, "#panel-tiempos .lib-volver")), "botón «‹ Inicio» para volver");
  ok((await p.$eval('#tmp-form [name="fecha"]', el => el.value)) === "2026-10-28", "anota el día de hoy");
  ok((await p.$$eval("#tmp-form .tmp-fila .tmp-act b", els => els.map(e => e.textContent).join("|"))) === "Rutina de la mañana|Ejercicio|Correr|Desayunar|Bañarse y alistarse|Leer 30 páginas", "las seis actividades, en orden");
  ok(/scalping, rezar, decretar y tender la cama/.test(await texto(p, '[data-tmp-act="manana"] small')), "la rutina de la mañana dice qué incluye");
  ok(/29 de 30/.test(await texto(p, '[data-tmp-avance="manana"]')), "la rutina de la mañana lleva 29 de 30");
  await captura(p, "tiempos-inicio.png");

  console.log("\nAnotar el día");
  await escribir(p, "desayunar", "", "75");
  await p.click("#tmp-form [type=submit]");
  await p.waitForTimeout(250);
  ok(/Desayunar: Los segundos van de 0 a 59/.test(await texto(p, "#tmp-form .lib-error")), "avisa si los segundos pasan de 59");
  ok(!(await doc(p, "2026-10-28")), "y no guarda");
  await escribir(p, "desayunar", "", "");
  await escribir(p, "manana", "25", "");
  await escribir(p, "correr", "30", "");
  await escribir(p, "leer", "20", "5");
  await p.click("#tmp-form [type=submit]");
  await p.waitForTimeout(400);
  const hoyDoc = await doc(p, "2026-10-28");
  ok(hoyDoc && hoyDoc.fecha === "2026-10-28" && JSON.stringify(hoyDoc.seg) === JSON.stringify({ manana: 1500, correr: 1800, leer: 1205 }), `guarda el día en segundos (${JSON.stringify(hoyDoc && hoyDoc.seg)})`);
  ok(/Guardado/.test(await texto(p, "#tmp-form .tmp-ok")) && (await p.$eval("#tmp-form .lib-error", el => el.hidden)), "dice «Guardado» y borra el error");
  ok((await p.$eval('#tmp-form [name="leer-min"]', el => el.value)) === "20" && (await p.$eval('#tmp-form [name="leer-seg"]', el => el.value)) === "5", "el formulario queda con lo guardado");

  const ds = T.dias(await todos(p));
  const est = T.estado(ds);
  console.log("\n30 registros: promedio final");
  ok(est.manana.n === 30 && est.manana.completa, "con el de hoy, la rutina de la mañana llega a 30");
  ok(/30 de 30/.test(await texto(p, '[data-tmp-avance="manana"]')) && (await texto(p, '[data-tmp-avance="manana"]')).includes(`Promedio final: ${T.texto(est.manana.promedio)}`), `promedio final ${T.texto(est.manana.promedio)}`);
  ok(await p.$('#tmp-form [name="manana-min"]'), "hoy todavía se puede corregir (ya cuenta)");
  await elegirDia(p, "2026-10-27");
  ok(!(await p.$('#tmp-form [name="manana-min"]')) && (await texto(p, '[data-tmp-act="manana"] .tmp-cerrada')).includes(`promedio final ${T.texto(est.manana.promedio)}`), "otro día ya no deja anotarla: muestra el promedio final");
  ok(await p.$('#tmp-form [name="correr-min"]'), "las demás actividades siguen abiertas");
  ok((await p.$eval('#tmp-form [name="correr-min"]', el => el.value)) === "33" && (await p.$eval('#tmp-form [name="correr-seg"]', el => el.value)) === "20", "al elegir un día con datos, se cargan (33 min 20 s)");
  ok((await texto(p, '[data-tmp-avance="leer"] .tmp-avance-fila span')) === "2 de 30", "leer lleva 2 de 30");

  console.log("\nPromedios por semana y por mes");
  const sem = T.periodo(ds, "semana", "2026-10-28", "2026-10-28");
  ok((await texto(p, "#tmp-periodo")) === "Esta semana · 26 oct – 1 nov", "empieza en esta semana (lunes a domingo)");
  ok((await fila(p, '[data-tmp-prom="manana"]')) === `Rutina de la mañana ${T.texto(sem.act.manana.promedio)} 2`, `mañana: ${T.texto(sem.act.manana.promedio)} en 2 días`);
  ok((await fila(p, '[data-tmp-prom="correr"]')) === `Correr ${T.texto(sem.act.correr.promedio)} 3`, `correr: ${T.texto(sem.act.correr.promedio)} en 3 días`);
  ok((await fila(p, '[data-tmp-prom="desayunar"]')) === "Desayunar — 0", "sin datos: guion");
  ok(await p.$eval('[data-tmp-mover="1"]', b => b.disabled), "no se puede ir a una semana futura");
  ok(/todavía no termina/.test(await texto(p, "#tmp-promedios")), "avisa que la semana sigue en curso");
  await p.click('[data-tmp-mover="-1"]');
  await p.waitForTimeout(150);
  ok((await texto(p, "#tmp-periodo")) === "19 oct – 25 oct", "semana anterior");
  ok((await fila(p, '[data-tmp-prom="leer"]')) === "Leer 30 páginas 20 min 1", "leer: 20 min la semana pasada");
  await p.click('[data-tmp-mover="1"]');
  await p.waitForTimeout(150);
  ok((await texto(p, "#tmp-periodo")) === "Esta semana · 26 oct – 1 nov", "y vuelve a esta semana");
  await p.click('[data-tmp-tipo="mes"]');
  await p.waitForTimeout(150);
  const mes = T.periodo(ds, "mes", "2026-10-28", "2026-10-28");
  ok((await texto(p, "#tmp-periodo")) === "Este mes · Octubre 2026", "promedio del mes");
  ok((await fila(p, '[data-tmp-prom="manana"]')) === `Rutina de la mañana ${T.texto(mes.act.manana.promedio)} ${mes.act.manana.n}`, `mañana en octubre: ${T.texto(mes.act.manana.promedio)} en ${mes.act.manana.n} días`);
  await p.click('[data-tmp-mover="-1"]');
  await p.waitForTimeout(150);
  ok((await texto(p, "#tmp-periodo")) === "Septiembre 2026" && (await fila(p, '[data-tmp-prom="manana"]')) === "Rutina de la mañana 25 min 10 s 3", "septiembre: 3 días, 25 min 10 s");
  await captura(p, "tiempos-promedios.png");

  console.log("\nTus días: corregir y borrar");
  ok((await p.$$eval("[data-tmp-dia]", els => els.map(e => e.dataset.tmpDia))).slice(0, 3).join(",") === "2026-10-28,2026-10-27,2026-10-26", "lista con el más nuevo primero");
  await elegirDia(p, "2026-10-28");
  await p.click('[data-tmp-dia="2026-10-27"]');
  await p.waitForTimeout(300);
  ok((await p.$eval('#tmp-form [name="fecha"]', el => el.value)) === "2026-10-27", "tocar un día lo abre arriba para corregir");
  await escribir(p, "correr", "", "");
  await p.click("#tmp-form [type=submit]");
  await p.waitForTimeout(300);
  ok(!(await doc(p, "2026-10-27")), "vaciar todos los tiempos de un día lo borra");
  ok(/Día borrado/.test(await texto(p, "#tmp-form .tmp-ok")), "y lo dice");
  await p.click("#tmp-form [type=submit]");
  await p.waitForTimeout(200);
  ok(/al menos un tiempo/.test(await texto(p, "#tmp-form .lib-error")), "guardar un día vacío pide al menos un tiempo");
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();

  console.log("\nCelular angosto (320 px)");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#tiempos", ancho: 320, alto: 700, zona: ZONA, fecha: HOY });
  await q.waitForTimeout(600);
  ok((await sobra(q, "html")) <= 0 && (await sobra(q, "#panel-tiempos")) <= 0, "nada se sale de ancho");
  ok(await q.$eval('#tmp-form [name="manana-min"]', el => getComputedStyle(el).fontSize === "16px" && el.inputMode === "numeric"), "campos de 16 px con teclado numérico (el iPhone no hace zoom)");
  await captura(q, "tiempos-320.png");
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();
  await terminar(browser, srv);
})();
