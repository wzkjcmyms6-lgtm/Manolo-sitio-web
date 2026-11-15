// ---------- Libros: notas de cada libro (pantalla, fase 5) ----------
// En la ficha, aparte de "Mi opinión": lo que aprendiste, ideas para
// aplicar o una nota, cada una con su fecha. Datos en el libro:
// notas: { id: { texto, tipo, fecha, creado } }. Lógica en
// js/libros-motor.js (validarNota, notasDe). D-108.
(function () {
const L = window.LibrosMotor;
if (!L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("lnota-hoja");
let editando = null;   // { libroId, id (null = nueva), creado }
const D = () => window.LibrosDatos || null;
const docLibro = id => db.collection("users").doc(currentUser.uid).collection("libros").doc(id);
const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);

// ---- En la ficha ----
function ficha(l) {
  const xs = L.notasDe(l);
  return `<div class="lnotas">
      <div class="lib-h lib-h-fila"><h5>Notas <span>${xs.length}</span></h5><button type="button" class="lib-btn-sec lib-btn-chico" data-lnota-nueva="${esc(l.id)}">＋ Nota</button></div>
      ${xs.length ? xs.map(n => `<button type="button" class="lnota" data-lnota="${esc(l.id)}" data-lnota-id="${esc(n.id)}">
          <span class="lnota-cab">${L.TIPO_NOTA[n.tipo].emoji} ${esc(L.TIPO_NOTA[n.tipo].nombre)} · ${esc(L.fechaLarga(n.fecha))}</span>
          <span class="lnota-t">${esc(n.texto)}</span>
        </button>`).join("") : `<p class="lib-nota">Lo que aprendiste o ideas para aplicar, cada una con su fecha.</p>`}
    </div>`;
}

// ---- Hoja: nueva o editar ----
function abrir(libroId, id) {
  const l = D() && D().uno(libroId);
  if (!l) return;
  const n = id ? L.notasDe(l).find(x => x.id === id) : null;
  editando = { libroId, id: n ? n.id : null, creado: n ? n.creado || 0 : 0 };
  const v = n || { tipo: "aprendi", texto: "", fecha: hoyLocal() };
  hoja.abrir(n ? "Editar nota" : "Nueva nota", `
      <form class="lib-form lnota-form" novalidate>
        <p class="lib-nota">De <b>${esc(l.titulo)}</b></p>
        <div class="lib-segmento" role="radiogroup" aria-label="Tipo de nota">
          ${L.TIPOS_NOTA.map(t => `<button type="button" class="${t.id === v.tipo ? "active" : ""}" data-lnota-tipo="${t.id}" role="radio" aria-checked="${t.id === v.tipo}">${t.emoji} ${t.corto}</button>`).join("")}
        </div>
        <input type="hidden" name="tipo" value="${esc(v.tipo)}">
        <label class="lib-campo"><span>Nota</span><textarea name="texto" rows="5" class="lib-input" placeholder="Lo que aprendiste, una idea para aplicar…">${esc(v.texto)}</textarea></label>
        <label class="lib-campo"><span>Fecha</span><input type="date" name="fecha" max="${hoyLocal()}" value="${esc(v.fecha)}" class="lib-input"></label>
        <p class="lib-error" role="alert" hidden></p>
        <div class="lib-acciones">
          ${n ? `<button type="button" class="lib-btn-peligro" data-lnota-borrar>Eliminar</button>` : ""}
          <button type="submit" class="lib-btn">Guardar</button>
        </div>
      </form>`);
}
hoja.el.addEventListener("submit", e => {
  e.preventDefault();
  if (!editando) return;
  const f = e.target;
  const r = L.validarNota({ texto: f.elements.texto.value, tipo: f.elements.tipo.value, fecha: f.elements.fecha.value }, { hoy: hoyLocal() });
  if (!r.ok) { window.Lectura.errores(f, r.errores); return; }
  const id = editando.id || `n${Date.now().toString(36)}`;
  docLibro(editando.libroId).update({ [`notas.${id}`]: Object.assign(r.doc, { creado: editando.creado || Date.now() }) }).catch(fallo);
  hoja.cerrar();
});
hoja.el.addEventListener("click", e => {
  const t = e.target.closest("[data-lnota-tipo]");
  if (t) {
    const f = hoja.el.querySelector("form");
    f.elements.tipo.value = t.dataset.lnotaTipo;
    hoja.el.querySelectorAll("[data-lnota-tipo]").forEach(b => { const on = b === t; b.classList.toggle("active", on); b.setAttribute("aria-checked", String(on)); });
    return;
  }
  if (e.target.closest("[data-lnota-borrar]") && editando && editando.id) {
    if (!confirm("¿Eliminar esta nota? No se puede deshacer.")) return;
    docLibro(editando.libroId).update({ [`notas.${editando.id}`]: firebase.firestore.FieldValue.delete() }).catch(fallo);
    hoja.cerrar();
  }
});
hoja.el.addEventListener("input", e => {
  if (!e.target.classList.contains("is-error")) return;
  e.target.classList.remove("is-error");
  e.target.removeAttribute("aria-invalid");
  const f = e.target.form;
  if (f && !f.querySelector(".is-error")) f.querySelector(".lib-error").hidden = true;
});
document.addEventListener("click", e => {
  const nueva = e.target.closest("[data-lnota-nueva]");
  if (nueva) { abrir(nueva.dataset.lnotaNueva, null); return; }
  const n = e.target.closest("[data-lnota]");
  if (n && !hoja.el.contains(n)) abrir(n.dataset.lnota, n.dataset.lnotaId);
});

window.LibrosNotas = { ficha, abrir };
})();
