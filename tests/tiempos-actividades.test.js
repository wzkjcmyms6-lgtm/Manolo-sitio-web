// Medir tiempos: tus actividades (js/tiempos-actividades.js, D-113).
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/tiempos-actividades.js");

test("sin ajustes: las 6 de siempre, con su id, emoji y de dónde se llenan solas", () => {
  const l = A.lista(null);
  assert.deepEqual(l.map(a => a.id), ["manana", "ejercicio", "correr", "desayunar", "banarse", "leer"]);
  assert.deepEqual(l.map(a => a.fuente), ["", "gimnasio", "running", "", "", "libros"]);
  assert.ok(l.every(a => a.base && !a.archivada && a.manana && a.emoji));
  assert.equal(A.etiqueta(l[0]), "🌅 Rutina de la mañana");
  assert.equal(A.pasosManana(null).length, 6);
});

test("renombrar, ordenar, archivar, sacar de la mañana y crear", () => {
  const ajustes = { actividades: {
    leer: { nombre: "Leer", emoji: "📚", orden: 0 },
    correr: { archivada: true, orden: 2 },
    desayunar: { manana: false, orden: 1 },
    "a-orar": { nombre: "Orar", emoji: "🙏", orden: 3, fuente: "movilidad" },
    "MAL ID": { nombre: "x" },
    "a-vacia": { nombre: "  " }
  } };
  const l = A.lista(ajustes);
  assert.deepEqual(l.map(a => a.id), ["leer", "manana", "desayunar", "ejercicio", "correr", "a-orar", "banarse"], "por orden (y por nombre si empatan)");
  assert.deepEqual(l.slice(0, 2).map(a => [a.id, a.nombre, a.emoji]), [["leer", "Leer", "📚"], ["manana", "Rutina de la mañana", "🌅"]], "el orden guardado manda");
  assert.ok(!l.some(a => a.id === "MAL ID" || a.id === "a-vacia"), "lo inválido no aparece");
  assert.deepEqual(A.archivadas(ajustes).map(a => a.id), ["correr"]);
  assert.ok(!A.pasosManana(ajustes).some(a => a.id === "desayunar" || a.id === "correr"), "fuera de la mañana: desayunar (no va) y correr (archivada)");
  assert.equal(l.find(a => a.id === "a-orar").fuente, "movilidad");
  const n = A.nueva({ nombre: "Pasear al perro", emoji: "🐕" }, l);
  assert.deepEqual([n.ok, n.id, n.doc.nombre, n.doc.emoji, n.doc.orden > Math.max(...l.map(a => a.orden)) - 1, n.doc.manana], [true, "a-pasear-al-perro", "Pasear al perro", "🐕", true, true]);
  assert.equal(A.nueva({ nombre: "leer" }, l).error, "Ya tienes una actividad con ese nombre.", "sin repetir (sin importar mayúsculas)");
  assert.equal(A.nueva({ nombre: "" }, l).error, "Escribe el nombre.");
  assert.equal(A.nueva({ nombre: "Orar", emoji: "abc" }, []).error, "El ícono tiene que ser un emoji.");
  assert.equal(A.nuevoId("Orar", l), "a-orar-2", "si el id ya existe, lleva número");
  assert.equal(A.nuevoId("Ñandú ágil", []), "a-nandu-agil");
});

test("subir y bajar: solo entre las activas, las archivadas quedan al final", () => {
  const l = A.lista({ actividades: { correr: { archivada: true } } });
  const o = A.mover(l, "desayunar", -1);
  assert.deepEqual(Object.keys(o).sort((a, b) => o[a] - o[b]), ["manana", "desayunar", "ejercicio", "banarse", "leer", "correr"], "desayunar sube un lugar");
  assert.equal(A.mover(l, "manana", -1), null, "la primera no sube");
  assert.equal(A.mover(l, "leer", 1), null, "la última no baja");
  const g = A.paraGuardar(l);
  assert.deepEqual(g.correr, { nombre: "Correr", emoji: "🏃", orden: 2, archivada: true, manana: true, fuente: "running" });
});

test("se llenan solas desde el primer día con la versión nueva (o desde que eliges la sección)", () => {
  const ini = A.inicial("2026-11-16");
  assert.deepEqual([ini.correr.desde, ini.leer.desde, ini.ejercicio.desde, "desde" in ini.manana], ["2026-11-16", "2026-11-16", "2026-11-16", false]);
  const l = A.lista({ actividades: ini });
  assert.equal(l.find(a => a.id === "correr").desde, "2026-11-16");
  const orar = { id: "a-orar", fuente: "", desde: null };
  assert.deepEqual([A.conFuente(orar, "movilidad", "2026-11-20").fuente, A.conFuente(orar, "movilidad", "2026-11-20").desde], ["movilidad", "2026-11-20"]);
  const correr = l.find(a => a.id === "correr");
  assert.equal(A.conFuente(correr, "running", "2026-12-01").desde, "2026-11-16", "la misma sección: no cambia desde");
  assert.deepEqual([A.conFuente(correr, "", "2026-12-01").fuente, A.conFuente(correr, "", "2026-12-01").desde], ["", null], "nunca");
});
