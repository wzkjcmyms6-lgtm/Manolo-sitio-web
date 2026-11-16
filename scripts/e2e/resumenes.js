// Pruebas de pantalla de "Tu semana" y "Tu año" (D-136, docs/RESUMENES.md).
// Fase 1: los datos de todas las secciones llegan al motor sin leer nada
// nuevo (lo que cada sección ya tiene en memoria) y Finanzas solo cuenta
// gastos e ingresos (sin transferencias ni lo excluido).
// Fase 2: "Tu semana" (la tarjeta de Inicio los lunes, la pantalla, ‹ ›,
// compartir, «Listo», el menú; miércoles y sin datos).
// Fase 3: el contenido de "Tu año" con los datos de la app (con el Wrapped
// de Hábitos y "Tu año en libros").
// Fase 4: "Tu año" en diapositivas (la tarjeta de diciembre y enero, todas
// las diapositivas sin salirse, compartir cada una y el año, «Verlo otra
// vez», tocar para avanzar, el Wrapped de Hábitos, «Ahora no», el menú ☰,
// sin datos; 390 × 844 y 320 × 568).
// Uso: node scripts/e2e/resumenes.js [carpeta-para-capturas]
const fs = require("fs");
const { chromium, servidor, abrir, ok, terminar } = require("./comun.js");
const SEM = require("./ejercicio-semilla.js");
const HSEM = require("./habitos-semilla.js");
const LSEM = require("./lectura-semilla.js");

const CAPTURAS = process.argv[2] || null;
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });
const HOY = "2026-11-16";            // lunes
const FECHA = `${HOY}T09:30:00-04:00`;
const ZONA = "America/La_Paz";
const SEMANA = "2026-11-09";         // la semana que terminó ayer
const dia = n => SEM.addDias(SEMANA, n);

function semilla() {
  const seed = SEM.estado(HOY).__SEED__;
  const h = HSEM.estado(HOY).__SEED__;
  const l = LSEM.estado(HOY).__SEED__;
  seed["users/test/habitos"] = h["users/test/habitos"];
  seed["users/test/biblia"] = l["users/test/biblia"];
  seed["users/test/libros"] = l["users/test/libros"];
  seed["users/test/libros_frases"] = l["users/test/libros_frases"];
  seed["users/test/tiempos"] = l["users/test/tiempos"];
  Object.assign(seed["users/test/meta"], h["users/test/meta"], l["users/test/meta"], {
    biblia_leidos: { dias: { [dia(0)]: ["John.1", "John.2"], [dia(3)]: ["Ps.23"] } }
  });
  seed["users/test/finanzas"] = {
    f1: { date: dia(1), type: "gasto", category: "comida", amount: 120.5, note: "" },
    f2: { date: dia(2), type: "gasto", category: "transporte", amount: 30, note: "" },
    f3: { date: dia(4), type: "ingreso", category: "sueldo", amount: 6000, note: "" },
    f4: { date: dia(4), type: "transferencia", category: "transferencia", amount: 500, payment: "debito", paymentTo: "efectivo", note: "" },
    f5: { date: dia(5), type: "gasto", category: "comida", amount: 80, excluded: true, note: "" }
  };
  seed["users/test/bicicleta"] = {
    c1: { date: dia(5), distance: 32.5, duration: 95, notes: "" },
    c2: { date: dia(-10), distance: 20, duration: 60, notes: "" }
  };
  seed["users/test/movilidad"] = {
    m1: { v: 1, rutinaId: "cuello", nombre: "Cuello y hombros", fecha: dia(1), completada: 1, duracionSeg: 600, saltados: 0 },
    m2: { v: 1, rutinaId: "cadera", nombre: "Cadera", fecha: dia(3), completada: 2, duracionSeg: 900, saltados: 0 }
  };
  seed["users/test/lugares"] = {
    p1: { v: 1, nombre: "Café del Sol", estado: "visitado", calificacion: 5, volveria: "si", tipo: "cafe", zona: "Sopocachi",
      visitas: { x1: { fecha: dia(6), conQuien: "", gastoCent: 4500, nota: "", creado: 1 } }, creado: 1, actualizado: 1 }
  };
  return { __SEED__: seed };
}

