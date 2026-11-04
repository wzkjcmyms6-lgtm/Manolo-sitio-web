# Fase actual

## Running al nivel de Strava (pedido del dueño, 2026-11-04)
Diseño en `docs/RUNNING.md`; decisiones D-060 a D-069; esquema en
`docs/DATABASE.md`. Cada fase deja la app funcionando y publicada.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Diseño: auditoría dirigida, pantallas, esquema, decisiones | ✅ |
| 1 | Importación (GPX/TCX/FIT/gz, ZIP de Strava y otros) + motor de métricas + guardado | ✅ (falta comparar con un export real) |
| 2 | Detalle de la actividad (mapa, gráfico, parciales, editar, GPX, borrar) | ✅ |
| 3 | Actividades (feed) + barra propia + tarjeta Running en Inicio | ✅ |
| 4 | Progreso (totales, diario, mejores marcas, predicciones, forma y fatiga, metas, zapatillas) | — |
| 5 | Inteligencia (Resumen inteligente, Mismo recorrido) | — |
| 6 | Segmentos + mapa de calor | — |
| 7 | Compartir (imagen tipo historia; publicar en el Feed solo con OK) | — |
| 8 | QA final (390 y 1280 px, rendimiento, offline, respaldo) | — |

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
