# Fase actual

## Ropa, nivel 2: tu estilista con IA (pedido del dueño, 2026-11-24)
"Que la IA sea mi estilista: hablar con ella, armar mis outfits yo y que opine
de mi ropero con su propio criterio." Pedido completo, auditoría, diseño,
datos, puente y costos en `docs/ROPA_ESTILISTA.md` (D-155).

| Fase | Qué | Estado |
|---|---|---|
| 0 | Diseño: cómo se ve (maquetas) y cuánto costaría al mes | ✅ (D-155) |
| 1 | Armar mis outfits yo (sin IA) y ver cada outfit en grande | ✅ (D-156): "Armar el mío", los avisos, cambiar una prenda, editar y duplicar; ver en grande opciones, guardados y días |
| 2 | El puente aprende a conversar y a opinar (`/charla`, `/opinar`, `/opinion`, versión 5), desplegado | ✅ (D-157): las tres rutas con su caché, sus esquemas y su limpieza; instalado; `RopaIA.estilista()`, `charla`, `opinar`, `opinion` en la app (sin pantalla todavía) |
| 3 | Hablar con mi estilista: la pantalla, las conversaciones, lo que recuerda de ti, "Pídelo con tus palabras" | ✅ (D-158): `#ropa-estilista` (conversar, cada outfit con sus botones, "A mi lista", "Lo recordé"), tus conversaciones, lo que recuerda de ti (también en Ajustes de Ropa) y "Pídelo con tus palabras" en Outfits |
| + | Pregunta del dueño: "¿Por qué no recuerda los outfits que me hizo para el día?" | ✅ (D-159): sigue la conversación de hoy; los outfits de antes con su nombre y lo que viste hoy (puente 6); Outfits guarda las opciones de cada día y ocasión |
| 4 | Lo que opina mi estilista de mi ropero (en Compras) y "¿Qué opinas?" de mis outfits | ✅ (D-160): el repaso en Compras (los números de Manolo, lo que sumaría, qué no comprar, qué dejar, colores, consejos; `ropa_opiniones`) y "¿Qué opinas?" en Armar el mío, guardados y opciones ("Cambiar" en un toque) |
| 5 | Conectarlo con Outfits y Compras (y con Inicio, si tiene sentido) | ✅ (D-161): el aviso del día en Outfits (sin IA, con la ✕), "Hoy te armó…" con el link a esa conversación, "Para mañana" en la conversación, los cruces en Compras (también lo sugiere, en N de tus pines, te lo sugirió) e Inicio (lo que te armó hoy o "¿Qué me pongo hoy?") |
| 6 | Revisión final y la prueba real corta con el OK del dueño | ✅ la revisión (D-162): todas las pruebas, Lighthouse 100 en las 26 pantallas nuevas (2 detalles de accesibilidad arreglados), los latidos para que el iPhone no corte la espera (puente versión 7, instalado) y la guía de la prueba real · ⏳ la prueba real corta: la hace el dueño en el iPhone (`docs/ROPA_ESTILISTA.md` › "La prueba real de tu estilista") |

## Ropa con IA e inspiración de Pinterest (pedido del dueño, 2026-11-22)
"Una sección nueva, Ropa, donde guardo toda mi ropa con fotos. Una IA
describe cada prenda, toma mis inspiraciones de Pinterest y arma esos looks
con mi ropa, y me sugiere qué comprar." Pedido completo, auditoría, prueba
de Pinterest y diseño en `docs/ROPA.md` (D-145).

