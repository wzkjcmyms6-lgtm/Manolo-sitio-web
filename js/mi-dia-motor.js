// "Mi día" en Inicio: arma las filas (mi mañana, entrenar, hábitos, Biblia,
// el libro que lees, el repaso de hoy, para gastar hoy y Running) con lo que
// cada sección ya calculó — sin pantalla ni Firebase (D-100). Como mucho 5
// filas: si hay más, quedan las de hacer hoy (fase 7, D-114). La pantalla
// está en js/mi-dia.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MiDiaMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const lista = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const num1 = n => String(Math.round(Number(n) * 10) / 10).replace(".", ",");

// d: {
//   ejercicio: recomendación de EjRecuperacion.recomendar (o null),
//   habitos: { hechos, total, pendientes: [{ nombre, emoji }] },
//   biblia: { hoyHecho, actual (racha), total, cita, capsHoy (capítulos leídos hoy),
//             plan: { nombre, texto } | null (lectura de hoy que falta) },
//   dinero: { estado: "verde"|"ambar"|"rojo"|"cerrado"|"vacio", dias, disponibleDia, quedaDia, pasado } (D-116),
//   tarjetas: [{ nombre, falta, faltaCent, dias, cargos }] pagos de tarjeta (todo + seguros y mantenimiento) que vencen en ≤ 3 días (D-165),
//   running: { kmSemana, meta, manana: { dia, km, dura } | null,
//              ultima: { cuando: "ayer", km } | null },
//   manana: { estado: "curso" | "hecha" | "pendiente", paso, de, nombre, vsPlan (s, + = atrasado),
//             total, dif (s contra tu promedio), listo ("8:00") } (Medir tiempos),
//   libro: { titulo, paginasHoy, meta } (el que estás leyendo),
//   repaso: { frases, versiculos } (para repasar hoy)
// }
// → [{ id, icono, titulo, detalle, estado: "hecho" | "pendiente" | "aviso" | "libre", href }]
const MAX = 5;
const PESO = { pendiente: 0, aviso: 1, hecho: 2, libre: 3 };
const minutos = s => { const m = Math.max(1, Math.round(Math.abs(s) / 60)); return `${m} min`; };
function duracion(s) {
  const m = Math.round((s || 0) / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")} min` : ""}`;
}
function filas(d) {
  const x = d || {};
  const out = [];
  // Mi mañana (Medir tiempos): lo primero del día.
  const mm = x.manana;
  if (mm && mm.estado === "curso") {
    const v = mm.vsPlan;
    const detalle = v == null ? `Ahora: ${mm.nombre}.` : v > 60 ? `Vas ${minutos(v)} atrasado según tu plan.` : v < -60 ? `Vas ${minutos(v)} adelantado según tu plan.` : "Vas a tiempo según tu plan.";
    out.push({ id: "manana", icono: "timer", titulo: `Mi mañana: paso ${mm.paso} de ${mm.de}`, detalle, estado: v > 60 ? "aviso" : "pendiente", href: "#tiempos" });
  } else if (mm && mm.estado === "hecha") {
    const dif = mm.dif == null || Math.abs(mm.dif) < 60 ? "" : ` · ${minutos(mm.dif)} ${mm.dif > 0 ? "más" : "menos"} que tu promedio`;
    out.push({ id: "manana", icono: "timer", titulo: "Mi mañana: lista", detalle: `${duracion(mm.total)}${dif}.`, estado: "hecho", href: "#tiempos" });
  } else if (mm && mm.estado === "pendiente") {
    out.push({ id: "manana", icono: "timer", titulo: "Empieza tu mañana", detalle: `Tu plan: listo a las ${mm.listo}.`, estado: "pendiente", href: "#tiempos" });
  }
  const ej = x.ejercicio;
  if (ej) {
    const r0 = (ej.razones || [])[0] || "";
    if (ej.tipo === "hecho") out.push({ id: "entreno", icono: "exercise", titulo: "Entreno hecho", detalle: ej.plan ? `${ej.plan.name}. Ahora a recuperarse.` : "Ahora a recuperarse.", estado: "hecho", href: "#ejercicio" });
    else if (ej.tipo === "plan") out.push({ id: "entreno", icono: "exercise", titulo: `Entrenar: ${ej.rutina.name}`, detalle: r0, estado: "pendiente", href: "#ejercicio" });
    else if (ej.tipo === "cambio") out.push({ id: "entreno", icono: "exercise", titulo: `Mejor hoy: ${ej.rutina.name}`, detalle: `En vez de ${ej.plan.name}. ${r0}`, estado: "aviso", href: "#ejercicio" });
    else if (ej.tipo === "extra") out.push({ id: "entreno", icono: "exercise", titulo: `Si entrenas: ${ej.rutina.name}`, detalle: (ej.razones || []).filter(t => !/^Hoy no tienes/.test(t))[0] || "Hoy no tienes rutina en tu plan.", estado: "libre", href: "#ejercicio" });
    else if (ej.tipo === "movilidad") out.push({ id: "entreno", icono: "movilidad", titulo: "Hoy: Movilidad o descanso", detalle: r0, estado: "aviso", href: "#movilidad" });
    else out.push({ id: "entreno", icono: "movilidad", titulo: "Día de descanso", detalle: r0, estado: "libre", href: "#movilidad" });
  }
  const h = x.habitos;
  if (h && h.total > 0) {
    const p = h.pendientes || [];
    if (h.hechos >= h.total) out.push({ id: "habitos", icono: "habits", titulo: "Hábitos: todo hecho", detalle: `${h.total} de ${h.total}. ¡Bien!`, estado: "hecho", href: "#habitos" });
    else out.push({ id: "habitos", icono: "habits", titulo: `Hábitos: ${h.hechos} de ${h.total}`,
      detalle: p.length ? `Faltan: ${p.length > 3 ? `${p.slice(0, 3).map(y => y.nombre).join(", ")} y ${p.length - 3} más` : lista(p.map(y => y.nombre))}.` : "Te faltan algunos para hoy.", estado: "pendiente", href: "#habitos" });
  }
  const b = x.biblia;
  if (b && b.total > 0) {
    const seguidos = b.actual > 1 ? `${b.actual} días seguidos.` : "";
    if (b.hoyHecho && b.cita) out.push({ id: "biblia", icono: "biblia", titulo: "Versículo de hoy anotado", detalle: `${b.cita}. ${seguidos}`.trim(), estado: "hecho", href: "#biblia" });
    else if (b.hoyHecho) out.push({ id: "biblia", icono: "biblia", titulo: "Biblia leída hoy", detalle: `${b.capsHoy > 0 ? `${b.capsHoy} ${b.capsHoy === 1 ? "capítulo" : "capítulos"}. ` : ""}${seguidos}`.trim(), estado: "hecho", href: "#biblia" });
    else if (b.plan) out.push({ id: "biblia", icono: "biblia", titulo: `Lectura de hoy: ${b.plan.texto}`, detalle: b.actual > 0 ? `${b.plan.nombre}. Llevas ${b.actual} ${b.actual === 1 ? "día" : "días"} seguidos.` : `${b.plan.nombre}.`, estado: "pendiente", href: "#biblia" });
    else out.push({ id: "biblia", icono: "biblia", titulo: "Anota el versículo de hoy", detalle: b.actual > 0 ? `Llevas ${b.actual} ${b.actual === 1 ? "día" : "días"} seguidos: no cortes la racha.` : "Tu momento con la Palabra.", estado: "pendiente", href: "#biblia" });
  }
  // El libro que estás leyendo: páginas de hoy contra tu meta.
  const li = x.libro;
  if (li && li.titulo) {
    const hecho = li.meta > 0 && li.paginasHoy >= li.meta;
    out.push({ id: "libro", icono: "libro", titulo: `Leyendo: ${li.titulo}`,
      detalle: hecho ? `Meta de hoy cumplida: ${li.paginasHoy} páginas.` : li.meta > 0 ? `${li.paginasHoy} de ${li.meta} páginas hoy.` : li.paginasHoy ? `${li.paginasHoy} páginas hoy.` : "Todavía no leíste hoy.",
      estado: hecho ? "hecho" : "pendiente", href: "#libros" });
  }
  // El repaso de hoy: frases (Libros) y versículos para memorizar (Biblia).
  const rp = x.repaso;
  if (rp && (rp.frases > 0 || rp.versiculos > 0)) {
    const partes = [rp.frases > 0 ? `${rp.frases} ${rp.frases === 1 ? "frase" : "frases"}` : "", rp.versiculos > 0 ? `${rp.versiculos} ${rp.versiculos === 1 ? "versículo" : "versículos"}` : ""].filter(Boolean);
    out.push({ id: "repaso", icono: rp.versiculos > 0 && !rp.frases ? "biblia" : "libro", titulo: "Repaso de hoy", detalle: `${lista(partes)} para repasar.`, estado: "pendiente", href: rp.frases > 0 ? "#libros" : "#biblia-memorizar" });
  }
  // Pago de las tarjetas (D-165, antes el pago mínimo de D-121): todo lo que
  // debes + seguros y mantenimiento, para no pagar intereses, cuando vence en
  // 3 días o menos. Hoy o mañana: por hacer.
  const tc = (x.tarjetas || []).filter(t => t && t.faltaCent > 0).sort((a, b) => a.dias - b.dias);
  if (tc.length) {
    const t = tc[0];
    const vence = t.dias <= 0 ? "Vence hoy" : t.dias === 1 ? "Vence mañana" : `Vence en ${t.dias} días`;
    const con = t.cargos ? " Incluye seguros y mantenimiento." : "";
    out.push(tc.length === 1
      ? { id: "tarjeta", icono: "finance", titulo: `Pago de ${t.nombre}: ${t.falta}`, detalle: `${vence}. Págala completa para no pagar intereses.${con}`, estado: t.dias <= 1 ? "pendiente" : "aviso", href: "#fin-tarjetas" }
      : { id: "tarjeta", icono: "finance", titulo: `Pagos de ${tc.length} tarjetas`, detalle: `${vence} el de ${t.nombre} (${t.falta}). Págalas completas para no pagar intereses.`, estado: t.dias <= 1 ? "pendiente" : "aviso", href: "#fin-tarjetas" });
  }
  // Dinero (D-116): lo que te queda por día desde hoy, según lo que entró de
  // verdad este mes. Sin ingresos registrados, no aparece (nada inventado).
  const m = x.dinero;
  if (m && m.estado && m.estado !== "vacio" && m.dias > 0) {
    const quedan = m.dias === 1 ? "Queda 1 día del mes." : `Quedan ${m.dias} días del mes.`;
    if (m.estado === "rojo") out.push({ id: "dinero", icono: "finance", titulo: "Gastaste más de lo que entró", detalle: `${m.pasado ? `Te pasaste ${m.pasado}. ` : ""}${quedan}`, estado: "aviso", href: "#finanzas" });
    else out.push({ id: "dinero", icono: "finance", titulo: `Para gastar hoy: ${m.quedaDia}`,
      detalle: m.estado === "ambar" ? `Vas más rápido de lo ideal (disponible: ${m.disponibleDia} por día). ${quedan}` : `Disponible: ${m.disponibleDia} por día. ${quedan}`,
      estado: m.estado === "ambar" ? "aviso" : "libre", href: "#finanzas" });
  }
  const r = x.running;
  if (r && (r.kmSemana > 0 || r.meta > 0 || r.manana)) {
    const meta = r.meta > 0 ? ` de ${num1(r.meta)}` : "";
    const cumplida = r.meta > 0 && r.kmSemana >= r.meta;
    const detalle = r.manana ? `Mañana (${r.manana.dia}) sueles correr ${num1(r.manana.km)} km${r.manana.dura ? ": hoy, piernas tranquilas." : "."}`
      : cumplida ? "Meta de la semana cumplida." : r.meta > 0 ? `Te faltan ${num1(r.meta - r.kmSemana)} km para tu meta.`
      : r.ultima ? `Última: ${r.ultima.cuando}, ${num1(r.ultima.km)} km.` : "Sigue sumando.";
    out.push({ id: "running", icono: "running", titulo: `Running: ${num1(r.kmSemana)}${meta} km esta semana`, detalle, estado: cumplida ? "hecho" : "libre", href: "#running" });
  }
  return elegir(out);
}
// Como mucho 5 filas: quedan las de hacer hoy (luego avisos, hechas y
// libres), en su orden de siempre.
function elegir(out) {
  if (out.length <= MAX) return out;
  return out.map((f, i) => ({ f, i })).sort((a, b) => (PESO[a.f.estado] - PESO[b.f.estado]) || a.i - b.i)
    .slice(0, MAX).sort((a, b) => a.i - b.i).map(x => x.f);
}

// Frase de arriba: cuántas cosas faltan hoy.
function titular(fs) {
  const faltan = (fs || []).filter(f => f.estado === "pendiente").length;
  const avisos = (fs || []).filter(f => f.estado === "aviso").length;
  if (!(fs || []).length) return "";
  if (!faltan && !avisos) return "Todo en orden por hoy.";
  if (!faltan) return avisos === 1 ? "Hay algo que mirar hoy." : `Hay ${avisos} cosas que mirar hoy.`;
  return faltan === 1 ? "Te queda 1 cosa por hoy." : `Te quedan ${faltan} cosas por hoy.`;
}

return { filas, titular };
});
