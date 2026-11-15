# Libros, Biblia y Medir tiempos: siguiente nivel — diseño y bitácora

Pedido del dueño (2026-11-06): que las tres secciones pasen de "solo
anotar" a acompañarlo cada día. Referencias de experiencia (sin copiar
marca, textos ni diseño): YouVersion y Logos (Biblia), Goodreads,
StoryGraph y Readwise (libros), Toggl y Structured (tiempos). Decisiones
desde D-102. Cada fase deja la app funcionando y publicada.

## Fases

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría y diseño | ✅ |
| 1 | Biblia: texto RV1909 (script y un archivo por libro), lector y descarga sin internet | ✅ |
| 2 | Biblia: anotar desde el lector y texto automático, resaltados, notas, favoritos, búsqueda y compartir | ✅ |
| 3 | Biblia: planes, progreso de capítulos, memorización, temas y racha nueva | ✅ |
| 4 | Libros: "Leer ahora", velocidad y estimaciones, estados y formatos nuevos | ✅ |
| 5 | Libros: escanear ISBN, importar, frases (repaso, etiquetas, compartir), notas, "¿Qué leo después?" y estadísticas | ✅ |
| 6 | Medir tiempos: definitiva, actividades editables, cronómetro, "Mi mañana" y llenado automático | |
| 7 | Medir tiempos: plan de la mañana, estadísticas, línea base y experimentos; "Mi día" y Hábitos | |
| 8 | QA final, docs y lista para el iPhone | |

Datos de prueba: `scripts/e2e/lectura-semilla.js` (50 días de versículos,
10 libros con progreso y frases, 40 días de tiempos).

## Auditoría (fase 0, 390 px, datos de prueba)

**Biblia**
1. No se puede leer la Biblia en Manolo: hay que copiar el versículo de
   otra app y pegarlo. Es el paso que más cuesta (5 campos + pegar).
2. La sección es solo una lista larga (6.700 px con 39 versículos); lo de
   hoy (qué leer) no existe.
3. Los textos pegados de la RV1909 traen "á", "fué", "vió": cuestan leer.
4. Bien: racha arriba, buscador sin tildes, calendario.

**Libros**
1. Los selectores de orden y género se cortan a 390 px ("Registrado (nuev",
   "Todos los género") → textos más cortos (arreglado en la fase 4).
2. "Anotar página" pide la página pero no cuánto tiempo leíste: no hay
   velocidad real ni "lo terminas el …" a tu ritmo verdadero.
3. No hay "abandonado" ni relectura; un audiolibro no tiene cómo avanzar.
4. Agregar un libro es escribir el título: no se puede escanear ni importar.
5. Bien: "Sigue leyendo" arriba, meta del día, reto del año, portadas.

**Medir tiempos**
1. Al llegar a 30 registros la actividad **deja de medirse** (desaparece el
   campo): 4 de 6 ya cerraron con los datos de prueba.
2. Solo minutos y segundos a mano; no hay cronómetro ni guía de la mañana.
3. "Tus días" es una lista de texto muy densa (7.500 px de página).
4. Ejercicio, Correr y Leer ya se miden en otras secciones y se vuelven a
   escribir aquí.
5. Las actividades son fijas (no se renombran ni se agregan).

## Diseño

### Biblia
- **Arriba, "Hoy"**: lectura del plan (un toque abre el capítulo), repaso
  de memoria pendiente, racha. Debajo, pestañas **Leer · Mis versículos ·
  Planes · Memorizar** (Calendario pasa a Mis versículos).
- **Lector** (pantalla completa dentro de Biblia): barra con
  «Libro capítulo ▾» (hoja con los 66 libros y la grilla de capítulos),
  Aa (tamaño, ortografía actual), buscar; texto con números de versículo,
  interlineado 1,7, ancho máximo 38 em; al final "Marcar como leído" y
  ‹ › (también deslizando). Se recuerda dónde quedaste.
- **Tocar versículos** (uno o varios) → barra abajo: colores, Nota,
  ★ Favorito, Compartir (imagen), Anotar, Memorizar, Copiar.
