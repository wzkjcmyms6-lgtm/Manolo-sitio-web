// Pruebas de pantalla de Ropa, fase 5: Compras desde Pinterest (D-150; docs/ROPA.md).
// Qué te falta (lo que se repite en tus inspiraciones y no tienes: el abrigo
// camel en 6 pines, los botines café en 3 y la camisa blanca en 2; la falda
// de un solo pin, los lentes y el pin que quitaste, no), con las fotos de esos
// pines, cuántos outfits nuevos te daría (lo mismo que dicen las reglas) y
// "Ver opciones en Pinterest"; "A mi lista" (también desde un pin) con
// Deshacer; "Lo compré" sin foto y con foto (pasa al ropero con la fecha de
// hoy y su precio; ya no te falta); "Ya no lo quiero"; tu presupuesto del mes
// (lo que gastaste, lo que te queda y cuando te pasas); qué no comprar; sin
// inspiraciones; 320 px, claro, la compu y la copia de seguridad.
// Uso: node scripts/e2e/ropa-compras.js [carpeta-para-capturas]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar } = require("./comun.js");
const M = require("../../js/ropa-motor.js");
const I = require("../../js/ropa-insp-motor.js");
const K = require("../../js/ropa-compras-motor.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";
const HOY = "2026-11-23";
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const coleccion = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const ir = (p, h) => p.evaluate(x => { location.hash = x; }, h);
const FALTA = 'section[aria-labelledby="rco-faltan-t"]', LISTA = 'section[aria-labelledby="rco-lista-t"]';
const items = (p, sec) => p.$$eval(`${sec} .rco-item .rco-t`, els => els.map(e => e.innerText.trim()));

// Miniaturas de verdad (una prenda de su color) hechas en la página.
function dibujo() {
  window.__mini = (hex, fondo) => new Promise(r => {
    const c = document.createElement("canvas"); c.width = 200; c.height = 260;
    const g = c.getContext("2d");
    g.fillStyle = fondo || "#ece6dc"; g.fillRect(0, 0, 200, 260);
    g.fillStyle = hex; g.beginPath();
    [[62, 50], [138, 50], [166, 86], [146, 98], [142, 220], [58, 220], [54, 98], [34, 86]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.fill();
    r(c.toDataURL("image/jpeg", 0.8));
  });
}
const abrir = (browser, base, estado, o) => abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA, init: dibujo }, o));
// Elige una foto en el "Lo compraste" (como si la sacaras): una camisa blanca sobre gris.
function elegirFoto(p) {
  return p.evaluate(() => new Promise(res => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
    const g = c.getContext("2d");
    g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, 900, 1200);
    g.fillStyle = "#f6f6f4"; g.beginPath();
    [[280, 220], [620, 220], [740, 400], [650, 450], [630, 1000], [270, 1000], [250, 450], [160, 400]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.fill();
    c.toBlob(b => {
      const dt = new DataTransfer();
      dt.items.add(new File([b], "camisa.jpg", { type: "image/jpeg" }));
      const inp = document.querySelector(".ro-hoja-mas [data-ro-fotos]");
      inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      res();
    }, "image/jpeg", 0.9);
  }));
}

