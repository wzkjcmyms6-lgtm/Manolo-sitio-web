// Ropa: lo que opina tu estilista (js/ropa-opinion-motor.js, D-160): lo que
// ve Manolo (los números de verdad), tu ropa con las veces, lo de tus pines,
// cada repaso guardado y "¿Qué opinas?".
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/ropa-motor.js");
const K = require("../js/ropa-compras-motor.js");
const P = require("../js/ropa-opinion-motor.js");

let k = 0;
const p = (grupo, tipo, color, extra) => R.normalizar(`x${++k}`, Object.assign({ grupo, tipo, colores: [{ id: color }], creado: Date.UTC(2026, 5, 1) }, extra || {}));
function ropero() {
  k = 0;
  return [
    ...Array.from({ length: 6 }, () => p("arriba", "Polera", "negro")),
    p("arriba", "Camisa", "blanco"), p("arriba", "Camisa", "blanco"), p("arriba", "Chompa", "bordo", { clima: ["frio"] }),
    p("abajo", "Jean", "azul-jean"), p("abajo", "Pantalón", "negro"),
    p("zapatos", "Zapatillas", "blanco"), p("zapatos", "Zapatos", "blanco"),
    p("arriba", "Polera", "rojo", { estado: "fuera" })
  ];
}
const HOY = "2026-11-24";

test("lo que ve Manolo: cuánto de cada parte, el color que domina, los zapatos, lo liso, lo formal, el clima y tus colores", () => {
  const r = ropero();
  const h = P.hechos(r, {}, HOY);
  assert.deepEqual(h.map(x => x.id), h.map((_, i) => `h${i + 1}`), "cada uno con su referencia");
  const t = h.map(x => x.texto);
  assert.equal(t[0], "Tienes 13 prendas: 9 de arriba, 2 de abajo y 2 pares de zapatos.", "sin lo que ya no tienes");
  assert.equal(t[1], "Tienes 9 de arriba y solo 2 de abajo.");
  assert.ok(t.includes("No tienes abrigos (chamarras, sacos, camperas…)."));
  assert.ok(t.includes("6 de tus 9 prendas de arriba son negras."), "un color que domina (la mitad o más)");
  assert.ok(t.includes("Tus 2 pares de zapatos son claros."));
  assert.ok(t.includes("Toda tu ropa es lisa: nada con estampado."));
  assert.ok(t.includes("No tienes nada muy formal (para una reunión o un evento)."));
  assert.ok(t.includes("No tienes nada marcado para el calor."));
  assert.ok(!t.some(x => /para el frío/.test(x)), "la chompa es para el frío");
  assert.ok(t.includes("Todavía no anotaste qué te pones: no sé qué usas más."));
  assert.ok(t.some(x => /^Tus colores: negro \(54 %\), blanco \(31 %\) y /.test(x)), t.find(x => /colores/.test(x)));
  assert.ok(t.includes("Tienes 6 parecidas a «Polera negra» (del mismo tipo y color)."));
  const tuyas = r.filter(x => x.estado !== "fuera");
  let pares = 0;
  tuyas.filter(x => x.grupo === "arriba").forEach(a => tuyas.filter(x => x.grupo === "abajo").forEach(b => { if (K.vanJuntas([a, b])) pares++; }));
  assert.equal(t[t.length - 1], `Con tu ropa salen ${pares} combinaciones de arriba y abajo que van juntas.`);
  assert.deepEqual(P.hechos([], {}, HOY), []);
});

