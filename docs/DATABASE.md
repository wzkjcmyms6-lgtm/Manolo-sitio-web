# Modelo de datos (Firestore)

Regla general: **cambios solo aditivos**; nunca borrar ni reescribir datos
existentes. Todo lo privado bajo `users/{uid}/…` (las reglas ya lo aíslan
por dueño).

## Actual

| Ruta | Contenido |
|---|---|
| `users/{uid}/habitos/{id}` | `v:2, name, emoji, tipo, freqType, days, timesPerWeek, cadaN, timeOfDay, dificultad, area, minima, despuesDe, vinculo, meta?, unidad?, done[], registros{AAAA-MM-DD:{…, n: nota del día}}, createdAt, inicio, orden, archivado?` |
| `users/{uid}/meta/*` | `habitos_juego`, `habitos_dias`, `perfil`, `plan_semanal`, `ajustes_ejercicio`, `ejercicios_propios`, `asignaciones_ejercicios`, `perfil_ejercicio`, `rangos_vinculos`, `rangos_snapshot`, finanzas (`presupuestos`, `finanzas_ajustes`, categorías…) |
| `users/{uid}/entrenamientos/{id}` | gimnasio: `date, name, startedAt, durationMin, exercises[], prs, rutinaId?` |
| `users/{uid}/rutinas/{id}` | rutinas de gimnasio |
| `users/{uid}/running/{id}` · `bicicleta/{id}` | `date, distance (km), duration (min), notes, rpe?` (manual) |
| `users/{uid}/finanzas`, `ahorros`, `carteras_movimientos`, `inversiones`, `finanzas_respaldos` | Finanzas / Inversiones |
| `feed/{uid_…}` + `comentarios` | Feed compartido de Ejercicio |

## Nuevo y propuesto (✅ = implementado)

| Ruta | Fase | Campos | Notas |
|---|---|---|---|
| `users/{uid}/habitos/{id}.descripcion` ✅ | 1 | string ≤ 300, opcional | Aditivo; hábitos viejos sin campo = sin nota |
| `accesos/{uid}_{loginMs}` ✅ | 1 | `uid, usuario, tipo:"login", creado: serverTimestamp, leido:false` | Id determinista = **idempotente** (un login, un documento). Sin IP, dispositivo ni ubicación |
| `admins/{uid}` ✅ | 1 | `{}` (o `nombre`) | Lo crea el dueño **a mano en la consola**; la app no puede escribirlo |
| `users/{uid}/running/{id}` (rutina guiada) ✅ | 2026-10-01 | `fuente:"rutina", date, distance (km; 0 si no se anotaron), duration (min activos), notes, inicio, fin (ms), tiempoActivoS, rutina:{id, nombre, completados, total}`, opcional `rpe` | Lo arma `js/rutina-guiada.js`. Mismos `distance`/`duration` de siempre → resumen semanal y mapa muscular lo cuentan |
| `users/{uid}/running/{id}` · `bicicleta/{id}` con GPS (**histórico**, ya no se crean: D-033) | 3/5 | `v:1, fuente:"gps", date, distance (km), duration (min activos), inicio, fin (ms), distanciaM, tiempoTotalS, tiempoActivoS, tiempoMovS, velMaxKmh, parciales:[s], conRuta`, opcionales `huecoM, desnivelPosM, desnivelNegM, rpe, notes, rutina:{id, nombre}` | Lo armaba `ActividadMotor.resumen()` (retirado). **Mismas colecciones** y con `distance`/`duration` de siempre → listas, mapa muscular y respaldo siguen funcionando. Ritmo/velocidad medios no se guardan (se calculan) |
| `users/{uid}/rutas/{mismo id}` (**histórico**, D-033) | 3 | `v:1, deporte, inicio, enc` (lat, lon a 1e-5 y segundos desde el inicio), `tramos:[n por tramo]`, `n`, `alt?` | Ya no se lee ni se crea. Se borra junto con su actividad si el dueño la elimina |
| `users/{uid}/rutinas_running/{id}` ✅ (F4) | 4 | `v:1, nombre, intervalos:[{tipo, seg, texto}], totalSeg, creado`; desde 2026-10-01 también `orden` (cola) y, si es un día de un plan, `plan` y `dia` | Desde CSV o Excel (`docs/CSV_ROUTINES.md`). Aditivo: las viejas sin `orden` van primero. Al completarla, `orden` = mayor + 1 |

Datos derivados (ritmo medio, velocidad media) **no se guardan**: se
calculan de distancia y tiempos. Los parciales sí (costoso de recalcular sin
la ruta).
