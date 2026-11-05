// Dificultad de Hábitos (Temporada 2, D-080). Simula con el motor real
// (tests/habitos-sim.js) la tabla que pidió el dueño.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./habitos-sim.js");
const CFG = require("../js/habitos-config.js");
const E = S.E;
const rango = r => (r.tieneRango ? E.NIVELES[r.nivel].rango.nombre : "Sin rango");
const RANGO_DE = n => n.replace(/ (I|II|III)$/, "");

test("diario al 100 %: Hierro en 1 semana, Bronce al mes, Oro a los 3, Esmeralda a los 6, Diamante al año", () => {
  const tabla = { 7: "Hierro", 30: "Bronce", 90: "Oro", 180: "Esmeralda", 365: "Diamante" };
  Object.keys(tabla).forEach(n => assert.equal(rango(S.rangoTras(Array(Number(n)).fill(true))), tabla[n], `${n} días`));
  // Campeón e Inquebrantable solo con casi todo cumplido y el máximo pide ~1,5 años de historia.
  assert.equal(rango(S.rangoTras(Array(420).fill(true))), "Campeón");
  assert.equal(rango(S.rangoTras(Array(530).fill(true))), "Campeón");
  assert.equal(rango(S.rangoTras(Array(545).fill(true))), "Inquebrantable");
  assert.equal(CFG.FUERZA.MIN_DIAS_MAXIMO, 540);
});

test("techo según constancia (diario): 50 % Bronce · 70 % Plata · 80 % Oro · 90 % Rubí · 95 % Esmeralda · 98 % Diamante", () => {
  const tabla = { 0.5: "Bronce", 0.7: "Plata", 0.8: "Oro", 0.9: "Rubí", 0.95: "Esmeralda", 0.98: "Diamante" };
  Object.keys(tabla).forEach(p => assert.equal(RANGO_DE(S.techo(Number(p)).nombre), tabla[p], `${p * 100} % parejo`));
  // Al azar (con rachas buenas y malas) queda en ese rango o a una división.
  const division = nombre => E.NIVELES.find(n => n.nombre === nombre).idx;
  [0.7, 0.8, 0.9, 0.95].forEach(p => [13, 26, 39, 52].forEach(semilla => {
    const d = division(S.techo(p, { azar: true, semilla }).nombre);
    const rango = E.NIVELES.filter(n => n.rango.nombre === tabla[p]).map(n => n.idx);
    assert.ok(d >= rango[0] - 1 && d <= rango[rango.length - 1] + 1, `${p * 100} % al azar (${semilla}): ${E.NIVELES[d].nombre}`);
  }));
  // El 100 % sostenido llega al máximo; nada por debajo del 98 % pasa de Diamante.
  assert.equal(RANGO_DE(S.techo(1).nombre), "Inquebrantable");
  // La fórmula del techo (la que se muestra en el detalle) coincide con la simulación.
  const h = E.normalizar({ id: "a" }, "a");
  Object.keys(tabla).forEach(p => assert.equal(E.NIVELES[E.techoRango(h, Number(p))].rango.nombre, tabla[p], `techoRango ${p}`));
  assert.ok(E.constanciaPara(h, E.NIVELES.find(n => n.rango.id === "rubi").idx) > 0.83);
});

function semanal(p, semanas, veces) {
  const ses = S.patron(p, semanas * veces);
  const dias = [];
  const toca = [0, 2, 4, 6, 1, 3, 5].slice(0, veces);
  for (let w = 0; w < semanas; w++) for (let d = 0; d < 7; d++) {
    const i = toca.indexOf(d);
    dias.push(i >= 0 ? ses[w * veces + i] : false);
  }
  return dias;
}
function techoSemanal(p, veces) {
  const r = S.rangoTras(semanal(p, 160, veces), { freqType: "semana", timesPerWeek: veces });
  const cuenta = {};
  r.serie.slice(-52).forEach(x => { cuenta[x.nivel] = (cuenta[x.nivel] || 0) + 1; });
  return E.NIVELES[Number(Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0])].rango.nombre;
}

