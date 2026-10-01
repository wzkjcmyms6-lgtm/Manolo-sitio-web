// ---------- Motor de actividades deportivas (sin pantalla) ----------
// Común a Running, Bicicleta y futuras actividades. Recibe puntos GPS y
// órdenes (iniciar, pausar, reanudar, finalizar) y calcula distancia,
// tiempos, ritmo/velocidad, desnivel y parciales. No toca el DOM ni el GPS:
// se prueba en tests/actividad-motor.test.js. Diseño en docs/SPORTS.md y
// docs/GPS.md.
//
// - Todo se calcula con marcas de tiempo (ms), no contando segundos: si el
//   iPhone congela la app, al volver los tiempos siguen siendo correctos.
// - El estado es JSON puro: se guarda en el teléfono para recuperar una
//   actividad si la app se cierra.
// - Nunca inventa puntos: los huecos de señal se marcan y la distancia que
//   cubren (en línea recta) se guarda aparte como "estimada".
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ActividadMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// accMax: precisión mínima aceptada (m) · vMax: velocidad imposible (m/s)
// vMov: desde aquí cuenta como "en movimiento" (m/s) · pasoMin: avance
// mínimo entre puntos (m) para no sumar el temblor del GPS estando quieto ·
// parcialM: cada cuánto un parcial · ventanaS: ventana del ritmo actual.
const PERFILES = {
  running: { id: "running", accMax: 30, vMax: 12, vMov: 0.5, pasoMin: 3, parcialM: 1000, ventanaS: 20, principal: "ritmo" },
  bicicleta: { id: "bicicleta", accMax: 30, vMax: 25, vMov: 1.0, pasoMin: 4, parcialM: 5000, ventanaS: 10, principal: "velocidad" }
};
const HUECO_MS = 15000;      // sin puntos buenos más de esto = señal perdida
const DESNIVEL_UMBRAL = 3;   // m: cambios de altitud menores se ignoran (ruido)
const ALT_ACC_MAX = 20;      // m: altitud con peor precisión no cuenta
const RADIO_TIERRA = 6371008.8;

function rad(g) { return g * Math.PI / 180; }
function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}
const num = v => (typeof v === "number" && isFinite(v) ? v : null);
const redondear = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

// ---- Reloj: pausas y tiempo activo (lo usa también intervalos-motor.js) ----
function msPausado(st, t) {
  return (st.pausas || []).reduce((s, p) => s + Math.max(0, Math.min(p.hasta == null ? t : p.hasta, t) - p.desde), 0);
}
function tiempoActivoMs(st, t) {
  if (st.inicio == null) return 0;
  const fin = st.fin != null ? Math.min(st.fin, t) : t;
  return Math.max(0, fin - st.inicio - msPausado(st, fin));
}
function iniciarReloj(st, t) {
  if (st.estado !== "listo") return st;
  st.estado = "activo";
  st.inicio = t;
  return st;
}
function pausarReloj(st, t) {
  if (st.estado !== "activo") return st;
  st.estado = "pausado";
  st.pausas.push({ desde: t, hasta: null });
  return st;
}
function reanudarReloj(st, t) {
  if (st.estado !== "pausado") return st;
  st.estado = "activo";
  const p = st.pausas[st.pausas.length - 1];
  if (p && p.hasta == null) p.hasta = Math.max(p.desde, t);
  return st;
}
function finalizarReloj(st, t) {
  if (st.estado !== "activo" && st.estado !== "pausado") return st;
  const p = st.pausas[st.pausas.length - 1];
  if (p && p.hasta == null) p.hasta = Math.max(p.desde, t);
  st.estado = "finalizado";
  st.fin = t;
  return st;
}

