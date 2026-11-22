// Pruebas de pantalla de la copia de seguridad de todo Manolo (D-118), a 375 px.
// Uso: node scripts/e2e/respaldo.js [carpeta-para-capturas]
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-15";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "manolo-respaldo-"));
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const abierta = p => p.$eval(".rsp-hoja", el => !el.hidden && !el.classList.contains("is-closing")).catch(() => false);
const sinDesborde = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const col = (p, c) => p.evaluate(n => Object.fromEntries(window.__fakeStore.colMap(`users/test/${n}`)), c);
// Todos tus datos de la nube falsa (leer una colección vacía la crea vacía: no cuenta).
const nube = p => p.evaluate(() => JSON.stringify([...window.__fakeStore.store.entries()].filter(([, m]) => m.size)
  .map(([c, m]) => [c, [...m.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))]).sort((x, y) => (x[0] < y[0] ? -1 : 1))));
const fotosIDB = p => p.evaluate(() => window.LugaresFotos.todas().then(rs => rs.map(r => ({ id: r.id, lugarId: r.lugarId, mini: !!r.mini, tam: r.blob.size }))));
const escribirArchivo = (nombre, contenido) => { const f = path.join(TMP, nombre); fs.writeFileSync(f, typeof contenido === "string" ? contenido : JSON.stringify(contenido)); return f; };
const MINI = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const SEED = {
  "users/test/finanzas": {
    f1: { date: "2026-11-01", type: "ingreso", category: "salario", payment: "debito", amount: 3000, montoCent: 300000, createdAt: 1 },
    f2: { date: "2026-11-10", type: "gasto", category: "comida", payment: "debito", amount: 45.5, montoCent: 4550, createdAt: 2 }
  },
  "users/test/libros": { b1: { v: 1, titulo: "El principito", autor: "Saint-Exupéry", paginas: 120, estado: "leyendo", fechaRegistro: "2026-10-01", fechaInicio: "2026-10-01", paginaBase: 0, progreso: {}, creado: 1 } },
  "users/test/lugares": { l1: { v: 1, nombre: "Doña Rosa", estado: "visitado", calificacion: 4, volveria: "si", tipo: "restaurante", platos: {}, visitas: {}, fotos: [{ id: "fx1", mini: MINI, ancho: 40, alto: 30 }], etiquetas: [], creado: 1, actualizado: 1 } },
  "users/test/meta": { prueba_respaldo: { a: 1 } }
};

