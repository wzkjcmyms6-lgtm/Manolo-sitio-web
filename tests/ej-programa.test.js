// Programación (js/ej-programa.js): estancamiento y descarga; y la
// progresión v2 (js/progresion.js) con RIR, microcargas, tendencia y descarga.
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/ej-programa.js");
const PR = require("../js/progresion.js");
const H = require("../js/ej-historial.js");
const EQ = require("../js/ej-equipo.js");
const SEM = require("../scripts/e2e/ejercicio-semilla.js");
const DATA = require("../data/ejercicios.json");
const F = id => DATA.ejercicios.find(e => e.id === id);

const ses = (fecha, e1rm) => ({ fecha, e1rm });

test("estancamiento: 3 sesiones sin mejorar, o 4 semanas con 2+", () => {
  // Sube siempre: no.
  assert.equal(P.estancamiento([ses("2026-10-01", 100), ses("2026-10-08", 102), ses("2026-10-15", 104), ses("2026-10-22", 106)], "2026-10-25"), null);
  // Mejor el 1 oct y 3 sesiones después sin pasarlo.
  const e = P.estancamiento([ses("2026-09-24", 98), ses("2026-10-01", 105), ses("2026-10-08", 104), ses("2026-10-15", 105.2), ses("2026-10-22", 103)], "2026-10-25");
  assert.deepEqual(e, { sesiones: 3, semanas: 3, mejor: 105, fecha: "2026-10-01" });
  // Mejorar menos de 0,5 % no cuenta como mejora (105 → 105,2).
  // 4 semanas con 2 sesiones desde el mejor.
  assert.deepEqual(P.estancamiento([ses("2026-09-01", 90), ses("2026-09-10", 95), ses("2026-09-24", 100), ses("2026-10-10", 99), ses("2026-10-20", 98)], "2026-10-25"),
    { sesiones: 2, semanas: 4, mejor: 100, fecha: "2026-09-24" });
  // Con menos de 4 sesiones no se juzga.
  assert.equal(P.estancamiento([ses("2026-09-01", 100), ses("2026-10-01", 90), ses("2026-10-10", 90)], "2026-11-01"), null);
  assert.match(P.textoEstancamiento(e), /Sin mejorar en 3 sesiones \(tu mejor 1RM estimado: 105 kg\)/);
  const sug = P.sugerenciasEstancamiento({ repsMin: 6, repsMax: 8 }, "Press de banca (Mancuerna)");
  assert.equal(sug[0], "Cambia el rango de reps a 10–12 unas semanas.");
  assert.equal(sug[1], "Prueba una variante: Press de banca (Mancuerna).");
  assert.match(sug[2], /descarga/);
  assert.match(P.sugerenciasEstancamiento({ repsMin: 10, repsMax: 12 })[0], /6–8/);
});

test("estancamiento con los entrenos de prueba: la banca sí, la sentadilla no", () => {
  const L = Object.values(SEM.estado("2026-11-05").__SEED__["users/test/entrenamientos"]);
  const banca = P.estancamiento(H.sesiones(L, ex => ex.exerciseId === "barbell-bench-press-medium-grip"), "2026-11-05");
  assert.ok(banca && banca.sesiones >= 3 && banca.semanas >= 4, JSON.stringify(banca));
  assert.equal(P.estancamiento(H.sesiones(L, ex => ex.exerciseId === "barbell-squat"), "2026-11-05"), null);
});

test("descarga: señales y sugerencia con 2 o más", () => {
  const id = ex => ex.exerciseId;
  const normal = P.senalesDescarga(Object.values(SEM.estado("2026-11-05").__SEED__["users/test/entrenamientos"]), id, { hoy: "2026-11-05" });
  assert.equal(normal.sugerir, false);
  assert.deepEqual(normal.senales.map(s => s.id), ["semanas"]);
  const cansado = P.senalesDescarga(Object.values(SEM.estado("2026-11-05", { cansado: true }).__SEED__["users/test/entrenamientos"]), id,
    { hoy: "2026-11-05", nombreDe: x => F(x).nombre });
  assert.equal(cansado.sugerir, true);
  assert.deepEqual(cansado.senales.map(s => s.id), ["rendimiento", "esfuerzo", "semanas"]);
  assert.match(cansado.senales[0].texto, /^Tu fuerza bajó en Press de banca \(Barra\) y /);
  assert.match(cansado.senales[1].texto, /RPE 7,\d → 9,\d/);
  // Con una descarga reciente no se vuelve a sugerir; las semanas se cuentan desde ahí.
  const conDescarga = P.senalesDescarga(Object.values(SEM.estado("2026-11-05", { cansado: true }).__SEED__["users/test/entrenamientos"]), id,
    { hoy: "2026-11-05", descargas: { "2026-10-12": "2026-10-18" } });
  assert.equal(conDescarga.sugerir, false);
  assert.ok(conDescarga.semanas <= 3, String(conDescarga.semanas));
});

