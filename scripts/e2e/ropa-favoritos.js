// Pruebas de pantalla de Ropa: tus favoritos (D-163; pedido del dueño: "Que
// en outfits haya un espacio de outfits favoritos").
// (1) Outfits: "Tus favoritos" antes de "Guardados" (sin ninguno, cómo se
// suman); el corazón de cada opción (con aviso y Deshacer); un favorito ya no
// se repite en "Guardados"; "No me gusta" lo saca. (2) En grande (una opción,
// un guardado, un día del calendario): el corazón se prende y se apaga ahí
// mismo; "Quitar de guardados" solo si está guardado; "Me lo pongo hoy" desde
// un favorito. (3) Armar el mío: "A favoritos" (con su nombre); al editar un
// favorito, el nuevo es el favorito. (4) Tu estilista: el corazón en cada
// outfit; tus favoritos le llegan primero a la IA. (5) A 320 px en oscuro y en
// claro.
// Uso: node scripts/e2e/ropa-favoritos.js [carpeta-para-capturas]
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
const outfits = p => col(p, "users/test/ropa_outfits");
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const deshacer = async p => { await p.click("#ro-toast .undo-toast-btn"); await p.waitForTimeout(400); };
const sinErrores = p => ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
const cerrar = async p => { await p.keyboard.press("Escape"); await p.waitForTimeout(400); };
const clave = ids => [...ids].sort().join("|");
const favoritos = p => p.$$eval("#rof-app .rof-favs-s .rof-g", bs => bs.map(b => b.dataset.rofG));
const guardados = p => p.$$eval('#rof-app section[aria-labelledby="rof-g-t"] .rof-g', bs => bs.map(b => b.dataset.rofG));
const pulsado = (p, sel) => p.$eval(sel, b => b.getAttribute("aria-pressed")).catch(() => null);

