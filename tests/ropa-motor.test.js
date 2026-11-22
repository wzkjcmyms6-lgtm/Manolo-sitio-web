// Ropa (js/ropa-motor.js, D-146): colores con nombre, color de una foto,
// nombre de cada prenda, normalizar, revisar, usos, buscar, filtrar, ordenar.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/ropa-motor.js");

// Una "foto" de ancho × alto: fondo de un color y un rectángulo al medio de otro.
function foto(ancho, alto, fondo, prenda, caja) {
  const d = new Uint8ClampedArray(ancho * alto * 4);
  const [x0, y0, x1, y1] = caja || [0.25, 0.2, 0.75, 0.85];
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const dentro = x >= ancho * x0 && x < ancho * x1 && y >= alto * y0 && y < alto * y1;
    const c = typeof prenda === "function" ? (dentro ? prenda(x, y) : fondo) : (dentro ? prenda : fondo);
    const i = (y * ancho + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}

test("el color más parecido de la paleta", () => {
  assert.equal(R.colorCercano(20, 20, 22).id, "negro");
  assert.equal(R.colorCercano(250, 250, 248).id, "blanco");
  assert.equal(R.colorCercano(30, 42, 70).id, "azul-marino");
  assert.equal(R.colorCercano(200, 60, 50).id, "rojo");
  assert.equal(R.colorCercano(195, 155, 108).id, "camel");
  assert.equal(R.colorCercano(80, 110, 155).id, "azul-jean");
});

test("color de una foto: la prenda, no el fondo", () => {
  // Polera roja sobre una cama blanca.
  let c = R.coloresDeFoto(foto(40, 40, [245, 245, 243], [196, 58, 49]), 40, 40);
  assert.equal(c[0].id, "rojo");
  assert.equal(c[0].nombre, "Rojo");
  assert.equal(c.length, 1);
  // Pantalón azul marino sobre un piso beige.
  c = R.coloresDeFoto(foto(40, 40, [217, 198, 165], [30, 42, 68]), 40, 40);
  assert.equal(c[0].id, "azul-marino");
  // Camisa blanca sobre fondo blanco: no se borra todo, sale blanco.
  c = R.coloresDeFoto(foto(40, 40, [244, 244, 242], [246, 246, 244]), 40, 40);
  assert.equal(c[0].id, "blanco");
});

test("color de una foto: dos colores y las sombras de un mismo color", () => {
  // Mitad negra y mitad blanca sobre fondo gris claro.
  const c = R.coloresDeFoto(foto(40, 40, [140, 140, 143], (x) => (x < 20 ? [20, 20, 20] : [245, 245, 243])), 40, 40);
  assert.deepEqual(c.slice(0, 2).map(x => x.id).sort(), ["blanco", "negro"]);
  // Una chompa negra con brillos (gris oscuro): un solo color, negro.
  const s = R.coloresDeFoto(foto(40, 40, [245, 245, 243], (x, y) => ((x + y) % 3 === 0 ? [74, 74, 79] : [21, 21, 21])), 40, 40);
  assert.equal(s.length, 1);
  assert.equal(s[0].id, "negro");
  assert.ok(s[0].peso > 0.9);
  // Una foto vacía o rota no revienta.
  assert.deepEqual(R.coloresDeFoto(null, 0, 0), []);
  assert.deepEqual(R.coloresDeFoto(new Uint8ClampedArray(16), 2, 2), []);
});

test("el nombre de la prenda concuerda con el color", () => {
  const p = (tipo, color) => R.normalizar("x", { grupo: "arriba", tipo, colores: [{ id: color }] });
  assert.equal(R.titulo(p("Polera", "blanco")), "Polera blanca");
  assert.equal(R.titulo(p("Pantalón", "negro")), "Pantalón negro");
  assert.equal(R.titulo(p("Zapatillas", "negro")), "Zapatillas negras");
  assert.equal(R.titulo(p("Zapatos", "cafe")), "Zapatos cafés");
  assert.equal(R.titulo(p("Chamarra", "azul-marino")), "Chamarra azul marino");
  assert.equal(R.titulo(p("Guantes", "gris")), "Guantes grises");
  assert.equal(R.titulo(p("Jean", "azul-jean")), "Jean azul");
  assert.equal(R.titulo(p("Pantalón", "azul-jean")), "Pantalón azul jean");
  assert.equal(R.titulo(R.normalizar("x", { grupo: "abajo", tipo: "Jean" })), "Jean");
  assert.equal(R.titulo(R.normalizar("x", { grupo: "abajo", tipo: "Pantalón cargo", colores: [{ id: "verde-oliva" }] })), "Pantalón cargo verde oliva");
});

test("normalizar: lo viejo o a medias queda completo y limpio", () => {
  const p = R.normalizar("a1", { grupo: "nada", colores: [{ id: "rojo" }, { id: "inventado" }], clima: ["frio", "frio", "luna"], estilo: ["casual"], formalidad: "9", precio: -3, compra: "ayer", estado: "rara", fotos: [{ id: "f1", mini: "data:x" }, null] });
  assert.equal(p.grupo, "arriba");
  assert.equal(p.tipo, "Polera");
  assert.deepEqual(p.colores.map(c => c.id), ["rojo"]);
  assert.deepEqual(p.clima, ["frio"]);
  assert.equal(p.formalidad, null);
  assert.equal(p.precio, null);
  assert.equal(p.compra, "");
  assert.equal(p.estado, "activa");
  assert.deepEqual(p.fotos.map(f => f.id), ["f1"]);
  assert.equal(R.normalizar("b", { grupo: "zapatos", tipo: "Botas", formalidad: 4, estado: "lavar" }).formalidad, 4);
});

test("revisar el formulario", () => {
  assert.deepEqual(R.validar({ grupo: "abajo", tipo: "Jean" }), []);
  assert.deepEqual(R.validar({ grupo: "", tipo: "" }).map(e => e.campo), ["grupo", "tipo"]);
  assert.deepEqual(R.validar({ grupo: "abajo", tipo: "Jean", precio: "-5" }).map(e => e.campo), ["precio"]);
  assert.deepEqual(R.validar({ grupo: "abajo", tipo: "Jean", compra: "2026-13" }).map(e => e.campo), ["compra"]);
});

test("las veces que te la pusiste y el costo por uso", () => {
  const u = R.usos({ "2026-11-20": { prendas: ["a", "b"] }, "2026-11-18": { prendas: ["a"] }, "malo": { prendas: ["a"] }, "2026-11-21": { prendas: ["a", "a"] } });
  assert.deepEqual(u.get("a"), { n: 3, ultima: "2026-11-21", fechas: ["2026-11-18", "2026-11-20", "2026-11-21"] });
  assert.equal(u.get("b").n, 1);
  assert.equal(u.get("c"), undefined);
  assert.equal(R.fechaLarga("2026-11-22"), "domingo 22 de noviembre");
  assert.equal(R.fechaLarga("2026-03-04"), "miércoles 4 de marzo");
  assert.equal(R.fechaLarga("mal"), "");
  assert.equal(R.costoPorUso(300, 4), 75);
  assert.equal(R.costoPorUso(300, 0), null);
  assert.equal(R.costoPorUso(null, 3), null);
});

const ropero = [
  R.normalizar("p1", { grupo: "arriba", tipo: "Polera", colores: [{ id: "blanco" }], clima: ["calor", "templado"], estilo: ["casual"], tela: "Algodón", formalidad: 2, creado: 3 }),
  R.normalizar("p2", { grupo: "abajo", tipo: "Jean", colores: [{ id: "azul-jean" }], clima: ["frio", "templado"], formalidad: 2, marca: "Levi's", creado: 2 }),
  R.normalizar("p3", { grupo: "abrigos", tipo: "Chamarra", colores: [{ id: "negro" }], clima: ["frio"], formalidad: 3, estado: "lavar", creado: 1 }),
  R.normalizar("p4", { grupo: "zapatos", tipo: "Zapatillas", colores: [{ id: "gris-oscuro" }], formalidad: 1, estado: "fuera", fueraFecha: "2026-10-01", creado: 4 })
];

test("buscar sin importar tildes ni mayúsculas", () => {
  assert.deepEqual(R.buscar(ropero, "polera").map(p => p.id), ["p1"]);
  assert.deepEqual(R.buscar(ropero, "ALGODON").map(p => p.id), ["p1"]);
  assert.deepEqual(R.buscar(ropero, "levi").map(p => p.id), ["p2"]);
  assert.deepEqual(R.buscar(ropero, "chamarra negra").map(p => p.id), ["p3"]);
  assert.equal(R.buscar(ropero, "").length, 4);
});

test("filtrar: por grupo, color, clima, formalidad y estado", () => {
  assert.deepEqual(R.filtrar(ropero, {}).map(p => p.id), ["p1", "p2", "p3"]);
  assert.deepEqual(R.filtrar(ropero, { grupo: "abajo" }).map(p => p.id), ["p2"]);
  assert.deepEqual(R.filtrar(ropero, { color: "azul" }).map(p => p.id), ["p2"]);
  assert.deepEqual(R.filtrar(ropero, { color: "negro" }).map(p => p.id), ["p3"]);
  assert.deepEqual(R.filtrar(ropero, { clima: "frio" }).map(p => p.id), ["p2", "p3"]);
  assert.deepEqual(R.filtrar(ropero, { formalidad: "2" }).map(p => p.id), ["p1", "p2"]);
  assert.deepEqual(R.filtrar(ropero, { estado: "lavar" }).map(p => p.id), ["p3"]);
  assert.deepEqual(R.filtrar(ropero, { estado: "fuera" }).map(p => p.id), ["p4"]);
});

test("ordenar: recientes, más y menos usadas, por nombre", () => {
  const u = R.usos({ "2026-11-01": { prendas: ["p2", "p3"] }, "2026-11-02": { prendas: ["p2"] }, "2026-11-03": { prendas: ["p3"] } });
  const ids = (modo) => R.ordenar(ropero.slice(0, 3), modo, u).map(p => p.id);
  assert.deepEqual(ids("recientes"), ["p1", "p2", "p3"]);
  assert.deepEqual(ids("mas"), ["p3", "p2", "p1"]);
  assert.deepEqual(ids("menos"), ["p1", "p2", "p3"]);
  assert.deepEqual(ids("nombre"), ["p3", "p2", "p1"]);
});

test("las familias de color de tu ropero y el resumen", () => {
  const f = R.familias(ropero);
  assert.deepEqual(f.map(x => x.id).sort(), ["azul", "blanco", "negro"]);
  assert.deepEqual(R.resumen(ropero), { total: 3, porGrupo: { arriba: 1, abajo: 1, cuerpo: 0, abrigos: 1, zapatos: 0, accesorios: 0 }, lavar: 1, fuera: 1 });
});
