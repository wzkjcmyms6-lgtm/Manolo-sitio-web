// Pruebas de pantalla de Ropa, nivel 2, fase 4 (D-160; docs/ROPA_ESTILISTA.md):
// lo que opina tu estilista, con un puente de mentira.
// (1) En Compras: sin repaso, "Pedir su opinión"; lo que va al puente (los
// números de Manolo, tu ropa con las veces, tus pines, tu ciudad); mientras
// mira, lo dice; el repaso guardado; "Lo que ve" (cada número con su
// comentario), "Lo que sumaría" (cuántos outfits nuevos, con qué va, "A mi
// lista", Pinterest), qué no comprar, qué dejar, tus colores y consejos. (2) Si
// falla, lo dice. (3) Lo guardado se ve sin la IA. (4) "¿Qué opinas?" en Armar
// el mío: el veredicto, el cambio con fotos, "Cambiar" en un toque (con
// Deshacer), sin pagar dos veces lo mismo y "Preguntarle otra vez". (5) Desde
// un guardado de Outfits, "Cambiar" abre Armar el mío con el cambio. (6) Sin el
// puente, nada de esto aparece. (7) A 320 px en oscuro y en claro.
// Uso: node scripts/e2e/ropa-opinion.js [carpeta-para-capturas]
const fs = require("node:fs");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";
const HOY = "2026-11-23";
const CLIMA = JSON.parse(fs.readFileSync(path.join(__dirname, "../../tests/fixtures/clima/la-paz-2026-11-23.json"), "utf8"));
const CLIMA_GUARDADO = JSON.stringify({ k: "-16.5,-68.15", hora: Date.parse(FECHA), json: CLIMA });
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const col = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const deshacer = async p => { await p.click("#ro-toast .undo-toast-btn"); await p.waitForTimeout(400); };
const sinErrores = p => ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
const clave = ids => [...ids].sort().join("|");
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };

