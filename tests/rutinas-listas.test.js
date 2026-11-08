const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const M = require("../js/rutinas-listas-motor.js");
const ME = require("../js/muscle-engine.js");

const RAIZ = path.join(__dirname, "..");
const leer = ruta => JSON.parse(fs.readFileSync(path.join(RAIZ, ruta.split("?")[0]), "utf8"));
const R = M.normalizar(leer(M.ARCHIVOS[0]));

test("cada archivo de rutina se lee y tiene ids únicos y músculos conocidos", () => {
  const ids = new Set();
  M.ARCHIVOS.forEach(a => {
    assert.match(a, /^data\/rutinas\/[\w-]+\.json\?v=\d+$/, "ruta con versión (para el teléfono sin internet)");
    const r = M.normalizar(leer(a));
    assert.ok(r, a);
    assert.ok(!ids.has(r.id), "id de rutina único");
    ids.add(r.id);
    r.dias.forEach(d => d.ejercicios.forEach(e => {
      assert.ok(!ids.has(e.id), `id de ejercicio único: ${e.id}`);
      ids.add(e.id);
      assert.deepEqual(e.desconocidos, [], `${e.nombre}: todos sus músculos se entienden`);
      assert.ok(e.primarios.length, `${e.nombre}: tiene músculo principal`);
    }));
  });
});

test("la rutina en casa: 3 días, sus ejercicios, progresión y consejos", () => {
  assert.equal(R.id, "casa-gluteo-full-body");
  assert.equal(R.nombre, "Rutina en casa — Glúteo & Full Body");
  assert.deepEqual(R.dias.map(d => [d.id, d.dow, d.ejercicios.length]), [["A", 1, 5], ["B", 3, 7], ["C", 5, 6]]);
  assert.equal(R.progresion.length, 4);
  assert.equal(R.consejos.length, 6);
  assert.match(R.dias[0].calentamiento, /^4 min: 15 puentes/);
});

test("músculos: el primero es el principal, Cardio cuenta por minutos", () => {
  const ej = id => R.dias.flatMap(d => d.ejercicios).find(e => e.id === id);
  assert.deepEqual([ej("casa-bulgara-silla").primarios, ej("casa-bulgara-silla").secundarios], [["gluteos"], ["cuadriceps"]]);
  assert.deepEqual([ej("casa-flexiones").primarios, ej("casa-flexiones").secundarios], [["pecho_medio"], ["triceps", "deltoide_anterior", "deltoide_lateral"]]);
  assert.deepEqual(ej("casa-patada-fire-hydrant").primarios, ["abductores"], "glúteo medio = abductores de cadera");
  assert.deepEqual([ej("casa-y-t-w").primarios, ej("casa-y-t-w").secundarios], [["espalda_media", "trapecio"], ["deltoide_posterior"]], "«mapa» manda");
  assert.equal(ej("casa-tabata-jj-mc").tipo, "cardio");
  assert.deepEqual(ej("casa-tabata-jj-mc").primarios, ["abdominales"]);
  assert.equal(ej("casa-plancha-frontal").tipo, "isometrico");
  assert.equal(ej("casa-sentadilla-sumo-pausa").tipo, "peso_corporal");
  assert.deepEqual(M.musculosDe({ musculos: ["Pecho", "Nalgas"] }).desconocidos, ["Nalgas"]);
});

test("leer repeticiones y tiempos", () => {
  assert.deepEqual(M.leerReps("10-12 por pierna"), { reps: 10 });
  assert.deepEqual(M.leerReps("15 + 2 s de pausa arriba"), { reps: 15 });
  assert.deepEqual(M.leerReps("8 de cada letra"), { reps: 8 });
  assert.deepEqual(M.leerReps("40 s"), { seg: 40, segSerie: 40 });
  assert.deepEqual(M.leerReps("30 s por lado"), { seg: 30, segSerie: 30 });
  assert.deepEqual(M.leerReps("20 s trabajo / 10 s descanso"), { seg: 20, segSerie: 30 });
  assert.deepEqual(M.leerReps("30 s rápido / 30 s descanso"), { seg: 30, segSerie: 60 });
  assert.deepEqual(M.leerReps(""), {});
});

test("día de hoy: lunes A, miércoles B, viernes C; si no, el próximo", () => {
  const d = f => { const x = M.diaDeHoy(R, f); return [x.dia.id, x.hoy, x.enDias]; };
  assert.deepEqual(d("2026-11-09"), ["A", true, 0]);  // lunes
  assert.deepEqual(d("2026-11-11"), ["B", true, 0]);  // miércoles
  assert.deepEqual(d("2026-11-13"), ["C", true, 0]);  // viernes
  assert.deepEqual(d("2026-11-10"), ["B", false, 1]); // martes → mañana B
  assert.deepEqual(d("2026-11-08"), ["A", false, 1]); // domingo → mañana A
  assert.deepEqual(d("2026-11-14"), ["A", false, 2]); // sábado → el lunes A
});

