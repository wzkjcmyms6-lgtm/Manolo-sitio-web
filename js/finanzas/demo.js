// ---------- Finanzas: modo demo ----------
// 6 meses de datos FICTICIOS (en Bs) para probar la app sin tocar tus datos.
// Se guardan aparte, solo en este teléfono (localStorage), en un almacén que
// imita a Firestore: con el modo demo activo, Finanzas lee y escribe ahí y
// nunca en la nube. Salir del modo demo borra ese almacén.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanzasDemo = factory();
})(typeof self !== "undefined" ? self : this, function () {

const CLAVE_MODO = "manolo.finanzas.modo";      // "demo" mientras está activo
const CLAVE_DATOS = "manolo.finanzas.demo.v1";  // el almacén demo

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// Datos demo: del día 1 de hace 5 meses hasta hoy. Todo inventado.
function generarDemo(hoy) {
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const ini = new Date(fin.getFullYear(), fin.getMonth() - 5, 1);
  const r = azar(20260930);
  const entre = (a, b) => a + r() * (b - a);
  const bs = (a, b, paso) => Math.round(entre(a, b) / (paso || 0.5)) * (paso || 0.5);
  const elegir = lista => lista[Math.floor(r() * lista.length)];
  const finanzas = [], ahorros = [], carteras = [];
  let n = 0, t = ini.getTime();
  const id = () => "demo-" + String(++n).padStart(5, "0");
  const mov = (fecha, datos) => { t += 60000; const m = Object.assign({ id: id(), date: fecha, desc: "", excluded: false, createdAt: t }, datos); m.montoCent = Math.round(m.amount * 100); finanzas.push(m); return m; };
  const gasto = (fecha, category, amount, desc, extra) => mov(fecha, Object.assign({ type: "gasto", category, payment: "debito", amount, desc, factura: false }, extra));
  let creditoMes = 0;

  mov(iso(ini), { type: "ingreso", category: "salario", payment: "debito", amount: 4200, desc: "Saldo inicial", excluded: true });
  mov(iso(ini), { type: "ingreso", category: "salario", payment: "efectivo", amount: 350, desc: "Saldo inicial", excluded: true });
  ahorros.push({ id: id(), date: iso(ini), amount: 1200, montoCent: 120000, notes: "Saldo inicial", createdAt: t });
  carteras.push({ id: id(), carteraId: "viajes", fecha: iso(ini), monto: 1500, montoCent: 150000, nota: "Saldo inicial", createdAt: t });

  for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
    const f = iso(d), dia = d.getDate(), sem = d.getDay();
    if (dia === 1) {
      mov(f, { type: "ingreso", category: "salario", payment: "debito", amount: 9200, desc: "Sueldo" });
      if (r() < 0.35) mov(f, { type: "ingreso", category: "salario", payment: "efectivo", amount: bs(250, 600, 50), desc: "Trabajo extra" });
    }
    if (dia === 5) gasto(f, "vivienda", 2800, "Alquiler");
    if (dia === 10) {
      gasto(f, "vivienda", bs(150, 215), "Luz", { factura: true });
      gasto(f, "vivienda", bs(55, 80), "Agua", { factura: true });
      gasto(f, "suscripciones", 249, "Internet", { factura: true });
    }
    if (dia === 15) {
      gasto(f, "suscripciones", 62, "Streaming", { payment: "credito" });
      gasto(f, "suscripciones", 36, "Música", { payment: "credito" });
      creditoMes += 98;
    }
    if (dia === 20) {
      // Ahorro mensual: Bs → US$ al tipo de cambio oficial
      const idAhorro = id();
      ahorros.push({ id: idAhorro, date: f, amount: 100.57, montoCent: 10057, notes: "Transferencia desde Débito", createdAt: t });
      mov(f, { type: "transferencia", category: "transferencia", from: "debito", to: "ahorro", amount: 700, amountTo: 100.57, montoDestinoCent: 10057, tipoCambio: 6.96, links: [{ kind: "ahorro", id: idAhorro }] });
      const idViaje = id();
      carteras.push({ id: idViaje, carteraId: "viajes", fecha: f, monto: 300, montoCent: 30000, nota: "Transferencia desde Débito", createdAt: t });
      mov(f, { type: "transferencia", category: "transferencia", from: "debito", to: "viajes", amount: 300, amountTo: 300, montoDestinoCent: 30000, desc: "Para el viaje", links: [{ kind: "cartera", id: idViaje }] });
    }
    if (dia === 28 && creditoMes > 0) {
      mov(f, { type: "pago_tarjeta", category: "pago_tarjeta", payment: "debito", amount: Math.round(creditoMes * 100) / 100, desc: "Pago de tarjeta de crédito" });
      creditoMes = 0;
    }
    if (sem === 1) mov(f, { type: "transferencia", category: "transferencia", from: "debito", to: "efectivo", amount: 300, amountTo: 300, montoDestinoCent: 30000, desc: "Retiro en cajero", links: [] });
    // Comida todos los días
    const comidas = r() < 0.3 ? 2 : 1;
    for (let k = 0; k < comidas; k++) gasto(f, "comida", bs(12, 45), elegir(["Almuerzo", "Salteñas", "Café", "Cena", "Api con pastel", "Menú del día"]), { payment: "efectivo" });
    if (sem === 6 && Math.floor(dia / 7) % 2 === 0) gasto(f, "comida", bs(280, 420, 1), "Supermercado", { factura: true });
    // Transporte
    if (sem !== 0) gasto(f, "transporte", bs(3, 6), "Trufi", { payment: "efectivo" });
    if (r() < 0.2) gasto(f, "transporte", bs(15, 35), "Taxi", { payment: "efectivo" });
    if (sem === 3) gasto(f, "transporte", bs(150, 230, 1), "Gasolina", { factura: true });
    // Salidas, compras y salud
    if ((sem === 5 || sem === 6) && r() < 0.6) {
      const c = bs(45, 180, 1);
      const pago = r() < 0.4 ? "credito" : "debito";
      gasto(f, "entretenimiento", c, elegir(["Cine", "Salida con amigos", "Concierto", "Cena fuera"]), { payment: pago });
      if (pago === "credito") creditoMes += c;
    }
    if (r() < 0.06) { const c = bs(120, 420, 1); gasto(f, "compras", c, elegir(["Ropa", "Zapatos", "Regalo", "Libro"]), { payment: "credito", factura: true }); creditoMes += c; }
    if (r() < 0.04) gasto(f, "salud", bs(30, 140, 1), elegir(["Farmacia", "Consulta", "Análisis"]), { factura: true });
    if (r() < 0.02) gasto(f, "otros", bs(50, 150, 1), "Compra para un amigo (me devuelve)", { excluded: true });
  }

  const meta = {
    config_presupuesto: { startDay: 1 },
    presupuestos: { salario: 9200, vivienda: 3100, suscripciones: 350, comida: 1900, transporte: 900, entretenimiento: 600, compras: 400, salud: 200 },
    categorias_gasto: { groups: [
      { id: "comida", nombre: "Comida y bebida", items: [{ id: "comida", label: "Comida", icon: "food", tipo: "variable" }] },
      { id: "transporte", nombre: "Transporte", items: [{ id: "transporte", label: "Transporte", icon: "transport", tipo: "variable" }] },
      { id: "vivienda", nombre: "Vivienda", items: [{ id: "vivienda", label: "Vivienda", icon: "home", tipo: "fijo" }] },
      { id: "salud", nombre: "Salud", items: [{ id: "salud", label: "Salud", icon: "health", tipo: "variable" }] },
      { id: "entretenimiento", nombre: "Entretenimiento", items: [{ id: "entretenimiento", label: "Entretenimiento", icon: "entertainment", tipo: "variable" }] },
      { id: "compras", nombre: "Compras", items: [{ id: "compras", label: "Compras", icon: "shopping", tipo: "variable" }] },
      { id: "suscripciones", nombre: "Suscripciones", items: [{ id: "suscripciones", label: "Suscripciones", icon: "subscription", tipo: "fijo" }] },
      { id: "otros", nombre: "Otros", items: [{ id: "otros", label: "Otros", icon: "otherCategory", tipo: "variable" }] }
    ] },
    categorias_ingreso: { list: [{ id: "salario", label: "Salario", icon: "salary", color: "#5cc98a" }] },
    carteras_custom: { list: [{ id: "viajes", nombre: "Viajes", moneda: "Bs" }] },
    finanzas_ajustes: { reivaPct: 5, diaPagoTarjeta: 28 }
  };
  return { finanzas, ahorros, carteras_movimientos: carteras, meta };
}

// ---------- Almacén local con la forma de Firestore ----------
// Solo lo que usa Finanzas: collection/doc, add, set (con merge), update,
// delete, get, onSnapshot y batch.
function crearAlmacen(inicial, almacenamiento) {
  const ls = almacenamiento || (typeof localStorage !== "undefined" ? localStorage : null);
  const clon = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  let estado = null;
  try { estado = ls && JSON.parse(ls.getItem(CLAVE_DATOS) || "null"); } catch (e) { estado = null; }
  if (!estado || !estado.cols) {
    estado = { cols: { finanzas: {}, ahorros: {}, carteras_movimientos: {}, meta: {}, finanzas_respaldos: {} } };
    ["finanzas", "ahorros", "carteras_movimientos"].forEach(c => (inicial[c] || []).forEach(x => { const d = Object.assign({}, x); delete d.id; estado.cols[c][x.id] = d; }));
    Object.keys(inicial.meta || {}).forEach(k => { estado.cols.meta[k] = clon(inicial.meta[k]); });
  }
  const guardar = () => { try { if (ls) ls.setItem(CLAVE_DATOS, JSON.stringify(estado)); } catch (e) { /* sin espacio: queda en memoria */ } };
  guardar();
  const col = c => (estado.cols[c] = estado.cols[c] || {});
  let n = 0;
  const nuevoId = () => "d" + Date.now().toString(36) + (n++).toString(36) + Math.random().toString(36).slice(2, 6);
  const subsCol = {}, subsDoc = {};
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = (c, id) => ({ id, exists: col(c)[id] !== undefined, data: () => clon(col(c)[id]), metadata: meta });
  const snapCol = c => {
    const docs = Object.keys(col(c)).map(id => ({ id, data: () => clon(col(c)[id]) }));
    return { docs, size: docs.length, empty: !docs.length, metadata: meta, docChanges: () => docs.map(d => ({ type: "modified", doc: d })) };
  };
  const pendientes = new Set();
  const avisar = (c, id) => {
    pendientes.add(c + "|" + id);
    if (pendientes.size > 1) return;
    setTimeout(() => {
      const lista = Array.from(pendientes);
      pendientes.clear();
      const cols = new Set(lista.map(x => x.split("|")[0]));
      cols.forEach(cc => (subsCol[cc] || []).forEach(cb => cb(snapCol(cc))));
      lista.forEach(x => { const [cc, ii] = x.split("|"); (subsDoc[cc + "/" + ii] || []).forEach(cb => cb(snapDoc(cc, ii))); });
    }, 0);
  };
  const fusionar = (dest, src) => {
    Object.keys(src).forEach(k => {
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v) && dest[k] && typeof dest[k] === "object" && !Array.isArray(dest[k])) fusionar(dest[k], v);
      else dest[k] = clon(v);
    });
  };
  const oyente = (a, b) => (typeof a === "function" ? a : b);
  function docRef(c, id) {
    return {
      id,
      get: () => Promise.resolve(snapDoc(c, id)),
      set(v, opt) {
        if (opt && opt.merge && col(c)[id]) fusionar(col(c)[id], v); else col(c)[id] = clon(v);
        guardar(); avisar(c, id); return Promise.resolve();
      },
      update(v) {
        if (col(c)[id] === undefined) return Promise.reject(new Error("No existe: " + c + "/" + id));
        Object.assign(col(c)[id], clon(v)); guardar(); avisar(c, id); return Promise.resolve();
      },
      delete() { delete col(c)[id]; guardar(); avisar(c, id); return Promise.resolve(); },
      onSnapshot(a, b) {
        const cb = oyente(a, b);
        (subsDoc[c + "/" + id] = subsDoc[c + "/" + id] || []).push(cb);
        setTimeout(() => cb(snapDoc(c, id)), 0);
        return () => { subsDoc[c + "/" + id] = subsDoc[c + "/" + id].filter(x => x !== cb); };
      }
    };
  }
  function colRef(c) {
    return {
      doc: id => docRef(c, id || nuevoId()),
      add(v) { const id = nuevoId(); col(c)[id] = clon(v); guardar(); avisar(c, id); return Promise.resolve({ id }); },
      get: () => Promise.resolve(snapCol(c)),
      onSnapshot(a, b) {
        const cb = oyente(a, b);
        (subsCol[c] = subsCol[c] || []).push(cb);
        setTimeout(() => cb(snapCol(c)), 0);
        return () => { subsCol[c] = subsCol[c].filter(x => x !== cb); };
      }
    };
  }
  return {
    raiz: { collection: c => colRef(c) },
    batch() {
      const ops = [];
      return {
        set: (ref, v, o) => ops.push(() => ref.set(v, o)),
        update: (ref, v) => ops.push(() => ref.update(v)),
        delete: ref => ops.push(() => ref.delete()),
        commit: () => Promise.all(ops.map(f => f())).then(() => undefined)
      };
    },
    estado: () => estado
  };
}

function activo(almacenamiento) {
  try { return (almacenamiento || localStorage).getItem(CLAVE_MODO) === "demo"; } catch (e) { return false; }
}
function activar(almacenamiento) {
  const ls = almacenamiento || localStorage;
  ls.removeItem(CLAVE_DATOS);
  ls.setItem(CLAVE_MODO, "demo");
}
// Salir borra todo lo del modo demo (con un toque).
function salir(almacenamiento) {
  const ls = almacenamiento || localStorage;
  ls.removeItem(CLAVE_DATOS);
  ls.removeItem(CLAVE_MODO);
}

return { CLAVE_MODO, CLAVE_DATOS, generarDemo, crearAlmacen, activo, activar, salir };
});
