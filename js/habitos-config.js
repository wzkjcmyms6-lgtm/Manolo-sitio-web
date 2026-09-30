// ---------- Hábitos: configuración (ÚNICO archivo con constantes) ----------
// Todo lo ajustable de Hábitos vive aquí: tipos, frecuencias, estados de un
// día, XP, curva de niveles, monedas y comodines. El motor
// (js/habitos-engine.js) no tiene números mágicos propios.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HabitosConfig = factory();
})(typeof self !== "undefined" ? self : this, function () {

const CONST = {
  FIN_DIA_DEFECTO: 0,          // hora (0–6) en que termina el día; 3 = el día dura hasta las 3:00 a. m.
  FIN_DIA_MAX: 6,
  VENTANA_XP_HORAS: 48,        // lo marcado más tarde (tras el fin de ese día) no da XP ni monedas
  PARCIAL_MANTIENE_RACHA: 0.5, // un parcial con al menos esta fracción de la meta mantiene la racha
  PARCIAL_SINO: 0.5,           // fracción que vale un "parcial" en un hábito Sí/No
  COMODINES_MAX: 2,            // comodines de racha guardados a la vez
  TIMES_PER_WEEK_DEFECTO: 3,
  CADA_N_DEFECTO: 2,
  CADA_N_MAX: 30,
  META_DEFECTO: { medible: 8, tiempo: 20 }
};

const TIPOS = {
  sino: { nombre: "Sí/No" },
  medible: { nombre: "Medible" },    // meta + unidad (8 vasos, 20 páginas)
  tiempo: { nombre: "Tiempo" },      // meta en minutos
  evitar: { nombre: "Evitar" }       // cuenta días limpios; se registra la recaída
};

// "semana" = X veces por semana (se evalúa por semana, de lunes a domingo).
const FRECUENCIAS = ["diario", "dias", "semana", "cadaN"];

const MOMENTOS = [
  { id: "manana", nombre: "Mañana" },
  { id: "tarde", nombre: "Tarde" },
  { id: "noche", nombre: "Noche" },
  { id: "cualquiera", nombre: "Cualquier momento" }
];

// Estados que se pueden guardar en un día. "no" es un "no hecho" explícito;
// un día sin registro también cuenta como no hecho si ya terminó.
const ESTADOS = {
  hecho: { nombre: "Hecho" },
  parcial: { nombre: "Parcial" },
  minima: { nombre: "Versión mínima" },   // regla de los 2 minutos: mantiene la racha con menos XP
  saltado: { nombre: "Saltado" },         // con motivo: no rompe la racha ni da XP
  no: { nombre: "No hecho" },
  recaida: { nombre: "Recaída" }          // solo en hábitos de tipo Evitar
};

const MOTIVOS_SALTO = [
  { id: "enfermo", nombre: "Enfermo" },
  { id: "viaje", nombre: "Viaje" },
  { id: "descanso", nombre: "Descanso" },
  { id: "otro", nombre: "Otro" }
];

const DIFICULTADES = {
  facil: { nombre: "Fácil", xp: 5 },
  media: { nombre: "Media", xp: 10 },
  dificil: { nombre: "Difícil", xp: 15 }
};

const XP = {
  MINIMA: 0.5,                 // la versión mínima da este % del XP
  EVITAR_DIA_LIMPIO: 0.5,      // un día limpio de un hábito Evitar da este % del XP
  BONUS_RACHA_DIA: 0.02,       // +2 % por cada día de racha…
  BONUS_RACHA_SEMANA: 0.1,     // …o +10 % por cada semana (hábitos semanales)
  BONUS_RACHA_TOPE: 0.5,       // hasta +50 %
  DIA_PERFECTO: 20,            // bonus fijo por completar todo lo que tocaba
  MONEDAS_POR_XP: 0.1          // 1 moneda por cada 10 XP
};

// XP total para llegar al nivel n = A × (n − 1)^B.
// Calibrado (ver tests) para: nivel 2 el primer día, ~10 al mes y ~30 al año
// con 5 hábitos y una constancia realista.
const NIVEL = {
  A: 16,
  B: 2.14,
  // Un título nuevo cada 5 niveles: TITULOS[floor(nivel / 5)].
  TITULOS: ["Principiante", "Aprendiz", "Constante", "Disciplinado", "Imparable",
    "Maestro", "Leyenda", "Mítico", "Inmortal", "Eterno", "Trascendente"]
};

const AREAS = [
  { id: "cuerpo", nombre: "Cuerpo" },
  { id: "mente", nombre: "Mente" },
  { id: "dinero", nombre: "Dinero" },
  { id: "carrera", nombre: "Carrera" },
  { id: "bienestar", nombre: "Bienestar" },
  { id: "social", nombre: "Social" }
];

return { CONST, TIPOS, FRECUENCIAS, MOMENTOS, ESTADOS, MOTIVOS_SALTO, DIFICULTADES, XP, NIVEL, AREAS };
});
