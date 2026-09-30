const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/muscle-engine.js");
const DATA = require("../data/ejercicios.json");
const { EQUIPOS } = require("../js/exercise-search.js");

const ej = DATA.ejercicios;
const porNombre = n => ej.find(e => e.nombre === n);

test("al menos 300 ejercicios, con fuente y licencia anotadas", () => {
  assert.ok(ej.length >= 300, `hay ${ej.length}`);
  assert.match(DATA.fuente, /free-exercise-db/);
  assert.match(DATA.fuente, /Unlicense/);
});

test("cada ficha tiene todos los campos y valores válidos", () => {
  const ids = new Set(), nombres = new Set();
  ej.forEach(e => {
    assert.ok(e.id && !ids.has(e.id), "id único: " + e.id);
    assert.ok(e.nombre && !nombres.has(e.nombre.toLowerCase()), "nombre único: " + e.nombre);
    ids.add(e.id);
    nombres.add(e.nombre.toLowerCase());
    assert.ok(Array.isArray(e.alias), e.nombre);
    assert.ok(E.TIPOS.includes(e.tipo), e.nombre + " tipo " + e.tipo);
    assert.ok(EQUIPOS[e.equipo], e.nombre + " equipo " + e.equipo);
    // Movilidad y estiramientos: solo secundarios (el mapa los pinta suave).
    assert.ok(e.primarios.length > 0 || (e.movilidad && e.secundarios.length > 0), e.nombre + " sin primarios");
    [...e.primarios, ...e.secundarios].forEach(m => assert.ok(E.MUSCULO_POR_ID[m], e.nombre + " músculo " + m));
    assert.ok(!e.secundarios.some(m => e.primarios.includes(m)), e.nombre + " músculo repetido");
    assert.equal(typeof e.factorPesoCorporal, "number");
    if (e.tipo === "peso_corporal") assert.ok(e.factorPesoCorporal > 0 && e.factorPesoCorporal <= 1, e.nombre);
  });
});

test("cubre pesas, máquinas, poleas, calistenia, cardio e isométricos", () => {
  const cuenta = f => ej.filter(f).length;
  assert.ok(cuenta(e => e.equipo === "barra") >= 40);
  assert.ok(cuenta(e => e.equipo === "mancuerna") >= 40);
  assert.ok(cuenta(e => e.equipo === "maquina" || e.equipo === "smith") >= 20);
  assert.ok(cuenta(e => e.equipo === "polea") >= 30);
  assert.ok(cuenta(e => e.tipo === "peso_corporal") >= 40);
  assert.ok(cuenta(e => e.tipo === "cardio") >= 10);
  assert.ok(cuenta(e => e.tipo === "isometrico") >= 4);
});

test("las 22 regiones (cuello incluido) aparecen como primario en algún ejercicio", () => {
  const usados = new Set(ej.flatMap(e => e.primarios));
  E.MUSCULOS.forEach(m => assert.ok(usados.has(m.id), m.id));
});

test("refinamientos: pecho superior/inferior, cabezas del deltoide, oblicuos", () => {
  assert.deepEqual(porNombre("Press de banca inclinado (Barra)").primarios, ["pecho_superior"]);
  assert.deepEqual(porNombre("Press de banca (Barra)").primarios, ["pecho_medio"]);
  assert.deepEqual(porNombre("Press de banca declinado (Barra)").primarios, ["pecho_inferior"]);
  assert.deepEqual(porNombre("Fondos para pecho").primarios, ["pecho_inferior"]);
  assert.ok(porNombre("Fondos en paralelas").secundarios.includes("pecho_inferior"));
  assert.deepEqual(porNombre("Elevación lateral (Mancuerna)").primarios, ["deltoide_lateral"]);
  assert.deepEqual(porNombre("Face pull (Polea)").primarios, ["deltoide_posterior"]);
  assert.deepEqual(porNombre("Pájaros (Mancuerna)").primarios, ["deltoide_posterior"]);
  assert.deepEqual(porNombre("Remo al mentón (Barra)").primarios, ["deltoide_lateral"]);
  assert.deepEqual(porNombre("Press militar (Barra)").primarios, ["deltoide_anterior"]);
  assert.ok(porNombre("Press militar (Barra)").secundarios.includes("deltoide_lateral"));
  assert.ok(porNombre("Remo inclinado (Barra)").secundarios.includes("deltoide_posterior"));
  assert.deepEqual(porNombre("Giro ruso").primarios, ["oblicuos"]);
  assert.deepEqual(porNombre("Crunch").primarios, ["abdominales"]);
});

test("ejercicios de cuello", () => {
  assert.deepEqual(porNombre("Flexión de cuello con disco").primarios, ["cuello"]);
  assert.equal(porNombre("Cuello isométrico lateral").tipo, "isometrico");
  assert.ok(ej.filter(e => e.primarios.includes("cuello")).length >= 7);
});

test("tipos y factor de peso corporal", () => {
  assert.equal(porNombre("Flexiones").tipo, "peso_corporal");
  assert.equal(porNombre("Flexiones").factorPesoCorporal, 0.64);
  assert.equal(porNombre("Dominadas").factorPesoCorporal, 1);
  assert.equal(porNombre("Plancha").tipo, "isometrico");
  assert.equal(porNombre("Correr").tipo, "cardio");
  assert.equal(porNombre("Bicicleta").tipo, "cardio");
  assert.equal(porNombre("Press de banca (Barra)").tipo, "carga");
});

test("Running y Bicicleta de Manolo tienen su ficha", () => {
  assert.equal(ej.find(e => e.id === E.ID_CORRER).nombre, "Correr");
  assert.equal(ej.find(e => e.id === E.ID_BICICLETA).nombre, "Bicicleta");
});