test("lo que ve Manolo: lo que te pones y lo que no (de lo que anotaste), más de abajo, zapatos oscuros y hasta 15", () => {
  k = 0;
  const r = [p("arriba", "Polera", "blanco"), p("abajo", "Jean", "azul-jean"), p("abajo", "Pantalón", "negro"), p("abajo", "Falda", "beige"), p("abajo", "Short", "gris"),
    p("zapatos", "Botines", "negro"), p("zapatos", "Zapatos", "cafe-oscuro"), p("abrigos", "Chamarra", "negro", { clima: ["frio"], formalidad: 4 })];
  const usos = { "2026-11-20": { prendas: ["x1", "x2"] }, "2026-11-10": { prendas: ["x2"] }, "2026-11-01": { prendas: ["x1", "x2"] } };
  const t = P.hechos(r, usos, HOY).map(x => x.texto);
  assert.ok(t.includes("Tienes más de abajo (4) que de arriba (1)."));
  assert.ok(t.includes("Tus 2 pares de zapatos son oscuros."));
  assert.ok(t.includes("Lo que más te pones (en 3 meses): Jean azul (3 veces) y Polera blanca (2 veces)."), t.find(x => /más te pones/.test(x)));
  assert.ok(t.some(x => /^Hay \d+ prendas que no te pusiste en 3 meses o más \(según lo que anotaste\)\.$/.test(x)), "lo que no te pusiste");
  assert.ok(!t.some(x => /muy formal/.test(x)), "la chamarra es formal (4)");
  const mucha = Array.from({ length: 40 }, (_, i) => p(["arriba", "abajo", "zapatos", "cuerpo"][i % 4], "Polera", "negro"));
  assert.ok(P.hechos(mucha, {}, HOY).length <= 15, "hasta 15");
});

test("tu ropa para el repaso (con las veces) y lo de tus pines en palabras", () => {
  k = 0;
  const r = [p("arriba", "Polera", "blanco", { notas: "secreta" }), p("abajo", "Jean", "azul-jean", { estado: "lavar" }), p("arriba", "Camisa", "gris", { estado: "fuera" })];
  const x = P.roperoParaRepaso(r, { "2026-11-20": { prendas: ["x1"] }, "2026-11-21": { prendas: ["x1", "x2"] } });
  assert.deepEqual(x.map(y => [y.id, y.veces, y.lavar]), [["x1", 2, false], ["x2", 1, true]], "las veces; lo que ya no tienes no va");
  assert.ok(!JSON.stringify(x).includes("secreta"));
  assert.equal(P.pinesTexto([{ nombre: "Chamarra de cuero negra", n: 5, otroColor: false }, { nombre: "Jean recto", n: 3, otroColor: true }]),
    "Chamarra de cuero negra (en 5 pines); Jean recto (en 3 pines; tengo uno de otro color)");
  assert.equal(P.pinesTexto([]), "");
  assert.ok(P.pinesTexto(Array.from({ length: 8 }, () => ({ nombre: "x".repeat(120), n: 2 }))).length <= 600);
});

test("cada repaso guardado: limpio y el más nuevo primero", () => {
  const o = P.normalizar("o1", {
    fecha: "2026-11-24", creado: 5, n: 13,
    hechos: [{ id: "h1", texto: "Tienes 13 prendas." }, { id: "malo", texto: "x" }],
    ia: {
      resumen: "Buenas bases.", comentarios: [{ hecho: "h1", texto: "Suma algo." }, { hecho: "", texto: "x" }],
      sugerencias: [{ grupo: "abajo", tipo: "chino", color: "beige", porque: "Aclara.", combina: ["x1", "x1", "x2"] }, { grupo: "otro", tipo: "x" }],
      noComprar: ["Más poleras negras", ""], dejar: [{ prenda: "x3", porque: "No combina." }, { prenda: "" }],
      colores: { van: ["negro", "inventado"], sumar: ["beige", "verde-oliva", "celeste", "azul"], porque: "Tierra." }, consejos: ["a", "b", "c", "d"]
    }
  });
  assert.equal(o.hechos.length, 1);
  assert.deepEqual(o.ia.comentarios, [{ hecho: "h1", texto: "Suma algo." }]);
  assert.deepEqual(o.ia.sugerencias, [{ grupo: "abajo", tipo: "Chino", color: "beige", porque: "Aclara.", combina: ["x1", "x2"] }]);
  assert.deepEqual(o.ia.noComprar, ["Más poleras negras"]);
  assert.deepEqual(o.ia.dejar, [{ prenda: "x3", porque: "No combina." }]);
  assert.deepEqual(o.ia.colores, { van: ["negro"], sumar: ["beige", "verde-oliva", "celeste"], porque: "Tierra." });
  assert.equal(o.ia.consejos.length, 3);
  assert.equal(P.normalizar("x", null).ia.resumen, "");
  assert.deepEqual(P.ordenar([{ id: "a", creado: 1 }, { id: "b", creado: 3 }]).map(x => x.id), ["b", "a"]);
});

