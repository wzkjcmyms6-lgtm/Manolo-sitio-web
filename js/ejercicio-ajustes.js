// ---------- Ejercicio: revisar no reconocidos, ajustes y respaldo ----------
// - Lista los nombres de entrenos guardados que no se reconocen, para
//   asignarlos a un ejercicio de la base o crear uno nuevo. La asignación se
//   guarda aparte (meta/asignaciones_ejercicios); los entrenos no se tocan.
// - Ajustes: peso corporal y constantes del cálculo (meta/ajustes_ejercicio).
// - Respaldo: la primera vez que hay conexión se copia todo en
//   meta/respaldo_entrenamientos_AAAA-MM-DD; también se puede descargar.
(function () {

const CAMPOS = [
  // [clave, etiqueta, paso, factor de pantalla (ej. 100 = se muestra en %)]
  ["pesoPrimario", "Volumen a músculos primarios (%)", 5, 100],
  ["pesoSecundario", "Volumen a músculos secundarios (%)", 5, 100],
  ["seriePrimaria", "Serie efectiva por serie (primario)", 0.1, 1],
  ["serieSecundaria", "Serie efectiva por serie (secundario)", 0.1, 1],
  ["cardioK", "Constante de cardio e isométricos", 1, 1],
  ["rpePorDefecto", "RPE si no lo anotas", 1, 1],
  ["minutosPorSerieCardio", "Minutos de cardio por serie efectiva", 1, 1]
];

let respaldoEnCurso = false;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
function num(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}
function isoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- No reconocidos ----
function asignar(nombre, id) {
  const k = ExerciseSearch.clave(nombre);
  if (!k) return;
  EjercicioDatos.meta("asignaciones_ejercicios").set({ [k]: id }, { merge: true })
    .catch(err => console.error("No se pudo guardar la asignación", err));
}

function renderRevisar(st) {
  const caja = document.getElementById("ej-revisar");
  const faltan = (st.datos && st.datos.noReconocidos) || [];
  caja.hidden = !faltan.length;
  if (!faltan.length) return;
  document.getElementById("ej-revisar-titulo").textContent =
    faltan.length === 1 ? "1 ejercicio sin reconocer" : `${faltan.length} ejercicios sin reconocer`;
  const lista = document.getElementById("ej-revisar-lista");
  // No re-dibujar mientras se está buscando dentro de la lista.
  if (lista.contains(document.activeElement)) return;
  lista.innerHTML = faltan.map((f, i) => `
    <li data-i="${i}">
      <div class="ej-revisar-nombre"><span>${escapeHtml(f.nombre)}</span><span class="veces">${f.veces} ${f.veces === 1 ? "vez" : "veces"}</span></div>
      <div class="ej-revisar-acciones">
        <button type="button" class="ej-chip" data-accion="asignar">Asignar a un ejercicio</button>
        <button type="button" class="ej-chip" data-accion="crear">Crear nuevo</button>
      </div>
      <div class="ej-revisar-buscar" hidden>
        <input type="text" placeholder="Buscar en la base (ej: remo con barra)">
      </div>
    </li>`).join("");
  lista.querySelectorAll("li").forEach(li => {
    const nombre = faltan[Number(li.dataset.i)].nombre;
    const input = li.querySelector("input");
    ExercisePicker.adjuntar(input, {
      alElegir: f => asignar(nombre, f.id),
      alCrear: q => ExerciseCreator.abrir({ nombre: q || nombre, alGuardar: f => asignar(nombre, f.id) })
    });
  });
}

document.getElementById("ej-revisar-lista").addEventListener("click", e => {
  const b = e.target.closest("[data-accion]");
  if (!b) return;
  const li = b.closest("li");
  const faltan = EjercicioDatos.estado.datos.noReconocidos;
  const nombre = faltan[Number(li.dataset.i)].nombre;
  if (b.dataset.accion === "crear") {
    ExerciseCreator.abrir({ nombre, alGuardar: f => asignar(nombre, f.id) });
  } else {
    const caja = li.querySelector(".ej-revisar-buscar");
    caja.hidden = !caja.hidden;
    if (!caja.hidden) {
      const input = caja.querySelector("input");
      input.value = nombre;
      input.focus();
      input.dispatchEvent(new Event("input"));
    }
  }
});

// ---- Ajustes ----
function renderAjustes(st) {
  const form = document.getElementById("ej-ajustes-form");
  if (form.contains(document.activeElement)) return;
  const cfg = EjercicioDatos.config();
  document.getElementById("aj-peso").value = st.ajustes.pesoCorporal || "";
  document.getElementById("aj-peso").placeholder = `${cfg.pesoCorporal} (por defecto)`;
  CAMPOS.forEach(([k, , , f]) => { document.getElementById("aj-" + k).value = Math.round(cfg[k] * f * 100) / 100; });
  document.getElementById("aj-umbral2").value = cfg.umbrales[0];
  document.getElementById("aj-umbral3").value = cfg.umbrales[1];
}

function construirCampos() {
  document.getElementById("aj-avanzado-campos").innerHTML = CAMPOS.map(([k, etiqueta, paso]) => `
    <label class="ex-field">${etiqueta}<input type="number" id="aj-${k}" step="${paso}" min="0" inputmode="decimal"></label>`).join("") + `
    <label class="ex-field">Series para nivel 2 (naranja)<input type="number" id="aj-umbral2" step="1" min="1" inputmode="numeric"></label>
    <label class="ex-field">Series para nivel 3 (intenso)<input type="number" id="aj-umbral3" step="1" min="2" inputmode="numeric"></label>`;
}

function aviso(texto, error) {
  const p = document.getElementById("aj-aviso");
  p.textContent = texto;
  p.classList.toggle("error", !!error);
  p.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { p.hidden = true; }, 3500);
}

document.getElementById("ej-ajustes-form").addEventListener("submit", e => {
  e.preventDefault();
  const datos = {};
  const peso = num(document.getElementById("aj-peso").value);
  if (peso !== null) {
    if (peso < 20 || peso > 300) { aviso("El peso corporal debe estar entre 20 y 300 kg.", true); return; }
    datos.pesoCorporal = peso;
  }
  for (const [k, etiqueta, , f] of CAMPOS) {
    const v = num(document.getElementById("aj-" + k).value);
    if (v === null || v < 0) { aviso(`Revisa «${etiqueta}».`, true); return; }
    datos[k] = v / f;
  }
  if (!(datos.rpePorDefecto >= 1 && datos.rpePorDefecto <= 10)) { aviso("El RPE por defecto va de 1 a 10.", true); return; }
  if (!(datos.minutosPorSerieCardio > 0)) { aviso("Los minutos por serie de cardio deben ser más que 0.", true); return; }
  const u2 = num(document.getElementById("aj-umbral2").value), u3 = num(document.getElementById("aj-umbral3").value);
  if (!(u2 >= 1 && u3 > u2)) { aviso("El nivel 3 necesita más series que el nivel 2.", true); return; }
  datos.umbrales = [u2, u3];
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  // Sin conexión la promesa espera al servidor, pero el cambio ya se aplica.
  EjercicioDatos.meta("ajustes_ejercicio").set(datos, { merge: true })
    .catch(() => aviso("No se pudo guardar. Revisa tu conexión.", true));
  aviso("Guardado. El mapa y el radar ya usan estos valores.");
});

document.getElementById("aj-reset").addEventListener("click", () => {
  if (!confirm("¿Volver las constantes a los valores por defecto? Tu peso corporal se mantiene.")) return;
  const d = MuscleEngine.DEFAULTS;
  const datos = { umbrales: d.umbrales.slice() };
  CAMPOS.forEach(([k]) => { datos[k] = d[k]; });
  EjercicioDatos.meta("ajustes_ejercicio").set(datos, { merge: true });
  aviso("Constantes restablecidas.");
});

// ---- Mis ejercicios ----
function renderPropios(st) {
  const ul = document.getElementById("aj-propios");
  ul.innerHTML = st.propios.length
    ? st.propios.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(f => `
        <li>
          <div><span class="n">${escapeHtml(f.nombre)}</span><span class="m">${ExercisePicker.resumenMusculos(f)}</span></div>
          <button type="button" class="delete" data-borrar="${escapeHtml(f.id)}" aria-label="Eliminar ${escapeHtml(f.nombre)}">${ICONS.trash}</button>
        </li>`).join("")
    : `<li class="vacio">Todavía no creaste ejercicios. Aparecen aquí cuando buscas uno que no existe y lo creas marcando sus músculos.</li>`;
}

document.getElementById("aj-propios").addEventListener("click", e => {
  const b = e.target.closest("[data-borrar]");
  if (!b) return;
  if (!confirm("¿Eliminar este ejercicio? Los entrenos que lo usan quedarán como «sin reconocer».")) return;
  EjercicioDatos.meta("ejercicios_propios").update({ [b.dataset.borrar]: firebase.firestore.FieldValue.delete() });
});

// ---- Respaldo ----
function respaldo(st) {
  return {
    creado: Date.now(),
    entrenamientos: st.registros.gimnasio,
    running: st.registros.running,
    bicicleta: st.registros.bicicleta
  };
}

// Copia de seguridad automática, una sola vez, antes de empezar a usar el
// mapa nuevo. Solo con datos confirmados por el servidor (no del caché).
function respaldoAutomatico(st) {
  const c = st.cargado;
  if (respaldoEnCurso || !c.ajustes || !c.gimnasio || !c.running || !c.bicicleta) return;
  if (st.ajustes.respaldo) return;
  respaldoEnCurso = true;
  const doc = "respaldo_entrenamientos_" + isoHoy();
  EjercicioDatos.meta(doc).set(respaldo(st))
    .then(() => EjercicioDatos.meta("ajustes_ejercicio").set({ respaldo: { doc, fecha: isoHoy(), entrenos: st.registros.gimnasio.length } }, { merge: true }))
    .catch(err => { console.error("No se pudo crear el respaldo", err); respaldoEnCurso = false; });
}

function renderRespaldo(st) {
  const r = st.ajustes.respaldo;
  document.getElementById("aj-respaldo-info").textContent = r
    ? `Copia de seguridad guardada el ${r.fecha} (${r.entrenos} entrenos de gimnasio, además de running y bici). Tus entrenos originales no se modifican.`
    : "Se creará una copia de seguridad de tus entrenos en cuanto haya conexión.";
}

document.getElementById("aj-descargar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(respaldo(EjercicioDatos.estado), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `manolo-entrenos-${isoHoy()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});

construirCampos();
EjercicioDatos.onCambio(st => {
  renderRevisar(st);
  renderAjustes(st);
  renderPropios(st);
  renderRespaldo(st);
  respaldoAutomatico(st);
});
})();
