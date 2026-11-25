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
    dinero: { estado: "verde", dias: 12, disponibleDia: "Bs 100", quedaDia: "Bs 85", pasado: null },
    running: { kmSemana: 24, meta: 30, manana: null }
  });
  assert.deepEqual(fs.map(f => [f.id, f.estado, f.href]), [
    ["entreno", "aviso", "#ejercicio"], ["habitos", "pendiente", "#habitos"], ["biblia", "pendiente", "#biblia"],
    ["dinero", "libre", "#finanzas"], ["running", "libre", "#running"]]);
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
  assert.deepEqual(M.filas({ habitos: { hechos: 0, total: 0 }, biblia: { total: 0 }, dinero: { estado: "vacio", dias: 10 }, running: { kmSemana: 0 } }), []);
  const sin = M.filas({ dinero: { estado: "rojo", dias: 1, disponibleDia: "Bs 100", quedaDia: "−Bs 50", pasado: "Bs 50" } })[0];
  assert.deepEqual([sin.titulo, sin.estado, sin.detalle, sin.href], ["Gastaste más de lo que entró", "aviso", "Te pasaste Bs 50. Queda 1 día del mes.", "#finanzas"]);
  const ambar = M.filas({ dinero: { estado: "ambar", dias: 10, disponibleDia: "Bs 100", quedaDia: "Bs 80", pasado: null } })[0];
  assert.deepEqual([ambar.titulo, ambar.estado, ambar.detalle], ["Para gastar hoy: Bs 80", "aviso", "Vas más rápido de lo ideal (disponible: Bs 100 por día). Quedan 10 días del mes."]);
  assert.equal(M.filas({ dinero: { estado: "cerrado", dias: 0 } }).length, 0, "mes cerrado: no aparece"); 
  assert.equal(M.titular([sin]), "Hay algo que mirar hoy.");
});

test("filas: Biblia cuenta los capítulos leídos y el plan de hoy (D-106)", () => {
  const b = x => M.filas({ biblia: x })[0];
  const leida = b({ hoyHecho: true, actual: 4, total: 10, cita: "", capsHoy: 2 });
  assert.deepEqual([leida.titulo, leida.detalle, leida.estado], ["Biblia leída hoy", "2 capítulos. 4 días seguidos.", "hecho"]);
  assert.equal(b({ hoyHecho: true, actual: 1, total: 1, cita: "", capsHoy: 1 }).detalle, "1 capítulo.");
  // Con versículo anotado manda el versículo, aunque también haya leído.
  assert.equal(b({ hoyHecho: true, actual: 2, total: 5, cita: "Salmos 23:1", capsHoy: 3 }).titulo, "Versículo de hoy anotado");
  const plan = b({ hoyHecho: false, actual: 6, total: 20, cita: "", plan: { nombre: "Evangelios en 30 días", texto: "Juan 3-4" } });
  assert.deepEqual([plan.titulo, plan.detalle, plan.estado], ["Lectura de hoy: Juan 3-4", "Evangelios en 30 días. Llevas 6 días seguidos.", "pendiente"]);
  assert.equal(b({ hoyHecho: false, actual: 0, total: 3, plan: { nombre: "Proverbios del día", texto: "Proverbios 14" } }).detalle, "Proverbios del día.");
});

