const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/rangos-engine.js");
const CFG = require("../js/rangos-config.js");

const STD = CFG.STANDARDS.hombre;
const cerca = (a, b, tol = 0.1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);
const nombreNivel = idx => R.NIVELES[idx].nombre;

// Una sesión de un ejercicio con series { kg, reps, seg, asistencia }.
function rangoDe(id, series, bw = 85) {
  const def = STD[id];
  const s = series.map((x, i) => ({ key: "k" + i, score: R.scoreSerie(x, def.familia, bw) })).filter(x => x.score != null);
  const r = R.evaluarEjercicio(def, [{ id: "w1", fecha: "2026-09-30", series: s }], "2026-09-30");
  return { S: r.L, P: r.P, nivel: nombreNivel(r.nivel), r };
}

test("25 divisiones de Hierro I a Simétrico", () => {
  assert.equal(R.NIVELES.length, 25);
  assert.equal(R.NIVELES[0].nombre, "Hierro I");
  assert.equal(R.NIVELES[24].nombre, "Simétrico");
});

test("e1RM (Epley con tope de reps)", () => {
  cerca(R.e1RM(100, 1, 12), 100);
  cerca(R.e1RM(100, 5, 12), 116.67);
  cerca(R.e1RM(60, 20, 12), 84);
});

test("banca 100 kg × 5 → Rubí III, top 33 %", () => {
  const r = rangoDe("press_banca", [{ kg: 100, reps: 5 }]);
  cerca(r.S, 116.67);
  cerca(r.P, 66.67);
  assert.equal(r.nivel, "Rubí III");
  assert.equal(R.textoPercentil(r.P), "Estás en el top 33 % más fuerte");
});

test("banca 100 × 5 pesando 90 kg → Rubí II, top 38 %", () => {
  const r = rangoDe("press_banca", [{ kg: 100, reps: 5 }], 90);
  cerca(r.S, 112.28);
  cerca(r.P, 62.28);
  assert.equal(r.nivel, "Rubí II");
  assert.equal(R.topPorcentaje(r.P), 38);
});

test("banca 100 × 5 pesando 80 kg → Esmeralda I", () => {
  const r = rangoDe("press_banca", [{ kg: 100, reps: 5 }], 80);
  cerca(r.S, 121.50);
  cerca(r.P, 71.50);
  assert.equal(r.nivel, "Esmeralda I");
});

test("dominadas × 10 → Rubí I", () => {
  const r = rangoDe("dominadas", [{ kg: 0, reps: 10 }]);
  cerca(r.S, 113.33);
  cerca(r.P, 59.41);
  assert.equal(r.nivel, "Rubí I");
});

test("dominadas con +20 kg × 5 → Esmeralda II", () => {
  const r = rangoDe("dominadas", [{ kg: 20, reps: 5 }]);
  cerca(r.S, 122.50);
  cerca(r.P, 75.59);
  assert.equal(r.nivel, "Esmeralda II");
});

test("dominadas con 25 kg de asistencia × 8 → Hierro III", () => {
  const r = rangoDe("dominadas", [{ asistencia: 25, reps: 8 }]);
  cerca(r.S, 76.00);
  cerca(r.P, 9.62);
  assert.equal(r.nivel, "Hierro III");
  assert.equal(R.textoPercentil(r.P), "Superas al 10 % de hombres que entrenan (estimado)");
});

test("fondos × 10 → Plata II", () => {
  const r = rangoDe("fondos", [{ reps: 10 }]);
  cerca(r.S, 113.33);
  cerca(r.P, 32.50);
  assert.equal(r.nivel, "Plata II");
});

test("flexiones, 38 reps → Rubí III", () => {
  const r = rangoDe("flexiones", [{ reps: 38 }]);
  cerca(r.P, 66.00);
  assert.equal(r.nivel, "Rubí III");
});

test("plancha, 120 s → Rubí II, top 38 %", () => {
  const r = rangoDe("plancha", [{ seg: 120 }]);
  cerca(r.P, 62.00);
  assert.equal(r.nivel, "Rubí II");
  assert.equal(R.topPorcentaje(r.P), 38);
});

test("nivel sostenido: 100, 110, 90, 112 → 100, 105, 102, 107", () => {
  const def = STD.press_banca;
  const sesiones = [100, 110, 90, 112].map((score, i) => ({ id: "w" + i, fecha: `2026-09-0${i + 1}`, series: [{ key: "k" + i, score }] }));
  const r = R.evaluarEjercicio(def, sesiones, "2026-09-05");
  assert.deepEqual(r.puntos.map(p => Math.round(p.L * 100) / 100), [100, 105, 102, 107]);
  cerca(r.pico, 107);
});

test("inactividad con L = pico = 120: 20 / 91 / 365 días", () => {
  cerca(R.inactividad(120, 120, 20), 120);
  cerca(R.inactividad(120, 120, 91), 109.62);
  cerca(R.inactividad(120, 120, 365), 102);
});

