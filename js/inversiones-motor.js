// ---------- Inversiones: motor sin pantalla ----------
// Lee, valida y resume los movimientos de users/{uid}/inversiones.
// Sin DOM ni Firebase: tests/inversiones-motor.test.js.
//
// Registros viejos ({date, name, amount, notes}, sin `tipo`) se muestran
// como "aporte" y NUNCA se reescriben: completarlos o editarlos solo AGREGA
// campos (tipo, ticker, cantidad, precio, comision, broker, fecha, nota).
// `fecha` y `nota`, si existen, mandan sobre `date` y `notes`.
// Detalle de campos: docs/INVERSIONES.md.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.InversionesMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const TIPOS = ["compra", "venta", "dividendo", "fondeo", "efectivo", "interes"];
const NOMBRE = { compra: "Compra", venta: "Venta", dividendo: "Dividendo", fondeo: "Fondeo", efectivo: "Depósito", interes: "Interés", aporte: "Aporte" };
const EMOJI = { compra: "🛒", venta: "💸", dividendo: "🌱", fondeo: "🏦", efectivo: "💵", interes: "📈", aporte: "📥" };
const NUCLEO = ["QQQ", "VOO", "SCHD", "VT", "VIG", "MSFT"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Ajustes por defecto (D-044): DCA de US$ 200 al mes en los 6 del núcleo,
// US$ 0,15 por ticker, AirTM 1,40 %, transferencia a Hapi 0,65 %, efectivo
// al 6,5 % anual. Objetivo: 95 % núcleo en partes iguales, 5 % satélite.
function ajustesBase() {
  const comision = 0.15;
  const porTicker = Math.floor(((200 - comision * NUCLEO.length) / NUCLEO.length) * 100) / 100;
  const objetivo = Math.round((95 / NUCLEO.length) * 100) / 100;
  const tickers = {};
  NUCLEO.forEach((t, i) => { tickers[t] = { grupo: "nucleo", dca: porTicker, objetivo, orden: i }; });
  return { v: 1, broker: "Hapi", comisionTicker: comision, comisionAirtm: 1.4, comisionTransferencia: 0.65, tasaEfectivo: 6.5, objetivoSatelite: 5, tickers };
}

// Ajustes guardados encima de los de por defecto (lo que falte se completa).
function ajustes(guardados) {
  const base = ajustesBase();
  const g = guardados && typeof guardados === "object" ? guardados : {};
  const out = Object.assign({}, base, g);
  out.tickers = g.tickers && typeof g.tickers === "object" ? g.tickers : base.tickers;
  ["comisionTicker", "comisionAirtm", "comisionTransferencia", "tasaEfectivo", "objetivoSatelite"].forEach(k => {
    if (!(typeof out[k] === "number" && isFinite(out[k]) && out[k] >= 0)) out[k] = base[k];
  });
  if (typeof out.broker !== "string" || !out.broker.trim()) out.broker = base.broker;
  return out;
}

// Tickers del núcleo, en su orden.
function nucleo(aj) {
  const t = ajustes(aj).tickers;
  return Object.keys(t).filter(k => t[k] && t[k].grupo === "nucleo")
    .sort((a, b) => ((t[a].orden ?? 99) - (t[b].orden ?? 99)) || a.localeCompare(b));
}

// ---- Números y textos ----
// Acepta "33,5", "33.5", "1.234,56" o "1,234.56". La coma sola es decimal
// (teclado del iPhone en español). El punto solo es decimal, salvo como
// miles al estilo venezolano: "8.020" u "8.020.000" (1 a 3 cifras sin cero
// adelante y grupos de 3).
function numero(v) {
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  let s = String(v == null ? "" : v).trim().replace(/\s|US\$|\$|Bs\.?/gi, "");
  if (!s) return NaN;
  const c = s.lastIndexOf(","), p = s.lastIndexOf(".");
  if (c >= 0 && p >= 0) {
    const dec = c > p ? "," : ".";
    s = s.split(dec === "," ? "." : ",").join("").replace(dec, ".");
  } else if (p >= 0) {
    if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
  } else if (c >= 0) {
    s = /^-?[1-9]\d{0,2}(,\d{3}){2,}$/.test(s) ? s.split(",").join("") : s.replace(",", ".");
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  return parseFloat(s);
}
const red = (n, d = 2) => { const f = Math.pow(10, d); return Math.round((n + Number.EPSILON) * f) / f; };
const num = (n, min, max) => (n || 0).toLocaleString("es-ES", { minimumFractionDigits: min, maximumFractionDigits: max });
const usd = n => `${n < 0 ? "−" : ""}US$ ${num(Math.abs(n), 2, 2)}`;
const bs = n => `Bs ${num(n, 2, 2)}`;
const cantidadTexto = n => num(n, 0, 6);
const pct = (n, d = 2) => `${num(n, 0, d)} %`;
const tickerOk = t => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(t);
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f) && !isNaN(new Date(f + "T12:00:00").getTime());
const texto = s => String(s == null ? "" : s).trim().slice(0, 300);

function fechaLarga(f) {
  if (!fechaOk(f)) return f || "";
  const [a, m, d] = f.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)} ${a}`;
}
function mesTitulo(mes) {
  const [a, m] = mes.split("-").map(Number);
  const n = MESES[m - 1] || "";
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${a}`;
}

