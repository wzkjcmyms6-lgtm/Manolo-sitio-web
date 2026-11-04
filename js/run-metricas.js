// ---------- Running: motor de métricas (sin pantalla) ----------
// Recibe una actividad normalizada (js/run-formatos.js) y devuelve lo que se
// guarda: los campos del documento (distancia, tiempos, desnivel, parciales,
// mejores marcas, zonas, carga, mini ruta…) y la ruta completa compacta.
// Reglas (D-064, D-065): primero los valores del archivo; lo que falte se
// calcula; nunca se inventa (sin FC no hay nada de FC).
// Reusa del motor GPS viejo (git a66de91): haversine, polilínea codificada
// multicolumna, histéresis de desnivel y parciales por cruce interpolado.
// Pruebas: tests/run-metricas.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RunMetricas = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const PERFILES = {
  running: { vMax: 12, vMov: 0.5, pasoMin: 2 },
  bicicleta: { vMax: 25, vMov: 1.0, pasoMin: 3 }
};
const PAUSA_S = 30;          // hueco sin puntos más largo que esto = pausa
const HISTERESIS_M = 4;      // desnivel: cambios menores se ignoran (ruido)
const VENTANA_VEL_S = 5;     // velocidad suavizada ±5 s para "en movimiento"
const VENTANA_PEND_M = 25;   // pendiente para el GAP: ±25 m (~50 m)
const MINI_MAX = 250;        // puntos de la mini ruta
const RUTA_MAX = 900000;     // caracteres (el documento de Firestore admite 1 MiB)
const SIN = -9999;           // "sin dato" dentro de una columna codificada
const RADIO_TIERRA = 6371008.8;

// Mejores marcas: [metros exactos, clave guardada, nombre].
const DISTANCIAS = [
  [400, "400", "400 m"], [804.672, "805", "½ milla"], [1000, "1000", "1 km"],
  [1609.344, "1609", "1 milla"], [3218.688, "3219", "2 millas"], [5000, "5000", "5K"],
  [10000, "10000", "10K"], [15000, "15000", "15K"], [16093.44, "16093", "10 millas"],
  [20000, "20000", "20K"], [21097.5, "21097", "Media maratón"], [30000, "30000", "30K"],
  [42195, "42195", "Maratón"], [50000, "50000", "50K"]
];

const num = v => (typeof v === "number" && isFinite(v) ? v : null);
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const rad = g => g * Math.PI / 180;
function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}
function fechaLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Título automático según la hora local del inicio.
function tituloAuto(deporte, inicio) {
  const h = new Date(inicio).getHours();
  const cuando = h >= 5 && h < 11 ? "por la mañana" : h >= 11 && h < 14 ? "al mediodía" : h >= 14 && h < 19 ? "por la tarde" : h >= 19 && h < 22 ? "por la noche" : "de madrugada";
  return `${deporte === "bicicleta" ? "Rodada" : "Carrera"} ${cuando}`;
}

// Costo energético de correr en pendiente (Minetti et al., J Appl Physiol
// 2002;93:1039-1046), en J/kg/m; en llano 3,6. Pendiente en fracción.
function costoMinetti(i) {
  const g = Math.max(-0.45, Math.min(0.45, i));
  return 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
}

// ---- Polilínea codificada (de actividad-motor.js, sin cambios) ----
function codificarNumero(n) {
  let v = n < 0 ? -2 * n - 1 : 2 * n;
  let s = "";
  while (v >= 32) { s += String.fromCharCode(32 + (v % 32) + 63); v = Math.floor(v / 32); }
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
  while (i < (texto || "").length) {
    let v = 0, mult = 1, c;
    do { c = texto.charCodeAt(i++) - 63; v += (c % 32) * mult; mult *= 32; } while (c >= 32 && i < texto.length);
    const n = v % 2 ? -(v + 1) / 2 : v / 2;
    const col = fila.length;
    prev[col] += n;
    fila.push(prev[col] / escalas[col]);
    if (fila.length === escalas.length) { filas.push(fila); fila = []; }
  }
  return filas;
}

