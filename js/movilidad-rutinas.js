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
// Desde el 2026-10-30 hay solo dos rutinas de 3 minutos (pedido del dueño):
// una para todo el cuerpo y una para después de correr. Las sesiones de las
// rutinas anteriores siguen en el historial con su nombre.
// tests/movilidad-motor.test.js revisa que todo esté bien escrito.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MovilidadRutinas = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// Los seis ejercicios de "Liberar el cuerpo", ahora de 30 s cada uno (3 min).
const TODO_EL_CUERPO = [
  { nombre: "Gato-vaca", instruccion: "Arquea y redondea la espalda despacio, con la respiración.", segundos: 30, porLado: false },
  { nombre: "Postura del niño", instruccion: "Caderas atrás, brazos estirados, relaja la zona lumbar.", segundos: 30, porLado: false },
  { nombre: "Perro boca abajo pedaleando", instruccion: "Alterna doblar las rodillas.", segundos: 30, porLado: false },
  { nombre: "World's greatest stretch", instruccion: "Zancada larga, mano al suelo, gira el torso con el brazo al techo.", segundos: 30, porLado: true },
  { nombre: "Sentadilla profunda", instruccion: "Talones en el suelo, codos empujando las rodillas hacia afuera.", segundos: 30, porLado: false },
  { nombre: "Círculos de hombros y cuello", instruccion: "De pie, lentos.", segundos: 30, porLado: false }
];

// Después de correr: estiramientos sostenidos de las piernas y la cadera
// (lo que más trabaja al correr), 18 s por lado (3 min).
const DESPUES_DE_CORRER = [
  { nombre: "Gemelos en la pared", instruccion: "Manos en la pared, una pierna atrás estirada con el talón en el suelo.", segundos: 36, porLado: true },
  { nombre: "Cuádriceps de pie", instruccion: "Toma el empeine y lleva el talón al glúteo, rodillas juntas y cadera adelante.", segundos: 36, porLado: true },
  { nombre: "Isquiotibiales", instruccion: "Talón apoyado adelante y pierna estirada; inclínate desde la cadera con la espalda recta.", segundos: 36, porLado: true },
  { nombre: "Flexor de cadera en zancada", instruccion: "Rodilla de atrás en el suelo; empuja la cadera hacia adelante.", segundos: 36, porLado: true },
  { nombre: "Glúteo en figura 4", instruccion: "Acostado, tobillo sobre la rodilla contraria; acerca las piernas al pecho.", segundos: 36, porLado: true }
];

return [
  {
    // Conserva el id de "Liberar el cuerpo" (la misma rutina, más larga).
    id: "liberar-el-cuerpo",
    nombre: "Todo el cuerpo",
    partes: [{ ejercicios: TODO_EL_CUERPO }]
  },
  {
    id: "despues-de-correr",
    nombre: "Después de correr",
    partes: [{ nota: "Sostén cada estiramiento sin rebotar: hasta sentir tensión, nunca dolor.", ejercicios: DESPUES_DE_CORRER }]
  }
];
});