test("fase 7 (D-114): mi mañana, el libro que lees y el repaso de hoy", () => {
  const curso = M.filas({ manana: { estado: "curso", paso: 2, de: 5, nombre: "Desayunar", vsPlan: 300 } })[0];
  assert.deepEqual([curso.id, curso.titulo, curso.detalle, curso.estado, curso.href], ["manana", "Mi mañana: paso 2 de 5", "Vas 5 min atrasado según tu plan.", "aviso", "#tiempos"]);
  assert.equal(M.filas({ manana: { estado: "curso", paso: 1, de: 5, nombre: "Rutina", vsPlan: -120 } })[0].detalle, "Vas 2 min adelantado según tu plan.");
  assert.equal(M.filas({ manana: { estado: "curso", paso: 1, de: 5, nombre: "Rutina", vsPlan: null } })[0].detalle, "Ahora: Rutina.");
  const hecha = M.filas({ manana: { estado: "hecha", total: 5700, dif: -180 } })[0];
  assert.deepEqual([hecha.titulo, hecha.detalle, hecha.estado], ["Mi mañana: lista", "1 h 35 min · 3 min menos que tu promedio.", "hecho"]);
  assert.equal(M.filas({ manana: { estado: "pendiente", listo: "8:00" } })[0].detalle, "Tu plan: listo a las 8:00.");
  const libro = M.filas({ libro: { titulo: "Hábitos atómicos", paginasHoy: 12, meta: 30 } })[0];
  assert.deepEqual([libro.titulo, libro.detalle, libro.estado], ["Leyendo: Hábitos atómicos", "12 de 30 páginas hoy.", "pendiente"]);
  assert.equal(M.filas({ libro: { titulo: "x", paginasHoy: 31, meta: 30 } })[0].estado, "hecho");
  const rep = M.filas({ repaso: { frases: 3, versiculos: 2 } })[0];
  assert.deepEqual([rep.detalle, rep.href], ["3 frases y 2 versículos para repasar.", "#libros"]);
  assert.equal(M.filas({ repaso: { frases: 0, versiculos: 1 } })[0].href, "#biblia-memorizar");
  assert.equal(M.filas({ repaso: { frases: 0, versiculos: 0 } }).length, 0);
});

test("fase 7: como mucho 5 filas, primero lo que hay que hacer hoy", () => {
  const fs = M.filas({
    manana: { estado: "hecha", total: 5400, dif: 0 },
    ejercicio: { tipo: "descanso", razones: ["Hoy toca descansar."] },
    habitos: { hechos: 1, total: 3, pendientes: [{ nombre: "Agua" }, { nombre: "Orar" }] },
    biblia: { hoyHecho: false, actual: 3, total: 10 },
    libro: { titulo: "Sapiens", paginasHoy: 0, meta: 30 },
    repaso: { frases: 2, versiculos: 0 },
    dinero: { estado: "verde", dias: 5, disponibleDia: "Bs 30", quedaDia: "Bs 20", pasado: null },
    running: { kmSemana: 10, meta: 0, manana: null }
  });
  assert.equal(fs.length, 5);
  assert.deepEqual(fs.map(f => f.id), ["manana", "habitos", "biblia", "libro", "repaso"], "quedan los pendientes y lo hecho de hoy; se van el descanso, el dinero y Running (libres)");
});

test("pago de la tarjeta que vence pronto: todo + seguros y mantenimiento (D-165)", () => {
  const una = M.filas({ tarjetas: [{ nombre: "Visa BNB", falta: "Bs 1.234,50", faltaCent: 123450, dias: 1, cargos: true }] });
  const f = una.find(x => x.id === "tarjeta");
  assert.equal(f.titulo, "Pago de Visa BNB: Bs 1.234,50");
  assert.equal(f.detalle, "Vence mañana. Págala completa para no pagar intereses. Incluye seguros y mantenimiento.");
  assert.equal(f.estado, "pendiente");
  assert.equal(f.href, "#fin-tarjetas");
  assert.equal(M.filas({ tarjetas: [{ nombre: "Visa", falta: "Bs 50", faltaCent: 5000, dias: 0 }] }).find(x => x.id === "tarjeta").detalle, "Vence hoy. Págala completa para no pagar intereses.", "sin cargos, no los nombra");
  const dos = M.filas({ tarjetas: [{ nombre: "Master", falta: "Bs 100", faltaCent: 10000, dias: 3 }, { nombre: "Visa", falta: "Bs 50", faltaCent: 5000, dias: 2 }] }).find(x => x.id === "tarjeta");
  assert.equal(dos.titulo, "Pagos de 2 tarjetas");
  assert.equal(dos.detalle, "Vence en 2 días el de Visa (Bs 50). Págalas completas para no pagar intereses.");
  assert.equal(dos.estado, "aviso");
  assert.equal(M.filas({ tarjetas: [] }).find(x => x.id === "tarjeta"), undefined);
  assert.equal(M.filas({ tarjetas: [{ nombre: "Visa", falta: "Bs 0", faltaCent: 0, dias: 1 }] }).find(x => x.id === "tarjeta"), undefined, "al día: nada");
});