// ---------- La semilla: tu ropa y tus inspiraciones ----------
const P = [
  ["pol-b", "arriba", "Polera", "blanco", "#f4f4f2", { clima: ["templado", "calor"], formalidad: 2 }],
  ["cam-c", "arriba", "Camisa", "celeste", "#8fc3ea", { clima: ["templado"], formalidad: 3 }],
  ["pn1", "arriba", "Polera", "negro", "#151515", { formalidad: 2, compra: "2026-11-05", precio: 120 }],
  ["pn2", "arriba", "Polera", "negro", "#151515", { formalidad: 2, compra: "2026-11-12" }],
  ["pn3", "arriba", "Polera", "negro", "#151515", { formalidad: 2 }],
  ["jean", "abajo", "Jean", "azul-jean", "#4f6f9a", { clima: ["frio", "templado"], formalidad: 2, compra: "2026-11-10", precio: 280 }],
  ["chino", "abajo", "Pantalón de tela", "beige", "#d9c6a5", { clima: ["templado"], formalidad: 3 }],
  ["zap", "zapatos", "Zapatillas", "blanco", "#f4f4f2", { formalidad: 2 }],
  ["abr-n", "abrigos", "Abrigo", "negro", "#151515", { clima: ["frio"], formalidad: 3, compra: "2026-10-20", precio: 900 }],
  ["vieja", "arriba", "Camisa", "blanco", "#f4f4f2", { estado: "fuera", fueraFecha: "2026-09-01" }]
];
const v = (grupo, tipo, color) => ({ grupo, tipo, colores: [color], estampado: "liso", tela: "", detalle: "" });
const PINES = [
  ["pin-a1", "Abrigo camel y jean", "#c19a6b", ["frio"], 2, [v("abrigos", "Abrigo", "camel"), v("arriba", "Polera", "blanco"), v("abajo", "Jean", "azul-jean"), v("zapatos", "Botines", "cafe"), v("accesorios", "Lentes", "negro")]],
  ["pin-a2", "Camel para la oficina", "#c19a6b", ["frio"], 3, [v("abrigos", "Abrigo", "camel"), v("arriba", "Camisa", "blanco"), v("abajo", "Pantalón de tela", "negro"), v("zapatos", "Botines", "cafe")]],
  ["pin-a3", "Camel con chompa", "#c19a6b", ["frio"], 2, [v("abrigos", "Abrigo", "camel"), v("arriba", "Chompa", "crema"), v("abajo", "Jean", "azul-jean"), v("zapatos", "Botines", "cafe-oscuro")]],
  ["pin-a4", "Camel y camisa blanca", "#c19a6b", ["templado"], 2, [v("abrigos", "Abrigo", "camel"), v("arriba", "Camisa", "blanco"), v("abajo", "Jean", "azul-jean"), v("zapatos", "Zapatillas", "blanco")]],
  ["pin-a5", "Camel y falda", "#c19a6b", ["frio"], 3, [v("abrigos", "Abrigo", "camel"), v("arriba", "Polera", "negro"), v("abajo", "Falda", "negro")]],
  ["pin-a6", "Solo el abrigo", "#c19a6b", ["frio"], 2, [v("abrigos", "Abrigo", "camel"), v("accesorios", "Lentes", "negro")]],
  ["pin-a7", "Vestido rojo", "#c43a31", ["calor"], 3, [v("cuerpo", "Vestido", "rojo")]],
  ["pin-x", "El que quitaste", "#c19a6b", ["frio"], 2, [v("abrigos", "Abrigo", "camel"), v("abajo", "Falda", "negro")]]
];
async function semilla(browser, base) {
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio" });
  const minis = await p.evaluate(hs => Promise.all(hs.map(h => window.__mini(h))), P.map(x => x[4]).concat(PINES.map(x => x[2])));
  await p.context().close();
  const ropa = {};
  P.forEach(([id, grupo, tipo, color, , extra], k) => {
    ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estado: "activa", creado: k + 1, fotos: [{ id: `f-${id}`, mini: minis[k], ancho: 200, alto: 260 }] }, extra);
  });
  const insp = {};
  PINES.forEach(([id, titulo, , clima, formalidad, prendas], k) => {
    insp[id] = { v: 1, via: "tablero", creado: 100 - k, pin: { id: id.slice(4), url: `https://www.pinterest.com/pin/${id.slice(4)}/`, titulo, img: "", fecha: 100 - k },
      fotos: [{ id: `i-${id}`, mini: minis[P.length + k], ancho: 200, alto: 260 }], ia: { fecha: "2026-11-22" }, oculta: id === "pin-x",
      analisis: { esRopa: true, resumen: titulo, estilo: ["casual"], clima, formalidad, ocasion: "", prendas } };
  });
  insp["pin-s"] = { v: 1, via: "foto", creado: 1, fotos: [{ id: "i-s", mini: minis[0], ancho: 200, alto: 260 }] };
  return { [`users/test/ropa`]: ropa, "users/test/ropa_inspiracion": insp };
}
// Lo que dicen las reglas con esa misma ropa y esos pines (para comparar con la pantalla).
function esperado(seed) {
  const ropero = Object.entries(seed["users/test/ropa"]).map(([id, d]) => M.normalizar(id, d));
  const insp = Object.entries(seed["users/test/ropa_inspiracion"]).map(([id, d]) => I.normalizar(id, d));
  return { ropero, insp, faltan: K.faltan(insp, ropero) };
}

