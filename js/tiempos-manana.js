// ---------- Medir tiempos: "Medir ahora" y "Mi mañana" (pantalla, fase 6) ----------
// - Medir ahora (⏱ en cada actividad): un cronómetro grande; al terminar
//   guarda los segundos en ese día (si ya había, eliges reemplazar o sumar).
// - Mi mañana: tus pasos en tu orden (los de "Tus actividades" que van en la
//   mañana). Siguiente cierra un paso (y lo guarda) y abre el otro; puedes
//   pausar, saltar o terminar antes. En vivo ves si vas por encima de tu
//   promedio; al final, el resumen contra tu promedio.
// Todo por marcas de tiempo (js/tiempos-crono.js) y guardado en el teléfono:
// si el iPhone se bloquea o cierras la app, sigue donde ibas. La pantalla
// no se apaga mientras mides (Wake Lock, si el iPhone lo permite).
// Usa window.TiemposDatos (js/tiempos.js). D-113.
(function () {
"use strict";
const C = window.TiemposCrono, T = window.TiemposMotor, A = window.TiemposActividades;
if (!C || !T || !A || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const D = () => window.TiemposDatos || null;
const hoja = window.Lectura.hoja("tman-hoja");
const K_MEDIR = "manolo.tiempos.medir", K_MANANA = "manolo.tiempos.manana";
let tic = null, wake = null, modo = null;   // modo: "medir" | "manana" | "resumen" | null
let pendiente = null;                         // al terminar "Medir ahora" con un tiempo ya anotado: { st, seg, previo }

const leerLS = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const ponerLS = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } };
const actDe = id => (D() ? D().actividades().find(a => a.id === id) : null) || { id, nombre: id, emoji: "" };
const medirGuardado = () => { const st = leerLS(K_MEDIR); return C.cronoValido(st, hoyLocal(), Date.now()) ? st : null; };
const mananaGuardada = () => { const m = leerLS(K_MANANA); return C.mananaValida(m, hoyLocal(), Date.now()) ? m : null; };
const signo = s => `${s > 0 ? "+" : s < 0 ? "−" : "±"}${T.texto(Math.abs(s)) === "—" ? "0 s" : T.texto(Math.abs(s))}`;

// ---- Pantalla encendida ----
async function despierto(si) {
  try {
    if (si && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); }
    else if (!si && wake) { await wake.release(); wake = null; }
  } catch (e) { wake = null; }
}
function latir(si) {
  clearInterval(tic);
  tic = si ? setInterval(actualizarReloj, 250) : null;
  despierto(si);
}

// ---------- Medir ahora ----------
function medir(id) {
  const otro = medirGuardado();
  if (otro && otro.id !== id && !confirm(`Estás midiendo «${actDe(otro.id).nombre}». ¿Dejarlo y medir «${actDe(id).nombre}»?`)) { abrirMedir(); return; }
  if (!otro || otro.id !== id) ponerLS(K_MEDIR, C.iniciar(id, hoyLocal(), Date.now()));
  abrirMedir();
}
function abrirMedir() {
  const st = medirGuardado();
  if (!st) { cerrar(); return; }
  modo = "medir";
  const a = actDe(st.id), ahora = Date.now(), prom = (D() && D().promedios()[st.id]) || null;
  hoja.abrir("Medir ahora", `
    <div class="tman" data-tman-medir-hoja>
      <p class="tman-paso">${esc(A.etiqueta(a))}</p>
      <p class="tman-reloj" data-tman-reloj aria-live="off">${C.reloj(C.transcurrido(st, ahora))}</p>
      <p class="tman-prom" data-tman-prom>${prom ? `Tu promedio: ${T.texto(prom)}` : "Todavía no tienes promedio de esta actividad."}</p>
      ${pendiente ? `
      <div class="tman-elegir">
        <p>Ya tenías <b>${T.texto(pendiente.previo)}</b> este día. ¿Qué hago con estos <b>${T.texto(pendiente.seg)}</b>?</p>
        <button type="button" class="lib-btn lib-btn-ancho" data-tman="reemplazar">Reemplazar (queda ${T.texto(pendiente.seg)})</button>
        <button type="button" class="lib-btn-sec lib-btn-ancho" data-tman="sumar">Sumar (queda ${T.texto(pendiente.previo + pendiente.seg)})</button>
      </div>` : `
      <div class="tman-botones">
        <button type="button" class="lib-btn tman-grande" data-tman="terminar-medir">Terminar y guardar</button>
        <button type="button" class="lib-btn-sec" data-tman="pausa-medir">${C.enPausa(st) ? "▶ Seguir" : "⏸ Pausar"}</button>
        <button type="button" class="lib-btn-sec" data-tman="descartar-medir">Descartar</button>
      </div>
      <p class="lib-ayuda">Puedes bloquear el teléfono: el tiempo sigue contando.</p>`}
      <p class="lib-error" role="alert" hidden></p>
    </div>`);
  latir(!pendiente && !C.enPausa(st));
}
async function terminarMedir() {
  const st = medirGuardado();
  if (!st) { cerrar(); return; }
  const seg = C.segundos(st, Date.now());
  if (seg < 1) { aviso("Todavía no pasó ni un segundo."); return; }
  const previo = D() ? D().segDe(st.fecha, st.id) : 0;
  if (previo) { pendiente = { st, seg, previo }; abrirMedir(); return; }
  guardarMedir(st, seg);
}
function guardarMedir(st, seg) {
  const d = D();
  if (!d) return;
  d.guardar(st.fecha, st.id, Math.min(seg, 600 * 60));
  ponerLS(K_MEDIR, null);
  pendiente = null;
  latir(false);
  hoja.abrir("Medir ahora", `
    <div class="tman tman-listo">
      <p class="tman-ok">✓ Guardado</p>
      <p>${esc(A.etiqueta(actDe(st.id)))}: <b>${T.texto(Math.min(seg, 600 * 60))}</b> el ${esc(T.fechaLarga(st.fecha))}.</p>
      <button type="button" class="lib-btn lib-btn-ancho" data-cerrar-hoja>Listo</button>
    </div>`);
  modo = null;
}

