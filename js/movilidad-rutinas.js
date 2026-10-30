// ---------- Movilidad: las rutinas (solo datos) ----------
// Para cambiar un ejercicio o agregar una rutina se edita SOLO este archivo;
// la lógica (js/movilidad-motor.js) y la pantalla (js/movilidad.js) la leen
// tal cual. Cada rutina tiene:
//   id      texto único y estable (queda guardado en el historial)
//   nombre  lo que se ve en la tarjeta
//   partes  [{ titulo?, nota?, ejercicios: [...] }]: la nota se muestra
//           durante esos ejercicios
// Cada ejercicio: { nombre, instruccion, segundos, porLado }. Con
// porLado: true, a la mitad del tiempo se avisa "Cambia de lado" (por eso
// conviene un número par de segundos).
// tests/movilidad-motor.test.js revisa que todo esté bien escrito.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MovilidadRutinas = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const LIBERAR_EL_CUERPO = [
  { nombre: "Gato-vaca", instruccion: "Arquea y redondea la espalda despacio, con la respiración.", segundos: 20, porLado: false },
  { nombre: "Postura del niño", instruccion: "Caderas atrás, brazos estirados, relaja la zona lumbar.", segundos: 20, porLado: false },
  { nombre: "Perro boca abajo pedaleando", instruccion: "Alterna doblar las rodillas.", segundos: 20, porLado: false },
  { nombre: "World's greatest stretch", instruccion: "Zancada larga, mano al suelo, gira el torso con el brazo al techo.", segundos: 20, porLado: true },
  { nombre: "Sentadilla profunda", instruccion: "Talones en el suelo, codos empujando las rodillas hacia afuera.", segundos: 20, porLado: false },
  { nombre: "Círculos de hombros y cuello", instruccion: "De pie, lentos.", segundos: 20, porLado: false }
];

const EN_MOVIMIENTO = [
  { nombre: "Balanceo de pierna adelante-atrás", instruccion: "Apoyado en una pared, balancea la pierna adelante y atrás.", segundos: 30, porLado: true },
  { nombre: "Balanceo de pierna lateral", instruccion: "Balancea la pierna de lado a lado, por delante del cuerpo.", segundos: 30, porLado: true },
  { nombre: "Zancadas caminando con giro de torso", instruccion: "Avanza con zancadas y gira el torso en cada paso.", segundos: 30, porLado: false },
  { nombre: "Elevaciones de talones", instruccion: "Sube y baja los talones, rápidas y controladas.", segundos: 30, porLado: false },
  { nombre: "Rodillas al pecho / skipping suave", instruccion: "Sube las rodillas hacia el pecho alternando, a ritmo suave.", segundos: 30, porLado: false },
  { nombre: "Talones al glúteo trotando en el sitio", instruccion: "Trota en el sitio llevando los talones al glúteo.", segundos: 30, porLado: false }
];

return [
  {
    id: "liberar-el-cuerpo",
    nombre: "Liberar el cuerpo",
    partes: [{ ejercicios: LIBERAR_EL_CUERPO }]
  },
  {
    id: "antes-de-correr",
    nombre: "Antes de correr",
    partes: [
      { titulo: "Liberar el cuerpo", ejercicios: LIBERAR_EL_CUERPO },
      { titulo: "En movimiento", nota: "En esta parte todo va en movimiento continuo, sin sostener posiciones.", ejercicios: EN_MOVIMIENTO }
    ]
  }
];
});
