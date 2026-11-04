const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const Z = require("../js/run-zip.js");
const X = require("./run-fixtures.js");

const texto = b => new TextDecoder().decode(b);

// Cuenta cuántos bytes se leyeron, para comprobar que no se lee todo.
function fuenteContada(bytes) {
  const f = Z.desdeBytes(bytes);
  const c = { leidos: 0 };
  return { size: f.size, leer: (d, n) => { c.leidos += Math.min(n, bytes.length - d); return f.leer(d, n); }, c };
}

test("lista y extrae entradas guardadas y comprimidas", async () => {
  const csv = "Activity ID,Activity Date\n1,\"Mar 5, 2024, 7:12:33 AM\"\n";
  const b = X.zip([
    { nombre: "activities.csv", datos: csv, metodo: 8 },
    { nombre: "activities/", datos: "", metodo: 0 },
    { nombre: "activities/123.gpx", datos: "<gpx></gpx>", metodo: 0 },
    { nombre: "media/foto ñ.jpg", datos: new Uint8Array(5000), metodo: 8 }
  ]);
  const f = Z.desdeBytes(b);
  const es = await Z.listar(f);
  assert.deepEqual(es.map(e => [e.nombre, e.metodo, e.carpeta]), [
    ["activities.csv", 8, false], ["activities/", 0, true], ["activities/123.gpx", 0, false], ["media/foto ñ.jpg", 8, false]
  ]);
  assert.equal(texto(await Z.extraer(f, es[0])), csv);
  assert.equal(texto(await Z.extraer(f, es[2])), "<gpx></gpx>");
});

test("lee solo lo necesario (no el archivo entero)", async () => {
  const grande = new Uint8Array(3000000);
  for (let i = 0; i < grande.length; i++) grande[i] = (i * 7919) % 251; // casi incompresible
  const b = X.zip([{ nombre: "media/video.mp4", datos: grande, metodo: 0 }, { nombre: "activities/1.gpx", datos: "<gpx/>", metodo: 8 }]);
  const f = fuenteContada(b);
  const es = await Z.listar(f);
  assert.equal(texto(await Z.extraer(f, es[1])), "<gpx/>");
  assert.ok(f.c.leidos < 70000, `leyó ${f.c.leidos} bytes de ${b.length}`);
});

test("ZIP64: tamaños y offsets en el campo extra", async () => {
  const b = X.zip([{ nombre: "a.txt", datos: "hola", metodo: 8 }, { nombre: "b/c.txt", datos: "chau", metodo: 0 }], { zip64: true });
  const f = Z.desdeBytes(b);
  const es = await Z.listar(f);
  assert.deepEqual(es.map(e => [e.nombre, e.tamano]), [["a.txt", 4], ["b/c.txt", 4]]);
  assert.equal(texto(await Z.extraer(f, es[1])), "chau");
  assert.equal(texto(await Z.extraer(f, es[0])), "hola");
});

test("gzip: .fit.gz y sinGzip deja igual lo que no está comprimido", async () => {
  const datos = new TextEncoder().encode("contenido de prueba ".repeat(100));
  const gz = new Uint8Array(zlib.gzipSync(datos));
  assert.deepEqual(await Z.gunzip(gz), datos);
  assert.deepEqual(await Z.sinGzip(gz), datos);
  assert.equal(await Z.sinGzip(datos), datos);
  await assert.rejects(() => Z.gunzip(new Uint8Array([0x1f, 0x8b, 8, 0, 1, 2, 3])), Z.ErrorZip);
});

test("respaldo sin deflate-raw: el bloque envuelto en gzip es válido", () => {
  const datos = Buffer.from("parciales por km ".repeat(50));
  const crudo = zlib.deflateRawSync(datos);
  const env = Z.envolverGzip(new Uint8Array(crudo), zlib.crc32(datos) >>> 0, datos.length);
  assert.deepEqual(zlib.gunzipSync(Buffer.from(env)), datos);
});

test("errores en español: no es ZIP, con contraseña", async () => {
  await assert.rejects(() => Z.listar(Z.desdeBytes(new Uint8Array(100))), /incompleto o no es un ZIP/);
  const b = X.zip([{ nombre: "a.txt", datos: "x", metodo: 0 }]);
  const f = Z.desdeBytes(b);
  const [e] = await Z.listar(f);
  await assert.rejects(() => Z.extraer(f, Object.assign({}, e, { cifrado: true })), /contraseña/);
});

test("escribir un ZIP (exportar) y leerlo de vuelta con el mismo lector", async () => {
  const gpx = "<gpx>" + "<trkpt/>".repeat(2000) + "</gpx>";
  const zipB = await Z.crearZip([{ nombre: "manolo-running.json", datos: '{"a":1}' }, { nombre: "gpx/2026-11-03-fondo ñ.gpx", datos: gpx }]);
  const f = Z.desdeBytes(zipB);
  const es = await Z.listar(f);
  assert.deepEqual(es.map(e => e.nombre), ["manolo-running.json", "gpx/2026-11-03-fondo ñ.gpx"]);
  assert.equal(es[1].metodo, 8, "el GPX va comprimido");
  assert.equal(es[1].crc, zlib.crc32(Buffer.from(gpx)) >>> 0);
  assert.equal(texto(await Z.extraer(f, es[1])), gpx);
  assert.equal(texto(await Z.extraer(f, es[0])), '{"a":1}');
  assert.equal(Z.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});
