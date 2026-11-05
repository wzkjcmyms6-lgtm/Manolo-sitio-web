// ---------- Hábitos: gestión de categorías (pantallas) ----------
// Hojas para crear, editar, ordenar, archivar y asignar categorías. La
// lógica (validar, ids, orden, asignar en lote) está en
// js/habitos-categorias.js; los datos y las hojas, en js/habitos.js
// (window.HabitosApp). Las categorías se guardan en
// meta/habitos_juego.categorias y cada hábito guarda el id en `area`.
(function () {
const A = window.HabitosApp;
const HCat = HabitosCategorias;
if (!A || !HCat) return;
const esc = s => A.escapeHtml(s);

// Emojis para una categoría (además, se puede escribir cualquiera).
const EMOJIS = ["💪", "🧠", "💰", "💼", "🌿", "🤝", "🙏", "📚", "💆", "🏠", "🏃", "🍎", "💧", "😴", "🧘", "✍️", "🎯", "🎨",
  "🎸", "🎵", "📷", "🎮", "⚽", "✈️", "🌱", "🐶", "🧹", "🛒", "💊", "❤️", "⭐", "🔥", "☀️", "🌙", "🧩", "🎓", "💡", "🔧", "🚗", "👨‍👩‍👧"];

let edicion = null;   // { id|null, nombre, emoji, color, volverA: "form"|"lista" }
let asignacion = null; // { ids:Set, area, volverA }

const habitos = () => Object.keys(A.estado().normal).map(id => A.estado().normal[id]);
const cuentaTxt = n => A.plural(n, "hábito", "hábitos");

// ---------- Lista de categorías ----------
function hojaLista() {
  const todas = A.areasDef();
  const act = HCat.activas(todas), arch = todas.filter(c => c.archivada);
  const hs = habitos();
  const sinCat = hs.filter(h => !h.archivado && !HCat.deHabito(h, act)).length;
  const sug = HCat.sugeridas(todas, A.estado().juego).filter(() => act.length < HCat.MAX);
  A.abrirHoja(A.cabecera("Hábitos", "Categorías", `${act.length} de ${HCat.MAX}`) + `
    <ul class="hb-orden hb-cats">${act.map((c, i) => {
      const u = HCat.usos(c.id, hs);
      return `<li class="hb-orden-item" style="--cat:${HCat.colorDe(c)}" data-cat-id="${c.id}">
        <button type="button" class="hb-cat-fila" data-cat-editar="${c.id}" aria-label="Editar ${esc(c.nombre)}">
          <span class="hb-cat-emoji" aria-hidden="true">${esc(c.emoji)}</span>
          <span class="hb-orden-txt"><span class="hb-nombre">${esc(c.nombre)}</span><span class="hb-sub">${cuentaTxt(u.activos)}</span></span>
        </button>
        <button type="button" class="hb-orden-flecha" data-cat-mover="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir ${esc(c.nombre)}">↑</button>
        <button type="button" class="hb-orden-flecha" data-cat-mover="1" ${i === act.length - 1 ? "disabled" : ""} aria-label="Bajar ${esc(c.nombre)}">↓</button>
      </li>`;
    }).join("")}</ul>
    <div class="hb-chips hb-cats-acciones">
      <button type="button" class="hb-btn" data-cat-nueva="lista" ${act.length >= HCat.MAX ? "disabled" : ""}>+ Nueva categoría</button>
      <button type="button" class="hb-btn-sec" data-cat-asignar>Asignar categorías${sinCat ? ` · ${sinCat} sin categoría` : ""}</button>
    </div>
    ${sug.length ? `<h4 class="hb-sub-t">Sugeridas</h4>
      <p class="hb-texto">Encajan con lo que ya usas en Manolo. Tócala para crearla.</p>
      <div class="hb-chips">${sug.map(c => `<button type="button" class="hb-chip hb-chip-cat" style="--cat:${HCat.colorDe(c)}" data-cat-sugerida="${c.id}">+ ${esc(c.emoji)} ${esc(c.nombre)}</button>`).join("")}</div>` : ""}
    ${arch.length ? `<h4 class="hb-sub-t">Archivadas</h4>
      <p class="hb-texto">Su historial sigue en tus estadísticas.</p>
      <ul class="hb-pausas">${arch.map(c => `<li style="--cat:${HCat.colorDe(c)}"><span>${esc(c.emoji)} ${esc(c.nombre)}</span>
        <span class="hb-chips"><button type="button" class="hb-btn-sec" data-cat-restaurar="${c.id}">Restaurar</button></span></li>`).join("")}</ul>` : ""}
    <div class="hb-acciones"><button type="button" class="hb-btn-sec" data-cat-volver-ajustes>Volver a Ajustes</button></div>`, { tipo: "categorias" });
}

function mover(id, paso) {
  const act = HCat.activas(A.areasDef());
  const ids = act.map(c => c.id);
  const i = ids.indexOf(id), j = i + paso;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  // Las archivadas van después, en su orden.
  A.guardarCategorias(HCat.reordenar(A.areasDef(), ids));
  A.actualizar();
  hojaLista();
  const btn = document.querySelector(`.hb-sheet [data-cat-id="${id}"] [data-cat-mover="${paso}"]`) || document.querySelector(`.hb-sheet [data-cat-id="${id}"] .hb-cat-fila`);
  if (btn) btn.focus();
}

// ---------- Crear o editar ----------
function abrirEditor(id, volverA, base) {
  const c = id ? A.areasDef().find(x => x.id === id) : null;
  edicion = c ? { id, nombre: c.nombre, emoji: c.emoji, color: c.color, volverA }
    : Object.assign({ id: null, nombre: "", emoji: "🏷️", color: HCat.siguienteColor(A.areasDef()), volverA }, base || {});
  hojaEditor();
}
function hojaEditor(error) {
  const e = edicion;
  const c = e.id ? A.areasDef().find(x => x.id === e.id) : null;
  const u = e.id ? HCat.usos(e.id, habitos()) : null;
  const propio = EMOJIS.includes(e.emoji) ? "" : e.emoji;
  A.abrirHoja(A.cabecera("Categorías", e.id ? "Editar categoría" : "Nueva categoría") + `
    <form class="hb-form hb-cat-form" novalidate>
      <div class="hb-cat-vista" style="--cat:${HCat.colorDe(e.color)}"><span aria-hidden="true">${esc(e.emoji)}</span><b>${esc(e.nombre || "Nombre")}</b></div>
      <label class="hb-campo">Nombre
        <input type="text" name="catNombre" maxlength="${HCat.NOMBRE_MAX}" value="${esc(e.nombre)}" placeholder="Ej: Música" autocomplete="off" required></label>
      <span class="hb-label">Color</span>
      <div class="hb-colores" role="radiogroup" aria-label="Color">${HCat.PALETA.map(p =>
        `<button type="button" class="hb-color${p.id === e.color ? " is-on" : ""}" style="--cat:${p.color}" data-cat-color="${p.id}" role="radio" aria-checked="${p.id === e.color}" aria-label="${p.nombre}"></button>`).join("")}</div>
      <span class="hb-label">Emoji</span>
      <div class="hb-emojis">${EMOJIS.map(x => `<button type="button" class="hb-emoji-btn${x === e.emoji ? " is-on" : ""}" data-cat-emoji="${x}" aria-pressed="${x === e.emoji}">${x}</button>`).join("")}</div>
      <label class="hb-campo hb-emoji-propio"><span>¿Otro? Escríbelo <span class="hb-opcional">(teclado de emojis)</span></span>
        <input type="text" name="catEmoji" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(propio)}" placeholder="🙂"></label>
      <p class="hb-error"${error ? "" : " hidden"}>${error ? esc(error) : ""}</p>
      ${c ? `<div class="hb-cat-peligro">${u.activos
        ? `<p class="hb-texto">La usan ${cuentaTxt(u.activos)} activos. Para archivarla, primero pásalos a otra categoría.</p>
           <button type="button" class="hb-btn-sec" data-cat-asignar-de="${c.id}">Cambiar sus hábitos</button>`
        : HCat.puedeBorrar(c.id, habitos())
          ? `<button type="button" class="hb-btn-sec is-peligro" data-cat-borrar="${c.id}"><span data-icon="trash"></span>Eliminar</button>`
          : `<button type="button" class="hb-btn-sec" data-cat-archivar="${c.id}">Archivar</button>
             <p class="hb-texto">Tiene historial, así que se archiva: sigue en tus estadísticas.</p>`}</div>` : ""}
      <div class="hb-acciones hb-acciones-fijas">
        <button type="button" class="hb-btn-sec" data-cat-cancelar>Cancelar</button>
        <button type="submit" class="hb-btn">${e.id ? "Guardar" : "Crear categoría"}</button>
      </div>
    </form>`, { tipo: "categoria", id: e.id || "nueva" });
}
function leerEditor() {
  const hoja = document.querySelector(".hb-sheet");
  const n = hoja && hoja.querySelector('[name="catNombre"]');
  const em = hoja && hoja.querySelector('[name="catEmoji"]');
  if (n) edicion.nombre = n.value;
  if (em && em.value.trim()) edicion.emoji = primerEmoji(em.value);
}
function primerEmoji(t) {
  const s = String(t || "").trim();
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const it = new Intl.Segmenter("es", { granularity: "grapheme" }).segment(s)[Symbol.iterator]().next();
    return it.done ? "" : it.value.segment;
  }
  return Array.from(s).slice(0, 2).join("");
}
function guardarEditor() {
  leerEditor();
  const e = edicion;
  const lista = A.areasDef();
  if (e.id) {
    const r = HCat.editar(lista, e.id, { nombre: e.nombre, emoji: e.emoji, color: e.color });
    if (!r.ok) { hojaEditor(r.error); return; }
    A.guardarCategorias({ [e.id]: r.cambios });
    A.toast("Categoría guardada.");
    A.actualizar();
    salir(e.id);
    return;
  }
  const r = HCat.crear(lista, { nombre: e.nombre, emoji: e.emoji, color: e.color, id: e.sugerida }, A.estado().juego, Date.now());
  if (!r.ok) { hojaEditor(r.error); return; }
  A.guardarCategorias({ [r.id]: r.doc });
  A.toast(`Creaste la categoría «${r.doc.nombre}».`);
  A.actualizar();
  salir(r.id);
}
// Vuelve a donde se abrió: el formulario del hábito (con la categoría ya
// elegida) o la lista de categorías.
function salir(id) {
  const volver = edicion ? edicion.volverA : "lista";
  edicion = null;
  if (volver === "form") A.volverAlForm(id);
  else hojaLista();
}
function archivar(id) {
  if (HCat.usos(id, habitos()).activos) return;
  const c = A.areasDef().find(x => x.id === id);
  A.guardarCategorias({ [id]: { archivada: true } });
  A.toast(`Archivaste «${c.nombre}». Su historial se conserva.`, () => { A.guardarCategorias({ [id]: { archivada: false } }); A.actualizar(); });
  A.actualizar();
  edicion = null;
  hojaLista();
}
function borrar(id) {
  if (!HCat.puedeBorrar(id, habitos())) return;
  const c = A.areasDef().find(x => x.id === id);
  A.guardarCategorias({ [id]: { borrada: true } });
  A.toast(`Eliminaste «${c.nombre}».`, () => { A.guardarCategorias({ [id]: { borrada: false } }); A.actualizar(); });
  A.actualizar();
  edicion = null;
  hojaLista();
}
function restaurar(id) {
  if (HCat.activas(A.areasDef()).length >= HCat.MAX) { A.toast(`Ya tienes ${HCat.MAX} categorías activas: archiva una primero.`); return; }
  A.guardarCategorias({ [id]: { archivada: false } });
  A.actualizar();
  hojaLista();
}

// ---------- Asignar categorías a varios hábitos ----------
function abrirAsignar(opciones) {
  const o = opciones || {};
  const act = HCat.activas(A.areasDef());
  const hs = A.activos();
  // Por defecto, marcados los que no tienen categoría (o los de una categoría).
  const ids = o.de ? hs.filter(h => h.area === o.de).map(h => h.id) : hs.filter(h => !HCat.deHabito(h, act)).map(h => h.id);
  asignacion = { ids: new Set(ids), area: o.de ? null : undefined, volverA: o.volverA || "lista", de: o.de || null };
  hojaAsignar();
}
function hojaAsignar() {
  const act = HCat.activas(A.areasDef());
  const hs = A.activos();
  const a = asignacion;
  const n = a.ids.size;
  const destino = a.area === undefined ? null : a.area ? act.find(c => c.id === a.area) : { nombre: "Sin categoría" };
  A.abrirHoja(A.cabecera("Categorías", "Asignar categorías", "Elige hábitos y una categoría") + `
    <span class="hb-label">1. Hábitos</span>
    <ul class="hb-asignar">${hs.map(h => {
      const c = HCat.deHabito(h, act);
      const on = a.ids.has(h.id);
      return `<li><button type="button" class="hb-asignar-item${on ? " is-on" : ""}" data-asig-hab="${h.id}" role="checkbox" aria-checked="${on}" ${c ? `style="--cat:${HCat.colorDe(c)}"` : ""}>
        <span class="hb-asignar-check" aria-hidden="true">${on ? "✓" : ""}</span>
        <span class="hb-emoji" aria-hidden="true">${esc(h.emoji)}</span>
        <span class="hb-orden-txt"><span class="hb-nombre">${esc(h.name)}</span><span class="hb-sub">${c ? `${esc(c.emoji)} ${esc(c.nombre)}` : "Sin categoría"}</span></span>
      </button></li>`;
    }).join("")}</ul>
    <span class="hb-label">2. Categoría</span>
    <div class="hb-chips">${act.map(c => `<button type="button" class="hb-chip hb-chip-cat${a.area === c.id ? " is-on" : ""}" style="--cat:${HCat.colorDe(c)}" data-asig-cat="${c.id}" aria-pressed="${a.area === c.id}">${esc(c.emoji)} ${esc(c.nombre)}</button>`).join("")}
      <button type="button" class="hb-chip${a.area === null ? " is-on" : ""}" data-asig-cat="" aria-pressed="${a.area === null}">Sin categoría</button></div>
    <p class="hb-texto">Solo cambia la categoría: el historial, las rachas y el XP de cada hábito no se tocan.</p>
    <div class="hb-acciones hb-acciones-fijas">
      <button type="button" class="hb-btn-sec" data-asig-cancelar>Cancelar</button>
      <button type="button" class="hb-btn" data-asig-guardar ${n && destino ? "" : "disabled"}>${n && destino ? `Pasar ${A.plural(n, "hábito", "hábitos")} a ${esc(destino.nombre)}` : "Asignar"}</button>
    </div>`, { tipo: "asignar" });
}
function guardarAsignar() {
  const a = asignacion;
  if (!a || a.area === undefined || !a.ids.size) return;
  const cambios = HCat.asignar(habitos(), [...a.ids], a.area);
  if (cambios.length) {
    const lote = db.batch();
    cambios.forEach(c => lote.update(A.coleccion().doc(c.id), { area: c.area }));
    lote.commit().catch(A.errorGuardar);
    const destino = a.area ? A.areasDef().find(c => c.id === a.area).nombre : "Sin categoría";
    A.toast(`${A.plural(cambios.length, "hábito pasó", "hábitos pasaron")} a ${destino}.`);
  }
  const volver = a.de ? "editor" : a.volverA;
  const de = a.de;
  asignacion = null;
  if (volver === "editor" && de) setTimeout(() => abrirEditor(de, "lista"), 50);
  else hojaLista();
}

// ---------- Eventos dentro de la hoja ----------
A.alClick((e, t) => {
  const q = sel => t.closest(sel);
  let b;
  if (q("[data-cat-gestionar]")) { hojaLista(); return true; }
  if (q("[data-cat-volver-ajustes]")) { A.hojaAjustes(); return true; }
  if ((b = q("[data-cat-nueva]"))) {
    if (b.dataset.catNueva === "form") A.leerForm();
    abrirEditor(null, b.dataset.catNueva === "form" ? "form" : "lista");
    return true;
  }
  if ((b = q("[data-cat-sugerida]"))) {
    const s = HCat.SUGERIDAS.find(x => x.id === b.dataset.catSugerida);
    abrirEditor(null, "lista", { nombre: s.nombre, emoji: s.emoji, color: s.color, sugerida: s.id });
    return true;
  }
  if ((b = q("[data-cat-editar]"))) { abrirEditor(b.dataset.catEditar, "lista"); return true; }
  if ((b = q("[data-cat-mover]"))) { mover(b.closest("[data-cat-id]").dataset.catId, Number(b.dataset.catMover)); return true; }
  if ((b = q("[data-cat-restaurar]"))) { restaurar(b.dataset.catRestaurar); return true; }
  if ((b = q("[data-cat-color]"))) { leerEditor(); edicion.color = b.dataset.catColor; hojaEditor(); return true; }
  if ((b = q("[data-cat-emoji]"))) {
    leerEditor();
    edicion.emoji = b.dataset.catEmoji;
    const em = document.querySelector('.hb-sheet [name="catEmoji"]');
    if (em) em.value = "";
    hojaEditor();
    return true;
  }
  if (q("[data-cat-cancelar]")) { salir(edicion && edicion.volverA === "form" ? undefined : null); return true; }
  if ((b = q("[data-cat-archivar]"))) { archivar(b.dataset.catArchivar); return true; }
  if ((b = q("[data-cat-borrar]"))) { borrar(b.dataset.catBorrar); return true; }
  if ((b = q("[data-cat-asignar-de]"))) { abrirAsignar({ de: b.dataset.catAsignarDe }); return true; }
  if (q("[data-cat-asignar]")) { abrirAsignar(); return true; }
  if ((b = q("[data-asig-hab]"))) {
    const id = b.dataset.asigHab;
    if (asignacion.ids.has(id)) asignacion.ids.delete(id); else asignacion.ids.add(id);
    hojaAsignar();
    return true;
  }
  if ((b = q("[data-asig-cat]"))) { asignacion.area = b.dataset.asigCat || null; hojaAsignar(); return true; }
  if (q("[data-asig-cancelar]")) { const de = asignacion && asignacion.de; asignacion = null; if (de) abrirEditor(de, "lista"); else hojaLista(); return true; }
  if (q("[data-asig-guardar]")) { guardarAsignar(); return true; }
  return false;
});
A.alEnviar((e, form) => {
  if (!form.classList.contains("hb-cat-form")) return false;
  guardarEditor();
  return true;
});

// Para la página de categoría y Hoy (fases siguientes).
window.HabitosCategoriasUI = { hojaLista, abrirEditor, abrirAsignar };
})();
