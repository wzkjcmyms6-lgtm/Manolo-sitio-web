# Libros y Biblia

Dos secciones nuevas (pedido del dueño, 2026-10-29). Solo se llega desde
dos tarjetas de **Inicio** (debajo de Finanzas e Inversiones); son
sub-paneles de `inicio` en `SUB_PANELS` (`js/modules.js`), como Running y
Bicicleta: **no** están en la barra inferior ni en el menú ☰. Cada una
tiene el botón "‹ Inicio" arriba; el gesto o atrás del navegador también
vuelve (la navegación es por `#hash`). No muestran el versículo de arriba
(pedido del dueño, 2026-10-29: `showPanel()` en `js/modules.js`).

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Tarjetas en Inicio + secciones vacías con botón volver | ✅ 2026-10-29 |
| 2 | Biblia completa | ✅ 2026-10-29 |
| 3 | Libros sin portada + frases | ✅ 2026-10-29 |
| 4 | Portadas (búsqueda gratuita y foto) | ✅ 2026-10-29 |

## Siguiente nivel (2026-11-06 a 2026-11-15, D-102 a D-115)

Pedido del dueño: "Libros, Biblia y Medir tiempos: siguiente nivel". Plan,
auditoría y detalle de cada fase en `docs/LECTURA_NIVEL2.md`.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría y diseño | ✅ |
| 1 | Biblia: texto RV1909, lector y descarga sin internet (D-102) | ✅ |
| 2 | Biblia: resaltar, favoritos, notas, anotar desde el lector, buscar y compartir (D-105) | ✅ |
| 3 | Biblia: planes, progreso, memorizar, temas y racha (D-106) | ✅ |
| 4 | Libros: "Leer ahora", velocidad, Abandonado, releer y audiolibros (D-107) | ✅ |
| 5 | Libros: "¿Qué leo después?", frases, importar, escanear y estadísticas (D-108 a D-112) | ✅ |
| 6–7 | Medir tiempos (en `docs/TIEMPOS.md`; D-113 y D-114) | ✅ |
| 8 | QA final, docs y lista para el iPhone (D-115) | ✅ |

