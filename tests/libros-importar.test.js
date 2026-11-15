// Importar de Goodreads, StoryGraph y Kindle (js/libros-importar.js, D-110).
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../js/libros-importar.js");
const L = require("../js/libros-motor.js");

const HOY = "2026-11-15";
const GOODREADS = [
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies",
  '2767052,"The Hunger Games (The Hunger Games, #1)",Suzanne Collins,"Collins, Suzanne",,="0439023483",="9780439023481",5,4.33,Scholastic Press,Hardcover,374,2008,2008,2024/03/10,2024/02/01,,,read,"Me encantó.<br/>Muy, muy bueno.",,,1,0',
  '40121378,Atomic Habits: An Easy & Proven Way to Build Good Habits,James Clear,"Clear, James",,="",="",0,4.38,Avery,Kindle Edition,320,2018,2018,,2026/10/01,currently-reading,currently-reading (#1),currently-reading,,,,0,0',
  '1,Sapiens,Yuval Noah Harari,"Harari, Yuval Noah",,="0062316095",="9780062316097",4,4.39,Harper,Audible Audio,,2015,2011,,2025/12/01,to-read,to-read (#3),to-read,,,,0,0',
  '2,Cien años de soledad,Gabriel García Márquez,"García Márquez, Gabriel",,="",="",5,4.1,,Paperback,471,1967,1967,2025/01/20,2024/12/01,,,read,,,,1,0'
].join("\n");
const STORYGRAPH = [
  "Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?",
  'El nombre del viento,Patrick Rothfuss,,9788401337208,paperback,read,2025/02/01,2025/04/10,2025/03/01-2025/04/10,1,adventurous,medium,,,,,,4.5,"Lindo, largo.",,,,No',
  "Meditaciones,Marco Aurelio,,abc123,digital,did-not-finish,2025/05/01,,,0,,,,,,,,,,,,,No",
  "Dune,Frank Herbert,,9780441013593,audio,paused,2025/06/01,,,0,,,,,,,,3.0,,,,,No"
].join("\r\n");

test("CSV: comillas, comas y saltos de línea dentro de un campo", () => {
  const f = I.csv('a,b,c\r\n1,"dos, tres","línea 1\nlínea 2"\n\n4,"con ""comillas""",6');
  assert.deepEqual(f, [{ a: "1", b: "dos, tres", c: "línea 1\nlínea 2" }, { a: "4", b: 'con "comillas"', c: "6" }]);
  assert.deepEqual([I.detectar(GOODREADS), I.detectar(STORYGRAPH), I.detectar("Libro (Autor)\n- x\n\nt\n=========="), I.detectar("hola")], ["goodreads", "storygraph", "kindle", null]);
  assert.deepEqual([I.isbnDe('="9780439023481"'), I.isbnDe('=""'), I.isbnDe("abc123"), I.isbnDe("0-439-02348-3")], ["9780439023481", null, null, "0439023483"]);
  assert.deepEqual([I.formatoDe("Kindle Edition"), I.formatoDe("Audible Audio"), I.formatoDe("Hardcover"), I.formatoDe("digital")], ["digital", "audio", "papel", "digital"]);
  assert.deepEqual(I.sagaDelTitulo("The Hunger Games (The Hunger Games, #1)"), { titulo: "The Hunger Games", saga: "The Hunger Games", sagaN: 1 });
  assert.deepEqual(I.sagaDelTitulo("Sapiens"), { titulo: "Sapiens", saga: null, sagaN: null });
});

test("Goodreads: estados, calificación, fechas, formato, ISBN, saga y reseña", () => {
  const r = I.libros(GOODREADS, [], HOY);
  assert.deepEqual([r.de, r.total, r.nuevos.length], ["goodreads", 4, 4]);
  const [hg, ah, sa, cien] = r.nuevos;
  assert.deepEqual([hg.titulo, hg.saga, hg.sagaN, hg.estado, hg.calificacion, hg.paginas, hg.fechaFin, hg.fechaRegistro, hg.formato, hg.isbn, hg.anio],
    ["The Hunger Games", "The Hunger Games", 1, "terminado", 5, 374, "2024-03-10", "2024-02-01", "papel", "9780439023481", 2008]);
  assert.equal(hg.opinion, "Me encantó.\nMuy, muy bueno.");
  assert.deepEqual(hg.importado, { de: "goodreads", id: "2767052" });
  assert.deepEqual([ah.estado, ah.calificacion, ah.formato, ah.isbn, ah.fechaInicio], ["leyendo", null, "digital", null, "2026-10-01"], "leyendo sin fecha: desde que lo agregaste");
  assert.deepEqual([sa.estado, sa.formato, sa.paginas, sa.anio], ["por_leer", "audio", null, 2011], "el año de la primera edición");
  assert.equal(cien.fechaFin, "2025-01-20");
});

