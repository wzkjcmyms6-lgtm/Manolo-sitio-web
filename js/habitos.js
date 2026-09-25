// Módulo de Hábitos: en blanco a propósito, pendiente de rediseño.
// Por ahora solo maneja las dos pestañas de arriba (Hábitos / Estadísticas).
(function () {
function showHabitSection(section) {
  document.querySelectorAll("#habit-section-tabs .fin-tab").forEach(b => {
    b.classList.toggle("active", b.dataset.habitSection === section);
  });
  document.getElementById("habit-section-habitos").hidden = section !== "habitos";
  document.getElementById("habit-section-estadisticas").hidden = section !== "estadisticas";
}

document.getElementById("habit-section-tabs").addEventListener("click", e => {
  const btn = e.target.closest("[data-habit-section]");
  if (btn) showHabitSection(btn.dataset.habitSection);
});
})();
