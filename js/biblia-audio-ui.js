// ---------- Biblia en audio (pantalla) ----------
// En el lector, el botón de audífonos lee el capítulo en voz alta con las
// voces del teléfono (sin internet). Barra abajo: ▶/⏸, versículo anterior y
// siguiente, velocidad, voz y opciones, y ✕. Resalta el versículo que suena
// y lo mantiene a la vista; al terminar sigue con el siguiente capítulo y,
// si lo oíste completo, lo marca como leído hoy (con "Deshacer"). Desde la
// barra de versículos elegidos: "Escuchar" desde ese versículo.
// Si sales de la app o se bloquea la pantalla, se pausa (el iPhone no deja
// seguir hablando); mientras suena, la pantalla queda encendida.
// Preferencias solo en este teléfono (las voces cambian de un aparato a
// otro): localStorage "manolo-biblia-audio". Lógica en js/biblia-audio.js;
// ver docs/LECTURA_NIVEL2.md (D-123).
(function () {
const A = window.BibliaAudio, L = window.BibliaLector, B = window.BibliaMotor, T = window.BibliaTexto;
if (!A || !L || !B || !T || !window.Lectura || typeof ICONS === "undefined") return;
const { esc, hoyLocal } = window.Lectura;
const lector = L.el;
const scroll = lector.querySelector("#bbl-scroll");
const synth = () => window.speechSynthesis || null;   // se lee al usarla
const CLAVE = "manolo-biblia-audio";
const MUESTRA = "En el principio creó Dios los cielos y la tierra.";

ICONS.auriculares = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 15.5V12a8 8 0 0 1 16 0v3.5"/><rect x="3" y="14" width="4.6" height="6.6" rx="1.7"/><rect x="16.4" y="14" width="4.6" height="6.6" rx="1.7"/></svg>`;
ICONS.play = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8.5 5.3v13.4a1 1 0 0 0 1.53.85l10.6-6.7a1 1 0 0 0 0-1.7L10.03 4.45A1 1 0 0 0 8.5 5.3Z"/></svg>`;
ICONS.pausa = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6.2" y="5" width="4.2" height="14" rx="1.3"/><rect x="13.6" y="5" width="4.2" height="14" rx="1.3"/></svg>`;
ICONS.atras = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M6 5.5v13"/><path d="M18.5 6v12L9.5 12l9-6Z"/></svg>`;
ICONS.adelante = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M18 5.5v13"/><path d="M5.5 6v12l9-6-9-6Z"/></svg>`;

// ---- Preferencias (este teléfono) ----
function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; }
}
const prefs = Object.assign({ vel: A.VEL_NORMAL, voz: "", seguir: true, marcar: true }, leer());
prefs.vel = A.velNormal(prefs.vel);
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(prefs)); } catch (e) { /* sin espacio */ }
}

// ---- Estado ----
let estado = "parado";   // parado | sonando | pausado
let donde = null;        // capítulo del audio: { libro, cap }
let lista = [];          // trozos [{ v, texto }]
let i = 0;               // trozo actual
let total = 0;           // versículos del capítulo
let oidos = new Set();   // versículos que sonaron enteros
let fin = false;         // terminó el capítulo (▶ empieza otra vez)
let mensaje = "";        // aviso en la barra ("Se pausó al salir…")
let turno = 0;           // invalida los eventos de lo que se cortó
let errores = 0;         // errores seguidos de la voz
let reintento = false;   // el vigía ya repitió este trozo una vez
let esperando = null;    // capítulo que el audio pidió abrir
let actualU = null;      // lo que suena (que el navegador no lo suelte)
let tocoTexto = 0;       // el dedo movió el texto hace poco: no se mueve solo
let decirT = null, vigiaT = null, esperaT = null;

