// Ropa: tu estilista (js/ropa-estilista-motor.js, D-158): las conversaciones,
// lo que va al puente, lo que recuerda de ti y el presupuesto.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/ropa-motor.js");
const E = require("../js/ropa-estilista-motor.js");

test("el título: el comienzo de tu primer mensaje, sin cortar palabras", () => {
  assert.equal(E.titulo("  Hace   frío: una chompa  "), "Hace frío: una chompa");
  assert.equal(E.titulo("Está haciendo bastante frío, quiero una chompa y una chamarra encima"), "Está haciendo bastante frío, quiero una chompa…");
  assert.equal(E.titulo("Mañana tengo una reunión formal en la oficina, ¿qué me pongo?"), "Mañana tengo una reunión formal en la oficina…");
  assert.equal(E.titulo("x".repeat(60)), `${"x".repeat(48)}…`, "una sola palabra larga: se corta igual");
  assert.equal(E.titulo(""), "");
  assert.equal(E.EJEMPLOS.length, 3);
});

test("los mensajes: lo que se guarda, limpio", () => {
  assert.equal(E.mensaje({ de: "otro", texto: "hola" }), null);
  assert.equal(E.mensaje({ de: "yo", texto: "   " }), null, "un mensaje tuyo vacío no queda");
  assert.deepEqual(E.mensaje({ de: "yo", texto: " Hola ", fecha: 5, outfits: [{ prendas: ["a", "b"] }] }), { de: "yo", texto: "Hola", outfits: [], faltan: [], recordo: [], sinMostrar: 0, fecha: 5 });
  const ia = E.mensaje({
    de: "ia", texto: "Va así:", fecha: 9, sinMostrar: 7,
    outfits: [{ prendas: ["a", "b", "a"], nombre: "Capas", porque: "Abriga.", capas: "" }, { prendas: ["solo"] }, { prendas: ["c", "d"] }, { prendas: ["e", "f"] }, { prendas: ["g", "h"] }],
    faltan: [{ grupo: "zapatos", tipo: "botines", color: "cafe", porque: "Para el frío." }, { grupo: "otra", tipo: "x" }, { grupo: "abajo", tipo: "" }],
    recordo: ["Es friolento", "", "No le gusta el amarillo", "Tercero"]
  });
  assert.deepEqual(ia.outfits.map(o => o.prendas), [["a", "b"], ["c", "d"], ["e", "f"]], "con 2 prendas o más, sin repetir, hasta 3");
  assert.deepEqual(ia.faltan, [{ grupo: "zapatos", tipo: "Botines", color: "cafe", porque: "Para el frío." }]);
  assert.deepEqual(ia.recordo, ["Es friolento", "No le gusta el amarillo"]);
  assert.equal(ia.sinMostrar, 3);
  assert.equal(E.mensaje({ de: "ia", texto: "", outfits: [] }), null, "de la IA, sin texto ni outfits, no queda");
  assert.ok(E.mensaje({ de: "ia", texto: "", outfits: [{ prendas: ["a", "b"] }] }), "solo con outfits, sí");
});

test("las conversaciones: el título, el orden, cuándo está llena y lo que quedó sin respuesta", () => {
  const c = E.normalizar("c1", { mensajes: [{ de: "ia", texto: "¿Qué necesitas?" }, { de: "yo", texto: "Hace frío y salgo temprano a la universidad, ¿qué me pongo?" }, { de: "raro" }], creado: 10 });
  assert.equal(c.titulo, "Hace frío y salgo temprano a la universidad…", "sin título guardado: el de tu primer mensaje");
  assert.equal(c.mensajes.length, 2);
  assert.equal(c.editado, 10, "sin editado: el de creado");
  assert.equal(E.normalizar("c2", { titulo: "  Mi título  " }).titulo, "Mi título");
  assert.equal(E.normalizar("c3", null).titulo, "Conversación");
  const ord = E.ordenar([{ id: "a", editado: 1 }, { id: "b", editado: 3 }, { id: "c", editado: 3 }]).map(x => x.id);
  assert.deepEqual(ord, ["b", "c", "a"]);
  const de = n => ({ mensajes: Array.from({ length: n }, (_, i) => ({ de: i % 2 ? "ia" : "yo", texto: `m${i}` })) });
  assert.equal(E.llena(de(38)), false, "entran tu pregunta y su respuesta");
  assert.equal(E.llena(de(39)), true);
  assert.equal(E.llena(null), false);
  assert.equal(E.sinRespuesta(E.normalizar("x", de(3))).texto, "m2", "tu último mensaje, sin respuesta");
  assert.equal(E.sinRespuesta(E.normalizar("x", de(4))), null);
  assert.equal(E.sinRespuesta(null), null);
});