// ---------- Mi mañana ----------
function empezarManana() {
  const d = D();
  if (!d) return;
  const pasos = A.pasosManana(d.ajustes()).map(a => a.id);
  if (!pasos.length) { alert("No tienes actividades en tu mañana. Elige cuáles van en «Tus actividades»."); return; }
  ponerLS(K_MANANA, C.empezar(pasos, hoyLocal(), Date.now()));
  abrirManana();
}
function abrirManana() {
  const m = mananaGuardada();
  if (!m) { cerrar(); return; }
  if (C.terminada(m)) { abrirResumen(m); return; }
  modo = "manana";
  const d = D(), prom = d ? d.promedios() : {}, ahora = Date.now();
  const id = C.actual(m), a = actDe(id);
  const pasos = m.pasos.map((p, k) => {
    const x = actDe(p), hecho = m.hechos[p], salto = m.saltados.includes(p);
    const est = k < m.i ? (hecho ? `✓ ${T.texto(hecho)}` : "saltado") : k === m.i ? "ahora" : prom[p] ? `≈ ${T.texto(prom[p])}` : "";
    return `<li class="${k < m.i ? (salto ? "is-saltado" : "is-hecho") : k === m.i ? "is-ahora" : ""}"><span>${esc(A.etiqueta(x))}</span><small>${esc(est)}</small></li>`;
  }).join("");
  hoja.abrir("Mi mañana", `
    <div class="tman" data-tman-manana-hoja>
      <p class="tman-cuenta">Paso ${m.i + 1} de ${m.pasos.length}</p>
      <p class="tman-paso">${esc(A.etiqueta(a))}</p>
      <p class="tman-reloj" data-tman-reloj aria-live="off">${C.reloj(C.transcurrido(m.paso, ahora))}</p>
      <p class="tman-prom" data-tman-prom></p>
      <div class="tman-botones">
        <button type="button" class="lib-btn tman-grande" data-tman="siguiente">${m.i + 1 < m.pasos.length ? `Siguiente: ${esc(actDe(m.pasos[m.i + 1]).nombre)} ›` : "Terminar ✓"}</button>
        <button type="button" class="lib-btn-sec" data-tman="pausa-manana">${C.enPausa(m.paso) ? "▶ Seguir" : "⏸ Pausar"}</button>
        <button type="button" class="lib-btn-sec" data-tman="saltar">Saltar (hoy no)</button>
      </div>
      <ol class="tman-pasos">${pasos}</ol>
      <button type="button" class="tman-link" data-tman="terminar-manana">Terminar la mañana aquí</button>
      <button type="button" class="tman-link is-tenue" data-tman="cancelar-manana">Cancelar (no guarda el paso de ahora)</button>
    </div>`);
  actualizarReloj();
  latir(!C.enPausa(m.paso));
}
function cerrarPaso(r) {
  if (r.cerrado && D()) D().guardar(r.m.fecha, r.cerrado.id, r.cerrado.seg);
  ponerLS(K_MANANA, r.m);
  if (C.terminada(r.m)) abrirResumen(r.m); else abrirManana();
}
function abrirResumen(m) {
  modo = "resumen";
  latir(false);
  const d = D(), r = C.resumen(m, d ? d.promedios() : {});
  const fila = p => `<li class="${p.saltado ? "is-saltado" : ""}"><span>${esc(A.etiqueta(actDe(p.id)))}</span>
    <b>${p.saltado ? "saltado" : T.texto(p.seg)}</b>${p.diferencia != null ? `<small class="${p.diferencia > 0 ? "is-mas" : "is-menos"}">${signo(p.diferencia)}</small>` : "<small></small>"}</li>`;
  const dif = r.diferencia;
  hoja.abrir("Mi mañana", `
    <div class="tman tman-resumen">
      <p class="tman-ok">✓ Mañana terminada</p>
      <p class="tman-total"><b>${T.texto(r.total)}</b> en ${r.hechos} ${r.hechos === 1 ? "paso" : "pasos"}${r.saltados ? ` (saltaste ${r.saltados})` : ""}</p>
      ${dif != null ? `<p class="tman-vs ${dif > 0 ? "is-mas" : "is-menos"}">${dif > 30 ? `${T.texto(dif)} más que tu promedio` : dif < -30 ? `${T.texto(-dif)} menos que tu promedio 🎉` : "Igual que tu promedio"}</p>` : ""}
      <ul class="tman-tabla">${r.pasos.map(fila).join("")}</ul>
      <p class="lib-ayuda">Los tiempos ya quedaron anotados en ${esc(T.fechaLarga(m.fecha))}. Puedes corregirlos abajo, en «Anotar tiempos».</p>
      <button type="button" class="lib-btn lib-btn-ancho" data-tman="listo-manana">Listo</button>
    </div>`);
}

