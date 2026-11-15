// ---------- Biblia: memorizar versículos (sin pantalla) ----------
// Fase 3 (D-106). Repasos espaciados tipo Leitner: cada versículo está en
// una caja del 1 al 6; si lo sabes sube de caja y se repasa más espaciado
// (1, 2, 4, 8, 16 y 32 días); si no, vuelve a la 1. Tres formas de
// practicar: primeras letras, ocultar palabras y escribirlo (sin que
// importen tildes, mayúsculas ni puntuación).
// Datos en users/{uid}/meta/biblia_memoria: { items: { id: { libro, cap,
// vers, texto, version?, caja, proximo, creado, repasos, aciertos, ultimo } } }.
// Sin DOM ni Firebase: tests/biblia-memoria.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BibliaMemoria = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const INTERVALOS = [1, 2, 4, 8, 16, 32];   // días hasta el próximo repaso, por caja
const CAJA_MAX = INTERVALOS.length;

const aFecha = f => new Date(f + "T12:00:00Z");
function sumarDias(f, n) { const d = aFecha(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Id sin puntos (Firestore): "John_3_16-17", "Prov_3_5+6".
const idDe = (libro, cap, vers) => `${libro}_${cap}_${String(vers).replace(/,/g, "+")}`;

// Un versículo nuevo para memorizar: se repasa hoy mismo.
function nuevo(o, hoy, ahora) {
  const it = { libro: o.libro, cap: Number(o.cap), vers: String(o.vers), texto: String(o.texto || "").trim().slice(0, 2000),
    caja: 1, proximo: hoy, creado: ahora || 0, repasos: 0, aciertos: 0, ultimo: null };
  if (o.version) it.version = String(o.version).slice(0, 24);
  return it;
}
const valido = it => !!it && typeof it.texto === "string" && it.texto.trim() && typeof it.proximo === "string";

// Los que tocan hoy (o se pasaron), primero los más atrasados y de caja baja.
function paraHoy(items, hoy) {
  return Object.keys(items || {}).map(id => Object.assign({ id }, items[id])).filter(it => valido(it) && it.proximo <= hoy)
    .sort((a, b) => a.proximo.localeCompare(b.proximo) || a.caja - b.caja || a.id.localeCompare(b.id));
}

// resultado: "bien" (lo sabía), "duda" (me costó), "mal" (no lo sabía).
function calificar(it, resultado, hoy) {
  const caja = Math.max(1, Math.min(CAJA_MAX, Number(it.caja) || 1));
  const out = { repasos: (Number(it.repasos) || 0) + 1, aciertos: Number(it.aciertos) || 0, ultimo: hoy };
  if (resultado === "bien") {
    out.caja = Math.min(CAJA_MAX, caja + 1);
    out.aciertos++;
    out.proximo = sumarDias(hoy, INTERVALOS[out.caja - 1]);
  } else if (resultado === "duda") {
    out.caja = caja;
    out.proximo = sumarDias(hoy, 1);
  } else {
    out.caja = 1;
    out.proximo = sumarDias(hoy, 1);
  }
  return out;
}
const dominado = it => (Number(it.caja) || 1) >= CAJA_MAX;
// "hoy", "mañana", "en 4 días".
function cuando(proximo, hoy) {
  const n = diasEntre(hoy, proximo);
  return n <= 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`;
}

// ---- Formas de practicar ----
const palabras = texto => String(texto || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
// "Porque de tal manera…" → "P d t m…": la primera letra de cada palabra, con su puntuación.
function primerasLetras(texto) {
  return palabras(texto).map(w => {
    const m = /^([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]*)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]*(.*)$/.exec(w);
    return m ? m[1] + m[2] + m[3] : w;
  }).join(" ");
}
// Palabras con cuáles se ocultan. nivel 1 = una de cada tres, 2 = dos de
// cada tres, 3 = todas. Siempre las mismas para el mismo texto y nivel.
function ocultar(texto, nivel) {
  const n = Math.max(0, Math.min(3, Number(nivel) || 0));
  return palabras(texto).map((w, i) => ({ w, oculta: n >= 3 || (n === 2 && i % 3 !== 0) || (n === 1 && i % 3 === 1) }));
}
// Comparar lo escrito con el versículo, palabra por palabra (sin tildes,
// mayúsculas ni puntuación). → { pct, aciertos, total, ok, palabras: [{ w, ok }] }
const limpia = w => norm(w).replace(/[^a-z0-9ñ]+/g, "");
function comparar(escrito, original) {
  const a = palabras(escrito).map(limpia).filter(Boolean);
  const orig = palabras(original);
  const idx = [], b = [];                    // las palabras del original que cuentan (no solo signos)
  orig.forEach((w, k) => { const c = limpia(w); if (c) { idx.push(k); b.push(c); } });
  // La mayor subsecuencia común (LCS) entre las dos listas de palabras.
  const m = a.length, n = b.length;
  const tabla = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) {
    tabla[i][j] = a[i] === b[j] ? tabla[i + 1][j + 1] + 1 : Math.max(tabla[i + 1][j], tabla[i][j + 1]);
  }
  const bien = new Array(orig.length).fill(false);
  for (let i = 0, j = 0; i < m && j < n;) {
    if (a[i] === b[j]) { bien[idx[j]] = true; i++; j++; }
    else if (tabla[i + 1][j] >= tabla[i][j + 1]) i++;
    else j++;
  }
  const aciertos = bien.filter(Boolean).length;
  // Palabras de más (escribiste cosas que no están) también restan.
  const sobran = Math.max(0, m - aciertos);
  const pct = n ? Math.max(0, Math.round((aciertos - sobran * 0.5) / n * 100)) : 0;
  return { pct, aciertos, total: n, sobran, ok: pct >= 90, palabras: orig.map((w, k) => ({ w, ok: bien[k] || !limpia(w) })) };
}
// Calificación automática al escribirlo.
const resultadoDe = pct => (pct >= 90 ? "bien" : pct >= 60 ? "duda" : "mal");

return { INTERVALOS, CAJA_MAX, idDe, nuevo, valido, paraHoy, calificar, dominado, cuando, primerasLetras, ocultar, comparar, resultadoDe, sumarDias };
});
