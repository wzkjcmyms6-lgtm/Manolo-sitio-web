// ---------- Hábitos: hoja de plantillas (crear más rápido) ----------
// Desde "Nuevo hábito" → "Plantillas": buscar y elegir uno de los hábitos
// comunes de js/habitos-plantillas.js. Al tocarlo, el formulario se llena
// con su tipo, meta, frecuencia, momento, versión mínima, categoría y "se
// marca solo"; se puede cambiar todo antes de crear.
(function () {
const A = window.HabitosApp;
const T = window.HabitosPlantillas, HCat = window.HabitosCategorias, HA = window.HabitosAuto;
if (!A || !T) return;
const esc = s => A.escapeHtml(s);
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
let busqueda = "";

function frecuencia(p) {
  if (p.tipo === "evitar") return "Evitar";
  if (p.freqType === "semana") return `${A.plural(p.timesPerWeek, "vez", "veces")} por semana`;
  if (p.freqType === "cadaN") return `Cada ${p.cadaN} días`;
  if (p.freqType === "dias") return p.days.map((on, i) => (on ? DIAS[i] : null)).filter(Boolean).join(", ");
  return "Todos los días";
}
function resumen(p) {
  const partes = [];
  if (p.tipo === "medible") partes.push(`${A.fmtNum(p.meta)} ${p.unidad}`);
  if (p.tipo === "tiempo") partes.push(`${p.meta} min`);
  partes.push(frecuencia(p));
  const f = p.vinculo && HA && HA.fuente(p.vinculo);
  if (f) partes.push(`⚡ ${f.nombre}`);
  return partes.map(esc).join(" · ");
}
function listaHtml() {
  const cats = A.areasDef();
  const grupos = T.grupos(T.buscar(busqueda, cats), cats);
  if (!grupos.length) return `<p class="hb-texto">No encontré «${esc(busqueda)}». Crea el tuyo desde cero con «Volver».</p>`;
  return grupos.map(g => `<section class="hb-plant-grupo" aria-label="${esc(g.nombre)}">
    <h4 class="hb-sub-t">${g.emoji ? `<span aria-hidden="true">${esc(g.emoji)}</span> ` : ""}${esc(g.nombre)}</h4>
    <ul class="hb-plant-lista">${g.items.map(p => `<li><button type="button" class="hb-plant" data-plantilla="${p.id}" style="--cat:${g.color ? HCat.colorDe(g.color) : "var(--border)"}">
      <span class="hb-emoji" aria-hidden="true">${esc(p.emoji)}</span>
      <span class="hb-orden-txt"><span class="hb-nombre">${esc(p.nombre)}</span><span class="hb-sub">${resumen(p)}</span></span>
      <span class="hb-plant-ir" aria-hidden="true">›</span></button></li>`).join("")}</ul></section>`).join("");
}
function abrir() {
  A.leerForm();
  busqueda = "";
  A.abrirHoja(A.cabecera("Nuevo hábito", "Plantillas", `${T.LISTA.length} hábitos comunes: elige uno y ajústalo`) + `
    <label class="hb-campo hb-plant-buscar"><span class="hb-sr">Buscar una plantilla</span>
      <input type="search" data-plant-buscar placeholder="Buscar: agua, leer, gastos…" autocomplete="off" enterkeyhint="search"></label>
    <div data-plant-lista>${listaHtml()}</div>
    <div class="hb-acciones"><button type="button" class="hb-btn-sec" data-plant-volver>Volver</button></div>`, { tipo: "plantillas" });
}

A.alClick((e, t) => {
  let b;
  if (t.closest("[data-plant-abrir]")) { abrir(); return true; }
  if (t.closest("[data-plant-volver]")) { A.volverAlForm(); return true; }
  if ((b = t.closest("[data-plantilla]"))) {
    const p = T.LISTA.find(x => x.id === b.dataset.plantilla);
    if (p) A.desdePlantilla(T.aForm(p, A.areasDef()));
    return true;
  }
  return false;
});
A.alEscribir((e, t) => {
  if (!t.hasAttribute("data-plant-buscar")) return false;
  busqueda = t.value;
  const cont = document.querySelector(".hb-sheet [data-plant-lista]");
  if (cont) cont.innerHTML = listaHtml();
  return true;
});

window.HabitosPlantillasUI = { abrir };
})();
