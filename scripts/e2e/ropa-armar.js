// Pruebas de pantalla de Ropa, nivel 2, fase 1 (D-156; docs/ROPA_ESTILISTA.md):
// (1) Ver en grande: una opción de Outfits (tocando sus fotos o "Ver en
// grande"), con las de al lado a un toque, el orden de la cabeza a los pies,
// "Otra opción", "Guardar" y cada prenda a su ficha; un guardado (con Editar y
// Duplicar) y lo de hoy. (2) Armar el mío: las partes, tocar suma o cambia,
// los avisos (falta, sobra, para lavar, el frío del día, las capas, qué tan
// formal), los filtros, el orden de las capas, ver en grande, la ocasión y el
// nombre, el borrador que queda, Guardar (con Deshacer), Me lo pongo y Para
// mañana, Empezar de cero. (3) Cambiar una prenda desde una opción (si no la
// cambias, queda como era). (4) Editar y duplicar un guardado. (5) Sin
// internet. (6) A 320 px en oscuro y en claro: nada se sale, todo se toca con
// el dedo y se lee bien.
// Uso: node scripts/e2e/ropa-armar.js [carpeta-para-capturas]
const fs = require("node:fs");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";   // lunes; a la mañana hace frío y al mediodía sube (capas)
const HOY = "2026-11-23", MANANA = "2026-11-24";
const CLIMA = JSON.parse(fs.readFileSync(path.join(__dirname, "../../tests/fixtures/clima/la-paz-2026-11-23.json"), "utf8"));
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const col = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const outfits = p => col(p, "users/test/ropa_outfits");
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const deshacer = async p => { await p.click("#ro-toast .undo-toast-btn"); await p.waitForTimeout(400); };
const visible = (p, sel) => p.$eval(sel, el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden").catch(() => false);
const sinErrores = p => ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
const clave = ids => [...ids].sort().join("|");

// Fotos de mentira (3:4): la forma de cada prenda sobre un fondo claro.
const FORMAS = {
  polera: "M28 22h13q9 7 18 0h13l15 13-9 11-7-5v43H29V41l-7 5-9-11Z", chompa: "M30 20h40l10 8 7 46-9 2-6-34v46H28V42l-6 34-9-2 7-46Z",
  chamarra: "M30 18h40l11 9 7 47-9 2-7-33v45H28V43l-7 33-9-2 7-47Z", pantalon: "M31 12h38l5 77H56l-6-52-6 52H26Z",
  zapatos: "M12 60q12-2 22-15l10 6q14 9 36 11 9 1 9 12v5H12Z", gorra: "M26 60q2-28 24-28t24 28Z M50 60h36q-3 8-12 8H50Z"
};
const svg = (forma, hex) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="#ebe6dc"/><path transform="translate(-5 10)" d="${FORMAS[forma]}" fill="${hex}"/></svg>`);
const DIA = f => Date.parse(`${f}T12:00:00Z`);
function semilla() {
  const ropa = {};
  [["pol", "arriba", "Polera", "blanco", "#f4f4f2", "polera", {}], ["cam", "arriba", "Camisa", "celeste", "#8fc3ea", "polera", { formalidad: 3 }],
   ["cho", "arriba", "Chompa", "bordo", "#6e1f2c", "chompa", { clima: ["frio"] }], ["sucia", "arriba", "Polera", "negro", "#151515", "polera", { estado: "lavar" }],
   ["jean", "abajo", "Jean", "azul-jean", "#4f6f9a", "pantalon", { formalidad: 2 }], ["tela", "abajo", "Pantalón de tela", "negro", "#1b1b1b", "pantalon", { formalidad: 5 }],
   ["cha", "abrigos", "Chamarra", "verde-oliva", "#6b7134", "chamarra", { clima: ["frio"] }],
   ["zap", "zapatos", "Zapatillas", "blanco", "#f4f4f2", "zapatos", { formalidad: 1 }], ["zn", "zapatos", "Zapatos", "negro", "#151515", "zapatos", { formalidad: 4 }],
   ["gor", "accesorios", "Gorra", "negro", "#151515", "gorra", {}]]
    .forEach(([id, grupo, tipo, color, hex, forma, extra], k) => {
      ropa[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estampado: "liso", tela: "", estilo: ["casual"], clima: ["templado"], formalidad: null, marca: "", notas: "",
        fotos: [{ id: `f-${id}`, mini: svg(forma, hex), ancho: 900, alto: 1200 }], estado: "activa", creado: DIA("2026-10-01") + k }, extra);
    });
  const usos = { [HOY]: { prendas: ["cam", "jean", "zn"], actualizado: DIA(HOY) }, "2026-11-20": { prendas: ["pol", "jean", "zap"], actualizado: DIA("2026-11-20") } };
  const outs = { o1: { v: 1, prendas: ["cam", "tela", "zn"], nombre: "Oficina fresca", ocasion: "trabajo", origen: "reglas", porque: "Celeste con negro: prolijo.", guardado: true, gusto: "si", puesto: ["2026-11-10"], creado: DIA("2026-11-09") } };
  const meta = { ropa_ajustes: { ciudad: { nombre: "La Paz", lat: -16.5, lon: -68.15 } } };
  return { "users/test/ropa": ropa, "users/test/ropa_usos": usos, "users/test/ropa_outfits": outs, "users/test/meta": meta };
}
const CLIMA_GUARDADO = JSON.stringify({ k: "-16.5,-68.15", hora: Date.parse(FECHA), json: CLIMA });
async function abrir(browser, base, o) {
  const p = await abrirBase(browser, base, Object.assign({ __SEED__: semilla(), "manolo.ropa.clima": CLIMA_GUARDADO }, o.estado || {}),
    Object.assign({ zona: ZONA, fecha: FECHA, ancho: 390, rutas: async ctx => { await ctx.route(/open-meteo\.com/, r => r.abort()); } }, o));
  for (let k = 0; k < 30 && !(await p.$eval("body", b => getComputedStyle(b).display).catch(() => "")); k++) await p.waitForTimeout(100);
  await p.waitForTimeout(500);
  return p;
}
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
// Las opciones de hoy (si ya estaban armadas, esas).
async function armarOpciones(p) {
  if (!(await p.$("#rof-app .rof-op"))) await p.click('#rof-app [data-rof="armar"]');
  await p.waitForSelector("#rof-app .rof-op", { timeout: 6000 });
  await p.waitForTimeout(300);
}
// Las prendas de la hoja "en grande", en el orden en que se ven.
const enGrande = (p, hoja) => p.$$eval(`.${hoja || "rof-hoja-ver"} .rof-tab`, as => as.map(a => decodeURIComponent(a.getAttribute("href").split("/")[1])));
// El orden que tiene que ser (el del motor, con las prendas de la app).
const ordenEsperado = (p, ids) => p.evaluate(xs => window.RopaArmarMotor.ordenar(xs.map(id => window.RopaDatos.una(id))).map(x => x.id), ids);
const elegidas = p => p.$$eval("#roar-app [data-roar-x]", bs => bs.map(b => b.dataset.roarX));
const avisos = p => p.$$eval("#roar-app .roar-aviso", ps => ps.map(x => x.innerText.replace(/\s+/g, " ").trim()));
const tocarPrenda = async (p, id) => { await p.click(`#roar-app [data-roar-p="${id}"]`); await p.waitForTimeout(150); };
const parte = async (p, id) => { await p.click(`#roar-app [data-roar-parte="${id}"]`); await p.waitForTimeout(150); };

// ---------- (1) Ver en grande ----------
async function verEnGrande(browser, base) {
  console.log("\nVer un outfit en grande (390 px)");
  const p = await abrir(browser, base, { hash: "#ropa-outfits" });
  await armarOpciones(p);
  const ops = await p.$$eval("#rof-app .rof-op", els => els.map(el => [...el.querySelectorAll(".rof-foto-a")].map(a => a.dataset.prenda)));
  ok(ops.length === 3, "tres opciones");
  ok(await p.$$eval("#rof-app .rof-op", els => els.every(el => /Ver en grande/.test(el.innerText) && /Cambiar una prenda/.test(el.innerText))), "cada opción: «Ver en grande» y «Cambiar una prenda»");
  // Tocar las fotos: la opción en grande.
  await p.click("#rof-app .rof-op:nth-child(1) .rof-ver-a");
  await p.waitForSelector(".rof-hoja-ver .rof-tablero", { timeout: 3000 });
  await p.waitForTimeout(300);
  const nombre1 = await p.$eval("#rof-app .rof-op:nth-child(1) .rof-op-t", el => el.lastChild.textContent.trim());
  ok((await txt(p, ".rof-hoja-ver h3")).includes(nombre1) && /Opción 1 de 3/.test(await txt(p, ".rof-ver-nav")), `tocar las fotos la abre en grande («${nombre1}», opción 1 de 3)`);
  const vistas = await enGrande(p);
  ok(clave(vistas) === clave(ops[0]), "con todas sus prendas");
  ok(vistas.join() === (await ordenEsperado(p, ops[0])).join(), `de la cabeza a los pies y de afuera hacia adentro (${vistas.join(", ")})`);
  const alto = await p.$eval(".rof-hoja-ver .rof-tab-foto", el => el.getBoundingClientRect().height);
  ok(alto >= 150, `las fotos, en grande (${Math.round(alto)} px de alto; en la tarjeta, 64)`);
  ok(/·/.test(await txt(p, ".rof-hoja-ver .rof-ver > .rof-lista")), "debajo, los nombres completos");
  await captura(p, "armar-ver-opcion-390.png");
  // Las de al lado.
  await p.click('.rof-hoja-ver [data-rof-v="sig"]');
  await p.waitForTimeout(250);
  ok(/Opción 2 de 3/.test(await txt(p, ".rof-ver-nav")) && clave(await enGrande(p)) === clave(ops[1]), "«›»: la opción 2");
  await p.click('.rof-hoja-ver [data-rof-v="ant"]');
  await p.click('.rof-hoja-ver [data-rof-v="ant"]');
  await p.waitForTimeout(250);
  ok(/Opción 3 de 3/.test(await txt(p, ".rof-ver-nav")) && clave(await enGrande(p)) === clave(ops[2]), "«‹» dos veces: da la vuelta a la 3");
  // Otra opción, desde la grande: cambia esa y se queda abierta.
  await p.click('.rof-hoja-ver [data-rof-v="otra"]');
  await p.waitForTimeout(350);
  const otra = await enGrande(p);
  ok(await visible(p, ".rof-hoja-ver .rof-tablero") && clave(otra) !== clave(ops[2]) && /Opción 3 de 3/.test(await txt(p, ".rof-ver-nav")), "«Otra opción» la cambia ahí mismo");
  // Guardar, desde la grande.
  await p.click('.rof-hoja-ver [data-rof-v="guardar"]');
  await p.waitForTimeout(450);
  const g = Object.values(await outfits(p)).find(o => clave(o.prendas) === clave(otra));
  ok(g && g.guardado === true && /Guardado en tus outfits/.test(await toast(p)) && !(await visible(p, ".rof-hoja-ver .rof-tablero")), "«Guardar» la guarda y cierra");
  // Con el botón: el foco vuelve a él al cerrar.
  await p.click('#rof-app .rof-op:nth-child(2) .rof-op-ver [data-rof-op="ver"]');
  await p.waitForSelector(".rof-hoja-ver .rof-tablero", { timeout: 3000 });
  await p.waitForTimeout(300);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const a = document.activeElement; return !!a && a.dataset.rofOp === "ver" && a.dataset.i === "1"; }), "al cerrar, el foco vuelve a «Ver en grande»");
  // Una prenda: a su ficha.
  await p.click('#rof-app .rof-op:nth-child(1) .rof-op-ver [data-rof-op="ver"]');
  await p.waitForSelector(".rof-hoja-ver .rof-tab", { timeout: 3000 });
  await p.waitForTimeout(300);
  const primera = (await enGrande(p))[0];
  await p.click(".rof-hoja-ver .rof-tab");
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === `#ropa-prenda/${primera}` && !(await visible(p, ".rof-hoja-ver .rof-tablero")), "tocar una prenda abre su ficha");
  // Lo de hoy, en grande.
  await ir(p, "ropa-outfits");
  ok(await visible(p, "#rof-app .rof-hoy-ver"), "«Hoy te pusiste» también: «Ver en grande»");
  await p.click("#rof-app .rof-hoy-ver");
  await p.waitForSelector(".rof-hoja-dia .rof-tablero", { timeout: 3000 });
  ok(clave(await enGrande(p, "rof-hoja-dia")) === clave(["cam", "jean", "zn"]), "lo de hoy, en grande");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  // Un guardado, en grande, con Editar y Duplicar.
  await p.click('#rof-app [data-rof-g="o1"]');
  await p.waitForSelector(".rof-hoja-guardado .rof-tablero", { timeout: 3000 });
  ok(clave(await enGrande(p, "rof-hoja-guardado")) === clave(["cam", "tela", "zn"]) && /Editar/.test(await txt(p, ".rof-hoja-guardado")) && /Duplicar/.test(await txt(p, ".rof-hoja-guardado")), "un guardado, en grande, con «Editar» y «Duplicar»");
  await captura(p, "armar-ver-guardado-390.png");
  sinErrores(p);
  await p.context().close();
}

