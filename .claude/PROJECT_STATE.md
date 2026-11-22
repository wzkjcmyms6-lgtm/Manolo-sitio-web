# Estado del proyecto

Actualizado: 2026-11-22 (Ropa con IA e inspiración de Pinterest: plan, D-145).

- **Ropa con IA e inspiración de Pinterest (2026-11-22, en curso)**: el
  ropero del dueño con fotos; una IA (el mejor modelo de Claude, por un
  puente en Cloudflare con tope de gasto) describe cada prenda, arma con su
  ropa los looks de sus pines de Pinterest, propone qué ponerse cada día y
  qué comprar según lo que se repite en sus pines. Plan, prueba de Pinterest
  (el tablero público se lee por RSS) y diseño en `docs/ROPA.md` (D-145);
  fases en `.claude/CURRENT_PHASE.md`. Falta del dueño: un tablero público
  en Pinterest y su usuario (fase 0); las cuentas de Claude y Cloudflare
  (fase 2).

- **Tu semana, Tu año y Bici al nivel de Running (2026-11-16, terminado)**:
  "Tu semana" (cada lunes en Inicio: cifras de todas tus áreas, lo mejor, lo
  que se quedó atrás y una sugerencia), "Tu año en Manolo" (diapositivas
  con todo tu año, para compartir sin montos de dinero) y Bici con las
  mismas pantallas que Running (tarjetas con mapa, progreso, récords de
  bici, Eddington, tus bicis y mantenimiento). Plan en `docs/RESUMENES.md`
  y `docs/CYCLING.md` (D-136); fases en `.claude/CURRENT_PHASE.md`.
  Fase 1 hecha (D-137): el motor de resúmenes (las 10 secciones, la semana
  contra la anterior y tu promedio, lo mejor, lo que se quedó atrás y una
  sugerencia), sin lecturas nuevas. Fase 2 hecha (D-138): **"Tu semana"**
  (tarjeta en Inicio lunes y martes, pantalla `#semana` con semanas
  anteriores y "Compartir mi semana" sin dinero). Fase 3 hecha (D-139): el
  contenido de "Tu año" (cada sección, récords, mejor mes, contra el año
  anterior). Fase 4 hecha (D-140): **"Tu año en Manolo"** en diapositivas
  (menú ☰, pie de Inicio y tarjeta en diciembre y enero; compartir cada
  una y el año sin dinero). Bici fase 5 hecha (D-141): **Actividades**
  con barra propia, tarjetas con velocidad, mapa y récords de bici, filtros
  y el detalle contra tus rodadas. Fase 6 hecha (D-142): **Progreso** de
  Bici (récords, Eddington, metas, mapa de calor; los récords de las rodadas
  viejas se calculan una vez con su ruta). Fase 7 hecha (D-143): **tus
  bicis** con su **mantenimiento** y **segmentos de bici**. Control final
  (D-144): 759 pruebas, 39 de 40 grupos de pantalla bien (la Biblia, por
  el entorno) y Lighthouse 100 en accesibilidad.

