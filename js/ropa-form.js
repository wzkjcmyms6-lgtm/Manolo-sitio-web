// ---------- Ropa: agregar y editar prendas (D-146) ----------
// "+" → hoja con "Sacar o elegir fotos" (varias a la vez) o "Sin foto". Cada
// foto se achica en el teléfono (como Lugares) y se arma el formulario de su
// prenda con el color ya puesto (sale de la foto, sin IA): grupo, qué es,
// colores, estampado, tela, estilo, clima, qué tan formal y marca; talla,
// precio, cuándo la compraste y notas en "Más datos". "Guardar y seguir"
// pasa a la siguiente foto. Editar usa el mismo formulario. "Lo compré" (de
// la lista de deseos, D-150): con foto o sin foto, el formulario ya viene con
// lo que querías y la fecha de hoy; al guardar, avisa (para marcarlo comprado).
(function () {
"use strict";
const M = window.RopaMotor, D = window.RopaDatos, A = () => window.RopaApp;
const IA = () => window.RopaIA;
const iaLista = () => !!(IA() && IA().disponible());
if (!M || !D || !window.Lectura || !document.getElementById("ro-app")) return;
const { esc } = window.Lectura;
const icono = n => `<span data-icon="${n}" aria-hidden="true"></span>`;

// ---------- El color de la foto (en el teléfono) ----------
function coloresDe(mini) {
  return new Promise(res => {
    if (!mini) { res([]); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const lado = 48, k = lado / Math.max(img.width || 1, img.height || 1);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round((img.width || 1) * k));
        c.height = Math.max(1, Math.round((img.height || 1) * k));
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, c.width, c.height);
        res(M.coloresDeFoto(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height));
      } catch (e) { res([]); }
    };
    img.onerror = () => res([]);
    img.src = mini;
  });
}

// ---------- Estado del formulario ----------
// cola: [{ archivo, reg (foto preparada), colores }]; i: la que se está viendo.
let cola = [], i = 0, editando = null, datos = null, guardadas = 0, ocupado = false;
let fotoNueva = null;   // al editar: la foto nueva (se borra si no guardas)
let relleno = null, despues = null;   // "Lo compré": lo que ya viene puesto y qué hacer al guardar
const vacio = () => ({ grupo: "arriba", tipo: "", colores: [], estampado: "liso", tela: "", corte: "", manga: "", estilo: [], clima: [], formalidad: null, marca: "", talla: "", precio: "", compra: "", notas: "", fotos: [] });
let cambiando = null;   // el color que estás cambiando (su lugar en la lista), o null si agregas uno (D-154)
let antes = null;   // el corte o las mangas que ya estaban elegidas al empezar el toque
const quitable = t => { const c = t && t.closest && t.closest(".ro-op-chip"); return c && c.querySelector('input[name="corte"], input[name="manga"]'); };
const H = () => A().hoja("ro-hoja-form");

