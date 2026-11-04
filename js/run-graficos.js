// ---------- Running: gráficos del detalle (sin pantalla) ----------
// Perfil de ritmo / FC con la altura de fondo (eje x = distancia) y cursor
// que la pantalla mueve junto con el mapa; barras de los parciales con el
// más rápido y el más lento marcados; zonas de FC. Todo en SVG/HTML como
// texto. Pruebas: tests/run-graficos.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-metricas.js"), require("./run-vista.js"));
  else root.RunGraficos = factory(root.RunMetricas, root.RunVista);
})(typeof self !== "undefined" ? self : this, function (RunMetricas, RunVista) {
"use strict";

const MUESTRAS = 300;
const VENTANA_S = 10;

// Serie para el perfil a partir de los tramos de la ruta (RunMetricas.leerRuta).
// → { d, t, ritmo (s/km o null si quieto), alt, fc, lat, lon } en ≤ 300 muestras.
function serie(tramos, deporte) {
  const ps = [].concat(...(tramos || [])).filter(p => p && p.t != null);
  if (ps.length < 2) return null;
  // Distancia: la de la ruta (del reloj) o, si no, GPS.
  const D = [];
  let acum = 0;
  ps.forEach((p, i) => {
    if (p.d != null) { D.push(p.d); acum = p.d; return; }
    if (i && p.lat != null && ps[i - 1].lat != null) acum += RunMetricas.haversine(ps[i - 1], p);
    D.push(acum);
  });
  const T = ps.map(p => (p.t - ps[0].t) / 1000);
  const total = D[D.length - 1];
  if (!(total > 0)) return null;
  // Velocidad suavizada (±10 s) en cada punto.
  const vel = new Array(ps.length);
  let a = 0, b = 0;
  for (let i = 0; i < ps.length; i++) {
    while (T[a] < T[i] - VENTANA_S) a++;
    if (b < i) b = i;
    while (b + 1 < ps.length && T[b + 1] <= T[i] + VENTANA_S) b++;
    const dt = T[b] - T[a];
    vel[i] = dt > 0 && dt < 120 ? (D[b] - D[a]) / dt : null;
  }
  const minVel = deporte === "bicicleta" ? 1 : 0.5;
  const n = Math.min(MUESTRAS, ps.length);
  const out = { d: [], t: [], ritmo: [], vel: [], alt: [], fc: [], lat: [], lon: [], total, conAlt: ps.some(p => p.alt != null), conFc: ps.some(p => p.fc != null), conGps: ps.some(p => p.lat != null) };
  let j = 0;
  for (let k = 1; k <= n; k++) {
    const hasta = total * k / n;
    let sv = 0, cv = 0, sa = 0, ca = 0, sf = 0, cf = 0, ult = null;
    while (j < ps.length && (D[j] <= hasta || k === n)) {
      const p = ps[j];
      if (vel[j] != null) { sv += vel[j]; cv++; }
      if (p.alt != null) { sa += p.alt; ca++; }
      if (p.fc != null) { sf += p.fc; cf++; }
      if (p.lat != null) ult = p;
      j++;
    }
    const v = cv ? sv / cv : null;
    out.d.push(hasta);
    out.t.push(T[Math.min(j, ps.length) - 1] || 0);
    out.vel.push(v);
    out.ritmo.push(v != null && v >= minVel ? 1000 / v : null);
    out.alt.push(ca ? sa / ca : null);
    out.fc.push(cf ? sf / cf : null);
    out.lat.push(ult ? ult.lat : (out.lat.length ? out.lat[out.lat.length - 1] : null));
    out.lon.push(ult ? ult.lon : (out.lon.length ? out.lon[out.lon.length - 1] : null));
  }
  // Completa huecos de altura y FC con el valor anterior (para dibujar sin cortes).
  ["alt", "fc"].forEach(k => { let prev = out[k].find(v => v != null); out[k] = out[k].map(v => (v == null ? prev : (prev = v))); });
  return out;
}

function percentil(vals, p) {
  const v = vals.filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
}

// Escalas del perfil. modo: "ritmo" | "vel" | "fc" | "altura".
function escalas(s, modo, ancho, alto) {
  const m = { izq: 6, der: 46, arr: 10, aba: 22 };
  const w = ancho - m.izq - m.der, h = alto - m.arr - m.aba;
  const x = d => m.izq + (d / s.total) * w;
  let yMin, yMax, invertido = false;
  const vals = modo === "fc" ? s.fc : modo === "altura" ? s.alt : modo === "vel" ? s.vel.map(v => (v != null ? v * 3.6 : null)) : s.ritmo;
  if (modo === "ritmo") {
    yMin = percentil(vals, 0.03); yMax = percentil(vals, 0.97);
    invertido = true; // más rápido arriba
  } else { yMin = percentil(vals, 0); yMax = percentil(vals, 1); }
  if (yMin == null) return null;
  if (yMax - yMin < (modo === "ritmo" ? 30 : modo === "altura" ? 10 : 5)) { const c = (yMax + yMin) / 2, r = modo === "ritmo" ? 15 : modo === "altura" ? 5 : 2.5; yMin = c - r; yMax = c + r; }
  const pad = (yMax - yMin) * 0.08;
  yMin -= pad; yMax += pad;
  const y = v => {
    const f = (Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin);
    return m.arr + (invertido ? f : 1 - f) * h;
  };
  return { m, w, h, x, y, yMin, yMax, vals, invertido };
}

const fmtEje = (modo, v) => (modo === "ritmo" ? RunVista.ritmo(v, true) : modo === "altura" ? `${RunVista.numero(Math.round(v))} m` : modo === "vel" ? RunVista.numero(v, 0) : `${Math.round(v)}`);

// SVG del perfil. bandas: [[desdeM, hastaM, clase]] (intervalos de la rutina).
function svgPerfil(s, opciones) {
  const o = Object.assign({ ancho: 340, alto: 170, modo: "ritmo", bandas: [] }, opciones || {});
  const e = escalas(s, o.modo, o.ancho, o.alto);
  if (!e) return "";
  const { m, x, y } = e;
  const fondo = (o.alto - m.aba);
  // Altura de fondo (si el modo no es altura).
  let area = "";
  if (s.conAlt && o.modo !== "altura") {
    const ea = escalas(s, "altura", o.ancho, o.alto);
    const pts = s.d.map((d, i) => `${x(d).toFixed(1)},${ea.y(s.alt[i]).toFixed(1)}`);
    area = `<path class="rg-alt" d="M${x(0).toFixed(1)},${fondo} L${x(s.d[0]).toFixed(1)},${ea.y(s.alt[0]).toFixed(1)} L${pts.join(" L")} L${x(s.total).toFixed(1)},${fondo} Z"/>`;
  }
  // Línea principal (con cortes donde no hay dato, p. ej. quieto).
  let linea = "", abierto = false;
  e.vals.forEach((v, i) => {
    if (v == null) { abierto = false; return; }
    linea += `${abierto ? "L" : "M"}${x(s.d[i]).toFixed(1)},${y(v).toFixed(1)} `;
    abierto = true;
  });
  const principal = o.modo === "altura"
    ? `<path class="rg-alt rg-alt-sola" d="M${x(0).toFixed(1)},${fondo} ${linea.replace(/^M/, "L")} L${x(s.total).toFixed(1)},${fondo} Z"/>`
    : `<path class="rg-linea rg-${o.modo}" d="${linea.trim()}"/>`;
  const bandas = (o.bandas || []).map(([a, b, c]) => `<rect class="rg-banda ${c || ""}" x="${x(a).toFixed(1)}" y="${m.arr}" width="${Math.max(1, x(b) - x(a)).toFixed(1)}" height="${e.h}"/>`).join("");
  // Marcas del eje x cada 1, 2, 5 o 10 km.
  const kmTot = s.total / 1000;
  const paso = [1, 2, 5, 10, 20, 50].find(p => kmTot / p <= 6) || 100;
  let ejeX = "";
  for (let k = paso; k < kmTot; k += paso) ejeX += `<text class="rg-eje" x="${x(k * 1000).toFixed(1)}" y="${o.alto - 6}" text-anchor="middle">${k}</text>`;
  ejeX += `<text class="rg-eje" x="${x(s.total).toFixed(1)}" y="${o.alto - 6}" text-anchor="end">km</text>`;
  const ejeY = [e.yMin + (e.yMax - e.yMin) * 0.1, e.yMax - (e.yMax - e.yMin) * 0.1].map(v =>
    `<text class="rg-eje" x="${o.ancho - 4}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmtEje(o.modo, v)}</text>`).join("");
  return `<svg class="rg" viewBox="0 0 ${o.ancho} ${o.alto}" width="100%" role="img" aria-label="Perfil de ${o.modo}">` +
    `${bandas}${area}${principal}<line class="rg-base" x1="${m.izq}" x2="${o.ancho - m.der}" y1="${fondo}" y2="${fondo}"/>${ejeX}${ejeY}` +
    `<g class="rg-cursor" hidden><line x1="0" x2="0" y1="${m.arr}" y2="${fondo}"/><circle r="4" cx="0" cy="0"/></g></svg>`;
}
// Índice de la muestra más cercana a la posición x (en unidades del viewBox).
function indicePorX(s, xv, ancho) {
  const m = { izq: 6, der: 46 };
  const d = ((xv - m.izq) / (ancho - m.izq - m.der)) * s.total;
  let mejor = 0;
  for (let i = 1; i < s.d.length; i++) if (Math.abs(s.d[i] - d) < Math.abs(s.d[mejor] - d)) mejor = i;
  return mejor;
}
// Posición del cursor (x, y) para la muestra i.
function puntoCursor(s, i, modo, ancho, alto) {
  const e = escalas(s, modo, ancho, alto);
  if (!e) return null;
  const v = e.vals[i];
  return { x: e.x(s.d[i]), y: v != null ? e.y(v) : null };
}

// Parciales: ritmo por km y ancho de la barra (más rápido = más larga).
// Solo los completos (≥ 995 m) compiten por "más rápido" y "más lento".
function barrasParciales(splits, deporte) {
  const filas = (splits || []).map((s, i) => {
    const seg = s.tm > 0 ? s.tm : s.t;
    return { i, km: i + 1, d: s.d, seg, ritmo: RunVista.ritmoDe(seg, s.d), dz: s.dz, fc: s.fc, gap: s.gap, completo: s.d >= 995 };
  });
  const comp = filas.filter(f => f.completo && f.ritmo > 0);
  if (!comp.length) return filas.map(f => Object.assign(f, { ancho: 0.5 }));
  const rs = comp.map(f => f.ritmo);
  const min = Math.min(...rs), max = Math.max(...rs);
  const rapido = comp.find(f => f.ritmo === min), lento = comp.find(f => f.ritmo === max);
  return filas.map(f => Object.assign(f, {
    // Escala de 35 % a 100 % entre el más lento y el más rápido.
    ancho: f.ritmo > 0 ? (max > min ? 0.35 + 0.65 * (max - Math.min(max, f.ritmo)) / (max - min) : 1) : 0,
    rapido: comp.length > 1 && f === rapido,
    lento: comp.length > 1 && f === lento && max > min
  }));
}

// Zonas de FC: [{ z, desde, hasta, seg, pct }] a partir de los segundos por zona.
function zonas(seg, limites) {
  const total = (seg || []).reduce((s, x) => s + x, 0);
  if (!total || !limites) return [];
  const lim = limites.map(Math.round);
  return seg.map((s, i) => ({
    z: i + 1,
    desde: i === 0 ? null : lim[i - 1],
    hasta: i === 4 ? null : lim[i] - 1,
    seg: s,
    pct: s / total
  }));
}
// Segundos por zona desde la ruta, con los límites que estén en Ajustes ahora.
function zonasDeRuta(tramos, limites) {
  if (!limites) return null;
  const out = [0, 0, 0, 0, 0];
  let con = false;
  (tramos || []).forEach(t => {
    for (let i = 1; i < t.length; i++) {
      const fc = t[i].fc, dt = (t[i].t - t[i - 1].t) / 1000;
      if (fc == null || !(dt > 0) || dt > RunMetricas.PAUSA_S) continue;
      out[RunMetricas.zonaDe(fc, limites)] += dt;
      con = true;
    }
  });
  return con ? out.map(Math.round) : null;
}

return { serie, svgPerfil, indicePorX, puntoCursor, barrasParciales, zonas, zonasDeRuta, escalas };
});
