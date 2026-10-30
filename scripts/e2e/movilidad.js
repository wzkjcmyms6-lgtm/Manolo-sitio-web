// Pruebas de pantalla de Movilidad (sub-panel de Inicio): tarjetas, vista
// previa, modo guiado con reloj falso (cuenta 3-2-1, avance solo, pausa,
// saltar, cambio de lado, fin), historial, salir y pantalla angosta.
// Uso: node scripts/e2e/movilidad.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const INICIO = "2026-10-30T07:30:00-04:00";   // viernes 30 de octubre
const COL = "users/test/movilidad";
const ses = (fecha, hh) => ({ v: 1, rutinaId: "liberar-el-cuerpo", nombre: "Liberar el cuerpo", fecha, completada: new Date(`${fecha}T${hh}:00-04:00`).getTime(), duracionSeg: 120, saltados: 0 });
const SEED = { [COL]: { s1: ses("2026-10-28", "07:10"), s2: ses("2026-10-29", "07:20") } };

// Vibración y pantalla encendida simuladas: se cuentan los pedidos.
function simular() {
  window.__vib = [];
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: p => { window.__vib.push(p); return true; } });
  window.__wake = { pedidos: 0, soltados: 0 };
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: () => {
    window.__wake.pedidos++;
    const l = { addEventListener() {}, release() { window.__wake.soltados++; return Promise.resolve(); } };
    return Promise.resolve(l);
  } } });
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inicio", zona: ZONA, relojFalso: INICIO });
  await p.context().addInitScript(simular);
  await p.reload();
  await p.waitForTimeout(800);
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  const texto = sel => p.$eval(sel, el => el.textContent.trim());   // sin mayúsculas de CSS
  const vis = sel => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && getComputedStyle(el).display !== "none"; }, sel);
  const avanzar = async ms => { await p.clock.fastForward(ms); await p.waitForTimeout(60); };
  const docs = () => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).values()), COL);
  const vib = () => p.evaluate(() => window.__vib.slice());
  const g = sel => `.mov-guia ${sel}`;

  console.log("\nTarjeta en Inicio y sección");
  const tarjetas = await p.$$eval("#panel-inicio .card-grid-home > a.card", els => els.map(a => a.getAttribute("href")));
  ok(tarjetas.indexOf("#movilidad") === tarjetas.indexOf("#biblia") + 1, `«Movilidad» va después de Libros y Biblia (${tarjetas.join(" ")})`);
  ok(await p.$eval('#panel-inicio a[href="#movilidad"] .icon svg', () => true).catch(() => false), "la tarjeta tiene su ícono");
  ok((await p.$$eval('a[href="#movilidad"], [data-hash="movilidad"]', els => els.filter(e => !e.closest(".card-grid-home")).length)) === 0, "no aparece en la barra inferior ni en el menú");
  await p.click('#panel-inicio a[href="#movilidad"]');
  await p.waitForTimeout(400);
  ok(await vis("#panel-movilidad") && !(await vis("#panel-inicio")), "la tarjeta abre Movilidad");
  ok(await p.$eval("#verse-banner", el => el.hidden), "sin el versículo de arriba (como Libros y Biblia)");
  ok(/Inicio/.test(await tx("#panel-movilidad .lib-volver")), "botón «‹ Inicio» para volver");

  console.log("\nPantalla principal");
  ok((await p.$$eval("#mov-app .lib-cifras b", els => els.map(e => e.textContent.trim()).join("|"))) === "🔥 2|2|2", "racha de 2 días, 2 esta semana, 2 en total");
  ok(/Haz una rutina hoy para seguir la racha/.test(await tx("#mov-app .bib-hoy")), "invita a seguir la racha");
  const rut = await p.$$eval("[data-mov-rutina]", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(rut.join(" | ") === "Liberar el cuerpo 2 min · 6 ejercicios | Antes de correr 5 min · 12 ejercicios | Después de correr 5 min · 8 ejercicios", `una tarjeta por rutina con nombre, duración y ejercicios (${rut.join(" | ")})`);
  ok((await p.$$(".mov-sesion")).length === 2 && /jue 29 oct · 7:20 · 2 min/.test(await tx(".mov-sesion")), "últimas sesiones, la más nueva primero");
  await captura(p, "movilidad-inicio.png");

  console.log("\nVista previa");
  await p.click('[data-mov-rutina="antes-de-correr"]');
  await p.waitForTimeout(350);
  ok((await p.$$(".mov-hoja .mov-lista li")).length === 12, "Antes de correr: los 12 ejercicios");
  ok((await p.$$eval(".mov-hoja .lib-h", els => els.map(e => e.textContent).join("|"))) === "Liberar el cuerpo|En movimiento", "en dos partes");
  ok(/En esta parte todo va en movimiento continuo, sin sostener posiciones\./.test(await tx(".mov-hoja .mov-nota")), "con la nota visible");
  ok(/Balanceo de pierna adelante-atrás 30 s · 15 s por lado/.test(await tx(".mov-hoja .mov-previa")), "los «por lado» lo dicen");
  await captura(p, "movilidad-previa.png");
  await p.click(".mov-hoja .budget-sheet-close");
  await p.waitForTimeout(350);
  await p.click('[data-mov-rutina="despues-de-correr"]');
  await p.waitForTimeout(350);
  ok((await p.$$(".mov-hoja .mov-lista li")).length === 8 && (await p.$$eval(".mov-hoja .lib-h", els => els.map(e => e.textContent).join("|"))) === "Bajar pulsaciones|Estiramientos sostenidos", "Después de correr: caminar y luego 7 estiramientos sostenidos");
  ok(/Sostén cada estiramiento sin rebotar/.test(await tx(".mov-hoja .mov-nota")) && /Gemelos en la pared 40 s · 20 s por lado/.test(await tx(".mov-hoja .mov-previa")), "con su nota y 20 s por lado");
  await p.click(".mov-hoja .budget-sheet-close");
  await p.waitForTimeout(350);
  await p.click('[data-mov-rutina="liberar-el-cuerpo"]');
  await p.waitForTimeout(350);
  ok((await p.$$(".mov-hoja .mov-lista li")).length === 6 && !(await p.$(".mov-hoja .mov-nota")), "Liberar el cuerpo: 6 ejercicios, sin nota");
  ok(/World's greatest stretch 20 s · 10 s por lado/.test(await tx(".mov-hoja .mov-previa")), "World's greatest stretch: 10 s por lado");

  console.log("\nModo guiado: cuenta 3-2-1 y avance");
  await p.click("[data-mov-empezar]");
  await p.waitForTimeout(200);
  ok(await vis(".mov-guia") && !(await vis(".mov-hoja")), "se abre a pantalla completa");
  ok((await tx(g("[data-mov-ej]"))) === "Prepárate" && (await tx(g("[data-mov-num]"))) === "3" && /Gato-vaca/.test(await tx(g("[data-mov-instr]"))), "cuenta 3-2-1: «Prepárate», empieza con Gato-vaca");
  ok(await p.$eval(g('[data-mov="pausa"]'), b => b.disabled) && await p.$eval(g('[data-mov="saltar"]'), b => b.disabled), "durante la cuenta no se pausa ni se salta");
  ok((await p.evaluate(() => window.__wake.pedidos)) === 1, "pide mantener la pantalla encendida");
  await avanzar(1000);
  ok((await tx(g("[data-mov-num]"))) === "2", "… 2 …");
  await avanzar(2000);
  ok((await tx(g("[data-mov-ej]"))) === "Gato-vaca" && (await tx(g("[data-mov-num]"))) === "20", "Gato-vaca, 20 segundos");
  ok(/Arquea y redondea la espalda/.test(await tx(g("[data-mov-instr]"))) && (await tx(g("[data-mov-sig]"))) === "Siguiente: Postura del niño · 20 s", "con su instrucción y «Siguiente: Postura del niño»");
  ok((await tx(g("[data-mov-paso]"))) === "Ejercicio 1 de 6", "Ejercicio 1 de 6");
  ok(JSON.stringify(await vib()) === "[150]", "vibra al empezar el ejercicio");
  await captura(p, "movilidad-guiado.png");
  await avanzar(5000);
  ok((await tx(g("[data-mov-num]"))) === "15", "el círculo cuenta hacia atrás (15)");
  // 5 a 6 s de 20 (el reloj de la prueba sigue andando mientras toma la captura).
  ok(await p.$eval(g("[data-mov-arco]"), c => { const v = parseFloat(c.style.strokeDashoffset); return v >= 24.9 && v <= 30.1; }), "el arco va por la cuarta parte");
  ok(await p.$eval(g("[data-mov-barra]"), b => Math.abs(parseFloat(b.style.width) - 4.2) < 0.5), "la barra de toda la rutina avanza (≈ 4 %)");

  console.log("\nPausar, reanudar y saltar");
  await p.click(g('[data-mov="pausa"]'));
  await avanzar(10000);
  ok((await tx(g("[data-mov-num]"))) === "15" && (await tx(g('[data-mov="pausa"]'))) === "Reanudar" && (await tx(g("[data-mov-sub]"))) === "En pausa", "en pausa el tiempo no corre");
  await p.click(g('[data-mov="pausa"]'));
  await avanzar(15000);
  ok((await tx(g("[data-mov-ej]"))) === "Postura del niño" && (await tx(g("[data-mov-num]"))) === "20", "al terminar pasa solo a Postura del niño");
  ok((await vib()).length === 2, "y vibra");
  await p.click(g('[data-mov="saltar"]'));
  await p.waitForTimeout(80);
  ok((await tx(g("[data-mov-ej]"))) === "Perro boca abajo pedaleando", "Saltar lleva al siguiente");
  await p.click(g('[data-mov="saltar"]'));
  await p.waitForTimeout(80);
  ok((await tx(g("[data-mov-ej]"))) === "World's greatest stretch" && (await tx(g("[data-mov-sub]"))) === "Lado 1", "World's greatest stretch: Lado 1");

  console.log("\nCambio de lado");
  ok(!(await vis(g("[data-mov-cambio]"))), "al principio, sin aviso");
  await avanzar(10000);
  ok(await vis(g("[data-mov-cambio]")) && /Cambia de lado/.test(await tx(g("[data-mov-cambio]"))) && (await tx(g("[data-mov-sub]"))) === "Lado 2", "a la mitad: «Cambia de lado», Lado 2");
  ok((await vib()).includes(100), "vibra al cambiar de lado");
  await captura(p, "movilidad-cambio.png");
  await avanzar(3500);
  ok(!(await vis(g("[data-mov-cambio]"))), "el aviso se va a los 3 s");

  console.log("\nRutina completada");
  await avanzar(47000);
  ok(await vis(g("[data-mov-fin]")) && /Rutina completada/.test(await tx(g("[data-mov-fin]"))), "pantalla «Rutina completada»");
  ok(/🔥 3 días seguidos · saltaste 2 ejercicios/.test(await tx(g("[data-mov-fin]"))), "con la racha (3) y los saltados (2)");
  ok(JSON.stringify((await vib()).slice(-1)[0]) === "[150,80,150]", "vibración de fin");
  ok((await p.evaluate(() => window.__wake.soltados)) >= 1, "suelta la pantalla encendida");
  let todos = await docs();
  const hoy = todos.find(d => d.fecha === "2026-10-30");
  ok(todos.length === 3 && hoy && hoy.rutinaId === "liberar-el-cuerpo" && hoy.nombre === "Liberar el cuerpo" && hoy.duracionSeg === 120 && hoy.saltados === 2 && hoy.completada > 0, "se guarda la fecha y la rutina hecha");
  await captura(p, "movilidad-fin.png");
  await p.click(g('[data-mov="listo"]'));
  await p.waitForTimeout(300);
  ok(!(await vis(".mov-guia")), "«Listo» vuelve a Movilidad");
  ok((await p.$$eval("#mov-app .lib-cifras b", els => els.map(e => e.textContent.trim()).join("|"))) === "🔥 3|3|3" && /Hoy ya hiciste tu movilidad/.test(await tx("#mov-app .bib-hoy")), "racha de 3 días y «Hoy ya hiciste tu movilidad»");
  ok(/^Liberar el cuerpo vie 30 oct · 7:3\d · 2 min · 2 saltados$/.test(await tx(".mov-sesion")), "la sesión de hoy primero en el historial");

  console.log("\nAntes de correr: nota de movimiento continuo y salir");
  await p.click('[data-mov-rutina="antes-de-correr"]');
  await p.waitForTimeout(300);
  await p.click("[data-mov-empezar]");
  await avanzar(3100);
  ok(!(await vis(g("[data-mov-nota]"))) && (await texto(g("[data-mov-parte]"))) === "Liberar el cuerpo", "primera parte, sin la nota");
  for (let k = 0; k < 6; k++) { await p.click(g('[data-mov="saltar"]')); await p.waitForTimeout(40); }
  ok((await tx(g("[data-mov-ej]"))) === "Balanceo de pierna adelante-atrás" && (await tx(g("[data-mov-paso]"))) === "Ejercicio 7 de 12", "ejercicio 7 de 12");
  ok(await vis(g("[data-mov-nota]")) && /movimiento continuo, sin sostener posiciones/.test(await tx(g("[data-mov-nota]"))) && (await texto(g("[data-mov-parte]"))) === "En movimiento", "se ve la nota «En esta parte todo va en movimiento continuo…»");
  await p.click(g('[data-mov="salir"]'));
  await p.waitForTimeout(250);
  ok(!(await vis(".mov-guia")) && (await docs()).length === 3, "Salir (con confirmación) no guarda la sesión");

  console.log("\nSalir de la app la pausa; atrás del navegador la cierra");
  await p.click('[data-mov-rutina="liberar-el-cuerpo"]');
  await p.waitForTimeout(300);
  await p.click("[data-mov-empezar]");
  await avanzar(4000);
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(80);
  ok((await tx(g('[data-mov="pausa"]'))) === "Reanudar", "al salir de la app queda en pausa");
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); });
  await p.evaluate(() => { location.hash = "#inicio"; });
  await p.waitForTimeout(300);
  ok(!(await vis(".mov-guia")) && (await docs()).length === 3, "ir a Inicio cierra la rutina sin guardarla");
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();

  console.log("\nCelular angosto (320 px)");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#movilidad", ancho: 320, alto: 640, zona: ZONA, relojFalso: INICIO });
  await q.waitForTimeout(600);
  ok((await q.$eval("html", el => el.scrollWidth - el.clientWidth)) <= 0, "Movilidad no se sale de ancho");
  await q.click('[data-mov-rutina="antes-de-correr"]');
  await q.waitForTimeout(300);
  ok((await q.$eval(".mov-hoja .budget-sheet-panel", el => el.scrollWidth - el.clientWidth)) <= 0, "la vista previa cabe");
  await q.click("[data-mov-empezar]");
  await q.clock.fastForward(3100);
  for (let k = 0; k < 6; k++) { await q.click('.mov-guia [data-mov="saltar"]'); await q.waitForTimeout(40); }
  ok((await q.$eval(".mov-guia", el => el.scrollWidth - el.clientWidth)) <= 0, "el modo guiado (con el nombre más largo y la nota) cabe a lo ancho");
  ok(await q.$eval('.mov-guia [data-mov="pausa"]', b => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.height >= 44; }), "los botones quedan a la vista y miden al menos 44 px");
  await captura(q, "movilidad-320.png");
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();
  await terminar(browser, srv);
})();
