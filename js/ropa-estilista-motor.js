// ---------- Ropa: tu estilista, la lógica (D-158) ----------
// Sin pantalla ni red (tests/ropa-estilista-motor.test.js). Las conversaciones
// (users/{uid}/ropa_charlas: { v, titulo, mensajes [{ de: "yo" | "ia", texto,
// outfits [{ prendas, nombre, porque, capas }], faltan [{ grupo, tipo, color,
// porque }], recordo [frases], sinMostrar, fecha }], creado, editado }), lo que
// va al puente (/charla: lo hablado antes, tu ropa con lo que está para lavar
// marcado, tu presupuesto) y lo que recuerda de ti (meta/ropa_ajustes.memoria:
// [{ id, texto, fecha }], sin repetir, hasta 30). Lo de la IA se revisa en la
// pantalla con RopaOutfitMotor.validas (completo y con tu ropa).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RopaEstilistaMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const MAX_MENSAJES = 40;     // por conversación (después, una nueva: nada se borra)
const MAX_MEMORIA = 30;      // lo que recuerda de ti
const PARA_IA = 20;          // los mensajes de antes que van al puente (él usa los últimos 10 que sirven)
const MAX_TEXTO = 600;       // lo que escribes (como el puente)
const GRUPOS = ["arriba", "abajo", "cuerpo", "abrigos", "zapatos", "accesorios"];
// Para tocar cuando la conversación está vacía (se escriben en el cuadro; no se mandan solos).
const EJEMPLOS = ["Hace frío: una chompa y una chamarra encima", "Mañana tengo una reunión formal", "¿Con qué combino mis zapatillas blancas?"];

const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const texto = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const num = v => (typeof v === "number" && isFinite(v) && v >= 0 ? v : 0);
const ids = v => [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === "string" && x))];
// La primera letra en mayúscula (lo demás, como vino).
const mayus = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// El título de una conversación: el comienzo de tu primer mensaje (hasta 48
// letras, sin cortar una palabra).
function titulo(t) {
  const s = texto(t, 200);
  if (s.length <= 48) return s;
  const corte = s.slice(0, 48);
  const i = corte.lastIndexOf(" ");
  return `${(i >= 20 ? corte.slice(0, i) : corte).replace(/[\s,.;:¿?¡!-]+$/, "")}…`;
}

