// Pruebas de pantalla de Ropa, nivel 2, fase 5 (D-161; docs/ROPA_ESTILISTA.md):
// tu estilista, conectado con Outfits, Compras e Inicio (con un puente de
// mentira que solo contesta /quien: nada de esto usa la IA).
// (1) Outfits: el aviso del día (lo que te sugirió en su último repaso y le
// sirve al clima de hoy o de mañana, o a la ocasión), "Ya está en tu lista",
// "Ver en Compras", el ✕ (con Deshacer) y que no salga lo que ya tienes. (2)
// En la tarjeta de tu estilista, "Hoy te armó…" con el link a esa
// conversación. (3) En la conversación, "Para mañana" (con Deshacer). (4)
// Compras: "Tu estilista también lo sugiere", "También está en N de tus
// pines" y "Te lo sugirió tu estilista" en tu lista. (5) Inicio: lo que te
// armó hoy o "¿Qué me pongo hoy?"; sin el puente, como antes. (6) A 320 px en
// oscuro y en claro.
// Uso: node scripts/e2e/ropa-conectar.js [carpeta-para-capturas]
const fs = require("node:fs");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";
const HOY = "2026-11-23", MANANA = "2026-11-24";
// El clima de La Paz: hoy, frío a la mañana y capas (24 % de lluvia); mañana, 97 % de lluvia.
const CLIMA = JSON.parse(fs.readFileSync(path.join(__dirname, "../../tests/fixtures/clima/la-paz-2026-11-23.json"), "utf8"));
const CLIMA_GUARDADO = JSON.stringify({ k: "-16.5,-68.15", hora: Date.parse(FECHA), json: CLIMA });
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const col = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const deshacer = async p => { await p.click("#ro-toast .undo-toast-btn"); await p.waitForTimeout(400); };
const sinErrores = p => ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
// Escribir en la nube de mentira (como si llegara de otro teléfono): la app se entera.
const poner = async (p, c, id, d) => { await p.evaluate(([c2, id2, d2]) => { window.__fakeStore.colMap(c2).set(id2, d2); window.__fakeStore.notify(); }, [c, id, d]); await p.waitForTimeout(300); };
const contraste = async (p, que) => {
  const malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `${que}: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
};

// ---------- Tu ropa, tu estilista y tus pines ----------
const FORMAS = {
  polera: "M28 22h13q9 7 18 0h13l15 13-9 11-7-5v43H29V41l-7 5-9-11Z", chompa: "M30 20h40l10 8 7 46-9 2-6-34v46H28V42l-6 34-9-2 7-46Z",
  chamarra: "M30 18h40l11 9 7 47-9 2-7-33v45H28V43l-7 33-9-2 7-47Z", pantalon: "M31 12h38l5 77H56l-6-52-6 52H26Z",
  zapatos: "M12 60q12-2 22-15l10 6q14 9 36 11 9 1 9 12v5H12Z"
};
const svg = (forma, hex) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="#ebe6dc"/><path transform="translate(-5 10)" d="${FORMAS[forma]}" fill="${hex}"/></svg>`);
const DIA = f => Date.parse(`${f}T12:00:00Z`);
const AHORA = Date.parse(FECHA);
const prenda = (grupo, tipo, color, hex, forma, x, k) => Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estampado: "liso", tela: "", estilo: ["casual"], clima: ["templado"], formalidad: null, marca: "", notas: "",
  fotos: [{ id: `f-${tipo}-${k}`, mini: svg(forma, hex), ancho: 900, alto: 1200 }], estado: "activa", creado: DIA("2026-10-01") + k }, x);
