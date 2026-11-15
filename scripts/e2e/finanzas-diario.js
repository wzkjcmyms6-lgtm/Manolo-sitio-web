// Pruebas de pantalla de Finanzas › "Disponible por día" según lo que
// realmente entró (D-116). Uso: node scripts/e2e/finanzas-diario.js [carpeta-para-capturas]
// Noviembre de 2026 tiene 30 días; hoy es 15 (quedan 16 contando hoy).
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const MOVS = "users/test/finanzas";
const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const visible = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
const sinDesborde = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(450); };
// Cambia un movimiento como lo haría Firestore (otro aparato o un borrado).
const poner = (p, id, doc) => p.evaluate(([c, i, d]) => { const m = window.__fakeStore.colMap(c); if (d) m.set(i, d); else m.delete(i); window.__fakeStore.notify(); }, [MOVS, id, doc]);

function semilla(conIngresos) {
  const movs = {
    g1: { date: "2026-11-05", type: "gasto", category: "comida", payment: "efectivo", amount: 1200, createdAt: 3 },
    gx: { date: "2026-11-06", type: "gasto", category: "otros", payment: "efectivo", amount: 999, excluded: true, createdAt: 4 },
    io: { date: "2026-10-28", type: "ingreso", category: "salario", payment: "debito", amount: 4000, createdAt: 1 }   // de octubre: no cuenta
  };
  if (conIngresos) {
    movs.i1 = { date: "2026-11-01", type: "ingreso", category: "salario", payment: "debito", amount: 2000, createdAt: 2 };
    movs.i2 = { date: "2026-11-10", type: "ingreso", category: "salario", payment: "debito", amount: 1000, createdAt: 5 };
  }
  return { __SEED__: { [MOVS]: movs, "users/test/meta": { presupuestos: { salario: 5000, comida: 1500 } } } };
}

async function conIngresos(browser, base, ancho) {
  console.log(`\nDisponible por día con ingresos reales (${ancho} px)`);
  const p = await abrir(browser, base, semilla(true), { hash: "#finanzas", zona: ZONA, fecha: "2026-11-15T10:00:00-04:00", ancho, alto: 844 });
  const errores = [];
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errores.push(m.text()); });
  await p.waitForTimeout(1200);
  const hero = await texto(p, "#res-hero");
  ok(/Disponible por día/i.test(hero) && /Bs 100(?![\d,.])/.test(await texto(p, "#res-hero .vg-big")), `presupuesto 5000 con 3000 recibidos → Bs 100 por día, no 170 (${await texto(p, "#res-hero .vg-big")})`);
  ok(/Te queda por día desde hoy: Bs 112,5 · quedan 16 días/.test(hero), `te queda por día desde hoy: (3000 − 1200) ÷ 16 = 112,5 (${hero.slice(0, 160)})`);
  ok(/Vas bien\./.test(await texto(p, "#res-hero .dia-estado")) && await p.$eval("#res-hero .dia-estado", el => el.classList.contains("is-verde") && !!el.querySelector("svg")), "verde, con ícono y texto «Vas bien»");
  ok(/Recibido vs\. presupuestado Bs 3\.000 de Bs 5\.000 · 60 %/.test(hero), "recibido vs. presupuestado: 3000 de 5000 · 60 %");
  ok(await p.$eval("#res-hero .vg-big", el => getComputedStyle(el).fontVariantNumeric.includes("tabular-nums")), "números con tabular-nums");
  // ⓘ ¿Cómo se calcula?
  ok(await p.$eval("#res-hero [data-dia-como]", b => b.getAttribute("aria-expanded") === "false" && b.getAttribute("aria-label") === "¿Cómo se calcula?") && !(await visible(p, "#dia-como")), "ⓘ con nombre para el lector de pantalla, cerrado");
  await p.click("#res-hero [data-dia-como]");
  await p.waitForTimeout(150);
  const como = await texto(p, "#dia-como");
  ok(await visible(p, "#dia-como") && /Bs 3\.000 ÷ 30 días = Bs 100/.test(como) && /\(Bs 3\.000 − Bs 1\.200\) ÷ 16 días = Bs 112,5/.test(como), `«¿Cómo se calcula?» con tus números (${como.slice(0, 120)})`);
  ok(/Tu presupuesto de ingresos \(Bs 5\.000\) es la meta/.test(como), "explica que el presupuesto es la meta");
  ok(await sinDesborde(p), "no se mueve de lado");
  await captura(p, `finanzas-diario-${ancho}.png`);
  const tam = await p.$eval("#res-hero [data-dia-como]", b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); });
  ok(tam >= 44, `el botón ⓘ mide ${Math.round(tam)} px (≥ 44)`);

  // Recalcula al instante: un gasto nuevo (con la hoja de siempre) lo pone en ámbar.
  await ir(p, "#fin-movimientos");
  await p.click("#txn-add");
  await p.waitForTimeout(400);
  for (const k of ["8", "0", "0"]) await p.click(`[data-txn-key="${k}"]`);
  if (await p.$("#txn-sheet-chips button")) await p.click("#txn-sheet-chips button");
  await p.click("#txn-sheet-save");
  await p.waitForTimeout(600);
  await ir(p, "#finanzas");
  ok(/Te queda por día desde hoy: Bs 62,5/.test(await texto(p, "#res-hero")) && await p.$eval("#res-hero .dia-estado", el => el.classList.contains("is-ambar")) && /Vas gastando más rápido de lo ideal/.test(await texto(p, "#res-hero .dia-estado")),
    "al anotar un gasto de 800: te queda 62,5 por día → ámbar «Vas gastando más rápido de lo ideal»");
  ok(/Bs 100(?![\d,.])/.test(await texto(p, "#res-hero .vg-big")), "el disponible por día no cambia con los gastos (sigue Bs 100)");
  // Gastos mayores que lo que entró → rojo.
  await poner(p, "g2", { date: "2026-11-14", type: "gasto", category: "otros", payment: "efectivo", amount: 1500, createdAt: 9 });
  await p.waitForTimeout(400);
  ok(await p.$eval("#res-hero .dia-estado", el => el.classList.contains("is-rojo")) && /Gastaste más de lo que entró\. Te pasaste Bs 500/.test(await texto(p, "#res-hero .dia-estado")) && /Te queda por día desde hoy: −Bs 31,25/.test(await texto(p, "#res-hero")),
    "gastos mayores que los ingresos → rojo, te pasaste Bs 500 y −Bs 31,25 por día");
  await captura(p, `finanzas-diario-rojo-${ancho}.png`);
  // Borrar ese gasto: vuelve a calcular.
  await poner(p, "g2", null);
  await p.waitForTimeout(400);
  ok(/Te queda por día desde hoy: Bs 62,5/.test(await texto(p, "#res-hero")), "al borrarlo, vuelve a Bs 62,5 por día");

  // Presupuesto e Información usan lo mismo.
  await ir(p, "#fin-presupuesto");
  const anillo = await texto(p, "#budget-remaining-hero");
  ok(/Bs 1\.000/.test(anillo) && /Restante para gastar/.test(anillo) && /Disponible Bs 100 por día · te queda Bs 62,5 por día · quedan 16 días/.test(anillo), `Presupuesto: restante 3000 − 2000 y la línea por día (${anillo})`);
  await p.evaluate(() => { const b = document.querySelector('[data-budget-tab="informacion"], [data-tab="informacion"], #budget-tab-btn-informacion'); if (b) b.click(); });
  await p.waitForTimeout(300);
  const info = await p.$eval("#budget-info", el => el.textContent.replace(/\s+/g, " "));
  ok(/Disponible: Bs 100 por día/.test(info) && /Bs 62,5\s*Te queda por día desde hoy/.test(info), "Información › Presupuesto diario, con el mismo cálculo");

  // Mi día en Inicio.
  await ir(p, "#inicio");
  await p.waitForTimeout(400);
  const md = await texto(p, '#mi-dia [data-md="dinero"]');
  ok(/^Para gastar hoy: Bs 62,5/.test(md) && /Vas más rápido de lo ideal \(disponible: Bs 100 por día\)\. Quedan 16 días del mes\./.test(md) && await p.$eval('#mi-dia [data-md="dinero"]', a => a.getAttribute("href") === "#finanzas"), `Mi día: ${md}`);
  ok(!errores.length && !p.errores.length, `sin errores de consola${errores.length ? ` (${errores[0]})` : ""}`);
  await p.context().close();
}

