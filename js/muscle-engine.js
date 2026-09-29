// ---------- Motor muscular (lógica pura, sin DOM ni Firebase) ----------
// Convierte entrenamientos en números por músculo y por grupo: volumen,
// series efectivas, días trabajados, RPE promedio. Lo usan el mapa
// corporal, el radar y los tests (node --test). Las fórmulas están
// documentadas en docs/mapa-muscular.md; las constantes se pueden cambiar
// desde Ajustes (se mezclan con DEFAULTS).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MuscleEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {

// 21 regiones. "vista" indica en qué figura del mapa se dibuja.
const MUSCULOS = [
  { id: "pecho_superior", nombre: "Pecho superior", grupo: "pecho", vista: "frente" },
  { id: "pecho_medio", nombre: "Pecho medio", grupo: "pecho", vista: "frente" },
  { id: "pecho_inferior", nombre: "Pecho inferior", grupo: "pecho", vista: "frente" },
  { id: "dorsales", nombre: "Dorsales", grupo: "espalda", vista: "espalda" },
  { id: "espalda_media", nombre: "Espalda media", grupo: "espalda", vista: "espalda" },
  { id: "trapecio", nombre: "Trapecio", grupo: "espalda", vista: "ambas" },
  { id: "lumbares", nombre: "Lumbares", grupo: "espalda", vista: "espalda" },
  { id: "deltoide_anterior", nombre: "Deltoide anterior", grupo: "hombros", vista: "frente" },
  { id: "deltoide_lateral", nombre: "Deltoide lateral", grupo: "hombros", vista: "ambas" },
  { id: "deltoide_posterior", nombre: "Deltoide posterior", grupo: "hombros", vista: "espalda" },
  { id: "biceps", nombre: "Bíceps", grupo: "brazos", vista: "frente" },
  { id: "triceps", nombre: "Tríceps", grupo: "brazos", vista: "espalda" },
  { id: "antebrazos", nombre: "Antebrazos", grupo: "brazos", vista: "ambas" },
  { id: "abdominales", nombre: "Abdominales", grupo: "core", vista: "frente" },
  { id: "oblicuos", nombre: "Oblicuos", grupo: "core", vista: "frente" },
  { id: "cuadriceps", nombre: "Cuádriceps", grupo: "piernas", vista: "frente" },
  { id: "isquiotibiales", nombre: "Isquiotibiales", grupo: "piernas", vista: "espalda" },
  { id: "gluteos", nombre: "Glúteos", grupo: "piernas", vista: "espalda" },
  { id: "aductores", nombre: "Aductores", grupo: "piernas", vista: "frente" },
  { id: "abductores", nombre: "Abductores", grupo: "piernas", vista: "ambas" },
  { id: "pantorrillas", nombre: "Pantorrillas", grupo: "piernas", vista: "ambas" }
];

// Orden de los ejes del radar (en sentido horario, empezando arriba a la izquierda).
const GRUPOS = [
  { id: "espalda", nombre: "Espalda" },
  { id: "pecho", nombre: "Pecho" },
  { id: "core", nombre: "Core" },
  { id: "hombros", nombre: "Hombros" },
  { id: "brazos", nombre: "Brazos" },
  { id: "piernas", nombre: "Piernas" }
];

const TIPOS = ["carga", "peso_corporal", "cardio", "isometrico"];

const DEFAULTS = {
  pesoCorporal: 70,          // kg, editable en Ajustes
  pesoPrimario: 1,           // % del volumen que recibe un músculo primario
  pesoSecundario: 0.5,       // % del volumen que recibe un músculo secundario
  seriePrimaria: 1,          // series efectivas por serie real (primario)
  serieSecundaria: 0.5,      // series efectivas por serie real (secundario)
  cardioK: 10,               // volumen de cardio/isométrico = minutos × RPE × cardioK
  rpePorDefecto: 6,          // si no se anotó RPE
  minutosPorSerieCardio: 10, // 1 serie efectiva de cardio cada X minutos
  umbrales: [4, 10]          // series efectivas: >0 → nivel 1, ≥4 → nivel 2, ≥10 → nivel 3
};

const MUSCULO_POR_ID = {};
MUSCULOS.forEach(m => { MUSCULO_POR_ID[m.id] = m; });

function config(parcial) {
  const c = Object.assign({}, DEFAULTS, parcial || {});
  if (!Array.isArray(c.umbrales) || c.umbrales.length < 2) c.umbrales = DEFAULTS.umbrales.slice();
  return c;
}

function num(v) {
  const n = Number(v);
  return isFinite(n) && n > 0 ? n : 0;
}

