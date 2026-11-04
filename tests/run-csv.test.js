const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/run-csv.js");

// Encabezado del export en inglés: columnas repetidas en otras unidades.
const CAB = "Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,Elevation Loss";

test("filas: comillas, comas y saltos de línea dentro de un campo", () => {
  const f = C.filas('a,b,c\r\n1,"dos, tres","línea 1\nlínea 2"\n4,"con ""comillas""",\n');
  assert.deepEqual(f, [["a", "b", "c"], ["1", "dos, tres", "línea 1\nlínea 2"], ["4", 'con "comillas"', ""]]);
});

test("fechas UTC en inglés, español e ISO", () => {
  assert.equal(C.fechaUtc("Mar 5, 2024, 7:12:33 AM"), Date.UTC(2024, 2, 5, 7, 12, 33));
  assert.equal(C.fechaUtc("Mar 5, 2024, 12:02:00 PM"), Date.UTC(2024, 2, 5, 12, 2, 0));
  assert.equal(C.fechaUtc("Dec 31, 2023, 12:30:00 AM"), Date.UTC(2023, 11, 31, 0, 30, 0));
  assert.equal(C.fechaUtc("5 mar 2024, 19:12:33"), Date.UTC(2024, 2, 5, 19, 12, 33));
  assert.equal(C.fechaUtc("5 de ago. de 2024 7:12:33 p. m."), Date.UTC(2024, 7, 5, 19, 12, 33));
  assert.equal(C.fechaUtc("2024-03-05 07:12:33"), Date.UTC(2024, 2, 5, 7, 12, 33));
  assert.equal(C.fechaUtc("2024-03-05T07:12:33Z"), Date.UTC(2024, 2, 5, 7, 12, 33));
  assert.equal(C.fechaUtc("ayer"), null);
});

test("números con punto, coma decimal y miles", () => {
  assert.deepEqual(["10.02", "10,02", "1,234.5", "", "abc"].map(C.numero), [10.02, 10.02, 1234.5, null, null]);
});

test("export en inglés: metros de la segunda Distance, deporte, archivo y descripción", () => {
  const csv = CAB + "\n" +
    '111,"Mar 5, 2024, 11:12:33 AM",Carrera por el Prado,Run,"Con amigos, lindo día",3400,10.02,180,55,false,,Zapatillas A,activities/111.fit.gz,70,,3400.0,3320.0,10020.5,5.1,3.02,123.0,120.0\n' +
    '112,"Mar 6, 2024, 12:00:00 PM",Rodada,Ride,,3600,30.5,,,false,,,activities/112.gpx,,,3600.0,3500.0,30500.0,12,8.7,300,300\n' +
    '113,"Mar 7, 2024, 1:00:00 PM",Cinta,Run,,1800,5.0,,,false,,,,,,1800.0,1800.0,5000.0,,,0,0\n';
  const r = C.leer(csv);
  assert.deepEqual(r.errores, []);
  const [a, b, c] = r.actividades;
  assert.deepEqual([a.idExterno, a.titulo, a.deporte, a.distM, a.tiempoTotalS, a.tiempoMovS, a.ascensoM, a.archivo, a.equipo, a.descripcion],
    ["111", "Carrera por el Prado", "running", 10020.5, 3400, 3320, 123, "activities/111.fit.gz", "Zapatillas A", "Con amigos, lindo día"]);
  assert.equal(a.inicio, Date.UTC(2024, 2, 5, 11, 12, 33));
  assert.equal(a.fcMax, 180);
  assert.deepEqual([b.deporte, b.distM, b.archivo], ["bicicleta", 30500, "activities/112.gpx"]);
  assert.deepEqual([c.archivo, c.distM], [null, 5000], "actividad anotada a mano: sin archivo");
});

test("encabezados en español y una sola columna de distancia (km)", () => {
  const csv = "ID de actividad,Fecha de la actividad,Nombre de la actividad,Tipo de actividad,Tiempo transcurrido,Distancia,Nombre del archivo\n" +
    '7,"5 mar 2024, 7:12:33",Mañana,Carrera,1800,5.02,activities/7.gpx\n' +
    '8,fecha mala,X,Carrera,1800,5,\n';
  const r = C.leer(csv);
  assert.equal(r.actividades.length, 1);
  assert.deepEqual([r.actividades[0].deporte, r.actividades[0].distM, r.actividades[0].archivo], ["running", 5020, "activities/7.gpx"]);
  assert.equal(r.errores.length, 1);
  assert.match(r.errores[0], /Fila 3/);
});

test("encabezados desconocidos: posiciones del formato conocido; CSV vacío o ajeno", () => {
  const cab = CAB.split(",").map((_, i) => `Col ${i}`).join(",");
  const r = C.leer(cab + '\n9,"Jan 2, 2023, 1:23:45 PM",Algo,Run,,600,2,,,,,,activities/9.tcx,,,600,590,2000,,,5,5\n');
  assert.equal(r.porPosicion, true);
  assert.deepEqual([r.actividades[0].distM, r.actividades[0].archivo, r.actividades[0].tiempoMovS], [2000, "activities/9.tcx", 590]);
  assert.deepEqual(C.leer("").errores, ["El CSV está vacío."]);
  assert.equal(C.leer("a,b\n1,2").actividades.length, 0);
});
