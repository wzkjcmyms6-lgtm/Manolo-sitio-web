// Pruebas de pantalla de Ropa, fase 6: Extras (D-151; docs/ROPA.md).
// "Tus números" (desde el ropero): cuántas prendas, los días que anotaste y
// lo que invertiste; lo que más te pones; lo que no te pones hace 3 meses o
// más; tus colores (una barra por familia, con su muestra y su número) y
// cuánto te sale cada uso, todo igual a lo que dicen las reglas; cada prenda
// lleva a su ficha; cambia solo al anotar; sin ropa y sin precios. La
// tarjeta de Ropa en Inicio: lo que te pusiste hoy o el outfit que elegiste
// para hoy (y cambia al anotar). Tu ropa en "Tu semana" y en "Tu año" (tu
// prenda del año, con "Compartir"). 320 px, claro (con el contraste de cada
// texto) y la compu.
// Uso: node scripts/e2e/ropa-numeros.js [carpeta-para-capturas]
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");
const M = require("../../js/ropa-motor.js");
const N = require("../../js/ropa-numeros-motor.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";   // lunes
const HOY = "2026-11-23";
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const ir = (p, h) => p.evaluate(x => { location.hash = x; }, h);
const SEC = id => `section[aria-labelledby="rn-${id}-t"]`;
const filas = (p, sel) => p.$$eval(`${sel} .rn-fila`, as => as.map(a => ({ href: a.getAttribute("href"), t: a.querySelector("b").innerText.trim(), dato: a.querySelector("small").innerText.trim() })));
const DIA = f => Date.parse(`${f}T12:00:00Z`);

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
async function abrir(browser, base, estado, o) {
  const p = await abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA, init: dibujo }, o));
  // Con el reloj fijo, justo al abrir, el primer $eval de Playwright a veces lee
  // la página sin estilos (vacíos): espera a que los lea antes de seguir.
  for (let k = 0; k < 30 && !(await p.$eval("body", b => getComputedStyle(b).display).catch(() => "")); k++) await p.waitForTimeout(100);
  return p;
}

// ---------- La semilla: tu ropa y lo que te pusiste ----------
const P = [
  ["jean", "abajo", "Jean", "azul-jean", "#4f6f9a", { precio: 300, compra: "2026-02-10", creado: DIA("2026-02-10") }],
  ["pol-n", "arriba", "Polera", "negro", "#151515", { precio: 80 }],
  ["pol-b", "arriba", "Polera", "blanco", "#f4f4f2", {}],
  ["cam-c", "arriba", "Camisa", "celeste", "#8fc3ea", { precio: 250 }],
  ["zap", "zapatos", "Zapatillas", "blanco", "#f4f4f2", { precio: 500, compra: "2026-06-01", creado: DIA("2026-06-01") }],
  ["abr", "abrigos", "Abrigo", "camel", "#c19a6b", { precio: 900 }],
  ["chompa", "arriba", "Chompa", "bordo", "#6b1f2a", { precio: 200, compra: "2026-11-19", creado: DIA("2026-11-19") }],
  ["short", "abajo", "Short", "beige", "#d9c6a5", {}],
  ["lentes", "accesorios", "Lentes", "negro", "#151515", {}],
  ["vieja", "arriba", "Camisa", "blanco", "#f4f4f2", { estado: "fuera", fueraFecha: "2026-09-01", precio: 120 }]
];
const USOS = {
  "2026-11-23": ["jean", "pol-n", "zap", "lentes"],
  "2026-11-22": ["jean", "pol-n", "zap"],
  "2026-11-21": ["jean", "cam-c", "zap"],
  "2026-11-20": ["jean", "pol-b", "zap"],
  "2026-11-19": [],                              // vacío: no cuenta
  "2026-11-18": ["jean", "pol-n"],
  "2026-11-16": ["jean", "cam-c", "zap"],
  "2026-11-10": ["jean", "pol-b"],
  "2026-10-30": ["jean", "pol-n"],
  "2026-08-01": ["abr", "cam-c"],
  "2026-07-01": ["abr"],
  "2026-03-05": ["abr", "jean", "vieja"]
};
async function semilla(browser, base) {
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio" });
  const minis = await p.evaluate(hs => Promise.all(hs.map(h => window.__mini(h))), P.map(x => x[4]));
  await p.context().close();
  const ropa = {};
  P.forEach(([id, grupo, tipo, color, , extra], k) => {
    ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estado: "activa", creado: DIA("2026-01-10"), fotos: [{ id: `f-${id}`, mini: minis[k], ancho: 200, alto: 260 }] }, extra);
  });
  const usos = {};
  Object.entries(USOS).forEach(([f, ids]) => { usos[f] = { prendas: ids, actualizado: DIA(f) }; });
  return { "users/test/ropa": ropa, "users/test/ropa_usos": usos };
}
const sinHoy = seed => {
  const usos = Object.assign({}, seed["users/test/ropa_usos"]);
  delete usos[HOY];
  return Object.assign({}, seed, { "users/test/ropa_usos": usos });
};

