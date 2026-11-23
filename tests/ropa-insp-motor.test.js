// Ropa, inspiración (js/ropa-insp-motor.js, D-148): normalizar lo guardado,
// el nombre de lo que se ve, qué tan parecida es una prenda tuya, armar el
// look sin IA, "Mi estilo" sin IA y lo que se le manda a la IA.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/ropa-motor.js");
const I = require("../js/ropa-insp-motor.js");

const PIN = {
  esRopa: true, resumen: "Casual de invierno: abrigo camel largo con jean recto", estilo: ["casual", "clasico"], clima: ["frio"], formalidad: 2, ocasion: "fin de semana",
  prendas: [
    { grupo: "abrigos", tipo: "Abrigo", colores: ["camel"], estampado: "liso", tela: "Lana", detalle: "largo" },
    { grupo: "arriba", tipo: "Chompa", colores: ["crema"], estampado: "liso", tela: "Punto", detalle: "cuello alto" },
    { grupo: "abajo", tipo: "Jean", colores: ["azul-jean"], estampado: "liso", tela: "Jean", detalle: "recto" },
    { grupo: "zapatos", tipo: "Botines", colores: ["cafe"], estampado: "liso", tela: "Cuero", detalle: "" },
    { grupo: "accesorios", tipo: "Bufanda", colores: ["negro"], estampado: "liso", tela: "", detalle: "" }
  ]
};
const prenda = (id, grupo, tipo, color, extra) => M.normalizar(id, Object.assign({ grupo, tipo, colores: [color], estado: "activa" }, extra || {}));
const ROPERO = [
  prenda("abrigo", "abrigos", "Abrigo", "beige", { tela: "Lana" }),
  prenda("chamarra", "abrigos", "Chamarra", "camel"),
  prenda("chompa", "arriba", "Chompa", "blanco", { estado: "lavar" }),
  prenda("polera", "arriba", "Polera", "crema"),
  prenda("jean", "abajo", "Jean", "azul-jean", { tela: "Jean", notas: "la favorita", precio: 300, talla: "32" }),
  prenda("jean-negro", "abajo", "Jean", "negro", { estado: "fuera" }),
  prenda("zapas", "zapatos", "Zapatillas", "blanco")
];

test("una inspiración guardada se normaliza (un pin y una imagen subida)", () => {
  const p = I.normalizar("pin-111", {
    via: "tablero", creado: 1000, pin: { id: "111", url: "https://www.pinterest.com/pin/111/", titulo: "  Abrigo   camel ", img: "https://i.pinimg.com/736x/aa/bb/cc/x.jpg", fecha: 5 },
    fotos: [{ id: "f1", mini: "data:image/jpeg;base64,xx", ancho: 736, alto: 1100 }, { nada: 1 }],
    analisis: Object.assign({}, PIN, { prendas: PIN.prendas.concat([{ grupo: "luna" }]), formalidad: 9 }),
    ia: { fecha: "2026-11-22" }, look: { origen: "ia", fecha: "2026-11-22", prendas: [{ pin: 1, id: "abrigo", parecido: "rara" }, { pin: 0, id: "x" }], faltan: [{ pin: 4, grupo: "zapatos", tipo: "Botines", colores: ["cafe", "nada"] }], consejo: "Así." }
  });
  assert.equal(p.origen, "pinterest");
  assert.equal(p.via, "tablero");
  assert.equal(p.pin.titulo, "Abrigo camel");
  assert.equal(p.fotos.length, 1);
  assert.equal(p.analisis.prendas.length, 5, "sin la del grupo que no existe");
  assert.equal(p.analisis.formalidad, null);
  assert.deepEqual(p.look.prendas, [{ pin: 1, id: "abrigo", parecido: "parecida", porque: "" }]);
  assert.deepEqual(p.look.faltan[0].colores, ["cafe"]);
  assert.equal(I.titulo(p), "Abrigo camel");
  const f = I.normalizar("x1", { fotos: [{ id: "f2", mini: "" }], pin: { url: "sin id" }, oculta: "si" });
  assert.equal(f.origen, "foto");
  assert.equal(f.via, "foto");
  assert.equal(f.analisis, null);
  assert.equal(f.oculta, false);
  assert.equal(I.titulo(f), "Inspiración");
  assert.equal(I.titulo(Object.assign({}, f, { analisis: I.analisis(PIN) })), PIN.resumen);
  assert.equal(I.normalizar("x", { pin: { id: "1", url: "https://evil.com/", img: "https://evil.com/x.jpg" } }).pin.img, "", "la imagen solo de Pinterest");
  assert.equal(I.docDePin("424605071146401455"), "pin-424605071146401455");
  assert.equal(I.docDePin("a/b c"), "pin-abc");
});

