// Historial de un ejercicio para la ficha (js/ej-historial.js).
const test = require("node:test");
const assert = require("node:assert");
const H = require("../js/ej-historial.js");
const DATA = require("../data/ejercicios.json");

const cerca = (a, b, d) => assert.ok(Math.abs(a - b) <= (d || 0.05), `${a} ≈ ${b}`);
const W = (id, date, sets, extra) => ({ id, date, startedAt: Date.parse(date), exercises: [Object.assign({ name: "Sentadilla (Barra)", exerciseId: "barbell-squat", sets }, extra || {})] });
const mismo = ex => ex.exerciseId === "barbell-squat";

test("1RM estimado (Epley): 100 × 5 ≈ 116,7; 1 rep = el peso; tope de 12 reps; RIR suma reps", () => {
  cerca(H.e1rm(100, 5), 116.67);
  assert.strictEqual(H.e1rm(140, 1), 140);
  cerca(H.e1rm(50, 20), H.e1rm(50, 12));
  cerca(H.e1rm(100, 5, 2), H.e1rm(100, 7));
  assert.strictEqual(H.e1rm(0, 5), 0);
  assert.strictEqual(H.e1rm(100, 0), 0);
  cerca(H.pesoPara(116.67, 5), 100, 0.1);
  assert.strictEqual(H.pesoPara(120, 1), 120);
});

test("carga de una serie: con peso, peso corporal con lastre y con asistencia", () => {
  assert.strictEqual(H.cargaSerie({ kg: 60 }, "carga"), 60);
  assert.strictEqual(H.cargaSerie({ kg: 10 }, "peso_corporal", { pesoCorporal: 80, factor: 1 }), 90);
  assert.strictEqual(H.cargaSerie({ asistencia: 20 }, "peso_corporal", { pesoCorporal: 80, factor: 1 }), 60);
  assert.strictEqual(H.cargaSerie({ kg: 0 }, "peso_corporal", { pesoCorporal: 80, factor: 0.64 }), 51.2);
});

test("sesiones: sin calentamientos, mejor serie, volumen y orden por fecha", () => {
  const ent = [
    W("b", "2026-10-08", [{ kg: 60, reps: 8, calentamiento: true }, { kg: 100, reps: 5 }, { kg: 100, reps: 4 }]),
    W("a", "2026-10-01", [{ kg: 95, reps: 5 }, { kg: 95, reps: 5 }]),
    { id: "c", date: "2026-10-05", exercises: [{ name: "Otro", exerciseId: "x", sets: [{ kg: 200, reps: 5 }] }] }
  ];
  const s = H.sesiones(ent, mismo);
  assert.deepStrictEqual(s.map(x => x.fecha), ["2026-10-01", "2026-10-08"]);
  assert.strictEqual(s[1].series, 2);
  assert.strictEqual(s[1].volumen, 900);
  assert.strictEqual(s[1].mejor.kg, 100);
  assert.strictEqual(s[1].mejor.reps, 5);
  cerca(s[1].e1rm, 116.7);
  assert.strictEqual(s[1].reps, 9);
});

test("peso corporal: el 1RM usa tu peso de ese día (pesoEn)", () => {
  const ent = [{ id: "d", date: "2026-10-01", exercises: [{ name: "Dominadas", exerciseId: "pullups", sets: [{ kg: 10, reps: 5 }] }] }];
  const s = H.sesiones(ent, ex => ex.exerciseId === "pullups", { tipo: "peso_corporal", factor: 1, pesoEn: () => 80 });
  cerca(s[0].e1rm, 105);
  assert.strictEqual(s[0].mejor.carga, 90);
});

test("récords por repeticiones: real (≥ n reps) y estimado", () => {
  const ent = [W("a", "2026-10-01", [{ kg: 100, reps: 5 }, { kg: 80, reps: 10 }]), W("b", "2026-10-08", [{ kg: 110, reps: 2 }])];
  const r = H.recordsPorReps(H.sesiones(ent, mismo));
  assert.strictEqual(r.length, 12);
  assert.deepStrictEqual(r[0].real, { kg: 110, fecha: "2026-10-08" }); // 1RM real: 110 × 2
  assert.deepStrictEqual(r[4].real, { kg: 100, fecha: "2026-10-01" }); // 5RM
  assert.deepStrictEqual(r[9].real, { kg: 80, fecha: "2026-10-01" });  // 10RM
  assert.strictEqual(r[11].real, null);                                  // nunca 12
  cerca(r[0].estimado, 117.3, 0.1);                                      // 110 × 2 → 117,3
  assert.ok(r[11].estimado < r[0].estimado);
});

