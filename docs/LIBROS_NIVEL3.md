# Libros: nivel 3 — datos de verdad de cada libro (diseño y bitácora)

Pedido del dueño (2026-11-16): "Si yo pongo un libro, tú jalas el autor,
el género, pones las páginas… los libros tienen distintas páginas. Hazlo
mucho mejor." Decisiones desde D-128. Cada fase deja la app funcionando y
publicada, con pruebas y su lista para el iPhone.

## Fases

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría con 20 libros reales y plan | ✅ |
| 1 | Buscar bien: título en español, autor correcto, el libro de verdad primero; buscar también por autor | ✅ (D-129) |
| 2 | Las páginas de tu edición: elegir la edición (editorial, año, tapa y páginas), la recomendada, el ISBN exacto y cuántas páginas por día para terminarlo | ✅ (D-130) |
| 3 | Ficha del autor: foto, quién es (en español), tus libros de él y sus otros libros con "＋ Quiero leer" | ✅ (D-131) |
| 4 | Género y temas en español, "De qué trata" y estadísticas por género | |
| 5 | Completar tu biblioteca: arreglar los libros que ya tienes (títulos en inglés, sin autor, páginas, género o portada), siempre con tu OK | |
| 6 | Recomendaciones: "Si te gustó…", del mismo autor y de los mismos temas; "¿Qué leo después?" más inteligente | |
| 7 | Control final y lista para el iPhone | |

## Auditoría (fase 0, 2026-11-16)

Hoy "Buscar el libro" (al agregar un libro) consulta Open Library y llena
título, autor, páginas, portada y género. Se probó con 20 libros reales que
la gente lee en español (Hábitos atómicos, Padre rico padre pobre, El poder
del ahora, Cien años de soledad, El hombre en busca de sentido, Los 7
hábitos, Piense y hágase rico, El principito, Una vida con propósito, El
alquimista, Sapiens, La psicología del dinero, Mindset, El monje que vendió
su Ferrari, Don Quijote, 1984, Crimen y castigo, Mero cristianismo, El
hombre más rico de Babilonia y Deja de ser tú):

1. **El título sale en otro idioma**: 10 de 20 traen el título original
   ("Atomic Habits", "Rich Dad, Poor Dad", "O Alquimista", el alemán de
   Frankl…) y eso es lo que se guarda.
2. **Las páginas no son las de tu libro**: la app pone la mediana de todas
   las ediciones del mundo (casi siempre en inglés). En español cambian
   mucho de una edición a otra: Hábitos atómicos 326–448, Padre rico
   200–416, Cien años de soledad 334–548, 1984 188–408, El alquimista
   173–219.
3. **El autor a veces está mal**: en otro alfabeto (Crimen y castigo →
   "Фёдор Михайлович Достоевский") o equivocado (El hombre más rico de
   Babilonia → "George Hill", un librito de 2 ediciones; el de verdad,
   George S. Clason con 262 ediciones, sale segundo).