// ---------- Tus números ----------
async function numeros(browser, base, seed) {
  console.log("\nTus números (390 px)");
  const ropero = Object.entries(seed["users/test/ropa"]).map(([id, d]) => M.normalizar(id, d));
  const n = N.numeros(ropero, seed["users/test/ropa_usos"], HOY);
  // Lo que dicen las reglas (a mano, para no comparar las reglas con ellas mismas).
  ok(n.masUsadas.map(x => `${x.id} ${x.veces}`).join(", ") === "jean 8, zap 5, pol-n 4, cam-c 2, pol-b 2", `las reglas, lo que más: ${n.masUsadas.map(x => `${x.id} ${x.veces}`).join(", ")}`);
  ok(n.sinUsar.map(x => x.id).join() === "short,abr" && n.colores.map(c => `${c.nombre} ${c.n}`).join(", ") === "Beige 2, Blanco 2, Negro 2, Azul 1, Celeste 1, Rojo 1", "las reglas: lo que no te pones y tus colores");

  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa", ancho: 390 });
  await p.waitForSelector("#ro-numeros-link:not([hidden])", { timeout: 6000 }).catch(() => {});
  ok(await p.isVisible("#ro-numeros-link") && /Tus números/.test(await txt(p, "#ro-numeros-link")), "en el ropero: «Tus números»");
  await p.click("#ro-numeros-link");
  await p.waitForSelector("#rn-app .rn-cifras", { timeout: 6000 }).catch(() => {});
  ok(await p.evaluate(() => location.hash) === "#ropa-numeros" && await p.isVisible("#panel-ropa-numeros") && (await txt(p, "#panel-ropa-numeros h1")) === "Tus números", "abre «Tus números»");
  ok(await p.$('#panel-ropa-numeros a[href="#ropa"]') !== null && await p.$eval('#bottom-nav-links a[data-hash="ropa"]', a => a.classList.contains("active")), "con la vuelta al ropero (y la barra marca Ropero)");
  // Las 3 cifras.
  const cifras = await p.$$eval(".rn-cifra", ps => ps.map(x => x.innerText.replace(/\s+/g, " ").trim()));
  ok(cifras.join(" | ") === "9 prendas | 8 de 30 días anotados | Bs 2.230 invertido en 6 prendas con precio", `las cifras (${cifras.join(" | ")})`);
  // Lo que más te pones.
  const mas = await filas(p, SEC("mas"));
  ok(mas.map(x => `${x.href} ${x.dato}`).join(", ") === n.masUsadas.map(x => `#ropa-prenda/${x.id} ${x.veces} veces`).join(", "), `lo que más te pones (${mas.map(x => `${x.t}: ${x.dato}`).join(", ")})`);
  ok(mas[0] && mas[0].t === "Jean azul" && await p.$(`${SEC("mas")} .rn-fila img`) !== null, "con su nombre y su foto");
  // Lo que no te pones hace 3 meses o más.
  const sin = await filas(p, SEC("sin"));
  ok(sin.map(x => `${x.t}: ${x.dato}`).join(" | ") === "Short beige: Nunca te la pusiste (la tienes desde hace 10 meses) | Abrigo camel: La última vez: hace 3 meses",
    `lo que no te pones (${sin.map(x => `${x.t}: ${x.dato}`).join(" | ")})`);
  ok(/Ya no la tengo/.test(await txt(p, SEC("sin"))), "y qué hacer («Ya no la tengo», en su ficha)");
  // Tus colores: una barra por familia, con su muestra y su número.
  const cols = await p.$$eval(`${SEC("colores")} .rn-colores li`, lis => lis.map(li => ({
    t: li.innerText.replace(/\s+/g, " ").trim(),
    muestra: getComputedStyle(li.querySelector(".rn-muestra")).backgroundColor,
    ancho: Math.round(li.querySelector(".rn-pista i").getBoundingClientRect().width / li.querySelector(".rn-pista").getBoundingClientRect().width * 100)
  })));
  const hexRgb = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  ok(cols.map(c => c.t).join(" | ") === n.colores.map(c => `${c.nombre} ${c.n} (${Math.round(c.pct * 100)} %)`).join(" | "), `tus colores con su número (${cols.map(c => c.t).join(" | ")})`);
  ok(cols.every((c, k) => c.muestra === hexRgb(n.colores[k].hex)), "la muestra de cada color");
  ok(cols.map(c => c.ancho).join() === "100,100,100,50,50,50", `las barras, del largo de su número (${cols.map(c => c.ancho).join()})`);
  ok(await p.$eval(`${SEC("colores")} .rn-colores`, ul => [...ul.querySelectorAll(".rn-pista, .rn-muestra")].every(x => x.closest("[aria-hidden='true']"))), "las barras y las muestras no se leen dos veces (el número va en texto)");
  ok((await txt(p, `${SEC("colores")} .rn-nota`)) === "El que más te pones: azul.", "el que más te pones: azul (el jean)");
  // Cuánto te sale cada uso.
  const rinde = await p.$$eval(`${SEC("rinde")} .rn-sub`, hs => hs.map(h => ({ t: h.innerText.trim(), filas: [...h.nextElementSibling.querySelectorAll(".rn-fila small")].map(s => s.innerText.trim()) })));
  ok(rinde.map(r => r.t).join(" | ") === "Lo que mejor rinde | Lo que menos rinde | Sin estrenar", "lo que mejor rinde, lo que menos y lo que no estrenaste");
  ok(rinde[0] && rinde[0].filas.join(" | ") === "Bs\u00a020 por uso · 4 veces | Bs\u00a033,33 por uso · 9 veces | Bs\u00a083,33 por uso · 3 veces", `lo que mejor rinde (${rinde[0] && rinde[0].filas.join(" | ")})`);
  ok(rinde[1] && rinde[1].filas.join(" | ") === "Bs\u00a0300 por uso · 3 veces | Bs\u00a0100 por uso · 5 veces", `lo que menos (${rinde[1] && rinde[1].filas.join(" | ")})`);
  ok(rinde[2] && rinde[2].filas.join() === "Bs\u00a0200 · sin estrenar", "la chompa sin estrenar");
  ok((await sobra(p)) <= 0, "nada se sale a lo ancho");
  await p.waitForTimeout(700);   // el vidrio de la barra termina de deslizarse
  await captura(p, "numeros-390.png");
  if (CAPTURAS) await p.screenshot({ path: `${CAPTURAS}/numeros-390-todo.png`, fullPage: true });
  // Cada prenda lleva a su ficha (y Atrás vuelve).
  await p.click(`${SEC("sin")} .rn-fila >> nth=1`);
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === "#ropa-prenda/abr" && /Abrigo camel/.test(await txt(p, "#panel-ropa-prenda")), "una prenda abre su ficha");
  await p.goBack();
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === "#ropa-numeros" && await p.isVisible(`${SEC("rinde")}`), "Atrás vuelve a tus números");
  // Si anotas algo, los números cambian solos.
  await p.evaluate(d => window.RopaDatos.meLaPuse("short", d, true), HOY);
  await p.waitForTimeout(400);
  ok((await filas(p, SEC("sin"))).map(x => x.t).join() === "Abrigo camel", "te pones el short y sale de «lo que no te pones»");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- La tarjeta de Ropa en Inicio ----------
