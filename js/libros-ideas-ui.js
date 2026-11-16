// ---------- Libros: "Si te gustó…" (nivel 3, fase 6, D-134) ----------
// Debajo de "¿Qué leo después?": ideas de libros que no tienes, a partir de
// tus últimos libros de 4 y 5 estrellas (del mismo autor y de los mismos
// temas, con edición en español), cada una con su razón. "＋ Quiero leer"
// abre "Agregar libro" con todo puesto (páginas de tu edición incluidas);
// "✕" la quita (no vuelve). "Ver las N" abre la lista completa.
// Se busca en Open Library solo con Libros a la vista (no al abrir la app),
// con calma (de a una, con pausas), y lo encontrado queda en el teléfono una
// semana; sin internet se muestra lo guardado.
// Lógica: js/libros-recomendar.js.
(function () {
"use strict";
const R = window.LibrosRecomendar, F = window.LibrosFuentes;
if (!R || !F || !window.Lectura) return;
const { esc } = window.Lectura;
const hoja = window.Lectura.hoja("lid-hoja");
const D = () => window.LibrosDatos || null;
const CLAVE = "manolo.libros.ideas", NO = "manolo.libros.ideas.no";
const VISIBLES = 2;   // en la pantalla (las demás, en «Ver las N»)
let pidiendo = null;   // la firma que se está buscando
let fallo = 0;         // cuándo falló la última vez (para no insistir)
let ideas = [];

function leer(k, def) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? def : v; } catch (e) { return def; } }
function escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
const descartadas = () => { const a = leer(NO, []); return Array.isArray(a) ? a : []; };
function descartar(k) { escribir(NO, descartadas().filter(x => x !== k).concat(k).slice(-200)); }

function pedir(url) {
  const corte = typeof AbortController === "function" ? new AbortController() : null;
  const reloj = setTimeout(() => corte && corte.abort(), 12000);
  return fetch(url, corte ? { signal: corte.signal } : {}).then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).finally(() => clearTimeout(reloj));
}
const esperar = ms => new Promise(r => setTimeout(r, ms));

// De cada libro que te gustó: primero su tema, después su autor.
async function buscar(ss, f) {
  pidiendo = f;
  const grupos = [];
  let alguna = false;
  const tus = () => (D() ? D().lista() : []);
  for (const s of ss) {
    const suj = F.sujetoDe(s.temas);
    if (suj) {
      try { grupos.push(R.deTema(await pedir(F.urlIdeasTema(suj[1])), s, suj[0], tus())); alguna = true; } catch (e) { grupos.push([]); }
      await esperar(350);
    } else grupos.push([]);
    try {
      let key = s.autorKey;
      if (!key && s.autor && F.esLatino(s.autor)) { key = F.elegirAutor(await pedir(F.urlBuscarAutor(s.autor)), s.autor); await esperar(350); }
      if (key) { grupos.push(R.delAutor(await pedir(F.urlLibrosDeAutor(key)), s, tus())); alguna = true; await esperar(350); } else grupos.push([]);
    } catch (e) { grupos.push([]); }
    if (pidiendo !== f) return;
  }
  pidiendo = null;
  if (alguna) escribir(CLAVE, { firma: f, t: Date.now(), grupos });
  else fallo = Date.now();
  render();
}

function tapa(x) {
  const u = x.url || x.urlChica;
  return u ? `<img src="${esc(u)}" alt="" loading="lazy" decoding="async">` : `<span class="lib-portada">${D().tapa({ titulo: x.titulo, autor: x.autor || "" })}</span>`;
}
function fila(i) {
  const x = i.libro, k = R.claveIdea(x);
  return `<li class="lid-item">
      <span class="lid-tapa" aria-hidden="true">${tapa(x)}</span>
      <span class="lid-c"><b>${esc(x.titulo)}</b>${x.autor ? `<small>${esc(x.autor)}</small>` : ""}<small class="lid-razon">${esc(R.razon(i))}</small>
        <span class="lid-acc"><button type="button" class="lib-btn-sec lib-btn-chico" data-lid-quiero="${esc(k)}" aria-label="Quiero leer ${esc(x.titulo)}">＋ Quiero leer</button>
          <button type="button" class="lid-no" data-lid-no="${esc(k)}" aria-label="No me interesa ${esc(x.titulo)}">✕</button></span></span>
    </li>`;
}
function htmlTodas() {
  return ideas.length
    ? `<p class="lib-nota">Ideas de Open Library a partir de tus libros de 4 y 5 estrellas: del mismo autor o de los mismos temas, con edición en español. «✕» la quita de la lista.</p>
      <ul class="lid-lista">${ideas.map(fila).join("")}</ul>`
    : `<p class="empty-state">No quedan ideas por ahora.</p>`;
}

function render() {
  const el = document.getElementById("lib-ideas");
  const d = D();
  if (!el || !d || !d.listo()) return;
  const ss = R.semillas(d.lista(), 3);
  if (!ss.length) { el.innerHTML = ""; ideas = []; return; }
  const f = R.firma(ss), g = leer(CLAVE, null);
  const aLaVista = el.getClientRects().length > 0;
  if (aLaVista && !R.vigente(g, f, Date.now()) && pidiendo !== f && navigator.onLine !== false && Date.now() - fallo > 10 * 60e3) buscar(ss, f);
  ideas = g && Array.isArray(g.grupos) ? R.mezclar(g.grupos, d.lista(), descartadas()) : [];
  el.innerHTML = ideas.length ? `<section class="lid" aria-labelledby="lid-t">
      <div class="lsig-cab"><h2 class="lib-sec-t" id="lid-t">Si te gustó…</h2>
        ${ideas.length > VISIBLES ? `<button type="button" class="lsig-ver" data-lid="todas">Ver las ${ideas.length} ›</button>` : ""}</div>
      <ul class="lid-lista">${ideas.slice(0, VISIBLES).map(fila).join("")}</ul>
    </section>` : "";
  if (hoja.abierta()) {
    const cuerpo = hoja.el.querySelector(".lib-hoja-cuerpo");
    const y = cuerpo ? cuerpo.scrollTop : 0;
    if (cuerpo) { cuerpo.innerHTML = htmlTodas(); cuerpo.scrollTop = y; }
  }
}

document.addEventListener("click", e => {
  if (e.target.closest('[data-lid="todas"]')) { hoja.abrir("Si te gustó…", htmlTodas()); return; }
  const q = e.target.closest("[data-lid-quiero]");
  if (q) {
    const i = ideas.find(x => R.claveIdea(x.libro) === q.dataset.lidQuiero);
    if (i && D() && D().agregarCon) { hoja.cerrar(); D().agregarCon(Object.assign({}, i.libro)); }
    return;
  }
  const n = e.target.closest("[data-lid-no]");
  if (n) { descartar(n.dataset.lidNo); render(); }
});
window.addEventListener("libros:datos", render);
// Al entrar a Libros (después de que la app muestre la pantalla).
window.addEventListener("hashchange", () => setTimeout(render, 0));

window.LibrosIdeasUI = { render };
})();
