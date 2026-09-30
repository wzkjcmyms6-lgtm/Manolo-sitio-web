// Ejercicio → Rutinas → Importar desde Excel o CSV.
// 1) Eliges el archivo (o descargas la plantilla). 2) Vista previa editable:
// una rutina por día o por nombre, filas que no se pudieron leer y valores
// adivinados marcados. 3) Guardar: crea las rutinas y, si elegiste días,
// actualiza el plan semanal. El archivo se lee en el teléfono.
(function () {
const I = EjImportar, R = EjRutinas;
const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
const DIAS = R.DIAS; // lunes → domingo

let estado = null; // { paso, archivo, error, res, modo, grupos }

function uid() { return currentUser.uid; }
function col() { return db.collection("users").doc(uid()).collection("rutinas"); }
function planRef() { return db.collection("users").doc(uid()).collection("meta").doc("plan_semanal"); }

// ---- Hoja ----
function abrir() {
  estado = { paso: "inicio" };
  render();
  const h = $("imp-hoja");
  h.hidden = false;
  h.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
}
function cerrar() {
  const h = $("imp-hoja");
  if (h.hidden) return;
  h.classList.add("is-closing");
  setTimeout(() => {
    h.hidden = true;
    h.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
  estado = null;
}

// ---- Plantilla ----
function descargarPlantilla() {
  const nombre = "plantilla-rutinas-manolo.xlsx";
  const tipo = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const blob = new Blob([I.plantillaXlsx()], { type: tipo });
  try {
    const archivo = new File([blob], nombre, { type: tipo });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: nombre }).catch(() => {});
      return;
    }
  } catch (e) { /* sin compartir: se descarga */ }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// ---- Leer el archivo ----
async function leerArchivo(file) {
  const nombre = file.name || "archivo";
  estado = { paso: "leyendo", archivo: nombre };
  render();
  try {
    let res;
    if (/\.xls$/i.test(nombre)) throw new Error("Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx o .csv.");
    if (/\.(csv|txt)$/i.test(nombre) || /text\//.test(file.type)) {
      const buf = await file.arrayBuffer();
      let texto = new TextDecoder("utf-8").decode(buf);
      if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buf);
      res = I.interpretar(I.leerCsv(texto), { hoja: nombre.replace(/\.(csv|txt)$/i, "") });
    } else {
      if (typeof DecompressionStream === "undefined") throw new Error("Este teléfono no puede abrir archivos .xlsx. Actualiza iOS o guarda el archivo como .csv.");
      const hojas = await I.leerXlsx(await file.arrayBuffer());
      res = I.interpretarLibro(hojas, nombre);
    }
    if (!res.ok) throw new Error(res.error);
    if (!res.grupos.length) throw new Error("No encontré ejercicios en el archivo.");
    estado = {
      paso: "vista", archivo: nombre, res,
      modo: res.tieneDia ? "dias" : null,
      grupos: res.grupos.map(g => ({ nombre: g.nombre, dias: g.dias.slice(), incluir: true, items: g.items.map(it => Object.assign({ repsTxt: it.repsMin === it.repsMax ? `${it.repsMin}` : `${it.repsMin}-${it.repsMax}` }, it)) }))
    };
  } catch (err) {
    console.error("Manolo: no se pudo leer el archivo", err);
    const msg = err && err.message && !/^zip$/.test(err.message) ? err.message : "No pude abrir el archivo. Revisa que sea un .xlsx o .csv.";
    estado = { paso: "inicio", error: msg };
  }
  render();
}

// ---- Dibujar ----
function render() {
  const cuerpo = $("imp-cuerpo");
  const pie = $("imp-pie");
  if (!estado) return;
  if (estado.paso === "inicio" || estado.paso === "leyendo") {
    pie.hidden = true;
    cuerpo.innerHTML = `
      <p class="imp-texto">Sube un Excel (.xlsx) o un CSV con tus rutinas. Reconozco estas columnas aunque tengan otro nombre o no lleven tildes:</p>
      <p class="imp-columnas">Día · Rutina · Ejercicio · Series · Reps · Peso · Descanso · Notas</p>
      <p class="imp-texto imp-chico">Solo «Ejercicio» es obligatoria. Con «Día» (Lunes, Martes… o Día 1, Día 2…) armo una rutina por día y tu plan semanal. El archivo se lee en tu teléfono: no se sube a ningún lado.</p>
      ${estado.error ? `<p class="imp-error" role="alert">${esc(estado.error)}</p>` : ""}
      <button type="button" class="ejs-btn imp-principal" id="imp-elegir"${estado.paso === "leyendo" ? " disabled" : ""}>
        <span data-icon="download" class="imp-subir"></span>${estado.paso === "leyendo" ? `Leyendo ${esc(estado.archivo)}…` : "Elegir archivo"}</button>
      <button type="button" class="ejs-btn" id="imp-plantilla"><span data-icon="download"></span>Descargar plantilla de Excel</button>`;
    renderIcons(cuerpo);
    return;
  }
  if (estado.paso === "listo") {
    pie.hidden = true;
    cuerpo.innerHTML = `
      <div class="imp-listo" role="status"><span data-icon="check"></span>
        <p><strong>${esc(estado.mensaje)}</strong></p></div>
      <button type="button" class="ejs-btn imp-principal" id="imp-cerrar-listo">Listo</button>`;
    renderIcons(cuerpo);
    return;
  }
  // Vista previa
  const { res } = estado;
  const incluidas = estado.grupos.filter(g => g.incluir);
  const nEj = incluidas.reduce((s, g) => s + g.items.length, 0);
  const existentes = new Set(RutinasUI.rutinas().map(r => r.name.trim().toLowerCase()));
  const planActual = (RutinasUI.plan() && RutinasUI.plan().dias) || {};
  const conDias = estado.modo === "dias";
  cuerpo.innerHTML = `
    <p class="imp-texto">De <strong>${esc(estado.archivo)}</strong>: ${estado.grupos.length} ${estado.grupos.length === 1 ? "rutina" : "rutinas"} con ${estado.grupos.reduce((s, g) => s + g.items.length, 0)} ejercicios. Revisa y corrige antes de guardar.</p>
    ${res.malas.length ? `<div class="imp-malas" role="alert"><strong>No pude leer ${res.malas.length} ${res.malas.length === 1 ? "fila" : "filas"}:</strong><ul>${res.malas.map(m => `<li>${m.hoja ? `${esc(m.hoja)}, ` : ""}fila ${m.fila}: ${esc(m.motivo)}${m.texto ? ` <small>(${esc(m.texto)})</small>` : ""}</li>`).join("")}</ul></div>` : ""}
    ${!res.tieneDia ? `<fieldset class="imp-pregunta"><legend>El archivo no tiene columna «Día». ¿Qué hago?</legend>
      <label><input type="radio" name="imp-modo" value="rutinas"${estado.modo !== "dias" ? " checked" : ""}> Guardar ${estado.grupos.length === 1 ? "como una sola rutina" : "las rutinas"}, sin días</label>
      <label><input type="radio" name="imp-modo" value="dias"${conDias ? " checked" : ""}> Asignar${estado.grupos.length === 1 ? "la" : "las"} a días de la semana</label>
    </fieldset>` : ""}
    ${estado.grupos.map((g, gi) => `
      <section class="imp-grupo${g.incluir ? "" : " is-fuera"}" data-imp-g="${gi}">
        <div class="imp-grupo-top">
          <label class="imp-incluir"><input type="checkbox" data-imp-incluir${g.incluir ? " checked" : ""}> Importar</label>
          <input type="text" class="imp-nombre" data-imp-nombre value="${esc(g.nombre)}" maxlength="80" aria-label="Nombre de la rutina">
        </div>
        ${existentes.has(g.nombre.trim().toLowerCase()) ? `<p class="imp-nota">Ya tienes una rutina con este nombre: se creará otra.</p>` : ""}
        ${conDias ? `<div class="imp-dias" role="group" aria-label="Días de ${esc(g.nombre)}">${DIAS.map(d => `<button type="button" class="imp-dia${g.dias.includes(d.k) ? " on" : ""}" data-imp-dia="${d.k}" aria-pressed="${g.dias.includes(d.k)}">${d.corto}</button>`).join("")}</div>
          ${g.dias.some(k => planActual[k]) ? `<p class="imp-nota">Reemplaza lo que tenías el ${esc(g.dias.filter(k => planActual[k]).map(k => DIAS.find(d => d.k === k).nombre.toLowerCase()).join(", "))} en tu plan.</p>` : ""}` : ""}
        <ol class="imp-items">${g.items.map((it, ii) => {
          const f = EjercicioDatos.resolver(it.nombre);
          const base = !f ? `<small class="imp-aviso-base">No está en la base de ejercicios (igual se guarda)</small>`
            : ExerciseSearch.clave(f.nombre) !== ExerciseSearch.clave(it.nombre) ? `<small>En la base: ${esc(f.nombre)}</small>` : "";
          return `<li class="imp-item${it.avisos.length ? " con-aviso" : ""}" data-imp-i="${ii}">
            <div class="imp-item-top">
              <input type="text" data-imp-campo="nombre" value="${esc(it.nombre)}" maxlength="80" aria-label="Ejercicio">
              <button type="button" class="imp-quitar" data-imp-quitar aria-label="Quitar ${esc(it.nombre)}"><span data-icon="close"></span></button>
            </div>
            ${base}
            <div class="imp-item-nums">
              <label>Series<input type="number" data-imp-campo="series" inputmode="numeric" min="1" max="20" value="${it.series}"></label>
              <label>Reps<input type="text" data-imp-campo="repsTxt" inputmode="numeric" value="${esc(it.repsTxt)}"></label>
              <label>Peso<input type="number" data-imp-campo="peso" inputmode="decimal" step="0.5" value="${it.peso == null ? "" : it.peso}" placeholder="—"></label>
              <label>Desc. (s)<input type="number" data-imp-campo="descansoSeg" inputmode="numeric" min="0" max="900" value="${it.descansoSeg}"></label>
            </div>
            ${it.notas ? `<small>Notas: ${esc(it.notas)}</small>` : ""}
            ${it.avisos.map(a => `<p class="imp-aviso">Fila ${it.fila}: ${esc(a)}</p>`).join("")}
          </li>`;
        }).join("")}</ol>
      </section>`).join("")}`;
  pie.hidden = false;
  $("imp-guardar").disabled = !incluidas.length || !nEj;
  $("imp-guardar").textContent = incluidas.length ? `Guardar ${incluidas.length} ${incluidas.length === 1 ? "rutina" : "rutinas"}` : "Nada que guardar";
  renderIcons(cuerpo);
}

// ---- Guardar ----
function guardar() {
  const incluidas = estado.grupos.filter(g => g.incluir && g.items.some(it => String(it.nombre).trim()));
  if (!incluidas.length) return;
  let orden = Math.max(0, ...RutinasUI.rutinas().map(r => r.orden || 0)) + 1;
  const lote = db.batch();
  const dias = Object.assign({}, (RutinasUI.plan() && RutinasUI.plan().dias) || {});
  let conDias = false;
  incluidas.forEach(g => {
    const ref = col().doc();
    const items = g.items.filter(it => String(it.nombre).trim()).map(it => {
      const reps = I.leerReps(it.repsTxt);
      const f = EjercicioDatos.resolver(it.nombre);
      return R.item({
        nombre: it.nombre, exerciseId: f ? f.id : null, series: it.series,
        repsMin: reps.error || reps.vacio ? 8 : reps.min, repsMax: reps.error || reps.vacio ? 12 : reps.max,
        peso: it.peso, descansoSeg: it.descansoSeg, notas: it.notas
      });
    });
    lote.set(ref, R.aGuardar({ name: g.nombre.trim() || "Rutina importada", orden: orden++, items }));
    if (estado.modo === "dias") g.dias.forEach(k => { dias[k] = ref.id; conDias = true; });
  });
  if (conDias) lote.set(planRef(), { dias }, { merge: true });
  lote.commit().catch(err => console.error("Manolo: no se pudieron guardar las rutinas importadas", err));
  const n = incluidas.length;
  estado = { paso: "listo", mensaje: `Listo: ${n === 1 ? "se guardó 1 rutina" : `se guardaron ${n} rutinas`}${conDias ? " y tu plan semanal" : ""}.` };
  render();
}

// ---- Eventos ----
$("imp-hoja").addEventListener("click", e => {
  if (e.target.closest("#imp-elegir")) { const inp = $("imp-archivo"); inp.value = ""; inp.click(); return; }
  if (e.target.closest("#imp-plantilla")) { descargarPlantilla(); return; }
  if (e.target.closest("#imp-cerrar-listo")) { cerrar(); return; }
  if (!estado || estado.paso !== "vista") return;
  const gEl = e.target.closest("[data-imp-g]");
  if (!gEl) return;
  const g = estado.grupos[Number(gEl.dataset.impG)];
  const dia = e.target.closest("[data-imp-dia]");
  if (dia) {
    const k = dia.dataset.impDia;
    // Un día tiene una sola rutina: se quita de las demás.
    if (g.dias.includes(k)) g.dias = g.dias.filter(x => x !== k);
    else { estado.grupos.forEach(o => { o.dias = o.dias.filter(x => x !== k); }); g.dias.push(k); }
    render();
    return;
  }
  const q = e.target.closest("[data-imp-quitar]");
  if (q) {
    g.items.splice(Number(q.closest("[data-imp-i]").dataset.impI), 1);
    if (!g.items.length) g.incluir = false;
    render();
  }
});
$("imp-hoja").addEventListener("input", e => {
  if (!estado || estado.paso !== "vista") return;
  const gEl = e.target.closest("[data-imp-g]");
  if (!gEl) return;
  const g = estado.grupos[Number(gEl.dataset.impG)];
  if (e.target.hasAttribute("data-imp-nombre")) { g.nombre = e.target.value; return; }
  const campo = e.target.dataset.impCampo;
  const itEl = e.target.closest("[data-imp-i]");
  if (campo && itEl) g.items[Number(itEl.dataset.impI)][campo] = e.target.value;
});
$("imp-hoja").addEventListener("change", e => {
  if (!estado || estado.paso !== "vista") return;
  if (e.target.name === "imp-modo") { estado.modo = e.target.value; render(); return; }
  if (e.target.hasAttribute("data-imp-incluir")) {
    estado.grupos[Number(e.target.closest("[data-imp-g]").dataset.impG)].incluir = e.target.checked;
    render();
  }
});
$("imp-archivo").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) leerArchivo(f); });
$("imp-guardar").addEventListener("click", guardar);
$("imp-cancelar").addEventListener("click", cerrar);
$("imp-cerrar").addEventListener("click", cerrar);
$("imp-hoja").querySelector(".budget-sheet-overlay").addEventListener("click", cerrar);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("imp-hoja").hidden) cerrar(); });
// Se carga recién al tocar «Importar» (ver js/rutinas-ui.js).
window.EjImportarUI = { abrir };
})();
