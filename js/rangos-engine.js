// ---------- Rangos: motor de cálculo (lógica pura, sin DOM ni Firebase) ----------
// Score de fuerza ajustado al peso corporal → percentil estimado con la
// tabla de estándares → división con histéresis, protección tras subir y
// bajada gradual por inactividad. Luego las capas músculo → grupo → global.
// Todo se recalcula desde el historial; aquí no se guarda nada. Las
// constantes salen de js/rangos-config.js. Tests: tests/rangos-engine.test.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./rangos-config.js"));
  else root.RangosEngine = factory(root.RangosConfig);
})(typeof self !== "undefined" ? self : this, function (CFG) {

const C = CFG.CONST;
const ROMANOS = ["I", "II", "III"];

// Las 25 divisiones en orden, de Hierro I a Simétrico.
const NIVELES = [];
CFG.RANGOS.forEach((r, ri) => r.minimos.forEach((min, di) => {
  const conDivisiones = r.minimos.length > 1;
  NIVELES.push({
    idx: NIVELES.length, rango: r, rangoIdx: ri, division: conDivisiones ? di + 1 : 0, min,
    nombre: r.nombre + (conDivisiones ? " " + ROMANOS[di] : "")
  });
}));

const num = v => { const x = Number(v); return isFinite(x) ? x : 0; };

// ---- Score ----
function e1RM(peso, reps, cap) {
  return reps <= 1 ? peso : peso * (1 + Math.min(reps, cap) / 30);
}
function factorPeso(pesoCorporal, c) {
  c = c || C;
  return Math.pow(c.REF_BW / pesoCorporal, c.ALLOMETRIC_EXP);
}
function norm(x, pesoCorporal, c) {
  return x * factorPeso(pesoCorporal, c);
}

// Score de una serie o null si no vale (calentamiento, fuera de rango…).
// En "corporal" la columna kg de Manolo es el lastre; asistencia resta.
function scoreSerie(serie, familia, pesoCorporal, c) {
  c = c || C;
  if (!serie || serie.calentamiento) return null;
  const lim = c.LIMITES[familia];
  const dentro = (v, r) => v >= r[0] && v <= r[1];
  const reps = num(serie.reps);
  if (familia === "carga") {
    const kg = num(serie.kg);
    if (kg <= 0 || !dentro(reps, lim.reps)) return null;
    return norm(e1RM(kg, reps, c.REP_CAP_CARGA), pesoCorporal, c);
  }
  if (familia === "corporal") {
    const carga = pesoCorporal + num(serie.kg) + num(serie.lastre) - num(serie.asistencia);
    if (carga <= 0 || !dentro(reps, lim.reps)) return null;
    return norm(e1RM(carga, reps, c.REP_CAP_CORPORAL), pesoCorporal, c);
  }
  if (familia === "reps") return dentro(reps, lim.reps) ? reps : null;
  if (familia === "tiempo") {
    const seg = num(serie.seg);
    return dentro(seg, lim.seg) ? seg : null;
  }
  return null;
}

// ---- Percentil ----
function puntosAncla(anclas) {
  return [[0, 0]].concat(anclas.map((a, i) => [a, CFG.PERCENTILES_ANCLA[i]]));
}

function percentil(S, anclas) {
  if (!(S > 0)) return 0;
  const a95 = anclas[4], a99 = anclas[5];
  if (S >= a99) return Math.min(99.9, 99 + (S - a99) / (a99 - a95));
  const pts = puntosAncla(anclas);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, p0] = pts[i], [x1, p1] = pts[i + 1];
    if (S <= x1) return p0 + (p1 - p0) * (S - x0) / (x1 - x0);
  }
  return 99;
}

// Inversa: score necesario para alcanzar el percentil P.
function scoreParaPercentil(P, anclas) {
  if (!(P > 0)) return 0;
  const a95 = anclas[4], a99 = anclas[5];
  if (P >= 99) return a99 + (P - 99) * (a99 - a95);
  const pts = puntosAncla(anclas);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, p0] = pts[i], [x1, p1] = pts[i + 1];
    if (P <= p1) return x0 + (x1 - x0) * (P - p0) / (p1 - p0);
  }
  return a99;
}

// ---- Divisiones ----
function nivelPorPercentil(P) {
  let idx = 0;
  for (const n of NIVELES) if (P >= n.min) idx = n.idx;
  return idx;
}

// Sube en cuanto P alcanza una división superior; solo baja si P cae más de
// HYSTERESIS puntos por debajo del mínimo de la división actual.
function nivelConHisteresis(P, actual, c) {
  c = c || C;
  const objetivo = nivelPorPercentil(P);
  if (actual == null || objetivo >= actual) return objetivo;
  return P < NIVELES[actual].min - c.HYSTERESIS ? objetivo : actual;
}