// ---- Botón de arriba ----
const btnArriba = document.createElement("button");
btnArriba.type = "button";
btnArriba.className = "bbl-icono bba-abrir";
btnArriba.dataset.bba = "abrir";
btnArriba.setAttribute("aria-label", "Escuchar este capítulo");
btnArriba.innerHTML = `<span class="icon-sm" data-icon="auriculares"></span>`;
const buscar = lector.querySelector('[data-bbl="buscar"]');
if (buscar) buscar.parentNode.insertBefore(btnArriba, buscar);
btnArriba.hidden = !synth();

// ---- Barra de abajo ----
const barra = document.createElement("div");
barra.className = "bba";
barra.hidden = true;
barra.setAttribute("role", "region");
barra.setAttribute("aria-label", "Escuchar la Biblia");
barra.innerHTML = `
  <div class="bba-prog" aria-hidden="true"><i></i></div>
  <div class="bba-info"><b class="bba-t"></b><span class="bba-v"></span></div>
  <div class="bba-botones">
    <button type="button" class="bba-vel" data-bba="vel"></button>
    <button type="button" class="bba-b" data-bba="atras" aria-label="Versículo anterior"><span class="icon-sm" data-icon="atras"></span></button>
    <button type="button" class="bba-play" data-bba="play"><span class="icon-sm"></span></button>
    <button type="button" class="bba-b" data-bba="adelante" aria-label="Versículo siguiente"><span class="icon-sm" data-icon="adelante"></span></button>
    <button type="button" class="bba-b" data-bba="ajustes" aria-label="Voz y opciones del audio"><span class="icon-sm" data-icon="gear"></span></button>
    <button type="button" class="bba-b" data-bba="cerrar" aria-label="Dejar de escuchar"><span class="icon-sm" data-icon="close"></span></button>
  </div>`;
lector.appendChild(barra);

// Aviso con "Deshacer" (capítulo marcado como leído). Se crea al usarlo,
// como los demás avisos de la app.
let toast = null, toastT = null, deshacerFn = null;
function aviso(texto, deshacer) {
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "undo-toast bba-toast";
    toast.hidden = true;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `<span class="undo-toast-msg"></span><button type="button" class="undo-toast-btn">Deshacer</button><span class="undo-toast-bar"></span>`;
    toast.querySelector("button").addEventListener("click", () => { const f = deshacerFn; ocultarAviso(); if (f) f(); });
    lector.appendChild(toast);
  }
  deshacerFn = deshacer || null;
  toast.querySelector(".undo-toast-msg").textContent = texto;
  toast.querySelector("button").hidden = !deshacer;
  toast.hidden = false;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(ocultarAviso, deshacer ? 5000 : 2600);
}
function ocultarAviso() {
  clearTimeout(toastT);
  deshacerFn = null;
  if (!toast) return;
  toast.classList.remove("show");
  toast.hidden = true;
}

if (typeof renderIcons === "function") { renderIcons(btnArriba); renderIcons(barra); }

function pintar() {
  const suena = estado === "sonando";
  btnArriba.classList.toggle("is-activo", suena);
  btnArriba.setAttribute("aria-label", suena ? "Pausar el audio" : "Escuchar este capítulo");
  if (barra.hidden || !donde) return;
  const seg = lista[i];
  const v = seg ? seg.v : 0;
  barra.querySelector(".bba-t").textContent = `${B.libro(donde.libro).nombre} ${donde.cap}`;
  barra.querySelector(".bba-v").textContent = mensaje
    || (esperando ? `Abriendo ${B.libro(esperando.libro).nombre} ${esperando.cap}…`
      : fin ? "Terminó el capítulo"
      : v ? `Versículo ${v} de ${total}`
      : suena ? "Empezando…" : `${total} versículos`);
  barra.querySelector(".bba-v").classList.toggle("is-aviso", !!mensaje);
  const hecho = fin ? total : Math.max(0, v - 1);
  barra.querySelector(".bba-prog i").style.width = `${total ? Math.round((hecho / total) * 100) : 0}%`;
  const play = barra.querySelector(".bba-play");
  play.setAttribute("aria-label", suena ? "Pausar" : fin ? "Escuchar otra vez" : "Escuchar");
  play.querySelector(".icon-sm").innerHTML = ICONS[suena ? "pausa" : "play"];
  const vel = barra.querySelector(".bba-vel");
  vel.textContent = A.etiquetaVel(prefs.vel);
  vel.setAttribute("aria-label", `Velocidad ${A.etiquetaVel(prefs.vel)}; tocar para cambiar`);
}

