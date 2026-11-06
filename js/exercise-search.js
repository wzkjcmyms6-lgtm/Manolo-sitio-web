// ---------- Búsqueda y reconocimiento de ejercicios (lógica pura) ----------
// Ignora tildes, mayúsculas, plurales y palabras como "de/con/al"; tolera
// errores de tipeo y de ortografía (ll/y, v/b, z/s, c/s…); entiende inglés
// (nombres de Strong, Hevy y parecidas), abreviaturas (DB, BB, KB, OHP,
// RDL, PM…) y sinónimos de gimnasio ("cristos", "serrucho", "multipower",
// "gemelos"…); separa el equipo ("con mancuernas", "(Barbell)", "en polea")
// y, si no lo dices, elige la variante de siempre (barra antes que barra
// hexagonal, sin banda antes que con banda). Las palabras raras pesan más
// que las comunes ("femoral" más que "curl") (D-101).
// resolver() decide si un nombre ya guardado corresponde con seguridad a un
// ejercicio de la base; si no, devuelve null y la app lo muestra como "no
// reconocido" con sugerencias (sugerir()) para asignarlo con un toque.
// clave() y tokens() no cambian: clave() es la llave de tus asignaciones.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ejercicios-alias.js"));
  else root.ExerciseSearch = factory(root.EjerciciosAlias);
})(typeof self !== "undefined" ? self : this, function (ALIAS_EXTRA) {
"use strict";

const STOP = new Set(["de", "del", "la", "las", "el", "los", "con", "en", "a", "al", "y", "e", "o", "para",
  "por", "un", "una", "the", "with", "on", "to", "of", "and", "an", "in", "for"]);

const EQUIPOS = {
  barra: { nombre: "Barra", sinonimos: ["barra", "barbell"] },
  mancuerna: { nombre: "Mancuerna", sinonimos: ["mancuerna", "dumbbell", "db"] },
  polea: { nombre: "Polea", sinonimos: ["polea", "cable"] },
  maquina: { nombre: "Máquina", sinonimos: ["maquina", "machine"] },
  smith: { nombre: "Máquina Smith", sinonimos: ["smith", "maquina"] },
  kettlebell: { nombre: "Kettlebell", sinonimos: ["kettlebell", "pesa rusa"] },
  banda: { nombre: "Banda", sinonimos: ["banda", "liga", "elastico", "band"] },
  barra_ez: { nombre: "Barra EZ", sinonimos: ["barra", "ez"] },
  barra_hex: { nombre: "Barra hexagonal", sinonimos: ["barra", "hexagonal", "trap"] },
  balon_medicinal: { nombre: "Balón medicinal", sinonimos: ["balon medicinal"] },
  fitball: { nombre: "Fitball", sinonimos: ["fitball", "pelota"] },
  peso_corporal: { nombre: "Peso corporal", sinonimos: ["peso corporal", "bodyweight"] },
  otro: { nombre: "Otro", sinonimos: [] }
};

function normalizar(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

// Plural simple: "flexiones" → "flexion", "mancuernas" → "mancuerna".
function raiz(w) {
  if (w.length > 5 && /[lnrdz]es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// Tal como siempre (la llave de las asignaciones depende de esto).
function tokens(s) {
  return normalizar(s).split(" ").filter(w => w && !STOP.has(w)).map(raiz);
}
function clave(s) {
  return tokens(s).join(" ");
}

// ---------------------------------------------------------------------------
// Forma común para comparar (no se guarda en ningún lado).
// ---------------------------------------------------------------------------

// Frases que se unen o se traducen (se aplican al texto normalizado).
const FRASES = [
  [/\bpush ?ups?\b/g, "flexion"], [/\bpull ?ups?\b/g, "dominada"], [/\bchin ?ups?\b/g, "dominada supina"],
  [/\bsit ?ups?\b/g, "situp"], [/\bstep ?ups?\b/g, "subida cajon"], [/\bpe(?:c|ck|k) ?decks?\b/g, "pecdeck"],
  [/\bpull ?downs?\b/g, "jalon"], [/\bpush ?downs?\b/g, "pushdown"], [/\bskull ?crushers?\b/g, "skullcrusher"],
  [/\bface ?pulls?\b/g, "facepull"], [/\bkick ?backs?\b/g, "patada"], [/\bdead ?li\w*\b/g, "pesomuerto"],
  [/\bgood ?mornings?\b/g, "goodmorning"], [/\bbuenos dias\b/g, "goodmorning"], [/\bhip ?th?rusts?\b/g, "hipthrust"],
  [/\bbarra (?:e ?)?z\b/g, "ez"], [/\bez ?bar\b/g, "ez"], [/\bt ?bar\b/g, "tbar"], [/\bremo (?:en )?t\b/g, "remo tbar"],
  [/\bmulti ?power\b/g, "smith"], [/\bsmith machine\b/g, "smith"], [/\bmaquina smith\b/g, "smith"],
  [/\bpesa rusa\b/g, "kettlebell"], [/\bbarra hexagonal\b|\btrap ?bar\b|\bhex ?bar\b/g, "barrahex"],
  [/\bpeso corporal\b|\bbody ?weight\b/g, "pesocorporal"], [/\bpeso muerto\b/g, "pesomuerto"],
  [/\bpm\b/g, "pesomuerto"], [/\brdl\b/g, "pesomuerto rumano"], [/\bsldl\b/g, "pesomuerto rigida"],
  [/\bohp\b/g, "press militar"], [/\bdb\b/g, "mancuerna"], [/\bbb\b/g, "barra"], [/\bkb\b/g, "kettlebell"],
  [/\bmaquina de remo\b|\bremo (?:ergometro|indoor|cardio)\b|\browing machine\b|\browing\b|\brower\b/g, "remoergometro"],
  [/\b(?:a )?(?:una|un) (?:mano|brazo)\b|\b(?:one|single) arm\b|\bunilateral\b/g, "unamano"],
  [/\btras ?nuca\b|\bbehind (?:the )?neck\b/g, "trasnuca"], [/\bde pie\b/g, "pie"],
  [/\boverhead press\b/g, "press hombro"], [/\bmilitary press\b/g, "press militar"], [/\bshoulder press\b/g, "press hombro"], [/\bbent ?over\b/g, "inclinado"],
  [/\bsobre la cabeza\b|\boverhead\b/g, "cabeza"]
];
// Palabra → forma común (después de quitar plurales).
const SINON = {
  acostado: "tumbado", acostada: "tumbado", echado: "tumbado", echada: "tumbado", tendido: "tumbado", lying: "tumbado", tumbada: "tumbado",
  parado: "pie", parada: "pie", standing: "pie", seated: "sentado", sentada: "sentado",
  incline: "inclinado", inclinada: "inclinado", decline: "declinado", declinada: "declinado",
  gemelo: "talon", pantorrilla: "talon", calf: "talon", calve: "talon",
  fly: "apertura", flye: "apertura", flie: "apertura", flys: "apertura", cristo: "apertura", abertura: "apertura",
  dip: "fondo", lunge: "zancada", estocada: "zancada", squat: "sentadilla", row: "remo", raise: "elevacion",
  shrug: "encogimiento", plank: "plancha", bridge: "puente", hamstring: "femoral", isquio: "femoral",
  front: "frontal", rear: "posterior", reverse: "inverso", invertido: "inverso", invertida: "inverso", inversa: "inverso",
  hammer: "martillo", preacher: "predicador", scott: "predicador", concentration: "concentrado",
  close: "cerrado", narrow: "cerrado", wide: "abierto", walking: "caminando", hip: "cadera",
  abduction: "abduccion", abductor: "abduccion", adduction: "aduccion", aductor: "aduccion", glute: "gluteo",
  weighted: "lastre", lastrada: "lastre", lastrado: "lastre", assisted: "asistida", asistido: "asistida",
  treadmill: "cinta", trotadora: "cinta", caminadora: "cinta", elliptical: "eliptica",
  cycling: "bicicleta", bici: "bicicleta", bike: "bicicleta", stationary: "estatica", indoor: "estatica", fija: "estatica",
  jump: "salto", saltar: "salto", rope: "cuerda", soga: "cuerda", climber: "escalador", farmer: "granjero",
  diamond: "diamante", shoulder: "hombro", chest: "pecho", back: "espalda", leg: "pierna", arm: "brazo",
  military: "militar", upright: "menton", bench: "banca", banco: "banca", bicep: "bicep", tricep: "tricep",
  dumbbell: "mancuerna", barbell: "barra", bar: "barra", cable: "polea", machine: "maquina", band: "banda",
  liga: "banda", elastico: "banda", copa: "goblet", pelota: "fitball", ball: "fitball", kettlebel: "kettlebell"
};
// Palabras que no ayudan a distinguir ("press de banca convencional").
const SUAVES = new Set(["sobre", "agarre", "grip", "thigh", "trasera", "convencional", "normal", "clasico", "clasica",
  "ejercicio", "exercise", "version", "style", "estilo", "medium", "medio", "straight", "attachment", "grado", "grados"]);
// Equipo dicho en la búsqueda → equipos de la base que valen.
const EQ_PALABRA = {
  barra: ["barra", "barra_ez", "barra_hex"], mancuerna: ["mancuerna"], polea: ["polea"], maquina: ["maquina", "smith"],
  smith: ["smith"], kettlebell: ["kettlebell"], banda: ["banda"], ez: ["barra_ez"], barrahex: ["barra_hex"],
  fitball: ["fitball"], pesocorporal: ["peso_corporal"]
};
// Sin equipo dicho: la variante de siempre primero.
const prior = e => (Object.prototype.hasOwnProperty.call(PRIOR, e) ? PRIOR[e] : 0.02);
const PRIOR = { barra: 0, peso_corporal: 0, mancuerna: 0.01, maquina: 0.012, polea: 0.02, otro: 0.02, barra_ez: 0.03,
  smith: 0.04, kettlebell: 0.04, barra_hex: 0.05, banda: 0.06, fitball: 0.06, balon_medicinal: 0.06 };
// Una sola palabra muy general no alcanza para reconocer ("Remo", "Pecho").
const GENERALES = new Set(["remo", "press", "curl", "elevacion", "extension", "apertura", "jalon", "pecho", "pierna",
  "espalda", "hombro", "brazo", "gluteo", "bicep", "tricep", "cuadricep", "abdominal", "core", "entrenamiento", "fuerza",
  "cardio", "maquina", "barra", "mancuerna", "polea", "banca", "sentadilla", "flexion", "puente", "fondo"]);

function canon(s) {
  let t = " " + normalizar(s) + " ";
  FRASES.forEach(([re, por]) => { t = t.replace(re, por); });
  const out = [];
  t.split(" ").forEach(w => {
    if (!w || STOP.has(w) || /^\d+$/.test(w)) return;
    const r = raiz(w);
    const c = SINON[r] || SINON[w] || r;
    c.split(" ").forEach(x => { if (x && !SUAVES.has(x)) out.push(x); });
  });
  return out;
}
const esEquipo = w => Object.prototype.hasOwnProperty.call(EQ_PALABRA, w);

// Clave fonética del español: "sentadiya" = "sentadilla", "vanca" = "banca".
function fonetica(w) {
  return w.replace(/ll/g, "y").replace(/v/g, "b").replace(/z/g, "s").replace(/c([ei])/g, "s$1")
    .replace(/qu/g, "k").replace(/c(?!h)/g, "k").replace(/(^|[^c])h/g, "$1").replace(/x/g, "ks").replace(/(.)\1+/g, "$1");
}

// Distancia de edición (con transposiciones), cortando si supera "max".
function distancia(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length, m = b.length;
  let prev2 = null, prev = new Array(m + 1), cur = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let minFila = cur[0];
    for (let j = 1; j <= m; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + costo);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < minFila) minFila = v;
    }
    if (minFila > max) return max + 1;
    const t = prev2 || new Array(m + 1);
    prev2 = prev; prev = cur; cur = t;
  }
  return prev[m];
}

function tolerancia(len) {
  return len >= 8 ? 2 : len >= 4 ? 1 : 0;
}

// Qué tan bien una palabra buscada (q) coincide con una del ejercicio (t).
function parecido(q, t, fq, ft) {
  if (q === t) return 1;
  fq = fq || fonetica(q); ft = ft || fonetica(t);
  if (fq === ft) return 0.95;                                    // ortografía: ll/y, v/b, z/s…
  if (fq.replace(/s$/, "") === ft.replace(/s$/, "")) return 0.9; // "dominadass"
  if (q.length >= 2 && t.startsWith(q)) return 0.85;             // todavía escribiendo
  const max = tolerancia(q.length);
  if (!max) return 0;
  const d = Math.min(distancia(q, t, max), distancia(fq, ft, max));
  if (d <= max) return d === 1 ? 0.8 : 0.7;
  if (q.length >= 3 && t.length > q.length && distancia(q, t.slice(0, q.length), 1) <= 1) return 0.65; // error + escribiendo
  return 0;
}

function textoBase(nombre) {
  return String(nombre || "").replace(/\s*\([^)]*\)\s*$/, "");
}

// opciones.destacados = cuántos de los primeros ejercicios son los "típicos"
// (van primero en data/ejercicios.json) y ganan los empates.
// opciones.alias = alias extra por id (por defecto, js/ejercicios-alias.js).
function crearIndice(ejercicios, opciones) {
  const o = opciones || {};
  const nDestacados = o.destacados || 0;
  const extra = o.alias || ALIAS_EXTRA || {};
  const items = [];
  const porId = new Map();
  const exactos = new Map();   // clave de siempre → ejercicios (lo usa el selector)
  const canonicos = new Map(); // forma común sin equipo → items
  const df = new Map();

  (ejercicios || []).forEach((ej, i) => {
    if (!ej || !ej.id || porId.has(ej.id)) return;
    const destacado = i < nDestacados;
    const nombreBase = textoBase(ej.nombre);
    const brutos = [nombreBase].concat(ej.alias || [], extra[ej.id] || []);
    const vistos = new Set();
    const textos = [];
    brutos.forEach((b, k) => {
      const ts = canon(b).filter(w => !esEquipo(w));
      const key = ts.slice().sort().join(" ");
      if (!ts.length || vistos.has(key)) return;
      vistos.add(key);
      textos.push({ tokens: Array.from(new Set(ts)), esNombre: k === 0, key });
    });
    if (!textos.length) textos.push({ tokens: [], esNombre: true, key: "" });
    const nombreKey = textos[0].key;
    // El nombre entero, con el equipo que diga ("Remo con peso corporal").
    const nombreLargo = canon(nombreBase).length;
    // Textos tal cual (sin sinónimos) para "lo que estás escribiendo" en buscar().
    const crudos = Array.from(new Set([ej.nombre].concat(brutos).map(normalizar).filter(Boolean)));
    const it = { ej, orden: i, textos, destacado, equipo: ej.equipo || "otro", nombreKey, nombreLargo, crudos };
    items.push(it);
    porId.set(ej.id, ej);
    const palabras = new Set();
    textos.forEach(t => t.tokens.forEach(w => palabras.add(w)));
    palabras.forEach(w => df.set(w, (df.get(w) || 0) + 1));
    textos.forEach(t => {
      if (!t.key) return;
      if (!canonicos.has(t.key)) canonicos.set(t.key, []);
      if (!canonicos.get(t.key).includes(it)) canonicos.get(t.key).push(it);
    });
    const kNombre = new Set([clave(ej.nombre), clave(nombreBase)]);
    new Set([ej.nombre, nombreBase].concat(ej.alias || [], extra[ej.id] || []).map(clave)).forEach(k => {
      if (!k) return;
      if (!exactos.has(k)) exactos.set(k, []);
      exactos.get(k).push({ ej, destacado, it, esNombre: kNombre.has(k) });
    });
  });

  const N = items.length || 1;
  const peso = new Map();
  df.forEach((n, w) => peso.set(w, Math.log(1 + N / n)));
  const vocab = Array.from(df.keys());
  return { items, porId, exactos, canonicos, peso, vocab, vocabF: vocab.map(fonetica), N, memo: new Map() };
}

// La última palabra a medio escribir que solo puede ser un equipo
// ("remo maq", "press banca manc"); si también empieza otra palabra
// ("ban" → banca/banda), no se toma como equipo.
const EQ_A_MEDIAS = ["barra", "mancuerna", "polea", "maquina", "smith", "kettlebell", "banda", "fitball"];
function equipoAMedias(indice, w) {
  if (w.length < 3 || esEquipo(w)) return null;
  const ks = EQ_A_MEDIAS.filter(e => e.startsWith(w));
  if (ks.length !== 1 || indice.vocab.some(t => t.startsWith(w))) return null;
  return ks[0];
}

// La búsqueda en forma común: palabras (sin equipo) y equipos pedidos.
function leerConsulta(indice, consulta) {
  const ts = canon(consulta);
  const equipos = new Set();
  const eqPalabras = new Set();
  const palabras = [];
  ts.forEach((w, k) => {
    if (k === ts.length - 1 && k > 0) w = equipoAMedias(indice, w) || w;
    if (esEquipo(w)) { eqPalabras.add(w); EQ_PALABRA[w].forEach(e => equipos.add(e)); }
    else if (!palabras.includes(w)) palabras.push(w);
  });
  // Parecido de cada palabra con todo el vocabulario (una vez por búsqueda).
  const tablas = [];
  const ruido = [];
  palabras.forEach(q => {
    if (!indice.memo.has(q)) {
      if (indice.memo.size > 3000) indice.memo.clear();   // el selector prueba muchas palabras a medias
      const m = new Map(), fq = fonetica(q);
      // Una palabra que ya existe no se "corrige" a otra ("cadera" no es "carrera").
      const conocida = indice.peso.has(q);
      let mejor = 0, pesoMejor = 0;
      indice.vocab.forEach((t, j) => {
        let p = parecido(q, t, fq, indice.vocabF[j]);
        if (conocida && p < 0.85) p = 0;
        if (p > 0) { m.set(t, p); if (p > mejor) { mejor = p; pesoMejor = indice.peso.get(t); } }
      });
      indice.memo.set(q, { m, mejor, peso: pesoMejor || 1 });
    }
    const r = indice.memo.get(q);
    if (r.mejor < 0.65) { ruido.push(q); return; }    // no existe en ningún ejercicio: tipeo o relleno
    tablas.push({ q, m: r.m, peso: r.peso, aMedias: r.mejor < 0.95 && q === palabras[palabras.length - 1] });
  });
  // La última palabra a medio escribir no manda más que las ya completas
  // ("remo pol": pesa como "remo", no como la rara "polichinela").
  const completas = tablas.filter(t => !t.aMedias);
  if (completas.length && completas.length < tablas.length) {
    const media = completas.reduce((s, t) => s + t.peso, 0) / completas.length;
    tablas.forEach(t => { if (t.aMedias) t.peso = Math.min(t.peso, media); });
  }
  return { palabras, tablas, ruido, equipos, eqPalabras, key: palabras.slice().sort().join(" ") };
}

function puntuarItem(it, c, indice) {
  let mejor = null;
  it.textos.forEach(tx => {
    if (!tx.tokens.length) return;
    let sq = 0, tq = 0;
    c.tablas.forEach(tb => {
      let m = 0;
      tx.tokens.forEach(t => { const p = tb.m.get(t) || 0; if (p > m) m = p; });
      sq += tb.peso * m; tq += tb.peso;
    });
    let st = 0, tt = 0;
    tx.tokens.forEach(t => {
      const w = indice.peso.get(t) || 1;
      tt += w;
      if (c.tablas.some(tb => (tb.m.get(t) || 0) >= 0.7)) st += w;
    });
    const qm = tq ? sq / tq : 0, tc = tt ? st / tt : 0;
    const s = 0.7 * qm + 0.3 * tc + (tx.esNombre ? 0.03 : 0);
    if (!mejor || s > mejor.s) mejor = { s, qm, tc, esNombre: tx.esNombre };
  });
  if (!mejor || mejor.qm <= 0) return null;
  let eq = 0;
  if (c.equipos.size) {
    if (c.equipos.has(it.equipo)) {
      eq = 0.05;
      // "Barra" a secas es la barra recta: la EZ y la hexagonal, un poco detrás.
      if ((it.equipo === "barra_ez" && !c.eqPalabras.has("ez")) || (it.equipo === "barra_hex" && !c.eqPalabras.has("barrahex"))) eq = 0.01;
    } else if (it.equipo === "otro" || it.equipo === "peso_corporal") eq = -0.04;
    else eq = -0.25;
  } else eq = -prior(it.equipo);
  const puntaje = mejor.s + eq + (it.destacado ? 0.02 : 0) - it.orden * 1e-6;
  return { ejercicio: it.ej, it, puntaje, qm: mejor.qm, tc: mejor.tc, esNombre: mejor.esNombre, destacado: it.destacado };
}

function puntuar(indice, consulta) {
  const c = leerConsulta(indice, consulta);
  if (!c.tablas.length) return { c, lista: [] };
  const lista = [];
  indice.items.forEach(it => { const r = puntuarItem(it, c, indice); if (r) lista.push(r); });
  return { c, lista: lista.sort((a, b) => b.puntaje - a.puntaje) };
}

// En el buscador, además: lo que empieza como lo que escribes ("hip" →
// Hip thrust, "remo maq" → Remo en máquina) sube, y los típicos van antes.
function buscar(indice, consulta, limite) {
  const { c, lista } = puntuar(indice, consulta);
  const q = normalizar(consulta);
  // Solo el equipo ("smith", "kettlebell"): los de ese equipo, típicos primero.
  if (!c.palabras.length && c.equipos.size)
    indice.items.forEach(it => { if (c.equipos.has(it.equipo)) lista.push({ ejercicio: it.ej, it, puntaje: 0.5 - it.orden * 1e-6 }); });
  if (q.length >= 2) {
    const ya = new Map(lista.map(r => [r.it, r]));
    indice.items.forEach(it => {
      if (!it.crudos.some(t => t.startsWith(q))) return;
      const r = ya.get(it);
      if (r) r.puntaje += q.length >= 4 ? 0.3 : 0.15;
      else lista.push({ ejercicio: it.ej, it, puntaje: 0.8 - prior(it.equipo) + (it.destacado ? 0.02 : 0) - it.orden * 1e-6 });
    });
  }
  lista.forEach(r => { if (r.it.destacado) r.puntaje += 0.06; });
  lista.sort((a, b) => b.puntaje - a.puntaje);
  return lista.slice(0, limite || 8).map(r => ({ ejercicio: r.ejercicio, puntaje: r.puntaje }));
}

// Entre varios que coinciden igual: el del equipo pedido, el destacado, la
// variante de siempre.
function rangoEquipo(it, c) {
  if (!c.equipos.size) return prior(it.equipo);
  if (!c.equipos.has(it.equipo)) return 1;
  // "Barra" a secas es la barra recta.
  if ((it.equipo === "barra_ez" && !c.eqPalabras.has("ez")) || (it.equipo === "barra_hex" && !c.eqPalabras.has("barrahex"))) return 0.5;
  return 0;
}
function elegir(its, c) {
  return its.slice().sort((a, b) => rangoEquipo(a, c) - rangoEquipo(b, c) || (b.destacado - a.destacado) || a.orden - b.orden)[0];
}
const compatible = (it, c) => !c.equipos.size || c.equipos.has(it.equipo);

// Devuelve el ejercicio solo si la coincidencia es clara; si no, null.
function resolver(indice, nombre, opciones) {
  const asignaciones = (opciones && opciones.asignaciones) || {};
  const k = clave(nombre);
  if (!k) return null;
  if (asignaciones[k] && indice.porId.has(asignaciones[k])) return indice.porId.get(asignaciones[k]);
  // 1. Nombre o alias igual (como siempre).
  const iguales = indice.exactos.get(k);
  const { c, lista } = puntuar(indice, nombre);
  if (iguales && iguales.length) {
    const its = iguales.map(x => x.it);
    const conEq = its.filter(it => compatible(it, c));
    const usar = conEq.length ? iguales.filter(x => conEq.includes(x.it)) : iguales;
    const dn = usar.filter(x => x.destacado && x.esNombre), da = usar.filter(x => x.destacado), pn = usar.filter(x => x.esNombre);
    if (dn.length) return elegir(dn.map(x => x.it), c).ej;
    if (da.length) return elegir(da.map(x => x.it), c).ej;
    if (usar.length === 1) return usar[0].ej;
    if (pn.length && new Set(pn.map(x => x.it.nombreKey)).size === 1) return elegir(pn.map(x => x.it), c).ej;
  }
  if (!c.palabras.length || !lista.length) return null;
  // Más palabras de relleno que palabras útiles: no se adivina.
  if (c.ruido.length > c.tablas.length) return null;
  // 2. La misma forma común que un nombre o alias (en inglés, con sinónimos…).
  if (!c.ruido.length && indice.canonicos.has(c.key)) {
    let cands = indice.canonicos.get(c.key).filter(it => compatible(it, c));
    const porNombre = cands.filter(it => it.nombreKey === c.key);
    if (porNombre.length) cands = porNombre;
    // Una palabra general sola ("pecho", "remo") solo vale si es el nombre entero.
    if (c.palabras.length === 1 && GENERALES.has(c.palabras[0]) && !porNombre.some(it => it.nombreLargo === 1)) cands = [];
    const nombres = new Set(cands.map(it => it.nombreKey));
    const destacados = cands.filter(it => it.destacado);
    // Uno solo, el mismo ejercicio con distinto equipo, o hay uno típico.
    if (cands.length && (cands.length === 1 || nombres.size === 1 || destacados.length >= 1 || c.equipos.size))
      return elegir(destacados.length && !c.equipos.size ? destacados : cands, c).ej;
  }
  // 3. Por puntaje.
  // Si dijiste el equipo, solo vale uno de ese equipo.
  const validos = c.equipos.size ? lista.filter(x => c.equipos.has(x.it.equipo) || x.it.equipo === "otro" || x.it.equipo === "peso_corporal") : lista;
  const a = validos[0];
  if (!a) return null;
  const util = c.tablas.length;
  if (util === 1 && GENERALES.has(c.tablas[0].q) && !(a.tc >= 0.99 && a.esNombre)) return null;
  if (a.qm < 0.8 || a.tc < 0.45) return null;
  if (util === 1 && a.tc < 0.99) return null;     // una palabra: tiene que ser todo el nombre
  const b = validos.find(x => x.it.nombreKey !== a.it.nombreKey);
  const margen = b ? a.puntaje - b.puntaje : 1;
  if (margen >= 0.02 || (a.destacado && margen >= 0.005)) return a.ejercicio;
  return null;
}

// Sugerencias para un nombre sin reconocer: hasta n ejercicios, con
// "probable" si la coincidencia es buena (para "¿Es este?").
function sugerir(indice, nombre, n) {
  const { c, lista } = puntuar(indice, nombre);
  if (!c.tablas.length) return [];
  return lista.slice(0, n || 3).map(r => ({ ejercicio: r.ejercicio, puntaje: r.puntaje, probable: r.qm >= 0.6 && r.tc >= 0.35 }));
}

return { EQUIPOS, normalizar, tokens, clave, canon, fonetica, distancia, crearIndice, buscar, resolver, sugerir };
});
