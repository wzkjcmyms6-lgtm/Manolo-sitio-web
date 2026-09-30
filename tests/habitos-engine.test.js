const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/habitos-engine.js");
const CFG = require("../js/habitos-config.js");

const ms = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const hecho = (t = null) => ({ e: "hecho", t });
// Hábito con registros { "AAAA-MM-DD": registro }; inicio explícito para no depender de createdAt.
const hab = (id, extra) => Object.assign({ id, name: id, inicio: "2026-09-01", registros: {} }, extra);
const dias = (desde, n, reg = () => hecho()) => {
  const out = {};
  for (let i = 0; i < n; i++) out[E.addDias(desde, i)] = reg(i);
  return out;
};
const uno = (doc, hoy, extra) => E.evaluar([doc], Object.assign({ hoy }, extra)).habitos[doc.id];

// ---------- Fechas ----------
test("fechas locales: sumar días cruza meses y años", () => {
  assert.equal(E.addDias("2026-09-30", 1), "2026-10-01");
  assert.equal(E.addDias("2026-12-31", 1), "2027-01-01");
  assert.equal(E.addDias("2027-03-01", -1), "2027-02-28");
  assert.equal(E.diasEntre("2026-12-30", "2027-01-02"), 3);
  assert.equal(E.diaSemana("2026-09-28"), 0); // lunes
  assert.equal(E.diaSemana("2026-10-04"), 6); // domingo
  assert.equal(E.lunesDe("2027-01-01"), "2026-12-28");
  assert.equal(E.semanaId("2026-09-30"), "2026-W40");
  assert.equal(E.semanaId("2027-01-01"), "2026-W53");
});

test("fin del día a las 3 a. m.: las 2:30 todavía son el día anterior", () => {
  assert.equal(E.fechaLogica(ms(2026, 10, 1, 2, 30), 3), "2026-09-30");
  assert.equal(E.fechaLogica(ms(2026, 10, 1, 3, 0), 3), "2026-10-01");
  assert.equal(E.fechaLogica(ms(2026, 10, 1, 2, 30), 0), "2026-10-01");
  assert.equal(E.fechaLogica(ms(2027, 1, 1, 1, 0), 3), "2026-12-31"); // cambio de año
  assert.equal(E.fechaLogica(ms(2026, 10, 1, 23, 59), 3), "2026-10-01");
});

test("ventana de 48 h para el XP (desde el fin del día)", () => {
  const fin = E.finDelDiaMs("2026-09-30", 3);
  assert.equal(fin, ms(2026, 10, 1, 3, 0));
  assert.ok(E.dentroDeVentana({ t: fin + 47 * 3600000 }, "2026-09-30", 3));
  assert.ok(!E.dentroDeVentana({ t: fin + 49 * 3600000 }, "2026-09-30", 3));
  assert.ok(E.dentroDeVentana({ e: "hecho", t: null }, "2020-01-01", 3)); // historial viejo: cuenta completo
});

// ---------- Migración ----------
test("migración: un hábito viejo se lee con todo su historial y sin tocar el documento", () => {
  const viejo = {
    name: "Leer", emoji: "📖", freqType: "semana", timesPerWeek: 3, timeOfDay: "manana",
    done: ["2026-09-01", "2026-09-03", "basura", "2026-09-05"], createdAt: ms(2026, 9, 1, 9)
  };
  const copia = JSON.parse(JSON.stringify(viejo));
  const h = E.normalizar(viejo, "abc");
  assert.deepEqual(viejo, copia);
  assert.equal(h.id, "abc");
  assert.equal(h.tipo, "sino");
  assert.equal(h.freqType, "semana");
  assert.equal(h.timeOfDay, "manana");
  assert.equal(h.dificultad, "media");
  assert.equal(h.inicio, "2026-09-01");
  assert.deepEqual(Object.keys(h.registros).sort(), ["2026-09-01", "2026-09-03", "2026-09-05"]);
  assert.equal(h.registros["2026-09-03"].e, "hecho");
  assert.equal(h.registros["2026-09-03"].t, null);
});

test("migración: registros (formato nuevo) manda sobre done; datos raros se corrigen", () => {
  const h = E.normalizar({
    name: "  ", freqType: "raro", timesPerWeek: 12, timeOfDay: "madrugada",
    done: ["2026-09-02"], registros: { "2026-09-02": { e: "saltado", m: "enfermo", t: 5 }, "2026-09-04": { e: "inventado" } },
    createdAt: ms(2026, 9, 3)
  }, "x");
  assert.equal(h.name, "Hábito");
  assert.equal(h.freqType, "diario");
  assert.equal(h.timesPerWeek, 7);
  assert.equal(h.timeOfDay, "cualquiera");
  assert.equal(h.registros["2026-09-02"].e, "saltado");
  assert.equal(h.registros["2026-09-04"], undefined);
  assert.equal(h.inicio, "2026-09-02"); // el registro más antiguo adelanta el inicio
  // Normalizar dos veces da lo mismo (idempotente).
  const dos = E.normalizar(h, "x");
  assert.deepEqual(dos.registros, h.registros);
  assert.equal(dos.inicio, h.inicio);
});

