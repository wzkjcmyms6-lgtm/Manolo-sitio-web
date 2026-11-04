// ---------- Running: inteligencia por reglas (sin pantalla, fase 5) ----------
// "Mismo recorrido": otras carreras con inicio y fin cerca (≤ 200 m),
// distancia parecida (±5 %) y la misma forma (20 puntos repartidos a lo largo
// de cada ruta, a ≤ 150 m de media). Usa la mini ruta guardada en cada
// actividad: no lee rutas completas.
// "Resumen inteligente": 2 a 4 frases armadas solo con datos reales de la
// carrera y de tu historial (marcas, recorrido repetido, ritmo contra tu
// promedio reciente, parciales, desnivel, zonas, semana). Sin consejos de
// salud. Pruebas: tests/run-inteligencia.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-metricas.js"), require("./run-analisis.js"), require("./run-vista.js"));
  else root.RunInteligencia = factory(root.RunMetricas, root.RunAnalisis, root.RunVista);
})(typeof self !== "undefined" ? self : this, function (M, A, V) {
"use strict";

const RADIO_EXTREMOS = 200, MARGEN_DIST = 0.05, PUNTOS_FORMA = 20, FORMA_MAX = 150;
const cache = new Map();
function puntos(doc) {
  if (!doc || !doc.mini) return null;
  const k = `${doc.id}|${doc.mini.length}`;
  if (!cache.has(k)) {
    if (cache.size > 2000) cache.clear();
    cache.set(k, M.leerMini(doc.mini));
  }
  return cache.get(k);
}
// N puntos a distancias iguales a lo largo del trazo.
function remuestrear(pts, n) {
  if (!pts || pts.length < 2) return null;
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + M.haversine(pts[i - 1], pts[i]));
  const total = acum[acum.length - 1];
  if (!(total > 0)) return null;
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = total * k / (n - 1);
    while (j < pts.length - 1 && acum[j] < d) j++;
    const seg = acum[j] - acum[j - 1];
    const f = seg > 0 ? (d - acum[j - 1]) / seg : 0;
    out.push({ lat: pts[j - 1].lat + f * (pts[j].lat - pts[j - 1].lat), lon: pts[j - 1].lon + f * (pts[j].lon - pts[j - 1].lon) });
  }
  return out;
}
const distM = d => (Number(d.distanciaM) > 0 ? Number(d.distanciaM) : (Number(d.distance) || 0) * 1000);
const movS = d => (Number(d.tiempoMovS) > 0 ? Number(d.tiempoMovS) : Number(d.tiempoActivoS) > 0 ? Number(d.tiempoActivoS) : (Number(d.duration) || 0) * 60);

function parecidas(a, b) {
  const da = distM(a), db = distM(b);
  if (!(da > 0 && db > 0) || Math.abs(da - db) / Math.max(da, db) > MARGEN_DIST) return false;
  const pa = puntos(a), pb = puntos(b);
  if (!pa || !pb || pa.length < 2 || pb.length < 2) return false;
  if (M.haversine(pa[0], pb[0]) > RADIO_EXTREMOS || M.haversine(pa[pa.length - 1], pb[pb.length - 1]) > RADIO_EXTREMOS) return false;
  const ra = remuestrear(pa, PUNTOS_FORMA), rb = remuestrear(pb, PUNTOS_FORMA);
  if (!ra || !rb) return false;
  const media = ra.reduce((s, p, i) => s + M.haversine(p, rb[i]), 0) / PUNTOS_FORMA;
  return media <= FORMA_MAX;
}
// → { veces, lista: [{ id, date, inicio, t, ritmo, titulo, esta }] por fecha (nueva primero), puesto, mejor }
function mismoRecorrido(doc, todos) {
  if (!doc || !doc.mini) return null;
  const iguales = (todos || []).filter(d => d.id !== doc.id && d.mini && parecidas(doc, d));
  if (!iguales.length) return null;
  const lista = iguales.concat([doc]).map(d => ({ id: d.id, date: d.date, inicio: A.momento(d), t: movS(d), ritmo: V.ritmoDe(movS(d), distM(d)), titulo: d.titulo, esta: d.id === doc.id }))
    .sort((a, b) => b.inicio - a.inicio);
  const porTiempo = lista.slice().sort((a, b) => a.t - b.t);
  return { veces: lista.length, lista, puesto: porTiempo.findIndex(x => x.esta) + 1, mejor: porTiempo[0] };
}

