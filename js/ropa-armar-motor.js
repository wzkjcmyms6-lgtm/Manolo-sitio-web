// ---------- Ropa: armar tu outfit (D-156; sin DOM) ----------
// "Armar el mío" y "Ver en grande": el orden de las prendas (de la cabeza a
// los pies y, en cada parte, de afuera hacia adentro: la chamarra, la chompa,
// la camisa, la polera), las filas del tablero (lo de arriba, lo de abajo,
// los pies y los accesorios) y los avisos al armar, que solo avisan: nunca
// impiden guardar.
// Pruebas: tests/ropa-armar-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ropa-motor.js"), require("./ropa-outfit-motor.js"));
  else root.RopaArmarMotor = factory(root.RopaMotor, root.RopaOutfitMotor);
})(typeof self !== "undefined" ? self : this, function (M, O) {
"use strict";

// Las partes, en el orden en que se eligen. "una": elegir otra la cambia.
const PARTES = [
  { id: "arriba", nombre: "Arriba", una: false },
  { id: "abajo", nombre: "Abajo", una: true },
  { id: "abrigos", nombre: "Abrigo", una: true },
  { id: "zapatos", nombre: "Zapatos", una: true },
  { id: "accesorios", nombre: "Accesorios", una: false },
  { id: "cuerpo", nombre: "Cuerpo entero", una: true }
];
const PARTE = Object.fromEntries(PARTES.map(p => [p.id, p]));

// ---- El orden ----
// De afuera hacia adentro: el abrigo; lo de arriba (la chompa sobre la camisa
// y la camisa sobre la polera); lo de cuerpo entero; lo de abajo; los zapatos
// y los accesorios.
const ZONA = { abrigos: 0, arriba: 1, cuerpo: 2, abajo: 3, zapatos: 4, accesorios: 5 };
const ENCIMA = [/chompa|sueter|sweater|cardigan|polar|buzo|capucha|hoodie/, /camisa|blusa/];
function capaArriba(p) {
  const t = M.plano(p.tipo || "");
  const k = ENCIMA.findIndex(re => re.test(t));
  return k < 0 ? ENCIMA.length : k;
}
function ordenar(items) {
  return (items || []).map((p, i) => ({ p, i })).sort((a, b) =>
    ZONA[a.p.grupo] - ZONA[b.p.grupo] || (a.p.grupo === "arriba" ? capaArriba(a.p) - capaArriba(b.p) : 0) || a.i - b.i).map(x => x.p);
}
// Las filas del tablero (como se ve puesto): lo de arriba (abrigo, arriba y
// cuerpo entero), lo de abajo, los pies y los accesorios. Sin filas vacías.
const FILAS = [["arriba", ["abrigos", "arriba", "cuerpo"]], ["abajo", ["abajo"]], ["pies", ["zapatos"]], ["accesorios", ["accesorios"]]];
function filas(items) {
  const xs = ordenar(items);
  return FILAS.map(([id, grupos]) => ({ id, prendas: xs.filter(p => grupos.includes(p.grupo)) })).filter(f => f.prendas.length);
}

// ---- Elegir ----
// ids: lo elegido; p: la prenda que tocaste. → los ids nuevos: si estaba, sale;
// si su parte es de una sola (abajo, abrigo, zapatos, cuerpo entero), cambia
// la que había; si no, se suma.
function tocar(ids, p, todas) {
  const ya = (ids || []).filter(Boolean);
  if (ya.includes(p.id)) return ya.filter(id => id !== p.id);
  const parte = PARTE[p.grupo];
  const por = new Map((todas || []).map(x => [x.id, x]));
  const quedan = parte && parte.una ? ya.filter(id => { const x = por.get(id); return !x || x.grupo !== p.grupo; }) : ya;
  return quedan.concat(p.id);
}
// ¿Se puede poner así? Algo de arriba y algo de abajo, o algo de cuerpo entero.
function completo(items) {
  const n = g => items.filter(p => p.grupo === g).length;
  return (n("cuerpo") === 1 && !n("abajo")) || (!n("cuerpo") && n("arriba") >= 1 && n("abajo") === 1);
}

// ---- Los avisos (solo avisan) ----
const lista = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0] || "");
const grados = t => `${Math.round(t)}°`;
// items: las prendas elegidas (normalizadas); ctx: { nec (RopaClima.necesidades;
// sin clima, nada), ocasion (casual | trabajo | noche | deporte | formal: la de
// base), hayZapatos }. → [{ id, tipo: "aviso" | "info", texto }], lo más
// importante primero.
function avisos(items, ctx) {
  const c = ctx || {}, nec = c.nec || null, r = [];
  const xs = items || [];
  if (!xs.length) return r;
  const de = g => xs.filter(p => p.grupo === g);
  const n = g => de(g).length;
  const aviso = (id, texto) => r.push({ id, tipo: "aviso", texto });
  const titulos = ps => lista(ps.map(p => M.titulo(p)));
  // Lo que no está para ponerse.
  const lavar = xs.filter(p => p.estado === "lavar");
  if (lavar.length) aviso("lavar", `${lavar.length === 1 ? "Está" : "Están"} para lavar: ${titulos(lavar)}.`);
  // Lo que sobra.
  if (n("abajo") > 1) aviso("dos-abajo", "Tienes dos de abajo.");
  if (n("cuerpo") > 1) aviso("dos-cuerpo", "Tienes dos de cuerpo entero.");
  if (n("cuerpo") && n("abajo")) aviso("cuerpo-abajo", "Cuerpo entero con algo de abajo: ¿va así?");
  if (n("arriba") > 2) aviso("tres-arriba", "Más de dos de arriba.");
  if (n("abrigos") > 1) aviso("dos-abrigos", "Tienes dos abrigos.");
  if (n("zapatos") > 1) aviso("dos-zapatos", "Tienes dos pares de zapatos.");
  // Lo que falta.
  const ropa = n("arriba") + n("abajo") + n("cuerpo") + n("abrigos");
  if (!n("cuerpo") && !n("arriba") && (n("abajo") || n("abrigos"))) aviso("falta-arriba", "Falta algo de arriba.");
  if (!n("cuerpo") && n("arriba") && !n("abajo")) aviso("falta-abajo", "Falta algo de abajo.");
  if (c.hayZapatos && ropa && !n("zapatos")) aviso("falta-zapatos", "Faltan los zapatos.");
  // El clima del día.
  if (nec && ropa) {
    const deFrio = xs.some(p => p.grupo !== "accesorios" && p.clima.length && p.clima.every(x => x === "frio"));
    if (nec.abrigo === "abrigo" && !n("abrigos") && !deFrio) aviso("frio", `Hace frío${typeof nec.bajo === "number" ? ` (${grados(nec.bajo)} a la mañana)` : ""}: ¿sumas algo de abrigo?`);
    if (nec.base === "calor" && !nec.capas && (n("abrigos") || deFrio)) aviso("calor", "Hace calor: ¿seguro con tanto abrigo?");
    if ((nec.lluvia === "si" || nec.tormenta) && de("zapatos").some(p => /sandalia/.test(M.plano(p.tipo)))) aviso("lluvia", "Va a llover: mejor zapatos cerrados.");
    if (nec.capas && n("abrigos") && typeof nec.alto === "number") r.push({ id: "capas", tipo: "info", texto: `Al mediodía sube a ${grados(nec.alto)}: ${M.titulo(de("abrigos")[0]).toLowerCase()} es para la mañana.` });
  }
  // Colores, estampados y qué tan formal.
  const visibles = xs.filter(p => p.grupo !== "accesorios");
  if (O.fuertes(visibles).length > 2) aviso("colores", "Tres colores fuertes o más: puede ser mucho.");
  if (visibles.filter(p => p.estampado && p.estampado !== "liso").length > 1) aviso("estampados", "Dos estampados juntos: mejor uno solo.");
  const fo = visibles.map(p => p.formalidad).filter(Boolean);
  if (fo.length >= 2 && Math.max(...fo) - Math.min(...fo) > 2) aviso("formalidad", "Mezcla algo muy formal con algo muy informal.");
  else if (c.ocasion === "formal" && fo.length && Math.min(...fo) <= 2) aviso("ocasion", "Para un evento formal, hay algo muy informal.");
  return r;
}

return { PARTES, PARTE, ordenar, capaArriba, filas, tocar, completo, avisos };
});
