(function () {
// Lectura y escritura de datos (centavos, saldos, respaldo): js/finanzas/datos.js
const FD = FinanzasDatos;
// Modo demo: datos ficticios guardados aparte, solo en este teléfono. Con el
// modo demo activo, TODO Finanzas lee y escribe en ese almacén local y nunca
// en tu nube (ver js/finanzas/demo.js).
const DEMO = FinanzasDemo.activo() ? FinanzasDemo.crearAlmacen(FinanzasDemo.generarDemo(new Date())) : null;
function raiz() {
  return DEMO ? DEMO.raiz : db.collection("users").doc(currentUser.uid);
}
function nuevoLote() {
  return DEMO ? DEMO.batch() : db.batch();
}
const CATEGORIES = {
  ingreso: [
    { id: "salario", label: "Salario", icon: "salary", color: "#5cc98a" },
    { id: "otros_ingresos", label: "Otros ingresos", icon: "otherCategory", color: "#9a978f" }
  ]
};

// Las categorías de ingreso las maneja el usuario (nombre, agregar, eliminar)
// y se guardan en Firestore. Estas por defecto quedan para mostrar bien
// movimientos viejos que usen una categoría que ya no está en la lista.
const DEFAULT_INGRESO_CATEGORIES = CATEGORIES.ingreso.slice();
CATEGORIES.ingreso = DEFAULT_INGRESO_CATEGORIES.filter(c => c.id !== "otros_ingresos");
const INGRESO_GROUP_ID = "__ingreso";
const INGRESO_COLOR = "#5cc98a";

const TRANSFER_CATEGORY = { id: "transferencia", label: "Transferencia", icon: "transfer", color: "#4dc9e0" };
const CARD_PAYMENT_CATEGORY = { id: "pago_tarjeta", label: "Pago de tarjeta", icon: "finance", color: "#ffb84d" };

const CATEGORY_COLOR_POOL = ["#4d9de0", "#9b6bde", "#3fb8af", "#e0567c", "#dbb84a", "#5cc98a", "#c96bde", "#e0894d", "#4dc9e0", "#9ae05c"];

// Categorías de gasto organizadas en grupos (categoría) con subcategorías
// adentro, como en Buddy. Cada grupo toma un color de CATEGORY_COLOR_POOL
// según su posición; las subcategorías solo llevan ícono.
const DEFAULT_CATEGORY_GROUPS = [
  { id: "comida", nombre: "Comida y bebida", items: [{ id: "comida", label: "Comida", icon: "food" }] },
  { id: "transporte", nombre: "Transporte", items: [{ id: "transporte", label: "Transporte", icon: "transport" }] },
  { id: "vivienda", nombre: "Vivienda", items: [{ id: "vivienda", label: "Vivienda", icon: "home" }] },
  { id: "salud", nombre: "Salud", items: [{ id: "salud", label: "Salud", icon: "health" }] },
  { id: "entretenimiento", nombre: "Entretenimiento", items: [{ id: "entretenimiento", label: "Entretenimiento", icon: "entertainment" }] },
  { id: "compras", nombre: "Compras", items: [{ id: "compras", label: "Compras", icon: "shopping" }] },
  { id: "suscripciones", nombre: "Suscripciones", items: [{ id: "suscripciones", label: "Suscripciones", icon: "subscription" }] },
  { id: "otros", nombre: "Otros", items: [{ id: "otros", label: "Otros", icon: "otherCategory" }] }
];

const PAYMENTS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Tarjeta de Crédito" }
];

let monthOffset = 0; // 0 = mes actual, -1 = mes anterior, etc.
let financeCache = [];
let budgetsCache = {};
let categoryGroupsCache = DEFAULT_CATEGORY_GROUPS; // {id, nombre, items:[{id,label,icon,emoji?}]}, guardado en Firestore
let gastoCategoriesCache = flattenCategoryGroups(DEFAULT_CATEGORY_GROUPS); // versión "plana" de categoryGroupsCache
let ahorrosCache = [];
let carterasCustomCache = []; // carteras que el usuario crea a mano, con su propio saldo
let carterasMovCache = []; // movimientos (aportes, retiros, transferencias) de esas carteras
let categoriasArchivadas = []; // categorías borradas: se guardan para seguir mostrando su nombre

function financeCollection() {
  return raiz().collection("finanzas");
}
function budgetConfigDocRef() {
  return raiz().collection("meta").doc("config_presupuesto");
}
function budgetDocRef() {
  return raiz().collection("meta").doc("presupuestos");
}
function categoriasDocRef() {
  return raiz().collection("meta").doc("categorias_gasto");
}
function ingresoCategoriesDocRef() {
  return raiz().collection("meta").doc("categorias_ingreso");
}
function customCategoriesDocRef() {
  return raiz().collection("meta").doc("categorias_personalizadas");
}
function ahorrosCollection() {
  return raiz().collection("ahorros");
}
function carterasCustomDocRef() {
  return raiz().collection("meta").doc("carteras_custom");
}
function carterasMovimientosCollection() {
  return raiz().collection("carteras_movimientos");
}

// Convierte los grupos con subcategorías a la lista plana {id,label,icon,color}
// que ya usa el resto de la app (formularios, presupuesto, exportar CSV).
// Todas las subcategorías de un mismo grupo comparten su color.
function flattenCategoryGroups(groups) {
  const flat = [];
  groups.forEach((g, gi) => {
    const color = g.color || CATEGORY_COLOR_POOL[gi % CATEGORY_COLOR_POOL.length];
    (g.items || []).forEach(item => {
      flat.push({ id: item.id, label: item.label, icon: item.icon, emoji: item.emoji, color, groupId: g.id });
    });
  });
  return flat;
}

function findCategory(type, id) {
  if (type === "pago_tarjeta" || type === "ajuste_tarjeta") return CARD_PAYMENT_CATEGORY;
  if (type === "transferencia") return TRANSFER_CATEGORY;
  if (type === "ingreso") {
    return CATEGORIES.ingreso.find(c => c.id === id)
      || DEFAULT_INGRESO_CATEGORIES.find(c => c.id === id)
      || categoriasArchivadas.find(c => c.id === id)
      || { id, label: id ? FD.etiquetaDesdeId(id) : "Ingreso", icon: "salary", color: INGRESO_COLOR };
  }
  const list = type === "gasto" ? gastoCategoriesCache : (CATEGORIES[type] || []);
  // Una categoría borrada sigue mostrando su nombre en los movimientos viejos.
  return list.find(c => c.id === id)
    || categoriasArchivadas.find(c => c.id === id)
    || (id ? { id, label: FD.etiquetaDesdeId(id), icon: "otherCategory", color: "#9a978f" } : gastoCategoriesCache.find(c => c.id === "otros"))
    || { id, label: "Otros", icon: "otherCategory", color: "#9a978f" };
}
// ---- Abrir/cerrar hojas y ventanas con animación ----
function showSheet(el) {
  clearTimeout(el._hideTimer);
  el.classList.remove("is-closing");
  el.hidden = false;
  document.body.classList.add("sheet-open");
}

// Una hoja que se está cerrando (animación) ya cuenta como cerrada.
function isSheetOpen(el) {
  return !el.hidden && !el.classList.contains("is-closing");
}

function hideSheet(el) {
  if (el.hidden) return;
  el.classList.add("is-closing");
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.hidden = true;
    el.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
}

function findPayment(id) {
  return PAYMENTS.find(p => p.id === id);
}

function formatMoney(n) {
  return n.toLocaleString("es-BO", { style: "currency", currency: "BOB" });
}
function formatUSD(n) {
  return `US$ ${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function slugify(label) {
  return label.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "categoria";
}
function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function monthLabel(date) {
  return capitalize(date.toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
}

// ---------- Periodo del presupuesto (ej: del 28 al 27 del mes siguiente) ----------
let budgetStartDay = 1; // 1-28, se configura en Herramientas → Periodo del presupuesto

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentBudgetPeriod() {
  return budgetPeriodAt(monthOffset);
}

// Día de inicio en un mes dado; si el mes es más corto (ej: 30 en febrero),
// empieza el último día de ese mes.
function periodStartIn(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(budgetStartDay, last));
}

function budgetPeriodAt(offset) {
  const today = new Date();
  let month = today.getMonth();
  if (today < periodStartIn(today.getFullYear(), month)) month--;
  month += offset;
  const start = periodStartIn(today.getFullYear(), month);
  const next = periodStartIn(start.getFullYear(), start.getMonth() + 1);
  const end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
  return { start, end, startISO: isoDate(start), endISO: isoDate(end) };
}

// Más reciente primero: por fecha y, dentro del mismo día, por la hora en que
// se registró (createdAt). Los movimientos viejos no tienen hora guardada y
// quedan debajo de los nuevos de ese día.
function byNewest(a, b) {
  return b.date.localeCompare(a.date)
    || (b.createdAt || 0) - (a.createdAt || 0)
    || String(b.id).localeCompare(String(a.id));
}

function isInPeriod(dateStr, period) {
  return dateStr >= period.startISO && dateStr <= period.endISO;
}

function periodLabel(period) {
  if (budgetStartDay === 1) return monthLabel(period.start);
  const thisYear = new Date().getFullYear();
  const fmt = d => {
    const opts = { day: "numeric", month: "short" };
    if (d.getFullYear() !== thisYear) opts.year = "numeric";
    return d.toLocaleDateString("es-ES", opts).replace(".", "");
  };
  return `${fmt(period.start)} - ${fmt(period.end)}`;
}

function daysLeftInPeriod(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today > period.end) return 0;
  const from = today < period.start ? period.start : today;
  return Math.round((period.end - from) / 86400000) + 1;
}

// ---------- Totales acumulados (saldo y deuda no se resetean por mes) ----------
// "Yo" son dos carteras: Efectivo y Débito. Las transferencias viejas usaban
// "gastos" (antes era una sola cartera) y cuentan como Débito.
function cashWallet(id) {
  return id === "gastos" ? "debito" : id;
}
function isCash(id) {
  return id === "efectivo" || id === "debito" || id === "gastos";
}
function paymentWallet(payment) {
  return payment === "efectivo" ? "efectivo" : "debito";
}

// Saldos acumulados (no se reinician por mes), sumados en centavos.
function computeTotals(list) {
  const t = FD.saldos(list);
  return { saldo: FD.aBs(t.saldo), efectivo: FD.aBs(t.efectivo), debito: FD.aBs(t.debito), deuda: FD.aBs(t.deuda) };
}

// ================= Resumen =================

// Carteras con su saldo, arriba de la lista. La tarjeta de crédito se
// muestra en negativo (lo que debes) y pagarla es una transferencia.
function renderStats() {
  const { saldo, deuda, efectivo, debito } = computeTotals(financeCache);
  const signo = n => `${n < 0 ? "−" : ""}${formatMoney(Math.abs(n))}`;
  const ahorro = FD.sumaBs(ahorrosCache, a => a.amount);
  const tco = tcoData && tcoData.ultimo && tcoData.ultimo.tco;
  const { date: pago, days: faltan } = nextCardPayDate();
  const cuando = pago.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  const tarjeta = (id, nombre, valor, extra, clase) => `
    <div class="fin-cartera${clase ? " " + clase : ""}" role="listitem">
      <button type="button" class="fin-cartera-btn" data-abrir-cartera="${id}">
        <span class="fin-cartera-top"><span class="fin-cartera-ico" style="background:${walletVisual(id).color}" data-icon="${walletVisual(id).icon}"></span><span class="fin-cartera-nombre">${escapeHtml(nombre)}</span></span>
        <span class="fin-cartera-valor${valor.startsWith("−") ? " neg" : ""}">${valor}</span>
        ${extra ? `<span class="fin-cartera-sub">${extra}</span>` : ""}
      </button>
    </div>`;
  document.getElementById("finance-stats").innerHTML = `
    <div class="fin-carteras" role="list" aria-label="Tus carteras">
      ${tarjeta("gastos", "Disponible", signo(saldo), "Efectivo + Débito", "is-total")}
      ${tarjeta("efectivo", "Efectivo", signo(efectivo))}
      ${tarjeta("debito", "Débito", signo(debito))}
      <div class="fin-cartera is-tarjeta" role="listitem">
        <button type="button" class="fin-cartera-btn" data-abrir-cartera="tarjeta">
          <span class="fin-cartera-top"><span class="fin-cartera-ico" style="background:${walletVisual("tarjeta").color}" data-icon="finance"></span><span class="fin-cartera-nombre">Tarjeta de crédito</span></span>
          <span class="fin-cartera-valor${deuda > 0 ? " neg" : ""}">${deuda > 0 ? "−" : ""}${formatMoney(Math.abs(deuda))}</span>
          <span class="fin-cartera-sub">${faltan === 0 ? "Hoy toca pagar" : `Pago: ${cuando} · ${faltan === 1 ? "falta 1 día" : `faltan ${faltan} días`}`}</span>
        </button>
        ${deuda > 0 ? `<button type="button" class="fin-cartera-pagar" data-pagar-tarjeta>Pagar</button>` : ""}
      </div>
      ${tarjeta("ahorro", "Ahorro", formatUSD(ahorro), tco ? `≈ ${formatBsShort(Math.round(ahorro * tco))}` : "")}
      ${carterasCustomCache.map(w => tarjeta(w.id, w.nombre, w.moneda === "US$" ? formatUSD(customWalletBalance(w.id)) : signo(customWalletBalance(w.id)))).join("")}
    </div>`;
  renderIcons(document.getElementById("finance-stats"));
}
document.getElementById("finance-stats").addEventListener("click", e => {
  if (e.target.closest("[data-pagar-tarjeta]")) {
    // Pagar la tarjeta es una transferencia de Débito a la tarjeta.
    const { deuda } = computeTotals(financeCache);
    openTxnSheet(null, { type: "transferencia", from: "debito", to: "tarjeta", amount: String(Math.round(deuda * 100) / 100).replace(".", ","), desc: "Pago de tarjeta" });
    return;
  }
  const b = e.target.closest("[data-abrir-cartera]");
  if (b) openWalletDetail(b.dataset.abrirCartera);
});

// Todas las barras de periodo (Movimientos y Análisis) muestran el mismo.
function updateMonthLabel() {
  const texto = periodLabel(currentBudgetPeriod());
  document.querySelectorAll("[data-mes-label]").forEach(el => { el.textContent = texto; });
  document.querySelectorAll('[data-mes-paso="1"]').forEach(b => { b.disabled = monthOffset >= 0; });
}
function cambiarPeriodo(paso) {
  if (paso > 0 && monthOffset >= 0) return;
  monthOffset += paso;
  cerrarDeslizada();
  renderAll();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-mes-paso]");
  if (b && !b.disabled) cambiarPeriodo(Number(b.dataset.mesPaso));
});

// ---- Vista general: lista de transacciones del periodo (como Buddy) ----
function dayLabel(dateStr) {
  const today = isoDate(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (dateStr === today) return "Hoy";
  if (dateStr === isoDate(y)) return "Ayer";
  const opts = { weekday: "long", day: "2-digit", month: "short" };
  if (dateStr.slice(0, 4) !== today.slice(0, 4)) opts.year = "numeric";
  return capitalize(new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", opts).replace(".", ""));
}

// ---- Buscar en la Lista: nota, categoría, sección, forma de pago o monto,
// en todos los periodos ----
let txnQuery = "";
// Filtros de la lista (tipo, categoría, cartera, RE-IVA y fechas).
let filtrosTxn = {};
const busquedaActiva = () => txnQuery.trim() !== "" || FD.hayFiltros(filtrosTxn);

function movementMatches(m, q) {
  const cat = findCategory(m.type, m.category);
  const group = m.type === "gasto" ? categoryGroupsCache.find(g => (g.items || []).some(i => i.id === m.category)) : null;
  const pay = findPayment(m.payment);
  const parts = [m.desc, cat.label, group && group.nombre, pay && pay.label,
    m.type === "ingreso" ? "ingreso" : m.type === "transferencia" ? `transferencia ${walletLabel(m.from)} ${walletLabel(m.to)}` : m.type === "pago_tarjeta" ? "pago tarjeta" : "gasto"];
  if (parts.some(t => t && normalizeText(String(t)).includes(q))) return true;
  const num = q.replace(/\./g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(num) && String(m.amount).includes(num);
}

function movementDelta(m) {
  // ajuste_tarjeta no mueve plata de Gastos (viene de otra cartera).
  if (m.type === "ingreso") return m.amount;
  if (m.type === "ajuste_tarjeta") return 0;
  if (m.type === "transferencia") {
    return (isCash(m.to) ? (m.amountTo != null ? m.amountTo : m.amount) : 0) - (isCash(m.from) ? m.amount : 0);
  }
  return -m.amount;
}

function txnIconHTML(cat) {
  return cat.emoji
    ? `<span class="txn-icon txn-icon-solid" style="background:${cat.color}">${cat.emoji}</span>`
    : `<span class="txn-icon txn-icon-solid" style="background:${cat.color}" data-icon="${cat.icon}"></span>`;
}

function periodMovements() {
  const period = currentBudgetPeriod();
  return financeCache.filter(m => isInPeriod(m.date, period));
}

// Plata que salió de Efectivo/Débito hacia Ahorro u otras carteras (neto de
// lo que volvió), agrupada por cartera. La tarjeta no cuenta: pagarla no es
// ahorrar.
function savingsByWallet(list) {
  const byWallet = {};
  list.filter(m => m.type === "transferencia").forEach(m => {
    if (isCash(m.from) && !isCash(m.to) && m.to !== "tarjeta") byWallet[m.to] = (byWallet[m.to] || 0) + FD.aCentavos(m.amount);
    if (isCash(m.to) && !isCash(m.from) && m.from !== "tarjeta") byWallet[m.from] = (byWallet[m.from] || 0) - FD.aCentavos(m.amountTo != null ? m.amountTo : m.amount);
  });
  Object.keys(byWallet).forEach(k => { byWallet[k] = FD.aBs(byWallet[k]); });
  return byWallet;
}

function periodSummary(list) {
  const ingresos = FD.sumaBs(list.filter(m => m.type === "ingreso"), m => m.amount);
  const gastos = FD.sumaBs(list.filter(m => m.type === "gasto"), m => m.amount);
  // El saldo es lo real: lo que se apartó a Ahorro u otras carteras ya no se
  // puede gastar, aunque no sea un gasto. Pagar la tarjeta no se resta: esos
  // gastos ya están en "Gastos".
  const ahorro = FD.sumaBs(Object.values(savingsByWallet(list)), v => v);
  return { ingresos, gastos, ahorro, saldo: FD.aBs(FD.aCentavos(ingresos) - FD.aCentavos(gastos) - FD.aCentavos(ahorro)) };
}

function renderMovements() {
  const period = currentBudgetPeriod();
  const q = normalizeText(txnQuery.trim());
  // Con búsqueda o filtros se mira todo el historial (o las fechas elegidas).
  const searching = busquedaActiva();
  let base = searching ? financeCache : financeCache.filter(m => isInPeriod(m.date, period));
  if (FD.hayFiltros(filtrosTxn)) base = FD.filtrarMovimientos(base, filtrosTxn);
  if (q) base = base.filter(m => movementMatches(m, q));
  const list = base.slice().sort(byNewest);
  renderFiltrosActivos();

  const { ingresos, gastos, saldo } = periodSummary(list);
  const signed = n => `${n < 0 ? "−" : ""}${formatBsShort(Math.abs(n))}`;
  const count = `${list.length} ${searching ? `resultado${list.length === 1 ? "" : "s"}` : `transacci${list.length === 1 ? "ón" : "ones"}`}`;

  document.getElementById("month-count").textContent = count;
  document.getElementById("finance-summary").innerHTML = searching ? `
    <div><strong>${list.length}</strong><span>Resultados</span></div>
    <div><strong>${formatBsShort(ingresos)}</strong><span>Ingresos</span></div>
    <div><strong>${formatBsShort(gastos)}</strong><span>Gastos</span></div>
  ` : `
    <div><strong>${formatBsShort(ingresos)}</strong><span>Ingresos</span></div>
    <div><strong>${formatBsShort(gastos)}</strong><span>Gastos</span></div>
    <div><strong class="${saldo < 0 ? "neg" : ""}">${signed(saldo)}</strong><span>Saldo</span></div>
  `;
  const empty = document.getElementById("finance-empty");
  empty.innerHTML = searching
    ? (q ? `No hay movimientos que coincidan con «${escapeHtml(txnQuery.trim())}»${FD.hayFiltros(filtrosTxn) ? " y los filtros elegidos" : ""}.` : "No hay movimientos con estos filtros.")
      + (FD.hayFiltros(filtrosTxn) ? ` <button type="button" class="link-btn" data-quitar-filtro="todo">Quitar filtros</button>` : "")
    : "Aún no hay movimientos en este periodo. Toca + para agregar uno.";
  empty.style.display = list.length ? "none" : "block";
  document.getElementById("fin-tab-lista").classList.toggle("is-searching", searching);
  document.getElementById("fin-month-nav").hidden = searching;

  const groups = [];
  list.forEach(m => {
    const last = groups[groups.length - 1];
    if (last && last.date === m.date) last.items.push(m);
    else groups.push({ date: m.date, items: [m] });
  });

  const container = document.getElementById("finance-list");
  container.innerHTML = groups.map(g => {
    const total = FD.sumaBs(g.items, movementDelta);
    const totalText = total === 0 ? formatBsShort(0) : `${total > 0 ? "+" : "−"}${formatBsShort(Math.abs(total))}`;
    return `
      <div class="txn-day" data-day="${g.date}">
        <div class="txn-day-head"><span>${dayLabel(g.date)}</span><span class="breakdown-leader"></span><span class="txn-day-total">${totalText}</span></div>
        ${g.items.map(m => {
          const cat = findCategory(m.type, m.category);
          const pay = findPayment(m.payment);
          let title = m.desc || cat.label;
          let sub = [m.desc ? cat.label : "", m.payment === "credito" ? (pay ? pay.label : "") : "", m.type === "gasto" && m.factura ? "Con factura" : "", m.recurrenteId ? "Recurrente" : "", m.excluded ? "Excluido del presupuesto" : ""].filter(Boolean).join(" · ");
          if (m.type === "transferencia") {
            const route = `${walletLabel(m.from)} → ${walletLabel(m.to)}`;
            title = m.desc || route;
            sub = m.desc ? route : "Transferencia";
          }
          const isTransfer = m.type === "pago_tarjeta" || m.type === "ajuste_tarjeta" || m.type === "transferencia";
          const amount = m.type === "ingreso"
            ? `<span class="txn-amount pos">+${formatBsShort(m.amount)}</span>`
            : isTransfer
              ? `<span class="txn-amount muted">(${formatWalletAmount(m.type === "transferencia" ? m.from : "debito", m.amount)})</span>`
              : `<span class="txn-amount">${formatBsShort(m.amount)}</span>`;
          // Deslizar a la izquierda muestra Editar y Borrar.
          return `
            <div class="txn-swipe">
              <div class="txn-swipe-acciones" aria-hidden="true">
                <button type="button" class="txn-swipe-editar" data-swipe-editar="${m.id}" tabindex="-1"><span data-icon="edit"></span>Editar</button>
                <button type="button" class="txn-swipe-borrar" data-swipe-borrar="${m.id}" tabindex="-1"><span data-icon="trash"></span>Borrar</button>
              </div>
              <button type="button" class="txn-row" data-edit-txn="${m.id}">
                ${txnIconHTML(cat)}
                <span class="txn-body">
                  <span class="txn-desc">${escapeHtml(title)}</span>
                  ${sub ? `<span class="meta">${escapeHtml(sub)}</span>` : ""}
                </span>
                ${amount}
              </button>
            </div>`;
        }).join("")}
      </div>`;
  }).join("");
  renderIcons(container);
}

// ---- Borrar con "Deshacer" ----
// Se borra al instante y durante unos segundos aparece un aviso con
// "Deshacer", que vuelve a escribir los mismos documentos con el mismo id
// (así las transferencias recuperan sus dos lados).
const UNDO_MS = 5000;
let undoTimer = null;
let undoRestore = null;

function withoutId(obj) {
  const data = Object.assign({}, obj);
  delete data.id;
  return data;
}

// Borrar y restaurar van en un solo lote: se aplican juntos, también sin
// conexión (nunca queda una transferencia con un solo lado).
function removeWithUndo(message, entries, extra) {
  const lote = nuevoLote();
  entries.forEach(e => lote.delete(e.ref));
  if (extra && extra.borrar) extra.borrar(lote);
  lote.commit().catch(err => console.error("Manolo: no se pudo borrar", err));
  showUndoToast(message, () => {
    const vuelta = nuevoLote();
    entries.forEach(e => vuelta.set(e.ref, e.data));
    if (extra && extra.restaurar) extra.restaurar(vuelta);
    return vuelta.commit().catch(err => console.error("Manolo: no se pudo restaurar", err));
  });
}

function undoToastEl() {
  let el = document.getElementById("undo-toast");
  if (el) return el;
  el = document.createElement("div");
  el.id = "undo-toast";
  el.className = "undo-toast";
  el.setAttribute("role", "status");
  el.hidden = true;
  el.innerHTML = `<span class="undo-toast-msg"></span><button type="button" class="undo-toast-btn">Deshacer</button><span class="undo-toast-bar"></span>`;
  el.querySelector(".undo-toast-btn").addEventListener("click", () => {
    const restore = undoRestore;
    hideUndoToast();
    if (restore) restore();
  });
  document.body.appendChild(el);
  return el;
}

function showUndoToast(message, restore) {
  const el = undoToastEl();
  clearTimeout(undoTimer);
  undoRestore = restore;
  el.querySelector(".undo-toast-btn").hidden = false;
  el.querySelector(".undo-toast-msg").textContent = message;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth; // reinicia la barra de tiempo si se borra otro seguido
  el.classList.add("show");
  undoTimer = setTimeout(hideUndoToast, UNDO_MS);
}

function hideUndoToast() {
  clearTimeout(undoTimer);
  undoRestore = null;
  const el = document.getElementById("undo-toast");
  if (el) { el.classList.remove("show"); el.hidden = true; }
}

function deleteMovement(id) {
  const m = financeCache.find(x => x.id === id);
  if (!m) { financeCollection().doc(id).delete(); return; }
  removeWithUndo(m.type === "ingreso" ? "Ingreso eliminado" : "Transacción eliminada",
    [{ ref: financeCollection().doc(id), data: withoutId(m) }]);
}

// ---- Pantallas de Finanzas: Resumen · Movimientos · Presupuesto · Análisis ----
// (antes eran pestañas internas de Vista general; se conservan los nombres
// "vg", "lista" y "gasto" para no tocar el resto del código)
const PANTALLA_DE = { vg: "finanzas", lista: "fin-movimientos", gasto: "fin-analisis" };
function currentFinTab() {
  const h = location.hash.replace("#", "");
  return h === "fin-movimientos" ? "lista" : h === "fin-analisis" ? "gasto" : "vg";
}
function showFinTab(tab) {
  const destino = "#" + (PANTALLA_DE[tab] || "finanzas");
  if (location.hash !== destino) location.hash = destino;
}

// ---- Pestaña Vista General (como Buddy): gráfico, calendario y presupuesto ----
function periodDays(period) {
  const days = [];
  for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) days.push(isoDate(d));
  return days;
}

// Gasto acumulado por día del periodo: [g1, g1+g2, ...].
function cumulativeSpend(period) {
  const byDay = {};
  financeCache.filter(m => m.type === "gasto" && !m.excluded && isInPeriod(m.date, period))
    .forEach(m => { byDay[m.date] = (byDay[m.date] || 0) + m.amount; });
  let acc = 0;
  return periodDays(period).map(d => (acc += byDay[d] || 0));
}

// Curva suave que pasa por todos los puntos (Catmull-Rom → Bézier).
function smoothPath(pts) {
  if (!pts.length) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    // Los puntos de control quedan entre p1 y p2 para que la curva no se
    // pase de largo (el acumulado nunca baja).
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    const clamp = v => Math.min(Math.max(v, lo), hi);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function vgChartHTML(period) {
  const days = periodDays(period);
  const n = days.length;
  const today = isoDate(new Date());
  const shownDays = days.filter(d => d <= today).length || (days[0] > today ? 0 : n);
  const current = cumulativeSpend(period).slice(0, Math.max(shownDays, 1));

  // Media de los 3 periodos anteriores que tengan gastos, día por día.
  const previous = [1, 2, 3]
    .map(k => cumulativeSpend(budgetPeriodAt(monthOffset - k)))
    .filter(arr => arr[arr.length - 1] > 0);
  const media = previous.length
    ? days.map((_, i) => previous.reduce((s, arr) => s + arr[Math.min(i, arr.length - 1)], 0) / previous.length)
    : null;

  const byDay = {};
  financeCache.filter(m => m.type === "gasto" && !m.excluded && isInPeriod(m.date, period))
    .forEach(m => { byDay[m.date] = (byDay[m.date] || 0) + m.amount; });

  const W = 320, H = 170, padX = 6, top = 14, bottom = 150;
  const maxY = Math.max(current[current.length - 1] || 0, media ? media[n - 1] : 0, 1) * 1.08;
  const x = i => padX + (n > 1 ? (i / (n - 1)) * (W - padX * 2) : 0);
  const y = v => bottom - (v / maxY) * (bottom - top);
  const curPts = current.map((v, i) => [x(i), y(v)]);
  const linePath = smoothPath(curPts);
  const last = curPts[curPts.length - 1];
  const area = `${linePath} L ${last[0].toFixed(1)} ${bottom} L ${curPts[0][0].toFixed(1)} ${bottom} Z`;
  const mediaPath = media ? smoothPath(media.map((v, i) => [x(i), y(v)])) : "";
  vgChartData = {
    days, byDay, current, media,
    xPct: days.map((_, i) => x(i) / W * 100),
    yCur: current.map(v => y(v) / (H + 18) * 100),
    yMedia: media ? media.map(v => y(v) / (H + 18) * 100) : null
  };
  const ticks = days.map((d, i) => ({ i, label: Number(d.slice(8)) })).filter(t => t.i % 5 === 0 || t.i === n - 1)
    .filter((t, idx, arr) => !(t.i === n - 1 && idx > 0 && n - 1 - arr[idx - 1].i < 3));

  return `
    <div class="vg-chart-plot">
    <svg class="vg-chart" viewBox="0 0 ${W} ${H + 18}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="vg-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffb84d" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#ffb84d" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="vg-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff7a30"/>
          <stop offset="100%" stop-color="#ffb84d"/>
        </linearGradient>
      </defs>
      ${media ? `<path d="${mediaPath}" fill="none" style="stroke:#77756f" stroke-width="2" stroke-dasharray="6 6" vector-effect="non-scaling-stroke"/>` : ""}

      <path d="${area}" fill="url(#vg-area)"/>
      <path d="${linePath}" fill="none" stroke="url(#vg-line)" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>
    <span class="vg-chart-dot" style="left:${(last[0] / W * 100).toFixed(2)}%; top:${(last[1] / (H + 18) * 100).toFixed(2)}%"></span>
    <span class="vg-scrub-line" hidden></span>
    <span class="vg-scrub-dot" hidden></span>
    <span class="vg-scrub-dot media" hidden></span>
    <button type="button" class="vg-tooltip" hidden></button>
    </div>
    <div class="vg-chart-ticks">${ticks.map(t => `<span style="left:${(x(t.i) / W * 100).toFixed(2)}%">${t.label}</span>`).join("")}</div>
    <div class="vg-legend"><span><i style="background:#ff7a30"></i>Este periodo</span>${media ? `<span><i style="background:#77756f"></i>Media</span>` : ""}</div>`;
}

// ---- Deslizar por el gráfico: línea vertical + recuadro con el día ----
let vgChartData = null;
let vgScrubDay = null;

function showVgScrub(i) {
  const d = vgChartData;
  const plot = document.querySelector("#vg-chart .vg-chart-plot");
  if (!d || !plot) return;
  i = Math.max(0, Math.min(d.days.length - 1, i));
  const date = d.days[i];
  vgScrubDay = date;
  const left = d.xPct[i];
  const line = plot.querySelector(".vg-scrub-line");
  line.hidden = false;
  line.style.left = `${left}%`;

  const [dot, mediaDot] = plot.querySelectorAll(".vg-scrub-dot");
  const hasCur = i < d.current.length;
  dot.hidden = !hasCur;
  if (hasCur) { dot.style.left = `${left}%`; dot.style.top = `${d.yCur[i]}%`; }
  mediaDot.hidden = !d.yMedia;
  if (d.yMedia) { mediaDot.style.left = `${left}%`; mediaDot.style.top = `${d.yMedia[i]}%`; }

  const label = capitalize(new Date(date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""));
  const tip = plot.querySelector(".vg-tooltip");
  tip.innerHTML = `
    <span class="vg-tip-date">${label}<span class="vg-tip-chev" data-icon="chevronRight"></span></span>
    <span class="vg-tip-value">${formatBsShort(d.byDay[date] || 0)}</span>
    <span class="vg-tip-rows">
      <span><i style="background:#ff7a30"></i>${hasCur ? formatBsShort(Math.round(d.current[i])) : "—"}</span>
      ${d.media ? `<span><i style="background:#77756f"></i>${formatBsShort(Math.round(d.media[i]))}</span>` : ""}
    </span>`;
  renderIcons(tip);
  tip.hidden = false;
  // Centrado sobre la línea, sin salirse del gráfico.
  const w = plot.clientWidth, tw = tip.offsetWidth;
  const px = Math.max(0, Math.min(w - tw, left / 100 * w - tw / 2));
  tip.style.left = `${px}px`;
}

function hideVgScrub() {
  vgScrubDay = null;
  document.querySelectorAll("#vg-chart .vg-scrub-line, #vg-chart .vg-scrub-dot, #vg-chart .vg-tooltip").forEach(el => { el.hidden = true; });
}

(function wireVgScrub() {
  const host = document.getElementById("vg-chart");
  let dragging = false;
  const indexAt = e => {
    const svg = host.querySelector(".vg-chart");
    const d = vgChartData;
    if (!svg || !d) return null;
    const r = svg.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width * 100;
    let best = 0;
    d.xPct.forEach((p, i) => { if (Math.abs(p - pct) < Math.abs(d.xPct[best] - pct)) best = i; });
    return best;
  };
  host.addEventListener("pointerdown", e => {
    if (e.target.closest(".vg-tooltip")) return;
    if (!e.target.closest(".vg-chart-plot")) return;
    dragging = true;
    const i = indexAt(e);
    if (i != null) showVgScrub(i);
  });
  host.addEventListener("pointermove", e => {
    if (!dragging) return;
    const i = indexAt(e);
    if (i != null) showVgScrub(i);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(evt => host.addEventListener(evt, () => { dragging = false; }));
  host.addEventListener("click", e => {
    if (e.target.closest(".vg-tooltip") && vgScrubDay) {
      const date = vgScrubDay;
      if (!financeCache.some(m => m.date === date)) return;
      showFinTab("lista");
      setTimeout(() => jumpToDay(date), 80);
    }
  });
  // Tocar fuera del gráfico cierra el recuadro.
  document.addEventListener("pointerdown", e => {
    if (vgScrubDay && !e.target.closest("#vg-chart")) hideVgScrub();
  });
})();

function vgCalendarHTML(period) {
  const days = periodDays(period);
  const today = isoDate(new Date());
  const spent = {}, income = {};
  financeCache.filter(m => isInPeriod(m.date, period)).forEach(m => {
    if (m.type === "gasto") spent[m.date] = (spent[m.date] || 0) + m.amount;
    if (m.type === "ingreso") income[m.date] = (income[m.date] || 0) + m.amount;
  });
  const maxSpent = Math.max(...Object.values(spent), 0);
  const hasMovements = new Set(financeCache.filter(m => isInPeriod(m.date, period)).map(m => m.date));
  const lead = (new Date(days[0] + "T00:00:00").getDay() + 6) % 7; // lunes = 0
  const round = n => Math.round(n).toLocaleString("es-BO");
  const cells = Array(lead).fill(`<span class="vg-day empty"></span>`).concat(days.map(d => {
    const amt = spent[d] || 0;
    const alpha = amt > 0 && maxSpent > 0 ? (0.25 + 0.6 * amt / maxSpent).toFixed(2) : 0;
    const cls = ["vg-day", d === today ? "today" : "", d > today ? "future" : "", hasMovements.has(d) ? "has" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${cls}" data-vg-day="${d}"${alpha ? ` style="background:rgba(255,122,48,${alpha})"` : ""}>
      <span class="vg-day-num">${Number(d.slice(8))}</span>
      ${income[d] ? `<span class="vg-day-income">+${round(income[d])}</span>` : ""}
      <span class="vg-day-amt">${round(amt)}</span>
    </button>`;
  }));
  return `
    <h2 class="an-titulo" id="an-calendario-t">Calendario de gastos</h2>
    <p class="an-sub">Más oscuro, más gasto. Toca un día para ver sus movimientos.</p>
    <div class="vg-weekdays">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(w => `<span>${w}</span>`).join("")}</div>
    <div class="vg-grid">${cells.join("")}</div>`;
}

