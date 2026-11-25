// Ropa, outfits sin IA (js/ropa-outfit-motor.js, D-149): solo con tu ropa,
// con el clima de cualquier ciudad (días de verdad de La Paz y Santa Cruz),
// la ocasión, los colores, lo que te pusiste y lo que aprendió de ti; "¿Con
// qué combino esto?" y revisar lo que contesta la IA.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/ropa-motor.js");
const O = require("../js/ropa-outfit-motor.js");
const C = require("../js/ropa-clima.js");
const LA_PAZ = C.necesidades(C.leer(require("./fixtures/clima/la-paz-2026-11-23.json"))[0], "normal");
const SANTA_CRUZ = C.necesidades(C.leer(require("./fixtures/clima/santa-cruz-2026-11-23.json"))[0], "normal");
const HOY = "2026-11-23";

const pr = (id, grupo, tipo, color, extra) => M.normalizar(id, Object.assign({ grupo, tipo, colores: [{ id: color }], estado: "activa" }, extra || {}));
const ROPERO = [
  pr("polera-b", "arriba", "Polera", "blanco", { clima: ["templado", "calor"], formalidad: 2, estilo: ["casual"] }),
  pr("camisa-c", "arriba", "Camisa", "celeste", { clima: ["templado"], formalidad: 3, estilo: ["clasico"] }),
  pr("chompa-bo", "arriba", "Chompa", "bordo", { clima: ["frio"], formalidad: 2, estilo: ["casual"] }),
  pr("polera-r", "arriba", "Polera", "rojo", { clima: ["calor"], formalidad: 1 }),
  pr("jean", "abajo", "Jean", "azul-jean", { clima: ["frio", "templado"], formalidad: 2, estilo: ["casual", "urbano"] }),
  pr("chino", "abajo", "Pantalón de tela", "beige", { clima: ["templado"], formalidad: 3, estilo: ["clasico"] }),
  pr("short", "abajo", "Short", "azul-marino", { clima: ["calor"], formalidad: 1 }),
  pr("zapas", "zapatos", "Zapatillas", "blanco", { formalidad: 2 }),
  pr("sandalias", "zapatos", "Sandalias", "cafe", { clima: ["calor"], formalidad: 1 }),
  pr("botines", "zapatos", "Botines", "cafe-oscuro", { clima: ["frio", "templado"], formalidad: 3 }),
  pr("chamarra", "abrigos", "Chamarra", "verde-oliva", { clima: ["frio"], formalidad: 2 }),
  pr("rompe", "abrigos", "Rompevientos", "negro", { clima: ["templado"], formalidad: 1 }),
  pr("gorra", "accesorios", "Gorra", "negro"), pr("lentes", "accesorios", "Lentes", "negro"), pr("cinturon", "accesorios", "Cinturón", "cafe"),
  pr("camisa-lavar", "arriba", "Camisa", "blanco", { estado: "lavar", clima: ["templado"], formalidad: 3 }),
  pr("saco-fuera", "abrigos", "Saco", "azul-marino", { estado: "fuera", clima: ["templado"], formalidad: 4 })
];
const usos = M.usos({ "2026-11-22": { prendas: ["jean"] } });
const armar = (nec, extra) => O.armar(ROPERO, Object.assign({ nec, ocasion: "casual", usos, hoy: HOY, outfits: [] }, extra || {}));
const grupos = (ids) => ids.map(id => ROPERO.find(p => p.id === id).grupo);

test("La Paz (capas y sol): 3 opciones distintas, con abrigo, solo con tu ropa", () => {
  const r = armar(LA_PAZ);
  assert.equal(r.falta, "");
  assert.equal(r.opciones.length, 3);
  r.opciones.forEach(o => {
    assert.ok(o.prendas.includes("chamarra") || o.prendas.includes("rompe"), "con abrigo para la mañana");
    assert.ok(!o.prendas.includes("camisa-lavar") && !o.prendas.includes("saco-fuera"), "nada para lavar ni lo que ya no tienes");
    assert.ok(!o.prendas.includes("sandalias"), "sin sandalias a 9 °C");
    assert.ok(o.prendas.includes("lentes") && o.prendas.includes("gorra"), "sol muy fuerte: gorra y lentes");
    assert.deepEqual(grupos(o.prendas).slice(0, 4), ["abrigos", "arriba", "abajo", "zapatos"], "en orden: abrigo, arriba, abajo, zapatos");
  });
  const [a, b, c] = r.opciones;
  const cambia = (x, y) => x.prendas.filter(id => !y.prendas.includes(id)).length;
  assert.ok(cambia(a, b) >= 2 && cambia(a, c) >= 2 && cambia(b, c) >= 2, "cada una cambia al menos dos prendas");
  assert.deepEqual(a.prendas.slice(0, 4), ["chamarra", "polera-b", "chino", "zapas"], "el jean de ayer, mejor no");
  assert.equal(a.nombre, "Todo neutro");
  assert.equal(a.porque, "Chamarra verde oliva para la mañana fría; colores neutros que combinan solos.");
  assert.equal(a.capas, "Para la mañana, chamarra verde oliva; al mediodía ya no hace falta.");
});

