// ---------- Inversiones: dibujo de gráficos (fase 3) ----------
// Líneas y columnas en SVG, dibujadas al ancho real de su caja (así no se
// estiran en la compu). Marcas finas: líneas de 2 px, columnas de hasta
// 24 px con la punta redondeada, rejilla de 1 px. El texto nunca va del
// color de la serie. Paleta validada sobre el fondo oscuro: docs/INVERSIONES.md.
// Las funciones de dibujo no tocan el DOM (tests/inversiones-graficos.test.js);
// `conectar` agrega el "toca y desliza para leer" en el teléfono.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.InversionesGraficos = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const COLORES = { principal: "#e8651f", satelite: "#3987e5", contexto: "#9a978f", sube: "#2fa37a", baja: "#e2593f" };
const TINTA = { suave: "#9a978f", rejilla: "#2a2a28", base: "#3a3a37", fondo: "#161616" };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r1 = n => Math.round(n * 10) / 10;
const fechaCorta = f => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;

// Números del eje: redondos y cortos (0 · 50 · 100 · 1,5 mil). `dec`: los
// decimales que pide el paso de la escala (0,05 → 2), para no repetir rótulos.
function corto(n, dec) {
  const a = Math.abs(n);
  if (a >= 1000) return `${n < 0 ? "−" : ""}${(a / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} mil`;
  return `${n < 0 ? "−" : ""}${a.toLocaleString("es-ES", { maximumFractionDigits: dec != null ? dec : (a < 10 ? 1 : 0) })}`;
}

// Escala "linda": de min a max en 3 a 5 pasos redondos (1, 2, 2,5 o 5 × 10^k).
function escala(min, max, pasos = 5) {
  if (!(max > min)) { max = min + (min === 0 ? 1 : Math.abs(min) * 0.1 || 1); }
  const bruto = (max - min) / pasos;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 2.5, 5, 10].map(k => k * pot).find(p => p >= bruto) || 10 * pot;
  const lo = Math.floor(min / paso + 1e-9) * paso, hi = Math.ceil(max / paso - 1e-9) * paso;
  const ticks = [];
  for (let v = lo; v <= hi + paso / 2; v += paso) ticks.push(Math.round(v * 1e6) / 1e6);
  const dec = Math.max(0, Math.min(6, -Math.floor(Math.log10(paso) + 1e-9) + (/^(25|2\.5)/.test(String(paso / pot)) ? 1 : 0)));
  return { min: lo, max: hi, ticks, dec };
}

// ---- Líneas ----
// o: { ancho, alto, fechas: [iso], series: [{ id, nombre, color, valores, area, escalon }] }
// Devuelve { svg, xs, ys: { id: [y] }, ... } para el toque.
function lineas(o) {
  const ancho = Math.max(200, Math.round(o.ancho || 320)), alto = o.alto || 190;
  const n = o.fechas.length;
  const todos = o.series.reduce((a, s) => a.concat(s.valores.filter(v => v != null)), []);
  const esc0 = escala(Math.min(0, ...todos), Math.max(0, ...todos));
  const izq = Math.max(28, 8 + Math.max(...esc0.ticks.map(t => corto(t, esc0.dec).length)) * 6.4);
  const der = 10, arriba = 10, abajo = 24;
  const w = ancho - izq - der, h = alto - arriba - abajo;
  const x = i => r1(n > 1 ? izq + (i * w) / (n - 1) : izq + w / 2);
  const y = v => r1(arriba + h - ((v - esc0.min) / (esc0.max - esc0.min)) * h);
  const xs = o.fechas.map((_, i) => x(i));
  const ys = {};
  let rej = "", ejes = "", trazos = "", puntos = "";
  esc0.ticks.forEach(t => {
    const yy = y(t);
    rej += `<line x1="${izq}" x2="${ancho - der}" y1="${yy}" y2="${yy}" stroke="${t === 0 ? TINTA.base : TINTA.rejilla}" stroke-width="1"/>`;
    ejes += `<text x="${izq - 6}" y="${yy + 3.5}" text-anchor="end">${esc(corto(t, esc0.dec))}</text>`;
  });
  const marcas = n <= 2 ? [0, n - 1] : (ancho >= 300 ? [0, Math.round((n - 1) / 2), n - 1] : [0, n - 1]);
  [...new Set(marcas)].forEach(i => {
    const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
    ejes += `<text x="${xs[i]}" y="${alto - 6}" text-anchor="${anchor}">${esc(fechaCorta(o.fechas[i]))}</text>`;
  });
  o.series.forEach(s => {
    const yy = s.valores.map(v => (v == null ? null : y(v)));
    ys[s.id] = yy;
    let d = "";
    yy.forEach((v, i) => {
      if (v == null) return;
      if (!d) d = `M${xs[i]},${v}`;
      else d += s.escalon ? `H${xs[i]}V${v}` : `L${xs[i]},${v}`;
    });
    if (!d) return;
    if (s.area) {
      const base = y(Math.max(0, esc0.min));
      const primero = yy.findIndex(v => v != null);
      trazos += `<path d="${d}V${base}H${xs[primero]}Z" fill="${s.color}" fill-opacity="0.1" stroke="none"/>`;
    }
    trazos += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const k = yy.length - 1 - [...yy].reverse().findIndex(v => v != null);
    puntos += `<circle cx="${xs[k]}" cy="${yy[k]}" r="4" fill="${s.color}" stroke="${TINTA.fondo}" stroke-width="2"/>`;
  });
  const capaToque = o.series.map(s => `<circle class="inv-g-punto" data-serie="${esc(s.id)}" r="4" fill="${s.color}" stroke="${TINTA.fondo}" stroke-width="2" visibility="hidden"/>`).join("");
  const svg = `<svg class="inv-g-svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(o.titulo || "")}">
    <g class="inv-g-rejilla">${rej}</g><g class="inv-g-ejes">${ejes}</g>${trazos}${puntos}
    <line class="inv-g-cruz" x1="0" x2="0" y1="${arriba}" y2="${arriba + h}" stroke="${TINTA.suave}" stroke-width="1" visibility="hidden"/>${capaToque}
  </svg>`;
  return { svg, xs, ys, ancho, alto, izq, der, arriba, h, escala: esc0 };
}