const ROPA = {
  pol: ["arriba", "Polera", "blanco", "#f4f4f2", "polera", {}], cam: ["arriba", "Camisa", "celeste", "#8fc3ea", "polera", { formalidad: 3 }],
  cho: ["arriba", "Chompa", "bordo", "#6e1f2c", "chompa", { clima: ["frio"] }],
  jean: ["abajo", "Jean", "azul-jean", "#4f6f9a", "pantalon", { formalidad: 2 }], tela: ["abajo", "Pantalón de tela", "negro", "#1b1b1b", "pantalon", { formalidad: 4 }],
  cha: ["abrigos", "Chamarra", "verde-oliva", "#6b7134", "chamarra", { clima: ["frio"] }],
  zap: ["zapatos", "Zapatillas", "blanco", "#f4f4f2", "zapatos", { formalidad: 1 }], zn: ["zapatos", "Zapatos", "negro", "#151515", "zapatos", { formalidad: 4 }]
};
// El último repaso de tu estilista: tres cosas que sumaría.
const OPINION = { op1: { v: 1, fecha: "2026-11-20", creado: DIA("2026-11-20"), n: 8, hechos: [{ id: "h1", texto: "Tienes 8 prendas." }], ia: {
  resumen: "Buenas bases neutras.", comentarios: [],
  sugerencias: [
    { grupo: "abajo", tipo: "Chino", color: "beige", porque: "Aclara tus outfits.", combina: ["pol", "cam"] },
    { grupo: "zapatos", tipo: "Botines", color: "cafe", porque: "Para el frío y la lluvia de La Paz.", combina: ["jean"] },
    { grupo: "accesorios", tipo: "Gorra", color: "negro", porque: "Para el sol del mediodía.", combina: [] }
  ], noComprar: [], dejar: [], colores: { van: [], sumar: [], porque: "" }, consejos: [] } } };
// Una conversación de hoy (con dos outfits) y una de ayer (la que estaba abierta).
const ia = (texto, outfits, fecha) => ({ de: "ia", texto, outfits, faltan: [], recordo: [], fecha });
const yo = (texto, fecha) => ({ de: "yo", texto, fecha });
const CHARLAS = {
  hoy1: { v: 1, titulo: "Hace frío: una chompa y una chamarra", creado: AHORA - 3600e3, editado: AHORA - 3500e3, mensajes: [
    yo("Hace frío: una chompa y una chamarra", AHORA - 3600e3),
    ia("Te armé dos:", [{ prendas: ["cho", "jean", "cha", "zap"], nombre: "Capas para el frío", porque: "Abriga.", capas: "" }, { prendas: ["cam", "tela", "cha", "zn"], nombre: "Más prolijo", porque: "Para la oficina.", capas: "" }], AHORA - 3500e3)] },
  ayer: { v: 1, titulo: "Para el sábado", creado: DIA("2026-11-22") - 7200e3, editado: DIA("2026-11-22"), mensajes: [
    yo("Para el sábado", DIA("2026-11-22") - 7200e3), ia("Este:", [{ prendas: ["pol", "jean", "zap"], nombre: "Sábado", porque: "", capas: "" }], DIA("2026-11-22"))] }
};
// Tus pines: los botines cafés salen en dos (como lo que te falta).
const v = (grupo, tipo, color) => ({ grupo, tipo, colores: [color], estampado: "liso", tela: "", detalle: "" });
const pin = (id, titulo, prendas, k) => ({ v: 1, via: "tablero", creado: 100 - k, pin: { id, url: `https://www.pinterest.com/pin/${id}/`, titulo, img: "", fecha: 100 - k },
  fotos: [{ id: `i-${id}`, mini: svg("zapatos", "#6b4a32"), ancho: 200, alto: 260 }], ia: { fecha: "2026-11-22" },
  analisis: { esRopa: true, resumen: titulo, estilo: ["casual"], clima: ["frio"], formalidad: 2, ocasion: "", prendas } });
const PINES = {
  p1: pin("p1", "Botines y jean", [v("zapatos", "Botines", "cafe"), v("abajo", "Jean", "azul-jean"), v("arriba", "Polera", "blanco")], 1),
  p2: pin("p2", "Botines con chompa", [v("zapatos", "Botines", "cafe"), v("arriba", "Chompa", "crema"), v("abajo", "Jean", "azul-jean")], 2),
  p3: pin("p3", "Falda negra", [v("abajo", "Falda", "negro"), v("arriba", "Polera", "negro")], 3),
  p4: pin("p4", "Falda y botas", [v("abajo", "Falda", "negro"), v("zapatos", "Zapatillas", "blanco")], 4)
};
function semilla(extra) {
  const ropa = {};
  Object.entries(ROPA).forEach(([id, x], k) => { ropa[id] = prenda(...x, k); });
  const meta = { ropa_ajustes: { ciudad: { nombre: "La Paz", lat: -16.5, lon: -68.15 } } };
  return Object.assign({ "users/test/ropa": ropa, "users/test/meta": meta, "users/test/ropa_opiniones": OPINION }, extra || {});
}

