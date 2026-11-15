// ---------- Libros: progreso de lectura, metas y estadísticas ----------
// "Voy en la página N" se guarda en el libro como progreso { "AAAA-MM-DD": página }
// (la última página de cada día) y paginaActual. Con eso se calculan las
// páginas leídas por día (la meta diaria, la racha), el ritmo de cada libro
// y cuándo lo terminarías, el reto de libros del año y las estadísticas.
// paginaBase: la página en la que ibas cuando empezaste a anotar un libro
// que ya estabas leyendo (esas páginas no cuentan como leídas ese día).
// Pedido del dueño 2026-10-29 ("más desarrollada y más inteligente").
// Fase 4 (D-107): el audiolibro avanza en % (progresoPct, pctActual,
// pctBase; con su duración también se anota por tiempo); "Leer de nuevo"
// guarda la lectura anterior en lecturas.N (las estadísticas cuentan
// todas); Abandonado y Retomar.
// Sin DOM ni Firebase: tests/libros-progreso.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LibrosProgreso = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const DIA = 86400000;
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(new Date(f + "T12:00:00Z").getTime());
const utc = f => new Date(f + "T12:00:00Z");
const sumarDias = (f, n) => { const d = utc(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / DIA);
const entero = n => Number.isInteger(n) && n >= 0;
const pctOk = n => typeof n === "number" && isFinite(n) && n >= 0 && n <= 100;
const r1 = n => Math.round(n * 10) / 10;

// ---- Cómo se mide el avance ----
// Papel o digital: páginas. Audiolibro: % (0 a 100, con un decimal).
const esAudio = l => !!l && l.formato === "audio";
const duracionDe = l => (l && Number.isInteger(l.duracionMin) && l.duracionMin > 0 ? l.duracionMin : null);
function medida(l) {
  const x = l || {};
  if (esAudio(x)) {
    return { unidad: "pct", total: 100, actual: pctOk(x.pctActual) ? x.pctActual : null, base: x.pctBase, progreso: x.progresoPct, valido: pctOk,
      campos: ["pctActual", "pctBase", "progresoPct"] };
  }
  return { unidad: "pag", total: Number.isInteger(x.paginas) && x.paginas > 0 ? x.paginas : null, actual: entero(x.paginaActual) ? x.paginaActual : null,
    base: x.paginaBase, progreso: x.progreso, valido: entero, campos: ["paginaActual", "paginaBase", "progreso"] };
}

// Progreso guardado → [[fecha, valor]] ordenado (ignora lo inválido).
function entradas(libro) {
  const m = medida(libro);
  const p = m.progreso;
  if (!p || typeof p !== "object") return [];
  return Object.keys(p).filter(f => fechaOk(f) && m.valido(p[f])).sort().map(f => [f, p[f]]);
}
const base = (libro, e) => { const m = medida(libro); return m.valido(m.base) ? m.base : (e.length ? e[0][1] : 0); };

// Avance de hoy (la página, o el % de un audiolibro) → { ok, error, cambios, terminado }.
// cambios: campos a escribir en el libro (todo aditivo).
function registrarAvance(libro, valor, hoy) {
  const m = medida(libro);
  const audio = m.unidad === "pct";
  const v = audio ? r1(Number(valor)) : Number(valor);
  if (valor === "" || valor == null || !m.valido(v)) return { ok: false, error: audio ? "Pon el % que llevas (de 0 a 100)." : "Escribe el número de la página." };
  if (!audio && m.total && v > m.total) return { ok: false, error: `El libro tiene ${m.total} páginas.` };
  const [cActual, cBase, cProg] = m.campos;
  const e = entradas(libro);
  const cambios = {};
  if (!e.length) {
    // Primera vez: si ya lo venías leyendo desde antes de hoy, lo que llevas
    // no cuenta como leído hoy; si lo empiezas ahora, cuenta desde 0.
    const yaLeyendo = libro.estado !== "por_leer" && libro.fechaInicio !== hoy;
    cambios[cBase] = yaLeyendo ? (m.actual != null ? Math.min(m.actual, v) : v) : 0;
  }
  const progreso = {};
  e.forEach(([f, p]) => { progreso[f] = p; });
  progreso[hoy] = v;
  cambios[cProg] = progreso;
  cambios[cActual] = v;
  // Anotar avance en uno por leer o abandonado: lo estás leyendo.
  if (libro.estado === "por_leer" || libro.estado === "abandonado") cambios.estado = "leyendo";
  if (!libro.fechaInicio) cambios.fechaInicio = hoy;
  const terminado = !!m.total && v >= m.total && libro.estado !== "terminado";
  if (terminado) { cambios.estado = "terminado"; cambios.fechaFin = hoy; }
  return { ok: true, error: "", cambios, terminado };
}
// "Voy en la página N" hoy (papel o digital).
function registrarPagina(libro, paginaTxt, hoy) {
  const txt = String(paginaTxt == null ? "" : paginaTxt).trim();
  const pagina = Number(txt);
  if (!txt || !Number.isInteger(pagina) || pagina < 0) return { ok: false, error: "Escribe el número de la página." };
  return registrarAvance(libro, pagina, hoy);
}

// ---- Escribir y mostrar el avance ----
// 200 → "3:20" (horas:minutos).
const hm = min => { const m = Math.max(0, Math.round(min)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
// Lo que escribiste en "¿Por dónde vas?" → { ok, valor (en la unidad del libro), error }.
// Papel o digital: la página. Audiolibro: el % ("45" o "45 %") o, si tiene
// su duración, el tiempo escuchado ("3:20").
function leerAvance(libro, txt) {
  const t = String(txt == null ? "" : txt).trim().replace(",", ".");
  if (!esAudio(libro)) {
    const n = Number(t);
    return t && Number.isInteger(n) && n >= 0 ? { ok: true, valor: n } : { ok: false, error: "Escribe el número de la página." };
  }
  const dur = duracionDe(libro);
  const tiempo = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  if (tiempo) {
    if (!dur) return { ok: false, error: "Escribe el % (o pon la duración del audiolibro en Editar)." };
    const min = Number(tiempo[1]) * 60 + Number(tiempo[2]);
    if (min > dur) return { ok: false, error: `El audiolibro dura ${hm(dur)}.` };
    return { ok: true, valor: r1((min / dur) * 100) };
  }
  const n = Number(t.replace(/\s*%$/, ""));
  return t && isFinite(n) && n >= 0 && n <= 100 ? { ok: true, valor: r1(n) }
    : { ok: false, error: dur ? "Escribe el tiempo (3:20) o el % (45)." : "Escribe el % que llevas (de 0 a 100)." };
}
// El avance de ahora, como se escribe: "142", "3:20" o "45".
function avanceTexto(libro) {
  const m = medida(libro);
  if (m.actual == null) return "";
  if (m.unidad === "pag") return String(m.actual);
  const dur = duracionDe(libro);
  return dur ? hm((m.actual / 100) * dur) : String(m.actual);
}
// Los botones de sumar: páginas (+10, +20, +30) o audio (+15 min, +30 min,
// +1 h; sin duración, +5 %, +10 %, +25 %). → [{ paso, texto }]
function pasos(libro) {
  if (!esAudio(libro)) return [10, 20, 30].map(n => ({ paso: n, texto: `+${n}` }));
  if (duracionDe(libro)) return [[15, "+15 min"], [30, "+30 min"], [60, "+1 h"]].map(([paso, texto]) => ({ paso, texto }));
  return [5, 10, 25].map(n => ({ paso: n, texto: `+${n} %` }));
}
// Sumar un paso a lo escrito (o a lo que llevabas). paso = "fin" → el final.
function sumarAvance(libro, txt, paso) {
  const m = medida(libro);
  const dur = esAudio(libro) ? duracionDe(libro) : null;
  if (paso === "fin") return m.unidad === "pag" ? String(m.total || "") : (dur ? hm(dur) : "100");
  const leido = leerAvance(libro, txt);
  if (m.unidad === "pag") {
    const ahora = leido.ok ? leido.valor : (m.actual || 0);
    return String(m.total ? Math.min(m.total, ahora + paso) : ahora + paso);
  }
  const pct = leido.ok ? leido.valor : (m.actual || 0);
  if (dur) return hm(Math.min(dur, Math.round((pct / 100) * dur) + paso));
  return String(Math.min(100, r1(pct + paso)));
}

// ---- Lecturas (releer sin perder la anterior) ----
// [lecturas anteriores (lecturas: { "1": {…} }) …, la de ahora]. Cada una
// con su estado, fechas, formato y avance.
function lecturasDe(libro) {
  const l = libro || {};
  const guardadas = l.lecturas && typeof l.lecturas === "object" ? l.lecturas : {};
  const ant = Object.keys(guardadas).filter(k => /^\d+$/.test(k) && guardadas[k] && typeof guardadas[k] === "object")
    .sort((a, b) => Number(a) - Number(b))
    .map(k => Object.assign({ formato: l.formato, paginas: l.paginas }, guardadas[k], { n: Number(k), actual: false }));
  return ant.concat([Object.assign({}, l, { n: ant.length + 1, actual: true })]);
}
// "Leer de nuevo": la lectura de ahora queda guardada en lecturas.N y empieza
// otra desde el principio. Nada se pierde. → cambios para update().
function nuevaLectura(libro, hoy, ahora) {
  const n = lecturasDe(libro).length;
  const guardar = { estado: libro.estado, fechaInicio: libro.fechaInicio || null, fechaFin: libro.fechaFin || null, formato: libro.formato || "papel",
    paginas: Number.isInteger(libro.paginas) ? libro.paginas : null, calificacion: libro.calificacion || null, cerrada: ahora || 0 };
  ["fechaDejado", "duracionMin", "paginaActual", "paginaBase", "progreso", "pctActual", "pctBase", "progresoPct"].forEach(k => { if (libro[k] != null) guardar[k] = libro[k]; });
  return { [`lecturas.${n}`]: guardar, estado: "leyendo", fechaInicio: hoy, fechaFin: null, fechaDejado: null,
    paginaActual: 0, paginaBase: 0, progreso: {}, pctActual: 0, pctBase: 0, progresoPct: {} };
}
// Dejarlo (Abandonado) o retomarlo donde quedaste.
const abandonar = hoy => ({ estado: "abandonado", fechaDejado: hoy });
const retomar = () => ({ estado: "leyendo" });

// Páginas leídas cada día, sumando todos los libros (y todas sus lecturas):
// { fecha: páginas }. El audiolibro no suma páginas (se mide en minutos).
function paginasPorDia(libros) {
  const out = {};
  (libros || []).forEach(l => lecturasDe(l).forEach(x => {
    if (esAudio(x)) return;
    const e = entradas(x);
    let antes = base(x, e);
    e.forEach(([f, p]) => {
      const d = p - antes;
      if (d > 0) out[f] = (out[f] || 0) + d;
      antes = p;
    });
  }));
  return out;
}

// Cada vez que terminaste un libro (también las lecturas anteriores).
function terminaciones(libros) {
  const out = [];
  (libros || []).forEach(l => lecturasDe(l).forEach(x => {
    if (x.estado !== "terminado") return;
    out.push({ id: l.id, libro: l, n: x.n, fechaInicio: x.fechaInicio || null, fechaFin: x.fechaFin || null,
      paginas: Number.isInteger(x.paginas) ? x.paginas : (Number.isInteger(l.paginas) ? l.paginas : null), sinProgreso: !entradas(x).length });
  }));
  return out;
}

// Días seguidos leyendo (hasta hoy, o hasta ayer si hoy todavía no leíste) y la mejor racha.
function racha(porDia, hoy) {
  let f = porDia[hoy] > 0 ? hoy : sumarDias(hoy, -1), actual = 0;
  while (porDia[f] > 0) { actual++; f = sumarDias(f, -1); }
  let mejor = 0, seguidos = 0, previa = null;
  Object.keys(porDia).filter(x => porDia[x] > 0).sort().forEach(x => {
    seguidos = previa && diasEntre(previa, x) === 1 ? seguidos + 1 : 1;
    mejor = Math.max(mejor, seguidos);
    previa = x;
  });
  return { actual, mejor, hoyLeiste: porDia[hoy] > 0 };
}

// Cómo vas con un libro: página (o %), lo que falta, tu ritmo y cuándo lo terminarías.
function lectura(libro, hoy, metaDiaria) {
  const m = medida(libro);
  const total = m.total;
  const e = entradas(libro);
  let pagina = m.actual;
  if (libro.estado === "terminado" && total) pagina = total;
  if (total && pagina != null) pagina = Math.min(pagina, total);
  const out = { unidad: m.unidad, pagina, total, pct: null, faltan: null, ritmo: null, finRitmo: null, diasRitmo: null, finMeta: null, diasMeta: null, faltaAudioMin: null };
  if (total && pagina != null) { out.pct = Math.round((pagina / total) * 100); out.faltan = r1(total - pagina); }
  // Ritmo: lo leído desde que empezaste (a leerlo o a anotarlo) / días.
  if (e.length && pagina != null) {
    const b = base(libro, e);
    const desde = b === 0 && libro.fechaInicio && libro.fechaInicio <= e[0][0] ? libro.fechaInicio : e[0][0];
    const dias = diasEntre(desde, hoy) + 1;
    const leidas = pagina - b;
    if (leidas > 0 && dias >= 2) out.ritmo = r1(leidas / dias);
  }
  if (out.faltan > 0 && libro.estado !== "terminado") {
    if (out.ritmo) { out.diasRitmo = Math.ceil(out.faltan / out.ritmo); out.finRitmo = sumarDias(hoy, out.diasRitmo); }
    // La meta diaria es en páginas: no sirve para un audiolibro.
    if (metaDiaria > 0 && m.unidad === "pag") { out.diasMeta = Math.ceil(out.faltan / metaDiaria); out.finMeta = sumarDias(hoy, out.diasMeta); }
    if (m.unidad === "pct" && duracionDe(libro)) out.faltaAudioMin = Math.round((out.faltan / 100) * duracionDe(libro));
  }
  return out;
}

// Reto del año: libros terminados (cada lectura cuenta) contra la meta y si vas al día.
function reto(libros, meta, hoy) {
  const anio = hoy.slice(0, 4);
  const terminados = terminaciones(libros).filter(t => (t.fechaFin || "").startsWith(anio)).length;
  const out = { anio, terminados, meta: entero(meta) ? meta : 0, pct: 0, esperado: 0, estado: "sin-meta", diferencia: 0, faltan: 0 };
  if (!out.meta) return out;
  const diasAnio = diasEntre(`${anio}-01-01`, `${Number(anio) + 1}-01-01`);
  const avance = (diasEntre(`${anio}-01-01`, hoy) + 1) / diasAnio;
  out.esperado = Math.round(out.meta * avance * 10) / 10;
  out.pct = Math.min(100, Math.round((terminados / out.meta) * 100));
  out.faltan = Math.max(0, out.meta - terminados);
  out.diferencia = Math.floor(terminados - out.esperado + 0.5);
  out.estado = terminados >= out.meta ? "cumplido" : out.diferencia > 0 ? "adelantado" : out.diferencia < 0 ? "atrasado" : "al-dia";
  return out;
}

// Los últimos n días (para el gráfico), del más viejo a hoy.
function ultimosDias(porDia, hoy, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const f = sumarDias(hoy, -i); out.push({ fecha: f, paginas: porDia[f] || 0 }); }
  return out;
}

// Números del año (y algunos de siempre).
function estadisticas(libros, hoy) {
  const anio = hoy.slice(0, 4);
  const lista = libros || [];
  const porDia = paginasPorDia(lista);
  const veces = terminaciones(lista);
  // Libros terminados alguna vez (sin repetir los que releíste).
  const terminados = lista.filter(l => veces.some(t => t.id === l.id));
  const delAnio = veces.filter(t => (t.fechaFin || "").startsWith(anio));
  const porMes = MESES_CORTOS.map((nombre, i) => ({ mes: i + 1, nombre, libros: delAnio.filter(t => Number(t.fechaFin.slice(5, 7)) === i + 1).length }));
  // Páginas del año: las anotadas día a día + los terminados este año sin progreso anotado.
  let paginasAnio = Object.keys(porDia).filter(f => f.startsWith(anio)).reduce((s, f) => s + porDia[f], 0);
  delAnio.forEach(t => { if (t.sinProgreso && t.paginas) paginasAnio += t.paginas; });
  const ult30 = ultimosDias(porDia, hoy, 30).reduce((s, d) => s + d.paginas, 0);
  const calificados = terminados.filter(l => l.calificacion);
  const contar = (arr, clave) => {
    const c = {};
    arr.forEach(l => { const k = clave(l); if (k) c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).map(k => ({ nombre: k, n: c[k] })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
  };
  const autores = contar(terminados, l => (l.autor || "").trim());
  const duraciones = veces.filter(t => fechaOk(t.fechaInicio) && fechaOk(t.fechaFin) && t.fechaFin >= t.fechaInicio).map(t => diasEntre(t.fechaInicio, t.fechaFin) + 1);
  const largo = terminados.filter(l => l.paginas).sort((a, b) => b.paginas - a.paginas)[0] || null;
  return {
    anio, porMes,
    terminadosAnio: delAnio.length,
    paginasAnio,
    diasLeyendoAnio: Object.keys(porDia).filter(f => f.startsWith(anio) && porDia[f] > 0).length,
    promedioDia30: Math.round(ult30 / 30),
    calificacionMedia: calificados.length ? Math.round((calificados.reduce((s, l) => s + l.calificacion, 0) / calificados.length) * 10) / 10 : null,
    autorTop: autores[0] && autores[0].n >= 2 ? autores[0] : null,
    generos: contar(terminados, l => l.genero || ""),
    diasPorLibro: duraciones.length ? Math.round(duraciones.reduce((s, d) => s + d, 0) / duraciones.length) : null,
    masLargo: largo ? { id: largo.id, titulo: largo.titulo, paginas: largo.paginas } : null
  };
}

// Al marcar un libro como terminado desde el formulario: si venías anotando
// el avance, el último queda como el final (sin inventar días de lectura viejos).
function alTerminar(libro, fechaFin) {
  const m = medida(libro);
  const e = entradas(libro);
  if (!e.length || !m.total || !fechaOk(fechaFin) || fechaFin < e[e.length - 1][0]) return {};
  const [cActual, , cProg] = m.campos;
  const progreso = {};
  e.forEach(([f, p]) => { progreso[f] = p; });
  progreso[fechaFin] = Math.max(progreso[fechaFin] || 0, m.total);
  return { [cProg]: progreso, [cActual]: m.total };
}

// Formulario de metas → { ok, errores, metaPaginasDia, reto }.
function validarMetas(datos) {
  const errores = [];
  const dia = Number(String(datos.metaPaginasDia == null ? "" : datos.metaPaginasDia).trim());
  if (!Number.isInteger(dia) || dia < 1 || dia > 1000) errores.push({ campo: "metaPaginasDia", texto: "Pon cuántas páginas quieres leer por día (de 1 a 1000)." });
  const txt = String(datos.reto == null ? "" : datos.reto).trim();
  const reto = txt ? Number(txt) : 0;
  if (!Number.isInteger(reto) || reto < 0 || reto > 365) errores.push({ campo: "reto", texto: "El reto va de 1 a 365 libros (o déjalo vacío)." });
  return { ok: !errores.length, errores, metaPaginasDia: dia, reto };
}

function fechaCorta(f) {
  if (!fechaOk(f)) return "";
  return `${Number(f.slice(8, 10))} ${MESES_CORTOS[Number(f.slice(5, 7)) - 1]}`;
}

return { medida, esAudio, duracionDe, entradas, registrarAvance, registrarPagina, leerAvance, avanceTexto, pasos, sumarAvance, hm,
  lecturasDe, nuevaLectura, abandonar, retomar, terminaciones,
  paginasPorDia, racha, lectura, reto, ultimosDias, estadisticas, alTerminar, validarMetas, sumarDias, diasEntre, fechaCorta, MESES_CORTOS };
});
