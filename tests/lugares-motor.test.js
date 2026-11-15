// Lugares: validar, leer, buscar, filtrar, ordenar, sugerir y estadísticas (js/lugares-motor.js, D-117).
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/lugares-motor.js");

const HOY = "2026-11-15";
// Un lugar ya leído (normalizado) a partir de un documento.
const lugar = (id, d) => L.normalizar(id, Object.assign({ v: 1, estado: "visitado", calificacion: 4, volveria: "si" }, d));

test("miniaturas: solo imágenes de verdad (nada que se salga del HTML)", () => {
  const ok = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  const l = L.normalizar("x", { v: 1, nombre: "A", estado: "visitado", calificacion: 4, volveria: "si",
    fotos: [{ id: "f1", mini: ok }, { id: "f2", mini: 'data:image/png" onerror="alert(1)' }, { id: "f3", mini: "javascript:alert(1)" }, { id: "f4", mini: 5 }] });
  assert.deepEqual(l.fotos.map(f => f.mini), [ok, null, null, null]);
  assert.equal(L.miniOk(ok), true);
  assert.equal(L.miniOk("data:image/svg+xml;base64,PHN2Zz4="), false, "sin SVG");
});

test("registrar en segundos: solo nombre, estrellas y ¿volverías?", () => {
  const r = L.validarLugar({ nombre: "  Pollos   Copacabana ", calificacion: "5", volveria: "si" });
  assert.equal(r.ok, true);
  assert.deepEqual([r.doc.v, r.doc.nombre, r.doc.estado, r.doc.calificacion, r.doc.volveria, r.doc.tipo, r.doc.precio, r.doc.gastoAproxCent], [1, "Pollos Copacabana", "visitado", 5, "si", null, null, null]);
  assert.deepEqual(r.doc.etiquetas, []);
  const mal = L.validarLugar({ nombre: "", calificacion: 0 });
  assert.deepEqual(mal.errores.map(e => e.campo), ["nombre", "calificacion", "volveria"]);
  // "Quiero ir": solo el nombre (sin estrellas ni volvería).
  const q = L.validarLugar({ nombre: "Gustu", estado: "quiero", calificacion: 5, volveria: "no" });
  assert.equal(q.ok, true);
  assert.deepEqual([q.doc.estado, q.doc.calificacion, q.doc.volveria], ["quiero", null, null]);
});

test("más detalles: tipo, zona, Maps, precio, gasto, desglose, etiquetas y notas", () => {
  const r = L.validarLugar({ nombre: "La Cafetería", calificacion: 4, volveria: "tal_vez", tipo: "cafe", zona: " Sopocachi ", maps: "https://maps.app.goo.gl/abc123",
    especialidad: "Café de altura", precio: "2", gastoAprox: "45,50", desglose: { comida: 5, atencion: "4", ambiente: 9, precioCalidad: "" },
    etiquetas: "Wifi, tranquilo ,wifi", notas: "  Buen lugar\npara leer  " });
  assert.equal(r.ok, true);
  assert.deepEqual([r.doc.tipo, r.doc.zona, r.doc.precio, r.doc.gastoAproxCent], ["cafe", "Sopocachi", 2, 4550]);
  assert.deepEqual(r.doc.desglose, { comida: 5, atencion: 4, ambiente: null, precioCalidad: null });
  assert.deepEqual(r.doc.etiquetas, ["wifi", "tranquilo"]);
  assert.equal(r.doc.notas, "Buen lugar\npara leer");
  assert.equal(L.validarLugar({ nombre: "X", calificacion: 3, volveria: "si", tipo: "hamburguesería" }).doc.tipo, null, "un tipo que no existe queda vacío");
  assert.deepEqual(L.validarLugar({ nombre: "X", calificacion: 3, volveria: "si", maps: "maps de google" }).errores.map(e => e.campo), ["maps"]);
  assert.deepEqual(L.validarLugar({ nombre: "X", calificacion: 3, volveria: "si", gastoAprox: "mucho" }).errores.map(e => e.campo), ["gastoAprox"]);
});

test("montos a centavos (con coma, punto o miles), vacío y errores", () => {
  assert.equal(L.aCent("85,50"), 8550);
  assert.equal(L.aCent("85.5"), 8550);
  assert.equal(L.aCent("1.250,75"), 125075);
  assert.equal(L.aCent("Bs 20"), 2000);
  assert.equal(L.aCent(12.3), 1230);
  assert.equal(L.aCent(""), null);
  assert.equal(L.aCent(null), null);
  assert.ok(Number.isNaN(L.aCent("abc")));
  assert.ok(Number.isNaN(L.aCent("-5")));
  assert.ok(Number.isNaN(L.aCent("1,234")), "tres decimales: no es un monto");
});

