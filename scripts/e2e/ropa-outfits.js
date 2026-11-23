// Pruebas de pantalla de Ropa, fase 4: Outfits (D-149; docs/ROPA.md).
// "¿Qué me pongo?" con el clima de verdad de La Paz y de Santa Cruz (los
// pronósticos del 2026-11-23 de tests/fixtures/clima, servidos como si fuera
// Open-Meteo): capas y sol en La Paz, calor y lluvia en Santa Cruz; cambiar
// de ciudad (buscar; las recientes), cómo sientes el frío, hoy y mañana, la
// ocasión, 3 opciones solo con tu ropa (con reglas), "Me lo pongo", "Guardar",
// "Para mañana", "Otra opción", "No me gusta" (con Deshacer; llega otra) y
// "Otras opciones"; a qué inspiración se parece; tus ocasiones; lo de hoy,
// los guardados y el calendario; "¿Con qué combino esto?" desde la ficha; sin
// clima (sin internet); con la IA (un puente de mentira: lo que se le manda,
// lo que no sirve se descarta y si no puede, con reglas); la copia de
// seguridad; 390 y 320 px, claro y la compu.
// Uso: node scripts/e2e/ropa-outfits.js [carpeta-para-capturas]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";   // lunes, 9 de la mañana
const HOY = "2026-11-23", MANANA = "2026-11-24";
const COL = "users/test/ropa";
const FIX = path.join(__dirname, "../../tests/fixtures/clima");
const LA_PAZ = fs.readFileSync(path.join(FIX, "la-paz-2026-11-23.json"), "utf8");
const SANTA_CRUZ = fs.readFileSync(path.join(FIX, "santa-cruz-2026-11-23.json"), "utf8");
const BUSCAR = fs.readFileSync(path.join(FIX, "buscar-santa-cruz.json"), "utf8");
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const coleccion = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const ir = (p, h) => p.evaluate(x => { location.hash = x; }, h);
const opciones = p => p.$$eval(".rof-op", els => els.map(el => [...el.querySelectorAll(".rof-foto-a")].map(a => a.getAttribute("href").split("/")[1])));

