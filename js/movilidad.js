// ---------- Movilidad (sub-panel de Inicio) ----------
// Dos rutinas guiadas de estiramiento: tarjetas → vista previa con los
// ejercicios → modo guiado (cuenta 3-2-1, círculo con los segundos, avance
// solo, "Cambia de lado" a la mitad, pausar / saltar / salir, vibración
// corta y pantalla encendida) → "Rutina completada" y se guarda en el
// historial (racha y últimas sesiones).
// Las rutinas son datos: js/movilidad-rutinas.js. La lógica:
// js/movilidad-motor.js. Datos en users/{uid}/movilidad. Ver docs/MOVILIDAD.md.
(function () {
// Ícono de la tarjeta de Inicio (mismo trazo que js/icons.js). Se registra
// aquí para no tocar el archivo compartido; renderIcons() corre después.
if (typeof ICONS === "object") {
  ICONS.movilidad = `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="12" cy="4.5" r="1.8"/><path d="M4.5 9.5 12 8l7.5 1.5"/><path d="M12 8v5.5"/><path d="m12 13.5-3.5 6.5"/><path d="m12 13.5 3.5 6.5"/></svg>`;
}

const M = window.MovilidadMotor;
const RUTINAS = window.MovilidadRutinas;
const app = document.getElementById("mov-app");
if (!app || !M || !RUTINAS || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const hoja = window.Lectura.hoja("mov-hoja");

let sesiones = [];
let cargado = false;
let guia = null;   // rutina en curso: { rt, ps, st, ultima, reloj, terminada }

const coleccion = () => db.collection("users").doc(currentUser.uid).collection("movilidad");
const rutina = id => RUTINAS.find(r => r.id === id);
const vibrar = patron => { try { if (navigator.vibrate) navigator.vibrate(patron); } catch (e) { /* sin vibración */ } };
const pantalla = encendida => { if (window.Avisos) (encendida ? Avisos.pedirPantalla() : Avisos.soltarPantalla()); };
function hora(ms) {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- Pantalla principal: racha, rutinas y últimas sesiones ----------
function render() {
  if (!cargado) { app.innerHTML = `<p class="empty-state">Cargando…</p>`; return; }
  const hoy = hoyLocal();
  const r = M.racha(sesiones, hoy);
  const semana = M.estaSemana(sesiones, hoy);
  const ult = M.ultimas(sesiones, 5);
  app.innerHTML = `
    <div class="lib-cifras">
      <div><b>${r.dias > 0 ? "🔥 " : ""}${r.dias}</b><span>${r.dias === 1 ? "día seguido" : "días seguidos"}</span></div>
      <div><b>${semana}</b><span>esta semana</span></div>
      <div><b>${sesiones.length}</b><span>${sesiones.length === 1 ? "sesión" : "sesiones"} en total</span></div>
    </div>
    <p class="bib-hoy${r.hoy ? " is-hecho" : ""}">${r.hoy ? "✓ Hoy ya hiciste tu movilidad." : r.dias ? "Haz una rutina hoy para seguir la racha." : "Elige una rutina para empezar."}</p>
    <div class="mov-rutinas">
      ${RUTINAS.map(rt => `
      <button type="button" class="mov-rutina" data-mov-rutina="${esc(rt.id)}">
        <span class="mov-rutina-ico" data-icon="movilidad"></span>
        <span class="mov-rutina-txt"><b>${esc(rt.nombre)}</b><span>${M.duracionTexto(M.duracion(rt))} · ${M.pasos(rt).length} ejercicios</span></span>
        <span class="mov-rutina-chev" data-icon="chevronRight"></span>
      </button>`).join("")}
    </div>
    <h2 class="lib-mes-titulo">Últimas sesiones</h2>
    ${ult.length ? `<ul class="mov-sesiones">${ult.map(s => `
      <li class="mov-sesion"><b>${esc(s.nombre)}</b><small>${esc(M.fechaCorta(s.fecha))}${s.completada ? ` · ${hora(s.completada)}` : ""} · ${M.duracionTexto(s.duracionSeg)}${s.saltados ? ` · ${s.saltados === 1 ? "1 saltado" : `${s.saltados} saltados`}` : ""}</small></li>`).join("")}
    </ul>` : `<p class="empty-state">Todavía no completaste ninguna rutina.</p>`}`;
  if (typeof renderIcons === "function") renderIcons(app);
}

// ---------- Vista previa (hoja) ----------
function vistaPrevia(id) {
  const rt = rutina(id);
  if (!rt) return;
  const ps = M.pasos(rt);
  let n = 0;
  hoja.abrir(rt.nombre, `
      <div class="mov-previa">
        <p class="lib-nota">${M.duracionTexto(M.duracion(rt))} · ${ps.length} ejercicios</p>
        ${rt.partes.map(p => `
          ${p.titulo && rt.partes.length > 1 ? `<h5 class="lib-h">${esc(p.titulo)}</h5>` : ""}
          ${p.nota ? `<p class="mov-nota">${esc(p.nota)}</p>` : ""}
          <ol class="mov-lista" start="${n + 1}">${p.ejercicios.map(e => { n++; return `
            <li><span class="mov-lista-cab"><b>${esc(e.nombre)}</b><span class="mov-seg">${e.segundos} s${e.porLado ? ` · ${e.segundos / 2} s por lado` : ""}</span></span>
              <small>${esc(e.instruccion)}</small></li>`; }).join("")}
          </ol>`).join("")}
        <div class="mov-empezar"><button type="button" class="lib-btn lib-btn-ancho" data-mov-empezar="${esc(rt.id)}">Empezar</button></div>
      </div>`);
}

// ---------- Modo guiado ----------
const capa = document.createElement("div");
capa.className = "mov-guia";
capa.hidden = true;
capa.setAttribute("role", "dialog");
capa.setAttribute("aria-modal", "true");
document.body.appendChild(capa);

function empezar(id) {
  const rt = rutina(id);
  if (!rt) return;
  hoja.cerrar();
  const ps = M.pasos(rt);
  guia = { rt, ps, st: M.iniciar(M.crear(rt), Date.now()), ultima: null, reloj: 0, terminada: false };
  capa.setAttribute("aria-label", rt.nombre);
  capa.innerHTML = `
    <div class="mov-guia-cab">
      <button type="button" class="mov-guia-salir" data-mov="salir" aria-label="Salir de la rutina"><span data-icon="close"></span></button>
      <div class="mov-guia-t"><b>${esc(rt.nombre)}</b><span data-mov-paso></span></div>
    </div>
    <div class="mov-barra" role="progressbar" aria-label="Avance de la rutina" aria-valuemin="0" aria-valuemax="100" data-mov-barra-aria><i data-mov-barra></i></div>
    <div class="mov-guia-cuerpo">
      <p class="mov-parte" data-mov-parte hidden></p>
      <h2 class="mov-ej" data-mov-ej aria-live="polite"></h2>
      <p class="mov-instr" data-mov-instr></p>
      <div class="mov-reloj">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="mov-reloj-fondo" cx="60" cy="60" r="52"/>
          <circle class="mov-reloj-arco" data-mov-arco cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
        </svg>
        <span class="mov-reloj-num" data-mov-num role="timer"></span>
        <span class="mov-reloj-sub" data-mov-sub></span>
      </div>
      <p class="mov-cambio" data-mov-cambio role="status" hidden>↔ Cambia de lado</p>
      <p class="mov-nota" data-mov-nota hidden></p>
      <p class="mov-sig" data-mov-sig></p>
    </div>
    <div class="mov-guia-botones">
      <button type="button" class="lib-btn-sec" data-mov="saltar">Saltar</button>
      <button type="button" class="lib-btn" data-mov="pausa">Pausar</button>
    </div>
    <div class="mov-fin" data-mov-fin hidden></div>`;
  if (typeof renderIcons === "function") renderIcons(capa);
  capa.hidden = false;
  document.body.classList.add("mov-en-guia");
  pantalla(true);
  tic();
  guia.reloj = setInterval(tic, 100);
}

function tic() {
  if (!guia || guia.terminada) return;
  const i = M.info(guia.st, guia.ps, Date.now());
  const cambios = M.cambios(guia.ultima, i);
  if (cambios.includes("paso")) vibrar(150);
  if (cambios.includes("lado")) vibrar(100);
  guia.ultima = i;
  if (i.terminado) { terminar(); return; }
  pintar(i);
}

function pintar(i) {
  const g = guia;
  const $ = sel => capa.querySelector(sel);
  const txt = (sel, t) => { const el = $(sel); if (el.textContent !== t) el.textContent = t; };
  const enPausa = g.st.estado === "pausado";
  txt("[data-mov-paso]", `Ejercicio ${i.indice + 1} de ${g.ps.length}`);
  $("[data-mov-barra]").style.width = `${(i.pct * 100).toFixed(1)}%`;
  $("[data-mov-barra-aria]").setAttribute("aria-valuenow", String(Math.round(i.pct * 100)));
  if (i.cuenta) {
    txt("[data-mov-ej]", "Prepárate");
    txt("[data-mov-instr]", `Empieza con: ${g.ps[0].nombre}`);
    txt("[data-mov-num]", String(i.cuenta));
    txt("[data-mov-sub]", "");
    $("[data-mov-arco]").style.strokeDashoffset = "0";
    txt("[data-mov-sig]", "");
  } else {
    txt("[data-mov-ej]", i.paso.nombre);
    txt("[data-mov-instr]", i.paso.instruccion);
    txt("[data-mov-num]", String(i.restante));
    txt("[data-mov-sub]", enPausa ? "En pausa" : i.lado ? `Lado ${i.lado}` : "segundos");
    $("[data-mov-arco]").style.strokeDashoffset = (i.pctPaso * 100).toFixed(2);
    txt("[data-mov-sig]", i.siguiente ? `Siguiente: ${i.siguiente.nombre} · ${i.siguiente.segundos} s` : "Último ejercicio");
  }
  // "Cambia de lado" durante los primeros 3 s de la segunda mitad.
  const enCambio = !i.cuenta && i.lado === 2 && i.transcurrido - i.paso.desde - i.paso.segundos / 2 < 3;
  $("[data-mov-cambio]").hidden = !enCambio;
  const parte = !i.cuenta && i.paso.parte && g.rt.partes.length > 1 ? i.paso.parte : "";
  txt("[data-mov-parte]", parte);
  $("[data-mov-parte]").hidden = !parte;
  const nota = !i.cuenta ? i.paso.nota : "";
  txt("[data-mov-nota]", nota);
  $("[data-mov-nota]").hidden = !nota;
  capa.classList.toggle("is-pausa", enPausa);
  capa.classList.toggle("is-cuenta", !!i.cuenta);
  const pausa = $('[data-mov="pausa"]');
  txt('[data-mov="pausa"]', enPausa ? "Reanudar" : "Pausar");
  pausa.disabled = !!i.cuenta;
  $('[data-mov="saltar"]').disabled = !!i.cuenta;
}

// Al terminar: se guarda en el historial (sin internet también: Firestore
// lo sube al volver la conexión) y se muestra el festejo.
function terminar() {
  const g = guia;
  g.terminada = true;
  clearInterval(g.reloj);
  pantalla(false);
  vibrar([150, 80, 150]);
  const hoy = hoyLocal();
  const doc = M.sesion(g.rt, g.st, hoy, Date.now());
  coleccion().add(doc).catch(err => alert(`No se pudo guardar la sesión: ${err && err.message ? err.message : err}`));
  const r = M.racha(sesiones.concat([doc]), hoy);
  capa.classList.remove("is-pausa", "is-cuenta");
  capa.classList.add("is-fin");
  const fin = capa.querySelector("[data-mov-fin]");
  fin.innerHTML = `
    <p class="lib-festejo-emoji" aria-hidden="true">🎉</p>
    <h2>Rutina completada</h2>
    <p class="mov-fin-nombre">${esc(g.rt.nombre)} · ${M.duracionTexto(M.duracion(g.rt))}</p>
    <p class="lib-nota">${r.dias > 1 ? `🔥 ${r.dias} días seguidos` : "Primer día de tu racha"}${doc.saltados ? ` · saltaste ${doc.saltados === 1 ? "1 ejercicio" : `${doc.saltados} ejercicios`}` : ""}</p>
    <button type="button" class="lib-btn lib-btn-ancho" data-mov="listo">Listo</button>`;
  fin.hidden = false;
  capa.querySelector(".mov-barra i").style.width = "100%";
}

function cerrarGuia() {
  if (!guia) return;
  clearInterval(guia.reloj);
  pantalla(false);
  guia = null;
  capa.hidden = true;
  capa.className = "mov-guia";
  capa.innerHTML = "";
  document.body.classList.remove("mov-en-guia");
  render();
}

capa.addEventListener("click", e => {
  const b = e.target.closest("[data-mov]");
  if (!b || !guia) return;
  const ahora = Date.now();
  const accion = b.dataset.mov;
  if (accion === "listo") { cerrarGuia(); return; }
  if (accion === "salir") {
    if (!guia.terminada && !confirm("¿Salir de la rutina? No se guarda como completada.")) return;
    cerrarGuia();
    return;
  }
  if (guia.terminada) return;
  if (accion === "pausa") {
    if (guia.st.estado === "activo") M.pausar(guia.st, ahora); else M.reanudar(guia.st, ahora);
  } else if (accion === "saltar") M.saltar(guia.st, guia.ps, ahora);
  tic();
});

// Si sales de la app a mitad de rutina, queda en pausa; al volver, reanudas.
document.addEventListener("visibilitychange", () => {
  if (!guia || guia.terminada) return;
  if (document.visibilityState === "hidden" && guia.st.estado === "activo") { M.pausar(guia.st, Date.now()); tic(); }
});
// Atrás del navegador (o cualquier salida de la sección) cierra la rutina.
window.addEventListener("hashchange", () => { if (guia && location.hash !== "#movilidad") cerrarGuia(); });

// ---------- Acciones ----------
app.addEventListener("click", e => {
  const r = e.target.closest("[data-mov-rutina]");
  if (r) vistaPrevia(r.dataset.movRutina);
});
hoja.el.addEventListener("click", e => {
  const b = e.target.closest("[data-mov-empezar]");
  if (b) empezar(b.dataset.movEmpezar);
});

// ---------- Datos ----------
onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    sesiones = snap.docs.map(d => M.normalizarSesion(d.id, d.data()));
    cargado = true;
    if (!guia) render();
  }, err => console.warn("Movilidad:", err));
});
render();
})();
