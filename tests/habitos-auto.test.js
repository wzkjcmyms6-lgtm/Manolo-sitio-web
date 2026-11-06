const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/habitos-auto.js");
const E = require("../js/habitos-engine.js");

const carreras = [
  { date: "2026-11-03", distance: 5.2, duration: 30 },
  { date: "2026-11-03", distance: 3, duration: 18.5 },
  { date: "2026-11-04", distance: 10, duration: 55 },
  { date: "mal", distance: 1, duration: 1 }
];
const hab = extra => Object.assign({ id: "h", tipo: "sino", vinculo: "running", inicio: "2026-11-01", vinculoDesde: "2026-11-01" }, extra);
const op = { hoy: "2026-11-05", ahora: 1000 };

test("por día: suma lo de cada módulo con sus filtros", () => {
  assert.deepEqual(A.porDia("running", carreras)["2026-11-03"], { n: 2, km: 8.2, min: 48.5, paginas: 0 });
  assert.equal(Object.keys(A.porDia("running", carreras)).length, 2);
  const sesiones = [{ fecha: "2026-11-04", rutinaId: "cuello", duracionSeg: 300 }, { fecha: "2026-11-04", rutinaId: "despues-de-correr", duracionSeg: 600 }];
  assert.equal(A.porDia("movilidad", sesiones)["2026-11-04"].n, 2);
  assert.deepEqual(A.porDia("movilidad", sesiones, { rutina: "cuello" })["2026-11-04"], { n: 1, km: 0, min: 5, paginas: 0 });
  assert.equal(A.porDia("libros", { "2026-11-04": 23, "2026-11-05": 0 })["2026-11-04"].paginas, 23);
  assert.equal(A.porDia("libros", { "2026-11-05": 0 })["2026-11-05"], undefined);
  assert.equal(A.porDia("biblia", [{ fecha: "2026-11-02" }, { fecha: "2026-11-02" }])["2026-11-02"].n, 2);
  const movs = [{ date: "2026-11-04", type: "gasto", category: "antojos" }, { date: "2026-11-04", type: "ingreso", category: "sueldo" }, { date: "2026-11-05", type: "gasto", category: "comida" }];
  assert.equal(A.porDia("finanzas", movs)["2026-11-04"].n, 2);
  assert.deepEqual(Object.keys(A.porDia("gasto", movs, { categoria: "antojos" })), ["2026-11-04"]);
});

test("qué valor toca: Sí/No cuenta si hubo algo; un Medible suma su medida", () => {
  const agg = A.porDia("running", carreras);
  assert.equal(A.valorDia(hab(), agg["2026-11-03"]), 1);
  assert.equal(A.valorDia(hab({ tipo: "medible", vinculoCfg: { medida: "km" } }), agg["2026-11-03"]), 8.2);
  assert.equal(A.valorDia(hab({ tipo: "tiempo" }), agg["2026-11-03"]), 48.5);
  assert.equal(A.valorDia(hab({ tipo: "medible" }), agg["2026-11-03"]), 2); // sin medida: cuántas
  assert.equal(A.valorDia(hab(), undefined), 0);
  assert.deepEqual(A.registro(hab({ tipo: "evitar", vinculo: "gasto" }), 1), { e: "recaida", auto: { f: "gasto", v: 1 } });
});

test("plan: marca lo nuevo, actualiza lo que cambió y no repite lo igual", () => {
  const agg = A.porDia("running", carreras);
  const p = A.plan(hab(), agg, {}, op);
  assert.deepEqual(Object.keys(p.poner), ["2026-11-03", "2026-11-04"]);
  assert.deepEqual(p.poner["2026-11-03"], { e: "hecho", auto: { f: "running", v: 1 }, t: 1000 });
  // Ya marcado igual: nada que hacer.
  assert.deepEqual(A.plan(hab(), agg, p.poner, op), { poner: {}, quitar: [] });
  // Medible de km: otra carrera el mismo día actualiza el total y conserva la hora.
  const km = hab({ tipo: "medible", vinculoCfg: { medida: "km" } });
  const antes = { "2026-11-03": { v: 5.2, t: 500, auto: { f: "running", v: 5.2 } } };
  const p2 = A.plan(km, agg, antes, op);
  assert.deepEqual(p2.poner["2026-11-03"], { v: 8.2, auto: { f: "running", v: 8.2 }, t: 500 });
});

test("lo manual manda y deshacer solo borra lo automático", () => {
  const agg = A.porDia("running", carreras.slice(2)); // borraste las del 3
  const regs = {
    "2026-11-03": { e: "hecho", t: 1, auto: { f: "running", v: 1 } },  // automático: se deshace
    "2026-11-02": { e: "saltado", m: "viaje", t: 1 },                  // manual: se queda
    "2026-11-04": { e: "no", t: 1 }                                    // manual "no hecho": manda aunque corriste
  };
  const p = A.plan(hab(), agg, regs, op);
  assert.deepEqual(p.quitar, ["2026-11-03"]);
  assert.deepEqual(p.poner, {});
  // Sin datos del servidor (solo caché) no se deshace nada.
  assert.deepEqual(A.plan(hab(), {}, regs, Object.assign({ servidor: false }, op)).quitar, []);
  // La nota que hubiera se conserva al actualizar.
  const conNota = { "2026-11-04": { v: 3, t: 9, n: "suave", auto: { f: "running", v: 3 } } };
  assert.equal(A.plan(hab({ tipo: "medible", vinculoCfg: { medida: "km" } }), agg, conNota, op).poner["2026-11-04"].n, "suave");
});

