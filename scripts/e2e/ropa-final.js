// Pruebas de pantalla de Ropa, fase 7: revisión final (D-152; docs/ROPA.md).
// (1) La IA sin internet: abres Manolo sin internet y Ajustes de Ropa lo dice
// (no se queda "revisando"); al agregar una foto, la IA avisa que no hay
// internet (sin pedirle nada al puente) y la llenas a mano; quien no es el
// dueño no ve ese aviso; cuando vuelve internet, la IA se conecta sola; y si
// se corta con la IA ya conectada, lo dice. (2) Todas las pantallas de Ropa
// con un ropero lleno (el ropero, una ficha, Outfits, Inspiración, un pin,
// Compras, Tus números y Ajustes) a 320 px en oscuro, a 390 px en claro y en
// la compu: nada se sale a lo ancho, cada una con su título, la barra marca
// lo que corresponde, cada texto se lee bien (contraste) y sin errores.
// Uso: node scripts/e2e/ropa-final.js [carpeta-para-capturas]
const fs = require("node:fs");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const ir = (p, h) => p.evaluate(x => { location.hash = x; window.scrollTo(0, 0); }, h);
const CLIMA = JSON.parse(fs.readFileSync(path.join(__dirname, "../../tests/fixtures/clima/la-paz-2026-11-23.json"), "utf8"));

// Antes que la app: un "internet" que la prueba prende y apaga
// (navigator.onLine y los eventos online/offline).
function internet() {
  let hay = localStorage.getItem("__INTERNET__") !== "no";
  Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => hay });
  window.__internet = v => { hay = v; window.dispatchEvent(new Event(v ? "online" : "offline")); };
}
async function abrir(browser, base, estado, o) {
  const p = await abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA, init: internet }, o));
  // Con el reloj fijo, justo al abrir, el primer $eval de Playwright a veces lee
  // la página sin estilos (vacíos): espera a que los lea antes de seguir.
  for (let k = 0; k < 30 && !(await p.$eval("body", b => getComputedStyle(b).display).catch(() => "")); k++) await p.waitForTimeout(100);
  return p;
}

