// ---------- Resúmenes: "Tu semana" y "Tu año" (sin pantalla) ----------
// D-136 (diseño en docs/RESUMENES.md). Con los datos de todas las secciones
// ya normalizados (los junta js/resumen-fuentes.js de lo que cada sección
// tiene en memoria) arma las cifras de cualquier período y la semana:
// por área contra la semana anterior y tu promedio de 4 semanas, lo mejor,
// lo que se quedó atrás y una sugerencia. Sin IA: reglas simples.
// Sin DOM ni Firebase: tests/resumen-motor.test.js.
//
// d = {
//   hoy: "AAAA-MM-DD",
//   running, bici: [{ id, fecha, km, min, desnivel, titulo, records: [{ nombre, t, puesto: 1 }] }],
//   gimnasio: [{ fecha, nombre, min, series, volumen (kg), records (n) }],
//   movilidad: [{ fecha, min, nombre }],
//   habitos: { dias: { f: { h, e } }, perfectos: [f],
//              lista: [{ id, nombre, emoji, dias: { f: 1 | 0 } } o, si es "X veces por semana", { …, semanas: { lunes: { h, e } } }] },
//   libros: { dias: { f: páginas }, terminados: [{ titulo, autor, fecha, calificacion, paginas }] },
//   biblia: { caps: [{ fecha, clave: "John.3" }], vers: [{ fecha, cita }] },
//   finanzas: { movs: [{ fecha, tipo: "gasto" | "ingreso", cent, cat }], cats: { id: nombre } },
//   manana: [{ fecha, seg }]   (Mi mañana: el total de cada día),
//   lugares: [{ id, nombre, calificacion, zona, visitas: [fecha] }],
//   ropa: { usos: [{ fecha, prendas: [ids] }], prendas: [{ id, nombre, color
//           (la familia de su color, en palabras), compra (fecha), precio }] } (D-151)
// }
// Cada sección puede faltar (null): no cargó o no la usas.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResumenMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// ---- Fechas (AAAA-MM-DD locales, sin husos) ----
const DIA_MS = 86400000;
const pad = n => String(n).padStart(2, "0");
const aFecha = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const ms = f => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const sumar = (f, n) => aFecha(ms(f) + n * DIA_MS);
const diasEntre = (a, b) => Math.round((ms(b) - ms(a)) / DIA_MS);
const lunesDe = f => sumar(f, -((new Date(ms(f)).getUTCDay() + 6) % 7));
const dentro = (f, desde, hasta) => fechaOk(f) && f >= desde && f <= hasta;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// "10 – 16 nov", "28 oct – 3 nov", "29 dic 2025 – 4 ene 2026" (si cambia el año).
function rango(desde, hasta) {
  const d1 = Number(desde.slice(8, 10)), m1 = Number(desde.slice(5, 7)) - 1, d2 = Number(hasta.slice(8, 10)), m2 = Number(hasta.slice(5, 7)) - 1;
  if (desde.slice(0, 4) !== hasta.slice(0, 4)) return `${d1} ${MESES[m1]} ${desde.slice(0, 4)} – ${d2} ${MESES[m2]} ${hasta.slice(0, 4)}`;
  return m1 === m2 ? `${d1} – ${d2} ${MESES[m2]}` : `${d1} ${MESES[m1]} – ${d2} ${MESES[m2]}`;
}

