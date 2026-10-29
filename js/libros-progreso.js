// ---------- Libros: progreso de lectura, metas y estadísticas ----------
// "Voy en la página N" se guarda en el libro como progreso { "AAAA-MM-DD": página }
// (la última página de cada día) y paginaActual. Con eso se calculan las
// páginas leídas por día (la meta diaria, la racha), el ritmo de cada libro
// y cuándo lo terminarías, el reto de libros del año y las estadísticas.
// paginaBase: la página en la que ibas cuando empezaste a anotar un libro
// que ya estabas leyendo (esas páginas no cuentan como leídas ese día).
// Pedido del dueño 2026-10-29 ("más desarrollada y más inteligente").
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

// Progreso guardado → [[fecha, página]] ordenado (ignora lo inválido).
function entradas(libro) {
  const p = libro && libro.progreso;
  if (!p || typeof p !== "object") return [];
  return Object.keys(p).filter(f => fechaOk(f) && entero(p[f])).sort().map(f => [f, p[f]]);
}
const base = (libro, e) => (entero(libro.paginaBase) ? libro.paginaBase : (e.length ? e[0][1] : 0));

// "Voy en la página N" hoy → { ok, error, cambios, terminado }.
// cambios: campos a escribir en el libro (todo aditivo).
function registrarPagina(libro, paginaTxt, hoy) {
  const txt = String(paginaTxt == null ? "" : paginaTxt).trim();
  const pagina = Number(txt);
  if (!txt || !Number.isInteger(pagina) || pagina < 0) return { ok: false, error: "Escribe el número de la página." };
  if (libro.paginas && pagina > libro.paginas) return { ok: false, error: `El libro tiene ${libro.paginas} páginas.` };
  const e = entradas(libro);
  const cambios = {};
  if (!e.length) {
    // Primera vez: si ya lo venías leyendo desde antes de hoy, lo que llevas
    // no cuenta como leído hoy; si lo empiezas ahora, cuenta desde la 0.
    const yaLeyendo = libro.estado !== "por_leer" && libro.fechaInicio !== hoy;
    cambios.paginaBase = yaLeyendo ? (entero(libro.paginaActual) ? Math.min(libro.paginaActual, pagina) : pagina) : 0;
  }
  const progreso = {};
  e.forEach(([f, p]) => { progreso[f] = p; });
  progreso[hoy] = pagina;
  cambios.progreso = progreso;
  cambios.paginaActual = pagina;
  if (libro.estado === "por_leer") cambios.estado = "leyendo";
  if (!libro.fechaInicio) cambios.fechaInicio = hoy;
  const terminado = !!libro.paginas && pagina >= libro.paginas && libro.estado !== "terminado";
  if (terminado) { cambios.estado = "terminado"; cambios.fechaFin = hoy; }
  return { ok: true, error: "", cambios, terminado };
}

// Páginas leídas cada día, sumando todos los libros: { fecha: páginas }.
function paginasPorDia(libros) {
  const out = {};
  (libros || []).forEach(l => {
    const e = entradas(l);
    let antes = base(l, e);
    e.forEach(([f, p]) => {
      const d = p - antes;
      if (d > 0) out[f] = (out[f] || 0) + d;
      antes = p;
    });
  });
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

// Cómo vas con un libro: página, %, lo que falta, tu ritmo y cuándo lo terminarías.
function lectura(libro, hoy, metaDiaria) {
  const total = Number.isInteger(libro.paginas) && libro.paginas > 0 ? libro.paginas : null;
  const e = entradas(libro);
  let pagina = entero(libro.paginaActual) ? libro.paginaActual : null;
  if (libro.estado === "terminado" && total) pagina = total;
  if (total && pagina != null) pagina = Math.min(pagina, total);
  const out = { pagina, total, pct: null, faltan: null, ritmo: null, finRitmo: null, diasRitmo: null, finMeta: null, diasMeta: null };
  if (total && pagina != null) { out.pct = Math.round((pagina / total) * 100); out.faltan = total - pagina; }
  // Ritmo: páginas leídas desde que empezaste (a leerlo o a anotarlo) / días.
  if (e.length && pagina != null) {
    const b = base(libro, e);
    const desde = b === 0 && libro.fechaInicio && libro.fechaInicio <= e[0][0] ? libro.fechaInicio : e[0][0];
    const dias = diasEntre(desde, hoy) + 1;
    const leidas = pagina - b;
    if (leidas > 0 && dias >= 2) out.ritmo = Math.round((leidas / dias) * 10) / 10;
  }
  if (out.faltan > 0 && libro.estado !== "terminado") {
    if (out.ritmo) { out.diasRitmo = Math.ceil(out.faltan / out.ritmo); out.finRitmo = sumarDias(hoy, out.diasRitmo); }
    if (metaDiaria > 0) { out.diasMeta = Math.ceil(out.faltan / metaDiaria); out.finMeta = sumarDias(hoy, out.diasMeta); }
  }
  return out;
}

// Reto del año: libros terminados contra la meta y si vas al día.
function reto(libros, meta, hoy) {
  const anio = hoy.slice(0, 4);
  const terminados = (libros || []).filter(l => l.estado === "terminado" && (l.fechaFin || "").startsWith(anio)).length;
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
  const terminados = lista.filter(l => l.estado === "terminado");
  const delAnio = terminados.filter(l => (l.fechaFin || "").startsWith(anio));
  const porMes = MESES_CORTOS.map((nombre, i) => ({ mes: i + 1, nombre, libros: delAnio.filter(l => Number(l.fechaFin.slice(5, 7)) === i + 1).length }));
  // Páginas del año: las anotadas día a día + los terminados este año sin progreso anotado.
  let paginasAnio = Object.keys(porDia).filter(f => f.startsWith(anio)).reduce((s, f) => s + porDia[f], 0);
  delAnio.forEach(l => { if (!entradas(l).length && l.paginas) paginasAnio += l.paginas; });
  const ult30 = ultimosDias(porDia, hoy, 30).reduce((s, d) => s + d.paginas, 0);
  const calificados = terminados.filter(l => l.calificacion);
  const contar = (arr, clave) => {
    const c = {};
    arr.forEach(l => { const k = clave(l); if (k) c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).map(k => ({ nombre: k, n: c[k] })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
  };
  const autores = contar(terminados, l => (l.autor || "").trim());
  const duraciones = terminados.filter(l => fechaOk(l.fechaInicio) && fechaOk(l.fechaFin) && l.fechaFin >= l.fechaInicio).map(l => diasEntre(l.fechaInicio, l.fechaFin) + 1);
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
// páginas, la última queda como la final (sin inventar días de lectura viejos).
function alTerminar(libro, fechaFin) {
  const e = entradas(libro);
  if (!e.length || !libro.paginas || !fechaOk(fechaFin) || fechaFin < e[e.length - 1][0]) return {};
  const progreso = {};
  e.forEach(([f, p]) => { progreso[f] = p; });
  progreso[fechaFin] = Math.max(progreso[fechaFin] || 0, libro.paginas);
  return { progreso, paginaActual: libro.paginas };
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

return { entradas, registrarPagina, paginasPorDia, racha, lectura, reto, ultimosDias, estadisticas, alTerminar, validarMetas, sumarDias, diasEntre, fechaCorta, MESES_CORTOS };
});
