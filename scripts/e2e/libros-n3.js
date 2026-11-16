// Pruebas de pantalla de Libros nivel 3 (D-128 en adelante,
// docs/LIBROS_NIVEL3.md). Open Library simulado con respuestas reales
// (tests/fixtures/libros/).
// Fase 1 (D-129): buscar bien — título en español con el original aparte,
// el libro de verdad primero, resúmenes al final, autor en nuestro alfabeto
// y buscar por autor.
// Fase 2 (D-130): las páginas de tu edición (ediciones en español
// agrupadas, la recomendada, el ISBN exacto, a mano mandan las tuyas, sin
// internet) y "¿Para cuándo lo quieres terminar?" (páginas por día).
// Fase 3 (D-131): la ficha del autor (Open Library y Wikipedia simulados
// con respuestas reales), sus libros, "＋ Quiero leer", guardado en el
// teléfono y sin internet.
// Fase 4 (D-132): temas en español (tocar uno filtra la lista), "De qué
// trata" (Wikipedia; Google Books como extra), guardado, páginas por género.
// Fase 5 (D-133): "Completar mi biblioteca" (propuestas, usar, los seguros,
// deshacer, dejar como está, no encontrado).
// Fase 6 (D-134): "Si te gustó…" (ideas del mismo autor y de los mismos
// temas, "Ver las N", "✕", "＋ Quiero leer", guardado) y "¿Qué leo después?"
// con lo que te gustó.
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

