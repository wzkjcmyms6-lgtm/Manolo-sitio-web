#!/usr/bin/env node
// Genera data/ejercicios.json a partir de free-exercise-db
// https://github.com/yuhonas/free-exercise-db — licencia Unlicense (dominio
// público: se puede copiar, modificar y redistribuir sin restricciones).
//
// Qué hace:
//   1. Descarga el dataset (versión fijada por commit) o lee una copia local.
//   2. Descarta estiramientos, rodillo de espuma, strongman y
//      ejercicios de técnica/pliometría muy específicos.
//   3. Traduce el nombre al español con un glosario (movimiento + modificadores
//      + equipo entre paréntesis) y agrega alias (inglés y variantes).
//   4. Reparte los músculos del dataset en las 22 regiones de Manolo y refina
//      lo que el dataset no separa (pecho superior/inferior, las 3 cabezas del
//      deltoide, oblicuos).
//   5. Asigna tipo (carga | peso_corporal | cardio | isometrico) y factor de
//      peso corporal.
//   6. Suma unos pocos ejercicios que el dataset no trae (correr, natación…).
//
// Uso:
//   node scripts/build-exercises.mjs                  descarga y genera
//   node scripts/build-exercises.mjs --local x.json   usa una copia local
//   node scripts/build-exercises.mjs --report         lista lo que no tradujo
//
// Si la descarga falla por proxy: curl -o /tmp/fedb.json <URL de abajo> y
// luego --local /tmp/fedb.json.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { MUSCULO_POR_ID, TIPOS } = require(join(ROOT, "js/muscle-engine.js"));

const COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
const URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}/dist/exercises.json`;
const SALIDA = join(ROOT, "data/ejercicios.json");

const args = process.argv.slice(2);
const REPORTE = args.includes("--report");
const local = args.includes("--local") ? args[args.indexOf("--local") + 1] : null;

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

const MANTENER_STRONGMAN = /^(farmer's walk|sled push)$/i;
const MANTENER_PLIO = /box jump \(multiple|jump squat|tuck jump|split jump|star jump|standing long jump|mountain climbers|scissors jump|bench jump|fast skipping|rocket jump/i;
const EXCLUIR_NOMBRE = new RegExp([
  "powerlifting", "with chains", "reverse band", "chain ", "sled ", "drag", "bear crawl", "balance board",
  "lunge sprint", "bench sprint", "drill", "claw", "3-part", "carioca", "hop", "bound", "cone", "shuffle",
  "butt kick", "push-off", "quick leap", "depth jump", "throw", "chest push", "chest pass", "scoop", "return push",
  "heavy bag", "drop push", "london bridges", "otis-up", "spell caster", "cocoons", "butt-ups", "bottoms up$",
  "judo flip", "isometric wipers", "suspended fallout", "gorilla chin", "power stairs", "rack delivery",
  "para press", "car drivers", "pirate ships", "power partials", "frankenstein", "squat with plate movers",
  "downward facing balance", "prone manual", "anti-gravity", "circus bell", "neck press", "guillotine",
  "jefferson", "bottoms-up clean", "flexor incline", "body-up", "plate pinch", "hand squeeze",
  "wrist rotations", "iron cross", "crucifix", "bosu", "chair squat", "lying machine squat",
  "incline push-up depth", "kneeling jump squat", "kneeling arm drill", "speed band",
  "around the worlds", "cable incline pushdown", "calf-machine shoulder shrug", "bent press",
  "front raise and pullover", "straight raises on incline", "lying cambered", "open palm",
  "weighted sit-ups - with bands", "exercise ball pull-in", "clock push-up", "pushups \\(close and wide",
  "incline push-up medium", "hyperextensions with no", "incline push-up reverse", "decline close-grip bench to skull",
  "seesaw press", "kettlebell figure 8", "cable iron cross", "platform hamstring", "spider crawl",
  "barbell curls lying against", "dumbbell seated box jump", "double kettlebell alternating hang clean",
  "incline inner biceps", "seated dumbbell inner biceps", "standing inner-biceps", "cuban press", "scaption",
  "landmine linear jammer", "single-arm linear jammer", "svend press", "leg-over floor press", "extended range",
  "reverse plate curls", "board press", "pin presses", "car deadlift", "atlas", "keg", "yoke", "tire flip",
  "log lift", "axle", "rickshaw", "conan", "sandbag", "barbell side split squat", "chain press",
  "bodyweight flyes", "floor glute-ham", "kettlebell halo with", "gironda", "wind sprints", "trail running", "prowler"
].join("|"), "i");

function excluir(e) {
  if (e.category === "stretching") return true;
  if (e.equipment === "foam roll") return true;
  if (e.category === "strongman" && !MANTENER_STRONGMAN.test(e.name)) return true;
  if (e.category === "plyometrics" && !MANTENER_PLIO.test(e.name)) return true;
  if (EXCLUIR_NOMBRE.test(e.name)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------------

const EQUIPO_LABEL = {
  barra: "Barra", mancuerna: "Mancuerna", polea: "Polea", maquina: "Máquina", smith: "Máquina Smith",
  kettlebell: "Kettlebell", banda: "Banda", barra_ez: "Barra EZ", barra_hex: "Barra hexagonal",
  balon_medicinal: "Balón medicinal", fitball: "Fitball", peso_corporal: "Peso corporal", otro: "Otro"
};

const EQUIPO_NOMBRE = [
  ["smith", /\bsmith( machine)?\b/],
  ["barra_ez", /\be ?z (curl )?bar\b/],
  ["barra_hex", /\btrap bar\b/],
  ["kettlebell", /\b(with )?(two |double )?kettlebells?\b/],
  ["mancuerna", /\b(with )?(two |2 )?dumbbells?\b|\bdb\b/],
  ["barra", /\b(long |straight |cambered )?barbell\b|\blong bar\b|\bstraight bar\b/],
  ["polea", /\b(low |high )?(cable|pulley)s?\b/],
  ["maquina", /\bleverage\b|\bmachine\b/],
  ["banda", /\b(with )?bands?\b/],
  ["balon_medicinal", /\bmedicine ball\b/],
  ["fitball", /\b(on (an |the )?)?(exercise ball|physioball|ball)\b/]
];

const EQUIPO_CAMPO = {
  barbell: "barra", dumbbell: "mancuerna", cable: "polea", machine: "maquina", kettlebells: "kettlebell",
  bands: "banda", "e-z curl bar": "barra_ez", "medicine ball": "balon_medicinal", "exercise ball": "fitball",
  "body only": "peso_corporal"
};

// ---------------------------------------------------------------------------
// Glosario: movimiento principal (core). Se toma el PRIMERO que coincide, por
// eso los más específicos van arriba. g = género del sustantivo para que los
// adjetivos concuerden (m, f, mp, fp).
// ---------------------------------------------------------------------------

const CORES = [
  // Cardio
  [/running treadmill/, "correr en cinta", "m"],
  [/jogging treadmill/, "trotar en cinta", "m"],
  [/walking treadmill/, "caminar en cinta", "m"],
  [/bicycling stationary/, "bicicleta estática", "f"],
  [/recumbent bike/, "bicicleta reclinada", "f"],
  [/air bike/, "crunch bicicleta", "m"],
  [/bicycling/, "bicicleta", "f"],
  [/elliptical trainer/, "elíptica", "f"],
  [/rowing stationary/, "remo ergómetro", "m"],
  [/stairmaster/, "escaladora", "f"],
  [/step mill/, "escaladora de escalones", "f"],
  [/rope jumping/, "saltar la cuerda", "m"],
  [/skating/, "patinaje", "m"],
  [/battling ropes/, "cuerdas de batalla", "fp"],
  [/rope climb/, "trepa de cuerda", "f"],
  [/fast skipping/, "skipping", "m"],
  [/mountain climbers/, "escaladores", "mp"],

  // Halterofilia
  [/clean and jerk/, "dos tiempos", "m"],
  [/clean and press/, "cargada y press", "f"],
  [/power clean/, "cargada de potencia", "f"],
  [/hang clean below the knees/, "cargada colgante bajo rodillas", "f"],
  [/hang clean/, "cargada colgante", "f"],
  [/split clean/, "cargada en tijera", "f"],
  [/clean pull/, "tirón de cargada", "m"],
  [/clean shrug/, "encogimiento de cargada", "m"],
  [/clean deadlift/, "peso muerto de cargada", "m"],
  [/dead clean/, "cargada desde el suelo", "f"],
  [/\bclean\b/, "cargada", "f"],
  [/power snatch/, "arrancada de potencia", "f"],
  [/hang snatch below knees/, "arrancada colgante bajo rodillas", "f"],
  [/hang snatch/, "arrancada colgante", "f"],
  [/muscle snatch/, "arrancada de fuerza", "f"],
  [/split snatch/, "arrancada en tijera", "f"],
  [/snatch balance/, "snatch balance", "m"],
  [/snatch pull/, "tirón de arrancada", "m"],
  [/snatch shrug/, "encogimiento de arrancada", "m"],
  [/snatch deadlift/, "peso muerto de arrancada", "m"],
  [/\bsnatch\b/, "arrancada", "f"],
  [/push press/, "push press", "m"],
  [/power jerk/, "envión de potencia", "m"],
  [/split jerk/, "envión en tijera", "m"],
  [/squat jerk/, "envión en sentadilla", "m"],
  [/jerk balance/, "equilibrio de envión", "m"],
  [/jerk dip squat/, "semisentadilla de envión", "f"],
  [/\bjerk\b/, "envión", "m"],
  [/thruster/, "thruster", "m"],
  [/turkish get up/, "levantamiento turco", "m"],
  [/\bswings?\b/, "swing", "m"],

  // Pecho
  [/bench press/, "press de banca", "m"],
  [/chest press/, "press de pecho", "m"],
  [/floor press/, "press en el suelo", "m"],
  [/cross ?over/, "cruce de poleas", "m"],
  [/butterfly/, "pec deck", "m"],
  [/reverse machine flyes/, "pec deck inverso", "m"],
  [/rear delt fly|reverse flyes?|back flyes/, "pájaros", "mp"],
  [/\bfly(e|es)?\b|\bflyes\b/, "aperturas", "fp"],
  [/pullover/, "pullover", "m"],
  [/dips? chest version/, "fondos para pecho", "mp"],
  [/dips? triceps version/, "fondos para tríceps", "mp"],
  [/bench dips?/, "fondos en banco", "mp"],
  [/parallel bar dip/, "fondos en paralelas", "mp"],
  [/ring dips?/, "fondos en anillas", "mp"],
  [/\bdips?\b/, "fondos", "mp"],
  [/handstand push ups?/, "flexiones en parada de manos", "fp"],
  [/plyo (kettlebell )?push ?ups?/, "flexiones pliométricas", "fp"],
  [/push up to side plank/, "flexión a plancha lateral", "f"],
  [/push ups? with feet elevated/, "flexiones con pies elevados", "fp"],
  [/push ups? with feet( on)?/, "flexiones con pies en fitball", "fp"],
  [/push ups? close triceps position/, "flexiones diamante", "fp"],
  [/push ?ups?/, "flexiones", "fp"],
  [/isometric chest squeezes/, "compresión isométrica de pecho", "f"],

  // Hombros
  [/arnold press/, "press Arnold", "m"],
  [/military press/, "press militar", "m"],
  [/shoulder press|overhead press/, "press de hombros", "m"],
  [/bradford rocky presses|bradford press/, "press Bradford", "m"],
  [/see saw press alternating side press/, "press alterno", "m"],
  [/military press to the side/, "press lateral", "m"],
  [/upright row/, "remo al mentón", "m"],
  [/face pull/, "face pull", "m"],
  [/pull apart/, "separación de banda", "f"],
  [/side laterals? to front raise/, "elevación lateral y frontal", "f"],
  [/rear delt raise|rear lateral raise|rear delt raise with head on bench/, "pájaros", "mp"],
  [/rear delt rows?/, "remo al deltoide posterior", "m"],
  [/side lateral raise|lateral raise|side laterals?/, "elevación lateral", "f"],
  [/front delt raise above head|front raise over head/, "elevación frontal sobre la cabeza", "f"],
  [/front (plate |two )?raise|front delt raise/, "elevación frontal", "f"],
  [/deltoid raise/, "elevación de deltoides", "f"],
  [/shoulder raise/, "elevación de hombros", "f"],
  [/internal rotation/, "rotación interna", "f"],
  [/external rotation/, "rotación externa", "f"],
  [/\bhalo\b/, "halo", "m"],
  [/middle back shrug/, "encogimiento de escápulas", "m"],
  [/shrugs?/, "encogimientos", "mp"],

  // Espalda
  [/straight arm pulldown/, "jalón con brazos rectos", "m"],
  [/pulldown behind the neck/, "jalón tras nuca", "m"],
  [/rocky pull ups pulldowns/, "dominadas y jalón", "fp"],
  [/lat pulldown|pulldowns?/, "jalón al pecho", "m"],
  [/muscle up/, "muscle up", "m"],
  [/scapular pull up/, "dominadas escapulares", "fp"],
  [/band assisted pull up/, "dominadas asistidas", "fp"],
  [/side to side chins/, "dominadas de lado a lado", "fp"],
  [/mixed grip chin/, "dominadas agarre mixto", "fp"],
  [/chin ?ups?|\bchins?\b/, "dominadas supinas", "fp"],
  [/pull ?ups?/, "dominadas", "fp"],
  [/inverted row/, "remo invertido", "m"],
  [/renegade row/, "remo renegado", "m"],
  [/t bar row/, "remo en T", "m"],
  [/high row/, "remo alto", "m"],
  [/shotgun row/, "remo escopeta", "m"],
  [/incline bench pull/, "remo en banco inclinado", "m"],
  [/\brows?\b/, "remo", "m"],
  [/romanian deadlift/, "peso muerto rumano", "m"],
  [/stiff legged (barbell |dumbbell )?deadlift|stiff legs/, "peso muerto piernas rígidas", "m"],
  [/sumo deadlift/, "peso muerto sumo", "m"],
  [/side deadlift/, "peso muerto lateral", "m"],
  [/one legged deadlift/, "peso muerto a una pierna", "m"],
  [/deadlifts?/, "peso muerto", "m"],
  [/rack pulls?/, "rack pull", "m"],
  [/stiff leg good morning/, "buenos días piernas rígidas", "mp"],
  [/good mornings?( off pins)?( pull through)?/, "buenos días", "mp"],
  [/reverse hyperextension/, "hiperextensión inversa", "f"],
  [/hyperextensions?( back extensions)?/, "hiperextensiones", "fp"],
  [/pull through/, "pull through", "m"],

  // Brazos
  [/preacher hammer (dumbbell )?curl/, "curl martillo predicador", "m"],
  [/cross body hammer curl/, "curl martillo cruzado", "m"],
  [/hammer curls?/, "curl martillo", "m"],
  [/zottman preacher curl/, "curl Zottman predicador", "m"],
  [/zottman curl/, "curl Zottman", "m"],
  [/preacher curls?/, "curl predicador", "m"],
  [/concentration (barbell )?curls?/, "curl concentrado", "m"],
  [/spider curl/, "curl araña", "m"],
  [/drag curl/, "curl arrastre", "m"],
  [/reverse (preacher )?curls?/, "curl inverso", "m"],
  [/wrist curl/, "curl de muñeca", "m"],
  [/finger curls/, "curl de dedos", "m"],
  [/leg curls?|hamstring curl/, "curl femoral", "m"],
  [/(bicep|biceps) curls?|\bcurls?\b/, "curl de bíceps", "m"],
  [/skull ?crusher/, "press francés", "m"],
  [/lying triceps press|triceps press to chin/, "press francés", "m"],
  [/jm press/, "press JM", "m"],
  [/tate press/, "press Tate", "m"],
  [/seated triceps press/, "extensión de tríceps", "f"],
  [/reverse triceps bench press/, "press de banca inverso", "m"],
  [/body tricep press/, "extensión de tríceps en el suelo", "f"],
  [/(triceps|tricep) pushdown|pushdown/, "jalón de tríceps", "m"],
  [/(triceps|tricep) (overhead )?extensions?|triceps extension|overhead extension/, "extensión de tríceps", "f"],
  [/(tricep|triceps) (dumbbell )?kickback/, "patada de tríceps", "f"],
  [/farmers walk/, "paseo del granjero", "m"],
  [/wrist roller/, "rodillo de muñeca", "m"],
  [/pronation/, "pronación de muñeca", "f"],
  [/supination/, "supinación de muñeca", "f"],

  // Piernas
  [/calf press on the leg press/, "prensa de gemelos", "f"],
  [/leg press/, "prensa de piernas", "f"],
  [/calf press/, "prensa de gemelos", "f"],
  [/hack squats?/, "sentadilla hack", "f"],
  [/front (barbell )?squats?( clean grip)?/, "sentadilla frontal", "f"],
  [/goblet squat/, "sentadilla goblet", "f"],
  [/pistol squat/, "sentadilla pistol", "f"],
  [/sissy squat/, "sentadilla sissy", "f"],
  [/zercher squats?/, "sentadilla Zercher", "f"],
  [/overhead (kettlebell )?squats?/, "sentadilla overhead", "f"],
  [/olympic squat/, "sentadilla olímpica", "f"],
  [/speed box squat/, "sentadilla al cajón explosiva", "f"],
  [/high box squat/, "sentadilla a cajón alto", "f"],
  [/box squat/, "sentadilla al cajón", "f"],
  [/squat to a bench/, "sentadilla al banco", "f"],
  [/jump squat/, "sentadilla con salto", "f"],
  [/split squats?/, "sentadilla búlgara", "f"],
  [/plie (dumbbell )?squat/, "sentadilla plié", "f"],
  [/speed squats?/, "sentadilla explosiva", "f"],
  [/full squat/, "sentadilla profunda", "f"],
  [/bodyweight squat/, "sentadilla libre", "f"],
  [/squats?/, "sentadilla", "f"],
  [/walking lunge/, "zancada caminando", "f"],
  [/elevated back lunge/, "zancada atrás con pie elevado", "f"],
  [/rear lunge|back lunge/, "zancada hacia atrás", "f"],
  [/lunge pass through/, "zancada con pase", "f"],
  [/lunges?/, "zancada", "f"],
  [/step up with knee raise/, "subida al cajón con rodilla", "f"],
  [/step ups?/, "subida al cajón", "f"],
  [/leg extensions?/, "extensión de piernas", "f"],
  [/natural glute ham raise/, "curl nórdico", "m"],
  [/glute ham raise/, "glute ham raise", "m"],
  [/hip thrust/, "hip thrust", "m"],
  [/glute bridge|hip bridge|butt lift bridge|hip lift/, "puente de glúteo", "m"],
  [/glute kickback|cable kickback/, "patada de glúteo", "f"],
  [/thigh abductor/, "abducción de cadera", "f"],
  [/thigh adductor|hip adductions?|hip adduction/, "aducción de cadera", "f"],
  [/hip extension/, "extensión de cadera", "f"],
  [/hip flexion/, "flexión de cadera", "f"],
  [/monster walk/, "caminata lateral con banda", "f"],
  [/donkey calf raises/, "elevación de talones tipo burro", "f"],
  [/calf raise on a/, "elevación de talones sobre mancuerna", "f"],
  [/reverse calf raises/, "elevación de puntas", "f"],
  [/rocking standing calf raise/, "elevación de talones con balanceo", "f"],
  [/calf raises?/, "elevación de talones", "f"],
  [/leg lift/, "elevación de pierna", "f"],
  [/flutter kicks/, "patadas de tijera", "fp"],
  [/box jump/, "salto al cajón", "m"],
  [/(knee )?tuck jump/, "salto con rodillas al pecho", "m"],
  [/scissors jump/, "salto en tijera", "m"],
  [/split jump/, "salto en zancada", "m"],
  [/star jump/, "salto de estrella", "m"],
  [/long jump/, "salto largo", "m"],
  [/rocket jump/, "salto cohete", "m"],
  [/bench jump/, "salto sobre banco", "m"],
  [/sled push/, "empuje de trineo", "m"],

  // Core
  [/ab roller|ab rollout|rollout/, "rueda abdominal", "f"],
  [/reverse crunch/, "crunch inverso", "m"],
  [/oblique crunch(es)?/, "crunch oblicuo", "m"],
  [/cross body crunch/, "crunch cruzado", "m"],
  [/tuck crunch/, "crunch encogido", "m"],
  [/crunch with alternating oblique twists/, "crunch con giro", "m"],
  [/crunch hands overhead/, "crunch con brazos arriba", "m"],
  [/crunch legs on/, "crunch con piernas en fitball", "m"],
  [/crunch(es)?/, "crunch", "m"],
  [/side jackknife/, "navaja lateral", "f"],
  [/jackknife sit up/, "navaja", "f"],
  [/frog sit ups/, "abdominal rana", "m"],
  [/janda sit up/, "abdominal Janda", "m"],
  [/press sit up/, "abdominal con press", "m"],
  [/3 4 sit up/, "abdominal 3/4", "m"],
  [/sit ups?/, "abdominal completo", "m"],
  [/knee hip raise on parallel bars/, "elevación de rodillas en paralelas", "f"],
  [/leg raise/, "elevación de piernas", "f"],
  [/hanging pike/, "pike en barra", "m"],
  [/bent knee hip raise/, "elevación de cadera con rodillas flexionadas", "f"],
  [/hip raise/, "elevación de cadera", "f"],
  [/leg pull in|pull in|leg tucks/, "encogimiento de piernas", "m"],
  [/side bridge/, "plancha lateral", "f"],
  [/plank/, "plancha", "f"],
  [/russian twists?/, "giro ruso", "m"],
  [/plate twist|barbell twist|full twist|\btwist\b/, "giro de tronco", "m"],
  [/side bends?/, "flexión lateral", "f"],
  [/wood chop/, "leñador", "m"],
  [/cable lift/, "leñador inverso", "m"],
  [/pallof press with rotation/, "press Pallof con rotación", "m"],
  [/pallof press/, "press Pallof", "m"],
  [/dead bug/, "dead bug", "m"],
  [/windmill/, "molino", "m"],
  [/pass between the legs/, "pase entre piernas", "m"],
  [/elbow to knee/, "codo a rodilla", "m"],
  [/heel touchers/, "toques de talón", "mp"],
  [/landmine 180s?/, "landmine 180", "m"],
  [/medicine ball slam|overhead slam/, "slam con balón", "m"],
  [/sledgehammer swings/, "golpes con mazo", "mp"],

  // Genéricos (al final)
  [/\bpress\b/, e => {
    const p = e.primaryMuscles;
    if (p.includes("chest")) return ["press de banca", "m"];
    if (p.includes("shoulders")) return ["press de hombros", "m"];
    return ["press", "m"];
  }],
  [/kickback/, e => (e.primaryMuscles.includes("triceps") ? ["patada de tríceps", "f"] : ["patada de glúteo", "f"])],
  [/\braise\b/, "elevación", "f"]
];

// ---------------------------------------------------------------------------
// Modificadores: se buscan en este orden (el más específico primero) y se
// escriben después del movimiento según "orden".
// ---------------------------------------------------------------------------

const G = base => ({ m: base, f: base.replace(/o$/, "a"), mp: base + "s", fp: base.replace(/o$/, "a") + "s" });

const MODS = [
  [/\bincline\b/, G("inclinado"), 1],
  [/\bdecline\b/, G("declinado"), 1],
  [/\bbent over\b/, G("inclinado"), 1],
  [/\bbent arm\b/, "con brazos flexionados", 6],
  [/\bstraight arm\b/, "con brazos rectos", 6],
  [/\breverse grip\b|\bunderhand\b|\bpalms? up\b|\bsupinated\b|\bsupine\b/, "agarre supino", 7],
  [/\bpalms? (facing )?in\b|\bneutral grip\b|\bhammer grip\b/, "agarre neutro", 7],
  [/\bpalms? down\b|\bpronated( grip)?\b/, "agarre prono", 7],
  [/\breverse\b/, G("inverso"), 2],
  [/\balternat(e|ing)\b/, G("alterno"), 2],
  [/\bseated\b/, "sentado", 3],
  [/\bstanding\b/, "de pie", 3],
  [/\blying( face (down|up))?\b|\bflat bench lying\b/, "tumbado", 3],
  [/\bprone\b/, "boca abajo", 3],
  [/\bkneeling\b|\bon knees\b/, "de rodillas", 3],
  [/\bhanging\b/, "en barra", 3],
  [/\bsuspended\b|\bwith straps\b/, "en suspensión", 3],
  [/\b(one|single) arm\b/, "a una mano", 4],
  [/\b(one|single) leg(ged)?\b/, "a una pierna", 4],
  [/\b(two|double) (arm|leg)\b|\btwo arm\b|\bdouble\b/, "", 4],
  [/\bclose grip\b|\bnarrow grip\b|\bclose\b/, "agarre cerrado", 7],
  [/\bwide stance\b/, "postura amplia", 7],
  [/\bnarrow stance\b/, "postura cerrada", 7],
  [/\bwide grip\b|\bwide\b/, "agarre abierto", 7],
  [/\bmixed grip\b/, "agarre mixto", 7],
  [/\bmedium grip\b|\bmedium\b|\bclean grip\b/, "", 7],
  [/\bbehind (the )?neck\b/, "tras nuca", 8],
  [/\bbehind the (back|head)\b/, "por detrás", 8],
  [/\bweighted\b/, "con lastre", 8],
  [/\b(with )?(a )?rope( attachment)?\b/, "con cuerda", 8],
  [/\bv bar( attachment)?\b/, "con barra V", 8],
  [/\b(from )?deficit\b/, "con déficit", 8],
  [/\bfrom blocks\b/, "desde bloques", 8],
  [/\bfull( range of motion)?\b/, G("completo"), 8],
  [/\bspeed\b|\bexplosive\b/, G("explosivo"), 8],
  [/\bwith (a )?twist\b/, "con giro", 8],
  [/\bwith (external )?rotation\b/, "con rotación", 8],
  [/\bkipping\b/, "con kipping", 8],
  [/\bon (the )?floor\b/, "en el suelo", 8],
  [/\boverhead\b/, "sobre la cabeza", 8],
  [/\bto the side\b/, "lateral", 8],
  [/\bfront\b/, "frontal", 8],
  [/\bside\b|\blateral\b/, "lateral", 8],
  [/\bplate\b/, "con disco", 9],
  [/\bflat( bench)?\b/, "", 9],
  [/\b(over|on|from|to|against) (a |the |an )?(flat |high |incline )?bench\b/, "en banco", 9],
  [/\bhigh bench\b/, "en banco alto", 9],
  [/\bwith head on bench\b|\babove head\b/, "", 9],
  [/\bon high pulley\b|\bhigh\b|\blow\b/, "", 9],
  [/\bbodyweight\b|\bbody\b/, "", 9],
  [/\belevated\b/, G("elevado"), 8],
  [/\bparallel bars?\b/, "en paralelas", 8],
  [/\bto neck\b/, "al cuello", 8],
  [/\bmid\b|\biso\b|\bab\b|\bbar\b|\bbench\b|\bdeltoid\b/, "", 9]
];

const RUIDO = new Set(["the", "a", "an", "with", "on", "to", "of", "and", "in", "version", "attachment",
  "position", "exercise", "grip", "style", "s", "db", "multiple", "response", "or", "from", "off", "pins", "chain"]);

// ---------------------------------------------------------------------------
// Sinónimos en español por movimiento (se agregan como alias para la búsqueda).
// ---------------------------------------------------------------------------

const SINONIMOS = {
  "press de banca": ["press banca", "press plano", "press de pecho", "bench press"],
  "press de pecho": ["press de banca", "press banca"],
  "press militar": ["press de hombros", "overhead press", "ohp"],
  "press de hombros": ["press militar", "press de hombro", "shoulder press"],
  "sentadilla": ["squat", "sentadillas"],
  "sentadilla búlgara": ["sentadilla dividida", "split squat", "bulgara"],
  "peso muerto": ["deadlift"],
  "peso muerto rumano": ["rdl", "peso muerto piernas rigidas"],
  "jalón al pecho": ["polea al pecho", "jalon", "lat pulldown", "polea alta"],
  "dominadas": ["pull ups", "dominada"],
  "dominadas supinas": ["chin ups", "dominadas agarre supino"],
  "fondos": ["dips", "paralelas"],
  "fondos en paralelas": ["fondos", "dips"],
  "flexiones": ["lagartijas", "push ups", "flexiones de brazos"],
  "zancada": ["estocada", "lunges", "zancadas"],
  "elevación de talones": ["pantorrillas", "gemelos", "calf raise"],
  "curl femoral": ["curl de pierna", "curl de isquios", "leg curl", "femoral"],
  "extensión de piernas": ["extensión de pierna", "extensión de cuádriceps", "sillón de cuádriceps", "leg extension"],
  "prensa de piernas": ["press de piernas", "prensa", "leg press"],
  "hip thrust": ["empuje de cadera", "empuje de caderas", "puente de glúteo con barra"],
  "puente de glúteo": ["glute bridge", "puente de cadera"],
  "remo": ["row"],
  "remo al mentón": ["remo al cuello", "upright row"],
  "remo en T": ["remo en punta", "remo landmine", "t bar row"],
  "elevación lateral": ["vuelos laterales", "laterales", "lateral raise"],
  "elevación frontal": ["vuelos frontales", "front raise"],
  "pájaros": ["vuelos posteriores", "aperturas inversas", "reverse fly", "deltoide posterior"],
  "encogimientos": ["encogimiento de hombros", "shrugs", "trapecio"],
  "press francés": ["rompecráneos", "skull crusher", "extensión de tríceps tumbado"],
  "jalón de tríceps": ["extensión de tríceps en polea", "tríceps en polea", "pushdown", "polea de tríceps"],
  "patada de tríceps": ["kickback de tríceps", "tríceps patada"],
  "aperturas": ["flyes", "fly", "cristos", "aberturas"],
  "cruce de poleas": ["crossover", "cruces", "aperturas en polea"],
  "pec deck": ["aperturas en máquina", "mariposa", "contractor de pecho", "peck deck"],
  "curl de bíceps": ["curl biceps", "curl"],
  "curl martillo": ["hammer curl", "curl neutro"],
  "curl predicador": ["curl banco scott", "curl scott", "preacher curl"],
  "crunch": ["abdominales", "encogimiento abdominal"],
  "abdominal completo": ["abdominales", "sit up"],
  "plancha": ["plank", "plancha abdominal"],
  "plancha lateral": ["side plank"],
  "giro ruso": ["russian twist"],
  "rueda abdominal": ["ab wheel", "rueda"],
  "elevación de piernas": ["leg raise", "elevaciones de piernas"],
  "cargada": ["clean"],
  "arrancada": ["snatch"],
  "abducción de cadera": ["abductores", "máquina de abductores"],
  "aducción de cadera": ["aductores", "máquina de aductores"],
  "paseo del granjero": ["farmer walk", "caminata del granjero"],
  "subida al cajón": ["step up", "subidas al banco"],
  "salto al cajón": ["box jump"],
  "escaladores": ["mountain climbers"],
  "saltar la cuerda": ["comba", "saltar soga", "soga"],
  "remo ergómetro": ["máquina de remo", "remo indoor", "rowing", "remo cardio"],
  "elíptica": ["eliptica", "elliptical"],
  "bicicleta": ["bici", "ciclismo", "cycling"],
  "bicicleta estática": ["spinning", "bici estática", "bicicleta fija"],
  "correr en cinta": ["cinta", "treadmill", "trotadora"],
  "caminar en cinta": ["caminata en cinta"],
  "swing": ["swing con kettlebell", "kettlebell swing"],
  "hiperextensiones": ["extensión lumbar", "back extension", "hiperextensión"],
  "buenos días": ["good morning"],
  "curl nórdico": ["nordic curl", "curl nordico"],
  "face pull": ["jalón a la cara", "tirón a la cara"]
};

// ---------------------------------------------------------------------------
// Correcciones puntuales (clave = nombre en inglés del dataset). Solo lo que
// el glosario no resuelve bien o lo que el dataset tiene incompleto.
// destacado = aparece primero en la búsqueda cuando hay empate.
// ---------------------------------------------------------------------------

const AJUSTES = {
  "Barbell Bench Press - Medium Grip": { destacado: true },
  "Barbell Incline Bench Press - Medium Grip": { destacado: true },
  "Decline Barbell Bench Press": { destacado: true },
  "Dumbbell Bench Press": { destacado: true },
  "Incline Dumbbell Press": { nombre: "Press de banca inclinado (Mancuerna)", destacado: true },
  "Dumbbell Flyes": { destacado: true },
  "Butterfly": { nombre: "Pec deck (Máquina)", destacado: true },
  "Cable Crossover": { secundarios: ["pecho_inferior", "deltoide_anterior"], destacado: true },
  "Pushups": { destacado: true, secundarios: ["deltoide_anterior", "triceps", "abdominales"] },
  "Barbell Squat": { destacado: true, secundarios: ["gluteos", "isquiotibiales", "aductores", "lumbares"] },
  "Barbell Deadlift": {
    destacado: true, nombre: "Peso muerto (Barra)",
    primarios: ["lumbares", "gluteos", "isquiotibiales"],
    secundarios: ["cuadriceps", "trapecio", "dorsales", "espalda_media", "antebrazos"]
  },
  "Romanian Deadlift": { destacado: true, secundarios: ["gluteos", "lumbares"] },
  "Leg Extensions": { destacado: true },
  "Lying Leg Curls": { destacado: true },
  "Dumbbell Lunges": { destacado: true, alias: ["zancadas"] },
  "Split Squat with Dumbbells": { destacado: true },
  "Wide-Grip Lat Pulldown": { nombre: "Jalón al pecho (Polea)", destacado: true, alias: ["jalón al pecho agarre abierto", "jalón", "polea al pecho"] },
  "Seated Cable Rows": { destacado: true, alias: ["remo sentado con agarre en V", "remo gironda", "remo bajo"] },
  "Bent Over Barbell Row": { destacado: true, alias: ["remo con barra"] },
  "One-Arm Dumbbell Row": { destacado: true, alias: ["remo con mancuerna"] },
  "T-Bar Row with Handle": { nombre: "Remo en T (Barra)", destacado: true },
  "Pullups": { destacado: true, secundarios: ["biceps", "espalda_media", "trapecio"] },
  "Chin-Up": { destacado: true },
  "Standing Military Press": { nombre: "Press militar (Barra)", destacado: true },
  "Dumbbell Shoulder Press": { destacado: true },
  "Arnold Dumbbell Press": { nombre: "Press Arnold (Mancuerna)" },
  "Side Lateral Raise": { destacado: true },
  "Face Pull": { destacado: true, primarios: ["deltoide_posterior"], secundarios: ["espalda_media", "trapecio"] },
  "Reverse Flyes": { destacado: true, secundarios: ["espalda_media", "trapecio"] },
  "Barbell Shrug": { destacado: true },
  "Parallel Bar Dip": { destacado: true, alias: ["fondos"] },
  "Dips - Chest Version": { destacado: true },
  "Plank": { destacado: true, secundarios: ["oblicuos", "lumbares"] },
  "Side Bridge": { secundarios: ["abdominales", "abductores"] },
  "Crunches": { destacado: true },
  "Thigh Abductor": { destacado: true },
  "Thigh Adductor": { destacado: true },
  "Kettlebell One-Legged Deadlift": { nombre: "Peso muerto a una pierna (Kettlebell)" },
  "Bicycling": { destacado: true, nombre: "Bicicleta", primarios: ["cuadriceps"], secundarios: ["gluteos", "isquiotibiales", "pantorrillas"] },
  "Running, Treadmill": { primarios: ["cuadriceps", "pantorrillas"], secundarios: ["isquiotibiales", "gluteos"] },
  "Rowing, Stationary": {
    nombre: "Remo ergómetro", primarios: ["dorsales", "espalda_media", "cuadriceps"],
    secundarios: ["biceps", "isquiotibiales", "gluteos", "lumbares", "deltoide_posterior"]
  },
  "Farmer's Walk": { secundarios: ["trapecio", "abdominales", "oblicuos"] },
  "Sled Push": { nombre: "Empuje de trineo" },
  "Natural Glute Ham Raise": { nombre: "Curl nórdico" },
  "Kettlebell Pistol Squat": { nombre: "Sentadilla pistol (Kettlebell)" },
  "Smith Machine Pistol Squat": { excluir: true },
  "Bench Dips": { alias: ["fondos en silla"] },
  "Dumbbell Raise": { excluir: true },
  "Band Pull Apart": { nombre: "Separación de banda" },
  "Single Dumbbell Raise": { nombre: "Elevación frontal con una mancuerna" },
  "Push-Ups With Feet On An Exercise Ball": { nombre: "Flexiones con pies en fitball" },
  "Close-Grip Push-Up off of a Dumbbell": { nombre: "Flexiones agarre cerrado sobre mancuerna", tipo: "peso_corporal" },
  "Push Up to Side Plank": { nombre: "Flexión a plancha lateral", tipo: "peso_corporal", factorPesoCorporal: 0.64 },
  "Trap Bar Deadlift": {
    nombre: "Peso muerto (Barra hexagonal)", equipo: "barra_hex", destacado: true,
    primarios: ["cuadriceps", "gluteos", "isquiotibiales"], secundarios: ["lumbares", "trapecio", "antebrazos"]
  },
  "Sumo Deadlift": {
    primarios: ["gluteos", "isquiotibiales", "aductores"],
    secundarios: ["cuadriceps", "lumbares", "trapecio", "espalda_media", "antebrazos"]
  },
  "Leg Press": { destacado: true, secundarios: ["gluteos", "isquiotibiales", "aductores"] },
  "Barbell Hip Thrust": { destacado: true, secundarios: ["isquiotibiales", "aductores"] },
  "Ab Roller": { nombre: "Rueda abdominal", destacado: true, secundarios: ["dorsales", "deltoide_anterior"] },
  "Weighted Pull Ups": { nombre: "Dominadas con lastre" },
  "Weighted Bench Dip": { nombre: "Fondos en banco con lastre" },
  "Push-Ups - Close Triceps Position": { nombre: "Flexiones diamante" },
  "Standing Towel Triceps Extension": { nombre: "Extensión de tríceps con toalla" },
  "Body Tricep Press": { nombre: "Extensión de tríceps en el suelo" },
  "Calf Raise On A Dumbbell": { nombre: "Elevación de talones sobre mancuerna" },
  "Bent Over Dumbbell Rear Delt Raise With Head On Bench": { nombre: "Pájaros con cabeza apoyada (Mancuerna)" },
  "Standing Dumbbell Straight-Arm Front Delt Raise Above Head": { nombre: "Elevación frontal sobre la cabeza (Mancuerna)" },
  "Standing Front Barbell Raise Over Head": { nombre: "Elevación frontal sobre la cabeza (Barra)" },
  "Monster Walk": { nombre: "Caminata lateral con banda" },
  "Mountain Climbers": { tipo: "cardio" },
  "Rope Jumping": { nombre: "Saltar la cuerda", primarios: ["pantorrillas"], secundarios: ["cuadriceps", "deltoide_lateral", "antebrazos"] },
  "Elliptical Trainer": { secundarios: ["gluteos", "isquiotibiales", "pantorrillas", "deltoide_anterior"] },
  "Battling Ropes": { tipo: "cardio" },
  "Rocky Pull-Ups/Pulldowns": { excluir: true },
  "Low Cable Crossover": { nombre: "Cruce de poleas bajo (Polea)" },
  "Single-Arm Cable Crossover": { nombre: "Cruce de poleas a una mano (Polea)" },
  "Cross Over - With Bands": { nombre: "Cruce con bandas (Banda)" },
  "Flat Bench Cable Flyes": { nombre: "Aperturas en banco (Polea)" },
  "Kettlebell Seesaw Press": { excluir: true },
  "Middle Back Shrug": { nombre: "Encogimiento de escápulas (Mancuerna)" },
  "Leverage Iso Row": { nombre: "Remo unilateral (Máquina)" },
  "Straight Bar Bench Mid Rows": { nombre: "Remo en banco (Barra)" },
  "Elevated Cable Rows": { nombre: "Remo con pies elevados (Polea)" },
  "Cable Rope Rear-Delt Rows": { nombre: "Remo al deltoide posterior con cuerda (Polea)" },
  "Low Pulley Row To Neck": { nombre: "Remo al cuello (Polea)" },
  "Bodyweight Mid Row": { nombre: "Remo con peso corporal" },
  "Lying T-Bar Row": { nombre: "Remo en T con pecho apoyado (Máquina)" },
  "Bent Over One-Arm Long Bar Row": { nombre: "Remo landmine a una mano (Barra)" },
  "Bent Over Two-Arm Long Bar Row": { nombre: "Remo landmine (Barra)" },
  "One-Arm Long Bar Row": { excluir: true },
  "Barbell Rear Delt Row": { nombre: "Remo al deltoide posterior (Barra)" },
  "Incline Bench Pull": { nombre: "Remo en banco inclinado (Barra)" },
  "Dumbbell Incline Row": { nombre: "Remo con pecho apoyado (Mancuerna)" },
  "Kneeling High Pulley Row": { nombre: "Remo alto de rodillas (Polea)" },
  "Kneeling Single-Arm High Pulley Row": { nombre: "Remo alto de rodillas a una mano (Polea)" },
  "Shotgun Row": { nombre: "Remo escopeta (Polea)" },
  "Seated One-arm Cable Pulley Rows": { nombre: "Remo sentado a una mano (Polea)" },
  "Close-Grip Front Lat Pulldown": { nombre: "Jalón al pecho agarre cerrado (Polea)" },
  "Full Range-Of-Motion Lat Pulldown": { nombre: "Jalón al pecho completo (Polea)" },
  "Underhand Cable Pulldowns": { nombre: "Jalón al pecho agarre supino (Polea)" },
  "V-Bar Pulldown": { nombre: "Jalón al pecho con barra V (Polea)" },
  "Wide-Grip Pulldown Behind The Neck": { nombre: "Jalón tras nuca (Polea)" },
  "One Arm Lat Pulldown": { nombre: "Jalón al pecho a una mano (Polea)" },
  "Rope Straight-Arm Pulldown": { nombre: "Jalón con brazos rectos con cuerda (Polea)" },
  "Straight-Arm Pulldown": { nombre: "Jalón con brazos rectos (Polea)" },
  "V-Bar Pullup": { nombre: "Dominadas con barra V" },
  "Wide-Grip Rear Pull-Up": { nombre: "Dominadas tras nuca agarre abierto" },
  "Scapular Pull-Up": { nombre: "Dominadas escapulares" },
  "Band Assisted Pull-Up": { nombre: "Dominadas asistidas con banda", tipo: "peso_corporal", factorPesoCorporal: 0.7 },
  "Mixed Grip Chin": { nombre: "Dominadas agarre mixto" },
  "One Arm Chin-Up": { nombre: "Dominadas a una mano" },
  "Kipping Muscle Up": { nombre: "Muscle up con kipping" },
  "Inverted Row with Straps": { nombre: "Remo invertido en suspensión" },
  "Suspended Row": { nombre: "Remo en suspensión (TRX)" },
  "Sled Row": { excluir: true },
  "Hyperextensions (Back Extensions)": { nombre: "Hiperextensiones", destacado: true },
  "Weighted Ball Hyperextension": { nombre: "Hiperextensiones en fitball con lastre" },
  "Reverse Hyperextension": { nombre: "Hiperextensión inversa (Máquina)" },
  "Good Morning off Pins": { nombre: "Buenos días desde pines (Barra)" },
  "Band Good Morning (Pull Through)": { nombre: "Pull through (Banda)" },
  "Hanging Bar Good Morning": { nombre: "Buenos días con barra colgada (Barra)" },
  "Seated Good Mornings": { nombre: "Buenos días sentado (Barra)" },
  "Deficit Deadlift": { nombre: "Peso muerto con déficit (Barra)" },
  "Cable Deadlifts": { nombre: "Peso muerto (Polea)" },
  "Leverage Deadlift": { nombre: "Peso muerto (Máquina)" },
  "One-Arm Side Deadlift": { nombre: "Peso muerto de maleta (Barra)" },
  "Stiff Leg Barbell Good Morning": { nombre: "Buenos días piernas rígidas (Barra)" },
  "Wide Stance Stiff Legs": { nombre: "Peso muerto piernas rígidas postura amplia (Barra)" },
  "Romanian Deadlift from Deficit": { nombre: "Peso muerto rumano con déficit (Barra)" },
  "Smith Machine Stiff-Legged Deadlift": { nombre: "Peso muerto piernas rígidas (Máquina Smith)" },
  "Deadlift with Bands": { excluir: true },
  "Rack Pull with Bands": { excluir: true },
  "Box Squat with Bands": { excluir: true },
  "Sumo Deadlift with Bands": { excluir: true },
  "Squat with Bands": { excluir: true },
  "Bench Press - With Bands": { nombre: "Press de banca (Banda)" },
  "Squats - With Bands": { nombre: "Sentadilla (Banda)" },
  "Barbell Full Squat": { nombre: "Sentadilla profunda (Barra)" },
  "Barbell Squat To A Bench": { nombre: "Sentadilla al banco (Barra)" },
  "Dumbbell Squat To A Bench": { nombre: "Sentadilla al banco (Mancuerna)" },
  "Front Barbell Squat To A Bench": { nombre: "Sentadilla frontal al banco (Barra)" },
  "Front Squat (Clean Grip)": { nombre: "Sentadilla frontal agarre olímpico (Barra)" },
  "Front Barbell Squat": { nombre: "Sentadilla frontal (Barra)", destacado: true },
  "Front Squats With Two Kettlebells": { nombre: "Sentadilla frontal (Kettlebell)" },
  "One-Arm Overhead Kettlebell Squats": { nombre: "Sentadilla overhead a una mano (Kettlebell)" },
  "Single-Leg High Box Squat": { nombre: "Sentadilla a cajón alto a una pierna" },
  "Smith Single-Leg Split Squat": { nombre: "Sentadilla búlgara (Máquina Smith)" },
  "Suspended Split Squat": { nombre: "Sentadilla búlgara en suspensión" },
  "Weighted Squat": { nombre: "Sentadilla con cinturón de lastre" },
  "Weighted Jump Squat": { nombre: "Sentadilla con salto (Barra)" },
  "Freehand Jump Squat": { nombre: "Sentadilla con salto" },
  "Weighted Sissy Squat": { nombre: "Sentadilla sissy con lastre" },
  "Kneeling Squat": { nombre: "Sentadilla de rodillas (Barra)" },
  "Narrow Stance Squats": { nombre: "Sentadilla postura cerrada (Barra)" },
  "Wide Stance Barbell Squat": { nombre: "Sentadilla postura amplia (Barra)" },
  "One Leg Barbell Squat": { nombre: "Sentadilla a una pierna (Barra)" },
  "Hack Squat": { nombre: "Sentadilla hack (Máquina)", destacado: true },
  "Barbell Hack Squat": { nombre: "Sentadilla hack tras piernas (Barra)" },
  "Narrow Stance Hack Squats": { nombre: "Sentadilla hack postura cerrada (Máquina)" },
  "Goblet Squat": { destacado: true },
  "Smith Machine Squat": { destacado: true },
  "Smith Machine Leg Press": { nombre: "Prensa de piernas (Máquina Smith)" },
  "Narrow Stance Leg Press": { nombre: "Prensa de piernas postura cerrada (Máquina)" },
  "Bodyweight Walking Lunge": { nombre: "Zancada caminando" },
  "Barbell Walking Lunge": { nombre: "Zancada caminando (Barra)" },
  "Barbell Step Ups": { nombre: "Subida al cajón (Barra)" },
  "Dumbbell Step Ups": { nombre: "Subida al cajón (Mancuerna)" },
  "Step-up with Knee Raise": { nombre: "Subida al cajón con rodilla" },
  "Lunge Pass Through": { nombre: "Zancada con pase (Kettlebell)" },
  "Elevated Back Lunge": { nombre: "Zancada atrás con pie elevado (Barra)" },
  "Single-Leg Leg Extension": { nombre: "Extensión de piernas a una pierna (Máquina)" },
  "Ball Leg Curl": { nombre: "Curl femoral (Fitball)" },
  "Seated Band Hamstring Curl": { nombre: "Curl femoral sentado (Banda)" },
  "Glute Ham Raise": { nombre: "Glute ham raise (Máquina)" },
  "Butt Lift (Bridge)": { nombre: "Puente de glúteo", destacado: true, alias: ["puente de glúteos", "puente de gluteos"] },
  "Bodyweight Squat": {
    nombre: "Sentadilla al aire", destacado: true, primarios: ["cuadriceps", "gluteos"], secundarios: ["isquiotibiales"],
    alias: ["sentadilla libre", "sentadilla asistida", "sentadilla (asistida o al aire)", "sentadilla sin peso", "air squat"]
  },
  "Single Leg Glute Bridge": { nombre: "Puente de glúteo a una pierna" },
  "Physioball Hip Bridge": { nombre: "Puente de glúteo (Fitball)" },
  "Hip Lift with Band": { nombre: "Puente de glúteo (Banda)" },
  "Barbell Glute Bridge": { nombre: "Puente de glúteo (Barra)" },
  "Glute Kickback": { nombre: "Patada de glúteo" },
  "One-Legged Cable Kickback": { nombre: "Patada de glúteo (Polea)" },
  "Hip Extension with Bands": { nombre: "Extensión de cadera (Banda)" },
  "Hip Flexion with Band": { nombre: "Flexión de cadera (Banda)" },
  "Cable Hip Adduction": { nombre: "Aducción de cadera (Polea)", primarios: ["aductores"] },
  "Band Hip Adductions": { nombre: "Aducción de cadera (Banda)" },
  "Leg Lift": { nombre: "Elevación de pierna lateral", primarios: ["gluteos", "abductores"] },
  "Calf Press On The Leg Press Machine": { nombre: "Prensa de gemelos en prensa (Máquina)" },
  "Calf Press": { nombre: "Prensa de gemelos (Máquina)" },
  "Standing Calf Raises": { nombre: "Elevación de talones de pie (Máquina)", destacado: true },
  "Seated Calf Raise": { nombre: "Elevación de talones sentado (Máquina)", destacado: true },
  "Donkey Calf Raises": { nombre: "Elevación de talones tipo burro" },
  "Calf Raises - With Bands": { nombre: "Elevación de talones (Banda)" },
  "Smith Machine Reverse Calf Raises": { nombre: "Elevación de puntas (Máquina Smith)" },
  "Rocking Standing Calf Raise": { nombre: "Elevación de talones con balanceo (Barra)" },
  "Barbell Seated Calf Raise": { nombre: "Elevación de talones sentado (Barra)" },
  "Dumbbell Seated One-Leg Calf Raise": { nombre: "Elevación de talones sentado a una pierna (Mancuerna)" },
  "Flutter Kicks": { nombre: "Patadas de tijera", primarios: ["abdominales"], secundarios: ["cuadriceps"] },
  "Box Jump (Multiple Response)": { nombre: "Salto al cajón", primarios: ["cuadriceps", "gluteos"], secundarios: ["isquiotibiales", "pantorrillas"] },
  "Standing Long Jump": { nombre: "Salto largo" },
  // Pecho / hombros / brazos
  "Hammer Grip Incline DB Bench Press": { nombre: "Press de banca inclinado agarre neutro (Mancuerna)" },
  "Incline Dumbbell Bench With Palms Facing In": { excluir: true },
  "Dumbbell Bench Press with Neutral Grip": { nombre: "Press de banca agarre neutro (Mancuerna)" },
  "One Arm Dumbbell Bench Press": { nombre: "Press de banca a una mano (Mancuerna)" },
  "Close-Grip Barbell Bench Press": { nombre: "Press de banca agarre cerrado (Barra)", destacado: true },
  "Close-Grip Dumbbell Press": { nombre: "Press de banca agarre cerrado (Mancuerna)" },
  "Close-Grip EZ-Bar Press": { nombre: "Press de banca agarre cerrado (Barra EZ)" },
  "Smith Machine Close-Grip Bench Press": { nombre: "Press de banca agarre cerrado (Máquina Smith)" },
  "Wide-Grip Barbell Bench Press": { nombre: "Press de banca agarre abierto (Barra)" },
  "Wide-Grip Decline Barbell Bench Press": { nombre: "Press de banca declinado agarre abierto (Barra)" },
  "Wide-Grip Decline Barbell Pullover": { nombre: "Pullover declinado agarre abierto (Barra)" },
  "Decline Smith Press": { nombre: "Press de banca declinado (Máquina Smith)" },
  "Smith Machine Decline Press": { excluir: true },
  "Smith Machine Incline Bench Press": { nombre: "Press de banca inclinado (Máquina Smith)" },
  "Smith Machine Bench Press": { nombre: "Press de banca (Máquina Smith)" },
  "Machine Bench Press": { nombre: "Press de banca (Máquina)" },
  "Leverage Chest Press": { nombre: "Press de pecho (Máquina)", destacado: true },
  "Leverage Decline Chest Press": { nombre: "Press de pecho declinado (Máquina)" },
  "Leverage Incline Chest Press": { nombre: "Press de pecho inclinado (Máquina)" },
  "Floor Press": { nombre: "Press en el suelo (Barra)" },
  "One Arm Floor Press": { nombre: "Press en el suelo a una mano (Barra)" },
  "Alternating Floor Press": { nombre: "Press en el suelo alterno (Kettlebell)" },
  "One-Arm Kettlebell Floor Press": { nombre: "Press en el suelo a una mano (Kettlebell)" },
  "Reverse Band Bench Press": { excluir: true },
  "Reverse Triceps Bench Press": { nombre: "Press de banca agarre supino (Barra)", primarios: ["triceps"], secundarios: ["pecho_superior", "deltoide_anterior"] },
  "Incline Push-Up": { nombre: "Flexiones inclinadas (manos elevadas)" },
  "Incline Push-Up Close-Grip": { nombre: "Flexiones inclinadas agarre cerrado" },
  "Incline Push-Up Wide": { nombre: "Flexiones inclinadas agarre abierto" },
  "Decline Push-Up": { nombre: "Flexiones declinadas (pies elevados)" },
  "Push-Ups With Feet Elevated": { excluir: true },
  "Push-Up Wide": { nombre: "Flexiones agarre abierto" },
  "Plyo Push-up": { nombre: "Flexiones pliométricas" },
  "Plyo Kettlebell Pushups": { nombre: "Flexiones pliométricas (Kettlebell)" },
  "Single-Arm Push-Up": { nombre: "Flexiones a una mano" },
  "Suspended Push-Up": { nombre: "Flexiones en suspensión (TRX)" },
  "Isometric Chest Squeezes": { tipo: "isometrico" },
  // Cuello
  "Isometric Neck Exercise - Front And Back": {
    nombre: "Cuello isométrico adelante y atrás", tipo: "isometrico", destacado: true,
    alias: ["cuello isometrico", "neck isometric", "isométrico frontal", "isométrico frontal / lateral", "isometrico de cuello"]
  },
  "Isometric Neck Exercise - Sides": { nombre: "Cuello isométrico lateral", tipo: "isometrico", alias: ["cuello lateral", "neck side isometric"] },
  "Lying Face Down Plate Neck Resistance": { nombre: "Extensión de cuello con disco", tipo: "carga", equipo: "otro", alias: ["extensión de cuello", "neck extension"], secundarios: ["trapecio"], destacado: true },
  "Lying Face Up Plate Neck Resistance": { nombre: "Flexión de cuello con disco", tipo: "carga", equipo: "otro", alias: ["flexión de cuello", "neck curl", "neck flexion"], destacado: true },
  "Seated Head Harness Neck Resistance": { nombre: "Extensión de cuello con arnés", tipo: "carga", equipo: "otro", alias: ["arnés de cuello", "neck harness"], secundarios: ["trapecio"] },
  "Bent-Arm Barbell Pullover": { nombre: "Pullover con brazos flexionados (Barra)" },
  "Bent-Arm Dumbbell Pullover": { nombre: "Pullover con brazos flexionados (Mancuerna)" },
  "Straight-Arm Dumbbell Pullover": { nombre: "Pullover (Mancuerna)", destacado: true },
  "Incline Dumbbell Flyes - With A Twist": { nombre: "Aperturas inclinadas con giro (Mancuerna)" },
  "One-Arm Flat Bench Dumbbell Flye": { nombre: "Aperturas a una mano (Mancuerna)" },
  "Reverse Machine Flyes": { nombre: "Pec deck inverso (Máquina)", destacado: true },
  "Back Flyes - With Bands": { nombre: "Pájaros (Banda)" },
  "Reverse Flyes With External Rotation": { nombre: "Pájaros con rotación externa (Mancuerna)" },
  "Cable Rear Delt Fly": { nombre: "Pájaros (Polea)" },
  "Seated Bent-Over Rear Delt Raise": { nombre: "Pájaros sentado (Mancuerna)" },
  "Dumbbell Lying Rear Lateral Raise": { nombre: "Pájaros tumbado (Mancuerna)" },
  "Dumbbell Lying One-Arm Rear Lateral Raise": { nombre: "Pájaros tumbado a una mano (Mancuerna)" },
  "Lying Rear Delt Raise": { nombre: "Pájaros boca abajo (Mancuerna)" },
  "Bent Over Low-Pulley Side Lateral": { nombre: "Pájaros inclinado (Polea)" },
  "Seated Barbell Military Press": { nombre: "Press militar sentado (Barra)" },
  "Standing Barbell Press Behind Neck": { nombre: "Press militar tras nuca (Barra)" },
  "Machine Shoulder (Military) Press": { nombre: "Press de hombros (Máquina)", destacado: true },
  "Leverage Shoulder Press": { excluir: true },
  "Smith Machine Overhead Shoulder Press": { nombre: "Press de hombros (Máquina Smith)" },
  "Barbell Shoulder Press": { excluir: true },
  "Seated Dumbbell Press": { nombre: "Press de hombros sentado (Mancuerna)" },
  "Standing Dumbbell Press": { nombre: "Press de hombros de pie (Mancuerna)" },
  "Standing Alternating Dumbbell Press": { nombre: "Press de hombros alterno de pie (Mancuerna)" },
  "Standing Palms-In Dumbbell Press": { nombre: "Press de hombros agarre neutro (Mancuerna)" },
  "Standing Palm-In One-Arm Dumbbell Press": { nombre: "Press de hombros agarre neutro a una mano (Mancuerna)" },
  "Dumbbell One-Arm Shoulder Press": { nombre: "Press de hombros a una mano (Mancuerna)" },
  "Kettlebell Seated Press": { nombre: "Press de hombros sentado (Kettlebell)" },
  "Alternating Kettlebell Press": { nombre: "Press de hombros alterno (Kettlebell)" },
  "Two-Arm Kettlebell Military Press": { nombre: "Press militar (Kettlebell)" },
  "One-Arm Kettlebell Military Press To The Side": { nombre: "Press militar a una mano (Kettlebell)" },
  "Alternating Cable Shoulder Press": { nombre: "Press de hombros alterno (Polea)" },
  "Seated Cable Shoulder Press": { nombre: "Press de hombros sentado (Polea)" },
  "Shoulder Press - With Bands": { nombre: "Press de hombros (Banda)" },
  "See-Saw Press (Alternating Side Press)": { nombre: "Press de hombros alterno lateral (Mancuerna)" },
  "Bradford/Rocky Presses": { nombre: "Press Bradford (Barra)" },
  "Standing Bradford Press": { excluir: true },
  "Handstand Push-Ups": { nombre: "Flexiones en parada de manos" },
  "Cable Seated Lateral Raise": { nombre: "Elevación lateral sentado (Polea)" },
  "Lateral Raise - With Bands": { nombre: "Elevación lateral (Banda)" },
  "One-Arm Side Laterals": { nombre: "Elevación lateral a una mano (Mancuerna)" },
  "One-Arm Incline Lateral Raise": { nombre: "Elevación lateral inclinado a una mano (Mancuerna)" },
  "Lying One-Arm Lateral Raise": { nombre: "Elevación lateral tumbado a una mano (Mancuerna)" },
  "Seated Side Lateral Raise": { nombre: "Elevación lateral sentado (Mancuerna)" },
  "Side Laterals to Front Raise": { nombre: "Elevación lateral y frontal (Mancuerna)" },
  "Alternating Deltoid Raise": { nombre: "Elevación lateral y frontal alterna (Mancuerna)" },
  "Standing Low-Pulley Deltoid Raise": { nombre: "Elevación lateral a una mano (Polea)" },
  "Front Two-Dumbbell Raise": { excluir: true },
  "Front Dumbbell Raise": { nombre: "Elevación frontal (Mancuerna)", destacado: true },
  "Front Incline Dumbbell Raise": { nombre: "Elevación frontal inclinada (Mancuerna)" },
  "Front Plate Raise": { nombre: "Elevación frontal con disco" },
  "Front Cable Raise": { nombre: "Elevación frontal (Polea)" },
  "Barbell Incline Shoulder Raise": { nombre: "Elevación de hombros tumbado (Barra)", primarios: ["deltoide_anterior"] },
  "Dumbbell Incline Shoulder Raise": { nombre: "Elevación de hombros tumbado (Mancuerna)", primarios: ["deltoide_anterior"] },
  "Smith Incline Shoulder Raise": { nombre: "Elevación de hombros tumbado (Máquina Smith)", primarios: ["deltoide_anterior"] },
  "Upright Barbell Row": { nombre: "Remo al mentón (Barra)", destacado: true },
  "Dumbbell One-Arm Upright Row": { nombre: "Remo al mentón a una mano (Mancuerna)" },
  "Smith Machine One-Arm Upright Row": { nombre: "Remo al mentón a una mano (Máquina Smith)" },
  "Standing Dumbbell Upright Row": { nombre: "Remo al mentón (Mancuerna)" },
  "Upright Cable Row": { nombre: "Remo al mentón (Polea)" },
  "Upright Row - With Bands": { nombre: "Remo al mentón (Banda)" },
  "Smith Machine Upright Row": { nombre: "Remo al mentón (Máquina Smith)" },
  "Kettlebell Sumo High Pull": { nombre: "Tirón alto sumo (Kettlebell)", primarios: ["trapecio", "deltoide_lateral"] },
  "External Rotation": { nombre: "Rotación externa (Mancuerna)" },
  "Kettlebell Arnold Press": { nombre: "Press Arnold (Kettlebell)" },
  "Kettlebell Halo": { nombre: "Halo (Kettlebell)" },
  "Kettlebell Thruster": { nombre: "Thruster (Kettlebell)" },
  "Kettlebell Turkish Get-Up (Lunge style)": { nombre: "Levantamiento turco en zancada (Kettlebell)" },
  "Kettlebell Turkish Get-Up (Squat style)": { nombre: "Levantamiento turco en sentadilla (Kettlebell)" },
  "Clean and Press": { nombre: "Cargada y press (Barra)" },
  "Smith Machine Behind the Back Shrug": { nombre: "Encogimientos por detrás (Máquina Smith)" },
  "Barbell Shrug Behind The Back": { nombre: "Encogimientos por detrás (Barra)" },
  "Leverage Shrug": { nombre: "Encogimientos (Máquina)" },
  "Cable Shrugs": { nombre: "Encogimientos (Polea)" },
  // Brazos
  "Barbell Curl": { nombre: "Curl de bíceps (Barra)", destacado: true },
  "Close-Grip EZ Bar Curl": { nombre: "Curl de bíceps agarre cerrado (Barra EZ)" },
  "Close-Grip EZ-Bar Curl with Band": { excluir: true },
  "EZ-Bar Curl": { nombre: "Curl de bíceps (Barra EZ)", destacado: true },
  "EZ-Bar Skullcrusher": { nombre: "Press francés (Barra EZ)", destacado: true },
  "Lying Triceps Press": { nombre: "Press francés tumbado (Barra EZ)" },
  "Lying Close-Grip Barbell Triceps Press To Chin": { nombre: "Press francés al mentón (Barra EZ)" },
  "Lying Close-Grip Barbell Triceps Extension Behind The Head": { nombre: "Press francés tras la cabeza (Barra)" },
  "Band Skull Crusher": { nombre: "Press francés (Banda)" },
  "Decline Dumbbell Triceps Extension": { nombre: "Press francés declinado (Mancuerna)" },
  "Decline EZ Bar Triceps Extension": { nombre: "Press francés declinado (Barra EZ)" },
  "Lying Dumbbell Tricep Extension": { nombre: "Press francés (Mancuerna)" },
  "Incline Barbell Triceps Extension": { nombre: "Press francés inclinado (Barra)" },
  "Cable Lying Triceps Extension": { nombre: "Press francés (Polea)" },
  "Close-Grip Standing Barbell Curl": { nombre: "Curl de bíceps agarre cerrado (Barra)" },
  "Wide-Grip Standing Barbell Curl": { nombre: "Curl de bíceps agarre abierto (Barra)" },
  "Dumbbell Alternate Bicep Curl": { nombre: "Curl de bíceps alterno (Mancuerna)", destacado: true },
  "Dumbbell Bicep Curl": { nombre: "Curl de bíceps (Mancuerna)", destacado: true },
  "Seated Dumbbell Curl": { nombre: "Curl de bíceps sentado (Mancuerna)" },
  "Alternate Incline Dumbbell Curl": { nombre: "Curl de bíceps inclinado alterno (Mancuerna)" },
  "Incline Dumbbell Curl": { nombre: "Curl de bíceps inclinado (Mancuerna)", destacado: true },
  "Dumbbell Prone Incline Curl": { nombre: "Curl de bíceps boca abajo (Mancuerna)" },
  "Lying Supine Dumbbell Curl": { nombre: "Curl de bíceps tumbado (Mancuerna)" },
  "Standing Biceps Cable Curl": { nombre: "Curl de bíceps (Polea)", destacado: true },
  "Standing One-Arm Cable Curl": { nombre: "Curl de bíceps a una mano (Polea)" },
  "High Cable Curls": { nombre: "Curl de bíceps en polea alta (Polea)" },
  "Overhead Cable Curl": { nombre: "Curl de bíceps sobre la cabeza (Polea)" },
  "Lying Cable Curl": { nombre: "Curl de bíceps tumbado (Polea)" },
  "Lying Close-Grip Bar Curl On High Pulley": { nombre: "Curl de bíceps tumbado en polea alta (Polea)" },
  "Lying High Bench Barbell Curl": { nombre: "Curl de bíceps en banco alto (Barra)" },
  "Standing One-Arm Dumbbell Curl Over Incline Bench": { nombre: "Curl de bíceps a una mano en banco (Mancuerna)" },
  "Machine Bicep Curl": { nombre: "Curl de bíceps (Máquina)" },
  "Cable Hammer Curls - Rope Attachment": { nombre: "Curl martillo con cuerda (Polea)" },
  "Alternate Hammer Curl": { nombre: "Curl martillo alterno (Mancuerna)" },
  "Incline Hammer Curls": { nombre: "Curl martillo inclinado (Mancuerna)" },
  "Hammer Curls": { nombre: "Curl martillo (Mancuerna)", destacado: true },
  "Concentration Curls": { nombre: "Curl concentrado (Mancuerna)", destacado: true },
  "Standing Concentration Curl": { nombre: "Curl concentrado de pie (Mancuerna)" },
  "Seated Close-Grip Concentration Barbell Curl": { nombre: "Curl concentrado sentado (Barra)" },
  "Preacher Curl": { nombre: "Curl predicador (Barra)", destacado: true },
  "Machine Preacher Curls": { nombre: "Curl predicador (Máquina)" },
  "Cable Preacher Curl": { nombre: "Curl predicador (Polea)" },
  "One Arm Dumbbell Preacher Curl": { nombre: "Curl predicador a una mano (Mancuerna)" },
  "Two-Arm Dumbbell Preacher Curl": { nombre: "Curl predicador (Mancuerna)" },
  "Reverse Barbell Preacher Curls": { nombre: "Curl predicador inverso (Barra EZ)" },
  "Reverse Barbell Curl": { nombre: "Curl inverso (Barra)" },
  "Reverse Cable Curl": { nombre: "Curl inverso (Polea)" },
  "Standing Dumbbell Reverse Curl": { nombre: "Curl inverso (Mancuerna)" },
  "Triceps Pushdown": { nombre: "Jalón de tríceps (Polea)", destacado: true },
  "Triceps Pushdown - Rope Attachment": { nombre: "Jalón de tríceps con cuerda (Polea)", destacado: true },
  "Triceps Pushdown - V-Bar Attachment": { nombre: "Jalón de tríceps con barra V (Polea)" },
  "Reverse Grip Triceps Pushdown": { nombre: "Jalón de tríceps agarre supino (Polea)" },
  "Triceps Overhead Extension with Rope": { nombre: "Extensión de tríceps sobre la cabeza con cuerda (Polea)", destacado: true },
  "Cable Rope Overhead Triceps Extension": { excluir: true },
  "Cable One Arm Tricep Extension": { nombre: "Extensión de tríceps a una mano (Polea)" },
  "Cable Incline Triceps Extension": { nombre: "Extensión de tríceps inclinado (Polea)" },
  "Kneeling Cable Triceps Extension": { nombre: "Extensión de tríceps de rodillas (Polea)" },
  "Low Cable Triceps Extension": { nombre: "Extensión de tríceps sobre la cabeza (Polea)" },
  "Standing Low-Pulley One-Arm Triceps Extension": { nombre: "Extensión de tríceps a una mano de pie (Polea)" },
  "Standing Dumbbell Triceps Extension": { nombre: "Extensión de tríceps sobre la cabeza (Mancuerna)", destacado: true },
  "Standing One-Arm Dumbbell Triceps Extension": { nombre: "Extensión de tríceps a una mano (Mancuerna)" },
  "Dumbbell One-Arm Triceps Extension": { nombre: "Extensión de tríceps tumbado a una mano (Mancuerna)" },
  "Standing Overhead Barbell Triceps Extension": { nombre: "Extensión de tríceps sobre la cabeza (Barra)" },
  "Seated Triceps Press": { nombre: "Extensión de tríceps sentado (Mancuerna)" },
  "Kettlebell Overhead Triceps Extension": { nombre: "Extensión de tríceps sobre la cabeza (Kettlebell)" },
  "Machine Triceps Extension": { nombre: "Extensión de tríceps (Máquina)" },
  "Dumbbell Tricep Extension -Pronated Grip": { nombre: "Extensión de tríceps agarre prono (Mancuerna)" },
  "One Arm Pronated Dumbbell Triceps Extension": { nombre: "Extensión de tríceps tumbado agarre prono (Mancuerna)" },
  "One Arm Supinated Dumbbell Triceps Extension": { nombre: "Extensión de tríceps tumbado agarre supino (Mancuerna)" },
  "Seated Bent-Over One-Arm Dumbbell Triceps Extension": { nombre: "Patada de tríceps sentado a una mano (Mancuerna)" },
  "Seated Bent-Over Two-Arm Dumbbell Triceps Extension": { nombre: "Patada de tríceps sentado (Mancuerna)" },
  "Standing Bent-Over One-Arm Dumbbell Triceps Extension": { nombre: "Patada de tríceps de pie a una mano (Mancuerna)" },
  "Standing Bent-Over Two-Arm Dumbbell Triceps Extension": { nombre: "Patada de tríceps de pie (Mancuerna)" },
  "Tricep Dumbbell Kickback": { nombre: "Patada de tríceps (Mancuerna)", destacado: true },
  "Dips - Triceps Version": { nombre: "Fondos para tríceps" },
  "Dip Machine": { nombre: "Fondos (Máquina)" },
  "Ring Dips": { nombre: "Fondos en anillas" },
  "JM Press": { nombre: "Press JM (Barra)" },
  "Tate Press": { nombre: "Press Tate (Mancuerna)" },
  "Finger Curls": { nombre: "Curl de dedos (Barra)" },
  "Cable Wrist Curl": { nombre: "Curl de muñeca (Polea)" },
  "Palms-Down Dumbbell Wrist Curl Over A Bench": { nombre: "Curl de muñeca agarre prono (Mancuerna)" },
  "Palms-Down Wrist Curl Over A Bench": { nombre: "Curl de muñeca agarre prono (Barra)" },
  "Palms-Up Barbell Wrist Curl Over A Bench": { nombre: "Curl de muñeca (Barra)", destacado: true },
  "Palms-Up Dumbbell Wrist Curl Over A Bench": { nombre: "Curl de muñeca (Mancuerna)" },
  "Seated Dumbbell Palms-Down Wrist Curl": { nombre: "Curl de muñeca sentado agarre prono (Mancuerna)" },
  "Seated Dumbbell Palms-Up Wrist Curl": { nombre: "Curl de muñeca sentado (Mancuerna)" },
  "Seated One-Arm Dumbbell Palms-Down Wrist Curl": { nombre: "Curl de muñeca sentado agarre prono a una mano (Mancuerna)" },
  "Seated One-Arm Dumbbell Palms-Up Wrist Curl": { nombre: "Curl de muñeca sentado a una mano (Mancuerna)" },
  "Seated Palm-Up Barbell Wrist Curl": { nombre: "Curl de muñeca sentado (Barra)" },
  "Seated Palms-Down Barbell Wrist Curl": { nombre: "Curl de muñeca sentado agarre prono (Barra)" },
  "Seated Two-Arm Palms-Up Low-Pulley Wrist Curl": { nombre: "Curl de muñeca sentado (Polea)" },
  "Standing Palms-Up Barbell Behind The Back Wrist Curl": { nombre: "Curl de muñeca por detrás (Barra)" },
  "Wrist Roller": { nombre: "Rodillo de muñeca" },
  "Dumbbell Lying Pronation": { nombre: "Pronación de muñeca (Mancuerna)" },
  "Dumbbell Lying Supination": { nombre: "Supinación de muñeca (Mancuerna)" },
  // Core
  "Barbell Ab Rollout": { nombre: "Rueda abdominal de pie (Barra)" },
  "Barbell Ab Rollout - On Knees": { nombre: "Rueda abdominal de rodillas (Barra)" },
  "Barbell Rollout from Bench": { nombre: "Rueda abdominal desde banco (Barra)" },
  "Ab Crunch Machine": { nombre: "Crunch (Máquina)" },
  "Cable Crunch": { nombre: "Crunch de rodillas (Polea)", destacado: true },
  "Cable Seated Crunch": { nombre: "Crunch sentado (Polea)" },
  "Rope Crunch": { nombre: "Crunch con cuerda (Polea)" },
  "Standing Rope Crunch": { nombre: "Crunch de pie con cuerda (Polea)" },
  "Cable Reverse Crunch": { nombre: "Crunch inverso (Polea)" },
  "Kneeling Cable Crunch With Alternating Oblique Twists": { nombre: "Crunch con giro de rodillas (Polea)", primarios: ["oblicuos", "abdominales"] },
  "Weighted Crunches": { nombre: "Crunch con lastre (Balón medicinal)" },
  "Exercise Ball Crunch": { nombre: "Crunch (Fitball)" },
  "Decline Oblique Crunch": { nombre: "Crunch oblicuo declinado" },
  "Oblique Crunches - On The Floor": { nombre: "Crunch oblicuo en el suelo" },
  "Air Bike": { nombre: "Crunch bicicleta", primarios: ["oblicuos", "abdominales"] },
  "Seated Flat Bench Leg Pull-In": { nombre: "Encogimiento de piernas sentado en banco" },
  "Flat Bench Leg Pull-In": { nombre: "Encogimiento de piernas en banco" },
  "Flat Bench Lying Leg Raise": { nombre: "Elevación de piernas tumbado en banco" },
  "Hanging Leg Raise": { nombre: "Elevación de piernas en barra", destacado: true },
  "Knee/Hip Raise On Parallel Bars": { nombre: "Elevación de rodillas en paralelas" },
  "Hanging Pike": { nombre: "Pike en barra" },
  "Smith Machine Hip Raise": { nombre: "Elevación de cadera (Máquina Smith)" },
  "Russian Twist": { nombre: "Giro ruso", destacado: true },
  "Cable Russian Twists": { nombre: "Giro ruso (Polea)" },
  "Plate Twist": { nombre: "Giro de tronco con disco" },
  "Seated Barbell Twist": { nombre: "Giro de tronco sentado (Barra)" },
  "Medicine Ball Full Twist": { nombre: "Giro de tronco completo (Balón medicinal)" },
  "Standing Cable Wood Chop": { nombre: "Leñador (Polea)", destacado: true },
  "Standing Cable Lift": { nombre: "Leñador inverso (Polea)" },
  "One-Arm High-Pulley Cable Side Bends": { nombre: "Flexión lateral en polea alta (Polea)" },
  "Weighted Ball Side Bend": { nombre: "Flexión lateral (Fitball)" },
  "Pallof Press": { nombre: "Press Pallof (Polea)", primarios: ["oblicuos", "abdominales"] },
  "Pallof Press With Rotation": { nombre: "Press Pallof con rotación (Polea)", primarios: ["oblicuos", "abdominales"] },
  "Dead Bug": {
    nombre: "Dead bug", destacado: true, secundarios: ["lumbares"],
    alias: ["dead bug asistido", "dead bug completo", "dead bug (asistido o completo)", "bicho muerto"]
  },
  "Press Sit-Up": { nombre: "Abdominal con press (Barra)" },
  "Landmine 180's": { nombre: "Landmine 180 (Barra)" },
  "One-Arm Medicine Ball Slam": { nombre: "Slam con balón a una mano (Balón medicinal)" },
  "Overhead Slam": { nombre: "Slam con balón (Balón medicinal)" },
  "Sledgehammer Swings": { nombre: "Golpes con mazo", tipo: "carga" },
  "Wind Sprints": { excluir: true },
  "Advanced Kettlebell Windmill": { nombre: "Molino avanzado (Kettlebell)" },
  "Double Kettlebell Windmill": { nombre: "Molino doble (Kettlebell)" },
  "Kettlebell Windmill": { nombre: "Molino (Kettlebell)" },
  "Alternate Heel Touchers": { nombre: "Toques de talón alternos" },
  "Cross-Body Crunch": { nombre: "Crunch cruzado" },
  "Tuck Crunch": { nombre: "Crunch encogido" },
  "Crunch - Hands Overhead": { nombre: "Crunch con brazos arriba" },
  "Crunch - Legs On Exercise Ball": { nombre: "Crunch con piernas en fitball" },
  "Exercise Ball Pull-In": { excluir: true },
  "Seated Leg Tucks": { nombre: "Encogimiento de piernas sentado" },
  "Leg Pull-In": { nombre: "Encogimiento de piernas" },
  "Bent-Knee Hip Raise": { nombre: "Elevación de cadera con rodillas flexionadas" },
  // Halterofilia y kettlebell
  "Clean": { nombre: "Cargada (Barra)" },
  "Power Clean": { nombre: "Cargada de potencia (Barra)", destacado: true },
  "Hang Clean": { nombre: "Cargada colgante (Barra)" },
  "Snatch": { nombre: "Arrancada (Barra)" },
  "Clean and Jerk": { nombre: "Dos tiempos (Barra)" },
  "One-Arm Kettlebell Swings": { nombre: "Swing a una mano (Kettlebell)" },
  "Vertical Swing": { nombre: "Swing vertical (Mancuerna)" },
  "Double Kettlebell Jerk": { nombre: "Envión doble (Kettlebell)" },
  "Double Kettlebell Push Press": { nombre: "Push press doble (Kettlebell)" },
  "Double Kettlebell Snatch": { nombre: "Arrancada doble (Kettlebell)" },
  "Two-Arm Kettlebell Clean": { nombre: "Cargada doble (Kettlebell)" },
  "Two-Arm Kettlebell Jerk": { excluir: true },
  "Two-Arm Kettlebell Row": { nombre: "Remo inclinado (Kettlebell)" },
  "Alternating Kettlebell Row": { nombre: "Remo inclinado alterno (Kettlebell)" },
  "One-Arm Kettlebell Row": { nombre: "Remo a una mano (Kettlebell)" },
  "Alternating Renegade Row": { nombre: "Remo renegado (Kettlebell)" },
  "Alternating Hang Clean": { nombre: "Cargada colgante alterna (Kettlebell)" },
  "Kettlebell Dead Clean": { nombre: "Cargada desde el suelo (Kettlebell)" },
  "Kettlebell Hang Clean": { nombre: "Cargada colgante (Kettlebell)" },
  "One-Arm Kettlebell Clean": { nombre: "Cargada a una mano (Kettlebell)" },
  "One-Arm Kettlebell Clean and Jerk": { nombre: "Dos tiempos a una mano (Kettlebell)" },
  "One-Arm Kettlebell Jerk": { nombre: "Envión a una mano (Kettlebell)" },
  "One-Arm Kettlebell Push Press": { nombre: "Push press a una mano (Kettlebell)" },
  "One-Arm Kettlebell Snatch": { nombre: "Arrancada a una mano (Kettlebell)" },
  "One-Arm Kettlebell Split Jerk": { nombre: "Envión en tijera a una mano (Kettlebell)" },
  "One-Arm Kettlebell Split Snatch": { nombre: "Arrancada en tijera a una mano (Kettlebell)" },
  "Dumbbell Clean": { nombre: "Cargada (Mancuerna)" },
  "Smith Machine Hang Power Clean": { nombre: "Cargada colgante de potencia (Máquina Smith)" },
  "Heaving Snatch Balance": { excluir: true },
  "Snatch Balance": { nombre: "Snatch balance (Barra)" },
  "Jerk Balance": { excluir: true },
  "Jerk Dip Squat": { excluir: true },
  "Push Press - Behind the Neck": { nombre: "Push press tras nuca (Barra)" },
  "Push Press": { nombre: "Push press (Barra)" },
  "Kettlebell Pass Between The Legs": { nombre: "Pase entre piernas (Kettlebell)" },
  // Cardio
  "Bicycling, Stationary": { nombre: "Bicicleta estática", destacado: true, primarios: ["cuadriceps"], secundarios: ["gluteos", "isquiotibiales", "pantorrillas"] },
  "Recumbent Bike": { nombre: "Bicicleta reclinada", primarios: ["cuadriceps"], secundarios: ["gluteos", "isquiotibiales"] },
  "Jogging, Treadmill": { nombre: "Trotar en cinta", primarios: ["cuadriceps", "pantorrillas"], secundarios: ["isquiotibiales", "gluteos"] },
  "Walking, Treadmill": { nombre: "Caminar en cinta", primarios: ["cuadriceps", "pantorrillas"], secundarios: ["gluteos", "isquiotibiales"] },
  "Stairmaster": { nombre: "Escaladora", primarios: ["cuadriceps", "gluteos"], secundarios: ["pantorrillas", "isquiotibiales"] },
  "Step Mill": { nombre: "Escaladora de escalones", primarios: ["cuadriceps", "gluteos"], secundarios: ["pantorrillas", "isquiotibiales"] },
  "Skating": { nombre: "Patinaje", secundarios: ["gluteos", "abductores", "aductores"] },
  "Fast Skipping": { nombre: "Skipping", tipo: "cardio" }
};

// Ejercicios que el dataset no trae (escritos a mano, pocos y documentados).
const EXTRA = [
  { id: "manolo-correr", nombre: "Correr", alias: ["running", "trotar", "run", "carrera", "correr al aire libre"], tipo: "cardio", equipo: "otro", primarios: ["cuadriceps", "pantorrillas"], secundarios: ["isquiotibiales", "gluteos"], destacado: true },
  { id: "manolo-caminar", nombre: "Caminar", alias: ["caminata", "walking", "andar", "paseo"], tipo: "cardio", equipo: "otro", primarios: ["cuadriceps", "pantorrillas"], secundarios: ["gluteos", "isquiotibiales"], destacado: true },
  { id: "manolo-natacion", nombre: "Natación", alias: ["nadar", "swimming", "piscina"], tipo: "cardio", equipo: "otro", primarios: ["dorsales", "deltoide_anterior"], secundarios: ["triceps", "pecho_medio", "abdominales", "cuadriceps", "gluteos"], destacado: true },
  { id: "manolo-senderismo", nombre: "Senderismo", alias: ["trekking", "hiking", "caminata en montaña", "trail"], tipo: "cardio", equipo: "otro", primarios: ["cuadriceps", "gluteos"], secundarios: ["pantorrillas", "isquiotibiales"] },
  { id: "manolo-saltos-tijera", nombre: "Saltos de tijera", alias: ["jumping jacks", "polichinelas", "tijeras"], tipo: "cardio", equipo: "peso_corporal", primarios: ["pantorrillas"], secundarios: ["cuadriceps", "deltoide_lateral", "gluteos"] },
  { id: "manolo-burpees", nombre: "Burpees", alias: ["burpee"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["cuadriceps", "pecho_medio"], secundarios: ["triceps", "deltoide_anterior", "gluteos", "abdominales"], factorPesoCorporal: 0.6 },
  { id: "manolo-sentadilla-pared", nombre: "Sentadilla isométrica en pared", alias: ["wall sit", "silla en pared", "sentadilla en pared"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["cuadriceps"], secundarios: ["gluteos", "aductores"] },
  { id: "manolo-hollow-hold", nombre: "Hollow hold", alias: ["posición hueca", "hollow body"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["abdominales"], secundarios: ["oblicuos", "cuadriceps"] },
  { id: "manolo-colgarse-barra", nombre: "Colgarse de la barra", alias: ["dead hang", "colgado en barra", "suspensión en barra"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["antebrazos"], secundarios: ["dorsales", "trapecio"] },
  { id: "manolo-elevacion-lateral-maquina", nombre: "Elevación lateral (Máquina)", alias: ["lateral raise machine", "vuelos laterales en máquina"], tipo: "carga", equipo: "maquina", primarios: ["deltoide_lateral"], secundarios: ["trapecio"] },
  { id: "manolo-elevacion-lateral-polea", nombre: "Elevación lateral (Polea)", alias: ["cable lateral raise", "vuelos laterales en polea"], tipo: "carga", equipo: "polea", primarios: ["deltoide_lateral"], secundarios: ["trapecio"] },
  { id: "manolo-hip-thrust-maquina", nombre: "Hip thrust (Máquina)", alias: ["empuje de cadera en máquina", "glute drive"], tipo: "carga", equipo: "maquina", primarios: ["gluteos"], secundarios: ["isquiotibiales"] },
  { id: "manolo-peso-muerto-rumano-mancuerna", nombre: "Peso muerto rumano (Mancuerna)", alias: ["rdl con mancuernas", "romanian deadlift dumbbell"], tipo: "carga", equipo: "mancuerna", primarios: ["isquiotibiales"], secundarios: ["gluteos", "lumbares"] },
  { id: "manolo-remo-pendlay", nombre: "Remo Pendlay (Barra)", alias: ["pendlay row"], tipo: "carga", equipo: "barra", primarios: ["espalda_media", "dorsales"], secundarios: ["biceps", "deltoide_posterior", "lumbares"] },
  { id: "manolo-puente-luchador", nombre: "Puente de luchador", alias: ["wrestler bridge", "puente de cuello", "neck bridge"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["cuello"], secundarios: ["trapecio", "gluteos", "lumbares"], factorPesoCorporal: 0.4 },
  { id: "manolo-extension-cuello-maquina", nombre: "Extensión de cuello (Máquina)", alias: ["máquina de cuello", "neck machine", "cuello en máquina"], tipo: "carga", equipo: "maquina", primarios: ["cuello"], secundarios: ["trapecio"] },
  { id: "manolo-l-sit", nombre: "L-sit", alias: ["l sit", "escuadra"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["abdominales"], secundarios: ["cuadriceps", "triceps"] },
  // Rutina de Juan (30 sept 2026). Primario = lo que mueve el ejercicio;
  // secundario = lo que ayuda o estabiliza. movilidad: true = estiramientos y
  // movilidad: solo secundarios, así el mapa los pinta suave.
  // Push
  { id: "manolo-flexion-normal", nombre: "Flexión normal", alias: ["flexiones normales", "flexion clasica", "push up normal"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["pecho_superior", "pecho_medio", "pecho_inferior"], secundarios: ["triceps", "deltoide_anterior", "abdominales"], factorPesoCorporal: 0.64 },
  { id: "manolo-flexion-rodillas", nombre: "Flexión de rodillas", alias: ["flexiones de rodillas", "flexion apoyando rodillas", "knee push up"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["pecho_superior", "pecho_medio", "pecho_inferior"], secundarios: ["triceps", "deltoide_anterior"], factorPesoCorporal: 0.49 },
  { id: "manolo-plancha-alta", nombre: "Plancha alta", alias: ["high plank", "plancha con brazos extendidos", "plancha de manos"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["abdominales", "lumbares"], secundarios: ["deltoide_anterior", "gluteos"] },
  { id: "manolo-flexion-pausa", nombre: "Flexión con pausa abajo", alias: ["flexion con pausa", "flexiones con pausa", "pause push up"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["pecho_superior", "pecho_medio", "pecho_inferior"], secundarios: ["triceps", "deltoide_anterior"], factorPesoCorporal: 0.64 },
  // Barra (tracción)
  { id: "manolo-colgado-activo", nombre: "Colgado activo", alias: ["active hang", "colgado activo en barra", "colgado escapular"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["dorsales", "antebrazos"], secundarios: ["trapecio", "espalda_media"] },
  { id: "manolo-negativa-controlada", nombre: "Negativa controlada", alias: ["negativas", "dominada negativa", "negativa de dominada", "negative pull up"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["dorsales"], secundarios: ["biceps"], factorPesoCorporal: 1 },
  // Piernas
  { id: "manolo-zancada-asistida", nombre: "Zancada asistida", alias: ["zancada con apoyo", "estocada asistida", "zancadas asistidas"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["cuadriceps", "gluteos"], secundarios: ["isquiotibiales"], factorPesoCorporal: 0.6 },
  { id: "manolo-elevacion-talones", destacado: true, nombre: "Elevación de talones", alias: ["elevacion de talon", "elevación de talón (sentado o de pie)", "elevacion de talones sin peso", "calf raise sin peso"], tipo: "peso_corporal", equipo: "peso_corporal", primarios: ["pantorrillas"], secundarios: [], factorPesoCorporal: 1 },
  // Core
  { id: "manolo-plancha-rodillas", nombre: "Plancha en rodillas", alias: ["plancha de rodillas", "plancha en rodillas / plancha alta", "knee plank"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["abdominales"], secundarios: ["lumbares"] },
  { id: "manolo-puente-gluteo-isometrico", nombre: "Puente de glúteos isométrico", alias: ["puente de gluteos con marcha", "puente con marcha", "puente de glúteos isométrico/con marcha", "glute bridge hold", "glute bridge march"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["gluteos"], secundarios: ["abdominales", "lumbares"] },
  // Tobillos
  { id: "manolo-circulos-tobillo", nombre: "Círculos de tobillo", alias: ["circulos de tobillos", "rotacion de tobillo", "ankle circles"], tipo: "isometrico", equipo: "peso_corporal", primarios: [], secundarios: ["pantorrillas"], movilidad: true },
  { id: "manolo-movilidad-rodilla-adelante", nombre: "Movilidad de rodilla adelante", alias: ["rodilla a la pared", "knee to wall", "dorsiflexion de tobillo"], tipo: "isometrico", equipo: "peso_corporal", primarios: [], secundarios: ["pantorrillas"], movilidad: true },
  { id: "manolo-balance-una-pierna", nombre: "Balance a una pierna", alias: ["equilibrio a una pierna", "balance en una pierna", "single leg balance"], tipo: "isometrico", equipo: "peso_corporal", primarios: ["abductores"], secundarios: ["pantorrillas", "gluteos"] },
  // Flexibilidad
  { id: "manolo-estiramiento-isquios", nombre: "Estiramiento de isquios", alias: ["estiramiento de isquiotibiales", "hamstring stretch", "estirar isquios"], tipo: "isometrico", equipo: "peso_corporal", primarios: [], secundarios: ["isquiotibiales"], movilidad: true },
  { id: "manolo-estocada-baja", nombre: "Estocada baja (mantenida)", alias: ["estocada baja", "estocada baja mantenida", "low lunge", "estiramiento de flexor de cadera"], tipo: "isometrico", equipo: "peso_corporal", primarios: [], secundarios: ["cuadriceps"], movilidad: true },
  // Cuello
  { id: "manolo-flexion-extension-cervical", nombre: "Flexión / extensión cervical", alias: ["flexion cervical", "extension cervical", "flexion y extension de cuello", "flexión/extensión cervical"], tipo: "carga", equipo: "otro", primarios: ["cuello"], secundarios: [] }
];

// ---------------------------------------------------------------------------
// Músculos: dataset → 22 regiones de Manolo, con refinamientos.
// ---------------------------------------------------------------------------

function regionPecho(n) {
  if (/incline push ?up/.test(n)) return "pecho_inferior";   // manos elevadas
  if (/decline push ?up|feet elevated/.test(n)) return "pecho_superior"; // pies elevados
  if (/low cable crossover|incline/.test(n)) return "pecho_superior";
  if (/decline|\bdips?\b/.test(n)) return "pecho_inferior";
  return "pecho_medio";
}

function regionHombro(n, e, rol) {
  if (/lateral|side raise|upright|high pull|deltoid raise|y raise/.test(n) && !/rear lateral|bent over low pulley side lateral/.test(n)) return "deltoide_lateral";
  if (/rear|reverse fl|back fl|face pull|pull apart|bent over .*raise|external rotation|reverse machine fl/.test(n)) return "deltoide_posterior";
  // En remos, jalones y dominadas el hombro que acompaña es el posterior.
  const prim = e.primaryMuscles;
  if (rol === "secundario" && !/pullover/.test(n) && prim.some(m => ["lats", "middle back", "traps"].includes(m))) return "deltoide_posterior";
  if (/front|press|jerk|push|arnold|thruster|snatch|clean|halo|get up|internal rotation|dip|fly|flye|crossover|pullover|raise|swing|slam|roll|lift|chop|landmine|climber/.test(n)) return "deltoide_anterior";
  if (e.force === "pull") return "deltoide_posterior";
  return "deltoide_anterior";
}

function regionAbs(n) {
  return /oblique|twist|side bend|side bridge|side plank|wood chop|cable lift|russian|windmill|side jackknife|cross body|elbow to knee|heel touch|landmine 180|pallof|air bike|side to side/.test(n)
    ? "oblicuos" : "abdominales";
}

const DIRECTO = {
  lats: "dorsales", "middle back": "espalda_media", traps: "trapecio", "lower back": "lumbares",
  biceps: "biceps", triceps: "triceps", forearms: "antebrazos", quadriceps: "cuadriceps",
  hamstrings: "isquiotibiales", glutes: "gluteos", adductors: "aductores", abductors: "abductores",
  calves: "pantorrillas", neck: "cuello"
};

function mapear(musculo, n, e, rol) {
  if (musculo === "chest") return regionPecho(n);
  if (musculo === "shoulders") return regionHombro(n, e, rol);
  if (musculo === "abdominals") return regionAbs(n);
  return DIRECTO[musculo] || null;
}

function musculos(e, n) {
  const prim = [...new Set(e.primaryMuscles.map(m => mapear(m, n, e, "primario")).filter(Boolean))];
  const sec = [...new Set(e.secondaryMuscles.map(m => mapear(m, n, e, "secundario")).filter(Boolean))];
  // Press de hombros: el deltoide lateral también trabaja (secundario).
  if (prim.includes("deltoide_anterior") && /press|jerk|thruster/.test(n) && e.primaryMuscles.includes("shoulders")) sec.push("deltoide_lateral");
  // Elevaciones laterales y pájaros: el trapecio acompaña.
  if (prim.includes("deltoide_lateral") && /lateral|upright/.test(n) && !sec.includes("trapecio") && !prim.includes("trapecio")) sec.push("trapecio");
  // En sentadillas, zancadas, prensas, pesos muertos y puentes las pantorrillas
  // solo estabilizan: no las contamos (sí en saltos, carrera, etc.).
  if (/squat|lunge|leg press|step up|deadlift|hip thrust|bridge|good morning/.test(n) && !/jump/.test(n)) {
    const i = sec.indexOf("pantorrillas");
    if (i >= 0) sec.splice(i, 1);
  }
  return { primarios: prim, secundarios: [...new Set(sec)].filter(m => !prim.includes(m)) };
}

// ---------------------------------------------------------------------------
// Tipo y factor de peso corporal (estimaciones: fracción del peso que mueve
// cada ejercicio; ver docs/mapa-muscular.md).
// ---------------------------------------------------------------------------

const FACTORES = [
  [/handstand push/, 0.95],
  [/incline push ?up/, 0.5],
  [/decline push ?up|feet elevated|feet on/, 0.72],
  [/single arm push|one arm push/, 0.8],
  [/push ?ups?|pushups/, 0.64],
  [/muscle up|rope climb|pull ?ups?|chin|pullups/, 1],
  [/bench dip/, 0.55],
  [/\bdips?\b/, 0.92],
  [/inverted row|suspended row|mid row/, 0.6],
  [/pistol|single leg high box|one leg/, 0.8],
  [/step up/, 0.8],
  [/squat|lunge/, 0.7],
  [/calf raise/, 1],
  [/glute ham|nordic/, 0.6],
  [/hyperextension|ab roller|rollout/, 0.5],
  [/leg raise|knee hip raise|hanging pike|leg pull in|leg tucks|bent knee hip raise/, 0.35],
  [/hip raise|bridge|butt lift|hip thrust/, 0.5],
  [/sit ?up|crunch|jackknife|toucher|elbow to knee|dead bug|flutter|air bike|russian twist/, 0.3],
  [/kickback|leg lift/, 0.2],
  [/towel/, 0.3],
  [/jump|skip|climber/, 0.7]
];

function tipoDe(e, n, equipo) {
  if (e.category === "cardio") return "cardio";
  if (/plank|side bridge|isometric/.test(n)) return "isometrico";
  if (["peso_corporal", "otro", "fitball"].includes(equipo) && FACTORES.some(([re]) => re.test(n))) return "peso_corporal";
  if (equipo === "peso_corporal") return "peso_corporal";
  if (e.category === "plyometrics" && equipo !== "mancuerna" && equipo !== "barra") return "peso_corporal";
  return "carga";
}

function factorDe(tipo, n) {
  if (tipo !== "peso_corporal") return 0;
  const f = FACTORES.find(([re]) => re.test(n));
  return f ? f[1] : 0.6;
}

// ---------------------------------------------------------------------------
// Traducción del nombre
// ---------------------------------------------------------------------------

function limpiar(s) {
  return " " + s.toLowerCase().replace(/['’]/g, "").replace(/[(),/]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim() + " ";
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slug(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function traducir(e) {
  let s = limpiar(e.name);
  const n = s;

  let equipo = null;
  for (const [id, re] of EQUIPO_NOMBRE) {
    if (re.test(s)) {
      if (!equipo) equipo = id;
      s = s.replace(re, " ").replace(/\s+/g, " ");
    }
  }
  if (!equipo) equipo = EQUIPO_CAMPO[e.equipment] || "otro";
  if (equipo === "fitball") s = s.replace(/\bball\b/, " ");

  let core = null, g = "m";
  for (const [re, es, gen] of CORES) {
    if (re.test(s)) {
      if (typeof es === "function") [core, g] = es(e);
      else { core = es; g = gen; }
      s = s.replace(re, " ");
      break;
    }
  }

  const mods = [];
  for (const [re, val, orden] of MODS) {
    if (re.test(s)) {
      s = s.replace(re, " ");
      const txt = typeof val === "string" ? val : val[g];
      if (txt && !mods.some(m => m.txt === txt)) mods.push({ txt, orden });
    }
  }
  mods.sort((a, b) => a.orden - b.orden);

  const sobrantes = s.split(" ").filter(w => w && !RUIDO.has(w) && !/^\d+$/.test(w));
  return { n, core, g, mods: mods.map(m => m.txt), equipo, sobrantes };
}

function construir(e) {
  const aj = AJUSTES[e.name] || {};
  if (aj.excluir) return null;
  const t = traducir(e);
  const equipo = aj.equipo || t.equipo;
  const tipo = aj.tipo || tipoDe(e, t.n, equipo);

  let nombre = aj.nombre;
  if (!nombre) {
    if (!t.core) return { error: "sin movimiento", e, t };
    const base = [t.core, ...t.mods].join(" ");
    const conEquipo = tipo !== "cardio" && EQUIPO_LABEL[equipo] && !["peso_corporal", "otro"].includes(equipo);
    nombre = cap(base) + (conEquipo ? ` (${EQUIPO_LABEL[equipo]})` : "");
  }

  const m = musculos(e, t.n);
  const primarios = aj.primarios || m.primarios;
  const secundarios = (aj.secundarios || m.secundarios).filter(x => !primarios.includes(x));

  const alias = new Set([e.name]);
  (SINONIMOS[t.core] || []).forEach(sin => {
    if (/plano/.test(sin) && t.mods.some(x => /inclinad|declinad/.test(x))) return;
    alias.add([sin, ...t.mods].join(" "));
    // El destacado es "el" ejercicio para ese nombre genérico ("curl de
    // pierna"), salvo palabras sueltas muy amplias ("row") en variantes.
    if (aj.destacado && (!t.mods.length || sin.includes(" "))) alias.add(sin);
  });
  if (aj.destacado && t.core && !t.mods.length) alias.add(t.core);
  // "press inclinado" para "press de banca inclinado"
  if (t.core === "press de banca" && t.mods.length) alias.add(["press", ...t.mods].join(" "));
  (aj.alias || []).forEach(a => alias.add(a));
  alias.delete(nombre);

  return {
    ficha: {
      id: slug(e.id),
      nombre,
      alias: [...alias],
      tipo,
      equipo,
      primarios,
      secundarios,
      factorPesoCorporal: aj.factorPesoCorporal != null ? aj.factorPesoCorporal : factorDe(tipo, t.n)
    },
    destacado: !!aj.destacado,
    sobrantes: aj.nombre ? [] : t.sobrantes
  };
}

// ---------------------------------------------------------------------------

async function cargarDataset() {
  if (local) return JSON.parse(readFileSync(local, "utf8"));
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`No se pudo descargar ${URL}: ${res.status}`);
  return res.json();
}

function validar(f) {
  const err = [];
  if (!TIPOS.includes(f.tipo)) err.push("tipo " + f.tipo);
  if (!f.primarios.length && !(f.movilidad && f.secundarios.length)) err.push("sin primarios");
  [...f.primarios, ...f.secundarios].forEach(m => { if (!MUSCULO_POR_ID[m]) err.push("músculo " + m); });
  if (!EQUIPO_LABEL[f.equipo]) err.push("equipo " + f.equipo);
  return err;
}

const dataset = await cargarDataset();
const destacados = [], resto = [], problemas = [];
const nombres = new Map();

for (const e of dataset) {
  if (excluir(e)) continue;
  const r = construir(e);
  if (!r) continue;
  if (r.error) { problemas.push(`${e.name}: ${r.error}`); continue; }
  if (r.sobrantes.length) problemas.push(`${e.name} → ${r.ficha.nombre}  [sin traducir: ${r.sobrantes.join(" ")}]`);
  const err = validar(r.ficha);
  if (err.length) { problemas.push(`${e.name}: ${err.join(", ")}`); continue; }
  const clave = slug(r.ficha.nombre);
  if (nombres.has(clave)) { problemas.push(`${e.name} → nombre repetido "${r.ficha.nombre}" (ya lo usa ${nombres.get(clave)})`); continue; }
  nombres.set(clave, e.name);
  (r.destacado ? destacados : resto).push(r.ficha);
}

for (const x of EXTRA) {
  const { destacado, ...ficha } = x;
  ficha.alias = ficha.alias || [];
  if (ficha.factorPesoCorporal == null) ficha.factorPesoCorporal = 0;
  const err = validar(ficha);
  if (err.length) { problemas.push(`${x.nombre}: ${err.join(", ")}`); continue; }
  const clave = slug(ficha.nombre);
  if (nombres.has(clave)) { problemas.push(`${x.nombre}: nombre repetido`); continue; }
  nombres.set(clave, x.nombre);
  (destacado ? destacados : resto).push(ficha);
}

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
const ejercicios = [...destacados.sort(porNombre), ...resto.sort(porNombre)];

const salida = {
  fuente: "free-exercise-db (https://github.com/yuhonas/free-exercise-db), Unlicense / dominio público",
  commit: COMMIT,
  generado: "node scripts/build-exercises.mjs",
  destacados: destacados.length,
  ejercicios
};
writeFileSync(SALIDA, JSON.stringify(salida) + "\n");

const porTipo = {};
ejercicios.forEach(x => { porTipo[x.tipo] = (porTipo[x.tipo] || 0) + 1; });
console.log(`${ejercicios.length} ejercicios → data/ejercicios.json`, porTipo);
if (problemas.length) {
  console.log(`${problemas.length} avisos` + (REPORTE ? ":" : " (usa --report para verlos)"));
  if (REPORTE) problemas.forEach(p => console.log("  - " + p));
}