function textoPercentil(P) {
  if (P >= 50) return `Estás en el top ${Math.max(1, Math.round(100 - P))} % más fuerte`;
  return `Superas al ${Math.round(P)} % de hombres que entrenan (estimado)`;
}

function topPorcentaje(P) {
  return Math.max(1, Math.round(100 - P));
}

// ---- Tiempo e inactividad ----
function diasEntre(a, b) {
  const t = s => { const [y, m, d] = String(s).split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

// Margen de GRACE_DAYS sin cambios; después, −1 % por semana completa, sin
// bajar de min(L, 85 % del pico).
function inactividad(L, pico, dias, c) {
  c = c || C;
  if (!(dias > c.GRACE_DAYS)) return L;
  const semanas = Math.floor((dias - c.GRACE_DAYS) / 7);
  const bajado = L * Math.pow(1 - c.DECAY_WEEKLY, semanas);
  return Math.max(bajado, Math.min(L, c.FLOOR_RATIO * pico));
}

// ---- Capa 1: ejercicio ----
// sesiones: [{ id, fecha, series: [{ key, score }] }] ordenadas por fecha;
// solo series válidas. Devuelve el estado de hoy y la historia para el gráfico.
function evaluarEjercicio(def, sesiones, hoy, opciones, c) {
  c = c || C;
  const confirmadas = (opciones && opciones.confirmadas) || {};
  const umbralP99 = def.anclas[5] * c.SOSPECHOSA_P99;
  const porNivel = def.familia === "carga" || def.familia === "corporal";
  let L = null, pico = 0, nivel = null, escudo = 0, ultima = null;
  const puntos = [], sospechosas = [];

  (sesiones || []).forEach(s => {
    const Le = L == null ? null : inactividad(L, pico, diasEntre(ultima, s.fecha), c);
    const validas = s.series.filter(x => {
      const rara = x.score > umbralP99 || (porNivel && Le != null && x.score > c.SOSPECHOSA_NIVEL * Le);
      if (rara && !confirmadas[x.key]) { sospechosas.push(Object.assign({ fecha: s.fecha, sesionId: s.id }, x)); return false; }
      return true;
    });
    if (!validas.length) return;
    const S = Math.max(...validas.map(x => x.score));
    if (L == null) L = S;
    else L = S >= Le ? Le + c.ALPHA_UP * (S - Le) : Le + c.ALPHA_DOWN * (S - Le);
    pico = Math.max(pico, L);
    const P = percentil(L, def.anclas);
    const protegida = escudo > 0;
    if (protegida) escudo--;
    let nuevo = nivelConHisteresis(P, nivel, c);
    if (protegida && nivel != null && nuevo < nivel) nuevo = nivel;
    if (nivel != null && nuevo > nivel) escudo = c.SHIELD_SESSIONS;
    nivel = nuevo;
    ultima = s.fecha;
    puntos.push({ fecha: s.fecha, sesionId: s.id, score: S, L, P, nivel, series: validas.length });
  });

  if (!puntos.length) return { tieneRango: false, puntos, sospechosas };

  const dias = Math.max(0, diasEntre(ultima, hoy));
  const Lhoy = inactividad(L, pico, dias, c);
  const P = percentil(Lhoy, def.anclas);
  const nivelHoy = nivelConHisteresis(P, nivel, c); // la inactividad no respeta el escudo
  const estado = dias > c.GRACE_DAYS ? "bajando" : escudo > 0 ? "protegido" : "margen";
  const seriesRecientes = puntos
    .filter(p => diasEntre(p.fecha, hoy) < c.VENTANA_SERIES_DIAS)
    .reduce((s, p) => s + p.series, 0);

  return {
    tieneRango: true, L, Lhoy, pico, P, nivel: nivelHoy, escudo, dias, estado,
    diasMargen: Math.max(0, c.GRACE_DAYS - dias), seriesRecientes, puntos, sospechosas
  };
}

// ---- Capa 2: músculo ----
// items: [{ id, P, musculos: { m: implicación }, seriesRecientes }] (solo con rango)
function calcularMusculos(items, c) {
  c = c || C;
  const acc = {};
  (items || []).forEach(it => {
    Object.keys(it.musculos || {}).forEach(m => {
      const implicacion = it.musculos[m];
      const peso = implicacion * Math.max(1, it.seriesRecientes || 0);
      const a = acc[m] || (acc[m] = { suma: 0, peso: 0, aportes: [] });
      a.suma += peso * it.P;
      a.peso += peso;
      a.aportes.push({ id: it.id, P: it.P, peso, implicacion });
    });
  });
  const out = {};
  Object.keys(acc).forEach(m => {
    const P = acc[m].suma / acc[m].peso;
    out[m] = { P, peso: acc[m].peso, nivel: nivelPorPercentil(P), aportes: acc[m].aportes.sort((a, b) => b.peso - a.peso) };
  });
  return out;
}

// ---- Capa 3: grupo ----
function calcularGrupos(musculos) {
  const out = {};
  CFG.GRUPOS.forEach(g => {
    const con = g.musculos.filter(m => musculos[m]);
    if (!con.length) { out[g.id] = { P: null, nivel: null, musculos: [] }; return; }
    const peso = con.reduce((s, m) => s + musculos[m].peso, 0);
    const P = con.reduce((s, m) => s + musculos[m].peso * musculos[m].P, 0) / peso;
    out[g.id] = { P, peso, nivel: nivelPorPercentil(P), musculos: con };
  });
  return out;
}

// ---- Capa 4: global ----
// Media de potencia (p = 0,5) de los 6 grupos; un grupo sin rango vale 0.
function calcularGlobal(grupos, conRango, c) {
  c = c || C;
  const faltan = Math.max(0, c.GLOBAL_MIN_EJERCICIOS - conRango);
  const valores = CFG.GRUPOS.map(g => (grupos[g.id] && grupos[g.id].P) || 0);
  const p = c.GLOBAL_POWER;
  const P = Math.pow(valores.reduce((s, v) => s + Math.pow(v, p), 0) / valores.length, 1 / p);
  return { desbloqueado: faltan === 0, faltan, conRango, P, nivel: faltan === 0 ? nivelPorPercentil(P) : null };
}

// ---- Meta: la serie concreta para llegar a la siguiente división ----
function redondearArriba(x, paso) {
  return Math.ceil(x / paso - 1e-9) * paso;
}

function meta(def, nivelActual, pesoCorporal, c) {
  c = c || C;
  const destino = NIVELES[nivelActual + 1];
  if (!destino) return null;
  const S = scoreParaPercentil(destino.min, def.anclas);
  const base = { nivel: destino, scoreNecesario: S };
  const reps = c.META_REPS;
  if (def.familia === "carga") {
    const bruto = S / factorPeso(pesoCorporal, c);
    const kg = redondearArriba(bruto / (1 + reps / 30), c.META_REDONDEO);
    return Object.assign(base, { kg, reps, texto: `≈ ${String(kg).replace(".", ",")} kg × ${reps}` });
  }
  if (def.familia === "corporal") {
    const bruto = S / factorPeso(pesoCorporal, c);
    let n = Math.ceil(30 * (bruto / pesoCorporal - 1) - 1e-9);
    if (n < 1) n = 1; else if (n === 1) n = 2; // 1 rep = solo el peso corporal
    if (n <= c.META_MAX_REPS_CORPORAL) return Object.assign(base, { reps: n, texto: `${n} reps a peso corporal` });
    const lastre = redondearArriba(bruto / (1 + reps / 30) - pesoCorporal, c.META_REDONDEO);
    return Object.assign(base, { lastre, reps, texto: `+${String(lastre).replace(".", ",")} kg de lastre × ${reps}` });
  }
  const n = Math.ceil(S - 1e-9);
  return Object.assign(base, { texto: def.familia === "tiempo" ? `${n} s` : `${n} reps` });
}

// ---- Músculos desde el mapa muscular de Manolo ----
// Convierte primarios/secundarios de una ficha de data/ejercicios.json a los
// músculos con rango (los tres pechos → pectoral, etc.). null si no aporta.
const REGION_A_MUSCULO = {};
Object.keys(CFG.MUSCULOS).forEach(m => CFG.MUSCULOS[m].regiones.forEach(r => { REGION_A_MUSCULO[r] = m; }));

function musculosDesdeFicha(ficha, c) {
  c = c || C;
  if (!ficha) return null;
  const out = {};
  const poner = (region, v) => {
    const m = REGION_A_MUSCULO[region];
    if (m) out[m] = Math.max(out[m] || 0, v);
  };
  (ficha.secundarios || []).forEach(r => poner(r, c.IMPLICACION_SECUNDARIO));
  (ficha.primarios || []).forEach(r => poner(r, c.IMPLICACION_PRIMARIO));
  return Object.keys(out).length ? out : null;
}

// ---- Todo junto, desde los entrenos guardados ----
// entrenos: docs de Gimnasio. vincular(ex) → { id, clave, nombre, motivo }.
// musculosDe(id) → { m: implicación }. pesoEn(fecha) → kg.
function calcularRangos(opciones) {
  const o = opciones || {};
  const c = o.c || C;
  const catalogo = o.catalogo || CFG.STANDARDS[CFG.COHORTE];
  const porEjercicio = {};
  const sinRango = {};
  const entrenos = (o.entrenos || []).filter(w => w && w.date)
    .slice().sort((a, b) => a.date.localeCompare(b.date) || num(a.startedAt) - num(b.startedAt));

  entrenos.forEach(w => {
    const bw = o.pesoEn ? o.pesoEn(w.date) : c.DEFAULT_BW;
    (w.exercises || []).forEach((ex, exIndex) => {
      const v = o.vincular(ex) || {};
      if (!v.id || !catalogo[v.id]) {
        if (!v.clave) return;
        const r = sinRango[v.clave] || (sinRango[v.clave] = { clave: v.clave, nombre: v.nombre || ex.name, motivo: v.motivo || "sin_vincular", veces: 0, ultimaFecha: w.date, ejemplo: ex });
        r.veces++;
        r.ultimaFecha = w.date;
        return;
      }
      const def = catalogo[v.id];
      const series = (ex.sets || []).map((s, si) => ({
        key: `${w.id}|${v.id}|${exIndex}|${si}`,
        score: scoreSerie(s, def.familia, bw, c),
        kg: s.kg, reps: s.reps, seg: s.seg, asistencia: s.asistencia
      })).filter(x => x.score != null);
      const lista = porEjercicio[v.id] || (porEjercicio[v.id] = { sesiones: [], mapa: {}, nombres: {} });
      lista.nombres[ex.name] = true;
      if (!series.length) return;
      let ses = lista.mapa[w.id];
      if (!ses) { ses = lista.mapa[w.id] = { id: w.id, fecha: w.date, bw, series: [] }; lista.sesiones.push(ses); }
      ses.series.push(...series);
    });
  });

  const ejercicios = {};
  Object.keys(porEjercicio).forEach(id => {
    const def = catalogo[id];
    const r = evaluarEjercicio(def, porEjercicio[id].sesiones, o.hoy, { confirmadas: o.confirmadas }, c);
    const ultima = porEjercicio[id].sesiones[porEjercicio[id].sesiones.length - 1];
    const bwHoy = o.pesoEn ? o.pesoEn(o.hoy) : (ultima ? ultima.bw : c.DEFAULT_BW);
    ejercicios[id] = Object.assign({ id, def, nombresUsados: Object.keys(porEjercicio[id].nombres), pesoCorporal: bwHoy }, r);
    if (r.tieneRango) ejercicios[id].meta = meta(def, r.nivel, bwHoy, c);
  });

  const conRango = Object.values(ejercicios).filter(e => e.tieneRango);
  const items = conRango.map(e => ({
    id: e.id, P: e.P, seriesRecientes: e.seriesRecientes,
    musculos: (o.musculosDe && o.musculosDe(e.id)) || e.def.musculos
  }));
  const musculos = calcularMusculos(items, c);
  const grupos = calcularGrupos(musculos);
  const global = calcularGlobal(grupos, conRango.length, c);
  return {
    ejercicios, musculos, grupos, global,
    sinRango: Object.values(sinRango).sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre))
  };
}

