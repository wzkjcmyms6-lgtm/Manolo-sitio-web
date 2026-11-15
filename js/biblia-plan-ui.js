// ---------- Biblia: planes de lectura (pantalla, fase 3) ----------
// Tarjetas de "Hoy" arriba de Biblia (la lectura de hoy en un toque, el
// avance y, si te atrasas, ponerte al día de a poco o mover el plan), la
// página #biblia-planes (elegir, ver y quitar planes) y el aviso en el
// lector ("Plan de hoy: 1 de 3 · Seguir con …"). Lógica en
// js/biblia-planes.js; datos en users/{uid}/meta/biblia_planes. D-106.
(function () {
const B = window.BibliaMotor, P = window.BibliaPlanes, L = window.BibliaLector;
if (!B || !P || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const app = document.getElementById("bpl-app");

let planes = {};      // id → plan
let cargado = false;
const DIAS_AL_DIA = 7;

const meta = () => db.collection("users").doc(currentUser.uid).collection("meta").doc("biblia_planes");
const activos = () => Object.keys(planes).map(id => Object.assign({ id }, planes[id])).filter(p => p.activo && P.TIPOS[p.tipo])
  .sort((a, b) => (a.creado || 0) - (b.creado || 0));
const estados = () => { const hoy = hoyLocal(), leidos = L.leidos(); return activos().map(p => ({ plan: p, e: P.estado(p, leidos, hoy) })).filter(x => x.e); };
function avisar() { window.dispatchEvent(new CustomEvent("biblia:planes")); }
function guardar(id, campos) {
  planes[id] = Object.assign({}, planes[id], campos);   // al instante en pantalla
  avisar();
  render();
  return meta().set({ planes: { [id]: campos }, actualizado: Date.now() }, { merge: true })
    .catch(err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`));
}
const primera = keys => { const k = P.leerClave(keys[0]); return k || null; };
// "jue 12 nov 2026" → "12 nov" (con el año solo si no es este).
const fechaCorta = f => B.fechaLarga(f).replace(/^\S+ /, "").replace(new RegExp(` ${hoyLocal().slice(0, 4)}$`), "");

// ---- Tarjetas de hoy (arriba de Biblia) ----
function tarjeta(x) {
  const { plan, e } = x;
  const barra = `<span class="bpl-barra" aria-hidden="true"><i style="width:${Math.min(100, e.progreso.pct)}%"></i></span>`;
  if (e.terminado) {
    return `<div class="bpl-hoy is-hecho">
      <div class="bpl-hoy-cab"><b>🎉 ${esc(e.nombre)}</b><small>¡Terminado!</small></div>
      <p class="bpl-hoy-t">Leíste los ${e.progreso.total} capítulos. ¡Bien hecho!</p>
      <a class="bpl-mini" href="#biblia-planes">Elegir otro plan</a>
    </div>`;
  }
  const hoyListo = !e.lectura.length;
  const dia = e.diario ? fechaCorta(hoyLocal()) : e.pasado ? `Pasó el día ${e.dias}` : `Día ${e.dia} de ${e.dias}`;
  return `<div class="bpl-hoy${hoyListo ? " is-hecho" : ""}">
    <div class="bpl-hoy-cab"><b>📅 ${esc(e.nombre)}</b><small>${esc(dia)}${e.diario ? (e.racha ? ` · 🔥 ${e.racha}` : "") : ` · ${e.progreso.pct} %`}</small></div>
    ${e.diario ? "" : barra}
    ${hoyListo
      ? `<p class="bpl-hoy-t">✓ La lectura de hoy está hecha${e.diario ? "" : `: ${esc(P.texto(e.extraHoy.concat(e.deHoy)))}`}.</p>`
      : `<div class="bpl-hoy-fila"><p class="bpl-hoy-t">Hoy: <b>${esc(P.texto(e.lectura))}</b></p>
         <button type="button" class="lib-btn bpl-leer" data-bpl-leer="${esc(plan.id)}">Leer</button></div>`}
    ${e.atrasados.length ? `<div class="bpl-atraso">
      <p>${e.alDia ? `Poniéndote al día hasta el ${esc(fechaCorta(e.alDia.hasta))}: faltan ${e.atrasados.length} ${e.atrasados.length === 1 ? "capítulo" : "capítulos"}.` : `Vas ${e.atrasados.length} ${e.atrasados.length === 1 ? "capítulo" : "capítulos"} atrasado: repártelos en ${DIAS_AL_DIA} días o mueve el plan.`}</p>
      ${e.alDia ? "" : `<div class="bpl-atraso-b">
        <button type="button" class="lib-btn-sec" data-bpl-aldia="${esc(plan.id)}">Ponerme al día</button>
        <button type="button" class="lib-btn-sec" data-bpl-mover="${esc(plan.id)}">Mover el plan</button>
      </div>`}
    </div>` : ""}
  </div>`;
}
function tarjetasHoy() {
  if (!cargado) return "";
  const xs = estados();
  if (!xs.length) {
    return `<a class="bpl-sugerencia" href="#biblia-planes"><span aria-hidden="true">📅</span><span><b>Elige un plan de lectura</b><small>Biblia en un año, Evangelios en 30 días, Proverbios del día…</small></span><span class="bbl-entrar-flecha" aria-hidden="true">›</span></a>`;
  }
  return `<div class="bpl-hoy-lista">${xs.map(tarjeta).join("")}</div>`;
}

// ---- En el lector: el plan de hoy ----
// → { texto, sig: { libro, cap } | null } si el capítulo abierto es de la
// lectura de hoy de algún plan.
function enLector(libro, cap) {
  const k = P.clave(libro, cap);
  for (const { e } of estados()) {
    const hoyTodo = Array.from(new Set(e.extraHoy.concat(e.deHoy)));
    if (!hoyTodo.includes(k)) continue;
    const faltan = e.lectura.filter(x => x !== k);
    const hechas = hoyTodo.length - e.lectura.length;
    const sig = faltan.length ? P.leerClave(faltan[0]) : null;
    return { plan: e.nombre, texto: faltan.length || e.lectura.includes(k) ? `${hechas} de ${hoyTodo.length} de hoy` : "✓ Lectura de hoy completa", sig };
  }
  return null;
}

// ---- Página "Planes de lectura" ----
function render() {
  if (!app) return;
  if (!cargado) { app.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const hoy = hoyLocal();
  const xs = estados();
  const tipos = new Set(xs.map(x => x.plan.tipo));
  app.innerHTML = `
    ${xs.length ? `<h2 class="bpl-t">Tus planes</h2>
    <div class="bpl-activos">${xs.map(({ plan, e }) => `
      <section class="bpl-plan">
        ${tarjeta({ plan, e })}
        <p class="lib-nota">Empezaste el ${esc(fechaCorta(plan.inicio))}${P.fin(plan) && !e.terminado ? ` · terminas el ${esc(fechaCorta(P.fin(plan)))}` : ""}${e.diario ? ` · ${e.progreso.leidos} de ${e.progreso.total} días este mes` : ` · ${e.progreso.leidos} de ${e.progreso.total} capítulos`}.</p>
        <button type="button" class="bpl-quitar" data-bpl-quitar="${esc(plan.id)}">Quitar este plan</button>
      </section>`).join("")}</div>` : ""}
    <h2 class="bpl-t">${xs.length ? "Sumar otro plan" : "Elige un plan"}</h2>
    <p class="lib-nota">La lectura de cada día aparece arriba de Biblia. Si lees en tu Biblia de papel, márcala con «✓ Ya leí lo de hoy»; en el lector, con «Marcar como leído».</p>
    <div class="bpl-tipos">${P.ORDEN_TIPOS.filter(t => !tipos.has(t) || t === "ritmo").map(t => {
      const d = P.TIPOS[t];
      return `<section class="bpl-tipo">
        <h3>${esc(d.nombre)}</h3>
        <p>${esc(d.descripcion)}</p>
        ${t === "ritmo" ? `<div class="bpl-ritmo">
          <label class="lib-campo"><span>Capítulos por día</span><input type="number" inputmode="numeric" min="1" max="50" value="3" class="lib-input" data-bpl-pordia></label>
          <label class="lib-campo"><span>Empezar en</span><select class="lib-input" data-bpl-desde>${B.LIBROS.map(l => `<option value="${l.id}"${l.id === "Matt" ? " selected" : ""}>${esc(l.nombre)}</option>`).join("")}</select></label>
        </div>` : ""}
        <button type="button" class="lib-btn" data-bpl-empezar="${t}">Empezar hoy</button>
      </section>`;
    }).join("")}</div>`;
  void hoy;
}

// ---- Acciones ----
document.addEventListener("click", e => {
  const leer = e.target.closest("[data-bpl-leer]");
  if (leer) {
    const x = estados().find(y => y.plan.id === leer.dataset.bplLeer);
    const k = x && primera(x.e.lectura);
    if (k) L.abrir(k.libro, k.cap, { y: 0 });
    return;
  }
  const ad = e.target.closest("[data-bpl-aldia]");
  if (ad) { guardar(ad.dataset.bplAldia, { alDia: P.ponerseAlDia(hoyLocal(), DIAS_AL_DIA) }); return; }
  const mv = e.target.closest("[data-bpl-mover]");
  if (mv) {
    const p = planes[mv.dataset.bplMover];
    if (!p) return;
    const corr = P.mover(p, L.leidos(), hoyLocal());
    if (!confirm("¿Mover el plan? Hoy vuelves a empezar desde lo que te falta y el plan termina más tarde. Lo que ya leíste queda.")) return;
    guardar(mv.dataset.bplMover, { corrimiento: corr, alDia: null });
    return;
  }
  const em = e.target.closest("[data-bpl-empezar]");
  if (em) {
    const caja = em.closest(".bpl-tipo");
    const o = { tipo: em.dataset.bplEmpezar, hoy: hoyLocal(), ahora: Date.now() };
    if (o.tipo === "ritmo") {
      o.porDia = Number(caja.querySelector("[data-bpl-pordia]").value);
      o.desde = caja.querySelector("[data-bpl-desde]").value;
    }
    const plan = P.nuevo(o);
    if (!plan) return;
    const id = `p${Date.now().toString(36)}`;
    guardar(id, plan);
    location.hash = "#biblia";
    return;
  }
  const q = e.target.closest("[data-bpl-quitar]");
  if (q) {
    const p = planes[q.dataset.bplQuitar];
    if (!p || !confirm(`¿Quitar «${P.TIPOS[p.tipo].nombre}»? Lo que leíste no se borra.`)) return;
    guardar(q.dataset.bplQuitar, { activo: false, quitado: hoyLocal() });
  }
});
window.addEventListener("biblia:lector", () => { render(); });

onAuthReady(() => {
  meta().onSnapshot(s => {
    planes = (s.exists && s.data().planes) || {};
    cargado = true;
    avisar();
    render();
  }, err => console.warn("Biblia planes:", err));
});
render();

window.BibliaPlanesUI = { tarjetasHoy, enLector, estados, render, crudos: () => JSON.parse(JSON.stringify(planes)) };
})();
