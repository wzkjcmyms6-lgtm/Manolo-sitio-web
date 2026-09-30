const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/exercise-search.js");
const E = require("../js/muscle-engine.js");
const DATA = require("../data/ejercicios.json");

const indice = S.crearIndice(DATA.ejercicios, { destacados: DATA.destacados });
const primero = q => (S.buscar(indice, q, 1)[0] || {}).ejercicio;
const nombreDe = q => (primero(q) || {}).nombre;
const resuelto = n => (S.resolver(indice, n) || {}).nombre || null;

test("normaliza tildes, mayúsculas y plurales", () => {
  assert.equal(S.clave("Extensión de Piernas"), S.clave("extension de pierna"));
  assert.equal(S.clave("FLEXIONES"), S.clave("flexión"));
  assert.deepEqual(S.tokens("Press de banca con barra"), ["press", "banca", "barra"]);
});

test("encuentra por nombre, alias en inglés y variantes", () => {
  assert.equal(nombreDe("press banca"), "Press de banca (Barra)");
  assert.equal(nombreDe("press plano"), "Press de banca (Barra)");
  assert.equal(nombreDe("bench press"), "Press de banca (Barra)");
  assert.equal(nombreDe("press plano mancuerna"), "Press de banca (Mancuerna)");
  assert.equal(nombreDe("jalon"), "Jalón al pecho (Polea)");
  assert.equal(nombreDe("curl de pierna"), "Curl femoral tumbado (Máquina)");
  assert.equal(nombreDe("elevaciones laterales"), "Elevación lateral (Mancuerna)");
  assert.equal(nombreDe("trotadora"), "Correr en cinta");
  assert.equal(nombreDe("empuje de caderas"), "Hip thrust (Barra)");
});

test("encuentra ejercicios de cuello", () => {
  assert.deepEqual(primero("cuello").primarios, ["cuello"]);
  assert.equal(nombreDe("neck curl"), "Flexión de cuello con disco");
});

test("tolera errores de tipeo", () => {
  assert.equal(nombreDe("pres banca"), "Press de banca (Barra)");
  assert.equal(nombreDe("sentadiya"), "Sentadilla (Barra)");
  assert.equal(nombreDe("hip trust"), "Hip thrust (Barra)");
  assert.equal(nombreDe("face pul"), "Face pull (Polea)");
  assert.equal(nombreDe("dominadsa"), "Dominadas");
});

test("autocompletado mientras escribes", () => {
  assert.equal(nombreDe("sentad"), "Sentadilla (Barra)");
  assert.equal(nombreDe("press incl"), "Press de banca inclinado (Barra)");
});

test("'Press inclinado con barra' → pecho superior + tríceps y deltoide anterior", () => {
  const ej = S.resolver(indice, "Press inclinado con barra");
  assert.equal(ej.nombre, "Press de banca inclinado (Barra)");
  assert.deepEqual(ej.primarios, ["pecho_superior"]);
  assert.ok(ej.secundarios.includes("triceps"));
  assert.ok(ej.secundarios.includes("deltoide_anterior"));

  const m = E.calcularMusculos([{ fecha: "2026-09-29", ejercicio: ej, series: Array(4).fill({ kg: 60, reps: 10 }) }]);
  assert.equal(m.pecho_superior.volumen, 2400);
  assert.equal(m.pecho_superior.soloSecundario, false);
  assert.equal(m.triceps.soloSecundario, true);
  assert.equal(m.deltoide_anterior.soloSecundario, true);
});

test("reconoce los nombres que sugería la versión anterior de Manolo", () => {
  const esperados = {
    "Sentadilla (Barra)": "Sentadilla (Barra)",
    "Peso Muerto Rumano (Barra)": "Peso muerto rumano (Barra)",
    "Press de Banca (Barra)": "Press de banca (Barra)",
    "Press de Banca (Mancuerna)": "Press de banca (Mancuerna)",
    "Press de Banca Inclinado (Mancuerna)": "Press de banca inclinado (Mancuerna)",
    "Press de Hombros (Mancuerna)": "Press de hombros (Mancuerna)",
    "Empuje de Caderas (Barra)": "Hip thrust (Barra)",
    "Press de Piernas": "Prensa de piernas (Máquina)",
    "Extensión de Pierna": "Extensión de piernas (Máquina)",
    "Curl de Pierna": "Curl femoral tumbado (Máquina)",
    "Jalón al Pecho (Cable)": "Jalón al pecho (Polea)",
    "Remo en Punta": "Remo en T (Barra)",
    "Remo Sentado con Agarre en V (Cable)": "Remo sentado (Polea)",
    "Curl de Bíceps (Mancuerna)": "Curl de bíceps (Mancuerna)",
    "Curl de Bíceps Inclinado (Mancuerna)": "Curl de bíceps inclinado (Mancuerna)",
    "Elevación Lateral (Mancuerna)": "Elevación lateral (Mancuerna)",
    "Press Militar (Barra)": "Press militar (Barra)",
    "Dominadas": "Dominadas",
    "Fondos": "Fondos en paralelas",
    "Plancha": "Plancha",
    "Zancadas": "Zancada (Mancuerna)",
    "Caminar": "Caminar"
  };
  Object.entries(esperados).forEach(([viejo, nuevo]) => assert.equal(resuelto(viejo), nuevo, viejo));
});

test("no adivina con nombres vagos o ambiguos", () => {
  ["Pecho", "Piernas", "Remo", "Row", "Entrenamiento", "", "xyz"].forEach(n => assert.equal(resuelto(n), null, n));
});

test("las asignaciones manuales tienen prioridad", () => {
  const asignaciones = { [S.clave("Mi remo raro")]: "manolo-remo-pendlay" };
  assert.equal(S.resolver(indice, "Mi remo raro", { asignaciones }).nombre, "Remo Pendlay (Barra)");
});

test("ejercicios propios se indexan junto a la base", () => {
  const propio = { id: "propio-1", nombre: "Remo Meadows", alias: ["meadows row"], tipo: "carga", equipo: "barra", primarios: ["dorsales"], secundarios: [], factorPesoCorporal: 0 };
  const idx = S.crearIndice(DATA.ejercicios.concat([propio]), { destacados: DATA.destacados });
  assert.equal(S.resolver(idx, "remo meadows").id, "propio-1");
  assert.equal(S.buscar(idx, "meadows", 1)[0].ejercicio.id, "propio-1");
});

test("la búsqueda es rápida (< 50 ms por consulta)", () => {
  const t = Date.now();
  ["press inclinado con barra", "sentadiya", "curl martillo", "remo", "p"].forEach(q => S.buscar(indice, q, 8));
  assert.ok((Date.now() - t) / 5 < 50);
});
