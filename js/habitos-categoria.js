// ---------- Hábitos: página de una categoría (#hab-categoria/{id}) ----------
// Nivel y XP de la categoría, cumplimiento de la semana y del mes contra el
// periodo anterior, mapa de calor, tendencia, sus hábitos por fuerza, en
// riesgo, mejor racha y sus logros. Los números salen del motor
// (HE.resumenCategoria / HE.deCategoria) y las tarjetas se reutilizan de
// Estadísticas (window.HabitosApp.conRes), así se ven igual.
(function () {
const A = window.HabitosApp;
const HE = window.HabitosEngine, HC = window.HabitosConfig, HCat = window.HabitosCategorias;
const panel = document.getElementById("panel-hab-categoria");
const cont = document.getElementById("hb-categoria");
if (!A || !panel || !cont) return;
const esc = s => A.escapeHtml(s);
const NIVELES_CAT = [5, 10, 15, 20];
const VOLVER = { habitos: "Hoy", "hab-stats": "Estadísticas", "hab-logros": "Logros" };

function idActual() {
  const m = /^#hab-categoria\/([^/?#]+)/.exec(location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

function render() {
  if (panel.hidden) return;
  const st = A.estado();
  if (!st.cargado || !st.res) { cont.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const id = idActual();
  const cat = A.areasDef().find(c => c.id === id);
  if (!cat) { cont.innerHTML = `<p class="empty-state">Esta categoría ya no existe. <a href="#habitos">Volver a Hoy</a></p>`; return; }
  const res = st.res;
  const area = res.areas.find(a => a.id === id) || { xp: 0, nivel: HE.nivelDeXP(0, HC.AREA_NIVEL) };
  const r = HE.resumenCategoria(res, id);
  const color = HCat.colorDe(cat);
  const nv = area.nivel;
  const falta = Math.max(0, nv.hasta - nv.xp);
  const ritmo = HE.ritmoXP(r.sub, 28);
  const dias = ritmo > 0 ? Math.ceil(falta / ritmo) : null;
  const pct = v => A.pctTexto(v);
  const racha = x => (x ? `${x.n} ${x.unidad === "semanas" ? (x.n === 1 ? "semana" : "semanas") : x.n === 1 ? "día" : "días"}` : "—");
  const nombreHab = x => (x && st.normal[x.id] ? `${esc(st.normal[x.id].emoji)} ${esc(st.normal[x.id].name)}` : "");

  let html = `<header class="hb-cat-head" style="--cat:${color}">
      <span class="hb-cat-head-emoji" aria-hidden="true">${esc(cat.emoji)}</span>
      <div class="hb-cat-head-txt"><h1 class="page-title">${esc(cat.nombre)}</h1>
        <span>${A.plural(r.activos, "hábito activo", "hábitos activos")}${cat.archivada ? " · archivada" : ""}</span></div>
      <button type="button" class="hb-btn-sec" data-catpag-editar>Editar</button>
    </header>
    <section class="hb-card hb-cat-nivel" style="--cat:${color}" aria-label="Nivel de ${esc(cat.nombre)}">
      <div class="hb-pj-nivel"><span class="hb-num">${nv.nivel}</span><span><span class="hb-pj-t">Nivel</span><span class="hb-pj-titulo">${A.fmtNum(nv.xp)} XP en ${esc(cat.nombre)}</span></span></div>
      ${A.barra(nv.progreso, `Experiencia de ${cat.nombre} hacia el nivel ${nv.nivel + 1}`)}
      <p class="hb-nivel-ritmo">Te faltan <b>${A.fmtNum(falta)} XP</b> para el nivel ${nv.nivel + 1}${dias ? `: a tu ritmo, ${A.enTiempo(dias)}` : ""}.</p>
    </section>`;

  if (!r.total) {
    html += `<div class="hb-vacio">
      <p class="hb-vacio-t">Todavía no tienes hábitos en ${esc(cat.nombre)}</p>
      <p>Crea uno nuevo o pásale hábitos que ya tienes.</p>
      <div class="hb-chips"><button type="button" class="hb-btn" data-catpag-nuevo>Crear un hábito</button>
        <button type="button" class="hb-btn-sec" data-catpag-asignar>Asignar hábitos</button></div></div>`;
    cont.innerHTML = html;
    A.renderIcons(cont);
    return;
  }

  html += `<section class="hb-kpis hb-cat-kpis" aria-label="Cumplimiento">
      <div class="hb-kpi"><span class="hb-kpi-label">Esta semana</span><span class="hb-num">${pct(r.semana.pct)}</span>${A.delta(r.semana.pct, r.semana.previo, "pts")}<span class="hb-kpi-pie">contra la anterior</span></div>
      <div class="hb-kpi"><span class="hb-kpi-label">Últimos 30 días</span><span class="hb-num">${pct(r.mes.pct)}</span>${A.delta(r.mes.pct, r.mes.previo, "pts")}<span class="hb-kpi-pie">contra los 30 anteriores</span></div>
      <div class="hb-kpi"><span class="hb-kpi-label">Racha activa</span><span class="hb-num">${racha(r.racha)}</span><span class="hb-kpi-pie">${nombreHab(r.racha) || "Sin racha activa"}</span></div>
      <div class="hb-kpi"><span class="hb-kpi-label">Mejor racha</span><span class="hb-num">${racha(r.mejorRacha)}</span><span class="hb-kpi-pie">${nombreHab(r.mejorRacha)}</span></div>
    </section>`;
  html += A.conRes(r.sub, () => A.heatmapHtml() + A.tendenciaHtml({ clave: "30d" }) + A.rankingHtml() + A.riesgoHtml());
  html += A.tarjeta(`Logros de ${esc(cat.nombre)}`, `<ul class="hb-logros hb-cat-logros">${NIVELES_CAT.map(n => {
    const ok = nv.nivel >= n;
    const fr = Math.min(1, area.xp / HE.xpParaNivel(n, HC.AREA_NIVEL));
    return `<li class="hb-logro${ok ? " is-on" : ""}"><span class="hb-logro-ico" aria-hidden="true"><span data-icon="trophy"></span></span>
      <span class="hb-logro-txt"><b>${esc(cat.nombre)} nivel ${n}</b><span>${n === 5 ? "Especialista" : n === 10 ? "Maestría" : n === 15 ? "Referente" : "Leyenda de la categoría"}</span>
      ${ok ? `<span class="hb-tag">Conseguido</span>` : `${A.barra(fr, `${cat.nombre} nivel ${n}`)}<span class="hb-logro-prog">${A.fmtNum(area.xp)} de ${A.fmtNum(HE.xpParaNivel(n, HC.AREA_NIVEL))} XP</span>`}</span></li>`;
  }).join("")}</ul>`);
  html += `<div class="hb-acciones hb-cat-pie"><button type="button" class="hb-btn-sec" data-catpag-stats>Ver en Estadísticas</button>
    <button type="button" class="hb-btn-sec" data-catpag-nuevo>Nuevo hábito en ${esc(cat.nombre)}</button></div>`;
  const scroll = cont.querySelector(".hb-heat-scroll");
  const izq = scroll ? scroll.scrollLeft : null;
  cont.innerHTML = html;
  const s = cont.querySelector(".hb-heat-scroll");
  if (s) s.scrollLeft = izq != null ? izq : s.scrollWidth;
  A.renderIcons(cont);
}

// El enlace "atrás" vuelve a la pantalla de donde viniste.
let desde = "habitos";
window.addEventListener("hashchange", e => {
  const antes = ((e.oldURL || "").split("#")[1] || "").split("/")[0];
  if (/^#hab-categoria\//.test(location.hash) && VOLVER[antes]) desde = antes;
  const volver = panel.querySelector(".back-link");
  if (volver) { volver.setAttribute("href", "#" + desde); volver.lastChild.textContent = VOLVER[desde]; }
  render();
});
document.addEventListener("habitos:actualizado", render);
new MutationObserver(() => { if (!panel.hidden) render(); }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });

cont.addEventListener("click", e => {
  const id = idActual();
  const q = sel => e.target.closest(sel);
  let b;
  if ((b = q("[data-dia]"))) { A.hojaDia(b.dataset.dia); return; }
  if ((b = q("[data-detalle]"))) { A.hojaDetalle(b.dataset.detalle); return; }
  if (q("[data-catpag-editar]") && window.HabitosCategoriasUI) { HabitosCategoriasUI.abrirEditor(id, "pagina"); return; }
  if (q("[data-catpag-nuevo]")) { A.nuevoHabito(id); return; }
  if (q("[data-catpag-asignar]") && window.HabitosCategoriasUI) { HabitosCategoriasUI.abrirAsignar({ hacia: id }); return; }
  if (q("[data-catpag-stats]")) {
    try { localStorage.setItem("hb-stats-filtro", id); } catch (err) { /* sin almacenamiento */ }
    A.filtrarStats(id);
    location.hash = "hab-stats";
  }
});
cont.addEventListener("keydown", e => {
  const dia = e.target.closest && e.target.closest("[data-dia]");
  if (dia && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); A.hojaDia(dia.dataset.dia); }
});
})();
