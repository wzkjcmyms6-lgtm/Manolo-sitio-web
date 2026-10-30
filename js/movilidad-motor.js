// ---------- Movilidad: motor de las rutinas guiadas (sin pantalla) ----------
// Cuenta 3-2-1, ejercicio actual, segundos que faltan, cambio de lado a la
// mitad, pausas, saltar y fin. El tiempo sale de marcas de tiempo (inicio,
// pausas, saltos), no de contar segundos: si el iPhone congela la app, al
// volver sabe exactamente dónde va. Historial: racha y últimas sesiones.
// Las rutinas son datos (js/movilidad-rutinas.js).
// Sin DOM ni Firebase: tests/movilidad-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MovilidadMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const CUENTA_MS = 3000;   // 3-2-1 antes de empezar
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(new Date(f + "T12:00:00Z").getTime());
const sumarDias = (f, n) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---- Rutinas ----
// ¿Está bien escrita? → lista de problemas (vacía = bien). Para cuando se
// editen o agreguen rutinas en js/movilidad-rutinas.js.
function problemas(rutinas) {
  const out = [];
  const ids = new Set();
  (Array.isArray(rutinas) ? rutinas : []).forEach((r, i) => {
    const donde = `Rutina ${i + 1}`;
    if (!r || typeof r.id !== "string" || !/^[a-z0-9-]+$/.test(r.id)) out.push(`${donde}: falta un id (minúsculas, números y guiones).`);
    else if (ids.has(r.id)) out.push(`${donde}: el id «${r.id}» está repetido.`);
    else ids.add(r.id);
    if (!r || typeof r.nombre !== "string" || !r.nombre.trim()) out.push(`${donde}: falta el nombre.`);
    const partes = r && Array.isArray(r.partes) ? r.partes : [];
    if (!partes.length) out.push(`${donde}: no tiene partes.`);
    partes.forEach((p, j) => {
      const ej = p && Array.isArray(p.ejercicios) ? p.ejercicios : [];
      if (!ej.length) out.push(`${donde}, parte ${j + 1}: no tiene ejercicios.`);
      ej.forEach((e, k) => {
        const d = `${donde}, ejercicio «${e && e.nombre ? e.nombre : k + 1}»`;
        if (!e || typeof e.nombre !== "string" || !e.nombre.trim()) out.push(`${d}: falta el nombre.`);
        if (!e || typeof e.instruccion !== "string" || !e.instruccion.trim()) out.push(`${d}: falta la instrucción.`);
        if (!e || !Number.isInteger(e.segundos) || e.segundos < 1 || e.segundos > 3600) out.push(`${d}: los segundos deben ser un número entero.`);
        if (!e || typeof e.porLado !== "boolean") out.push(`${d}: porLado debe ser true o false.`);
      });
    });
  });
  return out;
}