// ---------- Tu ropa ----------
const FORMAS = {
  polera: "M28 22h13q9 7 18 0h13l15 13-9 11-7-5v43H29V41l-7 5-9-11Z", chompa: "M30 20h40l10 8 7 46-9 2-6-34v46H28V42l-6 34-9-2 7-46Z",
  chamarra: "M30 18h40l11 9 7 47-9 2-7-33v45H28V43l-7 33-9-2 7-47Z", pantalon: "M31 12h38l5 77H56l-6-52-6 52H26Z",
  zapatos: "M12 60q12-2 22-15l10 6q14 9 36 11 9 1 9 12v5H12Z"
};
const svg = (forma, hex) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="#ebe6dc"/><path transform="translate(-5 10)" d="${FORMAS[forma]}" fill="${hex}"/></svg>`);
const DIA = f => Date.parse(`${f}T12:00:00Z`);
const IA_OPINION = {
  resumen: "Tienes buenas bases neutras; te faltan opciones abajo para sacarle más a tus prendas de arriba.",
  comentarios: [{ hecho: "h1", texto: "Con más de abajo, cada polera te da más outfits." }],
  sugerencias: [
    { grupo: "abajo", tipo: "Chino", color: "beige", porque: "Aclara tus outfits y va con casi todo lo de arriba.", combina: ["pol", "cam", "cho"] },
    { grupo: "zapatos", tipo: "Botines", color: "cafe", porque: "Para el frío y la lluvia de La Paz.", combina: ["jean"] }
  ],
  noComprar: ["Más poleras blancas"], dejar: [{ prenda: "tela", porque: "Muy formal para tu día a día." }],
  colores: { van: ["negro", "blanco"], sumar: ["beige"], porque: "Neutros con un tono tierra." }, consejos: ["Arremanga la camisa con el jean."]
};
function semilla(extra) {
  const ropa = {};
  [["pol", "arriba", "Polera", "blanco", "#f4f4f2", "polera", {}], ["cam", "arriba", "Camisa", "celeste", "#8fc3ea", "polera", { formalidad: 3 }],
   ["cho", "arriba", "Chompa", "bordo", "#6e1f2c", "chompa", { clima: ["frio"] }],
   ["jean", "abajo", "Jean", "azul-jean", "#4f6f9a", "pantalon", { formalidad: 2 }], ["tela", "abajo", "Pantalón de tela", "negro", "#1b1b1b", "pantalon", { formalidad: 5 }],
   ["cha", "abrigos", "Chamarra", "verde-oliva", "#6b7134", "chamarra", { clima: ["frio"] }],
   ["zap", "zapatos", "Zapatillas", "blanco", "#f4f4f2", "zapatos", { formalidad: 1 }], ["zn", "zapatos", "Zapatos", "negro", "#151515", "zapatos", { formalidad: 4 }]]
    .forEach(([id, grupo, tipo, color, hex, forma, x], k) => {
      ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estampado: "liso", tela: "", estilo: ["casual"], clima: ["templado"], formalidad: null, marca: "", notas: "",
        fotos: [{ id: `f-${id}`, mini: svg(forma, hex), ancho: 900, alto: 1200 }], estado: "activa", creado: DIA("2026-10-01") + k }, x);
    });
  const usos = { "2026-11-20": { prendas: ["pol", "jean", "zap"], actualizado: DIA("2026-11-20") }, "2026-11-18": { prendas: ["pol", "jean", "zap"], actualizado: DIA("2026-11-18") } };
  const meta = { ropa_ajustes: { ciudad: { nombre: "La Paz", lat: -16.5, lon: -68.15 }, memoria: [{ id: "m1", texto: "Es friolento", fecha: 1 }] } };
  const outs = { o1: { v: 1, prendas: ["pol", "jean", "zap"], nombre: "De siempre", ocasion: "casual", origen: "reglas", gusto: "si", guardado: true, puesto: [], creado: DIA("2026-11-01") } };
  return Object.assign({ "users/test/ropa": ropa, "users/test/ropa_usos": usos, "users/test/meta": meta, "users/test/ropa_outfits": outs }, extra || {});
}

// ---------- Un puente de mentira ----------
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
function puenteFalso(o) {
  const est = Object.assign({ permitido: true, lista: true, version: 6, gasto: { mes: "2026-11", usd: 0.2, veces: 3, tope: 8 }, demora: 400, fallo: null, opinar: [], pedidos: [] }, o || {});
  est.de = ruta => est.pedidos.filter(x => x.ruta === ruta);
  est.rutas = async ctx => {
    await ctx.route(/open-meteo\.com/, r => r.abort());
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
      est.pedidos.push({ ruta, cuerpo });
      const json = (status, c) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      if (ruta === "/quien") return json(200, { permitido: est.permitido, uid: "test", lista: est.lista, gasto: est.gasto, version: est.version });
      if (ruta === "/opinion" || ruta === "/opinar") {
        await new Promise(r => setTimeout(r, est.demora));
        if (est.fallo) { const f = est.fallo; est.fallo = null; return json(f[0], f[1]); }
        est.gasto = Object.assign({}, est.gasto, { usd: Math.round((est.gasto.usd + 0.1) * 100) / 100 });
        if (ruta === "/opinion") return json(200, Object.assign({}, IA_OPINION, { gasto: est.gasto }));
        return json(200, Object.assign({ veredicto: "bien", funciona: "Va.", cambios: [], consejo: "" }, est.opinar.shift() || {}, { gasto: est.gasto }));
      }
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
const elegidas = p => p.$$eval("#roar-app [data-roar-x]", bs => bs.map(b => b.dataset.roarX));
const tocarPrenda = async (p, id) => { await p.click(`#roar-app [data-roar-p="${id}"]`); await p.waitForTimeout(150); };
const parte = async (p, id) => { await p.click(`#roar-app [data-roar-parte="${id}"]`); await p.waitForTimeout(150); };

