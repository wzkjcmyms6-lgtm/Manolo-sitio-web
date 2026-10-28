// ---------- Finanzas: tarjetas de crédito (lógica pura, sin pantalla ni Firebase) ----------
// El dueño puede tener varias tarjetas, cada una con su límite (pedido del
// 2026-10-29). Se guardan en meta/finanzas_tarjetas { list: [...] }.
//
// La cartera "tarjeta" de siempre sigue siendo UNA sola (la suma de todas):
// Disponible, colchón, transferencias y filtros no cambian. Aquí solo se
// reparte esa deuda por tarjeta con el campo nuevo "tarjetaId" de cada
// movimiento. Lo viejo (sin tarjetaId, o con una tarjeta que ya no existe)
// cuenta para la primera de la lista, la "principal". Así la suma de las
// deudas por tarjeta es siempre igual a la deuda total.
// Pruebas: tests/finanzas-tarjetas.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanzasTarjetas = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const COLORES = ["#e05656", "#4d9de0", "#9b6bde", "#ffb84d", "#5cc98a", "#ff6b9a"];
const MAX = 10;
const LIMITE_MAX_CENT = 1000000000;   // Bs 10 millones

const centDe = (n, dec) => (Number.isInteger(n) ? n : (typeof dec === "number" && isFinite(dec) ? Math.round(dec * 100) : null));

// Lo guardado → tarjetas limpias (se ignora lo que no tenga id o nombre).
function normalizar(list) {
  const vistos = new Set();
  return (Array.isArray(list) ? list : []).filter(t => t && typeof t.id === "string" && t.id && typeof t.nombre === "string" && t.nombre.trim() && !vistos.has(t.id) && vistos.add(t.id))
    .map((t, i) => {
      const lim = centDe(t.limiteCent, t.limite);
      const dia = Number(t.diaPago);
      return {
        id: t.id,
        nombre: t.nombre.trim(),
        limiteCent: lim != null && lim > 0 ? lim : 0,
        diaPago: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null,
        color: typeof t.color === "string" && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : COLORES[i % COLORES.length],
        creado: Number(t.creado) || 0
      };
    });
}

// ¿A qué tarjeta va este movimiento? (null si no hay tarjetas registradas)
function tarjetaDe(m, tarjetas) {
  if (!tarjetas || !tarjetas.length) return null;
  return m && tarjetas.some(t => t.id === m.tarjetaId) ? m.tarjetaId : tarjetas[0].id;
}

// Cuánto cambia la deuda de la tarjeta con este movimiento (centavos; + = debes más).
// Mismas reglas que FinanzasDatos.saldos().
function efectoDeuda(m) {
  if (!m) return 0;
  const c = Number.isInteger(m.montoCent) ? m.montoCent : Math.round((Number(m.amount) || 0) * 100);
  if (m.type === "gasto") return m.payment === "credito" ? c : 0;
  if (m.type === "pago_tarjeta" || m.type === "ajuste_tarjeta") return -c;
  if (m.type === "transferencia" && m.to === "tarjeta") {
    const recibido = Number.isInteger(m.montoDestinoCent) ? m.montoDestinoCent : (m.amountTo != null ? Math.round(Number(m.amountTo) * 100) : c);
    return -recibido;
  }
  return 0;
}

// Deuda de cada tarjeta: { id: centavos }.
function deudas(movs, tarjetas) {
  const out = {};
  (tarjetas || []).forEach(t => { out[t.id] = 0; });
  if (!tarjetas || !tarjetas.length) return out;
  (movs || []).forEach(m => {
    const d = efectoDeuda(m);
    if (d) out[tarjetaDe(m, tarjetas)] += d;
  });
  return out;
}

// Próximo día de pago (en meses más cortos, el último día). hoy: "AAAA-MM-DD".
function proximoPago(dia, hoy) {
  const [a, m, d] = hoy.split("-").map(Number);
  const enMes = (y, mes) => {
    const ultimo = new Date(Date.UTC(y, mes + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, mes, Math.min(dia, ultimo)));
  };
  const h = new Date(Date.UTC(a, m - 1, d));
  let f = enMes(a, m - 1);
  if (f < h) f = enMes(a, m);
  return { fecha: f.toISOString().slice(0, 10), dias: Math.round((f - h) / 86400000) };
}

function nivel(uso) {
  if (uso > 1) return "pasado";
  if (uso >= 0.8) return "alto";
  if (uso >= 0.5) return "medio";
  return "ok";
}