// ---- Limpieza (D-064) ----
function limpiar(puntos, perfil) {
  const ps = (puntos || []).filter(p => num(p.t) != null).map(p => ({
    t: p.t, lat: num(p.lat), lon: num(p.lon), alt: num(p.alt), d: num(p.d), fc: num(p.fc), cad: num(p.cad)
  })).sort((a, b) => a.t - b.t);
  const u = [];
  ps.forEach(p => {
    const q = u[u.length - 1];
    if (q && p.t - q.t < 500) { // misma hora: se completa lo que falte
      ["lat", "lon", "alt", "d", "fc", "cad"].forEach(k => { if (q[k] == null && p[k] != null) q[k] = p[k]; });
      return;
    }
    u.push(p);
  });
  u.forEach(p => {
    if (p.lat == null || p.lon == null || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180 || (p.lat === 0 && p.lon === 0)) p.lat = p.lon = null;
    if (p.alt != null && (p.alt < -500 || p.alt > 9000)) p.alt = null;
    if (p.fc != null && (p.fc < 30 || p.fc > 230)) p.fc = null;
    if (p.cad != null && (p.cad <= 0 || p.cad > 260)) p.cad = null;
    if (p.d != null && p.d < 0) p.d = null;
  });
  // Saltos del GPS: más rápido que lo posible desde el último punto bueno.
  let ancla = null, rechazos = 0;
  u.forEach(p => {
    if (p.lat == null) return;
    if (!ancla) { ancla = p; return; }
    const dt = (p.t - ancla.t) / 1000;
    if (dt > PAUSA_S || haversine(ancla, p) / dt <= perfil.vMax || ++rechazos >= 3) { ancla = p; rechazos = 0; return; }
    p.lat = p.lon = null;
  });
  // Picos aislados de FC: lejos (> 25 lpm) de la mediana de 5.
  const idx = u.map((p, i) => (p.fc != null ? i : -1)).filter(i => i >= 0);
  const orig = idx.map(i => u[i].fc);
  idx.forEach((i, k) => {
    const v = orig.slice(Math.max(0, k - 2), k + 3).sort((a, b) => a - b);
    const med = v[Math.floor(v.length / 2)];
    if (Math.abs(orig[k] - med) > 25) u[i].fc = med;
  });
  // La distancia del reloj nunca baja.
  let dPrev = null;
  u.forEach(p => { if (p.d != null) { if (dPrev != null && p.d < dPrev) p.d = dPrev; dPrev = p.d; } });
  return u;
}

// ---- Mejores marcas: ventana deslizante con interpolación, O(n) ----
// D: distancia acumulada (m), T: segundos. Devuelve { clave: segundos }.
function mejoresMarcas(D, T) {
  const out = {};
  const n = D.length;
  if (n < 2) return out;
  DISTANCIAS.forEach(([dist, clave]) => {
    if (D[n - 1] < dist) return;
    let i = 0, mejor = Infinity;
    for (let j = 1; j < n; j++) {
      if (D[j] - D[0] < dist) continue;
      while (i + 1 < j && D[j] - D[i + 1] >= dist) i++;
      const s = D[j] - dist; // el inicio cae entre i e i+1
      const seg = D[i + 1] - D[i];
      const f = seg > 0 ? Math.min(1, Math.max(0, (s - D[i]) / seg)) : 0;
      const ts = T[i] + f * (T[i + 1] - T[i]);
      const t = T[j] - ts;
      if (t > 0 && t < mejor) mejor = t;
    }
    if (isFinite(mejor)) out[clave] = Math.round(mejor);
  });
  return out;
}

// ---- Douglas-Peucker (iterativo) sobre metros proyectados ----
function simplificar(pts, maximo) {
  if (pts.length <= 2) return pts.slice();
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const kx = Math.cos(rad(lat0)) * 111320, ky = 110540;
  const xy = pts.map(p => [p.lon * kx, p.lat * ky]);
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = dx * dx + dy * dy;
    let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  let tol = 4, quedan;
  do {
    const marca = new Uint8Array(pts.length);
    marca[0] = marca[pts.length - 1] = 1;
    const pila = [[0, pts.length - 1]];
    while (pila.length) {
      const [a, b] = pila.pop();
      let maxD = -1, k = -1;
      for (let i = a + 1; i < b; i++) { const d = dist(xy[i], xy[a], xy[b]); if (d > maxD) { maxD = d; k = i; } }
      if (maxD > tol) { marca[k] = 1; pila.push([a, k], [k, b]); }
    }
    quedan = pts.filter((_, i) => marca[i]);
    tol *= 1.6;
  } while (quedan.length > maximo);
  return quedan;
}

