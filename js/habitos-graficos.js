// ---------- Hábitos: gráficos en SVG propio (sin librerías) ----------
// Devuelven el HTML/SVG como texto; js/habitos.js los inserta y maneja los
// toques. Cada marca tocable lleva data-tip (texto del globo) y es más grande
// que lo que se ve. Especificaciones: barras de 24 px como máximo con la punta
// redondeada de 4 px, líneas de 2 px, puntos de 8 px con anillo del color del
// fondo, grilla de 1 px. El texto nunca va del color de la serie.
(function () {

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n1 = v => Math.round(v * 10) / 10;

// Columna con la punta redondeada (4 px) y la base recta.
function columna(x, y, w, h, clase) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `<path class="${clase}" d="M${n1(x)},${n1(y + h)} V${n1(y + r)} Q${n1(x)},${n1(y)} ${n1(x + r)},${n1(y)} H${n1(x + w - r)} Q${n1(x + w)},${n1(y)} ${n1(x + w)},${n1(y + r)} V${n1(y + h)} Z"/>`;
}

// ---- Mapa de calor estilo GitHub (semanas en columnas, lunes arriba) ----
// dias: [{ fecha, nivel: 0–4 | null (sin datos), tip }] desde un lunes.
function heatmap(dias, meses) {
  const C = 13, G = 3, top = 16, left = 18;
  const semanas = Math.ceil(dias.length / 7);
  const W = left + semanas * (C + G), H = top + 7 * (C + G);
  let out = `<svg class="hbg-heat" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Cumplimiento de los últimos 12 meses">`;
  ["L", "", "X", "", "V", "", "D"].forEach((l, i) => { if (l) out += `<text class="hbg-eje" x="0" y="${top + i * (C + G) + C - 2}">${l}</text>`; });
  meses.forEach(m => { out += `<text class="hbg-eje" x="${left + m.col * (C + G)}" y="10">${esc(m.texto)}</text>`; });
  dias.forEach((d, i) => {
    if (!d) return;
    const x = left + Math.floor(i / 7) * (C + G), y = top + (i % 7) * (C + G);
    out += `<rect class="hbg-celda n${d.nivel == null ? "x" : d.nivel}" x="${x}" y="${y}" width="${C}" height="${C}" rx="3" data-dia="${d.fecha}" data-tip="${esc(d.tip)}" tabindex="0" role="button" aria-label="${esc(d.tip)}"/>`;
  });
  return out + `</svg>`;
}

// ---- Columnas (0–1) con media opcional en línea ----
// items: [{ etiqueta, valor (0–1 o null), tip, marcar }]; linea: [valor|null]
function columnas(items, opciones) {
  const o = Object.assign({ alto: 150, linea: null, etiquetas: true, ejeY: [0, 0.5, 1], fmt: v => `${Math.round(v * 100)} %`, max: 1, meta: null }, opciones);
  const W = 320, H = o.alto, m = { l: 34, r: 8, t: 14, b: o.etiquetas ? 22 : 8 };
  const ancho = (W - m.l - m.r) / Math.max(1, items.length);
  const barra = Math.min(24, Math.max(3, ancho - 2));
  const Y = v => m.t + (H - m.t - m.b) * (1 - Math.min(o.max, Math.max(0, v)) / o.max);
  let out = `<svg class="hbg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo || "")}">`;
  o.ejeY.forEach(v => { out += `<line class="hbg-grid" x1="${m.l}" x2="${W - m.r}" y1="${n1(Y(v))}" y2="${n1(Y(v))}"/><text class="hbg-eje" x="${m.l - 6}" y="${n1(Y(v) + 3.5)}" text-anchor="end">${esc(o.fmt(v))}</text>`; });
  if (o.meta != null) out += `<line class="hbg-meta" x1="${m.l}" x2="${W - m.r}" y1="${n1(Y(o.meta))}" y2="${n1(Y(o.meta))}"/><text class="hbg-eje" x="${W - m.r}" y="${n1(Y(o.meta) - 4)}" text-anchor="end">meta</text>`;
  items.forEach((it, i) => {
    const cx = m.l + ancho * i + ancho / 2;
    if (it.valor != null) out += columna(cx - barra / 2, Y(it.valor), barra, Y(0) - Y(it.valor), "hbg-col" + (it.marcar ? " is-marca" : "") + (it.suave ? " is-suave" : ""));
    if (o.etiquetas && it.etiqueta) out += `<text class="hbg-eje" x="${n1(cx)}" y="${H - 6}" text-anchor="middle">${esc(it.etiqueta)}</text>`;
    if (it.valorTexto && it.valor != null) out += `<text class="hbg-val" x="${n1(cx)}" y="${n1(Y(it.valor) - 5)}" text-anchor="middle">${esc(it.valorTexto)}</text>`;
  });
  if (o.linea) {
    let d = "";
    o.linea.forEach((v, i) => { if (v == null) return; d += (d ? " L" : "M") + n1(m.l + ancho * i + ancho / 2) + " " + n1(Y(v)); });
    if (d) out += `<path class="hbg-linea hbg-linea-2" d="${d}"/>`;
  }
  // Zonas tocables: toda la banda de cada columna
  items.forEach((it, i) => {
    if (!it.tip) return;
    out += `<rect class="hbg-hit" x="${n1(m.l + ancho * i)}" y="0" width="${n1(ancho)}" height="${H}" data-tip="${esc(it.tip)}" tabindex="0" role="button" aria-label="${esc(it.tip)}"/>`;
  });
  return out + `</svg>`;
}

// ---- Barras horizontales (HTML): pocas filas con el valor en la punta ----
function barrasH(items) {
  return `<ul class="hbg-barras">${items.map(it => `<li data-tip="${esc(it.tip)}" tabindex="0">
    <span class="hbg-barras-et">${esc(it.etiqueta)}</span>
    <span class="hbg-barras-pista"><span class="hbg-barras-valor" style="width:${it.valor == null ? 0 : Math.max(2, it.valor * 100).toFixed(1)}%"></span></span>
    <span class="hbg-barras-num">${esc(it.texto)}</span></li>`).join("")}</ul>`;
}

// ---- Radar (0–1) con serie actual y anterior ----
function radar(ejes, actual, anterior) {
  const W = 320, H = 250, cx = 160, cy = 125, R = 84;
  const ang = i => -Math.PI / 2 + (2 * Math.PI * i) / ejes.length;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];
  const poli = vals => vals.map((v, i) => pt(i, v == null ? 0 : v).map(n1).join(",")).join(" ");
  let out = `<svg class="hbg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumplimiento por área">`;
  [0.25, 0.5, 0.75, 1].forEach(k => { out += `<polygon class="hbg-grid" points="${poli(ejes.map(() => k))}" fill="none"/>`; });
  ejes.forEach((e, i) => {
    const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.2);
    out += `<line class="hbg-grid" x1="${cx}" y1="${cy}" x2="${n1(x)}" y2="${n1(y)}"/>`;
    out += `<text class="hbg-eje hbg-eje-radar" x="${n1(lx)}" y="${n1(ly + 4)}" text-anchor="${Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end"}">${esc(e.nombre)}</text>`;
  });
  if (anterior) out += `<polygon class="hbg-radar-prev" points="${poli(anterior)}"/>`;
  out += `<polygon class="hbg-radar" points="${poli(actual)}"/>`;
  actual.forEach((v, i) => { const [x, y] = pt(i, v == null ? 0 : v); out += `<circle class="hbg-punto" cx="${n1(x)}" cy="${n1(y)}" r="4"/>`; });
  ejes.forEach((e, i) => {
    const [x, y] = pt(i, 1.05);
    out += `<circle class="hbg-hit" cx="${n1(x)}" cy="${n1(y)}" r="24" data-tip="${esc(e.tip)}" tabindex="0" role="button" aria-label="${esc(e.tip)}"/>`;
  });
  return out + `</svg>`;
}