test("lo que va al puente: lo hablado antes (los últimos 20) y otra opción", () => {
  const ms = Array.from({ length: 25 }, (_, i) => E.mensaje(i % 2 ? { de: "ia", texto: `R${i}`, outfits: [{ prendas: ["p", "q"], nombre: "X" }] } : { de: "yo", texto: `M${i}` }));
  const h = E.historial(ms);
  assert.equal(h.length, 20);
  assert.deepEqual(h[0], { de: "ia", texto: "R5", outfits: [["p", "q"]] });
  assert.deepEqual(h[1], { de: "yo", texto: "M6" });
  assert.deepEqual(E.historial([]), []);
  assert.equal(E.otraOpcion("Capas abrigadas"), "Dame otra opción distinta de «Capas abrigadas».");
  assert.equal(E.otraOpcion(""), "Dame otra opción distinta.");
});

test("tu ropa para el puente: lo que tienes, con lo que está para lavar marcado", () => {
  const p = (id, extra) => R.normalizar(id, Object.assign({ grupo: "arriba", tipo: "Polera", colores: [{ id: "negro" }, { id: "blanco" }] }, extra || {}));
  const r = E.roperoParaCharla([p("a", { corte: "suelto", manga: "corta", notas: "secreta", precio: 120, talla: "M" }), p("b", { estado: "lavar" }), p("c", { estado: "fuera" })]);
  assert.deepEqual(r.map(x => [x.id, x.lavar]), [["a", false], ["b", true]], "lo que ya no tienes no va");
  assert.deepEqual(r[0].colores, ["negro", "blanco"]);
  assert.equal(r[0].corte, "suelto");
  assert.equal(r[0].manga, "corta");
  assert.ok(!("notas" in r[0]) && !("precio" in r[0]) && !("talla" in r[0]), "ni notas, ni precio, ni talla");
  assert.deepEqual(E.roperoParaCharla(null), []);
});

test("el presupuesto, en palabras (solo si tienes uno)", () => {
  assert.equal(E.presupuestoTexto(null, 100), "");
  assert.equal(E.presupuestoTexto(500, 200), "Este mes me quedan Bs 300 de Bs 500 para ropa.");
  assert.equal(E.presupuestoTexto(500, 0), "Este mes me quedan Bs 500 de Bs 500 para ropa.");
  assert.equal(E.presupuestoTexto(300, 350.5), "Este mes ya me pasé Bs 50,5 de mi presupuesto de ropa (Bs 300).");
});

test("lo que recuerda de ti: sin repetir, hasta 30, y lo que borras", () => {
  const m = E.memoria([{ id: "a", texto: "es friolento", fecha: 1 }, { id: "b", texto: "Es  FRIOLENTO." }, { id: "a", texto: "No le gusta el amarillo" }, { texto: "" }, "raro"]);
  assert.deepEqual(m.map(x => x.texto), ["Es friolento", "No le gusta el amarillo"], "sin repetir (sin mayúsculas, tildes ni signos) y con mayúscula");
  assert.equal(new Set(m.map(x => x.id)).size, 2, "cada uno con su id");
  assert.equal(E.claveMemoria("¡Él prefiere   CAFÉ!"), "el prefiere cafe");
  let n = 0;
  const id = () => `n${++n}`;
  const r = E.recordar(m, ["Es friolento", "Prefiere lo oscuro", "prefiere lo oscuro", ""], 50, id);
  assert.deepEqual(r.nuevos.map(x => x.texto), ["Prefiere lo oscuro"], "lo que ya sabe, no se repite");
  assert.equal(r.nuevos[0].fecha, 50);
  assert.equal(r.lista.length, 3);
  const llena = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, texto: `Cosa ${i}` }));
  const r2 = E.recordar(llena, ["Algo nuevo"], 1, id);
  assert.equal(r2.lista.length, 30);
  assert.equal(r2.lista[0].texto, "Cosa 1", "pasando de 30, se va lo más viejo");
  assert.equal(r2.lista[29].texto, "Algo nuevo");
  assert.deepEqual(E.olvidar(r.lista, [r.nuevos[0].id]).map(x => x.texto), ["Es friolento", "No le gusta el amarillo"]);
  assert.equal(E.recuerda(r.lista, "es friolento"), true);
  assert.equal(E.recuerda(E.olvidar(r.lista, ["a"]), "Es friolento"), false);
  assert.equal(E.recuerda(r.lista, ""), false);
});

test("cuándo: hoy, ayer o la fecha", () => {
  const ahora = new Date(2026, 10, 24, 10, 0).getTime();
  assert.equal(E.cuando(new Date(2026, 10, 24, 0, 5).getTime(), ahora), "hoy");
  assert.equal(E.cuando(new Date(2026, 10, 23, 23, 59).getTime(), ahora), "ayer");
  assert.equal(E.cuando(new Date(2026, 10, 2, 9, 0).getTime(), ahora), "el 2 de noviembre");
  assert.equal(E.cuando(new Date(2025, 11, 31, 9, 0).getTime(), ahora), "el 31 de diciembre de 2025");
  assert.equal(E.cuando(0, ahora), "");
});
