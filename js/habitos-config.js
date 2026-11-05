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
  META_DEFECTO: { medible: 8, tiempo: 20 },
  DESCRIPCION_MAX: 300         // caracteres de la nota/descripción de un hábito
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
// Temporada 2 (D-080, ver tests y tests/habitos-sim.js): con 5 hábitos al
// ~80 % (con misiones y jefes) nivel 2 a los ~3 días, ~5 al mes, ~10 a los
// 6 meses, ~15 al año y ~20 a los 2 años. Los títulos altos son de años.
// Antes (temporada 1): A 16, B 2,14 (nivel 10 al mes, 31 al año).
const NIVEL = {
  A: 95,
  B: 2.08,
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

// ---------- Rango por hábito (fuerza de 0 a 100, estilo Loop) ----------
// Cada día que toca, la fuerza se acerca a 100 si cumples (ALFA_SUBE) y a 0 si
// fallas (ALFA_BAJA: un fallo pesa ~4,6 veces más que un día cumplido). Los
// hábitos que no son diarios usan un alfa proporcional a los días entre una
// vez y la siguiente, así el tiempo pesa igual. La fuerza pasa a un
// "percentil" con CURVA y de ahí a las 25 divisiones de RANGOS
// (js/rangos-config.js).
// Temporada 2 (D-080, ver tests): un diario perfecto llega a Bronce al mes,
// Oro a los 3 meses, Esmeralda a los 6, Diamante al año y al máximo a los
// ~1,5 años. Techo según constancia: 50 % Bronce · 70 % Plata · 80 % Oro ·
// 90 % Rubí · 95 % Esmeralda · 98 % Diamante. Un fallo aislado nunca baja
// de división; tres seguidos sí. Antes: 0,021 / 0,0126 / 300 días.
// (Con 4× exacto, el 98 % llegaba a Campeón; 4,6× lo deja en Diamante.)
const FUERZA = {
  ALFA_SUBE: 0.007,
  ALFA_BAJA: 0.032,
  MINIMA: 0.5,                // la versión mínima cuenta como un 50 %
  PARCIAL: 0.8,               // un parcial cuenta el 80 % de lo que hiciste
  CURVA: [[0, 0], [85, 85], [96.5, 99], [100, 99.9]], // fuerza → percentil
  MIN_DIAS_MAXIMO: 540,       // días de historia para llegar al último rango
  // Se baja de división solo si la fuerza cae más de lo que quita un fallo
  // desde el piso (histéresis = ALFA_BAJA, relativa a la fuerza).
  FALLOS_BAJAN: 3,            // tantos fallos seguidos bajan al menos una división
  ESCUDO: 0                   // días protegidos tras subir (ya no hace falta)
};
// Versión de la calibración. Al cambiarla, la app recalcula todo desde el
// historial y muestra una sola vez "Temporada N" (sin celebraciones).
const CALIBRACION = 2;
// Nombres propios de Hábitos (Ejercicio no cambia).
const RANGO_NOMBRES = { simetrico: "Inquebrantable" };

// ---------- Áreas, monedas, tienda y misiones ----------
// XP de la categoría para su nivel n = A × (n − 1)^B: con 2 hábitos al ~85 %,
// nivel ~5 a los 2–3 meses y ~10 al año (antes: A 8).
const AREA_NIVEL = { A: 80, B: 2 };
// Precio de un comodín de racha: con constancia normal (~100 monedas por
// semana) alcanza para uno cada 3–4 semanas (antes: 80).
const TIENDA = { COMODIN: 350 };
const MISIONES = {
  POR_SEMANA: 3,
  XP: 60,
  MONEDAS: 40,
  EXIGENCIA: 1.2,             // un poco por encima de tu promedio reciente
  SEMANAS_BASE: 4             // semanas que se miran para el promedio
};

// ---------- Jefe semanal ----------
// Cada lunes aparece un rival. Su vida es un % del daño que harías cumpliendo
// todo lo de la semana; cada cumplimiento le quita el XP base del hábito (sin
// bonus de racha). Si cae antes de que termine el domingo, deja botín.
const JEFE = {
  EXIGENCIA: 0.8,              // vida = 80 % de lo que podrías hacerle en la semana
  XP: 50,                      // botín al derrotarlo
  MONEDAS: 30,
  RIVALES: [
    { id: "pereza", nombre: "La Pereza", emoji: "🦥" },
    { id: "scroll", nombre: "El Scroll Infinito", emoji: "📱" },
    { id: "procrastinacion", nombre: "La Procrastinación", emoji: "⏳" },
    { id: "sofa", nombre: "El Sofá", emoji: "🛋️" },
    { id: "excusa", nombre: "La Excusa", emoji: "🙊" },
    { id: "cansancio", nombre: "El Cansancio", emoji: "😴" },
    { id: "caos", nombre: "El Caos", emoji: "🌪️" },
    { id: "distraccion", nombre: "La Distracción", emoji: "🔔" }
  ]
};

// ---------- Logros ----------
// tipo + meta: el motor calcula el progreso de cada uno desde el historial.
const L = (id, nombre, desc, tipo, meta, secreto) => ({ id, nombre, desc, tipo, meta, secreto: !!secreto });
const LOGROS = [
  L("primer_paso", "Primeros pasos", "Marca tu primer hábito.", "registros", 1),
  L("registros_100", "Cien veces", "Suma 100 registros.", "registros", 100),
  L("registros_500", "Quinientas", "Suma 500 registros.", "registros", 500),
  L("registros_1000", "Mil", "Suma 1000 registros.", "registros", 1000),
  L("racha_7", "Una semana", "Llega a 7 días de racha en un hábito.", "racha", 7),
  L("racha_30", "Un mes", "Llega a 30 días de racha.", "racha", 30),
  L("racha_100", "Cien días", "Llega a 100 días de racha.", "racha", 100),
  L("racha_365", "Un año entero", "Llega a 365 días de racha.", "racha", 365),
  L("perfecto_1", "Día perfecto", "Cumple todo lo que tocaba en un día.", "perfectos", 1),
  L("perfecto_10", "Diez perfectos", "Suma 10 días perfectos.", "perfectos", 10),
  L("perfecto_50", "Cincuenta perfectos", "Suma 50 días perfectos.", "perfectos", 50),
  L("semana_perfecta", "Semana perfecta", "7 días perfectos de lunes a domingo.", "semanaPerfecta", 1),
  L("mes_perfecto", "Mes perfecto", "Todos los días de un mes, perfectos.", "mesPerfecto", 1),
  L("nunca_dos", "Nunca dos veces", "Cumple justo al día siguiente de un fallo, 5 veces.", "nuncaDos", 5),
  L("madrugador", "Madrugador", "Marca 10 hábitos antes de las 7:00.", "madrugador", 10),
  L("coleccion", "Coleccionista", "Ten 5 hábitos activos.", "habitos", 5),
  L("equilibrio", "Equilibrio", "Cumple hábitos de 4 categorías distintas en una semana.", "equilibrio", 4),
  L("categoria_5", "Especialista", "Lleva una categoría al nivel 5.", "categoria", 5),
  L("categoria_10", "Maestría", "Lleva una categoría al nivel 10.", "categoria", 10),
  L("nivel_5", "Nivel 5", "Llega al nivel 5.", "nivel", 5),
  L("nivel_10", "Nivel 10", "Llega al nivel 10.", "nivel", 10),
  L("nivel_25", "Nivel 25", "Llega al nivel 25.", "nivel", 25),
  L("rango_oro", "De oro", "Lleva un hábito a Oro.", "rango", "oro"),
  L("rango_diamante", "Diamante", "Lleva un hábito a Diamante.", "rango", "diamante"),
  L("rango_max", "Inquebrantable", "Lleva un hábito al rango máximo.", "rango", "simetrico"),
  L("misiones_10", "Misionero", "Completa 10 misiones semanales.", "misiones", 10),
  L("ahorro_500", "Ahorrador", "Junta 500 monedas.", "ahorro", 500),
  L("primer_canje", "Te lo ganaste", "Canjea tu primera recompensa.", "canje", 1),
  L("limpio_30", "Treinta limpios", "30 días limpios en un hábito de Evitar.", "limpios", 30),
  L("semanal_4", "Mes constante", "4 semanas seguidas cumpliendo un hábito semanal.", "semanal", 4),
  L("noctambulo", "Noctámbulo", "Marca 10 hábitos entre las 0:00 y las 4:00.", "noctambulo", 10, true),
  L("regreso", "De vuelta", "Cumple un hábito el día después de una pausa.", "regreso", 1, true),
  // Hitos de Scalping en minutos reales (los mismos de js/scalping-habit.js).
  // Solo aparecen si tienes el hábito Scalping.
  L("scalping_36", "Scalping: 36 horas", "Acumula 36 horas de masaje. Ahí, en promedio, la mejora empezaba a notarse.", "scalping", 2178),
  L("scalping_50", "Scalping: 50 horas", "Acumula 50 horas: el mínimo recomendado antes de evaluar resultados.", "scalping", 3000),
  L("scalping_65", "Scalping: 65 horas", "Acumula 65 horas: el plan de 6 meses completo.", "scalping", 3900)
];

return { CONST, TIPOS, FRECUENCIAS, MOMENTOS, ESTADOS, MOTIVOS_SALTO, DIFICULTADES, XP, NIVEL, AREAS,
  FUERZA, CALIBRACION, RANGO_NOMBRES, AREA_NIVEL, TIENDA, MISIONES, JEFE, LOGROS };
});
