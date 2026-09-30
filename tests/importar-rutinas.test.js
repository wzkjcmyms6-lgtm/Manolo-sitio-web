const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const I = require("../js/importar-rutinas.js");

test("CSV con punto y coma, comillas, sin tildes y días", () => {
  const csv = "﻿Dia;Rutina;Ejercicio;Series;Repeticiones;Kg;Descanso;Observaciones\n" +
    "Lunes;Push;Press banca;4;6-8;60;2 min;\"Pausa; abajo\"\n" +
    ";;Fondos;3;8 a 12;;90;\n" +
    "Jueves;Pierna;Sentadilla;4;5-8;80;3:00;\n" +
    ";;;;;;;\n" +
    "Jueves;Pierna;;3;10;;;sin nombre\n" +
    "Jueves;Pierna;Prensa;tres;AMRAP;mucho;;\n";
  const r = I.interpretar(I.leerCsv(csv));
  assert.equal(r.ok, true);
  assert.equal(r.tieneDia, true);
  assert.deepEqual(r.grupos.map(g => [g.nombre, g.dias, g.items.length]), [["Push", ["1"], 2], ["Pierna", ["4"], 2]]);
  const [press, fondos] = r.grupos[0].items;
  assert.deepEqual([press.series, press.repsMin, press.repsMax, press.peso, press.descansoSeg, press.notas], [4, 6, 8, 60, 120, "Pausa; abajo"]);
  assert.deepEqual([fondos.repsMin, fondos.repsMax, fondos.peso, fondos.descansoSeg], [8, 12, null, 90]); // día/rutina heredados
  assert.equal(r.grupos[1].items[0].descansoSeg, 180);
  assert.deepEqual(r.malas.map(m => [m.fila, m.motivo]), [[6, "Falta el nombre del ejercicio"]]);
  assert.equal(r.grupos[1].items[1].avisos.length, 3); // series, reps y peso no entendidos
});

test("sin Día ni Rutina: una sola rutina; Día 1/2 → lunes/martes", () => {
  const r = I.interpretar([["Ejercicio", "Sets", "Reps"], ["Curl", 3, "10-12"]], { hoja: "Brazos" });
  assert.equal(r.tieneDia, false);
  assert.deepEqual(r.grupos.map(g => [g.nombre, g.dias]), [["Brazos", []]]);
  const d = I.interpretar([["Día", "Ejercicio"], ["Día 2", "B"], ["Día 1", "A"]]);
  assert.deepEqual(d.grupos.map(g => [g.nombre, g.dias]), [["Día 2", ["2"]], ["Día 1", ["1"]]]);
});

test("sin columna de ejercicios: error claro", () => {
  const r = I.interpretar([["Nada", "Que ver"], ["x", "y"]]);
  assert.equal(r.ok, false);
  assert.match(r.error, /columna de ejercicios/);
});

test("plantilla .xlsx: se abre y se lee igual", async () => {
  const bytes = I.plantillaXlsx();
  const hojas = await I.leerXlsx(bytes.buffer);
  assert.equal(hojas.length, 1);
  assert.equal(hojas[0].nombre, "Rutinas");
  assert.deepEqual(hojas[0].filas[0], I.TITULOS);
  const r = I.interpretarLibro(hojas, "plantilla.xlsx");
  assert.deepEqual(r.grupos.map(g => [g.nombre, g.dias, g.items.length]), [["Push", ["1"], 3], ["Pull", ["3"], 3], ["Pierna", ["5"], 3]]);
  assert.deepEqual(r.malas, []);
});

// Un .xlsx "de verdad": comprimido (deflate), con textos compartidos y
// prefijos de espacio de nombres, como los que guardan Excel u otros programas.
function zipDeflate(archivos) {
  const partes = [], centrales = [];
  let off = 0;
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (~c) >>> 0; };
  for (const [nombre, texto] of Object.entries(archivos)) {
    const datos = Buffer.from(texto, "utf8"), comp = zlib.deflateRawSync(datos), nb = Buffer.from(nombre);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc(datos), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(datos.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc(datos), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(datos.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    partes.push(h, nb, comp); centrales.push(c, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(centrales), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(archivos).length, 8); fin.writeUInt16LE(Object.keys(archivos).length, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(off, 16);
  return Buffer.concat([...partes, cd, fin]);
}
test("xlsx comprimido con textos compartidos, fecha en Reps y dos hojas", async () => {
  const ss = `<sst xmlns="x"><si><t>Ejercicio</t></si><si><t>Series</t></si><si><t>Reps</t></si><si><r><t>Press </t></r><r><t>banca</t></r></si><si><t>Remo &amp; algo</t></si></sst>`;
  const hoja = (filas) => `<x:worksheet xmlns:x="m"><x:sheetData>${filas}</x:sheetData></x:worksheet>`;
  const buf = zipDeflate({
    "xl/workbook.xml": `<workbook xmlns:r="r"><sheets><sheet name="Empuje" sheetId="1" r:id="rId1"/><sheet name="Tirón" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
    "xl/sharedStrings.xml": ss,
    "xl/worksheets/sheet1.xml": hoja(`<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c><x:c r="C1" t="s"><x:v>2</x:v></x:c></x:row><x:row r="3"><x:c r="A3" t="s"><x:v>3</x:v></x:c><x:c r="B3"><x:v>4</x:v></x:c><x:c r="C3"><x:v>46364</x:v></x:c></x:row>`),
    "xl/worksheets/sheet2.xml": hoja(`<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c></x:row><x:row r="2"><x:c r="A2" t="s"><x:v>4</x:v></x:c></x:row>`)
  });
  const hojas = await I.leerXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  assert.deepEqual(hojas.map(h => h.nombre), ["Empuje", "Tirón"]);
  const r = I.interpretarLibro(hojas, "mis rutinas.xlsx");
  assert.deepEqual(r.grupos.map(g => g.nombre), ["Empuje", "Tirón"]);
  const press = r.grupos[0].items[0];
  assert.deepEqual([press.nombre, press.series, press.repsMin, press.repsMax], ["Press banca", 4, 8, 12]);
  assert.match(press.avisos[0], /fecha/);
  assert.equal(r.grupos[1].items[0].nombre, "Remo & algo");
});