// ---- Actividad ----
function crear(deporte) {
  if (!PERFILES[deporte]) throw new Error("Deporte desconocido: " + deporte);
  return {
    v: 1, deporte, estado: "listo", inicio: null, fin: null, pausas: [],
    tramos: [],            // [[ [lat, lon, t, alt|null], ... ], ...] cada tramo es un trazo continuo
    ancla: null,           // último punto aceptado { lat, lon, t, acc }
    nuevoTramo: true,      // el próximo punto bueno abre un tramo (inicio o tras pausa)
    ultimoCrudo: null,     // último punto recibido { t, acc } (estado del GPS)
    ultimoBuenoT: null,    // último punto con buena precisión (detecta señal perdida)
    distanciaM: 0, huecoM: 0, movMs: 0, velMaxMs: 0,
    altRef: null, desPos: 0, desNeg: 0, conAltitud: false,
    parciales: [],         // ms activos al cruzar cada parcial (1 km, 2 km…)
    cuenta: { aceptado: 0, impreciso: 0, duplicado: 0, salto: 0, quieto: 0 }
  };
}
const perfilDe = st => PERFILES[st.deporte];

function iniciar(st, t) { return iniciarReloj(st, t); }
function pausar(st, t) {
  if (st.estado === "activo") { st.nuevoTramo = true; st.ancla = null; }
  return pausarReloj(st, t);
}
function reanudar(st, t) { return reanudarReloj(st, t); }
function finalizar(st, t) { return finalizarReloj(st, t); }

function guardarPunto(st, c) {
  st.tramos[st.tramos.length - 1].push([redondear(c.lat, 6), redondear(c.lon, 6), c.t, num(c.alt) == null ? null : redondear(c.alt, 1)]);
  st.ancla = { lat: c.lat, lon: c.lon, t: c.t, acc: c.acc };
  st.cuenta.aceptado++;
}
function sumarAltitud(st, c) {
  const alt = num(c.alt);
  if (alt == null || (num(c.altAcc) != null && c.altAcc > ALT_ACC_MAX)) return;
  st.conAltitud = true;
  if (st.altRef == null) { st.altRef = alt; return; }
  const dif = alt - st.altRef;
  if (dif >= DESNIVEL_UMBRAL) { st.desPos += dif; st.altRef = alt; }
  else if (dif <= -DESNIVEL_UMBRAL) { st.desNeg -= dif; st.altRef = alt; }
}
function sumarParciales(st, previa, d, a, c) {
  const P = perfilDe(st);
  for (let k = Math.floor(previa / P.parcialM) + 1; k * P.parcialM <= st.distanciaM; k++) {
    const f = (k * P.parcialM - previa) / d;
    st.parciales.push(tiempoActivoMs(st, a.t + f * (c.t - a.t)));
  }
}

// Un punto del GPS: { lat, lon, t, acc, alt?, altAcc? }. Devuelve qué pasó
// con él: aceptado · quieto · impreciso · duplicado · salto · ignorado · invalido.
function punto(st, c) {
  if (st.estado !== "activo") return "ignorado";
  if (!c || num(c.lat) == null || num(c.lon) == null || num(c.t) == null || Math.abs(c.lat) > 90 || Math.abs(c.lon) > 180) return "invalido";
  const P = perfilDe(st);
  const acc = num(c.acc) == null ? Infinity : c.acc;
  st.ultimoCrudo = { t: c.t, acc };
  if (acc > P.accMax) { st.cuenta.impreciso++; return "impreciso"; }
  const a = st.ancla;
  if (a && c.t <= a.t) { st.cuenta.duplicado++; return "duplicado"; }
  if (!a || st.nuevoTramo) {
    st.tramos.push([]);
    st.nuevoTramo = false;
    st.ultimoBuenoT = c.t;
    guardarPunto(st, Object.assign({}, c, { acc }));
    sumarAltitud(st, c);
    return "aceptado";
  }
  const d = haversine(a, c);
  const dt = (c.t - a.t) / 1000;
  if (d / dt > P.vMax) { st.cuenta.salto++; return "salto"; }
  const hueco = st.ultimoBuenoT != null && c.t - st.ultimoBuenoT > HUECO_MS;
  st.ultimoBuenoT = c.t;
  if (!hueco && d < Math.max(P.pasoMin, 0.5 * Math.max(acc, a.acc || 0))) { st.cuenta.quieto++; return "quieto"; }

  // Tras perder la señal, la recta hasta aquí es una estimación: se suma,
  // pero se anota aparte y el trazo empieza un tramo nuevo.
  if (hueco) { st.huecoM += d; st.tramos.push([]); }
  const previa = st.distanciaM;
  st.distanciaM += d;
  if (d / dt >= P.vMov) st.movMs += c.t - a.t;
  sumarParciales(st, previa, d, a, c);
  guardarPunto(st, Object.assign({}, c, { acc }));
  sumarAltitud(st, c);
  const v = velocidadActual(st, c.t);
  if (v > st.velMaxMs) st.velMaxMs = v;
  return "aceptado";
}

