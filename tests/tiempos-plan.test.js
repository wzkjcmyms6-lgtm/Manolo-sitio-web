// Medir tiempos: plan de la mañana (js/tiempos-plan.js, D-114).
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/tiempos-plan.js");

test("horas", () => {
  assert.deepEqual([P.horaOk("5:30"), P.horaOk("05:30"), P.horaOk("24:00"), P.horaOk("7:5")], [true, true, false, false]);
  assert.deepEqual([P.aSeg("5:30"), P.aHora(19800), P.aHora(19800 + 1530), P.aHora(-60)], [19800, "5:30", "5:56", "23:59"]);
  assert.equal(P.validar({ levantarse: "8:00", listo: "7:00" }).error, "La hora de estar listo tiene que ser después de levantarte.");
  assert.equal(P.validar({ levantarse: "", listo: "7:00" }).error, "Pon las dos horas (por ejemplo 5:30 y 8:00).");
});

test("tus medianas y qué pasos sueles hacer ese día de la semana", () => {
  // Lunes 2, 9 y 16 de noviembre: ejercicio dos lunes; correr solo uno.
  const ds = [
    { fecha: "2026-11-02", seg: { manana: 1500, ejercicio: 3600, desayunar: 900 } },
    { fecha: "2026-11-09", seg: { manana: 1700, ejercicio: 3300, correr: 2000, desayunar: 800 } },
    { fecha: "2026-11-11", seg: { manana: 1600, correr: 2400 } },
    { fecha: "2026-11-16", seg: { manana: 1600, desayunar: 1000 } }
  ];
  const t = P.tiempos(ds, ["manana", "ejercicio", "correr", "desayunar", "leer"]);
  assert.deepEqual(t.manana, { mediana: 1600, mejor: 1500, n: 4 });
  assert.equal(t.leer, undefined);
  assert.deepEqual(P.pasosDelDia(ds, ["manana", "ejercicio", "correr", "desayunar"], 1), ["manana", "ejercicio", "desayunar"], "los lunes: correr no (1 de 3)");
  assert.deepEqual(P.pasosDelDia(ds, ["manana", "correr"], 4), ["manana", "correr"], "sin historia de jueves: todos");
});

test("la línea de tiempo: si sobra o falta, dónde se va más y dónde ahorrar", () => {
  const pasos = [{ id: "manana", nombre: "Rutina" }, { id: "desayunar", nombre: "Desayunar" }, { id: "banarse", nombre: "Bañarse" }, { id: "leer", nombre: "Leer" }];
  const t = { manana: { mediana: 1500, mejor: 1200, n: 30 }, desayunar: { mediana: 900, mejor: 840, n: 30 }, banarse: { mediana: 1500, mejor: 900, n: 30 } };
  const p = P.plan({ levantarse: "5:30", listo: "6:45" }, pasos, t);
  assert.deepEqual(p.linea.map(x => [x.id, x.desde, x.hasta]), [["manana", "5:30", "5:55"], ["desayunar", "5:55", "6:10"], ["banarse", "6:10", "6:35"], ["leer", "6:35", "6:35"]]);
  assert.deepEqual([p.disponible, p.necesario, p.sobra, p.termina], [4500, 3900, 600, "6:35"], "te sobran 10 min");
  assert.deepEqual(p.faltanDatos, ["leer"], "leer todavía sin datos");
  assert.deepEqual([p.mayor.id, p.mayor.pct], ["manana", 38], "donde más se te va (empate: la primera)");
  assert.deepEqual([p.ahorro.id, p.ahorro.seg], ["banarse", 600], "bañarte: 10 min más que tus mejores días");
  const corto = P.plan({ levantarse: "5:30", listo: "6:00" }, pasos, t);
  assert.equal(corto.sobra, -2100, "te faltan 35 min");
  // Contra tu plan.
  assert.equal(P.adelanto(p, "desayunar", P.aSeg("6:13")), 180, "cerraste desayunar 3 min tarde");
  assert.equal(P.adelanto(p, "otra", P.aSeg("6:13")), null);
  assert.equal(P.contraListo({ listo: "6:45" }, P.aSeg("6:40")), -300, "listo 5 min antes");
  // En vivo: desayunar va de 5:55 a 6:10.
  assert.deepEqual([P.vsAhora(p, "desayunar", P.aSeg("5:50")), P.vsAhora(p, "desayunar", P.aSeg("6:00")), P.vsAhora(p, "desayunar", P.aSeg("6:14")), P.vsAhora(p, "otra", 1)],
    [-300, 0, 240, null], "adelantado 5 min, a tiempo, atrasado 4 min");
});
