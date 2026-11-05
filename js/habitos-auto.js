// ---------- Hábitos: "se marca solo" con los demás módulos (lógica pura) ----------
// Cada módulo avisa con sus datos (Running y Bici con "manolo:actividades";
// Movilidad, Libros, Biblia y Finanzas con "manolo:fuente"). Aquí se decide
// qué valor toca cada día a cada hábito vinculado y qué escribir o deshacer.
// Reglas (D-085):
// - Lo automático se guarda con `auto: { f: fuente, v: valor }` en el
//   registro del día. Si el registro no tiene `auto`, es manual y manda.
// - Si la actividad de origen desaparece, el registro automático se borra
//   (solo si no lo editaste a mano: al editarlo se le quita `auto`).
// - Sin datos del servidor (solo caché) no se deshace nada.
// - Rellenar días pasados es opcional y no da XP (marca de hora = ahora,
//   fuera de la ventana de 48 h).
// Tests: tests/habitos-auto.test.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HabitosAuto = factory();
})(typeof self !== "undefined" ? self : this, function () {

const esFecha = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r1 = v => Math.round(v * 10) / 10;

// Fuentes y medidas. medidas: qué puede sumar un Medible (o Tiempo).
const FUENTES = [
  { id: "running", nombre: "Running", accion: "Al guardar o importar una carrera", medidas: [["n", "carreras", "Sí/No"], ["km", "km", "Kilómetros"], ["min", "min", "Minutos"]] },
  { id: "bicicleta", nombre: "Bici", accion: "Al guardar o importar una rodada", medidas: [["n", "rodadas", "Sí/No"], ["km", "km", "Kilómetros"], ["min", "min", "Minutos"]] },
  { id: "movilidad", nombre: "Movilidad", accion: "Al completar una rutina", medidas: [["n", "rutinas", "Sí/No"], ["min", "min", "Minutos"]], rutina: true },
  { id: "libros", nombre: "Libros", accion: "Al anotar páginas leídas", medidas: [["n", "días", "Sí/No"], ["paginas", "páginas", "Páginas"]] },
  { id: "biblia", nombre: "Biblia", accion: "Al anotar una lectura", medidas: [["n", "lecturas", "Sí/No"]] },
  { id: "finanzas", nombre: "Finanzas", accion: "Al anotar un movimiento", medidas: [["n", "movimientos", "Sí/No"]] },
  // Para un hábito Evitar: un gasto en esa categoría es una recaída.
  { id: "gasto", nombre: "Finanzas", accion: "Un gasto en una categoría es una recaída", medidas: [["n", "gastos", "Recaída"]], categoria: true, evitar: true },
  // Gimnasio avisa al guardar un entreno (sin lista de datos: no deshace).
  { id: "gimnasio", nombre: "Gimnasio", accion: "Al guardar un entreno", medidas: [["n", "entrenos", "Sí/No"]], soloEvento: true }
];
const fuente = id => FUENTES.find(f => f.id === id) || null;

// Datos crudos de cada módulo → { fecha: { n, km, min, paginas } } con los
// filtros del vínculo (rutina de Movilidad, categoría de gasto).
function porDia(id, datos, cfg) {
  const c = cfg || {};
  const out = {};
  const sumar = (f, campos) => {
    if (!esFecha(f)) return;
    const d = out[f] || (out[f] = { n: 0, km: 0, min: 0, paginas: 0 });
    Object.keys(campos).forEach(k => { d[k] = r1(d[k] + num(campos[k])); });
  };
  if (id === "running" || id === "bicicleta") {
    (datos || []).forEach(a => sumar(a && a.date, { n: 1, km: a.distance, min: a.duration }));
  } else if (id === "movilidad") {
    (datos || []).forEach(s => { if (!c.rutina || s.rutinaId === c.rutina) sumar(s && s.fecha, { n: 1, min: num(s.duracionSeg) / 60 }); });
  } else if (id === "libros") {
    Object.keys(datos || {}).forEach(f => { const p = num(datos[f]); if (p > 0) sumar(f, { n: 1, paginas: p }); });
  } else if (id === "biblia") {
    (datos || []).forEach(l => sumar(l && l.fecha, { n: 1 }));
  } else if (id === "finanzas") {
    (datos || []).forEach(m => sumar(m && m.date, { n: 1 }));
  } else if (id === "gasto") {
    (datos || []).forEach(m => { if (m && m.type === "gasto" && (!c.categoria || m.category === c.categoria)) sumar(m.date, { n: 1 }); });
  }
  return out;
}

// La medida que usa un hábito: los Sí/No y Evitar cuentan si hubo algo; un
// Medible o Tiempo suma su medida (Tiempo = minutos).
function medidaDe(h) {
  const c = h.vinculoCfg || {};
  if (h.tipo === "tiempo") return "min";
  if (h.tipo === "medible") return c.medida && c.medida !== "n" ? c.medida : "n";
  return "n";
}
// Lo que vale un día para el hábito (0 = nada).
function valorDia(h, agg) {
  if (!agg) return 0;
  const v = num(agg[medidaDe(h)]);
  return h.tipo === "sino" || h.tipo === "evitar" ? (v > 0 ? 1 : 0) : r1(v);
}
// El registro automático de un día (sin la hora).
function registro(h, v) {
  if (!(v > 0)) return null;
  if (h.tipo === "evitar") return { e: "recaida", auto: { f: h.vinculo, v } };
  if (h.tipo === "medible" || h.tipo === "tiempo") return { v, auto: { f: h.vinculo, v } };
  return { e: "hecho", auto: { f: h.vinculo, v } };
}
const esAuto = r => !!(r && r.auto && typeof r.auto === "object");
const igual = (a, b) => a.e === b.e && num(a.v) === num(b.v) && a.auto.v === b.auto.v && a.auto.f === b.auto.f;

// Qué escribir en un hábito. h: hábito (normalizado o crudo, con vinculo,
// vinculoCfg, tipo, inicio, vinculoDesde); agg: porDia de su fuente;
// crudos: registros tal como están en Firestore; opciones: { hoy, ahora,
// servidor (datos completos: se puede deshacer), desde (para rellenar) }.
// Devuelve { poner: { fecha: registro }, quitar: [fechas] }.
function plan(h, agg, crudos, opciones) {
  const o = Object.assign({ servidor: true }, opciones);
  const regs = crudos || {};
  const desde = o.desde || h.vinculoDesde || h.inicio || o.hoy;
  const hasta = o.hoy;
  const poner = {}, quitar = [];
  if (!h.vinculo || !fuente(h.vinculo) || fuente(h.vinculo).soloEvento || h.archivado) return { poner, quitar };
  const fechas = new Set(Object.keys(agg || {}).filter(f => f >= desde && f <= hasta));
  Object.keys(regs).forEach(f => { if (f >= desde && f <= hasta && esAuto(regs[f])) fechas.add(f); });
  Array.from(fechas).sort().forEach(f => {
    const actual = regs[f];
    if (actual && !esAuto(actual)) return; // lo manual manda
    const nuevo = registro(h, valorDia(h, agg && agg[f]));
    if (!nuevo) { if (actual && o.servidor) quitar.push(f); return; }
    if (actual && igual(actual, nuevo)) return;
    // Conserva la hora del primer marcado (el XP depende de ella).
    poner[f] = Object.assign(nuevo, { t: actual && actual.t ? actual.t : o.ahora });
    if (actual && actual.n) poner[f].n = actual.n;
  });
  return { poner, quitar };
}

// Días del historial que se pueden rellenar al vincular (antes del vínculo,
// sin registro). maxDias: hasta cuántos días atrás.
function rellenables(h, agg, crudos, hoy, maxDias) {
  const regs = crudos || {};
  const limite = (() => { const [y, m, d] = hoy.split("-").map(Number); const x = new Date(y, m - 1, d - (maxDias || 365)); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
  return Object.keys(agg || {}).filter(f => f >= limite && f < hoy && !regs[f] && valorDia(h, agg[f]) > 0).sort();
}

return { FUENTES, fuente, porDia, medidaDe, valorDia, registro, esAuto, plan, rellenables };
});
