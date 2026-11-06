// Reconocimiento de nombres de ejercicios (D-101): los 331 nombres reales de
// tests/nombres-ejercicios.js (gimnasio en español, Strong/Hevy en inglés,
// abreviaturas y errores de tipeo) tienen que llegar a su ejercicio, y los
// nombres vagos no se adivinan.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/exercise-search.js");
const ALIAS = require("../js/ejercicios-alias.js");
const DATA = require("../data/ejercicios.json");
const CASOS = require("./nombres-ejercicios.js");

const indice = S.crearIndice(DATA.ejercicios, { destacados: DATA.destacados });
const ids = new Set(DATA.ejercicios.map(e => e.id));
const nombre = n => (S.resolver(indice, n) || {}).nombre || null;

test("los casos y los alias extra apuntan a ejercicios que existen", () => {
  const faltan = [];
  CASOS.forEach(([t, esp]) => [].concat(esp).forEach(id => { if (!ids.has(id)) faltan.push(`${t} → ${id}`); }));
  Object.keys(ALIAS).forEach(id => { if (!ids.has(id)) faltan.push(`alias de ${id}`); });
  assert.deepEqual(faltan, []);
  assert.ok(CASOS.length >= 300, `hay ${CASOS.length} casos`);
});

test("reconoce los nombres reales (sin equivocarse)", () => {
  const mal = [], nada = [];
  CASOS.forEach(([t, esp]) => {
    const ok = [].concat(esp);
    const r = S.resolver(indice, t);
    if (!r) nada.push(t);
    else if (!ok.includes(r.id)) mal.push(`${t} → ${r.id} (esperado ${ok.join(" | ")})`);
  });
  assert.deepEqual(mal, [], "ninguno reconocido como otro ejercicio");
  assert.deepEqual(nada, [], "todos reconocidos");
});

test("al buscar, el ejercicio correcto sale entre los 3 primeros", () => {
  const lejos = CASOS.filter(([t, esp]) => !S.buscar(indice, t, 3).some(x => [].concat(esp).includes(x.ejercicio.id))).map(c => c[0]);
  assert.deepEqual(lejos, []);
});

test("no adivina con nombres vagos, sin sentido o de una palabra general", () => {
  ["Remo", "Row", "Press", "Pecho", "Piernas", "Espalda", "Hombros", "Brazos", "Barra", "Máquina", "Mancuerna",
    "Polea", "Entrenamiento", "Fuerza", "Cardio", "Ejercicio 1", "Ejercicio de Juan", "Máquina nueva del gym",
    "Abs", "", "   ", "xyz", "asdfgh", "123"].forEach(n => assert.equal(nombre(n), null, n));
});

test("respeta el equipo que se dice", () => {
  assert.equal(nombre("press banca mancuernas"), "Press de banca (Mancuerna)");
  assert.equal(nombre("Bench Press (Dumbbell)"), "Press de banca (Mancuerna)");
  assert.equal(nombre("Bench Press (Barbell)"), "Press de banca (Barra)");
  // "Remo con barra" nunca da uno con mancuerna o máquina.
  const r = S.resolver(indice, "remo con barra");
  assert.ok(r && r.equipo === "barra", r && r.id);
  // "Barra" a secas es la recta, no la EZ ni la hexagonal.
  assert.equal(nombre("Deadlift (Barbell)"), "Peso muerto (Barra)");
});

test("entiende errores de tipeo y ortografía", () => {
  assert.equal(nombre("sentadiya"), "Sentadilla (Barra)");
  assert.equal(nombre("press vanca"), "Press de banca (Barra)");
  assert.equal(nombre("dominadass"), "Dominadas");
  assert.equal(nombre("elevasiones laterales"), "Elevación lateral (Mancuerna)");
});

test("las asignaciones del dueño mandan y la clave guardada no cambió", () => {
  // La clave es la de siempre: así siguen valiendo las asignaciones guardadas.
  assert.equal(S.clave("Press de Banca (Barra)"), "press banca barra");
  assert.equal(S.clave("Extensiones de piernas"), "extension pierna");
  assert.equal(S.clave("Curl martillo raro"), "curl martillo raro");
  const a = { [S.clave("Remo")]: "seated-cable-rows" };
  assert.equal(S.resolver(indice, "Remo", { asignaciones: a }).id, "seated-cable-rows");
  assert.equal(S.resolver(indice, "  REMO ", { asignaciones: a }).id, "seated-cable-rows");
});

test("reconoce los ejercicios propios por su nombre", () => {
  const propio = { id: "propio-x", nombre: "Remo Manolo en banco", alias: [], equipo: "mancuerna", primarios: ["dorsales"], secundarios: [] };
  const ind = S.crearIndice(DATA.ejercicios.concat([propio]), { destacados: DATA.destacados });
  assert.equal(S.resolver(ind, "remo manolo en banco").id, "propio-x");
  assert.equal(S.buscar(ind, "remo manolo", 1)[0].ejercicio.id, "propio-x");
});

test("sugiere para «¿Es…?» solo cuando hay algo probable", () => {
  const s = S.sugerir(indice, "Remo", 2);
  assert.equal(s.length, 2);
  assert.ok(s[0].probable && /^Remo/.test(s[0].ejercicio.nombre), s[0].ejercicio.nombre);
  assert.equal(S.sugerir(indice, "Curl martillo raro", 1)[0].ejercicio.nombre, "Curl martillo (Mancuerna)");
  assert.deepEqual(S.sugerir(indice, "Ejercicio de Juan", 2).filter(x => x.probable), []);
  assert.deepEqual(S.sugerir(indice, "", 2), []);
});

test("mientras escribes, lo que buscas sale primero", () => {
  const primero = q => S.buscar(indice, q, 1)[0].ejercicio.nombre;
  assert.equal(primero("sent"), "Sentadilla (Barra)");
  assert.equal(primero("jal"), "Jalón al pecho (Polea)");
  assert.equal(primero("hip th"), "Hip thrust (Barra)");
  assert.equal(primero("press banca manc"), "Press de banca (Mancuerna)");
  assert.equal(primero("remo maq"), "Remo unilateral (Máquina)");
  assert.equal(primero("femoral"), "Curl femoral tumbado (Máquina)");
  assert.equal(primero("peso muerto ru"), "Peso muerto rumano (Barra)");
  assert.ok(S.buscar(indice, "remo pol", 3).some(x => x.ejercicio.nombre === "Remo sentado (Polea)"));
});

test("es rápido (los 331 nombres en menos de 1,5 s)", () => {
  const ind = S.crearIndice(DATA.ejercicios, { destacados: DATA.destacados });
  const t = Date.now();
  CASOS.forEach(([n]) => S.resolver(ind, n));
  const ms = Date.now() - t;
  assert.ok(ms < 1500, `${ms} ms`);
});