// "+" (la barra de Ropa, o "Agregar prendas" del ropero vacío): a tu ropero
// (fotos o sin foto) o una inspiración (imágenes o un link de Pinterest, con
// js/ropa-insp.js).
function agregar(desde) {
  const h = A().hoja("ro-hoja-mas");
  const insp = window.RopaInsp;
  h.mostrar("Agregar", `<h4 class="ro-mas-t">A tu ropero</h4>
    <div class="run-mas-opciones ro-mas-ops">
    <label class="run-mas-op ro-mas-foto"><span class="icon" data-icon="camera"></span><span><b>Sacar o elegir fotos</b><small>Una prenda por foto; puedes elegir varias a la vez</small></span>
      <input type="file" accept="image/*" multiple class="lug-oculto" data-ro-fotos aria-label="Sacar o elegir fotos de tus prendas"></label>
    <button type="button" class="run-mas-op" data-ro-sinfoto><span class="icon" data-icon="edit"></span><span><b>Sin foto</b><small>Solo los datos; la foto la pones después</small></span></button>
  </div>
  ${insp ? `<h4 class="ro-mas-t">Inspiración</h4>
    <div class="run-mas-opciones ro-mas-ops">
    <label class="run-mas-op ro-mas-foto"><span class="icon" data-icon="imagen"></span><span><b>Subir imágenes</b><small>Capturas de Pinterest, de Instagram o de donde sea</small></span>
      <input type="file" accept="image/*" multiple class="lug-oculto" data-rin-fotos aria-label="Subir imágenes de inspiración"></label>
    <button type="button" class="run-mas-op" data-rin-link><span class="icon" data-icon="enlace"></span><span><b>Link de Pinterest</b><small>Pega el link de un pin</small></span></button>
  </div>` : ""}`);
  if (desde) h.volver = desde;
  h.el.onchange = e => {
    const inp = e.target.closest("[data-ro-fotos], [data-rin-fotos]");
    if (!inp || !inp.files || !inp.files.length) return;
    const archivos = [...inp.files].filter(f => /^image\//.test(f.type || "image/")).slice(0, 30);
    const esInsp = inp.hasAttribute("data-rin-fotos");
    inp.value = "";
    h.cerrar();
    if (archivos.length) setTimeout(() => (esInsp ? insp.subir(archivos) : empezar(archivos)), 230);
  };
  h.el.onclick = e => {
    if (e.target.closest("[data-ro-sinfoto]")) { h.cerrar(); setTimeout(() => empezar([]), 230); }
    else if (e.target.closest("[data-rin-link]")) { h.cerrar(); setTimeout(() => insp.pegarLink(desde), 230); }
  };
}
// El "+" de la barra de Ropa (o el "+ Agregar" de la compu).
document.addEventListener("click", e => {
  const b = e.target.closest("[data-ropa-mas]");
  if (!b) return;
  e.preventDefault();
  agregar(b);
});
function empezar(archivos, prefill, alGuardar) {
  cola = archivos.map(archivo => ({ archivo, reg: null, colores: null }));
  i = 0; editando = null; guardadas = 0;
  relleno = prefill || null; despues = alGuardar || null;
  abrirActual();
}
// "Lo compré": a tu ropero, con o sin foto. prefill: { grupo, tipo, colores
// [{ id }] }; alGuardar(id, datos): cuando quedó guardada.
function comprar(prefill, alGuardar, desde) {
  const h = A().hoja("ro-hoja-mas");
  h.mostrar("Lo compraste", `<p class="rd-nota ro-compre-nota">Pasa a tu ropero con la fecha de hoy. Sácale una foto o guárdala sin foto (la pones después).</p>
    <div class="run-mas-opciones ro-mas-ops">
    <label class="run-mas-op ro-mas-foto"><span class="icon" data-icon="camera"></span><span><b>Sacar o elegir la foto</b><small>Una prenda por foto</small></span>
      <input type="file" accept="image/*" class="lug-oculto" data-ro-fotos aria-label="Sacar o elegir la foto de lo que compraste"></label>
    <button type="button" class="run-mas-op" data-ro-sinfoto><span class="icon" data-icon="edit"></span><span><b>Sin foto</b><small>Solo los datos</small></span></button>
  </div>`);
  if (desde) h.volver = desde;
  if (typeof renderIcons === "function") renderIcons(h.el);
  const datosDe = () => Object.assign({}, prefill, { colores: (prefill.colores || []).map(c => ({ id: c.id })), compra: D.hoy() });
  h.el.onchange = e => {
    const inp = e.target.closest("[data-ro-fotos]");
    if (!inp || !inp.files || !inp.files.length) return;
    const archivos = [...inp.files].filter(f => /^image\//.test(f.type || "image/")).slice(0, 1);
    inp.value = "";
    h.cerrar();
    if (archivos.length) setTimeout(() => empezar(archivos, datosDe(), alGuardar), 230);
  };
  h.el.onclick = e => { if (e.target.closest("[data-ro-sinfoto]")) { h.cerrar(); setTimeout(() => empezar([], datosDe(), alGuardar), 230); } };
}
// Prepara la foto i (achicar y guardar en el teléfono como borrador), su color
// y, si la IA está conectada, le pide que la describa (sin esperar).
function preparar(x) {
  if (!x.preparando) {
    x.preparando = (x.reg || !D.Fotos ? Promise.resolve() : D.Fotos.preparar(x.archivo, "borrador", { clase: "prenda" })
      .then(reg => D.Fotos.guardar(reg).then(() => reg, () => Object.assign(reg, { soloMini: true })))
      .then(reg => { x.reg = reg; return coloresDe(reg.mini); })
      .then(c => { x.colores = c; }))
      .then(() => {
        if (x.reg && x.reg.blob && iaLista() && !x.iaPromesa) {
          x.iaPromesa = IA().describir(x.reg.blob).then(p => { x.ia = p; }, e => {
            if (e && e.codigo === "sin-internet") x.iaSinInternet = true;
            else x.iaError = (e && e.message) || "No respondió.";
          });
        } else if (x.reg && !x.iaPromesa && IA() && IA().sinInternet && IA().sinInternet()) {
          // Abriste Manolo sin internet: la IA lo avisa (D-152).
          x.iaSinInternet = true;
        }
        return x;
      })
      .catch(err => { console.warn("Ropa: foto", err); x.error = (err && err.message) || "No pude leer esa foto."; return x; });
  }
  return x.preparando;
}
// Lo que dijo la IA → los campos del formulario.
function desdeIA(p) {
  const o = { grupo: p.grupo, tipo: p.tipo, estampado: p.estampado || "liso", tela: M.mayus(p.tela), corte: p.corte || "", manga: p.manga || "",
    estilo: p.estilo.slice(), clima: p.clima.slice(), formalidad: p.formalidad, marca: M.mayus(p.marca) };
  if (p.colores.length) o.colores = p.colores.map(id => ({ id }));
  return o;
}
function aplicarIA(ia) {
  Object.assign(datos, desdeIA(ia));
  datos.ia = D.hoy();
  datos.iaAviso = { varias: ia.varias, noPrenda: ia.esPrenda === false };
}
function abrirActual() {
  const x = cola[i];
  datos = Object.assign(vacio(), relleno ? JSON.parse(JSON.stringify(relleno)) : {});
  if (!x) { formulario(); return; }
  H().mostrar(titulo(), `<p class="rd-nota ro-preparando">Preparando la foto…</p>`);
  H().alCerrar = descartarBorradores;
  preparar(x).then(() => {
    if (cola[i] !== x) return;
    if (x.reg) datos.fotos = [{ id: x.reg.id, mini: x.reg.mini, ancho: x.reg.ancho, alto: x.reg.alto }];
    // El color de la foto manda (es la prenda de verdad); si no salió, queda el que venía.
    const deFoto = (x.colores || []).map(c => ({ id: c.id, peso: c.peso }));
    if (deFoto.length || !relleno) datos.colores = deFoto;
    // La siguiente foto se va preparando (y la IA la va mirando) mientras revisas esta.
    if (cola[i + 1]) preparar(cola[i + 1]);
    if (x.iaPromesa && !x.ia && !x.iaError && !x.iaSinInternet) {
      H().mostrar(titulo(), `<div class="ro-ia-espera" role="status"><span class="rsp-rueda" aria-hidden="true"></span>
        <p><b>La IA está mirando la foto…</b></p><p class="rd-nota">Tarda unos segundos. Si quieres, llénala a mano.</p>
        <button type="button" class="lib-btn-sec" data-ro-a-mano>Llenar a mano</button></div>`);
      H().alCerrar = descartarBorradores;
      H().el.onclick = e => { if (e.target.closest("[data-ro-a-mano]")) { x.aMano = true; formulario(); } };
      x.iaPromesa.then(() => {
        if (cola[i] !== x || x.aMano || !H().abierta()) return;
        if (x.ia) aplicarIA(x.ia);
        formulario();
      });
      return;
    }
    if (x.ia && !x.aMano) aplicarIA(x.ia);
    formulario();
  });
}
const titulo = () => (editando ? "Editar prenda" : cola.length > 1 ? `Prenda ${i + 1} de ${cola.length}` : "Nueva prenda");
// Las fotos de la cola (o la foto nueva al editar) que no se guardaron se
// borran del teléfono.
function descartarBorradores() {
  if (!D.Fotos) return;
  if (editando) { if (fotoNueva && !fotoNueva.guardada) D.Fotos.borrar(fotoNueva.id).catch(() => {}); fotoNueva = null; return; }
  cola.slice(i).forEach(x => { if (x.reg && !x.guardada) D.Fotos.borrar(x.reg.id).catch(() => {}); });
  cola = [];
}

// ---------- El formulario ----------
const radio = (nombre, v, t, sel) => `<label class="ro-op-chip"><input type="radio" name="${nombre}" value="${esc(v)}"${sel ? " checked" : ""}><span>${esc(t)}</span></label>`;
const check = (nombre, v, t, sel) => `<label class="ro-op-chip"><input type="checkbox" name="${nombre}" value="${esc(v)}"${sel ? " checked" : ""}><span>${esc(t)}</span></label>`;
const err = campo => `<small class="lug-err" data-err="${campo}" hidden></small>`;
function tiposHTML(grupo, tipo) {
  const ts = M.GRUPO[grupo].tipos.map(t => t[0]);
  const otro = tipo && !ts.includes(tipo);
  return ts.map(t => radio("tipo", t, t, t === tipo)).join("") + radio("tipo", "__otro", "Otro", otro)
    + `<input class="lib-input ro-otro" name="tipoOtro" maxlength="40" placeholder="Escribe qué es" aria-label="Qué prenda es" value="${otro ? esc(tipo) : ""}"${otro ? "" : " hidden"}>`;
}
// Cada color: tócalo para cambiarlo (D-154), o la ✕ para quitarlo.
function coloresHTML() {
  const sel = datos.colores;
  return `${sel.length ? sel.map((c, k) => `<span class="ro-color-sel${k === cambiando ? " is-cambiando" : ""}"><button type="button" class="ro-color-cambiar" data-ro-color-cambiar="${k}" aria-expanded="${k === cambiando}" aria-label="Cambiar ${esc(M.nombreColor(c.id))}${k === 0 && sel.length > 1 ? " (el principal)" : ""}"><i class="ro-muestra" style="background:${esc(M.COLOR[c.id].hex)}" aria-hidden="true"></i>${esc(M.nombreColor(c.id))}${k === 0 && sel.length > 1 ? " <small>(el principal)</small>" : ""}</button><button type="button" class="ro-quitar" data-ro-quitar="${esc(c.id)}" aria-label="Quitar ${esc(M.nombreColor(c.id))}">${icono("close")}</button></span>`).join("") : `<span class="rd-nota">Sin color todavía.</span>`}
    ${sel.length < 3 ? `<button type="button" class="lug-chip ro-color-mas" data-ro-paleta aria-expanded="false">${icono("plus")}Agregar color</button>` : ""}
    ${sel.length ? `<small class="rd-nota ro-colores-nota">Toca un color para cambiarlo.</small>` : ""}`;
}
const paletaHTML = () => `<div class="ro-paleta-caja" data-ro-paleta-lista hidden>
  <p class="ro-paleta-t" data-ro-paleta-t>Elige un color</p>
  <button type="button" class="link-btn ro-principal" data-ro-principal hidden>Que sea el principal</button>
  <div class="ro-paleta">${M.COLORES.map(c => `<button type="button" class="ro-color-op" data-ro-color="${c.id}" aria-label="${esc(M.nombreColor(c.id))}" title="${esc(M.nombreColor(c.id))}"><i style="background:${esc(c.hex)}"></i><span>${esc(M.nombreColor(c.id))}</span></button>`).join("")}</div></div>`;
// El corte (con el nombre que va con la prenda: "Pegada", "Recto") y las mangas (D-154).
function cortesHTML(grupo, tipo, corte) {
  return M.CORTES_DE[grupo].map(id => radio("corte", id, M.nombreCorte(id, tipo || M.GRUPO[grupo].tipos[0][0]), id === corte)).join("");
}
const mangasHTML = manga => M.MANGAS.map(([v, t]) => radio("manga", v, t, v === manga)).join("");
function formulario() {
  const x = cola[i], d = datos;
  cambiando = null;
  const foto = d.fotos[0];
  const av = d.iaAviso;
  const deFoto = x && x.colores && x.colores.length && !editando && !av;
  const html = `<form class="ro-form" novalidate>
    ${foto ? `<div class="ro-form-foto"><img src="${esc(foto.mini)}" data-foto="${esc(foto.id)}" alt="La foto de la prenda"></div>` : ""}
    ${x && x.error ? `<p class="lib-error">${esc(x.error)} Puedes guardarla sin foto o saltarla.</p>` : ""}
    ${av ? `<p class="ro-ia-aviso" role="status">${icono("sparkle")}Lo llenó la IA: revísalo antes de guardar.</p>` : ""}
    ${av && av.varias ? `<p class="ro-ia-ojo">En la foto hay varias prendas: la IA describió la principal. Mejor una prenda por foto.</p>` : ""}
    ${av && av.noPrenda ? `<p class="ro-ia-ojo">La IA no ve ropa en esta foto.</p>` : ""}
    ${x && x.iaError && !x.aMano ? `<p class="ro-ia-ojo">La IA no pudo: ${esc(x.iaError)} Llénala a mano.</p>` : ""}
    ${x && x.iaSinInternet && !x.aMano ? `<p class="ro-ia-ojo">Sin internet: la IA no puede mirar la foto. Llénala a mano.</p>` : ""}
    <fieldset class="ro-campo"><legend>Grupo</legend><div class="ro-opciones" data-grupo="grupo">${M.GRUPOS.map(g => radio("grupo", g.id, g.nombre, d.grupo === g.id)).join("")}</div>${err("grupo")}</fieldset>
    <fieldset class="ro-campo"><legend>Qué es</legend><div class="ro-opciones" data-grupo="tipo" data-ro-tipos>${tiposHTML(d.grupo, d.tipo)}</div>${err("tipo")}</fieldset>
    <fieldset class="ro-campo" data-ro-corte-campo${M.CORTES_DE[d.grupo].length ? "" : " hidden"}><legend>Corte <small>(cómo te queda)</small></legend>
      <div class="ro-opciones" data-ro-cortes>${cortesHTML(d.grupo, d.tipo, d.corte)}</div></fieldset>
    <fieldset class="ro-campo" data-ro-manga-campo${M.CON_MANGA.includes(d.grupo) ? "" : " hidden"}><legend>Mangas</legend>
      <div class="ro-opciones" data-ro-mangas>${mangasHTML(d.manga)}</div></fieldset>
    <fieldset class="ro-campo"><legend>Colores</legend><div class="ro-colores" data-ro-colores>${coloresHTML()}</div>${paletaHTML()}
      ${deFoto ? `<small class="rd-nota ro-de-foto">Lo saqué de la foto: revísalo.</small>` : ""}</fieldset>
    <label class="rd-campo">Estampado<select class="lib-input" name="estampado">${M.ESTAMPADOS.map(([v, t]) => `<option value="${v}"${d.estampado === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="rd-campo">Tela<input class="lib-input" name="tela" maxlength="40" list="ro-telas" value="${esc(d.tela)}" placeholder="Ej.: Algodón"><datalist id="ro-telas">${M.TELAS.map(t => `<option value="${esc(t)}">`).join("")}</datalist></label>
    <fieldset class="ro-campo"><legend>Estilo</legend><div class="ro-opciones">${M.ESTILOS.map(([v, t]) => check("estilo", v, t, d.estilo.includes(v))).join("")}</div></fieldset>
    <fieldset class="ro-campo"><legend>Para qué clima</legend><div class="ro-opciones">${M.CLIMAS.map(([v, t]) => check("clima", v, t, d.clima.includes(v))).join("")}</div></fieldset>
    <fieldset class="ro-campo"><legend>Qué tan formal es</legend><div class="ro-opciones ro-formal">${[1, 2, 3, 4, 5].map(n => radio("formalidad", String(n), String(n), d.formalidad === n)).join("")}</div>
      <small class="rd-nota" data-ro-formal-t>${d.formalidad ? esc(M.FORMALIDAD[d.formalidad]) : "1 es muy informal (buzo) y 5, muy formal (terno)."}</small></fieldset>
    <label class="rd-campo">Marca<input class="lib-input" name="marca" maxlength="40" value="${esc(d.marca)}" autocomplete="off"></label>
    <details class="ro-mas"${d.talla || d.precio !== "" || d.compra || d.notas ? " open" : ""}><summary>Más datos (si quieres)</summary>
      <label class="rd-campo">Talla<input class="lib-input" name="talla" maxlength="12" value="${esc(d.talla)}" autocomplete="off"></label>
      <label class="rd-campo">Precio (Bs)<input class="lib-input" name="precio" inputmode="decimal" value="${esc(d.precio)}">${err("precio")}</label>
      <label class="rd-campo">Cuándo la compraste<input class="lib-input" type="date" name="compra" value="${esc(d.compra)}">${err("compra")}</label>
      <label class="rd-campo">Notas<textarea class="lib-input" name="notas" rows="2" maxlength="500">${esc(d.notas)}</textarea></label>
    </details>
    ${editando ? `<label class="lib-btn-sec ro-cambiar-foto">${icono("camera")}${foto ? "Cambiar la foto" : "Poner una foto"}<input type="file" accept="image/*" class="lug-oculto" data-ro-cambiar aria-label="Cambiar la foto de la prenda"></label>` : ""}
    <p class="lib-error" data-ro-resumen hidden></p>
    <div class="ro-form-botones">
      ${editando ? `<button type="button" class="lib-btn-sec" data-cerrar-hoja>Cancelar</button>` : cola.length > 1 ? `<button type="button" class="lib-btn-sec" data-ro-saltar>Saltar esta</button>` : `<button type="button" class="lib-btn-sec" data-cerrar-hoja>Cancelar</button>`}
      <button type="submit" class="lib-btn">${!editando && cola.length > 1 && i < cola.length - 1 ? "Guardar y seguir" : "Guardar"}</button>
    </div>
  </form>`;
  const h = H();
  h.mostrar(titulo(), html, editando ? "[name=grupo]:checked" : null);
  h.alCerrar = descartarBorradores;
  const panel = h.el.querySelector(".budget-sheet-panel");
  if (panel) panel.scrollTop = 0;
  const img = h.el.querySelector("img[data-foto]");
  if (img && D.Fotos) D.Fotos.url(img.dataset.foto).then(u => { if (u && img.isConnected) img.src = u; });
  h.el.onchange = alCambiar;
  h.el.oninput = e => { if (e.target.name === "tipoOtro") quitarError("tipo"); };
  h.el.onclick = alClic;
  h.el.onpointerdown = e => { const r = quitable(e.target); antes = r && r.checked ? r : null; };
  h.el.onpointercancel = () => { antes = null; };   // el dedo se arrastró para desplazar: no fue un toque
  h.el.onsubmit = e => { e.preventDefault(); guardar(); };
}
function form() { return H().el.querySelector(".ro-form"); }
function quitarError(campo) { const m = form() && form().querySelector(`[data-err="${campo}"]`); if (m) { m.hidden = true; m.textContent = ""; } }
// Lo escrito → datos (sin perder lo que no está en el formulario).
function leer() {
  const f = form();
  if (!f) return datos;
  const v = n => (f.elements[n] ? f.elements[n].value : "");
  const marcadas = n => [...f.querySelectorAll(`input[name="${n}"]:checked`)].map(x => x.value);
  const g = (f.querySelector('input[name="grupo"]:checked') || {}).value || datos.grupo;
  let tipo = (f.querySelector('input[name="tipo"]:checked') || {}).value || "";
  if (tipo === "__otro") tipo = v("tipoOtro").trim();
  const fo = (f.querySelector('input[name="formalidad"]:checked') || {}).value;
  const corte = (f.querySelector('input[name="corte"]:checked') || {}).value || "";
  const manga = (f.querySelector('input[name="manga"]:checked') || {}).value || "";
  Object.assign(datos, {
    grupo: g, tipo, estampado: v("estampado"), tela: v("tela").trim(), corte, manga, estilo: marcadas("estilo"), clima: marcadas("clima"),
    formalidad: fo ? Number(fo) : null, marca: v("marca").trim(), talla: v("talla").trim(),
    precio: String(v("precio")).replace(",", ".").trim(), compra: v("compra"), notas: v("notas").trim()
  });
  return datos;
}
function alCambiar(e) {
  const t = e.target;
  if (t.name === "grupo") {
    leer();
    datos.tipo = "";
    const cont = form().querySelector("[data-ro-tipos]");
    cont.innerHTML = tiposHTML(datos.grupo, "");
    pintarCortes();
    quitarError("grupo");
  } else if (t.name === "tipo") {
    const otro = form().elements.tipoOtro;
    if (otro) { otro.hidden = t.value !== "__otro"; if (!otro.hidden) otro.focus(); }
    leer();
    pintarCortes();
    quitarError("tipo");
  } else if (t.name === "formalidad") {
    const s = form().querySelector("[data-ro-formal-t]");
    if (s) s.textContent = M.FORMALIDAD[Number(t.value)] || "";
  } else if (t.matches("[data-ro-cambiar]") && t.files && t.files[0]) {
    cambiarFoto(t.files[0]);
    t.value = "";
  }
}
function pintarColores() {
  const c = form().querySelector("[data-ro-colores]");
  c.innerHTML = coloresHTML();
  if (typeof renderIcons === "function") renderIcons(c);
}
// Los cortes y las mangas del grupo elegido (lo que no va con el grupo, se borra).
function pintarCortes() {
  const f = form();
  if (!M.CORTES_DE[datos.grupo].includes(datos.corte)) datos.corte = "";
  if (!M.CON_MANGA.includes(datos.grupo)) datos.manga = "";
  f.querySelector("[data-ro-cortes]").innerHTML = cortesHTML(datos.grupo, datos.tipo, datos.corte);
  f.querySelector("[data-ro-corte-campo]").hidden = !M.CORTES_DE[datos.grupo].length;
  f.querySelector("[data-ro-mangas]").innerHTML = mangasHTML(datos.manga);
  f.querySelector("[data-ro-manga-campo]").hidden = !M.CON_MANGA.includes(datos.grupo);
}
// La paleta: para agregar un color (k = null) o para cambiar el que tocaste.
function abrirPaleta(k) {
  const f = form();
  cambiando = k;
  f.querySelectorAll("[data-ro-color-cambiar]").forEach(b => {
    const si = Number(b.dataset.roColorCambiar) === k;
    b.setAttribute("aria-expanded", String(si));
    b.parentNode.classList.toggle("is-cambiando", si);
  });
  const l = f.querySelector("[data-ro-paleta-lista]");
  const c = k != null ? datos.colores[k] : null;
  f.querySelector("[data-ro-paleta-t]").textContent = c ? `Elige el color nuevo en lugar de ${M.nombreColor(c.id).toLowerCase()}` : "Elige un color";
  f.querySelector("[data-ro-principal]").hidden = !(k > 0);
  l.hidden = false;
  const mas = f.querySelector("[data-ro-paleta]");
  if (mas) mas.setAttribute("aria-expanded", String(k == null));
  l.closest("fieldset").scrollIntoView({ block: "nearest", behavior: "smooth" });
}
// foco: a qué volver (el color que cambiaste, el que agregaste…).
function cerrarPaleta(foco) {
  const f = form();
  cambiando = null;
  f.querySelector("[data-ro-paleta-lista]").hidden = true;
  pintarColores();
  const b = foco && f.querySelector(foco);
  if (b) b.focus({ preventScroll: true });
}
const chip = k => `[data-ro-color-cambiar="${k}"]`;
function alClic(e) {
  const q = e.target.closest("[data-ro-quitar]");
  if (q) { datos.colores = datos.colores.filter(c => c.id !== q.dataset.roQuitar); cerrarPaleta(datos.colores.length ? chip(0) : "[data-ro-paleta]"); return; }
  const cam = e.target.closest("[data-ro-color-cambiar]");
  if (cam) {
    const k = Number(cam.dataset.roColorCambiar);
    if (cambiando === k && !form().querySelector("[data-ro-paleta-lista]").hidden) cerrarPaleta(chip(k)); else abrirPaleta(k);
    return;
  }
  const pal = e.target.closest("[data-ro-paleta]");
  if (pal) {
    const l = form().querySelector("[data-ro-paleta-lista]");
    if (!l.hidden && cambiando == null) cerrarPaleta("[data-ro-paleta]"); else abrirPaleta(null);
    return;
  }
  if (e.target.closest("[data-ro-principal]")) {
    if (cambiando > 0) { const [c] = datos.colores.splice(cambiando, 1); datos.colores.unshift(c); }
    cerrarPaleta(chip(0));
    return;
  }
  const c = e.target.closest("[data-ro-color]");
  if (c) {
    const id = c.dataset.roColor, ya = datos.colores.findIndex(x => x.id === id);
    if (cambiando != null && datos.colores[cambiando]) {
      // Cambiar: el nuevo queda en el mismo lugar (si ya estaba en otro, ese se va).
      datos.colores = datos.colores.map((x, k) => (k === cambiando ? { id } : x)).filter((x, k) => k === cambiando || x.id !== id);
    } else if (ya < 0 && datos.colores.length < 3) datos.colores.push({ id });
    cerrarPaleta(chip(datos.colores.findIndex(x => x.id === id)));
    return;
  }
  // Tocar otra vez el corte o las mangas que ya estaban elegidas: quedan sin
  // elegir (después del toque, para que el teléfono no lo vuelva a marcar).
  const r = quitable(e.target);
  if (r && r === antes) {
    antes = null;
    setTimeout(() => { r.checked = false; leer(); }, 0);
    return;
  }
  if (e.target.closest("[data-ro-saltar]")) {
    const x = cola[i];
    if (x && x.reg && D.Fotos) D.Fotos.borrar(x.reg.id).catch(() => {});
    if (x) x.guardada = true;   // ya no hay que borrarla al cerrar
    siguiente();
  }
}
function mostrarErrores(lista) {
  const f = form();
  f.querySelectorAll("[data-err]").forEach(el => { el.hidden = true; el.textContent = ""; });
  lista.forEach(x => { const m = f.querySelector(`[data-err="${x.campo}"]`); if (m) { m.textContent = x.texto; m.hidden = false; } });
  const r = f.querySelector("[data-ro-resumen]");
  if (r) { r.textContent = lista.length ? "Revisa lo marcado." : ""; r.hidden = !lista.length; }
  const primero = lista.length && f.querySelector(`[data-grupo="${lista[0].campo}"] input, [name="${lista[0].campo}"]`);
  if (primero) { primero.focus({ preventScroll: true }); primero.scrollIntoView({ block: "center", behavior: "smooth" }); }
}
function guardar() {
  if (ocupado) return;
  const d = leer();
  const errores = M.validar(d);
  if (errores.length) { mostrarErrores(errores); return; }
  ocupado = true;
  const x = cola[i];
  const anteriores = editando ? (D.una(editando) || { fotos: [] }).fotos.map(f => f.id) : [];
  D.guardar(editando, d).then(id => {
    if (x) x.guardada = true;
    if (fotoNueva && d.fotos.some(f => f.id === fotoNueva.id)) fotoNueva.guardada = true;
    guardadas++;
    // Al cambiar la foto, la vieja se borra del teléfono.
    if (editando && D.Fotos) anteriores.filter(fid => !d.fotos.some(f => f.id === fid)).forEach(fid => D.Fotos.borrar(fid).catch(() => {}));
    ocupado = false;
    const nombre = M.titulo(M.normalizar(id, d));
    if (editando) { H().cerrar(); A().aviso(`Listo: ${nombre} quedó guardada.`); return; }
    if (i < cola.length - 1) { A().aviso(`Listo: ${nombre}.`); siguiente(); return; }
    H().cerrar();
    A().aviso(guardadas > 1 ? `Listo: ${guardadas} prendas nuevas en tu ropero.` : `Listo: ${nombre} está en tu ropero.`);
    if (despues) { const f = despues; despues = null; relleno = null; f(id, d); }
  }).catch(e2 => { ocupado = false; A().fallo(e2); });
}
function siguiente() {
  i++;
  if (i >= cola.length) { H().cerrar(); if (guardadas) A().aviso(guardadas > 1 ? `Listo: ${guardadas} prendas nuevas en tu ropero.` : "Listo."); return; }
  abrirActual();
}
function cambiarFoto(archivo) {
  if (!D.Fotos) return;
  leer();
  D.Fotos.preparar(archivo, editando || "borrador", { clase: "prenda" })
    .then(reg => D.Fotos.guardar(reg).then(() => reg, () => reg))
    .then(reg => coloresDe(reg.mini).then(c => ({ reg, c })))
    .then(({ reg, c }) => {
      if (fotoNueva && !fotoNueva.guardada) D.Fotos.borrar(fotoNueva.id).catch(() => {});
      fotoNueva = { id: reg.id, guardada: false };
      datos.fotos = [{ id: reg.id, mini: reg.mini, ancho: reg.ancho, alto: reg.alto }];
      if (!datos.colores.length && c.length) datos.colores = c.map(x => ({ id: x.id, peso: x.peso }));
      formulario();
    })
    .catch(e => A().aviso((e && e.message) || "No pude leer esa foto."));
}
// ia (opcional): lo que la IA vio en la foto ("Describir con IA" en la ficha).
// o.colores: abre en los colores, con la paleta para cambiar el principal (D-154).
function editar(id, desde, ia, o) {
  const p = D.una(id);
  if (!p) return;
  editando = id; cola = []; i = 0; fotoNueva = null; relleno = null; despues = null; cambiando = null;
  datos = Object.assign(vacio(), {
    grupo: p.grupo, tipo: p.tipo, colores: p.colores.map(c => ({ id: c.id, peso: c.peso })), estampado: p.estampado || "liso", tela: p.tela, corte: p.corte, manga: p.manga,
    estilo: p.estilo.slice(), clima: p.clima.slice(), formalidad: p.formalidad, marca: p.marca, talla: p.talla,
    precio: p.precio != null ? String(p.precio) : "", compra: p.compra, notas: p.notas, fotos: p.fotos.map(f => Object.assign({}, f))
  });
  if (ia) aplicarIA(ia);
  formulario();
  if (desde) H().volver = desde;
  if (o && o.colores) setTimeout(() => {
    if (!form()) return;
    abrirPaleta(datos.colores.length ? 0 : null);
    const b = form().querySelector(datos.colores.length ? chip(0) : "[data-ro-paleta]");
    if (b) b.focus({ preventScroll: true });
  }, 300);
}

window.RopaForm = { agregar, editar, comprar, coloresDe };
})();
