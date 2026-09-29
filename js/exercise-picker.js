// ---------- Autocompletado de ejercicios + creador de ejercicios propios ----------
// ExercisePicker.adjuntar(input, { alElegir, alCrear }) muestra sugerencias
// de la base (sin tildes, tolerante a errores) con sus músculos, y al final
// "Crear «…»" si no existe. ExerciseCreator.abrir({ nombre, alGuardar }) abre
// una hoja con el maniquí: 1 toque = primario, 2 = secundario, 3 = quitar.
// Los ejercicios creados se guardan en users/{uid}/meta/ejercicios_propios.
(function () {

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
const nombreMusculo = id => (MuscleEngine.MUSCULO_POR_ID[id] || {}).nombre || id;

function resumenMusculos(f) {
  if (!f) return "";
  const p = (f.primarios || []).map(nombreMusculo);
  const s = (f.secundarios || []).map(nombreMusculo);
  return `<span class="pri">${escapeHtml(p.join(" · "))}</span>` +
    (s.length ? `<span class="sec"> · ${escapeHtml(s.slice(0, 3).join(" · "))}${s.length > 3 ? "…" : ""}</span>` : "");
}

// ------------------------------------------------------------------
// Autocompletado
// ------------------------------------------------------------------
function adjuntar(input, opciones) {
  const op = Object.assign({ limite: 6 }, opciones);
  const caja = document.createElement("div");
  caja.className = "ex-sugerencias";
  caja.setAttribute("role", "listbox");
  caja.hidden = true;
  input.insertAdjacentElement("afterend", caja);
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.removeAttribute("list");

  let resultados = [];

  function cerrar() { caja.hidden = true; caja.innerHTML = ""; }

  function mostrar() {
    const q = input.value.trim();
    if (!q) { cerrar(); return; }
    resultados = EjercicioDatos.buscar(q, op.limite).map(r => r.ejercicio);
    const exacto = resultados.some(f => ExerciseSearch.clave(f.nombre) === ExerciseSearch.clave(q));
    caja.innerHTML = resultados.map((f, i) => `
        <button type="button" class="ex-sug" data-i="${i}" role="option">
          <span class="n">${escapeHtml(f.nombre)}</span>
          <span class="m">${resumenMusculos(f)}</span>
        </button>`).join("") +
      (op.alCrear && !exacto ? `
        <button type="button" class="ex-sug crear" data-crear role="option">
          <span class="n">+ Crear «${escapeHtml(q)}»</span>
          <span class="m">Marcas sus músculos en el mapa</span>
        </button>` : "");
    caja.hidden = !caja.innerHTML.trim();
  }

  // pointerdown evita que el input pierda el foco antes del toque.
  caja.addEventListener("pointerdown", e => e.preventDefault());
  caja.addEventListener("click", e => {
    const b = e.target.closest(".ex-sug");
    if (!b) return;
    const q = input.value.trim();
    cerrar();
    if (b.hasAttribute("data-crear")) op.alCrear(q);
    else op.alElegir(resultados[Number(b.dataset.i)]);
  });
  input.addEventListener("input", mostrar);
  input.addEventListener("focus", mostrar);
  input.addEventListener("blur", () => setTimeout(cerrar, 150));
  input.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });

  // Para un "Agregar" sin elegir de la lista: usa el ejercicio si el nombre
  // coincide con seguridad; si no, ofrece crearlo.
  function confirmar() {
    const q = input.value.trim();
    if (!q) return;
    cerrar();
    const f = EjercicioDatos.resolver(q);
    if (f) op.alElegir(f);
    else if (op.alCrear) op.alCrear(q);
  }

  return { cerrar, confirmar };
}

// ------------------------------------------------------------------
// Creador de ejercicios propios
// ------------------------------------------------------------------
const TIPOS = [["carga", "Con peso"], ["peso_corporal", "Peso corporal"], ["cardio", "Cardio (min)"], ["isometrico", "Isométrico (seg)"]];

