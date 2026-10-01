// ---------- Rutinas de Running: importar, ver y guardar ----------
// Importa un CSV (o la primera hoja de un Excel), muestra la vista previa con
// los errores fila por fila y guarda en users/{uid}/rutinas_running. Un plan
// de varios días (columna «dia») se guarda como una rutina por día, con el
// mismo «plan». Cada rutina tiene «orden»: la lista es una cola (la siguiente
// arriba). El archivo se lee en el teléfono: nunca se sube. Lógica de lectura
// en js/rutina-running.js; el lector de CSV/Excel es el de
// js/importar-rutinas.js (se carga solo cuando hace falta).
(function () {
const RR = RutinaRunning;
const XLSX_MAX = 1024 * 1024;
let rutinas = [];
const oyentes = [];
let hoja = null;
let pendiente = null; // resultado de RutinaRunning.interpretar listo para guardar

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
const filaIntervalo = x => `
      <li><span class="rr-tipo is-${x.tipo}">${NOMBRE_TIPO[x.tipo]}</span><span class="rr-dur">${mmss(x.seg)}</span><span class="rr-texto">${escapeHtml(x.texto)}</span></li>`;
function vistaPrevia(r) {
  if (!r.ok) {
    pendiente = null;
    abrirHoja(`
      <p class="rr-mal">No se puede guardar: corrige el archivo y vuelve a importarlo.</p>
      <ul class="rr-errores">${r.errores.map(e => `<li>${e.fila ? `<b>Fila ${e.fila}:</b> ` : ""}${escapeHtml(e.texto)}</li>`).join("")}</ul>
      <p class="rr-ayuda">Formato: columnas <b>dia</b> (opcional, para planes de varios días), <b>orden, tipo, duracion, descripcion</b>. Tipo: caminar, trotar, correr o descanso. Duración: 180, 3:00 o «3 min».</p>
      <div class="rr-acciones">
        <button type="button" class="act-btn-grande" data-rr="elegir">Elegir otro archivo</button>
        <button type="button" class="act-btn-sec" data-rr="plantilla">Descargar plantilla</button>
      </div>`);
    return;
  }
  pendiente = r;
  const plan = r.dias.length > 1 || r.dias[0].dia != null;
  const total = r.dias.reduce((s, d) => s + d.intervalos.length, 0);
  abrirHoja(`
    <label class="rr-nombre">${plan ? "Nombre del plan" : "Nombre de la rutina"}
      <input type="text" data-rr-nombre maxlength="${RR.LIMITES.nombre}" value="${escapeHtml(r.nombre)}"></label>
    <p class="rr-resumen">${plan ? `${r.dias.length} ${r.dias.length === 1 ? "día" : "días"} · ${total} intervalos en total. Cada día queda como una rutina en tu lista, en orden.` : escapeHtml(RR.resumen(r.rutina))}</p>
    <ol class="rr-lista">${r.dias.map(d => (plan
      ? `<li class="rr-dia">Día ${d.dia} · ${escapeHtml(RR.resumen(d))}</li>`
      : "") + d.intervalos.map(filaIntervalo).join("")).join("")}</ol>
    <p class="rr-error-nombre" hidden>Ponle un nombre${plan ? " al plan" : " a la rutina"}.</p>
    <div class="rr-acciones">
      <button type="button" class="act-btn-grande" data-rr="guardar">${plan ? `Guardar ${r.dias.length} ${r.dias.length === 1 ? "rutina" : "rutinas"}` : "Guardar rutina"}</button>
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
  a.download = "plantilla-rutinas-running.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Se guardan al final de la cola, en orden de día.
function guardar() {
  if (!pendiente) return;
  const nombre = ($("[data-rr-nombre]").value || "").trim().slice(0, RR.LIMITES.nombre);
  if (!nombre) { $(".rr-error-nombre").hidden = false; return; }
  const ahora = Date.now();
  const base = RR.ordenAlFinal(rutinas);
  const plan = pendiente.dias.length > 1 || pendiente.dias[0].dia != null ? "plan_" + ahora.toString(36) : null;
  const lote = db.batch();
  pendiente.dias.forEach((d, i) => {
    lote.set(col().doc(), Object.assign({ v: 1, nombre, intervalos: d.intervalos, totalSeg: d.totalSeg, creado: ahora, orden: base + i },
      plan ? { plan, dia: d.dia } : {}));
  });
  lote.commit().catch(err => { console.error("Manolo: no se pudo guardar la rutina", err); alert("No se pudo guardar la rutina."); });
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
    rutinas = RR.ordenarCola(snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
    oyentes.forEach(cb => { try { cb(rutinas); } catch (err) { console.error(err); } });
  });
});

window.RutinasRunning = {
  alCambiar(cb) { oyentes.push(cb); cb(rutinas); },
  lista: () => rutinas,
  obtener: id => rutinas.find(r => r.id === id) || null,
  importar: elegirArchivo,
  plantilla: descargarPlantilla,
  // Borra una rutina; si es un día de un plan, ofrece borrar el plan entero.
  // El historial (users/{uid}/running) no se toca.
  borrar(id) {
    const r = rutinas.find(x => x.id === id);
    if (!r || !confirm(`¿Eliminar «${RR.nombreCompleto(r)}»? Tu historial no se borra.`)) return;
    const otros = r.plan ? rutinas.filter(x => x.plan === r.plan && x.id !== r.id) : [];
    const todos = otros.length && confirm(`¿Eliminar también ${otros.length === 1 ? "el otro día" : `los otros ${otros.length} días`} del plan «${r.nombre}»?`);
    const lote = db.batch();
    [r].concat(todos ? otros : []).forEach(x => lote.delete(col().doc(x.id)));
    lote.commit().catch(err => console.error("Manolo: no se pudo eliminar la rutina", err));
  },
  // Para pruebas: abre la vista previa con un texto CSV.
  _vistaPrevia: (texto, nombre) => cargarLector().then(EI => vistaPrevia(RR.desdeTexto(texto, { nombre }, EI.leerCsv)))
};
})();
