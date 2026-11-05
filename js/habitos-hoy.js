// ---------- Hábitos: cómo se arma la lista de Hoy (lógica pura) ----------
// Filtrar por categoría, agrupar por momento o por categoría (las cadenas
// "Después de…" van en el grupo de su primer eslabón), ocultar lo hecho y
// el progreso de cada grupo. Sin DOM: lo dibuja js/habitos.js.
// Tests: tests/habitos-hoy.test.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./habitos-config.js"));
  else root.HabitosHoy = factory(root.HabitosConfig);
})(typeof self !== "undefined" ? self : this, function (CFG) {

const SIN = "_sin"; // grupo/filtro "Sin categoría"

// Primer eslabón de la cadena que también está en la lista de hoy.
function raiz(h, porId) {
  let r = h;
  const vistos = new Set([h.id]);
  while (r.despuesDe && porId.has(r.despuesDe) && !vistos.has(r.despuesDe)) { r = porId.get(r.despuesDe); vistos.add(r.id); }
  return r;
}

// Momentos en el orden de Hoy: el actual primero, luego "cualquiera" y el resto.
function ordenMomentos(actual) {
  return [actual, "cualquiera"].concat(["manana", "tarde", "noche"].filter(m => m !== actual));
}

// "HH:MM" válido o "".
const hora = v => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");

// Ordena dentro de un grupo: primero los que tienen hora (de más temprano a
// más tarde), luego el resto en su orden; cada cadena sigue a su eslabón.
function ordenarGrupo(items) {
  const porId = new Map(items.map(x => [x.id, x]));
  const clave = x => { const r = raiz(x, porId); return hora(r.hora) || "99:99"; };
  const pos = new Map(items.map((x, i) => [x.id, i]));
  const raices = items.filter(x => raiz(x, porId) === x).sort((a, b) => clave(a).localeCompare(clave(b)) || pos.get(a.id) - pos.get(b.id));
  const hijos = new Map();
  items.forEach(x => {
    const r = x.despuesDe && porId.get(x.despuesDe);
    if (r && raiz(x, porId) !== x) { if (!hijos.has(r.id)) hijos.set(r.id, []); hijos.get(r.id).push(x); }
  });
  const out = [], puesto = new Set();
  const poner = x => { if (puesto.has(x.id)) return; puesto.add(x.id); out.push(x); (hijos.get(x.id) || []).forEach(poner); };
  raices.forEach(poner);
  items.forEach(poner);
  return out;
}

// items: hábitos que tocan hoy, ya en su orden, con { id, area, timeOfDay,
// despuesDe, hora, hecho, cuenta } (cuenta: false = no entra en el progreso,
// como los de Evitar, que se cumplen solos). opciones: { agrupar: "momento" | "categoria",
// filtro: id de categoría | "_sin" | null, ocultarHechos, momento (actual),
// categorias: lista de js/habitos-categorias.js (activas y archivadas) }.
// Devuelve [{ id, tipo, nombre, emoji?, color?, ahora?, items, hechos, total }].
function grupos(items, opciones) {
  const o = Object.assign({ agrupar: "momento", filtro: null, ocultarHechos: false, momento: "manana", categorias: [] }, opciones);
  const cats = o.categorias || [];
  const catDe = id => (id && cats.find(c => c.id === id)) || null;
  const filtrados = items.filter(x => !o.filtro || (o.filtro === SIN ? !catDe(x.area) : x.area === o.filtro));
  const porId = new Map(filtrados.map(x => [x.id, x]));
  const claveDe = x => {
    const r = raiz(x, porId);
    if (o.agrupar === "categoria") { const c = catDe(r.area); return c ? c.id : SIN; }
    return CFG.MOMENTOS.some(m => m.id === r.timeOfDay) ? r.timeOfDay : "cualquiera";
  };
  const orden = o.agrupar === "categoria" ? cats.map(c => c.id).concat([SIN]) : ordenMomentos(o.momento);
  const mapa = new Map(orden.map(k => [k, []]));
  filtrados.forEach(x => { const k = claveDe(x); if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(x); });
  const out = [];
  mapa.forEach((lista, k) => {
    if (!lista.length) return;
    const ordenados = ordenarGrupo(lista);
    const cuentan = lista.filter(x => x.cuenta !== false);
    const g = { id: k, tipo: o.agrupar, items: o.ocultarHechos ? ordenados.filter(x => !x.hecho) : ordenados, hechos: cuentan.filter(x => x.hecho).length, total: cuentan.length };
    if (o.agrupar === "categoria") {
      const c = catDe(k);
      Object.assign(g, c ? { nombre: c.nombre, emoji: c.emoji, color: c.color } : { nombre: "Sin categoría" });
    } else {
      Object.assign(g, { nombre: CFG.MOMENTOS.find(m => m.id === k).nombre, ahora: k === o.momento });
    }
    out.push(g);
  });
  return out;
}

// Chips de filtro: "Todas" y cada categoría con hábitos hoy, con cuántos
// quedan pendientes. Solo categorías activas (y "Sin categoría" si hay).
function filtros(items, categorias) {
  const cats = (categorias || []).filter(c => !c.archivada);
  const pend = x => !x.hecho && x.cuenta !== false;
  const out = [{ id: null, nombre: "Todas", pendientes: items.filter(pend).length, total: items.length }];
  cats.forEach(c => {
    const de = items.filter(x => x.area === c.id);
    if (de.length) out.push({ id: c.id, nombre: c.nombre, emoji: c.emoji, color: c.color, pendientes: de.filter(pend).length, total: de.length });
  });
  const sin = items.filter(x => !cats.some(c => c.id === x.area));
  if (sin.length && out.length > 1) out.push({ id: SIN, nombre: "Sin categoría", pendientes: sin.filter(pend).length, total: sin.length });
  return out;
}

// Pendientes del momento actual (para el aviso "Te faltan 2 de la mañana").
function pendientesMomento(items, momento) {
  const porId = new Map(items.map(x => [x.id, x]));
  return items.filter(x => !x.hecho && x.cuenta !== false && raiz(x, porId).timeOfDay === momento).length;
}

return { SIN, raiz, ordenMomentos, ordenarGrupo, grupos, filtros, pendientesMomento, hora };
});