test("orden, cuántas hay y cuáles le faltan a la IA", () => {
  const xs = [
    I.normalizar("a", { creado: 100, fotos: [{ id: "1" }] }),
    I.normalizar("b", { creado: 300, fotos: [{ id: "2" }], analisis: PIN }),
    I.normalizar("c", { creado: 300, fotos: [{ id: "3" }], pin: { id: "9", fecha: 50 } }),
    I.normalizar("d", { creado: 200, fotos: [{ id: "4" }], oculta: true }),
    I.normalizar("e", { creado: 50, fotos: [{ id: "5" }], iaError: { veces: 2 } }),
    I.normalizar("f", { creado: 40 })
  ];
  assert.deepEqual(I.ordenar(xs).map(p => p.id), ["c", "b", "d", "a", "e", "f"]);
  assert.deepEqual(I.porAnalizar(xs).map(p => p.id), ["a", "c"], "ni las ocultas, ni las que fallaron dos veces, ni sin foto");
  assert.deepEqual(I.resumen(xs), { total: 5, sinAnalizar: 4, conRopa: 1, ocultas: 1 });
});

test("el nombre de lo que se ve y la búsqueda en Pinterest", () => {
  const a = I.analisis(PIN);
  assert.deepEqual(a.prendas.map(I.nombreVista), ["Abrigo camel largo", "Chompa crema cuello alto", "Jean azul recto", "Botines cafés", "Bufanda negra"]);
  assert.equal(I.buscarEnPinterest(a.prendas[3]), "https://www.pinterest.com/search/pins/?q=Botines%20caf%C3%A9s");
  assert.equal(I.analisis(null), null);
  assert.deepEqual(I.analisis({ esRopa: false, prendas: PIN.prendas }).prendas, []);
});

test("qué tan parecida es una prenda tuya", () => {
  const [abrigo, chompa, jean, botines] = I.analisis(PIN).prendas;
  const por = id => ROPERO.find(p => p.id === id);
  assert.deepEqual(I.parecido(jean, por("jean")), { puntos: 9.5, tipo: "igual", color: "igual" }, "mismo tipo, color y tela");
  assert.deepEqual(I.parecido(abrigo, por("abrigo")), { puntos: 8.5, tipo: "igual", color: "familia" }, "camel y beige son de la misma familia");
  assert.deepEqual(I.parecido(abrigo, por("chamarra")), { puntos: 5, tipo: "otro", color: "igual" });
  assert.equal(I.parecido(chompa, por("jean")).puntos, 0, "otro grupo: nada");
  assert.equal(I.parecido(botines, por("zapas")).color, "no");
  assert.equal(I.familiaTipo("Pantalón de tela"), I.familiaTipo("Jean"));
  assert.equal(I.familiaTipo("Sweater"), "chompa");
  assert.equal(I.familiaTipo("Abrigo largo"), "abrigo");
});

