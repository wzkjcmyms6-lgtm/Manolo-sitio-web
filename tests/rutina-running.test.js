const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/rutina-running.js");
const { leerCsv } = require("../js/importar-rutinas.js");

const desde = (csv, nombre) => R.desdeTexto(csv, { nombre }, leerCsv);

test("CSV válido del ejemplo: orden, tipo, duración y descripción", () => {
  const r = desde("orden,tipo,duracion,descripcion\n1,caminar,180,\"Calentamiento\"\n2,correr,120,\"Correr suave\"\n3,caminar,180,\"Recuperación\"\n4,correr,120,\"Correr\"\n", "Mi rutina.csv");
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.rutina.nombre, "Mi rutina");
  assert.deepEqual(r.rutina.intervalos.map(x => `${x.tipo}:${x.seg}`), ["caminar:180", "correr:120", "caminar:180", "correr:120"]);
  assert.equal(r.rutina.intervalos[2].texto, "Recuperación");
  assert.equal(r.rutina.totalSeg, 600);
  assert.equal(R.resumen(r.rutina), "4 intervalos · 10 min");
});

test("formatos de duración y sinónimos de tipo", () => {
  assert.deepEqual(R.leerDuracion("3:00"), { seg: 180 });
  assert.deepEqual(R.leerDuracion("1:02:03"), { seg: 3723 });
  assert.deepEqual(R.leerDuracion("3 min"), { seg: 180 });
  assert.deepEqual(R.leerDuracion("1,5 min"), { seg: 90 });
  assert.deepEqual(R.leerDuracion("2m30s"), { seg: 150 });
  assert.deepEqual(R.leerDuracion("90 seg"), { seg: 90 });
  assert.deepEqual(R.leerDuracion("4", "min"), { seg: 240 }, "columna «minutos»");
  assert.deepEqual(R.leerDuracion(0.0020833333), { seg: 180 }, "hora de Excel (3:00)");
  assert.ok(R.leerDuracion("rápido").error);
  assert.equal(R.leerTipo("Caminata"), "caminar");
  assert.equal(R.leerTipo("TROTE suave"), "trotar");
  assert.equal(R.leerTipo("Run"), "correr");
  assert.equal(R.leerTipo("calentamiento"), null);
});

test("punto y coma, BOM, comillas con comas y tildes/ñ", () => {
  const r = desde("﻿Orden;Tipo;Duración;Descripción\n1;Caminar;3:00;\"Suave, sin apuro\"\n2;Correr;2 min;Señal: ¡más rápido!\n");
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.rutina.intervalos[0].texto, "Suave, sin apuro");
  assert.equal(r.rutina.intervalos[1].texto, "Señal: ¡más rápido!");
});

test("sin fila de títulos también se entiende", () => {
  assert.equal(desde("caminar,3:00,Calentamiento\ncorrer,2:00\n").rutina.intervalos.length, 2);
  assert.equal(desde("1,caminar,180\n2,correr,120\n").rutina.intervalos.length, 2);
});

test("el orden manda sobre el orden de las filas", () => {
  const r = desde("orden,tipo,duracion\n2,correr,60\n1,caminar,120\n");
  assert.deepEqual(r.rutina.intervalos.map(x => x.tipo), ["caminar", "correr"]);
});

test("errores: vacío, columnas incorrectas, filas incompletas, duraciones malas", () => {
  assert.equal(desde("").ok, false);
  assert.match(desde("").errores[0].texto, /vacío/);
  assert.match(desde("nombre,edad\nAna,3\n").errores[0].texto, /columnas/);
  assert.match(desde("orden,tipo,duracion\n").errores[0].texto, /no tiene intervalos/);
  const r = desde("orden,tipo,duracion\n1,caminar,\n2,,60\n3,volar,60\n4,correr,abc\n5,correr,3\n6,correr,3:00:00\n7,correr,60\n");
  assert.equal(r.ok, false, "un archivo con errores no se guarda");
  assert.deepEqual(r.errores.map(e => e.fila), [2, 3, 4, 5, 6, 7]);
  assert.match(r.errores[0].texto, /falta la duración/);
  assert.match(r.errores[1].texto, /falta el tipo/);
  assert.match(r.errores[2].texto, /volar/);
  assert.match(r.errores[3].texto, /abc/);
  assert.match(r.errores[4].texto, /3:00 o «3 min»/, "sugiere que eran minutos");
  assert.match(r.errores[5].texto, /máximo 2 horas/);
});

