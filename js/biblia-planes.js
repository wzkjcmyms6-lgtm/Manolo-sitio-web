// ---------- Biblia: planes de lectura y progreso de capítulos (sin pantalla) ----------
// Fase 3 (D-106). Los planes se guardan en users/{uid}/meta/biblia_planes
// ({ planes: { id: { tipo, inicio, porDia?, desde?, corrimiento?, alDia?,
// activo, creado } } }) y lo leído en meta/biblia_leidos ({ dias: { fecha:
// ["John.3", …] } }, fase 1). Aquí: qué toca cada día, la lectura de hoy,
// el avance, el atraso, "ponerme al día de a poco", "mover el plan" y el
// progreso de los 1.189 capítulos. Sin DOM ni Firebase:
// tests/biblia-planes.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./biblia-motor.js"));
  else root.BibliaPlanes = factory(root.BibliaMotor);
})(typeof self !== "undefined" ? self : this, function (B) {
"use strict";

const NT = B.LIBROS.filter(l => l.testamento === "NT").map(l => l.id);
const TIPOS = {
  anio: { id: "anio", nombre: "Biblia en un año", dias: 365, libros: B.LIBROS.map(l => l.id), descripcion: "Toda la Biblia en orden, de Génesis a Apocalipsis: 3 o 4 capítulos por día." },
  nt90: { id: "nt90", nombre: "Nuevo Testamento en 90 días", dias: 90, libros: NT, descripcion: "De Mateo a Apocalipsis: unos 3 capítulos por día." },
  evangelios30: { id: "evangelios30", nombre: "Evangelios en 30 días", dias: 30, libros: ["Matt", "Mark", "Luke", "John"], descripcion: "Mateo, Marcos, Lucas y Juan: 3 capítulos por día." },
  salmos30: { id: "salmos30", nombre: "Salmos en 30 días", dias: 30, libros: ["Ps"], descripcion: "Los 150 salmos: 5 por día." },
  proverbios: { id: "proverbios", nombre: "Proverbios del día", diario: true, descripcion: "Cada día, el capítulo de Proverbios del día del mes (el 14, Proverbios 14). No termina." },
  ritmo: { id: "ritmo", nombre: "A mi ritmo", descripcion: "Toda la Biblia desde el libro que elijas, con los capítulos por día que quieras." }
};
const ORDEN_TIPOS = ["anio", "nt90", "evangelios30", "salmos30", "proverbios", "ritmo"];

// ---- Fechas (AAAA-MM-DD, en UTC para que no influya el huso) ----
const fecha = d => d.toISOString().slice(0, 10);
const aFecha = f => new Date(f + "T12:00:00Z");
function sumarDias(f, n) { const d = aFecha(f); d.setUTCDate(d.getUTCDate() + n); return fecha(d); }
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);

// ---- Capítulos ----
const clave = (libro, cap) => `${libro}.${cap}`;
function leerClave(k) {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)$/.exec(String(k || ""));
  return m && B.libro(m[1]) ? { libro: m[1], cap: Number(m[2]) } : null;
}
// Claves en el orden de la Biblia, sin repetir (lo leído en un día se guarda
// en el orden en que lo marcaste).
const POS = {};
B.LIBROS.forEach((l, i) => { POS[l.id] = i; });
function ordenClaves(keys) {
  return Array.from(new Set(keys || [])).map(leerClave).filter(Boolean)
    .sort((a, b) => POS[a.libro] - POS[b.libro] || a.cap - b.cap).map(k => clave(k.libro, k.cap));
}
function capitulos(ids) {
  const out = [];
  (ids || []).forEach(id => { const l = B.libro(id); if (l) for (let c = 1; c <= l.capitulos; c++) out.push(clave(id, c)); });
  return out;
}
// Toda la Biblia empezando en `desde` (y dando la vuelta hasta antes de él).
function bibliaDesde(desde) {
  const todos = capitulos(B.LIBROS.map(l => l.id));
  const i = Math.max(0, todos.indexOf(clave(desde, 1)));
  return todos.slice(i).concat(todos.slice(0, i));
}
// Reparte los capítulos en `dias` días casi iguales.
function reparto(caps, dias) {
  const out = [];
  for (let i = 0; i < dias; i++) out.push(caps.slice(Math.floor(i * caps.length / dias), Math.floor((i + 1) * caps.length / dias)));
  return out;
}
// De a `n` por día.
function enGrupos(caps, n) {
  const out = [];
  for (let i = 0; i < caps.length; i += n) out.push(caps.slice(i, i + n));
  return out;
}

