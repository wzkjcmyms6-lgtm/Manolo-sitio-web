// ---------- Ropa: ideas de tu estilista, en Inspiración (D-164) ----------
// Pedido del dueño: "En la parte de inspiración quiero que la propia IA me
// pueda sugerir prendas, más allá de Pinterest, en base a lo que ve que falta
// en mi ropero". Arriba de Inspiración: las prendas que tu estilista sumaría a
// tu ropero (lo que sugirió en su último repaso, sin lo que ya tienes), cada
// una con por qué, "Así lo usarías" (un outfit de ejemplo con tu ropa: lo arma
// Manolo con las reglas de Outfits, RopaOpinionMotor.ideaEnOutfit), cuántos
// outfits nuevos te da, "A mi lista" y "Ver ideas en Pinterest" (una búsqueda:
// no hace falta conectar tu tablero). "Pedirle ideas" (unos 12 centavos) pide
// el repaso de tu ropero: el mismo de Compras (js/ropa-opinion.js), así no hay
// dos opiniones distintas. Sin la IA y sin un repaso guardado, no aparece.
// window.RopaIdeas: html() (lo pinta Inspiración).
(function () {
"use strict";
const M = window.RopaMotor, P = window.RopaOpinionMotor, K = window.RopaComprasMotor, D = window.RopaDatos, DO = window.RopaOutfitsDatos;
const RO = () => window.RopaOpinion, DD = () => window.RopaComprasDatos, A = () => window.RopaApp, IA = () => window.RopaIA;
const app = document.getElementById("rin-app");
if (!M || !P || !K || !D || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const pantalla = () => location.hash.replace(/^#/, "").split("/")[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const aviso = (t, d) => A().aviso(t, d);
const fallo = e => A().fallo(e);
const afuera = (href, texto) => `<a class="lib-btn-sec" href="${esc(href)}" target="_blank" rel="noopener">${icono("externo")}${texto}<span class="visually-hidden"> (se abre aparte)</span></a>`;
const pensando = t => `<p class="rop-mirando" role="status"><span class="roe-puntos" aria-hidden="true"><i></i><i></i><i></i></span>${t}</p>`;
const tuyas = () => D.lista().filter(p => p.estado !== "fuera");

// Las ideas de ahora: las sugerencias del último repaso que todavía no tienes.
let ahora = [];   // [{ s, cosa, nombre }] (para "A mi lista")
function ideas(op) {
  const ropero = D.lista();
  return op ? op.ia.sugerencias.filter(s => !P.laTienes(s, ropero)).map(s => ({ s, cosa: P.cosaDe(s), nombre: K.normalizarDeseo("x", P.cosaDe(s)).nombre })) : [];
}
// "Así lo usarías": tus prendas (sus fotos) y la nueva (un cuadro con su color).
function asiHTML(x) {
  const ids = P.ideaEnOutfit(x.s, D.lista(), { usos: D.usos(), hoy: D.hoy(), outfits: DO ? DO.lista() : [] });
  if (!ids.length) return "";
  const hex = x.cosa.colores[0] && M.COLOR[x.cosa.colores[0]] ? M.COLOR[x.cosa.colores[0]].hex : "#888";
  const nueva = { m: "nuevo", f: "nueva", mp: "nuevos", fp: "nuevas" }[M.generoDe ? M.generoDe(x.s.tipo) : "f"] || "nueva";
  const nombres = ids.map(id => (id === P.IDEA ? `${x.nombre} (${nueva})` : M.titulo(D.una(id))));
  return `<p class="rd-nota rid-asi-t">Así lo usarías:</p>
    <ul class="rid-asi" aria-hidden="true">${ids.map(id => (id === P.IDEA
      ? `<li><span class="ro-foto rid-nueva" style="--rid-c:${esc(hex)}">${icono("plus")}</span></li>`
      : `<li>${A().fotoHTML(D.una(id), "ro-foto")}</li>`)).join("")}</ul>
    <p class="rof-lista rid-asi-n">${nombres.map(esc).join(" · ")}</p>`;
}
function ideaHTML(x, i) {
  const n = K.outfitsNuevos(Object.assign({ estampado: "liso", clima: [], formalidad: null }, x.cosa), D.lista());
  const ya = DD() ? DD().deClave(K.clave(x.cosa)) : null;
  const hex = x.cosa.colores[0] && M.COLOR[x.cosa.colores[0]] ? M.COLOR[x.cosa.colores[0]].hex : "#888";
  return `<li class="tmp-card rid-idea">
    <h3 class="rid-t"><span class="ro-puntos" aria-hidden="true"><i style="background:${esc(hex)}"></i></span><span>${esc(x.nombre)}</span></h3>
    ${x.s.porque ? `<p class="rid-porque">${esc(x.s.porque)}</p>` : ""}
    ${asiHTML(x)}
    <p class="rco-outfits">${icono("outfit")}<span>${n ? `Con tu ropa: <b>${plural(n, "outfit nuevo", "outfits nuevos")}</b>` : "Con tu ropa de ahora no combina mucho"}</span></p>
    <div class="rco-bot">
      ${ya ? `<span class="rco-en-lista">${icono("check")}En tu lista</span>` : DD() ? `<button type="button" class="lib-btn" data-rid="lista" data-i="${i}">${icono("plus")}A mi lista</button>` : ""}
      ${afuera(K.buscar(x.cosa), "Ver ideas en Pinterest")}
    </div></li>`;
}
// La sección (la pinta Inspiración, arriba).
function html() {
  const R = RO();
  if (!R || !R.ultima) return "";
  const op = R.ultima(), st = R.estado(), puede = R.disponible();
  if (!op && !puede && !st.pidiendo) return "";
  const cab = `<h2 class="ro-sub" id="rid-t">${icono("sparkle")}Ideas de tu estilista</h2>`;
  const caja = cuerpo => `<section class="rco-sec rid-sec" aria-labelledby="rid-t">${cab}${cuerpo}</section>`;
  if (st.pidiendo) return caja(pensando("Tu estilista está mirando tu ropero… (puede tardar un minuto)"));
  const error = st.error ? `<p class="rin-error" role="alert">${esc(st.error)}</p>` : "";
  const n = tuyas().length;
  const boton = texto => (puede
    ? n >= 3 ? `<button type="button" class="${op ? "lib-btn-sec" : "lib-btn"} rid-pedir" data-rid="pedir">${icono("sparkle")}${texto}</button>
        <p class="rd-nota rid-costo">Unos 12 centavos de dólar. Mira toda tu ropa: también se ve en Compras.</p>`
      : `<p class="rd-nota">Con 3 prendas o más en tu ropero, tu estilista te da ideas.</p>`
    : IA() && IA().sinInternet() ? `<p class="rd-nota">Sin internet: tu estilista necesita conexión para darte ideas nuevas.</p>` : "");
  if (!op) {
    ahora = [];
    return caja(`<p>Tu estilista mira tu ropero y te dice qué prendas sumarías para tener más outfits, con cómo las usarías con tu ropa. No hace falta Pinterest.</p>${error}${boton("Pedirle ideas")}`);
  }
  ahora = ideas(op);
  const fecha = `<p class="rd-nota rid-fecha">${op.fecha ? `Del ${esc(M.fechaLarga(op.fecha))}` : "De su último repaso"} · <a href="#ropa-compras">Todo lo que opina, en Compras</a></p>`;
  const lista = ahora.length ? `<p class="rd-nota">Lo que le falta a tu ropero para tener más outfits.</p><ol class="rid-lista">${ahora.map(ideaHTML).join("")}</ol>`
    : `<p class="rd-nota">Ya tienes todo lo que te sugirió. Pídele ideas nuevas.</p>`;
  return caja(`${fecha}${lista}${error}${boton("Pedirle ideas nuevas")}`);
}

// ---------- Lo que tocas ----------
function aMiLista(i, b) {
  const x = ahora[i];
  if (!x || !DD()) return;
  b.disabled = true;
  DD().agregar(x.cosa, { origen: "estilista", nota: x.s.porque })
    .then(r => aviso(`Listo: ${x.nombre} está en tu lista de deseos.`, r.nuevo ? () => DD().borrar(r.id).catch(fallo) : null), e => { b.disabled = false; fallo(e); });
}
app.addEventListener("click", e => {
  const b = e.target.closest("[data-rid]");
  if (!b) return;
  if (b.dataset.rid === "pedir" && RO()) RO().pedir({ de: "ideas" });
  else if (b.dataset.rid === "lista") aMiLista(Number(b.dataset.i), b);
});
// Cuando cambia lo que se ve (un repaso nuevo, tu lista, tu ropa), se vuelve a pintar Inspiración.
const repintar = () => { if (pantalla() === "ropa-inspiracion" && window.RopaInsp) window.RopaInsp.render(); };
if (window.RopaEstilistaDatos) window.RopaEstilistaDatos.al(repintar);
if (DD()) DD().al(repintar);
if (IA()) IA().alCambiar(repintar);

window.RopaIdeas = { html };
})();
