(function () {
// Running: resumen semanal, rutinas guiadas (pantallas en js/rutina-guiada.js,
// rutinas importadas desde CSV en js/rutinas-running-ui.js), historial y
// registro a mano (js/actividad-registro.js). Todo en users/{uid}/running.
RutinaGuiada.crear({
  panel: "running",
  lista: document.getElementById("running-rutinas"),
  pantalla: document.getElementById("running-act"),
  inicio: document.getElementById("running-home")
});

ActividadRegistro.registro({ deporte: "running", coleccion: "running", prefijo: "running", item: "carrera" });
})();