// ---- Lectura: documento guardado → movimiento ----
const esViejo = d => d && d.v == null && typeof d.amount === "number";

function normalizar(id, d) {
  d = d || {};
  const viejo = esViejo(d);
  const tipo = TIPOS.includes(d.tipo) ? d.tipo : (viejo || d.tipo == null ? "aporte" : null);
  const m = {
    id, tipo: tipo || "desconocido", viejo,
    fecha: d.fecha || d.date || "",
    nota: d.nota != null ? String(d.nota) : (d.notes != null ? String(d.notes) : ""),
    broker: d.broker || "",
    creado: typeof d.creado === "number" ? d.creado : 0
  };
  if (viejo) { m.original = { fecha: d.date || "", nombre: d.name || "", monto: d.amount, nota: d.notes || "" }; }
  if (m.tipo === "aporte") { m.monto = Number(d.amount) || 0; m.nombre = d.name || ""; }
  if (m.tipo === "compra" || m.tipo === "venta") {
    m.ticker = String(d.ticker || "").toUpperCase();
    m.cantidad = Number(d.cantidad) || 0;
    m.precio = Number(d.precio) || 0;
    m.comision = Number(d.comision) || 0;
    m.bruto = red(m.cantidad * m.precio);
    m.total = m.tipo === "compra" ? red(m.bruto + m.comision) : red(m.bruto - m.comision);
    if (d.ronda) m.ronda = d.ronda;
  }
  if (m.tipo === "dividendo") { m.ticker = String(d.ticker || "").toUpperCase(); m.monto = Number(d.monto) || 0; }
  if (m.tipo === "interes") m.monto = Number(d.monto) || 0;
  if (m.tipo === "efectivo") { m.sentido = d.sentido === "retiro" ? "retiro" : "deposito"; m.monto = Number(d.monto) || 0; }
  if (m.tipo === "fondeo") {
    m.bs = Number(d.bs) || 0;
    m.tasa = Number(d.tasa) || 0;
    m.usdEnviado = Number(d.usdEnviado) || 0;
    m.comisionAirtm = Number(d.comisionAirtm) || 0;
    m.comisionTransferencia = Number(d.comisionTransferencia) || 0;
    m.usd = Number(d.usd) || 0;
    m.comision = red(m.comisionAirtm + m.comisionTransferencia);
  }
  return m;
}

// Más nuevo primero (fecha y, el mismo día, el último guardado).
function ordenar(movs) {
  return movs.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || (b.creado - a.creado) || String(b.id).localeCompare(String(a.id)));
}
function porMes(movs) {
  const grupos = [];
  ordenar(movs).forEach(m => {
    const mes = (m.fecha || "").slice(0, 7) || "sin-fecha";
    let g = grupos[grupos.length - 1];
    if (!g || g.mes !== mes) { g = { mes, titulo: mes === "sin-fecha" ? "Sin fecha" : mesTitulo(mes), items: [] }; grupos.push(g); }
    g.items.push(m);
  });
  return grupos;
}

