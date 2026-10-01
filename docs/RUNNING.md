# Running

## Hoy
`js/running.js` + `#panel-running`: formulario manual (fecha, km, minutos,
RPE, notas), lista y totales. Colección `users/{uid}/running`. Muestra el
banner de versículo (por ser sub-panel de Inicio).

## Fase 3 (hecha)
- Sin versículo (`showPanel()` en `modules.js`).
- `js/actividad-ui.js` (común con Bici): **Inicio** (botón, estado del
  permiso de ubicación, aviso de pantalla encendida) → **en vivo**
  (DISTANCIA grande, tiempo, ritmo actual y medio, trazo SVG, estado del
  GPS; Iniciar · Pausar · Reanudar · Finalizar; sin barras de la app) →
  **resumen** (mapa Leaflet + OpenStreetMap o trazo sin conexión, distancia,
  tiempo, ritmo medio, en movimiento, total, velocidad media, desnivel
  aprox., calorías estimadas con tu peso, parciales por km; RPE y notas;
  Guardar · Volver a la carrera · Descartar).
- Recuperación: si Manolo se cierra, al volver la carrera aparece **en
  pausa** desde el último guardado local (cada 10 s); aviso en Inicio.
- Guardado: un lote con el resumen en `running` y la ruta en `rutas`.
  Lista "Tus carreras": las de GPS se abren (resumen + mapa) y se eliminan
  con su ruta. El registro a mano sigue en un desplegable.
- Fase 4: rutinas por intervalos desde CSV (`docs/CSV_ROUTINES.md`) con
  avisos visual / sonido / voz.
- Fase 6: historial y detalle.
