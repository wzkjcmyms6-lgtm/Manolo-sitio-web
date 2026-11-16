// ---------- Resúmenes: imágenes para compartir (D-136) ----------
// Una imagen vertical tipo historia (1080 × 1920) de "Tu semana" y de cada
// diapositiva de "Tu año" (más la final, con lo mejor del año). `planSemana()`,
// `planDiapositiva()` y `planAnio()` arman el dibujo sin pantalla
// (tests/resumen-imagen.test.js); `dibujar()` lo pinta en un canvas. Para
// compartir se usa el menú del teléfono (RunCompartir.compartir).
// **Sin montos de dinero**: Finanzas y lo que habla de gastos no entra.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResumenImagen = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const ANCHO = 1080, ALTO = 1920, MARGEN = 96;
const COLOR = { tinta: "#f5f4f1", suave: "rgba(245,244,241,0.66)", acento1: "#ff7a30", acento2: "#ffb84d", bueno: "#7fe0a6", fondo1: "#1d1611", fondo2: "#0a0a0a" };
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
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

// ---- "Tu año" (fase 4, D-140) ----
// Un monto de dinero ("Bs 1.240"): nunca entra en una imagen. Los
// porcentajes de Finanzas sí (es lo único que su diapositiva comparte).
const ES_MONTO = t => /\bBs\b|\$\s?\d/i.test(String(t || ""));
// El tamaño más grande (desde `tam`) con el que el texto entra en `ancho`.
function ajustar(t, tam, peso, ancho, medir, minimo) {
  let x = tam;
  while (x > (minimo || 40) && medir(t, x, peso) > ancho) x -= 4;
  return x;
}

// s: una diapositiva de ResumenAnio.diapositivas(); anio: el año. Se ve
// como la diapositiva (lo que ves es lo que compartes), sin montos.
function planDiapositiva(s, medir, anio) {
  const m = medir || medirAprox;
  const textos = [], rayas = [];
  const util = ANCHO - 2 * MARGEN, tope = ALTO - 230;
  let y = 210;
  const poner = (t, tam, peso, color, extra) => { textos.push(Object.assign({ t, x: MARGEN, y, tam, peso, color }, extra || {})); };
  poner(`MI ${anio || ""} EN MANOLO`.replace("  ", " "), 38, 800, COLOR.acento2, { espaciado: 6 });
  y += 100;
  if (s.eyebrow && String(s.eyebrow) !== String(anio)) { poner(s.eyebrow, 64, 800, COLOR.tinta); y += 40; }
  rayas.push({ x: MARGEN, y, w: 160, h: 10, color: COLOR.acento1 });
  y += 70;
  if (s.grande) {
    const tam = ajustar(s.grande, 230, 800, util, m, 96);
    y += Math.round(tam * 0.78);
    poner(s.grande, tam, 800, COLOR.acento1);
    y += 84;
    lineas(s.titulo, 54, 700, util, m).slice(0, 3).forEach(l => { poner(l, 54, 700, COLOR.tinta); y += 68; });
  } else if (s.titulo) {
    y += 70;
    lineas(s.titulo, 76, 800, util, m).slice(0, 4).forEach(l => { poner(l, 76, 800, COLOR.tinta); y += 92; });
  }
  // El año en números: de a dos por fila.
  if (s.numeros && s.numeros.length) {
    y += 40;
    const col = util / 2;
    s.numeros.filter(n => !ES_MONTO(`${n.valor} ${n.etiqueta}`)).slice(0, 8).forEach((n, k) => {
      const x = MARGEN + (k % 2) * col;
      if (k % 2 === 0 && k) y += 210;
      if (y > tope - 60) return;
      const tam = ajustar(n.valor, 104, 800, col - 30, m, 56);
      textos.push({ t: n.valor, x, y: y + 96, tam, peso: 800, color: COLOR.acento1 });
      lineas(n.etiqueta, 34, 600, col - 30, m).slice(0, 2).forEach((l, i) => textos.push({ t: l, x, y: y + 150 + i * 42, tam: 34, peso: 600, color: COLOR.suave }));
    });
    y += 280;
  }
  // Las barras por mes.
  if (s.barras && s.barras.some(b => b.valor > 0) && y < tope - 340) {
    y += 40;
    const alto = 230, n = s.barras.length, paso = util / n, w = Math.min(54, paso - 18);
    s.barras.forEach((b, k) => {
      const x = MARGEN + k * paso + (paso - w) / 2, h = b.valor > 0 ? Math.max(10, Math.round(b.valor * alto)) : 4;
      rayas.push({ x, y: y + alto - h, w, h, color: b.valor > 0 ? COLOR.acento1 : "rgba(245,244,241,0.18)" });
      textos.push({ t: b.etiqueta, x: x + w / 2, y: y + alto + 46, tam: 28, peso: 700, color: COLOR.suave, alinear: "center" });
    });
    y += alto + 110;
  }
  // Las líneas (sin montos).
  (s.lineas || []).filter(l => !ES_MONTO(l)).forEach(l => {
    if (y > tope) return;
    lineas(l, 42, 500, util, m).slice(0, 3).forEach(t => { if (y <= tope) { poner(t, 42, 500, COLOR.tinta); y += 56; } });
    y += 18;
  });
  // La frase del año.
  if (s.frase && s.frase.texto && y < tope - 140) {
    y += 30;
    lineas(`«${s.frase.texto}»`, 46, 600, util, m).slice(0, 5).forEach(t => { if (y <= tope) { poner(t, 46, 600, COLOR.acento2); y += 60; } });
    if (s.frase.de && y <= tope) { y += 6; poner(`— ${s.frase.de}`, 34, 600, COLOR.suave); y += 50; }
  }
  // Contra el año anterior.
  if (s.lista && s.lista.length) {
    y += 20;
    s.lista.filter(x => !ES_MONTO(x.texto)).slice(0, 6).forEach(x => {
      if (y > tope) return;
      poner(`${x.signo > 0 ? "▲" : "▼"} ${x.texto}`, 50, 700, x.signo > 0 ? COLOR.bueno : COLOR.acento2);
      y += 78;
    });
  }
  textos.push({ t: "Manolo", x: ANCHO / 2, y: ALTO - 110, tam: 36, peso: 800, color: COLOR.suave, alinear: "center", espaciado: 2 });
  return { ancho: ANCHO, alto: ALTO, textos, rayas };
}

