// ---------- Ropa: Outfits (#ropa-outfits, D-149) ----------
// "¿Qué me pongo hoy?": el clima de tu ciudad (la eliges; las recientes quedan
// a un toque, para cuando viajes) para hoy o mañana, con cómo sientes el frío;
// la ocasión (las de siempre y las tuyas: "+ Otra"); 3 opciones solo con tu
// ropa y tu estilo de Pinterest (con la IA si está conectada; si no, o si no
// puede, con reglas: js/ropa-outfit-motor.js), cada una con la inspiración a
// la que se parece; "Me lo pongo" (anota lo que te pusiste), "Guardar" (o para
// mañana), "Otra opción" (cambia esa sola), "No me gusta" (no vuelve; llega
// otra) y "Otras opciones" (las tres). "¿Con qué combino esto?"
// (#ropa-outfits/con/{id}, desde la ficha): la prenda va en las tres. Abajo:
// lo de hoy, tus guardados y el calendario de lo que te pusiste.
// Ver en grande (D-156): cada opción, guardado o día se abre con las fotos
// juntas, de la cabeza a los pies (js/ropa-armar-motor.js), y lleva a "Armar
// el mío" (js/ropa-armar.js) para cambiar una prenda, editar o duplicar.
// Tu estilista (D-158): arriba, "Pídelo con tus palabras" abre una conversación
// nueva (js/ropa-estilista.js) con lo que escribiste; el clima de hoy y de
// mañana le llega en palabras (climaParaIA).
// Datos: js/ropa-outfits-datos.js; clima: js/ropa-clima.js (Open-Meteo, sin
// tu ubicación); ajustes (ciudad, cómo sientes el frío): meta/ropa_ajustes.
(function () {
"use strict";
const M = window.RopaMotor, O = window.RopaOutfitMotor, C = window.RopaClima, D = window.RopaDatos, DO = window.RopaOutfitsDatos, DI = window.RopaInspDatos, AR = window.RopaArmarMotor;
const IA = () => window.RopaIA, A = () => window.RopaApp, I = () => window.RopaInspMotor;
const app = document.getElementById("rof-app");
if (!M || !O || !C || !D || !DO || !DI || !AR || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const partes = () => location.hash.replace(/^#/, "").split("/");
const pantalla = () => partes()[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const iaOutfits = () => !!(IA() && IA().disponible() && IA().version() >= 3);
const aviso = (t, d, v) => A().aviso(t, d, v);
const fallo = e => A().fallo(e);
const guardarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
const leerLocal = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };

// ---------- El estado de la pantalla ----------
const est = {
  dia: null,                 // "hoy" | "manana" (de noche, mañana)
  ocasion: (leerLocal("manolo.ropa.ocasion") || "casual"),
  opciones: [], reserva: [], vistas: [], nota: "", clave: "", origen: "",
  armando: false, mes: null, ocasionNueva: ""
};
const ajustes = () => DI.ajustes() || {};
// Tus ocasiones (meta/ropa_ajustes.ocasiones) y la elegida (si la quitaste, Casual).
const propias = () => O.ocasionesPropias(ajustes().ocasiones);
const ocasionValida = id => !!O.OCASION[id] || propias().some(o => o.id === id);
const ocasionActual = () => O.ocasion(est.ocasion, propias());
const nombreOcasion = id => (ocasionValida(id) ? O.ocasion(id, propias()).nombre : "");
// Para la IA: la tuya va con la de base ("Universidad (como casual)").
const ocasionIA = () => { const oc = ocasionActual(); return oc.como ? `${oc.nombre} (como ${O.OCASION[oc.como].nombre.toLowerCase()})` : oc.nombre; };
// Tu estilo de Pinterest para las reglas: los colores (los de "Mi estilo" o
// los que más se repiten) y los estilos de tus inspiraciones (desde 3 con ropa).
function estiloCtx() {
  if (!I()) return null;
  const g = I().estiloGuardado(ajustes().estilo);
  const l = I().estiloLocal(DI.lista());
  const colores = g && g.colores.length ? g.colores : l.n >= I().MIN_ESTILO ? l.colores.map(c => c.id) : [];
  const estilos = l.n >= I().MIN_ESTILO ? l.estilos.map(e => e.id) : [];
  return colores.length || estilos.length ? { colores, estilos } : null;
}
// La inspiración a la que se parece una opción (o nada). Se recuerda hasta
// que cambia tu ropa o tus inspiraciones (con muchos pines, compara bastante).
const inspCache = new Map();
D.al(() => inspCache.clear());
DI.al(() => inspCache.clear());
function inspDe(o) {
  if (!I() || !I().parecidaA) return null;
  const k = O.clave(o.prendas);
  if (!inspCache.has(k)) {
    const r = I().parecidaA(o.prendas.map(id => D.una(id)).filter(Boolean), DI.lista());
    inspCache.set(k, r ? r.id : "");
  }
  const id = inspCache.get(k);
  return id ? DI.una(id) : null;
}
const ciudad = () => C.ciudad(ajustes().ciudad || C.LA_PAZ);
const sensacion = () => (["friolento", "normal", "caluroso"].includes(ajustes().sensacion) ? ajustes().sensacion : "normal");
const base = () => (partes()[1] === "con" && partes()[2] ? decodeURIComponent(partes()[2]) : null);

// ---------- El clima (con caché de una hora; sin internet, lo último) ----------
const CACHE = "manolo.ropa.clima";
let clima = null;          // { dias, offset, hora, viejo, k }
let climaError = "", climaPidiendo = null, climaPidiendoK = "";
const claveCiudad = () => `${ciudad().lat},${ciudad().lon}`;
const climaDe = (json, hora, viejo, k) => ({ dias: C.leer(json), offset: json.utc_offset_seconds || 0, hora, viejo, k });
// El clima de la ciudad elegida. Si mientras llegaba cambiaste de ciudad, lo
// que llegó no sirve: se pide el de la nueva.
function pedirClima(forzar) {
  const c = ciudad(), k = `${c.lat},${c.lon}`;
  const guardado = leerLocal(CACHE);
  if (!forzar && clima && clima.k === k && Date.now() - clima.hora < 3600e3) return Promise.resolve(clima);
  if (!forzar && guardado && guardado.k === k && Date.now() - guardado.hora < 3600e3) {
    clima = climaDe(guardado.json, guardado.hora, false, k);
    return Promise.resolve(clima);
  }
  if (climaPidiendo && climaPidiendoK === k) return climaPidiendo;
  if (clima && clima.k !== k) clima = null;   // el de otra ciudad no sirve
  climaPidiendoK = k;
  const pedido = climaPidiendo = fetch(C.urlPronostico(c.lat, c.lon))
    .then(r => { if (!r.ok) throw new Error(`clima ${r.status}`); return r.json(); })
    .then(json => {
      if (k !== claveCiudad()) return "otra";
      guardarLocal(CACHE, { k, hora: Date.now(), json });
      clima = climaDe(json, Date.now(), false, k);
      climaError = "";
      return clima;
    })
    .catch(e => {
      if (k !== claveCiudad()) return "otra";
      console.warn("Ropa (clima):", e);
      if (guardado && guardado.k === k) { clima = climaDe(guardado.json, guardado.hora, true, k); return clima; }
      climaError = navigator.onLine === false ? "Sin internet: no tengo el clima de hoy." : "No pude traer el clima.";
      clima = null;
      return null;
    })
    .then(x => {
      if (climaPidiendo === pedido) { climaPidiendo = null; climaPidiendoK = ""; }
      if (x === "otra") return pedirClima();
      render();
      return x;
    });
  return pedido;
}
// El día elegido (hoy o mañana, en la fecha de la ciudad) y lo que pide.
function elDia() {
  if (!clima || !clima.dias.length) return null;
  const ahora = C.enLaCiudad(clima.offset);
  if (!est.dia) est.dia = ahora.hora >= 20 ? "manana" : "hoy";
  const fecha = est.dia === "manana" ? C.manana(ahora.fecha) : ahora.fecha;
  const d = C.diaDe(clima.dias, fecha);
  return d ? { d, fecha, nec: C.necesidades(d, sensacion()) } : null;
}
// Sin clima (sin internet y sin nada guardado), igual se arma: templado.
const NEC_SIN_CLIMA = { base: "templado", abrigo: "liviano", capas: false, lluvia: "", tormenta: false, nieve: false, viento: false, sol: false };
const fechaDelDia = () => { const x = elDia(); return x ? x.fecha : (est.dia === "manana" ? C.manana(D.hoy()) : D.hoy()); };

// ---------- Fotos (miniatura al toque, la mediana cuando se ve) ----------
const verFoto = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  verFoto.unobserve(e.target);
  subirFoto(e.target);
}), { rootMargin: "200px" }) : null;
function subirFoto(img) {
  const id = img.dataset.foto;
  if (id && D.Fotos) D.Fotos.url(id, "media").then(u => { if (u && img.dataset.foto === id) img.src = u; });
}
function fotosGrandes(raiz) {
  raiz.querySelectorAll("img[data-foto]").forEach(img => { if (verFoto) verFoto.observe(img); else subirFoto(img); });
}
// Las prendas de un outfit: las fotos (cada una lleva a su ficha) y sus nombres.
function prendasHTML(ids) {
  const ps = ids.map(id => D.una(id)).filter(Boolean);
  return `<ul class="rof-fotos">${ps.map(p => `<li><a href="#ropa-prenda/${encodeURIComponent(p.id)}" class="rof-foto-a" aria-label="${esc(M.titulo(p))}">${A().fotoHTML(p, "ro-foto")}</a></li>`).join("")}</ul>
    <p class="rof-lista">${ps.map(p => esc(M.titulo(p))).join("\u00a0· ")}</p>`;
}
const principales = ids => ids.filter(id => { const p = D.una(id); return p && p.grupo !== "accesorios"; });
const armar_ = () => window.RopaArmar;   // "Armar el mío" (js/ropa-armar.js)
// ---------- Ver en grande (D-156) ----------
// Las fotos juntas, como se ve puesto: lo de arriba (de afuera hacia adentro),
// lo de abajo, los pies y los accesorios; cada una lleva a su ficha. Debajo,
// los nombres completos.
const FILA = { arriba: "Arriba", abajo: "Abajo", pies: "Los pies", accesorios: "Accesorios" };
function fotoTab(p) {
  const f = p.fotos[0];
  return f ? `<span class="rof-tab-foto"><img src="${esc(f.mini || "")}" data-foto="${esc(f.id)}" alt="" decoding="async"></span>`
    : `<span class="rof-tab-foto is-vacia">${icono("ropa")}</span>`;
}
function tableroHTML(ids) {
  const ps = ids.map(id => D.una(id)).filter(Boolean);
  return `<div class="rof-tablero">${AR.filas(ps).map(f => `<ul class="rof-tab-fila is-${f.id} n${Math.min(f.prendas.length, 4)}" aria-label="${FILA[f.id]}">${f.prendas.map(p =>
    `<li><a class="rof-tab" href="#ropa-prenda/${encodeURIComponent(p.id)}">${fotoTab(p)}<span class="rof-tab-n">${esc(M.titulo(p))}</span>${p.estado === "lavar" ? `<span class="rof-tab-lavar">Para lavar</span>` : ""}</a></li>`).join("")}</ul>`).join("")}</div>
    <p class="rof-lista">${AR.ordenar(ps).map(p => esc(M.titulo(p))).join("\u00a0· ")}</p>`;
}
// En la tarjeta de cada opción: las fotos (al tocarlas, en grande) y los nombres.
function fotosOpcionHTML(o, i) {
  const ps = o.prendas.map(id => D.una(id)).filter(Boolean);
  return `<div class="rof-ver-a" data-rof-op="ver" data-i="${i}"><span class="rof-fotos">${ps.map(p => `<span class="rof-foto-a" data-prenda="${esc(p.id)}">${A().fotoHTML(p, "ro-foto")}</span>`).join("")}</span>
    <p class="rof-lista">${ps.map(p => esc(M.titulo(p))).join("\u00a0· ")}</p></div>
    <div class="rof-op-ver"><button type="button" class="link-btn" data-rof-op="ver" data-i="${i}" aria-haspopup="dialog">${icono("ampliar")}Ver en grande</button>
      ${armar_() ? `<button type="button" class="link-btn" data-rof-op="cambiar" data-i="${i}">${icono("edit")}Cambiar una prenda</button>` : ""}</div>`;
}

// ---------- La pantalla ----------
function climaHTML() {
  const c = ciudad();
  const x = elDia();
  const dias = `<div class="rof-dias" role="radiogroup" aria-label="Para qué día">
    ${[["hoy", "Hoy"], ["manana", "Mañana"]].map(([v, t]) => `<button type="button" class="lug-chip${est.dia === v ? " is-activo" : ""}" role="radio" aria-checked="${est.dia === v}" data-rof-dia="${v}">${t}</button>`).join("")}</div>`;
  let cuerpo;
  if (x) {
    const cs = C.consejos(x.nec, x.d);
    cuerpo = `<p class="rof-clima-r"><b>${esc(M.fechaLarga(x.fecha).replace(/^./, s => s.toUpperCase()))}</b> · ${esc(C.resumen(x.d))}</p>
      <ul class="rof-consejos">${cs.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      ${sensacion() !== "normal" ? `<p class="rd-nota">Ajustado a que eres ${sensacion()} (<a href="#ropa-ajustes">cambiar</a>).</p>` : ""}
      ${clima.viejo ? `<p class="rd-nota">Sin internet: el pronóstico de las ${new Date(clima.hora).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}.</p>` : ""}`;
  } else if (climaPidiendo) cuerpo = `<p class="rd-nota" role="status"><span class="rsp-rueda rin-rueda" aria-hidden="true"></span>Trayendo el clima…</p>`;
  else cuerpo = `<p class="rin-error">${esc(climaError || "Todavía no tengo el clima.")} Igual puedo armar tus outfits.</p><button type="button" class="link-btn" data-rof="reclima">Reintentar</button>`;
  return `<section class="tmp-card rof-clima" aria-labelledby="rof-clima-t">
    <div class="rof-clima-cab"><h2 class="ro-sub" id="rof-clima-t">${icono("clima")}<span>${esc(c.nombre)}</span></h2>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-rof="ciudad" aria-haspopup="dialog">Cambiar ciudad</button></div>
    ${dias}${cuerpo}</section>`;
}
// "Pídelo con tus palabras": a tu estilista (con la IA lista; sin internet, lo avisa).
function estilistaHTML() {
  const RE = window.RopaEstilista, DE = window.RopaEstilistaDatos;
  if (!RE || !IA() || !(IA().estilista() || IA().sinInternet())) return "";
  const sin = IA().sinInternet() || !IA().estilista();
  const n = DE ? DE.lista().length : 0;
  return `<section class="tmp-card roe-pide" aria-labelledby="roe-pide-t">
    <h2 class="ro-sub" id="roe-pide-t">${icono("sparkle")}<span>Tu estilista</span></h2>
    <form class="roe-pide-form" data-rof-pide novalidate>
      <label class="roe-pide-label" for="rof-pide">${sin ? "Sin internet: tu estilista necesita conexión." : "Pídelo con tus palabras. Por ejemplo: «Hace frío: una chompa y una chamarra encima»."}</label>
      <div class="roe-pide-fila">
        <input class="lib-input" id="rof-pide" name="texto" maxlength="600" placeholder="Escribe o dicta aquí" autocomplete="off" enterkeyhint="send"${sin ? " disabled" : ""}>
        <button type="submit" class="lib-btn roe-enviar" aria-label="Enviar a tu estilista"${sin ? " disabled" : ""}>${icono("send")}</button>
      </div>
    </form>
    <a class="roe-pide-ver" href="#ropa-estilista">${n ? `Tus conversaciones (${n})` : "Abrir tu estilista"}</a>
  </section>`;
}
function ocasionesHTML() {
  return `<fieldset class="ro-campo rof-ocasion"><legend>Para qué</legend><div class="ro-opciones">${O.OCASIONES.concat(propias()).map(o =>
    `<label class="ro-op-chip"><input type="radio" name="rof-ocasion" value="${esc(o.id)}"${est.ocasion === o.id ? " checked" : ""}><span>${esc(o.nombre)}</span></label>`).join("")}
    <button type="button" class="ro-op-chip rof-oc-nueva" data-rof="ocasion-nueva" aria-haspopup="dialog">+ Otra</button></div></fieldset>`;
}
function opcionesHTML() {
  if (!est.opciones.length) return "";
  const manana = est.dia === "manana";
  return `<section class="rof-ops" aria-labelledby="rof-ops-t"><h2 class="ro-sub" id="rof-ops-t">Tus opciones${manana ? " para mañana" : " para hoy"}</h2>
    ${est.nota ? `<p class="rin-consejo">${icono("sparkle")}${esc(est.nota)}</p>` : ""}
    <ol class="rof-opciones">${est.opciones.map((o, i) => { const x = inspDe(o); return `<li class="tmp-card rof-op">
      <div class="rof-op-cab"><h3 class="rof-op-t"><span class="rof-op-n">Opción ${i + 1}</span>${esc(o.nombre || "Para hoy")}</h3>${o.origen === "ia" ? `<span class="rof-ia">${icono("sparkle")}IA</span>` : ""}</div>
      ${fotosOpcionHTML(o, i)}
      ${o.porque ? `<p class="rof-porque">${esc(o.porque)}</p>` : ""}
      ${o.capas ? `<p class="rd-nota rof-capas">${esc(o.capas)}</p>` : ""}
      ${x ? inspHTML(x) : ""}
      <div class="rof-op-bot">
        <button type="button" class="lib-btn" data-rof-op="puse" data-i="${i}">${icono("check")}${manana ? "Para mañana" : "Me lo pongo"}</button>
        <button type="button" class="lib-btn-sec" data-rof-op="guardar" data-i="${i}">${icono("guardar")}Guardar</button>
        <button type="button" class="lib-btn-sec" data-rof-op="otra" data-i="${i}"${est.armando ? " disabled" : ""}>${icono("swap")}Otra opción</button>
        <button type="button" class="lib-btn-sec" data-rof-op="no" data-i="${i}">${icono("close")}No me gusta</button>
      </div></li>`; }).join("")}</ol>
    <button type="button" class="lib-btn-sec rof-otras" data-rof="otras"${est.armando ? " disabled" : ""}>Otras opciones</button></section>`;
}
function inspHTML(x) {
  const f = x.fotos[0];
  const src = f && f.mini ? f.mini : x.pin && x.pin.img ? x.pin.img : "";
  return `<a class="rof-insp" href="#ropa-pin/${encodeURIComponent(x.id)}">${src ? `<img src="${esc(src)}" alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer">` : icono("inspiracion")}<span>Se parece a tu inspiración <b>«${esc(I().titulo(x))}»</b></span></a>`;
}
// Lo de hoy: lo que te pusiste (de aquí, de un pin o de la ficha) o lo que elegiste ayer para hoy.
function hoyHTML() {
  const hoy = D.hoy();
  const u = D.usosDocs()[hoy];
  const puestas = u && Array.isArray(u.prendas) ? u.prendas.filter(id => D.una(id)) : [];
  if (puestas.length) {
    const o = u.outfitId ? DO.una(u.outfitId) : null;
    return `<section class="tmp-card rof-hoy" aria-labelledby="rof-hoy-t"><h2 class="ro-sub" id="rof-hoy-t">${icono("check")}Hoy te pusiste${o && o.nombre ? `: ${esc(o.nombre)}` : ""}</h2>${prendasHTML(puestas)}
      <button type="button" class="link-btn rof-hoy-ver" data-rof-cal="${hoy}" aria-haspopup="dialog">${icono("ampliar")}Ver en grande</button></section>`;
  }
  const para = DO.lista().find(o => o.para === hoy && o.guardado);
  if (para) {
    return `<section class="tmp-card rof-hoy" aria-labelledby="rof-hoy-t"><h2 class="ro-sub" id="rof-hoy-t">Para hoy elegiste${para.nombre ? `: ${esc(para.nombre)}` : ""}</h2>${prendasHTML(para.prendas)}
      <button type="button" class="link-btn rof-hoy-ver" data-rof-g="${esc(para.id)}" aria-haspopup="dialog">${icono("ampliar")}Ver en grande</button>
      <button type="button" class="lib-btn" data-rof-g="${esc(para.id)}" data-rof-gp="puse">${icono("check")}Me lo pongo</button></section>`;
  }
  return "";
}
function collage(ids) {
  const ps = ids.map(id => D.una(id)).filter(Boolean).filter(p => p.grupo !== "accesorios").slice(0, 4);
  return `<span class="rof-collage n${ps.length}" aria-hidden="true">${ps.map(p => A().fotoHTML(p, "ro-foto")).join("")}</span>`;
}
function guardadosHTML() {
  const gs = DO.lista().filter(o => o.guardado && o.prendas.some(id => D.una(id)));
  if (!gs.length) return "";
  return `<section class="rof-guardados-s" aria-labelledby="rof-g-t"><h2 class="ro-sub" id="rof-g-t">Guardados (${gs.length})</h2>
    <ul class="rof-guardados">${gs.map(o => `<li><button type="button" class="rof-g" data-rof-g="${esc(o.id)}" aria-haspopup="dialog">${collage(o.prendas)}<span class="rof-g-t">${esc(o.nombre || "Outfit")}</span>${o.para ? `<span class="rof-g-para">Para el ${esc(M.fechaLarga(o.para).split(" ").slice(0, 2).join(" "))}</span>` : ""}</button></li>`).join("")}</ul></section>`;
}
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function calendarioHTML() {
  const hoy = D.hoy();
  if (!est.mes) est.mes = hoy.slice(0, 7);
  const [y, m] = est.mes.split("-").map(Number);
  const primero = new Date(Date.UTC(y, m - 1, 1)), dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vacios = (primero.getUTCDay() + 6) % 7;   // la semana empieza el lunes
  const docs = D.usosDocs();
  const celdas = [];
  for (let i = 0; i < vacios; i++) celdas.push(`<li class="rof-cal-v" aria-hidden="true"></li>`);
  for (let d = 1; d <= dias; d++) {
    const f = `${est.mes}-${String(d).padStart(2, "0")}`;
    const ps = (docs[f] && Array.isArray(docs[f].prendas) ? docs[f].prendas : []).map(id => D.una(id)).filter(Boolean);
    const p = ps.find(x => x.grupo !== "accesorios") || ps[0];
    const foto = p && p.fotos[0] && p.fotos[0].mini ? `<img src="${esc(p.fotos[0].mini)}" alt="" decoding="async" loading="lazy">` : p ? `<i class="rof-cal-punto" aria-hidden="true"></i>` : "";
    celdas.push(ps.length
      ? `<li><button type="button" class="rof-cal-d tiene${f === hoy ? " es-hoy" : ""}" data-rof-cal="${f}" aria-label="${esc(M.fechaLarga(f))}: ${plural(ps.length, "prenda", "prendas")}" aria-haspopup="dialog"><span>${d}</span>${foto}</button></li>`
      : `<li><span class="rof-cal-d${f === hoy ? " es-hoy" : ""}"${f === hoy ? ' aria-current="date"' : ""}><span>${d}</span></span></li>`);
  }
  const puestos = Object.keys(docs).filter(f => f.startsWith(est.mes) && Array.isArray(docs[f].prendas) && docs[f].prendas.length).length;
  return `<section class="tmp-card rof-cal" aria-labelledby="rof-cal-t">
    <div class="rof-cal-cab"><button type="button" class="rof-cal-ir" data-rof-mes="-1" aria-label="Mes anterior">${icono("chevronLeft")}</button>
      <h2 class="ro-sub" id="rof-cal-t">${MESES[m - 1]} ${y}</h2>
      <button type="button" class="rof-cal-ir" data-rof-mes="1" aria-label="Mes siguiente"${est.mes >= hoy.slice(0, 7) ? " disabled" : ""}>${icono("chevronRight")}</button></div>
    <p class="rd-nota rof-cal-n">${puestos ? `Anotaste lo que te pusiste ${plural(puestos, "día", "días")}.` : "Este mes todavía no anotaste lo que te pusiste."}</p>
    <ol class="rof-cal-sem" aria-hidden="true">${["L", "M", "M", "J", "V", "S", "D"].map(x => `<li>${x}</li>`).join("")}</ol>
    <ol class="rof-cal-grilla">${celdas.join("")}</ol></section>`;
}
function render() {
  if (pantalla() !== "ropa-outfits") return;
  if (!D.cargada()) { app.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  const activas = D.lista().filter(p => p.estado === "activa");
  // La ocasión elegida ya no está (la quitaste en Ajustes): Casual. La recién
  // agregada espera a que llegue de la nube.
  if (est.ocasionNueva && propias().some(o => o.id === est.ocasionNueva)) est.ocasionNueva = "";
  if (DI.ajustesListos() && !ocasionValida(est.ocasion) && est.ocasion !== est.ocasionNueva) { est.ocasion = "casual"; guardarLocal("manolo.ropa.ocasion", est.ocasion); recuperarOpciones(); }
  const b = base() && D.una(base());
  const sinRopa = !activas.length;
  // Lo que escribías para tu estilista queda (aunque se vuelva a pintar).
  const pide = app.querySelector("#rof-pide");
  const pideV = pide ? pide.value : "", pideFoco = !!pide && document.activeElement === pide;
  app.innerHTML = `
    ${b ? `<div class="rof-base" role="status">${A().fotoHTML(b, "ro-foto rof-base-foto")}<span>Combinando con <b>${esc(M.titulo(b))}</b></span><a class="rof-base-x" href="#ropa-outfits" aria-label="Dejar de combinar con ${esc(M.titulo(b))}">${icono("close")}</a></div>` : ""}
    ${climaHTML()}
    ${sinRopa || b ? "" : estilistaHTML()}
    ${hoyHTML()}
    ${sinRopa ? `<div class="run-vacio"><span class="icon" data-icon="ropa"></span><p><b>Primero, tu ropa.</b></p><p>Agrega tus prendas al ropero (con el +) y aquí armo tus outfits.</p><a class="lib-btn" href="#ropa">Ir al ropero</a></div>`
      : `${ocasionesHTML()}
      <button type="button" class="lib-btn rof-armar" data-rof="${est.opciones.length ? "otras" : "armar"}"${est.armando ? " disabled" : ""}>${icono("sparkle")}${est.armando ? "Armando…" : est.opciones.length ? "Otras opciones" : b ? "Armar con esta prenda" : "¿Qué me pongo?"}</button>
      <p class="rd-nota rof-con">${iaOutfits() ? "Con la IA, solo con tu ropa." : "Con reglas, solo con tu ropa (sin IA, gratis)."}</p>
      ${armar_() ? `<a class="lib-btn-sec rof-mio" href="#ropa-armar">${icono("edit")}Armar el mío</a>` : ""}
      <div aria-live="polite">${opcionesHTML()}</div>`}
    ${guardadosHTML()}
    ${calendarioHTML()}`;
  if (pideV || pideFoco) {
    const n = app.querySelector("#rof-pide");
    if (n) { n.value = pideV; if (pideFoco) n.focus({ preventScroll: true }); }
  }
  pintarIconos(app);
  fotosGrandes(app);
}

// ---------- Armar ----------
const claveDe = () => [fechaDelDia(), ciudad().lat, ciudad().lon, est.ocasion, base() || ""].join("|");
const GUARDADAS = "manolo.ropa.opciones";
function guardarOpciones() { guardarLocal(GUARDADAS, { clave: est.clave, opciones: est.opciones, reserva: est.reserva, vistas: est.vistas, nota: est.nota }); }
function recuperarOpciones() {
  const k = claveDe();
  if (est.clave === k) return;
  const g = leerLocal(GUARDADAS);
  if (g && g.clave === k) Object.assign(est, { clave: k, opciones: g.opciones || [], reserva: g.reserva || [], vistas: g.vistas || [], nota: g.nota || "" });
  else Object.assign(est, { clave: k, opciones: [], reserva: [], vistas: [], nota: "" });
}
// Lo que necesitan las reglas (y para revisar lo que contesta la IA).
function ctxArmar(evitar) {
  const x = elDia();
  return { nec: x ? x.nec : NEC_SIN_CLIMA, ocasion: est.ocasion, ocasiones: propias(), usos: D.usos(), hoy: D.hoy(), outfits: DO.lista(), estilo: estiloCtx(), base: base(), evitar: evitar || [], n: 5 };
}
async function armar(otras) {
  if (est.armando) return;
  recuperarOpciones();
  const x = elDia();
  const ropero = D.lista();
  const ctx = ctxArmar(otras ? est.vistas : []);
  est.armando = true;
  render();
  // 5 opciones: se ven 3; las otras quedan para "Otra opción" (sin volver a preguntar).
  let opciones = [], nota = "", porIA = false;
  if (iaOutfits()) {
    try {
      const g = I() && I().estiloGuardado(ajustes().estilo);
      const r = await IA().outfits({
        ropero: O.roperoParaIA(ropero), clima: x ? C.paraIA(ciudad(), x.d, x.nec) : "Sin el clima de hoy.", necesidades: ctx.nec,
        ocasion: ocasionIA(), estilo: g ? g.resumen : "", recientes: O.recientes(D.usosDocs(), D.hoy()),
        gustan: DO.lista().filter(o => o.gusto === "si").slice(0, 15).map(o => o.prendas), noGustan: DO.lista().filter(o => o.gusto === "no").slice(0, 15).map(o => o.prendas),
        evitar: ctx.evitar, base: base()
      });
      opciones = O.validas(r.outfits, ropero, ctx).slice(0, 5).map(o => Object.assign({ origen: "ia" }, o));
      nota = r.nota || "";
      porIA = opciones.length > 0;
      if (!porIA) aviso("La IA no armó nada que se pueda poner: estas son con reglas.");
    } catch (e) { aviso(`${(e && e.message) || "La IA no pudo."} Estas son con reglas.`); }
  }
  if (!porIA) {
    const r = O.armar(ropero, ctx);
    opciones = r.opciones.map(o => Object.assign({ origen: "reglas" }, o));
    if (!opciones.length) aviso(r.falta);
  }
  est.armando = false;
  if (opciones.length) {
    est.opciones = opciones.slice(0, 3);
    est.reserva = opciones.slice(3);
    est.nota = nota;
    est.vistas = (otras ? est.vistas : []).concat(est.opciones.map(o => principales(o.prendas)));
    est.clave = claveDe();
    guardarOpciones();
  }
  render();
  const ops = app.querySelector(".rof-ops");
  if (ops && opciones.length) ops.scrollIntoView({ block: "start", behavior: "smooth" });
}
// Lo que se guarda con el outfit.
function datosDe(o) {
  const x = elDia(), insp = inspDe(o);
  return { ocasion: est.ocasion, origen: o.origen, nombre: o.nombre, porque: o.porque, capas: o.capas, ciudad: ciudad().nombre, clima: x ? C.resumen(x.d) : "", inspiracionId: insp ? insp.id : "" };
}
function sacar(i) { est.opciones.splice(i, 1); guardarOpciones(); render(); }
// "Otra opción" (y después de "No me gusta"): cambia esa sola. Primero las
// que quedaron guardadas (de la IA o de las reglas); si no hay, con reglas,
// sin nada de lo que ya viste. → si pudo.
const sePuede = o => o.prendas.every(id => { const p = D.una(id); return p && p.estado === "activa"; });
function otraOpcion(i) {
  if (!est.opciones[i]) return false;
  // Las de reserva, si siguen sirviendo (en el medio algo pudo pasar a "para lavar").
  let o = est.reserva.shift();
  while (o && !sePuede(o)) o = est.reserva.shift();
  if (!o) {
    const vistas = est.vistas.concat(est.opciones.map(x => principales(x.prendas)));
    const r = O.armar(D.lista(), ctxArmar(vistas));
    const nuevas = r.opciones.map(x => Object.assign({ origen: "reglas" }, x));
    o = nuevas.shift();
    est.reserva = nuevas;
  }
  if (!o) { guardarOpciones(); return false; }
  est.opciones.splice(i, 1, o);
  est.vistas.push(principales(o.prendas));
  guardarOpciones();
  render();
  return true;
}
app.addEventListener("click", e => {
  const dia = e.target.closest("[data-rof-dia]");
  if (dia) { est.dia = dia.dataset.rofDia; recuperarOpciones(); render(); return; }
  const mes = e.target.closest("[data-rof-mes]");
  if (mes) {
    const [y, m] = est.mes.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + Number(mes.dataset.rofMes), 1));
    est.mes = d.toISOString().slice(0, 7);
    render();
    return;
  }
  const cal = e.target.closest("[data-rof-cal]");
  if (cal) { verDia(cal.dataset.rofCal, cal); return; }
  const g = e.target.closest("[data-rof-g]");
  if (g) {
    if (g.dataset.rofGp === "puse") ponermeGuardado(g.dataset.rofG); else verGuardado(g.dataset.rofG, g);
    return;
  }
  const op = e.target.closest("[data-rof-op]");
  if (op) { accionOpcion(op.dataset.rofOp, Number(op.dataset.i), op); return; }
  const b = e.target.closest("[data-rof]");
  if (!b) return;
  const a = b.dataset.rof;
  if (a === "armar") armar(false);
  else if (a === "otras") armar(true);
  else if (a === "ciudad") elegirCiudad(b);
  else if (a === "reclima") pedirClima(true);
  else if (a === "ocasion-nueva") nuevaOcasion(b);
});
// "Pídelo con tus palabras" → una conversación nueva con tu estilista.
app.addEventListener("submit", e => {
  const f = e.target.closest("[data-rof-pide]");
  if (!f) return;
  e.preventDefault();
  const campo = f.elements.texto;
  if (!campo.value.trim()) { campo.focus(); return; }
  if (window.RopaEstilista && window.RopaEstilista.pedir(campo.value)) campo.value = "";
});
app.addEventListener("change", e => {
  if (e.target.name !== "rof-ocasion") return;
  est.ocasion = e.target.value;
  guardarLocal("manolo.ropa.ocasion", est.ocasion);
  recuperarOpciones();
  render();
});
function accionOpcion(a, i, desde) {
  const o = est.opciones[i];
  if (!o) return;
  const ids = o.prendas;
  // El foco vuelve al botón "Ver en grande" (aunque hayas tocado las fotos).
  if (a === "ver") { verOpcion(i, desde && desde.tagName === "BUTTON" ? desde : app.querySelector(`.rof-op-ver [data-rof-op="ver"][data-i="${i}"]`)); return; }
  if (a === "cambiar") { if (armar_()) armar_().abrir(ids, { modo: "cambiar", ocasion: est.ocasion, datos: datosDe(o) }); return; }
  if (a === "puse") {
    if (est.dia === "manana") {
      const para = fechaDelDia();
      DO.guardar(ids, datosDe(o), para).then(r => {
        aviso(`Listo: ${o.nombre ? `«${o.nombre}»` : "el outfit"} queda para mañana.`, () => (r.nuevo ? DO.borrar(r.id) : DO.quitarGuardado(r.id)).catch(fallo));
      }, fallo);
      sacar(i);
      return;
    }
    const nuevas = ids.filter(id => !D.puestaHoy(id));
    DO.ponerme(ids, datosDe(o), D.hoy()).then(r => {
      aviso("Listo: anotado lo que te pusiste hoy.", () => DO.quitarme(r.id, nuevas, D.hoy(), r.nuevo).catch(fallo));
    }, fallo);
    est.opciones = [];
    guardarOpciones();
    render();
    window.scrollTo(0, 0);
  } else if (a === "guardar") {
    DO.guardar(ids, datosDe(o)).then(r => aviso("Guardado en tus outfits.", () => (r.nuevo ? DO.borrar(r.id) : DO.quitarGuardado(r.id)).catch(fallo)), fallo);
  } else if (a === "otra") {
    if (!otraOpcion(i)) aviso("No encontré otra opción distinta: prueba con otra ocasión.");
  } else if (a === "no") {
    const ya = DO.deCombo(ids);
    const antes = ya ? DO.crudo(ya.id) : null;
    const datos = datosDe(o);
    if (!otraOpcion(i)) sacar(i);
    DO.noMeGusta(ids, datos).then(r => aviso("No vuelve a salir.", () => (r.nuevo ? DO.borrar(r.id) : DO.restaurar(r.id, antes)).catch(fallo)), fallo);
  }
}
// "+ Otra": una ocasión tuya (la universidad, la iglesia…), que se arma como
// la de base que elijas. Se quitan en Ajustes de Ropa.
function nuevaOcasion(desde) {
  const h = A().hoja("rof-hoja-ocasion");
  h.mostrar("Nueva ocasión", `<form class="rin-form rof-oc-form" novalidate>
    <label class="rd-campo">Nombre<input class="lib-input" name="nombre" maxlength="24" placeholder="Por ejemplo: Universidad, Iglesia" autocomplete="off"></label>
    <fieldset class="ro-campo"><legend>¿A cuál se parece?</legend><div class="ro-opciones">${O.OCASIONES.map((o, i) =>
      `<label class="ro-op-chip"><input type="radio" name="como" value="${o.id}"${i === 0 ? " checked" : ""}><span>${esc(o.nombre)}</span></label>`).join("")}</div>
      <small class="rd-nota">Manolo la arma como esa: qué tan formal, el sol y los accesorios.</small></fieldset>
    <p class="rin-error" data-rof-oc-error role="alert" hidden></p>
    <button type="submit" class="lib-btn">Guardar ocasión</button></form>`, "[name=nombre]");
  if (desde) h.volver = desde;
  h.el.onclick = null; h.el.onchange = null;
  h.el.oninput = () => { const err = h.el.querySelector("[data-rof-oc-error]"); if (err) err.hidden = true; };
  h.el.onsubmit = e => {
    e.preventDefault();
    const f = h.el.querySelector("form"), err = h.el.querySelector("[data-rof-oc-error]");
    const nombre = f.elements.nombre.value.replace(/\s+/g, " ").trim();
    const como = (f.querySelector("[name=como]:checked") || {}).value || "casual";
    const nueva = { id: `o-${Date.now().toString(36)}`, nombre, como };
    const todas = O.ocasionesPropias(propias().concat([nueva]));
    const mal = !nombre ? "Ponle un nombre." : propias().length >= 8 ? "Ya tienes 8 ocasiones tuyas: quita una en Ajustes de Ropa." : !todas.some(o => o.id === nueva.id) ? "Ya tienes una ocasión con ese nombre." : "";
    if (mal) { err.textContent = mal; err.hidden = false; f.elements.nombre.focus(); return; }
    DI.guardarAjustes({ ocasiones: todas }).catch(fallo);
    est.ocasion = est.ocasionNueva = nueva.id;
    guardarLocal("manolo.ropa.ocasion", est.ocasion);
    h.volver = null;
    h.cerrar();
    recuperarOpciones();
    render();
    aviso(`Listo: «${nombre}» queda en tus ocasiones.`);
  };
}

