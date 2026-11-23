// ---------- Ropa: Inspiración (#ropa-inspiracion y #ropa-pin/{id}, D-148) ----------
// Lo que te gusta: los pines de tu tablero de Pinterest (Manolo trae los
// nuevos solo), los links de pines que pegas y las imágenes que subes. Con la
// IA conectada, reconoce las prendas de cada una (una por una, sin que hagas
// nada) y "Armar este look con mi ropa" elige lo tuyo que más se parece y lo
// que te falta. Sin IA, el look sale igual con reglas (por grupo, tipo y
// color). "Mi estilo": lo que se repite en tus pines (y, con la IA, un resumen
// que puedes corregir). El tablero se conecta acá o en Ajustes de Ropa.
// Datos: js/ropa-insp-datos.js; lógica: js/ropa-insp-motor.js; la IA y
// Pinterest: js/ropa-ia.js (por el puente).
(function () {
"use strict";
const M = window.RopaMotor, I = window.RopaInspMotor, D = window.RopaDatos, DI = window.RopaInspDatos;
const IA = () => window.RopaIA, A = () => window.RopaApp;
const app = document.getElementById("rin-app"), ficha = document.getElementById("rinp-app");
if (!M || !I || !D || !DI || !app || !window.Lectura) return;
const { esc } = window.Lectura;
const pantalla = () => location.hash.replace(/^#/, "").split("/")[0];
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintarIconos = el => { if (typeof renderIcons === "function") renderIcons(el); };
const plural = (n, uno, varios) => `${n.toLocaleString("es-BO")} ${n === 1 ? uno : varios}`;
const iaLista = () => !!(IA() && IA().disponible());
const pinterestListo = () => !!(IA() && IA().pinterest());
const aviso = (t, d, v) => A().aviso(t, d, v);
const fallo = e => A().fallo(e);
// Errores que cortan una tanda (no son culpa de una imagen).
const CORTAN = ["tope", "credito", "clave", "falta-clave", "sesion", "permiso", "sin-internet", "red", "sin-puente", "kv"];

// ---------- Lo que está pasando ----------
let analizando = null;    // { total, hechas, cancelar, actual }
let trayendo = null;      // { total, hechas } (los pines del tablero)
let subiendo = null;      // { total, hechas } (las imágenes que subiste)
let mensaje = "";         // lo último que pasó (arriba de la pantalla)
let verOcultas = false;
let autoTablero = false;  // el tablero se actualiza solo una vez por vez que abres la app
let estiloPidiendo = false;
let pausaIA = 0;          // si la IA no puede (tope, sin internet…), no se insiste solo por un rato

// ---------- Fotos: la del teléfono; si no está, la de Pinterest ----------
const verFoto = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  verFoto.unobserve(e.target);
  subirFoto(e.target);
}), { rootMargin: "200px" }) : null;
function subirFoto(img) {
  const id = img.dataset.foto, remota = img.dataset.remota;
  const usarRemota = () => { if (remota && navigator.onLine !== false && img.getAttribute("src") !== remota) img.src = remota; };
  if (!id || !DI.Fotos) { usarRemota(); return; }
  DI.Fotos.url(id, img.dataset.tam === "grande" ? "" : "media").then(u => { if (u && img.dataset.foto === id) img.src = u; else if (!u) usarRemota(); });
}
function fotosGrandes(raiz) {
  if (verFoto) verFoto.disconnect();
  raiz.querySelectorAll("img[data-foto], img[data-remota]").forEach(img => { if (verFoto) verFoto.observe(img); else subirFoto(img); });
}
// alt: el texto de la imagen ("" si al lado ya está el título).
function fotoHTML(p, clase, grande, alt) {
  const f = p.fotos[0];
  const remota = p.pin && p.pin.img ? p.pin.img : "";
  if (!f && !remota) return `<span class="${clase} is-vacia" aria-hidden="true">${icono("imagen")}</span>`;
  const ancho = f && f.ancho, alto = f && f.alto;
  // La grande entra en 56% del alto de la pantalla: abajo se ve el título y lo que se ve.
  const forma = ancho > 0 && alto > 0 ? ` style="aspect-ratio:${ancho} / ${alto}${grande ? `;width:min(100%, calc(56vh * ${Math.round((ancho / alto) * 1000) / 1000}))` : ""}"` : "";
  const src = f && f.mini ? f.mini : (remota && !f ? remota : "");
  return `<span class="${clase}"${forma}><img src="${esc(src)}"${f ? ` data-foto="${esc(f.id)}"` : ""}${remota ? ` data-remota="${esc(remota)}"` : ""}${grande ? ' data-tam="grande"' : ""} alt="${esc(alt == null ? I.titulo(p) : alt)}" decoding="async"${grande ? "" : ' loading="lazy"'} referrerpolicy="no-referrer"></span>`;
}
// La imagen para la IA: la de este teléfono; si no está, la trae el puente
// (y la guarda en el teléfono para la próxima).
async function blobDe(p) {
  const f = p.fotos[0];
  const r = f && DI.Fotos ? await DI.Fotos.leer(f.id).catch(() => null) : null;
  if (r && r.blob) return r.blob;
  if (p.pin && p.pin.img && pinterestListo()) {
    const b = await IA().imagen(p.pin.img);
    DI.guardarImagen(p.id, b, f ? f.id : null).catch(() => {});
    return b;
  }
  if (f && f.mini) return fetch(f.mini).then(x => x.blob());
  return null;
}
const puntos = cs => `<span class="ro-puntos" aria-hidden="true">${cs.map(id => `<i style="background:${esc(M.COLOR[id] ? M.COLOR[id].hex : "#888")}"></i>`).join("")}</span>`;
function haceCuanto(ms) {
  if (!ms) return "";
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 2) return "recién";
  if (min < 60) return `hace ${min} minutos`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${plural(h, "hora", "horas")}`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

// ---------- La pantalla de Inspiración ----------
function tableroHTML() {
  const t = (DI.ajustes() || {}).pinterest;
  if (!pinterestListo()) {
    const ia = IA(), e = ia && ia.estado();
    const porque = !ia || !ia.puente() ? `Para traer los pines de tu tablero, Manolo usa el puente de la IA, que todavía no está conectado (<a href="#ropa-ajustes">Ajustes de Ropa</a>). Mientras, sube capturas con el <b>+</b>.`
      : !e ? `No pude hablar con el puente: revisa tu conexión. <button type="button" class="link-btn" data-rin="reintentar">Reintentar</button>`
        : !e.permitido ? "Tu tablero de Pinterest es solo para el dueño de Manolo."
          : "Falta actualizar el puente para leer Pinterest.";
    return `<section class="tmp-card rin-tablero" aria-labelledby="rin-tab-t"><h2 class="ro-sub" id="rin-tab-t">${icono("inspiracion")}${t && t.usuario ? `«${esc(t.titulo || t.tablero)}»` : "Tu tablero de Pinterest"}</h2>
      <p class="rd-nota">${porque}</p></section>`;
  }
  if (!t || !t.usuario) {
    return `<section class="tmp-card rin-tablero" aria-labelledby="rin-tab-t"><h2 class="ro-sub" id="rin-tab-t">${icono("inspiracion")}Tu tablero de Pinterest</h2>
      <p class="rd-nota">Conéctalo una vez y Manolo trae solo los pines nuevos (solo lee, nunca publica nada).</p>
      <button type="button" class="lib-btn" data-rin="conectar">Conectar tablero</button></section>`;
  }
  const estado = trayendo ? `<p class="rd-nota" role="status"><span class="rsp-rueda rin-rueda" aria-hidden="true"></span>${trayendo.total ? `Trayendo pines: ${trayendo.hechas} de ${trayendo.total}…` : "Leyendo tu tablero…"}</p>`
    : t.error ? `<p class="rin-error">No pude leerlo ${esc(haceCuanto(t.errorFecha))}: ${esc(t.error)}</p>`
      : `<p class="rd-nota">${t.leido ? `Actualizado ${esc(haceCuanto(t.leido))}.` : "Todavía no lo leí."}</p>`;
  return `<section class="tmp-card rin-tablero" aria-labelledby="rin-tab-t">
    <div class="rin-tablero-fila"><h2 class="ro-sub" id="rin-tab-t">${icono("inspiracion")}«${esc(t.titulo || t.tablero)}»</h2>
      <button type="button" class="lib-btn-sec lib-btn-chico" data-rin="actualizar"${trayendo ? " disabled" : ""}>Actualizar</button></div>
    ${estado}</section>`;
}
function tareaHTML() {
  if (subiendo) return `<div class="roa-tarea rin-tarea" role="status"><p><b>Guardando: ${subiendo.hechas} de ${subiendo.total}</b></p><div class="rp-zap-barra"><i style="width:${Math.round((subiendo.hechas / subiendo.total) * 100)}%"></i></div></div>`;
  if (!analizando) return "";
  return `<div class="roa-tarea rin-tarea" role="status"><p><b>La IA está mirando tus inspiraciones: ${analizando.hechas} de ${analizando.total}</b></p>
    <div class="rp-zap-barra"><i style="width:${Math.round((analizando.hechas / analizando.total) * 100)}%"></i></div>
    <button type="button" class="lib-btn-sec lib-btn-chico" data-rin="parar"${analizando.cancelar ? " disabled" : ""}>Parar</button></div>`;
}
// "Mi estilo": una fila en la lista (lo dicho por la IA o lo que más se repite);
// el detalle, en una hoja.
function estiloHTML(xs) {
  const e = I.estiloLocal(xs);
  const g = I.estiloGuardado((DI.ajustes() || {}).estilo);
  if (e.n < I.MIN_ESTILO && !g) {
    return iaLista() && xs.length ? `<p class="rd-nota rin-estilo-nota">${icono("sparkle")}<span>Cuando la IA haya reconocido la ropa de ${I.MIN_ESTILO} inspiraciones${e.n ? ` (van ${e.n})` : ""}, aquí aparece <b>Mi estilo</b>.</span></p>` : "";
  }
  const corto = g ? g.resumen : [e.estilos.slice(0, 2).map(x => x.nombre).join(" y "), e.colores.slice(0, 3).map(x => x.nombre.toLowerCase()).join(", ")].filter(Boolean).join(" · ");
  return `<button type="button" class="rin-estilo-fila" data-rin="estilo" aria-haspopup="dialog">
    <span class="rin-estilo-ic">${icono("sparkle")}</span>
    <span class="rin-estilo-txt"><b>Mi estilo</b><small>${esc(corto)}</small></span>
    <span class="rin-estilo-ir" data-icon="chevronRight" aria-hidden="true"></span></button>`;
}
function estiloHojaHTML() {
  const e = I.estiloLocal(DI.lista());
  const g = I.estiloGuardado((DI.ajustes() || {}).estilo);
  const ia = iaLista() && e.n >= I.MIN_ESTILO;
  const chips = items => (items.length ? `<ul class="ro-infos">${items.join("")}</ul>` : "");
  return `<div class="rin-estilo-hoja">
    ${g ? `<p class="rin-estilo-t">${esc(g.resumen)}</p>
      ${chips(g.claves.map(c => `<li class="ro-info">${esc(c)}</li>`))}
      <p class="rd-nota">${g.corregido ? "Corregido por ti" : `Lo dijo la IA, con ${plural(g.pines || e.n, "inspiración", "inspiraciones")}`}${g.fecha ? ` · ${esc(M.fechaLarga(g.fecha))}` : ""}.</p>`
    : `<p class="rd-nota">${ia ? "Pídele a la IA que te lo diga en palabras, o mira lo que más se repite." : "Lo que más se repite en lo que te gusta."}</p>`}
    ${e.n ? `<h4 class="ro-mas-t">Lo que más se repite en ${plural(e.n, "inspiración", "inspiraciones")}</h4>
      ${chips(e.estilos.map(x => `<li class="ro-info">${esc(x.nombre)}</li>`))}
      ${chips(e.colores.map(x => `<li class="ro-info"><i class="ro-muestra" style="background:${esc(x.hex)}" aria-hidden="true"></i>${esc(x.nombre)}</li>`))}
      ${chips(e.prendas.map(x => `<li class="ro-info">${esc(x.tipo)}</li>`))}` : ""}
    ${g || ia ? `<div class="rin-estilo-bot">
      ${ia ? `<button type="button" class="lib-btn" data-rin-e="ia"${estiloPidiendo ? " disabled" : ""}>${icono("sparkle")}${estiloPidiendo ? "Pensando…" : g ? (g.corregido ? "Pedírselo de nuevo a la IA" : "Actualizar con la IA") : "Que la IA me lo diga"}</button>` : ""}
      ${g ? `<button type="button" class="lib-btn-sec" data-rin-e="corregir">${icono("edit")}Corregir</button>` : ""}
    </div>` : ""}</div>`;
}
function tarjeta(p) {
  const a = p.analisis;
  const titulo = (p.pin && p.pin.titulo) || (a && a.resumen) || "";   // una imagen subida sin mirar: solo la imagen
  const estado = analizando && analizando.actual === p.id ? `<span class="rin-tag is-ia">${icono("sparkle")}Mirando…</span>`
    : !a ? (iaLista() && !(p.iaError && p.iaError.veces >= 2) ? `<span class="rin-tag">Sin mirar</span>` : "")
      : !a.esRopa || !a.prendas.length ? `<span class="rin-tag">Sin ropa</span>` : "";
  return `<li><a class="rin-card" href="#ropa-pin/${encodeURIComponent(p.id)}">
    ${fotoHTML(p, "rin-foto", false, titulo ? "" : "Imagen de inspiración")}
    ${estado}
    ${titulo ? `<span class="rin-card-t">${esc(titulo)}</span>` : ""}
    ${a && a.prendas.length ? `<span class="rin-card-m">${puntos([...new Set(a.prendas.flatMap(v => v.colores.slice(0, 1)))].slice(0, 5))}<span>${plural(a.prendas.length, "prenda", "prendas")}</span></span>` : ""}
  </a></li>`;
}
function render() {
  if (pantalla() !== "ropa-inspiracion") return;
  if (!DI.cargada()) {
    app.innerHTML = DI.error() ? `<p class="rd-nota">No pude leer tus inspiraciones. Revisa tu conexión.</p>` : `<p class="rd-nota">Cargando…</p>`;
    return;
  }
  const todas = DI.todas(), xs = DI.lista();
  const r = I.resumen(todas);
  const ocultas = todas.filter(p => p.oculta);
  if (verOcultas && !ocultas.length) verOcultas = false;   // ya no queda ninguna quitada
  const lista = verOcultas ? ocultas : xs;
  const cuerpo = lista.length ? `<ul class="rin-grilla">${lista.map(tarjeta).join("")}</ul>`
    : verOcultas ? `<p class="rd-nota">No quitaste ninguna.</p>`
      : `<div class="run-vacio rin-vacio"><span class="icon" data-icon="inspiracion"></span>
        <p><b>Guarda aquí lo que te gusta.</b></p>
        <p>Capturas de Pinterest o de donde sea, links de pines o tu tablero entero. Manolo reconoce las prendas y arma el look con tu ropa.</p>
        <div class="rin-vacio-bot"><label class="lib-btn rin-subir">${icono("imagen")}Subir imágenes<input type="file" accept="image/*" multiple class="lug-oculto" data-rin-fotos aria-label="Subir imágenes de inspiración"></label>
        <button type="button" class="lib-btn-sec" data-rin-link>${icono("enlace")}Link de Pinterest</button></div></div>`;
  app.innerHTML = `${mensaje ? `<p class="tmp-ok rin-mensaje" role="status">${esc(mensaje)}</p>` : ""}
    <p class="ro-resumen" aria-live="polite">${r.total ? `${plural(r.total, "inspiración", "inspiraciones")}${iaLista() && r.sinAnalizar ? ` · ${plural(r.sinAnalizar, "sin mirar", "sin mirar")}` : ""}` : ""}</p>
    ${tableroHTML()}
    ${tareaHTML()}
    ${verOcultas ? `<h2 class="ro-sub">Las que quitaste</h2><p class="rd-nota">Ábrela para volver a mostrarla.</p>` : estiloHTML(xs)}
    ${verOcultas ? "" : xs.length ? `<h2 class="visually-hidden">Tus inspiraciones</h2>` : ""}
    ${cuerpo}
    <div class="ro-pie">${verOcultas ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-rin="volver">Volver a Inspiración</button>`
      : ocultas.length ? `<button type="button" class="link-btn ro-fuera-btn" data-rin="ocultas">Las que quitaste (${ocultas.length})</button>` : ""}</div>`;
  pintarIconos(app);
  fotosGrandes(app);
}

