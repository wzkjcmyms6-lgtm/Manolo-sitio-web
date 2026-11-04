// ---------- Running: análisis entre actividades (sin pantalla) ----------
// Logros de una actividad (mejores marcas que fueron las 3 mejores hasta ese
// día) y Progreso (fase 4): totales por período, calendario, mejores marcas
// y su evolución, predicciones (Riegel), forma y fatiga (42/7 días), metas,
// racha de semanas y zapatillas. Fechas en AAAA-MM-DD locales.
// Pruebas: tests/run-analisis.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./run-metricas.js"));
  else root.RunAnalisis = factory(root.RunMetricas);
})(typeof self !== "undefined" ? self : this, function (RunMetricas) {
"use strict";

const NOMBRES = {};
RunMetricas.DISTANCIAS.forEach(([m, clave, nombre]) => { NOMBRES[clave] = { m, nombre }; });
const momento = d => (Number(d.inicio) > 0 ? Number(d.inicio) : Date.parse(`${d.date}T12:00:00`) || 0);

// Lista de esfuerzos de una distancia: [{ id, t, inicio, date }] del más rápido al más lento.
function esfuerzos(docs, clave, hasta) {
  return (docs || [])
    .filter(d => d.mejores && d.mejores[clave] > 0 && (hasta == null || momento(d) <= hasta))
    .map(d => ({ id: d.id, t: d.mejores[clave], inicio: momento(d), date: d.date, titulo: d.titulo }))
    .sort((a, b) => a.t - b.t || a.inicio - b.inicio);
}
// Logros de una actividad: { clave, nombre, t, puesto (1–3) } en el orden de las distancias.
// Puesto entre las actividades hasta ese momento (como era cuando se corrió).
function logros(doc, todos) {
  if (!doc || !doc.mejores) return [];
  const out = [];
  RunMetricas.DISTANCIAS.forEach(([, clave, nombre]) => {
    if (!(doc.mejores[clave] > 0)) return;
    const lista = esfuerzos(todos.concat(todos.some(d => d.id === doc.id) ? [] : [doc]), clave, momento(doc));
    const puesto = lista.findIndex(e => e.id === doc.id) + 1;
    if (puesto >= 1 && puesto <= 3) out.push({ clave, nombre, t: doc.mejores[clave], puesto });
  });
  return out;
}
// Logros de todas las actividades de una vez (para el feed): id → [{ clave, nombre, t, puesto }].
// Por distancia, en orden de fecha, con las 3 mejores hasta ese momento: O(n) por distancia.
function logrosPorId(docs) {
  const out = {};
  const orden = (docs || []).slice().sort((a, b) => momento(a) - momento(b));
  RunMetricas.DISTANCIAS.forEach(([, clave, nombre]) => {
    const top = [];
    orden.forEach(d => {
      const t = d.mejores && d.mejores[clave];
      if (!(t > 0)) return;
      let i = top.findIndex(x => t < x);
      if (i < 0) i = top.length;
      if (i >= 3) return;
      top.splice(i, 0, t);
      if (top.length > 3) top.pop();
      (out[d.id] = out[d.id] || []).push({ clave, nombre, t, puesto: i + 1 });
    });
  });
  return out;
}
const MEDALLA = { 1: "🥇", 2: "🥈", 3: "🥉" };
const textoPuesto = p => (p === 1 ? "Mejor marca" : p === 2 ? "2.ª mejor" : "3.ª mejor");

// ---- Fechas (AAAA-MM-DD, hora local) ----
const dia = iso => new Date(`${iso}T12:00:00`);
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const masDias = (iso, n) => { const d = dia(iso); d.setDate(d.getDate() + n); return isoDe(d); };
function lunes(iso) { const d = dia(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDe(d); }
const distM = d => (Number(d.distanciaM) > 0 ? Number(d.distanciaM) : (Number(d.distance) || 0) * 1000);
const movS = d => (Number(d.tiempoMovS) > 0 ? Number(d.tiempoMovS) : Number(d.tiempoActivoS) > 0 ? Number(d.tiempoActivoS) : (Number(d.duration) || 0) * 60);
const desn = d => (d.desnivelCorr ? Number(d.desnivelCorr.pos) || 0 : Number(d.desnivelPosM) || 0);

// ---- Totales por período, con el período anterior ----
// tipo: "semana" | "mes" | "anio" | "total" → { desde, hasta, km, seg, n, desnivel, previo }
function rango(tipo, hoy, atras) {
  const k = atras || 0;
  if (tipo === "semana") { const a = masDias(lunes(hoy), -7 * k); return [a, masDias(a, 6)]; }
  const d = dia(hoy);
  if (tipo === "mes") { const a = new Date(d.getFullYear(), d.getMonth() - k, 1), b = new Date(d.getFullYear(), d.getMonth() - k + 1, 0); return [isoDe(a), isoDe(b)]; }
  if (tipo === "anio") return [`${d.getFullYear() - k}-01-01`, `${d.getFullYear() - k}-12-31`];
  return ["0000-01-01", "9999-12-31"];
}
function sumar(docs, desde, hasta) {
  const out = { desde, hasta, km: 0, seg: 0, n: 0, desnivel: 0 };
  (docs || []).forEach(d => {
    if (!d.date || d.date < desde || d.date > hasta) return;
    out.km += distM(d) / 1000; out.seg += movS(d); out.n++; out.desnivel += desn(d);
  });
  return out;
}
function periodo(docs, tipo, hoy) {
  const [a, b] = rango(tipo, hoy, 0);
  const actual = sumar(docs, a, b);
  if (tipo !== "total") { const [c, e] = rango(tipo, hoy, 1); actual.previo = sumar(docs, c, e); }
  return actual;
}

// ---- Calendario del mes: km por día (círculos) ----
// → { mes: "AAAA-MM", inicioSemana (0 = lunes…6), dias: [{ fecha, km, ids }], max }
function calendario(docs, mes) {
  const [a, m] = mes.split("-").map(Number);
  const n = new Date(a, m, 0).getDate();
  const dias = [];
  for (let i = 1; i <= n; i++) dias.push({ fecha: `${mes}-${String(i).padStart(2, "0")}`, km: 0, ids: [] });
  (docs || []).forEach(d => {
    if (!d.date || d.date.slice(0, 7) !== mes) return;
    const x = dias[Number(d.date.slice(8, 10)) - 1];
    if (!x) return;
    x.km += distM(d) / 1000;
    x.ids.push(d.id);
  });
  return { mes, inicioSemana: (new Date(a, m - 1, 1).getDay() + 6) % 7, dias, max: Math.max(0, ...dias.map(x => x.km)) };
}

// ---- Mejores marcas: las 3 mejores y cómo fue mejorando ----
function topMarcas(docs, clave, n) {
  return esfuerzos(docs, clave).slice(0, n || 3);
}
// Puntos de la evolución: cada esfuerzo con la mejor marca hasta ese día.
function evolucion(docs, clave) {
  const lista = esfuerzos(docs, clave).sort((a, b) => a.inicio - b.inicio);
  let mejor = Infinity;
  return lista.map(e => { mejor = Math.min(mejor, e.t); return { id: e.id, inicio: e.inicio, date: e.date, t: e.t, mejor }; });
}

// ---- Predicciones (Riegel 1981: T2 = T1 × (D2/D1)^1,06) ----
const OBJETIVOS = [[5000, "5000", "5K"], [10000, "10000", "10K"], [21097.5, "21097", "Media maratón"], [42195, "42195", "Maratón"]];
function predicciones(docs, hoy, semanas) {
  const desde = dia(hoy).getTime() - (semanas || 12) * 7 * 86400000;
  const fin = dia(hoy).getTime() + 86400000;
  const recientes = (docs || []).filter(d => { const m = momento(d); return m >= desde && m <= fin && d.mejores; });
  return OBJETIVOS.map(([m2, clave, nombre]) => {
    let mejor = null;
    RunMetricas.DISTANCIAS.forEach(([m1, k1, n1]) => {
      if (m1 < 1609 || m1 < m2 / 8) return;
      recientes.forEach(d => {
        const t1 = d.mejores[k1];
        if (!(t1 > 0)) return;
        const t2 = t1 * Math.pow(m2 / m1, 1.06);
        if (!mejor || t2 < mejor.t) mejor = { t: Math.round(t2), desde: { clave: k1, nombre: n1, t: t1, id: d.id, date: d.date } };
      });
    });
    return { clave, nombre, m: m2, t: mejor ? mejor.t : null, desde: mejor ? mejor.desde : null };
  });
}

// ---- Carga de un día y forma y fatiga (D-065) ----
function cargaDe(d) {
  if (d.carga && d.carga.v > 0) return Number(d.carga.v);
  const c = RunMetricas.cargaRpe(Number(d.rpe), movS(d) / 60);
  return c ? c.v : 0;
}
// Estado físico = media exponencial de 42 días; fatiga = 7 días; forma = estado − fatiga.
// → [{ fecha, carga, estado, fatiga, forma }] de los últimos `dias` (por defecto 90).
function formaFatiga(docs, hoy, dias) {
  const n = dias || 90;
  const porDia = {};
  let primera = hoy;
  (docs || []).forEach(d => {
    if (!d.date || d.date > hoy) return;
    const c = cargaDe(d);
    if (!c) return;
    porDia[d.date] = (porDia[d.date] || 0) + c;
    if (d.date < primera) primera = d.date;
  });
  const out = [];
  let ctl = 0, atl = 0;
  const kc = 1 - Math.exp(-1 / 42), ka = 1 - Math.exp(-1 / 7);
  const inicio = masDias(hoy, -(n - 1));
  for (let f = primera < inicio ? primera : inicio; f <= hoy; f = masDias(f, 1)) {
    const c = porDia[f] || 0;
    ctl += (c - ctl) * kc;
    atl += (c - atl) * ka;
    if (f >= inicio) out.push({ fecha: f, carga: Math.round(c), estado: Math.round(ctl * 10) / 10, fatiga: Math.round(atl * 10) / 10, forma: Math.round((ctl - atl) * 10) / 10 });
  }
  return out;
}
// Frase corta sobre la forma (sin consejos médicos).
function textoForma(forma, estado) {
  if (!(estado > 0)) return "Todavía no hay carga registrada.";
  if (forma > 5) return "Descansado: tu fatiga está por debajo de tu estado físico.";
  if (forma >= -10) return "En equilibrio: entrenas parecido a lo de las últimas semanas.";
  if (forma >= -30) return "Cargado: estas semanas entrenas más que antes.";
  return "Muy cargado: la carga reciente es mucho mayor que la de las últimas semanas.";
}

// ---- Metas (km por semana, mes y año) ----
function metas(docs, hoy, m) {
  const out = [];
  [["semana", "semanaKm", "Semana"], ["mes", "mesKm", "Mes"], ["anio", "anioKm", "Año"]].forEach(([tipo, k, nombre]) => {
    const meta = Number(m && m[k]);
    if (!(meta > 0)) return;
    const km = periodo(docs, tipo, hoy).km;
    out.push({ tipo, nombre, meta, km, pct: Math.min(1, km / meta) });
  });
  return out;
}

// ---- Racha: semanas seguidas con al menos una carrera ----
// Si esta semana todavía no hay, la racha sigue viva desde la semana pasada.
function racha(docs, hoy) {
  const semanas = new Set((docs || []).filter(d => d.date && d.date <= hoy).map(d => lunes(d.date)));
  let s = lunes(hoy);
  const estaSemana = semanas.has(s);
  if (!estaSemana) s = masDias(s, -7);
  let n = 0;
  while (semanas.has(s)) { n++; s = masDias(s, -7); }
  return { semanas: n, estaSemana };
}

// ---- Zapatillas: km acumulados y aviso de cambio ----
// zap: [{ id, nombre, kmInicial, limiteKm, retirada }] → con km y estado ("ok" | "pronto" | "cambiar").
function zapatillas(docs, zap) {
  return (zap || []).map(z => {
    let km = Number(z.kmInicial) || 0, n = 0, ultima = null;
    (docs || []).forEach(d => {
      if (d.zapatillaId !== z.id) return;
      km += distM(d) / 1000; n++;
      if (!ultima || d.date > ultima) ultima = d.date;
    });
    const limite = Number(z.limiteKm) > 0 ? Number(z.limiteKm) : 700;
    const estado = z.retirada ? "retirada" : km >= limite ? "cambiar" : km >= 0.9 * limite ? "pronto" : "ok";
    return Object.assign({}, z, { km, n, ultima, limite, pct: Math.min(1, km / limite), estado });
  });
}
// Ritmo umbral por defecto: el ritmo de la mejor marca de 10K (o 5:30 /km).
function ritmoUmbralSugerido(docs) {
  const top = esfuerzos(docs, "10000")[0];
  return top ? Math.round(top.t / 10) : 330;
}

return {
  NOMBRES, esfuerzos, logros, logrosPorId, MEDALLA, textoPuesto, momento,
  lunes, periodo, rango, calendario, topMarcas, evolucion, OBJETIVOS, predicciones,
  cargaDe, formaFatiga, textoForma, metas, racha, zapatillas, ritmoUmbralSugerido
};
});
