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

// ---- Fase 5: volumen, equilibrio y generador ----
const T = require("../data/ejercicios-tecnica.json");
const ME = require("../js/muscle-engine.js");
const base = DATA.ejercicios;
const destacados = new Set(base.slice(0, DATA.destacados).map(e => e.id));
const patronDe = id => (T.ej[id] || {}).pt;
const entradasDe = g => {
  const out = [];
  g.rutinas.forEach(r => r.items.forEach(it => out.push({ ejercicio: F(it.exerciseId), series: Array(it.series).fill({ kg: 10, reps: it.repsMin }) })));
  return out;
};

test("volumen objetivo según meta y nivel", () => {
  assert.deepEqual(P.volumenObjetivo("hipertrofia", "intermedio"), { min: 10, max: 20 });
  assert.deepEqual(P.volumenObjetivo("hipertrofia", "intermedio", true), { min: 6, max: 20 });
  assert.deepEqual(P.volumenObjetivo("hipertrofia", "principiante"), { min: 7, max: 15 });
  assert.deepEqual(P.volumenObjetivo("hipertrofia", "avanzado"), { min: 10, max: 22 });
  assert.deepEqual(P.volumenObjetivo("fuerza", "intermedio"), { min: 6, max: 15 });
  assert.deepEqual(P.volumenObjetivo("general"), { min: 6, max: 12 });
});

test("volumen semanal: cada ejercicio cuenta una vez por músculo; bajo, bien o alto", () => {
  const e = [
    { ejercicio: F("barbell-bench-press-medium-grip"), series: [{ kg: 60, reps: 8 }, { kg: 60, reps: 8 }, { kg: 60, reps: 8 }, { kg: 20, reps: 10, calentamiento: true }] },
    { ejercicio: F("barbell-incline-bench-press-medium-grip"), series: Array(3).fill({ kg: 50, reps: 8 }) },
    { ejercicio: F("barbell-squat"), series: Array(25).fill({ kg: 100, reps: 5 }) }
  ];
  const v = P.volumenSemanal(e, "hipertrofia", "intermedio");
  const de = id => v.find(x => x.id === id);
  assert.equal(de("pecho").series, 6); // 3 + 3, no 3 por cada zona del pecho
  assert.equal(de("pecho").estado, "bajo");
  assert.equal(de("triceps").series, 3); // ayuda: 0,5 × 6
  assert.equal(de("cuadriceps").estado, "alto");
  assert.match(P.textoVolumen(de("pecho")), /^Pecho: 6 series, te faltan 4 para 10\.$/);
  assert.match(P.textoVolumen(de("cuadriceps")), /más de 20/);
});

test("equilibrio: empuje/tirón del torso, cuádriceps/isquios y deltoides", () => {
  const press = { ejercicio: F("barbell-bench-press-medium-grip"), series: Array(9).fill({ kg: 60, reps: 8 }) };
  const remo = { ejercicio: F("bent-over-barbell-row"), series: Array(3).fill({ kg: 60, reps: 8 }) };
  const pm = { ejercicio: F("barbell-deadlift"), series: Array(9).fill({ kg: 100, reps: 5 }) };
  const sq = { ejercicio: F("barbell-squat"), series: Array(9).fill({ kg: 100, reps: 5 }) };
  const e = [press, remo, pm, sq];
  const eq = P.equilibrio(e, ME.calcularMusculos(e));
  const et = eq.find(x => x.id === "empuje_tiron");
  assert.equal(et.ok, false);
  assert.equal(et.a, 9); // el peso muerto no cuenta como tirón del torso
  assert.equal(et.b, 3);
  assert.match(et.texto, /3 series de empuje por cada una de tirón/);
  const bien = P.equilibrio([press, Object.assign({}, remo, { series: Array(8).fill({ kg: 60, reps: 8 }) })], ME.calcularMusculos([press, remo]));
  assert.equal(bien.find(x => x.id === "empuje_tiron").ok, true);
});

