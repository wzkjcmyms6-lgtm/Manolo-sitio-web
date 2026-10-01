(function () {
// Running: carrera con GPS, libre o con rutina de intervalos (pantallas en
// js/actividad-ui.js), lista de tus carreras y registro a mano (cinta o sin
// GPS, en js/actividad-registro.js). Todo en users/{uid}/running; las
// carreras con GPS guardan su recorrido aparte en users/{uid}/rutas.
const actividad = ActividadUI.crear({
  deporte: "running",
  panel: "running",
  contenedor: document.getElementById("running-act"),
  inicio: document.getElementById("running-home"),
  coleccion: "running",
  nombre: "carrera",
  titulo: "Running",
  rutinas: true          // rutinas por intervalos desde CSV (js/rutinas-running-ui.js)
});

ActividadRegistro.registro({ deporte: "running", coleccion: "running", prefijo: "running", total: "Salidas", item: "salida", actividad });
})();
