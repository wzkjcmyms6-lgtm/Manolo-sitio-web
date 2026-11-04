// ---------- Running: ZIP y gzip por partes (sin pantalla) ----------
// El export de Strava puede pesar varios GB (fotos incluidas): no se carga
// entero. Se lee el final del archivo (directorio central, con ZIP64), y de
// cada entrada que hace falta solo su cabecera local y sus datos
// (`File.slice`). Descompresión con DecompressionStream del navegador:
// "deflate-raw" si existe; si no, el bloque se envuelve en un gzip con el CRC
// y el tamaño del directorio central y se usa "gzip" (Safari 16.4+). Sin
// librerías (D-062).
//
// fuente = { size, leer(desde, cuantos) → Promise<Uint8Array> }
//   · navegador: desdeArchivo(file) · pruebas: desdeBytes(Uint8Array)
// Pruebas: tests/run-zip.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RunZip = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

class ErrorZip extends Error {
  constructor(mensaje) { super(mensaje); this.name = "ErrorZip"; }
}

function desdeBytes(bytes) {
  return { size: bytes.length, leer: (desde, n) => Promise.resolve(bytes.subarray(desde, Math.min(bytes.length, desde + n))) };
}
function desdeArchivo(file) {
  return {
    size: file.size,
    leer: (desde, n) => file.slice(desde, Math.min(file.size, desde + n)).arrayBuffer().then(b => new Uint8Array(b))
  };
}

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000;
const u64 = (b, i) => u32(b, i) + u32(b, i + 4) * 0x100000000;

// Lista de entradas: [{ nombre, metodo, crc, comprimido, tamano, offset, cifrado, carpeta }]
async function listar(fuente) {
  const cola = Math.min(fuente.size, 65557);
  const fin = await fuente.leer(fuente.size - cola, cola);
  let e = -1;
  for (let i = fin.length - 22; i >= 0; i--) {
    if (fin[i] === 0x50 && fin[i + 1] === 0x4b && fin[i + 2] === 0x05 && fin[i + 3] === 0x06) { e = i; break; }
  }
  if (e < 0) throw new ErrorZip("El ZIP está incompleto o no es un ZIP (¿se terminó de descargar?).");
  let total = u16(fin, e + 10), tamCd = u32(fin, e + 12), offCd = u32(fin, e + 16);
  if (total === 0xffff || tamCd === 0xffffffff || offCd === 0xffffffff) {
    // ZIP64: el localizador está justo antes del fin del directorio.
    const l = e - 20;
    if (l < 0 || u32(fin, l) !== 0x07064b50) throw new ErrorZip("ZIP64 sin localizador: el archivo puede estar dañado.");
    const off64 = u64(fin, l + 8);
    const z = await fuente.leer(off64, 56);
    if (u32(z, 0) !== 0x06064b50) throw new ErrorZip("ZIP64 dañado.");
    total = u64(z, 32); tamCd = u64(z, 40); offCd = u64(z, 48);
  }
  const cd = await fuente.leer(offCd, tamCd);
  const entradas = [];
  const utf8 = new TextDecoder("utf-8");
  let p = 0;
  for (let k = 0; k < total && p + 46 <= cd.length; k++) {
    if (u32(cd, p) !== 0x02014b50) throw new ErrorZip("El índice del ZIP está dañado.");
    const flags = u16(cd, p + 8), metodo = u16(cd, p + 10);
    let comprimido = u32(cd, p + 20), tamano = u32(cd, p + 24), offset = u32(cd, p + 42);
    const nl = u16(cd, p + 28), xl = u16(cd, p + 30), cl = u16(cd, p + 32);
    const nombre = utf8.decode(cd.subarray(p + 46, p + 46 + nl));
    // Campo extra ZIP64 (id 1): tamaños y offset que no caben en 32 bits.
    let x = p + 46 + nl;
    const xFin = x + xl;
    while (x + 4 <= xFin) {
      const id = u16(cd, x), tam = u16(cd, x + 2);
      if (id === 1) {
        let q = x + 4;
        if (tamano === 0xffffffff) { tamano = u64(cd, q); q += 8; }
        if (comprimido === 0xffffffff) { comprimido = u64(cd, q); q += 8; }
        if (offset === 0xffffffff) { offset = u64(cd, q); q += 8; }
      }
      x += 4 + tam;
    }
    entradas.push({ nombre, metodo, crc: u32(cd, p + 16), comprimido, tamano, offset, cifrado: !!(flags & 1), carpeta: /\/$/.test(nombre) });
    p += 46 + nl + xl + cl;
  }
  return entradas;
}

