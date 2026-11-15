// Biblia: marcar lo leído en papel, sin abrir el lector (js/biblia-marcar.js, D-122).
const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("../js/biblia-marcar.js");

const HOY = "2026-11-15";

test("qué capítulo sigue (también de un libro al otro y al final de la Biblia)", () => {
  assert.equal(K.siguienteDe("Gen.1"), "Gen.2");
  assert.equal(K.siguienteDe("Gen.50"), "Exod.1");
  assert.equal(K.siguienteDe("Rev.22"), "Gen.1", "después de Apocalipsis vuelve a Génesis");
  assert.equal(K.siguienteDe("nada"), "Gen.1");
});

test("sugerir: después del último que marcaste, saltando lo ya leído", () => {
  const leidos = { "2026-11-13": ["Gen.1", "Gen.2"], "2026-11-14": ["Gen.3"] };
  assert.deepEqual(K.sugerir(leidos), { tipo: "uno", clave: "Gen.4" });
  // Marcaste Génesis 5 antes: lo salta.
  assert.deepEqual(K.sugerir({ "2026-11-01": ["Gen.5"], "2026-11-14": ["Gen.4"] }), { tipo: "uno", clave: "Gen.6" });
  assert.deepEqual(K.sugerir({ "2026-11-01": ["Gen.5"], "2026-11-14": ["Gen.3"] }), { tipo: "uno", clave: "Gen.4" });
  // Sin nada marcado: donde quedaste en el lector, o Génesis 1.
  assert.deepEqual(K.sugerir({}, { lector: { libro: "John", cap: 3 } }), { tipo: "uno", clave: "John.3" });
  assert.deepEqual(K.sugerir({}), { tipo: "uno", clave: "Gen.1" });
  assert.deepEqual(K.sugerir(null), { tipo: "uno", clave: "Gen.1" });
});

test("sugerir: con un plan, todo lo de hoy de un toque", () => {
  assert.deepEqual(K.sugerir({ "2026-11-14": ["Gen.3"] }, { plan: ["Matt.2", "Matt.3", "basura"] }), { tipo: "plan", claves: ["Matt.2", "Matt.3"] });
  assert.deepEqual(K.sugerir({ "2026-11-14": ["Gen.3"] }, { plan: [] }), { tipo: "uno", clave: "Gen.4" });
});

test("estado de un capítulo: leído hoy, antes o nunca", () => {
  const leidos = { "2026-11-01": ["Ps.23"], [HOY]: ["Ps.24"], "2026-11-10": ["Ps.23"] };
  assert.deepEqual(K.estado(leidos, "Ps.23", HOY), { leido: true, hoy: false, fecha: "2026-11-10" });
  assert.deepEqual(K.estado(leidos, "Ps.24", HOY), { leido: true, hoy: true, fecha: HOY });
  assert.deepEqual(K.estado(leidos, "Ps.1", HOY), { leido: false, hoy: false, fecha: null });
});

test("hoy, recientes y por libro", () => {
  const leidos = { "2026-11-10": ["Rom.8", "Ps.1"], "2026-11-14": ["Matt.5"], [HOY]: ["Gen.3", "Gen.1", "Gen.2", "Gen.1", "mal.1"] };
  assert.deepEqual(K.deHoy(leidos, HOY), ["Gen.1", "Gen.2", "Gen.3"], "en orden y sin repetir");
  assert.deepEqual(K.recientes(leidos, 3), ["Gen", "Matt", "Ps"]);
  assert.deepEqual(K.delLibro(leidos, "Gen"), { leidos: 3, total: 50 });
  assert.equal(K.texto(["Gen.1", "Gen.2", "Gen.3", "Exod.2"]), "Génesis 1–3, Éxodo 2");
  assert.equal(K.nombre("John.3"), "Juan 3");
  assert.equal(K.ultimo(leidos), "Gen.1", "el último de la lista del día más reciente");
});
