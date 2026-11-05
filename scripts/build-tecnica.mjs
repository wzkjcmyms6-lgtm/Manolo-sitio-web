#!/usr/bin/env node
// Genera data/ejercicios-tecnica.json: "Cómo se hace" de cada ejercicio.
//   - pasos (3 a 5, en español simple) de scripts/tecnica/pasos-*.mjs,
//     traducidos y resumidos de free-exercise-db (dominio público);
//   - tipo de movimiento de TODOS los ejercicios de la base y sus errores
//     comunes (scripts/tecnica/patrones.mjs).
// La app lo carga recién al abrir una ficha (js/ej-ficha.js), no al arrancar.
// Uso: node scripts/build-tecnica.mjs   (también corre con npm run tecnica)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ERRORES, patron } from "./tecnica/patrones.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = JSON.parse(readFileSync(join(ROOT, "data/ejercicios.json"), "utf8"));
const porId = new Map(base.ejercicios.map(e => [e.id, e]));

const PASOS = {};
const dir = join(ROOT, "scripts/tecnica");
for (const f of readdirSync(dir).filter(f => /^pasos-\d+\.mjs$/.test(f)).sort()) {
  const m = await import(pathToFileURL(join(dir, f)).href);
  Object.entries(m.PASOS).forEach(([id, p]) => {
    if (PASOS[id]) throw new Error(`${id} repetido (${f})`);
    PASOS[id] = p;
  });
}

const problemas = [];
Object.entries(PASOS).forEach(([id, p]) => {
  if (!porId.has(id)) problemas.push(`${id}: no está en la base`);
  if (p.length < 3 || p.length > 5) problemas.push(`${id}: ${p.length} pasos (van de 3 a 5)`);
  p.forEach(t => { if (t.length > 130) problemas.push(`${id}: paso largo (${t.length}): ${t}`); });
});
if (problemas.length) { console.error(problemas.join("\n")); process.exit(1); }

const ej = {};
const usados = new Set();
base.ejercicios.forEach(e => {
  const pt = patron(e);
  usados.add(pt);
  ej[e.id] = PASOS[e.id] ? { pt, p: PASOS[e.id] } : { pt };
});
const errores = {};
[...usados].sort().forEach(pt => { errores[pt] = ERRORES[pt]; });

const salida = {
  v: 1,
  fuente: "Pasos traducidos y resumidos de free-exercise-db (https://github.com/yuhonas/free-exercise-db), Unlicense / dominio público",
  generado: "node scripts/build-tecnica.mjs",
  errores,
  ej
};
writeFileSync(join(ROOT, "data/ejercicios-tecnica.json"), JSON.stringify(salida) + "\n");
const con = Object.keys(PASOS).length;
const destacados = base.ejercicios.slice(0, base.destacados).filter(e => !PASOS[e.id]).map(e => e.id);
const cuenta = {};
Object.values(ej).forEach(x => { cuenta[x.pt] = (cuenta[x.pt] || 0) + 1; });
console.log(`${con} de ${base.ejercicios.length} ejercicios con pasos; tipos: ${JSON.stringify(cuenta)}`);
if (destacados.length) console.log("Destacados sin pasos: " + destacados.join(", "));