// ---- Versículo que suena ----
function quitarResaltado() {
  lector.querySelectorAll(".bbl-v.is-sonando").forEach(x => { x.classList.remove("is-sonando"); x.removeAttribute("aria-current"); });
}
function resaltar(mover) {
  quitarResaltado();
  const seg = lista[i];
  if (barra.hidden || fin || !seg || !seg.v) return;
  const span = lector.querySelector(`#bbl-v${seg.v}`);
  if (!span) return;
  span.classList.add("is-sonando");
  span.setAttribute("aria-current", "true");
  if (mover && Date.now() - tocoTexto > 5000) llevarA(span);
}
// Lo trae a la vista solo si quedó fuera (arriba o detrás de la barra).
function llevarA(span) {
  const r = span.getBoundingClientRect(), s = scroll.getBoundingClientRect();
  // La barra puede estar escondida (eligiendo versículos): entonces no tapa.
  const abajo = barra.offsetHeight ? Math.min(s.bottom, barra.getBoundingClientRect().top) : s.bottom;
  if (r.top >= s.top + 8 && r.bottom <= abajo - 8) return;
  const y = scroll.scrollTop + (r.top - s.top) - Math.min(110, (abajo - s.top) * 0.22);
  if (scroll.scrollTo) scroll.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  else scroll.scrollTop = Math.max(0, y);
}
["touchstart", "wheel"].forEach(ev => scroll.addEventListener(ev, () => { tocoTexto = Date.now(); }, { passive: true }));

// ---- Voz ----
function vozElegida() {
  const s = synth();
  return s && s.getVoices ? A.elegirVoz(s.getVoices() || [], prefs.voz) : null;
}
function utter(texto) {
  const u = new SpeechSynthesisUtterance(texto);
  const voz = vozElegida();
  if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = "es-MX";
  u.rate = prefs.vel;
  return u;
}
// Corta lo que suena; true si había algo sonando.
function cortar() {
  turno++;
  clearTimeout(decirT);
  clearInterval(vigiaT);
  const s = synth();
  if (s && (s.speaking || s.pending)) { s.cancel(); return true; }
  return false;
}
// Dice el trozo i. Después de cortar, espera un poco: el iPhone a veces se
// traga lo que se pide justo después de cancelar.
function seguir() {
  if (cortar()) decirT = setTimeout(decir, 140);
  else decir();
}
function decir() {
  clearTimeout(decirT);
  const s = synth();
  const seg = lista[i];
  if (!s || !seg || estado !== "sonando") return;
  const yo = ++turno;
  const u = utter(seg.texto);
  u.onend = () => {
    if (yo !== turno) return;
    errores = 0;
    reintento = false;
    termino(true);
  };
  u.onerror = e => {
    if (yo !== turno) return;
    const err = e && e.error;
    if (err === "interrupted" || err === "canceled") return;
    if (err === "not-allowed") { pausar("Toca ▶ para escuchar."); return; }
    if (++errores >= 3) { pausar("No se pudo leer en voz alta."); return; }
    termino(false);
  };
  actualU = u;
  resaltar(true);
  pintar();
  s.speak(u);
  vigilar(yo);
}
// Vigía: si la voz se calla sin avisar (pasa en algunos iPhone), repite el
// trozo una vez; si vuelve a pasar, pausa. Nunca lo cuenta como escuchado.
function vigilar(yo) {
  clearInterval(vigiaT);
  let quieto = 0;
  vigiaT = setInterval(() => {
    const s = synth();
    if (yo !== turno || estado !== "sonando" || !s) { clearInterval(vigiaT); return; }
    if (s.speaking || s.pending) { quieto = 0; return; }
    if (++quieto < 3) return;
    clearInterval(vigiaT);
    if (reintento) { pausar("La voz se detuvo. Toca ▶ para seguir."); return; }
    reintento = true;
    seguir();
  }, 1000);
}
function termino(oido) {
  clearInterval(vigiaT);
  const seg = lista[i];
  if (oido && seg && seg.v) oidos.add(seg.v);
  i++;
  if (i < lista.length) decir();
  else finCapitulo();
}

