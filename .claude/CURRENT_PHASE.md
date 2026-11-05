# Fase actual

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

**Plan terminado (2026-11-05).** Queda del dueño: elegir categorías extra
(si quiere), decidir sobre recordatorios y hacer la lista "Hábitos:
categorías y siguiente nivel" de `docs/TESTING.md` en el iPhone.

**Pedido al dueño (fase 7):** decir si quiere recordatorios en el
Calendario del iPhone (.ics, gratis) o push con la app cerrada (plan Blaze
de Firebase). Pros, contras y costos en `docs/NOTIFICATIONS.md`.

**Pedido al dueño (fase 0):** elegir cuáles de las categorías extra
propuestas crear (Fe, Lectura, Cuidado personal, Hogar). Mientras tanto
quedan como "Sugeridas" en la gestión de categorías.

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
