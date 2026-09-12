// Versículos de agradecimiento y motivación (Reina-Valera, dominio público).
// Uno distinto cada día del año — ver verseOfTheDay() más abajo.
const VERSES = [
  // Agradecimiento
  { text: "Dad gracias a Jehová, porque él es bueno; porque para siempre es su misericordia.", ref: "Salmos 107:1" },
  { text: "Dad gracias en todo, porque esta es la voluntad de Dios para con vosotros en Cristo Jesús.", ref: "1 Tesalonicenses 5:18" },
  { text: "Entrad por sus puertas con acción de gracias, y por sus atrios con alabanza; dadle gracias, bendecid su nombre.", ref: "Salmos 100:4" },
  { text: "Todo lo que hagáis, de palabra o de hecho, hacedlo en el nombre del Señor Jesús, dando gracias a Dios Padre por medio de él.", ref: "Colosenses 3:17" },
  { text: "Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.", ref: "Salmos 118:24" },
  { text: "Dando siempre gracias por todo al Dios y Padre, en el nombre de nuestro Señor Jesucristo.", ref: "Efesios 5:20" },
  { text: "Aclamad a Jehová, porque es bueno; porque su misericordia es para siempre.", ref: "1 Crónicas 16:34" },
  { text: "Te alabaré, oh Jehová, con todo mi corazón; contaré todas tus maravillas.", ref: "Salmos 9:1" },
  { text: "Por nada estéis afanosos; antes sean conocidas vuestras peticiones delante de Dios, con acción de gracias.", ref: "Filipenses 4:6" },
  { text: "A ti cantaré, oh Jehová Dios mío; por siempre te alabaré.", ref: "Salmos 30:12" },

  // Motivación
  { text: "Todo lo puedo en Cristo que me fortalece.", ref: "Filipenses 4:13" },
  { text: "Mas los que esperan a Jehová tendrán nuevas fuerzas; levantarán las alas como águilas.", ref: "Isaías 40:31" },
  { text: "Esfuérzate y sé valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo.", ref: "Josué 1:9" },
  { text: "Sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.", ref: "Romanos 8:28" },
  { text: "Yo sé los pensamientos que tengo acerca de vosotros, pensamientos de paz y no de mal, para daros el fin que esperáis.", ref: "Jeremías 29:11" },
  { text: "No nos cansemos de hacer el bien, porque a su tiempo segaremos, si no desmayamos.", ref: "Gálatas 6:9" },
  { text: "Aguarda a Jehová; esfuérzate, y aliéntese tu corazón; sí, espera a Jehová.", ref: "Salmos 27:14" },
  { text: "El gozo de Jehová es vuestra fuerza.", ref: "Nehemías 8:10" },
  { text: "Confía en Jehová de todo tu corazón, y no estribes en tu propia prudencia.", ref: "Proverbios 3:5" },
  { text: "Todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres.", ref: "Colosenses 3:23" },
  { text: "Renovaos en el espíritu de vuestra mente.", ref: "Efesios 4:23" },
  { text: "El que confía en Jehová será prosperado.", ref: "Proverbios 28:25" },
  { text: "No desmayamos; aunque el hombre exterior se va desgastando, el interior se renueva de día en día.", ref: "2 Corintios 4:16" },
  { text: "¿Has visto hombre diligente en su trabajo? Delante de los reyes estará.", ref: "Proverbios 22:29" }
];

function verseOfTheDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return VERSES[dayOfYear % VERSES.length];
}

function renderVerse(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const v = verseOfTheDay();
  el.querySelector(".verse-text").textContent = `“${v.text}”`;
  el.querySelector(".verse-ref").textContent = v.ref;
}