// ---------- Rachas diarias ----------
test("racha diaria: hoy sin marcar no la corta; un fallo sí", () => {
  const r = uno(hab("a", { registros: dias("2026-09-01", 10) }), "2026-09-11");
  assert.equal(r.racha.actual, 10);
  assert.equal(r.hoy.clase, "pendiente");
  const conFallo = uno(hab("a", { registros: Object.assign(dias("2026-09-01", 4), dias("2026-09-06", 5)) }), "2026-09-10");
  assert.equal(conFallo.dias["2026-09-05"].clase, "fallo");
  assert.equal(conFallo.racha.actual, 5);
  assert.equal(conFallo.racha.mejor, 5);
});

test("racha cruza cambio de mes y de año", () => {
  const r = uno(hab("a", { inicio: "2026-12-28", registros: dias("2026-12-28", 8) }), "2027-01-04");
  assert.equal(r.racha.actual, 8);
});

test("días que no tocan: ni cuentan ni cortan la racha", () => {
  // Lunes, miércoles y viernes; se cumplen 2 semanas seguidas.
  const lmv = [true, false, true, false, true, false, false];
  const registros = {};
  ["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-14", "2026-09-16", "2026-09-18"].forEach(f => { registros[f] = hecho(); });
  const r = uno(hab("a", { inicio: "2026-09-07", freqType: "dias", days: lmv, registros }), "2026-09-20");
  assert.equal(r.dias["2026-09-08"].clase, "noToca");
  assert.equal(r.racha.actual, 6);
  // Hacerlo un martes cuenta como extra (da XP) sin sumar a la racha.
  registros["2026-09-15"] = hecho();
  const r2 = uno(hab("a", { inicio: "2026-09-07", freqType: "dias", days: lmv, registros }), "2026-09-20");
  assert.equal(r2.dias["2026-09-15"].clase, "extra");
  assert.ok(r2.dias["2026-09-15"].xp > 0);
  assert.equal(r2.racha.actual, 6);
});

test("cada N días: toca cada 3 días desde el inicio", () => {
  const h = hab("a", { inicio: "2026-09-01", freqType: "cadaN", cadaN: 3, registros: { "2026-09-01": hecho(), "2026-09-04": hecho(), "2026-09-07": hecho() } });
  const r = uno(h, "2026-09-09");
  assert.equal(r.dias["2026-09-02"].clase, "noToca");
  assert.equal(r.dias["2026-09-07"].clase, "cumple");
  assert.equal(r.racha.actual, 3);
  assert.equal(uno(h, "2026-09-11").racha.actual, 0); // el 10 tocaba y no se hizo
});

// ---------- Semanales ----------
test("X veces por semana: se evalúa por semana y la racha se cuenta en semanas", () => {
  // Semanas desde el lunes 7 sept: 3/3, 3/3, 1/3 (en curso).
  const registros = {};
  ["2026-09-07", "2026-09-09", "2026-09-12", "2026-09-14", "2026-09-15", "2026-09-20", "2026-09-21"].forEach(f => { registros[f] = hecho(); });
  const r = uno(hab("a", { inicio: "2026-09-07", freqType: "semana", timesPerWeek: 3, registros }), "2026-09-23");
  assert.equal(r.racha.unidad, "semanas");
  assert.equal(r.racha.actual, 2);
  assert.equal(r.semanaActual.estado, "pendiente");
  assert.equal(r.semanaActual.hechas, 1);
  // Un martes sin marcar no es un fallo (falla 1 de la versión anterior).
  assert.equal(r.dias["2026-09-08"].clase, "noToca");
  assert.ok(!Object.values(r.dias).some(d => d.clase === "fallo"));
});