// ---------- (1) a (3): lo que opina de tu ropero, en Compras ----------
async function repaso(browser, base) {
  console.log("\nLo que opina tu estilista de tu ropero (Compras, 390 px)");
  const pf = puenteFalso({ fallo: [502, { error: "respuesta", mensaje: "La IA contestó algo raro. Intenta de nuevo." }] });
  const p = await abrir(browser, base, { hash: "#ropa-compras", puente: pf });
  ok(/Lo que opina tu estilista/.test(await txt(p, "#rco-app .rop-op")) && await p.$('#rco-app [data-rop-o="pedir"]'), "en Compras: «Pedir su opinión»");
  ok(/12 centavos/.test(await txt(p, "#rco-app .rop-op")), "con lo que cuesta");
  ok(await p.evaluate(() => { const s = [...document.querySelectorAll("#rco-app section")]; return s.findIndex(x => x.classList.contains("rop-op")) < s.findIndex(x => /Qué te falta/.test(x.innerText)); }), "antes de «Qué te falta»");
  // Un error: lo dice y se puede pedir de nuevo.
  await p.click('#rco-app [data-rop-o="pedir"]');
  await p.waitForTimeout(100);
  ok(/mirando tu ropero/.test(await txt(p, "#rco-app .rop-op")), "mientras mira, lo dice");
  await p.waitForSelector("#rco-app .rop-op .rin-error", { timeout: 5000 });
  ok(/contestó algo raro/.test(await txt(p, "#rco-app .rop-op .rin-error")) && await p.$('#rco-app [data-rop-o="pedir"]'), "si falla, lo dice (y se puede pedir otra vez)");
  ok(!Object.keys(await col(p, "users/test/ropa_opiniones")).length, "y no guarda nada");
  // Ahora sí.
  await p.click('#rco-app [data-rop-o="pedir"]');
  await p.waitForSelector("#rco-app .rop-resumen", { timeout: 6000 });
  await p.waitForTimeout(300);
  const c = pf.de("/opinion")[1].cuerpo;
  ok(c.hechos.length >= 5 && c.hechos[0].id === "h1" && /^Tienes 8 prendas: 3 de arriba, 2 de abajo, 1 abrigo y 2 pares de zapatos\.$/.test(c.hechos[0].texto), `los números de Manolo (${c.hechos.length}; h1: «${c.hechos[0].texto}»)`);
  ok(c.ropero.find(x => x.id === "pol").veces === 2 && c.ropero.find(x => x.id === "cha").veces === 0 && !JSON.stringify(c.ropero).includes("notas"), "tu ropa, con las veces que te la pusiste");
  ok(c.ciudad === "La Paz" && c.memoria.join() === "Es friolento", "tu ciudad y lo que recuerda de ti");
  const ops = Object.values(await col(p, "users/test/ropa_opiniones"));
  ok(ops.length === 1 && ops[0].fecha === HOY && ops[0].n === 8 && ops[0].hechos.length === c.hechos.length && ops[0].ia.sugerencias.length === 2 && !("gasto" in ops[0].ia), "el repaso queda guardado (sin el gasto)");
  // Lo que se ve.
  ok(/buenas bases neutras/.test(await txt(p, "#rco-app .rop-resumen")), "el resumen");
  const ve = await txt(p, "#rco-app .rop-ve li:first-child");
  ok(/^Tienes 8 prendas/.test(ve) && /cada polera te da más outfits/.test(ve), "«Lo que ve»: el número de Manolo con lo que comenta tu estilista");
  const sug = await p.$$eval("#rco-app .rop-sug", els => els.map(el => el.innerText.replace(/\s+/g, " ")));
  ok(sug.length === 2 && /Chino beige/.test(sug[0]) && /Con tu ropa: \d+ outfits? nuevos? \(lo cuenta Manolo\)/.test(sug[0]), `«Lo que sumaría»: con cuántos outfits nuevos (${sug[0].match(/Con tu ropa:[^(]*/)})`);
  ok((await p.$$("#rco-app .rop-sug:first-child .rop-va a")).length === 3, "con las fotos de tu ropa con la que va");
  ok(await p.$eval("#rco-app .rop-sug:first-child a[target=_blank]", a => /pinterest\.com\/search\/pins\/\?q=chino/.test(a.href)), "«Ver opciones en Pinterest»");
  await p.click('#rco-app .rop-sug:first-child [data-rop-o="lista"]');
  await p.waitForTimeout(500);
  const deseos = Object.values(await col(p, "users/test/ropa_deseos"));
  ok(deseos.length === 1 && deseos[0].tipo === "Chino" && deseos[0].origen === "estilista" && /Aclara/.test(deseos[0].nota), "«A mi lista»: a tu lista de deseos");
  ok(/En tu lista/.test(await txt(p, "#rco-app .rop-sug:first-child")), "y ya dice que está en tu lista");
  ok(/Más poleras blancas/.test(await txt(p, "#rco-app .rop-op")), "qué no comprar más");
  ok(await p.$('#rco-app .rop-dejar a[href="#ropa-prenda/tela"]') && /solo un consejo/.test(await txt(p, "#rco-app .rop-op")), "podrías dejar de lado (con la foto; es solo un consejo)");
  ok((await p.$$("#rco-app .rop-colores li")).length === 3 && /Arremanga/.test(await txt(p, "#rco-app .rop-op")), "tus colores y los consejos");
  ok(/Pedirle otra opinión/.test(await txt(p, '#rco-app [data-rop-o="pedir"]')), "y «Pedirle otra opinión»");
  await captura(p, "opinion-390.png");
  sinErrores(p);
  await p.context().close();
  // (3) Lo guardado se ve sin la IA.
  const q = await abrir(browser, base, { hash: "#ropa-compras", seed: { "users/test/ropa_opiniones": { op1: Object.assign({ v: 1, creado: DIA("2026-11-20") }, ops[0]) } } });
  ok(/buenas bases neutras/.test(await txt(q, "#rco-app .rop-op")) && !(await q.$('#rco-app [data-rop-o="pedir"]')), "sin la IA, el último repaso se ve igual (sin «Pedir»)");
  sinErrores(q);
  await q.context().close();
  const r = await abrir(browser, base, { hash: "#ropa-compras" });
  ok(!(await r.$("#rco-app .rop-op")), "sin la IA y sin repaso: no aparece");
  await r.context().close();
}