// ---- Columnas ----
// o: { ancho, alto, barras: [{ etiqueta, valor }], color, meta: { valor, texto } }
function columnas(o) {
  const ancho = Math.max(200, Math.round(o.ancho || 320)), alto = o.alto || 180;
  const n = o.barras.length;
  const vals = o.barras.map(b => b.valor);
  const metaV = o.meta && o.meta.valor > 0 ? o.meta.valor : null;
  const esc0 = escala(Math.min(0, ...vals), Math.max(0, ...vals, metaV || 0));
  const izq = Math.max(28, 8 + Math.max(...esc0.ticks.map(t => corto(t, esc0.dec).length)) * 6.4);
  const der = 8, arriba = 18, abajo = 22;
  const w = ancho - izq - der, h = alto - arriba - abajo;
  const slot = w / Math.max(1, n);
  const grosor = Math.max(6, Math.min(24, slot * 0.6));
  const y = v => r1(arriba + h - ((v - esc0.min) / (esc0.max - esc0.min)) * h);
  const base = y(0);
  const xs = o.barras.map((_, i) => r1(izq + slot * i + slot / 2));
  let rej = "", ejes = "", barras = "", textos = "";
  esc0.ticks.forEach(t => {
    const yy = y(t);
    rej += `<line x1="${izq}" x2="${ancho - der}" y1="${yy}" y2="${yy}" stroke="${t === 0 ? TINTA.base : TINTA.rejilla}" stroke-width="1"/>`;
    ejes += `<text x="${izq - 6}" y="${yy + 3.5}" text-anchor="end">${esc(corto(t, esc0.dec))}</text>`;
  });
  // Etiquetas de valor: todas si son pocas; si no, la última y la mayor.
  const mayor = vals.indexOf(Math.max(...vals));
  const conValor = i => n <= 6 || i === n - 1 || i === mayor;
  const cadaX = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 34))));
  o.barras.forEach((b, i) => {
    const x0 = r1(xs[i] - grosor / 2), yv = y(b.valor), alt = Math.abs(base - yv), rr = Math.min(4, alt / 2, grosor / 2);
    if (alt > 0.5) {
      const d = b.valor >= 0
        ? `M${x0},${base}V${r1(yv + rr)}Q${x0},${yv} ${r1(x0 + rr)},${yv}H${r1(x0 + grosor - rr)}Q${r1(x0 + grosor)},${yv} ${r1(x0 + grosor)},${r1(yv + rr)}V${base}Z`
        : `M${x0},${base}V${r1(yv - rr)}Q${x0},${yv} ${r1(x0 + rr)},${yv}H${r1(x0 + grosor - rr)}Q${r1(x0 + grosor)},${yv} ${r1(x0 + grosor)},${r1(yv - rr)}V${base}Z`;
      barras += `<path class="inv-g-barra" data-i="${i}" d="${d}" fill="${o.color}"/>`;
    }
    if (conValor(i)) textos += `<text class="inv-g-valor" x="${xs[i]}" y="${b.valor >= 0 ? yv - 5 : yv + 12}" text-anchor="middle">${esc(corto(Math.round(b.valor)))}</text>`;
    if (i % cadaX === 0 || i === n - 1) ejes += `<text x="${xs[i]}" y="${alto - 6}" text-anchor="middle">${esc(b.etiqueta)}</text>`;
  });
  let meta = "";
  if (metaV) {
    const ym = y(metaV);
    // El rótulo de la meta va en la leyenda de la tarjeta (aquí chocaría con los valores).
    meta = `<line class="inv-g-meta" x1="${izq}" x2="${ancho - der}" y1="${ym}" y2="${ym}" stroke="${TINTA.suave}" stroke-width="1"><title>${esc(o.meta.texto || "")}</title></line>`;
  }
  const svg = `<svg class="inv-g-svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(o.titulo || "")}">
    <g class="inv-g-rejilla">${rej}</g><g class="inv-g-ejes">${ejes}</g>${meta}${barras}${textos}
  </svg>`;
  return { svg, xs, slot, grosor, ancho, alto, izq, der, escala: esc0 };
}