// ---- Fase 3 (D-131): la ficha del autor ----
const SEED3 = { [LIB]: {
  b1: lb({ titulo: "Brida", autor: "Paulo Coelho", paginas: 288, estado: "por_leer" }),
  b2: lb({ titulo: "El alquimista", autor: "Paulo Coelho", autorKey: "OL66700A", olKey: "/works/OL796465W", paginas: 192, estado: "terminado", calificacion: 5, fechaFin: "2026-11-05" }),
  b3: lb({ titulo: "Cuentos de mi abuela", autor: "Rosa Pérez", estado: "por_leer" })
} };
async function fase3(browser, base, ancho) {
  console.log(`\nLibros nivel 3, fase 3: la ficha del autor (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: SEED3 }, { hash: "#libros", zona: ZONA, fecha: HOY, ancho, alto: ancho > 800 ? 900 : 844 });
  const pedidos = [];
  let caido = false;
  const json = (r, cuerpo) => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: cuerpo });
  await p.context().route(/openlibrary\.org\/search\/authors\.json/, r => { pedidos.push(r.request().url()); if (caido) return r.abort(); json(r, /coelho/i.test(decodeURIComponent(r.request().url())) ? FX("autores-paulo-coelho") : JSON.stringify({ docs: [] })); });
  await p.context().route(/openlibrary\.org\/authors\/OL66700A\.json/, r => { pedidos.push(r.request().url()); json(r, FX("autor-coelho")); });
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    const u = decodeURIComponent(r.request().url());
    pedidos.push(u);
    json(r, /author_key:OL66700A/.test(u) ? FX("libros-de-coelho") : JSON.stringify({ docs: [] }));
  });
  await p.context().route(/openlibrary\.org\/(works|isbn|books)\//, r => json(r, JSON.stringify({ entries: [] })));
  await p.context().route(/es\.wikipedia\.org\/w\/api\.php/, r => { pedidos.push(r.request().url()); json(r, FX("wiki-paulo-coelho")); });
  await p.context().route(/covers\.openlibrary\.org|wikimedia\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.waitForTimeout(800);
  const hoja = sel => `.lib-autor-hoja ${sel}`;
  const libros = () => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), LIB);

  await p.click('[data-lib-ver="b1"]');
  await p.waitForTimeout(350);
  ok(/Paulo Coelho ›/.test(await txt(p, ".lib-hoja [data-lib-autor]")), "en la ficha del libro, el autor se puede tocar");
  await p.click(".lib-hoja [data-lib-autor]");
  await p.waitForTimeout(150);
  ok(/Buscando quién es/.test(await txt(p, hoja("[data-lib-autor-estado]"))) || /escritor brasileño/i.test(await txt(p, hoja(".lib-autor-quien"))), "abre su ficha (primero «Buscando quién es…»)");
  await p.waitForTimeout(700);
  ok(pedidos.some(u => /search\/authors\.json\?q=Paulo%20Coelho/.test(u)), "sin autor de Open Library guardado, lo busca por su nombre");
  const quien = await txt(p, hoja(".lib-autor-quien"));
  ok(/^Paulo Coelho Escritor brasileño 1947$/.test(quien), `quién es: ${quien}`);
  ok(/^Paulo Coelho de Souza \(Río de Janeiro, 24 de agosto de 1947\) es un novelista/.test(await txt(p, hoja(".lib-autor-bio"))), "un resumen en español (Wikipedia)");
  ok(await p.$eval(hoja(".lib-enlace"), a => a.href === "https://es.wikipedia.org/wiki/Paulo_Coelho" && a.target === "_blank").catch(() => false), "«Leer más en Wikipedia»");
  ok(await p.$eval(hoja(".lib-autor-foto img"), i => /wikimedia\.org/.test(i.src)).catch(() => false), "con su foto");
  const mios = await p.$$eval(hoja("[data-lib-autor-ver]"), els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(mios.length === 2 && mios.some(t => /Brida Por leer$/.test(t)) && mios.some(t => /El alquimista Terminado · ★★★★★$/.test(t)), `tus libros de él: ${mios.join(" | ")}`);
  const otrosT = await p.$$eval(hoja(".lib-autor-otro"), els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(otrosT.length >= 6 && !otrosT.some(t => /^(El alquimista|Brida) /.test(t)), `sus libros más leídos, sin los que ya tienes (${otrosT.length})`);
  ok(/^A Orillas Del Rio Piedra Me Sente Y Llore .*72 ediciones/.test(otrosT[0]), `el más leído primero (${otrosT[0].slice(0, 60)})`);
  await captura(p, `libros-n3-autor-${ancho}.png`);
  const iBruja = otrosT.findIndex(t => /^La bruja de Portobello/.test(t));
  await p.click(hoja(`[data-lib-autor-quiero="${iBruja}"]`));
  await p.waitForTimeout(700);
  const campo = n => p.$eval(`.lib-hoja [name="${n}"]`, i => i.value);
  ok((await txt(p, ".lib-hoja h3")) === "Agregar libro" && (await campo("titulo")) === "La bruja de Portobello" && (await campo("autor")) === "Paulo Coelho", "«＋ Quiero leer» abre Agregar libro con todo lleno");
  ok((await campo("autorKey")) === "OL66700A" && (await campo("tituloOriginal")) === "A bruxa de Portobello" && (await campo("estado")) === "por_leer", "con su autor de Open Library, el título original y «Por leer»");
  await p.click(".lib-hoja .lib-form-libro [type=submit]");
  await p.waitForTimeout(450);
  ok((await libros()).some(([, d]) => d.titulo === "La bruja de Portobello" && d.estado === "por_leer" && d.autorKey === "OL66700A"), "se agrega a tu lista");
  if (await p.$eval(".lib-hoja", el => !el.hidden).catch(() => false)) { await p.click(".lib-hoja .budget-sheet-close"); await p.waitForTimeout(300); }

  console.log("La segunda vez abre al instante (guardado en el teléfono)");
  // Abrir un libro también busca "De qué trata" (D-132): se cuentan solo los del autor.
  const delAutor = () => pedidos.filter(u => /search\/authors|\/authors\/OL|author_key|gsrsearch=Paulo%20Coelho&/.test(u)).length;
  const antes = delAutor();
  await p.click('[data-lib-ver="b2"]');
  await p.waitForTimeout(300);
  await p.click(".lib-hoja [data-lib-autor]");
  await p.waitForTimeout(250);
  ok(delAutor() === antes && /Escritor brasileño/.test(await txt(p, hoja(".lib-autor-quien"))), "sin pedir nada otra vez");
  ok((await p.$$(hoja("[data-lib-autor-ver]"))).length === 3, "y ya cuenta el que agregaste (3 tuyos)");
  await p.click(hoja('[data-lib-autor-ver="b1"]'));
  await p.waitForTimeout(400);
  ok((await txt(p, ".lib-hoja .lib-ficha-info h4")) === "Brida", "tocar uno de tus libros abre su ficha");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  console.log("Sin internet");
  caido = true;
  await p.click('[data-lib-ver="b3"]');
  await p.waitForTimeout(300);
  await p.click(".lib-hoja [data-lib-autor]");
  await p.waitForTimeout(600);
  ok(/No pude buscar sus datos \(¿estás sin internet\?\)/.test(await txt(p, hoja("[data-lib-autor-estado]"))) && (await p.$$(hoja("[data-lib-autor-ver]"))).length === 1, "lo dice y muestra igual tus libros de ese autor");
  ok((await sobra(p, "html")) <= 0 && (await sobra(p, ".lib-autor-hoja .budget-sheet-panel")) <= 0, "nada se sale de ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---- Fase 4 (D-132): temas y "De qué trata" ----
const SEED4 = { [LIB]: {
  c1: lb({ titulo: "Cien años de soledad", autor: "Gabriel García Márquez", olKey: "/works/OL274505W", paginas: 417, estado: "terminado", calificacion: 5, fechaFin: "2026-11-05", genero: "novela", temas: ["realismo mágico", "familia"] }),
  c2: lb({ titulo: "Rayuela", autor: "Julio Cortázar", paginas: 600, estado: "por_leer", genero: "novela" }),
  c3: lb({ titulo: "Padre rico, padre pobre", autor: "Robert T. Kiyosaki", paginas: 264, estado: "terminado", fechaFin: "2026-10-01", genero: "finanzas", temas: ["finanzas personales"] })
} };
// Con la forma de la respuesta de Google Books (hecha a mano; no es una respuesta real).
const GOOGLE_RAYUELA = JSON.stringify({ items: [{ volumeInfo: { title: "Rayuela", authors: ["Julio Cortázar"], language: "es", infoLink: "http://books.google.com/books?id=prueba",
  description: "Una novela que se puede leer de varias maneras: de corrido o saltando capítulos según el tablero de dirección que propone el autor." } }] });
async function fase4(browser, base, ancho) {
  console.log(`\nLibros nivel 3, fase 4: temas y «De qué trata» (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: SEED4 }, { hash: "#libros", zona: ZONA, fecha: HOY, ancho, alto: ancho > 800 ? 900 : 844 });
  const wiki = [];
  const json = (r, cuerpo) => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: cuerpo });
  await p.context().route(/es\.wikipedia\.org\/w\/api\.php/, r => {
    const u = decodeURIComponent(r.request().url());
    wiki.push(u);
    json(r, /Cien años/.test(u) ? FX("wiki-libro-cien-anos") : /Hábitos/.test(u) ? FX("wiki-libro-habitos") : JSON.stringify({ batchcomplete: "" }));
  });
  await p.context().route(/openlibrary\.org\/works\/OL\d+W\.json/, r => json(r, JSON.stringify({ key: "/works/x" })));
  await p.context().route(/www\.googleapis\.com\/books/, r => json(r, /Rayuela/.test(decodeURIComponent(r.request().url())) ? GOOGLE_RAYUELA : JSON.stringify({ totalItems: 0 })));
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    const q = (decodeURIComponent(r.request().url()).match(/[?&]q=([^&]*)/) || [])[1] || "";
    const fx = (RESPUESTAS.find(([re]) => re.test(q)) || [null, null])[1];
    json(r, fx ? FX(fx) : JSON.stringify({ docs: [] }));
  });
  await p.context().route(/openlibrary\.org\/(works\/OL\d+W\/editions|isbn|books)/, r => json(r, JSON.stringify({ entries: [] })));
  await p.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.waitForTimeout(800);
  const hoja = sel => `.lib-hoja ${sel}`;
  const libros = () => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), LIB);

  await p.click('[data-lib-ver="c1"]');
  await p.waitForTimeout(150);
  ok(/Buscando de qué trata/.test(await txt(p, hoja("[data-lib-trata]"))) || /De qué trata/.test(await txt(p, hoja("[data-lib-trata]"))), "la ficha busca «De qué trata»");
  await p.waitForTimeout(500);
  const temas = await p.$$eval(hoja("[data-lib-tema]"), els => els.map(e => e.textContent.trim()));
  ok(temas.join(",") === "realismo mágico,familia", `sus temas: ${temas.join(", ")}`);
  const trata = await txt(p, hoja("[data-lib-trata]"));
  ok(/^De qué trata Cien años de soledad es una novela del escritor colombiano/.test(trata) && /Fuente: Wikipedia ↗/.test(trata), "«De qué trata» con su fuente (Wikipedia)");
  ok(wiki.length === 1 && /gsrsearch=Cien años de soledad marquez/.test(wiki[0]), "lo busca por el título y el apellido del autor");
  const corto = await p.$eval(hoja("[data-lib-trata-texto]"), el => el.classList.contains("is-corto") && el.scrollHeight > el.clientHeight + 2);
  ok(corto && await p.$(hoja("[data-lib-trata-mas]")) !== null, "si es largo, se corta con «Ver más»");
  await p.$eval(hoja("[data-lib-trata]"), el => el.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(200);
  await captura(p, `libros-n3-trata-${ancho}.png`);
  await p.click(hoja("[data-lib-trata-mas]"));
  await p.waitForTimeout(150);
  ok(await p.$eval(hoja("[data-lib-trata-texto]"), el => !el.classList.contains("is-corto")), "«Ver más» lo muestra entero");
  await p.click(hoja('[data-lib-tema="realismo mágico"]'));
  await p.waitForTimeout(500);
  const visibles = await p.$$eval("#lib-lista [data-lib-ver]", els => Array.from(new Set(els.filter(e => e.offsetParent).map(e => e.dataset.libVer))));
  ok((await p.inputValue("#lib-buscar")) === "realismo mágico" && visibles.join(",") === "c1", `tocar un tema muestra tus libros de ese tema (${visibles.join(",")})`);
  await p.fill("#lib-buscar", "");
  await p.dispatchEvent("#lib-buscar", "input");
  await p.waitForTimeout(300);

  console.log("Sin Wikipedia: Google Books (extra); la segunda vez, sin pedir nada");
  await p.click('[data-lib-ver="c2"]');
  await p.waitForTimeout(700);
  const trata2 = await txt(p, hoja("[data-lib-trata]"));
  ok(/^De qué trata Una novela que se puede leer de varias maneras/.test(trata2) && /Fuente: Google Libros ↗/.test(trata2), "sin página en Wikipedia: Google Books");
  ok(await p.$eval(hoja("[data-lib-trata] .lib-enlace"), a => a.href.startsWith("https://books.google.com/")).catch(() => false), "su enlace va por https");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  const antes = wiki.length;
  await p.click('[data-lib-ver="c1"]');
  await p.waitForTimeout(300);
  ok(wiki.length === antes && /Cien años de soledad es una novela/.test(await txt(p, hoja("[data-lib-trata]"))), "la segunda vez sale al instante (guardado en el teléfono)");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  console.log("Temas al agregar y páginas por género");
  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  await p.fill(hoja("[data-lib-q]"), "padre rico padre pobre");
  await p.press(hoja("[data-lib-q]"), "Enter");
  await p.waitForTimeout(450);
  await p.click(hoja('[data-lib-elegir-libro="1"]'));
  await p.waitForTimeout(400);
  ok((await p.$eval(hoja('[name="temas"]'), i => i.value)).split("|").includes("finanzas personales"), "al elegir un libro, se llenan sus temas");
  await p.click(hoja(".lib-form-libro [type=submit]"));
  await p.waitForTimeout(450);
  const nuevo = (await libros()).find(([, d]) => d.titulo === "Padre rico, padre pobre para jóvenes");
  ok(nuevo && Array.isArray(nuevo[1].temas) && nuevo[1].temas.includes("finanzas personales"), "se guardan con el libro");
  if (await p.$eval(".lib-hoja", el => !el.hidden).catch(() => false)) { await p.click(".lib-hoja .budget-sheet-close"); await p.waitForTimeout(300); }
  await p.click('[data-lib-vista="stats"]');
  await p.waitForTimeout(400);
  const generos = await p.$$eval(".lib-genero-fila", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(generos.some(t => /^Novela 417 págs\. 1$/.test(t)) && generos.some(t => /^Negocios y finanzas 264 págs\. 1$/.test(t)), `«Lo que más lees» con las páginas de cada género (${generos.join(" | ")})`);
  ok((await sobra(p, "html")) <= 0, "nada se sale de ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---- Fase 5 (D-133): completar tu biblioteca ----
const SEED5 = { [LIB]: {
  a1: lb({ titulo: "Atomic Habits", autor: "James Clear", paginas: 320, estado: "terminado", calificacion: 4, fechaFin: "2026-10-01" }),
  a2: lb({ titulo: "El alquimista", autor: "", estado: "por_leer" }),
  a3: lb({ titulo: "Mis apuntes de la abuela", autor: "Rosa Pérez", estado: "por_leer" }),
  a4: lb({ titulo: "Cien años de soledad", autor: "Gabriel García Márquez", paginas: 471, genero: "novela", temas: ["realismo mágico"], portada: { tipo: "url", url: "https://covers.openlibrary.org/b/id/1-M.jpg", fuente: "openlibrary" }, anio: 1967, olKey: "/works/OL274505W", estado: "terminado", fechaFin: "2026-09-01" }),
  a5: lb({ titulo: "Un libro sin señal", autor: "Ana Soto", paginas: 150, estado: "por_leer" })
} };
async function fase5(browser, base, ancho) {
  console.log(`\nLibros nivel 3, fase 5: completar tu biblioteca (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: SEED5 }, { hash: "#libros", zona: ZONA, fecha: HOY, ancho, alto: ancho > 800 ? 900 : 844 });
  const json = (r, cuerpo) => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: cuerpo });
  const busquedas = [], ediciones = [];
  await p.context().route(/es\.wikipedia\.org|www\.googleapis\.com|openlibrary\.org\/(works|isbn|books|authors)/, r => json(r, JSON.stringify({})));
  await p.context().route(/openlibrary\.org\/works\/OL\d+W\/editions\.json/, r => {
    ediciones.push(r.request().url());
    json(r, /OL796465W/.test(r.request().url()) ? FX("ediciones-alquimista") : JSON.stringify({ entries: [] }));
  });
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    const q = (decodeURIComponent(r.request().url()).match(/[?&]q=([^&]*)/) || [])[1] || "";
    busquedas.push(q);
    if (/sin señal/i.test(q)) return r.abort();
    json(r, /atomic habits/i.test(q) ? FX("buscar-habitos-atomicos") : /alquimista/i.test(q) ? FX("buscar-alquimista") : JSON.stringify({ docs: [] }));
  });
  await p.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.waitForTimeout(800);
  const hoja = sel => `.lib-completar-hoja ${sel}`;
  const libro = id => p.evaluate(([c, i]) => window.__fakeStore.colMap(c).get(i), [LIB, id]);
  const fila = async re => (await p.$$eval(hoja("[data-lib-cpl-fila]"), els => els.map(e => ({ i: e.dataset.libCplFila, t: e.innerText.replace(/\s+/g, " ").trim() }))))
    .find(f => re.test(f.t)) || { i: "x", t: "" };
  const progreso = () => txt(p, hoja("[data-lib-cpl-progreso]"));

  ok(/Completar mi biblioteca 4 libros con datos por completar/.test(await txt(p, "#lib-completar")), "arriba de tu lista: «Completar mi biblioteca · 4 libros…» (el completo no cuenta)");
  await p.click("[data-lib-completar]");
  await p.waitForTimeout(200);
  ok(/Nada cambia sin tu OK/.test(await txt(p, hoja(".lib-hoja-cuerpo"))) && /Revisando [12] de 4…/.test(await progreso()), "explica que nada cambia sin tu OK y va revisando de a uno");
  for (let i = 0; i < 60 && !/Revisé 4 libros/.test(await progreso()); i++) await p.waitForTimeout(150);
  ok(/Revisé 4 libros/.test(await progreso()), "revisa los 4");
  ok(busquedas.includes("Atomic Habits clear") && busquedas.includes("El alquimista") && busquedas.includes("Mis apuntes de la abuela perez"), "busca por el título y el apellido del autor");
  ok(ediciones.length === 1 && /OL796465W/.test(ediciones[0]), "las ediciones, solo del que no tiene páginas");
  const f1 = await fila(/Atomic Habits/);
  ok(/Encontré: Hábitos atómicos · James Clear/.test(f1.t) && /＋ Título en español: «Hábitos atómicos» \(el tuyo queda como original\)/.test(f1.t) && /＋ Género: Desarrollo personal/.test(f1.t) && /＋ Temas: hábitos/.test(f1.t) && /＋ Portada/.test(f1.t) && !/Páginas/.test(f1.t), "Atomic Habits: título en español, género, temas y portada (sus páginas no se tocan)");
  const f2 = await fila(/El alquimista/);
  ok(/＋ Autor: Paulo Coelho/.test(f2.t) && /＋ Páginas: 192 \(la edición en español más común\)/.test(f2.t), "El alquimista: su autor y las páginas de la edición en español más común (192)");
  ok(/No encontré este libro/.test((await fila(/abuela/)).t), "lo que no está en Open Library lo dice");
  ok(/No pude buscarlo/.test((await fila(/sin señal/)).t), "sin internet lo dice");
  await captura(p, `libros-n3-completar-${ancho}.png`);
  ok(/Usar los 2 seguros/.test(await txt(p, hoja("[data-lib-cpl-seguras]"))), "«Usar los 2 seguros»");
  await p.click(hoja("[data-lib-cpl-seguras]"));
  await p.waitForTimeout(400);
  let a1 = await libro("a1");
  const a2 = await libro("a2");
  ok(a1.titulo === "Hábitos atómicos" && a1.tituloOriginal === "Atomic Habits" && a1.genero === "desarrollo" && a1.temas.includes("hábitos") && a1.portada && a1.portada.tipo === "url" && a1.autor === "James Clear", "Atomic Habits queda completo y en español");
  ok(a2.autor === "Paulo Coelho" && a2.autorKey === "OL66700A" && a2.genero === "novela" && a2.paginas === 192, "El alquimista queda con su autor y sus páginas");
  ok(a1.paginas === 320 && a1.calificacion === 4 && a1.estado === "terminado" && a1.fechaFin === "2026-10-01", "lo tuyo (páginas, estrellas, estado, fecha) no cambia");
  const u1 = await fila(/Atomic Habits/);
  ok(/✓ Listo: título en español, género, temas, portada/.test(u1.t) && /✓ Listo/.test((await fila(/El alquimista/)).t) && await p.$(hoja(`[data-lib-cpl-deshacer="${u1.i}"]`)) !== null, "cada uno dice «Listo» con «Deshacer»");
  await p.click(hoja(`[data-lib-cpl-deshacer="${u1.i}"]`));
  await p.waitForTimeout(400);
  a1 = await libro("a1");
  ok(a1.titulo === "Atomic Habits" && a1.tituloOriginal === null && a1.genero === null && a1.temas === null && a1.portada === null && a1.paginas === 320, "«Deshacer» lo deja como estaba");
  ok(/Usar/.test((await fila(/Atomic Habits/)).t), "y vuelve a mostrar la propuesta");
  await p.click(hoja(`[data-lib-cpl-dejar="${u1.i}"]`));
  await p.waitForTimeout(300);
  ok(/Quedó como está/.test((await fila(/Atomic Habits/)).t), "«Dejar como está»");
  await p.click(".lib-completar-hoja .budget-sheet-close");
  await p.waitForTimeout(400);
  ok(/Completar mi biblioteca 1 libro con datos por completar/.test(await txt(p, "#lib-completar")), "después queda 1 (el sin internet): lo que dejaste o no encontré no vuelve");
  ok((await sobra(p, "html")) <= 0, "nada se sale de ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---- Fase 6 (D-134): "Si te gustó…" ----
const SEED6 = { [LIB]: {
  c1: lb({ titulo: "Padre rico, padre pobre", autor: "Robert T. Kiyosaki", autorKey: "OL242220A", genero: "finanzas", temas: ["riqueza", "finanzas personales", "inversiones", "éxito"], olKey: "/works/OL2010879W", paginas: 207, estado: "terminado", calificacion: 5, fechaFin: "2026-11-01" }),
  c2: lb({ titulo: "El alquimista", autor: "Paulo Coelho", autorKey: "OL66700A", genero: "novela", temas: ["viajes"], olKey: "/works/OL796465W", paginas: 192, estado: "terminado", calificacion: 4, fechaFin: "2026-10-01" }),
  c3: lb({ titulo: "Brida", autor: "Paulo Coelho", olKey: "/works/OL796480W", estado: "por_leer" }),
  c4: lb({ titulo: "Piense y hágase rico", autor: "Napoleon Hill", temas: ["riqueza", "éxito"], estado: "por_leer" }),
  c5: lb({ titulo: "Un libro flojo", autor: "Ana Soto", temas: ["autoayuda"], estado: "terminado", calificacion: 2, fechaFin: "2026-11-10" })
} };
async function fase6(browser, base, ancho) {
  console.log(`\nLibros nivel 3, fase 6: «Si te gustó…» (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: SEED6 }, { hash: "#inicio", zona: ZONA, fecha: HOY, ancho, alto: ancho > 800 ? 900 : 844 });
  const json = (r, cuerpo) => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: cuerpo });
  const pedidos = [];
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    const q = (decodeURIComponent(r.request().url()).match(/[?&]q=([^&]*)/) || [])[1] || "";
    pedidos.push(q);
    json(r, /subject:"personal finance"/.test(q) ? FX("ideas-finanzas") : /author_key:OL242220A/.test(q) ? FX("libros-de-kiyosaki") : /author_key:OL66700A/.test(q) ? FX("libros-de-coelho") : JSON.stringify({ docs: [] }));
  });
  await p.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.evaluate(() => { location.hash = "#libros"; });
  for (let i = 0; i < 40 && !(await p.$(".lid")); i++) await p.waitForTimeout(150);
  const items = () => p.$$eval("#lib-ideas .lid-item", els => els.map(e => ({ t: e.innerText.replace(/\s+/g, " ").trim(), k: (e.querySelector("[data-lid-quiero]") || {}).dataset.lidQuiero })));
  const libros = () => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).values()), LIB);

  // "¿Qué leo después?" también mira lo que te gustó.
  const sig = await txt(p, "#lib-siguiente");
  ok(/Brida Es de Paulo Coelho, como «El alquimista», que te gustó\./.test(sig), "«¿Qué leo después?»: Brida, «Es de Paulo Coelho, como «El alquimista», que te gustó»");
  ok(/Piense y hágase rico Trata de riqueza, como «Padre rico, padre pobre», que te gustó\./.test(sig), "y «Piense y hágase rico»: «Trata de riqueza, como «Padre rico, padre pobre»…»");

  ok(/^Si te gustó… Ver las 12 ›/.test(await txt(p, "#lib-ideas")), "«Si te gustó…» debajo, con «Ver las 12»");
  ok(pedidos.length === 3 && pedidos.some(q => /subject:"personal finance" language:spa/.test(q)) && pedidos.some(q => /author_key:OL242220A/.test(q)) && pedidos.some(q => /author_key:OL66700A/.test(q)),
    `busca el tema de «Padre rico» y los autores de tus libros de 4 y 5 estrellas (${pedidos.length} pedidos; el de 2 estrellas no)`);
  let xs = await items();
  ok(xs.length === 2, "muestra 2 (las demás, en «Ver las 12»)");
  ok(/^El hombre más rico de Babilonia George S\. Clason Como «Padre rico, padre pobre»: también trata de finanzas personales y riqueza/.test(xs[0].t), `de los mismos temas, con la razón (${xs[0].t.slice(0, 70)})`);
  ok(/^Padre rico, padre pobre para jóvenes Robert T\. Kiyosaki Como «Padre rico, padre pobre»: también de Robert T\. Kiyosaki/.test(xs[1].t), "del mismo autor");
  ok(await p.$eval("#lib-ideas .lid-tapa img", i => /covers\.openlibrary\.org/.test(i.src)).catch(() => false), "con su portada");
  await captura(p, `libros-n3-ideas-${ancho}.png`);

  await p.click('[data-lid="todas"]');
  await p.waitForTimeout(300);
  const todas = await p.$$eval(".lid-hoja .lid-item b", els => els.map(e => e.textContent));
  const tercera = await txt(p, ".lid-hoja .lid-item:nth-child(3)");
  ok(/^A Orillas Del Rio Piedra Me Sente Y Llore Paulo Coelho Como «El alquimista»: también de Paulo Coelho/.test(tercera), "y las de tu otro libro favorito, intercaladas");
  ok(todas.length === 12 && !todas.some(t => /^(Brida|Piense y hágase rico|El alquimista|Papá rico, papá pobre)$/.test(t)), "«Ver las 12»: sin los que ya tienes (Brida, Piense y hágase rico ni el mismo «Padre rico»)");
  ok(todas.includes("Peregrino") && !todas.some(t => /\//.test(t)), "títulos limpios («Peregrino / the Pilgrimage» → «Peregrino»)");
  await p.click(".lid-hoja .budget-sheet-close");
  await p.waitForTimeout(300);

  // ✕: no me interesa.
  await p.click(`#lib-ideas [data-lid-no="${xs[0].k}"]`);
  await p.waitForTimeout(250);
  xs = await items();
  ok(!xs.some(x => /Babilonia/.test(x.t)) && /Ver las 11/.test(await txt(p, "#lib-ideas")), "«✕» la quita (quedan 11)");

  // ＋ Quiero leer (desde «Ver las 11»): abre "Agregar libro" con todo puesto.
  await p.click('[data-lid="todas"]');
  await p.waitForTimeout(300);
  const enHoja = await p.$$eval(".lid-hoja .lid-item", els => els.map(e => ({ t: e.innerText.replace(/\s+/g, " ").trim(), k: e.querySelector("[data-lid-quiero]").dataset.lidQuiero })));
  const ciencia = enHoja.find(x => /^La ciencia de hacerse rico/.test(x.t));
  ok(!!ciencia && enHoja.length === 11, "en «Ver las 11» está «La ciencia de hacerse rico»");
  await p.click(`.lid-hoja [data-lid-quiero="${ciencia.k}"]`);
  await p.waitForTimeout(700);
  const campo = n => p.$eval(`.lib-hoja [name="${n}"]`, i => i.value).catch(() => "");
  ok((await txt(p, ".lib-hoja h3")) === "Agregar libro" && (await campo("titulo")) === "La ciencia de hacerse rico" && (await campo("autor")) === "Wallace D. Wattles" && (await campo("estado")) === "por_leer", "«＋ Quiero leer» abre Agregar libro con todo lleno y en «Por leer»");
  await p.click(".lib-hoja .lib-form-libro [type=submit]");
  await p.waitForTimeout(500);
  ok((await libros()).some(d => d.titulo === "La ciencia de hacerse rico" && d.estado === "por_leer" && d.autor === "Wallace D. Wattles"), "se agrega a tu lista");
  if (await p.$eval(".lib-hoja", el => !el.hidden).catch(() => false)) { await p.click(".lib-hoja .budget-sheet-close"); await p.waitForTimeout(300); }
  ok(!(await items()).some(x => /La ciencia de hacerse rico/.test(x.t)) && /Ver las 10/.test(await txt(p, "#lib-ideas")), "y ya no se ofrece (quedan 10)");

  // Al volver: lo guardado, sin pedir nada (vale una semana).
  await p.reload();
  for (let i = 0; i < 30 && !(await p.$(".lid")); i++) await p.waitForTimeout(150);
  ok(pedidos.length === 3 && /Ver las 10/.test(await txt(p, "#lib-ideas")) && !(await items()).some(x => /Babilonia/.test(x.t)), "al volver, lo guardado al instante, sin pedir nada (y lo que quitaste sigue fuera)");
  ok((await sobra(p, "html")) <= 0, "nada se sale de ancho");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [390, 320, 1280]) await prueba(browser, base, ancho);
  for (const ancho of [390, 320]) await fase2(browser, base, ancho);
  for (const ancho of [390, 320]) await fase3(browser, base, ancho);
  for (const ancho of [390, 320]) await fase4(browser, base, ancho);
  for (const ancho of [390, 320]) await fase5(browser, base, ancho);
  for (const ancho of [390, 320]) await fase6(browser, base, ancho);
  await terminar(browser, srv);
})();