test("«¿Qué opinas?»: el veredicto en palabras y cambiar una prenda en un toque", () => {
  assert.equal(P.veredicto("muy-bien"), "Va muy bien");
  assert.equal(P.veredicto("cambiaria"), "Yo cambiaría algo");
  assert.equal(P.veredicto("raro"), "Va bien");
  assert.deepEqual(P.cambiar(["a", "b", "c"], "b", "z"), ["a", "z", "c"], "en el mismo lugar");
  assert.deepEqual(P.cambiar(["a", "b", "c"], "b", "c"), ["a", "c"], "si ya estaba, no se repite");
  assert.deepEqual(P.cambiar(["a", "b"], "x", "z"), ["a", "b"], "si no está, nada");
});

test("el aviso del día (D-161): lo que te sugirió tu estilista y le serviría al clima o a la ocasión del día", () => {
  const r = ropero();
  const sug = (grupo, tipo, color) => ({ grupo, tipo, color, porque: "", combina: [] });
  const op = { ia: { sugerencias: [sug("zapatos", "Botas", "cafe"), sug("abrigos", "Chamarra", "verde-oliva"), sug("arriba", "Cárdigan", "gris"), sug("abajo", "Bermuda", "beige"), sug("arriba", "Blazer", "azul-marino"), sug("accesorios", "Gorra", "negro")] } };
  const nec = extra => Object.assign({ base: "templado", abrigo: "", capas: false, lluvia: "", tormenta: false, nieve: false, viento: false, sol: false }, extra);
  const a = P.avisoDelDia(op, r, { nec: nec({ lluvia: "si" }) });
  assert.equal(a.motivo, "lluvia");
  assert.equal(a.i, 0);
  assert.equal(a.nombre, "Botas cafés");
  assert.equal(a.clave, K.clave(P.cosaDe(op.ia.sugerencias[0])));
  assert.equal(P.fraseAviso(a), "Para la lluvia de hoy, tu estilista te sugirió:");
  assert.equal(P.fraseAviso(a, true), "Para la lluvia de mañana, tu estilista te sugirió:");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ tormenta: true }) }).motivo, "lluvia", "con tormenta, también");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ abrigo: "abrigo" }) }).nombre, "Chamarra verde oliva", "con frío: un abrigo");
  const capas = P.avisoDelDia(op, r, { nec: nec({ capas: true, abrigo: "liviano" }) });
  assert.equal(capas.motivo, "capas");
  assert.equal(P.fraseAviso(capas), "Para ir en capas hoy, tu estilista te sugirió:");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ base: "calor" }) }).nombre, "Bermuda beige");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ sol: true }) }).nombre, "Gorra negra");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({}) }), null, "un día templado, sin lluvia: nada");
  const t = P.avisoDelDia(op, r, { nec: nec({}), ocasion: "trabajo" });
  assert.equal(t.nombre, "Blazer azul marino");
  assert.equal(P.fraseAviso(t), "Para el trabajo, tu estilista te sugirió:");
  assert.equal(P.avisoDelDia(op, r, { ocasion: "formal" }).motivo, "formal", "sin el clima: solo la ocasión");
  assert.equal(P.avisoDelDia(op, r, { ocasion: "casual" }), null);
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ lluvia: "si" }), ocasion: "trabajo" }).motivo, "lluvia", "el clima va primero");
  // Lo que ya tienes, lo que ya compraste o ya no quieres y lo que ocultaste: no.
  const conBotas = r.concat([p("zapatos", "Botines", "cafe")]);
  assert.equal(P.laTienes(op.ia.sugerencias[0], conBotas), true, "unos botines cafés son lo mismo");
  assert.equal(P.laTienes(op.ia.sugerencias[0], r.concat([p("zapatos", "Botas", "negro")])), false, "de otro color, no");
  assert.equal(P.laTienes(op.ia.sugerencias[0], r.concat([p("zapatos", "Botas", "cafe", { estado: "fuera" })])), false, "lo que ya no tienes no cuenta");
  assert.equal(P.avisoDelDia(op, conBotas, { nec: nec({ lluvia: "si" }) }), null, "ya tienes botas: no hay otra cosa para la lluvia");
  const k0 = K.clave(P.cosaDe(op.ia.sugerencias[0]));
  const deseo = estado => K.normalizarDeseo("d1", { grupo: "zapatos", tipo: "Botas", colores: ["cafe"], estado });
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ lluvia: "si" }), deseos: [deseo("comprado")] }), null, "ya la compraste");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ lluvia: "si" }), deseos: [deseo("descartado")] }), null, "ya no la quieres");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ lluvia: "si" }), deseos: [deseo("descartado"), deseo("quiero")] }).i, 0, "la volviste a pedir: sí");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ lluvia: "si" }), ocultos: [k0] }), null, "la ocultaste");
  assert.equal(P.avisoDelDia(op, r, { nec: nec({ lluvia: "si", abrigo: "abrigo" }), ocultos: [k0] }).motivo, "frio", "si ocultas una, puede salir otra");
  assert.equal(P.avisoDelDia(null, r, { nec: nec({ lluvia: "si" }) }), null);
  assert.equal(P.avisoDelDia({ ia: { sugerencias: [] } }, r, { nec: nec({ lluvia: "si" }) }), null);
  assert.deepEqual(P.cosaDe({ grupo: "abajo", tipo: "Chino", color: "inventado" }), { grupo: "abajo", tipo: "Chino", colores: [] });
  // Lo que ocultaste: sin repetir, hasta 30.
  assert.deepEqual(P.ocultar(["a", "b"], "a"), ["b", "a"]);
  assert.deepEqual(P.ocultar(null, "x"), ["x"]);
  assert.equal(P.ocultar(Array.from({ length: 40 }, (_, i) => `k${i}`), "nuevo").length, 30);
  assert.equal(P.ocultar(Array.from({ length: 40 }, (_, i) => `k${i}`), "nuevo").slice(-1)[0], "nuevo");
});