// ---------- Un guardado ----------
function ponermeGuardado(id) {
  const o = DO.una(id);
  if (!o) return;
  const ids = o.prendas.filter(x => D.una(x));
  const nuevas = ids.filter(x => !D.puestaHoy(x));
  DO.ponerme(ids, {}, D.hoy()).then(r => aviso("Listo: anotado lo que te pusiste hoy.", () => DO.quitarme(r.id, nuevas, D.hoy(), false).catch(fallo)), fallo);
}
function verGuardado(id, desde) {
  const o = DO.una(id);
  if (!o) return;
  const h = A().hoja("rof-hoja-guardado");
  h.mostrar(o.nombre || "Outfit", `<div class="rof-hoja-o">${tableroHTML(o.prendas)}
    ${o.porque ? `<p class="rof-porque">${esc(o.porque)}</p>` : ""}
    ${o.capas ? `<p class="rd-nota">${esc(o.capas)}</p>` : ""}
    <p class="rd-nota">${[nombreOcasion(o.ocasion), o.ciudad, o.clima].filter(Boolean).map(esc).join(" · ")}</p>
    ${o.puesto.length ? `<p class="rd-nota">Te lo pusiste ${plural(o.puesto.length, "vez", "veces")}; la última, el ${esc(M.fechaLarga(o.puesto[o.puesto.length - 1]))}.</p>` : ""}
    <div class="rof-op-bot">
      <button type="button" class="lib-btn" data-rof-h="puse">${icono("check")}Me lo pongo hoy</button>
      ${armar_() ? `<button type="button" class="lib-btn-sec" data-rof-h="editar">${icono("edit")}Editar</button>
      <button type="button" class="lib-btn-sec" data-rof-h="duplicar">${icono("copy")}Duplicar</button>` : ""}
      <button type="button" class="lib-btn-sec" data-rof-h="quitar">Quitar de guardados</button>
    </div></div>`);
  if (desde) h.volver = desde;
  pintarIconos(h.el);
  fotosGrandes(h.el);
  h.el.onchange = null; h.el.onsubmit = null;
  h.el.onclick = e => {
    const b = e.target.closest("[data-rof-h]");
    if (!b) { if (e.target.closest(".rof-tab")) { h.volver = null; h.cerrar(); } return; }
    const a = b.dataset.rofH;
    if (a === "editar" || a === "duplicar") { h.volver = null; h.cerrar(); location.hash = `ropa-armar/${a === "editar" ? "o" : "d"}/${encodeURIComponent(id)}`; return; }
    h.cerrar();
    if (a === "puse") ponermeGuardado(id);
    else { DO.quitarGuardado(id).catch(fallo); aviso("Quitado de tus guardados.", () => DO.guardar(o.prendas, {}, o.para || null).catch(fallo)); }
  };
}
// ---------- Un día del calendario ----------
function verDia(f, desde) {
  const u = D.usosDocs()[f] || {};
  const ids = (Array.isArray(u.prendas) ? u.prendas : []).filter(id => D.una(id));
  const o = u.outfitId ? DO.una(u.outfitId) : null;
  const h = A().hoja("rof-hoja-dia");
  h.mostrar(M.fechaLarga(f).replace(/^./, s => s.toUpperCase()), `<div class="rof-hoja-o">
    ${o && o.nombre ? `<p><b>${esc(o.nombre)}</b>${o.ciudad ? ` · ${esc(o.ciudad)}` : ""}</p>` : ""}
    ${ids.length ? tableroHTML(ids) : `<p class="rd-nota">Ese día no anotaste nada.</p>`}</div>`);
  if (desde) h.volver = desde;
  pintarIconos(h.el);
  fotosGrandes(h.el);
  h.el.onchange = null; h.el.onsubmit = null;
  h.el.onclick = e => { if (e.target.closest(".rof-tab")) { h.volver = null; h.cerrar(); } };
}
// ---------- Una opción, en grande (con las de al lado a un toque) ----------
function verOpcion(i, desde) {
  const o = est.opciones[i];
  if (!o) return;
  const n = est.opciones.length, manana = est.dia === "manana", x = inspDe(o);
  const h = A().hoja("rof-hoja-ver");
  h.mostrar(o.nombre || `Opción ${i + 1}`, `<div class="rof-ver">
    ${n > 1 ? `<div class="rof-ver-nav"><button type="button" class="rof-ver-ir" data-rof-v="ant" aria-label="La opción anterior">${icono("chevronLeft")}</button>
      <span>Opción ${i + 1} de ${n}</span>
      <button type="button" class="rof-ver-ir" data-rof-v="sig" aria-label="La opción siguiente">${icono("chevronRight")}</button></div>` : ""}
    ${tableroHTML(o.prendas)}
    ${o.porque ? `<p class="rof-porque">${esc(o.porque)}</p>` : ""}
    ${o.capas ? `<p class="rd-nota rof-capas">${esc(o.capas)}</p>` : ""}
    ${x ? inspHTML(x) : ""}
    <div class="rof-op-bot">
      <button type="button" class="lib-btn" data-rof-v="puse">${icono("check")}${manana ? "Para mañana" : "Me lo pongo"}</button>
      <button type="button" class="lib-btn-sec" data-rof-v="guardar">${icono("guardar")}Guardar</button>
      <button type="button" class="lib-btn-sec" data-rof-v="otra"${est.armando ? " disabled" : ""}>${icono("swap")}Otra opción</button>
      <button type="button" class="lib-btn-sec" data-rof-v="no">${icono("close")}No me gusta</button>
    </div>
    ${armar_() ? `<button type="button" class="link-btn rof-ver-cambiar" data-rof-v="cambiar">${icono("edit")}Cambiar una prenda</button>` : ""}
  </div>`);
  if (desde) h.volver = desde;
  pintarIconos(h.el);
  fotosGrandes(h.el);
  h.el.onchange = null; h.el.onsubmit = null;
  h.el.onclick = e => {
    const b = e.target.closest("[data-rof-v]");
    if (!b) { if (e.target.closest(".rof-tab, .rof-insp")) { h.volver = null; h.cerrar(); } return; }
    const a = b.dataset.rofV;
    if (a === "ant" || a === "sig") { verOpcion((i + (a === "sig" ? 1 : n - 1)) % n); return; }
    if (a === "otra" || a === "no") {
      accionOpcion(a, i);
      if (est.opciones.length) verOpcion(Math.min(i, est.opciones.length - 1)); else h.cerrar();
      return;
    }
    if (a === "cambiar") { h.volver = null; h.cerrar(); accionOpcion("cambiar", i); return; }
    h.cerrar();
    accionOpcion(a, i);
  };
}
// Un outfit cualquiera, solo para mirarlo (desde "Armar el mío").
function verPrendas(ids, titulo, desde) {
  const h = A().hoja("rof-hoja-ver");
  h.mostrar(titulo || "Tu outfit", `<div class="rof-ver">${tableroHTML(ids)}</div>`);
  if (desde) h.volver = desde;
  pintarIconos(h.el);
  fotosGrandes(h.el);
  h.el.onchange = null; h.el.onsubmit = null;
  h.el.onclick = e => { if (e.target.closest(".rof-tab")) { h.volver = null; h.cerrar(); } };
}
// Para tu estilista (D-158): el clima de hoy y de mañana, en palabras (o "" sin clima).
function climaParaIA() {
  return pedirClima().then(() => {
    if (!clima || !clima.dias.length) return "";
    const ahora = C.enLaCiudad(clima.offset);
    return [["Hoy", ahora.fecha], ["Mañana", C.manana(ahora.fecha)]].map(([n, f]) => {
      const d = C.diaDe(clima.dias, f);
      return d ? `${n} (${M.fechaLarga(f)}): ${C.paraIA(ciudad(), d, C.necesidades(d, sensacion()))}` : "";
    }).filter(Boolean).join("\n");
  }, () => "");
}
// Para "Armar el mío": el día elegido (hoy o mañana), lo que pide el clima, la ciudad y la ocasión.
function contexto() {
  const x = elDia();
  return { dia: est.dia || "hoy", fecha: fechaDelDia(), nec: x ? x.nec : null, clima: x ? C.resumen(x.d) : "", ciudad: ciudad().nombre, ocasion: est.ocasion };
}

