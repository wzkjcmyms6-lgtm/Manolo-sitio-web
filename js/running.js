(function () {
// Running: resumen semanal, rutinas guiadas (pantallas en js/rutina-guiada.js,
// rutinas importadas desde CSV en js/rutinas-running-ui.js), historial y
// registro a mano (js/actividad-registro.js). Todo en users/{uid}/running.
// Desde la fase 3 del plan "al nivel de Strava" (D-061) las rutinas viven en
// la pestaña Rutinas (#run-rutinas), el resumen semanal en Progreso, el
// registro a mano en la hoja del "+" y la lista en el feed (js/run-feed.js).
RutinaGuiada.crear({
  panel: "run-rutinas",
  lista: document.getElementById("running-rutinas"),
  pantalla: document.getElementById("running-act"),
  inicio: document.getElementById("running-home")
});

ActividadRegistro.registro({ deporte: "running", coleccion: "running", prefijo: "running", item: "carrera" });
})();
