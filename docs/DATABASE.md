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
| `users/{uid}/running/{id}` · `bicicleta/{id}` | 3/5 | + `fuente:"gps"`, `inicio, fin` (ms), `tiempoTotalS, tiempoMovS, distanciaM, desnivelM?, parciales:[seg por km]`, `velMaxKmh?`, `rutina?:{id,nombre}` | **Mismas colecciones** y se siguen escribiendo `distance`/`duration` → listas, mapa muscular y respaldo siguen funcionando |
| `users/{uid}/rutas/{actividadId}` | 3 | `tipo, enc` (polilínea codificada, precisión 1e-5), `alt?` (codificada), `n` | Aparte del resumen: las listas no descargan rutas. ~6–10 B por punto → 1 h ≈ 10 KB (límite Firestore 1 MiB) |
| `users/{uid}/rutinas_running/{id}` | 4 | `nombre, intervalos:[{tipo, seg, texto?}], creado, v:1` | Desde CSV |

Datos derivados (ritmo medio, velocidad media) **no se guardan**: se
calculan de distancia y tiempos. Los parciales sí (costoso de recalcular sin
la ruta).