// ---------- Un puente de mentira (solo /quien) ----------
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
function puenteFalso() {
  const est = { pedidos: [] };
  est.rutas = async ctx => {
    await ctx.route(/open-meteo\.com/, r => r.abort());
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      est.pedidos.push(ruta);
      const json = (status, c) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      if (ruta === "/quien") return json(200, { permitido: true, uid: "test", lista: true, gasto: { mes: "2026-11", usd: 0.2, veces: 3, tope: 8 }, version: 6 });
      return json(404, { error: "ruta" });
    });
  };
  return est;
}
async function abrir(browser, base, o) {
  const x = o || {};
  const estado = Object.assign({ __SEED__: semilla(x.seed), "manolo.ropa.clima": CLIMA_GUARDADO }, x.puente ? { "manolo.puente": PUENTE } : {}, x.estado || {});
  const p = await abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA, ancho: 390, rutas: x.puente ? x.puente.rutas : async ctx => { await ctx.route(/open-meteo\.com/, r => r.abort()); } }, x));
  for (let k = 0; k < 30 && !(await p.$eval("body", b => getComputedStyle(b).display).catch(() => "")); k++) await p.waitForTimeout(100);
  if (x.puente) await p.waitForFunction(() => window.RopaIA && window.RopaIA.estado(), null, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(500);
  return p;
}
const avisoT = p => txt(p, "#rof-app .rof-falta p");

