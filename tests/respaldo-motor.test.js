// Copia de seguridad de todo Manolo (js/respaldo-motor.js, D-118): armar,
// revisar el archivo y restaurar SOLO lo que falta (nunca borrar ni pisar).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../js/respaldo-motor.js");

// Un Timestamp de Firestore de mentira (tiene toMillis, como el real).
const ts = ms => ({ toMillis: () => ms, _ts: true });
const FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

test("la copia lleva todas tus colecciones (también Lugares y sus fotos)", () => {
  const c = R.armar({
    colecciones: {
      finanzas: { a1: { type: "gasto", montoCent: 1250, date: "2026-11-10" }, a2: { type: "ingreso", montoCent: 300000, date: "2026-11-01" } },
      lugares: { l1: { v: 1, nombre: "Pollos Copacabana", calificacion: 5, volveria: "si" } },
      meta: { finanzas: { budgetStartDay: 1 } }
    },
    fotosLugares: [{ id: "f1", lugarId: "l1", ancho: 1200, alto: 900, datos: FOTO }, { id: "mala", lugarId: "l1", datos: "no es foto" }]
  }, Date.UTC(2026, 10, 15, 12));
  assert.deepEqual([c.app, c.tipo, c.version, c.exportado], ["Manolo", "copia-completa", 1, "2026-11-15T12:00:00.000Z"]);
  assert.deepEqual(Object.keys(c.colecciones), R.COLECCIONES.map(x => x.id));
  assert.equal(c.conteos.finanzas, 2);
  assert.equal(c.conteos.lugares, 1);
  assert.equal(c.conteos.libros, 0);
  assert.equal(c.conteos.fotosLugares, 1, "la foto dañada no entra");
  assert.equal(R.total(c.conteos), 4);
  assert.equal(c.colecciones.lugares.l1.nombre, "Pollos Copacabana");
  // Se puede pasar a texto y volver sin perder nada.
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
});

test("las fechas de Firestore (Timestamp) se guardan y vuelven", () => {
  const doc = { creado: ts(1763200000000), lista: [ts(5), 1, "x"], anidado: { cuando: ts(7), n: null } };
  const enc = R.codificar(doc);
  assert.deepEqual(enc, { creado: { __tipo: "timestamp", ms: 1763200000000 }, lista: [{ __tipo: "timestamp", ms: 5 }, 1, "x"], anidado: { cuando: { __tipo: "timestamp", ms: 7 }, n: null } });
  const dec = R.decodificar(enc, ms => ({ ms, real: true }));
  assert.deepEqual(dec, { creado: { ms: 1763200000000, real: true }, lista: [{ ms: 5, real: true }, 1, "x"], anidado: { cuando: { ms: 7, real: true }, n: null } });
  // Sin Firestore a mano, queda el número de milisegundos.
  assert.equal(R.decodificar(enc).creado, 1763200000000);
});

test("revisa el archivo antes de restaurar", () => {
  const buena = R.armar({ colecciones: { libros: { b1: { titulo: "El principito" } } } }, 0);
  const v = R.validar(JSON.parse(JSON.stringify(buena)));
  assert.equal(v.ok, true);
  assert.equal(v.colecciones.libros.b1.titulo, "El principito");
  assert.equal(v.danados, 0);

  assert.match(R.validar(null).error, /No pude leer/);
  assert.match(R.validar([1, 2]).error, /No pude leer/);
  assert.match(R.validar({ app: "Otra cosa" }).error, /no es una copia de Manolo/);
  // Hábitos y Finanzas tienen su propio "Importar": se dice dónde.
  assert.match(R.validar({ app: "manolo-habitos", version: 1, habitos: [] }).error, /Hábitos › Ajustes/);
  assert.match(R.validar({ app: "manolo-finanzas", version: 1, datos: {} }).error, /Finanzas › Ajustes/);
  // Los resúmenes de una sección (Libros, Biblia, Inversiones, Medir tiempos) no se restauran.
  assert.match(R.validar({ app: "Manolo · Libros", version: 1, libros: [] }).error, /una sola sección/);
  assert.match(R.validar({ app: "Manolo", seccion: "Medir tiempos", version: 1, dias: {} }).error, /una sola sección/);
  assert.match(R.validar(Object.assign({}, buena, { version: "1" })).error, /sin versión/);
  assert.match(R.validar(Object.assign({}, buena, { version: 2 })).error, /versión más nueva/);
  assert.match(R.validar(Object.assign({}, buena, { colecciones: [] })).error, /sin datos/);
  assert.match(R.validar(buena, R.MAX_BYTES + 1).error, /demasiado grande/);
});

