// ---------- Biblia: marcar lo que leíste en tu Biblia de papel (sin pantalla) ----------
// D-122 (pedido del dueño, 2026-11-15): "casi siempre leo la Biblia en
// físico; que marcar capítulos sea más sencillo". Aquí: qué capítulo sigue
// (el plan de hoy o el que viene después del último que marcaste), qué
// marcaste hoy, qué libros usaste hace poco y en qué estado está cada
// capítulo. Lo leído es meta/biblia_leidos ({ dias: { AAAA-MM-DD: ["Gen.1", …] } }),
// lo mismo que "Marcar como leído" del lector. Sin DOM ni Firebase:
// tests/biblia-marcar.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./biblia-motor.js"));
  else root.BibliaMarcar = factory(root.BibliaMotor);
})(typeof self !== "undefined" ? self : this, function (B) {
"use strict";

const clave = (libro, cap) => `${libro}.${cap}`;
function leer(k) {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)$/.exec(String(k || ""));
  const l = m && B.libro(m[1]);
  return l && Number(m[2]) >= 1 && Number(m[2]) <= l.capitulos ? { libro: l.id, cap: Number(m[2]) } : null;
}
const nombre = k => { const x = leer(k); return x ? `${B.libro(x.libro).nombre} ${x.cap}` : ""; };
const TOTAL = B.LIBROS.reduce((s, l) => s + l.capitulos, 0);

// El capítulo que viene (después de Apocalipsis 22, Génesis 1).
function siguienteDe(k) {
  const x = leer(k);
  if (!x) return clave(B.LIBROS[0].id, 1);
  const l = B.libro(x.libro);
  if (x.cap < l.capitulos) return clave(l.id, x.cap + 1);
  const otro = B.LIBROS[(l.orden + 1) % B.LIBROS.length];
  return clave(otro.id, 1);
}
const dias = leidos => Object.keys(leidos || {}).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Array.isArray(leidos[d])).sort();
// Todo lo leído (un Set de claves).
function todos(leidos) {
  const s = new Set();
  dias(leidos).forEach(d => leidos[d].forEach(k => { if (leer(k)) s.add(k); }));
  return s;
}
// El último que marcaste: el del día más reciente, el último de la lista.
function ultimo(leidos) {
  const ds = dias(leidos);
  for (let i = ds.length - 1; i >= 0; i--) {
    const xs = leidos[ds[i]].filter(k => leer(k));
    if (xs.length) return xs[xs.length - 1];
  }
  return null;
}
// Desde k, el primero que todavía no leíste (si ya leíste todo, k).
function primeroSinLeer(k, leidosSet) {
  let x = k;
  for (let i = 0; i < TOTAL; i++) {
    if (!leidosSet.has(x)) return x;
    x = siguienteDe(x);
  }
  return k;
}
// Qué sugerir para "Leí …". o: { plan: [claves que faltan hoy], lector: { libro, cap } }.
// → { tipo: "plan", claves } (todo lo de hoy de tu plan) o { tipo: "uno", clave }.
function sugerir(leidos, o) {
  const op = o || {};
  const plan = (op.plan || []).filter(k => leer(k));
  if (plan.length) return { tipo: "plan", claves: plan };
  const set = todos(leidos);
  const u = ultimo(leidos);
  if (u) return { tipo: "uno", clave: primeroSinLeer(siguienteDe(u), set) };
  const lec = op.lector && leer(clave(op.lector.libro, op.lector.cap)) ? clave(op.lector.libro, op.lector.cap) : null;
  return { tipo: "uno", clave: primeroSinLeer(lec || clave(B.LIBROS[0].id, 1), set) };
}
// Estado de un capítulo: { leido, hoy (marcado hoy), fecha (la última vez) }.
function estado(leidos, k, hoy) {
  let fecha = null;
  dias(leidos).forEach(d => { if (leidos[d].includes(k)) fecha = d; });
  return { leido: !!fecha, hoy: !!(leidos && Array.isArray(leidos[hoy]) && leidos[hoy].includes(k)), fecha };
}
// Lo que marcaste hoy, en el orden de la Biblia.
function deHoy(leidos, hoy) {
  const xs = (leidos && Array.isArray(leidos[hoy]) ? leidos[hoy] : []).filter(k => leer(k));
  const pos = k => { const x = leer(k); return B.libro(x.libro).orden * 1000 + x.cap; };
  return Array.from(new Set(xs)).sort((a, b) => pos(a) - pos(b));
}
// Libros donde marcaste hace poco (el más reciente primero, sin repetir).
function recientes(leidos, n) {
  const out = [];
  const ds = dias(leidos);
  for (let i = ds.length - 1; i >= 0 && out.length < (n || 4); i--) {
    const xs = leidos[ds[i]].map(leer).filter(Boolean);
    for (let j = xs.length - 1; j >= 0 && out.length < (n || 4); j--) if (!out.includes(xs[j].libro)) out.push(xs[j].libro);
  }
  return out;
}
// Capítulos leídos de un libro.
function delLibro(leidos, libro) {
  const l = B.libro(libro);
  if (!l) return { leidos: 0, total: 0 };
  const set = todos(leidos);
  let n = 0;
  for (let c = 1; c <= l.capitulos; c++) if (set.has(clave(l.id, c))) n++;
  return { leidos: n, total: l.capitulos };
}
// "Génesis 1–3, Éxodo 2" (para avisos).
function texto(keys) {
  const grupos = [];
  (keys || []).map(leer).filter(Boolean).forEach(k => {
    const g = grupos[grupos.length - 1];
    if (g && g.libro === k.libro && k.cap === g.hasta + 1) g.hasta = k.cap;
    else grupos.push({ libro: k.libro, desde: k.cap, hasta: k.cap });
  });
  return grupos.map(g => `${B.libro(g.libro).nombre} ${g.desde}${g.hasta > g.desde ? `–${g.hasta}` : ""}`).join(", ");
}

return { clave, leer, nombre, siguienteDe, todos, ultimo, sugerir, estado, deHoy, recientes, delLibro, texto };
});