test("X veces por semana: una semana incompleta corta la racha; saltados reducen la meta", () => {
  const registros = { "2026-09-07": hecho(), "2026-09-08": hecho() }; // 2 de 3
  const r = uno(hab("a", { inicio: "2026-09-07", freqType: "semana", timesPerWeek: 3, registros }), "2026-09-15");
  assert.equal(r.semanas[0].estado, "fallo");
  assert.equal(r.racha.actual, 0);
  // Enfermo 5 días: quedan 2 disponibles, así que 2 hechos bastan.
  ["2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"].forEach(f => { registros[f] = { e: "saltado", m: "enfermo" }; });
  const r2 = uno(hab("a", { inicio: "2026-09-07", freqType: "semana", timesPerWeek: 3, registros }), "2026-09-15");
  assert.equal(r2.semanas[0].meta, 2);
  assert.equal(r2.semanas[0].estado, "cumple");
  assert.equal(r2.racha.actual, 1);
});

// ---------- Estados de un día ----------
test("saltado con motivo: no rompe la racha ni da XP", () => {
  const registros = dias("2026-09-01", 5);
  registros["2026-09-03"] = { e: "saltado", m: "viaje" };
  const r = uno(hab("a", { registros }), "2026-09-06");
  assert.equal(r.dias["2026-09-03"].clase, "neutral");
  assert.equal(r.dias["2026-09-03"].xp, 0);
  assert.equal(r.racha.actual, 4);
});

test("versión mínima: mantiene la racha con menos XP", () => {
  const normal = uno(hab("a", { registros: dias("2026-09-01", 3) }), "2026-09-04");
  const minima = uno(hab("a", { registros: dias("2026-09-01", 3, i => (i === 2 ? { e: "minima" } : hecho())) }), "2026-09-04");
  assert.equal(minima.racha.actual, 3);
  assert.ok(minima.dias["2026-09-03"].xp > 0);
  assert.ok(minima.dias["2026-09-03"].xp < normal.dias["2026-09-03"].xp);
});

test("medible: XP proporcional; la racha se mantiene desde el 50 % de la meta", () => {
  const h = v => hab("a", { tipo: "medible", meta: 8, unidad: "vasos", registros: { "2026-09-01": { v: 8 }, "2026-09-02": { v } } });
  const medio = uno(h(4), "2026-09-03");
  assert.equal(medio.dias["2026-09-02"].estado, "parcial");
  assert.equal(medio.racha.actual, 2);
  const poco = uno(h(2), "2026-09-03");
  assert.equal(poco.dias["2026-09-02"].clase, "fallo");
  assert.equal(poco.racha.actual, 0);
  assert.ok(poco.dias["2026-09-02"].xp === 0 && medio.dias["2026-09-02"].xp > 0);
  // Hoy a medias todavía está pendiente, no es un fallo.
  const hoy = uno(hab("a", { tipo: "medible", meta: 8, registros: { "2026-09-03": { v: 2 } } }), "2026-09-03");
  assert.equal(hoy.hoy.clase, "pendiente");
});

test("pausa por vacaciones: los días en pausa no cuentan", () => {
  const registros = Object.assign(dias("2026-09-01", 3), dias("2026-09-11", 3));
  const r = uno(hab("a", { registros, pausas: [{ desde: "2026-09-04", hasta: "2026-09-10" }] }), "2026-09-14");
  assert.equal(r.dias["2026-09-06"].clase, "neutral");
  assert.equal(r.racha.actual, 6);
});

test("evitar: cuenta días limpios; la recaída corta; hoy no da XP todavía", () => {
  const h = hab("a", { tipo: "evitar", inicio: "2026-09-01", registros: { "2026-09-05": { e: "recaida", t: null } } });
  const r = uno(h, "2026-09-12");
  assert.equal(r.racha.unidad, "limpios");
  assert.equal(r.racha.actual, 7);     // recaída el 5 → limpios del 6 al 12 (incluye hoy)
  assert.equal(r.racha.mejor, 7);      // antes de la recaída fueron 4
  assert.equal(r.dias["2026-09-05"].clase, "fallo");
  assert.equal(r.hoy.xp, 0);
  assert.ok(r.dias["2026-09-11"].xp > 0);
});

test("archivado: deja de tocar desde la fecha en que se archivó", () => {
  const r = uno(hab("a", { registros: dias("2026-09-01", 3), archivado: true, archivadoEn: "2026-09-04" }), "2026-09-10");
  assert.equal(r.dias["2026-09-05"].clase, "fuera");
  assert.equal(r.racha.actual, 3);
});

