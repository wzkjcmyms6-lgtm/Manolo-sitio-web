// Pruebas de pantalla de la inteligencia por reglas (Running, fase 5):
// "Resumen inteligente" (2 a 4 frases con datos reales) y "Mismo recorrido"
// en el detalle, y que se completa cuando llega la lista de carreras.
// Uso: node scripts/e2e/run-inteligencia.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");
const X = require("../../tests/run-fixtures.js");
const F = require("../../js/run-formatos.js");
const M = require("../../js/run-metricas.js");
const G = require("../../js/run-guardar.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const t = s => Date.parse(s);
// El mismo recorrido (5 km al norte) a distintas velocidades.
function vuelta(id, fecha, vel) {
  const ps = X.puntos({ segundos: Math.ceil(5050 / vel), vel, inicio: t(`${fecha}T07:00:00-04:00`) });
  const { campos } = M.calcular(F.leer(X.fit(ps), "x.fit"), {});
  return G.documento({ deporte: "running", origen: { idExterno: id }, campos }, 1);
}
const RUN = {
  imp_1: vuelta("1", "2026-10-06", 3.2),
  imp_2: vuelta("2", "2026-10-13", 3.3),
  imp_3: vuelta("3", "2026-10-20", 3.25),
  imp_4: vuelta("4", "2026-10-27", 3.45),
  otra: Object.assign(vuelta("5", "2026-10-22", 3.0), { mini: M.codificar([[-16.6, -68.2], [-16.61, -68.2]], [1e5, 1e5]) }),
  m1: { date: "2026-10-30", distance: 5, duration: 30 }
};

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, { __SEED__: { "users/test/running": RUN } }, { hash: "#run-actividad/running/imp_4", zona: ZONA, fecha: "2026-11-04T09:00:00-04:00" });
  const tx = sel => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim());
  await p.waitForSelector(".rd-ia", { timeout: 8000 }).catch(() => {});

  console.log("\nResumen inteligente");
  const frases = await p.$$eval(".rd-ia li", els => els.map(e => e.textContent.trim()));
  ok(frases.length >= 2 && frases.length <= 4, `de 2 a 4 frases (${frases.length})`);
  ok(/^Nueva mejor marca en 5K: 24:09, \d:\d\d menos que la anterior\.$/.test(frases[0]), `la marca primero (${frases[0]})`);
  ok(frases.some(f => f === "Hiciste este recorrido 4 veces y hoy fue tu mejor tiempo."), `el recorrido repetido (${frases.join(" | ")})`);
  ok(frases.every(f => !/descans|recuper|lesi|médic|salud/i.test(f)), "sin consejos de salud");

  console.log("Mismo recorrido");
  ok(/^Mismo recorrido 4 veces/.test(await tx(".rd-recorrido h2")), "4 veces (la de otro lugar no cuenta)");
  const filas = await p.$$eval(".rd-rec-lista li", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
  ok(filas.length === 4 && /^Esta carrera/.test(filas[0]), "la lista empieza por esta carrera");
  ok(await p.$(".rd-rec-lista li.is-esta.is-mejor") !== null, "y la marca como la mejor");
  ok(/Este fue tu mejor tiempo en este recorrido/.test(await tx(".rd-recorrido .rd-nota")), "lo dice arriba de la lista");
  await captura(p, "run-inteligencia.png");
  await p.click('.rd-rec-lista a[href="#run-actividad/running/imp_2"]');
  await p.waitForTimeout(500);
  ok(/Puesto 2 de 4; tu mejor: \d\d:\d\d \(/.test(await tx(".rd-recorrido .rd-nota")), "en otra vuelta dice su puesto y la mejor");
  const f2 = await p.$$eval(".rd-ia li", els => els.map(e => e.textContent.trim()));
  ok(f2.some(f => /^Hiciste este recorrido 2 veces|^Tu 2\.º mejor|^Nueva mejor marca/.test(f)), `el resumen de esa vuelta mira solo lo de antes (${f2.join(" | ")})`);

  console.log("Carrera a mano");
  await p.evaluate(() => { location.hash = "run-actividad/running/m1"; });
  await p.waitForTimeout(500);
  const f3 = await p.$$eval(".rd-ia li", els => els.map(e => e.textContent.trim()));
  ok(f3.length >= 2 && /^Ritmo de 6:00 \/km: \d+ s\/km más lento que tu promedio/.test(f3[0]) && /Con esta carrera sumas 10,\d km en la semana \(2 carreras\)/.test(f3.join(" ")), `a mano: ritmo contra el promedio y la semana (${f3.join(" | ")})`);
  ok(!(await p.$(".rd-recorrido")), "sin ruta no hay «Mismo recorrido»");
  ok(p.errores.length === 0, "sin errores en la página");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(ancho <= 390, `sin desborde (${ancho})`);
  await terminar(browser, srv);
})();
