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

const PAYMENTS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Tarjeta de crédito" }
];

let monthOffset = 0; // 0 = mes actual, -1 = mes anterior, etc.
let financeCache = [];
let budgetsCache = {};
let gastoCategoriesCache = CATEGORIES.gasto; // se reemplaza por la lista guardada en Firestore
let ahorrosCache = [];

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

function findCategory(type, id) {
  if (type === "pago_tarjeta") return CARD_PAYMENT_CATEGORY;
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

// ---- Planificación: lista editable + anillo con el total presupuestado ----
function renderBudgetInputs() {
  const container = document.getElementById("budget-inputs");
  const focused = document.activeElement;
  const focusedCat = focused && focused.dataset ? focused.dataset.cat : null;

  container.innerHTML = gastoCategoriesCache.map(c => `
    <label class="budget-input-row">
      <span class="cat-icon" style="background:${c.color}22; color:${c.color}" data-icon="${c.icon}"></span>
      <span class="budget-input-label">${c.label}</span>
      <input type="number" min="0" step="1" data-cat="${c.id}" value="${budgetsCache[c.id] || ""}" placeholder="0">
    </label>
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
  const totalBudget = gastoCategoriesCache.reduce((s, c) => s + (budgetsCache[c.id] || 0), 0);
  const totalSpent = gastoCategoriesCache.reduce((s, c) => s + (spent[c.id] || 0), 0);
  const pct = totalBudget > 0 ? totalSpent / totalBudget : 0;

  document.getElementById("budget-summary-ring").innerHTML =
    progressRing(pct, totalBudget > 0 && totalSpent > totalBudget ? "var(--danger)" : "var(--accent-1)");
  document.getElementById("budget-summary-value").textContent = formatMoney(totalBudget);
  document.getElementById("budget-summary-sub").textContent = totalBudget > 0
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

// ================= Herramientas: Categorías =================

function renderCategoryList() {
  const container = document.getElementById("category-list");
  container.innerHTML = "";
  gastoCategoriesCache.forEach(c => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.7rem;">
        <span class="cat-icon" style="background:${c.color}22; color:${c.color}" data-icon="${c.icon}"></span>
        <strong>${escapeHtml(c.label)}</strong>
      </div>
    `;
    if (c.id !== "otros") {
      const del = document.createElement("button");
      del.className = "delete";
      del.setAttribute("aria-label", "Eliminar categoría");
      del.innerHTML = ICONS.trash;
      del.addEventListener("click", () => deleteCategory(c.id));
      row.appendChild(del);
    }
    container.appendChild(row);
    renderIcons(row);
  });
}

function deleteCategory(id) {
  categoriasDocRef().set({ list: gastoCategoriesCache.filter(c => c.id !== id) });
}

document.getElementById("new-category-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("new-category-name");
  const label = input.value.trim();
  if (!label) return;

  const base = slugify(label);
  let id = base, suffix = 2;
  while (gastoCategoriesCache.some(c => c.id === id)) id = `${base}_${suffix++}`;

  const color = CATEGORY_COLOR_POOL[gastoCategoriesCache.length % CATEGORY_COLOR_POOL.length];
  const next = gastoCategoriesCache.concat([{ id, label, icon: "otherCategory", color }]);
  categoriasDocRef().set({ list: next });
  input.value = "";
});

// ================= Herramientas: Carteras =================

// La cartera de gastos y la de tarjeta de crédito salen de los movimientos
// de Finanzas (Bs). Ahorros se lleva en US$.
function renderWallets() {
  const { saldo, deuda } = computeTotals(financeCache);
  const totalAhorros = ahorrosCache.reduce((s, a) => s + a.amount, 0);
  const netoBs = saldo - deuda;
  const deudaText = deuda > 0 ? "−" + formatMoney(deuda) : formatMoney(0);

  const panels = [
    { label: "Patrimonio total", lines: [formatMoney(netoBs), formatUSD(totalAhorros)] },
    { label: "Cartera de gastos", lines: [formatMoney(saldo)] },
    { label: "Cartera de tarjeta de crédito", lines: [deudaText] },
    { label: "Cartera de ahorro", lines: [formatUSD(totalAhorros)] }
  ];

  document.getElementById("wallet-hero-track").innerHTML = panels.map(p => `
    <div class="wallet-hero-panel">
      ${p.lines.map(l => `<div class="wallet-hero-value">${l}</div>`).join("")}
      <div class="wallet-hero-label">${p.label}</div>
    </div>
  `).join("");

  document.getElementById("wallet-hero-dots").innerHTML = panels.map((_, i) =>
    `<button type="button" class="wallet-hero-dot${i === 0 ? " active" : ""}" data-panel="${i}" aria-label="Panel ${i + 1}"></button>`
  ).join("");

  const walletHTML = (icon, color, label, value, neg) => `
    <div class="wallet-card">
      <span class="wallet-icon" style="background:${color}22; color:${color}" data-icon="${icon}"></span>
      <div class="wallet-info">
        <div class="wallet-label">${label}</div>
        <div class="wallet-value${neg ? " neg" : ""}">${value}</div>
      </div>
    </div>
  `;

  document.getElementById("wallet-list").innerHTML =
    walletHTML("finance", "#ff9a4d", "Gastos", formatMoney(saldo)) +
    walletHTML("finance", "#e05656", "Tarjeta de crédito", deudaText, deuda > 0) +
    walletHTML("wallet", "#5cc98a", "Ahorro (US$)", formatUSD(totalAhorros));

  renderIcons(document.getElementById("wallet-hero-track"));
  renderIcons(document.getElementById("wallet-list"));
  wireWalletHero();
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

function renderSavingsList() {
  const list = ahorrosCache.slice().sort((a, b) => b.date.localeCompare(a.date));
  const container = document.getElementById("savings-list");
  container.innerHTML = "";

  list.forEach(entry => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${formatUSD(entry.amount)}</strong>
        <div class="meta">${entry.date}${entry.notes ? " · " + escapeHtml(entry.notes) : ""}</div>
      </div>
    `;
    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar ahorro");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => ahorrosCollection().doc(entry.id).delete());
    item.appendChild(del);
    container.appendChild(item);
  });
}

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

// ================= Herramientas: navegación de tarjetas =================

document.querySelectorAll(".tool-card").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("herr-home").hidden = true;
    document.getElementById("herr-" + btn.dataset.tool).hidden = false;
  });
});
document.querySelectorAll("[data-tool-back]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("herr-carteras").hidden = true;
    document.getElementById("herr-categorias").hidden = true;
    document.getElementById("herr-exportar").hidden = true;
    document.getElementById("herr-home").hidden = false;
  });
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

function renderAll() {
  renderStats();
  updateMonthLabel();
  renderMovements();
  updateBudgetMonthLabel();
  renderBudgets();
  renderBudgetInputs();
  renderBudgetSummary();
  renderBudgetInfo();
  renderCategoryList();
  renderWallets();
  renderSavingsList();
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
    const list = doc.exists ? doc.data().list : null;
    if (Array.isArray(list) && list.length) {
      gastoCategoriesCache = list;
    } else {
      gastoCategoriesCache = CATEGORIES.gasto;
      categoriasDocRef().set({ list: CATEGORIES.gasto });
    }
    renderAll();
  });
  ahorrosCollection().onSnapshot(snap => {
    ahorrosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
});
})();
