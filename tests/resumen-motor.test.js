// "Tu semana" y "Tu año" (D-136): el motor sin pantalla (js/resumen-motor.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/resumen-motor.js");

// Una semana de ejemplo: lunes 9 al domingo 15 de noviembre de 2026, con las
// 4 anteriores como historia. "hoy" es el lunes 16 (la semana ya terminó).
const L = "2026-11-09";
const f = (base, n) => R.sumar(base, n);
function datos(o) {
  const d = {
    hoy: "2026-11-16",
    running: [], bici: [], gimnasio: [], movilidad: [],
    habitos: { dias: {}, perfectos: [], lista: [] },
    libros: { dias: {}, terminados: [] },
    biblia: { caps: [], vers: [] },
    finanzas: { movs: [], cats: { comida: "Comida", transporte: "Transporte" } },
    manana: [], lugares: []
  };
  // 4 semanas antes: 3 entrenos, 2 carreras de 5 km, 40 páginas, Biblia 5 días, comida Bs 300 y Bs 100 de transporte por semana.
  for (let k = 1; k <= 4; k++) {
    const l = f(L, -7 * k);
    [0, 2, 4].forEach(i => d.gimnasio.push({ fecha: f(l, i), nombre: "Full body", min: 60, series: 18, volumen: 3000, records: 0 }));
    [1, 3].forEach(i => d.running.push({ id: `r${k}${i}`, fecha: f(l, i), km: 5, min: 30, desnivel: 20, records: [] }));
    [0, 1, 2, 3, 4].forEach(i => d.biblia.caps.push({ fecha: f(l, i), clave: "John.1" }));
    d.libros.dias[f(l, 5)] = 40;
    d.finanzas.movs.push({ fecha: f(l, 2), tipo: "gasto", cent: 30000, cat: "comida" }, { fecha: f(l, 3), tipo: "gasto", cent: 10000, cat: "transporte" });
    for (let i = 0; i < 7; i++) d.manana.push({ fecha: f(l, i), seg: 3300 });
  }
  // La semana: 4 entrenos (1 récord), 3 carreras (21 km, récord de 5K), Biblia 7 días, un libro terminado, comida Bs 600.
  [0, 1, 3, 5].forEach(i => d.gimnasio.push({ fecha: f(L, i), nombre: "Full body", min: 60, series: 20, volumen: 3500, records: i === 5 ? 1 : 0 }));
  d.running.push({ id: "a", fecha: f(L, 1), km: 5, min: 24, desnivel: 10, records: [{ nombre: "5K", t: 1450, puesto: 1 }] },
    { id: "b", fecha: f(L, 3), km: 6, min: 33, desnivel: 30, records: [] },
    { id: "c", fecha: f(L, 6), km: 10.3, min: 60, desnivel: 80, records: [] });
  for (let i = 0; i < 7; i++) d.biblia.caps.push({ fecha: f(L, i), clave: `Ps.${i + 1}` });
  d.biblia.vers.push({ fecha: f(L, 2), cita: "Juan 3:16" });
  d.libros.dias[f(L, 0)] = 30; d.libros.dias[f(L, 4)] = 50;
  d.libros.terminados.push({ titulo: "Hábitos atómicos", autor: "James Clear", fecha: f(L, 4), calificacion: 5, paginas: 338 });
  d.finanzas.movs.push({ fecha: f(L, 1), tipo: "gasto", cent: 60000, cat: "comida" }, { fecha: f(L, 2), tipo: "gasto", cent: 5000, cat: "transporte" },
    { fecha: f(L, 5), tipo: "ingreso", cent: 500000, cat: "salario" });
  for (let i = 0; i < 5; i++) d.manana.push({ fecha: f(L, i), seg: 3000 - i * 60 });
  // Hábitos: "Leer" 7 de 7, "Meditar" 1 de 7, y la semana anterior al 50 %.
  const leer = { id: "h1", nombre: "Leer 30 min", emoji: "📖", dias: {} }, med = { id: "h2", nombre: "Meditar", emoji: "🧘", dias: {} };
  for (let i = -7; i < 7; i++) {
    const dia = f(L, i);
    leer.dias[dia] = i >= 0 ? 1 : (i % 2 ? 1 : 0);
    med.dias[dia] = i === 0 ? 1 : (i < 0 && i % 2 === 0 ? 1 : 0);
    d.habitos.dias[dia] = { h: leer.dias[dia] + med.dias[dia], e: 2 };
  }
  d.habitos.lista.push(leer, med);
  d.lugares.push({ id: "l1", nombre: "Café del Sol", calificacion: 5, zona: "Sopocachi", visitas: [f(L, 6)] });
  return Object.assign(d, o || {});
}

