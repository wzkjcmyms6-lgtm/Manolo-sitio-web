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

test("la plantilla es una rutina válida", () => {
  const r = desde(R.PLANTILLA, "plantilla");
  assert.equal(r.ok, true);
  assert.equal(r.rutina.intervalos.length, 5);
});