// ---------- La ciudad (buscar; las recientes a un toque) ----------
function elegirCiudad(desde) {
  const h = A().hoja("rof-hoja-ciudad");
  const recientes = (Array.isArray(ajustes().ciudades) ? ajustes().ciudades : []).map(C.ciudad).filter((c, i, a) => a.findIndex(x => C.mismaCiudad(x, c)) === i);
  const actual = ciudad();
  const fila = (c, i, tipo) => `<li><button type="button" class="ro-op${C.mismaCiudad(c, actual) ? " is-sel" : ""}" data-rof-c="${tipo}:${i}"><span><b>${esc(c.nombre)}</b> <small>${esc(C.detalleCiudad(c))}</small></span></button></li>`;
  h.mostrar("¿En qué ciudad estás?", `<form class="rin-form rof-ciudad" novalidate>
    <p class="rd-nota">Para el clima. Manolo nunca usa tu ubicación: la eliges tú.</p>
    <label class="lug-buscar"><span class="lug-buscar-ic" data-icon="search" aria-hidden="true"></span>
      <input type="search" class="lib-input" name="q" placeholder="Busca tu ciudad" aria-label="Buscar ciudad" autocomplete="off" enterkeyhint="search"></label>
    <ul class="rof-ciudades" data-rof-res aria-live="polite"></ul>
    ${recientes.length ? `<h4 class="ro-mas-t">Las que usaste</h4><ul class="rof-ciudades">${recientes.map((c, i) => fila(c, i, "r")).join("")}</ul>` : ""}
    ${recientes.some(c => C.mismaCiudad(c, C.LA_PAZ)) ? "" : `<h4 class="ro-mas-t">Por defecto</h4><ul class="rof-ciudades">${fila(C.LA_PAZ, 0, "lp")}</ul>`}
  </form>`, "[name=q]");
  if (desde) h.volver = desde;
  pintarIconos(h.el);
  let resultados = [], t = null, pedido = 0;
  const lista = () => h.el.querySelector("[data-rof-res]");
  const buscar = q => {
    const n = ++pedido;
    if (q.trim().length < 2) { resultados = []; lista().innerHTML = ""; return; }
    lista().innerHTML = `<li class="rd-nota">Buscando…</li>`;
    fetch(C.urlBuscar(q)).then(r => r.json()).then(j => {
      if (n !== pedido) return;
      resultados = C.ciudades(j, actual.codigoPais || "BO");
      lista().innerHTML = resultados.length ? resultados.map((c, i) => fila(c, i, "b")).join("") : `<li class="rd-nota">No encontré esa ciudad.</li>`;
    }).catch(() => { if (n === pedido) lista().innerHTML = `<li class="rd-nota">Sin internet: no puedo buscar ahora.</li>`; });
  };
  h.el.oninput = e => { if (e.target.name === "q") { clearTimeout(t); t = setTimeout(() => buscar(e.target.value), 350); } };
  h.el.onsubmit = e => { e.preventDefault(); clearTimeout(t); buscar(h.el.querySelector("[name=q]").value); };
  h.el.onchange = null;
  h.el.onclick = e => {
    const b = e.target.closest("[data-rof-c]");
    if (!b) return;
    const [tipo, i] = b.dataset.rofC.split(":");
    const c = tipo === "b" ? resultados[Number(i)] : tipo === "r" ? recientes[Number(i)] : C.LA_PAZ;
    if (!c) return;
    const limpia = C.ciudad(c);
    const nuevas = [limpia].concat(recientes.filter(x => !C.mismaCiudad(x, limpia))).slice(0, 5);
    DI.guardarAjustes({ ciudad: limpia, ciudades: nuevas }).catch(fallo);
    h.cerrar();
    clima = null;
    est.clave = "";
    aviso(`Listo: el clima de ${limpia.nombre}.`);
    setTimeout(() => { pedirClima(true); render(); }, 50);
  };
}