// ---------- Tu ropa, tus guardados y un día ----------
const FORMAS = {
  polera: "M28 22h13q9 7 18 0h13l15 13-9 11-7-5v43H29V41l-7 5-9-11Z", chompa: "M30 20h40l10 8 7 46-9 2-6-34v46H28V42l-6 34-9-2 7-46Z",
  chamarra: "M30 18h40l11 9 7 47-9 2-7-33v45H28V43l-7 33-9-2 7-47Z", pantalon: "M31 12h38l5 77H56l-6-52-6 52H26Z",
  zapatos: "M12 60q12-2 22-15l10 6q14 9 36 11 9 1 9 12v5H12Z"
};
const svg = (forma, hex) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="#ebe6dc"/><path transform="translate(-5 10)" d="${FORMAS[forma]}" fill="${hex}"/></svg>`);
const DIA = f => Date.parse(`${f}T12:00:00Z`);
const AHORA = Date.parse(FECHA);
const ROPA = {
  pol: ["arriba", "Polera", "blanco", "#f4f4f2", "polera", {}], cam: ["arriba", "Camisa", "celeste", "#8fc3ea", "polera", { formalidad: 3 }],
  cho: ["arriba", "Chompa", "bordo", "#6e1f2c", "chompa", { clima: ["frio"] }],
  jean: ["abajo", "Jean", "azul-jean", "#4f6f9a", "pantalon", { formalidad: 2 }], tela: ["abajo", "Pantalón de tela", "negro", "#1b1b1b", "pantalon", { formalidad: 4 }],
  cha: ["abrigos", "Chamarra", "verde-oliva", "#6b7134", "chamarra", { clima: ["frio"] }],
  zap: ["zapatos", "Zapatillas", "blanco", "#f4f4f2", "zapatos", { formalidad: 1 }], zn: ["zapatos", "Zapatos", "negro", "#151515", "zapatos", { formalidad: 4 }]
};
const OUTS = {
  g1: { v: 1, prendas: ["cam", "tela", "zn"], nombre: "Oficina fresca", ocasion: "trabajo", origen: "manual", gusto: "si", guardado: true, puesto: [], creado: DIA("2026-11-10") },
  g2: { v: 1, prendas: ["pol", "jean", "zap"], nombre: "De siempre", ocasion: "casual", origen: "reglas", gusto: "si", guardado: true, puesto: ["2026-11-20"], creado: DIA("2026-11-01") }
};
function semilla(extra) {
  const ropa = {};
  Object.entries(ROPA).forEach(([id, [grupo, tipo, color, hex, forma, x]], k) => {
    ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estampado: "liso", tela: "", estilo: ["casual"], clima: ["templado"], formalidad: null, marca: "", notas: "",
      fotos: [{ id: `f-${id}`, mini: svg(forma, hex), ancho: 900, alto: 1200 }], estado: "activa", creado: DIA("2026-10-01") + k }, x);
  });
  const usos = { "2026-11-20": { prendas: ["pol", "jean", "zap"], outfitId: "g2", actualizado: DIA("2026-11-20") } };
  const meta = { ropa_ajustes: { ciudad: { nombre: "La Paz", lat: -16.5, lon: -68.15 } } };
  return Object.assign({ "users/test/ropa": ropa, "users/test/ropa_usos": usos, "users/test/meta": meta, "users/test/ropa_outfits": JSON.parse(JSON.stringify(OUTS)) }, extra || {});
}

// ---------- Un puente de mentira (como el 7) ----------
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
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
      est.pedidos.push({ ruta, cuerpo });
      const json = c => route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: "  " + JSON.stringify(c) });
      const gasto = { mes: "2026-11", usd: 0.2, veces: 3, tope: 8 };
      if (ruta === "/quien") return json({ permitido: true, uid: "test", lista: true, gasto, version: 7 });
      if (ruta === "/outfits") return json({ outfits: [{ nombre: "Capas", prendas: ["cho", "jean", "cha", "zap"], porque: "Abriga.", capas: "" }, { nombre: "Prolijo", prendas: ["cam", "tela", "cha", "zn"], porque: "", capas: "" }, { nombre: "Simple", prendas: ["pol", "tela", "zn"], porque: "", capas: "" }], nota: "", gasto });
      return json({ status: 404, error: "ruta", mensaje: "No existe." });
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
const opciones = p => p.$$eval("#rof-app .rof-op", els => els.map(el => [...el.querySelectorAll("[data-prenda]")].map(x => x.dataset.prenda)));

// ---------- (1) y (2): Outfits y en grande ----------
async function enOutfits(browser, base) {
  console.log("\nTus favoritos en Outfits (390 px)");
  const p = await abrir(browser, base, { hash: "#ropa-outfits" });
  ok(/^Tus favoritos Toca el corazón de un outfit que te encanta/.test(await txt(p, "#rof-app .rof-favs-s")), "sin favoritos: el espacio está y dice cómo se suman");
  ok(await p.evaluate(() => { const f = document.querySelector("#rof-app .rof-favs-s"), g = document.querySelector('#rof-app section[aria-labelledby="rof-g-t"]'); return !!(f && g && (f.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING)); }), "va antes de «Guardados»");
  ok((await guardados(p)).join() === "g1,g2", "Guardados (2)");
  // El corazón de cada opción.
  await p.click('#rof-app [data-rof="armar"]');
  await p.waitForSelector("#rof-app .rof-op", { timeout: 5000 });
  const ops = await opciones(p);
  ok(await p.$$eval('#rof-app .rof-op [data-rof-op="fav"]', bs => bs.every(b => b.getAttribute("aria-pressed") === "false" && b.getAttribute("aria-label") === "Favorito")) && ops.length === 3, "cada opción con su corazón (vacío)");
  await p.click('#rof-app .rof-op >> nth=0 >> [data-rof-op="fav"]');
  await p.waitForTimeout(600);
  let os = await outfits(p);
  let f = Object.entries(os).find(([, x]) => clave(x.prendas) === clave(ops[0]));
  ok(/Listo: está en tus favoritos/.test(await toast(p)) && f && f[1].favorito === true && f[1].gusto === "si" && typeof f[1].favoritoFecha === "number" && f[1].guardado !== true, "el corazón: queda en tus favoritos (te gusta; no hace falta guardarlo)");
  ok((await favoritos(p)).join() === f[0] && await pulsado(p, '#rof-app .rof-op >> nth=0 >> [data-rof-op="fav"]') === "true", "aparece en «Tus favoritos» y el corazón queda lleno");
  await deshacer(p);
  ok(!Object.values(await outfits(p)).some(x => clave(x.prendas) === clave(ops[0])) && !(await favoritos(p)).length, "Deshacer lo deja como estaba");
  await p.click('#rof-app .rof-op >> nth=0 >> [data-rof-op="fav"]');
  await p.waitForTimeout(500);
  await p.click('#rof-app .rof-op >> nth=0 >> [data-rof-op="fav"]');
  await p.waitForTimeout(500);
  f = Object.entries(await outfits(p)).find(([, x]) => clave(x.prendas) === clave(ops[0]));
  ok(/Quitado de tus favoritos/.test(await toast(p)) && f[1].favorito === false && !(await favoritos(p)).length, "tocarlo otra vez lo saca");
  // En grande: el corazón se prende ahí mismo.
  await p.click('#rof-app .rof-op >> nth=1 >> .rof-op-ver [data-rof-op="ver"]');
  await p.waitForSelector('.rof-hoja-ver [data-rof-v="fav"]', { timeout: 3000 });
  ok(await pulsado(p, '.rof-hoja-ver [data-rof-v="fav"]') === "false" && /Favorito/.test(await txt(p, '.rof-hoja-ver [data-rof-v="fav"]')), "en grande: «Favorito»");
  await p.click('.rof-hoja-ver [data-rof-v="fav"]');
  await p.waitForTimeout(500);
  ok(await pulsado(p, '.rof-hoja-ver [data-rof-v="fav"]') === "true" && await p.$(".rof-hoja-ver:not([hidden])"), "se prende ahí mismo (la hoja sigue abierta)");
  await cerrar(p);
  const fav1 = Object.entries(await outfits(p)).find(([, x]) => clave(x.prendas) === clave(ops[1]));
  ok(fav1 && fav1[1].favorito === true && (await favoritos(p)).includes(fav1[0]), "y está en tus favoritos");
  // "No me gusta" lo saca de tus favoritos.
  await p.click('#rof-app .rof-op >> nth=1 >> [data-rof-op="no"]');
  await p.waitForTimeout(600);
  ok((await outfits(p))[fav1[0]].favorito === false && !(await favoritos(p)).includes(fav1[0]), "«No me gusta» lo saca de tus favoritos");
  // Un guardado: a favoritos (ya no se repite en Guardados) y de vuelta.
  await p.click('#rof-app [data-rof-g="g1"]');
  await p.waitForSelector('.rof-hoja-guardado [data-rof-h="fav"]', { timeout: 3000 });
  await p.click('.rof-hoja-guardado [data-rof-h="fav"]');
  await p.waitForTimeout(500);
  ok(await pulsado(p, '.rof-hoja-guardado [data-rof-h="fav"]') === "true", "un guardado: el corazón se prende");
  await cerrar(p);
  ok((await favoritos(p))[0] === "g1" && !(await guardados(p)).includes("g1"), "pasa a «Tus favoritos» (y no se repite en «Guardados»)");
  await captura(p, "favoritos-390.png");
  await p.click('#rof-app .rof-favs-s [data-rof-g="g1"]');
  await p.waitForSelector('.rof-hoja-guardado [data-rof-h="fav"]', { timeout: 3000 });
  ok(await p.$('.rof-hoja-guardado [data-rof-h="quitar"]'), "un favorito guardado: «Quitar de guardados» sigue");
  await p.click('.rof-hoja-guardado [data-rof-h="fav"]');
  await p.waitForTimeout(500);
  await cerrar(p);
  ok(!(await favoritos(p)).includes("g1") && (await guardados(p)).includes("g1"), "quitarle el corazón: vuelve a «Guardados»");
  // Un favorito que no está guardado: sin "Quitar de guardados"; "Me lo pongo hoy".
  await p.click('#rof-app .rof-op >> nth=0 >> [data-rof-op="fav"]');
  await p.waitForTimeout(600);
  const id0 = Object.entries(await outfits(p)).find(([, x]) => clave(x.prendas) === clave(ops[0]))[0];
  await p.click(`#rof-app .rof-favs-s [data-rof-g="${id0}"]`);
  await p.waitForSelector('.rof-hoja-guardado [data-rof-h="puse"]', { timeout: 3000 });
  ok(!(await p.$('.rof-hoja-guardado [data-rof-h="quitar"]')) && await pulsado(p, '.rof-hoja-guardado [data-rof-h="fav"]') === "true", "un favorito sin guardar: sin «Quitar de guardados»");
  await p.click('.rof-hoja-guardado [data-rof-h="puse"]');
  await p.waitForTimeout(600);
  const usos = await col(p, "users/test/ropa_usos");
  ok(/anotado lo que te pusiste hoy/.test(await toast(p)) && clave(usos[HOY].prendas) === clave(ops[0]), "«Me lo pongo hoy» desde un favorito");
  // Un día del calendario.
  await p.click('#rof-app [data-rof-cal="2026-11-20"]');
  await p.waitForSelector('.rof-hoja-dia [data-rof-d="fav"]', { timeout: 3000 });
  await p.click('.rof-hoja-dia [data-rof-d="fav"]');
  await p.waitForTimeout(500);
  ok(await pulsado(p, '.rof-hoja-dia [data-rof-d="fav"]') === "true", "un día del calendario: el corazón (lo que te pusiste)");
  await cerrar(p);
  ok((await outfits(p)).g2.favorito === true && (await favoritos(p)).includes("g2"), "y queda en tus favoritos");
  sinErrores(p);
  await p.context().close();
}