test("cifras de un período: cada sección y los días con algo", () => {
  const p = R.periodo(datos(), L, f(L, 6));
  assert.deepEqual([p.running.n, Math.round(p.running.km * 10) / 10, p.running.desnivel, p.running.larga.km], [3, 21.3, 120, 10.3]);
  assert.deepEqual([p.gimnasio.n, p.gimnasio.series, p.gimnasio.volumen, p.gimnasio.records], [4, 80, 14000, 1]);
  assert.deepEqual([p.biblia.dias, p.biblia.caps, p.biblia.vers], [7, 7, 1]);
  assert.deepEqual([p.libros.paginas, p.libros.dias, p.libros.terminados.length], [80, 2, 1]);
  assert.deepEqual([p.finanzas.gasto, p.finanzas.ingreso, p.finanzas.diasSinGasto, p.finanzas.porCat[0].nombre], [65000, 500000, 5, "Comida"]);
  assert.equal(Math.round(p.habitos.pct * 100), 57, "8 de 14");
  assert.deepEqual(p.habitos.porHabito.map(h => [h.nombre, h.h, h.e]), [["Leer 30 min", 7, 7], ["Meditar", 1, 7]]);
  assert.deepEqual([p.manana.n, p.manana.promedio, p.manana.mejor.seg], [5, 2880, 2760]);
  assert.deepEqual(p.lugares.nuevos.map(l => l.nombre), ["Café del Sol"]);
  assert.equal(p.diasActivos, 7);
  // Una sección que no está (null) no aparece.
  assert.ok(!("bici" in R.periodo(datos({ bici: null }), L, f(L, 6))));
});

test("la semana: por área, contra la semana anterior y tu promedio", () => {
  const s = R.semana(datos(), L);
  assert.equal(s.rango, "9 – 15 nov");
  assert.equal(s.enCurso, false);
  assert.deepEqual(s.areas.map(a => a.id), ["habitos", "gimnasio", "running", "libros", "biblia", "finanzas", "manana", "lugares"], "solo las que usas (sin bici ni movilidad)");
  const area = id => s.areas.find(a => a.id === id);
  assert.equal(area("running").linea, "21,3 km · 3 carreras · 1:57 h");
  assert.deepEqual(area("running").cambio, { texto: "▲ 11,3 km", signo: 1 });
  assert.equal(area("gimnasio").linea, "4 entrenos · 80 series · 14.000 kg · 1 récord");
  assert.deepEqual(area("gimnasio").cambio, { texto: "▲ 1 entreno", signo: 1 });
  assert.equal(area("habitos").linea, "57 % de tus hábitos");
  assert.equal(area("habitos").detalle, "Mejor: 📖 Leer 30 min (7 de 7)");
  assert.equal(area("biblia").linea, "7 de 7 días · 7 capítulos · 1 versículo");
  assert.equal(area("finanzas").linea, "Bs 650 gastados · Bs 5.000 de ingresos · 5 días sin gastar");
  assert.deepEqual(area("finanzas").cambio, { texto: "▲ 63 % vs tu promedio", signo: -1 }, "Bs 650 contra Bs 400: gastar más es malo");
  assert.deepEqual(area("manana").cambio, { texto: "▲ 7 min más rápido", signo: 1 });
});

