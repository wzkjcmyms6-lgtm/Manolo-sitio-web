// ---------- Hábitos: pantallas (Hoy, Estadísticas, Logros) y Firestore ----------
// Los cálculos (rachas, XP, nivel, estados de cada día) salen de
// js/habitos-engine.js; aquí solo se leen y escriben los datos y se dibuja.
// Cada día se guarda por separado en registros.AAAA-MM-DD (escritura por
// ruta de campo), así dos toques rápidos o dos pestañas no se pisan. Para no
// romper nada, los hábitos Sí/No también siguen anotando el día en `done`.
(function () {

const HE = HabitosEngine;
const HC = HabitosConfig;

const EMOJIS = ["💧", "🏃", "🧘", "📖", "💪", "🛌", "🥗", "🚭", "🧹", "🙏", "💊", "🎯", "✍️", "🎨", "🚴", "🧠",
  "🦷", "☀️", "🌙", "📵", "🍎", "🚶", "🎸", "💰", "📚", "🧴", "🫁", "❤️"];
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_NOMBRES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const HEAT_SEMANAS = 10;
const TOAST_MS = 6000;

// ---------- Estado ----------
let docs = {};          // id → datos crudos de Firestore (para Deshacer y notas)
let normal = {};        // id → hábito normalizado por el motor
let juego = {};         // meta/habitos_juego: preferencias, recompensas, compras, misiones y snapshot
let juegoCargado = false;
let res = null;         // último HE.evaluar()
let cargado = false;
let pendienteXP = null; // { id, xp } para mostrar "+N XP" tras marcar
let ultimoMarcado = null;
let momentoPintado = null;
let diasMeta = {};      // meta/habitos_dias: ánimo y nota de cada día
const pendientesAuto = []; // marcados automáticos que llegaron antes de cargar

const panelHoy = document.getElementById("panel-habitos");
const panelStats = document.getElementById("panel-hab-stats");

function coleccion() {
  return db.collection("users").doc(currentUser.uid).collection("habitos");
}
function metaJuego() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("habitos_juego");
}
function metaDias() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("habitos_dias");
}
const FV = () => firebase.firestore.FieldValue;
const FP = (...p) => new firebase.firestore.FieldPath(...p);

function finDia() {
  return (juego.prefs && juego.prefs.finDia) || HC.CONST.FIN_DIA_DEFECTO;
}
function hoy() {
  return HE.fechaLogica(Date.now(), finDia());
}

// ---------- Utilidades ----------
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fechaCorta(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}` + (y !== new Date().getFullYear() ? ` ${y}` : "");
}
function fmtNum(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}
function momentoActual() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? "manana" : h >= 12 && h < 19 ? "tarde" : "noche";
}
const reducirMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function freqTexto(h) {
  if (h.tipo === "evitar") return "Evitar";
  if (h.freqType === "semana") return `${plural(h.timesPerWeek, "vez", "veces")} por semana`;
  if (h.freqType === "cadaN") return `Cada ${h.cadaN} días`;
  if (h.freqType === "dias") {
    const d = h.days.map((on, i) => (on ? DIAS_NOMBRES[i] : null)).filter(Boolean);
    return d.length === 7 ? "Todos los días" : d.join(", ") || "Sin días elegidos";
  }
  return "Todos los días";
}

function textoRacha(r) {
  if (!r) return "";
  if (r.unidad === "limpios") return plural(r.actual, "día limpio", "días limpios");
  if (!r.actual) return "";
  return r.unidad === "semanas" ? plural(r.actual, "semana", "semanas") : plural(r.actual, "día", "días");
}

// ---------- Cálculo ----------
function compras() {
  return Object.keys(juego.compras || {}).map(id => Object.assign({ id }, juego.compras[id])).filter(c => c && c.t)
    .sort((a, b) => a.t - b.t);
}
// Áreas por defecto con los nombres que hayas elegido en Ajustes.
function areasDef() {
  const nombres = (juego.prefs && juego.prefs.areas) || {};
  return HC.AREAS.map(a => ({ id: a.id, nombre: String(nombres[a.id] || "").trim() || a.nombre }));
}
function nombreArea(id) {
  const a = areasDef().find(x => x.id === id);
  return a ? a.nombre : null;
}
function recalcular() {
  const lista = Object.keys(normal).map(id => normal[id]);
  res = HE.evaluar(lista, { hoy: hoy(), finDia: finDia(), compras: compras(), misiones: juego.misiones || {}, areas: areasDef() });
}

// Misiones: se generan una vez por semana (el primer día que abras la app) y
// se guardan para que no cambien si corriges días pasados.
let misionGenerada = null;
function asegurarMisiones() {
  if (!juegoCargado || !res) return;
  const lunes = HE.lunesDe(res.hoy);
  const sem = HE.semanaId(lunes);
  if ((juego.misiones || {})[sem] || misionGenerada === sem) return;
  if (!activos().some(h => h.tipo !== "evitar")) return;
  misionGenerada = sem;
  const nuevas = HE.generarMisiones(res, lunes);
  juego = Object.assign({}, juego, { misiones: Object.assign({}, juego.misiones, { [sem]: nuevas }) });
  metaJuego().set({ misiones: { [sem]: nuevas } }, { merge: true }).catch(errorGuardar);
  recalcular();
}

// Hábitos visibles (sin archivar), en su orden.
function activos() {
  return Object.keys(normal).map(id => normal[id]).filter(h => !h.archivado)
    .sort((a, b) => a.orden - b.orden || (a.createdAt || 0) - (b.createdAt || 0));
}

// Estado de un hábito hoy, listo para dibujar la fila.
function filaHoy(h, f) {
  const rh = res.habitos[h.id];
  const d = (rh && rh.dias[f]) || { clase: "fuera", estado: null, fraccion: 0 };
  const semanal = h.freqType === "semana";
  const pausa = HE.enPausa(h, f);
  const toca = !pausa && (h.tipo === "evitar" || semanal || HE.tocaDia(h, f));
  // En medibles, "hecho" es llegar a la meta; un parcial solo mantiene la racha.
  const medible = h.tipo === "medible" || h.tipo === "tiempo";
  const hecho = h.tipo === "evitar" ? d.estado !== "recaida"
    : medible ? d.estado === "hecho" || d.estado === "minima"
    : d.clase === "cumple" || d.clase === "extra";
  const semanaOk = semanal && rh && rh.semanaActual && rh.semanaActual.estado === "cumple";
  return { rh, d, semanal, pausa, toca, hecho, semanaOk };
}

// ---------- Escena de la hora del día ----------
function arbol(x, escala, fill, luz) {
  return `<g transform="translate(${x},0) scale(${escala})">
    <rect x="-2" y="58" width="4" height="16" fill="#241f19"/>
    <ellipse cx="0" cy="50" rx="17" ry="19" fill="${fill}"/>
    <ellipse cx="6" cy="43" rx="6" ry="7" fill="${luz}" opacity="0.75"/></g>`;
}
function colinas(fill) {
  return `<path d="M0,112 C60,88 130,88 190,108 C250,128 310,82 400,98 L400,150 L0,150 Z" fill="${fill}"/>`;
}
function estrellas() {
  return [[36, 30], [96, 18], [150, 42], [210, 22], [270, 34], [320, 16], [360, 46], [60, 55]]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.6 : 1}" fill="#e9e4d8" opacity="${0.35 + (i % 4) * 0.15}"/>`).join("");
}
function escenaSVG(momento) {
  const arboles = arbol(40, 0.9, "#3f7d6f", "#5aa08f") + arbol(345, 1.05, "#376c60", "#4f9585") + arbol(280, 0.55, "#3f7d6f", "#5aa08f");
  const abre = `<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">`;
  if (momento === "noche") {
    return abre + `<rect width="400" height="150" fill="#0c0b10"/>${estrellas()}
      <circle cx="150" cy="46" r="20" fill="#f4d9a3"/><circle cx="158" cy="40" r="18" fill="#0c0b10"/>
      ${colinas("#1a1712")}${arboles}</svg>`;
  }
  if (momento === "tarde") {
    return abre + `<defs><linearGradient id="hb-cielo-tarde" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2b1630"/><stop offset="55%" stop-color="#7a3a2a"/><stop offset="100%" stop-color="#d9772e"/></linearGradient></defs>
      <rect width="400" height="150" fill="url(#hb-cielo-tarde)"/>
      <circle cx="250" cy="100" r="62" fill="var(--accent-1)" opacity="0.2"/>
      <circle cx="250" cy="100" r="24" fill="#ffc27a"/>
      ${colinas("#241a16")}${arboles}</svg>`;
  }
  return abre + `<defs><linearGradient id="hb-cielo-manana" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c140f"/><stop offset="100%" stop-color="#3a2312"/></linearGradient></defs>
    <rect width="400" height="150" fill="url(#hb-cielo-manana)"/>
    <circle cx="180" cy="108" r="60" fill="var(--accent-1)" opacity="0.18"/>
    <circle cx="180" cy="108" r="38" fill="var(--accent-2)" opacity="0.35"/>
    <circle cx="180" cy="108" r="20" fill="#ffd9a0"/>
    ${colinas("#1f1a13")}${arboles}</svg>`;
}

// ---------- Pantalla Hoy ----------
function anilloSVG(hechos, total) {
  const r = 27, c = 2 * Math.PI * r;
  const fr = total ? hechos / total : 0;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="${r}" class="hb-anillo-fondo"/>
    <circle cx="32" cy="32" r="${r}" class="hb-anillo-valor" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - fr)).toFixed(1)}" transform="rotate(-90 32 32)"/>
  </svg>`;
}

// Progreso de hoy: lo que toca hoy (los semanales cuentan mientras su semana
// esté abierta); los de Evitar no entran porque se cumplen solos.
function progresoHoy(f) {
  let hechos = 0, total = 0;
  activos().forEach(h => {
    if (h.tipo === "evitar" || !HE.activoEn(h, f)) return;
    const x = filaHoy(h, f);
    if (!x.toca) return;
    if (x.semanal && x.semanaOk && !x.hecho) { hechos++; total++; return; }
    total++;
    if (x.hecho) hechos++;
  });
  return { hechos, total };
}

function mejorRachaActiva() {
  let mejor = null;
  activos().forEach(h => {
    const r = res.habitos[h.id] && res.habitos[h.id].racha;
    if (!r || r.unidad === "limpios") return;
    const dias = r.unidad === "semanas" ? r.actual * 7 : r.actual;
    if (!mejor || dias > mejor.dias) mejor = { dias, r };
  });
  return mejor && mejor.r.actual ? mejor.r : null;
}

function pintarPersonaje(f) {
  const el = document.getElementById("hb-personaje");
  if (!el.dataset.listo) {
    el.innerHTML = `<div class="hb-escena">${["manana", "tarde", "noche"].map(m => `<div class="hb-capa" data-escena="${m}">${escenaSVG(m)}</div>`).join("")}</div>
      <div class="hb-pj"></div>`;
    el.dataset.listo = "1";
  }
  const momento = momentoActual();
  if (momento !== momentoPintado) {
    el.querySelectorAll(".hb-capa").forEach(c => c.classList.toggle("is-on", c.dataset.escena === momento));
    momentoPintado = momento;
  }
  const p = progresoHoy(f);
  const n = res.nivel;
  const racha = mejorRachaActiva();
  const monedas = res.monedas.saldo;
  el.querySelector(".hb-pj").innerHTML = `
    <div class="hb-anillo" role="img" aria-label="${p.hechos} de ${p.total} hábitos de hoy">
      ${anilloSVG(p.hechos, p.total)}<span class="hb-anillo-num">${p.hechos}<small>/${p.total}</small></span>
    </div>
    <div class="hb-pj-info">
      <div class="hb-pj-nivel"><span class="hb-num">${n.nivel}</span><span><span class="hb-pj-t">Nivel</span><span class="hb-pj-titulo">${escapeHtml(n.titulo)}</span></span></div>
      <div class="hb-xp" role="progressbar" aria-label="Experiencia hacia el nivel ${n.nivel + 1}" aria-valuemin="0" aria-valuemax="${n.hasta - n.desde}" aria-valuenow="${n.xp - n.desde}">
        <span style="width:${(n.progreso * 100).toFixed(1)}%"></span>
      </div>
      <div class="hb-pj-datos">
        <span>${fmtNum(n.xp - n.desde)} / ${fmtNum(n.hasta - n.desde)} XP</span>
        ${racha ? `<span class="hb-dato"><span class="hb-ico" data-icon="flame"></span>${escapeHtml(textoRacha(racha))}</span>` : ""}
        <span class="hb-dato"><span class="hb-ico" data-icon="coin"></span>${fmtNum(monedas)}</span>
      </div>
    </div>`;
}

function botonCheck(h, x) {
  const nombre = escapeHtml(h.name);
  if (h.tipo === "evitar") {
    const rec = x.d.estado === "recaida";
    return `<button type="button" class="hb-recaida${rec ? " is-on" : ""}" data-marcar="${h.id}" aria-pressed="${rec}"
      aria-label="${rec ? `Quitar la recaída de hoy en ${nombre}` : `Registrar una recaída en ${nombre}`}">${rec ? "Recaíste" : "Recaída"}</button>`;
  }
  const medible = h.tipo === "medible";
  const fr = x.d.fraccion || 0;
  let cont;
  if (x.hecho) cont = `<span data-icon="check"></span>`;
  else if (medible) cont = `<span class="hb-mas">+1</span>`;
  else cont = "";
  const arco = !x.hecho && fr > 0 ? (() => {
    const r = 19, c = 2 * Math.PI * r;
    return `<svg class="hb-check-arco" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - fr)).toFixed(1)}" transform="rotate(-90 22 22)"/></svg>`;
  })() : "";
  const etiqueta = medible ? `Sumar 1 a ${nombre}` : x.hecho ? `Desmarcar ${nombre}` : `Marcar ${nombre}`;
  return `<button type="button" class="hb-check${x.hecho ? " is-hecho" : ""}${ultimoMarcado === h.id ? " hb-pop" : ""}" data-marcar="${h.id}"
    aria-pressed="${x.hecho}" aria-label="${etiqueta}">${arco}${cont}</button>`;
}

