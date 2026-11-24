// ---------- Ropa: Compras (#ropa-compras, D-150) ----------
// Arriba, tu presupuesto de ropa del mes (si quieres uno): lo que gastaste
// (el precio de lo que compraste este mes) y lo que te queda. "Qué te falta":
// lo que se repite en tus inspiraciones de Pinterest y no tienes, con las
// fotos de esos pines, cuántos outfits nuevos te daría con tu ropa, "Ver
// opciones en Pinterest" (abre Pinterest con la búsqueda lista) y "A mi
// lista". "Tu lista de deseos": "Lo compré" (pasa a tu ropero, con foto o sin
// foto), "Ver en Pinterest" y "Ya no lo quiero" (con Deshacer); abajo, lo que
// compraste. "Qué no comprar": lo que ya tienes de sobra. Manolo nunca compra
// nada. Antes de "Qué te falta", lo que opina tu estilista de tu ropero (D-160,
// js/ropa-opinion.js); si tu estilista también sugiere algo que te falta, lo
// dice, y en tu lista se ve lo que te sugirió (D-161). Reglas:
// js/ropa-compras-motor.js; datos: js/ropa-compras-datos.js.
(function () {
"use strict";
const M = window.RopaMotor, K = window.RopaComprasMotor, D = window.RopaDatos, DI = window.RopaInspDatos, DD = window.RopaComprasDatos;
const A = () => window.RopaApp, I = () => window.RopaInspMotor, F = () => window.RopaForm;
const app = document.getElementById("rco-app");
if (!M || !K || !D || !DI || !DD || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const pantalla = () => location.hash.replace(/^#/, "").split("/")[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const plata = n => `Bs\u00a0${n.toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
const aviso = (t, d) => A().aviso(t, d);
const fallo = e => A().fallo(e);
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const puntos = cs => `<span class="ro-puntos" aria-hidden="true">${cs.map(id => `<i style="background:${esc(M.COLOR[id] ? M.COLOR[id].hex : "#888")}"></i>`).join("")}</span>`;
const afuera = (href, texto, clase) => `<a class="${clase || "lib-btn-sec"}" href="${esc(href)}" target="_blank" rel="noopener">${icono("externo")}${texto}<span class="visually-hidden"> (se abre aparte)</span></a>`;
const presupuestoAhora = () => K.presupuesto((DI.ajustes() || {}).presupuestoMes);

// Las fotos de los pines (cada una lleva a su pin).
function pinesHTML(ids, max) {
  const xs = ids.map(id => DI.una(id)).filter(Boolean);
  if (!xs.length || !I()) return "";
  const vis = xs.slice(0, max || 6);
  return `<ul class="rco-pines">${vis.map(x => {
    const f = x.fotos[0], src = f && f.mini ? f.mini : x.pin && x.pin.img ? x.pin.img : "";
    return `<li><a class="rco-pin" href="#ropa-pin/${encodeURIComponent(x.id)}" aria-label="Ver la inspiración «${esc(I().titulo(x))}»">${src ? `<img src="${esc(src)}" alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer">` : icono("imagen")}</a></li>`;
  }).join("")}${xs.length > vis.length ? `<li class="rco-pin-mas"><span aria-hidden="true">+${xs.length - vis.length}</span><span class="visually-hidden">y ${plural(xs.length - vis.length, "inspiración más", "inspiraciones más")}</span></li>` : ""}</ul>`;
}

// ---------- Tu presupuesto ----------
function presupuestoHTML() {
  const mes = D.hoy().slice(0, 7), nombreMes = MESES[Number(mes.slice(5, 7)) - 1];
  const g = K.gastoDelMes(D.lista(), mes), tope = presupuestoAhora();
  const cab = `<h2 class="ro-sub" id="rco-plata-t">${icono("wallet")}Tu presupuesto de ropa</h2>`;
  const gastado = `<b>${plata(g.total)}</b>${g.n ? ` (${plural(g.n, "prenda", "prendas")})` : ""}`;
  const sinPrecio = g.sinPrecio ? `<p class="rd-nota">${plural(g.sinPrecio, "prenda de este mes no tiene", "prendas de este mes no tienen")} precio: no ${g.sinPrecio === 1 ? "cuenta" : "cuentan"}.</p>` : "";
  if (!tope) {
    return `<section class="tmp-card rco-plata" aria-labelledby="rco-plata-t">${cab}
      <p>En ${nombreMes} gastaste ${gastado} en ropa.</p>${sinPrecio}
      <button type="button" class="lib-btn-sec lib-btn-chico" data-rco="presupuesto" aria-haspopup="dialog">Ponerme un presupuesto</button></section>`;
  }
  const pct = Math.min(100, Math.round((g.total / tope) * 100)), queda = Math.round((tope - g.total) * 100) / 100;
  return `<section class="tmp-card rco-plata${queda < 0 ? " is-pasado" : ""}" aria-labelledby="rco-plata-t">${cab}
    <p>En ${nombreMes}: ${gastado} de ${plata(tope)}</p>
    <div class="rp-zap-barra rco-barra" role="img" aria-label="Llevas el ${pct} % de tu presupuesto del mes"><i style="width:${pct}%"></i></div>
    <p class="rco-queda">${queda >= 0 ? `Te quedan <b>${plata(queda)}</b>.` : `Te pasaste por <b>${plata(-queda)}</b>.`}</p>${sinPrecio}
    <button type="button" class="lib-btn-sec lib-btn-chico" data-rco="presupuesto" aria-haspopup="dialog">Cambiar</button></section>`;
}

// ---------- Qué te falta ----------
let faltanAhora = [];
function faltanHTML() {
  const cab = `<h2 class="ro-sub" id="rco-faltan-t">${icono("inspiracion")}Qué te falta</h2>`;
  const caja = cuerpo => `<section class="rco-sec" aria-labelledby="rco-faltan-t">${cab}${cuerpo}</section>`;
  if (!DI.cargada()) return caja(`<p class="rd-nota">Cargando tus inspiraciones…</p>`);
  const insp = DI.lista();
  const conRopa = insp.filter(x => x.analisis && x.analisis.esRopa && x.analisis.prendas.length);
  if (conRopa.length < 2) {
    return caja(`<p class="rd-nota">${insp.length ? "Cuando la IA mire tus inspiraciones, aquí verás lo que se repite en ellas y no tienes."
      : "Guarda tus inspiraciones de Pinterest y aquí verás lo que se repite en ellas y no tienes."}</p><a class="lib-btn-sec" href="#ropa-inspiracion">Ir a Inspiración</a>`);
  }
  const ropero = D.lista();
  faltanAhora = K.faltan(insp, ropero).slice(0, 8);
  // Lo que también sugiere tu estilista (en su último repaso; D-161).
  const RO = window.RopaOpinion, P = window.RopaOpinionMotor;
  const op = RO && RO.ultima && P ? RO.ultima() : null;
  const sugiere = new Set(op ? op.ia.sugerencias.map(x => K.clave(P.cosaDe(x))) : []);
  if (!faltanAhora.length) return caja(`<p class="rd-nota">Lo que se repite en tus inspiraciones ya está en tu ropero.</p>`);
  return caja(`<p class="rd-nota">Lo que más se repite en tus inspiraciones y no tienes.</p>
    <ol class="rco-lista">${faltanAhora.map((f, i) => {
      const n = K.outfitsNuevos(f, ropero), ya = DD.deClave(f.clave);
      return `<li class="tmp-card rco-item">
        <h3 class="rco-t">${puntos(f.colores)}<span>${esc(f.nombre)}</span></h3>
        <p class="rco-cuantas">En ${f.n} de tus inspiraciones · ${f.otroColor ? "en tu ropero, solo de otro color" : "no está en tu ropero"}</p>
        ${sugiere.has(f.clave) ? `<p class="rco-cuantas rco-estilista">${icono("sparkle")}Tu estilista también lo sugiere.</p>` : ""}
        ${pinesHTML(f.pines)}
        <p class="rco-outfits">${icono("outfit")}<span>${n ? `Con tu ropa: <b>${plural(n, "outfit nuevo", "outfits nuevos")}</b>` : "Con tu ropa de ahora no combina mucho"}</span></p>
        <div class="rco-bot">
          ${ya ? `<span class="rco-en-lista">${icono("check")}En tu lista</span>` : `<button type="button" class="lib-btn" data-rco-agregar="${i}">${icono("plus")}A mi lista</button>`}
          ${afuera(K.buscar(f), "Ver opciones en Pinterest")}
        </div></li>`;
    }).join("")}</ol>`);
}

// ---------- Tu lista de deseos ----------
function listaHTML() {
  const cab = `<h2 class="ro-sub" id="rco-lista-t">${icono("heart")}Tu lista de deseos</h2>`;
  const qs = DD.quiero(), compradas = DD.lista().filter(d => d.estado === "comprado");
  const cuerpo = !DD.cargada() ? `<p class="rd-nota">Cargando…</p>`
    : qs.length ? `<ol class="rco-lista">${qs.map(d => `<li class="tmp-card rco-item rco-deseo">
        <h3 class="rco-t">${puntos(d.colores)}<span>${esc(d.nombre)}</span></h3>
        ${d.origen === "estilista" ? `<p class="rco-cuantas rco-estilista">${icono("sparkle")}Te lo sugirió tu estilista</p>` : ""}
        ${d.inspiraciones.length ? `<p class="rco-cuantas">De ${plural(d.inspiraciones.length, "inspiración", "inspiraciones")}</p>${pinesHTML(d.inspiraciones, 4)}` : ""}
        ${d.nota ? `<p class="rco-nota">${esc(d.nota)}</p>` : ""}
        <div class="rco-bot">
          <button type="button" class="lib-btn" data-rco-compre="${esc(d.id)}" aria-haspopup="dialog">${icono("check")}Lo compré</button>
          ${afuera(K.buscar(d), "Ver en Pinterest")}
          <button type="button" class="lib-btn-sec" data-rco-quitar="${esc(d.id)}">${icono("close")}Ya no lo quiero</button>
        </div></li>`).join("")}</ol>`
      : `<p class="rd-nota">Todavía no hay nada. Toca «A mi lista» en lo que te falta o en un pin.</p>`;
  const hechas = compradas.length ? `<details class="rco-compradas"><summary>Lo que compraste (${compradas.length})</summary><ul>${compradas.map(d => {
    const p = d.prendaId ? D.una(d.prendaId) : null;
    return `<li>${p ? `<a href="#ropa-prenda/${encodeURIComponent(p.id)}">${esc(M.titulo(p))}</a>` : esc(d.nombre)}${d.compradoFecha ? ` <small class="rd-nota">· ${esc(M.fechaLarga(d.compradoFecha))}</small>` : ""}</li>`;
  }).join("")}</ul></details>` : "";
  return `<section class="rco-sec" aria-labelledby="rco-lista-t">${cab}${cuerpo}${hechas}</section>`;
}

// ---------- Qué no comprar ----------
function sobraHTML() {
  const cab = `<h2 class="ro-sub" id="rco-sobra-t">${icono("ropa")}Qué no comprar</h2>`;
  const xs = K.deSobra(D.lista()).slice(0, 6);
  const cuerpo = xs.length ? `<p class="rd-nota">Ya tienes de sobra: mejor no sumar otra.</p><ul class="tmp-card rco-sobra">${xs.map(x => `<li>
      <span class="rco-sobra-fotos" aria-hidden="true">${x.prendas.slice(0, 3).map(id => { const p = D.una(id); return p ? A().fotoHTML(p, "ro-foto") : ""; }).join("")}</span>
      <span><b>${esc(x.nombre)}</b> <small class="rd-nota">· tienes ${x.n}</small></span></li>`).join("")}</ul>`
    : `<p class="rd-nota">No tienes nada repetido de más (3 o más del mismo tipo y color).</p>`;
  return `<section class="rco-sec" aria-labelledby="rco-sobra-t">${cab}${cuerpo}</section>`;
}

function render() {
  if (pantalla() !== "ropa-compras") return;
  if (!D.cargada()) { app.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  app.innerHTML = `${presupuestoHTML()}${window.RopaOpinion ? window.RopaOpinion.html() : ""}${faltanHTML()}${listaHTML()}${sobraHTML()}
    <p class="rd-nota rco-nunca">Manolo nunca compra nada: solo te muestra ideas.</p>`;
  pintarIconos(app);
}

// ---------- Lo que tocas ----------
function agregarFalta(i, b) {
  const f = faltanAhora[i];
  if (!f) return;
  b.disabled = true;
  DD.agregar(f, { inspiraciones: f.pines, origen: "falta" })
    .then(r => aviso(`Listo: ${f.nombre} está en tu lista de deseos.`, r.nuevo ? () => DD.borrar(r.id).catch(fallo) : null), e => { b.disabled = false; fallo(e); });
}
function compre(id, b) {
  const d = DD.una(id);
  if (!d || !F() || !F().comprar) return;
  F().comprar({ grupo: d.grupo, tipo: d.tipo, colores: d.colores.map(c => ({ id: c })) }, prendaId => DD.comprado(id, prendaId).catch(fallo), b);
}
function quitar(id) {
  const d = DD.una(id), antes = DD.crudo(id);
  if (!d) return;
  DD.descartar(id).catch(fallo);
  aviso(`Quitaste ${d.nombre} de tu lista.`, () => DD.restaurar(id, antes).catch(fallo));
}
// "1.500" o "1500,50" → número (en Bolivia el punto separa los miles).
function leerMonto(s) {
  const t = String(s || "").replace(/\s/g, "").replace(/^Bs\.?/i, "");
  return /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t.replace(",", "."));
}
function editarPresupuesto(desde) {
  const h = A().hoja("rco-hoja-plata");
  const tope = presupuestoAhora();
  h.mostrar("Tu presupuesto de ropa", `<form class="rin-form rco-plata-form" novalidate>
    <p class="rd-nota">Cuánto quieres gastar en ropa por mes. Manolo suma el precio de lo que compras (el que pones en cada prenda) y te dice cuánto te queda.</p>
    <label class="rd-campo">Por mes (Bs)<input class="lib-input" name="tope" inputmode="decimal" autocomplete="off" value="${tope ? esc(String(tope)) : ""}" placeholder="Por ejemplo: 500"></label>
    <p class="rin-error" data-rco-error role="alert" hidden></p>
    <button type="submit" class="lib-btn">Guardar</button>
    ${tope ? `<button type="button" class="lib-btn-sec" data-rco-sin>Sin presupuesto</button>` : ""}
  </form>`, "[name=tope]");
  if (desde) h.volver = desde;
  h.el.onchange = null;
  h.el.oninput = () => { const er = h.el.querySelector("[data-rco-error]"); if (er) er.hidden = true; };
  h.el.onclick = e => {
    if (!e.target.closest("[data-rco-sin]")) return;
    DI.guardarAjustes({ presupuestoMes: null }).catch(fallo);
    h.cerrar();
    aviso("Listo: sin presupuesto.", () => DI.guardarAjustes({ presupuestoMes: tope }).catch(fallo));
  };
  h.el.onsubmit = e => {
    e.preventDefault();
    const n = K.presupuesto(leerMonto(h.el.querySelector("[name=tope]").value));
    if (!n) { const er = h.el.querySelector("[data-rco-error]"); er.textContent = "Pon cuánto por mes, por ejemplo 500."; er.hidden = false; h.el.querySelector("[name=tope]").focus(); return; }
    DI.guardarAjustes({ presupuestoMes: n }).catch(fallo);
    h.cerrar();
    aviso(`Listo: tu presupuesto es de ${plata(n)} por mes.`);
  };
}
app.addEventListener("click", e => {
  const ag = e.target.closest("[data-rco-agregar]");
  if (ag) { agregarFalta(Number(ag.dataset.rcoAgregar), ag); return; }
  const co = e.target.closest("[data-rco-compre]");
  if (co) { compre(co.dataset.rcoCompre, co); return; }
  const qu = e.target.closest("[data-rco-quitar]");
  if (qu) { quitar(qu.dataset.rcoQuitar); return; }
  const b = e.target.closest("[data-rco]");
  if (b && b.dataset.rco === "presupuesto") editarPresupuesto(b);
});

// ---------- Cuándo se pinta ----------
window.addEventListener("hashchange", render);
document.addEventListener("DOMContentLoaded", render);
[D, DI, DD].forEach(x => x.al(() => { if (pantalla() === "ropa-compras") render(); }));
window.RopaCompras = { render, leerMonto };
})();