test("lo mejor, lo que se quedó atrás y una sugerencia", () => {
  const s = R.semana(datos(), L);
  assert.deepEqual(s.mejor.map(m => m.texto), [
    "Nuevo récord en 5K: 24:10", "Un récord nuevo en el gimnasio", "Terminaste «Hábitos atómicos» (★★★★★)", "Tu carrera más larga del año: 10,3 km"]);
  assert.deepEqual(s.atras.map(a => a.texto), ["«Meditar»: 1 de 7 días", "Comida: Bs 600, 100 % más que tu promedio"], "lo que dejaste de hacer pesa más que un gasto");
  assert.deepEqual(s.sugerencia, { texto: "Enfócate en «Meditar»: intenta 4 de 7 días.", href: "#habitos" });
  assert.equal(s.titular, "Semana de récords: 4 entrenos, 21,3 km corriendo y el 57 % de tus hábitos.");
});

test("lo que dejaste de hacer: no corriste, no entrenaste, no leíste", () => {
  const d = datos();
  d.running = d.running.filter(x => x.fecha < L);
  d.gimnasio = d.gimnasio.filter(x => x.fecha < L);
  d.libros = { dias: Object.fromEntries(Object.entries(d.libros.dias).filter(([k]) => k < L)), terminados: [] };
  const s = R.semana(d, L);
  const t = s.atras.map(a => a.texto);
  assert.deepEqual(t, ["No entrenaste en el gimnasio (sueles hacer 3 por semana)", "«Meditar»: 1 de 7 días", "No saliste a correr (sueles hacer 10 km)"],
    "como mucho 3, lo más importante primero (el gasto en comida y no leer quedan fuera)");
  assert.deepEqual(s.sugerencia, { texto: "Agenda 3 entrenos esta semana: elige los días hoy.", href: "#ejercicio" });
  assert.equal(s.areas.find(a => a.id === "running").linea, "Sin carreras", "Running sigue: la usaste las semanas anteriores");
});

test("la semana en curso: hasta hoy, contra los mismos días", () => {
  const d = datos({ hoy: f(L, 2) });   // miércoles
  const s = R.semana(d, L);
  assert.equal(s.enCurso, true);
  assert.equal(s.dias, 3);
  assert.equal(s.hasta, f(L, 2));
  const run = s.areas.find(a => a.id === "running");
  assert.equal(run.linea, "5 km · 1 carrera · 24 min");
  assert.deepEqual(run.cambio, { texto: "igual que la semana pasada", signo: 0 }, "lun–mié: 5 km contra 5 km");
  assert.ok(/^Tu semana hasta hoy: /.test(s.titular));
  assert.ok(!s.atras.some(a => /No entrenaste/.test(a.texto)), "a mitad de semana no se reclama lo que falta");
  // Sin ningún dato: un titular amable.
  const vacia = R.semana({ hoy: "2026-11-16" }, L);
  assert.deepEqual([vacia.areas.length, vacia.titular, vacia.sugerencia], [0, "Una semana tranquila: no hay nada anotado.", null]);
});

test("hábitos de «X veces por semana» y formatos", () => {
  const d = datos();
  d.habitos.lista = [{ id: "g", nombre: "Gimnasio", emoji: "🏋️", semanas: { [L]: { h: 1, e: 3 }, [f(L, -7)]: { h: 3, e: 3 } } }];
  const s = R.semana(d, L);
  assert.ok(s.atras.some(a => a.texto === "«Gimnasio»: 1 de 3 veces"));
  assert.equal(R.rango("2026-10-27", "2026-11-02"), "27 oct – 2 nov");
  assert.equal(R.rango("2025-12-29", "2026-01-04"), "29 dic 2025 – 4 ene 2026");
  assert.deepEqual([R.miles(1234567), R.dec1(1234.56), R.bs(99), R.bs(123456), R.duracion(59), R.duracion(125), R.mmss(1450), R.mmss(3725)],
    ["1.234.567", "1.234,6", "Bs 1", "Bs 1.235", "59 min", "2:05 h", "24:10", "1:02:05"]);
  assert.equal(R.lunesDe("2026-11-16"), "2026-11-16");
  assert.equal(R.lunesDe("2026-11-22"), "2026-11-16");
});