let hoja = null;
let estadoCreador = null;

function construirHoja() {
  hoja = document.createElement("div");
  hoja.className = "muscle-sheet ex-creator";
  hoja.hidden = true;
  const equipos = Object.keys(ExerciseSearch.EQUIPOS)
    .map(k => `<option value="${k}">${escapeHtml(k === "otro" ? "Otro / ninguno" : ExerciseSearch.EQUIPOS[k].nombre)}</option>`).join("");
  hoja.innerHTML = `
    <div class="muscle-sheet-overlay" data-cerrar></div>
    <div class="muscle-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="ex-creator-title">
      <div class="muscle-sheet-grip"></div>
      <div class="muscle-sheet-head">
        <div>
          <span class="muscle-sheet-group">Ejercicio propio</span>
          <h3 id="ex-creator-title">Nuevo ejercicio</h3>
        </div>
        <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
      </div>
      <form class="ex-creator-form" novalidate>
        <label class="ex-field">Nombre
          <input type="text" id="ex-creator-nombre" required maxlength="80" placeholder="Ej: Remo Meadows (Barra)">
        </label>
        <div class="ex-field-row">
          <label class="ex-field">Tipo
            <select id="ex-creator-tipo">${TIPOS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>
          </label>
          <label class="ex-field">Equipo
            <select id="ex-creator-equipo">${equipos}</select>
          </label>
        </div>
        <label class="ex-field" id="ex-creator-factor-wrap" hidden>Parte de tu peso que mueves (0,1 a 1)
          <input type="number" id="ex-creator-factor" min="0.05" max="1" step="0.05" value="0.6" inputmode="decimal">
        </label>
        <p class="ex-creator-help">Toca un músculo: <b>1 vez</b> = primario · <b>2</b> = secundario · <b>3</b> = quitar</p>
        <div class="ex-creator-figs">
          <div><svg class="figura ex-creator-fig" viewBox="0 0 140 300" data-vista="frente" aria-label="Frente"></svg><span>Frente</span></div>
          <div><svg class="figura ex-creator-fig" viewBox="0 0 140 300" data-vista="espalda" aria-label="Espalda"></svg><span>Espalda</span></div>
        </div>
        <div class="ex-creator-resumen" id="ex-creator-resumen"></div>
        <p class="ex-creator-error" id="ex-creator-error" hidden></p>
        <div class="ex-creator-actions">
          <button type="submit" class="ex-btn-primary">Guardar ejercicio</button>
          <button type="button" class="link-btn" data-cerrar>Cancelar</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(hoja);
  if (typeof renderIcons === "function") renderIcons(hoja);
  hoja.querySelectorAll(".ex-creator-fig").forEach(svg => BodyFigures.dibujar(svg, BodyFigures[svg.dataset.vista]));

  hoja.addEventListener("click", e => {
    if (e.target.closest("[data-cerrar]")) { cerrarCreador(); return; }
    const region = e.target.closest(".mz");
    if (region) alternar(region.dataset.muscle);
  });
  hoja.querySelector("#ex-creator-tipo").addEventListener("change", e => {
    hoja.querySelector("#ex-creator-factor-wrap").hidden = e.target.value !== "peso_corporal";
    if (e.target.value === "peso_corporal") hoja.querySelector("#ex-creator-equipo").value = "peso_corporal";
  });
  hoja.querySelector("form").addEventListener("submit", e => { e.preventDefault(); guardar(); });
}

function alternar(m) {
  const r = estadoCreador.roles;
  r[m] = !r[m] ? "primario" : r[m] === "primario" ? "secundario" : null;
  if (!r[m]) delete r[m];
  pintar();
}

function pintar() {
  const r = estadoCreador.roles;
  hoja.querySelectorAll(".mz").forEach(g => {
    const rol = r[g.dataset.muscle];
    if (rol === "primario") { g.setAttribute("data-nivel", "3"); g.removeAttribute("data-suave"); }
    else if (rol === "secundario") { g.setAttribute("data-nivel", "2"); g.setAttribute("data-suave", ""); }
    else { g.removeAttribute("data-nivel"); g.removeAttribute("data-suave"); }
  });
  const lista = rol => MuscleEngine.MUSCULOS.filter(m => r[m.id] === rol).map(m => m.nombre);
  const p = lista("primario"), s = lista("secundario");
  hoja.querySelector("#ex-creator-resumen").innerHTML =
    `<p><span class="tag primario">Primarios</span> ${p.length ? escapeHtml(p.join(", ")) : "<em>ninguno todavía</em>"}</p>` +
    `<p><span class="tag secundario">Secundarios</span> ${s.length ? escapeHtml(s.join(", ")) : "<em>ninguno</em>"}</p>`;
}

function error(msg) {
  const e = hoja.querySelector("#ex-creator-error");
  e.textContent = msg || "";
  e.hidden = !msg;
}

function slug(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function guardar() {
  const nombre = hoja.querySelector("#ex-creator-nombre").value.trim().replace(/\s+/g, " ");
  const tipo = hoja.querySelector("#ex-creator-tipo").value;
  const equipo = hoja.querySelector("#ex-creator-equipo").value;
  const r = estadoCreador.roles;
  const primarios = Object.keys(r).filter(m => r[m] === "primario");
  const secundarios = Object.keys(r).filter(m => r[m] === "secundario");
  if (!nombre) { error("Ponle un nombre al ejercicio."); return; }
  const existente = EjercicioDatos.estado.indice && EjercicioDatos.estado.indice.exactos.get(ExerciseSearch.clave(nombre));
  if (existente && existente.length) { error(`Ya existe «${existente[0].ej.nombre}». Búscalo en la lista.`); return; }
  if (!primarios.length) { error("Marca al menos un músculo primario (1 toque)."); return; }
  let factor = 0;
  if (tipo === "peso_corporal") {
    factor = parseFloat(String(hoja.querySelector("#ex-creator-factor").value).replace(",", "."));
    if (!(factor > 0 && factor <= 1)) { error("La parte del peso corporal va de 0,05 a 1 (ej: 0,6)."); return; }
  }
  const id = "propio-" + (slug(nombre) || "ejercicio") + "-" + Date.now().toString(36).slice(-5);
  const ficha = { nombre, alias: [], tipo, equipo, primarios, secundarios, factorPesoCorporal: factor, creado: Date.now() };
  EjercicioDatos.meta("ejercicios_propios").set({ [id]: ficha }, { merge: true })
    .catch(err => console.error("No se pudo guardar el ejercicio", err));
  const cb = estadoCreador.alGuardar;
  cerrarCreador();
  if (cb) cb(Object.assign({ id }, ficha));
}

function abrir(opciones) {
  if (!hoja) construirHoja();
  estadoCreador = { roles: {}, alGuardar: opciones && opciones.alGuardar };
  hoja.querySelector("#ex-creator-nombre").value = (opciones && opciones.nombre) || "";
  hoja.querySelector("#ex-creator-tipo").value = "carga";
  hoja.querySelector("#ex-creator-equipo").value = "otro";
  hoja.querySelector("#ex-creator-factor-wrap").hidden = true;
  error("");
  pintar();
  hoja.hidden = false;
  hoja.classList.remove("closing");
  hoja.querySelector(".muscle-sheet-panel").scrollTop = 0;
  document.body.classList.add("sheet-open");
}

function cerrarCreador() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("closing");
  document.body.classList.remove("sheet-open");
  setTimeout(() => { hoja.hidden = true; hoja.classList.remove("closing"); }, 220);
}

window.ExercisePicker = { adjuntar, resumenMusculos };
window.ExerciseCreator = { abrir, cerrar: cerrarCreador };
})();
