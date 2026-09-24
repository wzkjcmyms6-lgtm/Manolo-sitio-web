(function () {
const CATEGORIES = {
  gasto: [
    { id: "comida", label: "Comida", icon: "food", color: "#4d9de0" },
    { id: "transporte", label: "Transporte", icon: "transport", color: "#9b6bde" },
    { id: "vivienda", label: "Vivienda", icon: "home", color: "#3fb8af" },
    { id: "salud", label: "Salud", icon: "health", color: "#e0567c" },
    { id: "entretenimiento", label: "Entretenimiento", icon: "entertainment", color: "#dbb84a" },
    { id: "compras", label: "Compras", icon: "shopping", color: "#5cc98a" },
    { id: "suscripciones", label: "Suscripciones", icon: "subscription", color: "#c96bde" },
    { id: "otros", label: "Otros", icon: "otherCategory", color: "#9a978f" }
  ],
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

// Repertorio genérico de íconos para elegir al crear una subcategoría.
const CATEGORY_ICON_CHOICES = [
  "food", "drink", "coffee", "transport", "fuel", "home", "health", "entertainment",
  "music", "camera", "shopping", "subscription", "gift", "pet", "education",
  "phone", "wifi", "bank", "bolt", "water", "salary", "tools", "otherCategory"
];

const PAYMENTS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Tarjeta de crédito" }
];

let monthOffset = 0; // 0 = mes actual, -1 = mes anterior, etc.
let financeCache = [];
let budgetsCache = {};
let categoryGroupsCache = DEFAULT_CATEGORY_GROUPS; // {id, nombre, items:[{id,label,icon,emoji?}]}, guardado en Firestore
let gastoCategoriesCache = CATEGORIES.gasto; // versión "plana" de categoryGroupsCache, la usa el resto de la app
let customCategoriesCache = []; // categorías personalizadas del usuario {id, label, icon, color}
let ahorrosCache = [];
let carterasCustomCache = []; // carteras que el usuario crea a mano, con su propio saldo
let carterasMovCache = []; // movimientos (aportes, retiros, transferencias) de esas carteras

function financeCollection() {
  return db.collection("users").doc(currentUser.uid).collection("finanzas");
}
function budgetConfigDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("config_presupuesto");
}
function budgetDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("presupuestos");
}
function categoriasDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("categorias_gasto");
}
function ingresoCategoriesDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("categorias_ingreso");
}
function customCategoriesDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("categorias_personalizadas");
}
function ahorrosCollection() {
  return db.collection("users").doc(currentUser.uid).collection("ahorros");
}
function carterasCustomDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("carteras_custom");
}
function carterasMovimientosCollection() {
  return db.collection("users").doc(currentUser.uid).collection("carteras_movimientos");
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
      || { id, label: "Ingreso", icon: "salary", color: INGRESO_COLOR };
  }
  const list = type === "gasto" ? gastoCategoriesCache : (CATEGORIES[type] || []);
  return list.find(c => c.id === id) || gastoCategoriesCache.find(c => c.id === "otros") || CATEGORIES.gasto[CATEGORIES.gasto.length - 1];
}
// ---- Abrir/cerrar hojas y ventanas con animación ----
function showSheet(el) {
  clearTimeout(el._hideTimer);
  el.classList.remove("is-closing");
  el.hidden = false;
  document.body.classList.add("sheet-open");
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

function currentMonthDate() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthOffset);
  return d;
}
function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(date) {
  return capitalize(date.toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
}
function isInMonth(dateStr, monthDate) {
  return dateStr.slice(0, 7) === monthKey(monthDate);
}

// ---------- Periodo del presupuesto (ej: del 28 al 27 del mes siguiente) ----------
let budgetStartDay = 1; // 1-28, se configura en Herramientas → Periodo del presupuesto

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentBudgetPeriod() {
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();
  if (today.getDate() < budgetStartDay) month--;
  month += monthOffset;
  const start = new Date(year, month, budgetStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, budgetStartDay - 1);
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

function computeTotals(list) {
  const cash = { efectivo: 0, debito: 0 };
  let deuda = 0;
  list.forEach(m => {
    if (m.type === "ingreso") {
      cash[paymentWallet(m.payment)] += m.amount;
    } else if (m.type === "gasto") {
      if (m.payment === "credito") deuda += m.amount;
      else cash[paymentWallet(m.payment)] -= m.amount;
    } else if (m.type === "pago_tarjeta") {
      cash[paymentWallet(m.payment)] -= m.amount;
      deuda -= m.amount;
    } else if (m.type === "transferencia") {
      // Una transferencia solo mueve plata entre carteras: nunca cuenta como
      // gasto ni ingreso. Acá solo importa si toca Efectivo, Débito o la
      // tarjeta; el lado de Ahorro o de una cartera propia se guarda aparte.
      const received = m.amountTo != null ? m.amountTo : m.amount;
      if (isCash(m.from)) cash[cashWallet(m.from)] -= m.amount;
      if (isCash(m.to)) cash[cashWallet(m.to)] += received;
      if (m.to === "tarjeta") deuda -= received;
    } else if (m.type === "ajuste_tarjeta") {
      // Pago de la tarjeta hecho con plata de otra cartera (Ahorro, etc.):
      // solo baja la deuda.
      deuda -= m.amount;
    }
  });
  return { saldo: cash.efectivo + cash.debito, efectivo: cash.efectivo, debito: cash.debito, deuda };
}

// ================= Resumen =================

function renderStats() {
  const { saldo, deuda, efectivo, debito } = computeTotals(financeCache);

  const stats = document.getElementById("finance-stats");
  stats.innerHTML = `
    <div class="stat-box">
      <div class="value">${formatMoney(saldo)}</div>
      <div class="label">Saldo disponible</div>
      <div class="cash-split">
        <span><i style="background:${PAYMENT_COLORS.efectivo}"></i>Efectivo ${formatBsShort(efectivo)}</span>
        <span><i style="background:${PAYMENT_COLORS.debito}"></i>Débito ${formatBsShort(debito)}</span>
      </div>
    </div>
    <div class="stat-box">
      <div class="value${deuda > 0 ? " value-debt" : ""}">${formatMoney(deuda)}</div>
      <div class="label">Deuda de tarjeta</div>
      ${deuda > 0 ? `
        <button type="button" class="link-btn pay-card-link" id="pay-card-toggle">Pagar tarjeta</button>
        <form id="pay-card-form" class="pay-card-form" hidden>
          <input type="number" id="pay-card-amount" placeholder="Monto" min="0.01" step="0.01" max="${deuda.toFixed(2)}" required>
          <select id="pay-card-source">
            <option value="debito">Débito</option>
            <option value="efectivo">Efectivo</option>
          </select>
          <button type="submit">Confirmar</button>
        </form>
      ` : ""}
    </div>
  `;

  const toggle = document.getElementById("pay-card-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const form = document.getElementById("pay-card-form");
      form.hidden = !form.hidden;
    });
    document.getElementById("pay-card-form").addEventListener("submit", e => {
      e.preventDefault();
      const amount = parseFloat(document.getElementById("pay-card-amount").value);
      const source = document.getElementById("pay-card-source").value;
      if (!amount || amount <= 0) return;
      financeCollection().add({
        createdAt: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        type: "pago_tarjeta",
        category: "pago_tarjeta",
        payment: source,
        desc: "Pago de tarjeta de crédito",
        amount
      });
    });
  }
}

