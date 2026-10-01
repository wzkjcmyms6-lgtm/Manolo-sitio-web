// ---------- Running: rutinas guiadas (sin GPS) ----------
// Lista de rutinas → pantalla de la rutina (intervalo actual, cuenta 3-2-1,
// pitidos y voz del teléfono; Pausar / Reanudar / Finalizar) → resumen
// (tiempo, intervalos; km opcionales, RPE y notas; Guardar o Descartar).
// - La lista es una cola: la de arriba es la siguiente. Al guardar una
//   rutina completada, pasa al final (js/rutina-running.js · ordenAlFinal).
// - Cada rutina guardada queda en el historial de Running
//   (users/{uid}/running, fuente "rutina") con su nombre: borrar la rutina
//   no borra el historial.
// - El estado se guarda en el teléfono cada ~10 s, al pausar y al salir de
//   la app; si Manolo se cierra, al volver se recupera en pausa.
// El tiempo lo calcula js/intervalos-motor.js; sonido, voz y pantalla
// encendida, js/avisos.js; importar y guardar rutinas, js/rutinas-running-ui.js.
(function () {
const RR = RutinaRunning;
const IM = IntervalosMotor;
const NOMBRE_TIPO = { caminar: "Caminar", trotar: "Trotar", correr: "Correr", descanso: "Descanso" };
const GUARDAR_CADA_MS = 10000;
const RECUPERAR_MAX_MS = 12 * 3600000;
const FIN_PAUSA_MS = 1800;   // tras "¡Listo!" se pasa solo al resumen

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
// 75 → "1:15" · 3725 → "1:02:05"
function reloj(seg) {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
function fechaLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fechaHora(ms) {
  const d = new Date(ms);
  const dia = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  return `${dia} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const claveLocal = () => "manolo.rutina." + (currentUser ? currentUser.uid : "");
function leerLocal() {
  try {
    const o = JSON.parse(localStorage.getItem(claveLocal()) || "null");
    if (!o || !o.rut || Date.now() - (o.guardado || 0) > RECUPERAR_MAX_MS) return null;
    return o;
  } catch (e) { return null; }
}

// o = { lista (donde va la lista de rutinas), pantalla (rutina en curso y
//       resumen), inicio (lo que se oculta durante la rutina), panel ("running") }
function crear(o) {
  let vista = "inicio";      // inicio · vivo · resumen
  let rut = null;            // estado de IntervalosMotor
  let meta = null;           // { id, nombre (para el historial) }
  let antes = null;          // copia antes de Finalizar (para "Volver a la rutina")
  let recuperada = false;
  let ultimoAvisoT = null;
  let ultimoGuardado = 0;
  let timer = null, cuentaTimer = null, finTimer = null;
  let indicePintado = -1, estadoPintado = null;
  let aviso = "", avisoHasta = 0;

  function guardarLocal() {
    if (!rut || !currentUser) return;
    ultimoGuardado = Date.now();
    try { localStorage.setItem(claveLocal(), JSON.stringify({ guardado: ultimoGuardado, rut, meta })); } catch (e) { /* sin espacio */ }
  }
  function borrarLocal() {
    try { localStorage.removeItem(claveLocal()); } catch (e) { /* sin almacenamiento */ }
  }
  function modoPantalla() {
    const enPanel = location.hash === "#" + o.panel;
    document.body.classList.toggle("act-en-curso", enPanel && vista !== "inicio");
    o.inicio.hidden = vista !== "inicio";
    o.pantalla.hidden = vista === "inicio";
    const enCurso = !!rut && rut.estado !== "listo";
    document.querySelectorAll(`[data-act-en-curso="${o.panel}"]`).forEach(el => { el.hidden = !enCurso; });
  }

  // ---- Lista de rutinas ----
  function renderLista() {
    const lista = RutinasRunning.lista();
    const ok = aviso && Date.now() < avisoHasta ? `<p class="act-ok" role="status">${escapeHtml(aviso)}</p>` : "";
    o.lista.innerHTML = `
      <div class="rg-cab">
        <h2 class="act-lista-t">Rutinas guiadas</h2>
        <button type="button" class="link-btn" data-rg="importar">Importar CSV</button>
      </div>
      ${ok}
      ${lista.length ? `
        <ol class="rg-lista">${lista.map((r, i) => `
          <li class="rg-item${i === 0 ? " is-siguiente" : ""}">
            <button type="button" class="rg-abrir" data-rg="abrir" data-id="${escapeHtml(r.id)}">
              ${i === 0 ? `<span class="rg-badge">Siguiente</span>` : ""}
              <strong>${escapeHtml(RR.titulo(r))}</strong>
              <span>${r.dia ? `${escapeHtml(r.nombre)} · ` : ""}${escapeHtml(RR.resumen(r))}</span>
            </button>
            <button type="button" class="act-rutina-borrar" data-rg="borrar" data-id="${escapeHtml(r.id)}" aria-label="Eliminar ${escapeHtml(RR.nombreCompleto(r))}"><span data-icon="trash"></span></button>
          </li>`).join("")}</ol>
        <p class="rg-ayuda">Al completar una rutina pasa al final de la lista. Borrar una rutina no borra tu historial.
          <button type="button" class="link-btn" data-rg="plantilla">Descargar plantilla</button></p>` : `
        <p class="rg-ayuda">Importa tus rutinas desde un archivo CSV (por ejemplo: 3 min caminar, 2 min correr…), de un día o de varios (Día 1, Día 2…). Manolo te avisa cada cambio con pitidos y voz.
          <button type="button" class="link-btn" data-rg="plantilla">Descargar plantilla</button></p>`}`;
    if (typeof renderIcons === "function") renderIcons(o.lista);
  }

  // ---- Pantalla de la rutina ----
  function htmlVivo() {
    const p = Avisos.prefs();
    const filas = rut.plan.intervalos.map((x, i) => `
      <li data-rg-i="${i}"><span class="rr-tipo is-${x.tipo}">${NOMBRE_TIPO[x.tipo]}</span><span class="rr-dur">${reloj(x.seg)}</span><span class="rr-texto">${escapeHtml(x.texto)}</span></li>`).join("");
    return `
      <div class="act-vivo">
        <div class="act-top">
          <span class="act-dep">${escapeHtml(meta.nombre)}</span>
          <span class="act-rut-ctl">
            <button type="button" data-rg="sonido" aria-pressed="${p.sonido}">Sonido</button>
            <button type="button" data-rg="voz" aria-pressed="${p.voz}"${Avisos.vozDisponible() ? "" : " hidden"}>Voz</button>
          </span>
        </div>
        <div class="act-rut" data-rg-rut>
          <div class="act-rut-cab"><span data-rg-cab></span></div>
          <div class="act-rut-main"><strong class="act-rut-tipo" data-rg-tipo></strong><strong class="act-rut-resta" data-rg-resta></strong></div>
          <p class="act-rut-texto" data-rg-texto></p>
          <div class="act-rut-barra" aria-hidden="true"><i data-rg-barra></i></div>
          <p class="act-rut-sig" data-rg-sig></p>
        </div>
        <div class="rg-tiempos">
          <div><span class="act-lbl">Tiempo</span><strong data-rg-tiempo>0:00</strong></div>
          <div><span class="act-lbl">Quedan</span><strong data-rg-quedan>0:00</strong></div>
        </div>
        <ol class="rr-lista rg-plan" data-rg-plan>${filas}</ol>
        <p class="act-nota" data-rg-nota role="status"></p>
        <div class="act-botones" data-rg-botones></div>
      </div>
      <div class="act-cuenta" data-rg-cuenta aria-hidden="true"></div>`;
  }
  function pintarVivo() {
    const raiz = o.pantalla;
    if (!rut || !raiz.querySelector(".act-vivo")) return;
    const ahora = Date.now();
    const i = IM.info(rut, ahora);
    const n = rut.plan.intervalos.length;
    const txt = (sel, t) => { const el = raiz.querySelector(sel); if (el && el.textContent !== t) el.textContent = t; };
    raiz.querySelector("[data-rg-rut]").className = "act-rut is-" + (i.terminado ? "fin" : i.actual.tipo);
    txt("[data-rg-cab]", i.terminado ? "Completada" : `Intervalo ${i.indice + 1} de ${n}`);
    txt("[data-rg-tipo]", i.terminado ? "¡Rutina completada!" : NOMBRE_TIPO[i.actual.tipo]);
    txt("[data-rg-resta]", i.terminado ? "" : reloj(i.restanteS));
    txt("[data-rg-texto]", i.terminado ? "" : i.actual.texto || "");
    txt("[data-rg-sig]", i.terminado ? "" : i.siguiente ? `Siguiente: ${NOMBRE_TIPO[i.siguiente.tipo]} · ${reloj(i.siguiente.seg)}` : "Último intervalo");
    raiz.querySelector("[data-rg-barra]").style.width = `${(i.pct * 100).toFixed(1)}%`;
    txt("[data-rg-tiempo]", reloj(i.transcurridoS));
    txt("[data-rg-quedan]", reloj(i.totalS - i.transcurridoS));
    // Lista: hechos atenuados, el actual resaltado y a la vista.
    const actual = i.terminado ? n : i.indice;
    if (actual !== indicePintado) {
      indicePintado = actual;
      const plan = raiz.querySelector("[data-rg-plan]");
      plan.querySelectorAll("li").forEach((li, k) => {
        li.classList.toggle("is-hecho", k < actual);
        li.classList.toggle("is-actual", k === actual && rut.estado !== "listo");
      });
      const li = plan.querySelector(`[data-rg-i="${Math.min(actual, n - 1)}"]`);
      if (li) plan.scrollTop = Math.max(0, li.offsetTop - plan.offsetTop - plan.clientHeight / 3);
    }
    if (estadoPintado !== rut.estado) {
      estadoPintado = rut.estado;
      const b = raiz.querySelector("[data-rg-botones]");
      b.innerHTML = rut.estado === "listo" ? `
        <button type="button" class="act-btn-sec" data-rg="cancelar">Cancelar</button>
        <button type="button" class="act-btn-redondo" data-rg="iniciar">Iniciar</button>`
        : rut.estado === "activo" ? `<button type="button" class="act-btn-redondo is-pausa" data-rg="pausar">Pausar</button>` : `
        <button type="button" class="act-btn-redondo" data-rg="reanudar">Reanudar</button>
        <button type="button" class="act-btn-redondo is-fin" data-rg="finalizar">Finalizar</button>`;
    }
    txt("[data-rg-nota]", rut.estado === "listo"
      ? "Toca Iniciar. Deja Manolo abierto: con el teléfono bloqueado el iPhone no deja sonar los avisos."
      : rut.estado === "pausado" ? (recuperada ? "Recuperamos tu rutina: quedó en pausa al cerrarse Manolo." : "En pausa: el tiempo no corre.") : "");
  }

  // ---- Avisos: cuenta 3-2-1, cambio de intervalo y fin ----
  function mostrarCuenta(texto, largo) {
    const el = o.pantalla.querySelector("[data-rg-cuenta]");
    if (!el) return;
    el.textContent = texto;
    el.classList.toggle("is-palabra", !!largo);
    el.classList.remove("is-on");
    void el.offsetWidth;
    el.classList.add("is-on");
    clearTimeout(cuentaTimer);
    cuentaTimer = setTimeout(() => el.classList.remove("is-on"), largo ? 1700 : 850);
  }
  function procesarAvisos(t) {
    const lista = IM.avisos(rut, ultimoAvisoT, t);
    ultimoAvisoT = t;
    lista.forEach(av => {
      if (av.tipo === "cuenta") { Avisos.pitido("cuenta"); mostrarCuenta(String(av.n)); return; }
      Avisos.pitido(av.tipo === "fin" ? "fin" : "cambio");
      Avisos.hablar(IM.textoAviso(rut, av));
      const x = av.tipo === "fin" ? null : rut.plan.intervalos[av.indice];
      mostrarCuenta(x ? NOMBRE_TIPO[x.tipo].toUpperCase() : "¡LISTO!", true);
    });
  }
  function tic() {
    if (vista !== "vivo" || !rut) return;
    const t = Date.now();
    if (rut.estado === "activo") {
      procesarAvisos(t);
      if (Date.now() - ultimoGuardado >= GUARDAR_CADA_MS) guardarLocal();
      // Terminó: unos segundos para el "¡Listo!" y al resumen.
      if (IM.info(rut, t).terminado && !finTimer) finTimer = setTimeout(() => { finTimer = null; finalizar(true); }, FIN_PAUSA_MS);
    }
    pintarVivo();
  }

  // ---- Resumen ----
  function renderResumen() {
    const i = IM.info(rut, rut.fin);
    const n = rut.plan.intervalos.length;
    const tile = (lbl, val) => `<div class="act-tile"><span>${lbl}</span><strong>${val}</strong></div>`;
    o.pantalla.innerHTML = `
      <div class="act-resumen">
        <h2 class="act-titulo">${i.terminado ? "¡Rutina completada!" : "Rutina terminada"}</h2>
        <p class="act-fecha">${escapeHtml(fechaHora(rut.inicio))} · ${escapeHtml(meta.nombre)}</p>
        <div class="act-tiles">
          ${tile("Tiempo", reloj(i.transcurridoS))}
          ${tile("Intervalos", `${i.completados} de ${n}${i.terminado ? " ✓" : ""}`)}
        </div>
        <div class="act-extra rg-extra">
          <label>Distancia (km)
            <input type="text" inputmode="decimal" data-rg-km placeholder="Opcional" autocomplete="off"></label>
          <label>Esfuerzo (RPE)
            <select data-rg-rpe>
              <option value="">Opcional</option>
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => `<option value="${k}">${k}${k === 1 ? " · muy suave" : k === 5 ? " · moderado" : k === 8 ? " · duro" : k === 10 ? " · máximo" : ""}</option>`).join("")}
            </select></label>
          <label class="rg-notas">Notas <input type="text" data-rg-notas maxlength="200" placeholder="Opcional"></label>
        </div>
        <p class="act-ayuda">Si mediste los km con otro reloj o app, anótalos para que cuenten en tu resumen semanal.</p>
        <p class="rg-error" data-rg-error hidden></p>
        <div class="act-acciones">
          <button type="button" class="act-btn-grande" data-rg="guardar">Guardar</button>
          ${!i.terminado && antes ? `<button type="button" class="act-btn-sec" data-rg="volver">Volver a la rutina</button>` : ""}
          <button type="button" class="act-btn-peligro" data-rg="descartar">Descartar</button>
        </div>
      </div>`;
    window.scrollTo(0, 0);
  }

  function render() {
    clearInterval(timer);
    timer = null;
    indicePintado = -1;
    estadoPintado = null;
    if (vista === "vivo") {
      o.pantalla.innerHTML = htmlVivo();
      pintarVivo();
      // 4 veces por segundo para que la cuenta 3-2-1 caiga a tiempo.
      timer = setInterval(tic, 250);
    } else if (vista === "resumen") renderResumen();
    else { o.pantalla.innerHTML = ""; renderLista(); }
    if (typeof renderIcons === "function") renderIcons(o.pantalla);
    modoPantalla();
  }

  // ---- Acciones ----
  function abrir(id) {
    if (rut) return;
    const r = RutinasRunning.obtener(id);
    if (!r) return;
    rut = IM.crear({ nombre: RR.nombreCompleto(r), intervalos: r.intervalos });
    meta = { id: r.id, nombre: RR.nombreCompleto(r) };
    recuperada = false;
    vista = "vivo";
    render();
    window.scrollTo(0, 0);
  }
  function iniciar() {
    const t = Date.now();
    // El toque de Iniciar habilita sonido y voz en el iPhone.
    Avisos.desbloquear();
    Avisos.pedirPantalla();
    IM.iniciar(rut, t);
    ultimoAvisoT = null;
    procesarAvisos(t);
    guardarLocal();
    pintarVivo();
    modoPantalla();
  }
  function pausar() {
    IM.pausar(rut, Date.now());
    Avisos.soltarPantalla();
    guardarLocal();
    pintarVivo();
  }
  function reanudar() {
    recuperada = false;
    const t = Date.now();
    Avisos.desbloquear();
    Avisos.pedirPantalla();
    IM.reanudar(rut, t);
    ultimoAvisoT = t;
    guardarLocal();
    pintarVivo();
  }
  // completa = la rutina llegó al final: se cierra en el momento exacto del final.
  function finalizar(completa) {
    clearTimeout(finTimer);
    finTimer = null;
    antes = completa ? null : JSON.parse(JSON.stringify(rut));
    let t = Date.now();
    if (completa) t -= Math.max(0, IM.activoMs(rut, t) - IM.totalMs(rut));
    IM.finalizar(rut, t);
    Avisos.soltarPantalla();
    guardarLocal();
    vista = "resumen";
    render();
  }
  function volver() {
    if (!antes) return;
    rut = antes;
    antes = null;
    vista = "vivo";
    guardarLocal();
    render();
  }
  function terminar(mensaje) {
    clearTimeout(finTimer);
    finTimer = null;
    Avisos.soltarPantalla();
    borrarLocal();
    rut = null;
    meta = null;
    antes = null;
    vista = "inicio";
    aviso = mensaje || "";
    avisoHasta = Date.now() + 8000;
    render();
  }
  function guardar() {
    const raiz = o.pantalla;
    const kmTxt = raiz.querySelector("[data-rg-km]").value.trim().replace(",", ".");
    const km = kmTxt ? Number(kmTxt) : 0;
    if (!(km >= 0 && km <= 500)) {
      const e = raiz.querySelector("[data-rg-error]");
      e.textContent = "Escribe los km como número (por ejemplo 3,5) o déjalo vacío.";
      e.hidden = false;
      return;
    }
    const rpe = Number(raiz.querySelector("[data-rg-rpe]").value) || 0;
    const notes = raiz.querySelector("[data-rg-notas]").value.trim().slice(0, 200);
    const i = IM.info(rut, rut.fin);
    const activoS = Math.round(IM.activoMs(rut, rut.fin) / 1000);
    const doc = Object.assign({
      date: fechaLocal(rut.inicio),
      distance: Math.round(km * 100) / 100,
      duration: Math.max(0.1, Math.round(activoS / 6) / 10),
      notes,
      fuente: "rutina",
      inicio: rut.inicio,
      fin: rut.fin,
      tiempoActivoS: activoS,
      rutina: Object.assign({ nombre: meta.nombre, completados: i.completados, total: rut.plan.intervalos.length }, meta.id ? { id: meta.id } : {})
    }, rpe ? { rpe } : {});
    const usuario = db.collection("users").doc(currentUser.uid);
    const lote = db.batch();
    lote.set(usuario.collection("running").doc(), doc);
    // Completada: la rutina pasa al final de la lista.
    if (i.terminado && meta.id && RutinasRunning.obtener(meta.id)) {
      lote.update(usuario.collection("rutinas_running").doc(meta.id), { orden: RR.ordenAlFinal(RutinasRunning.lista()) });
    }
    // Sin conexión queda guardado en el teléfono y se sube solo al volver la red.
    lote.commit().catch(err => {
      console.error("Manolo: no se pudo guardar la rutina", err);
      alert("No se pudo guardar la rutina. Revisa tu conexión e inténtalo de nuevo.");
    });
    terminar(i.terminado ? "Rutina guardada. Pasó al final de la lista." : "Rutina guardada.");
  }
  function descartar() {
    if (!confirm("¿Descartar esta rutina? No se guardará.")) return;
    terminar();
  }

  function alTocar(e) {
    const b = e.target.closest("[data-rg]");
    if (!b || b.disabled) return;
    const a = b.dataset.rg;
    if (a === "abrir") abrir(b.dataset.id);
    else if (a === "importar") RutinasRunning.importar();
    else if (a === "plantilla") RutinasRunning.plantilla();
    else if (a === "borrar") RutinasRunning.borrar(b.dataset.id);
    else if (a === "sonido" || a === "voz") {
      const nuevo = !Avisos.prefs()[a];
      Avisos.cambiar(a, nuevo);
      b.setAttribute("aria-pressed", String(nuevo));
    }
    else if (a === "cancelar") { rut = null; meta = null; vista = "inicio"; render(); }
    else if (a === "iniciar") iniciar();
    else if (a === "pausar") pausar();
    else if (a === "reanudar") reanudar();
    else if (a === "finalizar") finalizar(false);
    else if (a === "volver") volver();
    else if (a === "guardar") guardar();
    else if (a === "descartar") descartar();
  }
  o.lista.addEventListener("click", alTocar);
  o.pantalla.addEventListener("click", alTocar);
  o.pantalla.addEventListener("input", e => {
    const er = o.pantalla.querySelector("[data-rg-error]");
    if (er && e.target.matches("[data-rg-km]")) er.hidden = true;
  });

  // Al salir de la app se guarda el estado (el iPhone puede cerrarla luego).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && rut && rut.estado !== "listo") guardarLocal();
    if (document.visibilityState === "visible") tic();
  });
  window.addEventListener("hashchange", modoPantalla);

  // Recuperar una rutina que quedó a medias.
  onAuthReady(() => {
    // Borrador de la pantalla con GPS (ya retirada): no se puede retomar.
    try { localStorage.removeItem("manolo.actividad." + currentUser.uid); } catch (e) { /* sin almacenamiento */ }
    const l = leerLocal();
    if (l && l.rut.estado !== "listo") {
      rut = l.rut;
      meta = l.meta || { nombre: rut.plan.nombre };
      if (rut.estado === "activo") {
        IM.pausar(rut, l.guardado);
        recuperada = true;
        if (IM.info(rut, l.guardado).terminado) IM.finalizar(rut, l.guardado);
      }
      vista = rut.estado === "finalizado" ? "resumen" : "vivo";
      guardarLocal();
    } else if (l) borrarLocal();
    render();
  });
  // La lista de rutinas llega de Firestore: se redibuja.
  RutinasRunning.alCambiar(() => { if (vista === "inicio" && currentUser) renderLista(); });

  return { vista: () => vista };
}

window.RutinaGuiada = { crear };
})();
