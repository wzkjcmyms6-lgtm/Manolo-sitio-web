// ---------- Resúmenes: "Tu año en Manolo" (sin pantalla) ----------
// D-139 (fase 3; diseño en docs/RESUMENES.md). Con los mismos datos que "Tu
// semana" (js/resumen-fuentes.js) arma el contenido de las diapositivas del
// año: cada sección (cifras, récords, el mejor mes), el año en números, tu
// mejor mes y tu día de la semana, la comparación con el año anterior (a la
// misma altura si el año no terminó) y lo destacado para compartir.
// Usa, si están, el "Wrapped" de Hábitos y "Tu año en libros" que ya
// calculan esas secciones (d.extras). Sin DOM: tests/resumen-anio.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./resumen-motor.js"));
  else root.ResumenAnio = factory(root.ResumenMotor);
})(typeof self !== "undefined" ? self : this, function (R) {
"use strict";

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pad = n => String(n).padStart(2, "0");
const CAPITULOS_BIBLIA = 1189;
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
// Mejores marcas de Running que se muestran (clave guardada → nombre).
const MARCAS = [["1000", "1 km"], ["5000", "5K"], ["10000", "10K"], ["21097", "Media maratón"], ["42195", "Maratón"]];
const diaSemana = f => new Date(Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)))).getUTCDay();
const finDeMes = (a, m) => `${a}-${pad(m)}-${pad(new Date(Date.UTC(a, m, 0)).getUTCDate())}`;
const en = (xs, desde, hasta) => (xs || []).filter(x => x && R.fechaOk(x.fecha) && x.fecha >= desde && x.fecha <= hasta);

// Equivalencias para que los km se sientan (distancias por carretera, aprox.).
const LUGARES_KM = [[230, "de La Paz a Oruro"], [380, "de La Paz a Cochabamba"], [870, "de La Paz a Santa Cruz"]];
// En bici, también lugares más cerca (las maratones son de correr).
const LUGARES_BICI_KM = [[70, "de La Paz a Tiwanaku"], [95, "de La Paz a Coroico"], [150, "de La Paz a Copacabana"]];
function equivalencia(km, verbo) {
  const bici = verbo === "en bici";
  const lugar = (bici ? LUGARES_BICI_KM.concat(LUGARES_KM) : LUGARES_KM).filter(([k]) => km >= k).pop();
  if (lugar) return `Como ir ${verbo} ${lugar[1]}${km >= lugar[0] * 1.8 ? ` y volver${km >= lugar[0] * 3.6 ? " (más de una vez)" : ""}` : ""}.`;
  if (!bici && km >= 42.195) return `Equivale a ${R.dec1(km / 42.195)} maratones.`;
  return "";
}

// Años con algo que mostrar (del más nuevo al más viejo).
function aniosConDatos(d) {
  const x = d || {};
  const anios = new Set();
  const poner = f => { if (R.fechaOk(f)) anios.add(Number(f.slice(0, 4))); };
  ["running", "bici", "gimnasio", "movilidad", "manana"].forEach(k => (x[k] || []).forEach(e => poner(e.fecha)));
  if (x.habitos) Object.keys(x.habitos.dias || {}).forEach(f => { if (num(x.habitos.dias[f].h) > 0) poner(f); });
  if (x.libros) { Object.keys(x.libros.dias || {}).forEach(poner); (x.libros.terminados || []).forEach(t => poner(t.fecha)); }
  if (x.biblia) (x.biblia.caps || []).concat(x.biblia.vers || []).forEach(e => poner(e.fecha));
  if (x.finanzas) (x.finanzas.movs || []).forEach(e => poner(e.fecha));
  if (x.lugares) x.lugares.forEach(l => (l.visitas || []).forEach(poner));
  if (x.ropa) { (x.ropa.usos || []).forEach(u => { if ((u.prendas || []).length) poner(u.fecha); }); (x.ropa.prendas || []).forEach(p => poner(p.compra)); }
  return Array.from(anios).sort((a, b) => b - a);
}

// El mes con más de algo: [{ mes (1–12), valor }] → { mes, nombre, valor } o null.
function mejorMes(meses, fn, minimo) {
  let mejor = null;
  meses.forEach(m => { const v = fn(m.p); if (v > (minimo || 0) && (!mejor || v > mejor.valor)) mejor = { mes: m.mes, nombre: R.MESES_LARGOS[m.mes - 1], valor: v }; });
  return mejor;
}

