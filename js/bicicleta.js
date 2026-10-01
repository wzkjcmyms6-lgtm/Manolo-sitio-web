(function () {
// Bicicleta: rodada con GPS (mismas pantallas que Running, en
// js/actividad-ui.js, con la velocidad como dato principal y parciales de
// 5 km), lista de tus rodadas y registro a mano (rodillo o sin GPS, en
// js/actividad-registro.js). Todo en users/{uid}/bicicleta; las rodadas con
// GPS guardan su recorrido aparte en users/{uid}/rutas.
const actividad = ActividadUI.crear({
  deporte: "bicicleta",
  panel: "bicicleta",
  contenedor: document.getElementById("cycling-act"),
  inicio: document.getElementById("cycling-home"),
  coleccion: "bicicleta",
  nombre: "rodada",
  titulo: "Bicicleta"
});

ActividadRegistro.registro({ deporte: "bicicleta", coleccion: "bicicleta", prefijo: "cycling", total: "Rodadas", item: "rodada", actividad });
})();
