// Pruebas de pantalla de Ropa (D-145, D-146; docs/ROPA.md).
// Fase 1 (el ropero sin IA): la tarjeta de Inicio, vacío, agregar varias
// fotos seguidas con el color sacado de cada foto, guardar y seguir, sin
// foto y "Otro", errores, la grilla, grupos, filtros, buscar, ordenar, la
// ficha (me la puse hoy, para lavar, editar con precio y costo por uso, ya
// no la tengo y volver, borrar con Deshacer), las fotos en el teléfono y la
// copia de seguridad (bajar y restaurar en un "teléfono nuevo"); 390 y 320
// px y la compu.
// Uso: node scripts/e2e/ropa.js [carpeta-para-capturas]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-22T09:00:00-04:00";   // domingo
const HOY = "2026-11-22";
const COL = "users/test/ropa";
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const docs = p => p.evaluate(c => Object.fromEntries(window.__fakeStore.colMap(c)), COL);
const porTipo = async (p, tipo) => Object.entries(await docs(p)).find(([, d]) => d.tipo === tipo) || [null, null];
const fotosIDB = p => p.evaluate(() => window.RopaDatos.Fotos.todas().then(rs => rs.map(r => ({ id: r.id, grupoId: r.grupoId, clase: r.clase, ancho: r.ancho, alto: r.alto, tipo: r.blob.type, tam: r.blob.size, media: r.media ? r.media.size : 0 }))));
const enHoja = s => `.ro-hoja-form ${s}`;
const marcar = (p, nombre, valor) => p.click(enHoja(`input[name="${nombre}"][value="${valor}"]`), { force: true });