// ---------- (1) El aviso del día en Outfits ----------
async function avisoDelDia(browser, base) {
  console.log("\nEl aviso del día en Outfits (390 px)");
  const p = await abrir(browser, base, { hash: "#ropa-outfits", puente: puenteFalso() });
  ok(await avisoT(p) === "Para el frío de hoy, tu estilista te sugirió: Botines cafés. Ver en Compras", `hoy hace frío: los botines que te sugirió («${await avisoT(p)}»)`);
  ok(await p.evaluate(() => { const a = document.querySelector("#rof-app .rof-falta"), b = document.querySelector("#rof-app .rof-armar"), o = document.querySelector("#rof-app [aria-live]"); return !!(a && b && o && (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) && (a.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING)); }),
    "va antes de tus opciones (después de «¿Qué me pongo?»)");
  ok(await p.$eval("#rof-app .rof-falta a", a => a.getAttribute("href")) === "#ropa-compras", "«Ver en Compras» lleva a Compras");
  ok(await p.$eval("#rof-app .rof-falta-x", b => b.getAttribute("aria-label")) === "Ocultar este aviso", "el ✕ dice qué hace");
  // Mañana llueve: lo dice para mañana.
  await p.click('#rof-app [data-rof-dia="manana"]');
  await p.waitForTimeout(300);
  ok(await avisoT(p) === "Para la lluvia de mañana, tu estilista te sugirió: Botines cafés. Ver en Compras", "mañana llueve: «Para la lluvia de mañana»");
  // El ✕: no vuelve a salir (y llega lo siguiente que sirve), con Deshacer.
  await p.click("#rof-app .rof-falta-x");
  await p.waitForTimeout(300);
  ok(await avisoT(p) === "Para el sol fuerte de mañana, tu estilista te sugirió: Gorra negra. Ver en Compras", `ocultaste los botines: sale lo siguiente («${await avisoT(p)}»)`);
  ok(/no te lo vuelvo a mostrar/.test(await toast(p)), "lo dice (con Deshacer)");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains("rof-armar")), "el foco queda en «¿Qué me pongo?»");
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem("manolo.ropa.avisos") || "[]"))).length === 1, "queda en este teléfono");
  await deshacer(p);
  ok(/Botines cafés/.test(await avisoT(p)), "Deshacer: vuelve");
  // Ocultas los dos: con la ocasión «Trabajo», el chino.
  await p.click("#rof-app .rof-falta-x"); await p.waitForTimeout(300);
  await p.click("#rof-app .rof-falta-x"); await p.waitForTimeout(300);
  ok(!(await p.$("#rof-app .rof-falta")), "sin nada más para la lluvia, el frío o el sol: no hay aviso");
  await p.click('#rof-app input[name="rof-ocasion"][value="trabajo"]', { force: true });
  await p.waitForTimeout(300);
  ok(await avisoT(p) === "Para el trabajo, tu estilista te sugirió: Chino beige. Ver en Compras", "para el trabajo: el chino beige");
  await p.evaluate(() => localStorage.removeItem("manolo.ropa.avisos"));
  // En tu lista: lo dice. Ya lo tienes: no sale.
  await p.click('#rof-app [data-rof-dia="hoy"]');
  await poner(p, "users/test/ropa_deseos", "d1", { grupo: "zapatos", tipo: "Botines", colores: ["cafe"], origen: "estilista", estado: "quiero", inspiraciones: [], creado: 1, editado: 1 });
  ok(/Botines cafés\. Ya está en tu lista de deseos\./.test(await avisoT(p)), "si ya está en tu lista, lo dice");
  await poner(p, "users/test/ropa", "bot", { v: 1, grupo: "zapatos", tipo: "Botines", colores: [{ id: "cafe-oscuro" }], estado: "activa", creado: 9, fotos: [] });
  ok(await avisoT(p) === "Para el sol fuerte de hoy, tu estilista te sugirió: Gorra negra. Ver en Compras", `ya tienes unos botines cafés: no te los vuelve a sugerir (sale lo siguiente: «${await avisoT(p)}»)`);
  // «¿Con qué combino esto?» (con una prenda): sin aviso.
  await ir(p, "ropa-outfits/con/jean");
  await p.waitForTimeout(400);
  ok(!(await p.$("#rof-app .rof-falta")), "combinando una prenda: sin aviso");
  await captura(p, "conectar-aviso-390.png");
  sinErrores(p);
  await p.context().close();
  // Sin el puente (y sin el repaso): nada.
  const q = await abrir(browser, base, { hash: "#ropa-outfits", seed: { "users/test/ropa_opiniones": {} } });
  ok(!(await q.$("#rof-app .rof-falta")) && !(await q.$("#rof-app .roe-pide")), "sin el repaso de tu estilista: sin aviso");
  await q.context().close();
  // El repaso guardado igual avisa sin el puente (no usa la IA).
  const s = await abrir(browser, base, { hash: "#ropa-outfits" });
  ok(/Botines cafés/.test(await avisoT(s)), "el aviso no usa la IA: sale igual sin el puente");
  await s.context().close();
}