test("lo dañado o desconocido se deja afuera (y se avisa), lo bueno entra", () => {
  const v = R.validar({
    app: "Manolo", tipo: "copia-completa", version: 1,
    colecciones: {
      finanzas: { ok1: { montoCent: 100 }, "a/b": { montoCent: 1 }, "__x__": {}, ok2: "texto", ok3: [1] },
      lugares: "no es un mapa",
      inventada: { z: {} },
      finanzas_respaldos: { r: {} }
    },
    fotosLugares: [{ id: "f1", lugarId: "l1", datos: FOTO }, { id: "f2", lugarId: "l1", datos: "javascript:alert(1)" }, 5]
  });
  assert.equal(v.ok, true);
  assert.deepEqual(Object.keys(v.colecciones.finanzas), ["ok1"]);
  assert.deepEqual(v.colecciones.lugares, {});
  assert.equal(v.danados, 4 + 2);
  assert.deepEqual(v.desconocidas, ["inventada", "finanzas_respaldos"]);
  assert.equal(v.colecciones.inventada, undefined);
  assert.deepEqual(v.fotos.map(f => f.id), ["f1"]);
});

test("el «Exportar (JSON)» de Lugares también se puede restaurar", () => {
  const v = R.validar({
    app: "Manolo · Lugares", version: 1, exportado: "2026-11-10T12:00:00.000Z",
    lugares: [{ id: "l1", v: 1, nombre: "Gustu", calificacion: 5 }, { id: "a/b", nombre: "Malo" }, "texto"],
    fotos: [{ id: "f1", lugarId: "l1", ancho: 1200, alto: 900, datos: FOTO }]
  });
  assert.equal(v.ok, true);
  assert.equal(v.seccion, "lugares");
  assert.deepEqual(v.colecciones.lugares, { l1: { v: 1, nombre: "Gustu", calificacion: 5 } }, "sin el id adentro del documento");
  assert.equal(v.danados, 2);
  assert.deepEqual(v.fotos.map(f => f.id), ["f1"]);
  assert.equal(v.exportado, "2026-11-10T12:00:00.000Z");
  const p = R.plan(v, { lugares: ["l1"] }, []);
  assert.deepEqual([p.totalNuevos, p.totalYaTenias, p.fotosNuevas.length], [0, 1, 1], "el lugar ya está: solo vuelve la foto");
  assert.match(R.validar({ app: "Manolo · Lugares", version: 2, lugares: [] }).error, /versión más nueva/);
});

test("restaurar solo agrega lo que falta: nunca pisa lo que ya tienes", () => {
  const v = R.validar(R.armar({
    colecciones: {
      finanzas: { a1: { montoCent: 999 }, a2: { montoCent: 200 }, a3: { montoCent: 300 } },
      lugares: { l1: { nombre: "Viejo nombre" }, l2: { nombre: "Gustu" } },
      libros: { b1: { titulo: "Uno" } }
    },
    fotosLugares: [{ id: "f1", lugarId: "l1", datos: FOTO }, { id: "f2", lugarId: "l2", datos: FOTO }]
  }, 0));
  // Ya tienes a1 (con otro monto) y l1 (renombrado): se quedan como están.
  const p = R.plan(v, { finanzas: ["a1"], lugares: new Set(["l1"]) }, ["f1"]);
  assert.deepEqual(p.nuevos.finanzas.map(d => d.id), ["a2", "a3"]);
  assert.deepEqual(p.nuevos.lugares.map(d => d.id), ["l2"]);
  assert.deepEqual(p.nuevos.libros.map(d => d.id), ["b1"]);
  assert.ok(!p.nuevos.finanzas.some(d => d.id === "a1"), "a1 ya existe: no se toca");
  assert.equal(p.nuevos.lugares[0].data.nombre, "Gustu");
  assert.deepEqual([p.totalNuevos, p.totalYaTenias], [4, 2]);
  assert.deepEqual(p.fotosNuevas.map(f => f.id), ["f2"]);
  assert.deepEqual(p.porColeccion.map(c => [c.id, c.nuevos, c.yaTenias]), [["finanzas", 2, 1], ["libros", 1, 0], ["lugares", 1, 1]]);
  assert.equal(p.vacio, false);
  assert.equal(R.resumen(p), "2 movimientos de Finanzas, 1 libro, 1 lugar y 1 foto de Lugares");
  // La misma copia otra vez: ya está todo, no hay nada que agregar.
  const otra = R.plan(v, { finanzas: ["a1", "a2", "a3"], lugares: ["l1", "l2"], libros: ["b1"] }, ["f1", "f2"]);
  assert.equal(otra.vacio, true);
  assert.equal(otra.totalYaTenias, 6);
  assert.equal(R.resumen(otra), "");
});

