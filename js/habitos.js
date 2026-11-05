// ---------- Hábitos: pantallas (Hoy, Estadísticas, Logros) y Firestore ----------
// Los cálculos (rachas, XP, nivel, estados de cada día) salen de
// js/habitos-engine.js; aquí solo se leen y escriben los datos y se dibuja.
// Cada día se guarda por separado en registros.AAAA-MM-DD (escritura por
// ruta de campo), así dos toques rápidos o dos pestañas no se pisan. Para no
// romper nada, los hábitos Sí/No también siguen anotando el día en `done`.
(function () {

const HE = HabitosEngine;
const HC = HabitosConfig;
const HCat = HabitosCategorias;
const HH = HabitosHoy;
const HA = HabitosAuto;

// Emojis del formulario, por categorías (como en otras apps de hábitos).
// Están todos los de antes; además se puede escribir cualquiera del teclado.
const EMOJI_GRUPOS = [
  { id: "salud", nombre: "Salud", emojis: ["💧", "💊", "🦷", "🪥", "🛌", "😴", "🧴", "🩺", "🫁", "❤️", "🥛", "🚿", "🧼", "💆", "⚖️", "🌡️"] },
  { id: "ejercicio", nombre: "Ejercicio", emojis: ["🏃", "🚶", "💪", "🏋️", "🚴", "🧘", "🏊", "⚽", "🏀", "🎾", "🥊", "🤸", "🧗", "🥾", "🏓", "🏐"] },
  { id: "comida", nombre: "Comida", emojis: ["🥗", "🍎", "🥦", "🥑", "🥕", "🍌", "🍳", "🥣", "🐟", "🥜", "🍵", "☕", "🧃", "🍽️", "🫖", "🍓"] },
  { id: "mente", nombre: "Mente", emojis: ["🧠", "📖", "📚", "✍️", "📝", "🎯", "💡", "🧩", "♟️", "🎓", "🗣️", "🌍", "🎧", "🔤", "📓", "🤔"] },
  { id: "calma", nombre: "Calma", emojis: ["🙏", "🕯️", "🌿", "🌅", "🌙", "☀️", "🌳", "🛀", "😊", "🎵", "🌊", "✨", "🧖", "📿", "☮️", "🌸"] },
  { id: "trabajo", nombre: "Trabajo", emojis: ["💼", "💻", "⏰", "📅", "✅", "📊", "📧", "📌", "🗂️", "🚀", "⌛", "🖊️", "📋", "🔔", "🎙️", "🏢"] },
  { id: "hogar", nombre: "Hogar", emojis: ["🧹", "🧺", "🧽", "🛏️", "🪴", "🌱", "🐶", "🐱", "🗑️", "🛒", "🔧", "🚗", "👕", "🪣", "🔑", "🏠"] },
  { id: "dinero", nombre: "Dinero", emojis: ["💰", "💵", "🪙", "🏦", "📈", "🐷", "💳", "🧾", "💹", "🤑", "📉", "🧮"] },
  { id: "social", nombre: "Social", emojis: ["👨‍👩‍👧", "📞", "💬", "🤝", "💌", "🎁", "🫂", "🥰", "👋", "🎉", "👫", "🙌"] },
  { id: "hobbies", nombre: "Hobbies", emojis: ["🎨", "🎸", "🎹", "🎤", "📷", "🎬", "🧶", "🎮", "🎲", "✈️", "🏕️", "🎣", "🪁", "🧑‍🍳", "🎻", "🖌️"] },
  { id: "dejar", nombre: "Dejar", emojis: ["🚭", "📵", "🍺", "🍷", "🍔", "🍟", "🍩", "🍬", "🥤", "📱", "🎰", "💸", "🛑", "😤", "🕹️", "🧂"] }
];
const EMOJIS = EMOJI_GRUPOS.reduce((a, g) => a.concat(g.emojis), []);
let emojiGrupo = null; // categoría abierta en el formulario (null = la del emoji elegido)
// Primer emoji de lo que escribas (un emoji puede tener varios caracteres).
function primerGrafema(txt) {
  const t = String(txt || "").trim();
  if (!t) return "";
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const it = new Intl.Segmenter("es", { granularity: "grapheme" }).segment(t)[Symbol.iterator]().next();
    return it.done ? "" : it.value.segment;
  }
  return Array.from(t).slice(0, 2).join("");
}
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
// Categorías (antes "áreas de vida"), también las archivadas: su historial
// sigue contando. Ver js/habitos-categorias.js.
function areasDef() {
  return HCat.leer(juego);
}
function categoriasActivas() {
  return HCat.activas(areasDef());
}
function nombreArea(id) {
  const a = areasDef().find(x => x.id === id);
  return a ? a.nombre : null;
}
function recalcular() {
  const lista = Object.keys(normal).map(id => normal[id]);
  // Scalping suma sus horas reales para sus logros (36, 50 y 65 horas).
  const scalpingMinutos = window.HabitoScalping ? HabitoScalping.minutosTotales() : null;
  res = HE.evaluar(lista, { hoy: hoy(), finDia: finDia(), compras: compras(), misiones: juego.misiones || {}, jefes: juego.jefes || {}, areas: areasDef(), scalpingMinutos });
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
  const nuevas = HE.generarMisiones(res, lunes, areasDef());
  juego = Object.assign({}, juego, { misiones: Object.assign({}, juego.misiones, { [sem]: nuevas }) });
  metaJuego().set({ misiones: { [sem]: nuevas } }, { merge: true }).catch(errorGuardar);
  recalcular();
}

// Jefe semanal: igual que las misiones, se crea una vez por semana y se guarda.
let jefeGenerado = null;
function asegurarJefe() {
  if (!juegoCargado || !res) return;
  const lunes = HE.lunesDe(res.hoy);
  const sem = HE.semanaId(lunes);
  if ((juego.jefes || {})[sem] || jefeGenerado === sem) return;
  const def = HE.generarJefe(res, lunes);
  if (!def) return;
  jefeGenerado = sem;
  juego = Object.assign({}, juego, { jefes: Object.assign({}, juego.jefes, { [sem]: def }) });
  metaJuego().set({ jefes: { [sem]: def } }, { merge: true }).catch(errorGuardar);
  recalcular();
}
function jefeActual() {
  const sem = HE.semanaId(HE.lunesDe(res.hoy));
  return (res.jefes || []).find(j => j.semana === sem) || null;
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
// Filtro, agrupación y "ocultar hechos" se recuerdan en el teléfono.
function prefLocal(k, def) { try { const v = localStorage.getItem("hb-hoy-" + k); return v == null ? def : v; } catch (e) { return def; } }
function guardarPrefLocal(k, v) { try { if (v == null) localStorage.removeItem("hb-hoy-" + k); else localStorage.setItem("hb-hoy-" + k, v); } catch (e) { /* sin almacenamiento */ } }
let hoyFiltro = prefLocal("filtro", null);
let hoyAgrupar = prefLocal("agrupar", "momento") === "categoria" ? "categoria" : "momento";
let hoyOcultar = prefLocal("ocultar", "0") === "1";

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
  if (h.hora && x.toca && !x.hecho) partes.push(h.hora);
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
  const auto = h.vinculo && HA.fuente(h.vinculo);
  if (auto) partes.push(`<span class="hb-auto" title="Se marca solo">⚡ ${escapeHtml(auto.nombre)}</span>`);
  const racha = textoRacha(x.rh && x.rh.racha);
  // Si ayer (o la semana pasada) un perdón salvó la racha, se dice.
  if (x.rh) {
    const salvada = x.semanal ? (x.rh.semanas[x.rh.semanas.length - 2] || {}).perdonado : (x.rh.dias[HE.addDias(f, -1)] || {}).perdonado;
    if (salvada) partes.push(`<span class="hb-salvada">🛡 ${x.semanal ? "semana pasada" : "ayer"} se salvó tu racha</span>`);
  }
  return { texto: partes.join(" · "), racha };
}

function filaHtml(h, f, encadenado) {
  // Scalping tiene su propia tarjeta (js/habito-scalping.js).
  if (window.HabitoScalping && HabitoScalping.es(h)) return HabitoScalping.filaHtml();
  const x = filaHoy(h, f);
  const sub = subtitulo(h, x, f);
  const clases = ["hb-fila", x.hecho && h.tipo !== "evitar" ? "is-hecho" : "", !x.toca ? "is-apagada" : "", encadenado ? "is-encadenado" : ""].filter(Boolean).join(" ");
  const crono = cronoInicio(h.id);
  const cat = HCat.deHabito(h, areasDef());
  return `<li class="${clases}"${cat ? ` style="--cat:${HCat.colorDe(cat)}" data-cat="${cat.id}"` : ""}>
    <button type="button" class="hb-fila-info" data-detalle="${h.id}" aria-label="Ver detalle de ${escapeHtml(h.name)}">
      <span class="hb-emoji" aria-hidden="true">${escapeHtml(h.emoji)}</span>
      <span class="hb-fila-txt">
        <span class="hb-nombre">${escapeHtml(h.name)}</span>
        ${h.descripcion ? `<span class="hb-desc-fila">${escapeHtml(h.descripcion)}</span>` : ""}
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
      <button type="button" class="hb-btn" data-nuevo>Crear un hábito</button></div>` + (window.HabitoScalping ? HabitoScalping.sugerenciaHtml() : "");
    renderIcons(lista);
    return;
  }
  const actual = momentoActual();
  const hoyToca = [], noToca = [];
  todos.forEach(h => (filaHoy(h, f).toca ? hoyToca : noToca).push(h));
  const cats = areasDef();
  const items = hoyToca.map(h => {
    const x = filaHoy(h, f);
    return { id: h.id, area: h.area, timeOfDay: h.timeOfDay, despuesDe: h.despuesDe, hora: h.hora, hecho: h.tipo !== "evitar" && (x.hecho || (x.semanal && x.semanaOk)), cuenta: h.tipo !== "evitar" };
  });
  const chips = HH.filtros(items, cats);
  // Un filtro que ya no existe (o sin hábitos hoy) muestra todo.
  const filtro = chips.some(c => c.id === hoyFiltro) ? hoyFiltro : null;
  const grupos = HH.grupos(items, { agrupar: hoyAgrupar, filtro, ocultarHechos: hoyOcultar, momento: actual, categorias: cats });
  let html = barraHoyHtml(chips, filtro, items.length);
  const faltan = HH.pendientesMomento(items, actual);
  if (faltan && items.length) html += `<p class="hb-aviso-momento" role="status"><span aria-hidden="true">⏰</span> Te ${faltan === 1 ? "falta" : "faltan"} <b>${faltan}</b> ${MOMENTO_DE[actual]}</p>`;
  const catFiltro = filtro && filtro !== HH.SIN ? cats.find(c => c.id === filtro) : null;
  if (catFiltro) html += `<a class="hb-ver-cat" href="#hab-categoria/${catFiltro.id}" style="--cat:${HCat.colorDe(catFiltro)}"><span aria-hidden="true">${escapeHtml(catFiltro.emoji)}</span> Ver la página de ${escapeHtml(catFiltro.nombre)}<span aria-hidden="true">›</span></a>`;
  html += grupos.map(g => {
    const enGrupo = new Set(g.items.map(x => x.id));
    const color = g.color ? HCat.colorDe(g.color) : null;
    const pct = g.total ? (g.hechos / g.total) * 100 : 0;
    let cab = `${g.emoji ? `<span aria-hidden="true">${escapeHtml(g.emoji)}</span> ` : ""}${escapeHtml(g.nombre)}${g.ahora ? ` <span class="hb-ahora">Ahora</span>` : ""}`;
    if (g.tipo === "categoria" && g.id !== HH.SIN) cab = `<a class="hb-grupo-link" href="#hab-categoria/${g.id}">${cab}<span class="hb-grupo-ir" aria-hidden="true">›</span></a>`;
    return `<section class="hb-grupo" aria-label="${escapeHtml(g.nombre)}"${color ? ` style="--cat:${color}"` : ""}>
      <h2 class="hb-grupo-t">${cab}${g.total ? `<span class="hb-grupo-prog" aria-label="${g.hechos} de ${g.total} hechos">${g.hechos}/${g.total}</span><span class="hb-grupo-barra" aria-hidden="true"><span style="width:${pct.toFixed(0)}%"></span></span>` : ""}</h2>
      ${g.items.length ? `<ul class="hb-filas">${g.items.map(x => filaHtml(normal[x.id], f, !!(x.despuesDe && enGrupo.has(x.despuesDe)))).join("")}</ul>`
        : `<p class="hb-grupo-listo"><span data-icon="check"></span>Todo hecho</p>`}</section>`;
  }).join("");
  if (!grupos.length && items.length) html += `<p class="hb-texto hb-filtro-vacio">No hay hábitos de esta categoría hoy.</p>`;
  const noTocaVer = noToca.filter(h => !filtro || (filtro === HH.SIN ? !HCat.deHabito(h, cats) : h.area === filtro));
  if (noTocaVer.length) {
    html += `<details class="hb-grupo hb-notoca"><summary class="hb-grupo-t">No tocan hoy (${noTocaVer.length})</summary>
      <ul class="hb-filas">${noTocaVer.map(h => filaHtml(h, f)).join("")}</ul></details>`;
  }
  const tarde = new Date().getHours() >= 18 || new Date().getHours() < finDia();
  html += `<div class="hb-pie">
    ${tarde ? `<button type="button" class="hb-btn hb-cerrar-dia" data-cerrar-dia><span data-icon="check"></span>Cerrar el día</button>` : ""}
    <div class="hb-pie-sec">
      ${!tarde ? `<button type="button" class="hb-btn-sec" data-cerrar-dia>Cerrar el día</button>` : ""}
      <button type="button" class="hb-btn-sec" data-ordenar><span data-icon="grip"></span>Ordenar</button>
      <button type="button" class="hb-btn-sec" data-ajustes><span data-icon="tools"></span>Ajustes</button>
    </div>
    <p class="hb-pie-ayuda">Mantén presionado un hábito para parcial, mínima, saltar o nota.</p></div>`;
  const semanaPasada = HE.semanaId(HE.addDias(HE.lunesDe(f), -7));
  let visto = null;
  try { visto = localStorage.getItem("hb-resumen-visto"); } catch (e) { /* sin almacenamiento */ }
  html = (window.HabitoScalping ? HabitoScalping.sugerenciaHtml() : "") + jefeMiniHtml() + html;
  if (HE.diaSemana(f) === 0 && visto !== semanaPasada) html = resumenSemanaHtml(true) + html;
  const abierto = lista.querySelector(".hb-notoca") && lista.querySelector(".hb-notoca").open;
  lista.innerHTML = html;
  if (abierto) lista.querySelector(".hb-notoca").open = true;
  animarGolpe(lista);
  renderIcons(lista);
  renderIcons(document.getElementById("hb-personaje"));
  ultimoMarcado = null;
}

const MOMENTO_DE = { manana: "de la mañana", tarde: "de la tarde", noche: "de la noche" };
// Pendientes del momento actual (para Hoy e Inicio).
function pendientesAhora() {
  const f = res.hoy;
  const items = activos().filter(h => HE.activoEn(h, f)).map(h => {
    const x = filaHoy(h, f);
    return x.toca ? { id: h.id, timeOfDay: h.timeOfDay, despuesDe: h.despuesDe, hecho: h.tipo !== "evitar" && (x.hecho || (x.semanal && x.semanaOk)), cuenta: h.tipo !== "evitar" } : null;
  }).filter(Boolean);
  return HH.pendientesMomento(items, momentoActual());
}
// Filtros por categoría, agrupar y ocultar hechos (arriba de la lista).
function barraHoyHtml(chips, filtro, n) {
  if (n < 2) return "";
  const conCats = chips.length > 1;
  return `<div class="hb-hoy-barra">
    ${conCats ? `<div class="hb-filtros" role="group" aria-label="Filtrar por categoría">${chips.map(c => {
      const on = c.id === filtro;
      const color = c.color ? HCat.colorDe(c.color) : null;
      return `<button type="button" class="hb-filtro${on ? " is-on" : ""}" data-hoy-filtro="${c.id || ""}" aria-pressed="${on}"${color ? ` style="--cat:${color}"` : ""}>${c.emoji ? `<span aria-hidden="true">${escapeHtml(c.emoji)}</span>` : ""}${escapeHtml(c.nombre)}${c.pendientes ? `<b aria-label="${c.pendientes} pendientes">${c.pendientes}</b>` : `<span class="hb-filtro-ok" aria-label="sin pendientes">✓</span>`}</button>`;
    }).join("")}</div>` : ""}
    <div class="hb-hoy-opciones">
      <span class="hb-seg" role="group" aria-label="Agrupar por">
        <button type="button" data-hoy-agrupar="momento" aria-pressed="${hoyAgrupar === "momento"}" class="${hoyAgrupar === "momento" ? "is-on" : ""}">Momento</button>
        <button type="button" data-hoy-agrupar="categoria" aria-pressed="${hoyAgrupar === "categoria"}" class="${hoyAgrupar === "categoria" ? "is-on" : ""}">Categoría</button>
      </span>
      <button type="button" class="hb-ocultar${hoyOcultar ? " is-on" : ""}" data-hoy-ocultar aria-pressed="${hoyOcultar}">${hoyOcultar ? "Mostrar hechos" : "Ocultar hechos"}</button>
    </div>
  </div>`;
}
function onBarraHoy(t) {
  let b;
  if ((b = t.closest("[data-hoy-filtro]"))) {
    hoyFiltro = b.dataset.hoyFiltro || null;
    guardarPrefLocal("filtro", hoyFiltro);
    renderHoy();
    return true;
  }
  if ((b = t.closest("[data-hoy-agrupar]"))) {
    hoyAgrupar = b.dataset.hoyAgrupar === "categoria" ? "categoria" : "momento";
    guardarPrefLocal("agrupar", hoyAgrupar);
    renderHoy();
    return true;
  }
  if (t.closest("[data-hoy-ocultar]")) {
    hoyOcultar = !hoyOcultar;
    guardarPrefLocal("ocultar", hoyOcultar ? "1" : "0");
    renderHoy();
    return true;
  }
  return false;
}

