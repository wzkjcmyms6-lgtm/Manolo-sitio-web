// Errores comunes por tipo de movimiento (generales y prudentes, sin
// consejos médicos) y cómo se asigna el tipo a cada ejercicio de la base.
// Lo usa scripts/build-tecnica.mjs. Ver docs/EJERCICIO_INTELIGENTE.md.

export const ERRORES = {
  sentadilla: ["Rodillas que se van hacia adentro al subir.", "Talones que se despegan del piso.", "Espalda que se redondea abajo del todo."],
  zancada: ["Rodilla de adelante que se cae hacia adentro.", "Pasos tan cortos que la rodilla pasa muy por delante del pie.", "Torso que se va hacia adelante."],
  bisagra: ["Espalda redondeada al bajar o al tirar.", "Peso lejos del cuerpo: debe bajar pegado a las piernas.", "Bajar más de lo que tu espalda aguanta recta."],
  gluteo: ["Arquear la espalda baja arriba en lugar de apretar los glúteos.", "Pies demasiado lejos o demasiado cerca de la cadera.", "Bajar de golpe, sin controlar."],
  empuje_horizontal: ["Codos muy abiertos, en cruz con el cuerpo.", "Rebotar el peso en el pecho.", "Despegar la cadera o los hombros del apoyo."],
  empuje_vertical: ["Arquear de más la espalda baja para subir el peso.", "Bajar la barra por detrás de la nuca.", "Encoger los hombros hacia las orejas."],
  fondos: ["Bajar demasiado, con los hombros muy por debajo de los codos.", "Balancearse para subir.", "Encoger los hombros hacia las orejas."],
  traccion_vertical: ["Balancearse o patear para subir.", "Repeticiones a medias: abajo, los brazos casi estirados.", "Encoger los hombros en lugar de bajar los codos."],
  traccion_horizontal: ["Tirar con impulso de la espalda baja.", "Redondear la espalda.", "Encoger los hombros en lugar de llevar los codos atrás."],
  curl_biceps: ["Balancear el cuerpo para subir el peso.", "Mover los codos hacia adelante.", "Bajar rápido sin controlar."],
  extension_triceps: ["Abrir los codos hacia los costados.", "Mover los hombros: solo trabaja el antebrazo.", "Estirar de golpe los codos."],
  elevacion_hombro: ["Usar impulso o balanceo.", "Encoger los hombros hacia las orejas al subir.", "Demasiado peso, que obliga a doblar mucho los codos."],
  aperturas: ["Brazos rectos del todo: mantén los codos un poco doblados.", "Bajar demasiado atrás, más allá de la línea del cuerpo.", "Tanto peso que se vuelve un press."],
  pierna_maquina: ["Despegar la cadera o la espalda del respaldo.", "Trabar de golpe las rodillas.", "Bajar rápido sin controlar."],
  gemelos: ["Rebotar abajo.", "Recorrido corto: sube y baja del todo.", "Doblar las rodillas para ayudarse."],
  encogimientos: ["Girar los hombros en círculo.", "Doblar los codos para ayudarse.", "Bajar sin controlar."],
  antebrazo: ["Mover los antebrazos: solo se mueve la muñeca.", "Bajar sin controlar.", "Demasiado peso para el recorrido completo."],
  pullover: ["Bajar los brazos más atrás de lo cómodo para el hombro.", "Doblar y estirar los codos: se vuelve otro ejercicio.", "Despegar la cadera."],
  core_flexion: ["Tirar del cuello con las manos.", "Usar impulso en lugar de los abdominales.", "Arquear la espalda baja."],
  core_isometrico: ["Cadera que se cae o se sube demasiado.", "Aguantar la respiración.", "Seguir cuando la postura ya se rompió."],
  cuello: ["Movimientos bruscos o rápidos.", "Demasiada carga: empieza muy liviano.", "Seguir si aparece dolor."],
  olimpico: ["Tirar con los brazos en lugar de con las piernas.", "Espalda redondeada al despegar del piso.", "Aprenderlo solo: conviene que alguien revise tu técnica."],
  cardio: ["Arrancar a un ritmo que no puedes sostener.", "Postura caída por el cansancio.", "Hacer siempre lo mismo, sin días suaves."],
  movilidad: ["Rebotar en el estiramiento.", "Forzar hasta sentir dolor.", "Aguantar la respiración."],
  general: ["Usar impulso en lugar de controlar el peso.", "Recorrido a medias.", "Más peso del que puedes mover con buena técnica."]
};

