// Cálculos de la pestaña Análisis de Finanzas. Sin pantalla ni Firebase:
// recibe movimientos ya adaptados (montoCent en centavos, fecha "AAAA-MM-DD")
// y devuelve números listos para dibujar. Todo en centavos.
//
// Reglas:
// - Solo cuentan gastos e ingresos. Las transferencias nunca son gasto ni
//   ingreso, y lo marcado "Excluir del presupuesto" tampoco cuenta.
// - Si el periodo que miras todavía no terminó, se compara "a la misma
//   altura": los días que ya pasaron contra los mismos días de los periodos
//   anteriores. Así el día 10 no parece que gastaste poquísimo.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanzasAnalisis = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const DIA_MS = 86400000;

function desdeIso(f) {
  const [y, m, d] = f.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function diasEntre(a, b) {
  return Math.round((desdeIso(b) - desdeIso(a)) / DIA_MS);
}
function cuenta(m) {
  return m && !m.excluded && (m.type === "gasto" || m.type === "ingreso") && Number.isInteger(m.montoCent) && m.montoCent > 0;
}
function promedio(lista) {
  return lista.length ? Math.round(lista.reduce((s, v) => s + v, 0) / lista.length) : 0;
}

// periodos: [{desde, hasta}] del más nuevo (el que miras) al más viejo.
// hoy: "AAAA-MM-DD". opciones: { umbralHormigaCent, previos (3) }.
function analizar(movs, periodos, hoy, opciones) {
  const op = Object.assign({ umbralHormigaCent: 2500, previos: 3 }, opciones || {});
  const P = periodos.map(p => {
    const dias = diasEntre(p.desde, p.hasta) + 1;
    return {
      desde: p.desde, hasta: p.hasta, dias,
      ingresos: 0, gastos: 0, gastosCorte: 0, n: 0,
      porCat: {}, porCatCorte: {}, porDia: {}, gastosLista: []
    };
  });
  const actual = P[0];
  // Cuántos días del periodo que miras ya pasaron (todos si ya terminó).
  const corte = hoy >= actual.hasta ? actual.dias : hoy < actual.desde ? 0 : diasEntre(actual.desde, hoy) + 1;
  const parcial = corte < actual.dias;
  const masViejo = P.reduce((min, p) => (p.desde < min ? p.desde : min), actual.desde);

  (movs || []).forEach(m => {
    if (!cuenta(m) || m.date < masViejo || m.date > actual.hasta) return;
    const i = P.findIndex(p => m.date >= p.desde && m.date <= p.hasta);
    if (i < 0) return;
    const p = P[i];
    p.n++;
    if (m.type === "ingreso") { p.ingresos += m.montoCent; return; }
    const cat = m.category || "otros";
    p.gastos += m.montoCent;
    p.porCat[cat] = (p.porCat[cat] || 0) + m.montoCent;
    p.porDia[m.date] = (p.porDia[m.date] || 0) + m.montoCent;
    // Con el periodo cerrado se compara completo (los meses no miden igual).
    if (!parcial || diasEntre(p.desde, m.date) < corte) {
      p.gastosCorte += m.montoCent;
      p.porCatCorte[cat] = (p.porCatCorte[cat] || 0) + m.montoCent;
    }
    if (i === 0) p.gastosLista.push(m);
  });

  // Periodos anteriores con algún movimiento (un periodo vacío no es "normal").
  const previos = P.slice(1, 1 + op.previos).filter(p => p.n > 0);
  const prom = {
    n: previos.length,
    gastos: promedio(previos.map(p => p.gastos)),
    gastosCorte: promedio(previos.map(p => p.gastosCorte)),
    ingresos: promedio(previos.map(p => p.ingresos)),
    porDia: promedio(previos.map(p => Math.round(p.gastos / p.dias))),
    tasaAhorro: (() => {
      const conIngreso = previos.filter(p => p.ingresos > 0);
      return conIngreso.length ? conIngreso.reduce((s, p) => s + (p.ingresos - p.gastos) / p.ingresos, 0) / conIngreso.length : null;
    })()
  };

  // Por categoría: lo de ahora contra el promedio a la misma altura.
  const ids = new Set(Object.keys(actual.porCatCorte));
  previos.forEach(p => Object.keys(p.porCatCorte).forEach(id => ids.add(id)));
  const cambios = previos.length ? Array.from(ids).map(id => {
    const ahora = actual.porCatCorte[id] || 0;
    const antes = Math.round(previos.reduce((s, p) => s + (p.porCatCorte[id] || 0), 0) / previos.length);
    return { id, ahora, antes, dif: ahora - antes, pct: antes > 0 ? (ahora - antes) / antes : null };
  }).filter(c => c.dif !== 0).sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif)) : [];

  // Días transcurridos del periodo: sin gastar, racha, fin de semana.
  const diasPasados = [];
  for (let k = 0; k < corte; k++) diasPasados.push(isoLocal(new Date(desdeIso(actual.desde).getTime() + k * DIA_MS + 12 * 3600000)));
  const sinGastar = diasPasados.filter(d => !actual.porDia[d]).length;
  let racha = 0;
  if (hoy >= actual.desde && hoy <= actual.hasta) {
    for (let k = diasPasados.length - 1; k >= 0 && !actual.porDia[diasPasados[k]]; k--) racha++;
  }
  let finde = 0;
  Object.keys(actual.porDia).forEach(d => {
    const w = desdeIso(d).getDay();
    if (w === 0 || w === 6) finde += actual.porDia[d];
  });

  // Por día de la semana (lunes = 0): promedio de lo gastado cada lunes,
  // cada martes… en el periodo que miras (hasta hoy) y los anteriores.
  const semTotal = [0, 0, 0, 0, 0, 0, 0], semVeces = [0, 0, 0, 0, 0, 0, 0];
  [actual].concat(previos).forEach((p, idx) => {
    const n = idx === 0 ? corte : p.dias;
    for (let k = 0; k < n; k++) {
      const d = new Date(desdeIso(p.desde).getTime() + k * DIA_MS + 12 * 3600000);
      const w = (d.getDay() + 6) % 7;
      semVeces[w]++;
      semTotal[w] += p.porDia[isoLocal(d)] || 0;
    }
  });
  const semana = semTotal.map((t, i) => (semVeces[i] ? Math.round(t / semVeces[i]) : 0));

  // Gastos hormiga: los pequeños que se repiten.
  const chicos = actual.gastosLista.filter(m => m.montoCent <= op.umbralHormigaCent);
  const hormigaCats = {};
  chicos.forEach(m => { hormigaCats[m.category] = (hormigaCats[m.category] || 0) + m.montoCent; });
  const hormigaTotal = chicos.reduce((s, m) => s + m.montoCent, 0);
  const hormiga = {
    n: chicos.length,
    total: hormigaTotal,
    // Al año, al ritmo de los días que ya pasaron.
    anual: corte > 0 ? Math.round(hormigaTotal / corte * 365 / 100) * 100 : 0,
    cats: Object.keys(hormigaCats).map(id => ({ id, total: hormigaCats[id] })).sort((a, b) => b.total - a.total)
  };

  const mayores = actual.gastosLista.slice().sort((a, b) => b.montoCent - a.montoCent || String(a.id).localeCompare(String(b.id))).slice(0, 5);

  return {
    parcial, corte,
    actual: { ingresos: actual.ingresos, gastos: actual.gastos, dias: actual.dias, n: actual.n, porCat: actual.porCat },
    prom,
    tasaAhorro: actual.ingresos > 0 ? (actual.ingresos - actual.gastos) / actual.ingresos : null,
    porDia: corte > 0 ? Math.round(actual.gastos / corte) : 0,
    sinGastar, racha,
    findePct: actual.gastos > 0 ? finde / actual.gastos : 0,
    cambios, semana, hormiga, mayores,
    // Del más viejo al que miras, para el gráfico.
    tendencia: P.slice().reverse().map(p => ({ desde: p.desde, hasta: p.hasta, ingresos: p.ingresos, gastos: p.gastos }))
  };
}