// El calendario completo de un plan: [[capítulos del día 1], …]; null si es diario.
function calendario(plan) {
  const t = TIPOS[plan && plan.tipo];
  if (!t || t.diario) return null;
  if (t.id === "ritmo") {
    const n = Math.max(1, Math.min(50, Math.round(Number(plan.porDia) || 3)));
    return enGrupos(bibliaDesde(B.libro(plan.desde) ? plan.desde : "Gen"), n);
  }
  return reparto(capitulos(t.libros), t.dias);
}

// "Génesis 1-3", "Génesis 50, Éxodo 1-2", "Salmos 119".
function texto(keys) {
  const grupos = [];
  (keys || []).map(leerClave).filter(Boolean).forEach(k => {
    const g = grupos[grupos.length - 1];
    if (g && g.libro === k.libro && k.cap === g.hasta + 1) g.hasta = k.cap;
    else grupos.push({ libro: k.libro, desde: k.cap, hasta: k.cap });
  });
  const partes = [];
  grupos.forEach((g, i) => {
    const mismo = i > 0 && grupos[i - 1].libro === g.libro;
    const caps = g.desde === g.hasta ? `${g.desde}` : `${g.desde}-${g.hasta}`;
    partes.push(mismo ? caps : `${B.libro(g.libro).nombre} ${caps}`);
  });
  return partes.join(", ");
}

// Capítulos leídos desde una fecha (inclusive) hasta otra: Set de claves.
function leidosEntre(leidos, desde, hasta) {
  const s = new Set();
  Object.keys(leidos || {}).forEach(f => { if ((!desde || f >= desde) && (!hasta || f <= hasta)) (leidos[f] || []).forEach(k => s.add(k)); });
  return s;
}
// Todos los capítulos leídos alguna vez.
const leidosTodos = leidos => leidosEntre(leidos, null, null);
// Fechas con al menos un capítulo leído (para la racha).
const fechasLeidas = leidos => Object.keys(leidos || {}).filter(f => (leidos[f] || []).length).sort();

// ---- Estado de un plan ----
// → { tipo, nombre, diario, dia (1…), dias, lectura: [claves de hoy sin leer],
//     deHoy: [todas las de hoy], extraHoy: [las atrasadas que tocan hoy al
//     ponerse al día, leídas o no], hechasHoy, atrasados: [claves],
//     progreso: { leidos, total, pct }, terminado, alDia: { activo, hasta } | null,
//     racha (diario) }
function estado(plan, leidos, hoy) {
  const t = TIPOS[plan.tipo];
  if (!t) return null;
  const base = { id: plan.id, tipo: t.id, nombre: t.id === "ritmo" ? `A mi ritmo · ${Math.round(Number(plan.porDia) || 3)} por día` : t.nombre, diario: !!t.diario };
  if (t.diario) {
    // Proverbios: el capítulo del día del mes. Cuenta solo si lo leíste ese día.
    const cap = f => Math.min(31, Number(f.slice(8, 10)));
    const k = clave("Prov", cap(hoy));
    const hecho = (leidos[hoy] || []).includes(k);
    let racha = 0;
    for (let f = hecho ? hoy : sumarDias(hoy, -1); f >= plan.inicio && (leidos[f] || []).includes(clave("Prov", cap(f))); f = sumarDias(f, -1)) racha++;
    const mes = hoy.slice(0, 7);
    const enMes = Object.keys(leidos || {}).filter(f => f.startsWith(mes) && f >= plan.inicio && (leidos[f] || []).includes(clave("Prov", cap(f)))).length;
    return Object.assign(base, { dia: cap(hoy), dias: null, lectura: hecho ? [] : [k], deHoy: [k], extraHoy: [], hechasHoy: hecho ? 1 : 0,
      atrasados: [], progreso: { leidos: enMes, total: Number(hoy.slice(8, 10)), pct: Math.round(enMes / Number(hoy.slice(8, 10)) * 100) },
      terminado: false, alDia: null, racha });
  }
  const cal = calendario(plan);
  const N = cal.length;
  const todos = cal.flat();
  const leidosPlan = leidosEntre(leidos, plan.inicio, hoy);
  const enPlan = new Set(todos);
  const nLeidos = Array.from(leidosPlan).filter(k => enPlan.has(k)).length;
  const idx = diasEntre(plan.inicio, hoy) - (Number(plan.corrimiento) || 0);   // 0 = primer día
  const pasado = idx >= N;
  const hoyIdx = Math.max(0, Math.min(N - 1, idx));
  const deHoy = pasado ? [] : cal[hoyIdx];
  const antes = cal.slice(0, pasado ? N : hoyIdx).flat();
  const atrasados = antes.filter(k => !leidosPlan.has(k));
  // Ponerse al día: la parte de lo atrasado que toca hoy se fija con lo que
  // faltaba al empezar el día (si no, al leer una aparecería otra).
  let extraHoy = [];
  const alDia = plan.alDia && plan.alDia.hasta && hoy <= plan.alDia.hasta ? { activo: true, hasta: plan.alDia.hasta } : null;
  if (alDia) {
    const quedan = diasEntre(hoy, alDia.hasta) + 1;
    const leidosAntes = leidosEntre(leidos, plan.inicio, sumarDias(hoy, -1));
    const alEmpezar = antes.filter(k => !leidosAntes.has(k));
    extraHoy = alEmpezar.slice(0, Math.ceil(alEmpezar.length / quedan));
  }
  const todoHoy = extraHoy.concat(deHoy);
  const lectura = todoHoy.filter(k => !leidosPlan.has(k));
  return Object.assign(base, {
    dia: Math.min(N, idx + 1), dias: N, lectura, deHoy, extraHoy, hechasHoy: todoHoy.filter(k => leidosPlan.has(k)).length,
    atrasados, progreso: { leidos: nLeidos, total: todos.length, pct: Math.round(nLeidos / todos.length * 100) },
    terminado: nLeidos >= todos.length, alDia, pasado
  });
}

