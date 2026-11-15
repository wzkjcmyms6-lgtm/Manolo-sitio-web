// QA final de "Libros, Biblia y Medir tiempos: siguiente nivel" (fase 8,
// 2026-11-15, D-115). Lo que las otras pruebas no miran:
// 1. Tus datos de siempre quedan intactos: con versículos, libros, frases y
//    tiempos guardados como antes (lectura-semilla.js), usa todo lo nuevo
//    (lector, plan, memorizar, editar un versículo y dos libros, Leer ahora,
//    repaso de frases, importar de Goodreads y Kindle, Mi mañana, plan de la
//    mañana, experimento, se llena sola) y al final compara documento por
//    documento: nada de antes cambió ni se perdió (solo se suman campos); y
//    los tres «Exportar» (Biblia, Libros, Medir tiempos) llevan todo lo nuevo.
// 2. Rendimiento con muchos datos: 3 años de tiempos, 1.500 versículos,
//    400 libros y 3.000 frases.
// 3. A 320 px (el iPhone más angosto) nada se mueve de lado.
// Sin errores de página ni de consola.   node scripts/e2e/lectura-qa.js
const { chromium, servidor, abrir, ok, terminar } = require("./comun.js");
const SEM = require("./lectura-semilla.js");
const { txt, visible, sinDesborde, consola } = require("./lectura-n2.js");

const ZONA = "America/La_Paz";
const HOY = "2026-11-16";   // lunes
const col = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(`users/test/${x}`)), c);
const irA = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
function sinErrores(p, donde) {
  const c = p.consola || [];
  ok(!p.errores.length && !c.length, `${donde}: sin errores de página ni de consola${c.length ? ` (${c[0]})` : ""}`);
}

// Cada dato del documento de antes sigue igual (se pueden sumar campos).
function cambios(antes, ahora, ruta, out) {
  if (antes && typeof antes === "object" && !Array.isArray(antes)) {
    if (!ahora || typeof ahora !== "object") { out.push(`${ruta}: se perdió`); return out; }
    Object.keys(antes).forEach(k => cambios(antes[k], ahora[k], `${ruta}.${k}`, out));
    return out;
  }
  if (JSON.stringify(antes) !== JSON.stringify(ahora)) out.push(`${ruta}: ${JSON.stringify(antes)} → ${JSON.stringify(ahora)}`);
  return out;
}
const ordenar = x => (Array.isArray(x) ? x.map(ordenar) : x && typeof x === "object" ? Object.keys(x).sort().reduce((o, k) => { o[k] = ordenar(x[k]); return o; }, {}) : x);
const igual = (a, b) => JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));

const GR = [
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies",
  '1,Hábitos atómicos,James Clear,"Clear, James",,="",="",5,4.3,,Paperback,328,2018,2018,,2026/10/01,,,currently-reading,,,,0,0',
  '2,Cien años de soledad,Gabriel García Márquez,"García Márquez, Gabriel",,="",="",4,4.4,,Paperback,471,1967,1967,2026/07/01,2026/06/01,,,read,"Otra opinión.",,,1,0',
  '3,El poder del hábito,Charles Duhigg,"Duhigg, Charles",,="",="",4,4.1,,Kindle Edition,408,2012,2012,2025/09/30,2025/09/01,,,read,,,,1,0'
].join("\n");
const KINDLE = [
  "Hábitos atómicos (James Clear)",
  "- Tu subrayado en la página 38 | posición 580-582 | Añadido el domingo, 5 de octubre de 2026 22:22:10",
  "",
  "Cada acción que realizas es un voto por el tipo de persona que deseas ser.",
  "==========",
  "Hábitos atómicos (James Clear)",
  "- Tu subrayado en la página 51 | posición 700-702 | Añadido el lunes, 6 de octubre de 2026 7:10:00",
  "",
  "Los hábitos son el interés compuesto de la superación personal.",
  "==========",
  "Hábitos atómicos (James Clear)",
  "- Tu nota en la página 51 | posición 702 | Añadido el lunes, 6 de octubre de 2026 7:11:00",
  "",
  "Aplicarlo a la lectura de la mañana.",
  "==========",
  ""].join("\n");

