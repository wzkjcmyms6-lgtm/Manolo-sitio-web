// ---------- Lugares: tu guía personal de dónde comer (lógica, sin pantalla) ----------
// Pedido del dueño (2026-11-15, D-117): lugares a los que vas, qué venden,
// qué probaste, si te gustó y si volverías. Datos en users/{uid}/lugares/{id}
// (como Libros: en la nube, con copia en el teléfono). Las fotos completas van
// en el teléfono (IndexedDB, js/lugares-fotos.js); en el documento solo queda
// una miniatura de cada una. Pantalla en js/lugares.js.
//
// Documento (v: 1):
//   { v, nombre, estado: "visitado"|"quiero", calificacion (1–5 | null),
//     volveria: "si"|"tal_vez"|"no"|null, tipo, zona, maps, especialidad,
//     precio (1–3 | null), gastoAproxCent, desglose: { comida, atencion,
//     ambiente, precioCalidad } (1–5 | null), etiquetas: [..], notas,
//     platos: { id: { nombre, precioCent, gusto (true|false|null), nota,
//     favorito, creado } }, visitas: { id: { fecha, conQuien, gastoCent,
//     nota, creado } }, fotos: [{ id, mini, ancho, alto }], creado, actualizado }
// Sin DOM: tests/lugares-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LugaresMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const TIPOS = [
  { id: "restaurante", nombre: "Restaurante", emoji: "🍽️" },
  { id: "cafe", nombre: "Café", emoji: "☕" },
  { id: "rapida", nombre: "Comida rápida", emoji: "🍔" },
  { id: "pasteleria", nombre: "Pastelería", emoji: "🧁" },
  { id: "bar", nombre: "Bar", emoji: "🍹" },
  { id: "callejero", nombre: "Puesto callejero", emoji: "🌮" },
  { id: "otro", nombre: "Otro", emoji: "📍" }
];
const TIPO = Object.fromEntries(TIPOS.map(t => [t.id, t]));
const VOLVERIA = [
  { id: "si", nombre: "Sí" },
  { id: "tal_vez", nombre: "Tal vez" },
  { id: "no", nombre: "No" }
];
const VOLV = Object.fromEntries(VOLVERIA.map(v => [v.id, v]));
const DESGLOSE = [
  { id: "comida", nombre: "Comida" },
  { id: "atencion", nombre: "Atención" },
  { id: "ambiente", nombre: "Ambiente" },
  { id: "precioCalidad", nombre: "Precio-calidad" }
];
const ORDENES = [
  { id: "mejores", nombre: "Mejor calificados" },
  { id: "visitados", nombre: "Más visitados" },
  { id: "recientes", nombre: "Recientes" },
  { id: "baratos", nombre: "Más baratos" }
];
const MAX = { nombre: 80, zona: 60, especialidad: 120, notas: 2000, etiqueta: 24, etiquetas: 12, plato: 80, notaPlato: 140, conQuien: 80, notaVisita: 300, fotos: 6, maps: 500, monto: 1e8 };

// ---- Ayudas ----
const texto = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const textoLargo = (v, max) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, max);
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(`${f}T12:00:00Z`));
const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const entero15 = v => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };

// "85,50", "85.5", "1.250,75" → centavos; vacío → null; inválido → NaN.
function aCent(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 && v < MAX.monto ? Math.round(v * 100) : NaN;
  let t = String(v).trim().replace(/\s|Bs\.?/gi, "");
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");   // 1.250,75
  else t = t.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  const n = Number(t);
  return n < MAX.monto ? Math.round(n * 100) : NaN;
}

// Miniatura de una foto: data URL de imagen en base64, y nada más (QA, D-119).
const miniOk = m => typeof m === "string" && m.length <= 400000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(m);
// Link de Google Maps (o cualquier https): solo http(s), sin espacios.
function mapsOk(url) {
  const u = String(url || "").trim();
  if (!u) return true;
  if (u.length > MAX.maps || /\s/.test(u)) return false;
  try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:"; } catch (e) { return false; }
}