function subtitulo(h, x, f) {
  const partes = [];
  const reg = h.registros[f];
  if (x.pausa) {
    const p = h.pausas.find(q => f >= q.desde && f <= q.hasta);
    partes.push(`En pausa hasta el ${fechaCorta(p.hasta)}`);
  } else if (!x.toca) {
    partes.push("No toca hoy");
  } else if (x.d.estado === "saltado") {
    const m = HC.MOTIVOS_SALTO.find(q => reg && q.id === reg.m);
    partes.push(`Saltado${m ? " · " + m.nombre.toLowerCase() : ""}`);
  } else if (x.d.estado === "minima") {
    partes.push("Versión mínima");
  } else if (h.tipo === "medible" || h.tipo === "tiempo") {
    partes.push(`${fmtNum(x.d.valor || (x.hecho ? h.meta : 0))}/${fmtNum(h.meta)} ${escapeHtml(h.unidad)}`.trim());
  } else if (x.d.estado === "parcial") {
    partes.push("Parcial");
  }
  if (x.semanal && x.rh && x.rh.semanaActual) {
    const s = x.rh.semanaActual;
    partes.push(s.estado === "cumple" ? `Semana cumplida (${s.hechas}/${s.meta})` : `${s.hechas}/${s.meta} esta semana`);
  }
  const padre = h.despuesDe && normal[h.despuesDe];
  if (padre && !padre.archivado) partes.unshift(`Después de ${escapeHtml(padre.name)}`);
  const racha = textoRacha(x.rh && x.rh.racha);
  return { texto: partes.join(" · "), racha };
}

function filaHtml(h, f, encadenado) {
  const x = filaHoy(h, f);
  const sub = subtitulo(h, x, f);
  const clases = ["hb-fila", x.hecho && h.tipo !== "evitar" ? "is-hecho" : "", !x.toca ? "is-apagada" : "", encadenado ? "is-encadenado" : ""].filter(Boolean).join(" ");
  const crono = cronoInicio(h.id);
  return `<li class="${clases}">
    <button type="button" class="hb-fila-info" data-detalle="${h.id}" aria-label="Ver detalle de ${escapeHtml(h.name)}">
      <span class="hb-emoji" aria-hidden="true">${escapeHtml(h.emoji)}</span>
      <span class="hb-fila-txt">
        <span class="hb-nombre">${escapeHtml(h.name)}</span>
        <span class="hb-sub">${crono ? `<span class="hb-crono-fila"><span class="hb-crono" data-inicio="${crono}">${textoCrono(crono)}</span> en curso</span>` : ""}${sub.texto ? `<span>${sub.texto}</span>` : ""}${sub.racha ? `<span class="hb-racha"><span class="hb-ico" data-icon="flame"></span>${escapeHtml(sub.racha)}</span>` : ""}</span>
      </span>
    </button>
    ${insigniaFila(x.rh)}
    ${x.toca ? botonCheck(h, x) : ""}
  </li>`;
}

function renderHoy() {
  if (!cargado || !res) return;
  const f = res.hoy;
  pintarPersonaje(f);
  const lista = document.getElementById("hb-lista");
  const todos = activos().filter(h => HE.activoEn(h, f) || h.inicio > f);
  if (!todos.length) {
    lista.innerHTML = `<div class="hb-vacio">
      <p class="hb-vacio-t">Tu primer hábito empieza aquí</p>
      <p>Elige algo pequeño que quieras hacer a diario, como tomar agua o leer 10 minutos.</p>
      <button type="button" class="hb-btn" data-nuevo>Crear un hábito</button></div>`;
    renderIcons(lista);
    return;
  }
  const actual = momentoActual();
  const orden = [actual, "cualquiera"].concat(["manana", "tarde", "noche"].filter(m => m !== actual));
  const hoyToca = [], noToca = [];
  todos.forEach(h => (filaHoy(h, f).toca ? hoyToca : noToca).push(h));
  // Un hábito encadenado va en el grupo de su primer eslabón que toque hoy.
  const enHoy = new Map(hoyToca.map(h => [h.id, h]));
  const raiz = h => {
    let r = h;
    const vistos = new Set([h.id]);
    while (r.despuesDe && enHoy.has(r.despuesDe) && !vistos.has(r.despuesDe)) { r = enHoy.get(r.despuesDe); vistos.add(r.id); }
    return r;
  };
  let html = orden.map(m => {
    const hs = HE.ordenarConCadenas(hoyToca.filter(h => raiz(h).timeOfDay === m));
    if (!hs.length) return "";
    const nombre = HC.MOMENTOS.find(x => x.id === m).nombre;
    return `<section class="hb-grupo" aria-label="${nombre}">
      <h2 class="hb-grupo-t">${nombre}${m === actual ? ` <span class="hb-ahora">Ahora</span>` : ""}</h2>
      <ul class="hb-filas">${hs.map(h => filaHtml(h, f, raiz(h) !== h)).join("")}</ul></section>`;
  }).join("");
  if (noToca.length) {
    html += `<details class="hb-grupo hb-notoca"><summary class="hb-grupo-t">No tocan hoy (${noToca.length})</summary>
      <ul class="hb-filas">${noToca.map(h => filaHtml(h, f)).join("")}</ul></details>`;
  }
  const tarde = new Date().getHours() >= 18 || new Date().getHours() < finDia();
  html += `<div class="hb-pie">
    ${tarde ? `<button type="button" class="hb-btn hb-cerrar-dia" data-cerrar-dia><span data-icon="check"></span>Cerrar el día</button>` : ""}
    <div class="hb-pie-sec">
      ${!tarde ? `<button type="button" class="hb-btn-sec" data-cerrar-dia>Cerrar el día</button>` : ""}
      <button type="button" class="hb-btn-sec" data-ordenar><span data-icon="grip"></span>Ordenar</button>
      <button type="button" class="hb-btn-sec" data-ajustes><span data-icon="tools"></span>Ajustes</button>
    </div></div>`;
  const abierto = lista.querySelector(".hb-notoca") && lista.querySelector(".hb-notoca").open;
  lista.innerHTML = html;
  if (abierto) lista.querySelector(".hb-notoca").open = true;
  renderIcons(lista);
  renderIcons(document.getElementById("hb-personaje"));
  ultimoMarcado = null;
}