test("armar el look sin IA: lo más parecido de tu ropa y lo que te falta", () => {
  const look = I.armarLocal(I.analisis(PIN), ROPERO);
  assert.equal(look.origen, "reglas");
  assert.deepEqual(look.prendas, [
    { pin: 1, id: "abrigo", parecido: "parecida", porque: "" },
    { pin: 2, id: "chompa", parecido: "parecida", porque: "" },
    { pin: 3, id: "jean", parecido: "igual", porque: "" }
  ], "el abrigo beige (no la chamarra camel), la chompa aunque esté para lavar, tu jean");
  assert.deepEqual(look.faltan, [{ pin: 4, grupo: "zapatos", tipo: "Botines", colores: ["cafe"], porque: "" }], "los botines; los accesorios no se piden");
  // Sin la chompa: la polera crema la reemplaza (otro tipo, mismo color).
  const sinChompa = I.armarLocal(I.analisis(PIN), ROPERO.filter(p => p.id !== "chompa"));
  assert.deepEqual(sinChompa.prendas.find(x => x.pin === 2), { pin: 2, id: "polera", parecido: "reemplazo", porque: "" });
  // La que ya no tienes no cuenta; cada prenda una sola vez.
  const dos = I.armarLocal({ prendas: [PIN.prendas[2], PIN.prendas[2]].map(v => I.analisis({ prendas: [v] }).prendas[0]) }, ROPERO);
  assert.deepEqual(dos.prendas.map(x => x.id), ["jean"]);
  assert.equal(dos.faltan.length, 1);
  assert.deepEqual(I.armarLocal(null, ROPERO), { origen: "reglas", prendas: [], faltan: [], consejo: "" });
  // Con el ropero de hoy: sin lo que borraste.
  const v = I.lookVigente(look, ROPERO.filter(p => p.id !== "chompa"));
  assert.deepEqual(v.prendas.map(x => x.id), ["abrigo", "jean"]);
  assert.equal(v.cambio, true);
  assert.equal(I.lookVigente(look, ROPERO).cambio, false);
  assert.equal(I.lookVigente(null, ROPERO), null);
});

test("a qué inspiración se parece un outfit (D-149)", () => {
  const insp = (id, analisis, extra) => I.normalizar(id, Object.assign({ via: "tablero", creado: 1, pin: { id, url: "https://www.pinterest.com/pin/1/", titulo: id }, analisis }, extra || {}));
  const camel = insp("camel", PIN);
  const oficina = insp("oficina", { esRopa: true, resumen: "Oficina", prendas: [
    { grupo: "arriba", tipo: "Camisa", colores: ["celeste"] }, { grupo: "abajo", tipo: "Pantalón de tela", colores: ["negro"] }, { grupo: "zapatos", tipo: "Mocasines", colores: ["cafe"] }] });
  const botines = prenda("botines", "zapatos", "Botines", "cafe-oscuro");
  const de = ids => ids.map(id => (id === "botines" ? botines : ROPERO.find(p => p.id === id)));
  // Abrigo beige (de la familia del camel: 0,7), polera crema (la chompa es otro
  // tipo: no cuenta), el jean igual (1) y botines café oscuro (0,7): 2,4 de 4.
  assert.deepEqual(I.parecidaA(de(["abrigo", "polera", "jean", "botines"]), [oficina, camel]), { id: "camel", puntos: 0.6 });
  assert.equal(I.parecidaA(de(["abrigo", "polera", "jean", "zapas"]), [oficina, camel]), null, "con zapatillas: 1,7 de 4, menos de la mitad");
  assert.equal(I.parecidaA(de(["polera", "zapas"]), [camel, oficina]), null, "sin nada parecido, nada");
  assert.equal(I.parecidaA(de(["abrigo", "polera", "jean", "botines"]), [Object.assign({}, camel, { oculta: true })]), null, "las que quitaste no cuentan");
  // La chamarra camel (otro tipo de abrigo: no cuenta) y el jean: 1 de 4, no alcanza.
  assert.equal(I.parecidaA(de(["chamarra", "polera", "jean"]), [camel]), null);
  // Si la IA ya armó ese look con tu ropa y el outfit lleva 2 de esas prendas, gana.
  const conLook = insp("con-look", PIN, { look: { origen: "ia", fecha: "2026-11-22", prendas: [{ pin: 1, id: "chamarra", parecido: "reemplazo", porque: "" }, { pin: 3, id: "jean", parecido: "igual", porque: "" }], faltan: [], consejo: "" } });
  assert.deepEqual(I.parecidaA(de(["chamarra", "polera", "jean"]), [camel, conLook]), { id: "con-look", puntos: 1.2 });
  assert.equal(I.parecidaA([], [camel]), null);
});

