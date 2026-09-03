const FINANCE_KEY = "manolo_finanzas";
const TYPE_LABELS = { ingreso: "Ingreso", gasto: "Gasto", inversion: "Inversión" };

function loadMovements() {
  return JSON.parse(localStorage.getItem(FINANCE_KEY) || "[]");
}
function saveMovements(list) {
  localStorage.setItem(FINANCE_KEY, JSON.stringify(list));
}

function formatMoney(n) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "USD" });
}

function renderStats() {
  const list = loadMovements();
  const ingresos = list.filter(m => m.type === "ingreso").reduce((s, m) => s + m.amount, 0);
  const gastos = list.filter(m => m.type === "gasto").reduce((s, m) => s + m.amount, 0);
  const inversiones = list.filter(m => m.type === "inversion").reduce((s, m) => s + m.amount, 0);
  const balance = ingresos - gastos - inversiones;

  document.getElementById("finance-stats").innerHTML = `
    <div class="stat-box"><div class="value">${formatMoney(balance)}</div><div class="label">Balance</div></div>
    <div class="stat-box"><div class="value">${formatMoney(inversiones)}</div><div class="label">En inversiones</div></div>
  `;
}

function renderMovements() {
  const list = loadMovements().slice().sort((a, b) => b.date.localeCompare(a.date));
  const container = document.getElementById("finance-list");
  const empty = document.getElementById("finance-empty");

  container.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(m => {
    const item = document.createElement("div");
    item.className = "list-item";
    const sign = m.type === "ingreso" ? "+" : "−";
    item.innerHTML = `
      <div>
        <strong>${m.desc}</strong> (${TYPE_LABELS[m.type]})
        <div class="meta">${m.date} · ${sign}${formatMoney(m.amount)}</div>
      </div>
    `;
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "✕";
    del.addEventListener("click", () => deleteMovement(m.id));
    item.appendChild(del);
    container.appendChild(item);
  });

  renderStats();
}

function deleteMovement(id) {
  const list = loadMovements().filter(m => m.id !== id);
  saveMovements(list);
  renderMovements();
}

document.getElementById("finance-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("finance-date").value;
  const type = document.getElementById("finance-type").value;
  const desc = document.getElementById("finance-desc").value.trim();
  const amount = parseFloat(document.getElementById("finance-amount").value);
  if (!date || !desc || !amount) return;

  const list = loadMovements();
  list.push({ id: Date.now(), date, type, desc, amount });
  saveMovements(list);
  e.target.reset();
  document.getElementById("finance-date").valueAsDate = new Date();
  renderMovements();
});

document.getElementById("finance-date").valueAsDate = new Date();
renderMovements();
