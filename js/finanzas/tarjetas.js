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
// Seguros y mantenimiento (D-165, pedido del dueño 2026-11-25): no hay pago
// mínimo; el dueño paga siempre todo, para no pagar intereses. Lo que el banco
// cobra cada mes, siempre igual (seguros, mantenimiento), se anota en la
// tarjeta: cargos [{ id, nombre, montoCent }]. Lo que hay que pagar antes del
// día de pago = lo que debes + los cargos de este ciclo que todavía no se
// anotaron. Al pagar, esos cargos se anotan como gastos de la tarjeta
// (cargoCiclo = el día de pago del ciclo, cargoId = cuál): así la deuda y el
// presupuesto quedan bien. Si en este ciclo ya pagaste todo, la tarjeta está
// "al día" y lo que gastes después va al pago siguiente. El pago mínimo de
// antes (D-121, pagoMinimoCent) queda guardado, pero ya no se usa.
// Día de corte y de qué sale lo que pagas (D-166, pedido del dueño
// 2026-11-25): con el día de corte, lo que pagas es lo del extracto (hasta el
// corte) y lo que gastes después va al pago siguiente; cuenta() da el detalle
// (los gastos, los seguros, el saldo de antes y lo ya pagado).
// Pruebas: tests/finanzas-tarjetas.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanzasTarjetas = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const COLORES = ["#e05656", "#4d9de0", "#9b6bde", "#ffb84d", "#5cc98a", "#ff6b9a"];
const MAX = 10;
const MAX_CARGOS = 6;
const LIMITE_MAX_CENT = 1000000000;   // Bs 10 millones

const centDe = (n, dec) => (Number.isInteger(n) ? n : (typeof dec === "number" && isFinite(dec) ? Math.round(dec * 100) : null));

// Lo guardado → tarjetas limpias (se ignora lo que no tenga id o nombre).
function normalizar(list) {
  const vistos = new Set();
  return (Array.isArray(list) ? list : []).filter(t => t && typeof t.id === "string" && t.id && typeof t.nombre === "string" && t.nombre.trim() && !vistos.has(t.id) && vistos.add(t.id))
    .map((t, i) => {
      const lim = centDe(t.limiteCent, t.limite);
      const dia = Number(t.diaPago);
      const corte = Number(t.diaCorte);
      const min = centDe(t.pagoMinimoCent, t.pagoMinimo);
      return {
        id: t.id,
        nombre: t.nombre.trim(),
        limiteCent: lim != null && lim > 0 ? lim : 0,
        diaPago: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null,
        diaCorte: Number.isInteger(corte) && corte >= 1 && corte <= 31 ? corte : null,
        color: typeof t.color === "string" && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : COLORES[i % COLORES.length],
        creado: Number(t.creado) || 0,
        pagoMinimoCent: min != null && min > 0 && min <= LIMITE_MAX_CENT ? min : null,   // D-121: ya no se usa (solo para avisar)
        cargos: normalizarCargos(t.cargos),
        cargosCategoria: typeof t.cargosCategoria === "string" && t.cargosCategoria ? t.cargosCategoria : null
      };
    });
}
// Seguros y mantenimiento guardados → limpios: [{ id, nombre, montoCent }].
function normalizarCargos(lista) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : [])
    .filter(c => c && typeof c.id === "string" && c.id && typeof c.nombre === "string" && c.nombre.trim() && !vistos.has(c.id) && vistos.add(c.id))
    .map(c => ({ id: c.id, nombre: c.nombre.trim(), montoCent: centDe(c.montoCent, c.monto) }))
    .filter(c => c.montoCent != null && c.montoCent > 0 && c.montoCent <= LIMITE_MAX_CENT)
    .slice(0, MAX_CARGOS);
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