// ================= Resumen: 6 bloques =================
// 1 cuánto puedes gastar por día · 2 gasto del periodo · 3 atención
// · 4 ahorro · 5 en qué se va · 6 RE-IVA del mes. Lo profundo está en Análisis.

// 1. Puedes gastar por día
function resHeroHTML(period) {
  const { days, daily, result } = budgetProjection(period);
  const base = incomeBase(period);
  const gastado = FD.sumaBs(financeCache.filter(m => m.type === "gasto" && !m.excluded && isInPeriod(m.date, period)), m => m.amount);
  const barra = base > 0 ? `<div class="vg-bar" role="img" aria-label="Gastaste ${Math.round(Math.min(gastado / base, 1) * 100)} % de lo que entra"><span style="width:${(Math.min(gastado / base, 1) * 100).toFixed(1)}%"></span></div>` : "";
  if (base <= 0) {
    return `<div class="vg-label">Puedes gastar por día</div>
      <p class="res-vacio">Registra tu ingreso o arma tu presupuesto y aquí verás cuánto puedes gastar cada día.</p>
      <a class="res-link" href="#fin-presupuesto">Armar presupuesto<span data-icon="chevronRight"></span></a>`;
  }
  if (days <= 0) {
    return `<div class="vg-label">Periodo cerrado</div>
      <div class="vg-big an-num${result < 0 ? " over" : ""}">${result < 0 ? "−" : ""}${formatBsShort(Math.round(Math.abs(result)))}</div>
      <p class="res-sub">${result < 0 ? "Gastaste más de lo que entró." : "Es lo que te sobró en este periodo."}</p>${barra}`;
  }
  const quedan = `quedan ${days} ${days === 1 ? "día" : "días"}`;
  if (result <= 0) {
    return `<div class="vg-label">Puedes gastar por día</div>
      <div class="vg-big over">Sin margen</div>
      <p class="res-sub">Ya usaste todo lo que entra este periodo (${quedan}). Revisa el presupuesto.</p>${barra}
      <a class="res-link" href="#fin-presupuesto">Ver presupuesto<span data-icon="chevronRight"></span></a>`;
  }
  return `<div class="vg-label">Puedes gastar por día</div>
    <div class="vg-big an-num">${formatBsShort(Math.floor(daily))}</div>
    <p class="res-sub">Te quedan <strong class="an-num">${formatBsShort(Math.round(result))}</strong> para los próximos ${days} ${days === 1 ? "día" : "días"}, después de fijos y ahorro.</p>
    ${barra}
    <a class="res-link" href="#fin-presupuesto">Ver presupuesto<span data-icon="chevronRight"></span></a>`;
}