// ---------- 1. Tus datos de siempre quedan intactos ----------
async function intactos(browser, base) {
  console.log("\nTus datos de siempre quedan intactos (390 px)");
  const e = SEM.estado(HOY), S = e.__SEED__;
  // Carreras: Medir tiempos se llena sola desde hoy; los días de antes no cambian.
  S["users/test/running"] = {
    r1: { date: HOY, distance: 6, duration: 36, notes: "" },
    r2: { date: "2026-11-13", distance: 5, duration: 30, notes: "" },
    r3: { date: "2026-11-11", distance: 4, duration: 26, notes: "" }
  };
  const antes = JSON.parse(JSON.stringify(S));
  const versEditado = Object.keys(S["users/test/biblia"]).pop();
  const p = await abrir(browser, base, e, { hash: "#biblia", zona: ZONA, relojFalso: `${HOY}T06:00:00-04:00`, ancho: 390, alto: 844 });
  consola(p);
  const avanzar = async ms => { await p.clock.fastForward(ms); await p.waitForTimeout(300); };
  await p.waitForTimeout(1200);

  // Biblia: leer y marcar un capítulo, memorizar, empezar un plan y editar un versículo de antes.
  await p.click('[data-bib="leer"]');
  await p.waitForTimeout(700);
  ok(/Libro de la generación/.test(await txt(p, "#bbl-v1")), "Biblia: el lector abre Mateo 1");
  await p.click('[data-bbl="leido"]');
  await p.waitForTimeout(400);
  await p.evaluate(() => BibliaLector.abrir("John", 3));
  await p.waitForTimeout(700);
  await p.click("#bbl-v16");
  await p.waitForTimeout(200);
  await p.click('[data-bbs="memorizar"]');
  await p.waitForTimeout(400);
  ok(/Juan 3:16 en Memorizar/.test(await txt(p, ".bbl-toast")), "memoriza Juan 3:16");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);
  await p.click(`[data-bib-editar="${versEditado}"]`);
  await p.waitForTimeout(350);
  ok((await txt(p, "#bib-hoja-t")) === "Editar versículo", "abre un versículo de antes para editarlo");
  await p.click('.bib-hoja [type="submit"]');
  await p.waitForTimeout(400);
  await irA(p, "#biblia-planes");
  await p.click('[data-bpl-empezar="evangelios30"]');
  await p.waitForTimeout(500);
  const plan = await txt(p, "#bib-resumen .bpl-hoy");
  ok(/Evangelios en 30 días/.test(plan) && /Hoy: Mateo 2\b/.test(plan), `empieza «Evangelios en 30 días»: Mateo 1 ya lo leíste hoy, falta Mateo 2 (${plan})`);

  // Libros: Leer ahora, repaso de frases, editar dos libros e importar.
  await irA(p, "#libros");
  await p.click('#lib-leyendo [data-lses-leer="l1"]');
  await p.waitForTimeout(300);
  await avanzar(20 * 60000);
  await p.click('.lib-hoja-sesion [data-lses="terminar"]');
  await p.waitForTimeout(250);
  await p.fill('.lib-hoja-sesion [name="hasta"]', "160");
  await p.click('.lib-hoja-sesion button[type="submit"]');
  await p.waitForTimeout(500);
  ok(/18 páginas en 20 min/.test(await txt(p, ".lib-hoja-sesion .lses-listo")), "Libros: «Leer ahora» guarda tu sesión (18 páginas en 20 min)");
  await p.click(".lib-hoja-sesion [data-cerrar-hoja].lib-btn");
  await p.waitForTimeout(300);
  await p.click('#lib-repaso [data-lfr="repasar"]');
  await p.waitForTimeout(300);
  let repasadas = 0;
  for (; repasadas < 3 && await visible(p, '.lfr-hoja [data-lfr-nota="bien"]'); repasadas++) { await p.click('.lfr-hoja [data-lfr-nota="bien"]'); await p.waitForTimeout(300); }
  ok(repasadas > 0 && /Listo por hoy/.test(await txt(p, ".lfr-hoja .lfr-fin")), `repasa las frases de hoy (${repasadas})`);
  await p.click(".lfr-hoja .lfr-fin [data-cerrar-hoja]");
  await p.waitForTimeout(300);
  for (const id of ["l2", "l3"]) {
    await p.click(`#lib-lista [data-lib-ver="${id}"]`);
    await p.waitForTimeout(350);
    await p.click('.lib-hoja [data-lib="editar"]');
    await p.waitForTimeout(300);
    await p.click('.lib-hoja [type="submit"]');
    await p.waitForTimeout(400);
    await p.click(".lib-hoja .budget-sheet-close");
    await p.waitForTimeout(300);
  }
  ok(true, "edita y guarda dos libros de antes sin cambiar nada");
  const subir = async (nombre, texto) => {
    await p.click('[data-limp="abrir"]');
    await p.waitForTimeout(250);
    await p.setInputFiles(".limp-hoja [data-limp-archivo]", { name: nombre, mimeType: "text/plain", buffer: Buffer.from(texto, "utf8") });
    await p.waitForTimeout(400);
  };
  await subir("goodreads_library_export.csv", GR);
  ok(/1\s*nuevo/.test(await txt(p, ".limp-hoja .limp-resumen")) && /2\s*ya los tienes/.test(await txt(p, ".limp-hoja .limp-resumen")), "importar de Goodreads: 1 nuevo y 2 que ya tienes (no los pisa)");
  await p.click('.limp-hoja [data-limp="importar"]');
  await p.waitForTimeout(600);
  await p.click(".limp-hoja .limp-listo [data-cerrar-hoja]");
  await p.waitForTimeout(300);
  await subir("My Clippings.txt", KINDLE);
  ok(/1\s*frase nueva/.test(await txt(p, ".limp-hoja .limp-resumen")) && /1\s*ya las tienes/.test(await txt(p, ".limp-hoja .limp-resumen")), "importar del Kindle: 1 frase nueva y 1 que ya tienes");
  await p.click('.limp-hoja [data-limp="importar"]');
  await p.waitForTimeout(600);
  await p.click(".limp-hoja .limp-listo [data-cerrar-hoja]");
  await p.waitForTimeout(300);

  // Medir tiempos: Mi mañana completa, plan de la mañana y un experimento.
  await irA(p, "#tiempos");
  await p.waitForTimeout(600);
  await p.click('#tmp-manana [data-tman="empezar"]');
  await p.waitForTimeout(400);
  for (let i = 0; i < 8 && !(await visible(p, ".tman-hoja .tman-resumen")); i++) {
    await avanzar(9 * 60000);
    await p.click('.tman-hoja [data-tman="siguiente"]');
    await p.waitForTimeout(300);
  }
  ok(await visible(p, ".tman-hoja .tman-resumen"), "Medir tiempos: «Mi mañana» completa, con su resumen");
  await p.click('.tman-hoja [data-tman="listo-manana"]');
  await p.waitForTimeout(500);
  await p.fill('#tmp-plan [name="levantarse"]', "05:30");
  await p.fill('#tmp-plan [name="listo"]', "08:00");
  await p.click('#tmp-plan [type="submit"]');
  await p.waitForTimeout(400);
  await p.click('#tmp-exp [data-tex="nuevo"]');
  await p.waitForTimeout(200);
  await p.fill('#tmp-exp [name="nombre"]', "Ropa lista la noche anterior");
  await p.fill('#tmp-exp [name="desde"]', "2026-11-01");
  await p.click('#tmp-exp [type="submit"]');
  await p.waitForTimeout(400);
  ok((await p.$$("#tmp-plan .tpl-linea li")).length > 2 && (await p.$$("#tmp-exp [data-tex-id]")).length === 1, "arma el plan de la mañana y empieza un experimento");
  await irA(p, "#inicio");
  ok((await p.$$("#mi-dia .md-fila")).length <= 5, "Inicio: «Mi día» con 5 filas o menos");

  // Respaldos: todo lo nuevo entra en el exportar de cada sección.
  const bajar = async (hash, sel) => {
    await irA(p, hash);
    const [d] = await Promise.all([p.waitForEvent("download"), p.click(sel)]);
    return JSON.parse(require("fs").readFileSync(await d.path(), "utf8"));
  };
  const jb = await bajar("#biblia", '[data-bib="exportar"]');
  ok(jb.versiculos.length === Object.keys(antes["users/test/biblia"]).length && jb.capitulosLeidos && jb.planes && Object.values(jb.planes.planes || jb.planes).length && jb.memorizar && Object.keys(jb.memorizar).length,
    "Exportar Biblia: tus versículos, los capítulos leídos, el plan y lo que memorizas");
  const jl = await bajar("#libros", '[data-lib="exportar"]');
  const l1x = jl.libros.find(l => l.id === "l1");
  ok(l1x && Object.keys(l1x.sesiones || {}).length === 1 && jl.frases.some(f => f.repaso) && jl.ajustes && jl.ajustes.metaPaginasDia === 30,
    "Exportar Libros: con tus sesiones, el repaso de frases y tus ajustes (meta de páginas)");
  const jt = await bajar("#tiempos", '[data-tmp-exportar="json"]');
  ok(jt.plan && jt.plan.levantarse === "5:30" && Object.keys(jt.experimentos || {}).length === 1 && jt.dias[HOY] && jt.actividades.manana,
    "Exportar Medir tiempos: tus actividades, el plan de la mañana, el experimento y tus días");

  // La comparación, documento por documento.
  const ahora = {};
  for (const c of ["biblia", "libros", "libros_frases", "tiempos", "meta"]) ahora[c] = await col(p, c);
  const faltan = [];
  ["biblia", "libros", "libros_frases", "tiempos"].forEach(c => Object.keys(antes[`users/test/${c}`]).forEach(id => { if (!ahora[c][id]) faltan.push(`${c}/${id}`); }));
  ok(!faltan.length, `no se perdió ningún documento${faltan.length ? `: ${faltan.join(", ")}` : ""}`);

  // Versículos: el editado conserva todo; los demás, idénticos.
  const vb = antes["users/test/biblia"];
  const difV = cambios(vb[versEditado], ahora.biblia[versEditado], versEditado, []);
  const otrosV = Object.keys(vb).filter(id => id !== versEditado && ahora.biblia[id] && !igual(vb[id], ahora.biblia[id]));
  ok(!difV.length && !otrosV.length, `versículos: ${Object.keys(vb).length} intactos (el editado conserva todo)${difV.concat(otrosV).length ? `: ${difV.concat(otrosV).join("; ")}` : ""}`);

  // Libros: l1 suma su sesión (cambian solo la página actual y el progreso de hoy); l2 y l3 se editaron sin cambios; los demás, idénticos.
  const lb = antes["users/test/libros"];
  const l1 = Object.assign({}, lb.l1, { paginaActual: 160 });
  const difL = ["l2", "l3"].reduce((out, id) => cambios(lb[id], ahora.libros[id], id, out), cambios(l1, ahora.libros.l1, "l1", []));
  const otrosL = Object.keys(lb).filter(id => !["l1", "l2", "l3"].includes(id) && ahora.libros[id] && !igual(lb[id], ahora.libros[id]));
  ok(!difL.length && !otrosL.length, `libros: ${Object.keys(lb).length} intactos (lo nuevo solo suma)${difL.concat(otrosL).length ? `: ${difL.concat(otrosL).join("; ")}` : ""}`);
  const s1 = Object.values(ahora.libros.l1.sesiones || {});
  ok(s1.length === 1 && s1[0].desde === 142 && s1[0].hasta === 160 && ahora.libros.l1.progreso[HOY] === 160, "y l1 tiene su sesión de hoy (de la 142 a la 160)");

  // Frases: el repaso solo suma (repaso); el texto, la página y el libro siguen igual.
  const fb = antes["users/test/libros_frases"];
  const difF = Object.keys(fb).reduce((out, id) => cambios(fb[id], ahora.libros_frases[id], id, out), []);
  ok(!difF.length, `frases: ${Object.keys(fb).length} intactas${difF.length ? `: ${difF.join("; ")}` : ""}`);

  // Tiempos: los días de antes, idénticos (ni lo que se llena solo ni Mi mañana los tocan).
  const tb = antes["users/test/tiempos"];
  const otrosT = Object.keys(tb).filter(f => !igual(tb[f], ahora.tiempos[f]));
  ok(!otrosT.length, `tiempos: tus ${Object.keys(tb).length} días de antes, idénticos${otrosT.length ? `: ${otrosT.map(f => `${f} ${JSON.stringify(ahora.tiempos[f])}`).join("; ")}` : ""}`);
  const hoy = ahora.tiempos[HOY];
  ok(hoy && hoy.seg.manana > 0, "y hoy quedó lo que mediste en Mi mañana");

  // Ajustes de Libros: tu meta y tu reto siguen.
  const difA = cambios(antes["users/test/meta"].libros_ajustes, ahora.meta.libros_ajustes, "libros_ajustes", []);
  ok(!difA.length, `ajustes de Libros (meta de páginas y reto) intactos${difA.length ? `: ${difA.join("; ")}` : ""}`);
  sinErrores(p, "todo el recorrido");
  await p.context().close();
}

