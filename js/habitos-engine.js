// ---------- Hábitos: motor de cálculo (lógica pura, sin DOM ni Firebase) ----------
// Todo se recalcula desde el historial de cada hábito: qué días tocaban, el
// estado de cada día, rachas (en días o en semanas), comodines usados, días
// perfectos, XP, nivel y monedas ganadas. Así, desmarcar o corregir un día
// siempre deja todo coherente. Las constantes salen de js/habitos-config.js.
// Tests: tests/habitos-engine.test.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./habitos-config.js"), require("./rangos-config.js"));
  else root.HabitosEngine = factory(root.HabitosConfig, root.RangosConfig);
})(typeof self !== "undefined" ? self : this, function (CFG, RC) {

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
function xpParaNivel(n, curva) {
  const c = curva || CFG.NIVEL;
  return n <= 1 ? 0 : Math.round(c.A * Math.pow(n - 1, c.B));
}
function titulo(n) {
  const t = CFG.NIVEL.TITULOS;
  return t[Math.min(t.length - 1, Math.floor(n / 5))];
}
function nivelDeXP(xp, curva) {
  const c = curva || CFG.NIVEL;
  const total = Math.max(0, xp || 0);
  let n = Math.max(1, Math.floor(1 + Math.pow(total / c.A, 1 / c.B)));
  while (xpParaNivel(n + 1, c) <= total) n++;
  while (n > 1 && xpParaNivel(n, c) > total) n--;
  const desde = xpParaNivel(n, c), hasta = xpParaNivel(n + 1, c);
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
  const compras = Array.isArray(o.compras) ? o.compras : [];
  const comodines = o.comodines || compras.filter(c => c && c.que === "comodin" && c.t).map(c => fechaLogica(c.t, finDia));
  const com = asignarComodines(fallos, comodines);

  const porId = {};
  let xpHabitos = 0;
  habitos.forEach(h => {
    const b = base[h.id];
    const r = rachasYXP(h, b, com.protegidos, hoy, finDia);
    xpHabitos += r.xp;
    const semanaActual = porSemana(h) ? b.semanas[b.semanas.length - 1] || null : null;
    porId[h.id] = { habito: h, dias: b.dias, semanas: b.semanas, racha: r.racha, xp: r.xp, hoy: b.dias[hoy] || null, semanaActual };
    porId[h.id].rango = fuerzaHabito(h, porId[h.id], hoy);
  });

  const perfectos = diasPerfectos(habitos, porId, cal, finDia);
  const xpPerfectos = perfectos.reduce((s, p) => s + p.xp, 0);
  const res = {
    hoy, finDia, habitos: porId,
    comodines: { protegidos: Array.from(com.protegidos).sort(), guardados: com.guardados, compradosTotal: comodines.length },
    diasPerfectos: perfectos
  };
  res.misiones = evaluarMisiones(res, o.misiones);
  const mis = res.misiones.filter(m => m.estado === "completada");
  const xpMisiones = mis.reduce((s, m) => s + m.xp, 0);
  const xpTotal = xpHabitos + xpPerfectos + xpMisiones;
  const ganadas = Math.floor((xpHabitos + xpPerfectos) * X.MONEDAS_POR_XP) + mis.reduce((s, m) => s + m.monedas, 0);
  const gastadas = compras.reduce((s, c) => s + (Number(c && c.precio) || 0), 0);
  res.xp = xpTotal;
  res.xpDesglose = { habitos: xpHabitos, perfectos: xpPerfectos, misiones: xpMisiones };
  res.nivel = nivelDeXP(xpTotal);
  res.monedas = { ganadas, gastadas, saldo: ganadas - gastadas };
  res.monedasGanadas = ganadas;
  res.areas = calcularAreas(res, o.areas || CFG.AREAS);
  res.logros = calcularLogros(res, { compras, habitos });
  return res;
}

// ---------- Rango por hábito: fuerza → percentil → división ----------
const ROMANOS = ["I", "II", "III"];
const NIVELES = [];
RC.RANGOS.forEach((r, ri) => {
  const rango = Object.assign({}, r, { nombre: CFG.RANGO_NOMBRES[r.id] || r.nombre });
  r.minimos.forEach((min, di) => {
    const con = r.minimos.length > 1;
    NIVELES.push({ idx: NIVELES.length, rango, rangoIdx: ri, division: con ? di + 1 : 0, min, nombre: rango.nombre + (con ? " " + ROMANOS[di] : "") });
  });
});
const ULTIMO = NIVELES.length - 1;

function nivelPorP(P) {
  let idx = 0;
  for (const n of NIVELES) if (P >= n.min) idx = n.idx;
  return idx;
}
function percentilFuerza(f) {
  const c = CFG.FUERZA.CURVA;
  for (let i = 1; i < c.length; i++) {
    const [x0, y0] = c[i - 1], [x1, y1] = c[i];
    if (f <= x1) return y0 + (y1 - y0) * (f - x0) / (x1 - x0);
  }
  return c[c.length - 1][1];
}
// Días promedio entre una vez que toca y la siguiente.
function intervalo(h) {
  if (h.freqType === "dias") return 7 / Math.max(1, h.days.filter(Boolean).length);
  if (h.freqType === "cadaN") return h.cadaN;
  if (h.freqType === "semana") return 7;
  return 1;
}
function alfas(h) {
  const F = CFG.FUERZA, k = intervalo(h);
  return { k, sube: 1 - Math.pow(1 - F.ALFA_SUBE, k), baja: 1 - Math.pow(1 - F.ALFA_BAJA, k) };
}
function percentilConTope(f, evaluados) {
  const P = percentilFuerza(f);
  return evaluados < CFG.FUERZA.MIN_DIAS_MAXIMO ? Math.min(P, NIVELES[ULTIMO].min - 0.01) : P;
}

// Recorre los días (o semanas) evaluados del hábito. Solo cuentan los días que
// tocaban; saltados y pausas no mueven la fuerza; un comodín protege la
// racha, no la fuerza.
function fuerzaHabito(h, rh, hoy) {
  const F = CFG.FUERZA;
  const a = alfas(h);
  let f = 0, P = 0, nivel = null, escudo = 0, evaluados = 0;
  const serie = [];
  const paso = (fecha, x) => {
    f = x >= f ? f + a.sube * (x - f) : f + a.baja * (x - f);
    evaluados += a.k;
    P = percentilConTope(f, evaluados);
    const protegido = escudo > 0;
    if (protegido) escudo--;
    let nuevo = nivelPorP(P);
    if (nivel != null && nuevo < nivel && (protegido || P >= NIVELES[nivel].min - F.HISTERESIS)) nuevo = nivel;
    if (nivel != null && nuevo > nivel) escudo = F.ESCUDO;
    nivel = nuevo;
    serie.push({ fecha, fuerza: f, P, nivel });
  };
  const valor = d => 100 * (d.estado === "minima" ? F.MINIMA : Math.min(1, d.fraccion || 0));

  if (porSemana(h)) {
    rh.semanas.forEach(s => {
      const evaluable = s.estado === "cumple" || s.estado === "fallo" || s.protegido;
      if (!evaluable || s.meta === 0) return;
      paso(s.domingo <= hoy ? s.domingo : hoy, 100 * Math.min(1, s.hechas / s.meta));
    });
  } else {
    Object.keys(rh.dias).forEach(fe => {
      const d = rh.dias[fe];
      if (h.tipo === "evitar" && fe >= hoy) return;
      if (d.clase === "cumple" || d.clase === "fallo" || d.protegido) paso(fe, valor(d));
    });
  }
  if (nivel == null) return { tieneRango: false, fuerza: 0, P: 0, nivel: null, escudo: 0, serie, evaluados };
  const cur = NIVELES[nivel], sig = NIVELES[nivel + 1] || null;
  const avance = sig ? Math.max(0, Math.min(1, (P - cur.min) / (sig.min - cur.min))) : 1;
  const limite14 = addDias(hoy, -14);
  const hace14 = serie.filter(x => x.fecha <= limite14).pop();
  return {
    tieneRango: true, fuerza: f, P, nivel, escudo, serie, evaluados, siguiente: sig, avance,
    tendencia: hace14 ? f - hace14.fuerza : null,
    faltaHistoria: sig && sig.idx === ULTIMO && percentilFuerza(f) >= sig.min && evaluados < F.MIN_DIAS_MAXIMO
  };
}

// Nivel del rango en una fecha (el último evaluado hasta ese día).
function rangoEn(rh, fecha) {
  let n = null;
  for (const x of rh.rango.serie) { if (x.fecha > fecha) break; n = x.nivel; }
  return n;
}
// ¿Una semana perfecta desde hoy lo sube de división?
function subiriaConSemanaPerfecta(rh) {
  const r = rh.rango;
  const f = 100 - (100 - r.fuerza) * Math.pow(1 - CFG.FUERZA.ALFA_SUBE, 7);
  const actual = r.tieneRango ? r.nivel : -1;
  const nuevo = nivelPorP(percentilConTope(f, r.evaluados + 7));
  return nuevo > actual ? nuevo : null;
}

// ---------- Áreas de vida ----------
function calcularAreas(res, defs) {
  return defs.map(a => {
    const hs = Object.keys(res.habitos).map(id => res.habitos[id]).filter(rh => rh.habito.area === a.id);
    const xp = hs.reduce((s, rh) => s + rh.xp, 0);
    return Object.assign({ id: a.id, nombre: a.nombre, habitos: hs.filter(rh => !rh.habito.archivado).length, xp }, { nivel: nivelDeXP(xp, CFG.AREA_NIVEL) });
  });
}

// ---------- Misiones semanales ----------
// Se generan cada lunes con tus datos de las semanas anteriores (un poco por
// encima de tu promedio) y se guardan; su progreso se recalcula siempre.
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function vecesPorSemanaPosibles(h) {
  if (h.freqType === "semana") return h.timesPerWeek;
  if (h.freqType === "dias") return h.days.filter(Boolean).length;
  if (h.freqType === "cadaN") return Math.max(1, Math.floor(7 / h.cadaN));
  return 7;
}
function contarEn(rh, desde, hasta) {
  let n = 0;
  Object.keys(rh.dias).forEach(f => { if (f >= desde && f <= hasta && (rh.dias[f].clase === "cumple" || rh.dias[f].clase === "extra")) n++; });
  return n;
}

function generarMisiones(res, lunes) {
  const M = CFG.MISIONES;
  const semana = semanaId(lunes);
  const desde = addDias(lunes, -7 * M.SEMANAS_BASE), hasta = addDias(lunes, -1);
  const semilla = hash(semana);
  const candidatos = Object.keys(res.habitos).map(id => res.habitos[id])
    .filter(rh => !rh.habito.archivado && rh.habito.tipo !== "evitar" && rh.habito.inicio && rh.habito.inicio <= addDias(lunes, 6))
    .sort((a, b) => a.habito.orden - b.habito.orden);
  const out = [];
  const base = { semana, lunes, xp: M.XP, monedas: M.MONEDAS };

  // 1) Cumplir un hábito X veces
  if (candidatos.length) {
    const opciones = candidatos.map(rh => {
      const max = vecesPorSemanaPosibles(rh.habito);
      const promedio = contarEn(rh, desde, hasta) / M.SEMANAS_BASE;
      return { rh, max, meta: Math.min(max, Math.max(2, Math.ceil(promedio * M.EXIGENCIA))), margen: max - promedio };
    }).filter(x => x.meta >= 2 || x.max < 2).sort((a, b) => b.margen - a.margen);
    const top = opciones.slice(0, 3);
    if (top.length) {
      const x = top[semilla % top.length];
      out.push(Object.assign({ id: `${semana}-veces`, tipo: "veces", habito: x.rh.habito.id, meta: Math.max(1, x.meta),
        titulo: `Cumple «${x.rh.habito.name}» ${Math.max(1, x.meta)} ${Math.max(1, x.meta) === 1 ? "vez" : "veces"}` }, base));
    }
  }
  // 2) Días perfectos
  const perfectosAntes = res.diasPerfectos.filter(p => p.fecha >= desde && p.fecha <= hasta).length / M.SEMANAS_BASE;
  const nPerf = Math.min(5, Math.max(1, Math.ceil(perfectosAntes * M.EXIGENCIA)));
  out.push(Object.assign({ id: `${semana}-perfectos`, tipo: "perfectos", meta: nPerf,
    titulo: `Logra ${nPerf} ${nPerf === 1 ? "día perfecto" : "días perfectos"}` }, base));
  // 3) Subir un hábito de división (o, si ninguno puede, sumar registros)
  const usado = out[0] && out[0].habito;
  const subibles = candidatos.map(rh => ({ rh, a: subiriaConSemanaPerfecta(rh) })).filter(x => x.a != null)
    .sort((a, b) => (a.rh.habito.id === usado) - (b.rh.habito.id === usado) || b.a - a.a);
  if (subibles.length) {
    const x = subibles[0];
    out.push(Object.assign({ id: `${semana}-rango`, tipo: "rango", habito: x.rh.habito.id, meta: x.a,
      titulo: `Sube «${x.rh.habito.name}» a ${NIVELES[x.a].nombre}` }, base));
  } else {
    const total = candidatos.reduce((s, rh) => s + contarEn(rh, desde, hasta), 0) / M.SEMANAS_BASE;
    const n = Math.max(3, Math.ceil(total * M.EXIGENCIA));
    out.push(Object.assign({ id: `${semana}-total`, tipo: "total", meta: n, titulo: `Suma ${n} registros esta semana` }, base));
  }
  return out.slice(0, M.POR_SEMANA);
}

function progresoMision(res, m) {
  const hasta = addDias(m.lunes, 6) < res.hoy ? addDias(m.lunes, 6) : res.hoy;
  const rh = m.habito && res.habitos[m.habito];
  if (m.tipo === "veces") return rh ? contarEn(rh, m.lunes, hasta) : 0;
  if (m.tipo === "perfectos") return res.diasPerfectos.filter(p => p.fecha >= m.lunes && p.fecha <= hasta).length;
  if (m.tipo === "total") return Object.keys(res.habitos).reduce((s, id) => s + contarEn(res.habitos[id], m.lunes, hasta), 0);
  if (m.tipo === "rango") { const n = rh ? rangoEn(rh, hasta) : null; return n != null && n >= m.meta ? 1 : 0; }
  return 0;
}
// misiones: { "2026-W40": [definiciones] }
function evaluarMisiones(res, misiones) {
  const out = [];
  Object.keys(misiones || {}).sort().forEach(sem => (misiones[sem] || []).forEach(m => {
    if (!m || !m.lunes || m.lunes > res.hoy) return;
    const actual = progresoMision(res, m);
    const meta = m.tipo === "rango" ? 1 : m.meta;
    const terminada = addDias(m.lunes, 6) < res.hoy;
    const estado = actual >= meta ? "completada" : terminada ? "fallida" : "enCurso";
    out.push(Object.assign({}, m, { actual: Math.min(actual, meta), metaProgreso: meta, estado, xp: m.xp || CFG.MISIONES.XP, monedas: m.monedas || CFG.MISIONES.MONEDAS }));
  }));
  return out;
}

// ---------- Logros ----------
function calcularLogros(res, extra) {
  const lista = Object.keys(res.habitos).map(id => res.habitos[id]);
  const normales = lista.filter(rh => rh.habito.tipo !== "evitar");
  const horas = [];
  let registros = 0, nuncaDos = 0, regreso = 0;
  normales.forEach(rh => {
    let previo = null;
    const conPausas = rh.habito.pausas.length > 0;
    Object.keys(rh.dias).forEach(f => {
      const d = rh.dias[f];
      if (d.clase === "cumple" || d.clase === "extra") {
        registros++;
        const t = d.registro && d.registro.t;
        if (t) horas.push(new Date(t).getHours());
        if (d.clase === "cumple" && previo === "fallo") nuncaDos++;
        if (conPausas && enPausa(rh.habito, addDias(f, -1)) && !enPausa(rh.habito, f)) regreso++;
      }
      if (d.clase === "cumple" || d.clase === "fallo") previo = d.clase;
    });
  });
  const perf = new Set(res.diasPerfectos.map(p => p.fecha));
  let semanaPerfecta = 0, mesPerfecto = 0;
  perf.forEach(f => {
    if (diaSemana(f) === 0 && [1, 2, 3, 4, 5, 6].every(i => perf.has(addDias(f, i)))) semanaPerfecta = 1;
    if (f.endsWith("-01")) {
      const [y, m] = partes(f);
      const n = new Date(y, m, 0).getDate();
      const fin = `${f.slice(0, 8)}${pad(n)}`;
      if (fin < res.hoy && Array.from({ length: n }, (_, i) => addDias(f, i)).every(x => perf.has(x))) mesPerfecto = 1;
    }
  });
  const semanasAreas = {};
  const lunesCache = new Map();
  const lunesMemo = f => { let l = lunesCache.get(f); if (!l) { l = lunesDe(f); lunesCache.set(f, l); } return l; };
  normales.forEach(rh => {
    if (!rh.habito.area) return;
    Object.keys(rh.dias).forEach(f => {
      if (rh.dias[f].clase !== "cumple" && rh.dias[f].clase !== "extra") return;
      const w = lunesMemo(f);
      (semanasAreas[w] = semanasAreas[w] || new Set()).add(rh.habito.area);
    });
  });
  const maxNivel = lista.reduce((m, rh) => Math.max(m, rh.rango.tieneRango ? rh.rango.nivel : -1), -1);
  const primerDe = id => NIVELES.find(n => n.rango.id === id).idx;
  const valores = {
    registros,
    racha: normales.filter(rh => rh.racha.unidad === "dias").reduce((m, rh) => Math.max(m, rh.racha.mejor), 0),
    perfectos: res.diasPerfectos.length,
    semanaPerfecta, mesPerfecto, nuncaDos,
    madrugador: horas.filter(h => h >= 4 && h < 7).length,
    noctambulo: horas.filter(h => h < 4).length,
    habitos: lista.filter(rh => !rh.habito.archivado).length,
    equilibrio: Object.values(semanasAreas).reduce((m, s) => Math.max(m, s.size), 0),
    nivel: res.nivel.nivel,
    misiones: res.misiones.filter(m => m.estado === "completada").length,
    ahorro: res.monedas.ganadas,
    canje: (extra.compras || []).filter(c => c && c.que === "recompensa").length,
    limpios: lista.filter(rh => rh.habito.tipo === "evitar").reduce((m, rh) => Math.max(m, rh.racha.mejor), 0),
    semanal: lista.filter(rh => rh.racha.unidad === "semanas").reduce((m, rh) => Math.max(m, rh.racha.mejor), 0),
    regreso
  };
  return CFG.LOGROS.map(l => {
    let actual, meta;
    if (l.tipo === "rango") { meta = primerDe(l.meta); actual = Math.max(0, maxNivel); }
    else { meta = l.meta; actual = valores[l.tipo] || 0; }
    const desbloqueado = actual >= meta;
    return Object.assign({}, l, { actual: Math.min(actual, meta), metaProgreso: meta, desbloqueado, progreso: meta ? Math.min(1, actual / meta) : 0 });
  });
}

// ---------- Novedades para celebrar (se comparan con un snapshot guardado) ----------
function snapshot(res) {
  const rangos = {};
  Object.keys(res.habitos).forEach(id => { const r = res.habitos[id].rango; if (r.tieneRango && !res.habitos[id].habito.archivado) rangos[id] = r.nivel; });
  return {
    nivel: res.nivel.nivel,
    rangos,
    logros: res.logros.filter(l => l.desbloqueado).map(l => l.id).sort(),
    misiones: res.misiones.filter(m => m.estado === "completada").map(m => m.id).sort(),
    perfectos: res.diasPerfectos.filter(p => p.fecha >= addDias(res.hoy, -1)).map(p => p.fecha)
  };
}
// Solo lo que subió o apareció desde el snapshot anterior.
function novedades(anterior, actual) {
  if (!anterior) return [];
  const out = [];
  if (actual.nivel > (anterior.nivel || 0)) out.push({ tipo: "nivel", antes: anterior.nivel, despues: actual.nivel });
  Object.keys(actual.rangos).forEach(id => {
    const antes = (anterior.rangos || {})[id];
    if (antes == null || actual.rangos[id] > antes) out.push({ tipo: "rango", id, antes: antes == null ? null : antes, despues: actual.rangos[id] });
  });
  const logrosAntes = new Set(anterior.logros || []);
  actual.logros.forEach(id => { if (!logrosAntes.has(id)) out.push({ tipo: "logro", id }); });
  const misAntes = new Set(anterior.misiones || []);
  actual.misiones.forEach(id => { if (!misAntes.has(id)) out.push({ tipo: "mision", id }); });
  const perfAntes = new Set(anterior.perfectos || []);
  actual.perfectos.forEach(f => { if (!perfAntes.has(f)) out.push({ tipo: "perfecto", fecha: f }); });
  return out;
}

// Snapshot que se guarda: recuerda lo ya celebrado aunque hoy no aparezca
// (hábito borrado o archivado, logro que dejó de cumplirse, nivel que bajó al
// desmarcar). Así, restaurar o volver a marcar no repite la celebración.
function fusionarSnapshot(anterior, actual, hoy) {
  if (!anterior) return actual;
  const rangos = Object.assign({}, anterior.rangos || {});
  Object.keys(actual.rangos).forEach(id => { rangos[id] = Math.max(rangos[id] == null ? 0 : rangos[id], actual.rangos[id]); });
  const union = (a, b) => Array.from(new Set((a || []).concat(b || []))).sort();
  const semana = semanaId(hoy);
  return {
    nivel: Math.max(anterior.nivel || 0, actual.nivel),
    rangos,
    logros: union(anterior.logros, actual.logros),
    misiones: union(anterior.misiones, actual.misiones).filter(id => id.indexOf(semana) === 0),
    perfectos: union(anterior.perfectos, actual.perfectos).filter(f => f >= addDias(hoy, -1))
  };
}

// ---------- Estadísticas ----------
// Índice día a día (se arma una vez por cálculo): hechos y esperados de todos
// los hábitos, con sumas acumuladas para responder cualquier periodo al
// instante. Los semanales cuentan por semana (meta y veces hechas) el domingo.
const PERIODOS = { "7d": 7, "30d": 30, "90d": 90, anio: 365 };

function indice(res) {
  if (res._indice) return res._indice;
  const lista = Object.keys(res.habitos).map(id => res.habitos[id]);
  const inicios = lista.map(rh => rh.habito.inicio).filter(f => f && f <= res.hoy).sort();
  const desde = inicios[0] || res.hoy;
  const n = diasEntre(desde, res.hoy) + 1;
  const fechas = new Array(n), pos = {};
  for (let i = 0, f = desde; i < n; i++, f = addDias(f, 1)) { fechas[i] = f; pos[f] = i; }
  const hechos = new Float64Array(n), esperados = new Float64Array(n), xp = new Float64Array(n);
  lista.forEach(rh => {
    const semanal = porSemana(rh.habito);
    Object.keys(rh.dias).forEach(f => {
      const i = pos[f];
      if (i == null) return;
      const d = rh.dias[f];
      xp[i] += d.xp || 0;
      if (semanal) return;
      if (d.clase === "cumple") { hechos[i]++; esperados[i]++; }
      else if (d.clase === "fallo") esperados[i]++;
    });
    if (semanal) rh.semanas.forEach(sm => {
      if (sm.estado !== "cumple" && sm.estado !== "fallo") return;
      const i = pos[sm.domingo <= res.hoy ? sm.domingo : res.hoy];
      if (i == null) return;
      hechos[i] += Math.min(sm.hechas, sm.meta);
      esperados[i] += sm.meta;
    });
  });
  res.diasPerfectos.forEach(p => { const i = pos[p.fecha]; if (i != null) xp[i] += p.xp; });
  (res.misiones || []).forEach(m => {
    if (m.estado !== "completada") return;
    const dom = addDias(m.lunes, 6);
    const i = pos[dom <= res.hoy ? dom : res.hoy];
    if (i != null) xp[i] += m.xp;
  });
  const acum = arr => { const a = new Float64Array(n + 1); for (let i = 0; i < n; i++) a[i + 1] = a[i] + arr[i]; return a; };
  res._indice = { desde, fechas, pos, dow0: diaSemana(desde), hechos, esperados, xp, H: acum(hechos), E: acum(esperados), X: acum(xp) };
  return res._indice;
}
// Fechas del periodo (sin convertir fechas: salen del índice).
function fechasRango(ix, desde, hasta) {
  const a = desde < ix.desde ? 0 : ix.pos[desde];
  const b = hasta > ix.fechas[ix.fechas.length - 1] ? ix.fechas.length - 1 : ix.pos[hasta];
  if (a == null || b == null || b < a) return { lista: [], a: 0 };
  return { lista: ix.fechas.slice(a, b + 1), a };
}
// Suma de un periodo [desde, hasta] con las sumas acumuladas.
function sumaRango(ix, A, desde, hasta) {
  const a = desde < ix.desde ? 0 : ix.pos[desde];
  const b = hasta > ix.fechas[ix.fechas.length - 1] ? ix.fechas.length - 1 : ix.pos[hasta];
  if (a == null || b == null || b < a) return 0;
  return A[b + 1] - A[a];
}

function periodo(clave, hoy, inicio) {
  const n = PERIODOS[clave];
  if (!n) return { clave, desde: inicio || hoy, hasta: hoy, previo: null };
  const desde = addDias(hoy, -(n - 1));
  return { clave, desde, hasta: hoy, previo: { desde: addDias(desde, -n), hasta: addDias(desde, -1) } };
}

function cumplimientoGlobal(res, desde, hasta) {
  const ix = indice(res);
  const hechos = sumaRango(ix, ix.H, desde, hasta), esperados = sumaRango(ix, ix.E, desde, hasta);
  return { hechos, esperados, pct: esperados ? hechos / esperados : null };
}

function kpis(res, per) {
  const ix = indice(res);
  const calc = (desde, hasta) => {
    const c = cumplimientoGlobal(res, desde, hasta);
    return {
      pct: c.pct, hechos: c.hechos, esperados: c.esperados,
      perfectos: res.diasPerfectos.filter(p => p.fecha >= desde && p.fecha <= hasta).length,
      xp: Math.round(sumaRango(ix, ix.X, desde, hasta))
    };
  };
  const actual = calc(per.desde, per.hasta);
  const previo = per.previo ? calc(per.previo.desde, per.previo.hasta) : null;
  let mejor = null;
  Object.keys(res.habitos).forEach(id => {
    const rh = res.habitos[id];
    if (rh.habito.archivado || rh.racha.unidad !== "dias") return;
    if (!mejor || rh.racha.actual > mejor.racha) mejor = { id, racha: rh.racha.actual };
  });
  const activos = Object.keys(res.habitos).filter(id => !res.habitos[id].habito.archivado && res.habitos[id].habito.inicio && res.habitos[id].habito.inicio <= per.hasta).length;
  return { actual, previo, mejorRacha: mejor, activos };
}

// Cumplimiento por semana (lunes a domingo) con media móvil de `ventana` semanas.
function serieSemanal(res, semanas, ventana) {
  const ix = indice(res);
  const out = [];
  let lunes = addDias(lunesDe(res.hoy), -7 * (semanas - 1));
  for (let i = 0; i < semanas; i++, lunes = addDias(lunes, 7)) {
    const domingo = addDias(lunes, 6);
    if (domingo < ix.desde) continue;
    const h = sumaRango(ix, ix.H, lunes, domingo), e = sumaRango(ix, ix.E, lunes, domingo);
    out.push({ lunes, domingo, hechos: h, esperados: e, pct: e ? h / e : null, actual: domingo >= res.hoy });
  }
  const v = ventana || 4;
  out.forEach((s, i) => {
    const tramo = out.slice(Math.max(0, i - v + 1), i + 1);
    const e = tramo.reduce((a, x) => a + x.esperados, 0);
    s.media = e ? tramo.reduce((a, x) => a + x.hechos, 0) / e : null;
  });
  return out;
}

// Días evaluados (cumple/fallo) de los hábitos que se evalúan por día.
function recorrerDias(res, desde, hasta, filtro, fn) {
  const ix = indice(res);
  const { lista, a } = fechasRango(ix, desde, hasta);
  Object.keys(res.habitos).forEach(id => {
    const rh = res.habitos[id];
    if (porSemana(rh.habito) || (filtro && !filtro(rh))) return;
    for (let k = 0; k < lista.length; k++) {
      const d = rh.dias[lista[k]];
      if (d && (d.clase === "cumple" || d.clase === "fallo")) fn(rh, lista[k], d.clase === "cumple", (ix.dow0 + a + k) % 7);
    }
  });
}
function porDiaSemana(res, desde, hasta, filtro) {
  const b = Array.from({ length: 7 }, () => ({ hechos: 0, esperados: 0 }));
  recorrerDias(res, desde, hasta, filtro, (rh, f, ok, wd) => { const x = b[wd]; x.esperados++; if (ok) x.hechos++; });
  b.forEach(x => { x.pct = x.esperados ? x.hechos / x.esperados : null; });
  return b;
}
function porMomento(res, desde, hasta) {
  const b = {};
  CFG.MOMENTOS.forEach(m => { b[m.id] = { hechos: 0, esperados: 0 }; });
  recorrerDias(res, desde, hasta, null, (rh, f, ok) => { const x = b[rh.habito.timeOfDay]; x.esperados++; if (ok) x.hechos++; });
  Object.keys(b).forEach(k => { b[k].pct = b[k].esperados ? b[k].hechos / b[k].esperados : null; });
  return b;
}
// % de cada área en el periodo (hábitos diarios por día; semanales por semana).
function areasPeriodo(res, desde, hasta, defs) {
  return (defs || CFG.AREAS).map(a => {
    let h = 0, e = 0;
    Object.keys(res.habitos).forEach(id => {
      const rh = res.habitos[id];
      if (rh.habito.area !== a.id) return;
      if (porSemana(rh.habito)) rh.semanas.forEach(s => {
        if (s.domingo < desde || s.domingo > hasta || (s.estado !== "cumple" && s.estado !== "fallo")) return;
        h += Math.min(s.hechas, s.meta); e += s.meta;
      });
      else Object.keys(rh.dias).forEach(f => {
        if (f < desde || f > hasta) return;
        const c = rh.dias[f].clase;
        if (c === "cumple") { h++; e++; } else if (c === "fallo") e++;
      });
    });
    return { id: a.id, nombre: a.nombre, hechos: h, esperados: e, pct: e ? h / e : null };
  });
}

function ranking(res) {
  return Object.keys(res.habitos).map(id => res.habitos[id]).filter(rh => !rh.habito.archivado)
    .map(rh => ({ id: rh.habito.id, fuerza: rh.rango.fuerza, nivel: rh.rango.nivel, tieneRango: rh.rango.tieneRango, tendencia: rh.rango.tendencia }))
    .sort((a, b) => b.fuerza - a.fuerza);
}

// Hábitos en riesgo: racha en juego hoy, "nunca dos veces", semana que no
// alcanza o fuerza bajando. Ordenados por urgencia.
function enRiesgo(res) {
  const out = [];
  const ayer = addDias(res.hoy, -1);
  Object.keys(res.habitos).forEach(id => {
    const rh = res.habitos[id], h = rh.habito;
    if (h.archivado) return;
    if (porSemana(h)) {
      const s = rh.semanaActual;
      if (s && s.estado === "pendiente") {
        const quedan = 6 - diaSemana(res.hoy) + 1, faltan = s.meta - s.hechas;
        if (faltan >= quedan) out.push({ id, tipo: "semana", urgencia: faltan > quedan ? 2 : 3, faltan, quedan });
      }
    } else if (h.tipo !== "evitar") {
      const hoyD = rh.dias[res.hoy], ayerD = rh.dias[ayer];
      if (hoyD && hoyD.clase === "pendiente" && ayerD && ayerD.clase === "fallo") out.push({ id, tipo: "nuncaDos", urgencia: 4 });
      else if (hoyD && hoyD.clase === "pendiente" && rh.racha.actual >= 3) out.push({ id, tipo: "racha", urgencia: 2 + Math.min(1, rh.racha.actual / 30), racha: rh.racha.actual });
    }
    const t = rh.rango.tendencia;
    if (t != null && t <= -3 && !out.some(x => x.id === id)) out.push({ id, tipo: "fuerza", urgencia: 1 + Math.min(1, -t / 10), caida: -t });
  });
  return out.sort((a, b) => b.urgencia - a.urgencia);
}

// ---------- Correlaciones (solo con suficientes datos; son coincidencias) ----------
function media(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
function correlaciones(res, dias, opciones) {
  const o = Object.assign({ minDias: 14, minMuestras: 3, ventana: 90 }, opciones);
  const animos = {};
  Object.keys(dias || {}).forEach(f => { const a = Number(dias[f] && dias[f].animo); if (a >= 1 && a <= 5 && f <= res.hoy) animos[f] = a; });
  const nAnimo = Object.keys(animos).length;
  const out = { diasConAnimo: nAnimo, animo: [], juntos: [], suficiente: nAnimo >= o.minDias };
  const desde = addDias(res.hoy, -(o.ventana - 1));
  const lista = Object.keys(res.habitos).map(id => res.habitos[id]).filter(rh => !rh.habito.archivado && !porSemana(rh.habito) && rh.habito.tipo !== "evitar");
  if (out.suficiente) {
    lista.forEach(rh => {
      const con = [], sin = [];
      Object.keys(animos).forEach(f => { const d = rh.dias[f]; if (!d) return; if (d.clase === "cumple") con.push(animos[f]); else if (d.clase === "fallo") sin.push(animos[f]); });
      if (con.length >= o.minMuestras && sin.length >= o.minMuestras) out.animo.push({ id: rh.habito.id, con: media(con), sin: media(sin), diferencia: media(con) - media(sin), n: con.length + sin.length });
    });
    out.animo.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
  }
  // Hábitos que suelen ir juntos: P(B | A) contra P(B), en los días que tocaban ambos.
  const ventana = fechasRango(indice(res), desde, res.hoy).lista;
  for (let i = 0; i < lista.length; i++) for (let j = 0; j < lista.length; j++) {
    if (i === j) continue;
    const A = lista[i], B = lista[j];
    let n = 0, nA = 0, nB = 0, nAB = 0;
    ventana.forEach(f => {
      const a = A.dias[f], b = B.dias[f];
      if (!a) return;
      if (!b || (a.clase !== "cumple" && a.clase !== "fallo") || (b.clase !== "cumple" && b.clase !== "fallo")) return;
      n++;
      if (a.clase === "cumple") nA++;
      if (b.clase === "cumple") nB++;
      if (a.clase === "cumple" && b.clase === "cumple") nAB++;
    });
    if (n < o.minDias || nA < 5 || nB === 0) continue;
    const pBA = nAB / nA, pB = nB / n;
    if (pBA >= 0.6 && pBA / pB >= 1.15) out.juntos.push({ a: A.habito.id, b: B.habito.id, pBA, pB, n });
  }
  out.juntos.sort((x, y) => y.pBA / y.pB - x.pBA / x.pB);
  return out;
}

// ---------- Frases con lo que dicen tus datos ----------
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const pctTxt = v => `${Math.round(v * 100)} %`;
function insights(res, per, extra) {
  const e = extra || {};
  const nombre = id => res.habitos[id] ? `«${res.habitos[id].habito.name}»` : "";
  const out = [];
  const k = kpis(res, per);
  const dias = diasEntre(per.desde, per.hasta) + 1;
  // Peor y mejor día de la semana
  const sem = porDiaSemana(res, per.desde, per.hasta).map((x, i) => Object.assign({ i }, x)).filter(x => x.esperados >= 3);
  if (sem.length >= 5 && dias >= 14) {
    const orden = sem.slice().sort((a, b) => a.pct - b.pct);
    const peor = orden[0], mejor = orden[orden.length - 1];
    if (mejor.pct - peor.pct >= 0.1) out.push({ peso: 3 + (mejor.pct - peor.pct) * 5, texto: `Tu peor día es el ${DIAS_LARGOS[peor.i]} (${pctTxt(peor.pct)}); el mejor, el ${DIAS_LARGOS[mejor.i]} (${pctTxt(mejor.pct)}).` });
  }
  // Momento del día
  const mom = porMomento(res, per.desde, per.hasta);
  const ms = CFG.MOMENTOS.filter(m => m.id !== "cualquiera" && mom[m.id].esperados >= 5).map(m => Object.assign({ nombre: m.nombre.toLowerCase() }, mom[m.id]));
  if (ms.length >= 2) {
    ms.sort((a, b) => b.pct - a.pct);
    const a = ms[0], b = ms[ms.length - 1];
    if (a.pct - b.pct >= 0.15) out.push({ peso: 2 + (a.pct - b.pct) * 4, texto: `Cumples más por la ${a.nombre} (${pctTxt(a.pct)}) que por la ${b.nombre} (${pctTxt(b.pct)}).` });
  }
  // Contra el periodo anterior
  if (k.previo && k.actual.pct != null && k.previo.pct != null) {
    const d = Math.round((k.actual.pct - k.previo.pct) * 100);
    if (Math.abs(d) >= 5) out.push({ peso: 2.5 + Math.abs(d) / 10, texto: d > 0 ? `Vas ${d} puntos mejor que en el periodo anterior (${pctTxt(k.actual.pct)} contra ${pctTxt(k.previo.pct)}).` : `Bajaste ${-d} puntos respecto al periodo anterior (${pctTxt(k.actual.pct)} contra ${pctTxt(k.previo.pct)}).` });
  }
  // Hábitos que suben o caen varias semanas seguidas
  Object.keys(res.habitos).forEach(id => {
    const rh = res.habitos[id];
    if (rh.habito.archivado || !rh.rango.tieneRango) return;
    const pts = [21, 14, 7, 0].map(d => { const lim = addDias(res.hoy, -d); let v = null; for (const x of rh.rango.serie) { if (x.fecha > lim) break; v = x.fuerza; } return v; });
    if (pts.some(v => v == null)) return;
    const sube = pts[1] > pts[0] && pts[2] > pts[1] && pts[3] > pts[2], baja = pts[1] < pts[0] && pts[2] < pts[1] && pts[3] < pts[2];
    const delta = pts[3] - pts[0];
    if (sube && delta >= 3) out.push({ peso: 2 + delta / 10, texto: `${nombre(id)} lleva 3 semanas subiendo (+${Math.round(delta)} de fuerza).` });
    if (baja && delta <= -3) out.push({ peso: 2.2 + -delta / 10, texto: `${nombre(id)} lleva 3 semanas cayendo (${Math.round(delta)} de fuerza).` });
  });
  // Récords de racha
  Object.keys(res.habitos).forEach(id => {
    const rh = res.habitos[id], r = rh.racha;
    if (rh.habito.archivado || r.unidad !== "dias" || r.actual < 5) return;
    if (r.actual === r.mejor && r.actual >= 7) out.push({ peso: 1.8 + Math.min(1, r.actual / 60), texto: `Estás en tu mejor racha de ${nombre(id)}: ${r.actual} días.` });
    else if (r.mejor - r.actual > 0 && r.mejor - r.actual <= 3) out.push({ peso: 2.4, texto: `Estás a ${r.mejor - r.actual === 1 ? "1 día" : `${r.mejor - r.actual} días`} de tu récord en ${nombre(id)}.` });
  });
  // Ánimo (coincidencia, no causa)
  const c = e.correlaciones;
  if (c && c.suficiente && c.animo.length && Math.abs(c.animo[0].diferencia) >= 0.5) {
    const x = c.animo[0], d = Math.abs(x.diferencia).toFixed(1).replace(".", ",");
    out.push({ peso: 2.6, texto: x.diferencia > 0 ? `Los días que cumples ${nombre(x.id)}, tu ánimo suele ser ${d} puntos más alto (es una coincidencia, no necesariamente la causa).` : `Los días que cumples ${nombre(x.id)}, tu ánimo suele ser ${d} puntos más bajo (coincidencia, no causa).` });
  }
  if (k.actual.perfectos >= 3) out.push({ peso: 1.2, texto: `Lograste ${k.actual.perfectos} días perfectos en este periodo.` });
  return out.sort((a, b) => b.peso - a.peso).slice(0, 5).map(x => x.texto);
}

// Resumen de la semana pasada (para el lunes).
function resumenSemana(res, lunes) {
  const domingo = addDias(lunes, 6);
  const ix = indice(res);
  const act = cumplimientoGlobal(res, lunes, domingo), prev = cumplimientoGlobal(res, addDias(lunes, -7), addDias(lunes, -1));
  const habs = Object.keys(res.habitos).map(id => res.habitos[id]).filter(rh => !rh.habito.archivado && rh.habito.tipo !== "evitar")
    .map(rh => {
      if (porSemana(rh.habito)) { const s = rh.semanas.find(x => x.lunes === lunes); return { id: rh.habito.id, pct: s && s.meta ? Math.min(1, s.hechas / s.meta) : null }; }
      return { id: rh.habito.id, pct: cumplimiento(rh, lunes, domingo) };
    }).filter(x => x.pct != null).sort((a, b) => b.pct - a.pct);
  return {
    lunes, domingo, pct: act.pct, pctPrevio: prev.pct,
    xp: Math.round(sumaRango(ix, ix.X, lunes, domingo)),
    perfectos: res.diasPerfectos.filter(p => p.fecha >= lunes && p.fecha <= domingo).length,
    mejor: habs[0] || null,
    peor: habs.length > 1 ? habs[habs.length - 1] : null
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

// XP ganado en una fecha (registros de ese día + bonus de día perfecto).
function xpDelDiaTotal(res, f) {
  let xp = 0;
  Object.keys(res.habitos).forEach(id => { const d = res.habitos[id].dias[f]; if (d) xp += d.xp || 0; });
  const p = res.diasPerfectos.find(x => x.fecha === f);
  return xp + (p ? p.xp : 0);
}

// ---------- Cadenas: "Después de [hábito], haré [este]" ----------
function formaCiclo(h, porId) {
  const vistos = new Set([h.id]);
  let p = h.despuesDe && porId.get(h.despuesDe);
  while (p) {
    if (vistos.has(p.id)) return true;
    vistos.add(p.id);
    p = p.despuesDe && porId.get(p.despuesDe);
  }
  return false;
}
// Devuelve la lista (ya ordenada por `orden`) con cada hábito justo después
// del que lo encadena. Si el anterior no está en la lista, o la cadena da
// una vuelta, el hábito queda en su lugar.
function ordenarConCadenas(lista) {
  const porId = new Map(lista.map(h => [h.id, h]));
  const hijos = new Map();
  const raices = [];
  lista.forEach(h => {
    const padre = h.despuesDe && porId.get(h.despuesDe);
    if (padre && !formaCiclo(h, porId)) {
      if (!hijos.has(padre.id)) hijos.set(padre.id, []);
      hijos.get(padre.id).push(h);
    } else raices.push(h);
  });
  const out = [], puesto = new Set();
  const poner = h => {
    if (puesto.has(h.id)) return;
    puesto.add(h.id);
    out.push(h);
    (hijos.get(h.id) || []).forEach(poner);
  };
  raices.forEach(poner);
  lista.forEach(poner);
  return out;
}

// ---------- Calendario de un mes ----------
// Semanas (de lunes a domingo) que cubren el mes; null fuera del mes.
function mesCalendario(anio, mes) {
  const primero = `${anio}-${pad(mes)}-01`;
  const dias = new Date(anio, mes, 0).getDate();
  const semanas = [];
  let semana = new Array(diaSemana(primero)).fill(null);
  for (let d = 1; d <= dias; d++) {
    semana.push(`${anio}-${pad(mes)}-${pad(d)}`);
    if (semana.length === 7) { semanas.push(semana); semana = []; }
  }
  if (semana.length) semanas.push(semana.concat(new Array(7 - semana.length).fill(null)));
  return semanas;
}

return {
  PERIODOS, indice, periodo, cumplimientoGlobal, kpis, serieSemanal, porDiaSemana, porMomento, areasPeriodo,
  ranking, enRiesgo, correlaciones, insights, resumenSemana,
  NIVELES, percentilFuerza, intervalo, fuerzaHabito, rangoEn, subiriaConSemanaPerfecta, calcularAreas,
  generarMisiones, evaluarMisiones, calcularLogros, snapshot, novedades, fusionarSnapshot,
  cumplimiento, resumenDia, xpDelDiaTotal, formaCiclo, ordenarConCadenas, mesCalendario,
  CFG, isoDate, addDias, diasEntre, diaSemana, lunesDe, semanaId, fechaLogica, finDelDiaMs,
  dentroDeVentana, normalizar, activoEn, enPausa, tocaDia, estadoDia, cumple, claseDia,
  asignarComodines, xpParaNivel, nivelDeXP, titulo, evaluar
};
});
