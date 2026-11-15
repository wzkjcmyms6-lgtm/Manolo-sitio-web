// Medir tiempos, fase 6 (D-113): tus actividades, «Medir ahora», «Mi mañana»
// y lo que se llena solo. Lo llama scripts/e2e/tiempos.js (SOLO=fase6 para
// correr solo esto).
const { abrir, ok } = require("./comun.js");
const SEM = require("./lectura-semilla.js");
const A = require("../../js/tiempos-actividades.js");

const ZONA = "America/La_Paz";
const HOY = "2026-11-16";            // lunes
const txt = (p, sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim()).catch(() => "");
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.getClientRects().length > 0; }, sel);
const sinDesborde = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const dia = (p, f) => p.evaluate(x => window.__fakeStore.colMap("users/test/tiempos").get(x) || null, f);
const ajustes = p => p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("tiempos_ajustes") || null);
function consola(p) {
  p.consola = [];
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) p.consola.push(m.text()); });
}
const semilla = () => SEM.estado(HOY, { sinBiblia: true, sinLibros: true });
const cerca = (a, b) => typeof a === "number" && Math.abs(a - b) <= 3;   // el reloj de prueba sigue corriendo entre pasos
const sinErrores = p => ok(!p.errores.length && !p.consola.length, "sin errores" + (p.consola.length ? `: ${p.consola.join(" | ")}` : "") + (p.errores.length ? `: ${p.errores.join(" | ")}` : ""));