// ---- Ropa (D-151): lo que te pusiste y lo que compraste ----
test("Ropa en la semana: los días anotados, lo que más te pusiste y lo que compraste", () => {
  const d = datos({
    ropa: {
      usos: [
        // La semana: 7 de 7 días (el jean 4 veces); la anterior, 3 días.
        ...[0, 1, 2, 3, 4, 5, 6].map(i => ({ fecha: f(L, i), prendas: i < 4 ? ["jean", "polera"] : ["short"] })),
        ...[1, 3, 5].map(i => ({ fecha: f(L, i - 7), prendas: ["jean"] })),
        { fecha: f(L, -20), prendas: [] }
      ],
      prendas: [
        { id: "jean", nombre: "Jean azul", color: "Azul", compra: "2025-03-01", precio: 300 },
        { id: "polera", nombre: "Polera negra", color: "Negro", compra: f(L, 2), precio: 80 },
        { id: "short", nombre: "Short beige", color: "Beige", compra: "", precio: 0 }
      ]
    }
  });
  const p = R.periodo(d, L, f(L, 6));
  assert.deepEqual(p.ropa, { dias: 7, distintas: 3, top: { id: "jean", nombre: "Jean azul", veces: 4 }, color: "Azul", compras: 1, gasto: 80 },
    "el color que más te pusiste: azul y negro 4 veces, gana por orden alfabético");
  const s = R.semana(d, L);
  assert.deepEqual(s.areas.map(a => a.id), ["habitos", "gimnasio", "running", "libros", "biblia", "finanzas", "manana", "lugares", "ropa"]);
  const ropa = s.areas.find(a => a.id === "ropa");
  assert.deepEqual([ropa.valor, ropa.linea, ropa.href], ["7 de 7 días", "Anotaste tu ropa 7 días · lo que más: Jean azul (4 veces) · compraste 1 prenda", "#ropa"]);
  assert.deepEqual(ropa.cambio, { texto: "▲ 4 días", signo: 1 });
  assert.ok(!s.mejor.some(m => /ropa/.test(m.texto)), "con 4 cosas más importantes, «Anotaste tu ropa los 7 días» queda fuera");
  // Sin la ropa (o sin nada anotado ni comprado), el área no aparece.
  assert.ok(!R.semana(datos(), L).areas.some(a => a.id === "ropa"));
  assert.ok(!R.semana(datos({ ropa: { usos: [], prendas: [{ id: "x", nombre: "X", color: "", compra: "", precio: 0 }] } }), L).areas.some(a => a.id === "ropa"));
  // Los días con ropa anotada cuentan como días con algo.
  const solo = R.periodo({ hoy: "2026-11-16", ropa: { usos: [{ fecha: f(L, 1), prendas: ["jean"] }, { fecha: f(L, 2), prendas: [] }], prendas: [] } }, L, f(L, 6));
  assert.equal(solo.diasActivos, 1);
  // Una semana tranquila: los 7 días de ropa sí entran en lo mejor.
  const tranquila = R.semana({ hoy: "2026-11-16", ropa: d.ropa }, L);
  assert.deepEqual(tranquila.mejor.map(m => m.texto), ["Anotaste tu ropa los 7 días"]);
  assert.equal(tranquila.areas.find(a => a.id === "ropa").linea, "Anotaste tu ropa 7 días · lo que más: Jean azul (4 veces) · compraste 1 prenda");
});
