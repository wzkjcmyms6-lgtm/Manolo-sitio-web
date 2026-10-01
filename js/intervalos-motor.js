// ---------- Motor de rutinas por intervalos (sin pantalla) ----------
// "3:00 caminar · 2:00 correr · …". El tiempo se calcula con marcas de
// tiempo (inicio, pausas, fin), no contando segundos: si el iPhone congela
// la app, al volver sabe exactamente en qué intervalo va.
// Se prueba en tests/intervalos-motor.test.js. Diseño en docs/SPORTS.md.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.IntervalosMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// ---- Reloj: pausas y tiempo activo ----
function msPausado(st, t) {
  return (st.pausas || []).reduce((s, p) => s + Math.max(0, Math.min(p.hasta == null ? t : p.hasta, t) - p.desde), 0);
}
function tiempoActivoMs(st, t) {
  if (st.inicio == null) return 0;
  const fin = st.fin != null ? Math.min(st.fin, t) : t;
  return Math.max(0, fin - st.inicio - msPausado(st, fin));
}
const R = {
  iniciar(st, t) {
    if (st.estado !== "listo") return st;
    st.estado = "activo";
    st.inicio = t;
    return st;
  },
  pausar(st, t) {
    if (st.estado !== "activo") return st;
    st.estado = "pausado";
    st.pausas.push({ desde: t, hasta: null });
    return st;
  },
  reanudar(st, t) {
    if (st.estado !== "pausado") return st;
    st.estado = "activo";
    const p = st.pausas[st.pausas.length - 1];
    if (p && p.hasta == null) p.hasta = Math.max(p.desde, t);
    return st;
  },
  finalizar(st, t) {
    if (st.estado !== "activo" && st.estado !== "pausado") return st;
    const p = st.pausas[st.pausas.length - 1];
    if (p && p.hasta == null) p.hasta = Math.max(p.desde, t);
    st.estado = "finalizado";
    st.fin = t;
    return st;
  },
  tiempoActivoMs
};
const TIPOS = {
  caminar: { nombre: "Caminar", verbo: "caminar" },
  trotar: { nombre: "Trotar", verbo: "trotar" },
  correr: { nombre: "Correr", verbo: "correr" },
  descanso: { nombre: "Descanso", verbo: "descansar" }
};
const SALTO_MS = 5000;   // más que esto entre dos consultas = la app estuvo congelada
const CUENTA = [3, 2, 1]; // segundos antes de cada cambio

function crear(plan) {
  const intervalos = (plan && plan.intervalos || [])
    .filter(x => x && TIPOS[x.tipo] && x.seg > 0)
    .map(x => ({ tipo: x.tipo, seg: Math.round(x.seg), texto: x.texto ? String(x.texto) : "" }));
  if (!intervalos.length) throw new Error("La rutina no tiene intervalos válidos.");
  return { v: 1, plan: { nombre: String(plan.nombre || "Rutina"), intervalos }, estado: "listo", inicio: null, fin: null, pausas: [] };
}
const iniciar = (st, t) => R.iniciar(st, t);
const pausar = (st, t) => R.pausar(st, t);
const reanudar = (st, t) => R.reanudar(st, t);
const finalizar = (st, t) => R.finalizar(st, t);

// Fin de cada intervalo en ms activos: [180000, 300000, …].
function limites(st) {
  let acc = 0;
  return st.plan.intervalos.map(x => (acc += x.seg * 1000));
}
const totalMs = st => limites(st).slice(-1)[0];
const activoMs = (st, t) => R.tiempoActivoMs(st, t);

// Dónde va la rutina en el momento t.
function info(st, t) {
  const lim = limites(st);
  const total = lim[lim.length - 1];
  const a = Math.min(activoMs(st, t), total);
  const terminado = a >= total;
  let i = lim.findIndex(f => a < f);
  if (i < 0) i = lim.length - 1;
  const desde = i ? lim[i - 1] : 0;
  const n = lim.length;
  return {
    indice: i,
    actual: st.plan.intervalos[i],
    siguiente: st.plan.intervalos[i + 1] || null,
    restanteS: terminado ? 0 : Math.ceil((lim[i] - a) / 1000),
    transcurridoIntervaloS: Math.floor((a - desde) / 1000),
    transcurridoS: Math.floor(a / 1000),
    totalS: total / 1000,
    pct: a / total,
    completados: terminado ? n : i,
    restantes: terminado ? 0 : n - i - 1,
    terminado
  };
}

// Avisos entre dos momentos activos (ms) a0 < a1: inicio, cuenta atrás
// (3, 2, 1), cambio de intervalo y fin. Si la app estuvo congelada (salto
// grande) no se recitan los avisos perdidos: solo se anuncia dónde va.
// Para el aviso del primer intervalo se llama con a0 = -1.
function avisosEntre(st, a0, a1) {
  const lim = limites(st);
  const total = lim[lim.length - 1];
  if (a1 <= a0) return [];
  if (a1 - a0 > SALTO_MS && a0 >= 0) {
    if (a1 >= total) return a0 < total ? [{ tipo: "fin", en: total }] : [];
    const i = lim.findIndex(f => a1 < f);
    return [{ tipo: "estado", indice: i, en: a1 }];
  }
  const out = [];
  const bordes = [0].concat(lim); // inicio de cada intervalo y el final
  bordes.forEach((b, k) => {
    const esFin = k === bordes.length - 1;
    const largo = k ? lim[k - 1] - (k > 1 ? lim[k - 2] : 0) : 0;
    if (k > 0 && largo > 5000) {
      CUENTA.forEach(s => {
        const en = b - s * 1000;
        if (a0 < en && en <= a1) out.push({ tipo: "cuenta", n: s, indice: esFin ? null : k, en });
      });
    }
    if (a0 < b && b <= a1) out.push(esFin ? { tipo: "fin", en: b } : { tipo: "cambio", indice: k, en: b });
  });
  return out.sort((x, y) => x.en - y.en);
}
// Igual, con marcas de tiempo reales.
function avisos(st, t0, t1) {
  return avisosEntre(st, t0 == null ? -1 : activoMs(st, t0), activoMs(st, t1));
}

// "2 minutos", "1 minuto y 30 segundos", "45 segundos".
function duracionHablada(seg) {
  const m = Math.floor(seg / 60), s = Math.round(seg % 60);
  const pm = m === 1 ? "1 minuto" : `${m} minutos`;
  const ps = s === 1 ? "1 segundo" : `${s} segundos`;
  if (!m) return ps;
  return s ? `${pm} y ${ps}` : pm;
}
// Lo que dice la voz en cada aviso (la cuenta atrás no se habla: pitidos).
function textoAviso(st, av) {
  if (av.tipo === "fin") return "Rutina terminada. ¡Buen trabajo!";
  if (av.tipo === "cambio" || av.tipo === "estado") {
    const x = st.plan.intervalos[av.indice];
    if (!x) return "";
    const pre = av.tipo === "estado" ? "Ahora" : av.indice === 0 ? "Empezamos" : "Siguiente intervalo";
    return `${pre}: ${TIPOS[x.tipo].verbo} durante ${duracionHablada(x.seg)}.`;
  }
  return "";
}

return { TIPOS, crear, iniciar, pausar, reanudar, finalizar, info, avisos, avisosEntre, limites, totalMs, activoMs, duracionHablada, textoAviso, SALTO_MS };
});
