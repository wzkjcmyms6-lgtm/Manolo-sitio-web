// ---------- Running: imagen para compartir (fase 7, D-076) ----------
// Una imagen vertical tipo historia (1080 × 1920) con la ruta y
// Distancia · Ritmo · Tiempo, con fondo oscuro o transparente (para ponerla
// encima de una foto). `plan()` arma el dibujo sin pantalla (se prueba en
// tests/run-compartir.test.js); `dibujar()` lo pinta en un canvas y
// `compartir()` usa el menú de compartir del teléfono o, si no existe,
// descarga el PNG. No sale nada de Manolo hasta que el dueño elige dónde.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-vista.js"));
  else root.RunCompartir = factory(root.RunVista);
})(typeof self !== "undefined" ? self : this, function (V) {
"use strict";

const ANCHO = 1080, ALTO = 1920;
const COLOR = { tinta: "#f5f4f1", suave: "rgba(245,244,241,0.62)", acento1: "#ff7a30", acento2: "#ffb84d", inicio: "#4cc38a", fin: "#e2593f" };

// opciones: { fondo: "oscuro" | "transparente" }
// → { ancho, alto, fondo, ruta: [[x, y]] por tramo, inicio, fin, textos: [{ t, x, y, tam, peso, color, alinear }] }
function plan(doc, tramos, opciones) {
  const o = Object.assign({ fondo: "oscuro" }, opciones || {});
  const b = V.basicos(doc);
  const bici = doc.deporte === "bicicleta";
  const conGps = (tramos || []).map(t => (t || []).filter(p => p && p.lat != null)).filter(t => t.length > 1);
  const out = { ancho: ANCHO, alto: ALTO, fondo: o.fondo, ruta: [], inicio: null, fin: null, textos: [] };
  // Zona de la ruta: arriba, con margen; sin ruta, las cifras suben.
  const caja = { x: 120, y: 260, w: ANCHO - 240, h: 980 };
  if (conGps.length) {
    const ligeros = conGps.map(t => V.aligerar(t, Math.max(2, Math.round(1500 * t.length / conGps.reduce((s, x) => s + x.length, 0)))));
    const pr = V.proyectar(ligeros, caja.w, caja.h, 20);
    out.ruta = pr.map(t => t.map(p => [Math.round((caja.x + p[0]) * 10) / 10, Math.round((caja.y + p[1]) * 10) / 10]));
    out.inicio = out.ruta[0][0];
    const ul = out.ruta[out.ruta.length - 1];
    out.fin = ul[ul.length - 1];
  }
  const yCifras = conGps.length ? 1330 : 760;
  const cifras = [
    ["Distancia", b.distM > 0 ? V.km(b.distM) : "—"],
    bici ? ["Velocidad", V.velocidad(b.movS, b.distM)] : ["Ritmo", V.ritmo(b.ritmoS)],
    ["Tiempo", V.tiempo(b.movS)]
  ];
  cifras.forEach(([et, val], i) => {
    const y = yCifras + i * 160;
    out.textos.push({ t: et.toUpperCase(), x: ANCHO / 2, y, tam: 34, peso: 600, color: COLOR.suave, alinear: "center", espaciado: 6 });
    out.textos.push({ t: val, x: ANCHO / 2, y: y + 96, tam: 92, peso: 700, color: COLOR.tinta, alinear: "center" });
  });
  const titulo = String(doc.titulo || "").slice(0, 40);
  if (titulo) out.textos.push({ t: titulo, x: ANCHO / 2, y: 150, tam: 52, peso: 700, color: COLOR.tinta, alinear: "center" });
  out.textos.push({ t: V.fechaActividad(doc, false) + (doc.lugar ? ` · ${doc.lugar}` : ""), x: ANCHO / 2, y: titulo ? 214 : 170, tam: 34, peso: 500, color: COLOR.suave, alinear: "center" });
  out.textos.push({ t: "Manolo", x: ANCHO / 2, y: ALTO - 60, tam: 40, peso: 700, color: COLOR.acento2, alinear: "center" });
  return out;
}

// ---- Pantalla (solo en el navegador) ----
function dibujar(canvas, p) {
  canvas.width = p.ancho;
  canvas.height = p.alto;
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, p.ancho, p.alto);
  if (p.fondo !== "transparente") {
    const g = c.createLinearGradient(0, 0, 0, p.alto);
    g.addColorStop(0, "#161310");
    g.addColorStop(1, "#0a0a0a");
    c.fillStyle = g;
    c.fillRect(0, 0, p.ancho, p.alto);
  }
  if (p.ruta.length) {
    const g = c.createLinearGradient(0, 260, 0, 1240);
    g.addColorStop(0, COLOR.acento2);
    g.addColorStop(1, COLOR.acento1);
    c.lineJoin = "round"; c.lineCap = "round";
    // Sombra suave para que se lea sobre una foto (fondo transparente).
    c.shadowColor = "rgba(0,0,0,0.45)"; c.shadowBlur = p.fondo === "transparente" ? 18 : 0;
    c.strokeStyle = g; c.lineWidth = 14;
    p.ruta.forEach(t => { c.beginPath(); t.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); });
    c.shadowBlur = 0;
    [[p.inicio, COLOR.inicio], [p.fin, COLOR.fin]].forEach(([q, col]) => {
      if (!q) return;
      c.beginPath(); c.arc(q[0], q[1], 20, 0, 2 * Math.PI); c.fillStyle = col; c.fill();
      c.lineWidth = 6; c.strokeStyle = "#0a0a0a"; c.stroke();
    });
  }
  p.textos.forEach(x => {
    c.font = `${x.peso} ${x.tam}px "DM Sans", system-ui, sans-serif`;
    c.fillStyle = x.color;
    c.textAlign = x.alinear || "left";
    c.textBaseline = "alphabetic";
    if (p.fondo === "transparente") { c.shadowColor = "rgba(0,0,0,0.55)"; c.shadowBlur = 12; }
    if (x.espaciado && "letterSpacing" in c) c.letterSpacing = `${x.espaciado}px`;
    c.fillText(x.t, x.x, x.y);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    c.shadowBlur = 0;
  });
  return canvas;
}
function aBlob(canvas) {
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("imagen"))), "image/png"));
}
// Menú de compartir del teléfono con el PNG; si no se puede, lo descarga.
async function compartir(blob, nombre) {
  const archivo = typeof File === "function" ? new File([blob], nombre, { type: "image/png" }) : null;
  if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] }) && navigator.share) {
    try { await navigator.share({ files: [archivo] }); return "compartido"; } catch (e) { if (e && e.name === "AbortError") return "cancelado"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return "descargado";
}
function nombre(doc) { return V.nombreArchivo(doc).replace(/\.gpx$/, ".png"); }

return { plan, dibujar, aBlob, compartir, nombre, ANCHO, ALTO };
});