// ---------- Opciones del día (mantener presionado) ----------
function hojaOpciones(id) {
  const h = normal[id], rh = res && res.habitos[id];
  if (!h || !rh || (window.HabitoScalping && HabitoScalping.es(h))) return;
  const f = res.hoy;
  abrirHoja(cabecera(`Hoy · ${fechaCorta(f)}`, `${escapeHtml(h.emoji)} ${escapeHtml(h.name)}`) + `
    ${editorDia(h, rh, f)}
    ${h.tipo === "tiempo" ? cronometroHtml(h) : ""}
    <div class="hb-acciones"><button type="button" class="hb-btn-sec" data-detalle="${id}">Ver detalle</button><button type="button" class="hb-btn" data-cerrar>Listo</button></div>`, { tipo: "opciones", id });
}
// Mantener presionado ~0,5 s una fila abre sus opciones; un toque sigue marcando.
const PRESION_MS = 500;
let presion = null, sinClick = false;
function empezarPresion(e) {
  const fila = e.target.closest && e.target.closest(".hb-fila");
  const btn = e.target.closest && e.target.closest("[data-marcar], [data-detalle]");
  if (!fila || !btn || fila.closest(".sc-fila") || (e.button != null && e.button !== 0)) return;
  const id = btn.dataset.marcar || btn.dataset.detalle;
  cancelarPresion();
  presion = { id, x: e.clientX, y: e.clientY, t: setTimeout(() => {
    presion = null;
    sinClick = true;
    setTimeout(() => { sinClick = false; }, 700);
    if (navigator.vibrate) navigator.vibrate(12);
    hojaOpciones(id);
  }, PRESION_MS) };
}
function moverPresion(e) {
  if (presion && Math.hypot(e.clientX - presion.x, e.clientY - presion.y) > 10) cancelarPresion();
}
function cancelarPresion() {
  if (presion) { clearTimeout(presion.t); presion = null; }
}
(function () {
  const lista = document.getElementById("hb-lista");
  lista.addEventListener("pointerdown", empezarPresion);
  lista.addEventListener("pointermove", moverPresion);
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => lista.addEventListener(ev, cancelarPresion));
  // En la computadora, clic derecho también abre las opciones.
  lista.addEventListener("contextmenu", e => {
    const btn = e.target.closest(".hb-fila:not(.sc-fila) [data-marcar], .hb-fila:not(.sc-fila) [data-detalle]");
    if (!btn) return;
    e.preventDefault();
    cancelarPresion();
    hojaOpciones(btn.dataset.marcar || btn.dataset.detalle);
  });
})();

// ---------- Jefe semanal en Hoy ----------
function vidaPct(j) {
  return j.vida ? (j.vidaRestante / j.vida) * 100 : 0;
}
function jefeMiniHtml() {
  const j = jefeActual();
  if (!j) return "";
  const caido = j.estado === "derrotado";
  const etiqueta = caido ? `Derrotaste a ${j.nombre}. Ver el jefe de la semana`
    : `Jefe de la semana: ${j.nombre}, le quedan ${j.vidaRestante} de ${j.vida} de vida. Ver detalles`;
  return `<a class="hb-jefe-mini${caido ? " is-caido" : ""}" href="#hab-logros" data-ir-jefe data-semana="${j.semana}" aria-label="${escapeHtml(etiqueta)}">
    <span class="hb-jefe-emoji" aria-hidden="true">${escapeHtml(j.emoji)}</span>
    <span class="hb-jefe-mini-txt" aria-hidden="true">
      <span class="hb-jefe-nombre">${caido ? `Derrotaste a ${escapeHtml(j.nombre)}` : escapeHtml(j.nombre)}</span>
      ${caido ? `<span class="hb-jefe-botin">+${j.xp} XP · +${j.monedas} monedas</span>` : `<span class="hb-vida"><span style="width:${vidaPct(j).toFixed(1)}%"></span></span>`}
    </span>
    ${caido ? `<span class="hb-jefe-ok" aria-hidden="true"><span data-icon="check"></span></span>` : `<span class="hb-jefe-num" aria-hidden="true">${fmtNum(j.vidaRestante)}<small>/${fmtNum(j.vida)}</small></span>`}
  </a>`;
}
// Al hacerle daño, la barra baja desde donde estaba y el rival se sacude.
let vidaPintada = null; // { semana, pct }
function animarGolpe(cont) {
  const a = cont.querySelector(".hb-jefe-mini");
  const j = jefeActual();
  if (!a || !j) { vidaPintada = null; return; }
  const pct = vidaPct(j);
  const antes = vidaPintada && vidaPintada.semana === j.semana ? vidaPintada.pct : null;
  vidaPintada = { semana: j.semana, pct };
  if (antes == null || pct >= antes || reducirMovimiento()) return;
  a.querySelector(".hb-jefe-emoji").classList.add("is-golpe");
  const barra = a.querySelector(".hb-vida > span");
  if (!barra) return;
  barra.style.transition = "none";
  barra.style.width = `${antes.toFixed(1)}%`;
  barra.getBoundingClientRect();
  barra.style.transition = "";
  barra.style.width = `${pct.toFixed(1)}%`;
}

