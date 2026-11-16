// ---------- Rutinas de Running: crear y editar en la app (pantalla) ----------
// En Running › Rutinas guiadas: "＋ Nueva" y el menú ⋯ de cada rutina
// (Editar, Duplicar, Hacer la siguiente, Eliminar). El editor arma la
// rutina con pasos: intervalos sueltos (tipo, minutos y segundos, nota) y
// series que se repiten ("Repetir 4 veces: correr 1:00 + caminar 1:30").
// Guarda en users/{uid}/rutinas_running lo de siempre (intervalos,
// totalSeg, la rutina en vivo no cambia) más los pasos («bloques»).
// Un día de un plan: el nombre es el del plan (cambia en todos sus días) y
// "Duplicar" crea un día nuevo al final del plan.
// Lógica en js/rutina-running-editor.js; ver docs/CSV_ROUTINES.md (D-124).
(function () {
const E = window.RREditor, RR = window.RutinaRunning;
if (!E || !RR || !window.RutinasRunning) return;
const TIPOS = [["caminar", "Caminar"], ["trotar", "Trotar"], ["correr", "Correr"], ["descanso", "Descanso"]];
const col = () => db.collection("users").doc(currentUser.uid).collection("rutinas_running");
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Hojas (las de siempre: se cierran con ✕, tocando fuera o deslizando).
let hojaEd = null, hojaMenu = null;
const hEd = () => hojaEd || (hojaEd = iniciarEditor(window.Lectura.hoja("rre-hoja")));
const hMenu = () => hojaMenu || (hojaMenu = iniciarMenu(window.Lectura.hoja("rre-menu")));

// ---- Aviso corto ("Rutina guardada") ----
let toast = null, toastT = null;
function aviso(texto) {
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "undo-toast rre-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `<span class="undo-toast-msg"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector(".undo-toast-msg").textContent = texto;
  toast.hidden = false;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => { toast.classList.remove("show"); toast.hidden = true; }, 2600);
}

// ---- Editor ----
let ed = null;   // { id, plan, dia, nombreAntes, nombre, bloques }

function filaHTML(x, pos, etiqueta, primero, ultimo) {
  const p = E.partes(x.seg);
  return `
    <li class="rre-int" data-pos="${pos}">
      <div class="rre-l1">
        <select class="lib-input rre-tipo is-${x.tipo}" data-campo="tipo" aria-label="Tipo de ${etiqueta}">
          ${TIPOS.map(([v, t]) => `<option value="${v}"${v === x.tipo ? " selected" : ""}>${t}</option>`).join("")}
        </select>
        <span class="rre-dur" role="group" aria-label="Duración de ${etiqueta}">
          <input type="number" class="lib-input" data-campo="min" inputmode="numeric" min="0" max="120" value="${p.min}" aria-label="Minutos de ${etiqueta}"><span aria-hidden="true">min</span>
          <input type="number" class="lib-input" data-campo="seg" inputmode="numeric" min="0" max="59" value="${String(p.seg).padStart(2, "0")}" aria-label="Segundos de ${etiqueta}"><span aria-hidden="true">s</span>
        </span>
      </div>
      <div class="rre-l2">
        <input type="text" class="lib-input rre-nota" data-campo="texto" maxlength="${RR.LIMITES.texto}" value="${esc(x.texto)}" placeholder="Nota (opcional)" aria-label="Nota de ${etiqueta}">
        <button type="button" class="rre-ic" data-rre="subir" aria-label="Subir ${etiqueta}"${primero ? " disabled" : ""}><span data-icon="chevronUp"></span></button>
        <button type="button" class="rre-ic" data-rre="bajar" aria-label="Bajar ${etiqueta}"${ultimo ? " disabled" : ""}><span data-icon="chevronDown"></span></button>
        <button type="button" class="rre-ic" data-rre="quitar" aria-label="Quitar ${etiqueta}"><span data-icon="close"></span></button>
      </div>
    </li>`;
}
function serieHTML(b, i, primero, ultimo) {
  const n = i + 1;
  return `
    <li class="rre-serie" data-pos="${i}">
      <div class="rre-serie-cab">
        <span class="rre-serie-t">Repetir</span>
        <button type="button" class="rre-ic rre-menos" data-rre="menos" aria-label="Una vez menos"${b.repetir <= 1 ? " disabled" : ""}>−</button>
        <input type="number" class="lib-input rre-veces" data-campo="repetir" inputmode="numeric" min="1" max="${E.REPETIR_MAX}" value="${b.repetir}" aria-label="Veces que se repite la serie del paso ${n}">
        <button type="button" class="rre-ic rre-mas" data-rre="mas" aria-label="Una vez más"${b.repetir >= E.REPETIR_MAX ? " disabled" : ""}>+</button>
        <span class="rre-serie-t">veces</span>
      </div>
      <ol class="rre-sub">${b.intervalos.map((x, j) => filaHTML(x, `${i}.${j}`, `el intervalo ${j + 1} de la serie del paso ${n}`, j === 0, j === b.intervalos.length - 1)).join("")}</ol>
      <div class="rre-serie-pie">
        <button type="button" class="link-btn rre-sub-mas" data-rre="sub"${b.intervalos.length >= E.SERIE_MAX ? " disabled" : ""}>＋ Intervalo en la serie</button>
        <span class="rre-serie-mover">
          <button type="button" class="rre-ic" data-rre="subir" aria-label="Subir la serie del paso ${n}"${primero ? " disabled" : ""}><span data-icon="chevronUp"></span></button>
          <button type="button" class="rre-ic" data-rre="bajar" aria-label="Bajar la serie del paso ${n}"${ultimo ? " disabled" : ""}><span data-icon="chevronDown"></span></button>
          <button type="button" class="rre-ic" data-rre="quitar" aria-label="Quitar la serie del paso ${n}"><span data-icon="close"></span></button>
        </span>
      </div>
    </li>`;
}
function pintarPasos() {
  const el = hEd().el;
  const lista = el.querySelector(".rre-pasos");
  const bs = ed.bloques;
  lista.innerHTML = bs.length
    ? bs.map((b, i) => (Array.isArray(b.intervalos) ? serieHTML(b, i, i === 0, i === bs.length - 1) : filaHTML(b, String(i), `el paso ${i + 1}`, i === 0, i === bs.length - 1))).join("")
    : `<li class="rre-vacio">Sin intervalos todavía: agrega uno abajo.</li>`;
  if (typeof renderIcons === "function") renderIcons(lista);
  pintarTotal();
}
function pintarTotal() {
  const el = hEd().el;
  el.querySelector(".rre-total").textContent = E.resumen(ed.bloques);
}
// "3" → { lista: ed.bloques, k: 3 } · "1.2" → { lista: serie 1, k: 2, serie }
function donde(pos) {
  const [a, b] = String(pos).split(".").map(Number);
  if (b == null || isNaN(b)) return { lista: ed.bloques, k: a, item: ed.bloques[a] };
  const serie = ed.bloques[a];
  return { lista: serie.intervalos, k: b, item: serie.intervalos[b], serie, i: a };
}
function limpiarError() {
  const el = hEd().el;
  el.querySelector(".rre-error").hidden = true;
  el.querySelectorAll(".is-mal").forEach(x => x.classList.remove("is-mal"));
  el.querySelectorAll("[aria-invalid]").forEach(x => x.removeAttribute("aria-invalid"));
}

function abrirEditor(r) {
  const plan = !!(r && r.plan);
  ed = r
    ? { id: r.id, plan: r.plan || null, dia: r.dia || null, nombreAntes: r.nombre || "", nombre: r.nombre || "", bloques: E.bloquesDe(r) }
    : { id: null, plan: null, dia: null, nombreAntes: "", nombre: "", bloques: E.nueva() };
  const titulo = !r ? "Nueva rutina" : plan ? `Editar ${RR.nombreCompleto(r)}` : "Editar rutina";
  hEd().abrir(titulo, `
    <form class="rre-form" novalidate>
      <label class="lib-campo"><span>${plan ? "Nombre del plan (cambia en todos sus días)" : "Nombre"}</span>
        <input type="text" class="lib-input" data-rre-nombre maxlength="${RR.LIMITES.nombre}" value="${esc(ed.nombre)}" placeholder="Ej: Series de 1 minuto" autocomplete="off"></label>
      <p class="rre-ayuda">La rutina va en orden, de arriba abajo. Una <b>serie</b> repite sus intervalos las veces que digas.</p>
      <ol class="rre-pasos"></ol>
      <div class="rre-agregar">
        <button type="button" class="lib-btn-sec" data-rre="intervalo">＋ Intervalo</button>
        <button type="button" class="lib-btn-sec" data-rre="serie">＋ Serie que se repite</button>
      </div>
      <div class="rre-pie">
        <p class="rre-error lib-error" role="alert" hidden></p>
        <p class="rre-total" aria-live="polite"></p>
        <div class="lib-acciones">
          <button type="button" class="lib-btn-sec" data-rre="cancelar">Cancelar</button>
          <button type="submit" class="lib-btn">${r ? "Guardar cambios" : "Guardar rutina"}</button>
        </div>
      </div>
    </form>`);
  pintarPasos();
  if (!r) setTimeout(() => { const n = hEd().el.querySelector("[data-rre-nombre]"); if (n && hEd().abierta()) n.focus(); }, 260);
}

function guardar() {
  limpiarError();
  const el = hEd().el;
  const nombre = (el.querySelector("[data-rre-nombre]").value || "").trim();
  const v = E.validar(nombre, ed.bloques);
  if (!v.ok) { mostrarError(v.errores[0]); return; }
  const datos = E.aGuardar(nombre, v);
  const lista = RutinasRunning.lista();
  const lote = db.batch();
  const ahora = Date.now();
  if (ed.id) {
    lote.update(col().doc(ed.id), Object.assign({}, datos, { editado: ahora }));
    // El nombre de un plan es el de todos sus días.
    if (ed.plan && datos.nombre !== ed.nombreAntes) {
      lista.filter(x => x.plan === ed.plan && x.id !== ed.id).forEach(x => lote.update(col().doc(x.id), { nombre: datos.nombre, editado: ahora }));
    }
  } else {
    lote.set(col().doc(), Object.assign({}, datos, { creado: ahora, orden: RR.ordenAlFinal(lista) }));
  }
  const nueva = !ed.id;
  lote.commit().catch(err => { console.error("Manolo: no se pudo guardar la rutina", err); alert("No se pudo guardar la rutina."); });
  hEd().cerrar();
  ed = null;
  aviso(nueva ? `✓ «${datos.nombre}» quedó al final de tu lista` : "✓ Cambios guardados");
}
function mostrarError(e) {
  const el = hEd().el;
  const p = el.querySelector(".rre-error");
  p.textContent = e.texto;
  p.hidden = false;
  let foco = null;
  if (e.campo === "nombre") foco = el.querySelector("[data-rre-nombre]");
  else if (e.paso != null) {
    const fila = el.querySelector(`[data-pos="${e.sub != null ? `${e.paso}.${e.sub}` : e.paso}"]`);
    if (fila) {
      fila.classList.add("is-mal");
      foco = e.campo === "dur" ? fila.querySelector('[data-campo="min"]') : e.campo === "veces" ? fila.querySelector('[data-campo="repetir"]') : null;
      if (!foco) fila.scrollIntoView({ block: "center" });
    }
  }
  if (foco) {
    foco.setAttribute("aria-invalid", "true");
    foco.classList.add("is-mal");
    foco.scrollIntoView({ block: "center" });
    foco.focus({ preventScroll: true });
  }
}

function iniciarEditor(h) {
  h.el.classList.add("rre-raiz");
  h.el.addEventListener("submit", e => { e.preventDefault(); if (ed) guardar(); });
  h.el.addEventListener("input", e => {
    if (!ed) return;
    const t = e.target;
    // Al corregir, el aviso de error se va (se revisa otra vez al guardar).
    if (!h.el.querySelector(".rre-error").hidden) limpiarError();
    if (t.matches("[data-rre-nombre]")) { ed.nombre = t.value; return; }
    const fila = t.closest("[data-pos]");
    const campo = t.dataset.campo;
    if (!fila || !campo) return;
    const d = donde(fila.dataset.pos);
    if (!d.item) return;
    if (campo === "min" || campo === "seg") {
      const s = E.segDe(fila.querySelector('[data-campo="min"]').value, fila.querySelector('[data-campo="seg"]').value);
      d.item.seg = isFinite(s) ? s : 0;
    } else if (campo === "texto") d.item.texto = t.value;
    else if (campo === "repetir") {
      d.item.repetir = Math.round(Number(t.value) || 0);
      fila.querySelector('[data-rre="menos"]').disabled = d.item.repetir <= 1;
      fila.querySelector('[data-rre="mas"]').disabled = d.item.repetir >= E.REPETIR_MAX;
    }
    pintarTotal();
  });
  h.el.addEventListener("change", e => {
    if (!ed) return;
    const t = e.target;
    if (t.dataset.campo !== "tipo") return;
    const d = donde(t.closest("[data-pos]").dataset.pos);
    if (!d.item) return;
    d.item.tipo = t.value;
    TIPOS.forEach(([v]) => t.classList.toggle(`is-${v}`, v === t.value));
  });
  h.el.addEventListener("click", e => {
    const b = e.target.closest("[data-rre]");
    if (!b || !ed || b.disabled) return;
    const a = b.dataset.rre;
    if (a === "cancelar") { h.cerrar(); ed = null; return; }
    limpiarError();
    let enfocar = null;   // [pos, acción] del botón para devolverle el foco
    if (a === "intervalo") {
      ed.bloques.push(E.siguientePaso(E.expandir(ed.bloques)));
      pintarPasos();
      const ult = h.el.querySelector(`.rre-pasos > [data-pos="${ed.bloques.length - 1}"]`);
      if (ult) ult.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (a === "serie") {
      ed.bloques.push({ repetir: 4, intervalos: [{ tipo: "correr", seg: 60, texto: "" }, { tipo: "caminar", seg: 90, texto: "" }] });
      pintarPasos();
      const ult = h.el.querySelector(`.rre-pasos > [data-pos="${ed.bloques.length - 1}"]`);
      if (ult) ult.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const fila = b.closest("[data-pos]");
    if (!fila) return;
    const pos = fila.dataset.pos;
    const d = donde(pos);
    if (a === "menos" || a === "mas") {
      d.item.repetir = Math.max(1, Math.min(E.REPETIR_MAX, (Math.round(Number(d.item.repetir)) || 1) + (a === "mas" ? 1 : -1)));
      enfocar = [pos, a];
    } else if (a === "sub") {
      d.item.intervalos.push(E.siguientePaso(d.item.intervalos));
    } else if (a === "subir" || a === "bajar") {
      const j = d.k + (a === "subir" ? -1 : 1);
      if (j < 0 || j >= d.lista.length) return;
      [d.lista[d.k], d.lista[j]] = [d.lista[j], d.lista[d.k]];
      enfocar = [d.serie ? `${d.i}.${j}` : String(j), a];
    } else if (a === "quitar") {
      d.lista.splice(d.k, 1);
      // Una serie que queda vacía se quita.
      if (d.serie && !d.serie.intervalos.length) ed.bloques.splice(d.i, 1);
    }
    pintarPasos();
    if (enfocar) {
      const btn = h.el.querySelector(`[data-pos="${enfocar[0]}"] [data-rre="${enfocar[1]}"]`);
      if (btn && !btn.disabled) btn.focus();
    }
  });
  return h;
}

// ---- Menú ⋯ de una rutina ----
let menuId = null;
function menu(id) {
  const r = RutinasRunning.obtener(id);
  if (!r) return;
  menuId = id;
  const lista = RutinasRunning.lista();
  const primera = lista.length && lista[0].id === id;
  hMenu().abrir(RR.nombreCompleto(r), `
    <div class="rut-menu-lista rre-menu">
      <button type="button" data-rre-accion="editar"><span data-icon="edit"></span>Editar</button>
      <button type="button" data-rre-accion="duplicar"><span data-icon="copy"></span>${r.plan ? "Duplicar como día nuevo del plan" : "Duplicar"}</button>
      <button type="button" data-rre-accion="primera"${primera ? " disabled" : ""}><span data-icon="chevronUp"></span>Hacer la siguiente</button>
      <button type="button" data-rre-accion="eliminar" class="is-peligro"><span data-icon="trash"></span>Eliminar</button>
    </div>`);
}
function iniciarMenu(h) {
  h.el.addEventListener("click", e => {
    const b = e.target.closest("[data-rre-accion]");
    if (!b || b.disabled) return;
    const r = RutinasRunning.obtener(menuId);
    h.cerrar();
    if (!r) return;
    const accion = b.dataset.rreAccion;
    const lista = RutinasRunning.lista();
    if (accion === "editar") setTimeout(() => abrirEditor(r), 220);
    else if (accion === "duplicar") {
      const datos = Object.assign(E.copia(r, lista), { creado: Date.now(), orden: E.ordenDespues(lista, r.id) });
      col().doc().set(datos).catch(err => console.error("Manolo: no se pudo duplicar la rutina", err));
      aviso(r.plan ? `✓ Día ${datos.dia} agregado a «${datos.nombre}»` : `✓ Copia creada: «${datos.nombre}»`);
    } else if (accion === "primera") {
      col().doc(r.id).update({ orden: E.ordenPrimero(lista) }).catch(err => console.error("Manolo: no se pudo mover la rutina", err));
      aviso("✓ Ahora es la siguiente");
    } else if (accion === "eliminar") setTimeout(() => RutinasRunning.borrar(r.id), 220);
  });
  return h;
}

window.RREditorUI = {
  nueva: () => abrirEditor(null),
  editar: id => { const r = RutinasRunning.obtener(id); if (r) abrirEditor(r); },
  menu
};
})();