async function fase1(browser, base) {
  console.log("\nResúmenes, fase 1: los datos de todas las secciones");
  const p = await abrir(browser, base, semilla(), { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho: 390 });
  await p.waitForTimeout(2200);
  const r = await p.evaluate(sem => {
    const d = window.ResumenFuentes.datos();
    const s = window.ResumenMotor.semana(d, sem);
    const n = x => (x == null ? null : Array.isArray(x) ? x.length : x);
    return {
      hoy: d.hoy,
      secciones: Object.keys(d).filter(k => k !== "hoy" && d[k] != null),
      cuentas: { running: n(d.running), bici: n(d.bici), gimnasio: n(d.gimnasio), movilidad: n(d.movilidad), lugares: n(d.lugares),
        habitos: d.habitos ? Object.keys(d.habitos.dias).length : null, libros: d.libros ? d.libros.terminados.length : null,
        caps: d.biblia ? d.biblia.caps.length : null, vers: d.biblia ? d.biblia.vers.length : null, manana: n(d.manana) },
      finanzas: d.finanzas,
      gim0: d.gimnasio && d.gimnasio[0],
      areas: s.areas.map(a => [a.id, a.linea]),
      titular: s.titular
    };
  }, SEMANA);
  ok(r.hoy === HOY, "hoy es el del teléfono");
  ok(["running", "bici", "gimnasio", "movilidad", "habitos", "libros", "biblia", "finanzas", "manana", "lugares"].every(k => r.secciones.includes(k)),
    `llegan las 10 secciones (${r.secciones.join(", ")})`);
  ok(r.cuentas.bici === 2 && r.cuentas.movilidad === 2 && r.cuentas.lugares === 1 && r.cuentas.caps === 3, `bici, movilidad, lugares y capítulos (${JSON.stringify(r.cuentas)})`);
  ok(r.cuentas.running > 0 && r.cuentas.gimnasio > 0 && r.cuentas.habitos > 0 && r.cuentas.vers > 0 && r.cuentas.manana > 0, "running, gimnasio, hábitos, versículos y Mi mañana");
  ok(r.gim0 && r.gim0.series > 0 && r.gim0.volumen > 0 && typeof r.gim0.nombre === "string", `gimnasio con series y kg (${r.gim0 && `${r.gim0.series} series, ${r.gim0.volumen} kg`})`);
  const fz = r.finanzas;
  ok(fz && fz.movs.length === 3 && !fz.movs.some(m => m.cent === 50000 || m.cent === 8000), "Finanzas: sin la transferencia ni lo excluido del presupuesto");
  ok(fz && fz.movs.some(m => m.tipo === "gasto" && m.cent === 12050 && m.cat === "comida") && fz.cats.comida === "Comida", "en centavos y con el nombre de la categoría");
  const area = id => (r.areas.find(a => a[0] === id) || [])[1] || "";
  ok(area("bici") === "32,5 km · 1 rodada · 1:35 h", `Bici en la semana: ${area("bici")}`);
  ok(area("movilidad") === "2 rutinas · 25 min", `Movilidad: ${area("movilidad")}`);
  ok(/^Bs 151 gastados · Bs 6\.000 de ingresos · \d días sin gastar$/.test(area("finanzas")), `Finanzas: ${area("finanzas")}`);
  ok(/^1 visita · 1 lugar nuevo$/.test(area("lugares")), `Lugares: ${area("lugares")}`);
  ok(/^\d+ de 7 días · 3 capítulos/.test(area("biblia")), `Biblia: ${area("biblia")}`);
  ok(r.titular.length > 20, `titular: ${r.titular}`);
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---- Fase 2 (D-138): "Tu semana" ----
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function fase2(browser, base, ancho) {
  console.log(`\nResúmenes, fase 2: «Tu semana» (${ancho} px)`);
  let p = await abrir(browser, base, semilla(), { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(2200);
  const tarjeta = await txt(p, "#sem-inicio");
  ok(await p.isVisible("#sem-inicio") && /^Tu semana · 9 – 15 nov /i.test(tarjeta), `lunes: la tarjeta de la semana que terminó (${tarjeta.slice(0, 60)}…)`);
  const cifras = await p.$$eval("#sem-inicio .sem-ini-cifras div", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(cifras.length === 3 && !cifras.some(c => /Bs/.test(c)), `3 cifras, sin dinero (${cifras.join(" | ")})`);
  const esperado = await p.evaluate(() => window.ResumenMotor.semana(window.ResumenFuentes.datos(), "2026-11-09"));
  ok(tarjeta.includes(esperado.titular), "con el titular de la semana");
  if (CAPTURAS) await (await p.$("#sem-inicio")).screenshot({ path: `${CAPTURAS}/semana-inicio-${ancho}.png` });

  await p.click("#sem-inicio a[href='#semana/2026-11-09']");
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === "#semana/2026-11-09" && await p.isVisible("#panel-semana"), "«Ver mi semana» abre la pantalla");
  ok(/^9 – 15 nov La semana pasada$/.test(await txt(p, ".sem-nav-t")), `arriba, la semana (${await txt(p, ".sem-nav-t")})`);
  ok((await txt(p, ".sem-titular")) === esperado.titular, "el titular");
  const areas = await p.$$eval(".sem-area", els => els.map(e => ({ href: e.getAttribute("href"), t: e.innerText.replace(/\s+/g, " ").trim() })));
  ok(areas.length === esperado.areas.length && areas.length >= 8, `cada área (${areas.length})`);
  ok(areas.some(a => a.href === "#bicicleta" && /^Bici 32,5 km · 1 rodada · 1:35 h/.test(a.t)) && areas.some(a => a.href === "#finanzas"), "cada una lleva a su sección");
  ok((await p.$$(".sem-lista li")).length === esperado.mejor.length + esperado.atras.length, "lo mejor y lo que se quedó atrás");
  ok(!esperado.sugerencia || (await txt(p, ".sem-sug")).includes(esperado.sugerencia.texto), "y la sugerencia para esta semana");
  if (CAPTURAS) await p.screenshot({ path: `${CAPTURAS}/semana-${ancho}.png`, fullPage: true });
  ok((await sobra(p)) <= 0, "nada se sale de ancho");

  // ‹ › para ir a otras semanas.
  await p.click(".sem-nav a[aria-label='Semana anterior']");
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => location.hash) === "#semana/2026-11-02" && /^2 – 8 nov$/.test(await txt(p, ".sem-nav-t")), "‹ la semana anterior");
  ok(!(await p.$(".sem-sug")), "una semana vieja no trae sugerencia");
  await p.click(".sem-nav a[aria-label='Semana siguiente']");
  await p.waitForTimeout(300);
  await p.click(".sem-nav a[aria-label='Semana siguiente']");
  await p.waitForTimeout(400);
  ok(/^16 – 22 nov Esta semana, hasta el lunes$/.test(await txt(p, ".sem-nav-t")) && await p.$(".sem-nav .sem-flecha.is-off") !== null, "› hasta esta semana; más allá no");

  // Compartir: una imagen (aquí se descarga, en el iPhone abre el menú de compartir).
  // Armar un PNG de 1080 × 1920 con la máquina ocupada puede tardar: hasta 15 s.
  await p.goto(`${base}/index.html#semana/2026-11-09`);
  await p.waitForTimeout(1800);
  const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.click("[data-sem-compartir]")]);
  ok(descarga && descarga.suggestedFilename() === "mi-semana-2026-11-09.png", `«Compartir mi semana»: la imagen (${descarga && descarga.suggestedFilename()})`);
  if (CAPTURAS && descarga) await descarga.saveAs(`${CAPTURAS}/semana-imagen.png`);

  // Inicio: «Listo» la oculta (y no vuelve hasta el lunes siguiente).
  await p.evaluate(() => { location.hash = "#inicio"; });
  await p.waitForTimeout(500);
  await p.click("[data-sem-listo]");
  await p.waitForTimeout(300);
  ok(!(await p.isVisible("#sem-inicio")), "«Listo» la oculta");
  await p.reload();
  await p.waitForTimeout(2000);
  ok(!(await p.isVisible("#sem-inicio")), "y sigue oculta al volver");
  ok(await p.$("#nav-links a[href='#semana']") !== null && await p.$(".inicio-pie a[href='#semana']") !== null, "«Tu semana» en el menú ☰ y al pie de Inicio");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();

  // Miércoles: sin tarjeta; la pantalla muestra la semana que va.
  p = await abrir(browser, base, semilla(), { hash: "#inicio", zona: ZONA, fecha: "2026-11-18T09:30:00-04:00", ancho });
  await p.waitForTimeout(2000);
  ok(!(await p.isVisible("#sem-inicio")), "miércoles: Inicio no muestra la tarjeta");
  await p.click(".inicio-pie a[href='#semana']");
  await p.waitForTimeout(500);
  ok(/^16 – 22 nov Esta semana, hasta el miércoles$/.test(await txt(p, ".sem-nav-t")) && /^Tu semana hasta hoy: /.test(await txt(p, ".sem-titular")), "la pantalla abre en la semana que va");
  await p.context().close();

  // Sin datos: ni tarjeta ni áreas.
  p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho });
  await p.waitForTimeout(1500);
  ok(!(await p.isVisible("#sem-inicio")), "sin datos, no hay tarjeta");
  await p.evaluate(() => { location.hash = "#semana"; });
  await p.waitForTimeout(500);
  ok(/No hay nada anotado esta semana/.test(await txt(p, "#sem-app")) && !(await p.$("[data-sem-compartir]")), "y la pantalla lo dice (sin «Compartir»)");
  ok(!p.errores.length, "sin errores de página");
  await p.context().close();
}