- **Abrir en otra versión**: link al pasaje en BibleGateway con la versión
  elegida en Ajustes (RVR1960 por defecto). Solo un link.

### Libros
- **"Leer ahora"** en cada libro de "Sigue leyendo": cronómetro por marcas
  de tiempo; al terminar, "¿A qué página llegaste?" → sesión guardada.
- Ficha: velocidad (pág./hora), tiempo que falta, "lo terminas el …",
  sesiones, notas con fecha, frases.
- Estados: Por leer, Leyendo, Terminado, **Abandonado**; "Leer de nuevo".
  Formato: papel, digital, audiolibro (avanza por % o minutos).

### Medir tiempos
- Arriba: **Mi mañana** (empezar → paso actual con cronómetro grande →
  Siguiente) y **Medir ahora** por actividad.
- Debajo: plan de la mañana (línea de tiempo), estadísticas, línea base y
  experimentos, días (barras por día en vez de texto).

## Modelo de datos (solo aditivo)

| Dónde | Qué |
|---|---|
| `data/biblia/rv1909/{libro}.json` (archivo, no Firestore) | `{ v, libro, nombre, caps: [[texto v1, v2…], …] }` |
| `meta/biblia_lector` | último lugar leído, tamaño de letra, ortografía actual, versión para "otra versión", favoritos arriba |
| `meta/biblia_leidos` | `dias: { AAAA-MM-DD: ["John.3", …] }` (capítulos leídos por día) |
| `biblia_marcas/{libro}` | `col` (color por versículo) e `it` (favorito y nota), D-105 |
| `meta/biblia_planes` | `planes: { id: { tipo, inicio, activo, creado, porDia?, desde?, alDia?, corrimiento?, quitado? } }`, D-106 |
| `meta/biblia_memoria` | `items: { "John_3_16": { libro, cap, vers, texto, version?, caja, proximo, creado, repasos, aciertos, ultimo } }`, D-106 |
| `biblia/{id}` + `temas`, `version` | etiquetas del versículo anotado; versión del texto |
| `libros/{id}` + `sesiones`, `formato`, `duracionMin`, `pctActual`, `pctBase`, `progresoPct`, `fechaDejado`, `lecturas` | sesiones de lectura, audiolibro, abandonado y relecturas (D-107); `notas`, `saga`, `prioridad` en la fase 5 |
| `libros_frases/{id}` + `fav`, `etiquetas`, `repaso` | frases favoritas y repaso espaciado |
| `meta/tiempos_ajustes` | actividades (nombre, emoji, orden, archivada), orden de la mañana, plan, experimentos |
| `tiempos/{fecha}` + `auto`, `noAuto` | qué segundos llegaron solos y de qué sección |

Nada de lo guardado se reescribe; lo viejo sin estos campos se ve igual.

## Fase 1: Biblia dentro de Manolo (D-102)

- **Texto**: `npm run biblia -- spa-rv1909.usfx.xml` (cómo bajar ese archivo
  en el comentario de `scripts/build-biblia.mjs`). Sale un JSON por libro
  (`{ v, libro, nombre, caps: [[v1, v2…], …] }`) e `indice.json` (fuente,
  versículos por capítulo, versículos vacíos). Si se regenera, subir
  `VER_DATOS` en `js/biblia-texto.js`.
- **Archivos**: `js/biblia-texto.js` (UMD: ortografía actual, citas,
  capítulo vecino, link a otra versión, búsqueda), `js/biblia-lector.js`
  (pantalla), `css/biblia.css` (`.bbl-`). La tarjeta "Leer la Biblia /
  Seguir leyendo" está en `js/biblia.js`.
- **Sin internet**: caché `manolo-biblia` (página y service worker la usan
  igual). "Descargar la Biblia" baja los 66 de a 3; "Quitar la descarga"
  borra la caché (los versículos anotados y lo leído no se tocan).
- **Lector**: pantalla completa (z 850; las hojas van encima), atrás del
  iPhone lo cierra (`history.pushState`), Escape y ← → en la compu.
  Salmos, Proverbios, Job, Eclesiastés, Cantares y Lamentaciones: un
  versículo por línea.