// Volumen de una serie. Si tiene repeticiones se calcula por peso; si solo
// tiene segundos (isométricos, o una caminata del granjero) se calcula por
// tiempo, igual que el cardio.
function volumenSerie(serie, ejercicio, cfg, rpe) {
  const reps = num(serie.reps);
  if (reps > 0) {
    if (ejercicio.tipo === "peso_corporal") {
      const carga = cfg.pesoCorporal * num(ejercicio.factorPesoCorporal) + num(serie.lastre) + num(serie.kg);
      return carga * reps;
    }
    return num(serie.kg) * reps;
  }
  const seg = num(serie.seg);
  if (seg > 0) return (seg / 60) * rpe * cfg.cardioK;
  return 0;
}

function serieValida(serie) {
  return num(serie.reps) > 0 || num(serie.seg) > 0;
}

// Volumen y series de un ejercicio dentro de un entrenamiento.
function cargaEjercicio(entrada, cfg) {
  cfg = cfg || DEFAULTS;
  const ej = entrada.ejercicio;
  const rpe = num(entrada.rpe) || cfg.rpePorDefecto;
  const series = entrada.series || [];

  if (ej.tipo === "cardio") {
    const minutos = num(entrada.minutos) || series.reduce((s, x) => s + num(x.min) + num(x.seg) / 60, 0);
    return { volumen: minutos * rpe * cfg.cardioK, series: minutos / cfg.minutosPorSerieCardio, minutos };
  }

  const validas = series.filter(serieValida);
  let volumen = validas.reduce((s, x) => s + volumenSerie(x, ej, cfg, rpe), 0);
  let n = validas.length;
  // Isométrico anotado solo con minutos totales (sin series).
  if (!n && num(entrada.minutos) > 0) {
    volumen = num(entrada.minutos) * rpe * cfg.cardioK;
    n = 1;
  }
  return { volumen, series: n };
}

function rolesDe(ejercicio) {
  const roles = {};
  (ejercicio.secundarios || []).forEach(m => { if (MUSCULO_POR_ID[m]) roles[m] = "secundario"; });
  (ejercicio.primarios || []).forEach(m => { if (MUSCULO_POR_ID[m]) roles[m] = "primario"; });
  return roles;
}

function nuevoMusculo() {
  return { series: 0, volumen: 0, seriesPrimario: 0, dias: new Set(), ejercicios: {}, rpeSuma: 0, rpeN: 0 };
}

// Por músculo: primarios reciben 100 % del volumen y 1 serie efectiva por
// serie; secundarios 50 % y 0,5 (constantes en cfg).
function calcularMusculos(entradas, cfgParcial) {
  const cfg = config(cfgParcial);
  const acc = {};
  (entradas || []).forEach(e => {
    const { volumen, series } = cargaEjercicio(e, cfg);
    const roles = rolesDe(e.ejercicio);
    Object.keys(roles).forEach(m => {
      const primario = roles[m] === "primario";
      const v = volumen * (primario ? cfg.pesoPrimario : cfg.pesoSecundario);
      const s = series * (primario ? cfg.seriePrimaria : cfg.serieSecundaria);
      const st = acc[m] || (acc[m] = nuevoMusculo());
      st.series += s;
      st.volumen += v;
      if (primario) st.seriesPrimario += s;
      if (e.fecha) st.dias.add(e.fecha);
      if (num(e.rpe) > 0) { st.rpeSuma += num(e.rpe); st.rpeN++; }
      const id = e.ejercicio.id;
      const ex = st.ejercicios[id] || (st.ejercicios[id] = { id, nombre: e.ejercicio.nombre, rol: roles[m], series: 0, volumen: 0 });
      ex.series += s;
      ex.volumen += v;
    });
  });

  const out = {};
  Object.keys(acc).forEach(m => {
    const st = acc[m];
    out[m] = {
      id: m,
      nombre: MUSCULO_POR_ID[m].nombre,
      grupo: MUSCULO_POR_ID[m].grupo,
      series: st.series,
      volumen: st.volumen,
      dias: Array.from(st.dias).sort(),
      soloSecundario: st.series > 0 && st.seriesPrimario === 0,
      rpe: st.rpeN ? st.rpeSuma / st.rpeN : null,
      nivel: nivel(st.series, cfg),
      ejercicios: Object.values(st.ejercicios).sort((a, b) =>
        (a.rol === b.rol ? 0 : a.rol === "primario" ? -1 : 1) || b.volumen - a.volumen)
    };
  });
  return out;
}

// Por grupo (radar): cada ejercicio suma a cada grupo una sola vez, con el
// mayor peso entre sus músculos de ese grupo. Así una sentadilla (cuádriceps
// primario + glúteos e isquios secundarios) cuenta 1 vez para Piernas, no 2.
function calcularGrupos(entradas, cfgParcial) {
  const cfg = config(cfgParcial);
  const out = {};
  GRUPOS.forEach(g => { out[g.id] = { id: g.id, nombre: g.nombre, volumen: 0, series: 0 }; });
  (entradas || []).forEach(e => {
    const { volumen, series } = cargaEjercicio(e, cfg);
    const roles = rolesDe(e.ejercicio);
    const mejor = {}; // grupo -> "primario" | "secundario"
    Object.keys(roles).forEach(m => {
      const g = MUSCULO_POR_ID[m].grupo;
      if (roles[m] === "primario") mejor[g] = "primario";
      else if (!mejor[g]) mejor[g] = "secundario";
    });
    Object.keys(mejor).forEach(g => {
      const primario = mejor[g] === "primario";
      out[g].volumen += volumen * (primario ? cfg.pesoPrimario : cfg.pesoSecundario);
      out[g].series += series * (primario ? cfg.seriePrimaria : cfg.serieSecundaria);
    });
  });
  return out;
}