// ---- El reloj en pantalla (sin repintar la hoja) ----
function actualizarReloj() {
  const el = hoja.el.querySelector("[data-tman-reloj]");
  if (!el) return;
  const ahora = Date.now();
  if (modo === "medir") {
    const st = medirGuardado();
    if (st) el.textContent = C.reloj(C.transcurrido(st, ahora));
    return;
  }
  if (modo !== "manana") return;
  const m = mananaGuardada();
  if (!m || !m.paso) return;
  el.textContent = C.reloj(C.transcurrido(m.paso, ahora));
  const v = C.contraPromedio(m, D() ? D().promedios() : {}, ahora), p = hoja.el.querySelector("[data-tman-prom]");
  el.classList.toggle("is-pasado", !!(v && v.pasado));
  if (p) p.textContent = !v ? "Sin promedio todavía para este paso." : v.pasado ? `Vas ${C.reloj(-v.falta)} por encima de tu promedio (${T.texto(v.promedio)}).` : `Tu promedio: ${T.texto(v.promedio)} · te quedan ${C.reloj(v.falta)}`;
}
function aviso(t) {
  const e = hoja.el.querySelector(".lib-error");
  if (e) { e.textContent = t; e.hidden = false; }
}
function cerrar() { latir(false); modo = null; pendiente = null; hoja.cerrar(); }