- **Pruebas**: `tests/biblia-texto.test.js` (66 libros, 1.189 capítulos,
  31.102 versículos, citas del formulario, ortografía, búsqueda) y
  `SOLO=biblia node scripts/e2e/lectura.js` (64 comprobaciones a 390 y
  1280 px: abrir, elegir, letra, ortografía, leído, deslizar, seguir donde
  quedé, atrás, descargar, sin internet).

## Fase 2: tocar versículos, anotar, buscar y compartir (D-105)

- **Archivos**: `js/biblia-marcas.js` (UMD: claves, qué pintar, cambios a
  guardar, lista "Marcados"), `js/biblia-imagen.js` (UMD: plan y dibujo de
  la imagen), `js/biblia-seleccion.js` (barra, nota, compartir, copiar,
  anotar, pestaña Marcados), `js/biblia-buscar.js` (hoja de búsqueda) y
  `js/biblia-buscar-worker.js` (Worker, en `EXTRAS` del service worker).
- **Lector**: avisa `biblia:pintado` ({ libro, cap, marcar }) después de
  pintar un capítulo y `biblia:lector-cerrado`; `BibliaLector.lugar()`,
  `datos()` y `el` para los módulos de arriba.
- **Formulario** (`js/biblia.js`): `BibliaAnotar.abrir(pre)`, campo
  "Versión del texto", texto automático (`textoAuto`) y "📖 Leer en la
  Biblia".
- **Pruebas**: `tests/biblia-marcas.test.js` (claves, parches, lista,
  imagen), `tests/biblia-texto.test.js` (búsqueda por comienzo de palabra,
  frase primero, resaltado) y `SOLO=marcas node scripts/e2e/lectura.js`
  (65 comprobaciones a 390 y 1280 px).

## Fase 3: planes, progreso, memorizar, temas y racha (D-106)

- **Archivos**: `js/biblia-planes.js` (UMD: tipos de plan, calendario,
  estado de hoy, ponerse al día, mover, progreso de los 66 libros),
  `js/biblia-memoria.js` (UMD: cajas, repaso, primeras letras, ocultar,
  comparar lo escrito), `js/biblia-plan-ui.js` (tarjetas de hoy, página
  `#biblia-planes`, aviso en el lector), `js/biblia-memoria-ui.js` (tarjeta
  de repaso, página `#biblia-memorizar`, hoja de práctica) y
  `js/biblia-progreso-ui.js` (página `#biblia-progreso`). Las tres páginas
  son sub-paneles de Biblia (`SUB_PANELS` en `js/modules.js`, sin el
  versículo de arriba).
- **Pantalla**: se mantuvieron las pestañas Lista · Calendario · Marcados
  (el diseño de la fase 0 proponía cuatro pestañas; no entraban bien en
  320 px). Arriba: racha, tarjetas de los planes, "Leer la Biblia",
  repaso de memoria, "Anotar versículo" y los accesos Planes · Progreso ·
  Memorizar. Abajo: ⚙ Ajustes y Exportar.
- **Eventos**: `biblia:planes` y `biblia:memoria` (cambió algo); Biblia,
  "Mi día" y el lector repintan. `BibliaLector.guardar(campos)` guarda
  ajustes de Biblia (`favArriba`) y `BibliaLector.leidosEstado()` dice si
  los capítulos leídos ya vinieron del servidor (para Hábitos).
- **Racha**: `BibliaMotor.racha(lista, hoy, fechasLeidas)` y
  `calendario(…, fechasLeidas)`; Biblia manda a Hábitos (`manolo:fuente`)
  los versículos y un `{ fecha, leido: true }` por día con capítulos
  leídos. "Mi día" los filtra y usa la lectura del plan que falta.
- **Ponerse al día**: la parte de lo atrasado que toca cada día
  (`extraHoy`) se calcula con lo que faltaba al empezar ese día.
- **Versículo de arriba**: `js/verses.js` lee los favoritos guardados en el
  teléfono por `js/biblia-seleccion.js` (solo si está activado).
