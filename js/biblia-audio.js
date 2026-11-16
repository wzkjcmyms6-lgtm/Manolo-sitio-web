// ---------- Biblia en audio: lógica (sin pantalla) ----------
// El lector lee el capítulo en voz alta con las voces del propio teléfono
// (speechSynthesis: sin internet ni servicios de nube). Aquí está lo que no
// depende de la pantalla: el texto para la voz, los trozos (uno por
// versículo; los muy largos se parten en frases), lo que se dice al empezar
// ("Juan, capítulo 3."), las velocidades, qué voz en español usar y cuándo
// un capítulo cuenta como escuchado. Pantalla en js/biblia-audio-ui.js.
// Ver docs/LECTURA_NIVEL2.md (D-123).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BibliaAudio = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// ---- Velocidad ----
const VELOCIDADES = [0.8, 0.9, 1, 1.1, 1.25];
const VEL_NORMAL = 1;
const velNormal = v => (VELOCIDADES.includes(Number(v)) ? Number(v) : VEL_NORMAL);
const etiquetaVel = v => `${String(velNormal(v)).replace(".", ",")}×`;
const siguienteVel = v => VELOCIDADES[(VELOCIDADES.indexOf(velNormal(v)) + 1) % VELOCIDADES.length];

// ---- Texto para la voz ----
const LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
// Palabras en mayúsculas ("Y HABÍA", "JEHOVÁ JUSTICIA NUESTRA"): algunas voces
// las deletrean; se dicen como palabras normales.
const RE_MAYUS = new RegExp(`(^|[^${LETRA}])([A-ZÁÉÍÓÚÜÑ]{2,})(?=[^${LETRA}]|$)`, "g");
function paraVoz(texto) {
  return String(texto == null ? "" : texto)
    .replace(RE_MAYUS, (m, antes, w) => antes + w.charAt(0) + w.slice(1).toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
}

// Un versículo largo se parte en frases de hasta MAX_TROZO letras (y, si una
// frase sigue muy larga, en sus comas): pausar y seguir retoma desde ahí.
const MAX_TROZO = 240;
function partir(texto, max) {
  const lim = max || MAX_TROZO;
  const t = paraVoz(texto);
  if (!t) return [];
  if (t.length <= lim) return [t];
  const out = [];
  let cur = "";
  const sumar = p => {
    if (!p) return;
    if (!cur || (cur + p).trim().length <= lim) cur += p;
    else { out.push(cur.trim()); cur = p; }
  };
  (t.match(/[^.;:?!]+[.;:?!]+[»”"')]*\s*|[^.;:?!]+$/g) || [t]).forEach(frase => {
    if (frase.trim().length > lim) (frase.match(/[^,]+,\s*|[^,]+$/g) || [frase]).forEach(sumar);
    else sumar(frase);
  });
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---- Lo que se dice al empezar el capítulo ----
const ORDINAL = { 1: "Primera de", 2: "Segunda de", 3: "Tercera de" };
// "1 Corintios" → "Primera de Corintios" (como se dice en la iglesia).
function nombreVoz(nombre) {
  const n = String(nombre || "").trim();
  const m = /^([123])\s+(.+)$/.exec(n);
  return m ? `${ORDINAL[m[1]]} ${m[2]}` : n;
}
// libro: { id, nombre, capitulos } de BibliaMotor.
function encabezado(libro, cap) {
  if (!libro || !libro.nombre) return "";
  if (libro.id === "Ps") return `Salmo ${cap}.`;
  if (libro.capitulos === 1) return `${nombreVoz(libro.nombre)}.`;
  return `${nombreVoz(libro.nombre)}, capítulo ${cap}.`;
}

// ---- Trozos del capítulo ----
// versos: textos del capítulo (como se muestran; "" si falta uno).
// → [{ v, texto }]; v = 0 es el encabezado.
function trozos(versos, o) {
  const out = [];
  const enc = o && o.encabezado ? paraVoz(o.encabezado) : "";
  if (enc) out.push({ v: 0, texto: enc });
  (versos || []).forEach((t, k) => partir(t, o && o.max).forEach(texto => out.push({ v: k + 1, texto })));
  return out;
}
const totalVersos = versos => (versos || []).filter(t => paraVoz(t)).length;
// Primer trozo del versículo v (o del siguiente que exista).
function indiceDe(lista, v) {
  const n = Number(v) || 0;
  const i = (lista || []).findIndex(x => x.v >= n);
  return i < 0 ? Math.max(0, (lista || []).length - 1) : i;
}
// Primer trozo del versículo anterior al del trozo i (0 si no hay).
function anterior(lista, i) {
  const v = lista[i] ? lista[i].v : 0;
  for (let j = Math.min(i, lista.length) - 1; j >= 0; j--) if (lista[j].v < v) return indiceDe(lista, lista[j].v);
  return 0;
}
// Primer trozo del versículo siguiente (-1 si era el último).
function siguiente(lista, i) {
  const v = lista[i] ? lista[i].v : -1;
  for (let j = i + 1; j < lista.length; j++) if (lista[j].v > v) return j;
  return -1;
}

// Un capítulo cuenta como leído si sonaron al menos 8 de cada 10 versículos.
const MIN_OIDO = 0.8;
const completo = (oidos, total) => total > 0 && oidos >= Math.ceil(total * MIN_OIDO);

// ---- Voces ----
const PAISES = {
  ES: "España", MX: "México", US: "Estados Unidos", AR: "Argentina", BO: "Bolivia", CL: "Chile", CO: "Colombia",
  CR: "Costa Rica", CU: "Cuba", DO: "República Dominicana", EC: "Ecuador", GT: "Guatemala", HN: "Honduras",
  NI: "Nicaragua", PA: "Panamá", PE: "Perú", PR: "Puerto Rico", PY: "Paraguay", SV: "El Salvador",
  UY: "Uruguay", VE: "Venezuela", "419": "Latinoamérica"
};
// Voces de juguete (Eddy, Abuela, Rocko…): suenan a robot, van al final.
const RARAS = /eloquence|novelty|\b(Eddy|Flo|Grandma|Grandpa|Abuela|Abuelo|Reed|Rocko|Sandy|Shelley)\b/i;
const idVoz = v => (v && (v.voiceURI || v.name)) || "";
const esEspanol = v => !!v && /^es([-_]|$)/i.test(v.lang || "");
function pais(lang) {
  const m = /^es[-_]([A-Za-z]{2}|\d{3})\b/i.exec(lang || "");
  return m ? m[1].toUpperCase() : "";
}
function calidad(v) {
  const id = `${v.voiceURI || ""} ${v.name || ""}`;
  if (RARAS.test(id)) return 0;
  if (/premium/i.test(id)) return 3;
  if (/enhanced|mejorad/i.test(id)) return 2;
  return 1;
}
// Las voces en español, la mejor primero: calidad; luego Latinoamérica
// (el dueño está en Bolivia) antes que España; luego el nombre.
function voces(lista) {
  const vistas = new Set();
  return (lista || []).filter(v => esEspanol(v) && !vistas.has(idVoz(v)) && vistas.add(idVoz(v)))
    .sort((a, b) => calidad(b) - calidad(a)
      || (pais(a.lang) === "ES") - (pais(b.lang) === "ES")
      || String(a.name || "").localeCompare(String(b.name || ""), "es"));
}
// La voz guardada si este teléfono la tiene; si no, la mejor en español.
function elegirVoz(lista, preferida) {
  const vs = voces(lista);
  return (preferida && vs.find(v => idVoz(v) === preferida)) || vs[0] || null;
}
// "Paulina · México (mejorada)".
function etiquetaVoz(v) {
  if (!v) return "Voz del sistema";
  const base = String(v.name || "Voz").replace(/\s*\(.*\)\s*$/, "").trim() || "Voz";
  const p = PAISES[pais(v.lang)];
  const q = calidad(v);
  return `${base}${p ? ` · ${p}` : ""}${q === 3 ? " (premium)" : q === 2 ? " (mejorada)" : ""}`;
}

return {
  VELOCIDADES, VEL_NORMAL, velNormal, etiquetaVel, siguienteVel,
  paraVoz, MAX_TROZO, partir, nombreVoz, encabezado,
  trozos, totalVersos, indiceDe, anterior, siguiente, MIN_OIDO, completo,
  idVoz, esEspanol, pais, calidad, voces, elegirVoz, etiquetaVoz
};
});