// Día de pago anterior al próximo (el inicio del ciclo de este pago).
function pagoAnterior(dia, hoy) {
  const [a, m] = proximoPago(dia, hoy).fecha.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 2, Math.min(dia, ultimo))).toISOString().slice(0, 10);
}
// Lo que pagaste a una tarjeta entre dos fechas (desde exclusivo, hasta
// inclusivo), en centavos. Solo pagos (no ajustes ni devoluciones).
function pagado(movs, tarjetas, id, desde, hasta) {
  return (movs || []).reduce((s, m) => {
    if (!m || !(m.type === "pago_tarjeta" || (m.type === "transferencia" && m.to === "tarjeta"))) return s;
    if (!(m.date > desde && m.date <= hasta) || tarjetaDe(m, tarjetas) !== id) return s;
    return s - efectoDeuda(m);
  }, 0);
}
// Los cargos de un ciclo (el que termina el día de pago "hasta") que todavía
// no se anotaron como gastos de la tarjeta.
function cargosPendientes(t, movs, tarjetas, hasta) {
  const anotados = new Set((movs || []).filter(m => m && m.type === "gasto" && m.cargoCiclo === hasta && m.cargoId && tarjetaDe(m, tarjetas) === t.id).map(m => m.cargoId));
  return (t.cargos || []).filter(c => !anotados.has(c.id));
}
// Los cargos que se suman a un pago hecho en esa fecha: { ciclo, lista, cent }.
function cargosDelPago(t, movs, tarjetas, fecha, diaGlobal) {
  const ciclo = proximoPago(t.diaPago || diaGlobal || 29, fecha).fecha;
  const lista = cargosPendientes(t, movs, tarjetas, ciclo);
  return { ciclo, lista, cent: lista.reduce((s, c) => s + c.montoCent, 0) };
}
// Los gastos que anotan esos cargos (el id y createdAt los pone quien guarda).
// Con día de corte, llevan la fecha del corte (salen en ese extracto), salvo
// que pagues antes del corte.
function gastosDeCargos(t, pend, fecha, categoria) {
  const corte = t.diaCorte ? corteDe(t.diaCorte, pend.ciclo) : null;
  const f = corte && corte < fecha ? corte : fecha;
  return pend.lista.map(c => ({ date: f, type: "gasto", category: categoria, payment: "credito", desc: c.nombre, amount: c.montoCent / 100,
    excluded: false, factura: false, tarjetaId: t.id, cargoCiclo: pend.ciclo, cargoId: c.id }));
}
// La categoría de esos gastos: la elegida; si no, una de banco o seguros; si no, "Otros".
// categorias: [{ id, label }] (las de gasto).
function categoriaCargos(t, categorias) {
  const lista = categorias || [];
  if (t && t.cargosCategoria && lista.some(c => c.id === t.cargosCategoria)) return t.cargosCategoria;
  const parecida = lista.find(c => /seguro|banc|comisi|financ|tarjeta/i.test(c.label || ""));
  if (parecida) return parecida.id;
  if (lista.some(c => c.id === "otros")) return "otros";
  return lista.length ? lista[0].id : "otros";
}
// El corte del extracto que pagas el día "pago": el último día de corte
// antes del día de pago (en meses más cortos, el último día del mes).
function corteDe(diaCorte, pago) {
  const [a, m] = pago.split("-").map(Number);
  const enMes = (y, mes) => {
    const ultimo = new Date(Date.UTC(y, mes + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, mes, Math.min(diaCorte, ultimo)));
  };
  let f = enMes(a, m - 1);
  if (f.toISOString().slice(0, 10) >= pago) f = enMes(a, m - 2);
  return f.toISOString().slice(0, 10);
}
// Orden en que pasaron: por fecha y, el mismo día, por cuándo se anotó.
const porOrden = (a, b) => String(a.date).localeCompare(String(b.date)) || (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
const esPago = m => m.type === "pago_tarjeta" || (m.type === "transferencia" && m.to === "tarjeta");
// De qué sale lo que pagas (D-166). Una ventana de movimientos de la tarjeta:
// - con día de corte: del corte anterior (sin incluirlo) al corte de este
//   pago; lo de después del corte (gastos) va al pago siguiente, y los pagos de
//   después del corte cuentan para este;
// - sin corte: del día de pago anterior (sin incluirlo) a hoy; si un pago te
//   dejó en cero, hasta ese pago (al día) y lo de después va al pago siguiente.
// Lo de antes de la ventana es el saldo de antes (negativo: a favor).
// { pago, desde, corte, abierto (el extracto todavía no cerró), antesCent,
//   gastos, cargos (ya anotados), pendientes (por anotar), pagos, nuevos,
//   sinPendCent, totalCent, alDia }. Los movimientos van en orden.
function cuenta(t, movs, tarjetas, hoy, diaGlobal) {
  const dia = t.diaPago || diaGlobal || 29;
  const pago = proximoPago(dia, hoy);
  const desde = pagoAnterior(dia, hoy);
  const orden = (movs || []).filter(m => m && efectoDeuda(m) && String(m.date) <= hoy && tarjetaDe(m, tarjetas) === t.id).sort(porOrden);
  const d = [];
  orden.reduce((s, m, i) => (d[i] = s + efectoDeuda(m)), 0);
  const ultimo = cond => { for (let i = orden.length - 1; i >= 0; i--) if (cond(orden[i], i)) return i; return -1; };
  let corte = null, inicio, fin, alDia = null;
  if (t.diaCorte) {
    corte = corteDe(t.diaCorte, pago.fecha);
    const anterior = corteDe(t.diaCorte, corte);
    inicio = ultimo(m => m.date <= anterior);
    fin = ultimo(m => m.date <= corte);
  } else {
    inicio = ultimo(m => m.date <= desde);
    fin = orden.length - 1;
    const k = ultimo((m, i) => i > inicio && esPago(m) && d[i] <= 0);
    if (k >= 0) { fin = k; alDia = orden[k].date; }
  }
  const ventana = orden.slice(inicio + 1, fin + 1), despues = orden.slice(fin + 1);
  const suma = l => l.reduce((s, m) => s + efectoDeuda(m), 0);
  const antesCent = inicio < 0 ? 0 : d[inicio];
  const gastos = ventana.filter(m => efectoDeuda(m) > 0 && !m.cargoId);
  const cargos = ventana.filter(m => efectoDeuda(m) > 0 && m.cargoId);
  const pagos = ventana.concat(corte ? despues : []).filter(m => efectoDeuda(m) < 0);
  const nuevos = despues.filter(m => efectoDeuda(m) > 0);
  const sinPendCent = antesCent + suma(gastos) + suma(cargos) + suma(pagos);
  if (corte) {
    const ult = pagos.filter(m => esPago(m) && m.date > desde).pop();
    if (sinPendCent <= 0 && ult) alDia = ult.date;
  }
  const pendientes = alDia ? [] : cargosPendientes(t, movs, tarjetas, pago.fecha);
  const totalCent = sinPendCent + pendientes.reduce((s, c) => s + c.montoCent, 0);
  return { pago, desde, corte, abierto: !!corte && corte >= hoy, antesCent, gastos, cargos, pendientes, pagos, nuevos, sinPendCent, totalCent, alDia };
}
// Lo que conviene pagar antes del día de pago para no pagar intereses:
// { cent, deudaCent (lo gastado que falta pagar), favorCent, cargosCent y
//   cargos (por anotar), alDia, pagadoCent (en este ciclo), urgencia, desde,
//   corte, abierto, despuesCent (lo que va al pago siguiente) }.
// Rojo hoy o mañana; ámbar a 7 días o menos.
function aPagar(t, movs, tarjetas, hoy, diaGlobal) {
  const c = cuenta(t, movs, tarjetas, hoy, diaGlobal);
  const cent = Math.max(0, c.totalCent);
  const urgencia = !cent ? "ok" : c.pago.dias <= 1 ? "mal" : c.pago.dias <= 7 ? "aviso" : "normal";
  return { cent, deudaCent: Math.max(0, c.sinPendCent), favorCent: Math.max(0, -c.sinPendCent),
    cargosCent: c.pendientes.reduce((s, x) => s + x.montoCent, 0), cargos: c.pendientes,
    alDia: c.alDia, pagadoCent: Math.max(0, pagado(movs, tarjetas, t.id, c.desde, hoy)), urgencia, desde: c.desde,
    corte: c.corte, abierto: c.abierto, despuesCent: c.nuevos.reduce((s, m) => s + efectoDeuda(m), 0) };
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
    const pago = proximoPago(t.diaPago || diaGlobal || 29, hoy);
    return Object.assign({}, t, {
      deudaCent,
      disponibleCent: t.limiteCent - Math.max(deudaCent, 0),
      uso, nivel: nivel(uso),
      pago,
      pagar: aPagar(t, movs, tarjetas, hoy, diaGlobal),
      cargosMesCent: (t.cargos || []).reduce((s, c) => s + c.montoCent, 0)
    });
  });
  const limiteCent = lista.reduce((s, t) => s + t.limiteCent, 0);
  const deudaCent = lista.reduce((s, t) => s + t.deudaCent, 0);
  const usado = lista.reduce((s, t) => s + Math.max(t.deudaCent, 0), 0);
  const uso = limiteCent > 0 ? usado / limiteCent : 0;
  const pagarCent = lista.reduce((s, t) => s + t.pagar.cent, 0);
  return { lista, total: { limiteCent, deudaCent, disponibleCent: limiteCent - usado, uso, nivel: nivel(uso) }, pagarCent };
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