| Fase | Qué | Estado |
|---|---|---|
| 0 | Diseño y prueba de Pinterest | ✅ (D-145) |
| 1 | Mi ropa sin IA: agregar con fotos, datos a mano, color de la foto, ropero con filtros, ficha, para lavar, ya no la tengo, copia de seguridad | ✅ (D-146) |
| 2 | La IA describe: cuentas con el dueño, el puente, describir al agregar y las que ya tienes, gasto y tope | ✅ (D-147); el puente, instalado en el Cloudflare del dueño el 2026-11-24 (D-153) |
| 3 | Inspiración de Pinterest: subir imagen o link, leer el tablero, prendas de cada pin, armar el look con tu ropa, tu estilo | ✅ en el código (D-148); Pinterest y la IA se encienden al instalar el puente |
| 4 | Outfits: qué me pongo hoy, me lo pongo, guardar, no me gusta, con qué combino esto, calendario | ✅ (D-149): con el clima de cualquier ciudad; con reglas ya, con la IA al instalar el puente |
| 5 | Compras desde Pinterest: qué te falta, outfits nuevos, ver opciones en Pinterest, qué no comprar, lista de deseos, presupuesto | ✅ (D-150): sin IA (con lo que la IA ya vio en tus pines) |
| 6 | Extras: lo más y lo menos usado, colores, costo por uso, Tu semana, Tu año, Inicio | ✅ (D-151): "Tus números", lo de hoy en Inicio y Ropa en "Tu semana" y "Tu año" |
| 7 | Revisión final y lista para el iPhone | ✅ (D-152): todas las pruebas, Lighthouse, la IA sin internet y la lista para el iPhone; la prueba real de la IA, del dueño (el puente ya está) |
| + | Pedido del dueño (2026-11-24): el corte y las mangas, cambiar los colores, mayúsculas | ✅ (D-154): la IA también llena el corte y las mangas (puente versión 4) |
| + | Pedido del dueño (2026-11-25): "Que en outfits haya un espacio de outfits favoritos" | ✅ (D-163): el corazón (opciones, tu estilista, en grande, guardados, días, Armar el mío) y "Tus favoritos" en Outfits |

## Tu semana, Tu año y Bici al nivel de Running (pedido del dueño, 2026-11-16) — terminado
"Haz el 1, 2 y 4, desarróllalos de la manera más completa posible."
Diseño en `docs/RESUMENES.md` (Tu semana y Tu año) y `docs/CYCLING.md`
(Bici), D-136.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría y diseño | ✅ (D-136) |
| 1 | Motor de resúmenes: tus datos de todas las secciones para cualquier semana o año (sin pantalla) | ✅ (D-137) |
| 2 | "Tu semana": tarjeta en Inicio los lunes, pantalla con semanas anteriores, lo mejor, lo que se quedó atrás, una sugerencia, compartir | ✅ (D-138) |
| 3 | "Tu año": el contenido (cada sección, récords, mejor mes, rachas, contra el año anterior) | ✅ (D-139) |
| 4 | "Tu año": las diapositivas a pantalla completa, compartir cada una, tarjeta en Inicio en diciembre y enero, años anteriores | ✅ (D-140) |
| 5 | Bici: Actividades (barra propia, tarjetas con mapa, filtros, "+", Inicio, detalle con lo de bici) | ✅ (D-141) |
| 6 | Bici: Progreso (períodos, calendario, récords de bici, Eddington, metas, racha, mapa de calor) | ✅ (D-142) |
| 7 | Bici: tus bicis y mantenimiento, segmentos de bici | ✅ (D-143) |
| 8 | Control final y lista para el iPhone | ✅ (D-144) |

## Libros nivel 3: datos de verdad de cada libro (pedido del dueño, 2026-11-16) — terminado
"Si pongo un libro, que traiga el autor, el género y las páginas (los
libros tienen distintas páginas). Hazlo mucho mejor." Plan, auditoría con
20 libros reales y diseño en `docs/LIBROS_NIVEL3.md` (D-128).

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría con 20 libros reales y plan | ✅ (D-128) |
| 1 | Buscar bien: título en español, autor correcto, el libro de verdad primero; buscar por autor | ✅ (D-129) |
| 2 | Las páginas de tu edición (elegir edición, recomendada, ISBN exacto) y páginas por día | ✅ (D-130) |
| 3 | Ficha del autor: quién es, tus libros de él y sus otros libros | ✅ (D-131) |
| 4 | Género y temas en español, "De qué trata", estadísticas por género | ✅ (D-132) |
| 5 | Completar tu biblioteca (con tu OK) | ✅ (D-133) |
| 6 | Recomendaciones: "Si te gustó…" | ✅ (D-134) |
| 7 | Control final y lista para el iPhone | ✅ (D-135) |