// ---------- Compras ----------
async function compras(browser, base, seed) {
  console.log("\nCompras (390 px)");
  const e = esperado(seed);
  ok(e.faltan.map(f => `${f.nombre} ${f.n}`).join(", ") === "Abrigo camel 6, Botines cafés 3, Camisa blanca 2", `las reglas: ${e.faltan.map(f => `${f.nombre} ${f.n}`).join(", ")}`);
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa", ancho: 390 });
  await p.waitForTimeout(400);
  ok(/Ropero.*Outfits.*Inspiración.*Compras/.test(await txt(p, "#bottom-nav-links")) && await p.isVisible("#bottom-nav-links [data-ropa-mas]"), "la barra: Ropero · Outfits · + · Inspiración · Compras");
  await p.click('#bottom-nav-links a[data-hash="ropa-compras"]');
  await p.waitForSelector(`${FALTA} .rco-item`, { timeout: 6000 }).catch(() => {});
  ok(await p.$eval('#bottom-nav-links a[data-hash="ropa-compras"]', a => a.classList.contains("active")), "marca Compras");
  // El presupuesto, sin ponerlo todavía.
  ok(/En noviembre gastaste Bs 400 \(2 prendas\) en ropa\./.test(await txt(p, ".rco-plata")) && /1 prenda de este mes no tiene precio: no cuenta/.test(await txt(p, ".rco-plata")), `lo que gastaste este mes: ${await txt(p, ".rco-plata")}`);
  // Qué te falta.
  ok((await items(p, FALTA)).join(" | ") === "Abrigo camel | Botines cafés | Camisa blanca", "qué te falta: el abrigo (6 pines), los botines (3) y la camisa blanca (2)");
  const abrigo = `${FALTA} .rco-item >> nth=0`;
  ok(/En 6 de tus inspiraciones · en tu ropero, solo de otro color/.test(await txt(p, abrigo)), "en cuántas y que lo tienes de otro color");
  ok(/En 2 de tus inspiraciones · en tu ropero, solo de otro color/.test(await txt(p, `${FALTA} .rco-item >> nth=2`)) && /no está en tu ropero/.test(await txt(p, `${FALTA} .rco-item >> nth=1`)), "la camisa (tienes celeste) y los botines (la que ya no tienes no cuenta)");
  const pines = await p.$$eval(`${FALTA} .rco-item:nth-child(1) .rco-pin`, as => as.map(a => a.getAttribute("href")));
  ok(pines.join() === ["a1", "a2", "a3", "a4", "a5", "a6"].map(x => `#ropa-pin/pin-${x}`).join() && await p.$(`${FALTA} .rco-item:nth-child(1) .rco-pin img`), "las fotos de esos 6 pines (cada una lleva a su pin)");
  const nuevos = e.faltan.map(f => K.outfitsNuevos(f, e.ropero));
  const enPantalla = await p.$$eval(`${FALTA} .rco-outfits`, ps => ps.map(x => x.innerText.trim()));
  ok(enPantalla.every((t, k) => t === `Con tu ropa: ${nuevos[k]} outfits nuevos`), `cuántos outfits nuevos (como las reglas): ${enPantalla.join(" / ")}`);
  const link = await p.$eval(`${abrigo} >> a[target="_blank"]`, a => [a.getAttribute("href"), a.getAttribute("rel"), a.innerText.trim()]);
  ok(link[0] === "https://www.pinterest.com/search/pins/?q=abrigo%20camel%20outfit" && link[1] === "noopener" && /Ver opciones en Pinterest/.test(link[2]), "«Ver opciones en Pinterest» con la búsqueda lista");
  ok(/Manolo nunca compra nada/.test(await txt(p, "#rco-app")), "Manolo nunca compra nada");
  await p.waitForTimeout(700);   // el vidrio de la barra termina de deslizarse
  await captura(p, "compras-390.png");
  // A mi lista (con Deshacer).
  await p.click(`${abrigo} >> [data-rco-agregar]`);
  await p.waitForTimeout(400);
  let deseos = Object.values(await coleccion(p, "users/test/ropa_deseos"));
  const d0 = deseos[0] || {};
  ok(deseos.length === 1 && d0.grupo === "abrigos" && d0.tipo === "Abrigo" && d0.colores.join() === "camel" && d0.inspiraciones.length === 6 && d0.origen === "falta" && d0.estado === "quiero", "«A mi lista»: guarda el abrigo camel con sus 6 pines");
  ok(/En tu lista/.test(await txt(p, abrigo)) && /Abrigo camel/.test(await txt(p, LISTA)) && /De 6 inspiraciones/.test(await txt(p, LISTA)), "dice «En tu lista» y aparece en tu lista de deseos");
  ok(await p.$$eval(`${LISTA} .rco-pin`, as => as.length) === 4 && /\+2/.test(await txt(p, `${LISTA} .rco-pin-mas`)), "en la lista: 4 fotos y +2");
  ok(/está en tu lista de deseos/.test(await toast(p)), "el aviso");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok(!Object.keys(await coleccion(p, "users/test/ropa_deseos")).length && await p.$(`${abrigo} >> [data-rco-agregar]`), "Deshacer lo saca");
  await p.click(`${abrigo} >> [data-rco-agregar]`);
  await p.click(`${FALTA} .rco-item >> nth=2 >> [data-rco-agregar]`);
  await p.waitForTimeout(400);
  ok((await items(p, LISTA)).sort().join(" | ") === "Abrigo camel | Camisa blanca", "dos en la lista");
  // Ya no lo quiero (con Deshacer).
  const idCamisa = Object.entries(await coleccion(p, "users/test/ropa_deseos")).find(([, d]) => d.tipo === "Camisa")[0];
  await p.click(`[data-rco-quitar="${idCamisa}"]`);
  await p.waitForTimeout(300);
  ok((await coleccion(p, "users/test/ropa_deseos"))[idCamisa].estado === "descartado" && (await items(p, LISTA)).join() === "Abrigo camel" && /Quitaste Camisa blanca/.test(await toast(p)), "«Ya no lo quiero» la saca de la lista");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(300);
  ok((await coleccion(p, "users/test/ropa_deseos"))[idCamisa].estado === "quiero", "Deshacer la vuelve a poner");
  // El presupuesto.
  await p.click('[data-rco="presupuesto"]');
  await p.waitForSelector(".rco-hoja-plata [name=tope]", { timeout: 4000 });
  await p.fill(".rco-hoja-plata [name=tope]", "mucho");
  await p.click('.rco-hoja-plata button[type="submit"]');
  await p.waitForTimeout(150);
  ok(/Pon cuánto por mes/.test(await txt(p, ".rco-hoja-plata [data-rco-error]")), "si no es un número, lo dice");
  await p.fill(".rco-hoja-plata [name=tope]", "1.000");
  await p.click('.rco-hoja-plata button[type="submit"]');
  await p.waitForTimeout(400);
  ok(((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).presupuestoMes === 1000, "«1.000» son mil bolivianos");
  ok(/En noviembre: Bs 400 \(2 prendas\) de Bs 1\.000/.test(await txt(p, ".rco-plata")) && /Te quedan Bs 600\./.test(await txt(p, ".rco-plata")) && await p.$eval(".rco-plata .rco-barra", b => b.getAttribute("aria-label")) === "Llevas el 40 % de tu presupuesto del mes", "lo que gastaste, de cuánto y lo que te queda");
  // Lo compré (sin foto): pasa al ropero con la fecha de hoy y el precio.
  const idAbrigo = Object.entries(await coleccion(p, "users/test/ropa_deseos")).find(([, d]) => d.tipo === "Abrigo")[0];
  await p.click(`[data-rco-compre="${idAbrigo}"]`);
  await p.waitForSelector(".ro-hoja-mas:not([hidden]) [data-ro-sinfoto]", { timeout: 4000 });
  ok(/Lo compraste/.test(await txt(p, ".ro-hoja-mas")), "«Lo compré»: con foto o sin foto");
  await p.click(".ro-hoja-mas [data-ro-sinfoto]");
  await p.waitForSelector(".ro-hoja-form .ro-form", { timeout: 6000 });
  await p.waitForTimeout(200);
  const pre = await p.evaluate(() => ({
    grupo: (document.querySelector('.ro-hoja-form input[name="grupo"]:checked') || {}).value, tipo: (document.querySelector('.ro-hoja-form input[name="tipo"]:checked') || {}).value,
    colores: document.querySelector(".ro-hoja-form [data-ro-colores]").innerText, compra: document.querySelector('.ro-hoja-form [name="compra"]').value
  }));
  ok(pre.grupo === "abrigos" && pre.tipo === "Abrigo" && /Camel/.test(pre.colores) && pre.compra === HOY, `el formulario ya viene lleno (${JSON.stringify(pre)})`);
  await captura(p, "compras-lo-compre-390.png");
  await p.fill('.ro-hoja-form [name="precio"]', "750");
  await p.click('.ro-hoja-form button[type="submit"]');
  await p.waitForTimeout(600);
  const ropa = await coleccion(p, "users/test/ropa");
  const nueva = Object.entries(ropa).find(([id]) => !seed["users/test/ropa"][id]);
  ok(nueva && nueva[1].grupo === "abrigos" && nueva[1].tipo === "Abrigo" && nueva[1].colores[0].id === "camel" && nueva[1].compra === HOY && nueva[1].precio === 750, "en tu ropero, con la fecha de hoy y el precio");
  const dA = (await coleccion(p, "users/test/ropa_deseos"))[idAbrigo];
  ok(dA.estado === "comprado" && dA.prendaId === (nueva && nueva[0]) && dA.compradoFecha === HOY, "en tu lista queda como comprado (con la prenda)");
  ok(!(await items(p, FALTA)).includes("Abrigo camel") && (await items(p, LISTA)).join() === "Camisa blanca", "ya no te falta y sale de la lista");
  ok(/Te pasaste por Bs 150\./.test(await txt(p, ".rco-plata")) && await p.$(".rco-plata.is-pasado"), "con el abrigo, te pasaste del presupuesto");
  ok(/Lo que compraste \(1\)/.test(await txt(p, ".rco-compradas")) && await p.$(`.rco-compradas a[href="#ropa-prenda/${nueva && nueva[0]}"]`), "«Lo que compraste» lleva a la prenda");
  // Lo compré (con foto).
  await p.click(`[data-rco-compre="${idCamisa}"]`);
  await p.waitForSelector(".ro-hoja-mas:not([hidden]) [data-ro-fotos]", { state: "attached", timeout: 4000 });
  await elegirFoto(p);
  await p.waitForSelector(".ro-hoja-form .ro-form", { timeout: 8000 });
  await p.waitForTimeout(300);
  ok(await p.$(".ro-hoja-form .ro-form-foto img") && await p.$eval('.ro-hoja-form input[name="tipo"]:checked', i => i.value) === "Camisa", "con foto: la foto y lo que querías");
  await p.click('.ro-hoja-form button[type="submit"]');
  await p.waitForTimeout(600);
  const camisa = Object.entries(await coleccion(p, "users/test/ropa")).find(([id, d]) => !seed["users/test/ropa"][id] && d.tipo === "Camisa");
  ok(camisa && camisa[1].fotos.length === 1 && camisa[1].compra === HOY && (await coleccion(p, "users/test/ropa_deseos"))[idCamisa].estado === "comprado", "la camisa, con su foto, en tu ropero");
  ok(/Todavía no hay nada/.test(await txt(p, LISTA)) && /Lo que compraste \(2\)/.test(await txt(p, ".rco-compradas")), "la lista quedó vacía; compraste 2");
  // Qué no comprar.
  ok(/Polera negra · tienes 3/.test(await txt(p, ".rco-sobra")) && await p.$$eval(".rco-sobra li:first-child .ro-foto", f => f.length) === 3, "qué no comprar: 3 poleras negras");
  await captura(p, "compras-abajo-390.png");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- Desde un pin ----------
async function desdePin(browser, base, seed) {
  console.log("\nA tu lista desde un pin");
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-pin/pin-a1", ancho: 390 });
  await p.waitForSelector(".rin-faltan", { timeout: 6000 }).catch(() => {});
  ok(/Botines cafés/.test(await txt(p, ".rin-faltan")) && await p.$('.rin-faltan [data-rinp="lista"]'), "el pin: «Te falta» con «A mi lista»");
  await p.click('.rin-faltan [data-rinp="lista"]');
  await p.waitForTimeout(400);
  const ds = Object.values(await coleccion(p, "users/test/ropa_deseos"));
  ok(ds.length === 1 && ds[0].tipo === "Botines" && ds[0].colores.join() === "cafe" && ds[0].inspiraciones.join() === "pin-a1" && ds[0].origen === "pin", "guarda los botines con ese pin");
  ok(/En tu lista/.test(await txt(p, ".rin-faltan")) && /en Compras/.test(await toast(p)), "dice «En tu lista» (y que está en Compras)");
  await captura(p, "compras-pin-390.png");
  await ir(p, "ropa-compras");
  await p.waitForTimeout(500);
  ok(/En tu lista/.test(await txt(p, `${FALTA} .rco-item >> nth=1`)) && (await items(p, LISTA)).join() === "Botines cafés", "en Compras: «En tu lista» y en tu lista de deseos");
  // Desde otro pin con lo mismo: no se repite, suma el pin.
  await ir(p, "ropa-pin/pin-a2");
  await p.waitForSelector(".rin-faltan", { timeout: 6000 }).catch(() => {});
  ok(/En tu lista/.test(await txt(p, ".rin-faltan")), "en otro pin con los mismos botines, ya dice «En tu lista»");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- Sin inspiraciones, 320, claro, la compu y la copia ----------
async function otras(browser, base, seed) {
  console.log("\nSin inspiraciones, 320 px, claro, la compu y la copia");
  const soloRopa = { "users/test/ropa": seed["users/test/ropa"] };
  let p = await abrir(browser, base, { __SEED__: soloRopa }, { hash: "#ropa-compras", ancho: 390 });
  await p.waitForTimeout(600);
  ok(/Guarda tus inspiraciones de Pinterest/.test(await txt(p, FALTA)) && await p.$(`${FALTA} a[href="#ropa-inspiracion"]`), "sin inspiraciones: lo explica y lleva a Inspiración");
  await p.context().close();
  const sinMirar = Object.assign({}, soloRopa, { "users/test/ropa_inspiracion": { "pin-s": seed["users/test/ropa_inspiracion"]["pin-s"] } });
  p = await abrir(browser, base, { __SEED__: sinMirar }, { hash: "#ropa-compras", ancho: 390 });
  await p.waitForTimeout(600);
  ok(/Cuando la IA mire tus inspiraciones/.test(await txt(p, FALTA)), "con inspiraciones que la IA no miró: lo dice");
  await p.context().close();
  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-compras", ancho: 320 });
  await p.waitForSelector(`${FALTA} .rco-item`, { timeout: 6000 }).catch(() => {});
  ok(await sobra(p) <= 0, "320 px: nada se sale a lo ancho");
  await captura(p, "compras-320.png");
  await p.context().close();
  p = await abrir(browser, base, { __SEED__: Object.assign({}, seed, { "users/test/meta": { ropa_ajustes: { presupuestoMes: 300 } } }) }, { hash: "#ropa-compras", ancho: 390, esquema: "light" });
  await p.waitForSelector(`${FALTA} .rco-item`, { timeout: 6000 }).catch(() => {});
  ok(/Te pasaste por Bs 100\./.test(await txt(p, ".rco-plata")), "con un presupuesto chico: te pasaste");
  await captura(p, "compras-claro-390.png");
  ok(!p.errores.length, `en claro, sin errores${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-compras", ancho: 1280, alto: 900 });
  await p.waitForSelector(`${FALTA} .rco-item`, { timeout: 6000 }).catch(() => {});
  const pills = await txt(p, "#panel-ropa-compras .fin-outer-tabs");
  ok(/Ropero/.test(pills) && /Outfits/.test(pills) && /\+ Agregar/.test(pills) && /Inspiración/.test(pills) && /Compras/.test(pills), `la compu: ${pills}`);
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  await captura(p, "compras-1280.png");
  // La copia de seguridad lleva tu lista.
  await p.click(`${FALTA} .rco-item >> nth=0 >> [data-rco-agregar]`);
  await p.waitForTimeout(400);
  const [id] = Object.keys(await coleccion(p, "users/test/ropa_deseos"));
  await ir(p, "inicio");
  await p.waitForTimeout(300);
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
  await p.click('[data-rsp="preparar"]');
  await p.waitForSelector('[data-rsp="guardar"]', { timeout: 8000 });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-rsp="guardar"]')]);
  const archivo = path.join(os.tmpdir(), `compras-copia-${process.pid}.json`);
  await dl.saveAs(archivo);
  const copia = JSON.parse(fs.readFileSync(archivo, "utf8"));
  ok(id && copia.colecciones.ropa_deseos && copia.colecciones.ropa_deseos[id] && copia.colecciones.ropa_deseos[id].estado === "quiero", "la copia de seguridad lleva tu lista de deseos");
  fs.unlinkSync(archivo);
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const seed = await semilla(browser, base);
  await compras(browser, base, seed);
  await desdePin(browser, base, seed);
  await otras(browser, base, seed);
  await terminar(browser, srv);
})();