// 3. Atención: hasta 3 cosas para mirar hoy.
function resAtencionHTML(period) {
  const items = [];
  const spent = computeSpentByCategory(period);
  categoryGroupsCache.forEach(g => groupCategories(g).forEach(c => {
    if (!isPlanned(c.id)) return;
    const { e, fijo } = presInfo({ cat: c, planned: disponible(c.id), used: spent[c.id] || 0 }, period);
    if (e.estado === "pasado") items.push({ peso: 3 + e.pct, html: `<button type="button" class="res-item mal" data-cat-detail="${escapeHtml(c.id)}" data-cat-type="gasto"><span class="res-item-ic" aria-hidden="true">!</span><span><strong>${escapeHtml(c.label)}:</strong> te pasaste ${bsCent(-e.queda)}.</span></button>` });
    else if (!fijo && (e.estado === "alerta" || e.estado === "rapido")) items.push({ peso: 1 + e.pct, html: `<button type="button" class="res-item aviso" data-cat-detail="${escapeHtml(c.id)}" data-cat-type="gasto"><span class="res-item-ic" aria-hidden="true">!</span><span><strong>${escapeHtml(c.label)}:</strong> ${e.estado === "alerta" ? `usaste el ${Math.round(e.pct * 100)} %, quedan ${bsCent(e.queda)}` : `vas rápido: ${Math.round(e.pct * 100)} % usado y pasó el ${Math.round(periodElapsed(period) * 100)} % del periodo`}.</span></button>` });
  }));
  if (monthOffset === 0) {
    const hoy = isoDate(new Date());
    FD.proximosRecurrentes(recurrentes, financeCache, hoy, 3).forEach(p => {
      items.push({ peso: 2, html: `<a class="res-item" href="#fin-analisis"><span class="res-item-ic" aria-hidden="true"><span data-icon="calendar"></span></span><span><strong>${enDias(p.fecha)}:</strong> ${escapeHtml(p.rec.nombre)} · ${p.rec.type === "ingreso" ? "+" : ""}${bsCent(p.rec.montoCent || 0)}</span></a>` });
    });
    const t = FD.saldos(financeCache);
    const { days } = nextCardPayDate();
    if (t.deuda > 0 && days <= 3) items.push({ peso: 2.5, html: `<a class="res-item aviso" href="#fin-movimientos"><span class="res-item-ic" aria-hidden="true"><span data-icon="calendar"></span></span><span><strong>${days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`}:</strong> pago de la tarjeta · ${bsCent(t.deuda)}</span></a>` });
  }
  items.sort((a, b) => b.peso - a.peso);
  const head = `<h2 class="an-titulo" id="res-atencion-t">Atención</h2>`;
  if (!items.length) return `${head}<p class="res-ok"><span class="res-item-ic bien" aria-hidden="true"><span data-icon="check"></span></span>Todo en orden: ninguna categoría pasada ni pagos en los próximos 3 días.</p>`;
  return `${head}<div class="res-items">${items.slice(0, 3).map(i => i.html).join("")}</div>
    ${items.length > 3 ? `<a class="res-link" href="#fin-presupuesto">Y ${items.length - 3} más en Presupuesto<span data-icon="chevronRight"></span></a>` : ""}`;
}

// 4. Ahorro del periodo.
const META_AHORRO = 0.2;
function resAhorroHTML(period) {
  const list = financeCache.filter(m => isInPeriod(m.date, period) && !m.excluded);
  const ing = FD.sumaCent(list.filter(m => m.type === "ingreso"), m => m.amount);
  const gas = FD.sumaCent(list.filter(m => m.type === "gasto"), m => m.amount);
  const apartado = FD.aCentavos(FD.sumaBs(Object.values(savingsByWallet(list)), v => v));
  const head = `<h2 class="an-titulo" id="res-ahorro-t">Tu ahorro</h2>`;
  if (ing <= 0) return `${head}<p class="res-vacio">Todavía no registraste ingresos en este periodo.</p>`;
  const tasa = (ing - gas) / ing;
  const ancho = Math.max(0, Math.min(tasa, 1)) * 100;
  return `${head}
    <div class="an-fila-big"><span class="vg-big an-num${tasa < 0 ? " over" : ""}">${tasa < 0 ? "−" : ""}${Math.round(Math.abs(tasa) * 100)} %</span><span class="an-kpi-sub">de lo que entró no se gastó</span></div>
    <div class="an-meta" role="img" aria-label="${Math.round(tasa * 100)} % ahorrado; la meta recomendada es ${META_AHORRO * 100} %"><span style="width:${ancho}%"></span><i style="left:${META_AHORRO * 100}%"></i></div>
    <div class="an-meta-ejes" aria-hidden="true"><span>0 %</span><span style="margin-left:${META_AHORRO * 100 - 8}%">meta ${META_AHORRO * 100} %</span><span>100 %</span></div>
    <p class="an-detalle">Entraron ${bsCent(ing)}, gastaste ${bsCent(gas)} y ${ing - gas >= 0 ? `quedan <strong class="an-num">${bsCent(ing - gas)}</strong>` : `faltaron <strong class="an-num">${bsCent(gas - ing)}</strong>`}.${apartado > 0 ? ` Ya apartaste ${bsCent(apartado)} a tus carteras de ahorro.` : ""}</p>`;
}

// 5. En qué se va (compacto; el detalle está en Análisis).
function resCategoriasHTML(period) {
  const spent = computeSpentByCategory(period);
  const ids = Object.keys(spent).filter(id => spent[id] > 0).sort((a, b) => spent[b] - spent[a]);
  const head = `<h2 class="an-titulo" id="res-categorias-t">¿En qué se va?</h2>`;
  if (!ids.length) return `${head}<p class="res-vacio">Sin gastos en este periodo.</p>`;
  const total = ids.reduce((s, id) => s + spent[id], 0);
  const top = ids.slice(0, 4).map(id => ({ cat: findCategory("gasto", id), v: spent[id] }));
  const resto = total - top.reduce((s, x) => s + x.v, 0);
  const filas = top.concat(resto > 0 ? [{ cat: { id: "__otras", label: "Las demás", color: "#77756f", icon: "otherCategory" }, v: resto }] : []);
  return `${head}
    <div class="res-apilada" role="img" aria-label="${filas.map(f => `${escapeHtml(f.cat.label)} ${Math.round(f.v / total * 100)} %`).join(", ")}">${filas.map(f => `<span style="width:${(f.v / total * 100).toFixed(2)}%;background:${f.cat.color}"></span>`).join("")}</div>
    <div class="res-cats">${filas.map(f => `
      <${f.cat.id === "__otras" ? "div" : `button type="button" data-cat-detail="${escapeHtml(f.cat.id)}" data-cat-type="gasto"`} class="res-cat">
        <i style="background:${f.cat.color}"></i><span class="res-cat-nom">${escapeHtml(f.cat.label)}</span>
        <span class="res-cat-pct an-num">${Math.round(f.v / total * 100)} %</span><span class="res-cat-v an-num">${formatBsShort(Math.round(f.v))}</span>
      </${f.cat.id === "__otras" ? "div" : "button"}>`).join("")}</div>
    <a class="res-link" href="#fin-analisis">Ver análisis completo<span data-icon="chevronRight"></span></a>`;
}

// 6. RE-IVA del mes calendario.
function resReivaHTML(period) {
  const mes = (monthOffset === 0 ? isoDate(new Date()) : period.startISO).slice(0, 7);
  const del = k => financeCache.filter(m => m.type === "gasto" && m.factura && m.date && m.date.slice(0, 7) === k);
  const items = del(mes);
  const [y, mo] = mes.split("-").map(Number);
  const nombre = `${MONTH_NAMES[mo - 1]}${y !== new Date().getFullYear() ? " " + y : ""}`;
  const head = `<h2 class="an-titulo" id="res-reiva-t">RE-IVA de ${nombre.toLowerCase()}</h2>`;
  if (!items.length) {
    return `${head}<p class="res-vacio">Aún no marcaste compras con factura este mes. Al registrar un gasto, activa «Compra con factura».</p>
      <a class="res-link" href="#fin-herramientas-reiva">Ver RE-IVA<span data-icon="chevronRight"></span></a>`;
  }
  const total = FD.sumaCent(items, m => m.amount);
  const reintegro = Math.round(total * reivaTasa());
  const ant = FD.sumaCent(del(FP.claveMas(mes, -1)), m => m.amount);
  return `${head}
    <div class="an-fila-big"><span class="vg-big an-num">${bsCent(reintegro)}</span><span class="an-kpi-sub">reintegro estimado (${(reivaTasa() * 100).toLocaleString("es-BO", { maximumFractionDigits: 2 })} %)</span></div>
    <p class="an-detalle">${items.length} ${items.length === 1 ? "factura" : "facturas"} por ${bsCent(total)} en compras.${ant > 0 ? ` El mes anterior: ${bsCent(Math.round(ant * reivaTasa()))}.` : ""}</p>
    <a class="res-link" href="#fin-herramientas-reiva">Ver facturas<span data-icon="chevronRight"></span></a>`;
}

function renderVistaGeneral() {
  const period = currentBudgetPeriod();
  const gastado = FD.sumaBs(financeCache.filter(m => m.type === "gasto" && !m.excluded && isInPeriod(m.date, period)), m => m.amount);
  const poner = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  poner("res-hero", resHeroHTML(period));
  document.getElementById("vg-spent-label").textContent = `Gastado: ${periodLabel(period)}`;
  document.getElementById("vg-spent-value").textContent = formatBsShort(gastado);
  document.getElementById("vg-chart").innerHTML = vgChartHTML(period);
  poner("res-atencion", resAtencionHTML(period));
  poner("res-ahorro", resAhorroHTML(period));
  poner("res-categorias", resCategoriasHTML(period));
  poner("res-reiva", resReivaHTML(period));
  renderIcons(document.getElementById("fin-tab-vg"));
}

document.getElementById("fin-tab-vg").addEventListener("click", e => {
  const cat = e.target.closest("[data-cat-detail]");
  if (cat) openCategoryDetail(cat.dataset.catType, cat.dataset.catDetail);
});

// Lleva la Lista al día elegido: la fecha queda arriba de todo (justo bajo
// la barra fija) y sus transacciones debajo. Se agrega espacio al final para
// que también los primeros días del periodo puedan subir hasta arriba.
function jumpToDay(date) {
  const target = document.querySelector(`#finance-list [data-day="${date}"]`);
  if (!target) return;
  document.getElementById("fin-tab-lista").classList.add("day-jump");
  const topbar = document.querySelector(".topbar");
  const offset = (topbar && topbar.offsetHeight) || 0;
  requestAnimationFrame(() => {
    const y = target.getBoundingClientRect().top + window.scrollY - offset - 12;
    window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
    target.classList.remove("day-flash");
    void target.offsetWidth;
    target.classList.add("day-flash");
  });
}

// ---- Pestaña Gasto (como Buddy): anillo por categoría ----
const GASTO_MODES = {
  gasto: { label: "Gastos", icon: "shopping", color: "#e0567c" },
  ingreso: { label: "Ingresos", icon: "salary", color: INGRESO_COLOR },
  ahorro: { label: "Ahorros", icon: "wallet", color: "#4dc9e0" }
};
let gastoMode = "gasto";
let gastoView = "categorias";
let gastoSelected = null;

// Filas {id, label, icon, emoji, color, amount, group:{id,label,color}} del modo elegido.
function gastoRows() {
  const list = periodMovements();
  if (gastoMode === "ahorro") {
    const byWallet = savingsByWallet(list);
    return Object.keys(byWallet).filter(id => byWallet[id] > 0).map(id => {
      const v = walletVisual(id);
      const label = walletLabel(id);
      return { id, label, icon: v.icon, color: v.color, amount: byWallet[id], type: "ahorro", group: { id, label, color: v.color } };
    }).sort((a, b) => b.amount - a.amount);
  }
  const totals = {};
  list.filter(m => m.type === gastoMode && !m.excluded).forEach(m => { totals[m.category] = (totals[m.category] || 0) + m.amount; });
  return Object.keys(totals).map(id => {
    const cat = findCategory(gastoMode, id);
    let group = { id: "__ingresos", label: "Ingresos", color: INGRESO_COLOR };
    if (gastoMode === "gasto") {
      const g = categoryGroupsCache.find(gr => (gr.items || []).some(i => i.id === id));
      group = g ? { id: g.id, label: g.nombre, color: groupColor(g) } : { id: "__otros", label: "Otros", color: "#9a978f" };
    }
    return { id, label: cat.label, icon: cat.icon, emoji: cat.emoji, color: cat.color, amount: totals[id], type: gastoMode, group };
  }).sort((a, b) => b.amount - a.amount);
}

// Anillo sin encimarse: cada tramo ocupa al menos lo que mide su punta
// redonda más un espacio, y las categorías muy chicas (menos del 3 %) se
// juntan en un solo tramo gris "Otras" (la lista de abajo las muestra todas).
const ANILLO_MIN_PCT = 0.03;
function tramosAnillo(rows) {
  const total = rows.reduce((s, x) => s + x.amount, 0);
  if (!(total > 0)) return [];
  const grandes = rows.filter(r => r.amount / total >= ANILLO_MIN_PCT);
  const chicas = rows.filter(r => r.amount / total < ANILLO_MIN_PCT);
  const tramos = grandes.map(r => ({ id: r.id, color: r.color, amount: r.amount, ids: [r.id] }));
  if (chicas.length === 1) tramos.push({ id: chicas[0].id, color: chicas[0].color, amount: chicas[0].amount, ids: [chicas[0].id] });
  else if (chicas.length > 1) tramos.push({ id: "__otras", color: "#77756f", amount: chicas.reduce((s, x) => s + x.amount, 0), ids: chicas.map(x => x.id) });
  return tramos;
}
function gastoRingSVG(rows, selectedId) {
  const size = 260, stroke = 22, r = (size - stroke) / 2 - 8, c = 2 * Math.PI * r;
  const tramos = tramosAnillo(rows);
  const total = tramos.reduce((s, x) => s + x.amount, 0);
  let arcs;
  if (!tramos.length) {
    arcs = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--border)" stroke-width="${stroke}"/>`;
  } else if (tramos.length === 1) {
    arcs = `<circle class="gasto-arc" data-gasto-pick="${tramos[0].id}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${tramos[0].color}" stroke-width="${stroke}"/>`;
  } else {
    const gap = 8;
    const minimo = stroke + gap; // lo que ocupa una punta redonda + el espacio
    // Los tramos chicos reciben el mínimo; el resto se reparte en proporción.
    let largos = tramos.map(t => t.amount / total * c);
    const chicos = largos.map(l => l < minimo);
    const libre = c - chicos.filter(Boolean).length * minimo;
    const sumaGrandes = largos.reduce((s, l, i) => s + (chicos[i] ? 0 : l), 0);
    largos = largos.map((l, i) => (chicos[i] ? minimo : l / sumaGrandes * libre));
    let inicio = 0;
    const elegido = selectedId && (tramos.find(t => t.ids.includes(selectedId)) || {}).id;
    arcs = tramos.map((t, i) => {
      const trazo = Math.max(largos[i] - minimo, 0.01);
      const desde = inicio + gap / 2 + stroke / 2;
      inicio += largos[i];
      return `<circle class="gasto-arc${elegido && t.id !== elegido ? " dim" : ""}"${t.id === "__otras" ? "" : ` data-gasto-pick="${t.id}"`} cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        style="stroke:${t.color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${trazo.toFixed(2)} ${(c - trazo).toFixed(2)}" stroke-dashoffset="${(-desde).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    }).join("");
  }
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <defs><filter id="gasto-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g filter="url(#gasto-glow)">${arcs}</g>
  </svg>`;
}

function renderGasto() {
  const mode = GASTO_MODES[gastoMode];
  document.getElementById("gasto-mode-label").textContent = mode.label;
  const rows = gastoRows();
  if (gastoSelected && !rows.some(r => r.id === gastoSelected)) gastoSelected = null;
  const center = rows.find(r => r.id === gastoSelected) || rows[0];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  document.getElementById("gasto-ring").innerHTML = `
    ${gastoRingSVG(rows, gastoSelected)}
    <div class="gasto-ring-center">
      ${center
        ? `<span class="gasto-center-icon" style="background:${center.color}">${center.emoji ? `<span class="gasto-center-emoji">${center.emoji}</span>` : `<span data-icon="${center.icon}"></span>`}</span>
           <span class="gasto-center-value">${formatBsShort(center.amount)}</span>
           <span class="gasto-center-label">${escapeHtml(center.label)}</span>`
        : `<span class="gasto-center-icon" style="background:var(--border)"><span data-icon="${mode.icon}"></span></span>
           <span class="gasto-center-value">${formatBsShort(0)}</span>
           <span class="gasto-center-label">Sin ${mode.label.toLowerCase()} en este periodo</span>`}
    </div>`;

  document.querySelectorAll("[data-gasto-view]").forEach(b => b.classList.toggle("active", b.dataset.gastoView === gastoView));

  const listEl = document.getElementById("gasto-list");
  if (!rows.length) {
    listEl.innerHTML = "";
  } else if (gastoView === "principales") {
    const groups = [];
    rows.forEach(r => {
      let g = groups.find(x => x.id === r.group.id);
      if (!g) { g = Object.assign({ amount: 0 }, r.group); groups.push(g); }
      g.amount += r.amount;
    });
    groups.sort((a, b) => b.amount - a.amount);
    listEl.innerHTML = groups.map(g => `
      <div class="gasto-group-row">
        <span class="swatch" style="background:${g.color}"></span>
        <span class="gasto-group-name">${escapeHtml(g.label)}</span>
        <span class="breakdown-leader"></span>
        <span class="gasto-group-pct">${total > 0 ? Math.round(g.amount / total * 100) : 0}%</span>
        <span class="gasto-group-amount">${formatBsShort(g.amount)}</span>
      </div>`).join("");
  } else {
    listEl.innerHTML = rows.map(r => `
      <button type="button" class="gasto-cat-row${r.id === (center && center.id) ? " selected" : ""}" data-gasto-row="${r.id}">
        <span class="txn-icon txn-icon-solid" style="background:${r.color}">${r.emoji ? r.emoji : `<span data-icon="${r.icon}"></span>`}</span>
        <span class="gasto-cat-name">${escapeHtml(r.label)}</span>
        <span class="gasto-cat-amount">${formatBsShort(r.amount)}</span>
      </button>`).join("");
  }
  renderIcons(document.getElementById("fin-tab-gasto"));
}

document.getElementById("gasto-mode").addEventListener("click", () => {
  openPicker({
    title: "¿Qué quieres ver?",
    items: Object.keys(GASTO_MODES).map(id => ({ id, label: GASTO_MODES[id].label, icon: GASTO_MODES[id].icon, color: GASTO_MODES[id].color })),
    onPick: id => { closePicker(); gastoMode = id; gastoSelected = null; renderGasto(); }
  });
});

document.getElementById("fin-tab-gasto").addEventListener("click", e => {
  const view = e.target.closest("[data-gasto-view]");
  if (view) { gastoView = view.dataset.gastoView; renderGasto(); return; }
  const arc = e.target.closest("[data-gasto-pick]");
  if (arc) { gastoSelected = arc.dataset.gastoPick === gastoSelected ? null : arc.dataset.gastoPick; renderGasto(); return; }
  const row = e.target.closest("[data-gasto-row]");
  if (row) {
    gastoSelected = row.dataset.gastoRow;
    renderGasto();
    if (gastoMode !== "ahorro") openCategoryDetail(gastoMode, gastoSelected);
  }
});

// ================= Análisis =================
// Todo lo que no se ve en Resumen ni en Movimientos: comparaciones con tus
// meses anteriores, qué cambió, patrones y tu colchón. Los cálculos están en
// js/finanzas/analisis.js (en centavos).
const FA = FinanzasAnalisis;
let analisisCol = null; // mes elegido en el gráfico de 6 meses
let analisisDia = null; // día elegido en el gráfico de la semana
// En Análisis los promedios y comparaciones van en Bs enteros (más fáciles
// de leer); los movimientos puntuales, con sus centavos.
const bsC = c => formatBsShort(Math.round(c / 100));
const bsExacto = c => formatBsShort(FD.aBs(Math.round(c)));
const nombreCatGasto = id => findCategory("gasto", id).label;
function umbralHormigaCent() {
  const v = Number(ajustes.umbralHormiga);
  return FD.aCentavos(v > 0 ? v : AJUSTES_DEFECTO.umbralHormiga);
}
function horasMes() {
  const v = Number(ajustes.horasMes);
  return v > 0 ? Math.min(v, 744) : AJUSTES_DEFECTO.horasMes;
}
function mesCorto(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
}
function pctTxt(r) {
  return `${Math.round(Math.abs(r) * 100)} %`;
}
// ▲/▼ con texto: el color nunca va solo. En gastos, bajar es bueno.
function deltaHTML(r, bajarEsBueno = true) {
  if (r == null || !Number.isFinite(r)) return "";
  if (Math.abs(r) < 0.05) return `<span class="an-delta igual">≈ igual</span>`;
  const sube = r > 0;
  return `<span class="an-delta ${sube === bajarEsBueno ? "mal" : "bien"}">${sube ? "▲" : "▼"} ${pctTxt(r)} ${sube ? "más" : "menos"}</span>`;
}

function anDiagnosticoHTML(a, period) {
  const altura = a.parcial ? " a esta altura" : "";
  const comp = a.prom.n && a.prom.gastosCorte > 0
    ? `<p class="an-comp">${deltaHTML((a.actual.gastos - a.prom.gastosCorte) / a.prom.gastosCorte)} que tu promedio${altura} (${bsC(a.prom.gastosCorte)}, últimos ${a.prom.n} ${a.prom.n === 1 ? "mes" : "meses"})</p>`
    : `<p class="an-comp">Cuando tengas un mes anterior con movimientos, aquí verás si gastas más o menos que antes.</p>`;
  const tasa = a.tasaAhorro;
  const tasaTxt = tasa == null ? "—" : `${tasa < 0 ? "−" : ""}${pctTxt(tasa)}`;
  const tasaSub = tasa == null ? "sin ingresos en este periodo"
    : tasa < 0 ? "gastaste más de lo que entró" : "de lo que entró";
  const tasaProm = a.prom.tasaAhorro != null ? `<span class="an-kpi-prom">Promedio: ${a.prom.tasaAhorro < 0 ? "−" : ""}${pctTxt(a.prom.tasaAhorro)}</span>` : "";
  const diaProm = a.prom.n ? `<span class="an-kpi-prom">Promedio: ${bsC(a.prom.porDia)}</span>` : "";
  const racha = a.racha >= 2 ? `<span class="an-kpi-prom">Racha actual: ${a.racha} días</span>` : "";
  return `
    <div class="vg-label">Gastado · ${periodLabel(period)}</div>
    <div class="vg-big an-num">${bsC(a.actual.gastos)}</div>
    ${comp}
    <div class="an-kpis">
      <div class="an-kpi"><span class="an-kpi-t">Ahorro</span><strong class="an-num${tasa != null && tasa < 0 ? " neg" : ""}">${tasaTxt}</strong><span class="an-kpi-sub">${tasaSub}</span>${tasaProm}</div>
      <div class="an-kpi"><span class="an-kpi-t">Por día</span><strong class="an-num">${bsC(a.porDia)}</strong><span class="an-kpi-sub">en ${a.corte} ${a.corte === 1 ? "día" : "días"}</span>${diaProm}</div>
      <div class="an-kpi"><span class="an-kpi-t">Días sin gastar</span><strong class="an-num">${a.sinGastar}</strong><span class="an-kpi-sub">de ${a.corte} ${a.corte === 1 ? "día" : "días"}</span>${racha}</div>
    </div>`;
}

const HALLAZGO_ICONO = { sube: "▲", baja: "▼", hormiga: "•", info: "i" };
function anHallazgosHTML(a) {
  const lista = FA.hallazgos(a, nombreCatGasto, bsC, umbralHormigaCent());
  return `<h2 class="an-titulo" id="an-hallazgos-t">Lo que encontramos</h2>
    ${lista.length ? `<ul class="an-hallazgos">${lista.map(h => `
      <li class="an-hallazgo ${h.tipo}"><span class="an-hallazgo-ic" aria-hidden="true">${HALLAZGO_ICONO[h.tipo] || "i"}</span><span>${escapeHtml(h.texto)}</span></li>`).join("")}</ul>`
      : `<p class="an-vacio">Por ahora nada fuera de lo normal. Con más movimientos aparecerán comparaciones aquí.</p>`}`;
}

function anTendenciaHTML(a) {
  const t = a.tendencia;
  const max = Math.max(1, ...t.map(p => Math.max(p.ingresos, p.gastos)));
  const sel = analisisCol != null && analisisCol < t.length ? analisisCol : t.length - 1;
  const alto = v => (v > 0 ? Math.max(2, v / max * 100) : 0).toFixed(1);
  const p = t[sel];
  const neto = p.ingresos - p.gastos;
  const nombre = capitalize(new Date(p.desde + "T00:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
  const conIngreso = t.slice(0, -1).filter(x => x.ingresos > 0 || x.gastos > 0);
  const promNeto = conIngreso.length ? conIngreso.reduce((s, x) => s + x.ingresos - x.gastos, 0) / conIngreso.length : null;
  return `<h2 class="an-titulo" id="an-tendencia-t">Últimos 6 meses</h2>
    <div class="vg-legend an-leyenda"><span><i class="an-ing"></i>Ingresos</span><span><i class="an-gas"></i>Gastos</span></div>
    <p class="an-detalle" aria-live="polite"><strong>${nombre}${sel === t.length - 1 && a.parcial ? " (en curso)" : ""}:</strong>
      entró ${bsC(p.ingresos)}, salió ${bsC(p.gastos)} · ${neto >= 0 ? `quedó ${bsC(neto)}` : `faltaron ${bsC(-neto)}`}</p>
    <div class="an-barras">${t.map((x, i) => `
      <button type="button" class="an-col${i === sel ? " sel" : ""}" data-an-col="${i}" aria-pressed="${i === sel}"
        aria-label="${escapeHtml(mesCorto(x.desde))}: ingresos ${bsC(x.ingresos)}, gastos ${bsC(x.gastos)}">
        <span class="an-par"><span class="an-bar an-ing" style="height:${alto(x.ingresos)}%"></span><span class="an-bar an-gas" style="height:${alto(x.gastos)}%"></span></span>
        <span class="an-col-mes">${escapeHtml(mesCorto(x.desde))}</span>
      </button>`).join("")}</div>
    ${promNeto != null ? `<p class="an-pie">En los meses anteriores te quedó en promedio <strong class="an-num">${promNeto < 0 ? "−" : ""}${bsC(Math.abs(promNeto))}</strong> al mes.</p>` : ""}`;
}

function anCambiosHTML(a) {
  const head = `<h2 class="an-titulo" id="an-cambios-t">Qué cambió</h2>`;
  if (!a.prom.n) return `${head}<p class="an-vacio">Necesitas al menos un mes anterior con movimientos para comparar.</p>`;
  const filas = a.cambios.filter(c => Math.abs(c.dif) >= 100).slice(0, 6);
  const sub = `<p class="an-sub">Por categoría, contra tu promedio de ${a.prom.n === 1 ? "el mes anterior" : `los últimos ${a.prom.n} meses`}${a.parcial ? " a esta altura" : ""}.</p>`;
  if (!filas.length) return `${head}${sub}<p class="an-vacio">Gastas casi igual que siempre en cada categoría.</p>`;
  const max = Math.max(...filas.map(c => Math.abs(c.dif)));
  return `${head}${sub}<div class="an-cambios">${filas.map(c => {
    const cat = findCategory("gasto", c.id);
    const w = (Math.abs(c.dif) / max * 100).toFixed(1);
    const sube = c.dif > 0;
    return `<button type="button" class="an-cambio" data-cat-detail="${escapeHtml(c.id)}" data-cat-type="gasto"
        aria-label="${escapeHtml(cat.label)}: ${sube ? "subió" : "bajó"} ${bsC(Math.abs(c.dif))}, ahora ${bsC(c.ahora)}, antes ${bsC(c.antes)}">
      <span class="an-cambio-nom">${txnIconHTML(cat)}<span>${escapeHtml(cat.label)}</span></span>
      <span class="an-div" aria-hidden="true"><span class="an-div-lado neg">${!sube ? `<i style="width:${w}%"></i>` : ""}</span><span class="an-div-lado pos">${sube ? `<i style="width:${w}%"></i>` : ""}</span></span>
      <span class="an-cambio-val ${sube ? "mal" : "bien"}">${sube ? "+" : "−"}${bsC(Math.abs(c.dif))}</span>
    </button>`;
  }).join("")}</div>
  <div class="an-div-ejes" aria-hidden="true"><span>▼ Gastaste menos</span><span>Gastaste más ▲</span></div>`;
}

const DIAS_LUNES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
function anSemanaHTML(a) {
  const head = `<h2 class="an-titulo" id="an-semana-t">Tu semana</h2>`;
  const max = Math.max(...a.semana);
  if (!(max > 0)) return `${head}<p class="an-vacio">Todavía no hay gastos para ver en qué días gastas más.</p>`;
  const top = a.semana.indexOf(max);
  const sel = analisisDia != null ? analisisDia : top;
  return `${head}
    <p class="an-detalle" aria-live="polite">${sel === top ? "Gastas más los" : "Los"} <strong>${DIAS_LUNES[sel]}</strong>: ${bsC(a.semana[sel])} en promedio.</p>
    <div class="an-barras an-semana">${a.semana.map((v, i) => `
      <button type="button" class="an-col${i === sel ? " sel" : ""}${i === top ? " top" : ""}" data-an-dia="${i}" aria-pressed="${i === sel}" aria-label="${capitalize(DIAS_LUNES[i])}: ${bsC(v)} en promedio">
        <span class="an-par"><span class="an-bar an-gas" style="height:${(v > 0 ? Math.max(2, v / max * 100) : 0).toFixed(1)}%"></span></span>
        <span class="an-col-mes">${DIAS_LUNES[i].slice(0, 2)}</span>
      </button>`).join("")}</div>
    <p class="an-pie">Promedio por día, con este periodo y los meses anteriores.</p>`;
}

function anHormigaHTML(a) {
  const h = a.hormiga;
  const head = `<h2 class="an-titulo" id="an-hormiga-t">Gastos hormiga</h2>
    <p class="an-sub">Gastos de hasta ${bsC(umbralHormigaCent())}. Puedes cambiar el límite en <a href="#fin-ajustes">Ajustes</a>.</p>`;
  if (!h.n) return `${head}<p class="an-vacio">Ningún gasto pequeño en este periodo.</p>`;
  const pct = a.actual.gastos > 0 ? h.total / a.actual.gastos : 0;
  return `${head}
    <div class="an-fila-big"><span class="vg-big an-num">${bsC(h.total)}</span><span class="an-kpi-sub">${h.n} ${h.n === 1 ? "gasto" : "gastos"} · ${pctTxt(pct)} de lo gastado</span></div>
    <p class="an-detalle">A este ritmo serían <strong class="an-num">${bsC(h.anual)}</strong> en un año.</p>
    <div class="an-chips">${h.cats.slice(0, 4).map(c => `<span class="an-chip">${escapeHtml(nombreCatGasto(c.id))} · ${bsC(c.total)}</span>`).join("")}</div>`;
}

function anMayoresHTML(a) {
  const head = `<h2 class="an-titulo" id="an-mayores-t">Tus gastos más grandes</h2>`;
  if (!a.mayores.length) return `${head}<p class="an-vacio">Sin gastos en este periodo.</p>`;
  return `${head}<div class="an-lista">${a.mayores.map(m => {
    const cat = findCategory("gasto", m.category);
    const pct = a.actual.gastos > 0 ? m.montoCent / a.actual.gastos : 0;
    return `<button type="button" class="an-item" data-an-txn="${escapeHtml(m.id)}">
      ${txnIconHTML(cat)}
      <span class="an-item-txt"><span class="an-item-nom">${escapeHtml(m.desc || cat.label)}</span><span class="an-item-sub">${escapeHtml(cat.label)} · ${fechaCorta(m.date)}</span></span>
      <span class="an-item-val"><span class="an-num">${bsExacto(m.montoCent)}</span><span class="an-item-sub">${pctTxt(pct)}</span></span>
    </button>`;
  }).join("")}</div>`;
}

function enDias(fecha) {
  const n = Math.round((new Date(fecha + "T12:00:00") - new Date(isoDate(new Date()) + "T12:00:00")) / 86400000);
  return n <= 0 ? "Hoy" : n === 1 ? "Mañana" : `En ${n} días`;
}
function anProximosHTML() {
  const hoy = isoDate(new Date());
  const lista = FD.proximosRecurrentes(recurrentes, financeCache, hoy, 30)
    .map(p => ({ fecha: p.fecha, nombre: p.rec.nombre, cent: p.rec.montoCent || 0, ingreso: p.rec.type === "ingreso" }));
  const t = FD.saldos(financeCache);
  if (t.deuda > 0) {
    const { date } = nextCardPayDate();
    const f = isoDate(date);
    if (f > hoy) lista.push({ fecha: f, nombre: "Pago de la tarjeta", cent: t.deuda, ingreso: false, tarjeta: true });
  }
  lista.sort((x, y) => x.fecha.localeCompare(y.fecha));
  const head = `<h2 class="an-titulo" id="an-proximos-t">Próximos 30 días</h2>`;
  if (!lista.length) return `${head}<p class="an-vacio">No hay pagos programados. <a href="#fin-recurrentes">Configura tus pagos recurrentes</a> (alquiler, servicios, suscripciones) para verlos venir.</p>`;
  const salen = lista.filter(x => !x.ingreso).reduce((s, x) => s + x.cent, 0);
  const entran = lista.filter(x => x.ingreso).reduce((s, x) => s + x.cent, 0);
  const libre = t.saldo + entran - salen;
  return `${head}
    <div class="an-fila-big"><span class="vg-big an-num">${bsC(salen)}</span><span class="an-kpi-sub">por pagar${entran ? ` · entran ${bsC(entran)}` : ""}</span></div>
    <p class="an-detalle">${libre >= 0
      ? `Con Efectivo y Débito (${bsC(t.saldo)})${entran ? " y lo que entra" : ""} te alcanza: sobrarían ${bsC(libre)}.`
      : `Con Efectivo y Débito (${bsC(t.saldo)})${entran ? " y lo que entra" : ""} te faltarían <strong class="an-num">${bsC(-libre)}</strong>.`}</p>
    <div class="an-lista">${lista.slice(0, 6).map(x => `
      <div class="an-item">
        <span class="an-fecha"><strong>${Number(x.fecha.slice(8))}</strong>${escapeHtml(mesCorto(x.fecha))}</span>
        <span class="an-item-txt"><span class="an-item-nom">${escapeHtml(x.nombre)}</span><span class="an-item-sub">${x.tarjeta ? "Deuda actual de la tarjeta" : enDias(x.fecha)}</span></span>
        <span class="an-item-val an-num${x.ingreso ? " bien" : ""}">${x.ingreso ? "+" : ""}${bsExacto(x.cent)}</span>
      </div>`).join("")}</div>
    ${lista.length > 6 ? `<p class="an-pie">Y ${lista.length - 6} más.</p>` : ""}`;
}

function anSaludHTML(a) {
  const head = `<h2 class="an-titulo" id="an-salud-t">Tu colchón</h2>`;
  const t = FD.saldos(financeCache);
  const tco = tcoData && tcoData.ultimo && tcoData.ultimo.tco;
  let colchon = t.saldo - t.deuda;
  let sinTco = false;
  const usd = FD.sumaCent(ahorrosCache, x => x.amount);
  if (usd) { if (tco) colchon += Math.round(usd * tco); else sinTco = true; }
  carterasCustomCache.forEach(w => {
    const cent = FD.aCentavos(customWalletBalance(w.id));
    if (w.moneda === "US$") { if (tco) colchon += Math.round(cent * tco); else sinTco = true; } else colchon += cent;
  });
  const gastoMes = a.prom.n ? a.prom.gastos : 0;
  const meses = FA.mesesCubiertos(colchon, gastoMes);
  let bloqueMeses;
  if (meses == null) {
    bloqueMeses = `<p class="an-vacio">Con un mes completo de gastos podrás ver cuántos meses te cubren tus ahorros.</p>`;
  } else {
    const estado = meses < 1 ? "Muy justo" : meses < 3 ? "Vas armando tu colchón" : meses < 6 ? "Buen colchón" : "Colchón sólido";
    const fmt = meses.toLocaleString("es-BO", { maximumFractionDigits: 1 });
    bloqueMeses = `
      <div class="an-fila-big"><span class="vg-big an-num">${fmt} ${meses >= 0.95 && meses < 1.05 ? "mes" : "meses"}</span><span class="an-kpi-sub">${estado}</span></div>
      <div class="an-meta" role="img" aria-label="${fmt} de 6 meses recomendados"><span style="width:${Math.min(meses / 6, 1) * 100}%"></span><i style="left:50%"></i></div>
      <div class="an-meta-ejes" aria-hidden="true"><span>0</span><span>3 meses</span><span>6 meses</span></div>
      <p class="an-detalle">Podrías vivir ${fmt} ${meses >= 0.95 && meses < 1.05 ? "mes" : "meses"} con lo que tienes (${bsC(colchon)} entre carteras y ahorro, menos la tarjeta), gastando tu promedio de ${bsC(gastoMes)} al mes. Lo recomendado: de 3 a 6 meses.${sinTco ? " Sin tipo de cambio todavía, lo que tienes en US$ no se suma." : ""}</p>`;
  }
  const ingresoMes = a.prom.ingresos || a.actual.ingresos;
  const horas = FA.horasDeTrabajo(a.actual.gastos, ingresoMes, horasMes());
  let bloqueHoras = "";
  if (horas != null && a.actual.gastos > 0) {
    const porHora = ingresoMes / horasMes();
    const topCat = Object.keys(a.actual.porCat).sort((x, y) => a.actual.porCat[y] - a.actual.porCat[x])[0];
    const hTop = topCat ? a.actual.porCat[topCat] / porHora : 0;
    const hTxt = n => n.toLocaleString("es-BO", { maximumFractionDigits: n < 10 ? 1 : 0 });
    bloqueHoras = `
      <h3 class="an-subtitulo">En horas de trabajo</h3>
      <div class="an-fila-big"><span class="vg-big an-num">${hTxt(horas)} h</span><span class="an-kpi-sub">≈ ${hTxt(horas / 8)} días de 8 h</span></div>
      <p class="an-detalle">Tu hora vale unos ${bsC(porHora)} (tu ingreso de ${bsC(ingresoMes)} al mes ÷ ${horasMes()} h).${topCat ? ` Solo en ${escapeHtml(nombreCatGasto(topCat))} se fueron ${hTxt(hTop)} h.` : ""} Cambia las horas en <a href="#fin-ajustes">Ajustes</a>.</p>`;
  }
  return head + bloqueMeses + bloqueHoras;
}

function renderAnalisis() {
  const cont = document.getElementById("fin-tab-gasto");
  if (!cont) return;
  const period = currentBudgetPeriod();
  const periodos = [0, 1, 2, 3, 4, 5].map(k => budgetPeriodAt(monthOffset - k));
  const a = FA.analizar(financeCache, periodos.map(p => ({ desde: p.startISO, hasta: p.endISO })), isoDate(new Date()), { umbralHormigaCent: umbralHormigaCent() });
  const poner = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  poner("an-diagnostico", anDiagnosticoHTML(a, period));
  poner("an-hallazgos", anHallazgosHTML(a));
  poner("an-tendencia", anTendenciaHTML(a));
  poner("an-cambios", anCambiosHTML(a));
  poner("an-semana", anSemanaHTML(a));
  poner("vg-calendar", vgCalendarHTML(period));
  poner("an-hormiga", anHormigaHTML(a));
  poner("an-mayores", anMayoresHTML(a));
  poner("an-proximos", anProximosHTML());
  poner("an-salud", anSaludHTML(a));
  renderIcons(cont);
}

document.getElementById("fin-tab-gasto").addEventListener("click", e => {
  const col = e.target.closest("[data-an-col]");
  if (col) { analisisCol = Number(col.dataset.anCol); renderAnalisis(); return; }
  const dia = e.target.closest("[data-an-dia]");
  if (dia) { analisisDia = Number(dia.dataset.anDia); renderAnalisis(); return; }
  const cat = e.target.closest(".an-cambio[data-cat-detail]");
  if (cat) { openCategoryDetail("gasto", cat.dataset.catDetail); return; }
  const txn = e.target.closest("[data-an-txn]");
  if (txn) { const m = financeCache.find(x => x.id === txn.dataset.anTxn); if (m) openTxnSheet(m); return; }
  const day = e.target.closest("[data-vg-day].has");
  if (day) {
    showFinTab("lista");
    const dia = day.dataset.vgDay;
    setTimeout(() => jumpToDay(dia), 80);
  }
});

(function wireTxnSearch() {
  const box = document.getElementById("txn-search");
  const input = document.getElementById("txn-search-input");
  const open = () => { box.classList.add("open"); setTimeout(() => input.focus(), 30); };
  const clear = () => { input.value = ""; txnQuery = ""; box.classList.remove("open"); renderMovements(); };
  document.getElementById("txn-search-toggle").addEventListener("click", () => box.classList.contains("open") ? clear() : open());
  document.getElementById("txn-search-clear").addEventListener("click", clear);
  input.addEventListener("input", () => { txnQuery = input.value; renderMovements(); });
  input.addEventListener("keydown", e => { if (e.key === "Escape") clear(); });
})();

// ---- Tipo de cambio oficial (TCO) del BCB ----
// Lo actualiza cada día una tarea de GitHub en data/tipo-cambio.json.
let tcoData = null; // { ultimo: {fecha, tco}, historial: { "AAAA-MM-DD": tco } }

function loadTco() {
  fetch(`data/tipo-cambio.json?t=${Date.now()}`, { cache: "no-store" })
    .then(r => (r.ok ? r.json() : null))
    .then(d => { if (d && d.ultimo) { tcoData = d; renderAll(); if (txnSheet) renderTxnSheet(); } })
    .catch(() => {});
}
loadTco();
setInterval(loadTco, 3 * 60 * 60 * 1000);

// TCO vigente en una fecha: el último publicado hasta ese día.
function officialRateFor(dateISO) {
  if (!tcoData) return null;
  const days = Object.keys(tcoData.historial || {}).filter(d => d <= dateISO).sort();
  return days.length ? tcoData.historial[days[days.length - 1]] : tcoData.ultimo.tco;
}

function fmtRate(n) {
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
function parseNum(str) {
  return parseFloat(String(str || "").replace(/\s/g, "").replace(",", ".")) || 0;
}

// Con el tipo de cambio calcula cuánto llega en la otra moneda.
function syncTransferAmounts() {
  const t = txnSheet;
  if (!t || t.type !== "transferencia" || walletCurrency(t.from) === walletCurrency(t.to)) return;
  const rate = parseNum(t.rate);
  const amount = montoTxn(t) || 0;
  if (rate <= 0 || amount <= 0) return;
  const toUsd = walletCurrency(t.to) === "US$";
  const value = toUsd ? amount / rate : amount * rate;
  t.amountTo = String(Math.round(value * 100) / 100).replace(".", ",");
}

// ---- Hoja "Nueva transacción" (como Buddy) ----
const PAYMENT_ICONS = { efectivo: "salary", debito: "bank", credito: "finance" };
const PAYMENT_COLORS = { efectivo: "#9b6bde", debito: "#4d9de0", credito: "#e0567c" };
let txnSheet = null; // { id, type, category, payment, amount, desc, date, excluded, keypad }

function defaultCategory(type) {
  if (type === "ingreso") return (CATEGORIES.ingreso[0] || {}).id;
  const otros = gastoCategoriesCache.find(c => c.id === "otros");
  return (otros || gastoCategoriesCache[0] || {}).id;
}

function openTxnSheet(movement, inicial) {
  const toStr = n => String(n).replace(".", ",");
  txnSheet = movement
    ? {
        id: movement.id, type: movement.type, category: movement.category, payment: movement.payment || "efectivo",
        amount: toStr(movement.amount), desc: movement.desc || "", date: movement.date,
        excluded: !!movement.excluded, factura: !!movement.factura, keypad: false,
        from: cashWallet(movement.from || "debito"), to: cashWallet(movement.to || "ahorro"),
        amountTo: movement.amountTo != null ? toStr(movement.amountTo) : "",
        rate: movement.tipoCambio ? toStr(movement.tipoCambio) : "", rateTouched: true,
        readonly: movement.type === "transferencia", movement
      }
    : { id: null, type: "gasto", category: null, payment: ultimaCartera("gasto"), amount: "0", desc: "", date: isoDate(new Date()), excluded: false, factura: false, keypad: true, from: "debito", to: "ahorro", amountTo: "", rate: "", rateTouched: false, readonly: false };
  if (inicial && !movement) Object.assign(txnSheet, inicial, { keypad: inicial.keypad !== undefined ? inicial.keypad : true });
  txnError(null);
  renderTxnSheet();
  showSheet(document.getElementById("txn-sheet"));
}

// ---- Registro rápido ----
// La cartera por defecto es la última que usaste (una para gastos y otra
// para ingresos).
const CLAVE_ULTIMA_CARTERA = "manolo.finanzas.ultimaCartera";
function ultimaCartera(tipo) {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_ULTIMA_CARTERA) || "{}")[tipo];
    if (v && findPayment(v) && !(tipo === "ingreso" && v === "credito")) return v;
  } catch (e) { /* sin almacenamiento */ }
  return tipo === "ingreso" ? "debito" : "efectivo";
}
function recordarCartera(tipo, pago) {
  try {
    const o = JSON.parse(localStorage.getItem(CLAVE_ULTIMA_CARTERA) || "{}");
    o[tipo] = pago;
    localStorage.setItem(CLAVE_ULTIMA_CARTERA, JSON.stringify(o));
  } catch (e) { /* sin almacenamiento */ }
}
// Monto del teclado en Bs (acepta "25+18").
function montoTxn(t) {
  const c = FD.evaluarMonto(t.amount);
  return c == null ? null : FD.aBs(c);
}
function txnError(texto, donde) {
  const el = document.getElementById("txn-sheet-error");
  if (!el) return;
  el.hidden = !texto;
  el.textContent = texto || "";
  if (!texto) return;
  const blanco = document.getElementById(donde || "txn-sheet-amount");
  if (blanco) { blanco.classList.add("shake"); setTimeout(() => blanco.classList.remove("shake"), 400); }
}
// Hasta 8 categorías más usadas como chips; "Más" abre la lista completa.
function renderTxnChips() {
  const t = txnSheet;
  const el = document.getElementById("txn-sheet-chips");
  if (!el) return;
  if (t.type === "transferencia" || t.readonly) { el.innerHTML = ""; return; }
  let lista = mostUsedCategories(t.type);
  if (lista.length < 8) {
    const resto = catSheetSections(t.type).flatMap(sec => sec.items).filter(c => !lista.some(x => x.id === c.id));
    lista = lista.concat(resto).slice(0, 8);
  }
  if (t.category && !lista.some(c => c.id === t.category)) lista = [findCategory(t.type, t.category)].concat(lista).slice(0, 8);
  el.innerHTML = lista.map(c => `
    <button type="button" class="txn-chip${c.id === t.category ? " is-on" : ""}" data-txn-chip="${escapeHtml(c.id)}" aria-pressed="${c.id === t.category}">
      <span class="txn-chip-ico" style="background:${c.color}">${c.emoji ? `<span class="txn-chip-emoji">${c.emoji}</span>` : `<span data-icon="${c.icon}"></span>`}</span>
      <span class="txn-chip-t">${escapeHtml(c.label)}</span>
    </button>`).join("") + `
    <button type="button" class="txn-chip txn-chip-mas" data-txn-mas aria-label="Ver todas las categorías">
      <span class="txn-chip-ico"><span data-icon="otherCategory"></span></span><span class="txn-chip-t">Más</span>
    </button>`;
}

function closeTxnSheet() {
  hideSheet(document.getElementById("txn-sheet"));
  txnSheet = null;
}

function renderTxnSheet() {
  const t = txnSheet;
  const isTransfer = t.type === "transferencia";
  const editable = t.type === "gasto" || t.type === "ingreso" || (isTransfer && !t.readonly);
  const sheet = document.getElementById("txn-sheet");
  sheet.classList.toggle("is-transfer", isTransfer);
  sheet.classList.toggle("is-readonly", !!t.readonly);
  document.getElementById("txn-sheet-title").textContent = t.readonly ? "Transferencia" : t.id ? "Editar transacción" : "Nueva transacción";
  pintarMontoTxn();
  document.getElementById("txn-sheet-currency").textContent = isTransfer ? walletCurrency(t.from) : "Bs";
  const swap = document.getElementById("txn-sheet-swap");
  if (swap) swap.disabled = !!t.readonly || t.to === "tarjeta";
  document.querySelectorAll("#txn-sheet [data-txn-type]").forEach(b => {
    b.classList.toggle("active", b.dataset.txnType === t.type);
    b.hidden = !editable || (t.id && b.dataset.txnType === "transferencia");
  });

  const walletRow = (key, id) => {
    const v = walletVisual(id);
    document.getElementById(`txn-sheet-${key}-badge`).outerHTML = `<span id="txn-sheet-${key}-badge" class="txn-icon txn-icon-solid" style="background:${v.color}" data-icon="${v.icon}"></span>`;
    document.getElementById(`txn-sheet-${key}-label`).textContent = `${walletLabel(id)} · ${walletBalanceText(id)}`;
    document.getElementById(`txn-sheet-${key}`).disabled = !!t.readonly;
  };
  walletRow("from", t.from);
  walletRow("to", t.to);
  const needsAmountTo = isTransfer && walletCurrency(t.from) !== walletCurrency(t.to);
  document.getElementById("txn-sheet-amount-to-row").hidden = !needsAmountTo;
  document.getElementById("txn-sheet-rate-row").hidden = !needsAmountTo;
  if (needsAmountTo && !t.readonly && !t.rateTouched) {
    const official = officialRateFor(t.date);
    if (official) { t.rate = String(official).replace(".", ","); syncTransferAmounts(); }
  }
  if (needsAmountTo && t.readonly && !t.rate) {
    const bs = walletCurrency(t.from) === "US$" ? parseNum(t.amountTo) : parseNum(t.amount);
    const usd = walletCurrency(t.from) === "US$" ? parseNum(t.amount) : parseNum(t.amountTo);
    if (usd > 0) t.rate = fmtRate(bs / usd);
  }
  const rateInput = document.getElementById("txn-sheet-rate");
  if (rateInput.value !== t.rate) rateInput.value = t.rate;
  rateInput.disabled = !!t.readonly;
  const official = officialRateFor(t.date);
  document.getElementById("txn-sheet-rate-hint").textContent = official ? `Oficial BCB: ${fmtRate(official)}` : "";
  document.getElementById("txn-sheet-amount-to-cur").textContent = walletCurrency(t.to);
  const amountToInput = document.getElementById("txn-sheet-amount-to");
  if (amountToInput.value !== t.amountTo) amountToInput.value = t.amountTo;
  amountToInput.disabled = !!t.readonly;
  document.getElementById("txn-sheet-note").disabled = !!t.readonly;
  document.getElementById("txn-sheet-save").hidden = !!t.readonly;

  const cat = t.category ? findCategory(t.type, t.category) : { label: "Elige una", icon: "otherCategory", color: "#4a4944" };
  document.getElementById("txn-sheet-cat-badge").outerHTML = txnIconHTML(cat).replace('<span class="txn-icon', '<span id="txn-sheet-cat-badge" class="txn-icon');
  document.getElementById("txn-sheet-cat-label").textContent = cat.label;
  renderTxnChips();
  document.getElementById("txn-sheet-cat").disabled = !editable;

  const pay = findPayment(t.payment) || PAYMENTS[0];
  document.getElementById("txn-sheet-pay-badge").outerHTML = `<span id="txn-sheet-pay-badge" class="txn-icon txn-icon-solid" style="background:${PAYMENT_COLORS[pay.id]}" data-icon="${PAYMENT_ICONS[pay.id]}"></span>`;
  document.getElementById("txn-sheet-pay-label").textContent = `${pay.label} · ${walletBalanceText(pay.id === "credito" ? "tarjeta" : pay.id)}`;
  document.getElementById("txn-sheet-pay-prefix").textContent = t.type === "ingreso" ? "Hacia:" : "Desde:";

  const note = document.getElementById("txn-sheet-note");
  if (note.value !== t.desc) note.value = t.desc;
  document.getElementById("txn-sheet-date-label").textContent = dayLabel(t.date);
  document.getElementById("txn-sheet-date-input").value = t.date;
  document.getElementById("txn-sheet-next-day").disabled = t.date >= isoDate(new Date());

  const excl = document.getElementById("txn-sheet-excluded");
  excl.checked = t.excluded;
  document.getElementById("txn-sheet-excluded-row").hidden = !editable || isTransfer;
  document.getElementById("txn-sheet-factura").checked = !!t.factura;
  document.getElementById("txn-sheet-factura-row").hidden = !editable || isTransfer || t.type !== "gasto";
  document.getElementById("txn-sheet-prev-day").disabled = !!t.readonly;
  document.getElementById("txn-sheet-date-input").disabled = !!t.readonly;
  if (t.readonly) document.getElementById("txn-sheet-next-day").disabled = true;

  document.getElementById("txn-sheet-delete").hidden = !t.id;
  document.getElementById("txn-sheet-save-otro").hidden = !!t.id || !!t.readonly;
  document.getElementById("txn-sheet-repetir-row").hidden = !!t.id || !!t.recurrenteId || isTransfer || !editable;
  document.getElementById("txn-sheet-repetir").value = t.repetir || "";
  document.getElementById("txn-sheet").classList.toggle("keypad-open", t.keypad && !t.readonly);
  renderIcons(document.getElementById("txn-sheet"));
}

// El monto se muestra como se escribe ("25 + 18") y abajo el resultado.
function formatExpr(expr) {
  return String(expr).split(/([+−])/).map(p => (p === "+" || p === "−" ? ` ${p} ` : formatSheetAmount(p))).join("");
}
function pintarMontoTxn() {
  const t = txnSheet;
  document.getElementById("txn-sheet-amount").textContent = formatExpr(t.amount);
  const res = document.getElementById("txn-sheet-resultado");
  const c = FD.evaluarMonto(t.amount);
  res.textContent = FD.tieneOperacion(t.amount) && c != null ? `= ${c < 0 ? "−" : ""}${formatBsShort(Math.abs(FD.aBs(c)))}` : "";
}
function pressTxnKey(key) {
  if (txnSheet.readonly) return;
  if (key === "=") {
    const c = FD.evaluarMonto(txnSheet.amount);
    txnSheet.amount = c != null && c > 0 ? String(FD.aBs(c)).replace(".", ",") : "0";
  } else {
    txnSheet.amount = FD.teclaMonto(txnSheet.amount, key);
  }
  txnError(null);
  pintarMontoTxn();
  if (txnSheet.type === "transferencia") {
    syncTransferAmounts();
    const el = document.getElementById("txn-sheet-amount-to");
    if (el.value !== txnSheet.amountTo) el.value = txnSheet.amountTo;
  }
}

function shiftTxnDate(days) {
  const d = new Date(txnSheet.date + "T00:00:00");
  d.setDate(d.getDate() + days);
  const next = isoDate(d);
  if (next > isoDate(new Date())) return;
  txnSheet.date = next;
  if (!txnSheet.rateTouched) txnSheet.rate = "";
  renderTxnSheet();
}

function chooseTxnCategory() {
  const t = txnSheet;
  openCatSheet(t.type, t.category, id => { t.category = id; txnError(null); renderTxnSheet(); });
}

// ---- Selector de categorías a pantalla completa (como Buddy) ----
const CAT_COLLAPSE_KEY = "manolo.catSheetCollapsed";
let catSheet = null; // { type, selected, onPick }

function loadCollapsedSections() {
  try { return new Set(JSON.parse(localStorage.getItem(CAT_COLLAPSE_KEY) || "[]")); } catch (e) { return new Set(); }
}
function saveCollapsedSections(set) {
  try { localStorage.setItem(CAT_COLLAPSE_KEY, JSON.stringify([...set])); } catch (e) { /* sin almacenamiento: solo no se recuerda */ }
}

function normalizeText(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function catSheetSections(type) {
  if (type === "ingreso") return [{ id: "__ingresos", title: "Ingresos", items: CATEGORIES.ingreso }];
  return categoryGroupsCache
    .map(g => ({ id: g.id, title: g.nombre, items: groupCategories(g) }))
    .filter(sec => sec.items.length);
}

function mostUsedCategories(type) {
  const counts = {};
  financeCache.forEach(m => { if (m.type === type) counts[m.category] = (counts[m.category] || 0) + 1; });
  return catSheetSections(type)
    .flatMap(sec => sec.items)
    .filter(c => counts[c.id])
    .sort((a, b) => counts[b.id] - counts[a.id])
    .slice(0, 8);
}

function catTileHTML(c, selected) {
  return `
    <button type="button" class="cat-tile${c.id === selected ? " selected" : ""}" data-cat-tile="${c.id}">
      <span class="cat-tile-circle" style="background:${c.color}">
        ${c.emoji ? `<span class="cat-tile-emoji">${c.emoji}</span>` : `<span class="cat-tile-icon" data-icon="${c.icon}"></span>`}
      </span>
      <span class="cat-tile-label">${escapeHtml(c.label)}</span>
    </button>`;
}

function renderCatSheet() {
  const { type, selected } = catSheet;
  const rawQuery = document.getElementById("cat-sheet-search").value.trim();
  const q = normalizeText(rawQuery);
  const collapsed = loadCollapsedSections();
  let sections = catSheetSections(type);

  if (q) {
    sections = sections
      .map(sec => ({ ...sec, items: normalizeText(sec.title).includes(q) ? sec.items : sec.items.filter(c => normalizeText(c.label).includes(q)) }))
      .filter(sec => sec.items.length);
  } else {
    const used = mostUsedCategories(type);
    if (used.length) sections = [{ id: "__used", title: "Más usado", items: used }].concat(sections);
  }

  const body = document.getElementById("cat-sheet-body");
  body.innerHTML = sections.length
    ? sections.map(sec => {
        const isCollapsed = !q && collapsed.has(sec.id);
        return `
          <section class="cat-sheet-section${isCollapsed ? " collapsed" : ""}">
            <div class="cat-sheet-section-head">
              <h4>${escapeHtml(sec.title)}</h4>
              <button type="button" class="cat-sheet-eye" data-toggle-section="${sec.id}" aria-expanded="${!isCollapsed}" aria-label="${isCollapsed ? "Mostrar" : "Ocultar"} ${escapeHtml(sec.title)}">
                <span data-icon="${isCollapsed ? "eyeOff" : "eye"}"></span>
              </button>
            </div>
            <div class="cat-sheet-grid">${sec.items.map(c => catTileHTML(c, selected)).join("")}</div>
          </section>`;
      }).join("")
    : `<p class="cat-sheet-empty">No hay categorías que coincidan con "${escapeHtml(rawQuery)}".</p>`;
  renderIcons(body);
}

function openCatSheet(type, selected, onPick) {
  catSheet = { type, selected, onPick };
  document.getElementById("cat-sheet-search").value = "";
  renderCatSheet();
  const el = document.getElementById("cat-sheet");
  showSheet(el);
  document.getElementById("cat-sheet-body").scrollTop = 0;
}

function closeCatSheet() {
  hideSheet(document.getElementById("cat-sheet"));
  catSheet = null;
}

function pickFromCatSheet(id) {
  const cb = catSheet && catSheet.onPick;
  closeCatSheet();
  if (cb) cb(id);
}

async function createFromCatSheet() {
  const { type } = catSheet;
  const label = await appDialog({ title: type === "ingreso" ? "Nueva categoría de ingreso" : "Nueva categoría", input: document.getElementById("cat-sheet-search").value.trim(), confirmLabel: "Siguiente" });
  if (!label || !catSheet) return;
  const base = slugify(label);
  const taken = id => CATEGORIES.ingreso.some(c => c.id === id) || gastoCategoriesCache.some(c => c.id === id);
  const id = uniqueId(base, taken);

  if (type === "ingreso") {
    saveIngresoCategories(CATEGORIES.ingreso.concat([{ id, label, icon: "salary", color: INGRESO_COLOR }]));
    pickFromCatSheet(id);
    return;
  }
  openPicker({
    title: `¿En qué sección va "${label}"?`,
    items: categoryGroupsCache.map(g => {
      const first = (g.items || [])[0];
      return { id: g.id, label: g.nombre, icon: first ? first.icon : "otherCategory", emoji: first && first.emoji, color: groupColor(g) };
    }),
    onPick: groupId => {
      closePicker();
      const next = categoryGroupsCache.map(g => g.id === groupId ? Object.assign({}, g, { items: (g.items || []).concat([{ id, label, icon: "otherCategory" }]) }) : g);
      categoryGroupsCache = next;
      gastoCategoriesCache = flattenCategoryGroups(next);
      saveCategoryGroups(next);
      pickFromCatSheet(id);
    }
  });
}

document.getElementById("cat-sheet").addEventListener("click", e => {
  if (!catSheet) return;
  const tile = e.target.closest("[data-cat-tile]");
  if (tile) { pickFromCatSheet(tile.dataset.catTile); return; }
  const eye = e.target.closest("[data-toggle-section]");
  if (eye) {
    const set = loadCollapsedSections();
    const id = eye.dataset.toggleSection;
    if (set.has(id)) set.delete(id); else set.add(id);
    saveCollapsedSections(set);
    renderCatSheet();
    return;
  }
  if (e.target.closest("#cat-sheet-close")) { closeCatSheet(); return; }
  if (e.target.closest("#cat-sheet-add")) { createFromCatSheet(); return; }
  if (e.target.closest("#cat-sheet-edit")) {
    closeCatSheet();
    closeTxnSheet();
    location.hash = "#fin-herramientas-categorias";
  }
});

document.getElementById("cat-sheet-search").addEventListener("input", () => { if (catSheet) renderCatSheet(); });


function chooseTxnPayment() {
  const t = txnSheet;
  const options = t.type === "ingreso" ? PAYMENTS.filter(p => p.id !== "credito") : PAYMENTS;
  openPicker({
    title: t.type === "ingreso" ? "¿A dónde entra?" : "¿Con qué pagaste?",
    items: options.map(p => ({ id: p.id, label: p.label, sub: walletBalanceText(p.id === "credito" ? "tarjeta" : p.id), icon: PAYMENT_ICONS[p.id], color: PAYMENT_COLORS[p.id] })),
    onPick: id => { closePicker(); t.payment = id; renderTxnSheet(); }
  });
}

function chooseTxnWallet(side) {
  const t = txnSheet;
  const otroLado = side === "from" ? "to" : "from";
  // La tarjeta solo puede recibir (pagarla); nunca es origen. Se muestran
  // todas las demás, también la que está del otro lado: si la eliges, se
  // intercambian (así Ahorro → Débito se arma en un toque).
  const wallets = ledgerWallets().filter(w => (side === "to" || w.id !== "tarjeta") && w.id !== t[side]);
  openPicker({
    title: side === "from" ? "¿Desde qué cartera?" : "¿A qué cartera?",
    items: wallets.map(w => {
      const v = walletVisual(w.id);
      return { id: w.id, label: `${walletLabel(w.id)} (${w.moneda})`, sub: walletBalanceText(w.id), icon: v.icon, color: v.color };
    }),
    onPick: id => {
      closePicker();
      const antes = t[side];
      t[side] = id;
      if (t[otroLado] === id) {
        // Se intercambian; la tarjeta nunca queda como origen.
        t[otroLado] = otroLado === "from" && antes === "tarjeta" ? (id === "debito" ? "efectivo" : "debito") : antes;
      }
      t.amountTo = "";
      renderTxnSheet();
    }
  });
}

function saveTxn(yOtro) {
  // Por si el selector de fecha no avisó el cambio, tomamos lo que muestra.
  applyTxnDateInput(document.getElementById("txn-sheet-date-input").value);
  const t = txnSheet;
  const amount = montoTxn(t);
  if (amount == null || amount <= 0) {
    t.keypad = true;
    renderTxnSheet();
    txnError(amount != null && amount < 0 ? "El resultado es negativo: revisa la resta." : "Escribe un monto mayor que cero.");
    return;
  }
  if (t.type === "transferencia") {
    if (t.from === t.to) { txnError("Elige dos carteras distintas.", "txn-sheet-to"); return; }
    let amountTo = amount;
    if (walletCurrency(t.from) !== walletCurrency(t.to)) {
      amountTo = parseFloat((t.amountTo || "").replace(",", ".")) || 0;
      if (amountTo <= 0) {
        t.keypad = false;
        renderTxnSheet();
        txnError(`Escribe cuánto llega en ${walletCurrency(t.to)}.`, "txn-sheet-amount-to");
        document.getElementById("txn-sheet-amount-to").focus();
        return;
      }
    }
    const rate = parseNum(t.rate);
    const payload = { from: t.from, to: t.to, amount, amountTo, desc: t.desc.trim(), date: t.date };
    if (walletCurrency(t.from) !== walletCurrency(t.to) && rate > 0) payload.tipoCambio = rate;
    createTransfer(payload).catch(err => console.error("Manolo: no se pudo guardar la transferencia", err));
    trasGuardar(yOtro, `Transferencia de ${formatBsShort(amount)} guardada`);
    return;
  }
  if (!t.category) {
    txnError("Elige una categoría.", "txn-sheet-chips");
    return;
  }
  const data = FD.conCentavos({ date: t.date, type: t.type, category: t.category, payment: t.payment, desc: t.desc.trim(), amount, excluded: t.excluded, factura: t.type === "gasto" && !!t.factura });
  let alerta = null;
  try { alerta = avisoPresupuesto(t, amount); } catch (err) { console.error("Manolo: no se pudo revisar el presupuesto", err); }
  recordarCartera(t.type, t.payment);
  let guardado;
  if (t.id) guardado = financeCollection().doc(t.id).update(data);
  else {
    const lote = nuevoLote();
    const nuevo = Object.assign({ createdAt: Date.now() }, data);
    // Confirmar un pago recurrente pendiente, o crear uno nuevo con "Repetir".
    if (t.recurrenteId) Object.assign(nuevo, { recurrenteId: t.recurrenteId, recurrenteFecha: t.recurrenteFecha });
    else if (t.repetir) {
      const rec = { id: "rec_" + Date.now().toString(36), nombre: t.desc.trim() || findCategory(t.type, t.category).label, type: t.type, category: t.category, payment: t.payment,
        amount, montoCent: FD.aCentavos(amount), frecuencia: t.repetir, inicio: t.date, activo: true, omitidos: [], creado: Date.now() };
      Object.assign(nuevo, { recurrenteId: rec.id, recurrenteFecha: t.date });
      lote.set(recDocRef(), { list: recurrentes.concat([rec]) }, { merge: true });
    }
    lote.set(financeCollection().doc(), nuevo);
    guardado = lote.commit();
  }
  guardado.catch(err => console.error("Manolo: no se pudo guardar el movimiento", err));
  trasGuardar(yOtro, `${t.type === "ingreso" ? "Ingreso" : "Gasto"} de ${formatBsShort(amount)} guardado · ${findCategory(t.type, t.category).label}`);
  if (alerta) {
    avisoFin(alerta);
    try { if (navigator.vibrate) navigator.vibrate([20, 60, 20]); } catch (e) { /* sin vibración */ }
  }
}
// Después de guardar: vibración corta (donde se pueda) y, con "Guardar y
// otro", la hoja queda lista para el siguiente con el mismo tipo, fecha y
// cartera.
function trasGuardar(yOtro, texto) {
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* sin vibración */ }
  if (!yOtro) { closeTxnSheet(); return; }
  const t = txnSheet;
  Object.assign(t, { id: null, amount: "0", desc: "", category: null, factura: false, excluded: false, amountTo: "", keypad: true, repetir: null, recurrenteId: null, recurrenteFecha: null });
  txnError(null);
  renderTxnSheet();
  avisoFin(texto);
}

function deleteTxnFromSheet() {
  const t = txnSheet;
  closeTxnSheet();
  if (t.type === "transferencia") deleteTransfer(t.movement);
  else deleteMovement(t.id);
}

document.getElementById("txn-add").addEventListener("click", () => openTxnSheet(null));

document.getElementById("finance-list").addEventListener("click", e => {
  const ed = e.target.closest("[data-swipe-editar]");
  if (ed) { cerrarDeslizada(); const m = financeCache.find(x => x.id === ed.dataset.swipeEditar); if (m) openTxnSheet(m); return; }
  const bo = e.target.closest("[data-swipe-borrar]");
  if (bo) { borrarDeslizada(bo.closest(".txn-swipe").querySelector(".txn-row")); return; }
  const row = e.target.closest("[data-edit-txn]");
  if (!row) return;
  // Si la fila está abierta, tocarla solo la cierra.
  if (row.classList.contains("is-abierto")) { cerrarDeslizada(); return; }
  const m = financeCache.find(x => x.id === row.dataset.editTxn);
  if (m) openTxnSheet(m);
});

// ---- Deslizar para editar o borrar ----
// Deslizar a la izquierda deja ver Editar y Borrar; un deslizamiento largo
// borra al instante (con «Deshacer» 5 s en el aviso de abajo).
const ANCHO_ACCIONES = 168;
let filaAbierta = null;
function cerrarDeslizada() {
  if (!filaAbierta) return;
  filaAbierta.style.transform = "";
  filaAbierta.classList.remove("is-abierto");
  filaAbierta = null;
}
function borrarDeslizada(row) {
  const id = row && row.dataset.editTxn;
  const m = financeCache.find(x => x.id === id);
  if (!m) return;
  filaAbierta = null;
  const caja = row.closest(".txn-swipe");
  caja.classList.add("is-borrando");
  row.style.transform = "translateX(-100%)";
  setTimeout(() => { if (m.type === "transferencia") deleteTransfer(m); else deleteMovement(m.id); }, reduceMotion() ? 0 : 180);
}
function reduceMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
(function wireSwipe() {
  const lista = document.getElementById("finance-list");
  let g = null, anularClick = false;
  lista.addEventListener("pointerdown", e => {
    const row = e.target.closest(".txn-row");
    if (!row || (e.pointerType === "mouse" && e.button !== 0)) return;
    g = { row, x: e.clientX, y: e.clientY, dx: 0, activo: false, base: row.classList.contains("is-abierto") ? -ANCHO_ACCIONES : 0, id: e.pointerId };
  });
  lista.addEventListener("pointermove", e => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.activo) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        g.activo = true;
        g.row.classList.add("is-arrastrando");
        if (filaAbierta && filaAbierta !== g.row) cerrarDeslizada();
        try { g.row.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      } else if (Math.abs(dy) > 10) { g = null; }
      return;
    }
    g.dx = Math.min(0, g.base + dx);
    g.row.style.transform = `translateX(${g.dx}px)`;
  });
  const soltar = e => {
    if (!g || (e && e.pointerId !== g.id)) return;
    const { row, activo, dx } = g;
    g = null;
    row.classList.remove("is-arrastrando");
    if (!activo) return;
    anularClick = true;
    setTimeout(() => { anularClick = false; }, 350);
    if (e && e.type === "pointercancel") { row.style.transform = ""; return; }
    if (-dx > row.offsetWidth * 0.6) borrarDeslizada(row);
    else if (-dx > 56) { row.style.transform = `translateX(-${ANCHO_ACCIONES}px)`; row.classList.add("is-abierto"); filaAbierta = row; }
    else { row.style.transform = ""; row.classList.remove("is-abierto"); if (filaAbierta === row) filaAbierta = null; }
  };
  lista.addEventListener("pointerup", soltar);
  lista.addEventListener("pointercancel", soltar);
  // El toque que termina un deslizamiento no abre la edición.
  lista.addEventListener("click", e => { if (anularClick) { e.stopPropagation(); e.preventDefault(); anularClick = false; } }, true);
  document.addEventListener("pointerdown", e => { if (filaAbierta && !e.target.closest(".txn-swipe")) cerrarDeslizada(); });
})();

// ---- Filtros de la lista ----
const NOMBRE_TIPO_FILTRO = { gasto: "Gastos", ingreso: "Ingresos", transferencia: "Transferencias" };
let borradorFiltros = {};
function carterasFiltro() {
  return [{ id: "efectivo", label: "Efectivo" }, { id: "debito", label: "Débito" }, { id: "tarjeta", label: "Tarjeta" }, { id: "ahorro", label: "Ahorro" }]
    .concat(carterasCustomCache.map(w => ({ id: w.id, label: w.nombre })));
}
function etiquetaFiltro(k, v) {
  if (k === "tipo") return NOMBRE_TIPO_FILTRO[v];
  if (k === "categoria") return findCategory(gastoCategoriesCache.some(c => c.id === v) ? "gasto" : "ingreso", v).label;
  if (k === "cartera") return (carterasFiltro().find(c => c.id === v) || { label: v }).label;
  if (k === "factura") return v === "si" ? "Con factura" : "Sin factura";
  if (k === "desde") return `Desde ${dayLabel(v).toLowerCase()}`;
  if (k === "hasta") return `Hasta ${dayLabel(v).toLowerCase()}`;
  return v;
}
function renderFiltrosActivos() {
  const cont = document.getElementById("txn-filtros-activos");
  const n = Object.keys(filtrosTxn).filter(k => filtrosTxn[k]).length;
  const badge = document.getElementById("txn-filtros-n");
  badge.hidden = !n;
  badge.textContent = n;
  document.getElementById("txn-filtros-btn").setAttribute("aria-label", n ? `Filtros (${n} activos)` : "Filtros");
  cont.hidden = !n;
  cont.innerHTML = n ? Object.keys(filtrosTxn).filter(k => filtrosTxn[k]).map(k =>
    `<button type="button" class="txn-filtro-pill" data-quitar-filtro="${k}" aria-label="Quitar filtro ${escapeHtml(etiquetaFiltro(k, filtrosTxn[k]))}">${escapeHtml(etiquetaFiltro(k, filtrosTxn[k]))}<span aria-hidden="true">✕</span></button>`).join("")
    + `<button type="button" class="txn-filtro-pill is-limpiar" data-quitar-filtro="todo">Quitar todo</button>` : "";
}
function chipsFiltro(clave, opciones) {
  const actual = borradorFiltros[clave] || "";
  return `<div class="txn-filtro-chips" role="radiogroup">${opciones.map(([v, t]) =>
    `<button type="button" class="fin-tab${actual === v ? " active" : ""}" role="radio" aria-checked="${actual === v}" data-filtro="${clave}" data-valor="${v}">${escapeHtml(t)}</button>`).join("")}</div>`;
}
function renderFiltrosHoja() {
  const f = borradorFiltros;
  const period = currentBudgetPeriod();
  const secciones = catSheetSections("gasto");
  const hoy = isoDate(new Date());
  document.getElementById("txn-filtros-cuerpo").innerHTML = `
    <h4>Tipo</h4>${chipsFiltro("tipo", [["", "Todos"], ["gasto", "Gastos"], ["ingreso", "Ingresos"], ["transferencia", "Transferencias"]])}
    <h4><label for="txn-filtro-cat">Categoría</label></h4>
    <select id="txn-filtro-cat" class="txn-filtro-select">
      <option value="">Todas</option>
      ${secciones.map(sec => `<optgroup label="${escapeHtml(sec.title)}">${sec.items.map(c => `<option value="${escapeHtml(c.id)}"${f.categoria === c.id ? " selected" : ""}>${escapeHtml(c.label)}</option>`).join("")}</optgroup>`).join("")}
      <optgroup label="Ingresos">${(CATEGORIES.ingreso || []).map(c => `<option value="${escapeHtml(c.id)}"${f.categoria === c.id ? " selected" : ""}>${escapeHtml(c.label)}</option>`).join("")}</optgroup>
    </select>
    <h4>Cartera</h4>${chipsFiltro("cartera", [["", "Todas"]].concat(carterasFiltro().map(c => [c.id, c.label])))}
    <h4>RE-IVA</h4>${chipsFiltro("factura", [["", "Todas"], ["si", "Con factura"], ["no", "Sin factura"]])}
    <h4>Fechas</h4>
    <div class="txn-filtro-chips">
      <button type="button" class="fin-tab" data-rango="periodo">Este periodo</button>
      <button type="button" class="fin-tab" data-rango="anterior">Periodo anterior</button>
      <button type="button" class="fin-tab" data-rango="90">Últimos 90 días</button>
      <button type="button" class="fin-tab" data-rango="">Todo</button>
    </div>
    <div class="txn-filtro-fechas">
      <label>Desde<input type="date" id="txn-filtro-desde" value="${f.desde || ""}" max="${hoy}"></label>
      <label>Hasta<input type="date" id="txn-filtro-hasta" value="${f.hasta || ""}" max="${hoy}"></label>
    </div>`;
  const n = FD.filtrarMovimientos(financeCache, borradorFiltros).length;
  document.getElementById("txn-filtros-ver").textContent = FD.hayFiltros(borradorFiltros) ? `Ver ${n} movimiento${n === 1 ? "" : "s"}` : "Ver todo el periodo";
}
function abrirFiltros() {
  borradorFiltros = Object.assign({}, filtrosTxn);
  renderFiltrosHoja();
  showSheet(document.getElementById("txn-filtros-sheet"));
}
function aplicarFiltros(f) {
  filtrosTxn = {};
  Object.keys(f).forEach(k => { if (f[k]) filtrosTxn[k] = f[k]; });
  cerrarDeslizada();
  renderMovements();
  showFinTab("lista");
}
document.getElementById("txn-filtros-btn").addEventListener("click", abrirFiltros);
document.getElementById("txn-filtros-sheet").addEventListener("click", e => {
  const b = e.target.closest("[data-filtro]");
  if (b) { borradorFiltros[b.dataset.filtro] = b.dataset.valor || null; renderFiltrosHoja(); return; }
  const r = e.target.closest("[data-rango]");
  if (r) {
    const hoy = new Date();
    const v = r.dataset.rango;
    if (v === "periodo") { const p = currentBudgetPeriod(); Object.assign(borradorFiltros, { desde: p.startISO, hasta: p.endISO }); }
    else if (v === "anterior") { const p = budgetPeriodAt(monthOffset - 1); Object.assign(borradorFiltros, { desde: p.startISO, hasta: p.endISO }); }
    else if (v === "90") { const d = new Date(hoy); d.setDate(d.getDate() - 89); Object.assign(borradorFiltros, { desde: isoDate(d), hasta: isoDate(hoy) }); }
    else Object.assign(borradorFiltros, { desde: null, hasta: null });
    renderFiltrosHoja();
    return;
  }
  if (e.target.closest("#txn-filtros-limpiar")) { borradorFiltros = {}; renderFiltrosHoja(); return; }
  if (e.target.closest("#txn-filtros-ver")) { aplicarFiltros(borradorFiltros); hideSheet(document.getElementById("txn-filtros-sheet")); return; }
  if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) hideSheet(document.getElementById("txn-filtros-sheet"));
});
document.getElementById("txn-filtros-sheet").addEventListener("change", e => {
  if (e.target.id === "txn-filtro-cat") borradorFiltros.categoria = e.target.value || null;
  if (e.target.id === "txn-filtro-desde") borradorFiltros.desde = e.target.value || null;
  if (e.target.id === "txn-filtro-hasta") borradorFiltros.hasta = e.target.value || null;
  if (borradorFiltros.desde && borradorFiltros.hasta && borradorFiltros.desde > borradorFiltros.hasta) {
    [borradorFiltros.desde, borradorFiltros.hasta] = [borradorFiltros.hasta, borradorFiltros.desde];
  }
  renderFiltrosHoja();
});
document.getElementById("fin-tab-lista").addEventListener("click", e => {
  const q = e.target.closest("[data-quitar-filtro]");
  if (!q) return;
  if (q.dataset.quitarFiltro === "todo") filtrosTxn = {};
  else delete filtrosTxn[q.dataset.quitarFiltro];
  renderMovements();
});

