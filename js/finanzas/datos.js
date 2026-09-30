// ---------- Finanzas: capa de datos (lógica pura, sin pantalla ni Firebase) ----------
// Los datos siguen viviendo en Firestore (que ya los guarda en el teléfono y
// sincroniza solo). Este archivo decide CÓMO se leen y se escriben:
//
// - Montos en centavos (enteros). Los documentos viejos tienen "amount" con
//   decimales (12.5); al leerlos se convierten a centavos (1250). No se
//   reescriben: el original queda intacto. Lo que se guarda desde ahora lleva
//   los dos: "montoCent" (entero) y "amount" (decimal, por compatibilidad).
// - Saldos de carteras y totales siempre sumados en centavos: nunca se
//   desvían por un centavo.
// - Respaldo completo antes de la primera escritura con el formato nuevo y
//   verificación: misma cantidad de movimientos y mismos totales.
// - Fechas 'AAAA-MM-DD' en hora local (nunca toISOString: en Bolivia, después
//   de las 20:00 daría el día siguiente).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanzasDatos = factory();
})(typeof self !== "undefined" ? self : this, function () {

const ESQUEMA = 2;                 // versión del formato de Finanzas
const DOCS_POR_PARTE = 800;        // movimientos por documento de respaldo (Firestore: máx. 1 MB)

// ---------- Montos ----------
// Acepta números o texto con coma o punto decimal ("12,5", "1.234,50" no: el
// teclado propio nunca pone separador de miles).
function aCentavos(v) {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  // toFixed evita que 1.005 × 100 = 100,4999… se redondee hacia abajo.
  return Number.isFinite(n) ? Math.round(Number((n * 100).toFixed(6))) : 0;
}
function aBs(cent) {
  return cent / 100;
}
function montoValido(v) {
  return v != null && v !== "" && Number.isFinite(Number(v));
}
// ¿Tenía más de 2 decimales? (solo pasa con datos muy viejos o calculados)
function decimalesExtra(v) {
  if (!montoValido(v)) return false;
  return Math.abs(Number(v) * 100 - Math.round(Number(v) * 100)) > 1e-6;
}
function sumaCent(lista, fn) {
  let s = 0;
  for (const x of lista) s += aCentavos(fn(x));
  return s;
}
function sumaBs(lista, fn) {
  return aBs(sumaCent(lista, fn));
}

// Centavos de un documento: "amount" manda (si alguien edita con una versión
// vieja de la app, solo cambia "amount"); "montoCent" queda de respaldo.
function centDe(doc, campoDecimal, campoCent) {
  if (montoValido(doc[campoDecimal])) return aCentavos(doc[campoDecimal]);
  return Number.isInteger(doc[campoCent]) ? doc[campoCent] : 0;
}

// ---------- Lectura (el documento original no se toca) ----------
function adaptarMovimiento(id, d) {
  const doc = d || {};
  const cent = centDe(doc, "amount", "montoCent");
  const out = Object.assign({}, doc, { id, montoCent: cent, amount: aBs(cent) });
  if (doc.amountTo != null || Number.isInteger(doc.montoDestinoCent)) {
    const destino = centDe(doc, "amountTo", "montoDestinoCent");
    out.montoDestinoCent = destino;
    out.amountTo = aBs(destino);
  }
  if (typeof out.date !== "string") out.date = "";
  if (!out.type) out.type = "gasto";
  return out;
}
function adaptarAhorro(id, d) {
  const doc = d || {};
  const cent = centDe(doc, "amount", "montoCent");
  return Object.assign({}, doc, { id, montoCent: cent, amount: aBs(cent) });
}
function adaptarMovCartera(id, d) {
  const doc = d || {};
  const cent = centDe(doc, "monto", "montoCent");
  return Object.assign({}, doc, { id, montoCent: cent, monto: aBs(cent) });
}

// ---------- Escritura: lo nuevo lleva centavos + decimal ----------
function conCentavos(datos) {
  const out = Object.assign({}, datos);
  if ("amount" in out) { out.montoCent = aCentavos(out.amount); out.amount = aBs(out.montoCent); }
  if ("amountTo" in out && out.amountTo != null) { out.montoDestinoCent = aCentavos(out.amountTo); out.amountTo = aBs(out.montoDestinoCent); }
  if ("monto" in out) { out.montoCent = aCentavos(out.monto); out.monto = aBs(out.montoCent); }
  out.v = ESQUEMA;
  return out;
}
// Para "Deshacer": se vuelve a escribir el documento sin el id.
function sinId(obj) {
  const data = Object.assign({}, obj);
  delete data.id;
  return data;
}

// ---------- Carteras y saldos (en centavos) ----------
// Efectivo y Débito son "Yo"; las transferencias viejas usaban "gastos" y
// cuentan como Débito. La tarjeta de crédito acumula deuda. Ahorro va en US$
// (colección "ahorros") y las carteras propias en "carteras_movimientos".
const esEfectivo = id => id === "efectivo" || id === "debito" || id === "gastos";
const carteraEfectivo = id => (id === "gastos" ? "debito" : id);
const carteraDePago = pago => (pago === "efectivo" ? "efectivo" : "debito");

// Las transferencias nunca cuentan como ingreso ni gasto: solo mueven plata.
function saldos(movs) {
  const cash = { efectivo: 0, debito: 0 };
  let deuda = 0;
  for (const m of movs) {
    const c = m.montoCent != null ? m.montoCent : aCentavos(m.amount);
    if (m.type === "ingreso") cash[carteraDePago(m.payment)] += c;
    else if (m.type === "gasto") {
      if (m.payment === "credito") deuda += c;
      else cash[carteraDePago(m.payment)] -= c;
    } else if (m.type === "pago_tarjeta") {
      cash[carteraDePago(m.payment)] -= c;
      deuda -= c;
    } else if (m.type === "transferencia") {
      const recibido = m.montoDestinoCent != null ? m.montoDestinoCent : (m.amountTo != null ? aCentavos(m.amountTo) : c);
      if (esEfectivo(m.from)) cash[carteraEfectivo(m.from)] -= c;
      if (esEfectivo(m.to)) cash[carteraEfectivo(m.to)] += recibido;
      if (m.to === "tarjeta") deuda -= recibido;
    } else if (m.type === "ajuste_tarjeta") {
      deuda -= c;
    }
  }
  return { efectivo: cash.efectivo, debito: cash.debito, saldo: cash.efectivo + cash.debito, deuda };
}
function saldoCent(lista, campo) {
  return lista.reduce((s, x) => s + (x.montoCent != null ? x.montoCent : aCentavos(x[campo])), 0);
}

// ---------- Categorías: nunca mostrar "Otros" por una categoría borrada ----------
function etiquetaDesdeId(id) {
  const t = String(id || "").replace(/_\d+$/, "").replace(/[_-]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Sin categoría";
}

// ---------- Fechas locales ----------
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Verificación: mismos movimientos, mismos totales ----------
// crudos: documentos tal como están en Firestore; adaptados: lo que usa la
// app. Compara cantidad y totales por tipo (en centavos).
function verificar(crudos, adaptados) {
  const tipos = {};
  const fila = t => (tipos[t] = tipos[t] || { tipo: t, n: 0, nAdaptado: 0, centOriginal: 0, centAdaptado: 0 });
  let sumaOriginal = {}, extra = 0, invalidos = 0;
  for (const d of crudos) {
    const t = (d && d.type) || "gasto";
    fila(t).n++;
    const v = d && d.amount;
    if (!montoValido(v)) { if (!(d && Number.isInteger(d.montoCent))) invalidos++; }
    else if (decimalesExtra(v)) extra++;
    sumaOriginal[t] = (sumaOriginal[t] || 0) + (montoValido(v) ? Number(v) : (d && Number.isInteger(d.montoCent) ? d.montoCent / 100 : 0));
  }
  for (const m of adaptados) { const f = fila(m.type || "gasto"); f.nAdaptado++; f.centAdaptado += m.montoCent; }
  const filas = Object.values(tipos).map(f => {
    f.centOriginal = Math.round((sumaOriginal[f.tipo] || 0) * 100);
    // Con más de 2 decimales el redondeo por movimiento puede mover el total
    // hasta medio centavo por cada uno de esos movimientos.
    f.ok = f.n === f.nAdaptado && (f.centOriginal === f.centAdaptado || extra > 0);
    return f;
  }).sort((a, b) => a.tipo.localeCompare(b.tipo));
  return {
    ok: crudos.length === adaptados.length && filas.every(f => f.ok),
    total: crudos.length,
    porTipo: filas,
    conDecimalesExtra: extra,
    invalidos
  };
}

// ---------- Respaldo completo ----------
// datos: { finanzas:[{id,...}], ahorros:[...], carteras_movimientos:[...],
//          meta: { presupuestos:{...}, categorias_gasto:{...}, ... } }
// Devuelve el resumen y las partes (documentos de hasta DOCS_POR_PARTE).
function crearRespaldo(datos, ahora) {
  const creado = ahora || Date.now();
  const colecciones = ["finanzas", "ahorros", "carteras_movimientos"];
  const partes = [];
  const conteos = {};
  colecciones.forEach(c => {
    const lista = (datos[c] || []).map(x => Object.assign({}, x));
    conteos[c] = lista.length;
    for (let i = 0; i < lista.length; i += DOCS_POR_PARTE) {
      partes.push({ coleccion: c, desde: i, docs: lista.slice(i, i + DOCS_POR_PARTE) });
    }
  });
  partes.push({ coleccion: "meta", desde: 0, docs: [datos.meta || {}] });
  const totales = {};
  (datos.finanzas || []).forEach(d => {
    const t = d.type || "gasto";
    totales[t] = (totales[t] || 0) + aCentavos(d.amount != null ? d.amount : aBs(d.montoCent || 0));
  });
  return {
    resumen: { creado, esquema: ESQUEMA, conteos, totalesCent: totales, partes: partes.length },
    partes
  };
}
// Reconstruye el respaldo a partir de sus partes (para verificarlo o restaurar).
function unirRespaldo(partes) {
  const out = { finanzas: [], ahorros: [], carteras_movimientos: [], meta: {} };
  partes.slice().sort((a, b) => a.coleccion.localeCompare(b.coleccion) || a.desde - b.desde).forEach(p => {
    if (p.coleccion === "meta") out.meta = p.docs[0] || {};
    else if (out[p.coleccion]) out[p.coleccion] = out[p.coleccion].concat(p.docs);
  });
  return out;
}

// ---------- Copia de seguridad en archivo (JSON) ----------
const FORMATO = "manolo-finanzas";
const COLECCIONES = ["finanzas", "ahorros", "carteras_movimientos"];
// Documentos de meta/ que forman parte de Finanzas y viajan en la copia.
const META_COPIA = ["config_presupuesto", "presupuestos", "categorias_gasto", "categorias_ingreso", "carteras_custom", "finanzas_ajustes"];

function copiaCompleta(datos, ahora) {
  const t = ahora || Date.now();
  const out = { app: FORMATO, version: ESQUEMA, exportado: t, fecha: isoLocal(new Date(t)), datos: { meta: {} } };
  COLECCIONES.forEach(c => { out.datos[c] = (datos[c] || []).map(x => Object.assign({}, x)); });
  META_COPIA.forEach(n => { if (datos.meta && datos.meta[n]) out.datos.meta[n] = datos.meta[n]; });
  out.conteos = {};
  COLECCIONES.forEach(c => { out.conteos[c] = out.datos[c].length; });
  return out;
}

const esObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const idOk = id => typeof id === "string" && id.length > 0 && id.length <= 120 && id.indexOf("/") < 0 && id !== "." && id !== "..";

// Revisa que el archivo sea una copia de Finanzas de Manolo y que cada
// movimiento tenga lo mínimo (id, fecha y monto válidos).
function validarCopia(obj) {
  if (!esObj(obj) || obj.app !== FORMATO || !esObj(obj.datos)) {
    return { ok: false, error: "Este archivo no es una copia de Finanzas de Manolo." };
  }
  if (Number(obj.version) > ESQUEMA) {
    return { ok: false, error: "Esta copia es de una versión más nueva de Manolo. Actualiza la app y vuelve a intentar." };
  }
  const malos = [];
  const conteos = {};
  COLECCIONES.forEach(c => {
    const lista = obj.datos[c];
    if (lista != null && !Array.isArray(lista)) malos.push(c);
    conteos[c] = Array.isArray(lista) ? lista.length : 0;
  });
  if (malos.length) return { ok: false, error: "La copia está dañada: no se puede leer " + malos.join(", ") + "." };
  let invalidos = 0;
  (obj.datos.finanzas || []).forEach(m => {
    if (!esObj(m) || !idOk(m.id) || !/^\d{4}-\d{2}-\d{2}$/.test(m.date || "") || !(montoValido(m.amount) || Number.isInteger(m.montoCent))) invalidos++;
  });
  return { ok: true, conteos, invalidos, exportado: Number(obj.exportado) || null, fecha: typeof obj.fecha === "string" ? obj.fecha : null };
}

// Qué agregar al importar. Nunca borra ni cambia lo que ya tienes: se suman
// los movimientos con un id que no tienes, y en categorías, carteras y
// presupuesto solo lo que falta.
function planImportacion(copia, actual) {
  const v = validarCopia(copia);
  if (!v.ok) return { ok: false, error: v.error };
  const a = actual || {};
  const nuevos = {};
  let descartados = 0;
  COLECCIONES.forEach(c => {
    const tengo = new Set((a[c] || []).map(x => x.id));
    nuevos[c] = [];
    (copia.datos[c] || []).forEach(x => {
      if (!esObj(x) || !idOk(x.id)) { descartados++; return; }
      if (c === "finanzas" && (!/^\d{4}-\d{2}-\d{2}$/.test(x.date || "") || !(montoValido(x.amount) || Number.isInteger(x.montoCent)))) { descartados++; return; }
      if (!tengo.has(x.id)) nuevos[c].push(x);
    });
  });
  const mc = copia.datos.meta || {}, ma = a.meta || {};
  const meta = {};
  // Categorías de gasto: secciones y subcategorías que faltan, y archivadas.
  if (esObj(mc.categorias_gasto) && Array.isArray(mc.categorias_gasto.groups)) {
    const locales = esObj(ma.categorias_gasto) && Array.isArray(ma.categorias_gasto.groups) ? ma.categorias_gasto.groups : [];
    let cambio = false;
    const grupos = locales.map(g => Object.assign({}, g, { items: (g.items || []).slice() }));
    const todos = new Set();
    grupos.forEach(g => g.items.forEach(i => todos.add(i.id)));
    mc.categorias_gasto.groups.forEach(g => {
      if (!esObj(g) || !idOk(g.id)) return;
      let destino = grupos.find(x => x.id === g.id);
      if (!destino) { destino = Object.assign({}, g, { items: [] }); grupos.push(destino); cambio = true; }
      (g.items || []).forEach(i => { if (esObj(i) && idOk(i.id) && !todos.has(i.id)) { destino.items.push(i); todos.add(i.id); cambio = true; } });
    });
    const archLocal = (esObj(ma.categorias_gasto) && Array.isArray(ma.categorias_gasto.archivadas)) ? ma.categorias_gasto.archivadas : [];
    const archNuevas = (Array.isArray(mc.categorias_gasto.archivadas) ? mc.categorias_gasto.archivadas : []).filter(x => esObj(x) && idOk(x.id) && !archLocal.some(y => y.id === x.id) && !todos.has(x.id));
    const out = {};
    if (cambio) out.groups = grupos.filter(g => g.items.length);
    if (archNuevas.length) out.archivadas = archLocal.concat(archNuevas);
    if (Object.keys(out).length) meta.categorias_gasto = out;
  }
  const listaQueFalta = (nombre, campo) => {
    if (!esObj(mc[nombre]) || !Array.isArray(mc[nombre][campo])) return;
    const locales = esObj(ma[nombre]) && Array.isArray(ma[nombre][campo]) ? ma[nombre][campo] : [];
    const faltan = mc[nombre][campo].filter(x => esObj(x) && idOk(x.id) && !locales.some(y => y.id === x.id));
    if (faltan.length) meta[nombre] = { [campo]: locales.concat(faltan) };
  };
  listaQueFalta("categorias_ingreso", "list");
  listaQueFalta("carteras_custom", "list");
  if (esObj(mc.presupuestos)) {
    const faltan = {};
    Object.keys(mc.presupuestos).forEach(k => { if (idOk(k) && !(esObj(ma.presupuestos) && k in ma.presupuestos) && montoValido(mc.presupuestos[k])) faltan[k] = Number(mc.presupuestos[k]); });
    if (Object.keys(faltan).length) meta.presupuestos = faltan;
  }
  ["config_presupuesto", "finanzas_ajustes"].forEach(n => { if (esObj(mc[n]) && !esObj(ma[n])) meta[n] = mc[n]; });
  const resumen = { movimientos: nuevos.finanzas.length, ahorros: nuevos.ahorros.length, carteras: nuevos.carteras_movimientos.length, meta: Object.keys(meta), descartados };
  return { ok: true, nuevos, meta, resumen, vacio: !resumen.movimientos && !resumen.ahorros && !resumen.carteras && !resumen.meta.length };
}

// ---------- CSV (una fila por movimiento; Excel y Power BI) ----------
function celdaCsv(v) {
  const s = String(v == null ? "" : v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function aCsv(encabezados, filas) {
  // BOM para que Excel lea bien las tildes; separador coma y punto decimal.
  return "\ufeff" + [encabezados].concat(filas).map(f => f.map(celdaCsv).join(",")).join("\r\n") + "\r\n";
}
const montoCsv = cent => (cent / 100).toFixed(2);

// ---------- Teclado: montos con suma y resta (ej. "25+18−5") ----------
// La expresión se guarda como texto con coma decimal y los signos + y −.
const MAX_CIFRAS = 9;
function teclaMonto(expr, tecla) {
  const e = expr || "0";
  const ultimo = e.slice(-1);
  const esOp = c => c === "+" || c === "−";
  const tramo = e.split(/[+−]/).pop();
  if (tecla === "back") return e.length > 1 ? e.slice(0, -1) : "0";
  if (tecla === "+" || tecla === "−") {
    if (e === "0") return e;
    if (esOp(ultimo)) return e.slice(0, -1) + tecla;          // cambia el signo
    if (ultimo === ",") return e.slice(0, -1) + tecla;
    return e + tecla;
  }
  if (tecla === ",") {
    if (tramo.includes(",")) return e;
    return esOp(ultimo) ? e + "0," : e + ",";
  }
  if (/^\d$/.test(tecla)) {
    const dec = tramo.split(",")[1];
    if (dec !== undefined && dec.length >= 2) return e;
    if (tramo.replace(",", "").length >= MAX_CIFRAS) return e;
    if (e === "0") return tecla;
    if (tramo === "0") return e.slice(0, -1) + tecla;
    return e + tecla;
  }
  return e;
}
// Resultado en centavos, o null si la expresión no se puede leer.
function evaluarMonto(expr) {
  const e = String(expr || "").replace(/-/g, "−").replace(/\s/g, "").replace(/[+−,]+$/, "");
  if (!e) return 0;
  const partes = e.match(/[+−]?[^+−]+/g);
  if (!partes || partes.join("") !== e) return null;
  let total = 0;
  for (const p of partes) {
    const signo = p[0] === "−" ? -1 : 1;
    const num = p.replace(/^[+−]/, "");
    if (!/^\d+(,\d{0,2})?$/.test(num)) return null;
    total += signo * aCentavos(num);
  }
  return total;
}
const tieneOperacion = expr => /[+−]/.test(String(expr || "").slice(1));

return {
  teclaMonto, evaluarMonto, tieneOperacion,
  FORMATO, COLECCIONES, META_COPIA, copiaCompleta, validarCopia, planImportacion, celdaCsv, aCsv, montoCsv,
  ESQUEMA, DOCS_POR_PARTE,
  aCentavos, aBs, montoValido, decimalesExtra, sumaCent, sumaBs,
  adaptarMovimiento, adaptarAhorro, adaptarMovCartera, conCentavos, sinId,
  esEfectivo, carteraEfectivo, carteraDePago, saldos, saldoCent,
  etiquetaDesdeId, isoLocal, verificar, crearRespaldo, unirRespaldo
};
});