function updateMonthLabel() {
  document.getElementById("month-label-text").textContent = periodLabel(currentBudgetPeriod());
  document.getElementById("month-next").disabled = monthOffset >= 0;
}

// ---- Vista general: lista de transacciones del periodo (como Buddy) ----
function dayLabel(dateStr) {
  const today = isoDate(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (dateStr === today) return "Hoy";
  if (dateStr === isoDate(y)) return "Ayer";
  return capitalize(new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" }).replace(".", ""));
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

function renderMovements() {
  const period = currentBudgetPeriod();
  const list = financeCache
    .filter(m => isInPeriod(m.date, period))
    .sort(byNewest);

  const ingresos = list.filter(m => m.type === "ingreso").reduce((s, m) => s + m.amount, 0);
  const gastos = list.filter(m => m.type === "gasto").reduce((s, m) => s + m.amount, 0);
  // El saldo es lo real: lo que salió de "Yo" hacia Ahorro u otras carteras
  // (menos lo que volvió) ya no se puede gastar, aunque no se muestre como
  // gasto. Pagar la tarjeta no se resta: esos gastos ya están en "Gastos".
  const ahorro = list
    .filter(m => m.type === "transferencia" && m.to !== "tarjeta")
    .reduce((s, m) => s + (isCash(m.from) && !isCash(m.to) ? m.amount : 0)
      - (isCash(m.to) && !isCash(m.from) ? (m.amountTo != null ? m.amountTo : m.amount) : 0), 0);
  const saldo = ingresos - gastos - ahorro;
  const signed = n => `${n < 0 ? "−" : ""}${formatBsShort(Math.abs(n))}`;

  document.getElementById("month-count").textContent = `${list.length} transacci${list.length === 1 ? "ón" : "ones"}`;
  document.getElementById("finance-summary").innerHTML = `
    <div><strong>${formatBsShort(ingresos)}</strong><span>Ingresos</span></div>
    <div><strong>${formatBsShort(gastos)}</strong><span>Gastos</span></div>
    <div><strong class="${saldo < 0 ? "neg" : ""}">${signed(saldo)}</strong><span>Saldo</span></div>
  `;
  document.getElementById("finance-empty").style.display = list.length ? "none" : "block";

  const groups = [];
  list.forEach(m => {
    const last = groups[groups.length - 1];
    if (last && last.date === m.date) last.items.push(m);
    else groups.push({ date: m.date, items: [m] });
  });

  const container = document.getElementById("finance-list");
  container.innerHTML = groups.map(g => {
    const total = g.items.reduce((s, m) => s + movementDelta(m), 0);
    const totalText = total === 0 ? formatBsShort(0) : `${total > 0 ? "+" : "−"}${formatBsShort(Math.abs(total))}`;
    return `
      <div class="txn-day">
        <div class="txn-day-head"><span>${dayLabel(g.date)}</span><span class="breakdown-leader"></span><span class="txn-day-total">${totalText}</span></div>
        ${g.items.map(m => {
          const cat = findCategory(m.type, m.category);
          const pay = findPayment(m.payment);
          let title = m.desc || cat.label;
          let sub = [m.desc ? cat.label : "", m.payment === "credito" ? (pay ? pay.label : "") : "", m.excluded ? "Excluido del presupuesto" : ""].filter(Boolean).join(" · ");
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
          return `
            <button type="button" class="txn-row" data-edit-txn="${m.id}">
              ${txnIconHTML(cat)}
              <span class="txn-body">
                <span class="txn-desc">${escapeHtml(title)}</span>
                ${sub ? `<span class="meta">${escapeHtml(sub)}</span>` : ""}
              </span>
              ${amount}
            </button>`;
        }).join("")}
      </div>`;
  }).join("");
  renderIcons(container);
}

function deleteMovement(id) {
  financeCollection().doc(id).delete();
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

function openTxnSheet(movement) {
  const toStr = n => String(n).replace(".", ",");
  txnSheet = movement
    ? {
        id: movement.id, type: movement.type, category: movement.category, payment: movement.payment || "efectivo",
        amount: toStr(movement.amount), desc: movement.desc || "", date: movement.date,
        excluded: !!movement.excluded, keypad: false,
        from: cashWallet(movement.from || "debito"), to: cashWallet(movement.to || "ahorro"),
        amountTo: movement.amountTo != null ? toStr(movement.amountTo) : "",
        readonly: movement.type === "transferencia", movement
      }
    : { id: null, type: "gasto", category: defaultCategory("gasto"), payment: "efectivo", amount: "0", desc: "", date: isoDate(new Date()), excluded: false, keypad: true, from: "debito", to: "ahorro", amountTo: "", readonly: false };
  renderTxnSheet();
  showSheet(document.getElementById("txn-sheet"));
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
  document.getElementById("txn-sheet-amount").textContent = formatSheetAmount(t.amount);
  document.getElementById("txn-sheet-currency").textContent = isTransfer ? walletCurrency(t.from) : "Bs";
  document.querySelectorAll("#txn-sheet [data-txn-type]").forEach(b => {
    b.classList.toggle("active", b.dataset.txnType === t.type);
    b.hidden = !editable || (t.id && b.dataset.txnType === "transferencia");
  });

  const walletRow = (key, id) => {
    const v = walletVisual(id);
    document.getElementById(`txn-sheet-${key}-badge`).outerHTML = `<span id="txn-sheet-${key}-badge" class="txn-icon txn-icon-solid" style="background:${v.color}" data-icon="${v.icon}"></span>`;
    document.getElementById(`txn-sheet-${key}-label`).textContent = walletLabel(id);
    document.getElementById(`txn-sheet-${key}`).disabled = !!t.readonly;
  };
  walletRow("from", t.from);
  walletRow("to", t.to);
  const needsAmountTo = isTransfer && walletCurrency(t.from) !== walletCurrency(t.to);
  document.getElementById("txn-sheet-amount-to-row").hidden = !needsAmountTo;
  document.getElementById("txn-sheet-amount-to-cur").textContent = walletCurrency(t.to);
  const amountToInput = document.getElementById("txn-sheet-amount-to");
  if (amountToInput.value !== t.amountTo) amountToInput.value = t.amountTo;
  amountToInput.disabled = !!t.readonly;
  document.getElementById("txn-sheet-note").disabled = !!t.readonly;
  document.getElementById("txn-sheet-save").hidden = !!t.readonly;

  const cat = findCategory(t.type, t.category);
  document.getElementById("txn-sheet-cat-badge").outerHTML = txnIconHTML(cat).replace('<span class="txn-icon', '<span id="txn-sheet-cat-badge" class="txn-icon');
  document.getElementById("txn-sheet-cat-label").textContent = cat.label;
  document.getElementById("txn-sheet-cat").disabled = !editable;

  const pay = findPayment(t.payment) || PAYMENTS[0];
  document.getElementById("txn-sheet-pay-badge").outerHTML = `<span id="txn-sheet-pay-badge" class="txn-icon txn-icon-solid" style="background:${PAYMENT_COLORS[pay.id]}" data-icon="${PAYMENT_ICONS[pay.id]}"></span>`;
  document.getElementById("txn-sheet-pay-label").textContent = pay.label;
  document.getElementById("txn-sheet-pay-prefix").textContent = t.type === "ingreso" ? "Hacia:" : "Desde:";

  const note = document.getElementById("txn-sheet-note");
  if (note.value !== t.desc) note.value = t.desc;
  document.getElementById("txn-sheet-date-label").textContent = dayLabel(t.date);
  document.getElementById("txn-sheet-date-input").value = t.date;
  document.getElementById("txn-sheet-next-day").disabled = t.date >= isoDate(new Date());

  const excl = document.getElementById("txn-sheet-excluded");
  excl.checked = t.excluded;
  document.getElementById("txn-sheet-excluded-row").hidden = !editable || isTransfer;
  document.getElementById("txn-sheet-prev-day").disabled = !!t.readonly;
  document.getElementById("txn-sheet-date-input").disabled = !!t.readonly;
  if (t.readonly) document.getElementById("txn-sheet-next-day").disabled = true;

  document.getElementById("txn-sheet-delete").hidden = !t.id;
  document.getElementById("txn-sheet").classList.toggle("keypad-open", t.keypad && !t.readonly);
  renderIcons(document.getElementById("txn-sheet"));
}

function pressTxnKey(key) {
  if (txnSheet.readonly) return;
  txnSheet.amount = applyAmountKey(txnSheet.amount, key);
  document.getElementById("txn-sheet-amount").textContent = formatSheetAmount(txnSheet.amount);
}

function shiftTxnDate(days) {
  const d = new Date(txnSheet.date + "T00:00:00");
  d.setDate(d.getDate() + days);
  const next = isoDate(d);
  if (next > isoDate(new Date())) return;
  txnSheet.date = next;
  renderTxnSheet();
}

function chooseTxnCategory() {
  const t = txnSheet;
  openCatSheet(t.type, t.category, id => { t.category = id; renderTxnSheet(); });
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
      gastoCategoriesCache = flattenCategoryGroups(next).concat(customCategoriesCache.filter(c => !next.some(g => (g.items || []).some(i => i.id === c.id))));
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
    items: options.map(p => ({ id: p.id, label: p.label, icon: PAYMENT_ICONS[p.id], color: PAYMENT_COLORS[p.id] })),
    onPick: id => { closePicker(); t.payment = id; renderTxnSheet(); }
  });
}

function chooseTxnWallet(side) {
  const t = txnSheet;
  const other = side === "from" ? t.to : t.from;
  const wallets = ledgerWallets().filter(w => (side === "to" || !w.soloDestino) && w.id !== other);
  openPicker({
    title: side === "from" ? "¿Desde qué cartera?" : "¿A qué cartera?",
    items: wallets.map(w => {
      const v = walletVisual(w.id);
      return { id: w.id, label: `${walletLabel(w.id)} (${w.moneda})`, icon: v.icon, color: v.color };
    }),
    onPick: id => {
      closePicker();
      t[side] = id;
      if (walletCurrency(t.from) === walletCurrency(t.to)) t.amountTo = "";
      renderTxnSheet();
    }
  });
}

async function saveTxn() {
  const t = txnSheet;
  const amount = parseFloat(t.amount.replace(",", ".")) || 0;
  if (amount <= 0) {
    t.keypad = true;
    renderTxnSheet();
    document.getElementById("txn-sheet-amount").classList.add("shake");
    setTimeout(() => document.getElementById("txn-sheet-amount").classList.remove("shake"), 400);
    return;
  }
  if (t.type === "transferencia") {
    let amountTo = amount;
    if (walletCurrency(t.from) !== walletCurrency(t.to)) {
      amountTo = parseFloat((t.amountTo || "").replace(",", ".")) || 0;
      if (amountTo <= 0) {
        t.keypad = false;
        renderTxnSheet();
        document.getElementById("txn-sheet-amount-to").focus();
        return;
      }
    }
    const payload = { from: t.from, to: t.to, amount, amountTo, desc: t.desc.trim(), date: t.date };
    closeTxnSheet();
    await createTransfer(payload);
    return;
  }
  const data = { date: t.date, type: t.type, category: t.category, payment: t.payment, desc: t.desc.trim(), amount, excluded: t.excluded };
  closeTxnSheet();
  if (t.id) await financeCollection().doc(t.id).update(data);
  else await financeCollection().add(Object.assign({ createdAt: Date.now() }, data));
}

async function deleteTxnFromSheet() {
  const t = txnSheet;
  const ok = await appDialog({ title: t.type === "transferencia" ? "¿Eliminar esta transferencia?" : "¿Eliminar esta transacción?", message: t.type === "transferencia" ? "Se revierte en las dos carteras. Esta acción no se puede deshacer." : "Esta acción no se puede deshacer.", confirmLabel: "Eliminar", danger: true });
  if (!ok) return;
  closeTxnSheet();
  if (t.type === "transferencia") deleteTransfer(t.movement);
  else deleteMovement(t.id);
}

document.getElementById("txn-add").addEventListener("click", () => openTxnSheet(null));

document.getElementById("finance-list").addEventListener("click", e => {
  const row = e.target.closest("[data-edit-txn]");
  if (!row) return;
  const m = financeCache.find(x => x.id === row.dataset.editTxn);
  if (m) openTxnSheet(m);
});

document.getElementById("txn-sheet").addEventListener("click", e => {
  if (!txnSheet) return;
  const key = e.target.closest("[data-txn-key]");
  if (key) { pressTxnKey(key.dataset.txnKey); return; }
  const typeBtn = e.target.closest("[data-txn-type]");
  if (typeBtn) {
    if (typeBtn.dataset.txnType !== txnSheet.type) {
      txnSheet.type = typeBtn.dataset.txnType;
      if (txnSheet.type !== "transferencia") txnSheet.category = defaultCategory(txnSheet.type);
      if (txnSheet.type === "ingreso" && txnSheet.payment === "credito") txnSheet.payment = "efectivo";
      renderTxnSheet();
    }
    return;
  }
  if (e.target.closest("#txn-sheet-amount-btn")) { if (!txnSheet.readonly) { txnSheet.keypad = !txnSheet.keypad; renderTxnSheet(); } return; }
  if (e.target.closest("#txn-sheet-keypad-done")) { txnSheet.keypad = false; renderTxnSheet(); return; }
  if (e.target.closest("#txn-sheet-cat")) { chooseTxnCategory(); return; }
  if (e.target.closest("#txn-sheet-pay")) { chooseTxnPayment(); return; }
  if (e.target.closest("#txn-sheet-from")) { if (!txnSheet.readonly) chooseTxnWallet("from"); return; }
  if (e.target.closest("#txn-sheet-to")) { if (!txnSheet.readonly) chooseTxnWallet("to"); return; }
  if (e.target.closest("#txn-sheet-prev-day")) { shiftTxnDate(-1); return; }
  if (e.target.closest("#txn-sheet-next-day")) { shiftTxnDate(1); return; }
  if (e.target.closest("#txn-sheet-save")) { saveTxn(); return; }
  if (e.target.closest("#txn-sheet-delete")) { deleteTxnFromSheet(); return; }
  if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) closeTxnSheet();
});

document.getElementById("txn-sheet-note").addEventListener("focus", () => {
  if (txnSheet && txnSheet.keypad) { txnSheet.keypad = false; renderTxnSheet(); }
});
document.getElementById("txn-sheet-note").addEventListener("input", e => {
  if (txnSheet) txnSheet.desc = e.target.value;
});
document.getElementById("txn-sheet-date-input").addEventListener("change", e => {
  if (!txnSheet || !e.target.value) return;
  txnSheet.date = e.target.value > isoDate(new Date()) ? isoDate(new Date()) : e.target.value;
  renderTxnSheet();
});
document.getElementById("txn-sheet-amount-to").addEventListener("input", e => {
  if (txnSheet) txnSheet.amountTo = e.target.value;
});
document.getElementById("txn-sheet-amount-to").addEventListener("focus", () => {
  if (txnSheet && txnSheet.keypad) { txnSheet.keypad = false; renderTxnSheet(); }
});
document.getElementById("txn-sheet-excluded").addEventListener("change", e => {
  if (txnSheet) txnSheet.excluded = e.target.checked;
});

document.getElementById("month-prev").addEventListener("click", () => { monthOffset--; renderAll(); });
document.getElementById("month-next").addEventListener("click", () => { monthOffset++; renderAll(); });
document.getElementById("budget-month-prev").addEventListener("click", () => { monthOffset--; renderAll(); });
document.getElementById("budget-month-next").addEventListener("click", () => { monthOffset++; renderAll(); });

// ================= Presupuesto =================

function computeSpentByCategory(period) {
  const spent = {};
  gastoCategoriesCache.forEach(c => { spent[c.id] = 0; });
  financeCache
    .filter(m => m.type === "gasto" && !m.excluded && isInPeriod(m.date, period))
    .forEach(m => { spent[m.category] = (spent[m.category] || 0) + m.amount; });
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
    .forEach(m => { received[m.category] = (received[m.category] || 0) + m.amount; });
  return received;
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

function remainingCatHTML(c, planned, used, type) {
  const remaining = planned - used;
  const over = remaining < 0;
  const pct = planned > 0 ? used / planned : (used > 0 ? 1 : 0);
  const iconHTML = c.emoji ? `<span class="remain-emoji">${c.emoji}</span>` : `<span class="remain-icon" data-icon="${c.icon}"></span>`;
  return `
    <button type="button" class="remain-cat" data-cat-detail="${c.id}" data-cat-type="${type}">
      <div class="remain-ring">
        ${progressRing(pct, over ? "var(--danger)" : c.color)}
        <span class="remain-ring-core" style="background:${c.color}">${iconHTML}</span>
      </div>
      <div class="remain-label">${escapeHtml(c.label)}</div>
      <div class="remain-amount${over ? " over" : ""}">${remainingText(remaining)}</div>
    </button>
  `;
}

function remainingSectionHTML(title, rows, type) {
  const remaining = rows.reduce((s, r) => s + r.planned - r.used, 0);
  return `
    <div class="budget-section remain-section">
      <div class="remain-section-head">
        <h3 class="budget-section-title">${escapeHtml(title)}</h3>
        <span class="remain-section-amount${remaining < 0 ? " over" : ""}">${remainingText(remaining)}</span>
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

  const groupSections = categoryGroupsCache
    .map(g => ({
      title: g.nombre,
      rows: groupCategories(g)
        .map(c => ({ cat: c, planned: budgetsCache[c.id] || 0, used: spent[c.id] || 0 }))
        .filter(r => relevant(r.cat, r.used))
    }))
    .filter(sec => sec.rows.length);

  // Restante para gastar = ingresos planeados − lo gastado en el mes.
  const totalIncome = ingresoRows.reduce((s, r) => s + r.planned, 0);
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
  `;

  const list = document.getElementById("budget-grid");
  const sectionsHTML = (ingresoRows.length ? [remainingSectionHTML("Ingresos", ingresoRows, "ingreso")] : [])
    .concat(groupSections.map(sec => remainingSectionHTML(sec.title, sec.rows, "gasto")));
  list.innerHTML = sectionsHTML.length
    ? sectionsHTML.join("")
    : `<p class="remain-empty">Todavía no hay presupuesto para este mes. Agrégalo en Planificación.</p>`;

  renderIcons(document.getElementById("budget-tab-restante"));
  if (catDetail) renderCategoryDetail();
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

  const planned = budgetsCache[catId] || 0;
  const used = movements.reduce((s, m) => s + m.amount, 0);
  const remaining = planned - used;
  const over = remaining < 0;
  const pct = planned > 0 ? used / planned : (used > 0 ? 1 : 0);
  const usedLabel = type === "ingreso" ? "Recibido" : "Gastado";

  document.getElementById("cat-detail-title").textContent = cat.label;
  document.getElementById("cat-detail-hero").innerHTML = `
    <div class="remain-ring cat-detail-ring">
      ${progressRing(pct, over ? "var(--danger)" : cat.color)}
      <span class="remain-ring-core" style="background:${cat.color}">
        ${cat.emoji ? `<span class="remain-emoji">${cat.emoji}</span>` : `<span class="remain-icon" data-icon="${cat.icon}"></span>`}
      </span>
    </div>
    <div class="cat-detail-remaining${over ? " over" : ""}">${remainingText(remaining)}</div>
    <div class="cat-detail-month">${periodLabel(period)}</div>
    <div class="cat-detail-stats">
      <div><span>Presupuesto</span><strong>${formatBsShort(planned)}</strong></div>
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

function renderBudgetInfo() {
  const period = currentBudgetPeriod();
  const info = computeBudgetInfo(period);
  const days = daysLeftInPeriod(period);

  // Proyección: ingresos − ahorros − gastos fijos (lo presupuestado, o lo
  // gastado si ya se pasó) − gastos variables y otros (solo lo ya gastado).
  const lines = [
    { label: "Ingresos", value: Math.max(info.ingreso.planned, info.ingreso.used), sign: 1 },
    { label: "Ahorros", value: Math.max(info.ahorro.planned, info.ahorro.used), sign: -1 },
    { label: "Gastos fijos", value: Math.max(info.fijo.planned, info.fijo.used), sign: -1 },
    { label: "Gastos variables", value: info.variable.used, sign: -1 },
    { label: "Otros gastos", value: info.otros.used, sign: -1 }
  ];
  const result = lines.reduce((s, l) => s + l.sign * l.value, 0);
  const daily = days > 0 ? Math.max(result, 0) / days : 0;

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

function saveBudgets() {
  return budgetDocRef().set(Object.assign({}, budgetsCache));
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

function openBudgetSheet({ type, groupId = null, catId = null }) {
  const amount = catId && budgetsCache[catId] ? String(budgetsCache[catId]).replace(".", ",") : "0";
  budgetSheet = { type, groupId, catId, originalCatId: catId, amount, tipo: null };
  if (!catId) {
    const first = sheetCandidates()[0];
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
  saveBudgets();
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
}

document.getElementById("budget-sheet").addEventListener("click", e => {
  if (!budgetSheet) return;
  const key = e.target.closest("[data-key]");
  if (key) { pressSheetKey(key.dataset.key); return; }
  const tipoBtn = e.target.closest("[data-tipo]");
  if (tipoBtn) { budgetSheet.tipo = tipoBtn.dataset.tipo; renderBudgetSheet(); return; }
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
  if (!document.getElementById("category-selector-modal").hidden) return;
  if (catSheet) {
    if (e.key === "Escape") { closeCatSheet(); e.preventDefault(); }
    return;
  }
  if (txnSheet) {
    if (/^\d$/.test(e.key)) pressTxnKey(e.key);
    else if (e.key === "," || e.key === ".") pressTxnKey(",");
    else if (e.key === "Backspace") pressTxnKey("back");
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
  document.getElementById("period-days").innerHTML = Array.from({ length: 28 }, (_, i) => i + 1).map(d => `
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

function saveCategoryGroups(groups) {
  return categoriasDocRef().set({ groups });
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

function iconPickerHTML() {
  return CATEGORY_ICON_CHOICES.map((key, i) =>
    `<button type="button" class="icon-choice${i === 0 ? " selected" : ""}" data-icon-choice="${key}" data-icon="${key}"></button>`
  ).join("");
}

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
    <div class="list-item cat-item">
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
      <div class="cat-group-items">${itemsHTML}</div>
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
        <div class="list-item cat-item">
          <div style="display:flex; align-items:center; gap:0.7rem;">
            ${iconOrEmojiHTML}
            <strong>${escapeHtml(item.label)}</strong>
          </div>
          ${item.id !== "otros" ? `<button type="button" class="delete" aria-label="Eliminar categoría" data-delete-cat="${item.id}" data-delete-group="${g.id}">${ICONS.trash}</button>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="cat-group">
        <div class="cat-group-header">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <div class="cat-color-line" style="background:${color};"></div>
            <h3>${escapeHtml(g.nombre)}</h3>
          </div>
          <button type="button" class="cat-add-btn" data-add-sub="${g.id}" aria-label="Agregar subcategoría en ${escapeHtml(g.nombre)}">${ICONS.plus}</button>
        </div>
        <div class="cat-group-items">${itemsHTML}</div>
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

async function deleteCategoryItem(groupId, itemId) {
  if (groupId === INGRESO_GROUP_ID) {
    const item = CATEGORIES.ingreso.find(i => i.id === itemId);
    if (!item || CATEGORIES.ingreso.length <= 1) return;
    const ok = await appDialog({ title: `¿Eliminar "${item.label}"?`, message: "Los ingresos que ya registraste con esta categoría no se borran.", confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    delete budgetsCache[itemId];
    saveBudgets();
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
  return carterasMovCache.filter(m => m.carteraId === id).reduce((s, m) => s + m.monto, 0);
}

// Todas las carteras que se pueden usar en una transferencia. Gastos y
// Ahorro pueden ser origen o destino; Tarjeta de crédito solo puede ser
// destino (pagarla con plata de otra cartera), nunca origen — no tiene
// sentido "sacar" plata de una deuda.
function ledgerWallets() {
  return [
    { id: "efectivo", nombre: "Efectivo", moneda: "Bs", builtIn: true },
    { id: "debito", nombre: "Débito", moneda: "Bs", builtIn: true },
    { id: "tarjeta", nombre: "Tarjeta de crédito", moneda: "Bs", builtIn: true, soloDestino: true },
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
async function createTransfer({ from, to, amount, amountTo, desc, date }) {
  const suffix = desc ? " · " + desc : "";
  const links = [];
  const side = async (walletId, monto, nota) => {
    if (isCash(walletId) || walletId === "tarjeta") return;
    if (walletId === "ahorro") {
      const ref = await ahorrosCollection().add({ date, amount: monto, notes: nota, createdAt: Date.now() });
      links.push({ kind: "ahorro", id: ref.id });
    } else {
      const ref = await carterasMovimientosCollection().add({ carteraId: walletId, fecha: date, monto, nota, createdAt: Date.now() });
      links.push({ kind: "cartera", id: ref.id });
    }
  };
  await side(from, -amount, `Transferencia a ${walletLabel(to)}${suffix}`);
  await side(to, amountTo, `Transferencia desde ${walletLabel(from)}${suffix}`);
  return financeCollection().add({ date, type: "transferencia", category: "transferencia", from, to, amount, amountTo, desc: desc || "", links, createdAt: Date.now() });
}

function deleteTransfer(m) {
  (m.links || []).forEach(l => {
    if (l.kind === "ahorro") ahorrosCollection().doc(l.id).delete();
    else if (l.kind === "cartera") carterasMovimientosCollection().doc(l.id).delete();
  });
  return financeCollection().doc(m.id).delete();
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
function deleteCustomWallet(id) {
  carterasCustomDocRef().set({ list: carterasCustomCache.filter(w => w.id !== id) });
  carterasMovCache.filter(m => m.carteraId === id).forEach(m => carterasMovimientosCollection().doc(m.id).delete());
}

function renderWallets() {
  const { saldo, deuda, efectivo, debito } = computeTotals(financeCache);
  const totalAhorros = ahorrosCache.reduce((s, a) => s + a.amount, 0);
  let netoBs = saldo - deuda;
  let netoUsd = totalAhorros;
  carterasCustomCache.forEach(w => {
    const bal = customWalletBalance(w.id);
    if (w.moneda === "US$") netoUsd += bal; else netoBs += bal;
  });

  const deudaText = deuda > 0 ? "−" + formatMoney(deuda) : formatMoney(0);

  const panels = [
    { label: "Patrimonio total", lines: [formatMoney(netoBs), formatUSD(netoUsd)] },
    { label: "Yo", lines: [formatMoney(saldo)], sub: `Efectivo ${formatBsShort(efectivo)} · Débito ${formatBsShort(debito)}` },
    { label: "Cartera de tarjeta de crédito", lines: [deudaText] },
    { label: "Cartera de ahorro", lines: [formatUSD(totalAhorros)] }
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
    walletHTML("finance", "#e05656", "Tarjeta de crédito", deudaText, deuda > 0, "tarjeta") +
    walletHTML("wallet", "#5cc98a", "Ahorro (US$)", formatUSD(totalAhorros), false, "ahorro") +
    carterasCustomCache.map(walletCustomHTML).join("");

  renderIcons(document.getElementById("wallet-hero-track"));
  renderIcons(document.getElementById("wallet-list"));
  wireWalletHero();
  populateTransferSelects();
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
      onDelete: () => ahorrosCollection().doc(a.id).delete()
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
      onDelete: () => carterasMovimientosCollection().doc(m.id).delete()
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
  if (walletId === "ahorro") return formatUSD(ahorrosCache.reduce((s, a) => s + a.amount, 0));
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
  document.getElementById("transfer-form").hidden = true;
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

document.getElementById("wallet-menu-transfer").addEventListener("click", () => {
  document.getElementById("wallet-menu-dropdown").hidden = true;
  document.getElementById("new-wallet-form").hidden = true;
  populateTransferSelects();
  document.getElementById("transfer-form").hidden = false;
});
document.getElementById("transfer-cancel").addEventListener("click", () => {
  document.getElementById("transfer-form").hidden = true;
});

function populateTransferSelects() {
  const wallets = ledgerWallets().filter(w => !w.soloDestino);
  const fromSel = document.getElementById("transfer-from");
  const prevFrom = fromSel.value;
  fromSel.innerHTML = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.nombre)} (${w.moneda})</option>`).join("");
  if (wallets.some(w => w.id === prevFrom)) fromSel.value = prevFrom;
  updateTransferToOptions();
}

// El destino puede ser de otra moneda: no hay conversión automática, así
// que cuando las monedas no coinciden se piden los dos montos por separado
// (cuánto se descuenta del origen y cuánto se suma al destino).
function updateTransferToOptions() {
  const wallets = ledgerWallets();
  const fromW = wallets.find(w => w.id === document.getElementById("transfer-from").value);
  const options = wallets.filter(w => !fromW || w.id !== fromW.id);
  const toSel = document.getElementById("transfer-to");
  const prevTo = toSel.value;
  toSel.innerHTML = options.map(w => `<option value="${w.id}">${escapeHtml(w.nombre)} (${w.moneda})</option>`).join("");
  if (options.some(w => w.id === prevTo)) toSel.value = prevTo;
  updateTransferAmountFields();
}

function updateTransferAmountFields() {
  const wallets = ledgerWallets();
  const fromW = wallets.find(w => w.id === document.getElementById("transfer-from").value);
  const toW = wallets.find(w => w.id === document.getElementById("transfer-to").value);
  const amountFrom = document.getElementById("transfer-amount-from");
  const amountTo = document.getElementById("transfer-amount-to");

  amountFrom.placeholder = fromW ? `Monto a descontar (${fromW.moneda})` : "Monto";

  const distinta = !!(fromW && toW && fromW.moneda !== toW.moneda);
  amountTo.hidden = !distinta;
  amountTo.required = distinta;
  if (distinta) amountTo.placeholder = `Monto a añadir (${toW.moneda})`;
}

document.getElementById("transfer-from").addEventListener("change", updateTransferToOptions);
document.getElementById("transfer-to").addEventListener("change", updateTransferAmountFields);

document.getElementById("transfer-form").addEventListener("submit", e => {
  e.preventDefault();
  clearFormError("transfer-error");
  const fromId = document.getElementById("transfer-from").value;
  const toId = document.getElementById("transfer-to").value;
  const notes = document.getElementById("transfer-notes").value.trim();
  if (!fromId || !toId || fromId === toId) {
    showFormError("transfer-error", { message: "Elegí una cartera de origen y una de destino distintas." });
    return;
  }

  const wallets = ledgerWallets();
  const fromW = wallets.find(w => w.id === fromId);
  const toW = wallets.find(w => w.id === toId);
  if (!fromW || !toW) {
    showFormError("transfer-error", { message: "No se encontró alguna de las carteras elegidas." });
    return;
  }

  const amountFrom = parseFloat(document.getElementById("transfer-amount-from").value);
  if (!amountFrom || amountFrom <= 0) {
    showFormError("transfer-error", { message: "Ingresá un monto válido a descontar." });
    return;
  }

  let amountTo = amountFrom;
  if (fromW.moneda !== toW.moneda) {
    amountTo = parseFloat(document.getElementById("transfer-amount-to").value);
    if (!amountTo || amountTo <= 0) {
      showFormError("transfer-error", { message: "Ingresá un monto válido a añadir en la cartera de destino." });
      return;
    }
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  createTransfer({ from: fromId, to: toId, amount: amountFrom, amountTo, desc: notes, date: isoDate(new Date()) }).then(() => {
    e.target.reset();
    document.getElementById("transfer-amount-to").hidden = true;
    document.getElementById("transfer-form").hidden = true;
  }).catch(err => showFormError("transfer-error", err))
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

  const rows = financeCache
    .filter(m => m.date >= from && m.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));

  const header = ["Fecha", "Tipo", "Categoría", "Medio de pago", "Descripción", "Monto (Bs)"];
  const lines = [header.map(csvEscape).join(",")];
  rows.forEach(m => {
    const cat = findCategory(m.type, m.category);
    const pay = findPayment(m.payment);
    lines.push([m.date, m.type, cat.label, pay ? pay.label : "", m.desc || "", m.amount.toFixed(2)]
      .map(csvEscape).join(","));
  });

  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `manolo-finanzas_${from}_a_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

(function initExportDates() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById("export-from").valueAsDate = firstOfMonth;
  document.getElementById("export-to").valueAsDate = today;
})();

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

function renderAll() {
  renderStats();
  updateMonthLabel();
  renderMovements();
  updateBudgetMonthLabel();
  renderBudgets();
  renderBudgetInputs();
  renderBudgetSummary();
  renderBudgetInfo();
  renderCategoryGroups();
  renderPeriodSettings();
  renderWallets();
  updateExportSummary();
}


onAuthReady(() => {
  financeCollection().onSnapshot(snap => {
    financeCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
  budgetConfigDocRef().onSnapshot(doc => {
    const day = doc.exists ? Number(doc.data().startDay) : 1;
    budgetStartDay = day >= 1 && day <= 28 ? day : 1;
    renderAll();
  });
  budgetDocRef().onSnapshot(doc => {
    budgetsCache = doc.exists ? doc.data() : {};
    renderAll();
  });
  function updateGastoCategoriesCache() {
    let flat = flattenCategoryGroups(categoryGroupsCache);
    // Agregar solo las categorías personalizadas que no estén duplicadas
    if (customCategoriesCache.length > 0) {
      const existingIds = flat.map(c => c.id);
      const newCustom = customCategoriesCache.filter(c => !existingIds.includes(c.id));
      gastoCategoriesCache = [...flat, ...newCustom];
    } else {
      gastoCategoriesCache = flat;
    }
  }

  categoriasDocRef().onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    if (data && Array.isArray(data.groups) && data.groups.length) {
      categoryGroupsCache = data.groups;
    } else if (data && Array.isArray(data.list) && data.list.length) {
      // Formato viejo (lista plana, sin subcategorías): cada categoría pasa
      // a ser su propio grupo con un solo ítem, para no perder nada.
      categoryGroupsCache = data.list.map(c => ({ id: c.id, nombre: c.label, items: [{ id: c.id, label: c.label, icon: c.icon }] }));
      categoriasDocRef().set({ groups: categoryGroupsCache });
    } else {
      categoryGroupsCache = DEFAULT_CATEGORY_GROUPS;
      categoriasDocRef().set({ groups: DEFAULT_CATEGORY_GROUPS });
    }
    updateGastoCategoriesCache();
    renderAll();
  });
  ingresoCategoriesDocRef().onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    if (data && Array.isArray(data.list) && data.list.length) {
      CATEGORIES.ingreso = data.list;
    } else {
      // Formato anterior: solo guardaba las creadas por el usuario.
      const custom = (data && Array.isArray(data.items)) ? data.items : [];
      CATEGORIES.ingreso = DEFAULT_INGRESO_CATEGORIES.filter(c => c.id !== "otros_ingresos").concat(custom);
    }
    renderAll();
  });
  customCategoriesDocRef().onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    customCategoriesCache = (data && Array.isArray(data.categories)) ? data.categories : [];
    updateGastoCategoriesCache();
    renderAll();
  });
  ahorrosCollection().onSnapshot(snap => {
    ahorrosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
  carterasCustomDocRef().onSnapshot(doc => {
    carterasCustomCache = (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : [];
    renderAll();
  });
  carterasMovimientosCollection().onSnapshot(snap => {
    carterasMovCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
});
})();