// "+N XP" flotando sobre el botón que se tocó.
function mostrarXP(id, n) {
  if (hoja && !hoja.hidden) return;
  const btn = document.querySelector(`#hb-lista [data-marcar="${id}"], #hb-lista [data-xp-ancla="${id}"]`);
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
    FP("registros", f, "e"), FV().delete(),
    FP("registros", f, "auto"), FV().delete() // editado a mano: ya no es automático
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
let deshacerPendiente = false; // mientras se puede deshacer, no se celebra ni se guarda el snapshot
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
  deshacerPendiente = !!deshacer;
  const btn = toastEl.querySelector(".hb-toast-btn");
  if (btn) btn.addEventListener("click", () => { deshacer(); ocultarToast(); }, { once: true });
  toastTimer = setTimeout(ocultarToast, TOAST_MS);
}
function ocultarToast() {
  if (!toastEl) return;
  toastEl.classList.remove("is-on");
  if (deshacerPendiente) { deshacerPendiente = false; anotarToque(); }
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
    hoja.addEventListener("input", e => {
      if (plugins.input.some(fn => fn(e, e.target))) return;
      if (e.target.name === "name" && form && !form.id) { form.name = e.target.value; pintarSugerencia(); return; }
      if (e.target.name !== "emojiPropio" || !form) return;
      const propio = primerGrafema(e.target.value);
      const prev = hoja.querySelector("[data-emoji-actual]");
      if (prev) prev.textContent = propio || form.emoji;
      hoja.querySelectorAll(".hb-emoji-btn").forEach(b => {
        const on = !propio && b.dataset.v === form.emoji;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
    });
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
  if (hojaActual && hojaActual.tipo === "temporada") temporadaVista();
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
  // Scalping se abre en su propia pantalla (#hab-scalping).
  if (window.HabitoScalping && HabitoScalping.es(id)) { cerrarHoja(); HabitoScalping.abrir(); return; }
  const h = normal[id];
  const rh = res && res.habitos[id];
  if (!h || !rh) { cerrarHoja(); return; }
  const f = res.hoy;
  const nuevo = !hojaActual || hojaActual.tipo !== "detalle" || hojaActual.id !== id;
  if (nuevo) {
    diaSel = f;
    mesSel = f.slice(0, 7);
    pausaAbierta = false;
  }
  if (fecha) { diaSel = fecha; if (nuevo) mesSel = fecha.slice(0, 7); }
  const arriba = [nombreArea(h.area), HC.DIFICULTADES[h.dificultad].nombre, freqTexto(h)].filter(Boolean).join(" · ");
  const c30 = HE.cumplimiento(rh, HE.addDias(f, -29), f);
  const cTotal = HE.cumplimiento(rh, h.inicio || f, f);
  const semanal = h.freqType === "semana";
  const totalHechos = Object.values(rh.dias).filter(d => d.clase === "cumple" || d.clase === "extra").length;
  const r = rh.racha;
  const unidad = r.unidad === "semanas" ? (r.actual === 1 ? "semana" : "semanas") : r.actual === 1 ? "día" : "días";
  const pct = v => (v == null ? "—" : `${Math.round(v * 100)} %`);

  abrirHoja(cabecera(escapeHtml(arriba), `${escapeHtml(h.emoji)} ${escapeHtml(h.name)}`, h.inicio ? `Desde el ${fechaCorta(h.inicio)}` : "") + `
    ${h.descripcion ? `<p class="hb-descripcion">${escapeHtml(h.descripcion)}</p>` : ""}
    <div class="hb-stats">
      <div class="hb-stat"><span class="hb-num">${r.actual}</span><span>${h.tipo === "evitar" ? (r.actual === 1 ? "día limpio" : "días limpios") : `${unidad} de racha`}</span></div>
      <div class="hb-stat"><span class="hb-num">${r.mejor}</span><span>${h.tipo === "evitar" ? "mejor marca" : "mejor racha"}</span></div>
      <div class="hb-stat"><span class="hb-num">${pct(c30)}</span><span>${semanal ? "últimas 4 semanas" : "últimos 30 días"}</span></div>
      <div class="hb-stat"><span class="hb-num">${pct(HE.cumplimiento(rh, HE.addDias(f, -89), f))}</span><span>últimos 90 días</span></div>
      <div class="hb-stat"><span class="hb-num">${pct(cTotal)}</span><span>desde que empezaste</span></div>
      <div class="hb-stat"><span class="hb-num">${fmtNum(totalHechos)}</span><span>${totalHechos === 1 ? "vez en total" : "veces en total"}</span></div>
    </div>
    ${perdonesHtml(rh)}
    ${rangoHtml(rh)}
    ${calendarioHtml(h, rh)}
    ${editorDia(h, rh, diaSel)}
    ${h.tipo === "tiempo" && diaSel === f ? cronometroHtml(h) : ""}
    ${graficosDetalle(h, rh)}
    ${notasHtml(h)}
    ${pausasHtml(h)}
    <div class="hb-acciones">
      <button type="button" class="hb-btn-sec" data-editar="${id}"><span data-icon="edit"></span>Editar</button>
      <button type="button" class="hb-btn-sec" data-archivar="${id}">Archivar</button>
      <button type="button" class="hb-btn-sec is-peligro" data-eliminar="${id}"><span data-icon="trash"></span>Eliminar</button>
    </div>`, { tipo: "detalle", id });
}

// Racha que perdona (D-089): cuántos perdones tienes y cuánto falta para otro.
function perdonesHtml(rh) {
  const p = rh.perdones;
  if (!p || !p.aplica) return "";
  const u = p.semanal ? ["semana", "semanas"] : ["día", "días"];
  const escudos = Array.from({ length: p.max }, (_, i) => `<span class="hb-perdon${i < p.guardados ? " is-on" : ""}"></span>`).join("");
  const estado = p.guardados >= p.max
    ? `Tienes ${plural(p.guardados, "perdón", "perdones")}: si fallas ${p.max === 1 ? `una ${u[0]}` : `uno o dos ${u[1]}`}, tu racha sigue.`
    : `${p.guardados ? `Tienes ${plural(p.guardados, "perdón", "perdones")}.` : "Sin perdones: si fallas ahora, la racha se corta."} Cumple ${plural(p.faltan, `${u[0]} más`, `${u[1]} más`)} para ganar otro.`;
  return `<div class="hb-perdones" role="note" aria-label="Perdones de racha: ${p.guardados} de ${p.max}">
    <span class="hb-perdones-iconos" aria-hidden="true">${escudos}</span>
    <p><b>Racha que perdona.</b> ${estado}<span class="hb-ayuda"> Ganas uno por cada ${p.cada === 7 ? "semana cumplida" : `${p.cada} ${u[1]} cumplidas`} (guardas hasta ${p.max}).${p.usados ? ` Ya te salvó ${plural(p.usados, "vez", "veces")}.` : ""}</span></p>
  </div>`;
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
      if (d.perdonado) c += " c-perdon";
      txt = d.protegido ? "cubierto por un comodín" : d.estado ? HC.ESTADOS[d.estado].nombre.toLowerCase() : { fallo: "no hecho", pendiente: "pendiente", noToca: "no tocaba", neutral: "en pausa", fuera: "sin datos" }[d.clase] || "";
      if (d.perdonado) txt += " · la racha siguió (perdón)";
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
    <div class="hb-cal-leyenda"><span><i class="c-cumple"></i>Hecho</span><span><i class="c-cumple c-parcial"></i>Parcial o mínima</span><span><i class="c-neutral"></i>Saltado o pausa</span><span><i class="c-fallo"></i>No hecho</span><span><i class="c-fallo c-perdon"></i>Perdonado</span></div>
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
    descripcion: h ? h.descripcion || "" : "",
    despuesDe: h ? h.despuesDe || "" : "",
    hora: h ? h.hora || "" : "",
    vinculo: h ? h.vinculo || "" : "",
    vinculoMedida: h && h.vinculoCfg ? h.vinculoCfg.medida || "" : "",
    vinculoRutina: h && h.vinculoCfg ? h.vinculoCfg.rutina || "" : "",
    vinculoCategoria: h && h.vinculoCfg ? h.vinculoCfg.categoria || "" : "",
    // "Más opciones" abierto si el hábito ya usa alguna.
    _mas: !!(h && (h.descripcion || h.minima || h.despuesDe || h.vinculo || h.dificultad !== "media"))
  };
}
// Categorías como chips con su color, "Sin categoría" y "+ Nueva".
// Al crear: sugiere la categoría según el nombre o el emoji (reglas simples).
function sugerenciaCatHtml(f) {
  if (f.id || f.areaElegida) return "";
  const id = HCat.sugerir(f.name, primerGrafema(f.emojiPropio) || f.emoji, areasDef());
  const c = id && id !== f.area && areasDef().find(x => x.id === id);
  return c ? `<span class="hb-cat-sugerida">Sugerida: <button type="button" class="hb-chip hb-chip-cat" data-campo="area" data-v="${c.id}" style="--cat:${HCat.colorDe(c)}">${escapeHtml(c.emoji)} ${escapeHtml(c.nombre)}</button></span>` : "";
}
function pintarSugerencia() {
  const el = hoja && hoja.querySelector("[data-cat-sugerencia]");
  if (el) el.innerHTML = sugerenciaCatHtml(form);
}
function categoriaChipsHtml(f) {
  const lista = areasDef().filter(a => !a.archivada || a.id === f.area);
  return `<div class="hb-chips" role="group" aria-label="Categoría">${lista.map(a => {
    const on = f.area === a.id;
    return `<button type="button" class="hb-chip hb-chip-cat${on ? " is-on" : ""}" data-campo="area" data-v="${a.id}" aria-pressed="${on}" style="--cat:${HCat.colorDe(a)}"><span aria-hidden="true">${escapeHtml(a.emoji)}</span> ${escapeHtml(a.nombre)}</button>`;
  }).join("")}
    <button type="button" class="hb-chip${!f.area ? " is-on" : ""}" data-campo="area" data-v="" aria-pressed="${!f.area}">Sin categoría</button>
    <button type="button" class="hb-chip hb-chip-nueva" data-cat-nueva="form">+ Nueva</button></div>`;
}

function chips(nombre, opciones, actual) {
  return `<div class="hb-chips" role="group">${opciones.map(([v, t]) =>
    `<button type="button" class="hb-chip${String(actual) === String(v) ? " is-on" : ""}" data-campo="${nombre}" data-v="${v}" aria-pressed="${String(actual) === String(v)}">${t}</button>`).join("")}</div>`;
}

function hojaForm(id) {
  if (id !== undefined) { form = formDesde(id ? normal[id] : null); emojiGrupo = null; }
  const f = form;
  const medible = f.tipo === "medible" || f.tipo === "tiempo";
  const evitar = f.tipo === "evitar";
  abrirHoja(cabecera("", f.id ? "Editar hábito" : "Nuevo hábito") + (f.id ? "" : planesGuiadosHtml()) + `
    <form class="hb-form" novalidate>
      <label class="hb-campo">Nombre
        <input type="text" name="name" maxlength="60" required value="${escapeHtml(f.name)}" placeholder="Ej: Tomar agua" autocomplete="off">
      </label>
      ${emojisHtml(f)}

      <span class="hb-label">Categoría</span>
      ${categoriaChipsHtml(f)}
      <div data-cat-sugerencia>${sugerenciaCatHtml(f)}</div>

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
      <label class="hb-campo hb-hora"><span>Hora <span class="hb-opcional">(opcional)</span></span>
        <input type="time" name="hora" value="${escapeHtml(f.hora || "")}">
        <span class="hb-ayuda">Ordena el hábito dentro de su momento (y sirve para avisos más adelante).</span></label>

      <button type="button" class="hb-mas" data-mas-opciones aria-expanded="${!!f._mas}">${f._mas ? "Menos opciones" : "Más opciones"}<span aria-hidden="true">${f._mas ? "▴" : "▾"}</span></button>
      ${f._mas ? `<div class="hb-mas-cuerpo">
      <label class="hb-campo"><span>Nota <span class="hb-opcional">(opcional)</span></span>
        <textarea name="descripcion" rows="3" maxlength="${HC.CONST.DESCRIPCION_MAX}" placeholder="Ej: Agradecer por mi familia, por mi salud y por mi trabajo.">${escapeHtml(f.descripcion)}</textarea>
        <span class="hb-ayuda">Para recordar el porqué o el cómo. Se ve debajo del nombre.</span></label>

      <span class="hb-label">Dificultad</span>
      ${chips("dificultad", Object.keys(HC.DIFICULTADES).map(k => [k, `${HC.DIFICULTADES[k].nombre} · ${HC.DIFICULTADES[k].xp} XP`]), f.dificultad)}

      <label class="hb-campo"><span>Después de <span class="hb-opcional">(opcional)</span></span>
        <select name="despuesDe">${opcionesCadena(f)}</select>
        <span class="hb-ayuda">Encadénalo a otro hábito: “Después de meditar, leeré”. Se muestran en secuencia.</span></label>

      <span class="hb-label">Se marca solo</span>
      ${vinculoHtml(f)}

      ${evitar ? "" : `<label class="hb-campo"><span>Versión mínima <span class="hb-opcional">(opcional)</span></span>
        <input type="text" name="minima" maxlength="60" value="${escapeHtml(f.minima)}" placeholder="Ej: leer 1 página">
        <span class="hb-ayuda">Para los días difíciles: mantiene tu racha con menos XP.</span></label>`}
      </div>` : ""}

      <p class="hb-error" hidden></p>
      <div class="hb-acciones hb-acciones-fijas">
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
// Planes guiados al crear un hábito (siempre a mano, aunque se haya
// descartado la sugerencia de Hoy): Scalping se agrega o se abre desde aquí.
function planesGuiadosHtml() {
  const plantillas = window.HabitosPlantillas ? `<button type="button" class="hb-plant-abrir" data-plant-abrir>
      <span class="hb-plan-emoji" aria-hidden="true">📋</span>
      <span class="hb-plan-txt"><b>Plantillas</b><span>Elige entre ${HabitosPlantillas.LISTA.length} hábitos comunes y ajústalo</span></span>
      <span class="hb-plant-ir" aria-hidden="true">›</span></button>` : "";
  if (!window.HabitoScalping) return plantillas;
  const existe = !!docs[HabitoScalping.ID];
  return plantillas + `<div class="hb-plan-guiado">
      <span class="hb-plan-emoji" aria-hidden="true">💆</span>
      <span class="hb-plan-txt"><b>Plan guiado: Scalping</b><span>Masaje del cuero cabelludo · 180 días</span></span>
      <button type="button" class="${existe ? "hb-btn-sec" : "hb-btn"}" ${existe ? "data-sc-abrir" : "data-sc-crear"}>${existe ? "Abrir" : "Agregar"}</button>
    </div>`;
}

// Selector de emoji: categorías, la grilla de la categoría abierta y un campo
// para escribir cualquier emoji del teclado.
function emojisHtml(f) {
  const propio = primerGrafema(f.emojiPropio);
  const actual = propio || f.emoji;
  const grupo = EMOJI_GRUPOS.find(g => g.id === emojiGrupo) || EMOJI_GRUPOS.find(g => g.emojis.includes(f.emoji)) || EMOJI_GRUPOS[0];
  return `<div class="hb-emoji-cab"><span class="hb-label">Emoji</span><span class="hb-emoji-actual" data-emoji-actual aria-label="Emoji elegido">${escapeHtml(actual)}</span></div>
      <div class="hb-emoji-grupos" role="tablist" aria-label="Categorías de emojis">${EMOJI_GRUPOS.map(g =>
        `<button type="button" class="hb-emoji-grupo${g === grupo ? " is-on" : ""}" role="tab" aria-selected="${g === grupo}" data-emoji-grupo="${g.id}">${escapeHtml(g.nombre)}</button>`).join("")}</div>
      <div class="hb-emojis" role="group" aria-label="Emojis de ${escapeHtml(grupo.nombre)}">${grupo.emojis.map(e => {
        const on = !propio && e === f.emoji;
        return `<button type="button" class="hb-emoji-btn${on ? " is-on" : ""}" data-campo="emoji" data-v="${e}" aria-pressed="${on}">${e}</button>`;
      }).join("")}</div>
      <label class="hb-campo hb-emoji-propio"><span>¿No está el que buscas? Escríbelo <span class="hb-opcional">(teclado de emojis)</span></span>
        <input type="text" name="emojiPropio" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escapeHtml(propio)}" placeholder="🙂"></label>`;
}

function leerCampos() {
  if (!hoja) return;
  hoja.querySelectorAll(".hb-form input[name], .hb-form select[name], .hb-form textarea[name]").forEach(i => { form[i.name] = i.value; });
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
    v: 2, name, emoji: primerGrafema(f.emojiPropio) || f.emoji, tipo: f.tipo,
    freqType: f.tipo === "evitar" ? "diario" : f.freqType,
    days: f.days.map(Boolean),
    timesPerWeek: Math.min(7, Math.max(1, parseInt(f.timesPerWeek, 10) || HC.CONST.TIMES_PER_WEEK_DEFECTO)),
    cadaN: Math.min(HC.CONST.CADA_N_MAX, Math.max(2, parseInt(f.cadaN, 10) || HC.CONST.CADA_N_DEFECTO)),
    timeOfDay: f.timeOfDay,
    dificultad: f.dificultad,
    area: f.area || null,
    minima: f.tipo === "evitar" ? "" : String(f.minima || "").trim(),
    despuesDe: f.despuesDe || null,
    vinculo: vinculoValido(f) || null
  };
  const hora = HH.hora(f.hora);
  if (hora) datos.hora = hora;
  else if (f.id) datos.hora = FV().delete();
  const anterior = f.id ? normal[f.id] : null;
  if (datos.vinculo) {
    datos.vinculoCfg = { medida: f.tipo === "medible" ? f.vinculoMedida || medidaDefecto(datos.vinculo) : null, rutina: datos.vinculo === "movilidad" ? f.vinculoRutina || null : null, categoria: datos.vinculo === "gasto" ? f.vinculoCategoria || null : null };
    // Desde cuándo se marca solo: hoy, salvo que ya estuviera vinculado igual.
    const igual = anterior && anterior.vinculo === datos.vinculo && JSON.stringify(anterior.vinculoCfg || {}) === JSON.stringify(datos.vinculoCfg);
    datos.vinculoDesde = igual && anterior.vinculoDesde ? anterior.vinculoDesde : hoy();
  } else if (f.id) {
    datos.vinculoCfg = FV().delete();
    datos.vinculoDesde = FV().delete();
  }
  if (medible) {
    datos.meta = Math.max(1, Number(String(f.meta).replace(",", ".")) || HC.CONST.META_DEFECTO[f.tipo]);
    datos.unidad = f.tipo === "tiempo" ? "min" : String(f.unidad || "").trim();
  }
  // Nota del hábito: si la vacías al editar, se quita el campo.
  const descripcion = String(f.descripcion || "").trim().slice(0, HC.CONST.DESCRIPCION_MAX);
  if (descripcion) datos.descripcion = descripcion;
  else if (f.id) datos.descripcion = FV().delete();
  const nuevoVinculo = datos.vinculo && datos.vinculoDesde === hoy() && !(anterior && anterior.vinculoDesde === hoy());
  let id = f.id;
  if (f.id) {
    coleccion().doc(f.id).update(datos).catch(errorGuardar);
    cerrarHoja();
    toast("Cambios guardados.");
  } else {
    const orden = Object.keys(normal).reduce((m, k) => Math.max(m, normal[k].orden || 0), 0) + 1;
    Object.assign(datos, { done: [], registros: {}, createdAt: Date.now(), inicio: hoy(), orden });
    // Con el id ya elegido (sin esperar al servidor) se puede ofrecer rellenar.
    const ref = coleccion().doc();
    id = ref.id;
    ref.set(datos).catch(errorGuardar);
    cerrarHoja();
    toast(`Creaste «${name}». ¡A por el primer día!`);
  }
  if (nuevoVinculo) setTimeout(() => ofrecerRellenar(id), 350);
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
    <h4 class="hb-sub-t">Categorías</h4>
    <button type="button" class="hb-ajuste-fila" data-cat-gestionar>
      <span class="hb-ajuste-emojis" aria-hidden="true">${categoriasActivas().map(a => `<span style="--cat:${HCat.colorDe(a)}">${escapeHtml(a.emoji)}</span>`).join("")}</span>
      <span class="hb-ajuste-txt">Crear, editar, ordenar y asignar</span><span class="hb-ajuste-ir" aria-hidden="true">›</span>
    </button>
    <h4 class="hb-sub-t">Archivados</h4>
    ${archivados.length ? `<ul class="hb-pausas">${archivados.map(h => `<li><span>${escapeHtml(h.emoji)} ${escapeHtml(h.name)}${h.archivadoEn ? ` · desde el ${fechaCorta(h.archivadoEn)}` : ""}</span>
      <span class="hb-chips"><button type="button" class="hb-btn-sec" data-restaurar="${h.id}">Restaurar</button>
      <button type="button" class="hb-btn-sec is-peligro" data-eliminar="${h.id}" aria-label="Eliminar ${escapeHtml(h.name)}"><span data-icon="trash"></span></button></span></li>`).join("")}</ul>`
      : `<p class="hb-texto">No tienes hábitos archivados. Archivar guarda el historial sin mostrarlo en Hoy.</p>`}
    <h4 class="hb-sub-t">Copia de seguridad</h4>
    <p class="hb-texto">Guarda en un archivo tus hábitos, todo tu historial y tu progreso. Al importar una copia solo se agrega lo que te falta: nunca se borra ni se cambia lo que ya tienes.</p>
    <div class="hb-chips">
      <button type="button" class="hb-btn-sec" data-exportar><span data-icon="download"></span>Exportar</button>
      <button type="button" class="hb-btn-sec" data-importar>Importar una copia</button>
    </div>
    <input type="file" accept="application/json,.json" data-archivo-importar hidden>`, { tipo: "ajustes" });
}
// ---------- Copia de seguridad (JSON) ----------
// Los Timestamp de Firestore se guardan como milisegundos.
const aJSON = (k, v) => (v && typeof v === "object" && typeof v.toMillis === "function" ? v.toMillis() : v);
function exportar() {
  const datos = HE.copiaDeSeguridad(docs, juego, diasMeta, Date.now());
  const nombre = `manolo-habitos-${res ? res.hoy : HE.isoDate(new Date())}.json`;
  const blob = new Blob([JSON.stringify(datos, aJSON, 1)], { type: "application/json" });
  const n = Object.keys(docs).length;
  // En el iPhone, compartir abre la hoja con "Guardar en Archivos".
  try {
    const archivo = new File([blob], nombre, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: "Copia de tus hábitos" }).catch(() => { /* cancelado */ });
      return;
    }
  } catch (e) { /* sin compartir: se descarga */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Exportaste ${plural(n, "hábito", "hábitos")} con todo su historial.`);
}
const MAX_COPIA_BYTES = 15 * 1024 * 1024;
let planImportar = null;
function leerCopia(archivo) {
  if (!archivo) return;
  if (archivo.size > MAX_COPIA_BYTES) { toast("Ese archivo es demasiado grande para ser una copia de tus hábitos."); return; }
  archivo.text().then(texto => {
    let datos;
    try { datos = JSON.parse(texto); } catch (e) { toast("No se pudo leer el archivo. Elige la copia que exportaste desde Manolo."); return; }
    const cats = {};
    areasDef().forEach(c => { cats[c.id] = c; });
    const plan = HE.planImportacion(datos, { docs, juego: Object.assign({}, juego, { categorias: Object.assign(cats, juego.categorias) }), dias: diasMeta });
    if (!plan.valido) { toast(plan.error); return; }
    hojaImportar(plan);
  }).catch(() => toast("No se pudo abrir el archivo."));
}
function hojaImportar(plan) {
  planImportar = plan;
  ocultarToast();
  const r = plan.resumen;
  const fecha = plan.exportado ? new Date(plan.exportado) : null;
  const cuando = fecha && !isNaN(fecha) ? `Copia del ${fechaCorta(HE.isoDate(fecha))} de ${fecha.getFullYear()} · ` : "";
  const items = [];
  if (r.nuevos) items.push(plural(r.nuevos, "hábito nuevo", "hábitos nuevos"));
  if (r.actualizados) items.push(`Días que faltaban en ${plural(r.actualizados, "hábito que ya tienes", "hábitos que ya tienes")}`);
  if (r.registros) items.push(`${plural(r.registros, "registro", "registros")} en total`);
  if (r.dias) items.push(`Ánimo y notas de ${plural(r.dias, "día", "días")}`);
  if (r.juego) items.push(`${plural(r.juego, "elemento", "elementos")} de misiones, jefes, recompensas, canjes y categorías`);
  abrirHoja(cabecera("", "Importar una copia", `${cuando}${plural(r.enArchivo, "hábito", "hábitos")} en el archivo`) + (plan.vacio
    ? `<p class="hb-texto">Ya tienes todo lo que trae esta copia. No hay nada que agregar.</p>
      <div class="hb-acciones"><button type="button" class="hb-btn" data-cerrar>Entendido</button></div>`
    : `<p class="hb-texto">Se agregará:</p>
      <ul class="hb-lista-texto">${items.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      <p class="hb-texto">No se borra ni se cambia nada de lo que ya tienes: si un día ya tiene registro, se queda el tuyo.</p>
      ${r.descartados ? `<p class="hb-texto">${plural(r.descartados, "hábito del archivo no se pudo leer y se omitirá", "hábitos del archivo no se pudieron leer y se omitirán")}.</p>` : ""}
      <div class="hb-acciones"><button type="button" class="hb-btn-sec" data-cerrar>Cancelar</button>
        <button type="button" class="hb-btn" data-confirmar-importar>Importar</button></div>`), { tipo: "importar" });
}
function aplicarImportacion() {
  const plan = planImportar;
  planImportar = null;
  if (!plan || plan.vacio) { cerrarHoja(); return; }
  silencioHasta = Date.now() + SILENCIO_IMPORTAR_MS;
  const ops = [];
  plan.nuevos.forEach(n => ops.push(b => b.set(coleccion().doc(n.id), n.doc)));
  plan.fusiones.forEach(f => {
    const datos = {};
    if (Object.keys(f.registros).length) datos.registros = f.registros;
    if (f.done.length) datos.done = FV().arrayUnion(...f.done);
    ops.push(b => b.set(coleccion().doc(f.id), datos, { merge: true }));
  });
  if (Object.keys(plan.juego).length) ops.push(b => b.set(metaJuego(), plan.juego, { merge: true }));
  if (Object.keys(plan.dias).length) ops.push(b => b.set(metaDias(), { dias: plan.dias }, { merge: true }));
  // Firestore acepta hasta 500 escrituras por lote.
  for (let i = 0; i < ops.length; i += 400) {
    const lote = db.batch();
    ops.slice(i, i + 400).forEach(op => op(lote));
    lote.commit().catch(errorGuardar);
  }
  cerrarHoja();
  const r = plan.resumen;
  toast(`Copia importada: ${plural(r.registros, "registro", "registros")}${r.nuevos ? ` y ${plural(r.nuevos, "hábito nuevo", "hábitos nuevos")}` : ""}.`);
}

