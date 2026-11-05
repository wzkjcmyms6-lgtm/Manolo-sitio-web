// "Mi día" en Inicio (js/mi-dia-motor.js, D-100).
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/mi-dia-motor.js");

const RUT = { empuje: { id: "empuje", name: "Empuje" }, pierna: { id: "pierna", name: "Pierna" } };

test("filas: entrenar, hábitos, Biblia, dinero y Running, con su estado y a dónde llevan", () => {
  const fs = M.filas({
    ejercicio: { tipo: "cambio", rutina: RUT.empuje, plan: RUT.pierna, razones: ["Ayer corriste 18 km: tus piernas necesitan recuperarse."] },
    habitos: { hechos: 3, total: 7, pendientes: [{ nombre: "Leer" }, { nombre: "Agua" }, { nombre: "Scalping" }, { nombre: "Orar" }] },
    biblia: { hoyHecho: false, actual: 12, total: 40 },
    dinero: { dias: 12, resultado: 1020, texto: "Bs 85", conPresupuesto: true },
    running: { kmSemana: 24, meta: 30, manana: null }
  });
  assert.deepEqual(fs.map(f => [f.id, f.estado, f.href]), [
    ["entreno", "aviso", "#ejercicio"], ["habitos", "pendiente", "#habitos"], ["biblia", "pendiente", "#biblia"],
    ["dinero", "libre", "#fin-presupuesto"], ["running", "libre", "#running"]]);
  assert.equal(fs[0].titulo, "Mejor hoy: Empuje");
  assert.equal(fs[0].detalle, "En vez de Pierna. Ayer corriste 18 km: tus piernas necesitan recuperarse.");
  assert.equal(fs[1].detalle, "Faltan: Leer, Agua, Scalping y 1 más.");
  assert.equal(M.filas({ habitos: { hechos: 0, total: 2, pendientes: [{ nombre: "Leer" }, { nombre: "Agua" }] } })[0].detalle, "Faltan: Leer y Agua.");
  assert.equal(M.filas({ running: { kmSemana: 6, meta: 0, manana: null, ultima: { cuando: "ayer", km: 18 } } })[0].detalle, "Última: ayer, 18 km.");
  assert.equal(fs[2].detalle, "Llevas 12 días seguidos: no cortes la racha.");
  assert.equal(fs[3].titulo, "Para gastar hoy: Bs 85");
  assert.equal(fs[4].titulo, "Running: 24 de 30 km esta semana");
  assert.equal(fs[4].detalle, "Te faltan 6 km para tu meta.");
  assert.equal(M.titular(fs), "Te quedan 2 cosas por hoy.");
});

test("filas: cada caso del entreno y lo hecho", () => {
  const e = r => M.filas({ ejercicio: r })[0];
  assert.equal(e({ tipo: "plan", rutina: RUT.pierna, razones: ["Músculos listos: cuádriceps."] }).titulo, "Entrenar: Pierna");
  assert.deepEqual([e({ tipo: "hecho", plan: RUT.pierna, razones: [] }).estado, e({ tipo: "hecho", plan: null, razones: [] }).detalle], ["hecho", "Ahora a recuperarse."]);
  assert.equal(e({ tipo: "extra", rutina: RUT.empuje, razones: ["Hoy no tienes rutina en tu plan.", "Te completa lo que falta de pecho esta semana."] }).detalle, "Te completa lo que falta de pecho esta semana.");
  assert.deepEqual([e({ tipo: "movilidad", razones: ["Todo cansado."] }).href, e({ tipo: "descanso", razones: ["Descansar también es entrenar."] }).titulo], ["#movilidad", "Día de descanso"]);
  const listo = M.filas({
    habitos: { hechos: 5, total: 5, pendientes: [] },
    biblia: { hoyHecho: true, actual: 3, total: 9, cita: "Juan 3:16" },
    running: { kmSemana: 31, meta: 30, manana: { dia: "domingo", km: 14, dura: true } }
  });
  assert.deepEqual(listo.map(f => f.estado), ["hecho", "hecho", "hecho"]);
  assert.equal(listo[1].detalle, "Juan 3:16. 3 días seguidos.");
  assert.equal(listo[2].detalle, "Mañana (domingo) sueles correr 14 km: hoy, piernas tranquilas.");
  assert.equal(M.titular(listo), "Todo en orden por hoy.");
});

test("filas: sin datos de una sección no aparece; sin margen es un aviso", () => {
  assert.deepEqual(M.filas({}), []);
  assert.equal(M.titular([]), "");
  assert.deepEqual(M.filas({ habitos: { hechos: 0, total: 0 }, biblia: { total: 0 }, dinero: { conPresupuesto: false, dias: 10 }, running: { kmSemana: 0 } }), []);
  const sin = M.filas({ dinero: { dias: 1, resultado: -50, texto: "Bs 0", conPresupuesto: true } })[0];
  assert.deepEqual([sin.titulo, sin.estado, sin.detalle], ["Sin margen para gastar", "aviso", "Queda 1 día del periodo. Mira tu presupuesto."]);
  assert.equal(M.titular([sin]), "Hay algo que mirar hoy.");
});
