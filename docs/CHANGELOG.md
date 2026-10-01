# Cambios

## 2026-10-01 · Deslizar hacia abajo para cerrar las hojas
- Todas las hojas que suben desde abajo (nueva transacción, filtros,
  presupuesto, categorías, hábitos, gimnasio, rutinas, récords, avisos…) se
  pueden bajar con el dedo: siguen al dedo, se cierran si se bajan lo
  suficiente o con un tirón, y si no vuelven a su lugar (D-038).
- Barrita arriba de las hojas en el teléfono. Nuevo `js/hoja-deslizar.js`;
  E2E nuevo `hojas.js` (16).

## 2026-10-01 · Running y Bici sin GPS, resumen semanal y planes de varios días
- **GPS retirado** (pedido del dueño, D-033): sin "Iniciar carrera/rodada",
  sin permiso de ubicación, sin mapas ni Leaflet. Las actividades viejas con
  GPS siguen en el historial.
- **Resumen semanal** en Running y Bici (D-035): semana elegida con
  Distancia y Tiempo y línea de las últimas 12 semanas; tocar un punto elige
  la semana; sin desnivel.
- **Rutinas guiadas de varios días** (D-034): columna `dia` en el CSV; cada
  día es una rutina en una cola ("Siguiente" arriba); al completar una pasa
  al final (D-036). Pantalla de la rutina sin GPS (intervalo, Tiempo, Quedan,
  lista, pitidos y voz, pausa, recuperación) y resumen con km opcionales
  (D-037). Borrar una rutina o un plan entero no borra el historial.
- Historial: cada actividad se puede eliminar; las de rutina muestran su
  nombre ("Plan 5K · Día 2") y los intervalos hechos.
- Nuevos: `js/rutina-guiada.js`; reescritos `actividad-analisis.js` y
  `actividad-registro.js`; `intervalos-motor.js` con su propio reloj; wake
  lock en `avisos.js`. Borrados: `actividad-motor.js`, `actividad-vista.js`,
  `actividad-gps.js`, `actividad-ui.js`, `vendor/leaflet-1.9.4/` y sus
  pruebas. Pruebas: 209 unitarias; E2E nuevo `running.js` (64).

## 2026-10-01 · Fase 8 (QA final)
- Regresión ampliada: las 15 pantallas en teléfono (390 px) y computadora
  (1280 px), sin errores ni scroll de lado; acciones de todos los días
  (hábito, gasto, Running/Bici a mano, serie de gimnasio) y aviso "Sin
  conexión".
- El Firestore de prueba ahora entiende `FieldPath`, `increment` y
  `arrayUnion`/`arrayRemove` como el real (antes no se podía probar marcar
  un hábito).
- Lista de pruebas para el iPhone del dueño en `docs/TESTING.md`.
- Sin cambios en la app ni en la base de datos.

## 2026-10-01 · Fase 7 (optimización)
- Mediciones de carga y de Firestore documentadas (`PERFORMANCE.md`,
  `COST_OPTIMIZATION.md`).
- Batería: trazo en vivo como mucho cada 3 s, borrador cada 30 s en
  actividades largas, GPS apagado tras 3 min en pausa.
- Mapas: se liberan al cerrarse (sin fuga de memoria).
- Gráficos con escala mínima (sin "serrucho" por diferencias de 1 s).
- Escritorio: actividad y resumen con ancho máximo.
- Revisión de seguridad de las plantillas nuevas (sin hallazgos de
  inyección). README actualizado.

## 2026-10-01 · Fase 6 (historial y análisis)
- Running y Bici: "Tu progreso" con barras de 12 semanas (distancia,
  tiempo, cantidad), tendencia de 4 semanas con ritmo/velocidad medio y
  mejores marcas GPS (tocar abre la actividad); lista separada por meses.
- Detalle: gráfico de ritmo (o velocidad) a lo largo del recorrido, altitud
  aproximada y parciales con el mejor y el peor resaltados.
- Nuevo `js/actividad-analisis.js`. Pruebas: 224 unitarias; E2E `fase6.js` (15).