**En pocas palabras, hoy puedes:** leer la Biblia dentro de Manolo (también
sin internet), marcar y anotar desde el lector, seguir un plan y memorizar
versículos; medir tus sesiones de lectura y saber cuándo terminas cada
libro; agregar libros escaneando el código de barras o importando de
Goodreads, StoryGraph o Kindle; repasar tus frases y ver tus estadísticas.
Tus versículos, libros y frases de antes quedaron tal cual: lo nuevo solo
suma campos (lo comprueba `scripts/e2e/lectura-qa.js`, D-115).

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/lectura-comun.js` | Piezas de pantalla de las dos secciones: hoja que sube desde abajo, exportar, errores |
| `js/biblia-motor.js` | UMD sin DOM: 66 libros, validar, buscar, racha, calendario, exportar. Pruebas: `tests/biblia-motor.test.js` |
| `js/biblia.js` | Pantalla de Biblia. Registra su ícono (`ICONS.biblia`) |
| `js/biblia-texto.js` | UMD sin DOM: dónde está cada libro de la RV1909, ortografía actual al mostrar, el texto de una cita. Pruebas: `tests/biblia-texto.test.js` |
| `js/biblia-lector.js` | Lector a pantalla completa: libro y capítulo, letra, ortografía actual, deslizar, "Marcar como leído", descarga sin internet |
| `js/biblia-seleccion.js` | Tocar versículos en el lector: resaltar, favorito, nota, anotar, compartir, copiar y memorizar |
| `js/biblia-marcas.js` | UMD: resaltados, favoritos y notas (`biblia_marcas`, un documento por libro). Pruebas: `tests/biblia-marcas.test.js` |
| `js/biblia-imagen.js` | Imagen 1080 × 1350 para compartir un versículo (también las frases de Libros) |
| `js/biblia-buscar.js` + `js/biblia-buscar-worker.js` | Buscar en toda la Biblia sin trabar la pantalla (Worker) |
| `js/biblia-planes.js` | UMD: planes de lectura, lo atrasado, ponerse al día, mover el plan, progreso de capítulos. Pruebas: `tests/biblia-planes.test.js` |
| `js/biblia-plan-ui.js`, `js/biblia-progreso-ui.js` | Tarjeta "Hoy" y página de planes; mapa de los 66 libros |
| `js/biblia-memoria.js` + `js/biblia-memoria-ui.js` | Memorizar: cajas (1, 2, 4, 8, 16 y 32 días) y tres formas de practicar. Pruebas: `tests/biblia-memoria.test.js` |
| `data/biblia/rv1909/*.json` | Texto de la Reina-Valera 1909 (dominio público), un archivo por libro; lo arma `npm run biblia` |
| `js/libros-motor.js` | UMD sin DOM: validar libros y frases, ordenar, buscar, resumen, color de la tapa genérica, exportar. Pruebas: `tests/libros-motor.test.js` |
| `js/libros.js` | Pantalla de Libros. Registra su ícono (`ICONS.libro`) |
| `js/libros-progreso.js` | UMD: páginas por día, meta, racha, ritmo y cuándo terminas cada libro. Pruebas: `tests/libros-progreso.test.js` |
| `js/libros-sesiones.js` + `js/libros-sesion.js` | "Leer ahora": cronómetro por marcas de tiempo, sesiones, velocidad y el tiempo que falta. Pruebas: `tests/libros-sesiones.test.js` |
| `js/libros-siguiente.js` + `js/libros-siguiente-ui.js` | "¿Qué leo después?" con su razón. Pruebas: `tests/libros-siguiente.test.js` |
| `js/libros-frases.js` + `js/libros-frases-ui.js` | Frases de hoy (repaso espaciado), favoritas, etiquetas y compartir. Pruebas: `tests/libros-frases.test.js` |
| `js/libros-notas.js` | Notas de cada libro (lo que aprendí, para aplicar, nota) |
| `js/libros-importar.js` + `js/libros-importar-ui.js` | Importar de Goodreads, StoryGraph y Kindle sin duplicar. Pruebas: `tests/libros-importar.test.js` |
| `js/libros-isbn.js` | UMD sin DOM: lee el código de barras (EAN-13) de una foto. Se carga al tocar Escanear. Pruebas: `tests/libros-isbn.test.js` |
| `js/libros-escaner.js` | Hoja de escanear: foto, elegir foto o cámara en vivo |
| `js/libros-estadisticas.js` | UMD sin DOM: días leídos, calendario, tiempo, velocidad y tendencia, autores, "Tu año en libros". Pruebas: `tests/libros-estadisticas.test.js` |
| `js/libros-estadisticas-ui.js` | Secciones nuevas de Estadísticas, tarjeta y hoja de "Tu año en libros", imagen para compartir |
| `css/libros.css` | Estilos propios (solo `.lib-` y `.bib-`) |
| `scripts/e2e/lectura.js` (+ `lectura-n2.js`) | Prueba de pantalla de las dos secciones (681 comprobaciones a 390, 1280 y 320 px; Open Library simulado). `SOLO=biblia`, `marcas`, `planes`, `memoria`, `sesion`, `siguiente`, `frases`, `importar`, `isbn` o `stats` corre una parte |
| `scripts/e2e/lectura-qa.js` | QA final (D-115): tus datos de antes intactos después de usar todo lo nuevo, rendimiento con muchos datos y 320 px |

Cambios en archivos compartidos (los mínimos pedidos): dos tarjetas y dos
`<section>` en `index.html` (con su `<link>`/`<script>`) y dos líneas en
`SUB_PANELS`. Los íconos se agregan al objeto `ICONS` desde los archivos
nuevos (antes de que `renderIcons()` corra al cargar), sin tocar
`js/icons.js`.

## Biblia (fase 2)

- **Anotar**: fecha (hoy por defecto; se puede poner un día pasado, no uno
  futuro), libro (lista de los 66, en dos grupos), capítulo (avisa si ese
  libro no lo tiene: "Proverbios va de 1 a 31"), versículo (`16`, `16-18`
  o `1,3`), texto (lo escribes o pegas) y nota opcional. Propone el último
  libro que usaste.
- **Lista**: lo más reciente arriba, agrupada por mes. Buscador (todas las
  palabras, sin importar tildes, en el texto, la nota y la cita) y filtro
  por libro (solo los que ya usaste, en el orden de la Biblia).
- **Racha**: días seguidos con al menos un versículo. Si hoy todavía no
  anotaste, la racha de ayer sigue viva hasta que termine el día. También
  la mejor racha y los días del mes.
- **Calendario**: mes con los días anotados resaltados; al tocar un día
  se ven sus versículos (o "Anotar el …" con esa fecha).
- Tocar un versículo lo abre para editar; Eliminar pide confirmación.
- **Exportar (JSON)**: todos los versículos con su cita. En iPhone abre el
  menú de compartir.
- Sin internet funciona igual (Firestore guarda los cambios y los sube al
  volver la conexión).

## Leer la Biblia (2026-11-06, D-102)

Arriba de Biblia, **Leer la Biblia** (o **Seguir leyendo · Juan 3**) abre
la Reina-Valera 1909 completa a pantalla completa: libro y capítulo,
tamaño de letra, ortografía actual, deslizar para cambiar de capítulo,
"Marcar como leído", "Abrir en otra versión" y "Descargar la Biblia" para
leerla sin internet. Detalle en `docs/LECTURA_NIVEL2.md`.

## Tocar versículos, buscar y "Marcados" (2026-11-14, D-105)

En el lector, tocar versículos abre una barra: resaltar (5 colores),
★ Favorito, ✎ Nota, ＋ Anotar (el registro de siempre con el texto puesto),
Compartir como imagen y Copiar. 🔍 busca en toda la Biblia (sin tildes,
varias palabras). La pestaña **Marcados** junta favoritos, notas y
resaltados. En "Anotar versículo" el texto se completa solo al poner la
cita; "Versión del texto" dice de qué Biblia es. Detalle en
`docs/LECTURA_NIVEL2.md`.

## Planes, progreso, memorizar y temas (2026-11-14, D-106)

Arriba de Biblia, la lectura de hoy de tus **planes** (Biblia en un año,
NT en 90 días, Evangelios o Salmos en 30, Proverbios del día o "A mi
ritmo"); si te atrasas, "Ponerme al día" o "Mover el plan". **Progreso**:
cuánto leíste y el mapa de los 66 libros. **Memorizar**: repasos que se
espacian si lo sabes (primeras letras, ocultar palabras o escribirlo).
**Temas** en tus versículos, con filtro. La racha cuenta también los días
con capítulos leídos. ⚙ Ajustes: el versículo de arriba también de tus
favoritos. Detalle en `docs/LECTURA_NIVEL2.md`.

## Estadísticas y "Tu año en libros" (2026-11-15, D-112)

En **Estadísticas**, además de lo de antes:
- **Calendario** del mes: cada día que leíste se pinta, más fuerte cuanto
  más cerca (o más allá) de tu meta de páginas. ‹ › cambia de mes; tocar un
  día dice qué leíste.
- **Tiempo leyendo** (lo que mides con «Leer ahora»): el año, el mes, el
  promedio por sesión y los minutos de cada semana.
- **Velocidad**: páginas por hora, cada mes, y si vas más rápido o más
  lento que hace unos meses.
- **Tus autores**: los que más leíste.

**Tu año en libros**: del 15 de diciembre al 31 de enero aparece arriba de
Libros (y siempre, con un botón en Estadísticas): cuántos libros, páginas,
tiempo y días leíste, tus libros del año, lo mejor (5 estrellas, el más
largo, el más rápido, tu mejor mes, tu autor) y tu frase del año. «Compartir
como imagen» arma una imagen para mandar por WhatsApp o guardar.

## Escanear el código de barras (2026-11-15, D-111)

Al agregar un libro, **📷 Escanear el código de barras**: sacas una foto
del código de la contratapa (el que dice ISBN y empieza con 978 o 979) y
Manolo busca el libro en Open Library. También puedes elegir una foto que
ya tengas o usar la cámara en vivo. La foto se lee en el teléfono (no se
sube a ningún lado) y el lector funciona sin internet; la búsqueda del
libro sí necesita internet. El ISBN queda guardado en el libro y se ve en
su ficha.

## Importar de Goodreads, StoryGraph y Kindle (2026-11-15, D-110)

Abajo de Libros, **Importar**: el archivo que exportas de Goodreads o
StoryGraph (.csv) o el «My Clippings.txt» del Kindle. Ves qué es nuevo y
qué ya tienes antes de agregar; nada se duplica (por ISBN o por título y
autor). Del Kindle llegan los subrayados como frases y las notas como notas
del libro.

## Frases: repaso, favoritas, etiquetas y compartir (2026-11-15, D-109)

Arriba de Libros, **Frases de hoy**: de 1 a 3 frases para repasar; las que
te encantan vuelven pronto y las demás cada vez más espaciadas. Cada frase
puede ser **★ favorita** y tener **etiquetas**; en "Frases" se filtran. Se
**comparten como imagen**. Para copiar una frase de la página: la cámara
del iPhone (Texto en vivo) y pegar.

## "¿Qué leo después?", sagas, prioridad y notas (2026-11-15, D-108)

Debajo de "Sigue leyendo", **¿Qué leo después?** ordena tus libros por
leer y dice por qué (tu prioridad, el siguiente de una saga, un género que
hace rato no lees, el largo contra tu ritmo). "Ver los N" para cambiar la
prioridad o empezar uno. Cada libro puede tener **saga y número** y
**notas con fecha** (lo que aprendiste, ideas para aplicar).

## Leer ahora, velocidad, Abandonado, releer y audiolibros (2026-11-15, D-107)

En "Sigue leyendo" y en cada libro, **▶ Leer ahora** abre un cronómetro
(sigue con el teléfono bloqueado; pausa y pantalla encendida opcional). Al
terminar pones la página a la que llegaste y queda la sesión: páginas,
minutos y tu velocidad. La ficha muestra tu velocidad, el tiempo de
lectura que te falta, tus sesiones, **Dejar de leerlo** (Abandonado) /
**Retomar** y, en uno terminado, **📖 Leer de nuevo** (la lectura anterior
queda guardada y cuenta en tus estadísticas). Formato **papel, digital o
audiolibro**: el audiolibro avanza por tiempo (si pones su duración) o por
%. Detalle en `docs/LECTURA_NIVEL2.md`.

## Libros (fase 3)

- **Agregar o editar**: título (obligatorio), autor, páginas, estado (Por
  leer / Leyendo / Terminado), calificación opcional de 1 a 5 estrellas,
  "Mi opinión" y tres fechas con selector: registro (hoy por defecto; se
  puede poner una pasada para cargar libros leídos antes), inicio y fin.
  Al marcar "Leyendo" o "Terminado" sin fecha, propone la de hoy (y avisa).
  La fecha de fin no puede ser antes del inicio; ninguna puede ser futura.
- **Lista**: cuadrícula con portada (por ahora tapa genérica: dos tonos
  por libro, título y autor), estado y estrellas. Buscador por título o
  autor (sin tildes), filtro por estado y orden: registro, terminado,
  empezado (lo nuevo primero; sin esa fecha, al final) o título A–Z.
- **Ficha** (tocar un libro): datos, fechas, opinión y sus frases; Editar,
  Eliminar (borra también sus frases; pide confirmación) y "＋ Frase".
- **Frases**: texto, página opcional y fecha (hoy por defecto). Dentro de
  cada libro y en "Todas mis frases" (buscador por frase, título o autor).
- **Exportar (JSON)**: libros y frases (desde el QA final, D-115, también
  tus ajustes: meta de páginas por día, retos y frases por día).

## Portadas (fase 4)

- **Buscar portada** (en el formulario del libro): usa el título y el autor
  escritos y consulta **Open Library** (`openlibrary.org/search.json`),
  gratis y sin clave. Muestra hasta 6 portadas; tocas la tuya y se guarda
  **solo la URL** (`covers.openlibrary.org/b/id/…-M.jpg`). Verificado el
  2026-10-29 desde GitHub Actions (D-050): encontró portadas de 6 libros de
  prueba en español e inglés, responde en menos de 0,6 s y permite que la
  app la llame desde el teléfono (CORS). Google Books sin clave respondió
  "cuota excedida": descartado.
- **Tomar o subir foto**: en el iPhone abre cámara o fotos. La foto se
  achica a 400 × 600 como máximo y se comprime en JPEG (calidad 0,72 → 0,4
  hasta que entre en ~220 KB; una foto de 2400 × 3200 quedó en ~50 KB). Se
  guarda en `libros_portadas/{id}`; el documento de Firestore admite 1 MB.
  No usa Firebase Storage (es de pago).
- **Quitar portada**: vuelve a la tapa genérica (y borra la foto).
- **Sin portada o sin internet**: la tapa genérica (dos tonos, título y
  autor) está siempre debajo; si la imagen de Open Library no carga (por
  ejemplo sin conexión), se ve esa tapa. Las fotos sí se ven sin internet
  (están en Firestore, con su caché).
- Exportar (JSON) incluye las fotos de portada (`fotosDePortada`).

## Libros más inteligente (2026-10-29)

Pedido del dueño: "que la parte de los libros sea más desarrollada y más
inteligente". Lógica nueva en `js/libros-progreso.js` (UMD, pruebas en
`tests/libros-progreso.test.js`) y en `js/libros-motor.js`.

- **Buscar el libro** (arriba del formulario): escribes título, autor o
  ISBN y, al dejar de escribir (o con Enter / "Buscar"), consulta Open
  Library (`search.json?q=…`). Cada resultado muestra portada, título,
  autor, año, páginas y género; al tocarlo completa **título, autor,
  páginas, portada y género** (y guarda el año y la obra de Open Library).
  Primero los resultados completos (con portada, páginas y autor); los
  resúmenes y análisis quedan al final. Un ISBN (10 o 13 cifras, con o sin
  guiones) se busca como ISBN. Al editar, una portada que ya tenías se
  respeta. Verificado desde GitHub Actions el 2026-10-29 (workflow temporal,
  ya borrado): ~1 s, CORS abierto, busca sin tildes y por ISBN; da
  `number_of_pages_median`, `first_publish_year` y temas en español e inglés.
- **Género** sugerido por los temas de Open Library (Novela, Desarrollo
  personal, Negocios y finanzas, Fe y espiritualidad, Biografía, Historia,
  Psicología, Filosofía, Ciencia, Poesía, Infantil y juvenil, Otro);
  se puede cambiar. Filtro por género en la lista (aparece si algún libro
  tiene género) y orden "Calificación (mejor primero)".
- **¿Ya lo tienes?** Si el título coincide con uno de tu lista (sin tildes
  ni mayúsculas), avisa y pregunta antes de agregarlo otra vez.
- **Sigue leyendo** (arriba): cada libro "Leyendo" con la página en la que
  vas, % y barra, lo que falta y cuándo lo terminas — a tu ritmo (páginas
  desde que empezaste ÷ días) o, si todavía no hay ritmo, con tu meta
  diaria — y el botón **Anotar página** (también en la ficha).
- **Anotar página**: "Voy en la página N", con +10 / +20 / +30 y "Lo
  terminé". Se guarda en el libro `paginaActual` y `progreso` (la última
  página de cada día). Si ya lo venías leyendo, la primera vez lo que
  llevabas no cuenta como leído hoy (`paginaBase`). Al llegar a la última
  página queda **Terminado** con la fecha de hoy y sale el festejo: estrellas
  de un toque y "Escribir mi opinión".
- **Meta diaria y reto** (tarjetas de arriba, se tocan para cambiarlas):
  páginas por día (empieza en 30, como la rutina «Leer 30 páginas»), con
  racha de días seguidos leyendo; y libros a terminar en el año, con "vas al
  día / adelantado / te faltan N para ir al día". En
  `users/{uid}/meta/libros_ajustes`.
- **Estadísticas** (tercera pestaña): libros y páginas del año, páginas al
  día (promedio de 30 días), racha y la mejor, días leyendo, calificación
  promedio; gráfico de páginas por día (30 días, con la línea de tu meta) y
  de libros terminados por mes (tocar una barra dice el número; "Ver tabla");
  lo que más lees, tu autor más leído, cuánto tardas por libro y el más
  largo. Las páginas del año suman lo anotado día a día más los libros
  terminados ese año sin páginas anotadas.

## Cómo probar en el iPhone

1. Inicio: abajo, las tarjetas **Libros** y **Biblia**. Cada sección tiene
   "‹ Inicio" arriba; el gesto de volver también funciona.
2. **Biblia**: "Anotar versículo" (fecha de hoy; cámbiala para un día
   pasado), elige el libro, capítulo, versículo, pega el texto y guarda.
   Mira la racha, busca una palabra, filtra por libro y abre "Calendario".
3. **Libros**: "Agregar libro", escribe título y autor, toca "Buscar
   portada" y elige una; o "Tomar o subir foto". Pon estado, estrellas,
   fechas y tu opinión. Abre el libro y agrega una frase; mira "Todas mis
   frases".
4. Con modo avión: anota un versículo o una frase; al volver la conexión se
   sube solo.
5. "Exportar (JSON)" en cada sección: "Guardar en Archivos".
6. **Libros más inteligente**: "Agregar libro" → en "Buscar el libro"
   escribe "el amor en los tiempos" y toca el de García Márquez: se llenan
   título, autor, páginas, portada y género. En "Sigue leyendo" toca
   "Anotar página", pon la página y guarda; arriba, "Hoy" suma las páginas.
   Toca "Hoy" para cambiar la meta o ponerte un reto de libros. Abre
   "Estadísticas".
7. Lo nuevo (2026-11): la lista «Libros, Biblia y Medir tiempos: lista
   final» de `docs/TESTING.md` (unos 30 minutos).

## Firebase

Las reglas publicadas (`firestore.rules`) ya permiten que cada usuario lea
y escriba **todo** lo que está bajo `users/{su uid}/…`. Las colecciones
nuevas (`users/{uid}/biblia`, `users/{uid}/libros`, …) quedan cubiertas:
**no hay que cambiar nada en la consola de Firebase.**