// ---------- Comodines ----------
test("comodines: cubren un día fallado si ya los tenías; máximo 2 guardados", () => {
  const registros = Object.assign(dias("2026-09-01", 4), dias("2026-09-06", 4)); // falla el 5
  const sin = uno(hab("a", { registros }), "2026-09-10");
  assert.equal(sin.racha.actual, 4);
  const con = E.evaluar([hab("a", { registros })], { hoy: "2026-09-10", comodines: ["2026-09-02"] });
  assert.equal(con.habitos.a.racha.actual, 8);
  assert.equal(con.habitos.a.dias["2026-09-05"].protegido, true);
  assert.deepEqual(con.comodines.protegidos, ["2026-09-05"]);
  assert.equal(con.comodines.guardados, 0);
  // Comprado después del fallo no lo cubre (y queda guardado).
  const tarde = E.evaluar([hab("a", { registros })], { hoy: "2026-09-10", comodines: ["2026-09-07"] });
  assert.equal(tarde.habitos.a.racha.actual, 4);
  assert.equal(tarde.comodines.guardados, 1);
  // Tope de 2 guardados.
  assert.equal(E.asignarComodines([], ["2026-09-01", "2026-09-02", "2026-09-03"]).guardados, 2);
});

test("un comodín cubre el día entero, aunque fallen varios hábitos", () => {
  const regs = Object.assign(dias("2026-09-01", 2), dias("2026-09-04", 2)); // fallan el 3
  const r = E.evaluar([hab("a", { registros: regs }), hab("b", { registros: regs })], { hoy: "2026-09-06", comodines: ["2026-09-01"] });
  assert.equal(r.habitos.a.racha.actual, 4);
  assert.equal(r.habitos.b.racha.actual, 4);
  assert.equal(r.comodines.protegidos.length, 1);
});

// ---------- XP, nivel y monedas ----------
test("desmarcar un día recalcula el XP y la racha", () => {
  const registros = dias("2026-09-01", 5);
  const antes = E.evaluar([hab("a", { registros })], { hoy: "2026-09-06" });
  delete registros["2026-09-05"];
  const despues = E.evaluar([hab("a", { registros })], { hoy: "2026-09-06" });
  assert.ok(despues.xp < antes.xp);
  assert.equal(despues.habitos.a.racha.actual, 0);
  assert.ok(despues.monedasGanadas <= antes.monedasGanadas);
});

test("solo lo marcado dentro de 48 h da XP", () => {
  const aTiempo = { e: "hecho", t: ms(2026, 9, 2, 10) };
  const tarde = { e: "hecho", t: ms(2026, 9, 10, 10) };
  const a = uno(hab("a", { registros: { "2026-09-01": aTiempo } }), "2026-09-10");
  const b = uno(hab("a", { registros: { "2026-09-01": tarde } }), "2026-09-10");
  assert.ok(a.dias["2026-09-01"].xp > 0);
  assert.equal(b.dias["2026-09-01"].xp, 0);
  assert.equal(b.dias["2026-09-01"].clase, "cumple"); // la racha sí cuenta
});

test("bonus por racha con tope y día perfecto", () => {
  const largo = uno(hab("a", { dificultad: "media", registros: dias("2026-01-01", 60) }), "2026-03-01");
  const base = CFG.DIFICULTADES.media.xp;
  assert.equal(largo.dias["2026-01-01"].xp, Math.round(base * 1.02));
  assert.equal(largo.dias["2026-02-28"].xp, Math.round(base * (1 + CFG.XP.BONUS_RACHA_TOPE)));
  const dosHabitos = E.evaluar([hab("a", { registros: dias("2026-09-01", 1) }), hab("b", { registros: dias("2026-09-01", 1) })], { hoy: "2026-09-01" });
  assert.deepEqual(dosHabitos.diasPerfectos.map(p => p.fecha), ["2026-09-01"]);
  const soloUno = E.evaluar([hab("a", { registros: dias("2026-09-01", 1) }), hab("b")], { hoy: "2026-09-01" });
  assert.equal(soloUno.diasPerfectos.length, 0);
});

test("cumplimiento de un periodo y resumen de un día", () => {
  const registros = dias("2026-09-01", 3); // cumple 1, 2 y 3; falla el 4
  const r = E.evaluar([hab("a", { registros }), hab("b", { registros: dias("2026-09-04", 1) })], { hoy: "2026-09-05" });
  assert.equal(E.cumplimiento(r.habitos.a, "2026-09-01", "2026-09-04"), 0.75);
  assert.equal(E.cumplimiento(r.habitos.a, "2026-09-05", "2026-09-05"), null); // hoy pendiente no cuenta
  assert.deepEqual(E.resumenDia(r, "2026-09-04"), { hechos: 1, esperados: 2 });
  assert.deepEqual(E.resumenDia(r, "2026-09-05"), { hechos: 0, esperados: 2 });
});

