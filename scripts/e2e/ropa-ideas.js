// Pruebas de pantalla de Ropa: ideas de tu estilista en Inspiración (D-164;
// pedido del dueño: que la IA le sugiera prendas según lo que le falta a su
// ropero, más allá de Pinterest).
// (1) Arriba de Inspiración: las prendas que sugirió en su último repaso (sin
// lo que ya tienes), con por qué, "Así lo usarías" (tu ropa y la nueva),
// cuántos outfits nuevos, "A mi lista" (con Deshacer) y "Ver ideas en
// Pinterest". (2) "Pedirle ideas nuevas": el repaso (el mismo de Compras),
// mientras mira lo dice. (3) Sin repaso: cómo pedirlas; sin la IA y sin
// repaso, no aparece; sin la IA, lo guardado se ve igual. (4) Si el tablero no
// se puede leer, el mensaje dice qué pasó. (5) A 320 px en oscuro y en claro.
// Uso: node scripts/e2e/ropa-ideas.js [carpeta-para-capturas]
const fs = require("node:fs");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";
const CLIMA = JSON.parse(fs.readFileSync(path.join(__dirname, "../../tests/fixtures/clima/la-paz-2026-11-23.json"), "utf8"));
const CLIMA_GUARDADO = JSON.stringify({ k: "-16.5,-68.15", hora: Date.parse(FECHA), json: CLIMA });
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const col = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const deshacer = async p => { await p.click("#ro-toast .undo-toast-btn"); await p.waitForTimeout(400); };
const sinErrores = p => ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
const contraste = async (p, que) => {
  const malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `${que}: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
};

// ---------- Tu ropa y el último repaso de tu estilista ----------
const FORMAS = {
  polera: "M28 22h13q9 7 18 0h13l15 13-9 11-7-5v43H29V41l-7 5-9-11Z", chompa: "M30 20h40l10 8 7 46-9 2-6-34v46H28V42l-6 34-9-2 7-46Z",
  chamarra: "M30 18h40l11 9 7 47-9 2-7-33v45H28V43l-7 33-9-2 7-47Z", pantalon: "M31 12h38l5 77H56l-6-52-6 52H26Z",
  zapatos: "M12 60q12-2 22-15l10 6q14 9 36 11 9 1 9 12v5H12Z"
};
const svg = (forma, hex) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="#ebe6dc"/><path transform="translate(-5 10)" d="${FORMAS[forma]}" fill="${hex}"/></svg>`);
const DIA = f => Date.parse(`${f}T12:00:00Z`);
const ROPA = {
  pol: ["arriba", "Polera", "blanco", "#f4f4f2", "polera", {}], cam: ["arriba", "Camisa", "celeste", "#8fc3ea", "polera", { formalidad: 3 }],
  cho: ["arriba", "Chompa", "bordo", "#6e1f2c", "chompa", { clima: ["frio"] }],
  jean: ["abajo", "Jean", "azul-jean", "#4f6f9a", "pantalon", { formalidad: 2 }], tela: ["abajo", "Pantalón de tela", "negro", "#1b1b1b", "pantalon", { formalidad: 4 }],
  cha: ["abrigos", "Chamarra", "verde-oliva", "#6b7134", "chamarra", { clima: ["frio"] }],
  zap: ["zapatos", "Zapatillas", "blanco", "#f4f4f2", "zapatos", { formalidad: 1 }], zn: ["zapatos", "Zapatos", "negro", "#151515", "zapatos", { formalidad: 4 }]
};
const sug = (grupo, tipo, color, porque, combina) => ({ grupo, tipo, color, porque, combina: combina || [] });
const IA_REPASO = {
  resumen: "Buenas bases neutras; te faltan opciones abajo.", comentarios: [],
  sugerencias: [sug("abajo", "Chino", "beige", "Aclara tus outfits y va con casi todo lo de arriba.", ["pol", "cam"]), sug("zapatos", "Botines", "cafe", "Para el frío y la lluvia de La Paz.", ["jean"]),
    sug("abrigos", "Rompevientos", "azul-marino", "Para el viento de la tarde.", ["pol"]), sug("abajo", "Jean", "azul-jean", "Un básico.", [])],
  noComprar: [], dejar: [], colores: { van: ["negro"], sumar: ["beige"], porque: "" }, consejos: []
};
const OPINION = { op1: { v: 1, fecha: "2026-11-20", creado: DIA("2026-11-20"), n: 8, hechos: [{ id: "h1", texto: "Tienes 8 prendas." }], ia: IA_REPASO } };
function semilla(extra) {
  const ropa = {};
  Object.entries(ROPA).forEach(([id, [grupo, tipo, color, hex, forma, x]], k) => {
    ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estampado: "liso", tela: "", estilo: ["casual"], clima: ["templado"], formalidad: null, marca: "", notas: "",
      fotos: [{ id: `f-${id}`, mini: svg(forma, hex), ancho: 900, alto: 1200 }], estado: "activa", creado: DIA("2026-10-01") + k }, x);
  });
  const meta = { ropa_ajustes: { ciudad: { nombre: "La Paz", lat: -16.5, lon: -68.15 } } };
  return Object.assign({ "users/test/ropa": ropa, "users/test/meta": meta, "users/test/ropa_opiniones": OPINION }, extra || {});
}

