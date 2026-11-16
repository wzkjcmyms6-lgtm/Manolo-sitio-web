// ---------- Libros: ficha del autor (nivel 3, fase 3, D-131) ----------
// Tocar el autor en la ficha de un libro abre su ficha: foto, quién es
// (Wikipedia en español, emparejada por Wikidata), sus años, tus libros de
// él y sus libros más leídos (títulos en español) con "＋ Quiero leer", que
// abre "Agregar libro" con todo lleno (y sus ediciones, D-130). Lo que se
// baja queda guardado en el teléfono 30 días (abre al instante y sin
// internet la segunda vez). Lógica: js/libros-fuentes.js.
(function () {
"use strict";
const F = window.LibrosFuentes, L = window.LibrosMotor;
if (!F || !L || !window.Lectura) return;
const { esc } = window.Lectura;
const hoja = window.Lectura.hoja("lib-autor-hoja");
const D = () => window.LibrosDatos;
const CLAVE = "manolo.libros.autores";
const DIAS = 30, MAX = 40;
let turno = 0;
let otros = [];   // sus libros que se muestran (para "＋ Quiero leer")

// ---- Guardado en el teléfono ----
function cache() { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; } }
function guardar(clave, datos) {
  try {
    const c = cache();
    c[clave] = Object.assign({ t: Date.now() }, datos);
    Object.keys(c).sort((a, b) => c[b].t - c[a].t).slice(MAX).forEach(k => { delete c[k]; });
    localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch (e) { /* sin almacenamiento: la próxima vez se vuelve a pedir */ }
}
const fresco = x => !!x && Date.now() - x.t < DIAS * 86400000;
const claveNombre = n => `nombre:${L.normalizar(n)}`;

function pedir(url) {
  if (!url) return Promise.resolve(null);
  const corte = typeof AbortController === "function" ? new AbortController() : null;
  const reloj = setTimeout(() => corte && corte.abort(), 12000);
  return fetch(url, corte ? { signal: corte.signal } : {}).then(r => (r.ok ? r.json() : null)).catch(() => null).finally(() => clearTimeout(reloj));
}

const iniciales = n => (String(n || "").split(/\s+/).filter(w => /[a-záéíóúñ]/i.test(w)).map(w => w[0]).slice(0, 2).join("") || "?").toUpperCase();
function tusLibros(nombre, key) {
  const todos = (D() && D().lista()) || [];
  return todos.filter(l => (key && l.autorKey === key) || F.mismoAutor(l.autor, nombre));
}

function html(nombre, key, datos, estado) {
  const a = datos && datos.autor, w = datos && datos.wiki;
  const mios = tusLibros(nombre, key || (datos && datos.key));
  const todos = (D() && D().lista()) || [];
  otros = datos && datos.libros ? datos.libros.filter(x => !F.loTienes(x, todos)) : [];
  const foto = (w && w.foto) || (a && a.foto) || "";
  const quien = w && w.descripcion ? w.descripcion : "";
  const anios = F.anios(a);
  const nombreVisto = (a && a.nombre) || nombre;
  return `<div class="lib-autor">
      <div class="lib-autor-cab">
        <span class="lib-autor-foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" decoding="async">` : `<b>${esc(iniciales(nombreVisto))}</b>`}</span>
        <div class="lib-autor-quien">
          <h4>${esc(nombreVisto)}</h4>
          ${quien ? `<p>${esc(quien.charAt(0).toUpperCase() + quien.slice(1))}</p>` : ""}
          ${anios ? `<p class="lib-autor-anios">${esc(anios)}</p>` : ""}
        </div>
      </div>
      ${w && w.extracto ? `<p class="lib-autor-bio">${esc(w.extracto)}</p><p class="lib-nota"><a class="lib-enlace" href="${esc(w.url)}" target="_blank" rel="noopener">Leer más en Wikipedia ↗</a></p>`
        : a && a.bio ? `<p class="lib-autor-bio">${esc(a.bio.length > 600 ? `${a.bio.slice(0, 600).replace(/\s+\S*$/, "")}…` : a.bio)}</p><p class="lib-nota">De Open Library.</p>`
        : estado === "cargando" ? `<p class="lib-ayuda" data-lib-autor-estado>Buscando quién es…</p>`
        : estado === "sin-internet" ? `<p class="lib-ayuda" data-lib-autor-estado>No pude buscar sus datos (¿estás sin internet?). Intenta más tarde.</p>`
        : estado === "no-encontrado" ? `<p class="lib-ayuda" data-lib-autor-estado>No encontré más datos de este autor.</p>` : ""}
      <div class="lib-h lib-h-fila"><h5>Tus libros de ${esc(nombreVisto)} <span>${mios.length}</span></h5></div>
      <div class="lib-autor-lista">${mios.map(l => `
        <button type="button" class="lib-autor-libro" data-lib-autor-ver="${esc(l.id)}">
          <span class="lib-portada" aria-hidden="true">${D().tapa(l)}</span>
          <span class="lib-autor-libro-t"><b>${esc(l.titulo)}</b><small>${esc(L.ESTADO[l.estado].nombre)}${l.calificacion ? ` · ${esc(L.estrellas(l.calificacion))}` : ""}</small></span>
        </button>`).join("")}</div>
      ${otros.length ? `<div class="lib-h lib-h-fila"><h5>Sus libros más leídos</h5></div>
      <div class="lib-autor-lista">${otros.map((x, i) => `
        <div class="lib-autor-otro">
          <span class="lib-autor-otro-portada" aria-hidden="true">${x.url ? `<img src="${esc(x.url)}" alt="" loading="lazy" decoding="async">` : `<span class="lib-portada">${D().tapa({ titulo: x.titulo, autor: x.autor })}</span>`}</span>
          <span class="lib-autor-libro-t"><b>${esc(x.titulo)}</b>
            <small>${esc([x.anio, x.ediciones > 1 ? `${x.ediciones} ediciones` : ""].filter(Boolean).join(" · "))}</small>
            ${x.tituloOriginal ? `<small class="lib-encontrado-orig">Original: ${esc(x.tituloOriginal)}</small>` : ""}</span>
          <button type="button" class="lib-btn-sec lib-btn-chico" data-lib-autor-quiero="${i}" aria-label="Quiero leer ${esc(x.titulo)}">＋ Quiero leer</button>
        </div>`).join("")}</div>` : ""}
    </div>`;
}

// l: el libro desde el que se abre ({ autor, autorKey }).
function abrir(l) {
  const nombre = String((l && l.autor) || "").trim();
  if (!nombre) return;
  const mio = ++turno;
  let key = l.autorKey || (cache()[claveNombre(nombre)] || {}).key || null;
  const guardado = key ? cache()[key] : null;
  hoja.abrir(nombre, html(nombre, key, fresco(guardado) ? guardado : null, fresco(guardado) ? "listo" : "cargando"));
  if (fresco(guardado)) return;
  (async () => {
    let respondio = false;
    if (!key) {
      const j = await pedir(F.urlBuscarAutor(nombre));
      respondio = !!j;
      key = F.elegirAutor(j, nombre);
      if (key) guardar(claveNombre(nombre), { key });
    }
    if (!key) {
      if (mio === turno && hoja.abierta()) hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = html(nombre, null, null, respondio ? "no-encontrado" : "sin-internet");
      return;
    }
    const [jAutor, jLibros] = await Promise.all([pedir(F.urlFichaAutor(key)), pedir(F.urlLibrosDeAutor(key))]);
    const autor = F.leerAutor(jAutor);
    const jWiki = autor ? await pedir(F.urlWikiAutor(autor.nombre)) : null;
    const datos = { key, autor, wiki: F.leerWiki(jWiki, autor), libros: jLibros ? F.librosDeAutor(jLibros) : [] };
    const algo = !!(autor || datos.libros.length);
    if (algo) guardar(key, datos);
    if (mio !== turno || !hoja.abierta()) return;
    hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = html(nombre, key, datos, algo ? "listo" : "sin-internet");
  })();
}

hoja.el.addEventListener("click", e => {
  const ver = e.target.closest("[data-lib-autor-ver]");
  if (ver && D()) { const id = ver.dataset.libAutorVer; hoja.cerrar(); D().ver(id); return; }
  const quiero = e.target.closest("[data-lib-autor-quiero]");
  if (quiero && D() && D().agregarCon) {
    const x = otros[Number(quiero.dataset.libAutorQuiero)];
    if (!x) return;
    hoja.cerrar();
    D().agregarCon(Object.assign({}, x));
  }
});

window.LibrosAutorUI = { abrir };
})();
