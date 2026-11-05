#!/usr/bin/env node
// Genera las demos de los ejercicios: img/ejercicios/{id}/0.webp y 1.webp
// (inicio y final del movimiento) a partir de las 2 fotos de cada ejercicio
// de free-exercise-db, en el MISMO commit fijado que scripts/build-exercises.mjs.
// https://github.com/yuhonas/free-exercise-db — licencia Unlicense (dominio
// público: se puede copiar, modificar y redistribuir sin restricciones).
//
// - Solo los ejercicios de data/ejercicios.json con demo: 1.
// - WebP de 480 px de ancho, calidad 75 (~14 KB cada una, ~28 KB por
//   ejercicio), con ffmpeg (libwebp). No guarda metadatos.
// - Incremental: si las 2 imágenes ya existen no las vuelve a hacer
//   (--forzar las rehace todas).
// - Las imágenes NO van en el precache del service worker: la app las
//   descarga al abrir una ficha y las guarda en una caché con límite
//   (ver sw.js y js/ej-demos.js, D-091).
//
// Uso:
//   node scripts/build-demos.mjs                     descarga y genera
//   node scripts/build-demos.mjs --local x.json      lista de ejercicios local
//   node scripts/build-demos.mjs --solo id1,id2      solo esos ejercicios
//
// Necesita curl y ffmpeg (con libwebp).

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync, rmSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
const BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}`;
const SALIDA = join(ROOT, "img/ejercicios");
const ANCHO = 480;
const CALIDAD = 75;
const PARALELO = 8;

const args = process.argv.slice(2);
const local = args.includes("--local") ? args[args.indexOf("--local") + 1] : null;
const forzar = args.includes("--forzar");
const solo = args.includes("--solo") ? new Set(args[args.indexOf("--solo") + 1].split(",")) : null;

function slug(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const correr = promisify(execFile);
function bajar(url, destino) {
  execFileSync("curl", ["-sSfL", "--retry", "3", "-o", destino, url]);
}

const lista = local ? JSON.parse(readFileSync(local, "utf8")) : (() => {
  const tmp = join(tmpdir(), `fedb-${COMMIT.slice(0, 7)}.json`);
  if (!existsSync(tmp)) bajar(`${BASE}/dist/exercises.json`, tmp);
  return JSON.parse(readFileSync(tmp, "utf8"));
})();
const original = new Map(lista.map(e => [slug(e.id), e]));
const base = JSON.parse(readFileSync(join(ROOT, "data/ejercicios.json"), "utf8")).ejercicios;
const conDemo = base.filter(e => e.demo && (!solo || solo.has(e.id)));

const tmp = join(tmpdir(), "manolo-demos");
mkdirSync(tmp, { recursive: true });
let hechos = 0, saltados = 0;
const fallas = [];

async function uno(f) {
  const dir = join(SALIDA, f.id);
  const listos = [0, 1].every(i => existsSync(join(dir, `${i}.webp`)));
  if (listos && !forzar) { saltados++; return; }
  const o = original.get(f.id);
  if (!o || !o.images || o.images.length < 2) { fallas.push(`${f.id}: sin fotos en el dataset`); return; }
  mkdirSync(dir, { recursive: true });
  for (const i of [0, 1]) {
    const jpg = join(tmp, `${f.id}-${i}.jpg`);
    try {
      await correr("curl", ["-sSfL", "--retry", "3", "-o", jpg, `${BASE}/exercises/${o.images[i]}`]);
      await correr("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", jpg, "-vf", `scale=${ANCHO}:-2`,
        "-c:v", "libwebp", "-quality", String(CALIDAD), "-compression_level", "6", "-preset", "photo",
        "-map_metadata", "-1", join(dir, `${i}.webp`)]);
    } catch (err) {
      fallas.push(`${f.id}/${i}: ${err.message.split("\n")[0]}`);
    }
  }
  hechos++;
}

// De a PARALELO a la vez (curl y ffmpeg son procesos aparte).
const cola = conDemo.slice();
await Promise.all(Array.from({ length: PARALELO }, async () => {
  while (cola.length) {
    const f = cola.shift();
    await uno(f);
    if ((hechos + saltados) % 50 === 0) process.stdout.write(`${hechos + saltados}/${conDemo.length}\n`);
  }
}));
rmSync(tmp, { recursive: true, force: true });

// Resumen: cuántas, cuánto pesan.
let total = 0, n = 0;
if (existsSync(SALIDA)) for (const id of readdirSync(SALIDA)) for (const a of ["0.webp", "1.webp"]) {
  const p = join(SALIDA, id, a);
  if (existsSync(p)) { total += statSync(p).size; n++; }
}
console.log(`${hechos} generados, ${saltados} ya estaban. ${n} imágenes, ${(total / 1024 / 1024).toFixed(1)} MB (${Math.round(total / Math.max(1, n) / 1024)} KB de promedio).`);
if (fallas.length) { console.log("Fallas:\n" + fallas.join("\n")); process.exitCode = 1; }
writeFileSync(join(SALIDA, "LEEME.txt"), `Demos de ejercicios: 2 fotos por ejercicio (inicio y final), en WebP de ${ANCHO} px.
Origen: free-exercise-db (https://github.com/yuhonas/free-exercise-db), commit ${COMMIT},
licencia Unlicense (dominio público). Generadas con: node scripts/build-demos.mjs
`);