// Hasta 4 hallazgos, los más importantes primero. `nombre(id)` da el nombre
// de una categoría y `bs(cent)` el monto con formato.
function hallazgos(a, nombre, bs, umbralCent) {
  const out = [];
  const pct = x => `${Math.round(Math.abs(x) * 100)} %`;
  const g = a.actual.gastos;
  if (a.prom.n && a.prom.gastosCorte > 0 && a.corte > 0) {
    const r = (g - a.prom.gastosCorte) / a.prom.gastosCorte;
    if (Math.abs(r) >= 0.1) {
      out.push({
        tipo: r > 0 ? "sube" : "baja", peso: Math.abs(r) * 100 + 30,
        texto: a.parcial
          ? `Llevas ${bs(g)} gastados: ${pct(r)} ${r > 0 ? "más" : "menos"} que lo que sueles llevar a esta altura (${bs(a.prom.gastosCorte)}).`
          : `Gastaste ${bs(g)}: ${pct(r)} ${r > 0 ? "más" : "menos"} que tu promedio (${bs(a.prom.gastosCorte)}).`
      });
    }
  }
  const sube = a.cambios.filter(c => c.dif > 0 && c.dif >= 5000 && (c.antes === 0 || c.pct >= 0.15)).sort((x, y) => y.dif - x.dif)[0];
  if (sube) {
    out.push({
      tipo: "sube", peso: g > 0 ? sube.dif / g * 150 : 0,
      texto: sube.antes === 0
        ? `${nombre(sube.id)} es nuevo: ${bs(sube.ahora)} que en los meses anteriores no tenías.`
        : `${nombre(sube.id)} subió ${bs(sube.dif)} (${pct(sube.pct)} más que tu promedio de ${bs(sube.antes)}).`
    });
  }
  const baja = a.cambios.filter(c => c.dif < 0 && -c.dif >= 5000 && c.pct <= -0.15).sort((x, y) => x.dif - y.dif)[0];
  if (baja) {
    out.push({ tipo: "baja", peso: g > 0 ? -baja.dif / g * 100 : 0, texto: baja.ahora === 0
      ? `Bien: nada en ${nombre(baja.id)}${a.parcial ? " por ahora" : ""}, cuando normalmente llevas ${bs(baja.antes)}.`
      : `Bien: ${nombre(baja.id)} bajó ${bs(-baja.dif)} frente a tu promedio (${pct(baja.pct)} menos).` });
  }
  if (a.hormiga.n >= 5) {
    out.push({
      tipo: "hormiga", peso: (g > 0 ? a.hormiga.total / g * 100 : 0) + 10,
      texto: `${a.hormiga.n} gastos pequeños (hasta ${bs(umbralCent)}) suman ${bs(a.hormiga.total)}. A este ritmo serían ${bs(a.hormiga.anual)} en un año.`
    });
  }
  if (a.findePct >= 0.45 && a.actual.gastos > 0 && a.corte >= 7) {
    out.push({ tipo: "info", peso: (a.findePct - 0.3) * 100, texto: `El ${pct(a.findePct)} de lo que gastaste fue en sábado o domingo.` });
  }
  // Un pago fijo (alquiler, recurrente) no es novedad: se buscan los demás.
  const mayor = a.mayores.find(m => !m.recurrenteId && m.category !== "vivienda");
  if (mayor && g > 0 && mayor.montoCent / g >= 0.25 && a.mayores.length > 1) {
    const que = mayor.desc ? `${mayor.desc} (${nombre(mayor.category)})` : nombre(mayor.category);
    out.push({ tipo: "info", peso: mayor.montoCent / g * 50, texto: `Un solo gasto, ${que} de ${bs(mayor.montoCent)}, es el ${pct(mayor.montoCent / g)} de todo lo gastado.` });
  }
  return out.sort((x, y) => y.peso - x.peso).slice(0, 4);
}

// Cuántos meses podrías vivir con lo que tienes, gastando tu promedio.
function mesesCubiertos(disponibleCent, gastoMensualCent) {
  if (!(gastoMensualCent > 0)) return null;
  return Math.max(0, disponibleCent) / gastoMensualCent;
}

// A cuántas horas de trabajo equivale un gasto, con tu ingreso promedio.
function horasDeTrabajo(gastoCent, ingresoMensualCent, horasMes) {
  if (!(ingresoMensualCent > 0) || !(horasMes > 0)) return null;
  return gastoCent / (ingresoMensualCent / horasMes);
}

return { analizar, hallazgos, mesesCubiertos, horasDeTrabajo };
});
