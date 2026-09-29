// ---------- Radar "Distribución muscular" + tarjetas + top 5 ----------
// Compara la semana que se ve en el mapa (acento) con la anterior (gris) en
// 6 ejes. Volumen o Series según el selector. Tocar un eje muestra sus
// músculos en barras. Debajo: tarjetas con el cambio vs la semana anterior
// y los 5 ejercicios con más volumen. Se recalcula solo cuando cambian los
// datos (EjercicioDatos) o la semana del mapa.
(function () {

const NS = "http://www.w3.org/2000/svg";
const CX = 160, CY = 122, R = 84;
const ANGULO = { espalda: 120, pecho: 60, core: 0, hombros: -60, brazos: -120, piernas: 180 };

let metrica = "volumen";
let grupoAbierto = null;
let ultimos = { actual: null, anterior: null };
let animacion = null;

const seccion = document.getElementById("radar-section");
const svg = document.getElementById("radar-svg");

// ---- Utilidades ----
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function semana(offset) {
  const ini = new Date();
  ini.setHours(0, 0, 0, 0);
  ini.setDate(ini.getDate() - (ini.getDay() + 6) % 7 + offset * 7);
  const fin = new Date(ini);
  fin.setDate(ini.getDate() + 6);
  const fmt = d => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  return { desde: isoDate(ini), hasta: isoDate(fin), label: `${fmt(ini)} – ${fmt(fin)}` };
}
function fmtNum(n, dec) {
  const r = dec ? Math.round(n * 10) / 10 : Math.round(n);
  const [ent, fr] = String(Math.abs(r)).split(".");
  return (r < 0 ? "-" : "") + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fr ? "," + fr : "");
}
function fmtMin(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + " min" : ""}`.trim();
}
function fmtValor(v) {
  return metrica === "volumen" ? fmtNum(v) + " kg" : fmtNum(v, true) + " series";
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function el(tag, attrs, texto) {
  const e = document.createElementNS(NS, tag);
  Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
  if (texto != null) e.textContent = texto;
  return e;
}
function punto(angulo, radio) {
  const a = angulo * Math.PI / 180;
  return [CX + radio * Math.cos(a), CY - radio * Math.sin(a)];
}
function puntos(valores, max) {
  return MuscleEngine.GRUPOS.map((g, i) => punto(ANGULO[g.id], max ? R * Math.min(1, valores[i] / max) : 0))
    .map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
}

// ---- Dibujo base (rejilla, ejes, zonas táctiles). Se hace una vez. ----
function dibujarBase() {
  svg.innerHTML = "";
  const rejilla = el("g", { class: "radar-grid" });
  [0.25, 0.5, 0.75, 1].forEach(f => {
    rejilla.appendChild(el("polygon", { points: MuscleEngine.GRUPOS.map(g => punto(ANGULO[g.id], R * f).join(",")).join(" ") }));
  });
  MuscleEngine.GRUPOS.forEach(g => {
    const [x, y] = punto(ANGULO[g.id], R);
    rejilla.appendChild(el("line", { x1: CX, y1: CY, x2: x, y2: y }));
  });
  svg.appendChild(rejilla);

  svg.appendChild(el("polygon", { class: "radar-area anterior", id: "radar-anterior", points: puntos([0, 0, 0, 0, 0, 0], 1) }));
  svg.appendChild(el("polygon", { class: "radar-area actual", id: "radar-actual", points: puntos([0, 0, 0, 0, 0, 0], 1) }));
  svg.appendChild(el("g", { id: "radar-vertices" }));

  MuscleEngine.GRUPOS.forEach(g => {
    const a = ANGULO[g.id];
    const [lx, ly] = punto(a, R + 18);
    const ancla = Math.abs(a) === 90 ? "middle" : Math.cos(a * Math.PI / 180) > 0.1 ? "start" : Math.cos(a * Math.PI / 180) < -0.1 ? "end" : "middle";
    const ajusteY = Math.sin(a * Math.PI / 180) > 0.1 ? -2 : Math.sin(a * Math.PI / 180) < -0.1 ? 10 : 4;
    svg.appendChild(el("text", { class: "radar-label", x: lx.toFixed(1), y: (ly + ajusteY).toFixed(1), "text-anchor": ancla, "data-grupo": g.id }, g.nombre));
    // Zona táctil: el sector de ±30° alrededor del eje, hasta la etiqueta.
    const p1 = punto(a - 30, R + 34), p2 = punto(a, R + 40), p3 = punto(a + 30, R + 34);
    svg.appendChild(el("polygon", {
      class: "radar-hit", "data-grupo": g.id, role: "button", tabindex: "0", "aria-label": "Ver músculos de " + g.nombre,
      points: [[CX, CY], p1, p2, p3].map(p => p.join(",")).join(" ")
    }));
  });
}

// Anima las áreas desde los valores anteriores a los nuevos.
function animarAreas(actual, anterior, max) {
  const desde = ultimos.actual && ultimos.max ? { a: ultimos.actual, b: ultimos.anterior, max: ultimos.max } : { a: actual.map(() => 0), b: anterior.map(() => 0), max };
  ultimos = { actual, anterior, max };
  cancelAnimationFrame(animacion);
  const t0 = performance.now(), dur = 450;
  const polyA = document.getElementById("radar-actual"), polyB = document.getElementById("radar-anterior");
  const reducir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const paso = t => {
    const k = reducir ? 1 : Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    // Interpola en proporción del radio para que un cambio de escala no salte.
    const mezcla = (va, vb) => va.map((v, i) => (v / desde.max) * (1 - e) + (vb[i] / max) * e);
    polyA.setAttribute("points", puntos(mezcla(desde.a, actual), 1));
    polyB.setAttribute("points", puntos(mezcla(desde.b, anterior), 1));
    if (k < 1) animacion = requestAnimationFrame(paso);
    else dibujarVertices(actual, max);
  };
  document.getElementById("radar-vertices").innerHTML = "";
  animacion = requestAnimationFrame(paso);
}

function dibujarVertices(actual, max) {
  const vertices = document.getElementById("radar-vertices");
  vertices.innerHTML = "";
  MuscleEngine.GRUPOS.forEach((g, i) => {
    if (!actual[i]) return;
    const [x, y] = punto(ANGULO[g.id], R * Math.min(1, actual[i] / max));
    vertices.appendChild(el("circle", { class: "radar-vertex", cx: x.toFixed(1), cy: y.toFixed(1), r: 3 }));
  });
}

// ---- Render ----
function render() {
  if (!seccion) return;
  const st = EjercicioDatos.estado;
  const offset = window.BodyMap ? BodyMap.semana().offset : 0;
  const act = semana(offset), ant = semana(offset - 1);
  document.getElementById("radar-sub").textContent = `Semana ${act.label} · comparada con la anterior`;
  if (!st.datos) return;

  const cfg = EjercicioDatos.config();
  const fa = MuscleEngine.filtrar(st.datos, act.desde, act.hasta);
  const fb = MuscleEngine.filtrar(st.datos, ant.desde, ant.hasta);
  const ga = MuscleEngine.calcularGrupos(fa.entradas, cfg);
  const gb = MuscleEngine.calcularGrupos(fb.entradas, cfg);
  const va = MuscleEngine.GRUPOS.map(g => ga[g.id][metrica]);
  const vb = MuscleEngine.GRUPOS.map(g => gb[g.id][metrica]);
  const max = Math.max(...va, ...vb) * 1.12 || 1;
  animarAreas(va, vb, max);
  seccion.classList.toggle("is-empty", !fa.entradas.length && !fb.entradas.length);

  svg.querySelectorAll("[data-grupo]").forEach(n => n.classList.toggle("is-selected", n.dataset.grupo === grupoAbierto));
  renderDetalle(fa, fb, cfg);
  renderTarjetas(fa, fb, cfg);
  renderTop(fa, cfg);
}

function renderDetalle(fa, fb, cfg) {
  const caja = document.getElementById("radar-detail");
  if (!grupoAbierto) { caja.hidden = true; return; }
  const grupo = MuscleEngine.GRUPOS.find(g => g.id === grupoAbierto);
  const ma = MuscleEngine.calcularMusculos(fa.entradas, cfg);
  const mb = MuscleEngine.calcularMusculos(fb.entradas, cfg);
  const musculos = MuscleEngine.MUSCULOS.filter(m => m.grupo === grupoAbierto);
  const valor = (c, id) => (c[id] ? c[id][metrica] : 0);
  const max = Math.max(1, ...musculos.map(m => Math.max(valor(ma, m.id), valor(mb, m.id))));
  caja.innerHTML = `
    <div class="radar-detail-head">
      <h3>${grupo.nombre}</h3>
      <button type="button" class="link-btn" data-cerrar-detalle>Cerrar</button>
    </div>
    ${musculos.map(m => {
      const a = valor(ma, m.id), b = valor(mb, m.id);
      return `
      <div class="radar-bar-row">
        <div class="radar-bar-top"><span>${m.nombre}</span><span class="v">${fmtValor(a)}</span></div>
        <div class="radar-bar-track">
          <div class="radar-bar actual" style="width:${ancho(a, max)}%"></div>
          <div class="radar-bar anterior" style="width:${ancho(b, max)}%"></div>
        </div>
      </div>`;
    }).join("")}
    <p class="radar-detail-note">Barra de color: esta semana · gris: la anterior</p>`;
  caja.hidden = false;
}

// Barra proporcional; un valor chico pero no nulo se ve igual (mínimo 2 %).
function ancho(v, max) {
  return v > 0 ? Math.max(2, v / max * 100).toFixed(1) : "0";
}

function delta(actual, anterior, formato) {
  const d = actual - anterior;
  if (Math.abs(d) < 1e-9) return `<span class="radar-delta igual">= igual</span>`;
  const clase = d > 0 ? "sube" : "baja";
  return `<span class="radar-delta ${clase}">${d > 0 ? "↑" : "↓"} ${formato(Math.abs(d))}</span>`;
}

function renderTarjetas(fa, fb, cfg) {
  const a = MuscleEngine.resumen(fa.sesiones, fa.entradas, cfg);
  const b = MuscleEngine.resumen(fb.sesiones, fb.entradas, cfg);
  const tarjeta = (titulo, va, vb, fmt, unidad) => `
    <div class="radar-card">
      <span class="t">${titulo}</span>
      <span class="v">${unidad ? fmtNum(va) + `<small>${unidad}</small>` : fmt(va)}</span>
      ${delta(va, vb, fmt)}
    </div>`;
  document.getElementById("radar-cards").innerHTML = [
    tarjeta("Entrenamientos", a.entrenamientos, b.entrenamientos, v => String(v)),
    tarjeta("Duración", a.duracion, b.duracion, fmtMin),
    tarjeta("Volumen", a.volumen, b.volumen, v => fmtNum(v) + " kg", "kg"),
    tarjeta("Series", a.series, b.series, v => fmtNum(v, true))
  ].join("");
}

function renderTop(fa, cfg) {
  const top = MuscleEngine.topEjercicios(fa.entradas, cfg, 5);
  document.getElementById("radar-top").innerHTML = top.length
    ? top.map(t => {
        const detalle = t.tipo === "cardio"
          ? `${fmtMin(t.minutos)} · ${t.veces} ${t.veces === 1 ? "sesión" : "sesiones"}`
          : `${fmtNum(t.series, true)} series · ${fmtNum(t.volumen)} kg`;
        return `<li><span class="n">${escapeHtml(t.nombre)}</span><span class="m">${detalle}</span></li>`;
      }).join("")
    : `<li class="vacio">Todavía no hay ejercicios esta semana.</li>`;
}

// ---- Eventos ----
dibujarBase();

document.getElementById("radar-tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-metrica]");
  if (!b || b.dataset.metrica === metrica) return;
  metrica = b.dataset.metrica;
  document.querySelectorAll("#radar-tabs [data-metrica]").forEach(x => {
    x.classList.toggle("active", x === b);
    x.setAttribute("aria-selected", String(x === b));
  });
  render();
});

function elegirGrupo(id) {
  grupoAbierto = grupoAbierto === id ? null : id;
  render();
}
svg.addEventListener("click", e => {
  const g = e.target.closest("[data-grupo]");
  if (g) elegirGrupo(g.dataset.grupo);
});
svg.addEventListener("keydown", e => {
  const g = e.target.closest("[data-grupo]");
  if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); elegirGrupo(g.dataset.grupo); }
});
document.getElementById("radar-detail").addEventListener("click", e => {
  if (e.target.closest("[data-cerrar-detalle]")) { grupoAbierto = null; render(); }
});

EjercicioDatos.onCambio(render);
document.addEventListener("bodymap:semana", render);
render();
})();