// ---------- (2) y (3): "Hoy te armó…" y "Para mañana" ----------
async function hoyTeArmo(browser, base) {
  console.log("\n«Hoy te armó…» y «Para mañana» (390 px)");
  const pf = puenteFalso();
  const p = await abrir(browser, base, { hash: "#ropa-outfits", puente: pf, seed: { "users/test/ropa_charlas": CHARLAS }, estado: { "manolo.ropa.charla": "ayer" } });
  ok(await txt(p, "#rof-app .roe-pide-hoy") === "Hoy te armó «Capas para el frío» y «Más prolijo». Verlos", `en la tarjeta de tu estilista («${await txt(p, "#rof-app .roe-pide-hoy")}»)`);
  ok(await p.$eval("#rof-app .roe-pide-hoy a", a => a.getAttribute("href")) === "#ropa-estilista/hoy1", "con el link a esa conversación");
  await captura(p, "conectar-hoy-390.png");
  await p.click("#rof-app .roe-pide-hoy a");
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => location.hash) === "#ropa-estilista", "la dirección vuelve a ser #ropa-estilista");
  ok(await p.$$eval("#roe-app .roe-op", els => els.length) === 2 && /Capas para el frío/.test(await txt(p, "#roe-app .roe-op")), "abre la conversación de hoy (no la de ayer, que estaba abierta)");
  ok(await p.evaluate(() => localStorage.getItem("manolo.ropa.charla")) === "hoy1", "y queda abierta");
  // "Para mañana": queda en tus guardados para mañana, con Deshacer.
  await p.click('#roe-app [data-roe-o="manana"][data-o="0"]');
  await p.waitForTimeout(500);
  ok(/«Capas para el frío» queda para mañana/.test(await toast(p)), "«Para mañana»: lo dice (con Deshacer)");
  let outs = Object.values(await col(p, "users/test/ropa_outfits"));
  ok(outs.length === 1 && outs[0].para === MANANA && outs[0].guardado === true && outs[0].prendas.slice().sort().join() === ["cha", "cho", "jean", "zap"].sort().join(), "queda guardado para mañana");
  ok(/Lo elegiste para mañana/.test(await txt(p, "#roe-app .roe-op")), "en el outfit: «Lo elegiste para mañana»");
  await deshacer(p);
  ok(!Object.keys(await col(p, "users/test/ropa_outfits")).length, "Deshacer lo saca");
  ok(!/Lo elegiste para mañana/.test(await txt(p, "#roe-app .roe-op")), "y el outfit vuelve a como estaba");
  // Si ya estaba guardado, Deshacer lo deja guardado (sin la fecha).
  await p.click('#roe-app [data-roe-o="guardar"][data-o="1"]'); await p.waitForTimeout(400);
  await p.click('#roe-app [data-roe-o="manana"][data-o="1"]'); await p.waitForTimeout(400);
  outs = Object.values(await col(p, "users/test/ropa_outfits"));
  ok(outs.length === 1 && outs[0].para === MANANA, "un guardado, para mañana");
  await deshacer(p);
  outs = Object.values(await col(p, "users/test/ropa_outfits"));
  ok(outs.length === 1 && outs[0].guardado === true && !outs[0].para, "Deshacer: sigue guardado, sin la fecha");
  // En Outfits, lo elegido para mañana se ve en "Mañana".
  await p.click('#roe-app [data-roe-o="manana"][data-o="0"]'); await p.waitForTimeout(400);
  await ir(p, "ropa-outfits");
  ok(/Para el martes 24/.test(await txt(p, "#rof-app .rof-guardados")), "en Outfits, en tus guardados: «Para el martes 24»");
  sinErrores(p);
  ok(!pf.pedidos.some(r => r !== "/quien"), "nada de esto usó la IA");
  await p.context().close();
  // Un link a una conversación que ya no está: abre la tuya de siempre.
  const q = await abrir(browser, base, { hash: "#ropa-estilista/no-esta", puente: puenteFalso(), seed: { "users/test/ropa_charlas": CHARLAS }, estado: { "manolo.ropa.charla": "ayer" } });
  ok(await q.evaluate(() => location.hash) === "#ropa-estilista" && /Sábado/.test(await txt(q, "#roe-app .roe-op")), "un link a una conversación borrada: queda la que tenías abierta");
  sinErrores(q);
  await q.context().close();
}