test("generador: de 2 a 6 días cubre y equilibra los músculos", () => {
  [2, 3, 4, 5, 6].forEach(dias => {
    const g = P.generar({ dias, minutos: 60, meta: "hipertrofia", nivel: "intermedio", equipos: EQ.disponibles(null), patronDe, destacados, base });
    assert.equal(g.rutinas.length, dias, `${dias} días`);
    g.rutinas.forEach(r => {
      assert.ok(r.items.length >= 4, `${r.nombre}: ${r.items.length} ejercicios`);
      assert.ok(r.minutos <= 60, `${r.nombre}: ${r.minutos} min`);
      assert.equal(new Set(r.items.map(i => i.exerciseId)).size, r.items.length, `${r.nombre} sin repetidos`);
    });
    const e = entradasDe(g);
    const v = P.volumenSemanal(e, "hipertrofia", "intermedio");
    ["pecho", "espalda", "cuadriceps", "isquiotibiales", "gluteos", "biceps", "triceps", "deltoide_lateral"].forEach(m =>
      assert.ok(v.find(x => x.id === m).series >= (dias >= 3 ? 4 : 3), `${dias} días, ${m}: ${v.find(x => x.id === m).series}`));
    if (dias >= 3) ["pecho", "espalda", "cuadriceps", "isquiotibiales"].forEach(m => assert.ok(v.find(x => x.id === m).series >= 10, `${dias} días, ${m} ≥ 10`));
    const eq = P.equilibrio(e, ME.calcularMusculos(e));
    ["empuje_tiron", "cuad_isquios"].forEach(id => assert.ok(eq.find(x => x.id === id).ok, `${dias} días: ${id} ${eq.find(x => x.id === id).ratio}`));
  });
  const g4 = P.generar({ dias: 4, minutos: 60, meta: "hipertrofia", nivel: "intermedio", equipos: EQ.disponibles(null), patronDe, destacados, base });
  assert.deepEqual(g4.rutinas.map(r => r.nombre), ["Torso A", "Pierna A", "Torso B", "Pierna B"]);
  assert.deepEqual(g4.rutinas.map(r => r.dia), ["1", "2", "4", "5"]);
  assert.equal(g4.rutinas[0].items[0].nombre, "Press de banca (Barra)");
});

test("generador: meta, nivel, minutos y equipo de casa", () => {
  const fuerza = P.generar({ dias: 3, minutos: 60, meta: "fuerza", nivel: "intermedio", equipos: EQ.disponibles(null), patronDe, destacados, base });
  const primero = fuerza.rutinas[0].items[0];
  assert.deepEqual([primero.series, primero.repsMin, primero.repsMax, primero.descansoSeg], [4, 3, 5, 180]);
  const princ = P.generar({ dias: 3, minutos: 60, meta: "hipertrofia", nivel: "principiante", equipos: EQ.disponibles(null), patronDe, destacados, base });
  assert.ok(princ.rutinas.every(r => r.items.every(i => i.series <= 2 || i.series === 3)), "principiante: menos series");
  assert.ok(princ.rutinas.every(r => r.items.every(i => !F(i.exerciseId).niv || F(i.exerciseId).niv <= 1)), "principiante: ejercicios de su nivel");
  const corto = P.generar({ dias: 3, minutos: 30, meta: "hipertrofia", nivel: "intermedio", equipos: EQ.disponibles(null), patronDe, destacados, base });
  assert.ok(corto.rutinas.every(r => r.items.length >= 3 && r.items.length < 6), "30 min: menos ejercicios");
  const casa = EQ.normalizar(EQ.CASA);
  const g = P.generar({ dias: 3, minutos: 45, meta: "general", nivel: "principiante", equipos: EQ.disponibles(casa), dominadas: casa.dominadas, patronDe, destacados, base });
  const usados = g.rutinas.flatMap(r => r.items.map(i => F(i.exerciseId)));
  assert.ok(usados.every(f => EQ.disponibles(casa).has(f.equipo)), "solo el equipo de casa");
  assert.ok(!usados.some(f => /Dominadas|Fondos/.test(f.nombre)), "sin barra de dominadas");
});

