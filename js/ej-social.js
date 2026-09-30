// Ejercicio → Feed compartido (fase 2).
//
// Dónde se guarda (Firestore):
//   feed/{uid}_{idEntreno}: copia de una sesión terminada para que la vean
//     los demás usuarios: { uid, nombre, entrenoId, fecha, creado, rutina,
//     duracionMin, volumen, series, reps, ejercicios, firma, likes: [uid],
//     nComentarios }
//   feed/{id}/comentarios/{id}: { uid, nombre, texto, creado }
//   users/{uid}/meta/perfil: compartirEntrenos (true si no está) y
//     publicarDesde (desde cuándo se publican solas las sesiones nuevas).
// Tu historial privado no cambia: el Feed guarda una copia. Las reglas de
// seguridad (docs/feed-reglas.md) dejan leer el Feed a cualquier usuario con
// sesión, pero cada uno solo publica, cambia o borra lo suyo; de lo ajeno
// solo puede poner o quitar su propio like y comentar.
//
// Si las reglas todavía no están puestas en Firebase, el Feed muestra solo
// tus sesiones (como antes) y avisa.
(function () {
const V = EjVistas, ES = EjSesiones;
const FV = firebase.firestore.FieldValue;
const PASO = 20;
const $ = id => document.getElementById(id);
const esc = V.escapeHtml;

let modo = "cargando"; // "cargando" | "social" | "local"
let posts = [];
let limite = PASO;
let dejarFeed = null;
let misPosts = new Map();
let misPostsListos = false;
let perfil = { compartir: true, publicarDesde: null };
let perfilListo = false;
let sucio = true;
const enviadas = new Map(); // id → firma ya enviada (evita repetir mientras llega la respuesta)
let dejarComentarios = null;

function feedCol() { return db.collection("feed"); }
function perfilRef() { return db.collection("users").doc(currentUser.uid).collection("meta").doc("perfil"); }
function postIdDe(entrenoId) { return currentUser.uid + "_" + entrenoId; }
function firma(obj) {
  const t = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + "-" + t.length;
}
function baseLista() {
  const e = window.EjercicioDatos && EjercicioDatos.estado;
  return !!(e && e.cargado && e.cargado.base);
}

// ---- Publicar ----
function limpiarSerie(s) {
  const o = {};
  ["kg", "reps", "seg", "asistencia"].forEach(k => { const v = Number(s[k]); if (v > 0) o[k] = v; });
  if (s.calentamiento) o.calentamiento = true;
  return o;
}
function payload(w) {
  const r = ES.resumen(w, Gimnasio.volumen(w));
  return {
    uid: currentUser.uid,
    nombre: V.nombreUsuario(),
    entrenoId: w.id,
    fecha: w.date,
    creado: w.startedAt || Date.parse(w.date + "T12:00:00") || Date.now(),
    rutina: String(w.name || "Entrenamiento").slice(0, 80),
    duracionMin: r.duracionMin,
    volumen: Math.round(r.volumen * 10) / 10,
    series: r.series,
    reps: r.reps,
    ejercicios: (w.exercises || []).slice(0, 40).map(ex => {
      const o = { nombre: String(ex.name || "Ejercicio").slice(0, 80), sets: (ex.sets || []).slice(0, 30).map(limpiarSerie) };
      if (Number(ex.minutos) > 0) o.minutos = Number(ex.minutos);
      return o;
    })
  };
}
// Se guarda con "merge": nunca pisa los likes ni el contador de comentarios.
function publicar(w) {
  const id = postIdDe(w.id);
  const p = payload(w);
  const f = firma(p);
  const pub = misPosts.get(id);
  if ((pub && pub.firma === f) || enviadas.get(id) === f) return;
  enviadas.set(id, f);
  feedCol().doc(id).set(Object.assign(p, { firma: f }), { merge: true })
    .catch(err => { enviadas.delete(id); console.error("Manolo: no se pudo publicar en el Feed", err); });
}
// Publica las sesiones nuevas (desde publicarDesde) y mantiene al día las ya
// publicadas si las editas. Solo con datos confirmados por el servidor.
function sincronizar() {
  if (modo !== "social" || !perfilListo || !misPostsListos || !perfil.compartir || !baseLista()) return;
  V.historial().forEach(w => {
    const publicada = misPosts.has(postIdDe(w.id));
    const nueva = perfil.publicarDesde && (w.startedAt || 0) >= perfil.publicarDesde;
    if (publicada || nueva) publicar(w);
  });
}
function borrarPost(id) {
  const ref = feedCol().doc(id);
  // Primero sus comentarios (si los hay), después la publicación.
  return ref.collection("comentarios").get()
    .then(snap => Promise.all(snap.docs.map(d => ref.collection("comentarios").doc(d.id).delete())))
    .catch(() => null)
    .then(() => ref.delete())
    .catch(err => console.error("Manolo: no se pudo quitar del Feed", err));
}

// ---- Feed ----
function sesionDePost(p) {
  const likes = Array.isArray(p.likes) ? p.likes : [];
  const propio = p.uid === currentUser.uid;
  return {
    clave: "p:" + p.id, postId: p.id, entrenoId: propio ? p.entrenoId : null, propio,
    uid: p.uid, usuario: p.nombre || "Alguien", fecha: p.fecha, rutina: p.rutina || "Entrenamiento",
    ejercicios: ES.comoEntreno(p).exercises, r: ES.resumenPost(p),
    social: { postId: p.id, likes: likes.length, yoLike: likes.includes(currentUser.uid), comentarios: p.nComentarios || 0 }
  };
}
function renderFeed() {
  const cont = $("ejf-lista");
  if (!cont) return;
  const aviso = $("ejf-aviso");
  let html;
  if (modo === "social") {
    aviso.hidden = perfil.compartir;
    aviso.innerHTML = perfil.compartir ? "" : `No estás compartiendo tus entrenamientos: los demás no los ven. Puedes activarlo en <a href="#ej-perfil">Perfil</a>.`;
    $("ejf-vacio").hidden = posts.length > 0;
    $("ejf-vacio").textContent = "Todavía nadie publicó entrenamientos. Cuando termines uno, aparecerá aquí.";
    html = posts.map(p => V.tarjetaHTML(sesionDePost(p), { usuario: true })).join("")
      + (posts.length >= limite ? `<button type="button" class="ejp-ver-mas" data-ejf-mas>Ver más</button>` : "");
  } else {
    const lista = V.ordenadas();
    aviso.hidden = modo !== "local";
    aviso.textContent = "El Feed compartido todavía no está activado, así que ves solo tus sesiones.";
    $("ejf-vacio").hidden = lista.length > 0;
    $("ejf-vacio").textContent = "Cuando termines un entrenamiento, aparecerá aquí.";
    html = lista.slice(0, 30).map(w => V.tarjetaHTML(V.sesionDeEntreno(w), { usuario: true })).join("");
  }
  cont.innerHTML = html;
  renderIcons(cont);
  sucio = false;
}
function pedirFeed() {
  sucio = true;
  if (V.visible("panel-ej-feed")) renderFeed();
  renderCompartir();
  const abierta = V.detalleAbierto();
  if (abierta && abierta.postId) {
    const p = posts.find(x => x.id === abierta.postId);
    if (p) pintarLike(sesionDePost(p));
  }
}
function escucharFeed() {
  if (dejarFeed) dejarFeed();
  dejarFeed = feedCol().orderBy("creado", "desc").limit(limite).onSnapshot(snap => {
    modo = "social";
    posts = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    pedirFeed();
    sincronizar();
  }, err => {
    console.warn("Feed compartido no disponible:", err && err.code);
    modo = "local";
    pedirFeed();
  });
}

// ---- Likes ----
function alternarLike(postId) {
  const p = posts.find(x => x.id === postId);
  if (!p) return;
  const yo = (p.likes || []).includes(currentUser.uid);
  feedCol().doc(postId).update({ likes: yo ? FV.arrayRemove(currentUser.uid) : FV.arrayUnion(currentUser.uid) })
    .catch(err => console.error("Manolo: no se pudo dar me gusta", err));
  try { if (!yo && navigator.vibrate) navigator.vibrate(10); } catch (e) { /* sin vibración */ }
}

// ---- Comentarios (en el detalle) ----
function pintarLike(ses) {
  const b = $("ejc-like");
  if (!b || !ses.social) return;
  b.classList.toggle("is-on", ses.social.yoLike);
  b.setAttribute("aria-pressed", ses.social.yoLike);
  b.innerHTML = `<span data-icon="${ses.social.yoLike ? "likeOn" : "like"}"></span>${ses.social.likes ? `${ses.social.likes} me gusta` : "Me gusta"}`;
  renderIcons(b);
}
function horaTxt(ms) {
  const d = new Date(ms);
  const hoy = V.hoy();
  const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${ES.fechaRelativa(f, hoy)} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
V.alAbrirDetalle((ses, cont, op) => {
  if (dejarComentarios) { dejarComentarios(); dejarComentarios = null; }
  if (!ses || !ses.social || !cont) return;
  cont.innerHTML = `
    <button type="button" class="ejc-like" id="ejc-like" data-ej-like="${esc(ses.postId)}"></button>
    <h4 class="ejc-titulo">Comentarios</h4>
    <ul class="ejc-lista" id="ejc-lista"><li class="ejc-vacio">Cargando…</li></ul>
    <form class="ejc-form" id="ejc-form">
      <label class="visually-hidden" for="ejc-texto">Escribe un comentario</label>
      <input type="text" id="ejc-texto" maxlength="500" placeholder="Escribe un comentario" autocomplete="off" enterkeyhint="send">
      <button type="submit" aria-label="Enviar comentario"><span data-icon="send"></span></button>
    </form>`;
  pintarLike(ses);
  renderIcons(cont);
  const ref = feedCol().doc(ses.postId);
  dejarComentarios = ref.collection("comentarios").orderBy("creado", "asc").limit(200).onSnapshot(snap => {
    const lista = $("ejc-lista");
    if (!lista) return;
    const duenoPost = ses.uid === currentUser.uid;
    lista.innerHTML = snap.docs.length ? snap.docs.map(d => {
      const c = d.data();
      const puedeBorrar = c.uid === currentUser.uid || duenoPost;
      return `<li class="ejc-item">
        <span class="ejf-avatar ejc-avatar" aria-hidden="true">${esc((c.nombre || "?").charAt(0))}</span>
        <div class="ejc-cuerpo"><p><strong>${esc(c.nombre || "Alguien")}</strong> ${esc(c.texto)}</p><small>${esc(horaTxt(c.creado || Date.now()))}</small></div>
        ${puedeBorrar ? `<button type="button" class="ejc-borrar" data-ejc-borrar="${esc(d.id)}" aria-label="Borrar comentario"><span data-icon="trash"></span></button>` : ""}
      </li>`;
    }).join("") : `<li class="ejc-vacio">Sé el primero en comentar.</li>`;
    renderIcons(lista);
  }, () => { const l = $("ejc-lista"); if (l) l.innerHTML = `<li class="ejc-vacio">No se pudieron cargar los comentarios.</li>`; });
  $("ejc-form").addEventListener("submit", e => {
    e.preventDefault();
    const input = $("ejc-texto");
    const texto = input.value.trim().slice(0, 500);
    if (!texto) return;
    const lote = db.batch();
    lote.set(ref.collection("comentarios").doc(), { uid: currentUser.uid, nombre: V.nombreUsuario(), texto, creado: Date.now() });
    lote.update(ref, { nComentarios: FV.increment(1) });
    lote.commit().catch(err => console.error("Manolo: no se pudo comentar", err));
    input.value = "";
  });
  cont.addEventListener("click", e => {
    const b = e.target.closest("[data-ejc-borrar]");
    if (!b || !confirm("¿Borrar este comentario?")) return;
    const lote = db.batch();
    lote.delete(ref.collection("comentarios").doc(b.dataset.ejcBorrar));
    lote.update(ref, { nComentarios: FV.increment(-1) });
    lote.commit().catch(err => console.error("Manolo: no se pudo borrar el comentario", err));
  });
  if (op.comentar) setTimeout(() => { const i = $("ejc-texto"); if (i) { i.focus(); i.scrollIntoView({ block: "center" }); } }, 250);
});

// ---- Récords de un usuario ----
function fechaCorta(iso) {
  return iso ? ES.fechaRelativa(iso, V.hoy()) : "";
}
function abrirUsuario(uid, nombre) {
  const hoja = $("eju-hoja");
  $("eju-titulo").textContent = nombre || "Usuario";
  const cuerpo = $("eju-cuerpo");
  cuerpo.innerHTML = `<p class="ejc-vacio">Cargando récords…</p>`;
  hoja.hidden = false;
  hoja.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  $("eju-cerrar").focus();
  if (modo !== "social") {
    cuerpo.innerHTML = `<p class="ejc-vacio">Los récords de los demás se ven cuando el Feed compartido esté activado.</p>`;
    return;
  }
  feedCol().where("uid", "==", uid).limit(500).get().then(snap => {
    const rec = ES.records(snap.docs.map(d => d.data()));
    const tile = (t, x, fmt) => `<div class="eju-tile"><span>${t}</span><strong>${x ? fmt(x.valor) : "—"}</strong><small>${x ? `${esc(x.rutina || "")} · ${esc(fechaCorta(x.fecha))}` : ""}</small></div>`;
    cuerpo.innerHTML = `
      <div class="eju-cabeza">
        <span class="ejf-avatar eju-avatar" aria-hidden="true">${esc((nombre || "?").charAt(0))}</span>
        <p>${rec.sesiones} ${rec.sesiones === 1 ? "sesión compartida" : "sesiones compartidas"} · ${V.volTxt(rec.volumenTotal)} en total</p>
      </div>
      <div class="eju-tiles">
        ${tile("Mayor volumen", rec.mayorVolumen, v => V.volTxt(v))}
        ${tile("Más reps", rec.masReps, v => V.numero(v, 0))}
        ${tile("Sesión más larga", rec.masLarga, v => V.duracionTxt(v))}
      </div>
      <h4 class="ejc-titulo">Mejor peso por ejercicio</h4>
      ${rec.ejercicios.length ? `<ol class="eju-lista">${rec.ejercicios.map(x => `
        <li><span class="eju-ej">${esc(x.nombre)}<small>${x.veces} ${x.veces === 1 ? "vez" : "veces"} · ${esc(fechaCorta(x.fecha))}</small></span>
        <strong>${x.kg > 0 ? `${V.numero(x.kg)} kg × ${x.reps}` : `${x.reps} reps`}</strong></li>`).join("")}</ol>` : `<p class="ejc-vacio">Todavía no hay series registradas.</p>`}`;
  }).catch(() => { cuerpo.innerHTML = `<p class="ejc-vacio">No se pudieron cargar los récords. Revisa tu conexión.</p>`; });
}
function cerrarUsuario() {
  const hoja = $("eju-hoja");
  if (hoja.hidden) return;
  hoja.classList.add("is-closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
}
$("eju-cerrar").addEventListener("click", cerrarUsuario);
$("eju-hoja").querySelector(".budget-sheet-overlay").addEventListener("click", cerrarUsuario);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("eju-hoja").hidden) cerrarUsuario(); });

// ---- Perfil: compartir ----
function pendientesDePublicar() {
  return V.historial().filter(w => !misPosts.has(postIdDe(w.id)));
}
function renderCompartir() {
  const el = $("ejp-compartir");
  if (!el) return;
  if (modo === "local") {
    el.innerHTML = `<h2 class="ejp-hist-t">Feed</h2><p class="ejp-compartir-txt">El Feed compartido todavía no está activado en Firebase. Cuando lo esté, tus sesiones nuevas se compartirán solas y podrás apagarlo aquí.</p>`;
    return;
  }
  const n = pendientesDePublicar().length;
  el.innerHTML = `
    <h2 class="ejp-hist-t">Feed</h2>
    <label class="ejp-switch">
      <span><strong>Compartir mis entrenamientos</strong><small>${perfil.compartir ? "Los demás usuarios ven tus sesiones, pueden darles me gusta y comentar." : "Tus sesiones no aparecen en el Feed de los demás."}</small></span>
      <input type="checkbox" id="ejp-compartir-sw" role="switch"${perfil.compartir ? " checked" : ""}${modo !== "social" || !perfilListo ? " disabled" : ""}>
    </label>
    ${perfil.compartir && misPostsListos && n > 0 ? `<button type="button" class="ejp-ver-mas ejp-publicar" data-ejp-publicar>Publicar mis ${n} ${n === 1 ? "entrenamiento anterior" : "entrenamientos anteriores"}</button>` : ""}`;
}
document.addEventListener("change", e => {
  if (e.target.id !== "ejp-compartir-sw") return;
  const on = e.target.checked;
  if (!on) {
    const n = misPosts.size;
    if (n && !confirm(`Tus ${n} ${n === 1 ? "sesión publicada se quitará" : "sesiones publicadas se quitarán"} del Feed, con sus me gusta y comentarios. Tu historial no cambia. ¿Seguir?`)) { e.target.checked = true; return; }
    perfil.compartir = false;
    perfilRef().set({ compartirEntrenos: false }, { merge: true });
    Array.from(misPosts.keys()).forEach(borrarPost);
  } else {
    perfil.compartir = true;
    perfil.publicarDesde = Date.now();
    perfilRef().set({ compartirEntrenos: true, publicarDesde: perfil.publicarDesde }, { merge: true });
  }
  renderCompartir();
});
document.addEventListener("click", e => {
  const like = e.target.closest("[data-ej-like]");
  if (like) { alternarLike(like.dataset.ejLike); return; }
  const u = e.target.closest("[data-ej-usuario]");
  if (u) { abrirUsuario(u.dataset.ejUsuario, u.dataset.nombre); return; }
  if (e.target.closest("[data-ejf-mas]")) { limite += PASO; escucharFeed(); return; }
  if (e.target.closest("[data-ejp-publicar]")) {
    if (!baseLista()) { alert("Espera un momento: se están cargando tus ejercicios."); return; }
    const lista = pendientesDePublicar();
    if (!lista.length || !confirm(`Se publicarán ${lista.length} ${lista.length === 1 ? "entrenamiento anterior" : "entrenamientos anteriores"} en el Feed. ¿Seguir?`)) return;
    lista.forEach(publicar);
  }
});

// ---- Arranque ----
window.addEventListener("hashchange", () => setTimeout(() => { if (sucio && V.visible("panel-ej-feed")) renderFeed(); }, 0));
Gimnasio.alBorrar(w => { if (modo === "social") borrarPost(postIdDe(w.id)); });
V.alCambiarHistorial(() => { sucio = true; if (V.visible("panel-ej-feed")) renderFeed(); renderCompartir(); sincronizar(); });
EjercicioDatos.onCambio(() => sincronizar());

onAuthReady(() => {
  perfilRef().onSnapshot({ includeMetadataChanges: true }, doc => {
    const d = doc.exists ? doc.data() : {};
    perfil.compartir = d.compartirEntrenos !== false;
    perfil.publicarDesde = Number(d.publicarDesde) || null;
    const delServidor = !(doc.metadata && doc.metadata.fromCache);
    // La primera vez (confirmado con el servidor): desde ahora se publican solas.
    if (delServidor && !perfil.publicarDesde) {
      perfil.publicarDesde = Date.now();
      perfilRef().set({ publicarDesde: perfil.publicarDesde }, { merge: true });
    }
    if (delServidor) perfilListo = true;
    renderCompartir();
    sincronizar();
  });
  feedCol().where("uid", "==", currentUser.uid).onSnapshot({ includeMetadataChanges: true }, snap => {
    misPosts = new Map(snap.docs.map(d => [d.id, d.data()]));
    if (!(snap.metadata && snap.metadata.fromCache)) misPostsListos = true;
    renderCompartir();
    sincronizar();
  }, () => { modo = "local"; pedirFeed(); });
  escucharFeed();
});
})();