test("semanales y cada N días: la misma exigencia, en proporción", () => {
  const tiempo = { 1: "Hierro", 4: "Bronce", 13: "Oro", 26: "Esmeralda", 52: "Diamante" };
  Object.keys(tiempo).forEach(w => {
    const r = S.rangoTras(semanal(1, Number(w), 3), { freqType: "semana", timesPerWeek: 3 });
    assert.equal(rango(r), tiempo[w], `3 por semana, ${w} semanas`);
  });
  // Una semana incompleta pesa como los días fallados (se cuenta cada sesión).
  const techo = { 0.5: "Bronce", 0.7: "Plata", 0.8: "Oro", 0.9: "Rubí", 0.95: "Esmeralda" };
  Object.keys(techo).forEach(p => assert.equal(techoSemanal(Number(p), 3), techo[p], `3 por semana al ${p * 100} %`));
  assert.ok(["Diamante", "Campeón"].includes(techoSemanal(0.98, 3)));
  assert.equal(techoSemanal(0.8, 5), "Oro");
  // Cada 2 días y días específicos: el tiempo de calendario manda.
  const cada2 = n => rango(S.rangoTras(Array.from({ length: n }, (_, i) => i % 2 === 0), { freqType: "cadaN", cadaN: 2 }));
  assert.deepEqual([30, 90, 180, 365].map(cada2), ["Bronce", "Oro", "Esmeralda", "Diamante"]);
  const lmv = n => rango(S.rangoTras(Array.from({ length: n }, (_, i) => [0, 2, 4].includes(i % 7)), { freqType: "dias", days: [true, false, true, false, true, false, false] }));
  assert.deepEqual([91, 182].map(lmv), ["Oro", "Esmeralda"]);
});

test("un fallo aislado nunca baja de división (en ningún rango); tres seguidos sí", () => {
  for (let n = 5; n <= 640; n += 7) {
    const antes = S.rangoTras(Array(n).fill(true)).nivel;
    const uno = S.rangoTras(Array(n).fill(true).concat([false], Array(30).fill(true)));
    const minimo = Math.min(...uno.serie.slice(n).map(x => x.nivel));
    assert.ok(minimo >= antes, `tras ${n} días: ${E.NIVELES[antes].nombre} → ${E.NIVELES[minimo].nombre}`);
    if (antes === 0) continue;
    const tres = S.rangoTras(Array(n).fill(true).concat([false, false, false]));
    assert.ok(tres.nivel < antes, `tres fallos tras ${n} días siguen en ${E.NIVELES[tres.nivel].nombre}`);
    // No "vuelve a subir" con un día: hacen falta tres cumplidos seguidos.
    const vuelta = S.rangoTras(Array(n).fill(true).concat([false, false, false, true, true]));
    assert.ok(vuelta.nivel < antes, `tras ${n} días: volvió a ${E.NIVELES[vuelta.nivel].nombre} con dos días`);
  }
  // Semanal: una semana incompleta suelta no baja; tres semanas fallidas seguidas sí.
  const base = semanal(1, 30, 3);
  const antes = S.rangoTras(base, { freqType: "semana", timesPerWeek: 3 }).nivel;
  const unaMala = base.concat(semanal(2 / 3, 1, 3), semanal(1, 4, 3));
  const r1 = S.rangoTras(unaMala, { freqType: "semana", timesPerWeek: 3 });
  assert.ok(Math.min(...r1.serie.slice(30).map(x => x.nivel)) >= antes);
  const tresMalas = base.concat(semanal(0, 3, 3));
  assert.ok(S.rangoTras(tresMalas, { freqType: "semana", timesPerWeek: 3 }).nivel < antes);
});

test("saltados, pausas y comodines no cuentan como fallos para el rango", () => {
  const regs = {};
  for (let i = 0; i < 120; i++) regs[E.addDias(S.INICIO, i)] = { e: "hecho" };
  for (let i = 120; i < 126; i++) regs[E.addDias(S.INICIO, i)] = { e: "saltado", m: "viaje" };
  const r = E.evaluar([{ id: "a", inicio: S.INICIO, registros: regs }], { hoy: E.addDias(S.INICIO, 126) }).habitos.a.rango;
  assert.equal(r.nivel, S.rangoTras(Array(120).fill(true)).nivel);
  // Un comodín protege la racha, no el rango: el día cuenta como fallo para la fuerza.
  const conComodin = Object.assign({}, regs);
  for (let i = 120; i < 126; i++) delete conComodin[E.addDias(S.INICIO, i)];
  conComodin[E.addDias(S.INICIO, 121)] = { e: "hecho" };
  const compras = [{ que: "comodin", precio: 350, t: new Date(2025, 0, 6).getTime() }];
  const rc = E.evaluar([{ id: "a", inicio: S.INICIO, registros: Object.assign({}, regs, { [E.addDias(S.INICIO, 120)]: undefined }) }], { hoy: E.addDias(S.INICIO, 121), compras }).habitos.a;
  assert.equal(rc.racha.actual > 0, true);
  assert.ok(rc.rango.fuerza < S.rangoTras(Array(121).fill(true)).fuerza);
});

