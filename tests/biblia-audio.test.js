// Biblia en audio: lógica sin pantalla (js/biblia-audio.js, D-123).
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/biblia-audio.js");
const B = require("../js/biblia-motor.js");
const fs = require("fs");
const path = require("path");

test("velocidades: etiqueta con coma, ciclo y valores raros vuelven a 1×", () => {
  assert.deepEqual(A.VELOCIDADES.map(A.etiquetaVel), ["0,8×", "0,9×", "1×", "1,1×", "1,25×"]);
  assert.equal(A.siguienteVel(1), 1.1);
  assert.equal(A.siguienteVel(1.25), 0.8, "después de la más rápida vuelve a la más lenta");
  assert.equal(A.velNormal("3"), 1);
  assert.equal(A.velNormal(undefined), 1);
  assert.equal(A.velNormal("0.9"), 0.9);
  assert.equal(A.etiquetaVel(7), "1×");
});

test("texto para la voz: mayúsculas como palabras y espacios limpios", () => {
  assert.equal(A.paraVoz("Y HABÍA un hombre"), "Y Había un hombre");
  assert.equal(A.paraVoz("le llamarán: JEHOVÁ, JUSTICIA NUESTRA."), "le llamarán: Jehová, Justicia Nuestra.");
  assert.equal(A.paraVoz("  En   el\nprincipio "), "En el principio");
  assert.equal(A.paraVoz("Y dijo Dios"), "Y dijo Dios", "una sola mayúscula no se toca");
  assert.equal(A.paraVoz(null), "");
});

test("partir: los versículos cortos quedan enteros; los largos, en frases", () => {
  assert.deepEqual(A.partir("Jesús lloró."), ["Jesús lloró."]);
  assert.deepEqual(A.partir(""), []);
  const largo = "Primera frase bastante larga para la prueba. Segunda frase también larga; tercera parte: y una cuarta que termina aquí.";
  const ps = A.partir(largo, 50);
  assert.ok(ps.length >= 3, `se parte (${ps.length} trozos)`);
  assert.ok(ps.every(p => p.length <= 50), "ningún trozo pasa el límite");
  assert.equal(ps.join(" "), largo, "no se pierde ni cambia nada");
  // Una frase sin puntos, muy larga: se parte en las comas.
  const comas = "uno dos tres cuatro, cinco seis siete ocho, nueve diez once doce, trece catorce quince";
  const pc = A.partir(comas, 30);
  assert.ok(pc.length >= 3 && pc.every(p => p.length <= 30), JSON.stringify(pc));
  assert.equal(pc.join(" "), comas);
  // Sin dónde cortar: queda entera (mejor larga que cortada a la mitad de una palabra).
  assert.deepEqual(A.partir("a".repeat(80), 30), ["a".repeat(80)]);
});

test("partir con la Biblia real: nada se pierde y los trozos son razonables", () => {
  const job = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data/biblia/rv1909/Job.json"), "utf8"));
  const v = job.caps[38][29]; // Job 39:30, uno de los más largos
  const ps = A.partir(v);
  assert.equal(ps.join(" "), A.paraVoz(v));
  assert.ok(ps.every(p => p.length <= A.MAX_TROZO + 40), `trozos de ${ps.map(p => p.length).join(", ")} letras`);
});

test("encabezado: como se dice en voz alta", () => {
  assert.equal(A.encabezado(B.libro("John"), 3), "Juan, capítulo 3.");
  assert.equal(A.encabezado(B.libro("Ps"), 23), "Salmo 23.");
  assert.equal(A.encabezado(B.libro("1Cor"), 13), "Primera de Corintios, capítulo 13.");
  assert.equal(A.encabezado(B.libro("2Kgs"), 2), "Segunda de Reyes, capítulo 2.");
  assert.equal(A.encabezado(B.libro("3John"), 1), "Tercera de Juan.", "libro de un solo capítulo: solo el nombre");
  assert.equal(A.encabezado(B.libro("Jude"), 1), "Judas.");
  assert.equal(A.encabezado(null, 1), "");
  assert.equal(A.nombreVoz("Génesis"), "Génesis");
});