function anio(d, anioN) {
  const x = d || {};
  const hoy = R.fechaOk(x.hoy) ? x.hoy : new Date().toISOString().slice(0, 10);
  const a = Number(anioN) || Number(hoy.slice(0, 4));
  const desde = `${a}-01-01`, fin = `${a}-12-31`;
  const hasta = fin < hoy ? fin : hoy;
  if (hasta < desde) return null;
  const completo = hasta === fin;
  const p = R.periodo(x, desde, hasta);
  // El año anterior, a la misma altura (si este todavía no terminó).
  const ant = R.periodo(x, `${a - 1}-01-01`, `${a - 1}-${hasta.slice(5)}`);
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const ini = `${a}-${pad(m)}-01`;
    if (ini > hasta) break;
    const f = finDeMes(a, m);
    meses.push({ mes: m, p: R.periodo(x, ini, f < hasta ? f : hasta) });
  }
  const extras = x.extras || {};
  const out = { anio: a, desde, hasta, completo, dias: R.diasEntre(desde, hasta) + 1, diasActivos: p.diasActivos, secciones: {} };
  const S = out.secciones;

  // ---- Hábitos (el Wrapped de Hábitos, si está) ----
  if (p.habitos && p.habitos.e > 0) {
    const w = extras.habitos || null;
    const lista = (x.habitos && x.habitos.lista) || [];
    const nombre = id => { const h = lista.find(y => y.id === id); return h ? { nombre: h.nombre, emoji: h.emoji } : null; };
    const porMes = meses.map(m => ({ mes: m.mes, pct: m.p.habitos ? m.p.habitos.pct : null }));
    const mm = porMes.filter(m => m.pct != null).reduce((b, m) => (!b || m.pct > b.pct ? m : b), null);
    const top = p.habitos.porHabito.filter(h => h.e >= 14).sort((m, n) => n.h - m.h)[0] || null;
    S.habitos = {
      pct: w && w.cumplimiento != null ? w.cumplimiento : p.habitos.pct,
      cumplidos: w ? w.registros : p.habitos.h,
      perfectos: w ? w.perfectos : p.habitos.perfectos,
      porMes,
      mejorMes: mm ? { mes: mm.mes, nombre: R.MESES_LARGOS[mm.mes - 1], pct: mm.pct } : null,
      estrella: w && w.estrella ? Object.assign({ veces: w.estrella.veces }, nombre(w.estrella.id)) : top ? { nombre: top.nombre, emoji: top.emoji, veces: top.h } : null,
      racha: w && w.racha ? Object.assign({ n: w.racha.n, unidad: w.racha.unidad }, nombre(w.racha.id)) : null,
      conWrapped: !!w
    };
  }

  // ---- Gimnasio ----
  if (p.gimnasio && p.gimnasio.n) {
    const ses = en(x.gimnasio, desde, hasta);
    const veces = {};
    ses.forEach(w => (w.ejercicios || []).forEach(n => { const k = String(n).trim(); if (k) veces[k] = (veces[k] || 0) + 1; }));
    const ej = Object.keys(veces).sort((m, n) => veces[n] - veces[m] || m.localeCompare(n))[0];
    const grande = ses.reduce((m, w) => (num(w.volumen) > num(m && m.volumen) ? w : m), null);
    S.gimnasio = {
      n: p.gimnasio.n, horas: p.gimnasio.min / 60, series: p.gimnasio.series, volumen: p.gimnasio.volumen, records: p.gimnasio.records,
      ejercicioTop: ej ? { nombre: ej, veces: veces[ej] } : null,
      mayorVolumen: grande && grande.volumen > 0 ? { fecha: grande.fecha, nombre: grande.nombre, volumen: grande.volumen } : null,
      mejorMes: mejorMes(meses, q => (q.gimnasio ? q.gimnasio.n : 0)),
      porMes: meses.map(m => ({ mes: m.mes, valor: m.p.gimnasio ? m.p.gimnasio.n : 0 }))
    };
  }

  // ---- Running y Bici ----
  [["running", "corriendo"], ["bici", "en bici"]].forEach(([k, verbo]) => {
    if (!(p[k] && p[k].n)) return;
    const acts = en(x[k], desde, hasta);
    const marcas = k === "running" ? MARCAS.map(([clave, nombre]) => {
      const mejor = acts.filter(e => e.mejores && e.mejores[clave] > 0).reduce((m, e) => (!m || e.mejores[clave] < m.t ? { t: e.mejores[clave], fecha: e.fecha } : m), null);
      return mejor ? Object.assign({ clave, nombre }, mejor) : null;
    }).filter(Boolean) : [];
    S[k] = {
      n: p[k].n, km: p[k].km, horas: p[k].min / 60, desnivel: p[k].desnivel,
      larga: p[k].larga ? { km: p[k].larga.km, fecha: p[k].larga.fecha, titulo: p[k].larga.titulo || "" } : null,
      records: p[k].records.length, marcas,
      mejorMes: mejorMes(meses, q => (q[k] ? q[k].km : 0), 0.05),
      porMes: meses.map(m => ({ mes: m.mes, valor: m.p[k] ? m.p[k].km : 0 })),
      equivalencia: equivalencia(p[k].km, verbo === "corriendo" ? "corriendo" : "en bici")
    };
  });

  if (p.movilidad && p.movilidad.n) S.movilidad = { n: p.movilidad.n, min: p.movilidad.min, mejorMes: mejorMes(meses, q => (q.movilidad ? q.movilidad.n : 0)) };

  // ---- Libros ("Tu año en libros", si está) ----
  if (p.libros && (p.libros.paginas > 0 || p.libros.terminados.length)) {
    const la = extras.libros || null;
    const ts = p.libros.terminados.slice().sort((m, n) => m.fecha.localeCompare(n.fecha));
    const cinco = ts.filter(t => t.calificacion === 5);
    const delAnio = cinco.length ? cinco[cinco.length - 1] : ts.slice().sort((m, n) => num(n.calificacion) - num(m.calificacion))[0] || null;
    S.libros = {
      terminados: la ? la.terminados : ts.length,
      paginas: la ? la.paginas : p.libros.paginas,
      dias: la ? la.diasLeidos : p.libros.dias,
      libroDelAnio: delAnio ? { titulo: delAnio.titulo, autor: delAnio.autor || "", calificacion: delAnio.calificacion || null } : null,
      cincoEstrellas: cinco.length,
      autorTop: la && la.autorTop ? { nombre: la.autorTop.nombre || la.autorTop.autor || "", libros: la.autorTop.libros } : null,
      masLargo: la && la.masLargo ? { titulo: la.masLargo.titulo, paginas: la.masLargo.paginas } : null,
      frase: la && la.fraseFav && la.fraseFav.texto ? { texto: la.fraseFav.texto, libro: la.fraseFav.libro || "" } : null,
      mejorMes: mejorMes(meses, q => (q.libros ? q.libros.terminados.length : 0))
    };
  }

  // ---- Biblia ----
  if (p.biblia && p.biblia.dias) {
    const caps = en(x.biblia.caps, desde, hasta);
    const unicos = new Set(caps.map(c => c.clave));
    const porLibro = {};
    caps.forEach(c => { const l = String(c.clave).split(".")[0]; porLibro[l] = (porLibro[l] || 0) + 1; });
    const top = Object.keys(porLibro).sort((m, n) => porLibro[n] - porLibro[m])[0];
    const nombres = x.biblia.nombres || {};
    // La mejor racha del año: días seguidos con lectura.
    const dias = Array.from(new Set(caps.map(c => c.fecha).concat(en(x.biblia.vers, desde, hasta).map(v => v.fecha)))).sort();
    let racha = 0, seguidos = 0, previa = null;
    dias.forEach(f => { seguidos = previa && R.diasEntre(previa, f) === 1 ? seguidos + 1 : 1; racha = Math.max(racha, seguidos); previa = f; });
    S.biblia = {
      dias: p.biblia.dias, capitulos: caps.length, unicos: unicos.size, pctBiblia: unicos.size / CAPITULOS_BIBLIA,
      versiculos: p.biblia.vers, mejorRacha: racha,
      libroTop: top ? { id: top, nombre: nombres[top] || top, capitulos: porLibro[top] } : null,
      mejorMes: mejorMes(meses, q => (q.biblia ? q.biblia.dias : 0))
    };
  }

  // ---- Finanzas (no se comparte en montos) ----
  if (p.finanzas && p.finanzas.n) {
    const fz = p.finanzas;
    const ahorroMes = meses.map(m => ({ mes: m.mes, valor: m.p.finanzas ? m.p.finanzas.ingreso - m.p.finanzas.gasto : 0, ingreso: m.p.finanzas ? m.p.finanzas.ingreso : 0 }));
    const mejor = ahorroMes.filter(m => m.ingreso > 0).reduce((b, m) => (!b || m.valor > b.valor ? m : b), null);
    const primero = en(x.finanzas.movs, desde, hasta).map(m => m.fecha).sort()[0];
    const conGasto = new Set(en(x.finanzas.movs, desde, hasta).filter(m => m.tipo === "gasto").map(m => m.fecha));
    const diasCubiertos = primero ? R.diasEntre(primero, hasta) + 1 : 0;
    S.finanzas = {
      ingreso: fz.ingreso, gasto: fz.gasto, ahorro: fz.ingreso - fz.gasto,
      pctAhorro: fz.ingreso > 0 ? (fz.ingreso - fz.gasto) / fz.ingreso : null,
      mejorMesAhorro: mejor && mejor.valor > 0 ? { mes: mejor.mes, nombre: R.MESES_LARGOS[mejor.mes - 1], cent: mejor.valor } : null,
      catTop: fz.porCat[0] ? { nombre: fz.porCat[0].nombre, cent: fz.porCat[0].cent, pct: fz.gasto ? fz.porCat[0].cent / fz.gasto : 0 } : null,
      diasSinGasto: Math.max(0, diasCubiertos - conGasto.size)
    };
  }

  // ---- Mi mañana: cuánto mejoraste (primer mes medido contra el último) ----
  if (p.manana && p.manana.n) {
    const conDatos = meses.filter(m => m.p.manana && m.p.manana.n >= 3);
    const mejora = conDatos.length >= 2 ? { desde: conDatos[0].p.manana.promedio, hasta: conDatos[conDatos.length - 1].p.manana.promedio,
      mesDesde: R.MESES_LARGOS[conDatos[0].mes - 1], mesHasta: R.MESES_LARGOS[conDatos[conDatos.length - 1].mes - 1] } : null;
    S.manana = { n: p.manana.n, promedio: p.manana.promedio, mejor: p.manana.mejor, mejora };
  }

  // ---- Lugares ----
  if (p.lugares && p.lugares.visitas) {
    const zonas = {};
    (x.lugares || []).forEach(l => { const n = (l.visitas || []).filter(f => f >= desde && f <= hasta).length; if (n && l.zona) zonas[l.zona] = (zonas[l.zona] || 0) + n; });
    const zona = Object.keys(zonas).sort((m, n) => zonas[n] - zonas[m])[0];
    const mejor = p.lugares.nuevos.filter(l => l.calificacion).sort((m, n) => n.calificacion - m.calificacion || m.fecha.localeCompare(n.fecha))[0];
    S.lugares = { visitas: p.lugares.visitas, nuevos: p.lugares.nuevos.length, mejor: mejor || null, zonaTop: zona ? { nombre: zona, visitas: zonas[zona] } : null };
  }

  // ---- Ropa (D-151): tu prenda del año, tu color y lo que compraste ----
  if (p.ropa && (p.ropa.dias || p.ropa.compras)) {
    S.ropa = { dias: p.ropa.dias, distintas: p.ropa.distintas, top: p.ropa.top, color: p.ropa.color, compras: p.ropa.compras,
      mejorMes: mejorMes(meses, q => (q.ropa ? q.ropa.dias : 0)) };
  }

  // ---- El año en números ----
  const nums = [];
  nums.push({ valor: R.miles(p.diasActivos), etiqueta: p.diasActivos === 1 ? "día con algo anotado" : "días con algo anotado" });
  if (S.habitos) nums.push({ valor: R.miles(S.habitos.cumplidos), etiqueta: S.habitos.cumplidos === 1 ? "hábito cumplido" : "hábitos cumplidos" });
  if (S.gimnasio) nums.push({ valor: R.miles(S.gimnasio.n), etiqueta: S.gimnasio.n === 1 ? "entreno" : "entrenos" });
  if (S.running) nums.push({ valor: R.dec1(S.running.km), etiqueta: "km corriendo" });
  if (S.bici) nums.push({ valor: R.dec1(S.bici.km), etiqueta: "km en bici" });
  if (S.libros) nums.push({ valor: R.miles(S.libros.terminados), etiqueta: S.libros.terminados === 1 ? "libro terminado" : "libros terminados" });
  if (S.biblia) nums.push({ valor: R.miles(S.biblia.capitulos), etiqueta: S.biblia.capitulos === 1 ? "capítulo de la Biblia" : "capítulos de la Biblia" });
  if (S.movilidad) nums.push({ valor: R.miles(S.movilidad.n), etiqueta: S.movilidad.n === 1 ? "rutina de movilidad" : "rutinas de movilidad" });
  if (S.ropa && S.ropa.dias) nums.push({ valor: R.miles(S.ropa.dias), etiqueta: S.ropa.dias === 1 ? "día con tu ropa anotada" : "días con tu ropa anotada" });
  out.numeros = nums;

  // ---- Tu mejor mes (más días con algo) y tu día de la semana ----
  const activos = meses.map(m => ({ mes: m.mes, p: { dias: m.p.diasActivos } }));
  out.mejorMes = mejorMes(activos, q => q.dias);
  const porDia = [0, 0, 0, 0, 0, 0, 0];
  R.diasActivos(x, desde, hasta).forEach(f => { porDia[diaSemana(f)]++; });
  const top = porDia.indexOf(Math.max(...porDia));
  out.diaSemana = Math.max(...porDia) > 0 ? { dia: top, nombre: DIAS_LARGOS[top], plural: DIAS_PLURAL[top], n: porDia[top] } : null;

  // ---- Contra el año anterior (a la misma altura) ----
  const vs = [];
  const comparar = (cond, actual, antes, texto) => { if (cond && antes > 0 && actual !== antes) vs.push({ texto: texto(actual - antes), signo: actual > antes ? 1 : -1 }); };
  const signo = v => (v > 0 ? "+" : "−");
  comparar(S.running && ant.running, S.running && S.running.km, ant.running && ant.running.km, v => `${signo(v)}${R.dec1(Math.abs(v))} km corriendo`);
  comparar(S.bici && ant.bici, S.bici && S.bici.km, ant.bici && ant.bici.km, v => `${signo(v)}${R.dec1(Math.abs(v))} km en bici`);
  comparar(S.gimnasio && ant.gimnasio, S.gimnasio && S.gimnasio.n, ant.gimnasio && ant.gimnasio.n, v => `${signo(v)}${R.plural(Math.abs(v), "entreno", "entrenos")}`);
  comparar(S.libros && ant.libros, S.libros && p.libros.terminados.length, ant.libros && ant.libros.terminados.length, v => `${signo(v)}${R.plural(Math.abs(v), "libro", "libros")}`);
  comparar(S.biblia && ant.biblia, S.biblia && S.biblia.capitulos, ant.biblia && ant.biblia.caps, v => `${signo(v)}${R.plural(Math.abs(v), "capítulo", "capítulos")} de la Biblia`);
  if (S.habitos && ant.habitos && ant.habitos.pct != null && S.habitos.pct != null) {
    const dif = Math.round(S.habitos.pct * 100) - Math.round(ant.habitos.pct * 100);
    if (dif) vs.push({ texto: `${signo(dif)}${Math.abs(dif)} pts en hábitos`, signo: dif > 0 ? 1 : -1 });
  }
  out.vsAnterior = { anio: a - 1, lista: vs };

  // ---- Lo destacado (para la imagen final, sin dinero) ----
  const dest = [];
  if (S.running) dest.push({ icono: "🏃", texto: `${R.km(S.running.km)} corriendo` });
  if (S.gimnasio) dest.push({ icono: "🏋️", texto: R.plural(S.gimnasio.n, "entreno", "entrenos") });
  if (S.bici) dest.push({ icono: "🚴", texto: `${R.km(S.bici.km)} en bici` });
  if (S.libros && S.libros.terminados) dest.push({ icono: "📚", texto: R.plural(S.libros.terminados, "libro", "libros") });
  if (S.biblia) dest.push({ icono: "📖", texto: R.plural(S.biblia.capitulos, "capítulo de la Biblia", "capítulos de la Biblia") });
  if (S.habitos && S.habitos.pct != null) dest.push({ icono: "✅", texto: `${R.pct(S.habitos.pct)} de tus hábitos` });
  if (S.movilidad) dest.push({ icono: "🧘", texto: R.plural(S.movilidad.n, "rutina de movilidad", "rutinas de movilidad") });
  if (S.ropa && S.ropa.top && S.ropa.top.veces >= 2) dest.push({ icono: "👕", texto: `Tu prenda del año: ${S.ropa.top.nombre}` });
  out.destacados = dest.slice(0, 6);
  out.hayDatos = Object.keys(S).length > 0;
  return out;
}


