// ---------- Ejercicio › Rangos (pantallas y aviso "Nuevos rangos") ----------
// Calcula los rangos con js/rangos-engine.js a partir de los entrenos que
// junta js/ejercicio-datos.js (nada se guarda: todo se deriva del historial)
// y dibuja: rango global, diagrama corporal, grupos, ejercicios, detalle,
// escalera y explicación. Al guardar un entreno compara con el snapshot
// (meta/rangos_snapshot) y muestra las subidas. Los vínculos manuales y las
// series sospechosas confirmadas viven en meta/rangos_vinculos.
(function () {

const RE = RangosEngine;
const CFG = RangosConfig;
const C = CFG.CONST;
const CATALOGO = CFG.STANDARDS[CFG.COHORTE];
const NINGUNO = "__ninguno__";
const panel = document.getElementById("panel-ej-rangos");
const app = document.getElementById("rk-app");

let res = null;              // último cálculo
let filtro = "todos";        // filtro de la lista de ejercicios
let grupoAbierto = null;     // grupo expandido
let esperandoAviso = 0;      // hasta cuándo (ms) buscar subidas tras guardar
let avisoAbierto = false;

// ---------- Utilidades ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
function fmt(n, dec) {
  const d = dec == null ? 1 : dec;
  const f = Math.pow(10, d);
  const r = Math.round(n * f) / f;
  const [e, fr] = String(Math.abs(r)).split(".");
  return (r < 0 ? "-" : "") + e.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fr ? "," + fr : "");
}
function isoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fechaCorta(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}
const nivel = idx => (idx == null ? null : RE.NIVELES[idx]);
const insignia = (idx, tam) => RangosInsignias.svg(nivel(idx), { tam });
function textoCorto(P) {
  return P >= 50 ? `Top ${RE.topPorcentaje(P)} %` : `Supera al ${Math.round(P)} %`;
}
function grupoDeMusculo(m) {
  return CFG.GRUPOS.find(g => g.musculos.includes(m));
}

// ---------- Vínculos y datos ----------
const ALIAS = {};
Object.keys(CATALOGO).forEach(id => {
  [CATALOGO[id].nombre].concat(CATALOGO[id].alias).forEach(a => { ALIAS[ExerciseSearch.clave(a)] = id; });
});
const POR_BASE = {};
Object.keys(CATALOGO).forEach(id => CATALOGO[id].baseIds.forEach(b => { POR_BASE[b] = id; }));

function clavesDe(ex) {
  const ficha = EjercicioDatos.resolver(ex.name, ex.exerciseId);
  return { ficha, idKey: ficha ? "id:" + ficha.id : null, nKey: "n:" + ExerciseSearch.clave(ex.name) };
}

function vincular(ex) {
  const v = (EjercicioDatos.estado.rangosVinculos || {}).vinculos || {};
  const { ficha, idKey, nKey } = clavesDe(ex);
  const clave = idKey || nKey;
  const nombre = ficha ? ficha.nombre : ex.name;
  const manual = (idKey && v[idKey]) || v[nKey];
  if (manual === NINGUNO) return { clave, nombre, motivo: "sin_equivalente" };
  if (manual && CATALOGO[manual]) return { id: manual };
  if (ficha && POR_BASE[ficha.id]) return { id: POR_BASE[ficha.id] };
  const porNombre = ALIAS[ExerciseSearch.clave(ex.name)] || (ficha && ALIAS[ExerciseSearch.clave(ficha.nombre)]);
  if (porNombre) return { id: porNombre };
  return { clave, nombre, motivo: ficha ? "sin_estandar" : "sin_vincular" };
}

// Músculos: los del mapa muscular de Manolo; la tabla de rangos es el respaldo.
function musculosDe(id) {
  const def = CATALOGO[id];
  return RE.musculosDesdeFicha(EjercicioDatos.ficha(def.baseIds[0])) || def.musculos;
}

function porMancuerna(id) {
  const f = EjercicioDatos.ficha(CATALOGO[id].baseIds[0]);
  return !!(f && f.equipo === "mancuerna");
}

// Peso de cada sesión: último pesaje con fecha ≤ a la sesión → peso del
// perfil → 85 kg.
function pesoEn(fecha) {
  const st = EjercicioDatos.estado;
  const pesajes = (st.perfil && st.perfil.pesajes) || {};
  const fechas = Object.keys(pesajes).filter(f => f <= fecha && Number(pesajes[f]) > 0).sort();
  if (fechas.length) return Number(pesajes[fechas[fechas.length - 1]]);
  const perfil = Number(st.ajustes && st.ajustes.pesoCorporal);
  return perfil > 0 ? perfil : C.DEFAULT_BW;
}

function calcular() {
  const st = EjercicioDatos.estado;
  res = RE.calcularRangos({
    entrenos: st.registros.gimnasio,
    vincular, musculosDe, pesoEn,
    confirmadas: (st.rangosVinculos || {}).confirmadas || {},
    hoy: isoHoy()
  });
  return res;
}

// ---------- Hojas (reutilizan el estilo de la hoja del mapa) ----------
let hoja = null;
function abrirHoja(html, clase) {
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "muscle-sheet rk-sheet";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="muscle-sheet-overlay" data-cerrar></div>
      <div class="muscle-sheet-panel" role="dialog" aria-modal="true"><div class="muscle-sheet-grip"></div><div class="rk-sheet-body"></div></div>`;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", onClickHoja);
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarHoja(); });
  }
  hoja.querySelector(".rk-sheet-body").innerHTML = html;
  hoja.querySelector(".muscle-sheet-panel").className = "muscle-sheet-panel" + (clase ? " " + clase : "");
  if (typeof renderIcons === "function") renderIcons(hoja);
  hoja.hidden = false;
  hoja.classList.remove("closing");
  hoja.querySelector(".muscle-sheet-panel").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function cerrarHoja() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("closing");
  document.body.classList.remove("sheet-open");
  setTimeout(() => { hoja.hidden = true; hoja.classList.remove("closing"); }, 220);
}
const cabeceraHoja = (grupo, titulo, sub) => `
  <div class="muscle-sheet-head">
    <div>
      <span class="muscle-sheet-group">${escapeHtml(grupo)}</span>
      <h3>${escapeHtml(titulo)}</h3>
      ${sub ? `<span class="muscle-sheet-period">${sub}</span>` : ""}
    </div>
    <button type="button" class="muscle-sheet-close" data-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
  </div>`;

// ---------- Render principal ----------
function render() {
  if (!app || panel.hidden) return;
  const st = EjercicioDatos.estado;
  if (!st.datos || !res) {
    app.innerHTML = `<p class="empty-state">Cargando tus rangos…</p>`;
    return;
  }
  app.innerHTML = [heroHtml(), cuerpoHtml(), gruposHtml(), ejerciciosHtml(), escaleraHtml(), comoHtml()].join("");
  pintarCuerpo();
}

function heroHtml() {
  const g = res.global;
  const bw = pesoEn(isoHoy());
  if (!g.desbloqueado) {
    const n = C.GLOBAL_MIN_EJERCICIOS - g.faltan;
    const vacio = !EjercicioDatos.estado.registros.gimnasio.length;
    return `
      <section class="rk-hero is-locked" aria-labelledby="rk-hero-titulo">
        <div class="rk-hero-badge">${insignia(null, 96)}</div>
        <div class="rk-hero-info">
          <span class="rk-eyebrow">Rango global</span>
          <h2 id="rk-hero-titulo">Bloqueado</h2>
          <p>${vacio ? "Registra tu primer entrenamiento para empezar a ganar rangos." :
            `Te ${g.faltan === 1 ? "falta 1 ejercicio" : `faltan ${g.faltan} ejercicios`} con rango para desbloquear tu rango global.`}</p>
          <div class="rk-progreso" role="progressbar" aria-valuemin="0" aria-valuemax="${C.GLOBAL_MIN_EJERCICIOS}" aria-valuenow="${n}" aria-label="Ejercicios con rango">
            <span style="width:${(n / C.GLOBAL_MIN_EJERCICIOS * 100).toFixed(1)}%"></span>
          </div>
          <span class="rk-progreso-txt">${n} de ${C.GLOBAL_MIN_EJERCICIOS} ejercicios con rango</span>
          ${vacio ? `<a class="rk-btn" href="#gimnasio">Ir a entrenar</a>` : ""}
        </div>
      </section>`;
  }
  const n = nivel(g.nivel), sig = RE.NIVELES[g.nivel + 1];
  const avance = sig ? Math.max(0, Math.min(1, (g.P - n.min) / (sig.min - n.min))) : 1;
  return `
    <section class="rk-hero" aria-labelledby="rk-hero-titulo">
      <div class="rk-hero-badge">${insignia(g.nivel, 96)}</div>
      <div class="rk-hero-info">
        <span class="rk-eyebrow">Rango global</span>
        <h2 id="rk-hero-titulo">${n.nombre}</h2>
        <p>${RE.textoPercentil(g.P)}</p>
        <div class="rk-progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(avance * 100)}" aria-label="Avance hacia la siguiente división">
          <span style="width:${(avance * 100).toFixed(1)}%"></span>
        </div>
        <span class="rk-progreso-txt">${sig ? `${fmt(sig.min - g.P)} puntos de percentil para ${sig.nombre}` : "Estás en la cima"}</span>
        <span class="rk-nota">Calculado con ${fmt(bw)} kg de peso corporal · ${res.global.conRango} ejercicios con rango</span>
      </div>
    </section>`;
}

function cuerpoHtml() {
  return `
    <section class="rk-card" aria-labelledby="rk-cuerpo-t">
      <h2 id="rk-cuerpo-t">Tu cuerpo</h2>
      <p class="rk-sub">Cada músculo lleva el color de su rango. En gris, los que aún no tienen.</p>
      <div class="rk-figs">
        <div><svg class="figura rk-fig" viewBox="0 0 140 300" data-vista="frente" role="img" aria-label="Rangos por músculo, frente"></svg><span>Frente</span></div>
        <div><svg class="figura rk-fig" viewBox="0 0 140 300" data-vista="espalda" role="img" aria-label="Rangos por músculo, espalda"></svg><span>Espalda</span></div>
      </div>
      <p class="rk-hint">Toca un músculo para ver los ejercicios que lo forman.</p>
    </section>`;
}

const REGION_A_MUSCULO = {};
Object.keys(CFG.MUSCULOS).forEach(m => CFG.MUSCULOS[m].regiones.forEach(r => { REGION_A_MUSCULO[r] = m; }));

function pintarCuerpo() {
  app.querySelectorAll(".rk-fig").forEach(svg => {
    BodyFigures.dibujar(svg, BodyFigures[svg.dataset.vista]);
    const iris = CFG.RANGOS[CFG.RANGOS.length - 1].iridiscente;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `<linearGradient id="rk-iris-${svg.dataset.vista}" x1="0" y1="0" x2="1" y2="1">${iris.map((c, i) => `<stop offset="${i / (iris.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient>`;
    svg.insertBefore(defs, svg.firstChild);
    svg.querySelectorAll(".mz").forEach(g => {
      const m = REGION_A_MUSCULO[g.dataset.muscle];
      const info = m && res.musculos[m];
      const tinte = g.querySelector(".mz-tinte");
      if (info) {
        const r = nivel(info.nivel).rango;
        tinte.style.fill = r.iridiscente ? `url(#rk-iris-${svg.dataset.vista})` : r.color;
        g.setAttribute("data-rk", "con");
      } else {
        g.setAttribute("data-rk", m ? "sin" : "fuera");
      }
    });
  });
}

function gruposHtml() {
  const tiles = CFG.GRUPOS.map(g => {
    const info = res.grupos[g.id];
    const abierto = grupoAbierto === g.id;
    return `
      <button type="button" class="rk-grupo${abierto ? " is-open" : ""}" data-grupo="${g.id}" aria-expanded="${abierto}">
        ${insignia(info.nivel, 44)}
        <span class="rk-grupo-txt"><span class="n">${g.nombre}</span><span class="r">${info.nivel != null ? nivel(info.nivel).nombre : "Sin rango"}</span></span>
      </button>`;
  }).join("");
  let detalle = "";
  if (grupoAbierto) {
    const g = CFG.GRUPOS.find(x => x.id === grupoAbierto);
    detalle = `<ul class="rk-mini-lista">${g.musculos.map(m => {
      const info = res.musculos[m];
      return `<li><button type="button" class="rk-fila" data-musculo="${m}">
        ${insignia(info ? info.nivel : null, 32)}
        <span class="rk-fila-txt"><span class="n">${CFG.MUSCULOS[m].nombre}</span><span class="r">${info ? `${nivel(info.nivel).nombre} · ${textoCorto(info.P)}` : "Sin rango todavía"}</span></span>
        <span class="rk-chev" data-icon="chevronRight"></span></button></li>`;
    }).join("")}</ul>`;
  }
  return `
    <section class="rk-card" aria-labelledby="rk-grupos-t">
      <h2 id="rk-grupos-t">Grupos musculares</h2>
      <div class="rk-grupos">${tiles}</div>
      ${detalle}
    </section>`;
}

function gruposDeEjercicio(id) {
  const m = musculosDe(id);
  return CFG.GRUPOS.filter(g => g.musculos.some(x => m[x] >= C.IMPLICACION_PRIMARIO)).map(g => g.id);
}

const MOTIVOS = {
  sin_estandar: "Sin estándar: no está en el catálogo de rangos",
  sin_vincular: "Sin vincular: no reconocemos este nombre",
  sin_equivalente: "Marcado como sin equivalente",
  sin_series: "Sin series válidas todavía",
  pendiente: "Tiene series por confirmar"
};

function ejerciciosHtml() {
  const lista = Object.values(res.ejercicios).filter(e => e.tieneRango)
    .filter(e => filtro === "todos" || gruposDeEjercicio(e.id).includes(filtro))
    .sort((a, b) => b.P - a.P);
  const chips = [["todos", "Todos"]].concat(CFG.GRUPOS.map(g => [g.id, g.nombre])).map(([id, n]) =>
    `<button type="button" class="rk-chip${filtro === id ? " active" : ""}" data-filtro="${id}" aria-pressed="${filtro === id}">${n}</button>`).join("");
  const filas = lista.length ? lista.map(e => `
      <li><button type="button" class="rk-fila" data-ejercicio="${e.id}">
        ${insignia(e.nivel, 40)}
        <span class="rk-fila-txt"><span class="n">${escapeHtml(e.def.nombre)}</span><span class="r">${nivel(e.nivel).nombre} · ${textoCorto(e.P)}${e.estado === "bajando" ? ` · <span class="rk-inactivo">inactivo</span>` : e.estado === "protegido" ? " · protegido" : ""}</span></span>
        <span class="rk-chev" data-icon="chevronRight"></span></button></li>`).join("")
    : `<li class="rk-vacio">${filtro === "todos" ? "Todavía no tienes ejercicios con rango. Registra, por ejemplo, press de banca, sentadilla o dominadas." : "Ningún ejercicio con rango en este grupo todavía."}</li>`;

  // Sin rango: vinculados sin series válidas + no vinculados.
  const sin = [];
  Object.values(res.ejercicios).filter(e => !e.tieneRango).forEach(e => {
    sin.push({ clave: null, nombre: e.def.nombre, motivo: e.sospechosas.length ? "pendiente" : "sin_series", ejercicio: e.id });
  });
  res.sinRango.forEach(s => sin.push(s));
  const filasSin = sin.map(s => `
      <li class="rk-sin">
        <div class="rk-fila-txt">${insignia(null, 32)}<span><span class="n">${escapeHtml(s.nombre)}</span><span class="r">${MOTIVOS[s.motivo] || ""}${s.veces ? ` · ${s.veces} ${s.veces === 1 ? "vez" : "veces"}` : ""}</span></span></div>
        ${s.clave ? `<button type="button" class="rk-btn-sec" data-vincular="${escapeHtml(s.clave)}" data-nombre="${escapeHtml(s.nombre)}">Vincular</button>`
          : `<button type="button" class="rk-btn-sec" data-ejercicio="${s.ejercicio}">Ver</button>`}
      </li>`).join("");

  return `
    <section class="rk-card" aria-labelledby="rk-ej-t">
      <h2 id="rk-ej-t">Ejercicios</h2>
      <div class="rk-chips" role="group" aria-label="Filtrar por grupo">${chips}</div>
      <ul class="rk-lista">${filas}</ul>
      ${sin.length ? `<h3 class="rk-subtitulo">Sin rango</h3><ul class="rk-lista">${filasSin}</ul>` : ""}
    </section>`;
}

function escaleraHtml() {
  const g = res.global;
  const cuenta = {};
  Object.values(res.ejercicios).forEach(e => { if (e.tieneRango) cuenta[e.nivel] = (cuenta[e.nivel] || 0) + 1; });
  const filas = RE.NIVELES.slice().reverse().map(n => {
    const sig = RE.NIVELES[n.idx + 1];
    const franja = `${fmt(n.min)}–${sig ? fmt(sig.min) : "100"}`;
    const aqui = g.desbloqueado && g.nivel === n.idx;
    return `<li class="${aqui ? "is-aqui" : ""}">
      ${insignia(n.idx, 28)}
      <span class="n">${n.nombre}</span>
      <span class="p">P ${franja}</span>
      <span class="marcas">${aqui ? `<span class="rk-tag aqui">Tú</span>` : ""}${cuenta[n.idx] ? `<span class="rk-tag">${cuenta[n.idx]} ej.</span>` : ""}</span>
    </li>`;
  }).join("");
  return `
    <section class="rk-card" aria-labelledby="rk-esc-t">
      <h2 id="rk-esc-t">Escalera de rangos</h2>
      <p class="rk-sub">${g.desbloqueado ? "“Tú” marca tu rango global; “ej.” cuántos de tus ejercicios están en cada división." : "Cuando desbloquees tu rango global verás aquí dónde estás. “ej.” cuenta tus ejercicios en cada división."}</p>
      <ol class="rk-escalera">${filas}</ol>
    </section>`;
}

function comoHtml() {
  return `
    <details class="rk-card rk-como">
      <summary>Cómo funcionan tus rangos</summary>
      <div class="rk-como-txt">
        <p><b>Sin probar máximos.</b> Con tus series normales estimamos tu 1RM (fórmula de Epley) y lo ajustamos a tu peso corporal, como si pesaras ${C.REF_BW} kg, para comparar justo.</p>
        <p><b>Contra una tabla de referencia.</b> Ese número se compara con estándares de hombres que entrenan y da un percentil estimado. Cada rango tiene tres divisiones (I, II, III); Simétrico es el 1 % más fuerte.</p>
        <p><b>La constancia manda.</b> Tu nivel se mueve poco a poco hacia cada sesión: sube rápido cuando mejoras y un mal día apenas lo baja. Tras subir de división, las 2 sesiones siguientes no te la quitan.</p>
        <p><b>Si dejas un ejercicio.</b> Durante ${C.GRACE_DAYS} días no cambia nada. Después baja un 1 % por semana, sin bajar nunca del ${Math.round(C.FLOOR_RATIO * 100)} % de lo mejor que demostraste.</p>
        <p><b>De ejercicio a global.</b> Cada músculo promedia sus ejercicios (pesan más los que más haces), cada grupo a sus músculos, y el rango global se desbloquea con ${C.GLOBAL_MIN_EJERCICIOS} ejercicios con rango y premia un físico completo.</p>
      </div>
    </details>`;
}

// ---------- Hoja: músculo ----------
function hojaMusculo(m) {
  if (!CFG.MUSCULOS[m]) {
    abrirHoja(cabeceraHoja("Fuera de los rangos", "Este músculo no tiene rango") +
      `<p class="rk-texto">Los rangos miden ${Object.keys(CFG.MUSCULOS).length} músculos. Este lo sigues viendo en el mapa de Entrenamiento.</p>`);
    return;
  }
  const info = res.musculos[m];
  const g = grupoDeMusculo(m);
  let cuerpo;
  if (info) {
    cuerpo = `
      <div class="rk-hoja-top">${insignia(info.nivel, 72)}<div><b>${nivel(info.nivel).nombre}</b><span>${RE.textoPercentil(info.P)}</span></div></div>
      <h4 class="muscle-sheet-subtitle">Ejercicios que lo forman</h4>
      <ul class="rk-mini-lista">${info.aportes.map(a => {
        const e = res.ejercicios[a.id];
        return `<li><button type="button" class="rk-fila" data-ejercicio="${a.id}">
          ${insignia(e.nivel, 32)}
          <span class="rk-fila-txt"><span class="n">${escapeHtml(e.def.nombre)}</span><span class="r">${nivel(e.nivel).nombre} · ${a.implicacion >= 1 ? "principal" : "secundario"} · ${e.seriesRecientes} series en 90 días</span></span>
          <span class="rk-chev" data-icon="chevronRight"></span></button></li>`;
      }).join("")}</ul>`;
  } else {
    const sugeridos = Object.keys(CATALOGO).filter(id => (musculosDe(id)[m] || 0) >= C.IMPLICACION_PRIMARIO).map(id => CATALOGO[id].nombre);
    cuerpo = `<div class="rk-hoja-top">${insignia(null, 72)}<div><b>Sin rango todavía</b><span>Registra alguno de estos ejercicios para darle rango.</span></div></div>
      <ul class="rk-sugeridos">${sugeridos.map(n => `<li>${escapeHtml(n)}</li>`).join("") || "<li>No hay ejercicios del catálogo para este músculo.</li>"}</ul>`;
  }
  abrirHoja(cabeceraHoja(g ? g.nombre : "", CFG.MUSCULOS[m].nombre) + cuerpo);
}

// ---------- Hoja: ejercicio ----------
function unidadScore(fam) {
  return fam === "reps" ? "reps" : fam === "tiempo" ? "s" : "kg";
}

function graficoHtml(e) {
  const pts = e.puntos;
  if (!pts.length) return "";
  const W = 320, H = 170, m = { l: 36, r: 10, t: 12, b: 26 };
  const hoy = isoHoy();
  const x0 = pts[0].fecha, span = Math.max(1, RE.diasEntre(x0, hoy));
  const X = f => m.l + (W - m.l - m.r) * (RE.diasEntre(x0, f) / span);
  // Eje ajustado a los datos (una línea no necesita partir de cero) para que se vea el progreso.
  const valores = pts.map(p => p.score).concat(pts.map(p => p.L), [e.Lhoy], e.meta ? [e.meta.scoreNecesario] : []);
  const maxV = Math.max(...valores), minV = Math.min(...valores);
  const rango = Math.max(maxV - minV, maxV * 0.15, 1);
  const bruto = rango / 3;
  const paso = [1, 2, 2.5, 5, 10].map(s => s * Math.pow(10, Math.floor(Math.log10(bruto)))).find(s => s >= bruto) || bruto;
  const bajo = Math.max(0, Math.floor((minV - rango * 0.15) / paso) * paso);
  const top = Math.ceil((maxV + rango * 0.1) / paso) * paso;
  const Y = v => H - m.b - (H - m.t - m.b) * ((v - bajo) / (top - bajo));
  let grid = "";
  for (let v = bajo; v <= top + 1e-9; v += paso) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="rk-g-grid"/><text x="${m.l - 6}" y="${(Y(v) + 3.5).toFixed(1)}" class="rk-g-eje" text-anchor="end">${fmt(v, Number.isInteger(paso) ? 0 : 1)}</text>`;
  // Línea del nivel sostenido: escalones en cada sesión y hasta hoy con la inactividad.
  let d = "";
  pts.forEach((p, i) => { d += (i ? " L" : "M") + X(p.fecha).toFixed(1) + " " + Y(p.L).toFixed(1); });
  d += " L" + X(hoy).toFixed(1) + " " + Y(e.Lhoy).toFixed(1);
  const puntos = pts.map((p, i) => `<g class="rk-g-pt" data-i="${i}" tabindex="0" role="button" aria-label="${fechaCorta(p.fecha)}: sesión ${fmt(p.score)}, nivel ${fmt(p.L)}">
      <circle cx="${X(p.fecha).toFixed(1)}" cy="${Y(p.score).toFixed(1)}" r="12" class="rk-g-hit"/>
      <circle cx="${X(p.fecha).toFixed(1)}" cy="${Y(p.score).toFixed(1)}" r="4" class="rk-g-dot"/></g>`).join("");
  const metaLinea = e.meta ? `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(e.meta.scoreNecesario).toFixed(1)}" y2="${Y(e.meta.scoreNecesario).toFixed(1)}" class="rk-g-meta"/>
      <text x="${m.l + 4}" y="${(Y(e.meta.scoreNecesario) - 4).toFixed(1)}" class="rk-g-eje">Meta: ${e.meta.nivel.nombre}</text>` : "";
  const datos = JSON.stringify(pts.map(p => [fechaCorta(p.fecha), fmt(p.score), fmt(p.L)]));
  return `
    <div class="rk-grafico">
      <div class="rk-g-leyenda"><span><i class="k-linea"></i>Nivel sostenido</span><span><i class="k-punto"></i>Mejor serie de cada sesión</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="rk-g-svg" role="img" aria-label="Evolución de tu score (${unidadScore(e.def.familia)})" data-puntos='${escapeHtml(datos)}'>
        ${grid}${metaLinea}
        <path d="${d}" class="rk-g-linea"/>
        ${puntos}
        <text x="${m.l}" y="${H - 6}" class="rk-g-eje">${fechaCorta(x0)}</text>
        <text x="${W - m.r}" y="${H - 6}" class="rk-g-eje" text-anchor="end">Hoy</text>
      </svg>
      <p class="rk-g-tip" aria-live="polite">Toca un punto para ver la sesión.</p>
    </div>`;
}

function hojaEjercicio(id) {
  const e = res.ejercicios[id];
  if (!e) return;
  const def = e.def;
  const grupo = CFG.GRUPOS.find(g => g.id === gruposDeEjercicio(id)[0]);
  if (!e.tieneRango) {
    abrirHoja(cabeceraHoja(grupo ? grupo.nombre : "", def.nombre) +
      `<div class="rk-hoja-top">${insignia(null, 72)}<div><b>Sin rango todavía</b><span>${e.sospechosas.length ? "Tus series parecen un error de registro. Confírmalas si son correctas." : "Aún no hay series válidas de este ejercicio."}</span></div></div>` +
      sospechosasHtml(e));
    return;
  }
  const n = nivel(e.nivel);
  const fam = def.familia;
  const score = fam === "carga" || fam === "corporal"
    ? `Tu nivel equivale a <b>${fmt(e.Lhoy)} kg de 1RM</b> pesando ${C.REF_BW} kg.`
    : fam === "reps" ? `Tu nivel: <b>${fmt(e.Lhoy, 0)} reps</b> seguidas.` : `Tu nivel: <b>${fmt(e.Lhoy, 0)} segundos</b>.`;
  const meta = e.meta
    ? `<div class="rk-meta">${insignia(e.meta.nivel.idx, 36)}<div><span class="t">Para llegar a ${e.meta.nivel.nombre}</span><b>${e.meta.texto}${fam === "carga" && porMancuerna(id) ? " por mancuerna" : ""}</b></div></div>`
    : `<div class="rk-meta"><div><b>Estás en la cima: ${n.nombre}.</b></div></div>`;
  const estado = e.estado === "bajando" ? `<span class="rk-estado bajando">Bajando por inactividad · ${e.dias} días sin entrenarlo</span>`
    : e.estado === "protegido" ? `<span class="rk-estado protegido">Protegido · ${e.escudo === 1 ? "queda 1 sesión" : `quedan ${e.escudo} sesiones`}</span>`
    : `<span class="rk-estado">En margen (${e.diasMargen} ${e.diasMargen === 1 ? "día" : "días"})</span>`;
  abrirHoja(cabeceraHoja(grupo ? grupo.nombre : "", def.nombre, e.nombresUsados.length && e.nombresUsados[0] !== def.nombre ? `Registrado como: ${escapeHtml(e.nombresUsados.join(", "))}` : "") + `
    <div class="rk-hoja-top">${insignia(e.nivel, 96)}<div><b>${n.nombre}</b><span>Percentil ${fmt(e.P)} · ${RE.textoPercentil(e.P)}</span>${estado}</div></div>
    <p class="rk-texto">${score}</p>
    ${meta}
    ${graficoHtml(e)}
    ${sospechosasHtml(e)}`);
}

function sospechosasHtml(e) {
  if (!e.sospechosas.length) return "";
  const u = e.def.familia;
  const txt = s => u === "tiempo" ? `${s.seg} s` : u === "reps" ? `${s.reps} reps` :
    u === "corporal" ? `${s.asistencia ? "−" + s.asistencia : "+" + (s.kg || 0)} kg × ${s.reps}` : `${s.kg} kg × ${s.reps}`;
  return `<div class="rk-aviso">
    <b>${e.sospechosas.length === 1 ? "Hay 1 serie que parece un error de registro" : `Hay ${e.sospechosas.length} series que parecen un error de registro`}</b>
    <p>${e.sospechosas.length === 1 ? "No cuenta hasta que la confirmes." : "No cuentan hasta que las confirmes."}</p>
    <ul>${e.sospechosas.map(s => `<li><span>${fechaCorta(s.fecha)} · ${txt(s)}</span><button type="button" class="rk-btn-sec" data-confirmar="${escapeHtml(s.key)}" data-ej="${e.id}">Es correcta</button></li>`).join("")}</ul>
  </div>`;
}

// ---------- Hoja: vincular ----------
function hojaVincular(clave, nombre) {
  const grupos = CFG.GRUPOS.map(g => {
    const ids = Object.keys(CATALOGO).filter(id => gruposDeEjercicio(id)[0] === g.id);
    if (!ids.length) return "";
    return `<h4 class="muscle-sheet-subtitle">${g.nombre}</h4><ul class="rk-mini-lista">${ids.map(id =>
      `<li><button type="button" class="rk-fila" data-elegir="${id}" data-clave="${escapeHtml(clave)}"><span class="rk-fila-txt"><span class="n">${escapeHtml(CATALOGO[id].nombre)}</span></span></button></li>`).join("")}</ul>`;
  }).join("");
  abrirHoja(cabeceraHoja("Vincular", nombre, "Elige su equivalente del catálogo de rangos") + `
    <button type="button" class="rk-btn-sec rk-ninguno" data-elegir="${NINGUNO}" data-clave="${escapeHtml(clave)}">No tiene equivalente</button>
    ${grupos}`);
}

function guardarVinculo(clave, id) {
  EjercicioDatos.meta("rangos_vinculos").set({ vinculos: { [clave]: id } }, { merge: true })
    .catch(err => console.error("No se pudo guardar el vínculo", err));
}

// ---------- Aviso "Nuevos rangos" ----------
function etiquetaClave(k) {
  if (k === "global") return { tipo: "Rango global", nombre: "Tu rango global" };
  const [t, id] = k.split(":");
  if (t === "ej") return { tipo: "Ejercicio", nombre: CATALOGO[id] ? CATALOGO[id].nombre : id };
  if (t === "mu") return { tipo: "Músculo", nombre: CFG.MUSCULOS[id] ? CFG.MUSCULOS[id].nombre : id };
  const g = CFG.GRUPOS.find(x => x.id === id);
  return { tipo: "Grupo", nombre: g ? g.nombre : id };
}

function guardarSnapshot(niveles) {
  EjercicioDatos.meta("rangos_snapshot").set({ niveles, actualizado: Date.now() })
    .catch(err => console.error("No se pudo guardar el snapshot de rangos", err));
}

function mostrarAviso(ups, niveles) {
  avisoAbierto = true;
  const modal = document.createElement("div");
  modal.className = "rk-aviso-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "rk-aviso-t");
  const filas = ups.slice(0, 12).map((u, i) => {
    const et = etiquetaClave(u.clave);
    const cambio = u.clave === "global" && u.antes == null ? `Desbloqueado: ${nivel(u.despues).nombre}`
      : u.antes == null ? `Nuevo: ${nivel(u.despues).nombre}` : `${nivel(u.antes).nombre} → ${nivel(u.despues).nombre}`;
    return `<li style="--i:${i}"><span class="rk-sube-badge">${insignia(u.despues, 56)}</span>
      <span class="rk-fila-txt"><span class="r">${et.tipo}</span><span class="n">${escapeHtml(et.nombre)}</span><span class="c">${cambio}</span></span></li>`;
  }).join("");
  modal.innerHTML = `
    <div class="rk-aviso-panel">
      <span class="rk-eyebrow">¡Buen entrenamiento!</span>
      <h2 id="rk-aviso-t">Nuevos rangos</h2>
      <ul class="rk-sube">${filas}</ul>
      ${ups.length > 12 ? `<p class="rk-sub">Y ${ups.length - 12} más.</p>` : ""}
      <button type="button" class="rk-btn" data-continuar>Continuar</button>
    </div>`;
  document.body.appendChild(modal);
  document.body.classList.add("sheet-open");
  const cerrar = () => {
    guardarSnapshot(niveles);
    modal.classList.add("closing");
    document.body.classList.remove("sheet-open");
    setTimeout(() => { modal.remove(); avisoAbierto = false; }, 220);
  };
  modal.querySelector("[data-continuar]").addEventListener("click", cerrar);
  modal.querySelector("[data-continuar]").focus();
}

function revisarAviso() {
  const st = EjercicioDatos.estado;
  if (st.snapshotRangos === undefined || !st.cargado.base || !res) return;
  const actual = RE.nivelesDe(res);
  // Primera vez: se guarda el estado actual sin aviso.
  if (st.snapshotRangos === null) { guardarSnapshot(actual); st.snapshotRangos = { niveles: actual }; return; }
  if (!esperandoAviso || avisoAbierto) return;
  const ups = RE.subidas(st.snapshotRangos.niveles || {}, actual);
  if (ups.length) {
    esperandoAviso = 0;
    mostrarAviso(ups, actual);
  } else if (Date.now() > esperandoAviso) {
    esperandoAviso = 0;
    guardarSnapshot(actual); // sin subidas: registra el estado (también las bajadas)
  }
}

document.addEventListener("entreno:guardado", () => {
  esperandoAviso = Date.now() + 6000;
  setTimeout(revisarAviso, 6100);
});

// ---------- Eventos ----------
function onClickHoja(e) {
  if (e.target.closest("[data-cerrar]")) { cerrarHoja(); return; }
  const ej = e.target.closest("[data-ejercicio]");
  if (ej) { hojaEjercicio(ej.dataset.ejercicio); return; }
  const elegir = e.target.closest("[data-elegir]");
  if (elegir) { guardarVinculo(elegir.dataset.clave, elegir.dataset.elegir); cerrarHoja(); return; }
  const conf = e.target.closest("[data-confirmar]");
  if (conf) {
    EjercicioDatos.meta("rangos_vinculos").set({ confirmadas: { [conf.dataset.confirmar]: true } }, { merge: true });
    conf.closest("li").remove();
    return;
  }
  const pt = e.target.closest(".rk-g-pt");
  if (pt) {
    const svg = pt.closest("svg");
    const [f, s, l] = JSON.parse(svg.dataset.puntos)[Number(pt.dataset.i)];
    svg.querySelectorAll(".rk-g-pt.is-on").forEach(x => x.classList.remove("is-on"));
    pt.classList.add("is-on");
    svg.parentElement.querySelector(".rk-g-tip").textContent = `${f}: mejor serie ${s} · nivel sostenido ${l}`;
  }
}

if (app) {
  app.addEventListener("click", e => {
    const f = e.target.closest("[data-filtro]");
    if (f) { filtro = f.dataset.filtro; render(); return; }
    const g = e.target.closest("[data-grupo]");
    if (g) { grupoAbierto = grupoAbierto === g.dataset.grupo ? null : g.dataset.grupo; render(); return; }
    const mu = e.target.closest("[data-musculo]");
    if (mu) { hojaMusculo(mu.dataset.musculo); return; }
    const region = e.target.closest(".rk-fig .mz");
    if (region) { hojaMusculo(REGION_A_MUSCULO[region.dataset.muscle] || region.dataset.muscle); return; }
    const ej = e.target.closest("[data-ejercicio]");
    if (ej) { hojaEjercicio(ej.dataset.ejercicio); return; }
    const vin = e.target.closest("[data-vincular]");
    if (vin) hojaVincular(vin.dataset.vincular, vin.dataset.nombre);
  });
}

EjercicioDatos.onCambio(() => {
  calcular();
  render();
  revisarAviso();
});

if (panel) {
  new MutationObserver(() => { if (panel.hidden) cerrarHoja(); else render(); })
    .observe(panel, { attributes: true, attributeFilter: ["hidden"] });
}

window.Rangos = { calcular: () => res || calcular(), render, pesoEn };
})();
