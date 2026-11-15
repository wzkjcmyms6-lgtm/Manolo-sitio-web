// ---------- Libros: "¿Qué leo después?" (pantalla, fase 5) ----------
// Debajo de "Sigue leyendo", los 3 primeros de tus "Por leer" con la razón
// principal; "Ver los N" abre la lista completa con sus razones, la
// prioridad (Baja · Normal · Alta, se cambia ahí mismo) y "Empezar".
// Lógica en js/libros-siguiente.js. D-108.
(function () {
const S = window.LibrosSiguiente, L = window.LibrosMotor;
if (!S || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("lsig-hoja");
const D = () => window.LibrosDatos || null;
const docLibro = id => db.collection("users").doc(currentUser.uid).collection("libros").doc(id);
const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);

function lista() {
  const d = D();
  if (!d || !d.listo()) return null;
  return S.siguientes(d.lista(), hoyLocal(), { metaDia: d.metaDia(), retoMeta: d.metaAnio() });
}
const tapa = l => `<span class="lib-portada lsig-tapa">${D().tapa(l)}</span>`;

// ---- En la pantalla de Libros ----
function render() {
  const el = document.getElementById("lib-siguiente");
  if (!el) return;
  const xs = lista();
  if (!xs || !xs.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<section class="lsig" aria-labelledby="lsig-t">
      <div class="lsig-cab"><h2 class="lib-sec-t" id="lsig-t">¿Qué leo después?</h2>
        <button type="button" class="lsig-ver" data-lsig="todos">${xs.length > 3 ? `Ver los ${xs.length}` : "Prioridades"} ›</button></div>
      <ol class="lsig-lista">${xs.slice(0, 3).map((x, i) => `
        <li><button type="button" class="lsig-item" data-lib-ver="${esc(x.id)}">
          <span class="lsig-n" aria-hidden="true">${i + 1}</span>${tapa(x.libro)}
          <span class="lsig-t"><b>${esc(x.libro.titulo)}</b><small>${esc(x.razones[0] || x.avisos[0] || x.libro.autor || "")}</small></span>
        </button></li>`).join("")}</ol>
    </section>`;
}

// ---- Lista completa ----
function htmlTodos() {
  const xs = lista() || [];
  if (!xs.length) return `<p class="empty-state">No te quedan libros «Por leer».</p>`;
  return `<p class="lib-nota">Ordenados por tu prioridad, tus sagas, los géneros que hace rato no lees y el largo contra tu ritmo.</p>
    <ol class="lsig-todos">${xs.map((x, i) => {
      const l = x.libro, prio = l.prioridad || "";
      return `<li class="lsig-fila">
        <div class="lsig-fila-cab"><span class="lsig-n" aria-hidden="true">${i + 1}</span>${tapa(l)}
          <span class="lsig-t"><b>${esc(l.titulo)}</b><small>${esc([l.autor, l.paginas ? `${l.paginas} págs.` : ""].filter(Boolean).join(" · "))}</small></span></div>
        ${x.razones.map(r => `<p class="lsig-razon">✓ ${esc(r)}</p>`).join("")}
        ${x.avisos.map(r => `<p class="lsig-aviso">${esc(r)}</p>`).join("")}
        <div class="lsig-acciones">
          <div class="lib-segmento lsig-prio" role="radiogroup" aria-label="Prioridad de ${esc(l.titulo)}">
            ${L.PRIORIDADES.map(p => `<button type="button" class="${p.id === prio ? "active" : ""}" data-lsig-prio="${p.id}" data-lsig-id="${esc(l.id)}" role="radio" aria-checked="${p.id === prio}">${p.nombre}</button>`).join("")}
          </div>
          <button type="button" class="lib-btn lib-btn-chico" data-lsig-empezar="${esc(l.id)}">Empezar</button>
        </div>
      </li>`;
    }).join("")}</ol>`;
}
function abrirTodos() { hoja.abrir("¿Qué leo después?", htmlTodos()); }

// ---- Toques ----
document.addEventListener("click", e => {
  if (e.target.closest('[data-lsig="todos"]')) { abrirTodos(); return; }
  const pr = e.target.closest("[data-lsig-prio]");
  if (pr) {
    const id = pr.dataset.lsigId, p = pr.dataset.lsigPrio || null;
    // Al instante en la fila; el orden se actualiza cuando llega de Firestore.
    pr.parentElement.querySelectorAll("button").forEach(b => { const on = b === pr; b.classList.toggle("active", on); b.setAttribute("aria-checked", String(on)); });
    docLibro(id).update({ prioridad: p }).catch(fallo);
    return;
  }
  const em = e.target.closest("[data-lsig-empezar]");
  if (em) {
    const l = D() && D().uno(em.dataset.lsigEmpezar);
    if (!l) return;
    docLibro(l.id).update(Object.assign({ estado: "leyendo" }, l.fechaInicio ? {} : { fechaInicio: hoyLocal() })).catch(fallo);
    hoja.cerrar();
  }
});
window.addEventListener("libros:datos", () => {
  render();
  if (hoja.abierta()) {
    const cuerpo = hoja.el.querySelector(".lib-hoja-cuerpo");
    const y = cuerpo ? cuerpo.scrollTop : 0;
    if (cuerpo) { cuerpo.innerHTML = htmlTodos(); cuerpo.scrollTop = y; }
  }
});

window.LibrosSiguienteUI = { render, abrirTodos };
})();
