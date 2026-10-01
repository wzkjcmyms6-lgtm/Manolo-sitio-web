// ---------- Actividades: textos y trazo del recorrido (sin pantalla) ----------
// Formatos de distancia, tiempo, ritmo y velocidad, calorías estimadas y el
// dibujo SVG de la ruta (sin internet: se usa en vivo y cuando no hay mapa).
// Se prueba en tests/actividad-vista.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ActividadVista = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const coma = (n, d) => n.toFixed(d).replace(".", ",");
const dos = n => String(n).padStart(2, "0");

// "2,45 km" (siempre en km, como las apps de deporte).
function distancia(m) {
  return `${coma(Math.max(0, m || 0) / 1000, 2)} km`;
}
// "12:34" o "1:02:03".
function tiempo(s) {
  const t = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  return h ? `${h}:${dos(m)}:${dos(x)}` : `${m}:${dos(x)}`;
}
// "5:32 /km"; sin movimiento (o más lento que 30 min/km) → "--:--".
function ritmo(sKm, sinUnidad) {
  if (!(sKm > 0) || sKm >= 1800) return sinUnidad ? "--:--" : "--:-- /km";
  let m = Math.floor(sKm / 60), s = Math.round(sKm % 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${dos(s)}${sinUnidad ? "" : " /km"}`;
}
// "28,8 km/h".
function velocidad(ms, sinUnidad) {
  return `${coma(Math.max(0, ms || 0) * 3.6, 1)}${sinUnidad ? "" : " km/h"}`;
}
function desnivel(m) {
  return m == null ? "No disponible" : `${Math.round(m)} m`;
}

// Calorías de correr: ~1 kcal por kg por km (estimación conocida y simple).
// Solo con un peso real; si no, null (no se muestra). Bicicleta: no (D-016).
function caloriasRunning(distanciaM, pesoKg) {
  if (!(pesoKg >= 30 && pesoKg <= 250) || !(distanciaM > 0)) return null;
  return Math.round(pesoKg * distanciaM / 1000);
}
// Último pesaje anotado (Ejercicio › Perfil) o el peso de Ajustes si lo
// escribiste tú. { "2026-09-01": 84.5 } → 84.5
function pesoActual(pesajes, pesoAjustes) {
  const fechas = Object.keys(pesajes || {}).filter(f => pesajes[f] > 0).sort();
  if (fechas.length) return Number(pesajes[fechas[fechas.length - 1]]);
  return pesoAjustes > 0 ? Number(pesoAjustes) : null;
}

const TEXTO_GPS = {
  esperando: "Buscando GPS…",
  "sin señal": "Sin señal de GPS",
  impreciso: "GPS impreciso",
  ok: "GPS listo"
};
function textoGps(estado, acc) {
  const t = TEXTO_GPS[estado] || "GPS";
  return estado === "ok" && acc > 0 ? `${t} · ±${Math.round(acc)} m` : t;
}

// Proyecta los tramos [[{lat, lon}]] a un rectángulo ancho × alto (con
// margen), sin deformar: la longitud se achica con el coseno de la latitud.
function proyectar(tramos, ancho, alto, margen) {
  const todos = [].concat(...(tramos || []));
  if (!todos.length) return [];
  const lat0 = todos.reduce((s, p) => s + p.lat, 0) / todos.length;
  const k = Math.cos(lat0 * Math.PI / 180);
  const xs = todos.map(p => p.lon * k), ys = todos.map(p => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 1e-6), h = Math.max(maxY - minY, 1e-6);
  const esc = Math.min((ancho - 2 * margen) / w, (alto - 2 * margen) / h);
  const dx = (ancho - w * esc) / 2, dy = (alto - h * esc) / 2;
  return tramos.map(tr => tr.map(p => [dx + (p.lon * k - minX) * esc, alto - (dy + (p.lat - minY) * esc)]));
}
// Con muchos puntos se dibuja uno de cada n (el trazo se ve igual y pesa menos).
function aligerar(tramo, max) {
  if (tramo.length <= max) return tramo;
  const paso = Math.ceil(tramo.length / max);
  const out = tramo.filter((_, i) => i % paso === 0);
  if (out[out.length - 1] !== tramo[tramo.length - 1]) out.push(tramo[tramo.length - 1]);
  return out;
}
function svgRuta(tramos, opciones) {
  const o = Object.assign({ ancho: 320, alto: 200, margen: 14, maxPuntos: 600 }, opciones || {});
  const total = [].concat(...(tramos || [])).length;
  const ligeros = (tramos || []).filter(t => t.length).map(t => aligerar(t, Math.max(2, Math.round(o.maxPuntos * t.length / Math.max(1, total)))));
  const pr = proyectar(ligeros, o.ancho, o.alto, o.margen);
  const lineas = pr.filter(t => t.length > 1).map(t => `<polyline points="${t.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}"/>`).join("");
  const ini = pr.length && pr[0][0], fin = pr.length && pr[pr.length - 1][pr[pr.length - 1].length - 1];
  const punto = (p, c) => (p ? `<circle class="${c}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5"/>` : "");
  return `<svg class="act-ruta" viewBox="0 0 ${o.ancho} ${o.alto}" role="img" aria-label="Recorrido">${lineas ? `<g class="act-ruta-linea">${lineas}</g>` : ""}${punto(ini, "act-ruta-ini")}${total > 1 ? punto(fin, "act-ruta-fin") : ""}</svg>`;
}

return { distancia, tiempo, ritmo, velocidad, desnivel, caloriasRunning, pesoActual, textoGps, proyectar, aligerar, svgRuta };
});
