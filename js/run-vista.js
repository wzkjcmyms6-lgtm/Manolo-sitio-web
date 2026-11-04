// ---------- Running: textos, trazo SVG y GPX (sin pantalla) ----------
// Formatos de Bolivia (es-BO): "13,58 km", "5:32 /km", "1:02:03",
// "3.640 m", "mar 4 nov · 06:42". Trazo SVG de la ruta (sin internet: para
// tarjetas y cuando el mapa no carga) y exportar a GPX. Basado en el viejo
// js/actividad-vista.js (git a66de91). Pruebas: tests/run-vista.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RunVista = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const dos = n => String(n).padStart(2, "0");
// 1234.5 → "1.234,5" (separador de miles con punto, decimal con coma).
function numero(n, dec) {
  if (n == null || !isFinite(n)) return "—";
  const d = dec == null ? 0 : dec;
  const [ent, frac] = Math.abs(n).toFixed(d).split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 && Number(Math.abs(n).toFixed(d)) !== 0 ? "−" : "") + miles + (frac ? "," + frac : "");
}
const km = (m, dec) => `${numero((m || 0) / 1000, dec == null ? 2 : dec)} km`;
// "12:34" o "1:02:03".
function tiempo(s) {
  const t = Math.max(0, Math.round(s || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  return h ? `${h}:${dos(m)}:${dos(x)}` : `${m}:${dos(x)}`;
}
// "1 h 5 min" / "42 min" (para totales).
function duracion(s) {
  const m = Math.round((s || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`;
}
// "5:32 /km"; sin movimiento o más lento que 30 min/km → "--:--".
function ritmo(sKm, sinUnidad) {
  if (!(sKm > 0) || sKm >= 1800) return sinUnidad ? "--:--" : "--:-- /km";
  let m = Math.floor(sKm / 60), s = Math.round(sKm % 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${dos(s)}${sinUnidad ? "" : " /km"}`;
}
const ritmoDe = (seg, metros) => (metros > 0 ? seg / (metros / 1000) : null);
const velocidad = (seg, metros, sinUnidad) => `${numero(seg > 0 ? (metros / seg) * 3.6 : 0, 1)}${sinUnidad ? "" : " km/h"}`;
const metros = m => `${numero(Math.round(m || 0))} m`;

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const hora = d => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
// Fecha de una actividad: con hora si la tiene (inicio), si no solo el día.
function fechaActividad(doc, larga) {
  if (doc && doc.inicio > 0) {
    const d = new Date(doc.inicio);
    return larga
      ? `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()} · ${hora(d)}`
      : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""} · ${hora(d)}`;
  }
  const f = String((doc && doc.date) || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  const d = new Date(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
  return larga ? `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}` : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

// Datos básicos de cualquier actividad (manual, rutina, GPS viejo o importada).
function basicos(doc) {
  const distM = Number(doc.distanciaM) > 0 ? Number(doc.distanciaM) : (Number(doc.distance) || 0) * 1000;
  const movS = Number(doc.tiempoMovS) > 0 ? Number(doc.tiempoMovS) : Number(doc.tiempoActivoS) > 0 ? Number(doc.tiempoActivoS) : (Number(doc.duration) || 0) * 60;
  const totalS = Number(doc.tiempoTotalS) > 0 ? Number(doc.tiempoTotalS) : movS;
  return { distM, movS, totalS, ritmoS: ritmoDe(movS, distM) };
}

// Proyecta tramos [[{lat, lon}]] a un rectángulo sin deformar.
function proyectar(tramos, ancho, alto, margen) {
  const todos = [].concat(...(tramos || []));
  if (!todos.length) return [];
  const lat0 = todos.reduce((s, p) => s + p.lat, 0) / todos.length;
  const k = Math.cos(lat0 * Math.PI / 180);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  todos.forEach(p => { const x = p.lon * k; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, p.lat); maxY = Math.max(maxY, p.lat); });
  const w = Math.max(maxX - minX, 1e-6), h = Math.max(maxY - minY, 1e-6);
  const esc = Math.min((ancho - 2 * margen) / w, (alto - 2 * margen) / h);
  const dx = (ancho - w * esc) / 2, dy = (alto - h * esc) / 2;
  return tramos.map(tr => tr.map(p => [dx + (p.lon * k - minX) * esc, alto - (dy + (p.lat - minY) * esc)]));
}
function aligerar(tramo, max) {
  if (tramo.length <= max) return tramo;
  const paso = Math.ceil(tramo.length / max);
  const out = tramo.filter((_, i) => i % paso === 0);
  if (out[out.length - 1] !== tramo[tramo.length - 1]) out.push(tramo[tramo.length - 1]);
  return out;
}
function svgRuta(tramos, opciones) {
  const o = Object.assign({ ancho: 320, alto: 180, margen: 14, maxPuntos: 500, clase: "run-ruta", marcas: true }, opciones || {});
  const conPuntos = (tramos || []).filter(t => t && t.length && t[0].lat != null);
  const total = conPuntos.reduce((s, t) => s + t.length, 0);
  if (total < 2) return "";
  const ligeros = conPuntos.map(t => aligerar(t, Math.max(2, Math.round(o.maxPuntos * t.length / total))));
  const pr = proyectar(ligeros, o.ancho, o.alto, o.margen);
  const lineas = pr.filter(t => t.length > 1).map(t => `<polyline points="${t.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}"/>`).join("");
  const ini = pr[0][0], ul = pr[pr.length - 1], fin = ul[ul.length - 1];
  const punto = (p, c) => `<circle class="${c}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5"/>`;
  return `<svg class="${o.clase}" viewBox="0 0 ${o.ancho} ${o.alto}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Recorrido"><g class="run-ruta-linea">${lineas}</g>${o.marcas ? punto(ini, "run-ruta-ini") + punto(fin, "run-ruta-fin") : ""}</svg>`;
}

// ---- Exportar a GPX 1.1 (con FC y cadencia como extensión estándar de Garmin) ----
const xml = s => String(s == null ? "" : s).replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
function gpx(doc, tramos) {
  const tipo = doc.deporte === "bicicleta" ? "cycling" : "running";
  const pt = p => {
    const ext = (p.fc != null || p.cad != null)
      ? `<extensions><gpxtpx:TrackPointExtension>${p.fc != null ? `<gpxtpx:hr>${Math.round(p.fc)}</gpxtpx:hr>` : ""}${p.cad != null ? `<gpxtpx:cad>${Math.round(p.cad)}</gpxtpx:cad>` : ""}</gpxtpx:TrackPointExtension></extensions>` : "";
    return `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${p.alt != null ? `<ele>${p.alt}</ele>` : ""}<time>${new Date(p.t).toISOString()}</time>${ext}</trkpt>`;
  };
  const segs = (tramos || []).map(t => t.filter(p => p.lat != null)).filter(t => t.length);
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Manolo" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<metadata><name>${xml(doc.titulo || "Actividad")}</name>${doc.inicio ? `<time>${new Date(doc.inicio).toISOString()}</time>` : ""}</metadata>
<trk><name>${xml(doc.titulo || "Actividad")}</name>${doc.notes ? `<desc>${xml(doc.notes)}</desc>` : ""}<type>${tipo}</type>
${segs.map(t => `<trkseg>\n${t.map(pt).join("\n")}\n</trkseg>`).join("\n")}
</trk>
</gpx>
`;
}
function nombreArchivo(doc) {
  const base = String(doc.titulo || "actividad").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "actividad";
  return `${doc.date || "manolo"}-${base}.gpx`;
}

return { numero, km, tiempo, duracion, ritmo, ritmoDe, velocidad, metros, fechaActividad, basicos, proyectar, aligerar, svgRuta, gpx, nombreArchivo, MESES, MESES_LARGOS, DIAS };
});