// ---- Capítulo ----
function cargar(libro, cap) {
  const d = L.datos();
  if (!d || d.libro !== libro || !d.caps[cap - 1]) return false;
  const textos = d.caps[cap - 1].map((t, k) => (t ? T.mostrar(t, { actual: true, numero: k + 1 }) : ""));
  donde = { libro, cap };
  lista = A.trozos(textos, { encabezado: A.encabezado(B.libro(libro), cap) });
  total = A.totalVersos(textos);
  i = 0;
  oidos = new Set();
  fin = false;
  return true;
}
function finCapitulo() {
  clearInterval(vigiaT);
  const k = T.claveCap(donde.libro, donde.cap);
  if (prefs.marcar && A.completo(oidos.size, total)) marcarOido(k);
  const sig = T.vecino(donde.libro, donde.cap, 1);
  if (prefs.seguir && sig) {
    esperando = sig;
    pintar();
    clearTimeout(esperaT);
    esperaT = setTimeout(() => {
      if (!esperando) return;
      const e = esperando;
      esperando = null;
      pausar(`No se pudo abrir ${B.libro(e.libro).nombre} ${e.cap}.`);
    }, 20000);
    L.abrir(sig.libro, sig.cap);
    return;
  }
  fin = true;
  estado = "pausado";
  soltar();
  quitarResaltado();
  pintar();
}
function marcarOido(k) {
  if ((L.leidos()[hoyLocal()] || []).includes(k)) return;
  L.marcar([k], true);
  const c = T.leerClave(k);
  aviso(`Escuchaste ${B.libro(c.libro).nombre} ${c.cap}: quedó como leído hoy.`, () => L.marcar([k], false));
}