document.getElementById("txn-sheet").addEventListener("click", e => {
  if (!txnSheet) return;
  const key = e.target.closest("[data-txn-key]");
  if (key) { pressTxnKey(key.dataset.txnKey); return; }
  const typeBtn = e.target.closest("[data-txn-type]");
  if (typeBtn) {
    if (typeBtn.dataset.txnType !== txnSheet.type) {
      txnSheet.type = typeBtn.dataset.txnType;
      if (txnSheet.type !== "transferencia") { txnSheet.category = null; txnSheet.payment = ultimaCartera(txnSheet.type); }
      txnError(null);
      renderTxnSheet();
    }
    return;
  }
  if (e.target.closest("#txn-sheet-amount-btn")) { if (!txnSheet.readonly) { txnSheet.keypad = !txnSheet.keypad; renderTxnSheet(); } return; }
  if (e.target.closest("#txn-sheet-keypad-done")) { txnSheet.keypad = false; renderTxnSheet(); return; }
  if (e.target.closest("#txn-sheet-cat")) { chooseTxnCategory(); return; }
  if (e.target.closest("#txn-sheet-pay")) { chooseTxnPayment(); return; }
  if (e.target.closest("#txn-sheet-swap")) {
    const t = txnSheet;
    if (t.readonly || t.to === "tarjeta") return;
    [t.from, t.to] = [t.to, t.from];
    t.amountTo = "";
    renderTxnSheet();
    return;
  }
  if (e.target.closest("#txn-sheet-from")) { if (!txnSheet.readonly) chooseTxnWallet("from"); return; }
  if (e.target.closest("#txn-sheet-to")) { if (!txnSheet.readonly) chooseTxnWallet("to"); return; }
  if (e.target.closest("#txn-sheet-prev-day")) { shiftTxnDate(-1); return; }
  if (e.target.closest("#txn-sheet-next-day")) { shiftTxnDate(1); return; }
  if (e.target.closest("#txn-sheet-save")) { saveTxn(false); return; }
  if (e.target.closest("#txn-sheet-save-otro")) { saveTxn(true); return; }
  const chip = e.target.closest("[data-txn-chip]");
  if (chip) { txnSheet.category = chip.dataset.txnChip; txnError(null); renderTxnSheet(); return; }
  if (e.target.closest("[data-txn-mas]")) { chooseTxnCategory(); return; }
  if (e.target.closest("#txn-sheet-delete")) { deleteTxnFromSheet(); return; }
  if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) closeTxnSheet();
});

document.getElementById("txn-sheet-note").addEventListener("focus", () => {
  if (txnSheet && txnSheet.keypad) { txnSheet.keypad = false; renderTxnSheet(); }
});
document.getElementById("txn-sheet-note").addEventListener("input", e => {
  if (txnSheet) txnSheet.desc = e.target.value;
});
// Safari en iPhone avisa el cambio de fecha con "input" (y a veces recién
// al cerrar el selector con "change"), así que escuchamos los dos.
function applyTxnDateInput(value) {
  if (!txnSheet || !/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return;
  const today = isoDate(new Date());
  const next = value > today ? today : value;
  if (next === txnSheet.date) return;
  txnSheet.date = next;
  if (!txnSheet.rateTouched) txnSheet.rate = "";
  renderTxnSheet();
}
["input", "change", "blur"].forEach(evt =>
  document.getElementById("txn-sheet-date-input").addEventListener(evt, e => applyTxnDateInput(e.target.value))
);
document.getElementById("txn-sheet-amount-to").addEventListener("input", e => {
  if (!txnSheet) return;
  txnSheet.amountTo = e.target.value;
  const amount = montoTxn(txnSheet) || 0, to = parseNum(e.target.value);
  if (amount > 0 && to > 0) {
    const toUsd = walletCurrency(txnSheet.to) === "US$";
    txnSheet.rate = fmtRate(toUsd ? amount / to : to / amount).replace(/\./g, "");
    txnSheet.rateTouched = true;
    document.getElementById("txn-sheet-rate").value = txnSheet.rate;
  }
});
document.getElementById("txn-sheet-rate").addEventListener("input", e => {
  if (!txnSheet) return;
  txnSheet.rate = e.target.value;
  txnSheet.rateTouched = true;
  syncTransferAmounts();
  document.getElementById("txn-sheet-amount-to").value = txnSheet.amountTo;
});
document.getElementById("txn-sheet-rate").addEventListener("focus", () => {
  if (txnSheet && txnSheet.keypad) { txnSheet.keypad = false; renderTxnSheet(); }
});
document.getElementById("txn-sheet-amount-to").addEventListener("focus", () => {
  if (txnSheet && txnSheet.keypad) { txnSheet.keypad = false; renderTxnSheet(); }
});
document.getElementById("txn-sheet-excluded").addEventListener("change", e => {
  if (txnSheet) txnSheet.excluded = e.target.checked;
});
document.getElementById("txn-sheet-repetir").addEventListener("change", e => {
  if (txnSheet) txnSheet.repetir = e.target.value || null;
});
document.getElementById("txn-sheet-factura").addEventListener("change", e => {
  if (txnSheet) txnSheet.factura = e.target.checked;
});

document.getElementById("budget-month-prev").addEventListener("click", () => cambiarPeriodo(-1));
document.getElementById("budget-month-next").addEventListener("click", () => cambiarPeriodo(1));

// ================= Presupuesto =================

function computeSpentByCategory(period) {
  const spent = {};
  gastoCategoriesCache.forEach(c => { spent[c.id] = 0; });
  financeCache
    .filter(m => m.type === "gasto" && !m.excluded && isInPeriod(m.date, period))
    .forEach(m => { spent[m.category] = (spent[m.category] || 0) + m.montoCent; });
  Object.keys(spent).forEach(k => { spent[k] = FD.aBs(spent[k]); });
  return spent;
}

function progressRing(pct, color) {
  const size = 84, strokeWidth = 7;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(pct, 0), 1));
  return `<svg viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:#0c0c0c" stroke-width="${strokeWidth}"/>
    ${pct > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color}" stroke-width="${strokeWidth}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ""}
    <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${strokeWidth}" style="stroke:${color}" stroke-width="1.5"/>
  </svg>`;
}

function donutChart(segments) {
  const size = 120, innerRadius = 35, outerRadius = 55;
  let paths = [];
  let startAngle = -Math.PI / 2;

  segments.forEach(seg => {
    let angle = seg.percentage * 2 * Math.PI;
    let currentAngle = startAngle;

    // Handle full circle case (100%) by splitting into two arcs
    if (angle > Math.PI * 1.999) {
      angle = Math.PI * 1.99; // Slightly less than full circle
    }

    const endAngle = currentAngle + angle;

    const x1 = size / 2 + outerRadius * Math.cos(currentAngle);
    const y1 = size / 2 + outerRadius * Math.sin(currentAngle);
    const x2 = size / 2 + outerRadius * Math.cos(endAngle);
    const y2 = size / 2 + outerRadius * Math.sin(endAngle);

    const ix1 = size / 2 + innerRadius * Math.cos(currentAngle);
    const iy1 = size / 2 + innerRadius * Math.sin(currentAngle);
    const ix2 = size / 2 + innerRadius * Math.cos(endAngle);
    const iy2 = size / 2 + innerRadius * Math.sin(endAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;

    paths.push(`<path d="${path}" style="fill:${seg.color}; stroke:var(--surface); stroke-width:1.5"/>`);
    startAngle = endAngle;
  });

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${paths.join("")}
  </svg>`;
}

function updateBudgetMonthLabel() {
  document.getElementById("budget-month-label").textContent = periodLabel(currentBudgetPeriod());
  document.getElementById("budget-month-next").disabled = monthOffset >= 0;
}

// ---- Restante (como Buddy): indicador grande + anillos por categoría ----
function computeReceivedByCategory(period) {
  const received = {};
  financeCache
    .filter(m => m.type === "ingreso" && !m.excluded && isInPeriod(m.date, period))
    .forEach(m => { received[m.category] = (received[m.category] || 0) + m.montoCent; });
  Object.keys(received).forEach(k => { received[k] = FD.aBs(received[k]); });
  return received;
}

// Todo lo que entra en el periodo: cada ingreso cuenta lo recibido, o lo
// planeado mientras todavía no llegó (el sueldo antes del depósito). Los
// ingresos extra o sin presupuesto suman completos.
function incomeBase(period) {
  const received = computeReceivedByCategory(period);
  const ids = new Set((CATEGORIES.ingreso || []).map(c => c.id).concat(Object.keys(received)));
  let total = 0;
  ids.forEach(id => { total += Math.max(budgetsCache[id] || 0, received[id] || 0); });
  return total;
}

// Qué parte del periodo ya pasó (0 a 1), contando hoy.
function periodElapsed(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < period.start) return 0;
  if (today > period.end) return 1;
  const total = Math.round((period.end - period.start) / 86400000) + 1;
  return (Math.round((today - period.start) / 86400000) + 1) / total;
}

function remainingGauge(pct) {
  const size = 220, stroke = 10, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r, arc = c * 0.75;
  const fill = arc * Math.min(Math.max(pct, 0), 1);
  const circle = (len, color) => `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${len} ${c}" transform="rotate(135 ${size / 2} ${size / 2})"/>`;
  return `<svg viewBox="0 0 ${size} ${size}">${circle(arc, "rgba(255,255,255,0.12)")}${fill > 0 ? circle(fill, "var(--accent-1)") : ""}</svg>`;
}

function remainingText(remaining) {
  return remaining >= 0
    ? `${formatBsShort(remaining)} restante`
    : `${formatBsShort(-remaining)} sobrepasado`;
}

// Ingresos: se llenan en vez de gastarse → "Bs 3.000 / Bs 5.000".
function incomeProgressHTML(received, goal) {
  if (goal <= 0) return `${formatBsShort(received)} <span class="remain-goal">recibido</span>`;
  return `${formatBsShort(received)}<span class="remain-goal"> / ${formatBsShort(goal)}</span>`;
}

// Estado de una categoría de gasto: "over" si se pasó, "warn" desde el 80 %.
const BUDGET_WARN = 0.8;
const WARN_COLOR = "#f0a847";
// También avisa si vas rápido: gastaste bastante más que la parte del
// periodo que ya pasó (ej. 70 % gastado cuando pasó el 40 % del mes).
const PACE_MARGIN = 0.2, PACE_MIN = 0.3;
function isFastPace(planned, used, elapsed) {
  const pct = used / planned;
  return elapsed < 1 && pct >= PACE_MIN && pct - elapsed >= PACE_MARGIN;
}
function budgetState(planned, used, type, elapsed = periodElapsed(currentBudgetPeriod())) {
  if (type !== "gasto" || planned <= 0) return "ok"; // sin presupuesto: solo se muestra lo gastado
  if (used > planned) return "over";
  if (used / planned >= BUDGET_WARN || isFastPace(planned, used, elapsed)) return "warn";
  return "ok";
}

// Más urgente primero: pasadas, en alerta y luego por % usado. Las que no
// tienen movimientos quedan en su orden original.
const STATE_RANK = { over: 2, warn: 1, ok: 0 };
function byUrgency(a, b) {
  const pct = r => r.planned > 0 ? r.used / r.planned : 0; // sin presupuesto: al final
  return STATE_RANK[budgetState(b.planned, b.used, "gasto")] - STATE_RANK[budgetState(a.planned, a.used, "gasto")]
    || pct(b) - pct(a);
}

function remainingCatHTML(c, planned, used, type) {
  const remaining = planned - used;
  const state = budgetState(planned, used, type);
  const over = state === "over";
  const pct = planned > 0 ? used / planned : (used > 0 ? 1 : 0);
  const iconHTML = c.emoji ? `<span class="remain-emoji">${c.emoji}</span>` : `<span class="remain-icon" data-icon="${c.icon}"></span>`;
  const done = type === "ingreso" && planned > 0 && used >= planned;
  const amountHTML = type === "ingreso"
    ? `<div class="remain-amount income${done ? " done" : ""}">${incomeProgressHTML(used, planned)}</div>`
    : planned <= 0
      ? `<div class="remain-amount">${formatBsShort(used)} gastado</div>`
      : `<div class="remain-amount${over ? " over" : state === "warn" ? " warn" : ""}">${remainingText(remaining)}</div>`;
  return `
    <button type="button" class="remain-cat" data-cat-detail="${c.id}" data-cat-type="${type}">
      <div class="remain-ring">
        ${progressRing(pct, over ? "var(--danger)" : state === "warn" ? WARN_COLOR : c.color)}
        <span class="remain-ring-core" style="background:${c.color}">${iconHTML}</span>
      </div>
      <div class="remain-label">${escapeHtml(c.label)}</div>
      ${amountHTML}
    </button>
  `;
}

function remainingSectionHTML(title, rows, type) {
  const remaining = rows.reduce((s, r) => s + r.planned - r.used, 0);
  const received = rows.reduce((s, r) => s + r.used, 0);
  const goal = rows.reduce((s, r) => s + r.planned, 0);
  const headAmount = type === "ingreso"
    ? `<span class="remain-section-amount income${goal > 0 && received >= goal ? " done" : ""}">${incomeProgressHTML(received, goal)}</span>`
    : goal <= 0
      ? `<span class="remain-section-amount">${formatBsShort(received)} gastado</span>`
      : `<span class="remain-section-amount${remaining < 0 ? " over" : ""}">${remainingText(remaining)}</span>`;
  return `
    <div class="budget-section remain-section">
      <div class="remain-section-head">
        <h3 class="budget-section-title">${escapeHtml(title)}</h3>
        ${headAmount}
      </div>
      <div class="remain-grid">${rows.map(r => remainingCatHTML(r.cat, r.planned, r.used, type)).join("")}</div>
    </div>
  `;
}

function renderBudgets() {
  const period = currentBudgetPeriod();
  const spent = computeSpentByCategory(period);
  const received = computeReceivedByCategory(period);
  const relevant = (c, used) => isPlanned(c.id) || used > 0;

  const ingresoRows = (CATEGORIES.ingreso || [])
    .map(c => ({ cat: c, planned: budgetsCache[c.id] || 0, used: received[c.id] || 0 }))
    .filter(r => relevant(r.cat, r.used));

  // Solo las categorías con presupuesto; lo gastado fuera de presupuesto
  // va aparte, en "Gasto sin presupuesto".
  const groupSections = categoryGroupsCache
    .map(g => ({
      title: g.nombre,
      rows: groupCategories(g)
        .filter(c => isPlanned(c.id))
        .map(c => ({ cat: c, planned: disponible(c.id), used: spent[c.id] || 0 }))
        .sort(byUrgency)
    }))
    .filter(sec => sec.rows.length)
    .sort((a, b) => STATE_RANK[budgetState(b.rows[0].planned, b.rows[0].used, "gasto")]
      - STATE_RANK[budgetState(a.rows[0].planned, a.rows[0].used, "gasto")]);

  // Restante para gastar = todo lo que entra − todo lo gastado (con o sin
  // presupuesto).
  const totalIncome = incomeBase(period);
  const totalBudget = groupSections.reduce((s, sec) => s + sec.rows.reduce((t, r) => t + r.planned, 0), 0);
  const totalSpent = Object.values(spent).reduce((s, v) => s + v, 0);
  const base = totalIncome > 0 ? totalIncome : totalBudget;
  const leftToSpend = base - totalSpent;

  document.getElementById("budget-remaining-hero").innerHTML = `
    <div class="remain-gauge">
      ${remainingGauge(base > 0 ? Math.max(leftToSpend, 0) / base : 0)}
      <div class="remain-gauge-center">
        <span class="remain-gauge-icon" data-icon="home"></span>
        <span class="remain-gauge-value${leftToSpend < 0 ? " over" : ""}">${formatBsShort(Math.abs(leftToSpend))}</span>
        <span class="remain-gauge-label">${leftToSpend < 0 ? "Sobrepasado" : "Restante para gastar"}</span>
      </div>
    </div>
    ${dailyAllowanceHTML(period)}
  `;

  const list = document.getElementById("budget-grid");
  const sectionsHTML = (ingresoRows.length ? [remainingSectionHTML("Ingresos", ingresoRows, "ingreso")] : [])
    .concat(presSeccionHTML("Gastos", groupSections.flatMap(sec => sec.rows).sort(presOrden(period)), period))
    .concat(sinPresupuestoHTML(spent));
  list.innerHTML = sectionsHTML.filter(Boolean).length
    ? sectionsHTML.join("")
    : `<p class="remain-empty">Todavía no hay presupuesto para este mes. Agrégalo en Planificación.</p>`;

  renderIcons(document.getElementById("budget-tab-restante"));
  if (catDetail) renderCategoryDetail();
}

// ---- Tarjetas por categoría: barra con marca de ritmo y estado ----
const bsCent = c => formatBsShort(FD.aBs(c));
// Nombre de la sección, solo si aporta (si es distinto del de la categoría).
function grupoDe(cat) {
  const g = categoryGroupsCache.find(gr => (gr.items || []).some(i => i.id === cat.id));
  return g && g.nombre !== cat.label && (g.items || []).length > 1 ? g.nombre : "";
}
// Fijos y ahorro (alquiler, suscripciones, apartar plata) se pagan de una
// vez: no tienen ritmo; solo importa si ya se pagó o si te pasaste.
function presInfo(r, period) {
  const trans = periodElapsed(period);
  const pc = FD.aCentavos(r.planned), uc = FD.aCentavos(r.used);
  const fijo = r.cat.tipo === "fijo" || r.cat.tipo === "ahorro";
  const e = FP.estado(pc, uc, fijo ? 1 : trans, daysLeftInPeriod(period));
  if (fijo && e.estado !== "pasado" && e.estado !== "vacio" && e.estado !== "sin") e.estado = "bien";
  return { trans, enCurso: trans > 0 && trans < 1, pc, uc, fijo, e };
}
const PRES_URGENCIA = { pasado: 3, alerta: 2, rapido: 1, bien: 0, sin: 0, vacio: -1 };
function presOrden(period) {
  return (a, b) => {
    const x = presInfo(a, period), y = presInfo(b, period);
    return PRES_URGENCIA[y.e.estado] - PRES_URGENCIA[x.e.estado] || (x.fijo - y.fijo) || y.e.pct - x.e.pct;
  };
}
function presCardHTML(r, period) {
  const { trans, enCurso, pc, uc, fijo, e } = presInfo(r, period);
  const pct = Math.round(e.pct * 100);
  const etiqueta = fijo && e.estado === "bien"
    ? (uc >= pc ? (r.cat.tipo === "ahorro" ? "Apartado" : "Pagado") : uc > 0 ? `${pct} % pagado` : "Pendiente")
    : { bien: "Vas bien", rapido: "Vas rápido", alerta: `Usaste el ${pct} %`, pasado: `Te pasaste ${bsCent(-e.queda)}`, vacio: "Sin monto", sin: "Sin monto" }[e.estado];
  const esperado = Math.round(trans * 100);
  const arr = arrastreCache[r.cat.id];
  const nota = arr ? `<span class="pres-nota">${arr > 0 ? `Incluye ${bsCent(arr)} que sobró antes` : `Descuenta ${bsCent(-arr)} que te pasaste antes`}</span>` : "";
  const porDia = enCurso && !fijo && e.queda > 0 && e.porDia >= 100 ? ` · ${formatBsShort(Math.floor(e.porDia / 100))}/día` : "";
  return `
    <button type="button" class="pres-card is-${e.estado}" data-cat-detail="${escapeHtml(r.cat.id)}" data-cat-type="gasto">
      <span class="pres-card-top">
        ${txnIconHTML(r.cat)}
        <span class="pres-card-nom"><span>${escapeHtml(r.cat.label)}</span><small class="pres-card-estado">${etiqueta}${grupoDe(r.cat) ? ` · ${escapeHtml(grupoDe(r.cat))}` : ""}</small></span>
        <span class="pres-card-queda an-num">${e.queda >= 0 ? bsCent(e.queda) : `−${bsCent(-e.queda)}`}<small>${e.queda >= 0 ? "quedan" : "de más"}</small></span>
      </span>
      <span class="pres-bar" role="img" aria-label="Usaste ${pct} % de ${bsCent(pc)}${enCurso && !fijo ? `; a esta altura lo esperado es ${esperado} %` : ""}">
        <span class="pres-bar-fill" style="width:${Math.min(e.pct, 1) * 100}%"></span>
        ${enCurso && !fijo ? `<i class="pres-ritmo" style="left:${esperado}%"></i>` : ""}
      </span>
      <span class="pres-card-pie an-num">${bsCent(uc)} de ${bsCent(pc)}${porDia}</span>
      ${nota}
    </button>`;
}
function presSeccionHTML(title, rows, period) {
  if (!rows.length) return "";
  const queda = rows.reduce((s, r) => s + FD.aCentavos(r.planned) - FD.aCentavos(r.used), 0);
  return `
    <div class="budget-section remain-section pres-seccion">
      <div class="remain-section-head">
        <h3 class="budget-section-title">${escapeHtml(title)}</h3>
        <span class="remain-section-amount${queda < 0 ? " over" : ""}">${queda < 0 ? `${bsCent(-queda)} sobrepasado` : `${bsCent(queda)} restante`}</span>
      </div>
      <div class="pres-lista">${rows.map(r => presCardHTML(r, period)).join("")}</div>
    </div>`;
}
function sinPresupuestoHTML(spent) {
  const ids = Object.keys(spent).filter(id => spent[id] > 0 && !isPlanned(id)).sort((a, b) => spent[b] - spent[a]);
  if (!ids.length) return "";
  const total = ids.reduce((s, id) => s + FD.aCentavos(spent[id]), 0);
  return `
    <div class="budget-section remain-section pres-seccion pres-sin">
      <div class="remain-section-head">
        <h3 class="budget-section-title">Gasto sin presupuesto</h3>
        <span class="remain-section-amount">${bsCent(total)}</span>
      </div>
      <p class="pres-sin-txt">Esto también sale de tu plata, pero no está en ninguna categoría del presupuesto.</p>
      <div class="pres-lista">${ids.map(id => {
        const cat = findCategory("gasto", id);
        const sug = sugerenciaCent(id);
        const enLista = gastoCategoriesCache.some(c => c.id === id);
        return `<div class="pres-sin-fila">
          ${txnIconHTML(cat)}
          <span class="pres-sin-nom"><span>${escapeHtml(cat.label)}</span>${sug ? `<small>Sugerido: ${bsCent(sug)}</small>` : ""}</span>
          <span class="an-num pres-sin-monto">${formatBsShort(spent[id])}</span>
          ${enLista ? `<button type="button" class="pres-sin-btn" data-pres-agregar="${escapeHtml(id)}" aria-label="Agregar presupuesto para ${escapeHtml(cat.label)}"><span data-icon="plus"></span></button>` : ""}
        </div>`;
      }).join("")}</div>
    </div>`;
}
document.getElementById("budget-grid").addEventListener("click", e => {
  const b = e.target.closest("[data-pres-agregar]");
  if (!b) return;
  e.stopPropagation();
  const id = b.dataset.presAgregar;
  const cat = findBudgetCategory("gasto", id);
  if (!cat) return;
  openBudgetSheet({ type: "gasto", groupId: cat.groupId, nuevoCat: id });
}, true);

// ---- Planificación: de dónde viene el presupuesto, copiar y sugerir ----
function mismosMontos(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => k in b && FD.aCentavos(a[k] || 0) === FD.aCentavos(b[k] || 0));
}
function catsEnBs(cats) {
  const out = {};
  Object.keys(cats).forEach(id => { out[id] = FD.aBs(cats[id]); });
  return out;
}
function sugerenciasTodas() {
  const out = {};
  gastoCategoriesCache.forEach(c => { const v = sugerenciaCent(c.id); if (v > 0) out[c.id] = v; });
  return out;
}
function renderPresHerramientas() {
  const el = document.getElementById("pres-herr");
  if (!el) return;
  const period = currentBudgetPeriod();
  const k = claveDe(period);
  const { origen } = FP.delPeriodo(presupuestoDoc, presupuestoBase, k);
  const kPrev = FP.claveMas(k, -1);
  const previo = catsEnBs(FP.delPeriodo(presupuestoDoc, presupuestoBase, kPrev).cats);
  const igual = mismosMontos(previo, budgetsCache);
  const nombrePrev = periodLabel(periodoDeClave(kPrev));
  const sug = sugerenciasTodas();
  const nSug = Object.keys(sug).length;
  const origenTxt = origen === k
    ? `Presupuesto propio de ${periodLabel(period)}.`
    : origen
      ? `Sigue el presupuesto de ${periodLabel(periodoDeClave(origen))}.`
      : "Es tu presupuesto de siempre.";
  el.innerHTML = `
    <p class="pres-origen">${escapeHtml(origenTxt)} ${monthOffset < 0 ? "Si lo cambias, solo cambia este periodo." : "Si lo cambias, vale desde este periodo en adelante; los anteriores no cambian."}</p>
    <div class="pres-herr-btns">
      <button type="button" class="pres-herr-btn" aria-label="${igual ? `Igual a ${escapeHtml(nombrePrev)}` : `Copiar el presupuesto de ${escapeHtml(nombrePrev)}`}" data-pres-copiar${igual || !Object.keys(previo).length ? " disabled" : ""}>
        <span data-icon="copy"></span>${igual ? "Igual al anterior" : "Copiar el anterior"}</button>
      <button type="button" class="pres-herr-btn" data-pres-sugerir${nSug ? "" : " disabled"}>
        <span data-icon="sparkle"></span>Sugerir con 3 meses</button>
    </div>`;
  renderIcons(el);
}
function aplicarPresupuesto(nuevo, texto) {
  const antes = Object.assign({}, budgetsCache);
  budgetsCache = nuevo;
  saveBudgets();
  pedirRender();
  showUndoToast(texto, () => { budgetsCache = antes; saveBudgets(); pedirRender(); });
}
document.getElementById("pres-herr").addEventListener("click", e => {
  const period = currentBudgetPeriod();
  const k = claveDe(period);
  if (e.target.closest("[data-pres-copiar]:not([disabled])")) {
    const kPrev = FP.claveMas(k, -1);
    aplicarPresupuesto(catsEnBs(FP.delPeriodo(presupuestoDoc, presupuestoBase, kPrev).cats), `Presupuesto copiado de ${periodLabel(periodoDeClave(kPrev))}`);
    return;
  }
  if (e.target.closest("[data-pres-sugerir]:not([disabled])")) {
    const sug = sugerenciasTodas();
    const ids = Object.keys(sug);
    const total = ids.reduce((s, id) => s + sug[id], 0);
    appDialog({
      title: "Sugerir presupuesto",
      message: `Según lo que gastaste en tus últimos 3 meses: ${ids.length} ${ids.length === 1 ? "categoría" : "categorías"}, ${bsCent(total)} en total (redondeado a Bs 10). Se reemplazan los montos de esas categorías en ${periodLabel(period)}; las demás no cambian. Puedes deshacerlo.`,
      confirmLabel: "Usar sugerencia"
    }).then(ok => {
      if (!ok) return;
      const nuevo = Object.assign({}, budgetsCache);
      ids.forEach(id => {
        nuevo[id] = FD.aBs(sug[id]);
        const g = categoryGroupsCache.find(gr => (gr.items || []).some(i => i.id === id));
        if (g) visibleBudgetSections.add(g.id);
      });
      aplicarPresupuesto(nuevo, `Sugerencia aplicada a ${ids.length} ${ids.length === 1 ? "categoría" : "categorías"}`);
    });
  }
});