// y: resultado de ResumenAnio.anio(). La imagen final con lo mejor del año:
// sin Finanzas y sin dinero.
function planAnio(y, medir) {
  const m = medir || medirAprox;
  const textos = [], rayas = [];
  const util = ANCHO - 2 * MARGEN, tope = ALTO - 230;
  let h = 210;
  const poner = (t, tam, peso, color, extra) => { textos.push(Object.assign({ t, x: MARGEN, y: h, tam, peso, color }, extra || {})); };
  poner("MI AÑO EN MANOLO", 40, 800, COLOR.acento2, { espaciado: 6 });
  h += 200;
  poner(String(y.anio), 200, 800, COLOR.acento1);
  h += 76;
  if (!y.completo && y.hasta) {
    poner(`Hasta el ${Number(y.hasta.slice(8, 10))} de ${MESES_LARGOS[Number(y.hasta.slice(5, 7)) - 1]}`, 40, 600, COLOR.suave);
    h += 56;
  }
  rayas.push({ x: MARGEN, y: h, w: 160, h: 10, color: COLOR.acento1 });
  h += 150;
  if (y.diasActivos) {
    poner(String(y.diasActivos).replace(/\B(?=(\d{3})+(?!\d))/g, "."), 150, 800, COLOR.tinta);
    h += 66;
    poner(y.diasActivos === 1 ? "día con algo anotado" : "días con algo anotado", 44, 600, COLOR.suave);
    h += 70;
  }
  const dest = (y.destacados || []).filter(x => !ES_DINERO(x.texto)).slice(0, 6);
  if (dest.length) {
    h += 50;
    poner("LO MÁS DESTACADO", 34, 800, COLOR.acento2, { espaciado: 4 });
    h += 76;
    dest.forEach(x => {
      if (h > tope) return;
      lineas(`${x.icono} ${x.texto}`, 50, 700, util, m).slice(0, 2).forEach(t => { if (h <= tope) { poner(t, 50, 700, COLOR.tinta); h += 66; } });
      h += 16;
    });
  }
  const S = y.secciones || {};
  const extra = [];
  if (S.libros && S.libros.libroDelAnio) extra.push(`📚 Libro del año: «${S.libros.libroDelAnio.titulo}»`);
  if (y.mejorMes) extra.push(`🗓️ Mi mejor mes: ${y.mejorMes.nombre}`);
  extra.filter(t => !ES_DINERO(t)).forEach(t => {
    if (h > tope - 60) return;
    h += 10;
    lineas(t, 40, 600, util, m).slice(0, 2).forEach(l => { if (h <= tope) { poner(l, 40, 600, COLOR.suave); h += 54; } });
  });
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

return { ANCHO, ALTO, ES_DINERO, ES_MONTO, lineas, medirAprox, planSemana, planDiapositiva, planAnio, dibujar, medidor };
});
