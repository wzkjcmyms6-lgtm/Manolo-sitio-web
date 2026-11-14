const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const B = require("../js/biblia-motor.js");
const T = require("../js/biblia-texto.js");

const DIR = path.join(__dirname, "..", "data", "biblia", "rv1909");
const libro = id => JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), "utf8"));

test("la conversión trae los 66 libros, 1.189 capítulos y 31.102 versículos", () => {
  const indice = JSON.parse(fs.readFileSync(path.join(DIR, "indice.json"), "utf8"));
  assert.equal(indice.libros.length, 66);
  assert.equal(indice.capitulos, 1189);
  assert.equal(indice.versiculos, 31102);
  assert.match(indice.fuente, /seven1m\/open-bibles\/blob\/[0-9a-f]{40}\/spa-rv1909\.usfx\.xml/);
  let caps = 0, vers = 0, vacios = 0;
  B.LIBROS.forEach((l, i) => {
    assert.equal(indice.libros[i].id, l.id);
    const d = libro(l.id);
    assert.equal(d.libro, l.id);
    assert.equal(d.caps.length, l.capitulos, `${l.nombre}: capítulos como en el formulario`);
    caps += d.caps.length;
    d.caps.forEach((c, k) => {
      assert.ok(c.length >= 1 && c.length <= 176, `${l.nombre} ${k + 1}`);
      vers += c.length;
      c.forEach(t => { if (!t) vacios++; else assert.doesNotMatch(t, /<|>|\s{2}/, "sin etiquetas ni espacios dobles"); });
    });
  });
  assert.equal(caps, 1189);
  assert.equal(vers, 31102);
  assert.ok(vacios <= 20, `${vacios} versículos que la RV1909 une a otro`);
});

test("citas conocidas cuadran con el formulario", () => {
  assert.match(T.textoCita(libro("John"), 3, "16"), /^Porque de tal manera amó Dios al mundo/);
  assert.match(T.textoCita(libro("Ps"), 23, "1"), /es mi pastor; nada me faltará/);
  assert.equal(libro("Ps").caps[118].length, 176, "Salmo 119");
  assert.match(T.textoCita(libro("Gen"), 1, "1"), /^EN el principio crió Dios los cielos y la tierra\.$/);
  assert.match(T.textoCita(libro("Rev"), 22, "21"), /Amén\.$/);
  assert.match(T.textoCita(libro("Phil"), 4, "13"), /Todo lo puedo en Cristo que me fortalece/);
  const dos = T.textoCita(libro("Prov"), 3, "5-6");
  assert.match(dos, /Fíate de Jehová.*Reconócelo en todos tus caminos/);
  assert.equal(T.textoCita(libro("John"), 3, "99"), null, "versículo que no existe");
  assert.equal(T.textoCita(libro("John"), 30, "1"), null, "capítulo que no existe");
});

test("ortografía actual sin tocar el resto", () => {
  assert.equal(T.ortografiaActual("Y vino á Jesús, y fué con él"), "Y vino a Jesús, y fue con él");
  assert.equal(T.ortografiaActual("Á ti, oh Jehová"), "A ti, oh Jehová");
  assert.equal(T.ortografiaActual("dió y vió; ó bien é hizo"), "dio y vio; o bien e hizo");
  assert.equal(T.ortografiaActual("Éste es aquél que sólo dí"), "Este es aquel que solo di");
  assert.equal(T.ortografiaActual("Jehová está aquí; más sé que tú"), "Jehová está aquí; más sé que tú", "las tildes que siguen vigentes no cambian");
  assert.equal(T.ortografiaActual("para oir"), "para oír");
  assert.equal(T.mostrar("EN el principio crió Dios", { actual: true, numero: 1 }), "En el principio crió Dios");
  assert.equal(T.mostrar("Salmo de David. JEHOVÁ es mi pastor", { actual: true, numero: 1 }), "Salmo de David. Jehová es mi pastor");
  assert.equal(T.mostrar("Y ACONTECIÓ que", { actual: true, numero: 1 }), "Y aconteció que", "en medio de la frase, minúscula");
  assert.equal(T.mostrar("Y HABLÓ JEHOVÁ", { actual: true, numero: 1 }), "Y habló JEHOVÁ", "solo la primera");
  assert.equal(T.mostrar("Y JEHOVÁ dijo", { actual: true, numero: 1 }), "Y Jehová dijo", "los nombres siguen con mayúscula");
  assert.equal(T.mostrar("¿HASTA cuándo", { actual: true, numero: 1 }), "¿Hasta cuándo");
  assert.equal(T.mostrar("JESUS NAZARENO", { actual: true, numero: 19 }), "JESUS NAZARENO", "solo el versículo 1");
  assert.equal(T.mostrar("vino á él", { actual: false }), "vino á él", "sin la opción, el original");
  const j = T.textoCita(libro("John"), 3, "16", { actual: true });
  assert.match(j, /ha dado a su Hijo/);
});

