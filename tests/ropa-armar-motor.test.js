// Ropa: armar tu outfit (js/ropa-armar-motor.js, D-156): el orden de las
// capas, las filas del tablero, elegir una prenda y los avisos.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/ropa-motor.js");
const A = require("../js/ropa-armar-motor.js");

const p = (id, grupo, tipo, color, extra) => R.normalizar(id, Object.assign({ grupo, tipo, colores: [{ id: color }] }, extra || {}));
const POLERA = p("polera", "arriba", "Polera", "blanco");
const CAMISA = p("camisa", "arriba", "Camisa", "celeste", { formalidad: 3 });
const CHOMPA = p("chompa", "arriba", "Chompa", "bordo", { clima: ["frio"] });
const JEAN = p("jean", "abajo", "Jean", "azul-jean");
const CHINO = p("chino", "abajo", "Pantalón", "beige");
const CHAMARRA = p("chamarra", "abrigos", "Chamarra", "verde-oliva", { clima: ["frio"] });
const ZAPAS = p("zapas", "zapatos", "Zapatillas", "blanco", { formalidad: 1 });
const SANDALIAS = p("sandalias", "zapatos", "Sandalias", "cafe");
const GORRA = p("gorra", "accesorios", "Gorra", "negro");
const VESTIDO = p("vestido", "cuerpo", "Vestido", "negro", { formalidad: 4 });
const TERNO = p("saco", "abrigos", "Saco", "negro", { formalidad: 5 });
const TODAS = [POLERA, CAMISA, CHOMPA, JEAN, CHINO, CHAMARRA, ZAPAS, SANDALIAS, GORRA, VESTIDO, TERNO];

test("el orden: de la cabeza a los pies y de afuera hacia adentro", () => {
  const ids = xs => A.ordenar(xs).map(x => x.id).join(",");
  assert.equal(ids([ZAPAS, POLERA, JEAN, CHAMARRA, CHOMPA, GORRA]), "chamarra,chompa,polera,jean,zapas,gorra");
  assert.equal(ids([POLERA, CAMISA, CHOMPA]), "chompa,camisa,polera", "la chompa sobre la camisa y la camisa sobre la polera");
  assert.equal(ids([VESTIDO, CHOMPA, ZAPAS]), "chompa,vestido,zapas", "una chompa va sobre el vestido");
  assert.equal(A.capaArriba(p("x", "arriba", "Chompa con capucha", "gris")), 0);
  assert.equal(A.capaArriba(p("y", "arriba", "Musculosa", "gris")), 2);
  assert.deepEqual(A.ordenar([]), []);
});

test("las filas del tablero: lo de arriba, lo de abajo, los pies y los accesorios", () => {
  const f = A.filas([GORRA, ZAPAS, JEAN, POLERA, CHAMARRA]);
  assert.deepEqual(f.map(x => `${x.id}:${x.prendas.map(y => y.id).join("+")}`), ["arriba:chamarra+polera", "abajo:jean", "pies:zapas", "accesorios:gorra"]);
  assert.deepEqual(A.filas([VESTIDO, ZAPAS]).map(x => x.id), ["arriba", "pies"], "sin filas vacías; el vestido va arriba");
});

test("elegir: tocar suma o saca; en abajo, abrigo y zapatos, cambia la que había", () => {
  let ids = A.tocar([], POLERA, TODAS);
  ids = A.tocar(ids, CHOMPA, TODAS);
  assert.deepEqual(ids, ["polera", "chompa"], "arriba suma (capas)");
  ids = A.tocar(ids, JEAN, TODAS);
  ids = A.tocar(ids, CHINO, TODAS);
  assert.deepEqual(ids, ["polera", "chompa", "chino"], "otro pantalón cambia el jean");
  ids = A.tocar(ids, ZAPAS, TODAS);
  ids = A.tocar(ids, SANDALIAS, TODAS);
  assert.deepEqual(ids, ["polera", "chompa", "chino", "sandalias"]);
  ids = A.tocar(ids, CHOMPA, TODAS);
  assert.deepEqual(ids, ["polera", "chino", "sandalias"], "tocar otra vez la saca");
  assert.ok(A.completo([POLERA, CHINO]) && A.completo([VESTIDO]) && !A.completo([POLERA]) && !A.completo([VESTIDO, JEAN]));
});