// Todo lo que muestra la pantalla. diaGlobal: el "Día de pago de la tarjeta"
// de Ajustes, para las tarjetas que no tienen uno propio.
function estado(movs, tarjetas, hoy, diaGlobal) {
  const d = deudas(movs, tarjetas);
  const lista = (tarjetas || []).map(t => {
    const deudaCent = d[t.id] || 0;
    const uso = t.limiteCent > 0 ? Math.max(deudaCent, 0) / t.limiteCent : 0;
    return Object.assign({}, t, {
      deudaCent,
      disponibleCent: t.limiteCent - Math.max(deudaCent, 0),
      uso, nivel: nivel(uso),
      pago: proximoPago(t.diaPago || diaGlobal || 29, hoy)
    });
  });
  const limiteCent = lista.reduce((s, t) => s + t.limiteCent, 0);
  const deudaCent = lista.reduce((s, t) => s + t.deudaCent, 0);
  const usado = lista.reduce((s, t) => s + Math.max(t.deudaCent, 0), 0);
  const uso = limiteCent > 0 ? usado / limiteCent : 0;
  return { lista, total: { limiteCent, deudaCent, disponibleCent: limiteCent - usado, uso, nivel: nivel(uso) } };
}

// "5000", "5000,50", "5.000" o "15.000,50" (punto de miles, como en Bolivia) → centavos.
function leerMonto(txt) {
  const s = String(txt == null ? "" : txt).replace(/\s|Bs\.?/gi, "");
  if (!s) return null;
  let n;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) n = Number(s.replace(/\./g, "").replace(",", "."));
  else if (/^\d+([.,]\d{1,2})?$/.test(s)) n = Number(s.replace(",", "."));
  else return NaN;
  return Math.round(n * 100);
}

// Formulario → { ok, errores: [{ campo, texto }], datos: { nombre, limiteCent, diaPago } }.
function validar(entrada, tarjetas, editandoId) {
  const e = entrada || {};
  const errores = [];
  const nombre = String(e.nombre || "").trim().replace(/\s+/g, " ");
  if (!nombre) errores.push({ campo: "nombre", texto: "Ponle un nombre (por ejemplo, Visa BNB)." });
  else if (nombre.length > 40) errores.push({ campo: "nombre", texto: "El nombre es muy largo (máximo 40 letras)." });
  else if ((tarjetas || []).some(t => t.id !== editandoId && t.nombre.toLowerCase() === nombre.toLowerCase())) errores.push({ campo: "nombre", texto: "Ya tienes una tarjeta con ese nombre." });
  const lim = leerMonto(e.limite);
  if (lim == null) errores.push({ campo: "limite", texto: "Escribe el límite de la tarjeta." });
  else if (!Number.isFinite(lim)) errores.push({ campo: "limite", texto: "El límite tiene que ser un número (por ejemplo, 5000)." });
  else if (lim <= 0) errores.push({ campo: "limite", texto: "El límite tiene que ser mayor que cero." });
  else if (lim > LIMITE_MAX_CENT) errores.push({ campo: "limite", texto: "Revisa el límite: es demasiado alto." });
  let diaPago = null;
  if (e.diaPago !== "" && e.diaPago != null) {
    const dia = Number(e.diaPago);
    if (Number.isInteger(dia) && dia >= 1 && dia <= 31) diaPago = dia;
    else errores.push({ campo: "diaPago", texto: "El día de pago va del 1 al 31." });
  }
  if (!editandoId && (tarjetas || []).length >= MAX) errores.push({ campo: "nombre", texto: `Puedes registrar hasta ${MAX} tarjetas.` });
  return { ok: !errores.length, errores, datos: { nombre, limiteCent: Number.isFinite(lim) ? lim : null, diaPago } };
}

// Tarjeta nueva para guardar (con el límite también en Bs, como el resto de Finanzas).
// El id nunca repite uno existente (dos tarjetas creadas en el mismo milisegundo).
function nueva(datos, tarjetas, ahora) {
  const t = ahora || Date.now();
  const lista = tarjetas || [];
  const usados = new Set(lista.map(x => x.id));
  let id = `tc_${t.toString(36)}`;
  for (let i = 2; usados.has(id); i++) id = `tc_${t.toString(36)}_${i}`;
  return { id, nombre: datos.nombre, limiteCent: datos.limiteCent, limite: datos.limiteCent / 100, diaPago: datos.diaPago, color: COLORES[lista.length % COLORES.length], creado: t };
}
// Misma tarjeta con lo editado (conserva id, color y creado).
function editar(tarjeta, datos) {
  return Object.assign({}, tarjeta, { nombre: datos.nombre, limiteCent: datos.limiteCent, limite: datos.limiteCent / 100, diaPago: datos.diaPago });
}

return { COLORES, MAX, normalizar, tarjetaDe, efectoDeuda, deudas, proximoPago, nivel, estado, leerMonto, validar, nueva, editar };
});