test("números de versículo y forma corta", () => {
  assert.deepEqual(T.numeros("16-18,20"), [16, 17, 18, 20]);
  assert.equal(T.numeros("abc"), null);
  assert.equal(T.spec([20, 16, 17, 18]), "16-18,20");
  assert.equal(T.spec([5]), "5");
  assert.equal(T.spec([1, 3, 4]), "1,3-4");
});

test("capítulo anterior y siguiente cruzan de libro", () => {
  assert.deepEqual(T.vecino("John", 3, 1), { libro: "John", cap: 4 });
  assert.deepEqual(T.vecino("John", 21, 1), { libro: "Acts", cap: 1 });
  assert.deepEqual(T.vecino("Matt", 1, -1), { libro: "Mal", cap: 4 });
  assert.equal(T.vecino("Gen", 1, -1), null);
  assert.equal(T.vecino("Rev", 22, 1), null);
});

test("claves y citas", () => {
  assert.equal(T.claveVers("1John", 4, 8), "1John.4.8");
  assert.deepEqual(T.leerClave("1John.4.8"), { libro: "1John", cap: 4, v: 8 });
  assert.deepEqual(T.leerClave("Ps.23"), { libro: "Ps", cap: 23, v: null });
  assert.equal(T.leerClave("Xyz.1.1"), null);
  assert.equal(T.cita("1Cor", 13, "4-7"), "1 Corintios 13:4-7");
});

test("link a otra versión (solo un link)", () => {
  assert.equal(T.linkOtraVersion("John", 3, "16", "RVR1960"), "https://www.biblegateway.com/passage/?search=John%203%3A16&version=RVR1960");
  assert.match(T.linkOtraVersion("Song", 2, null, "NVI"), /search=Song%20of%20Solomon%202&version=NVI$/);
  assert.match(T.linkOtraVersion("Ps", 23, "1", "inventada"), /version=RVR1960$/, "una versión desconocida usa la de siempre");
});

test("buscar en toda la Biblia: varias palabras, sin tildes", () => {
  const libros = ["John", "Ps", "Rom"].map(libro);
  const r = T.buscar(libros, "tal manera amo", 50);
  assert.ok(r.items.some(x => x.libro === "John" && x.cap === 3 && x.v === 16));
  const m = T.buscar(libros, "misericord", 5);
  assert.ok(m.total > 50 && m.items.length === 5, "a medias y con límite");
  assert.equal(T.buscar(libros, " ", 5).items.length, 0);
});

test("búsqueda con textos ya normalizados y resaltado sin tildes", () => {
  const j = libro("John");
  const conNorm = { libro: "John", caps: j.caps, norm: j.caps.map(c => c.map(T.norm)) };
  assert.deepEqual(T.buscar([conNorm], "tal manera amo", 5).items, T.buscar([j], "tal manera amo", 5).items, "mismo resultado");
  assert.deepEqual(T.palabrasDe("¿No temas, Jacob?"), ["no", "temas", "jacob"]);
  const partes = T.resaltar("Porque de tal manera amó Dios", T.palabrasDe("tal amo"));
  assert.deepEqual(partes.filter(p => p.si).map(p => p.t), ["tal", "amó"], "«amo» encuentra «amó» y se muestra con su tilde");
  assert.equal(partes.map(p => p.t).join(""), "Porque de tal manera amó Dios", "el texto queda igual");
  assert.deepEqual(T.resaltar("sin nada", []), [{ t: "sin nada", si: false }]);
});

test("cada palabra cuenta desde el comienzo de una palabra", () => {
  const libros = ["John", "Rom", "Heb"].map(libro);
  const r = T.buscar(libros, "tal manera amo", 10);
  assert.deepEqual(r.items.map(x => `${x.libro} ${x.cap}:${x.v}`), ["John 3:16", "Rom 15:14"], "«digamos» (Hebreos 13:6) ya no cuenta para «amo»");
  assert.deepEqual(T.resaltar("De tal manera que digamos", ["amo"]).filter(p => p.si), []);
  assert.ok(T.buscar(libros, "misericord", 5).total > 5, "a medias sigue sirviendo");
});

test("la frase exacta va primero", () => {
  const libros = ["Gen", "Ps", "Isa", "Ezek"].map(libro);
  const r = T.buscar(libros, "jehova es mi pastor", 50);
  assert.ok(r.total > 1, `${r.total} versículos tienen las cuatro palabras`);
  assert.deepEqual([r.items[0].libro, r.items[0].cap, r.items[0].v], ["Ps", 23, 1]);
  const una = T.buscar(libros, "pastor", 3);
  assert.equal(una.items[0].libro, "Gen", "una sola palabra: en el orden de la Biblia");
});
