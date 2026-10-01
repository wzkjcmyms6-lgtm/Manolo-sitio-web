const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/actividad-analisis.js");

const M = 111195, T0 = Date.UTC(2026, 9, 1, 12);
// Tramo hacia el norte a v m/s durante s segundos, desde m0 metros y t0 segundos.
const tramo = (v, s, m0 = 0, t0 = 0, alt) => Array.from({ length: s + 1 }, (_, i) => ({
  lat: -16.5 + (m0 + v * i) / M, lon: -68.13, t: T0 + (t0 + i) * 1000, alt: alt ? alt(i) : null
}));

test("velocidad a lo largo del recorrido: constante si corres parejo", () => {
  const serie = A.serieVelocidad([tramo(3, 600)]);  // 1.800 m
  assert.ok(serie.length >= 18 && serie.length <= 60);
  serie.forEach(x => assert.ok(Math.abs(x.v - 3) < 0.05, `v=${x.v}`));
});

test("cambios de ritmo se ven por tramos", () => {
  const serie = A.serieVelocidad([tramo(2, 250).concat(tramo(4, 125, 500, 250).slice(1))]); // 500 m lento, 500 m rápido
  assert.ok(serie[0].v < 2.2 && serie[serie.length - 1].v > 3.8);
});

test("un hueco de señal no inventa velocidad (queda vacío)", () => {
  const serie = A.serieVelocidad([tramo(3, 200), tramo(3, 200, 900, 300)]);
  assert.ok(serie.some(x => x.v === null), "el tramo del hueco no tiene velocidad");
  assert.ok(serie.filter(x => x.v != null).every(x => Math.abs(x.v - 3) < 0.1));
});

test("altitud a lo largo del recorrido (si hay)", () => {
  const alt = A.serieAltitud([tramo(3, 300, 0, 0, i => 3600 + i * 0.1)]);
  assert.ok(alt.length > 10 && alt[alt.length - 1].alt > alt[0].alt);
  assert.deepEqual(A.serieAltitud([tramo(3, 50)]), []);
});

test("gráfico de línea: con datos dibuja, con poco no", () => {
  const svg = A.svgLinea([{ x: 0, y: 300 }, { x: 1, y: null }, { x: 2, y: 330 }, { x: 3, y: 320 }], { invertido: true, etiquetaY: y => `${y}s` });
  assert.ok(svg.includes("<path") && svg.includes("300s") && svg.includes("330s"));
  assert.equal(A.svgLinea([{ x: 0, y: 1 }]), "");
});

test("totales por semana: suma manuales y GPS; promedio con tiempo en movimiento", () => {
  const acts = [
    { date: "2026-09-29", distance: 5, duration: 30 },
    { date: "2026-09-30", distance: 3, duration: 20, fuente: "gps", tiempoMovS: 1080 },
    { date: "2026-09-22", distance: 10, duration: 60 },
    { date: "2026-01-01", distance: 99, duration: 1 }
  ];
  const s = A.porSemana(acts, "2026-10-01", 4);
  assert.equal(s.length, 4);
  assert.equal(s[3].desde, "2026-09-28");
  assert.equal(s[3].km, 8);
  assert.equal(s[3].n, 2);
  assert.equal(s[3].segMov, 30 * 60 + 1080);
  assert.equal(s[2].km, 10);
  const t = A.tendencia(A.porSemana(acts, "2026-10-01", 8));
  assert.equal(t.kmUltimas, 18);
});

test("mejores marcas: solo GPS; 5 km = mejores 5 parciales seguidos", () => {
  const acts = [
    { id: "a", date: "2026-09-01", fuente: "gps", distanciaM: 6000, tiempoMovS: 1900, parciales: [330, 320, 310, 300, 305, 340] },
    { id: "b", date: "2026-09-10", fuente: "gps", distanciaM: 3000, tiempoMovS: 840, parciales: [290, 280, 300] },
    { id: "c", date: "2026-09-15", distance: 21, duration: 90, distanciaM: 21000 } // a mano: no cuenta
  ];
  const m = A.mejores(acts, "running");
  const por = Object.fromEntries(m.map(x => [x.clave, x]));
  assert.equal(por["1k"].valor, 280);
  assert.equal(por["1k"].id, "b");
  assert.equal(por["5k"].valor, 330 + 320 + 310 + 300 + 305, "1.565 s: los 5 primeros km");
  assert.equal(por["5k"].id, "a");
  assert.ok(!por["10k"], "sin 10 km no hay marca");
  assert.equal(por.larga.valor, 6000, "la carrera a mano no cuenta");
  assert.equal(A.mejorVentana([300, 290, 280], 2), 570);
});

test("mejores en bici: más larga, mejor velocidad media (≥ 5 km) y mejor 5 km", () => {
  const acts = [
    { id: "x", date: "2026-09-01", fuente: "gps", distanciaM: 20000, tiempoMovS: 2400, parciales: [620, 600, 640, 610] },
    { id: "y", date: "2026-09-05", fuente: "gps", distanciaM: 3000, tiempoMovS: 300, parciales: [] }
  ];
  const por = Object.fromEntries(A.mejores(acts, "bicicleta").map(x => [x.clave, x]));
  assert.equal(por.larga.id, "x");
  assert.equal(por.media.id, "x", "la de 3 km no compite en velocidad media");
  assert.equal(por["5k"].valor, 600);
});

test("barras por semana: una por semana con su escala", () => {
  const html = A.htmlBarras([{ etiqueta: "1 sept", valor: 10, texto: "10 km" }, { etiqueta: "8 sept", valor: 0, texto: "0 km" }], { etiquetaEje: v => `${v} km` });
  assert.equal((html.match(/class="ejd-col"/g) || []).length, 2);
  assert.ok(html.includes("10 km"));
});

test("gráfico de línea: un ritmo casi parejo no se dibuja como serrucho", () => {
  const pts = [{ x: 0, y: 333 }, { x: 1, y: 334 }, { x: 2, y: 333 }];
  const ys = svg => (svg.match(/[ML][\d.]+,([\d.]+)/g) || []).map(t => Number(t.split(",")[1]));
  const sin = ys(A.svgLinea(pts)), con = ys(A.svgLinea(pts, { rangoMin: 30 }));
  assert.ok(Math.max(...sin) - Math.min(...sin) > 80, "sin rango mínimo ocupa todo el alto");
  assert.ok(Math.max(...con) - Math.min(...con) < 5, "con rango mínimo de 30 s casi plano");
});