test("la versión mínima y los parciales suman menos que cumplir", () => {
  const con = estado => {
    const regs = {};
    for (let i = 0; i < 60; i++) regs[E.addDias(S.INICIO, i)] = i % 2 ? { e: "hecho" } : { e: estado };
    return E.evaluar([{ id: "a", inicio: S.INICIO, registros: regs }], { hoy: E.addDias(S.INICIO, 60) }).habitos.a.rango.fuerza;
  };
  const todo = S.rangoTras(Array(60).fill(true)).fuerza;
  assert.ok(con("minima") < todo * 0.8, `mínima ${con("minima")} vs ${todo}`);
  assert.ok(con("parcial") < con("minima"));
  assert.equal(CFG.FUERZA.MINIMA, 0.5);
});

test("nivel del jugador (5 hábitos al 80 %, con misiones y jefes): 2 en días, ~5 al mes, ~10 a los 6 meses, ~15 al año, ~20 a los 2 años", () => {
  const j = S.jugador(0.8, [3, 30, 180, 365, 730]);
  assert.ok(j[3].nivel >= 2, `3 días: ${j[3].nivel}`);
  assert.ok(j[30].nivel >= 4 && j[30].nivel <= 6, `mes: ${j[30].nivel}`);
  assert.ok(j[180].nivel >= 9 && j[180].nivel <= 12, `6 meses: ${j[180].nivel}`);
  assert.ok(j[365].nivel >= 13 && j[365].nivel <= 17, `año: ${j[365].nivel}`);
  assert.ok(j[730].nivel >= 18 && j[730].nivel <= 22, `2 años: ${j[730].nivel}`);
  // Los títulos altos son de años: Maestro (25) pide más de 2 años al 80 %.
  assert.ok(E.xpParaNivel(25) > j[730].xp);
  // Comodín: con ~100 monedas por semana, uno cada 3–4 semanas.
  const porSemana = j[365].monedas / 52;
  const semanas = CFG.TIENDA.COMODIN / porSemana;
  assert.ok(semanas >= 3 && semanas <= 4, `un comodín cada ${semanas.toFixed(1)} semanas`);
});

test("nivel de una categoría: ~5 a los 2–3 meses y ~10 al año (2 hábitos al 85 %)", () => {
  const nivel = n => {
    const rnd = S.azar(5);
    const docs = [0, 1].map(i => Object.assign(S.habito("m" + i, Array.from({ length: n }, () => rnd() < 0.85)), { area: "mente" }));
    return E.evaluar(docs, { hoy: E.addDias(S.INICIO, n) }).areas.find(a => a.id === "mente").nivel.nivel;
  };
  const tres = nivel(75), anio = nivel(365);
  assert.ok(tres >= 4 && tres <= 6, `2–3 meses: ${tres}`);
  assert.ok(anio >= 9 && anio <= 11, `año: ${anio}`);
});

test("explicar el rango y el nivel: techo, constancia necesaria y días para subir", () => {
  // 90 días al 82 % (parejo): techo Oro; para Rubí (I) hace falta ~85 %.
  const dias = S.patron(0.82, 90);
  const r = E.evaluar([S.habito("a", dias)], { hoy: E.addDias(S.INICIO, 90) });
  const x = E.explicarRango(r.habitos.a, r.hoy);
  assert.ok(Math.abs(x.constancia - 0.82) < 0.02);
  assert.equal(E.NIVELES[x.techo].rango.nombre, "Oro");
  assert.equal(x.proximoRango.nombre, "Rubí");
  assert.ok(x.proximoRango.constancia > 0.83 && x.proximoRango.constancia < 0.9, `${x.proximoRango.constancia}`);
  assert.ok(x.diasSiguiente > 0 && x.diasSiguiente < 60, `${x.diasSiguiente} días`);
  // Días hasta la división: cumpliendo todo, llega justo en esos días.
  const perfecto = E.evaluar([S.habito("a", Array(30).fill(true))], { hoy: E.addDias(S.INICIO, 30) }).habitos.a;
  const n = E.diasParaDivision(perfecto.habito, perfecto, perfecto.rango.siguiente.idx);
  const tras = S.rangoTras(Array(30 + n).fill(true));
  assert.equal(tras.nivel, perfecto.rango.siguiente.idx);
  assert.equal(S.rangoTras(Array(30 + n - 1).fill(true)).nivel, perfecto.rango.nivel);
  // Nivel: lo que falta y a qué ritmo.
  const j = E.explicarNivel(r);
  assert.equal(j.falta, r.nivel.hasta - r.xp);
  assert.ok(j.ritmo > 0 && j.dias > 0);
});