// Formulario → { ok, errores: [{ campo, texto }], datos: { nombre, limiteCent, diaPago, diaCorte, cargos, cargosCategoria } }.
// cargos: [{ id?, nombre, monto }] tal como están en el formulario (filas vacías: se ignoran).
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
  // Día de corte: opcional (vacío = no lo sabes; se paga todo lo que debes).
  let diaCorte = null;
  if (e.diaCorte !== "" && e.diaCorte != null) {
    const dc = Number(e.diaCorte);
    if (Number.isInteger(dc) && dc >= 1 && dc <= 31) diaCorte = dc;
    else errores.push({ campo: "diaCorte", texto: "El día de corte va del 1 al 31." });
  }
  // Seguros y mantenimiento: opcionales, cada uno con qué es y cuánto por mes.
  const cargos = [];
  (Array.isArray(e.cargos) ? e.cargos : []).forEach((c, i) => {
    const n = String((c && c.nombre) || "").trim().replace(/\s+/g, " ");
    const m = leerMonto(c && c.monto);
    if (!n && m == null) return;
    const cual = n ? `«${n}»` : "ese cargo";
    if (!n) errores.push({ campo: `cargoNombre${i}`, texto: "Escribe qué es cada cargo (por ejemplo, Seguro de desgravamen)." });
    else if (n.length > 40) errores.push({ campo: `cargoNombre${i}`, texto: `El nombre ${cual} es muy largo (máximo 40 letras).` });
    if (m == null) errores.push({ campo: `cargoMonto${i}`, texto: `Escribe cuánto te cobran por ${cual} cada mes.` });
    else if (!Number.isFinite(m)) errores.push({ campo: `cargoMonto${i}`, texto: `El monto de ${cual} tiene que ser un número (por ejemplo, 35).` });
    else if (m <= 0) errores.push({ campo: `cargoMonto${i}`, texto: `El monto de ${cual} tiene que ser mayor que cero.` });
    else if (m > LIMITE_MAX_CENT) errores.push({ campo: `cargoMonto${i}`, texto: `Revisa el monto de ${cual}: es demasiado alto.` });
    else if (n && n.length <= 40) cargos.push({ id: c && typeof c.id === "string" && c.id ? c.id : null, nombre: n, montoCent: m });
  });
  if (cargos.length > MAX_CARGOS) errores.push({ campo: "cargoNombre0", texto: `Puedes anotar hasta ${MAX_CARGOS} cargos por tarjeta.` });
  if (!editandoId && (tarjetas || []).length >= MAX) errores.push({ campo: "nombre", texto: `Puedes registrar hasta ${MAX} tarjetas.` });
  // En qué categoría se anotan como gasto (solo si hay cargos).
  const cargosCategoria = cargos.length && typeof e.cargosCategoria === "string" && e.cargosCategoria ? e.cargosCategoria : null;
  return { ok: !errores.length, errores, datos: { nombre, limiteCent: Number.isFinite(lim) ? lim : null, diaPago, diaCorte, cargos, cargosCategoria } };
}
// Cargos para guardar: con id (los nuevos reciben uno que no repite) y el monto también en Bs.
function cargosParaGuardar(cargos, ahora) {
  const usados = new Set(cargos.filter(c => c.id).map(c => c.id));
  return cargos.map((c, i) => {
    let id = c.id;
    if (!id) {
      id = `cg_${ahora.toString(36)}_${i}`;
      for (let k = 2; usados.has(id); k++) id = `cg_${ahora.toString(36)}_${i}_${k}`;
      usados.add(id);
    }
    return { id, nombre: c.nombre, montoCent: c.montoCent, monto: c.montoCent / 100 };
  });
}
const mismosCargos = (a, b) => JSON.stringify((a || []).map(c => [c.id, c.nombre, c.montoCent])) === JSON.stringify((b || []).map(c => [c.id, c.nombre, c.montoCent]));