// ---------- Tus actividades ----------
async function actividades(browser, base, ancho, captura) {
  console.log(`\nMedir tiempos: tus actividades (${ancho} px)`);
  const p = await abrir(browser, base, semilla(), { hash: "#tiempos", zona: ZONA, fecha: `${HOY}T06:30:00-04:00`, ancho, alto: 844 });
  consola(p);
  await p.waitForTimeout(800);
  const aj = await ajustes(p);
  ok(aj && aj.actividades && aj.actividades.correr.desde === HOY && aj.actividades.leer.desde === HOY && aj.actividades.ejercicio.desde === HOY && !aj.actividades.manana.desde,
    "el primer día guarda tus actividades; Correr, Ejercicio y Leer se llenan solas desde hoy");
  ok((await p.$$eval("#tmp-anotar .tmp-fila .tmp-emoji", els => els.map(e => e.textContent).join(""))) === "🌅🏋️🏃🍳🚿📖", "cada actividad con su emoji");
  ok((await p.$$("#tmp-anotar .tmp-medir")).length === 6, "⏱ Medir en cada una");
  await p.click("#tmp-anotar [data-tact-abrir]");
  await p.waitForTimeout(300);
  ok(/Tus actividades/.test(await txt(p, ".tact-hoja h3")) && (await p.$$(".tact-hoja .tact-lista .tact-fila")).length === 6, "«Tus actividades»: las 6 de siempre");

  // Crear
  await p.click('.tact-hoja [data-tact-editar="nueva"]');
  await p.waitForTimeout(150);
  await p.fill('.tact-hoja [name="nombre"]', "Orar");
  await p.click('.tact-hoja [data-tact-emoji="🙏"]');
  await p.click('.tact-hoja [type="submit"]');
  await p.waitForTimeout(300);
  let a2 = await ajustes(p);
  ok(a2.actividades["a-orar"] && a2.actividades["a-orar"].nombre === "Orar" && a2.actividades["a-orar"].emoji === "🙏" && a2.actividades["a-orar"].orden === 6 && a2.actividades["a-orar"].manana === true,
    "crear «Orar» 🙏: va al final y en tu mañana");
  ok(/Orar/.test(await txt(p, '#tmp-anotar [data-tmp-act="a-orar"]')), "y aparece para anotar");
  await p.click('.tact-hoja [data-tact-editar="nueva"]');
  await p.waitForTimeout(150);
  await p.fill('.tact-hoja [name="nombre"]', "orar");
  await p.click('.tact-hoja [type="submit"]');
  await p.waitForTimeout(150);
  ok(/Ya tienes una actividad con ese nombre/.test(await txt(p, ".tact-hoja .lib-error")), "no deja repetir el nombre");
  await p.click(".tact-hoja [data-tact-volver-lista]");
  await p.waitForTimeout(150);

  // Renombrar y cambiar el emoji
  await p.click('.tact-hoja [data-tact-editar="desayunar"]');
  await p.waitForTimeout(150);
  await p.fill('.tact-hoja [name="nombre"]', "Desayuno");
  await p.click('.tact-hoja [data-tact-emoji="☕"]');
  await p.click('.tact-hoja [type="submit"]');
  await p.waitForTimeout(300);
  ok(/☕\s*Desayuno/.test(await txt(p, '#tmp-anotar [data-tmp-act="desayunar"] .tmp-act')), "renombrar: el mismo id con nombre y emoji nuevos");
  ok(/Desayuno: /.test(await txt(p, "#tmp-dias")) && !/Desayunar: /.test(await txt(p, "#tmp-dias")), "tus días de antes también usan el nombre nuevo");

  // Ordenar
  await p.click('.tact-hoja [data-tact-mover="leer"][data-delta="-1"]');
  await p.waitForTimeout(250);
  const orden = await p.$$eval("#tmp-anotar .tmp-fila", els => els.map(e => e.dataset.tmpAct));
  ok(orden.indexOf("leer") === orden.indexOf("banarse") - 1, `subir «Leer» un lugar (${orden.join(" ")})`);

  // Archivar y volver a usar
  await p.click('.tact-hoja [data-tact-editar="correr"]');
  await p.waitForTimeout(150);
  await p.click('.tact-hoja [data-tact-archivar="correr"]');
  await p.waitForTimeout(300);
  ok(!(await p.$('#tmp-anotar [data-tmp-act="correr"]')) && /Archivadas/.test(await txt(p, ".tact-hoja")), "archivar: ya no aparece para anotar");
  ok(/Correr: /.test(await txt(p, "#tmp-dias")), "pero sus tiempos siguen en tus días");
  await p.click('.tact-hoja [data-tact-volver="correr"]');
  await p.waitForTimeout(300);
  ok(await p.$('#tmp-anotar [data-tmp-act="correr"]'), "«Volver a usar»");

  // Fuera de la mañana y sin llenarse sola
  await p.click('.tact-hoja [data-tact-editar="leer"]');
  await p.waitForTimeout(150);
  await p.uncheck('.tact-hoja [name="manana"]');
  await p.selectOption('.tact-hoja [name="fuente"]', "");
  await p.click('.tact-hoja [type="submit"]');
  await p.waitForTimeout(300);
  a2 = await ajustes(p);
  ok(a2.actividades.leer.manana === false && a2.actividades.leer.fuente === "" && !a2.actividades.leer.desde, "sacar «Leer» de la mañana y que no se llene sola");
  await captura(p, `tiempos-actividades-${ancho}.png`);
  await p.click(".tact-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  const pasos = await txt(p, "#tmp-manana .tmp-nota");
  ok(!/Leer/.test(pasos) && /Orar/.test(pasos) && pasos.indexOf("Desayuno") < pasos.indexOf("Bañarse"), `Mi mañana usa tu orden y tus pasos (${pasos.slice(0, 120)})`);
  ok(await sinDesborde(p), "no se mueve de lado");
  if (ancho < 800) {
    await p.setViewportSize({ width: 320, height: 640 });
    await p.click("#tmp-anotar [data-tact-abrir]");
    await p.waitForTimeout(300);
    ok(await sinDesborde(p), "«Tus actividades» entra en 320 px");
  }
  sinErrores(p);
  await p.context().close();
}

// ---------- Medir ahora y Mi mañana ----------
async function medirYManana(browser, base, ancho, captura) {
  console.log(`\nMedir tiempos: «Medir ahora» y «Mi mañana» (${ancho} px)`);
  const p = await abrir(browser, base, semilla(), { hash: "#tiempos", zona: ZONA, relojFalso: `${HOY}T06:30:00-04:00`, ancho, alto: 844 });
  consola(p);
  await p.evaluate(() => {
    window.__wl = 0;
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => { window.__wl++; return { release: async () => {}, addEventListener() {} }; } } });
  });
  const avanzar = async ms => { await p.clock.fastForward(ms); await p.waitForTimeout(350); };
  const reloj = () => txt(p, ".tman-hoja [data-tman-reloj]");
  await p.waitForTimeout(900);

  // Medir ahora
  await p.click('#tmp-anotar [data-tman-medir="banarse"]');
  await p.waitForTimeout(300);
  ok(/Medir ahora/.test(await txt(p, ".tman-hoja h3")) && (await reloj()) === "0:00" && /Bañarse/.test(await txt(p, ".tman-hoja .tman-paso")), "⏱ Medir: el reloj empieza en 0:00");
  await avanzar(9 * 60000 + 15000);
  // El reloj de prueba sigue corriendo entre pasos: ±3 s (como cerca()).
  const segs = t => { const m = /^(\d+):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  ok(cerca(segs(await reloj()), 555), `corre (${await reloj()})`);
  ok(await p.evaluate(() => window.__wl) >= 1, "mantiene la pantalla encendida");
  await p.click('.tman-hoja [data-tman="pausa-medir"]');
  await avanzar(3 * 60000);
  const enPausa = await reloj();
  ok(cerca(segs(enPausa), 555), `en pausa no cuenta (${enPausa})`);
  await p.click('.tman-hoja [data-tman="pausa-medir"]');
  await avanzar(45000);
  ok(cerca(segs(await reloj()), segs(enPausa) + 45), `al seguir vuelve a contar (${await reloj()})`);
  ok(await p.evaluate(() => !!localStorage.getItem("manolo.tiempos.medir")), "queda guardado en el teléfono (sigue aunque se bloquee)");
  await captura(p, `tiempos-medir-${ancho}.png`);
  await p.click('.tman-hoja [data-tman="terminar-medir"]');
  await p.waitForTimeout(300);
  ok(cerca(((await dia(p, HOY)) || { seg: {} }).seg.banarse, 600) && /Guardado/.test(await txt(p, ".tman-hoja .tman-ok")), "Terminar y guardar: 10 min en hoy");
  await p.click('.tman-hoja [data-cerrar-hoja]');
  await p.waitForTimeout(300);
  ok(/✓ 10 min/.test(await txt(p, '#tmp-anotar [data-tmp-act="banarse"] .tmp-hecho')), "la fila de hoy queda con ✓ 10 min");
  await p.click('#tmp-anotar [data-tman-medir="banarse"]');
  await avanzar(2 * 60000);
  await p.click('.tman-hoja [data-tman="terminar-medir"]');
  await p.waitForTimeout(250);
  ok(/Ya tenías 10 min/.test(await txt(p, ".tman-hoja .tman-elegir")), "si ya había un tiempo, pregunta: reemplazar o sumar");
  await p.click('.tman-hoja [data-tman="sumar"]');
  await p.waitForTimeout(300);
  ok(cerca((await dia(p, HOY)).seg.banarse, 720), "Sumar: 12 min");
  await p.click('.tman-hoja [data-cerrar-hoja]');
  await p.waitForTimeout(300);

  // Mi mañana
  ok(/Rutina de la mañana → \S+ Ejercicio → \S+ Correr → \S+ Desayunar → \S+ Bañarse y alistarse → \S+ Leer 30 páginas/.test(await txt(p, "#tmp-manana .tmp-nota")), "la tarjeta «Mi mañana» con tus pasos en orden");
  await p.click('#tmp-manana [data-tman="empezar"]');
  await p.waitForTimeout(300);
  ok(/Paso 1 de 6/.test(await txt(p, ".tman-hoja .tman-cuenta")) && /Rutina de la mañana/.test(await txt(p, ".tman-hoja .tman-paso")) && (await reloj()) === "0:00", "empieza: paso 1 de 6, la rutina de la mañana");
  await avanzar(20 * 60000);
  ok(/Tu promedio: \d+ min.*te quedan/.test(await txt(p, ".tman-hoja [data-tman-prom]")), `en vivo contra tu promedio (${await txt(p, ".tman-hoja [data-tman-prom]")})`);
  await avanzar(15 * 60000);
  ok(await p.$eval(".tman-hoja [data-tman-reloj]", el => el.classList.contains("is-pasado")) && /por encima de tu promedio/.test(await txt(p, ".tman-hoja [data-tman-prom]")), "si te pasas del promedio, el reloj se pone naranja");
  await captura(p, `tiempos-manana-${ancho}.png`);
  await p.click('.tman-hoja [data-tman="siguiente"]');
  await p.waitForTimeout(300);
  ok(cerca((await dia(p, HOY)).seg.manana, 2100) && /Paso 2 de 6/.test(await txt(p, ".tman-hoja .tman-cuenta")) && /Ejercicio/.test(await txt(p, ".tman-hoja .tman-paso")), "Siguiente: guarda 35 min y pasa a Ejercicio");
  await p.click('.tman-hoja [data-tman="saltar"]');
  await p.waitForTimeout(250);
  await p.click('.tman-hoja [data-tman="saltar"]');
  await p.waitForTimeout(250);
  ok(/Desayunar/.test(await txt(p, ".tman-hoja .tman-paso")) && !("ejercicio" in (await dia(p, HOY)).seg) && !("correr" in (await dia(p, HOY)).seg), "Saltar (hoy no): no guarda nada");
  await avanzar(10 * 60000);
  await p.click('.tman-hoja [data-tman="pausa-manana"]');
  await p.waitForTimeout(200);
  await avanzar(5 * 60000);
  ok((await reloj()) === "10:00", "Pausar: el paso no corre");
  // Cerrar la hoja: la mañana sigue (tarjeta «Seguir mi mañana»).
  await p.click(".tman-hoja .budget-sheet-close");
  await p.waitForTimeout(400);
  ok(/Vas en el paso 4 de 6: .*Desayunar/.test(await txt(p, "#tmp-manana")) && await p.evaluate(() => !!localStorage.getItem("manolo.tiempos.manana")), "si cierras, la tarjeta dice en qué paso vas");
  await p.click('#tmp-manana [data-tman="ver-manana"]');
  await p.waitForTimeout(300);
  await p.click('.tman-hoja [data-tman="pausa-manana"]');
  await avanzar(2 * 60000);
  ok((await reloj()) === "12:00", `y sigue donde ibas (${await reloj()})`);
  await p.click('.tman-hoja [data-tman="siguiente"]');
  await p.waitForTimeout(250);
  await avanzar(18 * 60000);
  await p.click('.tman-hoja [data-tman="siguiente"]');
  await p.waitForTimeout(250);
  ok(/Terminar ✓/.test(await txt(p, '.tman-hoja [data-tman="siguiente"]')), "en el último paso, el botón dice «Terminar ✓»");
  await avanzar(30 * 60000);
  await p.click('.tman-hoja [data-tman="siguiente"]');
  await p.waitForTimeout(350);
  const resumen = await txt(p, ".tman-hoja .tman-resumen");
  ok(/Mañana terminada/.test(resumen) && /1 h 35 min en 4 pasos \(saltaste 2\)/.test(resumen), `el resumen: 1 h 35 min en 4 pasos (${resumen.slice(0, 90)})`);
  ok((await p.$$(".tman-hoja .tman-tabla li")).length === 6 && /saltado/.test(await txt(p, ".tman-hoja .tman-tabla")) && await p.$(".tman-hoja .tman-tabla small.is-mas"), "cada paso contra tu promedio (y los saltados)");
  ok(/tu promedio/.test(await txt(p, ".tman-hoja .tman-vs")), "y el total contra tu promedio");
  await captura(p, `tiempos-manana-resumen-${ancho}.png`);
  const hoy = (await dia(p, HOY)).seg;
  ok(cerca(hoy.manana, 2100) && cerca(hoy.desayunar, 720) && cerca(hoy.banarse, 1080) && cerca(hoy.leer, 1800), `cada paso quedó anotado en hoy (${JSON.stringify(hoy)})`);
  await p.click('.tman-hoja [data-tman="listo-manana"]');
  await p.waitForTimeout(400);
  ok(/✓ Hoy: 1 h 35 min/.test(await txt(p, "#tmp-manana")), "la tarjeta dice cómo te fue hoy");
  ok(await sinDesborde(p), "no se mueve de lado");
  sinErrores(p);
  await p.context().close();
}

