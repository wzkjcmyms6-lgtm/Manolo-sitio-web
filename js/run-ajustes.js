// ---------- Running › Ajustes (engranaje de arriba, fase 4) ----------
// FC máxima y en reposo (zonas y carga), ritmo umbral (carga por ritmo),
// metas de km por semana, mes y año, y zapatillas (agregar, editar,
// predeterminada, retirar). Todo en users/{uid}/meta/running_ajustes con
// merge (D-067). El peso sale de Ejercicio › Perfil (no se duplica).
(function () {
"use strict";
const V = window.RunVista, A = window.RunAnalisis, M = window.RunMetricas;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ref = () => db.collection("users").doc(currentUser.uid).collection("meta").doc("running_ajustes");
let editando = null; // id de la zapatilla en edición ("nueva" para agregar)
let aviso = "";

const visible = () => location.hash.replace(/^#/, "").split("/")[0] === "run-ajustes";
const num = v => { const n = Number(String(v || "").replace(",", ".")); return isFinite(n) ? n : NaN; };
function leerRitmo(txt) {
  const m = /^\s*(\d{1,2})[:.,](\d{2})\s*$/.exec(String(txt || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function pintar() {
  if (!visible()) return;
  const app = document.getElementById("ra-app");
  if (!app) return;
  const aj = RunDatos.ajustes();
  const docs = RunDatos.lista("running");
  const metas = aj.metas || {};
  const sugerido = A.ritmoUmbralSugerido(docs);
  const fcVista = docs.reduce((m, d) => Math.max(m, Number(d.fcMax) || 0), 0);
  const zs = A.zapatillas(docs, aj.zapatillas || []);
  app.innerHTML = `
    ${aviso ? `<p class="tmp-ok" role="status">${esc(aviso)}</p>` : ""}
    <form class="tmp-card ra-form" id="ra-form" novalidate>
      <h2 class="tmp-titulo">Corazón y ritmo</h2>
      <label class="rd-campo">FC máxima (lpm)<input class="lib-input" name="fcMax" inputmode="numeric" value="${aj.fcMax || ""}" placeholder="${fcVista ? `La más alta registrada: ${fcVista}` : "Ej.: 190"}"></label>
      <label class="rd-campo">FC en reposo (lpm)<input class="lib-input" name="fcReposo" inputmode="numeric" value="${aj.fcReposo || ""}" placeholder="Ej.: 55"></label>
      <label class="rd-campo">Ritmo umbral (min:seg por km)<input class="lib-input" name="ritmoUmbral" inputmode="numeric" value="${aj.ritmoUmbralS ? V.ritmo(aj.ritmoUmbralS, true) : ""}" placeholder="Sugerido: ${V.ritmo(sugerido, true)}"></label>
      <p class="tmp-nota">Con la FC se calculan tus zonas y la carga de cada carrera; sin FC, la carga sale del ritmo y la pendiente comparados con tu ritmo umbral (el que podrías sostener ~1 hora). Las carreras ya importadas conservan la carga con la que se guardaron.</p>
      <h2 class="tmp-titulo ra-sub">Metas de km</h2>
      <div class="ra-metas">
        <label class="rd-campo">Por semana<input class="lib-input" name="semanaKm" inputmode="decimal" value="${metas.semanaKm || ""}" placeholder="—"></label>
        <label class="rd-campo">Por mes<input class="lib-input" name="mesKm" inputmode="decimal" value="${metas.mesKm || ""}" placeholder="—"></label>
        <label class="rd-campo">Por año<input class="lib-input" name="anioKm" inputmode="decimal" value="${metas.anioKm || ""}" placeholder="—"></label>
      </div>
      <p class="tmp-nota ra-error" data-ra-error hidden></p>
      <button type="submit" class="lib-btn tmp-guardar ra-guardar">Guardar</button>
    </form>

    <section class="tmp-card ra-zaps">
      <h2 class="tmp-titulo">Zapatillas</h2>
      ${zs.length ? `<ul class="ra-lista">${zs.map(z => editando === z.id ? formZap(z) : `<li class="ra-zap${z.retirada ? " is-retirada" : ""}">
        <div><b>${esc(z.nombre)}</b>${z.predeterminada ? ` <span class="act-tag">Predeterminada</span>` : ""}${z.retirada ? ` <span class="act-tag rf-tag-mano">Retirada</span>` : ""}
          <small>${V.numero(z.km, 0)} de ${V.numero(z.limite)} km · ${z.n} ${z.n === 1 ? "carrera" : "carreras"}</small></div>
        <div class="ra-zap-btns">
          <button type="button" class="tmp-quitar" data-ra-editar="${esc(z.id)}">Editar</button>
          ${z.retirada ? `<button type="button" class="tmp-quitar" data-ra-volver="${esc(z.id)}">Volver a usar</button>` : `${z.predeterminada ? "" : `<button type="button" class="tmp-quitar" data-ra-pred="${esc(z.id)}">Predeterminada</button>`}<button type="button" class="tmp-quitar" data-ra-retirar="${esc(z.id)}">Retirar</button>`}
        </div></li>`).join("")}</ul>` : `<p class="tmp-nota">Agrega tus zapatillas para llevar sus km. La predeterminada se pone sola en las carreras que importes desde hoy; en cada carrera puedes cambiarla (Editar).</p>`}
      ${editando === "nueva" ? `<ul class="ra-lista">${formZap(null)}</ul>` : `<button type="button" class="lib-btn-sec rd-btn" data-ra-nueva>Agregar zapatillas</button>`}
    </section>

    <section class="tmp-card">
      <h2 class="tmp-titulo">Peso</h2>
      <p class="tmp-nota">Para estimar calorías cuando el reloj no las trae, se usa tu último peso de <a href="#ej-perfil">Ejercicio › Perfil</a>.</p>
    </section>`;
}
function formZap(z) {
  return `<li class="ra-zap-form"><form id="ra-zap-form" data-id="${z ? esc(z.id) : ""}" novalidate>
    <label class="rd-campo">Nombre<input class="lib-input" name="nombre" maxlength="40" value="${z ? esc(z.nombre) : ""}" placeholder="Ej.: Pegasus 41" required></label>
    <div class="ra-metas">
      <label class="rd-campo">Km que ya tenían<input class="lib-input" name="kmInicial" inputmode="decimal" value="${z ? z.kmInicial || 0 : 0}"></label>
      <label class="rd-campo">Cambiar a los (km)<input class="lib-input" name="limiteKm" inputmode="decimal" value="${z ? z.limiteKm || 700 : 700}"></label>
    </div>
    <p class="tmp-nota ra-error" data-ra-zap-error hidden></p>
    <div class="ra-zap-btns"><button type="button" class="lib-btn-sec rd-btn" data-ra-cancelar>Cancelar</button><button type="submit" class="lib-btn rd-btn">Guardar</button></div>
  </form></li>`;
}
function error(sel, txt) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.textContent = txt;
  el.hidden = !txt;
}
function guardarAjustes(f) {
  const v = n => f.elements[n].value.trim();
  const cambios = { metas: {} };
  const fcMax = v("fcMax"), fcRep = v("fcReposo"), umbral = v("ritmoUmbral");
  if (fcMax) { const n = num(fcMax); if (!(n >= 120 && n <= 230)) return error("[data-ra-error]", "La FC máxima va entre 120 y 230 lpm."); cambios.fcMax = Math.round(n); }
  else cambios.fcMax = null;
  if (fcRep) { const n = num(fcRep); if (!(n >= 30 && n <= 110)) return error("[data-ra-error]", "La FC en reposo va entre 30 y 110 lpm."); cambios.fcReposo = Math.round(n); }
  else cambios.fcReposo = null;
  if (cambios.fcMax && cambios.fcReposo && cambios.fcReposo >= cambios.fcMax) return error("[data-ra-error]", "La FC en reposo tiene que ser menor que la máxima.");
  if (umbral) { const s = leerRitmo(umbral); if (!(s >= 150 && s <= 900)) return error("[data-ra-error]", "Escribe el ritmo como 5:30 (entre 2:30 y 15:00)."); cambios.ritmoUmbralS = s; }
  else cambios.ritmoUmbralS = null;
  for (const k of ["semanaKm", "mesKm", "anioKm"]) {
    const t = v(k);
    if (!t) { cambios.metas[k] = 0; continue; }
    const n = num(t);
    if (!(n > 0 && n < 100000)) return error("[data-ra-error]", "Las metas son km mayores que 0.");
    cambios.metas[k] = Math.round(n * 10) / 10;
  }
  error("[data-ra-error]", "");
  ref().set(cambios, { merge: true }).catch(e => { console.error(e); alert("No se pudo guardar."); });
  aviso = "Ajustes guardados.";
  pintar();
}
// Las zapatillas son una lista en el mismo documento: se guarda la lista entera.
function guardarZaps(lista) {
  return ref().set({ zapatillas: lista }, { merge: true }).catch(e => { console.error(e); alert("No se pudo guardar."); });
}
function guardarZap(f) {
  const nombre = f.elements.nombre.value.trim();
  const kmI = num(f.elements.kmInicial.value || 0), lim = num(f.elements.limiteKm.value || 700);
  if (!nombre) return error("[data-ra-zap-error]", "Escribe un nombre.");
  if (!(kmI >= 0 && kmI < 20000) || !(lim >= 50 && lim < 20000)) return error("[data-ra-zap-error]", "Revisa los km (el límite va de 50 en adelante).");
  const lista = (RunDatos.ajustes().zapatillas || []).map(z => Object.assign({}, z));
  const id = f.dataset.id;
  if (id) Object.assign(lista.find(z => z.id === id) || {}, { nombre, kmInicial: Math.round(kmI * 10) / 10, limiteKm: Math.round(lim) });
  else lista.push({ id: `z_${Date.now().toString(36)}`, nombre, kmInicial: Math.round(kmI * 10) / 10, limiteKm: Math.round(lim), retirada: false, predeterminada: !lista.some(z => z.predeterminada && !z.retirada), creado: Date.now() });
  editando = null;
  aviso = id ? "Zapatillas actualizadas." : "Zapatillas agregadas.";
  guardarZaps(lista);
  pintar();
}
function cambiarZap(id, fn) {
  const lista = (RunDatos.ajustes().zapatillas || []).map(z => Object.assign({}, z));
  lista.forEach(z => fn(z, z.id === id));
  guardarZaps(lista);
}

document.addEventListener("submit", e => {
  if (e.target.id === "ra-form") { e.preventDefault(); guardarAjustes(e.target); }
  else if (e.target.id === "ra-zap-form") { e.preventDefault(); guardarZap(e.target); }
});
document.addEventListener("click", e => {
  if (!e.target.closest("#panel-run-ajustes")) return;
  const b = e.target.closest("button");
  if (!b) return;
  aviso = "";
  if (b.dataset.raNueva != null) { editando = "nueva"; pintar(); }
  else if (b.dataset.raCancelar != null) { editando = null; pintar(); }
  else if (b.dataset.raEditar) { editando = b.dataset.raEditar; pintar(); }
  else if (b.dataset.raPred) cambiarZap(b.dataset.raPred, (z, es) => { z.predeterminada = es; });
  else if (b.dataset.raRetirar) {
    if (!confirm("¿Retirar estas zapatillas? Sus km quedan guardados y dejan de proponerse.")) return;
    cambiarZap(b.dataset.raRetirar, (z, es) => { if (es) { z.retirada = true; z.predeterminada = false; } });
  } else if (b.dataset.raVolver) cambiarZap(b.dataset.raVolver, (z, es) => { if (es) z.retirada = false; });
});
if (window.RunDatos) RunDatos.al(() => { if (!document.activeElement || !document.activeElement.closest("#ra-app")) pintar(); });
window.addEventListener("hashchange", () => { aviso = ""; editando = null; pintar(); });
document.addEventListener("DOMContentLoaded", pintar);
})();