// ---------- (4) Compras ----------
async function compras(browser, base) {
  console.log("\nCompras: tu estilista y tus pines (390 px)");
  const deseos = {
    d1: { grupo: "abajo", tipo: "Chino", colores: ["beige"], origen: "estilista", nota: "Aclara tus outfits.", estado: "quiero", inspiraciones: [], creado: 2, editado: 2 },
    d2: { grupo: "abajo", tipo: "Falda", colores: ["negro"], origen: "falta", estado: "quiero", inspiraciones: ["p3", "p4"], creado: 1, editado: 1 }
  };
  const p = await abrir(browser, base, { hash: "#ropa-compras", puente: puenteFalso(), seed: { "users/test/ropa_inspiracion": PINES, "users/test/ropa_deseos": deseos } });
  const botines = await p.$$eval("#rco-app .rop-sug", els => (els.find(e => /Botines cafés/.test(e.innerText)) || { innerText: "" }).innerText.replace(/\s+/g, " "));
  ok(/También está en 2 de tus pines\./.test(botines), `en lo que opina tu estilista: «También está en 2 de tus pines»`);
  const chino = await p.$$eval("#rco-app .rop-sug", els => (els.find(e => /Chino beige/.test(e.innerText)) || { innerText: "" }).innerText.replace(/\s+/g, " "));
  ok(!/de tus pines/.test(chino), "lo que no está en tus pines, no lo dice");
  const falta = await p.$$eval("#rco-app .rco-sec .rco-item", els => els.filter(e => !e.classList.contains("rop-sug") && !e.classList.contains("rco-deseo")).map(e => e.innerText.replace(/\s+/g, " ")));
  const fb = falta.find(t => /^Botines cafés/.test(t)) || "", ff = falta.find(t => /^Falda negra/.test(t)) || "";
  ok(/Tu estilista también lo sugiere\./.test(fb), "en «Qué te falta»: «Tu estilista también lo sugiere»");
  ok(ff && !/Tu estilista/.test(ff), "lo que tu estilista no sugirió, no lo dice");
  const lista = await p.$$eval("#rco-app .rco-deseo", els => els.map(e => e.innerText.replace(/\s+/g, " ")));
  ok(lista.length === 2 && /Te lo sugirió tu estilista/.test(lista.find(t => /Chino/.test(t)) || "") && !/Te lo sugirió/.test(lista.find(t => /Falda/.test(t)) || ""), "en tu lista: «Te lo sugirió tu estilista» (solo en lo suyo)");
  await captura(p, "conectar-compras-390.png");
  sinErrores(p);
  await p.context().close();
}

// ---------- (5) Inicio ----------
const tarjeta = p => p.$eval('#ropa-inicio', el => { const a = el.closest("a.card"); const h = a.querySelector(".ro-ini-hoy"); return { href: a.getAttribute("href"), t: h ? h.querySelector(".ro-ini-t").innerText.replace(/\s+/g, " ").trim() : "", fotos: h ? h.querySelectorAll(".ro-ini-fotos .ro-foto").length : 0 }; });
async function inicio(browser, base) {
  console.log("\nInicio: la tarjeta de Ropa (390 px)");
  let p = await abrir(browser, base, { hash: "#inicio", puente: puenteFalso(), seed: { "users/test/ropa_charlas": CHARLAS } });
  let t = await tarjeta(p);
  ok(t.t === "Hoy tu estilista te armó 2 outfits:" && t.fotos === 4 && t.href === "#ropa-estilista/hoy1", `lo que te armó hoy tu estilista, con las fotos del primero («${t.t}», ${t.fotos} fotos, ${t.href})`);
  await captura(p, "conectar-inicio-390.png");
  await p.click("#ropa-inicio");
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => location.hash) === "#ropa-estilista" && /Capas para el frío/.test(await txt(p, "#roe-app .roe-op")), "toca la tarjeta: abre esa conversación");
  // Te pusiste algo hoy: manda eso (como antes).
  await ir(p, "inicio");
  await poner(p, "users/test/ropa_usos", HOY, { prendas: ["pol", "jean", "zap"], actualizado: 1 });
  t = await tarjeta(p);
  ok(t.t === "Hoy te pusiste:" && t.href === "#ropa-outfits", "si ya te pusiste algo hoy, eso (como antes)");
  sinErrores(p);
  await p.context().close();
  // Sin nada de hoy, con tu estilista lista: "¿Qué me pongo hoy?".
  p = await abrir(browser, base, { hash: "#inicio", puente: puenteFalso() });
  t = await tarjeta(p);
  ok(t.t === "¿Qué me pongo hoy? Pídeselo a tu estilista." && t.href === "#ropa-outfits" && !t.fotos, `sin nada de hoy: «${t.t}» (a Outfits)`);
  // Sin internet: no lo ofrece.
  await p.context().setOffline(true);
  await p.waitForTimeout(400);
  t = await tarjeta(p);
  ok(!t.t && t.href === "#ropa", "sin internet: no lo ofrece");
  await p.context().setOffline(false);
  await p.context().close();
  // A la noche: para mañana.
  p = await abrir(browser, base, { hash: "#inicio", puente: puenteFalso(), fecha: "2026-11-23T21:00:00-04:00" });
  t = await tarjeta(p);
  ok(t.t === "¿Qué me pongo mañana? Pídeselo a tu estilista.", "después de las 20: «¿Qué me pongo mañana?»");
  await p.context().close();
  // Sin el puente: como antes.
  p = await abrir(browser, base, { hash: "#inicio", seed: { "users/test/ropa_charlas": {} } });
  t = await tarjeta(p);
  ok(!t.t && t.href === "#ropa", "sin el puente: como antes (al ropero)");
  sinErrores(p);
  await p.context().close();
}

