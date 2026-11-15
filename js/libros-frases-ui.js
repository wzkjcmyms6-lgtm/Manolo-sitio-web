// ---------- Libros: repaso de frases y compartirlas (pantalla, fase 5b) ----------
// Arriba de Libros, "Frases de hoy" (1 a 3 por día); el repaso muestra una
// frase por vez para calificarla (❤️ Me encanta · 👍 Bien · 👎 Menos), ★
// favorita y Compartir (imagen JPEG 1080 × 1350 con js/biblia-imagen.js). Al
// final se elige cuántas por día. Lógica en js/libros-frases.js; datos en
// users/{uid}/libros_frases/{id}.repaso y meta/libros_ajustes.frasesDia. D-109.
(function () {
const F = window.LibrosFrases, L = window.LibrosMotor;
if (!F || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("lfr-hoja");
const D = () => window.LibrosDatos || null;
const refFrase = id => db.collection("users").doc(currentUser.uid).collection("libros_frases").doc(id);
const refAjustes = () => db.collection("users").doc(currentUser.uid).collection("meta").doc("libros_ajustes");
const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);
let cola = null;       // ids de la sesión de repaso
let i = 0;

const frases = () => (D() && D().listo() ? D().frases() : null);
const delDia = () => { const fs = frases(); return fs ? F.paraHoy(fs, hoyLocal(), D().frasesDia()) : null; };
const deQuien = f => { const l = D() && D().uno(f.libroId); return l ? `${l.titulo}${l.autor ? `, ${l.autor}` : ""}` : ""; };

// ---- Tarjeta arriba de Libros ----
function render() {
  const el = document.getElementById("lib-repaso");
  if (!el) return;
  const h = delDia();
  if (!h || (!h.pendientes.length && !h.hechas.length)) { el.innerHTML = ""; return; }
  el.innerHTML = h.pendientes.length
    ? `<div class="lfr-hoy"><span aria-hidden="true">📝</span>
        <p><b>${h.pendientes.length} ${h.pendientes.length === 1 ? "frase" : "frases"} para hoy</b><small>Vuelve a lo que te marcó de tus libros.</small></p>
        <button type="button" class="lib-btn" data-lfr="repasar">Repasar</button></div>`
    : `<p class="lfr-listo">✓ Repasaste tus frases de hoy.</p>`;
}

// ---- Repaso ----
function repasar() {
  const h = delDia();
  if (!h || !h.pendientes.length) return;
  cola = h.pendientes.map(f => f.id);
  i = 0;
  pintar(true);
}
function pintar(abrir) {
  const fs = frases() || [];
  const f = fs.find(x => x.id === cola[i]);
  if (!f) { siguiente(); return; }
  const html = `<div class="lfr">
      <p class="lfr-paso">${i + 1} de ${cola.length}</p>
      <blockquote class="lfr-texto">«${esc(f.texto)}»</blockquote>
      <p class="lfr-de">— ${esc(deQuien(f))}${f.pagina ? ` · p. ${f.pagina}` : ""}</p>
      ${f.etiquetas.length ? `<p class="lfr-etiquetas">${f.etiquetas.map(t => `<i>#${esc(t)}</i>`).join("")}</p>` : ""}
      <div class="lfr-notas" role="group" aria-label="¿Cómo te llega hoy?">
        ${F.NOTAS.map(n => `<button type="button" class="lfr-nota is-${n.id}" data-lfr-nota="${n.id}"><span aria-hidden="true">${n.emoji}</span>${n.nombre}</button>`).join("")}
      </div>
      <div class="lfr-mas">
        <button type="button" class="lib-btn-sec lib-btn-chico${f.fav ? " is-fav" : ""}" data-lfr-fav="${esc(f.id)}" aria-pressed="${f.fav}">${f.fav ? "★ Favorita" : "☆ Favorita"}</button>
        <button type="button" class="lib-btn-sec lib-btn-chico" data-lfr-compartir="${esc(f.id)}">Compartir</button>
      </div>
      <p class="lib-ayuda">❤️ vuelve en 3 días · 👍 cada vez más espaciada · 👎 en 3 meses.</p>
    </div>`;
  if (abrir || !hoja.abierta()) hoja.abrir("Frases de hoy", html);
  else hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = html;
}
function siguiente() {
  i++;
  if (cola && i < cola.length) { pintar(false); return; }
  const n = cola ? cola.length : 0;
  cola = null;
  const porDia = D() ? D().frasesDia() : F.POR_DIA;
  hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = `<div class="lfr-fin">
      <p class="lfr-fin-t">🎉 Listo por hoy</p>
      <p>Repasaste ${n} ${n === 1 ? "frase" : "frases"}. Mañana, otras.</p>
      <div class="lib-campo"><span>Frases por día</span>
        <div class="lib-segmento" role="radiogroup" aria-label="Frases por día">
          ${[1, 2, 3].map(k => `<button type="button" class="${k === porDia ? "active" : ""}" data-lfr-pordia="${k}" role="radio" aria-checked="${k === porDia}">${k}</button>`).join("")}
        </div>
      </div>
      <button type="button" class="lib-btn lib-btn-ancho" data-cerrar-hoja>Listo</button>
    </div>`;
  render();
}

// ---- Compartir como imagen ----
const SERIF = '"Fraunces", "DM Sans", Georgia, serif';
async function compartir(id) {
  const f = (frases() || []).find(x => x.id === id);
  const BI = window.BibliaImagen;
  if (!f || !BI) return;
  try {
    if (document.fonts && document.fonts.load) {
      try { await Promise.all([document.fonts.load(`500 60px ${SERIF}`), document.fonts.load('700 46px "DM Sans"')]); } catch (e) { /* letra del sistema */ }
    }
    const c = document.createElement("canvas");
    c.width = BI.W;
    c.height = BI.H;
    const g = c.getContext("2d");
    const medir = (t, tam) => { g.font = `500 ${tam}px ${SERIF}`; return g.measureText(t).width; };
    BI.dibujar(g, BI.plan(f.texto, deQuien(f), medir), { titulo: "DE MIS LIBROS", pie: "Manolo" });
    // JPEG: pesa mucho menos que PNG (≈ 200 KB contra 1,2 MB) y se arma más rápido.
    const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("imagen"))), "image/jpeg", 0.92));
    const nombre = `frase-${L.normalizar(deQuien(f)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "libro"}.jpg`;
    const archivo = typeof File === "function" ? new File([blob], nombre, { type: "image/jpeg" }) : null;
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] }) && navigator.share) {
      try { await navigator.share({ files: [archivo] }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } catch (e) { alert("No se pudo armar la imagen."); }
}

// ---- Toques ----
hoja.el.addEventListener("click", e => {
  const n = e.target.closest("[data-lfr-nota]");
  if (n && cola) {
    const f = (frases() || []).find(x => x.id === cola[i]);
    if (f) refFrase(f.id).update({ repaso: F.calificar(f, n.dataset.lfrNota, hoyLocal()) }).catch(fallo);
    siguiente();
    return;
  }
  const pd = e.target.closest("[data-lfr-pordia]");
  if (pd) {
    hoja.el.querySelectorAll("[data-lfr-pordia]").forEach(b => { const on = b === pd; b.classList.toggle("active", on); b.setAttribute("aria-checked", String(on)); });
    refAjustes().set({ frasesDia: Number(pd.dataset.lfrPordia) }, { merge: true }).catch(fallo);
  }
});
document.addEventListener("click", e => {
  if (e.target.closest('[data-lfr="repasar"]')) { repasar(); return; }
  const fav = e.target.closest("[data-lfr-fav]");
  if (fav) {
    const f = (frases() || []).find(x => x.id === fav.dataset.lfrFav);
    if (!f) return;
    const si = !f.fav;
    fav.classList.toggle("is-fav", si);
    fav.setAttribute("aria-pressed", String(si));
    fav.textContent = si ? "★ Favorita" : "☆ Favorita";
    refFrase(f.id).update({ fav: si }).catch(fallo);
    return;
  }
  const co = e.target.closest("[data-lfr-compartir]");
  if (co) compartir(co.dataset.lfrCompartir);
});
window.addEventListener("libros:datos", render);

window.LibrosFrasesUI = { render, repasar, compartir };
})();
