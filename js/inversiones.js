const INVESTING_KEY = "manolo_inversiones";

function loadInvestments() {
  return JSON.parse(localStorage.getItem(INVESTING_KEY) || "[]");
}
function saveInvestments(list) {
  localStorage.setItem(INVESTING_KEY, JSON.stringify(list));
}

function formatMoney(n) {
  return n.toLocaleString("es-BO", { style: "currency", currency: "BOB" });
}

function renderStats() {
  const list = loadInvestments();
  const total = list.reduce((sum, i) => sum + i.amount, 0);

  document.getElementById("investing-stats").innerHTML = `
    <div class="stat-box"><div class="value">${formatMoney(total)}</div><div class="label">Total invertido</div></div>
    <div class="stat-box"><div class="value">${list.length}</div><div class="label">Aportes registrados</div></div>
  `;
}

function renderInvestments() {
  const list = loadInvestments().slice().sort((a, b) => b.date.localeCompare(a.date));
  const container = document.getElementById("investing-list");
  const empty = document.getElementById("investing-empty");

  container.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(entry => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${entry.name}</strong> — ${formatMoney(entry.amount)}
        <div class="meta">${entry.date}${entry.notes ? " · " + entry.notes : ""}</div>
      </div>
    `;
    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Eliminar aporte");
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => deleteInvestment(entry.id));
    item.appendChild(del);
    container.appendChild(item);
  });

  renderStats();
}

function deleteInvestment(id) {
  const list = loadInvestments().filter(i => i.id !== id);
  saveInvestments(list);
  renderInvestments();
}

document.getElementById("investing-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("investing-date").value;
  const name = document.getElementById("investing-name").value.trim();
  const amount = parseFloat(document.getElementById("investing-amount").value);
  const notes = document.getElementById("investing-notes").value.trim();
  if (!date || !name || !amount) return;

  const list = loadInvestments();
  list.push({ id: Date.now(), date, name, amount, notes });
  saveInvestments(list);
  e.target.reset();
  document.getElementById("investing-date").valueAsDate = new Date();
  renderInvestments();
});

document.getElementById("investing-date").valueAsDate = new Date();
renderInvestments();