// ---------- (6) A 320 px, en oscuro y en claro ----------
async function chico(browser, base, esquema) {
  const nombre = esquema === "light" ? "claro" : "oscuro";
  console.log(`\nA 320 px, en ${nombre}`);
  const deseos = { d1: { grupo: "abajo", tipo: "Chino", colores: ["beige"], origen: "estilista", nota: "Aclara tus outfits.", estado: "quiero", inspiraciones: [], creado: 2, editado: 2 } };
  const p = await abrir(browser, base, { hash: "#ropa-outfits", ancho: 320, esquema, puente: puenteFalso(), seed: { "users/test/ropa_charlas": CHARLAS, "users/test/ropa_inspiracion": PINES, "users/test/ropa_deseos": deseos } });
  ok(await p.$("#rof-app .rof-falta") && await p.$("#rof-app .roe-pide-hoy"), "Outfits: el aviso y «Hoy te armó…»");
  ok(await sobra(p) <= 0, "Outfits: nada se sale a lo ancho");
  const x = await p.$eval("#rof-app .rof-falta-x", b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
  ok(x[0] >= 44 && x[1] >= 44, `el ✕ se toca bien con el dedo (${x.join("×")})`);
  await contraste(p, "Outfits");
  await p.$eval("#rof-app .roe-pide", el => el.scrollIntoView({ block: "start" }));
  await captura(p, `conectar-outfits-320-${nombre}.png`);
  await p.$eval("#rof-app .rof-falta", el => el.scrollIntoView({ block: "center" }));
  await captura(p, `conectar-aviso-320-${nombre}.png`);
  await ir(p, "ropa-estilista/hoy1");
  ok(await sobra(p) <= 0, "la conversación con «Para mañana»: nada se sale");
  await contraste(p, "La conversación");
  await p.$eval("#roe-app .roe-op .rof-op-ver", el => el.scrollIntoView({ block: "center" }));
  await captura(p, `conectar-charla-320-${nombre}.png`);
  await ir(p, "ropa-compras");
  ok(await sobra(p) <= 0, "Compras: nada se sale");
  await contraste(p, "Compras");
  await p.$eval("#rco-app .rco-estilista", el => el.scrollIntoView({ block: "center" }));
  await captura(p, `conectar-compras-320-${nombre}.png`);
  await ir(p, "inicio");
  ok(await sobra(p) <= 0, "Inicio: nada se sale");
  const fuera = await p.$$eval(".card-grid-home > .card", cs => cs.filter(c => c.getBoundingClientRect().right > innerWidth + 0.5).map(c => c.querySelector("h3") ? c.querySelector("h3").textContent : c.className));
  ok(!fuera.length, `Inicio: las fotos de Ropa no ensanchan las tarjetas${fuera.length ? `: ${fuera.join(", ")}` : ""}`);
  await contraste(p, "Inicio");
  await p.$eval("#ropa-inicio", el => el.closest("a.card").scrollIntoView({ block: "center" }));
  await captura(p, `conectar-inicio-320-${nombre}.png`);
  sinErrores(p);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await avisoDelDia(browser, base);
  await hoyTeArmo(browser, base);
  await compras(browser, base);
  await inicio(browser, base);
  for (const esquema of ["dark", "light"]) await chico(browser, base, esquema);
  await terminar(browser, srv);
})();
