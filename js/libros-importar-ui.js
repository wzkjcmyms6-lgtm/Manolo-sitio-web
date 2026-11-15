// ---------- Libros: importar de Goodreads, StoryGraph y Kindle (pantalla, fase 5c) ----------
// "Importar" (abajo de Libros): eliges el archivo, Manolo reconoce de qué
// app es y muestra la vista previa (qué es nuevo y qué ya tienes, con
// casillas); "Agregar" lo guarda en lotes. Nada se duplica. Lógica en
// js/libros-importar.js. D-110.
(function () {
const I = window.LibrosImportar, L = window.LibrosMotor;
if (!I || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("limp-hoja");
const D = () => window.LibrosDatos || null;
const ref = n => db.collection("users").doc(currentUser.uid).collection(n);
const NOMBRE = { goodreads: "Goodreads", storygraph: "StoryGraph", kindle: "Kindle" };
const LOTE = 400;    // escrituras por lote (Firestore admite 500)
let datos = null;    // { de, libros? (resultado de LibrosImportar.libros), kindle? (resultado de .kindle) }

function elegir(error) {
  datos = null;
  hoja.abrir("Importar libros y frases", `
    <div class="limp">
      <p>Trae tus libros y frases de otras apps. Primero ves qué se agrega; nada se duplica.</p>
      <ul class="limp-de">
        <li><b>Goodreads</b>: en la web, Mis libros › Importar y exportar › «Export Library» (un archivo .csv).</li>
        <li><b>StoryGraph</b>: Ajustes › «Manage Account» › «Export StoryGraph Library» (.csv).</li>
        <li><b>Kindle</b>: conecta el Kindle a la compu y copia «My Clippings.txt» (carpeta documents); trae tus subrayados como frases y tus notas.</li>
      </ul>
      <label class="lib-btn lib-btn-ancho limp-archivo">Elegir archivo<input type="file" accept=".csv,.txt,text/csv,text/plain" data-limp-archivo></label>
      ${error ? `<p class="lib-error" role="alert">${esc(error)}</p>` : ""}
    </div>`);
}

function leerArchivo(archivo) {
  archivo.text().then(texto => {
    const de = I.detectar(texto);
    const d = D();
    if (!de) { elegir("No reconozco este archivo. Elige el .csv de Goodreads o StoryGraph, o «My Clippings.txt» del Kindle."); return; }
    if (!d || !d.listo()) { elegir("Espera a que carguen tus libros y vuelve a intentar."); return; }
    const hoy = hoyLocal();
    datos = de === "kindle" ? { de, kindle: I.kindle(texto, { libros: d.lista(), frases: d.frases() }, hoy) } : { de, libros: I.libros(texto, d.lista(), hoy) };
    vistaPrevia();
  }).catch(() => elegir("No pude leer el archivo."));
}

// ---- Vista previa ----
const estadoTxt = id => (L.ESTADO[id] ? L.ESTADO[id].nombre : "");
function vistaPrevia() {
  const cuerpo = datos.de === "kindle" ? previaKindle() : previaLibros();
  hoja.abrir(`Importar de ${NOMBRE[datos.de]}`, `<div class="limp">${cuerpo}</div>`);
}
function previaLibros() {
  const r = datos.libros;
  if (!r.nuevos.length) return `<p>Encontré ${r.total} ${r.total === 1 ? "libro" : "libros"} y ya ${r.total === 1 ? "lo tienes" : "los tienes todos"}. No hay nada nuevo.</p>
    <button type="button" class="lib-btn-sec lib-btn-ancho" data-limp="otro">Elegir otro archivo</button>`;
  return `<div class="limp-resumen"><div><b>${r.nuevos.length}</b><span>${r.nuevos.length === 1 ? "nuevo" : "nuevos"}</span></div><div><b>${r.repetidos.length}</b><span>ya los tienes</span></div></div>
    <div class="limp-marcar"><button type="button" class="limp-link" data-limp-todos="1">Marcar todos</button><button type="button" class="limp-link" data-limp-todos="0">Ninguno</button></div>
    <ul class="limp-lista">${r.nuevos.map((x, i) => `<li><label>
      <input type="checkbox" data-limp-i="${i}" checked>
      <span><b>${esc(x.titulo)}</b><small>${esc([x.autor, estadoTxt(x.estado), x.calificacion ? L.estrellas(x.calificacion) : "", x.saga ? `${x.saga} #${String(x.sagaN || "").replace(".", ",")}` : ""].filter(Boolean).join(" · "))}</small></span>
    </label></li>`).join("")}</ul>
    <p class="lib-error" role="alert" hidden></p>
    <button type="button" class="lib-btn lib-btn-ancho" data-limp="importar">${textoBoton()}</button>`;
}
function previaKindle() {
  const r = datos.kindle;
  if (!r.nuevas && !r.notas) return `<p>No encontré frases nuevas (${r.repetidas} ya las tenías).</p>
    <button type="button" class="lib-btn-sec lib-btn-ancho" data-limp="otro">Elegir otro archivo</button>`;
  const nuevosLibros = r.libros.filter(g => !g.libro).length;
  return `<div class="limp-resumen"><div><b>${r.nuevas}</b><span>${r.nuevas === 1 ? "frase nueva" : "frases nuevas"}</span></div><div><b>${r.repetidas}</b><span>ya las tienes</span></div><div><b>${r.notas}</b><span>${r.notas === 1 ? "nota" : "notas"}</span></div></div>
    <ul class="limp-lista">${r.libros.map((g, i) => {
      const n = g.frases.filter(f => !f.ya).length;
      return `<li><label>
        <input type="checkbox" data-limp-i="${i}"${n || g.notas.length ? " checked" : " disabled"}>
        <span><b>${esc(g.titulo)}</b><small>${esc([g.autor, `${n} ${n === 1 ? "frase nueva" : "frases nuevas"}`, g.notas.length ? `${g.notas.length} ${g.notas.length === 1 ? "nota" : "notas"}` : "", g.libro ? "" : "libro nuevo"].filter(Boolean).join(" · "))}</small></span>
      </label></li>`;
    }).join("")}</ul>
    ${nuevosLibros ? `<label class="lib-campo"><span>Los libros nuevos quedan como</span>
      <select class="lib-input" data-limp-estado>${["terminado", "leyendo", "por_leer"].map(e => `<option value="${e}">${estadoTxt(e)}</option>`).join("")}</select></label>` : ""}
    <p class="lib-error" role="alert" hidden></p>
    <button type="button" class="lib-btn lib-btn-ancho" data-limp="importar">${textoBoton()}</button>`;
}
const marcados = () => Array.from(hoja.el.querySelectorAll("[data-limp-i]:checked")).map(x => Number(x.dataset.limpI));
function textoBoton() {
  if (!datos) return "";
  const sel = hoja.el.querySelector("[data-limp-i]") ? marcados() : null;
  if (datos.de === "kindle") {
    const gs = datos.kindle.libros.filter((g, i) => !sel || sel.includes(i));
    const n = gs.reduce((s, g) => s + g.frases.filter(f => !f.ya).length, 0);
    return `Agregar ${n} ${n === 1 ? "frase" : "frases"}`;
  }
  const n = sel ? sel.length : datos.libros.nuevos.length;
  return `Agregar ${n} ${n === 1 ? "libro" : "libros"}`;
}

// ---- Guardar ----
async function guardar(ops) {
  // ops: [(lote) => …]; en lotes de hasta LOTE escrituras.
  for (let i = 0; i < ops.length; i += LOTE) {
    const lote = db.batch();
    ops.slice(i, i + LOTE).forEach(op => op(lote));
    await lote.commit();
  }
}
async function importar() {
  const sel = marcados();
  if (!sel.length) return;
  const boton = hoja.el.querySelector('[data-limp="importar"]');
  boton.disabled = true;
  boton.textContent = "Agregando…";
  const ahora = Date.now(), hoy = hoyLocal();
  const ops = [];
  let resumen = "";
  if (datos.de === "kindle") {
    const estadoNuevo = (hoja.el.querySelector("[data-limp-estado]") || {}).value || "terminado";
    let nf = 0, nn = 0, nl = 0, k = 0;
    sel.map(i => datos.kindle.libros[i]).forEach(g => {
      const nuevas = g.frases.filter(f => !f.ya);
      const notas = {};
      g.notas.forEach(n => { notas[`k${(ahora + k++).toString(36)}`] = { texto: n.texto.slice(0, 3000), tipo: "nota", fecha: n.fecha, creado: ahora + k }; });
      let libroRef;
      if (g.libro) {
        libroRef = ref("libros").doc(g.libro.id);
        Object.keys(notas).forEach(id => ops.push(lote => lote.update(libroRef, { [`notas.${id}`]: notas[id] })));
      } else {
        libroRef = ref("libros").doc();
        const fechas = g.frases.map(f => f.fecha).sort();
        const fin = estadoNuevo === "terminado" ? fechas[fechas.length - 1] || hoy : null;
        const doc = { v: 1, titulo: g.titulo.slice(0, 200) || "Sin título", autor: g.autor.slice(0, 150), paginas: null, estado: estadoNuevo, calificacion: null, opinion: "",
          fechaRegistro: fechas[0] || hoy, fechaInicio: estadoNuevo === "por_leer" ? null : fechas[0] || hoy, fechaFin: fin,
          genero: null, anio: null, olKey: null, formato: "digital", saga: null, sagaN: null, prioridad: null, importado: { de: "kindle" }, creado: ahora + k++ };
        if (Object.keys(notas).length) doc.notas = notas;
        ops.push(lote => lote.set(libroRef, doc));
        nl++;
      }
      nn += Object.keys(notas).length;
      nuevas.forEach(f => {
        const fr = { v: 1, libroId: libroRef.id, texto: f.texto, pagina: f.pagina, fecha: f.fecha, fav: false, etiquetas: [], importado: { de: "kindle", ubicacion: f.ubicacion || null }, creado: ahora + k++ };
        ops.push(lote => lote.set(ref("libros_frases").doc(), fr));
        nf++;
      });
    });
    resumen = `Agregaste ${nf} ${nf === 1 ? "frase" : "frases"}${nn ? ` y ${nn} ${nn === 1 ? "nota" : "notas"}` : ""}${nl ? ` (y ${nl} ${nl === 1 ? "libro nuevo" : "libros nuevos"})` : ""}.`;
  } else {
    sel.map(i => datos.libros.nuevos[i]).forEach((doc, i) => ops.push(lote => lote.set(ref("libros").doc(), Object.assign({}, doc, { creado: ahora + i }))));
    resumen = `Agregaste ${sel.length} ${sel.length === 1 ? "libro" : "libros"} de ${NOMBRE[datos.de]}.`;
  }
  try {
    await guardar(ops);
    hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = `<div class="limp limp-listo"><p class="limp-listo-t">✓ Listo</p><p>${esc(resumen)}</p>
      <button type="button" class="lib-btn lib-btn-ancho" data-cerrar-hoja>Ver mis libros</button></div>`;
    datos = null;
  } catch (err) {
    const e = hoja.el.querySelector(".lib-error");
    if (e) { e.textContent = `No se pudo guardar: ${err && err.message ? err.message : err}`; e.hidden = false; }
    boton.disabled = false;
    boton.textContent = textoBoton();
  }
}

// ---- Toques ----
hoja.el.addEventListener("change", e => {
  if (e.target.matches("[data-limp-archivo]")) {
    const a = e.target.files && e.target.files[0];
    e.target.value = "";
    if (a) leerArchivo(a);
    return;
  }
  if (e.target.matches("[data-limp-i]")) { const b = hoja.el.querySelector('[data-limp="importar"]'); if (b) b.textContent = textoBoton(); }
});
hoja.el.addEventListener("click", e => {
  const t = e.target.closest("[data-limp-todos]");
  if (t) {
    hoja.el.querySelectorAll("[data-limp-i]:not(:disabled)").forEach(x => { x.checked = t.dataset.limpTodos === "1"; });
    const b = hoja.el.querySelector('[data-limp="importar"]');
    if (b) b.textContent = textoBoton();
    return;
  }
  const b = e.target.closest("[data-limp]");
  if (!b) return;
  if (b.dataset.limp === "importar") importar();
  else if (b.dataset.limp === "otro") elegir();
});
document.addEventListener("click", e => {
  if (e.target.closest('[data-limp="abrir"]') && !hoja.el.contains(e.target)) elegir();
});

window.LibrosImportarUI = { abrir: elegir };
})();