// Velocidad de los últimos segundos (m/s) en el tramo actual; 0 si paraste.
function velocidadActual(st, t) {
  const P = perfilDe(st);
  const tramo = st.tramos[st.tramos.length - 1];
  if (!tramo || tramo.length < 2 || st.estado !== "activo") return 0;
  const desde = t - P.ventanaS * 1000;
  if (tramo[tramo.length - 1][2] < desde) return 0;
  let i = tramo.length - 1;
  while (i > 0 && tramo[i - 1][2] >= desde) i--;
  if (i > 0) i--;  // el punto justo antes de la ventana marca el inicio
  let d = 0;
  for (let k = i + 1; k < tramo.length; k++) d += haversine({ lat: tramo[k - 1][0], lon: tramo[k - 1][1] }, { lat: tramo[k][0], lon: tramo[k][1] });
  const dt = (t - tramo[i][2]) / 1000;
  // Ventanas muy cortas dan saltos: se pide al menos 5 s.
  return dt >= 5 ? d / dt : 0;
}

function estadoGps(st, t) {
  if (!st.ultimoCrudo) return "esperando";
  if (t - st.ultimoCrudo.t > HUECO_MS) return "sin señal";
  if (st.ultimoCrudo.acc > perfilDe(st).accMax) return "impreciso";
  return "ok";
}

const ritmoDe = v => (v > 0 ? 1000 / v : null); // s por km

function metricas(st, t) {
  const fin = st.fin != null ? st.fin : t;
  const activoMs = tiempoActivoMs(st, fin);
  const movS = st.movMs / 1000;
  const vMedia = movS > 0 ? st.distanciaM / movS : 0;
  const vActual = st.estado === "activo" ? velocidadActual(st, t) : 0;
  const P = perfilDe(st);
  const parciales = st.parciales.map((ms, i) => ({ n: i + 1, distanciaM: P.parcialM, s: (ms - (i ? st.parciales[i - 1] : 0)) / 1000 }));
  return {
    deporte: st.deporte,
    estado: st.estado,
    distanciaM: st.distanciaM,
    huecoM: st.huecoM,                       // parte estimada por pérdida de señal
    tiempoTotalS: st.inicio == null ? 0 : (fin - st.inicio) / 1000,
    tiempoActivoS: activoMs / 1000,          // cronómetro (sin pausas)
    tiempoMovS: movS,
    velActualMs: vActual,
    velMediaMs: vMedia,                      // sobre el tiempo en movimiento
    velMaxMs: st.velMaxMs,
    ritmoActualSKm: ritmoDe(vActual),
    ritmoMedioSKm: ritmoDe(vMedia),
    desnivelPosM: st.conAltitud ? st.desPos : null,
    desnivelNegM: st.conAltitud ? st.desNeg : null,
    parciales,
    parcialEnCurso: { n: parciales.length + 1, distanciaM: st.distanciaM - parciales.length * P.parcialM, s: (activoMs - (st.parciales[st.parciales.length - 1] || 0)) / 1000 },
    gps: estadoGps(st, t),
    puntos: st.cuenta.aceptado
  };
}

