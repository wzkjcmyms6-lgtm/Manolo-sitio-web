// Pruebas de pantalla de "Tu semana" y "Tu año" (D-136, docs/RESUMENES.md).
// Fase 1: los datos de todas las secciones llegan al motor sin leer nada
// nuevo (lo que cada sección ya tiene en memoria) y Finanzas solo cuenta
// gastos e ingresos (sin transferencias ni lo excluido).
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

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  await fase1(browser, base);
  await terminar(browser, srv);
})();