test("Santa Cruz (calor y lluvia): sin abrigo, liviano y zapatos cerrados", () => {
  const r = armar(SANTA_CRUZ);
  assert.equal(r.opciones.length, 3);
  r.opciones.forEach(o => assert.ok(!o.prendas.some(id => ["chamarra", "rompe", "chompa-bo"].includes(id)), "nada de abrigo ni chompa"));
  assert.deepEqual(r.opciones[0].prendas, ["polera-b", "short", "zapas", "gorra", "lentes"]);
  assert.ok(!r.opciones[0].prendas.includes("sandalias"), "con lluvia, zapatos cerrados primero");
  assert.equal(r.opciones[0].porque, "Liviano para el calor; colores neutros que combinan solos.");
  assert.equal(r.opciones[0].capas, "");
  // Para el trabajo: sin gorra (sí lentes) y con cinturón.
  const t = armar(SANTA_CRUZ, { ocasion: "trabajo" }).opciones[0];
  assert.deepEqual(t.prendas, ["camisa-c", "chino", "botines", "lentes", "cinturon"]);
  // De noche, nada para el sol.
  assert.ok(armar(SANTA_CRUZ, { ocasion: "noche" }).opciones.every(o => !o.prendas.includes("lentes") && !o.prendas.includes("gorra")));
});

test("¿Con qué combino esto?: la prenda va en las tres", () => {
  const r = armar(LA_PAZ, { base: "chino" });
  assert.equal(r.opciones.length, 3);
  r.opciones.forEach(o => assert.ok(o.prendas.includes("chino")));
  assert.ok(armar(LA_PAZ, { base: "chamarra" }).opciones.every(o => o.prendas[0] === "chamarra"));
  assert.ok(armar(SANTA_CRUZ, { base: "rompe" }).opciones.every(o => o.prendas.includes("rompe")), "un abrigo como base va aunque haga calor");
  assert.ok(armar(LA_PAZ, { base: "cinturon" }).opciones.every(o => o.prendas.includes("cinturon")), "un accesorio también");
  assert.deepEqual(armar(LA_PAZ, { base: "camisa-lavar" }), { opciones: [], falta: "Esa prenda está para lavar." });
  assert.deepEqual(armar(LA_PAZ, { base: "saco-fuera" }), { opciones: [], falta: "Esa prenda ya no está en tu ropero." });
});

test("aprende de ti: lo que no te gustó no vuelve; lo que te gustó sube", () => {
  const primera = armar(LA_PAZ).opciones[0].prendas;
  const sinEsa = armar(LA_PAZ, { outfits: [{ prendas: primera, gusto: "no" }] });
  assert.ok(sinEsa.opciones.every(o => O.clave(o.prendas.filter(id => !["gorra", "lentes"].includes(id))) !== O.clave(primera.filter(id => !["gorra", "lentes"].includes(id)))), "la que no te gustó no vuelve");
  // Te gustó la chompa bordó con el pantalón de tela y los botines: los botines
  // suben a la primera (con el pantalón) y la chompa con el pantalón, a la segunda.
  assert.deepEqual(armar(LA_PAZ).opciones[0].prendas.slice(0, 4), ["chamarra", "polera-b", "chino", "zapas"]);
  const gusta = armar(LA_PAZ, { outfits: [{ prendas: ["chompa-bo", "chino", "botines"], gusto: "si" }, { prendas: ["chompa-bo", "chino", "botines", "chamarra"], gusto: "si" }] });
  assert.deepEqual(gusta.opciones[0].prendas.slice(0, 4), ["chamarra", "polera-b", "chino", "botines"]);
  assert.deepEqual(gusta.opciones[1].prendas.slice(0, 3), ["chamarra", "chompa-bo", "chino"]);
  assert.match(gusta.opciones[0].porque, /ya te gustaron juntas/);
  // Una sola vez un solo par no alcanza para decirlo.
  const poco = armar(LA_PAZ, { outfits: [{ prendas: ["polera-b", "chino"], gusto: "si" }] });
  assert.doesNotMatch(poco.opciones[0].porque, /ya te gustaron/);
  // Lo que ya viste (Otras opciones) no se repite.
  const vistas = armar(LA_PAZ).opciones.map(o => o.prendas.filter(id => !["gorra", "lentes"].includes(id)));
  const otras = armar(LA_PAZ, { evitar: vistas });
  assert.equal(otras.opciones.length, 3);
  otras.opciones.forEach(o => assert.ok(!vistas.some(v => O.clave(v) === O.clave(o.prendas.filter(id => !["gorra", "lentes"].includes(id))))));
  const g = O.gustos([{ prendas: ["a", "b", "c"], gusto: "si" }, { prendas: ["b", "a"], gusto: "no" }, { prendas: ["x"], gusto: "no" }]);
  assert.equal(g.pares.get("a|b"), 0);
  assert.equal(g.pares.get("a|c"), 1);
  assert.ok(g.vetados.has("a|b") && !g.vetados.has("x"));
});