// ---- Avisos al 80 % y al 100 % ----
// Antes de guardar un gasto: ¿con este monto cruza el 80 % o el 100 % de su
// presupuesto (con arrastre) en el periodo de su fecha?
function avisoPresupuesto(t, amount) {
  if (t.type !== "gasto" || t.excluded || !t.category || !t.date) return null;
  const k = claveDeFecha(t.date);
  const cats = FP.delPeriodo(presupuestoDoc, presupuestoBase, k).cats;
  if (!(t.category in cats)) return null;
  const arr = arrastreActivo(t.category) ? FP.arrastreHasta(presupuestoDoc, presupuestoBase, t.category, k, c => gastadoCent(c, t.category)) : 0;
  const pres = (cats[t.category] || 0) + arr;
  let antes = gastadoCent(k, t.category);
  const viejo = t.id ? financeCache.find(m => m.id === t.id) : null;
  if (viejo && viejo.type === "gasto" && !viejo.excluded && viejo.category === t.category && claveDeFecha(viejo.date) === k) antes -= viejo.montoCent || 0;
  const despues = antes + FD.aCentavos(amount);
  const cruce = FP.cruce(pres, antes, despues);
  const cat = findBudgetCategory("gasto", t.category);
  if (!cruce || (cruce === 80 && cat && (cat.tipo === "fijo" || cat.tipo === "ahorro"))) return null;
  const nombre = findCategory("gasto", t.category).label;
  return cruce === 100
    ? `${nombre}: te pasaste del presupuesto por ${bsCent(despues - pres)} (${bsCent(despues)} de ${bsCent(pres)}).`
    : `${nombre}: ya usaste el ${Math.round(despues / pres * 100)} % del presupuesto (${bsCent(despues)} de ${bsCent(pres)}).`;
}

// ---- Detalle de una categoría: sus movimientos del mes ----
let catDetail = null; // { type, catId }

function openCategoryDetail(type, catId) {
  catDetail = { type, catId };
  renderCategoryDetail();
  showSheet(document.getElementById("cat-detail-sheet"));
}

function closeCategoryDetail() {
  hideSheet(document.getElementById("cat-detail-sheet"));
  catDetail = null;
}

function renderCategoryDetail() {
  const { type, catId } = catDetail;
  const period = currentBudgetPeriod();
  const cat = findBudgetCategory(type, catId) || findCategory(type, catId);
  const movements = financeCache
    .filter(m => m.type === type && m.category === catId && !m.excluded && isInPeriod(m.date, period))
    .sort(byNewest);

  const planned = type === "gasto" ? disponible(catId) : budgetsCache[catId] || 0;
  const used = FD.sumaBs(movements, m => m.amount);
  const remaining = planned - used;
  const isIncome = type === "ingreso";
  const over = !isIncome && planned > 0 && remaining < 0;
  const pct = planned > 0 ? used / planned : (used > 0 ? 1 : 0);
  const usedLabel = isIncome ? "Recibido" : "Gastado";
  const fast = !isIncome && !over && planned > 0 && used / planned < BUDGET_WARN && isFastPace(planned, used, periodElapsed(period));
  const headline = isIncome
    ? `<div class="cat-detail-remaining income${planned > 0 && used >= planned ? " done" : ""}">${incomeProgressHTML(used, planned)}</div>`
    : planned <= 0
      ? `<div class="cat-detail-remaining">${formatBsShort(used)} gastado</div>`
      : `<div class="cat-detail-remaining${over ? " over" : budgetState(planned, used, type) === "warn" ? " warn" : ""}">${remainingText(remaining)}</div>
       ${fast ? `<div class="cat-detail-pace">Vas rápido: llevas ${Math.round(used / planned * 100)} % gastado y pasó el ${Math.round(periodElapsed(period) * 100)} % del periodo</div>` : ""}`;

  document.getElementById("cat-detail-title").textContent = cat.label;
  document.getElementById("cat-detail-hero").innerHTML = `
    <div class="remain-ring cat-detail-ring">
      ${progressRing(pct, over ? "var(--danger)" : !isIncome && budgetState(planned, used, type) === "warn" ? WARN_COLOR : cat.color)}
      <span class="remain-ring-core" style="background:${cat.color}">
        ${cat.emoji ? `<span class="remain-emoji">${cat.emoji}</span>` : `<span class="remain-icon" data-icon="${cat.icon}"></span>`}
      </span>
    </div>
    ${headline}
    <div class="cat-detail-month">${periodLabel(period)}</div>
    <div class="cat-detail-stats">
      <div><span>${isIncome ? "Meta" : "Presupuesto"}</span><strong>${planned > 0 ? formatBsShort(planned) : "—"}</strong></div>
      <div><span>${usedLabel}</span><strong>${formatBsShort(used)}</strong></div>
      <div><span>Movimientos</span><strong>${movements.length}</strong></div>
    </div>
  `;

  const list = document.getElementById("cat-detail-list");
  if (!movements.length) {
    list.innerHTML = `<p class="cat-detail-empty">No hay movimientos de ${escapeHtml(cat.label)} en este periodo (${periodLabel(period)}).</p>`;
  } else {
    let lastDate = null;
    list.innerHTML = movements.map(m => {
      let header = "";
      if (m.date !== lastDate) {
        lastDate = m.date;
        const dayLabel = capitalize(new Date(m.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" }));
        header = `<div class="day-header"><span>${dayLabel}</span></div>`;
      }
      const pay = findPayment(m.payment);
      const sign = type === "ingreso" ? "+" : "−";
      return `${header}
        <div class="txn-item">
          <span class="txn-icon" style="background:${cat.color}22; color:${cat.color}" data-icon="${cat.icon}"></span>
          <div class="txn-body">
            <div class="txn-desc">${escapeHtml(m.desc || cat.label)}</div>
            <div class="meta">${pay ? escapeHtml(pay.label) : ""}</div>
          </div>
          <div class="txn-amount ${type === "ingreso" ? "pos" : "neg"}">${sign}${formatMoney(m.amount)}</div>
        </div>`;
    }).join("");
  }
  renderIcons(document.getElementById("cat-detail-sheet"));
}

document.getElementById("budget-grid").addEventListener("click", e => {
  const btn = e.target.closest("[data-cat-detail]");
  if (btn) openCategoryDetail(btn.dataset.catType, btn.dataset.catDetail);
});

document.getElementById("cat-detail-sheet").addEventListener("click", e => {
  if (e.target.closest("#cat-detail-edit")) {
    const { type, catId } = catDetail;
    const cat = findBudgetCategory(type, catId);
    openBudgetSheet({ type, groupId: cat && cat.groupId, catId });
    return;
  }
  if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) closeCategoryDetail();
});

// ---- Planificación: secciones con sus categorías (como Buddy) ----
// Una categoría está "planificada" cuando su id existe en budgetsCache (aunque
// el monto sea 0). Una sección de gasto se muestra si tiene alguna categoría
// planificada o si el usuario la acaba de añadir.
const visibleBudgetSections = new Set();

// ---- Presupuesto por periodo (ver js/finanzas/presupuesto.js) ----
// budgetsCache es el presupuesto del periodo que estás mirando (en Bs, como
// lo usa el resto de la pantalla). Se arma con el presupuesto de siempre
// (meta/presupuestos) y los cambios guardados por periodo.
const FP = FinanzasPresupuesto;
let presupuestoBase = {};  // meta/presupuestos: el de siempre, ya no se escribe
let presupuestoDoc = null; // meta/presupuestos_periodos
let arrastreCache = {};    // id → centavos que pasan de periodos anteriores

function presupuestosPeriodosRef() {
  return metaDocRef("presupuestos_periodos");
}
function claveDe(period) {
  return FP.clave(period.startISO);
}
function claveActual() {
  return claveDe(budgetPeriodAt(0));
}
function periodoDeClave(k) {
  const [y, m] = k.split("-").map(Number);
  const [ya, ma] = claveActual().split("-").map(Number);
  return budgetPeriodAt((y * 12 + m) - (ya * 12 + ma));
}
// Clave del periodo al que pertenece una fecha (según el día de inicio).
function claveDeFecha(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return d >= periodStartIn(y, m - 1).getDate() ? iso.slice(0, 7) : FP.claveMas(iso.slice(0, 7), -1);
}
// Gasto por periodo y categoría, en centavos (se recalcula solo si cambian
// los movimientos o el día de inicio).
let gastoClaveMemo = null;
function gastoPorClave() {
  if (gastoClaveMemo && gastoClaveMemo.lista === financeCache && gastoClaveMemo.dia === budgetStartDay) return gastoClaveMemo.mapa;
  const mapa = {};
  financeCache.forEach(m => {
    if (m.type !== "gasto" || m.excluded || !m.date) return;
    const k = claveDeFecha(m.date);
    const fila = mapa[k] || (mapa[k] = {});
    fila[m.category] = (fila[m.category] || 0) + (m.montoCent || 0);
  });
  gastoClaveMemo = { lista: financeCache, dia: budgetStartDay, mapa };
  return mapa;
}
function gastadoCent(k, id) {
  const fila = gastoPorClave()[k];
  return (fila && fila[id]) || 0;
}
function sincronizarPresupuesto() {
  const k = claveDe(currentBudgetPeriod());
  const { cats } = FP.delPeriodo(presupuestoDoc, presupuestoBase, k);
  const nuevo = {};
  Object.keys(cats).forEach(id => { nuevo[id] = FD.aBs(cats[id]); });
  budgetsCache = nuevo;
  arrastreCache = {};
  const arr = (presupuestoDoc && presupuestoDoc.arrastre) || {};
  Object.keys(arr).forEach(id => {
    if (!(id in nuevo)) return;
    const v = FP.arrastreHasta(presupuestoDoc, presupuestoBase, id, k, c => gastadoCent(c, id));
    if (v) arrastreCache[id] = v;
  });
}
// Lo disponible en una categoría de gasto: su presupuesto más el arrastre.
function disponible(id) {
  return FD.aBs(FD.aCentavos(budgetsCache[id] || 0) + (arrastreCache[id] || 0));
}
function arrastreActivo(id) {
  return !!(presupuestoDoc && presupuestoDoc.arrastre && presupuestoDoc.arrastre[id]);
}
// Sugerencia con los últimos 3 periodos (antes del que miras), en centavos.
function sugerenciaCent(id) {
  const k = claveDe(currentBudgetPeriod());
  return FP.sugerencia([1, 2, 3].map(n => gastadoCent(FP.claveMas(k, -n), id)));
}

function isPlanned(catId) {
  return Object.prototype.hasOwnProperty.call(budgetsCache, catId);
}

function groupColor(group) {
  const gi = categoryGroupsCache.indexOf(group);
  return group.color || CATEGORY_COLOR_POOL[Math.max(gi, 0) % CATEGORY_COLOR_POOL.length];
}

function groupCategories(group) {
  const color = groupColor(group);
  return (group.items || []).map(item => ({ id: item.id, label: item.label, icon: item.icon, emoji: item.emoji, color, tipo: item.tipo || "variable" }));
}

function isSectionVisible(group) {
  return visibleBudgetSections.has(group.id) || (group.items || []).some(i => isPlanned(i.id));
}

function catBadgeHTML(c) {
  return c.emoji
    ? `<span class="cat-emoji" style="background:${c.color}; color:#fff;">${c.emoji}</span>`
    : `<span class="cat-icon" style="background:${c.color}22; color:${c.color}" data-icon="${c.icon}"></span>`;
}

function budgetSectionHTML(title, color, categories, sectionAttr) {
  const planned = categories.filter(c => isPlanned(c.id));
  return `
    <div class="budget-section">
      <h3 class="budget-section-title">${escapeHtml(title)}</h3>
      <div class="budget-section-items">
        ${planned.map(c => `
          <button type="button" class="budget-input-row" data-edit-cat="${c.id}">
            ${catBadgeHTML(c)}
            <span class="budget-input-label">${escapeHtml(c.label)}</span>
            <span class="budget-row-amount">${formatBsShort(budgetsCache[c.id] || 0)}</span>
          </button>
        `).join("")}
        <button type="button" class="budget-add-btn" ${sectionAttr}>
          <span class="budget-add-plus" data-icon="plus"></span>
          Añade una categoría
        </button>
      </div>
    </div>
  `;
}

function renderBudgetInputs() {
  const container = document.getElementById("budget-inputs");
  const ingresoHTML = budgetSectionHTML("Ingresos", null, CATEGORIES.ingreso || [], `data-section-type="ingreso"`);
  const gastoHTML = categoryGroupsCache
    .filter(isSectionVisible)
    .map(g => budgetSectionHTML(g.nombre, groupColor(g), groupCategories(g), `data-group-id="${g.id}"`))
    .join("");

  container.innerHTML = `
    ${ingresoHTML}
    ${gastoHTML}
    <button type="button" class="budget-add-section-btn">
      <span data-icon="plus"></span>
      Añadir sección
    </button>
  `;
  renderIcons(container);
}

function formatBsShort(n) {
  return `Bs ${n.toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
}

const BUDGET_FREE_COLOR = "#e8e6e1";

function renderBudgetSummary() {
  // El círculo completo son los ingresos planeados; cada sección de gastos
  // ocupa su parte y lo que queda libre se ve claro, como en Buddy.
  const totalIncome = (CATEGORIES.ingreso || []).reduce((s, c) => s + (budgetsCache[c.id] || 0), 0);
  const sections = categoryGroupsCache
    .map(g => ({
      label: g.nombre,
      color: groupColor(g),
      amount: (g.items || []).reduce((s, i) => s + (budgetsCache[i.id] || 0), 0)
    }))
    .filter(sec => sec.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const totalBudget = sections.reduce((s, sec) => s + sec.amount, 0);
  const remaining = totalIncome - totalBudget;

  document.getElementById("budget-summary-value").textContent = formatBsShort(totalBudget);

  const sub = document.getElementById("budget-summary-sub");
  sub.classList.toggle("over", remaining < 0);
  if (totalIncome === 0 && totalBudget === 0) {
    sub.textContent = "Agrega tus ingresos y gastos abajo para empezar";
  } else if (remaining >= 0) {
    sub.innerHTML = `<strong>${formatBsShort(remaining)}</strong> restante en el presupuesto`;
  } else {
    sub.innerHTML = `<strong>${formatBsShort(-remaining)}</strong> por encima de tus ingresos`;
  }

  const base = Math.max(totalIncome, totalBudget);
  const segments = base > 0
    ? sections.map(sec => ({ color: sec.color, percentage: sec.amount / base }))
    : [];
  if (remaining > 0) segments.push({ color: BUDGET_FREE_COLOR, percentage: remaining / base });
  if (!segments.length) segments.push({ color: "#4a4944", percentage: 1 });
  document.getElementById("budget-summary-ring").innerHTML = donutChart(segments);

  const pct = amount => totalIncome > 0 ? `${Math.round(amount / totalIncome * 100)}%` : "";
  document.getElementById("budget-breakdown").innerHTML = sections.map(sec => `
    <div class="breakdown-item">
      <span class="swatch" style="background:${sec.color}"></span>
      <span class="breakdown-name">${escapeHtml(sec.label)}</span>
      <span class="breakdown-pct">${pct(sec.amount)}</span>
      <span class="breakdown-leader"></span>
      <span class="breakdown-amount">${formatBsShort(sec.amount)}</span>
    </div>
  `).join("");
}

// ---- Información (como Buddy): presupuesto diario, desglose y proyección ----
const BUDGET_TIPOS = [
  { id: "ahorro", label: "Ahorros", color: "#e8c9a0" },
  { id: "fijo", label: "Gastos fijos", color: "#f0a847" },
  { id: "variable", label: "Gastos variables", color: "#7fb0f0" }
];
let projectionOpen = true;

function computeBudgetInfo(period) {
  const spent = computeSpentByCategory(period);
  const received = computeReceivedByCategory(period);
  const info = {
    ingreso: { planned: 0, used: 0 },
    ahorro: { planned: 0, used: 0 },
    fijo: { planned: 0, used: 0 },
    variable: { planned: 0, used: 0 },
    otros: { planned: 0, used: 0 }
  };
  (CATEGORIES.ingreso || []).forEach(c => {
    info.ingreso.planned += budgetsCache[c.id] || 0;
    info.ingreso.used += received[c.id] || 0;
  });
  const counted = new Set();
  categoryGroupsCache.forEach(g => groupCategories(g).forEach(c => {
    counted.add(c.id);
    const bucket = isPlanned(c.id) ? info[c.tipo] || info.variable : info.otros;
    bucket.planned += budgetsCache[c.id] || 0;
    bucket.used += spent[c.id] || 0;
  }));
  // Gastos en categorías que no están en ninguna sección.
  Object.keys(spent).forEach(id => { if (!counted.has(id)) info.otros.used += spent[id]; });
  return info;
}

// Proyección: todo lo que entra − ahorros − gastos fijos (lo presupuestado,
// o lo gastado si ya se pasó) − gastos variables y otros (solo lo gastado).
// Lo que sobra, dividido entre los días que quedan, es lo diario.
function budgetProjection(period) {
  const info = computeBudgetInfo(period);
  const days = daysLeftInPeriod(period);
  const lines = [
    { label: "Ingresos", value: incomeBase(period), sign: 1 },
    { label: "Ahorros", value: Math.max(info.ahorro.planned, info.ahorro.used), sign: -1 },
    { label: "Gastos fijos", value: Math.max(info.fijo.planned, info.fijo.used), sign: -1 },
    { label: "Gastos variables", value: info.variable.used, sign: -1 },
    { label: "Otros gastos", value: info.otros.used, sign: -1 }
  ];
  const result = lines.reduce((s, l) => s + l.sign * l.value, 0);
  const daily = days > 0 ? Math.max(result, 0) / days : 0;
  return { info, days, lines, result, daily };
}

function dailyAllowanceHTML(period) {
  const { days, daily, result } = budgetProjection(period);
  if (days <= 0) return "";
  const left = `quedan ${days} día${days === 1 ? "" : "s"}`;
  if (result <= 0) return `<div class="remain-daily over"><strong>Sin margen para gastar</strong> · ${left}</div>`;
  return `<div class="remain-daily">Puedes gastar <strong>${formatBsShort(Math.round(daily))}</strong> por día · ${left}</div>`;
}

function renderBudgetInfo() {
  const period = currentBudgetPeriod();
  const { info, days, lines, result, daily } = budgetProjection(period);

  const breakdownRows = [
    { label: "Ingresos", color: "#5cc98a", ...info.ingreso },
    ...BUDGET_TIPOS.map(t => ({ label: t.label, color: t.color, ...info[t.id] })),
    { label: "Otros gastos", color: "#6b6a66", ...info.otros }
  ];

  const dailyHTML = days > 0
    ? `<p class="info-sub">Quedan <strong>${days} día${days === 1 ? "" : "s"}</strong> en este periodo.</p>
       <div class="info-highlight">
         <span class="info-cal"><span class="info-cal-top"></span><span class="info-cal-num">${days}</span></span>
         <div>
           <div class="info-highlight-value${result < 0 ? " over" : ""}">${formatBsShort(Math.round(daily))}</div>
           <div class="info-highlight-label">Restante para gastar al día</div>
         </div>
       </div>`
    : `<p class="info-sub">Este periodo ya terminó.</p>`;

  document.getElementById("budget-info").innerHTML = `
    <div class="budget-section info-card">
      <h3 class="budget-section-title">Presupuesto diario</h3>
      ${dailyHTML}
    </div>

    <div class="budget-section info-card">
      <h3 class="budget-section-title">Desglose del presupuesto</h3>
      <p class="info-sub">Un resumen del progreso de tu presupuesto hasta ahora durante este periodo.</p>
      <div class="info-breakdown">
        ${breakdownRows.map(r => `
          <div class="info-breakdown-row">
            <span class="swatch" style="background:${r.color}"></span>
            <span class="info-breakdown-label">${r.label}</span>
            <span class="info-breakdown-value">${r.planned > 0
              ? `<span class="muted">${formatBsShort(r.used)} /</span> ${formatBsShort(r.planned)}`
              : formatBsShort(r.used)}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="budget-section info-card">
      <h3 class="budget-section-title">Proyección</h3>
      <p class="info-sub">Un resultado estimado para este periodo de presupuesto.</p>
      <div class="info-highlight info-projection${projectionOpen ? " open" : ""}">
        <button type="button" class="info-projection-head" id="info-projection-toggle" aria-expanded="${projectionOpen}">
          <span class="info-projection-icon" data-icon="finance"></span>
          <span class="info-highlight-value${result < 0 ? " over" : ""}">${result < 0 ? "−" : ""}${formatBsShort(Math.abs(result))}</span>
          <span class="info-chevron" data-icon="chevronRight"></span>
        </button>
        <div class="info-projection-lines">
          ${lines.filter((l, i) => i === 0 || l.value > 0).map(l => `
            <div class="info-line"><span>${l.label}</span><span class="breakdown-leader"></span><span>${l.sign > 0 ? "+" : "−"}${formatBsShort(l.value)}</span></div>
          `).join("")}
          <div class="info-line total"><span>Resultado proyectado</span><span class="breakdown-leader"></span><span>${result < 0 ? "−" : ""}${formatBsShort(Math.abs(result))}</span></div>
        </div>
      </div>
    </div>
  `;
  renderIcons(document.getElementById("budget-info"));
}

document.getElementById("budget-info").addEventListener("click", e => {
  if (!e.target.closest("#info-projection-toggle")) return;
  projectionOpen = !projectionOpen;
  renderBudgetInfo();
});

// Guarda el presupuesto del periodo que estás mirando (en centavos). Vale
// desde ese periodo en adelante; los anteriores no cambian.
function saveBudgets(arrastre) {
  const cats = {};
  Object.keys(budgetsCache).forEach(id => { cats[id] = FD.aCentavos(budgetsCache[id] || 0); });
  const doc = FP.guardar(presupuestoDoc, presupuestoBase, claveDe(currentBudgetPeriod()), cats, claveActual());
  if (arrastre) doc.arrastre = arrastre;
  presupuestoDoc = doc;
  metaCrudo.presupuestos_periodos = doc;
  sincronizarPresupuesto();
  return presupuestosPeriodosRef().set(doc);
}

function uniqueId(base, taken) {
  let id = base || "cat", suffix = 2;
  while (taken(id)) id = `${base}_${suffix++}`;
  return id;
}

// ---- Selector visual (modal) reutilizable para categorías y secciones ----
let pickerState = null; // { onPick(id), onCreate() }

function openPicker({ title, items, createLabel, onPick, onCreate }) {
  pickerState = { onPick, onCreate };
  document.getElementById("category-selector-title").textContent = title;

  const grid = document.getElementById("category-selector-grid");
  grid.innerHTML = items.length
    ? items.map(it => `
        <button type="button" class="category-selector-item" data-pick-id="${it.id}">
          ${it.emoji
            ? `<div class="category-selector-item-icon category-selector-item-emoji" style="background:${it.color}">${it.emoji}</div>`
            : `<div class="category-selector-item-icon" style="color:${it.color}" data-icon="${it.icon}"></div>`}
          <div class="category-selector-item-label">${escapeHtml(it.label)}</div>
          ${it.sub ? `<div class="category-selector-item-sub">${escapeHtml(it.sub)}</div>` : ""}
        </button>
      `).join("")
    : `<p class="category-selector-empty">No hay opciones disponibles. Crea una nueva.</p>`;
  renderIcons(grid);

  const createBtn = document.getElementById("category-selector-new");
  createBtn.hidden = !onCreate;
  document.getElementById("category-selector-new-label").textContent = createLabel || "";

  showSheet(document.getElementById("category-selector-modal"));
}

function closePicker() {
  hideSheet(document.getElementById("category-selector-modal"));
  pickerState = null;
}

// ---- Hoja "Gasto de presupuesto" con teclado numérico (como Buddy) ----
let budgetSheet = null; // { type, groupId, catId, originalCatId, amount: "1234,5" }

function findBudgetCategory(type, catId) {
  if (!catId) return null;
  if (type === "ingreso") {
    const c = (CATEGORIES.ingreso || []).find(c => c.id === catId);
    return c ? Object.assign({ groupId: null }, c) : null;
  }
  for (const g of categoryGroupsCache) {
    const c = groupCategories(g).find(c => c.id === catId);
    if (c) return Object.assign({ groupId: g.id }, c);
  }
  return null;
}

function sheetCandidates() {
  const s = budgetSheet;
  const free = c => !isPlanned(c.id) || c.id === s.originalCatId;
  if (s.type === "ingreso") return (CATEGORIES.ingreso || []).filter(free);
  const groups = s.groupId ? categoryGroupsCache.filter(g => g.id === s.groupId) : categoryGroupsCache;
  return groups.flatMap(groupCategories).filter(free);
}

function formatSheetAmount(str) {
  const [int, dec] = str.split(",");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec === undefined ? grouped : `${grouped},${dec}`;
}

function openBudgetSheet({ type, groupId = null, catId = null, nuevoCat = null }) {
  const amount = catId && budgetsCache[catId] ? String(budgetsCache[catId]).replace(".", ",") : "0";
  budgetSheet = { type, groupId, catId, originalCatId: catId, amount, tipo: null, arrastre: null };
  if (!catId) {
    const first = nuevoCat ? { id: nuevoCat } : sheetCandidates()[0];
    budgetSheet.catId = first ? first.id : null;
  }
  renderBudgetSheet();
  showSheet(document.getElementById("budget-sheet"));
}

function closeBudgetSheet() {
  hideSheet(document.getElementById("budget-sheet"));
  budgetSheet = null;
}

function renderBudgetSheet() {
  const s = budgetSheet;
  document.getElementById("budget-sheet-title").textContent = s.type === "ingreso" ? "Ingreso de presupuesto" : "Gasto de presupuesto";
  document.getElementById("budget-sheet-amount").textContent = formatSheetAmount(s.amount);
  document.querySelectorAll("#budget-sheet [data-sheet-type]").forEach(b => {
    b.classList.toggle("active", b.dataset.sheetType === s.type);
  });

  const cat = findBudgetCategory(s.type, s.catId);
  const badge = document.getElementById("budget-sheet-cat-badge");
  if (cat) {
    badge.outerHTML = catBadgeHTML(cat).replace(/^<span /, '<span id="budget-sheet-cat-badge" ');
  } else {
    badge.outerHTML = `<span id="budget-sheet-cat-badge" class="cat-icon" data-icon="otherCategory"></span>`;
  }
  document.getElementById("budget-sheet-cat-label").textContent = cat ? cat.label : "Elige una";
  const tipo = sheetTipo(cat);
  document.getElementById("budget-sheet-tipo").hidden = s.type !== "gasto";
  document.querySelectorAll("#budget-sheet [data-tipo]").forEach(b => b.classList.toggle("active", b.dataset.tipo === tipo));
  document.getElementById("budget-sheet-delete").hidden = !s.originalCatId;
  document.getElementById("budget-sheet-ok").disabled = !cat;
  // Sugerencia de 3 meses, arrastre y a qué periodos se aplica.
  const esGasto = s.type === "gasto" && !!cat;
  const sug = esGasto ? sugerenciaCent(cat.id) : 0;
  const sugBtn = document.getElementById("budget-sheet-sug");
  sugBtn.hidden = !sug;
  if (sug) sugBtn.innerHTML = `Usar <strong>${bsCent(sug)}</strong> · tu promedio de los últimos 3 meses`;
  document.getElementById("budget-sheet-arrastre-fila").hidden = !esGasto;
  document.getElementById("budget-sheet-arrastre").checked = s.arrastre != null ? s.arrastre : !!(cat && arrastreActivo(cat.id));
  const period = currentBudgetPeriod();
  document.getElementById("budget-sheet-alcance").textContent = monthOffset < 0
    ? `Cambia solo ${periodLabel(period)}; los demás periodos quedan como están.`
    : `Se aplica desde ${periodLabel(period)} en adelante. Los periodos anteriores no cambian.`;
  renderIcons(document.getElementById("budget-sheet"));
}

function sheetTipo(cat) {
  return budgetSheet.tipo || (cat && cat.tipo) || "variable";
}

function chooseSheetCategory() {
  const s = budgetSheet;
  const group = s.groupId ? categoryGroupsCache.find(g => g.id === s.groupId) : null;
  const pick = catId => { closePicker(); s.catId = catId; s.tipo = null; renderBudgetSheet(); };
  openPicker({
    title: s.type === "ingreso" ? "Elige un ingreso" : (group ? `Elige en ${group.nombre}` : "Elige una categoría"),
    items: sheetCandidates(),
    createLabel: "Crear nueva categoría",
    onPick: pick,
    onCreate: s.type === "ingreso" || !group ? null : async () => {
      const name = await appDialog({ title: "Nueva categoría", input: "", confirmLabel: "Crear" });
      if (!name) return;
      const id = uniqueId(slugify(name), id => gastoCategoriesCache.some(c => c.id === id) || isPlanned(id));
      const next = categoryGroupsCache.map(g =>
        g.id === group.id ? Object.assign({}, g, { items: (g.items || []).concat([{ id, label: name, icon: "otherCategory" }]) }) : g
      );
      categoryGroupsCache = next;
      saveCategoryGroups(next);
      pick(id);
    }
  });
}

// Aplica una tecla del teclado numérico a un monto escrito como "1234,5".
function applyAmountKey(amount, key) {
  if (key === "back") return amount.slice(0, -1) || "0";
  if (key === ",") return amount.includes(",") ? amount : amount + ",";
  if (/^\d$/.test(key)) {
    const dec = amount.split(",")[1];
    if (dec !== undefined && dec.length >= 2) return amount;
    if (amount.replace(",", "").length >= 10) return amount;
    return amount === "0" ? key : amount + key;
  }
  return amount;
}

function pressSheetKey(key) {
  budgetSheet.amount = applyAmountKey(budgetSheet.amount, key);
  document.getElementById("budget-sheet-amount").textContent = formatSheetAmount(budgetSheet.amount);
}

function confirmBudgetSheet() {
  const s = budgetSheet;
  const cat = findBudgetCategory(s.type, s.catId);
  if (!cat) return;
  const amount = parseFloat(s.amount.replace(",", ".")) || 0;
  if (s.originalCatId && s.originalCatId !== cat.id) delete budgetsCache[s.originalCatId];
  budgetsCache[cat.id] = amount;
  // Arrastre: se activa desde el periodo que miras.
  let arrastre = null;
  if (s.type === "gasto" && s.arrastre != null && s.arrastre !== arrastreActivo(cat.id)) {
    arrastre = Object.assign({}, (presupuestoDoc && presupuestoDoc.arrastre) || {});
    if (s.arrastre) arrastre[cat.id] = claveDe(currentBudgetPeriod());
    else delete arrastre[cat.id];
  }
  if (cat.groupId) {
    visibleBudgetSections.add(cat.groupId);
    const tipo = sheetTipo(cat);
    if (tipo !== (cat.tipo || "variable")) {
      const next = categoryGroupsCache.map(g => g.id !== cat.groupId ? g : Object.assign({}, g, {
        items: g.items.map(i => i.id === cat.id ? Object.assign({}, i, { tipo }) : i)
      }));
      categoryGroupsCache = next;
      saveCategoryGroups(next);
    }
  }
  closeBudgetSheet();
  renderBudgetInputs();
  renderBudgetSummary();
  saveBudgets(arrastre);
  pedirRender();
}

// Al quitar la última categoría de una sección, la sección sale del presupuesto.
async function deleteBudgetFromSheet() {
  const s = budgetSheet;
  if (!s.originalCatId) return;
  const cat = findBudgetCategory(s.type, s.originalCatId);
  const group = cat && cat.groupId ? categoryGroupsCache.find(g => g.id === cat.groupId) : null;
  const isLast = group && (group.items || []).filter(i => isPlanned(i.id)).length === 1;
  if (isLast) {
    const ok = await appDialog({ title: `¿Eliminar "${cat.label}"?`, message: `Es la última categoría de ${group.nombre}, así que la sección también se quita del presupuesto. Tus movimientos no se borran.`, confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
  }

  delete budgetsCache[s.originalCatId];
  if (isLast) visibleBudgetSections.delete(group.id);
  closeBudgetSheet();
  renderBudgetInputs();
  renderBudgetSummary();
  saveBudgets();
  pedirRender();
}

document.getElementById("budget-sheet-arrastre").addEventListener("change", e => {
  if (budgetSheet) budgetSheet.arrastre = e.target.checked;
});
document.getElementById("budget-sheet").addEventListener("click", e => {
  if (!budgetSheet) return;
  const key = e.target.closest("[data-key]");
  if (key) { pressSheetKey(key.dataset.key); return; }
  const tipoBtn = e.target.closest("[data-tipo]");
  if (tipoBtn) { budgetSheet.tipo = tipoBtn.dataset.tipo; renderBudgetSheet(); return; }
  if (e.target.closest("#budget-sheet-sug")) {
    const cent = sugerenciaCent(budgetSheet.catId);
    if (cent) { budgetSheet.amount = String(FD.aBs(cent)).replace(".", ","); renderBudgetSheet(); }
    return;
  }
  const typeBtn = e.target.closest("[data-sheet-type]");
  if (typeBtn) {
    if (typeBtn.dataset.sheetType !== budgetSheet.type) {
      budgetSheet.type = typeBtn.dataset.sheetType;
      budgetSheet.groupId = null;
      budgetSheet.catId = null;
      renderBudgetSheet();
    }
    return;
  }
  if (e.target.closest("#budget-sheet-cat, #budget-sheet-choose")) { chooseSheetCategory(); return; }
  if (e.target.closest("#budget-sheet-ok")) { confirmBudgetSheet(); return; }
  if (e.target.closest("#budget-sheet-delete")) { deleteBudgetFromSheet(); return; }
  if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) closeBudgetSheet();
});

document.addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (isSheetOpen(document.getElementById("category-selector-modal"))) return;
  if (catSheet) {
    if (e.key === "Escape") { closeCatSheet(); e.preventDefault(); }
    return;
  }
  if (txnSheet) {
    if (/^\d$/.test(e.key)) pressTxnKey(e.key);
    else if (e.key === "," || e.key === ".") pressTxnKey(",");
    else if (e.key === "+") pressTxnKey("+");
    else if (e.key === "-") pressTxnKey("−");
    else if (e.key === "=") pressTxnKey("=");
    else if (e.key === "Backspace") pressTxnKey("back");
    else if (e.key === "Enter") saveTxn(false);
    else if (e.key === "Escape") closeTxnSheet();
    else return;
    e.preventDefault();
    return;
  }
  if (!budgetSheet) return;
  if (/^\d$/.test(e.key)) pressSheetKey(e.key);
  else if (e.key === "," || e.key === ".") pressSheetKey(",");
  else if (e.key === "Backspace") pressSheetKey("back");
  else if (e.key === "Enter") confirmBudgetSheet();
  else if (e.key === "Escape") closeBudgetSheet();
  else return;
  e.preventDefault();
});

function openSectionPicker() {
  const hidden = categoryGroupsCache.filter(g => !isSectionVisible(g));
  openPicker({
    title: "Añadir sección",
    items: hidden.map(g => {
      const first = (g.items || [])[0];
      return { id: g.id, label: g.nombre, icon: first ? first.icon : "otherCategory", emoji: first && first.emoji, color: groupColor(g) };
    }),
    createLabel: "Crear nueva sección",
    onPick: groupId => {
      closePicker();
      visibleBudgetSections.add(groupId);
      renderBudgetInputs();
      openBudgetSheet({ type: "gasto", groupId });
    },
    onCreate: async () => {
      const nombre = await appDialog({ title: "Nueva sección", input: "", confirmLabel: "Crear" });
      if (!nombre) return;
      closePicker();
      const id = uniqueId(slugify(nombre), id => categoryGroupsCache.some(g => g.id === id));
      const color = CATEGORY_COLOR_POOL[categoryGroupsCache.length % CATEGORY_COLOR_POOL.length];
      const next = categoryGroupsCache.concat([{ id, nombre, color, items: [] }]);
      visibleBudgetSections.add(id);
      categoryGroupsCache = next;
      saveCategoryGroups(next);
      renderBudgetInputs();
      openBudgetSheet({ type: "gasto", groupId: id });
    }
  });
}

document.getElementById("budget-inputs").addEventListener("click", e => {
  if (e.target.closest(".budget-add-section-btn")) {
    openSectionPicker();
    return;
  }
  const row = e.target.closest("[data-edit-cat]");
  if (row) {
    const catId = row.dataset.editCat;
    const isIngreso = (CATEGORIES.ingreso || []).some(c => c.id === catId);
    const cat = findBudgetCategory(isIngreso ? "ingreso" : "gasto", catId);
    openBudgetSheet({ type: isIngreso ? "ingreso" : "gasto", groupId: cat && cat.groupId, catId });
    return;
  }
  const addBtn = e.target.closest(".budget-add-btn");
  if (!addBtn) return;
  if (addBtn.dataset.sectionType === "ingreso") openBudgetSheet({ type: "ingreso" });
  else openBudgetSheet({ type: "gasto", groupId: addBtn.dataset.groupId });
});

document.getElementById("category-selector-grid").addEventListener("click", e => {
  const item = e.target.closest("[data-pick-id]");
  if (item && pickerState) pickerState.onPick(item.dataset.pickId);
});

document.getElementById("category-selector-new").addEventListener("click", () => {
  if (pickerState && pickerState.onCreate) pickerState.onCreate();
});

document.getElementById("category-selector-cancel").addEventListener("click", closePicker);

document.getElementById("category-selector-modal").addEventListener("click", e => {
  if (e.target.classList.contains("category-selector-overlay")) closePicker();
});

// ---- Diálogo propio (en vez de confirm/prompt del navegador, que algunos
// navegadores móviles bloquean sin avisar) ----
function appDialog({ title, message = "", input = null, confirmLabel = "Aceptar", danger = false }) {
  let el = document.getElementById("app-dialog");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-dialog";
    el.className = "app-dialog js-sheet";
    el.innerHTML = `
      <div class="app-dialog-overlay"></div>
      <form class="app-dialog-box" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title">
        <h3 id="app-dialog-title"></h3>
        <p class="app-dialog-msg"></p>
        <input type="text" class="app-dialog-input" maxlength="40">
        <div class="app-dialog-actions">
          <button type="button" class="app-dialog-cancel">Cancelar</button>
          <button type="submit" class="app-dialog-ok"></button>
        </div>
      </form>`;
    document.body.appendChild(el);
  }
  el.querySelector("#app-dialog-title").textContent = title;
  const msg = el.querySelector(".app-dialog-msg");
  msg.textContent = message;
  msg.hidden = !message;
  const field = el.querySelector(".app-dialog-input");
  field.hidden = input === null;
  field.value = input || "";
  const ok = el.querySelector(".app-dialog-ok");
  ok.textContent = confirmLabel;
  ok.classList.toggle("danger", danger);
  showSheet(el);
  if (input !== null) setTimeout(() => { field.focus(); field.select(); }, 30);

  return new Promise(resolve => {
    const form = el.querySelector("form");
    const finish = value => {
      hideSheet(el);
      form.onsubmit = null;
      el.querySelector(".app-dialog-cancel").onclick = null;
      el.querySelector(".app-dialog-overlay").onclick = null;
      resolve(value);
    };
    form.onsubmit = e => { e.preventDefault(); finish(input === null ? true : field.value.trim()); };
    el.querySelector(".app-dialog-cancel").onclick = () => finish(input === null ? false : null);
    el.querySelector(".app-dialog-overlay").onclick = () => finish(input === null ? false : null);
  });
}

// ================= Tarjeta de crédito: se paga el total el 29 de cada mes =================
// (en meses más cortos, el último día).
// Ajustes editables (meta/finanzas_ajustes), con sus valores de siempre.
const AJUSTES_DEFECTO = { diaPagoTarjeta: 29, reivaPct: 5, horasMes: 160, umbralHormiga: 25, ultimoRespaldoArchivo: null };
let ajustes = Object.assign({}, AJUSTES_DEFECTO);
let ajustesCargados = false;
const diaPagoTarjeta = () => Math.min(31, Math.max(1, Math.round(Number(ajustes.diaPagoTarjeta) || AJUSTES_DEFECTO.diaPagoTarjeta)));
const reivaTasa = () => Math.min(100, Math.max(0, Number(ajustes.reivaPct) >= 0 ? Number(ajustes.reivaPct) : AJUSTES_DEFECTO.reivaPct)) / 100;

function nextCardPayDate() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const inMonth = (y, m) => new Date(y, m, Math.min(diaPagoTarjeta(), new Date(y, m + 1, 0).getDate()));
  let d = inMonth(today.getFullYear(), today.getMonth());
  if (d < today) d = inMonth(today.getFullYear(), today.getMonth() + 1);
  return { date: d, days: Math.round((d - today) / 86400000) };
}

