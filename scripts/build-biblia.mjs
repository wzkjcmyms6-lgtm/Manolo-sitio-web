// Convierte la Reina-Valera 1909 (dominio público) de seven1m/open-bibles
// (spa-rv1909.usfx.xml, commit fijado abajo) en un JSON por libro:
//   data/biblia/rv1909/{libro}.json  → { v, libro, nombre, caps: [[v1, v2…], …] }
//   data/biblia/rv1909/indice.json   → versión, fuente y versículos por capítulo
// Sin notas al pie; las palabras añadidas por los traductores (<add>) quedan
// como texto normal. El texto no se toca: la "ortografía actual" se aplica
// al mostrarlo (js/biblia-texto.js). Ver docs/LECTURA_NIVEL2.md (D-102).
//
// Uso:
//   git clone --depth 1 --filter=blob:none --no-checkout https://github.com/seven1m/open-bibles ob
//   git -C ob checkout 008faa9f5fc84eae98d8d76e20e742f4ee3d7e4e -- spa-rv1909.usfx.xml
//   npm run biblia -- ob/spa-rv1909.usfx.xml
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BibliaMotor = require("../js/biblia-motor.js");

const COMMIT = "008faa9f5fc84eae98d8d76e20e742f4ee3d7e4e";
const FUENTE = `https://github.com/seven1m/open-bibles/blob/${COMMIT}/spa-rv1909.usfx.xml`;
const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const SALIDA = path.join(RAIZ, "data", "biblia", "rv1909");
// Códigos USFX en el orden de la Biblia (el mismo de BibliaMotor.LIBROS).
const USFX = ["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH",
  "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM",
  "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH",
  "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"];

const archivo = process.argv[2];
if (!archivo || !fs.existsSync(archivo)) {
  console.error("Falta el archivo spa-rv1909.usfx.xml (ver el comentario de arriba).");
  process.exit(1);
}
const xml = fs.readFileSync(archivo, "utf8").replace(/^﻿/, "");

const limpiar = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, " ").replace(/\s+([,.;:!?)])/g, "$1").trim();

function libroDe(trozo) {
  const caps = [];
  let cap = null;
  // Fichas: capítulo, inicio y fin de versículo; el texto va entre <v/> y <ve/>.
  const re = /<c id="(\d+)"\s*\/>|<v id="(\d+)"\s*\/>|<ve\s*\/>/g;
  let m, abierto = null, desde = 0;
  while ((m = re.exec(trozo))) {
    if (m[1]) {
      if (abierto) cap[abierto - 1] = limpiar(trozo.slice(desde, m.index)); // último versículo sin <ve/>
      cap = []; caps[Number(m[1]) - 1] = cap; abierto = null; continue;
    }
    if (m[2]) {
      if (abierto) cap[abierto - 1] = limpiar(trozo.slice(desde, m.index)); // sin <ve/>
      abierto = Number(m[2]);
      desde = re.lastIndex;
      continue;
    }
    if (abierto) { cap[abierto - 1] = limpiar(trozo.slice(desde, m.index)); abierto = null; }
  }
  if (abierto) cap[abierto - 1] = limpiar(trozo.slice(desde).replace(/<\/book>[\s\S]*$/, ""));
  return caps;
}

const trozos = xml.split(/<book id="/).slice(1);
if (trozos.length !== 66) throw new Error(`Se esperaban 66 libros y hay ${trozos.length}`);
fs.mkdirSync(SALIDA, { recursive: true });
const indice = { v: 1, version: "RV1909", nombre: "Reina-Valera 1909", licencia: "Dominio público", fuente: FUENTE, libros: [] };
let totalVers = 0, totalCaps = 0, bytes = 0;
const vacios = [];  // versículos sin texto en la fuente (la RV1909 los une al anterior o al siguiente)
trozos.forEach((t, i) => {
  const usfx = t.slice(0, t.indexOf('"'));
  if (usfx !== USFX[i]) throw new Error(`Libro ${i + 1}: se esperaba ${USFX[i]} y llegó ${usfx}`);
  const meta = BibliaMotor.LIBROS[i];
  const caps = libroDe(t);
  if (caps.length !== meta.capitulos) throw new Error(`${meta.nombre}: ${caps.length} capítulos (se esperaban ${meta.capitulos})`);
  caps.forEach((c, k) => {
    if (!c || !c.length) throw new Error(`${meta.nombre} ${k + 1}: sin versículos`);
    c.forEach((v, j) => { if (v == null) c[j] = ""; if (!c[j]) vacios.push(`${meta.nombre} ${k + 1}:${j + 1}`); });
  });
  const json = JSON.stringify({ v: 1, libro: meta.id, nombre: meta.nombre, caps });
  fs.writeFileSync(path.join(SALIDA, `${meta.id}.json`), json);
  bytes += Buffer.byteLength(json);
  totalCaps += caps.length;
  const versos = caps.map(c => c.length);
  totalVers += versos.reduce((a, b) => a + b, 0);
  indice.libros.push({ id: meta.id, nombre: meta.nombre, versos, kb: Math.round(Buffer.byteLength(json) / 1024) });
});
indice.capitulos = totalCaps;
indice.versiculos = totalVers;
indice.vacios = vacios;
fs.writeFileSync(path.join(SALIDA, "indice.json"), JSON.stringify(indice));
if (vacios.length) console.log(`Versículos sin texto en la fuente (${vacios.length}): ${vacios.join(", ")}`);
console.log(`66 libros, ${totalCaps} capítulos, ${totalVers} versículos, ${(bytes / 1048576).toFixed(2)} MB → ${path.relative(RAIZ, SALIDA)}/`);
