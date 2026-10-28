const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/inversiones-graficos.js");

test("escala redonda y números cortos", () => {
  assert.deepEqual(G.escala(0, 237), { min: 0, max: 250, ticks: [0, 50, 100, 150, 200, 250], dec: 0 });
  const chica = G.escala(0, 0.21);
  const rotulos = chica.ticks.map(t => G.corto(t, chica.dec));
  assert.equal(new Set(rotulos).size, rotulos.length, `rótulos sin repetir (${rotulos.join(" · ")})`);
  assert.deepEqual(rotulos.slice(0, 3), ["0", "0,05", "0,1"]);
  assert.deepEqual(G.escala(0, 0).ticks.slice(0, 2), [0, 0.2], "todo en cero no rompe");
  const neg = G.escala(-40, 210);
  assert.ok(neg.min <= -40 && neg.max >= 210 && neg.ticks.includes(0));
  assert.equal(G.corto(1500), "1,5 mil");
  assert.equal(G.corto(200), "200");
  assert.equal(G.corto(-50), "−50");
  assert.equal(G.corto(2.5), "2,5");
  assert.equal(G.fechaCorta("2026-10-02"), "2 oct");
});

test("líneas: al ancho pedido, 2 px, área suave y punto final con anillo", () => {
  const fechas = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  const g = G.lineas({ ancho: 358, alto: 190, fechas, series: [
    { id: "valor", nombre: "Valor", color: G.COLORES.principal, valores: [100, 120, 110, 130], area: true },
    { id: "aportado", nombre: "Aportado", color: G.COLORES.contexto, valores: [100, 100, 100, 100], escalon: true }
  ] });
  assert.match(g.svg, /width="358" height="190"/);
  assert.equal(g.xs.length, 4);
  assert.equal(g.xs[0], g.izq);
  assert.equal(g.xs[3], 358 - g.der);
  assert.ok(g.ys.valor[3] < g.ys.valor[0], "más valor = más arriba");
  assert.match(g.svg, /stroke-width="2" stroke-linejoin="round"/);
  assert.match(g.svg, /fill-opacity="0.1"/);
  assert.match(g.svg, /r="4" fill="#e8651f" stroke="#161616" stroke-width="2"/);
  assert.match(g.svg, /H[\d.]+V/, "aportado va en escalones");
  assert.ok(!/<text[^>]*fill="#e8651f"/.test(g.svg), "el texto no usa el color de la serie");
  assert.match(g.svg, /1 oct<\/text>/);
  assert.match(g.svg, /4 oct<\/text>/);
  const uno = G.lineas({ ancho: 300, fechas: ["2026-10-01"], series: [{ id: "a", color: "#000", valores: [5] }] });
  assert.equal(uno.xs.length, 1, "un solo día no rompe");
});

test("columnas: hasta 24 px, punta redondeada, valores y meta", () => {
  const barras = [{ etiqueta: "sep", valor: 30 }, { etiqueta: "oct", valor: 294.85 }];
  const g = G.columnas({ ancho: 358, barras, color: G.COLORES.principal, meta: { valor: 199.98, texto: "Meta US$ 199,98" } });
  assert.ok(g.grosor <= 24);
  assert.equal((g.svg.match(/class="inv-g-barra"/g) || []).length, 2);
  assert.match(g.svg, /Q/, "punta redondeada");
  assert.match(g.svg, />295<\/text>/, "valor en la punta (pocas columnas: todas)");
  assert.match(g.svg, /Meta US\$ 199,98/);
  const muchas = G.columnas({ ancho: 358, barras: Array.from({ length: 14 }, (_, i) => ({ etiqueta: String(i), valor: i === 4 ? 500 : 100 + i })), color: "#000" });
  assert.equal((muchas.svg.match(/class="inv-g-valor"/g) || []).length, 2, "con muchas, solo la última y la mayor");
  const neg = G.columnas({ ancho: 300, barras: [{ etiqueta: "a", valor: -20 }, { etiqueta: "b", valor: 50 }], color: "#000" });
  assert.equal((neg.svg.match(/class="inv-g-barra"/g) || []).length, 2, "un mes con retiro (negativo) se dibuja");
  assert.ok(!/<script|onerror/i.test(G.lineas({ ancho: 300, titulo: "<script>", fechas: ["2026-10-01", "2026-10-02"], series: [{ id: "x", color: "#000", valores: [1, 2] }] }).svg), "el título se escapa");
});