// ---------- Un puente de mentira (como el 7) ----------
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
function puenteFalso(o) {
  const est = Object.assign({ pedidos: [], demora: 500, repaso: null }, o || {});
  est.rutas = async ctx => {
    await ctx.route(/open-meteo\.com/, r => r.abort());
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      est.pedidos.push({ ruta, cuerpo: req.postData() ? JSON.parse(req.postData()) : null });
      const gasto = { mes: "2026-11", usd: 0.2, veces: 3, tope: 8 };
      const json = (status, c) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      if (ruta === "/quien") return json(200, { permitido: true, uid: "test", lista: true, gasto, version: 7 });
      if (ruta === "/opinion") {
        await new Promise(r => setTimeout(r, est.demora));
        return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: "   " + JSON.stringify(Object.assign({}, est.repaso || IA_REPASO, { gasto })) });
      }
      if (ruta === "/pinterest/tablero") return json(502, { error: "pinterest-bloqueo", mensaje: "Pinterest no dejó leer tu tablero desde el puente (respondió 403). Mientras, sube capturas de tus pines con el + o pídele ideas a tu estilista.", detalle: { paso: "rss", status: 403 } });
      return json(404, { error: "ruta", mensaje: "No existe." });
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
const ideas = p => p.$$eval("#rin-app .rid-idea", els => els.map(el => el.querySelector(".rid-t").innerText.trim()));

// ---------- (1) y (2) ----------
async function conRepaso(browser, base) {
  console.log("\nIdeas de tu estilista en Inspiración (390 px)");
  const pf = puenteFalso({ repaso: Object.assign({}, IA_REPASO, { sugerencias: [sug("arriba", "Camisa de lino", "blanco", "Fresca para el mediodía.", ["jean"]), sug("abajo", "Chino", "beige", "Sigue faltando.", [])] }) });
  const p = await abrir(browser, base, { hash: "#ropa-inspiracion", puente: pf });
  ok(/^Ideas de tu estilista/.test(await txt(p, "#rin-app .rid-sec")), "arriba de Inspiración: «Ideas de tu estilista»");
  ok(await p.evaluate(() => { const a = document.querySelector("#rin-app .rid-sec"), t = document.querySelector("#rin-app .rin-tablero"); return !!(a && t && (a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)); }), "antes de tu tablero de Pinterest");
  const xs = await ideas(p);
  ok(xs.join(" | ") === "Chino beige | Botines cafés | Rompevientos azul marino", `las prendas que sugirió, sin lo que ya tienes (${xs.join(" | ")})`);
  const t0 = await txt(p, "#rin-app .rid-idea:nth-child(1)");
  ok(/Aclara tus outfits/.test(t0), "con su porqué");
  ok(await p.$$eval("#rin-app .rid-idea:nth-child(1) .rid-asi li", li => li.length) >= 3 && await p.$("#rin-app .rid-idea:nth-child(1) .rid-asi .rid-nueva"), "«Así lo usarías»: tus prendas y la nueva");
  ok(/Chino beige \(nuevo\)/.test(await txt(p, "#rin-app .rid-idea:nth-child(1) .rid-asi-n")) && /Botines cafés \(nuevos\)/.test(await txt(p, "#rin-app .rid-idea:nth-child(2) .rid-asi-n")) && !/Jean/.test(await txt(p, "#rin-app .rid-idea:nth-child(1) .rid-asi-n")), "en palabras, con la nueva (y sin otro de abajo)");
  ok(/Con tu ropa: \d+ outfits? nuevos?/.test(t0), "cuántos outfits nuevos te da");
  const pin = await p.$eval('#rin-app .rid-idea:nth-child(1) a[href*="pinterest.com/search"]', a => [a.getAttribute("href"), a.getAttribute("target")]);
  ok(/q=chino%20beige%20outfit/.test(pin[0]) && pin[1] === "_blank", "«Ver ideas en Pinterest»: una búsqueda (sin conectar tu tablero)");
  ok(/Del viernes 20 de noviembre/.test(await txt(p, "#rin-app .rid-fecha")) && await p.$('#rin-app .rid-fecha a[href="#ropa-compras"]'), "de cuándo es, y todo lo que opina en Compras");
  await captura(p, "ideas-390.png");
  // A mi lista.
  await p.click('#rin-app .rid-idea:nth-child(1) [data-rid="lista"]');
  await p.waitForTimeout(500);
  let deseos = Object.values(await col(p, "users/test/ropa_deseos"));
  ok(/Chino beige está en tu lista de deseos/.test(await toast(p)) && deseos.length === 1 && deseos[0].origen === "estilista" && /Aclara/.test(deseos[0].nota), "«A mi lista» (de tu estilista, con su porqué)");
  ok(/En tu lista/.test(await txt(p, "#rin-app .rid-idea:nth-child(1) .rco-bot")), "y queda «En tu lista»");
  await deshacer(p);
  ok(!Object.keys(await col(p, "users/test/ropa_deseos")).length, "Deshacer");
  // Pedirle ideas nuevas.
  ok(/Unos 12 centavos/.test(await txt(p, "#rin-app .rid-sec")), "«Pedirle ideas nuevas», con lo que cuesta");
  await p.click('#rin-app [data-rid="pedir"]');
  await p.waitForTimeout(150);
  ok(/mirando tu ropero/.test(await txt(p, "#rin-app .rid-sec")), "mientras mira, lo dice");
  await p.waitForSelector("#rin-app .rid-idea", { timeout: 6000 });
  await p.waitForTimeout(300);
  ok((await ideas(p)).join(" | ") === "Camisa de lino blanca | Chino beige", `las ideas nuevas (${(await ideas(p)).join(" | ")})`);
  ok(/tu estilista te dio ideas nuevas/.test(await toast(p)), "y lo dice");
  const c = (pf.pedidos.find(x => x.ruta === "/opinion") || {}).cuerpo;
  ok(c && c.ropero.length === 8 && Array.isArray(c.hechos) && c.hechos.length >= 3 && !JSON.stringify(c.ropero).includes("notas"), "al puente, lo mismo que el repaso de Compras (tu ropa sin notas, los números de Manolo)");
  ok(Object.keys(await col(p, "users/test/ropa_opiniones")).length === 2, "queda guardado (es el mismo repaso)");
  await ir(p, "ropa-compras");
  ok(/Camisa de lino blanca/.test(await txt(p, "#rco-app .rop-op")), "en Compras, lo mismo");
  sinErrores(p);
  await p.context().close();
}