// El clima de mentira (como Open-Meteo): por coordenadas, La Paz o Santa Cruz.
function climaFalso(o) {
  const est = Object.assign({ pedidos: [], buscados: [], caido: false }, o || {});
  est.rutas = async ctx => {
    await ctx.route(/api\.open-meteo\.com\/v1\/forecast/, r => {
      const u = new URL(r.request().url());
      est.pedidos.push({ lat: u.searchParams.get("latitude"), lon: u.searchParams.get("longitude"), tz: u.searchParams.get("timezone") });
      if (est.caido) return r.abort();
      const lat = Number(u.searchParams.get("latitude"));
      return r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: lat < -17 ? SANTA_CRUZ : LA_PAZ });
    });
    await ctx.route(/geocoding-api\.open-meteo\.com/, r => {
      est.buscados.push(new URL(r.request().url()).searchParams.get("name"));
      return r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: BUSCAR });
    });
  };
  return est;
}
// Miniaturas de verdad (una prenda de su color) hechas en la página.
function dibujo() {
  window.__mini = hex => new Promise(r => {
    const c = document.createElement("canvas"); c.width = 200; c.height = 200;
    const g = c.getContext("2d");
    g.fillStyle = "#ece6dc"; g.fillRect(0, 0, 200, 200);
    g.fillStyle = hex; g.beginPath();
    [[62, 40], [138, 40], [166, 76], [146, 88], [142, 176], [58, 176], [54, 88], [34, 76]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.fill();
    r(c.toDataURL("image/jpeg", 0.8));
  });
}
const abrir = (browser, base, estado, o) => abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA, init: dibujo }, o));
const P = [
  ["pol", "arriba", "Polera", "blanco", "#f4f4f2", { clima: ["templado", "calor"], formalidad: 2, estilo: ["casual"] }],
  ["cam", "arriba", "Camisa", "celeste", "#8fc3ea", { clima: ["templado"], formalidad: 3, estilo: ["clasico"] }],
  ["chompa", "arriba", "Chompa", "bordo", "#6e1f2c", { clima: ["frio"], formalidad: 2, estilo: ["casual"] }],
  ["polr", "arriba", "Polera", "rojo", "#c43a31", { clima: ["calor"], formalidad: 1 }],
  ["jean", "abajo", "Jean", "azul-jean", "#4f6f9a", { clima: ["frio", "templado"], formalidad: 2, estilo: ["casual", "urbano"], notas: "la favorita", precio: 300, talla: "32" }],
  ["chino", "abajo", "Pantalón de tela", "beige", "#d9c6a5", { clima: ["templado"], formalidad: 3, estilo: ["clasico"] }],
  ["short", "abajo", "Short", "azul-marino", "#1e2a44", { clima: ["calor"], formalidad: 1 }],
  ["zap", "zapatos", "Zapatillas", "blanco", "#f4f4f2", { formalidad: 2 }],
  ["bot", "zapatos", "Botines", "cafe-oscuro", "#3d2b1f", { clima: ["frio", "templado"], formalidad: 3 }],
  ["sand", "zapatos", "Sandalias", "cafe", "#6b4a32", { clima: ["calor"], formalidad: 1 }],
  ["cha", "abrigos", "Chamarra", "verde-oliva", "#6b7134", { clima: ["frio"], formalidad: 2 }],
  ["rompe", "abrigos", "Rompevientos", "negro", "#151515", { clima: ["templado"], formalidad: 1 }],
  ["lentes", "accesorios", "Lentes", "negro", "#151515", {}],
  ["gorra", "accesorios", "Gorra", "negro", "#151515", {}],
  ["sucia", "arriba", "Camisa", "blanco", "#f4f4f2", { clima: ["templado"], formalidad: 3, estado: "lavar" }]
];
async function semilla(browser, base) {
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio" });
  const minis = await p.evaluate(hs => Promise.all(hs.map(h => window.__mini(h))), P.map(x => x[4]).concat(["#6b7134"]));
  await p.context().close();
  const ropa = {};
  P.forEach(([id, grupo, tipo, color, , extra], k) => {
    ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estado: "activa", creado: k + 1, fotos: [{ id: `f-${id}`, mini: minis[k], ancho: 200, alto: 200 }] }, extra);
  });
  // Una inspiración de tu tablero, ya mirada por la IA: chamarra oliva, camisa celeste, jean y botines.
  const v = (grupo, tipo, color) => ({ grupo, tipo, colores: [color], estampado: "liso", tela: "", detalle: "" });
  const insp = { "pin-77": { v: 1, via: "tablero", creado: 1, pin: { id: "77", url: "https://www.pinterest.com/pin/77/", titulo: "Oliva y celeste", img: "", fecha: 1 },
    fotos: [{ id: "i77", mini: minis[P.length], ancho: 200, alto: 200 }], ia: { fecha: "2026-11-22" },
    analisis: { esRopa: true, resumen: "Chamarra oliva con camisa celeste", estilo: ["casual"], clima: ["frio"], formalidad: 2, ocasion: "salir",
      prendas: [v("abrigos", "Chamarra", "verde-oliva"), v("arriba", "Camisa", "celeste"), v("abajo", "Jean", "azul-jean"), v("zapatos", "Botines", "cafe")] } } };
  return { [COL]: ropa, "users/test/ropa_usos": { "2026-11-20": { prendas: ["pol", "chino", "zap"] } }, "users/test/ropa_inspiracion": insp };
}
const clave = o => o.filter(id => !["lentes", "gorra"].includes(id)).sort().join();

