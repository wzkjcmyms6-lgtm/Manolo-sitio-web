// ---------- Libros: estadísticas nuevas y "Tu año en libros" (fase 5e) ----------
// Tiempo leyendo (de las sesiones de "Leer ahora"), velocidad y su
// tendencia por mes, calendario de días leídos (páginas, % de audiolibro y
// minutos), autores y géneros, y el resumen del año. D-112.
// Sin DOM ni Firebase: tests/libros-estadisticas.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./libros-progreso.js"), require("./libros-sesiones.js"));
  else root.LibrosEstadisticas = factory(root.LibrosProgreso, root.LibrosSesiones);
})(typeof self !== "undefined" ? self : this, function (P, S) {
"use strict";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const r1 = n => Math.round(n * 10) / 10;
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "");
const diaSemana = f => (new Date(f + "T12:00:00Z").getUTCDay() + 6) % 7;   // 0 = lunes
const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();   // mes 1–12
const mesDe = f => f.slice(0, 7);
function mesMas(am, n) {
  const [a, m] = am.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const nombreMes = am => `${MESES[Number(am.slice(5, 7)) - 1]} ${am.slice(0, 4)}`;

// ---- Días leídos: páginas, % de audiolibro y minutos ----
function porDia(libros) {
  const out = {};
  const dia = f => (out[f] = out[f] || { paginas: 0, pct: 0, min: 0 });
  const pags = P.paginasPorDia(libros);
  Object.keys(pags).forEach(f => { dia(f).paginas = pags[f]; });
  (libros || []).forEach(l => {
    P.lecturasDe(l).forEach(x => {
      if (!P.esAudio(x)) return;
      const m = P.medida(x), e = P.entradas(x);
      let antes = m.valido(m.base) ? m.base : (e.length ? e[0][1] : 0);
      e.forEach(([f, v]) => { if (v > antes) dia(f).pct = r1(dia(f).pct + v - antes); antes = v; });
    });
    S.sesionesDe(l).forEach(s => { dia(s.fecha).min = r1(dia(s.fecha).min + s.min); });
  });
  return out;
}
const leido = d => !!d && (d.paginas > 0 || d.pct > 0 || d.min > 0);
// Qué tanto leíste ese día comparado con tu meta: 0 nada, 1 algo, 2 la
// mitad, 3 la meta, 4 el doble. Los minutos se comparan con el tiempo que
// te lleva la meta a tu velocidad (o 30 min si todavía no se sabe).
function nivel(d, metaDia, porHora) {
  if (!leido(d)) return 0;
  const meta = metaDia > 0 ? metaDia : 20;
  const metaMin = porHora ? Math.min(120, Math.max(10, (meta / porHora) * 60)) : 30;
  const x = Math.max(d.paginas / meta, d.min / metaMin, d.pct > 0 ? 0.25 : 0);
  return x >= 2 ? 4 : x >= 1 ? 3 : x >= 0.5 ? 2 : 1;
}

// ---- Calendario de un mes (semanas de lunes a domingo) ----
// → { mes: "2026-11", titulo, semanas: [[celda|null ×7]], leidos, dias, paginas, min, anterior, siguiente }
function calendario(libros, am, hoy, metaDia, dias) {
  const d = dias || porDia(libros);
  const porHora = S.general(libros).porHora;
  const [a, m] = am.split("-").map(Number);
  const n = diasDelMes(a, m), primero = `${am}-01`;
  const celdas = [];
  for (let i = 0; i < diaSemana(primero); i++) celdas.push(null);
  let leidos = 0, paginas = 0, min = 0, contados = 0;
  for (let k = 1; k <= n; k++) {
    const f = `${am}-${String(k).padStart(2, "0")}`, x = d[f] || { paginas: 0, pct: 0, min: 0 };
    const futuro = f > hoy;
    if (!futuro) contados++;
    if (leido(x)) { leidos++; paginas += x.paginas; min += x.min; }
    celdas.push({ fecha: f, dia: k, futuro, hoy: f === hoy, nivel: futuro ? 0 : nivel(x, metaDia, porHora), paginas: x.paginas, pct: x.pct, min: x.min });
  }
  while (celdas.length % 7) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return { mes: am, titulo: nombreMes(am), semanas, leidos, dias: contados, paginas, min: Math.round(min),
    anterior: mesMas(am, -1), siguiente: mesMas(am, 1) <= mesDe(hoy) ? mesMas(am, 1) : null };
}

// Qué leíste un día: [{ id, titulo, paginas, pct, min }].
function delDia(libros, fecha) {
  return (libros || []).map(l => {
    const x = porDia([l])[fecha];
    return leido(x) ? Object.assign({ id: l.id, titulo: l.titulo }, x) : null;
  }).filter(Boolean);
}

// ---- Tiempo leyendo (sesiones) ----
function sesiones(libros) {
  const out = [];
  (libros || []).forEach(l => S.sesionesDe(l).forEach(s => out.push(Object.assign({ libroId: l.id, titulo: l.titulo }, s))));
  return out;
}
// → { total, anio, mes, ult30, sesiones, promedioSesion, larga, semanas: [{ desde, min }], estimadoAnio }
function tiempo(libros, hoy, dias) {
  const ses = sesiones(libros);
  const anio = hoy.slice(0, 4), mes = mesDe(hoy), desde30 = P.sumarDias(hoy, -29);
  const suma = xs => Math.round(xs.reduce((s, x) => s + x.min, 0));
  // 12 semanas, la última es esta (de lunes a hoy).
  const lunes = P.sumarDias(hoy, -diaSemana(hoy));
  const semanas = [];
  for (let i = 11; i >= 0; i--) {
    const ini = P.sumarDias(lunes, -7 * i), fin = P.sumarDias(ini, 6);
    semanas.push({ desde: ini, min: suma(ses.filter(s => s.fecha >= ini && s.fecha <= fin)) });
  }
  const larga = ses.slice().sort((a, b) => b.min - a.min)[0] || null;
  // Días de este año con páginas anotadas pero sin cronómetro: tiempo
  // estimado con tu velocidad (si ya se sabe).
  const d = dias || porDia(libros);
  const porHora = S.general(libros).porHora;
  let sinReloj = 0;
  Object.keys(d).forEach(f => { if (f.startsWith(anio) && d[f].paginas > 0 && !(d[f].min > 0)) sinReloj += d[f].paginas; });
  return {
    total: suma(ses), anio: suma(ses.filter(s => s.fecha.startsWith(anio))), mes: suma(ses.filter(s => s.fecha.startsWith(mes))),
    ult30: suma(ses.filter(s => s.fecha >= desde30 && s.fecha <= hoy)), sesiones: ses.length,
    promedioSesion: ses.length ? Math.round(suma(ses) / ses.length) : null,
    larga: larga ? { min: Math.round(larga.min), titulo: larga.titulo, fecha: larga.fecha } : null,
    semanas,
    estimadoAnio: porHora && sinReloj ? Math.round((sinReloj / porHora) * 60) : 0
  };
}

// ---- Velocidad y su tendencia ----
// Páginas por hora de cada mes (los últimos `n`, con al menos 10 minutos de
// sesiones con páginas) y si vas más rápido que antes: los últimos 3 meses
// contra los 3 anteriores (con 30 minutos o más en cada lado).
function velocidad(libros, hoy, n) {
  const cuantos = n || 6;
  const ses = sesiones(libros).filter(s => s.unidad === "pag" && s.avance > 0);
  const de = xs => {
    const min = xs.reduce((s, x) => s + x.min, 0), pags = xs.reduce((s, x) => s + x.avance, 0);
    return { min: Math.round(min), paginas: Math.round(pags), porHora: min > 0 ? r1((pags / min) * 60) : null };
  };
  const ultimo = mesDe(hoy), meses = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const am = mesMas(ultimo, -i), v = de(ses.filter(s => mesDe(s.fecha) === am));
    meses.push({ mes: am, nombre: MESES[Number(am.slice(5, 7)) - 1], min: v.min, paginas: v.paginas, porHora: v.min >= 10 ? v.porHora : null });
  }
  const entre = (desde, hasta) => de(ses.filter(s => mesDe(s.fecha) >= desde && mesDe(s.fecha) <= hasta && s.fecha <= hoy));
  const recientes = entre(mesMas(ultimo, -2), ultimo), antes = entre(mesMas(ultimo, -5), mesMas(ultimo, -3));
  let tendencia = null;
  if (recientes.min >= 30 && antes.min >= 30 && antes.porHora) {
    const cambio = Math.round(((recientes.porHora - antes.porHora) / antes.porHora) * 100);
    tendencia = { cambio, sentido: cambio >= 5 ? "sube" : cambio <= -5 ? "baja" : "igual", ahora: recientes.porHora, antes: antes.porHora };
  }
  const total = de(ses);
  return { porHora: total.min >= 5 ? total.porHora : null, meses, tendencia };
}

// ---- Autores y géneros (libros terminados; de un año o de siempre) ----
function terminadosDe(libros, anio) {
  return P.terminaciones(libros).filter(t => !anio || (t.fechaFin || "").startsWith(String(anio)));
}
// libros: distintos (un releído cuenta una vez); paginas: todas las leídas.
function contar(ts, clave) {
  const c = {};
  ts.forEach(t => {
    const k = clave(t.libro);
    if (!k) return;
    c[k] = c[k] || { nombre: k, libros: 0, paginas: 0, ids: {} };
    if (!c[k].ids[t.id]) { c[k].ids[t.id] = true; c[k].libros++; }
    c[k].paginas += t.paginas || 0;
  });
  return Object.values(c).map(x => ({ nombre: x.nombre, libros: x.libros, paginas: x.paginas }))
    .sort((a, b) => b.libros - a.libros || b.paginas - a.paginas || a.nombre.localeCompare(b.nombre, "es"));
}
const autores = (libros, anio) => contar(terminadosDe(libros, anio), l => String(l.autor || "").trim());
const generos = (libros, anio) => contar(terminadosDe(libros, anio), l => l.genero || "");

// ---- Tu año en libros ----
// El resumen aparece del 15 de diciembre al 31 de enero (el del año que se
// cierra); en Estadísticas se puede ver cualquier año con libros.
function anioParaMostrar(hoy) {
  const m = hoy.slice(5, 10), a = Number(hoy.slice(0, 4));
  if (m >= "12-15") return a;
  if (m <= "01-31") return a - 1;
  return null;
}
function aniosConLibros(libros) {
  return Array.from(new Set(terminadosDe(libros).map(t => (t.fechaFin || "").slice(0, 4)).filter(a => /^\d{4}$/.test(a)))).sort().map(Number);
}
function mejorRacha(dias, anio) {
  let mejor = 0, seguidos = 0, previa = null;
  Object.keys(dias).filter(f => f.startsWith(String(anio)) && leido(dias[f])).sort().forEach(f => {
    seguidos = previa && P.diasEntre(previa, f) === 1 ? seguidos + 1 : 1;
    mejor = Math.max(mejor, seguidos);
    previa = f;
  });
  return mejor;
}
function anio(libros, frases, anioN, dias) {
  const a = String(anioN);
  const d = dias || porDia(libros);
  const ts = terminadosDe(libros, a).sort((x, y) => (x.fechaFin || "").localeCompare(y.fechaFin || ""));
  const lista = ts.map(t => {
    const ini = fechaOk(t.fechaInicio) && t.fechaInicio <= t.fechaFin ? t.fechaInicio : null;
    return { id: t.id, titulo: t.libro.titulo, autor: t.libro.autor || "", calificacion: t.libro.calificacion || null, paginas: t.paginas,
      fechaFin: t.fechaFin, dias: ini ? P.diasEntre(ini, t.fechaFin) + 1 : null, formato: t.libro.formato || "papel", relectura: t.n > 1, genero: t.libro.genero || null };
  });
  // Páginas: las anotadas día a día + los terminados sin avance anotado.
  let paginas = Object.keys(d).filter(f => f.startsWith(a)).reduce((s, f) => s + d[f].paginas, 0);
  ts.forEach(t => { if (t.sinProgreso && t.paginas && !P.esAudio(t.libro)) paginas += t.paginas; });
  const minutos = Math.round(sesiones(libros).filter(s => s.fecha.startsWith(a)).reduce((s, x) => s + x.min, 0));
  const conPaginas = lista.filter(x => x.paginas && x.formato !== "audio");
  const masLargo = conPaginas.slice().sort((x, y) => y.paginas - x.paginas)[0] || null;
  const masCorto = conPaginas.length > 1 ? conPaginas.slice().sort((x, y) => x.paginas - y.paginas)[0] : null;
  const masRapido = lista.filter(x => x.dias).sort((x, y) => x.dias - y.dias || (y.paginas || 0) - (x.paginas || 0))[0] || null;
  const porMes = MESES.map((nombre, i) => ({ nombre, libros: lista.filter(x => Number(x.fechaFin.slice(5, 7)) === i + 1).length }));
  const mesTop = porMes.reduce((m, x) => (x.libros > m.libros ? x : m), { nombre: null, libros: 0 });
  // Tus 5 estrellas (un libro releído, una vez).
  const mejores = lista.filter(x => x.calificacion === 5).reverse().filter((x, i, xs) => xs.findIndex(y => y.id === x.id) === i).reverse();
  // La frase del año: tu favorita más reciente (o la última que guardaste).
  const fr = (frases || []).filter(f => (f.fecha || "").startsWith(a)).sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""));
  const fav = fr.find(f => f.fav) || fr[0] || null;
  const autor = autores(libros, a)[0] || null, genero = generos(libros, a)[0] || null;
  const abandonados = (libros || []).filter(l => l.estado === "abandonado" && (l.fechaDejado || "").startsWith(a)).length;
  const antes = terminadosDe(libros, String(Number(a) - 1)).length;
  return {
    anio: Number(a), hayDatos: lista.length > 0 || paginas > 0 || minutos > 0,
    terminados: lista.length, paginas, minutos,
    diasLeidos: Object.keys(d).filter(f => f.startsWith(a) && leido(d[f])).length,
    mejorRacha: mejorRacha(d, a),
    libros: lista,
    masLargo, masCorto, masRapido,
    mejores,
    mesTop: mesTop.libros >= 2 ? mesTop : null,
    autorTop: autor && autor.libros >= 2 ? autor : null,
    generoTop: genero,
    audiolibros: lista.filter(x => x.formato === "audio").length,
    relecturas: lista.filter(x => x.relectura).length,
    abandonados,
    frases: fr.length,
    fraseFav: fav ? { texto: fav.texto, libroId: fav.libroId || null } : null,
    anterior: antes ? { anio: Number(a) - 1, terminados: antes } : null
  };
}

const duracion = min => {
  const m = Math.max(0, Math.round(min || 0));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
};

return { MESES, porDia, leido, nivel, delDia, calendario, tiempo, velocidad, autores, generos, anio, anioParaMostrar, aniosConLibros, duracion, mesMas, nombreMes };
});
