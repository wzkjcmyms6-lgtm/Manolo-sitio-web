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
  renderCategoryList();
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