test("cadenas: cada hábito va justo después del que lo encadena; los ciclos no rompen nada", () => {
  const h = (id, despuesDe) => ({ id, despuesDe: despuesDe || null });
  const orden = l => E.ordenarConCadenas(l).map(x => x.id).join(",");
  assert.equal(orden([h("cafe"), h("leer", "meditar"), h("meditar", "cafe"), h("agua")]), "cafe,meditar,leer,agua");
  assert.equal(orden([h("a", "zzz"), h("b")]), "a,b"); // el anterior no está: queda en su lugar
  assert.equal(orden([h("a", "b"), h("b", "a"), h("c")]), "a,b,c"); // ciclo: sin perder ninguno
  assert.ok(E.formaCiclo(h("a", "b"), new Map([["a", h("a", "b")], ["b", h("b", "a")]])));
});

test("calendario de un mes (lunes primero)", () => {
  const sept = E.mesCalendario(2026, 9);
  assert.equal(sept[0][0], null);            // 1 de septiembre de 2026 es martes
  assert.equal(sept[0][1], "2026-09-01");
  assert.equal(sept[sept.length - 1].filter(Boolean).pop(), "2026-09-30");
  assert.ok(sept.every(s => s.length === 7));
  assert.equal(E.mesCalendario(2027, 2).flat().filter(Boolean).length, 28);
  assert.equal(E.mesCalendario(2028, 2).flat().filter(Boolean).length, 29); // bisiesto
});

test("XP ganado en un día incluye el bonus de día perfecto", () => {
  const r = E.evaluar([hab("a", { registros: dias("2026-09-01", 1) })], { hoy: "2026-09-01" });
  assert.equal(E.xpDelDiaTotal(r, "2026-09-01"), r.habitos.a.dias["2026-09-01"].xp + CFG.XP.DIA_PERFECTO);
});

test("curva de niveles y títulos", () => {
  assert.equal(E.nivelDeXP(0).nivel, 1);
  assert.equal(E.nivelDeXP(E.xpParaNivel(10)).nivel, 10);
  assert.equal(E.nivelDeXP(E.xpParaNivel(10) - 1).nivel, 9);
  assert.equal(E.titulo(4), "Principiante");
  assert.equal(E.titulo(5), "Aprendiz");
  assert.equal(E.titulo(10), "Constante");
});

test("calibración: nivel 2 el primer día, ~10 al mes y ~30 al año (5 hábitos, 85 %)", () => {
  function simular(n, adherencia) {
    let s = 7;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const docs = [1, 2, 3, 4, 5].map(i => hab("h" + i, { inicio: "2026-01-05" }));
    for (let k = 0; k < n; k++) {
      const f = E.addDias("2026-01-05", k);
      docs.forEach(d => { if (rnd() < adherencia) d.registros[f] = hecho(); });
    }
    return E.evaluar(docs, { hoy: E.addDias("2026-01-05", n - 1) }).nivel.nivel;
  }
  assert.ok(simular(1, 1) >= 2);
  const mes = simular(30, 0.85), anio = simular(365, 0.85);
  assert.ok(mes >= 8 && mes <= 12, `mes: nivel ${mes}`);
  assert.ok(anio >= 26 && anio <= 34, `año: nivel ${anio}`);
});

test("rinde con 20 hábitos y 3 años de historial", () => {
  const docs = Array.from({ length: 20 }, (_, i) => hab("h" + i, { inicio: "2023-10-01", registros: dias("2023-10-01", 1096, j => (j % 5 ? hecho() : undefined)) }));
  docs.forEach(d => Object.keys(d.registros).forEach(f => { if (!d.registros[f]) delete d.registros[f]; }));
  const t0 = Date.now();
  const r = E.evaluar(docs, { hoy: "2026-09-30" });
  const t = Date.now() - t0;
  assert.ok(r.xp > 0);
  assert.ok(t < 1500, `tardó ${t} ms`);
});

// ---------- Fase 2: rango, áreas, monedas, misiones, logros y novedades ----------
const RC = require("../js/rangos-config.js");
const nivelNombre = r => (r.tieneRango ? E.NIVELES[r.nivel].nombre : "Sin rango");
const perfectoN = (n, extra) => uno(hab("a", Object.assign({ inicio: "2025-01-01", registros: dias("2025-01-01", n) }, extra)), E.addDias("2025-01-01", n));

test("rango: 25 divisiones con nombre propio en Hábitos (Ejercicio no cambia)", () => {
  assert.equal(E.NIVELES.length, 25);
  assert.equal(E.NIVELES[24].nombre, "Inquebrantable");
  assert.equal(RC.RANGOS[RC.RANGOS.length - 1].nombre, "Simétrico");
});