// ---- Zonas de FC (D-064) ----
// Límites inferiores de las zonas 2–5 en lpm.
function limitesZonas(fcMax, fcReposo) {
  if (!(fcMax > 0)) return null;
  const pct = [0.6, 0.7, 0.8, 0.9];
  return fcReposo > 0 && fcReposo < fcMax ? pct.map(p => fcReposo + p * (fcMax - fcReposo)) : pct.map(p => p * fcMax);
}
function zonaDe(fc, lim) {
  let z = 0;
  while (z < 4 && fc >= lim[z]) z++;
  return z;
}

// ---- Carga (D-065): 100 = 1 h al umbral ----
const TRIMP_HORA_UMBRAL = 60 * 0.85 * 0.64 * Math.exp(1.92 * 0.85);
function cargaRpe(rpe, minutos) {
  return rpe > 0 && minutos > 0 ? { v: Math.round(rpe * minutos * 100 / 480), m: "rpe" } : null;
}

// ---- Cálculo principal ----
// opciones: { fcMax, fcReposo, ritmoUmbralS, pesoKg, rpe }
function calcular(act, opciones) {
  const o = opciones || {};
  const deporte = act.deporte === "bicicleta" ? "bicicleta" : "running";
  const perfil = PERFILES[deporte];
  const r = act.resumen || {};
  const u = limpiar(act.puntos, perfil);
  const n = u.length;
  const inicio = num(act.inicio) != null ? act.inicio : n ? u[0].t : null;
  const campos = {};
  const set = (k, v) => { if (v != null && v !== "" && !(typeof v === "number" && !isFinite(v))) campos[k] = v; };

  if (n < 2) {
    // Sin puntos: solo el resumen (CSV o un TCX sin registros).
    const distM = num(r.distM) || 0;
    const total = num(r.tiempoTotalS) || num(r.tiempoMovS) || num(r.tiempoRelojS) || 0;
    const mov = num(r.tiempoMovS) || num(r.tiempoRelojS) || total;
    Object.assign(campos, {
      date: fechaLocal(inicio), distance: r2(distM / 1000), duration: r1(mov / 60),
      inicio, fin: inicio + Math.round(total * 1000), distanciaM: Math.round(distM),
      tiempoTotalS: Math.round(total), tiempoMovS: Math.round(mov), conRuta: false, parciales: []
    });
    set("desnivelPosM", num(r.ascensoM) != null ? Math.round(r.ascensoM) : null);
    set("fcMedia", num(r.fcMedia) ? Math.round(r.fcMedia) : null);
    set("fcMax", num(r.fcMax) ? Math.round(r.fcMax) : null);
    set("kcal", r.kcal > 0 ? Math.round(r.kcal) : null);
    const c = cargaRpe(o.rpe, mov / 60);
    if (c) campos.carga = c;
    return { campos, ruta: null };
  }

  // Tiempo (s desde el inicio) y pausas del reloj.
  const T = u.map(p => (p.t - inicio) / 1000);
  const pausas = (act.pausas || []).filter(p => p[1] > p[0]);
  const enPausaReloj = (a, b) => pausas.some(([x, y]) => (a + b) / 2 >= x && (a + b) / 2 <= y);
  const pausa = new Uint8Array(n); // pausa[i]: el tramo i-1 → i es una pausa
  for (let i = 1; i < n; i++) pausa[i] = T[i] - T[i - 1] > PAUSA_S || enPausaReloj(u[i - 1].t, u[i].t) ? 1 : 0;

  // Distancia acumulada: la del reloj si la trae (≥ 80 % de los puntos); si no, GPS.
  const D = new Float64Array(n);
  const conD = u.filter(p => p.d != null).length >= 0.8 * n && u.some(p => p.d > 0);
  if (conD) {
    let prev = 0;
    for (let i = 0; i < n; i++) { if (u[i].d != null) prev = u[i].d; D[i] = prev; }
    const base = D[0];
    for (let i = 0; i < n; i++) D[i] -= base;
  } else {
    let ancla = null, acum = 0;
    for (let i = 0; i < n; i++) {
      const p = u[i];
      if (p.lat != null) {
        if (!ancla) ancla = p;
        else {
          const d = haversine(ancla, p);
          if (d >= perfil.pasoMin) { acum += d; ancla = p; }
        }
      }
      D[i] = acum;
    }
  }
  let distM = D[n - 1];
  if (num(r.distM) > 0) {
    if (distM > 0 && Math.abs(r.distM - distM) / r.distM < 0.1) {
      const k = r.distM / distM;
      for (let i = 0; i < n; i++) D[i] *= k;
    }
    distM = r.distM;
  }

  // En movimiento: velocidad suavizada (±5 s, sin cruzar pausas) ≥ umbral.
  const mov = new Uint8Array(n);
  const M = new Float64Array(n);
  let a = 0, b = 0, velMax = 0;
  for (let i = 1; i < n; i++) {
    if (pausa[i]) { M[i] = M[i - 1]; continue; }
    while (a < i && (T[a] < T[i] - VENTANA_VEL_S || hayPausaEntre(pausa, a, i))) a++;
    if (b < i) b = i;
    while (b + 1 < n && T[b + 1] <= T[i] + VENTANA_VEL_S && !pausa[b + 1]) b++;
    const ini = Math.min(a, i - 1);
    const dt = T[b] - T[ini];
    const v = dt > 0 ? (D[b] - D[ini]) / dt : 0;
    mov[i] = v >= perfil.vMov ? 1 : 0;
    if (mov[i] && dt >= 2 && v > velMax && v <= perfil.vMax) velMax = v;
    M[i] = M[i - 1] + (mov[i] ? T[i] - T[i - 1] : 0);
  }
  const tiempoTotalS = num(r.tiempoTotalS) || T[n - 1];
  let tiempoMovS = M[n - 1];
  if (!(tiempoMovS > 0)) tiempoMovS = num(r.tiempoRelojS) || tiempoTotalS;

  // Altitud suavizada (media de 5) e interpolada donde falta.
  const conAlt = u.filter(p => p.alt != null).length >= 2;
  const A = new Float64Array(n);
  let ascenso = null, descenso = null, altMin = null, altMax = null;
  if (conAlt) {
    const ia = [];
    u.forEach((p, i) => { if (p.alt != null) ia.push(i); });
    const sv = ia.map((_, k) => {
      const v = ia.slice(Math.max(0, k - 2), k + 3).map(i => u[i].alt);
      return v.reduce((s, x) => s + x, 0) / v.length;
    });
    let k = 0;
    for (let i = 0; i < n; i++) {
      while (k + 1 < ia.length && ia[k + 1] <= i) k++;
      if (i <= ia[0]) A[i] = sv[0];
      else if (k + 1 >= ia.length) A[i] = sv[ia.length - 1];
      else { const f = (i - ia[k]) / (ia[k + 1] - ia[k]); A[i] = sv[k] + f * (sv[k + 1] - sv[k]); }
    }
    let ref = sv[0], pos = 0, neg = 0;
    altMin = altMax = sv[0];
    sv.forEach(x => {
      altMin = Math.min(altMin, x); altMax = Math.max(altMax, x);
      if (x >= ref + HISTERESIS_M) { pos += x - ref; ref = x; } else if (x <= ref - HISTERESIS_M) { neg += ref - x; ref = x; }
    });
    ascenso = num(r.ascensoM) != null ? r.ascensoM : pos;
    descenso = num(r.descensoM) != null ? r.descensoM : neg;
  } else if (num(r.ascensoM) != null) {
    ascenso = r.ascensoM;
    descenso = num(r.descensoM);
  }

  // GAP: distancia equivalente en llano (solo tramos en movimiento).
  const G = new Float64Array(n);
  let p0 = 0, p1 = 0;
  for (let i = 1; i < n; i++) {
    let factor = 1;
    if (conAlt && deporte === "running") {
      while (p0 < i && D[p0] < D[i] - VENTANA_PEND_M) p0++;
      if (p1 < i) p1 = i;
      while (p1 + 1 < n && D[p1 + 1] <= D[i] + VENTANA_PEND_M) p1++;
      const dd = D[p1] - D[p0];
      const pend = dd >= 10 ? (A[p1] - A[p0]) / dd : 0;
      factor = costoMinetti(pend) / 3.6;
    }
    G[i] = G[i - 1] + (mov[i] ? (D[i] - D[i - 1]) * factor : 0);
  }

  // FC: integral por tramo (lpm × s) y tiempo con FC.
  const conFc = u.some(p => p.fc != null);
  const H = new Float64Array(n), HT = new Float64Array(n);
  let fcMaxObs = 0;
  for (let i = 1; i < n; i++) {
    const fc = u[i].fc;
    const dt = pausa[i] ? 0 : T[i] - T[i - 1];
    H[i] = H[i - 1] + (fc != null ? fc * dt : 0);
    HT[i] = HT[i - 1] + (fc != null ? dt : 0);
    if (fc != null) fcMaxObs = Math.max(fcMaxObs, fc);
  }
  if (u[0].fc != null) fcMaxObs = Math.max(fcMaxObs, u[0].fc);

  // Parciales por km (y el último, parcial) con valores interpolados al cruce.
  const en = (arr, i, f) => (i === 0 ? arr[0] : arr[i - 1] + f * (arr[i] - arr[i - 1]));
  const cortes = [{ i: 0, f: 0 }];
  let km = 1000;
  for (let i = 1; i < n && km <= D[n - 1]; i++) {
    while (km <= D[i] && km <= D[n - 1]) {
      const seg = D[i] - D[i - 1];
      cortes.push({ i, f: seg > 0 ? (km - D[i - 1]) / seg : 1 });
      km += 1000;
    }
  }
  const resto = D[n - 1] - (cortes.length - 1) * 1000;
  if (resto >= 10 || cortes.length === 1) cortes.push({ i: n - 1, f: 1 });
  const splits = [];
  for (let k = 1; k < cortes.length; k++) {
    const x = cortes[k - 1], y = cortes[k];
    const v = arr => en(arr, y.i, y.f) - en(arr, x.i, x.f);
    const d = v(D);
    if (d <= 0) continue;
    const s = { d: Math.round(d), t: Math.round(v(T)), tm: Math.round(v(M)) };
    if (conAlt) s.dz = Math.round(v(A));
    const ht = v(HT);
    if (conFc && ht > 0) s.fc = Math.round(v(H) / ht);
    const g = v(G);
    if (conAlt && deporte === "running" && g > 0 && s.tm > 0) s.gap = Math.round(s.tm / (g / 1000));
    splits.push(s);
  }
  const parciales = splits.filter(s => s.d >= 995).map(s => s.tm);

  // Zonas de FC y carga.
  const fcMaxRef = num(o.fcMax) || null;
  let zonas = null, trimp = 0;
  const lim = conFc ? limitesZonas(fcMaxRef, o.fcReposo) : null;
  if (lim) zonas = [0, 0, 0, 0, 0];
  const reposo = num(o.fcReposo) > 0 ? o.fcReposo : 60;
  for (let i = 1; i < n; i++) {
    const fc = u[i].fc;
    if (fc == null || pausa[i]) continue;
    const dt = T[i] - T[i - 1];
    if (zonas) zonas[zonaDe(fc, lim)] += dt;
    if (fcMaxRef && fcMaxRef > reposo) {
      const x = Math.max(0, Math.min(1, (fc - reposo) / (fcMaxRef - reposo)));
      trimp += (dt / 60) * x * 0.64 * Math.exp(1.92 * x);
    }
  }
  let carga = null;
  if (conFc && fcMaxRef) carga = { v: Math.round(trimp * 100 / TRIMP_HORA_UMBRAL), m: "trimp" };
  else if (deporte === "running" && distM > 0 && tiempoMovS > 0 && G[n - 1] > 0) {
    const umbral = num(o.ritmoUmbralS) > 0 ? o.ritmoUmbralS : 330;
    const IF = (G[n - 1] / tiempoMovS) / (1000 / umbral);
    carga = { v: Math.round((tiempoMovS / 3600) * IF * IF * 100), m: "rtss" };
  } else carga = cargaRpe(o.rpe, tiempoMovS / 60);

  // Cadencia: en carrera los relojes suelen dar una pierna (×2 = pasos/min).
  let cad = num(r.cadMedia);
  if (cad == null) {
    let s = 0, t = 0;
    for (let i = 1; i < n; i++) if (mov[i] && u[i].cad != null) { s += u[i].cad * (T[i] - T[i - 1]); t += T[i] - T[i - 1]; }
    cad = t > 0 ? s / t : null;
  }
  if (cad != null && deporte === "running" && cad < 120) cad *= 2;

  // Calorías: las del archivo; si no, solo con peso real (~1 kcal/kg/km al correr).
  let kcal = num(r.kcal) > 0 ? r.kcal : null;
  if (kcal == null && deporte === "running" && o.pesoKg >= 30 && o.pesoKg <= 250 && distM > 0) kcal = o.pesoKg * distM / 1000;

  const gps = u.filter(p => p.lat != null);
  const conRuta = gps.length >= 2;
  const fin = inicio + Math.round(Math.max(tiempoTotalS, T[n - 1]) * 1000);
  Object.assign(campos, {
    date: fechaLocal(inicio),
    distance: r2(distM / 1000),
    duration: r1(tiempoMovS / 60),
    inicio, fin,
    distanciaM: Math.round(distM),
    tiempoTotalS: Math.round(tiempoTotalS),
    tiempoMovS: Math.round(tiempoMovS),
    conRuta,
    parciales,
    splits
  });
  set("tiempoRelojS", num(r.tiempoRelojS) != null ? Math.round(r.tiempoRelojS) : null);
  if (conRuta) campos.mini = codificar(simplificar(gps, MINI_MAX).map(p => [p.lat, p.lon]), [1e5, 1e5]);
  const vueltas = (act.vueltas || []).filter(v => num(v.distM) != null || num(v.tiempoS) != null);
  if (vueltas.length > 1) campos.vueltas = vueltas.map(v => {
    const x = { d: Math.round(num(v.distM) || 0), t: Math.round(num(v.tiempoS) || num(v.tiempoRelojS) || 0), tm: Math.round(num(v.tiempoRelojS) || num(v.tiempoS) || 0) };
    if (num(v.fcMedia)) x.fc = Math.round(v.fcMedia);
    if (num(v.ascensoM) != null) x.dz = Math.round(v.ascensoM - (num(v.descensoM) || 0));
    return x;
  });
  const mejores = deporte === "running" ? mejoresMarcas(D, T) : {};
  if (Object.keys(mejores).length) campos.mejores = mejores;
  if (zonas) campos.zonas = zonas.map(Math.round);
  if (carga && carga.v > 0) campos.carga = carga;
  if (ascenso != null) { campos.desnivelPosM = Math.round(ascenso); if (descenso != null) campos.desnivelNegM = Math.round(descenso); }
  if (conAlt) { campos.altMinM = Math.round(altMin); campos.altMaxM = Math.round(altMax); }
  const vMax = num(r.velMaxMs) || velMax;
  if (vMax > 0) campos.velMaxKmh = r1(vMax * 3.6);
  if (conFc) {
    const media = num(r.fcMedia) || (HT[n - 1] > 0 ? H[n - 1] / HT[n - 1] : 0);
    if (media > 0) campos.fcMedia = Math.round(media);
    if ((num(r.fcMax) || fcMaxObs) > 0) campos.fcMax = Math.round(num(r.fcMax) || fcMaxObs);
  }
  if (cad != null && cad > 0) campos.cadMedia = Math.round(cad);
  if (kcal != null) campos.kcal = Math.round(kcal);
  if (conAlt && deporte === "running" && G[n - 1] > 0) campos.gapS = Math.round(tiempoMovS / (G[n - 1] / 1000));

  return { campos, ruta: armarRuta(u, D, T, pausa, inicio, deporte, conAlt) };
}
function hayPausaEntre(pausa, a, i) {
  for (let k = a + 1; k <= i; k++) if (pausa[k]) return true;
  return false;
}