// ---- Línea en el tiempo (fuerza) con guías horizontales ----
// puntos: [{ x: 0–1, y, tip }]
function linea(puntos, opciones) {
  const o = Object.assign({ min: 0, max: 100, guias: [], alto: 150, ejeY: [0, 50, 100], fmt: v => String(v), inicio: "", fin: "Hoy" }, opciones);
  const W = 320, H = o.alto, m = { l: 30, r: 10, t: 12, b: 22 };
  const X = x => m.l + (W - m.l - m.r) * x;
  const Y = v => m.t + (H - m.t - m.b) * (1 - (v - o.min) / (o.max - o.min));
  let out = `<svg class="hbg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo || "")}">`;
  o.ejeY.forEach(v => { out += `<line class="hbg-grid" x1="${m.l}" x2="${W - m.r}" y1="${n1(Y(v))}" y2="${n1(Y(v))}"/><text class="hbg-eje" x="${m.l - 6}" y="${n1(Y(v) + 3.5)}" text-anchor="end">${esc(o.fmt(v))}</text>`; });
  o.guias.forEach(g => { out += `<line class="hbg-meta" x1="${m.l}" x2="${W - m.r}" y1="${n1(Y(g.y))}" y2="${n1(Y(g.y))}"/><text class="hbg-eje" x="${m.l + 4}" y="${n1(Y(g.y) - 4)}">${esc(g.texto)}</text>`; });
  if (puntos.length) {
    const d = puntos.map((p, i) => (i ? "L" : "M") + n1(X(p.x)) + " " + n1(Y(p.y))).join(" ");
    out += `<path class="hbg-area" d="${d} L${n1(X(puntos[puntos.length - 1].x))} ${n1(Y(o.min))} L${n1(X(puntos[0].x))} ${n1(Y(o.min))} Z"/>`;
    out += `<path class="hbg-linea" d="${d}"/>`;
    const u = puntos[puntos.length - 1];
    out += `<circle class="hbg-punto" cx="${n1(X(u.x))}" cy="${n1(Y(u.y))}" r="4"/>`;
    // Zonas tocables: franjas verticales alrededor de cada punto
    puntos.forEach((p, i) => {
      const a = i ? (X(puntos[i - 1].x) + X(p.x)) / 2 : m.l;
      const b = i < puntos.length - 1 ? (X(p.x) + X(puntos[i + 1].x)) / 2 : W - m.r;
      out += `<rect class="hbg-hit" x="${n1(a)}" y="0" width="${n1(Math.max(1, b - a))}" height="${H}" data-tip="${esc(p.tip)}" data-x="${n1(X(p.x))}"/>`;
    });
  }
  out += `<text class="hbg-eje" x="${m.l}" y="${H - 6}">${esc(o.inicio)}</text><text class="hbg-eje" x="${W - m.r}" y="${H - 6}" text-anchor="end">${esc(o.fin)}</text>`;
  return out + `</svg>`;
}

// ---- Ánimo con y sin un hábito (escala 1–5) ----
function pesas(items) {
  const X = v => ((v - 1) / 4) * 100;
  return `<ul class="hbg-pesas">${items.map(it => {
    const a = X(it.sin), b = X(it.con);
    return `<li data-tip="${esc(it.tip)}" tabindex="0">
      <span class="hbg-pesas-et">${esc(it.etiqueta)}</span>
      <span class="hbg-pesas-pista">
        <span class="hbg-pesas-une" style="left:${Math.min(a, b).toFixed(1)}%;width:${Math.abs(b - a).toFixed(1)}%"></span>
        <span class="hbg-pesas-sin" style="left:${a.toFixed(1)}%"></span>
        <span class="hbg-pesas-con" style="left:${b.toFixed(1)}%"></span>
      </span>
      <span class="hbg-barras-num">${esc(it.texto)}</span></li>`;
  }).join("")}</ul>`;
}

window.HabitosGraficos = { heatmap, columnas, barrasH, radar, linea, pesas, esc };
})();
