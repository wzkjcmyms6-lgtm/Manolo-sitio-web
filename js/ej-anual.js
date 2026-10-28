// ---------- Ejercicio › Perfil: calendario anual de entrenamientos ----------
// "Entrenamientos de 2026": los 12 meses en cuadritos, en azul los días con
// entrenamiento de Gimnasio. Flechas para cambiar de año, tocar un día dice
// qué entrenaste y "Compartir imagen" arma una imagen (como la de Hevy) para
// Instagram, WhatsApp o guardarla. Lee los datos de EjercicioDatos; la
// lógica vive en js/ej-calendario.js.
(function () {
const C = window.EjCalendario;
const caja = document.getElementById("ejc-anual");
if (!caja || !C || !window.EjercicioDatos) return;

const AZUL = "#4da3ff";          // color de Ejercicio
let registros = [];
let anio = null;
let diaElegido = null;

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// "juan@manolo-panel.local" → "@juan" (el nombre de usuario de Manolo, nunca un correo real).
const usuario = () => (typeof currentUser !== "undefined" && currentUser && currentUser.email ? `@${currentUser.email.split("@")[0]}` : "");

function render() {
  const hoy = hoyLocal();
  const anios = C.aniosDisponibles(registros, hoy);
  if (anio == null || !anios.includes(anio)) anio = anios[anios.length - 1];
  const a = C.anio(registros, anio, hoy);
  const celda = c => (c
    ? `<button type="button" class="ejc-d${c.n ? " is-on" : ""}${c.hoy ? " is-hoy" : ""}${c.futuro ? " is-futuro" : ""}${c.fecha === diaElegido ? " is-elegido" : ""}" data-ejc-dia="${c.fecha}" aria-label="${esc(C.fechaLarga(c.fecha))}${c.n ? `: ${c.n} ${c.n === 1 ? "entrenamiento" : "entrenamientos"}` : ""}"></button>`
    : `<span class="ejc-v" aria-hidden="true"></span>`);
  caja.innerHTML = `
    <div class="ejc-tarjeta">
      <div class="ejc-cab">
        <button type="button" class="ejc-nav" data-ejc-anio="-1" aria-label="Año anterior"${anio <= anios[0] ? " disabled" : ""}>‹</button>
        <h2 class="ejc-titulo" id="ejc-titulo">Entrenamientos de ${anio}</h2>
        <button type="button" class="ejc-nav" data-ejc-anio="1" aria-label="Año siguiente"${anio >= anios[anios.length - 1] ? " disabled" : ""}>›</button>
      </div>
      <p class="ejc-resumen">${a.diasEntrenados ? `${a.diasEntrenados} ${a.diasEntrenados === 1 ? "día entrenado" : "días entrenados"} · ${a.sesiones} ${a.sesiones === 1 ? "sesión" : "sesiones"}` : "Todavía sin entrenamientos este año"}</p>
      <div class="ejc-meses">
        ${a.meses.map(m => `
        <div class="ejc-mes">
          <span class="ejc-mes-n">${m.nombre}</span>
          <div class="ejc-grid">${m.semanas.flat().map(celda).join("")}</div>
        </div>`).join("")}
      </div>
      <div class="ejc-pie"><span class="ejc-marca">MANOLO</span><span class="ejc-usuario">${esc(usuario())}</span></div>
    </div>
    <p class="ejc-dia" aria-live="polite">${diaElegido ? textoDia(diaElegido) : "Toca un día para ver qué entrenaste."}</p>
    <button type="button" class="ejc-compartir" data-ejc="compartir"${a.diasEntrenados ? "" : " disabled"}>Compartir imagen</button>`;
}

function textoDia(f) {
  const ese = C.porDia(registros)[f] || [];
  return `${esc(C.fechaLarga(f))}: ${ese.length ? esc(ese.map(x => x.nombre).join(" · ")) : "sin entrenamiento"}`;
}

// ---------- Imagen para compartir (1080 × 1350, formato de Instagram) ----------
function redondeado(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}
function dibujarImagen() {
  const a = C.anio(registros, anio, hoyLocal());
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const fuente = (peso, px) => `${peso} ${px}px "DM Sans", -apple-system, system-ui, sans-serif`;
  x.fillStyle = "#05070d";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#0b1120";
  redondeado(x, 40, 40, W - 80, H - 80, 56);
  x.fill();
  x.strokeStyle = "rgba(255,255,255,0.08)";
  x.lineWidth = 2;
  x.stroke();
  x.fillStyle = "#f5f4f1";
  x.textAlign = "center";
  x.font = fuente(700, 60);
  x.fillText(`Entrenamientos de ${anio}`, W / 2, 175);
  x.fillStyle = "#8a93a6";
  x.font = fuente(500, 32);
  x.fillText(`${a.diasEntrenados} ${a.diasEntrenados === 1 ? "día entrenado" : "días entrenados"} · ${a.sesiones} ${a.sesiones === 1 ? "sesión" : "sesiones"}`, W / 2, 228);
  const lado = 26, gap = 5, anchoMes = 7 * lado + 6 * gap, colGap = 74;
  const x0 = (W - (3 * anchoMes + 2 * colGap)) / 2, y0 = 292, altoFila = 224;
  a.meses.forEach((m, i) => {
    const mx = x0 + (i % 3) * (anchoMes + colGap), my = y0 + Math.floor(i / 3) * altoFila;
    x.textAlign = "left";
    x.fillStyle = "#e7e9ee";
    x.font = fuente(500, 32);
    x.fillText(m.nombre, mx, my);
    m.semanas.forEach((s, f) => s.forEach((d, col) => {
      if (!d) return;
      x.fillStyle = d.n ? AZUL : d.futuro ? "#1a2232" : "#283246";
      redondeado(x, mx + col * (lado + gap), my + 16 + f * (lado + gap), lado, lado, 6);
      x.fill();
    }));
  });
  x.textAlign = "left";
  x.fillStyle = "#f5f4f1";
  x.font = fuente(800, 46);
  x.fillText("MANOLO", 100, H - 110);
  x.textAlign = "right";
  x.font = fuente(500, 38);
  x.fillText(usuario(), W - 100, H - 110);
  return c;
}
async function compartir() {
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* sigue con la del sistema */ } }
  const c = dibujarImagen();
  const nombre = `manolo-entrenamientos-${anio}.png`;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return;
  const archivo = typeof File === "function" ? new File([blob], nombre, { type: "image/png" }) : null;
  // En el iPhone: menú de compartir (Instagram, WhatsApp, Guardar imagen…).
  if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: `Entrenamientos de ${anio}` }); } catch (e) { /* cancelado */ }
    return;
  }
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

caja.addEventListener("click", e => {
  const n = e.target.closest("[data-ejc-anio]");
  if (n) { anio += Number(n.dataset.ejcAnio); diaElegido = null; render(); return; }
  const d = e.target.closest("[data-ejc-dia]");
  if (d) { diaElegido = d.dataset.ejcDia; render(); return; }
  if (e.target.closest('[data-ejc="compartir"]')) compartir();
});

EjercicioDatos.onCambio(estado => {
  registros = (estado.registros && estado.registros.gimnasio) || [];
  render();
});
window.EjAnual = { dibujarImagen: () => dibujarImagen() };
})();