// Línea del panel de Deuda de tarjeta.
function cardScheduleHTML(deuda) {
  const { date, days } = nextCardPayDate();
  const when = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  if (days === 0) {
    return deuda > 0
      ? `<div class="card-sched alert"><strong>Hoy toca pagar la tarjeta: ${formatBsShort(deuda)}</strong></div>`
      : `<div class="card-sched"><span class="card-sched-days">Hoy es día de pago</span></div>`;
  }
  const left = days === 1 ? "Falta 1 día" : `Faltan ${days} días`;
  return `<div class="card-sched"><span class="card-sched-days">${left}</span><span>Pago: ${when}</span></div>`;
}

// ================= Herramientas: RE-IVA =================
// Cada compra marcada "con factura" suma el 5 % de su monto al mes
// calendario (1 al 30/31) en que se hizo, sin importar el periodo del
// presupuesto.
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function renderReiva() {
  const pct = document.getElementById("reiva-pct-texto");
  if (pct) pct.textContent = `${(reivaTasa() * 100).toLocaleString("es-BO", { maximumFractionDigits: 2 })} %`;
  const byMonth = {};
  financeCache
    .filter(m => m.type === "gasto" && m.factura && m.date)
    .forEach(m => { (byMonth[m.date.slice(0, 7)] = byMonth[m.date.slice(0, 7)] || []).push(m); });
  const thisMonth = isoDate(new Date()).slice(0, 7);
  const thisYear = thisMonth.slice(0, 4);
  const months = Object.keys(byMonth).sort().reverse();
  const el = document.getElementById("reiva-list");
  if (!months.length) {
    el.innerHTML = `<p class="empty-state">Todavía no marcaste compras con factura. Al registrar un gasto, activa <strong>Compra con factura</strong> y aparecerá aquí.</p>`;
    return;
  }
  el.innerHTML = months.map(key => {
    const items = byMonth[key].slice().sort(byNewest);
    const total = FD.sumaBs(items, m => m.amount);
    const [y, mo] = key.split("-");
    const name = `${MONTH_NAMES[Number(mo) - 1]}${y !== thisYear ? " " + y : ""}`;
    return `
      <details class="reiva-month${key === thisMonth ? " current" : ""}">
        <summary>
          <div class="reiva-month-main">
            <span class="reiva-month-name">${name}${key === thisMonth ? `<span class="reiva-badge">En curso</span>` : ""}</span>
            <span class="reiva-month-sub">${items.length} factura${items.length === 1 ? "" : "s"} · ${formatMoney(total)} en compras</span>
          </div>
          <span class="reiva-month-amount">${formatMoney(total * reivaTasa())}</span>
        </summary>
        <div class="reiva-items">
          ${items.map(m => `
            <div class="reiva-item">
              <span class="reiva-item-date">${Number(m.date.slice(8, 10))}</span>
              <span class="reiva-item-desc">${escapeHtml(m.desc || findCategory("gasto", m.category).label)}</span>
              <span class="reiva-item-amount">${formatMoney(m.amount)}<small>${formatMoney(m.amount * reivaTasa())}</small></span>
            </div>`).join("")}
        </div>
      </details>`;
  }).join("");
}

// ================= Herramientas: Periodo del presupuesto =================

function renderPeriodSettings() {
  const period = currentBudgetPeriod();
  const days = daysLeftInPeriod(period);
  document.getElementById("period-preview").innerHTML = `
    <span class="period-preview-icon" data-icon="calendar"></span>
    <div>
      <div class="period-preview-range">${periodLabel(period)}</div>
      <div class="period-preview-sub">${monthOffset === 0 ? `Periodo actual · quedan <strong>${days} día${days === 1 ? "" : "s"}</strong>` : "Periodo seleccionado en Presupuesto"}</div>
    </div>
  `;
  document.getElementById("period-days").innerHTML = Array.from({ length: 30 }, (_, i) => i + 1).map(d => `
    <button type="button" class="period-day${d === budgetStartDay ? " selected" : ""}" role="radio" aria-checked="${d === budgetStartDay}" data-start-day="${d}">${d}</button>
  `).join("");
  renderIcons(document.getElementById("period-preview"));
}

document.getElementById("period-days").addEventListener("click", e => {
  const btn = e.target.closest("[data-start-day]");
  if (!btn) return;
  budgetStartDay = Number(btn.dataset.startDay);
  renderAll();
  budgetConfigDocRef().set({ startDay: budgetStartDay });
});

// ================= Herramientas: Categorías =================

// Se guarda con merge: así no se pierden otros campos del documento (como
// las categorías archivadas).
function saveCategoryGroups(groups) {
  return categoriasDocRef().set({ groups }, { merge: true });
}
// Al borrar una categoría se guarda su nombre, ícono y color para que los
// movimientos viejos la sigan mostrando bien.
function archivarCategoria(cat, extra) {
  if (!cat || categoriasArchivadas.some(c => c.id === cat.id)) return;
  const item = Object.assign({ id: cat.id, label: cat.label, icon: cat.icon || "otherCategory", color: cat.color || "#9a978f" }, cat.emoji ? { emoji: cat.emoji } : {}, extra || {});
  categoriasArchivadas = categoriasArchivadas.concat([item]);
  categoriasDocRef().set({ archivadas: categoriasArchivadas }, { merge: true }).catch(err => console.error("Manolo: no se pudo archivar la categoría", err));
}

const EMOJI_CHOICES = [
  "🍕", "🍔", "🌭", "🍟", "🌮", "🌯", "🥪", "🍗", "🥩", "🍖", "🍝", "🍜", "🍣", "🍱", "🥗", "🥘", "🍲", "🥟", "🍳", "🥞", "🥐", "🥖", "🧀", "🍎", "🍌", "🍓", "🥑", "🥦", "🥕", "🛒", "🍰", "🍦", "🍩", "🍪", "🍫", "🍿",
  "☕", "🧋", "🥤", "🧃", "🍵", "🍺", "🍻", "🍷", "🥂", "🍸", "🍹", "🥃", "💧",
  "🚗", "🚕", "🚙", "🏍️", "🛵", "🚲", "🛴", "🚌", "🚇", "🚆", "✈️", "🚢", "⛽", "🅿️", "🔧", "🚦", "🧳",
  "🏠", "🏡", "🏢", "🛋️", "🛏️", "🚿", "🧹", "🧺", "🧼", "🧻", "🪴", "🔑", "🔨", "💡", "🔌", "🔥", "📱", "💻", "📶", "📺", "🖨️",
  "🏥", "💊", "🩺", "🦷", "👓", "🩹", "💉", "🧘", "💪", "🏋️", "💆", "💇", "💅", "💄", "🧴", "🪒",
  "👕", "👖", "👗", "👔", "🧥", "👟", "👠", "👜", "🎒", "⌚", "💍", "🛍️", "📦",
  "🎬", "🎮", "🎵", "🎧", "🎤", "🎸", "🎹", "📷", "🎨", "🎭", "🎟️", "🎪", "🎳", "🎲", "🧩", "📖", "📚", "📰",
  "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "🥊", "🏊", "🚴", "🏃", "⛳", "🏂", "🎣",
  "🏖️", "🏔️", "🏕️", "🗺️", "🏨", "🌎", "📸",
  "👶", "🍼", "🧸", "👨‍👩‍👧", "💑", "💐", "🎓", "✏️", "🏫", "🐶", "🐱", "🐾", "🐟",
  "💳", "💰", "💵", "💸", "🏦", "🪙", "📈", "📉", "🧾", "💼", "🖥️", "📄", "🏛️", "🤝", "🐷",
  "🎁", "🎉", "🎂", "🎄", "💝", "⛪", "🙏",
  "⭐", "❤️", "✅", "📌", "🔔", "♻️", "🌱", "☀️", "❓"
];

function emojiPickerHTML() {
  return EMOJI_CHOICES.map((emoji, i) =>
    `<button type="button" class="emoji-choice${i === 0 ? " selected" : ""}" data-emoji="${emoji}">${emoji}</button>`
  ).join("");
}

function colorPickerHTML() {
  return CATEGORY_COLOR_POOL.map((color, i) =>
    `<button type="button" class="color-choice${i === 0 ? " selected" : ""}" data-color="${color}" style="background:${color};" aria-label="Color ${i + 1}"></button>`
  ).join("");
}

function saveIngresoCategories(list) {
  CATEGORIES.ingreso = list;
  renderAll();
  return ingresoCategoriesDocRef().set({ list });
}

function ingresoGroupHTML() {
  const canDelete = CATEGORIES.ingreso.length > 1;
  const itemsHTML = CATEGORIES.ingreso.map(item => `
    <div class="list-item cat-item" data-item-id="${item.id}">
      <div style="display:flex; align-items:center; gap:0.7rem;">
        ${item.emoji
          ? `<span class="cat-emoji" style="background:${item.color}; color:#fff;">${item.emoji}</span>`
          : `<span class="cat-icon" style="background:${item.color}22; color:${item.color}" data-icon="${item.icon}"></span>`}
        <strong>${escapeHtml(item.label)}</strong>
      </div>
      <div class="cat-item-actions">
        <button type="button" class="cat-rename-btn" aria-label="Cambiar nombre de ${escapeHtml(item.label)}" data-rename-ingreso="${item.id}"><span data-icon="edit"></span></button>
        ${canDelete ? `<button type="button" class="delete" aria-label="Eliminar categoría" data-delete-cat="${item.id}" data-delete-group="${INGRESO_GROUP_ID}">${ICONS.trash}</button>` : ""}
      </div>
    </div>
  `).join("");
  return `
    <div class="cat-group">
      <div class="cat-group-header">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div class="cat-color-line" style="background:${INGRESO_COLOR};"></div>
          <h3>Ingresos</h3>
        </div>
        <button type="button" class="cat-add-btn" data-add-sub="${INGRESO_GROUP_ID}" aria-label="Agregar categoría de ingreso">${ICONS.plus}</button>
      </div>
      <div class="cat-group-items" data-group-id="${INGRESO_GROUP_ID}">${itemsHTML}</div>
      <form class="tracker-form cat-subcategory-form" data-group-id="${INGRESO_GROUP_ID}" data-color="${INGRESO_COLOR}" hidden>
        <input type="text" class="cat-sub-name" placeholder="Nombre (ej: Bonos, Alquiler cobrado)" required>
        <div class="emoji-picker" style="margin-top:0.8rem;">${emojiPickerHTML()}</div>
        <button type="submit">Agregar</button>
        <button type="button" class="link-btn cat-sub-cancel">Cancelar</button>
      </form>
    </div>
  `;
}

