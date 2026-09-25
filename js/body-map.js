// ---------- Mapa muscular de Ejercicio ----------
// El cuerpo de arriba (Frente/Espalda) se pinta solo, según lo que
// entrenaste en la semana que se ve (lunes a domingo): amarillo si tocaste
// ese músculo una vez, verde si lo tocaste dos veces o más. Se arma
// clasificando el nombre de cada ejercicio que registras en Gimnasio por
// palabras clave; Running y Bicicleta suman también a Cuádriceps y
// Gemelos, porque igual trabajan las piernas.
(function () {

const MUSCLE_LABELS = {
  pecho: "Pecho", espalda: "Espalda", hombros: "Hombros",
  biceps: "Bíceps", triceps: "Tríceps", antebrazo: "Antebrazo",
  abdomen: "Abdomen", cuadriceps: "Cuádriceps", isquiotibiales: "Isquiotibiales",
  gluteos: "Glúteos", gemelos: "Gemelos"
};

// El orden importa: las frases más específicas van primero para que, por
// ejemplo, "peso muerto rumano" caiga en isquiotibiales y no en espalda.
const MUSCLE_KEYWORDS = [
  ["isquiotibiales", ["curl femoral", "curl de pierna", "peso muerto rumano", "buenos dias", "femoral", "isquiotibial"]],
  ["gluteos", ["hip thrust", "empuje de cadera", "puente de gluteo", "peso muerto sumo", "patada de gluteo", "abduccion de cadera", "gluteo"]],
  ["cuadriceps", ["sentadilla", "squat", "prensa", "extension de pierna", "zancada", "bulgara", "hack squat", "press de pierna"]],
  ["gemelos", ["elevacion de talon", "elevacion de talones", "pantorrilla", "gemelo", "calf"]],
  ["pecho", ["press de banca", "press inclinado", "press declinado", "apertura", "cruce de polea", "pullover", "press pecho", "press plano"]],
  ["espalda", ["remo", "dominada", "jalon", "pull up", "pull-up", "peso muerto convencional", "hiperextension", "jalon al pecho"]],
  ["hombros", ["press militar", "press de hombro", "press hombros", "elevacion lateral", "pajaro", "press arnold", "encogimiento", "face pull"]],
  ["biceps", ["curl de biceps", "curl biceps", "curl martillo", "curl concentrado", "curl banco scott", "curl mancuerna", "curl barra"]],
  ["triceps", ["triceps", "fondos", "press frances", "extension de triceps", "jalon de triceps", "press cerrado", "patada de triceps"]],
  ["antebrazo", ["curl de muñeca", "curl de muneca", "antebrazo", "farmer"]],
  ["abdomen", ["abdominal", "crunch", "plancha", "elevacion de piernas", "rueda abdominal", "oblicuo"]]
];

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function classifyExercise(name) {
  const n = normalize(name);
  for (const [muscle, words] of MUSCLE_KEYWORDS) {
    if (words.some(w => n.includes(normalize(w)))) return muscle;
  }
  return null;
}

// ---- Semana (lunes a domingo) ----
let weekOffset = 0;

function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  return d;
}
function currentWeek() {
  const start = mondayOf(new Date());
  start.setDate(start.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}
function inWeek(dateStr, week) {
  return dateStr >= isoDate(week.start) && dateStr <= isoDate(week.end);
}
function weekLabel(week) {
  const opts = { day: "numeric", month: "short" };
  const fmt = d => d.toLocaleDateString("es-ES", opts).replace(".", "");
  return `${fmt(week.start)} – ${fmt(week.end)}`;
}

// ---- Datos: Gimnasio, Running y Bicicleta ----
let workoutsCache = [];
let runningCache = [];
let cyclingCache = [];

function entrenamientosCollection() {
  return db.collection("users").doc(currentUser.uid).collection("entrenamientos");
}
function runningCollection() {
  return db.collection("users").doc(currentUser.uid).collection("running");
}
function cyclingCollection() {
  return db.collection("users").doc(currentUser.uid).collection("bicicleta");
}

// Cuenta, por músculo, en cuántos días distintos de la semana se trabajó.
function computeCounts(week) {
  const days = {}; // musculo -> Set de fechas

  workoutsCache
    .filter(w => w.date && inWeek(w.date, week))
    .forEach(w => {
      (w.exercises || []).forEach(ex => {
        const muscle = classifyExercise(ex.name);
        if (!muscle) return;
        (days[muscle] = days[muscle] || new Set()).add(w.date);
      });
    });

  // Correr y andar en bici también trabajan las piernas.
  runningCache.filter(r => r.date && inWeek(r.date, week)).forEach(r => {
    (days.cuadriceps = days.cuadriceps || new Set()).add(r.date);
    (days.gemelos = days.gemelos || new Set()).add(r.date);
  });
  cyclingCache.filter(r => r.date && inWeek(r.date, week)).forEach(r => {
    (days.cuadriceps = days.cuadriceps || new Set()).add(r.date);
    (days.gemelos = days.gemelos || new Set()).add(r.date);
  });

  const counts = {};
  Object.keys(days).forEach(m => { counts[m] = days[m].size; });
  return counts;
}

function renderBodyMap() {
  const banner = document.getElementById("body-banner");
  if (!banner || banner.hidden) return;
  const week = currentWeek();
  document.getElementById("body-week-label").textContent = weekLabel(week);
  document.getElementById("body-week-next").disabled = weekOffset >= 0;

  const counts = computeCounts(week);

  banner.querySelectorAll("[data-muscle]").forEach(el => {
    const n = counts[el.dataset.muscle] || 0;
    if (n <= 0) el.removeAttribute("data-level");
    else el.setAttribute("data-level", n === 1 ? "1" : "2");
  });

  const trained = Object.keys(counts).filter(m => counts[m] > 0 && MUSCLE_LABELS[m])
    .sort((a, b) => counts[b] - counts[a] || MUSCLE_LABELS[a].localeCompare(MUSCLE_LABELS[b]));
  const legend = document.getElementById("body-legend");
  legend.innerHTML = trained.length
    ? trained.map(m => {
        const n = counts[m];
        const level = n === 1 ? "1" : "2";
        return `<span class="body-legend-chip level-${level}"><span class="body-legend-dot"></span>${MUSCLE_LABELS[m]} · ${n}</span>`;
      }).join("")
    : `<span class="body-legend-chip">Todavía no registras entrenamientos esta semana</span>`;
}

document.getElementById("body-week-prev").addEventListener("click", () => { weekOffset--; renderBodyMap(); });
document.getElementById("body-week-next").addEventListener("click", () => { if (weekOffset < 0) { weekOffset++; renderBodyMap(); } });

onAuthReady(() => {
  entrenamientosCollection().onSnapshot(snap => {
    workoutsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBodyMap();
  });
  runningCollection().onSnapshot(snap => {
    runningCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBodyMap();
  });
  cyclingCollection().onSnapshot(snap => {
    cyclingCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBodyMap();
  });
});

// El router (modules.js) solo cambia [hidden]; cuando el banner se vuelve
// a mostrar hay que repintar, porque mientras estaba oculto no se hizo.
new MutationObserver(() => renderBodyMap())
  .observe(document.getElementById("body-banner"), { attributes: true, attributeFilter: ["hidden"] });

})();