// ---------- (4) "¿Qué opinas?" en Armar el mío ----------
async function opinarArmar(browser, base) {
  console.log("\n«¿Qué opinas?» en Armar el mío");
  const pf = puenteFalso({ opinar: [
    { veredicto: "cambiaria", funciona: "La polera blanca con el jean siempre funciona.", cambios: [{ sale: "zap", entra: "zn", porque: "Los zapatos negros lo hacen más prolijo." }], consejo: "Mete la polera adelante." },
    { veredicto: "muy-bien", funciona: "Ahora sí.", cambios: [], consejo: "" }
  ] });
  const p = await abrir(browser, base, { hash: "#ropa-armar", puente: pf });
  await tocarPrenda(p, "pol");
  ok(!(await p.$('#roar-app [data-roar="opinar"]')), "con una sola prenda, todavía no");
  await parte(p, "abajo"); await tocarPrenda(p, "jean");
  await parte(p, "zapatos"); await tocarPrenda(p, "zap");
  ok(await p.$('#roar-app [data-roar="opinar"]'), "«¿Qué opinas?» (tu estilista)");
  await p.click('#roar-app [data-roar="opinar"]');
  await p.waitForSelector(".rop-hoja-opinar .rop-mirando", { timeout: 3000 });
  ok(true, "mientras mira tu outfit, lo dice");
  await p.waitForSelector(".rop-hoja-opinar .rop-veredicto", { timeout: 5000 });
  const c = pf.de("/opinar")[0].cuerpo;
  ok(clave(c.outfit) === clave(["pol", "jean", "zap"]) && c.ocasion === "Casual" && /^Hoy \(lunes 23 de noviembre\)/.test(c.clima), "va tu outfit, la ocasión y el clima");
  ok(/Yo cambiaría algo/.test(await txt(p, ".rop-hoja-opinar .rop-veredicto")) && /siempre funciona/.test(await txt(p, ".rop-hoja-opinar .rop-funciona")), "el veredicto y qué funciona");
  ok((await p.$$(".rop-hoja-opinar .rop-cambio .ro-foto")).length === 2 && /Sale Zapatillas blancas/.test(await txt(p, ".rop-hoja-opinar .rop-cambio")) && /Entra Zapatos negros/.test(await txt(p, ".rop-hoja-opinar .rop-cambio")), "el cambio, con las fotos (sale → entra)");
  ok(/Mete la polera/.test(await txt(p, ".rop-hoja-opinar .rin-consejo")), "y un consejo");
  await captura(p, "opinar-390.png");
  await p.click('.rop-hoja-opinar [data-rop-h="cambiar"]');
  await p.waitForTimeout(500);
  ok(clave(await elegidas(p)) === clave(["pol", "jean", "zn"]) && !(await p.$(".rop-hoja-opinar:not([hidden])")), "«Cambiar»: lo aplica en un toque (y cierra la hoja)");
  ok(/Zapatillas blancas por Zapatos negros/.test(await toast(p)), "con su aviso");
  await deshacer(p);
  ok(clave(await elegidas(p)) === clave(["pol", "jean", "zap"]), "Deshacer: como estaba");
  // Lo mismo otra vez: sin pagar de nuevo; "Preguntarle otra vez", sí.
  await p.click('#roar-app [data-roar="opinar"]');
  await p.waitForSelector(".rop-hoja-opinar .rop-veredicto", { timeout: 3000 });
  ok(pf.de("/opinar").length === 1, "el mismo outfit otra vez: la misma respuesta, sin pagar de nuevo");
  await p.click('.rop-hoja-opinar [data-rop-h="otra"]');
  await p.waitForFunction(() => /Va muy bien/.test((document.querySelector(".rop-hoja-opinar .rop-veredicto") || {}).innerText || ""), null, { timeout: 5000 });
  ok(pf.de("/opinar").length === 2, "«Preguntarle otra vez»: pregunta de nuevo");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  sinErrores(p);
  await p.context().close();
}

