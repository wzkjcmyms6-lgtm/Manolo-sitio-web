// Ejercicio → Entrenamiento → Rutinas.
// Crear, editar, duplicar, reordenar y eliminar rutinas; plan semanal
// (qué rutina toca cada día) y "Hoy toca". Por cada ejercicio: series, rango
// de reps, peso objetivo, descanso, notas y subida de peso.
//
// Migración: las rutinas viejas ({ name, exercises: [nombres] }) se copian
// primero a meta/respaldo_rutinas_AAAA-MM-DD y después se les agregan los
// campos nuevos (3 series de 8-12, 90 s). La lista vieja de nombres se
// conserva en cada rutina.
(function () {
const R = EjRutinas;
const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };

let rutinas = [];          // normalizadas y ordenadas
let crudas = [];           // tal como están en Firestore (para el respaldo)
let plan = { dias: {} };
let migrando = false;
let editor = null;         // { id, name, orden, items }
let menuId = null;

function col() { return db.collection("users").doc(currentUser.uid).collection("rutinas"); }
function meta(nombre) { return db.collection("users").doc(currentUser.uid).collection("meta").doc(nombre); }
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Hojas ----
function abrirHoja(el) {
  el.hidden = false;
  el.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  renderIcons(el);
}
function cerrarHoja(el) {
  if (el.hidden) return;
  el.classList.add("is-closing");
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
}

// ---- Lista de rutinas ----
function diasDe(id) {
  return R.DIAS.filter(d => plan.dias && plan.dias[d.k] === id).map(d => d.corto);
}
function tarjetaRutina(r) {
  const dias = diasDe(r.id);
  const primeros = r.items.slice(0, 4);
  return `
    <article class="rut-card">
      <div class="rut-card-head">
        <div>
          <h3>${esc(r.name)}</h3>
          <p class="rut-card-meta">${r.items.length} ${r.items.length === 1 ? "ejercicio" : "ejercicios"} · ${R.totalSeries(r)} series${dias.length ? ` · <span class="rut-dias">${esc(dias.join(" · "))}</span>` : ""}</p>
        </div>
        <button type="button" class="rut-mas" data-rut-menu="${esc(r.id)}" aria-label="Opciones de ${esc(r.name)}"><span data-icon="menu"></span></button>
      </div>
      <ul class="rut-card-items">${primeros.map(it => `<li><span>${esc(it.nombre)}</span><small>${esc(R.resumenItem(it))}</small></li>`).join("")}</ul>
      ${r.items.length > primeros.length ? `<p class="rut-card-mas">y ${r.items.length - primeros.length} más</p>` : ""}
      <button type="button" class="start-routine-btn" data-rut-empezar="${esc(r.id)}">Empezar rutina</button>
    </article>`;
}
function renderRutinas() {
  const cont = $("gym-routines");
  if (!cont) return;
  $("gym-routines-empty").hidden = rutinas.length > 0;
  cont.innerHTML = rutinas.map(tarjetaRutina).join("");
  renderIcons(cont);
  renderHoy();
  renderPlan();
}
function renderHoy() {
  const el = $("rut-hoy");
  const r = R.rutinaDelDia(plan, rutinas, hoyIso());
  el.hidden = !r;
  if (!r) { el.innerHTML = ""; return; }
  const dia = R.DIAS.find(d => d.k === String(new Date().getDay()));
  el.innerHTML = `
    <div><span class="rut-hoy-eyebrow">Hoy, ${esc(dia.nombre.toLowerCase())}, toca</span>
    <strong>${esc(r.name)}</strong><small>${r.items.length} ejercicios · ${R.totalSeries(r)} series</small></div>
    <button type="button" class="rut-hoy-btn" data-rut-empezar="${esc(r.id)}">Empezar</button>`;
}
function renderPlan() {
  const el = $("rut-plan");
  if (!el) return;
  if (!rutinas.length) { el.innerHTML = ""; return; }
  const hoy = String(new Date().getDay());
  el.innerHTML = `
    <h2 id="rut-plan-t">Plan semanal</h2>
    <p class="rut-plan-sub">Elige qué rutina toca cada día.</p>
    <div class="rut-plan-dias">${R.DIAS.map(d => `
      <label class="rut-plan-dia${d.k === hoy ? " is-hoy" : ""}">
        <span>${esc(d.nombre)}${d.k === hoy ? " <small>hoy</small>" : ""}</span>
        <select data-rut-dia="${d.k}" aria-label="Rutina del ${esc(d.nombre.toLowerCase())}">
          <option value="">Descanso</option>
          ${rutinas.map(r => `<option value="${esc(r.id)}"${plan.dias && plan.dias[d.k] === r.id ? " selected" : ""}>${esc(r.name)}</option>`).join("")}
        </select>
      </label>`).join("")}</div>`;
}

// ---- Editor ----
const DESCANSOS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const SUBIDAS = [null, 0.5, 1, 1.25, 2, 2.5, 5];
function opcionesDescanso(v) {
  const lista = DESCANSOS.includes(v) ? DESCANSOS : DESCANSOS.concat([v]).sort((a, b) => a - b);
  return lista.map(s => `<option value="${s}"${s === v ? " selected" : ""}>${s ? R.descansoTxt(s) : "Sin descanso"}</option>`).join("");
}
function opcionesSubida(v) {
  const lista = SUBIDAS.includes(v) ? SUBIDAS : SUBIDAS.concat([v]);
  return lista.map(x => `<option value="${x == null ? "" : x}"${x === v ? " selected" : ""}>${x == null ? "Automática" : `+${String(x).replace(".", ",")} kg`}</option>`).join("");
}
function itemHTML(it, i, total) {
  const n = i + 1;
  return `
    <fieldset class="rut-item" data-rut-item="${i}">
      <legend class="visually-hidden">Ejercicio ${n}</legend>
      <div class="rut-item-top">
        <span class="rut-item-n" aria-hidden="true">${n}</span>
        <div class="rut-item-nombre">
          <input type="text" class="rut-in-nombre" value="${esc(it.nombre)}" placeholder="Buscar ejercicio" aria-label="Ejercicio ${n}" maxlength="80">
        </div>
        <div class="rut-item-mover">
          <button type="button" data-rut-mover="-1" aria-label="Subir ejercicio ${n}"${i === 0 ? " disabled" : ""}><span data-icon="chevronUp"></span></button>
          <button type="button" data-rut-mover="1" aria-label="Bajar ejercicio ${n}"${i === total - 1 ? " disabled" : ""}><span data-icon="chevronDown"></span></button>
          <button type="button" data-rut-quitar aria-label="Quitar ejercicio ${n}"><span data-icon="close"></span></button>
        </div>
      </div>
      <div class="rut-item-nums">
        <label>Series<input type="number" class="rut-in" data-campo="series" inputmode="numeric" min="1" max="20" value="${it.series}"></label>
        <label>Reps mín<input type="number" class="rut-in" data-campo="repsMin" inputmode="numeric" min="1" max="100" value="${it.repsMin}"></label>
        <label>Reps máx<input type="number" class="rut-in" data-campo="repsMax" inputmode="numeric" min="1" max="100" value="${it.repsMax}"></label>
        <label>Peso (kg)<input type="number" class="rut-in" data-campo="peso" inputmode="decimal" min="0" step="0.5" value="${it.peso == null ? "" : it.peso}" placeholder="—"></label>
      </div>
      <div class="rut-item-sel">
        <label>Descanso<select class="rut-in" data-campo="descansoSeg">${opcionesDescanso(it.descansoSeg)}</select></label>
        <label>Subida de peso<select class="rut-in" data-campo="incremento">${opcionesSubida(it.incremento)}</select></label>
      </div>
      <label class="rut-item-notas">Notas<input type="text" class="rut-in" data-campo="notas" maxlength="200" value="${esc(it.notas)}" placeholder="Ej: pausa abajo, agarre cerrado"></label>
    </fieldset>`;
}
function renderEditor() {
  const cont = $("rut-items");
  cont.innerHTML = editor.items.map((it, i) => itemHTML(it, i, editor.items.length)).join("");
  cont.querySelectorAll(".rut-in-nombre").forEach(input => {
    const i = Number(input.closest("[data-rut-item]").dataset.rutItem);
    ExercisePicker.adjuntar(input, {
      alElegir: f => { input.value = f.nombre; editor.items[i].nombre = f.nombre; editor.items[i].exerciseId = f.id; },
      alCrear: nombre => ExerciseCreator.abrir({ nombre, alGuardar: f => { input.value = f.nombre; editor.items[i].nombre = f.nombre; editor.items[i].exerciseId = f.id; } })
    });
  });
  renderIcons(cont);
}
function abrirEditor(r) {
  editor = r
    ? { id: r.id, name: r.name, orden: r.orden, items: r.items.map(it => Object.assign({}, it)) }
    : { id: null, name: "", orden: null, items: [R.item({}), R.item({})] };
  $("rut-editor-t").textContent = r ? "Editar rutina" : "Nueva rutina";
  $("rut-nombre").value = editor.name;
  $("rut-error").hidden = true;
  renderEditor();
  abrirHoja($("rut-editor"));
  if (!r) setTimeout(() => $("rut-nombre").focus(), 250);
}
function cerrarEditor() {
  cerrarHoja($("rut-editor"));
  editor = null;
}
function errorEditor(msg, foco) {
  const el = $("rut-error");
  el.textContent = msg;
  el.hidden = false;
  if (foco) foco.focus();
}
$("rut-items").addEventListener("input", e => {
  const t = e.target;
  const fila = t.closest("[data-rut-item]");
  if (!fila || !editor) return;
  const it = editor.items[Number(fila.dataset.rutItem)];
  if (t.classList.contains("rut-in-nombre")) {
    // Si escribe otro nombre a mano, deja de estar ligado a la ficha elegida.
    if (t.value.trim() !== it.nombre) it.exerciseId = null;
    it.nombre = t.value;
    return;
  }
  const campo = t.dataset.campo;
  if (campo) it[campo] = t.value;
});
$("rut-items").addEventListener("change", e => {
  const t = e.target;
  const fila = t.closest("[data-rut-item]");
  if (fila && editor && t.dataset.campo) editor.items[Number(fila.dataset.rutItem)][t.dataset.campo] = t.value;
});
$("rut-items").addEventListener("click", e => {
  const fila = e.target.closest("[data-rut-item]");
  if (!fila || !editor) return;
  const i = Number(fila.dataset.rutItem);
  const mover = e.target.closest("[data-rut-mover]");
  if (mover) {
    const j = i + Number(mover.dataset.rutMover);
    if (j < 0 || j >= editor.items.length) return;
    [editor.items[i], editor.items[j]] = [editor.items[j], editor.items[i]];
    renderEditor();
    const b = $("rut-items").querySelector(`[data-rut-item="${j}"] [data-rut-mover="${mover.dataset.rutMover}"]`);
    if (b && !b.disabled) b.focus();
    return;
  }
  if (e.target.closest("[data-rut-quitar]")) {
    editor.items.splice(i, 1);
    renderEditor();
  }
});
$("rut-agregar").addEventListener("click", () => {
  if (!editor) return;
  editor.items.push(R.item({}));
  renderEditor();
  const inputs = $("rut-items").querySelectorAll(".rut-in-nombre");
  const ultimo = inputs[inputs.length - 1];
  if (ultimo) { ultimo.scrollIntoView({ block: "center" }); ultimo.focus(); }
});
$("rut-nombre").addEventListener("input", e => { if (editor) editor.name = e.target.value; });
$("rut-form").addEventListener("submit", e => {
  e.preventDefault();
  if (!editor) return;
  const name = editor.name.trim();
  if (!name) { errorEditor("Ponle un nombre a la rutina.", $("rut-nombre")); return; }
  const items = editor.items.filter(it => String(it.nombre || "").trim());
  if (!items.length) { errorEditor("Agrega al menos un ejercicio."); return; }
  const malo = items.findIndex(it => Number(it.repsMin) > Number(it.repsMax) && it.repsMax !== "");
  if (malo >= 0) { errorEditor(`En «${items[malo].nombre}», las reps mínimas son más que las máximas.`); return; }
  const orden = editor.orden != null ? editor.orden : Math.max(0, ...rutinas.map(r => r.orden || 0)) + 1;
  const datos = R.aGuardar({ name, orden, items });
  const ref = editor.id ? col().doc(editor.id) : col().doc();
  ref.set(datos).catch(err => console.error("Manolo: no se pudo guardar la rutina", err));
  cerrarEditor();
});
$("rut-cancelar").addEventListener("click", cerrarEditor);
$("rut-editor-cerrar").addEventListener("click", cerrarEditor);
$("rut-editor").querySelector(".budget-sheet-overlay").addEventListener("click", cerrarEditor);
$("rut-nueva").addEventListener("click", () => abrirEditor(null));

// ---- Menú de una rutina ----
function abrirMenu(id) {
  const r = rutinas.find(x => x.id === id);
  if (!r) return;
  menuId = id;
  $("rut-menu-t").textContent = r.name;
  const i = rutinas.indexOf(r);
  $("rut-menu").querySelector('[data-rut-accion="subir"]').disabled = i === 0;
  $("rut-menu").querySelector('[data-rut-accion="bajar"]').disabled = i === rutinas.length - 1;
  abrirHoja($("rut-menu"));
}
function cerrarMenu() { cerrarHoja($("rut-menu")); }
// Guarda el orden actual de todas (0, 1, 2…) en un solo lote.
function guardarOrden(lista) {
  const lote = db.batch();
  lista.forEach((r, i) => { if (r.orden !== i) lote.update(col().doc(r.id), { orden: i }); });
  lote.commit().catch(err => console.error("Manolo: no se pudo ordenar", err));
}
$("rut-menu").addEventListener("click", e => {
  const b = e.target.closest("[data-rut-accion]");
  if (!b || b.disabled) return;
  const r = rutinas.find(x => x.id === menuId);
  cerrarMenu();
  if (!r) return;
  const accion = b.dataset.rutAccion;
  if (accion === "editar") { setTimeout(() => abrirEditor(r), 220); return; }
  if (accion === "duplicar") {
    // La copia queda justo debajo de la original.
    const i = rutinas.indexOf(r);
    const ref = col().doc();
    const lista = rutinas.slice();
    lista.splice(i + 1, 0, { id: ref.id });
    const lote = db.batch();
    lote.set(ref, R.aGuardar({ name: R.nombreCopia(r.name, rutinas.map(x => x.name)), items: r.items, orden: i + 1 }));
    lista.forEach((x, k) => { if (x.id !== ref.id && x.orden !== k) lote.update(col().doc(x.id), { orden: k }); });
    lote.commit().catch(err => console.error("Manolo: no se pudo duplicar", err));
    return;
  }
  if (accion === "subir" || accion === "bajar") {
    const lista = rutinas.slice();
    const i = lista.indexOf(r), j = i + (accion === "subir" ? -1 : 1);
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    guardarOrden(lista);
    return;
  }
  if (accion === "eliminar") {
    if (!confirm(`¿Eliminar la rutina «${r.name}»? Tus entrenamientos hechos con ella no se borran.`)) return;
    col().doc(r.id).delete();
    // Si estaba en el plan semanal, ese día queda de descanso.
    const dias = Object.assign({}, plan.dias || {});
    let cambio = false;
    Object.keys(dias).forEach(k => { if (dias[k] === r.id) { dias[k] = null; cambio = true; } });
    if (cambio) meta("plan_semanal").set({ dias }, { merge: true });
  }
});
$("rut-menu-cerrar").addEventListener("click", cerrarMenu);
$("rut-menu").querySelector(".budget-sheet-overlay").addEventListener("click", cerrarMenu);
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("rut-menu").hidden) cerrarMenu();
  else if (!$("rut-editor").hidden) cerrarEditor();
});

