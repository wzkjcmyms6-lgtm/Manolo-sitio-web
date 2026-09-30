// ---------- Ejercicio › Perfil: altura e historial de pesajes ----------
// Se guardan en users/{uid}/meta/perfil_ejercicio:
//   { sexo: "hombre", alturaCm, pesajes: { "AAAA-MM-DD": kg } }
// Los rangos usan, para cada entreno, el último pesaje con fecha ≤ a ese día
// (si no hay, el peso del perfil; si tampoco, 85 kg). La altura se guarda
// pero no entra en el cálculo.
(function () {

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
function fechaLarga(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
}
const doc = () => EjercicioDatos.meta("perfil_ejercicio");

function aviso(texto, error) {
  const p = document.getElementById("pf-aviso");
  p.textContent = texto;
  p.classList.toggle("error", !!error);
  p.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { p.hidden = true; }, 3500);
}

function render(st) {
  const perfil = st.perfil || {};
  const altura = document.getElementById("pf-altura");
  if (document.activeElement !== altura) altura.value = perfil.alturaCm || "";
  const pesajes = perfil.pesajes || {};
  const fechas = Object.keys(pesajes).sort().reverse();
  document.getElementById("pf-pesajes").innerHTML = fechas.length
    ? fechas.slice(0, 20).map(f => `
        <li><span>${fechaLarga(f)}</span><b>${String(pesajes[f]).replace(".", ",")} kg</b>
        <button type="button" class="delete" data-borrar-pesaje="${escapeHtml(f)}" aria-label="Borrar pesaje del ${fechaLarga(f)}">${ICONS.trash}</button></li>`).join("")
    : `<li class="vacio">Sin pesajes todavía. Anota tu peso de vez en cuando para que tus rangos sean justos.</li>`;
  const fecha = document.getElementById("pf-fecha");
  if (!fecha.value) fecha.value = isoHoy();
}

document.getElementById("pf-altura-form").addEventListener("submit", e => {
  e.preventDefault();
  const cm = num(document.getElementById("pf-altura").value);
  if (cm === null || cm < 100 || cm > 250) { aviso("La altura va en centímetros (ej: 175).", true); return; }
  doc().set({ sexo: "hombre", alturaCm: cm }, { merge: true }).catch(() => aviso("No se pudo guardar.", true));
  aviso("Altura guardada.");
});

document.getElementById("pf-pesaje-form").addEventListener("submit", e => {
  e.preventDefault();
  const fecha = document.getElementById("pf-fecha").value;
  const kg = num(document.getElementById("pf-kg").value);
  if (!fecha) { aviso("Elige la fecha del pesaje.", true); return; }
  if (kg === null || kg < 20 || kg > 300) { aviso("El peso debe estar entre 20 y 300 kg.", true); return; }
  doc().set({ sexo: "hombre", pesajes: { [fecha]: kg } }, { merge: true }).catch(() => aviso("No se pudo guardar.", true));
  document.getElementById("pf-kg").value = "";
  aviso("Pesaje guardado. Tus rangos ya usan este peso.");
});

document.getElementById("pf-pesajes").addEventListener("click", e => {
  const b = e.target.closest("[data-borrar-pesaje]");
  if (!b || !confirm("¿Borrar este pesaje?")) return;
  doc().update({ ["pesajes." + b.dataset.borrarPesaje]: firebase.firestore.FieldValue.delete() });
});

EjercicioDatos.onCambio(render);
})();