## 2026-10-01 · Fase 5 (Bicicleta con GPS)
- Bicicleta con las pantallas de Running: velocidad como número grande,
  parciales de 5 km, velocidad máxima, sin calorías; sin versículo; lista
  "Tus rodadas" (abrir/eliminar GPS) y registro a mano en desplegable; aviso
  en Inicio de rodada sin terminar; una actividad a la vez.
- `js/actividad-registro.js`: lista/totales/registro a mano comunes a
  Running y Bici (antes duplicados). E2E `fase5.js` (22 comprobaciones).

## 2026-10-01 · Fase 4 (rutinas de Running con avisos)
- Importar rutinas desde CSV o Excel con vista previa y errores por fila;
  plantilla descargable; lista y eliminación en el inicio de Running.
- Carrera con rutina: tarjeta del intervalo (restante, siguiente, progreso),
  cuenta 3-2-1 con pitidos, aviso grande y voz local en cada cambio y al
  terminar; Sonido/Voz apagables; sigue sin GPS; recuperación; la carrera
  guarda la rutina usada.
- Nuevos: `rutina-running.js`, `rutinas-running-ui.js`, `avisos.js`.
  Pruebas: 215 unitarias; E2E `fase4.js` (32 comprobaciones).

## 2026-10-01 · Fase 3 (Running con GPS)
- Running sin versículo; carrera con GPS: inicio con estado del permiso,
  pantalla en vivo (distancia, tiempo, ritmo, trazo, estado del GPS),
  pausar/reanudar/finalizar, resumen con mapa (Leaflet + OpenStreetMap),
  parciales, desnivel aprox. y calorías estimadas; RPE y notas; guardado en
  un lote (resumen + ruta); recuperación tras cierre; aviso en Inicio.
- Lista "Tus carreras": abrir y eliminar carreras GPS; registro a mano en un
  desplegable. Tarjeta de Inicio actualizada.
- Nuevos: `actividad-vista.js`, `actividad-gps.js`, `actividad-ui.js`,
  `vendor/leaflet-1.9.4/`. Pruebas: 206 unitarias; E2E `fase3.js` (47) y
  `scripts/e2e/comun.js`.

## 2026-10-01 · Fase 2 (arquitectura deportiva)
- `js/actividad-motor.js`: estados, filtros GPS, distancia (Haversine),
  tiempos total/activo/en movimiento, ritmo y velocidad, desnivel,
  parciales, huecos estimados, resumen para Firestore y ruta codificada.
- `js/intervalos-motor.js`: rutina por intervalos con reloj por marcas de
  tiempo, cuenta atrás, cambios, fin y textos de voz.
- +20 pruebas (201). Diseño cerrado en `SPORTS.md`, `GPS.md`, `DATABASE.md`
  y decisiones D-009, D-015 a D-017. Sin cambios visibles en la app.

## 2026-10-01 · Fase 1 (login, hábitos, accesos)
- Login: contraseña con teclado numérico, botón "Usar teclado de letras"
  (se recuerda), botón ver/ocultar; campos a 16 px.
- Hábitos: nota/descripción opcional (crear, editar, vaciar), una línea en
  la lista de Hoy y completa en el detalle. Hábitos viejos intactos.
- Accesos: evento único por inicio de sesión real, campana y bandeja del
  administrador en tiempo real (leído / no leído, marcar todo, historial
  de 50 en 50, aviso flotante). `firestore.rules` versionado.
- Pruebas: +6 unitarias (181) y `scripts/e2e/` (fase1: 39 comprobaciones;
  regresión de 15 pantallas).

## 2026-10-01 · Fase 0 (auditoría)
- Documentación persistente creada (`docs/*.md`, `.claude/*.md`). Sin
  cambios en la app.

## 2026-10-01 · Antes del prompt maestro
- Ejercicio › Perfil con cabecera y gráfico semanal estilo apps de gimnasio.
- Ejercicio › registro de entreno estilo apps de gimnasio (✓ por serie,
  Anterior, descanso, deslizar para borrar) y espacio bajo la barra inferior.
- Mapa muscular, Rangos, Feed, rutinas, importador: ver `docs/mapa-muscular.md`
  y el historial de git.