// ---- Fase 3 (D-139): el contenido de "Tu año" ----
async function fase3(browser, base) {
  console.log("\nResúmenes, fase 3: el contenido de «Tu año»");
  const p = await abrir(browser, base, semilla(), { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho: 390 });
  await p.waitForTimeout(2200);
  const r = await p.evaluate(() => {
    const d = window.ResumenFuentes.datos({ anio: 2026 });
    const y = window.ResumenAnio.anio(d, 2026);
    const S = y.secciones;
    return {
      anios: window.ResumenAnio.aniosConDatos(d), completo: y.completo, hasta: y.hasta, secciones: Object.keys(S),
      wrapped: !!(d.extras && d.extras.habitos), librosExtra: !!(d.extras && d.extras.libros),
      habitos: S.habitos && { pct: S.habitos.pct, conWrapped: S.habitos.conWrapped, estrella: S.habitos.estrella },
      libros: S.libros && { terminados: S.libros.terminados, delAnio: S.libros.libroDelAnio },
      librosEst: window.LibrosEstadisticas.anio(window.LibrosDatos.lista(), window.LibrosDatos.frases(), 2026).terminados,
      biblia: S.biblia && { capitulos: S.biblia.capitulos, libroTop: S.biblia.libroTop },
      numeros: y.numeros.map(n => `${n.valor} ${n.etiqueta}`), destacados: y.destacados.map(x => x.texto),
      finanzas: S.finanzas && { pct: S.finanzas.pctAhorro }
    };
  });
  ok(r.anios[0] === 2026 && r.completo === false && r.hasta === HOY, `2026, hasta hoy (años con datos: ${r.anios.join(", ")})`);
  ok(["habitos", "gimnasio", "running", "bici", "movilidad", "libros", "biblia", "finanzas", "manana", "lugares"].every(k => r.secciones.includes(k)), `las 10 secciones (${r.secciones.join(", ")})`);
  ok(r.wrapped && r.habitos.conWrapped && r.habitos.estrella && r.habitos.estrella.nombre, `Hábitos con su Wrapped (estrella: ${r.habitos.estrella && r.habitos.estrella.nombre})`);
  ok(r.librosExtra && r.libros.terminados === r.librosEst, `Libros con «Tu año en libros» (${r.libros.terminados} terminados)`);
  ok(r.biblia.capitulos === 3 && r.biblia.libroTop && r.biblia.libroTop.nombre === "Juan", `Biblia con el nombre del libro (${r.biblia.libroTop && r.biblia.libroTop.nombre})`);
  ok(/días con algo anotado$/.test(r.numeros[0]) && r.numeros.length >= 6, `el año en números (${r.numeros.slice(0, 3).join(" · ")}…)`);
  ok(r.destacados.length && !r.destacados.some(t => /Bs|gast|ahorr/i.test(t)), "lo destacado, sin dinero");
  ok(r.finanzas && r.finanzas.pct > 0, "Finanzas: cuánto ahorraste de lo que ganaste");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---- Fase 4: «Tu año» en diapositivas (D-140) ----
async function recorrer(p) {
  // De la primera a la última con la flecha del teclado; por cada una: su id,
  // si tiene «Compartir», si algo se sale a lo ancho y si el principio se ve.
  const vistas = [];
  for (let k = 0; k < 30; k++) {
    vistas.push(await p.evaluate(() => {
      const el = document.querySelector(".anio-wrapped"), sl = el.querySelector(".hb-wr-slide");
      const r = sl.getBoundingClientRect(), primero = sl.firstElementChild.getBoundingClientRect();
      const ancho = [...sl.querySelectorAll("*")].some(x => x.getBoundingClientRect().right > innerWidth + 1);
      return { id: el.dataset.diapo, cuenta: el.querySelector(".hb-wr-cuenta").textContent, compartir: !!sl.querySelector("[data-anio-compartir]"),
        texto: sl.innerText.replace(/\s+/g, " ").trim(), ancho, arriba: primero.top >= r.top - 1, desliza: sl.scrollHeight > sl.clientHeight + 1 };
    }));
    const [a, b] = vistas[vistas.length - 1].cuenta.split(" de ").map(Number);
    if (a === b) break;
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(120);
  }
  return vistas;
}
async function fase4(browser, base, ancho, alto) {
  console.log(`\nResúmenes, fase 4: «Tu año» en diapositivas (${ancho} × ${alto})`);
  // Diciembre: la tarjeta en Inicio (del año que va, «hasta hoy»).
  let p = await abrir(browser, base, semilla(), { hash: "#inicio", zona: ZONA, fecha: "2026-12-02T09:30:00-04:00", ancho, alto });
  await p.waitForTimeout(2200);
  ok(await p.isVisible("#anio-inicio") && /Tu 2026 en Manolo, hasta hoy/.test(await txt(p, "#anio-inicio")), `diciembre: la tarjeta «Tu año» en Inicio (${await txt(p, "#anio-inicio")})`);
  await p.click("#anio-inicio [data-anio-abrir]");
  await p.waitForTimeout(600);
  ok(await p.isVisible(".anio-wrapped") && /Tu 2026 en Manolo/.test(await txt(p, ".anio-wrapped .hb-wr-slide")) && /Toca a la derecha/.test(await txt(p, ".anio-wrapped .hb-wr-slide")), "«Ver mi año» abre la portada a pantalla completa");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.matches(".anio-wrapped .hb-wr-cerrar")), "el foco queda en «Cerrar»");
  if (CAPTURAS) await p.screenshot({ path: `${CAPTURAS}/anio-portada-${ancho}.png` });
  const vs = await recorrer(p);
  const ids = vs.map(v => v.id);
  ok(ids[0] === "portada" && ids[ids.length - 1] === "cierre" && ["numeros", "habitos", "gimnasio", "running", "bici", "libros", "biblia", "finanzas", "lugares"].every(x => ids.includes(x)), `todas las diapositivas (${ids.join(", ")})`);
  ok(vs.every(v => !v.ancho), `nada se sale a lo ancho${vs.filter(v => v.ancho).map(v => `: ${v.id}`).join("")}`);
  ok(vs.every(v => v.arriba), `el principio de cada una se ve${vs.filter(v => !v.arriba).map(v => `: ${v.id}`).join("")}`);
  ok(vs.filter(v => !["portada", "cierre"].includes(v.id)).every(v => v.compartir) && !vs.find(v => v.id === "portada").compartir, "«Compartir» en cada diapositiva (menos la portada y el cierre)");
  const fin = vs.find(v => v.id === "finanzas");
  ok(fin && /Solo para ti/.test(fin.texto) && !/Bs\s?\d/.test(fin.texto), "Finanzas: «Solo para ti» y sin montos");
  ok(/km corriendo/.test(vs.find(v => v.id === "running").texto), "Running con sus km");
  if (CAPTURAS) await p.screenshot({ path: `${CAPTURAS}/anio-cierre-${ancho}.png` });
  // El cierre: «Compartir tu año» (la imagen) y «Verlo otra vez».
  const [d1] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.click("[data-anio-compartir-todo]")]);
  ok(d1 && d1.suggestedFilename() === "mi-2026-en-manolo.png", `«Compartir tu año»: la imagen (${d1 && d1.suggestedFilename()})`);
  if (CAPTURAS && d1) await d1.saveAs(`${CAPTURAS}/anio-imagen-${ancho}.png`);
  await p.click("[data-anio-ir='0']");
  await p.waitForTimeout(300);
  ok((await p.$eval(".anio-wrapped", el => el.dataset.diapo)) === "portada", "«Verlo otra vez» vuelve a la portada");
  // Tocar a la derecha avanza; a la izquierda, vuelve.
  await p.mouse.click(ancho - 30, Math.round(alto / 2));
  await p.waitForTimeout(250);
  const tras = await p.$eval(".anio-wrapped", el => el.dataset.diapo);
  await p.mouse.click(20, Math.round(alto / 2));
  await p.waitForTimeout(250);
  ok(tras === ids[1] && (await p.$eval(".anio-wrapped", el => el.dataset.diapo)) === "portada", `tocar a la derecha avanza (${tras}) y a la izquierda vuelve`);
  // Compartir una diapositiva: la de Running.
  for (let k = 0; k < ids.indexOf("running"); k++) await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(250);
  const [d2] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.click("[data-anio-compartir]")]);
  ok(d2 && d2.suggestedFilename() === "mi-2026-running.png", `«Compartir» una diapositiva (${d2 && d2.suggestedFilename()})`);
  if (CAPTURAS && d2) await d2.saveAs(`${CAPTURAS}/anio-running-${ancho}.png`);
  // Hábitos: «Ver tu año en hábitos» abre el Wrapped de Hábitos.
  for (let k = 0; k < 20 && (await p.$eval(".anio-wrapped", el => el.dataset.diapo)) !== "habitos"; k++) await p.keyboard.press("ArrowLeft");
  await p.waitForTimeout(250);
  await p.click("[data-anio-hab]");
  await p.waitForTimeout(600);
  ok(!(await p.$(".anio-wrapped")) && await p.isVisible(".hb-wrapped") && /hábitos/i.test(await p.$eval(".hb-wrapped", el => el.getAttribute("aria-label"))), "«Ver tu año en hábitos» abre el de Hábitos");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  ok(!(await p.$(".hb-wrapped")) && !(await p.evaluate(() => document.body.classList.contains("sheet-open"))), "Escape lo cierra y la página vuelve a moverse");
  // «Ahora no»: la tarjeta no vuelve ese año.
  await p.click("#anio-inicio [data-anio-listo]");
  await p.waitForTimeout(300);
  ok(!(await p.isVisible("#anio-inicio")), "«Ahora no» oculta la tarjeta");
  await p.reload();
  await p.waitForTimeout(2000);
  ok(!(await p.isVisible("#anio-inicio")) && await p.$(".inicio-pie [data-anio-abrir]") !== null, "y sigue oculta al volver («Tu año» queda al pie de Inicio)");
  // El menú ☰: abre «Tu año», el menú se cierra y al salir el foco vuelve al botón del menú.
  if (ancho <= 768) {
    await p.click("#menu-toggle");
    await p.waitForTimeout(350);
    await p.click("#nav-links [data-anio-abrir]");
    await p.waitForTimeout(600);
    ok(await p.isVisible(".anio-wrapped") && !(await p.$eval("#sidebar", el => el.classList.contains("open"))), "menú ☰ › «Tu año» lo abre y el menú se cierra");
    await p.click(".anio-wrapped .hb-wr-cerrar");
    await p.waitForTimeout(400);
    ok(!(await p.$(".anio-wrapped")) && await p.evaluate(() => document.activeElement && document.activeElement.id === "menu-toggle"), "al cerrar, el foco vuelve al botón del menú");
  }
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();

  // Enero: la tarjeta es del año que terminó (sin «hasta hoy»); noviembre: sin tarjeta.
  p = await abrir(browser, base, semilla(), { hash: "#inicio", zona: ZONA, fecha: "2027-01-10T09:30:00-04:00", ancho, alto });
  await p.waitForTimeout(2200);
  const ene = await txt(p, "#anio-inicio");
  ok(await p.isVisible("#anio-inicio") && /Tu 2026 en Manolo/.test(ene) && !/hasta hoy/.test(ene), `enero: la tarjeta del año que terminó (${ene})`);
  await p.click("#anio-inicio [data-anio-abrir]");
  await p.waitForTimeout(600);
  ok(/Un año entero/.test(await txt(p, ".anio-wrapped .hb-wr-slide")), "y la portada dice que es el año entero");
  await p.context().close();
  p = await abrir(browser, base, semilla(), { hash: "#inicio", zona: ZONA, fecha: FECHA, ancho, alto });
  await p.waitForTimeout(2000);
  ok(!(await p.isVisible("#anio-inicio")), "noviembre: sin tarjeta (está en el menú y al pie)");
  await p.context().close();

  // Sin datos: la portada y un cierre que invita a empezar.
  p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio", zona: ZONA, fecha: "2026-12-02T09:30:00-04:00", ancho, alto });
  await p.waitForTimeout(1800);
  ok(!(await p.isVisible("#anio-inicio")), "sin datos: sin tarjeta");
  await p.click(".inicio-pie [data-anio-abrir]");
  await p.waitForTimeout(500);
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(250);
  ok(/todavía está en blanco/.test(await txt(p, ".anio-wrapped .hb-wr-slide")) && (await txt(p, ".anio-wrapped .hb-wr-cuenta")) === "2 de 2", "y «Tu año» dice que todavía está en blanco");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await fase1(browser, base);
  for (const ancho of [390, 320]) await fase2(browser, base, ancho);
  await fase3(browser, base);
  for (const [ancho, alto] of [[390, 844], [320, 568]]) await fase4(browser, base, ancho, alto);
  await terminar(browser, srv);
})();
