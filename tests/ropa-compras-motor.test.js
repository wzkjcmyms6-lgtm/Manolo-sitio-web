// Ropa, compras desde Pinterest (js/ropa-compras-motor.js, D-150): qué te
// falta según tus inspiraciones, cuántos outfits nuevos te daría, qué no
// comprar, lo que gastaste en el mes y la lista de deseos.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/ropa-motor.js");
const I = require("../js/ropa-insp-motor.js");
const K = require("../js/ropa-compras-motor.js");

const pr = (id, grupo, tipo, color, extra) => M.normalizar(id, Object.assign({ grupo, tipo, colores: color ? [{ id: color }] : [], estado: "activa" }, extra || {}));
const ROPERO = [
  pr("polera-b", "arriba", "Polera", "blanco", { clima: ["templado", "calor"], formalidad: 2 }),
  pr("camisa-c", "arriba", "Camisa", "celeste", { clima: ["templado"], formalidad: 3 }),
  pr("polera-r", "arriba", "Polera", "rojo", { clima: ["calor"], formalidad: 1 }),
  pr("camisa-b", "arriba", "Camisa", "blanco", { clima: ["templado"], formalidad: 3, estado: "lavar" }),
  pr("jean", "abajo", "Jean", "azul-jean", { clima: ["frio", "templado"], formalidad: 2 }),
  pr("chino", "abajo", "Pantalón de tela", "beige", { clima: ["templado"], formalidad: 3 }),
  pr("short", "abajo", "Short", "azul-marino", { clima: ["calor"], formalidad: 1 }),
  pr("zapas", "zapatos", "Zapatillas", "blanco", { formalidad: 2 }),
  pr("abrigo-n", "abrigos", "Abrigo", "negro", { clima: ["frio"], formalidad: 3 }),
  pr("botas-viejas", "zapatos", "Botines", "cafe", { estado: "fuera" })
];
const v = (grupo, tipo, color, extra) => Object.assign({ grupo, tipo, colores: color ? [color] : [], estampado: "liso", tela: "", detalle: "" }, extra || {});
const pin = (id, prendas, extra) => I.normalizar(id, Object.assign({ via: "tablero", creado: 1, pin: { id, url: `https://www.pinterest.com/pin/${id}/`, titulo: id },
  analisis: { esRopa: true, resumen: id, estilo: ["casual"], clima: ["frio"], formalidad: 2, ocasion: "", prendas } }, extra || {}));
// 6 pines con un abrigo camel (en uno, dos veces), 3 con botines café, 2 con
// una camisa blanca (la tienes), 1 con una falda y lentes en 4.
const PINES = [
  pin("p1", [v("abrigos", "Abrigo", "camel"), v("arriba", "Polera", "blanco"), v("abajo", "Jean", "azul-jean"), v("zapatos", "Botines", "cafe"), v("accesorios", "Lentes", "negro")]),
  pin("p2", [v("abrigos", "Abrigo", "camel"), v("abrigos", "Abrigo", "camel", { detalle: "largo" }), v("zapatos", "Botines", "cafe"), v("accesorios", "Lentes", "negro")]),
  pin("p3", [v("abrigos", "Abrigo", "camel"), v("arriba", "Camisa", "blanco"), v("zapatos", "Botines", "cafe-oscuro"), v("accesorios", "Lentes", "negro")]),
  pin("p4", [v("abrigos", "Abrigo", "camel"), v("arriba", "Camisa", "blanco"), v("accesorios", "Lentes", "negro")]),
  pin("p5", [v("abrigos", "Abrigo", "camel"), v("abajo", "Falda", "negro")]),
  pin("p6", [v("abrigos", "Abrigo", "camel")], { analisis: { esRopa: true, resumen: "x", estilo: [], clima: ["frio", "templado"], formalidad: 3, ocasion: "", prendas: [v("abrigos", "Abrigo", "camel")] } }),
  pin("oculto", [v("abrigos", "Abrigo", "camel"), v("abajo", "Falda", "negro")], { oculta: true }),
  pin("sin-ropa", [], { analisis: { esRopa: false, resumen: "Un paisaje", estilo: [], clima: [], formalidad: null, ocasion: "", prendas: [] } }),
  I.normalizar("sin-mirar", { via: "foto", creado: 2, fotos: [{ id: "f", mini: "data:,", ancho: 1, alto: 1 }] })
];

