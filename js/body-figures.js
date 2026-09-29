// ---------- Figuras del mapa corporal (arte propio de Manolo) ----------
// Maniquí marfil de frente y de espalda, evolución del original. Cada
// región muscular se dibuja una vez para el lado izquierdo (x ≤ 70) y el
// mapa la refleja para el derecho. viewBox 0 0 140 300; eje en x = 70.
//   m: id de músculo (js/muscle-engine.js) · base: pieza sin músculo
//   seam: línea decorativa · hi/sh: brillo/sombra suaves
// Las piezas "centro" se dibujan una sola vez (no se reflejan).
(function (root) {

const CABEZA = [
  { centro: true, base: true, el: "ellipse", a: { cx: 70, cy: 20, rx: 12.5, ry: 15 } },
  { centro: true, base: true, d: "M63.5,32 C64,37 64,41 62.5,45 L77.5,45 C76,41 76,37 76.5,32 Z" }
];

const BRAZO_BASE = [
  { base: true, el: "ellipse", a: { cx: 22.5, cy: 102.5, rx: 6.2, ry: 4.6 } },       // codo
  { base: true, d: "M17.5,139 C15.5,145 16,152 19.5,156 C22.5,158 26,156 27,151 C28,146 27.5,142 26.5,139 Z" } // mano
];

const PIERNA_BASE = [
  { base: true, el: "ellipse", a: { cx: 56, cy: 213.5, rx: 7.2, ry: 5.2 } },          // rodilla
  { base: true, d: "M51,286.5 L60.5,286.5 C62.5,289 65,291 65,294 L48.5,294 C48.5,291 50,289 51,286.5 Z" } // pie
];

const FRENTE = [
  ...CABEZA,
  // Trapecio (se asoma entre cuello y hombro)
  { m: "trapecio", d: "M63.5,36 C60,42 53,45 45,46.5 L50,50.5 C56,49.5 61.5,47.5 63.5,45 Z" },
  // Deltoides: lateral (borde exterior) y anterior (frente)
  { m: "deltoide_lateral", d: "M34,45.5 C26.5,46 21.5,51 20,57.5 C18.8,63.5 20,69 23.5,73.5 L27,72.5 C25.8,64 27.8,54.5 34,45.5 Z" },
  { m: "deltoide_anterior", d: "M34,45.5 C38.5,45.2 42.5,45.8 45,46.5 L46,54.5 C40,58 34,64.5 30.5,72 L27,72.5 C25.8,64 27.8,54.5 34,45.5 Z" },
  // Pecho en tres franjas
  { m: "pecho_superior", d: "M69,50 C61,48.8 52,49 46,51.2 L45.4,58.8 C52.5,57 61,56.8 69,58 Z" },
  { m: "pecho_medio", d: "M69,58 C61,56.8 52.5,57 45.4,58.8 C45.2,62 45.4,65.2 46,68 C53,66.6 61,66.6 69,67.6 Z" },
  { m: "pecho_inferior", d: "M69,67.6 C61,66.6 53,66.6 46,68 C46.6,70.5 47.6,72.4 49,73.8 C54.5,78.2 62,78.8 69,76.4 Z" },
  { hi: true, el: "ellipse", a: { cx: 55, cy: 56, rx: 8, ry: 5 } },
  // Brazo
  { m: "biceps", d: "M23.5,74 C18.5,79.5 16,88.5 16.8,98.5 L28.6,99.8 C31,91.5 32.2,82.5 30.5,73 C28,72.2 25.5,72.6 23.5,74 Z" },
  { hi: true, el: "ellipse", a: { cx: 21.5, cy: 84, rx: 3.4, ry: 8 } },
  { m: "antebrazos", d: "M16.6,106 L28.6,106 C30.4,115.5 29,126.5 26.8,138 L18.2,138 C15.6,126.5 14.6,115.5 16.6,106 Z" },
  ...BRAZO_BASE,
  // Tronco: oblicuos a los costados, abdominales al centro
  { m: "oblicuos", d: "M49.5,75.5 C53,78.6 56,80 58.4,80.4 L58.4,127.6 C54.5,127 51,124.8 49,121.5 C47.2,106.5 47.4,90.5 49.5,75.5 Z" },
  { m: "abdominales", d: "M59.6,80.6 L69,80.6 L69,131.5 C65.2,131.8 62,130.8 59.6,128.4 Z" },
  { seam: true, d: "M60.4,93 L68.4,92.4" },
  { seam: true, d: "M60.4,105 L68.4,104.6" },
  { seam: true, d: "M60.4,117 L68.4,116.8" },
  { base: true, d: "M49,121.5 C51.6,125 54.8,127 58.4,127.6 C61.4,130.6 65,132 69,132.4 L69,141.4 C66.6,141 64.2,140 62,138.6 C58.6,134 55,129.6 51.4,126 Z" },
  // Pierna: abductor (cadera externa), cuádriceps, aductor (cara interna), pantorrilla
  { m: "cuadriceps", d: "M51.4,126 C55.6,130.5 59.6,134.6 62,138.6 C63,154 64.4,166 66.8,174 C65.6,186 63.8,198 62.4,208.5 L49.8,208.5 C46,194 44.2,174 44.6,152.5 C45,142.5 47.6,133 51.4,126 Z" },
  { m: "aductores", d: "M69,142.2 C69.4,152 68.6,163 66.8,174 C64.6,166 63.2,154 62.4,139.6 C64.6,140.8 66.8,141.8 69,142.2 Z" },
  { m: "abductores", d: "M51.4,126 C47.6,133 45,142.5 44.6,152.5 L47.6,150 C47.8,141.5 49.6,133.4 53,128 Z" },
  { seam: true, d: "M56.4,142 C55.4,160 55.2,182 56.6,204" },
  { hi: true, el: "ellipse", a: { cx: 50.5, cy: 165, rx: 3.6, ry: 14 } },
  { m: "pantorrillas", d: "M49.6,219.5 C47.2,233 47.4,247 50.2,261 C51.4,270 51.6,279 52,285.5 L59.8,285.5 C60.4,278 61,270 62,261.5 C64.4,247.5 64.6,233.5 62.4,219.5 Z" },
  { seam: true, d: "M57.2,224 C55.6,240 55.6,256 57,272" },
  ...PIERNA_BASE
];

const ESPALDA = [
  ...CABEZA,
  // Trapecio: superior y rombo central hasta media espalda
  { m: "trapecio", d: "M70,31.5 L64.6,32.4 C63,40.5 55.5,44.8 45,47 C51.6,50.8 57.8,55.2 60.6,60.2 C62.6,70.2 65.6,80.2 70,90.4 Z" },
  // Deltoides: lateral (borde exterior) y posterior (atrás)
  { m: "deltoide_lateral", d: "M34,45.5 C26.5,46 21.5,51 20,57.5 C18.8,63.5 20,69 23.5,73.5 L27,72.5 C25.8,64 27.8,54.5 34,45.5 Z" },
  { m: "deltoide_posterior", d: "M34,45.5 C38.5,45.2 42.5,45.8 45,47 L45.6,55.8 C40,58.8 34,64.8 30.5,72 L27,72.5 C25.8,64 27.8,54.5 34,45.5 Z" },
  // Espalda media (romboides / redondo) entre trapecio y dorsal
  { m: "espalda_media", d: "M60.6,60.2 C57.8,55.2 51.6,50.8 45.8,49.4 L46,57.6 C49.8,63.6 53.2,71.4 56.4,79.6 C59.8,83.6 63.4,85.6 66.6,86 C64.2,78 62.2,69.6 60.6,60.2 Z" },
  // Dorsal ancho
  { m: "dorsales", d: "M46,57.6 C44.4,68 44.6,80 47.8,91.2 C50.6,99.6 55.4,106.4 61.2,110.6 C63.4,104.8 65.4,97.4 66.6,86 C63.4,85.6 59.8,83.6 56.4,79.6 C53.2,71.4 49.8,63.6 46,57.6 Z" },
  // Lumbares
  { m: "lumbares", d: "M70,90.8 L70,121.6 C65.8,122.4 61.8,121.4 58.6,119 C59.2,116 60.2,113.2 61.2,110.6 C63.4,104.8 65.4,97.4 66.6,86 C67.8,87.8 68.9,89.4 70,90.8 Z" },
  // Brazo
  { m: "triceps", d: "M23.5,74 C18.5,79.5 16,88.5 16.8,98.5 L28.6,99.8 C31,91.5 32.2,82.5 30.5,73 C28,72.2 25.5,72.6 23.5,74 Z" },
  { seam: true, d: "M23.4,80 C26.6,86 26.4,92 23.6,97.6" },
  { m: "antebrazos", d: "M16.6,106 L28.6,106 C30.4,115.5 29,126.5 26.8,138 L18.2,138 C15.6,126.5 14.6,115.5 16.6,106 Z" },
  ...BRAZO_BASE,
  // Costado: los oblicuos se ven también desde atrás
  { m: "oblicuos", d: "M47.8,91.2 C50.6,99.6 55.4,106.4 61.2,110.6 C60.2,113.2 59.2,116 58.6,119 C54.4,118.4 50.6,116.2 48.6,112.6 C47.4,105.6 47.2,98.4 47.8,91.2 Z" },
  // Glúteos y abductor (glúteo medio)
  { m: "abductores", d: "M48.6,120 C46,125 45,131 45.8,137.6 L50.6,131.2 C53,127.6 56,125 59.4,123.2 C55.6,121.6 52,120.8 48.6,120 Z" },
  { m: "gluteos", d: "M70,123.4 L70,150.2 C63.6,154.4 54.6,154.2 48.4,148.6 C45.8,142.8 45.2,139.6 45.8,137.6 L50.6,131.2 C53,127.6 56,125 59.4,123.2 C63,122.8 66.6,122.8 70,123.4 Z" },
  { hi: true, el: "ellipse", a: { cx: 55.5, cy: 136, rx: 6, ry: 6.5 } },
  // Pierna
  { m: "isquiotibiales", d: "M48.4,152 C54.4,156.4 60.8,156.8 65.2,154.6 C65.8,161 66.2,168 67.2,175.6 C66,188 64.4,198.4 62.4,208.5 L49.8,208.5 C46.2,192.6 45.4,172 48.4,152 Z" },
  { m: "aductores", d: "M69,151.6 C69.6,160 68.8,168 67.2,175.6 C66.2,168 65.8,161 65.2,154.6 C66.6,153.8 67.8,152.8 69,151.6 Z" },
  { seam: true, d: "M56.8,158 C56,176 56,192 57,206" },
  { m: "pantorrillas", d: "M49,219.5 C45.8,232.8 46.2,245.8 50.2,257.4 C51.8,267 52,277 52,285.5 L59.8,285.5 C60,276.4 60.8,267 62.4,257.6 C65.6,246 65.8,232.8 62.8,219.5 Z" },
  { seam: true, d: "M56,222 C55.2,236 55.4,248 56.4,258" },
  { hi: true, el: "ellipse", a: { cx: 51.5, cy: 236, rx: 3.4, ry: 11 } },
  ...PIERNA_BASE
];

// Dibuja una figura dentro de un <svg viewBox="0 0 140 300">. Cada región
// queda como <g class="mz" data-muscle data-lado> con una base marfil y una
// capa de tinte (el color lo decide el CSS según data-nivel / data-rol).
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
  return e;
}
function dibujar(svg, piezas) {
  svg.innerHTML = "";
  ["izq", "der"].forEach(lado => {
    const g = el("g", lado === "der" ? { transform: "matrix(-1 0 0 1 140 0)" } : {});
    piezas.forEach(p => {
      if (p.centro && lado === "der") return;
      const forma = extra => p.el ? el(p.el, Object.assign({}, p.a, extra)) : el("path", Object.assign({ d: p.d }, extra));
      if (p.m) {
        const gm = el("g", { class: "mz", "data-muscle": p.m, "data-lado": lado });
        gm.appendChild(forma({ class: "mz-base" }));
        gm.appendChild(forma({ class: "mz-tinte" }));
        g.appendChild(gm);
      } else if (p.base) g.appendChild(forma({ class: "mz-pieza" }));
      else if (p.seam) g.appendChild(forma({ class: "seam" }));
      else if (p.hi) g.appendChild(forma({ class: "hi" }));
    });
    svg.appendChild(g);
  });
}

root.BodyFigures = { frente: FRENTE, espalda: ESPALDA, ancho: 140, alto: 300, dibujar };
})(typeof self !== "undefined" ? self : this);
