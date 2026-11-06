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
| 2 | Biblia: anotar desde el lector y texto automático, resaltados, notas, favoritos, búsqueda y compartir | |
| 3 | Biblia: planes, progreso de capítulos, memorización, temas y racha nueva | |
| 4 | Libros: "Leer ahora", velocidad y estimaciones, estados y formatos nuevos | |
| 5 | Libros: escanear ISBN, importar, frases (repaso, etiquetas, compartir), notas, "¿Qué leo después?" y estadísticas | |
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
| `meta/biblia_marcas` | `m: { "John.3.16": { color, nota, fav, texto, fecha } }` |
| `meta/biblia_planes` | planes de lectura (tipo, inicio, ritmo, ajustes) |
| `meta/biblia_memoria` | versículos a memorizar con su caja (Leitner) y próximo repaso |
| `biblia/{id}` + `temas`, `version` | etiquetas del versículo anotado; versión del texto |
| `libros/{id}` + `sesiones`, `formato`, `lecturas`, `notas`, `saga`, `prioridad` | sesiones de lectura, relecturas, notas |
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
