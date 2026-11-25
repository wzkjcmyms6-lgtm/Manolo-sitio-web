// ---------- Ropa: tu estilista (#ropa-estilista, D-158) ----------
// Conversar con la IA como con un estilista: le escribes (o le dictas con el
// micrófono del teclado) lo que necesitas y te contesta corto, con outfits
// solo con tu ropa (las fotos en capas, "Ver en grande", "Cambiar una
// prenda", "Me lo pongo", "Guardar", "Otra opción" y "No me gusta"), lo que te
// faltaría ("A mi lista") y lo que recordó de ti ("Olvidar"). Arriba: tus
// conversaciones (la más nueva primero; borrar, con Deshacer) y lo que
// recuerda de ti. Al puente (/charla, versión 5) le van tu ropa (con lo que
// está para lavar marcado), lo hablado antes, el clima de hoy y de mañana, tu
// estilo, lo que te pusiste hace poco, lo que te gustó y lo que no, lo que
// recuerda de ti y tu presupuesto; lo que contesta se revisa aquí
// (RopaOutfitMotor.validas: completo y con tu ropa). Sin internet, lo hablado
// se ve igual. Nada corre solo: cada mensaje lo mandas tú. Recuerda lo del día
// (D-159): "Pídelo con tus palabras" sigue la conversación de hoy, y le llegan
// los outfits de antes con su número y su nombre, y lo que ya viste hoy (en
// Outfits y en tus otras conversaciones).
// Conectado (D-161): "Para mañana" en cada outfit (queda en tus guardados para
// mañana, como en Outfits) y #ropa-estilista/{id} abre esa conversación (el
// link de "Hoy te armó…", en Outfits y en Inicio). El ♥ (D-163): a tus
// favoritos (y tus favoritos le llegan primero).
// Datos: js/ropa-estilista-datos.js; lógica: js/ropa-estilista-motor.js.
(function () {
"use strict";
const M = window.RopaMotor, O = window.RopaOutfitMotor, E = window.RopaEstilistaMotor, D = window.RopaDatos, DO = window.RopaOutfitsDatos, DI = window.RopaInspDatos, DE = window.RopaEstilistaDatos;
const IA = () => window.RopaIA, A = () => window.RopaApp, RO = () => window.RopaOutfits, K = () => window.RopaComprasMotor, DD = () => window.RopaComprasDatos, I = () => window.RopaInspMotor;
const app = document.getElementById("roe-app");
if (!M || !O || !E || !D || !DO || !DI || !DE || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const partes = () => location.hash.replace(/^#/, "").split("/");
const pantalla = () => partes()[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const aviso = (t, d) => A().aviso(t, d);
const fallo = e => A().fallo(e);
const leerLocal = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const guardarLocal = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } };
const usd = n => `US$ ${(Math.round(n * 100) / 100).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const minuscula = t => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
// La fecha de mañana ("AAAA-MM-DD").
const manana = () => { const C = window.RopaClima; if (C && C.manana) return C.manana(D.hoy()); const d = new Date(`${D.hoy()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

// ---------- El estado ----------
const ACTUAL = "manolo.ropa.charla", BORRADOR = "manolo.ropa.charla.borrador";
const est = {
  id: leerLocal(ACTUAL),   // la conversación abierta ("" = una nueva)
  pensando: "",            // la conversación que espera respuesta
  error: null,             // { id, texto, codigo }: lo que salió mal en la última pregunta
  local: null              // { id, mensajes }: lo recién escrito, hasta que llega de la nube
};
function abrirCharla(id) { est.id = id || ""; guardarLocal(ACTUAL, est.id); }
// La conversación abierta (con lo recién escrito, si todavía no llegó de la nube).
function actual() {
  const c = est.id ? DE.una(est.id) : null;
  if (est.local && est.local.id === est.id) {
    if (!c || est.local.mensajes.length > c.mensajes.length) {
      const base = c || { id: est.id, titulo: E.titulo((est.local.mensajes[0] || {}).texto), mensajes: [], creado: Date.now(), editado: Date.now() };
      return Object.assign({}, base, { mensajes: est.local.mensajes });
    }
    est.local = null;
  }
  return c;
}
const hayRopa = () => D.lista().some(p => p.estado === "activa" || p.estado === "lavar");
// ¿Se puede preguntar? "" si sí; si no, por qué.
function porQueNo() {
  const ia = IA();
  if (!ia || !ia.puente()) return "La IA todavía no está conectada: tu estilista la necesita.";
  if (ia.sinInternet()) return "Sin internet: tu estilista necesita conexión. Lo que hablaron antes se ve igual.";
  const e = ia.estado();
  if (!e) return ia.fallo() ? `${ia.fallo()}` : "Revisando la conexión con tu estilista…";
  if (!e.permitido) return "Tu estilista usa la IA, que es solo para el dueño de Manolo.";
  if (!e.lista) return "Falta la clave de la IA en Cloudflare.";
  if (ia.version() < 5) return "Falta actualizar el puente de la IA para hablar con tu estilista.";
  if (D.cargada() && !hayRopa()) return "Primero, tu ropa: agrega tus prendas al ropero y aquí te armo outfits.";
  return "";
}

// ---------- La pantalla (lo de arriba, la conversación y el cuadro para escribir) ----------
app.innerHTML = `
  <div class="lug-chips roe-cab" id="roe-cab" role="toolbar" aria-label="Tu estilista"></div>
  <div class="roe-cuerpo" id="roe-cuerpo"></div>
  <p class="visually-hidden" role="status" id="roe-vivo"></p>
  <form class="roe-escribir" id="roe-escribir" novalidate>
    <div class="roe-escribir-fila">
      <label class="visually-hidden" for="roe-texto">Tu mensaje para tu estilista</label>
      <textarea class="lib-input roe-texto" id="roe-texto" rows="1" maxlength="${E.MAX_TEXTO}" placeholder="Escribe o dicta aquí" enterkeyhint="send" autocomplete="off"></textarea>
      <button type="submit" class="lib-btn roe-enviar" id="roe-enviar" aria-label="Enviar a tu estilista">${icono("send")}</button>
    </div>
    <p class="rd-nota roe-nota" id="roe-nota"></p>
  </form>`;
pintarIconos(app);
const $ = id => document.getElementById(id);
const ta = $("roe-texto");
ta.value = leerLocal(BORRADOR);
function autoalto() { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight + 2, 160)}px`; }
const vivo = t => { const el = $("roe-vivo"); if (el) el.textContent = t; };

// Las fotos (la miniatura al toque; la mediana cuando se ve).
const verFoto = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  verFoto.unobserve(e.target);
  subirFoto(e.target);
}), { rootMargin: "200px" }) : null;
function subirFoto(img) {
  const id = img.dataset.foto;
  if (id && D.Fotos) D.Fotos.url(id, "media").then(u => { if (u && img.dataset.foto === id) img.src = u; });
}
const fotosGrandes = raiz => raiz.querySelectorAll("img[data-foto]").forEach(img => { if (verFoto) verFoto.observe(img); else subirFoto(img); });

function cabHTML(c) {
  const n = DE.lista().length, mem = DE.memoria().length;
  return `<button type="button" class="lug-chip" data-roe="charlas" aria-haspopup="dialog">${icono("comment")}Conversaciones${n ? `<span class="ro-n">${n}</span>` : ""}</button>
    <button type="button" class="lug-chip" data-roe="memoria" aria-haspopup="dialog">${icono("user")}Lo que recuerda de ti${mem ? `<span class="ro-n">${mem}</span>` : ""}</button>
    ${c ? `<button type="button" class="lug-chip" data-roe="nueva">${icono("plus")}Nueva</button>` : ""}`;
}
function vacioHTML() {
  return `<div class="roe-vacio">
    <p class="roe-hola">${icono("sparkle")}<span><b>Hola, soy tu estilista.</b> Pídeme outfits con tu ropa, para el clima de hoy o para una ocasión, o pregúntame qué combina con qué.</span></p>
    <p class="rd-nota">Toca un ejemplo para escribirlo:</p>
    <div class="roe-ejemplos">${E.EJEMPLOS.map(t => `<button type="button" class="roe-ejemplo" data-roe-ej="${esc(t)}">${esc(t)}</button>`).join("")}</div>
  </div>`;
}
// Un outfit de tu estilista: las fotos, por qué, las capas y qué hacer con él.
function outfitHTML(o, i, j, n, ocupado) {
  const ps = o.prendas.map(id => D.una(id));
  const hay = ps.filter(p => p && p.estado !== "fuera");
  const noEsta = ps.length - hay.length;
  const lavar = hay.filter(p => p.estado === "lavar");
  const ya = DO.deCombo(o.prendas);
  const estado = !ya ? "" : ya.puesto.includes(D.hoy()) ? "Te lo pusiste hoy." : ya.gusto === "no" ? "No te gustó: no vuelve a salir en Outfits."
    : ya.guardado && ya.para === manana() ? "Lo elegiste para mañana." : ya.guardado ? "Está en tus guardados." : "";
  const k = `data-m="${i}" data-o="${j}"`;
  return `<li class="tmp-card rof-op roe-op">
    <div class="rof-op-cab"><h3 class="rof-op-t">${n > 1 ? `<span class="rof-op-n">Opción ${j + 1}</span>` : ""}${esc(o.nombre || "Tu outfit")}</h3>
      ${noEsta ? "" : `<button type="button" class="rof-fav-b${ya && ya.favorito ? " is-on" : ""}" data-roe-o="fav" ${k} aria-pressed="${!!(ya && ya.favorito)}" aria-label="Favorito">${icono(ya && ya.favorito ? "corazonLleno" : "corazon")}</button>`}</div>
    ${hay.length ? `<div class="rof-ver-a" data-roe-o="ver" ${k}><span class="rof-fotos">${hay.map(p => `<span class="rof-foto-a" data-prenda="${esc(p.id)}">${A().fotoHTML(p, "ro-foto")}</span>`).join("")}</span>
      <p class="rof-lista">${hay.map(p => esc(M.titulo(p))).join(" · ")}</p></div>` : ""}
    <div class="rof-op-ver"><button type="button" class="link-btn" data-roe-o="ver" ${k} aria-haspopup="dialog">${icono("ampliar")}Ver en grande</button>
      ${window.RopaArmar && !noEsta ? `<button type="button" class="link-btn" data-roe-o="cambiar" ${k}>${icono("edit")}Cambiar una prenda</button>` : ""}
      ${noEsta ? "" : `<button type="button" class="link-btn" data-roe-o="manana" ${k}>${icono("calendar")}Para mañana</button>`}</div>
    ${o.porque ? `<p class="rof-porque">${esc(o.porque)}</p>` : ""}
    ${o.capas ? `<p class="rd-nota rof-capas">${esc(o.capas)}</p>` : ""}
    ${noEsta ? `<p class="rd-nota">${noEsta === 1 ? "Una prenda de este outfit ya no está en tu ropero." : `${noEsta} prendas de este outfit ya no están en tu ropero.`}</p>` : ""}
    ${lavar.length ? `<p class="roe-lavar">${icono("lavar")}<span>Está para lavar: ${lavar.map(p => esc(M.titulo(p))).join(", ")}.</span></p>` : ""}
    ${estado ? `<p class="roe-estado">${icono("check")}<span>${esc(estado)}</span></p>` : ""}
    ${noEsta ? "" : `<div class="rof-op-bot">
      <button type="button" class="lib-btn" data-roe-o="puse" ${k}>${icono("check")}Me lo pongo</button>
      <button type="button" class="lib-btn-sec" data-roe-o="guardar" ${k}>${icono("guardar")}Guardar</button>
      <button type="button" class="lib-btn-sec" data-roe-o="otra" ${k}${ocupado ? " disabled" : ""}>${icono("swap")}Otra opción</button>
      <button type="button" class="lib-btn-sec" data-roe-o="no" ${k}>${icono("close")}No me gusta</button></div>`}
  </li>`;
}
// Lo que te faltaría (con "A mi lista").
const cosaDe = f => ({ grupo: f.grupo, tipo: f.tipo, colores: M.COLOR[f.color] ? [f.color] : [] });
function faltaHTML(f, i, j) {
  const KK = K(), DDD = DD();
  const nombre = KK ? KK.normalizarDeseo("x", cosaDe(f)).nombre : f.tipo;
  const ya = KK && DDD ? DDD.deClave(KK.clave(cosaDe(f))) : null;
  return `<div class="roe-falta"><p>${icono("heart")}<span>Te falta: <b>${esc(nombre)}</b>${f.porque ? `<br><span class="rd-nota">${esc(f.porque)}</span>` : ""}</span></p>
    ${ya ? `<a class="link-btn roe-falta-ya" href="#ropa-compras">${icono("check")}En tu lista de deseos</a>`
      : DDD ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-roe-f="${j}" data-m="${i}">A mi lista</button>` : ""}</div>`;
}
// Lo que recordó de ti (mientras lo siga recordando).
function recordoHTML(m) {
  const mem = DE.memoria();
  return m.recordo.filter(t => E.recuerda(mem, t)).map(t => `<p class="roe-recordo">${icono("user")}<span>Lo recordé: ${esc(minuscula(t))}</span>
    <button type="button" class="link-btn" data-roe-r="${esc(t)}" aria-label="Olvidar: ${esc(t)}">Olvidar</button></p>`).join("");
}
function mensajeHTML(m, i, ocupado) {
  if (m.de === "yo") return `<li class="roe-m is-yo"><p class="roe-burbuja">${esc(m.texto)}</p></li>`;
  return `<li class="roe-m is-ia"><p class="roe-quien">${icono("sparkle")}Tu estilista</p>
    ${m.texto ? `<p class="roe-burbuja">${esc(m.texto)}</p>` : ""}
    ${m.outfits.length ? `<ol class="roe-ops">${m.outfits.map((o, j) => outfitHTML(o, i, j, m.outfits.length, ocupado)).join("")}</ol>` : ""}
    ${m.sinMostrar ? `<p class="rd-nota">${m.sinMostrar === 1 ? "Una opción no se podía poner con tu ropa (le faltaba algo): no la muestro." : `${m.sinMostrar} opciones no se podían poner con tu ropa: no las muestro.`}</p>` : ""}
    ${m.faltan.map((f, j) => faltaHTML(f, i, j)).join("")}
    ${recordoHTML(m)}</li>`;
}
function render() {
  if (pantalla() !== "ropa-estilista") return;
  const c = actual();
  const no = porQueNo();
  const ocupado = !!(no || est.pensando);
  $("roe-cab").innerHTML = cabHTML(c);
  let cuerpo;
  if (!D.cargada() || !DE.cargada()) cuerpo = `<p class="rd-nota">Cargando…</p>`;
  else if (!c) cuerpo = vacioHTML();
  else {
    const u = E.sinRespuesta(c), err = est.error && est.error.id === c.id ? est.error : null;
    cuerpo = `<h2 class="visually-hidden">Conversación: ${esc(c.titulo)}</h2>
      <ol class="roe-mensajes">${c.mensajes.map((m, i) => mensajeHTML(m, i, ocupado)).join("")}
        ${est.pensando === c.id ? `<li class="roe-m is-ia is-pensando"><p class="roe-quien">${icono("sparkle")}Tu estilista</p><p class="roe-burbuja"><span class="roe-puntos" aria-hidden="true"><i></i><i></i><i></i></span>Pensando…</p></li>` : ""}</ol>
      ${u && est.pensando !== c.id ? `<div class="roe-sin">${err ? `<p class="rin-error">${esc(err.texto)}${err.codigo === "tope" ? ` <a href="#ropa-ajustes">Ajustes de Ropa</a>` : ""}</p>` : `<p class="rd-nota">Tu estilista no llegó a contestar esto.</p>`}
        ${no ? "" : `<button type="button" class="lib-btn-sec lib-btn-chico" data-roe="reintentar">Volver a preguntar</button>`}</div>` : ""}
      ${E.llena(c) ? `<p class="rd-nota roe-llena">Esta conversación ya es larga: lo que escribas empieza una nueva (lo que recuerda de ti sigue).</p>` : ""}`;
  }
  const cuerpoEl = $("roe-cuerpo");
  cuerpoEl.innerHTML = cuerpo;
  // El cuadro para escribir (no se vuelve a pintar: lo que escribes queda).
  ta.disabled = !!no;
  $("roe-enviar").disabled = !!no || !!est.pensando;
  const g = IA() && IA().estado() && IA().estado().gasto;
  $("roe-nota").textContent = no || `Cada mensaje, unos 4 centavos de dólar${g && typeof g.usd === "number" ? ` · Este mes: ${usd(g.usd)} de ${usd(g.tope || 8)}` : ""}.`;
  pintarIconos($("roe-cab"));
  pintarIconos(cuerpoEl);
  fotosGrandes(cuerpoEl);
}
// Después de mandar: lo último a la vista. Al llegar la respuesta: su comienzo.
function alFinal() { const l = app.querySelector(".roe-m:last-child"); if (l) l.scrollIntoView({ block: "end", behavior: "smooth" }); }
function verRespuesta() { const l = app.querySelector(".roe-m.is-ia:last-child"); if (l) l.scrollIntoView({ block: "start", behavior: "smooth" }); }

// ---------- Preguntar ----------
// El presupuesto de ropa del mes (si tienes uno).
function presupuesto() {
  const KK = K();
  if (!KK) return "";
  const tope = KK.presupuesto((DI.ajustes() || {}).presupuestoMes);
  return tope ? E.presupuestoTexto(tope, KK.gastoDelMes(D.lista(), D.hoy().slice(0, 7)).total) : "";
}
async function datosIA(t, antes, id) {
  const aj = DI.ajustes() || {};
  const v6 = IA().version() >= 6;   // el puente que recuerda lo del día (D-159)
  const g = I() && I().estiloGuardado ? I().estiloGuardado(aj.estilo) : null;
  let clima = "";
  try { clima = RO() && RO().climaParaIA ? await RO().climaParaIA() : ""; } catch (e) { clima = ""; }
  return {
    mensaje: t, ropero: E.roperoParaCharla(D.lista()), historial: E.historial(antes, v6), clima: clima || "",
    ...(v6 ? { hoy: E.delDia(DE.lista(), id, D.hoy(), RO() && RO().opcionesDelDia ? RO().opcionesDelDia() : []) } : {}),
    estilo: g ? g.resumen : "", recientes: O.recientes(D.usosDocs(), D.hoy()),
    gustan: DO.gustan(15).map(o => o.prendas),
    noGustan: DO.lista().filter(o => o.gusto === "no").slice(0, 15).map(o => o.prendas),
    memoria: DE.memoria().map(m => m.texto), presupuesto: presupuesto()
  };
}
// Lo que contestó el puente → el mensaje de tu estilista (revisado aquí) y lo que recordó de ti.
function respuesta(r) {
  const x = r || {};
  const ops = Array.isArray(x.outfits) ? x.outfits : [];
  const validas = O.validas(ops, D.lista(), {}).slice(0, 3);
  const faltan = (Array.isArray(x.faltan) ? x.faltan : []).filter(f => f && M.GRUPO[f.grupo] && f.tipo).slice(0, 2)
    .map(f => ({ grupo: f.grupo, tipo: M.mayus(String(f.tipo)), color: M.COLOR[f.color] ? f.color : "", porque: String(f.porque || "") }));
  const ahora = Date.now();
  const rec = E.recordar(DE.memoria(), x.recordar, ahora, i => `m${ahora.toString(36)}${i}`);
  if (rec.nuevos.length) DE.guardarMemoria(rec.lista).catch(fallo);
  const outfits = validas.map(o => ({ prendas: o.prendas, nombre: o.nombre || "", porque: o.porque || "", capas: o.capas || "" }));
  const texto = String(x.respuesta || "") || (outfits.length ? "" : "No pude armar outfits que se puedan poner con tu ropa. ¿Me lo pides de otra forma?");
  return { de: "ia", texto, outfits, faltan, recordo: rec.nuevos.map(n => n.texto), sinMostrar: Math.max(0, ops.length - validas.length), fecha: ahora };
}
// Pregunta (tu mensaje ya está en la conversación). → si contestó.
async function preguntar(id, t, antes) {
  est.pensando = id;
  est.error = null;
  vivo("Tu estilista está pensando…");
  render();
  alFinal();
  let r;
  try { r = await IA().charla(await datosIA(t, antes, id)); } catch (e) {
    est.pensando = "";
    est.error = { id, texto: (e && e.message) || "Tu estilista no pudo contestar.", codigo: (e && e.codigo) || "" };
    vivo(est.error.texto);
    render();
    return false;
  }
  const m = respuesta(r);
  const c = est.id === id ? actual() : DE.una(id);
  const previos = est.local && est.local.id === id ? est.local.mensajes : c ? c.mensajes : [];
  est.local = { id, mensajes: previos.concat([E.mensaje(m)].filter(Boolean)) };
  est.pensando = "";
  DE.agregar(id, m).catch(fallo);
  vivo(`Tu estilista: ${m.texto}${m.outfits.length ? ` (${plural(m.outfits.length, "outfit", "outfits")})` : ""}`);
  render();
  if (est.id === id) verRespuesta();
  return true;
}
// Mandar un mensaje (si la conversación está llena, o pides una nueva, empieza otra).
function puedoMandar() {
  const no = porQueNo();
  if (no) { aviso(no); return false; }
  if (est.pensando) { aviso("Espera la respuesta de tu estilista."); return false; }
  return true;
}
function enviar(texto, o) {
  const t = E.texto(texto, E.MAX_TEXTO);
  if (!t || !puedoMandar()) return false;
  const c = o && o.nueva ? null : actual();
  const m = { de: "yo", texto: t, fecha: Date.now() };
  let id, antes;
  if (!c || E.llena(c)) { id = DE.crear(m, fallo); antes = []; }
  else { id = c.id; antes = c.mensajes; DE.agregar(id, m).catch(fallo); }
  abrirCharla(id);
  est.local = { id, mensajes: antes.concat([E.mensaje(m)]) };
  preguntar(id, t, antes);
  return true;
}
// "Volver a preguntar": tu último mensaje, sin respuesta.
function reintentar() {
  const c = actual(), u = E.sinRespuesta(c);
  if (!u || !puedoMandar()) return;
  preguntar(c.id, u.texto, c.mensajes.slice(0, -1));
}

// ---------- Lo que haces con un outfit ----------
function outfitEn(i, j) {
  const c = actual();
  const m = c && c.mensajes[i];
  return m && m.de === "ia" ? m.outfits[j] || null : null;
}
function datosDe(o) {
  const cx = RO() && RO().contexto ? RO().contexto() : {};
  return { origen: "ia", nombre: o.nombre, porque: o.porque, capas: o.capas, ocasion: "", ciudad: cx.ciudad || "", clima: cx.clima || "" };
}
function accion(a, i, j, desde) {
  const o = outfitEn(i, j);
  if (!o) return;
  const ids = o.prendas.filter(id => D.una(id));
  if (a === "ver") { if (RO()) RO().ver(ids, o.nombre || "Tu outfit", desde); return; }
  if (a === "cambiar") { if (window.RopaArmar) window.RopaArmar.abrir(ids, { modo: "cambiar", ocasion: "", datos: datosDe(o) }); return; }
  if (a === "otra") { enviar(E.otraOpcion(o.nombre)); return; }
  if (a === "puse") {
    const nuevas = ids.filter(id => !D.puestaHoy(id));
    DO.ponerme(ids, datosDe(o), D.hoy()).then(r => aviso("Listo: anotado lo que te pusiste hoy.", () => DO.quitarme(r.id, nuevas, D.hoy(), r.nuevo).catch(fallo)), fallo);
  } else if (a === "guardar") {
    DO.guardar(ids, datosDe(o)).then(r => aviso("Guardado en tus outfits.", () => (r.nuevo ? DO.borrar(r.id) : DO.quitarGuardado(r.id)).catch(fallo)), fallo);
  } else if (a === "fav") {
    DO.alternarFavorito(ids, datosDe(o)).then(r => aviso(r.on ? "Listo: está en tus favoritos." : "Quitado de tus favoritos.", () => r.deshacer().catch(fallo)), fallo);
  } else if (a === "manana") {
    // Queda en tus guardados para mañana (como "Para mañana" en Outfits); Deshacer lo deja como estaba.
    const ya = DO.deCombo(ids), antes = ya ? DO.crudo(ya.id) : null;
    DO.guardar(ids, datosDe(o), manana()).then(r => aviso(`Listo: ${o.nombre ? `«${o.nombre}»` : "el outfit"} queda para mañana.`,
      () => (r.nuevo ? DO.borrar(r.id) : DO.restaurar(r.id, antes)).catch(fallo)), fallo);
  } else if (a === "no") {
    const ya = DO.deCombo(ids), antes = ya ? DO.crudo(ya.id) : null;
    DO.noMeGusta(ids, datosDe(o)).then(r => aviso("Listo: no vuelve a salir en Outfits.", () => (r.nuevo ? DO.borrar(r.id) : DO.restaurar(r.id, antes)).catch(fallo)), fallo);
  }
}
// "A mi lista": lo que te falta, a tu lista de deseos (con Deshacer).
function aMiLista(i, j) {
  const c = actual();
  const m = c && c.mensajes[i];
  const f = m && m.faltan[j];
  if (!f || !DD() || !K()) return;
  DD().agregar(cosaDe(f), { origen: "estilista", nota: f.porque })
    .then(r => aviso(`Listo: ${K().normalizarDeseo("x", cosaDe(f)).nombre} está en tu lista de deseos.`, r.nuevo ? () => DD().borrar(r.id).catch(fallo) : null), fallo);
}
// "Olvidar" algo que recordó (con Deshacer).
function olvidarFrase(frase) {
  const antes = DE.memoria();
  const k = E.claveMemoria(frase);
  const quitar = antes.filter(m => E.claveMemoria(m.texto) === k).map(m => m.id);
  if (!quitar.length) return;
  DE.guardarMemoria(E.olvidar(antes, quitar)).catch(fallo);
  aviso("Listo: tu estilista ya no lo recuerda.", () => DE.guardarMemoria(antes).catch(fallo));
}

// Lo que hiciste recién en una hoja, con su "Deshacer" ahí mismo (el aviso de
// abajo queda tapado por la hoja).
const hechoHTML = x => (x ? `<p class="roe-hecho" role="status"><span>${esc(x.texto)}</span>${x.deshacer ? `<button type="button" class="link-btn" data-roe-h="deshacer">Deshacer</button>` : ""}</p>` : "");

// ---------- Tus conversaciones ----------
function verCharlas(desde) {
  const h = A().hoja("roe-hoja-charlas");
  const quitadas = new Set();   // borradas recién (hasta que la nube lo confirme)
  const vueltas = new Map();    // las que volvieron con Deshacer (id → conversación), lo mismo
  let hecho = null;             // { texto, deshacer }
  const pintar = foco => {
    const nube = DE.lista();
    const cs = E.ordenar(nube.filter(c => !quitadas.has(c.id)).concat([...vueltas.values()].filter(v => !nube.some(c => c.id === v.id))));
    h.mostrar("Tus conversaciones", `<div class="roe-charlas-h">
      ${hechoHTML(hecho)}
      <button type="button" class="lib-btn roe-nueva" data-roe-h="nueva">${icono("plus")}Nueva conversación</button>
      ${cs.length ? `<ul class="roe-charlas">${cs.map(c => `<li${c.id === est.id ? ' class="is-actual"' : ""}>
        <button type="button" class="roe-charla" data-roe-h="abrir" data-id="${esc(c.id)}"${c.id === est.id ? ' aria-current="true"' : ""}><b>${esc(c.titulo)}</b><small>${esc(E.cuando(c.editado).replace(/^./, s => s.toUpperCase()))} · ${plural(c.mensajes.length, "mensaje", "mensajes")}</small></button>
        <button type="button" class="lib-btn-sec lib-btn-chico" data-roe-h="borrar" data-id="${esc(c.id)}" aria-label="Borrar «${esc(c.titulo)}»">Borrar</button></li>`).join("")}</ul>`
        : `<p class="rd-nota">Todavía no hablaste con tu estilista.</p>`}</div>`, foco);
    pintarIconos(h.el);
  };
  pintar();
  if (desde) h.volver = desde;
  h.el.onchange = null; h.el.onsubmit = null; h.el.oninput = null;
  h.el.onclick = e => {
    const b = e.target.closest("[data-roe-h]");
    if (!b) return;
    const a = b.dataset.roeH, id = b.dataset.id;
    if (a === "nueva") { h.volver = null; h.cerrar(); nueva(); return; }
    if (a === "abrir") { h.volver = null; h.cerrar(); abrirCharla(id); render(); window.scrollTo(0, 0); return; }
    if (a === "deshacer" && hecho) { const f = hecho.deshacer; hecho = null; pintar(f()); return; }
    if (a === "borrar") {
      const doc = DE.crudo(id), c = DE.una(id) || vueltas.get(id), era = est.id === id;
      if (!doc) return;
      DE.borrar(id).catch(fallo);
      quitadas.add(id);
      vueltas.delete(id);
      if (era) { abrirCharla(""); est.error = null; }
      hecho = { texto: `Borraste «${c ? c.titulo : "la conversación"}».`, deshacer: () => {
        quitadas.delete(id);
        vueltas.set(id, E.normalizar(id, doc));
        DE.restaurar(id, doc).catch(fallo);
        if (era) abrirCharla(id);
        render();
        return `[data-roe-h=abrir][data-id="${CSS.escape(id)}"]`;
      } };
      pintar("[data-roe-h=deshacer]");
      render();
    }
  };
}
function nueva() {
  abrirCharla("");
  est.error = null;
  render();
  window.scrollTo(0, 0);
  ta.focus({ preventScroll: true });
}

// ---------- Lo que recuerda de ti (también desde Ajustes de Ropa) ----------
function verMemoria(desde) {
  const h = A().hoja("roe-hoja-memoria");
  let hecho = null;            // { texto, deshacer }
  let lista = DE.memoria();    // lo último que escribiste aquí (la nube tarda un instante)
  const pintar = (nueva, foco) => {
    if (nueva) lista = nueva;
    const mem = lista;
    h.mostrar("Lo que recuerda de ti", `<div class="roe-mem">
      ${hechoHTML(hecho)}
      <p class="rd-nota">Tu estilista lo tiene en cuenta cada vez que le escribes. Se suma solo cuando le cuentas algo de ti (hasta 30 cosas; al pasar, se va lo más viejo).</p>
      ${mem.length ? `<ul class="roe-memoria">${mem.slice().reverse().map(m => `<li><span>${esc(m.texto)}</span>
        <button type="button" class="lib-btn-sec lib-btn-chico" data-roe-h="olvidar" data-id="${esc(m.id)}" aria-label="Borrar: ${esc(m.texto)}">Borrar</button></li>`).join("")}</ul>`
        : `<p class="roe-mem-vacia">Todavía no recuerda nada de ti.</p>`}
      <form class="rin-form roe-mem-form" novalidate>
        <label class="rd-campo">Agregar algo de ti<input class="lib-input" name="texto" maxlength="120" placeholder="Por ejemplo: No me gusta el amarillo" autocomplete="off" enterkeyhint="done"></label>
        <p class="rin-error" data-roe-mem-error role="alert" hidden></p>
        <button type="submit" class="lib-btn-sec">Agregar</button>
      </form></div>`, foco);
  };
  pintar();
  if (desde) h.volver = desde;
  h.el.onchange = null;
  h.el.oninput = () => { const err = h.el.querySelector("[data-roe-mem-error]"); if (err) err.hidden = true; };
  h.el.onclick = e => {
    const b = e.target.closest("[data-roe-h]");
    if (!b) return;
    if (b.dataset.roeH === "deshacer" && hecho) { const f = hecho.deshacer; hecho = null; pintar(f()); render(); return; }
    if (b.dataset.roeH !== "olvidar") return;
    const antes = lista, m = antes.find(x => x.id === b.dataset.id);
    if (!m) return;
    const nuevo = E.olvidar(antes, [m.id]);
    DE.guardarMemoria(nuevo).catch(fallo);
    hecho = { texto: `Borraste «${m.texto}»: ya no lo recuerda.`, deshacer: () => { DE.guardarMemoria(antes).catch(fallo); return antes; } };
    pintar(nuevo, "[data-roe-h=deshacer]");
    render();
  };
  h.el.onsubmit = e => {
    e.preventDefault();
    const f = h.el.querySelector(".roe-mem-form"), err = h.el.querySelector("[data-roe-mem-error]");
    const t = E.texto(f.elements.texto.value, 120);
    const antes = lista;
    const mal = !t ? "Escribe algo de ti." : E.recuerda(antes, t) ? "Eso ya lo recuerda." : "";
    if (mal) { err.textContent = mal; err.hidden = false; f.elements.texto.focus(); return; }
    const ahora = Date.now();
    const r = E.recordar(antes, [t], ahora, i => `m${ahora.toString(36)}${i}`);
    DE.guardarMemoria(r.lista).catch(fallo);
    hecho = { texto: `Listo: recuerda «${r.nuevos[0].texto}».`, deshacer: () => { DE.guardarMemoria(antes).catch(fallo); return antes; } };
    pintar(r.lista, "[name=texto]");
    render();
  };
}

// ---------- Desde Outfits: "Pídelo con tus palabras" ----------
// Sigue tu conversación de hoy (así recuerda lo que ya te armó; D-159); si no
// hay una de hoy (o está llena), empieza una nueva.
function pedir(texto) {
  const t = E.texto(texto, E.MAX_TEXTO);
  if (t && !puedoMandar()) return false;
  const deHoy = DE.lista().find(c => E.deHoy(c, D.hoy()) && !E.llena(c));
  abrirCharla(deHoy ? deHoy.id : "");
  est.error = null;
  if (pantalla() !== "ropa-estilista") location.hash = "ropa-estilista";
  if (t) enviar(t, { nueva: !deHoy }); else render();
  return true;
}

// ---------- Los toques ----------
app.addEventListener("click", e => {
  const ej = e.target.closest("[data-roe-ej]");
  if (ej) { ta.value = ej.dataset.roeEj; guardarLocal(BORRADOR, ta.value); autoalto(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); return; }
  const o = e.target.closest("[data-roe-o]");
  if (o) { accion(o.dataset.roeO, Number(o.dataset.m), Number(o.dataset.o), o.tagName === "BUTTON" ? o : app.querySelector(`[data-roe-o="ver"][data-m="${o.dataset.m}"][data-o="${o.dataset.o}"].link-btn`)); return; }
  const f = e.target.closest("[data-roe-f]");
  if (f) { aMiLista(Number(f.dataset.m), Number(f.dataset.roeF)); return; }
  const r = e.target.closest("[data-roe-r]");
  if (r) { olvidarFrase(r.dataset.roeR); return; }
  const b = e.target.closest("[data-roe]");
  if (!b) return;
  const a = b.dataset.roe;
  if (a === "charlas") verCharlas(b);
  else if (a === "memoria") verMemoria(b);
  else if (a === "nueva") nueva();
  else if (a === "reintentar") reintentar();
});
$("roe-escribir").addEventListener("submit", e => {
  e.preventDefault();
  if (!E.texto(ta.value, E.MAX_TEXTO)) { ta.focus(); return; }
  if (enviar(ta.value)) { ta.value = ""; guardarLocal(BORRADOR, ""); autoalto(); }
});
ta.addEventListener("input", () => { guardarLocal(BORRADOR, ta.value); autoalto(); });
// Enter manda (Mayúscula + Enter, otra línea).
ta.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("roe-escribir").requestSubmit(); }
});