test("descarga: activa, última y nueva (7 días desde hoy)", () => {
  assert.deepEqual(P.nuevaDescarga("2026-11-05"), { desde: "2026-11-05", hasta: "2026-11-11" });
  const d = { "2026-09-01": "2026-09-07", "2026-11-03": "2026-11-09" };
  assert.deepEqual(P.descargaActiva(d, "2026-11-05"), { desde: "2026-11-03", hasta: "2026-11-09" });
  assert.equal(P.descargaActiva(d, "2026-11-10"), null);
  assert.deepEqual(P.ultimaDescarga(d, "2026-10-01"), { desde: "2026-09-01", hasta: "2026-09-07" });
  assert.equal(P.lunes("2026-11-05"), "2026-11-02");
});

// ---- Progresión v2 ----
const item = { nombre: "Press", series: 3, repsMin: 8, repsMax: 12, incremento: null };
const w = (date, sets) => ({ date, exercises: [{ name: "Press", sets }] });
const mismo = e => e.name === "Press";
const s = (kg, reps, extra) => Object.assign({ kg, reps }, extra);

test("progresión v2: microcargas y redondeo a tu equipo", () => {
  const perfil = EQ.normalizar(null);
  const f = F("dumbbell-bench-press");
  const op = { ficha: f, micro: EQ.microcarga(f, perfil), redondear: (kg, h) => EQ.redondear(kg, f, perfil, h) };
  const h = [w("2026-10-01", [s(24, 12), s(24, 12), s(24, 12)])];
  const r = PR.sugerir(item, h, mismo, op);
  assert.equal(r.tipo, "subir");
  assert.equal(r.kg, 26); // mancuernas de 2 en 2 (sin el perfil sería 26,5)
  assert.equal(PR.sugerir(item, h, mismo, { ficha: f }).kg, 26.5);
  // Máquina de 5 en 5.
  const m = F("leverage-chest-press");
  const rm = PR.sugerir(item, [w("2026-10-01", [s(40, 12), s(40, 12), s(40, 12)])], mismo, { ficha: m, micro: 5, redondear: (kg, hh) => EQ.redondear(kg, m, perfil, hh) });
  assert.equal(rm.kg, 45);
});

test("progresión v2: el RIR cambia la subida y las reps", () => {
  const sobran = [w("2026-10-01", [s(60, 12, { rir: 3 }), s(60, 12, { rir: 4 }), s(60, 12, { rir: 3 })])];
  const r = PR.sugerir(item, sobran, mismo, { inferior: false });
  assert.equal(r.kg, 65); // doble subida: te sobraban reps
  assert.equal(r.nota, "te sobraban reps");
  const justo = [w("2026-10-01", [s(60, 12, { rir: 0 }), s(60, 12, { rir: 1 }), s(60, 12, { rir: 0 })])];
  assert.equal(PR.sugerir(item, justo, mismo, { inferior: false }).kg, 62.5);
  const rep = PR.sugerir(item, [w("2026-10-01", [s(60, 9, { rir: 2 }), s(60, 9, { rir: 3 }), s(60, 8, { rir: 2 })])], mismo, {});
  assert.equal(rep.tipo, "repetir");
  assert.deepEqual(rep.reps, [11, 11, 10]); // +2 reps
  assert.equal(PR.rirMedio([s(1, 1), s(1, 1, { rir: 2 }), s(1, 1)]), null); // pocas con RIR
});

test("progresión v2: tendencia del 1RM y semana de descarga", () => {
  const h = [w("2026-10-22", [s(70, 8)]), w("2026-10-15", [s(67.5, 8)]), w("2026-10-08", [s(65, 8)]), w("2026-10-01", [s(62.5, 8)])];
  const t = PR.sugerir(item, h, mismo, {}).tendencia;
  assert.equal(t.e1rm.length, 4);
  assert.equal(t.porSemana, 3.2); // +2,5 kg por semana × 1,267
  const d = PR.sugerir(item, [w("2026-10-01", [s(100, 10), s(100, 10), s(100, 10)])], mismo, { descarga: true, redondear: (kg, hh) => EQ.redondear(kg, F("barbell-bench-press-medium-grip"), EQ.normalizar(null), hh) });
  assert.equal(d.tipo, "descarga");
  assert.equal(d.kg, 90);
  assert.deepEqual(d.reps, [8, 8]); // 3 series → 2
});
