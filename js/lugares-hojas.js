// ---------- Lugares: detalle y formularios (hojas que suben desde abajo) ----------
// D-117. Detalle de un lugar (fotos, calificación y desglose, platos,
// visitas, etiquetas, notas y Google Maps) y los formularios de lugar,
// plato y visita. Lo escrito se guarda como borrador mientras escribes: si
// cierras la hoja sin querer, al volver a abrirla sigue ahí. Borrar platos,
// visitas o lugares: al instante, con "Deshacer" 5 s (nunca confirm()).
// Usa window.LugaresApp (js/lugares.js), LugaresMotor y LugaresFotos.
(function () {
"use strict";
const M = window.LugaresMotor, F = window.LugaresFotos;
const A = () => window.LugaresApp;
if (!M || !window.Lectura || !document.getElementById("lug-app")) return;
const { esc, hoyLocal } = window.Lectura;
const borrarCampo = () => firebase.firestore.FieldValue.delete();
const icono = (n) => `<span data-icon="${n}" aria-hidden="true"></span>`;
const pintar = el => { if (typeof renderIcons === "function") renderIcons(el); };

// ---------- Borradores (localStorage: solo texto e ids de fotos) ----------
const CLAVE = "manolo.lugares.borradores";
function borradores() { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}"); } catch (e) { return {}; } }
function borrador(ctx, datos) {
  const b = borradores();
  if (datos === undefined) return b[ctx] || null;
  if (datos) b[ctx] = Object.assign(datos, { t: Date.now() }); else delete b[ctx];
  try { localStorage.setItem(CLAVE, JSON.stringify(b)); } catch (e) { /* sin almacenamiento: no hay borrador */ }
  return null;
}
// Los campos de texto del formulario (por nombre).
function textos(form) {
  const o = {};
  form.querySelectorAll("input[name], textarea[name]").forEach(el => { o[el.name] = el.type === "checkbox" ? el.checked : el.value; });
  return o;
}
function ponerTextos(form, o) {
  Object.keys(o || {}).forEach(k => {
    const el = form.querySelector(`[name="${k}"]`);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!o[k]; else el.value = o[k] == null ? "" : o[k];
  });
}

// ---------- Errores en línea (junto a cada campo y arriba) ----------
function mostrarErrores(form, lista) {
  form.querySelectorAll("[data-err]").forEach(el => { el.hidden = true; el.textContent = ""; });
  form.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
  lista.forEach(e => {
    const msg = form.querySelector(`[data-err="${e.campo}"]`);
    if (msg) { msg.textContent = e.texto; msg.hidden = false; }
    const campo = form.querySelector(`[name="${e.campo}"], [data-grupo="${e.campo}"]`);
    if (campo) campo.setAttribute("aria-invalid", "true");
  });
  const resumen = form.querySelector(".lib-error");
  if (resumen) { resumen.textContent = lista.length ? "Revisa lo marcado." : ""; resumen.hidden = !lista.length; }
  const primero = lista.length && form.querySelector(`[name="${lista[0].campo}"], [data-grupo="${lista[0].campo}"] button`);
  if (primero) { primero.focus({ preventScroll: true }); primero.scrollIntoView({ block: "center", behavior: "smooth" }); }
}
const errorDe = campo => `<small class="lug-err" data-err="${campo}" id="err-${campo}" hidden></small>`;

// Estrellas (1–5) como grupo de opciones accesible.
function estrellasHTML(grupo, valor, etiqueta, chicas) {
  return `<div class="lug-estrellas${chicas ? " is-chicas" : ""}" role="radiogroup" aria-label="${esc(etiqueta)}" data-grupo="${grupo}" aria-describedby="err-${grupo}">${[1, 2, 3, 4, 5].map(n => `
    <button type="button" class="lug-estrella${valor >= n ? " is-on" : ""}" role="radio" aria-checked="${valor === n}" aria-label="${n} ${n === 1 ? "estrella" : "estrellas"}" data-estrella="${n}" tabindex="${(valor || 1) === n ? 0 : -1}"><span aria-hidden="true">★</span></button>`).join("")}</div>`;
}
function marcarEstrellas(g, n) {
  g.querySelectorAll("[data-estrella]").forEach(b => {
    const k = Number(b.dataset.estrella);
    b.classList.toggle("is-on", n >= k);
    b.setAttribute("aria-checked", String(n === k));
    b.tabIndex = (n || 1) === k ? 0 : -1;
  });
}
// Opciones de un toque (segmentos): [{ v, t, ic }].
function segHTML(grupo, ops, valor, etiqueta) {
  return `<div class="lug-seg" role="radiogroup" aria-label="${esc(etiqueta)}" data-grupo="${grupo}" aria-describedby="err-${grupo}">${ops.map(o => `
    <button type="button" class="lug-seg-op${o.clase ? ` ${o.clase}` : ""}${String(valor) === String(o.v) ? " is-sel" : ""}" role="radio" aria-checked="${String(valor) === String(o.v)}" data-seg="${esc(o.v)}">${o.ic ? icono(o.ic) : ""}${esc(o.t)}</button>`).join("")}</div>`;
}
function marcarSeg(g, v) { g.querySelectorAll("[data-seg]").forEach(b => { const s = b.dataset.seg === String(v); b.classList.toggle("is-sel", s); b.setAttribute("aria-checked", String(s)); }); }
const VOLV_OPS = [{ v: "si", t: "Sí", ic: "check", clase: "is-si" }, { v: "tal_vez", t: "Tal vez", ic: "quizas", clase: "is-tal_vez" }, { v: "no", t: "No", ic: "close", clase: "is-no" }];

// ---------- Formulario de lugar (nuevo, editar o "Ya fui") ----------
// o: { estado: "visitado"|"quiero", yaFui: true }
function formLugar(id, o) {
  const opc = o || {};
  const l = id ? A().uno(id) : null;
  if (id && !l) return;
  const ctx = id ? `${opc.yaFui ? "y" : "e"}:${id}` : "nuevo";
  const guardado = borrador(ctx);
  const base = l || { estado: opc.estado === "quiero" ? "quiero" : "visitado", desglose: {}, fotos: [], etiquetas: [] };
  const st = {
    estado: opc.yaFui ? "visitado" : base.estado,
    calificacion: base.calificacion || null, volveria: base.volveria || null, precio: base.precio || null, tipo: base.tipo || null,
    desglose: Object.assign({}, base.desglose), fotos: base.fotos.map(f => Object.assign({}, f)), nuevas: [], quitadas: []
  };
  if (guardado && guardado.st) {
    const g = guardado.st;
    ["estado", "calificacion", "volveria", "precio", "tipo"].forEach(k => { if (k in g) st[k] = g[k]; });
    if (g.desglose) st.desglose = Object.assign({}, g.desglose);
    st.nuevas = Array.isArray(g.nuevas) ? g.nuevas.slice() : [];
    st.quitadas = Array.isArray(g.quitadas) ? g.quitadas.slice() : [];
    if (Array.isArray(g.fotos)) {
      const delDoc = new Map(base.fotos.map(f => [f.id, f]));
      st.fotos = g.fotos.filter(fid => typeof fid === "string").map(fid => (delDoc.get(fid) ? Object.assign({}, delDoc.get(fid)) : { id: fid, mini: null, ancho: 0, alto: 0 }));
    }
  }
  const nuevo = !id || opc.yaFui;      // ofrece "Fui hoy"
  const h = A().hoja("lug-hoja-form");
  const titulo = opc.yaFui ? `¿Qué tal ${l.nombre}?` : id ? "Editar lugar" : "Nuevo lugar";
  h.mostrar(titulo, `<form class="lug-form" novalidate>
    ${guardado ? `<p class="lug-borrador">Seguimos con lo que habías escrito. <button type="button" class="lug-link" data-f="descartar">Empezar de cero</button></p>` : ""}
    <label class="lib-campo"><span>Nombre</span><input name="nombre" class="lib-input" autocomplete="off" maxlength="${M.MAX.nombre}" enterkeyhint="next" aria-describedby="err-nombre" value="${esc(base.nombre && base.nombre !== "Sin nombre" ? base.nombre : "")}">${errorDe("nombre")}</label>
    ${opc.yaFui ? "" : `<div class="lug-campo"><span class="lug-label" id="lbl-estado">¿Ya fuiste?</span>${segHTML("estado", [{ v: "visitado", t: "Sí, ya fui" }, { v: "quiero", t: "Quiero ir" }], st.estado, "¿Ya fuiste?")}</div>`}
    <div class="lug-solo-visitado"${st.estado === "quiero" ? " hidden" : ""}>
      <div class="lug-campo"><span class="lug-label">Calificación</span>${estrellasHTML("calificacion", st.calificacion, "Calificación general")}${errorDe("calificacion")}</div>
      <div class="lug-campo"><span class="lug-label">¿Volverías?</span>${segHTML("volveria", VOLV_OPS, st.volveria, "¿Volverías?")}${errorDe("volveria")}</div>
      ${nuevo ? `<label class="lug-check"><input type="checkbox" name="fuiHoy"${!guardado || (guardado.textos && guardado.textos.fuiHoy) ? " checked" : ""}> Fui hoy (anotar la visita)</label>
      <label class="lib-campo lug-gasto-hoy"><span>¿Cuánto gastaste hoy? (opcional)</span><input name="gastoHoy" class="lib-input" inputmode="decimal" autocomplete="off" placeholder="Bs" aria-describedby="err-gastoHoy">${errorDe("gastoHoy")}</label>` : ""}
    </div>
    <button type="button" class="lug-mas" data-f="mas" aria-expanded="false" aria-controls="lug-mas">Más detalles${icono("chevronDown")}</button>
    <div class="lug-mas-cuerpo" id="lug-mas" hidden>
      <div class="lug-campo"><span class="lug-label">Tipo</span><div class="lug-tipos" role="radiogroup" aria-label="Tipo de lugar" data-grupo="tipo">${M.TIPOS.map(t => `<button type="button" class="lug-mini-chip${st.tipo === t.id ? " is-sel" : ""}" role="radio" aria-checked="${st.tipo === t.id}" data-tipo="${t.id}">${t.emoji} ${esc(t.nombre)}</button>`).join("")}</div></div>
      <label class="lib-campo"><span>Zona</span><input name="zona" class="lib-input" list="lug-zonas" autocomplete="off" maxlength="${M.MAX.zona}" value="${esc(base.zona || "")}" placeholder="Ej.: Sopocachi"><datalist id="lug-zonas">${A().zonas().map(z => `<option value="${esc(z)}">`).join("")}</datalist></label>
      <label class="lib-campo"><span>Qué venden / especialidad</span><input name="especialidad" class="lib-input" autocomplete="off" maxlength="${M.MAX.especialidad}" value="${esc(base.especialidad || "")}" placeholder="Ej.: salteñas, café de altura"></label>
      <div class="lug-campo"><span class="lug-label">Precio</span>${segHTML("precio", [{ v: "1", t: "$" }, { v: "2", t: "$$" }, { v: "3", t: "$$$" }], st.precio || "", "Nivel de precio")}<small class="lib-ayuda">Toca otra vez para quitarlo.</small></div>
      <label class="lib-campo"><span>Gasto aproximado por persona (Bs)</span><input name="gastoAprox" class="lib-input" inputmode="decimal" autocomplete="off" value="${base.gastoAproxCent != null ? esc(String(base.gastoAproxCent / 100).replace(".", ",")) : ""}" aria-describedby="err-gastoAprox">${errorDe("gastoAprox")}</label>
      <div class="lug-solo-visitado lug-campo"${st.estado === "quiero" ? " hidden" : ""}><span class="lug-label">Calificación por partes</span>${M.DESGLOSE.map(x => `<div class="lug-desglose"><span>${esc(x.nombre)}</span>${estrellasHTML(`d-${x.id}`, st.desglose[x.id], x.nombre, true)}</div>`).join("")}</div>
      <div class="lug-campo"><span class="lug-label">Fotos</span><div class="lug-fotos-form" data-fotos></div>
        <label class="lib-btn-sec lug-foto-btn">${icono("camera")}Agregar foto<input type="file" accept="image/*" data-f="foto" class="lug-oculto"></label>
        <small class="lib-ayuda">Se guardan en este teléfono (achicadas); en la nube queda una miniatura.</small>${errorDe("fotos")}</div>
      <label class="lib-campo"><span>Link de Google Maps</span><input name="maps" class="lib-input" type="url" inputmode="url" autocomplete="off" value="${esc(base.maps || "")}" placeholder="https://maps.app.goo.gl/…" aria-describedby="err-maps">${errorDe("maps")}</label>
      <label class="lib-campo"><span>Etiquetas (separadas por coma)</span><input name="etiquetas" class="lib-input" autocomplete="off" value="${esc((base.etiquetas || []).join(", "))}" placeholder="Ej.: familia, barato, vegano"></label>
      <label class="lib-campo"><span>Notas</span><textarea name="notas" class="lib-input" rows="3" maxlength="${M.MAX.notas}">${esc(base.notas || "")}</textarea></label>
    </div>
    <p class="lib-error" role="alert" hidden></p>
    <button type="submit" class="lib-btn lib-btn-ancho lug-guardar">Guardar</button>
  </form>`, guardado ? null : 'input[name="nombre"]');
  const form = h.el.querySelector(".lug-form");
  if (guardado) ponerTextos(form, guardado.textos);
  const masAbierto = guardado ? guardado.mas : (id && !opc.yaFui && (base.tipo || base.zona || base.notas || base.fotos.length));
  if (masAbierto) abrirMas(form, true);
  pintarFotos(form, st);
  // Las fotos nuevas del borrador: su miniatura vuelve del teléfono (IndexedDB).
  st.fotos.filter(f => !f.mini).forEach(f => {
    if (!F) return;
    F.leer(f.id).then(r => {
      if (r) Object.assign(f, { mini: r.mini, ancho: r.ancho, alto: r.alto }); else st.fotos = st.fotos.filter(x => x.id !== f.id);
      pintarFotos(form, st);
    }).catch(() => {});
  });
  // 2. Una vez guardado (o descartado) ya no se escribe el borrador, aunque
  // quede algo pendiente de escribir.
  let cerrado = false, relojB = null;
  const guardarBorr = () => { if (cerrado) return; borrador(ctx, { st: { estado: st.estado, calificacion: st.calificacion, volveria: st.volveria, precio: st.precio, tipo: st.tipo, desglose: st.desglose, fotos: st.fotos.map(f => f.id), nuevas: st.nuevas, quitadas: st.quitadas }, textos: textos(form), mas: !form.querySelector("#lug-mas").hidden }); };
  const tocar = () => { if (cerrado) return; clearTimeout(relojB); relojB = setTimeout(guardarBorr, 250); };
  form.addEventListener("input", tocar);
  form.addEventListener("change", e => { if (!e.target.matches('[data-f="foto"]')) tocar(); });
  form.addEventListener("click", e => {
    const est = e.target.closest("[data-estrella]");
    if (est) {
      const g = est.closest("[data-grupo]"), n = Number(est.dataset.estrella), grupo = g.dataset.grupo;
      if (grupo === "calificacion") st.calificacion = n; else st.desglose[grupo.slice(2)] = st.desglose[grupo.slice(2)] === n ? null : n;
      marcarEstrellas(g, grupo === "calificacion" ? n : st.desglose[grupo.slice(2)] || 0);
      tocar(); return;
    }
    const seg = e.target.closest("[data-seg]");
    if (seg) {
      const g = seg.closest("[data-grupo]"), v = seg.dataset.seg;
      if (g.dataset.grupo === "estado") {
        st.estado = v;
        form.querySelectorAll(".lug-solo-visitado").forEach(x => { x.hidden = v === "quiero"; });
      } else if (g.dataset.grupo === "volveria") st.volveria = v;
      else if (g.dataset.grupo === "precio") st.precio = String(st.precio) === v ? null : Number(v);
      marcarSeg(g, g.dataset.grupo === "precio" ? (st.precio || "") : v);
      tocar(); return;
    }
    const tipo = e.target.closest("[data-tipo]");
    if (tipo) {
      st.tipo = st.tipo === tipo.dataset.tipo ? null : tipo.dataset.tipo;
      form.querySelectorAll("[data-tipo]").forEach(b => { const s = b.dataset.tipo === st.tipo; b.classList.toggle("is-sel", s); b.setAttribute("aria-checked", String(s)); });
      tocar(); return;
    }
    const quitar = e.target.closest("[data-quitar-foto]");
    if (quitar) {
      const fid = quitar.dataset.quitarFoto;
      st.fotos = st.fotos.filter(f => f.id !== fid);
      if (st.nuevas.includes(fid)) { st.nuevas = st.nuevas.filter(x => x !== fid); if (F) F.borrar(fid).catch(() => {}); } else st.quitadas.push(fid);
      pintarFotos(form, st); tocar(); return;
    }
    const f = e.target.closest("[data-f]");
    if (!f) return;
    if (f.dataset.f === "mas") { abrirMas(form, form.querySelector("#lug-mas").hidden); tocar(); }
    else if (f.dataset.f === "descartar") {
      cerrado = true; clearTimeout(relojB);
      st.nuevas.forEach(fid => { if (F) F.borrar(fid).catch(() => {}); });
      borrador(ctx, null);
      h.cerrar();
      setTimeout(() => formLugar(id, opc), 230);
    }
  });
  // Teclado en las estrellas: flechas como en un grupo de opciones.
  form.addEventListener("keydown", e => {
    const est = e.target.closest("[data-estrella]");
    if (!est || !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const n = Math.min(5, Math.max(1, Number(est.dataset.estrella) + (e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1)));
    const nuevo = est.closest("[data-grupo]").querySelector(`[data-estrella="${n}"]`);
    nuevo.focus(); nuevo.click();
  });
  form.querySelector('[data-f="foto"]').addEventListener("change", e => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!archivo || !F) return;
    if (st.fotos.length >= M.MAX.fotos) { mostrarErrores(form, [{ campo: "fotos", texto: `Hasta ${M.MAX.fotos} fotos por lugar.` }]); return; }
    const caja = form.querySelector("[data-fotos]");
    caja.insertAdjacentHTML("beforeend", `<span class="lug-foto-mini is-cargando" aria-label="Preparando foto">…</span>`);
    F.agregar(archivo, "borrador").then(reg => {
      st.fotos.push({ id: reg.id, mini: reg.mini, ancho: reg.ancho, alto: reg.alto });
      st.nuevas.push(reg.id);
      pintarFotos(form, st); guardarBorr();
    }).catch(err => { pintarFotos(form, st); mostrarErrores(form, [{ campo: "fotos", texto: err.message || "No pude guardar la foto." }]); });
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const t = textos(form);
    const v = M.validarLugar(Object.assign({}, t, { estado: st.estado, calificacion: st.calificacion, volveria: st.volveria, precio: st.precio, tipo: st.tipo, desglose: st.desglose }));
    const gastoHoyCent = nuevo && t.fuiHoy && st.estado === "visitado" ? M.aCent(t.gastoHoy) : null;
    const errs = v.errores.slice();
    if (Number.isNaN(gastoHoyCent)) errs.push({ campo: "gastoHoy", texto: "Escribe el gasto como número (por ejemplo 85,50)." });
    if (errs.length) { if (errs.some(x => ["gastoAprox", "maps"].includes(x.campo))) abrirMas(form, true); mostrarErrores(form, errs); return; }
    const ahora = Date.now(), hoy = hoyLocal(), App = A();
    const fotos = st.fotos.map(f => ({ id: f.id, mini: f.mini, ancho: f.ancho, alto: f.alto }));
    const lugarId = id || M.nuevoId("l", ahora);
    let visita = null;
    if (nuevo && t.fuiHoy && st.estado === "visitado") visita = { id: M.nuevoId("v", ahora), fecha: hoy, conQuien: "", gastoCent: gastoHoyCent, nota: "", creado: ahora };
    let op;
    if (!id) {
      const doc = Object.assign(v.doc, { platos: {}, visitas: {}, fotos, creado: ahora, actualizado: ahora });
      if (visita) doc.visitas[visita.id] = sinId(visita);
      op = App.ref().doc(lugarId).set(doc);
    } else {
      const cambios = Object.assign(v.doc, { fotos, actualizado: ahora });
      if (visita) cambios[`visitas.${visita.id}`] = sinId(visita);
      op = App.ref().doc(lugarId).update(cambios);
    }
    op.catch(App.fallo);
    if (F) {
      F.mover(st.nuevas, lugarId).catch(() => {});
      st.quitadas.forEach(fid => F.borrar(fid).catch(() => {}));
    }
    cerrado = true; clearTimeout(relojB);
    borrador(ctx, null);
    h.cerrar();
    App.aviso(opc.yaFui ? `«${v.doc.nombre}» pasó a Visitados.` : `Guardado: «${v.doc.nombre}».`);
    if (visita && visita.gastoCent > 0) setTimeout(() => ofrecerFinanzas(v.doc.nombre, visita), 260);
  });
}
const sinId = o => { const c = Object.assign({}, o); delete c.id; return c; };
function abrirMas(form, abrir) {
  const b = form.querySelector('[data-f="mas"]'), c = form.querySelector("#lug-mas");
  c.hidden = !abrir;
  b.setAttribute("aria-expanded", String(abrir));
  b.classList.toggle("is-abierto", abrir);
}
function pintarFotos(form, st) {
  const caja = form.querySelector("[data-fotos]");
  caja.innerHTML = st.fotos.map((f, i) => `<span class="lug-foto-mini">${f.mini ? `<img src="${f.mini}" alt="Foto ${i + 1}" width="64" height="64" loading="lazy" decoding="async">` : `<span aria-hidden="true">📷</span>`}
    <button type="button" class="lug-foto-quitar" data-quitar-foto="${esc(f.id)}" aria-label="Quitar la foto ${i + 1}">${icono("close")}</button></span>`).join("");
  caja.hidden = !st.fotos.length;
  pintar(caja);
}

// ---------- ¿Lo pasas a Finanzas? (solo si confirmas) ----------
function ofrecerFinanzas(nombre, visita) {
  if (!window.FinanzasNuevo) return;
  const h = A().hoja("lug-hoja-fin");
  h.mostrar("¿Lo pasas a Finanzas?", `<div class="lug-fin">
    <p>Gastaste <strong class="an-num">${M.bs(visita.gastoCent)}</strong> en «${esc(nombre)}» el ${esc(M.fechaCorta(visita.fecha, hoyLocal()))}.</p>
    <p class="lib-ayuda">Se abre la hoja de Finanzas ya llena (categoría Comida): elige la cartera y toca Guardar. Si no, no se anota nada.</p>
    <button type="button" class="lib-btn lib-btn-ancho" data-fin="si">Agregar a Finanzas</button>
    <button type="button" class="lib-btn-sec lib-btn-ancho" data-fin="no">Ahora no</button>
  </div>`, '[data-fin="si"]');
  h.el.onclick = e => {
    const b = e.target.closest("[data-fin]");
    if (!b) return;
    h.cerrar();
    if (b.dataset.fin === "si") setTimeout(() => window.FinanzasNuevo.gasto({ montoCent: visita.gastoCent, fecha: visita.fecha, nota: nombre }), 230);
  };
}

// ---------- Plato (nuevo o editar) ----------
function formPlato(lugarId, platoId) {
  const l = A().uno(lugarId);
  if (!l) return;
  const p = platoId ? l.platos.find(x => x.id === platoId) : null;
  const ctx = `p:${lugarId}:${platoId || "nuevo"}`;
  const guardado = borrador(ctx);
  const st = { gusto: guardado && guardado.gusto !== undefined ? guardado.gusto : p ? (p.gusto === true ? "si" : p.gusto === false ? "no" : "") : "" };
  const h = A().hoja("lug-hoja-form");
  h.mostrar(p ? "Editar plato" : "Nuevo plato", `<form class="lug-form" novalidate>
    ${guardado ? `<p class="lug-borrador">Seguimos con lo que habías escrito.</p>` : ""}
    <label class="lib-campo"><span>Plato</span><input name="nombre" class="lib-input" autocomplete="off" maxlength="${M.MAX.plato}" value="${esc(p ? p.nombre : "")}" aria-describedby="err-nombre">${errorDe("nombre")}</label>
    <label class="lib-campo"><span>Precio (Bs, opcional)</span><input name="precio" class="lib-input" inputmode="decimal" autocomplete="off" value="${p && p.precioCent != null ? esc(String(p.precioCent / 100).replace(".", ",")) : ""}" aria-describedby="err-precio">${errorDe("precio")}</label>
    <div class="lug-campo"><span class="lug-label">¿Te gustó?</span>${segHTML("gusto", [{ v: "si", t: "Sí", ic: "check", clase: "is-si" }, { v: "no", t: "No", ic: "close", clase: "is-no" }], st.gusto, "¿Te gustó?")}</div>
    <label class="lib-campo"><span>Nota corta (opcional)</span><input name="nota" class="lib-input" autocomplete="off" maxlength="${M.MAX.notaPlato}" value="${esc(p ? p.nota : "")}"></label>
    <label class="lug-check"><input type="checkbox" name="favorito"${p && p.favorito ? " checked" : ""}> Mi favorito de aquí</label>
    <p class="lib-error" role="alert" hidden></p>
    <button type="submit" class="lib-btn lib-btn-ancho">Guardar plato</button>
    ${p ? `<button type="button" class="lib-btn-peligro lib-btn-ancho" data-f="borrar">Eliminar plato</button>` : ""}
  </form>`, guardado ? null : 'input[name="nombre"]');
  const form = h.el.querySelector(".lug-form");
  if (guardado) ponerTextos(form, guardado.textos);
  let cerrado = false;
  const tocar = () => { if (!cerrado) borrador(ctx, { gusto: st.gusto, textos: textos(form) }); };
  form.addEventListener("input", tocar);
  form.addEventListener("change", tocar);
  form.addEventListener("click", e => {
    const seg = e.target.closest("[data-seg]");
    if (seg) { st.gusto = st.gusto === seg.dataset.seg ? "" : seg.dataset.seg; marcarSeg(seg.closest("[data-grupo]"), st.gusto); tocar(); return; }
    if (e.target.closest('[data-f="borrar"]')) {
      const App = A(), antes = App.crudo(lugarId) && App.crudo(lugarId).platos && App.crudo(lugarId).platos[platoId];
      App.ref().doc(lugarId).update({ [`platos.${platoId}`]: borrarCampo(), actualizado: Date.now() }).catch(App.fallo);
      cerrado = true;
      borrador(ctx, null);
      h.cerrar();
      App.aviso(`Borraste «${p.nombre}».`, () => App.ref().doc(lugarId).update({ [`platos.${platoId}`]: antes }).catch(App.fallo));
    }
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const t = textos(form);
    const v = M.validarPlato({ nombre: t.nombre, precio: t.precio, gusto: st.gusto, nota: t.nota, favorito: t.favorito });
    if (!v.ok) { mostrarErrores(form, v.errores); return; }
    const App = A(), ahora = Date.now(), pid = platoId || M.nuevoId("p", ahora);
    const cambios = { [`platos.${pid}`]: Object.assign(v.plato, { creado: p ? p.creado || ahora : ahora }), actualizado: ahora };
    // Un solo favorito por lugar.
    if (v.plato.favorito) l.platos.filter(x => x.favorito && x.id !== pid).forEach(x => { cambios[`platos.${x.id}.favorito`] = false; });
    App.ref().doc(lugarId).update(cambios).catch(App.fallo);
    cerrado = true;
    borrador(ctx, null);
    h.cerrar();
    App.aviso(`Plato guardado: «${v.plato.nombre}».`);
    setTimeout(() => detalle(lugarId), 230);
  });
}

// ---------- Visita (nueva o editar) ----------
function formVisita(lugarId, visitaId) {
  const l = A().uno(lugarId);
  if (!l) return;
  const vi = visitaId ? l.visitas.find(x => x.id === visitaId) : null;
  const ctx = `v:${lugarId}:${visitaId || "nueva"}`;
  const guardado = borrador(ctx);
  const hoy = hoyLocal();
  const h = A().hoja("lug-hoja-form");
  h.mostrar(vi ? "Editar visita" : "Nueva visita", `<form class="lug-form" novalidate>
    ${guardado ? `<p class="lug-borrador">Seguimos con lo que habías escrito.</p>` : ""}
    <label class="lib-campo"><span>Fecha</span><input name="fecha" type="date" class="lib-input" max="${hoy}" value="${esc(vi ? vi.fecha : hoy)}" aria-describedby="err-fecha">${errorDe("fecha")}</label>
    <label class="lib-campo"><span>¿Con quién? (opcional)</span><input name="conQuien" class="lib-input" autocomplete="off" maxlength="${M.MAX.conQuien}" value="${esc(vi ? vi.conQuien : "")}"></label>
    <label class="lib-campo"><span>Gasto (Bs, opcional)</span><input name="gasto" class="lib-input" inputmode="decimal" autocomplete="off" value="${vi && vi.gastoCent != null ? esc(String(vi.gastoCent / 100).replace(".", ",")) : ""}" aria-describedby="err-gasto">${errorDe("gasto")}</label>
    <label class="lib-campo"><span>Nota (opcional)</span><input name="nota" class="lib-input" autocomplete="off" maxlength="${M.MAX.notaVisita}" value="${esc(vi ? vi.nota : "")}"></label>
    <p class="lib-error" role="alert" hidden></p>
    <button type="submit" class="lib-btn lib-btn-ancho">Guardar visita</button>
    ${vi ? `<button type="button" class="lib-btn-peligro lib-btn-ancho" data-f="borrar">Eliminar visita</button>` : ""}
  </form>`, guardado ? null : 'input[name="conQuien"]');
  const form = h.el.querySelector(".lug-form");
  if (guardado) ponerTextos(form, guardado.textos);
  let cerrado = false;
  const tocar = () => { if (!cerrado) borrador(ctx, { textos: textos(form) }); };
  form.addEventListener("input", tocar);
  form.addEventListener("change", tocar);
  form.addEventListener("click", e => {
    if (!e.target.closest('[data-f="borrar"]')) return;
    const App = A(), antes = App.crudo(lugarId) && App.crudo(lugarId).visitas && App.crudo(lugarId).visitas[visitaId];
    App.ref().doc(lugarId).update({ [`visitas.${visitaId}`]: borrarCampo(), actualizado: Date.now() }).catch(App.fallo);
    cerrado = true;
    borrador(ctx, null);
    h.cerrar();
    App.aviso("Borraste la visita.", () => App.ref().doc(lugarId).update({ [`visitas.${visitaId}`]: antes }).catch(App.fallo));
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const v = M.validarVisita(textos(form), hoyLocal());
    if (!v.ok) { mostrarErrores(form, v.errores); return; }
    const App = A(), ahora = Date.now(), vid = visitaId || M.nuevoId("v", ahora);
    const datos = Object.assign(v.visita, { creado: vi ? vi.creado || ahora : ahora });
    const cambios = { [`visitas.${vid}`]: datos, actualizado: ahora };
    App.ref().doc(lugarId).update(cambios).catch(App.fallo);
    cerrado = true;
    borrador(ctx, null);
    h.cerrar();
    App.aviso("Visita guardada.");
    // Un gasto nuevo (o que cambió) se puede pasar a Finanzas.
    if (datos.gastoCent > 0 && (!vi || vi.gastoCent !== datos.gastoCent)) setTimeout(() => ofrecerFinanzas(l.nombre, datos), 260);
    else setTimeout(() => detalle(lugarId), 230);
  });
}

// ---------- Detalle ----------
let abierto = null;   // el lugar cuyo detalle está abierto
function detalle(id, refresco) {
  const App = A(), l = App.uno(id);
  if (!l) return;
  abierto = id;
  const hoy = hoyLocal(), r = M.resumenVisitas(l), fav = M.favorito(l);
  const f0 = l.fotos[0];
  const fotos = l.fotos.length ? `<div class="lug-det-fotos">
      <img class="lug-det-img" data-foto-grande="${esc(f0.id)}" src="${f0.mini || ""}" alt="Foto de ${esc(l.nombre)}" width="${f0.ancho || 1200}" height="${f0.alto || 900}" decoding="async">
      ${l.fotos.length > 1 ? `<div class="lug-det-miniaturas">${l.fotos.map((f, i) => `<button type="button" class="lug-det-mini${i === 0 ? " is-sel" : ""}" data-ver-foto="${esc(f.id)}" aria-label="Ver la foto ${i + 1}" aria-pressed="${i === 0}">${f.mini ? `<img src="${f.mini}" alt="" width="56" height="56" loading="lazy" decoding="async">` : "📷"}</button>`).join("")}</div>` : ""}
    </div>` : `<div class="lug-det-sinfoto" aria-hidden="true">${l.tipo ? M.TIPO[l.tipo].emoji : "📍"}</div>`;
  const estrellas = n => `<span class="lug-det-estrellas" role="img" aria-label="${n} de 5 estrellas">${"★".repeat(n)}<span class="is-vacia">${"★".repeat(5 - n)}</span></span>`;
  const desglose = M.DESGLOSE.filter(x => l.desglose[x.id]);
  const gastoAprox = l.gastoAproxCent != null ? `Gasto aprox. ${M.bs(l.gastoAproxCent)}` : "";
  const meta = [App.metaHTML(l), esc(gastoAprox)].filter(Boolean).join(" · ");
  const h = App.hoja("lug-hoja-det");
  (refresco ? h.abrir : h.mostrar)(l.nombre, `<div class="lug-det">
    ${fotos}
    ${l.estado === "visitado" ? `<div class="lug-det-cab">${l.calificacion ? `<p class="lug-det-cal">${estrellas(l.calificacion)}<span class="an-num"><b>${l.calificacion}</b>/5</span></p>` : ""}${App.volvHTML(l.volveria)}</div>`
      : `<div class="lug-det-quiero"><p>Todavía no fuiste. Cuando vayas, califícalo.</p><button type="button" class="lib-btn" data-d="yafui">Ya fui</button></div>`}
    ${meta ? `<p class="lug-meta">${meta}</p>` : ""}
    ${l.especialidad ? `<p class="lug-det-txt"><span class="lug-det-et">Qué venden:</span> ${esc(l.especialidad)}</p>` : ""}
    ${fav ? `<p class="lug-det-txt"><span class="lug-det-et">Tu favorito de aquí:</span> <strong>${esc(fav.nombre)}</strong></p>` : ""}
    <section class="lug-det-sec" aria-labelledby="lug-det-vis">
      <div class="lug-det-sec-cab"><h4 id="lug-det-vis">Visitas</h4>${l.estado === "visitado" ? `<button type="button" class="lug-add" data-d="visita">${icono("plus")}Visita</button>` : ""}</div>
      <p class="lug-det-resumen">${r.veces ? `Fuiste ${r.veces} ${r.veces === 1 ? "vez" : "veces"} · última: ${esc(M.fechaCorta(r.ultima, hoy))}${r.gastoCent ? ` · en total ${M.bs(r.gastoCent)}` : ""}` : "Sin visitas anotadas."}</p>
      ${l.visitas.length ? `<ul class="lug-det-lista">${l.visitas.map(v => `<li><button type="button" class="lug-det-fila" data-editar-visita="${esc(v.id)}"><span class="lug-det-fila-t">${esc(M.fechaCorta(v.fecha, hoy))}${v.conQuien ? ` · con ${esc(v.conQuien)}` : ""}</span>${v.gastoCent != null ? `<span class="an-num">${M.bs(v.gastoCent)}</span>` : ""}${v.nota ? `<span class="lug-det-fila-n">${esc(v.nota)}</span>` : ""}</button></li>`).join("")}</ul>` : ""}
    </section>
    <section class="lug-det-sec" aria-labelledby="lug-det-pla">
      <div class="lug-det-sec-cab"><h4 id="lug-det-pla">Platos</h4><button type="button" class="lug-add" data-d="plato">${icono("plus")}Plato</button></div>
      ${l.platos.length ? `<ul class="lug-det-lista">${l.platos.map(p => `<li><button type="button" class="lug-det-fila" data-editar-plato="${esc(p.id)}"><span class="lug-det-fila-t">${p.favorito ? `<span class="lug-fav">★ Mi favorito</span> ` : ""}${esc(p.nombre)}</span>${p.precioCent != null ? `<span class="an-num">${M.bs(p.precioCent)}</span>` : ""}${p.gusto != null ? `<span class="lug-gusto is-${p.gusto ? "si" : "no"}">${icono(p.gusto ? "check" : "close")}${p.gusto ? "Me gustó" : "No me gustó"}</span>` : ""}${p.nota ? `<span class="lug-det-fila-n">${esc(p.nota)}</span>` : ""}</button></li>`).join("")}</ul>` : `<p class="lug-det-resumen">Anota lo que probaste y si te gustó.</p>`}
    </section>
    ${desglose.length ? `<section class="lug-det-sec" aria-labelledby="lug-det-des"><h4 id="lug-det-des">Calificación por partes</h4><ul class="lug-det-des">${desglose.map(x => `<li><span>${esc(x.nombre)}</span>${estrellas(l.desglose[x.id])}</li>`).join("")}</ul></section>` : ""}
    ${l.etiquetas.length ? `<p class="lug-det-etiquetas">${l.etiquetas.map(t => `<span class="lug-etiqueta">#${esc(t)}</span>`).join("")}</p>` : ""}
    ${l.notas ? `<section class="lug-det-sec"><h4>Notas</h4><p class="lug-det-notas">${esc(l.notas)}</p></section>` : ""}
    ${l.maps ? `<a class="lib-btn-sec lib-btn-ancho lug-maps" href="${esc(l.maps)}" target="_blank" rel="noopener">Abrir en Google Maps${icono("externo")}</a>` : ""}
    <div class="lug-det-acciones">
      <button type="button" class="lib-btn-sec" data-d="editar">${icono("edit")}Editar</button>
      <button type="button" class="lib-btn-peligro" data-d="borrar">${icono("trash")}Eliminar</button>
    </div>
  </div>`);
  // La foto completa (si está en este teléfono) reemplaza la miniatura.
  const grande = h.el.querySelector("[data-foto-grande]");
  const verFoto = fid => {
    const f = l.fotos.find(x => x.id === fid);
    if (!grande || !f) return;
    grande.src = f.mini || "";
    grande.dataset.fotoGrande = fid;
    if (F) F.url(fid).then(u => { if (u && grande.dataset.fotoGrande === fid) grande.src = u; });
  };
  if (grande) verFoto(f0.id);
  h.el.onclick = e => {
    const vf = e.target.closest("[data-ver-foto]");
    if (vf) {
      verFoto(vf.dataset.verFoto);
      h.el.querySelectorAll("[data-ver-foto]").forEach(b => { const s = b === vf; b.classList.toggle("is-sel", s); b.setAttribute("aria-pressed", String(s)); });
      return;
    }
    const ev = e.target.closest("[data-editar-visita]"), ep = e.target.closest("[data-editar-plato]"), d = e.target.closest("[data-d]");
    const luego = fn => { h.cerrar(); setTimeout(fn, 230); };
    if (ev) luego(() => formVisita(id, ev.dataset.editarVisita));
    else if (ep) luego(() => formPlato(id, ep.dataset.editarPlato));
    else if (d) {
      const a = d.dataset.d;
      if (a === "visita") luego(() => formVisita(id));
      else if (a === "plato") luego(() => formPlato(id));
      else if (a === "editar") luego(() => formLugar(id));
      else if (a === "yafui") luego(() => formLugar(id, { yaFui: true }));
      else if (a === "borrar") { h.cerrar(); App.borrarLugar(id); }
    }
  };
}
// Si el lugar cambia mientras miras su detalle (otro teléfono, Deshacer), se
// actualiza en su lugar, sin mover el foco ni el desplazamiento.
window.addEventListener("lugares:datos", () => {
  const h = A().hoja("lug-hoja-det");
  if (!abierto || !h.abierta()) return;
  if (!A().uno(abierto)) { h.cerrar(); return; }
  const panel = h.el.querySelector(".budget-sheet-panel"), top = panel ? panel.scrollTop : 0;
  detalle(abierto, true);
  const nuevo = h.el.querySelector(".budget-sheet-panel");
  if (nuevo) nuevo.scrollTop = top;
});

window.LugaresHojas = { detalle, formLugar, formPlato, formVisita };
})();