// ---------- Cuándo se pinta ----------
// #ropa-estilista/{id} (desde "Hoy te armó…"): abre esa conversación y la dirección vuelve a ser #ropa-estilista.
function pedida() {
  const id = partes()[1] ? decodeURIComponent(partes()[1]) : "";
  if (!id || !DE.cargada()) return;
  if (DE.una(id)) { abrirCharla(id); est.error = null; }
  try { history.replaceState(null, "", "#ropa-estilista"); } catch (e) { /* sin historial */ }
}
function alEntrar() {
  if (pantalla() !== "ropa-estilista") return;
  pedida();
  if (est.id && DE.cargada() && !DE.una(est.id) && !(est.local && est.local.id === est.id)) abrirCharla("");
  if (IA() && !IA().estado()) IA().quien().then(render);
  render();
  autoalto();
}
window.addEventListener("hashchange", alEntrar);
document.addEventListener("DOMContentLoaded", alEntrar);
const siVisible = () => { if (pantalla() === "ropa-estilista") render(); };
D.al(siVisible);
DO.al(siVisible);
DI.al(siVisible);
DE.al(() => {
  if (pantalla() === "ropa-estilista") pedida();
  // La conversación abierta se borró (aquí o en otro teléfono): una nueva.
  if (est.id && !DE.una(est.id) && !(est.local && est.local.id === est.id) && !est.pensando) abrirCharla("");
  siVisible();
});
if (DD()) DD().al(siVisible);
if (IA()) IA().alCambiar(siVisible);
window.addEventListener("online", siVisible);
window.addEventListener("offline", siVisible);
window.RopaEstilista = { render, pedir, memoria: verMemoria, charlas: verCharlas, disponible: () => !porQueNo() };
})();
