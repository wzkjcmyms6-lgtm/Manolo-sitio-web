// Pruebas de pantalla de Lugares (D-117, docs/LUGARES.md), a 375 px.
// Uso: node scripts/e2e/lugares.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-15";
const COL = "users/test/lugares";
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const abierta = (p, sel) => p.$eval(sel, el => !el.hidden && !el.classList.contains("is-closing")).catch(() => false);
const sinDesborde = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const docs = p => p.evaluate(c => Object.fromEntries(window.__fakeStore.colMap(c)), COL);
const uno = async (p, nombre) => Object.entries(await docs(p)).find(([, d]) => d.nombre === nombre) || [null, null];
const esperar = ms => new Promise(r => setTimeout(r, ms));
const form = s => `.lug-hoja-form ${s}`;
const det = s => `.lug-hoja-det ${s}`;
// Una foto JPEG hecha en la página (como si vinieras de la cámara).
const subirFoto = (p, ancho, alto) => p.evaluate(([w, h]) => new Promise(res => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.fillStyle = "#c0392b"; g.fillRect(0, 0, w, h); g.fillStyle = "#f1c40f"; g.fillRect(w / 4, h / 4, w / 2, h / 2);
  c.toBlob(b => {
    const dt = new DataTransfer(); dt.items.add(new File([b], "foto.jpg", { type: "image/jpeg" }));
    const input = document.querySelector('.lug-hoja-form [data-f="foto"]'); input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true })); res();
  }, "image/jpeg", 0.9);
}), [ancho, alto]);
const fotosIDB = p => p.evaluate(() => window.LugaresFotos.todas().then(rs => rs.map(r => ({ id: r.id, lugarId: r.lugarId, ancho: r.ancho, alto: r.alto, tam: r.blob.size, tipo: r.blob.type }))));

