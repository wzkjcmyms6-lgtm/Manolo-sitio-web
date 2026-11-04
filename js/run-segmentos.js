// ---------- Running: segmentos (sin pantalla, fase 6) ----------
// Un segmento es un tramo de una ruta (una subida, una vuelta al parque) que
// se cronometra solo en cada carrera que pasa por él. Se guarda en
// users/{uid}/run_segmentos/{id} (D-074):
//   { v:1, nombre, deporte, ini:{lat,lon}, fin:{lat,lon}, distanciaM,
//     desnivelM, pendiente, enc (trazo), origenId, creado,
//     esfuerzos: { actividadId: { t (s), fecha, inicio (ms) } } }
// Detección: pasar a ≤ 35 m del inicio y luego del fin, recorriendo entre
// 85 % y 120 % de la distancia del segmento y pasando a ≤ 50 m de 10 puntos
// repartidos a lo largo del trazo (mismo sentido). Si pasa varias veces, se
// queda el mejor tiempo. Antes de leer la ruta completa se mira la mini ruta
// (≤ 100 m del inicio y del fin) para no leer de más.
// Pruebas: tests/run-segmentos.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-metricas.js"));
  else root.RunSegmentos = factory(root.RunMetricas);
})(typeof self !== "undefined" ? self : this, function (M) {
"use strict";

const RADIO = 35, RADIO_FORMA = 50, MUESTRAS = 10, RADIO_PREVIO = 100;
const r5 = v => Math.round(v * 1e5) / 1e5;

// Puntos con GPS de la ruta y su distancia acumulada (haversine).
function plano(tramos) {
  const pts = [].concat(...(tramos || [])).filter(p => p && p.lat != null && p.t != null);
  const D = [0];
  for (let i = 1; i < pts.length; i++) D.push(D[i - 1] + M.haversine(pts[i - 1], pts[i]));
  return { pts, D };
}
function interpolar(a, b, f) {
  return { lat: a.lat + f * (b.lat - a.lat), lon: a.lon + f * (b.lon - a.lon), t: a.t + f * (b.t - a.t), alt: a.alt != null && b.alt != null ? a.alt + f * (b.alt - a.alt) : (a.alt != null ? a.alt : b.alt) };
}
function enDistancia(pts, D, d) {
  if (d <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) if (D[i] >= d) { const s = D[i] - D[i - 1]; return interpolar(pts[i - 1], pts[i], s > 0 ? (d - D[i - 1]) / s : 0); }
  return pts[pts.length - 1];
}
// Trazo entre dos distancias de la ruta (para el segmento y su vista previa).
function tramo(tramos, desdeM, hastaM) {
  const { pts, D } = plano(tramos);
  if (pts.length < 2) return [];
  const a = Math.max(0, Math.min(desdeM, hastaM)), b = Math.min(D[D.length - 1], Math.max(desdeM, hastaM));
  const out = [enDistancia(pts, D, a)];
  for (let i = 0; i < pts.length; i++) if (D[i] > a && D[i] < b) out.push(pts[i]);
  out.push(enDistancia(pts, D, b));
  return out;
}
function largo(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += M.haversine(pts[i - 1], pts[i]);
  return s;
}
// Campos de un segmento nuevo a partir de una ruta y dos distancias.
function crear(tramos, desdeM, hastaM, nombre, origenId, ahora) {
  const pts = tramo(tramos, desdeM, hastaM);
  if (pts.length < 2) return null;
  const dist = largo(pts);
  if (dist < 100) return null;
  let sube = 0, ref = null;
  pts.forEach(p => { if (p.alt == null) return; if (ref == null) ref = p.alt; if (p.alt >= ref + 2) { sube += p.alt - ref; ref = p.alt; } else if (p.alt <= ref - 2) ref = p.alt; });
  const conAlt = pts.filter(p => p.alt != null);
  const neto = conAlt.length >= 2 ? conAlt[conAlt.length - 1].alt - conAlt[0].alt : null;
  const seg = {
    v: 1, nombre: String(nombre || "").trim().slice(0, 60) || `Segmento de ${Math.round(dist / 10) / 100} km`.replace(".", ","),
    deporte: "running",
    ini: { lat: r5(pts[0].lat), lon: r5(pts[0].lon) },
    fin: { lat: r5(pts[pts.length - 1].lat), lon: r5(pts[pts.length - 1].lon) },
    distanciaM: Math.round(dist),
    enc: M.codificar(M.simplificar(pts, 200).map(p => [p.lat, p.lon]), [1e5, 1e5]),
    origenId: origenId || null, creado: ahora || Date.now(), esfuerzos: {}
  };
  if (conAlt.length >= 2) { seg.desnivelM = Math.round(sube); seg.pendiente = Math.round(1000 * neto / dist) / 10; }
  return seg;
}
const trazo = seg => M.leerMini(seg.enc);

// ¿La mini ruta pasa cerca del inicio y del fin? (antes de leer la ruta completa)
// Distancia (m) de un punto a un tramo recto a–b (la mini ruta está simplificada:
// una recta larga queda en dos puntos).
function aTramo(q, a, b) {
  const kx = Math.cos(q.lat * Math.PI / 180) * 111320, ky = 110540;
  const ax = (a.lon - q.lon) * kx, ay = (a.lat - q.lat) * ky, bx = (b.lon - q.lon) * kx, by = (b.lat - q.lat) * ky;
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
function pasaCerca(doc, seg) {
  if (!doc || !doc.mini) return false;
  const pts = M.leerMini(doc.mini);
  if (pts.length < 2) return false;
  const cerca = q => { for (let i = 1; i < pts.length; i++) if (aTramo(q, pts[i - 1], pts[i]) <= RADIO_PREVIO) return true; return false; };
  return cerca(seg.ini) && cerca(seg.fin);
}
function remuestrear(pts, n) {
  const D = [0];
  for (let i = 1; i < pts.length; i++) D.push(D[i - 1] + M.haversine(pts[i - 1], pts[i]));
  const out = [];
  for (let k = 0; k < n; k++) out.push(enDistancia(pts, D, D[D.length - 1] * k / (n - 1)));
  return out;
}
// Mejor paso por el segmento en una ruta: { t, inicio (ms), desdeM, hastaM } o null.
function esfuerzo(seg, tramos) {
  const { pts, D } = plano(tramos);
  if (pts.length < 2) return null;
  const forma = remuestrear(trazo(seg), MUESTRAS);
  const dist = seg.distanciaM;
  let mejor = null;
  for (let i = 0; i < pts.length; i++) {
    if (M.haversine(pts[i], seg.ini) > RADIO) continue;
    // De los puntos seguidos cerca del inicio, el más cercano.
    let ini = i, a = i;
    while (a + 1 < pts.length && M.haversine(pts[a + 1], seg.ini) <= RADIO) {
      a++;
      if (M.haversine(pts[a], seg.ini) < M.haversine(pts[ini], seg.ini)) ini = a;
    }
    let fin = -1, dFin = Infinity;
    for (let j = ini + 1; j < pts.length && D[j] - D[ini] <= dist * 1.2; j++) {
      if (D[j] - D[ini] < dist * 0.85) continue;
      const dj = M.haversine(pts[j], seg.fin);
      if (dj <= RADIO && dj < dFin) { dFin = dj; fin = j; }
    }
    i = a; // seguir después de este paso
    if (fin < 0) continue;
    const ok = forma.every(q => { for (let k = ini; k <= fin; k++) if (M.haversine(pts[k], q) <= RADIO_FORMA) return true; return false; });
    if (!ok) continue;
    const t = (pts[fin].t - pts[ini].t) / 1000;
    if (t > 0 && (!mejor || t < mejor.t)) mejor = { t: Math.round(t), inicio: pts[ini].t, desdeM: Math.round(D[ini]), hastaM: Math.round(D[fin]) };
  }
  return mejor;
}

// Tabla personal: [{ id, t, fecha, inicio, puesto }] del más rápido al más lento.
function tabla(seg) {
  return Object.keys(seg.esfuerzos || {}).map(id => Object.assign({ id }, seg.esfuerzos[id]))
    .filter(e => e.t > 0).sort((a, b) => a.t - b.t || a.inicio - b.inicio).map((e, i) => Object.assign(e, { puesto: i + 1 }));
}
// Segmentos de una actividad, con su tiempo y puesto.
function deActividad(segs, id) {
  return (segs || []).filter(s => s.esfuerzos && s.esfuerzos[id]).map(s => {
    const tb = tabla(s);
    const e = tb.find(x => x.id === id);
    return { seg: s, t: e.t, puesto: e.puesto, total: tb.length };
  }).sort((a, b) => a.puesto - b.puesto || a.seg.nombre.localeCompare(b.seg.nombre));
}

return { crear, tramo, trazo, pasaCerca, esfuerzo, tabla, deActividad, largo, RADIO, RADIO_FORMA };
});