## Mejoras sin servidor (pedido del dueño, 2026-11-15)
El dueño eligió: app más rápida, rutinas desde la app (Running y gimnasio)
y "más grandes" sin servidor (modo claro, Biblia en audio). Notificaciones
con la app cerrada y Strava automático quedan para después ("Ahora no").

| Fase | Qué | Estado |
|---|---|---|
| 1 | Biblia en audio (voces del iPhone) | ✅ (D-123) |
| 2 | Rutinas de Running: crear y editar en la app (sin CSV) | ✅ (D-124) |
| 3 | Rutinas del gimnasio: guardar lo cambiado al entrenar, entreno libre como rutina, aviso al cerrar el editor | ✅ (D-125) |
| 4 | Modo claro (automático o elegido) | ✅ (D-126) |
| 5 | Que la app abra más rápido | ✅ (D-127) |
| 6 | Control final y entrega | ✅ |

**Plan terminado (2026-11-16).** Control final: 702 pruebas, las 37 suites
en verde y Lighthouse 100 / 100 en las pantallas nuevas (claro y oscuro).
Queda del dueño: probar en el iPhone las listas «Biblia en audio»,
«Rutinas de Running desde la app», «Rutinas del gimnasio», «Modo claro» y
«La app abre más rápido» de `docs/TESTING.md`. Para después (necesitan un
servidor): avisos con la app cerrada y Strava automático.

## Ajustes del dueño (2026-11-15, después de probar en el iPhone)
| Qué | Estado |
|---|---|
| Fallas de pantalla de las capturas (barra flotando, campos de hora, nombres largos) | ✅ (D-120) |
| Tarjetas: pago mínimo por tarjeta | ✅ (D-121) |
| Biblia: marcar lo leído en papel, más sencillo | ✅ (D-122) |

Queda del dueño: probar en el iPhone la lista «Pago mínimo, Biblia en
papel y arreglos» de `docs/TESTING.md`.

## Finanzas (disponible diario), Lugares y copia de seguridad (pedido del dueño, 2026-11-15)
Plan aprobado por el dueño ("OK" a las tres recomendaciones: fotos en el
teléfono con miniatura en la nube; copia de seguridad de todo como Tarea 3;
la fórmula del disponible tal cual). Decisiones desde D-116.

| Tarea | Qué | Estado |
|---|---|---|
| 1 | Finanzas: disponible por día según ingresos reales (`docs/FINANZAS.md`) | ✅ (D-116) |
| 2 | Lugares: sección nueva para calificar sitios (`docs/LUGARES.md`) | ✅ (D-117) |
| 3 | Copia de seguridad de todo Manolo (`docs/RESPALDO.md`) | ✅ (D-118) |
| QA | Pruebas, 375 px, Lighthouse, sin internet, datos intactos | ✅ (D-119) |

**Plan terminado (2026-11-15).** Queda del dueño: hacer en el iPhone las
listas «Copia de seguridad», «Lugares» y «Finanzas: disponible por día»
de `docs/TESTING.md` y avisar qué falló.