function renderCategoryGroups() {
  if (catDrag) return; // no rehacer la lista mientras se arrastra una categoría
  const container = document.getElementById("category-groups");
  container.innerHTML = ingresoGroupHTML() + categoryGroupsCache.map((g, gi) => {
    const color = g.color || CATEGORY_COLOR_POOL[gi % CATEGORY_COLOR_POOL.length];
    const itemsHTML = g.items.map(item => {
      const displayEmoji = item.emoji;
      const displayIcon = !displayEmoji ? item.icon : null;
      const iconOrEmojiHTML = displayEmoji
        ? `<span class="cat-emoji" style="background:${color}; color:#fff;">${displayEmoji}</span>`
        : `<span class="cat-icon" style="background:${color}22; color:${color}" data-icon="${displayIcon}"></span>`;

      return `
        <div class="list-item cat-item" data-item-id="${item.id}">
          <div style="display:flex; align-items:center; gap:0.7rem;">
            ${iconOrEmojiHTML}
            <strong>${escapeHtml(item.label)}</strong>
          </div>
          ${item.id !== "otros" ? `<button type="button" class="delete" aria-label="Eliminar categoría" data-delete-cat="${item.id}" data-delete-group="${g.id}">${ICONS.trash}</button>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="cat-group" data-section-id="${g.id}">
        <div class="cat-group-header">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <div class="cat-color-line" style="background:${color};"></div>
            <h3>${escapeHtml(g.nombre)}</h3>
          </div>
          <div class="cat-group-actions">
            <button type="button" class="cat-add-btn" data-add-sub="${g.id}" aria-label="Agregar subcategoría en ${escapeHtml(g.nombre)}">${ICONS.plus}</button>
            <button type="button" class="cat-drag" data-drag-section aria-label="Mover sección ${escapeHtml(g.nombre)}"><span data-icon="grip"></span></button>
          </div>
        </div>
        <div class="cat-group-items" data-group-id="${g.id}">${itemsHTML}</div>
        <form class="tracker-form cat-subcategory-form" data-group-id="${g.id}" data-color="${color}" hidden>
          <input type="text" class="cat-sub-name" placeholder="Nombre (ej: Mascotas)" required>
          <div class="emoji-picker" style="margin-top:0.8rem;">${emojiPickerHTML()}</div>
          <button type="submit">Agregar</button>
          <button type="button" class="link-btn cat-sub-cancel">Cancelar</button>
        </form>
      </div>
    `;
  }).join("");
  renderIcons(container);
}

// ---- Mover secciones: se arrastran desde el ícono ⋮⋮ de su título ----
// Una sección de gastos se mueve entre las demás (Ingresos queda siempre
// arriba, así que no se puede arrastrar).
let catDrag = null; // { item, list, grabOffset, startOrder }

function catDragSiblings(d) {
  return Array.from(d.list.querySelectorAll(":scope > .cat-group[data-section-id]"));
}

function catDragOrder(d) {
  return catDragSiblings(d).map(el => el.dataset.sectionId);
}

function saveSectionOrder(order) {
  // Cada sección conserva su color aunque cambie de lugar (el color por
  // defecto depende de la posición).
  const withColor = categoryGroupsCache.map(g => Object.assign({}, g, { color: groupColor(g) }));
  categoryGroupsCache = order.map(id => withColor.find(g => g.id === id)).filter(Boolean)
    .concat(withColor.filter(g => !order.includes(g.id)));
  gastoCategoriesCache = flattenCategoryGroups(categoryGroupsCache);
  saveCategoryGroups(categoryGroupsCache);
  renderAll();
}

function moveCatDrag(clientY) {
  const { item, list, grabOffset } = catDrag;
  item.style.transform = "";
  const others = catDragSiblings(catDrag).filter(el => el !== item);
  const before = others.find(el => {
    const r = el.getBoundingClientRect();
    return clientY < r.top + r.height / 2;
  });
  if (before) { if (item.nextElementSibling !== before) list.insertBefore(item, before); }
  else if (others.length && list.lastElementChild !== item) list.appendChild(item);
  const natural = item.getBoundingClientRect().top;
  item.style.transform = `translateY(${clientY - grabOffset - natural}px)`;
  // Si el dedo llega al borde de la pantalla, se desplaza la página.
  if (clientY < 110) window.scrollBy(0, -10);
  else if (clientY > window.innerHeight - 130) window.scrollBy(0, 10);
}

function endCatDrag() {
  if (!catDrag) return;
  const d = catDrag;
  d.item.classList.remove("dragging");
  d.item.style.transform = "";
  d.list.classList.remove("sorting-sections");
  const order = catDragOrder(d);
  catDrag = null;
  if (order.join() !== d.startOrder.join()) saveSectionOrder(order);
}

document.getElementById("category-groups").addEventListener("pointerdown", e => {
  const handle = e.target.closest("[data-drag-section]");
  if (!handle || catDrag) return;
  e.preventDefault();
  const item = handle.closest(".cat-group");
  const list = item.parentElement;
  // Mientras se mueven secciones se ven solo sus títulos; se ajusta el
  // scroll para que la sección siga bajo el dedo.
  const before = item.getBoundingClientRect().top;
  list.classList.add("sorting-sections");
  window.scrollBy(0, item.getBoundingClientRect().top - before);
  catDrag = { item, list, grabOffset: e.clientY - item.getBoundingClientRect().top };
  catDrag.startOrder = catDragOrder(catDrag);
  handle.setPointerCapture(e.pointerId);
  item.classList.add("dragging");
});
document.getElementById("category-groups").addEventListener("pointermove", e => {
  if (catDrag) { e.preventDefault(); moveCatDrag(e.clientY); }
});
document.getElementById("category-groups").addEventListener("pointerup", endCatDrag);
document.getElementById("category-groups").addEventListener("pointercancel", endCatDrag);

async function deleteCategoryItem(groupId, itemId) {
  if (groupId === INGRESO_GROUP_ID) {
    const item = CATEGORIES.ingreso.find(i => i.id === itemId);
    if (!item || CATEGORIES.ingreso.length <= 1) return;
    const ok = await appDialog({ title: `¿Eliminar "${item.label}"?`, message: "Los ingresos que ya registraste con esta categoría no se borran.", confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    delete budgetsCache[itemId];
    saveBudgets();
    archivarCategoria(Object.assign({ color: INGRESO_COLOR }, item), { tipo: "ingreso" });
    saveIngresoCategories(CATEGORIES.ingreso.filter(i => i.id !== itemId));
    return;
  }
  const group = categoryGroupsCache.find(g => g.id === groupId);
  const item = group && group.items.find(i => i.id === itemId);
  if (!group || !item) return;
  const ok = await appDialog({ title: `¿Eliminar "${item.label}"?`, message: "Los gastos que ya registraste con esta categoría no se borran.", confirmLabel: "Eliminar", danger: true });
  if (!ok) return;
  if (isPlanned(itemId)) {
    delete budgetsCache[itemId];
    saveBudgets();
  }
  archivarCategoria(gastoCategoriesCache.find(c => c.id === itemId) || item);

  const next = categoryGroupsCache
    .map(g => g.id === groupId ? Object.assign({}, g, { items: g.items.filter(i => i.id !== itemId) }) : g)
    .filter(g => g.items.length > 0);
  saveCategoryGroups(next);
}

document.getElementById("category-groups").addEventListener("click", e => {
  const renameBtn = e.target.closest("[data-rename-ingreso]");
  if (renameBtn) {
    const item = CATEGORIES.ingreso.find(i => i.id === renameBtn.dataset.renameIngreso);
    if (!item) return;
    appDialog({ title: "Cambiar nombre", input: item.label, confirmLabel: "Guardar" }).then(name => {
      if (!name || name === item.label) return;
      saveIngresoCategories(CATEGORIES.ingreso.map(i => i.id === item.id ? Object.assign({}, i, { label: name }) : i));
    });
    return;
  }
  const delBtn = e.target.closest("[data-delete-cat]");
  if (delBtn) { deleteCategoryItem(delBtn.dataset.deleteGroup, delBtn.dataset.deleteCat); return; }

  const addBtn = e.target.closest("[data-add-sub]");
  if (addBtn) {
    const form = document.querySelector(`.cat-subcategory-form[data-group-id="${addBtn.dataset.addSub}"]`);
    if (form) form.hidden = !form.hidden;
    return;
  }

  const emojiChoice = e.target.closest(".emoji-choice");
  if (emojiChoice) {
    const form = emojiChoice.closest("form");
    form.querySelectorAll(".emoji-choice").forEach(b => b.classList.remove("selected"));
    emojiChoice.classList.add("selected");
    return;
  }

  const cancelBtn = e.target.closest(".cat-sub-cancel");
  if (cancelBtn) {
    const form = cancelBtn.closest("form");
    form.reset();
    form.querySelectorAll(".emoji-choice").forEach(b => b.classList.remove("selected"));
    form.hidden = true;
  }
});

document.getElementById("category-groups").addEventListener("submit", e => {
  const form = e.target.closest(".cat-subcategory-form");
  if (!form) return;
  e.preventDefault();

  const groupId = form.dataset.groupId;
  const label = form.querySelector(".cat-sub-name").value.trim();
  const emojiChoice = form.querySelector(".emoji-choice.selected");
  if (!label || !emojiChoice) return;

  if (groupId === INGRESO_GROUP_ID) {
    const base = slugify(label);
    let id = base, suffix = 2;
    while (CATEGORIES.ingreso.some(c => c.id === id) || gastoCategoriesCache.some(c => c.id === id)) id = `${base}_${suffix++}`;
    saveIngresoCategories(CATEGORIES.ingreso.concat([{ id, label, icon: "salary", emoji: emojiChoice.dataset.emoji, color: INGRESO_COLOR }]));
    form.reset();
    form.querySelectorAll(".emoji-choice").forEach(b => b.classList.remove("selected"));
    form.hidden = true;
    return;
  }

  const base = slugify(label);
  let id = base, suffix = 2;
  while (gastoCategoriesCache.some(c => c.id === id)) id = `${base}_${suffix++}`;

  const newItem = { id, label, icon: "otherCategory", emoji: emojiChoice.dataset.emoji };

  const next = categoryGroupsCache.map(g =>
    g.id === groupId ? Object.assign({}, g, { items: g.items.concat([newItem]) }) : g
  );
  saveCategoryGroups(next);
  form.reset();
  form.querySelectorAll(".emoji-choice").forEach(b => b.classList.remove("selected"));
  form.hidden = true;
});

document.getElementById("new-group-toggle").addEventListener("click", () => {
  document.getElementById("new-group-form").hidden = false;
  document.getElementById("new-group-toggle").hidden = true;
  const picker = document.getElementById("new-group-color-picker");
  picker.innerHTML = colorPickerHTML();
  document.getElementById("new-group-name").focus();
});
document.getElementById("new-group-cancel").addEventListener("click", () => {
  document.getElementById("new-group-form").reset();
  document.getElementById("new-group-form").hidden = true;
  document.getElementById("new-group-toggle").hidden = false;
});

// Handle color selection in new group form
document.getElementById("new-group-color-picker").addEventListener("click", e => {
  const colorBtn = e.target.closest(".color-choice");
  if (colorBtn) {
    e.preventDefault();
    document.querySelectorAll("#new-group-color-picker .color-choice").forEach(b => b.classList.remove("selected"));
    colorBtn.classList.add("selected");
  }
});

document.getElementById("new-group-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("new-group-name");
  const nombre = input.value.trim();
  if (!nombre) return;

  const base = slugify(nombre);
  let id = base, suffix = 2;
  while (categoryGroupsCache.some(g => g.id === id)) id = `${base}_${suffix++}`;

  let itemId = base, itemSuffix = 2;
  while (gastoCategoriesCache.some(c => c.id === itemId)) itemId = `${base}_${itemSuffix++}`;

  const selectedColor = document.querySelector("#new-group-color-picker .color-choice.selected");
  const newItem = { id: itemId, label: nombre, icon: "otherCategory" };
  const newGroup = { id, nombre, items: [newItem] };
  if (selectedColor) newGroup.color = selectedColor.dataset.color;

  const next = categoryGroupsCache.concat([newGroup]);
  saveCategoryGroups(next);
  document.getElementById("new-group-form").reset();
  document.getElementById("new-group-form").hidden = true;
  document.getElementById("new-group-toggle").hidden = false;
});

// ================= Herramientas: Carteras =================

// La cartera de gastos y la de tarjeta de crédito salen de los movimientos
// de Finanzas (Bs). Ahorros se lleva en US$. Además de esas 3, el usuario
// puede crear sus propias carteras (con su propio saldo y moneda) y
// transferir plata entre Ahorro y esas carteras personalizadas.
function customWalletBalance(id) {
  return FD.sumaBs(carterasMovCache.filter(m => m.carteraId === id), m => m.monto);
}

// Todas las carteras que se pueden usar en una transferencia. Gastos y
// Ahorro pueden ser origen o destino; Tarjeta de crédito solo puede ser
// destino (pagarla con plata de otra cartera), nunca origen — no tiene
// sentido "sacar" plata de una deuda.
function ledgerWallets() {
  return [
    { id: "efectivo", nombre: "Efectivo", moneda: "Bs", builtIn: true },
    { id: "debito", nombre: "Débito", moneda: "Bs", builtIn: true },
    { id: "tarjeta", nombre: "Tarjeta de Crédito", moneda: "Bs", builtIn: true },
    { id: "ahorro", nombre: "Ahorro", moneda: "US$", builtIn: true }
  ].concat(carterasCustomCache.map(w => Object.assign({ builtIn: false }, w)));
}

function walletById(id) {
  if (id === "gastos") return { id, nombre: "Yo", moneda: "Bs", builtIn: true };
  return ledgerWallets().find(w => w.id === cashWallet(id)) || ledgerWallets().find(w => w.id === id);
}
function walletLabel(id) {
  const w = walletById(cashWallet(id));
  return w ? w.nombre : "Cartera";
}
function walletCurrency(id) {
  const w = walletById(id);
  return w ? w.moneda : "Bs";
}
function formatWalletAmount(id, n) {
  return walletCurrency(id) === "US$" ? `US$ ${n.toLocaleString("es-BO", { maximumFractionDigits: 2 })}` : formatBsShort(n);
}

// Transferencia entre carteras: un solo registro en Finanzas (para que se vea
// en la lista y mueva el saldo de "Yo" o la deuda de la tarjeta) más, si hace
// falta, el movimiento en Ahorro o en la cartera propia. Guardamos esos ids en
// "links" para poder borrar todo junto.
// Todo en un solo lote con ids creados en el teléfono: sin conexión se
// guarda completo al instante (antes esperaba al servidor entre un paso y
// otro y, si cerrabas la app, quedaba a medias).
function createTransfer({ from, to, amount, amountTo, desc, date, tipoCambio }) {
  const suffix = desc ? " · " + desc : "";
  const links = [];
  const lote = nuevoLote();
  const creado = Date.now();
  const side = (walletId, monto, nota) => {
    if (isCash(walletId) || walletId === "tarjeta") return;
    if (walletId === "ahorro") {
      const ref = ahorrosCollection().doc();
      lote.set(ref, FD.conCentavos({ date, amount: monto, notes: nota, createdAt: creado }));
      links.push({ kind: "ahorro", id: ref.id });
    } else {
      const ref = carterasMovimientosCollection().doc();
      lote.set(ref, FD.conCentavos({ carteraId: walletId, fecha: date, monto, nota, createdAt: creado }));
      links.push({ kind: "cartera", id: ref.id });
    }
  };
  side(from, -amount, `Transferencia a ${walletLabel(to)}${suffix}`);
  side(to, amountTo, `Transferencia desde ${walletLabel(from)}${suffix}`);
  const record = FD.conCentavos({ date, type: "transferencia", category: "transferencia", from, to, amount, amountTo, desc: desc || "", links, createdAt: creado });
  if (tipoCambio) record.tipoCambio = tipoCambio;
  lote.set(financeCollection().doc(), record);
  return lote.commit();
}

function deleteTransfer(m) {
  const entries = [{ ref: financeCollection().doc(m.id), data: withoutId(m) }];
  (m.links || []).forEach(l => {
    const ref = l.kind === "ahorro" ? ahorrosCollection().doc(l.id)
      : l.kind === "cartera" ? carterasMovimientosCollection().doc(l.id) : null;
    if (!ref) return;
    const doc = (l.kind === "ahorro" ? ahorrosCache : carterasMovCache).find(x => x.id === l.id);
    if (doc) entries.push({ ref, data: withoutId(doc) });
    else ref.delete();
  });
  removeWithUndo("Transferencia eliminada", entries);
}

// Muestra el error real de Firebase (permisos, red, etc.) en vez de fallar
// en silencio: es la única forma de saber qué está pasando cuando algo no
// se guarda, sin tener que adivinar.
function showFormError(id, err) {
  console.error("Manolo:", id, err);
  const el = document.getElementById(id);
  el.textContent = "No se pudo guardar: " + (err && err.message ? err.message : err);
  el.hidden = false;
}
function clearFormError(id) {
  document.getElementById(id).hidden = true;
}
// Borrar una cartera propia se puede deshacer (antes se perdían sus
// movimientos sin aviso).
function deleteCustomWallet(id) {
  const w = carterasCustomCache.find(x => x.id === id);
  if (!w) return;
  const movs = carterasMovCache.filter(m => m.carteraId === id);
  removeWithUndo(`Cartera «${w.nombre}» eliminada`,
    movs.map(m => ({ ref: carterasMovimientosCollection().doc(m.id), data: FD.sinId(m) })),
    {
      borrar: lote => lote.set(carterasCustomDocRef(), { list: carterasCustomCache.filter(x => x.id !== id) }),
      restaurar: lote => lote.set(carterasCustomDocRef(), { list: carterasCustomCache.filter(x => x.id !== id).concat([w]) })
    });
}

function renderWallets() {
  const { saldo, deuda, efectivo, debito } = computeTotals(financeCache);
  const totalAhorros = FD.sumaBs(ahorrosCache, a => a.amount);
  let netoBs = saldo - deuda;
  let netoUsd = totalAhorros;
  carterasCustomCache.forEach(w => {
    const bal = customWalletBalance(w.id);
    if (w.moneda === "US$") netoUsd += bal; else netoBs += bal;
  });

  const deudaText = deuda > 0 ? "−" + formatMoney(deuda) : formatMoney(0);

  const panels = [
    { label: "Patrimonio Total", lines: [formatMoney(netoBs), formatUSD(netoUsd)],
      sub: tcoData ? `≈ ${formatMoney(netoBs + netoUsd * tcoData.ultimo.tco)} al TC oficial ${fmtRate(tcoData.ultimo.tco)}` : "" },
    { label: "Yo", lines: [formatMoney(saldo)], sub: `Efectivo ${formatBsShort(efectivo)} · Débito ${formatBsShort(debito)}` },
    { label: "Cartera de Tarjeta de Crédito", lines: [deudaText] },
    { label: "Cartera de Ahorro", lines: [formatUSD(totalAhorros)],
      sub: tcoData ? `≈ ${formatMoney(totalAhorros * tcoData.ultimo.tco)} al TC oficial` : "" }
  ];
  carterasCustomCache.forEach(w => {
    const bal = customWalletBalance(w.id);
    panels.push({ label: w.nombre, lines: [w.moneda === "US$" ? formatUSD(bal) : formatMoney(bal)] });
  });

  document.getElementById("wallet-hero-track").innerHTML = panels.map(p => `
    <div class="wallet-hero-panel">
      ${p.lines.map(l => `<div class="wallet-hero-value">${l}</div>`).join("")}
      <div class="wallet-hero-label">${p.label}</div>
      ${p.sub ? `<div class="wallet-hero-sub">${p.sub}</div>` : ""}
    </div>
  `).join("");

  document.getElementById("wallet-hero-dots").innerHTML = panels.map((_, i) =>
    `<button type="button" class="wallet-hero-dot${i === 0 ? " active" : ""}" data-panel="${i}" aria-label="Panel ${i + 1}"></button>`
  ).join("");

  const walletHTML = (icon, color, label, value, neg, walletId) => `
    <div class="wallet-card" data-wallet-id="${walletId}">
      <span class="wallet-icon" style="background:${color}22; color:${color}" data-icon="${icon}"></span>
      <div class="wallet-info">
        <div class="wallet-label">${label}</div>
        <div class="wallet-value${neg ? " neg" : ""}">${value}</div>
      </div>
    </div>
  `;
  const walletCustomHTML = (w, i) => {
    const bal = customWalletBalance(w.id);
    const color = CATEGORY_COLOR_POOL[i % CATEGORY_COLOR_POOL.length];
    return `
      <div class="wallet-card" data-wallet-id="${w.id}">
        <span class="wallet-icon" style="background:${color}22; color:${color}" data-icon="wallet"></span>
        <div class="wallet-info">
          <div class="wallet-label">${escapeHtml(w.nombre)} (${w.moneda})</div>
          <div class="wallet-value">${w.moneda === "US$" ? formatUSD(bal) : formatMoney(bal)}</div>
        </div>
        <button type="button" class="delete" aria-label="Eliminar cartera" data-delete-wallet="${w.id}">${ICONS.trash}</button>
      </div>
    `;
  };

  document.getElementById("wallet-list").innerHTML =
    `<div class="wallet-card wallet-card-yo">
      <button type="button" class="wallet-yo-total" data-wallet-id="gastos">
        <span class="wallet-icon" style="background:#ff9a4d22; color:#ff9a4d" data-icon="finance"></span>
        <span class="wallet-info">
          <span class="wallet-label">Yo · Total</span>
          <span class="wallet-value">${formatMoney(saldo)}</span>
        </span>
      </button>
      <div class="wallet-yo-split">
        <button type="button" class="wallet-yo-part" data-wallet-id="efectivo">
          <span class="wallet-yo-dot" style="background:${PAYMENT_COLORS.efectivo}" data-icon="salary"></span>
          <span class="wallet-yo-name">Efectivo</span>
          <span class="wallet-yo-amount${efectivo < 0 ? " neg" : ""}">${formatMoney(efectivo)}</span>
        </button>
        <button type="button" class="wallet-yo-part" data-wallet-id="debito">
          <span class="wallet-yo-dot" style="background:${PAYMENT_COLORS.debito}" data-icon="bank"></span>
          <span class="wallet-yo-name">Débito</span>
          <span class="wallet-yo-amount${debito < 0 ? " neg" : ""}">${formatMoney(debito)}</span>
        </button>
      </div>
    </div>` +
    walletHTML("finance", "#e05656", "Tarjeta de Crédito", deudaText, deuda > 0, "tarjeta") +
    walletHTML("wallet", "#5cc98a", "Ahorro (US$)", formatUSD(totalAhorros), false, "ahorro") +
    carterasCustomCache.map(walletCustomHTML).join("");

  renderIcons(document.getElementById("wallet-hero-track"));
  renderIcons(document.getElementById("wallet-list"));
  wireWalletHero();
  renderWalletDetail();
}

// ---- Detalle de cartera: se abre al tocar una cartera en la lista ----
let selectedWalletId = null;

function openWalletDetail(id) {
  selectedWalletId = id;
  renderWalletDetail();
  window.location.hash = "fin-herramientas-carteras-detalle";
}

document.getElementById("wallet-list").addEventListener("click", e => {
  const delBtn = e.target.closest("[data-delete-wallet]");
  if (delBtn) { deleteCustomWallet(delBtn.dataset.deleteWallet); return; }
  const card = e.target.closest("[data-wallet-id]");
  if (card) openWalletDetail(card.dataset.walletId);
});

// Al tocar "Carteras" para volver, la hoja debe bajar con animación en vez
// de desaparecer de golpe. En escritorio no es una hoja flotante, así que
// ahí se navega directo.
document.querySelector("#panel-fin-herramientas-carteras-detalle .back-link").addEventListener("click", e => {
  const panel = document.getElementById("panel-fin-herramientas-carteras-detalle");
  if (!window.matchMedia("(max-width: 768px)").matches) return;
  e.preventDefault();
  if (panel.classList.contains("closing")) return;
  panel.classList.add("closing");
  setTimeout(() => {
    panel.classList.remove("closing");
    window.location.hash = "fin-herramientas-carteras";
  }, 260);
});

// Movimientos de una cartera, normalizados para mostrarlos en su detalle.
// Cada cartera guarda su historial en un lugar distinto (Gastos/Tarjeta en
// "finanzas", Ahorro en "ahorros", las personalizadas en
// "carteras_movimientos"), así que acá se unifican en una sola forma.
// Para un movimiento de Ahorro o de una cartera propia que vino de una
// transferencia, muestra lo que pasó del otro lado (ej: cuántos Bs salieron
// para comprar esos US$) y el tipo de cambio si las monedas son distintas.
function transferCounterpart(walletId, entryId) {
  const t = financeCache.find(m => m.type === "transferencia" && (m.links || []).some(l => l.id === entryId));
  if (!t) return null;
  const received = t.amountTo != null ? t.amountTo : t.amount;
  const incoming = t.to === walletId;
  const otherId = incoming ? t.from : t.to;
  const otherAmount = incoming ? t.amount : received;
  const text = formatWalletAmount(otherId, otherAmount);
  let rate = "";
  const [bs, usd] = walletCurrency(t.from) === "US$" ? [received, t.amount] : [t.amount, received];
  if (walletCurrency(t.from) !== walletCurrency(t.to) && usd > 0) {
    rate = `1 US$ = Bs ${(bs / usd).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const title = (incoming ? `Desde ${walletLabel(t.from)}` : `Hacia ${walletLabel(t.to)}`) + (t.desc ? ` · ${t.desc}` : "");
  return { title, sub: incoming ? `Pusiste ${text}` : `Llegaron ${text}`, rate };
}

// Cuánto movió un movimiento de Finanzas en una cartera de efectivo/débito
// ("gastos" = las dos juntas). 0 si no la toca.
function cashDelta(m, walletId) {
  const hits = id => walletId === "gastos" ? isCash(id) : cashWallet(id) === walletId;
  if (m.type === "ingreso") return hits(paymentWallet(m.payment)) ? m.amount : 0;
  if (m.type === "gasto") return m.payment !== "credito" && hits(paymentWallet(m.payment)) ? -m.amount : 0;
  if (m.type === "pago_tarjeta") return hits(paymentWallet(m.payment)) ? -m.amount : 0;
  if (m.type === "transferencia") {
    return (hits(m.to) ? (m.amountTo != null ? m.amountTo : m.amount) : 0) - (hits(m.from) ? m.amount : 0);
  }
  return 0;
}

function walletMovementsFor(walletId) {
  if (isCash(walletId)) {
    return financeCache
      .filter(m => cashDelta(m, walletId) !== 0)
      .map(m => {
        const pay = findPayment(m.payment);
        return {
          id: m.id, date: m.date, createdAt: m.createdAt, desc: m.desc || findCategory(m.type, m.category).label,
          icon: findCategory(m.type, m.category).icon, color: findCategory(m.type, m.category).color,
          amount: cashDelta(m, walletId),
          meta: m.type === "transferencia" ? `${walletLabel(m.from)} → ${walletLabel(m.to)}` : walletId === "gastos" && pay ? pay.label : "",
          usd: false,
          onDelete: () => m.type === "transferencia" ? deleteTransfer(m) : deleteMovement(m.id)
        };
      });
  } else if (walletId === "tarjeta") {
    return financeCache
      .filter(m => (m.type === "gasto" && m.payment === "credito") || m.type === "pago_tarjeta" || m.type === "ajuste_tarjeta"
        || (m.type === "transferencia" && m.to === "tarjeta"))
      .map(m => ({
        id: m.id, date: m.date, createdAt: m.createdAt, desc: m.desc || findCategory(m.type, m.category).label,
        icon: findCategory(m.type, m.category).icon, color: findCategory(m.type, m.category).color,
        amount: m.type === "gasto" ? -m.amount : m.type === "transferencia" ? (m.amountTo != null ? m.amountTo : m.amount) : m.amount,
        meta: m.type === "transferencia" ? `Desde ${walletLabel(m.from)}` : "",
        usd: false,
        onDelete: () => m.type === "transferencia" ? deleteTransfer(m) : deleteMovement(m.id)
      }));
  } else if (walletId === "ahorro") {
    return ahorrosCache.map(a => {
      const cp = transferCounterpart("ahorro", a.id);
      return {
      id: a.id, date: a.date, createdAt: a.createdAt, desc: cp ? cp.title : (a.notes || "Ahorro"),
      icon: "wallet", color: "#5cc98a",
      amount: a.amount,
      meta: cp ? cp.rate : "",
      subAmount: cp ? cp.sub : "",
      usd: true,
      onDelete: () => removeWithUndo("Movimiento eliminado", [{ ref: ahorrosCollection().doc(a.id), data: withoutId(a) }])
      };
    });
  } else {
    const w = carterasCustomCache.find(x => x.id === walletId);
    return carterasMovCache.filter(m => m.carteraId === walletId).map(m => {
      const cp = transferCounterpart(walletId, m.id);
      return {
      id: m.id, date: m.fecha, createdAt: m.createdAt, desc: cp ? cp.title : (m.nota || "Movimiento"),
      icon: "wallet", color: "#9b6bde",
      amount: m.monto,
      meta: cp ? cp.rate : "",
      subAmount: cp ? cp.sub : "",
      usd: !!w && w.moneda === "US$",
      onDelete: () => removeWithUndo("Movimiento eliminado", [{ ref: carterasMovimientosCollection().doc(m.id), data: withoutId(m) }])
      };
    });
  }
}

function walletVisual(walletId) {
  if (walletId === "gastos") return { icon: "finance", color: "#ff9a4d" };
  if (walletId === "efectivo") return { icon: PAYMENT_ICONS.efectivo, color: PAYMENT_COLORS.efectivo };
  if (walletId === "debito") return { icon: PAYMENT_ICONS.debito, color: PAYMENT_COLORS.debito };
  if (walletId === "tarjeta") return { icon: "finance", color: "#e05656" };
  if (walletId === "ahorro") return { icon: "wallet", color: "#5cc98a" };
  const i = carterasCustomCache.findIndex(w => w.id === walletId);
  return { icon: "wallet", color: CATEGORY_COLOR_POOL[Math.max(i, 0) % CATEGORY_COLOR_POOL.length] };
}

function walletBalanceText(walletId) {
  const { saldo, deuda, efectivo, debito } = computeTotals(financeCache);
  if (walletId === "gastos") return formatMoney(saldo);
  if (walletId === "efectivo") return formatMoney(efectivo);
  if (walletId === "debito") return formatMoney(debito);
  if (walletId === "tarjeta") return deuda > 0 ? "−" + formatMoney(deuda) : formatMoney(0);
  if (walletId === "ahorro") return formatUSD(FD.sumaBs(ahorrosCache, a => a.amount));
  const w = carterasCustomCache.find(x => x.id === walletId);
  if (!w) return "";
  return w.moneda === "US$" ? formatUSD(customWalletBalance(walletId)) : formatMoney(customWalletBalance(walletId));
}

function renderWalletDetail() {
  if (!selectedWalletId) return;
  const w = walletById(selectedWalletId);
  if (!w) return;

  document.getElementById("wallet-detail-title").textContent = w.nombre;
  document.getElementById("wallet-detail-balance").textContent = walletBalanceText(selectedWalletId);

  const visual = walletVisual(selectedWalletId);
  const iconEl = document.getElementById("wallet-detail-icon");
  iconEl.dataset.icon = visual.icon;
  iconEl.style.background = visual.color;
  iconEl.style.boxShadow = `0 0 28px ${visual.color}66`;
  renderIcons(document.querySelector(".wallet-detail-hero"));

  const list = walletMovementsFor(selectedWalletId)
    .sort(byNewest)
    .slice(0, 20);

  const container = document.getElementById("wallet-detail-list");
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<p class="meta">Todavía no hay movimientos.</p>`;
    return;
  }

  list.forEach(m => {
    const sign = m.amount >= 0 ? "+" : "−";
    const amountClass = m.amount >= 0 ? "pos" : "neg";
    const amountText = m.usd ? formatUSD(Math.abs(m.amount)) : formatMoney(Math.abs(m.amount));
    const dateLabel = capitalize(new Date(m.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }));

    const item = document.createElement("div");
    item.className = "txn-item";
    item.innerHTML = `
      <span class="txn-icon" style="background:${m.color}22; color:${m.color}" data-icon="${m.icon}"></span>
      <div class="txn-body">
        <div class="txn-desc">${escapeHtml(m.desc)}</div>
        <div class="meta">${dateLabel}${m.meta ? " · " + m.meta : ""}</div>
      </div>
      <div class="txn-amount-col">
        <div class="txn-amount ${amountClass}">${sign}${amountText}</div>
        ${m.subAmount ? `<div class="txn-sub-amount">${escapeHtml(m.subAmount)}</div>` : ""}
      </div>
    `;
    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar movimiento");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => m.onDelete());
    item.appendChild(del);
    container.appendChild(item);
  });
  renderIcons(container);
}

function wireWalletHero() {
  const track = document.getElementById("wallet-hero-track");
  const dots = Array.from(document.querySelectorAll(".wallet-hero-dot"));
  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      track.scrollTo({ left: track.clientWidth * Number(dot.dataset.panel), behavior: "smooth" });
    });
  });
  track.onscroll = () => {
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
  };
}

// ---- Menú "⋯": Nueva cartera / Hacer una transferencia ----

document.getElementById("wallet-menu-btn").addEventListener("click", e => {
  e.stopPropagation();
  document.getElementById("wallet-menu-dropdown").hidden = !document.getElementById("wallet-menu-dropdown").hidden;
});
document.addEventListener("click", () => {
  document.getElementById("wallet-menu-dropdown").hidden = true;
});

document.getElementById("wallet-menu-new").addEventListener("click", () => {
  document.getElementById("wallet-menu-dropdown").hidden = true;
  document.getElementById("new-wallet-form").hidden = false;
});
document.getElementById("new-wallet-cancel").addEventListener("click", () => {
  document.getElementById("new-wallet-form").hidden = true;
});
document.getElementById("new-wallet-form").addEventListener("submit", e => {
  e.preventDefault();
  clearFormError("new-wallet-error");
  const nombre = document.getElementById("new-wallet-name").value.trim();
  const moneda = document.getElementById("new-wallet-currency").value;
  if (!nombre) return;

  const base = slugify(nombre);
  const existingIds = carterasCustomCache.map(w => w.id).concat(["ahorro"]);
  let id = base, suffix = 2;
  while (existingIds.includes(id)) id = `${base}_${suffix++}`;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  carterasCustomDocRef().set({ list: carterasCustomCache.concat([{ id, nombre, moneda }]) })
    .then(() => {
      e.target.reset();
      document.getElementById("new-wallet-form").hidden = true;
    })
    .catch(err => showFormError("new-wallet-error", err))
    .finally(() => { submitBtn.disabled = false; });
});

// ================= Herramientas: Exportar =================

function updateExportSummary() {
  const from = document.getElementById("export-from").value;
  const to = document.getElementById("export-to").value;
  const summary = document.getElementById("export-summary");
  if (!from || !to) { summary.textContent = ""; return; }
  const count = financeCache.filter(m => m.date >= from && m.date <= to).length;
  summary.textContent = `Se encontraron ${count} movimiento${count === 1 ? "" : "s"} en ese rango.`;
}

document.getElementById("export-from").addEventListener("input", updateExportSummary);
document.getElementById("export-to").addEventListener("input", updateExportSummary);

document.getElementById("export-form").addEventListener("submit", e => {
  e.preventDefault();
  const from = document.getElementById("export-from").value;
  const to = document.getElementById("export-to").value;
  if (!from || !to) return;
  exportarCsv(from, to);
});

(function initExportDates() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  // valueAsDate usa UTC: en Bolivia, después de las 20:00 marcaba mañana.
  document.getElementById("export-from").value = isoDate(firstOfMonth);
  document.getElementById("export-to").value = isoDate(today);
})();

// ================= Ajustes de Finanzas =================
// Todo lo editable de Finanzas en un solo lugar (engranaje): periodo,
// categorías, carteras, tarjeta, RE-IVA, copias de seguridad y modo demo.
function ajustesDocRef() {
  return raiz().collection("meta").doc("finanzas_ajustes");
}
function guardarAjustes(campos) {
  ajustes = Object.assign({}, ajustes, campos);
  ajustesDocRef().set(campos, { merge: true }).catch(err => console.error("Manolo: no se pudieron guardar los ajustes", err));
  renderAll();
}

// Aviso breve (usa el mismo cartel de "Deshacer", sin botón).
function avisoFin(texto) {
  const el = undoToastEl();
  clearTimeout(undoTimer);
  undoRestore = null;
  el.querySelector(".undo-toast-msg").textContent = texto;
  el.querySelector(".undo-toast-btn").hidden = true;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  undoTimer = setTimeout(() => { hideUndoToast(); el.querySelector(".undo-toast-btn").hidden = false; }, 4000);
}

const hace = t => {
  const dias = Math.floor((Date.now() - t) / 86400000);
  return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
};
const fechaLarga = t => new Date(t).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });

function renderAjustes() {
  const el = document.getElementById("fin-ajustes");
  if (!el) return;
  const ult = ajustes.ultimoRespaldoArchivo;
  const persistente = window.ManoloOffline && window.ManoloOffline.persistente;
  const version = window.ManoloOffline && window.ManoloOffline.version;
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);
  el.innerHTML = `
    ${DEMO ? `<div class="fin-aj-demo-aviso"><strong>Modo demo activo.</strong> Estás viendo datos inventados; tus datos reales no se tocan.</div>` : ""}
    <section class="fin-aj-bloque">
      <h2>Presupuesto</h2>
      <a class="fin-aj-fila" href="#fin-herramientas-periodo"><span><span class="fin-aj-t">Periodo</span><span class="fin-aj-sub">Empieza el día ${budgetStartDay} de cada mes</span></span><span class="fin-aj-chev" data-icon="chevronRight"></span></a>
      <a class="fin-aj-fila" href="#fin-herramientas-categorias"><span><span class="fin-aj-t">Categorías</span><span class="fin-aj-sub">${gastoCategoriesCache.length} de gasto · ${(CATEGORIES.ingreso || []).length} de ingreso</span></span><span class="fin-aj-chev" data-icon="chevronRight"></span></a>
      <a class="fin-aj-fila" href="#fin-recurrentes"><span><span class="fin-aj-t">Pagos recurrentes</span><span class="fin-aj-sub">${recurrentes.length ? `${recurrentes.length} configurado${recurrentes.length === 1 ? "" : "s"}` : "Alquiler, servicios, suscripciones…"}</span></span><span class="fin-aj-chev" data-icon="chevronRight"></span></a>
      <a class="fin-aj-fila" href="#fin-herramientas-reiva"><span><span class="fin-aj-t">RE-IVA</span><span class="fin-aj-sub">Tus compras con factura, mes a mes</span></span><span class="fin-aj-chev" data-icon="chevronRight"></span></a>
      <a class="fin-aj-fila" href="#fin-herramientas-exportar"><span><span class="fin-aj-t">Exportar por fechas</span><span class="fin-aj-sub">CSV de un rango y estado de tus datos</span></span><span class="fin-aj-chev" data-icon="chevronRight"></span></a>
      <a class="fin-aj-fila" href="#fin-herramientas-carteras"><span><span class="fin-aj-t">Carteras</span><span class="fin-aj-sub">Efectivo, Débito, Tarjeta, Ahorro${carterasCustomCache.length ? ` y ${carterasCustomCache.length} más` : ""}</span></span><span class="fin-aj-chev" data-icon="chevronRight"></span></a>
    </section>
    <section class="fin-aj-bloque">
      <h2>Tarjeta y RE-IVA</h2>
      <label class="fin-aj-fila fin-aj-campo"><span><span class="fin-aj-t">Día de pago de la tarjeta</span><span class="fin-aj-sub">En meses más cortos, el último día</span></span>
        <select id="fin-aj-dia-pago" aria-label="Día de pago de la tarjeta">${dias.map(d => `<option value="${d}"${d === diaPagoTarjeta() ? " selected" : ""}>${d}</option>`).join("")}</select></label>
      <label class="fin-aj-fila fin-aj-campo"><span><span class="fin-aj-t">Reintegro RE-IVA</span><span class="fin-aj-sub">Porcentaje estimado de tus compras con factura</span></span>
        <span class="fin-aj-pct"><input type="number" id="fin-aj-reiva" inputmode="decimal" min="0" max="100" step="0.5" value="${(reivaTasa() * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}" aria-label="Porcentaje de reintegro RE-IVA"><span>%</span></span></label>
    </section>
    <section class="fin-aj-bloque">
      <h2>Análisis</h2>
      <label class="fin-aj-fila fin-aj-campo"><span><span class="fin-aj-t">Horas de trabajo al mes</span><span class="fin-aj-sub">Para ver tus gastos en horas de trabajo</span></span>
        <span class="fin-aj-pct"><input type="number" id="fin-aj-horas" inputmode="numeric" min="1" max="744" step="1" value="${horasMes()}" aria-label="Horas de trabajo al mes"><span>h</span></span></label>
      <label class="fin-aj-fila fin-aj-campo"><span><span class="fin-aj-t">Gasto hormiga</span><span class="fin-aj-sub">Gastos pequeños de hasta este monto</span></span>
        <span class="fin-aj-pct"><span>Bs</span><input type="number" id="fin-aj-hormiga" inputmode="decimal" min="1" step="1" value="${FD.aBs(umbralHormigaCent()).toLocaleString("en-US", { maximumFractionDigits: 2 })}" aria-label="Límite de gasto hormiga en bolivianos"></span></label>
    </section>
    <section class="fin-aj-bloque">
      <h2>Copias de seguridad</h2>
      <p class="fin-aj-texto">${ult ? `Último respaldo en archivo: <strong>${hace(ult)}</strong> (${fechaLarga(ult)}).` : "Todavía no guardaste un respaldo en archivo."} Guarda todos tus movimientos, carteras, categorías, presupuesto y ajustes. Al importar solo se agrega lo que falta: nunca se borra ni se cambia nada.</p>
      <div class="fin-aj-botones">
        <button type="button" class="fin-aj-btn is-principal" data-fin-exportar-json><span data-icon="download"></span>Guardar respaldo</button>
        <button type="button" class="fin-aj-btn" data-fin-importar-json>Importar respaldo</button>
        <button type="button" class="fin-aj-btn" data-fin-exportar-csv>Exportar CSV</button>
      </div>
      <p class="fin-aj-texto fin-aj-nota">El CSV trae una fila por movimiento, listo para Excel o Power BI. Para un rango de fechas, usa <a href="#fin-herramientas-exportar">Exportar datos</a>.</p>
    </section>
    <section class="fin-aj-bloque">
      <h2>Tus datos</h2>
      <div id="fin-estado-datos-aj" class="fin-estado-datos" aria-live="polite"></div>
      <p class="fin-aj-texto fin-aj-nota">Almacenamiento del teléfono: ${persistente === true ? "protegido (el sistema no lo borra solo)" : persistente === false ? "sin protección especial (el sistema podría liberarlo si falta espacio; guarda respaldos)" : "revisando…"}.${version ? ` Versión de la app: ${escapeHtml(version)}.` : ""}</p>
    </section>
    <section class="fin-aj-bloque">
      <h2>Modo demo</h2>
      ${DEMO
        ? `<p class="fin-aj-texto">Estás usando 6 meses de datos inventados, guardados solo en este teléfono. Salir los borra y vuelve a tus datos reales.</p>
           <div class="fin-aj-botones"><button type="button" class="fin-aj-btn is-peligro" data-fin-demo-salir>Salir y borrar la demo</button></div>`
        : `<p class="fin-aj-texto">Prueba Finanzas con 6 meses de datos inventados en bolivianos. Se guardan aparte, solo en este teléfono, nunca se mezclan con tus datos y se borran con un toque.</p>
           <div class="fin-aj-botones"><button type="button" class="fin-aj-btn" data-fin-demo-entrar>Probar el modo demo</button></div>`}
    </section>`;
  renderIcons(el);
  renderEstadoDatos();
}

// ---- Copia de seguridad en archivo (JSON) ----
// Copia tal cual de los documentos de meta/ que escuchamos (para armar el
// respaldo al instante: en el iPhone "Compartir" debe abrirse enseguida
// después del toque, sin esperar a la red).
const metaCrudo = {};
function leerMeta() {
  const meta = {};
  FD.META_COPIA.forEach(n => { if (metaCrudo[n]) meta[n] = metaCrudo[n]; });
  return meta;
}
const aJSON = (k, v) => (v && typeof v === "object" && typeof v.toMillis === "function" ? v.toMillis() : v);

// En el iPhone, compartir abre la hoja con "Guardar en Archivos".
function entregarArchivo(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  try {
    const archivo = new File([blob], nombre, { type: tipo });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      return navigator.share({ files: [archivo], title: nombre }).then(() => true).catch(() => false);
    }
  } catch (e) { /* sin compartir: se descarga */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return Promise.resolve(true);
}

function exportarJson() {
  return Promise.resolve(leerMeta()).then(meta => {
    const copia = FD.copiaCompleta({ finanzas: crudos.finanzas, ahorros: crudos.ahorros, carteras_movimientos: crudos.carteras, meta }, Date.now());
    const nombre = `manolo-finanzas${DEMO ? "-DEMO" : ""}-${isoDate(new Date())}.json`;
    return entregarArchivo(nombre, JSON.stringify(copia, aJSON, 1), "application/json").then(ok => {
      if (!ok) return;
      guardarAjustes({ ultimoRespaldoArchivo: Date.now() });
      avisoFin(`Respaldo listo: ${copia.conteos.finanzas} movimientos.`);
    });
  }).catch(err => { console.error("Manolo: no se pudo exportar", err); avisoFin("No se pudo preparar el respaldo."); });
}

const MAX_COPIA_BYTES = 20 * 1024 * 1024;
function importarJson(archivo) {
  if (!archivo) return;
  if (archivo.size > MAX_COPIA_BYTES) { avisoFin("Ese archivo es demasiado grande para ser un respaldo de Finanzas."); return; }
  archivo.text().then(texto => {
    let copia;
    try { copia = JSON.parse(texto); } catch (e) { avisoFin("No se pudo leer el archivo. Elige un respaldo guardado desde Manolo."); return; }
    return Promise.resolve(leerMeta()).then(meta => {
      const plan = FD.planImportacion(copia, { finanzas: crudos.finanzas, ahorros: crudos.ahorros, carteras_movimientos: crudos.carteras, meta });
      if (!plan.ok) { avisoFin(plan.error); return; }
      const r = plan.resumen;
      const fecha = copia.exportado ? fechaLarga(copia.exportado) : "fecha desconocida";
      if (plan.vacio) {
        appDialog({ title: "Nada que importar", message: `El respaldo del ${fecha} no trae nada que no tengas ya.`, confirmLabel: "Entendido" });
        return;
      }
      const partes = [];
      if (r.movimientos) partes.push(`${r.movimientos} movimiento${r.movimientos === 1 ? "" : "s"}`);
      if (r.ahorros) partes.push(`${r.ahorros} de Ahorro`);
      if (r.carteras) partes.push(`${r.carteras} de tus carteras`);
      const NOMBRES_META = { categorias_gasto: "categorías de gasto", categorias_ingreso: "categorías de ingreso", carteras_custom: "carteras", presupuestos: "montos de presupuesto", presupuestos_periodos: "presupuestos por periodo", config_presupuesto: "el periodo del presupuesto", finanzas_ajustes: "tus ajustes" };
      if (r.meta.length) partes.push(r.meta.map(n => NOMBRES_META[n] || n).join(", ") + " que faltaban");
      const msg = `Respaldo del ${fecha}. Se agregará: ${partes.join(", ")}. No se borra ni se cambia nada de lo que ya tienes.${r.descartados ? ` ${r.descartados} registro${r.descartados === 1 ? "" : "s"} dañado${r.descartados === 1 ? "" : "s"} se omitirá${r.descartados === 1 ? "" : "n"}.` : ""}`;
      return appDialog({ title: "Importar respaldo", message: msg, confirmLabel: "Importar" }).then(ok => {
        if (!ok) return;
        aplicarImportacion(plan);
        avisoFin(`Importado: ${partes.join(", ")}.`);
      });
    });
  }).catch(err => { console.error("Manolo: no se pudo importar", err); avisoFin("No se pudo importar el respaldo."); });
}
function aplicarImportacion(plan) {
  const ops = [];
  const ref = { finanzas: id => financeCollection().doc(id), ahorros: id => ahorrosCollection().doc(id), carteras_movimientos: id => carterasMovimientosCollection().doc(id) };
  FD.COLECCIONES.forEach(c => plan.nuevos[c].forEach(x => ops.push(l => l.set(ref[c](x.id), FD.sinId(x)))));
  Object.keys(plan.meta).forEach(n => ops.push(l => l.set(raiz().collection("meta").doc(n), plan.meta[n], { merge: true })));
  // Firestore acepta hasta 500 escrituras por lote.
  for (let i = 0; i < ops.length; i += 400) {
    const lote = nuevoLote();
    ops.slice(i, i + 400).forEach(op => op(lote));
    lote.commit().catch(err => console.error("Manolo: no se pudo importar un lote", err));
  }
}

// ---- CSV limpio: una fila por movimiento ----
const TIPO_CSV = { gasto: "Gasto", ingreso: "Ingreso", transferencia: "Transferencia", pago_tarjeta: "Pago de tarjeta", ajuste_tarjeta: "Ajuste de tarjeta" };
const ENCABEZADOS_CSV = ["Fecha", "Tipo", "Categoría", "Sección", "Cartera", "Cartera destino", "Monto", "Moneda", "Monto destino", "Moneda destino", "Nota", "Con factura", "Excluido del presupuesto", "Id"];
function filasCsv(desde, hasta) {
  const dentro = f => f >= desde && f <= hasta;
  const enlazados = new Set();
  financeCache.forEach(m => (m.links || []).forEach(l => enlazados.add(l.id)));
  const pago = id => { const p = findPayment(id); return p ? p.label : ""; };
  const filas = [];
  financeCache.filter(m => dentro(m.date)).forEach(m => {
    const esMovimiento = m.type === "gasto" || m.type === "ingreso";
    const cat = esMovimiento ? findCategory(m.type, m.category).label : "";
    const grupo = m.type === "gasto" ? ((categoryGroupsCache.find(g => (g.items || []).some(i => i.id === m.category)) || {}).nombre || "") : "";
    let cartera = "", destino = "", moneda = "Bs", montoDest = "", monedaDest = "";
    if (esMovimiento) cartera = pago(m.payment);
    else if (m.type === "pago_tarjeta") { cartera = pago(m.payment); destino = "Tarjeta de Crédito"; }
    else if (m.type === "ajuste_tarjeta") destino = "Tarjeta de Crédito";
    else if (m.type === "transferencia") {
      cartera = walletLabel(m.from); destino = walletLabel(m.to);
      moneda = walletCurrency(m.from); monedaDest = walletCurrency(m.to);
      montoDest = FD.montoCsv(m.montoDestinoCent != null ? m.montoDestinoCent : m.montoCent);
    }
    filas.push({ f: m.date, t: m.createdAt || 0, v: [m.date, TIPO_CSV[m.type] || m.type, cat, grupo, cartera, destino, FD.montoCsv(m.montoCent), moneda, montoDest, monedaDest, m.desc || "", m.factura ? "Sí" : "No", m.excluded ? "Sí" : "No", m.id] });
  });
  // Movimientos de Ahorro y de tus carteras que no vienen de una transferencia.
  const suelto = (fecha, cent, carteraId, nota, id, creado) => {
    if (!dentro(fecha || "") || enlazados.has(id)) return;
    filas.push({ f: fecha, t: creado || 0, v: [fecha, cent >= 0 ? "Entrada a cartera" : "Salida de cartera", "", "", walletLabel(carteraId), "", FD.montoCsv(Math.abs(cent)), walletCurrency(carteraId), "", "", nota || "", "No", "No", id] });
  };
  ahorrosCache.forEach(a => suelto(a.date, a.montoCent, "ahorro", a.notes, a.id, a.createdAt));
  carterasMovCache.forEach(c => suelto(c.fecha, c.montoCent, c.carteraId, c.nota, c.id, c.createdAt));
  return filas.sort((a, b) => a.f.localeCompare(b.f) || a.t - b.t).map(x => x.v);
}
function exportarCsv(desde, hasta) {
  const filas = filasCsv(desde, hasta);
  const nombre = `manolo-finanzas${DEMO ? "-DEMO" : ""}_${desde}_a_${hasta}.csv`;
  entregarArchivo(nombre, FD.aCsv(ENCABEZADOS_CSV, filas), "text/csv;charset=utf-8");
}
function rangoCompleto() {
  const fechas = financeCache.map(m => m.date).concat(ahorrosCache.map(a => a.date), carterasMovCache.map(c => c.fecha)).filter(Boolean).sort();
  return [fechas[0] || isoDate(new Date()), isoDate(new Date()) > (fechas[fechas.length - 1] || "") ? isoDate(new Date()) : fechas[fechas.length - 1]];
}

// ---- Recordatorio de respaldo (más de 14 días) ----
const DIAS_RECORDATORIO = 14;
const CLAVE_POSPUESTO = "manolo.finanzas.recordatorioHasta";
function renderRecordatorio() {
  const el = document.getElementById("fin-recordatorio");
  if (!el) return;
  let pospuesto = 0;
  try { pospuesto = Number(localStorage.getItem(CLAVE_POSPUESTO)) || 0; } catch (e) { /* sin almacenamiento */ }
  const ult = ajustes.ultimoRespaldoArchivo;
  const vencido = !ult || Date.now() - ult > DIAS_RECORDATORIO * 86400000;
  const mostrar = !DEMO && ajustesCargados && financeCache.length > 0 && vencido && Date.now() > pospuesto;
  el.hidden = !mostrar;
  if (!mostrar) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <span class="fin-rec-ico" data-icon="download"></span>
    <div class="fin-rec-txt"><strong>${ult ? `Tu último respaldo fue ${hace(ult)}` : "Guarda tu primer respaldo"}</strong><span>Un archivo con todas tus finanzas, por si pierdes el teléfono.</span></div>
    <div class="fin-rec-acciones">
      <button type="button" class="fin-aj-btn is-principal" data-fin-exportar-json>Respaldar</button>
      <button type="button" class="fin-aj-btn is-texto" data-fin-rec-posponer aria-label="Recordármelo en 3 días">Más tarde</button>
    </div>`;
  renderIcons(el);
}

// ---- Aviso de modo demo y tarjeta de perfil ----
function renderDemoBanner() {
  const el = document.getElementById("fin-demo-banner");
  if (!el) return;
  el.hidden = !DEMO;
  if (!DEMO || el.dataset.listo) return;
  el.dataset.listo = "1";
  el.innerHTML = `<span><strong>Modo demo</strong> · datos inventados</span><button type="button" class="fin-demo-salir" data-fin-demo-salir>Salir</button>`;
}
function renderPerfil() {
  const nombre = document.getElementById("fin-perfil-nombre");
  const inicial = document.getElementById("fin-perfil-inicial");
  if (!nombre || !inicial) return;
  // El nombre sale del usuario con el que entraste (no se guarda en el código).
  const usuario = DEMO ? "Modo demo" : (currentUser && currentUser.email ? currentUser.email.split("@")[0] : "Tu cuenta");
  const limpio = usuario.charAt(0).toUpperCase() + usuario.slice(1);
  nombre.textContent = limpio;
  inicial.textContent = limpio.charAt(0);
}

function entrarDemo() {
  appDialog({ title: "Probar el modo demo", message: "Vas a ver 6 meses de datos inventados. Tus datos reales quedan intactos en la nube. Para volver, toca «Salir» arriba o en Ajustes.", confirmLabel: "Probar" })
    .then(ok => {
      if (!ok) return;
      FinanzasDemo.activar();
      location.hash = "#finanzas";
      location.reload();
    });
}
function salirDemo() {
  FinanzasDemo.salir();
  location.reload();
}

// Botones de Ajustes, recordatorio y aviso demo (delegados).
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-fin-exportar-json], [data-fin-importar-json], [data-fin-exportar-csv], [data-fin-demo-entrar], [data-fin-demo-salir], [data-fin-rec-posponer]");
  if (!t) return;
  if (t.hasAttribute("data-fin-exportar-json")) exportarJson();
  else if (t.hasAttribute("data-fin-importar-json")) { const inp = document.getElementById("fin-importar-archivo"); inp.value = ""; inp.click(); }
  else if (t.hasAttribute("data-fin-exportar-csv")) { const [a, b] = rangoCompleto(); exportarCsv(a, b); }
  else if (t.hasAttribute("data-fin-demo-entrar")) entrarDemo();
  else if (t.hasAttribute("data-fin-demo-salir")) salirDemo();
  else if (t.hasAttribute("data-fin-rec-posponer")) {
    try { localStorage.setItem(CLAVE_POSPUESTO, String(Date.now() + 3 * 86400000)); } catch (err) { /* sin almacenamiento */ }
    renderRecordatorio();
  }
});
document.getElementById("fin-importar-archivo").addEventListener("change", e => importarJson(e.target.files && e.target.files[0]));
document.getElementById("fin-ajustes").addEventListener("change", e => {
  if (e.target.id === "fin-aj-dia-pago") guardarAjustes({ diaPagoTarjeta: Number(e.target.value) });
  if (e.target.id === "fin-aj-horas") {
    const v = Math.round(Number(e.target.value));
    if (v >= 1 && v <= 744) guardarAjustes({ horasMes: v });
    else { e.target.value = String(horasMes()); avisoFin("Escribe un número de horas entre 1 y 744."); }
  }
  if (e.target.id === "fin-aj-hormiga") {
    const v = Number(String(e.target.value).replace(",", "."));
    if (Number.isFinite(v) && v > 0) guardarAjustes({ umbralHormiga: FD.aBs(FD.aCentavos(v)) });
    else { e.target.value = String(FD.aBs(umbralHormigaCent())); avisoFin("Escribe un monto mayor que cero."); }
  }
  if (e.target.id === "fin-aj-reiva") {
    const v = Number(String(e.target.value).replace(",", "."));
    if (Number.isFinite(v) && v >= 0 && v <= 100) guardarAjustes({ reivaPct: v });
    else { e.target.value = String(reivaTasa() * 100); avisoFin("Escribe un porcentaje entre 0 y 100."); }
  }
});

// ---- Cambiar de periodo deslizando a los lados ----
(function deslizarPeriodo() {
  const IGNORAR = ".txn-swipe, .fin-carteras, .vg-chart-wrap, .txn-chips, .txn-filtros-activos, input, select, textarea, .fin-pendientes, .gasto-ring, .an-barras";
  ["panel-fin-movimientos", "panel-fin-analisis", "panel-fin-presupuesto"].forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;
    let t0 = null;
    panel.addEventListener("touchstart", e => {
      t0 = e.touches.length === 1 && !e.target.closest(IGNORAR) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    panel.addEventListener("touchend", e => {
      if (!t0) return;
      const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y;
      t0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) cambiarPeriodo(dx < 0 ? 1 : -1);
    }, { passive: true });
  });
})();

// ================= Pagos recurrentes =================
// Se guardan en meta/finanzas_recurrentes. En su fecha aparecen como
// «pendientes de confirmar»: Confirmar crea el movimiento (con recurrenteId
// y recurrenteFecha), Omitir lo salta, y tocar el nombre abre la hoja para
// ajustar el monto antes de guardar.
let recurrentes = [];
function recDocRef() {
  return raiz().collection("meta").doc("finanzas_recurrentes");
}
function guardarRecurrentes(lista) {
  recurrentes = lista;
  recDocRef().set({ list: lista }, { merge: true }).catch(err => console.error("Manolo: no se pudieron guardar los recurrentes", err));
  renderAll();
}
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function textoFrecuencia(r) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.inicio || "")) return "";
  const d = new Date(r.inicio + "T12:00:00");
  if (r.frecuencia === "semanal") return `Cada ${DIAS_SEMANA[d.getDay()]}`;
  if (r.frecuencia === "anual") return `Cada año, el ${d.getDate()} de ${d.toLocaleDateString("es-ES", { month: "long" })}`;
  return `Cada mes, el día ${d.getDate()}`;
}
function textoAtraso(fecha) {
  const hoy = isoDate(new Date());
  const dias = Math.round((new Date(hoy + "T12:00:00") - new Date(fecha + "T12:00:00")) / 86400000);
  if (dias <= 0) return fecha === hoy ? "Vence hoy" : `Vence ${dayLabel(fecha).toLowerCase()}`;
  if (dias === 1) return "Venció ayer";
  return `Venció hace ${dias} días`;
}
function renderPendientes() {
  const el = document.getElementById("fin-pendientes");
  if (!el) return;
  const pend = FD.pendientesRecurrentes(recurrentes, financeCache, isoDate(new Date()), 45);
  el.hidden = !pend.length;
  if (!pend.length) { el.innerHTML = ""; return; }
  const visibles = pend.slice(0, 4);
  el.innerHTML = `
    <h2 id="fin-pendientes-t" class="fin-pend-t">Pendientes de confirmar <span class="fin-pend-n">${pend.length}</span></h2>
    <ul class="fin-pend-lista">${visibles.map(p => {
      const cat = findCategory(p.rec.type, p.rec.category);
      return `<li class="fin-pend-fila">
        <button type="button" class="fin-pend-info" data-pend-abrir="${escapeHtml(p.rec.id)}" data-fecha="${p.fecha}" aria-label="Revisar ${escapeHtml(p.rec.nombre)} antes de confirmar">
          ${txnIconHTML(cat)}
          <span class="fin-pend-txt"><span class="fin-pend-nombre">${escapeHtml(p.rec.nombre)}</span><span class="fin-pend-sub${p.atraso > 0 ? " is-atrasado" : ""}">${textoAtraso(p.fecha)} · ${p.rec.type === "ingreso" ? "+" : ""}${formatBsShort(FD.aBs(p.rec.montoCent || 0))}</span></span>
        </button>
        <span class="fin-pend-acciones">
          <button type="button" class="fin-pend-omitir" data-pend-omitir="${escapeHtml(p.rec.id)}" data-fecha="${p.fecha}" aria-label="Omitir ${escapeHtml(p.rec.nombre)} del ${fechaCorta(p.fecha)}">Omitir</button>
          <button type="button" class="fin-pend-ok" data-pend-confirmar="${escapeHtml(p.rec.id)}" data-fecha="${p.fecha}" aria-label="Confirmar ${escapeHtml(p.rec.nombre)} del ${fechaCorta(p.fecha)}"><span data-icon="check"></span>Confirmar</button>
        </span>
      </li>`;
    }).join("")}</ul>
    ${pend.length > visibles.length ? `<a class="fin-pend-mas" href="#fin-recurrentes">Y ${pend.length - visibles.length} más</a>` : ""}`;
  renderIcons(el);
}
function fechaCorta(f) {
  return new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}
