// ---------- Libros: motor sin pantalla ----------
// Validar libros y frases, ordenar, buscar, resumen, colores de la tapa
// genérica y exportar. Sin DOM ni Firebase: tests/libros-motor.test.js.
// Colecciones: users/{uid}/libros y users/{uid}/libros_frases (docs/DATABASE.md).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LibrosMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const ESTADOS = [
  { id: "por_leer", nombre: "Por leer", emoji: "📚" },
  { id: "leyendo", nombre: "Leyendo", emoji: "📖" },
  { id: "terminado", nombre: "Terminado", emoji: "✅" }
];
const ESTADO = {};
ESTADOS.forEach(e => { ESTADO[e.id] = e; });
const ORDENES = [
  { id: "registro", nombre: "Registrado (nuevo primero)" },
  { id: "fin", nombre: "Terminado (nuevo primero)" },
  { id: "inicio", nombre: "Empezado (nuevo primero)" },
  { id: "titulo", nombre: "Título (A–Z)" }
];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const normalizar = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(new Date(f + "T12:00:00Z").getTime());
const texto = (s, max) => String(s == null ? "" : s).replace(/\r\n?/g, "\n").trim().slice(0, max);
function fechaLarga(f) {
  if (!fechaOk(f)) return f || "";
  const [a, m, d] = f.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)} ${a}`;
}
const estrellas = n => (n >= 1 && n <= 5 ? "★".repeat(n) + "☆".repeat(5 - n) : "");

// ---- Libros ----
// Datos del formulario → documento. { ok, errores: [{campo, texto}], doc }.
function validarLibro(datos, opciones) {
  const o = opciones || {};
  const errores = [];
  const err = (campo, t) => errores.push({ campo, texto: t });
  const titulo = texto(datos.titulo, 200).replace(/\s+/g, " ");
  if (!titulo) err("titulo", "Escribe el título.");
  const paginasTxt = String(datos.paginas == null ? "" : datos.paginas).trim();
  let paginas = null;
  if (paginasTxt) {
    paginas = Number(paginasTxt);
    if (!(Number.isInteger(paginas) && paginas >= 1 && paginas <= 20000)) { err("paginas", "Revisa las páginas (un número entero)."); paginas = null; }
  }
  const estado = ESTADO[datos.estado] ? datos.estado : "por_leer";
  const calTxt = String(datos.calificacion == null ? "" : datos.calificacion).trim();
  let calificacion = null;
  if (calTxt && calTxt !== "0") {
    calificacion = Number(calTxt);
    if (!(Number.isInteger(calificacion) && calificacion >= 1 && calificacion <= 5)) { err("calificacion", "La calificación va de 1 a 5."); calificacion = null; }
  }
  const fecha = (campo, nombre, obligatoria) => {
    const f = String(datos[campo] || "").trim();
    if (!f) { if (obligatoria) err(campo, `Pon la ${nombre}.`); return null; }
    if (!fechaOk(f)) { err(campo, `Revisa la ${nombre}.`); return null; }
    if (o.hoy && f > o.hoy) { err(campo, `La ${nombre} no puede ser futura.`); return null; }
    return f;
  };
  const fechaRegistro = fecha("fechaRegistro", "fecha de registro", true);
  const fechaInicio = fecha("fechaInicio", "fecha de inicio", false);
  const fechaFin = fecha("fechaFin", "fecha de fin", false);
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) err("fechaFin", "La fecha de fin no puede ser antes del inicio.");
  if (errores.length) return { ok: false, errores, doc: null };
  return {
    ok: true, errores: [],
    doc: { v: 1, titulo, autor: texto(datos.autor, 150).replace(/\s+/g, " "), paginas, estado, calificacion, opinion: texto(datos.opinion, 5000), fechaRegistro, fechaInicio, fechaFin }
  };
}

function normalizarLibro(id, d) {
  d = d || {};
  return {
    id, titulo: d.titulo ? String(d.titulo) : "Sin título", autor: d.autor ? String(d.autor) : "",
    paginas: Number.isInteger(d.paginas) ? d.paginas : null, estado: ESTADO[d.estado] ? d.estado : "por_leer",
    calificacion: Number.isInteger(d.calificacion) && d.calificacion >= 1 && d.calificacion <= 5 ? d.calificacion : null,
    opinion: d.opinion ? String(d.opinion) : "", fechaRegistro: fechaOk(d.fechaRegistro) ? d.fechaRegistro : "",
    fechaInicio: fechaOk(d.fechaInicio) ? d.fechaInicio : null, fechaFin: fechaOk(d.fechaFin) ? d.fechaFin : null,
    portada: d.portada && typeof d.portada === "object" ? d.portada : null,
    creado: typeof d.creado === "number" ? d.creado : 0
  };
}

// Orden: por fecha (la más nueva primero; los que no tienen esa fecha, al
// final) o por título.
function ordenar(lista, criterio) {
  const porTitulo = (a, b) => a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base" });
  const campo = { registro: "fechaRegistro", fin: "fechaFin", inicio: "fechaInicio" }[criterio];
  if (!campo) return lista.slice().sort((a, b) => porTitulo(a, b) || a.id.localeCompare(b.id));
  return lista.slice().sort((a, b) => {
    const fa = a[campo] || "", fb = b[campo] || "";
    if (!fa !== !fb) return fa ? -1 : 1;
    return fb.localeCompare(fa) || (b.creado - a.creado) || porTitulo(a, b);
  });
}

// Buscar por título o autor (todas las palabras, sin tildes) y filtrar por estado.
function filtrar(lista, f) {
  f = f || {};
  const palabras = normalizar(f.texto).split(/\s+/).filter(Boolean);
  return lista.filter(l => (!f.estado || l.estado === f.estado) && palabras.every(p => normalizar(`${l.titulo} ${l.autor}`).includes(p)));
}

function resumen(lista, hoy) {
  const r = { total: lista.length, por_leer: 0, leyendo: 0, terminado: 0, paginasLeidas: 0, terminadosEsteAnio: 0 };
  const anio = String(hoy || "").slice(0, 4);
  lista.forEach(l => {
    r[l.estado]++;
    if (l.estado === "terminado") {
      if (l.paginas) r.paginasLeidas += l.paginas;
      if (anio && (l.fechaFin || "").startsWith(anio)) r.terminadosEsteAnio++;
    }
  });
  return r;
}

// Tapa genérica: dos tonos oscuros elegidos por el título (siempre los
// mismos para el mismo libro).
const TAPAS = [["#3b2a6e", "#1d1640"], ["#0f4c5c", "#0a2a33"], ["#7a2e2e", "#3d1414"], ["#2f5d3a", "#15301d"],
  ["#6b4a1f", "#33230e"], ["#1f3b73", "#0f1e3d"], ["#5c2a5e", "#2e152f"], ["#3d4a52", "#1e2529"]];
function colorTapa(titulo, autor) {
  let h = 0;
  for (const c of normalizar(`${titulo}|${autor}`)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAPAS[h % TAPAS.length];
}

// ---- Frases ----
function validarFrase(datos, opciones) {
  const o = opciones || {};
  const errores = [];
  const err = (campo, t) => errores.push({ campo, texto: t });
  const libroId = String(datos.libroId || "").trim();
  if (!libroId || (o.libros && !o.libros.includes(libroId))) err("libroId", "Elige el libro.");
  const t = texto(datos.texto, 2000);
  if (!t) err("texto", "Escribe la frase.");
  const pagTxt = String(datos.pagina == null ? "" : datos.pagina).trim();
  let pagina = null;
  if (pagTxt) {
    pagina = Number(pagTxt);
    if (!(Number.isInteger(pagina) && pagina >= 1 && pagina <= 20000)) { err("pagina", "Revisa la página."); pagina = null; }
  }
  const fecha = String(datos.fecha || "").trim();
  if (!fechaOk(fecha)) err("fecha", "Pon la fecha.");
  else if (o.hoy && fecha > o.hoy) err("fecha", "La fecha no puede ser futura.");
  if (errores.length) return { ok: false, errores, doc: null };
  return { ok: true, errores: [], doc: { v: 1, libroId, texto: t, pagina, fecha } };
}
function normalizarFrase(id, d) {
  d = d || {};
  return { id, libroId: d.libroId || "", texto: d.texto ? String(d.texto) : "", pagina: Number.isInteger(d.pagina) ? d.pagina : null,
    fecha: fechaOk(d.fecha) ? d.fecha : "", creado: typeof d.creado === "number" ? d.creado : 0 };
}
const ordenarFrases = lista => lista.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado - a.creado) || String(b.id).localeCompare(String(a.id)));
// Buscar en el texto de la frase y en el título y autor de su libro.
function filtrarFrases(frases, libros, q) {
  const porId = {};
  libros.forEach(l => { porId[l.id] = l; });
  const palabras = normalizar(q).split(/\s+/).filter(Boolean);
  return frases.filter(f => {
    const l = porId[f.libroId];
    const donde = normalizar(`${f.texto} ${l ? `${l.titulo} ${l.autor}` : ""}`);
    return palabras.every(p => donde.includes(p));
  });
}
const frasesDe = (frases, libroId) => ordenarFrases(frases.filter(f => f.libroId === libroId));

// ---- Portadas (fase 4) ----
// a) Open Library (gratis, sin clave; verificado el 2026-10-29, D-050): se
//    busca por título y autor y se guarda solo la URL de la portada.
// b) Foto del iPhone: se achica y comprime en JPEG para que entre holgada
//    en un documento de Firestore (límite 1 MB), sin Firebase Storage.
const OL_BUSCAR = "https://openlibrary.org/search.json";
const urlPortadaOL = (id, tam) => `https://covers.openlibrary.org/b/id/${id}-${tam || "M"}.jpg`;
function urlBusqueda(titulo, autor) {
  const p = [["title", String(titulo || "").trim()]];
  if (String(autor || "").trim()) p.push(["author", String(autor).trim()]);
  p.push(["limit", "12"], ["fields", "key,title,author_name,cover_i,first_publish_year"]);
  return `${OL_BUSCAR}?${p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
// Respuesta de Open Library → hasta `max` portadas distintas.
function leerBusqueda(json, max) {
  const vistos = new Set(), out = [];
  ((json && json.docs) || []).forEach(d => {
    const id = d && Number(d.cover_i);
    if (!(id > 0) || vistos.has(id) || out.length >= (max || 6)) return;
    vistos.add(id);
    out.push({ titulo: String(d.title || ""), autor: Array.isArray(d.author_name) ? d.author_name.join(", ") : "", anio: d.first_publish_year || null,
      url: urlPortadaOL(id, "M"), urlChica: urlPortadaOL(id, "S") });
  });
  return out;
}
// Solo se muestran portadas de Open Library (nada de URLs arbitrarias).
const portadaUrlOk = u => /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/.test(String(u || ""));
// Achicar sin agrandar, manteniendo la proporción, dentro de maxAncho × maxAlto.
function medidasFoto(ancho, alto, maxAncho, maxAlto) {
  const mA = maxAncho || 400, mH = maxAlto || 600;
  const k = Math.min(1, mA / ancho, mH / alto);
  return { ancho: Math.max(1, Math.round(ancho * k)), alto: Math.max(1, Math.round(alto * k)) };
}
const CALIDADES = [0.72, 0.6, 0.5, 0.4];
const LIMITE_FOTO = 300000; // caracteres del data URL (≈ 220 KB): muy por debajo de 1 MB
const fotoOk = d => typeof d === "string" && d.startsWith("data:image/jpeg;base64,") && d.length <= LIMITE_FOTO;
const kb = d => Math.round(((String(d).length - 23) * 3) / 4 / 1024);
// Lo que se guarda en el libro según lo elegido. undefined = no cambiar.
function portadaParaGuardar(sel, ahora) {
  if (sel === undefined) return undefined;
  if (sel && sel.tipo === "url" && portadaUrlOk(sel.url)) return { tipo: "url", url: sel.url, fuente: "openlibrary" };
  if (sel && sel.tipo === "foto" && fotoOk(sel.datos)) return { tipo: "foto", actualizado: ahora };
  return null;
}

function exportarJson(libros, frases, ahora, portadas) {
  const lista = docs => Object.keys(docs).sort().map(id => Object.assign({ id }, docs[id]));
  return JSON.stringify({ app: "Manolo · Libros", version: 1, exportado: ahora, libros: lista(libros), frases: lista(frases),
    fotosDePortada: lista(portadas || {}).map(p => ({ libroId: p.id, datos: p.datos, ancho: p.ancho, alto: p.alto })) }, null, 2);
}

return {
  ESTADOS, ESTADO, ORDENES, normalizar, fechaOk, fechaLarga, estrellas,
  validarLibro, normalizarLibro, ordenar, filtrar, resumen, colorTapa,
  validarFrase, normalizarFrase, ordenarFrases, filtrarFrases, frasesDe, exportarJson,
  urlBusqueda, leerBusqueda, urlPortadaOL, portadaUrlOk, medidasFoto, CALIDADES, LIMITE_FOTO, fotoOk, kb, portadaParaGuardar
};
});
