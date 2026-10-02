// ---------- Accesos: aviso al administrador cuando alguien entra ----------
// 1. Cuando Firebase confirma usuario y contraseña (evento
//    "manolo:inicio-sesion" que lanza js/auth.js) se crea UN documento
//    accesos/{uid}_{loginMs} con la hora del servidor. Reintentos o recargas
//    escriben el mismo id y las reglas no dejan pisarlo: no hay duplicados.
// 2. Si existe admins/{tu uid} (lo crea el dueño en la consola de Firebase)
//    aparece la campana: escucha los últimos accesos en tiempo real
//    (onSnapshot, sin consultar cada X segundos) y muestra los no leídos.
// Las reglas de Firestore (firestore.rules) son la protección real: un
// usuario normal no puede leer accesos ni hacerse admin desde la app.
// La lógica sin pantalla está en js/accesos-logica.js.
(function () {
const AL = AccesosLogica;
const PASO = 50;
const $ = id => document.getElementById(id);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---- 1. Registrar el inicio de sesión ----
const CLAVE_ENVIADO = "manolo.acceso.enviado";
// Para "Estado de la cuenta": cómo salió el último registro de inicio de sesión.
const CLAVE_REGISTRO = "manolo.acceso.registro";
function guardarRegistro(estado) {
  try { localStorage.setItem(CLAVE_REGISTRO, JSON.stringify({ estado, cuando: Date.now() })); } catch (e) { /* sin almacenamiento */ }
}
function leerRegistro() {
  try { return JSON.parse(localStorage.getItem(CLAVE_REGISTRO) || "null"); } catch (e) { return null; }
}
function registrar(user) {
  const ev = AL.eventoLogin(user);
  if (!ev) return;
  try { if (localStorage.getItem(CLAVE_ENVIADO) === ev.id) return; } catch (e) { /* sin almacenamiento */ }
  const datos = Object.assign({}, ev.datos, { creado: firebase.firestore.FieldValue.serverTimestamp() });
  const marcar = () => { try { localStorage.setItem(CLAVE_ENVIADO, ev.id); } catch (e) { /* sin almacenamiento */ } };
  // Sin conexión, Firestore lo guarda en el teléfono y lo sube al volver.
  db.collection("accesos").doc(ev.id).set(datos).then(() => { marcar(); guardarRegistro("ok"); }).catch(err => {
    // "permission-denied": ya estaba registrado o faltan publicar las reglas.
    // No se reintenta en cada apertura.
    if (err && err.code === "permission-denied") marcar();
    guardarRegistro((err && err.code) || "error");
    console.warn("Manolo: no se pudo registrar el acceso", err && err.code);
  });
}
document.addEventListener("manolo:inicio-sesion", e => {
  const user = (e.detail && e.detail.user) || auth.currentUser;
  if (user) registrar(user);
});

// ---- 2. Campana y bandeja del administrador ----
let docs = [];
let limite = PASO;
let quitarEscucha = null;
let primeraCarga = true;
let errorBandeja = null;
let miUid = null;

function hoja() { return $("avisos-hoja"); }

function pintarCampana() {
  const { noLeidos } = AL.bandeja(docs, miUid);
  document.querySelectorAll("[data-avisos-n]").forEach(el => {
    el.hidden = !noLeidos;
    el.textContent = noLeidos > 99 ? "99+" : String(noLeidos);
  });
  document.querySelectorAll("[data-avisos]").forEach(b => {
    b.setAttribute("aria-label", noLeidos ? `Avisos de acceso: ${noLeidos} sin leer` : "Avisos de acceso");
  });
}

function pintarBandeja() {
  if (hoja().hidden) return;
  const { lista, noLeidos } = AL.bandeja(docs, miUid);
  $("avisos-resumen").textContent = errorBandeja ? "" : noLeidos ? `${noLeidos} sin leer` : "Todo leído";
  $("avisos-todo").hidden = !noLeidos;
  $("avisos-lista").innerHTML = lista.map(x => `
    <li>
      <button type="button" class="avisos-item${x.leido ? "" : " is-nuevo"}" data-aviso="${escapeHtml(x.id)}" aria-label="${escapeHtml(x.usuario)} ingresó a Manolo, ${escapeHtml(AL.fechaHora(x.ms))}${x.leido ? "" : ", sin leer"}">
        <span class="avisos-punto" aria-hidden="true"></span>
        <span class="avisos-txt">
          <strong>Nuevo inicio de sesión</strong>
          <span>${escapeHtml(x.usuario)} ingresó a Manolo.</span>
          <small>${escapeHtml(AL.fechaHora(x.ms))}</small>
        </span>
      </button>
    </li>`).join("");
  const vacio = $("avisos-vacio");
  vacio.hidden = !!lista.length && !errorBandeja;
  vacio.textContent = errorBandeja || "Todavía no hay accesos de otros usuarios.";
  $("avisos-mas").hidden = !!errorBandeja || docs.length < limite;
}

function avisoFlotante(x) {
  const t = $("avisos-toast");
  t.textContent = `${x.usuario} ingresó a Manolo · ${AL.fechaHora(x.ms).split(" · ")[1]}`;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 6000);
}

function escuchar() {
  if (quitarEscucha) quitarEscucha();
  primeraCarga = true;
  quitarEscucha = db.collection("accesos").orderBy("creado", "desc").limit(limite).onSnapshot(snap => {
    errorBandeja = null;
    docs = snap.docs.map(d => Object.assign({ id: d.id }, d.data({ serverTimestamps: "estimate" })));
    // Aviso flotante solo para accesos que llegan con la app abierta.
    if (!primeraCarga && !snap.metadata.fromCache) {
      snap.docChanges().forEach(c => {
        if (c.type !== "added") return;
        const d = Object.assign({ id: c.doc.id }, c.doc.data({ serverTimestamps: "estimate" }));
        if (d.uid !== miUid && !d.leido) avisoFlotante(AL.bandeja([d], miUid).lista[0]);
      });
    }
    if (!snap.metadata.fromCache) primeraCarga = false;
    pintarCampana();
    pintarBandeja();
  }, err => {
    console.warn("Manolo: bandeja de accesos", err && err.code);
    errorBandeja = err && err.code === "permission-denied"
      ? "Sin permiso para ver los accesos. Revisa que las reglas de Firestore estén publicadas (docs/ADMIN.md)."
      : "No se pudieron cargar los accesos. Inténtalo de nuevo con conexión.";
    pintarBandeja();
  });
}

function activarAdmin(esAdmin) {
  document.querySelectorAll("[data-avisos]").forEach(b => { b.hidden = !esAdmin; });
  if (esAdmin && !quitarEscucha) escuchar();
  if (!esAdmin && quitarEscucha) { quitarEscucha(); quitarEscucha = null; docs = []; pintarCampana(); }
}

function abrir() {
  const h = hoja();
  h.hidden = false;
  h.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  if (typeof renderIcons === "function") renderIcons(h);
  pintarBandeja();
}
function cerrar() {
  const h = hoja();
  if (h.hidden) return;
  h.classList.add("is-closing");
  setTimeout(() => {
    h.hidden = true;
    h.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
}

function marcarLeidos(ids) {
  if (!ids.length) return;
  const lote = db.batch();
  ids.forEach(id => lote.update(db.collection("accesos").doc(id), { leido: true }));
  lote.commit().catch(err => console.warn("Manolo: no se pudo marcar como leído", err && err.code));
}

document.addEventListener("click", e => {
  if (e.target.closest("[data-avisos]")) { abrir(); return; }
  if (e.target.closest("#avisos-toast")) { $("avisos-toast").hidden = true; abrir(); return; }
  if (e.target.closest("[data-avisos-cerrar]")) { cerrar(); return; }
  const item = e.target.closest("[data-aviso]");
  if (item) {
    const d = docs.find(x => x.id === item.dataset.aviso);
    if (d && !d.leido) marcarLeidos([d.id]);
    return;
  }
  if (e.target.closest("#avisos-todo")) {
    marcarLeidos(AL.bandeja(docs, miUid).lista.filter(x => !x.leido).map(x => x.id));
    return;
  }
  if (e.target.closest("#avisos-mas")) { limite += PASO; escuchar(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });

// ---- 3. Estado de la cuenta (para revisar la configuración desde el teléfono) ----
let estadoAdmin = "cargando";
let estadoBandeja = null;
function estadoCuentaHTML() {
  const user = (typeof currentUser !== "undefined" && currentUser) || auth.currentUser;
  const usuario = user && user.email ? user.email.split("@")[0] : "—";
  const version = (window.ManoloOffline && window.ManoloOffline.version) || "—";
  const reg = leerRegistro();
  const linea = (ok, titulo, texto) => `<li class="cuenta-fila ${ok === true ? "is-ok" : ok === false ? "is-mal" : ""}">
    <span class="cuenta-ic" aria-hidden="true">${ok === true ? "✓" : ok === false ? "!" : "…"}</span>
    <span><strong>${titulo}</strong><small>${texto}</small></span></li>`;
  const admin = {
    cargando: [null, "Revisando…"],
    cache: [null, "Esperando conexión para confirmar con Firebase."],
    admin: [true, "Sí: existe <code>admins/" + escapeHtml(miUid) + "</code>. La campana debe verse arriba."],
    "sin-documento": [false, "Firebase no encuentra <code>admins/" + escapeHtml(miUid) + "</code>. Revisa que la colección se llame exactamente <b>admins</b> (en minúsculas) y que el <b>ID del documento</b> sea el UID de arriba, sin espacios."],
    "sin-permiso": [false, "Firebase no deja leerlo: las reglas nuevas (<code>firestore.rules</code>) todavía no están publicadas."]
  }[estadoAdmin] || [false, "Error al consultar: " + escapeHtml(estadoAdmin)];
  const bandeja = estadoAdmin !== "admin" ? null
    : estadoBandeja === "ok" ? [true, "La lista de accesos se puede leer."]
    : estadoBandeja ? [false, estadoBandeja === "permission-denied" ? "Las reglas no dejan leer <code>accesos</code>: publica <code>firestore.rules</code> completo." : "Error: " + escapeHtml(estadoBandeja)]
    : [null, "Revisando…"];
  const registro = !reg ? [null, "Se prueba la próxima vez que alguien inicie sesión con usuario y contraseña en este teléfono."]
    : reg.estado === "ok" ? [true, "Tu último inicio de sesión se registró bien."]
    : [false, reg.estado === "permission-denied" ? "Firebase no dejó registrarlo: faltan publicar las reglas (o ya estaba registrado)." : "Error: " + escapeHtml(reg.estado)];
  return `
    <ul class="cuenta-lista">
      ${linea(true, "Usuario", escapeHtml(usuario))}
      <li class="cuenta-fila"><span class="cuenta-ic" aria-hidden="true">#</span><span><strong>Tu UID</strong><small class="cuenta-uid">${escapeHtml(miUid || "—")}</small></span>
        <button type="button" class="link-btn" id="cuenta-copiar">Copiar</button></li>
      ${linea(true, "Versión de la app", escapeHtml(version))}
      ${linea(admin[0], "Administrador", admin[1])}
      ${bandeja ? linea(bandeja[0], "Lista de accesos", bandeja[1]) : ""}
      ${linea(registro[0], "Registro de inicios de sesión", registro[1])}
    </ul>`;
}
function pintarEstadoCuenta() {
  const el = $("cuenta-cuerpo");
  if (el && !$("cuenta-hoja").hidden) el.innerHTML = estadoCuentaHTML();
}
function abrirEstadoCuenta() {
  const h = $("cuenta-hoja");
  h.hidden = false;
  h.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  if (typeof renderIcons === "function") renderIcons(h);
  pintarEstadoCuenta();
  // Prueba de lectura de la bandeja (solo si eres admin).
  if (estadoAdmin === "admin") {
    db.collection("accesos").orderBy("creado", "desc").limit(1).get()
      .then(() => { estadoBandeja = "ok"; }, err => { estadoBandeja = (err && err.code) || "error"; })
      .then(pintarEstadoCuenta);
  }
}
function cerrarEstadoCuenta() {
  const h = $("cuenta-hoja");
  if (h.hidden) return;
  h.classList.add("is-closing");
  setTimeout(() => {
    h.hidden = true;
    h.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
}
document.addEventListener("click", e => {
  if (e.target.closest("#cuenta-estado-btn")) { abrirEstadoCuenta(); return; }
  if (e.target.closest("[data-cuenta-cerrar]")) { cerrarEstadoCuenta(); return; }
  if (e.target.closest("#cuenta-copiar") && miUid) {
    const b = e.target.closest("#cuenta-copiar");
    const listo = () => { b.textContent = "Copiado"; setTimeout(() => { b.textContent = "Copiar"; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(miUid).then(listo, () => { prompt("Copia tu UID:", miUid); });
    else prompt("Copia tu UID:", miUid);
  }
});

onAuthReady(user => {
  miUid = user.uid;
  // Si las reglas no están publicadas, esto falla y la campana sigue oculta.
  db.collection("admins").doc(user.uid).onSnapshot({ includeMetadataChanges: true }, doc => {
    estadoAdmin = doc.exists ? "admin" : (doc.metadata && doc.metadata.fromCache ? "cache" : "sin-documento");
    activarAdmin(doc.exists);
    pintarEstadoCuenta();
  }, err => {
    estadoAdmin = err && err.code === "permission-denied" ? "sin-permiso" : "error:" + ((err && err.code) || "desconocido");
    activarAdmin(false);
    pintarEstadoCuenta();
  });
});
})();