// ---------- (2) Armar el mío ----------
async function armarElMio(browser, base) {
  console.log("\nArmar el mío (390 px)");
  let p = await abrir(browser, base, { hash: "#ropa-outfits" });
  ok(await visible(p, '#rof-app a.rof-mio[href="#ropa-armar"]'), "Outfits: «Armar el mío»");
  await p.click("#rof-app a.rof-mio");
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === "#ropa-armar" && /Armar el mío/.test(await txt(p, "#panel-ropa-armar h1")), "abre «Armar el mío»");
  ok((await p.$$eval("#bottom-nav-links a.active", as => as.map(a => a.dataset.hash))).join() === "ropa-outfits", "con Outfits marcado en la barra");
  ok(/Elige abajo lo que te quieres poner/.test(await txt(p, "#roar-app .roar-outfit")) && await p.$eval('#roar-app [data-roar="guardar"]', b => b.disabled), "vacío: te dice qué hacer (y no deja guardar nada)");
  ok((await p.$$eval("#roar-app [data-roar-parte]", bs => bs.map(b => b.textContent.trim()))).join(", ") === "Arriba, Abajo, Abrigo, Zapatos, Accesorios", "las partes que tienes (sin cuerpo entero)");
  // Arriba: la polera.
  await tocarPrenda(p, "pol");
  ok((await elegidas(p)).join() === "pol" && await p.$eval('#roar-app [data-roar-p="pol"]', b => b.getAttribute("aria-pressed") === "true"), "tocar la polera: aparece en tu outfit (y marcada)");
  ok((await avisos(p)).join(" | ") === "Falta algo de abajo. | Faltan los zapatos. | Hace frío (9° a la mañana): ¿sumas algo de abrigo?", `los avisos (${(await avisos(p)).join(" | ")})`);
  ok(/Arriba1/.test((await txt(p, '#roar-app [data-roar-parte="arriba"]')).replace(/\s/g, "")), "la parte dice cuántas elegiste");
  // Para lavar: se ve, avisa.
  ok(/Para lavar/.test(await txt(p, '#roar-app [data-roar-p="sucia"]')), "lo que está para lavar se ve (apagado)");
  await tocarPrenda(p, "sucia");
  ok((await avisos(p))[0] === "Está para lavar: Polera negra.", "y si la eliges, avisa");
  await p.click('#roar-app [data-roar-x="sucia"]');
  await p.waitForTimeout(150);
  ok((await elegidas(p)).join() === "pol", "✕ la saca");
  // Los filtros de color.
  const fam = await p.evaluate(() => window.RopaMotor.COLOR.celeste.fam);
  await p.click(`#roar-app [data-roar-color="${fam}"]`);
  await p.waitForTimeout(150);
  ok((await p.$$eval("#roar-app .roar-grilla [data-roar-p]", bs => bs.map(b => b.dataset.roarP))).join() === "cam", "el filtro de color: solo la camisa celeste");
  await p.click('#roar-app [data-roar-color=""]');
  await p.waitForTimeout(150);
  // Abajo: el jean, y después el pantalón de tela lo cambia.
  await parte(p, "abajo");
  await tocarPrenda(p, "jean");
  await tocarPrenda(p, "tela");
  ok(clave(await elegidas(p)) === clave(["pol", "tela"]), "otro pantalón cambia el que había");
  await tocarPrenda(p, "jean");
  // Zapatos y abrigo; arriba, la chompa sobre la polera.
  await parte(p, "zapatos");
  await tocarPrenda(p, "zap");
  ok((await avisos(p)).join(" | ") === "Hace frío (9° a la mañana): ¿sumas algo de abrigo?", "con lo de abajo y los zapatos, solo queda el frío");
  await parte(p, "abrigos");
  await tocarPrenda(p, "cha");
  ok((await avisos(p)).join(" | ") === "Al mediodía sube a 20°: chamarra verde oliva es para la mañana.", `con la chamarra: las capas del día (${(await avisos(p)).join(" | ")})`);
  await parte(p, "arriba");
  await tocarPrenda(p, "cho");
  ok((await elegidas(p)).join() === "cha,cho,pol,jean,zap", `en capas: la chamarra, la chompa, la polera, el jean y las zapatillas (${(await elegidas(p)).join(",")})`);
  // Al bajar a las fotos: la barra queda fija (debajo de la de arriba de Manolo) con lo elegido en chico.
  await p.evaluate(() => { const g = document.querySelector("#roar-app .roar-grilla"); window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 120); });
  await p.waitForTimeout(500);
  const barra = await p.evaluate(() => {
    const b = document.querySelector("#roar-app .roar-barra").getBoundingClientRect(), t = document.querySelector(".topbar").getBoundingClientRect();
    const m = document.querySelector("#roar-app .roar-mini");
    return { arriba: b.top, techo: t.bottom, mini: !!m && m.classList.contains("is-visible"), fotos: m ? m.querySelectorAll(".ro-foto").length : 0 };
  });
  ok(barra.mini && barra.fotos === 5 && Math.abs(barra.arriba - barra.techo) <= 2, `al bajar, las partes quedan fijas arriba con tus 5 prendas en chico (${Math.round(barra.arriba)} y ${Math.round(barra.techo)} px)`);
  await captura(p, "armar-el-mio-390.png");
  await p.click("#roar-app .roar-mini");
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => window.scrollY) < 5, "tocarlas te lleva de vuelta a tu outfit");
  // Ver en grande.
  await p.click('#roar-app [data-roar="ver"]');
  await p.waitForSelector(".rof-hoja-ver .rof-tablero", { timeout: 3000 });
  ok((await enGrande(p)).join() === "cha,cho,pol,jean,zap", "«Ver en grande»: el mismo orden");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  // La ocasión y el nombre; el borrador queda.
  await p.click('#roar-app [name="roar-ocasion"][value="trabajo"]', { force: true });
  await p.fill('#roar-app [name="roar-nombre"]', "Mi primer outfit");
  await p.waitForTimeout(150);
  await p.reload();
  await p.waitForTimeout(900);
  ok((await elegidas(p)).join() === "cha,cho,pol,jean,zap" && await p.inputValue('#roar-app [name="roar-nombre"]') === "Mi primer outfit" && await p.$eval('#roar-app [name="roar-ocasion"][value="trabajo"]', i => i.checked), "si cierras y vuelves, tu borrador sigue ahí");
  // Guardar (con Deshacer).
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(600);
  let os = Object.values(await outfits(p));
  let mio = os.find(o => clave(o.prendas) === clave(["cha", "cho", "pol", "jean", "zap"]));
  ok(await p.evaluate(() => location.hash) === "#ropa-outfits" && mio && mio.origen === "manual" && mio.nombre === "Mi primer outfit" && mio.ocasion === "trabajo" && mio.guardado === true, "«Guardar»: tuyo, con su nombre y su ocasión, y vuelve a Outfits");
  ok(/Guardado en tus outfits/.test(await toast(p)) && /Mi primer outfit/.test(await txt(p, "#rof-app .rof-guardados")), "lo dice y está en tus guardados");
  await deshacer(p);
  ok(!Object.values(await outfits(p)).some(o => clave(o.prendas) === clave(["cha", "cho", "pol", "jean", "zap"])), "Deshacer lo borra");
  // Me lo pongo.
  await ir(p, "ropa-armar");
  ok(!(await elegidas(p)).length, "después de guardar, empieza de cero");
  await tocarPrenda(p, "cam");
  await parte(p, "abajo"); await tocarPrenda(p, "tela");
  await parte(p, "zapatos"); await tocarPrenda(p, "zap");
  ok((await avisos(p)).includes("Mezcla algo muy formal con algo muy informal."), "un pantalón de tela con zapatillas: avisa (y deja guardar)");
  await p.click('#roar-app [data-roar="puse"]');
  await p.waitForTimeout(600);
  const usos = (await col(p, "users/test/ropa_usos"))[HOY];
  os = Object.values(await outfits(p));
  mio = os.find(o => clave(o.prendas) === clave(["cam", "tela", "zap"]));
  ok(["cam", "tela", "zap"].every(id => usos.prendas.includes(id)) && mio && mio.puesto.includes(HOY) && mio.origen === "manual", "«Me lo pongo»: anotado hoy");
  // Para mañana.
  await ir(p, "ropa-armar");
  await tocarPrenda(p, "pol");
  await parte(p, "abajo"); await tocarPrenda(p, "jean");
  await p.click('#roar-app [data-roar="manana"]');
  await p.waitForTimeout(600);
  mio = Object.values(await outfits(p)).find(o => clave(o.prendas) === clave(["pol", "jean"]));
  ok(mio && mio.para === MANANA && mio.guardado && /queda para mañana/.test(await toast(p)), "«Para mañana»: guardado para el 24");
  // Empezar de cero (con Deshacer).
  await ir(p, "ropa-armar");
  await tocarPrenda(p, "cho");
  await p.click('#roar-app [data-roar="cero"]');
  await p.waitForTimeout(250);
  ok(!(await elegidas(p)).length && /Empezaste de cero/.test(await toast(p)), "«Empezar de cero»");
  await deshacer(p);
  ok((await elegidas(p)).join() === "cho", "Deshacer lo trae de vuelta");
  sinErrores(p);
  await p.context().close();
}

