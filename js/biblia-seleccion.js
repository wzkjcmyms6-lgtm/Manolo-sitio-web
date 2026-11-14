// ---------- Biblia: tocar versículos en el lector (pantalla, fase 2) ----------
// Tocar uno o varios versículos los elige y aparece una barra abajo:
// resaltar con color, ★ favorito, ✎ nota, ＋ anotar (el registro de siempre
// en users/{uid}/biblia con el texto puesto), compartir como imagen y copiar.
// También la pestaña "Marcados" de Biblia (favoritos, notas y resaltados).
// Datos en users/{uid}/biblia_marcas/{libro}; lógica en js/biblia-marcas.js
// y la imagen en js/biblia-imagen.js. Ver docs/LECTURA_NIVEL2.md (D-105).
(function () {
const B = window.BibliaMotor, T = window.BibliaTexto, BM = window.BibliaMarcas, BI = window.BibliaImagen, L = window.BibliaLector;
if (!B || !T || !BM || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const lector = L.el;

let docs = {};          // libro → { col, it } (normalizado)
let crudos = {};        // libro → tal como está en Firestore
let cargado = false;
let donde = null;       // capítulo pintado: { libro, cap }
let sel = new Set();    // versículos elegidos
let notaDe = null;      // { cap, nums } de la nota que se edita
let marcadosEn = null;  // contenedor de la pestaña "Marcados"
let filtro = "todo";

const coleccion = () => db.collection("users").doc(currentUser.uid).collection("biblia_marcas");
const BORRAR = () => firebase.firestore.FieldValue.delete();
const ordenados = () => Array.from(sel).sort((a, b) => a - b);
const actual = () => !!L.ajustes().actual;

// ---- Barra de abajo y aviso ----
const barra = document.createElement("div");
barra.className = "bbl-selbar";
barra.hidden = true;
barra.setAttribute("role", "toolbar");
barra.setAttribute("aria-label", "Versículos elegidos");
lector.appendChild(barra);
const aviso = document.createElement("div");
aviso.className = "bbl-toast";
aviso.setAttribute("role", "status");
aviso.hidden = true;
lector.appendChild(aviso);
let avisoTimer = null;
function avisar(t) {
  aviso.textContent = t;
  aviso.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { aviso.hidden = true; }, 2200);
}
const hojaNota = window.Lectura.hoja("bbl-hoja-nota");

// ---- Texto de lo elegido ----
function textos(nums, conOrtografia) {
  const d = L.datos();
  const c = d && donde && d.libro === donde.libro ? d.caps[donde.cap - 1] || [] : [];
  return nums.map(n => (conOrtografia ? T.mostrar(c[n - 1], { actual: actual(), numero: n }) : c[n - 1] || "")).filter(Boolean).join(" ");
}
const citaDe = nums => T.cita(donde.libro, donde.cap, T.spec(nums));

// ---- Pintar marcas en el capítulo ----
function decorar() {
  if (!donde) return;
  const d = BM.delCapitulo(docs[donde.libro], donde.cap);
  const favs = new Set(), notaAl = {};
  d.items.forEach(it => {
    if (it.f) it.nums.forEach(n => favs.add(n));
    if (it.n) notaAl[Math.max(...it.nums)] = it.v;
  });
  lector.querySelectorAll(".bbl-versos .bbl-v").forEach(span => {
    const v = Number(span.dataset.v);
    BM.COLORES.forEach(c => span.classList.toggle(`c-${c.id}`, d.colores[v] === c.id));
    span.classList.toggle("is-fav", favs.has(v));
    span.classList.toggle("is-sel", sel.has(v));
    const viejo = span.querySelector(".bbl-nota-ic");
    if (viejo) viejo.remove();
    if (notaAl[v] != null) span.insertAdjacentHTML("beforeend", `<button type="button" class="bbl-nota-ic" data-bbs-nota="${notaAl[v]}" aria-label="Ver la nota">✎</button>`);
  });
}

function pintarBarra() {
  if (!sel.size || !donde) {
    barra.hidden = true;
    lector.classList.remove("con-sel");
    return;
  }
  const nums = ordenados();
  const d = BM.delCapitulo(docs[donde.libro], donde.cap);
  const item = BM.itemDe(docs[donde.libro], donde.cap, nums);
  const mismoColor = nums.every(n => d.colores[n] && d.colores[n] === d.colores[nums[0]]) ? d.colores[nums[0]] : null;
  const conColor = nums.some(n => d.colores[n]);
  const fav = !!(item && item.f);
  barra.innerHTML = `
    <div class="bbl-sel-cab">
      <b>${esc(citaDe(nums))}</b>
      <button type="button" class="bbl-sel-x" data-bbs="limpiar" aria-label="Quitar la selección"><span class="icon-sm" data-icon="close"></span></button>
    </div>
    <div class="bbl-colores" role="group" aria-label="Resaltar">
      ${BM.COLORES.map(c => `<button type="button" class="bbl-color${mismoColor === c.id ? " is-activo" : ""}" data-bbs-color="${c.id}" style="--c:${c.hex}" aria-pressed="${mismoColor === c.id}" aria-label="Resaltar en ${c.nombre.toLowerCase()}"></button>`).join("")}
      ${conColor ? `<button type="button" class="bbl-color is-quitar" data-bbs-color="" aria-label="Quitar el resaltado">⊘</button>` : ""}
    </div>
    <div class="bbl-sel-acciones">
      <button type="button" data-bbs="fav" aria-pressed="${fav}"${fav ? ' class="is-activo"' : ""}><span class="icon-sm" data-icon="star"></span><small>Favorito</small></button>
      <button type="button" data-bbs="nota"${item && item.n ? ' class="is-activo"' : ""}><span class="icon-sm" data-icon="edit"></span><small>Nota</small></button>
      <button type="button" data-bbs="anotar"><span class="icon-sm" data-icon="plus"></span><small>Anotar</small></button>
      <button type="button" data-bbs="compartir"><span class="icon-sm" data-icon="send"></span><small>Compartir</small></button>
      <button type="button" data-bbs="copiar"><span class="icon-sm" data-icon="copy"></span><small>Copiar</small></button>
    </div>`;
  if (typeof renderIcons === "function") renderIcons(barra);
  barra.hidden = false;
  lector.classList.add("con-sel");
}

function limpiar() {
  sel = new Set();
  decorar();
  pintarBarra();
}

// ---- Guardar ----
function guardar(libro, parche) {
  if (!parche) return Promise.resolve();
  return coleccion().doc(libro).set(Object.assign({ v: 1, actualizado: Date.now() }, parche), { merge: true })
    .catch(err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`));
}
// Al instante en pantalla (Firestore confirma después con onSnapshot).
function aplicarLocal(libro, parche) {
  const crudo = JSON.parse(JSON.stringify(crudos[libro] || {}));
  const mezclar = (a, b) => Object.keys(b).forEach(k => {
    const v = b[k];
    if (v && v.__borrarLocal) delete a[k];
    else if (v && typeof v === "object" && !Array.isArray(v)) { if (!a[k] || typeof a[k] !== "object") a[k] = {}; mezclar(a[k], v); }
    else a[k] = v;
  });
  mezclar(crudo, parche);
  crudos[libro] = crudo;
  docs[libro] = BM.normalizarDoc(crudo);
}
// Un parche con el borrado de Firestore y otro igual para la pantalla.
function cambiar(libro, hacer) {
  const local = hacer({ __borrarLocal: true });
  if (!local) return;
  aplicarLocal(libro, local);
  guardar(libro, hacer(BORRAR()));
  decorar();
  if (marcadosEn && !marcadosEn.hidden) renderMarcados(marcadosEn);
}

function ponerColor(color) {
  const nums = ordenados(), { libro, cap } = donde;
  cambiar(libro, X => BM.parcheColor(cap, nums, color || null, X));
  avisar(color ? `Resaltado en ${BM.COLOR[color].nombre.toLowerCase()}` : "Resaltado quitado");
  limpiar();
}
function alternarFavorito() {
  const nums = ordenados(), { libro, cap } = donde;
  const item = BM.itemDe(docs[libro], cap, nums);
  const si = !(item && item.f);
  const o = { texto: textos(nums, false), fecha: hoyLocal(), ahora: Date.now(), actual: item };
  cambiar(libro, X => BM.parcheFavorito(cap, nums, si, o, X));
  avisar(si ? `★ ${citaDe(nums)} en tus favoritos` : "Quitado de favoritos");
  limpiar();
}

// ---- Nota ----
function abrirNota(nums) {
  const { libro, cap } = donde;
  const item = BM.itemDe(docs[libro], cap, nums);
  const ns = item && item.n ? (T.numeros(item.r) || nums) : nums;
  notaDe = { libro, cap, nums: ns, texto: textos(ns, false) };
  hojaNota.abrir(`Nota · ${T.cita(libro, cap, T.spec(ns))}`, `
    <form class="lib-form bbl-nota-form" novalidate>
      <p class="bbl-nota-texto">${esc(textos(ns, true))}</p>
      <label class="lib-campo"><span>Tu nota</span>
        <textarea name="nota" rows="5" class="lib-input" maxlength="${BM.NOTA_MAX}" placeholder="Lo que Dios te dice con este versículo">${esc(item && item.n ? item.n : "")}</textarea>
      </label>
      <div class="lib-acciones">
        ${item && item.n ? `<button type="button" class="lib-btn-peligro" data-bbs="borrar-nota">Borrar nota</button>` : ""}
        <button type="submit" class="lib-btn">Guardar nota</button>
      </div>
    </form>`);
  setTimeout(() => { const ta = hojaNota.el.querySelector("textarea"); if (ta) ta.focus(); }, 250);
}
function guardarNota(texto) {
  if (!notaDe) return;
  const { libro, cap, nums } = notaDe;
  const item = BM.itemDe(docs[libro], cap, nums);
  const o = { texto: notaDe.texto, fecha: hoyLocal(), ahora: Date.now(), actual: item };
  cambiar(libro, X => BM.parcheNota(cap, nums, texto, o, X));
  hojaNota.cerrar();
  notaDe = null;
  avisar(String(texto || "").trim() ? "Nota guardada" : "Nota borrada");
  limpiar();
}
hojaNota.el.addEventListener("submit", e => {
  e.preventDefault();
  guardarNota(e.target.elements.nota.value);
});
hojaNota.el.addEventListener("click", e => {
  if (!e.target.closest('[data-bbs="borrar-nota"]')) return;
  if (!confirm("¿Borrar esta nota?")) return;
  guardarNota("");
});

// ---- Compartir como imagen y copiar ----
async function compartirArchivo(blob, nombre) {
  const archivo = typeof File === "function" ? new File([blob], nombre, { type: "image/png" }) : null;
  if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] }) && navigator.share) {
    try { await navigator.share({ files: [archivo] }); return "compartido"; } catch (e) { if (e && e.name === "AbortError") return "cancelado"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return "descargado";
}
const SERIF = '"Fraunces", "DM Sans", Georgia, serif';
async function imagen(nums) {
  const texto = textos(nums, true);
  const cita = citaDe(nums);
  if (document.fonts && document.fonts.load) {
    try { await Promise.all([document.fonts.load(`500 60px ${SERIF}`), document.fonts.load('700 46px "DM Sans"')]); } catch (e) { /* letra del sistema */ }
  }
  const c = document.createElement("canvas");
  c.width = BI.W;
  c.height = BI.H;
  const g = c.getContext("2d");
  const medir = (t, tam) => { g.font = `500 ${tam}px ${SERIF}`; return g.measureText(t).width; };
  BI.dibujar(g, BI.plan(texto, cita, medir));
  const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("imagen"))), "image/png"));
  const nombre = `${B.normalizar(cita).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
  return { blob, nombre };
}
async function compartir() {
  const nums = ordenados();
  try {
    const { blob, nombre } = await imagen(nums);
    const r = await compartirArchivo(blob, nombre);
    if (r === "descargado") avisar("Imagen guardada");
    if (r !== "cancelado") limpiar();
  } catch (e) { avisar("No se pudo armar la imagen"); }
}
async function copiar() {
  const nums = ordenados();
  const t = BM.paraCopiar(textos(nums, true), citaDe(nums));
  try {
    await navigator.clipboard.writeText(t);
    avisar("Copiado");
  } catch (e) {
    // Sin permiso para el portapapeles: se elige el texto para copiarlo a mano.
    prompt("Copia el versículo:", t);
  }
  limpiar();
}
function anotar() {
  const nums = ordenados();
  if (!window.BibliaAnotar) return;
  BibliaAnotar.abrir({ libro: donde.libro, capitulo: String(donde.cap), versiculo: T.spec(nums), texto: textos(nums, true), version: "RV1909" });
  limpiar();
}

// ---- Toques en el lector ----
lector.addEventListener("click", e => {
  const nb = e.target.closest("[data-bbs-nota]");
  if (nb) {
    const it = BM.delCapitulo(docs[donde.libro], donde.cap).items.find(x => x.v === Number(nb.dataset.bbsNota));
    abrirNota(it ? it.nums : [Number(nb.dataset.bbsNota)]);
    return;
  }
  const v = e.target.closest(".bbl-versos .bbl-v");
  if (v) {
    // Si estás eligiendo texto con el dedo (copiar una parte), no se toca.
    if (window.getSelection && String(window.getSelection()).trim().length > 1) return;
    const n = Number(v.dataset.v);
    if (sel.has(n)) sel.delete(n); else sel.add(n);
    decorar();
    pintarBarra();
    return;
  }
  const c = e.target.closest("[data-bbs-color]");
  if (c) { ponerColor(c.dataset.bbsColor); return; }
  const b = e.target.closest("[data-bbs]");
  if (!b || !donde) return;
  const a = b.dataset.bbs;
  if (a === "limpiar") limpiar();
  else if (a === "fav") alternarFavorito();
  else if (a === "nota") abrirNota(ordenados());
  else if (a === "anotar") anotar();
  else if (a === "compartir") compartir();
  else if (a === "copiar") copiar();
});
window.addEventListener("biblia:pintado", e => {
  const d = e.detail || {};
  // Otro capítulo, o llegaste desde una búsqueda o "Marcados": sin selección.
  if (!donde || donde.libro !== d.libro || donde.cap !== d.cap || (d.marcar && d.marcar.length)) sel = new Set();
  donde = { libro: d.libro, cap: d.cap };
  decorar();
  pintarBarra();
});
window.addEventListener("biblia:lector-cerrado", () => { sel = new Set(); pintarBarra(); hojaNota.cerrar(); });

// ---- Pestaña "Marcados" de Biblia ----
const ETIQUETA = { todo: "Todo", fav: "★ Favoritos", nota: "✎ Notas" };
function renderMarcados(caja) {
  marcadosEn = caja;
  if (!caja) return;
  if (!cargado) { caja.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const n = BM.cuenta(docs);
  if (!n.todo) {
    caja.innerHTML = `<p class="empty-state">Todavía no marcaste versículos. En «Leer la Biblia», toca un versículo para resaltarlo, guardarlo en favoritos o escribirle una nota.</p>`;
    return;
  }
  if (filtro !== "todo" && !n[filtro]) filtro = "todo";
  const chips = ["todo", "fav", "nota"].concat(BM.COLORES.map(c => c.id)).filter(k => k === "todo" || n[k]);
  const items = BM.lista(docs, filtro);
  caja.innerHTML = `
    <div class="bbl-filtros" role="group" aria-label="Mostrar">
      ${chips.map(k => `<button type="button" class="bbl-chip${k === filtro ? " is-activo" : ""}" data-bbs-filtro="${k}" aria-pressed="${k === filtro}">${BM.COLOR[k] ? `<i style="--c:${BM.COLOR[k].hex}"></i>${esc(BM.COLOR[k].nombre)}` : esc(ETIQUETA[k])} <span>${n[k]}</span></button>`).join("")}
    </div>
    <div class="bbl-marcados">${items.map(x => `
      <button type="button" class="bbl-marcado" data-bbs-ir="${esc(x.libro)}|${x.cap}|${esc(x.versiculo)}">
        <span class="bbl-marcado-cab">${x.tipo === "color" ? `<i class="bbl-punto" style="--c:${BM.COLOR[x.color].hex}" aria-label="${esc(BM.COLOR[x.color].nombre)}"></i>` : x.fav ? `<span class="bbl-estrella" aria-label="Favorito">★</span>` : `<span class="bbl-lapiz" aria-label="Nota">✎</span>`}<b>${esc(x.cita)}</b></span>
        <span class="bbl-marcado-t" data-bbs-texto="${esc(x.libro)}|${x.cap}|${esc(x.versiculo)}">${esc(x.texto ? T.mostrar(x.texto, { actual: actual(), numero: x.nums[0] }) : "")}</span>
        ${x.nota ? `<span class="bib-nota">✍️ ${esc(x.nota)}</span>` : ""}
      </button>`).join("")}
    </div>`;
  // Los resaltados no guardan el texto: se busca en el libro (si está a mano).
  caja.querySelectorAll("[data-bbs-texto]").forEach(el => {
    if (el.textContent) return;
    const [libro, cap, vers] = el.dataset.bbsTexto.split("|");
    L.cargarLibro(libro).then(d => {
      const t = T.textoCita(d, Number(cap), vers, { actual: actual() });
      if (t && el.isConnected) el.textContent = t;
    }).catch(() => { el.textContent = "Abre la Biblia con internet para ver el texto."; });
  });
}
document.addEventListener("click", e => {
  if (!marcadosEn || !marcadosEn.contains(e.target)) return;
  const f = e.target.closest("[data-bbs-filtro]");
  if (f) { filtro = f.dataset.bbsFiltro; renderMarcados(marcadosEn); return; }
  const ir = e.target.closest("[data-bbs-ir]");
  if (ir) {
    const [libro, cap, vers] = ir.dataset.bbsIr.split("|");
    L.abrir(libro, Number(cap), { marcar: T.numeros(vers) || [] });
  }
});

// ---- Datos ----
onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    crudos = {};
    docs = {};
    snap.docs.forEach(d => { crudos[d.id] = d.data(); docs[d.id] = BM.normalizarDoc(d.data()); });
    cargado = true;
    decorar();
    if (!barra.hidden) pintarBarra();
    if (marcadosEn && !marcadosEn.hidden) renderMarcados(marcadosEn);
    window.dispatchEvent(new CustomEvent("biblia:marcas", { detail: { favoritos: BM.favoritos(docs) } }));
  }, err => console.warn("Biblia marcas:", err));
});

window.BibliaSel = {
  renderMarcados, imagen,
  docs: () => docs,
  crudos: () => JSON.parse(JSON.stringify(crudos)),
  favoritos: () => BM.favoritos(docs)
};
})();