// ---------- (3) Armar el mío ----------
async function enArmar(browser, base) {
  console.log("\nArmar el mío: «A favoritos» y editar un favorito (390 px)");
  const seed = { "users/test/ropa_outfits": Object.assign(JSON.parse(JSON.stringify(OUTS)), { g1: Object.assign({}, OUTS.g1, { favorito: true, favoritoFecha: DIA("2026-11-15") }) }) };
  const p = await abrir(browser, base, { hash: "#ropa-armar", seed });
  const tocar = async id => { await p.click(`#roar-app [data-roar-p="${id}"]`); await p.waitForTimeout(150); };
  const parte = async id => { await p.click(`#roar-app [data-roar-parte="${id}"]`); await p.waitForTimeout(150); };
  ok(await p.$eval('#roar-app [data-roar="fav"]', b => b.disabled), "«A favoritos», con menos de dos prendas no se puede");
  await tocar("cho");
  await parte("abajo"); await tocar("jean");
  await parte("zapatos"); await tocar("zap");
  await p.fill('#roar-app [name="roar-nombre"]', "Mi favorito");
  await p.dispatchEvent('#roar-app [name="roar-nombre"]', "input");
  await p.click('#roar-app [data-roar="fav"]');
  await p.waitForTimeout(700);
  let os = await outfits(p);
  const nuevo = Object.entries(os).find(([, x]) => clave(x.prendas) === clave(["cho", "jean", "zap"]));
  ok(await p.evaluate(() => location.hash) === "#ropa-outfits" && /Listo: está en tus favoritos/.test(await toast(p)), "«A favoritos»: vuelve a Outfits y lo dice");
  ok(nuevo && nuevo[1].favorito === true && nuevo[1].guardado === true && nuevo[1].nombre === "Mi favorito", "guardado, con su nombre, y en tus favoritos");
  ok((await favoritos(p))[0] === nuevo[0], "primero en «Tus favoritos»");
  await deshacer(p);
  ok(!Object.values(await outfits(p)).some(x => clave(x.prendas) === clave(["cho", "jean", "zap"])), "Deshacer");
  // Editar un favorito: el nuevo es el favorito.
  await p.click('#rof-app .rof-favs-s [data-rof-g="g1"]');
  await p.waitForSelector('.rof-hoja-guardado [data-rof-h="editar"]', { timeout: 3000 });
  await p.click('.rof-hoja-guardado [data-rof-h="editar"]');
  await p.waitForTimeout(600);
  ok(!(await p.$('#roar-app [data-roar="fav"]')), "al editar, sin «A favoritos» (sigue siendo tu favorito)");
  await parte("abajo"); await tocar("jean");
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(800);
  os = await outfits(p);
  const editado = Object.entries(os).find(([id, x]) => id !== "g1" && clave(x.prendas) === clave(["cam", "jean", "zn"]));
  ok(editado && editado[1].favorito === true && os.g1.favorito === false && os.g1.guardado === false, "el nuevo es tu favorito; el de antes ya no");
  ok((await favoritos(p)).join() === editado[0], "en «Tus favoritos», el nuevo");
  await deshacer(p);
  os = await outfits(p);
  ok(os.g1.favorito === true && os.g1.guardado === true && !Object.entries(os).some(([id, x]) => id !== "g1" && clave(x.prendas) === clave(["cam", "jean", "zn"])), "Deshacer deja todo como estaba");
  sinErrores(p);
  await p.context().close();
}