// ---------- (3) Cambiar una prenda; (4) editar y duplicar ----------
async function cambiarYEditar(browser, base) {
  console.log("\nCambiar una prenda, editar y duplicar (390 px)");
  const p = await abrir(browser, base, { hash: "#ropa-outfits" });
  await armarOpciones(p);
  const op1 = await p.$$eval("#rof-app .rof-op:nth-child(1) .rof-foto-a", as => as.map(a => a.dataset.prenda));
  await p.click('#rof-app .rof-op:nth-child(1) [data-rof-op="cambiar"]');
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => location.hash) === "#ropa-armar" && clave(await elegidas(p)) === clave(op1), "«Cambiar una prenda»: «Armar el mío» con esa opción");
  // Sin cambiar nada: queda como era (de las reglas).
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(600);
  let o = Object.values(await outfits(p)).find(x => clave(x.prendas) === clave(op1));
  ok(o && o.origen === "reglas" && o.porque, "si no la cambias, se guarda como era (con su porqué)");
  await deshacer(p);
  // Cambiando los zapatos: tuya.
  await armarOpciones(p);
  const op = await p.$$eval("#rof-app .rof-op:nth-child(1) .rof-foto-a", as => as.map(a => a.dataset.prenda));
  await p.click('#rof-app .rof-op:nth-child(1) [data-rof-op="cambiar"]');
  await p.waitForTimeout(600);
  await parte(p, "zapatos");
  const otros = op.includes("zap") ? "zn" : "zap";
  await tocarPrenda(p, otros);
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(600);
  o = Object.values(await outfits(p)).find(x => x.prendas.includes(otros) && x.origen === "manual");
  ok(o && !o.porque, "cambiando una prenda, queda tuya (sin el porqué de antes)");
  // Editar un guardado.
  await ir(p, "ropa-outfits");
  await p.click('#rof-app [data-rof-g="o1"]');
  await p.waitForSelector(".rof-hoja-guardado [data-rof-h=\"editar\"]", { timeout: 3000 });
  await p.click('.rof-hoja-guardado [data-rof-h="editar"]');
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => location.hash) === "#ropa-armar/o/o1" && /Editando «Oficina fresca»/.test(await txt(p, "#roar-app")) && clave(await elegidas(p)) === clave(["cam", "tela", "zn"]), "«Editar»: con sus prendas, su nombre y su ocasión");
  ok(await p.inputValue('#roar-app [name="roar-nombre"]') === "Oficina fresca" && await p.$eval('#roar-app [name="roar-ocasion"][value="trabajo"]', i => i.checked) && /Guardar los cambios/.test(await txt(p, "#roar-app .roar-bots")), "el nombre, la ocasión y «Guardar los cambios»");
  await parte(p, "abajo");
  await tocarPrenda(p, "jean");
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(700);
  let os = await outfits(p);
  const nuevo = Object.entries(os).find(([id, x]) => id !== "o1" && clave(x.prendas) === clave(["cam", "jean", "zn"]));
  ok(nuevo && nuevo[1].guardado && nuevo[1].nombre === "Oficina fresca" && os.o1.guardado === false && os.o1.puesto.length === 1, "guardado: el nuevo, con su nombre; el de antes deja de estar guardado (su historia queda)");
  await deshacer(p);
  os = await outfits(p);
  ok(os.o1.guardado === true && !Object.entries(os).some(([id, x]) => id !== "o1" && clave(x.prendas) === clave(["cam", "jean", "zn"])), "Deshacer deja todo como estaba");
  // Duplicar.
  await p.click('#rof-app [data-rof-g="o1"]');
  await p.waitForSelector('.rof-hoja-guardado [data-rof-h="duplicar"]', { timeout: 3000 });
  await p.click('.rof-hoja-guardado [data-rof-h="duplicar"]');
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => location.hash) === "#ropa-armar/d/o1" && /Una copia de tu outfit/.test(await txt(p, "#roar-app")), "«Duplicar»: una copia para cambiarle algo");
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(400);
  ok(/Es igual al que ya tienes/.test(await toast(p)) && await p.evaluate(() => location.hash) === "#ropa-armar/d/o1", "igual al de antes: te lo dice");
  await parte(p, "zapatos");
  await tocarPrenda(p, "zap");
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(600);
  os = await outfits(p);
  ok(os.o1.guardado === true && Object.values(os).some(x => clave(x.prendas) === clave(["cam", "tela", "zap"]) && x.guardado), "la copia queda y el de antes sigue igual");
  // Armar el mío (sin un guardado): lo que duplicabas queda atrás.
  await ir(p, "ropa-armar");
  ok(!(await elegidas(p)).length && !/Una copia/.test(await txt(p, "#roar-app")), "«Armar el mío» después: empieza de cero");
  sinErrores(p);
  await p.context().close();
}