// ---- Ruta compacta: polilínea codificada (como la de los mapas) ----
// Admite varias columnas y números grandes (aritmética, sin operaciones de bits).
function codificarNumero(n) {
  let v = n < 0 ? -2 * n - 1 : 2 * n;
  let s = "";
  while (v >= 32) {
    s += String.fromCharCode(32 + (v % 32) + 63);
    v = Math.floor(v / 32);
  }
  return s + String.fromCharCode(v + 63);
}
function codificar(filas, escalas) {
  const prev = escalas.map(() => 0);
  let out = "";
  (filas || []).forEach(f => escalas.forEach((e, i) => {
    const n = Math.round(f[i] * e);
    out += codificarNumero(n - prev[i]);
    prev[i] = n;
  }));
  return out;
}
function decodificar(texto, escalas) {
  const filas = [];
  const prev = escalas.map(() => 0);
  let i = 0, fila = [];
  while (i < texto.length) {
    let v = 0, mult = 1, c;
    do {
      c = texto.charCodeAt(i++) - 63;
      v += (c % 32) * mult;
      mult *= 32;
    } while (c >= 32 && i < texto.length);
    const n = v % 2 ? -(v + 1) / 2 : v / 2;
    const col = fila.length;
    prev[col] += n;
    fila.push(prev[col] / escalas[col]);
    if (fila.length === escalas.length) { filas.push(fila); fila = []; }
  }
  return filas;
}
const SIN_ALT = -9999;

// Fecha local (AAAA-MM-DD) del momento dado.
function fechaLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Lo que se guarda al terminar: el resumen va en running/ o bicicleta/
// (con distance y duration de siempre, así lo viejo sigue funcionando) y la
// ruta en users/{uid}/rutas/{mismo id}. Ver docs/DATABASE.md.
function resumen(st, extra) {
  const m = metricas(st, st.fin != null ? st.fin : Date.now());
  const puntos = [].concat(...st.tramos);
  const documento = Object.assign({
    v: 1,
    fuente: "gps",
    date: fechaLocal(st.inicio),
    distance: redondear(m.distanciaM / 1000, 2),
    duration: redondear(m.tiempoActivoS / 60, 1),
    inicio: st.inicio,
    fin: st.fin,
    distanciaM: Math.round(m.distanciaM),
    tiempoTotalS: Math.round(m.tiempoTotalS),
    tiempoActivoS: Math.round(m.tiempoActivoS),
    tiempoMovS: Math.round(m.tiempoMovS),
    velMaxKmh: redondear(m.velMaxMs * 3.6, 1),
    parciales: m.parciales.map(p => Math.round(p.s)),
    conRuta: puntos.length > 1
  }, m.huecoM > 0 ? { huecoM: Math.round(m.huecoM) } : {},
     m.desnivelPosM != null ? { desnivelPosM: Math.round(m.desnivelPosM), desnivelNegM: Math.round(m.desnivelNegM) } : {},
     extra || {});
  const ruta = puntos.length > 1 ? Object.assign({
    v: 1,
    deporte: st.deporte,
    inicio: st.inicio,
    // lat, lon (1e-5 ≈ 1 m) y segundos desde el inicio
    enc: codificar(puntos.map(p => [p[0], p[1], (p[2] - st.inicio) / 1000]), [1e5, 1e5, 1]),
    tramos: st.tramos.map(tr => tr.length).filter(n => n > 0),
    n: puntos.length
  }, st.conAltitud ? { alt: codificar(puntos.map(p => [p[3] == null ? SIN_ALT : p[3]]), [1]) } : {}) : null;
  return { documento, ruta };
}

// Lee una ruta guardada: [[{ lat, lon, t, alt }], ...] por tramo.
function leerRuta(ruta) {
  if (!ruta || !ruta.enc) return [];
  const filas = decodificar(ruta.enc, [1e5, 1e5, 1]);
  const alts = ruta.alt ? decodificar(ruta.alt, [1]).map(f => (f[0] === SIN_ALT ? null : f[0])) : [];
  const puntos = filas.map((f, i) => ({ lat: f[0], lon: f[1], t: ruta.inicio + f[2] * 1000, alt: alts[i] == null ? null : alts[i] }));
  const tramos = [];
  let i = 0;
  (ruta.tramos && ruta.tramos.length ? ruta.tramos : [puntos.length]).forEach(n => { tramos.push(puntos.slice(i, i + n)); i += n; });
  return tramos;
}

return {
  PERFILES, HUECO_MS, DESNIVEL_UMBRAL,
  haversine, crear, iniciar, pausar, reanudar, finalizar, punto, metricas, estadoGps, velocidadActual,
  resumen, leerRuta, codificar, decodificar, fechaLocal,
  reloj: { msPausado, tiempoActivoMs, iniciar: iniciarReloj, pausar: pausarReloj, reanudar: reanudarReloj, finalizar: finalizarReloj }
};
});