// ---------- (4) Tu estilista ----------
async function conEstilista(browser, base) {
  console.log("\nTu estilista: el corazón y tus favoritos primero (390 px)");
  const ia = (texto, outfits, fecha) => ({ de: "ia", texto, outfits, faltan: [], recordo: [], fecha });
  const charlas = { c1: { v: 1, titulo: "Hace frío", creado: AHORA - 3600e3, editado: AHORA - 3500e3, mensajes: [{ de: "yo", texto: "Hace frío", fecha: AHORA - 3600e3 },
    ia("Va así:", [{ prendas: ["cho", "jean", "cha", "zap"], nombre: "Capas", porque: "Abriga.", capas: "" }], AHORA - 3500e3)] } };
  const seed = { "users/test/ropa_charlas": charlas, "users/test/ropa_outfits": Object.assign(JSON.parse(JSON.stringify(OUTS)), { g2: Object.assign({}, OUTS.g2, { favorito: true, favoritoFecha: DIA("2026-11-21") }) }) };
  const pf = puenteFalso();
  const p = await abrir(browser, base, { hash: "#ropa-estilista/c1", puente: pf, seed });
  ok(await pulsado(p, '#roe-app [data-roe-o="fav"][data-o="0"]') === "false", "cada outfit de tu estilista, con su corazón");
  await p.click('#roe-app [data-roe-o="fav"][data-o="0"]');
  await p.waitForTimeout(600);
  const f = Object.entries(await outfits(p)).find(([, x]) => clave(x.prendas) === clave(["cho", "jean", "cha", "zap"]));
  ok(/Listo: está en tus favoritos/.test(await toast(p)) && f && f[1].favorito === true && f[1].origen === "ia" && f[1].nombre === "Capas", "a tus favoritos (con su nombre)");
  ok(await pulsado(p, '#roe-app [data-roe-o="fav"][data-o="0"]') === "true", "y el corazón queda lleno");
  // A la IA: tus favoritos primero.
  await ir(p, "ropa-outfits");
  await p.click('#rof-app [data-rof="armar"]');
  await p.waitForTimeout(1200);
  const c = (pf.pedidos.find(x => x.ruta === "/outfits") || {}).cuerpo;
  ok(c && clave(c.gustan[0]) === clave(["cho", "jean", "cha", "zap"]) && clave(c.gustan[1]) === clave(["pol", "jean", "zap"]) && clave(c.gustan[2]) === clave(["cam", "tela", "zn"]), "a la IA le llegan tus favoritos primero (el último que marcaste, primero)");
  sinErrores(p);
  await p.context().close();
}

