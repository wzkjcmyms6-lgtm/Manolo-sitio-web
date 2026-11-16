// ---------- Libros: "Completar mi biblioteca" (nivel 3, fase 5, D-133) ----------
// Arriba de tu lista, si hay libros con datos por completar: una tarjeta
// abre esta hoja. Revisa tus libros con Open Library (de a uno, con
// pausas) y, de cada uno que encuentra, te muestra lo que le sumaría
// (título en español, autor, género, temas, portada, páginas, año). Tocas "Usar" o
// "Dejar como está"; "Usar los N seguros" aplica los de confianza alta.
// Cada cambio tiene "Deshacer". Nada cambia sin tu OK y solo se suma lo que
// falta. Lo que no encontró (o no tenía nada que sumar) no vuelve a
// aparecer, salvo que cambies el título o el autor. Lógica:
// js/libros-completar.js.
(function () {
"use strict";
const C = window.LibrosCompletar, F = window.LibrosFuentes, L = window.LibrosMotor;
if (!C || !F || !L || !window.Lectura) return;
const { esc } = window.Lectura;
const hoja = window.Lectura.hoja("lib-completar-hoja");
const D = () => window.LibrosDatos;
const CLAVE = "manolo.libros.revisados";
let turno = 0;
let filas = [];      // [{ libro, estado: "buscando"|"propuesta"|"nada"|"error"|"usado"|"dejado", m: { resultado, confianza }, p: propuesta, previo }]

function revisados() { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; } }
function marcar(l) { try { const r = revisados(); r[l.id] = C.firma(l); localStorage.setItem(CLAVE, JSON.stringify(r)); } catch (e) { /* sin almacenamiento */ } refrescar(); }
// La tarjeta de la lista se pone al día al marcar (sin esperar a Firestore).
function refrescar() { const t = document.getElementById("lib-completar"); if (t) t.innerHTML = tarjeta(); }

function pendientes() { return D() ? C.pendientes(D().lista(), revisados()) : []; }
// La tarjeta de arriba de la lista (la pinta js/libros.js donde corresponde).
function tarjeta() {
  const n = pendientes().length;
  return n ? `<button type="button" class="lib-completar-tarjeta" data-lib-completar>
      <span aria-hidden="true">✨</span><span><b>Completar mi biblioteca</b><small>${n} ${n === 1 ? "libro" : "libros"} con datos por completar</small></span><span aria-hidden="true">›</span></button>` : "";
}

function pedir(url) {
  const corte = typeof AbortController === "function" ? new AbortController() : null;
  const reloj = setTimeout(() => corte && corte.abort(), 12000);
  return fetch(url, corte ? { signal: corte.signal } : {}).then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).finally(() => clearTimeout(reloj));
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
// Las páginas de las ediciones en español (como al agregar un libro, D-130).
async function paginasDe(l, x) {
  if (!C.necesitaPaginas(l) || !x.olKey) return null;
  const ediciones = [];
  let desde = 0;
  try {
    for (let i = 0; i < 3; i++) {
      const url = F.urlEdiciones(x.olKey, desde);
      if (!url) break;
      const j = await pedir(url);
      ediciones.push(...F.leerEdiciones(j));
      desde += 100;
      if (!F.pedirMas(j, desde, ediciones.filter(e => F.enEspanol(e) && e.paginas).length)) break;
    }
  } catch (e) { /* sin las páginas: lo demás igual */ }
  return C.paginasDe(l, F.recomendar(ediciones, { mediana: x.paginas }));
}

function filaHtml(x, i) {
  const l = x.libro;
  const cab = `<span class="lib-portada" aria-hidden="true">${D().tapa(l)}</span><span class="lib-cpl-t"><b>${esc(l.titulo)}</b>${l.autor ? `<small>${esc(l.autor)}</small>` : ""}</span>`;
  let cuerpo = "";
  if (x.estado === "buscando") cuerpo = `<p class="lib-ayuda">Buscando…</p>`;
  else if (x.estado === "error") cuerpo = `<p class="lib-ayuda">No pude buscarlo (¿estás sin internet?).</p>`;
  else if (x.estado === "nada") cuerpo = `<p class="lib-ayuda">No encontré este libro (o no le falta nada que pueda sumar).</p>`;
  else if (x.estado === "usado") cuerpo = `<p class="lib-cpl-ok">✓ Listo: ${esc(x.p.lista.map(c => (c.campo === "titulo" ? "título en español" : c.texto.split(":")[0].toLowerCase())).join(", "))}.</p><button type="button" class="lib-btn-sec lib-btn-chico" data-lib-cpl-deshacer="${i}">Deshacer</button>`;
  else if (x.estado === "dejado") cuerpo = `<p class="lib-ayuda">Quedó como está.</p>`;
  else if (x.estado === "propuesta") {
    const r = x.m.resultado;
    cuerpo = `<p class="lib-cpl-de">Encontré: <b>${esc(r.titulo)}</b>${r.autor ? ` · ${esc(r.autor)}` : ""}${x.m.confianza === "media" ? ` <span class="lib-cpl-duda">(revisa que sea el mismo)</span>` : ""}</p>
      <ul class="lib-cpl-lista">${x.p.lista.map(c => `<li>＋ ${esc(c.texto)}</li>`).join("")}</ul>
      <div class="lib-cpl-acciones"><button type="button" class="lib-btn-sec lib-btn-chico" data-lib-cpl-dejar="${i}">Dejar como está</button><button type="button" class="lib-btn lib-btn-chico" data-lib-cpl-usar="${i}">Usar</button></div>`;
  }
  return `<div class="lib-cpl-fila" data-lib-cpl-fila="${i}"><div class="lib-cpl-cab">${cab}</div>${cuerpo}</div>`;
}
function pintar() {
  if (!hoja.abierta()) return;
  const cuerpo = hoja.el.querySelector(".lib-hoja-cuerpo");
  const hechos = filas.filter(x => x.estado !== "buscando").length;
  const seguras = filas.filter(x => x.estado === "propuesta" && x.m.confianza === "alta").length;
  cuerpo.innerHTML = `<p class="lib-ayuda">Reviso tus libros con Open Library y te muestro lo que les falta. <b>Nada cambia sin tu OK</b> y solo se suma lo que falta.</p>
    <p class="lib-cpl-progreso" data-lib-cpl-progreso>${hechos < filas.length ? `Revisando ${hechos + 1} de ${filas.length}…` : `Revisé ${filas.length} ${filas.length === 1 ? "libro" : "libros"}.`}</p>
    ${seguras > 1 ? `<button type="button" class="lib-btn" data-lib-cpl-seguras>Usar los ${seguras} seguros</button>` : ""}
    <div class="lib-cpl-filas">${filas.map(filaHtml).join("")}</div>`;
}

async function revisar(mio) {
  for (let i = 0; i < filas.length; i++) {
    if (mio !== turno) return;
    const x = filas[i];
    try {
      const j = await pedir(F.urlBuscar(C.consulta(x.libro)));
      const m = C.emparejar(x.libro, F.leerBusqueda(j, C.consulta(x.libro), 8).libros);
      const pag = m ? await paginasDe(x.libro, m.resultado) : null;
      if (mio !== turno) return;
      const p = m ? C.propuesta(x.libro, m.resultado, pag) : null;
      if (m && p.lista.length) Object.assign(x, { estado: "propuesta", m, p });
      else { x.estado = "nada"; marcar(x.libro); }   // no vuelve (salvo que lo cambies)
    } catch (e) { x.estado = "error"; }
    if (mio !== turno) return;
    pintar();
    await esperar(350);   // con calma: Open Library es gratis para todos
  }
}

function abrir() {
  const mio = ++turno;
  filas = pendientes().map(libro => ({ libro: Object.assign({}, libro), estado: "buscando" }));
  hoja.abrir("Completar mi biblioteca", "");
  if (!filas.length) { hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = `<p class="lib-ayuda">Tus libros ya tienen sus datos. ✨</p>`; return; }
  pintar();
  revisar(mio);
}

// Usar: se suman los cambios en Firestore (update solo de esos campos).
function usar(i) {
  const x = filas[i];
  if (!x || !x.p || !D() || !D().actualizar) return;
  x.previo = C.antes(x.libro, x.p.cambios);
  D().actualizar(x.libro.id, x.p.cambios);
  x.estado = "usado";
  marcar(Object.assign({}, x.libro, x.p.cambios));
}
function deshacer(i) {
  const x = filas[i];
  if (!x || !x.previo || !D()) return;
  D().actualizar(x.libro.id, x.previo);
  x.estado = "propuesta";
  try { const r = revisados(); delete r[x.libro.id]; localStorage.setItem(CLAVE, JSON.stringify(r)); } catch (e) { /* nada */ }
  refrescar();
}

hoja.el.addEventListener("click", e => {
  const u = e.target.closest("[data-lib-cpl-usar]");
  if (u) { usar(Number(u.dataset.libCplUsar)); pintar(); return; }
  const d = e.target.closest("[data-lib-cpl-dejar]");
  if (d) { const x = filas[Number(d.dataset.libCplDejar)]; if (x) { x.estado = "dejado"; marcar(x.libro); } pintar(); return; }
  const h = e.target.closest("[data-lib-cpl-deshacer]");
  if (h) { deshacer(Number(h.dataset.libCplDeshacer)); pintar(); return; }
  if (e.target.closest("[data-lib-cpl-seguras]")) {
    filas.forEach((x, i) => { if (x.estado === "propuesta" && x.m.confianza === "alta") usar(i); });
    pintar();
  }
});
// La tarjeta de la lista.
document.addEventListener("click", e => { if (e.target.closest("[data-lib-completar]")) abrir(); });

window.LibrosCompletarUI = { tarjeta, abrir, pendientes };
})();
