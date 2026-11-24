// Pruebas de pantalla de Ropa: el corte, las mangas, cambiar los colores y
// las mayúsculas (D-154; docs/ROPA.md).
// (1) Sin IA, a 390 px: el corte con el nombre que va con la prenda (cambia
// con el tipo y el grupo; zapatos sin corte; mangas solo arriba y cuerpo
// entero), volver a tocar el corte elegido lo quita, los colores (tocar uno
// para cambiarlo, "Que sea el principal", elegir uno que ya estaba), las
// mayúsculas al guardar, la ficha (Corte, Mangas y "Cambiar los colores") y
// buscar por el corte. (2) La IA (un puente de mentira) llena el corte y las
// mangas. (3) Lo de antes (sin corte ni mangas) sigue igual. (4) A 320 px,
// en oscuro y en claro, con la paleta abierta: nada se sale a lo ancho, todo
// se toca con el dedo y se lee bien.
// Uso: node scripts/e2e/ropa-corte.js [carpeta-para-capturas]
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar, auditarContraste } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-24T09:00:00-04:00";
const COL = "users/test/ropa";
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const docs = p => p.evaluate(c => Object.fromEntries(window.__fakeStore.colMap(c)), COL);
const porTipo = async (p, tipo) => Object.entries(await docs(p)).find(([, d]) => d.tipo === tipo) || [null, null];
const enHoja = s => `.ro-hoja-form ${s}`;
// Marcar como lo hace el dedo: el toque cae en el círculo (invisible, cubre la opción).
// (Quitar uno ya elegido pasa justo después del toque: espera un poco.)
const tocar = async (p, nombre, valor) => { await p.click(enHoja(`input[name="${nombre}"][value="${valor}"]`)); await p.waitForTimeout(80); };
const marcado = (p, nombre) => p.$$eval(enHoja(`input[name="${nombre}"]:checked`), els => els.map(e => e.value).join(","));
const opciones = (p, sel) => p.$$eval(enHoja(`${sel} .ro-op-chip span`), s => s.map(x => x.textContent.trim()).join(", "));
// Lo que de verdad se ve (no basta el atributo hidden: un estilo puede ganarle).
const visible = (p, sel) => p.$eval(enHoja(sel), el => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden").catch(() => false);
const chips = p => p.$$eval(enHoja("[data-ro-colores] .ro-color-cambiar"), bs => bs.map(b => b.textContent.replace(/\s+/g, " ").trim()).join(" | "));
const paleta = p => visible(p, "[data-ro-paleta-lista]");
const foco = p => p.evaluate(() => (document.activeElement && document.activeElement.dataset.roColorCambiar) || "");
const sinErrores = p => ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);

