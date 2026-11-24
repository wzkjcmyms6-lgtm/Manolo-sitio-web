// Ropa (js/ropa-motor.js, D-146): colores con nombre, color de una foto,
// nombre de cada prenda, normalizar, revisar, usos, buscar, filtrar, ordenar;
// el corte, las mangas y las mayúsculas (D-154).
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

test("el corte y las mangas: por grupo y con el nombre que va con la prenda (D-154)", () => {
  // Cada grupo con sus cortes; zapatos y accesorios, ninguno.
  assert.deepEqual(Object.keys(R.CORTES_DE), R.GRUPOS.map(g => g.id));
  Object.values(R.CORTES_DE).flat().forEach(c => assert.ok(R.CORTES.some(x => x[0] === c), c));
  assert.deepEqual(R.CORTES_DE.zapatos, []);
  assert.deepEqual(R.CORTES_DE.accesorios, []);
  // El nombre concuerda: "Polera pegada", "Jean recto", "Leggings pitillo", "Shorts sueltos".
  assert.equal(R.nombreCorte("pegado", "Polera"), "Pegada");
  assert.equal(R.nombreCorte("pegado", "Jean"), "Pegado");
  assert.equal(R.nombreCorte("recto", "Falda"), "Recta");
  assert.equal(R.nombreCorte("acampanado", "Vestido"), "Acampanado");
  assert.equal(R.nombreCorte("suelto", "Leggings"), "Sueltos");
  assert.equal(R.nombreCorte("pitillo", "Leggings"), "Pitillo", "pitillo no cambia");
  assert.equal(R.nombreCorte("oversize", "Chompa"), "Oversize");
  assert.equal(R.nombreCorte("regular", "Zapatillas"), "Regulares");
  assert.equal(R.nombreCorte("regular", "Camisa"), "Regular");
  assert.equal(R.nombreCorte("", "Polera"), "");
  assert.equal(R.nombreCorte("raro", "Polera"), "");
  assert.equal(R.nombreManga("corta"), "Manga corta");
  assert.equal(R.nombreManga("sin"), "Sin mangas");
  assert.equal(R.nombreManga(""), "");
  // normalizar: solo lo que va con el grupo.
  const polera = R.normalizar("c1", { grupo: "arriba", tipo: "Polera", corte: "pegado", manga: "corta" });
  assert.equal(polera.corte, "pegado");
  assert.equal(polera.manga, "corta");
  const jean = R.normalizar("c2", { grupo: "abajo", tipo: "Jean", corte: "oversize", manga: "larga" });
  assert.equal(jean.corte, "", "oversize no es un corte de pantalón");
  assert.equal(jean.manga, "", "un jean no tiene mangas");
  assert.equal(R.normalizar("c3", { grupo: "zapatos", tipo: "Botas", corte: "recto" }).corte, "");
  assert.equal(R.normalizar("c4", { grupo: "cuerpo", tipo: "Vestido", corte: "acampanado", manga: "sin" }).manga, "sin");
  // Lo viejo (sin corte ni mangas) sigue igual.
  const viejo = R.normalizar("c5", { grupo: "arriba", tipo: "Camisa" });
  assert.equal(viejo.corte, "");
  assert.equal(viejo.manga, "");
  // En el renglón de la tarjeta, primero el corte.
  assert.equal(R.detalle(R.normalizar("c6", { grupo: "arriba", tipo: "Polera", corte: "pegado", tela: "algodón", estilo: ["casual"], clima: ["frio", "templado"], marca: "adidas" })),
    "Pegada · Algodón · Casual · Frío y templado · Adidas");
});

test("lo que escribes queda con mayúscula; la talla en letras, toda en mayúscula (D-154)", () => {
  const p = R.normalizar("m1", { grupo: "abajo", tipo: "pantalón cargo", tela: "jean", marca: "levi's", talla: "m", notas: "me la regaló mi hermana" });
  assert.equal(p.tipo, "Pantalón cargo");
  assert.equal(p.tela, "Jean");
  assert.equal(p.marca, "Levi's");
  assert.equal(p.talla, "M");
  assert.equal(p.notas, "Me la regaló mi hermana");
  assert.equal(R.talla("xl"), "XL");
  assert.equal(R.talla(" xs "), "XS");
  assert.equal(R.talla("38"), "38");
  assert.equal(R.talla("32/34"), "32/34");
  assert.equal(R.talla("talla única"), "Talla única");
  assert.equal(R.talla(""), "");
  assert.equal(R.mayus("ñandú"), "Ñandú");
  assert.equal(R.mayus("¿algo?"), "¿Algo?", "también después de un signo");
  assert.equal(R.mayus("(regalo)"), "(Regalo)");
  assert.equal(R.mayus("3 poleras"), "3 poleras", "si empieza con un número, igual");
  assert.equal(R.talla("2xl"), "2XL");
  assert.equal(R.talla("s/m"), "S/M");
  assert.equal(R.talla("eu 42"), "EU 42");
  assert.equal(R.talla("10 años"), "10 años");
  assert.equal(R.mayus(null), "");
  // Lo que ya tenía mayúsculas no se toca.
  assert.equal(R.normalizar("m2", { grupo: "arriba", tipo: "Polera", marca: "H&M", tela: "Algodón pima" }).marca, "H&M");
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
  assert.deepEqual(R.buscar([R.normalizar("q1", { grupo: "arriba", tipo: "Polera", corte: "oversize", manga: "larga" }), ropero[1]], "oversize manga larga").map(p => p.id), ["q1"], "también por el corte y las mangas");
  const pegada = [R.normalizar("q2", { grupo: "arriba", tipo: "Polera", corte: "pegado" })];
  assert.equal(R.buscar(pegada, "pegada").length, 1, "«pegada», como se ve en la ficha");
  assert.equal(R.buscar(pegada, "pegado").length, 1, "y «pegado», como lo escribirías");
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