// ---- Tarjeta "Mi mañana" (arriba de Medir tiempos) ----
function tarjeta(el) {
  if (!el) return;
  const d = D();
  if (!d || !d.listo()) { el.innerHTML = ""; return; }
  const m = mananaGuardada(), st = medirGuardado(), prom = d.promedios();
  const pasos = A.pasosManana(d.ajustes());
  const midiendo = st ? `<button type="button" class="tman-midiendo" data-tman="ver-medir">⏱ Midiendo «${esc(actDe(st.id).nombre)}»: <b>${C.reloj(C.transcurrido(st, Date.now()))}</b> · Ver</button>` : "";
  if (m && !C.terminada(m)) {
    el.innerHTML = `${midiendo}<div class="tman-tarjeta is-en-curso">
      <h2 class="tmp-titulo">🌅 Mi mañana</h2>
      <p>Vas en el paso ${m.i + 1} de ${m.pasos.length}: <b>${esc(A.etiqueta(actDe(C.actual(m))))}</b></p>
      <button type="button" class="lib-btn lib-btn-ancho" data-tman="ver-manana">Seguir mi mañana ›</button>
    </div>`;
    return;
  }
  const total = pasos.reduce((s, a) => s + (prom[a.id] || 0), 0);
  const hecha = m && C.terminada(m) && m.fecha === hoyLocal() ? C.resumen(m, prom) : null;
  el.innerHTML = `${midiendo}<div class="tman-tarjeta">
    <h2 class="tmp-titulo">🌅 Mi mañana</h2>
    ${hecha ? `<p class="tman-hoy">✓ Hoy: <b>${T.texto(hecha.total)}</b>${hecha.diferencia != null ? ` (${signo(hecha.diferencia)} que tu promedio)` : ""} · <button type="button" class="tman-link" data-tman="ver-resumen">Ver</button></p>` : ""}
    ${pasos.length ? `<p class="tmp-nota">${pasos.map(a => esc(A.etiqueta(a))).join(" → ")}${total ? ` · ≈ ${T.texto(total)} en total` : ""}</p>
    <button type="button" class="lib-btn lib-btn-ancho" data-tman="empezar">▶ Empezar mi mañana</button>`
      : `<p class="tmp-nota">Elige qué actividades van en tu mañana en «Tus actividades».</p>`}
  </div>`;
}

// ---- Toques ----
document.addEventListener("click", e => {
  const b = e.target.closest("[data-tman], [data-tman-medir]");
  if (!b) return;
  if (b.dataset.tmanMedir) { medir(b.dataset.tmanMedir); return; }
  const que = b.dataset.tman, ahora = Date.now();
  if (que === "empezar") empezarManana();
  else if (que === "ver-manana") abrirManana();
  else if (que === "ver-medir") abrirMedir();
  else if (que === "ver-resumen") { const m = leerLS(K_MANANA); if (m && C.terminada(m)) abrirResumen(m); }
  else if (que === "siguiente") { const m = mananaGuardada(); if (m) cerrarPaso(C.siguiente(m, ahora)); }
  else if (que === "saltar") { const m = mananaGuardada(); if (m) cerrarPaso(C.saltar(m, ahora)); }
  else if (que === "terminar-manana") { const m = mananaGuardada(); if (m && confirm("¿Terminar la mañana aquí? Se guarda el paso de ahora y los que faltan quedan sin anotar.")) cerrarPaso(C.terminar(m, ahora)); }
  else if (que === "cancelar-manana") { if (confirm("¿Cancelar tu mañana? Los pasos que ya cerraste quedan anotados.")) { ponerLS(K_MANANA, null); cerrar(); refrescar(); } }
  else if (que === "pausa-manana") {
    const m = mananaGuardada();
    if (!m) return;
    ponerLS(K_MANANA, C.enPausa(m.paso) ? C.seguirManana(m, ahora) : C.pausarManana(m, ahora));
    abrirManana();
  }
  else if (que === "listo-manana") { cerrar(); refrescar(); }
  else if (que === "pausa-medir") { const st = medirGuardado(); if (st) { ponerLS(K_MEDIR, C.enPausa(st) ? C.seguir(st, ahora) : C.pausar(st, ahora)); abrirMedir(); } }
  else if (que === "terminar-medir") terminarMedir();
  else if (que === "descartar-medir") { if (confirm("¿Descartar este tiempo? No se guarda.")) { ponerLS(K_MEDIR, null); cerrar(); refrescar(); } }
  else if (que === "reemplazar" && pendiente) guardarMedir(pendiente.st, pendiente.seg);
  else if (que === "sumar" && pendiente) guardarMedir(pendiente.st, pendiente.previo + pendiente.seg);
});
// Al cerrar la hoja, el reloj de fondo se apaga (el tiempo sigue guardado).
hoja.el.addEventListener("click", e => { if (e.target.closest("[data-cerrar-hoja]")) { latir(false); modo = null; pendiente = null; setTimeout(refrescar, 250); } });
document.addEventListener("visibilitychange", () => { if (!document.hidden && modo) { if (modo === "medir") abrirMedir(); else if (modo === "manana") abrirManana(); } });
function refrescar() { const el = document.getElementById("tmp-manana"); if (el) tarjeta(el); }
window.addEventListener("tiempos:datos", refrescar);

window.TiemposManana = { tarjeta, medir, empezarManana, abrirManana, abrirMedir };
})();
