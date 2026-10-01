// ---------- Rutinas de Running: importar, ver y guardar ----------
// Importa un CSV (o la primera hoja de un Excel), muestra la vista previa con
// los errores fila por fila y guarda en users/{uid}/rutinas_running. El
// archivo se lee en el teléfono: nunca se sube. Lógica de lectura en
// js/rutina-running.js; el lector de CSV/Excel es el de js/importar-rutinas.js
// (se carga solo cuando hace falta).
(function () {
const RR = RutinaRunning;
const XLSX_MAX = 1024 * 1024;
let rutinas = [];
const oyentes = [];
let hoja = null;
let pendiente = null; // { rutina } lista para guardar

const $ = sel => hoja && hoja.querySelector(sel);
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
const col = () => db.collection("users").doc(currentUser.uid).collection("rutinas_running");
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

let lector = null;
function cargarLector() {
  if (window.EjImportar) return Promise.resolve(window.EjImportar);
  lector = lector || new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "js/importar-rutinas.js";
    s.onload = () => ok(window.EjImportar);
    s.onerror = () => { lector = null; mal(new Error("No se pudo cargar el lector")); };
    document.head.appendChild(s);
  });
  return lector;
}

// Texto del archivo: UTF-8; si trae caracteres rotos, Windows-1252 (Excel viejo).
function decodificar(buffer) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch (e) { return new TextDecoder("windows-1252").decode(buffer); }
}

function leerArchivo(archivo) {
  const esXlsx = /\.xlsx$/i.test(archivo.name);
  if (archivo.size > (esXlsx ? XLSX_MAX : RR.LIMITES.bytes)) {
    return Promise.resolve({ ok: false, errores: [{ fila: null, texto: `El archivo es demasiado grande (máximo ${esXlsx ? "1 MB" : "200 KB"}).` }] });
  }
  return Promise.all([cargarLector(), archivo.arrayBuffer()]).then(([EI, buf]) => {
    if (esXlsx) return EI.leerXlsx(buf).then(hojas => RR.interpretar(hojas[0] ? hojas[0].filas : [], { nombre: archivo.name }));
    return RR.desdeTexto(decodificar(buf), { nombre: archivo.name }, EI.leerCsv);
  });
}

// ---- Hoja de vista previa ----
function abrirHoja(html) {
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "js-sheet budget-sheet rr-hoja";
    hoja.hidden = true;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", alTocar);
  }
  hoja.innerHTML = `<div class="budget-sheet-overlay" data-rr="cerrar"></div>
    <div class="budget-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="rr-t">
      <div class="budget-sheet-header">
        <button type="button" class="budget-sheet-close" data-rr="cerrar" aria-label="Cerrar"><span data-icon="close"></span></button>
        <h3 id="rr-t">Importar rutina</h3>
      </div>
      <div class="rr-cuerpo">${html}</div>
    </div>`;
  hoja.hidden = false;
  hoja.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  if (typeof renderIcons === "function") renderIcons(hoja);
}
function cerrarHoja() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("is-closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
  pendiente = null;
}