test("generador: nombres sin chocar, días libres del plan y cambiar ejercicio", () => {
  assert.equal(P.nombreLibre("Torso A", ["Empuje"]), "Torso A");
  assert.equal(P.nombreLibre("Torso A", ["torso a", "Torso A (nueva)"]), "Torso A (nueva 2)");
  const plan = { dias: { "1": "empuje", "2": "tiron", "4": "pierna", "6": "empuje", "3": null } };
  assert.deepEqual(P.diasLibres(plan), ["3", "5", "0"]);
  // Lunes ocupado → el libre siguiente (miércoles); martes ocupado → viernes; jueves → domingo; viernes ya no queda.
  assert.deepEqual(P.asignarDias([{ dia: "1" }, { dia: "2" }, { dia: "4" }, { dia: "5" }], plan), ["3", "5", "0", null]);
  assert.deepEqual(P.asignarDias([{ dia: "1" }, { dia: "3" }], { dias: {} }), ["1", "3"]);
  const o = { nivel: "intermedio", equipos: EQ.disponibles(null), patronDe, destacados, base };
  const alt = P.alternativasHueco("HPUSH", o);
  assert.equal(alt[0].nombre, "Press de banca (Barra)");
  assert.ok(alt.length > 5 && alt.every(f => patronDe(f.id) === "empuje_horizontal"));
  const g = P.generar(Object.assign({ dias: 3, minutos: 60, meta: "hipertrofia" }, o));
  assert.ok(g.rutinas.every(r => r.items.every(i => P.HUECOS[i.hueco])), "cada ejercicio sabe su hueco");
  const R = require("../js/rutinas.js");
  assert.equal("hueco" in R.aGuardar({ name: "x", items: g.rutinas[0].items }).items[0], false, "el hueco no se guarda");
});

test("bloque de 4–6 semanas: la última es de descarga", () => {
  // Miércoles 4 nov 2026: empieza el lunes 2.
  assert.deepEqual(P.nuevoBloque("2026-11-04", 5), { desde: "2026-11-02", semanas: 5, descarga: { desde: "2026-11-30", hasta: "2026-12-06" } });
  // Jueves 5 nov: empieza el lunes siguiente.
  assert.equal(P.nuevoBloque("2026-11-05", 4).desde, "2026-11-09");
  assert.equal(P.nuevoBloque("2026-11-05", 9).semanas, 6);
  const b = P.nuevoBloque("2026-11-04", 5);
  assert.equal(P.semanaDeBloque(b, "2026-11-01"), null);
  assert.equal(P.semanaDeBloque(b, "2026-11-04"), 1);
  assert.equal(P.semanaDeBloque(b, "2026-11-30"), 5);
  assert.equal(P.semanaDeBloque(b, "2026-12-07"), null);
  // La descarga agendada del bloque no se ve como activa antes de tiempo.
  assert.equal(P.descargaActiva({ [b.descarga.desde]: b.descarga.hasta }, "2026-11-20"), null);
  assert.deepEqual(P.descargaActiva({ [b.descarga.desde]: b.descarga.hasta }, "2026-12-01"), b.descarga);
});

test("volumen con plan: lo hecho + lo que queda del plan de la semana", () => {
  const press = n => ({ ejercicio: F("barbell-bench-press-medium-grip"), series: Array(n).fill({ kg: 60, reps: 8 }) });
  const v = P.volumenConPlan([press(4)], [press(4), press(3)], "hipertrofia", "intermedio");
  const pecho = v.find(x => x.id === "pecho");
  assert.deepEqual([pecho.series, pecho.plan, pecho.total, pecho.estado], [4, 7, 11, "ok"]);
  assert.match(P.textoVolumen(pecho), /^Pecho: 11 series, dentro de tu objetivo\.$/);
  const sinPlan = P.volumenConPlan([press(4)], [], "hipertrofia", "intermedio").find(x => x.id === "pecho");
  assert.deepEqual([sinPlan.plan, sinPlan.total, sinPlan.estado], [0, 4, "bajo"]);
});
