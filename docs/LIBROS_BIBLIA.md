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

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/lectura-comun.js` | Piezas de pantalla de las dos secciones: hoja que sube desde abajo, exportar, errores |
| `js/biblia-motor.js` | UMD sin DOM: 66 libros, validar, buscar, racha, calendario, exportar. Pruebas: `tests/biblia-motor.test.js` |
| `js/biblia.js` | Pantalla de Biblia. Registra su ícono (`ICONS.biblia`) |
| `js/libros-motor.js` | UMD sin DOM: validar libros y frases, ordenar, buscar, resumen, color de la tapa genérica, exportar. Pruebas: `tests/libros-motor.test.js` |
| `js/libros.js` | Pantalla de Libros. Registra su ícono (`ICONS.libro`) |
| `css/libros.css` | Estilos propios (solo `.lib-` y `.bib-`) |
| `scripts/e2e/lectura.js` | Prueba de pantalla de las dos secciones (95 comprobaciones; Open Library simulado) |

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
- **Exportar (JSON)**: libros y frases.

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

## Firebase

Las reglas publicadas (`firestore.rules`) ya permiten que cada usuario lea
y escriba **todo** lo que está bajo `users/{su uid}/…`. Las colecciones
nuevas (`users/{uid}/biblia`, `users/{uid}/libros`, …) quedan cubiertas:
**no hay que cambiar nada en la consola de Firebase.**