// ---- Las diapositivas (fase 4, D-140) ----
// y: resultado de anio(). → [{ id, tema ("fuego" | "oscuro" | "oro"),
// eyebrow, grande?, titulo?, lineas: [texto], barras?: [{ etiqueta, valor (0–1), texto }],
// numeros?: [{ valor, etiqueta }], lista?: [{ texto, signo }], frase?: { texto, de },
// privado? (Finanzas: no entra en la imagen del año), habitos? (botón al Wrapped de Hábitos) }]
const INICIAL = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const estrellas = n => "★".repeat(Math.max(0, Math.round(num(n))));
function fechaCorta(f) { return `${Number(f.slice(8, 10))} de ${R.MESES_LARGOS[Number(f.slice(5, 7)) - 1]}`; }
function barrasDe(porMes, fmt) {
  const max = Math.max(0, ...porMes.map(m => num(m.valor)));
  return porMes.map(m => ({ etiqueta: INICIAL[m.mes - 1], valor: max > 0 ? num(m.valor) / max : 0, texto: `${R.MESES_LARGOS[m.mes - 1]}: ${fmt(m.valor)}` }));
}
function diapositivas(y) {
  if (!y) return [];
  const S = y.secciones, out = [];
  const pon = d => out.push(Object.assign({ lineas: [] }, d));
  pon({ id: "portada", tema: "fuego", eyebrow: "Manolo", titulo: `Tu ${y.anio} en Manolo`,
    lineas: [y.completo ? "Un año entero, en un resumen." : `Lo que va del año, hasta el ${fechaCorta(y.hasta)}.`,
      y.diasActivos ? `Anotaste algo en ${R.plural(y.diasActivos, "día", "días")}.` : "Todavía no anotaste nada este año."], pista: true });
  if (!y.hayDatos) {
    pon({ id: "cierre", tema: "oro", eyebrow: String(y.anio), titulo: "Este año todavía está en blanco", lineas: ["Anota un entreno, una lectura o un hábito y este resumen empezará a llenarse."], cierre: true });
    return out;
  }
  if (y.numeros.length > 1) pon({ id: "numeros", tema: "oscuro", eyebrow: "Tu año en números", numeros: y.numeros.slice(0, 8) });
  if (S.habitos) {
    const h = S.habitos, l = [];
    if (h.mejorMes) l.push(`Tu mejor mes fue ${h.mejorMes.nombre}, con el ${R.pct(h.mejorMes.pct)}.`);
    if (h.estrella) l.push(`Tu hábito estrella: ${h.estrella.emoji ? `${h.estrella.emoji} ` : ""}${h.estrella.nombre} (${R.plural(h.estrella.veces, "vez", "veces")}).`);
    if (h.racha && h.racha.n >= 3) l.push(`Tu mejor racha: ${R.plural(h.racha.n, h.racha.unidad === "semanas" ? "semana seguida" : "día seguido", h.racha.unidad === "semanas" ? "semanas seguidas" : "días seguidos")}${h.racha.nombre ? ` con ${h.racha.nombre}` : ""}.`);
    if (h.perfectos) l.push(`${R.plural(h.perfectos, "día perfecto", "días perfectos")}, sin dejar nada pendiente.`);
    pon({ id: "habitos", tema: "fuego", eyebrow: "Hábitos", grande: h.pct != null ? R.pct(h.pct) : R.miles(h.cumplidos), titulo: h.pct != null ? "de lo que te propusiste" : "hábitos cumplidos",
      barras: barrasDe(h.porMes.map(m => ({ mes: m.mes, valor: m.pct || 0 })), v => R.pct(v)), lineas: l, habitos: true });
  }
  if (S.gimnasio) {
    const g = S.gimnasio, l = [`${R.dec1(g.horas)} horas · ${R.plural(g.series, "serie", "series")}${g.volumen ? ` · ${R.miles(g.volumen)} kg movidos` : ""}.`];
    if (g.records) l.push(`${R.plural(g.records, "récord nuevo", "récords nuevos")}.`);
    if (g.ejercicioTop) l.push(`Tu ejercicio del año: ${g.ejercicioTop.nombre}, ${R.plural(g.ejercicioTop.veces, "vez", "veces")}.`);
    if (g.mejorMes) l.push(`Tu mejor mes: ${g.mejorMes.nombre}, con ${R.plural(g.mejorMes.valor, "entreno", "entrenos")}.`);
    pon({ id: "gimnasio", tema: "oscuro", eyebrow: "Gimnasio", grande: R.miles(g.n), titulo: g.n === 1 ? "entreno" : "entrenos", barras: barrasDe(g.porMes, v => R.plural(v, "entreno", "entrenos")), lineas: l });
  }
  [["running", "Running", "km corriendo", "carrera", "carreras", "fuego"], ["bici", "Bici", "km en bici", "rodada", "rodadas", "oro"]].forEach(([k, nombre, unidad, uno, varios, tema]) => {
    const a = S[k];
    if (!a) return;
    const l = [`${R.plural(a.n, uno, varios)} · ${R.dec1(a.horas)} horas${a.desnivel >= 1 ? ` · ${R.miles(a.desnivel)} m de desnivel` : ""}.`];
    if (a.larga) l.push(`La más larga: ${R.km(a.larga.km)}, el ${fechaCorta(a.larga.fecha)}.`);
    if (a.marcas && a.marcas.length) l.push(`Tus mejores marcas: ${a.marcas.map(m => `${m.nombre} ${R.mmss(m.t)}`).join(" · ")}.`);
    if (a.equivalencia) l.push(a.equivalencia);
    pon({ id: k, tema, eyebrow: nombre, grande: R.dec1(a.km), titulo: unidad, barras: barrasDe(a.porMes, v => R.km(v)), lineas: l });
  });
  if (S.movilidad) {
    const m = S.movilidad;
    pon({ id: "movilidad", tema: "oscuro", eyebrow: "Movilidad", grande: R.miles(m.n), titulo: m.n === 1 ? "rutina de movilidad" : "rutinas de movilidad",
      lineas: [`${R.duracion(m.min)} soltando el cuerpo.`].concat(m.mejorMes ? [`Tu mejor mes: ${m.mejorMes.nombre}.`] : []) });
  }
  if (S.libros) {
    const b = S.libros, l = [];
    if (b.paginas) l.push(`${R.plural(b.paginas, "página", "páginas")}${b.dias ? ` en ${R.plural(b.dias, "día", "días")} de lectura` : ""}.`);
    if (b.libroDelAnio) l.push(`Tu libro del año: «${b.libroDelAnio.titulo}»${b.libroDelAnio.autor ? `, de ${b.libroDelAnio.autor}` : ""}${b.libroDelAnio.calificacion ? ` ${estrellas(b.libroDelAnio.calificacion)}` : ""}.`);
    if (b.autorTop && b.autorTop.nombre) l.push(`Tu autor del año: ${b.autorTop.nombre} (${R.plural(b.autorTop.libros, "libro", "libros")}).`);
    if (b.masLargo) l.push(`El más largo: «${b.masLargo.titulo}» (${R.plural(b.masLargo.paginas, "página", "páginas")}).`);
    pon({ id: "libros", tema: "oro", eyebrow: "Libros", grande: R.miles(b.terminados), titulo: b.terminados === 1 ? "libro terminado" : "libros terminados", lineas: l,
      frase: b.frase ? { texto: b.frase.texto, de: b.frase.libro || "" } : null });
  }
  if (S.biblia) {
    const b = S.biblia, l = [];
    if (b.unicos) l.push(`${R.plural(b.unicos, "capítulo distinto", "capítulos distintos")}: el ${b.pctBiblia >= 0.1 ? Math.round(b.pctBiblia * 100) : R.dec1(b.pctBiblia * 100)} % de la Biblia.`);
    l.push(`${R.plural(b.dias, "día", "días")} con lectura${b.mejorRacha >= 3 ? `; tu mejor racha, ${R.plural(b.mejorRacha, "día seguido", "días seguidos")}` : ""}.`);
    if (b.libroTop) l.push(`El libro que más leíste: ${b.libroTop.nombre} (${R.plural(b.libroTop.capitulos, "capítulo", "capítulos")}).`);
    if (b.versiculos) l.push(`${R.plural(b.versiculos, "versículo guardado", "versículos guardados")}.`);
    pon({ id: "biblia", tema: "oscuro", eyebrow: "Biblia", grande: R.miles(b.capitulos), titulo: b.capitulos === 1 ? "capítulo leído" : "capítulos leídos", lineas: l });
  }
  if (S.finanzas) {
    const f = S.finanzas, l = [];
    const ahorro = f.pctAhorro != null && f.pctAhorro > 0;
    if (f.mejorMesAhorro) l.push(`El mes que más ahorraste: ${f.mejorMesAhorro.nombre}.`);
    if (f.catTop) l.push(`En qué se fue más: ${f.catTop.nombre} (el ${R.pct(f.catTop.pct)} de tus gastos).`);
    if (f.diasSinGasto) l.push(`${R.plural(f.diasSinGasto, "día sin gastar", "días sin gastar")}.`);
    pon({ id: "finanzas", tema: "fuego", eyebrow: "Finanzas", privado: true,
      grande: f.pctAhorro != null ? R.pct(Math.max(0, f.pctAhorro)) : null,
      titulo: f.pctAhorro == null ? "Tus gastos del año" : ahorro ? "de lo que ganaste, lo ahorraste" : "Este año gastaste todo lo que ganaste",
      lineas: l });
  }
  if (S.manana) {
    const m = S.manana, l = [`${R.plural(m.n, "mañana medida", "mañanas medidas")}.`];
    if (m.mejora && m.mejora.hasta < m.mejora.desde - 60) l.push(`Bajó de ${R.duracion(m.mejora.desde / 60)} en ${m.mejora.mesDesde} a ${R.duracion(m.mejora.hasta / 60)} en ${m.mejora.mesHasta}.`);
    if (m.mejor) l.push(`La más rápida: ${R.duracion(m.mejor.seg / 60)}, el ${fechaCorta(m.mejor.fecha)}.`);
    pon({ id: "manana", tema: "fuego", eyebrow: "Mi mañana", grande: R.duracion(m.promedio / 60), titulo: "de promedio", lineas: l });
  }
  if (S.lugares) {
    const g = S.lugares, l = [`${R.plural(g.visitas, "visita", "visitas")} en el año.`];
    if (g.mejor) l.push(`El mejor: ${g.mejor.nombre}${g.mejor.calificacion ? ` ${estrellas(g.mejor.calificacion)}` : ""}.`);
    if (g.zonaTop) l.push(`Tu zona: ${g.zonaTop.nombre}.`);
    pon({ id: "lugares", tema: "oro", eyebrow: "Lugares", grande: R.miles(g.nuevos), titulo: g.nuevos === 1 ? "lugar nuevo" : "lugares nuevos", lineas: l });
  }
  if (S.ropa) {
    // Tu prenda del año; si no hay una (2 veces o más), los días anotados o
    // lo que compraste. Sin plata: la imagen se comparte.
    const r = S.ropa, l = [];
    const top = r.top && r.top.veces >= 2 ? r.top : null;
    const distintas = R.plural(r.distintas, "prenda distinta", "prendas distintas");
    let grande, titulo;
    if (top) {
      grande = R.miles(top.veces);
      titulo = `veces te pusiste «${top.nombre}»`;
      l.push("Tu prenda del año.");
      l.push(`Anotaste lo que te pusiste ${R.plural(r.dias, "día", "días")}, con ${distintas}.`);
    } else if (r.dias) {
      grande = R.miles(r.dias);
      titulo = r.dias === 1 ? "día con tu ropa anotada" : "días con tu ropa anotada";
      l.push(`Con ${distintas}.`);
    } else {
      grande = R.miles(r.compras);
      titulo = r.compras === 1 ? "prenda comprada" : "prendas compradas";
    }
    if (r.color) l.push(`Tu color del año: ${r.color.toLowerCase()}.`);
    if (r.compras && (top || r.dias)) l.push(`Compraste ${R.plural(r.compras, "prenda", "prendas")}.`);
    pon({ id: "ropa", tema: "fuego", eyebrow: "Ropa", grande, titulo, lineas: l });
  }
  if (y.mejorMes || y.diaSemana) {
    const l = [];
    if (y.mejorMes) l.push(`Anotaste algo en ${R.plural(y.mejorMes.valor, "día", "días")} de ${y.mejorMes.nombre}.`);
    if (y.diaSemana) l.push(`Los ${y.diaSemana.plural} fueron tu día más activo.`);
    pon({ id: "ritmo", tema: "oscuro", eyebrow: "Tu ritmo", titulo: y.mejorMes ? `Tu mejor mes fue ${y.mejorMes.nombre}` : "Tu ritmo", lineas: l });
  }
  if (y.vsAnterior && y.vsAnterior.lista.length) {
    pon({ id: "contra", tema: "fuego", eyebrow: `Contra ${y.vsAnterior.anio}`, titulo: y.completo ? "Así te fue contra el año pasado" : "Contra el año pasado, a esta altura",
      lista: y.vsAnterior.lista.slice(0, 6) });
  }
  pon({ id: "cierre", tema: "oro", eyebrow: String(y.anio), titulo: y.completo ? "Gracias por un año más" : "Y el año todavía no termina",
    lineas: [y.completo ? `Lo que repites se vuelve parte de ti. Nos vemos en ${y.anio + 1}.` : "Cada cosa que anotes suma a este resumen."], cierre: true });
  return out;
}

return { MARCAS, CAPITULOS_BIBLIA, aniosConDatos, anio, equivalencia, mejorMes, diapositivas };
});
