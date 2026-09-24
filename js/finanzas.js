(function () {
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
  return list.find(c => c.id === id) || gastoCategoriesCache.find(c => c.id === "otros") || { id, label: "Otros", icon: "otherCategory", color: "#9a978f" };
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
        <span><i style="background:${PAYMENT_COLORS.efectivo}"></i>Efectivo ${efectivo < 0 ? "−" : ""}${formatBsShort(Math.abs(efectivo))}</span>
        <span><i style="background:${PAYMENT_COLORS.debito}"></i>Débito ${debito < 0 ? "−" : ""}${formatBsShort(Math.abs(debito))}</span>
      </div>
    </div>
    <div class="stat-box">
      <div class="value${deuda > 0 ? " value-debt" : ""}">${formatMoney(deuda)}</div>
      <div class="label">Deuda de tarjeta</div>
      ${cardScheduleHTML(deuda)}
      ${deuda > 0 ? `
        <button type="button" class="link-btn pay-card-link" id="pay-card-toggle">Pagar tarjeta</button>
        <form id="pay-card-form" class="pay-card-form" hidden>
          <input type="number" id="pay-card-amount" placeholder="Monto" min="0.01" step="0.01" max="${deuda.toFixed(2)}" value="${deuda.toFixed(2)}" inputmode="decimal" required>
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
        date: isoDate(new Date()),
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
  const opts = { weekday: "long", day: "2-digit", month: "short" };
  if (dateStr.slice(0, 4) !== today.slice(0, 4)) opts.year = "numeric";
  return capitalize(new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", opts).replace(".", ""));
}

// ---- Buscar en la Lista: nota, categoría, sección, forma de pago o monto,
// en todos los periodos ----
let txnQuery = "";

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
    if (isCash(m.from) && !isCash(m.to) && m.to !== "tarjeta") byWallet[m.to] = (byWallet[m.to] || 0) + m.amount;
    if (isCash(m.to) && !isCash(m.from) && m.from !== "tarjeta") byWallet[m.from] = (byWallet[m.from] || 0) - (m.amountTo != null ? m.amountTo : m.amount);
  });
  return byWallet;
}

function periodSummary(list) {
  const ingresos = list.filter(m => m.type === "ingreso").reduce((s, m) => s + m.amount, 0);
  const gastos = list.filter(m => m.type === "gasto").reduce((s, m) => s + m.amount, 0);
  // El saldo es lo real: lo que se apartó a Ahorro u otras carteras ya no se
  // puede gastar, aunque no sea un gasto. Pagar la tarjeta no se resta: esos
  // gastos ya están en "Gastos".
  const ahorro = Object.values(savingsByWallet(list)).reduce((s, v) => s + v, 0);
  return { ingresos, gastos, ahorro, saldo: ingresos - gastos - ahorro };
}

function renderMovements() {
  const period = currentBudgetPeriod();
  const q = normalizeText(txnQuery.trim());
  const searching = q.length > 0;
  const list = financeCache
    .filter(m => searching ? movementMatches(m, q) : isInPeriod(m.date, period))
    .sort(byNewest);

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
  empty.textContent = searching
    ? `No hay transacciones que coincidan con "${txnQuery.trim()}".`
    : "Aún no hay transacciones en este periodo. Toca + para agregar una.";
  empty.style.display = list.length ? "none" : "block";
  document.getElementById("fin-tab-lista").classList.toggle("is-searching", searching);
  if (currentFinTab() === "lista") document.getElementById("fin-month-nav").hidden = searching;

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
      <div class="txn-day" data-day="${g.date}">
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

// ---- Pestañas internas de Vista general: Vista General / Gasto / Lista ----
const FIN_TAB_KEY = "manolo.finTab";
function currentFinTab() {
  try { return localStorage.getItem(FIN_TAB_KEY) || "lista"; } catch (e) { return "lista"; }
}
function showFinTab(tab) {
  try { localStorage.setItem(FIN_TAB_KEY, tab); } catch (e) { /* sin almacenamiento */ }
  document.querySelectorAll("[data-fin-tab]").forEach(b => b.classList.toggle("active", b.dataset.finTab === tab));
  ["vg", "gasto", "lista"].forEach(t => { document.getElementById(`fin-tab-${t}`).hidden = t !== tab; });
  document.getElementById("fin-tab-lista").classList.remove("day-jump");
  document.getElementById("finance-stats").hidden = tab !== "lista";
  document.getElementById("fin-month-nav").hidden = tab === "vg" || (tab === "lista" && txnQuery.trim() !== "");
}
document.getElementById("fin-inner-tabs").addEventListener("click", e => {
  const btn = e.target.closest("[data-fin-tab]");
  if (btn) showFinTab(btn.dataset.finTab);
});
showFinTab(currentFinTab());

// ---- Pestaña Vista General (como Buddy): gráfico, calendario y presupuesto ----
function periodDays(period) {
  const days = [];
  for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) days.push(isoDate(d));
  return days;
}

// Gasto acumulado por día del periodo: [g1, g1+g2, ...].
function cumulativeSpend(period) {
  const byDay = {};
  financeCache.filter(m => m.type === "gasto" && isInPeriod(m.date, period))
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
  financeCache.filter(m => m.type === "gasto" && isInPeriod(m.date, period))
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
          <stop offset="0%" stop-color="#ff7a30" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#ff7a30" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${media ? `<path d="${mediaPath}" fill="none" style="stroke:#77756f" stroke-width="2" stroke-dasharray="6 6" vector-effect="non-scaling-stroke"/>` : ""}
      <path d="${area}" fill="url(#vg-area)"/>
      <path d="${linePath}" fill="none" style="stroke:#ff7a30" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
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
      jumpToDay(date);
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
    <div class="vg-cal-head">
      <button type="button" class="vg-cal-arrow" data-vg-period="-1" aria-label="Periodo anterior"><span data-icon="chevronLeft"></span></button>
      <span class="vg-cal-title">${periodLabel(period)}</span>
      <button type="button" class="vg-cal-arrow" data-vg-period="1" aria-label="Periodo siguiente"${monthOffset >= 0 ? " disabled" : ""}><span data-icon="chevronRight"></span></button>
    </div>
    <div class="vg-weekdays">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(w => `<span>${w}</span>`).join("")}</div>
    <div class="vg-grid">${cells.join("")}</div>`;
}

function vgBudgetHTML(period) {
  const spent = computeSpentByCategory(period);
  const received = computeReceivedByCategory(period);
  const rows = [];
  (CATEGORIES.ingreso || []).forEach(c => { if (isPlanned(c.id)) rows.push({ cat: c, planned: budgetsCache[c.id] || 0, used: received[c.id] || 0, type: "ingreso" }); });
  categoryGroupsCache.forEach(g => groupCategories(g).forEach(c => {
    if (isPlanned(c.id)) rows.push({ cat: c, planned: budgetsCache[c.id] || 0, used: spent[c.id] || 0, type: "gasto" });
  }));
  if (!rows.length) {
    return `<h3 class="budget-section-title">Presupuesto</h3>
      <p class="info-sub">Todavía no tienes presupuesto para este periodo.</p>
      <a class="vg-link" href="#fin-presupuesto">Crear presupuesto</a>`;
  }
  const totalIncome = incomeBase(period);
  const totalBudget = rows.filter(r => r.type === "gasto").reduce((s, r) => s + r.planned, 0);
  const totalSpent = Object.values(spent).reduce((s, v) => s + v, 0);
  const base = totalIncome > 0 ? totalIncome : totalBudget;
  const left = base - totalSpent;
  const pct = base > 0 ? Math.min(totalSpent / base, 1) : 0;
  const popular = rows.slice().sort((a, b) => b.planned - a.planned).slice(0, 8);
  const alerts = rows
    .map(r => Object.assign({ state: budgetState(r.planned, r.used, r.type) }, r))
    .filter(r => r.state !== "ok")
    .sort((a, b) => (b.used / (b.planned || 1)) - (a.used / (a.planned || 1)));
  const alertsHTML = alerts.length ? `
    <div class="vg-alerts">
      ${alerts.map(r => `
        <button type="button" class="vg-alert ${r.state}" data-cat-detail="${r.cat.id}" data-cat-type="${r.type}">
          <span class="vg-alert-dot"></span>
          <span class="vg-alert-text"><strong>${escapeHtml(r.cat.label)}:</strong> ${r.state === "over"
            ? `te pasaste ${formatBsShort(r.used - r.planned)}`
            : r.used / r.planned < BUDGET_WARN
              ? `vas rápido, ${Math.round(r.used / r.planned * 100)} % usado y pasó el ${Math.round(periodElapsed(period) * 100)} % del periodo`
              : `te quedan ${formatBsShort(r.planned - r.used)} (${Math.round(r.used / r.planned * 100)} % usado)`}</span>
        </button>`).join("")}
    </div>` : "";
  return `
    <a class="vg-budget-head" href="#fin-presupuesto"><h3 class="budget-section-title">Presupuesto</h3><span data-icon="chevronRight"></span></a>
    <div class="vg-label">${left < 0 ? "Sobrepasado" : "Restante para gastar"}</div>
    <div class="vg-big${left < 0 ? " over" : ""}">${formatBsShort(Math.abs(left))}</div>
    <div class="vg-bar"><span style="width:${(pct * 100).toFixed(1)}%"></span></div>
    ${alertsHTML}
    <div class="vg-label vg-popular-label">Categorías populares</div>
    <div class="vg-popular">${popular.map(r => remainingCatHTML(r.cat, r.planned, r.used, r.type)).join("")}</div>`;
}

function renderVistaGeneral() {
  const period = currentBudgetPeriod();
  const gastado = financeCache.filter(m => m.type === "gasto" && isInPeriod(m.date, period)).reduce((s, m) => s + m.amount, 0);
  document.getElementById("vg-spent-label").textContent = `Gastado: ${periodLabel(period)}`;
  document.getElementById("vg-spent-value").textContent = formatBsShort(gastado);
  document.getElementById("vg-chart").innerHTML = vgChartHTML(period);
  document.getElementById("vg-calendar").innerHTML = vgCalendarHTML(period);
  document.getElementById("vg-budget").innerHTML = vgBudgetHTML(period);
  renderIcons(document.getElementById("fin-tab-vg"));
}

document.getElementById("fin-tab-vg").addEventListener("click", e => {
  const arrow = e.target.closest("[data-vg-period]");
  if (arrow) {
    const step = Number(arrow.dataset.vgPeriod);
    if (step > 0 && monthOffset >= 0) return;
    monthOffset += step;
    renderAll();
    return;
  }
  const day = e.target.closest("[data-vg-day].has");
  if (day) {
    showFinTab("lista");
    jumpToDay(day.dataset.vgDay);
    return;
  }
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
  list.filter(m => m.type === gastoMode).forEach(m => { totals[m.category] = (totals[m.category] || 0) + m.amount; });
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

function gastoRingSVG(rows, selectedId) {
  const size = 260, stroke = 22, r = (size - stroke) / 2 - 8, c = 2 * Math.PI * r;
  const total = rows.reduce((s, x) => s + x.amount, 0);
  const gap = rows.length > 1 ? stroke + 10 : stroke + 12;
  let offset = gap / 2;
  const arcs = total > 0 ? rows.map(row => {
    const len = Math.max((row.amount / total) * c - gap, 2);
    const arc = `<circle class="gasto-arc${selectedId && row.id !== selectedId ? " dim" : ""}" data-gasto-pick="${row.id}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
      style="stroke:${row.color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    offset += (row.amount / total) * c;
    return arc;
  }).join("") : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--border)" stroke-width="${stroke}"/>`;
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <defs><filter id="gasto-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g filter="url(#gasto-glow)">${arcs}</g>
  </svg>`;
}

function renderGasto() {
  const list = periodMovements();
  const { ingresos, gastos, saldo } = periodSummary(list);
  const signed = n => `${n < 0 ? "−" : ""}${formatBsShort(Math.abs(n))}`;
  document.getElementById("gasto-summary").innerHTML = `
    <div><strong>${formatBsShort(ingresos)}</strong><span>Ingresos</span></div>
    <div><strong>${formatBsShort(gastos)}</strong><span>Gastos</span></div>
    <div><strong class="${saldo < 0 ? "neg" : ""}">${signed(saldo)}</strong><span>Restante</span></div>
  `;

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
  const amount = parseNum(t.amount);
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

function openTxnSheet(movement) {
  const toStr = n => String(n).replace(".", ",");
  txnSheet = movement
    ? {
        id: movement.id, type: movement.type, category: movement.category, payment: movement.payment || "efectivo",
        amount: toStr(movement.amount), desc: movement.desc || "", date: movement.date,
        excluded: !!movement.excluded, keypad: false,
        from: cashWallet(movement.from || "debito"), to: cashWallet(movement.to || "ahorro"),
        amountTo: movement.amountTo != null ? toStr(movement.amountTo) : "",
        rate: movement.tipoCambio ? toStr(movement.tipoCambio) : "", rateTouched: true,
        readonly: movement.type === "transferencia", movement
      }
    : { id: null, type: "gasto", category: defaultCategory("gasto"), payment: "efectivo", amount: "0", desc: "", date: isoDate(new Date()), excluded: false, keypad: true, from: "debito", to: "ahorro", amountTo: "", rate: "", rateTouched: false, readonly: false };
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
    items: options.map(p => ({ id: p.id, label: p.label, icon: PAYMENT_ICONS[p.id], color: PAYMENT_COLORS[p.id] })),
    onPick: id => { closePicker(); t.payment = id; renderTxnSheet(); }
  });
}

function chooseTxnWallet(side) {
  const t = txnSheet;
  const other = side === "from" ? t.to : t.from;
  const wallets = ledgerWallets().filter(w => w.id !== "tarjeta" && w.id !== other);
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
  // Por si el selector de fecha no avisó el cambio, tomamos lo que muestra.
  applyTxnDateInput(document.getElementById("txn-sheet-date-input").value);
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
    const rate = parseNum(t.rate);
    const payload = { from: t.from, to: t.to, amount, amountTo, desc: t.desc.trim(), date: t.date };
    if (walletCurrency(t.from) !== walletCurrency(t.to) && rate > 0) payload.tipoCambio = rate;
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
  const amount = parseNum(txnSheet.amount), to = parseNum(e.target.value);
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
  if (type !== "gasto" || planned <= 0) return used > planned && type === "gasto" ? "over" : "ok";
  if (used > planned) return "over";
  if (used / planned >= BUDGET_WARN || isFastPace(planned, used, elapsed)) return "warn";
  return "ok";
}

// Más urgente primero: pasadas, en alerta y luego por % usado. Las que no
// tienen movimientos quedan en su orden original.
const STATE_RANK = { over: 2, warn: 1, ok: 0 };
function byUrgency(a, b) {
  const pct = r => r.planned > 0 ? r.used / r.planned : (r.used > 0 ? 1 : 0);
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

  const groupSections = categoryGroupsCache
    .map(g => ({
      title: g.nombre,
      rows: groupCategories(g)
        .map(c => ({ cat: c, planned: budgetsCache[c.id] || 0, used: spent[c.id] || 0 }))
        .filter(r => relevant(r.cat, r.used))
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
  const isIncome = type === "ingreso";
  const over = !isIncome && remaining < 0;
  const pct = planned > 0 ? used / planned : (used > 0 ? 1 : 0);
  const usedLabel = isIncome ? "Recibido" : "Gastado";
  const fast = !isIncome && !over && planned > 0 && used / planned < BUDGET_WARN && isFastPace(planned, used, periodElapsed(period));
  const headline = isIncome
    ? `<div class="cat-detail-remaining income${planned > 0 && used >= planned ? " done" : ""}">${incomeProgressHTML(used, planned)}</div>`
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
      <div><span>${isIncome ? "Meta" : "Presupuesto"}</span><strong>${formatBsShort(planned)}</strong></div>
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
  return `<div class="remain-daily${result < 0 ? " over" : ""}">
    Puedes gastar <strong>${formatBsShort(Math.round(daily))}</strong> por día · quedan ${days} día${days === 1 ? "" : "s"}
  </div>`;
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
  if (isSheetOpen(document.getElementById("category-selector-modal"))) return;
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

// ================= Tarjeta de crédito: se paga el total el 29 de cada mes =================
// (en meses más cortos, el último día).
const CARD_PAY_DAY = 29;

function nextCardPayDate() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const inMonth = (y, m) => new Date(y, m, Math.min(CARD_PAY_DAY, new Date(y, m + 1, 0).getDate()));
  let d = inMonth(today.getFullYear(), today.getMonth());
  if (d < today) d = inMonth(today.getFullYear(), today.getMonth() + 1);
  return { date: d, days: Math.round((d - today) / 86400000) };
}

// Línea del panel de Deuda de tarjeta.
function cardScheduleHTML(deuda) {
  const { date, days } = nextCardPayDate();
  const when = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
  if (deuda <= 0) return `<div class="card-sched"><span>Próximo pago: ${when}</span></div>`;
  if (days === 0) return `<div class="card-sched alert"><strong>Hoy toca pagar la tarjeta: ${formatBsShort(deuda)}</strong></div>`;
  return `<div class="card-sched"><span>Pagar el ${when} · ${days === 1 ? "mañana" : `en ${days} días`}</span></div>`;
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
async function createTransfer({ from, to, amount, amountTo, desc, date, tipoCambio }) {
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
  const record = { date, type: "transferencia", category: "transferencia", from, to, amount, amountTo, desc: desc || "", links, createdAt: Date.now() };
  if (tipoCambio) record.tipoCambio = tipoCambio;
  return financeCollection().add(record);
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

// Cada parte se dibuja por separado: si una falla (por ejemplo, por un dato
// viejo con un formato raro), las demás siguen apareciendo.
const RENDERERS = [
  renderStats, updateMonthLabel, renderMovements, renderGasto, renderVistaGeneral,
  updateBudgetMonthLabel, renderBudgets, renderBudgetInputs, renderBudgetSummary, renderBudgetInfo,
  renderCategoryGroups, renderPeriodSettings, renderWallets, updateExportSummary
];
function renderAll() {
  RENDERERS.forEach(fn => {
    try { fn(); } catch (err) { console.error("Manolo: falló " + fn.name, err); }
  });
}


onAuthReady(() => {
  financeCollection().onSnapshot(snap => {
    financeCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
  budgetConfigDocRef().onSnapshot(doc => {
    const day = doc.exists ? Number(doc.data().startDay) : 1;
    budgetStartDay = day >= 1 && day <= 30 ? day : 1;
    renderAll();
  });
  budgetDocRef().onSnapshot(doc => {
    budgetsCache = doc.exists ? doc.data() : {};
    renderAll();
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
    groupsLoaded = true;
    migrateLegacyCustom();
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
  customCategoriesDocRef().get().then(doc => {
    const data = doc.exists ? doc.data() : null;
    legacyCustom = (data && Array.isArray(data.categories)) ? data.categories : [];
    migrateLegacyCustom();
  }).catch(() => {});
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