test("qué te falta: lo que se repite en tus pines y no tienes", () => {
  const f = K.faltan(PINES, ROPERO);
  assert.deepEqual(f.map(x => [x.nombre, x.n]), [["Abrigo camel", 6], ["Botines cafés", 3]], "la falda (1 pin), los lentes (accesorio) y la camisa blanca (la tienes, aunque esté para lavar) no");
  const [abrigo, botines] = f;
  assert.deepEqual(abrigo.pines, ["p1", "p2", "p3", "p4", "p5", "p6"], "cada pin una vez; el que quitaste, no");
  assert.equal(abrigo.otroColor, true, "tienes un abrigo, pero negro");
  assert.deepEqual([abrigo.grupo, abrigo.tipo, abrigo.colores, abrigo.clima, abrigo.formalidad], ["abrigos", "Abrigo", ["camel"], ["frio", "templado"], 2]);
  assert.equal(botines.otroColor, false, "los botines que ya no tienes no cuentan");
  assert.deepEqual(botines.colores, ["cafe"], "el color que más se repite (café oscuro es de la familia)");
  assert.equal(K.faltan(PINES, ROPERO, 4).length, 1, "con un mínimo de 4 pines, solo el abrigo");
  // Con un abrigo beige (de la familia del camel), ya no falta.
  assert.deepEqual(K.faltan(PINES, ROPERO.concat([pr("abrigo-b", "abrigos", "Abrigo", "beige")])).map(x => x.nombre), ["Botines cafés"]);
  assert.deepEqual(K.faltan([], ROPERO), []);
  assert.deepEqual(K.faltan(PINES, []).map(x => x.nombre), ["Abrigo camel", "Botines cafés", "Camisa blanca"], "sin ropa, te falta todo lo que se repite");
});

test("cuántos outfits nuevos te daría (con tu ropa, con reglas)", () => {
  const [abrigo, botines] = K.faltan(PINES, ROPERO);
  // El abrigo (sus pines: frío y templado) va con tus 12 conjuntos (4 de arriba por 3 de abajo).
  assert.equal(K.outfitsNuevos(abrigo, ROPERO), 12);
  // Los botines (sus pines: solo frío) no van con lo que es solo de calor (la polera roja y el short).
  assert.equal(K.outfitsNuevos(botines, ROPERO), 6, "polera blanca, camisa celeste o camisa blanca, con jean o pantalón de tela");
  assert.equal(K.outfitsNuevos({ grupo: "zapatos", tipo: "Sandalias", colores: ["cafe"], clima: ["calor"], formalidad: 1 }, ROPERO), 12, "sandalias de calor: el jean también es de templado");
  // Lo de arriba, con cada cosa de abajo que va.
  assert.equal(K.outfitsNuevos({ grupo: "arriba", tipo: "Camisa", colores: ["blanco"], clima: ["templado"], formalidad: 3 }, ROPERO), 3);
  assert.equal(K.outfitsNuevos({ grupo: "arriba", tipo: "Chompa", colores: ["amarillo"], clima: ["frio"], formalidad: 2, estampado: "rayas" }, ROPERO), 2, "de frío: con el jean y el pantalón de tela");
  assert.equal(K.outfitsNuevos({ grupo: "abajo", tipo: "Falda", colores: ["negro"], formalidad: 5 }, ROPERO), 2, "muy formal: solo con las camisas");
  assert.equal(K.outfitsNuevos({ grupo: "cuerpo", tipo: "Vestido", colores: ["negro"] }, ROPERO), 1, "un vestido: con cada par de zapatos");
  assert.equal(K.outfitsNuevos({ grupo: "cuerpo", tipo: "Vestido", colores: ["negro"] }, []), 1, "sin zapatos, el vestido solo");
  assert.equal(K.outfitsNuevos({ grupo: "accesorios", tipo: "Lentes", colores: ["negro"] }, ROPERO), 0);
  // Las reglas de "van juntas".
  const p = (grupo, color, extra) => pr("x", grupo, "X", color, extra);
  assert.ok(!K.vanJuntas([p("arriba", "rojo"), p("abajo", "amarillo"), p("zapatos", "celeste")]), "tres colores fuertes, no");
  assert.ok(K.vanJuntas([p("arriba", "rojo"), p("abajo", "amarillo"), p("zapatos", "blanco")]), "dos, sí");
  assert.ok(!K.vanJuntas([p("arriba", "blanco", { estampado: "rayas" }), p("abajo", "negro", { estampado: "cuadros" })]), "dos estampados, no");
  assert.ok(!K.vanJuntas([p("arriba", "blanco", { formalidad: 1 }), p("abajo", "negro", { formalidad: 4 })]), "de 1 a 4 de formal, no");
  assert.ok(!K.vanJuntas([p("arriba", "blanco", { clima: ["calor"] }), p("abrigos", "negro", { clima: ["frio"] })]), "calor con frío, no");
  assert.ok(K.vanJuntas([p("arriba", "blanco", { clima: ["calor"] }), p("abajo", "negro", { clima: ["templado"] }), p("zapatos", "negro")]), "climas vecinos, sí");
});

