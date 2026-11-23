// Ropa, tus números (js/ropa-numeros-motor.js, D-151): lo que más te pones,
// lo que no te pones hace 3 meses o más, tus colores, cuánto te sale cada uso
// y lo que invertiste.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/ropa-motor.js");
const N = require("../js/ropa-numeros-motor.js");

const HOY = "2026-11-23";
const dia = f => Date.parse(`${f}T12:00:00Z`);
const pr = (id, grupo, tipo, color, extra) => M.normalizar(id, Object.assign({ grupo, tipo, colores: color ? [{ id: color }] : [], estado: "activa", creado: dia("2026-01-10") }, extra || {}));
const ROPERO = [
  pr("jean", "abajo", "Jean", "azul-jean", { precio: 300 }),
  pr("polera-n", "arriba", "Polera", "negro", { precio: 80 }),
  pr("polera-g", "arriba", "Polera", "gris-oscuro"),
  pr("camisa", "arriba", "Camisa", "celeste", { precio: 250 }),
  pr("zapas", "zapatos", "Zapatillas", "blanco", { precio: 500 }),
  pr("abrigo", "abrigos", "Abrigo", "camel", { precio: 900 }),
  pr("nueva", "arriba", "Chompa", "bordo", { creado: dia("2026-11-01"), precio: 200 }),
  pr("vieja", "abajo", "Short", "beige", { estado: "fuera", precio: 50 }),
  pr("lavar", "arriba", "Polera", "blanco", { estado: "lavar" })
];
const USOS = {
  "2026-11-22": { prendas: ["jean", "polera-n", "zapas"] },
  "2026-11-20": { prendas: ["jean", "camisa", "zapas"] },
  "2026-11-15": { prendas: ["jean", "polera-n", "zapas", "vieja"] },
  "2026-10-30": { prendas: ["jean", "polera-g"] },
  "2026-08-01": { prendas: ["camisa", "abrigo"] },     // hace más de 3 meses
  "2026-07-01": { prendas: ["abrigo"] },
  "2026-11-21": { prendas: [] }
};

test("lo que más te pones y lo que no te pones hace 3 meses o más", () => {
  const n = N.numeros(ROPERO, USOS, HOY);
  assert.equal(n.total, 8, "sin la que ya no tienes");
  assert.equal(n.dias30, 4, "días con algo anotado en los últimos 30 (el vacío no cuenta)");
  assert.deepEqual(n.masUsadas, [{ id: "jean", veces: 4 }, { id: "zapas", veces: 3 }, { id: "polera-n", veces: 2 }], "en 90 días, desde 2 veces");
  assert.deepEqual(n.sinUsar.map(x => [x.id, x.ultima, x.dias]), [["lavar", "", 317], ["abrigo", "2026-08-01", 114]],
    "el abrigo (hace 114 días) y la polera para lavar que nunca te pusiste (la tienes desde enero); la chompa nueva no (la tienes hace 22 días)");
  assert.equal(N.haceCuanto(114), "hace 3 meses");
  assert.equal(N.haceCuanto(45), "hace 45 días");
  assert.equal(N.haceCuanto(400), "hace 1 año");
  assert.equal(N.haceCuanto(800), "hace 2 años");
  assert.equal(N.haceCuanto(null), "");
  // Sin la fecha en que la agregaste (o una que no tiene sentido): "nunca", sin decir desde cuándo.
  const sinFecha = [pr("x", "arriba", "Polera", "negro", { creado: 100 }), pr("y", "arriba", "Polera", "negro", { creado: 0 })];
  assert.deepEqual(N.numeros(sinFecha, {}, HOY).sinUsar, [{ id: "x", ultima: "", dias: null }, { id: "y", ultima: "", dias: null }]);
});

test("tus colores (el principal, por familia) y el que más te pones", () => {
  const n = N.numeros(ROPERO, USOS, HOY);
  assert.deepEqual(n.colores.map(c => [c.nombre, c.n]), [["Blanco", 2], ["Negro", 2], ["Azul", 1], ["Beige", 1], ["Celeste", 1], ["Rojo", 1]],
    "el gris oscuro es de la familia del negro; el camel, del beige; el bordó, del rojo");
  assert.equal(Math.round(n.colores[0].pct * 100), 25);
  assert.ok(n.colores.every(c => /^#[0-9a-f]{6}$/i.test(c.hex)));
  assert.deepEqual(n.colorMasPuesto, { fam: "azul", nombre: "Azul", veces: 4 }, "el jean: 4 veces en 90 días");
  // Con más de 8 familias: 7 y "Otros".
  const muchos = ["rojo", "amarillo", "verde", "morado", "rosado", "naranja", "celeste", "negro", "blanco", "beige"].map((c, i) => pr(`c${i}`, "arriba", "Polera", c));
  const cs = N.numeros(muchos, {}, HOY).colores;
  assert.equal(cs.length, 8);
  assert.deepEqual(cs[7], { fam: "otros", hex: "", nombre: "Otros", n: 3, pct: 0.3 });
  assert.equal(N.numeros(muchos, {}, HOY).colorMasPuesto, null);
});

test("cuánto te sale cada uso y lo que invertiste", () => {
  const n = N.numeros(ROPERO, USOS, HOY);
  assert.equal(n.invertido, 2230, "lo que tienes con precio (sin lo que ya no tienes)");
  assert.equal(n.conPrecio, 6);
  assert.deepEqual(n.rinde.mejor.map(x => [x.id, x.porUso]), [["polera-n", 40], ["jean", 75], ["camisa", 125]], "lo que mejor rinde");
  assert.deepEqual(n.rinde.peor.map(x => [x.id, x.porUso, x.veces]), [["abrigo", 450, 2], ["zapas", 166.67, 3]], "lo que menos rinde (sin repetir)");
  assert.deepEqual(n.rinde.sinEstrenar.map(x => [x.id, x.precio]), [["nueva", 200]], "con precio y sin estrenar");
  // Con 3 o menos, una sola lista.
  const pocos = N.numeros(ROPERO.slice(0, 2), USOS, HOY).rinde;
  assert.deepEqual([pocos.mejor.length, pocos.peor.length], [2, 0]);
  assert.deepEqual(N.numeros([], {}, HOY), { total: 0, porGrupo: { arriba: 0, abajo: 0, cuerpo: 0, abrigos: 0, zapatos: 0, accesorios: 0 }, lavar: 0, dias30: 0, invertido: 0, conPrecio: 0,
    masUsadas: [], sinUsar: [], colores: [], colorMasPuesto: null, rinde: { mejor: [], peor: [], sinEstrenar: [] } });
});