// ---------- Sin puente: con reglas ----------
async function conReglas(browser, base, seed) {
  console.log("\nOutfits con reglas (sin IA), con el clima de La Paz (390 px)");
  const cl = climaFalso();
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa", ancho: 390, rutas: cl.rutas });
  await p.waitForTimeout(500);
  ok(/Ropero.*Outfits.*Inspiración/.test(await txt(p, "#bottom-nav-links")) && await p.isVisible("#bottom-nav-links [data-ropa-mas]"), "la barra de Ropa: Ropero · Outfits · + · Inspiración");
  await p.click('#bottom-nav-links a[data-hash="ropa-outfits"]');
  await p.waitForSelector(".rof-clima-r", { timeout: 6000 }).catch(() => {});
  const c = cl.pedidos[0];
  ok(c && c.lat === "-16.5" && c.lon === "-68.15" && c.tz === "auto", "el clima de La Paz (por defecto), sin tu ubicación");
  const clima = await txt(p, ".rof-clima");
  ok(/La Paz/.test(clima) && /Lunes 23 de noviembre · 9 a 20 °C de sensación · Llovizna, 22 % de lluvia · UV 11/.test(clima), `el día (de 7 a 21 h): ${clima.slice(0, 120)}`);
  ok(/Capas: a la mañana se siente 9 °C y al mediodía 20 °C/.test(clima) && /Sol muy fuerte \(UV 11\)/.test(clima), "los consejos del día: capas y sol");
  ok(await p.$eval('.rof-dias [data-rof-dia="hoy"]', b => b.getAttribute("aria-checked") === "true"), "a las 9: hoy");
  ok(await p.$eval('input[name="rof-ocasion"][value="casual"]', i => i.checked) && /Con reglas, solo con tu ropa/.test(await txt(p, ".rof-con")), "Casual; con reglas (sin IA, gratis)");
  ok(await p.$eval('#bottom-nav-links a[data-hash="ropa-outfits"]', a => a.classList.contains("active")), "la barra marca Outfits");
  await p.waitForTimeout(700);   // el vidrio de la barra termina de deslizarse
  await captura(p, "outfits-390.png");
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 }).catch(() => {});
  let ops = await opciones(p);
  ok(ops.length === 3, "3 opciones");
  ok(ops.every(o => o.includes("cha") || o.includes("rompe")), "todas con abrigo para la mañana");
  ok(ops.every(o => !o.includes("sucia") && !o.includes("sand")), "nada para lavar ni sandalias a 9 °C");
  ok(ops.every(o => o.includes("lentes")), "lentes para el sol");
  ok(!ops[0].includes("pol") || !ops[0].includes("chino"), "no repite tal cual lo del viernes");
  ok(/Opción 1/.test(await txt(p, ".rof-op >> nth=0")) && /para la mañana fría/.test(await txt(p, ".rof-op >> nth=0")), "cada opción con su porqué");
  ok(/Se parece a tu inspiración «Oliva y celeste»/.test(await txt(p, ".rof-op >> nth=0 >> .rof-insp")) && await p.$eval(".rof-op >> nth=0 >> .rof-insp", a => a.getAttribute("href")) === "#ropa-pin/pin-77", `la primera se parece a tu inspiración (lleva al pin): ${ops[0]}`);
  ok(await p.$$eval('.rof-op [data-rof-op="otra"]', bs => bs.length) === 3, "cada opción con «Otra opción»");
  await p.waitForTimeout(300);
  await captura(p, "outfits-opciones-390.png");
  // Otra opción: cambia solo esa.
  await p.click('.rof-op >> nth=2 >> [data-rof-op="otra"]');
  await p.waitForTimeout(300);
  let nuevas = await opciones(p);
  ok(nuevas.length === 3 && clave(nuevas[0]) === clave(ops[0]) && clave(nuevas[1]) === clave(ops[1]) && clave(nuevas[2]) !== clave(ops[2]) && !nuevas.slice(0, 2).some(o => clave(o) === clave(nuevas[2])), "«Otra opción»: cambia solo esa (las otras quedan)");
  ops = nuevas;
  // No me gusta (con Deshacer): esa no vuelve y llega otra.
  const segunda = ops[1];
  await p.click('.rof-op >> nth=1 >> [data-rof-op="no"]');
  await p.waitForTimeout(400);
  let outs = Object.values(await coleccion(p, "users/test/ropa_outfits"));
  nuevas = await opciones(p);
  ok(outs.length === 1 && outs[0].gusto === "no" && outs[0].prendas.join() === segunda.join() && nuevas.length === 3 && !nuevas.some(o => clave(o) === clave(segunda)) && /No vuelve a salir/.test(await toast(p)), "«No me gusta»: se va, queda anotado y llega otra");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok(Object.keys(await coleccion(p, "users/test/ropa_outfits")).length === 0, "Deshacer lo borra");
  // Guardar la primera.
  ops = await opciones(p);
  await p.click('.rof-op >> nth=0 >> [data-rof-op="guardar"]');
  await p.waitForTimeout(400);
  outs = Object.values(await coleccion(p, "users/test/ropa_outfits"));
  ok(outs.length === 1 && outs[0].guardado === true && outs[0].gusto === "si" && outs[0].ciudad === "La Paz" && /9 a 20 °C/.test(outs[0].clima) && outs[0].origen === "reglas" && outs[0].inspiracionId === "pin-77", "«Guardar»: con la ciudad, el clima de ese día y la inspiración");
  ok(/Guardados \(1\)/.test(await txt(p, ".rof-guardados-s")), "aparece en Guardados");
  // Me lo pongo.
  await p.click('.rof-op >> nth=0 >> [data-rof-op="puse"]');
  await p.waitForTimeout(500);
  const usos = (await coleccion(p, "users/test/ropa_usos"))[HOY];
  ok(usos && ops[0].every(id => usos.prendas.includes(id)) && usos.outfitId, "«Me lo pongo»: anota todo en lo que te pusiste hoy");
  outs = await coleccion(p, "users/test/ropa_outfits");
  ok(Object.keys(outs).length === 1 && Object.values(outs)[0].puesto.includes(HOY), "el mismo outfit (no otro), con la fecha");
  ok(!(await p.$(".rof-op")) && /Hoy te pusiste/.test(await txt(p, ".rof-hoy")), "las opciones se van; arriba, lo de hoy");
  ok(await p.$('.rof-cal-d.tiene.es-hoy img'), "el calendario marca hoy (con una foto)");
  await captura(p, "outfits-hoy-390.png");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok(!((await coleccion(p, "users/test/ropa_usos"))[HOY] || {}).prendas?.length && Object.values(await coleccion(p, "users/test/ropa_outfits"))[0].puesto.length === 0, "Deshacer: ni anotado ni con la fecha (sigue guardado)");
  // Otras opciones: distintas a las que ya viste.
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 });
  ok(/Otras opciones/.test(await txt(p, ".rof-armar")), "con opciones, el botón de arriba dice «Otras opciones»");
  const antes = (await opciones(p)).map(clave);
  await p.click('.rof-otras');
  await p.waitForTimeout(500);
  const despues = (await opciones(p)).map(clave);
  ok(despues.length >= 1 && despues.every(k => !antes.includes(k)), "«Otras opciones»: ninguna repetida");
  // Mañana: el pronóstico de mañana (lluvia) y "Para mañana".
  await p.click('.rof-dias [data-rof-dia="manana"]');
  await p.waitForTimeout(300);
  ok(/Martes 24 de noviembre/.test(await txt(p, ".rof-clima")) && /Lluvia \(97 %\)/.test(await txt(p, ".rof-clima")), "mañana: martes, 97 % de lluvia");
  ok(!(await p.$(".rof-op")), "las opciones de hoy no se mezclan con las de mañana");
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 });
  ok(/Tus opciones para mañana/.test(await txt(p, ".rof-ops")) && /Para mañana/.test(await txt(p, '.rof-op >> nth=0 >> [data-rof-op="puse"]')), "las opciones dicen «Para mañana»");
  await p.click('.rof-op >> nth=0 >> [data-rof-op="puse"]');
  await p.waitForTimeout(400);
  ok(Object.values(await coleccion(p, "users/test/ropa_outfits")).some(o => o.para === MANANA && o.guardado) && /Para el martes 24/.test(await txt(p, ".rof-guardados")), "«Para mañana»: guardado para el martes");
  // Para el trabajo.
  await p.click('.rof-dias [data-rof-dia="hoy"]');
  await p.click('.rof-ocasion label:has(input[value="trabajo"])');
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 });
  ops = await opciones(p);
  ok(ops[0].includes("cam") && ops.some(o => o.includes("chino")) && !ops.some(o => o.includes("gorra")), `al trabajo: con camisa y el pantalón de tela; sin gorra (${ops.join(" / ")})`);
  // Una ocasión tuya: la iglesia, como un evento formal.
  await p.click('[data-rof="ocasion-nueva"]');
  await p.waitForSelector(".rof-hoja-ocasion [name=nombre]", { timeout: 4000 });
  await p.click('.rof-hoja-ocasion button[type="submit"]');
  await p.waitForTimeout(200);
  ok(/Ponle un nombre/.test(await txt(p, ".rof-hoja-ocasion [data-rof-oc-error]")), "sin nombre, no se guarda");
  await p.fill(".rof-hoja-ocasion [name=nombre]", "Iglesia");
  await p.click('.rof-hoja-ocasion label:has(input[value="formal"])');
  await captura(p, "outfits-ocasion-390.png");
  await p.click('.rof-hoja-ocasion button[type="submit"]');
  await p.waitForTimeout(500);
  const ocs = ((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).ocasiones || [];
  ok(ocs.length === 1 && ocs[0].nombre === "Iglesia" && ocs[0].como === "formal" && /^o-[a-z0-9]+$/.test(ocs[0].id), "queda guardada (con su id y como evento formal)");
  ok(await p.$eval(`input[name="rof-ocasion"][value="${ocs[0] && ocs[0].id}"]`, i => i.checked).catch(() => false) && !(await p.$(".rof-op")), "aparece entre las ocasiones, elegida");
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 });
  ops = await opciones(p);
  ok(ops[0].includes("cam") && ops[0].includes("chino") && ops[0].includes("bot") && !ops.some(o => o.includes("gorra")), `la iglesia se arma como un evento formal (${ops[0]})`);
  // Se quita en Ajustes (con Deshacer).
  await ir(p, "ropa-ajustes");
  await p.waitForTimeout(400);
  ok(/Tus ocasiones Iglesia como evento formal/.test(await txt(p, ".roa-clima")), "Ajustes: tus ocasiones");
  await p.click('.roa-clima [data-roa="oc-quitar"]');
  await p.waitForTimeout(300);
  ok(!(((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).ocasiones || []).length && /Quitaste «Iglesia»/.test(await toast(p)), "«Quitar» la saca");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(300);
  ok((((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).ocasiones || []).length === 1, "Deshacer la vuelve a poner");
  await ir(p, "ropa-outfits");
  await p.waitForTimeout(400);
  // El calendario: el viernes.
  await p.click('[data-rof-cal="2026-11-20"]');
  await p.waitForTimeout(400);
  ok(/Viernes 20 de noviembre/.test(await txt(p, ".rof-hoja-dia")) && /Polera blanca · Pantalón de tela beige · Zapatillas blancas/.test(await txt(p, ".rof-hoja-dia")), "el calendario: lo que te pusiste el viernes");
  await p.keyboard.press("Escape");
  await p.click('[data-rof-mes="-1"]');
  await p.waitForTimeout(200);
  ok(/Octubre 2026/.test(await txt(p, ".rof-cal")) && /todavía no anotaste/.test(await txt(p, ".rof-cal")), "el mes anterior");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- Otra ciudad y cómo sientes el frío ----------
async function otraCiudad(browser, base, seed) {
  console.log("\nOtra ciudad (Santa Cruz: calor y lluvia) y cómo sientes el frío");
  const cl = climaFalso();
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-outfits", ancho: 390, rutas: cl.rutas });
  await p.waitForSelector(".rof-clima-r", { timeout: 6000 }).catch(() => {});
  await p.click('[data-rof="ciudad"]');
  await p.waitForSelector(".rof-hoja-ciudad [name=q]", { timeout: 4000 });
  ok(/nunca usa tu ubicación/.test(await txt(p, ".rof-hoja-ciudad")), "la ciudad la eliges tú (nunca tu ubicación)");
  await p.fill(".rof-hoja-ciudad [name=q]", "Santa Cruz");
  await p.waitForSelector('.rof-hoja-ciudad [data-rof-c="b:0"]', { timeout: 4000 });
  ok(/Santa Cruz de la Sierra Departamento de Santa Cruz, Bolivia/.test(await txt(p, '.rof-hoja-ciudad [data-rof-c="b:0"]')), "buscar: las de Bolivia primero");
  ok(cl.buscados.includes("Santa Cruz"), "le pregunta al buscador de Open-Meteo (solo el nombre)");
  await captura(p, "outfits-ciudad-390.png");
  await p.click('.rof-hoja-ciudad [data-rof-c="b:0"]');
  await p.waitForFunction(() => /Santa Cruz de la Sierra/.test((document.querySelector(".rof-clima") || {}).innerText || "") && /Calor/.test(document.querySelector(".rof-clima").innerText), null, { timeout: 6000 }).catch(() => {});
  const meta = ((await coleccion(p, "users/test/meta")).ropa_ajustes) || {};
  ok(meta.ciudad && meta.ciudad.nombre === "Santa Cruz de la Sierra" && meta.ciudad.lat === -17.79 && meta.ciudades.length === 1, "guarda la ciudad (y la anota en las recientes)");
  ok(cl.pedidos.some(x => x.lat === "-17.79"), "pide el clima de Santa Cruz");
  ok(/Calor \(se siente hasta 30 °C\)/.test(await txt(p, ".rof-clima")) && /Lluvia \(55 %\)/.test(await txt(p, ".rof-clima")), "calor y lluvia");
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 });
  const ops = await opciones(p);
  ok(ops.every(o => !o.includes("cha") && !o.includes("chompa")), "con calor: sin chamarra ni chompa");
  ok(ops[0].includes("short") && !ops[0].includes("sand"), `liviano y, con lluvia, zapatos cerrados (${ops[0]})`);
  await p.waitForTimeout(900);   // que termine de deslizarse a las opciones
  await captura(p, "outfits-santa-cruz-390.png");
  // Volver a La Paz desde las recientes.
  await p.click('[data-rof="ciudad"]');
  await p.waitForSelector(".rof-hoja-ciudad", { timeout: 4000 });
  ok(/Las que usaste Santa Cruz de la Sierra/.test(await txt(p, ".rof-hoja-ciudad")) && /Por defecto La Paz/.test(await txt(p, ".rof-hoja-ciudad")), "las recientes a un toque (y La Paz)");
  await p.click('.rof-hoja-ciudad [data-rof-c="lp:0"]');
  await p.waitForFunction(() => /La Paz/.test((document.querySelector(".rof-clima h2") || {}).innerText || ""), null, { timeout: 6000 }).catch(() => {});
  ok(/La Paz/.test(await txt(p, ".rof-clima h2")) && (((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).ciudades || []).length === 2, "de vuelta a La Paz");
  // Ajustes: friolento.
  await ir(p, "ropa-ajustes");
  await p.waitForTimeout(400);
  ok(/Tus outfits/.test(await txt(p, "#roa-app")) && /Ciudad: La Paz/.test(await txt(p, ".roa-clima")) && /Agrega las tuyas/.test(await txt(p, ".roa-clima")), "Ajustes: la ciudad, cómo sientes el frío y tus ocasiones");
  await p.click('.roa-clima label:has(input[value="friolento"])');
  await p.waitForTimeout(400);
  ok(((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).sensacion === "friolento", "«Friolento» queda guardado");
  await captura(p, "outfits-ajustes-390.png");
  await ir(p, "ropa-outfits");
  await p.waitForTimeout(500);
  ok(/Ajustado a que eres friolento/.test(await txt(p, ".rof-clima")), "Outfits lo dice");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- ¿Con qué combino esto? y sin clima ----------
async function combinar(browser, base, seed) {
  console.log("\n¿Con qué combino esto? y sin clima");
  const cl = climaFalso();
  let p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-prenda/jean", ancho: 390, rutas: cl.rutas });
  await p.waitForTimeout(600);
  ok(await p.isVisible('#rop-app a[href="#ropa-outfits/con/jean"]'), "la ficha: «¿Con qué combino esto?»");
  await p.click('#rop-app a[href="#ropa-outfits/con/jean"]');
  await p.waitForSelector(".rof-op", { timeout: 6000 }).catch(() => {});
  ok(/Combinando con Jean azul/.test(await txt(p, ".rof-base")), "dice con qué prenda");
  const ops = await opciones(p);
  ok(ops.length === 3 && ops.every(o => o.includes("jean")), "arma solo: el jean va en las tres");
  await p.waitForTimeout(900);   // que termine de deslizarse a las opciones
  await captura(p, "outfits-con-jean-390.png");
  await p.click(".rof-base-x");
  await p.waitForTimeout(400);
  ok(!(await p.$(".rof-base")) && !(await p.$(".rof-op")), "la ✕ vuelve a lo de siempre");
  await p.context().close();
  // Una prenda para lavar: la ficha no ofrece combinar.
  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-prenda/sucia", ancho: 390, rutas: cl.rutas });
  await p.waitForTimeout(500);
  ok(!(await p.$('#rop-app a[href^="#ropa-outfits/con/"]')), "si está para lavar, no se ofrece");
  await p.context().close();
  // Sin clima (sin internet y nada guardado): igual arma.
  const caido = climaFalso({ caido: true });
  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-outfits", ancho: 390, rutas: caido.rutas });
  await p.waitForTimeout(900);
  ok(/No pude traer el clima/.test(await txt(p, ".rof-clima")) && await p.$('[data-rof="reclima"]'), "sin clima: lo dice, con «Reintentar»");
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 }).catch(() => {});
  ok((await opciones(p)).length === 3, "y arma igual (como un día templado)");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  // Con el clima de hace un rato (menos de una hora): al entrar ya está, sin pedirlo de nuevo.
  const guardado = climaFalso();
  const reciente = { k: "-16.5,-68.15", hora: Date.parse(FECHA) - 600e3, json: JSON.parse(LA_PAZ) };
  p = await abrir(browser, base, { __SEED__: seed, "manolo.ropa.clima": reciente }, { hash: "#ropa", ancho: 390, rutas: guardado.rutas });
  await ir(p, "inicio");   // con tu ropa ya cargada: al entrar no llega nada nuevo que repinte
  await p.waitForTimeout(300);
  await ir(p, "ropa-outfits");
  await p.waitForTimeout(400);
  ok(/Lunes 23 de noviembre/.test(await txt(p, ".rof-clima-r")) && !guardado.pedidos.length, "con el clima de hace 10 minutos: al toque, sin volver a pedirlo");
  await p.context().close();
}

// ---------- Con la IA (un puente de mentira) ----------
function puenteFalso(o) {
  const est = Object.assign({ version: 3, lista: true, pedidos: [], fallo: null, respuesta: null }, o || {});
  est.de = r => est.pedidos.filter(x => x.ruta === r);
  est.rutas = async ctx => {
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
      est.pedidos.push({ ruta, cuerpo });
      const json = (s, c) => route.fulfill({ status: s, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      if (ruta === "/quien") return json(200, { permitido: true, uid: "test", lista: est.lista, version: est.version, gasto: { mes: "2026-11", usd: 0.5, veces: 10, tope: 8 } });
      if (ruta === "/outfits") {
        await new Promise(r => setTimeout(r, 150));
        if (est.fallo) return json(est.fallo[0], est.fallo[1]);
        return json(200, Object.assign({ gasto: { mes: "2026-11", usd: 0.55, veces: 11, tope: 8 } }, est.respuesta));
      }
      return json(404, { error: "ruta" });
    });
  };
  return est;
}
async function conIA(browser, base, seed) {
  console.log("\nOutfits con la IA (un puente de mentira)");
  const cl = climaFalso();
  const est = puenteFalso({ respuesta: { outfits: [
    { nombre: "Capas en verde y blanco", prendas: ["cha", "pol", "jean", "bot"], porque: "La chamarra oliva abriga a la mañana; la polera blanca es fresca al mediodía.", capas: "Chamarra a la mañana; al mediodía, en la mochila." },
    { nombre: "Sin zapatos", prendas: ["cam", "chino"], porque: "", capas: "" },
    { nombre: "Oficina relajada", prendas: ["rompe", "cam", "chino", "zap"], porque: "Celeste y beige, tranquilo.", capas: "" },
    { nombre: "Bordó y oliva", prendas: ["cha", "chompa", "jean", "zap"], porque: "La chompa bordó con la chamarra oliva.", capas: "" },
    { nombre: "Por si sale el sol", prendas: ["rompe", "polr", "short", "zap"], porque: "Para el mediodía.", capas: "" }
  ], nota: "Para la lluvia de mañana te vendría bien algo impermeable." } });
  const rutas = async ctx => { await cl.rutas(ctx); await est.rutas(ctx); };
  const meta = { ropa_ajustes: { estilo: { resumen: "Neutros con un toque de color.", fecha: HOY, pines: 3 }, ocasiones: [{ id: "o-u1", nombre: "Universidad", como: "casual" }] } };
  const p = await abrir(browser, base, { __SEED__: Object.assign({}, seed, { "users/test/meta": meta }), "manolo.puente": PUENTE, "manolo.ropa.ocasion": JSON.stringify("o-u1") }, { hash: "#ropa-outfits", ancho: 390, rutas });
  await p.waitForSelector(".rof-clima-r", { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(400);
  ok(/Con la IA, solo con tu ropa/.test(await txt(p, ".rof-con")), "con la IA conectada lo dice");
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 6000 }).catch(() => {});
  const pe = est.de("/outfits")[0];
  const c = pe && pe.cuerpo;
  ok(c && c.ropero.length === 14 && !c.ropero.some(x => x.id === "sucia") && c.ropero.every(x => !("notas" in x) && !("precio" in x) && !("talla" in x) && !("fotos" in x)), "a la IA: tu ropero sin lo de lavar, ni notas, precio, talla o fotos");
  ok(c && /^En La Paz \(Bolivia\): sensación de 9 a 20 °C/.test(c.clima) && c.necesidades.capas === true && c.ocasion === "Universidad (como casual)" && c.estilo === "Neutros con un toque de color.", "el clima, lo que pide el día, tu ocasión (con la de base) y tu estilo");
  ok(c && c.recientes.slice().sort().join() === "chino,pol,zap" && c.base === null, "lo que te pusiste estos días (lo del viernes) y sin prenda base");
  let ops = await opciones(p);
  ok(ops.length === 3 && ops[0].join() === "cha,pol,jean,bot" && !ops.some(o => o.join() === "cam,chino"), "se ven 3; lo que no se puede poner (sin zapatos) se descarta");
  ok(/IA/.test(await txt(p, ".rof-op .rof-ia")) && /Capas en verde y blanco/.test(await txt(p, ".rof-op >> nth=0")) && /en la mochila/.test(await txt(p, ".rof-op >> nth=0")), "con el nombre, el porqué y las capas de la IA");
  ok(/algo impermeable/.test(await txt(p, ".rof-ops .rin-consejo")), "y su nota");
  await p.waitForTimeout(900);   // que termine de deslizarse a las opciones
  await captura(p, "outfits-ia-390.png");
  // Otra opción: primero la que la IA dejó de reserva (sin volver a preguntarle); después, con reglas.
  await p.click('.rof-op >> nth=1 >> [data-rof-op="otra"]');
  await p.waitForTimeout(300);
  ops = await opciones(p);
  ok(ops[1].join() === "rompe,polr,short,zap" && /Por si sale el sol/.test(await txt(p, ".rof-op >> nth=1")) && /IA/.test(await txt(p, ".rof-op >> nth=1 >> .rof-ia")) && est.de("/outfits").length === 1, "«Otra opción»: la de reserva de la IA, sin volver a preguntarle");
  await p.click('.rof-op >> nth=1 >> [data-rof-op="otra"]');
  await p.waitForTimeout(300);
  ops = await opciones(p);
  ok(ops.length === 3 && !(await p.$(".rof-op >> nth=1 >> .rof-ia")) && ops[1].join() !== "rompe,polr,short,zap" && est.de("/outfits").length === 1, "sin reserva: con reglas (gratis)");
  // La IA no puede (tope): con reglas.
  est.fallo = [402, { error: "tope", mensaje: "Llegaste al tope del mes (US$ 8)." }];
  await p.click('[data-rof="otras"]');
  await p.waitForTimeout(800);
  ok(/tope del mes/.test(await toast(p)) && /Estas son con reglas/.test(await toast(p)) && (await opciones(p)).length === 3, "si la IA no puede: lo dice y salen con reglas");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  // Un puente viejo (versión 2): con reglas, sin preguntarle.
  const viejo = puenteFalso({ version: 2 });
  const q = await abrir(browser, base, { __SEED__: seed, "manolo.puente": PUENTE }, { hash: "#ropa-outfits", ancho: 390, rutas: async ctx => { await cl.rutas(ctx); await viejo.rutas(ctx); } });
  await q.waitForTimeout(700);
  await q.click('[data-rof="armar"]');
  await q.waitForSelector(".rof-op", { timeout: 5000 }).catch(() => {});
  ok(!viejo.de("/outfits").length && (await opciones(q)).length === 3, "con un puente sin outfits: con reglas");
  await q.context().close();
}

// ---------- 320, claro, la compu y la copia ----------
async function otras(browser, base, seed) {
  console.log("\n320 px, claro, la compu y la copia de seguridad");
  const cl = climaFalso();
  let p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-outfits", ancho: 320, rutas: cl.rutas });
  await p.waitForSelector(".rof-clima-r", { timeout: 6000 }).catch(() => {});
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 }).catch(() => {});
  ok(await sobra(p) <= 0, "320 px: nada se sale a lo ancho");
  await p.waitForTimeout(900);   // que termine de deslizarse a las opciones
  await captura(p, "outfits-320.png");
  await p.context().close();
  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-outfits", ancho: 390, rutas: cl.rutas, esquema: "light" });
  await p.waitForSelector(".rof-clima-r", { timeout: 6000 }).catch(() => {});
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(900);   // que termine de deslizarse a las opciones
  await captura(p, "outfits-claro-390.png");
  ok(!p.errores.length, `en claro, sin errores${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-outfits", ancho: 1280, alto: 900, rutas: cl.rutas });
  await p.waitForSelector(".rof-clima-r", { timeout: 6000 }).catch(() => {});
  const pills = await txt(p, "#panel-ropa-outfits .fin-outer-tabs");
  ok(/Ropero/.test(pills) && /Outfits/.test(pills) && /\+ Agregar/.test(pills) && /Inspiración/.test(pills), `la compu: ${pills}`);
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  await captura(p, "outfits-1280.png");
  // Guardar uno y la copia lo lleva.
  await p.click('[data-rof="armar"]');
  await p.waitForSelector(".rof-op", { timeout: 5000 });
  await p.click('.rof-op >> nth=0 >> [data-rof-op="guardar"]');
  await p.waitForTimeout(400);
  const [id] = Object.keys(await coleccion(p, "users/test/ropa_outfits"));
  await ir(p, "inicio");
  await p.waitForTimeout(300);
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
  await p.click('[data-rsp="preparar"]');
  await p.waitForSelector('[data-rsp="guardar"]', { timeout: 8000 });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-rsp="guardar"]')]);
  const archivo = path.join(os.tmpdir(), `outfits-copia-${process.pid}.json`);
  await dl.saveAs(archivo);
  const copia = JSON.parse(fs.readFileSync(archivo, "utf8"));
  ok(id && copia.colecciones.ropa_outfits && copia.colecciones.ropa_outfits[id] && copia.colecciones.ropa_outfits[id].guardado === true, "la copia de seguridad lleva tus outfits");
  fs.unlinkSync(archivo);
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const seed = await semilla(browser, base);
  await conReglas(browser, base, seed);
  await otraCiudad(browser, base, seed);
  await combinar(browser, base, seed);
  await conIA(browser, base, seed);
  await otras(browser, base, seed);
  await terminar(browser, srv);
})();