function nivel(series, cfgParcial) {
  const cfg = cfgParcial && cfgParcial.umbrales ? cfgParcial : config(cfgParcial);
  if (!(series > 0)) return 0;
  if (series >= cfg.umbrales[1]) return 3;
  if (series >= cfg.umbrales[0]) return 2;
  return 1;
}

// Totales para las tarjetas: entrenamientos, duración, volumen y series.
function resumen(sesiones, entradas, cfgParcial) {
  const cfg = config(cfgParcial);
  let volumen = 0, series = 0;
  (entradas || []).forEach(e => {
    const c = cargaEjercicio(e, cfg);
    volumen += c.volumen;
    series += c.series;
  });
  return {
    entrenamientos: (sesiones || []).length,
    duracion: (sesiones || []).reduce((s, x) => s + num(x.duracionMin), 0),
    volumen,
    series
  };
}

function topEjercicios(entradas, cfgParcial, n) {
  const cfg = config(cfgParcial);
  const acc = {};
  (entradas || []).forEach(e => {
    const c = cargaEjercicio(e, cfg);
    const id = e.ejercicio.id;
    const it = acc[id] || (acc[id] = { id, nombre: e.ejercicio.nombre, volumen: 0, series: 0, veces: 0 });
    it.volumen += c.volumen;
    it.series += c.series;
    it.veces++;
  });
  return Object.values(acc)
    .sort((a, b) => b.volumen - a.volumen || b.series - a.series || a.nombre.localeCompare(b.nombre))
    .slice(0, n || 5);
}

function cambio(actual, anterior) {
  const delta = (actual || 0) - (anterior || 0);
  return { delta, pct: anterior ? delta / anterior : null };
}

// ---- Adaptador: registros guardados → entradas del motor ----
// registros = { gimnasio: [...], running: [...], bicicleta: [...] } tal como
// vienen de Firestore. resolver(nombre, idGuardado) devuelve la ficha del
// ejercicio o null. Los nombres que no se reconocen se juntan en noReconocidos.
const ID_CORRER = "manolo-correr";
const ID_BICICLETA = "bicycling";

function desdeRegistros(registros, resolver) {
  const sesiones = [];
  const entradas = [];
  const faltan = {};
  const r = registros || {};

  (r.gimnasio || []).forEach(w => {
    if (!w || !w.date) return;
    sesiones.push({ id: w.id, fecha: w.date, tipo: "gimnasio", duracionMin: num(w.durationMin) });
    (w.exercises || []).forEach(ex => {
      const ficha = resolver(ex.name, ex.exerciseId);
      if (!ficha) {
        const k = (ex.name || "").trim();
        if (k) faltan[k] = (faltan[k] || 0) + 1;
        return;
      }
      entradas.push({
        fecha: w.date,
        sesionId: w.id,
        ejercicio: ficha,
        series: ex.sets || [],
        minutos: num(ex.minutos),
        rpe: num(ex.rpe) || null
      });
    });
  });

  [["running", ID_CORRER], ["bicicleta", ID_BICICLETA]].forEach(([clave, id]) => {
    (r[clave] || []).forEach(x => {
      if (!x || !x.date) return;
      sesiones.push({ id: x.id, fecha: x.date, tipo: clave, duracionMin: num(x.duration) });
      const ficha = resolver(null, id);
      if (!ficha) return;
      entradas.push({ fecha: x.date, sesionId: x.id, ejercicio: ficha, series: [], minutos: num(x.duration), rpe: num(x.rpe) || null });
    });
  });

  const noReconocidos = Object.keys(faltan).sort().map(nombre => ({ nombre, veces: faltan[nombre] }));
  return { sesiones, entradas, noReconocidos };
}

function enRango(fecha, desde, hasta) {
  return !!fecha && fecha >= desde && fecha <= hasta;
}

function filtrar(datos, desde, hasta) {
  return {
    sesiones: datos.sesiones.filter(s => enRango(s.fecha, desde, hasta)),
    entradas: datos.entradas.filter(e => enRango(e.fecha, desde, hasta))
  };
}

return {
  MUSCULOS, GRUPOS, TIPOS, DEFAULTS, MUSCULO_POR_ID, ID_CORRER, ID_BICICLETA,
  config, volumenSerie, cargaEjercicio, calcularMusculos, calcularGrupos,
  nivel, resumen, topEjercicios, cambio, desdeRegistros, filtrar
};
});