// ---- Acciones ----
// Nuevo plan. o: { tipo, hoy, porDia, desde, ahora }.
function nuevo(o) {
  const t = TIPOS[o.tipo];
  if (!t) return null;
  const p = { tipo: t.id, inicio: o.hoy, activo: true, creado: o.ahora || 0 };
  if (t.id === "ritmo") {
    p.porDia = Math.max(1, Math.min(50, Math.round(Number(o.porDia) || 3)));
    p.desde = B.libro(o.desde) ? o.desde : "Gen";
  }
  return p;
}
// "Ponerme al día de a poco": reparte lo atrasado entre hoy y los próximos días.
const ponerseAlDia = (hoy, dias) => ({ hasta: sumarDias(hoy, Math.max(1, (dias || 7)) - 1) });
// "Mover el plan": el día de hoy pasa a ser el primero que tiene algo sin leer.
function mover(plan, leidos, hoy) {
  const cal = calendario(plan);
  if (!cal) return Number(plan.corrimiento) || 0;
  const leidosPlan = leidosEntre(leidos, plan.inicio, hoy);
  const primero = cal.findIndex(d => d.some(k => !leidosPlan.has(k)));
  if (primero < 0) return Number(plan.corrimiento) || 0;
  return Math.max(0, diasEntre(plan.inicio, hoy) - primero);
}
// Cuándo termina el plan con el ritmo de su calendario (fecha), o null.
function fin(plan) {
  const cal = calendario(plan);
  return cal ? sumarDias(plan.inicio, cal.length - 1 + (Number(plan.corrimiento) || 0)) : null;
}

// ---- Progreso de la Biblia (el mapa de los 66 libros) ----
function progresoBiblia(leidos) {
  const s = leidosTodos(leidos);
  const libros = B.LIBROS.map(l => {
    let n = 0;
    for (let c = 1; c <= l.capitulos; c++) if (s.has(clave(l.id, c))) n++;
    return { id: l.id, nombre: l.nombre, testamento: l.testamento, leidos: n, total: l.capitulos, pct: Math.round(n / l.capitulos * 100) };
  });
  const suma = xs => xs.reduce((a, x) => ({ leidos: a.leidos + x.leidos, total: a.total + x.total }), { leidos: 0, total: 0 });
  const conPct = x => Object.assign(x, { pct: x.total ? Math.round(x.leidos / x.total * 1000) / 10 : 0 });
  return {
    libros,
    total: conPct(suma(libros)),
    at: conPct(suma(libros.filter(l => l.testamento === "AT"))),
    nt: conPct(suma(libros.filter(l => l.testamento === "NT"))),
    completos: libros.filter(l => l.leidos === l.total).length
  };
}
// Capítulos leídos en un año ("2026").
function enElAnio(leidos, anio) {
  return leidosEntre(leidos, `${anio}-01-01`, `${anio}-12-31`).size;
}

return { TIPOS, ORDEN_TIPOS, clave, leerClave, ordenClaves, capitulos, calendario, texto, estado, nuevo, ponerseAlDia, mover, fin,
  leidosEntre, leidosTodos, fechasLeidas, progresoBiblia, enElAnio, sumarDias, diasEntre };
});