// ---------- (5) A 320 px, en oscuro y en claro ----------
async function chico(browser, base, esquema) {
  const nombre = esquema === "light" ? "claro" : "oscuro";
  console.log(`\nA 320 px, en ${nombre}`);
  const seed = { "users/test/ropa_outfits": Object.assign(JSON.parse(JSON.stringify(OUTS)), { g1: Object.assign({}, OUTS.g1, { favorito: true, favoritoFecha: DIA("2026-11-15") }) }) };
  const p = await abrir(browser, base, { hash: "#ropa-outfits", ancho: 320, esquema, seed });
  await p.click('#rof-app [data-rof="armar"]');
  await p.waitForSelector("#rof-app .rof-op", { timeout: 5000 });
  await p.click('#rof-app .rof-op >> nth=0 >> [data-rof-op="fav"]');
  await p.waitForTimeout(700);
  ok(await sobra(p) <= 0, "Outfits: nada se sale a lo ancho");
  const chicos = await p.$$eval("#rof-app .rof-fav-b", bs => bs.map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length);
  ok(!chicos, "los corazones se tocan bien con el dedo (44 px)");
  const titulo = await p.$eval("#rof-app .rof-op .rof-op-cab", el => { const t = el.querySelector(".rof-op-t").getBoundingClientRect(), b = el.querySelector(".rof-fav-b").getBoundingClientRect(); return t.right <= b.left + 1; });
  ok(titulo, "el nombre de la opción no se pisa con el corazón");
  let malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `Outfits: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  // Las capturas, sin el aviso de abajo encima.
  const sinAviso = () => p.evaluate(() => { const t = document.getElementById("ro-toast"); if (t) t.hidden = true; });
  await sinAviso();
  await p.$eval("#rof-app .rof-op .rof-op-cab", el => el.scrollIntoView({ block: "center" }));
  await captura(p, `favoritos-opcion-320-${nombre}.png`);
  await p.$eval("#rof-app .rof-favs-s", el => el.scrollIntoView({ block: "center" }));
  await captura(p, `favoritos-320-${nombre}.png`);
  await p.click('#rof-app .rof-favs-s [data-rof-g="g1"]');
  await p.waitForSelector('.rof-hoja-guardado [data-rof-h="fav"]', { timeout: 3000 });
  await p.waitForTimeout(300);
  ok(await sobra(p) <= 0, "un favorito en grande: nada se sale");
  const pasados = await p.$$eval(".rof-hoja-guardado .rof-op-bot > *", bs => bs.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim()));
  ok(!pasados.length, `en grande, cada botón con su texto adentro${pasados.length ? `: ${pasados.join(", ")}` : ""}`);
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `un favorito en grande: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p.$eval('.rof-hoja-guardado [data-rof-h="fav"]', el => el.scrollIntoView({ block: "center" }));
  await captura(p, `favoritos-hoja-320-${nombre}.png`);
  await cerrar(p);
  await ir(p, "ropa-armar");
  await p.click('#roar-app [data-roar-p="pol"]'); await p.waitForTimeout(150);
  await p.click('#roar-app [data-roar-parte="abajo"]'); await p.waitForTimeout(150);
  await p.click('#roar-app [data-roar-p="jean"]'); await p.waitForTimeout(300);
  ok(await sobra(p) <= 0, "Armar el mío con «A favoritos»: nada se sale");
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `Armar el mío: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await sinAviso();
  await p.$eval('#roar-app [data-roar="fav"]', el => el.scrollIntoView({ block: "center" }));
  await captura(p, `favoritos-armar-320-${nombre}.png`);
  sinErrores(p);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await enOutfits(browser, base);
  await enArmar(browser, base);
  await conEstilista(browser, base);
  for (const esquema of ["dark", "light"]) await chico(browser, base, esquema);
  await terminar(browser, srv);
})();
