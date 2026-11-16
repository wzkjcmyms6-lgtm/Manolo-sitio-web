// Imagen para compartir de "Tu semana" (js/resumen-imagen.js, D-136): sin
// montos de dinero y todo dentro de la imagen.
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../js/resumen-imagen.js");

const SEMANA = {
  lunes: "2026-11-09", rango: "9 – 15 nov",
  titular: "Semana de récords: 4 entrenos, 21,3 km corriendo y el 82 % de tus hábitos.",
  mejor: [
    { icono: "🏅", texto: "Nuevo récord en 5K: 24:10" },
    { icono: "💰", texto: "Gastaste 18 % menos que tu promedio" },
    { icono: "📚", texto: "Terminaste «Hábitos atómicos» (★★★★★)" }
  ],
  areas: [
    { id: "habitos", nombre: "Hábitos", linea: "82 % de tus hábitos · 4 días perfectos", cambio: { texto: "▲ 9 pts", signo: 1 } },
    { id: "gimnasio", nombre: "Gimnasio", linea: "4 entrenos · 80 series · 14.000 kg · 1 récord", cambio: { texto: "▼ 1 entreno", signo: -1 } },
    { id: "running", nombre: "Running", linea: "21,3 km · 3 carreras · 1:57 h", cambio: { texto: "▲ 11,3 km", signo: 1 } },
    { id: "finanzas", nombre: "Finanzas", linea: "Bs 650 gastados · Bs 5.000 de ingresos", cambio: { texto: "▲ 63 % vs tu promedio", signo: -1 } },
    { id: "bici", nombre: "Bici", linea: "Sin rodadas", cambio: null }
  ]
};

test("la imagen de la semana: sin dinero y con lo importante", () => {
  const p = I.planSemana(SEMANA);
  const textos = p.textos.map(t => t.t);
  const todo = textos.join(" | ");
  assert.equal([p.ancho, p.alto].join("×"), "1080×1920");
  assert.ok(textos.includes("MI SEMANA") && textos.includes("9 – 15 nov") && textos.includes("Manolo"));
  assert.ok(/Semana de récords/.test(todo) && /🏅 Nuevo récord en 5K: 24:10/.test(todo) && /Hábitos atómicos/.test(todo));
  assert.ok(/21,3 km · 3 carreras/.test(todo) && /▲ 11,3 km/.test(todo));
  assert.ok(!/▼/.test(todo), "solo lo que mejoró");
  assert.ok(!/Bs\b|Gastaste|Finanzas|ingresos/.test(todo), "nada de dinero");
  assert.ok(!/Sin rodadas/.test(todo), "lo que no hiciste no va en la imagen");
  // Todo dentro de la imagen (con la medida aproximada).
  p.textos.forEach(t => {
    const w = I.medirAprox(t.t, t.tam);
    const izq = t.alinear === "center" ? t.x - w / 2 : t.x;
    assert.ok(izq >= 0 && izq + w <= p.ancho + 1 && t.y > 0 && t.y < p.alto, `dentro: ${t.t}`);
  });
});

test("cortar líneas y reconocer el dinero", () => {
  const medir = (t, tam) => t.length * tam * 0.5;
  assert.deepEqual(I.lineas("uno dos tres cuatro", 10, 400, 50, medir), ["uno dos", "tres", "cuatro"]);
  assert.deepEqual(I.lineas("", 10, 400, 50, medir), []);
  assert.ok(I.ES_DINERO("Bs 1.240 gastados") && I.ES_DINERO("Gastaste 18 % menos") && !I.ES_DINERO("21,3 km corriendo"));
  // Un titular larguísimo no pasa de 4 líneas.
  const largo = I.planSemana(Object.assign({}, SEMANA, { titular: "palabra ".repeat(200) }));
  assert.ok(largo.textos.filter(t => /^palabra/.test(t.t)).length <= 4);
});

