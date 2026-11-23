// ---------- Ropa: tus números (#ropa-numeros, D-151) ----------
// Desde el ropero ("Tus números"): cuántas prendas tienes, los días que
// anotaste lo que te pusiste (últimos 30) y lo que invertiste; lo que más te
// pones (últimos 3 meses); lo que no te pones hace 3 meses o más; tus colores
// (un gráfico de barras: una barra por familia, con su muestra y su número) y
// el que más te pones; y cuánto te sale cada uso (lo que mejor rinde, lo que
// menos y lo que no estrenaste). Cada prenda lleva a su ficha.
// Cuentas: js/ropa-numeros-motor.js.
(function () {
"use strict";
const M = window.RopaMotor, N = window.RopaNumerosMotor, D = window.RopaDatos;
const A = () => window.RopaApp;
const app = document.getElementById("rn-app");
if (!M || !N || !D || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const pantalla = () => location.hash.replace(/^#/, "").split("/")[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const plata = n => `Bs ${n.toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;

// Una prenda en una fila (lleva a su ficha): la foto, el nombre y un dato.
function fila(id, dato) {
  const p = D.una(id);
  if (!p) return "";
  return `<li><a class="rn-fila" href="#ropa-prenda/${encodeURIComponent(p.id)}">${A().fotoHTML(p, "ro-foto")}<span class="rn-fila-t"><b>${esc(M.titulo(p))}</b><small>${esc(dato)}</small></span>${icono("chevronRight")}</a></li>`;
}
const seccion = (id, ico, titulo, cuerpo) => `<section class="rn-sec" aria-labelledby="rn-${id}-t"><h2 class="ro-sub" id="rn-${id}-t">${icono(ico)}${esc(titulo)}</h2>${cuerpo}</section>`;

function render() {
  if (pantalla() !== "ropa-numeros") return;
  if (!D.cargada()) { app.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  const n = N.numeros(D.lista(), D.usosDocs(), D.hoy());
  if (!n.total) {
    app.innerHTML = `<div class="run-vacio"><span class="icon" data-icon="ropa"></span><p><b>Todavía no hay números.</b></p><p>Agrega tu ropa al ropero y anota lo que te pones: aquí verás lo que más usas, tus colores y cuánto te sale cada uso.</p><a class="lib-btn" href="#ropa">Ir al ropero</a></div>`;
    pintarIconos(app);
    return;
  }
  // Lo invertido va a lo ancho (un monto no se parte en dos líneas); sin precios, no va.
  const cifras = `<div class="rn-cifras">
    <p class="rn-cifra"><b>${n.total.toLocaleString("es-BO")}</b><span>${n.total === 1 ? "prenda" : "prendas"}</span></p>
    <p class="rn-cifra"><b>${n.dias30}<small> de 30</small></b><span>${n.dias30 === 1 ? "día anotado" : "días anotados"}</span></p>
    ${n.conPrecio ? `<p class="rn-cifra is-plata"><b>${plata(n.invertido)}</b><span>${n.conPrecio === n.total ? "invertido en tu ropa" : `invertido en ${plural(n.conPrecio, "prenda con precio", "prendas con precio")}`}</span></p>` : ""}</div>`;

  const mas = n.masUsadas.length ? `<p class="rd-nota">En los últimos 3 meses.</p><ol class="tmp-card rn-lista">${n.masUsadas.map(x => fila(x.id, plural(x.veces, "vez", "veces"))).join("")}</ol>`
    : `<p class="rd-nota">Cuando anotes lo que te pones (con «Me lo pongo» o en la ficha de cada prenda), aquí verás lo que más usas.</p>`;
  const sin = n.sinUsar.length ? `<p class="rd-nota">¿La donas, la vendes o la guardas? En su ficha: «Ya no la tengo».</p><ul class="tmp-card rn-lista">${n.sinUsar.slice(0, 8).map(x =>
      fila(x.id, x.ultima ? `La última vez: ${N.haceCuanto(x.dias)}` : `Nunca te la pusiste${x.dias != null ? ` (la tienes ${N.haceCuanto(x.dias).replace(/^hace /, "desde hace ")})` : ""}`)).join("")}</ul>
      ${n.sinUsar.length > 8 ? `<p class="rd-nota">Y ${plural(n.sinUsar.length - 8, "prenda más", "prendas más")}.</p>` : ""}`
    : `<p class="rd-nota">Te pusiste todo lo que tienes en los últimos 3 meses.</p>`;

  // Tus colores: una barra por familia (un solo color para "cuánto"; la muestra dice "cuál").
  const max = n.colores.reduce((m, c) => Math.max(m, c.n), 0);
  const colores = n.colores.length ? `<ul class="tmp-card rn-colores">${n.colores.map(c => `<li>
      <span class="rn-color-t"><i class="rn-muestra${c.hex ? "" : " is-otros"}"${c.hex ? ` style="background:${esc(c.hex)}"` : ""} aria-hidden="true"></i>${esc(c.nombre)}</span>
      <span class="rn-pista" aria-hidden="true"><i style="width:${Math.max(4, Math.round((c.n / max) * 100))}%"></i></span>
      <span class="rn-valor">${c.n} <small>(${Math.round(c.pct * 100)} %)</small></span></li>`).join("")}</ul>
      ${n.colorMasPuesto ? `<p class="rn-nota">El que más te pones: <b>${esc(n.colorMasPuesto.nombre.toLowerCase())}</b>.</p>` : ""}`
    : `<p class="rd-nota">Ponle color a tus prendas y aquí verás tus colores.</p>`;

  const r = n.rinde;
  const porUso = x => `${plata(x.porUso)} por uso · ${plural(x.veces, "vez", "veces")}`;
  const rinde = !n.conPrecio ? `<p class="rd-nota">Pon el precio de tus prendas (en su ficha) y aquí verás cuánto te sale cada vez que te las pones.</p>`
    : `<p class="rd-nota">El precio dividido por las veces que te la pusiste.</p>
      ${r.mejor.length ? `<h3 class="rn-sub">${r.peor.length ? "Lo que mejor rinde" : "Lo que te pusiste"}</h3><ol class="tmp-card rn-lista">${r.mejor.map(x => fila(x.id, porUso(x))).join("")}</ol>` : ""}
      ${r.peor.length ? `<h3 class="rn-sub">Lo que menos rinde</h3><ol class="tmp-card rn-lista">${r.peor.map(x => fila(x.id, porUso(x))).join("")}</ol>` : ""}
      ${r.sinEstrenar.length ? `<h3 class="rn-sub">Sin estrenar</h3><ul class="tmp-card rn-lista">${r.sinEstrenar.map(x => fila(x.id, `${plata(x.precio)} · sin estrenar`)).join("")}</ul>` : ""}`;

  app.innerHTML = cifras
    + seccion("mas", "flame", "Lo que más te pones", mas)
    + seccion("sin", "eyeOff", "Lo que no te pones hace 3 meses o más", sin)
    + seccion("colores", "ropa", "Tus colores", colores)
    + seccion("rinde", "coin", "Cuánto te sale cada uso", rinde);
  pintarIconos(app);
}

window.addEventListener("hashchange", render);
document.addEventListener("DOMContentLoaded", render);
D.al(() => { if (pantalla() === "ropa-numeros") render(); });
window.RopaNumeros = { render };
})();
