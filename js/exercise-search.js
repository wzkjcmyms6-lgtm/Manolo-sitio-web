// ---------- Búsqueda de ejercicios (lógica pura) ----------
// Ignora tildes, mayúsculas, plurales simples y palabras como "de/con/al";
// tolera errores de tipeo (1 letra en palabras de 4–7, 2 en las más largas)
// y encuentra por alias en inglés o variantes ("press plano", "bench press").
// resolver() decide si un nombre ya guardado corresponde con seguridad a un
// ejercicio de la base; si no, devuelve null y la app lo muestra como "no
// reconocido" para que lo asignes a mano.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ExerciseSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {

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

function tokens(s) {
  return normalizar(s).split(" ").filter(w => w && !STOP.has(w)).map(raiz);
}

function clave(s) {
  return tokens(s).join(" ");
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

// Qué tan bien una palabra de la búsqueda (q) coincide con una del ejercicio (t).
function parecido(q, t) {
  if (q === t) return 1;
  if (q.length >= 2 && t.startsWith(q)) return 0.85;            // todavía escribiendo
  const max = tolerancia(q.length);
  if (!max) return 0;
  const d = distancia(q, t, max);
  if (d <= max) return 0.75 - 0.05 * (d - 1);
  if (t.length > q.length && distancia(q, t.slice(0, q.length), 1) <= 1) return 0.65; // error + escribiendo
  return 0;
}

function textoBase(nombre) {
  return String(nombre || "").replace(/\s*\([^)]*\)\s*$/, "");
}

// opciones.destacados = cuántos de los primeros ejercicios son los "típicos"
// (van primero en data/ejercicios.json) y ganan los empates.
function crearIndice(ejercicios, opciones) {
  const nDestacados = (opciones && opciones.destacados) || 0;
  const items = [];
  const porId = new Map();
  const exactos = new Map();
  const vocab = new Set();

  (ejercicios || []).forEach((ej, i) => {
    if (!ej || !ej.id || porId.has(ej.id)) return;
    const eq = EQUIPOS[ej.equipo] || EQUIPOS.otro;
    const equipoTokens = new Set();
    eq.sinonimos.forEach(s => tokens(s).forEach(t => equipoTokens.add(t)));
    const entreParentesis = (String(ej.nombre).match(/\(([^)]*)\)\s*$/) || [])[1];
    if (entreParentesis) tokens(entreParentesis).forEach(t => equipoTokens.add(t));

    const textos = [textoBase(ej.nombre)].concat(ej.alias || []).map(t => {
      return { tokens: Array.from(new Set(tokens(t))) };
    });
    const union = new Set(equipoTokens);
    textos.forEach(t => t.tokens.forEach(x => union.add(x)));
    union.forEach(x => vocab.add(x));

    items.push({ ej, orden: i, textos, union: Array.from(union), largo: textos[0].tokens.length, destacado: i < nDestacados });
    porId.set(ej.id, ej);
    new Set([ej.nombre, textoBase(ej.nombre)].concat(ej.alias || []).map(clave)).forEach(k => {
      if (!k) return;
      if (!exactos.has(k)) exactos.set(k, []);
      exactos.get(k).push({ ej, destacado: i < nDestacados });
    });
  });

  return { items, porId, exactos, vocab: Array.from(vocab) };
}

function puntuar(indice, consulta) {
  const qs = Array.from(new Set(tokens(consulta)));
  if (!qs.length) return [];
  // Parecido de cada palabra buscada contra todo el vocabulario (una vez).
  const tablas = qs.map(q => {
    const m = new Map();
    indice.vocab.forEach(t => { const p = parecido(q, t); if (p > 0) m.set(t, p); });
    return m;
  });

  const out = [];
  indice.items.forEach(it => {
    let suma = 0;
    for (const tabla of tablas) {
      let mejor = 0;
      for (const t of it.union) { const p = tabla.get(t); if (p > mejor) mejor = p; }
      if (!mejor) return;
      suma += mejor;
    }
    const ida = suma / tablas.length;
    // Vuelta: cuánto del nombre (sin el equipo) o de un alias cubre la búsqueda.
    let vuelta = 0;
    it.textos.forEach(tx => {
      if (!tx.tokens.length) return;
      const cubiertas = tx.tokens.filter(t => tablas.some(tb => (tb.get(t) || 0) >= 0.7)).length;
      const c = cubiertas / tx.tokens.length;
      if (c > vuelta) vuelta = c;
    });
    // Premio si todas las palabras están en el nombre visible (no solo en alias).
    const enNombre = tablas.every(tb => it.textos[0].tokens.some(t => (tb.get(t) || 0) >= 0.7));
    const puntaje = ida * 0.75 + vuelta * 0.25 + (enNombre ? 0.01 : 0) + (it.destacado ? 0.005 : 0)
      - it.largo * 0.002 - it.orden * 1e-6;
    out.push({ ejercicio: it.ej, puntaje, ida, vuelta, destacado: it.destacado });
  });
  return out.sort((a, b) => b.puntaje - a.puntaje);
}

function buscar(indice, consulta, limite) {
  return puntuar(indice, consulta).slice(0, limite || 8).map(r => ({ ejercicio: r.ejercicio, puntaje: r.puntaje }));
}

// Devuelve el ejercicio solo si la coincidencia es clara: nombre o alias
// igual, o todas las palabras encontradas y cubriendo buena parte del nombre.
// Si varios empatan (ej: "Row") y ninguno es el típico, no adivina.
function resolver(indice, nombre, opciones) {
  const asignaciones = (opciones && opciones.asignaciones) || {};
  const k = clave(nombre);
  if (!k) return null;
  if (asignaciones[k] && indice.porId.has(asignaciones[k])) return indice.porId.get(asignaciones[k]);
  const iguales = indice.exactos.get(k);
  if (iguales && (iguales.length === 1 || iguales[0].destacado)) return iguales[0].ej;
  const [a, b] = puntuar(indice, nombre);
  if (a && a.ida >= 0.85 && a.vuelta >= 0.6 && (a.destacado || !b || a.puntaje - b.puntaje > 0.004)) return a.ejercicio;
  return null;
}

return { EQUIPOS, normalizar, tokens, clave, distancia, crearIndice, buscar, resolver };
});
