const FINANCE_KEY = "manolo_finanzas";
const BUDGET_KEY = "manolo_presupuestos";

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

const PAYMENTS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Tarjeta de crédito" }
];

let monthOffset = 0; // 0 = mes actual, -1 = mes anterior, etc.

function findCategory(type, id) {
  if (type === "pago_tarjeta") return CARD_PAYMENT_CATEGORY;
  return (CATEGORIES[type] || []).find(c => c.id === id) || CATEGORIES.gasto.find(c => c.id === "otros");
}
function findPayment(id) {
  return PAYMENTS.find(p => p.id === id);
}

function loadMovements() {
  return JSON.parse(localStorage.getItem(FINANCE_KEY) || "[]");
}
function saveMovements(list) {
  localStorage.setItem(FINANCE_KEY, JSON.stringify(list));
}
function loadBudgets() {
  return JSON.parse(localStorage.getItem(BUDGET_KEY) || "{}");
}
function saveBudgets(budgets) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

function formatMoney(n) {
  return n.toLocaleString("es-BO", { style: "currency", currency: "BOB" });
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    }
  });
  return { saldo, deuda };
}

// ================= Resumen =================

function renderStats() {
  const all = loadMovements();
  const { saldo, deuda } = computeTotals(all);
  const monthDate = currentMonthDate();
  const gastosMes = all
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
      const list = loadMovements();
      list.push({
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        type: "pago_tarjeta",
        category: "pago_tarjeta",
        payment: source,
        desc: "Pago de tarjeta de crédito",
        amount
      });
      saveMovements(list);
      renderAll();
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
  sel.innerHTML = (CATEGORIES[type] || []).map(c => `<option value="${c.id}">${c.label}</option>`).join("");
}
function populatePaymentSelect(type) {
  const sel = document.getElementById("finance-payment");
  const options = type === "ingreso" ? PAYMENTS.filter(p => p.id !== "credito") : PAYMENTS;
  sel.innerHTML = options.map(p => `<option value="${p.id}">${p.label}</option>`).join("");
}

function renderMovements() {
  const monthDate = currentMonthDate();
  const list = loadMovements()
    .filter(m => isInMonth(m.date, monthDate))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

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
    const dayTotal = g.items.reduce((s, m) => s + (m.type === "ingreso" ? m.amount : -m.amount), 0);
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
  saveMovements(loadMovements().filter(m => m.id !== id));
  renderAll();
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

  const list = loadMovements();
  list.push({ id: Date.now(), date, type, category, payment, desc, amount });
  saveMovements(list);
  e.target.reset();
  document.getElementById("finance-date").valueAsDate = new Date();
  populateCategorySelect("ingreso");
  populatePaymentSelect("ingreso");
  renderAll();
});

document.getElementById("month-prev").addEventListener("click", () => { monthOffset--; renderAll(); });
document.getElementById("month-next").addEventListener("click", () => { monthOffset++; renderAll(); });

// ================= Presupuesto =================

function computeSpentByCategory(monthDate) {
  const spent = {};
  CATEGORIES.gasto.forEach(c => { spent[c.id] = 0; });
  loadMovements()
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

function renderBudgets() {
  const monthDate = currentMonthDate();
  document.getElementById("budget-month-label").textContent = monthLabel(monthDate);

  const budgets = loadBudgets();
  const spent = computeSpentByCategory(monthDate);
  const grid = document.getElementById("budget-grid");
  grid.innerHTML = "";

  CATEGORIES.gasto.forEach(cat => {
    const budget = budgets[cat.id] || 0;
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

document.getElementById("budget-edit-toggle").addEventListener("click", () => {
  const form = document.getElementById("budget-form");
  const grid = document.getElementById("budget-grid");
  const toggle = document.getElementById("budget-edit-toggle");

  if (form.hidden) {
    const budgets = loadBudgets();
    document.getElementById("budget-inputs").innerHTML = CATEGORIES.gasto.map(c => `
      <label class="budget-input-row">
        <span class="cat-icon" style="background:${c.color}22; color:${c.color}" data-icon="${c.icon}"></span>
        <span class="budget-input-label">${c.label}</span>
        <input type="number" min="0" step="1" data-cat="${c.id}" value="${budgets[c.id] || ""}" placeholder="0">
      </label>
    `).join("");
    renderIcons(document.getElementById("budget-inputs"));
    form.hidden = false;
    grid.hidden = true;
    toggle.textContent = "Cancelar";
  } else {
    form.hidden = true;
    grid.hidden = false;
    toggle.textContent = "Editar presupuestos";
  }
});

document.getElementById("budget-form").addEventListener("submit", e => {
  e.preventDefault();
  const budgets = {};
  document.querySelectorAll("#budget-inputs input").forEach(input => {
    const v = parseFloat(input.value);
    if (v > 0) budgets[input.dataset.cat] = v;
  });
  saveBudgets(budgets);
  document.getElementById("budget-form").hidden = true;
  document.getElementById("budget-grid").hidden = false;
  document.getElementById("budget-edit-toggle").textContent = "Editar presupuestos";
  renderBudgets();
});

// ================= Tabs =================

document.querySelectorAll(".fin-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".fin-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-resumen").hidden = btn.dataset.tab !== "resumen";
    document.getElementById("tab-presupuesto").hidden = btn.dataset.tab !== "presupuesto";
  });
});

// ================= Init =================

function renderAll() {
  renderStats();
  updateMonthLabel();
  renderMovements();
  renderBudgets();
}

document.getElementById("finance-date").valueAsDate = new Date();
populateCategorySelect("ingreso");
populatePaymentSelect("ingreso");
renderAll();
