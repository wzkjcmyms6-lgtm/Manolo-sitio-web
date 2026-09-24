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
      flat.push({ id: item.id, label: item.label, icon: item.icon, color, groupId: g.id });
    });
  });
  return flat;
}

function findCategory(type, id) {
  if (type === "pago_tarjeta" || type === "ajuste_tarjeta") return CARD_PAYMENT_CATEGORY;
  const list = type === "gasto" ? gastoCategoriesCache : (CATEGORIES[type] || []);
  return list.find(c => c.id === id) || gastoCategoriesCache.find(c => c.id === "otros") || CATEGORIES.gasto[CATEGORIES.gasto.length - 1];
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
function computeTotals(list) {
  let saldo = 0, deuda = 0;
  list.forEach(m => {
    if (m.type === "ingreso") {
      saldo += m.amount;
    } else if (m.type === "gasto") {
      if (m.payment === "credito") deuda += m.amount;
      else saldo -= m.amount;
    } else if (m.type === "pago_tarjeta") {
      saldo -= m.amount;
      deuda -= m.amount;
    } else if (m.type === "ajuste_tarjeta") {
      // Pago de la tarjeta hecho con plata de otra cartera (Ahorro, etc.):
      // solo baja la deuda, no toca el saldo de Gastos (esa plata no salió
      // de ahí).
      deuda -= m.amount;
    }
  });
  return { saldo, deuda };
}

// ================= Resumen =================

function renderStats() {
  const { saldo, deuda } = computeTotals(financeCache);
  const monthDate = currentMonthDate();
  const gastosMes = financeCache
    .filter(m => m.type === "gasto" && isInMonth(m.date, monthDate))
    .reduce((s, m) => s + m.amount, 0);

  const stats = document.getElementById("finance-stats");
  stats.innerHTML = `
    <div class="stat-box"><div class="value">${formatMoney(saldo)}</div><div class="label">Saldo disponible</div></div>
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
    <div class="stat-box"><div class="value">${formatMoney(gastosMes)}</div><div class="label">Gastos de ${monthLabel(monthDate).toLowerCase()}</div></div>
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
  const monthDate = currentMonthDate();
  document.getElementById("month-label-text").textContent = monthLabel(monthDate);
  document.getElementById("month-next").disabled = monthOffset >= 0;
}

function populateCategorySelect(type) {
  const sel = document.getElementById("finance-category");
  const list = type === "gasto" ? gastoCategoriesCache : (CATEGORIES[type] || []);
  sel.innerHTML = list.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
}
function populatePaymentSelect(type) {
  const sel = document.getElementById("finance-payment");
  const options = type === "ingreso" ? PAYMENTS.filter(p => p.id !== "credito") : PAYMENTS;
  sel.innerHTML = options.map(p => `<option value="${p.id}">${p.label}</option>`).join("");
}

function renderMovements() {
  const monthDate = currentMonthDate();
  const list = financeCache
    .filter(m => isInMonth(m.date, monthDate))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));

  const container = document.getElementById("finance-list");
  const empty = document.getElementById("finance-empty");
  const count = document.getElementById("month-count");

  container.innerHTML = "";
  count.textContent = list.length ? `${list.length} movimiento${list.length === 1 ? "" : "s"}` : "";
  empty.style.display = list.length ? "none" : "block";

  const groups = [];
  let lastDate = null, group = null;
  list.forEach(m => {
    if (m.date !== lastDate) {
      group = { date: m.date, items: [] };
      groups.push(group);
      lastDate = m.date;
    }
    group.items.push(m);
  });

  groups.forEach(g => {
    // ajuste_tarjeta no mueve plata de Gastos (viene de otra cartera), así
    // que no cuenta para el total de efectivo del día.
    const dayTotal = g.items.reduce((s, m) =>
      s + (m.type === "ingreso" ? m.amount : m.type === "ajuste_tarjeta" ? 0 : -m.amount), 0);
    const dayLabel = capitalize(new Date(g.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" }));

    const header = document.createElement("div");
    header.className = "day-header";
    const totalClass = dayTotal > 0 ? "pos" : dayTotal < 0 ? "neg" : "";
    const totalText = dayTotal === 0 ? formatMoney(0) : (dayTotal > 0 ? "+" : "−") + formatMoney(Math.abs(dayTotal));
    header.innerHTML = `<span>${dayLabel}</span><span class="${totalClass}">${totalText}</span>`;
    container.appendChild(header);

    g.items.forEach(m => {
      const cat = findCategory(m.type, m.category);
      const pay = findPayment(m.payment);
      const sign = m.type === "ingreso" ? "+" : "−";
      const amountClass = m.type === "ingreso" ? "pos" : "neg";

      const item = document.createElement("div");
      item.className = "txn-item";
      item.innerHTML = `
        <span class="txn-icon" style="background:${cat.color}22; color:${cat.color}" data-icon="${cat.icon}"></span>
        <div class="txn-body">
          <div class="txn-desc">${m.desc}</div>
          <div class="meta">${cat.label}${pay ? " · " + pay.label : ""}</div>
        </div>
        <div class="txn-amount ${amountClass}">${sign}${formatMoney(m.amount)}</div>
      `;
      const del = document.createElement("button");
      del.className = "delete";
      del.setAttribute("aria-label", "Eliminar movimiento");
      del.innerHTML = ICONS.trash;
      del.addEventListener("click", () => deleteMovement(m.id));
      item.appendChild(del);
      container.appendChild(item);
      renderIcons(item);
    });
  });
}

function deleteMovement(id) {
  financeCollection().doc(id).delete();
}

document.getElementById("finance-type").addEventListener("change", e => {
  populateCategorySelect(e.target.value);
  populatePaymentSelect(e.target.value);
});

document.getElementById("finance-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("finance-date").value;
  const type = document.getElementById("finance-type").value;
  const category = document.getElementById("finance-category").value;
  const payment = document.getElementById("finance-payment").value;
  const desc = document.getElementById("finance-desc").value.trim();
  const amount = parseFloat(document.getElementById("finance-amount").value);
  if (!date || !desc || !amount) return;

  financeCollection().add({ date, type, category, payment, desc, amount });
  e.target.reset();
  document.getElementById("finance-date").valueAsDate = new Date();
  populateCategorySelect("ingreso");
  populatePaymentSelect("ingreso");
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
    .filter(m => m.type === "gasto" && isInPeriod(m.date, period))
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
    .filter(m => m.type === "ingreso" && isInPeriod(m.date, period))
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
  document.getElementById("cat-detail-sheet").removeAttribute("hidden");
}

function closeCategoryDetail() {
  document.getElementById("cat-detail-sheet").setAttribute("hidden", "");
  catDetail = null;
}

function renderCategoryDetail() {
  const { type, catId } = catDetail;
  const period = currentBudgetPeriod();
  const cat = findBudgetCategory(type, catId) || findCategory(type, catId);
  const movements = financeCache
    .filter(m => m.type === type && m.category === catId && isInPeriod(m.date, period))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));

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
  return (group.items || []).map(item => ({ id: item.id, label: item.label, icon: item.icon, emoji: item.emoji, color }));
}

function isSectionVisible(group) {
  return visibleBudgetSections.has(group.id) || (group.items || []).some(i => isPlanned(i.id));
}

function catBadgeHTML(c) {
  return c.emoji
    ? `<span class="cat-emoji" style="background:${c.color}; color:#fff;">${c.emoji}</span>`
    : `<span class="cat-icon" style="background:${c.color}22; color:${c.color}" data-icon="${c.icon}"></span>`;
}

function budgetSectionHTML(title, color, categories, sectionAttr, deletableGroupId) {
  const planned = categories.filter(c => isPlanned(c.id));
  return `
    <div class="budget-section">
      <div class="budget-section-head">
        <h3 class="budget-section-title">${escapeHtml(title)}</h3>
        ${deletableGroupId ? `<button type="button" class="budget-section-delete" data-delete-section="${deletableGroupId}" aria-label="Eliminar sección ${escapeHtml(title)}"><span data-icon="trash"></span></button>` : ""}
      </div>
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
    .map(g => budgetSectionHTML(g.nombre, groupColor(g), groupCategories(g), `data-group-id="${g.id}"`, g.id))
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

function renderBudgetInfo() {
  const period = currentBudgetPeriod();
  const spent = computeSpentByCategory(period);
  const withBudget = gastoCategoriesCache.filter(c => (budgetsCache[c.id] || 0) > 0);
  const totalBudget = withBudget.reduce((s, c) => s + budgetsCache[c.id], 0);
  const totalSpent = gastoCategoriesCache.reduce((s, c) => s + (spent[c.id] || 0), 0);

  document.getElementById("budget-info-stats").innerHTML = `
    <div class="stat-box"><div class="value">${withBudget.length}/${gastoCategoriesCache.length}</div><div class="label">Categorías con presupuesto</div></div>
    <div class="stat-box"><div class="value">${formatMoney(totalBudget)}</div><div class="label">Total presupuestado</div></div>
    <div class="stat-box"><div class="value">${formatMoney(totalSpent)}</div><div class="label">Gastado del ${periodLabel(period)}</div></div>
  `;
}

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

  document.getElementById("category-selector-modal").removeAttribute("hidden");
}

function closePicker() {
  document.getElementById("category-selector-modal").setAttribute("hidden", "");
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
  budgetSheet = { type, groupId, catId, originalCatId: catId, amount };
  if (!catId) {
    const first = sheetCandidates()[0];
    budgetSheet.catId = first ? first.id : null;
  }
  renderBudgetSheet();
  document.getElementById("budget-sheet").removeAttribute("hidden");
}

function closeBudgetSheet() {
  document.getElementById("budget-sheet").setAttribute("hidden", "");
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
  document.getElementById("budget-sheet-delete").hidden = !s.originalCatId;
  document.getElementById("budget-sheet-ok").disabled = !cat;
  renderIcons(document.getElementById("budget-sheet"));
}

function chooseSheetCategory() {
  const s = budgetSheet;
  const group = s.groupId ? categoryGroupsCache.find(g => g.id === s.groupId) : null;
  const pick = catId => { closePicker(); s.catId = catId; renderBudgetSheet(); };
  openPicker({
    title: s.type === "ingreso" ? "Elige un ingreso" : (group ? `Elige en ${group.nombre}` : "Elige una categoría"),
    items: sheetCandidates(),
    createLabel: "Crear nueva categoría",
    onPick: pick,
    onCreate: s.type === "ingreso" || !group ? null : () => {
      const name = (prompt("Nombre de la nueva categoría:") || "").trim();
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

function pressSheetKey(key) {
  const s = budgetSheet;
  if (key === "back") {
    s.amount = s.amount.slice(0, -1) || "0";
  } else if (key === ",") {
    if (!s.amount.includes(",")) s.amount += ",";
  } else if (/^\d$/.test(key)) {
    const dec = s.amount.split(",")[1];
    if (dec !== undefined && dec.length >= 2) return;
    if (s.amount.replace(",", "").length >= 10) return;
    s.amount = s.amount === "0" ? key : s.amount + key;
  }
  document.getElementById("budget-sheet-amount").textContent = formatSheetAmount(s.amount);
}

function confirmBudgetSheet() {
  const s = budgetSheet;
  const cat = findBudgetCategory(s.type, s.catId);
  if (!cat) return;
  const amount = parseFloat(s.amount.replace(",", ".")) || 0;
  if (s.originalCatId && s.originalCatId !== cat.id) delete budgetsCache[s.originalCatId];
  budgetsCache[cat.id] = amount;
  if (cat.groupId) visibleBudgetSections.add(cat.groupId);
  closeBudgetSheet();
  renderBudgetInputs();
  renderBudgetSummary();
  saveBudgets();
}

function deleteBudgetFromSheet() {
  const s = budgetSheet;
  if (!s.originalCatId) return;
  delete budgetsCache[s.originalCatId];
  closeBudgetSheet();
  renderBudgetInputs();
  renderBudgetSummary();
  saveBudgets();
}

document.getElementById("budget-sheet").addEventListener("click", e => {
  if (!budgetSheet) return;
  const key = e.target.closest("[data-key]");
  if (key) { pressSheetKey(key.dataset.key); return; }
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
  if (!budgetSheet || !document.getElementById("category-selector-modal").hidden) return;
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
    onCreate: () => {
      const nombre = (prompt("Nombre de la nueva sección:") || "").trim();
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

// Quita la sección del presupuesto (con doble confirmación). Los movimientos
// no se tocan; si la sección no tiene categorías, se borra del todo.
function deleteBudgetSection(groupId) {
  const group = categoryGroupsCache.find(g => g.id === groupId);
  if (!group) return;
  const items = group.items || [];
  const planned = items.filter(i => isPlanned(i.id));
  const total = planned.reduce((s, i) => s + (budgetsCache[i.id] || 0), 0);

  if (!window.confirm(`¿Eliminar la sección "${group.nombre}" de tu presupuesto?`)) return;
  const detail = planned.length
    ? `Se borrarán los montos de ${planned.length} categoría${planned.length === 1 ? "" : "s"} (${formatBsShort(total)}).`
    : "La sección no tiene montos cargados.";
  if (!window.confirm(`¿Seguro? ${detail} Tus movimientos no se borran. Esta acción no se puede deshacer.`)) return;

  planned.forEach(i => { delete budgetsCache[i.id]; });
  visibleBudgetSections.delete(groupId);
  if (!items.length) {
    const next = categoryGroupsCache.filter(g => g.id !== groupId);
    categoryGroupsCache = next;
    saveCategoryGroups(next);
  }
  renderBudgetInputs();
  renderBudgetSummary();
  renderBudgets();
  saveBudgets();
}

document.getElementById("budget-inputs").addEventListener("click", e => {
  if (e.target.closest(".budget-add-section-btn")) {
    openSectionPicker();
    return;
  }
  const delSection = e.target.closest("[data-delete-section]");
  if (delSection) {
    deleteBudgetSection(delSection.dataset.deleteSection);
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

const EMOJI_CHOICES = ["🍕", "🍔", "🍜", "🥗", "🍜", "🍰", "☕", "🍷", "🚗", "🚕", "🚌", "✈️", "🏠", "🏠", "🏥", "💊", "💪", "🏋️", "🎬", "🎮", "🎵", "📚", "🎓", "👕", "👟", "💄", "⌚", "💳", "💰", "💸", "🎁", "🎪", "⚽", "🎾", "🏊", "🚴"];

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

function renderCategoryGroups() {
  const container = document.getElementById("category-groups");
  container.innerHTML = categoryGroupsCache.map((g, gi) => {
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

function deleteCategoryItem(groupId, itemId) {
  const group = categoryGroupsCache.find(g => g.id === groupId);
  const item = group && group.items.find(i => i.id === itemId);
  if (!group || !item) return;
  if (!window.confirm(`¿Eliminar la categoría "${item.label}"? Esto no borra los gastos que ya la usan.`)) return;

  const next = categoryGroupsCache
    .map(g => g.id === groupId ? Object.assign({}, g, { items: g.items.filter(i => i.id !== itemId) }) : g)
    .filter(g => g.items.length > 0);
  saveCategoryGroups(next);
}

document.getElementById("category-groups").addEventListener("click", e => {
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
    { id: "gastos", nombre: "Yo", moneda: "Bs", builtIn: true },
    { id: "tarjeta", nombre: "Tarjeta de crédito", moneda: "Bs", builtIn: true, soloDestino: true },
    { id: "ahorro", nombre: "Ahorro", moneda: "US$", builtIn: true }
  ].concat(carterasCustomCache.map(w => Object.assign({ builtIn: false }, w)));
}

// Registra que entró/salió plata de una cartera. Para Gastos y Tarjeta de
// crédito, en vez de guardarlo aparte, crea el movimiento real de Finanzas
// que corresponde, así el saldo y la deuda quedan siempre correctos.
function addWalletMovement(walletId, monto, nota) {
  const fecha = new Date().toISOString().slice(0, 10);
  if (walletId === "ahorro") {
    return ahorrosCollection().add({ date: fecha, amount: monto, notes: nota });
  } else if (walletId === "gastos") {
    if (monto >= 0) {
      return financeCollection().add({ date: fecha, type: "ingreso", category: "otros_ingresos", payment: "efectivo", desc: nota, amount: monto });
    } else {
      return financeCollection().add({ date: fecha, type: "gasto", category: "otros", payment: "efectivo", desc: nota, amount: -monto });
    }
  } else if (walletId === "tarjeta") {
    return financeCollection().add({ date: fecha, type: "ajuste_tarjeta", desc: nota, amount: monto });
  } else {
    return carterasMovimientosCollection().add({ carteraId: walletId, fecha, monto, nota });
  }
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
  const { saldo, deuda } = computeTotals(financeCache);
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
    { label: "Yo", lines: [formatMoney(saldo)] },
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
    walletHTML("finance", "#ff9a4d", "Yo", formatMoney(saldo), false, "gastos") +
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
function walletMovementsFor(walletId) {
  if (walletId === "gastos") {
    return financeCache
      .filter(m => m.type === "ingreso" || (m.type === "gasto" && m.payment !== "credito") || m.type === "pago_tarjeta")
      .map(m => ({
        id: m.id, date: m.date, desc: m.desc,
        icon: findCategory(m.type, m.category).icon, color: findCategory(m.type, m.category).color,
        amount: m.type === "ingreso" ? m.amount : -m.amount,
        meta: findPayment(m.payment) ? findPayment(m.payment).label : "",
        usd: false,
        onDelete: () => deleteMovement(m.id)
      }));
  } else if (walletId === "tarjeta") {
    return financeCache
      .filter(m => (m.type === "gasto" && m.payment === "credito") || m.type === "pago_tarjeta" || m.type === "ajuste_tarjeta")
      .map(m => ({
        id: m.id, date: m.date, desc: m.desc,
        icon: findCategory(m.type, m.category).icon, color: findCategory(m.type, m.category).color,
        amount: m.type === "gasto" ? -m.amount : m.amount,
        meta: "",
        usd: false,
        onDelete: () => deleteMovement(m.id)
      }));
  } else if (walletId === "ahorro") {
    return ahorrosCache.map(a => ({
      id: a.id, date: a.date, desc: a.notes || "Ahorro",
      icon: "wallet", color: "#5cc98a",
      amount: a.amount,
      meta: "",
      usd: true,
      onDelete: () => ahorrosCollection().doc(a.id).delete()
    }));
  } else {
    const w = carterasCustomCache.find(x => x.id === walletId);
    return carterasMovCache.filter(m => m.carteraId === walletId).map(m => ({
      id: m.id, date: m.fecha, desc: m.nota || "Movimiento",
      icon: "wallet", color: "#9b6bde",
      amount: m.monto,
      meta: "",
      usd: !!w && w.moneda === "US$",
      onDelete: () => carterasMovimientosCollection().doc(m.id).delete()
    }));
  }
}

function walletVisual(walletId) {
  if (walletId === "gastos") return { icon: "finance", color: "#ff9a4d" };
  if (walletId === "tarjeta") return { icon: "finance", color: "#e05656" };
  if (walletId === "ahorro") return { icon: "wallet", color: "#5cc98a" };
  const i = carterasCustomCache.findIndex(w => w.id === walletId);
  return { icon: "wallet", color: CATEGORY_COLOR_POOL[Math.max(i, 0) % CATEGORY_COLOR_POOL.length] };
}

function walletBalanceText(walletId) {
  const { saldo, deuda } = computeTotals(financeCache);
  if (walletId === "gastos") return formatMoney(saldo);
  if (walletId === "tarjeta") return deuda > 0 ? "−" + formatMoney(deuda) : formatMoney(0);
  if (walletId === "ahorro") return formatUSD(ahorrosCache.reduce((s, a) => s + a.amount, 0));
  const w = carterasCustomCache.find(x => x.id === walletId);
  if (!w) return "";
  return w.moneda === "US$" ? formatUSD(customWalletBalance(walletId)) : formatMoney(customWalletBalance(walletId));
}

function renderWalletDetail() {
  if (!selectedWalletId) return;
  const wallets = ledgerWallets();
  const w = wallets.find(x => x.id === selectedWalletId);
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
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)))
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
        <div class="txn-desc">${m.desc}</div>
        <div class="meta">${dateLabel}${m.meta ? " · " + m.meta : ""}</div>
      </div>
      <div class="txn-amount ${amountClass}">${sign}${amountText}</div>
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
  Promise.all([
    addWalletMovement(fromId, -amountFrom, `Transferencia a ${toW.nombre}${notes ? " · " + notes : ""}`),
    addWalletMovement(toId, amountTo, `Transferencia desde ${fromW.nombre}${notes ? " · " + notes : ""}`)
  ]).then(() => {
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

document.getElementById("finance-date").valueAsDate = new Date();
populateCategorySelect("ingreso");
populatePaymentSelect("ingreso");

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