test("entreno a guardar: solo lo marcado, con el formato de siempre", () => {
  const A = R.dias[0], B = R.dias[1];
  assert.equal(M.entreno(R, A, {}, { fecha: "2026-11-09", inicio: 1, fin: 2 }), null, "sin series marcadas no se guarda");
  const marcas = { "casa-bulgara-silla": [true, true, true], "casa-step-up": [true, false, false], "casa-plancha-frontal": [true, true] };
  const ini = Date.parse("2026-11-09T18:00:00-04:00");
  const w = M.entreno(R, A, marcas, { fecha: "2026-11-09", inicio: ini, fin: ini + 27 * 60000 });
  assert.equal(w.date, "2026-11-09");
  assert.equal(w.name, "Rutina en casa · Día A: Glúteo y piernas (fuerza)");
  assert.equal(w.durationMin, 27);
  assert.equal(w.startedAt, ini);
  assert.deepEqual(w.plantilla, { id: "casa-gluteo-full-body", dia: "A", v: 1 });
  assert.deepEqual(w.exercises, [
    { name: "Sentadilla búlgara (pie de atrás en la silla)", exerciseId: "casa-bulgara-silla", sets: [{ kg: 0, reps: 10 }, { kg: 0, reps: 10 }, { kg: 0, reps: 10 }] },
    { name: "Step-up al escalón o silla", exerciseId: "casa-step-up", sets: [{ kg: 0, reps: 10 }] },
    { name: "Plancha frontal", exerciseId: "casa-plancha-frontal", sets: [{ seg: 40 }, { seg: 40 }] }
  ]);
  const tb = M.entreno(R, B, { "casa-tabata-jj-mc": [true, true, true, true, true, true, true, true] }, { fecha: "2026-11-11", inicio: ini, fin: ini + 6 * 3600000 });
  assert.deepEqual(tb.exercises[0], { name: "Finisher Tabata: jumping jacks / mountain climbers alternados", exerciseId: "casa-tabata-jj-mc", minutos: 4, sets: [] }, "Tabata: 8 × 30 s = 4 min");
  assert.equal(tb.durationMin, 30, "si quedó abierta horas, la duración de la rutina");
  assert.deepEqual(M.progreso(A, marcas), { hechas: 6, total: 15 });
});

test("el mapa muscular usa los músculos de la rutina", () => {
  const porId = new Map(M.fichas(R).map(f => [f.id, f]));
  assert.equal(porId.size, 18);
  const ini = Date.parse("2026-11-09T18:00:00-04:00");
  const w = M.entreno(R, R.dias[0], { "casa-bulgara-silla": [true, true, true], "casa-hip-thrust-una-pierna": [true, true, true] }, { fecha: "2026-11-09", inicio: ini, fin: ini + 20 * 60000 });
  const datos = ME.desdeRegistros({ gimnasio: [Object.assign({ id: "w1" }, w)] }, (nombre, id) => porId.get(id) || null);
  assert.deepEqual(datos.noReconocidos, []);
  const m = ME.calcularMusculos(datos.entradas, { pesoCorporal: 60 });
  assert.equal(m.gluteos.series, 6, "glúteo principal en los dos: 6 series");
  assert.equal(m.cuadriceps.series, 1.5, "cuádriceps secundario en la búlgara: 3 × 0,5");
  assert.equal(m.isquiotibiales.series, 1.5);
  assert.ok(m.gluteos.volumen > 0, "con volumen por peso corporal");
});

test("días hechos esta semana y veces por día", () => {
  const ws = [
    { date: "2026-11-09", plantilla: { id: R.id, dia: "A" } },
    { date: "2026-11-11", plantilla: { id: R.id, dia: "B" } },
    { date: "2026-11-04", plantilla: { id: R.id, dia: "C" } },   // semana pasada
    { date: "2026-11-10", plantilla: { id: "otra", dia: "A" } },
    { date: "2026-11-10", name: "Pierna" }
  ];
  assert.deepEqual(M.hechosSemana(R, ws, "2026-11-12"), { A: "2026-11-09", B: "2026-11-11" });
  assert.deepEqual(M.vecesPorDia(R, ws), { A: 1, B: 1, C: 1 });
  assert.equal(M.lunesDe("2026-11-15"), "2026-11-09");
});

test("rutinas mal escritas no rompen nada", () => {
  assert.equal(M.normalizar(null), null);
  assert.equal(M.normalizar({ nombre: "Sin días" }), null);
  const r = M.normalizar({ nombre: "Mínima", dias: [{ ejercicios: [{ nombre: "Sentadilla", musculos: ["Cuádriceps"] }] }] });
  assert.equal(r.id, "minima");
  assert.equal(r.dias[0].id, "A");
  assert.equal(r.dias[0].ejercicios[0].series, 1);
  assert.match(r.dias[0].ejercicios[0].id, /^minima-A-1-sentadilla$/);
});
