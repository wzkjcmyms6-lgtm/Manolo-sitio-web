// Entreno en vivo (js/ej-entreno.js) y equipo (js/ej-equipo.js).
const test = require("node:test");
const assert = require("node:assert");
const EQ = require("../js/ej-equipo.js");
const E = require("../js/ej-entreno.js");
const DATA = require("../data/ejercicios.json");
const F = id => DATA.ejercicios.find(e => e.id === id);

test("equipo: perfil por defecto, normalizar y disponibles", () => {
  const p = EQ.perfilActivo({});
  assert.strictEqual(p.barra, 20);
  assert.deepStrictEqual(p.discos, [25, 20, 15, 10, 5, 2.5, 1.25]);
  const casa = EQ.normalizar(EQ.CASA);
  assert.ok(!EQ.disponibles(casa).has("barra") && EQ.disponibles(casa).has("mancuerna") && EQ.disponibles(casa).has("peso_corporal"));
  assert.ok(EQ.disponibles(p).has("maquina") && EQ.disponibles(p).has("polea"));
  const raro = EQ.normalizar({ barra: "15", discos: [20, "10", -1, 20, 999], mancuernas: { min: 1, max: 30, paso: 1 } });
  assert.strictEqual(raro.barra, 15);
  assert.deepStrictEqual(raro.discos, [20, 10]);
  const pf = EQ.perfiles({ equipo: { activo: "casa", perfiles: { casa: { nombre: "Casa", barra: 0 } } } });
  assert.strictEqual(pf.activo, "casa");
  assert.strictEqual(EQ.perfilActivo({ equipo: { activo: "casa", perfiles: { casa: { nombre: "Casa", barra: 10 } } } }).barra, 10);
});

test("equipo: microcargas y redondeo por tipo de equipo", () => {
  const p = EQ.normalizar(null);
  assert.strictEqual(EQ.microcarga(F("barbell-squat"), p), 2.5);
  assert.strictEqual(EQ.microcarga(F("side-lateral-raise"), p), 2);
  assert.strictEqual(EQ.microcarga(F("leg-press"), p), 5);
  assert.strictEqual(EQ.microcarga(F("triceps-pushdown"), p), 2.5);
  assert.strictEqual(EQ.redondear(61.3, F("barbell-squat"), p), 62.5);
  assert.strictEqual(EQ.redondear(61.3, F("barbell-squat"), p, "abajo"), 60);
  assert.strictEqual(EQ.redondear(12, F("barbell-squat"), p), 20);       // nunca menos que la barra
  assert.strictEqual(EQ.redondear(13, F("side-lateral-raise"), p), 14);  // mancuernas de 2 en 2
  assert.strictEqual(EQ.redondear(99, F("side-lateral-raise"), p), 50);  // la más pesada que tienes
  assert.strictEqual(EQ.redondear(143, F("leg-press"), p), 145);
  // Con discos de 2,5 como los más chicos, la barra sube de 5 en 5.
  assert.strictEqual(EQ.microcarga(F("barbell-squat"), EQ.normalizar({ discos: [20, 10, 5, 2.5] })), 5);
});

test("discos por lado", () => {
  const r = EQ.discosPorLado(112.5, 20, EQ.POR_DEFECTO.discos);
  assert.deepStrictEqual(r.discos, [25, 20, 1.25]);
  assert.strictEqual(r.resto, 0);
  assert.strictEqual(EQ.textoDiscos(r), "25 + 20 + 1,25");
  assert.strictEqual(EQ.textoDiscos(EQ.discosPorLado(140, 20, EQ.POR_DEFECTO.discos)), "2 × 25 + 10");
  assert.strictEqual(EQ.textoDiscos(EQ.discosPorLado(20, 20, EQ.POR_DEFECTO.discos)), "solo la barra");
  const falta = EQ.discosPorLado(61, 20, [20, 10, 5, 2.5]);
  assert.ok(falta.resto > 0 && /faltan 0,5 kg por lado/.test(EQ.textoDiscos(falta)));
});