// Tarjeta nueva para guardar (con el límite también en Bs, como el resto de Finanzas).
// El id nunca repite uno existente (dos tarjetas creadas en el mismo milisegundo).
function nueva(datos, tarjetas, ahora) {
  const t = ahora || Date.now();
  const lista = tarjetas || [];
  const usados = new Set(lista.map(x => x.id));
  let id = `tc_${t.toString(36)}`;
  for (let i = 2; usados.has(id); i++) id = `tc_${t.toString(36)}_${i}`;
  const out = { id, nombre: datos.nombre, limiteCent: datos.limiteCent, limite: datos.limiteCent / 100, diaPago: datos.diaPago, color: COLORES[lista.length % COLORES.length], creado: t };
  if (datos.cargos && datos.cargos.length) Object.assign(out, { cargos: cargosParaGuardar(datos.cargos, t), cargosActualizado: t });
  if (datos.cargosCategoria) out.cargosCategoria = datos.cargosCategoria;
  if (datos.diaCorte) out.diaCorte = datos.diaCorte;
  return out;
}
// Misma tarjeta con lo editado (conserva id, color, creado y lo que no se toca).
function editar(tarjeta, datos, ahora) {
  const out = Object.assign({}, tarjeta, { nombre: datos.nombre, limiteCent: datos.limiteCent, limite: datos.limiteCent / 100, diaPago: datos.diaPago });
  // Seguros y mantenimiento: la lista nueva (cada uno conserva su id).
  const t = ahora || Date.now();
  const cargos = cargosParaGuardar(datos.cargos || [], t);
  if (!mismosCargos(cargos, normalizarCargos(tarjeta.cargos))) Object.assign(out, { cargos, cargosActualizado: t });
  if (datos.cargosCategoria && datos.cargosCategoria !== tarjeta.cargosCategoria) out.cargosCategoria = datos.cargosCategoria;
  if ((datos.diaCorte || null) !== (tarjeta.diaCorte || null)) out.diaCorte = datos.diaCorte || null;
  return out;
}

return { COLORES, MAX, MAX_CARGOS, normalizar, normalizarCargos, tarjetaDe, efectoDeuda, deudas, proximoPago, pagoAnterior, pagado, cargosPendientes, cargosDelPago, gastosDeCargos, categoriaCargos, corteDe, cuenta, aPagar, nivel, estado, leerMonto, validar, nueva, editar };
});