// ---------- (5) Sin internet ----------
async function sinInternet(browser, base) {
  console.log("\nArmar el mío sin internet");
  const p = await abrir(browser, base, { hash: "#ropa-armar" });
  await p.context().setOffline(true);
  await tocarPrenda(p, "pol");
  await parte(p, "abajo"); await tocarPrenda(p, "jean");
  await parte(p, "zapatos"); await tocarPrenda(p, "zap");
  ok((await avisos(p)).some(a => /Hace frío/.test(a)), "sin internet: arma igual, con el clima guardado");
  await p.click('#roar-app [data-roar="guardar"]');
  await p.waitForTimeout(600);
  ok(Object.values(await outfits(p)).some(o => clave(o.prendas) === clave(["pol", "jean", "zap"]) && o.guardado), "y lo guarda");
  sinErrores(p);
  await p.context().close();
}

// ---------- (6) A 320 px, en oscuro y en claro ----------
async function chico(browser, base, esquema) {
  console.log(`\nA 320 px, en ${esquema === "light" ? "claro" : "oscuro"}`);
  const p = await abrir(browser, base, { hash: "#ropa-armar", ancho: 320, esquema });
  await tocarPrenda(p, "cho"); await tocarPrenda(p, "pol");
  await parte(p, "abajo"); await tocarPrenda(p, "jean");
  await parte(p, "abrigos"); await tocarPrenda(p, "cha");
  ok(await sobra(p) <= 0, "«Armar el mío»: nada se sale a lo ancho");
  const chicos = await p.$$eval("#roar-app .roar-x, #roar-app .roar-p, #roar-app [data-roar-parte], #roar-app [data-roar-color], #roar-app .roar-bots > *, #roar-app [data-roar=\"ver\"], #roar-app .ro-op-chip span",
    els => els.filter(e => e.getClientRects().length).filter(e => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).map(e => e.className || e.textContent.trim()));
  ok(!chicos.length, `todo se toca bien con el dedo${chicos.length ? `: ${chicos.slice(0, 3).join(", ")}` : ""}`);
  let malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, `armar-320-${esquema === "light" ? "claro" : "oscuro"}.png`);
  await p.click('#roar-app [data-roar="ver"]');
  await p.waitForSelector(".rof-hoja-ver .rof-tablero", { timeout: 3000 });
  await p.waitForTimeout(300);
  ok(await sobra(p) <= 0, "en grande: nada se sale a lo ancho");
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `en grande, todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, `armar-ver-320-${esquema === "light" ? "claro" : "oscuro"}.png`);
  await p.keyboard.press("Escape");
  await ir(p, "ropa-outfits");
  await armarOpciones(p);
  ok(await sobra(p) <= 0, "Outfits con «Ver en grande» y «Cambiar una prenda»: nada se sale");
  malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `Outfits: todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  sinErrores(p);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await verEnGrande(browser, base);
  await armarElMio(browser, base);
  await cambiarYEditar(browser, base);
  await sinInternet(browser, base);
  for (const esquema of ["dark", "light"]) await chico(browser, base, esquema);
  await terminar(browser, srv);
})();