test("los avisos: lo que falta, lo que sobra y lo que está para lavar", () => {
  const ids = (xs, c) => A.avisos(xs, c).map(a => a.id);
  assert.deepEqual(A.avisos([], { hayZapatos: true }), [], "sin nada elegido, nada que avisar");
  assert.deepEqual(ids([POLERA], { hayZapatos: true }), ["falta-abajo", "falta-zapatos"]);
  assert.deepEqual(ids([JEAN], { hayZapatos: false }), ["falta-arriba"], "sin zapatos en el ropero, no los pide");
  assert.deepEqual(ids([POLERA, JEAN, CHINO, ZAPAS]), ["dos-abajo"]);
  assert.deepEqual(ids([VESTIDO, JEAN, ZAPAS]), ["cuerpo-abajo", "formalidad"], "y un vestido formal con zapatillas");
  assert.deepEqual(ids([p("vc", "cuerpo", "Enterizo", "azul"), JEAN, ZAPAS]), ["cuerpo-abajo"]);
  assert.deepEqual(ids([POLERA, CAMISA, CHOMPA, JEAN, ZAPAS]), ["tres-arriba"]);
  assert.deepEqual(ids([POLERA, JEAN, ZAPAS, SANDALIAS], { hayZapatos: true }), ["dos-zapatos"]);
  const sucia = R.normalizar("s", { grupo: "arriba", tipo: "Polera", colores: [{ id: "negro" }], estado: "lavar" });
  const a = A.avisos([sucia, JEAN, ZAPAS], { hayZapatos: true });
  assert.equal(a[0].texto, "Está para lavar: Polera negra.");
  assert.ok(a.every(x => x.tipo === "aviso"));
});

test("los avisos del clima: frío sin abrigo, calor con abrigo, lluvia con sandalias y las capas", () => {
  const frio = { base: "frio", abrigo: "abrigo", capas: false, lluvia: "", bajo: 3.6, alto: 9 };
  const ids = (xs, nec) => A.avisos(xs, { nec, hayZapatos: true }).map(a => a.id);
  assert.deepEqual(A.avisos([POLERA, JEAN, ZAPAS], { nec: frio, hayZapatos: true }).map(a => a.texto), ["Hace frío (4° a la mañana): ¿sumas algo de abrigo?"]);
  assert.deepEqual(ids([CHOMPA, JEAN, ZAPAS], frio), [], "una chompa de frío ya abriga");
  assert.deepEqual(ids([POLERA, CHAMARRA, JEAN, ZAPAS], frio), [], "con la chamarra, nada");
  assert.deepEqual(ids([POLERA, CHAMARRA, JEAN, ZAPAS], { base: "calor", abrigo: "", capas: false, bajo: 22, alto: 30 }), ["calor"]);
  assert.deepEqual(ids([POLERA, JEAN, SANDALIAS], { base: "templado", abrigo: "", capas: false, lluvia: "si", bajo: 15, alto: 21 }), ["lluvia"]);
  const capas = A.avisos([POLERA, CHAMARRA, JEAN, ZAPAS], { nec: { base: "templado", abrigo: "abrigo", capas: true, lluvia: "", bajo: 4, alto: 17.4 }, hayZapatos: true });
  assert.deepEqual(capas, [{ id: "capas", tipo: "info", texto: "Al mediodía sube a 17°: chamarra verde oliva es para la mañana." }]);
  assert.deepEqual(ids([POLERA, JEAN, ZAPAS], null), [], "sin clima, nada del clima");
});

test("los avisos de colores, estampados y qué tan formal", () => {
  const ids = (xs, c) => A.avisos(xs, Object.assign({ hayZapatos: true }, c)).map(a => a.id);
  const roja = p("r", "arriba", "Polera", "rojo"), verde = p("v", "abajo", "Pantalón", "verde"), amarillas = p("a", "zapatos", "Zapatillas", "amarillo");
  assert.deepEqual(ids([roja, verde, amarillas]), ["colores"]);
  const rayas = p("ra", "arriba", "Camisa", "blanco", { estampado: "rayas" }), cuadros = p("cu", "abajo", "Pantalón", "gris", { estampado: "cuadros" });
  assert.deepEqual(ids([rayas, cuadros, ZAPAS]), ["estampados"]);
  assert.deepEqual(ids([POLERA, JEAN, ZAPAS, TERNO]), ["formalidad"], "un saco de terno con zapatillas");
  assert.deepEqual(ids([CAMISA, CHINO, ZAPAS], { ocasion: "formal" }), ["ocasion"]);
  assert.deepEqual(ids([CAMISA, CHINO, ZAPAS], { ocasion: "casual" }), []);
});
