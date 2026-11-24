// ---------- Ropa: lo que opina tu estilista (D-160) ----------
// (1) En Compras, antes de "Qué te falta": el repaso de tu ropero. Sin repaso,
// "Pedir su opinión" (unos 12 centavos); mientras mira, lo dice. Con repaso:
// la fecha y el resumen; "Lo que ve" (los números los cuenta Manolo, js/
// ropa-opinion-motor.js; tu estilista comenta cada uno); "Lo que sumaría" (por
// qué, con qué de tu ropa va, cuántos outfits nuevos te da —los cuenta
// Manolo—, si también está en tus pines, "A mi lista" y "Ver opciones en
// Pinterest"); "Qué no comprar más"; "Podrías dejar de lado" (es solo un
// consejo: nunca toca nada); "Tus colores"; "Consejos"; "Pedirle otra
// opinión". Cada repaso queda en ropa_opiniones (se ve el último).
// (2) "¿Qué opinas?" de un outfit (desde Armar el mío y desde una opción o un
// guardado de Outfits): una hoja con si va bien, qué funciona, hasta 2 cambios
// con fotos ("Cambiar" lo aplica en un toque) y un consejo.
// El puente: /opinion (esfuerzo alto) y /opinar (medio), versión 5 o más.
(function () {
"use strict";
const M = window.RopaMotor, O = window.RopaOutfitMotor, P = window.RopaOpinionMotor, E = window.RopaEstilistaMotor, K = window.RopaComprasMotor, D = window.RopaDatos, DI = window.RopaInspDatos, DE = window.RopaEstilistaDatos;
const IA = () => window.RopaIA, A = () => window.RopaApp, RO = () => window.RopaOutfits, DD = () => window.RopaComprasDatos, I = () => window.RopaInspMotor, RC = () => window.RopaCompras;
if (!M || !O || !P || !E || !K || !D || !DI || !DE || !window.Lectura) return;
const { esc } = window.Lectura;
const pantalla = () => location.hash.replace(/^#/, "").split("/")[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const aviso = (t, d) => A().aviso(t, d);
const fallo = e => A().fallo(e);
const puntos = cs => `<span class="ro-puntos" aria-hidden="true">${cs.map(id => `<i style="background:${esc(M.COLOR[id] ? M.COLOR[id].hex : "#888")}"></i>`).join("")}</span>`;
const afuera = (href, texto) => `<a class="lib-btn-sec" href="${esc(href)}" target="_blank" rel="noopener">${icono("externo")}${texto}<span class="visually-hidden"> (se abre aparte)</span></a>`;
const disponible = () => !!(IA() && IA().estilista() && !IA().sinInternet());
const tuyas = () => D.lista().filter(p => p.estado !== "fuera");
const cosaDe = s => ({ grupo: s.grupo, tipo: s.tipo, colores: s.color ? [s.color] : [] });
const pensando = t => `<p class="rop-mirando" role="status"><span class="roe-puntos" aria-hidden="true"><i></i><i></i><i></i></span>${t}</p>`;
// Lo que va a tu estilista además de tu ropa: tu estilo, lo que recuerda de ti y tu presupuesto.
function contexto() {
  const aj = DI.ajustes() || {};
  const g = I() && I().estiloGuardado ? I().estiloGuardado(aj.estilo) : null;
  const tope = K.presupuesto(aj.presupuestoMes);
  return {
    estilo: g ? g.resumen : "", memoria: DE.memoria().map(m => m.texto),
    presupuesto: tope ? E.presupuestoTexto(tope, K.gastoDelMes(D.lista(), D.hoy().slice(0, 7)).total) : ""
  };
}

// ---------- (1) El repaso de tu ropero (en Compras) ----------
const est = { pidiendo: false, error: "", recien: null };
// El último repaso (el recién pedido, hasta que llega de la nube).
function ultima() {
  const op = DE.opiniones()[0] || null;
  if (est.recien && (!op || op.creado < est.recien.creado)) return est.recien;
  est.recien = null;
  return op;
}
function sugerenciaHTML(s, i, ropero, enPines) {
  const cosa = cosaDe(s);
  const nombre = K.normalizarDeseo("x", cosa).nombre;
  const n = K.outfitsNuevos(Object.assign({ estampado: "liso", clima: [], formalidad: null }, cosa), ropero);
  const ya = DD() ? DD().deClave(K.clave(cosa)) : null;
  const va = s.combina.map(id => D.una(id)).filter(p => p && p.estado !== "fuera").slice(0, 6);
  return `<li class="tmp-card rco-item rop-sug">
    <h4 class="rco-t">${puntos(cosa.colores)}<span>${esc(nombre)}</span></h4>
    ${s.porque ? `<p class="rop-porque">${esc(s.porque)}</p>` : ""}
    ${enPines.has(K.clave(cosa)) ? `<p class="rco-cuantas rop-pines">${icono("inspiracion")}También está en tus inspiraciones.</p>` : ""}
    ${va.length ? `<p class="rd-nota rop-va-t">Va con:</p><ul class="rop-va">${va.map(p => `<li><a class="rop-va-a" href="#ropa-prenda/${encodeURIComponent(p.id)}" aria-label="${esc(M.titulo(p))}">${A().fotoHTML(p, "ro-foto")}</a></li>`).join("")}</ul>` : ""}
    <p class="rco-outfits">${icono("outfit")}<span>${n ? `Con tu ropa: <b>${plural(n, "outfit nuevo", "outfits nuevos")}</b> (lo cuenta Manolo)` : "Con tu ropa de ahora no combina mucho"}</span></p>
    <div class="rco-bot">
      ${ya ? `<span class="rco-en-lista">${icono("check")}En tu lista</span>` : DD() ? `<button type="button" class="lib-btn" data-rop-o="lista" data-i="${i}">${icono("plus")}A mi lista</button>` : ""}
      ${afuera(K.buscar(cosa), "Ver opciones en Pinterest")}
    </div></li>`;
}
function coloresHTML(c) {
  if (!c.van.length && !c.sumar.length) return "";
  const chips = xs => `<ul class="rop-colores">${xs.map(id => `<li>${puntos([id])}${esc(M.nombreColor(id))}</li>`).join("")}</ul>`;
  return `<h3 class="rop-t">Tus colores</h3>
    ${c.van.length ? `<p class="rop-col-t">Te van</p>${chips(c.van)}` : ""}
    ${c.sumar.length ? `<p class="rop-col-t">Sumarías</p>${chips(c.sumar)}` : ""}
    ${c.porque ? `<p class="rd-nota">${esc(c.porque)}</p>` : ""}`;
}
function opinionHTML(op) {
  const ia = op.ia, ropero = D.lista();
  const comenta = new Map(ia.comentarios.map(c => [c.hecho, c.texto]));
  const enPines = new Set(I() ? K.faltan(DI.lista(), ropero).map(f => f.clave) : []);
  const dejar = ia.dejar.map(x => ({ p: D.una(x.prenda), porque: x.porque })).filter(x => x.p && x.p.estado !== "fuera");
  return `<p class="rd-nota rop-fecha">${op.fecha ? `Del ${esc(M.fechaLarga(op.fecha))}` : "Tu último repaso"}${op.n ? ` · cuando tenías ${plural(op.n, "prenda", "prendas")}` : ""}</p>
    ${ia.resumen ? `<p class="rop-resumen">${esc(ia.resumen)}</p>` : ""}
    ${op.hechos.length ? `<h3 class="rop-t">Lo que ve</h3><p class="rd-nota">Los números los cuenta Manolo; tu estilista los comenta.</p>
      <ul class="rop-ve">${op.hechos.map(h => `<li><span class="rop-hecho">${esc(h.texto)}</span>${comenta.get(h.id) ? `<span class="rop-com">${icono("sparkle")}<span>${esc(comenta.get(h.id))}</span></span>` : ""}</li>`).join("")}</ul>` : ""}
    ${ia.sugerencias.length ? `<h3 class="rop-t">Lo que sumaría</h3><ol class="rco-lista">${ia.sugerencias.map((s, i) => sugerenciaHTML(s, i, ropero, enPines)).join("")}</ol>` : ""}
    ${ia.noComprar.length ? `<h3 class="rop-t">Qué no comprar más</h3><ul class="rop-lista">${ia.noComprar.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${dejar.length ? `<h3 class="rop-t">Podrías dejar de lado</h3><p class="rd-nota">Es solo un consejo: no cambia nada de tu ropero.</p>
      <ul class="rop-dejar">${dejar.map(x => `<li><a class="rop-dejar-a" href="#ropa-prenda/${encodeURIComponent(x.p.id)}">${A().fotoHTML(x.p, "ro-foto")}<span><b>${esc(M.titulo(x.p))}</b>${x.porque ? `<span class="rd-nota">${esc(x.porque)}</span>` : ""}</span></a></li>`).join("")}</ul>` : ""}
    ${coloresHTML(ia.colores)}
    ${ia.consejos.length ? `<h3 class="rop-t">Consejos</h3><ul class="rop-lista">${ia.consejos.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}`;
}
// La sección (la pinta Compras). Sin la IA y sin un repaso guardado, no aparece.
function html() {
  const op = ultima();
  const puede = disponible();
  if (!op && !puede && !est.pidiendo) return "";
  const cab = `<h2 class="ro-sub" id="rop-op-t">${icono("sparkle")}Lo que opina tu estilista</h2>`;
  const caja = cuerpo => `<section class="rco-sec rop-op" aria-labelledby="rop-op-t">${cab}${cuerpo}</section>`;
  if (est.pidiendo) return caja(pensando("Tu estilista está mirando tu ropero… (puede tardar un minuto)"));
  const n = tuyas().length;
  const error = est.error ? `<p class="rin-error" role="alert">${esc(est.error)}</p>` : "";
  const boton = texto => (puede
    ? n >= 3 ? `<button type="button" class="${op ? "lib-btn-sec" : "lib-btn"} rop-pedir" data-rop-o="pedir">${icono("sparkle")}${texto}</button>
        <p class="rd-nota rop-costo">Unos 12 centavos de dólar. Tarda un poco: mira toda tu ropa.</p>`
      : `<p class="rd-nota">Con 3 prendas o más en tu ropero, tu estilista te da su opinión.</p>`
    : IA() && IA().sinInternet() ? `<p class="rd-nota">Sin internet: tu estilista necesita conexión para darte otra opinión.</p>` : "");
  if (!op) return caja(`<p>Pídele a tu estilista su opinión de tu ropero: lo que ve, lo que sumaría para tener más outfits, lo que no compraría más y los colores que te van.</p>${error}${boton("Pedir su opinión")}`);
  return caja(`${opinionHTML(op)}${error}${boton("Pedirle otra opinión")}`);
}
function repintar() { if (pantalla() === "ropa-compras" && RC()) RC().render(); }
async function pedirOpinion() {
  if (est.pidiendo || !disponible()) return;
  const ropero = D.lista();
  const hechos = P.hechos(ropero, D.usosDocs(), D.hoy());
  const aj = DI.ajustes() || {};
  const C = window.RopaClima;
  const ciudad = C ? C.ciudad(aj.ciudad || C.LA_PAZ).nombre : "La Paz";
  est.pidiendo = true;
  est.error = "";
  repintar();
  const sec = document.querySelector("#rco-app .rop-op");
  if (sec) sec.scrollIntoView({ block: "start", behavior: "smooth" });
  try {
    const r = await IA().opinion(Object.assign({ ropero: P.roperoParaRepaso(ropero, D.usosDocs()), hechos, pines: I() ? P.pinesTexto(K.faltan(DI.lista(), ropero)) : "", ciudad }, contexto()));
    const ia = { resumen: r.resumen, comentarios: r.comentarios, sugerencias: r.sugerencias, noComprar: r.noComprar, dejar: r.dejar, colores: r.colores, consejos: r.consejos };
    const doc = { fecha: D.hoy(), n: tuyas().length, hechos, ia };
    const id = DE.guardarOpinion(doc);
    est.recien = P.normalizar(id, Object.assign({ creado: Date.now() }, doc));
    aviso("Listo: tu estilista te dio su opinión de tu ropero.");
  } catch (e) {
    est.error = (e && e.message) || "Tu estilista no pudo darte su opinión. Intenta de nuevo.";
  }
  est.pidiendo = false;
  repintar();
}
function aMiLista(i) {
  const op = ultima();
  const s = op && op.ia.sugerencias[i];
  if (!s || !DD()) return;
  const cosa = cosaDe(s);
  DD().agregar(cosa, { origen: "estilista", nota: s.porque })
    .then(r => aviso(`Listo: ${K.normalizarDeseo("x", cosa).nombre} está en tu lista de deseos.`, r.nuevo ? () => DD().borrar(r.id).catch(fallo) : null), fallo);
}
const comprasApp = document.getElementById("rco-app");
if (comprasApp) {
  comprasApp.addEventListener("click", e => {
    const b = e.target.closest("[data-rop-o]");
    if (!b) return;
    if (b.dataset.ropO === "pedir") pedirOpinion();
    else if (b.dataset.ropO === "lista") aMiLista(Number(b.dataset.i));
  });
}
DE.al(repintar);
if (IA()) IA().alCambiar(repintar);

// ---------- (2) "¿Qué opinas?" de un outfit ----------
const opinados = new Map();   // las respuestas de esta vez (para no pagar dos veces lo mismo)
let turnoOpinar = 0;          // la hoja es una sola: lo que llega tarde de otro outfit no se pinta
const fotoPrenda = (p, de) => `<figure class="rop-cambio-f">${A().fotoHTML(p, "ro-foto")}<figcaption><span class="rd-nota">${de}</span> ${esc(M.titulo(p))}</figcaption></figure>`;
// ids: el outfit; o: { desde (el botón), ocasion (el nombre), alCambiar(sale, entra) }.
function opinar(ids, o) {
  const x = o || {};
  const lista = [...new Set(ids || [])].filter(id => D.una(id));
  if (lista.length < 2) { aviso("Elige al menos dos prendas para preguntarle."); return; }
  if (!disponible()) { aviso(IA() && IA().sinInternet() ? "Sin internet: tu estilista necesita conexión." : "Tu estilista no está disponible ahora."); return; }
  const k = O.clave(lista);
  const turno = ++turnoOpinar;
  const h = A().hoja("rop-hoja-opinar");
  const fotos = `<ul class="rop-op-fotos">${lista.map(id => D.una(id)).map(p => `<li>${A().fotoHTML(p, "ro-foto")}</li>`).join("")}</ul>`;
  // La hoja se arma una vez; lo de adentro cambia (pensando → la respuesta), y se anuncia.
  h.mostrar("¿Qué opina tu estilista?", `<div class="rop-opinar">${fotos}<div class="rop-op-cuerpo" aria-live="polite"></div></div>`);
  const pintar = (r, error) => {
    const el = h.el.querySelector(".rop-op-cuerpo");
    if (!el || turno !== turnoOpinar) return;
    el.innerHTML = error ? `<p class="rin-error" role="alert">${esc(error)}</p><button type="button" class="lib-btn-sec" data-rop-h="otra">Volver a preguntar</button>`
      : !r ? pensando("Tu estilista está mirando tu outfit…")
      : `<p class="rop-veredicto is-${esc(r.veredicto)}">${icono(r.veredicto === "cambiaria" ? "alerta" : "check")}<b>${esc(P.veredicto(r.veredicto))}</b></p>
        ${r.funciona ? `<p class="rop-funciona">${esc(r.funciona)}</p>` : ""}
        ${r.cambios.map((c, i) => { const sale = D.una(c.sale), entra = D.una(c.entra); return sale && entra ? `<div class="tmp-card rop-cambio">
          <div class="rop-cambio-fotos">${fotoPrenda(sale, "Sale")}<span class="rop-flecha" aria-hidden="true">→</span>${fotoPrenda(entra, "Entra")}</div>
          ${c.porque ? `<p class="rop-cambio-p">${esc(c.porque)}</p>` : ""}
          ${x.alCambiar ? `<button type="button" class="lib-btn-sec" data-rop-h="cambiar" data-i="${i}">${icono("swap")}Cambiar</button>` : ""}</div>` : ""; }).join("")}
        ${r.consejo ? `<p class="rin-consejo">${icono("sparkle")}<span>${esc(r.consejo)}</span></p>` : ""}
        <p class="rd-nota">Cada opinión, unos 4 centavos de dólar.</p>
        <button type="button" class="link-btn rop-otra" data-rop-h="otra">Preguntarle otra vez</button>`;
    pintarIconos(el);
  };
  const preguntar = async () => {
    pintar(null);
    try {
      const clima = RO() && RO().climaParaIA ? await RO().climaParaIA() : "";
      const r = await IA().opinar(Object.assign({ outfit: lista, ropero: E.roperoParaCharla(D.lista()), clima, ocasion: x.ocasion || "" }, contexto()));
      opinados.set(k, r);
      if (h.abierta()) pintar(r);
    } catch (e) {
      if (h.abierta()) pintar(null, (e && e.message) || "Tu estilista no pudo contestar. Intenta de nuevo.");
    }
  };
  if (opinados.has(k)) pintar(opinados.get(k)); else preguntar();
  if (x.desde) h.volver = x.desde;
  h.el.onchange = null; h.el.onsubmit = null; h.el.oninput = null;
  h.el.onclick = e => {
    const b = e.target.closest("[data-rop-h]");
    if (!b) return;
    if (b.dataset.ropH === "otra") { opinados.delete(k); preguntar(); return; }
    if (b.dataset.ropH === "cambiar" && x.alCambiar) {
      const c = (opinados.get(k) || { cambios: [] }).cambios[Number(b.dataset.i)];
      if (!c) return;
      h.volver = null;
      h.cerrar();
      x.alCambiar(c.sale, c.entra);
    }
  };
}

window.RopaOpinion = { html, opinar, disponible };
})();
