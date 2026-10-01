# Running

## Hoy
`js/running.js` + `#panel-running`: formulario manual (fecha, km, minutos,
RPE, notas), lista y totales. Colección `users/{uid}/running`. Muestra el
banner de versículo (por ser sub-panel de Inicio).

## Plan
- Fase 3: quitar el versículo (`showPanel()` en `modules.js`); pantalla
  previa (Carrera libre / Rutina, estado del GPS); pantalla activa
  (DISTANCIA grande, tiempo, ritmo, mapa); pausar/reanudar/finalizar;
  resumen (distancia, tiempo, en movimiento, ritmo medio, velocidad media,
  desnivel si hay, parciales por km, ruta); guardar. El registro manual
  actual **se mantiene** (útil para cinta o sin GPS).
- Fase 4: rutinas por intervalos desde CSV (`docs/CSV_ROUTINES.md`) con
  avisos visual / sonido / voz.
- Fase 6: historial y detalle.