- **Exportar (JSON)** suma `planes` y `memorizar`.
- **Pruebas**: `tests/biblia-planes.test.js` (calendarios, hoy, atrasado,
  ponerse al día, mover, Proverbios, progreso, orden),
  `tests/biblia-memoria.test.js` (cajas, letras, ocultar, comparar),
  `tests/biblia-motor.test.js` (temas, racha y calendario con lo leído),
  `tests/mi-dia.test.js` y `SOLO=planes` / `SOLO=memoria node
  scripts/e2e/lectura.js` (a 390 y 1280 px, y Biblia y Planes a 320 px).

## Fase 4: Libros — Leer ahora, velocidad, estados y formatos (D-107)

- **Archivos**: `js/libros-sesiones.js` (UMD: cronómetro por marcas de
  tiempo, cerrar la sesión, velocidad, tiempo que falta, minutos por día y
  lo que va a Hábitos), `js/libros-sesion.js` (pantalla: hoja "Leer ahora",
  pantalla encendida, resumen, bloque de la ficha, Dejar / Retomar / Leer
  de nuevo y los campos de avance que también usa "Anotar página").
  `js/libros-progreso.js` mide el avance con `medida(libro)`: páginas o %
  (audiolibro), y cuenta todas las lecturas (`lecturasDe`,
  `terminaciones`). `js/libros-motor.js`: estado Abandonado, `FORMATOS`,
  duración ("10:30").
- **Cronómetro**: `localStorage manolo.libros.sesion` = `{ v, libroId,
  uid, ini, acumulado, corre, desde, unidad }`. El reloj se pinta cada
  segundo solo con la app a la vista; al terminar se pausa mientras
  anotas ("Volver" lo sigue).
- **Guardar**: un solo `update` con el avance de hoy y
  `sesiones.{id}`; el resumen muestra páginas, minutos, páginas por hora,
  el tiempo que falta y "lo terminas el …".
- **Releer**: `nuevaLectura` guarda la lectura de ahora en `lecturas.N` y
  pone la nueva desde 0 (los campos de arriba siempre son la lectura de
  ahora: así el resto de la app no cambia).
- **Eventos**: `libros:sesion` (empezó, pausa, terminó: "Sigue leyendo" y
  la ficha repintan) y `libros:datos` (llegaron los libros).
  `window.LibrosDatos` = `{ uno, listo, metaDia, festejo }`.
- **Pruebas**: `tests/libros-sesiones.test.js`, más casos en
  `tests/libros-progreso.test.js` (audiolibro, releer, abandonar),
  `tests/libros-motor.test.js` y `tests/habitos-auto.test.js`;
  `SOLO=sesion node scripts/e2e/lectura.js` (reloj con hora falsa, pausa,
  pantalla encendida, guardar, velocidad, dejar y retomar, releer,
  audiolibro, descartar; a 390, 1280 y 320 px).

## Fase 5: Libros, por partes

### 5a. "¿Qué leo después?", sagas, prioridad y notas (D-108)
- **Archivos**: `js/libros-siguiente.js` (UMD: `siguientes`,
  `ritmoDiario`), `js/libros-siguiente-ui.js` (sección y lista completa),
  `js/libros-notas.js` (notas en la ficha y su hoja). En
  `js/libros-motor.js`: `PRIORIDADES`, `TIPOS_NOTA`, `validarNota`,
  `notasDe` y saga/prioridad en `validarLibro`.
- `window.LibrosDatos` suma `lista`, `metaAnio` y `tapa` (la portada de
  siempre). La sección se repinta con `libros:datos`.
- **Pruebas**: `tests/libros-siguiente.test.js` (prioridad, saga, géneros,
  largo, reto, tiempo en la lista) y `SOLO=siguiente node
  scripts/e2e/lectura.js` (orden y razones, prioridad, Empezar, saga, notas;
  a 390, 1280 y 320 px).