test("resumen: sesiones, última vez (días), mejor 1RM y más volumen", () => {
  const s = H.sesiones([W("a", "2026-10-01", [{ kg: 100, reps: 5 }]), W("b", "2026-10-29", [{ kg: 90, reps: 8 }, { kg: 90, reps: 8 }])], mismo);
  const r = H.resumen(s, "2026-11-05");
  assert.strictEqual(r.sesiones, 2);
  assert.strictEqual(r.ultima, "2026-10-29");
  assert.strictEqual(r.diasDesde, 7);
  cerca(r.mejorE1rm, 116.7);
  assert.strictEqual(r.mejorFecha, "2026-10-01");
  assert.strictEqual(r.maxVolumen, 1440);
  assert.strictEqual(H.resumen([], "2026-11-05"), null);
});

test("alternativas: mismos músculos principales, sin el propio, con tu equipo", () => {
  const base = DATA.ejercicios;
  const destacados = new Set(base.slice(0, DATA.destacados).map(e => e.id));
  const f = base.find(e => e.id === "barbell-bench-press-medium-grip");
  const alt = H.alternativas(f, base, { destacados });
  assert.strictEqual(alt.length, 5);
  assert.ok(!alt.some(a => a.id === f.id));
  alt.forEach(a => assert.ok(a.primarios.some(m => f.primarios.includes(m)), a.nombre));
  assert.ok(alt.some(a => a.id === "dumbbell-bench-press"), alt.map(a => a.nombre).join(", "));
  // Solo con mancuernas.
  const conMancuerna = H.alternativas(f, base, { destacados, equipos: new Set(["mancuerna"]) });
  assert.ok(conMancuerna.length > 0 && conMancuerna.every(a => a.equipo === "mancuerna"));
  // Sentadilla: alternativas de pierna; nunca cardio ni movilidad.
  const sq = H.alternativas(base.find(e => e.id === "barbell-squat"), base, { destacados });
  assert.ok(sq.every(a => a.tipo !== "cardio" && !a.movilidad && a.primarios.includes("cuadriceps")), sq.map(a => a.nombre).join(", "));
  assert.deepStrictEqual(H.alternativas({ id: "x", primarios: [] }, base), []);
  // Con el tipo de movimiento: curl femoral con curl femoral, nunca una cargada olímpica.
  const T = require("../data/ejercicios-tecnica.json");
  const patronDe = id => (T.ej[id] || {}).pt;
  const lc = H.alternativas(base.find(e => e.id === "lying-leg-curls"), base, { destacados, patronDe });
  assert.ok(lc.every(a => patronDe(a.id) !== "olimpico"), lc.map(a => a.nombre).join(", "));
  assert.ok(lc.slice(0, 3).every(a => /Curl femoral/.test(a.nombre)), lc.map(a => a.nombre).join(", "));
});

test("YouTube: búsqueda sin peso y links propios", () => {
  const u = H.busquedaVideo({ nombre: "Sentadilla (Barra)", equipo: "barra" });
  assert.strictEqual(decodeURIComponent(u.split("=")[1]), "cómo hacer sentadilla con barra técnica");
  assert.match(u, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  const id = "dQw4w9WgXcQ";
  ["https://www.youtube.com/watch?v=" + id + "&t=10s", "https://youtu.be/" + id, "youtube.com/shorts/" + id,
    "https://m.youtube.com/watch?v=" + id, "https://www.youtube-nocookie.com/embed/" + id, id].forEach(l => assert.strictEqual(H.idYoutube(l), id, l));
  ["", "hola", "https://vimeo.com/123", "https://www.youtube.com/watch?v=corto", "javascript:alert(1)"].forEach(l => assert.strictEqual(H.idYoutube(l), null, l));
  assert.strictEqual(H.reproductor(id), `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`);
  assert.strictEqual(H.miniaturaVideo(id), `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
});