// ---------- Subir imágenes ----------
async function subir(archivos) {
  if (pantalla() !== "ropa-inspiracion") location.hash = "ropa-inspiracion";
  subiendo = { total: archivos.length, hechas: 0 };
  mensaje = "";
  render();
  let bien = 0;
  for (const f of archivos) {
    try { await DI.agregarImagen(f); bien++; } catch (e) { console.warn("Ropa (inspiración):", e); }
    subiendo.hechas++;
    render();
  }
  subiendo = null;
  aviso(bien ? `Listo: ${plural(bien, "inspiración nueva", "inspiraciones nuevas")}.` : "No pude guardar esas imágenes.");
  render();
  analizarPendientes();
}

// ---------- Pegar el link de un pin ----------
function pegarLink(desde) {
  const h = A().hoja("rin-hoja-link");
  if (!pinterestListo()) {
    h.mostrar("Link de Pinterest", `<p>Para leer links de Pinterest, Manolo usa el puente de la IA, que todavía no está conectado (Ajustes de Ropa).</p>
      <p class="rd-nota">Mientras, guarda una captura del pin y súbela.</p>
      <div class="ro-form-botones"><button type="button" class="lib-btn-sec" data-cerrar-hoja>Entendido</button>
      <label class="lib-btn rin-subir">${icono("imagen")}Subir una captura<input type="file" accept="image/*" multiple class="lug-oculto" data-rin-fotos aria-label="Subir capturas de inspiración"></label></div>`);
    if (desde) h.volver = desde;
    h.el.onchange = e => { const inp = e.target.closest("[data-rin-fotos]"); if (inp && inp.files && inp.files.length) { const fs = [...inp.files].slice(0, 30); inp.value = ""; h.cerrar(); setTimeout(() => subir(fs), 230); } };
    h.el.onclick = null;
    h.el.onsubmit = null;
    pintarIconos(h.el);
    return;
  }
  const pegar = navigator.clipboard && navigator.clipboard.readText;
  h.mostrar("Link de Pinterest", `<form class="rin-form" novalidate>
    <p class="rd-nota">En Pinterest, abre el pin › Compartir › <b>Copiar link</b>, y pégalo aquí.</p>
    <label class="rd-campo">Link del pin<input class="lib-input" name="link" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://pin.it/…"></label>
    ${pegar ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-rin-pegar>Pegar lo que copiaste</button>` : ""}
    <p class="lib-error" data-rin-error role="alert" hidden></p>
    <div class="ro-form-botones"><button type="button" class="lib-btn-sec" data-cerrar-hoja>Cancelar</button><button type="submit" class="lib-btn">Guardar</button></div>
  </form>`, "[name=link]");
  if (desde) h.volver = desde;
  const form = () => h.el.querySelector(".rin-form");
  const error = t => { const el = h.el.querySelector("[data-rin-error]"); if (el) { el.textContent = t || ""; el.hidden = !t; } };
  h.el.onchange = null;
  h.el.onclick = e => {
    if (!e.target.closest("[data-rin-pegar]")) return;
    navigator.clipboard.readText().then(t => { form().elements.link.value = (t || "").trim(); error(""); }, () => error("No pude leer lo que copiaste: mantén apretado el campo y elige Pegar."));
  };
  let ocupado = false;
  h.el.onsubmit = async e => {
    e.preventDefault();
    if (ocupado) return;
    const link = form().elements.link.value.trim();
    if (!I.esLinkPinterest(link)) { error("Eso no parece un link de Pinterest."); return; }
    ocupado = true;
    const b = form().querySelector('button[type="submit"]');
    b.disabled = true; b.textContent = "Leyendo…";
    error("");
    try {
      const pin = await IA().pin(link);
      let blob = null;
      try { blob = await IA().imagen(pin.img); } catch (x) { blob = null; }
      const id = await DI.agregarPin(pin, "link", blob);
      h.cerrar();
      location.hash = `ropa-pin/${encodeURIComponent(id)}`;
      aviso("Listo: guardado en tu inspiración.");
      setTimeout(analizarPendientes, 300);
    } catch (x) {
      if (x && x.codigo === "es-tablero") error(`${x.message}`);
      else error((x && x.message) || "No pude leer ese link.");
      if (b.isConnected) { b.disabled = false; b.textContent = "Guardar"; }
    }
    ocupado = false;
  };
}

// ---------- Tu tablero de Pinterest ----------
function conectarTablero(desde) {
  if (!pinterestListo()) { aviso("Primero hay que conectar el puente de la IA (Ajustes de Ropa)."); return; }
  const h = A().hoja("rin-hoja-tablero");
  const t = (DI.ajustes() || {}).pinterest;
  h.mostrar("Tu tablero de Pinterest", `<form class="rin-form" novalidate>
    <p class="rd-nota">En Pinterest, abre tu tablero › Compartir › <b>Copiar link</b>, y pégalo aquí. Tiene que ser un tablero <b>público</b> (los secretos no se pueden leer).</p>
    <label class="rd-campo">Link del tablero<input class="lib-input" name="link" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://pin.it/…" value="${t && t.usuario ? esc(`${t.usuario}/${t.tablero}`) : ""}"></label>
    <p class="lib-error" data-rin-error role="alert" hidden></p>
    <div class="ro-form-botones"><button type="button" class="lib-btn-sec" data-cerrar-hoja>Cancelar</button><button type="submit" class="lib-btn">Conectar</button></div>
  </form>`, "[name=link]");
  if (desde) h.volver = desde;
  const error = x => { const el = h.el.querySelector("[data-rin-error]"); if (el) { el.textContent = x || ""; el.hidden = !x; } };
  h.el.onchange = null;
  h.el.onclick = null;
  let ocupado = false;
  h.el.onsubmit = async e => {
    e.preventDefault();
    if (ocupado) return;
    const f = h.el.querySelector(".rin-form");
    const link = f.elements.link.value.trim();
    const aMano = /^@?[A-Za-z0-9_.-]{2,40}\/[^/\s?#]{1,100}\/?$/.test(link);
    if (!I.esLinkPinterest(link) && !aMano) { error("Eso no parece el link de un tablero de Pinterest."); return; }
    if (trayendo) { error("Estoy trayendo tus pines: espera un momento."); return; }
    ocupado = true;
    autoTablero = true;   // recién conectado: no hace falta leerlo solo otra vez
    const b = f.querySelector('button[type="submit"]');
    b.disabled = true; b.textContent = "Leyendo…";
    error("");
    try {
      const r = await IA().tablero({ link });
      trayendo = { total: 0, hechas: 0 };
      await DI.guardarAjustes({ pinterest: { usuario: r.usuario, tablero: r.tablero, titulo: r.titulo || r.tablero, conectado: D.hoy(), leido: Date.now(), error: "" } });
      h.cerrar();
      if (pantalla() !== "ropa-inspiracion") location.hash = "ropa-inspiracion";
      aviso(`Listo: conectado «${r.titulo || r.tablero}».`);
      traerPines(r, true);
    } catch (x) {
      trayendo = null;
      error((x && x.message) || "No pude leer ese tablero.");
      if (b.isConnected) { b.disabled = false; b.textContent = "Conectar"; }
    }
    ocupado = false;
  };
}
// Los pines nuevos del tablero: la imagen la trae el puente (de a una). Una
// sola lectura a la vez (trayendo ya está puesto por quien la empezó).
async function traerPines(r, manual) {
  const t = (DI.ajustes() || {}).pinterest || {};
  const ya = new Set(DI.todas().map(p => p.id));
  const nuevos = (r.pines || []).filter(x => !ya.has(I.docDePin(x.id)));
  trayendo = { total: nuevos.length, hechas: 0 };
  render();
  let n = 0;
  for (const x of nuevos) {
    let blob = null;
    try { blob = await IA().imagen(x.img); } catch (e) { blob = null; }
    try { await DI.agregarPin(x, "tablero", blob); n++; } catch (e) { console.warn("Ropa (tablero):", e); }
    trayendo.hechas++;
    render();
  }
  const ahora = (DI.ajustes() || {}).pinterest;   // si lo desconectaste en el medio, queda desconectado
  if (ahora && ahora.usuario) await DI.guardarAjustes({ pinterest: Object.assign({}, ahora, { titulo: r.titulo || ahora.titulo || r.tablero, leido: Date.now(), error: "", errorFecha: 0 }) }).catch(() => {});
  trayendo = null;
  if (manual) aviso(n ? `Listo: ${plural(n, "pin nuevo", "pines nuevos")} de tu tablero.` : "No hay pines nuevos en tu tablero.");
  render();
  analizarPendientes();
}
async function actualizarTablero(manual) {
  const t = (DI.ajustes() || {}).pinterest;
  if (!t || !t.usuario || trayendo || !pinterestListo()) return;
  trayendo = { total: 0, hechas: 0 };
  render();
  try {
    const r = await IA().tablero({ usuario: t.usuario, tablero: t.tablero });
    await traerPines(r, manual);
  } catch (e) {
    trayendo = null;
    await DI.guardarAjustes({ pinterest: Object.assign({}, t, { error: (e && e.message) || "No respondió.", errorFecha: Date.now() }) }).catch(() => {});
    if (manual) aviso((e && e.message) || "No pude leer tu tablero.");
    render();
  }
}
// Al abrir Inspiración: si hace más de 6 horas que no se lee, se lee solo.
function tableroSolo() {
  const t = (DI.ajustes() || {}).pinterest;
  if (autoTablero || !t || !t.usuario || !pinterestListo() || !DI.cargada()) return;
  autoTablero = true;
  if (Date.now() - (t.leido || 0) > 6 * 3600e3) actualizarTablero(false);
}

// ---------- La IA mira las que faltan (de a una) ----------
// Una por una; si en el medio llegan otras (del tablero o subidas), también.
async function analizarPendientes(aMano) {
  if (analizando || !iaLista() || !DI.cargada() || (!aMano && Date.now() < pausaIA)) return;
  const intentadas = new Set();
  const pendientes = () => I.porAnalizar(DI.lista()).filter(p => !intentadas.has(p.id));
  let xs = pendientes();
  if (!xs.length) return;
  analizando = { total: xs.length, hechas: 0, cancelar: false, actual: null };
  render();
  while (xs.length && !analizando.cancelar) {
    const p = xs[0];
    intentadas.add(p.id);
    analizando.actual = p.id;
    render();
    if (pantalla() === "ropa-pin" && fichaId === p.id) renderFicha();
    try {
      const a = await IA().analizar(await blobDe(p));
      await DI.guardarAnalisis(p.id, a);
    } catch (e) {
      if (e && CORTAN.includes(e.codigo)) { mensaje = e.message; pausaIA = Date.now() + 5 * 60e3; break; }
      await DI.fallaAnalisis(p.id, (e && e.message) || "No pudo.").catch(() => {});
    }
    analizando.hechas++;
    xs = pendientes();
    analizando.total = analizando.hechas + xs.length;
  }
  analizando = null;
  render();
  if (pantalla() === "ropa-pin") renderFicha();
}

// ---------- Mi estilo (una hoja: verlo, pedírselo a la IA y corregirlo) ----------
let estiloModo = null;   // "ver" o "corregir", con la hoja abierta
const hojaEstilo = () => A().hoja("rin-hoja-estilo");
function verEstilo(desde) {
  const h = hojaEstilo();
  estiloModo = "ver";
  h.mostrar("Mi estilo", estiloHojaHTML());
  if (desde) h.volver = desde;
  h.alCerrar = () => { estiloModo = null; };
  h.el.onchange = null;
  h.el.onsubmit = null;
  h.el.onclick = e => {
    const b = e.target.closest("[data-rin-e]");
    if (!b) return;
    if (b.dataset.rinE === "ia") pedirEstilo();
    else if (b.dataset.rinE === "corregir") corregirEstilo();
    else if (b.dataset.rinE === "volver") verEstilo();
  };
}
function repintarEstilo() {
  const h = hojaEstilo();
  if (estiloModo !== "ver" || !h.abierta()) return;
  const c = h.el.querySelector(".rin-estilo-hoja");
  if (c) { c.outerHTML = estiloHojaHTML(); pintarIconos(h.el); }
}
async function pedirEstilo() {
  if (estiloPidiendo || !iaLista()) return;
  const pines = I.pinesParaEstilo(DI.lista());
  if (pines.length < I.MIN_ESTILO) return;
  estiloPidiendo = true;
  repintarEstilo();
  try {
    const e = await IA().estilo(pines);
    await DI.guardarAjustes({ estilo: Object.assign({}, e, { fecha: D.hoy(), pines: pines.length, corregido: false }) });
    aviso("Listo: tu estilo, según tus inspiraciones.");
  } catch (x) { aviso((x && x.message) || "La IA no pudo. Intenta de nuevo."); }
  estiloPidiendo = false;
  repintarEstilo();
  render();
}
function corregirEstilo() {
  const g = I.estiloGuardado((DI.ajustes() || {}).estilo);
  if (!g) return;
  const h = hojaEstilo();
  estiloModo = "corregir";
  h.mostrar("Corregir mi estilo", `<form class="rin-form" novalidate>
    <p class="rd-nota">Escríbelo como tú lo ves: Manolo lo va a usar para armar tus outfits.</p>
    <label class="rd-campo">Mi estilo<textarea class="lib-input" name="resumen" rows="5" maxlength="600">${esc(g.resumen)}</textarea></label>
    <div class="ro-form-botones"><button type="button" class="lib-btn-sec" data-rin-e="volver">Cancelar</button><button type="submit" class="lib-btn">Guardar</button></div>
  </form>`, "[name=resumen]");
  h.el.onsubmit = e => {
    e.preventDefault();
    const t = h.el.querySelector("[name=resumen]").value.replace(/\s+/g, " ").trim();
    if (!t) return;
    DI.guardarAjustes({ estilo: Object.assign({}, (DI.ajustes() || {}).estilo || {}, { resumen: t.slice(0, 600), corregido: true, fecha: D.hoy() }) })
      .then(() => { if (estiloModo === "corregir") verEstilo(); }, fallo);
    aviso("Listo: tu estilo quedó corregido.");
  };
}

app.addEventListener("click", e => {
  if (e.target.closest("[data-rin-link]")) { pegarLink(e.target.closest("[data-rin-link]")); return; }
  const b = e.target.closest("[data-rin]");
  if (!b) return;
  const a = b.dataset.rin;
  if (a === "conectar") conectarTablero(b);
  else if (a === "actualizar") actualizarTablero(true);
  else if (a === "reintentar" && IA()) IA().quien(true);
  else if (a === "parar" && analizando) { analizando.cancelar = true; b.disabled = true; }
  else if (a === "estilo") verEstilo(b);
  else if (a === "ocultas") { verOcultas = true; render(); window.scrollTo(0, 0); }
  else if (a === "volver") { verOcultas = false; render(); }
});
app.addEventListener("change", e => {
  const inp = e.target.closest("[data-rin-fotos]");
  if (!inp || !inp.files || !inp.files.length) return;
  const fs = [...inp.files].filter(f => /^image\//.test(f.type || "image/")).slice(0, 30);
  inp.value = "";
  if (fs.length) subir(fs);
});

// ---------- Un pin (#ropa-pin/{id}) ----------
const idDeHash = () => { const p = location.hash.replace(/^#/, "").split("/"); return p[0] === "ropa-pin" ? decodeURIComponent(p.slice(1).join("/")) : null; };
let fichaId = null, armando = false, mirando = false;
const ORIGEN = { tablero: "De tu tablero de Pinterest", link: "De un link de Pinterest", foto: "Una imagen que subiste" };
const PARECIDO = { igual: "Igual", parecida: "Parecida", reemplazo: "Para reemplazar" };
function vistaHTML(p) {
  const a = p.analisis;
  if (analizando && analizando.actual === p.id || mirando) return `<p class="rd-nota" role="status"><span class="rsp-rueda rin-rueda" aria-hidden="true"></span>La IA está mirando la imagen…</p>`;
  if (!a) {
    if (p.iaError && p.iaError.veces >= 2) return `<p class="rin-error">La IA no pudo mirar esta imagen${p.iaError.mensaje ? `: ${esc(p.iaError.mensaje)}` : "."}</p>${iaLista() ? `<button type="button" class="lib-btn-sec" data-rinp="mirar">${icono("sparkle")}Intentar de nuevo</button>` : ""}`;
    return iaLista() ? `<p class="rd-nota">La IA todavía no la miró.</p><button type="button" class="lib-btn-sec" data-rinp="mirar">${icono("sparkle")}Mirar con la IA</button>`
      : `<p class="rd-nota">Cuando conectes la IA, Manolo va a reconocer las prendas de cada inspiración.</p>`;
  }
  if (!a.esRopa || !a.prendas.length) return `<p class="rd-nota">La IA no ve ropa en esta imagen.</p>`;
  const datos = [...a.estilo.map(s => M.nombreDe(M.ESTILOS, s)), ...a.clima.map(c => M.nombreDe(M.CLIMAS, c)), a.formalidad ? `Formal: ${a.formalidad} de 5` : "", a.ocasion].filter(Boolean);
  return `${a.resumen ? `<p class="rin-resumen">${esc(a.resumen)}</p>` : ""}
    <ol class="rin-vistas">${a.prendas.map(v => `<li>${puntos(v.colores)}<span><b>${esc(I.nombreVista(v))}</b>${v.tela ? `<small>${esc(v.tela)}</small>` : ""}</span></li>`).join("")}</ol>
    ${datos.length ? `<ul class="ro-infos">${datos.map(d => `<li class="ro-info">${esc(d)}</li>`).join("")}</ul>` : ""}`;
}
function lookHTML(p) {
  const a = p.analisis;
  if (!a || !a.esRopa || !a.prendas.length) return "";
  const ropero = D.lista();
  const activas = ropero.filter(x => x.estado !== "fuera");
  const cab = `<h2 class="ro-sub" id="rinp-look-t">${icono("ropa")}Con tu ropa</h2>`;
  if (!D.cargada()) return `<section class="tmp-card rin-look" aria-labelledby="rinp-look-t">${cab}<p class="rd-nota">Cargando tu ropero…</p></section>`;
  if (!activas.length) return `<section class="tmp-card rin-look" aria-labelledby="rinp-look-t">${cab}<p class="rd-nota">Cuando tengas tu ropa en el ropero, aquí verás cómo armar este look con lo tuyo.</p><a class="lib-btn-sec" href="#ropa">Ir al ropero</a></section>`;
  const conIA = p.look && p.look.origen === "ia" ? I.lookVigente(p.look, ropero) : null;
  const look = conIA || I.armarLocal(a, ropero);
  const por = new Map(ropero.map(x => [x.id, x]));
  const prendas = look.prendas.filter(x => por.has(x.id));
  const ids = prendas.map(x => x.id);
  const todasHoy = ids.length && ids.every(id => D.puestaHoy(id));
  return `<section class="tmp-card rin-look" aria-labelledby="rinp-look-t">${cab}
    ${conIA ? `<p class="rd-nota">${icono("sparkle")}Lo armó la IA${look.fecha ? ` el ${esc(M.fechaLarga(look.fecha))}` : ""}.</p>` : `<p class="rd-nota">Lo más parecido de tu ropero, por tipo y color${iaLista() ? "" : " (sin IA)"}.</p>`}
    ${conIA && conIA.cambio ? `<p class="rin-error">Una prenda de este look ya no está en tu ropero: ármalo de nuevo.</p>` : ""}
    ${prendas.length ? `<ul class="ro-grilla rin-look-grilla">${prendas.map(x => {
      const pr = por.get(x.id), v = a.prendas[x.pin - 1];
      return `<li><a class="ro-card${pr.estado === "lavar" ? " is-lavar" : ""}" href="#ropa-prenda/${encodeURIComponent(pr.id)}">
        ${A().fotoHTML(pr, "ro-foto")}
        <span class="ro-card-t">${esc(M.titulo(pr))}</span>
        <span class="rin-como">${esc(PARECIDO[x.parecido] || "Parecida")}${v ? ` · en vez de: ${esc(I.nombreVista(v))}` : ""}</span>
        ${x.porque ? `<span class="rin-porque">${esc(x.porque)}</span>` : ""}
        ${pr.estado === "lavar" ? `<span class="ro-tag">${icono("lavar")}Para lavar</span>` : ""}
      </a></li>`;
    }).join("")}</ul>` : `<p class="rd-nota">No encontré nada parecido en tu ropero.</p>`}
    ${look.faltan.length ? `<h3 class="rin-sub3">Te falta</h3><ul class="rin-faltan">${look.faltan.map(f => `<li>${puntos(f.colores)}<span><b>${esc(I.nombreVista({ tipo: f.tipo, colores: f.colores, detalle: "" }))}</b>${f.porque ? `<small>${esc(f.porque)}</small>` : ""}</span>
      <a class="rin-buscar" href="${esc(I.buscarEnPinterest(f))}" target="_blank" rel="noopener">Ver ideas${icono("externo")}<span class="visually-hidden"> de ${esc(f.tipo)} en Pinterest (se abre aparte)</span></a></li>`).join("")}</ul>` : ""}
    ${look.consejo ? `<p class="rin-consejo">${icono("sparkle")}${esc(look.consejo)}</p>` : ""}
    <div class="rin-look-bot">
      ${ids.length ? `<button type="button" class="lib-btn${todasHoy ? " is-on" : ""}" data-rinp="puse"${todasHoy ? " disabled" : ""}>${icono("check")}${todasHoy ? "Te lo pusiste hoy" : "Me lo pongo hoy"}</button>` : ""}
      ${iaLista() ? `<button type="button" class="lib-btn-sec" data-rinp="armar"${armando ? " disabled" : ""}>${icono("sparkle")}${armando ? "Armando…" : conIA ? "Armar de nuevo con la IA" : "Armar este look con la IA"}</button>` : ""}
    </div></section>`;
}
function renderFicha() {
  const id = idDeHash();
  if (!id || !ficha) return;
  if (!DI.cargada()) { ficha.innerHTML = `<p class="rd-nota">Cargando…</p>`; return; }
  const p = DI.una(id);
  if (!p) { ficha.innerHTML = `<p class="rd-nota">Esta inspiración ya no está.</p><a class="lib-btn-sec" href="#ropa-inspiracion">Ir a Inspiración</a>`; fichaId = null; return; }
  const mismo = fichaId === id;
  fichaId = id;
  const fecha = p.creado ? new Date(p.creado) : null;
  const dia = fecha ? M.fechaLarga(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`) : "";
  ficha.innerHTML = `
    ${fotoHTML(p, "rin-ficha-foto", true)}
    <h1 class="page-title rin-ficha-t">${esc(I.titulo(p))}</h1>
    <p class="ro-ficha-sub">${esc(ORIGEN[p.via] || "")}${dia ? ` · ${esc(dia)}` : ""}${p.oculta ? " · <b>La quitaste</b>" : ""}</p>
    ${p.pin && p.pin.url ? `<a class="lib-btn-sec rin-ver" href="${esc(p.pin.url)}" target="_blank" rel="noopener">${icono("externo")}Ver en Pinterest<span class="visually-hidden"> (se abre aparte)</span></a>` : ""}
    <section class="tmp-card rin-vista" aria-labelledby="rinp-vista-t"><h2 class="ro-sub" id="rinp-vista-t">${icono("sparkle")}Lo que se ve</h2>${vistaHTML(p)}</section>
    ${lookHTML(p)}
    <div class="ro-acciones">
      ${p.analisis && iaLista() ? `<button type="button" class="lib-btn-sec" data-rinp="mirar">${icono("sparkle")}Mirar de nuevo con la IA</button>` : ""}
      ${p.oculta ? `<button type="button" class="lib-btn-sec" data-rinp="mostrar">Volver a mostrarla</button>`
        : p.via === "tablero" ? `<button type="button" class="lib-btn-sec" data-rinp="quitar">${icono("eyeOff")}Quitar de Manolo</button>`
          : `<button type="button" class="lib-btn-peligro" data-rinp="borrar">${icono("trash")}Borrar</button>`}
    </div>`;
  pintarIconos(ficha);
  fotosGrandes(ficha);
  if (!mismo) window.scrollTo(0, 0);
}
async function mirarUna(p) {
  if (mirando || !iaLista()) return;
  mirando = true;
  renderFicha();
  try {
    const a = await IA().analizar(await blobDe(p));
    await DI.guardarAnalisis(p.id, a);
  } catch (e) {
    if (!(e && CORTAN.includes(e.codigo))) await DI.fallaAnalisis(p.id, (e && e.message) || "No pudo.").catch(() => {});
    aviso((e && e.message) || "La IA no pudo. Intenta de nuevo.");
  }
  mirando = false;
  renderFicha();
}
async function armarConIA(p) {
  if (armando || !iaLista() || !p.analisis) return;
  armando = true;
  renderFicha();
  try {
    const look = await IA().look(I.pinParaIA(p.analisis), I.roperoParaIA(D.lista()));
    await DI.guardarLook(p.id, Object.assign({ origen: "ia" }, look));
  } catch (e) { aviso((e && e.message) || "La IA no pudo armarlo. Abajo tienes lo más parecido."); }
  armando = false;
  renderFicha();
}
if (ficha) ficha.addEventListener("click", e => {
  const b = e.target.closest("[data-rinp]");
  const p = fichaId && DI.una(fichaId);
  if (!b || !p) return;
  const a = b.dataset.rinp;
  if (a === "mirar") mirarUna(p);
  else if (a === "armar") armarConIA(p);
  else if (a === "puse") {
    const ropero = D.lista();
    const look = p.look && p.look.origen === "ia" ? I.lookVigente(p.look, ropero) : I.armarLocal(p.analisis, ropero);
    const nuevas = look.prendas.map(x => x.id).filter(id => D.una(id) && !D.puestaHoy(id));
    Promise.all(nuevas.map(id => D.meLaPuse(id, D.hoy(), true))).catch(fallo);
    aviso(`Listo: ${plural(nuevas.length, "prenda anotada", "prendas anotadas")} en lo que te pusiste hoy.`, () => Promise.all(nuevas.map(id => D.meLaPuse(id, D.hoy(), false))).catch(fallo));
  } else if (a === "quitar") {
    DI.ocultar(p.id, true).catch(fallo);
    location.hash = "ropa-inspiracion";
    aviso("Quitada: no vuelve aunque siga en tu tablero.", () => DI.ocultar(p.id, false).catch(fallo));
  } else if (a === "mostrar") { DI.ocultar(p.id, false).catch(fallo); aviso("Volvió a tu inspiración."); }
  else if (a === "borrar") {
    const doc = DI.crudo(p.id);
    const fotos = p.fotos.map(f => f.id);
    DI.borrar(p.id).catch(fallo);
    location.hash = "ropa-inspiracion";
    aviso("Borraste la inspiración.", () => DI.restaurar(p.id, doc).catch(fallo),
      () => { if (DI.Fotos) fotos.forEach(fid => DI.Fotos.borrar(fid).catch(() => {})); });
  }
});

