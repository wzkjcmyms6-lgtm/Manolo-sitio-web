// "Mi día" en Inicio: arma las filas (entrenar, hábitos, Biblia, para
// gastar hoy y Running) con lo que cada sección ya calculó — sin pantalla
// ni Firebase (D-100). La pantalla está en js/mi-dia.js.
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
//   biblia: { hoyHecho, actual (racha), total, cita },
//   dinero: { dias, resultado, texto (para gastar por día), conPresupuesto },
//   running: { kmSemana, meta, manana: { dia, km, dura } | null,
//              ultima: { cuando: "ayer", km } | null }
// }
// → [{ id, icono, titulo, detalle, estado: "hecho" | "pendiente" | "aviso" | "libre", href }]
function filas(d) {
  const x = d || {};
  const out = [];
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
    if (b.hoyHecho) out.push({ id: "biblia", icono: "biblia", titulo: "Versículo de hoy anotado", detalle: `${b.cita ? `${b.cita}. ` : ""}${b.actual > 1 ? `${b.actual} días seguidos.` : ""}`.trim(), estado: "hecho", href: "#biblia" });
    else out.push({ id: "biblia", icono: "biblia", titulo: "Anota el versículo de hoy", detalle: b.actual > 0 ? `Llevas ${b.actual} ${b.actual === 1 ? "día" : "días"} seguidos: no cortes la racha.` : "Tu momento con la Palabra.", estado: "pendiente", href: "#biblia" });
  }
  const m = x.dinero;
  if (m && m.conPresupuesto && m.dias > 0) {
    const quedan = m.dias === 1 ? "Queda 1 día del periodo." : `Quedan ${m.dias} días del periodo.`;
    if (!(m.resultado > 0)) out.push({ id: "dinero", icono: "finance", titulo: "Sin margen para gastar", detalle: `${quedan} Mira tu presupuesto.`, estado: "aviso", href: "#fin-presupuesto" });
    else out.push({ id: "dinero", icono: "finance", titulo: `Para gastar hoy: ${m.texto}`, detalle: quedan, estado: "libre", href: "#fin-presupuesto" });
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
  return out;
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
