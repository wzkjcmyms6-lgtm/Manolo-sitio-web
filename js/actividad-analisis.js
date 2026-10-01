// ---------- Running y Bici: análisis e historial (sin pantalla) ----------
// - Ritmo o velocidad a lo largo del recorrido (por tramos de distancia),
//   y perfil de altitud, a partir de la ruta guardada.
// - Totales por semana (distancia, tiempo, ritmo/velocidad promedio).
// - Mejores marcas: solo con actividades GPS (datos medidos, no a mano).
// Devuelve números y SVG/HTML como texto: tests/actividad-analisis.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./actividad-motor.js"), require("./ej-sesiones.js"));
  else root.ActividadAnalisis = factory(root.ActividadMotor, root.EjSesiones);
})(typeof self !== "undefined" ? self : this, function (AM, ES) {
"use strict";

const PASOS_M = [50, 100, 200, 250, 500, 1000, 2000, 5000];

// Distancia acumulada y hora de cada punto. Entre tramos (señal perdida) la
// distancia sigue en línea recta, pero esa parte queda marcada como hueco.
function acumulados(tramos) {
  const pts = [];
  let d = 0, ant = null;
  (tramos || []).forEach((tr, i) => tr.forEach((p, j) => {
    if (ant) d += AM.haversine(ant, p);
    pts.push({ d, t: p.t, alt: p.alt, hueco: i > 0 && j === 0 });
    ant = p;
  }));
  return pts;
}
function interpolar(pts, d) {
  let i = 1;
  while (i < pts.length - 1 && pts[i].d < d) i++;
  const a = pts[i - 1], b = pts[i];
  const f = b.d > a.d ? (d - a.d) / (b.d - a.d) : 0;
  return a.t + f * (b.t - a.t);
}

// Velocidad (m/s) por tramos de distancia: [{ d0, d1, v }]. v = null si el
// tramo cruza un hueco de señal o si estuviste parado (menos de 0,5 m/s).
function serieVelocidad(tramos, maxPuntos) {
  const pts = acumulados(tramos);
  if (pts.length < 2) return [];
  const total = pts[pts.length - 1].d;
  const tam = PASOS_M.find(p => total / p <= (maxPuntos || 60)) || 10000;
  const huecos = pts.filter(p => p.hueco).map((p, k) => [pts[pts.indexOf(p) - 1].d, p.d, k]);
  const out = [];
  for (let d0 = 0; d0 < total - tam * 0.25; d0 += tam) {
    const d1 = Math.min(total, d0 + tam);
    const conHueco = huecos.some(([a, b]) => a < d1 && b > d0);
    const dt = (interpolar(pts, d1) - interpolar(pts, d0)) / 1000;
    const v = !conHueco && dt > 0 ? (d1 - d0) / dt : null;
    out.push({ d0, d1, v: v != null && v >= 0.5 ? v : null });
  }
  return out;
}
// Altitud a lo largo del recorrido: [{ d, alt }] (solo puntos con altitud).
function serieAltitud(tramos, maxPuntos) {
  const pts = acumulados(tramos).filter(p => p.alt != null);
  if (pts.length < 2) return [];
  const paso = Math.max(1, Math.ceil(pts.length / (maxPuntos || 80)));
  return pts.filter((_, i) => i % paso === 0 || i === pts.length - 1).map(p => ({ d: p.d, alt: p.alt }));
}

// Gráfico de línea en SVG. puntos: [{ x, y }] (y null = corte).
// opciones: { ancho, alto, invertido (lo más chico arriba: el ritmo),
// etiquetaY(y) → texto, etiquetaX(x) → texto, clase, rangoMin (escala
// mínima del eje Y: diferencias chicas no se exageran) }.
function svgLinea(puntos, o) {
  o = Object.assign({ ancho: 340, alto: 130, invertido: false, etiquetaY: String, etiquetaX: String, clase: "", rangoMin: 0 }, o || {});
  const validos = puntos.filter(p => p.y != null);
  if (validos.length < 2) return "";
  const ml = 44, mr = 8, mt = 10, mb = 20;
  const xs = puntos.map(p => p.x), ys = validos.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const minimo = Math.max(o.rangoMin, 1e-6);
  if (y1 - y0 < minimo) { const c = (y0 + y1) / 2; y0 = c - minimo / 2; y1 = c + minimo / 2; }
  const px = x => ml + (x1 > x0 ? (x - x0) / (x1 - x0) : 0) * (o.ancho - ml - mr);
  const py = y => {
    const f = (y - y0) / (y1 - y0);
    return mt + (o.invertido ? f : 1 - f) * (o.alto - mt - mb);
  };
  let d = "", abierto = false;
  puntos.forEach(p => {
    if (p.y == null) { abierto = false; return; }
    d += `${abierto ? "L" : "M"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`;
    abierto = true;
  });
  const arriba = o.invertido ? y0 : y1, abajo = o.invertido ? y1 : y0;
  return `<svg class="act-linea ${o.clase}" viewBox="0 0 ${o.ancho} ${o.alto}" role="img">
    <line class="act-linea-eje" x1="${ml}" y1="${mt}" x2="${o.ancho - mr}" y2="${mt}"/>
    <line class="act-linea-eje" x1="${ml}" y1="${o.alto - mb}" x2="${o.ancho - mr}" y2="${o.alto - mb}"/>
    <text class="act-linea-txt" x="${ml - 6}" y="${mt + 4}" text-anchor="end">${o.etiquetaY(arriba)}</text>
    <text class="act-linea-txt" x="${ml - 6}" y="${o.alto - mb + 4}" text-anchor="end">${o.etiquetaY(abajo)}</text>
    <text class="act-linea-txt" x="${ml}" y="${o.alto - 4}">${o.etiquetaX(x0)}</text>
    <text class="act-linea-txt" x="${o.ancho - mr}" y="${o.alto - 4}" text-anchor="end">${o.etiquetaX(x1)}</text>
    <path class="act-linea-trazo" d="${d}"/>
  </svg>`;
}

// ---- Semanas ----
// actividades: docs de running/ o bicicleta/ (manuales y GPS).
// → [{ desde, km, min, n, segMov }] del más viejo al más nuevo (n semanas).
function porSemana(actividades, hoy, n) {
  const fin = ES.lunesDe(hoy);
  const semanas = [];
  const d = new Date(fin + "T12:00:00");
  d.setDate(d.getDate() - 7 * (n - 1));
  for (let i = 0; i < n; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    semanas.push({ desde: iso, km: 0, min: 0, n: 0, segMov: 0 });
    d.setDate(d.getDate() + 7);
  }
  const idx = new Map(semanas.map((s, i) => [s.desde, i]));
  (actividades || []).forEach(a => {
    if (!a.date || a.date > hoy) return;
    const i = idx.get(ES.lunesDe(a.date));
    if (i == null) return;
    const s = semanas[i];
    s.km += a.distance || 0;
    s.min += a.duration || 0;
    s.n++;
    // Para el promedio: con GPS el tiempo en movimiento; a mano, los minutos.
    s.segMov += a.fuente === "gps" && a.tiempoMovS > 0 ? a.tiempoMovS : (a.duration || 0) * 60;
  });
  return semanas;
}

// Comparación simple: últimas 4 semanas contra las 4 anteriores.
function tendencia(semanas) {
  const suma = arr => arr.reduce((s, x) => s + x.km, 0);
  const ult = suma(semanas.slice(-4)), prev = suma(semanas.slice(-8, -4));
  return { kmUltimas: ult, kmAnteriores: prev, cambio: prev > 0 ? (ult - prev) / prev : null };
}

// ---- Mejores marcas (solo GPS) ----
function mejorVentana(parciales, k) {
  if (!parciales || parciales.length < k) return null;
  let suma = 0, mejor = Infinity;
  parciales.forEach((s, i) => {
    suma += s;
    if (i >= k) suma -= parciales[i - k];
    if (i >= k - 1 && suma < mejor) mejor = suma;
  });
  return mejor;
}
// → [{ clave, titulo, seg?, metros?, velMs?, fecha, id }]
function mejores(actividades, deporte) {
  const gps = (actividades || []).filter(a => a.fuente === "gps" && a.distanciaM > 0);
  const out = [];
  const mejorDe = (clave, titulo, valorDe, menor) => {
    let m = null;
    gps.forEach(a => {
      const v = valorDe(a);
      if (v == null || !isFinite(v)) return;
      if (!m || (menor ? v < m.v : v > m.v)) m = { v, a };
    });
    if (m) out.push({ clave, titulo, valor: m.v, fecha: m.a.date, id: m.a.id });
  };
  if (deporte === "running") {
    mejorDe("1k", "Mejor 1 km", a => mejorVentana(a.parciales, 1), true);
    mejorDe("5k", "Mejor 5 km", a => mejorVentana(a.parciales, 5), true);
    mejorDe("10k", "Mejor 10 km", a => mejorVentana(a.parciales, 10), true);
    mejorDe("larga", "Carrera más larga", a => a.distanciaM, false);
  } else {
    mejorDe("larga", "Rodada más larga", a => a.distanciaM, false);
    mejorDe("media", "Mejor velocidad media", a => (a.distanciaM >= 5000 && a.tiempoMovS > 0 ? a.distanciaM / a.tiempoMovS : null), false);
    mejorDe("5k", "Mejor 5 km", a => mejorVentana(a.parciales, 1), true);
  }
  return out;
}

// ---- Gráfico de barras por semana (mismas clases que el de Ejercicio › Perfil) ----
// barras: [{ etiqueta, valor, texto }] · opciones: { etiquetaEje(v, tope), max? }
function htmlBarras(barras, opciones) {
  const o = opciones || {};
  const max = Math.max(0, ...barras.map(b => b.valor || 0));
  const { paso, tope } = ES.escalaY(max, o.metrica || "volumen");
  const lineas = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) lineas.push(v);
  const pct = v => (tope > 0 ? (v / tope) * 100 : 0).toFixed(2);
  const cada = Math.max(1, Math.ceil(barras.length / 6));
  const etq = v => (o.etiquetaEje ? o.etiquetaEje(v, tope) : String(v));
  const ancho = lineas.map(etq).reduce((a, t) => (t.length > a.length ? t : a), "");
  return `
    <div class="ejd-graf">
      <div class="ejd-ejey" aria-hidden="true"><span class="ejd-ejey-ancho">${ancho}</span>${lineas.map(v => `<span style="bottom:${pct(v)}%">${etq(v)}</span>`).join("")}</div>
      <div class="ejd-area">
        ${lineas.map(v => `<i class="ejd-linea" style="bottom:${pct(v)}%"></i>`).join("")}
        <div class="ejd-barras">${barras.map((b, i) => `<span class="ejd-col" role="img" aria-label="${b.etiqueta}: ${b.texto}"><span class="ejd-bar" style="height:${b.valor > 0 ? Math.max(1.5, Number(pct(b.valor))) : 0}%"></span></span>`).join("")}</div>
      </div>
      <span></span>
      <div class="ejd-ejex" aria-hidden="true">${barras.map((b, i) => `<span>${(barras.length - 1 - i) % cada === 0 ? `<em>${b.etiqueta}</em>` : ""}</span>`).join("")}</div>
    </div>`;
}

return { acumulados, serieVelocidad, serieAltitud, svgLinea, porSemana, tendencia, mejorVentana, mejores, htmlBarras };
});
