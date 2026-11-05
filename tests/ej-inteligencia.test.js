// Resumen inteligente por reglas y datos de los gráficos del Perfil
// (js/ej-inteligencia.js, D-097).
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../js/ej-inteligencia.js");
const P = require("../js/ej-programa.js");
const DATA = require("../data/ejercicios.json");
const F = id => DATA.ejercicios.find(e => e.id === id);

test("resumen del entreno: récords primero y hasta 4 frases", () => {
  const r = I.resumenSesion({
    comparacion: { anterior: { fecha: "2026-10-29" }, dVolumenPct: 8 },
    records: [{ nombre: "Press de banca (Barra)" }, { nombre: "Remo con barra" }],
    planeadas: 18, hechas: 16, estancados: ["Sentadilla (Barra)"], cansados: ["pecho", "tríceps"],
    proximo: { nombre: "Tirón", cuando: "mañana" }
  });
  assert.deepEqual(r.map(x => x.texto), [
    "2 récords hoy: Press de banca (Barra) y Remo con barra.",
    "Moviste un 8 % más de peso total que la última vez.",
    "Sentadilla (Barra) sigue sin mejorar: la próxima prueba otro rango de reps.",
    "Pecho y tríceps: dales unas 48 h antes de volver a cargarlos."
  ]);
  assert.equal(I.resumenSesion({ records: [{ nombre: "Sentadilla" }] })[0].texto, "¡Récord en Sentadilla!");
  assert.match(I.resumenSesion({ comparacion: { anterior: { fecha: "x" }, dVolumenPct: -15 } })[0].texto, /15 % menos .* es normal/);
  assert.equal(I.resumenSesion({ comparacion: { anterior: { fecha: "x" }, dVolumenPct: -18 }, records: [{ nombre: "Remo" }] })[1].texto, "Moviste un 18 % menos de peso total que la última vez, pero con más fuerza.");
  assert.match(I.resumenSesion({ comparacion: { anterior: { fecha: "x" }, dVolumenPct: 2 } })[0].texto, /^Parecido a la última vez/);
  assert.match(I.resumenSesion({ comparacion: { anterior: null } })[0].texto, /^Primera vez con esta rutina/);
  const corto = I.resumenSesion({ planeadas: 18, hechas: 18, proximo: { nombre: "Tirón", cuando: "el sáb" } }).map(x => x.texto);
  assert.deepEqual(corto, ["Completaste todas las series del plan.", "Lo próximo en tu plan: Tirón (el sáb)."]);
  assert.deepEqual(I.resumenSesion({}), []);
  // A medias: no compara el volumen (lo explica "Hiciste 3 de 16").
  assert.deepEqual(I.resumenSesion({ comparacion: { anterior: { fecha: "x" }, dVolumenPct: -80 }, planeadas: 16, hechas: 3 }).map(x => x.tipo), ["incompleto"]);
});

test("resumen de la semana y racha", () => {
  const ent = [
    { date: "2026-11-02", s: 20, v: 9000 }, { date: "2026-11-03", s: 18, v: 7000 },
    { date: "2026-10-27", s: 1, v: 1 }, { date: "2026-10-20", s: 1, v: 1 }, { date: "2026-10-06", s: 1, v: 1 }
  ];
  const r = I.resumenSemana({
    hoy: "2026-11-05", entrenos: ent, planeados: 4, records: ["Press de banca"],
    volumen: [{ nombre: "Pecho", estado: "ok" }, { nombre: "Isquios", estado: "bajo" }],
    carga: { total: 392, promedio: 460 }, resumenDe: w => ({ series: w.s, volumen: w.v })
  });
  assert.equal(r.titulo, "Semana con récords");
  assert.deepEqual(r.lineas, ["2 de 4 entrenos del plan", "38 series · 16.000 kg movidos", "1 récord: Press de banca", "Atrasados: isquios", "Carga 392 (85 % de tu semana típica)", "Racha: 3 semanas seguidas entrenando"]);
  assert.equal(I.racha(ent, "2026-11-05"), 3);
  assert.equal(I.racha(ent.slice(2), "2026-11-05"), 2, "esta semana sin entrenar todavía: cuenta desde la anterior");
  assert.equal(I.resumenSemana({ hoy: "2026-11-05", entrenos: [], resumenDe: () => ({}) }).titulo, "Todavía no entrenaste esta semana");
  assert.equal(I.resumenSemana({ hoy: "2026-11-05", entrenos: ent, planeados: 2, resumenDe: w => ({ series: w.s, volumen: w.v }) }).titulo, "¡Semana completa!");
});

test("frecuencia por músculo, peso en una fecha y fuerza relativa", () => {
  const banca = F("barbell-bench-press-medium-grip");
  const sq = F("barbell-squat");
  const e = [
    { fecha: "2026-11-02", ejercicio: banca, series: [{ kg: 60, reps: 8 }] },
    { fecha: "2026-11-02", ejercicio: banca, series: [{ kg: 60, reps: 8 }] }, // mismo día: 1 vez
    { fecha: "2026-10-28", ejercicio: banca, series: [{ kg: 60, reps: 8 }] },
    { fecha: "2026-10-28", ejercicio: sq, series: [{ kg: 60, reps: 8, calentamiento: true }] }, // solo calentamiento: no
    { fecha: "2026-09-01", ejercicio: sq, series: [{ kg: 100, reps: 5 }] } // fuera de las 4 semanas
  ];
  const f = I.frecuencia(e, P.MUSCULOS_OBJ, "2026-11-05");
  assert.equal(f.find(x => x.id === "pecho").porSemana, 0.5);
  assert.equal(f.find(x => x.id === "cuadriceps").porSemana, 0);
  const pes = { "2026-09-01": 84, "2026-10-15": 82.5 };
  assert.equal(I.pesoEn(pes, "2026-10-20"), 82.5);
  assert.equal(I.pesoEn(pes, "2026-08-01"), 84, "antes del primero, el primero");
  assert.equal(I.pesoEn({}, "2026-10-20"), null);
  const ses = [{ fecha: "2026-10-20", e1rm: 120 }, { fecha: "2026-11-01", e1rm: 125 }, { fecha: "2026-06-01", e1rm: 140 }];
  assert.deepEqual(I.fuerzaRelativa(ses, pes, "2026-11-05"), { e1rm: 125, peso: 82.5, ratio: 1.52, fecha: "2026-11-01" });
  assert.equal(I.fuerzaRelativa(ses, {}, "2026-11-05"), null);
});