// ---------- (5) Desde un guardado de Outfits ----------
async function opinarGuardado(browser, base) {
  console.log("\n«¿Qué opinas?» de un guardado");
  const pf = puenteFalso({ opinar: [{ veredicto: "bien", funciona: "Cómodo.", cambios: [{ sale: "pol", entra: "cam", porque: "La camisa lo sube un poco." }], consejo: "" }] });
  const p = await abrir(browser, base, { hash: "#ropa-outfits", puente: pf });
  await p.click('#rof-app [data-rof-g="o1"]');
  await p.waitForSelector('.rof-hoja-guardado [data-rof-h="opinar"]', { timeout: 3000 });
  await p.click('.rof-hoja-guardado [data-rof-h="opinar"]');
  await p.waitForSelector(".rop-hoja-opinar .rop-veredicto", { timeout: 5000 });
  ok(/Va bien/.test(await txt(p, ".rop-hoja-opinar .rop-veredicto")) && pf.de("/opinar")[0].cuerpo.ocasion === "Casual", "desde un guardado: la opinión de ese outfit");
  await p.click('.rop-hoja-opinar [data-rop-h="cambiar"]');
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => location.hash === "#ropa-armar") && clave(await elegidas(p)) === clave(["cam", "jean", "zap"]), "«Cambiar»: abre Armar el mío con el cambio hecho (para guardarlo)");
  sinErrores(p);
  await p.context().close();
  const q = await abrir(browser, base, { hash: "#ropa-outfits" });
  await q.click('#rof-app [data-rof-g="o1"]');
  await q.waitForSelector(".rof-hoja-guardado .rof-op-bot", { timeout: 3000 });
  ok(!(await q.$('.rof-hoja-guardado [data-rof-h="opinar"]')), "sin la IA: no aparece «¿Qué opinas?»");
  await q.keyboard.press("Escape");
  await ir(q, "ropa-armar");
  ok(!(await q.$('#roar-app [data-roar="opinar"]')), "ni en Armar el mío");
  sinErrores(q);
  await q.context().close();
}

// ---------- (7) A 320 px, en oscuro y en claro ----------
async function chico(browser, base, esquema) {
  const nombre = esquema === "light" ? "claro" : "oscuro";
  console.log(`\nA 320 px, en ${nombre}`);
  const op = { op1: { v: 1, fecha: "2026-11-20", creado: DIA("2026-11-20"), n: 8, hechos: [{ id: "h1", texto: "Tienes 8 prendas: 3 de arriba, 2 de abajo, 1 abrigo y 2 pares de zapatos." }, { id: "h2", texto: "Tus colores: blanco (38 %), negro (25 %) y azul (13 %)." }], ia: IA_OPINION } };
  const pf = puenteFalso({ opinar: [{ veredicto: "cambiaria", funciona: "Funciona.", cambios: [{ sale: "zap", entra: "zn", porque: "Más prolijo." }], consejo: "Un consejo." }] });
  const p = await abrir(browser, base, { hash: "#ropa-compras", ancho: 320, esquema, puente: pf, seed: { "users/test/ropa_opiniones": op } });
  ok(await sobra(p) <= 0, "Compras con la opinión: nada se sale a lo ancho");
  const chicos = await p.$$eval("#rco-app .rop-op button, #rco-app .rop-op a",
    els => els.filter(e => e.getClientRects().length && !e.closest(".rop-va")).filter(e => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).map(e => e.className || e.textContent.trim()));
  ok(!chicos.length, `todo se toca bien con el dedo${chicos.length ? `: ${chicos.slice(0, 3).join(", ")}` : ""}`);
  let malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, `opinion-320-${nombre}.png`);
  await ir(p, "ropa-armar");
  await tocarPrenda(p, "pol");
  await parte(p, "abajo"); await tocarPrenda(p, "jean");
  await parte(p, "zapatos"); await tocarPrenda(p, "zap");
  await p.click('#roar-app [data-roar="opinar"]');
  await p.waitForSelector(".rop-hoja-opinar .rop-veredicto", { timeout: 5000 });
  await p.waitForTimeout(300);
  ok(await sobra(p) <= 0, "«¿Qué opinas?»: nada se sale");
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `«¿Qué opinas?»: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, `opinar-320-${nombre}.png`);
  sinErrores(p);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await repaso(browser, base);
  await opinarArmar(browser, base);
  await opinarGuardado(browser, base);
  for (const esquema of ["dark", "light"]) await chico(browser, base, esquema);
  await terminar(browser, srv);
})();