// ---- Acciones ----
// Pantalla encendida mientras suena: se pide una sola vez (pedirla de nuevo
// dejaría un bloqueo viejo sin soltar).
let pantalla = false;
function pantallaEncendida() {
  if (pantalla || !window.Avisos) return;
  pantalla = true;
  Avisos.pedirPantalla();
}
function soltar() {
  if (!pantalla || !window.Avisos) return;
  pantalla = false;
  Avisos.soltarPantalla();
}
function play() {
  if (!synth() || !donde) return;
  if (fin) { i = 0; oidos = new Set(); fin = false; }
  estado = "sonando";
  mensaje = "";
  errores = 0;
  reintento = false;
  pantallaEncendida();
  seguir();
}
function pausar(msg) {
  cortar();
  // Si estaba por abrir el siguiente capítulo, cuando llegue no empieza solo.
  esperando = null;
  clearTimeout(esperaT);
  if (estado === "parado") return;
  estado = "pausado";
  mensaje = msg || "";
  soltar();
  pintar();
}
// Abre la barra y empieza (desde el versículo v, si viene).
function abrir(v) {
  const lu = L.lugar();
  if (!lu || !synth()) return;
  if (!donde || donde.libro !== lu.libro || donde.cap !== lu.cap) {
    if (!cargar(lu.libro, lu.cap)) { aviso("Espera a que se abra el capítulo."); return; }
  }
  if (v) { i = A.indiceDe(lista, v); fin = false; }
  else if (barra.hidden) { i = 0; oidos = new Set(); fin = false; }
  barra.hidden = false;
  lector.classList.add("con-audio");
  play();
}
function detener() {
  cortar();
  estado = "parado";
  esperando = null;
  clearTimeout(esperaT);
  soltar();
  quitarResaltado();
  barra.hidden = true;
  lector.classList.remove("con-audio");
  donde = null;
  lista = [];
  i = 0;
  fin = false;
  mensaje = "";
  pintar();
}
function saltar(a) {
  if (!donde) return;
  let j;
  if (a === "atras") j = fin ? A.indiceDe(lista, lista.length ? lista[lista.length - 1].v : 0) : A.anterior(lista, i);
  else {
    j = fin ? -1 : A.siguiente(lista, i);
    if (j < 0) {
      // Después del último: al capítulo siguiente (sin marcarlo como leído).
      const sig = T.vecino(donde.libro, donde.cap, 1);
      if (!sig) return;
      esperando = sig;
      estado = "sonando";
      mensaje = "";
      cortar();
      pantallaEncendida();
      pintar();
      L.abrir(sig.libro, sig.cap);
      return;
    }
  }
  i = j;
  fin = false;
  mensaje = "";
  if (estado === "sonando") seguir();
  else { resaltar(true); pintar(); }
}
function cambiarVel(v) {
  prefs.vel = A.velNormal(v);
  guardar();
  if (estado === "sonando") seguir();   // el trozo vuelve a empezar con la nueva velocidad
  pintar();
}

lector.addEventListener("click", e => {
  const b = e.target.closest("[data-bba]");
  if (!b || !lector.contains(b)) return;
  const a = b.dataset.bba;
  if (a === "abrir") {
    if (barra.hidden) abrir();
    else if (estado === "sonando") pausar();
    else play();
  } else if (a === "play") {
    if (estado === "sonando") pausar(); else play();
  } else if (a === "atras" || a === "adelante") saltar(a);
  else if (a === "vel") cambiarVel(A.siguienteVel(prefs.vel));
  else if (a === "ajustes") abrirAjustes();
  else if (a === "cerrar") detener();
});

// El lector pintó un capítulo: el mismo (se repinta: vuelve el resaltado) u
// otro (el que pidió el audio, o cambiaste de capítulo: suena ese desde el
// comienzo si estaba sonando).
window.addEventListener("biblia:pintado", e => {
  const d = e.detail || {};
  if (barra.hidden) return;
  if (donde && donde.libro === d.libro && donde.cap === d.cap) { resaltar(false); return; }
  const dd = L.datos();
  if (!dd || dd.libro !== d.libro || !dd.caps[d.cap - 1]) return;   // a medio abrir: llega otro aviso
  const porAudio = !!esperando && esperando.libro === d.libro && esperando.cap === d.cap;
  const sonaba = estado === "sonando" || porAudio;
  esperando = null;
  clearTimeout(esperaT);
  cortar();
  cargar(d.libro, d.cap);
  mensaje = "";
  if (sonaba) { estado = "sonando"; pantallaEncendida(); seguir(); }
  else { estado = "pausado"; quitarResaltado(); pintar(); }
});
window.addEventListener("biblia:lector-cerrado", () => { detener(); ocultarAviso(); hoja.cerrar(); });
// Fuera de la app o con la pantalla bloqueada el iPhone deja de hablar: pausa.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && estado === "sonando") pausar("Se pausó al salir. Toca ▶ para seguir.");
});