// ---- Escritura: datos del formulario → documento ----
// datos: valores tal como vienen de los campos (texto). Devuelve
// { ok, errores: [{campo, texto}], doc, avisos }.
// opciones: { hoy: "AAAA-MM-DD", viejo: true si es un registro viejo }.
function validar(tipo, datos, opciones) {
  const o = opciones || {};
  const errores = [];
  const err = (campo, t) => errores.push({ campo, texto: t });
  const doc = { tipo };
  if (!TIPOS.includes(tipo)) { err("tipo", "Elige qué tipo de movimiento es."); return { ok: false, errores, doc: null }; }

  const fecha = String(datos.fecha || "").trim();
  if (!fechaOk(fecha)) err("fecha", "Pon la fecha.");
  else if (o.hoy && fecha > o.hoy) err("fecha", "La fecha no puede ser futura.");
  doc.fecha = fecha;

  const positivo = (campo, nombre, permitirCero) => {
    const n = numero(datos[campo]);
    if (!isFinite(n) || n < 0 || (!permitirCero && n === 0)) { err(campo, `Revisa ${nombre}.`); return 0; }
    return n;
  };
  const opcional = (campo, nombre) => {
    if (datos[campo] == null || String(datos[campo]).trim() === "") return 0;
    return positivo(campo, nombre, true);
  };

  if (tipo === "compra" || tipo === "venta" || tipo === "dividendo") {
    const t = String(datos.ticker || "").trim().toUpperCase();
    if (!tickerOk(t)) err("ticker", "Escribe el ticker (ej: VOO).");
    doc.ticker = t;
  }
  if (tipo === "compra" || tipo === "venta") {
    doc.cantidad = red(positivo("cantidad", "la cantidad"), 8);
    doc.precio = red(positivo("precio", "el precio"), 6);
    doc.comision = red(opcional("comision", "la comisión"));
  }
  if (tipo === "dividendo" || tipo === "interes" || tipo === "efectivo") doc.monto = red(positivo("monto", "el monto"));
  if (tipo === "efectivo") doc.sentido = datos.sentido === "retiro" ? "retiro" : "deposito";
  if (tipo === "fondeo") {
    doc.bs = red(opcional("bs", "los Bs enviados"));
    doc.tasa = red(opcional("tasa", "el tipo de cambio"), 4);
    doc.usdEnviado = red(opcional("usdEnviado", "los US$ comprados"));
    doc.comisionAirtm = red(opcional("comisionAirtm", "la comisión de AirTM"));
    doc.comisionTransferencia = red(opcional("comisionTransferencia", "la comisión de transferencia"));
    doc.usd = red(positivo("usd", "los US$ recibidos"));
    if (doc.bs > 0 && !doc.tasa) err("tasa", "Pon el tipo de cambio que pagaste.");
  }
  doc.broker = texto(datos.broker).slice(0, 40);
  doc.nota = texto(datos.nota);
  if (datos.ronda) doc.ronda = String(datos.ronda);

  if (errores.length) return { ok: false, errores, doc: null };
  if (!o.viejo) doc.v = 1;
  return { ok: true, errores: [], doc };
}

// Fondeo: cuentas automáticas a partir de Bs y tipo de cambio (o US$
// enviados). Las comisiones son % de lo que pasa por cada paso; si vienen
// escritas a mano (en US$), mandan esas.
function calcularFondeo(datos, aj) {
  const a = ajustes(aj);
  const b = numero(datos.bs), t = numero(datos.tasa);
  let enviado = numero(datos.usdEnviado);
  if (isFinite(b) && isFinite(t) && b > 0 && t > 0) enviado = b / t;
  if (!isFinite(enviado) || enviado <= 0) return null;
  const fijo = k => { const n = numero(datos[k]); return isFinite(n) && n >= 0 ? n : null; };
  const airtm = fijo("comisionAirtm") ?? enviado * a.comisionAirtm / 100;
  const transf = fijo("comisionTransferencia") ?? (enviado - airtm) * a.comisionTransferencia / 100;
  return { usdEnviado: red(enviado), comisionAirtm: red(airtm), comisionTransferencia: red(transf), usd: red(enviado - airtm - transf) };
}

