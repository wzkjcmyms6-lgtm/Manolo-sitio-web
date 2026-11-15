// "¿Qué leo después?" (js/libros-siguiente.js, D-108).
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/libros-siguiente.js");
const L = require("../js/libros-motor.js");

const HOY = "2026-11-15";
const libro = (id, d) => L.normalizarLibro(id, Object.assign({ v: 1, titulo: id, autor: "", estado: "por_leer", fechaRegistro: "2026-11-01", creado: 1 }, d));
const sumar = (f, n) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Un libro que leíste: 20 páginas por día durante 30 días, del 16 oct al 14 nov.
function leido(id, d) {
  const progreso = {};
  for (let i = 1; i <= 30; i++) progreso[sumar("2026-10-15", i)] = i * 20;
  return libro(id, Object.assign({ estado: "terminado", paginas: 600, paginaActual: 600, paginaBase: 0, fechaInicio: "2026-10-16", fechaFin: "2026-11-14", progreso }, d));
}

test("prioridad, saga y largo contra tu ritmo", () => {
  const base = [
    leido("t1", { genero: "novela" }),
    libro("corto", { titulo: "Corto", paginas: 120, genero: "novela" }),
    libro("largo", { titulo: "Largo", paginas: 1500, genero: "novela" }),
    libro("alta", { titulo: "Urgente", paginas: 400, genero: "novela", prioridad: "alta" }),
    libro("baja", { titulo: "Algún día", paginas: 120, genero: "novela", prioridad: "baja" })
  ];
  const r = S.siguientes(base, HOY, { metaDia: 30 });
  assert.deepEqual(r.map(x => x.id), ["alta", "corto", "largo", "baja"]);
  assert.deepEqual(r[0].razones, ["La marcaste con prioridad alta."]);
  assert.equal(r[1].razones[0], "Lo terminas en una semana a tu ritmo.", "120 páginas a unas 19 por día: 7 días");
  assert.equal(r[2].avisos[0], "Es largo: unos 3 meses a tu ritmo.");
  assert.equal(S.siguientes([libro("x", { estado: "leyendo" })], HOY).length, 0, "sin «Por leer», nada");
});

test("saga: el siguiente sube; si falta uno anterior, avisa", () => {
  const lista = [
    leido("s1", { titulo: "La comunidad", saga: "El Señor de los Anillos", sagaN: 1 }),
    libro("s2", { titulo: "Las dos torres", saga: "el señor de los anillos", sagaN: 2, paginas: 400 }),
    libro("s3", { titulo: "El retorno del rey", saga: "El Señor de los Anillos", sagaN: 3, paginas: 400 }),
    libro("h1", { titulo: "Dune", saga: "Dune", sagaN: 1, paginas: 400 }),
    libro("otro", { titulo: "Otro", paginas: 400 })
  ];
  const r = S.siguientes(lista, HOY, { metaDia: 30 });
  assert.equal(r[0].id, "s2");
  assert.deepEqual(r[0].razones, ["Sigue la saga «el señor de los anillos»: es el 2."]);
  assert.equal(r.find(x => x.id === "s3").avisos[0], "Antes va el 2 de «El Señor de los Anillos».");
  assert.equal(r[r.length - 1].id, "s3", "el 3 queda último hasta que leas el 2");
  assert.equal(r.find(x => x.id === "h1").razones[0], "Empieza la saga «Dune».");
});

test("géneros para equilibrar, reto atrasado y tiempo en la lista", () => {
  const lista = [
    leido("a", { genero: "novela", fechaFin: "2026-10-30" }),
    leido("b", { genero: "novela", fechaFin: "2026-11-01" }),
    libro("hist", { titulo: "Sapiens", genero: "historia", paginas: 900 }),
    libro("nov", { titulo: "Otra novela", genero: "novela", paginas: 900 }),
    libro("viejo", { titulo: "Viejo", paginas: 900, fechaRegistro: "2025-11-01" })
  ];
  const r = S.siguientes(lista, HOY, { metaDia: 30 });
  assert.deepEqual(r.map(x => x.id), ["hist", "viejo", "nov"]);
  assert.equal(r[0].razones[0], "Hace rato no lees historia: equilibra.");
  assert.equal(r[1].razones[0], "Lo tienes en la lista desde hace 12 meses.");
  // Reto atrasado: los cortos suben más.
  const conReto = S.siguientes([leido("c", {}), libro("cor", { paginas: 200 })], "2026-12-20", { metaDia: 30, retoMeta: 24 });
  assert.ok(conReto[0].razones.includes("Te ayuda a ponerte al día con tu reto."));
});

test("ritmo: tus páginas de los últimos 30 días o tu meta", () => {
  assert.equal(S.ritmoDiario([leido("a", {})], "2026-11-14", 30), 20);
  assert.equal(S.ritmoDiario([], HOY, 45), 45, "sin lectura anotada, la meta");
});