// ---- Botones de la lista y plan ----
$("gym-home").addEventListener("click", e => {
  const emp = e.target.closest("[data-rut-empezar]");
  if (emp) {
    const r = rutinas.find(x => x.id === emp.dataset.rutEmpezar);
    if (r) Gimnasio.empezarRutina(r);
    return;
  }
  const m = e.target.closest("[data-rut-menu]");
  if (m) abrirMenu(m.dataset.rutMenu);
});
$("gym-home").addEventListener("change", e => {
  const sel = e.target.closest("[data-rut-dia]");
  if (!sel) return;
  const dias = Object.assign({}, plan.dias || {});
  dias[sel.dataset.rutDia] = sel.value || null;
  plan = { dias };
  meta("plan_semanal").set({ dias }, { merge: true }).catch(err => console.error("Manolo: no se pudo guardar el plan", err));
  renderRutinas();
});

// ---- Migración de las rutinas viejas ----
function migrar(docs) {
  if (migrando) return;
  const viejas = docs.filter(d => !Array.isArray(d.data().items));
  if (!viejas.length) return;
  migrando = true;
  const respaldo = { creado: Date.now(), rutinas: docs.map(d => Object.assign({ id: d.id }, d.data())) };
  meta("respaldo_rutinas_" + hoyIso()).set(respaldo)
    .then(() => {
      const lote = db.batch();
      const lista = R.ordenar(docs.map(d => R.normalizar(Object.assign({ id: d.id }, d.data()))));
      lista.forEach((r, i) => {
        const doc = docs.find(d => d.id === r.id);
        if (Array.isArray(doc.data().items)) return;
        lote.update(col().doc(r.id), { items: r.items, orden: r.orden != null ? r.orden : i, v: 2 });
      });
      return lote.commit();
    })
    .catch(err => { console.error("Manolo: no se pudo actualizar las rutinas", err); migrando = false; });
}

onAuthReady(() => {
  col().onSnapshot({ includeMetadataChanges: true }, snap => {
    crudas = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    rutinas = R.ordenar(crudas.map(R.normalizar));
    renderRutinas();
    if (!(snap.metadata && snap.metadata.fromCache)) migrar(snap.docs);
  });
  meta("plan_semanal").onSnapshot(doc => {
    plan = doc.exists ? Object.assign({ dias: {} }, doc.data()) : { dias: {} };
    renderRutinas();
  });
});

// Para el respaldo y la importación desde Excel (fase 5).
window.RutinasUI = {
  crudas: () => crudas,
  plan: () => plan,
  rutinas: () => rutinas
};
})();