test("inactividad en el cálculo de hoy y al volver", () => {
  const def = STD.press_banca;
  const r = R.evaluarEjercicio(def, [{ id: "a", fecha: "2026-01-01", series: [{ key: "k", score: 120 }] }], "2026-04-02");
  cerca(r.Lhoy, 109.62);
  assert.equal(r.estado, "bajando");
  const volver = R.evaluarEjercicio(def, [
    { id: "a", fecha: "2026-01-01", series: [{ key: "k", score: 120 }] },
    { id: "b", fecha: "2026-04-02", series: [{ key: "k2", score: 109.62 }] }
  ], "2026-04-02");
  cerca(volver.L, 109.62); // al volver, L parte del valor ya bajado
});

test("pectoral: banca, fondos y flexiones → 56,81 Rubí I", () => {
  const m = R.calcularMusculos([
    { id: "press_banca", P: 66.67, seriesRecientes: 12, musculos: { pectoral: 1 } },
    { id: "fondos", P: 32.50, seriesRecientes: 6, musculos: { pectoral: 1 } },
    { id: "flexiones", P: 66.00, seriesRecientes: 3, musculos: { pectoral: 1 } }
  ]);
  cerca(m.pectoral.P, 56.81);
  assert.equal(nombreNivel(m.pectoral.nivel), "Rubí I");
});

test("global con grupos 70, 60, 55, 65, 40 y uno sin rango → 39,93 Plata III", () => {
  const grupos = {
    pecho: { P: 70 }, espalda: { P: 60 }, hombros: { P: 55 }, brazos: { P: 65 }, piernas: { P: 40 }, core: { P: null }
  };
  const g = R.calcularGlobal(grupos, 10);
  cerca(g.P, 39.93);
  assert.equal(nombreNivel(g.nivel), "Plata III");
  const simple = (70 + 60 + 55 + 65 + 40 + 0) / 6;
  cerca(simple, 48.33);
});

test("global bloqueado con menos de 10 ejercicios", () => {
  const g = R.calcularGlobal({}, 7);
  assert.equal(g.desbloqueado, false);
  assert.equal(g.faltan, 3);
  assert.equal(g.nivel, null);
});

test("meta desde banca 100 × 5 hacia Esmeralda I → ≈ 105 kg × 5", () => {
  const r = rangoDe("press_banca", [{ kg: 100, reps: 5 }]);
  const m = R.meta(STD.press_banca, r.r.nivel, 85);
  assert.equal(m.nivel.nombre, "Esmeralda I");
  cerca(m.scoreNecesario, 120);
  assert.equal(m.texto, "≈ 105 kg × 5");
  cerca(R.scoreParaPercentil(r.P, STD.press_banca.anclas), 116.67);
});

test("meta en peso corporal: reps o, si pasan de 30, lastre", () => {
  const d = STD.dominadas;
  const m = R.meta(d, R.nivelPorPercentil(59.41), 85); // Rubí I → Rubí II (P60)
  assert.match(m.texto, /^\d+ reps a peso corporal$/);
  assert.equal(R.meta(d, R.nivelPorPercentil(96), 85).texto, "24 reps a peso corporal"); // Campeón I → II
  // Fondos hacia Simétrico: más de 30 reps → lastre para 5 reps.
  const alto = R.meta(STD.fondos, R.nivelPorPercentil(98), 85);
  assert.equal(alto.texto, "+77,5 kg de lastre × 5");
  assert.equal(R.meta(STD.plancha, R.nivelPorPercentil(62), 85).texto, "125 s"); // Rubí II → III (P65)
});

test("histéresis en Rubí III (mínimo 65)", () => {
  const rubi3 = R.NIVELES.findIndex(n => n.nombre === "Rubí III");
  assert.equal(nombreNivel(R.nivelConHisteresis(64.5, rubi3)), "Rubí III");
  assert.equal(nombreNivel(R.nivelConHisteresis(63.9, rubi3)), "Rubí II");
  assert.equal(nombreNivel(R.nivelConHisteresis(70, rubi3)), "Esmeralda I");
});

test("protección: tras subir, las 2 sesiones siguientes no bajan la división", () => {
  const def = STD.press_banca;
  const scores = [100, 130, 60, 60, 60];
  const sesiones = scores.map((score, i) => ({ id: "w" + i, fecha: `2026-09-0${i + 1}`, series: [{ key: "k" + i, score }] }));
  const r = R.evaluarEjercicio(def, sesiones, "2026-09-05");
  const nombres = r.puntos.map(p => nombreNivel(p.nivel));
  assert.equal(nombres[0], "Oro III");
  assert.equal(nombres[1], "Rubí III");          // sube
  assert.equal(nombres[2], "Rubí III");          // protegida (sin escudo sería Oro)
  assert.equal(nombres[3], "Rubí III");          // protegida
  assert.notEqual(nombres[4], "Rubí III");       // ya puede bajar
  assert.ok(r.puntos[2].P < 64 && r.puntos[3].P < 64);
});

