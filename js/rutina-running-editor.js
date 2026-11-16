// ---------- Rutinas de Running: editor en la app (lógica, sin pantalla) ----------
// Crear y editar una rutina guiada sin CSV (D-124). La rutina se arma con
// "pasos": un intervalo suelto, o una serie que se repite
// ("4 × correr 1:00 + caminar 1:30"). Al guardar, los pasos se convierten en
// la lista de intervalos de siempre (la que usa la rutina en vivo,
// js/rutina-guiada.js) y se guardan también los pasos (campo opcional
// «bloques») para volver a editarla igual. Las rutinas sin «bloques» (las
// importadas de un CSV) se agrupan solas al editarlas.
// Pantalla en js/rutina-running-editor-ui.js; límites y tipos de
// js/rutina-running.js. Pruebas: tests/rutina-running-editor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./rutina-running.js"));
  else root.RREditor = factory(root.RutinaRunning);
})(typeof self !== "undefined" ? self : this, function (RR) {
"use strict";

const L = RR.LIMITES;
const REPETIR_MAX = 50;
const SERIE_MAX = 10;          // intervalos dentro de una serie

const texto = t => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, L.texto);
const intervalo = x => ({
  tipo: RR.TIPOS.includes(x && x.tipo) ? x.tipo : "correr",
  seg: Math.round(Number(x && x.seg) || 0),
  texto: texto(x && x.texto)
});
const esSerie = b => !!b && Array.isArray(b.intervalos);
const veces = n => Math.round(Number(n) || 0);

// Rutina nueva: calentamiento, 4 × (correr 1:00 + caminar 1:30) y
// enfriamiento. 20 minutos; se cambia lo que haga falta.
function nueva() {
  return [
    { tipo: "caminar", seg: 300, texto: "Calentamiento" },
    { repetir: 4, intervalos: [{ tipo: "correr", seg: 60, texto: "" }, { tipo: "caminar", seg: 90, texto: "" }] },
    { tipo: "caminar", seg: 300, texto: "Enfriamiento" }
  ];
}
// Paso nuevo al tocar "+ Intervalo": lo contrario del último (después de
// correr, caminar), con la duración del último de ese tipo.
function siguientePaso(intervalos) {
  const xs = (intervalos || []).map(intervalo);
  const ult = xs[xs.length - 1];
  const tipo = !ult ? "correr" : ult.tipo === "caminar" || ult.tipo === "descanso" ? "correr" : "caminar";
  const igual = xs.slice().reverse().find(x => x.tipo === tipo);
  return { tipo, seg: igual ? igual.seg : 60, texto: "" };
}

// Los pasos → la lista de intervalos (las series se repiten).
function expandir(bloques) {
  const out = [];
  (bloques || []).forEach(b => {
    if (esSerie(b)) {
      const n = Math.max(1, Math.min(REPETIR_MAX, veces(b.repetir) || 1));
      for (let k = 0; k < n; k++) b.intervalos.forEach(x => out.push(intervalo(x)));
    } else if (b) out.push(intervalo(b));
  });
  return out;
}

// La lista de intervalos → pasos: lo que se repite seguido (un grupo de 2 a
// 6 intervalos, al menos 2 veces) queda como serie. Siempre vale
// expandir(agrupar(x)) = x.
const igual = (a, b) => a.tipo === b.tipo && a.seg === b.seg && a.texto === b.texto;
function seRepite(xs, a, b, k) {
  for (let j = 0; j < k; j++) if (!igual(xs[a + j], xs[b + j])) return false;
  return true;
}
function agrupar(intervalos) {
  const xs = (intervalos || []).map(intervalo);
  const out = [];
  let i = 0;
  while (i < xs.length) {
    let mejor = null;
    for (let k = 2; k <= 6 && i + 2 * k <= xs.length; k++) {
      // Un grupo de intervalos todos iguales no es una serie.
      if (xs.slice(i, i + k).every(x => igual(x, xs[i]))) continue;
      let n = 1;
      while (i + (n + 1) * k <= xs.length && seRepite(xs, i, i + n * k, k)) n++;
      if (n >= 2 && (!mejor || n * k > mejor.n * mejor.k)) mejor = { k, n };
    }
    if (mejor) {
      out.push({ repetir: mejor.n, intervalos: xs.slice(i, i + mejor.k) });
      i += mejor.n * mejor.k;
    } else out.push(xs[i++]);
  }
  return out;
}
const mismos = (a, b) => a.length === b.length && a.every((x, i) => igual(x, b[i]));
// Los pasos para editar una rutina guardada: los suyos si coinciden con sus
// intervalos (si alguien cambió los intervalos por otro lado, se agrupan de
// nuevo).
function bloquesDe(r) {
  const xs = ((r && r.intervalos) || []).map(intervalo);
  if (r && Array.isArray(r.bloques) && r.bloques.length && mismos(expandir(r.bloques), xs)) return copiar(r.bloques);
  return agrupar(xs);
}
function copiar(bloques) {
  return (bloques || []).map(b => (esSerie(b) ? { repetir: veces(b.repetir), intervalos: b.intervalos.map(intervalo) } : intervalo(b)));
}

// ---- Duración en dos casillas (min y s) ----
const partes = seg => ({ min: Math.floor(Math.max(0, Math.round(Number(seg) || 0)) / 60), seg: Math.max(0, Math.round(Number(seg) || 0)) % 60 });
function segDe(min, seg) {
  const n = v => {
    const s = String(v == null ? "" : v).trim().replace(",", ".");
    if (!s) return 0;
    const x = Number(s);
    return isFinite(x) && x >= 0 ? x : NaN;
  };
  const t = n(min) * 60 + n(seg);
  return isFinite(t) ? Math.round(t) : NaN;
}
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---- Revisar antes de guardar ----
// → { ok, errores: [{ texto, paso, sub, campo }], bloques, intervalos, totalSeg }.
// paso: índice del paso (desde 0); sub: índice dentro de la serie.
function validar(nombre, bloques) {
  const errores = [];
  const err = (t, paso, sub, campo) => errores.push({ texto: t, paso: paso == null ? null : paso, sub: sub == null ? null : sub, campo: campo || null });
  if (!String(nombre || "").trim()) err("Ponle un nombre a la rutina.", null, null, "nombre");
  const limpios = copiar(bloques);
  const duracion = (x, donde, paso, sub) => {
    if (!isFinite(x.seg) || x.seg < L.segMin) err(`${donde} dura muy poco (mínimo ${L.segMin} segundos).`, paso, sub, "dur");
    else if (x.seg > L.segMax) err(`${donde} dura más de 2 horas.`, paso, sub, "dur");
  };
  limpios.forEach((b, i) => {
    if (esSerie(b)) {
      if (!b.intervalos.length) err(`La serie del paso ${i + 1} no tiene intervalos.`, i, null, "serie");
      if (b.intervalos.length > SERIE_MAX) err(`La serie del paso ${i + 1} tiene más de ${SERIE_MAX} intervalos.`, i, null, "serie");
      if (!(b.repetir >= 1 && b.repetir <= REPETIR_MAX)) err(`La serie del paso ${i + 1} se repite de 1 a ${REPETIR_MAX} veces.`, i, null, "veces");
      b.intervalos.forEach((x, j) => duracion(x, `En la serie del paso ${i + 1}, el intervalo ${j + 1}`, i, j));
    } else duracion(b, `El paso ${i + 1}`, i, null);
  });
  const intervalos = expandir(limpios);
  const totalSeg = intervalos.reduce((s, x) => s + (isFinite(x.seg) ? x.seg : 0), 0);
  if (!intervalos.length) err("Agrega al menos un intervalo.", null, null, "pasos");
  else if (intervalos.length > L.intervalos) err(`Son ${intervalos.length} intervalos; el máximo es ${L.intervalos}.`, null, null, "pasos");
  if (totalSeg > L.totalMax) err(`La rutina dura ${Math.round(totalSeg / 60)} minutos; el máximo es 4 horas.`, null, null, "pasos");
  return { ok: !errores.length, errores, bloques: limpios, intervalos, totalSeg };
}

// "12 intervalos · 20 min" (o "45 s" si es menos de un minuto).
function resumen(bloques) {
  const xs = expandir(bloques).filter(x => isFinite(x.seg) && x.seg > 0);
  const total = xs.reduce((s, x) => s + x.seg, 0);
  const dur = total < 60 ? `${total} s` : total % 60 ? `${Math.floor(total / 60)} min ${total % 60} s` : `${total / 60} min`;
  return `${xs.length} ${xs.length === 1 ? "intervalo" : "intervalos"} · ${dur}`;
}

// Lo que se guarda en users/{uid}/rutinas_running (más creado/orden/plan/dia).
function aGuardar(nombre, v) {
  return { v: 1, nombre: String(nombre || "").trim().slice(0, L.nombre), intervalos: v.intervalos, totalSeg: v.totalSeg, bloques: v.bloques };
}

// ---- La lista (cola) ----
const ordenDe = r => (typeof r.orden === "number" && isFinite(r.orden) ? r.orden : 0);
// Justo después de la rutina id (entre ella y la que sigue).
function ordenDespues(rutinas, id) {
  const lista = RR.ordenarCola(rutinas);
  const i = lista.findIndex(r => r.id === id);
  if (i < 0 || i === lista.length - 1) return RR.ordenAlFinal(lista);
  return (ordenDe(lista[i]) + ordenDe(lista[i + 1])) / 2;
}
// Arriba de todas ("Hacer la siguiente").
function ordenPrimero(rutinas) {
  const lista = RR.ordenarCola(rutinas);
  return lista.length ? ordenDe(lista[0]) - 1 : 0;
}
// "Rutina (copia)", "Rutina (copia 2)"…
function nombreCopia(nombre, nombres) {
  const base = String(nombre || "").replace(/\s*\(copia(?: \d+)?\)\s*$/i, "").trim() || "Rutina";
  const usados = new Set((nombres || []).map(n => String(n || "").trim().toLowerCase()));
  for (let n = 1; ; n++) {
    const fin = n === 1 ? " (copia)" : ` (copia ${n})`;
    const cand = base.slice(0, L.nombre - fin.length).trim() + fin;
    if (!usados.has(cand.toLowerCase())) return cand;
  }
}
// La copia de una rutina: un día de un plan se copia como un día nuevo al
// final de ese plan; una rutina suelta, con "(copia)" en el nombre.
function copia(r, rutinas) {
  const base = { v: 1, intervalos: (r.intervalos || []).map(intervalo), totalSeg: (r.intervalos || []).reduce((s, x) => s + (Number(x.seg) || 0), 0) };
  if (Array.isArray(r.bloques) && r.bloques.length) base.bloques = copiar(r.bloques);
  if (r.plan) {
    const dias = (rutinas || []).filter(x => x.plan === r.plan).map(x => Number(x.dia) || 0);
    return Object.assign(base, { nombre: r.nombre, plan: r.plan, dia: Math.max(0, ...dias) + 1 });
  }
  return Object.assign(base, { nombre: nombreCopia(r.nombre, (rutinas || []).filter(x => !x.plan).map(x => x.nombre)) });
}

return {
  REPETIR_MAX, SERIE_MAX, nueva, siguientePaso, expandir, agrupar, bloquesDe, copiar,
  partes, segDe, mmss, validar, resumen, aGuardar, ordenDespues, ordenPrimero, nombreCopia, copia
};
});