// ---- Ruta completa (formato v1 extendido, D-067) ----
function armarRuta(u, D, T, pausa, inicio, deporte, conAlt) {
  const conGps = u.filter(p => p.lat != null).length >= 2;
  const conFc = u.some(p => p.fc != null), conCad = u.some(p => p.cad != null);
  const indices = u.map((p, i) => i).filter(i => !conGps || u[i].lat != null);
  if (indices.length < 2) return null;
  for (let paso = 1; paso <= 64; paso *= 2) {
    const sel = indices.filter((i, k) => k % paso === 0 || k === indices.length - 1 || pausa[i] || (k + 1 < indices.length && pausa[indices[k + 1]]));
    const tramos = [];
    let cuenta = 0;
    sel.forEach((i, k) => {
      if (k > 0 && hayPausaEntre(pausa, sel[k - 1], i)) { tramos.push(cuenta); cuenta = 0; }
      cuenta++;
    });
    tramos.push(cuenta);
    const ruta = { v: 2, deporte, inicio, n: sel.length, tramos };
    const tS = i => Math.round(T[i]);
    if (conGps) ruta.enc = codificar(sel.map(i => [u[i].lat, u[i].lon, tS(i)]), [1e5, 1e5, 1]);
    else ruta.serie = codificar(sel.map(i => [tS(i), Math.round(D[i])]), [1, 1]);
    ruta.dist = codificar(sel.map(i => [Math.round(D[i])]), [1]);
    if (conAlt) ruta.alt = codificar(sel.map(i => [u[i].alt == null ? SIN : Math.round(u[i].alt)]), [1]);
    if (conFc) ruta.fc = codificar(sel.map(i => [u[i].fc == null ? 0 : Math.round(u[i].fc)]), [1]);
    if (conCad) ruta.cad = codificar(sel.map(i => [u[i].cad == null ? 0 : Math.round(u[i].cad)]), [1]);
    if (paso > 1) ruta.paso = paso;
    if (JSON.stringify(ruta).length <= RUTA_MAX) return ruta;
  }
  return null;
}