test("StoryGraph: abandonado, pausado, estrellas con decimales y fechas leídas", () => {
  const r = I.libros(STORYGRAPH, [], HOY);
  assert.equal(r.de, "storygraph");
  const [nv, me, du] = r.nuevos;
  assert.deepEqual([nv.estado, nv.calificacion, nv.fechaInicio, nv.fechaFin, nv.isbn, nv.opinion], ["terminado", 5, "2025-03-01", "2025-04-10", "9788401337208", "Lindo, largo."]);
  assert.deepEqual([me.estado, me.formato, me.isbn], ["abandonado", "digital", null]);
  assert.deepEqual([du.estado, du.formato, du.calificacion], ["abandonado", "audio", 3]);
});

test("sin duplicar: por ISBN o por título y autor (y repetidos en el archivo)", () => {
  const tuyos = [
    L.normalizarLibro("a", { titulo: "Hábitos atómicos", autor: "James Clear" }),
    L.normalizarLibro("b", { titulo: "Atomic Habits", autor: "Clear, James" }),
    Object.assign(L.normalizarLibro("c", { titulo: "Los juegos del hambre", autor: "S. Collins" }), { isbn: "9780439023481" }),
    L.normalizarLibro("d", { titulo: "Cien Años de Soledad", autor: "G. García Márquez" })
  ];
  const r = I.libros(GOODREADS + "\n" + GOODREADS.split("\n")[3], tuyos, HOY);
  assert.deepEqual(r.nuevos.map(x => x.titulo), ["Sapiens"], "Hunger Games por ISBN, Atomic Habits por título (sin subtítulo), Cien años por título y apellido; Sapiens dos veces en el archivo entra una");
  assert.deepEqual(r.repetidos.map(x => x.libro.id || "en el archivo"), ["c", "b", "d", "en el archivo"]);
});

const KINDLE_ES = `﻿Hábitos atómicos (James Clear)
- Tu subrayado en la página 38 | posición 580-581 | Añadido el domingo, 5 de marzo de 2023 22:21:43

Cada acción que realizas es un voto
==========
Hábitos atómicos (James Clear)
- Tu subrayado en la página 38 | posición 580-582 | Añadido el domingo, 5 de marzo de 2023 22:22:10

Cada acción que realizas es un voto por el tipo de persona que deseas ser.
==========
Hábitos atómicos (James Clear)
- Tu nota en la página 38 | posición 582 | Añadido el domingo, 5 de marzo de 2023 22:23:00

Aplicarlo con el gimnasio.
==========
Hábitos atómicos (James Clear)
- Tu marcador en la página 40 | posición 600 | Añadido el lunes, 6 de marzo de 2023 7:00:00

==========
El poder del ahora (Eckhart Tolle)
- Tu subrayado en la posición 120-121 | Añadido el martes, 7 de marzo de 2023 8:00:00

Date cuenta de que el momento presente es todo lo que tienes.
==========
`;
const KINDLE_EN = `Meditations (Marcus Aurelius)
- Your Highlight on page 12 | Location 140-142 | Added on Sunday, March 5, 2023 10:21:43 PM

You have power over your mind.
==========
`;

test("Kindle: subrayados, notas, sin marcadores, en español e inglés", () => {
  const c = I.clippings(KINDLE_ES);
  assert.deepEqual(c.map(x => [x.titulo, x.autor, x.tipo, x.pagina, x.fecha]), [
    ["Hábitos atómicos", "James Clear", "frase", 38, "2023-03-05"],
    ["Hábitos atómicos", "James Clear", "frase", 38, "2023-03-05"],
    ["Hábitos atómicos", "James Clear", "nota", 38, "2023-03-05"],
    ["El poder del ahora", "Eckhart Tolle", "frase", null, "2023-03-07"]]);
  assert.deepEqual(I.clippings(KINDLE_EN)[0], { titulo: "Meditations", autor: "Marcus Aurelius", tipo: "frase", texto: "You have power over your mind.", pagina: 12, ubicacion: "140-142", fecha: "2023-03-05" });
});

test("Kindle: agrupa por libro, deja la frase más larga y no repite las que ya tienes", () => {
  const tuyos = { libros: [L.normalizarLibro("l1", { titulo: "Hábitos atómicos", autor: "James Clear" })],
    frases: [L.normalizarFrase("f1", { libroId: "l1", texto: "Cada acción que realizas es un voto por el tipo de persona que deseas ser." })] };
  const r = I.kindle(KINDLE_ES + KINDLE_EN, tuyos, HOY);
  assert.deepEqual(r.libros.map(g => [g.titulo, g.libro ? g.libro.id : null, g.frases.length, g.notas.length]), [["Hábitos atómicos", "l1", 1, 1], ["El poder del ahora", null, 1, 0], ["Meditations", null, 1, 0]]);
  assert.equal(r.libros[0].frases[0].ya, true, "la más larga ya la tenías");
  assert.deepEqual([r.nuevas, r.repetidas, r.notas], [2, 1, 1]);
  assert.equal(I.kindle("", {}, HOY).libros.length, 0);
});