// ---------- 2. Rendimiento con muchos datos ----------
function semillaGrande() {
  const e = SEM.estado(HOY, { diasTiempos: 1095 });
  const S = e.__SEED__;
  const bib = {};
  for (let i = 0; i < 1500; i++) {
    const v = SEM.VERSICULOS[i % SEM.VERSICULOS.length];
    const f = SEM.addDias(HOY, -Math.floor(i / 2) - 1);
    bib[`g${String(i).padStart(4, "0")}`] = { v: 1, fecha: f, libro: v[0], capitulo: v[1], versiculo: v[2], texto: v[3], nota: i % 5 ? "" : "Me recordó confiar más.", creado: Date.parse(`${f}T06:30:00-04:00`) + i };
  }
  S["users/test/biblia"] = bib;
  const libros = {}, frases = {};
  const generos = ["novela", "desarrollo", "historia", "fe", "negocios", "psicologia"];
  for (let i = 0; i < 400; i++) {
    const fin = SEM.addDias(HOY, -3 - i * 3);
    const estado = i < 3 ? "leyendo" : i < 340 ? "terminado" : "por_leer";
    const l = { v: 1, titulo: `Libro de prueba ${i + 1}`, autor: `Autor ${i % 60}`, paginas: 150 + ((i * 37) % 500), estado, genero: generos[i % generos.length],
      calificacion: estado === "terminado" ? 1 + (i % 5) : null, opinion: "", fechaRegistro: SEM.addDias(fin, -30),
      fechaInicio: estado === "leyendo" ? SEM.addDias(HOY, -10) : estado === "terminado" ? SEM.addDias(fin, -20) : null,
      fechaFin: estado === "terminado" ? fin : null, creado: Date.parse(`${SEM.addDias(fin, -30)}T07:00:00-04:00`), portada: null };
    if (estado === "leyendo") {
      l.paginaActual = 60 + i * 10;
      l.progreso = {};
      for (let d = 10; d >= 1; d--) l.progreso[SEM.addDias(HOY, -d)] = Math.round(l.paginaActual * (11 - d) / 10);
    }
    libros[`x${i}`] = l;
  }
  for (let i = 0; i < 3000; i++) {
    const f = SEM.addDias(HOY, -(i % 900) - 1);
    frases[`q${i}`] = { v: 1, libroId: `x${i % 400}`, texto: `Frase de prueba número ${i + 1}: lo que haces cada día importa más que lo que haces de vez en cuando.`, pagina: 1 + (i % 300), fecha: f, creado: Date.parse(`${f}T21:00:00-04:00`) + i };
  }
  S["users/test/libros"] = libros;
  S["users/test/libros_frases"] = frases;
  return e;
}
async function rendimiento(browser, base) {
  console.log("\nRendimiento con muchos datos (3 años de tiempos, 1.500 versículos, 400 libros, 3.000 frases)");
  const p = await abrir(browser, base, semillaGrande(), { hash: "#inicio", zona: ZONA, fecha: `${HOY}T07:00:00-04:00`, ancho: 390, alto: 844 });
  consola(p);
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    window.__largas = [];
    try { new PerformanceObserver(l => l.getEntries().forEach(x => window.__largas.push({ t: x.startTime, d: x.duration }))).observe({ type: "longtask", buffered: true }); } catch (err) { /* sin longtask */ }
  });
  const medir = async (hash, sel) => {
    const desde = await p.evaluate(() => performance.now());
    const t0 = Date.now();
    await p.evaluate(h => { location.hash = h; }, hash);
    await p.waitForSelector(sel, { timeout: 15000 });
    const ms = Date.now() - t0;
    await p.waitForTimeout(600);
    const larga = await p.evaluate(d => Math.round(Math.max(0, ...window.__largas.filter(x => x.t >= d).map(x => x.d))), desde);
    return { ms, larga };
  };
  const r = {};
  r.biblia = await medir("#biblia", "#bib-lista [data-bib-editar]");
  r.libros = await medir("#libros", "#lib-lista [data-lib-ver]");
  await p.click('[data-lib-vista="frases"]');
  const tf = Date.now();
  await p.waitForSelector("#lib-frases .lib-frase", { timeout: 15000 });
  r.frases = { ms: Date.now() - tf, larga: 0 };
  await p.click('[data-lib-vista="stats"]');
  const ts = Date.now();
  await p.waitForSelector('#lib-vista-stats [data-lest="calendario"] *', { timeout: 15000 });
  r.stats = { ms: Date.now() - ts, larga: 0 };
  r.tiempos = await medir("#tiempos", "#tmp-stats [data-tst-cifras]");
  console.log("  " + Object.keys(r).map(k => `${k}: ${r[k].ms} ms${r[k].larga ? ` (tarea más larga ${r[k].larga} ms)` : ""}`).join(" · "));
  ok(r.biblia.ms < 1500, `Biblia con 1.500 versículos se ve en ${r.biblia.ms} ms (< 1,5 s)`);
  ok(r.libros.ms < 1500, `Libros con 400 libros se ve en ${r.libros.ms} ms (< 1,5 s)`);
  ok(r.frases.ms < 1500, `Frases con 3.000 frases se ve en ${r.frases.ms} ms (< 1,5 s)`);
  ok(r.stats.ms < 1500, `Estadísticas de Libros en ${r.stats.ms} ms (< 1,5 s)`);
  ok(r.tiempos.ms < 1500, `Medir tiempos con 3 años se ve en ${r.tiempos.ms} ms (< 1,5 s)`);
  const peor = Math.max(r.biblia.larga, r.libros.larga, r.tiempos.larga);
  ok(peor < 500, `ninguna pausa larga de la pantalla (la peor: ${peor} ms, < 0,5 s)`);
  // "Tus días": los 90 más nuevos y "Ver 90 días más".
  const nDias = await p.$$eval("#tmp-dias .tmp-dia", els => els.length);
  ok(nDias === 90 && /Ver 90 días más/.test(await txt(p, "#tmp-dias [data-tmp-mas]")), `«Tus días»: los 90 más nuevos y «Ver 90 días más» (${nDias})`);
  await p.click("#tmp-dias [data-tmp-mas]");
  await p.waitForTimeout(200);
  ok((await p.$$("#tmp-dias .tmp-dia")).length === 180, "«Ver 90 días más» trae los 90 anteriores");
  // Mi mañana y el plan con 3 años de datos.
  const tm = Date.now();
  await p.click('#tmp-manana [data-tman="empezar"]');
  await p.waitForSelector(".tman-hoja .tman-reloj", { timeout: 15000 });
  const msM = Date.now() - tm;
  ok(msM < 1000, `«Mi mañana» abre en ${msM} ms (< 1 s)`);
  sinErrores(p, "con muchos datos");
  await p.context().close();
}

