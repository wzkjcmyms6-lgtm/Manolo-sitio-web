// ---------- Bici › Ajustes (engranaje de arriba, D-142) ----------
// Metas de km por semana, mes y año (con anillos en Progreso). Todo en
// users/{uid}/meta/bici_ajustes con merge, aparte de los de Running.
(function () {
"use strict";
if (!window.RunDatos) return;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ref = () => db.collection("users").doc(currentUser.uid).collection("meta").doc("bici_ajustes");
let aviso = "";

const visible = () => location.hash.replace(/^#/, "").split("/")[0] === "bici-ajustes";
const num = v => { const n = Number(String(v || "").replace(",", ".")); return isFinite(n) ? n : NaN; };

function pintar() {
  if (!visible()) return;
  const app = document.getElementById("ba-app");
  if (!app) return;
  const metas = RunDatos.ajustesBici().metas || {};
  app.innerHTML = `
    ${aviso ? `<p class="tmp-ok" role="status">${esc(aviso)}</p>` : ""}
    <form class="tmp-card ra-form" id="ba-form" novalidate>
      <h2 class="tmp-titulo">Metas de km</h2>
      <div class="ra-metas">
        <label class="rd-campo">Por semana<input class="lib-input" name="semanaKm" inputmode="decimal" value="${metas.semanaKm || ""}" placeholder="—"></label>
        <label class="rd-campo">Por mes<input class="lib-input" name="mesKm" inputmode="decimal" value="${metas.mesKm || ""}" placeholder="—"></label>
        <label class="rd-campo">Por año<input class="lib-input" name="anioKm" inputmode="decimal" value="${metas.anioKm || ""}" placeholder="—"></label>
      </div>
      <p class="tmp-nota">Se ven como anillos en Progreso. Deja vacío lo que no quieras medir.</p>
      <p class="tmp-nota ra-error" data-ba-error hidden></p>
      <button type="submit" class="lib-btn tmp-guardar ra-guardar">Guardar</button>
    </form>
    <section class="tmp-card">
      <h2 class="tmp-titulo">Tus datos</h2>
      <p class="tmp-nota">Tus rodadas (con sus rutas en GPX) salen en <a href="#run-ajustes">Ajustes de Running › Exportar todo</a>, junto con tus carreras.</p>
    </section>`;
}
function error(txt) {
  const el = document.querySelector("[data-ba-error]");
  if (!el) return;
  el.textContent = txt;
  el.hidden = !txt;
}
function guardar(f) {
  const metas = {};
  for (const k of ["semanaKm", "mesKm", "anioKm"]) {
    const t = f.elements[k].value.trim();
    if (!t) { metas[k] = 0; continue; }
    const n = num(t);
    if (!(n > 0 && n < 100000)) return error("Las metas son km mayores que 0.");
    metas[k] = Math.round(n * 10) / 10;
  }
  error("");
  ref().set({ metas }, { merge: true }).catch(e => { console.error(e); alert("No se pudo guardar."); });
  aviso = "Metas guardadas.";
  pintar();
}

document.addEventListener("submit", e => {
  if (e.target.id === "ba-form") { e.preventDefault(); guardar(e.target); }
});
RunDatos.al(() => { if (!document.activeElement || !document.activeElement.closest("#ba-app")) pintar(); });
window.addEventListener("hashchange", () => { aviso = ""; pintar(); });
document.addEventListener("DOMContentLoaded", pintar);
window.BiciAjustes = { pintar };
})();
