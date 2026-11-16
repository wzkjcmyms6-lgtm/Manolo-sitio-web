// ---------- Libros: "De qué trata" y temas (nivel 3, fase 4, D-132) ----------
// En la ficha de un libro: sus temas en español (tocar uno muestra tus
// libros de ese tema) y "De qué trata": la página del libro en Wikipedia en
// español; si no hay, la descripción de Open Library si está en español; si
// no, Google Books. Nada se inventa: sin fuente, no se muestra. Lo que se
// encuentra (o que no hay) queda guardado en el teléfono (90 días; "no hay",
// 7 días). Lógica: js/libros-fuentes.js.
(function () {
"use strict";
const F = window.LibrosFuentes, L = window.LibrosMotor;
if (!F || !L || !window.Lectura) return;
const { esc } = window.Lectura;
const CLAVE = "manolo.libros.sinopsis";
const DIAS_SI = 90, DIAS_NO = 7, MAX = 120;
const FUENTE = { wikipedia: "Wikipedia", openlibrary: "Open Library", google: "Google Libros" };

function cache() { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; } }
function guardar(clave, dato) {
  try {
    const c = cache();
    c[clave] = Object.assign({ t: Date.now() }, dato);
    Object.keys(c).sort((a, b) => c[b].t - c[a].t).slice(MAX).forEach(k => { delete c[k]; });
    localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch (e) { /* sin almacenamiento */ }
}
const vigente = x => !!x && Date.now() - x.t < (x.texto ? DIAS_SI : DIAS_NO) * 86400000;
const claveDe = l => l.olKey || `t:${L.normalizar(l.titulo)}|${L.normalizar(l.autor)}`;

function pedir(url) {
  if (!url) return Promise.resolve(null);
  const corte = typeof AbortController === "function" ? new AbortController() : null;
  const reloj = setTimeout(() => corte && corte.abort(), 12000);
  return fetch(url, corte ? { signal: corte.signal } : {}).then(r => (r.ok ? r.json() : null)).catch(() => null).finally(() => clearTimeout(reloj));
}
// Wikipedia → Open Library (en español) → Google Books.
async function buscar(l) {
  const w = F.leerWikiLibro(await pedir(F.urlWikiLibro(l.titulo, l.autor)), l.titulo, l.autor);
  if (w) return w;
  if (l.olKey) { const o = F.leerObra(await pedir(F.urlObra(l.olKey))); if (o) return o; }
  return F.leerGoogle(await pedir(F.urlGoogle(l.titulo, l.autor)), l.titulo, l.autor);
}

function htmlTrata(s) {
  const largo = s.texto.length > 320;
  return `<h5 class="lib-h">De qué trata</h5>
    <p class="lib-trata${largo ? " is-corto" : ""}" data-lib-trata-texto>${esc(s.texto)}</p>
    ${largo ? `<button type="button" class="lib-btn-sec lib-btn-chico" data-lib-trata-mas>Ver más</button>` : ""}
    <p class="lib-nota">Fuente: ${s.url ? `<a class="lib-enlace" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(FUENTE[s.fuente] || s.fuente)} ↗</a>` : esc(FUENTE[s.fuente] || s.fuente)}</p>`;
}
// Los temas (chips) van en la ficha; tocar uno filtra tu lista (js/libros.js).
const temas = l => (l.temas && l.temas.length ? `<div class="lib-temas" aria-label="Temas">${l.temas.map(t => `<button type="button" class="lib-chip lib-tema" data-lib-tema="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : "");

let turno = 0;
function pintar(caja, l) {
  if (!caja || !l || !l.titulo) return;
  const mio = ++turno;
  const clave = claveDe(l);
  const c = cache()[clave];
  if (vigente(c)) { caja.innerHTML = c.texto ? htmlTrata(c) : ""; return; }
  caja.innerHTML = `<p class="lib-ayuda" data-lib-trata-estado>Buscando de qué trata…</p>`;
  buscar(l).then(s => {
    guardar(clave, s ? { texto: s.texto, fuente: s.fuente, url: s.url || "", genero: s.genero || null } : { texto: "" });
    if (mio !== turno || !caja.isConnected) return;
    caja.innerHTML = s ? htmlTrata(s) : "";
  });
}
// "Ver más": el texto completo.
document.addEventListener("click", e => {
  const b = e.target.closest("[data-lib-trata-mas]");
  if (!b) return;
  const p = b.parentElement.querySelector("[data-lib-trata-texto]");
  if (p) p.classList.remove("is-corto");
  b.remove();
});
// Para quien lo necesite (fase 5: completar la biblioteca).
const guardado = l => { const c = cache()[claveDe(l)]; return vigente(c) ? c : null; };

window.LibrosTrataUI = { pintar, temas, guardado, buscar };
})();