test("platos y visitas: validar (la visita no puede ser futura)", () => {
  const p = L.validarPlato({ nombre: "Salteña de pollo", precio: "8", gusto: "si", nota: "Jugosa", favorito: true });
  assert.deepEqual(p.plato, { nombre: "Salteña de pollo", precioCent: 800, gusto: true, nota: "Jugosa", favorito: true });
  assert.equal(L.validarPlato({ nombre: "Api", gusto: "no" }).plato.gusto, false);
  assert.equal(L.validarPlato({ nombre: "Api" }).plato.gusto, null);
  assert.deepEqual(L.validarPlato({ nombre: "" }).errores.map(e => e.campo), ["nombre"]);
  const v = L.validarVisita({ fecha: "2026-11-14", conQuien: "Ana", gasto: "120", nota: "Cumpleaños" }, HOY);
  assert.deepEqual(v.visita, { fecha: "2026-11-14", conQuien: "Ana", gastoCent: 12000, nota: "Cumpleaños" });
  assert.deepEqual(L.validarVisita({ fecha: "2026-11-16" }, HOY).errores.map(e => e.texto), ["La fecha no puede ser futura."]);
  assert.deepEqual(L.validarVisita({ fecha: "ayer" }, HOY).errores.map(e => e.campo), ["fecha"]);
});

test("leer lo guardado: documentos viejos o incompletos no rompen nada", () => {
  const l = L.normalizar("a", { nombre: "Doña Rosa", calificacion: 7, volveria: "quizas", precio: 5, maps: "javascript:alert(1)",
    platos: { p1: { nombre: "Sopa", creado: 2 }, p2: { nombre: "Picante", favorito: true, creado: 3 }, p3: { nombre: "" } },
    visitas: { v1: { fecha: "2026-10-01", gastoCent: 5000 }, v2: { fecha: "2026-11-02", gastoCent: 3000 }, v3: { fecha: "mal" } },
    fotos: [{ id: "f1", mini: "data:image/jpeg;base64,AAA" }, { id: "f2", mini: "https://otro.com/x.jpg" }, { mini: "data:image/jpeg;base64,BBB" }] });
  assert.deepEqual([l.estado, l.calificacion, l.volveria, l.precio, l.maps], ["visitado", null, null, null, ""]);
  assert.deepEqual(l.platos.map(p => p.nombre), ["Picante", "Sopa"], "el favorito primero; los vacíos no");
  assert.deepEqual(l.visitas.map(v => v.fecha), ["2026-11-02", "2026-10-01"], "la más nueva primero");
  assert.deepEqual(l.fotos.map(f => [f.id, f.mini]), [["f1", "data:image/jpeg;base64,AAA"], ["f2", null]], "solo miniaturas propias");
  assert.equal(L.normalizar("b", null).nombre, "Sin nombre");
  assert.deepEqual(L.resumenVisitas(l), { veces: 2, ultima: "2026-11-02", gastoCent: 8000 });
  assert.equal(L.favorito(l).nombre, "Picante");
  assert.equal(L.precioTxt(2), "$$");
});

const LUGARES = [
  lugar("a", { nombre: "Pollos Copacabana", tipo: "rapida", zona: "Centro", precio: 1, calificacion: 4, volveria: "si", etiquetas: ["pollo"], platos: { p: { nombre: "Cuarto de pollo" } }, visitas: { v1: { fecha: "2026-11-10", gastoCent: 4500 }, v2: { fecha: "2026-10-01", gastoCent: 4000 } }, actualizado: 5 }),
  lugar("b", { nombre: "Café Árabe", tipo: "cafe", zona: "Sopocachi", precio: 2, calificacion: 5, volveria: "si", especialidad: "Té de menta", visitas: { v1: { fecha: "2026-11-12", gastoCent: 3000 } }, actualizado: 4 }),
  lugar("c", { nombre: "Gustu", tipo: "restaurante", zona: "Calacoto", precio: 3, calificacion: 5, volveria: "tal_vez", etiquetas: ["especial"], actualizado: 6 }),
  lugar("d", { nombre: "Salteñería Paceña", tipo: "otro", zona: "sopocachi", calificacion: 3, volveria: "no", platos: { p: { nombre: "Salteña de pollo" } }, actualizado: 1 }),
  lugar("e", { nombre: "El Ceibo", estado: "quiero", tipo: "pasteleria", zona: "Centro", actualizado: 9 })
];

