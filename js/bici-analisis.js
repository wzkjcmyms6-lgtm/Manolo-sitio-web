// ---------- Bici: análisis de tus rodadas (sin pantalla, D-141) ----------
// Lo propio de bici sobre las rodadas de users/{uid}/bicicleta: velocidad,
// filtros del feed, récords por distancia (`mejoresBici`, guardados una vez
// por rodada: 5 a 160 km), medallas, los récords sueltos (la más larga, la
// de más desnivel, la más rápida, la velocidad máxima), el número de
// Eddington y el "Resumen inteligente" de una rodada (frases armadas solo
// con datos reales, sin consejos de salud). Lo que no cambia entre deportes
// (períodos, calendario, metas, racha) sigue en js/run-analisis.js.
// Pruebas: tests/bici-analisis.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-metricas.js"), require("./run-analisis.js"), require("./run-vista.js"));
  else root.BiciAnalisis = factory(root.RunMetricas, root.RunAnalisis, root.RunVista);
})(typeof self !== "undefined" ? self : this, function (M, A, V) {
"use strict";

const DIST = M.DISTANCIAS_BICI;
const NOMBRES = {};
DIST.forEach(([m, clave, nombre]) => { NOMBRES[clave] = { m, nombre }; });
const DIA = 86400000;
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const distM = d => (num(d.distanciaM) > 0 ? num(d.distanciaM) : num(d.distance) * 1000);
const movS = d => (num(d.tiempoMovS) > 0 ? num(d.tiempoMovS) : num(d.tiempoActivoS) > 0 ? num(d.tiempoActivoS) : num(d.duration) * 60);
const desn = d => (d.desnivelCorr ? num(d.desnivelCorr.pos) : num(d.desnivelPosM));
// km/h en movimiento (0 si falta la distancia o el tiempo).
function velocidad(d) {
  const t = movS(d), m = distM(d);
  return t > 0 && m > 0 ? (m / 1000) / (t / 3600) : 0;
}
const kmh = v => `${V.numero(v, 1)} km/h`;
const esManual = d => !d.fuente && !(Number(d.inicio) > 0);

// ---- Filtros del feed ----
const LARGA_KM = 50;
const FILTROS = [["todas", "Todas"], ["mapa", "Con mapa"], ["mano", "A mano"], ["largas", "Largas"]];
const PASA = {
  todas: () => true,
  mapa: d => !!(d.conRuta && d.mini),
  mano: esManual,
  largas: d => distM(d) >= LARGA_KM * 1000
};

// ---- Récords por distancia (mejoresBici) ----
// Medallas de cada rodada: id → [{ clave, nombre, t, puesto }], con las 3
// mejores hasta ese día (como era cuando saliste), como en Running.
function logrosPorId(docs) {
  const out = {};
  const orden = (docs || []).slice().sort((a, b) => A.momento(a) - A.momento(b));
  DIST.forEach(([, clave, nombre]) => {
    const top = [];
    orden.forEach(d => {
      const t = d.mejoresBici && d.mejoresBici[clave];
      if (!(t > 0)) return;
      let i = top.findIndex(x => t < x);
      if (i < 0) i = top.length;
      if (i >= 3) return;
      top.splice(i, 0, t);
      if (top.length > 3) top.pop();
      (out[d.id] = out[d.id] || []).push({ clave, nombre, t, puesto: i + 1 });
    });
  });
  return out;
}
// Las medallas de una rodada (para su detalle).
function logros(doc, todos) {
  if (!doc || !doc.mejoresBici) return [];
  const hasta = A.momento(doc);
  const lista = (todos || []).filter(d => d.id !== doc.id && A.momento(d) <= hasta).concat([doc]);
  return logrosPorId(lista)[doc.id] || [];
}
// Tus mejores tiempos por distancia: [{ clave, nombre, m, top: [{ id, t, kmh, date, titulo }] }].
function mejoresTiempos(docs, n) {
  return DIST.map(([m, clave, nombre]) => {
    const top = (docs || []).filter(d => d.mejoresBici && d.mejoresBici[clave] > 0)
      .map(d => ({ id: d.id, t: d.mejoresBici[clave], kmh: (m / 1000) / (d.mejoresBici[clave] / 3600), date: d.date, titulo: d.titulo || "", inicio: A.momento(d) }))
      .sort((a, b) => a.t - b.t || a.inicio - b.inicio)
      .slice(0, n || 3);
    return { clave, nombre, m, top };
  }).filter(x => x.top.length);
}
// Cómo fue mejorando una distancia: cada esfuerzo con la mejor marca hasta ese día.
function evolucion(docs, clave) {
  const lista = (docs || []).filter(d => d.mejoresBici && d.mejoresBici[clave] > 0)
    .map(d => ({ id: d.id, inicio: A.momento(d), date: d.date, t: d.mejoresBici[clave] }))
    .sort((a, b) => a.inicio - b.inicio);
  let mejor = Infinity;
  return lista.map(e => { mejor = Math.min(mejor, e.t); return Object.assign(e, { mejor }); });
}
// Los récords de bici de una rodada a partir de su ruta guardada (rutas/{id}),
// para las que se importaron antes (D-142): se calculan una vez y se guardan.
// → { "5000": segundos, … } ({} si la ruta no sirve o es corta).
function mejoresDeRuta(ruta) {
  const pts = [].concat(...M.leerRuta(ruta)).filter(p => p && p.t > 0);
  if (pts.length < 2) return {};
  const D = [], T = [];
  let acum = 0;
  pts.forEach((p, i) => {
    // La distancia acumulada guardada; si no está (rutas viejas), por GPS.
    if (p.d != null) acum = p.d;
    else if (i && p.lat != null && pts[i - 1].lat != null) acum += M.haversine(pts[i - 1], p);
    D.push(acum);
    T.push((p.t - pts[0].t) / 1000);
  });
  for (let i = 1; i < D.length; i++) if (D[i] < D[i - 1]) D[i] = D[i - 1];
  return M.mejoresMarcas(D, T, DIST);
}
// Las rodadas a las que les faltan los récords de bici (con ruta y sin calcular).
const sinRecords = docs => (docs || []).filter(d => d.conRuta && !d.mejoresBici);
// Los récords sueltos: { larga, subida, rapida (≥ 20 km), vmax } → { doc, valor } o null.
function records(docs) {
  const xs = docs || [];
  const mayor = (lista, f) => lista.reduce((b, d) => (f(d) > 0 && (!b || f(d) > f(b.doc)) ? { doc: d, valor: f(d) } : b), null);
  return {
    larga: mayor(xs, distM),
    subida: mayor(xs, desn),
    rapida: mayor(xs.filter(d => distM(d) >= 20000), velocidad),
    // Más de 120 km/h es un error del GPS, no una bajada.
    vmax: mayor(xs.filter(d => num(d.velMaxKmh) <= 120), d => num(d.velMaxKmh))
  };
}

// ---- Número de Eddington ----
// El E más grande con E días de al menos E km (sumando las rodadas de cada
// día) y cuántos días de al menos E + 1 km faltan para subir.
function eddington(docs) {
  const porDia = {};
  (docs || []).forEach(d => { if (d.date) porDia[d.date] = (porDia[d.date] || 0) + distM(d) / 1000; });
  const kms = Object.keys(porDia).map(k => porDia[k]).sort((a, b) => b - a);
  let e = 0;
  while (e < kms.length && kms[e] >= e + 1) e++;
  const siguiente = e + 1;
  const tienen = kms.filter(k => k >= siguiente).length;
  return { e, siguiente, tienen, faltan: Math.max(0, siguiente - tienen), dias: kms.length };
}

// ---- "Resumen inteligente" de una rodada: 2 a 4 frases ----
function resumen(doc, todos) {
  if (!doc) return [];
  const frases = [];
  const dist = distM(doc), t = movS(doc), v = velocidad(doc), cuando = A.momento(doc);
  const antes = (todos || []).filter(d => d.id !== doc.id && A.momento(d) < cuando);
  // 1. Récords de bici de esta rodada.
  const ls = logros(doc, todos);
  const oro = ls.filter(l => l.puesto === 1);
  if (oro.length) {
    const nombres = oro.map(l => l.nombre);
    const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0];
    frases.push(`${oro.length > 1 ? "Récords" : "Récord"} de bici en ${lista} (${oro.map(l => V.tiempo(l.t)).join(", ")}).`);
  } else if (ls.length) {
    const l = ls.slice().sort((a, b) => a.puesto - b.puesto || DIST.findIndex(x => x[1] === b.clave) - DIST.findIndex(x => x[1] === a.clave))[0];
    frases.push(`Tu ${l.puesto === 2 ? "2.ª" : "3.ª"} mejor marca en ${l.nombre}: ${V.tiempo(l.t)}.`);
  }
  // 2. La más larga (de siempre o del año).
  if (dist > 0 && antes.length >= 3 && antes.every(d => distM(d) < dist)) frases.push(`Tu rodada más larga: ${V.km(dist, 1)}.`);
  else if (dist > 0) {
    const anio = String(doc.date || "").slice(0, 4);
    const delAnio = antes.filter(d => String(d.date || "").slice(0, 4) === anio);
    if (delAnio.length >= 3 && delAnio.every(d => distM(d) < dist)) frases.push(`La más larga del año: ${V.km(dist, 1)}.`);
  }
  // 3. Velocidad contra tu promedio del último mes en distancias parecidas (±30 %).
  if (v > 0 && dist >= 3000) {
    const parecidas = antes.filter(d => A.momento(d) >= cuando - 30 * DIA && velocidad(d) > 0 && Math.abs(distM(d) - dist) / dist <= 0.3);
    if (parecidas.length >= 2) {
      const prom = parecidas.reduce((s, d) => s + velocidad(d), 0) / parecidas.length;
      const dif = v - prom;
      if (Math.abs(dif) >= 0.5) frases.push(`${kmh(v)}: ${V.numero(Math.abs(dif), 1)} km/h ${dif > 0 ? "más rápido" : "más lento"} que tu promedio del último mes en distancias parecidas.`);
      else frases.push(`${kmh(v)}, igual a tu promedio del último mes en distancias parecidas.`);
    }
  }
  // 4. Desnivel y altura.
  const dz = desn(doc);
  if (dz >= 300) frases.push(`Con ${V.metros(dz)} de desnivel positivo${num(doc.altMaxM) > 0 ? `; llegaste a ${V.metros(doc.altMaxM)} de altura` : ""}.`);
  // 5. Tu semana hasta esta rodada.
  if (frases.length < 4 && doc.date) {
    const lun = A.lunes(doc.date);
    const semana = antes.filter(d => d.date >= lun && d.date <= doc.date).concat([doc]);
    const kmSem = semana.reduce((s, d) => s + distM(d), 0);
    if (semana.length >= 2 && kmSem > dist) frases.push(`Llevas ${V.km(kmSem, 1)} en bici esta semana (${semana.length} rodadas).`);
  }
  if (frases.length < 2 && dist > 0 && t > 0) frases.unshift(`${V.km(dist, 1)} en ${V.tiempo(t)} (${kmh(v)}).`);
  return frases.slice(0, 4);
}

// ---- Tarjeta de Inicio: los km de la semana y la última rodada ----
function inicio(docs, hoy) {
  const xs = docs || [];
  if (!xs.length) return null;
  const lun = A.lunes(hoy);
  const kmSemana = xs.filter(d => d.date >= lun && d.date <= hoy).reduce((s, d) => s + distM(d), 0) / 1000;
  const ultima = xs.slice().sort((a, b) => A.momento(b) - A.momento(a))[0];
  return { kmSemana, ultima, kmUltima: distM(ultima) / 1000 };
}

return { DIST, NOMBRES, FILTROS, PASA, LARGA_KM, distM, movS, desn, velocidad, esManual, logrosPorId, logros, mejoresTiempos, evolucion, mejoresDeRuta, sinRecords, records, eddington, resumen, inicio };
});
