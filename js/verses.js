// Versículos (Reina-Valera 1909, dominio público) usados para el versículo del día.
const VERSES = [
  { text: "Todo lo puedo en Cristo que me fortalece.", ref: "Filipenses 4:13" },
  { text: "Encomienda a Jehová tu camino, y confía en él; y él hará.", ref: "Salmos 37:5" },
  { text: "Mas los que esperan a Jehová tendrán nuevas fuerzas; levantarán las alas como águilas.", ref: "Isaías 40:31" },
  { text: "No te ha mandado yo? Esfuérzate y sé valiente; no temas ni desmayes.", ref: "Josué 1:9" },
  { text: "El corazón del hombre piensa su camino; mas Jehová endereza sus pasos.", ref: "Proverbios 16:9" },
  { text: "Todas las cosas ayudan a bien, a los que aman a Dios.", ref: "Romanos 8:28" },
  { text: "Jehová es mi pastor; nada me faltará.", ref: "Salmos 23:1" },
  { text: "Confía en Jehová de todo tu corazón, y no estribes en tu prudencia.", ref: "Proverbios 3:5" },
  { text: "El que confía en Jehová será prosperado.", ref: "Proverbios 28:25" },
  { text: "No os afanéis por nada; sean conocidas vuestras peticiones delante de Dios.", ref: "Filipenses 4:6" },
  { text: "Buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.", ref: "Mateo 6:33" },
  { text: "El que es diligente en su trabajo, delante de los reyes estará.", ref: "Proverbios 22:29" },
  { text: "Todo lo que hagáis, hacedlo de corazón, como para el Señor.", ref: "Colosenses 3:23" },
  { text: "Mejor es lo poco con justicia, que la muchedumbre de frutos sin derecho.", ref: "Proverbios 16:8" },
  { text: "El ejercicio corporal para poco es provechoso; mas la piedad para todo aprovecha.", ref: "1 Timoteo 4:8" },
  { text: "No os hagáis tesoros en la tierra... sino haceos tesoros en el cielo.", ref: "Mateo 6:19-20" },
  { text: "Da gracias a Jehová, porque él es bueno; porque para siempre es su misericordia.", ref: "Salmos 107:1" },
  { text: "Fiel es Dios, que no os dejará ser tentados más de lo que podéis resistir.", ref: "1 Corintios 10:13" },
  { text: "Renovaos en el espíritu de vuestra mente.", ref: "Efesios 4:23" },
  { text: "Porque yo sé los pensamientos que tengo acerca de vosotros, pensamientos de paz, y no de mal.", ref: "Jeremías 29:11" }
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