function confirmarPendiente(recId, fecha) {
  const r = recurrentes.find(x => x.id === recId);
  if (!r) return;
  const ref = financeCollection().doc();
  const datos = FD.conCentavos({ date: fecha, type: r.type, category: r.category, payment: r.payment, desc: r.nombre, amount: FD.aBs(r.montoCent || 0), excluded: false, factura: false, recurrenteId: r.id, recurrenteFecha: fecha, createdAt: Date.now() });
  ref.set(datos).catch(err => console.error("Manolo: no se pudo confirmar", err));
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* sin vibración */ }
  showUndoToast(`${r.nombre} confirmado`, () => ref.delete());
}
function omitirPendiente(recId, fecha) {
  const r = recurrentes.find(x => x.id === recId);
  if (!r) return;
  const cambiar = omitidos => guardarRecurrentes(recurrentes.map(x => x.id === recId ? Object.assign({}, x, { omitidos }) : x));
  const antes = (r.omitidos || []).slice();
  cambiar(antes.concat([fecha]));
  showUndoToast(`${r.nombre} del ${fechaCorta(fecha)} omitido`, () => cambiar(antes));
}
document.getElementById("fin-pendientes").addEventListener("click", e => {
  const ok = e.target.closest("[data-pend-confirmar]");
  if (ok) { confirmarPendiente(ok.dataset.pendConfirmar, ok.dataset.fecha); return; }
  const om = e.target.closest("[data-pend-omitir]");
  if (om) { omitirPendiente(om.dataset.pendOmitir, om.dataset.fecha); return; }
  const ab = e.target.closest("[data-pend-abrir]");
  if (ab) {
    const r = recurrentes.find(x => x.id === ab.dataset.pendAbrir);
    if (!r) return;
    openTxnSheet(null, { type: r.type, category: r.category, payment: r.payment, desc: r.nombre, date: ab.dataset.fecha,
      amount: String(FD.aBs(r.montoCent || 0)).replace(".", ","), recurrenteId: r.id, recurrenteFecha: ab.dataset.fecha });
  }
});

// ---- Lista de recurrentes y hoja para crear o editar ----
function renderRecurrentes() {
  const el = document.getElementById("fin-recurrentes-lista");
  if (!el) return;
  const hoy = isoDate(new Date());
  el.innerHTML = recurrentes.length ? recurrentes.slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))).map(r => {
    const cat = findCategory(r.type, r.category);
    const sig = r.activo === false ? null : FD.siguienteFecha(r, hoy);
    return `<button type="button" class="fin-rec-fila${r.activo === false ? " is-pausado" : ""}" data-rec-editar="${escapeHtml(r.id)}">
      ${txnIconHTML(cat)}
      <span class="fin-pend-txt"><span class="fin-pend-nombre">${escapeHtml(r.nombre)}</span>
        <span class="fin-pend-sub">${textoFrecuencia(r)}${r.activo === false ? " · En pausa" : sig ? ` · Próximo: ${fechaCorta(sig)}` : ""}</span></span>
      <span class="fin-rec-monto">${r.type === "ingreso" ? "+" : ""}${formatBsShort(FD.aBs(r.montoCent || 0))}</span>
    </button>`;
  }).join("") : `<p class="empty-state">Todavía no tienes pagos recurrentes. Crea uno aquí, o marca «Repetir» al registrar un gasto.</p>`;
  renderIcons(el);
}
let recEditando = null;
function abrirRec(id) {
  const r = id ? recurrentes.find(x => x.id === id) : null;
  recEditando = r ? Object.assign({}, r) : { id: null, nombre: "", type: "gasto", category: null, payment: ultimaCartera("gasto"), montoCent: 0, frecuencia: "mensual", inicio: isoDate(new Date()), activo: true, omitidos: [] };
  renderRecForm();
  document.getElementById("rec-sheet-title").textContent = r ? "Editar pago recurrente" : "Nuevo pago recurrente";
  document.getElementById("rec-borrar").hidden = !r;
  showSheet(document.getElementById("rec-sheet"));
}
function renderRecForm() {
  const r = recEditando;
  const secciones = r.type === "ingreso" ? [{ title: "Ingresos", items: CATEGORIES.ingreso || [] }] : catSheetSections("gasto");
  const pagos = r.type === "ingreso" ? PAYMENTS.filter(p => p.id !== "credito") : PAYMENTS;
  document.getElementById("rec-form").innerHTML = `
    <label class="rec-campo">Nombre<input type="text" name="nombre" maxlength="40" value="${escapeHtml(r.nombre)}" placeholder="Alquiler" autocomplete="off"></label>
    <label class="rec-campo">Monto (Bs)<input type="text" name="monto" inputmode="decimal" value="${escapeHtml(r.montoTexto != null ? r.montoTexto : r.montoCent ? String(FD.aBs(r.montoCent)).replace(".", ",") : "")}" placeholder="0" autocomplete="off"></label>
    <h4>Tipo</h4>
    <div class="txn-filtro-chips" role="radiogroup">
      <button type="button" class="fin-tab${r.type === "gasto" ? " active" : ""}" role="radio" aria-checked="${r.type === "gasto"}" data-rec-tipo="gasto">Gasto</button>
      <button type="button" class="fin-tab${r.type === "ingreso" ? " active" : ""}" role="radio" aria-checked="${r.type === "ingreso"}" data-rec-tipo="ingreso">Ingreso</button>
    </div>
    <label class="rec-campo">Categoría<select name="category" class="txn-filtro-select">
      <option value="">Elige una</option>
      ${secciones.map(sec => `<optgroup label="${escapeHtml(sec.title)}">${sec.items.map(c => `<option value="${escapeHtml(c.id)}"${r.category === c.id ? " selected" : ""}>${escapeHtml(c.label)}</option>`).join("")}</optgroup>`).join("")}
    </select></label>
    <label class="rec-campo">${r.type === "ingreso" ? "Entra a" : "Se paga con"}<select name="payment" class="txn-filtro-select">
      ${pagos.map(p => `<option value="${p.id}"${r.payment === p.id ? " selected" : ""}>${p.label}</option>`).join("")}
    </select></label>
    <label class="rec-campo">Se repite<select name="frecuencia" class="txn-filtro-select">
      <option value="mensual"${r.frecuencia === "mensual" ? " selected" : ""}>Cada mes</option>
      <option value="semanal"${r.frecuencia === "semanal" ? " selected" : ""}>Cada semana</option>
      <option value="anual"${r.frecuencia === "anual" ? " selected" : ""}>Cada año</option>
    </select></label>
    <label class="rec-campo">Primera fecha<input type="date" name="inicio" value="${r.inicio}"></label>
    <p class="fin-aj-texto">${textoFrecuencia(r)}.</p>
    ${r.id ? `<label class="budget-sheet-row txn-toggle-row rec-activo"><span class="txn-toggle-label">Activo</span><input type="checkbox" name="activo" class="switch"${r.activo !== false ? " checked" : ""}></label>` : ""}
    <p class="txn-sheet-error" id="rec-error" role="alert" hidden></p>`;
}
function leerRecForm() {
  const f = document.getElementById("rec-form");
  const r = recEditando;
  r.nombre = f.nombre.value.trim();
  r.montoTexto = f.monto.value;
  r.category = f.category.value || null;
  r.payment = f.payment.value;
  r.frecuencia = f.frecuencia.value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.inicio.value)) r.inicio = f.inicio.value;
  if (f.activo) r.activo = f.activo.checked;
}
function guardarRec() {
  leerRecForm();
  const r = recEditando;
  const cent = FD.evaluarMonto(String(r.montoTexto || "").replace(/\./g, ","));
  const err = !r.nombre ? "Ponle un nombre." : !(cent > 0) ? "Escribe un monto mayor que cero." : !r.category ? "Elige una categoría." : null;
  const el = document.getElementById("rec-error");
  if (err) { el.hidden = false; el.textContent = err; return; }
  const limpio = { id: r.id || "rec_" + Date.now().toString(36), nombre: r.nombre, type: r.type, category: r.category, payment: r.payment,
    montoCent: cent, amount: FD.aBs(cent), frecuencia: r.frecuencia, inicio: r.inicio, activo: r.activo !== false, omitidos: r.omitidos || [], creado: r.creado || Date.now() };
  guardarRecurrentes(r.id ? recurrentes.map(x => x.id === r.id ? limpio : x) : recurrentes.concat([limpio]));
  hideSheet(document.getElementById("rec-sheet"));
  avisoFin(`«${limpio.nombre}» guardado: ${textoFrecuencia(limpio).toLowerCase()}.`);
}
function borrarRec() {
  const r = recurrentes.find(x => x.id === recEditando.id);
  if (!r) return;
  const antes = recurrentes.slice();
  guardarRecurrentes(recurrentes.filter(x => x.id !== r.id));
  hideSheet(document.getElementById("rec-sheet"));
  // Los movimientos ya confirmados no se borran.
  showUndoToast(`«${r.nombre}» eliminado`, () => guardarRecurrentes(antes));
}
document.getElementById("panel-fin-recurrentes").addEventListener("click", e => {
  const ed = e.target.closest("[data-rec-editar]");
  if (ed) { abrirRec(ed.dataset.recEditar); return; }
  if (e.target.closest("[data-rec-nuevo]")) abrirRec(null);
});
document.getElementById("rec-sheet").addEventListener("click", e => {
  const t = e.target.closest("[data-rec-tipo]");
  if (t) {
    leerRecForm();
    if (recEditando.type !== t.dataset.recTipo) { recEditando.type = t.dataset.recTipo; recEditando.category = null; if (recEditando.type === "ingreso" && recEditando.payment === "credito") recEditando.payment = "debito"; }
    renderRecForm();
    return;
  }
  if (e.target.closest("#rec-guardar")) { guardarRec(); return; }
  if (e.target.closest("#rec-borrar")) { borrarRec(); return; }
  if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) hideSheet(document.getElementById("rec-sheet"));
});
document.getElementById("rec-sheet").addEventListener("change", e => {
  if (e.target.name === "frecuencia" || e.target.name === "inicio") { leerRecForm(); renderRecForm(); }
});

// ================= Tabs =================

// Pestañas internas de Presupuesto (Planificación/Restante/Información).
document.querySelectorAll("[data-budget-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-budget-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("budget-tab-planificacion").hidden = btn.dataset.budgetTab !== "planificacion";
    document.getElementById("budget-tab-restante").hidden = btn.dataset.budgetTab !== "restante";
    document.getElementById("budget-tab-informacion").hidden = btn.dataset.budgetTab !== "informacion";
  });
});

// ================= Init =================

// Cada parte se dibuja por separado: si una falla (por ejemplo, por un dato
// viejo con un formato raro), las demás siguen apareciendo.
const RENDERERS = [
  renderStats, updateMonthLabel, renderMovements, renderGasto, renderAnalisis, renderVistaGeneral,
  updateBudgetMonthLabel, renderBudgets, renderBudgetInputs, renderBudgetSummary, renderBudgetInfo,
  renderPresHerramientas, renderCategoryGroups, renderPeriodSettings, renderWallets, updateExportSummary, renderReiva, renderEstadoDatos,
  renderAjustes, renderRecordatorio, renderDemoBanner, renderPerfil, renderPendientes, renderRecurrentes
];
// Finanzas solo se dibuja cuando se ve: si estás en otra sección, los
// cambios quedan marcados y se dibujan al entrar (así no frena el resto de
// Manolo, sobre todo al abrir la app). Los avisos de Firestore que llegan
// juntos se agrupan en un solo dibujo por cuadro.
let renderPendiente = false;
let renderProgramado = false;
function finanzasVisible() {
  return !!document.querySelector('#panel-finanzas:not([hidden]), [id^="panel-fin-"]:not([hidden])');
}
function renderAll() {
  if (!finanzasVisible()) { renderPendiente = true; return; }
  renderPendiente = false;
  try { sincronizarPresupuesto(); } catch (err) { console.error("Manolo: falló el presupuesto del periodo", err); }
  RENDERERS.forEach(fn => {
    try { fn(); } catch (err) { console.error("Manolo: falló " + fn.name, err); }
  });
}
// ---- Montos que siempre caben ----
// Si un número no entra en su espacio (montos grandes o pantallas chicas),
// se achica la letra lo justo para que entre, sin cortarlo ni encimarse.
const NUMEROS_AJUSTABLES = [".txn-summary strong", ".an-kpi strong", ".gasto-center-value", ".vg-big",
  ".remain-gauge-value", ".fin-cartera-valor", ".pres-card-queda", ".budget-summary-value", ".cat-detail-remaining"].join(", ");
function ajustarNumeros(raizEl) {
  const els = (raizEl || document).querySelectorAll(NUMEROS_AJUSTABLES);
  els.forEach(el => { el.style.fontSize = ""; });
  // Cuánto hay que achicar cada uno (1 = cabe).
  const escala = new Map();
  els.forEach(el => {
    const ancho = el.clientWidth;
    escala.set(el, !ancho || el.scrollWidth <= ancho + 1 ? 1 : Math.max(ancho / el.scrollWidth * 0.97, 0.5));
  });
  // Los números de una misma fila (Ingresos · Gastos · Saldo, los cuadritos
  // de Análisis) quedan todos del mismo tamaño: el del que más se achicó.
  document.querySelectorAll(".txn-summary, .an-kpis").forEach(grupo => {
    const miembros = Array.from(grupo.querySelectorAll(NUMEROS_AJUSTABLES)).filter(el => escala.has(el));
    const min = Math.min(1, ...miembros.map(el => escala.get(el)));
    miembros.forEach(el => escala.set(el, min));
  });
  els.forEach(el => {
    const k = escala.get(el);
    if (k < 1) el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * k).toFixed(2)}px`;
  });
}
let ajustePendiente = false;
function pedirAjusteNumeros() {
  if (ajustePendiente) return;
  ajustePendiente = true;
  requestAnimationFrame(() => { ajustePendiente = false; if (finanzasVisible()) ajustarNumeros(); });
}
window.addEventListener("resize", pedirAjusteNumeros);
window.addEventListener("hashchange", pedirAjusteNumeros);
new MutationObserver(pedirAjusteNumeros).observe(document.getElementById("app-content") || document.body, { childList: true, subtree: true });

function pedirRender() {
  if (!finanzasVisible()) { renderPendiente = true; return; }
  if (renderProgramado) return;
  renderProgramado = true;
  requestAnimationFrame(() => { renderProgramado = false; renderAll(); });
}
// Al entrar a cualquier pantalla de Finanzas se dibuja lo pendiente antes de
// que se vea (el observador corre antes de pintar).
new MutationObserver(() => { if (renderPendiente && finanzasVisible()) renderAll(); })
  .observe(document.querySelector(".main") || document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });


// ================= Categorías con color fijo y categorías nuevas =================
// Antes el color de cada sección dependía de su posición (al reordenar,
// cambiaba). Una sola vez se guarda el color actual de cada sección y se
// agregan las categorías nuevas que falten (si ya tienes una con el mismo
// nombre, no se duplica). Queda marcado en meta/finanzas_esquema.
const CATEGORIAS_NUEVAS = [
  { id: "inversiones_ahorros", nombre: "Inversiones y ahorros", color: "#2fa37a", items: [{ id: "inversiones_ahorros", label: "Inversiones y ahorros", icon: "bank", tipo: "ahorro" }] },
  { id: "educacion", nombre: "Educación", color: "#5b7fe0", items: [{ id: "educacion", label: "Educación", icon: "education", tipo: "variable" }] },
  { id: "higiene", nombre: "Higiene y fragancias", color: "#e38fb8", items: [{ id: "higiene", label: "Higiene y fragancias", icon: "otherCategory", emoji: "🧴", tipo: "variable" }] },
  { id: "mascotas", nombre: "Mascotas", color: "#b98a5b", items: [{ id: "mascotas", label: "Mascotas", icon: "pet", tipo: "variable" }] },
  { id: "ropa", nombre: "Ropa", color: "#e07a5f", items: [{ id: "ropa", label: "Ropa", icon: "shopping", emoji: "👕", tipo: "variable" }] }
];
let categoriasDelServidor = false, migrandoCategorias = false;
function migrarCategoriasFijas() {
  if (migrandoCategorias || !categoriasDelServidor || !esquemaCargado || (esquema && esquema.categoriasFijas)) return;
  if (!DEMO && !(esquema && esquema.respaldo)) return; // primero el respaldo automático
  migrandoCategorias = true;
  const norm = t => normalizeText(String(t || "")).trim();
  const ids = new Set(), nombres = new Set();
  categoryGroupsCache.forEach(g => {
    ids.add(g.id); nombres.add(norm(g.nombre));
    (g.items || []).forEach(i => { ids.add(i.id); nombres.add(norm(i.label)); });
  });
  const fijos = categoryGroupsCache.map(g => Object.assign({}, g, { color: groupColor(g) }));
  const nuevos = CATEGORIAS_NUEVAS.filter(g => !ids.has(g.id) && !nombres.has(norm(g.nombre)) && !g.items.some(i => nombres.has(norm(i.label))));
  const next = fijos.concat(nuevos);
  const lote = nuevoLote();
  lote.set(categoriasDocRef(), { groups: next }, { merge: true });
  lote.set(metaDocRef("finanzas_esquema"), { categoriasFijas: { fecha: Date.now(), agregadas: nuevos.map(g => g.id) } }, { merge: true });
  categoryGroupsCache = next;
  gastoCategoriesCache = flattenCategoryGroups(next);
  // Una sola vez por sesión (aunque el aviso del esquema tarde en llegar).
  lote.commit().catch(err => { console.error("Manolo: no se pudieron fijar las categorías", err); migrandoCategorias = false; });
  pedirRender();
}

// ================= Respaldo automático y verificación =================
// La primera vez que llegan tus datos desde el servidor (completos, no solo
// la copia del teléfono) se guarda un respaldo de TODO Finanzas en
// users/{tu usuario}/finanzas_respaldos, antes de escribir nada con el
// formato nuevo. Los documentos originales nunca se reescriben.
function metaDocRef(nombre) {
  return raiz().collection("meta").doc(nombre);
}
function respaldosCollection() {
  return raiz().collection("finanzas_respaldos");
}
const crudos = { finanzas: [], ahorros: [], carteras: [] };      // tal como están en Firestore
const delServidor = { finanzas: false, ahorros: false, carteras: false };
let esquema = null, esquemaCargado = false, respaldando = false, respaldoError = null;

function verificacionActual() {
  return FD.verificar(crudos.finanzas, financeCache);
}
function intentarRespaldo() {
  if (DEMO) return;
  if (respaldando || !esquemaCargado || (esquema && esquema.respaldo)) return;
  if (!delServidor.finanzas || !delServidor.ahorros || !delServidor.carteras) return;
  respaldando = true;
  const nombres = ["config_presupuesto", "presupuestos", "categorias_gasto", "categorias_ingreso", "categorias_personalizadas", "carteras_custom", "finanzas_ajustes", "finanzas_recurrentes"];
  Promise.all(nombres.map(n => metaDocRef(n).get({ source: "server" }).then(d => [n, d.exists ? d.data() : null])))
    .then(pares => {
      const meta = {};
      pares.forEach(([n, v]) => { if (v) meta[n] = v; });
      const r = FD.crearRespaldo({ finanzas: crudos.finanzas, ahorros: crudos.ahorros, carteras_movimientos: crudos.carteras, meta }, Date.now());
      const id = `${FD.isoLocal(new Date())}-${Date.now().toString(36)}`;
      const v = verificacionActual();
      const lote = nuevoLote();
      r.partes.forEach((parte, i) => lote.set(respaldosCollection().doc(`${id}-${String(i).padStart(3, "0")}`),
        { respaldo: id, parte: i, partes: r.partes.length, coleccion: parte.coleccion, desde: parte.desde, docs: parte.docs }));
      lote.set(metaDocRef("finanzas_esquema"), {
        version: FD.ESQUEMA,
        respaldo: Object.assign({ id }, r.resumen),
        verificacion: { ok: v.ok, total: v.total, conDecimalesExtra: v.conDecimalesExtra, porTipo: v.porTipo, fecha: Date.now() }
      }, { merge: true });
      return lote.commit();
    })
    .then(() => { respaldoError = null; })
    .catch(err => { respaldoError = (err && err.message) || String(err); console.error("Manolo: no se pudo guardar el respaldo", err); })
    .finally(() => { respaldando = false; pedirRender(); });
}

// Estado de tus datos (en Herramientas → Exportar).
function renderEstadoDatos() {
  ["fin-estado-datos", "fin-estado-datos-aj"].forEach(id => { const el = document.getElementById(id); if (el) pintarEstadoDatos(el); });
}
function pintarEstadoDatos(el) {
  const v = verificacionActual();
  const fmtFecha = t => new Date(t).toLocaleString("es-BO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const tipos = { gasto: "Gastos", ingreso: "Ingresos", transferencia: "Transferencias", pago_tarjeta: "Pagos de tarjeta", ajuste_tarjeta: "Ajustes de tarjeta" };
  const r = esquema && esquema.respaldo;
  const respaldo = DEMO ? "Modo demo: estos datos son inventados y viven solo en este teléfono (no se respaldan en la nube)."
    : r
    ? `Respaldo automático del ${fmtFecha(r.creado)}: ${r.conteos.finanzas} movimientos, ${r.conteos.ahorros} de Ahorro y ${r.conteos.carteras_movimientos} de tus carteras.`
    : respaldoError ? `No se pudo guardar el respaldo automático: ${escapeHtml(respaldoError)}. Se vuelve a intentar al abrir la app.`
      : "El respaldo automático se guarda la primera vez que abras Finanzas con internet.";
  el.innerHTML = `
    <div class="fin-estado-fila ${v.ok ? "ok" : "mal"}">
      <span class="fin-estado-ico" data-icon="${v.ok ? "check" : "close"}"></span>
      <span><strong>${v.ok ? "Datos verificados" : "Revisar datos"}</strong>: ${v.total} movimientos, totales ${v.ok ? "iguales" : "distintos"} al guardarse en centavos.</span>
    </div>
    <ul class="fin-estado-lista">${v.porTipo.map(f => `<li><span>${tipos[f.tipo] || escapeHtml(f.tipo)} (${f.n})</span><span>${formatMoney(FD.aBs(f.centAdaptado))}</span></li>`).join("")}</ul>
    ${v.conDecimalesExtra ? `<p class="fin-estado-nota">${v.conDecimalesExtra} monto${v.conDecimalesExtra === 1 ? " tenía" : "s tenían"} más de 2 decimales y se ${v.conDecimalesExtra === 1 ? "muestra" : "muestran"} redondeado${v.conDecimalesExtra === 1 ? "" : "s"} al centavo (el original no cambia).</p>` : ""}
    <p class="fin-estado-nota">${respaldo}</p>`;
  renderIcons(el);
}

onAuthReady(() => {
  // includeMetadataChanges: para saber cuándo los datos ya vienen del
  // servidor (completos) y recién ahí hacer el respaldo.
  financeCollection().onSnapshot({ includeMetadataChanges: true }, snap => {
    if (!snap.metadata || !snap.metadata.fromCache) delServidor.finanzas = true;
    const cambios = typeof snap.docChanges === "function" ? snap.docChanges().length : 1;
    if (cambios || !crudos.finanzas.length) {
      crudos.finanzas = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      financeCache = crudos.finanzas.map(d => FD.adaptarMovimiento(d.id, d));
      pedirRender();
    }
    intentarRespaldo();
  });
  recDocRef().onSnapshot(doc => {
    metaCrudo.finanzas_recurrentes = doc.exists ? doc.data() : null;
    recurrentes = (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list.filter(r => r && r.id) : [];
    pedirRender();
  });
  ajustesDocRef().onSnapshot(doc => {
    metaCrudo.finanzas_ajustes = doc.exists ? doc.data() : null;
    ajustes = Object.assign({}, AJUSTES_DEFECTO, doc.exists ? doc.data() : {});
    ajustesCargados = true;
    pedirRender();
  });
  metaDocRef("finanzas_esquema").onSnapshot({ includeMetadataChanges: true }, doc => {
    esquema = doc.exists ? doc.data() : null;
    esquemaCargado = doc.exists || !(doc.metadata && doc.metadata.fromCache);
    intentarRespaldo();
    migrarCategoriasFijas();
    pedirRender();
  });
  budgetConfigDocRef().onSnapshot(doc => {
    metaCrudo.config_presupuesto = doc.exists ? doc.data() : null;
    const day = doc.exists ? Number(doc.data().startDay) : 1;
    budgetStartDay = day >= 1 && day <= 30 ? day : 1;
    pedirRender();
  });
  budgetDocRef().onSnapshot(doc => {
    metaCrudo.presupuestos = doc.exists ? doc.data() : null;
    presupuestoBase = doc.exists ? doc.data() : {};
    sincronizarPresupuesto();
    pedirRender();
  });
  presupuestosPeriodosRef().onSnapshot(doc => {
    presupuestoDoc = doc.exists ? doc.data() : null;
    metaCrudo.presupuestos_periodos = presupuestoDoc;
    sincronizarPresupuesto();
    pedirRender();
  });
  let groupsLoaded = false;
  let legacyCustom = null;
  function updateGastoCategoriesCache() {
    gastoCategoriesCache = flattenCategoryGroups(categoryGroupsCache);
  }
  // Las categorías que se creaban con la versión vieja del selector vivían en
  // un documento aparte; se pasan una sola vez a la sección "Otros".
  function migrateLegacyCustom() {
    if (!groupsLoaded || !legacyCustom || !legacyCustom.length) return;
    const known = new Set(gastoCategoriesCache.map(c => c.id));
    const missing = legacyCustom.filter(c => c && c.id && !known.has(c.id))
      .map(c => ({ id: c.id, label: c.label || "Categoría", icon: c.icon || "otherCategory" }));
    legacyCustom = null;
    if (missing.length) {
      const hasOtros = categoryGroupsCache.some(g => g.id === "otros");
      const next = hasOtros
        ? categoryGroupsCache.map(g => g.id === "otros" ? Object.assign({}, g, { items: (g.items || []).concat(missing) }) : g)
        : categoryGroupsCache.concat([{ id: "otros", nombre: "Otros", items: missing }]);
      saveCategoryGroups(next);
    }
    customCategoriesDocRef().delete();
  }

  categoriasDocRef().onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    metaCrudo.categorias_gasto = data;
    categoriasArchivadas = (data && Array.isArray(data.archivadas)) ? data.archivadas : [];
    // Sin conexión y sin copia local, "no existe" solo significa "no lo sé":
    // se usan las de siempre en pantalla, pero NO se escriben (al volver la
    // red habrían reemplazado tus categorías reales).
    const soloCache = doc.metadata && doc.metadata.fromCache;
    if (data && Array.isArray(data.groups) && data.groups.length) {
      categoryGroupsCache = data.groups;
    } else if (soloCache) {
      categoryGroupsCache = DEFAULT_CATEGORY_GROUPS;
    } else if (data && Array.isArray(data.list) && data.list.length) {
      // Formato viejo (lista plana, sin subcategorías): cada categoría pasa
      // a ser su propio grupo con un solo ítem, para no perder nada.
      categoryGroupsCache = data.list.map(c => ({ id: c.id, nombre: c.label, items: [{ id: c.id, label: c.label, icon: c.icon }] }));
      categoriasDocRef().set({ groups: categoryGroupsCache }, { merge: true });
    } else {
      categoryGroupsCache = DEFAULT_CATEGORY_GROUPS;
      categoriasDocRef().set({ groups: DEFAULT_CATEGORY_GROUPS }, { merge: true });
    }
    updateGastoCategoriesCache();
    if (!soloCache && data && Array.isArray(data.groups) && data.groups.length) categoriasDelServidor = true;
    migrarCategoriasFijas();
    groupsLoaded = !soloCache || groupsLoaded;
    migrateLegacyCustom();
    pedirRender();
  });
  ingresoCategoriesDocRef().onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    metaCrudo.categorias_ingreso = data;
    if (data && Array.isArray(data.list) && data.list.length) {
      CATEGORIES.ingreso = data.list;
    } else {
      // Formato anterior: solo guardaba las creadas por el usuario.
      const custom = (data && Array.isArray(data.items)) ? data.items : [];
      CATEGORIES.ingreso = DEFAULT_INGRESO_CATEGORIES.filter(c => c.id !== "otros_ingresos").concat(custom);
    }
    pedirRender();
  });
  customCategoriesDocRef().get().then(doc => {
    const data = doc.exists ? doc.data() : null;
    legacyCustom = (data && Array.isArray(data.categories)) ? data.categories : [];
    migrateLegacyCustom();
  }).catch(() => {});
  ahorrosCollection().onSnapshot({ includeMetadataChanges: true }, snap => {
    if (!snap.metadata || !snap.metadata.fromCache) delServidor.ahorros = true;
    crudos.ahorros = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    ahorrosCache = crudos.ahorros.map(d => FD.adaptarAhorro(d.id, d));
    pedirRender();
    intentarRespaldo();
  });
  carterasCustomDocRef().onSnapshot(doc => {
    metaCrudo.carteras_custom = doc.exists ? doc.data() : null;
    carterasCustomCache = (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : [];
    pedirRender();
  });
  carterasMovimientosCollection().onSnapshot({ includeMetadataChanges: true }, snap => {
    if (!snap.metadata || !snap.metadata.fromCache) delServidor.carteras = true;
    crudos.carteras = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    carterasMovCache = crudos.carteras.map(d => FD.adaptarMovCartera(d.id, d));
    pedirRender();
    intentarRespaldo();
  });
});
})();