// Los ejercicios en fila, con su parte y en qué segundo empieza cada uno.
function pasos(rutina) {
  const out = [];
  let desde = 0;
  ((rutina && rutina.partes) || []).forEach(p => (p.ejercicios || []).forEach(e => {
    out.push({ i: out.length, nombre: e.nombre, instruccion: e.instruccion, segundos: e.segundos, porLado: !!e.porLado, parte: p.titulo || "", nota: p.nota || "", desde });
    desde += e.segundos;
  }));
  return out;
}
const duracion = rutina => pasos(rutina).reduce((s, p) => s + p.segundos, 0);
// 120 → "2 min" · 90 → "1 min 30 s" · 45 → "45 s"
function duracionTexto(seg) {
  const m = Math.floor(seg / 60), s = seg % 60;
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

// ---- Sesión guiada (marcas de tiempo en ms) ----
function crear(rutina) {
  return { rutinaId: rutina.id, estado: "listo", inicio: null, pausas: [], salto: 0, fin: null };
}
function msPausado(st, t) {
  return st.pausas.reduce((s, p) => s + Math.max(0, Math.min(p.hasta == null ? t : p.hasta, t) - p.desde), 0);
}
// Segundos de rutina ya hechos (sin la cuenta 3-2-1 ni las pausas, con los saltos).
function transcurrido(st, t, total) {
  if (st.inicio == null) return 0;
  const hasta = st.fin != null ? Math.min(st.fin, t) : t;
  const s = Math.max(0, hasta - st.inicio - msPausado(st, hasta)) / 1000 + st.salto;
  return Math.min(total, s);
}
function iniciar(st, t) {
  if (st.estado !== "listo") return st;
  st.estado = "activo";
  st.inicio = t + CUENTA_MS;
  return st;
}
// Durante la cuenta 3-2-1 no se pausa ni se salta.
function pausar(st, t) {
  if (st.estado !== "activo" || t < st.inicio) return st;
  st.estado = "pausado";
  st.pausas.push({ desde: t, hasta: null });
  return st;
}
function reanudar(st, t) {
  if (st.estado !== "pausado") return st;
  st.estado = "activo";
  st.pausas[st.pausas.length - 1].hasta = t;
  return st;
}
// Saltar: va al comienzo del ejercicio siguiente (o termina, si era el último).
function saltar(st, ps, t) {
  if ((st.estado !== "activo" && st.estado !== "pausado") || t < st.inicio) return st;
  const total = ps.reduce((s, p) => s + p.segundos, 0);
  const ahora = transcurrido(st, t, total);
  const sig = ps.find(p => p.desde > ahora + 1e-9);
  st.salto += (sig ? sig.desde : total) - ahora;
  st.saltados = (st.saltados || 0) + 1;
  return st;
}

// Todo lo que muestra la pantalla en el instante t.
function info(st, ps, t) {
  const total = ps.reduce((s, p) => s + p.segundos, 0);
  const cuenta = st.estado === "activo" && st.inicio != null && t < st.inicio ? Math.ceil((st.inicio - t) / 1000) : 0;
  const hecho = transcurrido(st, t, total);
  const terminado = st.inicio != null && hecho >= total - 1e-9;
  let indice = ps.length - 1;
  for (let k = 0; k < ps.length; k++) { if (hecho < ps[k].desde + ps[k].segundos - 1e-9) { indice = k; break; } }
  const paso = ps[indice];
  const dentro = Math.max(0, hecho - paso.desde);
  const lado = paso.porLado ? (dentro >= paso.segundos / 2 ? 2 : 1) : null;
  return {
    cuenta, terminado, indice, paso,
    siguiente: ps[indice + 1] || null,
    restante: terminado ? 0 : Math.ceil(paso.segundos - dentro - 1e-9),
    // Avance del ejercicio (para el círculo) y de toda la rutina (para la barra).
    pctPaso: terminado ? 1 : dentro / paso.segundos,
    pct: total ? hecho / total : 0,
    lado,
    transcurrido: hecho, total
  };
}

// Qué cambió entre dos lecturas: "paso" (nuevo ejercicio), "lado" (cambia
// de lado) o "fin". Sirve para vibrar una sola vez en cada cambio.
function cambios(antes, ahora) {
  const out = [];
  if (!antes) return out;
  if (ahora.terminado && !antes.terminado) { out.push("fin"); return out; }
  if (ahora.terminado || ahora.cuenta) return out;
  if (antes.cuenta && !ahora.cuenta) out.push("paso");
  else if (ahora.indice !== antes.indice) out.push("paso");
  else if (ahora.lado === 2 && antes.lado === 1) out.push("lado");
  return out;
}

// ---- Historial ----
// Documento a guardar al completar. fecha: "AAAA-MM-DD" del teléfono.
function sesion(rutina, st, fecha, ahora) {
  return { v: 1, rutinaId: rutina.id, nombre: rutina.nombre, fecha, completada: ahora, duracionSeg: duracion(rutina), saltados: st.saltados || 0 };
}
function normalizarSesion(id, d) {
  d = d || {};
  return { id, rutinaId: String(d.rutinaId || ""), nombre: d.nombre ? String(d.nombre) : "Rutina", fecha: fechaOk(d.fecha) ? d.fecha : "",
    completada: Number(d.completada) || 0, duracionSeg: Number.isInteger(d.duracionSeg) ? d.duracionSeg : 0, saltados: Number.isInteger(d.saltados) ? d.saltados : 0 };
}
// Días seguidos con al menos una rutina (hasta hoy, o hasta ayer si hoy todavía no).
function racha(sesiones, hoy) {
  const dias = new Set((sesiones || []).map(s => s.fecha).filter(fechaOk));
  let f = dias.has(hoy) ? hoy : sumarDias(hoy, -1), n = 0;
  while (dias.has(f)) { n++; f = sumarDias(f, -1); }
  return { dias: n, hoy: dias.has(hoy) };
}
const ultimas = (sesiones, n) => (sesiones || []).filter(s => s.fecha).slice().sort((a, b) => b.completada - a.completada || b.fecha.localeCompare(a.fecha)).slice(0, n || 5);
// Sesiones de la semana (lunes a domingo) que contiene hoy.
function estaSemana(sesiones, hoy) {
  const d = new Date(hoy + "T12:00:00Z");
  const lunes = sumarDias(hoy, -((d.getUTCDay() + 6) % 7));
  return (sesiones || []).filter(s => s.fecha >= lunes && s.fecha <= hoy).length;
}
function fechaCorta(f) {
  if (!fechaOk(f)) return "";
  const d = new Date(f + "T12:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

return { CUENTA_MS, problemas, pasos, duracion, duracionTexto, crear, iniciar, pausar, reanudar, saltar, transcurrido, info, cambios,
  sesion, normalizarSesion, racha, ultimas, estaSemana, fechaCorta };
});