## Libros, Biblia y Medir tiempos: siguiente nivel (pedido del dueño, 2026-11-06)
Diseño, auditoría y bitácora en `docs/LECTURA_NIVEL2.md`; decisiones desde
D-102. Cada fase deja la app funcionando y publicada.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría y diseño (capturas, preguntas al dueño) | ✅ |
| 1 | Biblia: texto RV1909, lector y descarga sin internet | ✅ |
| 2 | Biblia: anotar desde el lector, resaltados, notas, favoritos, búsqueda, compartir | ✅ |
| 3 | Biblia: planes, progreso de capítulos, memorización, temas, racha | ✅ |
| 4 | Libros: "Leer ahora", velocidad, estados y formatos | ✅ |
| 5 | Libros: ISBN, importar, frases, notas, "¿Qué leo después?", estadísticas | ✅ (D-108 a D-112) |
| 6 | Medir tiempos: definitiva, actividades, cronómetro, "Mi mañana", autollenado | ✅ (D-113) |
| 7 | Medir tiempos: plan de la mañana, estadísticas, experimentos; "Mi día" y Hábitos | ✅ (D-114) |
| 8 | QA final, docs y lista para el iPhone | ✅ (D-115) |

**Plan terminado (2026-11-15).** Queda del dueño:
1. Hacer la lista «Libros, Biblia y Medir tiempos: lista final» de
   `docs/TESTING.md` en el iPhone y avisar qué falló.
2. Decir si quiere un pitido o una voz cuando un paso de «Mi mañana» pasa
   su promedio (opcional; hoy el reloj se pone naranja).

Preguntas al dueño (fase 0): ¿diario de oración? (sin respuesta = no) y
versión para "Abrir en otra versión" (sin respuesta = RVR1960 en
BibleGateway; se cambia en «Aa»).

Datos de prueba: `scripts/e2e/lectura-semilla.js`.

### Para después (anotado, no hacer)
- Biblia en audio.
- Otras versiones en español con licencia libre del mismo repositorio
  (`spa-bes`, `spa-pddpt`, `spa-vbl`).
- Clubes de lectura con otros usuarios de Manolo.

## Ejercicio: mucho más inteligente y con demo (pedido del dueño, 2026-11-05)
Diseño, auditoría y bocetos en `docs/EJERCICIO_INTELIGENTE.md`; decisiones
desde D-090. Cada fase deja la app funcionando y publicada.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría y diseño (capturas, problemas, bocetos) | ✅ |
| 1 | Demos: script, WebP en el repo, caché con límite, precarga de rutinas | ✅ |
| 2 | Ficha del ejercicio: técnica, videos, historial, récords, alternativas | ✅ (pasos: lotes 1 y 2, 227 de 592) |
| 3 | Entreno en vivo: objetivos, RIR, calentamiento, discos, superseries, descanso con aviso, récords, resumen | ✅ |
| 4 | Progresión v2, estancamiento y descarga + Ajustes del gimnasio | ✅ |
| 5 | Volumen semanal, equilibrio y generador de rutinas | ✅ |
| 6 | Recuperación, "¿Qué entreno hoy?" y carga total con Running | ✅ |
| 7 | Resumen inteligente, Perfil y compartir | ✅ |
| 8 | QA final, docs y lista para el iPhone | ✅ |

Datos de prueba: `scripts/e2e/ejercicio-semilla.js` (9 semanas realistas).

### Para después (anotado, no hacer)
- Videos propios grabados con el teléfono por ejercicio.
- Datos de relojes o Apple Salud.
- Retos de fuerza en el Feed.
- Pasos en español del resto de los ejercicios (365), por lotes en
  `scripts/tecnica/pasos-3.mjs`, … y `npm run tecnica` (subir el `?v=` de
  `RUTA_TECNICA` en `js/ej-ficha.js`).

## Hábitos: categorías y siguiente nivel (pedido del dueño, 2026-11-05)
Diseño, auditoría y tablas en `docs/HABITOS.md`; decisiones desde D-079.
Cada fase deja la app funcionando y publicada.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría y diseño (capturas, categorías, tabla de dificultad) | ✅ |
| 1 | Motor y modelo de categorías (migración en lectura) | ✅ |
| 2 | Nueva dificultad + Temporada 2 | ✅ |
| 3 | Gestión de categorías (Ajustes, formulario, asignar en lote) | ✅ |
| 4 | Hoy: filtros, agrupar, colores, ocultar hechos, arreglos | ✅ |
| 5 | Página de categoría, Estadísticas por categoría, misiones y logros | ✅ |
| 6 | Se marca solo (Running, Bici, Movilidad, Libros, Biblia, Finanzas) | ✅ |
| 7 | Plantillas, hora opcional, aviso de pendientes | ✅ (push y Calendario: investigado, espera OK) |
| 8 | QA final, `docs/HABITOS.md`, lista para el iPhone | ✅ |