test("lo aprendido no le gana al clima ni a la ocasión; con calor fuerte, nada de frío", () => {
  // Te encantó (seis veces) tu ropa de verano: igual, con frío no sale.
  const dia = (sensMin, sensMax) => ({ sensMin, sensMax, lluvia: 0, viento: 5, rafagas: 10, uv: 3, codigo: 1 });
  const FRIO = C.necesidades(dia(-4, 2), "normal");
  const verano = Array.from({ length: 6 }, () => ({ prendas: ["polera-r", "short", "sandalias", "gorra"], gusto: "si" }));
  const r = armar(FRIO, { outfits: verano, usos: new Map() });
  assert.equal(r.opciones.length, 3);
  r.opciones.forEach(o => assert.ok(!o.prendas.some(id => ["short", "sandalias", "polera-r"].includes(id)), "nada de verano a −4 °C"));
  const g = O.gustos(verano, "casual");
  assert.equal(g.pares.get("polera-r|short"), 6);
  const items = ["polera-r", "short", "sandalias"].map(id => ROPERO.find(p => p.id === id));
  assert.deepEqual(O.afinidad(items, g), { s: 3, si: 6 }, "tope: 3 puntos en total");
  // Lo de otra ocasión cuenta la mitad; lo que no te gustó no vuelve en ninguna.
  const otra = O.gustos([{ prendas: ["a", "b"], gusto: "si", ocasion: "noche" }, { prendas: ["c", "d"], gusto: "no", ocasion: "noche" }, { prendas: ["e", "f"], gusto: "si" }], "casual");
  assert.deepEqual([otra.pares.get("a|b"), otra.pares.get("c|d"), otra.pares.get("e|f")], [0.5, -0.5, 1]);
  assert.ok(otra.vetados.has("c|d"));
  // Lo casual no dice nada de un evento formal (pero lo que no te gustó, tampoco vuelve).
  const formal = O.gustos([{ prendas: ["a", "b"], gusto: "si", ocasion: "casual" }, { prendas: ["c", "d"], gusto: "no", ocasion: "casual" }], "formal");
  assert.ok(!formal.pares.has("a|b") && formal.vetados.has("c|d"));
  // Con calor fuerte (se siente 27,6 °C), el jean (de frío y templado) pierde con
  // el short, aunque el jean sea de tu estilo; la camisa (templado) sigue para el trabajo.
  const sinUsos = armar(SANTA_CRUZ, { usos: new Map() });
  assert.deepEqual(sinUsos.opciones[0].prendas, ["polera-b", "short", "zapas", "gorra", "lentes"]);
  assert.deepEqual(armar(SANTA_CRUZ, { usos: new Map(), ocasion: "trabajo" }).opciones[0].prendas, ["camisa-c", "chino", "botines", "lentes", "cinturon"]);
  const jean = ROPERO.find(p => p.id === "jean"), camisa = ROPERO.find(p => p.id === "camisa-c"), polera = ROPERO.find(p => p.id === "polera-b");
  assert.deepEqual([O.puntosClima(jean, "calor", true), O.puntosClima(jean, "calor", false), O.puntosClima(camisa, "calor", true), O.puntosClima(polera, "frio", true)], [-1.5, 0, 0, -1.5]);
  assert.deepEqual([O.extremo(SANTA_CRUZ.temp), O.extremo(LA_PAZ.temp), O.extremo(7.9), O.extremo(undefined)], [true, false, true, false]);
});