// Lee una ruta guardada (v1 del GPS viejo o v2 importada):
// [[{ lat, lon, t, alt, fc, cad, d }], ...] por tramo.
function leerRuta(ruta) {
  if (!ruta || (!ruta.enc && !ruta.serie)) return [];
  const col = (txt, sinDato) => (txt ? decodificar(txt, [1]).map(f => (f[0] === sinDato ? null : f[0])) : []);
  const alts = col(ruta.alt, SIN), fcs = col(ruta.fc, 0), cads = col(ruta.cad, 0), dists = col(ruta.dist, null);
  let puntos;
  if (ruta.enc) {
    puntos = decodificar(ruta.enc, [1e5, 1e5, 1]).map(f => ({ lat: f[0], lon: f[1], t: ruta.inicio + f[2] * 1000 }));
  } else {
    puntos = decodificar(ruta.serie, [1, 1]).map(f => ({ lat: null, lon: null, t: ruta.inicio + f[0] * 1000, d: f[1] }));
  }
  puntos.forEach((p, i) => {
    p.alt = alts[i] == null ? null : alts[i];
    p.fc = fcs[i] == null ? null : fcs[i];
    p.cad = cads[i] == null ? null : cads[i];
    if (p.d == null) p.d = dists[i] == null ? null : dists[i];
  });
  const tramos = [];
  let i = 0;
  (ruta.tramos && ruta.tramos.length ? ruta.tramos : [puntos.length]).forEach(k => { tramos.push(puntos.slice(i, i + k)); i += k; });
  return tramos;
}

// Mini ruta guardada en el documento → [{ lat, lon }].
function leerMini(texto) {
  return texto ? decodificar(texto, [1e5, 1e5]).map(f => ({ lat: f[0], lon: f[1] })) : [];
}

return {
  PERFILES, DISTANCIAS, PAUSA_S, HISTERESIS_M, SIN,
  calcular, limpiar, mejoresMarcas, simplificar, costoMinetti, limitesZonas, zonaDe, cargaRpe,
  codificar, decodificar, leerRuta, leerMini, haversine, fechaLocal, tituloAuto
};
});
