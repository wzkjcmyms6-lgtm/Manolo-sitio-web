// ---------- Apariencia: elegir modo claro, oscuro o como el iPhone (D-126) ----------
// Se abre desde Inicio (abajo) y desde el menú ☰. Tres opciones grandes;
// se aplica al tocar (sin "Guardar"). La elección queda en este teléfono
// (js/tema.js). Estilos de la hoja en css/style.css ("Apariencia").
(function () {
if (!window.Tema || !window.Lectura) return;
ICONS.tema = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none"/></svg>`;

const OPCIONES = [
  { id: "auto", t: "Automático", d: "Como tu iPhone: claro u oscuro según su ajuste (y cambia solo si el iPhone cambia de noche)." },
  { id: "claro", t: "Claro", d: "Fondo claro, para leer de día o con mucha luz." },
  { id: "oscuro", t: "Oscuro", d: "Fondo oscuro, el de siempre. Cansa menos la vista de noche." }
];
let hoja = null;
const h = () => hoja || (hoja = iniciar(window.Lectura.hoja("tema-hoja")));

function html() {
  const p = Tema.pref();
  return `
    <div class="tema-ops" role="radiogroup" aria-label="Apariencia">${OPCIONES.map(o => `
      <button type="button" class="tema-op${p === o.id ? " is-activo" : ""}" role="radio" aria-checked="${p === o.id}" data-tema="${o.id}">
        <span class="tema-muestra is-${o.id}" aria-hidden="true"><i></i><i></i></span>
        <span class="tema-txt"><b>${o.t}</b><small>${o.d}</small></span>
        <span class="tema-check" aria-hidden="true">${p === o.id ? "✓" : ""}</span>
      </button>`).join("")}
    </div>
    <p class="lib-nota tema-nota">Se guarda en este teléfono. En el modo claro, la franja de la hora y la batería queda oscura: el iPhone escribe esos números en blanco en la app instalada.</p>`;
}
function abrir() {
  h().abrir("Apariencia", html());
}
function iniciar(x) {
  x.el.addEventListener("click", e => {
    const b = e.target.closest("[data-tema]");
    if (!b) return;
    Tema.cambiar(b.dataset.tema);
    const cuerpo = x.el.querySelector(".lib-hoja-cuerpo");
    if (cuerpo) cuerpo.innerHTML = html();
    const nuevo = x.el.querySelector(`[data-tema="${b.dataset.tema}"]`);
    if (nuevo) nuevo.focus();
  });
  return x;
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-tema-abrir]")) { e.preventDefault(); abrir(); }
});
if (typeof renderIcons === "function") renderIcons();
window.TemaUI = { abrir };
})();
