// Pruebas de pantalla de Libros "más inteligente" (2026-10-29): buscar el
// libro, página en la que vas, meta diaria, reto del año, festejo al
// terminar, estadísticas, filtro por género y duplicados.
// Uso: node scripts/e2e/libros-progreso.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-10-29T08:00:00-04:00";   // jueves 29 de octubre
const LIB = "users/test/libros";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const lb = d => Object.assign({ v: 1, autor: "", paginas: null, estado: "por_leer", calificacion: null, opinion: "", fechaInicio: null, fechaFin: null, creado: 1 }, d);
const SEED = { [LIB]: {
  l1: lb({ titulo: "El principito", autor: "Antoine de Saint-Exupéry", paginas: 96, estado: "terminado", calificacion: 5, fechaRegistro: "2026-09-01", fechaInicio: "2026-09-01", fechaFin: "2026-09-10", genero: "novela" }),
  l2: lb({ titulo: "Cien años de soledad", autor: "Gabriel García Márquez", paginas: 471, estado: "leyendo", fechaRegistro: "2026-10-20", fechaInicio: "2026-10-20" })
} };
// Respuesta real (recortada) de Open Library, verificada desde GitHub Actions.
const OL = { docs: [
  { key: "/works/OL22363054W", title: "Motivos y tópicos amatorios clásicos en El amor en los tiempos del cólera", author_name: ["Manuel Cabello Pino"], first_publish_year: 2010, edition_count: 1 },
  { key: "/works/OL274518W", title: "El amor en los tiempos del cólera", author_name: ["Gabriel García Márquez"], first_publish_year: 1985, number_of_pages_median: 451, cover_i: 10096404, edition_count: 130,
    subject: ["Vida familiar", "Historias de amor", "Love stories", "Historical fiction", "Novela", "Colombian fiction"] },
  { key: "/works/OL20046181W", title: "El amor en los tiempos del Facebook", author_name: ["Dante Gebel"], first_publish_year: 2016, number_of_pages_median: 238, cover_i: 12634050, edition_count: 1,
    subject: ["Christian life", "Vida cristiana", "Christianity", "Spiritual life"] }
] };
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
const sobra = (p, sel) => p.$eval(sel, el => el.scrollWidth - el.clientWidth);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: SEED }, { hash: "#libros", zona: ZONA, fecha: HOY });
  let modoOL = "ok";
  const pedidos = [];
  await p.context().route(/openlibrary\.org\/search\.json/, r => {
    pedidos.push(decodeURIComponent(r.request().url()));
    return modoOL === "caido" ? r.abort() : r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(modoOL === "vacio" ? { docs: [] } : OL) });
  });
  await p.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p.waitForTimeout(800);
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  const libro = id => p.evaluate(([c, i]) => window.__fakeStore.colMap(c).get(i), [LIB, id]);
  const todos = () => p.evaluate(c => Array.from(window.__fakeStore.colMap(c).entries()), LIB);
  const hoja = sel => `.lib-hoja ${sel}`;

  console.log("\nArriba: meta de hoy y reto");
  ok(/HOY 0 de 30 páginas/i.test(await tx('[data-lib-meta="hoy"]')), "Hoy: 0 de 30 páginas (la meta empieza en 30, como tu rutina)");
  ok(/Reto 2026 1 libro Ponte un reto de libros/i.test(await tx('[data-lib-meta="reto"]')), "Reto 2026: 1 libro, «Ponte un reto»");
  ok(/Sigue leyendo/.test(await tx("#lib-leyendo")) && /471 páginas · ¿en cuál vas\?/.test(await tx('[data-lib-sigue="l2"]')), "Sigue leyendo: Cien años de soledad, ¿en qué página vas?");

  console.log("\nAnotar la página en la que vas");
  await p.click('[data-lib-sigue="l2"] [data-lib-pagina]');
  await p.waitForTimeout(350);
  ok((await tx(".lib-hoja h3")) === "¿En qué página vas?" && /desde hoy cuento tus páginas por día/.test(await tx(hoja(".lib-form-pagina"))), "hoja «¿En qué página vas?» y explica que lo de antes no cuenta hoy");
  ok(await p.$eval(hoja('[name="pagina"]'), i => i.inputMode === "numeric" && getComputedStyle(i).fontSize !== ""), "teclado numérico");
  await p.fill(hoja('[name="pagina"]'), "500");
  await p.click(hoja('[type="submit"]'));
  await p.waitForTimeout(200);
  ok(/El libro tiene 471 páginas/.test(await tx(hoja(".lib-error"))), "no deja pasar del total");
  await p.fill(hoja('[name="pagina"]'), "150");
  await p.click(hoja('[type="submit"]'));
  await p.waitForTimeout(400);
  let d = await libro("l2");
  ok(d.paginaActual === 150 && d.paginaBase === 150 && JSON.stringify(d.progreso) === JSON.stringify({ "2026-10-29": 150 }), "se guarda: página 150, base 150 (ya lo venías leyendo)");
  ok(/HOY 0 de 30/i.test(await tx('[data-lib-meta="hoy"]')), "esas 150 no cuentan como leídas hoy");
  ok(/Página 150 de 471 · 32 %/.test(await tx('[data-lib-sigue="l2"]')) && /Faltan 321 páginas. Con 30 páginas al día lo terminas el 9 nov/.test(await tx('[data-lib-sigue="l2"]')), "32 %, faltan 321 y con 30 al día lo terminas el 9 nov");
  await p.click('[data-lib-sigue="l2"] [data-lib-pagina]');
  await p.waitForTimeout(350);
  ok((await p.$eval(hoja('[name="pagina"]'), i => i.value)) === "150", "la hoja trae la página en la que ibas");
  await p.click(hoja('[data-lib-sumar="30"]'));
  ok((await p.$eval(hoja('[name="pagina"]'), i => i.value)) === "180", "«+30» suma a la página");
  await p.click(hoja('[type="submit"]'));
  await p.waitForTimeout(400);
  ok(/HOY 30 de 30 páginas ✓ Meta cumplida/i.test(await tx('[data-lib-meta="hoy"]')) && await p.$eval('[data-lib-meta="hoy"]', b => b.classList.contains("is-cumplida")), "Hoy: 30 de 30, «Meta cumplida»");
  await captura(p, "libros-arriba.png");

  console.log("\nMetas");
  await p.click('[data-lib-meta="hoy"]');
  await p.waitForTimeout(350);
  ok((await tx(".lib-hoja h3")) === "Tus metas de lectura" && (await p.$eval(hoja('[name="metaPaginasDia"]'), i => i.value)) === "30", "hoja de metas con 30 páginas por día");
  await p.fill(hoja('[name="metaPaginasDia"]'), "0");
  await p.click(hoja('[type="submit"]'));
  await p.waitForTimeout(200);
  ok(/de 1 a 1000/.test(await tx(hoja(".lib-error"))), "una meta de 0 páginas no vale");
  await p.fill(hoja('[name="metaPaginasDia"]'), "40");
  await p.fill(hoja('[name="reto"]'), "12");
  await p.click(hoja('[type="submit"]'));
  await p.waitForTimeout(400);
  const meta = await p.evaluate(() => window.__fakeStore.colMap("users/test/meta").get("libros_ajustes"));
  ok(meta && meta.metaPaginasDia === 40 && meta.retos["2026"] === 12, "se guarda: 40 páginas por día y reto de 12 libros en 2026");
  ok(/HOY 30 de 40/i.test(await tx('[data-lib-meta="hoy"]')) && /1 de 12 libros Te faltan 9 libros para ir al día/.test(await tx('[data-lib-meta="reto"]')), "Hoy 30 de 40; reto 1 de 12, «te faltan 9 para ir al día»");

  console.log("\nTerminar un libro: festejo y calificación");
  await p.click('[data-lib-sigue="l2"] [data-lib-pagina]');
  await p.waitForTimeout(350);
  await p.click(hoja('[data-lib-sumar="fin"]'));
  ok((await p.$eval(hoja('[name="pagina"]'), i => i.value)) === "471", "«Lo terminé» pone la última página");
  await p.click(hoja('[type="submit"]'));
  await p.waitForTimeout(450);
  ok(/¡Terminaste «Cien años de soledad»!/.test(await tx(".lib-hoja .lib-festejo")) && /2 libros terminados en 2026 de 12 de tu reto/.test(await tx(".lib-hoja .lib-festejo")), "festejo: ¡Terminaste! y cuenta para el reto (2 de 12)");
  d = await libro("l2");
  ok(d.estado === "terminado" && d.fechaFin === "2026-10-29" && d.paginaActual === 471, "queda Terminado hoy, en la página 471");
  await p.click(hoja('[data-lib-calificar="4"]'));
  await p.waitForTimeout(300);
  ok((await libro("l2")).calificacion === 4 && (await p.$$eval(hoja("[data-lib-calificar].on"), b => b.length)) === 4, "4 estrellas de un toque");
  await p.click(hoja('[data-lib="listo"]'));
  await p.waitForTimeout(350);
  ok(!(await tx("#lib-leyendo")), "ya no aparece en «Sigue leyendo»");
  ok(/HOY 321 de 40/i.test(await tx('[data-lib-meta="hoy"]')), "hoy: 321 páginas leídas");

  console.log("\nAgregar buscando el libro");
  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  ok(/completo el título, el autor, las páginas, la portada y el género/.test(await tx(hoja("[data-lib-buscar-msg]"))), "arriba, «Buscar el libro» explica que completa todo");
  await p.fill(hoja("[data-lib-q]"), "el amor en los tiempos");
  await p.waitForTimeout(1100);
  ok(pedidos.some(u => u.includes("q=el amor en los tiempos")), "busca solo al dejar de escribir (sin tocar Buscar)");
  const filas = await p.$$eval(hoja("[data-lib-elegir-libro]"), els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(filas.length === 3 && /^El amor en los tiempos del cólera Gabriel García Márquez 1985 · 451 págs\. · Novela$/.test(filas[0]), `primero el libro completo, con año, páginas y género (${filas[0]})`);
  ok(/Fe y espiritualidad/.test(filas[1]) && /Motivos y tópicos/.test(filas[2]), "el análisis sin portada queda al final; otro sale como Fe y espiritualidad");
  await p.click(hoja('[data-lib-elegir-libro="0"]'));
  await p.waitForTimeout(300);
  const campo = n => p.$eval(hoja(`[name="${n}"]`), i => i.value);
  ok((await campo("titulo")) === "El amor en los tiempos del cólera" && (await campo("autor")) === "Gabriel García Márquez" && (await campo("paginas")) === "451" && (await campo("genero")) === "novela", "completa título, autor, páginas y género");
  ok((await campo("anio")) === "1985" && (await campo("olKey")) === "/works/OL274518W", "y guarda el año y la obra de Open Library");
  ok(await p.$eval(hoja("[data-lib-prev] img"), i => i.src === "https://covers.openlibrary.org/b/id/10096404-M.jpg"), "pone la portada");
  ok(/✓ Completé el título, el autor, las páginas, el género y la portada/.test(await tx(hoja("[data-lib-buscar-msg]"))), "dice qué completó");
  await p.click(hoja(".lib-form-libro [type=submit]"));
  await p.waitForTimeout(450);
  const amor = (await todos()).find(([, x]) => x.titulo === "El amor en los tiempos del cólera");
  ok(amor && amor[1].autor === "Gabriel García Márquez" && amor[1].paginas === 451 && amor[1].genero === "novela" && amor[1].anio === 1985 && amor[1].olKey === "/works/OL274518W" && amor[1].portada.url === "https://covers.openlibrary.org/b/id/10096404-M.jpg", "se guarda con todo");

  console.log("\nISBN, sin resultados, sin internet y duplicados");
  await p.click('[data-lib="nuevo"]');
  await p.waitForTimeout(350);
  await p.fill(hoja("[data-lib-q]"), "978-0-307-38726-4");
  await p.press(hoja("[data-lib-q]"), "Enter");
  await p.waitForTimeout(400);
  ok(pedidos.some(u => u.includes("q=isbn:9780307387264")), "un ISBN se busca como ISBN (y Enter busca, no guarda)");
  ok(await p.$eval(".lib-hoja", el => !el.hidden) && !(await todos()).some(([, x]) => !x.titulo), "Enter no guardó un libro vacío");
  modoOL = "vacio";
  await p.click(hoja('[data-lib="buscar-libro"]'));
  await p.waitForTimeout(400);
  ok(/No encontré ese libro/.test(await tx(hoja("[data-lib-buscar-msg]"))), "sin resultados lo dice");
  modoOL = "caido";
  await p.click(hoja('[data-lib="buscar-libro"]'));
  await p.waitForTimeout(400);
  ok(/No se pudo buscar \(¿estás sin internet\?\)/.test(await tx(hoja("[data-lib-buscar-msg]"))), "sin internet lo dice y se puede escribir a mano");
  modoOL = "ok";
  await p.fill(hoja('[name="titulo"]'), "el principito");
  await p.waitForTimeout(150);
  ok(/Ojo: ya tienes «El principito» en tu lista \(Terminado\)/.test(await tx(hoja("[data-lib-dup]"))), "avisa si ya lo tienes");
  const antes = (await todos()).length;
  await p.evaluate(() => { window.__confirm = window.confirm; window.confirm = () => false; });
  await p.click(hoja(".lib-form-libro [type=submit]"));
  await p.waitForTimeout(350);
  await p.evaluate(() => { window.confirm = window.__confirm; });
  ok((await todos()).length === antes, "y pregunta antes de agregarlo otra vez (Cancelar no lo agrega)");
  await p.click(".lib-hoja .budget-sheet-close");
  await p.waitForTimeout(350);

  console.log("\nFiltro por género y orden por calificación");
  ok(await visible(p, "#lib-genero"), "aparece el filtro de género");
  await p.selectOption("#lib-genero", "novela");
  await p.waitForTimeout(200);
  const novelas = await p.$$eval("#lib-lista [data-lib-ver]", els => els.map(e => e.dataset.libVer));
  ok(novelas.length === 2 && novelas.includes("l1") && !novelas.includes("l2"), "Novela: El principito y El amor… (no Cien años, sin género)");
  await p.selectOption("#lib-genero", "");
  await p.selectOption("#lib-orden", "calificacion");
  await p.waitForTimeout(200);
  ok((await p.$$eval("#lib-lista [data-lib-ver]", els => els.map(e => e.dataset.libVer))).slice(0, 2).join(",") === "l1,l2", "por calificación: 5 ★ y luego 4 ★");

  console.log("\nEstadísticas");
  await p.click('[data-lib-vista="stats"]');
  await p.waitForTimeout(300);
  const cifras = await p.$$eval(".lib-stats-cifras > div", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(/^Libros en 2026 2$/.test(cifras[0]) && /^Páginas en 2026 417$/.test(cifras[1]), `libros y páginas del año: 2 y 417 = 96 + 321 (${cifras.slice(0, 2).join(" | ")})`);
  ok(/^Calificación 4,5 ★ promedio$/.test(cifras[5]), "calificación promedio 4,5");
  ok((await p.$$eval('[data-graf="dias"] path', els => els.length)) === 1 && /meta 40/.test(await p.$eval('.lib-g[aria-label^="Páginas"]', s => s.textContent)), "páginas por día: una barra (hoy) y la línea de la meta");
  await p.click('[data-graf="dias"][data-graf-i="29"]');
  ok((await tx('[data-graf-lectura="dias"]')) === "29 oct: 321 páginas", "tocar la barra de hoy: «29 oct: 321 páginas»");
  await p.click('[data-graf="meses"][data-graf-i="8"]');
  ok((await tx('[data-graf-lectura="meses"]')) === "sep: 1 libro", "tocar septiembre: «sep: 1 libro»");
  await p.click('.lib-graf:nth-of-type(2) .lib-g-tabla summary');
  ok((await p.$$eval(".lib-graf:nth-of-type(2) .lib-g-tabla tbody tr", r => r.length)) === 12, "«Ver tabla» con los 12 meses");
  ok(/Novela 1/.test(await tx(".lib-generos")) && /El más largo que terminaste: Cien años de soledad \(471 páginas\)/.test(await tx(".lib-curiosos")), "lo que más lees (cuenta los terminados: Novela 1) y el más largo");
  await captura(p, "libros-estadisticas.png");
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();

  console.log("\nCelular angosto (320 px)");
  const q = await abrir(browser, base, { __SEED__: SEED }, { hash: "#libros", ancho: 320, alto: 700, zona: ZONA, fecha: HOY });
  await q.context().route(/openlibrary\.org\/search\.json/, r => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(OL) }));
  await q.context().route(/covers\.openlibrary\.org/, r => r.fulfill({ contentType: "image/png", body: PNG }));
  await q.waitForTimeout(700);
  ok((await sobra(q, "html")) <= 0, "Libros (con las metas y Sigue leyendo) no se sale de ancho");
  await q.click('[data-lib-vista="stats"]');
  await q.waitForTimeout(250);
  ok((await sobra(q, "html")) <= 0 && (await sobra(q, "#lib-vista-stats")) <= 0, "Estadísticas cabe");
  await q.click('[data-lib="nuevo"]');
  await q.waitForTimeout(300);
  await q.fill(".lib-hoja [data-lib-q]", "el amor");
  await q.press(".lib-hoja [data-lib-q]", "Enter");
  await q.waitForTimeout(400);
  ok((await sobra(q, ".lib-hoja .budget-sheet-panel")) <= 0, "la hoja con los resultados cabe");
  await captura(q, "libros-buscar-320.png");
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();
  await terminar(browser, srv);
})();
