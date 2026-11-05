// Pruebas de pantalla de "Mi día" en Inicio (js/mi-dia.js, D-100): con
// entrenos, carreras, hábitos, Biblia y presupuesto; ocultar y mostrar;
// sin datos no aparece. A 390 y 1280 px. Uso:
//   node scripts/e2e/mi-dia.js [carpeta-para-capturas]
const fs = require("fs");
const path = require("path");
const { chromium, servidor, abrir, ok, terminar } = require("./comun.js");
const SEM = require("./ejercicio-semilla.js");
const HSEM = require("./habitos-semilla.js");

const CAPTURAS = process.argv[2] || null;
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });
const HOY = "2026-11-05";
const FECHA = `${HOY}T09:30:00-04:00`;
const ZONA = "America/La_Paz";
const texto = (p, sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim()).catch(() => "");

function semilla() {
  const seed = SEM.estado(HOY).__SEED__;
  const h = HSEM.estado(HOY).__SEED__;
  seed["users/test/habitos"] = h["users/test/habitos"];
  seed["users/test/meta"].habitos_juego = h["users/test/meta"].habitos_juego;
  seed["users/test/biblia"] = {
    b1: { fecha: "2026-11-04", libro: "Juan", capitulo: 3, versiculo: "16", texto: "Porque de tal manera amó Dios al mundo…", creado: 1 },
    b2: { fecha: "2026-11-03", libro: "Salmos", capitulo: 23, versiculo: "1", texto: "El Señor es mi pastor…", creado: 2 }
  };
  seed["users/test/meta"].presupuestos = { comida: 1500, transporte: 400, sueldo: 6000 };
  seed["users/test/finanzas"] = {
    f1: { date: "2026-11-02", type: "gasto", category: "comida", amount: 120, note: "" },
    f2: { date: "2026-11-01", type: "ingreso", category: "sueldo", amount: 6000, note: "" }
  };
  return { __SEED__: seed };
}

async function probar(browser, base, ancho) {
  console.log(`\nMi día (${ancho} px)`);
  const alto = ancho > 800 ? 900 : 844;
  let p = await abrir(browser, base, semilla(), { hash: "", zona: ZONA, fecha: FECHA, ancho, alto });
  const errores = [];
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errores.push(m.text()); });
  await p.waitForTimeout(1800);
  ok(await p.isVisible("#mi-dia"), "Inicio muestra «Mi día» arriba");
  ok(/^Mi día · jueves 5 nov/i.test(await texto(p, "#mi-dia .md-eyebrow")) && /^Te quedan 2 cosas por hoy\.$/.test(await texto(p, "#mi-dia-t")), `con el día y cuántas cosas faltan (${await texto(p, "#mi-dia-t")})`);
  const filas = await p.$$eval("#mi-dia .md-fila", as => as.map(a => ({ id: a.dataset.md, href: a.getAttribute("href"), clase: a.className, t: a.textContent.replace(/\s+/g, " ").trim(), alto: a.getBoundingClientRect().height })));
  ok(filas.map(f => f.id).join(",") === "entreno,habitos,biblia,dinero,running", `5 filas: ${filas.map(f => f.id).join(", ")}`);
  ok(/^Mejor hoy: Empuje\s*En vez de Pierna\. Ayer corriste 18 km/.test(filas[0].t) && /is-aviso/.test(filas[0].clase), "entrenar: tras la carrera larga, Empuje en vez de Pierna");
  ok(/^Hábitos: \d+ de \d+\s*Faltan: /.test(filas[1].t) && /is-pendiente/.test(filas[1].clase), `hábitos: ${filas[1].t.slice(0, 50)}…`);
  ok(/^Anota el versículo de hoy\s*Llevas 2 días seguidos/.test(filas[2].t), "Biblia: el versículo de hoy y la racha");
  ok(/^Para gastar hoy: Bs \d+/.test(filas[3].t) && /Quedan \d+ días del periodo/.test(filas[3].t), `dinero: ${filas[3].t}`);
  ok(/^Running: 24 km esta semana\s*Última: ayer, 18 km\.$/.test(filas[4].t), `running: ${filas[4].t}`);
  ok(filas.every(f => f.alto >= 44), `filas de ≥ 44 px (${Math.min(...filas.map(f => Math.round(f.alto)))})`);
  ok(filas.map(f => f.href).join(",") === "#ejercicio,#habitos,#biblia,#fin-presupuesto,#running", "cada fila lleva a su sección");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin scroll de costado");
  if (CAPTURAS) await (await p.$("#mi-dia")).screenshot({ path: path.join(CAPTURAS, `mi-dia-${ancho}.png`) });
  await p.click('#mi-dia [data-md="entreno"]');
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => location.hash) === "#ejercicio" && /Mejor hoy: Empuje/.test(await texto(p, "#ej-hoy")), "tocar «Entrenar» abre Entrenamiento con la misma sugerencia");
  await p.evaluate(() => { location.hash = ""; });
  await p.waitForTimeout(600);

  // Ocultar y mostrar (se recuerda en el teléfono).
  await p.click("#mi-dia [data-md-ocultar]");
  await p.waitForTimeout(300);
  ok(!(await p.isVisible("#mi-dia")) && await p.isVisible("#mi-dia-mostrar"), "«Ocultar «Mi día»» la quita y aparece «Mostrar «Mi día»» al pie");
  await p.reload();
  await p.waitForTimeout(1800);
  ok(!(await p.isVisible("#mi-dia")) && await p.isVisible("#mi-dia-mostrar"), "sigue oculta al volver a abrir");
  await p.click("#mi-dia-mostrar");
  await p.waitForTimeout(400);
  ok(await p.isVisible("#mi-dia") && !(await p.isVisible("#mi-dia-mostrar")), "«Mostrar «Mi día»» la trae de vuelta");
  ok(await p.isVisible(".card-grid-home") && (await p.$$(".card-grid-home .card")).length === 10, "las tarjetas de siempre siguen debajo");
  ok(!p.errores.length && !errores.length, `sin errores (${errores.join(" | ")})`);
  await p.context().close();

  // Sin datos: no aparece.
  p = await abrir(browser, base, { __SEED__: {} }, { hash: "", zona: ZONA, fecha: FECHA, ancho, alto });
  await p.waitForTimeout(1500);
  ok(!(await p.isVisible("#mi-dia")) && !(await p.isVisible("#mi-dia-mostrar")), "sin datos, «Mi día» no aparece");
  ok(!p.errores.length, "sin errores");
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [390, 1280]) await probar(browser, base, ancho);
  await terminar(browser, srv);
})();