// ---------- 3. A 320 px ----------
// Algo visible que se sale de la pantalla (fuera de las filas que se deslizan de lado).
const seSale = p => p.evaluate(() => {
  const anchoV = document.documentElement.clientWidth;
  const desliza = el => { for (let x = el.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; } return false; };
  const fuera = Array.from(document.querySelectorAll("body *")).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > anchoV + 1 && getComputedStyle(el).visibility !== "hidden" && !desliza(el);
  });
  return fuera.slice(0, 3).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
});
async function angosto(browser, base) {
  console.log("\nA 320 px (el iPhone más angosto)");
  const e = SEM.estado(HOY);
  e.__SEED__["users/test/meta"] = Object.assign({}, e.__SEED__["users/test/meta"], { tiempos_ajustes: { v: 1, plan: { levantarse: "5:30", listo: "8:00" },
    experimentos: { e1: { nombre: "Ropa lista la noche anterior", desde: "2026-11-01", nota: "", hasta: null, creado: 1 } } } });
  const p = await abrir(browser, base, e, { hash: "#biblia", zona: ZONA, relojFalso: `${HOY}T06:00:00-04:00`, ancho: 320, alto: 640 });
  consola(p);
  await p.waitForTimeout(1200);
  const revisar = async donde => {
    const fuera = await seSale(p);
    ok(await sinDesborde(p) && !fuera.length, `${donde}: no se mueve de lado${fuera.length ? ` (${fuera.join(", ")})` : ""}`);
  };
  await revisar("Biblia");
  await p.click('[data-bib="leer"]');
  await p.waitForTimeout(700);
  await revisar("el lector");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(400);
  for (const [h, n] of [["#biblia-planes", "Planes"], ["#biblia-progreso", "Progreso"], ["#biblia-memorizar", "Memorizar"]]) { await irA(p, h); await revisar(n); }
  await irA(p, "#libros");
  await revisar("Libros");
  await p.click('#lib-leyendo [data-lses-leer="l1"]');
  await p.waitForTimeout(300);
  await revisar("«Leer ahora»");
  await p.click(".lib-hoja-sesion .budget-sheet-close");
  await p.waitForTimeout(300);
  await p.click('[data-lib-vista="frases"]');
  await p.waitForTimeout(300);
  await revisar("Frases");
  await p.click('[data-lib-vista="stats"]');
  await p.waitForTimeout(500);
  await revisar("Estadísticas de Libros");
  await p.click('[data-lib-vista="libros"]');
  await irA(p, "#tiempos");
  await p.waitForTimeout(500);
  await revisar("Medir tiempos (plan, estadísticas, experimentos)");
  await p.click('#tmp-manana [data-tman="empezar"]');
  await p.waitForTimeout(400);
  await revisar("«Mi mañana»");
  await p.click(".tman-hoja .budget-sheet-close");
  await p.waitForTimeout(300);
  await irA(p, "#inicio");
  await revisar("Inicio con «Mi día»");
  sinErrores(p, "a 320 px");
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const SOLO = process.env.SOLO;   // intactos | rendimiento | angosto
  if (!SOLO || SOLO === "intactos") await intactos(browser, base);
  if (!SOLO || SOLO === "rendimiento") await rendimiento(browser, base);
  if (!SOLO || SOLO === "angosto") await angosto(browser, base);
  await terminar(browser, srv);
})();