test("qué no comprar: lo que ya tienes de sobra", () => {
  const ropero = ROPERO.concat([
    pr("pn1", "arriba", "Polera", "negro"), pr("pn2", "arriba", "Polera", "negro"), pr("pn3", "arriba", "Polera con cuello", "gris-oscuro"),
    pr("pn4", "arriba", "Polera", "negro", { estado: "lavar" }), pr("pn5", "arriba", "Polera", "negro", { estado: "fuera" }),
    pr("j2", "abajo", "Jean", "azul-jean"), pr("j3", "abajo", "Pantalón", "azul")
  ]);
  assert.deepEqual(K.deSobra(ropero).map(x => [x.nombre, x.n]), [["Polera negra", 4], ["Jean azul", 3]], "las de lavar sí cuentan; las que ya no tienes, no; el gris oscuro es de la familia del negro; jean y pantalón azul, lo mismo");
  assert.deepEqual(K.deSobra(ropero)[0].prendas, ["pn1", "pn2", "pn3", "pn4"]);
  assert.deepEqual(K.deSobra(ROPERO), []);
  assert.equal(K.deSobra(ropero, 4).length, 1);
});

test("lo que gastaste en ropa este mes y tu presupuesto", () => {
  const ropero = [
    pr("a", "arriba", "Polera", "blanco", { compra: "2026-11-05", precio: 200 }),
    pr("b", "abajo", "Jean", "azul-jean", { compra: "2026-11-20", precio: 150.5 }),
    pr("c", "zapatos", "Zapatillas", "blanco", { compra: "2026-11-21" }),
    pr("d", "abrigos", "Chamarra", "negro", { compra: "2026-10-30", precio: 900 }),
    pr("e", "arriba", "Camisa", "celeste", { compra: "2026-11-02", precio: 120, estado: "fuera" })
  ];
  assert.deepEqual(K.gastoDelMes(ropero, "2026-11"), { total: 470.5, n: 3, sinPrecio: 1 }, "lo de octubre no; lo que ya no tienes, sí (lo compraste este mes)");
  assert.deepEqual(K.gastoDelMes([], "2026-11"), { total: 0, n: 0, sinPrecio: 0 });
  assert.deepEqual([K.presupuesto(800), K.presupuesto(0), K.presupuesto(-5), K.presupuesto("800"), K.presupuesto(250000), K.presupuesto(99.999)], [800, null, null, null, null, 100]);
});

test("la lista de deseos: limpia, con su clave, y la búsqueda en Pinterest", () => {
  const d = K.normalizarDeseo("w1", { grupo: "abrigos", tipo: "  Abrigo  ", colores: ["camel", "nada", "camel"], nota: "  largo   hasta la rodilla ", inspiraciones: ["p1", "p1", "", 5, "p2"], origen: "falta", estado: "quiero", creado: 10 });
  assert.deepEqual(d, { id: "w1", grupo: "abrigos", tipo: "Abrigo", colores: ["camel"], clave: "abrigos|abrigo|beige", nombre: "Abrigo camel", nota: "largo hasta la rodilla",
    inspiraciones: ["p1", "p2"], origen: "falta", estado: "quiero", prendaId: "", compradoFecha: "", creado: 10, editado: 0 });
  const raro = K.normalizarDeseo("w2", { grupo: "luna", estado: "robado", origen: "x", compradoFecha: "ayer" });
  assert.deepEqual([raro.grupo, raro.tipo, raro.estado, raro.origen, raro.compradoFecha], ["arriba", "Prenda", "quiero", "manual", ""]);
  // La misma cosa (chaqueta y chamarra, camel y beige) tiene la misma clave.
  assert.equal(K.clave({ grupo: "abrigos", tipo: "Chaqueta", colores: ["camel"] }), K.clave({ grupo: "abrigos", tipo: "Chamarra", colores: [{ id: "beige" }] }));
  assert.equal(K.buscar({ tipo: "Abrigo", colores: ["camel"] }), "https://www.pinterest.com/search/pins/?q=abrigo%20camel%20outfit");
  assert.equal(K.buscar({ tipo: "Botines", colores: ["cafe"] }), "https://www.pinterest.com/search/pins/?q=botines%20caf%C3%A9s%20outfit");
});