test("repetir: la polera de ayer, mejor otro día; la chamarra de ayer igual abriga", () => {
  const ayer = M.usos({ "2026-11-22": { prendas: ["chamarra", "zapas", "polera-b"] } });
  const r = armar(LA_PAZ, { usos: ayer });
  r.opciones.slice(0, 2).forEach(o => assert.equal(o.prendas[0], "chamarra", "la chamarra de ayer sigue siendo la que abriga"));
  assert.ok(r.opciones.every(o => !o.prendas.includes("polera-b")), "la polera de ayer no");
  assert.ok(r.opciones.some(o => o.prendas.includes("zapas")), "los zapatos de ayer pueden repetir");
  const sinUsos = armar(LA_PAZ, { usos: new Map() });
  assert.deepEqual(sinUsos.opciones[0].prendas.slice(0, 4), ["chamarra", "polera-b", "jean", "zapas"]);
});

test("tus ocasiones: se arman como la de base; tu estilo de Pinterest suma", () => {
  const propias = O.ocasionesPropias([
    { id: "o-u1", nombre: " Universidad ", como: "casual" }, { id: "o-i1", nombre: "Iglesia", como: "formal" },
    { id: "o-u2", nombre: "universidad", como: "trabajo" }, { id: "o-x", nombre: "Trabajo", como: "casual" },
    { id: "mal", nombre: "Gym", como: "deporte" }, { id: "o-n1", nombre: "", como: "casual" }, { id: "o-c1", nombre: "Cine", como: "nada" }
  ]);
  assert.deepEqual(propias, [{ id: "o-u1", nombre: "Universidad", como: "casual" }, { id: "o-i1", nombre: "Iglesia", como: "formal" }], "sin repetir nombres (ni los de siempre), con id y base");
  assert.equal(O.ocasionesPropias(Array.from({ length: 12 }, (_, i) => ({ id: `o-${i}`, nombre: `Ocasión ${i}`, como: "casual" }))).length, 8, "hasta 8");
  const iglesia = O.ocasion("o-i1", propias);
  assert.deepEqual([iglesia.nombre, iglesia.formal, O.tipoDe(iglesia)], ["Iglesia", 4.5, "formal"]);
  assert.equal(O.ocasion("o-borrada", propias).id, "casual", "si la quitaste: casual");
  // La iglesia (como un evento formal): lo más formal, sin gorra, con cinturón.
  const r = armar(LA_PAZ, { ocasion: "o-i1", ocasiones: propias, usos: new Map() });
  assert.deepEqual(r.opciones[0].prendas.slice(0, 4), ["chamarra", "camisa-c", "chino", "botines"]);
  assert.ok(r.opciones.every(o => !o.prendas.includes("gorra")) && r.opciones[0].prendas.includes("cinturon"));
  // Lo que te gustó para la iglesia cuenta entero ahí y la mitad en lo casual.
  const g = O.gustos([{ prendas: ["a", "b"], gusto: "si", ocasion: "o-i1" }], "o-i1");
  assert.equal(g.pares.get("a|b"), 1);
  // Tu estilo: el bordó y lo urbano se repiten en tus inspiraciones.
  const estilo = { colores: ["bordo"], estilos: ["urbano"] };
  const chompa = ROPERO.find(p => p.id === "chompa-bo"), jean = ROPERO.find(p => p.id === "jean"), polera = ROPERO.find(p => p.id === "polera-b");
  assert.deepEqual([O.puntosEstilo(chompa, estilo), O.puntosEstilo(jean, estilo), O.puntosEstilo(polera, estilo)], [0.4, 0.3, 0]);
  const sin = armar(LA_PAZ, { usos: new Map() }), con = armar(LA_PAZ, { usos: new Map(), estilo });
  assert.ok(!sin.opciones.some(o => o.prendas.includes("chompa-bo")) && con.opciones[1].prendas.includes("chompa-bo"), "con tu estilo, la chompa bordó entra (un empujón: el clima sigue mandando)");
  assert.deepEqual(con.opciones[0].prendas, sin.opciones[0].prendas, "la primera sigue siendo la del clima");
  assert.match(con.opciones[1].porque, /con el bordó de tus inspiraciones/);
});

