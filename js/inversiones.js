(function () {
let investingCache = [];

function investingCollection() {
  return db.collection("users").doc(currentUser.uid).collection("inversiones");
}

function formatMoney(n) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "USD" });
}

function renderStats() {
  const total = investingCache.reduce((sum, i) => sum + i.amount, 0);

  document.getElementById("investing-stats").innerHTML = `
    <div class="stat-box"><div class="value">${formatMoney(total)}</div><div class="label">Total invertido</div></div>
    <div class="stat-box"><div class="value">${investingCache.length}</div><div class="label">Aportes registrados</div></div>
  `;
}

function renderInvestments() {
  const list = investingCache.slice().sort((a, b) => b.date.localeCompare(a.date));
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
  investingCollection().doc(id).delete();
}

document.getElementById("investing-form").addEventListener("submit", e => {
  e.preventDefault();
  const date = document.getElementById("investing-date").value;
  const name = document.getElementById("investing-name").value.trim();
  const amount = parseFloat(document.getElementById("investing-amount").value);
  const notes = document.getElementById("investing-notes").value.trim();
  if (!date || !name || !amount) return;

  investingCollection().add({ date, name, amount, notes });
  e.target.reset();
  document.getElementById("investing-date").valueAsDate = new Date();
});

document.getElementById("investing-date").valueAsDate = new Date();

onAuthReady(() => {
  investingCollection().onSnapshot(snap => {
    investingCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderInvestments();
  });
});
})();