**Plan terminado (2026-11-05).** El dueño eligió las 4 categorías extra
(vienen de fábrica, D-088) y no quiere recordatorios fuera de Manolo por
ahora. Queda: que haga la lista "Hábitos: categorías y siguiente nivel" de
`docs/TESTING.md` en el iPhone y avise.

Después: racha que perdona (D-089) y revisión de pantallas antes/después
(otros módulos idénticos; 9 detalles visuales de Hábitos corregidos, ver
`docs/CHANGELOG.md`).

### Para después (anotado, no hacer)
- Push con la app cerrada.
- Recordatorios en el Calendario del iPhone (.ics con alarmas).
- Metas que agrupen hábitos (p. ej. "Correr un 10K" con sus hábitos).
- Más planes guiados como Scalping.

## Running al nivel de Strava (pedido del dueño, 2026-11-04)
Diseño en `docs/RUNNING.md`; decisiones D-060 a D-069; esquema en
`docs/DATABASE.md`. Cada fase deja la app funcionando y publicada.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Diseño: auditoría dirigida, pantallas, esquema, decisiones | ✅ |
| 1 | Importación (GPX/TCX/FIT/gz, ZIP de Strava y otros) + motor de métricas + guardado | ✅ (falta comparar con un export real) |
| 2 | Detalle de la actividad (mapa, gráfico, parciales, editar, GPX, borrar) | ✅ |
| 3 | Actividades (feed) + barra propia + tarjeta Running en Inicio | ✅ |
| 4 | Progreso (totales, diario, mejores marcas, predicciones, forma y fatiga, metas, zapatillas) | ✅ (mapa de calor en la 6) |
| 5 | Inteligencia (Resumen inteligente, Mismo recorrido) | ✅ |
| 6 | Segmentos + mapa de calor | ✅ |
| 7 | Compartir (imagen tipo historia; publicar en el Feed solo con OK) | ✅ imagen; Feed: esperando OK del dueño |
| 8 | QA final (390 y 1280 px, rendimiento, offline, respaldo) | ✅ |

**Plan terminado (2026-11-04).** Queda del dueño:
1. Mandar `activities.csv` y 1–2 archivos de `activities/` de su export de
   Strava para validar contra la realidad (si algo se pasa de la
   tolerancia, se ajusta el motor con una prueba nueva).
2. Decir si quiere publicar carreras en el Feed de Ejercicio (D-076).
3. Hacer la lista "Running al nivel de Strava" de `docs/TESTING.md` en el
   iPhone.

**Pedido al dueño (2026-11-04):** `activities.csv` y 1–2 archivos de la
carpeta `activities/` de su export de Strava, para comparar (distancia
±2 %, tiempo en movimiento ±3 %, desnivel ±15 %) y ajustar el motor.
APIs de clima, elevación y lugar verificadas desde GitHub Actions (D-066).

## Para después (anotado, no hacer)
- Planificador de rutas con perfil de altura y GPX para el reloj.
- Sincronización automática con la API de Strava (necesita un servidor
  para el secreto de OAuth).
- Vista tipo Strava para Bicicleta.
- Resumen del año.

## Qué queda de antes (no es código)
1. El dueño publica `firestore.rules` y crea `admins/{su uid}`
   (`docs/ADMIN.md`).
2. El dueño hace la lista "Pruebas en el iPhone" de `docs/TESTING.md`.

## Ideas para después (no pedidas, no empezadas)
- Crear o editar rutinas dentro de la app (hoy solo por CSV).
