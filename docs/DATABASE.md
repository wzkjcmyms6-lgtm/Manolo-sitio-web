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
| `users/{uid}/running/{id}` · `bicicleta/{id}` ✅ running (F3) · bici en F5 | 3/5 | `v:1, fuente:"gps", date, distance (km), duration (min activos), inicio, fin (ms), distanciaM, tiempoTotalS, tiempoActivoS, tiempoMovS, velMaxKmh, parciales:[s], conRuta`, opcionales `huecoM, desnivelPosM, desnivelNegM, rpe, notes, rutina:{id, nombre}` | Lo arma `ActividadMotor.resumen()`. **Mismas colecciones** y con `distance`/`duration` de siempre → listas, mapa muscular y respaldo siguen funcionando. Ritmo/velocidad medios no se guardan (se calculan) |
| `users/{uid}/rutas/{mismo id}` ✅ (F3) | 3 | `v:1, deporte, inicio, enc` (lat, lon a 1e-5 y segundos desde el inicio), `tramos:[n por tramo]`, `n`, `alt?` | Aparte del resumen: las listas no descargan rutas. Medido en pruebas: < 12 caracteres por punto → 1 h ≈ 15–30 KB (límite Firestore 1 MiB). Se escribe en el mismo lote que el resumen |
| `users/{uid}/rutinas_running/{id}` ✅ (F4) | 4 | `v:1, nombre, intervalos:[{tipo, seg, texto}], totalSeg, creado` | Desde CSV o Excel (`docs/CSV_ROUTINES.md`). Las carreras guardan `rutina: {id, nombre, completados, total}` |

Datos derivados (ritmo medio, velocidad media) **no se guardan**: se
calculan de distancia y tiempos. Los parciales sí (costoso de recalcular sin
la ruta).