test("buscar por nombre, plato o etiqueta (sin tildes) y filtrar", () => {
  const ids = (f) => L.filtrar(LUGARES, f).map(l => l.id).sort().join("");
  assert.equal(ids({ q: "cafe arabe" }), "b", "sin tildes y todas las palabras");
  assert.equal(ids({ q: "pollo" }), "ad", "por plato y por etiqueta");
  assert.equal(ids({ q: "menta" }), "b", "por lo que venden");
  assert.equal(ids({ estado: "quiero" }), "e");
  assert.equal(ids({ estado: "visitado", zona: "Sopocachi" }), "bd", "la zona sin importar mayúsculas");
  assert.equal(ids({ tipo: "cafe" }), "b");
  assert.equal(ids({ precio: "3" }), "c");
  assert.equal(ids({ volveria: "si" }), "ab");
  assert.equal(ids({ minCal: 5 }), "bc");
  assert.deepEqual(L.zonas(LUGARES), ["Calacoto", "Centro", "Sopocachi"]);
});

test("ordenar: mejor calificados, más visitados, recientes y más baratos", () => {
  const vis = L.filtrar(LUGARES, { estado: "visitado" });
  assert.deepEqual(L.ordenar(vis, "mejores").map(l => l.id), ["b", "c", "a", "d"]);
  assert.deepEqual(L.ordenar(vis, "visitados").map(l => l.id), ["a", "b", "c", "d"]);
  assert.deepEqual(L.ordenar(vis, "recientes").map(l => l.id), ["b", "a", "c", "d"], "por la última visita; sin visitas, por lo último que cambiaste");
  assert.deepEqual(L.ordenar(vis, "baratos").map(l => l.id), ["a", "b", "c", "d"], "sin precio, al final");
});

test("¿Dónde como hoy?: al azar entre los que volverías (y sin repetir el último)", () => {
  const ids = new Set();
  for (let i = 0; i < 10; i++) ids.add(L.sugerir(LUGARES, {}, () => i / 10).id);
  assert.deepEqual([...ids].sort(), ["a", "b"], "solo visitados con Volvería: Sí");
  assert.equal(L.sugerir(LUGARES, { tipo: "cafe" }, () => 0.99).id, "b");
  assert.equal(L.sugerir(LUGARES, { precio: 1 }, () => 0).id, "a");
  assert.equal(L.sugerir(LUGARES, {}, () => 0, "a").id, "b", "evita repetir el último");
  assert.equal(L.sugerir(LUGARES, { tipo: "bar" }, () => 0), null, "nada que sugerir");
  assert.equal(L.sugerir([LUGARES[0]], {}, () => 0, "a").id, "a", "si hay uno solo, ese");
});

test("estadísticas: total, promedio, top 5, gasto en salidas y tipo más visitado", () => {
  const e = L.estadisticas(LUGARES);
  assert.deepEqual([e.total, e.visitados, e.quiero, e.promedio, e.visitasTotal], [5, 4, 1, 4.3, 3]);
  assert.deepEqual(e.top5.map(l => l.id), ["b", "c", "a", "d"]);
  assert.equal(e.gastoTotalCent, 11500);
  assert.deepEqual([e.tipoTop.id, e.tipoTop.n, e.tipoTop.por], ["rapida", 2, "visitas"]);
  const vacio = L.estadisticas([]);
  assert.deepEqual([vacio.total, vacio.promedio, vacio.tipoTop, vacio.gastoTotalCent], [0, null, null, 0]);
});

test("etiquetas y links", () => {
  assert.deepEqual(L.etiquetasDe("#Vegano, barato; vegano"), ["vegano", "barato"]);
  assert.equal(L.etiquetasDe(Array.from({ length: 20 }, (_, i) => `e${i}`)).length, 12);
  assert.equal(L.mapsOk("https://www.google.com/maps/place/X"), true);
  assert.equal(L.mapsOk(""), true);
  assert.equal(L.mapsOk("ftp://x"), false);
  assert.ok(/^p[0-9a-z]+$/.test(L.nuevoId("p", 1700000000000, () => 0.5)));
});

test("montos y fechas como en el resto de la app", () => {
  assert.equal(L.bs(125075), "Bs 1.250,75");
  assert.equal(L.bs(10000), "Bs 100");
  assert.equal(L.bs(null), "Bs 0");
  assert.equal(L.fechaCorta("2026-11-10", HOY), "10 nov");
  assert.equal(L.fechaCorta("2025-03-02", HOY), "2 mar 2025");
  assert.equal(L.fechaCorta("mal", HOY), "");
});