- **Libros nivel 3 (2026-11-16, terminado)**: que al poner un libro se
  traigan bien el título en español, el autor, el género y las páginas de
  tu edición; ficha del autor, temas, completar la biblioteca y
  recomendaciones. Plan y auditoría con 20 libros reales en
  `docs/LIBROS_NIVEL3.md` (D-128); fases en `.claude/CURRENT_PHASE.md`.
  Fase 1 hecha (D-129): "Buscar el libro" trae el título en español, el
  libro de verdad primero, sin repetidos, el autor bien escrito y busca
  por autor (`js/libros-fuentes.js`). Fase 2 hecha (D-130): **las páginas
  de tu edición** (ediciones en español agrupadas, la recomendada, el ISBN
  exacto) y "¿Para cuándo lo quieres terminar?" con páginas por día.
  Fase 3 hecha (D-131): **ficha del autor** (tocar el autor: quién es en
  español, tus libros de él y sus libros más leídos con "＋ Quiero leer").
  Fase 4 hecha (D-132): **temas en español** (tocar uno filtra la lista) y
  **"De qué trata"** (Wikipedia, Open Library o Google Books, con fuente).
  Fase 5 hecha (D-133): **"Completar mi biblioteca"** (propone lo que les
  falta a tus libros, páginas incluidas, siempre con tu OK). Fase 6 hecha
  (D-134): **"Si te gustó…"** (ideas del mismo autor y de los mismos temas
  que tus libros de 4 y 5 estrellas) y "¿Qué leo después?" con lo que te
  gustó. Fase 7 hecha (D-135): control final (732 pruebas, 38 de pantalla,
  Lighthouse 100 en accesibilidad y en buenas prácticas en las 12 pantallas); lista para el iPhone en `docs/TESTING.md`.

- **Mejoras sin servidor (2026-11-15, terminado)**: fase 1 hecha (D-123):
  **Biblia en audio** en el lector, con las voces del iPhone (sin
  internet): resalta el versículo, velocidad y voz, sigue con el siguiente
  capítulo y lo marca como leído si lo oíste completo. Fase 2 hecha
  (D-124): **rutinas de Running desde la app** ("＋ Nueva", series que se
  repiten, menú ⋯ con Editar, Duplicar, Hacer la siguiente y Eliminar).
  Fase 3 hecha (D-125): al terminar un entreno, **guardar en la rutina** lo
  que cambiaste (eligiendo qué; los pesos no cambian), un entreno libre
  como rutina nueva y el editor pregunta antes de perder cambios. Fase 4
  hecha (D-126): **modo claro** (Inicio o menú ☰ › Apariencia: automático,
  claro u oscuro); `css/tema-claro.css` se genera con `npm run tema` a
  partir de los estilos de siempre (el oscuro no cambia). Fase 5 hecha
  (D-127): **la app abre más rápido**: los módulos van en
  `js/app.paquete.js` y los estilos en `css/app.paquete.css` (14 pedidos
  al abrir en vez de 198); tras cambiar un .js o .css: `npm run listo`.
  Control final hecho: 702 pruebas, las 37 suites y Lighthouse 100 / 100
  en las pantallas nuevas (claro y oscuro). Queda del dueño: las listas del
  iPhone en `docs/TESTING.md`.

- **Ajustes del dueño (2026-11-15)**: pago mínimo por tarjeta con aviso
  (D-121); "Leí en mi Biblia" para marcar lo leído en papel con un toque
  (D-122); en el iPhone, lo fijo vuelve a su lugar si la pantalla queda
  corrida y todos los campos con letra de 16 px (D-120).

- **Finanzas, Lugares y copia de seguridad (2026-11-15, terminado)**: Tarea
  1 hecha (D-116): el disponible por día sale de los ingresos registrados
  (no del presupuesto, que queda como meta), con estados, ⓘ y estado vacío;
  en Resumen, Presupuesto, Información y "Mi día" (`docs/FINANZAS.md`).
  Tarea 2 hecha (D-117): **Lugares** en Inicio (visitados y quiero ir,
  platos, visitas, fotos en el teléfono con miniatura en la nube, buscar,
  filtros, ¿Dónde como hoy?, estadísticas, gasto a Finanzas si confirmas;
  `docs/LUGARES.md`). Tarea 3 hecha (D-118): **Copia de seguridad de
  todo** (Inicio abajo y menú ☰): un archivo con las 21 colecciones y las
  fotos de Lugares; restaurar revisa el archivo, guarda una copia
  automática y solo agrega lo que falta, con Deshacer (`docs/RESPALDO.md`).
  QA final hecho (D-119): Lighthouse 97–100 / 100, prueba sin internet,
  menú cerrado fuera del foco y zoom libre al escribir.

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin compilar (los módulos se juntan en un paquete con
  `npm run listo`, D-127). Ver `docs/ARCHITECTURE.md`.