// ---------- Cuándo se pinta y qué se hace solo ----------
function alEntrar() {
  if (pantalla() === "ropa-inspiracion") { render(); tableroSolo(); analizarPendientes(); }
  else if (pantalla() === "ropa-pin") renderFicha();
  else { fichaId = null; if (pantalla() !== "ropa-inspiracion") verOcultas = false; }
}
DI.al(() => {
  repintarEstilo();
  if (pantalla() === "ropa-inspiracion") { render(); tableroSolo(); }
  else if (pantalla() === "ropa-pin") renderFicha();
  // Lo nuevo (de tu tablero, de un link o subido, aunque llegue de otro teléfono) la IA lo mira solo.
  if (/^ropa/.test(pantalla())) analizarPendientes();
});
D.al(() => { if (pantalla() === "ropa-pin") renderFicha(); });
window.addEventListener("hashchange", () => { mensaje = ""; alEntrar(); });
document.addEventListener("DOMContentLoaded", alEntrar);
// Cuando se sabe si la IA y el puente están, se muestra (y se hace) lo que corresponde.
if (IA()) IA().alCambiar(() => { alEntrar(); if (iaLista()) analizarPendientes(); });
window.RopaInsp = { subir, pegarLink, conectarTablero, actualizarTablero, analizarPendientes, render, renderFicha };
})();
