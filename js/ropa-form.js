// ---------- Ropa: agregar y editar prendas (D-146) ----------
// "+" → hoja con "Sacar o elegir fotos" (varias a la vez) o "Sin foto". Cada
// foto se achica en el teléfono (como Lugares) y se arma el formulario de su
// prenda con el color ya puesto (sale de la foto, sin IA): grupo, qué es,
// colores, estampado, tela, estilo, clima, qué tan formal y marca; talla,
// precio, cuándo la compraste y notas en "Más datos". "Guardar y seguir"
// pasa a la siguiente foto. Editar usa el mismo formulario.
(function () {
"use strict";
const M = window.RopaMotor, D = window.RopaDatos, A = () => window.RopaApp;
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
const vacio = () => ({ grupo: "arriba", tipo: "", colores: [], estampado: "liso", tela: "", estilo: [], clima: [], formalidad: null, marca: "", talla: "", precio: "", compra: "", notas: "", fotos: [] });
const H = () => A().hoja("ro-hoja-form");

// "+": cómo quieres agregar.
function agregar(desde) {
  const h = A().hoja("ro-hoja-mas");
  h.mostrar("Agregar prendas", `<div class="run-mas-opciones ro-mas-ops">
    <label class="run-mas-op ro-mas-foto"><span class="icon" data-icon="camera"></span><span><b>Sacar o elegir fotos</b><small>Una prenda por foto; puedes elegir varias a la vez</small></span>
      <input type="file" accept="image/*" multiple class="lug-oculto" data-ro-fotos aria-label="Sacar o elegir fotos de tus prendas"></label>
    <button type="button" class="run-mas-op" data-ro-sinfoto><span class="icon" data-icon="edit"></span><span><b>Sin foto</b><small>Solo los datos; la foto la pones después</small></span></button>
  </div>`);
  if (desde) h.volver = desde;
  h.el.onchange = e => {
    const inp = e.target.closest("[data-ro-fotos]");
    if (!inp || !inp.files || !inp.files.length) return;
    const archivos = [...inp.files].filter(f => /^image\//.test(f.type || "image/")).slice(0, 30);
    inp.value = "";
    h.cerrar();
    if (archivos.length) setTimeout(() => empezar(archivos), 230);
  };
  h.el.onclick = e => {
    if (!e.target.closest("[data-ro-sinfoto]")) return;
    h.cerrar();
    setTimeout(() => empezar([]), 230);
  };
}
function empezar(archivos) {
  cola = archivos.map(archivo => ({ archivo, reg: null, colores: null }));
  i = 0; editando = null; guardadas = 0;
  abrirActual();
}
// Prepara la foto i (achicar y guardar en el teléfono como borrador) y su color.
function preparar(x) {
  if (x.reg || !D.Fotos) return Promise.resolve(x);
  return D.Fotos.preparar(x.archivo, "borrador", { clase: "prenda" })
    .then(reg => D.Fotos.guardar(reg).then(() => reg, () => Object.assign(reg, { soloMini: true })))
    .then(reg => { x.reg = reg; return coloresDe(reg.mini); })
    .then(c => { x.colores = c; return x; })
    .catch(err => { console.warn("Ropa: foto", err); x.error = (err && err.message) || "No pude leer esa foto."; return x; });
}
function abrirActual() {
  const x = cola[i];
  datos = vacio();
  if (!x) { formulario(); return; }
  H().mostrar(titulo(), `<p class="rd-nota ro-preparando">Preparando la foto…</p>`);
  H().alCerrar = descartarBorradores;
  preparar(x).then(() => {
    if (cola[i] !== x) return;
    if (x.reg) datos.fotos = [{ id: x.reg.id, mini: x.reg.mini, ancho: x.reg.ancho, alto: x.reg.alto }];
    datos.colores = (x.colores || []).map(c => ({ id: c.id, peso: c.peso }));
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
function coloresHTML() {
  const sel = datos.colores;
  return `${sel.length ? sel.map((c, k) => `<span class="ro-color-sel"><i class="ro-muestra" style="background:${esc(M.COLOR[c.id].hex)}" aria-hidden="true"></i>${esc(M.nombreColor(c.id))}${k === 0 && sel.length > 1 ? " <small>(el principal)</small>" : ""}<button type="button" class="ro-quitar" data-ro-quitar="${esc(c.id)}" aria-label="Quitar ${esc(M.nombreColor(c.id))}">${icono("close")}</button></span>`).join("") : `<span class="rd-nota">Sin color todavía.</span>`}
    ${sel.length < 3 ? `<button type="button" class="lug-chip ro-color-mas" data-ro-paleta aria-expanded="false">${icono("plus")}Agregar color</button>` : ""}`;
}
const paletaHTML = () => `<div class="ro-paleta" data-ro-paleta-lista hidden>${M.COLORES.map(c => `<button type="button" class="ro-color-op" data-ro-color="${c.id}" aria-label="${esc(M.nombreColor(c.id))}" title="${esc(M.nombreColor(c.id))}"><i style="background:${esc(c.hex)}"></i><span>${esc(M.nombreColor(c.id))}</span></button>`).join("")}</div>`;
function formulario() {
  const x = cola[i], d = datos;
  const foto = d.fotos[0];
  const deFoto = x && x.colores && x.colores.length && !editando;
  const html = `<form class="ro-form" novalidate>
    ${foto ? `<div class="ro-form-foto"><img src="${esc(foto.mini)}" data-foto="${esc(foto.id)}" alt="La foto de la prenda"></div>` : ""}
    ${x && x.error ? `<p class="lib-error">${esc(x.error)} Puedes guardarla sin foto o saltarla.</p>` : ""}
    <fieldset class="ro-campo"><legend>Grupo</legend><div class="ro-opciones" data-grupo="grupo">${M.GRUPOS.map(g => radio("grupo", g.id, g.nombre, d.grupo === g.id)).join("")}</div>${err("grupo")}</fieldset>
    <fieldset class="ro-campo"><legend>Qué es</legend><div class="ro-opciones" data-grupo="tipo" data-ro-tipos>${tiposHTML(d.grupo, d.tipo)}</div>${err("tipo")}</fieldset>
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
  Object.assign(datos, {
    grupo: g, tipo, estampado: v("estampado"), tela: v("tela").trim(), estilo: marcadas("estilo"), clima: marcadas("clima"),
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
    quitarError("grupo");
  } else if (t.name === "tipo") {
    const otro = form().elements.tipoOtro;
    if (otro) { otro.hidden = t.value !== "__otro"; if (!otro.hidden) otro.focus(); }
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
function alClic(e) {
  const q = e.target.closest("[data-ro-quitar]");
  if (q) { datos.colores = datos.colores.filter(c => c.id !== q.dataset.roQuitar); pintarColores(); return; }
  const pal = e.target.closest("[data-ro-paleta]");
  if (pal) {
    const l = form().querySelector("[data-ro-paleta-lista]");
    l.hidden = !l.hidden;
    pal.setAttribute("aria-expanded", String(!l.hidden));
    return;
  }
  const c = e.target.closest("[data-ro-color]");
  if (c) {
    if (!datos.colores.some(x => x.id === c.dataset.roColor) && datos.colores.length < 3) datos.colores.push({ id: c.dataset.roColor });
    form().querySelector("[data-ro-paleta-lista]").hidden = true;
    pintarColores();
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
function editar(id, desde) {
  const p = D.una(id);
  if (!p) return;
  editando = id; cola = []; i = 0; fotoNueva = null;
  datos = Object.assign(vacio(), {
    grupo: p.grupo, tipo: p.tipo, colores: p.colores.map(c => ({ id: c.id, peso: c.peso })), estampado: p.estampado || "liso", tela: p.tela,
    estilo: p.estilo.slice(), clima: p.clima.slice(), formalidad: p.formalidad, marca: p.marca, talla: p.talla,
    precio: p.precio != null ? String(p.precio) : "", compra: p.compra, notas: p.notas, fotos: p.fotos.map(f => Object.assign({}, f))
  });
  formulario();
  if (desde) H().volver = desde;
}

window.RopaForm = { agregar, editar, coloresDe };
})();