// Tipo de movimiento de un ejercicio (por su nombre en español y su id en
// inglés). El orden importa: lo más específico va primero.
// Ojo con las palabras en inglés escondidas en otras ("machine" lleva "chin",
// "narrow" lleva "row"): en los ids se buscan palabras enteras (entre guiones).
const REGLAS = [
  ["gemelos", /talones|(^|[ -])calf|gemelo/],
  ["extension_triceps", /press franc[eé]s/],
  ["empuje_vertical", /press militar tras nuca|push press tras nuca/],
  ["traccion_vertical", /jal[oó]n tras nuca/],
  ["elevacion_hombro", /remo al cuello/],
  ["cuello", /cuello|cervical|luchador|neck-(resistance|bridge|press)|(^|[ -])neck([ -]|$)/],
  ["olimpico", /cargada|power-clean|hang-clean|snatch|arrancada|(^|[ -])jerk|envi[oó]n|clean-and/],
  ["zancada", /zancada|lunge|split|estocada|b[uú]lgara|step-up|subida al caj/],
  ["sentadilla", /sentadilla|squat/],
  ["gluteo", /hip thrust|hip-thrust|puente de gl[uú]teo|glute-bridge|butt-lift|patada de gl[uú]teo/],
  ["bisagra", /peso muerto|deadlift|buenos d[ií]as|good-morning|hiperextensi|hyperextension|rumano|kettlebell-swing/],
  ["fondos", /fondos|(^|[ -])dips?([ -]|$)/],
  ["traccion_vertical", /dominada|pullup|pull-up|(^|[ -])chin|jal[oó]n al pecho|pulldown|negativa|colgado activo/],
  ["elevacion_hombro", /remo al ment[oó]n|upright|elevaci[oó]n lateral|elevaci[oó]n frontal|p[aá]jaros|face pull|face-pull|pec deck inverso|reverse-fly|reverse-machine|lateral-raise|front-.*raise/],
  ["traccion_horizontal", /remo|(^|[ -])rows?([ -]|$)/],
  ["core_flexion", /encogimiento de piernas|flexi[oó]n de cadera|flexi[oó]n lateral/],
  ["pierna_maquina", /curl femoral|leg-curl|prensa|leg-press|extensi[oó]n de piernas|leg-extension|aducci[oó]n|abducci[oó]n|abductor|adductor/],
  ["antebrazo", /mu[ñn]eca|wrist/],
  ["curl_biceps", /curl/],
  ["extension_triceps", /tr[ií]ceps|triceps|franc[eé]s|skull|kickback|patada de tr/],
  ["aperturas", /aperturas|fly|flye|pec deck|cruce|crossover|butterfly/],
  ["encogimientos", /encogimiento|shrug/],
  ["pullover", /pullover/],
  ["empuje_vertical", /press militar|press de hombros|shoulder-press|military|arnold|push-press|press por encima/],
  ["empuje_horizontal", /press de banca|bench-press|flexi[oó]n(es)?( |$)|flexiones|push-?up|press de pecho|chest-press|floor-press|press inclinado|press declinado/],
  ["core_isometrico", /plancha|plank|hollow|dead bug|dead-bug|l-sit|bird-dog|pallof/],
  ["core_flexion", /crunch|abdominal|elevaci[oó]n de piernas|leg-raise|rueda|ab-roller|giro ruso|russian|sit-?up|v-up|oblicu|tijeras|knee-raise|elevaci[oó]n de rodillas/]
];

export function patron(f) {
  if (f.movilidad) return "movilidad";
  if (f.tipo === "cardio") return "cardio";
  const n = (f.nombre + " " + f.id).toLowerCase();
  for (const [pt, re] of REGLAS) if (re.test(n)) return pt;
  return "general";
}