// ---------- Un puente de mentira (cuenta lo que le piden) ----------
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const JEAN = { esPrenda: true, varias: false, grupo: "abajo", tipo: "Jean", colores: ["azul-jean"], estampado: "liso", tela: "Jean", estilo: ["casual"], clima: ["frio", "templado"], formalidad: 2, marca: "" };
function puenteFalso() {
  const est = { pedidos: [] };
  est.de = ruta => est.pedidos.filter(r => r === ruta).length;
  est.rutas = async ctx => {
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      est.pedidos.push(ruta);
      const json = (status, c) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      const gasto = { mes: "2026-11", usd: 0.12, veces: 3, tope: 8 };
      if (ruta === "/quien") return json(200, { permitido: true, uid: "test", lista: true, version: 3, gasto });
      if (ruta === "/describir") return json(200, { prenda: JEAN, gasto });
      return json(404, { error: "ruta" });
    });
    await ctx.route(/open-meteo\.com/, r => r.abort());
  };
  return est;
}
// Elige una foto en el "+" (como si la sacaras): una prenda azul sobre gris.
async function agregarFoto(p) {
  await p.locator("[data-ropa-mas]").locator("visible=true").first().click();
  await p.waitForSelector(".ro-hoja-mas:not([hidden]) [data-ro-fotos]", { state: "attached", timeout: 4000 });
  await p.waitForTimeout(250);
  await p.evaluate(() => new Promise(res => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
    const g = c.getContext("2d");
    g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, 900, 1200);
    g.fillStyle = "#4f6f9a"; g.fillRect(250, 200, 400, 800);
    c.toBlob(b => {
      const dt = new DataTransfer();
      dt.items.add(new File([b], "prenda.jpg", { type: "image/jpeg" }));
      const inp = document.querySelector(".ro-hoja-mas [data-ro-fotos]");
      inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      res();
    }, "image/jpeg", 0.9);
  }));
  await p.waitForSelector(".ro-hoja-form .ro-form", { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(200);
}
const DUENO = JSON.stringify({ uid: "test", permitido: true, lista: true });

// ---------- (1) La IA sin internet ----------
async function sinInternet(browser, base) {
  console.log("\nLa IA sin internet (con un puente de mentira)");
  // Abres Manolo sin internet (la última vez, la IA estaba conectada).
  let est = puenteFalso();
  let p = await abrir(browser, base, { __SEED__: {}, "manolo.puente": PUENTE, "manolo.ropa.ia": DUENO, __INTERNET__: "no" }, { hash: "#ropa-ajustes", ancho: 390, rutas: est.rutas });
  await p.waitForTimeout(500);
  const sin = await txt(p, "#roa-app .roa-ia");
  ok(/Sin internet: la IA necesita conexión\. Tu ropero funciona igual/.test(sin) && !/Revisando/.test(sin), `Ajustes lo dice (${sin})`);
  ok(est.de("/quien") === 0, "y no le pide nada al puente");
  await captura(p, "final-ia-sin-internet.png");
  await agregarFoto(p);
  ok(/Sin internet: la IA no puede mirar la foto\. Llénala a mano\./.test(await txt(p, ".ro-hoja-form")) && est.de("/describir") === 0, "al agregar una foto: la IA avisa que no hay internet (y la llenas a mano)");
  await captura(p, "final-ia-sin-internet-foto.png");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  // Vuelve internet: la IA se conecta sola.
  await p.evaluate(() => window.__internet(true));
  await p.waitForTimeout(700);
  ok(est.de("/quien") === 1 && /La IA está conectada/.test(await txt(p, "#roa-app .roa-ia")), "vuelve internet: la IA se conecta sola");
  // Se corta con la IA ya conectada: lo dice; la foto, igual.
  await p.evaluate(() => window.__internet(false));
  await p.waitForTimeout(300);
  ok(/La IA está conectada\. Sin internet ahora: la IA vuelve cuando tengas conexión\./.test(await txt(p, "#roa-app .roa-ia")), "se corta: «Sin internet ahora»");
  await agregarFoto(p);
  ok(/Sin internet: la IA no puede mirar la foto\./.test(await txt(p, ".ro-hoja-form")) && !/La IA no pudo/.test(await txt(p, ".ro-hoja-form")) && est.de("/describir") === 0, "y la foto: sin internet");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();

  // Quien no es el dueño (o nunca se conectó): sin internet, no ve avisos de la IA.
  est = puenteFalso();
  p = await abrir(browser, base, { __SEED__: {}, "manolo.puente": PUENTE, "manolo.ropa.ia": JSON.stringify({ uid: "test", permitido: false, lista: true }), __INTERNET__: "no" }, { hash: "#ropa", ancho: 390, rutas: est.rutas });
  await p.waitForTimeout(400);
  await agregarFoto(p);
  ok(!/La IA/.test(await txt(p, ".ro-hoja-form")), "quien no es el dueño: el formulario sin avisos de la IA");
  await p.context().close();
  // Con internet y el puente caído: el error, no "revisando" para siempre.
  p = await abrir(browser, base, { __SEED__: {}, "manolo.puente": PUENTE }, { hash: "#ropa-ajustes", ancho: 390, rutas: async ctx => { await ctx.route(`${PUENTE}/**`, r => r.abort()); } });
  await p.waitForTimeout(700);
  ok(/No pude conectarme\. Revisa tu conexión\. Reintentar/.test(await txt(p, "#roa-app .roa-ia")), `el puente no contesta: lo dice, con «Reintentar» (${await txt(p, "#roa-app .roa-ia")})`);
  await p.context().close();
}

// ---------- (2) Todas las pantallas de Ropa ----------
const svg = (fondo, color) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${fondo}"/><path d="M30 20h40l12 16-8 5-2 45H28l-2-45-8-5Z" fill="${color}"/></svg>`);
const DIA = f => Date.parse(`${f}T12:00:00Z`);
function semilla() {
  const ropa = {};
  [["arriba", "Polera", "blanco", "#f4f4f2"], ["arriba", "Camisa", "celeste", "#8fc3ea"], ["abajo", "Jean", "azul-jean", "#4f6f9a"], ["abajo", "Pantalón de tela", "negro", "#151515"],
   ["abrigos", "Chamarra", "verde-oliva", "#6b7134"], ["zapatos", "Zapatillas", "blanco", "#f4f4f2"], ["accesorios", "Gorra", "negro", "#151515"], ["arriba", "Chompa", "bordo", "#6e1f2c"]]
    .forEach(([grupo, tipo, color, hex], k) => {
      ropa[`p${k}`] = { v: 1, grupo, tipo, colores: [{ id: color }], estampado: "liso", tela: k % 2 ? "Algodón" : "", estilo: ["casual"], clima: ["templado"], formalidad: 2, marca: k === 0 ? "Basement" : "",
        precio: [120, 0, 280, 0, 650, 400, 0, 0][k] || null, compra: k === 0 ? "2026-11-05" : k === 2 ? "2026-02-10" : "", notas: "", fotos: [{ id: `f${k}`, mini: svg("#e9e4da", hex), ancho: 900, alto: 1200 }],
        estado: k === 6 ? "lavar" : "activa", creado: DIA("2026-01-10") + k };
    });
  const usos = {};
  [["2026-11-22", ["p0", "p2", "p5"]], ["2026-11-20", ["p1", "p3", "p5"]], ["2026-11-18", ["p0", "p2", "p5"]], ["2026-10-30", ["p4", "p2"]], ["2026-07-01", ["p7"]]]
    .forEach(([f, ids]) => { usos[f] = { prendas: ids, actualizado: DIA(f) }; });
  const v = (grupo, tipo, colores) => ({ grupo, tipo, colores, estampado: "liso", tela: "", detalle: "" });
  const pin = (id, titulo, prendas, hex, k) => ({ v: 1, via: "tablero", creado: DIA("2026-11-20") - k * 3600e3, pin: { id, url: `https://www.pinterest.com/pin/${id}/`, titulo, img: "", fecha: 1000 - k },
    fotos: [{ id: `i${id}`, mini: svg("#ece6dc", hex), ancho: 736, alto: 1104 }], ia: { fecha: "2026-11-22" },
    analisis: { esRopa: true, resumen: titulo, estilo: ["casual"], clima: ["frio"], formalidad: 2, ocasion: "salir", prendas } });
  const insp = {
    "pin-1": pin("1", "Abrigo camel y jean", [v("abrigos", "Abrigo", ["camel"]), v("arriba", "Polera", ["blanco"]), v("abajo", "Jean", ["azul-jean"]), v("zapatos", "Botines", ["cafe"])], "#c19a6b", 1),
    "pin-2": pin("2", "Camel para la oficina", [v("abrigos", "Abrigo", ["camel"]), v("arriba", "Camisa", ["celeste"]), v("abajo", "Pantalón de tela", ["negro"]), v("zapatos", "Botines", ["cafe"])], "#c19a6b", 2),
    "pin-3": pin("3", "Bordó y negro", [v("arriba", "Chompa", ["bordo"]), v("abajo", "Pantalón de tela", ["negro"]), v("zapatos", "Zapatillas", ["blanco"])], "#6e1f2c", 3)
  };
  const outfits = { o1: { prendas: ["p1", "p2", "p5"], nombre: "Oficina fresca", ocasion: "trabajo", origen: "reglas", porque: "Celeste con jean: fresco y prolijo.", guardado: true, gusto: "si", para: "2026-11-23", puesto: ["2026-11-20"], creado: DIA("2026-11-19") } };
  const deseos = { "w-1": { v: 1, grupo: "abrigos", tipo: "Abrigo", colores: ["camel"], nota: "", inspiraciones: ["pin-1", "pin-2"], origen: "falta", estado: "quiero", creado: 1, editado: 1 } };
  const meta = { ropa_ajustes: { presupuestoMes: 800, ciudad: { nombre: "La Paz", lat: -16.5, lon: -68.15 },
    estilo: { resumen: "Casual con un toque urbano: camel, negro y blanco.", claves: ["casual", "colores sobrios"], colores: ["camel", "negro", "blanco"], prendas: ["Abrigo", "Jean"], fecha: "2026-11-22", pines: 3 } } };
  return { "users/test/ropa": ropa, "users/test/ropa_usos": usos, "users/test/ropa_inspiracion": insp, "users/test/ropa_outfits": outfits, "users/test/ropa_deseos": deseos, "users/test/meta": meta };
}
// La pantalla, lo que tiene que verse y la pestaña marcada (en el teléfono).
const PANTALLAS = [
  ["ropa", "#ro-lista .ro-card", "ropa"],
  ["ropa-prenda/p0", "#rop-app .ro-ficha-t", "ropa"],
  ["ropa-outfits", "#rof-app .rof-clima-r", "ropa-outfits"],
  ["ropa-inspiracion", "#rin-app .rin-card", "ropa-inspiracion"],
  ["ropa-pin/pin-1", "#rinp-app", "ropa-inspiracion"],
  ["ropa-compras", "#rco-app .rco-item", "ropa-compras"],
  ["ropa-numeros", "#rn-app .rn-cifras", "ropa"],
  ["ropa-ajustes", "#roa-app .roa-ia", null]
];
async function recorrido(browser, base, o) {
  console.log(`\nTodas las pantallas de Ropa (${o.ancho} px, ${o.esquema === "light" ? "claro" : "oscuro"})`);
  const seed = semilla();
  const clima = JSON.stringify({ k: "-16.5,-68.15", hora: Date.parse(FECHA), json: CLIMA });
  const p = await abrir(browser, base, { __SEED__: seed, "manolo.ropa.clima": clima }, { hash: "#ropa", ancho: o.ancho, alto: o.alto || 844, esquema: o.esquema,
    rutas: async ctx => { await ctx.route(/open-meteo\.com/, r => r.abort()); } });
  await p.waitForTimeout(600);
  const malas = { ancho: [], titulo: [], pestana: [], contraste: [] };
  for (const [hash, sel, tab] of PANTALLAS) {
    await ir(p, hash);
    await p.waitForSelector(sel, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(700);
    const nombre = hash.split("/")[0];
    if ((await sobra(p)) > 0) malas.ancho.push(nombre);
    const titulo = await p.evaluate(() => [...document.querySelectorAll("section[id^='panel-']:not([hidden]) h1")].some(h => h.getClientRects().length && h.textContent.trim()));
    if (!titulo || !(await p.isVisible(sel))) malas.titulo.push(nombre);
    if (o.ancho < 900 && tab) {
      const marcada = await p.$$eval("#bottom-nav-links a.active", as => as.map(a => a.dataset.hash));
      if (marcada.join() !== tab) malas.pestana.push(`${nombre} (${marcada.join() || "ninguna"})`);
    }
    const c = await p.evaluate(auditarContraste);
    if (c.length) malas.contraste.push(`${nombre}: ${c.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}`);
    if (CAPTURAS && o.capturas) await p.screenshot({ path: path.join(CAPTURAS, `final-${o.esquema === "light" ? "claro" : "oscuro"}-${o.ancho}-${nombre}.png`) });
  }
  ok(!malas.ancho.length, `nada se sale a lo ancho${malas.ancho.length ? `: ${malas.ancho.join(", ")}` : ""}`);
  ok(!malas.titulo.length, `cada pantalla con su título y lo suyo a la vista${malas.titulo.length ? `: ${malas.titulo.join(", ")}` : ""}`);
  if (o.ancho < 900) ok(!malas.pestana.length, `la barra marca lo que corresponde${malas.pestana.length ? `: ${malas.pestana.join(", ")}` : ""}`);
  ok(!malas.contraste.length, `cada texto se lee bien${malas.contraste.length ? `: ${malas.contraste.join(" | ")}` : ""}`);
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await sinInternet(browser, base);
  await recorrido(browser, base, { ancho: 390, esquema: "dark", capturas: true });
  await recorrido(browser, base, { ancho: 320, esquema: "dark" });
  await recorrido(browser, base, { ancho: 390, esquema: "light", capturas: true });
  await recorrido(browser, base, { ancho: 1280, alto: 900, esquema: "dark" });
  await terminar(browser, srv);
})();
