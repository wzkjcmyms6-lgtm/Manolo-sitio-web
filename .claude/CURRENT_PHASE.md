# Fase actual

## Mejoras sin servidor (pedido del dueño, 2026-11-15)
El dueño eligió: app más rápida, rutinas desde la app (Running y gimnasio)
y "más grandes" sin servidor (modo claro, Biblia en audio). Notificaciones
con la app cerrada y Strava automático quedan para después ("Ahora no").

| Fase | Qué | Estado |
|---|---|---|
| 1 | Biblia en audio (voces del iPhone) | ✅ (D-123) |
| 2 | Rutinas de Running: crear y editar en la app (sin CSV) | ✅ (D-124) |
| 3 | Rutinas del gimnasio: guardar lo cambiado al entrenar, entreno libre como rutina, aviso al cerrar el editor | ✅ (D-125) |
| 4 | Modo claro (automático o elegido) | ⏳ |
| 5 | Que la app abra más rápido | ⏳ |
| 6 | Control final y entrega | ⏳ |

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
