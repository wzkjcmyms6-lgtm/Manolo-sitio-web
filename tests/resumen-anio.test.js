// "Tu año en Manolo" (js/resumen-anio.js, D-139): el contenido de las
// diapositivas, con un año de ejemplo y el anterior para comparar.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/resumen-motor.js");
const A = require("../js/resumen-anio.js");

const pad = n => String(n).padStart(2, "0");
function datos() {
  const d = {
    hoy: "2026-11-16",
    running: [], bici: [], gimnasio: [], movilidad: [],
    habitos: { dias: {}, perfectos: [], lista: [{ id: "h1", nombre: "Leer", emoji: "📖", dias: {} }] },
    libros: { dias: {}, terminados: [] },
    biblia: { caps: [], vers: [], nombres: { John: "Juan", Ps: "Salmos" } },
    finanzas: { movs: [], cats: { comida: "Comida", casa: "Casa" } },
    manana: [], lugares: []
  };
  // 2026: una carrera de 10 km cada semana (más larga en marzo), 3 entrenos por semana en enero–octubre.
  for (let m = 1; m <= 10; m++) {
    for (let s = 0; s < 4; s++) {
      const f = `2026-${pad(m)}-${pad(3 + s * 7)}`;
      d.running.push({ id: `r${m}${s}`, fecha: f, km: m === 3 && s === 2 ? 21.1 : 10, min: 60, desnivel: 50,
        mejores: { "5000": 1500 - m * 5, "10000": 3100 - m * 10 }, records: [] });
      d.gimnasio.push({ fecha: f, nombre: "Full body", min: 50, series: 18, volumen: 3000 + m * 100, records: s === 0 ? 1 : 0, ejercicios: ["Sentadilla", "Press banca"] });
      d.gimnasio.push({ fecha: R.sumar(f, 2), nombre: "Pierna", min: 55, series: 16, volumen: 2500, records: 0, ejercicios: ["Sentadilla", "Peso muerto"] });
    }
    // Finanzas: ingreso 8000 y gastos (más ahorro en junio).
    d.finanzas.movs.push({ fecha: `2026-${pad(m)}-01`, tipo: "ingreso", cent: 800000, cat: "sueldo" },
      { fecha: `2026-${pad(m)}-05`, tipo: "gasto", cent: m === 6 ? 300000 : 500000, cat: "casa" },
      { fecha: `2026-${pad(m)}-10`, tipo: "gasto", cent: 100000, cat: "comida" });
    // Mi mañana: 70 min en enero, bajando a 52 en octubre.
    for (let k = 1; k <= 5; k++) d.manana.push({ fecha: `2026-${pad(m)}-${pad(k + 10)}`, seg: (70 - m * 2) * 60 });
  }
  d.bici.push({ id: "b1", fecha: "2026-05-01", km: 45, min: 120, desnivel: 300 }, { id: "b2", fecha: "2026-05-15", km: 30, min: 80, desnivel: 100 });
  d.movilidad.push({ fecha: "2026-02-02", min: 10 }, { fecha: "2026-02-04", min: 15 });
  // Biblia: Juan 1–21 (enero) y 3 salmos.
  for (let c = 1; c <= 21; c++) d.biblia.caps.push({ fecha: `2026-01-${pad(c)}`, clave: `John.${c}` });
  ["Ps.1", "Ps.23", "Ps.1"].forEach((k, i) => d.biblia.caps.push({ fecha: `2026-02-${pad(i + 1)}`, clave: k }));
  d.biblia.vers.push({ fecha: "2026-01-22", cita: "Juan 3:16" });
  // Libros: dos terminados (uno de 5 estrellas).
  d.libros.terminados.push({ titulo: "Hábitos atómicos", autor: "James Clear", fecha: "2026-03-10", calificacion: 4, paginas: 338 },
    { titulo: "El alquimista", autor: "Paulo Coelho", fecha: "2026-07-20", calificacion: 5, paginas: 192 });
  d.libros.dias["2026-03-01"] = 50; d.libros.dias["2026-07-01"] = 40;
  // Hábitos: todo el año (fines de semana no).
  for (let f = "2026-01-01"; f <= "2026-11-16"; f = R.sumar(f, 1)) {
    const ok = new Date(`${f}T12:00:00Z`).getUTCDay() % 6 !== 0 ? 1 : 0;
    d.habitos.dias[f] = { h: ok, e: 1 };
    d.habitos.lista[0].dias[f] = ok;
  }
  d.lugares.push({ id: "l1", nombre: "Café del Sol", calificacion: 5, zona: "Sopocachi", visitas: ["2026-04-02", "2026-06-10"] },
    { id: "l2", nombre: "Pollos Copacabana", calificacion: 3, zona: "Centro", visitas: ["2026-08-01"] },
    { id: "l3", nombre: "La de siempre", calificacion: 4, zona: "Sopocachi", visitas: ["2025-05-01", "2026-09-09"] });
  // 2025 (para comparar): 20 carreras de 10 km y un libro.
  for (let k = 0; k < 20; k++) d.running.push({ id: `v${k}`, fecha: R.sumar("2025-01-06", k * 14), km: 10, min: 62, desnivel: 40, records: [] });
  d.libros.terminados.push({ titulo: "Viejo", autor: "X", fecha: "2025-04-01", calificacion: 3, paginas: 100 });
  return d;
}

