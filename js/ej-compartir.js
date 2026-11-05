// ---------- Imagen para compartir: entreno y semana (fase 7) ----------
// Dibuja una imagen de 1080 × 1350 (formato de historia/post) en un canvas y
// abre el menú de compartir del teléfono (Web Share con archivo); si no se
// puede, la descarga. Nada sale de la app sin que toques "Compartir".
(function () {
"use strict";

const W = 1080, H = 1350, M = 84;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const miles = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const kgTxt = n => String(Math.round(Number(n) * 10) / 10).replace(".", ",");
const fechaLarga = iso => { const d = new Date(iso + "T12:00:00"); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
const SANS = '"DM Sans", system-ui, sans-serif';
const SERIF = '"Fraunces", "DM Sans", serif';

function lienzo() {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#0a0a0a";
  g.fillRect(0, 0, W, H);
  const brillo = g.createRadialGradient(W * 0.85, 0, 40, W * 0.85, 0, 900);
  brillo.addColorStop(0, "rgba(255, 122, 48, 0.35)");
  brillo.addColorStop(1, "rgba(255, 122, 48, 0)");
  g.fillStyle = brillo;
  g.fillRect(0, 0, W, H);
  return { c, g };
}
// Texto que no pasa de `ancho` (corta con "…").
function texto(g, t, x, y, ancho) {
  let s = String(t);
  if (ancho && g.measureText(s).width > ancho) {
    while (s.length > 1 && g.measureText(s + "…").width > ancho) s = s.slice(0, -1);
    s += "…";
  }
  g.fillText(s, x, y);
}
// Párrafo en varias líneas; devuelve la y siguiente.
function parrafo(g, t, x, y, ancho, alto, maxLineas) {
  const palabras = String(t).split(" ");
  let linea = "", n = 0;
  for (const p of palabras) {
    const prueba = linea ? linea + " " + p : p;
    if (g.measureText(prueba).width > ancho && linea) {
      if (++n >= (maxLineas || 9)) { texto(g, linea + " " + p, x, y, ancho); return y + alto; }
      g.fillText(linea, x, y); y += alto; linea = p;
    } else linea = prueba;
  }
  if (linea) { g.fillText(linea, x, y); y += alto; }
  return y;
}
function cabecera(g, arriba, titulo, sub) {
  g.textBaseline = "alphabetic";
  g.fillStyle = "#ffb84d";
  g.font = `700 30px ${SANS}`;
  g.fillText(arriba.toUpperCase(), M, 130);
  g.fillStyle = "#f5f4f1";
  g.font = `600 84px ${SERIF}`;
  texto(g, titulo, M, 230, W - 2 * M);
  g.fillStyle = "#9a978f";
  g.font = `400 34px ${SANS}`;
  g.fillText(sub, M, 290);
}
function kpis(g, lista, y) {
  const ancho = (W - 2 * M - (lista.length - 1) * 20) / lista.length;
  lista.forEach(([etq, valor], i) => {
    const x = M + i * (ancho + 20);
    g.fillStyle = "#161616";
    redondo(g, x, y, ancho, 150, 26);
    g.fill();
    g.fillStyle = "#9a978f";
    g.font = `500 26px ${SANS}`;
    g.fillText(etq, x + 26, y + 50);
    g.fillStyle = "#f5f4f1";
    g.font = `700 46px ${SANS}`;
    texto(g, valor, x + 26, y + 112, ancho - 40);
  });
  return y + 150;
}
function redondo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function pie(g) {
  g.fillStyle = "#5f5c56";
  g.font = `500 28px ${SANS}`;
  g.fillText("Hecho con Manolo", M, H - 70);
}
function frases(g, lista, y) {
  g.font = `400 34px ${SANS}`;
  lista.slice(0, 3).forEach(f => {
    g.fillStyle = "#ff9a3c";
    g.beginPath(); g.arc(M + 9, y - 11, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#e7e4dd";
    y = parrafo(g, f, M + 34, y, W - 2 * M - 34, 46, 2) + 12;
  });
  return y;
}

// entreno: el guardado. extras: { records: [{ nombre }], frases: [texto], carga }
function dibujarEntreno(entreno, extras) {
  const x = extras || {};
  const { c, g } = lienzo();
  const sets = [].concat(...(entreno.exercises || []).map(e => (e.sets || []).filter(s => !s.calentamiento && Number(s.reps) > 0)));
  const vol = sets.reduce((s, z) => s + (Number(z.kg) || 0) * (Number(z.reps) || 0), 0);
  cabecera(g, "Entreno de gimnasio", entreno.name || "Entreno", fechaLarga(entreno.date));
  let y = kpis(g, [["Duración", `${entreno.durationMin || 0} min`], ["Volumen", `${miles(vol)} kg`], ["Series", String(sets.length)]], 350);
  y += 70;
  if ((x.frases || []).length) y = frases(g, x.frases, y) + 20;
  // Ejercicios con su mejor serie; ★ si fue récord.
  const recs = new Set((x.records || []).map(r => r.nombre));
  g.fillStyle = "#9a978f";
  g.font = `700 26px ${SANS}`;
  g.fillText("EJERCICIOS", M, y);
  y += 54;
  const ejercicios = (entreno.exercises || []).filter(e => (e.sets || []).some(s => !s.calentamiento));
  // Con pocos ejercicios, filas más altas y letra más grande (sin hueco abajo).
  const fila = Math.max(62, Math.min(96, Math.floor((H - 170 - y) / Math.max(1, ejercicios.length))));
  const letra = fila >= 80 ? 42 : 36;
  const caben = Math.max(1, Math.floor((H - 160 - y) / fila));
  ejercicios.slice(0, caben).forEach(e => {
    const mejor = (e.sets || []).filter(s => !s.calentamiento && Number(s.reps) > 0)
      .reduce((a, s) => (!a || Number(s.kg) * (1 + Math.min(12, Number(s.reps)) / 30) > Number(a.kg) * (1 + Math.min(12, Number(a.reps)) / 30) ? s : a), null);
    const nombre = e.name || "";
    g.fillStyle = "#f5f4f1";
    g.font = `500 36px ${SANS}`;
    const der = mejor ? (Number(mejor.kg) > 0 ? `${kgTxt(mejor.kg)} kg × ${mejor.reps}` : `${mejor.reps} reps`) : "";
    g.font = `700 ${letra - 2}px ${SANS}`;
    const anchoDer = g.measureText(der).width;
    g.fillStyle = recs.has(nombre) ? "#ffb84d" : "#f5f4f1";
    g.fillText(der, W - M - anchoDer, y);
    g.font = `500 ${letra}px ${SANS}`;
    g.fillStyle = "#f5f4f1";
    texto(g, (recs.has(nombre) ? "★ " : "") + nombre, M, y, W - 2 * M - anchoDer - 30);
    y += fila;
  });
  if (ejercicios.length > caben) {
    g.fillStyle = "#9a978f";
    g.font = `400 30px ${SANS}`;
    g.fillText(`y ${ejercicios.length - caben} más`, M, y);
  }
  pie(g);
  return c;
}

// semana: EjInteligencia.resumenSemana; carga: EjRecuperacion.cargaSemana
function dibujarSemana(semana, carga, hoy) {
  const { c, g } = lienzo();
  const l = new Date(hoy + "T12:00:00");
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7));
  cabecera(g, "Mi semana", semana.titulo, `Semana del ${l.getDate()} ${MESES[l.getMonth()]}`);
  const s = semana.cifras;
  let y = kpis(g, [["Entrenos", s.planeados ? `${s.entrenos} de ${s.planeados}` : String(s.entrenos)], ["Series", String(s.series)], ["Récords", String(s.records)]], 350);
  y += 80;
  // Barras de carga por día.
  if (carga && carga.dias) {
    const max = Math.max(1, ...carga.dias.map(d => d.gym + d.run + d.bici));
    const alto = 320, ancho = (W - 2 * M) / 7;
    carga.dias.forEach((d, i) => {
      const x = M + i * ancho + ancho * 0.18, w = ancho * 0.64;
      g.fillStyle = "#1c1c1c";
      redondo(g, x, y, w, alto, 16); g.fill();
      let base = y + alto;
      [["run", "#4da3ff"], ["bici", "#6fd08c"], ["gym", "#ff9a3c"]].forEach(([k, col]) => {
        const h = (d[k] / max) * alto;
        if (h <= 0) return;
        g.fillStyle = col;
        g.fillRect(x, base - h, w, h);
        base -= h;
      });
      g.fillStyle = "#9a978f";
      g.font = `500 26px ${SANS}`;
      const etq = ["L", "M", "X", "J", "V", "S", "D"][i];
      g.fillText(etq, x + w / 2 - g.measureText(etq).width / 2, y + alto + 44);
    });
    y += alto + 110;
  }
  g.font = `400 40px ${SANS}`;
  semana.lineas.slice(1, 6).forEach(t => {
    if (y > H - 150) return; // sin pisar el pie
    g.fillStyle = "#ff9a3c";
    g.beginPath(); g.arc(M + 10, y - 13, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#e7e4dd";
    texto(g, t, M + 38, y, W - 2 * M - 38);
    y += 70;
  });
  pie(g);
  return c;
}

const aBlob = c => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("imagen"))), "image/png"));
async function compartir(canvas, nombre) {
  const blob = await aBlob(canvas);
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
const listas = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());

window.EjCompartir = {
  dibujarEntreno, dibujarSemana,
  entreno: (entreno, extras) => listas().then(() => compartir(dibujarEntreno(entreno, extras), `entreno-${entreno.date}.png`)),
  semana: (semana, carga, hoy) => listas().then(() => compartir(dibujarSemana(semana, carga, hoy), `semana-${hoy}.png`))
};
})();
