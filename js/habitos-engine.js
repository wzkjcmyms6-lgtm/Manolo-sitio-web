// ---------- Hábitos: motor de cálculo (lógica pura, sin DOM ni Firebase) ----------
// Todo se recalcula desde el historial de cada hábito: qué días tocaban, el
// estado de cada día, rachas (en días o en semanas), comodines usados, días
// perfectos, XP, nivel y monedas ganadas. Así, desmarcar o corregir un día
// siempre deja todo coherente. Las constantes salen de js/habitos-config.js.
// Tests: tests/habitos-engine.test.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./habitos-config.js"));
  else root.HabitosEngine = factory(root.HabitosConfig);
})(typeof self !== "undefined" ? self : this, function (CFG) {

const C = CFG.CONST;
const X = CFG.XP;
const MS_HORA = 3600000;

// ---------- Fechas (siempre locales: nunca toISOString) ----------
const pad = n => String(n).padStart(2, "0");
const esFecha = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function partes(iso) {
  return iso.split("-").map(Number);
}
function addDias(iso, n) {
  const [y, m, d] = partes(iso);
  return isoDate(new Date(y, m - 1, d + n));
}
function diasEntre(a, b) {
  const t = s => { const [y, m, d] = partes(s); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}
// 0 = lunes … 6 = domingo
function diaSemana(iso) {
  const [y, m, d] = partes(iso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
function lunesDe(iso) {
  return addDias(iso, -diaSemana(iso));
}
// Semana ISO, ej. "2026-W40" (el jueves decide el año).
function semanaId(iso) {
  const jueves = addDias(lunesDe(iso), 3);
  const y = partes(jueves)[0];
  return `${y}-W${pad(Math.floor(diasEntre(`${y}-01-01`, jueves) / 7) + 1)}`;
}

function horaFinDia(v) {
  const n = Math.round(Number(v));
  return isFinite(n) ? Math.min(C.FIN_DIA_MAX, Math.max(0, n)) : C.FIN_DIA_DEFECTO;
}
// Fecha "del día" para un instante: con fin del día a las 3, las 2:30 del 1
// de octubre todavía son el 30 de septiembre.
function fechaLogica(ms, finDia) {
  const d = new Date(ms);
  if (d.getHours() < horaFinDia(finDia)) return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  return isoDate(d);
}
// Instante en que termina el día `iso`.
function finDelDiaMs(iso, finDia) {
  const [y, m, d] = partes(iso);
  return new Date(y, m - 1, d + 1, horaFinDia(finDia)).getTime();
}
// ¿Este registro da XP y monedas? Solo si se marcó hasta 48 h después del fin
// de ese día. Los registros viejos (sin hora) cuentan completos.
function dentroDeVentana(reg, fecha, finDia) {
  if (!reg || reg.t == null) return true;
  return reg.t <= finDelDiaMs(fecha, finDia) + C.VENTANA_XP_HORAS * MS_HORA;
}

// ---------- Migración en lectura ----------
// Convierte un documento de Firestore (formato viejo o nuevo) al formato que
// usa el motor. No modifica el documento: los días de `done` se leen como
// "hecho" antiguos y `registros` (el formato nuevo) manda si hay ambos.
const num = (v, def) => { const x = Number(v); return v != null && v !== "" && isFinite(x) ? x : def; };
const entre = (v, a, b) => Math.min(b, Math.max(a, v));
const texto = v => (typeof v === "string" ? v : "");

function normalizarRegistro(r) {
  if (!r || typeof r !== "object") return null;
  const out = { t: num(r.t, null) };
  if (CFG.ESTADOS[r.e]) out.e = r.e;
  if (num(r.v, null) != null) out.v = Math.max(0, Number(r.v));
  if (texto(r.m)) out.m = r.m;
  if (texto(r.n)) out.n = r.n;
  return out.e || out.v != null ? out : null;
}

function normalizar(doc, id) {
  const d = doc || {};
  const tipo = CFG.TIPOS[d.tipo] ? d.tipo : "sino";
  const freqType = tipo === "evitar" ? "diario" : CFG.FRECUENCIAS.includes(d.freqType) ? d.freqType : "diario";
  const registros = {};
  (Array.isArray(d.done) ? d.done : []).forEach(f => { if (esFecha(f)) registros[f] = { e: "hecho", t: null, legado: true }; });
  Object.keys(d.registros || {}).forEach(f => {
    if (!esFecha(f)) return;
    const r = normalizarRegistro(d.registros[f]);
    if (r) registros[f] = r;
  });

  const creado = num(d.createdAt, null);
  const primera = Object.keys(registros).sort()[0] || null;
  let inicio = esFecha(d.inicio) ? d.inicio : creado != null ? isoDate(new Date(creado)) : primera;
  if (primera && (!inicio || primera < inicio)) inicio = primera;

  const medible = tipo === "medible" || tipo === "tiempo";
  return {
    _normalizado: true,
    id: id != null ? id : d.id,
    name: texto(d.name).trim() || "Hábito",
    emoji: texto(d.emoji) || "✅",
    tipo,
    freqType,
    days: Array.isArray(d.days) && d.days.length === 7 ? d.days.map(Boolean) : [true, true, true, true, true, true, true],
    timesPerWeek: entre(Math.round(num(d.timesPerWeek, C.TIMES_PER_WEEK_DEFECTO)), 1, 7),
    cadaN: entre(Math.round(num(d.cadaN, C.CADA_N_DEFECTO)), 2, C.CADA_N_MAX),
    timeOfDay: CFG.MOMENTOS.some(m => m.id === d.timeOfDay) ? d.timeOfDay : "cualquiera",
    meta: medible ? Math.max(1, num(d.meta, C.META_DEFECTO[tipo])) : 1,
    unidad: texto(d.unidad) || (tipo === "tiempo" ? "min" : ""),
    dificultad: CFG.DIFICULTADES[d.dificultad] ? d.dificultad : "media",
    area: texto(d.area) || null,
    orden: num(d.orden, creado != null ? creado : 0),
    archivado: !!d.archivado,
    archivadoEn: esFecha(d.archivadoEn) ? d.archivadoEn : null,
    pausas: (Array.isArray(d.pausas) ? d.pausas : []).filter(p => p && esFecha(p.desde) && esFecha(p.hasta) && p.desde <= p.hasta),
    despuesDe: texto(d.despuesDe) || null,
    vinculo: texto(d.vinculo) || null,
    minima: texto(d.minima),
    createdAt: creado,
    inicio,
    registros
  };
}

// ---------- Un día de un hábito ----------
function activoEn(h, f) {
  if (!h.inicio || f < h.inicio) return false;
  return !(h.archivado && (!h.archivadoEn || f >= h.archivadoEn));
}
function enPausa(h, f) {
  return h.pausas.some(p => f >= p.desde && f <= p.hasta);
}
const porSemana = h => h.freqType === "semana";

// ¿Este día toca? Solo para hábitos que se evalúan por día: los de "X veces
// por semana" nunca "tocan" un día concreto (se evalúan por semana).
// wd (0 = lunes) y n (días desde el inicio) son opcionales: el motor los pasa
// ya calculados para no convertir fechas en cada vuelta.
function tocaDia(h, f, wd, n) {
  if (!activoEn(h, f) || enPausa(h, f) || porSemana(h)) return false;
  if (h.freqType === "dias") return h.days[wd == null ? diaSemana(f) : wd];
  if (h.freqType === "cadaN") return (n == null ? diasEntre(h.inicio, f) : n) % h.cadaN === 0;
  return true;
}

// Estado efectivo del día y fracción cumplida (0–1).
function estadoDia(h, f) {
  const r = h.registros[f];
  if (h.tipo === "evitar") {
    if (r && r.e === "recaida") return { estado: "recaida", fraccion: 0, registro: r };
    if (r && r.e === "saltado") return { estado: "saltado", fraccion: 0, registro: r };
    return { estado: "hecho", fraccion: 1, registro: r || null };
  }
  if (!r) return { estado: null, fraccion: 0, registro: null };
  if (r.e === "saltado" || r.e === "no") return { estado: r.e, fraccion: 0, registro: r };
  if (r.e === "minima") return { estado: "minima", fraccion: 1, registro: r };
  if (h.tipo === "medible" || h.tipo === "tiempo") {
    if (r.v == null) return r.e === "hecho" ? { estado: "hecho", fraccion: 1, registro: r } : { estado: null, fraccion: 0, registro: r };
    const fr = Math.min(1, r.v / h.meta);
    if (fr >= 1) return { estado: "hecho", fraccion: 1, valor: r.v, registro: r };
    return { estado: fr > 0 ? "parcial" : null, fraccion: fr, valor: r.v, registro: r };
  }
  if (r.e === "parcial") return { estado: "parcial", fraccion: C.PARCIAL_SINO, registro: r };
  if (r.e === "hecho") return { estado: "hecho", fraccion: 1, registro: r };
  return { estado: null, fraccion: 0, registro: r };
}

function cumple(ed) {
  return ed.estado === "hecho" || ed.estado === "minima" ||
    (ed.estado === "parcial" && ed.fraccion >= C.PARCIAL_MANTIENE_RACHA);
}

// Clase de un día para rachas y mapas:
// cumple · extra (hecho un día que no tocaba) · fallo · pendiente (hoy, sin
// cumplir todavía) · neutral (saltado o en pausa) · noToca · fuera.
function claseDia(h, f, hoy, wd, n, estado) {
  if (!activoEn(h, f)) return "fuera";
  if (enPausa(h, f)) return "neutral";
  const ed = estado || estadoDia(h, f);
  if (ed.estado === "saltado") return "neutral";
  if (porSemana(h)) return cumple(ed) ? "cumple" : "noToca";
  if (!tocaDia(h, f, wd, n)) return cumple(ed) ? "extra" : "noToca";
  if (cumple(ed)) return "cumple";
  if (ed.estado === "recaida" || ed.estado === "no") return "fallo";
  return f >= hoy ? "pendiente" : "fallo";
}

// ---------- XP de un registro ----------
function xpBase(h) {
  return CFG.DIFICULTADES[h.dificultad].xp;
}
function bonusRacha(racha, semanal) {
  return Math.min(X.BONUS_RACHA_TOPE, racha * (semanal ? X.BONUS_RACHA_SEMANA : X.BONUS_RACHA_DIA));
}
function factorEstado(h, ed) {
  if (h.tipo === "evitar") return X.EVITAR_DIA_LIMPIO;
  if (ed.estado === "minima") return X.MINIMA;
  return ed.fraccion;
}
function xpDelDia(h, f, d, racha, finDia) {
  if (!dentroDeVentana(d.registro, f, finDia)) return 0;
  return Math.round(xpBase(h) * factorEstado(h, d) * (1 + bonusRacha(racha, porSemana(h))));
}

// ---------- Comodines ----------
// fallos: fechas en que falló algo que tocaba (ya terminadas). compras: fechas
// en que se compró cada comodín. Recorre en orden: cada compra suma uno (máximo
// COMODINES_MAX guardados) y cada día fallido consume uno si hay. Un comodín
// cubre el día entero (todos los hábitos fallados ese día).
function asignarComodines(fallos, compras) {
  const fs = Array.from(new Set(fallos)).sort();
  const cs = (compras || []).filter(esFecha).sort();
  const protegidos = new Set();
  let guardados = 0, i = 0;
  const sumar = () => { guardados = Math.min(C.COMODINES_MAX, guardados + 1); i++; };
  fs.forEach(f => {
    while (i < cs.length && cs[i] <= f) sumar();
    if (guardados > 0) { guardados--; protegidos.add(f); }
  });
  while (i < cs.length) sumar();
  return { protegidos, guardados };
}

// ---------- Nivel ----------
function xpParaNivel(n) {
  return n <= 1 ? 0 : Math.round(CFG.NIVEL.A * Math.pow(n - 1, CFG.NIVEL.B));
}
function titulo(n) {
  const t = CFG.NIVEL.TITULOS;
  return t[Math.min(t.length - 1, Math.floor(n / 5))];
}
function nivelDeXP(xp) {
  const total = Math.max(0, xp || 0);
  let n = Math.max(1, Math.floor(1 + Math.pow(total / CFG.NIVEL.A, 1 / CFG.NIVEL.B)));
  while (xpParaNivel(n + 1) <= total) n++;
  while (n > 1 && xpParaNivel(n) > total) n--;
  const desde = xpParaNivel(n), hasta = xpParaNivel(n + 1);
  return { nivel: n, xp: total, desde, hasta, progreso: (total - desde) / (hasta - desde), titulo: titulo(n) };
}

// ---------- Evaluación completa ----------
// Calendario de fechas consecutivas, construido una sola vez por cálculo:
// todos los hábitos lo recorren por posición (i) sin convertir fechas.
function calendario(desde, hasta) {
  const fechas = [], dow = [], idx = {};
  const [y, m, d] = partes(desde);
  const cur = new Date(y, m - 1, d, 12);
  let wd = diaSemana(desde);
  for (let f = desde; f <= hasta; f = isoDate(cur)) {
    idx[f] = fechas.length;
    fechas.push(f);
    dow.push(wd);
    wd = (wd + 1) % 7;
    cur.setDate(cur.getDate() + 1);
  }
  return { fechas, dow, idx };
}

// Paso A: clasifica cada día (y cada semana en los semanales).
function clasificar(h, hoy, cal) {
  const dias = {};
  const semanas = [];
  if (!h.inicio || h.inicio > hoy) return { dias, semanas };
  const i0 = cal.idx[h.inicio];
  for (let i = i0; i < cal.fechas.length; i++) {
    const f = cal.fechas[i];
    const ed = estadoDia(h, f);
    dias[f] = { clase: claseDia(h, f, hoy, cal.dow[i], i - i0, ed), estado: ed.estado, fraccion: ed.fraccion, registro: ed.registro, xp: 0 };
    if (ed.valor != null) dias[f].valor = ed.valor;
  }
  if (porSemana(h)) {
    // El calendario empieza en un lunes, así que las semanas caen alineadas.
    for (let j = cal.idx[lunesDe(h.inicio)]; j < cal.fechas.length; j += 7) {
      const lunes = cal.fechas[j];
      let hechas = 0, disponibles = 0;
      for (let k = 0; k < 7; k++) {
        const f = j + k < cal.fechas.length ? cal.fechas[j + k] : addDias(lunes, k); // días que faltan de esta semana
        if (!activoEn(h, f) || enPausa(h, f)) continue;
        const d = dias[f];
        if (d && d.estado === "saltado") continue;
        disponibles++;
        if (d && d.clase === "cumple") hechas++;
      }
      const meta = Math.min(h.timesPerWeek, disponibles);
      const domingo = j + 6 < cal.fechas.length ? cal.fechas[j + 6] : addDias(lunes, 6);
      const estado = meta === 0 ? "neutral" : hechas >= meta ? "cumple" : domingo >= hoy ? "pendiente" : "fallo";
      semanas.push({ lunes, domingo, hechas, meta, estado });
    }
  }
  return { dias, semanas };
}

// Paso B: rachas y XP, con los días cubiertos por comodines como neutrales.
function rachasYXP(h, base, protegidos, hoy, finDia) {
  let actual = 0, mejor = 0, xp = 0;
  const fechas = Object.keys(base.dias);

  if (porSemana(h)) {
    const semanaDe = {};
    base.semanas.forEach((s, si) => {
      if (s.estado === "fallo" && protegidos.has(s.domingo)) { s.estado = "neutral"; s.protegido = true; }
      s.rachaAntes = actual;
      if (s.estado === "cumple") actual++;
      else if (s.estado === "fallo") actual = 0;
      s.racha = actual;
      mejor = Math.max(mejor, actual);
      semanaDe[s.lunes] = si;
    });
    // Las fechas van en orden y cada 7 empieza una semana nueva.
    let si = -1;
    fechas.forEach(f => {
      if (semanaDe[f] != null) si = semanaDe[f];
      else if (si < 0) si = 0;
      const d = base.dias[f];
      if (d.clase !== "cumple") return;
      d.xp = xpDelDia(h, f, d, base.semanas[si].rachaAntes, finDia);
      xp += d.xp;
    });
    return { racha: { actual, mejor, unidad: "semanas" }, xp };
  }

  fechas.forEach(f => {
    const d = base.dias[f];
    if (d.clase === "fallo" && protegidos.has(f)) { d.clase = "neutral"; d.protegido = true; }
    if (d.clase === "cumple") actual++;
    else if (d.clase === "fallo") actual = 0;
    d.racha = actual;
    mejor = Math.max(mejor, actual);
    const cuenta = d.clase === "cumple" || d.clase === "extra";
    // En Evitar, el día limpio solo da XP cuando ya terminó.
    if (cuenta && !(h.tipo === "evitar" && f >= hoy)) {
      d.xp = xpDelDia(h, f, d, actual, finDia);
      xp += d.xp;
    }
  });
  return { racha: { actual, mejor, unidad: h.tipo === "evitar" ? "limpios" : "dias" }, xp };
}

// Día perfecto: se cumplió todo lo que tocaba ese día (al menos un hábito que
// no sea de Evitar) y nada quedó fallado ni pendiente. Los semanales no cuentan.
function diasPerfectos(habitos, porId, cal, finDia) {
  const out = [];
  for (const f of cal.fechas) {
    let cumplidos = 0, ok = true, aTiempo = true;
    for (const h of habitos) {
      if (porSemana(h)) continue;
      const d = porId[h.id].dias[f];
      if (!d) continue;
      if (d.clase === "fallo" || d.clase === "pendiente" || d.protegido) { ok = false; break; }
      if (d.clase === "cumple") {
        if (h.tipo !== "evitar") cumplidos++;
        if (!dentroDeVentana(d.registro, f, finDia)) aTiempo = false;
      }
    }
    if (ok && cumplidos > 0) out.push({ fecha: f, xp: aTiempo ? X.DIA_PERFECTO : 0 });
  }
  return out;
}

// docs: [{ id, ...datos de Firestore }] (o ya normalizados).
// opciones: { hoy, finDia, comodines: [fechas de compra] }
function evaluar(docs, opciones) {
  const o = opciones || {};
  const finDia = horaFinDia(o.finDia);
  const hoy = o.hoy || fechaLogica(Date.now(), finDia);
  const habitos = (docs || []).map(d => (d && d._normalizado ? d : normalizar(d, d && d.id)));

  const inicios = habitos.map(h => h.inicio).filter(f => f && f <= hoy).sort();
  const cal = calendario(lunesDe(inicios[0] || hoy), hoy);
  const base = {};
  habitos.forEach(h => { base[h.id] = clasificar(h, hoy, cal); });

  const fallos = [];
  habitos.forEach(h => {
    const b = base[h.id];
    if (porSemana(h)) b.semanas.forEach(s => { if (s.estado === "fallo") fallos.push(s.domingo); });
    else Object.keys(b.dias).forEach(f => { if (b.dias[f].clase === "fallo" && f < hoy) fallos.push(f); });
  });
  const com = asignarComodines(fallos, o.comodines);

  const porId = {};
  let xpHabitos = 0;
  habitos.forEach(h => {
    const b = base[h.id];
    const r = rachasYXP(h, b, com.protegidos, hoy, finDia);
    xpHabitos += r.xp;
    const semanaActual = porSemana(h) ? b.semanas[b.semanas.length - 1] || null : null;
    porId[h.id] = { habito: h, dias: b.dias, semanas: b.semanas, racha: r.racha, xp: r.xp, hoy: b.dias[hoy] || null, semanaActual };
  });

  const perfectos = diasPerfectos(habitos, porId, cal, finDia);
  const xpPerfectos = perfectos.reduce((s, p) => s + p.xp, 0);
  const xpTotal = xpHabitos + xpPerfectos;

  return {
    hoy, finDia, habitos: porId,
    comodines: { protegidos: Array.from(com.protegidos).sort(), guardados: com.guardados },
    diasPerfectos: perfectos,
    xp: xpTotal,
    nivel: nivelDeXP(xpTotal),
    monedasGanadas: Math.floor(xpTotal * X.MONEDAS_POR_XP)
  };
}

// ---------- Resúmenes para las pantallas ----------
// % de cumplimiento de un hábito entre dos fechas: cumplidos / (cumplidos +
// fallados), por día o por semana. null si no hubo nada que evaluar.
function cumplimiento(rh, desde, hasta) {
  let ok = 0, total = 0;
  const contar = clase => { if (clase === "cumple") { ok++; total++; } else if (clase === "fallo") total++; };
  if (porSemana(rh.habito)) rh.semanas.forEach(s => { if (s.domingo >= desde && s.lunes <= hasta) contar(s.estado); });
  else Object.keys(rh.dias).forEach(f => { if (f >= desde && f <= hasta) contar(rh.dias[f].clase); });
  return total ? ok / total : null;
}

// Un día de todos los hábitos: cuántos se cumplieron de los que tocaban.
function resumenDia(res, f) {
  let hechos = 0, esperados = 0;
  Object.keys(res.habitos).forEach(id => {
    const d = res.habitos[id].dias[f];
    if (!d) return;
    if (d.clase === "cumple") { hechos++; esperados++; }
    else if (d.clase === "fallo" || d.clase === "pendiente") esperados++;
  });
  return { hechos, esperados };
}

return {
  cumplimiento, resumenDia,
  CFG, isoDate, addDias, diasEntre, diaSemana, lunesDe, semanaId, fechaLogica, finDelDiaMs,
  dentroDeVentana, normalizar, activoEn, enPausa, tocaDia, estadoDia, cumple, claseDia,
  asignarComodines, xpParaNivel, nivelDeXP, titulo, evaluar
};
});
