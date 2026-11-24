// ---------- Ropa: Ajustes (#ropa-ajustes, el engranaje; D-147 a D-149) ----------
// Tus outfits: la ciudad del clima, cómo sientes el frío (friolento, normal
// o caluroso: corre los límites 3 grados) y tus ocasiones (las que agregaste
// en Outfits; aquí se quitan, con Deshacer). Tu estilista (D-158): lo que
// recuerda de ti (verlo, agregar y borrar, con Deshacer). Tu tablero de Pinterest
// (conectar, actualizar, cambiar o desconectar; con el puente listo). La IA: si está conectada, el gasto del mes con su tope
// (se puede cambiar) y "Describir con IA" las prendas que cargaste antes
// (llena solo lo que falta, sin cambiar lo que pusiste). Si no está
// conectada, tu código de usuario para conectarla.
(function () {
"use strict";
const M = window.RopaMotor, D = window.RopaDatos, IA = window.RopaIA, A = () => window.RopaApp;
const DI = window.RopaInspDatos, RI = () => window.RopaInsp;
const app = document.getElementById("roa-app");
if (!M || !D || !IA || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const visible = () => location.hash.replace(/^#/, "").split("/")[0] === "ropa-ajustes";
const usd = n => `US$ ${(Math.round(n * 100) / 100).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
let tarea = null;   // describiendo varias: { total, hechas, bien, mal, cancelar }
let aviso = "";

// Las prendas con foto que la IA todavía no vio.
const sinIA = () => D.lista().filter(p => p.estado !== "fuera" && p.fotos.length && !(D.crudo(p.id) || {}).ia);

function pintar() {
  if (!visible()) return;
  const e = IA.estado();
  const uid = typeof currentUser !== "undefined" && currentUser ? currentUser.uid : "";
  let ia;
  if (!IA.puente()) {
    ia = `<p>La IA todavía no está conectada. Cuando la conectes, describirá cada prenda desde su foto.</p>
      ${uid ? `<p class="rd-nota">Tu código para conectarla:</p><p class="roa-codigo"><code>${esc(uid)}</code><button type="button" class="lib-btn-sec lib-btn-chico" data-roa="copiar">Copiar</button></p>` : ""}`;
  } else if (!e) {
    // Sin internet (D-152): lo dice; la IA vuelve sola cuando hay conexión.
    ia = navigator.onLine === false ? `<p>Sin internet: la IA necesita conexión. Tu ropero funciona igual; cuando vuelva internet, se conecta sola.</p>`
      : `<p class="rd-nota">${IA.fallo && IA.fallo() ? esc(IA.fallo()) : "Revisando la conexión con la IA…"}</p><button type="button" class="lib-btn-sec lib-btn-chico" data-roa="reintentar">Reintentar</button>`;
  } else if (!e.permitido) {
    ia = `<p>La IA de Ropa es solo para el dueño de Manolo.</p>${uid ? `<p class="rd-nota">Tu código: <code>${esc(uid)}</code></p>` : ""}`;
  } else if (!e.lista) {
    ia = `<p>Falta la clave de la IA en Cloudflare: el puente está listo, pero sin la clave no puede describir.</p>`;
  } else {
    const g = e.gasto || { usd: 0, tope: 8, veces: 0 };
    const pct = Math.min(100, Math.round((g.usd / (g.tope || 1)) * 100));
    const n = sinIA().length;
    ia = `<p class="roa-ok"><span data-icon="check" aria-hidden="true"></span>La IA está conectada.</p>
      ${navigator.onLine === false ? `<p class="rd-nota">Sin internet ahora: la IA vuelve cuando tengas conexión.</p>` : ""}
      <div class="roa-gasto">
        <p><b>Este mes: ${usd(g.usd)}</b> de ${usd(g.tope)}${g.veces ? ` · ${g.veces} ${g.veces === 1 ? "vez" : "veces"}` : ""}</p>
        <div class="rp-zap-barra roa-barra" role="img" aria-label="Llevas el ${pct} % del tope del mes"><i style="width:${pct}%"></i></div>
        <p class="rd-nota">Al llegar al tope, la IA se pausa hasta el mes que viene.</p>
      </div>
      <form class="roa-tope" id="roa-tope" novalidate>
        <label class="rd-campo">Tope del mes (US$)<input class="lib-input" name="tope" inputmode="decimal" value="${esc(String(g.tope))}"></label>
        <button type="submit" class="lib-btn-sec">Guardar</button>
      </form>
      ${tarea ? `<div class="roa-tarea" role="status"><p><b>Describiendo: ${tarea.hechas} de ${tarea.total}</b></p><div class="rp-zap-barra"><i style="width:${Math.round((tarea.hechas / tarea.total) * 100)}%"></i></div><button type="button" class="lib-btn-sec lib-btn-chico" data-roa="cancelar">Parar</button></div>`
        : n ? `<button type="button" class="lib-btn roa-todas" data-roa="todas">Describir con IA las ${n === 1 ? "prenda" : `${n} prendas`} que cargaste antes</button>
               <p class="rd-nota">Llena solo lo que falta; lo que pusiste no cambia. Son unos ${usd(n * 0.03)}.</p>` : ""}`;
  }
  app.innerHTML = `${aviso ? `<p class="tmp-ok" role="status">${esc(aviso)}</p>` : ""}
    ${climaHTML()}
    ${estilistaHTML()}
    ${pinterestHTML()}
    <section class="tmp-card roa-ia" aria-labelledby="roa-ia-t"><h2 class="ro-sub" id="roa-ia-t">La IA</h2>${ia}</section>`;
  if (typeof renderIcons === "function") renderIcons(app);
}

// Tus outfits (D-149): la ciudad del clima, cómo sientes el frío y tus ocasiones.
const propias = () => (window.RopaOutfitMotor && DI ? window.RopaOutfitMotor.ocasionesPropias((DI.ajustes() || {}).ocasiones) : []);
function climaHTML() {
  const C = window.RopaClima, O = window.RopaOutfitMotor;
  if (!DI || !C || !O || !window.RopaOutfits) return "";
  const aj = DI.ajustes() || {};
  const c = C.ciudad(aj.ciudad || C.LA_PAZ);
  const s = ["friolento", "normal", "caluroso"].includes(aj.sensacion) ? aj.sensacion : "normal";
  const ocs = propias();
  return `<section class="tmp-card roa-clima" aria-labelledby="roa-clima-t">
    <h2 class="ro-sub" id="roa-clima-t"><span data-icon="clima" aria-hidden="true"></span>Tus outfits</h2>
    <div class="roa-ciudad"><p>Ciudad: <b>${esc(c.nombre)}</b> <span class="rd-nota">${esc(C.detalleCiudad(c))}</span></p>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-roa="ciudad" aria-haspopup="dialog">Cambiar ciudad</button></div>
    <fieldset class="ro-campo"><legend>Cómo sientes el frío</legend><div class="ro-opciones">${C.SENSACIONES.map(([v, t]) =>
      `<label class="ro-op-chip"><input type="radio" name="roa-sensacion" value="${v}"${s === v ? " checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>
      <small class="rd-nota">Friolento: Manolo te abriga como si hiciera 3 grados menos. Caluroso: como si hiciera 3 grados más.</small></fieldset>
    <h3 class="ro-mas-t">Tus ocasiones</h3>
    ${ocs.length ? `<ul class="roa-ocasiones">${ocs.map(o => `<li><span><b>${esc(o.nombre)}</b> <small class="rd-nota">como ${esc(O.OCASION[o.como].nombre.toLowerCase())}</small></span>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-roa="oc-quitar" data-id="${esc(o.id)}" aria-label="Quitar ${esc(o.nombre)}">Quitar</button></li>`).join("")}</ul>` : ""}
    <p class="rd-nota">${ocs.length ? "Agrega más" : "Agrega las tuyas (la universidad, la iglesia…)"} en Outfits › Para qué › «+ Otra».</p>
  </section>`;
}

// Tu estilista (D-158): lo que recuerda de ti (si ya hablaste con él o la IA está lista).
function estilistaHTML() {
  const RE = window.RopaEstilista, DE = window.RopaEstilistaDatos;
  if (!RE || !DE) return "";
  const n = DE.memoria().length, cs = DE.lista().length;
  if (!n && !cs && !IA.estilista()) return "";
  return `<section class="tmp-card roa-estilista" aria-labelledby="roa-est-t">
    <h2 class="ro-sub" id="roa-est-t"><span data-icon="sparkle" aria-hidden="true"></span>Tu estilista</h2>
    <p>${n ? `Recuerda ${n === 1 ? "una cosa" : `${n} cosas`} de ti.` : "Todavía no recuerda nada de ti."} <span class="rd-nota">Lo tiene en cuenta cada vez que le escribes.</span></p>
    <div class="roa-pin-bot">
      <button type="button" class="lib-btn-sec lib-btn-chico" data-roa="memoria" aria-haspopup="dialog">Lo que recuerda de ti</button>
      <a class="lib-btn-sec lib-btn-chico" href="#ropa-estilista">Hablar con tu estilista</a>
    </div></section>`;
}

// Tu tablero de Pinterest (D-148): solo con el puente listo.
function pinterestHTML() {
  if (!DI || !RI() || !IA.pinterest()) return "";
  const t = (DI.ajustes() || {}).pinterest;
  const cab = `<h2 class="ro-sub" id="roa-pin-t"><span data-icon="inspiracion" aria-hidden="true"></span>Tu tablero de Pinterest</h2>`;
  if (!t || !t.usuario) {
    return `<section class="tmp-card roa-pin" aria-labelledby="roa-pin-t">${cab}
      <p class="rd-nota">Conéctalo y Manolo trae solo los pines nuevos a Inspiración. Solo lee tu tablero: nunca publica nada.</p>
      <button type="button" class="lib-btn" data-roa="pin-conectar">Conectar tablero</button></section>`;
  }
  const fecha = t.leido ? new Date(t.leido).toLocaleString("es-BO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  return `<section class="tmp-card roa-pin" aria-labelledby="roa-pin-t">${cab}
    <p>Conectado: <b>«${esc(t.titulo || t.tablero)}»</b> <span class="rd-nota">(${esc(t.usuario)}/${esc(t.tablero)})</span></p>
    <p class="rd-nota">${fecha ? `Lo leí por última vez el ${esc(fecha)}. ` : ""}Solo lee tu tablero: nunca publica nada.</p>
    <div class="roa-pin-bot">
      <button type="button" class="lib-btn-sec lib-btn-chico" data-roa="pin-actualizar">Actualizar ahora</button>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-roa="pin-conectar">Cambiar de tablero</button>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-roa="pin-quitar">Desconectar</button>
    </div></section>`;
}

// Lo que dijo la IA, solo en lo que está vacío.
function soloLoQueFalta(p, ia) {
  const c = {};
  if (!p.colores.length && ia.colores.length) c.colores = ia.colores.map(id => ({ id }));
  if (!p.estampado && ia.estampado) c.estampado = ia.estampado;
  if (!p.tela && ia.tela) c.tela = M.mayus(ia.tela);
  if (!p.corte && ia.corte && (M.CORTES_DE[p.grupo] || []).includes(ia.corte)) c.corte = ia.corte;
  if (!p.manga && M.CON_MANGA.includes(p.grupo) && M.MANGAS.some(m => m[0] === ia.manga)) c.manga = ia.manga;
  if (!p.estilo.length && ia.estilo.length) c.estilo = ia.estilo;
  if (!p.clima.length && ia.clima.length) c.clima = ia.clima;
  if (!p.formalidad && ia.formalidad) c.formalidad = ia.formalidad;
  if (!p.marca && ia.marca) c.marca = M.mayus(ia.marca);
  return c;
}
async function fotoDe(p) {
  const f = p.fotos[0];
  const r = D.Fotos ? await D.Fotos.leer(f.id).catch(() => null) : null;
  if (r && r.blob) return r.blob;
  return f.mini ? fetch(f.mini).then(x => x.blob()) : null;
}
async function describirTodas() {
  const lista = sinIA();
  if (!lista.length || tarea) return;
  tarea = { total: lista.length, hechas: 0, bien: 0, mal: 0, cancelar: false };
  aviso = "";
  pintar();
  for (const p of lista) {
    if (tarea.cancelar) break;
    try {
      const ia = await IA.describir(await fotoDe(p));
      await D.completar(p.id, soloLoQueFalta(p, ia));
      tarea.bien++;
    } catch (e) {
      tarea.mal++;
      if (e && ["tope", "credito", "clave", "falta-clave", "sesion", "permiso", "sin-internet"].includes(e.codigo)) { aviso = e.message; break; }
    }
    tarea.hechas++;
    pintar();
  }
  const t = tarea;
  tarea = null;
  if (!aviso) aviso = t.bien ? `Listo: la IA describió ${t.bien} ${t.bien === 1 ? "prenda" : "prendas"}${t.mal ? ` (${t.mal} no pudo)` : ""}.` : "La IA no pudo describir ninguna. Intenta de nuevo.";
  pintar();
}

app.addEventListener("click", e => {
  const b = e.target.closest("[data-roa]");
  if (!b) return;
  const a = b.dataset.roa;
  if (a === "copiar") {
    const uid = currentUser ? currentUser.uid : "";
    (navigator.clipboard ? navigator.clipboard.writeText(uid) : Promise.reject()).then(() => A().aviso("Código copiado."), () => A().aviso("No pude copiarlo: mantén apretado el código para copiarlo."));
  } else if (a === "reintentar") IA.quien(true).then(pintar);
  else if (a === "todas") describirTodas();
  else if (a === "cancelar" && tarea) { tarea.cancelar = true; b.disabled = true; }
  else if (a === "ciudad" && window.RopaOutfits) window.RopaOutfits.elegirCiudad(b);
  else if (a === "memoria" && window.RopaEstilista) window.RopaEstilista.memoria(b);
  else if (a === "oc-quitar" && DI) {
    const antes = propias(), o = antes.find(x => x.id === b.dataset.id);
    if (!o) return;
    DI.guardarAjustes({ ocasiones: antes.filter(x => x.id !== o.id) }).catch(err => A().fallo(err));
    A().aviso(`Quitaste «${o.nombre}» de tus ocasiones.`, () => DI.guardarAjustes({ ocasiones: antes }).catch(err => A().fallo(err)));
  }
  else if (a === "pin-conectar" && RI()) RI().conectarTablero(b);
  else if (a === "pin-actualizar" && RI()) { location.hash = "ropa-inspiracion"; RI().actualizarTablero(true); }
  else if (a === "pin-quitar" && DI) {
    const antes = (DI.ajustes() || {}).pinterest;
    DI.guardarAjustes({ pinterest: null }).catch(err => A().fallo(err));
    A().aviso("Desconectaste tu tablero. Los pines que ya trajiste se quedan.", () => DI.guardarAjustes({ pinterest: antes }).catch(err => A().fallo(err)));
  }
});
app.addEventListener("change", e => {
  if (e.target.name !== "roa-sensacion" || !DI) return;
  DI.guardarAjustes({ sensacion: e.target.value }).catch(err => A().fallo(err));
  A().aviso(e.target.value === "normal" ? "Listo: el clima, tal cual." : `Listo: Manolo sabe que eres ${e.target.value}.`);
});
app.addEventListener("submit", e => {
  if (e.target.id !== "roa-tope") return;
  e.preventDefault();
  const v = Number(String(e.target.elements.tope.value).replace(",", "."));
  if (!(v >= 1 && v <= 100)) { aviso = "El tope va de 1 a 100 dólares."; pintar(); return; }
  IA.tope(v).then(() => { aviso = `Listo: el tope del mes es ${usd(v)}.`; pintar(); }, err => { aviso = err.message; pintar(); });
});
IA.alCambiar(() => { if (!tarea) pintar(); });
if (DI) DI.al(() => { if (!tarea && !(document.activeElement && document.activeElement.closest("#roa-app form"))) pintar(); });
D.al(() => { if (!tarea && !(document.activeElement && document.activeElement.closest("#roa-app form"))) pintar(); });
if (window.RopaEstilistaDatos) window.RopaEstilistaDatos.al(() => { if (!tarea && !(document.activeElement && document.activeElement.closest("#roa-app form"))) pintar(); });
window.addEventListener("hashchange", () => { aviso = ""; if (visible()) IA.quien().then(pintar); pintar(); });
document.addEventListener("DOMContentLoaded", pintar);
window.RopaAjustes = { pintar, soloLoQueFalta };
})();