// ---- Toca y desliza para leer (y flechas del teclado) ----
// info: { xs, fila(i) → { titulo, items: [{ color, valor, nombre }] }, puntos(i) → [{ serie, y }], barras: bool }
// Arma el texto con textContent (los nombres vienen de tus datos).
function conectar(caja, info) {
  const svg = caja.querySelector("svg");
  if (!svg) return;
  let tip = caja.querySelector(".inv-g-tip");
  if (!tip) { tip = document.createElement("div"); tip.className = "inv-g-tip"; tip.hidden = true; caja.appendChild(tip); }
  const cruz = svg.querySelector(".inv-g-cruz");
  let actual = -1;
  const mostrar = i => {
    if (i < 0 || i >= info.xs.length) return;
    actual = i;
    const f = info.fila(i);
    tip.textContent = "";
    const t = document.createElement("div");
    t.className = "inv-g-tip-t";
    t.textContent = f.titulo;
    tip.appendChild(t);
    f.items.forEach(it => {
      const fila = document.createElement("div");
      fila.className = "inv-g-tip-f";
      const k = document.createElement("i");
      k.style.background = it.color;
      const v = document.createElement("b");
      v.textContent = it.valor;
      const nombre = document.createElement("span");
      nombre.textContent = it.nombre;
      fila.append(k, v, nombre);
      tip.appendChild(fila);
    });
    tip.hidden = false;
    const x = info.xs[i];
    if (cruz) { cruz.setAttribute("x1", x); cruz.setAttribute("x2", x); cruz.setAttribute("visibility", "visible"); }
    (info.puntos ? info.puntos(i) : []).forEach(p => {
      const c = svg.querySelector(`.inv-g-punto[data-serie="${p.serie}"]`);
      if (!c) return;
      if (p.y == null) { c.setAttribute("visibility", "hidden"); return; }
      c.setAttribute("cx", x); c.setAttribute("cy", p.y); c.setAttribute("visibility", "visible");
    });
    svg.querySelectorAll(".inv-g-barra").forEach(b => b.classList.toggle("is-activa", Number(b.dataset.i) === i));
    const ancho = caja.clientWidth, tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(ancho - tw, x - tw / 2))}px`;
  };
  const ocultar = () => {
    actual = -1;
    tip.hidden = true;
    if (cruz) cruz.setAttribute("visibility", "hidden");
    svg.querySelectorAll(".inv-g-punto").forEach(c => c.setAttribute("visibility", "hidden"));
    svg.querySelectorAll(".inv-g-barra.is-activa").forEach(b => b.classList.remove("is-activa"));
  };
  const cercano = clientX => {
    const r = svg.getBoundingClientRect();
    const x = (clientX - r.left) * (svg.viewBox.baseVal.width / r.width || 1);
    let mejor = 0;
    info.xs.forEach((xx, i) => { if (Math.abs(xx - x) < Math.abs(info.xs[mejor] - x)) mejor = i; });
    return mejor;
  };
  svg.addEventListener("pointerdown", e => mostrar(cercano(e.clientX)));
  svg.addEventListener("pointermove", e => { if (e.pointerType !== "touch" || e.buttons || e.pressure) mostrar(cercano(e.clientX)); });
  svg.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") ocultar(); });
  caja.tabIndex = 0;
  caja.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      mostrar(Math.max(0, Math.min(info.xs.length - 1, (actual < 0 ? info.xs.length - 1 : actual + (e.key === "ArrowRight" ? 1 : -1)))));
    } else if (e.key === "Escape") ocultar();
  });
  caja.addEventListener("blur", ocultar);
  return { mostrar, ocultar };
}

return { COLORES, TINTA, corto, escala, fechaCorta, lineas, columnas, conectar };
});