// ---------- Se llena solo ----------
async function seLlenaSolo(browser, base, ancho, captura) {
  console.log(`\nMedir tiempos: se llena solo con Running, Ejercicio y Libros (${ancho} px)`);
  const e = semilla(), S = e.__SEED__;
  S["users/test/meta"] = Object.assign({}, S["users/test/meta"], { tiempos_ajustes: { v: 1, actividades: A.inicial("2026-11-14") } });
  S["users/test/running"] = {
    r1: { date: "2026-11-14", distance: 5, duration: 31.5, notes: "" },   // ese día ya lo anotaste a mano
    r2: { date: HOY, distance: 6, duration: 36, notes: "" },
    r3: { date: "2026-11-01", distance: 4, duration: 25, notes: "" }      // antes de que empezara a llenarse solo
  };
  S["users/test/entrenamientos"] = { w1: { date: HOY, name: "Pecho", startedAt: Date.parse(`${HOY}T06:00:00-04:00`), durationMin: 50, exercises: [] } };
  S["users/test/libros"] = { b1: { v: 1, titulo: "Hábitos atómicos", autor: "James Clear", paginas: 320, estado: "leyendo", fechaRegistro: "2026-11-01", fechaInicio: "2026-11-02", paginaActual: 120,
    progreso: { "2026-11-15": 120 }, paginaBase: 100, sesiones: { s1: { fecha: "2026-11-15", min: 25, desde: 100, hasta: 120, unidad: "pag", ini: Date.parse("2026-11-15T21:00:00-04:00") } } } };
  const manual14 = S["users/test/tiempos"]["2026-11-14"].seg.correr;
  const p = await abrir(browser, base, e, { hash: "#tiempos", zona: ZONA, fecha: `${HOY}T09:00:00-04:00`, ancho, alto: 844 });
  consola(p);
  await p.waitForTimeout(1500);
  const hoy = await dia(p, HOY), d15 = await dia(p, "2026-11-15"), d14 = await dia(p, "2026-11-14"), d01 = await dia(p, "2026-11-01");
  ok(hoy && hoy.seg.correr === 2160 && hoy.auto.correr.f === "running", "Correr se llena solo con tu carrera de hoy (36 min)");
  ok(hoy.seg.ejercicio === 3000 && hoy.auto.ejercicio.f === "gimnasio", "Ejercicio, con tu entreno (50 min)");
  ok(d15 && d15.seg.leer === 1500 && d15.auto.leer.f === "libros", "Leer, con tus 25 minutos de «Leer ahora» de ayer");
  ok(d14.seg.correr === manual14 && !(d14.auto && d14.auto.correr), "lo que anotaste a mano manda (no lo pisa)");
  ok(!d01 || !(d01.auto && d01.auto.correr), "los días de antes no cambian");
  ok(/⚡ de Running/.test(await txt(p, '#tmp-anotar [data-tmp-act="correr"]')) && /✓ 36 min/.test(await txt(p, '#tmp-anotar [data-tmp-act="correr"] .tmp-hecho')), "la fila dice «⚡ de Running»");
  await captura(p, `tiempos-auto-${ancho}.png`);
  // Quitar lo que llegó solo: no vuelve.
  await p.click('#tmp-anotar [data-tmp-quitar="correr"]');
  await p.waitForTimeout(1200);
  const tras = await dia(p, HOY);
  ok(!("correr" in tras.seg) && tras.noAuto && tras.noAuto.correr === true, "quitarlo lo deja anotado para que no vuelva");
  // Cambiarlo a mano: deja de ser automático.
  await p.fill('#tmp-anotar [name="ejercicio-min"]', "45");
  await p.fill('#tmp-anotar [name="ejercicio-seg"]', "");
  await p.click('#tmp-anotar [data-tmp-act="ejercicio"] .tmp-guardar');
  await p.waitForTimeout(1200);
  const tras2 = await dia(p, HOY);
  ok(tras2.seg.ejercicio === 2700 && !(tras2.auto && tras2.auto.ejercicio) && !("correr" in tras2.seg), "si lo cambias a mano, manda lo tuyo (y Correr no volvió)");
  // Exportar
  const [dj] = await Promise.all([p.waitForEvent("download"), p.click('[data-tmp-exportar="json"]')]);
  const json = JSON.parse(require("fs").readFileSync(await dj.path(), "utf8"));
  ok(/manolo-tiempos-2026-11-16\.json/.test(dj.suggestedFilename()) && json.actividades.correr && json.dias[HOY].seg.ejercicio === 2700, "Exportar JSON: actividades y días");
  const [dc] = await Promise.all([p.waitForEvent("download"), p.click('[data-tmp-exportar="csv"]')]);
  const csv = require("fs").readFileSync(await dc.path(), "utf8");
  ok(/^﻿fecha;actividad;id;segundos;minutos;automatico/.test(csv) && /2026-11-15;Leer 30 páginas;leer;1500;25,0;libros/.test(csv), "Exportar CSV (para Excel), con lo automático marcado");
  sinErrores(p);
  await p.context().close();
}