async function sinIngresos(browser, base, ancho) {
  console.log(`\nSin ingresos este mes (${ancho} px)`);
  const p = await abrir(browser, base, semilla(false), { hash: "#finanzas", zona: ZONA, fecha: "2026-11-15T10:00:00-04:00", ancho, alto: 844 });
  await p.waitForTimeout(1200);
  const hero = await texto(p, "#res-hero");
  ok(/Todavía no registraste ingresos en noviembre/i.test(hero) && !/Bs 1\d\d(?![\d,.])/.test(await texto(p, "#res-hero .vg-big")), `estado vacío, sin número inventado (${hero.slice(0, 120)})`);
  ok(/Tu meta de ingresos: Bs 5\.000/.test(hero), "muestra la meta del presupuesto como meta");
  ok(!(await p.$("#res-hero .vg-big")), "no hay número grande");
  await captura(p, `finanzas-diario-vacio-${ancho}.png`);
  await p.click("#res-hero [data-dia-registrar]");
  await p.waitForTimeout(400);
  ok(await p.$eval("#txn-sheet", el => !el.hidden) && await p.$eval('#txn-sheet [data-txn-type="ingreso"]', b => b.classList.contains("active")), "«Registrar ingreso» abre la hoja ya en Ingreso");
  await p.click("#txn-sheet .budget-sheet-close").catch(() => {});
  await p.waitForTimeout(300);
  await ir(p, "#fin-presupuesto");
  ok(/Sin ingresos/.test(await texto(p, "#budget-remaining-hero")) && /Registra tus ingresos de este periodo/.test(await texto(p, "#budget-remaining-hero")), "Presupuesto: «Sin ingresos» (no un número)");
  await ir(p, "#inicio");
  ok(!(await p.$('#mi-dia [data-md="dinero"]')), "Mi día: sin ingresos, la fila de dinero no aparece");
  await p.context().close();
}

async function ultimoDia(browser, base) {
  console.log("\nÚltimo día del mes");
  const p = await abrir(browser, base, semilla(true), { hash: "#finanzas", zona: ZONA, fecha: "2026-11-30T20:00:00-04:00", ancho: 375, alto: 812 });
  await p.waitForTimeout(1200);
  ok(/Te queda por día desde hoy: Bs 1\.800 · queda 1 día/.test(await texto(p, "#res-hero")), `el último día: todo lo que queda, en 1 día (${(await texto(p, "#res-hero")).slice(0, 110)})`);
  ok(await sinDesborde(p), "a 375 px no se mueve de lado");
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const ancho of [375, 1280]) await conIngresos(browser, base, ancho);
  await sinIngresos(browser, base, 375);
  await ultimoDia(browser, base);
  await terminar(browser, srv);
})();
