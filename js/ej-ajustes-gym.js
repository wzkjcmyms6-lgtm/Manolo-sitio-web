// ---------- Ajustes del gimnasio (hoja) ----------
// Perfiles de equipo ("Gimnasio", "Casa"…): qué equipo tienes, barra,
// discos, mancuernas y pasos de máquinas y poleas; y tu meta y nivel. Los
// usan los discos por lado, las microcargas de la progresión, el
// calentamiento, el generador de rutinas y las alternativas de la ficha.
// Se guarda en meta/ajustes_ejercicio (con merge): equipo, meta, nivel.
// Se abre con cualquier botón data-ajustes-gym.
(function () {
"use strict";

const DISCOS = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5];
const TENGO = [["barras", "Barra y discos"], ["mancuernasSi", "Mancuernas"], ["maquinas", "Máquinas"], ["poleas", "Poleas"], ["dominadas", "Barra de dominadas"], ["kettlebellsSi", "Kettlebells"], ["bandas", "Bandas"]];
const METAS = [["fuerza", "Fuerza"], ["hipertrofia", "Músculo"], ["general", "General"]];
const NIVELES = [["principiante", "Principiante"], ["intermedio", "Intermedio"], ["avanzado", "Avanzado"]];
let hoja = null;
let ed = null; // { activo, perfiles, meta, nivel, borrados: [] }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const n = v => String(v).replace(".", ",");
const chip = (attr, val, txt, on) => `<button type="button" class="ejg-chip${on ? " is-on" : ""}" ${attr}="${esc(val)}" aria-pressed="${!!on}">${esc(txt)}</button>`;

function contenido() {
  const p = ed.perfiles[ed.activo];
  return `
    <div class="muscle-sheet-head">
      <div><span class="ejf-arriba">Ejercicio</span><h3 id="ejg-titulo">Ajustes del gimnasio</h3>
        <span class="muscle-sheet-period">Tu equipo, tu meta y tu nivel</span></div>
      <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
    </div>
    <h4 class="ejf-sub">Dónde entrenas</h4>
    <div class="ejg-chips" role="group" aria-label="Perfil de equipo">
      ${Object.keys(ed.perfiles).map(id => chip("data-ejg-perfil", id, ed.perfiles[id].nombre, id === ed.activo)).join("")}
      <button type="button" class="ejg-chip is-nuevo" data-ejg-nuevo>+ Nuevo</button>
    </div>
    <label class="ejg-campo">Nombre del perfil<input type="text" data-ejg="nombre" maxlength="30" value="${esc(p.nombre)}"></label>
    <h4 class="ejf-sub">Qué equipo tienes</h4>
    <div class="ejg-chips">${TENGO.map(([k, t]) => chip("data-ejg-tengo", k, t, p[k])).join("")}</div>
    ${p.barras ? `
    <div class="ejg-fila">
      <label class="ejg-campo">Barra (kg)<input type="number" inputmode="decimal" step="0.5" min="0" max="60" data-ejg="barra" value="${esc(p.barra)}"></label>
      <label class="ejg-campo">Barra EZ (kg)<input type="number" inputmode="decimal" step="0.5" min="0" max="60" data-ejg="barraEz" value="${esc(p.barraEz)}"></label>
    </div>
    <span class="ejg-label">Discos que tienes (de a pares)</span>
    <div class="ejg-chips">${DISCOS.map(d => chip("data-ejg-disco", d, n(d), p.discos.includes(d))).join("")}</div>` : ""}
    ${p.mancuernasSi ? `
    <span class="ejg-label">Mancuernas (kg)</span>
    <div class="ejg-fila ejg-3">
      <label class="ejg-campo">Desde<input type="number" inputmode="decimal" step="0.5" min="0.5" data-ejg="mancuernas.min" value="${esc(p.mancuernas.min)}"></label>
      <label class="ejg-campo">Hasta<input type="number" inputmode="decimal" step="0.5" min="0.5" data-ejg="mancuernas.max" value="${esc(p.mancuernas.max)}"></label>
      <label class="ejg-campo">De a<input type="number" inputmode="decimal" step="0.5" min="0.5" data-ejg="mancuernas.paso" value="${esc(p.mancuernas.paso)}"></label>
    </div>` : ""}
    ${p.maquinas || p.poleas ? `
    <div class="ejg-fila">
      ${p.maquinas ? `<label class="ejg-campo">Máquinas suben de (kg)<input type="number" inputmode="decimal" step="0.5" min="0.5" data-ejg="pasoMaquina" value="${esc(p.pasoMaquina)}"></label>` : ""}
      ${p.poleas ? `<label class="ejg-campo">Poleas suben de (kg)<input type="number" inputmode="decimal" step="0.5" min="0.5" data-ejg="pasoPolea" value="${esc(p.pasoPolea)}"></label>` : ""}
    </div>` : ""}
    ${Object.keys(ed.perfiles).length > 1 ? `<button type="button" class="ejf-link ejg-borrar" data-ejg-borrar>Eliminar este perfil</button>` : ""}
    <h4 class="ejf-sub">Tu meta</h4>
    <div class="ejg-chips">${METAS.map(([k, t]) => chip("data-ejg-meta", k, t, ed.meta === k)).join("")}</div>
    <p class="ejg-ayuda">${ed.meta === "fuerza" ? "Fuerza: pocas reps (3–6) con más peso y descansos largos." : ed.meta === "general" ? "General: un poco de todo, sesiones más cortas." : "Músculo: 6–12 reps y unas 10–20 series por músculo a la semana."}</p>
    <h4 class="ejf-sub">Tu nivel</h4>
    <div class="ejg-chips">${NIVELES.map(([k, t]) => chip("data-ejg-nivel", k, t, ed.nivel === k)).join("")}</div>
    <p class="ejg-error" role="alert" hidden></p>
    <div class="ejg-acciones"><button type="button" class="ejf-btn-sec" data-cerrar>Cancelar</button><button type="button" class="ejf-btn" data-ejg-guardar>Guardar</button></div>`;
}

function pintar() {
  const panel = hoja.querySelector(".muscle-sheet-panel");
  const y = panel.scrollTop;
  hoja.querySelector(".ejg-cuerpo").innerHTML = contenido();
  if (typeof renderIcons === "function") renderIcons(hoja);
  panel.scrollTop = y;
}

function abrir() {
  const a = EjercicioDatos.estado.ajustes || {};
  const pf = EjEquipo.perfiles(a);
  ed = { activo: pf.activo, perfiles: JSON.parse(JSON.stringify(pf.perfiles)), meta: a.meta || "hipertrofia", nivel: a.nivel || "intermedio", borrados: [] };
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "muscle-sheet ejg-hoja";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="muscle-sheet-overlay" data-cerrar></div>
      <div class="muscle-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="ejg-titulo"><div class="muscle-sheet-grip"></div><div class="ejg-cuerpo"></div></div>`;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", alClick);
    hoja.addEventListener("input", alEscribir);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && hoja && !hoja.hidden) cerrar(); });
  }
  pintar();
  hoja.hidden = false;
  hoja.classList.remove("closing");
  hoja.querySelector(".muscle-sheet-panel").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function cerrar() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden]), .muscle-sheet:not([hidden])"));
  }, 220);
}

