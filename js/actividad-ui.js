// ---------- Pantallas de una actividad con GPS (Running, y Bici en fase 5) ----------
// Inicio (botón y estado de la ubicación) → actividad en vivo (distancia,
// tiempo, ritmo o velocidad, trazo; Pausar / Reanudar / Finalizar) →
// resumen (métricas, mapa, parciales; Guardar o Descartar).
// Los cálculos son de js/actividad-motor.js, los textos y el trazo de
// js/actividad-vista.js y el GPS de js/actividad-gps.js.
//
// - Una sola actividad a la vez. Su estado se guarda en el teléfono cada
//   ~10 s, al pausar y al salir de la app; si Manolo se cierra, al volver se
//   recupera en pausa (desde el último guardado: no se inventa tiempo).
// - Se guarda una vez al terminar: resumen en users/{uid}/{coleccion} y la
//   ruta en users/{uid}/rutas/{mismo id}, en un solo lote.
// - El mapa con calles (Leaflet + OpenStreetMap) se carga solo en el
//   resumen y con conexión; si no, queda el trazo dibujado por el teléfono.
(function () {
const AM = ActividadMotor;
const V = ActividadVista;
const GPS = ActividadGps;
const GUARDAR_CADA_MS = 10000;
const RECUPERAR_MAX_MS = 12 * 3600000;
const AJUSTES_IOS = "En el iPhone: Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari › «Al usar la app».";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
const claveLocal = () => "manolo.actividad." + (currentUser ? currentUser.uid : "");
function leerLocal() {
  try {
    const o = JSON.parse(localStorage.getItem(claveLocal()) || "null");
    if (!o || !o.st || Date.now() - (o.guardado || 0) > RECUPERAR_MAX_MS) return null;
    return o;
  } catch (e) { return null; }
}
function fechaHora(ms) {
  const d = new Date(ms);
  const dia = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  return `${dia} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---- Mapa con calles, solo cuando se mira un resumen ----
let cargaLeaflet = null;
function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (cargaLeaflet) return cargaLeaflet;
  cargaLeaflet = new Promise((res, rej) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "vendor/leaflet-1.9.4/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "vendor/leaflet-1.9.4/leaflet.js";
    s.onload = () => (window.L ? res(window.L) : rej(new Error("Leaflet")));
    s.onerror = () => { cargaLeaflet = null; rej(new Error("Leaflet")); };
    document.head.appendChild(s);
  });
  return cargaLeaflet;
}
function pintarMapa(el, tramos) {
  const conPuntos = tramos.filter(t => t.length);
  el.innerHTML = conPuntos.length ? V.svgRuta(conPuntos, { ancho: 340, alto: 220 }) : `<p class="act-sin-ruta">Sin recorrido GPS.</p>`;
  if (!conPuntos.length || navigator.onLine === false) return;
  cargarLeaflet().then(L => {
    if (!el.isConnected) return;
    const div = document.createElement("div");
    div.className = "act-leaflet";
    el.innerHTML = "";
    el.appendChild(div);
    const movil = L.Browser.mobile;
    const mapa = L.map(div, { zoomControl: !movil, dragging: !movil, scrollWheelZoom: false, tap: false });
    const capa = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(mapa);
    const lineas = conPuntos.map(t => L.polyline(t.map(p => [p.lat, p.lon]), { color: "#ff7a30", weight: 4, opacity: 0.95 }).addTo(mapa));
    const ini = conPuntos[0][0], ult = conPuntos[conPuntos.length - 1];
    const fin = ult[ult.length - 1];
    L.circleMarker([ini.lat, ini.lon], { radius: 6, color: "#0a0a0a", weight: 2, fillColor: "#5fcf8a", fillOpacity: 1 }).addTo(mapa);
    L.circleMarker([fin.lat, fin.lon], { radius: 6, color: "#0a0a0a", weight: 2, fillColor: "#e2593f", fillOpacity: 1 }).addTo(mapa);
    mapa.fitBounds(L.featureGroup(lineas).getBounds(), { padding: [24, 24], maxZoom: 17 });
    // Sin teselas (sin red a mitad de camino): vuelve el trazo propio.
    let fallos = 0;
    capa.on("tileerror", () => { if (++fallos === 6 && el.isConnected) { mapa.remove(); el.innerHTML = V.svgRuta(conPuntos, { ancho: 340, alto: 220 }); } });
  }).catch(() => { /* queda el trazo SVG */ });
}
const tramosDeMotor = st => st.tramos.map(t => t.map(p => ({ lat: p[0], lon: p[1], t: p[2], alt: p[3] })));

// ---- Una pantalla de actividad por deporte ----
// o = { deporte, panel ("running"), contenedor, inicio (lo que se oculta
//       durante la actividad), coleccion, nombre ("carrera"), titulo ("Running") }
function crear(o) {
  const P = AM.PERFILES[o.deporte];
  const esRitmo = P.principal === "ritmo";
  const raiz = o.contenedor;
  let st = null;              // estado del motor
  let vista = "inicio";       // inicio · actividad · resumen
  let guardada = null;        // actividad ya guardada que se está mirando
  let antesDeFinalizar = null;
  let pararGps = null;
  let ultimaPos = null;       // última posición cruda (también antes de iniciar)
  let errorGps = null;
  let recuperada = false;
  let pantallaOk = true;
  let ultimoGuardadoLocal = 0;
  let estadoPintado = null;
  let aviso = "";
  let reloj = null;

  const Nombre = o.nombre.charAt(0).toUpperCase() + o.nombre.slice(1);

  function guardarLocal() {
    if (!st || !currentUser) return;
    ultimoGuardadoLocal = Date.now();
    try { localStorage.setItem(claveLocal(), JSON.stringify({ deporte: o.deporte, guardado: ultimoGuardadoLocal, st })); } catch (e) { /* sin espacio */ }
  }
  function borrarLocal() {
    try { localStorage.removeItem(claveLocal()); } catch (e) { /* sin almacenamiento */ }
  }
  function otraEnCurso() {
    const l = leerLocal();
    return l && l.deporte !== o.deporte && l.st.estado !== "listo" ? l : null;
  }

  function modoPantalla() {
    const enPanel = location.hash === "#" + o.panel;
    document.body.classList.toggle("act-en-curso", enPanel && vista !== "inicio" && !guardada);
    if (o.inicio) o.inicio.hidden = vista !== "inicio";
  }
  function pintarEnCurso() {
    const l = leerLocal();
    document.querySelectorAll(`[data-act-en-curso="${o.deporte}"]`).forEach(el => {
      el.hidden = !(l && l.deporte === o.deporte && l.st.estado !== "listo");
    });
  }

  // ---- GPS ----
  function arrancarGps() {
    if (pararGps) return;
    errorGps = null;
    pararGps = GPS.vigilar(p => {
      ultimaPos = p;
      errorGps = null;
      if (st && st.estado === "activo") AM.punto(st, p);
      if (vista === "actividad") pintarVivo();
    }, err => {
      errorGps = err;
      if (err.codigo === 1) detenerGps();
      if (vista === "actividad") pintarVivo();
    });
  }
  function detenerGps() {
    if (pararGps) pararGps();
    pararGps = null;
  }

  function tic() {
    if (vista !== "actividad" || !st) return;
    pintarVivo();
    if (st.estado === "activo" && Date.now() - ultimoGuardadoLocal >= GUARDAR_CADA_MS) guardarLocal();
  }
  function relojOn() { if (!reloj) reloj = setInterval(tic, 1000); }
  function relojOff() { clearInterval(reloj); reloj = null; }

  // ---- Vistas ----
  function render() {
    relojOff();
    estadoPintado = null;
    if (vista === "actividad") { raiz.innerHTML = htmlVivo(); pintarVivo(); relojOn(); }
    else if (vista === "resumen") renderResumen();
    else renderInicio();
    if (typeof renderIcons === "function") renderIcons(raiz);
    modoPantalla();
    pintarEnCurso();
  }

  function renderInicio() {
    const otra = otraEnCurso();
    raiz.innerHTML = `
      <div class="act-inicio">
        <button type="button" class="act-btn-grande" data-act="preparar"${otra ? " disabled" : ""}>
          <span class="icon-sm" data-icon="${o.deporte === "running" ? "running" : "cycling"}"></span> Iniciar ${o.nombre}
        </button>
        <p class="act-permiso" data-act-permiso>${otra ? "Tienes otra actividad sin terminar: termínala primero." : ""}</p>
        <p class="act-ayuda">Durante la ${o.nombre} mantén la pantalla encendida y Manolo abierto: con el teléfono bloqueado el iPhone no registra el GPS.</p>
        ${aviso ? `<p class="act-ok" role="status">${escapeHtml(aviso)}</p>` : ""}
      </div>`;
    aviso = "";
    if (otra) return;
    if (!GPS.disponible()) { raiz.querySelector("[data-act-permiso]").textContent = "Este navegador no tiene GPS: puedes registrar a mano."; return; }
    GPS.permiso().then(estado => {
      const el = raiz.querySelector("[data-act-permiso]");
      if (!el) return;
      el.textContent = {
        granted: "Ubicación permitida.",
        prompt: "Al iniciar, el teléfono te pedirá permiso para usar tu ubicación.",
        denied: "La ubicación está bloqueada para Manolo. " + AJUSTES_IOS
      }[estado] || "";
      el.classList.toggle("is-mal", estado === "denied");
    });
  }

  function htmlVivo() {
    const medio = esRitmo ? "Ritmo medio" : "Vel. media";
    return `
      <div class="act-vivo">
        <div class="act-top">
          <span class="act-dep">${escapeHtml(o.titulo)}</span>
          <span class="act-gps" data-act-gps></span>
        </div>
        <div class="act-principal">
          <span class="act-lbl">Distancia</span>
          <strong class="act-grande" data-act-dist>0,00</strong><span class="act-unidad">km</span>
        </div>
        <div class="act-fila">
          <div><span class="act-lbl">Tiempo</span><strong data-act-tiempo>0:00</strong></div>
          <div><span class="act-lbl">${esRitmo ? "Ritmo" : "Velocidad"}</span><strong data-act-actual>--</strong><small>${esRitmo ? "/km" : "km/h"}</small></div>
          <div><span class="act-lbl">${medio}</span><strong data-act-medio>--</strong><small>${esRitmo ? "/km" : "km/h"}</small></div>
        </div>
        <div class="act-ruta-vivo" data-act-ruta></div>
        <p class="act-nota" data-act-nota role="status"></p>
        <div class="act-botones" data-act-botones></div>
      </div>`;
  }

  function pintarBotones() {
    const b = raiz.querySelector("[data-act-botones]");
    if (!b) return;
    if (st.estado === "listo") b.innerHTML = `
      <button type="button" class="act-btn-sec" data-act="cancelar">Cancelar</button>
      <button type="button" class="act-btn-redondo" data-act="iniciar">Iniciar</button>`;
    else if (st.estado === "activo") b.innerHTML = `<button type="button" class="act-btn-redondo is-pausa" data-act="pausar">Pausar</button>`;
    else if (st.estado === "pausado") b.innerHTML = `
      <button type="button" class="act-btn-redondo" data-act="reanudar">Reanudar</button>
      <button type="button" class="act-btn-redondo is-fin" data-act="finalizar">Finalizar</button>`;
    estadoPintado = st.estado;
  }

  function pintarVivo() {
    if (!st || !raiz.querySelector(".act-vivo")) return;
    const ahora = Date.now();
    if (estadoPintado !== st.estado) pintarBotones();
    const m = AM.metricas(st, ahora);
    const txt = (sel, t) => { const el = raiz.querySelector(sel); if (el && el.textContent !== t) el.textContent = t; };
    txt("[data-act-dist]", V.distancia(m.distanciaM).replace(" km", ""));
    txt("[data-act-tiempo]", V.tiempo(m.tiempoActivoS));
    txt("[data-act-actual]", esRitmo ? V.ritmo(m.ritmoActualSKm, true) : V.velocidad(m.velActualMs, true));
    txt("[data-act-medio]", esRitmo ? V.ritmo(m.ritmoMedioSKm, true) : V.velocidad(m.velMediaMs, true));

    // Estado del GPS (antes de iniciar se mira la última posición recibida).
    let estadoGps;
    if (errorGps) estadoGps = "error";
    else if (st.estado === "listo" || st.estado === "pausado") {
      estadoGps = !ultimaPos ? "esperando" : ahora - ultimaPos.t > AM.HUECO_MS ? "sin señal" : ultimaPos.acc > P.accMax ? "impreciso" : "ok";
    } else estadoGps = m.gps;
    const gps = raiz.querySelector("[data-act-gps]");
    gps.textContent = errorGps ? "GPS no disponible" : st.estado === "pausado" && !pararGps ? "GPS en pausa" : V.textoGps(estadoGps, ultimaPos && ultimaPos.acc);
    gps.className = "act-gps " + (estadoGps === "ok" ? "is-ok" : estadoGps === "esperando" ? "is-buscando" : "is-mal");

    let nota = "";
    if (errorGps) nota = errorGps.texto + (errorGps.codigo === 1 ? " " + AJUSTES_IOS : "") + " El tiempo se puede registrar igual.";
    else if (st.estado === "listo") nota = estadoGps === "ok" ? "Todo listo. Toca Iniciar cuando quieras." : "Esperando señal del GPS. Puedes iniciar igual: la distancia empieza a contar cuando haya señal.";
    else if (st.estado === "pausado") nota = recuperada ? `Recuperamos tu ${o.nombre}: quedó en pausa al cerrarse Manolo.` : "En pausa: el tiempo no corre.";
    else if (estadoGps === "sin señal") nota = "Sin señal: el tiempo sigue. Al volver la señal, el tramo perdido se suma en línea recta (estimado).";
    else if (estadoGps === "impreciso") nota = "GPS impreciso: esos puntos no se cuentan.";
    else if (!pantallaOk) nota = "Tu teléfono podría apagar la pantalla: si se bloquea, el GPS se detiene.";
    txt("[data-act-nota]", nota);

    const ruta = raiz.querySelector("[data-act-ruta]");
    const n = st.cuenta.aceptado;
    if (ruta.dataset.n !== String(n)) {
      ruta.dataset.n = String(n);
      ruta.innerHTML = n > 1 ? V.svgRuta(tramosDeMotor(st), { ancho: 340, alto: 180, maxPuntos: 400 }) : `<p class="act-sin-ruta">${st.estado === "listo" ? "El recorrido aparecerá aquí." : "Esperando puntos del GPS…"}</p>`;
    }
  }

  function datosResumen() {
    if (guardada) return { doc: guardada.doc, tramos: guardada.tramos };
    const { documento } = AM.resumen(st);
    return { doc: documento, tramos: tramosDeMotor(st) };
  }

  function renderResumen() {
    const { doc: d, tramos } = datosResumen();
    const distM = d.distanciaM != null ? d.distanciaM : (d.distance || 0) * 1000;
    const movS = d.tiempoMovS || 0;
    const vMedia = movS > 0 ? distM / movS : 0;
    const peso = esRitmo && window.EjercicioDatos ? V.pesoActual(EjercicioDatos.estado.perfil && EjercicioDatos.estado.perfil.pesajes, EjercicioDatos.estado.ajustes && EjercicioDatos.estado.ajustes.pesoCorporal) : null;
    const kcal = esRitmo ? V.caloriasRunning(distM, peso) : null;
    const tile = (lbl, val, nota) => `<div class="act-tile"><span>${lbl}</span><strong>${val}</strong>${nota ? `<small>${nota}</small>` : ""}</div>`;
    const tiles = [
      tile("Distancia", V.distancia(distM)),
      tile("Tiempo", V.tiempo(d.tiempoActivoS)),
      esRitmo ? tile("Ritmo medio", V.ritmo(vMedia > 0 ? 1000 / vMedia : null)) : tile("Velocidad media", V.velocidad(vMedia)),
      tile("En movimiento", V.tiempo(movS)),
      tile("Tiempo total", V.tiempo(d.tiempoTotalS), "con pausas"),
      esRitmo ? tile("Velocidad media", V.velocidad(vMedia)) : tile("Velocidad máx.", `${String(d.velMaxKmh || 0).replace(".", ",")} km/h`),
      tile("Desnivel", d.desnivelPosM != null ? `+${V.desnivel(d.desnivelPosM)} / −${V.desnivel(d.desnivelNegM)}` : V.desnivel(null), d.desnivelPosM != null ? "aprox. (GPS)" : ""),
      esRitmo && kcal != null ? tile("Calorías", `${kcal} kcal`, "estimado") : ""
    ].join("");
    const parciales = (d.parciales || []);
    const tamP = P.parcialM / 1000;
    const mejor = Math.min(...parciales.filter(s => s > 0));
    const filasP = parciales.map((s, i) => {
      const v = P.parcialM / s;
      return `<li><span>${(i + 1) * tamP} km</span><span class="act-p-barra"><i style="width:${(mejor / s * 100).toFixed(1)}%"></i></span><span>${esRitmo ? V.ritmo(s) : V.velocidad(v)}</span><span>${V.tiempo(s)}</span></li>`;
    }).join("");
    const nuevo = !guardada;
    raiz.innerHTML = `
      <div class="act-resumen">
        <h2 class="act-titulo">${nuevo ? `${Nombre} completada` : `Tu ${o.nombre}`}</h2>
        <p class="act-fecha">${escapeHtml(fechaHora(d.inicio || Date.now()))}</p>
        <div class="act-mapa" data-act-mapa></div>
        <div class="act-tiles">${tiles}</div>
        ${d.huecoM ? `<p class="act-aviso">Incluye ${Math.round(d.huecoM)} m estimados en línea recta por pérdida de señal del GPS.</p>` : ""}
        ${filasP ? `<h3 class="act-sub">Parciales</h3><ol class="act-parciales">${filasP}</ol>` : ""}
        ${nuevo ? `
          <div class="act-extra">
            <label>Esfuerzo (RPE)
              <select data-act-rpe>
                <option value="">Opcional</option>
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}">${n}${n === 1 ? " · muy suave" : n === 5 ? " · moderado" : n === 8 ? " · duro" : n === 10 ? " · máximo" : ""}</option>`).join("")}
              </select></label>
            <label>Notas <input type="text" data-act-notas maxlength="200" placeholder="Opcional"></label>
          </div>
          <div class="act-acciones">
            <button type="button" class="act-btn-grande" data-act="guardar">Guardar ${o.nombre}</button>
            ${antesDeFinalizar ? `<button type="button" class="act-btn-sec" data-act="volver">Volver a la ${o.nombre}</button>` : ""}
            <button type="button" class="act-btn-peligro" data-act="descartar">Descartar</button>
          </div>` : `
          ${d.notes ? `<p class="act-notas-guardadas">${escapeHtml(d.notes)}</p>` : ""}
          <div class="act-acciones">
            <button type="button" class="act-btn-sec" data-act="cerrar">Cerrar</button>
            <button type="button" class="act-btn-peligro" data-act="eliminar">Eliminar</button>
          </div>`}
      </div>`;
    pintarMapa(raiz.querySelector("[data-act-mapa]"), tramos || []);
    window.scrollTo(0, 0);
  }

  // ---- Acciones ----
  function preparar() {
    if (otraEnCurso()) return;
    st = AM.crear(o.deporte);
    recuperada = false;
    vista = "actividad";
    render();
    arrancarGps();
  }
  function iniciar() {
    const t = Date.now();
    AM.iniciar(st, t);
    // La última posición buena (si es reciente) marca el punto de partida.
    if (ultimaPos && t - ultimaPos.t < 5000) AM.punto(st, Object.assign({}, ultimaPos, { t }));
    GPS.pedirPantalla().then(ok => { pantallaOk = ok; });
    guardarLocal();
    pintarVivo();
    pintarEnCurso();
  }
  function pausar() {
    AM.pausar(st, Date.now());
    GPS.soltarPantalla();
    guardarLocal();
    pintarVivo();
  }
  function reanudar() {
    recuperada = false;
    AM.reanudar(st, Date.now());
    arrancarGps();
    GPS.pedirPantalla().then(ok => { pantallaOk = ok; });
    guardarLocal();
    pintarVivo();
  }
  function finalizar() {
    antesDeFinalizar = JSON.parse(JSON.stringify(st));
    AM.finalizar(st, Date.now());
    detenerGps();
    GPS.soltarPantalla();
    guardarLocal();
    vista = "resumen";
    render();
  }
  function volver() {
    if (!antesDeFinalizar) return;
    st = antesDeFinalizar;
    antesDeFinalizar = null;
    vista = "actividad";
    guardarLocal();
    render();
    arrancarGps();
  }
  function terminar(mensaje) {
    detenerGps();
    GPS.soltarPantalla();
    borrarLocal();
    st = null;
    antesDeFinalizar = null;
    guardada = null;
    vista = "inicio";
    aviso = mensaje || "";
    render();
  }
  function guardar() {
    const rpe = Number(raiz.querySelector("[data-act-rpe]").value) || 0;
    const notas = raiz.querySelector("[data-act-notas]").value.trim();
    const { documento, ruta } = AM.resumen(st, Object.assign({}, rpe ? { rpe } : {}, notas ? { notes: notas } : {}));
    const usuario = db.collection("users").doc(currentUser.uid);
    const ref = usuario.collection(o.coleccion).doc();
    const lote = db.batch();
    lote.set(ref, documento);
    if (ruta) lote.set(usuario.collection("rutas").doc(ref.id), ruta);
    // Sin conexión queda guardado en el teléfono y se sube solo al volver la red.
    lote.commit().catch(err => {
      console.error("Manolo: no se pudo guardar la actividad", err);
      alert(`No se pudo guardar la ${o.nombre}. Revisa tu conexión e inténtalo de nuevo.`);
    });
    terminar(`${Nombre} guardada.`);
  }
  function descartar() {
    if (!confirm(`¿Descartar esta ${o.nombre}? No se guardará.`)) return;
    terminar();
  }
  function eliminarGuardada() {
    if (!guardada || !confirm(`¿Eliminar esta ${o.nombre}? No se puede deshacer.`)) return;
    const usuario = db.collection("users").doc(currentUser.uid);
    const lote = db.batch();
    lote.delete(usuario.collection(o.coleccion).doc(guardada.id));
    if (guardada.doc.conRuta) lote.delete(usuario.collection("rutas").doc(guardada.id));
    lote.commit().catch(err => console.error("Manolo: no se pudo eliminar", err));
    terminar(`${Nombre} eliminada.`);
  }

  raiz.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === "preparar") preparar();
    else if (a === "cancelar") { detenerGps(); st = null; vista = "inicio"; render(); }
    else if (a === "iniciar") iniciar();
    else if (a === "pausar") pausar();
    else if (a === "reanudar") reanudar();
    else if (a === "finalizar") finalizar();
    else if (a === "volver") volver();
    else if (a === "guardar") guardar();
    else if (a === "descartar") descartar();
    else if (a === "cerrar") { guardada = null; vista = "inicio"; render(); }
    else if (a === "eliminar") eliminarGuardada();
  });

  // Al salir de la app se guarda el estado (el iPhone puede cerrarla luego).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && st && st.estado !== "listo") guardarLocal();
    if (document.visibilityState === "visible") tic();
  });
  window.addEventListener("hashchange", modoPantalla);

  // Recuperar una actividad que quedó a medias.
  onAuthReady(() => {
    const l = leerLocal();
    if (l && l.deporte === o.deporte) {
      st = l.st;
      if (st.estado === "activo") { AM.pausar(st, l.guardado); recuperada = true; }
      if (st.estado === "listo") { st = null; borrarLocal(); }
      else vista = st.estado === "finalizado" ? "resumen" : "actividad";
      if (st && st.estado !== "finalizado") guardarLocal();
    }
    render();
  });

  return {
    // Abre el resumen de una actividad ya guardada (desde la lista).
    abrirGuardada(entrada) {
      if (vista !== "inicio") return;
      guardada = { id: entrada.id, doc: entrada, tramos: [] };
      vista = "resumen";
      render();
      if (!entrada.conRuta) return;
      db.collection("users").doc(currentUser.uid).collection("rutas").doc(entrada.id).get().then(doc => {
        if (!guardada || guardada.id !== entrada.id || !doc.exists) return;
        guardada.tramos = AM.leerRuta(doc.data());
        const el = raiz.querySelector("[data-act-mapa]");
        if (el) pintarMapa(el, guardada.tramos);
      }).catch(err => console.warn("Manolo: no se pudo leer la ruta", err && err.code));
    },
    vista: () => vista
  };
}

window.ActividadUI = { crear };
})();