// ---------- (3) y (4) ----------
async function sinRepaso(browser, base) {
  console.log("\nSin repaso, sin la IA y el tablero (390 px)");
  let p = await abrir(browser, base, { hash: "#ropa-inspiracion", puente: puenteFalso(), seed: { "users/test/ropa_opiniones": {} } });
  ok(/No hace falta Pinterest/.test(await txt(p, "#rin-app .rid-sec")) && /Pedirle ideas/.test(await txt(p, '#rin-app [data-rid="pedir"]')), "sin repaso: qué hace y «Pedirle ideas»");
  // El tablero: el mensaje dice qué pasó.
  await p.click('#rin-app [data-rin="conectar"]');
  await p.waitForSelector(".rin-hoja-tablero [name=link]", { timeout: 3000 });
  await p.fill(".rin-hoja-tablero [name=link]", "https://www.pinterest.com/usuario/mi-tablero/");
  await p.click('.rin-hoja-tablero button[type="submit"]');
  await p.waitForTimeout(800);
  ok(/no dejó leer tu tablero desde el puente \(respondió 403\)/.test(await txt(p, ".rin-hoja-tablero [data-rin-error]")), "el tablero: el mensaje dice qué pasó");
  sinErrores(p);
  await p.context().close();
  p = await abrir(browser, base, { hash: "#ropa-inspiracion", seed: { "users/test/ropa_opiniones": {} } });
  ok(!(await p.$("#rin-app .rid-sec")), "sin la IA y sin repaso: no aparece");
  await p.context().close();
  p = await abrir(browser, base, { hash: "#ropa-inspiracion" });
  ok((await ideas(p)).length === 3 && !(await p.$('#rin-app [data-rid="pedir"]')), "sin la IA, lo guardado se ve igual (sin pedir más)");
  sinErrores(p);
  await p.context().close();
}

// ---------- (5) A 320 px, en oscuro y en claro ----------
async function chico(browser, base, esquema) {
  const nombre = esquema === "light" ? "claro" : "oscuro";
  console.log(`\nA 320 px, en ${nombre}`);
  const p = await abrir(browser, base, { hash: "#ropa-inspiracion", ancho: 320, esquema, puente: puenteFalso() });
  ok(await sobra(p) <= 0, "Inspiración con las ideas: nada se sale a lo ancho");
  const chicos = await p.$$eval("#rin-app .rid-sec button, #rin-app .rid-sec .rco-bot a", els => els.filter(e => { const r = e.getBoundingClientRect(); return r.height < 40; }).length);
  ok(!chicos, "los botones se tocan bien con el dedo");
  await contraste(p, "Inspiración");
  await p.$eval("#rin-app .rid-idea", el => el.scrollIntoView({ block: "start" }));
  await p.evaluate(() => window.scrollBy(0, -70));
  await captura(p, `ideas-320-${nombre}.png`);
  sinErrores(p);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await conRepaso(browser, base);
  await sinRepaso(browser, base);
  for (const esquema of ["dark", "light"]) await chico(browser, base, esquema);
  await terminar(browser, srv);
})();