// ---- Resumen inteligente ----
const ordinal = n => (n === 1 ? "mejor" : `${n}.º mejor`);
function resumen(doc, todos) {
  const frases = [];
  const otras = (todos || []).filter(d => d.id !== doc.id);
  const t = movS(doc), dist = distM(doc);
  const ritmo = V.ritmoDe(t, dist);
  const momentoDoc = A.momento(doc);

  // 1. Mejores marcas (la distancia más larga que fue récord o podio).
  const ls = A.logros(doc, otras.concat([doc]));
  const prs = ls.filter(l => l.puesto === 1);
  if (prs.length) {
    const l = prs[prs.length - 1];
    const antes = A.esfuerzos(otras, l.clave, momentoDoc)[0];
    frases.push(`Nueva mejor marca en ${l.nombre}: ${V.tiempo(l.t)}${antes ? `, ${V.tiempo(antes.t - l.t)} menos que la anterior` : ""}.`);
  } else if (ls.length) {
    const l = ls.slice().sort((a, b) => a.puesto - b.puesto || 0)[0];
    frases.push(`Tu ${ordinal(l.puesto)} tiempo en ${l.nombre}: ${V.tiempo(l.t)}.`);
  }
  // 2. La más larga de los últimos 90 días.
  if (dist >= 3000) {
    const desde = momentoDoc - 90 * 86400000;
    const recientes = otras.filter(d => { const m = A.momento(d); return m >= desde && m < momentoDoc; });
    if (recientes.length >= 3 && recientes.every(d => distM(d) < dist)) frases.push(`Tu carrera más larga de los últimos 3 meses (${V.km(dist)}).`);
  }
  // 3. Mismo recorrido.
  const mr = mismoRecorrido(doc, otras.filter(d => A.momento(d) <= momentoDoc).concat([doc]));
  if (mr && mr.veces >= 3) {
    frases.push(mr.puesto === 1
      ? `Hiciste este recorrido ${mr.veces} veces y hoy fue tu mejor tiempo.`
      : `Hiciste este recorrido ${mr.veces} veces; hoy fue tu ${ordinal(mr.puesto)} tiempo (${V.tiempo(t - mr.mejor.t)} más que el mejor).`);
  }
  // 4. Ritmo contra tu promedio del último mes en distancias parecidas.
  if (ritmo > 0 && dist >= 1000) {
    const desde = momentoDoc - 30 * 86400000;
    const comp = otras.filter(d => { const m = A.momento(d), x = distM(d); return m >= desde && m < momentoDoc && x > 0 && Math.abs(x - dist) / dist <= 0.3 && movS(d) > 0; });
    if (comp.length >= 3) {
      const prom = comp.reduce((s, d) => s + movS(d), 0) / comp.reduce((s, d) => s + distM(d) / 1000, 0);
      const dif = Math.round(prom - ritmo);
      if (Math.abs(dif) >= 5) frases.push(`Ritmo de ${V.ritmo(ritmo)}: ${Math.abs(dif)} s/km ${dif > 0 ? "más rápido" : "más lento"} que tu promedio del último mes en distancias parecidas.`);
      else frases.push(`Ritmo de ${V.ritmo(ritmo)}, igual a tu promedio del último mes en distancias parecidas.`);
    }
  }
  // 5. Parciales: segunda mitad más rápida, ritmo parejo o el final más lento.
  const sp = (doc.splits || []).filter(s => s.d >= 995 && s.tm > 0);
  if (sp.length >= 4) {
    const r = sp.map(s => s.tm);
    const mitad = Math.floor(r.length / 2);
    const a = r.slice(0, mitad).reduce((s, x) => s + x, 0) / mitad, b = r.slice(r.length - mitad).reduce((s, x) => s + x, 0) / mitad;
    const min = Math.min(...r), max = Math.max(...r);
    if (b < a - 3) frases.push(`Segunda mitad más rápida que la primera (${V.ritmo(b)} contra ${V.ritmo(a)}).`);
    else if (max - min <= 10) frases.push(`Ritmo muy parejo: todos los km entre ${V.ritmo(min, true)} y ${V.ritmo(max)}.`);
    else if (r[r.length - 1] === max && max - a > 20) frases.push(`El último km fue el más lento (${V.ritmo(max)}).`);
  }
  // 6. Desnivel.
  const desn = doc.desnivelCorr ? doc.desnivelCorr.pos : doc.desnivelPosM;
  if (desn >= 150) frases.push(`Con ${V.metros(desn)} de desnivel${doc.gapS ? `; en llano equivaldría a ${V.ritmo(doc.gapS)}` : ""}.`);
  // 7. Zona de FC donde más estuviste.
  if (doc.zonas && doc.zonas.some(z => z > 0)) {
    const tot = doc.zonas.reduce((s, z) => s + z, 0);
    const i = doc.zonas.indexOf(Math.max(...doc.zonas));
    if (doc.zonas[i] / tot >= 0.4) frases.push(`Pasaste el ${Math.round(100 * doc.zonas[i] / tot)} % del tiempo en la zona ${i + 1} de FC.`);
  }
  // 8. La semana.
  if (doc.date) {
    const sem = A.periodo(otras.filter(d => A.momento(d) <= momentoDoc).concat([doc]), "semana", doc.date);
    if (sem.n >= 2) frases.push(`Con esta carrera sumas ${V.km(sem.km * 1000, 1)} en la semana (${sem.n} carreras).`);
    else frases.push(`Primera carrera de la semana: ${V.km(dist, dist >= 10000 ? 1 : 2)}.`);
  }
  // Siempre al menos dos frases: la primera con las cifras de la carrera.
  if (frases.length < 2 && dist > 0 && t > 0) frases.unshift(`${V.km(dist)} en ${V.tiempo(t)} (${V.ritmo(ritmo)}).`);
  return frases.slice(0, 4);
}

return { mismoRecorrido, parecidas, remuestrear, resumen, RADIO_EXTREMOS, FORMA_MAX };
});