// "+N XP" flotando sobre el botón que se tocó.
function mostrarXP(id, n) {
  if (hoja && !hoja.hidden) return;
  const btn = document.querySelector(`#hb-lista [data-marcar="${id}"]`);
  if (!btn || n <= 0) return;
  const r = btn.getBoundingClientRect();
  const el = document.createElement("span");
  el.className = "hb-xp-flota";
  el.textContent = `+${n} XP`;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// ---------- Escrituras (atómicas, por día) ----------
function errorGuardar(err) {
  console.error(err);
  toast("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
}

// registro null = borrar el día. Conserva la nota si ya había una.
function guardarDia(id, f, registro) {
  anotarToque();
  const h = normal[id];
  const crudo = docs[id] && docs[id].registros && docs[id].registros[f];
  if (registro && crudo && crudo.n && registro.n == null) registro.n = crudo.n;
  const args = [FP("registros", f), registro || FV().delete()];
  if (h.tipo === "sino") {
    const hecho = registro && (registro.e === "hecho" || registro.e === "minima");
    args.push("done", hecho ? FV().arrayUnion(f) : FV().arrayRemove(f));
  }
  coleccion().doc(id).update(...args).catch(errorGuardar);
}

// Suma (o resta) al valor del día sin leerlo antes: increment es atómico.
function sumarValor(id, f, delta) {
  anotarToque();
  const actual = (normal[id].registros[f] && normal[id].registros[f].v) || 0;
  if (actual + delta < 0) return;
  coleccion().doc(id).update(
    FP("registros", f, "v"), FV().increment(delta),
    FP("registros", f, "t"), Date.now(),
    FP("registros", f, "e"), FV().delete()
  ).catch(errorGuardar);
}

function fijarValor(id, f, v) {
  guardarDia(id, f, { v: Math.max(0, v), t: Date.now() });
}

function marcar(id) {
  sonar("toque");
  const h = normal[id];
  const f = hoy();
  const x = filaHoy(h, f);
  pendienteXP = { id, xp: res.xp };
  ultimoMarcado = id;
  if (h.tipo === "evitar") {
    if (x.d.estado === "recaida") { guardarDia(id, f, null); return; }
    guardarDia(id, f, { e: "recaida", t: Date.now() });
    toast(`Anotaste una recaída en «${h.name}». Tu mejor marca se guarda.`, () => guardarDia(id, f, null));
    return;
  }
  if (h.tipo === "medible") { sumarValor(id, f, 1); return; }
  if (x.hecho) { guardarDia(id, f, null); return; }
  if (h.tipo === "tiempo") { fijarValor(id, f, h.meta); return; }
  guardarDia(id, f, { e: "hecho", t: Date.now() });
}

// ---------- Aviso con Deshacer ----------
let toastEl = null, toastTimer = null;
function toast(msg, deshacer) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "hb-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }
  clearTimeout(toastTimer);
  toastEl.innerHTML = `<span>${escapeHtml(msg)}</span>${deshacer ? `<button type="button" class="hb-toast-btn">Deshacer</button>` : ""}`;
  toastEl.hidden = false;
  toastEl.classList.add("is-on");
  const btn = toastEl.querySelector(".hb-toast-btn");
  if (btn) btn.addEventListener("click", () => { deshacer(); ocultarToast(); }, { once: true });
  toastTimer = setTimeout(ocultarToast, TOAST_MS);
}
function ocultarToast() {
  if (!toastEl) return;
  toastEl.classList.remove("is-on");
  setTimeout(() => { if (!toastEl.classList.contains("is-on")) toastEl.hidden = true; }, 250);
}

// ---------- Hojas inferiores (mismo estilo que las de Rangos) ----------
let hoja = null;
let hojaActual = null; // { tipo: "detalle" | "form", id }
function abrirHoja(html, actual) {
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "muscle-sheet hb-sheet";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="muscle-sheet-overlay" data-cerrar></div>
      <div class="muscle-sheet-panel" role="dialog" aria-modal="true"><div class="muscle-sheet-grip"></div><div class="hb-sheet-body"></div></div>`;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", onClickHoja);
    hoja.addEventListener("change", onCambioHoja);
    hoja.addEventListener("submit", onSubmitHoja);
    hoja.addEventListener("pointerdown", empezarArrastre);
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarHoja(); });
  }
  const body = hoja.querySelector(".hb-sheet-body");
  const scroll = hoja.querySelector(".muscle-sheet-panel").scrollTop;
  const mismo = hojaActual && actual && hojaActual.tipo === actual.tipo && hojaActual.id === actual.id && !hoja.hidden;
  body.innerHTML = html;
  hojaActual = actual || null;
  renderIcons(hoja);
  hoja.hidden = false;
  hoja.classList.remove("closing");
  hoja.querySelector(".muscle-sheet-panel").scrollTop = mismo ? scroll : 0;
  document.body.classList.add("sheet-open");
}
function cerrarHoja() {
  if (!hoja || hoja.hidden) return;
  hojaActual = null;
  hoja.classList.add("closing");
  document.body.classList.remove("sheet-open");
  setTimeout(() => { hoja.hidden = true; hoja.classList.remove("closing"); }, 220);
}
const cabecera = (arriba, titulo, sub) => `
  <div class="muscle-sheet-head">
    <div>${arriba ? `<span class="hb-sheet-arriba">${arriba}</span>` : ""}<h3>${titulo}</h3>${sub ? `<span class="muscle-sheet-period">${sub}</span>` : ""}</div>
    <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
  </div>`;

// ---------- Hoja: detalle de un hábito ----------
let diaSel = null;       // fecha elegida en el calendario del detalle
let mesSel = null;       // "AAAA-MM" que muestra el calendario
let pausaAbierta = false;
const NOMBRES_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function hojaDetalle(id, fecha) {
  const h = normal[id];
  const rh = res && res.habitos[id];
  if (!h || !rh) { cerrarHoja(); return; }
  const f = res.hoy;
  if (!hojaActual || hojaActual.tipo !== "detalle" || hojaActual.id !== id) {
    diaSel = f;
    mesSel = f.slice(0, 7);
    pausaAbierta = false;
  }
  if (fecha) diaSel = fecha;
  const arriba = [nombreArea(h.area), HC.DIFICULTADES[h.dificultad].nombre, freqTexto(h)].filter(Boolean).join(" · ");
  const c30 = HE.cumplimiento(rh, HE.addDias(f, -29), f);
  const cTotal = HE.cumplimiento(rh, h.inicio || f, f);
  const semanal = h.freqType === "semana";
  const totalHechos = Object.values(rh.dias).filter(d => d.clase === "cumple" || d.clase === "extra").length;
  const r = rh.racha;
  const unidad = r.unidad === "semanas" ? (r.actual === 1 ? "semana" : "semanas") : r.actual === 1 ? "día" : "días";
  const pct = v => (v == null ? "—" : `${Math.round(v * 100)} %`);

  abrirHoja(cabecera(escapeHtml(arriba), `${escapeHtml(h.emoji)} ${escapeHtml(h.name)}`, h.inicio ? `Desde el ${fechaCorta(h.inicio)}` : "") + `
    <div class="hb-stats">
      <div class="hb-stat"><span class="hb-num">${r.actual}</span><span>${h.tipo === "evitar" ? (r.actual === 1 ? "día limpio" : "días limpios") : `${unidad} de racha`}</span></div>
      <div class="hb-stat"><span class="hb-num">${r.mejor}</span><span>${h.tipo === "evitar" ? "mejor marca" : "mejor racha"}</span></div>
      <div class="hb-stat"><span class="hb-num">${pct(c30)}</span><span>${semanal ? "últimas semanas" : "últimos 30 días"}</span></div>
      <div class="hb-stat"><span class="hb-num">${pct(cTotal)}</span><span>${plural(totalHechos, "vez", "veces")} en total</span></div>
    </div>
    ${rangoHtml(rh)}
    ${calendarioHtml(h, rh)}
    ${editorDia(h, rh, diaSel)}
    ${h.tipo === "tiempo" && diaSel === f ? cronometroHtml(h) : ""}
    ${pausasHtml(h)}
    <div class="hb-acciones">
      <button type="button" class="hb-btn-sec" data-editar="${id}"><span data-icon="edit"></span>Editar</button>
      <button type="button" class="hb-btn-sec" data-archivar="${id}">Archivar</button>
      <button type="button" class="hb-btn-sec is-peligro" data-eliminar="${id}"><span data-icon="trash"></span>Eliminar</button>
    </div>`, { tipo: "detalle", id });
}

// Calendario del mes: cada día con su estado; tocar uno lo abre para corregirlo.
function calendarioHtml(h, rh) {
  const f = res.hoy;
  const [y, m] = mesSel.split("-").map(Number);
  const semanas = HE.mesCalendario(y, m);
  const minimo = HE.addDias(f, -730).slice(0, 7);
  const celda = fe => {
    if (!fe) return `<span class="hb-cal-vacio"></span>`;
    const d = rh.dias[fe];
    const reg = h.registros[fe];
    const futuro = fe > f;
    let c = "c-fuera", txt = "sin datos";
    if (futuro) { c = "c-futuro"; txt = "todavía no llega"; }
    else if (d) {
      c = { cumple: "c-cumple", extra: "c-cumple", fallo: "c-fallo", pendiente: "c-pend", neutral: d.protegido ? "c-comodin" : "c-neutral", noToca: "c-notoca", fuera: "c-fuera" }[d.clase] || "c-fuera";
      if (d.estado === "parcial" || d.estado === "minima") c += " c-parcial";
      txt = d.protegido ? "cubierto por un comodín" : d.estado ? HC.ESTADOS[d.estado].nombre.toLowerCase() : { fallo: "no hecho", pendiente: "pendiente", noToca: "no tocaba", neutral: "en pausa", fuera: "sin datos" }[d.clase] || "";
    }
    const clases = ["hb-cal-dia", c, fe === diaSel ? "is-sel" : "", fe === f ? "is-hoy" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${clases}" data-dia-cal="${fe}" ${futuro ? "disabled" : ""} aria-label="${fechaCorta(fe)}: ${txt}" aria-pressed="${fe === diaSel}">
      ${Number(fe.slice(8))}${reg && reg.n ? `<i class="hb-cal-nota" aria-hidden="true"></i>` : ""}</button>`;
  };
  return `<div class="hb-cal">
    <div class="hb-cal-nav">
      <button type="button" class="hb-cal-flecha" data-mes="-1" ${mesSel <= minimo ? "disabled" : ""} aria-label="Mes anterior"><span data-icon="chevronLeft"></span></button>
      <span class="hb-cal-mes">${MESES_LARGOS[m - 1]} ${y}</span>
      <button type="button" class="hb-cal-flecha" data-mes="1" ${mesSel >= f.slice(0, 7) ? "disabled" : ""} aria-label="Mes siguiente"><span data-icon="chevronRight"></span></button>
    </div>
    <div class="hb-cal-grid">${DIAS_CORTOS.map(l => `<span class="hb-cal-wd">${l}</span>`).join("")}${semanas.flat().map(celda).join("")}</div>
    <div class="hb-cal-leyenda"><span><i class="c-cumple"></i>Hecho</span><span><i class="c-cumple c-parcial"></i>Parcial o mínima</span><span><i class="c-neutral"></i>Saltado o pausa</span><span><i class="c-fallo"></i>No hecho</span></div>
  </div>`;
}

function editorDia(h, rh, fe) {
  const f = res.hoy;
  const d = rh.dias[fe];
  const [y, m, dd] = fe.split("-").map(Number);
  const titulo = fe === f ? "Hoy" : fe === HE.addDias(f, -1) ? "Ayer" : `${NOMBRES_DIA[HE.diaSemana(fe)]} ${dd} de ${MESES_LARGOS[m - 1]}${y !== Number(f.slice(0, 4)) ? " de " + y : ""}`;
  const x = { d: d || { estado: HE.estadoDia(h, fe).estado } };
  const nota = (docs[h.id] && docs[h.id].registros && docs[h.id].registros[fe] && docs[h.id].registros[fe].n) || "";
  const tarde = fe < HE.addDias(f, -2);
  const pausa = HE.enPausa(h, fe);
  return `<div class="hb-dia-edit">
    <h4 class="hb-sub-t">${titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h4>
    ${pausa ? `<p class="hb-aviso">Este día está en pausa: no cuenta.</p>` : ""}
    ${controlesDia(h, x, fe)}
    ${h.minima && h.tipo !== "evitar" ? `<p class="hb-texto">Versión mínima: ${escapeHtml(h.minima)}</p>` : ""}
    ${tarde ? `<p class="hb-texto">Corregir días de hace más de 2 días arregla tu racha, pero no da XP ni monedas.</p>` : ""}
    <label class="hb-campo"><span>Nota ${fe === f ? "de hoy" : "del día"} <span class="hb-opcional">(opcional)</span></span>
      <input type="text" maxlength="140" data-nota="${h.id}" data-fecha="${fe}" value="${escapeHtml(nota)}" placeholder="Cómo te fue, en pocas palabras">
    </label>
  </div>`;
}

function controlesDia(h, x, f) {
  const est = x.d.estado;
  const reg = h.registros[f];
  const saltar = f === res.hoy ? "Saltar hoy" : "Saltado";
  const opcion = (valor, texto, activo) =>
    `<button type="button" class="hb-chip${activo ? " is-on" : ""}" data-estado="${valor}" data-id="${h.id}" data-fecha="${f}" aria-pressed="${!!activo}">${texto}</button>`;
  if (h.tipo === "evitar") {
    return `<div class="hb-chips">${opcion("limpio", "Día limpio", est !== "recaida")}${opcion("recaida", "Recaída", est === "recaida")}</div>`;
  }
  let html = "";
  if (h.tipo === "medible" || h.tipo === "tiempo") {
    const v = (reg && reg.v) || 0;
    const paso = h.tipo === "tiempo" ? 5 : 1;
    html += `<div class="hb-stepper">
      <button type="button" class="hb-step" data-sumar="${-paso}" data-id="${h.id}" data-fecha="${f}" aria-label="Restar ${paso}">−</button>
      <label class="hb-step-val"><input type="number" inputmode="decimal" min="0" step="any" value="${v}" data-valor="${h.id}" data-fecha="${f}" aria-label="Valor del día"><span>de ${fmtNum(h.meta)} ${escapeHtml(h.unidad)}</span></label>
      <button type="button" class="hb-step" data-sumar="${paso}" data-id="${h.id}" data-fecha="${f}" aria-label="Sumar ${paso}">+</button>
    </div>`;
    html += `<div class="hb-chips">${opcion("minima", "Versión mínima", est === "minima")}${opcion("saltado", saltar, est === "saltado")}</div>`;
  } else {
    html += `<div class="hb-chips">
      ${opcion("hecho", "Hecho", est === "hecho")}${opcion("minima", "Versión mínima", est === "minima")}
      ${opcion("parcial", "Parcial", est === "parcial")}${opcion("saltado", saltar, est === "saltado")}
      ${opcion("no", "No hecho", est === "no")}</div>`;
  }
  if (est === "saltado") {
    html += `<p class="hb-texto">Motivo (no rompe tu racha ni da XP):</p><div class="hb-chips">${HC.MOTIVOS_SALTO.map(m =>
      `<button type="button" class="hb-chip${reg && reg.m === m.id ? " is-on" : ""}" data-motivo="${m.id}" data-id="${h.id}" data-fecha="${f}" aria-pressed="${!!(reg && reg.m === m.id)}">${m.nombre}</button>`).join("")}</div>`;
  }
  return html;
}

