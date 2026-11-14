// ---------- Biblia: imagen para compartir un versículo ----------
// 1080 × 1350 (formato de post/historia), estilo Manolo: fondo oscuro con el
// brillo naranja, el versículo en Fraunces y la cita en DM Sans (D-105).
// plan() decide el tamaño de letra y corta las líneas (sin DOM: recibe una
// función que mide el texto; tests/biblia-marcas.test.js); dibujar() pinta
// el plan en el contexto 2D de un canvas.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BibliaImagen = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const W = 1080, H = 1350, M = 96;
const SERIF = '"Fraunces", "DM Sans", Georgia, serif';
const SANS = '"DM Sans", system-ui, sans-serif';
const ARRIBA = 250;        // donde empieza el texto
const ABAJO = H - 300;     // donde termina (abajo van la cita y el pie)
const TAMS = [72, 66, 60, 54, 50, 46, 42, 38, 34, 31, 28];

// Corta un texto en líneas que no pasan de `ancho` con la letra `tam`.
function lineas(texto, tam, ancho, medir) {
  const palabras = String(texto || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const out = [];
  let linea = "";
  palabras.forEach(p => {
    const prueba = linea ? `${linea} ${p}` : p;
    if (linea && medir(prueba, tam) > ancho) { out.push(linea); linea = p; }
    else linea = prueba;
  });
  if (linea) out.push(linea);
  return out;
}

// texto (ya con la ortografía elegida), cita ("Juan 3:16"), medir(texto, tamPx) → ancho.
// → { W, H, tam, alto (interlineado), lineas, y0 (primera línea), cita, recortado }
function plan(texto, cita, medir) {
  const t = `«${String(texto || "").replace(/\s+/g, " ").trim()}»`;
  const ancho = W - 2 * M;
  for (const tam of TAMS) {
    const alto = Math.round(tam * 1.42);
    const ls = lineas(t, tam, ancho, medir);
    if (ls.length * alto <= ABAJO - ARRIBA) {
      // Centrado en el espacio del texto.
      const y0 = Math.round(ARRIBA + (ABAJO - ARRIBA - ls.length * alto) / 2 + tam);
      return { W, H, M, tam, alto, lineas: ls, y0, cita: String(cita || ""), recortado: false };
    }
  }
  // Muy largo: la letra más chica y se corta con "…".
  const tam = TAMS[TAMS.length - 1], alto = Math.round(tam * 1.42);
  const max = Math.floor((ABAJO - ARRIBA) / alto);
  const ls = lineas(t, tam, ancho, medir).slice(0, max);
  ls[ls.length - 1] = ls[ls.length - 1].replace(/[\s,;:.»]*$/, "") + "…»";
  return { W, H, M, tam, alto, lineas: ls, y0: ARRIBA + tam, cita: String(cita || ""), recortado: true };
}

// Pinta el plan en un contexto 2D (canvas de W × H).
function dibujar(g, p) {
  g.fillStyle = "#0a0a0a";
  g.fillRect(0, 0, p.W, p.H);
  const brillo = g.createRadialGradient(p.W * 0.82, 0, 40, p.W * 0.82, 0, 980);
  brillo.addColorStop(0, "rgba(255, 122, 48, 0.38)");
  brillo.addColorStop(1, "rgba(255, 122, 48, 0)");
  g.fillStyle = brillo;
  g.fillRect(0, 0, p.W, p.H);
  const abajo = g.createRadialGradient(0, p.H, 40, 0, p.H, 760);
  abajo.addColorStop(0, "rgba(255, 184, 77, 0.12)");
  abajo.addColorStop(1, "rgba(255, 184, 77, 0)");
  g.fillStyle = abajo;
  g.fillRect(0, 0, p.W, p.H);
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  // Arriba: la palabra "BIBLIA" y una raya naranja.
  g.fillStyle = "#ffb84d";
  g.font = `700 30px ${SANS}`;
  g.fillText("BIBLIA", p.M, 150);
  const raya = g.createLinearGradient(p.M, 0, p.M + 120, 0);
  raya.addColorStop(0, "#ff7a30");
  raya.addColorStop(1, "#ffb84d");
  g.fillStyle = raya;
  g.fillRect(p.M, 176, 120, 6);
  // El versículo.
  g.fillStyle = "#f5f4f1";
  g.font = `500 ${p.tam}px ${SERIF}`;
  p.lineas.forEach((l, i) => g.fillText(l, p.M, p.y0 + i * p.alto));
  // La cita y el pie.
  g.fillStyle = "#ffb84d";
  g.font = `700 46px ${SANS}`;
  g.fillText(p.cita, p.M, p.H - 190);
  g.fillStyle = "#9a978f";
  g.font = `500 28px ${SANS}`;
  g.fillText("Reina-Valera 1909 · Manolo", p.M, p.H - 130);
  return g;
}

return { W, H, plan, lineas, dibujar };
});
