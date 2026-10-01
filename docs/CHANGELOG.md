# Cambios

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
