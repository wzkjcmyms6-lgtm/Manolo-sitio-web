// ---------- Libros: repaso de frases, favoritas y etiquetas (sin pantalla) ----------
// Fase 5b (D-109). "Repaso de frases": de 1 a 3 por día (eliges cuántas).
// Al verla, la calificas:
//   ❤️ "Me encanta" → vuelve en 3 días (las buenas vuelven más);
//   👍 "Bien"       → cada vez más espaciada: 7, 14, 28 y hasta 60 días;
//   👎 "Menos"      → se guarda 90 días.
// Cada frase guarda repaso: { n, int (días), ultimo, proximo, nota }.
// Las de hoy no cambian durante el día: las que ya repasaste hoy cuentan
// y se suman las que tocan hasta completar tu número. Primero las
// favoritas y las que te encantan, después las que nunca viste; los
// empates se mezclan distinto cada día.
// Sin DOM ni Firebase: tests/libros-frases.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LibrosFrases = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const NOTAS = [
  { id: "encanta", nombre: "Me encanta", emoji: "❤️" },
  { id: "bien", nombre: "Bien", emoji: "👍" },
  { id: "menos", nombre: "Menos", emoji: "👎" }
];
const DIAS = { encanta: 3, primera: 7, max: 60, menos: 90 };
const POR_DIA = 3;

function sumarDias(f, n) { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
// Un número fijo por texto (para mezclar igual todo el día).
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
const repasadaHoy = (f, hoy) => !!(f.repaso && f.repaso.ultimo === hoy);
const toca = (f, hoy) => !f.repaso || !f.repaso.proximo || f.repaso.proximo <= hoy;
function puntaje(f) {
  let p = 0;
  if (f.fav) p += 3;
  if (f.repaso && f.repaso.nota === "encanta") p += 2;
  if (!f.repaso) p += 1;
  return p;
}

// → { hechas: [frases ya repasadas hoy], pendientes: [las que faltan], max }
function paraHoy(frases, hoy, max) {
  const n = Math.max(1, Math.min(3, Number(max) || POR_DIA));
  const lista = (frases || []).filter(f => f && f.texto);
  const hechas = lista.filter(f => repasadaHoy(f, hoy));
  const faltan = Math.max(0, n - hechas.length);
  const semilla = hash(hoy);
  const pendientes = lista.filter(f => !repasadaHoy(f, hoy) && toca(f, hoy))
    .sort((a, b) => puntaje(b) - puntaje(a) || (hash(a.id + semilla) - hash(b.id + semilla)))
    .slice(0, faltan);
  return { hechas, pendientes, max: n };
}

// nota: "encanta" | "bien" | "menos" → el repaso nuevo.
function calificar(frase, nota, hoy) {
  const r = (frase && frase.repaso) || {};
  const antes = Number(r.int) || 0;
  const int = nota === "encanta" ? DIAS.encanta : nota === "menos" ? DIAS.menos : Math.min(DIAS.max, antes >= DIAS.primera ? antes * 2 : DIAS.primera);
  return { n: (Number(r.n) || 0) + 1, int, ultimo: hoy, proximo: sumarDias(hoy, int), nota: NOTAS.some(x => x.id === nota) ? nota : "bien" };
}
// "en 3 días", "mañana"…
function cuando(proximo, hoy) {
  const d = Math.round((new Date(proximo + "T12:00:00Z") - new Date(hoy + "T12:00:00Z")) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`;
}

// ---- Favoritas y etiquetas (pestaña Frases) ----
function etiquetasUsadas(frases) {
  const n = {};
  (frases || []).forEach(f => (f.etiquetas || []).forEach(t => { n[t] = (n[t] || 0) + 1; }));
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b, "es")).map(t => ({ etiqueta: t, n: n[t] }));
}
// f: { fav: true, etiqueta: "fe" }
function filtrar(frases, f) {
  const o = f || {};
  return (frases || []).filter(x => (!o.fav || x.fav) && (!o.etiqueta || (x.etiquetas || []).includes(o.etiqueta)));
}

return { NOTAS, DIAS, POR_DIA, paraHoy, calificar, cuando, etiquetasUsadas, filtrar, sumarDias };
});