- **Se preserva**: Hábitos, Ejercicio, Finanzas, Inversiones, offline.
- **Fase 1**: contraseña numérica, nota de hábitos, accesos + campana admin.
  Pendiente del dueño: `admins/{uid}` + publicar `firestore.rules`.
- **Fases 2–6**: Running (GPS, rutinas CSV con avisos) y Bicicleta (GPS),
  historial con progreso, marcas y gráficos.
- **Fase 7**: mediciones, ahorros de batería, liberar mapas, gráficos con
  escala mínima, ancho máximo en escritorio, revisión de seguridad.
- **Fase 8**: QA final. Regresión en teléfono y computadora con acciones
  de siempre; simulador de Firestore completado; lista de pruebas para el
  iPhone en `docs/TESTING.md`. Sin cambios en la app.
- **Después (pedido del dueño)**: GPS retirado (D-033); resumen semanal
  tipo Strava en Running y Bici (D-035); rutinas CSV de varios días en una
  cola, la completada pasa al final (D-034, D-036); km opcionales (D-037).
  Ver `docs/RUNNING.md`, `docs/CYCLING.md`, `docs/CSV_ROUTINES.md`.
  Deslizar hacia abajo para cerrar todas las hojas (D-038,
  `js/hoja-deslizar.js`).
- **Hábito Scalping** (2026-10-21): plan de 180 días, módulo del dueño
  `js/scalping-habit.js` (no tocar) + pantallas `js/habito-scalping.js`;
  integrado al motor como Medible de 2 sesiones (D-039 a D-041,
  `docs/SCALPING.md`). Desde 2026-10-23 el día avanza solo con días
  completos (`js/scalping-avance.js`, D-042).
- **Falta la prueba real en el iPhone**: pantalla encendida, voz y pitidos
  de las rutinas guiadas, teclado numérico.
- **Tests**: 221/221 (`npm test`); E2E `fase1` (39), `running` (64),
  `hojas` (21), `scalping` (75), `emojis` (10), `regresion` (39) en verde.
- **Después (2026-10-28 a 2026-10-30)**: Inversiones aparte, Libros más
  inteligente, Biblia, Movilidad, Medir tiempos (provisoria), tarjetas de
  crédito (D-052 a D-059).
- **Running al nivel de Strava (2026-11-04, fases 0–8 hechas)**: importar
  GPX/TCX/FIT/ZIP (también el export de Strava), motor de métricas,
  detalle con mapa y gráfico, feed de tarjetas con barra propia, Progreso
  y Ajustes, resumen inteligente y mismo recorrido, segmentos, mapa de
  calor, compartir imagen y exportar todo. Sin GPS en vivo (D-033 sigue).
  D-060 a D-077, diseño en `docs/RUNNING.md`. Falta: validar con el export
  real del dueño y su OK para publicar en el Feed.
- **Hábitos: categorías y siguiente nivel (2026-11-05, fases 0–8 hechas)**:
  categorías completas en `meta/habitos_juego.categorias` (migración en
  lectura), Temporada 2 (subir cuesta más), Hoy filtrado y agrupado,
  página por categoría y Estadísticas por categoría, se marca solo con
  Running, Bici, Movilidad, Libros, Biblia y Finanzas, plantillas, hora y
  aviso de pendientes. D-079 a D-087, todo en `docs/HABITOS.md`. Fe, Lectura,
  Cuidado personal y Hogar vienen de fábrica (D-088); sin recordatorios
  fuera de Manolo por ahora. Falta: la lista del iPhone (`docs/TESTING.md`).
- **Ejercicio inteligente (2026-11-05, terminado, fases 0–8)**: ficha con demo,
  entreno que dice qué peso usar y por qué, progresión v2, estancamiento y
  descarga, volumen y equilibrio, generador, recuperación y "¿Qué entreno
  hoy?" con Running. Plan y auditoría en `docs/EJERCICIO_INTELIGENTE.md`,
  D-090 en adelante.