const NOMBRE_TIPO = { caminar: "Caminar", trotar: "Trotar", correr: "Correr", descanso: "Descanso" };
function vistaPrevia(r) {
  if (!r.ok) {
    pendiente = null;
    abrirHoja(`
      <p class="rr-mal">No se puede guardar: corrige el archivo y vuelve a importarlo.</p>
      <ul class="rr-errores">${r.errores.map(e => `<li>${e.fila ? `<b>Fila ${e.fila}:</b> ` : ""}${escapeHtml(e.texto)}</li>`).join("")}</ul>
      <p class="rr-ayuda">Formato: columnas <b>orden, tipo, duracion, descripcion</b>. Tipo: caminar, trotar, correr o descanso. Duración: 180, 3:00 o «3 min».</p>
      <div class="rr-acciones">
        <button type="button" class="act-btn-grande" data-rr="elegir">Elegir otro archivo</button>
        <button type="button" class="act-btn-sec" data-rr="plantilla">Descargar plantilla</button>
      </div>`);
    return;
  }
  pendiente = r;
  abrirHoja(`
    <label class="rr-nombre">Nombre de la rutina
      <input type="text" data-rr-nombre maxlength="${RR.LIMITES.nombre}" value="${escapeHtml(r.rutina.nombre)}"></label>
    <p class="rr-resumen">${escapeHtml(RR.resumen(r.rutina))}</p>
    <ol class="rr-lista">${r.rutina.intervalos.map(x => `
      <li><span class="rr-tipo is-${x.tipo}">${NOMBRE_TIPO[x.tipo]}</span><span class="rr-dur">${mmss(x.seg)}</span><span class="rr-texto">${escapeHtml(x.texto)}</span></li>`).join("")}</ol>
    <p class="rr-error-nombre" hidden>Ponle un nombre a la rutina.</p>
    <div class="rr-acciones">
      <button type="button" class="act-btn-grande" data-rr="guardar">Guardar rutina</button>
      <button type="button" class="act-btn-sec" data-rr="cerrar">Cancelar</button>
    </div>`);
}

let entrada = null;
function elegirArchivo() {
  if (!entrada) {
    entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = ".csv,.txt,.xlsx,text/csv";
    entrada.hidden = true;
    document.body.appendChild(entrada);
    entrada.addEventListener("change", () => {
      const archivo = entrada.files && entrada.files[0];
      entrada.value = "";
      if (!archivo) return;
      leerArchivo(archivo).then(vistaPrevia).catch(err => {
        console.error("Manolo: no se pudo leer la rutina", err);
        vistaPrevia({ ok: false, errores: [{ fila: null, texto: "No se pudo leer el archivo. ¿Es un CSV o un Excel (.xlsx)?" }] });
      });
    });
  }
  entrada.click();
}

function descargarPlantilla() {
  const blob = new Blob(["﻿" + RR.PLANTILLA], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "plantilla-rutina-running.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function guardar() {
  if (!pendiente) return;
  const nombre = ($("[data-rr-nombre]").value || "").trim().slice(0, RR.LIMITES.nombre);
  if (!nombre) { $(".rr-error-nombre").hidden = false; return; }
  const r = pendiente.rutina;
  col().add({ v: 1, nombre, intervalos: r.intervalos, totalSeg: r.totalSeg, creado: Date.now() })
    .catch(err => { console.error("Manolo: no se pudo guardar la rutina", err); alert("No se pudo guardar la rutina."); });
  cerrarHoja();
}

function alTocar(e) {
  const b = e.target.closest("[data-rr]");
  if (!b) return;
  const a = b.dataset.rr;
  if (a === "cerrar") cerrarHoja();
  else if (a === "guardar") guardar();
  else if (a === "elegir") elegirArchivo();
  else if (a === "plantilla") descargarPlantilla();
}
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarHoja(); });

onAuthReady(() => {
  col().onSnapshot(snap => {
    rutinas = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.creado || 0) - (b.creado || 0));
    oyentes.forEach(cb => { try { cb(rutinas); } catch (err) { console.error(err); } });
  });
});

window.RutinasRunning = {
  alCambiar(cb) { oyentes.push(cb); cb(rutinas); },
  lista: () => rutinas,
  obtener: id => rutinas.find(r => r.id === id) || null,
  importar: elegirArchivo,
  plantilla: descargarPlantilla,
  borrar(id) {
    const r = rutinas.find(x => x.id === id);
    if (!r || !confirm(`¿Eliminar la rutina «${r.nombre}»? Tus carreras hechas con ella no se borran.`)) return;
    col().doc(id).delete().catch(err => console.error("Manolo: no se pudo eliminar la rutina", err));
  },
  // Para pruebas: abre la vista previa con un texto CSV.
  _vistaPrevia: (texto, nombre) => cargarLector().then(EI => vistaPrevia(RR.desdeTexto(texto, { nombre }, EI.leerCsv)))
};
})();