function alEscribir(e) {
  const c = e.target.dataset.ejg;
  if (!c || !ed) return;
  const p = ed.perfiles[ed.activo];
  if (c === "nombre") { p.nombre = e.target.value; return; }
  const [a, b] = c.split(".");
  const v = e.target.value === "" ? "" : Number(String(e.target.value).replace(",", "."));
  if (b) p[a][b] = v; else p[a] = v;
}
function alClick(e) {
  if (e.target.closest("[data-cerrar]")) { cerrar(); return; }
  if (!ed) return;
  const p = ed.perfiles[ed.activo];
  const t = e.target.closest("[data-ejg-perfil], [data-ejg-nuevo], [data-ejg-tengo], [data-ejg-disco], [data-ejg-meta], [data-ejg-nivel], [data-ejg-borrar], [data-ejg-guardar]");
  if (!t) return;
  const d = t.dataset;
  if (d.ejgPerfil) ed.activo = d.ejgPerfil;
  else if (t.hasAttribute("data-ejg-nuevo")) {
    let id = "perfil", i = 1;
    while (ed.perfiles[id + i]) i++;
    id += i;
    ed.perfiles[id] = EjEquipo.normalizar(Object.assign({}, EjEquipo.CASA, { nombre: `Perfil ${Object.keys(ed.perfiles).length + 1}` }));
    ed.activo = id;
  } else if (d.ejgTengo) p[d.ejgTengo] = !p[d.ejgTengo];
  else if (d.ejgDisco) {
    const v = Number(d.ejgDisco);
    p.discos = p.discos.includes(v) ? p.discos.filter(x => x !== v) : p.discos.concat(v).sort((x, y) => y - x);
  } else if (d.ejgMeta) ed.meta = d.ejgMeta;
  else if (d.ejgNivel) ed.nivel = d.ejgNivel;
  else if (t.hasAttribute("data-ejg-borrar")) {
    if (!confirm(`¿Eliminar el perfil «${p.nombre}»?`)) return;
    ed.borrados.push(ed.activo);
    delete ed.perfiles[ed.activo];
    ed.activo = Object.keys(ed.perfiles)[0];
  } else if (t.hasAttribute("data-ejg-guardar")) { guardar(); return; }
  pintar();
}

function guardar() {
  const err = hoja.querySelector(".ejg-error");
  const perfiles = {};
  Object.keys(ed.perfiles).forEach(id => { perfiles[id] = EjEquipo.normalizar(ed.perfiles[id]); });
  const p = perfiles[ed.activo];
  if (p.barras && !p.discos.length) { err.textContent = "Elige al menos un disco (o quita «Barra y discos»)."; err.hidden = false; return; }
  err.hidden = true;
  const fv = firebase.firestore.FieldValue;
  ed.borrados.forEach(id => { perfiles[id] = fv.delete(); });
  const datos = { equipo: { activo: ed.activo, perfiles }, meta: ed.meta, nivel: ed.nivel };
  EjercicioDatos.meta("ajustes_ejercicio").set(datos, { merge: true });
  // Al instante en este teléfono (Firestore avisa después).
  const a = EjercicioDatos.estado.ajustes;
  const loc = {};
  Object.keys(perfiles).forEach(id => { if (!ed.borrados.includes(id)) loc[id] = perfiles[id]; });
  a.equipo = { activo: ed.activo, perfiles: loc };
  a.meta = ed.meta;
  a.nivel = ed.nivel;
  cerrar();
  document.dispatchEvent(new CustomEvent("ejercicio:ajustes"));
}

document.addEventListener("click", e => {
  if (e.target.closest("[data-ajustes-gym]")) { e.preventDefault(); abrir(); }
});
window.EjAjustesGym = { abrir, cerrar };
})();