test("años con datos y el año en curso (hasta hoy)", () => {
  assert.deepEqual(A.aniosConDatos(datos()), [2026, 2025]);
  const y = A.anio(datos(), 2026);
  assert.deepEqual([y.completo, y.hasta, y.dias], [false, "2026-11-16", 320]);
  assert.deepEqual(Object.keys(y.secciones), ["habitos", "gimnasio", "running", "bici", "movilidad", "libros", "biblia", "finanzas", "manana", "lugares"]);
  assert.equal(A.anio(datos(), 2027), null, "un año que no empezó");
  assert.equal(A.anio(datos(), 2025).completo, true);
});

test("Running, Bici y Gimnasio: cifras, la más larga, marcas, el mejor mes", () => {
  const S = A.anio(datos(), 2026).secciones;
  assert.deepEqual([S.running.n, Math.round(S.running.km * 10) / 10, S.running.larga.km, S.running.larga.fecha], [40, 411.1, 21.1, "2026-03-17"]);
  assert.deepEqual(S.running.marcas.map(m => [m.nombre, m.t]), [["5K", 1450], ["10K", 3000]], "las mejores del año (octubre)");
  assert.equal(S.running.mejorMes.nombre, "marzo");
  assert.equal(S.running.equivalencia, "Como ir corriendo de La Paz a Cochabamba.");
  assert.deepEqual([S.bici.n, S.bici.km, S.bici.desnivel], [2, 75, 400]);
  assert.equal(S.gimnasio.n, 80);
  assert.deepEqual(S.gimnasio.ejercicioTop, { nombre: "Sentadilla", veces: 80 });
  assert.equal(S.gimnasio.records, 10);
  assert.deepEqual([S.gimnasio.mayorVolumen.fecha, S.gimnasio.mayorVolumen.volumen], ["2026-10-03", 4000]);
});

test("Libros, Biblia, Finanzas, Mi mañana y Lugares", () => {
  const S = A.anio(datos(), 2026).secciones;
  assert.deepEqual([S.libros.terminados, S.libros.paginas, S.libros.cincoEstrellas], [2, 90, 1]);
  assert.deepEqual(S.libros.libroDelAnio, { titulo: "El alquimista", autor: "Paulo Coelho", calificacion: 5 });
  assert.deepEqual([S.biblia.capitulos, S.biblia.unicos, S.biblia.libroTop.nombre, S.biblia.mejorRacha], [24, 23, "Juan", 22]);
  assert.equal(Math.round(S.biblia.pctBiblia * 1000), 19, "23 de 1189 capítulos");
  assert.deepEqual([S.finanzas.ingreso, S.finanzas.gasto, Math.round(S.finanzas.pctAhorro * 100)], [8000000, 5800000, 28]);
  assert.deepEqual([S.finanzas.mejorMesAhorro.nombre, S.finanzas.catTop.nombre], ["junio", "Casa"]);
  assert.ok(S.finanzas.diasSinGasto > 250);
  assert.deepEqual([S.manana.mejora.desde, S.manana.mejora.hasta, S.manana.mejora.mesDesde, S.manana.mejora.mesHasta], [4080, 3000, "enero", "octubre"]);
  assert.deepEqual([S.lugares.visitas, S.lugares.nuevos, S.lugares.mejor.nombre, S.lugares.zonaTop.nombre], [4, 2, "Café del Sol", "Sopocachi"]);
  assert.equal(Math.round(S.habitos.pct * 100), 71);
});

test("el año en números, el mejor mes, el día, contra el año anterior y lo destacado", () => {
  const y = A.anio(datos(), 2026);
  assert.deepEqual(y.numeros.slice(0, 4).map(n => `${n.valor} ${n.etiqueta}`), ["269 días con algo anotado", "228 hábitos cumplidos", "80 entrenos", "411,1 km corriendo"]);
  assert.ok(y.mejorMes && y.mejorMes.valor > 0);
  assert.ok(y.diaSemana && y.diaSemana.plural);
  assert.deepEqual(y.vsAnterior.lista.map(v => v.texto).slice(0, 2), ["+211,1 km corriendo", "+1 libro"]);
  assert.equal(y.vsAnterior.anio, 2025);
  assert.ok(y.destacados.length <= 6 && y.destacados.every(x => !/Bs|ahorr|gast/i.test(x.texto)), "sin dinero");
  assert.equal(y.destacados[0].texto, "411,1 km corriendo");
});