// ---------- Cronómetro (hábitos de tiempo) ----------
// El inicio se guarda en el teléfono: si cierras la app, sigue contando.
const CLAVE_CRONO = id => "hb-crono:" + id;
function cronoInicio(id) {
  try { const v = Number(localStorage.getItem(CLAVE_CRONO(id))); return v > 0 ? v : null; } catch (e) { return null; }
}
function cronoGuardar(id, v) {
  try { if (v) localStorage.setItem(CLAVE_CRONO(id), String(v)); else localStorage.removeItem(CLAVE_CRONO(id)); } catch (e) { /* sin almacenamiento: el cronómetro no sobrevive a cerrar la app */ }
}
function textoCrono(inicio) {
  const s = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
  const p = n => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(seg)}` : `${p(m)}:${p(seg)}`;
}
function cronometroHtml(h) {
  const inicio = cronoInicio(h.id);
  return `<div class="hb-crono-box">
    ${inicio ? `<span class="hb-crono hb-num" data-inicio="${inicio}" role="timer" aria-live="off">${textoCrono(inicio)}</span>
      <div class="hb-chips"><button type="button" class="hb-btn" data-crono-parar="${h.id}">Detener y sumar</button>
      <button type="button" class="hb-btn-sec" data-crono-descartar="${h.id}">Descartar</button></div>`
    : `<button type="button" class="hb-btn-sec" data-crono-iniciar="${h.id}">Iniciar cronómetro</button>`}
  </div>`;
}
function cronoParar(id) {
  const inicio = cronoInicio(id);
  cronoGuardar(id, null);
  if (!inicio) return;
  const minutos = Math.max(1, Math.round((Date.now() - inicio) / 60000));
  sumarValor(id, hoy(), minutos);
  toast(`Sumaste ${minutos} min a «${normal[id].name}».`);
}
setInterval(() => {
  document.querySelectorAll(".hb-crono[data-inicio]").forEach(el => { el.textContent = textoCrono(Number(el.dataset.inicio)); });
}, 1000);

// ---------- Pausas por fechas ----------
function pausasHtml(h) {
  const lista = h.pausas.slice().sort((a, b) => b.desde.localeCompare(a.desde));
  const f = res.hoy;
  return `<h4 class="hb-sub-t">Pausas</h4>
    ${lista.length ? `<ul class="hb-pausas">${lista.map(p => `<li><span>${fechaCorta(p.desde)} – ${fechaCorta(p.hasta)}${p.hasta < f ? " · terminó" : p.desde <= f ? " · ahora" : ""}</span>
      <button type="button" class="hb-btn-sec" data-quitar-pausa="${h.id}" data-desde="${p.desde}" data-hasta="${p.hasta}">Quitar</button></li>`).join("")}</ul>` : ""}
    ${pausaAbierta ? `<div class="hb-pausa-form">
        <div class="hb-fila-campos">
          <label class="hb-campo">Desde<input type="date" data-pausa-desde value="${f}"></label>
          <label class="hb-campo">Hasta<input type="date" data-pausa-hasta value="${HE.addDias(f, 6)}"></label>
        </div>
        <p class="hb-texto">Los días en pausa no cuentan: ni cortan tu racha ni la suman. Ideal para vacaciones o si estás enfermo.</p>
        <div class="hb-chips"><button type="button" class="hb-btn" data-guardar-pausa="${h.id}">Guardar pausa</button>
          <button type="button" class="hb-btn-sec" data-cancelar-pausa>Cancelar</button></div>
      </div>`
    : `<button type="button" class="hb-btn-sec" data-pausar>Pausar por unas fechas</button>`}`;
}

function guardarPausa(id) {
  const desde = hoja.querySelector("[data-pausa-desde]").value;
  const hasta = hoja.querySelector("[data-pausa-hasta]").value;
  if (!desde || !hasta || desde > hasta) { toast("Revisa las fechas: «Hasta» no puede ser antes de «Desde»."); return; }
  const pausas = normal[id].pausas.concat([{ desde, hasta }]);
  pausaAbierta = false;
  coleccion().doc(id).update({ pausas }).catch(errorGuardar);
  toast(`Pausado del ${fechaCorta(desde)} al ${fechaCorta(hasta)}.`);
}
function quitarPausa(id, desde, hasta) {
  const pausas = normal[id].pausas.filter(p => !(p.desde === desde && p.hasta === hasta));
  coleccion().doc(id).update({ pausas }).catch(errorGuardar);
}

// ---------- Hoja: crear / editar ----------
let form = null; // copia editable de los campos mientras la hoja está abierta

function formDesde(h) {
  return {
    id: h ? h.id : null,
    name: h ? h.name : "",
    emoji: h ? h.emoji : EMOJIS[0],
    tipo: h ? h.tipo : "sino",
    meta: h ? h.meta : "",
    unidad: h ? h.unidad : "",
    freqType: h ? h.freqType : "diario",
    days: h ? h.days.slice() : [true, true, true, true, true, true, true],
    timesPerWeek: h ? h.timesPerWeek : HC.CONST.TIMES_PER_WEEK_DEFECTO,
    cadaN: h ? h.cadaN : HC.CONST.CADA_N_DEFECTO,
    timeOfDay: h ? h.timeOfDay : momentoActual(),
    dificultad: h ? h.dificultad : "media",
    area: h ? h.area : null,
    minima: h ? h.minima : "",
    despuesDe: h ? h.despuesDe || "" : "",
    vinculo: h ? h.vinculo || "" : ""
  };
}

function chips(nombre, opciones, actual) {
  return `<div class="hb-chips" role="group">${opciones.map(([v, t]) =>
    `<button type="button" class="hb-chip${String(actual) === String(v) ? " is-on" : ""}" data-campo="${nombre}" data-v="${v}" aria-pressed="${String(actual) === String(v)}">${t}</button>`).join("")}</div>`;
}

function hojaForm(id) {
  if (id !== undefined) form = formDesde(id ? normal[id] : null);
  const f = form;
  const medible = f.tipo === "medible" || f.tipo === "tiempo";
  const evitar = f.tipo === "evitar";
  abrirHoja(cabecera("", f.id ? "Editar hábito" : "Nuevo hábito") + `
    <form class="hb-form" novalidate>
      <label class="hb-campo">Nombre
        <input type="text" name="name" maxlength="60" required value="${escapeHtml(f.name)}" placeholder="Ej: Tomar agua" autocomplete="off">
      </label>
      <div class="hb-emojis" role="group" aria-label="Emoji">${EMOJIS.map(e =>
        `<button type="button" class="hb-emoji-btn${e === f.emoji ? " is-on" : ""}" data-campo="emoji" data-v="${e}" aria-pressed="${e === f.emoji}">${e}</button>`).join("")}</div>

      <span class="hb-label">Tipo</span>
      ${chips("tipo", Object.keys(HC.TIPOS).map(k => [k, HC.TIPOS[k].nombre]), f.tipo)}
      <p class="hb-texto">${{ sino: "Lo haces o no lo haces.", medible: "Con una meta y una unidad, como 8 vasos o 20 páginas.", tiempo: "Con una meta en minutos.", evitar: "Algo que quieres dejar: cuenta tus días limpios." }[f.tipo]}</p>

      ${medible ? `<div class="hb-fila-campos">
        <label class="hb-campo">Meta diaria<input type="number" name="meta" min="1" step="any" inputmode="decimal" value="${escapeHtml(f.meta)}" placeholder="${HC.CONST.META_DEFECTO[f.tipo]}"></label>
        ${f.tipo === "medible" ? `<label class="hb-campo">Unidad<input type="text" name="unidad" maxlength="16" value="${escapeHtml(f.unidad)}" placeholder="vasos"></label>` : `<span class="hb-unidad-fija">minutos</span>`}
      </div>` : ""}

      ${evitar ? "" : `<span class="hb-label">Frecuencia</span>
      ${chips("freqType", [["diario", "Todos los días"], ["dias", "Días específicos"], ["semana", "Veces por semana"], ["cadaN", "Cada N días"]], f.freqType)}
      ${f.freqType === "dias" ? `<div class="hb-dias" role="group" aria-label="Días">${DIAS_CORTOS.map((l, i) =>
        `<button type="button" class="hb-dia${f.days[i] ? " is-on" : ""}" data-dia="${i}" aria-pressed="${f.days[i]}" aria-label="${DIAS_NOMBRES[i]}">${l}</button>`).join("")}</div>` : ""}
      ${f.freqType === "semana" ? `<label class="hb-campo hb-inline"><input type="number" name="timesPerWeek" min="1" max="7" value="${f.timesPerWeek}" inputmode="numeric"> veces por semana</label>` : ""}
      ${f.freqType === "cadaN" ? `<label class="hb-campo hb-inline">Cada <input type="number" name="cadaN" min="2" max="${HC.CONST.CADA_N_MAX}" value="${f.cadaN}" inputmode="numeric"> días</label>` : ""}`}

      <span class="hb-label">Momento del día</span>
      ${chips("timeOfDay", HC.MOMENTOS.map(m => [m.id, m.nombre]), f.timeOfDay)}

      <span class="hb-label">Dificultad</span>
      ${chips("dificultad", Object.keys(HC.DIFICULTADES).map(k => [k, `${HC.DIFICULTADES[k].nombre} · ${HC.DIFICULTADES[k].xp} XP`]), f.dificultad)}

      <span class="hb-label">Área de vida</span>
      ${chips("area", areasDef().map(a => [a.id, a.nombre]).concat([["", "Sin área"]]), f.area || "")}

      <label class="hb-campo"><span>Después de <span class="hb-opcional">(opcional)</span></span>
        <select name="despuesDe">${opcionesCadena(f)}</select>
        <span class="hb-ayuda">Encadénalo a otro hábito: “Después de meditar, leeré”. Se muestran en secuencia.</span></label>

      <span class="hb-label">Se marca solo</span>
      ${chips("vinculo", [["", "No"], ["gimnasio", "Al guardar un entreno"]], f.vinculo)}

      ${evitar ? "" : `<label class="hb-campo"><span>Versión mínima <span class="hb-opcional">(opcional)</span></span>
        <input type="text" name="minima" maxlength="60" value="${escapeHtml(f.minima)}" placeholder="Ej: leer 1 página">
        <span class="hb-ayuda">Para los días difíciles: mantiene tu racha con menos XP.</span></label>`}

      <p class="hb-error" hidden></p>
      <div class="hb-acciones">
        <button type="button" class="hb-btn-sec" data-cerrar>Cancelar</button>
        <button type="submit" class="hb-btn">${f.id ? "Guardar cambios" : "Crear hábito"}</button>
      </div>
    </form>`, { tipo: "form", id: f.id || "nuevo" });
}

// Hábitos a los que se puede encadenar (sin crear una vuelta).
function opcionesCadena(f) {
  const candidatos = activos().filter(h => h.id !== f.id && !(f.id && HE.formaCiclo({ id: f.id, despuesDe: h.id }, new Map(Object.keys(normal).map(k => [k, normal[k]])))));
  return `<option value="">Ninguno</option>` + candidatos.map(h =>
    `<option value="${h.id}"${h.id === f.despuesDe ? " selected" : ""}>${escapeHtml(h.emoji)} ${escapeHtml(h.name)}</option>`).join("");
}

// Pasa lo escrito en los campos de texto a `form` antes de redibujar.
function leerCampos() {
  if (!hoja) return;
  hoja.querySelectorAll(".hb-form input[name], .hb-form select[name]").forEach(i => { form[i.name] = i.value; });
}

function guardarForm() {
  leerCampos();
  const f = form;
  const error = msg => { const p = hoja.querySelector(".hb-error"); p.textContent = msg; p.hidden = false; };
  const name = String(f.name || "").trim();
  if (!name) { error("Ponle un nombre a tu hábito."); return; }
  if (f.tipo !== "evitar" && f.freqType === "dias" && !f.days.some(Boolean)) { error("Elige al menos un día."); return; }
  const medible = f.tipo === "medible" || f.tipo === "tiempo";
  const datos = {
    v: 2, name, emoji: f.emoji, tipo: f.tipo,
    freqType: f.tipo === "evitar" ? "diario" : f.freqType,
    days: f.days.map(Boolean),
    timesPerWeek: Math.min(7, Math.max(1, parseInt(f.timesPerWeek, 10) || HC.CONST.TIMES_PER_WEEK_DEFECTO)),
    cadaN: Math.min(HC.CONST.CADA_N_MAX, Math.max(2, parseInt(f.cadaN, 10) || HC.CONST.CADA_N_DEFECTO)),
    timeOfDay: f.timeOfDay,
    dificultad: f.dificultad,
    area: f.area || null,
    minima: f.tipo === "evitar" ? "" : String(f.minima || "").trim(),
    despuesDe: f.despuesDe || null,
    vinculo: f.vinculo || null
  };
  if (medible) {
    datos.meta = Math.max(1, Number(String(f.meta).replace(",", ".")) || HC.CONST.META_DEFECTO[f.tipo]);
    datos.unidad = f.tipo === "tiempo" ? "min" : String(f.unidad || "").trim();
  }
  if (f.id) {
    coleccion().doc(f.id).update(datos).catch(errorGuardar);
    cerrarHoja();
    toast("Cambios guardados.");
  } else {
    const orden = Object.keys(normal).reduce((m, id) => Math.max(m, normal[id].orden || 0), 0) + 1;
    Object.assign(datos, { done: [], registros: {}, createdAt: Date.now(), inicio: hoy(), orden });
    coleccion().add(datos).catch(errorGuardar);
    cerrarHoja();
    toast(`Creaste «${name}». ¡A por el primer día!`);
  }
}

// ---------- Archivar y eliminar ----------
function archivar(id) {
  const h = normal[id];
  coleccion().doc(id).update({ archivado: true, archivadoEn: hoy() }).catch(errorGuardar);
  cerrarHoja();
  toast(`Archivaste «${h.name}». Su historial se conserva.`, () =>
    coleccion().doc(id).update({ archivado: false, archivadoEn: FV().delete() }).catch(errorGuardar));
}

function confirmarEliminar(id) {
  const h = normal[id];
  abrirHoja(cabecera("", "¿Eliminar este hábito?") + `
    <p class="hb-texto">Vas a borrar <b>${escapeHtml(h.emoji)} ${escapeHtml(h.name)}</b> con todo su historial. Si solo quieres dejarlo, mejor archívalo: así no pierdes tus datos.</p>
    <div class="hb-acciones">
      <button type="button" class="hb-btn-sec" data-detalle="${id}">Cancelar</button>
      <button type="button" class="hb-btn-sec" data-archivar="${id}">Archivar</button>
      <button type="button" class="hb-btn is-peligro" data-confirmar-eliminar="${id}">Eliminar</button>
    </div>`, { tipo: "confirmar", id });
}

function eliminar(id) {
  const copia = docs[id];
  const nombre = normal[id].name;
  coleccion().doc(id).delete().catch(errorGuardar);
  cerrarHoja();
  toast(`Eliminaste «${nombre}».`, () => coleccion().doc(id).set(copia).catch(errorGuardar));
}

// ---------- Hoja: ordenar (arrastrando o con flechas) ----------
function hojaOrdenar() {
  const lista = activos();
  abrirHoja(cabecera("", "Ordenar hábitos", "Arrastra desde el asa o usa las flechas") + `
    <ul class="hb-orden" id="hb-orden">${lista.map(h => `
      <li class="hb-orden-item" data-id="${h.id}">
        <span class="hb-orden-mango" data-mango aria-hidden="true"><span data-icon="grip"></span></span>
        <span class="hb-emoji" aria-hidden="true">${escapeHtml(h.emoji)}</span>
        <span class="hb-orden-txt"><span class="hb-nombre">${escapeHtml(h.name)}</span><span class="hb-sub">${HC.MOMENTOS.find(m => m.id === h.timeOfDay).nombre}</span></span>
        <button type="button" class="hb-orden-flecha" data-mover="-1" aria-label="Subir ${escapeHtml(h.name)}">↑</button>
        <button type="button" class="hb-orden-flecha" data-mover="1" aria-label="Bajar ${escapeHtml(h.name)}">↓</button>
      </li>`).join("")}</ul>
    <p class="hb-texto">En Hoy se agrupan por momento del día; este orden manda dentro de cada grupo.</p>
    <div class="hb-acciones">
      <button type="button" class="hb-btn-sec" data-cerrar>Cancelar</button>
      <button type="button" class="hb-btn" data-guardar-orden>Guardar orden</button>
    </div>`, { tipo: "ordenar" });
}

let arrastre = null;
function empezarArrastre(e) {
  const mango = e.target.closest("[data-mango]");
  if (!mango) return;
  const item = mango.closest(".hb-orden-item");
  e.preventDefault();
  arrastre = { item, lista: item.parentElement };
  item.classList.add("is-arrastrando");
  document.addEventListener("pointermove", moverArrastre);
  document.addEventListener("pointerup", terminarArrastre, { once: true });
  document.addEventListener("pointercancel", terminarArrastre, { once: true });
}
function moverArrastre(e) {
  if (!arrastre) return;
  const otros = [...arrastre.lista.children].filter(li => li !== arrastre.item);
  const antes = otros.find(li => { const r = li.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
  if (antes) arrastre.lista.insertBefore(arrastre.item, antes);
  else arrastre.lista.appendChild(arrastre.item);
}
function terminarArrastre() {
  if (!arrastre) return;
  arrastre.item.classList.remove("is-arrastrando");
  arrastre = null;
  document.removeEventListener("pointermove", moverArrastre);
}
function guardarOrden() {
  const ids = [...hoja.querySelectorAll(".hb-orden-item")].map(li => li.dataset.id);
  const lote = db.batch();
  let cambios = 0;
  ids.forEach((id, i) => {
    if (normal[id] && normal[id].orden !== i + 1) { lote.update(coleccion().doc(id), { orden: i + 1 }); cambios++; }
  });
  cerrarHoja();
  if (!cambios) return;
  lote.commit().catch(errorGuardar);
  toast("Orden guardado.");
}

// ---------- Hoja: ajustes ----------
function hojaAjustes() {
  const fin = finDia();
  const archivados = Object.keys(normal).map(id => normal[id]).filter(h => h.archivado);
  const hora = n => (n === 0 ? "Medianoche" : `${n}:00 a. m.`);
  abrirHoja(cabecera("", "Ajustes de hábitos") + `
    <h4 class="hb-sub-t">Tu día termina a las</h4>
    <div class="hb-chips">${Array.from({ length: HC.CONST.FIN_DIA_MAX + 1 }, (_, n) =>
      `<button type="button" class="hb-chip${n === fin ? " is-on" : ""}" data-fin-dia="${n}" aria-pressed="${n === fin}">${hora(n)}</button>`).join("")}</div>
    <p class="hb-texto">Si te acuestas tarde, lo que marques antes de esa hora cuenta para el día anterior. Ahora es ${fechaCorta(hoy())} para tus hábitos.</p>
    <h4 class="hb-sub-t">Sonidos</h4>
    <div class="hb-chips">
      <button type="button" class="hb-chip${conSonido() ? "" : " is-on"}" data-sonidos="0" aria-pressed="${!conSonido()}">Apagados</button>
      <button type="button" class="hb-chip${conSonido() ? " is-on" : ""}" data-sonidos="1" aria-pressed="${conSonido()}">Encendidos</button>
    </div>
    <p class="hb-texto">Un toque suave al marcar y una melodía corta en los logros. Respetan el modo silencio del iPhone.</p>
    <h4 class="hb-sub-t">Tus áreas de vida</h4>
    <div class="hb-areas-nombres">${areasDef().map(a =>
      `<label class="hb-campo"><span class="hb-sr">${escapeHtml(a.nombre)}</span><input type="text" maxlength="20" data-area-nombre="${a.id}" value="${escapeHtml(a.nombre)}" aria-label="Nombre del área ${escapeHtml(a.nombre)}"></label>`).join("")}</div>
    <h4 class="hb-sub-t">Archivados</h4>
    ${archivados.length ? `<ul class="hb-pausas">${archivados.map(h => `<li><span>${escapeHtml(h.emoji)} ${escapeHtml(h.name)}${h.archivadoEn ? ` · desde el ${fechaCorta(h.archivadoEn)}` : ""}</span>
      <span class="hb-chips"><button type="button" class="hb-btn-sec" data-restaurar="${h.id}">Restaurar</button>
      <button type="button" class="hb-btn-sec is-peligro" data-eliminar="${h.id}" aria-label="Eliminar ${escapeHtml(h.name)}"><span data-icon="trash"></span></button></span></li>`).join("")}</ul>`
      : `<p class="hb-texto">No tienes hábitos archivados. Archivar guarda el historial sin mostrarlo en Hoy.</p>`}`, { tipo: "ajustes" });
}
function guardarPref(campos) {
  juego = Object.assign({}, juego, { prefs: Object.assign({}, juego.prefs, campos) });
  metaJuego().set({ prefs: campos }, { merge: true }).catch(errorGuardar);
}
function guardarFinDia(n) {
  juego = Object.assign({}, juego, { prefs: Object.assign({}, juego.prefs, { finDia: n }) });
  metaJuego().set({ prefs: { finDia: n } }, { merge: true }).catch(errorGuardar);
  actualizar();
  hojaAjustes();
}
function restaurar(id) {
  coleccion().doc(id).update({ archivado: false, archivadoEn: FV().delete() }).catch(errorGuardar);
  toast(`«${normal[id].name}» volvió a Hoy.`);
}

// ---------- Hoja: cerrar el día ----------
const ANIMOS = [[1, "😞", "Muy mal"], [2, "🙁", "Mal"], [3, "😐", "Normal"], [4, "🙂", "Bien"], [5, "😄", "Muy bien"]];
function hojaCierre() {
  const f = res.hoy;
  const pendientes = activos().filter(h => {
    if (h.tipo === "evitar" || !HE.activoEn(h, f)) return false;
    const x = filaHoy(h, f);
    return x.toca && !x.hecho && !(x.semanal && x.semanaOk) && x.d.estado !== "saltado";
  });
  const dia = diasMeta[f] || {};
  const xpHoy = HE.xpDelDiaTotal(res, f);
  const perfecto = res.diasPerfectos.some(p => p.fecha === f);
  const p = progresoHoy(f);
  abrirHoja(cabecera(fechaCorta(f), "Cerrar el día") + `
    <div class="hb-cierre-top">
      <div class="hb-stat"><span class="hb-num">+${fmtNum(xpHoy)}</span><span>XP ganado hoy</span></div>
      <div class="hb-stat"><span class="hb-num">${p.hechos}/${p.total}</span><span>${perfecto ? "¡Día perfecto!" : "hábitos de hoy"}</span></div>
    </div>
    <h4 class="hb-sub-t">${pendientes.length ? "Te quedan pendientes" : "No te queda nada pendiente"}</h4>
    ${pendientes.length ? `<ul class="hb-filas">${pendientes.map(h => filaHtml(h, f)).join("")}</ul>
      <p class="hb-texto">Si hoy no tocaba o no pudiste, ábrelo y márcalo como saltado: no corta la racha.</p>` : ""}
    <h4 class="hb-sub-t">¿Cómo te sentiste hoy?</h4>
    <div class="hb-animos" role="group" aria-label="Ánimo del día">${ANIMOS.map(([n, emoji, t]) =>
      `<button type="button" class="hb-animo${dia.animo === n ? " is-on" : ""}" data-animo="${n}" aria-pressed="${dia.animo === n}" aria-label="${t}"><span aria-hidden="true">${emoji}</span><small>${t}</small></button>`).join("")}</div>
    <label class="hb-campo"><span>Nota del día <span class="hb-opcional">(opcional)</span></span>
      <input type="text" maxlength="200" data-nota-dia value="${escapeHtml(dia.nota || "")}" placeholder="Algo que quieras recordar de hoy"></label>
    <div class="hb-acciones"><button type="button" class="hb-btn" data-cerrar>Listo</button></div>`, { tipo: "cierre" });
}
function guardarDiaMeta(campos) {
  const f = res.hoy;
  diasMeta[f] = Object.assign({}, diasMeta[f], campos);
  metaDias().set({ dias: { [f]: campos } }, { merge: true }).catch(errorGuardar);
}

// ---------- Marcado automático desde otros módulos ----------
// Gimnasio avisa con "entreno:guardado" ({ fecha }). Otros módulos pueden
// avisar con: document.dispatchEvent(new CustomEvent("habito:auto", { detail: { modulo, fecha } })).
function autoMarcar(modulo, fecha) {
  if (!cargado) { pendientesAuto.push([modulo, fecha]); return; }
  const f = /^\d{4}-\d{2}-\d{2}$/.test(fecha || "") ? fecha : hoy();
  const marcados = [];
  Object.keys(normal).map(id => normal[id]).forEach(h => {
    if (h.vinculo !== modulo || h.archivado || h.tipo === "evitar") return;
    if (HE.cumple(HE.estadoDia(h, f))) return;
    if (h.tipo === "medible" || h.tipo === "tiempo") guardarDia(h.id, f, { v: h.meta, t: Date.now() });
    else guardarDia(h.id, f, { e: "hecho", t: Date.now() });
    marcados.push(`«${h.name}»`);
  });
  if (marcados.length) toast(`Marcado solo: ${marcados.join(", ")}${f === hoy() ? "" : ` (${fechaCorta(f)})`}.`);
}
document.addEventListener("entreno:guardado", e => autoMarcar("gimnasio", e.detail && e.detail.fecha));
document.addEventListener("habito:auto", e => { const d = e.detail || {}; if (d.modulo) autoMarcar(d.modulo, d.fecha); });

// ---------- Rangos por hábito ----------
const nivelHab = idx => (idx == null ? null : HE.NIVELES[idx]);
function insigniaFila(rh) {
  if (!rh || !rh.rango || !rh.rango.tieneRango) return "";
  const n = nivelHab(rh.rango.nivel);
  return `<span class="hb-insignia" title="${escapeHtml(n.nombre)}">${RangosInsignias.svg(n, { tam: 28 })}</span>`;
}
function rangoHtml(rh) {
  const r = rh.rango;
  if (!r.tieneRango) {
    return `<div class="hb-rango">${RangosInsignias.svg(null, { tam: 56 })}<div class="hb-rango-txt"><b>Sin rango todavía</b>
      <span>Cumple este hábito los días que toca y en una semana tendrás tu primer rango.</span></div></div>`;
  }
  const n = nivelHab(r.nivel), sig = r.siguiente;
  const tendencia = r.tendencia == null ? "" : r.tendencia > 0.5 ? " · subiendo" : r.tendencia < -0.5 ? " · bajando" : " · estable";
  return `<div class="hb-rango">
    ${RangosInsignias.svg(n, { tam: 64 })}
    <div class="hb-rango-txt">
      <b>${escapeHtml(n.nombre)}</b>
      <span>Fuerza ${Math.round(r.fuerza)} de 100${tendencia}</span>
      <div class="hb-xp hb-rango-barra" role="progressbar" aria-label="Avance hacia la siguiente división" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.avance * 100)}"><span style="width:${(r.avance * 100).toFixed(1)}%"></span></div>
      <span class="hb-rango-sig">${!sig ? "Estás en la cima." : r.faltaHistoria ? `Para ${escapeHtml(sig.nombre)} necesitas casi un año de constancia.` : `Siguiente: ${escapeHtml(sig.nombre)}`}</span>
      ${r.escudo > 0 ? `<span class="hb-rango-escudo">Protegido: ${plural(r.escudo, "día más", "días más")} sin bajar de división.</span>` : ""}
    </div>
  </div>`;
}

// ---------- Pestaña Logros: misiones, logros, tienda y áreas ----------
const panelLogros = document.getElementById("panel-hab-logros");
let logrosTab = "misiones";

function renderLogros() {
  if (!cargado || !res || !panelLogros || panelLogros.hidden) return;
  const el = document.getElementById("hb-logros");
  const n = res.nivel;
  const hechos = res.logros.filter(l => l.desbloqueado).length;
  const tabs = [["misiones", "Misiones"], ["logros", "Logros"], ["tienda", "Tienda"], ["areas", "Áreas"]];
  el.innerHTML = `
    <div class="hb-resumen">
      <div class="hb-pj-nivel"><span class="hb-num">${n.nivel}</span><span><span class="hb-pj-t">Nivel</span><span class="hb-pj-titulo">${escapeHtml(n.titulo)}</span></span></div>
      <div class="hb-xp" role="progressbar" aria-label="Experiencia hacia el nivel ${n.nivel + 1}" aria-valuemin="0" aria-valuemax="${n.hasta - n.desde}" aria-valuenow="${n.xp - n.desde}"><span style="width:${(n.progreso * 100).toFixed(1)}%"></span></div>
      <div class="hb-pj-datos">
        <span>${fmtNum(n.xp - n.desde)} / ${fmtNum(n.hasta - n.desde)} XP</span>
        <span class="hb-dato"><span class="hb-ico" data-icon="coin"></span>${fmtNum(res.monedas.saldo)}</span>
        <span class="hb-dato">${plural(res.comodines.guardados, "comodín", "comodines")}</span>
        <span class="hb-dato"><span class="hb-ico" data-icon="trophy"></span>${hechos}/${res.logros.length}</span>
      </div>
    </div>
    <div class="fin-tabs hb-tabs" role="tablist">${tabs.map(([id, t]) =>
      `<button type="button" class="fin-tab${logrosTab === id ? " active" : ""}" role="tab" aria-selected="${logrosTab === id}" data-hb-tab="${id}">${t}</button>`).join("")}</div>
    <div class="hb-tab-cuerpo">${{ misiones: misionesHtml, logros: logrosHtml, tienda: tiendaHtml, areas: areasHtml }[logrosTab]()}</div>`;
  renderIcons(el);
}

function barra(fr, etiqueta) {
  return `<div class="hb-xp" role="progressbar" aria-label="${escapeHtml(etiqueta)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(fr * 100)}"><span style="width:${(Math.min(1, fr) * 100).toFixed(1)}%"></span></div>`;
}

function misionesHtml() {
  const sem = HE.semanaId(HE.lunesDe(res.hoy));
  const actuales = res.misiones.filter(m => m.semana === sem);
  const quedan = 6 - HE.diaSemana(res.hoy);
  const anteriores = {};
  res.misiones.filter(m => m.semana < sem).forEach(m => {
    const a = anteriores[m.semana] || (anteriores[m.semana] = { lunes: m.lunes, total: 0, hechas: 0 });
    a.total++;
    if (m.estado === "completada") a.hechas++;
  });
  const filas = actuales.length ? actuales.map(m => `
    <li class="hb-mision${m.estado === "completada" ? " is-hecha" : ""}">
      <div class="hb-mision-top"><b>${escapeHtml(m.titulo)}</b>${m.estado === "completada" ? `<span class="hb-tag">Cumplida</span>` : ""}</div>
      ${barra(m.actual / m.metaProgreso, m.titulo)}
      <div class="hb-mision-pie"><span>${m.tipo === "rango" ? (m.actual ? "Lo lograste" : "Todavía no") : `${m.actual} de ${m.metaProgreso}`}</span><span>+${m.xp} XP · +${m.monedas} monedas</span></div>
    </li>`).join("")
    : `<li class="empty-state">Crea un hábito para recibir tus misiones de la semana.</li>`;
  const previas = Object.keys(anteriores).sort().reverse().slice(0, 4);
  return `<p class="hb-texto">Se renuevan cada lunes con tus propios datos, un poco por encima de tu promedio. ${quedan ? `Te ${quedan === 1 ? "queda 1 día" : `quedan ${quedan} días`}.` : "Hoy es el último día."}</p>
    <ul class="hb-misiones">${filas}</ul>
    ${previas.length ? `<h3 class="hb-sub-t">Semanas anteriores</h3><ul class="hb-pausas">${previas.map(k =>
      `<li><span>Semana del ${fechaCorta(anteriores[k].lunes)}</span><span>${anteriores[k].hechas} de ${anteriores[k].total}</span></li>`).join("")}</ul>` : ""}`;
}

function logrosHtml() {
  const lista = res.logros.slice().sort((a, b) => b.desbloqueado - a.desbloqueado || b.progreso - a.progreso);
  return `<ul class="hb-logros">${lista.map(l => {
    const oculto = l.secreto && !l.desbloqueado;
    return `<li class="hb-logro${l.desbloqueado ? " is-on" : ""}">
      <span class="hb-logro-ico" aria-hidden="true"><span data-icon="${oculto ? "star" : "trophy"}"></span></span>
      <span class="hb-logro-txt"><b>${oculto ? "Logro secreto" : escapeHtml(l.nombre)}</b>
        <span>${oculto ? "Sigue usando la app para descubrirlo." : escapeHtml(l.desc)}</span>
        ${l.desbloqueado ? `<span class="hb-tag">Conseguido</span>` : oculto ? "" : `${barra(l.progreso, l.nombre)}<span class="hb-logro-prog">${l.tipo === "rango" ? `Tu mejor: ${escapeHtml(mejorRangoNombre())}` : `${fmtNum(l.actual)} de ${fmtNum(l.metaProgreso)}`}</span>`}
      </span></li>`;
  }).join("")}</ul>`;
}
function mejorRangoNombre() {
  const mejor = Object.keys(res.habitos).map(id => res.habitos[id].rango).filter(r => r.tieneRango).reduce((m, r) => Math.max(m, r.nivel), -1);
  return mejor >= 0 ? HE.NIVELES[mejor].nombre : "sin rango";
}

function tiendaHtml() {
  const saldo = res.monedas.saldo;
  const precio = HC.TIENDA.COMODIN;
  const guardados = res.comodines.guardados;
  const recompensas = Object.keys(juego.recompensas || {}).map(id => Object.assign({ id }, juego.recompensas[id])).filter(r => r.nombre)
    .sort((a, b) => a.precio - b.precio);
  const canjes = compras().filter(c => c.que === "recompensa").reverse().slice(0, 8);
  return `
    <div class="hb-saldo"><span class="hb-ico" data-icon="coin"></span><span class="hb-num">${fmtNum(saldo)}</span><span>monedas</span></div>
    <p class="hb-texto">Ganas 1 moneda por cada 10 XP, y más con las misiones.</p>
    <section class="hb-tienda-bloque">
      <h3 class="hb-sub-t">Comodines de racha</h3>
      <p class="hb-texto">Si fallas un día que tocaba, se usa uno solo y tus rachas siguen. Puedes guardar hasta ${HC.CONST.COMODINES_MAX}.
        ${res.comodines.protegidos.length ? `Ya te salvaron ${plural(res.comodines.protegidos.length, "día", "días")}.` : ""}</p>
      <div class="hb-tienda-fila"><span>Guardados: <b>${guardados} de ${HC.CONST.COMODINES_MAX}</b></span>
        <button type="button" class="hb-btn" data-comprar-comodin ${guardados >= HC.CONST.COMODINES_MAX ? "disabled" : ""}>Comprar · ${precio}</button></div>
    </section>
    <section class="hb-tienda-bloque">
      <h3 class="hb-sub-t">Tus recompensas</h3>
      ${recompensas.length ? `<ul class="hb-pausas">${recompensas.map(r => `<li><span>${escapeHtml(r.nombre)} · <b>${fmtNum(r.precio)}</b></span>
        <span class="hb-chips"><button type="button" class="hb-btn-sec" data-canjear="${r.id}" ${saldo < r.precio ? "disabled" : ""}>Canjear</button>
        <button type="button" class="hb-btn-sec is-peligro" data-borrar-recompensa="${r.id}" aria-label="Borrar ${escapeHtml(r.nombre)}"><span data-icon="trash"></span></button></span></li>`).join("")}</ul>`
        : `<p class="hb-texto">Crea premios reales para ti, como «Noche de pelis» por 150 monedas.</p>`}
      <form class="hb-recompensa-form" data-nueva-recompensa>
        <label class="hb-campo"><span>Recompensa</span><input type="text" name="nombre" maxlength="40" placeholder="Noche de pelis" required></label>
        <label class="hb-campo hb-precio"><span>Precio</span><input type="number" name="precio" min="1" step="1" inputmode="numeric" placeholder="150" required></label>
        <button type="submit" class="hb-btn">Agregar</button>
      </form>
    </section>
    ${canjes.length ? `<section class="hb-tienda-bloque"><h3 class="hb-sub-t">Canjes recientes</h3><ul class="hb-pausas">${canjes.map(c =>
      `<li><span>${escapeHtml(c.nombre || "Recompensa")}</span><span>${fechaCorta(HE.fechaLogica(c.t, finDia()))} · ${fmtNum(c.precio)}</span></li>`).join("")}</ul></section>` : ""}`;
}

function areasHtml() {
  return `<p class="hb-texto">Cada hábito suma XP a su área. Cambia los nombres de las áreas en Ajustes.</p>
    <ul class="hb-areas">${res.areas.map(a => `<li class="hb-area">
      <div class="hb-area-top"><b>${escapeHtml(a.nombre)}</b><span><span class="hb-num">${a.nivel.nivel}</span> nivel</span></div>
      ${barra(a.nivel.progreso, a.nombre)}
      <span class="hb-area-pie">${plural(a.habitos, "hábito", "hábitos")} · ${fmtNum(a.xp)} XP</span></li>`).join("")}</ul>`;
}

// ---------- Tienda: acciones ----------
function nuevaCompra(datos, mensaje) {
  const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  metaJuego().set({ compras: { [id]: Object.assign({ t: Date.now() }, datos) } }, { merge: true }).catch(errorGuardar);
  sonar("moneda");
  toast(mensaje, () => metaJuego().set({ compras: { [id]: FV().delete() } }, { merge: true }).catch(errorGuardar));
}
function comprarComodin() {
  const precio = HC.TIENDA.COMODIN;
  if (res.comodines.guardados >= HC.CONST.COMODINES_MAX) { toast(`Ya tienes ${HC.CONST.COMODINES_MAX} comodines guardados.`); return; }
  if (res.monedas.saldo < precio) { toast(`Te faltan ${precio - res.monedas.saldo} monedas.`); return; }
  nuevaCompra({ que: "comodin", precio }, "Compraste un comodín de racha.");
}
function canjear(id) {
  const r = (juego.recompensas || {})[id];
  if (!r) return;
  if (res.monedas.saldo < r.precio) { toast(`Te faltan ${r.precio - res.monedas.saldo} monedas.`); return; }
  nuevaCompra({ que: "recompensa", ref: id, nombre: r.nombre, precio: r.precio }, `¡Disfruta «${r.nombre}»! Te lo ganaste.`);
}
function agregarRecompensa(form) {
  const nombre = form.nombre.value.trim();
  const precio = Math.round(Number(form.precio.value));
  if (!nombre || !(precio > 0)) { toast("Ponle nombre y un precio mayor que cero."); return; }
  const id = "r" + Date.now().toString(36);
  metaJuego().set({ recompensas: { [id]: { nombre, precio } } }, { merge: true }).catch(errorGuardar);
  form.reset();
}
function borrarRecompensa(id) {
  const r = (juego.recompensas || {})[id];
  metaJuego().set({ recompensas: { [id]: FV().delete() } }, { merge: true }).catch(errorGuardar);
  if (r) toast(`Borraste «${r.nombre}».`, () => metaJuego().set({ recompensas: { [id]: r } }, { merge: true }).catch(errorGuardar));
}

if (panelLogros) {
  panelLogros.addEventListener("click", e => {
    const t = e.target.closest("[data-hb-tab]");
    if (t) { logrosTab = t.dataset.hbTab; renderLogros(); return; }
    if (e.target.closest("[data-comprar-comodin]")) { comprarComodin(); return; }
    const c = e.target.closest("[data-canjear]");
    if (c) { canjear(c.dataset.canjear); return; }
    const b = e.target.closest("[data-borrar-recompensa]");
    if (b) borrarRecompensa(b.dataset.borrarRecompensa);
  });
  panelLogros.addEventListener("submit", e => {
    if (!e.target.matches("[data-nueva-recompensa]")) return;
    e.preventDefault();
    agregarRecompensa(e.target);
  });
  new MutationObserver(() => { if (!panelLogros.hidden) { renderLogros(); revisarCelebraciones(); } })
    .observe(panelLogros, { attributes: true, attributeFilter: ["hidden"] });
}

// ---------- Celebraciones (solo en hitos) ----------
// Se compara con un snapshot guardado en meta/habitos_juego, igual que los
// rangos de Ejercicio: la primera vez se guarda sin aviso.
let celebrando = false;
let juegoExiste = false;
// Registrar primero: mientras marcas no se interrumpe; la celebración espera
// a que dejes de tocar un momento y junta todo en una sola ventana.
const ESPERA_CELEBRAR_MS = 2500;
let ultimoToque = 0, timerCelebrar = null;
function anotarToque() {
  ultimoToque = Date.now();
  clearTimeout(timerCelebrar);
  timerCelebrar = setTimeout(revisarCelebraciones, ESPERA_CELEBRAR_MS + 50);
}
function canon(snap) {
  const r = {};
  Object.keys(snap.rangos || {}).sort().forEach(k => { r[k] = snap.rangos[k]; });
  return JSON.stringify([snap.nivel, r, (snap.logros || []).slice().sort(), (snap.misiones || []).slice().sort(), (snap.perfectos || []).slice().sort()]);
}
function guardarSnapshot(snap) {
  juego = Object.assign({}, juego, { snapshot: snap });
  const ref = metaJuego();
  (juegoExiste ? ref.update({ snapshot: snap }) : ref.set({ snapshot: snap }, { merge: true })).catch(errorGuardar);
}
function revisarCelebraciones() {
  if (!juegoCargado || !res || celebrando) return;
  const snap = HE.snapshot(res);
  const anterior = juego.snapshot;
  if (!anterior) { guardarSnapshot(snap); return; }
  const ups = HE.novedades(anterior, snap);
  const visible = !document.hidden && [panelHoy, panelStats, panelLogros].some(p => p && !p.hidden);
  if (ups.length && visible) {
    const espera = ultimoToque + ESPERA_CELEBRAR_MS - Date.now();
    if (espera > 0) { clearTimeout(timerCelebrar); timerCelebrar = setTimeout(revisarCelebraciones, espera + 50); return; }
    if (hoja && !hoja.hidden && hojaActual && hojaActual.tipo === "form") return; // no interrumpe un formulario
    mostrarCelebracion(ups, snap);
    return;
  }
  if (!ups.length && canon(anterior) !== canon(snap)) guardarSnapshot(snap);
}

function itemCelebracion(u, i) {
  const fila = (badge, tipo, nombre, cambio) => `<li style="--i:${i}"><span class="rk-sube-badge">${badge}</span>
    <span class="rk-fila-txt"><span class="r">${tipo}</span><span class="n">${nombre}</span>${cambio ? `<span class="c">${cambio}</span>` : ""}</span></li>`;
  const icono = (ic, extra) => `<span class="hb-cel-ico${extra ? " " + extra : ""}"><span data-icon="${ic}"></span></span>`;
  if (u.tipo === "nivel") {
    const t = HE.titulo(u.despues), antes = HE.titulo(u.antes || 1);
    return fila(`<span class="hb-cel-nivel hb-num">${u.despues}</span>`, "Nivel", `Nivel ${u.despues}`, t !== antes ? `Ahora eres ${escapeHtml(t)}` : `Antes: nivel ${u.antes}`);
  }
  if (u.tipo === "rango") {
    const h = normal[u.id];
    return fila(RangosInsignias.svg(nivelHab(u.despues), { tam: 56 }), "Rango", `${h ? escapeHtml(h.emoji + " " + h.name) : "Hábito"}`,
      u.antes == null ? `Nuevo: ${nivelHab(u.despues).nombre}` : `${nivelHab(u.antes).nombre} → ${nivelHab(u.despues).nombre}`);
  }
  if (u.tipo === "logro") {
    const l = res.logros.find(x => x.id === u.id);
    return fila(icono("trophy"), "Logro", escapeHtml(l ? l.nombre : u.id), l ? escapeHtml(l.desc) : "");
  }
  if (u.tipo === "mision") {
    const m = res.misiones.find(x => x.id === u.id);
    return fila(icono("check"), "Misión cumplida", escapeHtml(m ? m.titulo : ""), m ? `+${m.xp} XP · +${m.monedas} monedas` : "");
  }
  return fila(icono("star"), "Día perfecto", u.fecha === res.hoy ? "Cumpliste todo lo de hoy" : `El ${fechaCorta(u.fecha)}`, `+${HC.XP.DIA_PERFECTO} XP`);
}

function mostrarCelebracion(ups, snap) {
  celebrando = true;
  const orden = { nivel: 0, perfecto: 1, rango: 2, mision: 3, logro: 4 };
  ups.sort((a, b) => orden[a.tipo] - orden[b.tipo] || (b.despues || 0) - (a.despues || 0));
  const titulo = { nivel: "¡Subiste de nivel!", perfecto: "¡Día perfecto!", rango: "Nuevo rango", mision: "Misión cumplida", logro: "Logro desbloqueado" }[ups[0].tipo];
  const modal = document.createElement("div");
  modal.className = "rk-aviso-modal hb-celebra";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "hb-cel-t");
  modal.innerHTML = `<div class="rk-aviso-panel">
      <span class="hb-eyebrow">¡Buen trabajo!</span>
      <h2 id="hb-cel-t">${titulo}</h2>
      <ul class="rk-sube">${ups.slice(0, 8).map(itemCelebracion).join("")}</ul>
      ${ups.length > 8 ? `<p class="hb-texto">Y ${ups.length - 8} más.</p>` : ""}
      <button type="button" class="rk-btn" data-continuar>Continuar</button>
    </div>`;
  document.body.appendChild(modal);
  renderIcons(modal);
  document.body.classList.add("sheet-open");
  sonar("fanfarria");
  const cerrar = () => {
    guardarSnapshot(snap);
    modal.classList.add("closing");
    if (!hoja || hoja.hidden) document.body.classList.remove("sheet-open");
    setTimeout(() => { modal.remove(); celebrando = false; }, 220);
  };
  modal.querySelector("[data-continuar]").addEventListener("click", cerrar);
  modal.querySelector("[data-continuar]").focus();
}

// ---------- Sonidos (opcionales, apagados por defecto) ----------
let audio = null;
const conSonido = () => !!(juego.prefs && juego.prefs.sonidos);
function contextoAudio() {
  if (!audio) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; audio = new A(); }
  if (audio.state === "suspended") audio.resume();
  return audio;
}
// Safari solo deja sonar después de un toque: se "despierta" con el primero.
document.addEventListener("pointerdown", () => { if (conSonido()) try { contextoAudio(); } catch (e) { /* sin audio */ } }, { passive: true });
function sonar(tipo) {
  if (!conSonido()) return;
  try {
    const ctx = contextoAudio();
    if (!ctx) return;
    const notas = { toque: [880], moneda: [988, 1319], fanfarria: [523.25, 659.25, 783.99, 1046.5] }[tipo] || [880];
    const t0 = ctx.currentTime;
    notas.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t = t0 + i * 0.09;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(tipo === "toque" ? 0.06 : 0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (tipo === "toque" ? 0.12 : 0.35));
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch (e) { /* sin audio: no pasa nada */ }
}

// ---------- Eventos ----------
function onClickHoja(e) {
  const t = e.target;
  if (t.closest("[data-cerrar]")) { cerrarHoja(); return; }
  const q = sel => t.closest(sel);
  const fechaDe = el => el.dataset.fecha || res.hoy;
  let b;
  if ((b = q("[data-marcar]"))) { marcar(b.dataset.marcar); return; }
  if ((b = q("[data-detalle]"))) { hojaDetalle(b.dataset.detalle); return; }
  if ((b = q("[data-editar]"))) { hojaForm(b.dataset.editar); return; }
  if ((b = q("[data-archivar]"))) { archivar(b.dataset.archivar); return; }
  if ((b = q("[data-eliminar]"))) { confirmarEliminar(b.dataset.eliminar); return; }
  if ((b = q("[data-confirmar-eliminar]"))) { eliminar(b.dataset.confirmarEliminar); return; }
  if ((b = q("[data-restaurar]"))) { restaurar(b.dataset.restaurar); return; }
  if ((b = q("[data-estado]"))) { cambiarEstado(b.dataset.id, b.dataset.estado, fechaDe(b)); return; }
  if ((b = q("[data-motivo]"))) {
    guardarDia(b.dataset.id, fechaDe(b), { e: "saltado", m: b.dataset.motivo, t: Date.now() });
    return;
  }
  if ((b = q("[data-sumar]"))) { sumarValor(b.dataset.id, fechaDe(b), Number(b.dataset.sumar)); return; }
  // Detalle: calendario, pausas y cronómetro
  if ((b = q("[data-dia-cal]"))) { hojaDetalle(hojaActual.id, b.dataset.diaCal); return; }
  if ((b = q("[data-mes]"))) {
    const [y, m] = mesSel.split("-").map(Number);
    const d = new Date(y, m - 1 + Number(b.dataset.mes), 1);
    mesSel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    hojaDetalle(hojaActual.id);
    return;
  }
  if (q("[data-pausar]")) { pausaAbierta = true; hojaDetalle(hojaActual.id); return; }
  if (q("[data-cancelar-pausa]")) { pausaAbierta = false; hojaDetalle(hojaActual.id); return; }
  if ((b = q("[data-guardar-pausa]"))) { guardarPausa(b.dataset.guardarPausa); return; }
  if ((b = q("[data-quitar-pausa]"))) { quitarPausa(b.dataset.quitarPausa, b.dataset.desde, b.dataset.hasta); return; }
  if ((b = q("[data-crono-iniciar]"))) { cronoGuardar(b.dataset.cronoIniciar, Date.now()); hojaDetalle(b.dataset.cronoIniciar); renderHoy(); return; }
  if ((b = q("[data-crono-parar]"))) { cronoParar(b.dataset.cronoParar); return; }
  if ((b = q("[data-crono-descartar]"))) { cronoGuardar(b.dataset.cronoDescartar, null); hojaDetalle(b.dataset.cronoDescartar); renderHoy(); return; }
  // Ordenar, ajustes y cierre del día
  if ((b = q("[data-mover]"))) {
    const li = b.closest(".hb-orden-item");
    const otro = Number(b.dataset.mover) < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (otro) { Number(b.dataset.mover) < 0 ? li.parentElement.insertBefore(li, otro) : li.parentElement.insertBefore(otro, li); b.focus(); }
    return;
  }
  if (q("[data-guardar-orden]")) { guardarOrden(); return; }
  if ((b = q("[data-fin-dia]"))) { guardarFinDia(Number(b.dataset.finDia)); return; }
  if ((b = q("[data-sonidos]"))) { guardarPref({ sonidos: b.dataset.sonidos === "1" }); if (b.dataset.sonidos === "1") sonar("moneda"); hojaAjustes(); return; }
  if ((b = q("[data-animo]"))) { guardarDiaMeta({ animo: Number(b.dataset.animo) }); hojaCierre(); return; }
  // Formulario: botones que cambian un campo y redibujan.
  if ((b = q("[data-campo]"))) {
    leerCampos();
    form[b.dataset.campo] = b.dataset.v;
    hojaForm();
    return;
  }
  if ((b = q("[data-dia]"))) {
    const i = Number(b.dataset.dia);
    form.days[i] = !form.days[i];
    b.classList.toggle("is-on", form.days[i]);
    b.setAttribute("aria-pressed", form.days[i]);
  }
}

function cambiarEstado(id, estado, f) {
  const h = normal[id];
  const actual = HE.estadoDia(h, f).estado;
  pendienteXP = { id, xp: res.xp };
  if (h.tipo === "evitar") {
    guardarDia(id, f, estado === "recaida" ? { e: "recaida", t: Date.now() } : null);
    return;
  }
  // Tocar el estado que ya está elegido lo quita.
  if (actual === estado) { guardarDia(id, f, null); return; }
  if (estado === "saltado") { guardarDia(id, f, { e: "saltado", m: "otro", t: Date.now() }); return; }
  guardarDia(id, f, { e: estado, t: Date.now() });
}

function onCambioHoja(e) {
  const t = e.target;
  const f = t.dataset.fecha || res.hoy;
  if (t.dataset.nota) {
    const v = t.value.trim().slice(0, 140);
    coleccion().doc(t.dataset.nota).update(FP("registros", f, "n"), v || FV().delete()).catch(errorGuardar);
    return;
  }
  if (t.dataset.valor) {
    const v = Number(String(t.value).replace(",", "."));
    if (isFinite(v)) fijarValor(t.dataset.valor, f, v);
    return;
  }
  if (t.hasAttribute("data-nota-dia")) { guardarDiaMeta({ nota: t.value.trim().slice(0, 200) }); return; }
  if (t.dataset.areaNombre) {
    const nombres = Object.assign({}, juego.prefs && juego.prefs.areas, { [t.dataset.areaNombre]: t.value.trim().slice(0, 20) });
    guardarPref({ areas: nombres });
    actualizar();
  }
}

function onSubmitHoja(e) {
  e.preventDefault();
  if (e.target.classList.contains("hb-form")) guardarForm();
}

document.getElementById("hb-lista").addEventListener("click", e => {
  const m = e.target.closest("[data-marcar]");
  if (m) { marcar(m.dataset.marcar); return; }
  const d = e.target.closest("[data-detalle]");
  if (d) { hojaDetalle(d.dataset.detalle); return; }
  if (e.target.closest("[data-nuevo]")) { hojaForm(null); return; }
  if (e.target.closest("[data-cerrar-dia]")) { hojaCierre(); return; }
  if (e.target.closest("[data-ordenar]")) { hojaOrdenar(); return; }
  if (e.target.closest("[data-ajustes]")) hojaAjustes();
});
document.getElementById("hb-nuevo").addEventListener("click", () => hojaForm(null));

// ---------- Estadísticas (versión inicial; los paneles completos llegan en la fase 3) ----------
function sparkline(rh, f) {
  const fechas = Array.from({ length: 14 }, (_, i) => HE.addDias(f, i - 13));
  let acum = 0;
  const vals = fechas.map(x => { const d = rh.dias[x]; if (d && (d.clase === "cumple" || d.clase === "extra")) acum++; return acum; });
  const W = 280, H = 60, arriba = 6, abajo = 54;
  const max = Math.max(vals[vals.length - 1], 1);
  const X = i => (i / (fechas.length - 1)) * W;
  const Y = v => abajo - (v / max) * (abajo - arriba);
  const linea = "M" + vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L");
  return `<svg viewBox="0 0 ${W} ${H}" class="habito-spark" preserveAspectRatio="none" aria-hidden="true">
    <path d="${linea} L${W},${abajo} L0,${abajo} Z" class="habito-spark-area"/><path d="${linea}" class="habito-spark-line" fill="none"/></svg>`;
}

function renderStats() {
  if (!cargado || !res || !panelStats || panelStats.hidden) return;
  const f = res.hoy;
  const hs = activos();

  // Mapa de calor (10 semanas)
  const cal = document.getElementById("heat-cal");
  const inicio = HE.addDias(HE.lunesDe(f), -(HEAT_SEMANAS - 1) * 7);
  let html = DIAS_CORTOS.map((l, i) => `<span class="heat-wd" style="grid-column:1;grid-row:${i + 2}">${l}</span>`).join("");
  let mesPrevio = null;
  for (let w = 0; w < HEAT_SEMANAS; w++) {
    const lunes = HE.addDias(inicio, w * 7);
    const mes = Number(lunes.slice(5, 7)) - 1;
    if (mes !== mesPrevio) { html += `<span class="heat-month" style="grid-column:${w + 2};grid-row:1">${MESES[mes]}</span>`; mesPrevio = mes; }
    for (let d = 0; d < 7; d++) {
      const dia = HE.addDias(lunes, d);
      if (dia > f) continue;
      const r = HE.resumenDia(res, dia);
      const ratio = r.esperados ? r.hechos / r.esperados : 0;
      const nivel = r.esperados && ratio >= 1 ? 4 : ratio > 0.67 ? 3 : ratio > 0.34 ? 2 : ratio > 0 ? 1 : 0;
      html += `<span class="heat-day l${nivel}" style="grid-column:${w + 2};grid-row:${d + 2}" title="${fechaCorta(dia)}: ${r.hechos}/${r.esperados}">${Number(dia.slice(8))}</span>`;
    }
  }
  cal.style.gridTemplateColumns = `18px repeat(${HEAT_SEMANAS}, 24px)`;
  cal.innerHTML = html;
  cal.scrollLeft = cal.scrollWidth;

  // Tarjetas
  const p = progresoHoy(f);
  const mejor = hs.reduce((m, h) => {
    const r = res.habitos[h.id] && res.habitos[h.id].racha;
    return r && r.unidad === "dias" ? Math.max(m, r.mejor) : m;
  }, 0);
  const perfectosMes = res.diasPerfectos.filter(x => x.fecha.slice(0, 7) === f.slice(0, 7)).length;
  document.getElementById("habit-stats-row").innerHTML = [
    ["habits", "hábitos activos", hs.length],
    ["trophy", "mejor racha", plural(mejor, "día", "días")],
    ["check", "hoy", `${p.hechos}/${p.total}`],
    ["star", "días perfectos este mes", perfectosMes]
  ].map(([icono, label, valor]) => `<div class="stat-box habit-stat-box">
      <div class="habit-stat-icon" data-icon="${icono}"></div><div class="label">${label}</div><div class="value">${valor}</div></div>`).join("");

  // Desglose por hábito
  document.getElementById("habito-breakdown-empty").hidden = hs.length > 0;
  document.getElementById("habito-breakdown").innerHTML = hs.map(h => {
    const rh = res.habitos[h.id];
    if (!rh) return "";
    const total = Object.values(rh.dias).filter(d => d.clase === "cumple" || d.clase === "extra").length;
    const u = rh.racha.unidad === "semanas" ? ["semana", "semanas"] : ["día", "días"];
    return `<button type="button" class="habito-breakdown-card hb-desglose" data-detalle="${h.id}">
      <div class="habito-breakdown-head"><span class="habito-emoji-badge">${escapeHtml(h.emoji)}</span>
        <div class="habito-name"><div>${escapeHtml(h.name)}</div><div class="habito-freq">${escapeHtml(freqTexto(h))}</div></div></div>
      <div class="habito-breakdown-stats">
        <div><span>${h.tipo === "evitar" ? "mejor marca" : "mejor racha"}</span><strong>${plural(rh.racha.mejor, u[0], u[1])}</strong></div>
        <div><span>total</span><strong>${total}</strong></div>
        <div><span>desde el</span><strong>${h.inicio ? fechaCorta(h.inicio) : "—"}</strong></div>
      </div>${sparkline(rh, f)}</button>`;
  }).join("");
  renderIcons(panelStats);
}

if (panelStats) {
  panelStats.addEventListener("click", e => {
    const d = e.target.closest("[data-detalle]");
    if (d) hojaDetalle(d.dataset.detalle);
  });
  new MutationObserver(() => { if (!panelStats.hidden) renderStats(); })
    .observe(panelStats, { attributes: true, attributeFilter: ["hidden"] });
}
if (panelHoy) {
  new MutationObserver(() => { if (panelHoy.hidden && hojaActual) cerrarHoja(); })
    .observe(panelHoy, { attributes: true, attributeFilter: ["hidden"] });
}

// ---------- Todo junto ----------
function actualizar() {
  if (!cargado) return;
  recalcular();
  asegurarMisiones();
  renderHoy();
  renderStats();
  renderLogros();
  if (hojaActual && hojaActual.tipo === "detalle") hojaDetalle(hojaActual.id);
  else if (hojaActual && hojaActual.tipo === "cierre") hojaCierre();
  if (pendienteXP) {
    const ganado = res.xp - pendienteXP.xp;
    if (ganado > 0 && !reducirMovimiento()) mostrarXP(pendienteXP.id, ganado);
    pendienteXP = null;
  }
  revisarCelebraciones();
}

// Si cambia el día (o el momento del día) con la app abierta, se redibuja.
let ultimoHoy = null, ultimoMomento = null;
setInterval(() => {
  if (!cargado) return;
  const f = hoy(), m = momentoActual();
  if (f !== ultimoHoy || m !== ultimoMomento) { ultimoHoy = f; ultimoMomento = m; actualizar(); }
}, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && cargado) actualizar(); });

onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id;
      if (ch.type === "removed") { delete docs[id]; delete normal[id]; return; }
      docs[id] = ch.doc.data();
      normal[id] = HE.normalizar(docs[id], id);
    });
    cargado = true;
    ultimoHoy = hoy();
    ultimoMomento = momentoActual();
    actualizar();
    while (pendientesAuto.length) autoMarcar(...pendientesAuto.shift());
  }, err => console.error("No se pudieron leer los hábitos", err));

  metaDias().onSnapshot(doc => {
    diasMeta = (doc.exists && doc.data() && doc.data().dias) || {};
  }, err => console.error("No se pudo leer meta/habitos_dias", err));

  metaJuego().onSnapshot(doc => {
    juego = doc.exists ? doc.data() || {} : {};
    juegoExiste = doc.exists;
    juegoCargado = true;
    actualizar();
  }, err => console.error("No se pudo leer meta/habitos_juego", err));
});

// Para otros módulos y para probar desde la consola.
window.Habitos = { evaluar: () => res, recalcular: actualizar };
})();
