// ---------- Libros: "Leer ahora" y la lectura de cada libro (pantalla, fase 4) ----------
// Cronómetro de la sesión: empieza con un toque y sigue contando con el
// teléfono bloqueado (marcas de tiempo guardadas en este teléfono); pausa
// y pantalla encendida (opcional). Al terminar: los minutos y "¿A qué
// página llegaste?" (en un audiolibro, el tiempo o el %) → la sesión queda
// en el libro y el avance de hoy también. En la ficha: tu velocidad, el
// tiempo que falta, las sesiones, Dejarlo / Retomar / Leer de nuevo y las
// lecturas anteriores. Lógica en js/libros-sesiones.js y
// js/libros-progreso.js; datos en users/{uid}/libros/{id}. D-107.
(function () {
const S = window.LibrosSesiones, P = window.LibrosProgreso, L = window.LibrosMotor;
if (!S || !P || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("lib-hoja-sesion");
const CLAVE = "manolo.libros.sesion";
const CLAVE_PANTALLA = "manolo.libros.pantalla";
const coma = n => String(n).replace(".", ",");
const r1 = n => Math.round(n * 10) / 10;

let st = leerLocal();     // la sesión en curso (o null)
let fase = "reloj";       // "reloj" | "fin" | "listo"
let seguirAlVolver = false;
let timer = null;
let candado = null, pidiendo = false;

function leerLocal() {
  try { const x = JSON.parse(localStorage.getItem(CLAVE) || "null"); return S.valido(x) ? x : null; } catch (e) { return null; }
}
function guardarLocal() {
  try { if (st) localStorage.setItem(CLAVE, JSON.stringify(st)); else localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
}
const datos = () => window.LibrosDatos || null;
const libro = id => (datos() ? datos().uno(id) : null);
const docLibro = id => db.collection("users").doc(currentUser.uid).collection("libros").doc(id);
const fallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);
function avisar() { window.dispatchEvent(new CustomEvent("libros:sesion")); }
// La sesión es de esta cuenta (si en este teléfono entró otra, no se muestra).
const uid = () => (typeof currentUser !== "undefined" && currentUser ? currentUser.uid : null);
const activa = () => (st && (!st.uid || !uid() || st.uid === uid()) ? st : null);

// ---- Campo "¿Por dónde vas?" (también lo usa "Anotar página" en js/libros.js) ----
// Papel o digital: la página. Audiolibro con duración: horas y minutos;
// sin duración: el %.
function campoAvance(l, nombre, etiqueta) {
  const m = P.medida(l), dur = P.esAudio(l) ? P.duracionDe(l) : null;
  const txt = P.avanceTexto(l);
  if (dur) {
    const [h, mm] = txt ? txt.split(":") : ["", ""];
    return `<div class="lib-campo"><span>${esc(etiqueta || "¿Por dónde vas?")} (dura ${P.hm(dur)})</span>
      <div class="lses-hm">
        <label><input type="text" inputmode="numeric" pattern="[0-9]*" name="${nombre}H" value="${esc(h)}" class="lib-input lib-input-grande" autocomplete="off" aria-label="Horas"><span>h</span></label>
        <label><input type="text" inputmode="numeric" pattern="[0-9]*" name="${nombre}M" value="${esc(mm)}" class="lib-input lib-input-grande" autocomplete="off" aria-label="Minutos"><span>min</span></label>
      </div></div>`;
  }
  const texto = m.unidad === "pct" ? `${etiqueta || "¿Qué % llevas?"} (0 a 100)` : `${etiqueta || "Voy en la página"}${m.total ? ` (de ${m.total})` : ""}`;
  return `<label class="lib-campo"><span>${esc(texto)}</span>
    <input type="text" inputmode="${m.unidad === "pct" ? "decimal" : "numeric"}" ${m.unidad === "pct" ? "" : 'pattern="[0-9]*"'} name="${nombre}" autocomplete="off" value="${esc(txt)}" class="lib-input lib-input-grande"></label>`;
}
// Lo escrito, como lo entiende LibrosProgreso.leerAvance ("142", "45" o "3:20").
function textoCampo(f, l, nombre) {
  if (P.esAudio(l) && P.duracionDe(l)) {
    const h = f.elements[`${nombre}H`].value.trim(), m = f.elements[`${nombre}M`].value.trim();
    if (!h && !m) return "";
    return P.hm((Number(h) || 0) * 60 + (Number(m) || 0));
  }
  return f.elements[nombre].value;
}
function ponerCampo(f, l, nombre, txt) {
  if (P.esAudio(l) && P.duracionDe(l)) {
    const [h, m] = String(txt).split(":");
    f.elements[`${nombre}H`].value = h || "0";
    f.elements[`${nombre}M`].value = m || "00";
    f.elements[`${nombre}H`].dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  f.elements[nombre].value = txt;
  f.elements[nombre].dispatchEvent(new Event("input", { bubbles: true }));
}
const campoError = (l, nombre) => (P.esAudio(l) && P.duracionDe(l) ? `${nombre}H` : nombre);
// Los botones +10 / +15 min / … y "Lo terminé".
function botonesSumar(l, attr) {
  const m = P.medida(l);
  return `<div class="lib-sumar" role="group" aria-label="Sumar">
    ${P.pasos(l).map(x => `<button type="button" class="lib-btn-sec lib-btn-chico" ${attr}="${x.paso}">${esc(x.texto)}</button>`).join("")}
    ${m.total ? `<button type="button" class="lib-btn-sec lib-btn-chico" ${attr}="fin">Lo terminé</button>` : ""}
  </div>`;
}
function sumar(f, l, nombre, paso) {
  ponerCampo(f, l, nombre, P.sumarAvance(l, textoCampo(f, l, nombre), paso === "fin" ? "fin" : Number(paso)));
}
// Avance en palabras: "la página 142", "3:20" o "el 45 %".
function textoAvance(l, valor) {
  if (P.medida(l).unidad === "pag") return `la página ${valor}`;
  const dur = P.duracionDe(l);
  return dur ? P.hm((valor / 100) * dur) : `el ${coma(valor)} %`;
}

// ---- Botón en "Sigue leyendo" y en la ficha ----
function boton(l) {
  const s = activa();
  if (s && s.libroId === l.id) {
    return `<button type="button" class="lib-btn lib-btn-chico lses-corre" data-lses="abrir">⏱ <span data-lses-reloj>${S.reloj(S.transcurrido(s, Date.now()))}</span>${S.enPausa(s) ? " · en pausa" : ""}</button>`;
  }
  return `<button type="button" class="lib-btn lib-btn-chico" data-lses-leer="${esc(l.id)}">▶ Leer ahora</button>`;
}

// ---- La sesión ----
function empezar(id) {
  const l = libro(id);
  if (!l) return;
  const s = activa();
  if (s && s.libroId !== id && libro(s.libroId)) { abrir(`Ya estás leyendo «${libro(s.libroId).titulo}». Termínala para empezar otra.`); return; }
  if (!s || s.libroId !== id) {
    st = S.iniciar(l, Date.now(), uid());
    guardarLocal();
    avisar();
  }
  abrir();
}
function abrir(nota) {
  const s = activa(), l = s && libro(s.libroId);
  if (!l) return;
  fase = "reloj";
  hoja.abrir("Leer ahora", htmlReloj(l, nota));
  arrancar();
  pantalla();
}
function pintar(html, titulo) {
  if (!hoja.abierta()) { hoja.abrir(titulo || "Leer ahora", html); return; }
  hoja.el.querySelector(".lib-hoja-cuerpo").innerHTML = html;
  const t = hoja.el.querySelector("#lib-hoja-sesion-t");
  if (t && titulo) t.textContent = titulo;
}
function htmlReloj(l, nota) {
  const s = activa();
  const pausa = S.enPausa(s);
  const dur = P.duracionDe(l);
  const desde = s.unidad === "pag" ? `Empezaste en la página ${s.desde}` : dur ? `Empezaste en ${P.hm((s.desde / 100) * dur)}` : `Empezaste en el ${coma(s.desde)} %`;
  return `<div class="lses">
      ${nota ? `<p class="lib-ayuda lses-nota">${esc(nota)}</p>` : ""}
      <p class="lses-libro"><b>${esc(l.titulo)}</b>${l.autor ? `<small>${esc(l.autor)}</small>` : ""}</p>
      <p class="lses-reloj${pausa ? " is-pausa" : ""}" role="timer" aria-label="Tiempo leyendo"><span data-lses-reloj>${S.reloj(S.transcurrido(s, Date.now()))}</span></p>
      <p class="lses-desde">${esc(desde)}${pausa ? " · en pausa" : ""}</p>
      <div class="lses-botones">
        <button type="button" class="lib-btn-sec" data-lses="${pausa ? "seguir" : "pausa"}">${pausa ? "▶ Seguir" : "⏸ Pausa"}</button>
        <button type="button" class="lib-btn" data-lses="terminar">Terminar</button>
      </div>
      ${"wakeLock" in navigator ? `<label class="bbl-aa-fila bbl-switch lses-pantalla"><span>Mantener la pantalla encendida<small>Mientras miras el reloj.</small></span><input type="checkbox" data-lses-pantalla${pantallaOn() ? " checked" : ""}></label>` : ""}
      <p class="lib-ayuda">Puedes bloquear el teléfono o cerrar esto: el tiempo sigue contando.</p>
      <button type="button" class="lses-link" data-lses="descartar">Descartar esta sesión</button>
    </div>`;
}
function terminar() {
  const s = activa(), l = s && libro(s.libroId);
  if (!l) return;
  seguirAlVolver = !S.enPausa(s);
  st = S.pausar(st, Date.now());    // el reloj se detiene mientras anotas
  guardarLocal();
  avisar();
  fase = "fin";
  const ms = S.transcurrido(st, Date.now());
  pintar(`<form class="lib-form lses-fin" novalidate>
      <p class="lses-libro"><b>${esc(l.titulo)}</b><small>Leíste ${esc(S.reloj(ms))}</small></p>
      <label class="lib-campo lses-min"><span>Minutos</span><input type="text" inputmode="decimal" name="minutos" autocomplete="off" value="${S.minutosDe(ms)}" class="lib-input"></label>
      ${campoAvance(l, "hasta", P.medida(l).unidad === "pag" ? "¿A qué página llegaste?" : null)}
      ${botonesSumar(l, "data-lses-sumar")}
      <p class="lib-error" role="alert" hidden></p>
      <div class="lib-acciones">
        <button type="button" class="lib-btn-sec" data-lses="volver">Volver</button>
        <button type="submit" class="lib-btn">Guardar</button>
      </div>
    </form>`, "Terminar la sesión");
  pantalla();
}
function guardar(f) {
  const s = activa(), l = s && libro(s.libroId);
  if (!l) return;
  const hoy = hoyLocal(), ahora = Date.now();
  const lr = P.leerAvance(l, textoCampo(f, l, "hasta"));
  if (!lr.ok) { window.Lectura.errores(f, [{ campo: campoError(l, "hasta"), texto: lr.error }]); return; }
  const r = P.registrarAvance(l, lr.valor, hoy);
  if (!r.ok) { window.Lectura.errores(f, [{ campo: campoError(l, "hasta"), texto: r.error }]); return; }
  const c = S.cerrar(s, l, f.elements.minutos.value, lr.valor, ahora, hoy);
  if (!c.ok) { window.Lectura.errores(f, [{ campo: c.campo, texto: c.error }]); return; }
  docLibro(l.id).update(Object.assign({}, r.cambios, { [`sesiones.${c.id}`]: c.sesion })).catch(fallo);
  st = null;
  guardarLocal();
  avisar();
  // Cómo queda el libro (para el resumen, antes de que llegue de Firestore).
  const l2 = L.normalizarLibro(l.id, Object.assign({}, l, r.cambios, { sesiones: Object.assign({}, l.sesiones, { [c.id]: c.sesion }) }));
  if (r.terminado && datos()) { hoja.cerrar(); datos().festejo(l.id); pantalla(); return; }
  fase = "listo";
  pintar(htmlListo(l2, c.sesion), "Sesión guardada");
  pantalla();
}
function htmlListo(l, ses) {
  const hoy = hoyLocal();
  const avance = Math.max(0, r1(ses.hasta - ses.desde));
  const pag = ses.unidad === "pag";
  const dur = P.duracionDe(l);
  const que = pag ? `${avance} ${avance === 1 ? "página" : "páginas"}` : dur ? `${P.hm((avance / 100) * dur)} de audio` : `${coma(avance)} %`;
  const vel = avance > 0 ? r1((avance / ses.min) * 60) : null;
  const d = S.delLibro(l, hoy);
  const x = P.lectura(l, hoy, datos() ? datos().metaDia() : 0);
  const lineas = [];
  if (d.velocidad && d.n > 1) lineas.push(`Con este libro vas a ${S.textoVelocidad(d.velocidad, d.unidad)}.`);
  if (d.faltaMin) lineas.push(pag ? `Faltan ${x.faltan} páginas: unas ${S.duracion(d.faltaMin)} de lectura.` : `Te faltan unas ${S.duracion(d.faltaMin)} de escucha, a tu ritmo.`);
  else if (x.faltaAudioMin) lineas.push(`Te faltan ${P.hm(x.faltaAudioMin)} de audio.`);
  if (x.finRitmo) lineas.push(`A tu ritmo lo terminas el ${P.fechaCorta(x.finRitmo)}.`);
  return `<div class="lses-listo">
      <p class="lses-listo-t">✓ ${esc(que)} en ${esc(S.duracion(ses.min))}</p>
      ${vel && pag ? `<p class="lses-listo-v">${esc(S.textoVelocidad(vel, ses.unidad))}</p>` : ""}
      <p class="lses-listo-l"><b>${esc(l.titulo)}</b> · llegaste a ${esc(textoAvance(l, ses.hasta))}</p>
      ${lineas.map(t => `<p class="lib-nota">${esc(t)}</p>`).join("")}
      <button type="button" class="lib-btn lib-btn-ancho" data-cerrar-hoja>Listo</button>
    </div>`;
}

// ---- Reloj en pantalla ----
function tic() {
  const s = activa();
  if (!s) { parar(); return; }
  const t = S.reloj(S.transcurrido(s, Date.now()));
  document.querySelectorAll("[data-lses-reloj]").forEach(el => { if (el.textContent !== t) el.textContent = t; });
  if (candado && !hoja.abierta()) pantalla();
}
function arrancar() {
  if (!timer && activa() && document.visibilityState !== "hidden") timer = setInterval(tic, 1000);
  tic();
}
function parar() { clearInterval(timer); timer = null; }

// ---- Pantalla encendida (opcional) ----
const pantallaOn = () => { try { return localStorage.getItem(CLAVE_PANTALLA) === "1"; } catch (e) { return false; } };
async function pantalla() {
  const s = activa();
  const quiere = !!s && !S.enPausa(s) && fase === "reloj" && hoja.abierta() && pantallaOn() && document.visibilityState === "visible";
  if (quiere && !candado && !pidiendo && navigator.wakeLock) {
    pidiendo = true;
    try {
      candado = await navigator.wakeLock.request("screen");
      candado.addEventListener("release", () => { candado = null; });
    } catch (e) { candado = null; } finally { pidiendo = false; }
  } else if (!quiere && candado) {
    const c = candado;
    candado = null;
    try { await c.release(); } catch (e) { /* ya estaba suelto */ }
  }
}

// ---- En la ficha del libro ----
const fechaTxt = f => (f ? L.fechaLarga(f) : "");
function ficha(l) {
  const hoy = hoyLocal();
  const d = S.delLibro(l, hoy);
  const x = P.lectura(l, hoy, 0);
  const lineas = [];
  if (d.velocidad) lineas.push(`Tu velocidad: <b>${esc(S.textoVelocidad(d.velocidad, d.unidad))}</b>`);
  if (d.faltaMin) lineas.push(`Te faltan unas <b>${esc(S.duracion(d.faltaMin))}</b> de lectura`);
  else if (x.faltaAudioMin) lineas.push(`Te faltan <b>${esc(P.hm(x.faltaAudioMin))}</b> de audio`);
  let html = lineas.length ? `<p class="lses-datos">${lineas.join(" · ")}</p>` : "";
  if (d.n) {
    const ult = d.sesiones.slice(-5).reverse();
    html += `<div class="lib-h lib-h-fila"><h5>Sesiones <span>${d.n}</span></h5><small class="lses-total">${esc(S.duracion(d.minutos))} leyendo</small></div>
      <ul class="lses-lista">${ult.map(y => `<li><span>${esc(L.fechaLarga(y.fecha))}</span><span>${esc(S.duracion(y.min))}</span><span>${y.avance ? esc(y.unidad === "pag" ? `${y.avance} pág.` : `${coma(y.avance)} %`) : "—"}</span></li>`).join("")}</ul>`;
  }
  if (l.estado === "leyendo") html += `<button type="button" class="lses-link" data-lses-dejar="${esc(l.id)}">Dejar de leerlo</button>`;
  if (l.estado === "abandonado") {
    html += `<div class="lses-dejado"><p>⏸ Lo dejaste${l.fechaDejado ? ` el ${esc(fechaTxt(l.fechaDejado))}` : ""}${x.pagina != null ? ` en ${esc(textoAvance(l, x.pagina))}` : ""}.</p>
      <button type="button" class="lib-btn lib-btn-chico" data-lses-retomar="${esc(l.id)}">Retomar</button></div>`;
  }
  if (l.estado === "terminado") html += `<button type="button" class="lib-btn-sec lib-btn-ancho lses-releer" data-lses-releer="${esc(l.id)}">📖 Leer de nuevo</button>`;
  const antes = P.lecturasDe(l).filter(y => !y.actual);
  if (antes.length) {
    html += `<h5 class="lib-h">Lecturas anteriores</h5><ul class="lses-lecturas">${antes.map(y => `<li><b>${y.n}ª</b> ${esc([fechaTxt(y.fechaInicio), fechaTxt(y.fechaFin || y.fechaDejado)].filter(Boolean).join(" – ") || "sin fechas")} · ${esc((L.ESTADO[y.estado] || L.ESTADO.terminado).nombre)}</li>`).join("")}</ul>`;
  }
  return html ? `<div class="lses-ficha">${html}</div>` : "";
}

// ---- Toques ----
hoja.el.addEventListener("click", e => {
  const su = e.target.closest("[data-lses-sumar]");
  if (su) { const s = activa(), l = s && libro(s.libroId), f = hoja.el.querySelector("form"); if (l && f) sumar(f, l, "hasta", su.dataset.lsesSumar); return; }
  const b = e.target.closest("[data-lses]");
  if (!b) return;
  const a = b.dataset.lses, ahora = Date.now();
  if (!activa() && a !== "descartar") { hoja.cerrar(); return; }
  if (a === "pausa" || a === "seguir") {
    st = a === "pausa" ? S.pausar(st, ahora) : S.seguir(st, ahora);
    guardarLocal();
    avisar();
    const l = libro(st.libroId);
    if (l) pintar(htmlReloj(l));
    pantalla();
  } else if (a === "terminar") terminar();
  else if (a === "volver") {
    if (seguirAlVolver && st) st = S.seguir(st, ahora);
    guardarLocal();
    avisar();
    abrir();
  } else if (a === "descartar") {
    if (!confirm("¿Descartar esta sesión? No se guarda nada.")) return;
    st = null;
    guardarLocal();
    avisar();
    hoja.cerrar();
    pantalla();
  }
});
hoja.el.addEventListener("submit", e => { e.preventDefault(); guardar(e.target); });
hoja.el.addEventListener("input", e => {
  if (!e.target.classList.contains("is-error")) return;
  e.target.classList.remove("is-error");
  e.target.removeAttribute("aria-invalid");
  const f = e.target.form;
  if (f && !f.querySelector(".is-error")) f.querySelector(".lib-error").hidden = true;
});
hoja.el.addEventListener("change", e => {
  if (!e.target.matches("[data-lses-pantalla]")) return;
  try { localStorage.setItem(CLAVE_PANTALLA, e.target.checked ? "1" : "0"); } catch (err) { /* sin almacenamiento */ }
  pantalla();
});
document.addEventListener("click", e => {
  const leer = e.target.closest("[data-lses-leer]");
  if (leer) { empezar(leer.dataset.lsesLeer); return; }
  const ab = e.target.closest('[data-lses="abrir"]');
  if (ab && !hoja.el.contains(ab)) { abrir(); return; }
  const dejar = e.target.closest("[data-lses-dejar]");
  if (dejar) {
    const l = libro(dejar.dataset.lsesDejar);
    if (!l || !confirm(`¿Dejar «${l.titulo}»? Queda en Abandonado; puedes retomarlo cuando quieras.`)) return;
    docLibro(l.id).update(P.abandonar(hoyLocal())).catch(fallo);
    return;
  }
  const ret = e.target.closest("[data-lses-retomar]");
  if (ret) { docLibro(ret.dataset.lsesRetomar).update(P.retomar()).catch(fallo); return; }
  const re = e.target.closest("[data-lses-releer]");
  if (re) {
    const l = libro(re.dataset.lsesReleer);
    if (!l || !confirm(`¿Leer «${l.titulo}» de nuevo? Empiezas desde el principio; tu lectura anterior queda guardada.`)) return;
    docLibro(l.id).update(P.nuevaLectura(l, hoyLocal(), Date.now())).catch(fallo);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") parar(); else arrancar();
  pantalla();
});
// Si el libro de la sesión ya no existe (lo borraste), la sesión se va.
window.addEventListener("libros:datos", () => {
  if (st && datos() && datos().listo() && !libro(st.libroId)) { st = null; guardarLocal(); avisar(); }
  if (activa()) arrancar();
});
if (activa()) arrancar();

window.LibrosSesion = { empezar, activa: () => (activa() ? Object.assign({}, activa()) : null), boton, ficha, campoAvance, textoCampo, sumar, botonesSumar, campoError };
})();