async function cerrarHoja(p, clase) {
  await p.click(`.${clase} .budget-sheet-close`);
  await p.waitForTimeout(320);
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: { "users/test/finanzas": { i1: { date: "2026-11-01", type: "ingreso", category: "salario", payment: "debito", amount: 3000, createdAt: 1 } } } },
    { hash: "#inicio", zona: ZONA, fecha: `${HOY}T13:00:00-04:00`, ancho: 375, alto: 812 });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1200);

  console.log("\nAcceso desde Inicio");
  ok(/Lugares/.test(await txt(p, '#panel-inicio a.card[href="#lugares"]')), "tarjeta «Lugares» en Inicio");
  await p.click('a.card[href="#lugares"]');
  await p.waitForTimeout(600);
  ok(await p.isVisible("#panel-lugares") && !(await p.isVisible("#verse-banner")), "abre Lugares (sin el versículo de arriba)");
  ok(/Inicio/.test(await txt(p, "#panel-lugares .back-link")), "con «‹ Inicio» para volver");
  ok(/Tu guía de dónde comer/.test(await txt(p, "#lug-lista")) && /Agregar mi primer lugar/.test(await txt(p, "#lug-lista")), "estado vacío con mensaje y acción");
  ok(await p.$eval('[data-lug="sugerir"]', b => b.disabled) && await p.$eval('[data-lug="exportar"]', b => b.hidden), "sin lugares: ¿Dónde como hoy? desactivado y sin Exportar");
  await captura(p, "lugares-vacio-375.png");

  console.log("\nRegistrar en segundos (nombre, estrellas, ¿volverías?)");
  const t0 = Date.now();
  await p.click(".lug-fab");
  await p.waitForTimeout(400);
  ok(await abierta(p, ".lug-hoja-form") && /Nuevo lugar/.test(await txt(p, ".lug-hoja-form h3")), "＋ abre «Nuevo lugar» en una hoja de abajo");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.name === "nombre"), "el cursor ya está en Nombre");
  ok(await p.$eval(form('[name="nombre"]'), el => parseFloat(getComputedStyle(el).fontSize) >= 16), "letra de 16 px o más (el iPhone no hace zoom)");
  await p.click(form(".lug-guardar"));
  await p.waitForTimeout(250);
  const errs = await p.$$eval(".lug-hoja-form [data-err]:not([hidden])", els => els.map(e => e.dataset.err));
  ok(errs.join() === "nombre,calificacion,volveria", `validación en línea: ${errs.join(", ")}`);
  await p.fill(form('[name="nombre"]'), "Pollos Copacabana");
  await p.click(form('[data-grupo="calificacion"] [data-estrella="4"]'));
  await p.click(form('[data-grupo="volveria"] [data-seg="si"]'));
  await p.fill(form('[name="gastoHoy"]'), "45,50");
  ok(await p.$eval(form('[name="gastoHoy"]'), el => el.inputMode === "decimal"), "el gasto abre el teclado de números (inputmode decimal)");
  await p.click(form(".lug-guardar"));
  await p.waitForTimeout(500);
  ok(Date.now() - t0 < 15000, `se registra en ${((Date.now() - t0) / 1000).toFixed(1)} s (< 15 s)`);
  let [idPollos, pollos] = await uno(p, "Pollos Copacabana");
  const vis = pollos ? Object.values(pollos.visitas) : [];
  ok(pollos && pollos.v === 1 && pollos.estado === "visitado" && pollos.calificacion === 4 && pollos.volveria === "si" && vis.length === 1 && vis[0].fecha === HOY && vis[0].gastoCent === 4550,
    "guardado: 4 ★, volvería sí y la visita de hoy con su gasto (en centavos)");
  ok(/Guardado/.test(await txt(p, "#lug-toast")), "aviso breve «Guardado»");

  console.log("\n¿Lo pasas a Finanzas? (solo si confirmas)");
  await p.waitForTimeout(300);
  ok(await abierta(p, ".lug-hoja-fin") && /Bs 45,5/.test(await txt(p, ".lug-hoja-fin")), "pregunta si pasar los Bs 45,5 a Finanzas");
  const movsAntes = await p.evaluate(() => window.__fakeStore.colMap("users/test/finanzas").size);
  await p.click('.lug-hoja-fin [data-fin="si"]');
  await p.waitForTimeout(500);
  ok(await p.$eval("#txn-sheet", el => !el.hidden) && await p.$eval('#txn-sheet [data-txn-type="gasto"]', b => b.classList.contains("active")), "se abre la hoja de Finanzas, en Gasto");
  ok(/45,5/.test(await txt(p, "#txn-sheet")) && /Comida/.test(await txt(p, "#txn-sheet")) && /Pollos Copacabana/.test(await p.$eval("#txn-sheet", el => el.innerText + [...el.querySelectorAll("input,textarea")].map(i => i.value).join(" "))), "ya llena: Bs 45,5, Comida y el nombre del lugar");
  await p.click("#txn-sheet .budget-sheet-close");
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__fakeStore.colMap("users/test/finanzas").size) === movsAntes, "si cierras sin guardar, no se anota nada en Finanzas");

  console.log("\nLa lista");
  const tarjeta = await txt(p, "#lug-lista .lug-card");
  ok(/Pollos Copacabana/.test(tarjeta) && /Volvería: Sí/.test(tarjeta) && /Última: 15 nov/.test(tarjeta) && /★ 4/.test(tarjeta), `tarjeta: ${tarjeta}`);
  ok(await p.$eval("#lug-lista .lug-volv.is-si", el => !!el.querySelector("svg")), "«Volvería» con color, ícono y texto");
  ok(await p.$eval("#lug-lista .lug-card", el => el.getBoundingClientRect().height >= 44), "la tarjeta se toca fácil (≥ 44 px)");

  console.log("\nBorrador: no se pierde lo escrito si cierras sin querer");
  await p.click(".lug-fab");
  await p.waitForTimeout(400);
  await p.fill(form('[name="nombre"]'), "Café Árabe");
  await p.click(form('[data-grupo="calificacion"] [data-estrella="5"]'));
  await p.waitForTimeout(350);
  await cerrarHoja(p, "lug-hoja-form");
  await p.click(".lug-fab");
  await p.waitForTimeout(400);
  ok(/Seguimos con lo que habías escrito/.test(await txt(p, ".lug-hoja-form .lug-borrador")) && await p.inputValue(form('[name="nombre"]')) === "Café Árabe" && await p.$eval(form('[data-estrella="5"]'), b => b.getAttribute("aria-checked") === "true"), "al volver a abrir, sigue lo escrito (nombre y estrellas)");

  console.log("\nMás detalles: tipo, zona, precio, desglose, foto, Maps, etiquetas y notas");
  await p.click(form('[data-grupo="volveria"] [data-seg="si"]'));
  await p.click(form('[data-f="mas"]'));
  await p.waitForTimeout(150);
  ok(await p.$eval(form('[data-f="mas"]'), b => b.getAttribute("aria-expanded") === "true"), "«Más detalles» se abre");
  await p.click(form('[data-tipo="cafe"]'));
  await p.fill(form('[name="zona"]'), "Sopocachi");
  await p.fill(form('[name="especialidad"]'), "Té de menta y café turco");
  await p.click(form('[data-grupo="precio"] [data-seg="2"]'));
  await p.fill(form('[name="gastoAprox"]'), "40");
  await p.click(form('[data-grupo="d-comida"] [data-estrella="5"]'));
  await p.click(form('[data-grupo="d-atencion"] [data-estrella="4"]'));
  await p.fill(form('[name="maps"]'), "maps de google");
  await p.fill(form('[name="etiquetas"]'), "Tranquilo, wifi");
  await p.fill(form('[name="notas"]'), "Ideal para leer.");
  await subirFoto(p, 3000, 2000);
  for (let i = 0; i < 40 && !(await p.$(".lug-hoja-form .lug-foto-mini img")); i++) await p.waitForTimeout(100);
  ok(!!(await p.$(".lug-hoja-form .lug-foto-mini img")) && await p.$eval(".lug-hoja-form .lug-foto-quitar", b => b.getBoundingClientRect().width >= 44 && /Quitar la foto/.test(b.getAttribute("aria-label"))), "la foto aparece en miniatura, con «quitar» de 44 px");
  await p.click(form(".lug-guardar"));
  await p.waitForTimeout(300);
  ok(/Pega el link completo/.test(await txt(p, '.lug-hoja-form [data-err="maps"]')), "un link de Maps inválido se marca en línea");
  await p.fill(form('[name="maps"]'), "https://maps.app.goo.gl/abc123");
  await p.click(form(".lug-guardar"));
  await p.waitForTimeout(600);
  let [idCafe, cafe] = await uno(p, "Café Árabe");
  ok(cafe && cafe.tipo === "cafe" && cafe.zona === "Sopocachi" && cafe.precio === 2 && cafe.gastoAproxCent === 4000 && cafe.desglose.comida === 5 && cafe.desglose.atencion === 4 && cafe.maps === "https://maps.app.goo.gl/abc123" && cafe.etiquetas.join() === "tranquilo,wifi" && cafe.notas === "Ideal para leer.",
    "guardado con todos los detalles");
  ok(cafe && cafe.fotos.length === 1 && /^data:image\/jpeg;base64,/.test(cafe.fotos[0].mini) && cafe.fotos[0].mini.length < 30000, `en la nube solo la miniatura (${cafe && cafe.fotos[0] ? Math.round(cafe.fotos[0].mini.length / 1024) : "?"} KB)`);
  const idb = await fotosIDB(p);
  ok(idb.length === 1 && idb[0].lugarId === idCafe && idb[0].ancho === 1200 && idb[0].alto === 800 && idb[0].tipo === "image/jpeg", `la foto completa va al teléfono (IndexedDB), achicada a 1200 px (${idb[0] ? `${idb[0].ancho}×${idb[0].alto}, ${Math.round(idb[0].tam / 1024)} KB` : "?"})`);
  ok(await p.evaluate(() => !Object.keys(localStorage).some(k => /lugares/.test(k) && /data:image|blob/.test(localStorage.getItem(k)))), "ninguna foto en localStorage");
  ok(await p.evaluate(() => !JSON.parse(localStorage.getItem("manolo.lugares.borradores") || "{}").nuevo), "al guardar, el borrador se borra");
  // No hay gasto de hoy → no ofrece Finanzas.
  ok(!(await abierta(p, ".lug-hoja-fin")), "sin gasto, no pregunta por Finanzas");

  console.log("\nDetalle");
  await p.click(`[data-lug-ver="${idCafe}"]`);
  await p.waitForTimeout(500);
  const d = await txt(p, ".lug-hoja-det");
  ok(/Café Árabe/.test(await txt(p, ".lug-hoja-det h3")) && /5\/5/.test(d) && /Volvería: Sí/.test(d) && /Café · Sopocachi · \$\$ · Gasto aprox\. Bs 40/.test(d) && /Qué venden: Té de menta/.test(d), "foto, calificación, volvería, tipo, zona, precio y qué venden");
  ok(/Comida/.test(d) && /Atención/.test(d) && /#tranquilo/.test(d) && /Ideal para leer/.test(d) && /Fuiste 1 vez · última: 15 nov/.test(d), "desglose, etiquetas, notas y «Fuiste 1 vez · última»");
  ok(await p.$eval(det(".lug-maps"), a => a.href === "https://maps.app.goo.gl/abc123" && a.target === "_blank" && a.rel.includes("noopener")), "«Abrir en Google Maps» (pestaña nueva, seguro)");
  for (let i = 0; i < 30 && !(await p.$eval(det(".lug-det-img"), i => i.src.startsWith("blob:")).catch(() => false)); i++) await p.waitForTimeout(100);
  ok(await p.$eval(det(".lug-det-img"), i => i.src.startsWith("blob:") && i.alt === "Foto de Café Árabe"), "la foto principal completa sale del teléfono, con texto alternativo");
  await captura(p, "lugares-detalle-375.png");

  console.log("\nPlatos (con «Mi favorito de aquí») y visitas");
  await p.click(det('[data-d="plato"]'));
  await p.waitForTimeout(400);
  await p.fill(form('[name="nombre"]'), "Té de menta");
  await p.fill(form('[name="precio"]'), "12");
  await p.click(form('[data-grupo="gusto"] [data-seg="si"]'));
  await p.check(form('[name="favorito"]'));
  await p.click(form('[type="submit"]'));
  await p.waitForTimeout(700);
  await p.click(det('[data-d="plato"]'));
  await p.waitForTimeout(400);
  await p.fill(form('[name="nombre"]'), "Baklava");
  await p.click(form('[data-grupo="gusto"] [data-seg="no"]'));
  await p.check(form('[name="favorito"]'));
  await p.click(form('[type="submit"]'));
  await p.waitForTimeout(700);
  cafe = (await uno(p, "Café Árabe"))[1];
  const platos = Object.values(cafe.platos);
  ok(platos.length === 2 && platos.filter(x => x.favorito).length === 1 && platos.find(x => x.favorito).nombre === "Baklava" && platos.find(x => x.nombre === "Té de menta").precioCent === 1200, "dos platos; un solo favorito (el último que marcaste)");
  ok(/★ Mi favorito Baklava/.test(await txt(p, ".lug-hoja-det")) && /No me gustó/.test(await txt(p, ".lug-hoja-det")), "el detalle muestra el favorito y si te gustó");
  // Nueva visita con gasto → pregunta Finanzas; «Ahora no».
  await p.click(det('[data-d="visita"]'));
  await p.waitForTimeout(400);
  await p.fill(form('[name="fecha"]'), "2026-11-10");
  await p.fill(form('[name="conQuien"]'), "Ana");
  await p.fill(form('[name="gasto"]'), "80");
  await p.click(form('[type="submit"]'));
  await p.waitForTimeout(600);
  ok(await abierta(p, ".lug-hoja-fin"), "una visita con gasto también pregunta por Finanzas");
  await p.click('.lug-hoja-fin [data-fin="no"]');
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__fakeStore.colMap("users/test/finanzas").size) === movsAntes, "«Ahora no»: Finanzas no cambia");
  await p.click(`[data-lug-ver="${idCafe}"]`);
  await p.waitForTimeout(450);
  ok(/Fuiste 2 veces · última: 15 nov · en total Bs 80/.test(await txt(p, ".lug-hoja-det")) && /10 nov · con Ana/.test(await txt(p, ".lug-hoja-det")), "«Fuiste 2 veces · última: 15 nov» y la visita con Ana");
  // Borrar la visita: al instante, con Deshacer.
  await p.click(".lug-hoja-det li:nth-child(2) [data-editar-visita]");
  await p.waitForTimeout(400);
  await p.click(form('[data-f="borrar"]'));
  await p.waitForTimeout(400);
  ok(Object.keys((await uno(p, "Café Árabe"))[1].visitas).length === 1 && /Borraste la visita/.test(await txt(p, "#lug-toast")) && await p.isVisible("#lug-toast .undo-toast-btn"), "borrar una visita: al instante y con «Deshacer» (sin confirm)");
  await p.click("#lug-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok(Object.keys((await uno(p, "Café Árabe"))[1].visitas).length === 2, "«Deshacer» la trae de vuelta");

  console.log("\nQuiero ir y «Ya fui»");
  await p.click('[data-lug-tab="quiero"]');
  await p.waitForTimeout(200);
  ok(/¿Algún lugar que quieres probar\?/.test(await txt(p, "#lug-lista")), "Quiero ir vacío: mensaje y acción");
  await p.click(".lug-fab");
  await p.waitForTimeout(400);
  ok(await p.$eval(form('[data-grupo="estado"] [data-seg="quiero"]'), b => b.getAttribute("aria-checked") === "true") && await p.$eval(form(".lug-solo-visitado"), el => el.hidden), "desde Quiero ir: ya marcado «Quiero ir» (sin estrellas)");
  await p.fill(form('[name="nombre"]'), "Gustu");
  await p.click(form(".lug-guardar"));
  await p.waitForTimeout(500);
  let [idGustu, gustu] = await uno(p, "Gustu");
  ok(gustu && gustu.estado === "quiero" && gustu.calificacion === null, "«Quiero ir»: solo con el nombre");
  ok(/Gustu/.test(await txt(p, "#lug-lista")) && await p.isVisible(`[data-lug-yafui="${idGustu}"]`), "su tarjeta tiene «Ya fui»");
  await p.click(`[data-lug-yafui="${idGustu}"]`);
  await p.waitForTimeout(400);
  ok(/¿Qué tal Gustu\?/.test(await txt(p, ".lug-hoja-form h3")), "«Ya fui» abre la calificación");
  await p.click(form('[data-grupo="calificacion"] [data-estrella="5"]'));
  await p.click(form('[data-grupo="volveria"] [data-seg="tal_vez"]'));
  await p.click(form(".lug-guardar"));
  await p.waitForTimeout(500);
  gustu = (await uno(p, "Gustu"))[1];
  ok(gustu.estado === "visitado" && gustu.calificacion === 5 && gustu.volveria === "tal_vez" && Object.values(gustu.visitas).some(v => v.fecha === HOY), "pasa a Visitados con la visita de hoy");
  ok(/pasó a Visitados/.test(await txt(p, "#lug-toast")), "y lo avisa");
  await p.click('[data-lug-tab="visitado"]');
  await p.waitForTimeout(200);

  console.log("\nBuscar, filtrar y ordenar");
  ok((await p.$$("#lug-lista .lug-card")).length === 3, "Visitados: 3");
  await p.fill("#lug-q", "baklava");
  await p.waitForTimeout(300);
  ok((await p.$$eval("#lug-lista .lug-nombre", els => els.map(e => e.textContent))).join() === "Café Árabe", "buscar por plato (con debounce)");
  await p.fill("#lug-q", "TRANQUILO");
  await p.waitForTimeout(300);
  ok((await p.$$eval("#lug-lista .lug-nombre", els => els.map(e => e.textContent))).join() === "Café Árabe", "por etiqueta, sin importar mayúsculas");
  await p.fill("#lug-q", "copacabana");
  await p.waitForTimeout(300);
  ok((await p.$$eval("#lug-lista .lug-nombre", els => els.map(e => e.textContent))).join() === "Pollos Copacabana", "por nombre");
  await p.fill("#lug-q", "zzz");
  await p.waitForTimeout(300);
  ok(/Nada coincide con «zzz»/.test(await txt(p, "#lug-lista")) && await p.isVisible('[data-lug="limpiar-todo"]'), "sin resultados: mensaje y «Ver todos»");
  await p.click('[data-lug="limpiar-todo"]');
  await p.waitForTimeout(200);
  await p.click('[data-lug-chip="tipo"]');
  await p.waitForTimeout(300);
  ok(await abierta(p, ".lug-hoja-elegir") && (await p.$$(".lug-hoja-elegir [data-lug-op]")).length === 8, "chip «Tipo» abre las opciones");
  await p.click('.lug-hoja-elegir [data-lug-op="cafe"]');
  await p.waitForTimeout(400);
  ok((await p.$$eval("#lug-lista .lug-nombre", els => els.map(e => e.textContent))).join() === "Café Árabe" && /☕ Café/.test(await txt(p, '[data-lug-chip="tipo"]')) && await p.$eval('[data-lug-chip="tipo"]', b => b.classList.contains("is-activo")), "filtra por tipo y el chip lo dice");
  await p.click('[data-lug="limpiar"]');
  await p.waitForTimeout(200);
  await p.click('[data-lug-chip="minCal"]');
  await p.waitForTimeout(300);
  await p.click('.lug-hoja-elegir [data-lug-op="5"]');
  await p.waitForTimeout(400);
  ok((await p.$$eval("#lug-lista .lug-nombre", els => els.map(e => e.textContent))).sort().join() === "Café Árabe,Gustu", "calificación mínima ★ 5");
  await p.click('[data-lug="limpiar"]');
  await p.waitForTimeout(200);
  await p.click('[data-lug-chip="orden"]');
  await p.waitForTimeout(300);
  await p.click('.lug-hoja-elegir [data-lug-op="visitados"]');
  await p.waitForTimeout(400);
  ok((await p.$$eval("#lug-lista .lug-nombre", els => els.map(e => e.textContent)))[0] === "Café Árabe", "ordenar por más visitados");
  ok(await p.$eval("#lug-chips", el => getComputedStyle(el).overflowX === "auto") && await sinDesborde(p), "los chips se deslizan de lado sin mover la pantalla");

  console.log("\n¿Dónde como hoy? y estadísticas");
  await p.click('[data-lug="sugerir"]');
  await p.waitForTimeout(500);
  const sug = await txt(p, ".lug-hoja-sugerir [data-sug-res]");
  ok(/Pollos Copacabana|Café Árabe/.test(sug) && !/Gustu/.test(sug), `sugiere uno al que volverías (${sug.slice(0, 40)})`);
  await p.click('.lug-hoja-sugerir [data-sug-tipo="cafe"]');
  await p.waitForTimeout(300);
  ok(/Café Árabe/.test(await txt(p, ".lug-hoja-sugerir [data-sug-res]")) && /Tu favorito de aquí: Baklava/.test(await txt(p, ".lug-hoja-sugerir [data-sug-res]")), "filtrado por tipo (café), con tu favorito");
  ok(await p.$eval(".lug-hoja-sugerir .lug-sug-tarjeta", el => el.classList.contains("is-nueva") && getComputedStyle(el).animationName === "lug-aparece"), "aparece con una animación corta");
  await p.click('.lug-hoja-sugerir [data-sug-tipo="bar"]');
  await p.waitForTimeout(300);
  ok(/Nada con esos filtros/.test(await txt(p, ".lug-hoja-sugerir [data-sug-res]")), "sin opciones: lo explica");
  await captura(p, "lugares-sugerir-375.png");
  await cerrarHoja(p, "lug-hoja-sugerir");
  await p.click('[data-lug="stats"]');
  await p.waitForTimeout(400);
  const st = await txt(p, ".lug-hoja-stats");
  ok(/3 lugares/.test(st) && /★ 4,7 promedio/.test(st) && /Bs 125,5 en salidas \(4 visitas\)/.test(st) && /Café/.test(st), `estadísticas: ${st.slice(0, 130)}`);
  ok((await p.$$(".lug-hoja-stats .lug-top li")).length === 3, "top de tus mejores lugares");
  await cerrarHoja(p, "lug-hoja-stats");

  console.log("\nBorrar un lugar con Deshacer (y sus fotos solo al final)");
  await p.click(`[data-lug-ver="${idCafe}"]`);
  await p.waitForTimeout(400);
  await p.click(det('[data-d="borrar"]'));
  await p.waitForTimeout(400);
  ok(!(await docs(p))[idCafe] && /Borraste «Café Árabe»/.test(await txt(p, "#lug-toast")), "se borra al instante, con «Deshacer»");
  ok((await fotosIDB(p)).length === 1, "su foto sigue en el teléfono mientras puedas deshacer");
  await p.click("#lug-toast .undo-toast-btn");
  await p.waitForTimeout(500);
  cafe = (await docs(p))[idCafe];
  ok(cafe && cafe.nombre === "Café Árabe" && Object.keys(cafe.platos).length === 2 && cafe.fotos.length === 1, "«Deshacer» lo trae entero (platos y foto)");
  await p.click(`[data-lug-ver="${idCafe}"]`);
  await p.waitForTimeout(400);
  await p.click(det('[data-d="borrar"]'));
  await p.waitForTimeout(400);
  await esperar(5600);
  ok(!(await docs(p))[idCafe] && (await fotosIDB(p)).length === 0, "si no deshaces, a los 5 s también se borra su foto del teléfono");

  console.log("\nExportar y calidad");
  ok(await p.$eval('[data-lug="exportar"]', b => !b.hidden), "con lugares, aparece «Exportar (JSON)»");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-lug="exportar"]')]);
  const json = JSON.parse(require("fs").readFileSync(await dl.path(), "utf8"));
  ok(/manolo-lugares-2026-11-15\.json/.test(dl.suggestedFilename()) && json.lugares.length === 2 && Array.isArray(json.fotos), "exporta tus lugares (y las fotos)");
  ok(await sinDesborde(p), "a 375 px no se mueve de lado");
  const chicos = await p.$$eval("#panel-lugares button:not([hidden]), #panel-lugares a", els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 20), h: r.height }; }).filter(x => x.h < 44));
  ok(!chicos.length, `botones de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos)}` : ""}`);
  ok(await p.$eval(".lug-fab", b => b.getAttribute("aria-label") === "Agregar lugar"), "el ＋ tiene nombre para el lector de pantalla");
  ok(!consola.length && !p.errores.length, `sin errores ni advertencias en la consola${consola.length ? ` (${consola[0]})` : ""}`);
  await captura(p, "lugares-lista-375.png");
  await p.context().close();

  // Menos movimiento: sin animaciones.
  console.log("\nMenos movimiento");
  const q = await abrir(browser, base, { __SEED__: { [COL]: { a: { v: 1, nombre: "Doña Rosa", estado: "visitado", calificacion: 4, volveria: "si", tipo: "restaurante", platos: {}, visitas: {}, fotos: [], creado: 1, actualizado: 1 } } } },
    { hash: "#lugares", zona: ZONA, fecha: `${HOY}T13:00:00-04:00`, ancho: 375, alto: 812 });
  await q.emulateMedia({ reducedMotion: "reduce" });
  await q.waitForTimeout(900);
  await q.click('[data-lug="sugerir"]');
  await q.waitForTimeout(400);
  ok(await q.$eval(".lug-hoja-sugerir .lug-sug-tarjeta", el => getComputedStyle(el).animationName === "none"), "con «Reducir movimiento», la sugerencia aparece sin animación");
  await q.context().close();
  await terminar(browser, srv);
})();
