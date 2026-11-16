// Pruebas de pantalla de Libros nivel 3 (D-128 en adelante,
// docs/LIBROS_NIVEL3.md). Open Library simulado con respuestas reales
// (tests/fixtures/libros/).
// Fase 1 (D-129): buscar bien — título en español con el original aparte,
// el libro de verdad primero, resúmenes al final, autor en nuestro alfabeto
// y buscar por autor.
// Fase 2 (D-130): las páginas de tu edición (ediciones en español
// agrupadas, la recomendada, el ISBN exacto, a mano mandan las tuyas, sin
// internet) y "¿Para cuándo lo quieres terminar?" (páginas por día).
// Uso: node scripts/e2e/libros-n3.js [carpeta-para-capturas]
const fs = require("node:fs");
const path = require("node:path");
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-16T08:00:00-04:00";
const LIB = "users/test/libros";
const FX = n => fs.readFileSync(path.join(__dirname, "..", "..", "tests", "fixtures", "libros", `${n}.json`), "utf8");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const lb = d => Object.assign({ v: 1, autor: "", paginas: null, estado: "por_leer", calificacion: null, opinion: "", fechaInicio: null, fechaFin: null, creado: 1, fechaRegistro: "2026-11-01" }, d);
const SEED = { [LIB]: { l1: lb({ titulo: "El principito", autor: "Antoine de Saint-Exupéry", paginas: 96, estado: "terminado", calificacion: 5, fechaFin: "2026-11-05", genero: "novela" }) } };
// Lo que contesta Open Library según lo que se busca.
const RESPUESTAS = [
  [/isbn:9788466332125/, "buscar-isbn-padre-rico"], [/habitos atomicos/i, "buscar-habitos-atomicos"], [/padre rico/i, "buscar-padre-rico"],
  [/babilonia/i, "buscar-babilonia"], [/paulo coelho/i, "buscar-coelho"], [/alquimista/i, "buscar-alquimista"]
];
// Un autor que solo viene en otro alfabeto (para ver que se corrige con su ficha).
const CRIMEN = JSON.stringify({ docs: [{ key: "/works/OL166894W", title: "Преступление и наказание", author_name: ["Фёдор Михайлович Достоевский"], author_key: ["OL22242A"],
  first_publish_year: 1866, edition_count: 1178, cover_i: 14550470, subject: ["Fiction", "Murder", "Russian fiction"],
  editions: { docs: [{ key: "/books/OL14005955M", title: "Crimen y castigo", language: ["spa"], cover_i: 14550470 }] } }] });

const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);