// ---- Snapshot para el aviso "Nuevos rangos" ----
function nivelesDe(res) {
  const out = {};
  Object.values(res.ejercicios).forEach(e => { if (e.tieneRango) out["ej:" + e.id] = e.nivel; });
  Object.keys(res.musculos).forEach(m => { out["mu:" + m] = res.musculos[m].nivel; });
  Object.keys(res.grupos).forEach(g => { if (res.grupos[g].nivel != null) out["gr:" + g] = res.grupos[g].nivel; });
  if (res.global.desbloqueado) out.global = res.global.nivel;
  return out;
}

// Solo subidas (o rangos nuevos, incluido desbloquear el global).
function subidas(anterior, actual) {
  const out = [];
  Object.keys(actual).forEach(k => {
    const antes = anterior ? anterior[k] : undefined;
    if (antes == null || actual[k] > antes) out.push({ clave: k, antes: antes == null ? null : antes, despues: actual[k] });
  });
  const orden = k => (k === "global" ? 0 : k.startsWith("gr:") ? 1 : k.startsWith("mu:") ? 2 : 3);
  return out.sort((a, b) => orden(a.clave) - orden(b.clave) || b.despues - a.despues);
}

return {
  CFG, NIVELES, e1RM, factorPeso, norm, scoreSerie, percentil, scoreParaPercentil,
  nivelPorPercentil, nivelConHisteresis, textoPercentil, topPorcentaje, diasEntre,
  inactividad, evaluarEjercicio, calcularMusculos, calcularGrupos, calcularGlobal,
  meta, musculosDesdeFicha, calcularRangos, nivelesDe, subidas
};
});