test("ids válidos de Firestore", () => {
  ["a", "abc-123_X", "l_1763200000000_ab12", "2026-11-15"].forEach(id => assert.equal(R.idOk(id), true, id));
  ["", ".", "..", "a/b", "__id__", 5, null, "x".repeat(701)].forEach(id => assert.equal(R.idOk(id), false, String(id)));
  assert.equal(R.lista([]), "");
  assert.equal(R.lista(["a"]), "a");
  assert.equal(R.lista(["a", "b", "c"]), "a, b y c");
});

test("ninguna colección tuya queda fuera de la copia", () => {
  // Cada colección de users/{uid} que usa la app tiene que estar en la copia,
  // o en esta lista de excluidas a propósito (D-118).
  const EXCLUIDAS = new Set(["users", "finanzas_respaldos", "accesos", "admins", "feed", "comentarios"]);
  const ids = R.COLECCIONES.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, "sin repetidas");
  const usadas = new Set();
  const dir = path.join(__dirname, "..", "js");
  const leer = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "vendor") leer(p); return; }
    if (!e.name.endsWith(".js")) return;
    const s = fs.readFileSync(p, "utf8");
    for (const m of s.matchAll(/\b(?:collection|coleccion|ref)\(\s*["'`]([a-z_]+)["'`]\s*\)/g)) usadas.add(m[1]);
    for (const m of s.matchAll(/\bcoleccion:\s*["']([a-z_]+)["']/g)) usadas.add(m[1]);
  });
  leer(dir);
  const faltan = [...usadas].filter(n => !EXCLUIDAS.has(n) && !ids.includes(n));
  assert.deepEqual(faltan, [], "agrega estas colecciones a COLECCIONES en js/respaldo-motor.js");
  ["lugares", "finanzas", "habitos", "libros", "biblia", "tiempos", "inversiones"].forEach(n => assert.ok(ids.includes(n), n));
  assert.ok(!ids.includes("finanzas_respaldos"));
  // Cada una con su nombre en plural y en singular (para el resumen).
  R.COLECCIONES.forEach(c => assert.ok(c.nombre && c.uno && c.nombre !== c.uno, c.id));
});

// Ropa (D-146): sus colecciones y sus fotos (que viven en el teléfono) entran
// en la copia; restaurar solo agrega las que faltan.
test("la copia lleva tu ropa y sus fotos; restaurar suma solo las que faltan", () => {
  const c = R.armar({
    colecciones: { ropa: { p1: { grupo: "arriba", tipo: "Polera", fotos: [{ id: "r1", mini: FOTO }] } }, ropa_usos: { "2026-11-20": { prendas: ["p1"] } } },
    fotosRopa: [{ id: "r1", grupoId: "p1", clase: "prenda", ancho: 900, alto: 1200, datos: FOTO }, { id: "mala", grupoId: "p1", datos: "no" }, { id: "sin", datos: FOTO }]
  }, Date.UTC(2026, 10, 22));
  assert.equal(c.conteos.ropa, 1);
  assert.equal(c.conteos.ropa_usos, 1);
  assert.equal(c.conteos.fotosRopa, 1, "las fotos dañadas o sin prenda no entran");
  assert.deepEqual(c.fotosRopa.map(f => f.id), ["r1"]);
  const v = R.validar(JSON.parse(JSON.stringify(Object.assign({}, c, { fotosRopa: c.fotosRopa.concat([{ id: "x", grupoId: "p1", datos: "javascript:alert(1)" }]) }))));
  assert.ok(v.ok);
  assert.equal(v.fotosRopa.length, 1);
  assert.equal(v.danados, 1);
  // Ya tenías la prenda pero no su foto: entra solo la foto.
  const p = R.plan(v, { ropa: ["p1"] }, [], []);
  assert.equal(p.totalNuevos, 1, "solo el día anotado es nuevo");
  assert.deepEqual(p.fotosRopaNuevas.map(f => f.id), ["r1"]);
  assert.match(R.resumen(p), /1 foto de Ropa/);
  // Con la foto ya en el teléfono, no hay nada de Ropa para agregar.
  const p2 = R.plan(v, { ropa: ["p1"], ropa_usos: ["2026-11-20"] }, [], new Set(["r1"]));
  assert.ok(p2.vacio);
  // Una copia vieja (sin fotosRopa) sigue sirviendo.
  const vieja = R.validar({ app: "Manolo", tipo: R.TIPO, version: 1, colecciones: { lugares: {} } });
  assert.ok(vieja.ok);
  assert.deepEqual(vieja.fotosRopa, []);
});