test("«Así lo usarías» (D-164): un outfit de ejemplo con tu ropa y la prenda que te sugirió", () => {
  const r = ropero();
  const chino = { grupo: "abajo", tipo: "Chino", color: "beige", porque: "", combina: [] };
  const o = P.ideaEnOutfit(chino, r, { usos: new Map(), hoy: HOY, outfits: [] });
  assert.ok(o.includes(P.IDEA), "con la prenda nueva");
  const por = new Map(r.map(p => [p.id, p]));
  const otras = o.filter(id => id !== P.IDEA).map(id => por.get(id));
  assert.ok(otras.length >= 2 && otras.every(Boolean), "y con prendas tuyas");
  assert.ok(otras.some(p => p.grupo === "arriba") && !otras.some(p => p.grupo === "abajo"), "algo de arriba; de abajo, solo el chino");
  assert.ok(!otras.some(p => p.estado === "fuera"), "sin lo que ya no tienes");
  assert.equal(P.ideaComoPrenda(chino).colores[0].id, "beige");
  const abrigo = P.ideaEnOutfit({ grupo: "abrigos", tipo: "Chamarra", color: "verde-oliva" }, r, {});
  assert.ok(abrigo.includes(P.IDEA) && abrigo.length >= 3, "un abrigo va sobre un outfit");
  assert.deepEqual(P.ideaEnOutfit({ grupo: "abajo", tipo: "Chino", color: "beige" }, [], {}), [], "sin ropa, no sale");
  assert.deepEqual(P.ideaEnOutfit(null, r, {}), []);
});