test("rango calibrado: semana ≈ Bronce, mes ≈ Oro, 3 meses ≈ Diamante, 1 año al 95 % ≈ máximo", () => {
  assert.match(nivelNombre(perfectoN(7).rango), /^Bronce/);
  assert.match(nivelNombre(perfectoN(30).rango), /^Oro/);
  assert.match(nivelNombre(perfectoN(90).rango), /^Diamante/);
  // 5 meses perfectos no bastan: el máximo pide casi un año de historia.
  assert.notEqual(nivelNombre(perfectoN(160).rango), "Inquebrantable");
  const anio = uno(hab("a", { inicio: "2025-01-01", registros: dias("2025-01-01", 365, i => (i % 20 === 19 ? undefined : hecho())) }), "2026-01-01");
  assert.equal(nivelNombre(anio.rango), "Inquebrantable");
});

test("rango: un fallo aislado nunca baja de división", () => {
  for (let n = 5; n <= 240; n += 5) {
    const antes = perfectoN(n).rango.nivel;
    const regs = dias("2025-01-01", n + 2, i => (i === n ? undefined : hecho()));
    const r = uno(hab("a", { inicio: "2025-01-01", registros: regs }), E.addDias("2025-01-01", n + 2)).rango;
    const tras = r.serie.find(x => x.fecha === E.addDias("2025-01-01", n)).nivel;
    assert.ok(tras >= antes, `tras ${n} días: ${E.NIVELES[antes].nombre} → ${E.NIVELES[tras].nombre}`);
  }
});

test("rango: saltados y días que no tocan no mueven la fuerza; semanales se miden por semana", () => {
  const con = perfectoN(20).rango.fuerza;
  const regs = dias("2025-01-01", 20);
  for (let i = 20; i < 25; i++) regs[E.addDias("2025-01-01", i)] = { e: "saltado", m: "viaje" };
  const r = uno(hab("a", { inicio: "2025-01-01", registros: regs }), "2025-01-26").rango;
  assert.ok(Math.abs(r.fuerza - con) < 1e-9);
  // Semanal 3×: 4 semanas cumplidas ≈ lo mismo que 28 días perfectos de uno diario.
  const semanal = {};
  for (let w = 0; w < 4; w++) [0, 2, 4].forEach(d => { semanal[E.addDias("2025-01-06", w * 7 + d)] = hecho(); });
  const rs = uno(hab("s", { inicio: "2025-01-06", freqType: "semana", timesPerWeek: 3, registros: semanal }), "2025-02-03").rango;
  const rd = uno(hab("d", { inicio: "2025-01-06", registros: dias("2025-01-06", 28) }), "2025-02-03").rango;
  assert.ok(Math.abs(rs.fuerza - rd.fuerza) < 0.5, `${rs.fuerza} vs ${rd.fuerza}`);
});

test("áreas: suman el XP de sus hábitos", () => {
  const r = E.evaluar([hab("a", { area: "mente", registros: dias("2026-09-01", 5) }), hab("b", { area: "cuerpo", registros: dias("2026-09-01", 2) })], { hoy: "2026-09-06" });
  const mente = r.areas.find(a => a.id === "mente");
  assert.equal(mente.xp, r.habitos.a.xp);
  assert.equal(mente.habitos, 1);
  assert.ok(mente.nivel.nivel >= 1);
});

test("monedas: ganadas − gastadas; un comodín comprado protege la racha", () => {
  const regs = Object.assign(dias("2026-09-01", 4), dias("2026-09-06", 3));
  const compras = [{ que: "comodin", precio: 80, t: ms(2026, 9, 2, 10) }, { que: "recompensa", ref: "peli", precio: 150, t: ms(2026, 9, 3, 10) }];
  const r = E.evaluar([hab("a", { registros: regs })], { hoy: "2026-09-09", compras });
  assert.equal(r.monedas.gastadas, 230);
  assert.equal(r.monedas.saldo, r.monedas.ganadas - 230);
  assert.equal(r.habitos.a.racha.actual, 7);
  assert.ok(r.logros.find(l => l.id === "primer_canje").desbloqueado);
});