test("con el Wrapped de Hábitos y «Tu año en libros» (si están)", () => {
  const d = datos();
  d.extras = {
    habitos: { cumplimiento: 0.8, registros: 999, perfectos: 12, estrella: { id: "h1", veces: 230 }, racha: { id: "h1", n: 40, unidad: "días" } },
    libros: { terminados: 5, paginas: 1500, diasLeidos: 120, autorTop: { nombre: "Paulo Coelho", libros: 2 }, masLargo: { titulo: "X", paginas: 600 }, fraseFav: { texto: "Cuando quieres algo…", libro: "El alquimista" } }
  };
  const S = A.anio(d, 2026).secciones;
  assert.deepEqual([S.habitos.pct, S.habitos.cumplidos, S.habitos.perfectos, S.habitos.estrella.nombre, S.habitos.racha.n, S.habitos.conWrapped], [0.8, 999, 12, "Leer", 40, true]);
  assert.deepEqual([S.libros.terminados, S.libros.paginas, S.libros.autorTop.nombre, S.libros.frase.libro], [5, 1500, "Paulo Coelho", "El alquimista"]);
  assert.equal(A.equivalencia(20, "corriendo"), "");
  assert.equal(A.equivalencia(700, "corriendo"), "Como ir corriendo de La Paz a Cochabamba y volver.");
  assert.equal(A.equivalencia(100, "corriendo"), "Equivale a 2,4 maratones.");
  assert.equal(A.equivalencia(900, "en bici"), "Como ir en bici de La Paz a Santa Cruz.");
  // En bici, lugares más cerca y nunca maratones (fase 4).
  assert.equal(A.equivalencia(52.5, "en bici"), "");
  assert.equal(A.equivalencia(100, "en bici"), "Como ir en bici de La Paz a Coroico.");
  assert.equal(A.equivalencia(160, "en bici"), "Como ir en bici de La Paz a Copacabana.");
});

// ---- Las diapositivas (fase 4, D-140) ----
test("las diapositivas: solo lo que usaste, en orden, Finanzas solo para ti y el cierre", () => {
  const y = A.anio(datos(), 2026);
  const ds = A.diapositivas(y);
  assert.deepEqual(ds.map(s => s.id), ["portada", "numeros", "habitos", "gimnasio", "running", "bici", "movilidad", "libros", "biblia", "finanzas", "manana", "lugares", "ritmo", "contra", "cierre"]);
  const por = id => ds.find(s => s.id === id);
  assert.deepEqual(por("portada").lineas, ["Lo que va del año, hasta el 16 de noviembre.", "Anotaste algo en 269 días."]);
  assert.ok(por("portada").pista && por("cierre").cierre && por("habitos").habitos);
  assert.deepEqual([por("running").grande, por("running").titulo], ["411,1", "km corriendo"]);
  assert.ok(por("running").lineas.includes("Tus mejores marcas: 5K 24:10 · 10K 50:00."));
  assert.equal(por("running").barras.length, 11, "una barra por mes, hasta noviembre");
  assert.ok(por("gimnasio").lineas.includes("Tu ejercicio del año: Sentadilla, 80 veces."));
  assert.equal(por("bici").lineas[por("bici").lineas.length - 1], "Como ir en bici de La Paz a Tiwanaku.");
  assert.equal(por("numeros").numeros[0].etiqueta, "días con algo anotado");
  const fin = por("finanzas");
  assert.ok(fin.privado && fin.grande === "28 %" && !fin.lineas.concat(fin.titulo).some(t => /Bs|\d{3}\.\d{3}/.test(t)), "Finanzas: solo para ti y en porcentajes");
  assert.deepEqual(por("contra").lista.map(x => x.texto), ["+211,1 km corriendo", "+1 libro"]);
  assert.equal(por("cierre").titulo, "Y el año todavía no termina");
  // Un año entero dice otra cosa; uno sin nada: portada y cierre.
  assert.equal(A.diapositivas(A.anio(datos(), 2025)).find(s => s.id === "cierre").titulo, "Gracias por un año más");
  const vacio = A.diapositivas(A.anio({ hoy: "2026-11-16" }, 2026));
  assert.deepEqual(vacio.map(s => s.id), ["portada", "cierre"]);
  assert.equal(vacio[1].titulo, "Este año todavía está en blanco");
  assert.deepEqual(A.diapositivas(null), []);
});