// Fotos de prendas hechas en la página (una prenda de un color sobre un fondo liso).
function elegirFotos(p, pares) {
  return p.evaluate(ps => new Promise(res => {
    const hacer = ([fondo, prenda]) => new Promise(r => {
      const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
      const g = c.getContext("2d");
      g.fillStyle = fondo; g.fillRect(0, 0, 900, 1200);
      g.fillStyle = prenda; g.beginPath();
      [[280, 220], [620, 220], [740, 400], [650, 450], [630, 1000], [270, 1000], [250, 450], [160, 400]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath(); g.fill();
      c.toBlob(b => r(new File([b], "prenda.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
    });
    Promise.all(ps.map(hacer)).then(files => {
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      const inp = document.querySelector("[data-ro-fotos]");
      inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      res();
    });
  }), pares);
}
async function abrirMas(p) {
  await p.click('#ro-app [data-ro="agregar"] >> nth=0');
  await p.waitForSelector(".ro-hoja-mas:not([hidden]) [data-ro-fotos]", { state: "attached", timeout: 4000 });
  await p.waitForTimeout(250);
}
async function esperarFormulario(p) {
  await p.waitForSelector(enHoja(".ro-form"), { timeout: 8000 });
  await p.waitForTimeout(150);
}

async function fase1(browser, base, ancho) {
  console.log(`\nRopa, fase 1: el ropero (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(400);
  ok(/Ropa Tu ropero con fotos, outfits e inspiración\./.test(await txt(p, 'a.card[href="#ropa"]')), "la tarjeta de Ropa en Inicio");
  await p.click('a.card[href="#ropa"]');
  await p.waitForTimeout(400);
  ok(await p.isVisible("#panel-ropa") && /Tu ropero está vacío/.test(await txt(p, "#ro-lista")), "vacío: invita a agregar");
  ok(await p.isVisible(".ro-fab"), "el botón + para agregar");
  ok(!(await p.isVisible("#verse-banner")), "sin el versículo arriba");

  // Dos fotos de una vez: polera roja sobre la cama blanca y un jean azul marino sobre el piso beige.
  await abrirMas(p);
  ok(/Sacar o elegir fotos/.test(await txt(p, ".ro-hoja-mas")) && /Sin foto/.test(await txt(p, ".ro-hoja-mas")), "el +: fotos (varias a la vez) o sin foto");
  await captura(p, `ropa-mas-${ancho}.png`);
  await elegirFotos(p, [["#f3f3f0", "#c43a31"], ["#d9c6a5", "#1e2a44"]]);
  await esperarFormulario(p);
  ok(/Prenda 1 de 2/.test(await txt(p, ".ro-hoja-form h3")), "una prenda por foto: «Prenda 1 de 2»");
  ok(/Rojo/.test(await txt(p, enHoja("[data-ro-colores]"))) && /Lo saqué de la foto/.test(await txt(p, enHoja(".ro-form"))), "el color sale solo de la foto (rojo)");
  ok(!(await p.isVisible(enHoja("[data-ro-paleta-lista]"))), "la paleta de colores está cerrada");
  await captura(p, `ropa-form-${ancho}.png`);
  // Sin elegir qué es: avisa.
  await p.click(enHoja('button[type="submit"]'));
  await p.waitForTimeout(250);
  ok(/Elige qué prenda es/.test(await txt(p, enHoja('[data-err="tipo"]'))), "sin decir qué es: avisa");
  await marcar(p, "tipo", "Polera");
  await marcar(p, "clima", "calor");
  await marcar(p, "clima", "templado");
  await marcar(p, "estilo", "casual");
  await marcar(p, "formalidad", "2");
  ok(/Informal/.test(await txt(p, enHoja("[data-ro-formal-t]"))), "qué tan formal: dice «Informal» al elegir 2");
  await p.fill(enHoja('input[name="marca"]'), "Basement");
  await p.fill(enHoja('input[name="tela"]'), "Algodón");
  ok(/Guardar y seguir/.test(await txt(p, enHoja('button[type="submit"]'))), "«Guardar y seguir» mientras quedan fotos");
  await p.click(enHoja('button[type="submit"]'));
  await p.waitForFunction(() => /Prenda 2 de 2/.test((document.querySelector(".ro-hoja-form h3") || {}).textContent || ""), null, { timeout: 8000 });
  await esperarFormulario(p);
  ok(/Azul marino/.test(await txt(p, enHoja("[data-ro-colores]"))), "la segunda foto: azul marino (el fondo beige no cuenta)");
  await marcar(p, "grupo", "abajo");
  await p.waitForTimeout(150);
  ok(/Jean/.test(await txt(p, enHoja("[data-ro-tipos]"))) && !/Polera/.test(await txt(p, enHoja("[data-ro-tipos]"))), "al cambiar el grupo cambian los tipos");
  await marcar(p, "tipo", "Jean");
  await marcar(p, "clima", "frio");
  // Un segundo color a mano.
  await p.click(enHoja("[data-ro-paleta]"));
  await p.waitForTimeout(100);
  ok(await p.isVisible(enHoja("[data-ro-paleta-lista]")), "«Agregar color» abre la paleta");
  await p.click(enHoja('[data-ro-color="blanco"]'));
  await p.waitForTimeout(100);
  ok(/Azul marino .*Blanco/.test(await txt(p, enHoja("[data-ro-colores]"))), "se agrega un color a mano");
  await p.click(enHoja('[data-ro-quitar="blanco"]'));
  await p.waitForTimeout(100);
  ok(!/Blanco/.test(await txt(p, enHoja("[data-ro-colores]"))), "y se quita");
  await p.click(enHoja('button[type="submit"]'));
  await p.waitForTimeout(900);
  ok(/2 prendas nuevas en tu ropero/.test(await txt(p, "#ro-toast")), "aviso: 2 prendas nuevas");
  let [idPolera, polera] = await porTipo(p, "Polera");
  const [idJean, jean] = await porTipo(p, "Jean");
  ok(polera && polera.grupo === "arriba" && polera.colores[0].id === "rojo" && polera.clima.join() === "templado,calor" && polera.estilo.join() === "casual" && polera.formalidad === 2 && polera.marca === "Basement" && polera.tela === "Algodón" && polera.estado === "activa" && polera.v === 1, `la polera quedó bien guardada (${JSON.stringify(polera && { c: polera.colores, cl: polera.clima })})`);
  ok(jean && jean.grupo === "abajo" && jean.colores.map(c => c.id).join() === "azul-marino" && /^data:image\/jpeg;base64,/.test(jean.fotos[0].mini), "el jean, con su miniatura en la nube");
  const fotos = await fotosIDB(p);
  ok(fotos.length === 2 && fotos.every(f => f.clase === "prenda" && f.tipo === "image/jpeg" && Math.max(f.ancho, f.alto) <= 1200) && fotos.some(f => f.grupoId === idPolera) && fotos.some(f => f.grupoId === idJean), `las fotos grandes quedan en el teléfono, cada una con su prenda (${JSON.stringify(fotos.map(f => [f.grupoId === idPolera, f.ancho, f.alto]))})`);
  ok(fotos.every(f => f.media > 0 && f.media < f.tam), "y una mediana para la grilla (más liviana)");
  ok(/Jean azul marino/.test(await txt(p, "#ro-lista")) && /Polera roja/.test(await txt(p, "#ro-lista")), "la grilla con sus nombres (el color concuerda)");
  await p.waitForFunction(() => [...document.querySelectorAll("#ro-lista .ro-foto img")].every(i => /^blob:/.test(i.src)), null, { timeout: 4000 }).catch(() => {});
  ok(await p.$$eval("#ro-lista .ro-foto img", is => is.length === 2 && is.every(i => /^blob:/.test(i.src) && i.naturalWidth <= 480 && i.naturalWidth > 200)), "la grilla muestra la mediana (no la grande)");
  ok(/^2 prendas$/.test(await txt(p, "#ro-resumen")), "cuántas prendas tienes");
  await captura(p, `ropa-grilla-${ancho}.png`);

  // Sin foto y "Otro".
  await abrirMas(p);
  await p.click(".ro-hoja-mas [data-ro-sinfoto]");
  await esperarFormulario(p);
  ok(/Nueva prenda/.test(await txt(p, ".ro-hoja-form h3")) && !(await p.$(enHoja(".ro-form-foto"))), "sin foto: el formulario sin foto");
  await marcar(p, "grupo", "abajo");
  await marcar(p, "tipo", "__otro");
  await p.fill(enHoja('input[name="tipoOtro"]'), "Pantalón cargo");
  await p.click(enHoja('[data-ro-paleta]'));
  await p.click(enHoja('[data-ro-color="verde-oliva"]'));
  await p.click(enHoja('button[type="submit"]'));
  await p.waitForTimeout(700);
  const [idCargo, cargo] = await porTipo(p, "Pantalón cargo");
  ok(cargo && cargo.grupo === "abajo" && cargo.colores[0].id === "verde-oliva", "«Otro»: Pantalón cargo verde oliva");
  ok(/Pantalón cargo verde oliva/.test(await txt(p, "#ro-lista")), "aparece en la grilla");

  // Grupos, filtros, buscar y ordenar.
  await p.click('[data-ro-grupo="abajo"]');
  await p.waitForTimeout(150);
  ok((await p.$$("#ro-lista .ro-card")).length === 2 && !/Polera/.test(await txt(p, "#ro-lista")), "el grupo Abajo: 2 prendas");
  await p.click('[data-ro-chip="color"]');
  await p.waitForTimeout(300);
  ok(/Todos los colores/.test(await txt(p, ".ro-hoja-filtro")) && /Azul marino/.test(await txt(p, ".ro-hoja-filtro")), "el filtro de color muestra los colores que tienes");
  await p.click('.ro-hoja-filtro [data-ro-valor="azul-marino"]');
  await p.waitForTimeout(300);
  ok((await p.$$("#ro-lista .ro-card")).length === 1 && /Jean/.test(await txt(p, "#ro-lista")), "Abajo y azul marino: el jean");
  await p.click('#ro-chips [data-ro="limpiar"]');
  await p.waitForTimeout(150);
  ok((await p.$$("#ro-lista .ro-card")).length === 3, "«Quitar filtros» vuelve a todo");
  await p.fill("#ro-q", "polera");
  await p.waitForTimeout(300);
  ok((await p.$$("#ro-lista .ro-card")).length === 1, "buscar «polera»");
  await p.fill("#ro-q", "basement");
  await p.waitForTimeout(300);
  ok(/Polera roja/.test(await txt(p, "#ro-lista")), "buscar por marca");
  await p.fill("#ro-q", "zzz");
  await p.waitForTimeout(300);
  ok(/No encontré nada con eso/.test(await txt(p, "#ro-lista")), "nada con eso: lo dice");
  await p.fill("#ro-q", "");
  await p.waitForTimeout(300);
  await p.click('[data-ro-chip="orden"]');
  await p.waitForTimeout(300);
  await p.click('.ro-hoja-filtro [data-ro-valor="nombre"]');
  await p.waitForTimeout(300);
  const titulos = await p.$$eval("#ro-lista .ro-card-t", els => els.map(e => e.textContent));
  ok(titulos.join("|") === "Jean azul marino|Pantalón cargo verde oliva|Polera roja", `ordenar por nombre (${titulos.join(", ")})`);
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");

  // La ficha.
  await p.click(`a[href="#ropa-prenda/${idPolera}"]`);
  await p.waitForTimeout(500);
  ok(/Polera roja/.test(await txt(p, "#rop-app h1")) && /Arriba · Polera/.test(await txt(p, ".ro-ficha-sub")), "la ficha: nombre y grupo");
  ok(/Rojo/.test(await txt(p, ".ro-infos")) && /Casual/.test(await txt(p, ".ro-infos")) && /Formal: 2 de 5 · Informal/.test(await txt(p, ".ro-infos")), "colores, estilo y qué tan formal");
  ok(/Todavía no te la pusiste/.test(await txt(p, ".ro-uso")) && /Algodón/.test(await txt(p, ".ro-datos")) && /Basement/.test(await txt(p, ".ro-datos")), "cuánto la usas y sus datos");
  await p.click('[data-rop="puse"]');
  await p.waitForTimeout(400);
  const usos = await p.evaluate(() => Object.fromEntries(window.__fakeStore.colMap("users/test/ropa_usos")));
  ok(usos[HOY] && usos[HOY].prendas.includes(idPolera), "«Me la puse hoy» lo anota en el día");
  ok(/Te la pusiste hoy/.test(await txt(p, '[data-rop="puse"]')) && /Te la pusiste 1 vez/.test(await txt(p, ".ro-uso")) && /domingo 22 de noviembre/.test(await txt(p, ".ro-uso")), "y cuenta la vez");
  await captura(p, `ropa-ficha-${ancho}.png`);
  // Para lavar.
  await p.click('[data-rop="lavar"]');
  await p.waitForTimeout(400);
  ok((await docs(p))[idPolera].estado === "lavar" && /Para lavar/.test(await txt(p, ".ro-ficha-sub")) && /Ya está limpia/.test(await txt(p, '[data-rop="lavar"]')), "«Para lavar»");
  // Editar: precio → costo por uso.
  await p.click('[data-rop="editar"]');
  await esperarFormulario(p);
  ok(/Editar prenda/.test(await txt(p, ".ro-hoja-form h3")) && (await p.$eval(enHoja('input[name="marca"]'), el => el.value)) === "Basement", "editar: el formulario con lo que tenía");
  await p.click(enHoja(".ro-mas summary"));
  await p.fill(enHoja('input[name="precio"]'), "120");
  await p.fill(enHoja('input[name="compra"]'), "2026-10-05");
  await p.click(enHoja('button[type="submit"]'));
  await p.waitForTimeout(600);
  polera = (await docs(p))[idPolera];
  ok(polera.precio === 120 && polera.compra === "2026-10-05" && polera.estado === "lavar" && polera.creado > 0 && polera.editado > 0, "editar guarda el precio y la fecha (sin perder lo demás)");
  ok(/Bs 120/.test(await txt(p, ".ro-datos")) && /Te sale a Bs 120 cada vez/.test(await txt(p, ".ro-uso")), "el precio y el costo por uso");
  // En el ropero: la etiqueta y el filtro «Para lavar».
  await p.click("#panel-ropa-prenda .back-link");
  await p.waitForTimeout(400);
  ok(/Para lavar/.test(await txt(p, `a[href="#ropa-prenda/${idPolera}"]`)) && /3 prendas · 1 para lavar/.test(await txt(p, "#ro-resumen")), "en el ropero: «Para lavar» y la cuenta");
  await p.click('#ro-chips [data-ro="lavar"]');
  await p.waitForTimeout(200);
  ok((await p.$$("#ro-lista .ro-card")).length === 1, "el filtro «Para lavar»");
  await p.click('#ro-chips [data-ro="limpiar"]');
  await p.waitForTimeout(200);
  // Ya no la tengo (con Deshacer) y volver a tenerla.
  await p.click(`a[href="#ropa-prenda/${idJean}"]`);
  await p.waitForTimeout(400);
  await p.click('[data-rop="fuera"]');
  await p.waitForTimeout(300);
  ok((await docs(p))[idJean].estado === "fuera" && (await docs(p))[idJean].fueraFecha === HOY, "«Ya no la tengo»");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(300);
  ok((await docs(p))[idJean].estado === "activa", "Deshacer la devuelve");
  await p.click('[data-rop="fuera"]');
  await p.waitForTimeout(300);
  await p.click("#panel-ropa-prenda .back-link");
  await p.waitForTimeout(400);
  ok(!/Jean/.test(await txt(p, "#ro-lista")) && /Ya no las tengo \(1\)/.test(await txt(p, "#ro-pie")), "sale del ropero y queda en «Ya no las tengo»");
  await p.click('#ro-pie [data-ro="fuera"]');
  await p.waitForTimeout(250);
  ok(/Las que ya no tienes/.test(await txt(p, "#ro-lista")) && /Jean azul marino/.test(await txt(p, "#ro-lista")), "la lista de las que ya no tienes");
  await p.click(`a[href="#ropa-prenda/${idJean}"]`);
  await p.waitForTimeout(400);
  await p.click('[data-rop="volver"]');
  await p.waitForTimeout(300);
  ok((await docs(p))[idJean].estado === "activa" && !(await docs(p))[idJean].fueraFecha, "«La volví a tener»");
  // Borrar con Deshacer.
  await p.evaluate(id => { location.hash = `ropa-prenda/${id}`; }, idCargo);
  await p.waitForTimeout(400);
  await p.click('[data-rop="borrar"]');
  await p.waitForTimeout(300);
  ok(!(await docs(p))[idCargo] && /#ropa$/.test(p.url()), "borrar: sale de la nube y vuelve al ropero");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok((await docs(p))[idCargo] && (await docs(p))[idCargo].tipo === "Pantalón cargo", "Deshacer la trae de vuelta");
  // Inicio dice cuántas.
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  ok(/3 prendas en tu ropero · 1 para lavar\./.test(await txt(p, "#ropa-inicio")), "Inicio: cuántas prendas y para lavar");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// La copia de seguridad lleva la ropa y sus fotos; en un "teléfono nuevo" se restauran.
async function copia(browser, base) {
  console.log("\nRopa en la copia de seguridad");
  let p = await abrir(browser, base, { __SEED__: {} }, { hash: "#ropa", zona: ZONA, fecha: FECHA, ancho: 390 });
  await p.waitForTimeout(400);
  await abrirMas(p);
  await elegirFotos(p, [["#f3f3f0", "#151515"]]);
  await esperarFormulario(p);
  await marcar(p, "grupo", "abrigos");
  await marcar(p, "tipo", "Chamarra");
  await p.click(enHoja('button[type="submit"]'));
  await p.waitForTimeout(800);
  const [id, doc] = await porTipo(p, "Chamarra");
  ok(doc && doc.colores[0].id === "negro", "una chamarra negra");
  await p.evaluate(() => { location.hash = "inicio"; });
  await p.waitForTimeout(300);
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
  await p.click('[data-rsp="preparar"]');
  await p.waitForSelector('[data-rsp="guardar"]', { timeout: 8000 });
  ok(/y 1 foto/.test(await txt(p, ".rsp-hoja .rsp-ok")), "la copia cuenta la foto de la prenda");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-rsp="guardar"]')]);
  const archivo = path.join(os.tmpdir(), `ropa-copia-${process.pid}.json`);
  await dl.saveAs(archivo);
  const c = JSON.parse(fs.readFileSync(archivo, "utf8"));
  ok(c.colecciones.ropa[id] && c.colecciones.ropa[id].tipo === "Chamarra" && c.fotosRopa.length === 1 && c.fotosRopa[0].grupoId === id && /^data:image\/jpeg;base64,/.test(c.fotosRopa[0].datos), "la copia lleva la prenda y su foto completa");
  await p.context().close();
  // Teléfono nuevo: sin la prenda ni la foto.
  p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho: 390 });
  await p.waitForTimeout(400);
  ok((await fotosIDB(p)).length === 0, "el teléfono nuevo no tiene fotos de Ropa");
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
  await p.setInputFiles(".rsp-hoja .rsp-input", archivo);
  await p.waitForTimeout(900);
  const plan = await txt(p, ".rsp-hoja .lib-hoja-cuerpo");
  ok(/Prendas de Ropa \+1/.test(plan) && /Fotos de Ropa \+1/.test(plan), `el plan muestra la prenda y su foto (${plan.slice(0, 160)})`);
  await p.click('[data-rsp="confirmar"]');
  await p.waitForSelector('#rsp-t-listo', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(400);
  const fotos = await fotosIDB(p);
  ok((await docs(p))[id] && fotos.length === 1 && fotos[0].grupoId === id && fotos[0].clase === "prenda", "restaurar trae la prenda y su foto al teléfono");
  // La mediana no viene en la copia: se hace sola al ver el ropero.
  await p.evaluate(() => { location.hash = "ropa"; });
  await p.waitForFunction(() => { const i = document.querySelector("#ro-lista .ro-foto img"); return i && /^blob:/.test(i.src); }, null, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);
  const fotos2 = await fotosIDB(p);
  ok(fotos2[0].media > 0 && await p.$eval("#ro-lista .ro-foto img", i => i.naturalWidth <= 480 && i.naturalWidth > 200), "la mediana de una foto restaurada se hace sola");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  fs.unlinkSync(archivo);
  await p.context().close();
}

async function compu(browser, base) {
  console.log("\nRopa en la compu (1280 px)");
  const seed = { [COL]: {} };
  const tipos = [["arriba", "Camisa", "blanco"], ["arriba", "Polera", "negro"], ["abajo", "Jean", "azul-jean"], ["zapatos", "Zapatillas", "blanco"], ["abrigos", "Saco", "azul-marino"], ["accesorios", "Cinturón", "cafe"]];
  tipos.forEach(([grupo, tipo, color], k) => { seed[COL][`s${k}`] = { v: 1, grupo, tipo, colores: [{ id: color }], estado: "activa", creado: k + 1, fotos: [] }; });
  const p = await abrir(browser, base, { __SEED__: seed }, { hash: "#ropa", zona: ZONA, fecha: FECHA, ancho: 1280, alto: 900 });
  await p.waitForTimeout(500);
  const cols = await p.$eval(".ro-grilla", el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  ok(cols >= 4, `la grilla usa el ancho (${cols} columnas)`);
  ok(/Saco azul marino/.test(await txt(p, "#ro-lista")) && /Cinturón café/.test(await txt(p, "#ro-lista")), "las prendas sin foto, con su nombre");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  await captura(p, "ropa-grilla-1280.png");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [390, 320]) await fase1(browser, base, ancho);
  await copia(browser, base);
  await compu(browser, base);
  await terminar(browser, srv);
})();
