// ---------- Rangos: configuración (ÚNICO archivo con constantes y estándares) ----------
// Todo lo ajustable del sistema de rangos vive aquí: constantes del cálculo,
// los 25 niveles, los grupos y músculos, y la tabla de estándares por
// ejercicio (hombre de 85 kg). Para recalibrar, cambia estos números; el
// motor (js/rangos-engine.js) no tiene números mágicos propios.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RangosConfig = factory();
})(typeof self !== "undefined" ? self : this, function () {

const CONST = {
  REF_BW: 85,                 // kg: peso de referencia de la tabla de estándares
  DEFAULT_BW: 85,             // kg: si no hay pesaje ni peso en el perfil
  ALLOMETRIC_EXP: 0.67,       // escalado alométrico por peso corporal
  REP_CAP_CARGA: 12,          // tope de reps en la fórmula de Epley (con peso)
  REP_CAP_CORPORAL: 30,       // tope de reps en Epley (peso corporal)
  ALPHA_UP: 0.5,              // cuánto sube el nivel sostenido hacia una sesión mejor
  ALPHA_DOWN: 0.2,            // cuánto baja hacia una sesión peor (un mal día pesa poco)
  SHIELD_SESSIONS: 2,         // sesiones protegidas tras subir de división
  HYSTERESIS: 1,              // puntos de percentil bajo el mínimo antes de bajar
  GRACE_DAYS: 28,             // días sin entrenar un ejercicio sin que baje nada
  DECAY_WEEKLY: 0.01,         // bajada por semana pasado el margen
  FLOOR_RATIO: 0.85,          // nunca baja de este % del mejor nivel alcanzado
  GLOBAL_MIN_EJERCICIOS: 10,  // ejercicios con rango para desbloquear el global
  GLOBAL_POWER: 0.5,          // media de potencia de los 6 grupos
  VENTANA_SERIES_DIAS: 90,    // series recientes que pesan en el rango de cada músculo
  IMPLICACION_PRIMARIO: 1,
  IMPLICACION_SECUNDARIO: 0.5,
  SOSPECHOSA_P99: 1.25,       // serie > 1,25 × ancla P99 → sospechosa
  SOSPECHOSA_NIVEL: 1.5,      // serie > 1,5 × nivel sostenido (carga/corporal) → sospechosa
  LIMITES: {                  // registros fuera de estos rangos se ignoran
    carga: { reps: [1, 50] },
    corporal: { reps: [1, 100] },
    reps: { reps: [1, 500] },
    tiempo: { seg: [1, 3600] }
  },
  META_REPS: 5,               // la meta en carga se expresa como "≈ X kg × 5"
  META_REDONDEO: 2.5,         // kg: redondeo hacia arriba de la meta
  META_MAX_REPS_CORPORAL: 30  // más reps que esto → meta con lastre para 5 reps
};

// Percentiles de las anclas de cada ejercicio (en ese orden).
const PERCENTILES_ANCLA = [5, 20, 50, 80, 95, 99];

// 9 rangos; cada número es el percentil mínimo de la división I, II, III.
const RANGOS = [
  { id: "hierro", nombre: "Hierro", minimos: [0, 4, 8], color: "#6E7681" },
  { id: "bronce", nombre: "Bronce", minimos: [12, 16, 20], color: "#B06A35" },
  { id: "plata", nombre: "Plata", minimos: [25, 30, 35], color: "#A9B4C2" },
  { id: "oro", nombre: "Oro", minimos: [40, 45, 50], color: "#E6B422" },
  { id: "rubi", nombre: "Rubí", minimos: [55, 60, 65], color: "#D1204A" },
  { id: "esmeralda", nombre: "Esmeralda", minimos: [70, 75, 80], color: "#12A375" },
  { id: "diamante", nombre: "Diamante", minimos: [85, 89, 92], color: "#3AA3F2" },
  { id: "campeon", nombre: "Campeón", minimos: [94.5, 96.5, 98], color: "#8B5CF6" },
  { id: "simetrico", nombre: "Simétrico", minimos: [99], color: "#F472B6", iridiscente: ["#F472B6", "#60A5FA", "#34D399"] }
];

// Músculos con rango y las regiones del mapa corporal de Manolo que pintan.
const MUSCULOS = {
  pectoral: { nombre: "Pectoral", regiones: ["pecho_superior", "pecho_medio", "pecho_inferior"] },
  dorsales: { nombre: "Dorsales", regiones: ["dorsales"] },
  espalda_alta: { nombre: "Espalda alta", regiones: ["espalda_media"] },
  trapecio: { nombre: "Trapecio", regiones: ["trapecio"] },
  lumbares: { nombre: "Lumbares", regiones: ["lumbares"] },
  deltoide_anterior: { nombre: "Deltoide anterior", regiones: ["deltoide_anterior"] },
  deltoide_lateral: { nombre: "Deltoide lateral", regiones: ["deltoide_lateral"] },
  deltoide_posterior: { nombre: "Deltoide posterior", regiones: ["deltoide_posterior"] },
  biceps: { nombre: "Bíceps", regiones: ["biceps"] },
  triceps: { nombre: "Tríceps", regiones: ["triceps"] },
  antebrazos: { nombre: "Antebrazos", regiones: ["antebrazos"] },
  cuadriceps: { nombre: "Cuádriceps", regiones: ["cuadriceps"] },
  isquiotibiales: { nombre: "Isquiotibiales", regiones: ["isquiotibiales"] },
  gluteos: { nombre: "Glúteos", regiones: ["gluteos"] },
  gemelos: { nombre: "Gemelos", regiones: ["pantorrillas"] },
  aductores: { nombre: "Aductores", regiones: ["aductores"] },
  abdominales: { nombre: "Abdominales", regiones: ["abdominales"] },
  oblicuos: { nombre: "Oblicuos", regiones: ["oblicuos"] }
};

const GRUPOS = [
  { id: "pecho", nombre: "Pecho", musculos: ["pectoral"] },
  { id: "espalda", nombre: "Espalda", musculos: ["dorsales", "espalda_alta", "trapecio", "lumbares"] },
  { id: "hombros", nombre: "Hombros", musculos: ["deltoide_anterior", "deltoide_lateral", "deltoide_posterior"] },
  { id: "brazos", nombre: "Brazos", musculos: ["biceps", "triceps", "antebrazos"] },
  { id: "piernas", nombre: "Piernas", musculos: ["cuadriceps", "isquiotibiales", "gluteos", "gemelos", "aductores"] },
  { id: "core", nombre: "Core", musculos: ["abdominales", "oblicuos"] }
];

// Estándares por cohorte. Solo "hombre" está cargada; la estructura queda
// lista para otras. anclas = score en P5, P20, P50, P80, P95, P99 (kg de
// 1RM equivalentes pesando 85 kg; reps; o segundos). baseIds = ejercicios de
// data/ejercicios.json que cuentan como este; alias = nombres alternativos.
const E = (nombre, familia, musculos, anclas, baseIds, alias) => ({ nombre, familia, musculos, anclas, baseIds, alias });
const STANDARDS = {
  hombre: {
    press_banca: E("Press de banca con barra", "carga", { pectoral: 1, triceps: 0.5, deltoide_anterior: 0.5 }, [55, 75, 100, 130, 160, 185],
      ["barbell-bench-press-medium-grip"], ["press banca", "press de banca", "press plano", "bench press", "barbell bench press"]),
    press_inclinado: E("Press inclinado con barra", "carga", { pectoral: 1, deltoide_anterior: 0.5, triceps: 0.5 }, [45, 63, 85, 110, 135, 155],
      ["barbell-incline-bench-press-medium-grip"], ["press inclinado", "press inclinado con barra", "incline bench press"]),
    press_banca_mancuernas: E("Press de banca con mancuernas", "carga", { pectoral: 1, deltoide_anterior: 0.5, triceps: 0.5 }, [16, 24, 34, 45, 56, 64],
      ["dumbbell-bench-press"], ["press banca mancuernas", "press con mancuernas", "dumbbell bench press"]),
    fondos: E("Fondos en paralelas", "corporal", { pectoral: 1, triceps: 1, deltoide_anterior: 0.5 }, [90, 105, 125, 145, 168, 188],
      ["parallel-bar-dip", "dips-chest-version", "dips-triceps-version"], ["fondos", "fondos en paralelas", "paralelas", "dips"]),
    flexiones: E("Flexiones", "reps", { pectoral: 1, triceps: 0.5, deltoide_anterior: 0.5 }, [8, 17, 30, 45, 60, 75],
      ["pushups", "manolo-flexion-normal"], ["flexiones", "flexion normal", "lagartijas", "push ups", "pushups"]),
    dominadas: E("Dominadas", "corporal", { dorsales: 1, biceps: 0.5, espalda_alta: 0.5 }, [68, 94, 108, 125, 145, 166],
      ["pullups", "weighted-pull-ups"], ["dominadas", "pull ups", "pullups"]),
    muscle_up: E("Muscle-up", "corporal", { dorsales: 1, triceps: 0.5, pectoral: 0.5 }, [85, 91, 99, 108, 119, 130],
      ["muscle-up"], ["muscle up", "muscle-up"]),
    jalon_polea: E("Jalón al pecho en polea", "carga", { dorsales: 1, biceps: 0.5 }, [35, 50, 68, 88, 108, 122],
      ["wide-grip-lat-pulldown"], ["jalon al pecho", "polea al pecho", "lat pulldown"]),
    remo_barra: E("Remo con barra", "carga", { dorsales: 1, espalda_alta: 1, biceps: 0.5, deltoide_posterior: 0.5 }, [45, 62, 85, 110, 135, 155],
      ["bent-over-barbell-row", "manolo-remo-pendlay"], ["remo con barra", "remo inclinado", "barbell row", "bent over row"]),
    remo_mancuerna: E("Remo con mancuerna", "carga", { dorsales: 1, espalda_alta: 0.5, biceps: 0.5 }, [16, 25, 36, 48, 60, 70],
      ["one-arm-dumbbell-row"], ["remo con mancuerna", "remo a una mano", "dumbbell row"]),
    peso_muerto: E("Peso muerto", "carga", { gluteos: 1, isquiotibiales: 1, lumbares: 1, trapecio: 0.5, antebrazos: 0.5 }, [80, 115, 155, 195, 235, 265],
      ["barbell-deadlift"], ["peso muerto", "deadlift"]),
    encogimientos: E("Encogimientos con barra", "carga", { trapecio: 1, antebrazos: 0.5 }, [55, 85, 120, 160, 205, 235],
      ["barbell-shrug"], ["encogimientos", "encogimientos con barra", "shrugs", "barbell shrug"]),
    face_pull: E("Face pull en polea", "carga", { deltoide_posterior: 1, espalda_alta: 0.5 }, [12, 18, 26, 35, 44, 51],
      ["face-pull"], ["face pull"]),
    press_militar: E("Press militar con barra", "carga", { deltoide_anterior: 1, deltoide_lateral: 0.5, triceps: 0.5 }, [32, 45, 60, 77, 95, 110],
      ["standing-military-press", "seated-barbell-military-press"], ["press militar", "overhead press", "military press"]),
    press_hombro_mancuernas: E("Press de hombro con mancuernas", "carga", { deltoide_anterior: 1, deltoide_lateral: 0.5, triceps: 0.5 }, [10, 15, 22, 30, 38, 44],
      ["dumbbell-shoulder-press", "seated-dumbbell-press"], ["press de hombros con mancuernas", "press hombro mancuernas", "dumbbell shoulder press"]),
    elevaciones_laterales: E("Elevaciones laterales", "carga", { deltoide_lateral: 1 }, [5, 8, 12, 16, 21, 26],
      ["side-lateral-raise", "seated-side-lateral-raise"], ["elevaciones laterales", "elevacion lateral", "lateral raise"]),
    curl_barra: E("Curl con barra", "carga", { biceps: 1, antebrazos: 0.5 }, [20, 30, 42, 55, 68, 78],
      ["barbell-curl"], ["curl con barra", "curl de biceps con barra", "barbell curl"]),
    curl_mancuernas: E("Curl con mancuernas", "carga", { biceps: 1, antebrazos: 0.5 }, [8, 12, 17, 23, 29, 34],
      ["dumbbell-bicep-curl", "dumbbell-alternate-bicep-curl"], ["curl con mancuernas", "curl de biceps con mancuernas", "dumbbell curl"]),
    extension_triceps_polea: E("Extensión de tríceps en polea", "carga", { triceps: 1 }, [15, 23, 33, 44, 55, 64],
      ["triceps-pushdown", "triceps-pushdown-rope-attachment", "triceps-pushdown-v-bar-attachment"], ["extension de triceps en polea", "jalon de triceps", "triceps pushdown"]),
    sentadilla: E("Sentadilla con barra", "carga", { cuadriceps: 1, gluteos: 1, aductores: 0.5, lumbares: 0.5 }, [65, 95, 130, 165, 205, 235],
      ["barbell-squat"], ["sentadilla", "sentadilla con barra", "squat", "barbell squat"]),
    prensa_piernas: E("Prensa de piernas", "carga", { cuadriceps: 1, gluteos: 0.5 }, [80, 130, 195, 270, 350, 410],
      ["leg-press"], ["prensa", "prensa de piernas", "press de piernas", "leg press"]),
    peso_muerto_rumano: E("Peso muerto rumano", "carga", { isquiotibiales: 1, gluteos: 1, lumbares: 0.5 }, [60, 85, 115, 145, 175, 200],
      ["romanian-deadlift"], ["peso muerto rumano", "romanian deadlift", "rdl"]),
    hip_thrust: E("Hip thrust", "carga", { gluteos: 1, isquiotibiales: 0.5 }, [60, 90, 130, 175, 220, 255],
      ["barbell-hip-thrust"], ["hip thrust", "empuje de cadera", "empuje de caderas"]),
    extension_cuadriceps: E("Extensión de cuádriceps", "carga", { cuadriceps: 1 }, [30, 45, 65, 88, 110, 128],
      ["leg-extensions"], ["extension de cuadriceps", "extension de piernas", "leg extension"]),
    curl_femoral: E("Curl femoral", "carga", { isquiotibiales: 1 }, [25, 37, 52, 70, 88, 102],
      ["lying-leg-curls", "seated-leg-curl"], ["curl femoral", "curl de pierna", "leg curl"]),
    elevacion_talones: E("Elevación de talones de pie", "carga", { gemelos: 1 }, [40, 65, 100, 140, 180, 210],
      ["standing-calf-raises", "standing-barbell-calf-raise"], ["elevacion de talones", "gemelos de pie", "calf raise"]),
    elevacion_piernas_colgado: E("Elevación de piernas colgado", "reps", { abdominales: 1, oblicuos: 0.5 }, [3, 7, 12, 18, 25, 32],
      ["hanging-leg-raise"], ["elevacion de piernas colgado", "elevacion de piernas en barra", "hanging leg raise"]),
    crunch: E("Abdominales (crunch)", "reps", { abdominales: 1 }, [15, 25, 40, 60, 85, 110],
      ["crunches"], ["crunch", "abdominales", "crunches"]),
    rueda_abdominal: E("Rueda abdominal", "reps", { abdominales: 1, oblicuos: 0.5 }, [3, 6, 10, 16, 24, 32],
      ["ab-roller"], ["rueda abdominal", "ab wheel", "ab roller"]),
    plancha: E("Plancha", "tiempo", { abdominales: 1, oblicuos: 0.5 }, [30, 60, 100, 150, 210, 300],
      ["plank", "manolo-plancha-alta"], ["plancha", "plancha alta", "plank"])
  }
};

return { CONST, PERCENTILES_ANCLA, RANGOS, MUSCULOS, GRUPOS, STANDARDS, COHORTE: "hombre" };
});