// Completar o editar un registro viejo: solo campos nuevos (nunca date,
// name, amount ni notes). Devuelve lo que hay que AGREGAR con update().
function camposCompletar(doc) {
  const out = {};
  Object.keys(doc).forEach(k => { if (!["date", "name", "amount", "notes", "v"].includes(k)) out[k] = doc[k]; });
  return out;
}

// Precio y monto → cantidad (6 decimales, como las fracciones del broker).
function cantidadDesdeMonto(monto, precio) {
  const m = numero(monto), p = numero(precio);
  if (!(m > 0 && p > 0)) return null;
  return Math.floor((m / p) * 1e6) / 1e6;
}

// ---- Ronda DCA ----
const mesDe = f => String(f || "").slice(0, 7);

// filas: [{ticker, monto, precio, cantidad?}] (texto). Las filas sin monto
// ni precio se saltan. Devuelve { ok, errores, docs, total, comisiones }.
function ronda(datos, aj, opciones) {
  const a = ajustes(aj);
  const errores = [];
  const docs = [];
  const fecha = String(datos.fecha || "").trim();
  (datos.filas || []).forEach(f => {
    const vacio = v => v == null || String(v).trim() === "";
    if (vacio(f.monto) && vacio(f.precio) && vacio(f.cantidad)) return;
    const precio = numero(f.precio);
    const cantidad = vacio(f.cantidad) ? cantidadDesdeMonto(f.monto, f.precio) : numero(f.cantidad);
    const r = validar("compra", {
      fecha, ticker: f.ticker, cantidad, precio,
      comision: vacio(f.comision) ? a.comisionTicker : f.comision,
      broker: datos.broker || a.broker, nota: "Ronda DCA", ronda: mesDe(fecha)
    }, opciones);
    // Con la cantidad automática, el problema está en el monto o el precio.
    let errs = r.errores;
    if (vacio(f.cantidad) && errs.some(e => e.campo === "cantidad")) {
      errs = errs.filter(e => e.campo !== "cantidad");
      if (!errs.some(e => e.campo === "precio")) errs.push({ campo: "monto", texto: "Revisa el monto." });
    }
    if (!r.ok) errs.forEach(e => errores.push({ campo: `${f.ticker}.${e.campo}`, ticker: f.ticker, texto: `${f.ticker}: ${e.texto.charAt(0).toLowerCase()}${e.texto.slice(1)}` }));
    else docs.push(r.doc);
  });
  if (!fechaOk(fecha)) errores.unshift({ campo: "fecha", texto: "Pon la fecha." });
  if (!docs.length && !errores.length) errores.push({ campo: "filas", texto: "Escribe monto y precio de al menos un ticker." });
  const dedup = [];
  errores.forEach(e => { if (!dedup.some(x => x.texto === e.texto)) dedup.push(e); });
  const total = red(docs.reduce((s, d) => s + d.cantidad * d.precio, 0));
  const comisiones = red(docs.reduce((s, d) => s + d.comision, 0));
  return { ok: !dedup.length, errores: dedup, docs: dedup.length ? [] : docs, total, comisiones };
}

// Compras de rondas DCA registradas en un mes ("AAAA-MM").
function comprasDeRonda(movs, mes) {
  return movs.filter(m => m.tipo === "compra" && m.ronda === mes);
}

