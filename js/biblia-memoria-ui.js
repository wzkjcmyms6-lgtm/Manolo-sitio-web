// ---------- Biblia: memorizar versículos (pantalla, fase 3) ----------
// Se agregan desde el lector (tocar › Memorizar) o desde tus versículos.
// Página #biblia-memorizar: la lista con su caja y el próximo repaso, y
// "Repasar hoy". Practicar: primeras letras, ocultar palabras o escribirlo
// (sin que importen tildes ni puntuación). Lógica en js/biblia-memoria.js;
// datos en users/{uid}/meta/biblia_memoria. D-106.
(function () {
const B = window.BibliaMotor, T = window.BibliaTexto, M = window.BibliaMemoria;
if (!B || !T || !M || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const app = document.getElementById("bbm-app");
const hoja = window.Lectura.hoja("bbm-hoja");

let items = {};
let cargado = false;
// Sesión de práctica: { cola: [ids], i, modo, nivel, ver, resultado, hechos }
let ses = null;

const meta = () => db.collection("users").doc(currentUser.uid).collection("meta").doc("biblia_memoria");
const citaDe = it => T.cita(it.libro, it.cap, it.vers);
function avisar() { window.dispatchEvent(new CustomEvent("biblia:memoria")); }
function guardar(id, campos) {
  items[id] = Object.assign({}, items[id], campos);
  avisar();
  return meta().set({ items: { [id]: campos }, actualizado: Date.now() }, { merge: true })
    .catch(err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`));
}
const paraHoy = () => M.paraHoy(items, hoyLocal());
const lista = () => Object.keys(items).map(id => Object.assign({ id }, items[id])).filter(M.valido)
  .sort((a, b) => a.proximo.localeCompare(b.proximo) || (a.creado || 0) - (b.creado || 0));

// Agregar un versículo (desde el lector o tus versículos). → "nuevo" | "ya" |
// "cargando" (todavía no llegó la lista: no se escribe, para no reiniciar
// uno que ya estabas memorizando).
function agregar(o) {
  if (!cargado) return "cargando";
  const id = M.idDe(o.libro, o.cap, o.vers);
  if (items[id] && M.valido(items[id])) return "ya";
  guardar(id, M.nuevo(o, hoyLocal(), Date.now()));
  render();
  return "nuevo";
}

// ---- Tarjeta de hoy (arriba de Biblia) ----
function tarjetaHoy() {
  if (!cargado) return "";
  const n = paraHoy().length;
  if (!n) return "";
  return `<div class="bbm-hoy"><span aria-hidden="true">🧠</span>
    <p><b>${n} ${n === 1 ? "versículo" : "versículos"} para repasar hoy</b><small>Unos minutos para guardar la Palabra en el corazón.</small></p>
    <button type="button" class="lib-btn" data-bbm="repasar">Repasar</button></div>`;
}

// ---- Página ----
const cajas = c => `<span class="bbm-cajas" aria-label="Caja ${c} de ${M.CAJA_MAX}">${Array.from({ length: M.CAJA_MAX }, (_, i) => `<i class="${i < c ? "is-llena" : ""}"></i>`).join("")}</span>`;
function render() {
  if (!app) return;
  if (!cargado) { app.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const xs = lista();
  const hoy = hoyLocal();
  const due = paraHoy();
  if (!xs.length) {
    app.innerHTML = `<p class="empty-state">Todavía no elegiste versículos para memorizar. En «Leer la Biblia», toca un versículo › <b>Memorizar</b>; o abre uno de tus versículos y toca «🧠 Memorizar».</p>
      <p class="lib-nota">Cada versículo se repasa con más tiempo entre repaso y repaso si lo sabes (1, 2, 4, 8, 16 y 32 días); si no, vuelve al principio.</p>`;
    return;
  }
  const dominados = xs.filter(M.dominado).length;
  app.innerHTML = `
    <div class="bbm-resumen">
      <div><b>${xs.length}</b><span>${xs.length === 1 ? "versículo" : "versículos"}</span></div>
      <div><b>${due.length}</b><span>para hoy</span></div>
      <div><b>${dominados}</b><span>${dominados === 1 ? "dominado" : "dominados"}</span></div>
    </div>
    ${due.length ? `<button type="button" class="lib-btn lib-btn-ancho" data-bbm="repasar">Repasar hoy (${due.length})</button>`
      : `<p class="bbm-listo">✓ Hoy no tienes repasos. El próximo: ${esc(M.cuando(xs[0].proximo, hoy))}.</p>`}
    <ul class="bbm-lista">${xs.map(it => `
      <li class="bbm-item">
        <div class="bbm-item-cab"><b>${esc(citaDe(it))}</b>${it.version ? ` <i class="bib-version-tag">${esc(it.version)}</i>` : ""}${cajas(it.caja)}</div>
        <p class="bbm-item-t">${esc(it.texto)}</p>
        <div class="bbm-item-pie">
          <small>${M.dominado(it) ? "Dominado · " : ""}Próximo repaso: ${esc(M.cuando(it.proximo, hoy))}</small>
          <span><button type="button" class="lib-btn-sec" data-bbm-practicar="${esc(it.id)}">Practicar</button>
          <button type="button" class="bbm-quitar" data-bbm-quitar="${esc(it.id)}" aria-label="Quitar ${esc(citaDe(it))}">Quitar</button></span>
        </div>
      </li>`).join("")}
    </ul>`;
}

// ---- Practicar ----
const MODOS = [["letras", "Primeras letras"], ["ocultar", "Ocultar palabras"], ["escribir", "Escribirlo"]];
const modoPara = caja => (caja >= 5 ? "escribir" : caja >= 3 ? "ocultar" : "letras");
function practicar(ids) {
  if (!ids.length) return;
  const primero = items[ids[0]];
  ses = { cola: ids, i: 0, modo: modoPara(primero.caja), nivel: 1, ver: new Set(), mostrar: false, resultado: null, hechos: 0 };
  pintarPractica(true);
}
function pintarPractica(abrir) {
  const id = ses.cola[ses.i];
  const it = items[id];
  const titulo = ses.cola.length > 1 ? `Repaso · ${ses.i + 1} de ${ses.cola.length}` : "Practicar";
  let cuerpo = "";
  if (ses.modo === "letras") {
    cuerpo = `<p class="bbm-texto bbm-letras">${esc(ses.mostrar ? it.texto : M.primerasLetras(it.texto))}</p>
      <button type="button" class="lib-btn-sec" data-bbm="mostrar">${ses.mostrar ? "Ver solo las primeras letras" : "Ver el versículo"}</button>`;
  } else if (ses.modo === "ocultar") {
    cuerpo = `<p class="bbm-texto">${M.ocultar(it.texto, ses.nivel).map((x, k) => (x.oculta && !ses.ver.has(k) && !ses.mostrar
      ? `<button type="button" class="bbm-hueco" data-bbm-ver="${k}" style="--n:${Math.max(2, x.w.length)}" aria-label="Palabra oculta: tócala para verla"></button>`
      : `<span>${esc(x.w)}</span>`)).join(" ")}</p>
      <div class="bbm-nivel"><span>Ocultas:</span>
        ${[1, 2, 3].map(n => `<button type="button" class="bbl-chip${ses.nivel === n ? " is-activo" : ""}" data-bbm-nivel="${n}">${["", "pocas", "muchas", "todas"][n]}</button>`).join("")}
      </div>`;
  } else {
    const r = ses.resultado;
    cuerpo = r ? `<p class="bbm-pct ${r.ok ? "is-ok" : ""}">${r.pct} % · ${esc(r.ok ? "¡Lo sabías!" : r.pct >= 60 ? "Casi: repásalo mañana." : "Todavía no: vuelve mañana.")}</p>
        <p class="bbm-texto">${r.palabras.map(p => `<span class="${p.ok ? "" : "is-mal"}">${esc(p.w)}</span>`).join(" ")}</p>`
      : `<label class="lib-campo"><span>Escríbelo de memoria (no importan tildes ni puntuación)</span>
        <textarea class="lib-input" rows="5" data-bbm-escrito autocomplete="off" autocapitalize="sentences"></textarea></label>`;
  }
  const notas = ses.modo === "escribir"
    ? (ses.resultado ? `<button type="button" class="lib-btn lib-btn-ancho" data-bbm="siguiente">${ses.i + 1 < ses.cola.length ? "Siguiente" : "Terminar"}</button>`
      : `<button type="button" class="lib-btn lib-btn-ancho" data-bbm="comprobar">Comprobar</button>`)
    : `<p class="bbm-pregunta">¿Lo dijiste de memoria?</p>
      <div class="bbm-notas">
        <button type="button" class="bbm-nota is-mal" data-bbm-nota="mal">No lo sabía</button>
        <button type="button" class="bbm-nota is-duda" data-bbm-nota="duda">Me costó</button>
        <button type="button" class="bbm-nota is-bien" data-bbm-nota="bien">¡Lo sabía!</button>
      </div>`;
  const html = `
    <div class="bbm-practica">
      <div class="bbm-cita"><b>${esc(citaDe(it))}</b>${cajas(it.caja)}</div>
      <div class="bbl-filtros" role="group" aria-label="Cómo practicar">
        ${MODOS.map(([m, t]) => `<button type="button" class="bbl-chip${ses.modo === m ? " is-activo" : ""}" data-bbm-modo="${m}" aria-pressed="${ses.modo === m}">${t}</button>`).join("")}
      </div>
      ${cuerpo}
      ${notas}
    </div>`;
  if (abrir || !hoja.abierta()) hoja.abrir(titulo, html);
  else {
    hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = html;
    const t = hoja.el.querySelector("#bbm-hoja-t");
    if (t) t.textContent = titulo;
  }
}
function calificar(resultado) {
  const id = ses.cola[ses.i];
  guardar(id, M.calificar(items[id], resultado, hoyLocal()));
  ses.hechos++;
  siguiente();
}
function siguiente() {
  ses.i++;
  if (ses.i >= ses.cola.length) {
    const n = ses.hechos;
    ses = null;
    render();
    hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = `<div class="bbm-fin"><p class="bbm-fin-t">🎉 ¡Listo!</p>
      <p>Repasaste ${n} ${n === 1 ? "versículo" : "versículos"}. ${paraHoy().length ? `Te quedan ${paraHoy().length} para hoy.` : "Hasta el próximo repaso."}</p>
      <button type="button" class="lib-btn lib-btn-ancho" data-cerrar-hoja>Cerrar</button></div>`;
    return;
  }
  const it = items[ses.cola[ses.i]];
  Object.assign(ses, { modo: modoPara(it.caja), nivel: 1, ver: new Set(), mostrar: false, resultado: null });
  pintarPractica(false);
}

hoja.el.addEventListener("click", e => {
  if (!ses) return;
  const m = e.target.closest("[data-bbm-modo]");
  if (m) { Object.assign(ses, { modo: m.dataset.bbmModo, mostrar: false, resultado: null, ver: new Set() }); pintarPractica(false); return; }
  const v = e.target.closest("[data-bbm-ver]");
  if (v) { ses.ver.add(Number(v.dataset.bbmVer)); pintarPractica(false); return; }
  const n = e.target.closest("[data-bbm-nivel]");
  if (n) { ses.nivel = Number(n.dataset.bbmNivel); ses.ver = new Set(); pintarPractica(false); return; }
  const c = e.target.closest("[data-bbm-nota]");
  if (c) { calificar(c.dataset.bbmNota); return; }
  const b = e.target.closest("[data-bbm]");
  if (!b) return;
  if (b.dataset.bbm === "mostrar") { ses.mostrar = !ses.mostrar; pintarPractica(false); }
  else if (b.dataset.bbm === "comprobar") {
    const t = hoja.el.querySelector("[data-bbm-escrito]");
    ses.resultado = M.comparar(t ? t.value : "", items[ses.cola[ses.i]].texto);
    pintarPractica(false);
  } else if (b.dataset.bbm === "siguiente") calificar(M.resultadoDe(ses.resultado.pct));
});

document.addEventListener("click", e => {
  const b = e.target.closest('[data-bbm="repasar"]');
  if (b && !hoja.el.contains(b)) { practicar(paraHoy().map(x => x.id)); return; }
  const p = e.target.closest("[data-bbm-practicar]");
  if (p) { practicar([p.dataset.bbmPracticar]); return; }
  const q = e.target.closest("[data-bbm-quitar]");
  if (q) {
    const it = items[q.dataset.bbmQuitar];
    if (!it || !confirm(`¿Quitar ${citaDe(it)} de Memorizar?`)) return;
    delete items[q.dataset.bbmQuitar];
    avisar();
    render();
    meta().set({ items: { [q.dataset.bbmQuitar]: firebase.firestore.FieldValue.delete() }, actualizado: Date.now() }, { merge: true })
      .catch(err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`));
  }
});

onAuthReady(() => {
  meta().onSnapshot(s => {
    items = (s.exists && s.data().items) || {};
    cargado = true;
    avisar();
    if (!ses) render();
  }, err => console.warn("Biblia memoria:", err));
});
render();

window.BibliaMemoriaUI = { agregar, tarjetaHoy, render, paraHoy: () => paraHoy().length, crudos: () => JSON.parse(JSON.stringify(items)) };
})();