test("trozos del capítulo: encabezado, un trozo por versículo y saltos de versículo", () => {
  const versos = ["En el principio.", "", "Y dijo Dios. Sea la luz; y fué la luz.", "Y vió Dios."];
  const l = A.trozos(versos, { encabezado: "Génesis, capítulo 1.", max: 30 });
  assert.deepEqual(l[0], { v: 0, texto: "Génesis, capítulo 1." });
  assert.deepEqual(l.map(x => x.v), [0, 1, 3, 3, 4], "el 2 (vacío) no está y el 3 se partió");
  assert.equal(A.totalVersos(versos), 3);
  assert.equal(A.indiceDe(l, 1), 1);
  assert.equal(A.indiceDe(l, 2), 2, "un versículo que no está: el siguiente");
  assert.equal(A.indiceDe(l, 9), 4, "más allá del final: el último");
  assert.equal(A.siguiente(l, 0), 1);
  assert.equal(A.siguiente(l, 2), 4, "desde la mitad del 3 salta al 4");
  assert.equal(A.siguiente(l, 4), -1, "después del último no hay");
  assert.equal(A.anterior(l, 3), 1, "desde la segunda parte del 3 vuelve al 1");
  assert.equal(A.anterior(l, 4), 2, "del 4 al comienzo del 3");
  assert.equal(A.anterior(l, 1), 0, "del 1 al encabezado");
  assert.equal(A.anterior(l, 0), 0);
  assert.deepEqual(A.trozos(["Hola."]), [{ v: 1, texto: "Hola." }], "sin encabezado");
});

test("completo: 8 de cada 10 versículos escuchados", () => {
  assert.equal(A.completo(36, 36), true);
  assert.equal(A.completo(29, 36), true);
  assert.equal(A.completo(28, 36), false);
  assert.equal(A.completo(2, 2), true);
  assert.equal(A.completo(1, 2), false);
  assert.equal(A.completo(0, 0), false);
});

const VOCES = [
  { name: "Samantha", lang: "en-US", voiceURI: "com.apple.voice.compact.en-US.Samantha" },
  { name: "Mónica", lang: "es-ES", voiceURI: "com.apple.voice.compact.es-ES.Monica" },
  { name: "Paulina", lang: "es-MX", voiceURI: "com.apple.voice.compact.es-MX.Paulina" },
  { name: "Eddy (español (México))", lang: "es-MX", voiceURI: "com.apple.eloquence.es-MX.Eddy" },
  { name: "Mónica (mejorada)", lang: "es-ES", voiceURI: "com.apple.voice.enhanced.es-ES.Monica" },
  { name: "Paulina", lang: "es-MX", voiceURI: "com.apple.voice.compact.es-MX.Paulina" }
];

test("voces: solo español, sin repetidas, la mejor primero", () => {
  const vs = A.voces(VOCES);
  assert.deepEqual(vs.map(A.idVoz), [
    "com.apple.voice.enhanced.es-ES.Monica",   // mejorada gana
    "com.apple.voice.compact.es-MX.Paulina",   // Latinoamérica antes que España
    "com.apple.voice.compact.es-ES.Monica",
    "com.apple.eloquence.es-MX.Eddy"           // de juguete, al final
  ]);
  assert.deepEqual(A.voces(null), []);
  assert.equal(A.pais("es-419"), "419");
  assert.equal(A.pais("es_ES"), "ES");
  assert.equal(A.pais("es"), "");
  assert.equal(A.esEspanol({ lang: "es" }), true);
  assert.equal(A.esEspanol({ lang: "en-ES" }), false);
});

test("elegir voz: la guardada si existe; si no, la mejor; sin voces, ninguna", () => {
  assert.equal(A.idVoz(A.elegirVoz(VOCES, "com.apple.voice.compact.es-ES.Monica")), "com.apple.voice.compact.es-ES.Monica");
  assert.equal(A.idVoz(A.elegirVoz(VOCES, "otra-que-no-está")), "com.apple.voice.enhanced.es-ES.Monica");
  assert.equal(A.idVoz(A.elegirVoz(VOCES, "com.apple.voice.compact.en-US.Samantha")), "com.apple.voice.enhanced.es-ES.Monica", "una voz en inglés no se usa aunque esté guardada");
  assert.equal(A.elegirVoz([], "x"), null);
  assert.equal(A.elegirVoz([{ name: "Solo nombre", lang: "es-MX" }]).name, "Solo nombre", "sin voiceURI usa el nombre");
});

test("etiqueta de la voz: nombre, país y calidad", () => {
  assert.equal(A.etiquetaVoz(VOCES[4]), "Mónica · España (mejorada)");
  assert.equal(A.etiquetaVoz(VOCES[2]), "Paulina · México");
  assert.equal(A.etiquetaVoz(VOCES[3]), "Eddy · México");
  assert.equal(A.etiquetaVoz({ name: "Lupe", lang: "es-US", voiceURI: "com.apple.voice.premium.es-US.Lupe" }), "Lupe · Estados Unidos (premium)");
  assert.equal(A.etiquetaVoz({ name: "Voz rara", lang: "es" }), "Voz rara");
  assert.equal(A.etiquetaVoz(null), "Voz del sistema");
});
