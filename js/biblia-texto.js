// ---------- Biblia: texto de la Reina-Valera 1909 (sin pantalla) ----------
// Dónde está cada libro (data/biblia/rv1909/{libro}.json, lo arma
// scripts/build-biblia.mjs), ortografía actual al mostrar ("vino á Jesús"
// → "vino a Jesús"; el texto guardado no cambia), sacar el texto de una cita,
// capítulo anterior y siguiente, y el link a otra versión (D-102).
// Sin DOM ni Firebase: tests/biblia-texto.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./biblia-motor.js"));
  else root.BibliaTexto = factory(root.BibliaMotor);
})(typeof self !== "undefined" ? self : this, function (B) {
"use strict";

const VERSION = "RV1909";
const RUTA = "data/biblia/rv1909/";
const VER_DATOS = "1";            // subir si se vuelve a generar el texto
const CACHE = "manolo-biblia";    // caché propia (no se borra al actualizar la app)
const url = id => `${RUTA}${id}.json?v=${VER_DATOS}`;
const urlIndice = () => `${RUTA}indice.json?v=${VER_DATOS}`;

// ---- Ortografía actual (RAE 1952 y 2010) ----
// Palabras sueltas que hoy se escriben distinto. Se respeta la mayúscula.
const CAMBIOS = {
  "á": "a", "é": "e", "ó": "o", "ú": "u",
  "fué": "fue", "fuí": "fui", "dió": "dio", "vió": "vio", "dí": "di", "ví": "vi", "fió": "fio",
  "pié": "pie", "piés": "pies", "tí": "ti", "há": "ha", "fuése": "fuese",
  "sólo": "solo", "éste": "este", "ésta": "esta", "éstos": "estos", "éstas": "estas", "ése": "ese", "ésa": "esa",
  "ésos": "esos", "ésas": "esas", "aquél": "aquel", "aquélla": "aquella", "aquéllos": "aquellos", "aquéllas": "aquellas",
  "oir": "oír", "reir": "reír"
};
const LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
const RE_PALABRA = new RegExp(`[${LETRA}]+`, "g");
function conCaso(original, nuevo) {
  if (original === original.toUpperCase() && original.length > 1) return nuevo.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return nuevo[0].toUpperCase() + nuevo.slice(1);
  return nuevo;
}
function ortografiaActual(texto) {
  return String(texto == null ? "" : texto).replace(RE_PALABRA, w => {
    const n = CAMBIOS[w.toLowerCase()];
    return n ? conCaso(w, n) : w;
  });
}
// El versículo 1 empieza con la primera palabra en mayúsculas ("EN el
// principio", "Salmo de David. JEHOVÁ es…"): se muestra "En", "Jehová".
const RE_MAYUS = new RegExp(`(^|[^${LETRA}])([A-ZÁÉÍÓÚÜÑ]{2,})(?=[^${LETRA}]|$)`);
// En medio de la frase ("Y ACONTECIÓ") va en minúscula, salvo los nombres.
const NOMBRES = new Set(["jehová", "dios", "jesús", "jesus", "cristo", "señor", "david", "salomón", "israel", "pablo", "moisés", "sión"]);
function mayusculaInicial(texto) {
  const t = String(texto || "");
  return t.replace(RE_MAYUS, (m, antes, w, pos) => {
    const previo = t.slice(0, pos + antes.length);
    const inicio = !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(previo) || /[.:!?]\s*[¿¡«"]?$/.test(previo);
    const bajo = w.toLowerCase();
    return antes + (inicio || NOMBRES.has(bajo) ? w[0] + w.slice(1).toLowerCase() : bajo);
  });
}
// Texto de un versículo como se muestra. o: { actual, numero }.
function mostrar(texto, o) {
  const op = o || {};
  let t = String(texto || "");
  if (op.actual) {
    if (op.numero === 1) t = mayusculaInicial(t);
    t = ortografiaActual(t);
  }
  return t;
}

// ---- Citas ----
// "16-18,20" → [16, 17, 18, 20] (null si no se entiende).
function numeros(spec) {
  const s = B.versiculoNormal(spec);
  if (!s) return null;
  const out = [];
  s.split(",").forEach(p => {
    const [a, b] = p.split("-").map(Number);
    for (let v = a; v <= (b || a); v++) if (!out.includes(v)) out.push(v);
  });
  return out;
}
// Varios números → la forma corta ("16, 17, 18, 20" → "16-18,20").
function spec(nums) {
  const ns = Array.from(new Set((nums || []).map(Number).filter(n => n >= 1))).sort((a, b) => a - b);
  const partes = [];
  for (let i = 0; i < ns.length; i++) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    partes.push(j > i ? `${ns[i]}-${ns[j]}` : String(ns[i]));
    i = j;
  }
  return partes.join(",");
}
// El texto de una cita desde los datos de un libro ({ caps }). null si el
// capítulo o algún versículo no existe. o: { actual }.
function textoCita(datos, cap, versiculo, o) {
  const c = datos && datos.caps && datos.caps[Number(cap) - 1];
  const ns = numeros(versiculo);
  if (!c || !ns || ns.some(n => n > c.length)) return null;
  return ns.map(n => mostrar(c[n - 1], { actual: o && o.actual, numero: n })).filter(Boolean).join(" ");
}
const claveCap = (libro, cap) => `${libro}.${cap}`;
const claveVers = (libro, cap, v) => `${libro}.${cap}.${v}`;
function leerClave(k) {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/.exec(String(k || ""));
  if (!m || !B.libro(m[1])) return null;
  return { libro: m[1], cap: Number(m[2]), v: m[3] ? Number(m[3]) : null };
}
// "Juan 3:16-18" (o "Juan 3" sin versículo).
function cita(libro, cap, versiculo) {
  const l = B.libro(libro);
  if (!l) return "";
  return `${l.nombre} ${cap}${versiculo ? `:${versiculo}` : ""}`;
}

// Capítulo anterior o siguiente, cruzando de libro (null al principio de
// Génesis o al final de Apocalipsis).
function vecino(libro, cap, delta) {
  const l = B.libro(libro);
  if (!l) return null;
  const c = Number(cap) + delta;
  if (c >= 1 && c <= l.capitulos) return { libro, cap: c };
  const otro = B.LIBROS[l.orden + delta];
  if (!otro) return null;
  return { libro: otro.id, cap: delta > 0 ? 1 : otro.capitulos };
}
// Salmos, Proverbios y los otros libros de poesía: un versículo por línea.
const POESIA = new Set(["Job", "Ps", "Prov", "Eccl", "Song", "Lam"]);
const esPoesia = libro => POESIA.has(libro);

// ---- Otra versión (solo un link; esas versiones tienen derechos) ----
const OTRAS = [
  { id: "RVR1960", nombre: "Reina-Valera 1960" }, { id: "NVI", nombre: "Nueva Versión Internacional" },
  { id: "NTV", nombre: "Nueva Traducción Viviente" }, { id: "LBLA", nombre: "La Biblia de las Américas" },
  { id: "NBLA", nombre: "Nueva Biblia de las Américas" }, { id: "DHH", nombre: "Dios Habla Hoy" },
  { id: "RVA-2015", nombre: "Reina-Valera Actualizada 2015" }, { id: "TLA", nombre: "Traducción en Lenguaje Actual" }
];
// Nombres en inglés (los entiende cualquier web de Biblias).
const INGLES = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes",
  "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"];
function linkOtraVersion(libro, cap, versiculo, version) {
  const l = B.libro(libro);
  if (!l) return null;
  const v = OTRAS.some(o => o.id === version) ? version : OTRAS[0].id;
  const q = `${INGLES[l.orden]} ${cap}${versiculo ? `:${versiculo}` : ""}`;
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(q)}&version=${encodeURIComponent(v)}`;
}

// ---- Buscar en toda la Biblia (lo usa el Worker, js/biblia-buscar-worker.js) ----
const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// libros: [{ libro, caps }]; consulta: varias palabras (todas deben estar,
// sin tildes, también a medias: "misericord"). → { total, items: [{ libro, cap, v, texto }] }
function buscar(libros, consulta, max) {
  const palabras = norm(consulta).split(/[^a-z0-9ñ]+/).filter(w => w.length >= 2);
  const out = [];
  let total = 0;
  if (!palabras.length) return { total, items: out, palabras };
  const limite = max || 200;
  (libros || []).forEach(d => (d.caps || []).forEach((c, ci) => c.forEach((t, vi) => {
    if (!t) return;
    const n = norm(t);
    if (palabras.every(w => n.includes(w))) {
      total++;
      if (out.length < limite) out.push({ libro: d.libro, cap: ci + 1, v: vi + 1, texto: t });
    }
  })));
  return { total, items: out, palabras };
}

return { VERSION, RUTA, VER_DATOS, CACHE, url, urlIndice, CAMBIOS, ortografiaActual, mayusculaInicial, mostrar,
  numeros, spec, textoCita, claveCap, claveVers, leerClave, cita, vecino, esPoesia, OTRAS, linkOtraVersion, buscar, norm };
});