### 5b. Frases: favoritas, etiquetas, compartir y repaso (D-109)
- **Archivos**: `js/libros-frases.js` (UMD: `paraHoy`, `calificar`,
  `etiquetasUsadas`, `filtrar`), `js/libros-frases-ui.js` (tarjeta "Frases
  de hoy", hoja del repaso, compartir). En `js/libros-motor.js`:
  `etiquetasOk` y `fav`/`etiquetas` en `validarFrase`. `js/biblia-imagen.js`
  acepta título y pie.
- `window.LibrosDatos` suma `frases` y `frasesDia`; las frases también
  avisan `libros:datos`.
- **Pruebas**: `tests/libros-frases.test.js` y `SOLO=frases node
  scripts/e2e/lectura.js` (repaso completo, favorita, compartir, frases por
  día, etiquetas y filtros; a 390, 1280 y 320 px).

### 5c. Importar de Goodreads, StoryGraph y Kindle (D-110)
- **Archivos**: `js/libros-importar.js` (UMD: `csv`, `detectar`, `libros`,
  `libroDeFila`, `clippings`, `kindle`, `claveLibro`, `sagaDelTitulo`) y
  `js/libros-importar-ui.js` (elegir archivo, vista previa, guardar en
  lotes). `normalizarLibro` suma `isbn`.
- **Pruebas**: `tests/libros-importar.test.js` (CSV con comillas y saltos
  de línea, Goodreads, StoryGraph, Kindle en español e inglés, duplicados)
  y `SOLO=importar node scripts/e2e/lectura.js` (los tres formatos y un
  archivo que no es; a 390, 1280 y 320 px).

### 5d. Escanear el código de barras (ISBN) (D-111)
- **Archivos**: `js/libros-isbn.js` (UMD sin DOM: `leerImagen`,
  `leerFila`, `modulos`, `ean13Valido`, `esIsbn13`, `isbn10a13`,
  `digitoControl`; se carga al tocar Escanear y está en los EXTRAS del
  service worker) y `js/libros-escaner.js` (hoja: sacar foto, elegir foto,
  cámara en vivo; avisa con el evento `libros:isbn`). En `libros.js`: el
  botón, el campo oculto `isbn`, la búsqueda del ISBN y la fila «ISBN» en
  la ficha. `validarLibro` guarda `isbn` solo si viene.
- **Pruebas**: `tests/libros-isbn.test.js` (control, ISBN-10 → 13, filas,
  fotos dibujadas con desenfoque, ruido, poco contraste, sombra, reflejo,
  perspectiva, giros, de costado, diagonal, foto grande, precio EAN-5,
  margen chico, zona; y que no invente: ruido, control malo, barras al
  azar) y `SOLO=isbn node scripts/e2e/lectura.js` (foto JPEG girada y
  borrosa → busca y guarda; código que no es de libro; foto sin código;
  sin permiso de cámara; cámara en vivo simulada; se apaga al cerrar; a
  390, 1280 y 320 px).
- **Pendiente de probar en el iPhone de verdad**: la foto debería ser
  confiable; la cámara en vivo depende de que el iPhone enfoque de cerca.

### 5e. Estadísticas nuevas y "Tu año en libros" (D-112)
- **Archivos**: `js/libros-estadisticas.js` (UMD: `porDia`, `nivel`,
  `delDia`, `calendario`, `tiempo`, `velocidad`, `autores`, `generos`,
  `anio`, `anioParaMostrar`, `aniosConLibros`, `duracion`) y
  `js/libros-estadisticas-ui.js` (secciones de Estadísticas, tarjeta
  `#lib-anio`, hoja `lanio-hoja` e imagen para compartir). En `libros.js`:
  los huecos `data-lest`, `#lib-anio` y `LibrosDatos.grafico`/`ver`.
- **Pruebas**: `tests/libros-estadisticas.test.js` (días con páginas, % y
  minutos; niveles; calendario; tiempo y estimado; velocidad y tendencia;
  autores con releídos; el año completo; cuándo aparece) y `SOLO=stats node
  scripts/e2e/lectura.js` (calendario y ‹ ›, tocar un día y una barra,
  tiempo, velocidad, autores, la hoja del año y ‹ 2025, compartir, tocar una
  tapa, la tarjeta el 20 de diciembre y el 10 de enero y no en febrero; a
  390, 1280 y 320 px).
- **Fase 5 completa** (5a a 5e).