// ---------- Cuándo se pinta ----------
function alEntrar() {
  if (pantalla() !== "ropa-outfits") return;
  // Con el clima guardado (de hace menos de una hora) queda listo al toque, antes de pintar.
  const pedido = pedirClima();
  recuperarOpciones();
  render();
  pedido.then(() => {
    if (pantalla() !== "ropa-outfits") return;
    recuperarOpciones();
    render();
    // "¿Con qué combino esto?": arma solo, si todavía no hay opciones con esa prenda.
    if (base() && !est.opciones.length && !est.armando && D.cargada()) armar(false);
  });
}
window.addEventListener("hashchange", alEntrar);
document.addEventListener("DOMContentLoaded", alEntrar);
D.al(() => { if (pantalla() === "ropa-outfits") render(); });
DO.al(() => { if (pantalla() === "ropa-outfits") render(); });
DI.al(() => {
  if (pantalla() !== "ropa-outfits") return;
  // Si cambió la ciudad (aquí, en Ajustes o en otro teléfono), se pide su clima.
  if ((clima ? clima.k : climaPidiendoK) !== claveCiudad()) pedirClima();
  render();
});
if (IA()) IA().alCambiar(() => { if (pantalla() === "ropa-outfits") render(); });
if (window.RopaEstilistaDatos) window.RopaEstilistaDatos.al(() => { if (pantalla() === "ropa-outfits") render(); });
window.RopaOutfits = { render, armar, elegirCiudad, tableroHTML, ver: verPrendas, contexto, pedirClima, climaParaIA };
})();