test("filtro: calentamiento, límites y series sospechosas", () => {
  assert.equal(R.scoreSerie({ kg: 100, reps: 5, calentamiento: true }, "carga", 85), null);
  assert.equal(R.scoreSerie({ kg: 0, reps: 5 }, "carga", 85), null);
  assert.equal(R.scoreSerie({ kg: 100, reps: 60 }, "carga", 85), null);
  assert.equal(R.scoreSerie({ seg: 4000 }, "tiempo", 85), null);
  assert.equal(R.scoreSerie({ reps: 5, asistencia: 90 }, "corporal", 85), null);

  const def = STD.press_banca;
  // 300 kg × 1 > 1,25 × P99 (231): no cuenta hasta confirmarla.
  const ses = [{ id: "w1", fecha: "2026-09-01", series: [{ key: "raro", score: 300 }, { key: "ok", score: 100 }] }];
  const r = R.evaluarEjercicio(def, ses, "2026-09-01");
  cerca(r.L, 100);
  assert.equal(r.sospechosas.length, 1);
  const conf = R.evaluarEjercicio(def, ses, "2026-09-01", { confirmadas: { raro: true } });
  cerca(conf.L, 300);
  // > 1,5 × nivel sostenido también es sospechosa.
  const salto = R.evaluarEjercicio(def, [
    { id: "a", fecha: "2026-09-01", series: [{ key: "a", score: 80 }] },
    { id: "b", fecha: "2026-09-02", series: [{ key: "b", score: 125 }] }
  ], "2026-09-02");
  assert.equal(salto.sospechosas.length, 1);
  cerca(salto.L, 80);
});

test("músculos desde el mapa muscular de Manolo", () => {
  const m = R.musculosDesdeFicha({ primarios: ["pecho_medio"], secundarios: ["deltoide_anterior", "triceps", "pecho_superior"] });
  assert.deepEqual(m, { pectoral: 1, deltoide_anterior: 0.5, triceps: 0.5 });
  assert.deepEqual(R.musculosDesdeFicha({ primarios: ["pantorrillas"], secundarios: ["cuello"] }), { gemelos: 1 });
});

test("de entrenos guardados a rangos, con vínculos y sin rango", () => {
  const entrenos = [
    { id: "w1", date: "2026-09-28", exercises: [
      { name: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", sets: [{ kg: 60, reps: 10, calentamiento: true }, { kg: 100, reps: 5 }] },
      { name: "Aperturas (Mancuerna)", exerciseId: "dumbbell-flyes", sets: [{ kg: 14, reps: 12 }] },
      { name: "Cosa rara", sets: [{ kg: 10, reps: 10 }] }
    ] }
  ];
  const vincular = ex => {
    if (ex.exerciseId === "barbell-bench-press-medium-grip") return { id: "press_banca" };
    if (ex.exerciseId) return { clave: "id:" + ex.exerciseId, nombre: ex.name, motivo: "sin_estandar" };
    return { clave: "n:" + ex.name, nombre: ex.name, motivo: "sin_vincular" };
  };
  const res = R.calcularRangos({ entrenos, vincular, pesoEn: () => 85, hoy: "2026-09-30" });
  const banca = res.ejercicios.press_banca;
  cerca(banca.P, 66.67);
  assert.equal(banca.estado, "margen");
  assert.equal(banca.diasMargen, 26);
  assert.equal(banca.seriesRecientes, 1);
  assert.equal(banca.meta.texto, "≈ 105 kg × 5");
  assert.deepEqual(res.sinRango.map(x => x.motivo).sort(), ["sin_estandar", "sin_vincular"]);
  cerca(res.musculos.pectoral.P, 66.67);
  assert.equal(res.global.desbloqueado, false);

  const antes = R.nivelesDe(res);
  const mejor = R.calcularRangos({
    entrenos: entrenos.concat([{ id: "w2", date: "2026-09-30", exercises: [{ name: "Press de banca (Barra)", exerciseId: "barbell-bench-press-medium-grip", sets: [{ kg: 110, reps: 5 }] }] }]),
    vincular, pesoEn: () => 85, hoy: "2026-09-30"
  });
  const ups = R.subidas(antes, R.nivelesDe(mejor));
  assert.ok(ups.some(u => u.clave === "ej:press_banca" && u.despues > u.antes));
  assert.deepEqual(R.subidas(R.nivelesDe(mejor), R.nivelesDe(res)), []); // solo subidas
});

test("un peso corporal distinto cambia el rango (se recalcula todo)", () => {
  const entrenos = [{ id: "w1", date: "2026-09-28", exercises: [{ name: "b", sets: [{ kg: 100, reps: 5 }] }] }];
  const vincular = () => ({ id: "press_banca" });
  const a = R.calcularRangos({ entrenos, vincular, pesoEn: () => 85, hoy: "2026-09-30" });
  const b = R.calcularRangos({ entrenos, vincular, pesoEn: () => 90, hoy: "2026-09-30" });
  cerca(a.ejercicios.press_banca.P, 66.67);
  cerca(b.ejercicios.press_banca.P, 62.28);
});