async function abrir(browser, base, estado, o) {
  const p = await abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA }, o));
  // Con el reloj fijo, justo al abrir, el primer $eval a veces lee la página
  // sin estilos: espera a que los lea antes de seguir.
  for (let k = 0; k < 30 && !(await p.$eval("body", b => getComputedStyle(b).display).catch(() => "")); k++) await p.waitForTimeout(100);
  return p;
}
async function abrirMas(p) {
  await p.locator("[data-ropa-mas]").locator("visible=true").first().click();
  await p.waitForSelector(".ro-hoja-mas:not([hidden]) [data-ro-fotos]", { state: "attached", timeout: 4000 });
  await p.waitForTimeout(250);
}
async function esperarFormulario(p) {
  await p.waitForSelector(enHoja(".ro-form"), { timeout: 8000 });
  await p.waitForTimeout(200);
}
async function sinFoto(p) {
  await abrirMas(p);
  await p.click(".ro-hoja-mas [data-ro-sinfoto]");
  await esperarFormulario(p);
}
async function guardar(p) {
  await p.click(enHoja('button[type="submit"]'));
  await p.waitForSelector(".ro-hoja-form .ro-form", { state: "detached", timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(400);
}
async function irA(p, hash) {
  await p.evaluate(h => { location.hash = h; }, hash);
  await p.waitForTimeout(500);
}
// Una foto de una prenda hecha en la página (una forma de un color sobre un fondo liso).
function elegirFoto(p, fondo, prenda) {
  return p.evaluate(([f, pr]) => new Promise(res => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
    const g = c.getContext("2d");
    g.fillStyle = f; g.fillRect(0, 0, 900, 1200);
    g.fillStyle = pr; g.beginPath();
    [[280, 220], [620, 220], [740, 400], [650, 450], [630, 1000], [270, 1000], [250, 450], [160, 400]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.fill();
    c.toBlob(b => {
      const dt = new DataTransfer();
      dt.items.add(new File([b], "prenda.jpg", { type: "image/jpeg" }));
      const inp = document.querySelector("[data-ro-fotos]");
      inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      res();
    }, "image/jpeg", 0.9);
  }), [fondo, prenda]);
}

// ---------- (1) Sin IA ----------
async function sinIA(browser, base) {
  console.log("\nEl corte, las mangas y los colores (390 px)");
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#ropa", ancho: 390 });
  await p.waitForTimeout(400);
  await sinFoto(p);

  // El corte: con el nombre que va con la prenda.
  ok(await visible(p, "[data-ro-corte-campo]") && /Corte \(cómo te queda\)/.test(await txt(p, enHoja("[data-ro-corte-campo] legend"))), "el formulario pregunta el corte («cómo te queda»)");
  ok(await opciones(p, "[data-ro-cortes]") === "Pegada, Regular, Suelta, Oversize", `arriba, sin tipo todavía: como una polera (${await opciones(p, "[data-ro-cortes]")})`);
  ok(await visible(p, "[data-ro-manga-campo]") && await opciones(p, "[data-ro-mangas]") === "Sin mangas, Manga corta, Manga larga", "y las mangas");
  await tocar(p, "tipo", "Top");
  ok(await opciones(p, "[data-ro-cortes]") === "Pegado, Regular, Suelto, Oversize", "un top: «Pegado», «Suelto»");
  await tocar(p, "grupo", "abajo");
  ok(await opciones(p, "[data-ro-cortes]") === "Pitillo, Pegado, Recto, Ancho, Acampanado", `abajo: los cortes de pantalón (${await opciones(p, "[data-ro-cortes]")})`);
  ok(!(await visible(p, "[data-ro-manga-campo]")), "abajo no pregunta las mangas");
  await tocar(p, "tipo", "Falda");
  ok(await opciones(p, "[data-ro-cortes]") === "Pitillo, Pegada, Recta, Ancha, Acampanada", "una falda: «Recta», «Acampanada»");
  await tocar(p, "corte", "recto");
  ok(await marcado(p, "corte") === "recto", "elegir «Recta»");
  await captura(p, "corte-abajo-390.png");
  await tocar(p, "grupo", "zapatos");
  ok(!(await visible(p, "[data-ro-corte-campo]")) && !(await visible(p, "[data-ro-manga-campo]")), "zapatos: sin corte ni mangas");
  await tocar(p, "grupo", "arriba");
  ok(await visible(p, "[data-ro-corte-campo]") && await marcado(p, "corte") === "", "de vuelta arriba: «recto» no es de arriba y se borra");
  await tocar(p, "tipo", "Polera");
  await tocar(p, "corte", "pegado");
  ok(await marcado(p, "corte") === "pegado", "una polera pegada");
  await tocar(p, "corte", "pegado");
  ok(await marcado(p, "corte") === "", "tocarlo otra vez lo quita (no se sabe o no importa)");
  await tocar(p, "corte", "pegado");
  await tocar(p, "manga", "corta");
  ok(await marcado(p, "corte") === "pegado" && await marcado(p, "manga") === "corta", "pegada y de manga corta");

  // Los colores: agregar, cambiar uno, el principal.
  ok(/Sin color todavía/.test(await txt(p, enHoja("[data-ro-colores]"))) && !(await p.$(enHoja(".ro-colores-nota"))), "sin color todavía (y sin la ayuda)");
  await p.click(enHoja("[data-ro-paleta]"));
  ok(await paleta(p) && await txt(p, enHoja("[data-ro-paleta-t]")) === "Elige un color" && !(await visible(p, "[data-ro-principal]")), "«Agregar color» abre la paleta");
  await p.click(enHoja('[data-ro-color="negro"]'));
  await p.click(enHoja("[data-ro-paleta]"));
  await p.click(enHoja('[data-ro-color="blanco"]'));
  ok(await chips(p) === "Negro (el principal) | Blanco" && !(await paleta(p)), `dos colores (${await chips(p)})`);
  ok(/Toca un color para cambiarlo/.test(await txt(p, enHoja(".ro-colores-nota"))), "dice que se puede tocar un color para cambiarlo");
  await p.click(enHoja('[data-ro-color-cambiar="1"]'));
  ok(await paleta(p) && await txt(p, enHoja("[data-ro-paleta-t]")) === "Elige el color nuevo en lugar de blanco", "tocar «Blanco»: «Elige el color nuevo en lugar de blanco»");
  ok(await visible(p, "[data-ro-principal]") && await p.$eval(enHoja('[data-ro-color-cambiar="1"]'), b => b.getAttribute("aria-expanded") === "true" && b.parentNode.classList.contains("is-cambiando")), "el que cambias se marca, con «Que sea el principal»");
  await captura(p, "corte-colores-390.png");
  await p.click(enHoja("[data-ro-principal]"));
  ok(await chips(p) === "Blanco (el principal) | Negro" && !(await paleta(p)), "«Que sea el principal»: el blanco pasa adelante");
  ok(await foco(p) === "0", "y el foco queda en ese color (no se pierde)");
  await p.click(enHoja('[data-ro-color-cambiar="1"]'));
  await p.click(enHoja('[data-ro-color="rojo"]'));
  ok(await chips(p) === "Blanco (el principal) | Rojo", "cambiar el negro por rojo: en el mismo lugar");
  await p.click(enHoja('[data-ro-color-cambiar="0"]'));
  ok(!(await visible(p, "[data-ro-principal]")), "el principal no ofrece «Que sea el principal»");
  await p.click(enHoja('[data-ro-color="rojo"]'));
  ok(await chips(p) === "Rojo", "cambiar el blanco por el rojo que ya estaba: queda uno solo, sin repetir");
  await p.click(enHoja('[data-ro-color-cambiar="0"]'));
  await p.click(enHoja('[data-ro-color-cambiar="0"]'));
  ok(!(await paleta(p)), "tocar otra vez el mismo color cierra la paleta");
  await p.click(enHoja("[data-ro-paleta]"));
  await p.click(enHoja('[data-ro-color="azul-marino"]'));
  ok(await chips(p) === "Rojo (el principal) | Azul marino", "y agregar otro");

  // Lo que escribes, con mayúscula al guardar.
  await p.fill(enHoja('[name="tela"]'), "algodón pima");
  await p.fill(enHoja('[name="marca"]'), "zara");
  await p.click(enHoja(".ro-mas summary"));
  await p.fill(enHoja('[name="talla"]'), "m");
  await p.fill(enHoja('[name="notas"]'), "regalo de mi mamá");
  await guardar(p);
  const [id, d] = await porTipo(p, "Polera");
  ok(d && d.corte === "pegado" && d.manga === "corta", "se guarda el corte y las mangas");
  ok(d && d.colores.map(c => c.id).join() === "rojo,azul-marino", "y los colores en su orden");
  ok(d && d.tela === "Algodón pima" && d.marca === "Zara" && d.talla === "M" && d.notas === "Regalo de mi mamá", `con mayúscula: ${d ? [d.tela, d.marca, d.talla, d.notas].join(" · ") : "—"}`);

  // La ficha.
  await irA(p, `ropa-prenda/${id}`);
  const datos = await txt(p, ".ro-datos");
  ok(/Corte Pegada/.test(datos) && /Mangas Manga corta/.test(datos), `la ficha: «Corte: Pegada» y «Mangas: Manga corta» (${datos.slice(0, 60)}…)`);
  ok(/Tela Algodón pima/.test(datos) && /Marca Zara/.test(datos) && /Talla M/.test(datos) && /Notas Regalo de mi mamá/.test(datos), "y lo escrito, con mayúscula");
  ok(await p.isVisible(".ro-cambiar-colores") && /Cambiar los colores/.test(await txt(p, ".ro-cambiar-colores")), "«Cambiar los colores» en la ficha");
  const alto = await p.$eval(".ro-cambiar-colores", b => b.getBoundingClientRect().height);
  ok(alto >= 44, `se toca bien con el dedo (${Math.round(alto)} px)`);
  await captura(p, "corte-ficha-390.png");
  await p.click(".ro-cambiar-colores");
  await esperarFormulario(p);
  await p.waitForTimeout(400);
  ok(await paleta(p) && await txt(p, enHoja("[data-ro-paleta-t]")) === "Elige el color nuevo en lugar de rojo", "abre el formulario con la paleta lista para cambiar el principal");
  ok(await foco(p) === "0" && await p.$eval(enHoja('[data-ro-color-cambiar="0"]'), b => b.parentNode.classList.contains("is-cambiando")), "con el foco en el color que cambias");
  const enVista = await p.$eval(enHoja("[data-ro-colores]"), el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  ok(enVista, "los colores quedan a la vista");
  await p.click(enHoja('[data-ro-color="verde-oliva"]'));
  ok(await chips(p) === "Verde oliva (el principal) | Azul marino", "el rojo pasa a verde oliva");
  ok(await marcado(p, "corte") === "pegado" && await marcado(p, "manga") === "corta", "el corte y las mangas siguen ahí al editar");
  await guardar(p);
  const d2 = (await docs(p))[id];
  ok(d2.colores.map(c => c.id).join() === "verde-oliva,azul-marino" && d2.corte === "pegado" && d2.tela === "Algodón pima", "guardado: los colores nuevos, lo demás igual");
  ok(/Polera verde oliva/.test(await txt(p, ".ro-ficha-t")), "la ficha ya dice «Polera verde oliva»");

  // Buscar por el corte.
  await irA(p, "ropa");
  for (const [q, si] of [["pegada", true], ["pegado", true], ["manga corta", true], ["suelta", false]]) {
    await p.fill("#ro-q", q);
    await p.waitForTimeout(350);
    ok(/Polera verde oliva/.test(await txt(p, "#ro-lista")) === si, `buscar «${q}»: ${si ? "la encuentra" : "no es esa"}`);
  }
  await p.fill("#ro-q", "");
  sinErrores(p);
  await p.context().close();
}

// ---------- (2) La IA llena el corte y las mangas ----------
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const CHOMPA = { esPrenda: true, varias: false, grupo: "arriba", tipo: "Chompa", colores: ["gris"], estampado: "liso", tela: "lana", corte: "oversize", manga: "larga", estilo: ["casual"], clima: ["frio"], formalidad: 2, marca: "" };
async function conIA(browser, base) {
  console.log("\nLa IA llena el corte y las mangas");
  const pedidos = [];
  const rutas = async ctx => {
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      pedidos.push(ruta);
      const json = c => route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      const gasto = { mes: "2026-11", usd: 0.03, veces: 1, tope: 8 };
      if (ruta === "/quien") return json({ permitido: true, uid: "test", lista: true, version: 4, gasto });
      if (ruta === "/describir") { await new Promise(r => setTimeout(r, 300)); return json({ prenda: CHOMPA, gasto }); }
      return route.fulfill({ status: 404, headers: CORS, body: "{}" });
    });
  };
  const p = await abrir(browser, base, { __SEED__: {}, "manolo.puente": PUENTE }, { hash: "#ropa", ancho: 390, rutas });
  await p.waitForTimeout(600);
  await abrirMas(p);
  await elegirFoto(p, "#f3f3f0", "#8a8a8a");
  await p.waitForSelector(enHoja(".ro-ia-aviso"), { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(250);
  ok(pedidos.includes("/describir") && await p.isVisible(enHoja(".ro-ia-aviso")), "la IA miró la foto («Lo llenó la IA»)");
  ok(await marcado(p, "corte") === "oversize" && await marcado(p, "manga") === "larga", "y marcó el corte (oversize) y las mangas (larga)");
  ok(await opciones(p, "[data-ro-cortes]") === "Pegada, Regular, Suelta, Oversize", "con el nombre de una chompa");
  ok(await p.inputValue(enHoja('[name="tela"]')) === "Lana", "la tela que dijo la IA, con mayúscula");
  await captura(p, "corte-ia-390.png");
  await guardar(p);
  const [, d] = await porTipo(p, "Chompa");
  ok(d && d.corte === "oversize" && d.manga === "larga" && d.tela === "Lana", "guardada con el corte y las mangas de la IA");
  sinErrores(p);
  await p.context().close();
}

// ---------- (3) Lo de antes sigue igual ----------
async function deAntes(browser, base) {
  console.log("\nLo de antes, sin corte ni mangas");
  const seed = { [COL]: { vieja: { v: 1, grupo: "arriba", tipo: "Camisa", colores: [{ id: "celeste" }], tela: "lino", marca: "", estado: "activa", creado: 1, fotos: [], estilo: ["casual"], clima: [] } } };
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-prenda/vieja", ancho: 390 });
  await p.waitForSelector(".ro-ficha-t", { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(300);
  const datos = await txt(p, ".ro-datos");
  ok(/Tela Lino/.test(datos) && !/Corte|Mangas/.test(datos), `la ficha de una prenda de antes: sin corte ni mangas, la tela con mayúscula (${datos})`);
  await p.click('[data-rop="editar"]');
  await esperarFormulario(p);
  ok(await marcado(p, "corte") === "" && await marcado(p, "manga") === "" && await opciones(p, "[data-ro-cortes]") === "Pegada, Regular, Suelta, Oversize", "al editarla, el corte está para elegir (nada marcado)");
  await guardar(p);
  const d = (await docs(p)).vieja;
  ok(d.corte === "" && d.manga === "" && d.tela === "Lino" && d.colores[0].id === "celeste" && d.estilo.join() === "casual", "guardarla sin tocar nada no cambia lo demás");
  sinErrores(p);
  await p.context().close();
}

// ---------- (4) A 320 px, en oscuro y en claro ----------
async function chico(browser, base, esquema) {
  console.log(`\nA 320 px, en ${esquema === "light" ? "claro" : "oscuro"}`);
  const seed = { [COL]: { s1: { v: 1, grupo: "abajo", tipo: "Leggings", colores: [{ id: "negro" }, { id: "gris" }, { id: "blanco" }], corte: "pitillo", estado: "activa", creado: 1, fotos: [], estilo: [], clima: [] } } };
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa-prenda/s1", ancho: 320, esquema });
  await p.waitForSelector(".ro-ficha-t", { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(300);
  ok(/Corte Pitillo/.test(await txt(p, ".ro-datos")), "«Corte: Pitillo» en unos leggings");
  ok(await sobra(p) <= 0, "la ficha: nada se sale a lo ancho");
  await p.click(".ro-cambiar-colores");
  await esperarFormulario(p);
  await p.waitForTimeout(400);
  await p.click(enHoja('[data-ro-color-cambiar="2"]'));
  await p.waitForTimeout(300);
  ok(await opciones(p, "[data-ro-cortes]") === "Pitillo, Pegados, Rectos, Anchos, Acampanados", "unos leggings: «Pegados», «Rectos»");
  ok(await sobra(p) <= 0, "el formulario con la paleta abierta: nada se sale a lo ancho");
  const chicos = await p.$$eval(enHoja(".ro-color-cambiar, .ro-quitar, [data-ro-principal], .ro-color-op, [data-ro-cortes] .ro-op-chip span"),
    els => els.filter(e => e.getClientRects().length).filter(e => e.getBoundingClientRect().height < 40).map(e => e.className || e.textContent));
  ok(!chicos.length, `todo se toca bien con el dedo${chicos.length ? `: ${chicos.slice(0, 3).join(", ")}` : ""}`);
  const malos = await p.evaluate(auditarContraste);
  ok(!malos.length, `todo se lee bien${malos.length ? `: ${malos.slice(0, 2).map(m => `«${m.texto}» ${m.k}`).join(" · ")}` : ""}`);
  await captura(p, `corte-paleta-320-${esquema === "light" ? "claro" : "oscuro"}.png`);
  sinErrores(p);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await sinIA(browser, base);
  await conIA(browser, base);
  await deAntes(browser, base);
  for (const esquema of ["dark", "light"]) await chico(browser, base, esquema);
  await terminar(browser, srv);
})();
