// ---------- Finanzas: disponible por día según lo que REALMENTE entró ----------
// Pedido del dueño (2026-11-15, D-116): el monto diario sale de los ingresos
// que registraste en el mes, no del presupuesto. El presupuesto queda solo
// como META ("Recibido vs. presupuestado").
//
//   Disponible por día        = ingresos del mes ÷ días del mes
//   Te queda por día desde hoy = (ingresos − gastos) ÷ días que faltan (con hoy)
//
// Estado: "verde" si te queda por día igual o más que tu disponible por día;
// "ambar" si te queda menos (vas gastando más rápido de lo ideal); "rojo" si
// lo que te queda es negativo; "vacio" si este mes no hay ingresos (nunca un
// número inventado); "cerrado" si el mes ya terminó.
//
// El "mes" es el periodo del presupuesto (empieza el día 1, salvo que lo
// cambies en Herramientas). Solo cuentan ingresos y gastos (no transferencias
// ni pagos de tarjeta) y nunca lo "Excluido del presupuesto". Todo en
// centavos (enteros): sin errores de decimales. Las fechas son textos
// "AAAA-MM-DD" del día local del teléfono.
// Sin DOM ni Firebase: tests/finanzas-diario.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanzasDiario = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Número de día (sin horas ni husos horarios): resta exacta entre fechas.
const numDia = f => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10))) / 86400000;
// Días de `a` a `b`, contando los dos.
const diasEntre = (a, b) => Math.round(numDia(b) - numDia(a)) + 1;

// Centavos de un movimiento: montoCent (entero) o, en los viejos, amount en Bs.
function centDe(m) {
  if (Number.isInteger(m.montoCent)) return m.montoCent;
  const n = Number(m.amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Ingresos y gastos del periodo, en centavos.
function sumar(movimientos, inicio, fin) {
  let ingresosCent = 0, gastosCent = 0;
  (movimientos || []).forEach(m => {
    if (!m || m.excluded || !ISO.test(m.date || "") || m.date < inicio || m.date > fin) return;
    if (m.type === "ingreso") ingresosCent += centDe(m);
    else if (m.type === "gasto") gastosCent += centDe(m);
  });
  return { ingresosCent, gastosCent };
}

// o: { movimientos, inicio, fin, hoy (AAAA-MM-DD), presupuestoCent (ingresos
// presupuestados del periodo; 0 o nada = sin meta) }
function calcular(o) {
  const inicio = o.inicio, fin = o.fin, hoy = o.hoy;
  if (!ISO.test(inicio || "") || !ISO.test(fin || "") || !ISO.test(hoy || "") || fin < inicio) throw new Error("Fechas inválidas");
  const { ingresosCent, gastosCent } = sumar(o.movimientos, inicio, fin);
  const diasMes = diasEntre(inicio, fin);
  // Días que faltan contando hoy (el último día del mes queda 1: nunca se divide entre cero).
  const diasRestantes = hoy > fin ? 0 : diasEntre(hoy < inicio ? inicio : hoy, fin);
  const quedaCent = ingresosCent - gastosCent;
  // Hacia abajo: nunca promete más de lo que hay.
  const disponibleDiaCent = ingresosCent > 0 ? Math.floor(ingresosCent / diasMes) : 0;
  const quedaDiaCent = diasRestantes > 0 ? Math.floor(quedaCent / diasRestantes) : null;
  let estado;
  if (ingresosCent <= 0) estado = "vacio";
  else if (quedaCent < 0) estado = "rojo";
  else if (diasRestantes === 0) estado = "cerrado";
  else estado = quedaDiaCent >= disponibleDiaCent ? "verde" : "ambar";
  const meta = Number.isInteger(o.presupuestoCent) && o.presupuestoCent > 0 ? o.presupuestoCent : 0;
  return {
    estado, ingresosCent, gastosCent, quedaCent, diasMes, diasRestantes, disponibleDiaCent, quedaDiaCent,
    // Recibido vs. presupuestado (el presupuesto es solo la meta).
    presupuesto: meta ? { metaCent: meta, recibidoCent: ingresosCent, pct: Math.round((ingresosCent / meta) * 100) } : null
  };
}

return { calcular, sumar, diasEntre, centDe };
});