test("misiones: se generan con tus datos, su progreso se recalcula y dan XP y monedas", () => {
  // 4 semanas leyendo 4 veces por semana; la misión pide un poco más.
  const regs = {};
  for (let w = 0; w < 4; w++) [0, 1, 2, 3].forEach(d => { regs[E.addDias("2026-08-31", w * 7 + d)] = hecho(); });
  const docs = [hab("leer", { inicio: "2026-08-31", name: "Leer", registros: regs })];
  const antes = E.evaluar(docs, { hoy: "2026-09-28" });
  const mis = E.generarMisiones(antes, "2026-09-28");
  assert.equal(mis.length, 3);
  assert.deepEqual(mis, E.generarMisiones(antes, "2026-09-28")); // siempre igual con los mismos datos
  const veces = mis.find(m => m.tipo === "veces");
  assert.equal(veces.meta, 5); // promedio 4 × 1,2 → 5
  assert.ok(mis.some(m => m.tipo === "perfectos"));
  // Cumplir 5 veces esa semana completa la misión.
  for (let d = 0; d < 5; d++) regs[E.addDias("2026-09-28", d)] = hecho();
  const r = E.evaluar(docs, { hoy: "2026-10-02", misiones: { [mis[0].semana]: mis } });
  const m = r.misiones.find(x => x.tipo === "veces");
  assert.equal(m.estado, "completada");
  assert.equal(r.xpDesglose.misiones >= CFG.MISIONES.XP, true);
  const sinMision = E.evaluar(docs, { hoy: "2026-10-02" });
  assert.equal(r.xp - sinMision.xp, r.xpDesglose.misiones);
  assert.ok(r.monedas.ganadas > sinMision.monedas.ganadas);
});

test("logros: se desbloquean desde el historial y los bloqueados muestran progreso", () => {
  const regs = dias("2026-09-07", 7, i => ({ e: "hecho", t: ms(2026, 9, 7 + i, 6, 30) })); // lunes a domingo, a las 6:30
  const r = E.evaluar([hab("a", { inicio: "2026-09-07", registros: regs })], { hoy: "2026-09-14" });
  const L = id => r.logros.find(l => l.id === id);
  assert.ok(L("primer_paso").desbloqueado);
  assert.ok(L("racha_7").desbloqueado);
  assert.ok(L("semana_perfecta").desbloqueado);
  assert.equal(L("madrugador").actual, 7);
  assert.ok(!L("madrugador").desbloqueado);
  assert.equal(L("racha_30").actual, 7);
  assert.ok(L("noctambulo").secreto);
  // Nunca dos veces: cumplir justo después de un fallo
  const nd = E.evaluar([hab("b", { registros: { "2026-09-01": hecho(), "2026-09-03": hecho() } })], { hoy: "2026-09-04" });
  assert.equal(nd.logros.find(l => l.id === "nunca_dos").actual, 1);
});

test("novedades: detecta subidas de nivel, rangos nuevos, logros y días perfectos", () => {
  const docs = [hab("a", { registros: dias("2026-09-01", 7) })];
  const antes = E.snapshot(E.evaluar([hab("a", { registros: dias("2026-09-01", 1) })], { hoy: "2026-09-01" }));
  const ahora = E.snapshot(E.evaluar(docs, { hoy: "2026-09-07" }));
  const tipos = E.novedades(antes, ahora).map(n => n.tipo);
  assert.ok(tipos.includes("nivel"));
  assert.ok(tipos.includes("logro"));
  assert.ok(tipos.includes("perfecto"));
  assert.deepEqual(E.novedades(ahora, ahora), []);
  assert.deepEqual(E.novedades(null, ahora), []); // primera vez: sin aviso
});

// ---------- Fase 3: estadísticas ----------
test("periodos y cumplimiento global (los semanales cuentan por semana)", () => {
  const p = E.periodo("7d", "2026-09-30");
  assert.deepEqual([p.desde, p.hasta, p.previo.desde, p.previo.hasta], ["2026-09-24", "2026-09-30", "2026-09-17", "2026-09-23"]);
  assert.equal(E.periodo("todo", "2026-09-30", "2026-01-01").previo, null);
  // Diario: cumple 5 de 6 días cerrados; hoy pendiente no cuenta.
  const diario = hab("d", { inicio: "2026-09-24", registros: Object.assign(dias("2026-09-24", 3), dias("2026-09-28", 2)) });
  // Semanal 3×: semana del 21 al 27 con 2 de 3 (fallo).
  const semanal = hab("s", { inicio: "2026-09-21", freqType: "semana", timesPerWeek: 3, registros: { "2026-09-22": hecho(), "2026-09-25": hecho() } });
  const r = E.evaluar([diario, semanal], { hoy: "2026-09-30" });
  const c = E.cumplimientoGlobal(r, "2026-09-24", "2026-09-30");
  assert.equal(c.esperados, 6 + 3);
  assert.equal(c.hechos, 5 + 2);
});