// ---- Los mensajes ----
function outfitDe(o) {
  const x = obj(o);
  const prendas = ids(x.prendas).slice(0, 8);
  return prendas.length >= 2 ? { prendas, nombre: texto(x.nombre, 40), porque: texto(x.porque, 200), capas: texto(x.capas, 160) } : null;
}
function faltaDe(f) {
  const x = obj(f);
  const tipo = mayus(texto(x.tipo, 40));
  return GRUPOS.includes(x.grupo) && tipo ? { grupo: x.grupo, tipo, color: texto(x.color, 30), porque: texto(x.porque, 200) } : null;
}
function mensaje(m) {
  const x = obj(m);
  const de = x.de === "ia" ? "ia" : x.de === "yo" ? "yo" : null;
  if (!de) return null;
  const t = texto(x.texto, de === "ia" ? 900 : MAX_TEXTO);
  if (de === "yo") return t ? { de, texto: t, outfits: [], faltan: [], recordo: [], sinMostrar: 0, fecha: num(x.fecha) } : null;
  const outfits = (Array.isArray(x.outfits) ? x.outfits : []).map(outfitDe).filter(Boolean).slice(0, 3);
  const faltan = (Array.isArray(x.faltan) ? x.faltan : []).map(faltaDe).filter(Boolean).slice(0, 2);
  const recordo = (Array.isArray(x.recordo) ? x.recordo : []).map(r => texto(r, 120)).filter(Boolean).slice(0, 2);
  if (!t && !outfits.length) return null;
  return { de, texto: t, outfits, faltan, recordo, sinMostrar: Math.min(3, Math.floor(num(x.sinMostrar))), fecha: num(x.fecha) };
}
// Lo guardado → { id, titulo, mensajes, creado, editado }.
function normalizar(id, d) {
  const x = obj(d);
  const mensajes = (Array.isArray(x.mensajes) ? x.mensajes : []).map(mensaje).filter(Boolean).slice(0, MAX_MENSAJES);
  const primero = mensajes.find(m => m.de === "yo");
  return { id, titulo: texto(x.titulo, 60) || titulo(primero ? primero.texto : "") || "Conversación", mensajes, creado: num(x.creado), editado: num(x.editado) || num(x.creado) };
}
// La más nueva (la última que usaste) primero.
const ordenar = cs => (cs || []).slice().sort((a, b) => b.editado - a.editado || (a.id < b.id ? -1 : 1));
// Ya no entra otra pregunta con su respuesta: lo que escribas empieza una nueva.
const llena = c => !!c && c.mensajes.length + 2 > MAX_MENSAJES;
// Tu último mensaje, si la IA no lo contestó (para "Volver a preguntar").
function sinRespuesta(c) {
  const u = c && c.mensajes.length ? c.mensajes[c.mensajes.length - 1] : null;
  return u && u.de === "yo" ? u : null;
}
// Lo hablado antes para el puente (sin el mensaje nuevo): los últimos 20; de
// los de tu estilista, también los outfits que armó (tus ids; con el puente 6
// o más, también su nombre, para "la opción 2" o "el de capas": D-159).
function historial(mensajes, conNombre) {
  return (mensajes || []).slice(-PARA_IA).map(m => (m.de === "ia"
    ? { de: "ia", texto: m.texto, outfits: m.outfits.map(o => (conNombre ? { prendas: o.prendas, nombre: o.nombre } : o.prendas)) }
    : { de: "yo", texto: m.texto }));
}
// El día (AAAA-MM-DD) de un momento, en este teléfono.
function fechaLocal(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// ¿Es de hoy? (la usaste hoy por última vez).
const deHoy = (c, hoy) => !!c && fechaLocal(c.editado) === hoy;
// Lo que ya viste hoy (D-159): los outfits de tu estilista en tus otras
// conversaciones de hoy (lo más nuevo primero) y las opciones de Outfits de
// hoy; sin repetir, hasta 9. Los de la conversación abierta ya van en lo
// hablado.
function delDia(charlas, idActual, hoy, deOutfits) {
  const vistos = new Set(), out = [];
  const sumar = o => {
    const prendas = ids(o && o.prendas).slice(0, 8);
    const k = prendas.slice().sort().join("|");
    if (prendas.length < 2 || vistos.has(k) || out.length >= 9) return;
    vistos.add(k);
    out.push({ prendas, nombre: texto(o.nombre, 40) });
  };
  (charlas || []).filter(c => c && c.id !== idActual).forEach(c => c.mensajes.slice().reverse()
    .filter(m => m.de === "ia" && fechaLocal(m.fecha) === hoy).forEach(m => m.outfits.forEach(sumar)));
  (deOutfits || []).forEach(sumar);
  return out;
}
// "Otra opción" de un outfit: un mensaje más a tu estilista.
const otraOpcion = nombre => (texto(nombre, 40) ? `Dame otra opción distinta de «${texto(nombre, 40)}».` : "Dame otra opción distinta.");

// ---- Tu ropa para el puente: lo que tienes, con lo que está para lavar marcado ----
// (prendas ya normalizadas por RopaMotor; lo que ya no tienes no va).
const roperoParaCharla = ropero => (ropero || []).filter(p => p && (p.estado === "activa" || p.estado === "lavar")).map(p => ({
  id: p.id, grupo: p.grupo, tipo: p.tipo, colores: (p.colores || []).map(c => (c && typeof c === "object" ? c.id : c)).filter(Boolean),
  estampado: p.estampado || "", tela: p.tela || "", corte: p.corte || "", manga: p.manga || "", estilo: (p.estilo || []).slice(), clima: (p.clima || []).slice(),
  formalidad: p.formalidad == null ? null : p.formalidad, marca: p.marca || "", lavar: p.estado === "lavar"
}));

// ---- Tu presupuesto de ropa del mes, para tu estilista (si tienes uno) ----
const bs = n => `Bs ${(Math.round(n * 100) / 100).toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
function presupuestoTexto(tope, gastado) {
  if (!(typeof tope === "number" && tope > 0)) return "";
  const queda = Math.round((tope - (num(gastado) || 0)) * 100) / 100;
  return queda >= 0 ? `Este mes me quedan ${bs(queda)} de ${bs(tope)} para ropa.` : `Este mes ya me pasé ${bs(-queda)} de mi presupuesto de ropa (${bs(tope)}).`;
}

// ---- Lo que recuerda de ti ----
// Para no repetir: sin mayúsculas, tildes ni signos.
const claveMemoria = t => texto(t, 120).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
// Lo guardado → [{ id, texto, fecha }], sin repetir, los 30 más nuevos (la lista va de lo más viejo a lo más nuevo).
function memoria(v) {
  const vistas = new Set(), vistosId = new Set();
  return (Array.isArray(v) ? v : []).map((m, i) => {
    const x = obj(m);
    const t = mayus(texto(x.texto, 120)), k = claveMemoria(t);
    if (!t || !k || vistas.has(k)) return null;
    vistas.add(k);
    let id = texto(x.id, 40) || `m${i}`;
    if (vistosId.has(id)) id = `${id}-${i}`;
    vistosId.add(id);
    return { id, texto: t, fecha: num(x.fecha) };
  }).filter(Boolean).slice(-MAX_MEMORIA);
}
// Suma lo nuevo (sin repetir; si pasa de 30, se va lo más viejo). nuevoId(i) da el id de cada uno.
// → { lista, nuevos }
function recordar(lista, frases, fecha, nuevoId) {
  const actual = memoria(lista);
  const ks = new Set(actual.map(m => claveMemoria(m.texto)));
  const nuevos = [];
  (Array.isArray(frases) ? frases : []).forEach((f, i) => {
    const t = mayus(texto(f, 120)), k = claveMemoria(t);
    if (!t || !k || ks.has(k)) return;
    ks.add(k);
    nuevos.push({ id: String(nuevoId ? nuevoId(i) : `m${Date.now()}-${i}`), texto: t, fecha: num(fecha) });
  });
  return { lista: actual.concat(nuevos).slice(-MAX_MEMORIA), nuevos };
}
const olvidar = (lista, quitar) => memoria(lista).filter(m => !(quitar || []).includes(m.id));
// ¿Todavía lo recuerda? (lo que dice un mensaje viejo, si no lo borraste).
const recuerda = (lista, frase) => { const k = claveMemoria(frase); return !!k && memoria(lista).some(m => claveMemoria(m.texto) === k); };

// ---- Cuándo (en la lista de conversaciones) ----
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function cuando(ms, ahora) {
  if (!ms) return "";
  const d = new Date(ms), h = new Date(ahora == null ? Date.now() : ahora);
  const dia = x => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const dif = Math.round((dia(h) - dia(d)) / 864e5);
  if (dif === 0) return "hoy";
  if (dif === 1) return "ayer";
  return `el ${d.getDate()} de ${MESES[d.getMonth()]}${d.getFullYear() !== h.getFullYear() ? ` de ${d.getFullYear()}` : ""}`;
}

return {
  MAX_MENSAJES, MAX_MEMORIA, PARA_IA, MAX_TEXTO, EJEMPLOS, texto, titulo, mensaje, normalizar, ordenar, llena, sinRespuesta, historial, fechaLocal, deHoy, delDia, otraOpcion,
  roperoParaCharla, presupuestoTexto, claveMemoria, memoria, recordar, olvidar, recuerda, cuando
};
});