test("lo que falta para armar, los colores y el nombre", () => {
  const soloArriba = ROPERO.filter(p => p.grupo === "arriba");
  assert.match(O.armar(soloArriba, { nec: LA_PAZ, hoy: HOY }).falta, /Te falta ropa de abajo/);
  assert.match(O.armar([], { nec: LA_PAZ, hoy: HOY }).falta, /Te falta ropa de arriba/);
  // Un vestido sirve solo (sin abajo).
  const vestido = [pr("v", "cuerpo", "Vestido", "negro", { clima: ["templado"] }), pr("z", "zapatos", "Zapatos", "negro")];
  assert.deepEqual(O.armar(vestido, { nec: SANTA_CRUZ, hoy: HOY }).opciones[0].prendas, ["v", "z"]);
  // Tres colores fuertes restan; neutros con uno, lo mejor.
  const tres = [pr("1", "arriba", "Polera", "rojo"), pr("2", "abajo", "Short", "amarillo"), pr("3", "zapatos", "Zapatillas", "celeste")];
  assert.equal(O.fuertes(tres).length, 3);
  assert.ok(O.puntosCombo(tres, {}, null) < O.puntosCombo([tres[0], pr("4", "abajo", "Jean", "azul-jean"), pr("5", "zapatos", "Zapatillas", "blanco")], {}, null));
  assert.equal(O.nombre([tres[0], pr("4", "abajo", "Jean", "azul-jean")]), "Con un toque de rojo");
  assert.equal(O.nombre(tres.slice(0, 2)), "Rojo y amarillo");
  assert.ok(O.esNeutro("azul-jean") && O.esNeutro("camel") && O.esNeutro("verde-oliva") && !O.esNeutro("bordo"));
});

test("lo que se manda a la IA y lo que contesta", () => {
  const r = O.roperoParaIA(ROPERO);
  assert.ok(!r.some(p => p.id === "camisa-lavar" || p.id === "saco-fuera"), "sin lo que está para lavar ni lo que ya no tienes");
  assert.deepEqual(Object.keys(r[0]).sort(), ["clima", "colores", "corte", "estampado", "estilo", "formalidad", "grupo", "id", "lavar", "manga", "marca", "tela", "tipo"]);
  assert.deepEqual(O.recientes({ "2026-11-23": { prendas: ["a"] }, "2026-11-17": { prendas: ["b"] }, "2026-11-10": { prendas: ["c"] }, "2026-11-24": { prendas: ["d"] } }, HOY).sort(), ["a", "b"]);
  const v = O.validas([
    { nombre: "Bien", prendas: ["polera-b", "jean", "zapas", "chamarra"] },
    { nombre: "Sin zapatos", prendas: ["polera-b", "jean"] },
    { nombre: "Dos de abajo", prendas: ["polera-b", "jean", "chino", "zapas"] },
    { nombre: "Inventada", prendas: ["polera-b", "jean-que-no-existe", "zapas"] },
    { nombre: "Para lavar", prendas: ["camisa-lavar", "jean", "zapas"] },
    { nombre: "Repetida", prendas: ["chamarra", "jean", "polera-b", "zapas"] },
    { nombre: "Vestido y jean", prendas: ["polera-b", "jean", "zapas", "zapas"] }
  ], ROPERO, {});
  assert.deepEqual(v.map(o => o.nombre), ["Bien", "Vestido y jean"]);
  assert.deepEqual(v[0].prendas, ["chamarra", "polera-b", "jean", "zapas"], "ordenada");
  assert.deepEqual(O.validas([{ prendas: ["polera-b", "jean", "zapas"] }], ROPERO, { base: "chino" }), [], "sin la prenda base, no sirve");
  assert.deepEqual(O.validas([{ prendas: ["polera-b", "jean", "zapas"] }], ROPERO, { outfits: [{ prendas: ["zapas", "jean", "polera-b"], gusto: "no" }] }), [], "lo que no te gustó, tampoco");
  assert.equal(O.ocasion("nada").id, "casual");
  assert.equal(O.diasEntre("2026-11-20", HOY), 3);
});

test("tus favoritos (D-163) pesan una vez y media en lo que aprendió de ti", () => {
  const g = O.gustos([{ prendas: ["a", "b"], gusto: "si", favorito: true }, { prendas: ["c", "d"], gusto: "si" }, { prendas: ["e", "f"], gusto: "no", favorito: true }]);
  assert.equal(g.pares.get("a|b"), 1.5, "el favorito, 1,5");
  assert.equal(g.pares.get("c|d"), 1, "lo que te gustó, 1");
  assert.equal(g.pares.get("e|f"), -1, "si no te gustó, no cuenta como favorito");
  assert.ok(g.vetados.has("e|f"));
  const media = O.gustos([{ prendas: ["a", "b"], gusto: "si", favorito: true, ocasion: "noche" }], "casual");
  assert.equal(media.pares.get("a|b"), 0.75, "de otra ocasión parecida, la mitad de 1,5");
});