// ---- Números en español ----
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
function miles(n) {
  const s = String(Math.round(Math.abs(num(n))));
  return (n < 0 ? "-" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function dec1(n) {
  const v = Math.round(num(n) * 10) / 10;
  const [e, d] = String(Math.abs(v)).split(".");
  return `${v < 0 ? "-" : ""}${miles(Number(e))}${d ? `,${d}` : ""}`;
}
const km = n => `${dec1(n)} km`;
const pct = f => `${Math.round(num(f) * 100)} %`;
const bs = cent => `Bs ${miles(Math.round(num(cent) / 100))}`;
function duracion(min) {
  const m = Math.round(num(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}:${pad(m % 60)} h`;
}
function mmss(seg) {
  const s = Math.round(num(seg));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
}
const plural = (n, uno, varios) => `${miles(n)} ${Math.round(n) === 1 ? uno : varios}`;
const lista = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

// ---- Cifras de un período (cualquier sección) ----
const en = (xs, desde, hasta) => (xs || []).filter(x => x && dentro(x.fecha, desde, hasta));
function actividades(xs, desde, hasta) {
  const ds = en(xs, desde, hasta);
  const larga = ds.reduce((m, x) => (num(x.km) > num(m && m.km) ? x : m), null);
  const records = [];
  ds.forEach(x => (x.records || []).forEach(r => records.push(Object.assign({ fecha: x.fecha }, r))));
  return { n: ds.length, km: ds.reduce((s, x) => s + num(x.km), 0), min: ds.reduce((s, x) => s + num(x.min), 0),
    desnivel: ds.reduce((s, x) => s + num(x.desnivel), 0), larga: larga && num(larga.km) > 0 ? larga : null, records };
}
function gimnasio(xs, desde, hasta) {
  const ds = en(xs, desde, hasta);
  return { n: ds.length, min: ds.reduce((s, x) => s + num(x.min), 0), series: ds.reduce((s, x) => s + num(x.series), 0),
    volumen: ds.reduce((s, x) => s + num(x.volumen), 0), records: ds.reduce((s, x) => s + num(x.records), 0) };
}
function movilidad(xs, desde, hasta) {
  const ds = en(xs, desde, hasta);
  return { n: ds.length, min: ds.reduce((s, x) => s + num(x.min), 0) };
}
function habitos(hb, desde, hasta) {
  let h = 0, e = 0;
  Object.keys(hb.dias || {}).forEach(f => { if (dentro(f, desde, hasta)) { h += num(hb.dias[f].h); e += num(hb.dias[f].e); } });
  const porHabito = (hb.lista || []).map(x => {
    let hh = 0, ee = 0;
    Object.keys(x.dias || {}).forEach(f => { if (dentro(f, desde, hasta)) { ee++; if (x.dias[f]) hh++; } });
    // "X veces por semana": cuentan las semanas que empiezan en el período.
    Object.keys(x.semanas || {}).forEach(l => { if (dentro(l, desde, hasta)) { hh += num(x.semanas[l].h); ee += num(x.semanas[l].e); } });
    return { id: x.id, nombre: x.nombre, emoji: x.emoji || "", h: hh, e: ee, pct: ee ? hh / ee : null, semanal: !!x.semanas };
  }).filter(x => x.e > 0);
  return { h, e, pct: e ? h / e : null, perfectos: (hb.perfectos || []).filter(f => dentro(f, desde, hasta)).length, porHabito };
}
function libros(lb, desde, hasta) {
  let paginas = 0, dias = 0;
  Object.keys(lb.dias || {}).forEach(f => { if (dentro(f, desde, hasta) && num(lb.dias[f]) > 0) { paginas += num(lb.dias[f]); dias++; } });
  return { paginas, dias, terminados: en(lb.terminados, desde, hasta) };
}
function biblia(bb, desde, hasta) {
  const caps = en(bb.caps, desde, hasta), vers = en(bb.vers, desde, hasta);
  const dias = new Set(caps.map(x => x.fecha).concat(vers.map(x => x.fecha)));
  return { dias: dias.size, caps: caps.length, vers: vers.length, claves: caps.map(x => x.clave) };
}
function finanzas(fz, desde, hasta) {
  const ms_ = en(fz.movs, desde, hasta);
  let gasto = 0, ingreso = 0;
  const porCat = {}, conGasto = new Set();
  ms_.forEach(m => {
    if (m.tipo === "gasto") { gasto += num(m.cent); porCat[m.cat || "otros"] = (porCat[m.cat || "otros"] || 0) + num(m.cent); conGasto.add(m.fecha); }
    else if (m.tipo === "ingreso") ingreso += num(m.cent);
  });
  const dias = diasEntre(desde, hasta) + 1;
  const cats = Object.keys(porCat).map(c => ({ cat: c, nombre: (fz.cats && fz.cats[c]) || c, cent: porCat[c] })).sort((a, b) => b.cent - a.cent);
  return { gasto, ingreso, n: ms_.length, diasSinGasto: ms_.length ? dias - conGasto.size : 0, porCat: cats };
}
function manana(xs, desde, hasta) {
  const ds = en(xs, desde, hasta).filter(x => num(x.seg) > 0);
  const total = ds.reduce((s, x) => s + num(x.seg), 0);
  const mejor = ds.reduce((m, x) => (!m || x.seg < m.seg ? x : m), null);
  return { n: ds.length, promedio: ds.length ? total / ds.length : null, mejor };
}
function lugares(xs, desde, hasta) {
  let visitas = 0;
  const nuevos = [];
  (xs || []).forEach(l => {
    const vs = (l.visitas || []).filter(fechaOk).sort();
    const aqui = vs.filter(f => dentro(f, desde, hasta));
    visitas += aqui.length;
    if (vs.length && dentro(vs[0], desde, hasta)) nuevos.push({ id: l.id, nombre: l.nombre, calificacion: l.calificacion || null, zona: l.zona || "", fecha: vs[0] });
  });
  return { visitas, nuevos };
}

// Ropa (D-151): los días que anotaste lo que te pusiste, cuántas prendas
// distintas, la que más te pusiste, el color que más te pusiste (contando
// cada vez) y lo que compraste (por la fecha de compra de cada prenda).
function ropa(rp, desde, hasta) {
  const usos = (rp.usos || []).filter(u => dentro(u.fecha, desde, hasta) && (u.prendas || []).length);
  const por = new Map((rp.prendas || []).map(p => [p.id, p]));
  const veces = {};
  usos.forEach(u => [...new Set(u.prendas)].forEach(id => { if (por.has(id)) veces[id] = (veces[id] || 0) + 1; }));
  const ids = Object.keys(veces).sort((a, b) => veces[b] - veces[a] || (a < b ? -1 : 1));
  const porColor = {};
  ids.forEach(id => { const c = por.get(id).color; if (c) porColor[c] = (porColor[c] || 0) + veces[id]; });
  const color = Object.keys(porColor).sort((a, b) => porColor[b] - porColor[a] || a.localeCompare(b, "es"))[0] || "";
  const compradas = (rp.prendas || []).filter(p => dentro(p.compra, desde, hasta));
  return {
    dias: usos.length, distintas: ids.length,
    top: ids.length ? { id: ids[0], nombre: por.get(ids[0]).nombre, veces: veces[ids[0]] } : null,
    color, compras: compradas.length, gasto: compradas.reduce((s, p) => s + num(p.precio), 0)
  };
}

// Las cifras de todas las secciones entre dos fechas (incluidas).
function periodo(d, desde, hasta) {
  const x = d || {};
  const out = { desde, hasta };
  if (x.running) out.running = actividades(x.running, desde, hasta);
  if (x.bici) out.bici = actividades(x.bici, desde, hasta);
  if (x.gimnasio) out.gimnasio = gimnasio(x.gimnasio, desde, hasta);
  if (x.movilidad) out.movilidad = movilidad(x.movilidad, desde, hasta);
  if (x.habitos) out.habitos = habitos(x.habitos, desde, hasta);
  if (x.libros) out.libros = libros(x.libros, desde, hasta);
  if (x.biblia) out.biblia = biblia(x.biblia, desde, hasta);
  if (x.finanzas) out.finanzas = finanzas(x.finanzas, desde, hasta);
  if (x.manana) out.manana = manana(x.manana, desde, hasta);
  if (x.lugares) out.lugares = lugares(x.lugares, desde, hasta);
  if (x.ropa) out.ropa = ropa(x.ropa, desde, hasta);
  out.diasActivos = diasActivos(x, desde, hasta).size;
  return out;
}
// Días con algo registrado en cualquier sección.
function diasActivos(x, desde, hasta) {
  const s = new Set();
  const poner = f => { if (dentro(f, desde, hasta)) s.add(f); };
  ["running", "bici", "gimnasio", "movilidad", "manana"].forEach(k => (x[k] || []).forEach(e => poner(e.fecha)));
  if (x.habitos) Object.keys(x.habitos.dias || {}).forEach(f => { if (num(x.habitos.dias[f].h) > 0) poner(f); });
  if (x.libros) Object.keys(x.libros.dias || {}).forEach(f => { if (num(x.libros.dias[f]) > 0) poner(f); });
  if (x.biblia) (x.biblia.caps || []).concat(x.biblia.vers || []).forEach(e => poner(e.fecha));
  if (x.finanzas) (x.finanzas.movs || []).forEach(e => poner(e.fecha));
  if (x.lugares) x.lugares.forEach(l => (l.visitas || []).forEach(poner));
  if (x.ropa) (x.ropa.usos || []).forEach(u => { if ((u.prendas || []).length) poner(u.fecha); });
  return s;
}

// ---- ¿Qué áreas usas? (algo en las 8 semanas que terminan en `hasta`) ----
const AREAS = [
  { id: "habitos", nombre: "Hábitos", icono: "habits", href: "#habitos" },
  { id: "gimnasio", nombre: "Gimnasio", icono: "exercise", href: "#ejercicio" },
  { id: "running", nombre: "Running", icono: "running", href: "#running" },
  { id: "bici", nombre: "Bici", icono: "cycling", href: "#bicicleta" },
  { id: "movilidad", nombre: "Movilidad", icono: "movilidad", href: "#movilidad" },
  { id: "libros", nombre: "Libros", icono: "libro", href: "#libros" },
  { id: "biblia", nombre: "Biblia", icono: "biblia", href: "#biblia" },
  { id: "finanzas", nombre: "Finanzas", icono: "finance", href: "#finanzas" },
  { id: "manana", nombre: "Mi mañana", icono: "timer", href: "#tiempos" },
  { id: "lugares", nombre: "Lugares", icono: "lugar", href: "#lugares" },
  { id: "ropa", nombre: "Ropa", icono: "ropa", href: "#ropa" }
];
function usada(id, p) {
  const a = p[id];
  if (!a) return false;
  switch (id) {
    case "habitos": return a.e > 0;
    case "libros": return a.paginas > 0 || a.terminados.length > 0;
    case "biblia": return a.dias > 0;
    case "finanzas": return a.n > 0;
    case "lugares": return a.visitas > 0;
    case "ropa": return a.dias > 0 || a.compras > 0;
    default: return a.n > 0;
  }
}

// ---- Comparar: ▲ / ▼ con su signo (bueno = +1) ----
function cambio(actual, antes, o) {
  const op = o || {};
  if (antes == null || actual == null) return null;
  const dif = actual - antes;
  const umbral = op.umbral != null ? op.umbral : 0;
  if (Math.abs(dif) <= umbral) return { texto: "igual que la semana pasada", signo: 0 };
  const sube = dif > 0;
  const bueno = op.menosEsMejor ? !sube : sube;
  return { texto: `${sube ? "▲" : "▼"} ${op.texto ? op.texto(Math.abs(dif)) : dec1(Math.abs(dif))}`, signo: bueno ? 1 : -1 };
}
// Promedio por semana de las 4 semanas antes de `lunes` (o de los mismos días si la semana va por la mitad).
// per(desde, hasta): las cifras de ese período (con memoria, para no recalcular).
function promedio4(per, lunes, dias, fn) {
  const vs = [];
  for (let k = 1; k <= 4; k++) {
    const a = sumar(lunes, -7 * k);
    vs.push(fn(per(a, sumar(a, dias - 1))));
  }
  const ok = vs.filter(v => v != null);
  return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : null;
}

// ---- La semana ----
function semana(d, lunesIn) {
  const x = d || {};
  const hoy = fechaOk(x.hoy) ? x.hoy : aFecha(Date.now());
  const lunes = lunesDe(fechaOk(lunesIn) ? lunesIn : hoy);
  const domingo = sumar(lunes, 6);
  const enCurso = domingo > hoy && lunes <= hoy;
  const hasta = enCurso ? hoy : domingo;
  const dias = diasEntre(lunes, hasta) + 1;
  const memo = new Map();
  const per = (a, b) => { const k = `${a}|${b}`; if (!memo.has(k)) memo.set(k, periodo(x, a, b)); return memo.get(k); };
  const p = per(lunes, hasta);
  const ant = per(sumar(lunes, -7), sumar(lunes, dias - 8));
  const ocho = per(sumar(lunes, -49), hasta);
  const prom = fn => promedio4(per, lunes, dias, fn);
  const areas = [];
  const mejor = [], atras = [];

  AREAS.forEach(def => {
    if (!usada(def.id, ocho) && !usada(def.id, p)) return;
    const a = p[def.id], b = ant[def.id];
    const area = { id: def.id, nombre: def.nombre, icono: def.icono, href: def.href, linea: "", cambio: null, detalle: "" };
    if (def.id === "habitos") {
      area.valor = a.pct == null ? "—" : pct(a.pct);
      area.linea = a.e ? `${pct(a.pct)} de tus hábitos${a.perfectos ? ` · ${plural(a.perfectos, "día perfecto", "días perfectos")}` : ""}` : "Sin hábitos que tocaran";
      if (a.pct != null && b && b.pct != null) area.cambio = cambio(Math.round(a.pct * 100), Math.round(b.pct * 100), { umbral: 2, texto: v => `${Math.round(v)} pts` });
      const top = a.porHabito.filter(h => h.e >= 2).sort((m, n) => n.pct - m.pct || n.h - m.h)[0];
      if (top && top.pct >= 0.7) area.detalle = `Mejor: ${top.emoji ? `${top.emoji} ` : ""}${top.nombre} (${top.h} de ${top.e})`;
      if (a.perfectos >= 2) mejor.push({ icono: "🔥", texto: `${plural(a.perfectos, "día perfecto", "días perfectos")} de hábitos`, peso: 6 + a.perfectos });
      else if (a.pct != null && a.pct >= 0.9 && a.e >= 7) mejor.push({ icono: "🔥", texto: `Cumpliste el ${pct(a.pct)} de tus hábitos`, peso: 6 });
      const flojo = a.porHabito.filter(h => h.e >= 3 && h.pct <= 0.5).sort((m, n) => m.pct - n.pct || n.e - m.e)[0];
      const unidad = flojo && flojo.semanal ? "veces" : "días";
      if (flojo) atras.push({ icono: flojo.emoji || "•", texto: `«${flojo.nombre}»: ${flojo.h} de ${flojo.e} ${unidad}`, area: "habitos", gravedad: 1 - flojo.pct,
        sugerencia: { texto: `Enfócate en «${flojo.nombre}»: intenta ${Math.min(flojo.e, Math.max(flojo.h + 2, Math.ceil(flojo.e / 2)))} de ${flojo.e} ${unidad}.`, href: "#habitos" } });
    } else if (def.id === "gimnasio") {
      area.valor = plural(a.n, "entreno", "entrenos");
      area.linea = a.n ? [plural(a.n, "entreno", "entrenos"), a.series ? plural(a.series, "serie", "series") : "", a.volumen ? `${miles(a.volumen)} kg` : "", a.records ? plural(a.records, "récord", "récords") : ""].filter(Boolean).join(" · ") : "Sin entrenos";
      if (b) area.cambio = cambio(a.n, b.n, { texto: v => plural(v, "entreno", "entrenos") });
      if (a.records) mejor.push({ icono: "🏋️", texto: a.records === 1 ? "Un récord nuevo en el gimnasio" : `${a.records} récords nuevos en el gimnasio`, peso: 9 + a.records });
      const media = prom(q => (q.gimnasio ? q.gimnasio.n : null));
      if (!a.n && media >= 1 && !enCurso) atras.push({ icono: "🏋️", texto: `No entrenaste en el gimnasio (sueles hacer ${dec1(media)} por semana)`, area: "gimnasio", gravedad: 0.9,
        sugerencia: { texto: `Agenda ${Math.max(1, Math.round(media))} ${Math.round(media) > 1 ? "entrenos" : "entreno"} esta semana: elige los días hoy.`, href: "#ejercicio" } });
      else if (media >= 2 && a.n <= media - 2 && !enCurso) atras.push({ icono: "🏋️", texto: `Gimnasio: ${plural(a.n, "entreno", "entrenos")} (sueles hacer ${dec1(media)})`, area: "gimnasio", gravedad: 0.6,
        sugerencia: { texto: `Vuelve a tus ${Math.round(media)} entrenos por semana.`, href: "#ejercicio" } });
    } else if (def.id === "running" || def.id === "bici") {
      const que = def.id === "running" ? ["carrera", "carreras", "corriendo"] : ["rodada", "rodadas", "en bici"];
      area.valor = km(a.km);
      area.linea = a.n ? [km(a.km), plural(a.n, que[0], que[1]), duracion(a.min)].join(" · ") : `Sin ${que[1]}`;
      if (b) area.cambio = cambio(Math.round(a.km * 10) / 10, Math.round(b.km * 10) / 10, { umbral: 0.05, texto: v => km(v) });
      a.records.filter(r => r.puesto === 1).slice(0, 2).forEach(r => mejor.push({ icono: "🏅", texto: `Nuevo récord en ${r.nombre}: ${mmss(r.t)}`, peso: 12 }));
      // La más larga del año (si es de esta semana).
      if (a.larga && a.larga.km >= 5) {
        const anio = actividades(x[def.id], `${hasta.slice(0, 4)}-01-01`, hasta);
        if (anio.larga && anio.larga.fecha >= lunes && anio.n >= 4) mejor.push({ icono: def.id === "running" ? "🏃" : "🚴", texto: `Tu ${def.id === "running" ? "carrera" : "rodada"} más larga del año: ${km(a.larga.km)}`, peso: 8 });
      }
      const media = prom(q => (q[def.id] ? q[def.id].km : null));
      if (!a.n && media >= 3 && !enCurso) atras.push({ icono: def.id === "running" ? "🏃" : "🚴", texto: `No saliste a ${def.id === "running" ? "correr" : "rodar"} (sueles hacer ${km(media)})`, area: def.id, gravedad: 0.8,
        sugerencia: { texto: def.id === "running" ? "Sal a correr al menos una vez esta semana, aunque sean 3 km." : "Sal en bici al menos una vez esta semana.", href: def.href } });
    } else if (def.id === "movilidad") {
      area.valor = plural(a.n, "rutina", "rutinas");
      area.linea = a.n ? `${plural(a.n, "rutina", "rutinas")} · ${duracion(a.min)}` : "Sin rutinas";
      if (b) area.cambio = cambio(a.n, b.n, { texto: v => plural(v, "rutina", "rutinas") });
    } else if (def.id === "libros") {
      area.valor = `${miles(a.paginas)} págs.`;
      area.linea = [a.paginas ? `${plural(a.paginas, "página", "páginas")} · ${plural(a.dias, "día leyendo", "días leyendo")}` : "Sin páginas anotadas",
        a.terminados.length ? plural(a.terminados.length, "terminado", "terminados") : ""].filter(Boolean).join(" · ");
      if (b) area.cambio = cambio(a.paginas, b.paginas, { umbral: 0, texto: v => plural(v, "página", "páginas") });
      a.terminados.slice(0, 2).forEach(t => mejor.push({ icono: "📚", texto: `Terminaste «${t.titulo}»${t.calificacion ? ` (${"★".repeat(Math.round(t.calificacion))})` : ""}`, peso: 10 }));
      const media = prom(q => (q.libros ? q.libros.paginas : null));
      if (!a.paginas && !a.terminados.length && media >= 30 && !enCurso) atras.push({ icono: "📚", texto: `No leíste esta semana (sueles leer ${plural(media, "página", "páginas")})`, area: "libros", gravedad: 0.7,
        sugerencia: { texto: `Lee ${Math.max(5, Math.round(media / 7 / 5) * 5)} páginas por día: ${miles(Math.max(5, Math.round(media / 7 / 5) * 5) * 7)} en la semana.`, href: "#libros" } });
    } else if (def.id === "biblia") {
      area.valor = `${a.dias} de ${dias} días`;
      area.linea = `${a.dias} de ${dias} días${a.caps ? ` · ${plural(a.caps, "capítulo", "capítulos")}` : ""}${a.vers ? ` · ${plural(a.vers, "versículo", "versículos")}` : ""}`;
      if (b) area.cambio = cambio(a.dias, b.dias, { texto: v => plural(v, "día", "días") });
      if (a.dias === 7) mejor.push({ icono: "📖", texto: "Leíste la Biblia los 7 días", peso: 7 });
      const media = prom(q => (q.biblia ? q.biblia.dias : null));
      if (media >= 4 && a.dias <= media - 3 && !enCurso) atras.push({ icono: "📖", texto: `Biblia: ${a.dias} de 7 días (sueles ${dec1(media)})`, area: "biblia", gravedad: 0.6,
        sugerencia: { texto: "Lee un capítulo cada mañana: así vuelves a los 7 días.", href: "#biblia" } });
    } else if (def.id === "finanzas") {
      area.valor = bs(a.gasto);
      area.linea = [`${bs(a.gasto)} gastados`, a.ingreso ? `${bs(a.ingreso)} de ingresos` : "", a.diasSinGasto ? plural(a.diasSinGasto, "día sin gastar", "días sin gastar") : ""].filter(Boolean).join(" · ");
      const media = prom(q => (q.finanzas ? q.finanzas.gasto : null));
      if (media > 0) {
        const r = (a.gasto - media) / media;
        area.cambio = Math.abs(r) < 0.05 ? { texto: "como tu promedio", signo: 0 } : { texto: `${r > 0 ? "▲" : "▼"} ${Math.round(Math.abs(r) * 100)} % vs tu promedio`, signo: r > 0 ? -1 : 1 };
        if (r <= -0.15 && !enCurso && a.n) mejor.push({ icono: "💰", texto: `Gastaste ${Math.round(-r * 100)} % menos que tu promedio`, peso: 7 });
      }
      if (a.porCat[0]) area.detalle = `En qué más: ${a.porCat[0].nombre} (${bs(a.porCat[0].cent)})`;
      // Una categoría muy por encima de lo habitual.
      a.porCat.slice(0, 5).forEach(c => {
        const mc = prom(q => (q.finanzas ? (q.finanzas.porCat.find(k => k.cat === c.cat) || { cent: 0 }).cent : null));
        if (mc > 0 && c.cent >= 10000 && c.cent >= mc * 1.3) atras.push({ icono: "💸", texto: `${c.nombre}: ${bs(c.cent)}, ${Math.round((c.cent / mc - 1) * 100)} % más que tu promedio`, area: "finanzas", gravedad: Math.min(0.85, (c.cent / mc - 1) * 0.7),
          sugerencia: { texto: `Ponle un tope a ${c.nombre}: no más de ${bs(mc)} esta semana.`, href: "#finanzas" } });
      });
    } else if (def.id === "manana") {
      area.valor = a.promedio != null ? duracion(a.promedio / 60) : "—";
      area.linea = a.n ? `${duracion(a.promedio / 60)} de promedio (${plural(a.n, "día", "días")})` : "Sin mañanas medidas";
      if (b && b.promedio != null && a.promedio != null) {
        const dif = Math.round((a.promedio - b.promedio) / 60);
        area.cambio = Math.abs(dif) < 1 ? { texto: "igual que la semana pasada", signo: 0 } : { texto: `${dif < 0 ? "▲" : "▼"} ${Math.abs(dif)} min ${dif < 0 ? "más rápido" : "más lento"}`, signo: dif < 0 ? 1 : -1 };
        if (dif >= 5 && !enCurso) atras.push({ icono: "⏱️", texto: `Tu mañana: ${dif} min más lenta que la semana pasada`, area: "manana", gravedad: Math.min(0.8, dif / 20),
          sugerencia: { texto: "Deja listo de noche lo de la mañana (ropa, desayuno) para recuperar esos minutos.", href: "#tiempos" } });
      }
      // La más rápida de los últimos 30 días, si es de esta semana.
      const m30 = manana(x.manana, sumar(hasta, -29), hasta);
      if (a.mejor && m30.mejor && m30.mejor.fecha >= lunes && m30.n >= 5) mejor.push({ icono: "⏱️", texto: `Tu mañana más rápida del mes: ${duracion(a.mejor.seg / 60)}`, peso: 5 });
    } else if (def.id === "lugares") {
      area.valor = plural(a.visitas, "visita", "visitas");
      area.linea = a.visitas ? `${plural(a.visitas, "visita", "visitas")}${a.nuevos.length ? ` · ${plural(a.nuevos.length, "lugar nuevo", "lugares nuevos")}` : ""}` : "Sin visitas";
      a.nuevos.filter(l => l.calificacion >= 4).slice(0, 1).forEach(l => mejor.push({ icono: "🍽️", texto: `Descubriste «${l.nombre}» (${"★".repeat(Math.round(l.calificacion))})`, peso: 4 }));
    } else if (def.id === "ropa") {
      area.valor = `${a.dias} de ${dias} días`;
      area.linea = [a.dias ? `Anotaste tu ropa ${plural(a.dias, "día", "días")}` : "Sin ropa anotada",
        a.top && a.top.veces >= 2 ? `lo que más: ${a.top.nombre} (${plural(a.top.veces, "vez", "veces")})` : "",
        a.compras ? `compraste ${plural(a.compras, "prenda", "prendas")}` : ""].filter(Boolean).join(" · ");
      if (b) area.cambio = cambio(a.dias, b.dias, { texto: v => plural(v, "día", "días") });
      if (a.dias === 7) mejor.push({ icono: "👕", texto: "Anotaste tu ropa los 7 días", peso: 3 });
    }
    areas.push(area);
  });

  mejor.sort((m, n) => n.peso - m.peso);
  atras.sort((m, n) => n.gravedad - m.gravedad);
  const atrasTop = atras.slice(0, 3);
  return {
    lunes, domingo, hasta, enCurso, dias, rango: rango(lunes, domingo),
    titular: titular(p, areas, mejor, enCurso),
    areas,
    mejor: mejor.slice(0, 4).map(m => ({ icono: m.icono, texto: m.texto })),
    atras: atrasTop.map(m => ({ icono: m.icono, texto: m.texto, area: m.area })),
    sugerencia: sugerencia(atrasTop, p, areas, enCurso),
    cifras: p
  };
}

// "Semana fuerte: 3 entrenos, 21,3 km corriendo y el 82 % de tus hábitos."
function titular(p, areas, mejor, enCurso) {
  const partes = [];
  if (p.gimnasio && p.gimnasio.n) partes.push(plural(p.gimnasio.n, "entreno", "entrenos"));
  if (p.running && p.running.km >= 0.1) partes.push(`${km(p.running.km)} corriendo`);
  if (p.bici && p.bici.km >= 0.1) partes.push(`${km(p.bici.km)} en bici`);
  if (p.habitos && p.habitos.pct != null) partes.push(`el ${pct(p.habitos.pct)} de tus hábitos`);
  if (partes.length < 3 && p.libros && p.libros.paginas) partes.push(`${plural(p.libros.paginas, "página", "páginas")} leídas`);
  if (partes.length < 3 && p.biblia && p.biblia.dias) partes.push(`${plural(p.biblia.dias, "día", "días")} con la Biblia`);
  if (!partes.length) return enCurso ? "Tu semana recién empieza: todavía no hay nada anotado." : "Una semana tranquila: no hay nada anotado.";
  const suben = areas.filter(a => a.cambio && a.cambio.signo > 0).length, bajan = areas.filter(a => a.cambio && a.cambio.signo < 0).length;
  const records = mejor.some(m => /récord/.test(m.texto));
  const tono = enCurso ? "Tu semana hasta hoy" : records ? "Semana de récords" : suben >= 3 && suben > bajan ? "Semana fuerte" : suben >= bajan ? "Buena semana" : "Semana más tranquila";
  return `${tono}: ${lista(partes.slice(0, 3))}.`;
}

// Una sola sugerencia, concreta: la de lo que más se quedó atrás; si no hay
// nada atrás, subir un poco lo que mejor anda.
function sugerencia(atras, p, areas, enCurso) {
  if (atras.length && atras[0].sugerencia) return atras[0].sugerencia;
  if (enCurso) return null;
  if (p.running && p.running.n >= 2 && p.running.km >= 5) return { texto: `Vas bien: intenta ${km(Math.round(p.running.km * 1.1 * 10) / 10)} corriendo esta semana (un 10 % más).`, href: "#running" };
  if (p.habitos && p.habitos.pct != null && p.habitos.pct < 1) return { texto: `Vas bien: busca un día perfecto más de hábitos esta semana.`, href: "#habitos" };
  if (p.gimnasio && p.gimnasio.n) return { texto: `Repite tus ${plural(p.gimnasio.n, "entreno", "entrenos")} y busca un récord.`, href: "#ejercicio" };
  return areas.length ? { texto: "Otra semana como esta: elige una cosa para mejorar un poco.", href: null } : null;
}

return {
  MESES, MESES_LARGOS, AREAS,
  fechaOk, sumar, diasEntre, lunesDe, rango,
  miles, dec1, km, pct, bs, duracion, mmss, plural, lista,
  periodo, diasActivos, semana, cambio
};
});
