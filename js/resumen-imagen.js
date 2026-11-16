// ---------- Resúmenes: imágenes para compartir (D-136) ----------
// Una imagen vertical tipo historia (1080 × 1920) de "Tu semana" (y, en la
// fase 4, de cada diapositiva de "Tu año"). `planSemana()` arma el dibujo
// sin pantalla (tests/resumen-imagen.test.js); `dibujar()` lo pinta en un
// canvas. Para compartir se usa el menú del teléfono (RunCompartir.compartir).
// **Sin montos de dinero**: Finanzas y lo que habla de gastos no entra.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResumenImagen = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const ANCHO = 1080, ALTO = 1920, MARGEN = 96;
const COLOR = { tinta: "#f5f4f1", suave: "rgba(245,244,241,0.66)", acento1: "#ff7a30", acento2: "#ffb84d", bueno: "#7fe0a6", fondo1: "#1d1611", fondo2: "#0a0a0a" };
// Lo que no se comparte: dinero.
const ES_DINERO = t => /\bBs\b|gast|ingres|ahorr/i.test(String(t || ""));

// Corta un texto en líneas que entren en `ancho` (medir: texto, tam, peso → px).
function lineas(texto, tam, peso, ancho, medir) {
  const palabras = String(texto || "").split(/\s+/).filter(Boolean);
  const out = [];
  let linea = "";
  palabras.forEach(p => {
    const prueba = linea ? `${linea} ${p}` : p;
    if (!linea || medir(prueba, tam, peso) <= ancho) linea = prueba;
    else { out.push(linea); linea = p; }
  });
  if (linea) out.push(linea);
  return out;
}
// Medida aproximada (sin canvas): para las pruebas y como respaldo.
const medirAprox = (t, tam) => String(t).length * tam * 0.52;

// s: resultado de ResumenMotor.semana(). → { ancho, alto, textos: [{ t, x, y, tam, peso, color, alinear, espaciado }], rayas: [{ x, y, w, h, color }] }
function planSemana(s, medir) {
  const m = medir || medirAprox;
  const textos = [], rayas = [];
  const util = ANCHO - 2 * MARGEN;
  let y = 210;
  const poner = (t, tam, peso, color, extra) => { textos.push(Object.assign({ t, x: MARGEN, y, tam, peso, color }, extra || {})); };
  poner("MI SEMANA", 40, 800, COLOR.acento2, { espaciado: 6 });
  y += 96;
  poner(s.rango, 84, 800, COLOR.tinta);
  y += 40;
  rayas.push({ x: MARGEN, y, w: 160, h: 10, color: COLOR.acento1 });
  y += 100;
  lineas(s.titular, 50, 600, util, m).slice(0, 4).forEach(l => { poner(l, 50, 600, COLOR.tinta); y += 66; });
  // Lo mejor (sin dinero).
  const mejor = (s.mejor || []).filter(x => !ES_DINERO(x.texto)).slice(0, 4);
  if (mejor.length) {
    y += 50;
    poner("LO MEJOR", 34, 800, COLOR.acento2, { espaciado: 4 });
    y += 66;
    mejor.forEach(x => {
      const ls = lineas(`${x.icono} ${x.texto}`, 42, 600, util, m).slice(0, 2);
      ls.forEach(l => { poner(l, 42, 600, COLOR.tinta); y += 56; });
      y += 14;
    });
  }
  // Por área (sin Finanzas).
  const areas = (s.areas || []).filter(a => a.id !== "finanzas" && a.linea && !/^Sin /.test(a.linea)).slice(0, 7);
  if (areas.length && y < ALTO - 360) {
    y += 40;
    poner("POR ÁREA", 34, 800, COLOR.acento2, { espaciado: 4 });
    y += 64;
    for (const a of areas) {
      if (y > ALTO - 240) break;
      poner(a.nombre, 32, 600, COLOR.suave);
      y += 48;
      const l = lineas(a.linea, 40, 700, util, m)[0];
      poner(l, 40, 700, COLOR.tinta);
      // Solo lo que mejoró (es para compartir).
      if (a.cambio && a.cambio.signo > 0 && !ES_DINERO(a.cambio.texto)) {
        const ancho = m(l, 40, 700);
        if (ancho + 40 + m(a.cambio.texto, 30, 700) <= util) textos.push({ t: a.cambio.texto, x: MARGEN + ancho + 28, y, tam: 30, peso: 700, color: a.cambio.signo > 0 ? COLOR.bueno : COLOR.acento2 });
      }
      y += 70;
    }
  }
  textos.push({ t: "Manolo", x: ANCHO / 2, y: ALTO - 110, tam: 36, peso: 800, color: COLOR.suave, alinear: "center", espaciado: 2 });
  return { ancho: ANCHO, alto: ALTO, textos, rayas };
}

function dibujar(canvas, p) {
  canvas.width = p.ancho;
  canvas.height = p.alto;
  const c = canvas.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, p.alto);
  g.addColorStop(0, COLOR.fondo1);
  g.addColorStop(1, COLOR.fondo2);
  c.fillStyle = g;
  c.fillRect(0, 0, p.ancho, p.alto);
  // Un brillo naranja arriba, como el resto de la app.
  const r = c.createRadialGradient(p.ancho * 0.85, 0, 0, p.ancho * 0.85, 0, p.ancho * 0.9);
  r.addColorStop(0, "rgba(255,122,48,0.28)");
  r.addColorStop(1, "rgba(255,122,48,0)");
  c.fillStyle = r;
  c.fillRect(0, 0, p.ancho, p.alto);
  (p.rayas || []).forEach(x => { c.fillStyle = x.color; c.beginPath(); if (c.roundRect) c.roundRect(x.x, x.y, x.w, x.h, x.h / 2); else c.rect(x.x, x.y, x.w, x.h); c.fill(); });
  p.textos.forEach(x => {
    c.font = `${x.peso} ${x.tam}px "DM Sans", system-ui, sans-serif`;
    c.fillStyle = x.color;
    c.textAlign = x.alinear || "left";
    c.textBaseline = "alphabetic";
    if (x.espaciado && "letterSpacing" in c) c.letterSpacing = `${x.espaciado}px`;
    c.fillText(x.t, x.x, x.y);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
  });
  return canvas;
}
// La medida real de un canvas (para cortar las líneas igual que se dibujan).
function medidor(canvas) {
  const c = canvas.getContext("2d");
  return (t, tam, peso) => { c.font = `${peso || 400} ${tam}px "DM Sans", system-ui, sans-serif`; return c.measureText(t).width; };
}

return { ANCHO, ALTO, ES_DINERO, lineas, medirAprox, planSemana, dibujar, medidor };
});
