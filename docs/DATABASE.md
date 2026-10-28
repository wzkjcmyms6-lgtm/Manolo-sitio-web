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
| `users/{uid}/habitos/scalping` ✅ | 2026-10-21 | Hábito Medible (`meta: 2`, `unidad: "sesiones"`, `especial: "scalping"`) con `registros.{fecha}.v` = sesiones del día y el campo `scalping: { version, habitId, settings, logs, fotos }` ; `scalpingReinicio` (fecha del último reinicio al día 1) | Id fijo. Lo crea el dueño desde la sugerencia en Hoy. Formato del estado: `js/scalping-habit.js`; uso: `docs/SCALPING.md` |
| `accesos/{uid}_{loginMs}` ✅ | 1 | `uid, usuario, tipo:"login", creado: serverTimestamp, leido:false` | Id determinista = **idempotente** (un login, un documento). Sin IP, dispositivo ni ubicación |
| `admins/{uid}` ✅ | 1 | `{}` (o `nombre`) | Lo crea el dueño **a mano en la consola**; la app no puede escribirlo |
| `users/{uid}/running/{id}` (rutina guiada) ✅ | 2026-10-01 | `fuente:"rutina", date, distance (km; 0 si no se anotaron), duration (min activos), notes, inicio, fin (ms), tiempoActivoS, rutina:{id, nombre, completados, total}`, opcional `rpe` | Lo arma `js/rutina-guiada.js`. Mismos `distance`/`duration` de siempre → resumen semanal y mapa muscular lo cuentan |
| `users/{uid}/running/{id}` · `bicicleta/{id}` con GPS (**histórico**, ya no se crean: D-033) | 3/5 | `v:1, fuente:"gps", date, distance (km), duration (min activos), inicio, fin (ms), distanciaM, tiempoTotalS, tiempoActivoS, tiempoMovS, velMaxKmh, parciales:[s], conRuta`, opcionales `huecoM, desnivelPosM, desnivelNegM, rpe, notes, rutina:{id, nombre}` | Lo armaba `ActividadMotor.resumen()` (retirado). **Mismas colecciones** y con `distance`/`duration` de siempre → listas, mapa muscular y respaldo siguen funcionando. Ritmo/velocidad medios no se guardan (se calculan) |
| `users/{uid}/rutas/{mismo id}` (**histórico**, D-033) | 3 | `v:1, deporte, inicio, enc` (lat, lon a 1e-5 y segundos desde el inicio), `tramos:[n por tramo]`, `n`, `alt?` | Ya no se lee ni se crea. Se borra junto con su actividad si el dueño la elimina |
| `users/{uid}/rutinas_running/{id}` ✅ (F4) | 4 | `v:1, nombre, intervalos:[{tipo, seg, texto}], totalSeg, creado`; desde 2026-10-01 también `orden` (cola) y, si es un día de un plan, `plan` y `dia` | Desde CSV o Excel (`docs/CSV_ROUTINES.md`). Aditivo: las viejas sin `orden` van primero. Al completarla, `orden` = mayor + 1 |

| `users/{uid}/biblia/{id}` ✅ | Biblia 2 (2026-10-29) | `v:1, fecha (AAAA-MM-DD), libro` (código estilo OSIS: `"John"`, `"Ps"`, `"1Cor"`…), `capitulo` (número), `versiculo` (texto normalizado: `"16"`, `"16-18"`, `"1,3"`), `texto` (≤ 2000), `nota` (≤ 1000, puede ir vacía), `creado` (ms) | Colección nueva. Nombres y capítulos de los 66 libros en `js/biblia-motor.js`. Racha y calendario se calculan (no se guardan). Ver `docs/LIBROS_BIBLIA.md` |

| `users/{uid}/libros/{id}` ✅ | Libros 3 (2026-10-29) | `v:1, titulo` (≤ 200), `autor` (≤ 150), `paginas` (número o `null`), `estado` (`"por_leer"`, `"leyendo"`, `"terminado"`), `calificacion` (1–5 o `null`), `opinion` (≤ 5000), `fechaRegistro` (AAAA-MM-DD), `fechaInicio`, `fechaFin` (fecha o `null`), `creado` (ms); desde la fase 4 también `portada` | Colección nueva. Lógica en `js/libros-motor.js` |
| `users/{uid}/libros/{id}.portada` ✅ | Libros 4 (2026-10-29) | `{ tipo: "url", url, fuente: "openlibrary" }` (solo URLs de `covers.openlibrary.org`), `{ tipo: "foto", actualizado }` o `null` | Aditivo: libros sin campo = tapa genérica |
| `users/{uid}/libros_portadas/{id del libro}` ✅ | Libros 4 | `v:1, datos` (data URL JPEG, ≤ 300 000 caracteres ≈ 220 KB; en la práctica ~50 KB), `ancho, alto` (≤ 400 × 600), `kb, actualizado` | La foto va aparte del libro para no recargar la lista ni reenviarla en cada edición. Sin Firebase Storage. Se borra al quitar la portada o borrar el libro |
| `users/{uid}/libros_frases/{id}` ✅ | Libros 3 | `v:1, libroId, texto` (≤ 2000), `pagina` (número o `null`), `fecha`, `creado` | Aparte de los libros para listar "Todas mis frases" y editar una sin reescribir el libro. Al borrar un libro se borran sus frases (con confirmación) |

| `users/{uid}/tiempos/{AAAA-MM-DD}` ✅ | Medir tiempos (2026-10-29, **provisoria**) | `fecha` (AAAA-MM-DD, igual al id), `seg: { manana, ejercicio, correr, desayunar, banarse, leer }` (segundos enteros > 0; solo las actividades anotadas ese día), `actualizado` (ms) | Un documento por día. Cada actividad se guarda sola con `set(…, { merge: true })` (solo cambia `seg.<actividad>`); quitar una usa `update` con `FieldValue.delete()`, y si no queda ninguna se borra el día. Promedios y el cierre a los 30 registros por actividad **no se guardan**: se calculan (`js/tiempos-motor.js`). Ver `docs/TIEMPOS.md` |

Datos derivados (ritmo medio, velocidad media) **no se guardan**: se
calculan de distancia y tiempos. Los parciales sí (costoso de recalcular sin
la ruta).