// ---- Hoja: voz y opciones ----
const hoja = window.Lectura.hoja("bba-hoja");
function opcionesVoz() {
  const s = synth();
  const vs = A.voces(s && s.getVoices ? s.getVoices() || [] : []);
  const elegida = A.idVoz(vozElegida());
  return vs.length
    ? `<label class="lib-campo"><span>Voz</span>
        <select class="lib-input" data-bba-op="voz">${vs.map(v => `<option value="${esc(A.idVoz(v))}"${A.idVoz(v) === elegida ? " selected" : ""}>${esc(A.etiquetaVoz(v))}</option>`).join("")}</select>
      </label>`
    : `<p class="lib-nota">No encontré voces en español en este teléfono: se usa la voz del sistema.</p>`;
}
function abrirAjustes() {
  hoja.abrir("Escuchar", `
    <div class="bba-voz">${opcionesVoz()}</div>
    <button type="button" class="lib-btn-sec bba-probar" data-bba-probar>Probar la voz</button>
    <p class="bba-sub">Velocidad</p>
    <div class="bba-vels" role="group" aria-label="Velocidad">${A.VELOCIDADES.map(v => `<button type="button" class="bba-velop${v === prefs.vel ? " is-activo" : ""}" data-bba-vel="${v}" aria-pressed="${v === prefs.vel}">${A.etiquetaVel(v)}</button>`).join("")}</div>
    <label class="bbl-aa-fila bbl-switch"><span>Seguir con el siguiente capítulo<small>Al terminar uno, empieza el que sigue.</small></span><input type="checkbox" data-bba-op="seguir"${prefs.seguir ? " checked" : ""}></label>
    <label class="bbl-aa-fila bbl-switch"><span>Marcar como leído al escucharlo<small>Si oíste el capítulo completo, cuenta como leído hoy.</small></span><input type="checkbox" data-bba-op="marcar"${prefs.marcar ? " checked" : ""}></label>
    <p class="lib-nota">Usa las voces de tu iPhone, sin internet. Para una voz más natural: Ajustes del iPhone › Accesibilidad › Contenido leído › Voces › Español, y descarga una voz «Mejorada».</p>
    <p class="lib-nota">¿No se oye? Sube el volumen y revisa que el iPhone no esté en silencio. Si sales de la app o bloqueas la pantalla, se pausa.</p>`);
}
hoja.el.addEventListener("click", e => {
  const v = e.target.closest("[data-bba-vel]");
  if (v) {
    cambiarVel(Number(v.dataset.bbaVel));
    hoja.el.querySelectorAll("[data-bba-vel]").forEach(x => {
      const si = Number(x.dataset.bbaVel) === prefs.vel;
      x.classList.toggle("is-activo", si);
      x.setAttribute("aria-pressed", String(si));
    });
    return;
  }
  if (e.target.closest("[data-bba-probar]")) {
    const s = synth();
    if (!s) return;
    let habia = estado === "sonando";
    if (habia) pausar(); else habia = cortar();
    const u = actualU = utter(MUESTRA);
    // Sin nada sonando se dice ya (el iPhone pide que sea en el mismo toque).
    if (habia) decirT = setTimeout(() => s.speak(u), 140); else s.speak(u);
  }
});
hoja.el.addEventListener("change", e => {
  const op = e.target.dataset.bbaOp;
  if (op === "voz") {
    prefs.voz = e.target.value;
    guardar();
    if (estado === "sonando") seguir();
  } else if (op === "seguir" || op === "marcar") {
    prefs[op] = e.target.checked;
    guardar();
  }
});
// La lista de voces llega tarde en algunos navegadores.
const s0 = synth();
if (s0 && s0.addEventListener) {
  s0.addEventListener("voiceschanged", () => {
    const caja = hoja.abierta() && hoja.el.querySelector(".bba-voz");
    if (caja) caja.innerHTML = opcionesVoz();
  });
}

window.BibliaAudioUI = {
  disponible: () => !!synth(),
  desde: v => abrir(v),
  detener,
  estado: () => ({ estado, libro: donde && donde.libro, cap: donde && donde.cap, v: lista[i] ? lista[i].v : 0, fin, mensaje })
};
})();