test("kpis: comparación contra el periodo anterior", () => {
  const regs = Object.assign(dias("2026-09-10", 7, i => (i % 2 ? hecho() : undefined)), dias("2026-09-17", 7));
  const r = E.evaluar([hab("a", { inicio: "2026-09-10", registros: regs })], { hoy: "2026-09-23" });
  const k = E.kpis(r, E.periodo("7d", "2026-09-23"));
  assert.equal(k.actual.pct, 1);
  assert.ok(Math.abs(k.previo.pct - 3 / 7) < 1e-9);
  assert.ok(k.actual.xp > k.previo.xp);
  assert.equal(k.mejorRacha.racha, 7);
});

test("serie semanal con media móvil", () => {
  const regs = dias("2026-08-31", 28, i => (i < 14 ? (i % 2 ? hecho() : undefined) : hecho()));
  const r = E.evaluar([hab("a", { inicio: "2026-08-31", registros: regs })], { hoy: "2026-09-27" });
  const s = E.serieSemanal(r, 4, 2);
  assert.deepEqual(s.map(x => Math.round(x.pct * 100)), [43, 57, 100, 100]); // días alternos: 3 y 4 de 7
  assert.ok(s[2].media > s[1].media && s[2].media < 1);
});

test("por día de la semana y por momento del día", () => {
  const regs = {};
  for (let w = 0; w < 4; w++) for (let d = 1; d < 7; d++) regs[E.addDias("2026-08-31", w * 7 + d)] = hecho(); // nunca los lunes
  const r = E.evaluar([hab("a", { inicio: "2026-08-31", timeOfDay: "manana", registros: regs })], { hoy: "2026-09-27" });
  const b = E.porDiaSemana(r, "2026-08-31", "2026-09-27");
  assert.equal(b[0].pct, 0);
  assert.equal(b[3].pct, 1);
  assert.equal(E.porMomento(r, "2026-08-31", "2026-09-27").manana.esperados, 28);
  const ins = E.insights(r, E.periodo("30d", "2026-09-27"));
  assert.ok(ins.some(t => t.startsWith("Tu peor día es el lunes (0 %)")), ins.join(" | "));
});

test("en riesgo: nunca dos veces, racha en juego y semana que no alcanza", () => {
  const r = E.evaluar([
    hab("ayer", { registros: dias("2026-09-01", 5) }),                       // falló el 6, hoy es 7
    hab("racha", { registros: dias("2026-09-01", 6) }),                      // 6 días, hoy pendiente
    hab("sem", { inicio: "2026-09-01", freqType: "semana", timesPerWeek: 3, registros: {} }) // lunes 7: 3 de 7 días, justo
  ], { hoy: "2026-09-07" });
  const tipos = E.enRiesgo(r).map(x => `${x.id}:${x.tipo}`);
  assert.ok(tipos.includes("ayer:nuncaDos"));
  assert.ok(tipos.includes("racha:racha"));
  assert.ok(!tipos.some(t => t.startsWith("sem")));
  const tarde = E.evaluar([hab("sem", { inicio: "2026-09-01", freqType: "semana", timesPerWeek: 3, registros: {} })], { hoy: "2026-09-12" });
  assert.equal(E.enRiesgo(tarde)[0].tipo, "semana");
});

test("correlaciones: ánimo con y sin cada hábito, y hábitos que van juntos (solo con 14 días o más)", () => {
  const regsA = {}, regsB = {}, animo = {};
  for (let i = 0; i < 20; i++) {
    const f = E.addDias("2026-09-01", i);
    const ok = i % 3 !== 0;
    if (ok) { regsA[f] = hecho(); regsB[f] = hecho(); }
    animo[f] = { animo: ok ? 4 : 2 };
  }
  const r = E.evaluar([hab("a", { registros: regsA }), hab("b", { registros: regsB })], { hoy: "2026-09-21" });
  const c = E.correlaciones(r, animo);
  assert.ok(c.suficiente);
  assert.equal(c.animo[0].diferencia, 2);
  assert.ok(c.juntos.some(x => x.a === "a" && x.b === "b"));
  const poco = E.correlaciones(r, { "2026-09-01": { animo: 3 } });
  assert.equal(poco.suficiente, false);
  assert.equal(poco.animo.length, 0);
});

test("resumen de la semana pasada", () => {
  const r = E.evaluar([hab("a", { inicio: "2026-09-21", registros: dias("2026-09-21", 5) }), hab("b", { inicio: "2026-09-21", registros: dias("2026-09-21", 2) })], { hoy: "2026-09-28" });
  const s = E.resumenSemana(r, "2026-09-21");
  assert.equal(s.mejor.id, "a");
  assert.equal(s.peor.id, "b");
  assert.ok(Math.abs(s.pct - 7 / 14) < 1e-9);
  assert.ok(s.xp > 0);
});
