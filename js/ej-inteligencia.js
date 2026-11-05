// Resumen inteligente por reglas (del entreno y de la semana) y datos para
// los gráficos del Perfil — sin pantalla ni Firebase (fase 7, D-097).
// Todo sale de reglas fijas y de tus datos: nada de IA.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjInteligencia = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
const lista = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const miles = n => String(Math.round(num(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function addDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function lunesDe(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDias(iso, -((dia + 6) % 7));
}

// ---- Resumen del entreno ----
// o: { comparacion (EjEntreno.comparar), records: [{ nombre }], planeadas
//   (series de la rutina), hechas (series de trabajo), estancados: [nombre],
//   cansados: [grupos que quedan cansados], proximo: { nombre, cuando } }
// → hasta 4 frases, de lo más importante a lo menos.
function resumenSesion(o) {
  const x = o || {};
  const out = [];
  const recs = x.records || [];
  if (recs.length === 1) out.push({ tipo: "record", texto: `¡Récord en ${recs[0].nombre}!` });
  else if (recs.length > 1) out.push({ tipo: "record", texto: `${recs.length} récords hoy: ${lista(recs.slice(0, 3).map(r => r.nombre))}${recs.length > 3 ? " y más" : ""}.` });
  const c = x.comparacion;
  // Entreno a medias: "Hiciste 3 de 16 series" ya explica el menor volumen.
  const incompleto = num(x.planeadas) > 0 && num(x.hechas) < num(x.planeadas);
  if (c && c.anterior && c.dVolumenPct != null && !(incompleto && c.dVolumenPct <= -10)) {
    const p = c.dVolumenPct;
    if (p >= 5) out.push({ tipo: "sube", texto: `Moviste un ${p} % más de peso total que la última vez.` });
    else if (p <= -10 && recs.length) out.push({ tipo: "igual", texto: `Moviste un ${Math.abs(p)} % menos de peso total que la última vez, pero con más fuerza.` });
    else if (p <= -10) out.push({ tipo: "baja", texto: `Moviste un ${Math.abs(p)} % menos que la última vez: si venías cansado, es normal.` });
    else out.push({ tipo: "igual", texto: "Parecido a la última vez: la constancia es lo que da resultados." });
  } else if (c && !c.anterior) out.push({ tipo: "primera", texto: "Primera vez con esta rutina: la próxima vas a ver cuánto mejoras." });
  if ((x.estancados || []).length) out.push({ tipo: "estancado", texto: `${x.estancados[0]} sigue sin mejorar: la próxima prueba otro rango de reps.` });
  const pl = num(x.planeadas), he = num(x.hechas);
  if (pl > 0 && he > 0) out.push(he >= pl ? { tipo: "completo", texto: "Completaste todas las series del plan." } : { tipo: "incompleto", texto: `Hiciste ${he} de ${pl} series del plan.` });
  if ((x.cansados || []).length) out.push({ tipo: "recuperar", texto: `${lista(x.cansados.slice(0, 3)).replace(/^./, s => s.toUpperCase())}: dales unas 48 h antes de volver a cargarlos.` });
  if (x.proximo) out.push({ tipo: "proximo", texto: `Lo próximo en tu plan: ${x.proximo.nombre} (${x.proximo.cuando}).` });
  // Prioridad: récords, comparación, estancado, recuperar, completo, próximo.
  const orden = ["record", "sube", "baja", "igual", "primera", "estancado", "recuperar", "incompleto", "completo", "proximo"];
  return out.sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo)).slice(0, 4);
}

// ---- Resumen de la semana ----
// o: { hoy, entrenos (gimnasio), planeados (días con rutina en el plan),
//   records: [nombre], volumen: [{ nombre, estado }] (EjVolumen), carga
//   (EjRecuperacion.cargaSemana), resumenDe(w) → { series, volumen } }
function resumenSemana(o) {
  const x = o || {};
  const lun = lunesDe(x.hoy);
  const semana = (x.entrenos || []).filter(w => w.date >= lun && w.date <= x.hoy);
  let series = 0, volumen = 0;
  semana.forEach(w => { const r = x.resumenDe(w); series += num(r.series); volumen += num(r.volumen); });
  const n = semana.length, pl = num(x.planeados);
  const lineas = [];
  lineas.push(pl ? `${n} de ${pl} entrenos del plan` : `${n} ${n === 1 ? "entreno" : "entrenos"}`);
  if (n) lineas.push(`${series} series · ${miles(volumen)} kg movidos`);
  const recs = x.records || [];
  if (recs.length) lineas.push(`${recs.length === 1 ? "1 récord" : `${recs.length} récords`}: ${lista(recs.slice(0, 3))}${recs.length > 3 ? " y más" : ""}`);
  const bajos = (x.volumen || []).filter(v => v.estado === "bajo").map(v => v.nombre.toLowerCase());
  if (n && x.volumen) lineas.push(bajos.length ? `Atrasados: ${lista(bajos.slice(0, 3))}${bajos.length > 3 ? ` y ${bajos.length - 3} más` : ""}` : "Todos tus músculos en su objetivo");
  if (x.carga && x.carga.total) lineas.push(`Carga ${x.carga.total}${x.carga.promedio ? ` (${Math.round((x.carga.total / x.carga.promedio) * 100)} % de tu semana típica)` : ""}`);
  const r = racha(x.entrenos, x.hoy);
  if (r >= 2) lineas.push(`Racha: ${r} semanas seguidas entrenando`);
  const titulo = !n ? "Todavía no entrenaste esta semana" : pl && n >= pl ? "¡Semana completa!" : recs.length ? "Semana con récords" : "Vas bien esta semana";
  return { titulo, lineas, cifras: { entrenos: n, planeados: pl, series, volumen: Math.round(volumen), records: recs.length, racha: r } };
}
// Semanas seguidas (hasta esta o la anterior) con al menos un entreno.
function racha(entrenos, hoy) {
  const semanas = new Set((entrenos || []).filter(w => w.date && w.date <= hoy).map(w => lunesDe(w.date)));
  let l = lunesDe(hoy);
  if (!semanas.has(l)) l = addDias(l, -7);
  let n = 0;
  while (semanas.has(l)) { n++; l = addDias(l, -7); }
  return n;
}

// ---- Gráficos ----
// Frecuencia: cuántos días por semana entrenaste cada músculo (como
// principal) en las últimas `semanas` (por defecto 4). musculos: [{ id,
// nombre, regiones }] (EjPrograma.MUSCULOS_OBJ).
function frecuencia(entradas, musculos, hoy, semanas) {
  const n = semanas || 4;
  const desde = addDias(lunesDe(hoy), -7 * (n - 1));
  const dias = {};
  (entradas || []).forEach(e => {
    if (!e.fecha || e.fecha < desde || e.fecha > hoy) return;
    const f = e.ejercicio || {};
    if (f.tipo === "cardio") return;
    const trabajo = (e.series || []).some(s => !s.calentamiento && (num(s.reps) > 0 || num(s.seg) > 0));
    if (!trabajo) return;
    musculos.forEach(m => {
      if (m.regiones.some(r => (f.primarios || []).includes(r))) (dias[m.id] = dias[m.id] || new Set()).add(e.fecha);
    });
  });
  return musculos.map(m => ({ id: m.id, nombre: m.nombre, porSemana: Math.round(((dias[m.id] ? dias[m.id].size : 0) / n) * 10) / 10 }));
}
// Peso corporal en una fecha: el último pesaje hasta ese día (o el primero).
function pesoEn(pesajes, fecha) {
  const ks = Object.keys(pesajes || {}).sort();
  if (!ks.length) return null;
  const k = ks.filter(f => f <= fecha).pop() || ks[0];
  return num(pesajes[k]) || null;
}
// Fuerza relativa: mejor 1RM estimado de las últimas 12 semanas ÷ peso corporal.
function fuerzaRelativa(sesiones, pesajes, hoy) {
  const desde = addDias(hoy, -84);
  const ult = (sesiones || []).filter(s => s.fecha >= desde && s.fecha <= hoy && s.e1rm > 0);
  if (!ult.length) return null;
  const mejor = ult.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
  const peso = pesoEn(pesajes, mejor.fecha);
  return peso ? { e1rm: mejor.e1rm, peso, ratio: Math.round((mejor.e1rm / peso) * 100) / 100, fecha: mejor.fecha } : null;
}

return { resumenSesion, resumenSemana, racha, frecuencia, pesoEn, fuerzaRelativa, lunesDe, addDias };
});
