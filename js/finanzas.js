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
let ahorrosCache = [];
let carterasCustomCache = []; // carteras que el usuario crea a mano, con su propio saldo
let carterasMovCache = []; // movimientos (aportes, retiros, transferencias) de esas carteras

function financeCollection() {
  return db.collection("users").doc(currentUser.uid).collection("finanzas");
}
function budgetDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("presupuestos");
}
function categoriasDocRef() {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc("categorias_gasto");
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

function computeSpentByCategory(monthDate) {
  const spent = {};
  gastoCategoriesCache.forEach(c => { spent[c.id] = 0; });
  financeCache
    .filter(m => m.type === "gasto" && isInMonth(m.date, monthDate))
    .forEach(m => { spent[m.category] = (spent[m.category] || 0) + m.amount; });
  return spent;
}

function progressRing(pct, color) {
  const size = 60, strokeWidth = 6;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(pct, 0), 1));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeWidth}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function donutChart(segments) {
  const size = 120, innerRadius = 35, outerRadius = 55;
  let circles = [];
  let startAngle = -Math.PI / 2;

  segments.forEach(seg => {
    const angle = seg.percentage * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = size / 2 + outerRadius * Math.cos(startAngle);
    const y1 = size / 2 + outerRadius * Math.sin(startAngle);
    const x2 = size / 2 + outerRadius * Math.cos(endAngle);
    const y2 = size / 2 + outerRadius * Math.sin(endAngle);

    const ix1 = size / 2 + innerRadius * Math.cos(startAngle);
    const iy1 = size / 2 + innerRadius * Math.sin(startAngle);
    const ix2 = size / 2 + innerRadius * Math.cos(endAngle);
    const iy2 = size / 2 + innerRadius * Math.sin(endAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${ix2} ${iy2}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}
      Z
    `;

    circles.push(`<path d="${path}" fill="${seg.color}" stroke="white" stroke-width="1"/>`);
    startAngle = endAngle;
  });

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:0 auto">
    ${circles.join("")}
  </svg>`;
}

function updateBudgetMonthLabel() {
  const monthDate = currentMonthDate();
  document.getElementById("budget-month-label").textContent = monthLabel(monthDate);
  document.getElementById("budget-month-next").disabled = monthOffset >= 0;
}

// ---- Restante: anillo por categoría (spent vs. presupuestado) ----
function renderBudgets() {
  const monthDate = currentMonthDate();
  const spent = computeSpentByCategory(monthDate);
  const grid = document.getElementById("budget-grid");
  grid.innerHTML = "";

  gastoCategoriesCache.forEach(cat => {
    const budget = budgetsCache[cat.id] || 0;
    const s = spent[cat.id] || 0;
    const over = budget > 0 && s > budget;
    const pct = budget > 0 ? s / budget : 0;
    const remaining = budget - s;

    const card = document.createElement("div");
    card.className = "budget-card";
    card.innerHTML = `
      <div class="budget-ring">
        ${progressRing(pct, over ? "var(--danger)" : cat.color)}
        <span class="budget-ring-icon" style="color:${over ? "var(--danger)" : cat.color}" data-icon="${cat.icon}"></span>
      </div>
      <div class="budget-info">
        <div class="budget-cat-label">${cat.label}</div>
        ${budget > 0
          ? `<div class="budget-amount${over ? " over" : ""}">${over ? formatMoney(Math.abs(remaining)) + " sobrepasado" : formatMoney(remaining) + " restante"}</div>`
          : `<div class="budget-amount muted">Sin presupuesto</div>`}
      </div>
    `;
    grid.appendChild(card);
    renderIcons(card);
  });
}

// ---- Planificación: lista editable agrupada por tipo (como Buddy) ----
function renderBudgetInputs() {
  const container = document.getElementById("budget-inputs");
  const focused = document.activeElement;
  const focusedCat = focused && focused.dataset ? focused.dataset.cat : null;

  // Agrupar solo las categorías que TIENEN presupuesto asignado
  const ingresos = (CATEGORIES.ingreso || []).filter(c => budgetsCache[c.id] > 0);
  const gastos = gastoCategoriesCache.filter(c => budgetsCache[c.id] > 0);

  const sections = [
    { title: "Ingresos", categories: ingresos, allCategories: CATEGORIES.ingreso || [], type: "ingreso" },
    { title: "Gastos", categories: gastos, allCategories: gastoCategoriesCache, type: "gasto" }
  ];

  container.innerHTML = sections.map(section => `
    <div class="budget-section">
      <h3 class="budget-section-title">${section.title}</h3>
      <div class="budget-section-items">
        ${section.categories.map(c => `
          <label class="budget-input-row">
            <span class="cat-icon" style="background:${c.color}22; color:${c.color}" data-icon="${c.icon}"></span>
            <span class="budget-input-label">${c.label}</span>
            <input type="number" min="0" step="1" data-cat="${c.id}" value="${budgetsCache[c.id] || ""}" placeholder="0">
          </label>
        `).join("")}
        <button type="button" class="budget-add-btn" data-section="${section.type}" aria-label="Agregar categoría">
          <span data-icon="plus"></span>
          Añade una categoría
        </button>
      </div>
    </div>
  `).join("");
  renderIcons(container);

  if (focusedCat) {
    const input = container.querySelector(`input[data-cat="${focusedCat}"]`);
    if (input) input.focus();
  }
}

function renderBudgetSummary() {
  const monthDate = currentMonthDate();
  const spent = computeSpentByCategory(monthDate);

  // Get categories with budget and their percentages
  const withBudget = gastoCategoriesCache.filter(c => (budgetsCache[c.id] || 0) > 0);
  const totalBudget = withBudget.reduce((s, c) => s + budgetsCache[c.id], 0);

  const ringContainer = document.getElementById("budget-summary-ring");
  const valueContainer = document.getElementById("budget-summary-value");
  const subContainer = document.getElementById("budget-summary-sub");

  if (withBudget.length === 0) {
    ringContainer.innerHTML = "";
    valueContainer.textContent = formatMoney(0);
    subContainer.textContent = "Agrega montos abajo para empezar";
    return;
  }

  // Create donut chart segments
  const segments = withBudget.map(c => ({
    label: c.label,
    color: c.color,
    percentage: budgetsCache[c.id] / totalBudget
  }));

  ringContainer.innerHTML = donutChart(segments);

  // Render category breakdown below chart
  const breakdown = segments
    .sort((a, b) => b.percentage - a.percentage)
    .map(seg => `<div class="breakdown-item"><span class="dot" style="background:${seg.color}"></span><span>${seg.label} ${Math.round(seg.percentage * 100)}%</span></div>`)
    .join("");

  if (!document.getElementById("budget-breakdown")) {
    const breakdownDiv = document.createElement("div");
    breakdownDiv.id = "budget-breakdown";
    breakdownDiv.className = "budget-breakdown";
    ringContainer.parentElement.appendChild(breakdownDiv);
  }

  document.getElementById("budget-breakdown").innerHTML = breakdown;
  valueContainer.textContent = formatMoney(totalBudget);

  const totalSpent = withBudget.reduce((s, c) => s + (spent[c.id] || 0), 0);
  subContainer.textContent = totalBudget > 0
    ? `${formatMoney(Math.max(totalBudget - totalSpent, 0))} restante este mes`
    : "Agrega montos abajo para empezar";
}

function renderBudgetInfo() {
  const monthDate = currentMonthDate();
  const spent = computeSpentByCategory(monthDate);
  const withBudget = gastoCategoriesCache.filter(c => (budgetsCache[c.id] || 0) > 0);
  const totalBudget = withBudget.reduce((s, c) => s + budgetsCache[c.id], 0);
  const totalSpent = gastoCategoriesCache.reduce((s, c) => s + (spent[c.id] || 0), 0);

  document.getElementById("budget-info-stats").innerHTML = `
    <div class="stat-box"><div class="value">${withBudget.length}/${gastoCategoriesCache.length}</div><div class="label">Categorías con presupuesto</div></div>
    <div class="stat-box"><div class="value">${formatMoney(totalBudget)}</div><div class="label">Total presupuestado</div></div>
    <div class="stat-box"><div class="value">${formatMoney(totalSpent)}</div><div class="label">Gastado en ${monthLabel(monthDate).toLowerCase()}</div></div>
  `;
}

document.getElementById("budget-form").addEventListener("submit", e => {
  e.preventDefault();
  const budgets = {};
  document.querySelectorAll("#budget-inputs input").forEach(input => {
    const v = parseFloat(input.value);
    if (v > 0) budgets[input.dataset.cat] = v;
  });
  budgetDocRef().set(budgets);
});

// Agregar categoría al presupuesto
document.getElementById("budget-inputs").addEventListener("click", e => {
  const addBtn = e.target.closest(".budget-add-btn");
  if (!addBtn) return;
  e.preventDefault();

  const sectionType = addBtn.dataset.section;
  const allCategories = sectionType === "ingreso" ? (CATEGORIES.ingreso || []) : gastoCategoriesCache;
  const assigned = allCategories.filter(c => budgetsCache[c.id] > 0).map(c => c.id);
  const available = allCategories.filter(c => !assigned.includes(c.id));

  if (available.length === 0) {
    alert("No hay más categorías disponibles en esta sección");
    return;
  }

  // Mostrar selector de categoría
  const selected = prompt(
    `Selecciona una categoría:\n\n${available.map((c, i) => `${i + 1}. ${c.label}`).join("\n")}`,
    "1"
  );

  if (!selected || isNaN(selected)) return;
  const idx = parseInt(selected) - 1;
  if (idx < 0 || idx >= available.length) return;

  const cat = available[idx];
  budgetsCache[cat.id] = 0; // Agregar con presupuesto 0
  renderBudgetInputs();
  renderBudgetSummary();

  // Enfocar el input de la categoría recién agregada
  setTimeout(() => {
    const input = document.querySelector(`input[data-cat="${cat.id}"]`);
    if (input) input.focus();
  }, 10);
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
  budgetDocRef().onSnapshot(doc => {
    budgetsCache = doc.exists ? doc.data() : {};
    renderAll();
  });
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
    gastoCategoriesCache = flattenCategoryGroups(categoryGroupsCache);
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