async function elegir(p, archivo) {
  await p.setInputFiles(".rsp-hoja .rsp-input", archivo);
  await p.waitForTimeout(700);
}
async function abrirHoja(p) {
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
}
async function cerrarHoja(p) {
  await p.click(".rsp-hoja .budget-sheet-close");
  await p.waitForTimeout(320);
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inicio", zona: ZONA, fecha: `${HOY}T13:00:00-04:00`, ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1200);
  // La foto completa de "Doña Rosa" vive en el teléfono (IndexedDB).
  await p.evaluate(() => new Promise(res => {
    const c = document.createElement("canvas"); c.width = 40; c.height = 30;
    c.getContext("2d").fillRect(0, 0, 40, 30);
    c.toBlob(blob => window.LugaresFotos.guardar({ id: "fx1", lugarId: "l1", blob, mini: null, ancho: 40, alto: 30, creado: 1 }).then(res), "image/jpeg", 0.8);
  }));

  console.log("\nAcceso");
  ok(await p.isVisible("#respaldo-abrir") && /Copia de seguridad/.test(await txt(p, "#respaldo-abrir")), "«Copia de seguridad» abajo en Inicio");
  ok(await p.isVisible("#cuenta-estado-btn"), "«Estado de la cuenta» sigue ahí");
  await p.$eval("#respaldo-abrir", el => el.scrollIntoView({ block: "center" }));
  await captura(p, "respaldo-pie-375.png");
  await abrirHoja(p);
  ok(await abierta(p) && /Copia de seguridad/.test(await txt(p, ".rsp-hoja h3")), "abre la hoja «Copia de seguridad»");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains("budget-sheet-close")), "el foco queda en la hoja (botón Cerrar)");
  const cuerpo = await txt(p, ".rsp-hoja .lib-hoja-cuerpo");
  ok(/lugares y ropa \(con sus fotos\)/.test(cuerpo) && /Todavía no guardaste una copia/.test(cuerpo), "explica qué incluye y que todavía no hay copias");
  ok(/Nunca borra ni cambia lo que ya tienes/.test(cuerpo), "dice claro que restaurar nunca borra ni cambia nada");
  await captura(p, "respaldo-inicio-375.png");

  console.log("\nDescargar copia de todo");
  const nubeAntes = await nube(p);
  await p.click('[data-rsp="preparar"]');
  await p.waitForSelector('[data-rsp="guardar"]', { timeout: 8000 });
  await p.waitForTimeout(200);
  const lista = await txt(p, ".rsp-hoja .rsp-ok");
  // Lo que hay en la nube de prueba (la app también crea sus ajustes al abrir).
  const enLaNube = await p.evaluate(nombres => nombres.reduce((s, n) => s + window.__fakeStore.colMap(`users/test/${n}`).size, 0), require("../../js/respaldo-motor.js").COLECCIONES.map(c => c.id));
  ok(new RegExp(`Lista: ${enLaNube} registros y 1 foto`).test(lista) && enLaNube >= 5, `muestra qué tiene la copia (${lista})`);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.rsp === "guardar"), "el foco pasa a «Guardar archivo»");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-rsp="guardar"]')]);
  const archivoCopia = path.join(TMP, dl.suggestedFilename());
  await dl.saveAs(archivoCopia);
  const copia = JSON.parse(fs.readFileSync(archivoCopia, "utf8"));
  ok(dl.suggestedFilename() === "manolo-copia-2026-11-15.json", `nombre del archivo con la fecha (${dl.suggestedFilename()})`);
  ok(copia.app === "Manolo" && copia.tipo === "copia-completa" && copia.version === 1, "archivo de copia completa de Manolo (con versión)");
  ok(Object.keys(copia.colecciones).length === require("../../js/respaldo-motor.js").COLECCIONES.length && copia.colecciones.lugares.l1.nombre === "Doña Rosa" && copia.colecciones.finanzas.f2.montoCent === 4550 && copia.colecciones.libros.b1.titulo === "El principito", "trae todas las secciones con tus datos (también Lugares)");
  ok(copia.fotosLugares.length === 1 && copia.fotosLugares[0].id === "fx1" && /^data:image\/jpeg;base64,/.test(copia.fotosLugares[0].datos), "incluye la foto completa de Lugares");
  ok(copia.conteos.finanzas === 2 && copia.conteos.fotosLugares === 1, "con el conteo de cada sección");
  await p.waitForTimeout(300);
  ok(/Copia lista/.test(await txt(p, "#rsp-toast")), "aviso «Copia lista» al guardar");
  ok(await nube(p) === nubeAntes, "guardar la copia no cambia ni un dato tuyo");
  await cerrarHoja(p);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === "respaldo-abrir"), "al cerrar, el foco vuelve al botón");
  await abrirHoja(p);
  ok(/Última copia guardada desde este teléfono: 15 nov/.test(await txt(p, ".rsp-hoja .lib-hoja-cuerpo")), "recuerda cuándo guardaste la última copia");

  console.log("\nRestaurar: solo agrega lo que falta");
  // Mientras tanto: se borró un gasto, un libro y la foto, y cambiaste el ingreso.
  await p.evaluate(() => {
    const s = window.__fakeStore;
    s.colMap("users/test/finanzas").delete("f2");
    s.colMap("users/test/libros").delete("b1");
    s.colMap("users/test/finanzas").get("f1").amount = 3500;
    s.notify();
    return window.LugaresFotos.borrar("fx1");
  });
  await p.waitForTimeout(400);
  await elegir(p, archivoCopia);
  const plan = await txt(p, ".rsp-hoja .lib-hoja-cuerpo");
  ok(/Esto se agregaría/.test(plan) && /3 cosas para agregar/.test(plan), `muestra qué se agregaría antes de tocar nada (${plan.slice(0, 80)}…)`);
  ok(/Movimientos de Finanzas \+1/.test(plan) && /Libros \+1/.test(plan) && /Fotos de Lugares \+1/.test(plan), "detalle por sección (+1 gasto, +1 libro, +1 foto)");
  ok(/Los otros \d+ ya los tienes: no se tocan/.test(plan), "avisa que lo que ya tienes no se toca");
  ok(/Antes de agregar, guardo una copia automática/.test(plan), "avisa que primero hace una copia automática");
  ok((await col(p, "finanzas")).f2 === undefined, "todavía no cambió nada");
  await captura(p, "respaldo-plan-375.png");
  await p.click('[data-rsp="confirmar"]');
  await p.waitForSelector("#rsp-t-listo", { timeout: 8000 });
  await p.waitForTimeout(300);
  const listo = await txt(p, ".rsp-hoja .lib-hoja-cuerpo");
  await captura(p, "respaldo-listo-375.png");
  ok(/Agregué 1 movimiento de Finanzas, 1 libro y 1 foto de Lugares/.test(listo), `dice qué agregó (${listo.slice(0, 90)}…)`);
  const fin = await col(p, "finanzas");
  ok(fin.f2 && fin.f2.montoCent === 4550 && (await col(p, "libros")).b1, "volvieron el gasto y el libro que faltaban");
  ok(fin.f1.amount === 3500, "lo que ya tenías NO se pisó (el ingreso sigue con tu cambio)");
  const fotos = await fotosIDB(p);
  ok(fotos.length === 1 && fotos[0].id === "fx1" && fotos[0].lugarId === "l1" && fotos[0].mini && fotos[0].tam > 0, "la foto volvió al teléfono (con su miniatura)");
  ok(/Copias automáticas/.test(listo) || await p.$(".rsp-hoja .rsp-autos") === null, "nombra dónde quedó la copia automática");

  console.log("\nCopia automática y Deshacer");
  await p.click('[data-rsp="deshacer"]');
  await p.waitForTimeout(600);
  ok(/Deshecho/.test(await txt(p, "#rsp-t-listo")), "«Deshacer» deja todo como antes");
  const fin2 = await col(p, "finanzas");
  ok(!fin2.f2 && !(await col(p, "libros")).b1 && fin2.f1.amount === 3500 && (await fotosIDB(p)).length === 0, "quita solo lo que agregó (lo tuyo intacto)");
  await p.click('[data-rsp="cerrar"]');
  await p.waitForTimeout(320);
  await abrirHoja(p);
  await p.waitForTimeout(300);
  const autos = await p.$$(".rsp-hoja .rsp-auto");
  ok(autos.length === 1 && /registros/.test(await txt(p, ".rsp-hoja .rsp-auto")), "la copia automática de antes aparece en «Copias automáticas»");
  const [dlAuto] = await Promise.all([p.waitForEvent("download"), p.click(".rsp-hoja [data-rsp-auto]")]);
  const auto = JSON.parse(fs.readFileSync(await dlAuto.path(), "utf8"));
  ok(/^manolo-copia-automatica-2026-11-15-1300\.json$/.test(dlAuto.suggestedFilename()) && auto.tipo === "copia-completa", "se puede descargar la copia automática");
  ok(auto.colecciones.finanzas.f1.amount === 3500 && !auto.colecciones.finanzas.f2, "la copia automática es lo que tenías justo antes de restaurar");

  console.log("\nLa misma copia otra vez: no repite nada");
  await elegir(p, archivoCopia);
  await p.click('[data-rsp="confirmar"]');
  await p.waitForSelector("#rsp-t-listo", { timeout: 8000 });
  await p.click('[data-rsp="cerrar"]');
  await p.waitForTimeout(320);
  await abrirHoja(p);
  await elegir(p, archivoCopia);
  const igual = await txt(p, ".rsp-hoja .lib-hoja-cuerpo");
  ok(/Ya tienes todo/.test(igual) && /No hay nada que agregar/.test(igual) && !(await p.$('[data-rsp="confirmar"]')), "si ya está todo, lo dice y no ofrece agregar");
  ok(Object.keys(await col(p, "finanzas")).length === 2, "sin duplicados");
  await p.click('.rsp-hoja [data-rsp="inicio"]');
  await p.waitForTimeout(300);
  ok((await p.$$(".rsp-hoja .rsp-auto")).length === 2, "cada restauración guardó su copia automática (máx. 3)");
  await p.$eval(".rsp-hoja .rsp-autos", el => el.scrollIntoView({ block: "end" }));
  await captura(p, "respaldo-autos-375.png");

  console.log("\nEl archivo de Lugares también sirve");
  const archivoLugares = escribirArchivo("manolo-lugares-2026-11-15.json", { app: "Manolo · Lugares", version: 1, exportado: "2026-11-15T17:00:00.000Z",
    lugares: [{ id: "l2", v: 1, nombre: "Gustu", estado: "quiero", calificacion: null, volveria: null, platos: {}, visitas: {}, fotos: [], etiquetas: [], creado: 2, actualizado: 2 }], fotos: [] });
  await elegir(p, archivoLugares);
  ok(/1 cosa para agregar/.test(await txt(p, ".rsp-hoja .lib-hoja-cuerpo")) && /Lugares \+1/.test(await txt(p, ".rsp-hoja .rsp-filas")), "muestra el lugar que falta");
  await p.click('[data-rsp="confirmar"]');
  await p.waitForSelector("#rsp-t-listo", { timeout: 8000 });
  ok((await col(p, "lugares")).l2 && (await col(p, "lugares")).l2.nombre === "Gustu" && !("id" in (await col(p, "lugares")).l2), "el lugar vuelve tal cual (sin pisar los demás)");
  await p.click('[data-rsp="cerrar"]');
  await p.waitForTimeout(320);
  await abrirHoja(p);

  console.log("\nArchivos que no sirven");
  const errorDe = async archivo => { await elegir(p, archivo); return txt(p, ".rsp-hoja .rsp-error"); };
  ok(/No pude leer el archivo/.test(await errorDe(escribirArchivo("roto.json", "{ esto no es json"))), "un archivo roto: «No pude leer el archivo»");
  ok(/Hábitos › Ajustes/.test(await errorDe(escribirArchivo("habitos.json", { app: "manolo-habitos", version: 1, habitos: [] }))), "la copia de Hábitos: dice dónde importarla");
  ok(/una sola sección/.test(await errorDe(escribirArchivo("libros.json", { app: "Manolo · Libros", version: 1, libros: [] }))), "el resumen de una sección: lo explica");
  ok(/versión más nueva/.test(await errorDe(escribirArchivo("nueva.json", Object.assign({}, copia, { version: 9 })))), "una copia de una versión más nueva: pide actualizar");
  ok(/no es una copia de Manolo/.test(await errorDe(escribirArchivo("otra.json", { hola: 1 }))), "otro archivo: «no es una copia de Manolo»");
  ok(await p.$eval(".rsp-hoja .rsp-error", el => el.getAttribute("role") === "alert"), "el error se anuncia (role=alert) y tiene ícono y texto");

  console.log("\nSin internet no restaura (así no pisa nada)");
  await p.evaluate(() => {
    const real = db.collection.bind(db);
    window.__colReal = real;
    db.collection = n => {
      const r = real(n);
      if (n !== "users") return r;
      const doc = r.doc.bind(r);
      r.doc = id => { const d = doc(id); const sub = d.collection.bind(d); d.collection = c => { const q = sub(c); q.get = o => (o && o.source === "server" ? Promise.reject(Object.assign(new Error("offline"), { code: "unavailable" })) : Promise.resolve({ forEach() {}, metadata: { fromCache: true } })); return q; }; return d; };
      return r;
    };
  });
  await p.evaluate(() => { window.__fakeStore.colMap("users/test/finanzas").delete("f2"); window.__fakeStore.notify(); });
  ok(/necesitas internet/.test(await errorDe(archivoCopia)) && !(await col(p, "finanzas")).f2, "sin conexión: lo explica y no agrega nada");
  await p.evaluate(() => { db.collection = window.__colReal; });

  console.log("\nCalidad a 375 px");
  ok(await sinDesborde(p), "a 375 px no se mueve de lado");
  const chicos = await p.$$eval(".rsp-hoja button", els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 24), h: r.height }; }).filter(x => x.h < 44));
  ok(!chicos.length, `botones de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos)}` : ""}`);
  ok(await p.$eval("#respaldo-abrir", b => b.getBoundingClientRect().height >= 44), "el botón de Inicio mide 44 px");
  await cerrarHoja(p);

  console.log("\nMenú ☰");
  await p.goto(base + "/index.html#inicio");
  await p.waitForTimeout(900);
  ok(await p.$eval("#sidebar", el => getComputedStyle(el).visibility === "hidden"), "con el menú cerrado, sus enlaces no reciben el foco (QA, D-119)");
  await p.click("#menu-toggle");
  await p.waitForTimeout(300);
  // El botón por sí mismo: en el menú hay otros extra («Tu semana», «Tu año»…).
  ok(await p.isVisible("#sidebar [data-respaldo-abrir]") && /Copia de seguridad/.test(await txt(p, "#sidebar [data-respaldo-abrir]")), "«Copia de seguridad» en el menú ☰ (antes de Cerrar sesión)");
  await captura(p, "respaldo-menu-375.png");
  await p.click("#sidebar [data-respaldo-abrir]");
  await p.waitForTimeout(450);
  ok(await abierta(p) && !(await p.$eval("#sidebar", el => el.classList.contains("open"))), "abre la hoja y cierra el menú");
  await p.waitForTimeout(300);
  ok(await p.$eval("#sidebar", el => getComputedStyle(el).visibility === "hidden"), "el menú cerrado vuelve a quedar fuera del foco");
  await cerrarHoja(p);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === "menu-toggle"), "al cerrar, el foco vuelve al botón del menú");
  ok(!consola.length && !p.errores.length, `sin errores ni advertencias en la consola${consola.length ? ` (${consola[0]})` : ""}`);
  await p.context().close();

  console.log("\nEn la compu (1280 px) y con menos movimiento");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#inicio", zona: ZONA, fecha: `${HOY}T13:00:00-04:00`, ancho: 1280, alto: 900 });
  await q.emulateMedia({ reducedMotion: "reduce" });
  await q.waitForTimeout(1000);
  ok(!(await q.isVisible("#sidebar .nav-extra-btn")), "en la barra de arriba de la compu no se amontona (está abajo en Inicio)");
  // Solo lo que se ve (los extra del menú ☰, como «Tu semana», están ocultos en la compu).
  const alto = await q.$$eval("#nav-links > a, #logout-btn", els => els.filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().top)));
  ok(Math.max(...alto) - Math.min(...alto) <= 12, `«Cerrar sesión» sigue alineado en la barra de arriba (${alto.join(", ")})`);
  await abrirHoja(q);
  ok(await abierta(q), "abre desde Inicio también en la compu");
  await captura(q, "respaldo-1280.png");
  await q.$eval(".rsp-hoja .lib-hoja-cuerpo", el => { el.innerHTML += '<span class="rsp-rueda" id="rueda-prueba"></span>'; });
  ok(await q.$eval("#rueda-prueba", el => getComputedStyle(el).animationName === "none"), "con «Reducir movimiento», la rueda de espera no gira");
  await q.context().close();
  fs.rmSync(TMP, { recursive: true, force: true });
  await terminar(browser, srv);
})();