// ---- Descompresión ----
function soporta(formato) {
  try { new DecompressionStream(formato); return true; } catch (e) { return false; }
}
async function porStream(bytes, formato) {
  const ds = new DecompressionStream(formato);
  const salida = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(salida).arrayBuffer());
}
// Envoltorio gzip para un bloque deflate crudo (cuando no hay "deflate-raw").
function envolverGzip(crudo, crc, tamano) {
  const out = new Uint8Array(10 + crudo.length + 8);
  out.set([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff], 0);
  out.set(crudo, 10);
  const f = 10 + crudo.length;
  for (let i = 0; i < 4; i++) {
    out[f + i] = (crc >>> (8 * i)) & 0xff;
    out[f + 4 + i] = (tamano >>> (8 * i)) & 0xff;
  }
  return out;
}
async function inflar(crudo, crc, tamano) {
  if (typeof DecompressionStream === "undefined") throw new ErrorZip("Este navegador no puede abrir ZIP. Actualiza el iPhone o descomprime el archivo antes.");
  if (soporta("deflate-raw")) return porStream(crudo, "deflate-raw");
  return porStream(envolverGzip(crudo, crc, tamano % 0x100000000), "gzip");
}
async function gunzip(bytes) {
  if (typeof DecompressionStream === "undefined") throw new ErrorZip("Este navegador no puede abrir archivos .gz.");
  try { return await porStream(bytes, "gzip"); } catch (e) { throw new ErrorZip("El archivo .gz está dañado."); }
}

async function extraer(fuente, entrada) {
  if (entrada.cifrado) throw new ErrorZip("El ZIP tiene contraseña: no se puede abrir.");
  const cab = await fuente.leer(entrada.offset, 30);
  if (u32(cab, 0) !== 0x04034b50) throw new ErrorZip(`No se encontró "${entrada.nombre}" dentro del ZIP.`);
  const inicio = entrada.offset + 30 + u16(cab, 26) + u16(cab, 28);
  const datos = await fuente.leer(inicio, entrada.comprimido);
  if (entrada.metodo === 0) return datos;
  if (entrada.metodo === 8) {
    try { return await inflar(datos, entrada.crc, entrada.tamano); } catch (e) {
      if (e instanceof ErrorZip) throw e;
      throw new ErrorZip(`"${entrada.nombre}" está dañado dentro del ZIP.`);
    }
  }
  throw new ErrorZip(`"${entrada.nombre}" usa una compresión que no se puede abrir.`);
}

// Bytes listos para leer: quita una capa de gzip si la tiene.
async function sinGzip(bytes) {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzip(bytes) : bytes;
}

// ---- Escribir un ZIP (exportar: GPX + JSON) ----
// Con "deflate-raw" si el navegador lo tiene (Safari 16.4+); si no, sin comprimir.
let TABLA_CRC = null;
function crc32(bytes) {
  if (!TABLA_CRC) {
    TABLA_CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLA_CRC[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function comprimir(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const salida = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(salida).arrayBuffer());
  } catch (e) { return null; }
}
// entradas: [{ nombre, datos: Uint8Array | string }] → Uint8Array del ZIP.
async function crearZip(entradas) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let off = 0;
  const u16b = v => [v & 0xff, (v >>> 8) & 0xff];
  const u32b = v => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const e of entradas) {
    const datos = typeof e.datos === "string" ? enc.encode(e.datos) : e.datos;
    const nombre = enc.encode(e.nombre);
    const crc = crc32(datos);
    const comp = await comprimir(datos);
    const usar = comp && comp.length < datos.length ? comp : datos;
    const metodo = usar === datos ? 0 : 8;
    const comun = [...u16b(20), ...u16b(0x0800), ...u16b(metodo), ...u16b(0), ...u16b(0x21), ...u32b(crc), ...u32b(usar.length), ...u32b(datos.length), ...u16b(nombre.length), ...u16b(0)];
    const local = new Uint8Array([...u32b(0x04034b50), ...comun]);
    partes.push(local, nombre, usar);
    central.push(new Uint8Array([...u32b(0x02014b50), ...u16b(20), ...comun, ...u16b(0), ...u16b(0), ...u16b(0), ...u32b(0), ...u32b(off)]), nombre);
    off += local.length + nombre.length + usar.length;
  }
  const tamCd = central.reduce((s, x) => s + x.length, 0);
  const fin = new Uint8Array([...u32b(0x06054b50), ...u16b(0), ...u16b(0), ...u16b(entradas.length), ...u16b(entradas.length), ...u32b(tamCd), ...u32b(off), ...u16b(0)]);
  const todo = partes.concat(central, [fin]);
  const out = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
  let p = 0;
  todo.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}

return { listar, extraer, gunzip, sinGzip, desdeBytes, desdeArchivo, envolverGzip, crearZip, crc32, ErrorZip };
});