test("porqué del objetivo en una línea", () => {
  const it = { series: 4, repsMin: 5, repsMax: 8, peso: 90 };
  assert.strictEqual(E.porque({ tipo: "subir", kg: 110, reps: [5, 5, 5, 5], kgAnterior: 105, repsAnteriores: [8, 8, 8, 8] }, it),
    "Hoy 4 × 5 con 110 kg · la última vez 4 × 8 con 105 kg → sube 5 kg");
  assert.strictEqual(E.porque({ tipo: "repetir", kg: 105, reps: [8, 8, 8, 8], kgAnterior: 105, repsAnteriores: [8, 8, 8, 7] }, it),
    "Hoy 4 × 8 con 105 kg · la última vez 8 · 8 · 8 · 7 con 105 kg → +1 rep");
  assert.strictEqual(E.porque({ tipo: "bajar", kg: 95, reps: [5, 5, 5, 5], kgAnterior: 105, repsAnteriores: [4, 4, 3, 3] }, it),
    "Hoy 4 × 5 con 95 kg · las 2 últimas veces quedaste bajo 5 reps → baja 10 kg");
  assert.match(E.porque({ tipo: "nuevo" }, it), /Primera vez.*4 × 5-8 con 90 kg/);
  assert.deepStrictEqual(E.objetivoSeries(it, { tipo: "subir", kg: 110, reps: [5, 5, 5, 5] }), [{ kg: 110, meta: 5 }, { kg: 110, meta: 5 }, { kg: 110, meta: 5 }, { kg: 110, meta: 5 }]);
  assert.deepStrictEqual(E.objetivoSeries({ series: 2, repsMin: 8, peso: null }, { tipo: "nuevo" }), [{ kg: "", meta: 8 }, { kg: "", meta: 8 }]);
  // Descarga: las series de la sugerencia (menos que las de la rutina).
  assert.deepStrictEqual(E.objetivoSeries(it, { tipo: "descarga", kg: 92.5, reps: [5, 5] }), [{ kg: 92.5, meta: 5 }, { kg: 92.5, meta: 5 }]);
  assert.strictEqual(E.porque({ tipo: "descarga", kg: 92.5, reps: [5, 5] }, it), "Semana de descarga: 2 × 5 con 92,5 kg · menos series y algo menos de peso");
});

test("calentamiento: ~40/60/80 % redondeado a tu equipo", () => {
  const p = EQ.normalizar(null);
  const sq = E.calentamiento(110, F("barbell-squat"), p);
  assert.deepStrictEqual(sq.map(x => [x.kg, x.reps]), [[20, 10], [45, 8], [65, 5], [87.5, 3]]);
  // Liviano para la barra: sin calentamiento sugerido.
  assert.deepStrictEqual(E.calentamiento(30, F("barbell-squat"), p), []);
  // Aislamiento con mancuernas: no hace falta.
  assert.deepStrictEqual(E.calentamiento(12, F("side-lateral-raise"), p), []);
  // Prensa (máquina, compuesto): de 5 en 5.
  assert.deepStrictEqual(E.calentamiento(150, F("leg-press"), p).map(x => x.kg), [60, 90, 120]);
  // Peso corporal: no.
  assert.deepStrictEqual(E.calentamiento(10, F("pullups"), p), []);
});

test("descanso sugerido según el ejercicio", () => {
  assert.strictEqual(E.descansoSugerido(F("barbell-squat"), 5), 180);
  assert.strictEqual(E.descansoSugerido(F("barbell-squat"), 10), 150);
  assert.strictEqual(E.descansoSugerido(F("standing-military-press"), 6), 120);
  assert.strictEqual(E.descansoSugerido(F("side-lateral-raise"), 12), 75);
  assert.strictEqual(E.descansoSugerido(F("plank")), 60);
  assert.strictEqual(E.descansoSugerido(F("manolo-correr")), 0);
});

