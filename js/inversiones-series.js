// ---------- Inversiones: series para los gráficos (fase 3) ----------
// Valor y aportado día por día, aportes por mes, distribución contra el
// objetivo y rendimiento en US$ y en Bs (TCO del BCB y tipo real de AirTM).
// Sin DOM: tests/inversiones-series.test.js. Usa js/inversiones-motor.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./inversiones-motor.js"));
  else root.InversionesSeries = factory(root.InversionesMotor);
})(typeof self !== "undefined" ? self : this, function (M) {
"use strict";

const red = M.red;
function sumarDias(f, n) {
  const d = new Date(f + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const crono = movs => movs.slice().sort((x, y) => (x.fecha || "").localeCompare(y.fecha || "") || (x.creado - y.creado) || String(x.id).localeCompare(String(y.id)));

// Precio de un ticker día por día, con el mismo criterio que M.precioDe:
// el más reciente entre el cierre diario (hasta ese día) y el manual (si ya
// existía ese día). Avanza con un puntero porque los días van en orden.
function lectorPrecios(precios, manuales) {
  const cache = {};
  return (t, dia) => {
    let c = cache[t];
    if (!c) {
      const h = (precios && precios.tickers && precios.tickers[t] && precios.tickers[t].historial) || {};
      c = cache[t] = { fechas: Object.keys(h).filter(f => M.fechaOk(f) && h[f] > 0).sort(), h, i: -1 };
    }
    while (c.i + 1 < c.fechas.length && c.fechas[c.i + 1] <= dia) c.i++;
    const d = c.i >= 0 ? { fecha: c.fechas[c.i], precio: c.h[c.fechas[c.i]] } : null;
    const m0 = manuales && manuales[t];
    const m = m0 && Number(m0.precio) > 0 && M.fechaOk(m0.fecha) && m0.fecha <= dia ? { fecha: m0.fecha, precio: Number(m0.precio) } : null;
    if (m && (!d || m.fecha > d.fecha)) return m.precio;
    return d ? d.precio : null;
  };
}

// ---- Serie diaria: valor de la cartera y aportado ----
// Mismas cuentas que M.resumen y M.posiciones, pero acumulando día a día.
// Sin precio ese día, una posición vale su costo.
function serie(movs, precios, aj, hasta) {
  if (!movs.length) return [];
  const a = M.ajustes(aj);
  const lista = crono(movs).filter(m => M.fechaOk(m.fecha));
  if (!lista.length) return [];
  const desde = lista[0].fecha;
  const fin = hasta && hasta > desde ? hasta : lista[lista.length - 1].fecha;
  const precio = lectorPrecios(precios, a.preciosManuales);
  const pos = {};
  const s = { fondeado: 0, retirado: 0, comprado: 0, vendido: 0, dividendos: 0, intereses: 0, viejos: 0 };
  const out = [];
  let i = 0;
  for (let dia = desde; dia <= fin; dia = sumarDias(dia, 1)) {
    for (; i < lista.length && lista[i].fecha === dia; i++) {
      const m = lista[i];
      const p = m.ticker ? (pos[m.ticker] = pos[m.ticker] || { cantidad: 0, costo: 0 }) : null;
      if (m.tipo === "fondeo") s.fondeado += m.usd;
      else if (m.tipo === "efectivo") { if (m.sentido === "retiro") s.retirado += m.monto; else s.fondeado += m.monto; }
      else if (m.tipo === "compra") { s.comprado += m.total; p.cantidad += m.cantidad; p.costo += m.total; }
      else if (m.tipo === "venta") {
        s.vendido += m.total;
        const parte = p.cantidad > 0 ? Math.min(1, m.cantidad / p.cantidad) : 0;
        p.costo -= p.costo * parte;
        p.cantidad = Math.max(0, p.cantidad - m.cantidad);
        if (p.cantidad < 1e-9) { p.cantidad = 0; p.costo = 0; }
      } else if (m.tipo === "dividendo") s.dividendos += m.monto;
      else if (m.tipo === "interes") s.intereses += m.monto;
      else if (m.tipo === "aporte") s.viejos += m.monto;
    }
    const bruto = s.fondeado - s.retirado + s.vendido + s.dividendos + s.intereses - s.comprado;
    const efectivo = Math.max(0, bruto);
    let enPosiciones = 0;
    Object.keys(pos).forEach(t => {
      const p = pos[t];
      if (!(p.cantidad > 0)) return;
      const pr = precio(t, dia);
      enPosiciones += pr != null ? p.cantidad * pr : p.costo;
    });
    out.push({
      fecha: dia,
      valor: red(enPosiciones + efectivo + s.viejos),
      aportado: red(s.fondeado - s.retirado + Math.max(0, -bruto) + s.viejos),
      dividendos: red(s.dividendos),
      intereses: red(s.intereses)
    });
  }
  return out;
}

// Aportes de cada mes = cuánto subió (o bajó) lo aportado en ese mes.
function aportesPorMes(ser) {
  const meses = [];
  let previo = 0;
  ser.forEach((p, k) => {
    const mes = p.fecha.slice(0, 7);
    const ultimoDelMes = k === ser.length - 1 || ser[k + 1].fecha.slice(0, 7) !== mes;
    if (!ultimoDelMes) return;
    meses.push({ mes, titulo: M.mesTitulo(mes), corto: M.MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3), monto: red(p.aportado - previo) });
    previo = p.aportado;
  });
  return meses;
}

// Total mensual de la ronda DCA según Ajustes (con comisiones).
function metaMensual(aj) {
  const a = M.ajustes(aj);
  const n = M.nucleo(a).filter(t => a.tickers[t].dca > 0);
  return red(n.reduce((s, t) => s + a.tickers[t].dca, 0) + n.length * a.comisionTicker);
}

// ---- Distribución contra el objetivo ----
// Peso de cada posición (sobre el valor de las posiciones) y, para el
// núcleo, su % objetivo. El satélite tiene un objetivo para todo el grupo.
function distribucion(pos, aj) {
  const a = M.ajustes(aj);
  const filas = pos.abiertas.map(o => ({
    ticker: o.ticker, grupo: o.grupo, peso: o.peso,
    objetivo: o.grupo === "nucleo" && a.tickers[o.ticker] && typeof a.tickers[o.ticker].objetivo === "number" ? a.tickers[o.ticker].objetivo : null
  }));
  // Tickers del núcleo que todavía no compraste también tienen objetivo.
  M.nucleo(a).forEach(t => {
    if (!filas.some(f => f.ticker === t)) filas.push({ ticker: t, grupo: "nucleo", peso: 0, objetivo: typeof a.tickers[t].objetivo === "number" ? a.tickers[t].objetivo : null });
  });
  const nucleo = red(filas.filter(f => f.grupo === "nucleo").reduce((s, f) => s + f.peso, 0), 1);
  const satelite = red(filas.filter(f => f.grupo === "satelite").reduce((s, f) => s + f.peso, 0), 1);
  const objNucleo = red(M.nucleo(a).reduce((s, t) => s + (a.tickers[t].objetivo || 0), 0), 1);
  return {
    filas: filas.sort((x, y) => (x.grupo === y.grupo ? 0 : x.grupo === "nucleo" ? -1 : 1) || y.peso - x.peso || x.ticker.localeCompare(y.ticker)),
    nucleo, satelite, objetivoNucleo: objNucleo, objetivoSatelite: a.objetivoSatelite,
    hayPosiciones: pos.abiertas.length > 0
  };
}

// ---- Tipos de cambio ----
// TCO del BCB (data/tipo-cambio.json) en una fecha: el último publicado
// hasta ese día; antes del historial, el primero que hay.
function lectorTco(tipoCambio) {
  const h = (tipoCambio && tipoCambio.historial) || {};
  const fechas = Object.keys(h).filter(f => M.fechaOk(f) && h[f] > 0).sort();
  if (!fechas.length) {
    const u = tipoCambio && tipoCambio.ultimo;
    return u && u.tco > 0 ? () => u.tco : null;
  }
  return fecha => {
    let mejor = fechas[0];
    for (const f of fechas) { if (f <= fecha) mejor = f; else break; }
    return h[mejor];
  };
}
// Tipo real de AirTM según tus fondeos con Bs:
// - costoEn(fecha): Bs pagados por cada US$ que llegó al broker, promedio de
//   los fondeos hasta esa fecha (antes del primero, el del primero).
//   Incluye las comisiones, porque es lo que de verdad te costó.
// - ultimo: el tipo de cambio del último fondeo (para valuar hoy).
function lectorReal(movs) {
  const f = crono(movs).filter(m => m.tipo === "fondeo" && m.bs > 0 && m.usd > 0);
  if (!f.length) return null;
  const pasos = [];
  let bs = 0, usd = 0;
  f.forEach(m => { bs += m.bs; usd += m.usd; pasos.push({ fecha: m.fecha, tasa: bs / usd }); });
  const u = f[f.length - 1];
  return {
    costoEn: fecha => { let t = pasos[0].tasa; for (const p of pasos) { if (p.fecha <= fecha) t = p.tasa; else break; } return t; },
    ultimo: u.tasa > 0 ? u.tasa : (u.usdEnviado > 0 ? u.bs / u.usdEnviado : u.bs / u.usd),
    fechaUltimo: u.fecha,
    promedio: bs / usd
  };
}

// Rendimiento por ticker en una moneda: cada compra cuesta su US$ × tasa
// de ese día; las ventas sacan costo en proporción; los dividendos suman a
// la tasa de su día; lo que queda se valúa a `tasaHoy`. El % es sobre todo
// lo que pusiste en ese ticker (la suma de sus compras).
function porTicker(movs, precios, aj, tasaEn, tasaHoy) {
  const out = {};
  const pos = M.posiciones(movs, precios, aj);
  const de = t => (out[t] = out[t] || { ticker: t, cantidad: 0, costo: 0, puesto: 0, realizado: 0, dividendos: 0 });
  crono(movs).forEach(m => {
    if (!m.ticker || !["compra", "venta", "dividendo"].includes(m.tipo)) return;
    const p = de(m.ticker), tasa = tasaEn(m.fecha);
    if (m.tipo === "compra") { p.cantidad += m.cantidad; p.costo += m.total * tasa; p.puesto += m.total * tasa; }
    else if (m.tipo === "venta") {
      const parte = p.cantidad > 0 ? Math.min(1, m.cantidad / p.cantidad) : 0;
      const costoVendido = p.costo * parte;
      p.realizado += m.total * tasa - costoVendido;
      p.costo -= costoVendido;
      p.cantidad = Math.max(0, p.cantidad - m.cantidad);
      if (p.cantidad < 1e-9) { p.cantidad = 0; p.costo = 0; }
    } else p.dividendos += m.monto * tasa;
  });
  return Object.keys(out).map(t => {
    const p = out[t];
    const o = pos.abiertas.concat(pos.cerradas).find(x => x.ticker === t) || {};
    const valorUsd = o.valor != null ? o.valor : (o.invertido || 0); // sin precio: a su costo
    const valor = p.cantidad > 0 ? valorUsd * tasaHoy : 0;
    const total = valor - p.costo + p.realizado + p.dividendos;
    return { ticker: t, total: red(total), pct: p.puesto > 0 ? red((total / p.puesto) * 100) : 0, sinPrecio: p.cantidad > 0 && o.valor == null };
  });
}

// ---- Rendimiento total y por ticker: US$, Bs (TCO) y Bs (AirTM) ----
function rendimiento(movs, precios, aj, tipoCambio, hoy) {
  const ser = serie(movs, precios, aj, hoy);
  if (!ser.length) return null;
  const ultimo = ser[ser.length - 1];
  const tco = lectorTco(tipoCambio);
  const real = lectorReal(movs);
  const usd = { valor: ultimo.valor, aportado: ultimo.aportado, gp: red(ultimo.valor - ultimo.aportado) };
  usd.pct = usd.aportado > 0 ? red((usd.gp / usd.aportado) * 100) : 0;

  // Lo aportado en Bs: cada día que sube lo aportado, a la tasa de ese día.
  // Con el tipo real, los fondeos con Bs cuentan exactamente sus Bs.
  const fondeosBs = {};
  movs.forEach(m => {
    if (m.tipo === "fondeo" && m.bs > 0 && m.usd > 0) {
      const f = fondeosBs[m.fecha] = fondeosBs[m.fecha] || { bs: 0, usd: 0 };
      f.bs += m.bs; f.usd += m.usd;
    }
  });
  let aportadoTco = 0, aportadoReal = 0, previo = 0;
  ser.forEach(p => {
    const delta = p.aportado - previo;
    previo = p.aportado;
    const f = fondeosBs[p.fecha];
    if (tco && delta) aportadoTco += delta * tco(p.fecha);
    if (real && (delta || f)) {
      let resto = delta;
      if (f) { aportadoReal += f.bs; resto -= f.usd; }
      aportadoReal += resto * real.costoEn(p.fecha);
    }
  });
  const enBs = (aportado, tasaHoy) => {
    const valor = usd.valor * tasaHoy, gp = valor - aportado;
    return { tasa: red(tasaHoy, 4), valor: red(valor), aportado: red(aportado), gp: red(gp), pct: aportado > 0 ? red((gp / aportado) * 100) : 0 };
  };
  const tcoHoy = tco ? tco(hoy) : null;
  const bsTco = tco ? enBs(aportadoTco, tcoHoy) : null;
  const bsReal = real ? enBs(aportadoReal, real.ultimo) : null;
  if (bsReal) bsReal.fecha = real.fechaUltimo;
  if (bsTco) bsTco.fecha = tipoCambio && tipoCambio.ultimo && tipoCambio.ultimo.fecha;

  // Por ticker: G/P abierta + ganancia realizada + dividendos.
  const fUsd = porTicker(movs, precios, aj, () => 1, 1);
  const fTco = tco ? porTicker(movs, precios, aj, tco, tcoHoy) : [];
  const fReal = real ? porTicker(movs, precios, aj, real.costoEn, real.ultimo) : [];
  const tickers = fUsd.map(u => ({
    ticker: u.ticker, usd: u.total, pct: u.pct, sinPrecio: u.sinPrecio,
    bsTco: (fTco.find(x => x.ticker === u.ticker) || {}).total ?? null,
    bsReal: (fReal.find(x => x.ticker === u.ticker) || {}).total ?? null
  })).sort((x, y) => y.usd - x.usd || x.ticker.localeCompare(y.ticker));
  return { usd, bsTco, bsReal, tickers };
}

// Dividendos acumulados por ticker (de mayor a menor).
function dividendosPorTicker(movs) {
  const t = {};
  movs.forEach(m => { if (m.tipo === "dividendo") t[m.ticker] = (t[m.ticker] || 0) + m.monto; });
  return Object.keys(t).map(k => ({ ticker: k, monto: red(t[k]) })).sort((x, y) => y.monto - x.monto);
}

return { sumarDias, serie, aportesPorMes, metaMensual, distribucion, lectorTco, lectorReal, porTicker, rendimiento, dividendosPorTicker };
});