// Categorías: cambios parciales { id: { campo: valor } } en meta/habitos_juego.
function guardarCategorias(cambios) {
  if (!Object.keys(cambios).length) return;
  const todas = Object.assign({}, juego.categorias);
  Object.keys(cambios).forEach(id => { todas[id] = Object.assign({}, todas[id], cambios[id]); });
  juego = Object.assign({}, juego, { categorias: todas });
  metaJuego().set({ categorias: cambios }, { merge: true }).catch(errorGuardar);
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

// ---------- Se marca solo con Running, Bici, Movilidad, Libros, Biblia y Finanzas ----------
// Cada módulo avisa con sus datos (sin lecturas nuevas: son las listas que
// ya escucha). La regla de qué toca cada día está en js/habitos-auto.js.
const fuentes = {}; // id → { datos, servidor, categorias }
let timerAuto = null;
function recibirFuente(id, datos, servidor, extra) {
  fuentes[id] = Object.assign({ datos, servidor: servidor !== false }, extra);
  clearTimeout(timerAuto);
  timerAuto = setTimeout(sincronizarAuto, 250);
}
window.addEventListener("manolo:actividades", e => { const d = e.detail || {}; if (d.coleccion === "running" || d.coleccion === "bicicleta") recibirFuente(d.coleccion, d.docs || [], d.servidor); });
window.addEventListener("manolo:fuente", e => { const d = e.detail || {}; if (d.fuente) recibirFuente(d.fuente, d.datos, d.servidor, d.categorias ? { categorias: d.categorias } : null); });
const origenDe = vinculo => (vinculo === "gasto" ? "finanzas" : vinculo);
function aggDe(h) {
  const src = fuentes[origenDe(h.vinculo)];
  return src ? HA.porDia(h.vinculo, src.datos, h.vinculoCfg || {}) : null;
}
function sincronizarAuto() {
  if (!cargado) return;
  const f = hoy(), ahora = Date.now();
  const nuevos = [], quitados = [];
  Object.keys(normal).forEach(id => {
    const h = normal[id];
    const def = h.vinculo && HA.fuente(h.vinculo);
    if (!def || def.soloEvento || h.archivado) return;
    const agg = aggDe(h);
    if (!agg) return;
    const p = HA.plan(h, agg, (docs[id] && docs[id].registros) || {}, { hoy: f, ahora, servidor: fuentes[origenDe(h.vinculo)].servidor });
    if (escribirAuto(h, p)) {
      Object.keys(p.poner).forEach(fe => { if (!(docs[id].registros || {})[fe] && fe >= HE.addDias(f, -1)) nuevos.push(`«${h.name}»`); });
      if (p.quitar.length) quitados.push(`«${h.name}»`);
    }
  });
  if (nuevos.length) toast(`Marcado solo: ${Array.from(new Set(nuevos)).join(", ")}.`);
  else if (quitados.length) toast(`Se quitó lo marcado solo en ${Array.from(new Set(quitados)).join(", ")}: ya no está en su módulo.`);
}
// Una escritura por hábito (atómica): los días que se ponen y los que se quitan.
function escribirAuto(h, p) {
  const fechas = Object.keys(p.poner);
  if (!fechas.length && !p.quitar.length) return false;
  const args = [];
  fechas.forEach(fe => args.push(FP("registros", fe), p.poner[fe]));
  p.quitar.forEach(fe => args.push(FP("registros", fe), FV().delete()));
  if (h.tipo === "sino") {
    const hechos = fechas.filter(fe => p.poner[fe].e === "hecho");
    if (hechos.length) args.push("done", FV().arrayUnion(...hechos));
    else if (p.quitar.length) args.push("done", FV().arrayRemove(...p.quitar));
  }
  coleccion().doc(h.id).update(...args).catch(errorGuardar);
  // Sí/No con días puestos y quitados a la vez: el "done" de los quitados va aparte.
  if (h.tipo === "sino" && fechas.some(fe => p.poner[fe].e === "hecho") && p.quitar.length) {
    coleccion().doc(h.id).update("done", FV().arrayRemove(...p.quitar)).catch(errorGuardar);
  }
  return true;
}
// Al vincular: ofrecer rellenar los días que ya tiene el módulo (sin XP).
let rellenarPendiente = null;
function ofrecerRellenar(id) {
  const h = normal[id];
  if (!h || !h.vinculo) return;
  const agg = aggDe(h);
  const dias = agg ? HA.rellenables(h, agg, (docs[id] && docs[id].registros) || {}, hoy(), 365) : [];
  if (!dias.length) return;
  const def = HA.fuente(h.vinculo);
  rellenarPendiente = { id, desde: dias[0], n: dias.length };
  abrirHoja(cabecera("Se marca solo", `¿Rellenar con tu historial de ${escapeHtml(def.nombre)}?`) + `
    <p class="hb-texto">Encontré <b>${plural(dias.length, "día", "días")}</b> desde el ${fechaCorta(dias[0])} en ${escapeHtml(def.nombre)}. Puedo marcarlos en <b>${escapeHtml(h.emoji)} ${escapeHtml(h.name)}</b>.</p>
    <ul class="hb-lista-texto">
      <li>No dan XP ni monedas (pasaron más de 48 horas).</li>
      <li>Sí cuentan para tu racha, tu rango y tus estadísticas. Los días sin actividad desde entonces cuentan como no hechos.</li>
      <li>Lo que ya marcaste a mano se queda como está.</li>
    </ul>
    <div class="hb-acciones"><button type="button" class="hb-btn-sec" data-cerrar>Ahora no</button>
      <button type="button" class="hb-btn" data-rellenar>Marcar ${plural(dias.length, "día", "días")}</button></div>`, { tipo: "rellenar", id });
}
function rellenar() {
  const r = rellenarPendiente;
  rellenarPendiente = null;
  cerrarHoja();
  const h = r && normal[r.id];
  if (!h) return;
  const agg = aggDe(h);
  const p = HA.plan(h, agg, (docs[r.id] && docs[r.id].registros) || {}, { hoy: hoy(), ahora: Date.now(), desde: r.desde, servidor: false });
  silencioHasta = Date.now() + SILENCIO_IMPORTAR_MS; // es historia: no se celebra
  escribirAuto(h, p);
  coleccion().doc(r.id).update({ vinculoDesde: r.desde }).catch(errorGuardar);
  toast(`Listo: ${plural(Object.keys(p.poner).length, "día marcado", "días marcados")} desde el ${fechaCorta(r.desde)}.`);
}

// Opciones del vínculo en el formulario: fuente, medida (Medible), rutina
// (Movilidad) o categoría de gasto (Evitar).
function vinculoValido(f) {
  if (!f.vinculo) return "";
  const def = HA.fuente(f.vinculo);
  if (!def) return "";
  if (f.tipo === "evitar") return def.evitar ? f.vinculo : "";
  return def.evitar ? "" : f.vinculo;
}
function medidaDefecto(v) {
  const def = HA.fuente(v);
  const m = def && def.medidas.find(x => x[0] !== "n");
  return m ? m[0] : "n";
}
function vinculoHtml(f) {
  const evitar = f.tipo === "evitar";
  const opciones = HA.FUENTES.filter(d => (evitar ? d.evitar : !d.evitar));
  const actual = vinculoValido(f);
  let html = chips("vinculo", [["", "No"]].concat(opciones.map(d => [d.id, escapeHtml(evitar ? "Gasto en una categoría" : d.nombre)])), actual);
  const def = actual && HA.fuente(actual);
  if (def) {
    html += `<p class="hb-texto">${escapeHtml(def.accion)}${evitar ? "" : f.tipo === "medible" ? ": suma lo del día." : f.tipo === "tiempo" ? ": suma los minutos del día." : ": lo marca como hecho."} Si borras la actividad, se desmarca (salvo que lo hayas cambiado a mano).</p>`;
    if (f.tipo === "medible") {
      const medidas = def.medidas.filter(m => m[0] !== "n").concat(def.medidas.filter(m => m[0] === "n").map(m => [m[0], m[1], `Cuántas ${m[1]}`]));
      html += `<span class="hb-label">Suma</span>${chips("vinculoMedida", medidas.map(m => [m[0], m[2]]), f.vinculoMedida || medidaDefecto(actual))}`;
    }
    if (def.rutina && window.MovilidadRutinas) {
      html += `<label class="hb-campo"><span>Rutina</span><select name="vinculoRutina"><option value="">Cualquier rutina</option>${MovilidadRutinas.map(r =>
        `<option value="${escapeHtml(r.id)}"${r.id === f.vinculoRutina ? " selected" : ""}>${escapeHtml(r.nombre)}</option>`).join("")}</select></label>`;
    }
    if (def.categoria) {
      const cats = (fuentes.finanzas && fuentes.finanzas.categorias) || [];
      html += `<label class="hb-campo"><span>Categoría de gasto</span><select name="vinculoCategoria"><option value="">Cualquier gasto</option>${cats.map(c =>
        `<option value="${escapeHtml(c.id)}"${c.id === f.vinculoCategoria ? " selected" : ""}>${escapeHtml(c.label)}</option>`).join("")}</select></label>`;
    }
  }
  return html;
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
// Días en palabras: "3 días", "~5 semanas", "~4 meses", "~1,5 años".
function enTiempo(d) {
  if (d == null || !isFinite(d)) return "";
  if (d <= 13) return plural(Math.max(1, Math.round(d)), "día", "días");
  if (d <= 60) return `~${Math.round(d / 7)} semanas`;
  if (d <= 540) return `~${Math.round(d / 30)} meses`;
  const a = Math.round(d / 182.5) / 2;
  return `~${String(a).replace(".", ",")} ${a === 1 ? "año" : "años"}`;
}
// Por qué está donde está: techo con tu constancia, cuánto pide el próximo
// rango y cuántos días cumpliendo faltan para la próxima división.
function porQueRango(rh) {
  const r = rh.rango, x = HE.explicarRango(rh, res.hoy);
  const semanal = rh.habito.freqType === "semana";
  const partes = [];
  if (x.constancia != null && x.techo != null) {
    const techo = nivelHab(x.techo).rango.nombre;
    let t = `Con tu ${pctTexto(x.constancia)} de ${semanal ? "las últimas 13 semanas" : "los últimos 90 días"}, tu techo es <b>${escapeHtml(techo)}</b>`;
    if (x.proximoRango) t += `; para ${escapeHtml(x.proximoRango.nombre)} necesitas ~${Math.ceil(x.proximoRango.constancia * 100)} %`;
    partes.push(t + ".");
  }
  if (r.tieneRango && r.siguiente && x.diasSiguiente) {
    const sig = r.siguiente;
    partes.push(r.faltaHistoria || sig.idx === HE.NIVELES.length - 1
      ? `${escapeHtml(sig.nombre)} pide ~1,5 años de constancia: cumpliendo todo, te faltan ${enTiempo(x.diasSiguiente)}.`
      : `Cumpliendo todo lo que toca, llegas a ${escapeHtml(sig.nombre)} en ${enTiempo(x.diasSiguiente)}.`);
  }
  partes.push(`Un fallo suelto no te baja; ${HC.FUERZA.FALLOS_BAJAN} seguidos sí.`);
  return `<p class="hb-rango-porque">${partes.join(" ")}</p>`;
}
function rangoHtml(rh) {
  const r = rh.rango;
  if (!r.tieneRango) {
    return `<div class="hb-rango">${RangosInsignias.svg(null, { tam: 56 })}<div class="hb-rango-txt"><b>Sin rango todavía</b>
      <span>Cumple este hábito los días que toca y pronto tendrás tu primer rango.</span></div></div>`;
  }
  const n = nivelHab(r.nivel), sig = r.siguiente;
  const tendencia = r.tendencia == null ? "" : r.tendencia > 0.5 ? " · subiendo" : r.tendencia < -0.5 ? " · bajando" : " · estable";
  return `<div class="hb-rango">
    ${RangosInsignias.svg(n, { tam: 64 })}
    <div class="hb-rango-txt">
      <b>${escapeHtml(n.nombre)}</b>
      <span>Fuerza ${Math.round(r.fuerza)} de 100${tendencia}</span>
      <div class="hb-xp hb-rango-barra" role="progressbar" aria-label="Avance hacia la siguiente división" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.avance * 100)}"><span style="width:${(r.avance * 100).toFixed(1)}%"></span></div>
      <span class="hb-rango-sig">${!sig ? "Estás en la cima." : `Siguiente: ${escapeHtml(sig.nombre)}`}</span>
      ${r.escudo > 0 ? `<span class="hb-rango-escudo">Protegido: ${plural(r.escudo, "día más", "días más")} sin bajar de división.</span>` : ""}
    </div>
  </div>
  ${porQueRango(rh)}`;
}

// ---------- Pestaña Logros: misiones, logros, tienda y áreas ----------
const panelLogros = document.getElementById("panel-hab-logros");
let logrosTab = "misiones";

function renderLogros() {
  if (!cargado || !res || !panelLogros || panelLogros.hidden) return;
  const el = document.getElementById("hb-logros");
  const n = res.nivel;
  const hechos = logrosConGanados().filter(l => l.desbloqueado).length;
  const xn = HE.explicarNivel(res);
  const tabs = [["misiones", "Misiones"], ["logros", "Logros"], ["tienda", "Tienda"], ["areas", "Categorías"]];
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
      <p class="hb-nivel-ritmo">Te faltan <b>${fmtNum(xn.falta)} XP</b> para el nivel ${xn.siguiente}${xn.dias ? `: a tu ritmo (~${fmtNum(xn.ritmo)} XP por día), ${enTiempo(xn.dias)}` : ""}.</p>
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
  return `${jefeHtml()}
    <h3 class="hb-sub-t">Misiones de la semana</h3>
    <p class="hb-texto">Se renuevan cada lunes con tus propios datos, un poco por encima de tu promedio. ${quedan ? `Te ${quedan === 1 ? "queda 1 día" : `quedan ${quedan} días`}.` : "Hoy es el último día."}</p>
    <ul class="hb-misiones">${filas}</ul>
    ${previas.length ? `<h3 class="hb-sub-t">Semanas anteriores</h3><ul class="hb-pausas">${previas.map(k =>
      `<li><span>Semana del ${fechaCorta(anteriores[k].lunes)}</span><span>${anteriores[k].hechas} de ${anteriores[k].total}</span></li>`).join("")}</ul>` : ""}`;
}

function jefeHtml() {
  const j = jefeActual();
  const J = HC.JEFE;
  const sem = HE.semanaId(HE.lunesDe(res.hoy));
  const previos = (res.jefes || []).filter(x => x.semana < sem).reverse();
  const historial = previos.length ? `<details class="hb-jefe-hist"><summary>Jefes anteriores · derrotaste ${previos.filter(x => x.estado === "derrotado").length} de ${previos.length}</summary>
    <ul class="hb-pausas">${previos.slice(0, 8).map(x => `<li><span>${escapeHtml(x.emoji)} ${escapeHtml(x.nombre)} · semana del ${fechaCorta(x.lunes)}</span>
      <span>${x.estado === "derrotado" ? `Cayó el ${NOMBRES_DIA[HE.diaSemana(x.derrotadoEn)]}` : "Se escapó"}</span></li>`).join("")}</ul></details>` : "";
  if (!j) {
    return `<section class="hb-jefe" aria-label="Jefe de la semana"><p class="hb-texto">Cuando tengas un hábito activo, cada lunes aparecerá un rival para derrotar con tus hábitos.</p>${historial}</section>`;
  }
  const caido = j.estado === "derrotado";
  const hoyIdx = HE.diaSemana(res.hoy);
  const max = Math.max(1, ...j.porDia);
  const quedan = 6 - hoyIdx;
  const estado = caido ? `Cayó el ${NOMBRES_DIA[HE.diaSemana(j.derrotadoEn)]}. Ganaste +${j.xp} XP y +${j.monedas} monedas.`
    : `Le quedan ${fmtNum(j.vidaRestante)} de ${fmtNum(j.vida)} de vida. ${quedan ? `Tienes ${quedan === 1 ? "1 día más" : `${quedan} días más`}.` : "Hoy es tu última oportunidad."}`;
  return `<section class="hb-jefe${caido ? " is-caido" : ""}" aria-label="Jefe de la semana">
    <div class="hb-jefe-top">
      <span class="hb-jefe-emoji" aria-hidden="true">${escapeHtml(j.emoji)}</span>
      <div><span class="hb-jefe-eyebrow">Jefe de la semana</span><h3 class="hb-jefe-t">${escapeHtml(j.nombre)}</h3></div>
      ${caido ? `<span class="hb-tag">Derrotado</span>` : ""}
    </div>
    <div class="hb-vida hb-vida-grande" role="progressbar" aria-label="Vida de ${escapeHtml(j.nombre)}" aria-valuemin="0" aria-valuemax="${j.vida}" aria-valuenow="${j.vidaRestante}"><span style="width:${vidaPct(j).toFixed(1)}%"></span></div>
    <p class="hb-jefe-estado">${estado}</p>
    <ol class="hb-jefe-dias" aria-label="Daño por día">${j.porDia.map((v, i) => `<li class="${i === hoyIdx ? "is-hoy" : ""}${i > hoyIdx ? " is-futuro" : ""}" aria-label="${NOMBRES_DIA[i]}: ${v} de daño">
      <span class="hb-jefe-v" aria-hidden="true">${i > hoyIdx ? "" : v}</span>
      <span class="hb-jefe-col" aria-hidden="true"><span style="height:${((v / max) * 100).toFixed(0)}%"></span></span>
      <span class="hb-jefe-d" aria-hidden="true">${DIAS_CORTOS[i]}</span></li>`).join("")}</ol>
    <p class="hb-card-sub">Cada hábito que cumples le quita su XP base: fácil ${HC.DIFICULTADES.facil.xp}, media ${HC.DIFICULTADES.media.xp}, difícil ${HC.DIFICULTADES.dificil.xp}. Si cae antes de que termine el domingo, ganas +${J.XP} XP y +${J.MONEDAS} monedas.</p>
    ${historial}
  </section>`;
}

// Los logros ya ganados se quedan aunque hoy no se cumplan (p. ej. tras la
// Temporada 2): el snapshot guarda todos los que se celebraron.
function logrosConGanados() {
  const ganados = new Set(((juego.snapshot && juego.snapshot.logros) || []).concat((juego.temporada1 && juego.temporada1.logros) || []));
  return res.logros.map(l => (!l.desbloqueado && ganados.has(l.id) ? Object.assign({}, l, { desbloqueado: true, actual: l.metaProgreso, progreso: 1 }) : l));
}
function temporada1Html() {
  const t = juego.temporada1;
  if (!t || !t.nivel) return "";
  const mejores = Object.keys(t.rangos || {}).filter(id => normal[id]).sort((a, b) => t.rangos[b] - t.rangos[a]).slice(0, 3);
  return `<section class="hb-temporada" aria-label="Temporada 1">
    <div class="hb-temporada-top"><span class="hb-jefe-eyebrow">Temporada 1${t.hasta ? ` · hasta el ${fechaCorta(t.hasta)}` : ""}</span>
      <b>Nivel ${t.nivel} · ${escapeHtml(HE.titulo(t.nivel))}</b></div>
    ${mejores.length ? `<ul class="hb-temporada-rangos">${mejores.map(id => `<li>${RangosInsignias.svg(nivelHab(t.rangos[id]), { tam: 26 })}<span>${escapeHtml(normal[id].emoji)} ${escapeHtml(normal[id].name)}</span><small>${escapeHtml(nivelHab(t.rangos[id]).nombre)}</small></li>`).join("")}</ul>` : ""}
    <p class="hb-card-sub">Tus marcas con las reglas de antes. Desde la Temporada 2 subir cuesta más; los logros que ganaste se quedan.</p>
  </section>`;
}
function logrosHtml() {
  const lista = logrosConGanados().sort((a, b) => b.desbloqueado - a.desbloqueado || b.progreso - a.progreso);
  return `${temporada1Html()}<ul class="hb-logros">${lista.map(l => {
    const oculto = l.secreto && !l.desbloqueado;
    return `<li class="hb-logro${l.desbloqueado ? " is-on" : ""}">
      <span class="hb-logro-ico" aria-hidden="true"><span data-icon="${oculto ? "star" : "trophy"}"></span></span>
      <span class="hb-logro-txt"><b>${oculto ? "Logro secreto" : escapeHtml(l.nombre)}</b>
        <span>${oculto ? "Sigue usando la app para descubrirlo." : escapeHtml(l.desc)}</span>
        ${l.desbloqueado ? `<span class="hb-tag">Conseguido</span>` : oculto ? "" : `${barra(l.progreso, l.nombre)}<span class="hb-logro-prog">${l.tipo === "rango" ? `Tu mejor: ${escapeHtml(mejorRangoNombre())}` : l.tipo === "scalping" ? `${ScalpingHabit.formatHoras(l.actual)} de ${ScalpingHabit.formatHoras(l.metaProgreso)}` : `${fmtNum(l.actual)} de ${fmtNum(l.metaProgreso)}`}</span>`}
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
      <p class="hb-texto">Tus rachas ya perdonan 1 o 2 fallos si vienes cumpliendo. Si fallas un día y no te quedan perdones, se usa un comodín y tus rachas siguen. Puedes guardar hasta ${HC.CONST.COMODINES_MAX}.
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
  return `<p class="hb-texto">Cada hábito suma XP a su categoría. Toca una para ver su página; cámbialas en Ajustes.</p>
    <ul class="hb-areas">${res.areas.filter(a => !a.archivada || a.xp > 0).map(a => `<li class="hb-area hb-area-link" style="--cat:${HCat.colorDe(a)}"><a class="hb-area-a" href="#hab-categoria/${a.id}" aria-label="Ver ${escapeHtml(a.nombre)}"></a>
      <div class="hb-area-top"><b><span aria-hidden="true">${escapeHtml(a.emoji || "")}</span> ${escapeHtml(a.nombre)}${a.archivada ? ` <span class="hb-opcional">(archivada)</span>` : ""}</b><span><span class="hb-num">${a.nivel.nivel}</span> nivel</span></div>
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
let silencioHasta = 0; // tras importar una copia, no se celebra lo que trae
const SILENCIO_IMPORTAR_MS = 5000;
function anotarToque() {
  ultimoToque = Date.now();
  clearTimeout(timerCelebrar);
  timerCelebrar = setTimeout(revisarCelebraciones, ESPERA_CELEBRAR_MS + 50);
}
function canon(snap) {
  const r = {};
  Object.keys(snap.rangos || {}).sort().forEach(k => { r[k] = snap.rangos[k]; });
  return JSON.stringify([snap.nivel, r, (snap.logros || []).slice().sort(), (snap.misiones || []).slice().sort(), (snap.perfectos || []).slice().sort(), snap.jefes ? snap.jefes.slice().sort() : null]);
}
function guardarSnapshot(snap) {
  juego = Object.assign({}, juego, { snapshot: snap });
  const ref = metaJuego();
  (juegoExiste ? ref.update({ snapshot: snap }) : ref.set({ snapshot: snap }, { merge: true })).catch(errorGuardar);
}
// ---------- Temporada 2: la dificultad nueva (D-080) ----------
// La primera vez con la calibración nueva todo se recalcula desde el
// historial: el snapshot se actualiza en silencio (sin celebrar ni avisar de
// bajadas), los logros ganados se conservan y el nivel y los mejores rangos de
// antes quedan como "Temporada 1".
function nuevaTemporada() {
  const anterior = juego.snapshot;
  // Si los hábitos todavía no llegaron, se espera (no se compara contra nada).
  if (anterior && Object.keys(anterior.rangos || {}).length && !Object.keys(normal).length) return;
  const nuevo = HE.snapshot(res);
  const union = (a, b) => Array.from(new Set((a || []).concat(b || []))).sort();
  const snap = Object.assign({}, nuevo, {
    logros: union(anterior && anterior.logros, nuevo.logros),
    misiones: union(anterior && anterior.misiones, nuevo.misiones),
    perfectos: union(anterior && anterior.perfectos, nuevo.perfectos),
    jefes: union(anterior && anterior.jefes, nuevo.jefes)
  });
  const campos = { calibracion: HC.CALIBRACION, recalculo: HC.RECALCULO, snapshot: snap };
  const habia = !!anterior && ((anterior.nivel || 1) > 1 || Object.keys(anterior.rangos || {}).length > 0);
  if (habia) campos.temporada1 = { nivel: anterior.nivel || 1, rangos: anterior.rangos || {}, logros: anterior.logros || [], hasta: res.hoy, nivelNuevo: res.nivel.nivel, visto: false };
  juego = Object.assign({}, juego, campos);
  const ref = metaJuego();
  (juegoExiste ? ref.update(campos) : ref.set(campos, { merge: true })).catch(errorGuardar);
}
// Reglas nuevas (p. ej. la racha que perdona) pueden alargar rachas y
// desbloquear logros del pasado: se guardan en el snapshot sin celebrar.
function recalculoSilencioso() {
  if (juego.snapshot && Object.keys(juego.snapshot.rangos || {}).length && !Object.keys(normal).length) return;
  const snap = juego.snapshot ? HE.fusionarSnapshot(juego.snapshot, HE.snapshot(res), res.hoy) : HE.snapshot(res);
  const campos = { recalculo: HC.RECALCULO, snapshot: snap };
  juego = Object.assign({}, juego, campos);
  const ref = metaJuego();
  (juegoExiste ? ref.update(campos) : ref.set(campos, { merge: true })).catch(errorGuardar);
}
let temporadaMostrada = false;
function hojaTemporada() {
  const t = juego.temporada1;
  temporadaMostrada = true;
  const ahora = res.nivel;
  const filas = Object.keys(t.rangos || {}).filter(id => normal[id] && !normal[id].archivado)
    .sort((a, b) => t.rangos[b] - t.rangos[a]).slice(0, 6).map(id => {
      const r = res.habitos[id] && res.habitos[id].rango;
      const nuevo = r && r.tieneRango ? nivelHab(r.nivel).nombre : "Sin rango";
      return `<li><span>${escapeHtml(normal[id].emoji)} ${escapeHtml(normal[id].name)}</span><span class="hb-temp-cambio">${escapeHtml(nivelHab(t.rangos[id]).nombre)} → <b>${escapeHtml(nuevo)}</b></span></li>`;
    }).join("");
  abrirHoja(cabecera("Hábitos", "Temporada 2: ahora subir cuesta más") + `
    <div class="hb-temp-nivel">
      <div class="hb-stat"><span class="hb-num">${t.nivel}</span><span>Antes · ${escapeHtml(HE.titulo(t.nivel))}</span></div>
      <span class="hb-temp-flecha" aria-hidden="true">→</span>
      <div class="hb-stat"><span class="hb-num">${ahora.nivel}</span><span>Ahora · ${escapeHtml(ahora.titulo)}</span></div>
    </div>
    ${filas ? `<h4 class="hb-sub-t">Tus rangos</h4><ul class="hb-pausas hb-temp-rangos">${filas}</ul>` : ""}
    <ul class="hb-lista-texto">
      <li>Un hábito diario perfecto llega a Bronce al mes, a Oro a los 3 meses y a Diamante al año. El máximo pide ~1,5 años.</li>
      <li>Fallar pesa unas 4 veces más que cumplir: un fallo suelto no te baja, ${HC.FUERZA.FALLOS_BAJAN} seguidos sí.</li>
      <li>Tu historial, rachas, monedas y logros ganados se quedan igual. Tu Temporada 1 queda guardada en Logros.</li>
      <li>En el detalle de cada hábito verás tu techo y cuánto te falta para subir.</li>
    </ul>
    <div class="hb-acciones"><button type="button" class="hb-btn" data-temporada-visto>Entendido</button></div>`, { tipo: "temporada" });
}
function temporadaVista() {
  if (!juego.temporada1) return;
  juego = Object.assign({}, juego, { temporada1: Object.assign({}, juego.temporada1, { visto: true }) });
  metaJuego().update(FP("temporada1", "visto"), true).catch(errorGuardar);
}

function revisarCelebraciones() {
  if (!juegoCargado || !cargado || !res || celebrando || deshacerPendiente || wrapped) return;
  if ((juego.calibracion || 1) < HC.CALIBRACION) { nuevaTemporada(); return; }
  if ((juego.recalculo || 0) < HC.RECALCULO) { recalculoSilencioso(); return; }
  if (juego.temporada1 && !juego.temporada1.visto && !temporadaMostrada) {
    const visibleT = !document.hidden && [panelHoy, panelStats, panelLogros].some(p => p && !p.hidden);
    if (visibleT && !(hoja && !hoja.hidden)) hojaTemporada();
    return;
  }
  if (hojaActual && hojaActual.tipo === "temporada") return;
  const anterior = juego.snapshot;
  if (!anterior) { guardarSnapshot(HE.snapshot(res)); return; }
  const snap = HE.fusionarSnapshot(anterior, HE.snapshot(res), res.hoy);
  // Lo que llega de una copia importada es historia, no un logro nuevo.
  if (Date.now() < silencioHasta) {
    if (canon(anterior) !== canon(snap)) guardarSnapshot(snap);
    clearTimeout(timerCelebrar);
    timerCelebrar = setTimeout(revisarCelebraciones, silencioHasta - Date.now() + 50);
    return;
  }
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
  if (u.tipo === "jefe") {
    const j = (res.jefes || []).find(x => x.semana === u.semana);
    return fila(`<span class="hb-cel-jefe" aria-hidden="true">${j ? escapeHtml(j.emoji) : ""}</span>`, "Jefe derrotado", escapeHtml(j ? j.nombre : "El jefe de la semana"),
      j ? `+${j.xp} XP · +${j.monedas} monedas` : "");
  }
  if (u.tipo === "mision") {
    const m = res.misiones.find(x => x.id === u.id);
    return fila(icono("check"), "Misión cumplida", escapeHtml(m ? m.titulo : ""), m ? `+${m.xp} XP · +${m.monedas} monedas` : "");
  }
  return fila(icono("star"), "Día perfecto", u.fecha === res.hoy ? "Cumpliste todo lo de hoy" : `El ${fechaCorta(u.fecha)}`, `+${HC.XP.DIA_PERFECTO} XP`);
}

function mostrarCelebracion(ups, snap) {
  celebrando = true;
  const orden = { nivel: 0, jefe: 1, perfecto: 2, rango: 3, mision: 4, logro: 5 };
  ups.sort((a, b) => orden[a.tipo] - orden[b.tipo] || (b.despues || 0) - (a.despues || 0));
  const titulo = { nivel: "¡Subiste de nivel!", jefe: "¡Jefe derrotado!", perfecto: "¡Día perfecto!", rango: "Nuevo rango", mision: "Misión cumplida", logro: "Logro desbloqueado" }[ups[0].tipo];
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
// Pantallas de otros archivos (js/habitos-categorias-ui.js…) atienden sus
// propios botones dentro de la hoja: si una devuelve true, ya está.
const plugins = { click: [], cambio: [], submit: [], input: [] };
function onClickHoja(e) {
  const t = e.target;
  if (t.closest("[data-temporada-visto]")) { cerrarHoja(); return; }
  if (t.closest("[data-rellenar]")) { rellenar(); return; }
  if (t.closest("[data-cerrar]")) { cerrarHoja(); return; }
  if (plugins.click.some(fn => fn(e, t))) return;
  const q = sel => t.closest(sel);
  const fechaDe = el => el.dataset.fecha || res.hoy;
  let b;
  if ((b = q("[data-sc-sesion]"))) { alternarScalping(b.dataset.scSesion); return; }
  if (q("[data-sc-crear]")) { cerrarHoja(); crearScalping(); return; }
  if (q("[data-sc-abrir]")) { cerrarHoja(); HabitoScalping.abrir(); return; }
  if ((b = q("[data-marcar]"))) { marcar(b.dataset.marcar); return; }
  if ((b = q("[data-detalle]"))) { hojaDetalle(b.dataset.detalle); return; }
  if ((b = q("[data-detalle-dia]"))) { hojaActual = null; hojaDetalle(b.dataset.detalleDia, b.dataset.fecha); return; }
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
  if ((b = q("[data-dia-cal]"))) { mesSel = b.dataset.diaCal.slice(0, 7); hojaDetalle(hojaActual.id, b.dataset.diaCal); return; }
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
  if (q("[data-exportar]")) { exportar(); return; }
  if (q("[data-importar]")) { const inp = hoja.querySelector("[data-archivo-importar]"); if (inp) { inp.value = ""; inp.click(); } return; }
  if (q("[data-confirmar-importar]")) { aplicarImportacion(); return; }
  if ((b = q("[data-sonidos]"))) { guardarPref({ sonidos: b.dataset.sonidos === "1" }); if (b.dataset.sonidos === "1") sonar("moneda"); hojaAjustes(); return; }
  if ((b = q("[data-animo]"))) { guardarDiaMeta({ animo: Number(b.dataset.animo) }); hojaCierre(); return; }
  // Formulario: botones que cambian un campo y redibujan.
  if (q("[data-mas-opciones]")) { leerCampos(); form._mas = !form._mas; hojaForm(); return; }
  if ((b = q("[data-emoji-grupo]"))) {
    leerCampos();
    emojiGrupo = b.dataset.emojiGrupo;
    hojaForm();
    return;
  }
  if ((b = q("[data-campo]"))) {
    leerCampos();
    form[b.dataset.campo] = b.dataset.v;
    if (b.dataset.campo === "emoji") form.emojiPropio = "";
    if (b.dataset.campo === "area") form.areaElegida = true;
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
  if (plugins.cambio.some(fn => fn(e, t))) return;
  // Elegir una hora acomoda el momento del día (se puede cambiar después).
  if (t.name === "hora" && t.closest(".hb-form") && form) {
    leerCampos();
    const hh = Number(String(form.hora || "").slice(0, 2));
    if (HH.hora(form.hora)) form.timeOfDay = hh >= 5 && hh < 12 ? "manana" : hh >= 12 && hh < 19 ? "tarde" : "noche";
    hojaForm();
    return;
  }
  if (t.hasAttribute("data-archivo-importar")) { leerCopia(t.files && t.files[0]); return; }
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
    const r = HCat.editar(areasDef(), t.dataset.areaNombre, { nombre: t.value });
    if (!r.ok) { toast(r.error); t.value = (areasDef().find(c => c.id === t.dataset.areaNombre) || {}).nombre || ""; return; }
    guardarCategorias({ [t.dataset.areaNombre]: r.cambios });
    actualizar();
  }
}

function onSubmitHoja(e) {
  e.preventDefault();
  if (plugins.submit.some(fn => fn(e, e.target))) return;
  if (e.target.classList.contains("hb-form")) guardarForm();
}

// ---------- Scalping (js/habito-scalping.js) ----------
function alternarScalping(sesion) {
  sonar("toque");
  pendienteXP = { id: HabitoScalping.ID, xp: res.xp };
  HabitoScalping.alternar(sesion);
}
function crearScalping() {
  if (!window.HabitoScalping || docs[HabitoScalping.ID]) return;
  const orden = Object.keys(normal).reduce((m, id) => Math.max(m, normal[id].orden || 0), 0) + 1;
  HabitoScalping.crear(orden).catch(errorGuardar);
  toast("Agregaste «Scalping». Hoy es tu día 1: tócalo para ver qué te toca.");
}
document.addEventListener("scalping:crear", crearScalping);

document.getElementById("hb-lista").addEventListener("click", e => {
  if (sinClick) { sinClick = false; e.preventDefault(); e.stopPropagation(); return; }
  if (onBarraHoy(e.target)) return;
  const sc = e.target.closest("[data-sc-sesion]");
  if (sc) { alternarScalping(sc.dataset.scSesion); return; }
  if (e.target.closest("[data-sc-crear]")) { crearScalping(); return; }
  if (e.target.closest("[data-sc-descartar]")) { HabitoScalping.descartarSugerencia(); renderHoy(); return; }
  const m = e.target.closest("[data-marcar]");
  if (m) { marcar(m.dataset.marcar); return; }
  const d = e.target.closest("[data-detalle]");
  if (d) { hojaDetalle(d.dataset.detalle); return; }
  if (e.target.closest("[data-nuevo]")) { hojaForm(null); return; }
  if (e.target.closest("[data-cerrar-dia]")) { hojaCierre(); return; }
  if (e.target.closest("[data-resumen-visto]")) {
    try { localStorage.setItem("hb-resumen-visto", HE.semanaId(HE.addDias(HE.lunesDe(res.hoy), -7))); } catch (err) { /* sin almacenamiento */ }
    renderHoy();
    return;
  }
  if (e.target.closest("[data-ordenar]")) { hojaOrdenar(); return; }
  if (e.target.closest("[data-ir-jefe]")) { logrosTab = "misiones"; return; }
  if (e.target.closest("[data-ajustes]")) hojaAjustes();
});
document.getElementById("hb-nuevo").addEventListener("click", () => hojaForm(null));

// ---------- Detalle: gráficos, distribución y notas ----------
function graficosDetalle(h, rh) {
  const f = res.hoy;
  let html = "";
  // Fuerza en el tiempo (últimos 6 meses o desde el inicio)
  const serie = rh.rango.serie;
  if (serie.length >= 2) {
    const desde = serie[0].fecha > HE.addDias(f, -180) ? serie[0].fecha : HE.addDias(f, -180);
    const tramo = serie.filter(x => x.fecha >= desde);
    const total = Math.max(1, HE.diasEntre(desde, f));
    // Como mucho ~60 puntos: el último de cada tramo
    const paso = Math.max(1, Math.ceil(tramo.length / 60));
    const pts = tramo.filter((x, i) => i % paso === 0 || i === tramo.length - 1).map(x => ({
      x: HE.diasEntre(desde, x.fecha) / total, y: x.fuerza,
      tip: `${fechaCorta(x.fecha)}: fuerza ${Math.round(x.fuerza)} · ${HE.NIVELES[x.nivel].nombre}`
    }));
    const r = rh.rango;
    const guias = [];
    if (r.tieneRango && r.siguiente) guias.push({ y: fuerzaPara(r.siguiente.min), texto: r.siguiente.nombre });
    html += `<h4 class="hb-sub-t">Fuerza en el tiempo</h4><div class="hb-chart">${HG.linea(pts, { guias, inicio: fechaCorta(desde), titulo: "Fuerza del hábito" })}</div>`;
  }
  // Valores contra la meta (medibles y tiempo): últimos 30 días
  if (h.tipo === "medible" || h.tipo === "tiempo") {
    const items = [];
    let max = h.meta;
    for (let i = 29; i >= 0; i--) {
      const d = HE.addDias(f, -i), dd = rh.dias[d];
      const v = dd && dd.valor != null ? dd.valor : dd && (dd.estado === "hecho") ? h.meta : dd && dd.clase !== "fuera" ? 0 : null;
      if (v != null) max = Math.max(max, v);
      items.push({ valor: v, marcar: v != null && v < h.meta * HC.CONST.PARCIAL_MANTIENE_RACHA, tip: `${fechaCorta(d)}: ${v == null ? "sin datos" : `${fmtNum(v)} de ${fmtNum(h.meta)} ${h.unidad}`}`, etiqueta: i === 29 ? fechaCorta(d) : i === 0 ? "Hoy" : "" });
    }
    const tope = Math.ceil(max * 1.1);
    html += `<h4 class="hb-sub-t">Valores contra la meta</h4><div class="hb-chart">${HG.columnas(items, { max: tope, meta: h.meta, ejeY: [0, h.meta], fmt: v => fmtNum(v), titulo: "Valores de los últimos 30 días" })}</div>`;
  }
  // ¿Qué día de la semana lo cumples menos?
  if (h.freqType !== "semana" && h.tipo !== "evitar") {
    const b = HE.porDiaSemana(res, h.inicio || f, f, x => x.habito.id === h.id);
    if (b.filter(x => x.esperados).length >= 2) {
      const items = b.map((x, i) => ({ etiqueta: DIAS_CORTOS[i], valor: x.pct, tip: `${DIAS_LARGOS[i].replace(/^./, c => c.toUpperCase())}: ${x.pct == null ? "no toca" : `${pctTexto(x.pct)} (${x.hechos} de ${x.esperados})`}` }));
      html += `<h4 class="hb-sub-t">Por día de la semana</h4><div class="hb-chart">${HG.columnas(items, { alto: 120, titulo: "Cumplimiento por día de la semana" })}</div>`;
    }
  }
  return html;
}
// Fuerza necesaria para un percentil (inversa de la curva), para dibujar la guía.
const fuerzaPara = P => HE.fuerzaPara(P);
function notasHtml(h) {
  const regs = (docs[h.id] && docs[h.id].registros) || {};
  const notas = Object.keys(regs).filter(f => regs[f] && regs[f].n).sort().reverse().slice(0, 10);
  if (!notas.length) return "";
  return `<h4 class="hb-sub-t">Tus notas</h4><ul class="hb-notas">${notas.map(f =>
    `<li><button type="button" class="hb-nota" data-dia-cal="${f}"><span>${fechaCorta(f)}</span>${escapeHtml(regs[f].n)}</button></li>`).join("")}</ul>`;
}

// ---------- Tarjeta de Hábitos en Inicio ----------
function renderInicio() {
  const el = document.getElementById("hb-inicio");
  if (!el || !res) return;
  const p = progresoHoy(res.hoy);
  const racha = mejorRachaActiva();
  const faltan = pendientesAhora();
  el.innerHTML = `${p.total ? `Hoy: ${p.hechos} de ${p.total}` : "Nada pendiente hoy"}${faltan ? ` · ⏰ ${faltan === 1 ? "falta" : "faltan"} ${faltan} ${MOMENTO_DE[momentoActual()]}` : ""} · Nivel ${res.nivel.nivel}${racha ? ` · ${escapeHtml(textoRacha(racha))} de racha` : ""}
    <span class="hb-inicio-barra" aria-hidden="true"><span style="width:${p.total ? (p.hechos / p.total * 100).toFixed(1) : 0}%"></span></span>`;
}

// ---------- Estadísticas ----------
const HG = HabitosGraficos;
const PERIODOS_UI = [["7d", "7 d"], ["30d", "30 d"], ["90d", "90 d"], ["anio", "Año"], ["todo", "Todo"]];
const NOMBRE_PERIODO = { "7d": "los 7 días anteriores", "30d": "los 30 días anteriores", "90d": "los 90 días anteriores", anio: "el año anterior" };
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
let periodoStats = "30d";
let periodoPrevio = null; // para animar lo que cambió al cambiar de periodo
const pctTexto = v => (v == null ? "—" : `${Math.round(v * 100)} %`);

function tarjeta(titulo, cuerpo, sub) {
  return `<section class="hb-card"><h2 class="hb-card-t">${titulo}</h2>${sub ? `<p class="hb-card-sub">${sub}</p>` : ""}${cuerpo}</section>`;
}
function delta(actual, previo, unidad, invertir) {
  if (actual == null || previo == null) return "";
  const d = actual - previo;
  const txt = unidad === "pts" ? `${Math.abs(Math.round(d * 100))} puntos` : fmtNum(Math.abs(d));
  if (Math.round(unidad === "pts" ? d * 100 : d) === 0) return `<span class="hb-delta">= igual</span>`;
  const sube = d > 0;
  return `<span class="hb-delta ${sube !== !!invertir ? "is-bien" : "is-mal"}"><span aria-hidden="true">${sube ? "▲" : "▼"}</span> <span class="hb-sr">${sube ? "subió" : "bajó"}</span>${txt}</span>`;
}

function kpisHtml(k, per) {
  const a = k.actual, p = k.previo;
  const vs = per.previo ? `contra ${NOMBRE_PERIODO[per.clave]}` : "";
  const racha = k.mejorRacha && k.mejorRacha.racha ? `${k.mejorRacha.racha} ${k.mejorRacha.racha === 1 ? "día" : "días"}` : "—";
  const rachaDe = k.mejorRacha && k.mejorRacha.racha && normal[k.mejorRacha.id] ? escapeHtml(normal[k.mejorRacha.id].name) : "Sin racha activa";
  return `<section class="hb-kpis" aria-label="Resumen del periodo">
    <div class="hb-kpi-hero">
      <span class="hb-kpi-label">Cumplimiento</span>
      <span class="hb-num hb-kpi-grande" data-contar="${a.pct == null ? "" : Math.round(a.pct * 100)}">${pctTexto(a.pct)}</span>
      <span class="hb-kpi-pie">${p ? `${delta(a.pct, p.pct, "pts")} ${vs}` : `${fmtNum(a.hechos)} de ${fmtNum(a.esperados)} veces`}</span>
    </div>
    <div class="hb-kpi"><span class="hb-kpi-label">Días perfectos</span><span class="hb-num">${a.perfectos}</span>${p ? delta(a.perfectos, p.perfectos) : ""}</div>
    <div class="hb-kpi"><span class="hb-kpi-label">XP ganado</span><span class="hb-num">${fmtNum(a.xp)}</span>${p ? delta(a.xp, p.xp) : ""}</div>
    <div class="hb-kpi"><span class="hb-kpi-label">Mejor racha activa</span><span class="hb-num">${racha}</span><span class="hb-kpi-pie">${rachaDe}</span></div>
    <div class="hb-kpi"><span class="hb-kpi-label">Hábitos activos</span><span class="hb-num">${k.activos}</span></div>
  </section>`;
}

function heatmapHtml() {
  const f = res.hoy;
  const inicio = HE.addDias(HE.lunesDe(f), -52 * 7);
  const dias = [], meses = [];
  let mesPrevio = null;
  for (let i = 0, d = inicio; d <= f; i++, d = HE.addDias(d, 1)) {
    if (i % 7 === 0) {
      const m = Number(d.slice(5, 7));
      if (m !== mesPrevio) { meses.push({ col: i / 7, texto: MESES[m - 1] }); mesPrevio = m; }
    }
    const r = HE.resumenDia(res, d);
    const ratio = r.esperados ? r.hechos / r.esperados : null;
    const nivel = ratio == null ? null : ratio >= 1 ? 4 : ratio > 0.67 ? 3 : ratio > 0.34 ? 2 : ratio > 0 ? 1 : 0;
    dias.push({ fecha: d, nivel, tip: `${fechaCorta(d)}: ${r.esperados ? `${r.hechos} de ${r.esperados} (${pctTexto(ratio)})` : "nada que tocara"}` });
  }
  if (meses.length && meses[0].col === 0 && meses[1] && meses[1].col < 3) meses.shift();
  return tarjeta("Últimos 12 meses", `<div class="hb-heat-scroll">${HG.heatmap(dias, meses)}</div>
    <div class="hb-leyenda-heat"><span>Menos</span><i class="n0"></i><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i><span>Más</span></div>
    <p class="hb-card-sub">Toca un día para ver y corregir lo que hiciste.</p>`);
}

function tendenciaHtml(per) {
  const semanas = { "7d": 12, "30d": 12, "90d": 13, anio: 52, todo: 104 }[per.clave];
  const serie = HE.serieSemanal(res, semanas, 4).filter(s => s.esperados > 0 || s.actual);
  if (serie.length < 2) return tarjeta("Tendencia semanal", `<p class="empty-state">Con dos semanas de datos verás aquí tu tendencia.</p>`);
  const items = serie.map(s => ({
    valor: s.pct, etiqueta: "", suave: s.actual,
    tip: `Semana del ${fechaCorta(s.lunes)}${s.actual ? " (en curso)" : ""}: ${pctTexto(s.pct)} (${fmtNum(s.hechos)} de ${fmtNum(s.esperados)}) · media ${pctTexto(s.media)}`
  }));
  // Etiquetas solo al inicio y al final
  items[0].etiqueta = fechaCorta(serie[0].lunes);
  items[items.length - 1].etiqueta = "Esta semana";
  const tabla = `<details class="hb-tabla"><summary>Ver como tabla</summary><table><thead><tr><th>Semana</th><th>Cumplimiento</th><th>Media 4 sem.</th></tr></thead><tbody>${serie.slice().reverse().map(s =>
    `<tr><td>${fechaCorta(s.lunes)}</td><td>${pctTexto(s.pct)}</td><td>${pctTexto(s.media)}</td></tr>`).join("")}</tbody></table></details>`;
  return tarjeta("Tendencia semanal", `<div class="hb-chart">${HG.columnas(items, { linea: serie.map(s => s.media), titulo: "Cumplimiento por semana" })}</div>
    <div class="hb-leyenda"><span><i class="k-col"></i>Cada semana</span><span><i class="k-linea"></i>Media de 4 semanas</span></div>${tabla}`);
}

function diaSemanaHtml(per) {
  const b = HE.porDiaSemana(res, per.desde, per.hasta);
  const con = b.map((x, i) => Object.assign({ i }, x)).filter(x => x.pct != null);
  if (!con.length) return "";
  const mejor = con.reduce((a, x) => (x.pct > a.pct ? x : a)), peor = con.reduce((a, x) => (x.pct < a.pct ? x : a));
  const items = b.map((x, i) => ({
    etiqueta: DIAS_CORTOS[i], valor: x.pct, marcar: i === peor.i && con.length > 1,
    valorTexto: (i === mejor.i || i === peor.i) && x.pct != null ? pctTexto(x.pct) : "",
    tip: `${DIAS_LARGOS[i].charAt(0).toUpperCase() + DIAS_LARGOS[i].slice(1)}: ${x.pct == null ? "sin datos" : `${pctTexto(x.pct)} (${x.hechos} de ${x.esperados})`}`
  }));
  return tarjeta("¿Qué día fallas más?", `<div class="hb-chart">${HG.columnas(items, { titulo: "Cumplimiento por día de la semana" })}</div>`,
    con.length > 1 ? `El más difícil: ${DIAS_LARGOS[peor.i]}.` : "");
}

function momentoHtml(per) {
  const b = HE.porMomento(res, per.desde, per.hasta);
  const items = HC.MOMENTOS.filter(m => b[m.id].esperados > 0).map(m => ({
    etiqueta: m.nombre, valor: b[m.id].pct, texto: pctTexto(b[m.id].pct),
    tip: `${m.nombre}: ${pctTexto(b[m.id].pct)} (${b[m.id].hechos} de ${b[m.id].esperados})`
  }));
  if (!items.length) return "";
  return tarjeta("Por momento del día", HG.barrasH(items));
}

// Equilibrio entre categorías: radar con 3 a 8; con más (o menos), barras.
function radarHtml(per) {
  const defs = areasDef();
  const act = HE.areasPeriodo(res, per.desde, per.hasta, defs);
  if (!act.some(a => a.esperados > 0)) return tarjeta("Equilibrio entre categorías", `<p class="empty-state">Ponle categoría a tus hábitos (Ajustes › Categorías › Asignar) para ver tu equilibrio.</p>`);
  const prevTodo = per.previo ? HE.areasPeriodo(res, per.previo.desde, per.previo.hasta, defs) : null;
  const eq = HCat.equilibrio(act);
  const prev = prevTodo ? eq.ejes.map(a => prevTodo.find(x => x.id === a.id)) : null;
  const tip = (a, i) => `${a.nombre}: ${a.esperados ? pctTexto(a.pct) : "sin hábitos"}${prev && prev[i] && prev[i].esperados ? ` (antes ${pctTexto(prev[i].pct)})` : ""}`;
  if (eq.forma === "barras") {
    return tarjeta("Equilibrio entre categorías", HG.barrasH(eq.ejes.map((a, i) => ({ etiqueta: `${a.emoji || ""} ${a.nombre}`.trim(), valor: a.esperados ? a.pct : null, texto: a.esperados ? pctTexto(a.pct) : "—", tip: tip(a, i) }))));
  }
  const ejes = eq.ejes.map((a, i) => ({ nombre: a.nombre, tip: tip(a, i) }));
  return tarjeta("Equilibrio entre categorías", `<div class="hb-chart">${HG.radar(ejes, eq.ejes.map(a => a.pct), prev ? prev.map(a => (a ? a.pct : null)) : null)}</div>
    <div class="hb-leyenda"><span><i class="k-area"></i>Este periodo</span>${prev ? `<span><i class="k-prev"></i>Periodo anterior</span>` : ""}</div>`);
}

// Tarjeta "Por categoría": cumplimiento y tendencia de cada una, ordenadas.
function porCategoriaHtml(per) {
  const filas = HE.porCategoria(res, per, areasDef());
  if (filas.length < 1) return "";
  return tarjeta("Por categoría", `<ul class="hb-porcat">${filas.map(a => `<li><a class="hb-porcat-fila" href="#hab-categoria/${a.id}" style="--cat:${HCat.colorDe(a)}">
      <span class="hb-porcat-nombre"><span aria-hidden="true">${escapeHtml(a.emoji || "")}</span> ${escapeHtml(a.nombre)}</span>
      <span class="hbg-barras-pista"><span class="hbg-barras-valor" style="width:${Math.max(2, (a.pct || 0) * 100).toFixed(1)}%"></span></span>
      <span class="hb-porcat-num">${pctTexto(a.pct)}${per.previo ? delta(a.pct, a.previo, "pts") : ""}</span></a></li>`).join("")}</ul>`,
    per.previo ? `Contra ${NOMBRE_PERIODO[per.clave]}. Toca una para ver su página.` : "Toca una para ver su página.");
}

// Filtro de categoría de Estadísticas (se recuerda en el teléfono).
let statsFiltro = (() => { try { return localStorage.getItem("hb-stats-filtro") || null; } catch (e) { return null; } })();
function filtroStatsHtml(opciones, actual) {
  if (opciones.length < 2) return "";
  return `<div class="hb-filtros hb-filtros-stats" role="group" aria-label="Categoría">${[{ id: null, nombre: "Todas" }].concat(opciones).map(c => {
    const on = (c.id || null) === actual;
    const color = c.color ? HCat.colorDe(c) : null;
    return `<button type="button" class="hb-filtro${on ? " is-on" : ""}" data-stats-filtro="${c.id || ""}" aria-pressed="${on}"${color ? ` style="--cat:${color}"` : ""}>${c.emoji ? `<span aria-hidden="true">${escapeHtml(c.emoji)}</span>` : ""}${escapeHtml(c.nombre)}</button>`;
  }).join("")}</div>`;
}

function rankingHtml() {
  const lista = HE.ranking(res).filter(x => x.tieneRango);
  if (!lista.length) return "";
  return tarjeta("Ranking por fuerza", `<ul class="hb-ranking">${lista.map((x, i) => {
    const h = normal[x.id], t = x.tendencia;
    const flecha = t == null ? "" : t > 0.5 ? `<span class="hb-tend is-bien" aria-label="subiendo">▲</span>` : t < -0.5 ? `<span class="hb-tend is-mal" aria-label="bajando">▼</span>` : "";
    return `<li><button type="button" class="hb-ranking-fila" data-detalle="${x.id}">
      <span class="hb-ranking-pos">${i + 1}</span>${RangosInsignias.svg(HE.NIVELES[x.nivel], { tam: 28 })}
      <span class="hb-ranking-txt"><span class="hb-nombre">${escapeHtml(h.emoji)} ${escapeHtml(h.name)}</span>
        <span class="hbg-barras-pista"><span class="hbg-barras-valor" style="width:${Math.max(2, x.fuerza).toFixed(1)}%"></span></span></span>
      <span class="hb-ranking-num">${Math.round(x.fuerza)}${flecha}</span></button></li>`;
  }).join("")}</ul>`, "Fuerza de 0 a 100: sube cuando cumples y baja despacio cuando fallas.");
}

function riesgoHtml() {
  const lista = HE.enRiesgo(res).slice(0, 5);
  const txt = x => {
    const h = normal[x.id];
    if (x.tipo === "nuncaDos") {
      const p = res.habitos[x.id] && res.habitos[x.id].perdones;
      const salvada = res.habitos[x.id] && (res.habitos[x.id].dias[HE.addDias(res.hoy, -1)] || {}).perdonado;
      return salvada ? `Ayer se te pasó y un perdón salvó tu racha${p && !p.guardados ? "; no te quedan más" : ""}. Hoy es el día.` : `Ayer se te pasó. Hoy es el día: nunca dos veces.`;
    }
    if (x.tipo === "racha") return `Hoy toca: tu racha de ${x.racha} días está en juego.`;
    if (x.tipo === "semana") return x.faltan > x.quedan ? `Esta semana ya no alcanza: faltan ${x.faltan} y quedan ${x.quedan} días.` : `Te ${x.faltan === 1 ? "falta 1 vez" : `faltan ${x.faltan} veces`} y quedan justo ${x.quedan} días.`;
    return `Su fuerza bajó ${Math.round(x.caida)} puntos en 2 semanas.`;
  };
  return tarjeta("En riesgo", lista.length ? `<ul class="hb-riesgo">${lista.map(x => `<li><button type="button" class="hb-ranking-fila" data-detalle="${x.id}">
      <span class="hb-emoji" aria-hidden="true">${escapeHtml(normal[x.id].emoji)}</span>
      <span class="hb-ranking-txt"><span class="hb-nombre">${escapeHtml(normal[x.id].name)}</span><span class="hb-sub">${txt(x)}</span></span>
      <span class="rk-chev" data-icon="chevronRight"></span></button></li>`).join("")}</ul>`
    : `<p class="hb-texto">Nada en riesgo ahora mismo. Así se hace.</p>`);
}

function correlacionesHtml(c) {
  if (!c.suficiente) {
    return tarjeta("Tu ánimo y tus hábitos", `<p class="hb-texto">Anota tu ánimo al cerrar el día. Con 14 días verás aquí qué hábitos coinciden con tus mejores días. Llevas ${plural(c.diasConAnimo, "día", "días")}.</p>`);
  }
  const fmt1 = v => v.toFixed(1).replace(".", ",");
  const animo = c.animo.slice(0, 5).map(x => ({
    etiqueta: `${normal[x.id].emoji} ${normal[x.id].name}`, con: x.con, sin: x.sin,
    texto: `${x.diferencia > 0 ? "+" : "−"}${fmt1(Math.abs(x.diferencia))}`,
    tip: `${normal[x.id].name}: ánimo ${fmt1(x.con)} los días que lo cumples y ${fmt1(x.sin)} los que no (${x.n} días).`
  }));
  const juntos = c.juntos.slice(0, 3).map(x => `<li>Cuando cumples <b>${escapeHtml(normal[x.a].name)}</b>, también cumples <b>${escapeHtml(normal[x.b].name)}</b> el ${pctTexto(x.pBA)} de las veces (en general, ${pctTexto(x.pB)}).</li>`).join("");
  return tarjeta("Tu ánimo y tus hábitos", `
    ${animo.length ? `${HG.pesas(animo)}<div class="hb-leyenda"><span><i class="k-prev k-punto"></i>Ánimo los días que no lo cumples</span><span><i class="k-area k-punto"></i>Los días que sí</span></div>` : `<p class="hb-texto">Todavía no hay suficientes días con y sin cada hábito para comparar.</p>`}
    ${juntos ? `<h3 class="hb-sub-t">Suelen ir juntos</h3><ul class="hb-lista-texto">${juntos}</ul>` : ""}
    <p class="hb-card-sub">Son coincidencias en tus datos, no causas.</p>`, "Ánimo del 1 al 5, según lo que anotas al cerrar el día.");
}

function resumenSemanaHtml(conCerrar) {
  const lunes = HE.addDias(HE.lunesDe(res.hoy), -7);
  const r = HE.resumenSemana(res, lunes, res.subconjunto ? null : areasDef());
  if (r.pct == null) return "";
  const nom = x => (x && normal[x.id] ? `${escapeHtml(normal[x.id].emoji)} ${escapeHtml(normal[x.id].name)} (${pctTexto(x.pct)})` : "—");
  return `<section class="hb-card hb-resumen-semana" aria-label="Tu semana pasada">
    <div class="hb-resumen-top"><h2 class="hb-card-t">Tu semana pasada</h2>${conCerrar ? `<button type="button" class="muscle-sheet-close" data-resumen-visto aria-label="Cerrar el resumen"><span data-icon="close"></span></button>` : ""}</div>
    <div class="hb-resumen-datos">
      <div><span class="hb-num">${pctTexto(r.pct)}</span><span>${r.pctPrevio != null ? delta(r.pct, r.pctPrevio, "pts") : "cumplimiento"}</span></div>
      <div><span class="hb-num">+${fmtNum(r.xp)}</span><span>XP</span></div>
      <div><span class="hb-num">${r.perfectos}</span><span>${r.perfectos === 1 ? "día perfecto" : "días perfectos"}</span></div>
    </div>
    <p class="hb-texto">Mejor: ${nom(r.mejor)}${r.peor && r.peor.pct < 1 ? ` · A cuidar: ${nom(r.peor)}` : ""}</p>
    ${r.mejorCategoria ? `<p class="hb-texto">Tu mejor categoría: <a class="hb-link-cat" href="#hab-categoria/${r.mejorCategoria.id}" style="--cat:${HCat.colorDe(r.mejorCategoria)}">${escapeHtml(r.mejorCategoria.emoji || "")} ${escapeHtml(r.mejorCategoria.nombre)}</a> (${pctTexto(r.mejorCategoria.pct)})</p>` : ""}
  </section>`;
}

function renderStats() {
  if (!cargado || !res || !panelStats || panelStats.hidden) return;
  const el = document.getElementById("hb-stats");
  if (!activos().length) { el.innerHTML = `<p class="empty-state">Crea un hábito en Hoy y aquí verás tus estadísticas.</p>`; return; }
  // Categorías que se pueden filtrar: las que tienen (o tuvieron) hábitos.
  const opciones = areasDef().filter(c => Object.keys(normal).some(id => normal[id].area === c.id) && (!c.archivada || res.areas.some(a => a.id === c.id && a.xp > 0)));
  const filtro = opciones.some(c => c.id === statsFiltro) ? statsFiltro : null;
  const resTotal = res;
  if (filtro) res = HE.deCategoria(resTotal, filtro);
  try {
  const cat = filtro ? opciones.find(c => c.id === filtro) : null;
  const inicio = activos().filter(h => !filtro || h.area === filtro).map(h => h.inicio).filter(Boolean).sort()[0] || activos().map(h => h.inicio).filter(Boolean).sort()[0];
  const per = HE.periodo(periodoStats, res.hoy, inicio);
  const k = HE.kpis(res, per);
  const corr = HE.correlaciones(res, diasMeta);
  const frases = HE.insights(res, per, { correlaciones: corr, categorias: filtro ? null : areasDef() });
  const cambio = periodoPrevio && periodoPrevio !== periodoStats;
  const scroll = el.querySelector(".hb-heat-scroll");
  const scrollHeat = scroll ? scroll.scrollLeft : null;
  const mes = Number(res.hoy.slice(5, 7));
  const wrappedArriba = mes === 12 || mes === 1;
  el.innerHTML = `
    ${filtroStatsHtml(opciones, filtro)}
    ${cat ? `<a class="hb-ver-cat" href="#hab-categoria/${cat.id}" style="--cat:${HCat.colorDe(cat)}"><span aria-hidden="true">${escapeHtml(cat.emoji)}</span> Ver la página de ${escapeHtml(cat.nombre)}<span aria-hidden="true">›</span></a>` : ""}
    ${wrappedArriba && !filtro ? wrappedEntradaHtml() : ""}
    ${heatmapHtml()}
    ${resumenSemanaHtml(false)}
    <div class="fin-tabs hb-periodos" role="tablist" aria-label="Periodo">${PERIODOS_UI.map(([id, t]) =>
      `<button type="button" class="fin-tab${periodoStats === id ? " active" : ""}" role="tab" aria-selected="${periodoStats === id}" data-periodo="${id}">${t}</button>`).join("")}</div>
    <div class="hb-stats-cuerpo${cambio ? " is-cambio" : ""}">
      ${kpisHtml(k, per)}
      ${frases.length ? tarjeta("Lo que dicen tus datos", `<ul class="hb-lista-texto">${frases.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`) : ""}
      ${tendenciaHtml(per)}
      ${diaSemanaHtml(per)}
      ${momentoHtml(per)}
      ${filtro ? "" : porCategoriaHtml(per)}
      ${filtro ? "" : radarHtml(per)}
      ${riesgoHtml()}
      ${rankingHtml()}
      ${correlacionesHtml(corr)}
    </div>
    ${wrappedArriba || filtro ? "" : wrappedEntradaHtml()}`;
  const s = el.querySelector(".hb-heat-scroll");
  if (s) s.scrollLeft = scrollHeat != null ? scrollHeat : s.scrollWidth;
  renderIcons(el);
  if (cambio && !reducirMovimiento()) contar(el.querySelector("[data-contar]"));
  periodoPrevio = periodoStats;
  } finally { res = resTotal; }
}

// El número principal cuenta hasta su valor al cambiar de periodo.
function contar(el) {
  if (!el || el.dataset.contar === "") return;
  const fin = Number(el.dataset.contar), t0 = performance.now();
  const paso = t => {
    const k = Math.min(1, (t - t0) / 450);
    el.textContent = `${Math.round(fin * (1 - Math.pow(1 - k, 3)))} %`;
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

document.getElementById("hb-stats").addEventListener("click", e => {
  const b = e.target.closest("[data-stats-filtro]");
  if (!b) return;
  statsFiltro = b.dataset.statsFiltro || null;
  try { if (statsFiltro) localStorage.setItem("hb-stats-filtro", statsFiltro); else localStorage.removeItem("hb-stats-filtro"); } catch (err) { /* sin almacenamiento */ }
  renderStats();
});
function cambiarPeriodo(paso) {
  const i = PERIODOS_UI.findIndex(p => p[0] === periodoStats);
  const j = Math.min(PERIODOS_UI.length - 1, Math.max(0, i + paso));
  if (j === i) return;
  periodoStats = PERIODOS_UI[j][0];
  renderStats();
}

// ---------- Manolo Wrapped: tu año en hábitos ----------
// En diciembre y enero la tarjeta sube arriba de Estadísticas; en enero
// protagoniza el año que acaba de terminar.
function anioWrappedPrincipal(anios) {
  const mes = Number(res.hoy.slice(5, 7));
  return mes === 1 && anios.length > 1 ? anios[1] : anios[0];
}
function wrappedEntradaHtml() {
  const anios = HE.aniosWrapped(res);
  if (!anios.length) return "";
  const principal = anioWrappedPrincipal(anios);
  return `<section class="hb-card hb-wrapped-card" aria-label="Manolo Wrapped">
    <span class="hb-jefe-eyebrow">Manolo Wrapped</span>
    <h2 class="hb-card-t">Tu ${principal} en hábitos</h2>
    <p class="hb-texto">Tus números del año, uno por uno: tu hábito estrella, tu mejor racha, tu mejor mes y más.</p>
    <div class="hb-chips">${anios.map(y => y === principal
      ? `<button type="button" class="hb-btn" data-wrapped="${y}">Ver tu ${y}</button>`
      : `<button type="button" class="hb-btn-sec" data-wrapped="${y}">${y}</button>`).join("")}</div>
  </section>`;
}

const DIAS_PLURAL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
const INICIAL_MES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
function slidesWrapped(w) {
  const h = id => normal[id];
  const nombre = id => (h(id) ? `${escapeHtml(h(id).emoji)} ${escapeHtml(h(id).name)}` : "un hábito que ya no está");
  const s = [];
  s.push({ tema: "fuego", html: `<p class="hb-wr-eyebrow">Manolo Wrapped</p>
    <h2 class="hb-wr-t">Tu ${w.anio} en hábitos</h2>
    <p class="hb-wr-p">${w.completo ? "Un año entero de pasos pequeños." : `Lo que va del año, hasta el ${fechaCorta(w.hasta)}.`}</p>
    <p class="hb-wr-pista">Toca a la derecha para avanzar</p>` });
  if (!w.registros) {
    s.push({ tema: "oscuro", html: `<p class="hb-wr-eyebrow">${w.anio}</p><h2 class="hb-wr-t">Este año todavía no registraste hábitos</h2>
      <p class="hb-wr-p">Marca uno hoy y este resumen empezará a llenarse.</p>` });
  } else {
    s.push({ tema: "oscuro", html: `<p class="hb-wr-eyebrow">Este año cumpliste</p>
      <p class="hb-wr-grande">${fmtNum(w.registros)}</p>
      <p class="hb-wr-p">${w.registros === 1 ? "vez" : "veces"} un hábito, en ${plural(w.diasActivos, "día distinto", "días distintos")}.</p>` });
    if (w.cumplimiento != null) {
      const meses = w.meses.map(m => `<li aria-label="${MESES_LARGOS[m.mes - 1]}: ${m.pct == null ? "sin datos" : pctTexto(m.pct)}">
        <span class="hb-wr-mes-col" aria-hidden="true"><span style="height:${m.pct == null ? 0 : Math.max(4, m.pct * 100).toFixed(0)}%"></span></span>
        <span class="hb-wr-mes-l" aria-hidden="true">${INICIAL_MES[m.mes - 1]}</span></li>`).join("");
      s.push({ tema: "fuego", html: `<p class="hb-wr-eyebrow">Cumpliste</p>
        <p class="hb-wr-grande">${pctTexto(w.cumplimiento)}</p>
        <p class="hb-wr-p">de lo que te propusiste.</p>
        <ol class="hb-wr-meses" aria-label="Cumplimiento por mes">${meses}</ol>
        ${w.mejorMes ? `<p class="hb-wr-p">Tu mejor mes fue <b>${MESES_LARGOS[w.mejorMes.mes - 1]}</b>, con ${pctTexto(w.mejorMes.pct)}.</p>` : ""}` });
    }
    if (w.estrella) {
      s.push({ tema: "oscuro", html: `<p class="hb-wr-eyebrow">Tu hábito estrella</p>
        <p class="hb-wr-emoji" aria-hidden="true">${h(w.estrella.id) ? escapeHtml(h(w.estrella.id).emoji) : "⭐"}</p>
        <h2 class="hb-wr-t">${h(w.estrella.id) ? escapeHtml(h(w.estrella.id).name) : "Un hábito que ya no está"}</h2>
        <p class="hb-wr-p">Lo cumpliste ${plural(w.estrella.veces, "vez", "veces")} este año.</p>
        ${w.constante && w.constante.id !== w.estrella.id ? `<p class="hb-wr-p">El más constante fue ${nombre(w.constante.id)}, con ${pctTexto(w.constante.pct)}.</p>` : ""}` });
    }
    if (w.racha) {
      s.push({ tema: "oro", html: `<p class="hb-wr-eyebrow">Tu mejor racha</p>
        <p class="hb-wr-grande">${fmtNum(w.racha.n)}</p>
        <p class="hb-wr-p">${w.racha.unidad === "semanas" ? (w.racha.n === 1 ? "semana" : "semanas seguidas") : (w.racha.n === 1 ? "día" : "días seguidos")} con ${nombre(w.racha.id)}.</p>
        ${w.perfectos ? `<p class="hb-wr-p">Y ${plural(w.perfectos, "día perfecto", "días perfectos")}, sin dejar nada pendiente.</p>` : ""}` });
    }
    if (w.mejorDia || w.momento) {
      const mom = w.momento ? HC.MOMENTOS.find(m => m.id === w.momento.id).nombre.toLowerCase() : null;
      s.push({ tema: "fuego", html: `<p class="hb-wr-eyebrow">Tu ritmo</p>
        ${w.mejorDia ? `<h2 class="hb-wr-t">Los ${DIAS_PLURAL[w.mejorDia.dia]} fueron tu día</h2>
          <p class="hb-wr-p">Cumpliste el ${pctTexto(w.mejorDia.pct)} de lo que tocaba.</p>` : ""}
        ${mom ? `<p class="hb-wr-p">Tu momento fuerte fue la ${mom}: ${plural(w.momento.hechos, "hábito cumplido", "hábitos cumplidos")}.</p>` : ""}` });
    }
    if (w.categoria) {
      s.push({ tema: "oro", html: `<p class="hb-wr-eyebrow">Tu categoría del año</p>
        <p class="hb-wr-emoji" aria-hidden="true">${escapeHtml(w.categoria.emoji || "🏷️")}</p>
        <h2 class="hb-wr-t">${escapeHtml(w.categoria.nombre)}</h2>
        <p class="hb-wr-p">Cumpliste el ${pctTexto(w.categoria.pct)} de lo que te propusiste en ${escapeHtml(w.categoria.nombre)}.</p>` });
    }
    const juegoTxt = [];
    if (w.jefesTotal) juegoTxt.push(`derrotaste ${w.jefes} de ${plural(w.jefesTotal, "jefe", "jefes")}`);
    if (w.misiones) juegoTxt.push(`cumpliste ${plural(w.misiones, "misión", "misiones")}`);
    const rango = w.rango != null ? nivelHab(w.rango.nivel) : null;
    s.push({ tema: "oscuro", html: `<p class="hb-wr-eyebrow">Tu progreso</p>
      <p class="hb-wr-grande">+${fmtNum(w.xp)}</p>
      <p class="hb-wr-p">XP este año. ${w.nivelFin > w.nivelInicio ? `Pasaste del nivel ${w.nivelInicio} al <b>${w.nivelFin}</b>.` : `Estás en el nivel <b>${w.nivelFin}</b>.`}</p>
      ${rango ? `<div class="hb-wr-rango">${RangosInsignias.svg(rango, { tam: 64 })}<p class="hb-wr-p">Tu mejor rango: <b>${escapeHtml(rango.nombre)}</b>, con ${nombre(w.rango.id)}.</p></div>` : ""}
      ${juegoTxt.length ? `<p class="hb-wr-p">${juegoTxt.join(" y ").replace(/^./, c => c.toUpperCase())}.</p>` : ""}` });
  }
  s.push({ tema: "fuego", html: `<p class="hb-wr-eyebrow">${w.anio}</p>
    <h2 class="hb-wr-t">${w.completo ? "Gracias por un año más" : "Y el año todavía no termina"}</h2>
    <p class="hb-wr-p">${w.completo ? `Lo que repites se vuelve parte de ti. Nos vemos en ${w.anio + 1}.` : "Cada día que marques suma a este resumen."}</p>
    <div class="hb-wr-acciones"><button type="button" class="hb-wr-btn" data-wr-reiniciar>Verlo otra vez</button>
      <button type="button" class="hb-wr-btn is-sec" data-wr-cerrar>Cerrar</button></div>` });
  return s;
}

let wrapped = null; // { el, slides, i, anterior (foco) }
function abrirWrapped(anio) {
  const w = HE.wrapped(res, anio, areasDef());
  if (!w) return;
  const slides = slidesWrapped(w);
  const el = document.createElement("div");
  el.className = "hb-wrapped";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", `Tu ${anio} en hábitos`);
  el.innerHTML = `<div class="hb-wr-progreso" aria-hidden="true">${slides.map(() => "<span><i></i></span>").join("")}</div>
    <button type="button" class="hb-wr-cerrar" data-wr-cerrar aria-label="Cerrar el resumen del año"><span data-icon="close"></span></button>
    <button type="button" class="hb-wr-zona is-prev" data-wr-paso="-1" aria-label="Anterior"></button>
    <button type="button" class="hb-wr-zona is-next" data-wr-paso="1" aria-label="Siguiente"></button>
    <div class="hb-wr-slide" aria-live="polite"></div>
    <p class="hb-wr-cuenta" aria-hidden="true"></p>`;
  document.body.appendChild(el);
  document.body.classList.add("sheet-open");
  renderIcons(el);
  wrapped = { el, slides, i: 0, anterior: document.activeElement };
  el.addEventListener("click", e => {
    if (e.target.closest("[data-wr-cerrar]")) { cerrarWrapped(); return; }
    if (e.target.closest("[data-wr-reiniciar]")) { irWrapped(0); return; }
    const z = e.target.closest("[data-wr-paso]");
    if (z) irWrapped(wrapped.i + Number(z.dataset.wrPaso));
  });
  document.addEventListener("keydown", teclaWrapped);
  irWrapped(0);
  el.querySelector(".hb-wr-cerrar").focus();
}
function teclaWrapped(e) {
  if (!wrapped) return;
  const el = wrapped.el;
  if (e.key === "Escape") { e.preventDefault(); cerrarWrapped(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); irWrapped(wrapped.i + 1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); irWrapped(wrapped.i - 1); }
  else if (e.key === "Tab") {
    // El foco no sale del resumen mientras está abierto.
    const f = Array.from(el.querySelectorAll("button:not([disabled])"));
    const k = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}
function irWrapped(i) {
  if (!wrapped) return;
  const { el, slides } = wrapped;
  const j = Math.max(0, Math.min(slides.length - 1, i));
  if (j === wrapped.i && el.querySelector(".hb-wr-slide").innerHTML) return;
  wrapped.i = j;
  el.dataset.tema = slides[j].tema;
  const slide = el.querySelector(".hb-wr-slide");
  slide.innerHTML = slides[j].html;
  Array.from(slide.children).forEach((c, k) => c.style.setProperty("--i", k));
  el.querySelectorAll(".hb-wr-progreso span").forEach((b, k) => { b.classList.toggle("is-visto", k < j); b.classList.toggle("is-on", k === j); });
  el.querySelector(".hb-wr-cuenta").textContent = `${j + 1} de ${slides.length}`;
  el.querySelector(".is-prev").disabled = j === 0;
  el.querySelector(".is-next").disabled = j === slides.length - 1;
  renderIcons(slide);
  // El número grande se achica hasta caber en pantallas angostas.
  const g = slide.querySelector(".hb-wr-grande");
  if (g) {
    let fs = parseFloat(getComputedStyle(g).fontSize);
    while (g.scrollWidth > g.clientWidth && fs > 36) { fs -= 4; g.style.fontSize = `${fs}px`; }
  }
  if (!el.contains(document.activeElement) || document.activeElement.disabled) el.querySelector(".hb-wr-cerrar").focus();
}
function cerrarWrapped() {
  if (!wrapped) return;
  const { el, anterior } = wrapped;
  wrapped = null;
  document.removeEventListener("keydown", teclaWrapped);
  el.classList.add("closing");
  if (!hoja || hoja.hidden) document.body.classList.remove("sheet-open");
  setTimeout(() => el.remove(), reducirMovimiento() ? 0 : 200);
  if (anterior && anterior.focus) anterior.focus();
}

// ---------- Globo con el valor al tocar un gráfico ----------
let tipEl = null;
function mostrarTip(el) {
  const cont = el.closest(".hb-card, .hb-sheet-body");
  if (!cont) return;
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "hb-tip"; tipEl.setAttribute("role", "status"); }
  cont.style.position = "relative";
  cont.appendChild(tipEl);
  tipEl.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect(), c = cont.getBoundingClientRect();
  const x = (el.dataset.x && el.ownerSVGElement ? (() => { const s = el.ownerSVGElement.getBoundingClientRect(); return s.left + (Number(el.dataset.x) / el.ownerSVGElement.viewBox.baseVal.width) * s.width; })() : r.left + r.width / 2) - c.left;
  tipEl.style.left = `${Math.max(8, Math.min(c.width - 8, x))}px`;
  tipEl.style.top = `${Math.max(4, r.top - c.top)}px`;
  tipEl.hidden = false;
  document.querySelectorAll(".is-tip").forEach(x => x.classList.remove("is-tip"));
  el.classList.add("is-tip");
}
function ocultarTip() {
  if (tipEl) tipEl.hidden = true;
  document.querySelectorAll(".is-tip").forEach(x => x.classList.remove("is-tip"));
}
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (t && (t.closest("#panel-hab-stats") || t.closest(".hb-sheet"))) { if (!t.dataset.dia) { mostrarTip(t); return; } }
  if (!e.target.closest || !e.target.closest(".hb-tip")) ocultarTip();
}, true);
document.addEventListener("focusin", e => { const t = e.target.closest && e.target.closest("[data-tip]"); if (t && t.closest("#panel-hab-stats")) mostrarTip(t); });

// ---------- Hoja de un día (desde el mapa de calor) ----------
function hojaDia(fecha) {
  const lista = activos().concat(Object.keys(normal).map(id => normal[id]).filter(h => h.archivado))
    .filter(h => res.habitos[h.id] && res.habitos[h.id].dias[fecha] && res.habitos[h.id].dias[fecha].clase !== "fuera");
  const r = HE.resumenDia(res, fecha);
  const [y, m, d] = fecha.split("-").map(Number);
  const estadoTxt = (h, dd) => {
    if (dd.protegido) return "Cubierto por un comodín";
    if (dd.clase === "noToca") return "No tocaba";
    if (dd.clase === "neutral") return dd.estado === "saltado" ? "Saltado" : "En pausa";
    if (dd.clase === "fallo") return h.tipo === "evitar" ? "Recaída" : "No hecho";
    if (dd.clase === "pendiente") return "Pendiente";
    return dd.estado ? HC.ESTADOS[dd.estado].nombre : "Hecho";
  };
  abrirHoja(cabecera(NOMBRES_DIA[HE.diaSemana(fecha)].replace(/^./, c => c.toUpperCase()), `${d} de ${MESES_LARGOS[m - 1]} de ${y}`,
    r.esperados ? `${r.hechos} de ${r.esperados} hábitos (${pctTexto(r.hechos / r.esperados)})` : "Nada que tocara") + `
    ${lista.length ? `<ul class="hb-riesgo">${lista.map(h => {
      const dd = res.habitos[h.id].dias[fecha];
      return `<li><button type="button" class="hb-ranking-fila" data-detalle-dia="${h.id}" data-fecha="${fecha}">
        <span class="hb-emoji" aria-hidden="true">${escapeHtml(h.emoji)}</span>
        <span class="hb-ranking-txt"><span class="hb-nombre">${escapeHtml(h.name)}</span><span class="hb-sub">${estadoTxt(h, dd)}</span></span>
        <span class="rk-chev" data-icon="chevronRight"></span></button></li>`;
    }).join("")}</ul>` : `<p class="hb-texto">No tenías hábitos ese día.</p>`}
    ${diasMeta[fecha] && (diasMeta[fecha].animo || diasMeta[fecha].nota) ? `<p class="hb-texto">Ánimo: ${diasMeta[fecha].animo ? ANIMOS[diasMeta[fecha].animo - 1][2].toLowerCase() : "—"}${diasMeta[fecha].nota ? ` · «${escapeHtml(diasMeta[fecha].nota)}»` : ""}</p>` : ""}
    <p class="hb-card-sub">Toca un hábito para corregir ese día.</p>`, { tipo: "dia", id: fecha });
}

if (panelStats) {
  panelStats.addEventListener("click", e => {
    const p = e.target.closest("[data-periodo]");
    if (p) { periodoStats = p.dataset.periodo; renderStats(); return; }
    const wr = e.target.closest("[data-wrapped]");
    if (wr) { abrirWrapped(Number(wr.dataset.wrapped)); return; }
    const dia = e.target.closest("[data-dia]");
    if (dia) { hojaDia(dia.dataset.dia); return; }
    const d = e.target.closest("[data-detalle]");
    if (d) hojaDetalle(d.dataset.detalle);
  });
  panelStats.addEventListener("keydown", e => {
    const dia = e.target.closest && e.target.closest("[data-dia]");
    if (dia && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); hojaDia(dia.dataset.dia); }
  });
  // Deslizar a los lados cambia el periodo (fuera del mapa de calor, que se desplaza).
  let toque = null;
  panelStats.addEventListener("touchstart", e => {
    if (e.target.closest(".hb-heat-scroll")) { toque = null; return; }
    toque = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  panelStats.addEventListener("touchend", e => {
    if (!toque) return;
    const dx = e.changedTouches[0].clientX - toque.x, dy = e.changedTouches[0].clientY - toque.y;
    toque = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 40) cambiarPeriodo(dx < 0 ? 1 : -1);
  }, { passive: true });
  new MutationObserver(() => { if (!panelStats.hidden) renderStats(); else { ocultarTip(); cerrarWrapped(); } })
    .observe(panelStats, { attributes: true, attributeFilter: ["hidden"] });
}
if (panelHoy) {
  new MutationObserver(() => { if (panelHoy.hidden && hojaActual) cerrarHoja(); })
    .observe(panelHoy, { attributes: true, attributeFilter: ["hidden"] });
}

// ---------- Todo junto ----------
function actualizar() {
  if (!cargado) return;
  if (window.HabitoScalping) HabitoScalping.datos(docs[HabitoScalping.ID] || null);
  recalcular();
  asegurarMisiones();
  asegurarJefe();
  renderHoy();
  renderStats();
  renderLogros();
  renderInicio();
  if (hojaActual && hojaActual.tipo === "detalle") hojaDetalle(hojaActual.id);
  else if (hojaActual && hojaActual.tipo === "cierre") hojaCierre();
  else if (hojaActual && hojaActual.tipo === "dia") hojaDia(hojaActual.id);
  else if (hojaActual && hojaActual.tipo === "opciones") hojaOpciones(hojaActual.id);
  if (pendienteXP) {
    const ganado = res.xp - pendienteXP.xp;
    if (ganado > 0 && !reducirMovimiento()) mostrarXP(pendienteXP.id, ganado);
    pendienteXP = null;
  }
  revisarCelebraciones();
  document.dispatchEvent(new CustomEvent("habitos:actualizado"));
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
    clearTimeout(timerAuto);
    timerAuto = setTimeout(sincronizarAuto, 250);
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
// Para las pantallas en archivos aparte (categorías, Hoy por categoría…).
window.HabitosApp = {
  estado: () => ({ docs, normal, res, juego, cargado: cargado && juegoCargado }),
  areasDef, categoriasActivas, guardarCategorias, activos, coleccion, metaJuego,
  abrirHoja, cerrarHoja, cabecera, hojaActual: () => hojaActual, toast, errorGuardar, actualizar,
  escapeHtml, plural, fmtNum, fechaCorta, pctTexto: v => pctTexto(v), enTiempo,
  // Vuelve al formulario del hábito con esta categoría elegida (tras "+ Nueva").
  volverAlForm(area) {
    if (!form) return;
    if (area !== undefined) form.area = area;
    hojaForm();
    const chip = hoja && hoja.querySelector('.hb-form [data-campo="area"].is-on');
    if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: "center" });
  },
  leerForm() { leerCampos(); return form; },
  hojaAjustes: () => hojaAjustes(),
  // Corre fn con otro resultado (p. ej. solo una categoría) y devuelve lo que dé.
  conRes(otro, fn) { const antes = res; res = otro; try { return fn(); } finally { res = antes; } },
  tarjeta: (t, c, sub) => tarjeta(t, c, sub), heatmapHtml: () => heatmapHtml(), tendenciaHtml: per => tendenciaHtml(per),
  rankingHtml: () => rankingHtml(), riesgoHtml: () => riesgoHtml(), delta: (a, b, u) => delta(a, b, u), barra: (fr, t) => barra(fr, t),
  insigniaNivel: idx => nivelHab(idx), textoRacha: r => textoRacha(r), hojaDia: f => hojaDia(f), hojaDetalle: id => hojaDetalle(id),
  renderIcons: el => renderIcons(el), fmtNum: n => fmtNum(n),
  nuevoHabito(area) { hojaForm(null); if (area) { form.area = area; hojaForm(); } },
  filtrarStats(id) { statsFiltro = id || null; },
  alClick: fn => plugins.click.push(fn), alCambiar: fn => plugins.cambio.push(fn), alEnviar: fn => plugins.submit.push(fn),
  alEscribir: fn => plugins.input.push(fn),
  // Llena el formulario con una plantilla (js/habitos-plantillas.js).
  desdePlantilla(campos) {
    form = Object.assign(formDesde(null), campos, { areaElegida: true });
    form._mas = !!(form.vinculo || form.minima || form.dificultad !== "media");
    emojiGrupo = null;
    hojaForm();
  }
};
})();