- **Rutinas listas (2026-11-08)**: "Rutina en casa — Glúteo & Full Body"
  en Entrenamiento (días A/B/C, series para marcar, guardar en el
  historial con sus músculos, progresión y consejos). D-104,
  `docs/RUTINAS_LISTAS.md`.
- **Libros, Biblia y Medir tiempos: siguiente nivel (2026-11-06 a 2026-11-15, terminado, fases 0–8)**:
  plan y auditoría en `docs/LECTURA_NIVEL2.md`, D-102 en adelante. Fase 1
  hecha: la Biblia RV1909 se lee dentro de Manolo (lector, ortografía
  actual, leído, descarga sin internet). Fase 2 hecha (D-105): resaltar,
  favoritos, notas, anotar con texto automático, buscar (Worker),
  compartir imagen y pestaña "Marcados". Fase 3 hecha (D-106): planes de
  lectura (ponerse al día, mover), progreso de los 66 libros, memorizar
  (cajas, 3 formas de practicar), temas con filtro, racha con capítulos
  leídos ("Mi día" y Hábitos) y favoritos en el versículo de arriba.
  Fase 4 hecha (D-107): "Leer ahora" (cronómetro, sesiones, velocidad y
  tiempo que falta), Abandonado y Retomar, "Leer de nuevo" (lecturas
  anteriores) y audiolibros (por tiempo o %). Fase 5 hecha:
  "¿Qué leo después?", sagas, prioridad y notas (D-108); repaso de frases,
  favoritas, etiquetas y compartir (D-109); importar de Goodreads,
  StoryGraph y Kindle (D-110); escanear el código de barras con lector
  propio (D-111); calendario de días leídos, tiempo, velocidad y su
  tendencia, autores y "Tu año en libros" (D-112). Fase 6 hecha (D-113):
  Medir tiempos definitiva, tus actividades, ⏱ Medir, "Mi mañana" guiada y
  se llena sola con Running, Ejercicio y Libros. Fase 7 hecha (D-114): plan
  de la mañana, estadísticas, línea base y experimentos; "Mi día" (tu
  mañana, el libro que lees, el repaso; máximo 5 filas) y Hábitos (fuente
  "Medir tiempos"). Fase 8 hecha (D-115): QA final (regresión de todo
  Manolo, prueba de datos intactos, rendimiento con muchos datos, 320 px;
  más rápido con miles de frases y años de tiempos; los respaldos llevan
  todo lo nuevo) y lista final para el iPhone. Falta: que el dueño haga
  esa lista (`docs/TESTING.md`) y su OK para el pitido o la voz en «Mi
  mañana».
- **Reconocer ejercicios (2026-11-06)**: motor nuevo de búsqueda y
  reconocimiento (331/331 nombres reales, antes 79 %), alias extra y
  «¿Es …?» en no reconocidos (D-101, `js/exercise-search.js`,
  `js/ejercicios-alias.js`).
- **Mi día (2026-11-05)**: tarjeta arriba de Inicio con entrenar, hábitos,
  Biblia, para gastar hoy y Running; se oculta y se vuelve a mostrar
  (D-100, `js/mi-dia.js`, `js/mi-dia-motor.js`).
- **Tests (2026-11-05)**: 480 unitarias; E2E de Ejercicio: `ejercicio`
  (ficha, demos, entreno en vivo, progresión, descarga, volumen,
  generador, "¿Qué entreno hoy?", Perfil y compartir, a 390 y 1280 px); E2E de Running: `run-importar`,
  `run-detalle`, `run-feed`, `run-progreso`, `run-inteligencia`,
  `run-segmentos`, `run-compartir`, `run-qa`; de Hábitos: `habitos` (205,
  a 390 y 1280 px); además de las de siempre (todas en verde el 2026-11-05).