test("límites: archivo muy grande, demasiados intervalos, rutina de más de 4 h", () => {
  assert.match(desde("x".repeat(R.LIMITES.bytes + 1)).errores[0].texto, /demasiado grande/);
  const muchas = "tipo,duracion\n" + Array.from({ length: 201 }, () => "correr,60").join("\n");
  assert.match(desde(muchas).errores[0].texto, /máximo es 200/);
  const larga = "tipo,duracion\n" + Array.from({ length: 5 }, () => "caminar,1:00:00").join("\n");
  assert.match(desde(larga).errores[0].texto, /4 horas/);
});

test("filas de Excel (números) y columna en minutos", () => {
  const r = R.interpretar([["Tipo", "Minutos", "Nota"], ["caminar", 3, "Suave"], ["correr", 2, null]], { nombre: "Excel.xlsx" });
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.deepEqual(r.rutina.intervalos.map(x => x.seg), [180, 120]);
  assert.equal(r.rutina.nombre, "Excel");
});

test("plan de varios días: columna «dia», un grupo por día y en orden", () => {
  const r = desde("Día,orden,tipo,duracion,descripcion\n2,1,caminar,5:00,Calentar\n1,2,correr,1:00,Correr\n1,1,caminar,3:00,Calentar\n2,2,correr,2:00,Correr\n", "Plan 5K.csv");
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.nombre, "Plan 5K");
  assert.equal(r.rutina, null, "con días no es una rutina suelta");
  assert.deepEqual(r.dias.map(d => d.dia), [1, 2]);
  assert.deepEqual(r.dias[0].intervalos.map(x => `${x.tipo}:${x.seg}`), ["caminar:180", "correr:60"]);
  assert.equal(r.dias[1].totalSeg, 420);
});

test("plan: el día vacío sigue al de arriba; «Día 3» y «D3» se entienden", () => {
  const r = desde("dia,tipo,duracion\nDía 1,caminar,60\n,correr,60\nD3,caminar,60\n,correr,90\n");
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.deepEqual(r.dias.map(d => [d.dia, d.intervalos.length]), [[1, 2], [3, 2]]);
});

test("plan: errores de día por fila y límites por día", () => {
  const r = desde("dia,tipo,duracion\n,caminar,60\nx,correr,60\n1,correr,60\n");
  assert.equal(r.ok, false);
  assert.deepEqual(r.errores.map(e => e.fila), [2, 3]);
  assert.match(r.errores[0].texto, /falta el día/);
  assert.match(r.errores[1].texto, /«x» no es válido/);
  const largo = "dia,tipo,duracion\n" + Array.from({ length: 5 }, () => "2,caminar,1:00:00").join("\n");
  assert.match(desde(largo).errores[0].texto, /día 2 dura 300 minutos/);
});

test("la plantilla es un plan de 3 días válido", () => {
  const r = desde(R.PLANTILLA, "plantilla.csv");
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.deepEqual(r.dias.map(d => d.dia), [1, 2, 3]);
});

test("cola de rutinas: la siguiente arriba, la completada pasa al final", () => {
  const rutinas = [
    { id: "d2", nombre: "Plan", dia: 2, orden: 2 },
    { id: "vieja", nombre: "Suelta", creado: 5 },           // sin orden (rutina de antes)
    { id: "d1", nombre: "Plan", dia: 1, orden: 1 },
    { id: "d3", nombre: "Plan", dia: 3, orden: 3 }
  ];
  assert.deepEqual(R.ordenarCola(rutinas).map(r => r.id), ["vieja", "d1", "d2", "d3"]);
  const fin = R.ordenAlFinal(rutinas);
  assert.equal(fin, 4);
  const despues = rutinas.map(r => (r.id === "d1" ? Object.assign({}, r, { orden: fin }) : r));
  assert.deepEqual(R.ordenarCola(despues).map(r => r.id), ["vieja", "d2", "d3", "d1"]);
  assert.equal(R.ordenAlFinal([]), 1);
});

test("resumen de una rutina corta: en segundos", () => {
  assert.equal(R.resumen({ intervalos: [{ tipo: "correr", seg: 10 }, { tipo: "caminar", seg: 10 }] }), "2 intervalos · 20 s");
});

test("nombres de una rutina: título corto y nombre para el historial", () => {
  assert.equal(R.titulo({ nombre: "Plan 5K", dia: 2 }), "Día 2");
  assert.equal(R.nombreCompleto({ nombre: "Plan 5K", dia: 2 }), "Plan 5K · Día 2");
  assert.equal(R.titulo({ nombre: "Intervalos" }), "Intervalos");
  assert.equal(R.nombreCompleto({ nombre: "Intervalos" }), "Intervalos");
});