async function prueba(browser, base, ancho) {
  console.log(`\nLibros nivel 3, fase 1: buscar bien (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#libros", zona: ZONA, fecha: HOY, ancho, alto: ancho > 800 ? 900 : 844 });
  const pedidos = [];
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    const u = decodeURIComponent(r.request().url());
    pedidos.push(u);
    const q = (u.match(/[?&]q=([^&]*)/) || [])[1] || "";
    const fx = /crimen/i.test(q) ? CRIMEN : (RESPUESTAS.find(([re]) => re.test(q)) || [null, null])[1];
    r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: fx ? (fx.startsWith("{") ? fx : FX(fx)) : JSON.stringify({ docs: [] }) });
  });
  const fichas = [];
  await p.context().route(/openlibrary\.org\/authors\/OL\d+A\.json/, r => {
    fichas.push(r.request().url());
    setTimeout(() => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: FX("autor-dostoievski") }), 300);
  });
  await p.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.waitForTimeout(800);
  const hoja = sel => `.lib-hoja ${sel}`;
  const campo = n => p.$eval(hoja(`[name="${n}"]`), i => i.value);
  const filas = () => p.$$eval(hoja("[data-lib-elegir-libro]"), els => els.map(e => ({ t: e.innerText.replace(/\s+/g, " ").trim(), derivado: e.classList.contains("is-derivado") })));
  const buscar = async q => {
    await p.fill(hoja("[data-lib-q]"), q);
    await p.press(hoja("[data-lib-q]"), "Enter");
    await p.waitForTimeout(500);
  };
  const libros = () => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), LIB);

  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  await buscar("habitos atomicos");
  ok(pedidos.some(u => /lang=es/.test(u) && /editions\.title/.test(u)), "busca prefiriendo las ediciones en español");
  let f = await filas();
  ok(/^Hábitos atómicos James Clear/.test(f[0].t) && /Original: Atomic Habits/.test(f[0].t), `el primero, con el título en español y el original aparte (${f[0].t.slice(0, 80)})`);
  ok(/42 ediciones/.test(f[0].t) && /Desarrollo personal/.test(f[0].t), "dice cuántas ediciones tiene y el género");
  const iDer = f.findIndex(x => x.derivado);
  ok(iDer > 0 && f.slice(iDer).every(x => x.derivado && /Resumen o guía de otro libro/.test(x.t)), `resúmenes y libros de trabajo al final, marcados (${f.length - iDer} de ${f.length})`);
  await captura(p, `libros-n3-buscar-${ancho}.png`);
  await p.click(hoja('[data-lib-elegir-libro="0"]'));
  await p.waitForTimeout(300);
  ok((await campo("titulo")) === "Hábitos atómicos" && (await campo("autor")) === "James Clear" && (await campo("genero")) === "desarrollo", "se llena con el título en español, el autor y el género");
  ok((await campo("tituloOriginal")) === "Atomic Habits" && (await campo("autorKey")) === "OL7422948A", "guarda el título original y el autor de Open Library");
  ok(await p.$eval(hoja("[data-lib-prev] img"), i => /covers\.openlibrary\.org\/b\/id\/\d+-M\.jpg$/.test(i.src)).catch(() => false), "pone la portada de la edición en español");
  await p.click(hoja(".lib-form-libro [type=submit]"));
  await p.waitForTimeout(450);
  let h = (await libros()).find(([, d]) => d.titulo === "Hábitos atómicos");
  ok(h && h[1].tituloOriginal === "Atomic Habits" && h[1].autorKey === "OL7422948A" && h[1].autor === "James Clear", "se guarda con su título original y su autor");
  if (await p.$eval(".lib-hoja", el => !el.hidden).catch(() => false)) { await p.click(".lib-hoja .budget-sheet-close"); await p.waitForTimeout(300); }
  await p.click(`[data-lib-ver="${h[0]}"]`);
  await p.waitForTimeout(350);
  ok(/Título original: Atomic Habits/.test(await txt(p, ".lib-hoja .lib-ficha-info")), "la ficha muestra el título original");

  console.log("Cambiar el autor a mano: ya no es el de Open Library");
  await p.click(hoja('[data-lib="editar"]'));
  await p.waitForTimeout(350);
  await p.fill(hoja('[name="autor"]'), "J. Clear");
  await p.click(hoja(".lib-form-libro [type=submit]"));
  await p.waitForTimeout(450);
  h = (await libros()).find(([, d]) => d.titulo === "Hábitos atómicos");
  ok(h[1].autor === "J. Clear" && h[1].autorKey === null && h[1].tituloOriginal === "Atomic Habits", "el autor cambiado deja de apuntar a Open Library (el título original queda)");
  if (await p.$eval(".lib-hoja", el => !el.hidden).catch(() => false)) { await p.click(".lib-hoja .budget-sheet-close"); await p.waitForTimeout(300); }

  console.log("El libro de verdad primero, por autor y en otro alfabeto");
  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  await buscar("el hombre mas rico de babilonia");
  f = await filas();
  ok(/^El hombre más rico de Babilonia George S\. Clason/.test(f[0].t) && /Original: The Richest Man in Babylon/.test(f[0].t), `primero el de verdad (${f[0].t.slice(0, 70)})`);
  await buscar("paulo coelho");
  f = await filas();
  ok(/Libros de Paulo Coelho, los más leídos primero/.test(await txt(p, hoja("[data-lib-buscar-msg]"))), "si escribes un autor: «Libros de Paulo Coelho, los más leídos primero»");
  ok(/^El alquimista Paulo Coelho/.test(f[0].t) && f.every(x => /Paulo Coelho/.test(x.t)), "primero El alquimista y todos son de él");
  await buscar("crimen y castigo");
  ok(/Фёдор|Fiódor/.test(await txt(p, hoja('[data-lib-autor-de="0"]'))), "aparece el resultado");
  await p.waitForTimeout(600);
  ok((await txt(p, hoja('[data-lib-autor-de="0"]'))) === "Fiódor Dostoievski" && fichas.length === 1, "el autor en otro alfabeto se cambia por «Fiódor Dostoievski» (de su ficha)");
  await p.click(hoja('[data-lib-elegir-libro="0"]'));
  await p.waitForTimeout(300);
  ok((await campo("titulo")) === "Crimen y castigo" && (await campo("autor")) === "Fiódor Dostoievski" && (await campo("tituloOriginal")) === "Преступление и наказание", "se llena con el título en español y el autor en nuestro alfabeto");
  await buscar("978-84-663-3212-5");
  f = await filas();
  ok(f.length === 1 && /^Padre Rico, padre Pobre Robert T\. Kiyosaki/.test(f[0].t), "un ISBN trae esa edición");
  ok((await sobra(p, "html")) <= 0 && (await sobra(p, ".lib-hoja .budget-sheet-panel")) <= 0, "nada se sale de ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---- Fase 2 (D-130): las páginas de tu edición y páginas por día ----
const EDICIONES = { "/works/OL17930368W": "ediciones-habitos-atomicos", "/works/OL2010879W": "ediciones-padre-rico" };
const SEED2 = { [LIB]: {
  l1: lb({ titulo: "El principito", autor: "Antoine de Saint-Exupéry", paginas: 96, estado: "terminado", calificacion: 5, fechaFin: "2026-11-05", genero: "novela" }),
  l2: lb({ titulo: "Sapiens", autor: "Yuval Noah Harari", paginas: 300, estado: "leyendo", fechaInicio: "2026-11-10", paginaActual: 90, progreso: { "2026-11-10": 50, "2026-11-15": 90 } })
} };
async function fase2(browser, base, ancho) {
  console.log(`\nLibros nivel 3, fase 2: las páginas de tu edición (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: SEED2 }, { hash: "#libros", zona: ZONA, fecha: HOY, ancho, alto: ancho > 800 ? 900 : 844 });
  let edicionesCaidas = false;
  const pedidos = [];
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    const q = (decodeURIComponent(r.request().url()).match(/[?&]q=([^&]*)/) || [])[1] || "";
    const fx = (RESPUESTAS.find(([re]) => re.test(q)) || [null, null])[1];
    r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: fx ? FX(fx) : JSON.stringify({ docs: [] }) });
  });
  await p.context().route(/openlibrary\.org\/(works|isbn|books)\//, r => {
    const u = r.request().url();
    pedidos.push(u);
    if (edicionesCaidas) return r.abort();
    const obra = (u.match(/\/works\/OL\d+W/) || [])[0];
    const body = /\/isbn\/9788466332125\.json/.test(u) ? FX("isbn-9788466332125") : obra && EDICIONES[obra] ? FX(EDICIONES[obra]) : JSON.stringify({ entries: [] });
    r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body });
  });
  await p.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.waitForTimeout(800);
  const hoja = sel => `.lib-hoja ${sel}`;
  const campo = n => p.$eval(hoja(`[name="${n}"]`), i => i.value);
  const opciones = () => p.$$eval(hoja("[data-lib-ed]"), els => els.map(e => ({ t: e.innerText.replace(/\s+/g, " ").trim(), on: e.getAttribute("aria-checked") === "true" })));
  const elegir = async q => {
    await p.fill(hoja("[data-lib-q]"), q);
    await p.press(hoja("[data-lib-q]"), "Enter");
    await p.waitForTimeout(450);
    await p.click(hoja('[data-lib-elegir-libro="0"]'));
    await p.waitForTimeout(600);
  };
  const libros = () => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), LIB);

  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  await elegir("habitos atomicos");
  ok(pedidos.some(u => /\/works\/OL17930368W\/editions\.json\?limit=100/.test(u)), "pide las ediciones de la obra elegida");
  ok(/¿Cuántas páginas tiene tu libro\? Cambia según la edición/.test(await txt(p, hoja("[data-lib-ediciones]"))), "pregunta «¿Cuántas páginas tiene tu libro?»");
  let o = await opciones();
  ok(o.length === 2 && /^338 págs\. Recomendada De 326 a 338 págs\. · 4 ediciones/.test(o[0].t) && o[0].on, `la recomendada, ya elegida: ${o[0] && o[0].t.slice(0, 60)}`);
  ok(/^448 págs\. 3 ediciones \(edición especial\) Diana 2025/.test(o[1].t) && !o[1].on, "la otra: 448 (edición especial)");
  ok((await campo("paginas")) === "338" && (await campo("edicionEditorial")) === "Editorial Planeta" && (await campo("edicionAnio")) === "2023", "pone 338 páginas y guarda la edición");
  ok(await p.$eval(hoja("[data-lib-prev] img"), i => /13249133-M\.jpg$/.test(i.src)).catch(() => false), "y la portada de esa edición");
  await p.$eval(hoja("[data-lib-ediciones]"), el => el.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(250);
  await captura(p, `libros-n3-ediciones-${ancho}.png`);
  await p.click(hoja('[data-lib-ed="1"]'));
  await p.waitForTimeout(200);
  o = await opciones();
  ok((await campo("paginas")) === "448" && (await campo("edicionEditorial")) === "Diana" && o[1].on && !o[0].on, "tocas la otra: 448 páginas (Diana)");
  ok(await p.$eval(hoja("[data-lib-prev] img"), i => /15246990-M\.jpg$/.test(i.src)).catch(() => false), "la portada cambia a la de esa edición");
  await p.fill(hoja('[name="paginas"]'), "350");
  await p.waitForTimeout(150);
  o = await opciones();
  ok(o.every(x => !x.on) && (await campo("edicionEditorial")) === "" && (await campo("edicionKey")) === "", "si escribes las páginas, mandan las tuyas (y ya no es esa edición)");
  await p.click(hoja('[data-lib-ed="0"]'));
  await p.waitForTimeout(150);
  await p.click(hoja(".lib-form-libro [type=submit]"));
  await p.waitForTimeout(450);
  const h = (await libros()).find(([, d]) => d.titulo === "Hábitos atómicos");
  ok(h && h[1].paginas === 338 && h[1].edicion && h[1].edicion.editorial === "Editorial Planeta" && h[1].edicion.anio === 2023 && h[1].edicion.key, "se guarda con 338 páginas y su edición");
  if (await p.$eval(".lib-hoja", el => !el.hidden).catch(() => false)) { await p.click(".lib-hoja .budget-sheet-close"); await p.waitForTimeout(300); }
  await p.click(`[data-lib-ver="${h[0]}"]`);
  await p.waitForTimeout(350);
  ok(/Edición\s*Editorial Planeta · 2023/.test(await txt(p, ".lib-hoja .lib-datos")), "la ficha dice la edición");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  console.log("Con el código de barras: tu edición exacta");
  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  await elegir("978-84-663-3212-5");
  o = await opciones();
  ok(pedidos.some(u => /\/isbn\/9788466332125\.json/.test(u)) && /^264 págs\. Exacta Tu edición \(por el código de barras\) Debolsillo · 2020 · tapa blanda/.test(o[0].t) && o[0].on, `primero tu edición exacta (${o[0] && o[0].t.slice(0, 70)})`);
  ok((await campo("paginas")) === "264", "pone 264 (tu edición)");
  ok(o.length === 4 && /Ver 3 más/.test(await txt(p, hoja("[data-lib-ed-mas]"))), "muestra 4 y «Ver 3 más»");
  await p.click(hoja("[data-lib-ed-mas]"));
  await p.waitForTimeout(150);
  const todas = await opciones();
  ok(todas.length === 7 && todas[0].on && todas.filter(x => x.on).length === 1, "«Ver 3 más» muestra las 7 (la elegida sigue marcada)");
  console.log("Sin internet");
  edicionesCaidas = true;
  await elegir("padre rico padre pobre");
  ok(/No pude ver las ediciones \(¿estás sin internet\?\): puse 241/.test(await txt(p, hoja("[data-lib-ediciones]"))) && (await campo("paginas")) === "241", "sin internet: deja las aproximadas y lo dice");
  edicionesCaidas = false;
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  console.log("¿Para cuándo lo quieres terminar?");
  await p.click('[data-lib-ver="l2"]');
  await p.waitForTimeout(350);
  ok(/¿Para cuándo lo quieres terminar\?/.test(await txt(p, hoja("[data-lib-fin-caja]"))), "la ficha pregunta para cuándo lo quieres terminar");
  await p.$eval(hoja("[data-lib-fin-caja]"), el => el.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(250);
  await captura(p, `libros-n3-terminar-${ancho}.png`);
  const chips = await p.$$eval(hoja("[data-lib-fin]"), els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(chips.join(" | ") === "En 1 semana · 30 páginas por día | En 2 semanas · 15 páginas por día | En 1 mes · 7 páginas por día", `con lo que tendrías que leer por día (${chips.join(" | ")})`);
  await p.click(hoja('[data-lib-fin="2026-11-22"]'));
  await p.waitForTimeout(400);
  let l2 = (await libros()).find(([id]) => id === "l2")[1];
  ok(l2.metaFin === "2026-11-22", "se guarda la fecha");
  ok(/🎯 Para terminarlo el .*22 nov.*: 30 páginas por día/.test(await txt(p, hoja("[data-lib-fin-caja]"))), "🎯 Para terminarlo el dom 22 nov: 30 páginas por día");
  await p.click(hoja("[data-lib-fin-cambiar]"));
  await p.waitForTimeout(150);
  await p.click(hoja('[data-lib-fin=""]'));
  await p.waitForTimeout(400);
  l2 = (await libros()).find(([id]) => id === "l2")[1];
  ok(l2.metaFin === null && /¿Para cuándo lo quieres terminar\?/.test(await txt(p, hoja("[data-lib-fin-caja]"))), "«Quitar la meta» la borra");
  await p.click(hoja('[data-lib-fin="2026-11-29"]'));
  await p.waitForTimeout(400);
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  ok(/🎯 Para el .*29 nov.*: 15 páginas por día/.test(await txt(p, '[data-lib-sigue="l2"]')), "«Sigue leyendo» también lo dice");
  console.log("No menos páginas que la página en la que vas");
  await p.click('[data-lib-ver="l2"]');
  await p.waitForTimeout(300);
  await p.click(hoja('[data-lib="editar"]'));
  await p.waitForTimeout(300);
  await p.fill(hoja('[name="paginas"]'), "80");
  await p.click(hoja(".lib-form-libro [type=submit]"));
  await p.waitForTimeout(300);
  ok(/Vas en la página 90: el libro no puede tener menos páginas/.test(await txt(p, hoja(".lib-error"))) && (await libros()).find(([id]) => id === "l2")[1].paginas === 300, "no deja poner menos páginas que la página en la que vas");
  ok((await sobra(p, "html")) <= 0 && (await sobra(p, ".lib-hoja .budget-sheet-panel")) <= 0, "nada se sale de ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [390, 320, 1280]) await prueba(browser, base, ancho);
  for (const ancho of [390, 320]) await fase2(browser, base, ancho);
  await terminar(browser, srv);
})();
