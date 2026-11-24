// Pruebas de pantalla de Ropa, nivel 2, fase 3 (D-158; docs/ROPA_ESTILISTA.md):
// hablar con tu estilista, con un puente de mentira (versión 5).
// (1) En Outfits, "Pídelo con tus palabras" abre una conversación nueva; lo
// que va al puente (tu ropa con lo que está para lavar, sin lo que ya no
// tienes ni tus notas; el clima de hoy y de mañana; lo que recuerda de ti; tu
// presupuesto; lo hablado antes). (2) La respuesta: los outfits revisados (el
// que no se puede poner no se muestra), "Te falta" con "A mi lista", "Lo
// recordé" con "Olvidar"; Guardar, Me lo pongo, No me gusta (con Deshacer),
// Ver en grande, Cambiar una prenda y Otra opción. (3) Un error del puente y
// "Volver a preguntar". (4) Tus conversaciones (nueva, abrir, borrar con
// Deshacer), los ejemplos (se escriben, no se mandan), Enter manda, el
// borrador queda. (5) Lo que recuerda de ti (agregar, sin repetir, borrar) y
// en Ajustes de Ropa. (6) Una conversación llena empieza otra. (7) Sin
// internet y quien no es el dueño. (8) A 320 px en oscuro y en claro.
// Uso: node scripts/e2e/ropa-estilista.js [carpeta-para-capturas]
const fs = require("node:fs");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";   // lunes: a la mañana hace frío y al mediodía sube
const HOY = "2026-11-23";
const CLIMA = JSON.parse(fs.readFileSync(path.join(__dirname, "../../tests/fixtures/clima/la-paz-2026-11-23.json"), "utf8"));
const CLIMA_GUARDADO = JSON.stringify({ k: "-16.5,-68.15", hora: Date.parse(FECHA), json: CLIMA });
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const col = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const charlas = p => col(p, "users/test/ropa_charlas");
const outfits = p => col(p, "users/test/ropa_outfits");
const ajustes = async p => (await col(p, "users/test/meta")).ropa_ajustes || {};
const memoria = async p => ((await ajustes(p)).memoria || []).map(m => m.texto);
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const deshacer = async p => { await p.click("#ro-toast .undo-toast-btn"); await p.waitForTimeout(400); };
const sinErrores = p => ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
const clave = ids => [...ids].sort().join("|");
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };

// ---------- Tu ropa (con fotos de mentira) ----------
const FORMAS = {
  polera: "M28 22h13q9 7 18 0h13l15 13-9 11-7-5v43H29V41l-7 5-9-11Z", chompa: "M30 20h40l10 8 7 46-9 2-6-34v46H28V42l-6 34-9-2 7-46Z",
  chamarra: "M30 18h40l11 9 7 47-9 2-7-33v45H28V43l-7 33-9-2 7-47Z", pantalon: "M31 12h38l5 77H56l-6-52-6 52H26Z",
  zapatos: "M12 60q12-2 22-15l10 6q14 9 36 11 9 1 9 12v5H12Z"
};
const svg = (forma, hex) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="#ebe6dc"/><path transform="translate(-5 10)" d="${FORMAS[forma]}" fill="${hex}"/></svg>`);
const DIA = f => Date.parse(`${f}T12:00:00Z`);
const CAPAS = ["cha", "cho", "pol", "jean", "zap"], FORMAL = ["cha", "cho", "cam", "tela", "zn"];
// Una conversación ya guardada (con un outfit, lo que falta y lo que recordó).
const CHARLA_VIEJA = {
  v: 1, titulo: "Para el sábado", creado: DIA("2026-11-20"), editado: DIA("2026-11-20"),
  mensajes: [
    { de: "yo", texto: "Para el sábado, algo cómodo", fecha: DIA("2026-11-20") },
    { de: "ia", texto: "Te propongo esto:", outfits: [{ prendas: CAPAS, nombre: "Sábado tranquilo", porque: "Cómodo y abrigado.", capas: "" }],
      faltan: [{ grupo: "abajo", tipo: "Chino", color: "beige", porque: "Para aclarar tus outfits." }], recordo: ["Prefiere colores oscuros"], fecha: DIA("2026-11-20") + 1 }
  ]
};
function semilla(extra) {
  const ropa = {};
  [["pol", "arriba", "Polera", "blanco", "#f4f4f2", "polera", {}], ["cam", "arriba", "Camisa", "celeste", "#8fc3ea", "polera", { formalidad: 3 }],
   ["cho", "arriba", "Chompa", "bordo", "#6e1f2c", "chompa", { clima: ["frio"] }], ["sucia", "arriba", "Polera", "negro", "#151515", "polera", { estado: "lavar" }],
   ["vieja", "arriba", "Camisa", "gris", "#888888", "polera", { estado: "fuera" }],
   ["jean", "abajo", "Jean", "azul-jean", "#4f6f9a", "pantalon", { formalidad: 2, notas: "secreta" }], ["tela", "abajo", "Pantalón de tela", "negro", "#1b1b1b", "pantalon", { formalidad: 5 }],
   ["cha", "abrigos", "Chamarra", "verde-oliva", "#6b7134", "chamarra", { clima: ["frio"] }],
   ["zap", "zapatos", "Zapatillas", "blanco", "#f4f4f2", "zapatos", { formalidad: 1 }], ["zn", "zapatos", "Zapatos", "negro", "#151515", "zapatos", { formalidad: 4 }]]
    .forEach(([id, grupo, tipo, color, hex, forma, x], k) => {
      ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estampado: "liso", tela: "", estilo: ["casual"], clima: ["templado"], formalidad: null, marca: "", notas: "",
        fotos: [{ id: `f-${id}`, mini: svg(forma, hex), ancho: 900, alto: 1200 }], estado: "activa", creado: DIA("2026-10-01") + k }, x);
    });
  const usos = { [HOY]: { prendas: ["cam", "jean", "zn"], actualizado: DIA(HOY) }, "2026-11-20": { prendas: ["pol", "jean", "zap"], actualizado: DIA("2026-11-20") } };
  const meta = { ropa_ajustes: { ciudad: { nombre: "La Paz", lat: -16.5, lon: -68.15 }, presupuestoMes: 500, memoria: [{ id: "m1", texto: "Prefiere colores oscuros", fecha: 1 }] } };
  const outs = { o1: { v: 1, prendas: ["pol", "jean", "zap"], nombre: "De siempre", origen: "reglas", gusto: "si", guardado: true, puesto: ["2026-11-20"], creado: DIA("2026-11-01") } };
  return Object.assign({ "users/test/ropa": ropa, "users/test/ropa_usos": usos, "users/test/meta": meta, "users/test/ropa_outfits": outs, "users/test/ropa_charlas": {} }, extra || {});
}

// ---------- Un puente de mentira (versión 5) ----------
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
function puenteFalso(o) {
  const est = Object.assign({ permitido: true, lista: true, version: 5, gasto: { mes: "2026-11", usd: 0.12, veces: 3, tope: 8 }, demora: 300, respuestas: [], fallo: null, pedidos: [] }, o || {});
  est.charlas = () => est.pedidos.filter(x => x.ruta === "/charla");
  est.rutas = async ctx => {
    await ctx.route(/open-meteo\.com/, r => r.abort());
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
      est.pedidos.push({ ruta, auth: req.headers().authorization, cuerpo });
      const json = (status, c) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      if (ruta === "/quien") return json(200, { permitido: est.permitido, uid: "test", lista: est.lista, gasto: est.gasto, version: est.version });
      if (ruta === "/charla") {
        await new Promise(r => setTimeout(r, est.demora));
        if (est.fallo) { const f = est.fallo; est.fallo = null; return json(f[0], f[1]); }
        est.gasto = Object.assign({}, est.gasto, { usd: Math.round((est.gasto.usd + 0.04) * 100) / 100, veces: est.gasto.veces + 1 });
        return json(200, Object.assign({ respuesta: "Listo.", outfits: [], faltan: [], recordar: [] }, est.respuestas.shift() || {}, { gasto: est.gasto }));
      }
      return json(404, { error: "ruta" });
    });
  };
  return est;
}
const FRIO = {
  respuesta: "Con 9° a la mañana, va así:",
  outfits: [
    { nombre: "Capas abrigadas", prendas: CAPAS, porque: "La chompa bordo con la chamarra oliva abriga sin pesar.", capas: "Al mediodía sube a 20°: la chamarra, para la mañana." },
    { nombre: "Más formal", prendas: FORMAL, porque: "Camisa y pantalón de tela, con capas.", capas: "" },
    { nombre: "No se puede", prendas: ["cho", "zap"], porque: "", capas: "" }
  ],
  faltan: [{ grupo: "zapatos", tipo: "Botines", color: "cafe", porque: "Para el frío y la lluvia." }],
  recordar: ["Es friolento"]
};
async function abrir(browser, base, o) {
  const x = o || {};
  const estado = Object.assign({ __SEED__: semilla(x.seed), "manolo.ropa.clima": CLIMA_GUARDADO }, x.puente ? { "manolo.puente": PUENTE } : {}, x.estado || {});
  const p = await abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA, ancho: 390, rutas: x.puente ? x.puente.rutas : async ctx => { await ctx.route(/open-meteo\.com/, r => r.abort()); } }, x));
  for (let k = 0; k < 30 && !(await p.$eval("body", b => getComputedStyle(b).display).catch(() => "")); k++) await p.waitForTimeout(100);
  if (x.puente) await p.waitForFunction(() => window.RopaIA && window.RopaIA.estado(), null, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(500);
  return p;
}
const mensajes = p => p.$$eval("#roe-app .roe-m:not(.is-pensando)", ms => ms.map(m => ({ de: m.classList.contains("is-yo") ? "yo" : "ia", texto: m.innerText.replace(/\s+/g, " ").trim(), ops: m.querySelectorAll(".roe-op").length })));
// Espera la respuesta número n de tu estilista.
async function esperarIA(p, n) {
  await p.waitForFunction(k => document.querySelectorAll("#roe-app .roe-m.is-ia:not(.is-pensando)").length >= k && !document.querySelector("#roe-app .is-pensando"), n, { timeout: 6000 });
  await p.waitForTimeout(300);
}
async function escribir(p, t) { await p.fill("#roe-texto", t); await p.click("#roe-enviar"); }

// ---------- (1) y (2): desde Outfits, la conversación y lo que haces con cada outfit ----------
async function conversar(browser, base) {
  console.log("\nHablar con tu estilista (390 px)");
  const pf = puenteFalso({ respuestas: [FRIO] });
  const p = await abrir(browser, base, { hash: "#ropa-outfits", puente: pf });
  ok(await p.$("#rof-app .roe-pide #rof-pide"), "en Outfits, arriba: «Pídelo con tus palabras»");
  await p.fill("#rof-pide", "Hace frío: una chompa y una chamarra encima");
  await p.click("#rof-app .roe-pide button[type=submit]");
  await p.waitForTimeout(150);
  ok(await p.evaluate(() => location.hash === "#ropa-estilista"), "abre tu estilista");
  ok(/Pensando/.test(await txt(p, "#roe-app .is-pensando")), "mientras tanto: «Pensando…»");
  await esperarIA(p, 1);
  const ms = await mensajes(p);
  ok(ms.length === 2 && ms[0].de === "yo" && ms[0].texto === "Hace frío: una chompa y una chamarra encima", "tu mensaje, a la derecha");
  ok(ms[1].de === "ia" && /Con 9° a la mañana/.test(ms[1].texto) && ms[1].ops === 2, "la respuesta, con 2 outfits (el que no se puede poner no se muestra)");
  ok(/Una opción no se podía poner/.test(ms[1].texto), "y lo dice");
  // Lo que fue al puente.
  const c1 = pf.charlas()[0];
  ok(c1 && /^Bearer /.test(c1.auth), "al puente, con tu sesión");
  const ids = c1.cuerpo.ropero.map(x => x.id);
  ok(c1.cuerpo.mensaje === "Hace frío: una chompa y una chamarra encima" && c1.cuerpo.historial.length === 0, "tu mensaje, en una conversación nueva");
  ok(ids.includes("sucia") && c1.cuerpo.ropero.find(x => x.id === "sucia").lavar === true && c1.cuerpo.ropero.find(x => x.id === "pol").lavar === false, "tu ropa, con lo que está para lavar marcado");
  ok(!ids.includes("vieja") && !JSON.stringify(c1.cuerpo).includes("secreta"), "sin lo que ya no tienes ni tus notas");
  ok(/^Hoy \(lunes 23 de noviembre\): En La Paz/.test(c1.cuerpo.clima) && /\nMañana \(martes 24 de noviembre\): /.test(c1.cuerpo.clima), "el clima de hoy y de mañana");
  ok(c1.cuerpo.memoria.join() === "Prefiere colores oscuros" && /^Este mes me quedan Bs 500 de Bs 500 para ropa\.$/.test(c1.cuerpo.presupuesto), "lo que recuerda de ti y tu presupuesto");
  ok(c1.cuerpo.recientes.includes("cam") && c1.cuerpo.gustan.some(x => clave(x) === clave(["pol", "jean", "zap"])), "lo que te pusiste hace poco y lo que te gustó");
  // Guardado en la nube.
  const cs = Object.values(await charlas(p));
  ok(cs.length === 1 && cs[0].titulo === "Hace frío: una chompa y una chamarra encima" && cs[0].mensajes.length === 2, "la conversación queda guardada (con su título)");
  ok(cs[0].mensajes[1].outfits.map(o => clave(o.prendas)).join() === [clave(CAPAS), clave(FORMAL)].join() && cs[0].mensajes[1].sinMostrar === 1, "con los outfits que se ven");
  ok(await p.evaluate(() => localStorage.getItem("manolo.ropa.charla")) === Object.keys(await charlas(p))[0], "y queda abierta");
  // Lo que recordó y lo que falta.
  ok((await memoria(p)).join() === "Prefiere colores oscuros,Es friolento", "recordó que eres friolento (se suma a lo que sabe)");
  ok(/Lo recordé: es friolento/.test(await txt(p, "#roe-app .roe-recordo")), "«Lo recordé: es friolento»");
  ok(/Te falta: Botines/.test(await txt(p, "#roe-app .roe-falta")), "«Te falta: Botines…»");
  await p.click("#roe-app [data-roe-f]");
  await p.waitForTimeout(500);
  const deseos = Object.values(await col(p, "users/test/ropa_deseos"));
  ok(deseos.length === 1 && deseos[0].tipo === "Botines" && deseos[0].colores.join() === "cafe" && deseos[0].origen === "estilista" && /lluvia/.test(deseos[0].nota), "«A mi lista»: a tu lista de deseos (de tu estilista)");
  ok(/En tu lista de deseos/.test(await txt(p, "#roe-app .roe-falta")), "y ya dice que está en tu lista");
  // Olvidar (con Deshacer).
  await p.click("#roe-app [data-roe-r]");
  await p.waitForTimeout(400);
  ok((await memoria(p)).join() === "Prefiere colores oscuros" && !(await p.$("#roe-app .roe-recordo")), "«Olvidar»: ya no lo recuerda");
  await deshacer(p);
  ok((await memoria(p)).join() === "Prefiere colores oscuros,Es friolento", "Deshacer: lo vuelve a recordar");
  // Guardar, No me gusta y Me lo pongo (con Deshacer).
  await p.click('#roe-app .roe-op:nth-child(1) [data-roe-o="guardar"]');
  await p.waitForTimeout(500);
  let o = Object.values(await outfits(p)).find(x => clave(x.prendas) === clave(CAPAS));
  ok(o && o.guardado === true && o.origen === "ia" && o.nombre === "Capas abrigadas", "«Guardar»: en tus outfits");
  ok(/Está en tus guardados/.test(await txt(p, "#roe-app .roe-op:nth-child(1)")), "y la tarjeta lo dice");
  await p.click('#roe-app .roe-op:nth-child(1) [data-roe-o="no"]');
  await p.waitForTimeout(500);
  o = Object.values(await outfits(p)).find(x => clave(x.prendas) === clave(CAPAS));
  ok(o.gusto === "no" && o.guardado === false && /No te gustó/.test(await txt(p, "#roe-app .roe-op:nth-child(1)")), "«No me gusta»: no vuelve a salir en Outfits");
  await deshacer(p);
  o = Object.values(await outfits(p)).find(x => clave(x.prendas) === clave(CAPAS));
  ok(o.gusto === "si" && o.guardado === true, "Deshacer: como estaba");
  await p.click('#roe-app .roe-op:nth-child(2) [data-roe-o="puse"]');
  await p.waitForTimeout(500);
  let usos = (await col(p, "users/test/ropa_usos"))[HOY].prendas;
  ok(FORMAL.every(id => usos.includes(id)) && /Te lo pusiste hoy/.test(await txt(p, "#roe-app .roe-op:nth-child(2)")), "«Me lo pongo»: anotado hoy");
  ok(/anotado lo que te pusiste hoy/.test(await toast(p)), "con su aviso");
  await deshacer(p);
  usos = (await col(p, "users/test/ropa_usos"))[HOY].prendas;
  ok(clave(usos) === clave(["cam", "jean", "zn"]), "Deshacer: solo lo que se anotó recién");
  // Ver en grande y Cambiar una prenda.
  await p.click('#roe-app .roe-op:nth-child(1) .rof-ver-a');
  await p.waitForSelector(".rof-hoja-ver .rof-tablero", { timeout: 3000 });
  ok((await p.$$(".rof-hoja-ver .rof-tab")).length === 5 && /Capas abrigadas/.test(await txt(p, ".rof-hoja-ver h3")), "tocar las fotos: el outfit en grande");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.click('#roe-app .roe-op:nth-child(1) [data-roe-o="cambiar"]');
  await p.waitForTimeout(600);
  const elegidas = await p.$$eval("#roar-app [data-roar-x]", bs => bs.map(b => b.dataset.roarX));
  ok(await p.evaluate(() => location.hash === "#ropa-armar") && clave(elegidas) === clave(CAPAS), "«Cambiar una prenda»: «Armar el mío» con ese outfit");
  await ir(p, "ropa-estilista");
  ok((await mensajes(p)).length === 2, "al volver, la conversación sigue ahí");
  // Seguir hablando: lo hablado antes va al puente.
  pf.respuestas.push({ respuesta: "Para mañana con lluvia, zapatos cerrados:", outfits: [{ nombre: "Lluvia", prendas: ["cha", "cam", "jean", "zn"], porque: "Cerrado y abrigado.", capas: "" }] });
  await escribir(p, "¿Y para mañana, que llueve?");
  await esperarIA(p, 2);
  const c2 = pf.charlas()[1];
  ok(c2.cuerpo.historial.length === 2 && c2.cuerpo.historial[0].texto === "Hace frío: una chompa y una chamarra encima" && c2.cuerpo.historial[1].de === "ia" && c2.cuerpo.historial[1].outfits.length === 2, "lo hablado antes va al puente (con los outfits que armó)");
  ok(await p.$eval("#roe-texto", t => t.value === ""), "el cuadro queda vacío");
  // Otra opción: un mensaje más.
  pf.respuestas.push({ respuesta: "Otra:", outfits: [{ nombre: "Otra más", prendas: ["cha", "pol", "tela", "zn"], porque: "", capas: "" }] });
  await p.click('#roe-app .roe-m.is-ia:nth-child(4) [data-roe-o="otra"]');
  await esperarIA(p, 3);
  ok(pf.charlas()[2].cuerpo.mensaje === "Dame otra opción distinta de «Lluvia»." && (await mensajes(p))[4].texto === "Dame otra opción distinta de «Lluvia».", "«Otra opción»: se lo pide a tu estilista");
  ok(/US\$ 0,24 de US\$ 8,00/.test(await txt(p, "#roe-nota")), "abajo: lo que cuesta cada mensaje y lo gastado este mes");
  await captura(p, "estilista-390.png");
  sinErrores(p);
  await p.context().close();
}

// ---------- (3) Un error y "Volver a preguntar"; Enter; el borrador ----------
async function errores(browser, base) {
  console.log("\nSi tu estilista no contesta; Enter y el borrador");
  const pf = puenteFalso({ fallo: [402, { error: "tope", mensaje: "Llegaste al tope del mes (US$ 8). La IA vuelve el mes que viene, o sube el tope en Ajustes de Ropa." }] });
  const p = await abrir(browser, base, { hash: "#ropa-estilista", puente: pf });
  ok(await p.$("#roe-app .roe-vacio") && (await p.$$("#roe-app .roe-ejemplo")).length === 3, "vacía: el saludo y 3 ejemplos");
  await p.click("#roe-app .roe-ejemplo:nth-child(2)");
  await p.waitForTimeout(200);
  ok(await p.$eval("#roe-texto", t => t.value) === "Mañana tengo una reunión formal" && !pf.charlas().length, "tocar un ejemplo lo escribe (no lo manda)");
  await p.keyboard.press("Shift+Enter");
  await p.waitForTimeout(100);
  ok(!pf.charlas().length && /\n/.test(await p.$eval("#roe-texto", t => t.value)), "Mayúscula + Enter: otra línea");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(800);
  ok(pf.charlas().length === 1 && pf.charlas()[0].cuerpo.mensaje === "Mañana tengo una reunión formal", "Enter manda");
  ok(/Llegaste al tope del mes/.test(await txt(p, "#roe-app .roe-sin")) && await p.$('#roe-app .roe-sin a[href="#ropa-ajustes"]'), "un error: lo dice, con Ajustes de Ropa");
  ok((await mensajes(p)).length === 1, "tu mensaje queda");
  pf.respuestas.push({ respuesta: "Para la reunión:", outfits: [{ nombre: "Reunión", prendas: FORMAL.slice(2).concat(["cho"]), porque: "Formal.", capas: "" }] });
  await p.click('#roe-app [data-roe="reintentar"]');
  await esperarIA(p, 1);
  const c = pf.charlas()[1];
  ok(c.cuerpo.mensaje === "Mañana tengo una reunión formal" && c.cuerpo.historial.length === 0, "«Volver a preguntar»: lo mismo, sin repetirlo");
  ok((await mensajes(p)).map(m => m.de).join() === "yo,ia" && !(await p.$("#roe-app .roe-sin")), "y ahora contesta");
  // El borrador queda (si sales y vuelves).
  await p.fill("#roe-texto", "Algo que todavía no mando");
  await p.reload();
  await p.waitForTimeout(1200);
  ok(await p.$eval("#roe-texto", t => t.value) === "Algo que todavía no mando", "lo que escribías queda en el cuadro");
  sinErrores(p);
  await p.context().close();
}

// ---------- (4) y (5): tus conversaciones y lo que recuerda de ti ----------
async function conversacionesYMemoria(browser, base) {
  console.log("\nTus conversaciones y lo que recuerda de ti");
  const pf = puenteFalso();
  const p = await abrir(browser, base, { hash: "#ropa-estilista", puente: pf, seed: { "users/test/ropa_charlas": { vieja: CHARLA_VIEJA } } });
  ok(/Conversaciones 1/.test(await txt(p, '#roe-app [data-roe="charlas"]')) && /Lo que recuerda de ti 1/.test(await txt(p, '#roe-app [data-roe="memoria"]')), "arriba: tus conversaciones y lo que recuerda de ti");
  await p.click('#roe-app [data-roe="charlas"]');
  await p.waitForSelector(".roe-hoja-charlas .roe-charla", { timeout: 3000 });
  ok(/Para el sábado/.test(await txt(p, ".roe-hoja-charlas .roe-charla")) && /2 mensajes/.test(await txt(p, ".roe-hoja-charlas .roe-charla")), "la lista, con el título y cuántos mensajes");
  await p.click(".roe-hoja-charlas .roe-charla");
  await p.waitForTimeout(400);
  const ms = await mensajes(p);
  ok(ms.length === 2 && /Sábado tranquilo/.test(ms[1].texto), "abrir una: sus mensajes y sus outfits");
  ok(/Lo recordé: prefiere colores oscuros/.test(await txt(p, "#roe-app .roe-recordo")), "lo que recordó (mientras lo siga recordando)");
  // Borrar con Deshacer.
  await p.click('#roe-app [data-roe="charlas"]');
  await p.waitForSelector(".roe-hoja-charlas [data-roe-h=borrar]", { timeout: 3000 });
  await p.click(".roe-hoja-charlas [data-roe-h=borrar]");
  await p.waitForTimeout(500);
  ok(!Object.keys(await charlas(p)).length && /Borraste «Para el sábado»/.test(await txt(p, ".roe-hoja-charlas .roe-hecho")), "borrar una conversación (lo dice en la misma hoja)");
  ok(/Todavía no hablaste/.test(await txt(p, ".roe-hoja-charlas")), "la lista queda vacía");
  ok(await p.evaluate(() => !!document.activeElement && document.activeElement.dataset.roeH === "deshacer"), "y el foco, en «Deshacer»");
  await p.click(".roe-hoja-charlas [data-roe-h=deshacer]");
  await p.waitForTimeout(400);
  ok(Object.keys(await charlas(p)).join() === "vieja" && /Para el sábado/.test(await txt(p, ".roe-hoja-charlas .roe-charla")), "Deshacer (ahí mismo): vuelve");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  ok((await mensajes(p)).length === 2, "y vuelve a estar abierta");
  await p.click('#roe-app [data-roe="nueva"]');
  await p.waitForTimeout(300);
  ok(await p.$("#roe-app .roe-vacio"), "«Nueva»: una conversación vacía");
  // Lo que recuerda de ti.
  await p.click('#roe-app [data-roe="memoria"]');
  await p.waitForSelector(".roe-hoja-memoria .roe-mem-form", { timeout: 3000 });
  ok(/Prefiere colores oscuros/.test(await txt(p, ".roe-hoja-memoria .roe-memoria")), "la lista de lo que recuerda");
  await p.fill(".roe-hoja-memoria [name=texto]", "No me gusta el amarillo");
  await p.click(".roe-hoja-memoria .roe-mem-form button[type=submit]");
  await p.waitForTimeout(400);
  ok((await memoria(p)).join() === "Prefiere colores oscuros,No me gusta el amarillo", "agregar algo de ti");
  ok(/No me gusta el amarillo/.test(await txt(p, ".roe-hoja-memoria .roe-memoria li:first-child")), "lo más nuevo, primero");
  await p.fill(".roe-hoja-memoria [name=texto]", "no me gusta el AMARILLO");
  await p.click(".roe-hoja-memoria .roe-mem-form button[type=submit]");
  await p.waitForTimeout(300);
  ok(/Eso ya lo recuerda/.test(await txt(p, ".roe-hoja-memoria [data-roe-mem-error]")) && (await memoria(p)).length === 2, "lo mismo otra vez: no se repite");
  await p.click(".roe-hoja-memoria [data-roe-h=olvidar]");
  await p.waitForTimeout(400);
  ok((await memoria(p)).join() === "Prefiere colores oscuros" && /Borraste «No me gusta el amarillo»/.test(await txt(p, ".roe-hoja-memoria .roe-hecho")), "borrar (lo dice en la misma hoja)");
  await p.click(".roe-hoja-memoria [data-roe-h=deshacer]");
  await p.waitForTimeout(400);
  ok((await memoria(p)).length === 2 && (await p.$$(".roe-hoja-memoria .roe-memoria li")).length === 2, "Deshacer (ahí mismo): vuelve");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  // En Ajustes de Ropa.
  await ir(p, "ropa-ajustes");
  ok(/Recuerda 2 cosas de ti/.test(await txt(p, "#roa-app .roa-estilista")), "en Ajustes de Ropa: lo que recuerda de ti");
  await p.click('#roa-app [data-roa="memoria"]');
  await p.waitForSelector(".roe-hoja-memoria .roe-memoria", { timeout: 3000 });
  ok((await p.$$(".roe-hoja-memoria .roe-memoria li")).length === 2, "y se cambia desde ahí");
  sinErrores(p);
  await p.context().close();
}

// ---------- (6) Una conversación llena empieza otra ----------
async function llena(browser, base) {
  console.log("\nUna conversación de 40 mensajes");
  const larga = { v: 1, titulo: "Larga", creado: DIA("2026-11-10"), editado: DIA("2026-11-10"),
    mensajes: Array.from({ length: 39 }, (_, i) => ({ de: i % 2 ? "ia" : "yo", texto: `Mensaje ${i + 1}`, fecha: DIA("2026-11-10") + i })) };
  const pf = puenteFalso();
  const p = await abrir(browser, base, { hash: "#ropa-estilista", puente: pf, seed: { "users/test/ropa_charlas": { larga } }, estado: { "manolo.ropa.charla": "larga" } });
  ok(/ya es larga/.test(await txt(p, "#roe-app .roe-llena")), "lo avisa");
  await escribir(p, "Una más");
  await esperarIA(p, 1);
  const cs = await charlas(p);
  ok(Object.keys(cs).length === 2 && cs.larga.mensajes.length === 39, "lo que escribes empieza una nueva (la larga queda igual)");
  ok(pf.charlas()[0].cuerpo.historial.length === 0, "y la nueva empieza sin lo de antes");
  sinErrores(p);
  await p.context().close();
}

// ---------- (7) Sin internet y quien no es el dueño ----------
async function sinInternetYOtros(browser, base) {
  console.log("\nSin internet y quien no es el dueño");
  let p = await abrir(browser, base, { hash: "#ropa-estilista", puente: puenteFalso(), seed: { "users/test/ropa_charlas": { vieja: CHARLA_VIEJA } }, estado: { "manolo.ropa.charla": "vieja" } });
  await p.context().setOffline(true);
  await p.waitForTimeout(400);
  ok((await mensajes(p)).length === 2, "sin internet: lo hablado se ve igual");
  ok(await p.$eval("#roe-texto", t => t.disabled) && /Sin internet/.test(await txt(p, "#roe-nota")), "y el cuadro avisa que hace falta conexión");
  await ir(p, "ropa-outfits");
  ok(/Sin internet/.test(await txt(p, "#rof-app .roe-pide")) && await p.$eval("#rof-pide", i => i.disabled), "en Outfits, también lo avisa");
  sinErrores(p);
  await p.context().close();
  p = await abrir(browser, base, { hash: "#ropa-outfits", puente: puenteFalso({ permitido: false }) });
  ok(!(await p.$("#rof-app .roe-pide")), "quien no es el dueño: en Outfits no aparece");
  await ir(p, "ropa-estilista");
  ok(/solo para el dueño/.test(await txt(p, "#roe-nota")) && await p.$eval("#roe-texto", t => t.disabled), "y tu estilista lo explica");
  sinErrores(p);
  await p.context().close();
  p = await abrir(browser, base, { hash: "#ropa-outfits" });
  ok(!(await p.$("#rof-app .roe-pide")), "sin el puente: no aparece");
  sinErrores(p);
  await p.context().close();
}

// ---------- (8) A 320 px, en oscuro y en claro ----------
async function chico(browser, base, esquema) {
  const nombre = esquema === "light" ? "claro" : "oscuro";
  console.log(`\nA 320 px, en ${nombre}`);
  const p = await abrir(browser, base, { hash: "#ropa-estilista", ancho: 320, esquema, puente: puenteFalso(), seed: { "users/test/ropa_charlas": { vieja: CHARLA_VIEJA } }, estado: { "manolo.ropa.charla": "vieja" } });
  ok(await sobra(p) <= 0, "la conversación: nada se sale a lo ancho");
  const chicos = await p.$$eval("#roe-app button, #roe-app a, #roe-app textarea",
    els => els.filter(e => e.getClientRects().length && !e.closest(".rof-ver-a")).filter(e => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).map(e => e.className || e.textContent.trim()));
  ok(!chicos.length, `todo se toca bien con el dedo${chicos.length ? `: ${chicos.slice(0, 3).join(", ")}` : ""}`);
  let malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, `estilista-320-${nombre}.png`);
  await p.click('#roe-app [data-roe="charlas"]');
  await p.waitForSelector(".roe-hoja-charlas .roe-charla", { timeout: 3000 });
  await p.waitForTimeout(300);
  ok(await sobra(p) <= 0, "tus conversaciones: nada se sale");
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `tus conversaciones: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p.keyboard.press("Escape");
  await p.click('#roe-app [data-roe="memoria"]');
  await p.waitForSelector(".roe-hoja-memoria .roe-mem-form", { timeout: 3000 });
  await p.waitForTimeout(300);
  ok(await sobra(p) <= 0, "lo que recuerda de ti: nada se sale");
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `lo que recuerda de ti: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p.keyboard.press("Escape");
  await p.click('#roe-app [data-roe="nueva"]');
  await p.waitForTimeout(300);
  ok(await sobra(p) <= 0, "vacía, con los ejemplos: nada se sale");
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `vacía: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, `estilista-vacia-320-${nombre}.png`);
  await ir(p, "ropa-outfits");
  ok(await sobra(p) <= 0, "Outfits con «Pídelo con tus palabras»: nada se sale");
  await captura(p, `estilista-outfits-320-${nombre}.png`);
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `Outfits: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  sinErrores(p);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await conversar(browser, base);
  await errores(browser, base);
  await conversacionesYMemoria(browser, base);
  await llena(browser, base);
  await sinInternetYOtros(browser, base);
  for (const esquema of ["dark", "light"]) await chico(browser, base, esquema);
  await terminar(browser, srv);
})();