4. **El género sale de temas en inglés**: 3 de 20 no tienen temas (sin
   género) y casi todos están en inglés ("Self-actualization", "Rich
   people").
5. **Nada del autor ni de qué trata el libro**: no hay quién es, sus otros
   libros ni una sinopsis.
6. **El ISBN escaneado busca la obra, no tu edición**: las páginas tampoco
   salen de tu libro.

## Lo que se probó que funciona (gratis y sin clave)

- **Open Library con `lang=es`**: la búsqueda devuelve la edición en
  español de cada obra (4 de 4: "Hábitos atómicos", "Padre rico, padre
  pobre", "Crimen y Castigo", "El hombre más rico de Babilonia"). Responde
  en 0,2–1,4 s y permite llamarla desde el teléfono (CORS).
- **Ediciones** (`/works/…/editions.json`): editorial, año, formato y
  páginas de cada edición. Ediciones en español con páginas: Cien años de
  soledad 21, Padre rico 14, El monje 12, El alquimista 12, 1984 8.
- **`/isbn/{isbn}.json`**: la edición exacta del código de barras.
- **Autor**: la ficha de Open Library trae fecha de nacimiento, foto y el
  enlace a Wikidata (17 de 20). Con ese enlace se encuentra su página de
  **Wikipedia en español** sin confundirlo con otro del mismo nombre (11
  de 11 donde hubo respuesta: Kiyosaki, Tolle, García Márquez, Coelho,
  Harari, Dweck, Cervantes…): foto, quién es ("escritor brasileño") y un
  resumen. Wikipedia limita las consultas desde servidores (aquí respondió
  "429" a veces); desde un teléfono, una consulta por autor no tiene
  problema.
- **Google Books sin clave**: desde aquí respondió "cuota excedida" (pasa
  con los servidores; desde un teléfono suele andar). Solo se usará como
  extra (la sinopsis en español), nunca como única fuente.

## Diseño por fase

### Fase 1 — Buscar bien ✅ (D-129)
Hecho en `js/libros-fuentes.js` (pruebas: `tests/libros-fuentes.test.js`
con respuestas reales; pantalla: `scripts/e2e/libros-n3.js`). Con las
respuestas reales: "habitos atomicos" → "Hábitos atómicos" (original:
Atomic Habits) y los 4 resúmenes al final; "el hombre mas rico de
babilonia" → George S. Clason primero; "crimen y castigo" → un solo
resultado, "Fiódor Dostoievski"; "paulo coelho" → sus libros, El alquimista
primero.

- Se busca con `lang=es`: el título que se llena es el de la **edición en
  español**; el original queda guardado aparte (`tituloOriginal`).
- **Orden de los resultados**: primero el libro de verdad (más ediciones,
  título parecido a lo que escribiste); al final resúmenes, análisis,
  guías y "libros de trabajo".
- **Autor**: si el nombre viene en otro alfabeto, se usa el de su ficha
  (p. ej. "Fiódor Dostoievski").
- **Buscar por autor**: si escribes un autor ("Paulo Coelho"), salen sus
  libros más leídos.
- Se guarda la clave de la obra y del autor (para las fases siguientes).

### Fase 2 — Las páginas de tu edición ✅ (D-130)
Hecho en `js/libros-fuentes.js` (ediciones), `js/libros-progreso.js`
(páginas por día) y `js/libros-ediciones-ui.js` (pantalla). Con las
ediciones reales: Hábitos atómicos → 338 (de 326 a 338, 4 ediciones) y
aparte 448 (edición especial); Padre rico → 264 (Debolsillo); con el
código 9788466332125 → 264, tu edición exacta; El alquimista → 192; Cien
años de soledad → 512 (de 494 a 512, 7 ediciones).

- Al tocar un libro: **"¿Cuál es tu edición?"** con las ediciones en
  español (portada, editorial, año, tapa blanda / dura / bolsillo y
  páginas). Arriba, la **recomendada**: la más común en español (o la que
  coincide con tu ISBN). Siempre se puede escribir otra cantidad ("Mira la
  última página de tu libro").
- Con el **código de barras** (o el ISBN escrito) se va directo a tu
  edición exacta.
- **Páginas por día**: en cada libro que estás leyendo, "Para terminarlo
  en 2 semanas: 23 páginas por día" (eliges la fecha), junto a tu meta
  diaria de siempre.
- Cambiar las páginas de un libro que vas leyendo respeta la página en la
  que vas.

### Fase 3 — Ficha del autor ✅ (D-131)
Hecho en `js/libros-fuentes.js` y `js/libros-autor-ui.js`. Con las
respuestas reales: "Paulo Coelho" → el de 767 obras (no "Paulo Coelho
Netto"), "Escritor brasileño · 1947", su resumen de Wikipedia y sus libros
más leídos en español (A orillas del río Piedra, La bruja de Portobello,
Brida, El Zahir…).

- Tocar el autor (en la ficha del libro o en la lista) abre su ficha:
  foto, quién es y de dónde, años; **tus libros de él** (con estado y
  estrellas) y **sus otros libros** (más leídos primero, títulos en
  español) con "＋ Quiero leer" (se agrega con todos los datos).
- Lo que se baja del autor se guarda en el teléfono (abre sin internet la
  segunda vez).

### Fase 4 — Género, temas y "De qué trata"
- Género mejor detectado (más pistas en español e inglés) y **temas en
  español** ("hábitos", "finanzas personales", "realismo mágico"…).
- **"De qué trata"**: un resumen corto en español cuando hay una fuente
  confiable (Wikipedia del libro o Google Books); si no, nada (no se
  inventa).
- Estadísticas por género (libros y páginas) y filtro por tema.

### Fase 5 — Completar tu biblioteca
- Un asistente revisa tus libros guardados (escritos a mano o importados)
  y propone lo que falta o está en otro idioma: título en español, autor,
  páginas de tu edición, género y portada. Tocas "Usar" o "Dejar como
  está", uno por uno o todos los seguros de una vez. Nunca se borra ni se
  cambia nada sin tu OK (solo se suman datos).

### Fase 6 — Recomendaciones
- **"Si te gustó…"**: a partir de tus libros de 4 y 5 estrellas, libros del
  mismo autor y de los mismos temas que todavía no tienes, con la razón.
- "¿Qué leo después?" usa también el género y los temas.

## Datos (solo se suman campos)

Libro (`users/{uid}/libros/{id}`): `tituloOriginal`, `autorKey` (Open
Library), `edicion` ({ olKey, editorial, anio, formato, isbn }), `temas`
(en español), `sinopsis` ({ texto, fuente }), `idioma`. Lo que ya existe
(`titulo`, `autor`, `paginas`, `genero`, `anio`, `olKey`, `isbn`, progreso,
sesiones…) no cambia de forma. Lo del autor se guarda en el teléfono.