// ---- "Tu año" (fase 4, D-140): cada diapositiva y la imagen final ----
const A = require("../js/resumen-anio.js");
const pad = n => String(n).padStart(2, "0");
function anioEjemplo() {
  const d = {
    hoy: "2026-11-16", running: [], bici: [], gimnasio: [], movilidad: [],
    habitos: { dias: {}, perfectos: [], lista: [] }, libros: { dias: {}, terminados: [] },
    biblia: { caps: [], vers: [], nombres: {} }, finanzas: { movs: [], cats: { casa: "Casa" } }, manana: [], lugares: []
  };
  for (let m = 1; m <= 10; m++) {
    const f = `2026-${pad(m)}-05`;
    d.running.push({ id: `r${m}`, fecha: f, km: 12.5, min: 70, desnivel: 80, mejores: { "5000": 1400 }, records: [] });
    d.gimnasio.push({ fecha: f, nombre: "Pierna", min: 50, series: 20, volumen: 5000, records: 1, ejercicios: ["Sentadilla"] });
    d.finanzas.movs.push({ fecha: f, tipo: "ingreso", cent: 900000, cat: "sueldo" }, { fecha: R2(f), tipo: "gasto", cent: 412345, cat: "casa" });
  }
  d.running.push({ id: "v1", fecha: "2025-03-03", km: 40, min: 220, desnivel: 10, records: [] });
  d.libros.terminados.push({ titulo: "Cien años de soledad", autor: "Gabriel García Márquez", fecha: "2026-06-01", calificacion: 5, paginas: 471 });
  d.extras = { libros: { terminados: 1, paginas: 471, diasLeidos: 30,
    fraseFav: { texto: "La vida no es la que uno vivió, sino la que uno recuerda y cómo la recuerda para contarla.", libro: "Vivir para contarla" } } };
  return A.anio(d, 2026);
}
function R2(f) { return f.slice(0, 8) + "20"; }
function dentro(p) {
  p.textos.forEach(t => {
    const w = I.medirAprox(t.t, t.tam);
    const izq = t.alinear === "center" ? t.x - w / 2 : t.x;
    assert.ok(izq >= 0 && izq + w <= p.ancho + 1 && t.y > 0 && t.y < p.alto - 60, `dentro: ${t.t}`);
  });
  (p.rayas || []).forEach(r => assert.ok(r.x >= 0 && r.x + r.w <= p.ancho && r.y >= 0 && r.y + r.h <= p.alto, "raya dentro"));
}

test("cada diapositiva del año se comparte como se ve, todo dentro y sin montos", () => {
  const y = anioEjemplo();
  const ds = A.diapositivas(y);
  assert.ok(ds.length >= 8);
  ds.forEach(s => {
    const p = I.planDiapositiva(s, null, 2026);
    dentro(p);
    const todo = p.textos.map(t => t.t).join(" | ");
    assert.ok(todo.startsWith("MI 2026 EN MANOLO") && /Manolo$/.test(todo), s.id);
    assert.ok(!/\bBs\b/.test(todo), `sin montos: ${s.id}`);
  });
  const run = I.planDiapositiva(ds.find(s => s.id === "running"), null, 2026);
  const tRun = run.textos.map(t => t.t);
  assert.ok(tRun.includes("Running") && tRun.includes("125") && tRun.includes("km corriendo"), tRun.join(" | "));
  assert.equal(run.rayas.length, 12, "la raya y una barra por mes hasta noviembre (el año va)");
  assert.ok(run.textos.some(t => /La más larga: 12,5 km/.test(t.t)));
  // Libros: la frase del año entra entera (en varias líneas) con su libro.
  const lib = I.planDiapositiva(ds.find(s => s.id === "libros"), null, 2026).textos.map(t => t.t).join(" ");
  assert.ok(/«La vida no es/.test(lib) && /contarla\.»/.test(lib) && /— Vivir para contarla/.test(lib), lib);
  // Finanzas: solo el porcentaje (es lo que la diapositiva comparte).
  const fin = I.planDiapositiva(ds.find(s => s.id === "finanzas"), null, 2026).textos.map(t => t.t);
  assert.ok(fin.includes("54 %") && !fin.some(t => /\d{3}\.\d{3}|Bs/.test(t)), fin.join(" | "));
  // Contra el año anterior: con su flecha.
  const vs = I.planDiapositiva(ds.find(s => s.id === "contra"), null, 2026).textos.map(t => t.t);
  assert.ok(vs.includes("▲ +85 km corriendo"), vs.join(" | "));
  // El año en números: de a dos, sin salirse.
  const nums = I.planDiapositiva(ds.find(s => s.id === "numeros"), null, 2026);
  assert.ok(nums.textos.some(t => t.t === "días con algo anotado"));
});

test("la imagen final del año: lo destacado, sin Finanzas ni dinero", () => {
  const y = anioEjemplo();
  const p = I.planAnio(y);
  dentro(p);
  const todo = p.textos.map(t => t.t).join(" | ");
  assert.ok(/^MI AÑO EN MANOLO \| 2026 \| Hasta el 16 de noviembre/.test(todo), todo);
  assert.ok(/🏃 125 km corriendo/.test(todo) && /🏋️ 10 entrenos/.test(todo) && /📚 1 libro/.test(todo), todo);
  assert.ok(/Libro del año: «Cien años de soledad»/.test(todo), todo);
  assert.ok(!/Bs|ahorr|gast|ingres|Finanzas/i.test(todo), "sin dinero");
  // Un año que terminó no dice "hasta".
  const viejo = I.planAnio(Object.assign({}, y, { completo: true }));
  assert.ok(!viejo.textos.some(t => /^Hasta el/.test(t.t)));
  assert.ok(I.ES_MONTO("Bs 1.240") && !I.ES_MONTO("54 % de lo que ganaste"));
});