// "Fe, familia ,fe" o ["fe"] → ["fe", "familia"] (minúsculas, sin repetir).
function etiquetasDe(v) {
  const lista = Array.isArray(v) ? v : String(v || "").split(/[,;\n#]/);
  const out = [];
  lista.forEach(x => {
    const t = texto(x, MAX.etiqueta).toLowerCase();
    if (t && !out.includes(t) && out.length < MAX.etiquetas) out.push(t);
  });
  return out;
}

// ---- Validar lo que escribes ----
// datos: { nombre, estado, calificacion, volveria, tipo, zona, maps,
//   especialidad, precio, gastoAprox, desglose: {..}, etiquetas, notas }
// → { ok, errores: [{ campo, texto }], doc }
function validarLugar(datos) {
  const d = datos || {};
  const errores = [];
  const err = (campo, t) => errores.push({ campo, texto: t });
  const nombre = texto(d.nombre, MAX.nombre);
  if (!nombre) err("nombre", "Escribe el nombre del lugar.");
  const estado = d.estado === "quiero" ? "quiero" : "visitado";
  let calificacion = entero15(d.calificacion);
  let volveria = VOLV[d.volveria] ? d.volveria : null;
  if (estado === "visitado") {
    if (!calificacion) err("calificacion", "Elige de 1 a 5 estrellas.");
    if (!volveria) err("volveria", "Dime si volverías.");
  } else { calificacion = null; volveria = null; }
  const maps = texto(d.maps, MAX.maps);
  if (!mapsOk(maps)) err("maps", "Pega el link completo (empieza con https://).");
  const gastoAproxCent = aCent(d.gastoAprox);
  if (Number.isNaN(gastoAproxCent)) err("gastoAprox", "Escribe el gasto como número (por ejemplo 85,50).");
  const precio = [1, 2, 3].includes(Number(d.precio)) ? Number(d.precio) : null;
  const desglose = {};
  DESGLOSE.forEach(x => { desglose[x.id] = estado === "visitado" ? entero15(d.desglose && d.desglose[x.id]) : null; });
  if (errores.length) return { ok: false, errores, doc: null };
  return { ok: true, errores: [], doc: {
    v: 1, nombre, estado, calificacion, volveria,
    tipo: TIPO[d.tipo] ? d.tipo : null,
    zona: texto(d.zona, MAX.zona),
    maps,
    especialidad: texto(d.especialidad, MAX.especialidad),
    precio,
    gastoAproxCent,
    desglose,
    etiquetas: etiquetasDe(d.etiquetas),
    notas: textoLargo(d.notas, MAX.notas)
  } };
}

// Un plato: { nombre, precio, gusto ("si"|"no"|""), nota, favorito }.
function validarPlato(datos) {
  const d = datos || {};
  const nombre = texto(d.nombre, MAX.plato);
  const precioCent = aCent(d.precio);
  const errores = [];
  if (!nombre) errores.push({ campo: "nombre", texto: "Escribe el nombre del plato." });
  if (Number.isNaN(precioCent)) errores.push({ campo: "precio", texto: "Escribe el precio como número (por ejemplo 35)." });
  if (errores.length) return { ok: false, errores, plato: null };
  const gusto = d.gusto === true || d.gusto === "si" ? true : d.gusto === false || d.gusto === "no" ? false : null;
  return { ok: true, errores: [], plato: { nombre, precioCent, gusto, nota: texto(d.nota, MAX.notaPlato), favorito: d.favorito === true || d.favorito === "on" } };
}

// Una visita: { fecha, conQuien, gasto, nota }; la fecha no puede ser futura.
function validarVisita(datos, hoy) {
  const d = datos || {};
  const errores = [];
  const fecha = String(d.fecha || "").trim();
  if (!fechaOk(fecha)) errores.push({ campo: "fecha", texto: "Elige la fecha de la visita." });
  else if (hoy && fecha > hoy) errores.push({ campo: "fecha", texto: "La fecha no puede ser futura." });
  const gastoCent = aCent(d.gasto);
  if (Number.isNaN(gastoCent)) errores.push({ campo: "gasto", texto: "Escribe el gasto como número (por ejemplo 85,50)." });
  if (errores.length) return { ok: false, errores, visita: null };
  return { ok: true, errores: [], visita: { fecha, conQuien: texto(d.conQuien, MAX.conQuien), gastoCent, nota: texto(d.nota, MAX.notaVisita) } };
}

// ---- Leer lo guardado (documentos viejos o incompletos también) ----
function normalizar(id, doc) {
  const d = doc && typeof doc === "object" ? doc : {};
  const estado = d.estado === "quiero" ? "quiero" : "visitado";
  const platos = Object.keys(d.platos && typeof d.platos === "object" ? d.platos : {})
    .filter(k => d.platos[k] && texto(d.platos[k].nombre, MAX.plato))
    .map(k => { const p = d.platos[k]; return { id: k, nombre: texto(p.nombre, MAX.plato), precioCent: Number.isInteger(p.precioCent) ? p.precioCent : null, gusto: p.gusto === true ? true : p.gusto === false ? false : null, nota: texto(p.nota, MAX.notaPlato), favorito: p.favorito === true, creado: Number(p.creado) || 0 }; })
    .sort((a, b) => (b.favorito - a.favorito) || a.creado - b.creado || a.nombre.localeCompare(b.nombre, "es"));
  const visitas = Object.keys(d.visitas && typeof d.visitas === "object" ? d.visitas : {})
    .filter(k => d.visitas[k] && fechaOk(d.visitas[k].fecha))
    .map(k => { const v = d.visitas[k]; return { id: k, fecha: v.fecha, conQuien: texto(v.conQuien, MAX.conQuien), gastoCent: Number.isInteger(v.gastoCent) ? v.gastoCent : null, nota: texto(v.nota, MAX.notaVisita), creado: Number(v.creado) || 0 }; })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
  const fotos = (Array.isArray(d.fotos) ? d.fotos : []).filter(f => f && typeof f.id === "string").slice(0, MAX.fotos)
    .map(f => ({ id: f.id, mini: miniOk(f.mini) ? f.mini : null, ancho: Number(f.ancho) || 0, alto: Number(f.alto) || 0 }));
  const desglose = {};
  DESGLOSE.forEach(x => { desglose[x.id] = entero15(d.desglose && d.desglose[x.id]); });
  return {
    id, nombre: texto(d.nombre, MAX.nombre) || "Sin nombre", estado,
    calificacion: estado === "visitado" ? entero15(d.calificacion) : null,
    volveria: estado === "visitado" && VOLV[d.volveria] ? d.volveria : null,
    tipo: TIPO[d.tipo] ? d.tipo : null, zona: texto(d.zona, MAX.zona), maps: mapsOk(d.maps) ? texto(d.maps, MAX.maps) : "",
    especialidad: texto(d.especialidad, MAX.especialidad), precio: [1, 2, 3].includes(d.precio) ? d.precio : null,
    gastoAproxCent: Number.isInteger(d.gastoAproxCent) ? d.gastoAproxCent : null, desglose,
    etiquetas: etiquetasDe(d.etiquetas), notas: textoLargo(d.notas, MAX.notas),
    platos, visitas, fotos, creado: Number(d.creado) || 0, actualizado: Number(d.actualizado) || Number(d.creado) || 0
  };
}

// "Fuiste X veces · última: fecha" y el gasto de todas las visitas.
function resumenVisitas(l) {
  const vs = (l && l.visitas) || [];
  return { veces: vs.length, ultima: vs.length ? vs[0].fecha : null, gastoCent: vs.reduce((s, v) => s + (v.gastoCent || 0), 0) };
}
const favorito = l => ((l && l.platos) || []).find(p => p.favorito) || null;
const precioTxt = n => ([1, 2, 3].includes(n) ? "$".repeat(n) : "");
// Montos como en el resto de la app ("Bs 1.250,5").
const bs = cent => `Bs ${(Number(cent || 0) / 100).toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// "10 nov" (con el año si no es el de hoy).
function fechaCorta(f, hoy) {
  if (!fechaOk(f)) return "";
  const [y, m, d] = f.split("-").map(Number);
  return `${d} ${MESES[m - 1]}${hoy && hoy.slice(0, 4) !== f.slice(0, 4) ? ` ${y}` : ""}`;
}

// ---- Buscar, filtrar y ordenar ----
// Busca en el nombre, los platos, las etiquetas y lo que venden (sin tildes;
// todas las palabras tienen que estar).
function coincide(l, q) {
  const palabras = sinTildes(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  const heno = sinTildes([l.nombre, l.especialidad, l.zona, ...(l.etiquetas || []), ...(l.platos || []).map(p => p.nombre)].join(" "));
  return palabras.every(p => heno.includes(p));
}
// f: { estado, q, tipo, zona, precio, volveria, minCal }
function filtrar(lugares, f) {
  const o = f || {};
  return (lugares || []).filter(l => (!o.estado || l.estado === o.estado)
    && (!o.tipo || l.tipo === o.tipo)
    && (!o.zona || sinTildes(l.zona) === sinTildes(o.zona))
    && (!o.precio || l.precio === Number(o.precio))
    && (!o.volveria || l.volveria === o.volveria)
    && (!o.minCal || (l.calificacion || 0) >= Number(o.minCal))
    && coincide(l, o.q));
}
const ultimaFecha = l => (l.visitas && l.visitas[0] ? l.visitas[0].fecha : "");
function ordenar(lugares, orden) {
  const nom = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  const reciente = (a, b) => ultimaFecha(b).localeCompare(ultimaFecha(a)) || (b.actualizado || 0) - (a.actualizado || 0);
  const cmp = {
    mejores: (a, b) => (b.calificacion || 0) - (a.calificacion || 0) || b.visitas.length - a.visitas.length || nom(a, b),
    visitados: (a, b) => b.visitas.length - a.visitas.length || (b.calificacion || 0) - (a.calificacion || 0) || nom(a, b),
    recientes: (a, b) => reciente(a, b) || nom(a, b),
    // Sin nivel de precio, al final.
    baratos: (a, b) => (a.precio || 9) - (b.precio || 9) || (a.gastoAproxCent == null ? 1e12 : a.gastoAproxCent) - (b.gastoAproxCent == null ? 1e12 : b.gastoAproxCent) || (b.calificacion || 0) - (a.calificacion || 0) || nom(a, b)
  }[orden] || ((a, b) => reciente(a, b) || nom(a, b));
  return (lugares || []).slice().sort(cmp);
}
// Las zonas que usaste (para el filtro), sin repetir.
function zonas(lugares) {
  const vistas = new Map();
  (lugares || []).forEach(l => { const k = sinTildes(l.zona); if (k && !vistas.has(k)) vistas.set(k, l.zona); });
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, "es"));
}

// ---- ¿Dónde como hoy? ----
// Uno al azar entre los visitados con "Volvería: Sí" (y el tipo o precio que
// elijas); evita repetir el último si hay otro. azar() → [0, 1).
function sugerir(lugares, f, azar, excluir) {
  const o = f || {};
  const lista = (lugares || []).filter(l => l.estado === "visitado" && l.volveria === "si"
    && (!o.tipo || l.tipo === o.tipo) && (!o.precio || l.precio === Number(o.precio)));
  if (!lista.length) return null;
  const sinRepetir = lista.length > 1 && excluir ? lista.filter(l => l.id !== excluir) : lista;
  const r = typeof azar === "function" ? azar() : Math.random();
  return sinRepetir[Math.min(sinRepetir.length - 1, Math.floor(r * sinRepetir.length))];
}

// ---- Estadísticas ----
function estadisticas(lugares) {
  const todos = lugares || [];
  const vis = todos.filter(l => l.estado === "visitado");
  const conCal = vis.filter(l => l.calificacion);
  const promedio = conCal.length ? Math.round((conCal.reduce((s, l) => s + l.calificacion, 0) / conCal.length) * 10) / 10 : null;
  const top5 = ordenar(conCal, "mejores").slice(0, 5);
  const gastoTotalCent = vis.reduce((s, l) => s + resumenVisitas(l).gastoCent, 0);
  const visitasTotal = vis.reduce((s, l) => s + l.visitas.length, 0);
  // El tipo de comida más visitado: por visitas anotadas (o por lugares, si no hay visitas).
  const cuenta = {};
  vis.forEach(l => { if (l.tipo) cuenta[l.tipo] = (cuenta[l.tipo] || 0) + (visitasTotal ? l.visitas.length : 1); });
  const tipoId = Object.keys(cuenta).filter(k => cuenta[k] > 0).sort((a, b) => cuenta[b] - cuenta[a] || TIPOS.findIndex(t => t.id === a) - TIPOS.findIndex(t => t.id === b))[0] || null;
  return { total: todos.length, visitados: vis.length, quiero: todos.length - vis.length, promedio, top5, gastoTotalCent, visitasTotal,
    tipoTop: tipoId ? { id: tipoId, nombre: TIPO[tipoId].nombre, emoji: TIPO[tipoId].emoji, n: cuenta[tipoId], por: visitasTotal ? "visitas" : "lugares" } : null };
}

// Un id corto para platos, visitas y fotos.
function nuevoId(prefijo, ahora, azar) {
  const r = Math.floor((typeof azar === "function" ? azar() : Math.random()) * 1e6).toString(36);
  return `${prefijo}${Number(ahora || Date.now()).toString(36)}${r}`;
}

return { TIPOS, TIPO, VOLVERIA, VOLV, DESGLOSE, ORDENES, MAX, aCent, mapsOk, miniOk, etiquetasDe, sinTildes, fechaOk,
  validarLugar, validarPlato, validarVisita, normalizar, resumenVisitas, favorito, precioTxt, bs, fechaCorta,
  coincide, filtrar, ordenar, zonas, sugerir, estadisticas, nuevoId };
});
