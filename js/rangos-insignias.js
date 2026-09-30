// ---------- Rangos: insignias (SVG propio de Manolo) ----------
// La forma gana detalle de Hierro a Campeón: escudo simple → escudo con
// borde → con muesca → con alas → gema hexagonal → gema octogonal →
// diamante tallado → escudo con laureles y estrella. Simétrico es una
// estrella iridiscente con laureles. La división (I, II, III) va al centro
// con trazo oscuro para leerse a 24 px y a 96 px, sobre fondo claro u oscuro.
(function () {

let serie = 0;

function mezclar(hex, con, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(con.slice(1), 16);
  const c = [16, 8, 0].map(sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}

const ESCUDO = "M32 5 L53 12.5 V30 C53 43.5 44 52.5 32 59 C20 52.5 11 43.5 11 30 V12.5 Z";
const ESCUDO_IN = "M32 11 L47.5 16.6 V30.2 C47.5 40.3 41 47.4 32 52.4 C23 47.4 16.5 40.3 16.5 30.2 V16.6 Z";
const HEX = "M32 4 L55 17 V47 L32 60 L9 47 V17 Z";
const HEX_IN = "M32 13 L47 21.5 V42.5 L32 51 L17 42.5 V21.5 Z";
const OCT = "M22 5 H42 L57 20 V44 L42 59 H22 L7 44 V20 Z";
const OCT_IN = "M25.5 13 H38.5 L49 23.5 V40.5 L38.5 51 H25.5 L15 40.5 V23.5 Z";
const DIAM = "M12 23 L21 9 H43 L52 23 L32 59 Z";
const ESTRELLA = (() => {
  const p = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 17 : 27, a = (Math.PI / 8) * i - Math.PI / 2;
    p.push((32 + r * Math.cos(a)).toFixed(1) + " " + (33 + r * Math.sin(a)).toFixed(1));
  }
  return "M" + p.join(" L") + " Z";
})();

// Hojas de laurel a un lado (se reflejan para el otro).
function laurel(color) {
  const hojas = [[13, 44, -35], [9.5, 36, -15], [8.5, 27, 5], [10, 18.5, 25]].map(([x, y, r]) =>
    `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="5.2" transform="rotate(${r} ${x} ${y})" fill="${color}"/>`).join("");
  return `<g>${hojas}</g><g transform="matrix(-1 0 0 1 64 0)">${hojas}</g>`;
}

function numeral(texto, tam) {
  if (!texto) return "";
  const fs = texto.length === 3 ? 15 : texto.length === 2 ? 17 : 19;
  return `<text x="32" y="${38.5 + (tam < 32 ? 1 : 0)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="800" font-size="${fs}" fill="#fff" stroke="#15120e" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke">${texto}</text>`;
}

// nivel: { rangoIdx, division, rango: { color, nombre, iridiscente } } o null (sin rango)
function svg(nivel, opciones) {
  const o = Object.assign({ tam: 40, etiqueta: true }, opciones);
  const id = "ins" + (++serie);
  const tam = o.tam;
  const titulo = nivel ? nivel.nombre : "Sin rango";
  const abre = `<svg class="insignia" width="${tam}" height="${tam}" viewBox="0 0 64 64" role="img" aria-label="${o.etiqueta ? titulo : ""}"${o.etiqueta ? "" : ' aria-hidden="true"'}>`;

  if (!nivel) {
    return abre + `<path d="${ESCUDO}" fill="rgba(128,128,128,0.12)" stroke="#8a8780" stroke-width="2.5" stroke-dasharray="5 4" stroke-linejoin="round"/>` +
      `<text x="32" y="39" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="18" fill="#8a8780">–</text></svg>`;
  }

  const r = nivel.rango, ri = nivel.rangoIdx;
  const base = r.color;
  const claro = mezclar(base, "#ffffff", 0.45), oscuro = mezclar(base, "#000000", 0.5), borde = mezclar(base, "#000000", 0.62);
  const romano = nivel.division ? ["I", "II", "III"][nivel.division - 1] : "";
  let defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${claro}"/><stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient>`;
  let relleno = `url(#${id}g)`;
  const brillo = `<path d="M18 16 L32 11 L32 30 C26 30 20 27 18 23 Z" fill="#fff" opacity="0.22"/>`;
  let cuerpo = "";

  if (ri <= 3) {
    // Hierro, Bronce, Plata, Oro: escudo que gana detalles
    if (ri === 3) {
      const ala = `<path d="M11 18 C4 20 2 28 3 36 C6 32 9 30 12 29 C8 35 7 40 8 45 C11 40 13 37 15 35 Z" fill="${relleno}" stroke="${borde}" stroke-width="1.6" stroke-linejoin="round"/>`;
      cuerpo += ala + `<g transform="matrix(-1 0 0 1 64 0)">${ala}</g>`;
    }
    cuerpo += `<path d="${ESCUDO}" fill="${relleno}" stroke="${borde}" stroke-width="2.2" stroke-linejoin="round"/>`;
    if (ri >= 1) cuerpo += `<path d="${ESCUDO_IN}" fill="none" stroke="${claro}" stroke-width="1.6" opacity="0.9" stroke-linejoin="round"/>`;
    if (ri >= 2) cuerpo += `<path d="M22 14.6 L32 23 L42 14.6" fill="none" stroke="${borde}" stroke-width="2" stroke-linejoin="round" opacity="0.7"/>`;
    cuerpo += brillo;
  } else if (ri === 4) {
    // Rubí: gema hexagonal tallada
    cuerpo += `<path d="${HEX}" fill="${relleno}" stroke="${borde}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="${HEX_IN}" fill="${claro}" opacity="0.18"/>` +
      `<path d="${HEX_IN}" fill="none" stroke="${claro}" stroke-width="1.3" opacity="0.8"/>` +
      `<path d="M32 4 V13 M55 17 L47 21.5 M55 47 L47 42.5 M32 60 V51 M9 47 L17 42.5 M9 17 L17 21.5" stroke="${borde}" stroke-width="1.3" opacity="0.6"/>` +
      `<path d="M32 4 L55 17 L47 21.5 L32 13 Z" fill="#fff" opacity="0.2"/>`;
  } else if (ri === 5) {
    // Esmeralda: gema octogonal con facetas y coronita
    cuerpo += `<path d="${OCT}" fill="${relleno}" stroke="${borde}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="${OCT_IN}" fill="${claro}" opacity="0.16"/>` +
      `<path d="${OCT_IN}" fill="none" stroke="${claro}" stroke-width="1.3" opacity="0.85"/>` +
      `<path d="M22 5 L25.5 13 M42 5 L38.5 13 M57 20 L49 23.5 M57 44 L49 40.5 M42 59 L38.5 51 M22 59 L25.5 51 M7 44 L15 40.5 M7 20 L15 23.5" stroke="${borde}" stroke-width="1.2" opacity="0.6"/>` +
      `<path d="M22 5 H42 L38.5 13 H25.5 Z" fill="#fff" opacity="0.25"/>` +
      `<circle cx="32" cy="2.8" r="2" fill="${claro}" stroke="${borde}" stroke-width="1"/>`;
  } else if (ri === 6) {
    // Diamante: talla brillante con destello
    cuerpo += `<path d="${DIAM}" fill="${relleno}" stroke="${borde}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="M12 23 H52 M21 9 L26 23 L32 9 L38 23 L43 9 M26 23 L32 59 L38 23" fill="none" stroke="${borde}" stroke-width="1.2" opacity="0.55"/>` +
      `<path d="M21 9 H43 L38 23 H26 Z" fill="#fff" opacity="0.28"/>` +
      `<path d="M52 5 L53.3 8.7 L57 10 L53.3 11.3 L52 15 L50.7 11.3 L47 10 L50.7 8.7 Z" fill="#fff" stroke="${borde}" stroke-width="0.8"/>`;
  } else if (ri === 7) {
    // Campeón: escudo con laureles, corona y estrella
    cuerpo += laurel(claro) +
      `<path d="${ESCUDO_IN}" transform="translate(-4.3 -3.2) scale(1.135)" fill="${relleno}" stroke="${borde}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M22 11 L25 4 L29 9 L32 2.5 L35 9 L39 4 L42 11 Z" fill="#f5c542" stroke="#6b4e0c" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M20 20 L32 16 L32 32 C26 31 21 28 20 24 Z" fill="#fff" opacity="0.2"/>`;
  } else {
    // Simétrico: estrella iridiscente con laureles y halo
    defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">` +
      r.iridiscente.map((c, i) => `<stop offset="${i / (r.iridiscente.length - 1)}" stop-color="${c}"/>`).join("") + `</linearGradient>` +
      `<radialGradient id="${id}h" cx="0.5" cy="0.5" r="0.5"><stop offset="0.55" stop-color="${r.iridiscente[1]}" stop-opacity="0.45"/><stop offset="1" stop-color="${r.iridiscente[1]}" stop-opacity="0"/></radialGradient>`;
    relleno = `url(#${id}g)`;
    cuerpo += `<circle cx="32" cy="33" r="31" fill="url(#${id}h)"/>` + laurel("#34D399") +
      `<path d="${ESTRELLA}" fill="${relleno}" stroke="#2a1440" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<circle cx="32" cy="33" r="11" fill="#fff" opacity="0.18"/>` +
      `<path d="M32 22 L34.6 30.4 L43 33 L34.6 35.6 L32 44 L29.4 35.6 L21 33 L29.4 30.4 Z" fill="#fff" stroke="#2a1440" stroke-width="1.4" stroke-linejoin="round"/>`;
  }

  return abre + `<defs>${defs}</defs>` + cuerpo + numeral(romano, tam) + `</svg>`;
}

window.RangosInsignias = { svg, mezclar };
})();