// ---------- Fase 7: plan de la mañana, estadísticas, experimentos, Mi día y Hábitos ----------
async function planStatsExp(browser, base, ancho, captura) {
  console.log(`\nMedir tiempos: plan de la mañana, estadísticas y experimentos (${ancho} px)`);
  const e = semilla(), S = e.__SEED__;
  // Un hábito de tipo Tiempo que se llena con la rutina de la mañana.
  S["users/test/habitos"] = { rutina: { v: 2, name: "Rutina de la mañana", emoji: "🌅", tipo: "tiempo", meta: 25, unidad: "min", days: [true, true, true, true, true, true, true],
    done: [], registros: {}, createdAt: Date.parse("2026-11-01T07:00:00-04:00"), inicio: "2026-11-01", orden: 1, dificultad: "media", freqType: "diario", timeOfDay: "manana",
    vinculo: "tiempos", vinculoCfg: { actividad: "manana" }, vinculoDesde: "2026-11-14" } };
  const p = await abrir(browser, base, e, { hash: "#tiempos", zona: ZONA, relojFalso: `${HOY}T06:00:00-04:00`, ancho, alto: 844 });
  consola(p);
  const avanzar = async ms => { await p.clock.fastForward(ms); await p.waitForTimeout(350); };
  await p.waitForTimeout(1000);

  // Plan de la mañana
  ok(/¿A qué hora te levantas/.test(await txt(p, "#tmp-plan")), "plan: pregunta a qué hora te levantas y a qué hora estar listo");
  await p.fill('#tmp-plan [name="levantarse"]', "05:30");
  await p.fill('#tmp-plan [name="listo"]', "08:00");
  await p.click('#tmp-plan [type="submit"]');
  await p.waitForTimeout(400);
  const aj = await ajustes(p);
  ok(aj.plan && aj.plan.levantarse === "5:30" && aj.plan.listo === "8:00", "se guarda tu plan");
  const linea = await p.$$eval("#tmp-plan .tpl-linea li", els => els.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  ok(/^5:30.*Rutina de la mañana/.test(linea[0]) && /Listo/.test(linea[linea.length - 1]), `la línea de tiempo empieza a las 5:30 (${linea[0]})`);
  ok(linea.some(x => /Ejercicio/.test(x)) && !linea.some(x => /Correr/.test(x)), "los lunes: con Ejercicio y sin Correr (lo que sueles hacer ese día)");
  ok(/Te (sobran|faltan)/.test(await txt(p, "#tmp-plan .tpl-veredicto")) && /Donde más se te va/.test(await txt(p, "#tmp-plan")), "dice si te sobra o te falta tiempo y dónde se te va más");
  await p.click('#tmp-plan [data-tpl-dow="6"]');
  await p.waitForTimeout(200);
  const sab = await txt(p, "#tmp-plan .tpl-linea");
  ok(/Correr/.test(sab) && !/Ejercicio/.test(sab), "los sábados: con Correr");
  await captura(p, `tiempos-plan-${ancho}.png`);
  await p.click('#tmp-plan [data-tpl="editar"]');
  await p.waitForTimeout(150);
  await p.fill('#tmp-plan [name="listo"]', "06:30");
  await p.click('#tmp-plan [type="submit"]');
  await p.waitForTimeout(400);
  ok(/Te faltan/.test(await txt(p, "#tmp-plan .tpl-veredicto")), "con poco tiempo: «Te faltan…»");
  await p.click('#tmp-plan [data-tpl="editar"]');
  await p.fill('#tmp-plan [name="listo"]', "08:00");
  await p.click('#tmp-plan [type="submit"]');
  await p.waitForTimeout(400);

  // Estadísticas
  const cifras = await txt(p, "#tmp-stats [data-tst-cifras]");
  ok(/Promedio.*Mediana.*Mejor.*Peor/.test(cifras), `estadísticas: promedio, mediana, mejor y peor (${cifras.slice(0, 80)})`);
  ok(/más rápido|más lento|Igual que el mes anterior/.test(await txt(p, "#tmp-stats .tst-tend")) && /Lunes a viernes: .* fin de semana: /.test(await txt(p, "#tmp-stats")), "tendencia y días de semana contra fin de semana");
  await p.click('#tmp-stats [data-tst-act="desayunar"]');
  await p.waitForTimeout(200);
  ok(await p.$eval('#tmp-stats [data-tst-act="desayunar"]', b => b.getAttribute("aria-pressed") === "true") && (await txt(p, "#tmp-stats [data-tst-cifras]")) !== cifras, "otra actividad, otros números");
  ok((await p.$$("#tmp-stats .tst-b")).length >= 20, "tu mañana por día (barras)");

  // Línea base y experimentos
  ok(/Línea base/.test(await txt(p, "#tmp-avance h2")) && /Línea base: /.test(await txt(p, '#tmp-avance [data-tmp-avance="manana"]')), "el promedio final ahora se llama «Línea base»");
  await p.click('#tmp-exp [data-tex="nuevo"]');
  await p.waitForTimeout(200);
  await p.fill('#tmp-exp [name="nombre"]', "Ropa lista la noche anterior");
  await p.fill('#tmp-exp [name="desde"]', "2026-11-01");
  await p.click('#tmp-exp [type="submit"]');
  await p.waitForTimeout(400);
  const exps = (await ajustes(p)).experimentos || {};
  const id = Object.keys(exps)[0];
  ok(id && exps[id].nombre === "Ropa lista la noche anterior" && exps[id].desde === "2026-11-01", "«Nuevo experimento» se guarda");
  const tarjeta = await txt(p, `#tmp-exp [data-tex-id="${id}"]`);
  ok(/en curso/.test(tarjeta) && /antes \d/.test(tarjeta) && /[−+±]\d+ %/.test(tarjeta) && /\d+\/30/.test(tarjeta), `compara con tu línea base (${tarjeta.slice(0, 120)})`);
  await captura(p, `tiempos-experimento-${ancho}.png`);
  await p.click(`#tmp-exp [data-tex-terminar="${id}"]`);
  await p.waitForTimeout(400);
  ok((await ajustes(p)).experimentos[id].hasta === HOY && /terminado/.test(await txt(p, `#tmp-exp [data-tex-id="${id}"]`)), "«Terminarlo hoy»");
  await p.click(`#tmp-exp [data-tex-quitar="${id}"]`);
  await p.waitForTimeout(400);
  ok(!((await ajustes(p)).experimentos || {})[id] && !(await p.$(`#tmp-exp [data-tex-id="${id}"]`)), "«Quitar» (tus tiempos no se borran)");

  // Mi mañana contra tu plan (te levantaste 5:30; son las 6:00)
  await p.click('#tmp-manana [data-tman="empezar"]');
  await p.waitForTimeout(400);
  ok(/Según tu plan: vas \d+ min atrasado/.test(await txt(p, ".tman-hoja .tman-plan")), `en vivo contra tu plan (${await txt(p, ".tman-hoja .tman-plan")})`);
  for (let i = 0; i < 6; i++) {
    await avanzar(10 * 60000);
    await p.click('.tman-hoja [data-tman="siguiente"]');
    await p.waitForTimeout(300);
  }
  ok(/Terminaste a las 7:0\d/.test(await txt(p, ".tman-hoja .tman-resumen")) && /antes de tu hora \(8:00\)/.test(await txt(p, ".tman-hoja .tman-resumen")), `al final, contra tu hora de estar listo (${(await txt(p, ".tman-hoja .tman-resumen")).slice(0, 80)})`);
  await p.click('.tman-hoja [data-tman="listo-manana"]');
  await p.waitForTimeout(500);

  // Hábitos: el de la rutina de la mañana se llena solo (Tiempo = minutos).
  const h = await p.evaluate(() => window.__fakeStore.colMap("users/test/habitos").get("rutina"));
  const r15 = h.registros["2026-11-15"], rHoy = h.registros[HOY];
  ok(r15 && r15.auto && r15.auto.f === "tiempos" && r15.v > 0, "Hábitos: «Rutina de la mañana» (Tiempo) se llena con Medir tiempos");
  ok(rHoy && rHoy.v === 10, `y hoy, con lo que mediste en Mi mañana (${rHoy && rHoy.v} min)`);

  // Mi día en Inicio: mi mañana (lista), el repaso y lo que toca hoy.
  await p.evaluate(() => { location.hash = "#inicio"; });
  await p.waitForTimeout(600);
  const md = await p.$$eval("#mi-dia .md-fila", els => els.map(x => x.dataset.md));
  ok(md.includes("manana") && /Mi mañana: lista/.test(await txt(p, '#mi-dia [data-md="manana"]')), `«Mi día»: tu mañana lista (${md.join(", ")})`);
  ok(md.length <= 5, "Mi día: como mucho 5 filas");
  ok(await sinDesborde(p), "no se mueve de lado");
  sinErrores(p);
  await p.context().close();
}

module.exports = { actividades, medirYManana, seLlenaSolo, planStatsExp };
