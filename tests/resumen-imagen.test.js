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