test("solo desde que se vinculó (o desde donde aceptaste rellenar); nada futuro ni archivado", () => {
  const agg = A.porDia("running", carreras.concat([{ date: "2026-10-20", distance: 5, duration: 30 }, { date: "2026-11-09", distance: 5, duration: 30 }]));
  assert.deepEqual(Object.keys(A.plan(hab({ vinculoDesde: "2026-11-04" }), agg, {}, op).poner), ["2026-11-04"]);
  assert.deepEqual(Object.keys(A.plan(hab(), agg, {}, Object.assign({ desde: "2026-10-01" }, op)).poner), ["2026-10-20", "2026-11-03", "2026-11-04"]);
  assert.deepEqual(A.plan(hab({ archivado: true }), agg, {}, op).poner, {});
  assert.deepEqual(A.plan(hab({ vinculo: "gimnasio" }), agg, {}, op).poner, {});
  assert.deepEqual(A.rellenables(hab({ vinculoDesde: "2026-11-05" }), agg, { "2026-11-04": { e: "no" } }, "2026-11-05"), ["2026-10-20", "2026-11-03"]);
});

test("Evitar ligado a una categoría de gasto: el gasto es una recaída; borrarlo la deshace", () => {
  const h = hab({ tipo: "evitar", vinculo: "gasto", vinculoCfg: { categoria: "antojos" } });
  const movs = [{ date: "2026-11-04", type: "gasto", category: "antojos" }, { date: "2026-11-03", type: "gasto", category: "comida" }];
  const p = A.plan(h, A.porDia("gasto", movs, h.vinculoCfg), {}, op);
  assert.deepEqual(Object.keys(p.poner), ["2026-11-04"]);
  assert.equal(p.poner["2026-11-04"].e, "recaida");
  assert.deepEqual(A.plan(h, A.porDia("gasto", [], h.vinculoCfg), p.poner, op).quitar, ["2026-11-04"]);
});

test("el motor lee los registros automáticos como cualquier otro (y rellenar no da XP)", () => {
  const agg = A.porDia("running", carreras);
  const ahora = new Date(2026, 10, 5, 9).getTime();
  const p = A.plan(hab({ tipo: "medible", meta: 5, vinculoCfg: { medida: "km" } }), agg, {}, { hoy: "2026-11-05", ahora, desde: "2026-11-01" });
  const r = E.evaluar([{ id: "h", tipo: "medible", meta: 5, unidad: "km", inicio: "2026-11-01", registros: p.poner }], { hoy: "2026-11-05" });
  assert.equal(r.habitos.h.dias["2026-11-03"].clase, "cumple");
  assert.equal(r.habitos.h.dias["2026-11-04"].valor, 10);
  // Marcado el 5: el 4 está dentro de las 48 h (da XP); un día de hace 2 semanas, no.
  assert.ok(r.habitos.h.dias["2026-11-04"].xp > 0);
  const viejo = A.plan(hab({ tipo: "sino" }), { "2026-10-20": { n: 1 } }, {}, { hoy: "2026-11-05", ahora, desde: "2026-10-01" });
  const r2 = E.evaluar([{ id: "h", inicio: "2026-10-20", registros: viejo.poner }], { hoy: "2026-11-05" });
  assert.equal(r2.habitos.h.dias["2026-10-20"].clase, "cumple");
  assert.equal(r2.habitos.h.dias["2026-10-20"].xp, 0);
});

test("sugiere vincular un hábito por su nombre (Correr → Running…)", () => {
  const s = (name, extra) => A.sugerirVinculo(Object.assign({ name, tipo: "sino" }, extra));
  assert.equal(s("Correr").fuente, "running");
  assert.equal(s("Salir a correr 🏃").fuente, "running");
  assert.equal(s("Trotar en la mañana").fuente, "running");
  assert.equal(s("Leer la Biblia").fuente, "biblia", "la Biblia antes que Libros");
  assert.equal(s("Leer 30 páginas").fuente, "libros");
  assert.equal(s("Versículo del día").fuente, "biblia");
  assert.equal(s("Estiramientos").fuente, "movilidad");
  assert.equal(s("Ir al gimnasio").fuente, "gimnasio");
  assert.equal(s("Bici").fuente, "bicicleta");
  assert.equal(s("Meditar"), null);
  assert.equal(s("Correr", { vinculo: "running" }), null, "ya vinculado");
  assert.equal(s("Correr", { archivado: true }), null);
  assert.equal(s("No correr riesgos", { tipo: "evitar" }), null, "Evitar no");
  assert.equal(s("Scalping", { id: "scalping" }), null);
  assert.deepEqual(s("Correr", { tipo: "medible", unidad: "km" }).cfg, { medida: "km", rutina: null, categoria: null });
  assert.equal(s("Leer", { tipo: "medible", unidad: "páginas" }).cfg.medida, "paginas");
  assert.equal(s("Correr", { tipo: "medible", unidad: "veces" }).cfg.medida, "n");
  assert.equal(s("Leer", { tipo: "tiempo" }), null, "Libros no da minutos");
  assert.equal(s("Correr", { tipo: "tiempo" }).fuente, "running");
});