test("lo que se le manda a la IA: sin notas, talla, precio ni fotos", () => {
  const r = I.roperoParaIA(ROPERO);
  assert.ok(!r.some(p => p.id === "jean-negro"), "sin las que ya no tienes");
  assert.deepEqual(r.find(p => p.id === "jean"), { id: "jean", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"], estampado: "", tela: "Jean", estilo: [], clima: [], formalidad: null, marca: "", lavar: false });
  assert.equal(r.find(p => p.id === "chompa").lavar, true);
  assert.ok(!JSON.stringify(r).includes("favorita"));
  const pin = I.pinParaIA(I.analisis(PIN));
  assert.deepEqual(Object.keys(pin).sort(), ["clima", "estilo", "formalidad", "ocasion", "prendas", "resumen"]);
  const xs = [1, 2, 3, 4].map(n => I.normalizar(`p${n}`, { creado: n, fotos: [{ id: String(n) }], analisis: n === 4 ? { esRopa: false } : PIN }));
  assert.equal(I.pinesParaEstilo(xs).length, 3, "solo los que tienen ropa");
});

test("mi estilo sin IA: lo que más se repite en tus pines", () => {
  const otro = { esRopa: true, estilo: ["casual", "urbano"], clima: ["templado"], formalidad: 3, prendas: [
    { grupo: "abajo", tipo: "Pantalón de tela", colores: ["negro"] }, { grupo: "arriba", tipo: "Camisa", colores: ["blanco", "crema"] }, { grupo: "zapatos", tipo: "Botines", colores: ["cafe-oscuro"] }] };
  const xs = [I.normalizar("a", { analisis: PIN }), I.normalizar("b", { analisis: PIN }), I.normalizar("c", { analisis: otro }), I.normalizar("d", { analisis: otro, oculta: true }), I.normalizar("e", {})];
  const e = I.estiloLocal(xs);
  assert.equal(e.n, 3);
  assert.deepEqual(e.estilos.map(x => [x.nombre, x.n]), [["Casual", 3], ["Clásico", 2], ["Urbano", 1]]);
  // Blanco y crema son una sola familia (cuenta una vez por pin); el nombre es el primero que se vio.
  assert.deepEqual(e.colores.map(x => [x.nombre, x.n]), [["Crema", 3], ["Café", 3], ["Negro", 3], ["Camel", 2], ["Azul jean", 2]]);
  assert.deepEqual(e.prendas.find(x => x.tipo === "Botines"), { tipo: "Botines", n: 3 });
  assert.deepEqual(e.prendas.find(x => x.tipo === "Jean"), { tipo: "Jean", n: 3 }, "jean y pantalón de tela son de la misma familia");
  assert.equal(e.formalidad, 2);
  assert.equal(I.estiloLocal([]).n, 0);
  assert.deepEqual(I.estiloGuardado({ resumen: " Te gustan los neutros. ", claves: ["neutros", "neutros", "capas"], colores: ["camel", "nada"], prendas: [], fecha: "2026-11-22", pines: 4.2, corregido: true }),
    { resumen: "Te gustan los neutros.", claves: ["neutros", "capas"], colores: ["camel"], prendas: [], fecha: "2026-11-22", pines: 4, corregido: true });
  assert.equal(I.estiloGuardado({ resumen: "" }), null);
});

test("qué parece un link de Pinterest", () => {
  ["https://pin.it/2Ab3Cd4Ef", "Mira este pin https://pin.it/2Ab3Cd4Ef", "https://www.pinterest.com/pin/123/", "es.pinterest.com/pin/123/", "https://pinterest.com.mx/juanito/manolo/"]
    .forEach(s => assert.equal(I.esLinkPinterest(s), true, s));
  ["", "hola", "https://example.com/pin/1", "pin.it/", "https://pinterest.com"].forEach(s => assert.equal(I.esLinkPinterest(s), false, s));
});