// ---- Resumen (sin precios todavía) ----
// Aportado = US$ que llegaron al broker (fondeos y depósitos − retiros).
// Si se compró más de lo que entró (compras sin fondeo anotado), esa
// diferencia también cuenta como aportado. Los aportes viejos sin
// completar suman su monto (D-044).
function resumen(movs) {
  const r = { fondeado: 0, retirado: 0, comprado: 0, vendido: 0, dividendos: 0, intereses: 0, aportesViejos: 0, nAportesViejos: 0,
    comisionesCompra: 0, comisionesFondeo: 0, bsEnviados: 0, usdComprados: 0, n: movs.length };
  movs.forEach(m => {
    if (m.tipo === "fondeo") { r.fondeado += m.usd; r.comisionesFondeo += m.comision; r.bsEnviados += m.bs; if (m.bs > 0) r.usdComprados += m.usdEnviado; }
    else if (m.tipo === "efectivo") { if (m.sentido === "retiro") r.retirado += m.monto; else r.fondeado += m.monto; }
    else if (m.tipo === "compra") { r.comprado += m.total; r.comisionesCompra += m.comision; }
    else if (m.tipo === "venta") { r.vendido += m.total; r.comisionesCompra += m.comision; }
    else if (m.tipo === "dividendo") r.dividendos += m.monto;
    else if (m.tipo === "interes") r.intereses += m.monto;
    else if (m.tipo === "aporte") { r.aportesViejos += m.monto; r.nAportesViejos++; }
  });
  const efectivoBruto = r.fondeado - r.retirado + r.vendido + r.dividendos + r.intereses - r.comprado;
  r.sinFondeo = red(Math.max(0, -efectivoBruto));
  r.efectivo = red(Math.max(0, efectivoBruto));
  r.aportado = red(r.fondeado - r.retirado + r.sinFondeo + r.aportesViejos);
  r.comisiones = red(r.comisionesCompra + r.comisionesFondeo);
  // Las comisiones de fondeo salen antes de llegar al broker: se comparan
  // con lo que salió de tu bolsillo (aportado + esas comisiones).
  const base = r.aportado + r.comisionesFondeo;
  r.comisionesPct = base > 0 ? red((r.comisiones / base) * 100) : 0;
  r.tasaPromedio = r.usdComprados > 0 ? red(r.bsEnviados / r.usdComprados, 4) : 0;
  ["fondeado", "retirado", "comprado", "vendido", "dividendos", "intereses", "aportesViejos", "comisionesCompra", "comisionesFondeo", "bsEnviados", "usdComprados"].forEach(k => { r[k] = red(r[k]); });
  return r;
}

// Interés estimado de un mes sobre el efectivo (tasa anual en %).
const interesMensual = (efectivo, tasaAnual) => red(efectivo * (tasaAnual / 100) / 12);

// Cantidad por ticker según compras y ventas (para avisar si se vende más
// de lo que hay). Las posiciones completas llegan en la fase 2.
function cantidades(movs, excluirId) {
  const out = {};
  movs.forEach(m => {
    if (m.id === excluirId || (m.tipo !== "compra" && m.tipo !== "venta")) return;
    out[m.ticker] = red((out[m.ticker] || 0) + (m.tipo === "compra" ? m.cantidad : -m.cantidad), 8);
  });
  return out;
}

// Tickers que ya usaste (para sugerirlos), núcleo primero.
function tickersConocidos(movs, aj) {
  const vistos = nucleo(aj);
  movs.forEach(m => { if (m.ticker && !vistos.includes(m.ticker)) vistos.push(m.ticker); });
  return vistos;
}

// Si el nombre de un aporte viejo parece un ticker, sugerirlo al completar.
function tickerSugerido(nombre) {
  const t = String(nombre || "").trim().toUpperCase();
  return tickerOk(t) ? t : "";
}

return {
  TIPOS, NOMBRE, EMOJI, NUCLEO, MESES,
  ajustesBase, ajustes, nucleo,
  numero, red, usd, bs, cantidadTexto, pct, fechaLarga, mesTitulo, mesDe, tickerOk, fechaOk,
  esViejo, normalizar, ordenar, porMes,
  validar, calcularFondeo, camposCompletar, cantidadDesdeMonto,
  ronda, comprasDeRonda, resumen, interesMensual, cantidades, tickersConocidos, tickerSugerido
};
});