test("superseries: A1/A2, descanso al final de la ronda", () => {
  const ej = [{ descansoSeg: 120 }, { grupo: "A", descansoSeg: 60 }, { grupo: "A", descansoSeg: 90 }, { descansoSeg: 0 }, { grupo: "B", descansoSeg: 45 }, { grupo: "B", descansoSeg: 45 }, { grupo: "B", descansoSeg: 45 }];
  const g = E.grupos(ej);
  assert.strictEqual(g[0], null);
  assert.deepStrictEqual(g[1], { letra: "A", pos: 1, total: 2 });
  assert.deepStrictEqual(g[2], { letra: "A", pos: 2, total: 2 });
  assert.deepStrictEqual(g[6], { letra: "B", pos: 3, total: 3 });
  assert.deepStrictEqual(E.trasMarcar(ej, 0), { descansar: true, seg: 120, siguiente: null });
  assert.deepStrictEqual(E.trasMarcar(ej, 1), { descansar: false, seg: 0, siguiente: 2 });
  assert.deepStrictEqual(E.trasMarcar(ej, 2), { descansar: true, seg: 90, siguiente: 1 }); // el mayor de la ronda
  assert.deepStrictEqual(E.trasMarcar(ej, 3), { descansar: false, seg: 0, siguiente: null });
  assert.deepStrictEqual(E.trasMarcar(ej, 5), { descansar: false, seg: 0, siguiente: 6 });
  assert.deepStrictEqual(E.trasMarcar(ej, 6), { descansar: true, seg: 45, siguiente: 4 });
  // Un grupo de uno solo no es superserie.
  assert.strictEqual(E.grupos([{ grupo: "A" }, {}])[0], null);
  assert.strictEqual(E.letraLibre(ej), "C");
});

test("récord en vivo: 1RM estimado o mejor peso para esas reps", () => {
  const prev = E.previoDe([{ e1rm: 120, sets: [{ kg: 100, reps: 6 }, { kg: 90, reps: 10 }] }]);
  const r1 = E.recordEnVivo({ kg: 105, reps: 6 }, prev);
  assert.strictEqual(r1.tipo, "1rm");
  assert.strictEqual(r1.valor, 126);
  assert.strictEqual(E.textoRecord(r1), "¡Récord! 1RM estimado 126 kg (antes 120 kg)");
  // Mismo 1RM estimado pero más peso para 2 reps: récord de reps.
  const r2 = E.recordEnVivo({ kg: 110, reps: 2 }, prev);
  assert.deepStrictEqual(r2, { tipo: "reps", reps: 2, kg: 110, antes: 100 });
  assert.strictEqual(E.textoRecord(r2), "¡Récord de 2 reps: 110 kg! (antes 100 kg)");
  assert.strictEqual(E.recordEnVivo({ kg: 90, reps: 8 }, prev), null);
  // Sin historial no hay récords (sería todo récord).
  assert.strictEqual(E.recordEnVivo({ kg: 200, reps: 1 }, E.previoDe([])), null);
});

test("resumen al terminar: contra la última vez de la misma rutina", () => {
  const w = (id, date, kg, rutinaId) => ({ id, date, startedAt: Date.parse(date), rutinaId, name: "Pierna", exercises: [{ name: "Sentadilla", sets: [{ kg: 50, reps: 5, calentamiento: true }, { kg, reps: 5 }, { kg, reps: 5 }] }] });
  const hist = [w("a", "2026-10-22", 100, "pierna"), w("b", "2026-10-29", 105, "pierna"), w("c", "2026-10-30", 200, "otra")];
  const hoy = w(null, "2026-11-05", 110, "pierna");
  const ant = E.anteriorComparable(hist, hoy);
  assert.strictEqual(ant.id, "b");
  const c = E.comparar(hoy, ant);
  assert.strictEqual(c.volumen, 1100);
  assert.strictEqual(c.series, 2);
  assert.strictEqual(c.reps, 10);
  assert.strictEqual(c.dVolumenPct, 5);
  assert.strictEqual(c.dSeries, 0);
  assert.strictEqual(c.anterior.fecha, "2026-10-29");
  assert.strictEqual(E.comparar(hoy, null).anterior, null);
  // Sin rutina: por nombre.
  const libre = Object.assign(w(null, "2026-11-05", 80), { rutinaId: undefined });
  assert.strictEqual(E.anteriorComparable(hist, libre).id, "c");
});

test("carga de la sesión: RPE × minutos en la escala de Running", () => {
  assert.strictEqual(E.cargaSesion(8, 60), 100);
  assert.strictEqual(E.cargaSesion(7, 58), 85);
  assert.strictEqual(E.cargaSesion(0, 60), 0);
  assert.strictEqual(E.cargaSesion(12, 60), 125); // tope 10
});
