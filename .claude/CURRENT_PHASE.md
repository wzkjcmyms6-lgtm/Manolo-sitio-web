# Fase actual

**Fase 2 — Arquitectura deportiva: COMPLETADA** (2026-10-01).

## Fase 3 — Running básico (siguiente, espera OK)
1. Quitar el versículo de Running (`showPanel()` en `modules.js`).
2. `js/actividad-gps.js`: permisos, `watchPosition`, wake lock,
   `visibilitychange`, guardado local cada ~10 s y recuperación.
3. Pantallas: previa (Carrera libre, estado del GPS), activa (DISTANCIA,
   tiempo, ritmo, trazo SVG; Pausar/Reanudar/Finalizar grandes), resumen
   (distancia, tiempos, ritmo/vel. media, desnivel, parciales, mapa) → guardar
   con `ActividadMotor.resumen()` en `running` + `rutas` (un lote).
4. Mantener el registro manual. Lista: mostrar actividades GPS con su ritmo.
5. Leaflet + teselas (D-009) solo en el resumen: verificar condiciones.
6. Calorías estimadas (D-016). Pruebas E2E con GPS simulado; prueba real en
   el iPhone del dueño (pantalla encendida, permisos).