async function inicio(browser, base, seed) {
  console.log("\nLa tarjeta de Ropa en Inicio");
  const CARD = "a.card:has(#ropa-inicio)";
  let p = await abrir(browser, base, { __SEED__: seed }, { hash: "#inicio", ancho: 390 });
  await p.waitForSelector(`${CARD} .ro-ini-hoy`, { timeout: 6000 }).catch(() => {});
  ok(/^Ropa 9 prendas en tu ropero\. Hoy te pusiste:/.test(await txt(p, CARD)), `lo que te pusiste hoy (${await txt(p, CARD)})`);
  ok(await p.$$eval(`${CARD} .ro-ini-fotos .ro-foto`, xs => xs.length) === 3, "3 fotos (los lentes no: son accesorio)");
  ok(/Jean azul, Polera negra, Zapatillas blancas, Lentes negros\./.test(await p.$eval(`${CARD} .ro-ini-hoy .visually-hidden`, e => e.textContent)), "y los nombres, para quien no ve las fotos");
  ok(await p.getAttribute(CARD, "href") === "#ropa-outfits", "lleva a tus outfits");
  if (CAPTURAS) await (await p.$(CARD)).screenshot({ path: `${CAPTURAS}/numeros-inicio-hoy.png` });
  await p.context().close();

  // Sin nada anotado hoy, con un outfit guardado para hoy.
  const conPlan = Object.assign({}, sinHoy(seed), { "users/test/ropa_outfits": {
    o1: { prendas: ["cam-c", "jean", "zap", "lentes"], nombre: "Oficina fresca", ocasion: "trabajo", origen: "reglas", guardado: true, gusto: "si", para: HOY, creado: DIA("2026-11-22") },
    o2: { prendas: ["pol-b", "short"], nombre: "Otro día", guardado: true, gusto: "si", para: "2026-11-24", creado: DIA("2026-11-22") }
  } });
  p = await abrir(browser, base, { __SEED__: conPlan }, { hash: "#inicio", ancho: 390 });
  await p.waitForSelector(`${CARD} .ro-ini-hoy`, { timeout: 6000 }).catch(() => {});
  ok(/Para hoy elegiste «Oficina fresca»:/.test(await txt(p, CARD)) && await p.$$eval(`${CARD} .ro-ini-fotos .ro-foto`, xs => xs.length) === 3, `el outfit que elegiste para hoy (${await txt(p, CARD)})`);
  if (CAPTURAS) await (await p.$(CARD)).screenshot({ path: `${CAPTURAS}/numeros-inicio-plan.png` });
  await p.evaluate(d => window.RopaDatos.meLaPuse("pol-b", d, true), HOY);
  await p.waitForTimeout(400);
  ok(/Hoy te pusiste:/.test(await txt(p, CARD)) && await p.$$eval(`${CARD} .ro-ini-fotos .ro-foto`, xs => xs.length) === 1, "al anotar lo que te pusiste, cambia solo");
  await p.context().close();

  // Sin nada hoy ni para hoy: la tarjeta de siempre.
  p = await abrir(browser, base, { __SEED__: sinHoy(seed) }, { hash: "#inicio", ancho: 390 });
  await p.waitForTimeout(700);
  ok((await txt(p, CARD)) .endsWith("9 prendas en tu ropero.") && !(await p.$(`${CARD} .ro-ini-hoy`)) && await p.getAttribute(CARD, "href") === "#ropa", "sin nada para hoy: la tarjeta de siempre (lleva al ropero)");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- Tu ropa en "Tu semana" y "Tu año" ----------
async function resumenes(browser, base, seed) {
  console.log("\nTu ropa en «Tu semana» y «Tu año»");
  let p = await abrir(browser, base, { __SEED__: seed }, { hash: "#semana/2026-11-16", ancho: 390 });
  await p.waitForSelector(".sem-area[href='#ropa']", { timeout: 6000 }).catch(() => {});
  const area = await txt(p, ".sem-area[href='#ropa']");
  ok(/^Ropa Anotaste tu ropa 5 días · lo que más: Jean azul \(5 veces\) · compraste 1 prenda/.test(area) && /▲ 4 días/.test(area), `«Tu semana»: Ropa (${area})`);
  if (CAPTURAS) await (await p.$(".sem-area[href='#ropa']")).screenshot({ path: `${CAPTURAS}/numeros-semana.png` });
  await p.click(".sem-area[href='#ropa']");
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => location.hash) === "#ropa", "lleva a tu ropero");
  await p.context().close();

  // "Tu año": la diapositiva de tu ropa (desde el pie de Inicio).
  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#inicio", ancho: 390 });
  await p.waitForTimeout(1500);
  await p.click(".inicio-pie [data-anio-abrir]");
  await p.waitForSelector(".anio-wrapped", { timeout: 6000 }).catch(() => {});
  const vistas = [];
  for (let k = 0; k < 20; k++) {
    vistas.push(await p.evaluate(() => {
      const el = document.querySelector(".anio-wrapped"), sl = el.querySelector(".hb-wr-slide");
      const ancho = [...sl.querySelectorAll("*")].some(x => x.getBoundingClientRect().right > innerWidth + 1);
      return { id: el.dataset.diapo, cuenta: el.querySelector(".hb-wr-cuenta").textContent, texto: sl.innerText.replace(/\s+/g, " ").trim(), ancho };
    }));
    const v = vistas[vistas.length - 1];
    if (v.id === "ropa") {
      if (CAPTURAS) { await p.waitForTimeout(1200); await p.screenshot({ path: `${CAPTURAS}/numeros-anio-ropa.png` }); }
      const [d] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.click(".anio-wrapped [data-anio-compartir]")]);
      ok(d && d.suggestedFilename() === "mi-2026-ropa.png", `«Compartir» tu ropa del año: la imagen (${d && d.suggestedFilename()})`);
      if (CAPTURAS && d) await d.saveAs(`${CAPTURAS}/numeros-anio-ropa-imagen.png`);
    }
    const [a, b] = v.cuenta.split(" de ").map(Number);
    if (a === b) break;
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(150);
  }
  ok(vistas.map(v => v.id).join() === "portada,numeros,ropa,ritmo,cierre", `las diapositivas (${vistas.map(v => v.id).join(", ")})`);
  const ropa = vistas.find(v => v.id === "ropa") || { texto: "" };
  ok(/Ropa 9 veces te pusiste «Jean azul» Tu prenda del año\. Anotaste lo que te pusiste 11 días, con 8 prendas distintas\. Tu color del año: azul\. Compraste 3 prendas\./.test(ropa.texto), `tu prenda del año (${ropa.texto})`);
  ok(!/Bs/.test(ropa.texto) && !ropa.ancho, "sin plata y sin salirse a lo ancho");
  ok(/11 días con tu ropa anotada/.test((vistas.find(v => v.id === "numeros") || { texto: "" }).texto), "en «Tu año en números»");
  const dest = await p.evaluate(() => window.ResumenAnio.anio(window.ResumenFuentes.datos(), 2026).destacados.map(x => x.texto));
  ok(dest.includes("Tu prenda del año: Jean azul"), `y en lo destacado de la imagen de tu año (${dest.join(" · ")})`);
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- Sin ropa, 320, claro y la compu ----------
async function otras(browser, base, seed) {
  console.log("\nSin ropa, 320 px, claro y la compu");
  let p = await abrir(browser, base, { __SEED__: {} }, { hash: "#ropa", ancho: 390 });
  await p.waitForTimeout(700);
  ok(!(await p.isVisible("#ro-numeros-link")), "sin ropa: el ropero no muestra «Tus números»");
  await ir(p, "ropa-numeros");
  await p.waitForTimeout(400);
  ok(/Todavía no hay números\./.test(await txt(p, "#rn-app")) && await p.$('#rn-app a[href="#ropa"]') !== null, "y la pantalla lo explica y lleva al ropero");
  await p.context().close();

  // Sin precios ni nada anotado.
  const sinNada = { "users/test/ropa": Object.fromEntries(Object.entries(seed["users/test/ropa"]).map(([id, d]) => { const x = Object.assign({}, d); delete x.precio; return [id, x]; })) };
  p = await abrir(browser, base, { __SEED__: sinNada }, { hash: "#ropa-numeros", ancho: 390 });
  await p.waitForSelector("#rn-app .rn-cifras", { timeout: 6000 }).catch(() => {});
  ok(!(await p.$(".rn-cifra.is-plata")) && (await txt(p, ".rn-cifras")) === "9 prendas 0 de 30 días anotados" && /Cuando anotes lo que te pones/.test(await txt(p, SEC("mas"))) && /Pon el precio de tus prendas/.test(await txt(p, SEC("rinde"))),
    `sin precios ni nada anotado: sin lo invertido y dice cómo llenarlo (${await txt(p, ".rn-cifras")})`);
  await p.context().close();

  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-numeros", ancho: 320 });
  await p.waitForSelector("#rn-app .rn-cifras", { timeout: 6000 }).catch(() => {});
  ok(await sobra(p) <= 0, "320 px: nada se sale a lo ancho");
  const lineas = await p.$$eval(".rn-cifra b", bs => bs.map(b => ({ t: b.innerText, alto: Math.round(b.getBoundingClientRect().height), linea: parseFloat(getComputedStyle(b).lineHeight), cabe: b.scrollWidth <= b.clientWidth })));
  ok(lineas.every(x => x.alto < x.linea * 1.5 && x.cabe), `320 px: cada cifra en una línea (lo invertido no se parte)${lineas.every(x => x.alto < x.linea * 1.5 && x.cabe) ? "" : `: ${JSON.stringify(lineas)}`}`);
  const corta = await p.$$eval(".rn-colores li", lis => lis.every(li => li.getBoundingClientRect().right <= innerWidth && li.querySelector(".rn-pista").getBoundingClientRect().width >= 40));
  ok(corta, "320 px: los colores entran, con barras visibles");
  ok((await p.evaluate(auditarContraste)).length === 0, "en oscuro, cada texto se lee bien");
  await captura(p, "numeros-320.png");
  await p.context().close();

  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-numeros", ancho: 390, esquema: "light" });
  await p.waitForSelector("#rn-app .rn-cifras", { timeout: 6000 }).catch(() => {});
  const barra = await p.$eval(".rn-pista i", i => getComputedStyle(i).backgroundColor);
  ok(barra === "rgb(163, 82, 0)", `en claro, las barras con su color de claro (${barra})`);
  let malos = [];
  for (const y of [0, 700, 1400, 2100]) {
    await p.evaluate(v => window.scrollTo(0, v), y);
    await p.waitForTimeout(150);
    malos = malos.concat(await p.evaluate(auditarContraste));
  }
  ok(!malos.length, `en claro, cada texto se lee bien${malos.length ? `: ${malos.slice(0, 3).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);
  await captura(p, "numeros-claro-390.png");
  ok(!p.errores.length, `en claro, sin errores${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();

  p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-numeros", ancho: 1280, alto: 900 });
  await p.waitForSelector("#rn-app .rn-cifras", { timeout: 6000 }).catch(() => {});
  ok(await sobra(p) <= 0, "la compu: nada se sale a lo ancho");
  ok(await p.$eval("#rn-app", el => el.getBoundingClientRect().width) <= 900, "la compu: no se estira de lado a lado");
  await captura(p, "numeros-1280.png");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const seed = await semilla(browser, base);
  await numeros(browser, base, seed);
  await inicio(browser, base, seed);
  await resumenes(browser, base, seed);
  await otras(browser, base, seed);
  await terminar(browser, srv);
})();
